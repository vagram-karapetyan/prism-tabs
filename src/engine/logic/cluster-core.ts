import type { MaxTabsPerGroup, ProposedGroup, TabMetadata } from '../../domain/types';
import { deterministicColorForKey } from '../shared/color-allocator';
import { extractDomainInfo, hasCyrillicText, type ExtractedDomainInfo } from '../shared/url-classifier';
import {
  analyzeTitleSemantics,
  computeJaccardSimilarity,
  extractTicketIdentifiers,
  isBannedStandaloneTitleWord,
  synthesizeHumanGroupTitle,
  tokenizeTitle,
  truncateCleanTitle,
  type AnalyzedTitleSemantics,
} from './nlp-scorer';
import {
  classifyTabConcept,
  getConceptDisplayMeta,
  getShortConceptLabel,
  isRussianFocusedTab,
  type ConceptId,
} from './topic-taxonomy';

export interface AnalyzedTabNode {
  tab: TabMetadata;
  domainInfo: ExtractedDomainInfo;
  semantics: AnalyzedTitleSemantics;
  highSalienceSet: ReadonlySet<string>;
  bigramKeys: ReadonlySet<string>;
  conceptId: ConceptId | null;
}

export interface UnifiedClusterOptions {
  jaccardThreshold?: number;
  allowConceptConflictIfStrongEntity?: boolean;
  maxTabsPerGroup?: MaxTabsPerGroup;
  /** Exclude tokens that appear in 100% of candidate nodes (useful when sub-splitting one group). */
  excludeUbiquitousTokens?: boolean;
  /** Minimum fraction of cluster members matching the synthesized title stem to accept an entity cluster. */
  minTitleCoverage?: number;
  /** Fold a single remaining orphan sharing the entity's dominant concept if maxTabsPerGroup permits. */
  foldSameConceptSingleOrphan?: boolean;
  /** Enable Stage B semantic concept bucketing on unassigned nodes. */
  enableConceptBuckets?: boolean;
  /** Skip creating a Stage B bucket if it spans 100% of remaining/all candidate nodes. */
  skipWholePoolConceptBucket?: boolean;
  /** Specific concept ID that should not be split out as a Stage B sub-bucket (parent's own concept). */
  suppressConceptId?: ConceptId | null;
  /** Strictly-gated single high-salience anchor fallback when graph/concept steps leave clear entity groups. */
  enableHighSalienceSingleAnchorPass?: boolean;
  windowPriors?: ReadonlyMap<ConceptId, number>;
}

export interface PooledCluster {
  kind: 'entity' | 'concept';
  tabs: TabMetadata[];
  title: string;
  emoji: string;
  primaryConcept: ConceptId | null;
  preferRussian: boolean;
  expandedWithConcept?: boolean;
}

export interface UnifiedClusterResult {
  clusters: PooledCluster[];
  leftoverNodes: AnalyzedTabNode[];
}

export function isYouTubeGroup(group: Pick<ProposedGroup, 'id' | 'groupName'>): boolean {
  return (
    group.id.startsWith('logic-yt-') ||
    group.id.includes('media-youtube') ||
    /^(YouTube|YT)(\s*·|$)/i.test(group.groupName.trim())
  );
}

/**
 * Ensures any YouTube sub-group stays visually tagged as YouTube (`YouTube · ...` or `YT · ...`)
 * while respecting the 22-character tab strip cap.
 */
export function ensureYouTubePrefix(rawTitle: string, maxLength = 22): string {
  const clean = rawTitle.trim().replace(/\s+/g, ' ');
  if (!clean || /^youtube$/i.test(clean)) {
    return 'YouTube';
  }
  if (/^YT\s*·\s*/i.test(clean)) {
    const rest = clean.replace(/^YT\s*·\s*/i, '').trim();
    return rest ? truncateCleanTitle(`YT · ${rest}`, maxLength) : 'YouTube';
  }
  if (/^YouTube\s*·\s*/i.test(clean)) {
    if (clean.length <= maxLength) {
      return truncateCleanTitle(clean, maxLength);
    }
    const rest = clean.replace(/^YouTube\s*·\s*/i, '').trim();
    return rest ? truncateCleanTitle(`YT · ${rest}`, maxLength) : 'YouTube';
  }
  return truncateCleanTitle(`YT · ${clean}`, maxLength);
}

export function analyzeTabsForClustering(
  tabs: readonly TabMetadata[],
  options?: {
    ignoreHostPrior?: boolean;
    windowPriors?: ReadonlyMap<ConceptId, number>;
  },
): AnalyzedTabNode[] {
  return tabs.map((tab) => {
    const domainInfo = extractDomainInfo(tab.url);
    const classified = classifyTabConcept(tab, domainInfo, {
      ignoreHostPrior: options?.ignoreHostPrior,
      windowPriors: options?.windowPriors,
    });
    const semantics = analyzeTitleSemantics(tab.title);
    return {
      tab,
      domainInfo,
      semantics,
      highSalienceSet: new Set(semantics.highSalienceStems),
      bigramKeys: new Set(semantics.bigrams.map((b) => b.key)),
      conceptId: classified?.conceptId ?? null,
    };
  });
}

export function computeTitleCoverage(tabs: readonly TabMetadata[], title: string): number {
  if (tabs.length === 0) return 0;
  const stripped = title.replace(/^(YouTube|YT)\s*·\s*/i, '').trim();
  const synthTokens = tokenizeTitle(stripped).filter((t) => !isBannedStandaloneTitleWord(t));
  if (synthTokens.length === 0) return 0;

  let minCoverage = 1;
  let sumCoverage = 0;
  for (const tok of synthTokens) {
    let matches = 0;
    for (const tab of tabs) {
      if (analyzeTitleSemantics(tab.title).stems.includes(tok)) {
        matches++;
      }
    }
    const cov = matches / tabs.length;
    if (cov < minCoverage) minCoverage = cov;
    sumCoverage += cov;
  }
  return minCoverage < 0.5 ? minCoverage : sumCoverage / synthTokens.length;
}

export function isTautologicalConceptEntity(
  entityTitle: string,
  conceptId: ConceptId,
): boolean {
  const clean = entityTitle.replace(/^(YouTube|YT)\s*·\s*/i, '').trim().toLowerCase();
  if (!clean) return true;
  const ruMeta = getConceptDisplayMeta(conceptId, true).label.toLowerCase();
  const enMeta = getConceptDisplayMeta(conceptId, false).label.toLowerCase();
  const ruShort = getShortConceptLabel(conceptId, true).toLowerCase();
  const enShort = getShortConceptLabel(conceptId, false).toLowerCase();
  if (
    ruMeta.includes(clean) ||
    enMeta.includes(clean) ||
    clean === ruShort ||
    clean === enShort
  ) {
    return true;
  }

  const metaWords = new Set(
    `${ruMeta} ${enMeta} ${ruShort} ${enShort}`
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 2),
  );
  const titleWords = clean.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return (
    titleWords.length > 0 &&
    titleWords.every((w) => metaWords.has(w) || isBannedStandaloneTitleWord(w))
  );
}

export function computeDominantConcept(nodes: readonly AnalyzedTabNode[]): ConceptId | null {
  const counts = new Map<ConceptId, number>();
  for (const node of nodes) {
    if (node.conceptId) {
      counts.set(node.conceptId, (counts.get(node.conceptId) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (!top) return null;
  if (ranked[1] && top[1] === ranked[1][1]) return null;
  return top[1] / Math.max(1, nodes.length) >= 0.5 ? top[0] : null;
}

/**
 * Shared Semantic-Entity Dual-Signal Graph + Concept Clustering kernel.
 * Used identically across Logic Mode NLP clustering, YouTube media clustering, and post-split subtopic extraction.
 */
export function clusterTabPool(
  nodes: readonly AnalyzedTabNode[],
  options: UnifiedClusterOptions = {},
): UnifiedClusterResult {
  const n = nodes.length;
  if (n < 2) {
    return { clusters: [], leftoverNodes: [...nodes] };
  }

  const jaccardThreshold = options.jaccardThreshold ?? 0.42;
  const allowConceptConflictIfStrongEntity = options.allowConceptConflictIfStrongEntity ?? true;
  const minTitleCoverage = options.minTitleCoverage ?? 0.5;
  const enableConceptBuckets = options.enableConceptBuckets ?? true;
  const maxTabsPerGroup = options.maxTabsPerGroup ?? null;

  // Compute document frequency of high-salience stems
  const docFreq = new Map<string, number>();
  for (const node of nodes) {
    for (const tok of node.semantics.highSalienceStems) {
      docFreq.set(tok, (docFreq.get(tok) ?? 0) + 1);
    }
  }

  const candidateTokens = new Set<string>();
  const ubiquitousStems = new Set<string>();
  for (const [tok, freq] of docFreq.entries()) {
    if (options.excludeUbiquitousTokens && freq >= n) {
      ubiquitousStems.add(tok);
      continue;
    }
    if (freq >= 2) {
      candidateTokens.add(tok);
    }
  }

  const candidateStrongByIdx: string[][] = nodes.map((node) =>
    options.excludeUbiquitousTokens
      ? node.semantics.highSalienceStems.filter((t) => candidateTokens.has(t))
      : [...node.semantics.highSalienceStems],
  );
  const candidateStrongSets: Set<string>[] = candidateStrongByIdx.map((toks) => new Set(toks));

  const assigned = new Array<boolean>(n).fill(false);
  const rawEntityClusters: Array<{
    indices: number[];
    primaryConcept: ConceptId | null;
    title: string;
    emoji: string;
    preferRussian: boolean;
    expandedWithConcept: boolean;
  }> = [];

  // Stage A: Strict Non-Transitive Dual-Signal Graph & Degree-Seed Star Formation
  const hasAnyStrongNode = candidateStrongByIdx.some((arr) => arr.length > 0);
  if (hasAnyStrongNode) {
    const neighbors: number[][] = Array.from({ length: n }, () => []);
    const pairLimit = Math.min(n, 250);

    for (let i = 0; i < pairLimit; i++) {
      const nodeA = nodes[i];
      const strongA = candidateStrongSets[i];
      if (!nodeA || !strongA || strongA.size === 0) continue;

      for (let j = i + 1; j < pairLimit; j++) {
        const nodeB = nodes[j];
        const strongB = candidateStrongByIdx[j];
        if (!nodeB || !strongB || strongB.length === 0) continue;

        let sharedBigram = false;
        for (const bg of nodeA.bigramKeys) {
          if (!nodeB.bigramKeys.has(bg)) continue;
          if (
            ubiquitousStems.size > 0 &&
            bg.split(' ').every((part) => ubiquitousStems.has(part))
          ) {
            continue;
          }
          sharedBigram = true;
          break;
        }

        let sharedStrongCount = 0;
        for (const tok of strongB) {
          if (strongA.has(tok)) sharedStrongCount++;
        }

        // Guard against cross-concept single-word collisions, while letting >= 2 shared strong entities / shared bigram connect cleanly
        const hasConceptConflict =
          nodeA.conceptId !== null &&
          nodeB.conceptId !== null &&
          nodeA.conceptId !== nodeB.conceptId;
        const isStrongMultiEntity = sharedBigram || sharedStrongCount >= 2;
        if (hasConceptConflict && (!allowConceptConflictIfStrongEntity || !isStrongMultiEntity)) {
          continue;
        }

        const jaccard = computeJaccardSimilarity(
          nodeA.semantics.stems,
          nodeB.semantics.stems,
        );
        const isMatch =
          sharedBigram ||
          sharedStrongCount >= 2 ||
          (sharedStrongCount >= 1 && jaccard >= jaccardThreshold);

        if (isMatch) {
          neighbors[i]?.push(j);
          neighbors[j]?.push(i);
        }
      }
    }

    const starIndicesQueue: number[][] = [];
    for (let iter = 0; iter < n; iter++) {
      let bestSeed = -1;
      let bestDeg = 0;

      for (let i = 0; i < n; i++) {
        if (assigned[i]) continue;
        const deg = (neighbors[i] ?? []).reduce(
          (acc, nb) => (assigned[nb] ? acc : acc + 1),
          0,
        );
        if (deg > bestDeg) {
          bestDeg = deg;
          bestSeed = i;
        }
      }

      if (bestSeed === -1 || bestDeg === 0) break;

      const rawMembers = [
        bestSeed,
        ...(neighbors[bestSeed] ?? []).filter((nb) => !assigned[nb]),
      ];

      // Core-token verification so peripheral neighbors never dilute a coherent entity star
      const tokCounts = new Map<string, number>();
      for (const idx of rawMembers) {
        for (const tok of candidateStrongByIdx[idx] ?? []) {
          tokCounts.set(tok, (tokCounts.get(tok) ?? 0) + 1);
        }
      }
      const coreMin = Math.max(2, Math.ceil(rawMembers.length * 0.5));
      const coreSet = new Set(
        [...tokCounts.entries()].filter(([, cnt]) => cnt >= coreMin).map(([tok]) => tok),
      );

      const seedStrongSet = candidateStrongSets[bestSeed] ?? new Set<string>();
      const verified =
        coreSet.size > 0
          ? rawMembers.filter((idx) => {
              if (idx === bestSeed) return true;
              const toks = candidateStrongByIdx[idx] ?? [];
              if (toks.some((t) => coreSet.has(t))) return true;
              let overlapWithSeed = 0;
              for (const t of toks) {
                if (seedStrongSet.has(t)) overlapWithSeed++;
              }
              return overlapWithSeed >= 2;
            })
          : rawMembers;

      if (verified.length >= 2) {
        verified.sort((a, b) => a - b);
        for (const idx of verified) assigned[idx] = true;
        starIndicesQueue.push(verified);
      } else {
        assigned[bestSeed] = true;
      }
    }

    for (const indices of starIndicesQueue) {
      const coreNodes = indices
        .map((idx) => nodes[idx])
        .filter((node): node is AnalyzedTabNode => Boolean(node));
      const coreTabs = coreNodes.map((cn) => cn.tab);
      const primaryConcept = computeDominantConcept(coreNodes);

      const excludedStems = ubiquitousStems.size > 0 ? ubiquitousStems : undefined;
      const synth = synthesizeHumanGroupTitle(
        coreTabs,
        undefined,
        options.windowPriors,
        excludedStems,
      );
      const coverage =
        synth.groupName !== 'Focus Cluster' &&
        !isBannedStandaloneTitleWord(synth.groupName.toLowerCase())
          ? computeTitleCoverage(coreTabs, synth.groupName)
          : 0;

      if (coverage < minTitleCoverage) {
        // Release weak / incoherent entity cluster so concept buckets can classify cleanly
        for (const idx of indices) assigned[idx] = false;
        continue;
      }

      rawEntityClusters.push({
        indices,
        primaryConcept,
        title: synth.groupName,
        emoji: synth.emoji,
        preferRussian: false,
        expandedWithConcept: false,
      });
    }
  }

  const clusters: PooledCluster[] = [];
  if (rawEntityClusters.length > 0) {
    // Recompute optional single-orphan fold strictly for accepted clusters so rejected ones don't hold orphans
    const remConcept = new Map<ConceptId, number[]>();
    if (options.foldSameConceptSingleOrphan) {
      for (let i = 0; i < n; i++) {
        if (assigned[i]) continue;
        const cId = nodes[i]?.conceptId;
        if (cId) {
          const list = remConcept.get(cId) ?? [];
          list.push(i);
          remConcept.set(cId, list);
        }
      }
    }

    for (const raw of rawEntityClusters) {
      const coreTabs = raw.indices
        .map((idx) => nodes[idx]?.tab)
        .filter((t): t is TabMetadata => Boolean(t));
      const memberTabs = [...coreTabs];
      let expanded = false;

      if (options.foldSameConceptSingleOrphan && raw.primaryConcept) {
        const same = remConcept.get(raw.primaryConcept);
        if (
          same &&
          same.length === 1 &&
          (maxTabsPerGroup === null || memberTabs.length + 1 <= maxTabsPerGroup)
        ) {
          const oIdx = same[0];
          if (oIdx !== undefined && !assigned[oIdx]) {
            const orphanTab = nodes[oIdx]?.tab;
            if (orphanTab) {
              assigned[oIdx] = true;
              memberTabs.push(orphanTab);
              remConcept.delete(raw.primaryConcept);
              expanded = true;
            }
          }
        }
      }

      const ruCount = memberTabs.filter((t) => hasCyrillicText(t.title)).length;
      const preferRussian = ruCount > 0 && ruCount * 2 >= memberTabs.length;

      clusters.push({
        kind: 'entity',
        tabs: memberTabs,
        title: raw.title,
        emoji: raw.emoji,
        primaryConcept: raw.primaryConcept,
        preferRussian,
        expandedWithConcept: expanded,
      });
    }
  }

  // Stage B: Bilingual Semantic Concept Bucketing on remaining unassigned nodes
  if (enableConceptBuckets) {
    const byConcept = new Map<ConceptId, number[]>();
    for (let i = 0; i < n; i++) {
      if (assigned[i]) continue;
      const cId = nodes[i]?.conceptId;
      if (!cId) continue;
      if (options.suppressConceptId && cId === options.suppressConceptId) continue;
      const list = byConcept.get(cId) ?? [];
      list.push(i);
      byConcept.set(cId, list);
    }

    const sortedConcepts = [...byConcept.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [conceptId, indices] of sortedConcepts) {
      if (indices.length < 2) continue;
      if (options.skipWholePoolConceptBucket && indices.length >= n) continue;

      indices.sort((a, b) => a - b);
      for (const idx of indices) assigned[idx] = true;

      const compTabs = indices
        .map((idx) => nodes[idx]?.tab)
        .filter((t): t is TabMetadata => Boolean(t));
      const ruCount = compTabs.filter((t) => isRussianFocusedTab(t)).length;
      const preferRussian = ruCount > 0 && ruCount * 2 >= compTabs.length;
      const cMeta = getConceptDisplayMeta(conceptId, preferRussian);

      clusters.push({
        kind: 'concept',
        tabs: compTabs,
        title: cMeta.label,
        emoji: cMeta.emoji,
        primaryConcept: conceptId,
        preferRussian,
      });
    }
  }

  // Stage C (optional, strictly gated): High-salience single entity anchor pass
  if (options.enableHighSalienceSingleAnchorPass && candidateTokens.size > 0) {
    const blockedAnchors = new Set<string>();
    for (let iter = 0; iter < n; iter++) {
      const remainingMap = new Map<string, number[]>();
      for (let i = 0; i < n; i++) {
        if (assigned[i]) continue;
        for (const tok of candidateStrongByIdx[i] ?? []) {
          if (blockedAnchors.has(tok) || isBannedStandaloneTitleWord(tok)) continue;
          const list = remainingMap.get(tok);
          if (list) list.push(i);
          else remainingMap.set(tok, [i]);
        }
      }

      let bestAnchor: string | null = null;
      let bestIndices: number[] = [];
      for (const [tok, indices] of remainingMap.entries()) {
        if (indices.length < 2) continue;
        if (
          indices.length > bestIndices.length ||
          (indices.length === bestIndices.length &&
            bestAnchor !== null &&
            tok.length > bestAnchor.length)
        ) {
          bestAnchor = tok;
          bestIndices = indices;
        }
      }

      if (!bestAnchor || bestIndices.length < 2) break;

      bestIndices.sort((a, b) => a - b);
      const compNodes = bestIndices
        .map((idx) => nodes[idx])
        .filter((node): node is AnalyzedTabNode => Boolean(node));
      const compTabs = compNodes.map((cn) => cn.tab);

      const excludedStems = ubiquitousStems.size > 0 ? ubiquitousStems : undefined;
      const synth = synthesizeHumanGroupTitle(
        compTabs,
        undefined,
        options.windowPriors,
        excludedStems,
      );
      const cov =
        synth.groupName !== 'Focus Cluster' &&
        !isBannedStandaloneTitleWord(synth.groupName.toLowerCase())
          ? computeTitleCoverage(compTabs, synth.groupName)
          : 0;

      if (cov < Math.max(0.75, minTitleCoverage)) {
        blockedAnchors.add(bestAnchor);
        continue;
      }

      for (const idx of bestIndices) assigned[idx] = true;
      const ruCount = compTabs.filter((t) => hasCyrillicText(t.title)).length;
      const preferRussian = ruCount > 0 && ruCount * 2 >= compTabs.length;

      clusters.push({
        kind: 'entity',
        tabs: compTabs,
        title: synth.groupName,
        emoji: synth.emoji,
        primaryConcept: computeDominantConcept(compNodes),
        preferRussian,
      });
    }
  }

  const leftoverNodes: AnalyzedTabNode[] = [];
  for (let i = 0; i < n; i++) {
    if (!assigned[i]) {
      const node = nodes[i];
      if (node) leftoverNodes.push(node);
    }
  }

  return { clusters, leftoverNodes };
}

/**
 * Unifies ticket/PR matching, strict entity clustering, and bilingual semantic concept grouping
 * across leftover non-platform tabs.
 */
export function clusterTabsByTitleNlp(
  candidateTabs: readonly TabMetadata[],
  jaccardThreshold = 0.42,
  windowPriors?: ReadonlyMap<ConceptId, number>,
): {
  nlpGroups: ProposedGroup[];
  clusteredTabIds: Set<number>;
  conceptByGroupId: Map<string, ConceptId | null>;
} {
  const nlpGroups: ProposedGroup[] = [];
  const clusteredTabIds = new Set<number>();
  const conceptByGroupId = new Map<string, ConceptId | null>();

  if (candidateTabs.length < 2) {
    return { nlpGroups, clusteredTabIds, conceptByGroupId };
  }

  // Pass 1: Shared ticket / PR identifiers (JIRA-123, PR #412)
  const ticketBuckets = new Map<string, number[]>();
  for (const tab of candidateTabs) {
    for (const ticket of extractTicketIdentifiers(tab.title)) {
      const list = ticketBuckets.get(ticket) ?? [];
      list.push(tab.id);
      ticketBuckets.set(ticket, list);
    }
  }

  const tabById = new Map<number, TabMetadata>(candidateTabs.map((t) => [t.id, t]));
  const sortedTickets = [...ticketBuckets.entries()].sort((a, b) => b[1].length - a[1].length);

  for (const [ticketId, memberIds] of sortedTickets) {
    const availableIds = memberIds.filter((id) => !clusteredTabIds.has(id));
    if (availableIds.length >= 2) {
      for (const id of availableIds) clusteredTabIds.add(id);
      const id = `logic-nlp-ticket-${ticketId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const memberNodes = analyzeTabsForClustering(
        availableIds.map((tid) => tabById.get(tid)).filter((t): t is TabMetadata => Boolean(t)),
        { windowPriors },
      );
      conceptByGroupId.set(id, computeDominantConcept(memberNodes));
      nlpGroups.push({
        id,
        groupName: ticketId,
        emoji: '🏷️',
        color: deterministicColorForKey(ticketId),
        tabIds: availableIds,
        source: 'title-nlp',
        reasoning: `Shared ticket/PR identifier "${ticketId}"`,
      });
    }
  }

  // Pass 2 & 3: Shared unified graph + semantic concept pooling
  const remainingTabs = candidateTabs.filter((t) => !clusteredTabIds.has(t.id));
  if (remainingTabs.length < 2) {
    return { nlpGroups, clusteredTabIds, conceptByGroupId };
  }

  const nodes = analyzeTabsForClustering(remainingTabs, { windowPriors });
  const { clusters } = clusterTabPool(nodes, {
    jaccardThreshold,
    allowConceptConflictIfStrongEntity: true,
    enableConceptBuckets: true,
    minTitleCoverage: 0.5,
    foldSameConceptSingleOrphan: false,
    windowPriors,
  });

  for (const cluster of clusters) {
    if (cluster.tabs.length < 2) continue;
    const ids = cluster.tabs.map((t) => t.id);
    for (const id of ids) clusteredTabIds.add(id);

    if (cluster.kind === 'concept' && cluster.primaryConcept) {
      const id = `logic-nlp-concept-${cluster.primaryConcept}`;
      const meta = getConceptDisplayMeta(cluster.primaryConcept, cluster.preferRussian);
      conceptByGroupId.set(id, cluster.primaryConcept);
      nlpGroups.push({
        id,
        groupName: meta.label,
        emoji: meta.emoji,
        color: meta.color,
        tabIds: ids,
        source: 'title-nlp',
        reasoning: `Cross-domain semantic concept (${meta.label})`,
      });
    } else {
      const slug =
        cluster.title
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, '-')
          .replace(/^-|-$/g, '') || 'topic';
      const anchorId = ids[0] ?? 0;
      const id = `logic-nlp-topic-${slug}-${anchorId}`;
      conceptByGroupId.set(id, cluster.primaryConcept);
      nlpGroups.push({
        id,
        groupName: cluster.title,
        emoji: cluster.emoji,
        color: deterministicColorForKey(cluster.title),
        tabIds: ids,
        source: 'title-nlp',
        reasoning: `Entity & topic affinity (${cluster.title})`,
      });
    }
  }

  return { nlpGroups, clusteredTabIds, conceptByGroupId };
}
