import type {
  EngineMode,
  GroupingPlan,
  PrismSettings,
  SortWindowResult,
  TabMetadata,
} from '../domain/types';
import { runLogicGrouping } from '../engine/logic/logic-engine';
import { runMeaningGrouping } from '../engine/meaning/meaning-engine';
import { extractDomainInfo, isDisposableTab } from '../engine/shared/url-classifier';
import type { BrowserTabsPort } from '../ports/browser-tabs.port';
import type { ClockPort } from '../ports/clock.port';
import type { LlmGatewayPort } from '../ports/llm-gateway.port';
import type { SettingsRepositoryPort } from '../ports/settings-repository.port';
import { buildUndoSnapshot } from './undo-snapshot';

export interface SortWindowOptions {
  modeOverride?: EngineMode;
  windowId?: number;
}

function resolveAiCredentials(settings: PrismSettings): {
  apiKey: string;
  model: string;
  baseUrl?: string;
} {
  if (settings.aiProvider === 'groq') {
    return {
      apiKey: settings.groqApiKey.trim(),
      model: settings.groqModel,
    };
  }
  if (settings.aiProvider === 'custom') {
    return {
      apiKey: settings.customApiKey.trim(),
      model: settings.customModel || 'gpt-4o-mini',
      baseUrl: settings.customBaseUrl,
    };
  }
  return {
    apiKey: settings.geminiApiKey.trim(),
    model: settings.geminiModel,
  };
}

function formatGroupTitle(emoji: string, groupName: string): string {
  const cleanEmoji = emoji.trim();
  const cleanName = groupName.trim();
  if (!cleanEmoji) return cleanName;
  if (!cleanName) return cleanEmoji;
  return `${cleanEmoji} ${cleanName}`;
}

export class SortWindowUseCase {
  constructor(
    private readonly tabsPort: BrowserTabsPort,
    private readonly settingsRepo: SettingsRepositoryPort,
    private readonly llmGateway: LlmGatewayPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(options: SortWindowOptions = {}): Promise<SortWindowResult> {
    const settings = await this.settingsRepo.loadSettings();
    const windowId = options.windowId ?? (await this.tabsPort.getCurrentWindowId());

    const [windowTabs, existingGroups] = await Promise.all([
      this.tabsPort.getWindowTabs(windowId),
      this.tabsPort.getWindowTabGroups(windowId),
    ]);

    // 1. Identify disposable tabs in memory WITHOUT closing them until after grouping
    const disposableIds = windowTabs
      .filter((t) =>
        isDisposableTab(t, {
          closeEmptyTabs: settings.closeEmptyTabs,
          closeYouTubeHomeTabs: settings.closeYouTubeHomeTabs,
        }),
      )
      .map((t) => t.id);
    const disposableIdSet = new Set<number>(disposableIds);

    // 2. Determine Smart Merge vs Clean Slate
    const groupedTabIds = new Set(existingGroups.flatMap((g) => g.tabIds));
    const hasUngroupedGroupableWebTabs = windowTabs.some(
      (t) =>
        !t.pinned &&
        !disposableIdSet.has(t.id) &&
        !extractDomainInfo(t.url).isInternalBrowserUrl &&
        !groupedTabIds.has(t.id),
    );

    const groupsForEngine =
      settings.deterministicOptions.preserveExistingGroups && hasUngroupedGroupableWebTabs
        ? existingGroups
        : [];

    // 3. Capture UndoSnapshot BEFORE mutating tabs or groups
    const snapshot = buildUndoSnapshot(windowId, windowTabs, existingGroups, this.clock.nowMs());
    await this.settingsRepo.saveUndoSnapshot(snapshot);

    // 4. Compute GroupingPlan (excluding disposable tabs from clustering)
    const tabsForPlanning = windowTabs.filter((t) => !disposableIdSet.has(t.id));
    const requestedMode = options.modeOverride ?? settings.mode;

    let plan: GroupingPlan;
    if (requestedMode === 'meaning') {
      const creds = resolveAiCredentials(settings);
      plan = await runMeaningGrouping({
        tabs: tabsForPlanning,
        provider: settings.aiProvider,
        apiKey: creds.apiKey,
        model: creds.model,
        baseUrl: creds.baseUrl,
        customPromptDirective: settings.customPromptDirective,
        deterministicRules: settings.customRules,
        deterministicOptions: settings.deterministicOptions,
        existingGroups: groupsForEngine,
        maxTabsPerGroup: settings.maxTabsPerGroup,
        gateway: this.llmGateway,
        clock: this.clock,
      });
    } else {
      plan = runLogicGrouping({
        tabs: tabsForPlanning,
        rules: settings.customRules,
        options: settings.deterministicOptions,
        existingGroups: groupsForEngine,
        maxTabsPerGroup: settings.maxTabsPerGroup,
        clock: this.clock,
      });
    }

    // 5. Apply groups strictly in target windowId
    const validWindowTabIds = new Set(windowTabs.map((t) => t.id));
    const tabById = new Map<number, TabMetadata>(windowTabs.map((t) => [t.id, t]));
    const activeTabId = windowTabs.find((t) => t.active)?.id;
    const appliedGroupIds: Record<string, number> = {};
    let collapsedGroupsCount = 0;

    const existingPlanGroups = plan.groups.filter((g) => typeof g.existingGroupId === 'number');
    const newPlanGroups = plan.groups.filter((g) => typeof g.existingGroupId !== 'number');

    // 5a. Update existing preserved groups first so membership is settled before moving new groups
    for (const group of existingPlanGroups) {
      const existingGroupId = group.existingGroupId;
      if (typeof existingGroupId !== 'number') continue;
      const validGroupTabs = group.tabIds.filter((id) => validWindowTabIds.has(id));
      if (validGroupTabs.length === 0) continue;

      const containsActive = activeTabId !== undefined && validGroupTabs.includes(activeTabId);
      const shouldCollapse = settings.collapseOthersOnGroup && !containsActive;

      appliedGroupIds[group.id] = existingGroupId;
      const toAdd = (group.addedTabIds ?? []).filter((id) => validWindowTabIds.has(id));
      if (toAdd.length > 0) {
        await this.tabsPort.addTabsToGroup(existingGroupId, toAdd);
      }
      await this.tabsPort.updateTabGroup(existingGroupId, {
        collapsed: shouldCollapse,
      });
      if (shouldCollapse) collapsedGroupsCount++;
    }

    // Ensure tabs intended to be ungrouped (e.g. during Clean Slate) are detached from old groups
    // BEFORE moving tabs so Chromium does not preserve stale tab-group boundaries across moves.
    const staleGroupedIds = plan.ungroupedTabIds.filter((id) => {
      if (!validWindowTabIds.has(id)) return false;
      const t = tabById.get(id);
      return t !== undefined && typeof t.groupId === 'number' && t.groupId >= 0;
    });
    if (staleGroupedIds.length > 0) {
      await this.tabsPort.ungroupTabs(staleGroupedIds);
    }

    // 5b. Align multi-group tab strip order so related groups (e.g. YouTube topics & Другое) stay contiguous
    if (newPlanGroups.length >= 2) {
      const toDetachBeforeMove = newPlanGroups.flatMap((g) =>
        g.tabIds.filter((id) => {
          if (!validWindowTabIds.has(id)) return false;
          const t = tabById.get(id);
          return t !== undefined && typeof t.groupId === 'number' && t.groupId >= 0;
        }),
      );
      if (toDetachBeforeMove.length > 0) {
        await this.tabsPort.ungroupTabs(toDetachBeforeMove);
      }

      const hasExistingPreserved = existingPlanGroups.length > 0;
      const pinnedCount = windowTabs.filter((t) => t.pinned).length;
      let nextSequentialIndex = pinnedCount;

      for (const group of newPlanGroups) {
        const validGroupTabs = group.tabIds.filter((id) => validWindowTabIds.has(id));
        for (const tabId of validGroupTabs) {
          if (hasExistingPreserved) {
            await this.tabsPort.moveTab(tabId, -1);
          } else {
            await this.tabsPort.moveTab(tabId, nextSequentialIndex);
            nextSequentialIndex++;
          }
        }
      }
    }

    // 5c. Create new Chrome tab groups in planned order
    for (const group of newPlanGroups) {
      const validGroupTabs = group.tabIds.filter((id) => validWindowTabIds.has(id));
      if (validGroupTabs.length === 0) continue;

      const containsActive = activeTabId !== undefined && validGroupTabs.includes(activeTabId);
      const shouldCollapse = settings.collapseOthersOnGroup && !containsActive;

      const realGroupId = await this.tabsPort.createTabGroup(windowId, validGroupTabs, {
        title: formatGroupTitle(group.emoji, group.groupName),
        color: group.color,
        collapsed: shouldCollapse,
      });
      appliedGroupIds[group.id] = realGroupId;
      if (shouldCollapse) collapsedGroupsCount++;
    }

    // 6. Close disposable tabs AFTER grouping, always leaving at least 1 tab in the window
    let closedTabsCount = 0;
    if (disposableIds.length > 0 && windowTabs.length > 1) {
      const maxClosable = Math.max(0, windowTabs.length - 1);
      const toClose = disposableIds.slice(0, maxClosable);
      if (toClose.length > 0) {
        await this.tabsPort.closeTabs(toClose);
        closedTabsCount = toClose.length;
      }
    }

    // 7. Discard inactive background tabs AFTER closing disposable tabs
    let discardedTabsCount = 0;
    if (settings.discardInactiveTabs) {
      const currentTabs = await this.tabsPort.getWindowTabs(windowId);
      const discardCandidates = currentTabs.filter(
        (t) => !t.active && !t.pinned && !t.audible && !t.discarded,
      );
      for (const candidate of discardCandidates) {
        const ok = await this.tabsPort.discardTab(candidate.id);
        if (ok) discardedTabsCount++;
      }
    }

    const estimatedRamSavedMb =
      closedTabsCount * 45 + discardedTabsCount * 55 + collapsedGroupsCount * 10;

    return {
      plan,
      closedTabsCount,
      discardedTabsCount,
      collapsedGroupsCount,
      estimatedRamSavedMb,
      appliedGroupIds,
    };
  }
}
