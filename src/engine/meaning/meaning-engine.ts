import {
  DEFAULT_DETERMINISTIC_OPTIONS,
  DEFAULT_DETERMINISTIC_RULES,
  DEFAULT_MAX_TABS_PER_GROUP,
} from '../../domain/defaults';
import type {
  AiProvider,
  DeterministicOptions,
  DeterministicRule,
  ExistingTabGroup,
  GroupingPlan,
  MaxTabsPerGroup,
  ProposedGroup,
  SanitizedTabPayload,
  TabMetadata,
} from '../../domain/types';
import type { ClockPort } from '../../ports/clock.port';
import type { LlmGatewayPort } from '../../ports/llm-gateway.port';
import { runLogicGrouping } from '../logic/logic-engine';
import { allocateHarmoniousColors } from '../shared/color-allocator';
import { splitOversizedGroups } from '../shared/group-splitter';
import {
  buildSemanticSystemPrompt,
  buildSemanticUserPayload,
  directiveRequestsFullRebuild,
} from './prompt-builder';
import { validateAndNormalizeSemanticResponse } from './response-validator';
import { sanitizeTabMetadata } from './sanitizer';

export const MEANING_REQUEST_TIMEOUT_MS = 18_000;

const defaultClock: ClockPort = {
  nowMs: () => Date.now(),
  nowIso: () => new Date().toISOString(),
  performanceNow: () => performance.now(),
};

export interface MeaningGroupingParams {
  tabs: readonly TabMetadata[];
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  customPromptDirective?: string;
  deterministicRules?: readonly DeterministicRule[];
  deterministicOptions?: DeterministicOptions;
  existingGroups?: readonly ExistingTabGroup[];
  maxTabsPerGroup?: MaxTabsPerGroup;
  gateway: LlmGatewayPort;
  clock?: ClockPort;
}

function formatProviderLabel(provider: AiProvider): string {
  if (provider === 'groq') return 'Groq';
  if (provider === 'custom') return 'Custom AI';
  return 'Gemini';
}

function buildFallbackPlan(
  params: MeaningGroupingParams,
  activeExistingGroups: readonly ExistingTabGroup[],
  reason: string,
  clock: ClockPort,
): GroupingPlan {
  const fallback = runLogicGrouping({
    tabs: params.tabs,
    rules: params.deterministicRules ?? DEFAULT_DETERMINISTIC_RULES,
    options: params.deterministicOptions ?? DEFAULT_DETERMINISTIC_OPTIONS,
    existingGroups: activeExistingGroups,
    maxTabsPerGroup:
      params.maxTabsPerGroup === undefined ? DEFAULT_MAX_TABS_PER_GROUP : params.maxTabsPerGroup,
    clock,
  });

  return {
    ...fallback,
    modeUsed: 'logic',
    fallbackTriggered: true,
    fallbackReason: reason,
    groups: fallback.groups.map((g) =>
      g.source === 'existing-merge' ? g : { ...g, source: 'fallback' },
    ),
  };
}

export async function runMeaningGrouping(params: MeaningGroupingParams): Promise<GroupingPlan> {
  const clock = params.clock ?? defaultClock;
  const startTime = clock.performanceNow();

  const deterministicOptions = params.deterministicOptions ?? DEFAULT_DETERMINISTIC_OPTIONS;
  const existingGroups = params.existingGroups ?? [];
  const maxTabsPerGroup =
    params.maxTabsPerGroup === undefined ? DEFAULT_MAX_TABS_PER_GROUP : params.maxTabsPerGroup;

  const preserveExisting =
    deterministicOptions.preserveExistingGroups &&
    existingGroups.length > 0 &&
    !directiveRequestsFullRebuild(params.customPromptDirective);

  let activeExistingGroups = preserveExisting ? [...existingGroups] : [];
  const providerLabel = formatProviderLabel(params.provider);

  if (!params.apiKey.trim()) {
    return buildFallbackPlan(
      params,
      activeExistingGroups,
      `API-ключ (${providerLabel}) не указан — использован Logic Mode. Укажите ключ в Настройки → AI & Prompts.`,
      clock,
    );
  }

  const tabsById = new Map<number, TabMetadata>();
  for (const t of params.tabs) {
    tabsById.set(t.id, t);
  }

  const collectEligible = (lockedGroups: readonly ExistingTabGroup[]) => {
    const lockedIds = new Set<number>();
    for (const eg of lockedGroups) {
      for (const id of eg.tabIds) {
        lockedIds.add(id);
      }
    }

    const eligible: TabMetadata[] = [];
    const payloads: SanitizedTabPayload[] = [];
    const ungrouped: number[] = [];

    for (const tab of params.tabs) {
      if (lockedIds.has(tab.id)) {
        continue;
      }
      if (deterministicOptions.ignorePinnedTabs && tab.pinned) {
        ungrouped.push(tab.id);
        continue;
      }
      const sanitized = sanitizeTabMetadata(tab);
      if (!sanitized) {
        ungrouped.push(tab.id);
        continue;
      }
      eligible.push(tab);
      payloads.push(sanitized);
    }

    return { eligible, payloads, ungrouped };
  };

  let {
    eligible: eligibleTabs,
    payloads: sanitizedPayloads,
    ungrouped: ungroupedTabIds,
  } = collectEligible(activeExistingGroups);

  // If 100% of groupable tabs are already inside existing groups, re-cluster all groupable tabs with AI
  if (eligibleTabs.length === 0 && activeExistingGroups.length > 0) {
    const fullPass = collectEligible([]);
    if (fullPass.eligible.length > 0) {
      activeExistingGroups = [];
      eligibleTabs = fullPass.eligible;
      sanitizedPayloads = fullPass.payloads;
      ungroupedTabIds = fullPass.ungrouped;
    }
  }

  if (eligibleTabs.length === 0) {
    const preservedOnly: ProposedGroup[] = activeExistingGroups.map((eg) => ({
      id: `existing-group-${eg.id}`,
      groupName: eg.cleanTitle || eg.title || 'Group',
      emoji: eg.emoji || '📌',
      color: eg.color,
      tabIds: [...eg.tabIds],
      existingGroupId: eg.id,
      existingTabIds: [...eg.tabIds],
      addedTabIds: [],
      source: 'existing-merge',
      reasoning: `Preserved existing group "${eg.cleanTitle || eg.title}"`,
    }));

    return {
      modeUsed: 'meaning',
      fallbackTriggered: false,
      groups: preservedOnly,
      ungroupedTabIds,
      latencyMs: Math.max(0.1, Number((clock.performanceNow() - startTime).toFixed(2))),
    };
  }

  try {
    const systemPrompt = buildSemanticSystemPrompt(
      params.customPromptDirective,
      activeExistingGroups,
      maxTabsPerGroup,
    );
    const userPrompt = buildSemanticUserPayload(
      sanitizedPayloads,
      params.customPromptDirective,
      activeExistingGroups,
      maxTabsPerGroup,
    );

    const response = await params.gateway.requestGrouping({
      provider: params.provider,
      apiKey: params.apiKey.trim(),
      model: params.model,
      baseUrl: params.baseUrl,
      systemPrompt,
      userPrompt,
      payloadLength: userPrompt.length,
      useGeminiSchema: params.provider === 'gemini',
      timeoutMs: MEANING_REQUEST_TIMEOUT_MS,
    });

    const normalizedGroups = validateAndNormalizeSemanticResponse(
      response.rawText,
      eligibleTabs,
      activeExistingGroups,
    );

    const sizeBoundedGroups = splitOversizedGroups(normalizedGroups, tabsById, maxTabsPerGroup);
    const harmonizedGroups = allocateHarmoniousColors(sizeBoundedGroups);

    return {
      modeUsed: 'meaning',
      fallbackTriggered: false,
      groups: harmonizedGroups,
      ungroupedTabIds,
      latencyMs: Math.max(1, Math.round(clock.performanceNow() - startTime)),
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : `Unknown ${providerLabel} API error`;
    return buildFallbackPlan(
      params,
      activeExistingGroups,
      `Meaning Mode unavailable (${reason}). Gracefully fell back to Logic Mode.`,
      clock,
    );
  }
}
