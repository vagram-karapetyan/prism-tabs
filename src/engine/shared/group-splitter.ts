import type { MaxTabsPerGroup, ProposedGroup, TabMetadata } from '../../domain/types';
import {
  analyzeTabsForClustering,
  clusterTabPool,
  ensureYouTubePrefix,
  isTautologicalConceptEntity,
  isYouTubeGroup,
} from '../logic/cluster-core';
import {
  classifyTabConcept,
  computeWindowConceptPriors,
  formatYouTubeConceptLabel,
  getConceptDisplayMeta,
  getShortConceptLabel,
  type ConceptId,
} from '../logic/topic-taxonomy';
import { deterministicColorForKey } from './color-allocator';
import { extractDomainInfo, hasCyrillicText } from './url-classifier';

const MAX_GROUP_TITLE_LENGTH = 22;

const GENERIC_PARENT_NAMES = new Set([
  'media & audio',
  'youtube',
  'research & search',
  'misc',
  'other tabs',
  'разное',
  'youtube разное',
  'youtube misc',
  'youtube · другое',
  'youtube · other',
]);

function stripTrailingSeparators(raw: string): string {
  return raw.replace(/[\s·:|\\/\-–—]+$/u, '').trim();
}

function truncateAtWordBoundary(rawTitle: string, maxLength = MAX_GROUP_TITLE_LENGTH): string {
  const clean = stripTrailingSeparators(rawTitle.trim().replace(/\s+/g, ' '));
  if (clean.length <= maxLength) return clean;

  const words = clean.split(' ');
  const kept: string[] = [];
  for (const word of words) {
    const candidate = kept.length === 0 ? word : `${kept.join(' ')} ${word}`;
    if (candidate.length <= maxLength) {
      kept.push(word);
    } else {
      break;
    }
  }

  if (kept.length > 0) {
    const joined = stripTrailingSeparators(kept.join(' '));
    if (joined.length > 0) return joined;
  }
  return stripTrailingSeparators(clean.slice(0, maxLength)) || clean.slice(0, maxLength);
}

function formatPartTitle(baseTitle: string, partNum: number, totalParts: number): string {
  if (totalParts <= 1) {
    return truncateAtWordBoundary(baseTitle, MAX_GROUP_TITLE_LENGTH);
  }
  const suffix = ` (${partNum})`;
  const maxPrefixLen = Math.max(8, MAX_GROUP_TITLE_LENGTH - suffix.length);
  let normalizedBase = baseTitle.trim();
  if (normalizedBase.length > maxPrefixLen && /^YouTube\s*·\s*/i.test(normalizedBase)) {
    normalizedBase = normalizedBase.replace(/^YouTube\s*·\s*/i, 'YT · ');
  }
  const prefix = truncateAtWordBoundary(normalizedBase, maxPrefixLen);
  return `${prefix}${suffix}`;
}

function chunkBalanced<T>(items: readonly T[], maxPerChunk: number): T[][] {
  if (items.length <= maxPerChunk) return [[...items]];
  const numChunks = Math.ceil(items.length / maxPerChunk);
  const baseSize = Math.floor(items.length / numChunks);
  const remainder = items.length % numChunks;

  const chunks: T[][] = [];
  let cursor = 0;
  for (let i = 0; i < numChunks; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    chunks.push(items.slice(cursor, cursor + size));
    cursor += size;
  }
  return chunks;
}

function extractParentConceptId(group: ProposedGroup): ConceptId | null {
  const match = /^logic-(?:yt|nlp)-concept-([a-z]+)$/i.exec(group.id);
  return (match?.[1] as ConceptId | undefined) ?? null;
}

function buildNumberedSplitGroups(
  baseGroup: ProposedGroup,
  tabs: readonly TabMetadata[],
  maxTabsPerGroup: number,
  namePrefix?: string,
): ProposedGroup[] {
  const chunks = chunkBalanced(tabs, maxTabsPerGroup);
  const label = namePrefix ?? baseGroup.groupName;
  return chunks.map((chunk, idx) => ({
    id: `${baseGroup.id}-part-${idx + 1}`,
    groupName: formatPartTitle(label, idx + 1, chunks.length),
    emoji: baseGroup.emoji,
    color: deterministicColorForKey(`${baseGroup.groupName}:${idx}:${chunk[0]?.id ?? 0}`),
    tabIds: chunk.map((t) => t.id),
    source: 'split',
    reasoning: `Split oversized group "${baseGroup.groupName}" into compact chunk (${chunk.length} tabs)`,
  }));
}

function buildCompactOtherLabel(baseName: string, hasRu: boolean, isYtParent: boolean): string {
  const normalized = baseName.toLowerCase().trim();
  const suffix = hasRu ? 'Другое' : 'Other';
  if (normalized === 'youtube') {
    return `YouTube · ${suffix}`;
  }
  if (normalized === 'media & audio') {
    return hasRu ? `Медиа · ${suffix}` : `Media · ${suffix}`;
  }
  if (GENERIC_PARENT_NAMES.has(normalized)) {
    return isYtParent ? `YouTube · ${suffix}` : suffix;
  }
  if (isYtParent || /^(YouTube|YT)\s*·\s*/i.test(baseName)) {
    const subTopic = baseName.replace(/^(YouTube|YT)\s*·\s*/i, '').trim();
    if (!subTopic) {
      return `YouTube · ${suffix}`;
    }
    const compactFull = `YT · ${subTopic} · ${suffix}`;
    if (compactFull.length <= MAX_GROUP_TITLE_LENGTH) {
      return compactFull;
    }
    const shortSuffix = hasRu ? 'др.' : 'Misc';
    const compactShort = `YT · ${subTopic} · ${shortSuffix}`;
    if (compactShort.length <= MAX_GROUP_TITLE_LENGTH) {
      return compactShort;
    }
    const trimmedTopic = truncateAtWordBoundary(
      subTopic,
      MAX_GROUP_TITLE_LENGTH - (`YT ·  · ${shortSuffix}`).length,
    );
    return trimmedTopic ? `YT · ${trimmedTopic} · ${shortSuffix}` : `YouTube · ${suffix}`;
  }
  return truncateAtWordBoundary(`${baseName} · ${suffix}`, 18);
}

function formatPrefixedSubLabel(
  parentName: string,
  subLabel: string,
  maxLength = MAX_GROUP_TITLE_LENGTH,
): string {
  const full = `${parentName} · ${subLabel}`;
  if (full.length <= maxLength) return full;

  const cleanSub = truncateAtWordBoundary(subLabel, maxLength);
  const availParent = maxLength - (3 + cleanSub.length);
  if (availParent < 4) {
    return cleanSub;
  }

  const firstChunk = parentName.split(/\s+[·и&]\s+/iu)[0]?.trim() || parentName;
  const words = firstChunk.split(/\s+/).filter(Boolean);
  const keptWords: string[] = [];
  for (const w of words) {
    const candidate = keptWords.length === 0 ? w : `${keptWords.join(' ')} ${w}`;
    if (candidate.length <= availParent) {
      keptWords.push(w);
    } else {
      break;
    }
  }
  if (keptWords.length === 0) {
    return cleanSub;
  }
  return `${keptWords.join(' ')} · ${cleanSub}`;
}

function splitTabSlice(
  baseGroup: ProposedGroup,
  tabIdsSlice: readonly number[],
  maxTabsPerGroup: number,
  tabsById: ReadonlyMap<number, TabMetadata>,
  windowPriors?: ReadonlyMap<ConceptId, number>,
): ProposedGroup[] {
  const memberTabs: TabMetadata[] = tabIdsSlice.map(
    (id) =>
      tabsById.get(id) ?? {
        id,
        title: '',
        url: '',
      },
  );

  if (baseGroup.id === 'logic-yt-other' || baseGroup.id === 'logic-platform-media-youtube') {
    return buildNumberedSplitGroups(baseGroup, memberTabs, maxTabsPerGroup);
  }

  const isYtParent = isYouTubeGroup(baseGroup);
  const isGenericParent = GENERIC_PARENT_NAMES.has(baseGroup.groupName.toLowerCase().trim());
  const suppressConceptId = extractParentConceptId(baseGroup);

  const nodes = analyzeTabsForClustering(memberTabs, {
    ignoreHostPrior: isYtParent,
    windowPriors,
  });
  const { clusters: rawClusters, leftoverNodes } = clusterTabPool(nodes, {
    jaccardThreshold: 0.35,
    allowConceptConflictIfStrongEntity: true,
    excludeUbiquitousTokens: true,
    minTitleCoverage: 0.75,
    foldSameConceptSingleOrphan: false,
    enableConceptBuckets: true,
    skipWholePoolConceptBucket: true,
    suppressConceptId,
    enableHighSalienceSingleAnchorPass: !suppressConceptId && isGenericParent,
    windowPriors,
  });

  // For single-concept parents (e.g. YouTube · Кулинария or YouTube · ИИ), skip micro/tautological sub-splits
  // when balanced chunking produces cleaner, uniform parts.
  const minEntitySubSize = Math.min(3, Math.max(2, Math.floor(maxTabsPerGroup * 0.6)));
  const keptClusters = suppressConceptId
    ? rawClusters.filter((c) => {
        if (c.kind !== 'entity') return true;
        if (c.tabs.length < minEntitySubSize) return false;
        return !isTautologicalConceptEntity(c.title, suppressConceptId);
      })
    : rawClusters;

  const keptTabIds = new Set(keptClusters.flatMap((c) => c.tabs.map((t) => t.id)));
  const finalLeftoverTabs =
    keptClusters.length === rawClusters.length
      ? leftoverNodes.map((n) => n.tab)
      : memberTabs.filter((t) => !keptTabIds.has(t.id));

  const meaningfullySplit =
    keptClusters.length > 1 || (keptClusters.length === 1 && finalLeftoverTabs.length > 0);

  if (!meaningfullySplit) {
    return buildNumberedSplitGroups(baseGroup, memberTabs, maxTabsPerGroup);
  }

  const result: ProposedGroup[] = [];
  const resultConcepts: Array<ConceptId | null> = [];

  keptClusters.forEach((comp, compIdx) => {
    const compTabs = comp.tabs;
    const chunks = chunkBalanced(compTabs, maxTabsPerGroup);
    const labelBudget =
      chunks.length > 1 ? MAX_GROUP_TITLE_LENGTH - 4 : MAX_GROUP_TITLE_LENGTH;
    let subName: string;
    let subEmoji = baseGroup.emoji;

    if (comp.kind === 'concept' && comp.primaryConcept) {
      const cMeta = getConceptDisplayMeta(comp.primaryConcept, comp.preferRussian);
      if (isYtParent) {
        subName = formatYouTubeConceptLabel(comp.primaryConcept, comp.preferRussian);
        if (subName.length > labelBudget) {
          subName = ensureYouTubePrefix(getShortConceptLabel(comp.primaryConcept, comp.preferRussian), labelBudget);
        }
        if (isGenericParent) subEmoji = cMeta.emoji;
      } else if (isGenericParent) {
        subName = truncateAtWordBoundary(cMeta.label, labelBudget);
        subEmoji = cMeta.emoji;
      } else {
        subName = formatPrefixedSubLabel(baseGroup.groupName, cMeta.label, labelBudget);
      }
    } else if (isYtParent) {
      subName = ensureYouTubePrefix(comp.title, labelBudget);
      if (isGenericParent) subEmoji = comp.emoji;
    } else if (isGenericParent) {
      subName = truncateAtWordBoundary(comp.title, labelBudget);
      subEmoji = comp.emoji;
    } else {
      subName = formatPrefixedSubLabel(baseGroup.groupName, comp.title, labelBudget);
    }

    chunks.forEach((chunk, chunkIdx) => {
      result.push({
        id: `${baseGroup.id}-sub-${compIdx + 1}-${chunkIdx + 1}`,
        groupName: formatPartTitle(subName, chunkIdx + 1, chunks.length),
        emoji: subEmoji,
        color: deterministicColorForKey(`${subName}:${chunkIdx}`),
        tabIds: chunk.map((t) => t.id),
        source: 'split',
        reasoning: `Subtopic split from "${baseGroup.groupName}" (${chunk.length} tabs)`,
      });
      resultConcepts.push(comp.primaryConcept);
    });
  });

  // Avoid creating a tiny 1-tab "Other" sliver when splitting a homogeneous/same-concept parent
  const mutableLeftover = [...finalLeftoverTabs];
  if (mutableLeftover.length === 1 && result.length > 0) {
    const orphan = mutableLeftover[0];
    if (orphan) {
      const orphanConcept =
        classifyTabConcept(orphan, extractDomainInfo(orphan.url), {
          ignoreHostPrior: isYtParent,
          windowPriors,
        })?.conceptId ?? null;

      let targetGroupIdx = -1;
      if (orphanConcept) {
        targetGroupIdx = result.findIndex(
          (g, idx) => resultConcepts[idx] === orphanConcept && g.tabIds.length < maxTabsPerGroup,
        );
      }
      if (targetGroupIdx === -1 && !isGenericParent) {
        let minSize = maxTabsPerGroup;
        result.forEach((g, idx) => {
          if (g.tabIds.length < minSize) {
            minSize = g.tabIds.length;
            targetGroupIdx = idx;
          }
        });
      }

      if (targetGroupIdx !== -1) {
        result[targetGroupIdx]?.tabIds.push(orphan.id);
        mutableLeftover.length = 0;
      }
    }
  }

  if (mutableLeftover.length > 0) {
    const hasRu = mutableLeftover.some((t) => hasCyrillicText(t.title));
    const allMatchParentConcept =
      suppressConceptId !== null &&
      mutableLeftover.every((t) => {
        const c = classifyTabConcept(t, extractDomainInfo(t.url), {
          ignoreHostPrior: isYtParent,
          windowPriors,
        });
        return c?.conceptId === suppressConceptId;
      });

    const otherLabel = allMatchParentConcept
      ? baseGroup.groupName
      : buildCompactOtherLabel(baseGroup.groupName, hasRu, isYtParent);

    const leftoverChunks = chunkBalanced(mutableLeftover, maxTabsPerGroup);
    leftoverChunks.forEach((chunk, idx) => {
      result.push({
        id: `${baseGroup.id}-other-${idx + 1}`,
        groupName: formatPartTitle(otherLabel, idx + 1, leftoverChunks.length),
        emoji: baseGroup.emoji,
        color: deterministicColorForKey(`${otherLabel}:${idx}`),
        tabIds: chunk.map((t) => t.id),
        source: 'split',
        reasoning: `Remaining tabs split from "${baseGroup.groupName}"`,
      });
    });
  }

  return result;
}

/**
 * Shared post-splitter enforcing `maxTabsPerGroup` after both Logic and Meaning engines.
 * Never drops tabs; splits oversized groups by unified entity/concept subtopics first, then balanced chunks.
 */
export function splitOversizedGroups(
  groups: readonly ProposedGroup[],
  tabsById: ReadonlyMap<number, TabMetadata>,
  maxTabsPerGroup: MaxTabsPerGroup,
  windowPriors?: ReadonlyMap<ConceptId, number>,
): ProposedGroup[] {
  if (maxTabsPerGroup === null || maxTabsPerGroup < 2) {
    return groups.map((g) => ({ ...g, tabIds: [...g.tabIds] }));
  }

  const effectivePriors =
    windowPriors ??
    computeWindowConceptPriors(
      [...tabsById.values()].map((t) => ({ tab: t, domainInfo: extractDomainInfo(t.url) })),
    );
  const output: ProposedGroup[] = [];

  for (const group of groups) {
    if (group.tabIds.length <= maxTabsPerGroup) {
      output.push({ ...group, tabIds: [...group.tabIds] });
      continue;
    }

    if (group.existingGroupId !== undefined && group.existingTabIds !== undefined) {
      const preservedIds = group.existingTabIds.filter((id) => group.tabIds.includes(id));
      const preservedSet = new Set(preservedIds);
      const overflowAddedIds = group.tabIds.filter((id) => !preservedSet.has(id));

      const headroom = Math.max(0, maxTabsPerGroup - preservedIds.length);
      const keptAdded = overflowAddedIds.slice(0, headroom);
      const overflowSlice = overflowAddedIds.slice(headroom);

      output.push({
        ...group,
        tabIds: [...preservedIds, ...keptAdded],
        existingTabIds: preservedIds,
        addedTabIds: keptAdded,
      });

      if (overflowSlice.length > 0) {
        const overflowBase: ProposedGroup = {
          id: `${group.id}-overflow`,
          groupName: group.groupName,
          emoji: group.emoji,
          color: group.color,
          tabIds: overflowSlice,
          source: 'split',
          reasoning: group.reasoning,
        };
        output.push(
          ...splitTabSlice(
            overflowBase,
            overflowSlice,
            maxTabsPerGroup,
            tabsById,
            effectivePriors,
          ),
        );
      }
      continue;
    }

    output.push(
      ...splitTabSlice(group, group.tabIds, maxTabsPerGroup, tabsById, effectivePriors),
    );
  }

  return output;
}
