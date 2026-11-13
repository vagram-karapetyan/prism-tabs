import type { ExistingTabGroup, TabMetadata } from '../../domain/types';
import { parseExistingGroupTitle } from '../../engine/shared/emoji-parser';
import type {
  BrowserTabsPort,
  GroupCreateOptions,
  GroupUpdateOptions,
} from '../../ports/browser-tabs.port';

function toNonEmptyTuple(ids: readonly number[]): [number, ...number[]] | null {
  const [first, ...rest] = ids;
  if (first === undefined) return null;
  return [first, ...rest];
}

function isMissingEntityError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /no (tab|group) with id|invalid tab id|tabs cannot be edited/i.test(err.message);
}

export class ChromeTabsAdapter implements BrowserTabsPort {
  async getCurrentWindowId(): Promise<number> {
    const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
    if (typeof win.id === 'number') {
      return win.id;
    }
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && typeof activeTab.windowId === 'number') {
      return activeTab.windowId;
    }
    throw new Error('Could not determine active Chromium window.');
  }

  async getWindowTabs(windowId: number): Promise<TabMetadata[]> {
    const rawTabs = await chrome.tabs.query({ windowId });
    const mapped: TabMetadata[] = [];

    for (const tab of rawTabs) {
      if (typeof tab.id !== 'number') continue;
      mapped.push({
        id: tab.id,
        title: tab.title ?? '',
        url: tab.url ?? tab.pendingUrl ?? '',
        favIconUrl: tab.favIconUrl,
        pinned: tab.pinned,
        active: tab.active,
        audible: tab.audible,
        discarded: tab.discarded,
        groupId: tab.groupId,
        openerTabId: tab.openerTabId,
        index: tab.index,
        lastAccessed: tab.lastAccessed,
      });
    }

    return mapped.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  }

  async getWindowTabGroups(windowId: number): Promise<ExistingTabGroup[]> {
    const [rawGroups, windowTabs] = await Promise.all([
      chrome.tabGroups.query({ windowId }),
      this.getWindowTabs(windowId),
    ]);

    const tabsByGroup = new Map<number, number[]>();
    for (const tab of windowTabs) {
      if (typeof tab.groupId === 'number' && tab.groupId >= 0) {
        const list = tabsByGroup.get(tab.groupId) ?? [];
        list.push(tab.id);
        tabsByGroup.set(tab.groupId, list);
      }
    }

    return rawGroups.map((g) => {
      const rawTitle = g.title ?? '';
      const parsed = parseExistingGroupTitle(rawTitle);
      return {
        id: g.id,
        title: rawTitle,
        cleanTitle: parsed.cleanTitle || rawTitle,
        emoji: parsed.emoji,
        color: g.color,
        collapsed: g.collapsed,
        tabIds: tabsByGroup.get(g.id) ?? [],
      };
    });
  }

  async createTabGroup(
    windowId: number,
    tabIds: number[],
    options: GroupCreateOptions,
  ): Promise<number> {
    const tuple = toNonEmptyTuple(tabIds);
    if (!tuple) {
      throw new Error('Cannot create tab group with zero tabs.');
    }

    const groupId = await chrome.tabs.group({
      tabIds: tuple,
      createProperties: { windowId },
    });

    await chrome.tabGroups.update(groupId, {
      title: options.title,
      color: options.color,
      collapsed: options.collapsed,
    });

    return groupId;
  }

  async addTabsToGroup(groupId: number, tabIds: number[]): Promise<void> {
    const tuple = toNonEmptyTuple(tabIds);
    if (!tuple) return;
    await chrome.tabs.group({ groupId, tabIds: tuple });
  }

  async updateTabGroup(groupId: number, updates: GroupUpdateOptions): Promise<void> {
    try {
      await chrome.tabGroups.update(groupId, updates);
    } catch (err) {
      if (!isMissingEntityError(err)) {
        throw err;
      }
    }
  }

  async ungroupTabs(tabIds: number[]): Promise<void> {
    const tuple = toNonEmptyTuple(tabIds);
    if (!tuple) return;
    try {
      await chrome.tabs.ungroup(tuple);
    } catch (err) {
      if (!isMissingEntityError(err)) {
        throw err;
      }
    }
  }

  async moveTab(tabId: number, index: number): Promise<void> {
    try {
      await chrome.tabs.move(tabId, { index });
    } catch (err) {
      if (!isMissingEntityError(err)) {
        throw err;
      }
    }
  }

  async closeTabs(tabIds: number[]): Promise<void> {
    if (tabIds.length === 0) return;
    try {
      await chrome.tabs.remove(tabIds);
    } catch (err) {
      if (!isMissingEntityError(err)) {
        throw err;
      }
    }
  }

  async discardTab(tabId: number): Promise<boolean> {
    try {
      const discarded = await chrome.tabs.discard(tabId);
      return Boolean(discarded);
    } catch {
      return false;
    }
  }
}
