import {
  DEFAULT_DETERMINISTIC_OPTIONS,
  DEFAULT_DETERMINISTIC_RULES,
  DEFAULT_MAX_TABS_PER_GROUP,
} from '../../domain/defaults';
import type {
  ChromeTabGroupColor,
  DeterministicOptions,
  DeterministicRule,
  ExistingTabGroup,
  GroupingPlan,
  MaxTabsPerGroup,
  ProposedGroup,
  TabMetadata,
} from '../../domain/types';
import type { ClockPort } from '../../ports/clock.port';
import { allocateHarmoniousColors } from '../shared/color-allocator';
import { splitOversizedGroups } from '../shared/group-splitter';
import {
  extractDomainInfo,
  hasCyrillicText,
  isYouTubeHomeTab,
  type ExtractedDomainInfo,
} from '../shared/url-classifier';
import {
  clusterTabsByTitleNlp,
  ensureYouTubePrefix,
  isYouTubeGroup,
} from './cluster-core';
import { clusterYouTubeTabs } from './media-clusterer';
import {
  computeContextualAffinityScore,
  extractTicketIdentifiers,
  synthesizeHumanGroupTitle,
  truncateCleanTitle,
} from './nlp-scorer';
import {
  extractPlatformCluster,
  formatDomainGroupMeta,
  isYouTubeMediaHost,
} from './platform-clusterer';
import { matchesRule } from './rules-matcher';
import {
  buildExistingGroupProfiles,
  findEffectiveOpenerGroup,
  findMatchingExistingGroupProfile,
} from './smart-merge';
import {
  classifyTabConcept,
  computeWindowConceptPriors,
  formatYouTubeConceptLabel,
  getConceptDisplayMeta,
  isRussianFocusedTab,
  MULTI_TOPIC_CONTENT_HOSTS,
  type ConceptId,
} from './topic-taxonomy';

interface PendingBucket {
  id: string;
  groupName: string;
  emoji: string;
  color: ChromeTabGroupColor;
  tabIds: number[];
  source: ProposedGroup['source'];
  reasoning: string;
  isExplicitRule: boolean;
  isKnownBrand?: boolean;
  domainKey?: string;
  platformKey?: string;
  conceptId?: ConceptId;
}

const defaultClock: ClockPort = {
  nowMs: () => Date.now(),
  nowIso: () => new Date().toISOString(),
  performanceNow: () => performance.now(),
};

const FEED_LAUNCHPAD_HOSTS = new Set([
  'youtube.com',
  'youtu.be',
  'x.com',
  'twitter.com',
  'reddit.com',
  'vk.com',
  'habr.com',
  'dzen.ru',
  'news.ycombinator.com',
  'google.com',
  'ya.ru',
  'yandex.ru',
]);

function isFeedLaunchpadUrl(tab: TabMetadata, domainInfo: ExtractedDomainInfo): boolean {
  if (isYouTubeHomeTab(tab)) return true;
  if (!FEED_LAUNCHPAD_HOSTS.has(domainInfo.rootDomain)) return false;
  try {
    const parsed = new URL(tab.url);
    return (parsed.pathname === '/' || parsed.pathname === '') && parsed.search.length <= 1;
  } catch {
    return false;
  }
}

function truncateGroupLabel(rawTitle: string, maxLength = 22): string {
  const clean = rawTitle.trim().replace(/\s+/g, ' ');
  if (clean.length <= maxLength) {
    return clean.replace(/[\s·:|\\/\-–—]+$/u, '').trim() || clean;
  }
  const words = clean.split(' ');
  const kept: string[] = [];
  for (const w of words) {
    const candidate = kept.length === 0 ? w : `${kept.join(' ')} ${w}`;
    if (candidate.length <= maxLength) {
      kept.push(w);
    } else {
      break;
    }
  }
  const raw = kept.length > 0 ? kept.join(' ') : clean.slice(0, maxLength);
  return raw.replace(/[\s·:|\\/\-–—]+$/u, '').trim() || clean.slice(0, maxLength).trim();
}

function getDominantGroupConcept(
  tabIds: readonly number[],
  tabsById: ReadonlyMap<number, TabMetadata>,
  windowPriors?: ReadonlyMap<ConceptId, number>,
): ConceptId | null {
  const counts = new Map<ConceptId, number>();
  for (const id of tabIds) {
    const tab = tabsById.get(id);
    if (!tab) continue;
    const dInfo = extractDomainInfo(tab.url);
    const classified = classifyTabConcept(tab, dInfo, {
      ignoreHostPrior: isYouTubeMediaHost(dInfo),
      windowPriors,
    });
    if (classified) {
      counts.set(classified.conceptId, (counts.get(classified.conceptId) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (!top) return null;
  // Reject equal ties; require > 50% when rival concepts explicitly appear in the group
  if (ranked[1] && top[1] === ranked[1][1]) return null;
  const ratio = top[1] / Math.max(1, tabIds.length);
  if (ranked.length === 1) return ratio >= 0.5 ? top[0] : null;
  return ratio > 0.5 ? top[0] : null;
}

const MULTI_TENANT_HOSTING_DOMAINS = new Set([
  'github.io',
  'gitlab.io',
  'vercel.app',
  'netlify.app',
  'pages.dev',
  'herokuapp.com',
  'onrender.com',
  'fly.dev',
  'web.app',
  'firebaseapp.com',
  'blogspot.com',
  'wordpress.com',
  'substack.com',
  'notion.site',
  'tilda.ws',
  'carrd.co',
  'myshopify.com',
  'tumblr.com',
  'replit.app',
  'streamlit.app',
]);

function resolveGroupConcept(
  group: ProposedGroup,
  tabsById: ReadonlyMap<number, TabMetadata>,
  knownGroupConcepts: ReadonlyMap<string, ConceptId | null>,
  windowPriors?: ReadonlyMap<ConceptId, number>,
): ConceptId | null {
  if (knownGroupConcepts.has(group.id)) {
    return knownGroupConcepts.get(group.id) ?? null;
  }
  const idMatch = /^logic-(?:yt|nlp)-concept-([a-z]+)/i.exec(group.id);
  if (idMatch?.[1]) {
    return idMatch[1] as ConceptId;
  }
  return getDominantGroupConcept(group.tabIds, tabsById, windowPriors);
}

function computeGroupSortTier(
  group: ProposedGroup,
  tabsById: ReadonlyMap<number, TabMetadata>,
  knownGroupConcepts: ReadonlyMap<string, ConceptId | null>,
  windowPriors?: ReadonlyMap<ConceptId, number>,
): number {
  if (group.source === 'rule') return 0;
  if (group.source === 'fallback' || group.id === 'logic-misc-singletons') return 7;

  // Keep all YouTube groups adjacent at the end before Misc:
  // specific topic subgroups (tier 5) immediately followed by generic YouTube / YouTube · Другое (tier 6)
  if (
    group.id === 'logic-yt-other' ||
    group.id === 'logic-platform-media-youtube' ||
    group.id === 'logic-platform-media-media-and-audio' ||
    group.groupName === 'YouTube' ||
    group.groupName === 'YouTube · Другое' ||
    group.groupName === 'YouTube · Other'
  ) {
    return 6;
  }
  if (isYouTubeGroup(group)) return 5;

  if (group.id.startsWith('logic-platform-audio')) return 4;

  if (
    group.id.startsWith('logic-platform-search') ||
    group.groupName === 'Research & Search' ||
    group.source === 'context-chain'
  ) {
    return 2;
  }

  if (
    group.id.startsWith('logic-platform-code') ||
    group.id.startsWith('logic-platform-github') ||
    group.id.startsWith('logic-platform-gitlab') ||
    group.id.startsWith('logic-platform-workspace') ||
    group.id.startsWith('logic-platform-gworkspace')
  ) {
    return 1;
  }

  const dominantConcept = resolveGroupConcept(group, tabsById, knownGroupConcepts, windowPriors);

  if (
    dominantConcept === 'dev' ||
    dominantConcept === 'devops' ||
    dominantConcept === 'ai' ||
    dominantConcept === 'design'
  ) {
    return 1;
  }

  return 3;
}

export interface LogicGroupingParams {
  tabs: readonly TabMetadata[];
  rules?: readonly DeterministicRule[];
  options?: DeterministicOptions;
  existingGroups?: readonly ExistingTabGroup[];
  maxTabsPerGroup?: MaxTabsPerGroup;
  clock?: ClockPort;
}

export function runLogicGrouping(params: LogicGroupingParams): GroupingPlan {
  const clock = params.clock ?? defaultClock;
  const startTime = clock.performanceNow();

  const rules = params.rules ?? DEFAULT_DETERMINISTIC_RULES;
  const options = params.options ?? DEFAULT_DETERMINISTIC_OPTIONS;
  const existingGroups = params.existingGroups ?? [];
  const maxTabsPerGroup =
    params.maxTabsPerGroup === undefined ? DEFAULT_MAX_TABS_PER_GROUP : params.maxTabsPerGroup;

  const tabsById = new Map<number, TabMetadata>();
  for (const t of params.tabs) {
    tabsById.set(t.id, t);
  }

  const shouldPreserveExisting = options.preserveExistingGroups && existingGroups.length > 0;
  const existingProfiles = shouldPreserveExisting
    ? buildExistingGroupProfiles(existingGroups, tabsById)
    : [];

  const lockedGroupedTabIds = new Set<number>();
  if (shouldPreserveExisting) {
    for (const profile of existingProfiles) {
      for (const id of profile.group.tabIds) {
        lockedGroupedTabIds.add(id);
      }
    }
  }

  // Compute window-wide semantic priors across unlocked tabs so borderline ambiguous ties
  // resolve harmoniously with the rest of the window instead of dropping into Другое.
  const windowPriorInputs: Array<{
    tab: TabMetadata;
    domainInfo: ExtractedDomainInfo;
    ignoreHostPrior: boolean;
  }> = [];
  for (const tab of params.tabs) {
    if (lockedGroupedTabIds.has(tab.id)) continue;
    if (options.ignorePinnedTabs && tab.pinned) continue;
    const dInfo = extractDomainInfo(tab.url);
    if (dInfo.isInternalBrowserUrl) continue;
    windowPriorInputs.push({
      tab,
      domainInfo: dInfo,
      ignoreHostPrior: isYouTubeMediaHost(dInfo),
    });
  }
  const windowPriors = computeWindowConceptPriors(windowPriorInputs);

  const activeRules = [...rules]
    .filter((r) => r.enabled && r.pattern.trim().length > 0)
    .sort((a, b) => a.priority - b.priority);

  const highPriorityRules = activeRules.filter((r) => r.priority < 10);
  const standardPriorityRules = activeRules.filter((r) => r.priority >= 10);

  const buckets = new Map<string, PendingBucket>();
  const pendingYouTubeTabs: TabMetadata[] = [];
  const ungroupedTabIds: number[] = [];

  for (const tab of params.tabs) {
    if (lockedGroupedTabIds.has(tab.id)) {
      continue;
    }

    if (options.ignorePinnedTabs && tab.pinned) {
      ungroupedTabIds.push(tab.id);
      continue;
    }

    const domainInfo = extractDomainInfo(tab.url);
    if (domainInfo.isInternalBrowserUrl) {
      ungroupedTabIds.push(tab.id);
      continue;
    }

    const highRule = highPriorityRules.find((r) => matchesRule(tab, r, domainInfo));
    const platformMatch = extractPlatformCluster(domainInfo);
    const stdRule = standardPriorityRules.find((r) => matchesRule(tab, r, domainInfo));

    // Stage 0: Non-Destructive Smart Merge into existing Chrome tab groups
    if (shouldPreserveExisting) {
      const matchedExisting = findMatchingExistingGroupProfile(
        tab,
        domainInfo,
        platformMatch,
        highRule ?? stdRule,
        existingProfiles,
        tabsById,
      );

      if (matchedExisting) {
        matchedExisting.addedTabIds.push(tab.id);
        for (const tk of extractTicketIdentifiers(tab.title)) {
          matchedExisting.ticketIds.add(tk);
        }
        continue;
      }
    }

    // Stage 1: High-priority rules (priority < 10)
    if (highRule) {
      const key = `rule:${highRule.id}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.tabIds.push(tab.id);
      } else {
        buckets.set(key, {
          id: `logic-rule-${highRule.id}`,
          groupName: highRule.name,
          emoji: highRule.emoji || '📁',
          color: highRule.color,
          tabIds: [tab.id],
          source: 'rule',
          reasoning: `Matched high-priority rule "${highRule.name}"`,
          isExplicitRule: true,
        });
      }
      continue;
    }

    // Stage 2: Dedicated Smart YouTube Clustering + Platform Clusters
    if (platformMatch) {
      if (isYouTubeMediaHost(domainInfo)) {
        pendingYouTubeTabs.push(tab);
        continue;
      }

      const existing = buckets.get(platformMatch.bucketKey);
      if (existing) {
        existing.tabIds.push(tab.id);
      } else {
        buckets.set(platformMatch.bucketKey, {
          id: `logic-${platformMatch.bucketKey.replace(/[^a-z0-9-]+/gi, '-')}`,
          groupName: platformMatch.groupName,
          emoji: platformMatch.emoji,
          color: platformMatch.color,
          tabIds: [tab.id],
          source: 'platform',
          reasoning: platformMatch.reasoning,
          isExplicitRule: false,
          platformKey: platformMatch.bucketKey,
          domainKey: domainInfo.rootDomain,
        });
      }
      continue;
    }

    // Stage 3: Standard rules (priority >= 10)
    if (stdRule) {
      const key = `rule:${stdRule.id}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.tabIds.push(tab.id);
      } else {
        buckets.set(key, {
          id: `logic-rule-${stdRule.id}`,
          groupName: stdRule.name,
          emoji: stdRule.emoji || '📁',
          color: stdRule.color,
          tabIds: [tab.id],
          source: 'rule',
          reasoning: `Matched rule "${stdRule.name}"`,
          isExplicitRule: true,
        });
      }
      continue;
    }

    // Stage 4: Canonical Brand / Domain / Subdomain / Path Segment (preserve multi-tenant hosting subdomains)
    const effectiveMergeSubdomains =
      options.mergeSubdomains && !MULTI_TENANT_HOSTING_DOMAINS.has(domainInfo.rootDomain);
    const domainKey = effectiveMergeSubdomains ? domainInfo.rootDomain : domainInfo.hostname;
    const rawFirstSeg = domainInfo.meaningfulPathSegments[0];
    const firstMeaningfulSegment =
      options.groupByFirstPathSegment && rawFirstSeg ? rawFirstSeg.toLowerCase() : undefined;

    const meta = formatDomainGroupMeta(domainKey, firstMeaningfulSegment, domainInfo.hostname);
    const bucketKey = firstMeaningfulSegment
      ? `domain:${domainKey}/${firstMeaningfulSegment}`
      : meta.canonicalKey
        ? `canonical:${meta.canonicalKey}`
        : `domain:${domainKey}`;

    const existingDomain = buckets.get(bucketKey);
    if (existingDomain) {
      existingDomain.tabIds.push(tab.id);
    } else {
      buckets.set(bucketKey, {
        id: `logic-${bucketKey.replace(/[^a-z0-9-]+/gi, '-')}`,
        groupName: meta.groupName,
        emoji: meta.emoji,
        color: meta.color,
        tabIds: [tab.id],
        source: 'domain',
        reasoning: `Grouped by ${effectiveMergeSubdomains ? 'root domain' : 'hostname'} (${domainKey})`,
        isExplicitRule: false,
        isKnownBrand: meta.isKnownBrand,
        domainKey,
        conceptId: meta.conceptId,
      });
    }
  }

  // Convert preserved existing groups
  const preservedGroups: ProposedGroup[] = [];
  const tabToGroupMap = new Map<number, ProposedGroup>();

  for (const profile of existingProfiles) {
    const existingTabIds = [...profile.group.tabIds];
    const addedTabIds = [...profile.addedTabIds];
    const combinedTabIds = [...existingTabIds, ...addedTabIds];
    if (combinedTabIds.length === 0) continue;

    const groupObj: ProposedGroup = {
      id: `existing-group-${profile.group.id}`,
      groupName: profile.group.cleanTitle || 'Group',
      emoji: profile.group.emoji || '📌',
      color: profile.group.color,
      tabIds: combinedTabIds,
      existingGroupId: profile.group.id,
      existingTabIds,
      addedTabIds,
      source: 'existing-merge',
      reasoning:
        addedTabIds.length > 0
          ? `Merged +${addedTabIds.length} tab(s) into "${profile.group.cleanTitle}"`
          : `Preserved existing group "${profile.group.cleanTitle}"`,
    };

    preservedGroups.push(groupObj);
    for (const id of combinedTabIds) {
      tabToGroupMap.set(id, groupObj);
    }
  }

  // Collect external non-YouTube singleton concepts and ticket IDs so media clustering can release
  // matching orphan videos for cross-domain concept/ticket unification instead of trapping them in Другое.
  const externalSingletonConcepts = new Set<ConceptId>();
  const externalTicketIds = new Set<string>();
  for (const profile of existingProfiles) {
    for (const tk of profile.ticketIds) externalTicketIds.add(tk);
  }
  for (const bucket of buckets.values()) {
    for (const id of bucket.tabIds) {
      const t = tabsById.get(id);
      if (!t) continue;
      for (const tk of extractTicketIdentifiers(t.title)) {
        externalTicketIds.add(tk);
      }
    }
    if (!bucket.isExplicitRule && bucket.tabIds.length === 1) {
      if (bucket.conceptId) {
        externalSingletonConcepts.add(bucket.conceptId);
      } else {
        const onlyId = bucket.tabIds[0];
        const t = onlyId !== undefined ? tabsById.get(onlyId) : undefined;
        if (t) {
          const classified = classifyTabConcept(t, extractDomainInfo(t.url), { windowPriors });
          if (classified) {
            externalSingletonConcepts.add(classified.conceptId);
          }
        }
      }
    }
  }

  // Run smart semantic + entity clustering over pending YouTube tabs BEFORE splitting/finalizing
  const ytResult = clusterYouTubeTabs(
    pendingYouTubeTabs,
    options.minTabsPerGroup,
    maxTabsPerGroup,
    {
      singletonConceptIds: externalSingletonConcepts,
      ticketIds: externalTicketIds,
      windowPriors,
    },
  );

  const knownGroupConcepts = new Map<string, ConceptId | null>();
  for (const [gId, cId] of ytResult.conceptByGroupId.entries()) {
    knownGroupConcepts.set(gId, cId);
  }

  const newGroups: ProposedGroup[] = [];
  for (const ytGroup of ytResult.groups) {
    newGroups.push(ytGroup);
    for (const id of ytGroup.tabIds) {
      tabToGroupMap.set(id, ytGroup);
    }
  }

  const singletonBuckets = new Map<number, PendingBucket>();

  // Register any uncategorized single-tab YouTube leftovers as singletons so they can still participate
  // in cross-domain concept/ticket/opener linking (e.g. YT recipe + cooking article) or be cleanly skipped.
  for (const ytSingleton of ytResult.singletonTabs) {
    singletonBuckets.set(ytSingleton.id, {
      id: `logic-yt-single-${ytSingleton.id}`,
      groupName: 'YouTube',
      emoji: '🎬',
      color: 'red',
      tabIds: [ytSingleton.id],
      source: 'platform',
      reasoning: 'YouTube video tab',
      isExplicitRule: false,
      domainKey: 'youtube.com',
      platformKey: 'platform:media:youtube',
    });
  }

  // Separate multi-tab buckets from singletons
  const domainKeyByGroupId = new Map<string, string>();
  const promotedConceptGroupIds = new Set<string>();
  for (const bucket of buckets.values()) {
    if (bucket.tabIds.length >= 2) {
      let finalGroupName = bucket.groupName;
      let finalEmoji = bucket.emoji;
      let finalColor = bucket.color;

      const memberDominantConcept = getDominantGroupConcept(
        bucket.tabIds,
        tabsById,
        windowPriors,
      );
      if (memberDominantConcept !== null) {
        knownGroupConcepts.set(bucket.id, memberDominantConcept);
      } else if (
        bucket.conceptId !== undefined &&
        !(bucket.domainKey && MULTI_TOPIC_CONTENT_HOSTS.has(bucket.domainKey))
      ) {
        knownGroupConcepts.set(bucket.id, bucket.conceptId);
      }
      if (bucket.domainKey) {
        domainKeyByGroupId.set(bucket.id, bucket.domainKey);
      }

      if (bucket.source === 'domain' && bucket.domainKey && !bucket.isKnownBrand) {
        const memberTabs = bucket.tabIds
          .map((id) => tabsById.get(id))
          .filter((t): t is TabMetadata => Boolean(t));
        const synth = synthesizeHumanGroupTitle(memberTabs, bucket.domainKey, windowPriors);
        if (synth.groupName !== 'Focus Cluster') {
          finalGroupName = synth.groupName;
          finalEmoji = synth.emoji;
        } else if (memberDominantConcept) {
          knownGroupConcepts.set(bucket.id, memberDominantConcept);
          const preferRu = memberTabs.some((t) => isRussianFocusedTab(t));
          const cMeta = getConceptDisplayMeta(memberDominantConcept, preferRu);
          finalGroupName = truncateGroupLabel(`${bucket.groupName} · ${cMeta.label}`, 22);
          finalEmoji = cMeta.emoji;
          finalColor = cMeta.color;
        }
      }

      const group: ProposedGroup = {
        id: bucket.id,
        groupName: finalGroupName,
        emoji: finalEmoji,
        color: finalColor,
        tabIds: [...bucket.tabIds],
        source: bucket.source,
        reasoning: bucket.reasoning,
      };
      newGroups.push(group);
      for (const id of group.tabIds) {
        tabToGroupMap.set(id, group);
      }
    } else if (bucket.tabIds.length === 1) {
      const onlyTabId = bucket.tabIds[0];
      if (onlyTabId !== undefined) {
        singletonBuckets.set(onlyTabId, bucket);
      }
    }
  }

  // Stage 4.5: Unify >= 2 standalone Google Workspace sub-tool singletons (e.g. 1 Doc + 1 Sheet) into Google Workspace
  const workspaceSingletonIds: number[] = [];
  const githubSingletonIds: number[] = [];
  const gitlabSingletonIds: number[] = [];

  for (const [tabId, bucket] of singletonBuckets.entries()) {
    if (bucket.isExplicitRule) continue;
    if (
      bucket.platformKey?.startsWith('platform:gworkspace:') ||
      bucket.platformKey?.startsWith('platform:workspace:')
    ) {
      workspaceSingletonIds.push(tabId);
    } else if (
      bucket.platformKey?.startsWith('platform:github.com:') ||
      bucket.platformKey?.startsWith('platform:code:github')
    ) {
      githubSingletonIds.push(tabId);
    } else if (
      bucket.platformKey?.startsWith('platform:gitlab.com:') ||
      bucket.platformKey?.startsWith('platform:code:gitlab')
    ) {
      gitlabSingletonIds.push(tabId);
    }
  }

  if (workspaceSingletonIds.length >= 2) {
    const wsGroup: ProposedGroup = {
      id: 'logic-platform-workspace-unified',
      groupName: 'Google Workspace',
      emoji: '📄',
      color: 'blue',
      tabIds: [...workspaceSingletonIds],
      source: 'platform',
      reasoning: 'Unified Google Workspace documents',
    };
    newGroups.push(wsGroup);
    for (const id of workspaceSingletonIds) {
      tabToGroupMap.set(id, wsGroup);
      singletonBuckets.delete(id);
    }
  }

  if (githubSingletonIds.length >= 2) {
    const ghGroup: ProposedGroup = {
      id: 'logic-platform-code-github-unified',
      groupName: 'GitHub',
      emoji: '🐙',
      color: 'purple',
      tabIds: [...githubSingletonIds],
      source: 'platform',
      reasoning: 'Unified GitHub repositories and settings',
    };
    newGroups.push(ghGroup);
    for (const id of githubSingletonIds) {
      tabToGroupMap.set(id, ghGroup);
      singletonBuckets.delete(id);
    }
  }

  if (gitlabSingletonIds.length >= 2) {
    const glGroup: ProposedGroup = {
      id: 'logic-platform-code-gitlab-unified',
      groupName: 'GitLab',
      emoji: '🦊',
      color: 'orange',
      tabIds: [...gitlabSingletonIds],
      source: 'platform',
      reasoning: 'Unified GitLab repositories',
    };
    newGroups.push(glGroup);
    for (const id of gitlabSingletonIds) {
      tabToGroupMap.set(id, glGroup);
      singletonBuckets.delete(id);
    }
  }

  // Stage 5: Contextual Research Chain Linking (`Research & Search`)
  const researchGroup = [...preservedGroups, ...newGroups].find(
    (g) =>
      g.id === 'logic-platform-search-research-and-search' || g.groupName === 'Research & Search',
  );
  if (researchGroup) {
    const searchMemberTabs = researchGroup.tabIds
      .map((id) => tabsById.get(id))
      .filter((t): t is TabMetadata => Boolean(t));

    for (const [tabId, bucket] of [...singletonBuckets.entries()]) {
      if (bucket.isExplicitRule) continue;
      const candidateTab = tabsById.get(tabId);
      if (!candidateTab) continue;

      const matchesResearchChain = searchMemberTabs.some(
        (searchTab) => computeContextualAffinityScore(searchTab, candidateTab) >= 0.45,
      );

      if (matchesResearchChain) {
        if (!researchGroup.tabIds.includes(tabId)) {
          researchGroup.tabIds.push(tabId);
        }
        if (researchGroup.addedTabIds && !researchGroup.addedTabIds.includes(tabId)) {
          researchGroup.addedTabIds.push(tabId);
        }
        researchGroup.source = 'context-chain';
        tabToGroupMap.set(tabId, researchGroup);
        singletonBuckets.delete(tabId);
      }
    }
  }

  // Stage 6: Ticket & Bilingual NLP + Cross-Domain Semantic Concept clustering across remaining singletons
  const establishedByTicket = new Map<string, ProposedGroup>();
  for (const group of [...preservedGroups, ...newGroups]) {
    for (const tabId of group.tabIds) {
      const t = tabsById.get(tabId);
      if (!t) continue;
      for (const ticket of extractTicketIdentifiers(t.title)) {
        if (!establishedByTicket.has(ticket)) {
          establishedByTicket.set(ticket, group);
        }
      }
    }
  }

  for (const [tabId, bucket] of [...singletonBuckets.entries()]) {
    if (bucket.isExplicitRule) continue;
    const tab = tabsById.get(tabId);
    if (!tab) continue;
    const tickets = extractTicketIdentifiers(tab.title);
    const matchingExistingGroup = tickets.map((tk) => establishedByTicket.get(tk)).find(Boolean);

    if (matchingExistingGroup) {
      if (!matchingExistingGroup.tabIds.includes(tabId)) {
        matchingExistingGroup.tabIds.push(tabId);
      }
      if (
        matchingExistingGroup.addedTabIds &&
        !matchingExistingGroup.addedTabIds.includes(tabId)
      ) {
        matchingExistingGroup.addedTabIds.push(tabId);
      }
      tabToGroupMap.set(tabId, matchingExistingGroup);
      singletonBuckets.delete(tabId);
    }
  }

  const remainingSingletonTabs = [...singletonBuckets.entries()]
    .filter(([, bucket]) => !bucket.isExplicitRule)
    .map(([id]) => tabsById.get(id))
    .filter((t): t is TabMetadata => Boolean(t));

  const {
    nlpGroups,
    clusteredTabIds,
    conceptByGroupId: nlpConcepts,
  } = clusterTabsByTitleNlp(remainingSingletonTabs, 0.45, windowPriors);

  for (const nlpGroup of nlpGroups) {
    newGroups.push(nlpGroup);
    const inferredConcept =
      nlpConcepts.get(nlpGroup.id) ??
      (nlpGroup.id.startsWith('logic-nlp-concept-')
        ? (nlpGroup.id.slice('logic-nlp-concept-'.length) as ConceptId)
        : getDominantGroupConcept(nlpGroup.tabIds, tabsById, windowPriors));
    knownGroupConcepts.set(nlpGroup.id, inferredConcept);
    for (const id of nlpGroup.tabIds) {
      tabToGroupMap.set(id, nlpGroup);
      singletonBuckets.delete(id);
    }
  }

  // Stage 7: Guarded parent-child `openerTabId` attachment
  for (const [tabId, childBucket] of [...singletonBuckets.entries()]) {
    if (childBucket.isExplicitRule) continue;
    if (!singletonBuckets.has(tabId)) continue;
    const tab = tabsById.get(tabId);
    if (!tab || typeof tab.openerTabId !== 'number') continue;

    const parentBucket = singletonBuckets.get(tab.openerTabId);
    if (parentBucket && !parentBucket.isExplicitRule && tab.openerTabId !== tabId) {
      const parentTab = tabsById.get(tab.openerTabId);
      if (!parentTab) continue;

      const parentDomain = extractDomainInfo(parentTab.url);
      if (isFeedLaunchpadUrl(parentTab, parentDomain)) continue;

      const childDomain = extractDomainInfo(tab.url);
      const isParentYt = isYouTubeMediaHost(parentDomain);
      const isChildYt = isYouTubeMediaHost(childDomain);
      const pConcept = classifyTabConcept(parentTab, parentDomain, {
        ignoreHostPrior: isParentYt,
        windowPriors,
      })?.conceptId;
      const cConcept = classifyTabConcept(tab, childDomain, {
        ignoreHostPrior: isChildYt,
        windowPriors,
      })?.conceptId;
      if (pConcept && cConcept && pConcept !== cConcept) continue;

      const memberPair = [parentTab, tab];
      const synth = synthesizeHumanGroupTitle(memberPair, parentBucket.domainKey, windowPriors);
      const preferRuPair = memberPair.some((m) => isRussianFocusedTab(m));

      let groupName = parentBucket.groupName;
      let emoji = parentBucket.emoji;
      if (isParentYt && isChildYt) {
        if (cConcept && pConcept === cConcept) {
          const cMeta = getConceptDisplayMeta(cConcept, preferRuPair);
          groupName = formatYouTubeConceptLabel(cConcept, preferRuPair);
          emoji = cMeta.emoji;
        } else if (synth.groupName !== 'Focus Cluster') {
          groupName = ensureYouTubePrefix(synth.groupName);
          emoji = synth.emoji;
        }
      } else if (parentBucket.source !== 'platform' && synth.groupName !== 'Focus Cluster') {
        groupName = synth.groupName;
        emoji = synth.emoji;
      } else if (cConcept && pConcept === cConcept) {
        const cMeta = getConceptDisplayMeta(cConcept, preferRuPair);
        groupName = cMeta.label;
        emoji = cMeta.emoji;
      }

      const promotedGroup: ProposedGroup = {
        id: parentBucket.id,
        groupName,
        emoji,
        color: parentBucket.color,
        tabIds: [...parentBucket.tabIds, tabId],
        source: 'opener',
        reasoning: `Parent tab (#${tab.openerTabId}) grouped with child tab`,
      };
      knownGroupConcepts.set(promotedGroup.id, cConcept ?? pConcept ?? null);
      newGroups.push(promotedGroup);
      tabToGroupMap.set(tab.openerTabId, promotedGroup);
      tabToGroupMap.set(tabId, promotedGroup);
      singletonBuckets.delete(tab.openerTabId);
      singletonBuckets.delete(tabId);
    }
  }

  for (const [tabId, childBucket] of [...singletonBuckets.entries()]) {
    if (childBucket.isExplicitRule) continue;
    const childTab = tabsById.get(tabId);
    if (!childTab) continue;

    // Never attach from feed launchpads
    if (typeof childTab.openerTabId === 'number') {
      const directParent = tabsById.get(childTab.openerTabId);
      if (directParent && isFeedLaunchpadUrl(directParent, extractDomainInfo(directParent.url))) {
        continue;
      }
    }

    const ancestorGroup = findEffectiveOpenerGroup(tabId, tabsById, tabToGroupMap);
    if (ancestorGroup) {
      const childDomain = extractDomainInfo(childTab.url);
      const childConcept = classifyTabConcept(childTab, childDomain, {
        ignoreHostPrior: isYouTubeMediaHost(childDomain),
        windowPriors,
      })?.conceptId;
      const groupConcept = resolveGroupConcept(
        ancestorGroup,
        tabsById,
        knownGroupConcepts,
        windowPriors,
      );

      if (
        childConcept &&
        groupConcept &&
        childConcept !== groupConcept &&
        ancestorGroup.groupName !== 'Research & Search'
      ) {
        continue;
      }

      if (!ancestorGroup.tabIds.includes(tabId)) {
        ancestorGroup.tabIds.push(tabId);
      }
      if (ancestorGroup.addedTabIds && !ancestorGroup.addedTabIds.includes(tabId)) {
        ancestorGroup.addedTabIds.push(tabId);
      }
      tabToGroupMap.set(tabId, ancestorGroup);
      singletonBuckets.delete(tabId);
    }
  }

  // Stage 7.5: Cross-Domain Same-Concept Absorption (e.g. 2 Ozon + 1 Wildberries -> Покупки, 2 ChatGPT + 1 Groq -> AI & LLM)
  for (const [tabId, bucket] of [...singletonBuckets.entries()]) {
    if (bucket.isExplicitRule) continue;
    if (bucket.platformKey && bucket.platformKey !== 'platform:media:youtube') continue;

    const tab = tabsById.get(tabId);
    if (!tab) continue;
    const dInfo = extractDomainInfo(tab.url);
    const isYt = isYouTubeMediaHost(dInfo);
    const isMultiTopicHost =
      MULTI_TOPIC_CONTENT_HOSTS.has(dInfo.rootDomain) ||
      MULTI_TOPIC_CONTENT_HOSTS.has(dInfo.hostname);
    const titleClassified =
      classifyTabConcept(tab, dInfo, { ignoreHostPrior: isYt, windowPriors })?.conceptId ?? null;
    const singletonConcept = titleClassified ?? (isMultiTopicHost ? null : bucket.conceptId);
    if (!singletonConcept) continue;

    const compatibleGroups = newGroups.filter((g) => {
      if (g.source !== 'domain' && g.source !== 'title-nlp') return false;
      if (
        options.groupByFirstPathSegment &&
        bucket.domainKey &&
        domainKeyByGroupId.get(g.id) === bucket.domainKey
      ) {
        return false;
      }
      const gConcept = resolveGroupConcept(g, tabsById, knownGroupConcepts, windowPriors);
      if (gConcept !== singletonConcept) return false;
      knownGroupConcepts.set(g.id, gConcept);
      return true;
    });

    if (compatibleGroups.length === 0) continue;

    // Prefer an existing semantic concept group (`title-nlp`) or a group with room under maxTabsPerGroup
    compatibleGroups.sort((a, b) => {
      const aConceptGroup =
        a.id.startsWith('logic-nlp-concept-') || promotedConceptGroupIds.has(a.id) ? 0 : 1;
      const bConceptGroup =
        b.id.startsWith('logic-nlp-concept-') || promotedConceptGroupIds.has(b.id) ? 0 : 1;
      if (aConceptGroup !== bConceptGroup) return aConceptGroup - bConceptGroup;
      const aHasRoom = maxTabsPerGroup === null || a.tabIds.length < maxTabsPerGroup ? 0 : 1;
      const bHasRoom = maxTabsPerGroup === null || b.tabIds.length < maxTabsPerGroup ? 0 : 1;
      if (aHasRoom !== bHasRoom) return aHasRoom - bHasRoom;
      return a.tabIds.length - b.tabIds.length;
    });

    const targetGroup = compatibleGroups[0];
    if (!targetGroup) continue;

    if (!targetGroup.tabIds.includes(tabId)) {
      targetGroup.tabIds.push(tabId);
    }
    tabToGroupMap.set(tabId, targetGroup);
    singletonBuckets.delete(tabId);

    // Promote brand-specific `domain` group (e.g. Ozon -> Покупки, ChatGPT -> AI & LLM) when another domain joins via concept
    const existingDomainKey = domainKeyByGroupId.get(targetGroup.id);
    if (
      targetGroup.source === 'domain' &&
      existingDomainKey &&
      bucket.domainKey &&
      existingDomainKey !== bucket.domainKey
    ) {
      const members = targetGroup.tabIds
        .map((id) => tabsById.get(id))
        .filter((t): t is TabMetadata => Boolean(t));
      const ruCount = members.filter((t) => isRussianFocusedTab(t)).length;
      const preferRu = ruCount > 0 && ruCount * 2 >= members.length;
      const cMeta = getConceptDisplayMeta(singletonConcept, preferRu);
      targetGroup.groupName = cMeta.label;
      targetGroup.emoji = cMeta.emoji;
      targetGroup.color = cMeta.color;
      targetGroup.source = 'title-nlp';
      targetGroup.reasoning = `Cross-domain semantic concept (${cMeta.label})`;
      promotedConceptGroupIds.add(targetGroup.id);
    }
  }

  // Stage 8: Anti-Singleton Finalization
  const leftoverSingletonIds: number[] = [];
  for (const [tabId, bucket] of singletonBuckets.entries()) {
    const canStandAlone = bucket.isExplicitRule || bucket.tabIds.length >= options.minTabsPerGroup;
    if (!clusteredTabIds.has(tabId) && canStandAlone) {
      newGroups.push({
        id: bucket.id,
        groupName: bucket.groupName,
        emoji: bucket.emoji,
        color: bucket.color,
        tabIds: bucket.tabIds,
        source: bucket.source,
        reasoning: bucket.reasoning,
      });
    } else {
      leftoverSingletonIds.push(tabId);
    }
  }

  if (leftoverSingletonIds.length > 0) {
    if (options.groupSingletonsIntoMisc && leftoverSingletonIds.length >= options.minTabsPerGroup) {
      const hasRussian = leftoverSingletonIds.some((id) =>
        hasCyrillicText(tabsById.get(id)?.title ?? ''),
      );
      newGroups.push({
        id: 'logic-misc-singletons',
        groupName: hasRussian ? 'Разное' : 'Misc',
        emoji: hasRussian ? '🌐' : '🗂️',
        color: 'grey',
        tabIds: leftoverSingletonIds,
        source: 'fallback',
        reasoning: 'Single tabs combined into fallback group',
      });
    } else {
      ungroupedTabIds.push(...leftoverSingletonIds);
    }
  }

  // Stage 8.5: Principled Same-Concept Brand & Domain Consolidation
  // Combines fragmented small domain/brand/concept groups sharing the same concept (e.g. ChatGPT+Groq + Claude -> AI & LLM;
  // Ozon(2) + Wildberries(2) -> Покупки(4)) when fitting maxTabsPerGroup, while preserving large dedicated brand buckets.
  const dedicatedBrandThreshold =
    maxTabsPerGroup === null ? 5 : Math.max(4, Math.ceil(maxTabsPerGroup * 0.55));
  const mergeEligibleGroupsByConcept = new Map<ConceptId, ProposedGroup[]>();
  const passthroughGroups: ProposedGroup[] = [];

  for (const group of newGroups) {
    const isConceptBucket =
      group.id.startsWith('logic-nlp-concept-') || promotedConceptGroupIds.has(group.id);
    const isSmallDomainGroup =
      group.source === 'domain' && group.tabIds.length < dedicatedBrandThreshold;

    if (isConceptBucket || isSmallDomainGroup) {
      const cId = resolveGroupConcept(group, tabsById, knownGroupConcepts, windowPriors);
      if (cId) {
        knownGroupConcepts.set(group.id, cId);
        const list = mergeEligibleGroupsByConcept.get(cId) ?? [];
        list.push(group);
        mergeEligibleGroupsByConcept.set(cId, list);
        continue;
      }
    }
    passthroughGroups.push(group);
  }

  const consolidatedConceptGroups: ProposedGroup[] = [];
  for (const [conceptId, poolGroups] of mergeEligibleGroupsByConcept.entries()) {
    if (poolGroups.length < 2) {
      consolidatedConceptGroups.push(...poolGroups);
      continue;
    }

    // Prefer already-promoted semantic concept groups as merge targets, then largest group
    const sortedPool = [...poolGroups].sort((a, b) => {
      const aPref =
        a.id.startsWith('logic-nlp-concept-') || promotedConceptGroupIds.has(a.id) ? 0 : 1;
      const bPref =
        b.id.startsWith('logic-nlp-concept-') || promotedConceptGroupIds.has(b.id) ? 0 : 1;
      if (aPref !== bPref) return aPref - bPref;
      return b.tabIds.length - a.tabIds.length;
    });

    const packedTargets: Array<{
      group: ProposedGroup;
      mergedDifferentDomains: boolean;
      domainKeys: Set<string>;
    }> = [];

    for (const candidate of sortedPool) {
      const candidateDomain = domainKeyByGroupId.get(candidate.id);
      const fitTarget = packedTargets.find((entry) => {
        if (
          maxTabsPerGroup !== null &&
          entry.group.tabIds.length + candidate.tabIds.length > maxTabsPerGroup
        ) {
          return false;
        }
        if (
          options.groupByFirstPathSegment &&
          candidateDomain &&
          entry.domainKeys.has(candidateDomain)
        ) {
          return false;
        }
        return true;
      });

      if (fitTarget) {
        const beforeDomainCount = fitTarget.domainKeys.size;
        for (const id of candidate.tabIds) {
          if (!fitTarget.group.tabIds.includes(id)) {
            fitTarget.group.tabIds.push(id);
          }
          tabToGroupMap.set(id, fitTarget.group);
        }
        if (candidateDomain) fitTarget.domainKeys.add(candidateDomain);
        if (fitTarget.domainKeys.size > beforeDomainCount || candidate.source !== fitTarget.group.source) {
          fitTarget.mergedDifferentDomains = true;
        }
      } else {
        const domainSet = new Set<string>();
        if (candidateDomain) domainSet.add(candidateDomain);
        packedTargets.push({
          group: { ...candidate, tabIds: [...candidate.tabIds] },
          mergedDifferentDomains:
            candidate.id.startsWith('logic-nlp-concept-') ||
            promotedConceptGroupIds.has(candidate.id),
          domainKeys: domainSet,
        });
      }
    }

    for (const packed of packedTargets) {
      if (packed.mergedDifferentDomains || packed.domainKeys.size > 1) {
        const members = packed.group.tabIds
          .map((id) => tabsById.get(id))
          .filter((t): t is TabMetadata => Boolean(t));
        const ruCount = members.filter((t) => isRussianFocusedTab(t)).length;
        const preferRu = ruCount > 0 && ruCount * 2 >= members.length;
        const cMeta = getConceptDisplayMeta(conceptId, preferRu);
        packed.group.groupName = cMeta.label;
        packed.group.emoji = cMeta.emoji;
        packed.group.color = cMeta.color;
        packed.group.source = 'title-nlp';
        packed.group.reasoning = `Cross-domain semantic concept (${cMeta.label})`;
      }
      knownGroupConcepts.set(packed.group.id, conceptId);
      consolidatedConceptGroups.push(packed.group);
    }
  }

  const coalescedGroups = [...passthroughGroups, ...consolidatedConceptGroups];

  // Merge accidental duplicate-named semantic/domain groups that stay within maxTabsPerGroup
  const mergedNewGroups: ProposedGroup[] = [];
  for (const group of coalescedGroups) {
    if (group.source === 'domain' || group.source === 'title-nlp') {
      const normName = group.groupName.toLowerCase().trim();
      const existingSame = mergedNewGroups.find(
        (m) =>
          (m.source === 'domain' || m.source === 'title-nlp') &&
          m.groupName.toLowerCase().trim() === normName &&
          (maxTabsPerGroup === null || m.tabIds.length + group.tabIds.length <= maxTabsPerGroup),
      );
      if (existingSame) {
        for (const id of group.tabIds) {
          if (!existingSame.tabIds.includes(id)) {
            existingSame.tabIds.push(id);
          }
        }
        continue;
      }
    }
    mergedNewGroups.push(group);
  }

  // Stage 9: Contiguous & Cohesive Group Ordering + MaxTabsPerGroup Splitter + Color Harmony
  const tierByGroupId = new Map<string, number>();
  const resolvedConceptByGroupId = new Map<string, ConceptId | null>();
  const ytConceptFamilyTotals = new Map<ConceptId, number>();

  for (const group of mergedNewGroups) {
    const tier = computeGroupSortTier(group, tabsById, knownGroupConcepts, windowPriors);
    tierByGroupId.set(group.id, tier);
    const cId = resolveGroupConcept(group, tabsById, knownGroupConcepts, windowPriors);
    resolvedConceptByGroupId.set(group.id, cId);

    if (tier === 5 && cId) {
      ytConceptFamilyTotals.set(cId, (ytConceptFamilyTotals.get(cId) ?? 0) + group.tabIds.length);
    }
  }

  mergedNewGroups.sort((a, b) => {
    const tierA = tierByGroupId.get(a.id) ?? 3;
    const tierB = tierByGroupId.get(b.id) ?? 3;
    if (tierA !== tierB) return tierA - tierB;

    // Inside Tier 5 (YouTube Topic Subgroups), keep same-concept YouTube groups strictly contiguous
    // ordered by total concept-family tab count descending, then main concept before sub-entities.
    if (tierA === 5) {
      const cA = resolvedConceptByGroupId.get(a.id) ?? null;
      const cB = resolvedConceptByGroupId.get(b.id) ?? null;
      const totalA = cA ? (ytConceptFamilyTotals.get(cA) ?? a.tabIds.length) : a.tabIds.length;
      const totalB = cB ? (ytConceptFamilyTotals.get(cB) ?? b.tabIds.length) : b.tabIds.length;
      if (totalB !== totalA) return totalB - totalA;

      if (cA !== cB) {
        if (cA === null) return 1;
        if (cB === null) return -1;
        return cA.localeCompare(cB);
      }

      const isMainConceptA = a.id.startsWith('logic-yt-concept-') ? 0 : 1;
      const isMainConceptB = b.id.startsWith('logic-yt-concept-') ? 0 : 1;
      if (isMainConceptA !== isMainConceptB) return isMainConceptA - isMainConceptB;
    }

    if (b.tabIds.length !== a.tabIds.length) return b.tabIds.length - a.tabIds.length;
    return a.groupName.localeCompare(b.groupName);
  });

  const combinedGroups = [...preservedGroups, ...mergedNewGroups];
  const sizeBoundedGroups = splitOversizedGroups(
    combinedGroups,
    tabsById,
    maxTabsPerGroup,
    windowPriors,
  );

  // Disambiguate any non-preserved sibling groups still sharing identical display names
  const preservedIds = new Set(preservedGroups.map((g) => g.id));
  const nameCounts = new Map<string, number>();
  for (const g of sizeBoundedGroups) {
    const key = g.groupName.trim().toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }
  const nameOrdinals = new Map<string, number>();
  for (const g of sizeBoundedGroups) {
    const key = g.groupName.trim().toLowerCase();
    if ((nameCounts.get(key) ?? 0) <= 1) continue;
    const ord = (nameOrdinals.get(key) ?? 0) + 1;
    nameOrdinals.set(key, ord);
    if (preservedIds.has(g.id)) continue;
    const suffix = ` (${ord})`;
    g.groupName = `${truncateCleanTitle(g.groupName, 22 - suffix.length)}${suffix}`;
  }

  const harmonizedGroups = allocateHarmoniousColors(sizeBoundedGroups);

  const latencyMs = Math.max(0.1, Number((clock.performanceNow() - startTime).toFixed(2)));

  return {
    modeUsed: 'logic',
    fallbackTriggered: false,
    groups: harmonizedGroups,
    ungroupedTabIds,
    latencyMs,
  };
}
