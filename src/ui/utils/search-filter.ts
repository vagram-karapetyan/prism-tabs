import { type ExistingTabGroup, type TabMetadata } from '../../domain/types';

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

export interface FilteredGroupEntry {
  group: ExistingTabGroup;
  tabs: TabMetadata[];
  titleMatched: boolean;
}

export interface SearchFilterResult {
  groups: FilteredGroupEntry[];
  ungroupedTabs: TabMetadata[];
  matchedTabCount: number;
  totalMatchedItems: number;
}

/**
 * Splits text into matched and unmatched segments for case-insensitive highlighting.
 */
export function splitHighlightSegments(text: string, query: string): HighlightSegment[] {
  const trimmed = query.trim();
  if (!trimmed || !text) {
    return [{ text, matched: false }];
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const segments: HighlightSegment[] = [];

  let cursor = 0;
  let matchIndex = lowerText.indexOf(lowerQuery, cursor);

  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      segments.push({ text: text.slice(cursor, matchIndex), matched: false });
    }
    const matchEnd = matchIndex + lowerQuery.length;
    segments.push({ text: text.slice(matchIndex, matchEnd), matched: true });
    cursor = matchEnd;
    matchIndex = lowerText.indexOf(lowerQuery, cursor);
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), matched: false });
  }

  return segments.length > 0 ? segments : [{ text, matched: false }];
}

function matchesTab(tab: TabMetadata, normalizedQuery: string): boolean {
  return (
    tab.title.toLowerCase().includes(normalizedQuery) ||
    tab.url.toLowerCase().includes(normalizedQuery)
  );
}

/**
 * Filters browser groups and ungrouped tabs by search query against group title, tab title, and URL.
 */
export function filterTabsAndGroups(
  tabs: readonly TabMetadata[],
  groups: readonly ExistingTabGroup[],
  query: string,
): SearchFilterResult {
  const normalizedQuery = query.trim().toLowerCase();

  const tabsByGroup = new Map<number, TabMetadata[]>();
  const ungroupedTabs: TabMetadata[] = [];

  for (const tab of tabs) {
    if (tab.groupId === undefined || tab.groupId < 0) {
      ungroupedTabs.push(tab);
      continue;
    }
    const list = tabsByGroup.get(tab.groupId);
    if (list) {
      list.push(tab);
    } else {
      tabsByGroup.set(tab.groupId, [tab]);
    }
  }

  if (!normalizedQuery) {
    const allGroups: FilteredGroupEntry[] = groups
      .map((group) => ({
        group,
        tabs: tabsByGroup.get(group.id) ?? [],
        titleMatched: false,
      }))
      .filter((entry) => entry.tabs.length > 0);

    return {
      groups: allGroups,
      ungroupedTabs,
      matchedTabCount: tabs.length,
      totalMatchedItems: tabs.length,
    };
  }

  const filteredGroups: FilteredGroupEntry[] = [];
  let matchedTabCount = 0;
  let titleMatchedGroups = 0;

  for (const group of groups) {
    const groupTabs = tabsByGroup.get(group.id) ?? [];
    if (groupTabs.length === 0) continue;

    const titleMatched = group.title.toLowerCase().includes(normalizedQuery);
    const matchingTabs = groupTabs.filter((tab) => matchesTab(tab, normalizedQuery));

    if (titleMatched) {
      titleMatchedGroups += 1;
    }

    if (titleMatched || matchingTabs.length > 0) {
      const visibleTabs = matchingTabs.length > 0 ? matchingTabs : groupTabs;
      matchedTabCount += matchingTabs.length;
      filteredGroups.push({
        group,
        tabs: visibleTabs,
        titleMatched,
      });
    }
  }

  const filteredUngrouped = ungroupedTabs.filter((tab) => matchesTab(tab, normalizedQuery));
  matchedTabCount += filteredUngrouped.length;

  return {
    groups: filteredGroups,
    ungroupedTabs: filteredUngrouped,
    matchedTabCount,
    totalMatchedItems: matchedTabCount + titleMatchedGroups,
  };
}
