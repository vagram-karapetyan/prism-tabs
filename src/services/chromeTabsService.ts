import { extractDomainInfo } from '../engine/deterministic';
import {
  ChromeTabGroupColor,
  ExistingTabGroup,
  GroupingPlan,
  TabMetadata,
  TabUndoEntry,
  UndoSnapshot,
} from '../engine/types';

/**
 * Standard browser New Tab / blank URL patterns for Chrome, Edge, Brave, Vivaldi & Opera.
 */
const EMPTY_TAB_URL_PATTERNS = [
  /^chrome:\/\/newtab\/?$/i,
  /^chrome:\/\/new-tab-page\/?$/i,
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
 * Checks whether a tab is an unpinned YouTube homepage tab (e.g. https://www.youtube.com/ or https://m.youtube.com/).
 * Matches only root/homepage visits, never specific videos (/watch?v=...), channels, shorts, or playlists.
 */
export function isYouTubeHomeTab(tab: {
  url?: string;
  pendingUrl?: string;
  pinned?: boolean;
}): boolean {
  if (tab.pinned) return false;

  const raw = (tab.url || tab.pendingUrl || '').trim();
  if (!raw) return false;

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'youtube.com' && host !== 'm.youtube.com') {
      return false;
    }
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    // Matches root '/' or '/feed/trending' etc. if bare, but specifically root homepage
    return (
      path === '/' &&
      !parsed.searchParams.has('v') &&
      !parsed.searchParams.has('list') &&
      !parsed.searchParams.has('search_query')
    );
  } catch {
    return false;
  }
}

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
 * Evaluates whether a tab is disposable based on user cleanup settings.
 */
export function isDisposableTab(
  tab: { url?: string; pendingUrl?: string; title?: string; pinned?: boolean },
  options: { closeEmptyTabs?: boolean; closeYouTubeHomeTabs?: boolean } = {}
): boolean {
  if (tab.pinned) return false;
  if (options.closeEmptyTabs !== false && isEmptyBrowserTab(tab)) {
    return true;
  }
  if (options.closeYouTubeHomeTabs && isYouTubeHomeTab(tab)) {
    return true;
  }
  return false;
}

/**
 * Checks whether the current window has any real groupable web tabs outside existing Chrome tab groups.
 * Excludes pinned tabs, empty New Tabs, and internal browser pages (`chrome://`, `edge://`, `about:`).
 */
export function hasUngroupedGroupableWebTabs(
  windowTabs: TabMetadata[],
  existingGroups: ExistingTabGroup[],
  cleanupOptions: { closeEmptyTabs?: boolean; closeYouTubeHomeTabs?: boolean } = {}
): boolean {
  const groupedIds = new Set(existingGroups.flatMap((eg) => eg.tabIds));
  return windowTabs.some(
    (t) =>
      !t.pinned &&
      !isDisposableTab(t, cleanupOptions) &&
      !extractDomainInfo(t.url).isInternalBrowserUrl &&
      !groupedIds.has(t.id)
  );
}

/**
 * Closes all unpinned disposable tabs (empty "New Tab" / YouTube home) strictly in the current active window.
 * If every single tab in the window matches, keeps 1 tab open so the browser window itself isn't closed.
 */
export async function closeDisposableTabsInWindow(options: {
  closeEmptyTabs?: boolean;
  closeYouTubeHomeTabs?: boolean;
}): Promise<number> {
  const shouldCloseEmpty = options.closeEmptyTabs !== false;
  const shouldCloseYt = Boolean(options.closeYouTubeHomeTabs);

  if (!shouldCloseEmpty && !shouldCloseYt) return 0;

  if (!isChromeTabsAvailable()) {
    const disposableIds = demoTabState
      .filter((t) => isDisposableTab(t, { closeEmptyTabs: shouldCloseEmpty, closeYouTubeHomeTabs: shouldCloseYt }))
      .map((t) => t.id);
    if (disposableIds.length === 0) return 0;

    const idsToClose =
      disposableIds.length >= demoTabState.length ? disposableIds.slice(1) : disposableIds;
    if (idsToClose.length === 0) return 0;

    const removeSet = new Set(idsToClose);
    demoTabState = demoTabState.filter((t) => !removeSet.has(t.id));
    return idsToClose.length;
  }

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const disposableTabIds = tabs
    .filter(
      (t): t is chrome.tabs.Tab & { id: number } =>
        typeof t.id === 'number' &&
        isDisposableTab(t, { closeEmptyTabs: shouldCloseEmpty, closeYouTubeHomeTabs: shouldCloseYt })
    )
    .map((t) => t.id);

  if (disposableTabIds.length === 0) {
    return 0;
  }

  // Keep 1 tab alive if 100% of tabs in the window are disposable
  const idsToRemove =
    disposableTabIds.length >= tabs.length ? disposableTabIds.slice(1) : disposableTabIds;

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
 * Backward compatibility alias for closeEmptyTabsInWindow
 */
export async function closeEmptyTabsInWindow(): Promise<number> {
  return closeDisposableTabsInWindow({ closeEmptyTabs: true, closeYouTubeHomeTabs: false });
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
    groupId: 1,
    index: 1,
  },
  {
    id: 103,
    title: 'React 19 release overview and migration strategy — React Blog',
    url: 'https://react.dev/blog/2024/04/25/react-19',
    pinned: false,
    groupId: -1,
    index: 2,
  },
  {
    id: 104,
    title: 'Vite 6 architecture roadmap and breaking changes · vitejs/vite Discussion #1488',
    url: 'https://github.com/vitejs/vite/discussions/1488',
    pinned: false,
    groupId: 1,
    index: 3,
  },
  {
    id: 105,
    title: 'Groq Cloud Console — API Keys & Rate Limits dashboard',
    url: 'https://console.groq.com/keys',
    pinned: false,
    groupId: -1,
    index: 4,
  },
  {
    id: 106,
    title: 'Llama 3.3 70B Versatile performance benchmark and JSON mode guide · Groq Docs',
    url: 'https://console.groq.com/docs/models/llama-3.3-70b-versatile',
    pinned: false,
    groupId: -1,
    index: 5,
  },
];

let demoTabState: TabMetadata[] = [...DEMO_TABS];

function isChromeTabsAvailable(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.tabs !== 'undefined' &&
    typeof chrome.tabs.query === 'function'
  );
}

function isChromeTabGroupsAvailable(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.tabGroups !== 'undefined' &&
    typeof chrome.tabGroups.query === 'function'
  );
}

/**
 * Queries all tabs strictly in the current active window.
 */
export async function getCurrentWindowTabs(): Promise<TabMetadata[]> {
  if (!isChromeTabsAvailable()) {
    return [...demoTabState];
  }

  const chromeTabs = await chrome.tabs.query({ currentWindow: true });
  return chromeTabs
    .filter(
      (t): t is chrome.tabs.Tab & { id: number } => typeof t.id === 'number'
    )
    .map((t) => ({
      id: t.id,
      title: t.title || 'Untitled Tab',
      url: t.url || t.pendingUrl || '',
      favIconUrl: t.favIconUrl,
      pinned: t.pinned,
      groupId:
        typeof t.groupId === 'number' &&
        t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE &&
        t.groupId > 0
          ? t.groupId
          : -1,
      openerTabId: t.openerTabId,
      index: t.index,
      lastAccessed: (t as unknown as { lastAccessed?: number }).lastAccessed,
    }));
}

/**
 * Queries existing native Chrome Tab Groups in the current active window.
 */
export async function getCurrentWindowTabGroups(
  tabsInWindow?: TabMetadata[]
): Promise<ExistingTabGroup[]> {
  if (!isChromeTabGroupsAvailable()) {
    const demoGroupTabs = demoTabState.filter((t) => (t.groupId ?? -1) > 0);
    if (demoGroupTabs.length === 0) return [];
    return [
      {
        id: 1,
        title: '📁 Prism GitHub',
        cleanTitle: 'Prism GitHub',
        emoji: '📁',
        color: 'purple',
        collapsed: false,
        tabIds: demoGroupTabs.map((t) => t.id),
      },
    ];
  }

  const windowTabs = tabsInWindow ?? (await getCurrentWindowTabs());
  const tabsByGroupId = new Map<number, number[]>();
  for (const t of windowTabs) {
    if (t.groupId && t.groupId > 0) {
      const list = tabsByGroupId.get(t.groupId) ?? [];
      list.push(t.id);
      tabsByGroupId.set(t.groupId, list);
    }
  }

  try {
    const rawGroups = await chrome.tabGroups.query({
      windowId: chrome.windows.WINDOW_ID_CURRENT,
    });

    return rawGroups.map((g) => {
      const tabIds = tabsByGroupId.get(g.id) ?? [];
      const rawTitle = g.title || '';
      const emojiMatch = rawTitle.match(
        /^(\p{Extended_Pictographic}|\p{Emoji_Presentation})\s*/u
      );
      const cleanTitle = emojiMatch
        ? rawTitle.slice(emojiMatch[0].length).trim()
        : rawTitle.trim();

      return {
        id: g.id,
        title: rawTitle,
        cleanTitle: cleanTitle || rawTitle || 'Group',
        emoji: emojiMatch ? emojiMatch[1] : undefined,
        color: (g.color as ChromeTabGroupColor) || 'grey',
        collapsed: Boolean(g.collapsed),
        tabIds,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Live updates a Chrome Tab Group's visual attributes (title, color, collapsed state).
 */
export async function updateLiveChromeTabGroup(
  groupId: number,
  updates: {
    title?: string;
    color?: ChromeTabGroupColor;
    collapsed?: boolean;
  }
): Promise<void> {
  if (!isChromeTabGroupsAvailable()) {
    return;
  }

  try {
    const safeUpdates: chrome.tabGroups.UpdateProperties = {};
    if (typeof updates.title === 'string') {
      safeUpdates.title = updates.title;
    }
    if (updates.color) {
      safeUpdates.color = updates.color;
    }
    if (typeof updates.collapsed === 'boolean') {
      safeUpdates.collapsed = updates.collapsed;
    }
    await chrome.tabGroups.update(groupId, safeUpdates);
  } catch {
    // Group may have been closed in Chrome
  }
}

/**
 * Ungroups specific tabs from their Chrome Tab Groups.
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
    // Tabs may no longer exist
  }
}

/**
 * Dissolves all Chrome Tab Groups strictly in the current active window.
 */
export async function ungroupAllTabsInWindow(): Promise<number> {
  if (!isChromeTabsAvailable()) {
    const count = demoTabState.filter((t) => (t.groupId ?? -1) > 0).length;
    demoTabState = demoTabState.map((t) => ({ ...t, groupId: -1 }));
    return count;
  }

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const groupedIds = tabs
    .filter(
      (t) =>
        typeof t.id === 'number' &&
        typeof t.groupId === 'number' &&
        t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE &&
        t.groupId > -1
    )
    .map((t) => t.id as number);

  if (groupedIds.length > 0) {
    await chrome.tabs.ungroup(groupedIds);
  }
  return groupedIds.length;
}

/**
 * Captures an undo snapshot of all tab positions and group assignments in the current window.
 */
export async function captureUndoSnapshot(): Promise<UndoSnapshot> {
  if (!isChromeTabsAvailable()) {
    return {
      timestamp: Date.now(),
      windowId: 1,
      entries: demoTabState.map((t, idx) => ({
        tabId: t.id,
        index: idx,
        previousGroupId: t.groupId ?? -1,
        groupTitle: (t.groupId ?? -1) > 0 ? '📁 Prism GitHub' : undefined,
        groupColor: (t.groupId ?? -1) > 0 ? 'purple' : undefined,
        groupCollapsed: false,
      })),
    };
  }

  const [tabs, groups] = await Promise.all([
    chrome.tabs.query({ currentWindow: true }),
    isChromeTabGroupsAvailable()
      ? chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT })
      : Promise.resolve([]),
  ]);

  const groupByGroupId = new Map<number, chrome.tabGroups.TabGroup>();
  for (const g of groups) {
    groupByGroupId.set(g.id, g);
  }

  const entries: TabUndoEntry[] = tabs
    .filter(
      (t): t is chrome.tabs.Tab & { id: number } => typeof t.id === 'number'
    )
    .map((t) => {
      const g =
        typeof t.groupId === 'number' && t.groupId > 0
          ? groupByGroupId.get(t.groupId)
          : undefined;

      return {
        tabId: t.id,
        index: t.index,
        previousGroupId: t.groupId ?? -1,
        groupTitle: g?.title,
        groupColor: (g?.color as ChromeTabGroupColor) || undefined,
        groupCollapsed: g?.collapsed,
      };
    });

  const windowId = tabs[0]?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;

  return {
    timestamp: Date.now(),
    windowId,
    entries,
  };
}

/**
 * Restores a captured `UndoSnapshot`.
 */
export async function restoreUndoSnapshot(snapshot: UndoSnapshot): Promise<void> {
  if (!isChromeTabsAvailable()) {
    demoTabState = [...DEMO_TABS];
    return;
  }

  const currentTabs = await chrome.tabs.query({ currentWindow: true });
  const windowId = currentTabs[0]?.windowId;
  const currentTabIds = new Set(
    currentTabs.map((t) => t.id).filter((id): id is number => typeof id === 'number')
  );

  const validEntries = snapshot.entries.filter((e) =>
    currentTabIds.has(e.tabId)
  );
  if (validEntries.length === 0) return;

  const tabIdsToUngroup = validEntries.map((e) => e.tabId);
  try {
    await chrome.tabs.ungroup(tabIdsToUngroup);
  } catch {
    // Ignore if not in groups
  }

  const sortedByIndex = [...validEntries].sort((a, b) => a.index - b.index);
  for (let i = 0; i < sortedByIndex.length; i++) {
    const entry = sortedByIndex[i];
    try {
      await chrome.tabs.move(entry.tabId, { index: i });
    } catch {
      // Continue re-ordering
    }
  }

  const originalGroups = new Map<
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
      const existing = originalGroups.get(entry.previousGroupId);
      if (existing) {
        existing.tabIds.push(entry.tabId);
      } else {
        originalGroups.set(entry.previousGroupId, {
          tabIds: [entry.tabId],
          title: entry.groupTitle,
          color: entry.groupColor,
          collapsed: entry.groupCollapsed,
        });
      }
    }
  }

  for (const g of originalGroups.values()) {
    if (g.tabIds.length === 0) continue;
    try {
      const newGroupId = await chrome.tabs.group({
        tabIds: g.tabIds,
        createProperties:
          typeof windowId === 'number' && windowId >= 0
            ? { windowId }
            : undefined,
      });

      await chrome.tabGroups.update(newGroupId, {
        title: g.title ?? '',
        color: g.color ?? 'grey',
        collapsed: Boolean(g.collapsed),
      });
    } catch {
      // Chrome tab group error handling
    }
  }
}

/**
 * Applies a `GroupingPlan` to the browser with smooth choreography:
 * 1. Resolves tabs per group.
 * 2. Glides tabs into position and creates/updates native Chrome tab groups.
 * 3. Applies color and emoji title.
 * 4. Automatically collapses inactive groups if option is enabled.
 */
export async function applyGroupingPlan(
  plan: GroupingPlan,
  options: {
    collapseInactiveGroups?: boolean;
    staggerMs?: number;
    onProgress?: (progress: {
      activeGroupId: string | null;
      activeTabId: number | null;
      completedGroupIds: string[];
      completedGroups: number;
      totalGroups: number;
      progressRatio: number;
      phase: 'idle' | 'gliding' | 'merging' | 'grouping' | 'complete';
    }) => void;
  } = {}
): Promise<void> {
  const {
    collapseInactiveGroups = true,
    staggerMs = 28,
    onProgress,
  } = options;

  const groups = plan.groups;
  const total = groups.length;
  if (total === 0) return;

  const completedGroupIds: string[] = [];

  const updateProgress = (
    activeGroupId: string | null,
    activeTabId: number | null,
    phase: 'idle' | 'gliding' | 'merging' | 'grouping' | 'complete'
  ) => {
    if (!onProgress) return;
    const completedGroups = completedGroupIds.length;
    const progressRatio = total > 0 ? completedGroups / total : 1;
    onProgress({
      activeGroupId,
      activeTabId,
      completedGroupIds: [...completedGroupIds],
      completedGroups,
      totalGroups: total,
      progressRatio,
      phase,
    });
  };

  updateProgress(null, null, 'gliding');

  let activeWindowTabId: number | null = null;
  if (isChromeTabsAvailable()) {
    try {
      const activeTabs = await chrome.tabs.query({
        currentWindow: true,
        active: true,
      });
      activeWindowTabId = activeTabs[0]?.id ?? null;
    } catch {
      activeWindowTabId = null;
    }
  }

  for (let i = 0; i < total; i++) {
    const group = groups[i];
    updateProgress(
      group.id,
      group.tabIds[0] ?? null,
      typeof group.existingGroupId === 'number' ? 'merging' : 'grouping'
    );

    if (isChromeTabsAvailable() && isChromeTabGroupsAvailable()) {
      try {
        let chromeGroupId: number;
        if (typeof group.existingGroupId === 'number') {
          chromeGroupId = group.existingGroupId;
          const newTabs = (group.addedTabIds ?? []).filter((id) =>
            group.tabIds.includes(id)
          );
          if (newTabs.length > 0) {
            await chrome.tabs.group({
              groupId: chromeGroupId,
              tabIds: newTabs,
            });
          }
        } else {
          chromeGroupId = await chrome.tabs.group({
            tabIds: group.tabIds,
          });
          group.existingGroupId = chromeGroupId;
        }

        const titleWithEmoji = `${group.emoji} ${group.groupName}`.trim();
        const hasActiveTab =
          activeWindowTabId !== null &&
          group.tabIds.includes(activeWindowTabId);

        const shouldCollapse = collapseInactiveGroups && !hasActiveTab;

        await chrome.tabGroups.update(chromeGroupId, {
          title: titleWithEmoji,
          color: group.color,
          collapsed: shouldCollapse,
        });
      } catch {
        // Grouping operation safely handled
      }
    } else {
      // Demo state update
      const targetId = typeof group.existingGroupId === 'number' ? group.existingGroupId : i + 10;
      group.existingGroupId = targetId;
      demoTabState = demoTabState.map((t) =>
        group.tabIds.includes(t.id) ? { ...t, groupId: targetId } : t
      );
    }

    completedGroupIds.push(group.id);

    if (staggerMs > 0 && i < total - 1) {
      await new Promise((res) => setTimeout(res, staggerMs));
    }
  }

  updateProgress(null, null, 'complete');
}
