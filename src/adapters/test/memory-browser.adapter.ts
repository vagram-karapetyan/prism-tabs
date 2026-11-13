import type { ChromeTabGroupColor, ExistingTabGroup, TabMetadata } from '../../domain/types';
import { parseExistingGroupTitle } from '../../engine/shared/emoji-parser';
import type {
  BrowserTabsPort,
  GroupCreateOptions,
  GroupUpdateOptions,
} from '../../ports/browser-tabs.port';

export interface MemoryTabInput extends TabMetadata {
  windowId: number;
}

interface InternalGroup {
  id: number;
  windowId: number;
  title: string;
  color: ChromeTabGroupColor;
  collapsed: boolean;
}

/**
 * In-memory Chromium Tab & TabGroup simulator for integration testing.
 * Tracks operation ordering, multi-window isolation, group lifecycles, and discards.
 */
export class MemoryBrowserAdapter implements BrowserTabsPort {
  private tabs: MemoryTabInput[] = [];
  private groups = new Map<number, InternalGroup>();
  private nextGroupId = 100;
  private activeWindowId: number;
  public readonly operationLog: string[] = [];

  constructor(
    initialTabs: readonly MemoryTabInput[] = [],
    initialGroups: readonly (Omit<ExistingTabGroup, 'cleanTitle' | 'emoji' | 'tabIds'> & {
      windowId: number;
    })[] = [],
    activeWindowId = 1,
  ) {
    this.activeWindowId = activeWindowId;
    this.tabs = initialTabs.map((t, i) => ({
      ...t,
      groupId: t.groupId ?? -1,
      index: t.index ?? i,
    }));
    for (const g of initialGroups) {
      this.groups.set(g.id, { ...g });
      if (g.id >= this.nextGroupId) {
        this.nextGroupId = g.id + 1;
      }
    }
  }

  setCurrentWindowId(windowId: number): void {
    this.activeWindowId = windowId;
  }

  getCurrentWindowId(): Promise<number> {
    return Promise.resolve(this.activeWindowId);
  }

  getWindowTabs(windowId: number): Promise<TabMetadata[]> {
    const winTabs = this.tabs
      .filter((t) => t.windowId === windowId)
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map(({ windowId: _w, ...tab }) => ({ ...tab }));
    return Promise.resolve(winTabs);
  }

  getWindowTabGroups(windowId: number): Promise<ExistingTabGroup[]> {
    const result: ExistingTabGroup[] = [];
    for (const g of this.groups.values()) {
      if (g.windowId !== windowId) continue;
      const tabIds = this.tabs
        .filter((t) => t.windowId === windowId && t.groupId === g.id)
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map((t) => t.id);

      const parsed = parseExistingGroupTitle(g.title);
      result.push({
        id: g.id,
        title: g.title,
        cleanTitle: parsed.cleanTitle || g.title,
        emoji: parsed.emoji,
        color: g.color,
        collapsed: g.collapsed,
        tabIds,
      });
    }
    return Promise.resolve(result);
  }

  createTabGroup(
    windowId: number,
    tabIds: number[],
    options: GroupCreateOptions,
  ): Promise<number> {
    if (tabIds.length === 0) {
      return Promise.reject(new Error('Cannot create group with zero tabs'));
    }
    const groupId = this.nextGroupId++;
    this.operationLog.push(`createTabGroup:${groupId}`);
    this.groups.set(groupId, {
      id: groupId,
      windowId,
      title: options.title,
      color: options.color,
      collapsed: options.collapsed,
    });

    for (const id of tabIds) {
      const tab = this.tabs.find((t) => t.id === id && t.windowId === windowId);
      if (tab) {
        tab.groupId = groupId;
      }
    }
    this.pruneEmptyGroups();
    return Promise.resolve(groupId);
  }

  addTabsToGroup(groupId: number, tabIds: number[]): Promise<void> {
    const group = this.groups.get(groupId);
    if (!group) {
      return Promise.reject(new Error(`No group with id: ${groupId}`));
    }
    this.operationLog.push(`addTabsToGroup:${groupId}`);
    for (const id of tabIds) {
      const tab = this.tabs.find((t) => t.id === id && t.windowId === group.windowId);
      if (tab) {
        tab.groupId = groupId;
      }
    }
    this.pruneEmptyGroups();
    return Promise.resolve();
  }

  updateTabGroup(groupId: number, updates: GroupUpdateOptions): Promise<void> {
    const group = this.groups.get(groupId);
    if (!group) {
      return Promise.reject(new Error(`No group with id: ${groupId}`));
    }
    this.operationLog.push(`updateTabGroup:${groupId}`);
    if (updates.title !== undefined) group.title = updates.title;
    if (updates.color !== undefined) group.color = updates.color;
    if (updates.collapsed !== undefined) group.collapsed = updates.collapsed;
    return Promise.resolve();
  }

  ungroupTabs(tabIds: number[]): Promise<void> {
    this.operationLog.push(`ungroupTabs:${tabIds.join(',')}`);
    const idSet = new Set(tabIds);
    for (const tab of this.tabs) {
      if (idSet.has(tab.id)) {
        tab.groupId = -1;
      }
    }
    this.pruneEmptyGroups();
    return Promise.resolve();
  }

  moveTab(tabId: number, targetIndex: number): Promise<void> {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return Promise.resolve();
    this.operationLog.push(`moveTab:${tabId}->${targetIndex}`);

    const sameWindow = this.tabs
      .filter((t) => t.windowId === tab.windowId)
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const currentPos = sameWindow.findIndex((t) => t.id === tabId);
    if (currentPos === -1) return Promise.resolve();

    const [removed] = sameWindow.splice(currentPos, 1);
    if (!removed) return Promise.resolve();
    const clamped =
      targetIndex < 0 ? sameWindow.length : Math.max(0, Math.min(targetIndex, sameWindow.length));
    sameWindow.splice(clamped, 0, removed);
    sameWindow.forEach((t, idx) => {
      t.index = idx;
    });
    return Promise.resolve();
  }

  closeTabs(tabIds: number[]): Promise<void> {
    this.operationLog.push(`closeTabs:${tabIds.join(',')}`);
    const idSet = new Set(tabIds);
    this.tabs = this.tabs.filter((t) => !idSet.has(t.id));
    this.reindexWindows();
    this.pruneEmptyGroups();
    return Promise.resolve();
  }

  discardTab(tabId: number): Promise<boolean> {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab || tab.active || tab.pinned || tab.audible || tab.discarded) {
      return Promise.resolve(false);
    }
    this.operationLog.push(`discardTab:${tabId}`);
    tab.discarded = true;
    return Promise.resolve(true);
  }

  /** Simulates a user manually closing a tab or group outside Prism. */
  simulateUserCloseTab(tabId: number): void {
    this.tabs = this.tabs.filter((t) => t.id !== tabId);
    this.reindexWindows();
    this.pruneEmptyGroups();
  }

  private pruneEmptyGroups(): void {
    for (const [groupId, group] of this.groups.entries()) {
      const hasMembers = this.tabs.some(
        (t) => t.windowId === group.windowId && t.groupId === groupId,
      );
      if (!hasMembers) {
        this.groups.delete(groupId);
      }
    }
  }

  private reindexWindows(): void {
    const byWindow = new Map<number, MemoryTabInput[]>();
    for (const tab of this.tabs) {
      const list = byWindow.get(tab.windowId) ?? [];
      list.push(tab);
      byWindow.set(tab.windowId, list);
    }
    for (const list of byWindow.values()) {
      list.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      list.forEach((t, idx) => {
        t.index = idx;
      });
    }
  }
}
