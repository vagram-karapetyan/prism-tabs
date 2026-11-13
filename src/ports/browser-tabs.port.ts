import type { ChromeTabGroupColor, ExistingTabGroup, TabMetadata } from '../domain/types';

export interface GroupCreateOptions {
  title: string;
  color: ChromeTabGroupColor;
  collapsed: boolean;
}

export interface GroupUpdateOptions {
  title?: string;
  color?: ChromeTabGroupColor;
  collapsed?: boolean;
}

export interface BrowserTabsPort {
  getCurrentWindowId(): Promise<number>;
  getWindowTabs(windowId: number): Promise<TabMetadata[]>;
  getWindowTabGroups(windowId: number): Promise<ExistingTabGroup[]>;
  createTabGroup(
    windowId: number,
    tabIds: number[],
    options: GroupCreateOptions,
  ): Promise<number>;
  addTabsToGroup(groupId: number, tabIds: number[]): Promise<void>;
  updateTabGroup(groupId: number, updates: GroupUpdateOptions): Promise<void>;
  ungroupTabs(tabIds: number[]): Promise<void>;
  moveTab(tabId: number, index: number): Promise<void>;
  closeTabs(tabIds: number[]): Promise<void>;
  discardTab(tabId: number): Promise<boolean>;
}
