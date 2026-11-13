import {
  CHROME_TAB_GROUP_COLORS,
  type ChromeTabGroupColor,
  type ExistingTabGroup,
  type ProposedGroup,
  type TabMetadata,
} from '../../domain/types';
import { deterministicColorForKey } from '../shared/color-allocator';
import { parseExistingGroupTitle } from '../shared/emoji-parser';
import { hasCyrillicText } from '../shared/url-classifier';

const VALID_COLOR_SET = new Set<string>(CHROME_TAB_GROUP_COLORS);

export function extractJsonFromLlmOutput(rawResponse: unknown): unknown {
  if (typeof rawResponse !== 'string') {
    return rawResponse;
  }

  const trimmed = rawResponse
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('Could not parse structured JSON from AI provider response.');
  }
}

export function validateAndNormalizeSemanticResponse(
  rawResponse: unknown,
  eligibleTabs: readonly TabMetadata[],
  existingGroups: readonly ExistingTabGroup[] = [],
): ProposedGroup[] {
  const parsed = extractJsonFromLlmOutput(rawResponse);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Semantic response is not a valid JSON object.');
  }

  const record = parsed as Record<string, unknown>;
  const rawGroups = Array.isArray(record['groups'])
    ? record['groups']
    : Array.isArray(parsed)
      ? (parsed as unknown[])
      : null;

  if (!rawGroups || rawGroups.length === 0) {
    throw new Error('Semantic response contained no valid `groups` array.');
  }

  const validTabIds = new Set(eligibleTabs.map((t) => t.id));
  const assignedTabIds = new Set<number>();

  const existingById = new Map<number, ExistingTabGroup>();
  const existingByTitle = new Map<string, ExistingTabGroup>();
  const addedToExisting = new Map<number, number[]>();

  for (const eg of existingGroups) {
    const parsedTitle = parseExistingGroupTitle(eg.title || eg.cleanTitle);
    const cleanTitle = eg.cleanTitle || parsedTitle.cleanTitle || eg.title;
    const normalizedTitle = cleanTitle.toLowerCase().trim();
    const normalizedGroup: ExistingTabGroup = {
      ...eg,
      cleanTitle,
      emoji: eg.emoji ?? parsedTitle.emoji,
    };
    existingById.set(eg.id, normalizedGroup);
    if (normalizedTitle) {
      existingByTitle.set(normalizedTitle, normalizedGroup);
    }
    addedToExisting.set(eg.id, []);
  }

  const newNormalizedGroups: ProposedGroup[] = [];

  rawGroups.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const rawGroup = item as Record<string, unknown>;

    const rawName = typeof rawGroup['groupName'] === 'string' ? rawGroup['groupName'].trim() : '';
    const groupName = (rawName || `Group ${idx + 1}`).slice(0, 28);

    const rawEmoji =
      typeof rawGroup['emoji'] === 'string' && rawGroup['emoji'].trim().length > 0
        ? rawGroup['emoji'].trim().slice(0, 8)
        : '✨';

    const rawColor =
      typeof rawGroup['color'] === 'string' ? rawGroup['color'].toLowerCase().trim() : '';
    const color: ChromeTabGroupColor = VALID_COLOR_SET.has(rawColor)
      ? (rawColor as ChromeTabGroupColor)
      : deterministicColorForKey(groupName);

    const rawIds = Array.isArray(rawGroup['tabIds']) ? rawGroup['tabIds'] : [];
    const dedupedTabIds: number[] = [];

    for (const candidateId of rawIds) {
      const numericId = Number(candidateId);
      if (
        Number.isInteger(numericId) &&
        validTabIds.has(numericId) &&
        !assignedTabIds.has(numericId)
      ) {
        assignedTabIds.add(numericId);
        dedupedTabIds.push(numericId);
      }
    }

    if (dedupedTabIds.length === 0) return;

    const candidateExistingId =
      typeof rawGroup['existingGroupId'] === 'number' ? rawGroup['existingGroupId'] : undefined;
    const matchedExisting =
      (candidateExistingId !== undefined ? existingById.get(candidateExistingId) : undefined) ??
      existingByTitle.get(groupName.toLowerCase().trim());

    if (matchedExisting) {
      const list = addedToExisting.get(matchedExisting.id) ?? [];
      list.push(...dedupedTabIds);
      addedToExisting.set(matchedExisting.id, list);
      return;
    }

    newNormalizedGroups.push({
      id: `semantic-group-${idx}-${groupName.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-')}`,
      groupName,
      emoji: rawEmoji,
      color,
      tabIds: dedupedTabIds,
      source: 'semantic',
      reasoning:
        typeof rawGroup['reasoning'] === 'string' ? rawGroup['reasoning'].trim() : undefined,
    });
  });

  const preservedGroups: ProposedGroup[] = [];
  for (const eg of existingById.values()) {
    const addedTabIds = addedToExisting.get(eg.id) ?? [];
    const existingTabIds = [...eg.tabIds];
    const combinedTabIds = [...existingTabIds, ...addedTabIds];
    if (combinedTabIds.length === 0) continue;

    preservedGroups.push({
      id: `existing-group-${eg.id}`,
      groupName: eg.cleanTitle || eg.title || 'Group',
      emoji: eg.emoji || '📌',
      color: eg.color,
      tabIds: combinedTabIds,
      existingGroupId: eg.id,
      existingTabIds,
      addedTabIds,
      source: 'existing-merge',
      reasoning:
        addedTabIds.length > 0
          ? `Preserved "${eg.cleanTitle}" and semantically merged +${addedTabIds.length} tab(s)`
          : `Preserved existing group "${eg.cleanTitle}"`,
    });
  }

  if (preservedGroups.length === 0 && newNormalizedGroups.length === 0) {
    throw new Error('Semantic response produced zero groups with valid tab IDs.');
  }

  const omittedTabIds = eligibleTabs.map((t) => t.id).filter((id) => !assignedTabIds.has(id));

  if (omittedTabIds.length > 0) {
    const hasRussian = eligibleTabs.some((t) => hasCyrillicText(t.title));
    newNormalizedGroups.push({
      id: 'semantic-group-unassigned',
      groupName: hasRussian ? 'Разное' : 'Other Tabs',
      emoji: hasRussian ? '🌐' : '🗂️',
      color: 'grey',
      tabIds: omittedTabIds,
      source: 'fallback',
      reasoning: 'Rescued tabs omitted from AI response.',
    });
  }

  return [...preservedGroups, ...newNormalizedGroups];
}
