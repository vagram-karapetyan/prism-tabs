import {
  extractDomainInfo,
  parseExistingGroupTitle,
} from '../engine/deterministic';
import {
  ChromeTabGroupColor,
  ExistingTabGroup,
  GroupingPlan,
  SortChoreographyProgress,
  TabMetadata,
  TabUndoEntry,
  UndoSnapshot,
} from '../engine/types';

function isChromeTabsAvailable(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.tabs !== 'undefined' &&
    typeof chrome.tabGroups !== 'undefined'
  );
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const EMPTY_TAB_URL_PATTERNS = [
  /^chrome:\/\/newtab\/?$/i,
  /^chrome-search:\/\/local-ntp/i,
  /^edge:\/\/newtab\/?$/i,
  /^brave:\/\/newtab\/?$/i,
  /^vivaldi:\/\/newtab\/?$/i,
  /^opera:\/\/startpage\/?$/i,
  /^about:(newtab|blank|home)$/i,
];

const EMPTY_TAB_TITLES = new Set([
  'new tab',
  'новая вкладка',
  'нова вкладка',
  'untitled',
  'untitled tab',
  'about:blank',
]);

/**
 * Checks whether a tab is an empty "New Tab" or `about:blank` page.
 * Never matches pinned tabs.
 */
export function isEmptyBrowserTab(tab: {
  url?: string;
  pendingUrl?: string;
  title?: string;
  pinned?: boolean;
}): boolean {
  if (tab.pinned) return false;

  const rawUrl = (tab.url || tab.pendingUrl || '').trim();
  const rawTitle = (tab.title || '').trim().toLowerCase();

  if (!rawUrl) {
    return !rawTitle || EMPTY_TAB_TITLES.has(rawTitle);
  }

  return EMPTY_TAB_URL_PATTERNS.some((rx) => rx.test(rawUrl));
}

/**
 * Checks whether the current window has any real groupable web tabs outside existing Chrome tab groups.
 * Excludes pinned tabs, empty New Tabs, and internal browser pages (`chrome://`, `edge://`, `about:`).
 */
export function hasUngroupedGroupableWebTabs(
  windowTabs: TabMetadata[],
  existingGroups: ExistingTabGroup[]
): boolean {
  const groupedIds = new Set(existingGroups.flatMap((eg) => eg.tabIds));
  return windowTabs.some(
    (t) =>
      !t.pinned &&
      !isEmptyBrowserTab(t) &&
      !extractDomainInfo(t.url).isInternalBrowserUrl &&
      !groupedIds.has(t.id)
  );
}

/**
 * Closes all unpinned empty ("New Tab" / `about:blank`) tabs strictly in the current active window.
 * If every single tab in the window is empty, keeps 1 tab open so the browser window itself isn't closed.
 */
export async function closeEmptyTabsInWindow(): Promise<number> {
  if (!isChromeTabsAvailable()) {
    const emptyIds = demoTabState
      .filter((t) => isEmptyBrowserTab(t))
      .map((t) => t.id);
    if (emptyIds.length === 0) return 0;

    const idsToClose =
      emptyIds.length >= demoTabState.length ? emptyIds.slice(1) : emptyIds;
    if (idsToClose.length === 0) return 0;

    const removeSet = new Set(idsToClose);
    demoTabState = demoTabState.filter((t) => !removeSet.has(t.id));
    return idsToClose.length;
  }

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const emptyTabIds = tabs
    .filter(
      (t): t is chrome.tabs.Tab & { id: number } =>
        typeof t.id === 'number' && isEmptyBrowserTab(t)
    )
    .map((t) => t.id);

  if (emptyTabIds.length === 0) {
    return 0;
  }

  // Keep 1 tab alive if 100% of tabs in the window are empty New Tabs
  const idsToRemove =
    emptyTabIds.length >= tabs.length ? emptyTabIds.slice(1) : emptyTabIds;

  if (idsToRemove.length === 0) {
    return 0;
  }

  try {
    await chrome.tabs.remove(idsToRemove);
    return idsToRemove.length;
  } catch {
    return 0;
  }
}

/**
 * Fallback demo tabs used only when previewing the UI in a standalone browser tab
 * outside the Chrome Extension runtime.
 */
const DEMO_TABS: TabMetadata[] = [
  {
    id: 101,
    title: 'Feat: Add WebGPU shader pipeline by alex · Pull Request #412 · prism-org/prism',
    url: 'https://github.com/prism-org/prism/pull/412',
    pinned: false,
    groupId: 1,
    index: 0,
  },
  {
    id: 102,
    title: 'Fix race condition in background worker · Issue #19 · prism-org/prism',
    url: 'https://github.com/prism-org/prism/issues/19',
    pinned: false,
    groupId: -1,
    index: 1,
  },
  {
    id: 103,
    title: 'PRISM-89: WebGPU Refraction Shader Jank on Low-Power Mode — Linear',
    url: 'https://linear.app/prism/issue/PRISM-89/webgpu-refraction-shader',
    pinned: false,
    groupId: -1,
    index: 2,
  },
  {
    id: 104,
    title: 'PRISM-89: WebGPU Shader Benchmark Results — Google Sheets',
    url: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
    pinned: false,
    groupId: -1,
    openerTabId: 103,
    index: 3,
  },
  {
    id: 105,
    title: 'Lo-Fi Synthwave Radio - Beats to Code/Relax To - YouTube',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    pinned: false,
    groupId: -1,
    index: 4,
  },
  {
    id: 106,
    title: 'Deep Focus Electronic Playlist — Spotify',
    url: 'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ',
    pinned: false,
    groupId: -1,
    index: 5,
  },
  {
    id: 107,
    title: 'WebGPU compute shader performance tips - Google Search',
    url: 'https://www.google.com/search?q=WebGPU+compute+shader+performance+tips',
    pinned: false,
    groupId: -1,
    index: 6,
  },
  {
    id: 108,
    title: 'chrome.tabGroups API best practices - Perplexity',
    url: 'https://www.perplexity.ai/search/chrome-tabgroups-api',
    pinned: false,
    groupId: -1,
    index: 7,
  },
  {
    id: 109,
    title: 'External Blog: Debugging WebGPU Compute Shader Context Loss',
    url: 'https://gfx-blog.example.org/2026/debugging-context-loss',
    pinned: false,
    groupId: -1,
    openerTabId: 101,
    index: 8,
  },
];

let demoTabState: TabMetadata[] = [...DEMO_TABS];
let demoGroupMeta = new Map<
  number,
  { title: string; color: ChromeTabGroupColor; collapsed: boolean }
>([[1, { title: '🐙 GitHub: prism-org/prism', color: 'purple', collapsed: false }]]);

/**
 * Queries all open tabs strictly in the current active window (`currentWindow: true`).
 */
export async function getCurrentWindowTabs(): Promise<TabMetadata[]> {
  if (!isChromeTabsAvailable()) {
    return demoTabState;
  }

  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs
    .filter((t): t is chrome.tabs.Tab & { id: number } => typeof t.id === 'number')
    .map((t) => ({
      id: t.id,
      title: t.title || t.url || 'Untitled Tab',
      url: t.url || t.pendingUrl || '',
      favIconUrl: t.favIconUrl,
      pinned: Boolean(t.pinned),
      groupId: typeof t.groupId === 'number' ? t.groupId : -1,
      openerTabId: typeof t.openerTabId === 'number' ? t.openerTabId : undefined,
      index: typeof t.index === 'number' ? t.index : undefined,
      lastAccessed: (t as { lastAccessed?: number }).lastAccessed,
    }));
}

/**
 * Queries all existing Chrome Tab Groups strictly in the current active window
 * (`chrome.windows.WINDOW_ID_CURRENT`), pairing each group with the ordered list
 * of `tabIds` currently inside it.
 */
export async function getCurrentWindowTabGroups(
  currentTabs?: TabMetadata[]
): Promise<ExistingTabGroup[]> {
  const tabs = currentTabs ?? (await getCurrentWindowTabs());

  if (!isChromeTabsAvailable()) {
    const result: ExistingTabGroup[] = [];
    for (const [groupId, meta] of demoGroupMeta.entries()) {
      const memberIds = tabs
        .filter((t) => t.groupId === groupId)
        .map((t) => t.id);
      if (memberIds.length === 0) continue;
      const parsed = parseExistingGroupTitle(meta.title);
      result.push({
        id: groupId,
        title: meta.title,
        cleanTitle: parsed.cleanTitle || meta.title,
        emoji: parsed.emoji,
        color: meta.color,
        collapsed: meta.collapsed,
        tabIds: memberIds,
      });
    }
    return result;
  }

  const nativeGroups = await chrome.tabGroups.query({
    windowId: chrome.windows.WINDOW_ID_CURRENT,
  });

  const tabIdsByGroupId = new Map<number, number[]>();
  for (const tab of tabs) {
    if (typeof tab.groupId === 'number' && tab.groupId > 0) {
      const list = tabIdsByGroupId.get(tab.groupId) ?? [];
      list.push(tab.id);
      tabIdsByGroupId.set(tab.groupId, list);
    }
  }

  return nativeGroups
    .map((ng) => {
      const rawTitle = ng.title || '';
      const parsed = parseExistingGroupTitle(rawTitle);
      const memberIds = tabIdsByGroupId.get(ng.id) ?? [];
      return {
        id: ng.id,
        title: rawTitle,
        cleanTitle: parsed.cleanTitle || rawTitle || 'Group',
        emoji: parsed.emoji,
        color: (ng.color as ChromeTabGroupColor) || 'grey',
        collapsed: Boolean(ng.collapsed),
        tabIds: memberIds,
      };
    })
    .filter((eg) => eg.tabIds.length > 0);
}

/**
 * Captures a full snapshot of the current active window's tab order and group states
 * so the user can Undo with 1 click.
 */
export async function captureUndoSnapshot(): Promise<UndoSnapshot> {
  if (!isChromeTabsAvailable()) {
    return {
      timestamp: Date.now(),
      windowId: 1,
      entries: demoTabState.map((t, index) => {
        const gid = t.groupId ?? -1;
        const gMeta = gid > 0 ? demoGroupMeta.get(gid) : undefined;
        return {
          tabId: t.id,
          index,
          previousGroupId: gid,
          groupTitle: gMeta?.title,
          groupColor: gMeta?.color,
          groupCollapsed: gMeta?.collapsed,
        };
      }),
    };
  }

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const windowId =
    tabs[0]?.windowId ??
    (await chrome.windows.getCurrent()).id ??
    chrome.windows.WINDOW_ID_CURRENT;

  const existingGroups = await chrome.tabGroups.query({
    windowId: chrome.windows.WINDOW_ID_CURRENT,
  });
  const groupMap = new Map<number, chrome.tabGroups.TabGroup>();
  for (const g of existingGroups) {
    groupMap.set(g.id, g);
  }

  const entries: TabUndoEntry[] = [];
  for (const tab of tabs) {
    if (typeof tab.id !== 'number') continue;
    const groupId = typeof tab.groupId === 'number' ? tab.groupId : -1;
    const groupInfo = groupId > 0 ? groupMap.get(groupId) : undefined;

    entries.push({
      tabId: tab.id,
      index: tab.index,
      previousGroupId: groupId,
      groupTitle: groupInfo?.title,
      groupColor: groupInfo?.color as ChromeTabGroupColor | undefined,
      groupCollapsed: groupInfo?.collapsed,
    });
  }

  return {
    timestamp: Date.now(),
    windowId,
    entries,
  };
}

export interface ApplyGroupingPlanOptions {
  collapseInactiveGroups?: boolean;
  /** Micro-delay (ms) between staggered tab moves for smooth visual choreography */
  staggerMs?: number;
  onProgress?: (progress: SortChoreographyProgress) => void;
}

/**
 * Applies a `GroupingPlan` strictly to the current active Chrome window (`currentWindow: true`) with:
 * 1. Non-destructive merging into existing `chrome.tabGroups` (`groupId: group.existingGroupId`)
 *    OR Clean Slate mode when `existingGroupId` is absent.
 * 2. Choreographed, staggered `chrome.tabs.move` + `chrome.tabs.group` sequencing so tabs
 *    smoothly glide into place in a wave.
 * 3. Automatic collapsing of all groups except the active/last group (`collapseInactiveGroups: true` by default).
 */
export async function applyGroupingPlan(
  plan: GroupingPlan,
  options: ApplyGroupingPlanOptions = {}
): Promise<void> {
  const collapseInactive = options.collapseInactiveGroups ?? true;
  const staggerMs = options.staggerMs ?? 32;
  const completedGroupIds: string[] = [];
  const totalGroups = plan.groups.length;

  const emitProgress = (
    partial: Partial<SortChoreographyProgress> & {
      phase: SortChoreographyProgress['phase'];
    }
  ) => {
    if (!options.onProgress) return;
    options.onProgress({
      activeGroupId: partial.activeGroupId ?? null,
      activeTabId: partial.activeTabId ?? null,
      completedGroupIds: [...completedGroupIds],
      completedGroups: completedGroupIds.length,
      totalGroups,
      progressRatio:
        totalGroups === 0
          ? 1
          : Math.min(1, completedGroupIds.length / totalGroups),
      phase: partial.phase,
    });
  };

  if (!isChromeTabsAvailable()) {
    const hasPreservedGroups = plan.groups.some(
      (g) => typeof g.existingGroupId === 'number'
    );
    if (!hasPreservedGroups) {
      demoGroupMeta.clear();
    }

    for (let idx = 0; idx < plan.groups.length; idx++) {
      const group = plan.groups[idx];
      const movingTabs =
        typeof group.existingGroupId === 'number'
          ? group.addedTabIds ?? []
          : group.tabIds;

      for (const tabId of movingTabs) {
        emitProgress({
          phase:
            typeof group.existingGroupId === 'number' ? 'merging' : 'gliding',
          activeGroupId: group.id,
          activeTabId: tabId,
        });
        await sleep(staggerMs);
      }

      emitProgress({
        phase: 'grouping',
        activeGroupId: group.id,
        activeTabId: null,
      });

      const targetGroupId = group.existingGroupId ?? idx + 10;
      group.existingGroupId = targetGroupId;
      const isLastGroup = idx === plan.groups.length - 1;
      demoGroupMeta.set(targetGroupId, {
        title: `${group.emoji} ${group.groupName}`.trim(),
        color: group.color,
        collapsed: Boolean(collapseInactive && !isLastGroup),
      });
      demoTabState = demoTabState.map((t) =>
        group.tabIds.includes(t.id) ? { ...t, groupId: targetGroupId } : t
      );

      completedGroupIds.push(group.id);
      await sleep(Math.round(staggerMs * 1.2));
    }

    emitProgress({ phase: 'complete', activeGroupId: null, activeTabId: null });
    return;
  }

  const initialTabs = await chrome.tabs.query({ currentWindow: true });
  const windowId =
    initialTabs[0]?.windowId ?? (await chrome.windows.getCurrent()).id;

  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  const activeTabId = activeTab?.id;

  // Strictly restrict operations to tabs currently inside this active window
  const liveTabIds = new Set(
    initialTabs.map((t) => t.id).filter((id): id is number => typeof id === 'number')
  );

  // If running in Clean Slate Mode (no preserved existingGroupId in plan),
  // ungroup existing grouped tabs in this window first so they smoothly reorganize.
  const hasAnyPreservedGroup = plan.groups.some(
    (g) => typeof g.existingGroupId === 'number'
  );
  if (!hasAnyPreservedGroup) {
    const previouslyGroupedIds = initialTabs
      .filter(
        (t): t is chrome.tabs.Tab & { id: number } =>
          typeof t.id === 'number' &&
          typeof t.groupId === 'number' &&
          t.groupId > 0
      )
      .map((t) => t.id);

    if (previouslyGroupedIds.length > 0) {
      try {
        await chrome.tabs.ungroup(previouslyGroupedIds);
      } catch {
        // Ignore if tabs cannot be ungrouped
      }
    }
  }

  // Determine which single group stays expanded when Auto-Collapse is enabled:
  // Either the group containing the active tab, or the very last group in `plan.groups`.
  const groupIdxWithActiveTab = plan.groups.findIndex(
    (g) => typeof activeTabId === 'number' && g.tabIds.includes(activeTabId)
  );
  const expandedGroupIdx =
    groupIdxWithActiveTab >= 0 ? groupIdxWithActiveTab : plan.groups.length - 1;

  for (let groupIdx = 0; groupIdx < plan.groups.length; groupIdx++) {
    const group = plan.groups[groupIdx];
    const validTabIds = group.tabIds.filter((id) => liveTabIds.has(id));
    if (validTabIds.length === 0) {
      completedGroupIds.push(group.id);
      continue;
    }

    const formattedTitle = `${group.emoji} ${group.groupName}`.trim();
    const shouldStayExpanded = !collapseInactive || groupIdx === expandedGroupIdx;

    // CASE 1: Non-Destructive Merge into an Existing Chrome Tab Group in this window
    if (typeof group.existingGroupId === 'number') {
      const addedTabIds = (group.addedTabIds ?? []).filter((id) =>
        liveTabIds.has(id)
      );

      if (addedTabIds.length > 0) {
        const currentWindowTabs = await chrome.tabs.query({
          currentWindow: true,
        });
        const existingMemberIndices = currentWindowTabs
          .filter((t) => t.groupId === group.existingGroupId)
          .map((t) => t.index);

        let anchorIndex =
          existingMemberIndices.length > 0
            ? Math.max(...existingMemberIndices)
            : -1;

        for (const tabId of addedTabIds) {
          emitProgress({
            phase: 'merging',
            activeGroupId: group.id,
            activeTabId: tabId,
          });
          if (anchorIndex >= 0) {
            try {
              await chrome.tabs.move(tabId, { index: anchorIndex + 1 });
              anchorIndex++;
            } catch {
              // Ignore if tab cannot be moved
            }
          }
          await sleep(staggerMs);
        }

        emitProgress({
          phase: 'grouping',
          activeGroupId: group.id,
          activeTabId: null,
        });

        await chrome.tabs.group({
          groupId: group.existingGroupId,
          tabIds: addedTabIds,
        });
      }

      try {
        await chrome.tabGroups.update(group.existingGroupId, {
          title: formattedTitle,
          color: group.color,
          collapsed: !shouldStayExpanded,
        });
      } catch {
        // Ignore if group was closed externally
      }

      completedGroupIds.push(group.id);
      if (addedTabIds.length > 0) {
        await sleep(Math.round(staggerMs * 1.2));
      }
      continue;
    }

    // CASE 2: Choreographed Staggered Creation of a Brand-New Group in this window
    const snapshotBeforeMove = await chrome.tabs.query({ currentWindow: true });
    const firstMemberTab = snapshotBeforeMove.find((t) =>
      validTabIds.includes(t.id ?? -1)
    );
    let targetSlotIndex = firstMemberTab ? firstMemberTab.index : -1;

    for (const tabId of validTabIds) {
      emitProgress({
        phase: 'gliding',
        activeGroupId: group.id,
        activeTabId: tabId,
      });

      if (targetSlotIndex >= 0) {
        try {
          await chrome.tabs.move(tabId, { index: targetSlotIndex });
          targetSlotIndex++;
        } catch {
          // Ignore if tab cannot be moved
        }
      }
      await sleep(staggerMs);
    }

    emitProgress({
      phase: 'grouping',
      activeGroupId: group.id,
      activeTabId: null,
    });

    const newGroupId = await chrome.tabs.group({
      tabIds: validTabIds,
      createProperties:
        typeof windowId === 'number' && windowId >= 0
          ? { windowId }
          : undefined,
    });

    group.existingGroupId = newGroupId;

    await chrome.tabGroups.update(newGroupId, {
      title: formattedTitle,
      color: group.color,
      collapsed: !shouldStayExpanded,
    });

    completedGroupIds.push(group.id);
    await sleep(Math.round(staggerMs * 1.25));
  }

  emitProgress({ phase: 'complete', activeGroupId: null, activeTabId: null });
}

/**
 * Updates a live Chrome Tab Group's title or color in the active window when the user
 * edits a group inline in the popup.
 */
export async function updateLiveChromeTabGroup(
  chromeGroupId: number,
  updates: { title?: string; color?: ChromeTabGroupColor }
): Promise<void> {
  if (!isChromeTabsAvailable()) {
    const existing = demoGroupMeta.get(chromeGroupId);
    if (existing) {
      demoGroupMeta.set(chromeGroupId, {
        ...existing,
        ...(updates.title !== undefined ? { title: updates.title } : {}),
        ...(updates.color !== undefined ? { color: updates.color } : {}),
      });
    }
    return;
  }

  try {
    await chrome.tabGroups.update(chromeGroupId, updates);
  } catch {
    // Ignore if the group does not exist in Chrome yet
  }
}

/**
 * Ungroups a specific set of tab IDs in the current window if they are currently grouped.
 */
export async function ungroupSpecificTabs(tabIds: number[]): Promise<void> {
  if (tabIds.length === 0) return;

  if (!isChromeTabsAvailable()) {
    const targetSet = new Set(tabIds);
    demoTabState = demoTabState.map((t) =>
      targetSet.has(t.id) ? { ...t, groupId: -1 } : t
    );
    return;
  }

  try {
    await chrome.tabs.ungroup(tabIds);
  } catch {
    // Ignore if tabs are already ungrouped
  }
}

/**
 * Ungroups all currently grouped tabs strictly in the active window (`currentWindow: true`).
 */
export async function ungroupAllTabsInWindow(): Promise<number> {
  if (!isChromeTabsAvailable()) {
    const count = demoTabState.filter((t) => (t.groupId ?? -1) > 0).length;
    demoTabState = demoTabState.map((t) => ({ ...t, groupId: -1 }));
    demoGroupMeta.clear();
    return count;
  }

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const groupedTabIds = tabs
    .filter(
      (t): t is chrome.tabs.Tab & { id: number } =>
        typeof t.id === 'number' &&
        typeof t.groupId === 'number' &&
        t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE &&
        t.groupId > -1
    )
    .map((t) => t.id);

  if (groupedTabIds.length > 0) {
    await chrome.tabs.ungroup(groupedTabIds);
  }

  return groupedTabIds.length;
}

/**
 * Restores a previously captured `UndoSnapshot` strictly within the active window.
 */
export async function restoreUndoSnapshot(snapshot: UndoSnapshot): Promise<void> {
  if (!isChromeTabsAvailable()) {
    demoTabState = [...DEMO_TABS];
    demoGroupMeta = new Map([
      [1, { title: '🐙 GitHub: prism-org/prism', color: 'purple', collapsed: false }],
    ]);
    return;
  }

  const liveTabs = await chrome.tabs.query({ currentWindow: true });
  const windowId = liveTabs[0]?.windowId;
  const liveTabIds = new Set(
    liveTabs.map((t) => t.id).filter((id): id is number => typeof id === 'number')
  );

  const validEntries = snapshot.entries.filter((e) => liveTabIds.has(e.tabId));
  if (validEntries.length === 0) return;

  const allTabIds = validEntries.map((e) => e.tabId);
  await chrome.tabs.ungroup(allTabIds);

  const sortedByIndex = [...validEntries].sort((a, b) => a.index - b.index);
  for (let i = 0; i < sortedByIndex.length; i++) {
    try {
      await chrome.tabs.move(sortedByIndex[i].tabId, { index: i });
    } catch {
      // Ignore if tab cannot be moved
    }
  }

  const previousGroups = new Map<
    number,
    {
      tabIds: number[];
      title?: string;
      color?: ChromeTabGroupColor;
      collapsed?: boolean;
    }
  >();

  for (const entry of sortedByIndex) {
    if (entry.previousGroupId > 0) {
      const existing = previousGroups.get(entry.previousGroupId);
      if (existing) {
        existing.tabIds.push(entry.tabId);
      } else {
        previousGroups.set(entry.previousGroupId, {
          tabIds: [entry.tabId],
          title: entry.groupTitle,
          color: entry.groupColor,
          collapsed: entry.groupCollapsed,
        });
      }
    }
  }

  for (const prevGroup of previousGroups.values()) {
    if (prevGroup.tabIds.length === 0) continue;
    const newGroupId = await chrome.tabs.group({
      tabIds: prevGroup.tabIds,
      createProperties:
        typeof windowId === 'number' && windowId >= 0
          ? { windowId }
          : undefined,
    });
    await chrome.tabGroups.update(newGroupId, {
      title: prevGroup.title ?? '',
      color: prevGroup.color ?? 'grey',
      collapsed: Boolean(prevGroup.collapsed),
    });
  }
}
