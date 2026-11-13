import type {
  DeterministicRule,
  ExistingTabGroup,
  ProposedGroup,
  TabMetadata,
} from '../../domain/types';
import { parseExistingGroupTitle } from '../shared/emoji-parser';
import { extractDomainInfo, type ExtractedDomainInfo } from '../shared/url-classifier';
import {
  computeJaccardSimilarity,
  extractTicketIdentifiers,
  isBannedStandaloneTitleWord,
  tokenizeTitle,
} from './nlp-scorer';
import {
  extractPlatformCluster,
  formatDomainGroupMeta,
  type PlatformClusterMatch,
} from './platform-clusterer';
import {
  classifyTabConcept,
  getConceptDisplayMeta,
  getShortConceptLabel,
  type ConceptId,
} from './topic-taxonomy';

export interface AnalyzedExistingGroup {
  group: ExistingTabGroup;
  normalizedTitle: string;
  titleTokens: string[];
  memberTokens: Set<string>;
  primaryConcept: ConceptId | null;
  isGenericMediaContainer: boolean;
  ticketIds: Set<string>;
  platformBucketKeys: Set<string>;
  rootDomains: Set<string>;
  canonicalKeys: Set<string>;
  memberTabIds: Set<number>;
  addedTabIds: number[];
}

const GENERIC_MEDIA_TITLES = new Set([
  'youtube',
  'youtube · другое',
  'youtube другое',
  'youtube · other',
  'youtube other',
  'media & audio',
]);

export function buildExistingGroupProfiles(
  existingGroups: readonly ExistingTabGroup[],
  tabsById: ReadonlyMap<number, TabMetadata>,
): AnalyzedExistingGroup[] {
  return existingGroups.map((eg) => {
    const parsed = parseExistingGroupTitle(eg.title || eg.cleanTitle);
    const cleanTitle = eg.cleanTitle || parsed.cleanTitle || 'Group';
    const normalizedTitle = cleanTitle.toLowerCase().trim();
    const titleTokens = tokenizeTitle(cleanTitle);
    const ticketIds = new Set<string>(extractTicketIdentifiers(cleanTitle));
    const platformBucketKeys = new Set<string>();
    const rootDomains = new Set<string>();
    const canonicalKeys = new Set<string>();
    const memberTokens = new Set<string>();
    const conceptCounts = new Map<ConceptId, number>();
    const memberTabIds = new Set<number>(eg.tabIds);

    for (const tabId of eg.tabIds) {
      const tab = tabsById.get(tabId);
      if (!tab) continue;
      for (const tk of extractTicketIdentifiers(tab.title)) {
        ticketIds.add(tk);
      }
      for (const tok of tokenizeTitle(tab.title)) {
        if (!isBannedStandaloneTitleWord(tok)) {
          memberTokens.add(tok);
        }
      }

      const dInfo = extractDomainInfo(tab.url);
      if (!dInfo.isInternalBrowserUrl) {
        rootDomains.add(dInfo.rootDomain);
        const domainMeta = formatDomainGroupMeta(dInfo.rootDomain, undefined, dInfo.hostname);
        if (domainMeta.canonicalKey) {
          canonicalKeys.add(domainMeta.canonicalKey);
        }
        const pMatch = extractPlatformCluster(dInfo);
        if (pMatch) {
          platformBucketKeys.add(pMatch.bucketKey);
        }
        const classified = classifyTabConcept(tab, dInfo, {
          ignoreHostPrior: Boolean(pMatch),
        });
        if (classified) {
          conceptCounts.set(
            classified.conceptId,
            (conceptCounts.get(classified.conceptId) ?? 0) + 1,
          );
        }
      }
    }

    // Also infer concept directly from group title when tabs haven't been inspected
    let primaryConcept: ConceptId | null =
      [...conceptCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    if (!primaryConcept && cleanTitle) {
      const titleDummyTab: TabMetadata = { id: -1, url: '', title: cleanTitle };
      const titleDomain = extractDomainInfo('');
      const fromTitle = classifyTabConcept(titleDummyTab, titleDomain, { ignoreHostPrior: true });
      if (fromTitle) {
        primaryConcept = fromTitle.conceptId;
      }
    }

    return {
      group: {
        ...eg,
        cleanTitle,
        emoji: eg.emoji ?? parsed.emoji,
      },
      normalizedTitle,
      titleTokens,
      memberTokens,
      primaryConcept,
      isGenericMediaContainer: GENERIC_MEDIA_TITLES.has(normalizedTitle),
      ticketIds,
      platformBucketKeys,
      rootDomains,
      canonicalKeys,
      memberTabIds,
      addedTabIds: [],
    };
  });
}

function isMediaPlatformBucket(bucketKey: string): boolean {
  return bucketKey.startsWith('platform:media:');
}

function isHomepageFeedUrl(url: string, domainInfo: ExtractedDomainInfo): boolean {
  if (domainInfo.isInternalBrowserUrl) return true;
  if (domainInfo.meaningfulPathSegments.length > 0) return false;
  if (url.includes('?') && /[?&](q|query|search_query|v)=/i.test(url)) return false;
  return (
    domainInfo.rootDomain === 'youtube.com' ||
    domainInfo.rootDomain === 'youtu.be' ||
    domainInfo.rootDomain === 'google.com' ||
    domainInfo.rootDomain === 'ya.ru' ||
    domainInfo.rootDomain === 'yandex.ru' ||
    domainInfo.rootDomain === 'reddit.com' ||
    domainInfo.rootDomain === 'x.com' ||
    domainInfo.rootDomain === 'twitter.com'
  );
}

export function findMatchingExistingGroupProfile(
  tab: TabMetadata,
  domainInfo: ExtractedDomainInfo,
  platformMatch: PlatformClusterMatch | null,
  matchedRule: DeterministicRule | undefined,
  profiles: readonly AnalyzedExistingGroup[],
  tabsById: ReadonlyMap<number, TabMetadata>,
): AnalyzedExistingGroup | undefined {
  if (profiles.length === 0) return undefined;

  const tabTokens = tokenizeTitle(tab.title);
  const tabStrongTokens = tabTokens.filter((t) => !isBannedStandaloneTitleWord(t));
  const tabConcept =
    classifyTabConcept(tab, domainInfo, {
      ignoreHostPrior: Boolean(platformMatch),
    })?.conceptId ?? null;
  const isMediaBucket = Boolean(platformMatch && isMediaPlatformBucket(platformMatch.bucketKey));

  // 1. Opener lineage with cycle protection + launchpad/concept isolation
  let current: TabMetadata | undefined = tab;
  const visitedOpeners = new Set<number>([tab.id]);
  while (current && typeof current.openerTabId === 'number') {
    const parentId = current.openerTabId;
    if (visitedOpeners.has(parentId)) break;
    visitedOpeners.add(parentId);
    const parentTab = tabsById.get(parentId);
    const matchingByOpener = profiles.find(
      (p) => p.memberTabIds.has(parentId) || p.addedTabIds.includes(parentId),
    );
    if (matchingByOpener) {
      const parentIsFeed = parentTab
        ? isHomepageFeedUrl(parentTab.url, extractDomainInfo(parentTab.url))
        : false;
      const conceptConflict = Boolean(
        tabConcept &&
          matchingByOpener.primaryConcept &&
          tabConcept !== matchingByOpener.primaryConcept,
      );

      let incompatibleTopicMedia = false;
      if (isMediaBucket && !matchingByOpener.isGenericMediaContainer) {
        if (matchingByOpener.primaryConcept && tabConcept !== matchingByOpener.primaryConcept) {
          incompatibleTopicMedia = true;
        }
      }

      if (!parentIsFeed && !conceptConflict && !incompatibleTopicMedia) {
        return matchingByOpener;
      }
      break;
    }
    current = parentTab;
  }

  // 2. Shared ticket / PR identifier
  const tabTickets = extractTicketIdentifiers(tab.title);
  if (tabTickets.length > 0) {
    const matchingByTicket = profiles.find((p) =>
      tabTickets.some((tk) => p.ticketIds.has(tk)),
    );
    if (matchingByTicket) {
      return matchingByTicket;
    }
  }

  // 3. Matched rule title
  if (matchedRule) {
    const ruleNameLower = matchedRule.name.toLowerCase().trim();
    const matchingByRuleTitle = profiles.find((p) => p.normalizedTitle === ruleNameLower);
    if (matchingByRuleTitle) {
      return matchingByRuleTitle;
    }
  }

  // 4. Platform cluster match (concept/entity-aware for YouTube/Media groups so topics never cross-contaminate)
  if (platformMatch) {
    const platformTitleLower = platformMatch.groupName.toLowerCase().trim();

    if (isMediaBucket) {
      const mediaProfiles = profiles.filter(
        (p) =>
          p.platformBucketKeys.has(platformMatch.bucketKey) ||
          p.platformBucketKeys.has('platform:media:youtube') ||
          p.platformBucketKeys.has('platform:media:media-and-audio') ||
          p.normalizedTitle === platformTitleLower ||
          p.normalizedTitle === 'media & audio' ||
          p.normalizedTitle.startsWith('youtube'),
      );

      if (mediaProfiles.length > 0) {
        // 4a. Strong entity/lexical match with an existing topic-specific media group
        let bestScored: { profile: AnalyzedExistingGroup; score: number } | null = null;
        for (const p of mediaProfiles) {
          if (tabConcept && p.primaryConcept && tabConcept !== p.primaryConcept) {
            continue;
          }
          let sharedStrong = 0;
          for (const tok of tabStrongTokens) {
            if (p.titleTokens.includes(tok) || p.memberTokens.has(tok)) {
              sharedStrong++;
            }
          }
          const titleJacc = computeJaccardSimilarity(tabTokens, p.titleTokens);
          if (sharedStrong >= 2 || titleJacc >= 0.45) {
            const score = sharedStrong * 2 + titleJacc;
            if (!bestScored || score > bestScored.score) {
              bestScored = { profile: p, score };
            }
          }
        }
        if (bestScored) return bestScored.profile;

        // 4b. Matching semantic concept with an existing media group
        if (tabConcept) {
          const ruLabel = getConceptDisplayMeta(tabConcept, true).label.toLowerCase();
          const enLabel = getConceptDisplayMeta(tabConcept, false).label.toLowerCase();
          const ruShort = getShortConceptLabel(tabConcept, true).toLowerCase();
          const enShort = getShortConceptLabel(tabConcept, false).toLowerCase();
          const conceptMatch = mediaProfiles.find(
            (p) =>
              p.primaryConcept === tabConcept ||
              p.normalizedTitle.includes(ruLabel) ||
              p.normalizedTitle.includes(enLabel) ||
              p.normalizedTitle.startsWith(`youtube · ${ruShort}`) ||
              p.normalizedTitle.startsWith(`youtube · ${enShort}`),
          );
          if (conceptMatch) return conceptMatch;
        }

        // 4c. Generic media container ONLY: avoid dumping clearly-categorized videos into "YouTube · Другое"/"Other"
        const genericMediaMatch = mediaProfiles.find(
          (p) =>
            p.isGenericMediaContainer &&
            (!tabConcept ||
              (p.normalizedTitle !== 'youtube · другое' &&
                p.normalizedTitle !== 'youtube другое' &&
                p.normalizedTitle !== 'youtube · other' &&
                p.normalizedTitle !== 'youtube other')),
        );
        if (genericMediaMatch) return genericMediaMatch;
      }
    } else {
      const exactPlatformMatch = profiles.find(
        (p) =>
          p.platformBucketKeys.has(platformMatch.bucketKey) ||
          p.normalizedTitle === platformTitleLower ||
          ((platformMatch.bucketKey.startsWith('platform:gworkspace:') ||
            platformMatch.bucketKey.startsWith('platform:workspace:')) &&
            (p.normalizedTitle === 'google workspace' ||
              [...p.platformBucketKeys].some(
                (k) => k.startsWith('platform:gworkspace:') || k.startsWith('platform:workspace:'),
              ))),
      );
      if (exactPlatformMatch) {
        return exactPlatformMatch;
      }
    }
  }

  // 5. Domain / brand / canonical alias / homogeneous group match (non-platform tabs only)
  // Blocking platform tabs here stops brand:youtube or brand:github from cross-contaminating topic/repo groups!
  if (!platformMatch) {
    const domainMeta = formatDomainGroupMeta(domainInfo.rootDomain, undefined, domainInfo.hostname);
    const brandLower = domainMeta.groupName.toLowerCase().trim();
    const rootDomainLower = domainInfo.rootDomain.toLowerCase();
    const domainShortLower = (domainInfo.rootDomain.split('.')[0] ?? '').toLowerCase();

    for (const profile of profiles) {
      if (
        profile.normalizedTitle === brandLower ||
        profile.normalizedTitle === rootDomainLower ||
        (domainShortLower && profile.normalizedTitle === domainShortLower) ||
        (domainMeta.canonicalKey && profile.canonicalKeys.has(domainMeta.canonicalKey))
      ) {
        return profile;
      }

      if (profile.rootDomains.size === 1 && profile.rootDomains.has(domainInfo.rootDomain)) {
        if (profile.platformBucketKeys.size === 0) {
          return profile;
        }
      }
    }
  }

  // 6. Jaccard similarity (> 0.45) against existing non-conflicting group title
  if (tabTokens.length > 0 && !isMediaBucket) {
    for (const profile of profiles) {
      if (tabConcept && profile.primaryConcept && tabConcept !== profile.primaryConcept) {
        continue;
      }
      if (
        profile.titleTokens.length > 0 &&
        computeJaccardSimilarity(tabTokens, profile.titleTokens) > 0.45
      ) {
        return profile;
      }
    }
  }

  // 7. Concept-named existing group match (e.g. new claude.ai tab -> existing "AI & LLM")
  if (tabConcept && !isMediaBucket) {
    const ruLabel = getConceptDisplayMeta(tabConcept, true).label.toLowerCase();
    const enLabel = getConceptDisplayMeta(tabConcept, false).label.toLowerCase();
    const conceptGroupMatch = profiles.find(
      (p) =>
        p.normalizedTitle === ruLabel ||
        p.normalizedTitle === enLabel ||
        p.normalizedTitle.startsWith(`${ruLabel} (`) ||
        p.normalizedTitle.startsWith(`${enLabel} (`),
    );
    if (conceptGroupMatch) {
      return conceptGroupMatch;
    }
  }

  return undefined;
}

export function findEffectiveOpenerGroup(
  tabId: number,
  tabsById: ReadonlyMap<number, TabMetadata>,
  tabToGroupMap: ReadonlyMap<number, ProposedGroup>,
): ProposedGroup | undefined {
  const visited = new Set<number>([tabId]);
  let current = tabsById.get(tabId);

  while (current && typeof current.openerTabId === 'number') {
    const parentId = current.openerTabId;
    if (visited.has(parentId)) break;
    visited.add(parentId);

    const parentGroup = tabToGroupMap.get(parentId);
    if (parentGroup) {
      return parentGroup;
    }
    current = tabsById.get(parentId);
  }

  return undefined;
}
