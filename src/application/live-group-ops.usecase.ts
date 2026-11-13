import type { ChromeTabGroupColor, ExistingTabGroup, TabMetadata } from '../domain/types';
import type { BrowserTabsPort } from '../ports/browser-tabs.port';

export interface WindowStateSnapshot {
  ok: boolean;
  reason?: string;
  tabs: TabMetadata[];
  groups: ExistingTabGroup[];
}

export class LiveGroupOpsUseCase {
  constructor(private readonly tabsPort: BrowserTabsPort) {}

  private async fetchSnapshot(
    windowId: number,
    ok = true,
    reason?: string,
  ): Promise<WindowStateSnapshot> {
    const [tabs, groups] = await Promise.all([
      this.tabsPort.getWindowTabs(windowId),
      this.tabsPort.getWindowTabGroups(windowId),
    ]);
    return { ok, reason, tabs, groups };
  }

  async renameGroup(
    windowId: number,
    groupId: number,
    newTitle: string,
  ): Promise<WindowStateSnapshot> {
    const groups = await this.tabsPort.getWindowTabGroups(windowId);
    if (!groups.some((g) => g.id === groupId)) {
      return this.fetchSnapshot(windowId, false, 'Group was closed or no longer exists.');
    }
    await this.tabsPort.updateTabGroup(groupId, { title: newTitle.trim() });
    return this.fetchSnapshot(windowId, true);
  }

  async recolorGroup(
    windowId: number,
    groupId: number,
    color: ChromeTabGroupColor,
  ): Promise<WindowStateSnapshot> {
    const groups = await this.tabsPort.getWindowTabGroups(windowId);
    if (!groups.some((g) => g.id === groupId)) {
      return this.fetchSnapshot(windowId, false, 'Group was closed or no longer exists.');
    }
    await this.tabsPort.updateTabGroup(groupId, { color });
    return this.fetchSnapshot(windowId, true);
  }

  async ungroupSingleGroup(windowId: number, groupId: number): Promise<WindowStateSnapshot> {
    const groups = await this.tabsPort.getWindowTabGroups(windowId);
    const target = groups.find((g) => g.id === groupId);
    if (!target || target.tabIds.length === 0) {
      return this.fetchSnapshot(windowId, false, 'Group was closed or already ungrouped.');
    }
    await this.tabsPort.ungroupTabs(target.tabIds);
    return this.fetchSnapshot(windowId, true);
  }

  async moveTabToGroup(
    windowId: number,
    tabId: number,
    targetGroupId: number | null,
  ): Promise<WindowStateSnapshot> {
    const [tabs, groups] = await Promise.all([
      this.tabsPort.getWindowTabs(windowId),
      this.tabsPort.getWindowTabGroups(windowId),
    ]);

    if (!tabs.some((t) => t.id === tabId)) {
      return {
        ok: false,
        reason: 'Tab was closed before move completed.',
        tabs,
        groups,
      };
    }

    if (targetGroupId === null) {
      await this.tabsPort.ungroupTabs([tabId]);
      return this.fetchSnapshot(windowId, true);
    }

    if (!groups.some((g) => g.id === targetGroupId)) {
      return {
        ok: false,
        reason: 'Target group no longer exists.',
        tabs,
        groups,
      };
    }

    await this.tabsPort.addTabsToGroup(targetGroupId, [tabId]);
    return this.fetchSnapshot(windowId, true);
  }
}
