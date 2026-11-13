import type { MaxTabsPerGroup, ProposedGroup, TabMetadata } from '../../domain/types';
import { deterministicColorForKey } from '../shared/color-allocator';
import { hasCyrillicText } from '../shared/url-classifier';
import {
  analyzeTabsForClustering,
  clusterTabPool,
  computeTitleCoverage,
  ensureYouTubePrefix,
  isTautologicalConceptEntity,
  type AnalyzedTabNode,
} from './cluster-core';
import {
  extractTicketIdentifiers,
  isBannedStandaloneTitleWord,
  synthesizeHumanGroupTitle,
} from './nlp-scorer';
import {
  formatYouTubeConceptLabel,
  getConceptDisplayMeta,
  getShortConceptLabel,
  type ConceptId,
} from './topic-taxonomy';

export interface MediaClusterExternalContext {
  singletonConceptIds?: ReadonlySet<ConceptId>;
  ticketIds?: ReadonlySet<string>;
  windowPriors?: ReadonlyMap<ConceptId, number>;
}

export interface MediaClusterResult {
  groups: ProposedGroup[];
  singletonTabs: TabMetadata[];
  conceptByGroupId: Map<string, ConceptId | null>;
}

/**
 * Intelligently clusters YouTube video tabs via the unified semantic-entity kernel into cohesive
 * `YT · <Subtopic>` clusters and bilingual concept buckets (`YouTube · ИИ`, `YouTube · Игры`, etc.),
 * keeping unclassifiable orphans in at most one `YouTube · Другое` bucket (never 1-tab noise).
 */
export function clusterYouTubeTabs(
  youtubeTabs: readonly TabMetadata[],
  minTabsPerGroup: number,
  maxTabsPerGroup: MaxTabsPerGroup,
  externalContext?: MediaClusterExternalContext,
): MediaClusterResult {
  const conceptByGroupId = new Map<string, ConceptId | null>();
  if (youtubeTabs.length === 0) {
    return { groups: [], singletonTabs: [], conceptByGroupId };
  }

  const analyzed = analyzeTabsForClustering(youtubeTabs, {
    ignoreHostPrior: true,
    windowPriors: externalContext?.windowPriors,
  });

  // 1. Track raw per-concept sizes to avoid unnecessary micro-fragmentation
  const byConceptRaw = new Map<ConceptId, AnalyzedTabNode[]>();
  for (const item of analyzed) {
    if (item.conceptId) {
      const list = byConceptRaw.get(item.conceptId) ?? [];
      list.push(item);
      byConceptRaw.set(item.conceptId, list);
    }
  }

  // 2. Run unified dual-signal entity clustering (single-orphan reconciliation happens AFTER tautological releases)
  const { clusters: entityClusters, leftoverNodes } = clusterTabPool(analyzed, {
    jaccardThreshold: 0.42,
    allowConceptConflictIfStrongEntity: true,
    maxTabsPerGroup,
    minTitleCoverage: 0.5,
    foldSameConceptSingleOrphan: false,
    enableConceptBuckets: false,
    windowPriors: externalContext?.windowPriors,
  });

  // 3. Reconcile entity splits against cohesive concept buckets:
  //    - If a whole concept fits within maxTabsPerGroup, keep it unified unless it's already 100% covered.
  //    - If an oversized concept (> maxTabsPerGroup) creates extra micro-slivers, absorb tiny ones back.
  const releasedFromOverFragmented = new Set<number>();
  for (const [conceptId, conceptItems] of byConceptRaw.entries()) {
    if (conceptItems.length < minTabsPerGroup) continue;

    const matchingEntities = entityClusters.filter((ec) => ec.primaryConcept === conceptId);
    if (matchingEntities.length === 0) continue;

    const keptBeforePieceCheck = matchingEntities.filter((ec) => {
      if (isTautologicalConceptEntity(ec.title, conceptId)) {
        for (const t of ec.tabs) releasedFromOverFragmented.add(t.id);
        return false;
      }
      return true;
    });
    if (keptBeforePieceCheck.length === 0) continue;

    const keptIdsInConcept = new Set<number>();
    for (const ec of keptBeforePieceCheck) {
      for (const t of ec.tabs) keptIdsInConcept.add(t.id);
    }
    const conceptItemIds = new Set(conceptItems.map((item) => item.tab.id));
    let conceptLeftoverCount = conceptItems.filter((item) => !keptIdsInConcept.has(item.tab.id)).length;

    if (maxTabsPerGroup === null || conceptItems.length <= maxTabsPerGroup) {
      if (
        keptBeforePieceCheck.length > 1 ||
        (keptBeforePieceCheck.length === 1 && conceptLeftoverCount >= 1)
      ) {
        for (const ec of keptBeforePieceCheck) {
          for (const t of ec.tabs) {
            releasedFromOverFragmented.add(t.id);
          }
        }
      }
    } else {
      const expectedChunks = Math.ceil(conceptItems.length / maxTabsPerGroup);
      const countLeftoverChunks = (count: number): number =>
        count >= minTabsPerGroup ? Math.ceil(count / maxTabsPerGroup) : 0;
      let currentPieces = keptBeforePieceCheck.length + countLeftoverChunks(conceptLeftoverCount);

      if (currentPieces > expectedChunks) {
        const sortedSmallest = [...keptBeforePieceCheck].sort(
          (a, b) => a.tabs.length - b.tabs.length,
        );
        const microCap = Math.max(2, Math.floor(maxTabsPerGroup / 3));
        for (const ec of sortedSmallest) {
          if (currentPieces <= expectedChunks) break;
          if (ec.tabs.length <= microCap) {
            for (const t of ec.tabs) {
              releasedFromOverFragmented.add(t.id);
            }
            const prevChunks = countLeftoverChunks(conceptLeftoverCount);
            const releasedInConcept = ec.tabs.filter((t) => conceptItemIds.has(t.id)).length;
            conceptLeftoverCount += releasedInConcept;
            const nextChunks = countLeftoverChunks(conceptLeftoverCount);
            currentPieces = currentPieces - 1 + (nextChunks - prevChunks);
          }
        }
      }
    }
  }

  const keptEntityClusters = entityClusters.filter(
    (ec) => !ec.tabs.some((t) => releasedFromOverFragmented.has(t.id)),
  );
  const keptEntityTabIds = new Set(keptEntityClusters.flatMap((ec) => ec.tabs.map((t) => t.id)));

  const groups: ProposedGroup[] = [];
  for (const ec of keptEntityClusters) {
    if (ec.tabs.length < minTabsPerGroup) continue;

    let displayTitle = ensureYouTubePrefix(ec.title);
    if (ec.expandedWithConcept && ec.primaryConcept) {
      const shortLabel = getShortConceptLabel(ec.primaryConcept, ec.preferRussian);
      const expanded = ensureYouTubePrefix(`${ec.title} · ${shortLabel}`);
      if (expanded.length <= 22 && expanded.toLowerCase().includes(ec.title.toLowerCase().slice(0, 5))) {
        displayTitle = expanded;
      }
    }

    const id = `logic-yt-entity-${displayTitle.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-')}-${ec.tabs[0]?.id ?? 0}`;
    conceptByGroupId.set(id, ec.primaryConcept);

    groups.push({
      id,
      groupName: displayTitle,
      emoji: ec.emoji,
      color: deterministicColorForKey(displayTitle),
      tabIds: ec.tabs.map((t) => t.id),
      source: 'platform',
      reasoning: `YouTube topic cluster (${displayTitle})`,
    });
  }

  // 4. Semantic concept bucketing on remaining + released nodes
  const leftoverIds = new Set(leftoverNodes.map((n) => n.tab.id));
  const poolForConcepts: AnalyzedTabNode[] = [
    ...leftoverNodes,
    ...analyzed.filter((item) => !keptEntityTabIds.has(item.tab.id) && !leftoverIds.has(item.tab.id)),
  ];

  const conceptBuckets = new Map<ConceptId, AnalyzedTabNode[]>();
  const releasedToExternalPool: TabMetadata[] = [];
  const rawUncategorized: TabMetadata[] = [];

  for (const item of poolForConcepts) {
    if (item.conceptId) {
      const list = conceptBuckets.get(item.conceptId) ?? [];
      list.push(item);
      conceptBuckets.set(item.conceptId, list);
    } else {
      rawUncategorized.push(item.tab);
    }
  }

  const uncategorized: TabMetadata[] = [];
  for (const t of rawUncategorized) {
    const hasExternalTicket = extractTicketIdentifiers(t.title).some((tk) =>
      externalContext?.ticketIds?.has(tk),
    );
    if (hasExternalTicket) {
      releasedToExternalPool.push(t);
    } else {
      uncategorized.push(t);
    }
  }

  for (const [conceptId, bucket] of conceptBuckets.entries()) {
    if (bucket.length >= minTabsPerGroup) {
      const memberTabs = bucket.map((b) => b.tab);
      const ruCount = memberTabs.filter((t) => hasCyrillicText(t.title)).length;
      const preferRu = ruCount > 0 && ruCount * 2 >= memberTabs.length;
      const cMeta = getConceptDisplayMeta(conceptId, preferRu);

      // Override `YouTube · <Concept>` ONLY if >= 75% share one high-salience entity title (still keeping `YT ·` prefix)
      const synth = synthesizeHumanGroupTitle(
        memberTabs,
        undefined,
        externalContext?.windowPriors,
      );
      const useSynth =
        synth.groupName !== 'Focus Cluster' &&
        !isBannedStandaloneTitleWord(synth.groupName.toLowerCase()) &&
        !isTautologicalConceptEntity(synth.groupName, conceptId) &&
        computeTitleCoverage(memberTabs, synth.groupName) >= 0.68;

      const groupName = useSynth
        ? ensureYouTubePrefix(synth.groupName)
        : formatYouTubeConceptLabel(conceptId, preferRu);
      const id = `logic-yt-concept-${conceptId}`;
      conceptByGroupId.set(id, conceptId);

      groups.push({
        id,
        groupName,
        emoji: cMeta.emoji,
        color: cMeta.color,
        tabIds: memberTabs.map((t) => t.id),
        source: 'platform',
        reasoning: `YouTube semantic topic (${getShortConceptLabel(conceptId, preferRu)})`,
      });
    } else {
      // Fold a genuine post-reconciliation 1-tab concept orphan into an existing entity cluster of the same concept if room allows
      if (bucket.length === 1 && bucket[0]) {
        const orphanTab = bucket[0].tab;
        const targetEntityGroup = groups.find(
          (g) =>
            g.id.startsWith('logic-yt-entity-') &&
            conceptByGroupId.get(g.id) === conceptId &&
            (maxTabsPerGroup === null || g.tabIds.length + 1 <= maxTabsPerGroup),
        );
        if (targetEntityGroup) {
          targetEntityGroup.tabIds.push(orphanTab.id);
          const preferRu =
            hasCyrillicText(orphanTab.title) || hasCyrillicText(targetEntityGroup.groupName);
          const shortLabel = getShortConceptLabel(conceptId, preferRu);
          if (!targetEntityGroup.groupName.toLowerCase().includes(shortLabel.toLowerCase())) {
            const expanded = ensureYouTubePrefix(`${targetEntityGroup.groupName} · ${shortLabel}`);
            if (expanded.length <= 22) {
              targetEntityGroup.groupName = expanded;
            }
          }
          continue;
        }
      }

      for (const b of bucket) {
        const hasExternalConcept = Boolean(externalContext?.singletonConceptIds?.has(conceptId));
        const hasExternalTicket = extractTicketIdentifiers(b.tab.title).some((tk) =>
          externalContext?.ticketIds?.has(tk),
        );
        if (hasExternalConcept || hasExternalTicket) {
          releasedToExternalPool.push(b.tab);
        } else {
          uncategorized.push(b.tab);
        }
      }
    }
  }

  const singletonTabs: TabMetadata[] = [...releasedToExternalPool];

  if (uncategorized.length >= minTabsPerGroup) {
    const hasTopicSubgroups = groups.length > 0;
    const hasRu = uncategorized.some((t) => hasCyrillicText(t.title));
    const fallbackName = hasTopicSubgroups
      ? hasRu
        ? 'YouTube · Другое'
        : 'YouTube · Other'
      : 'YouTube';
    const id = hasTopicSubgroups ? 'logic-yt-other' : 'logic-platform-media-youtube';
    conceptByGroupId.set(id, null);

    groups.push({
      id,
      groupName: fallbackName,
      emoji: '🎬',
      color: 'red',
      tabIds: uncategorized.map((t) => t.id),
      source: 'platform',
      reasoning: hasTopicSubgroups ? 'Remaining miscellaneous YouTube tabs' : 'YouTube video tabs',
    });
  } else {
    singletonTabs.push(...uncategorized);
  }

  return { groups, singletonTabs, conceptByGroupId };
}
