import type { TabUndoEntry } from '../domain/types';
import type { BrowserTabsPort } from '../ports/browser-tabs.port';
import type { SettingsRepositoryPort } from '../ports/settings-repository.port';

export interface UndoLastSortResult {
  restored: boolean;
  restoredTabsCount: number;
  restoredGroupsCount: number;
  reason?: string;
}

export class UndoLastSortUseCase {
  constructor(
    private readonly tabsPort: BrowserTabsPort,
    private readonly settingsRepo: SettingsRepositoryPort,
  ) {}

  async execute(): Promise<UndoLastSortResult> {
    const snapshot = await this.settingsRepo.loadUndoSnapshot();
    if (!snapshot || snapshot.entries.length === 0) {
      return {
        restored: false,
        restoredTabsCount: 0,
        restoredGroupsCount: 0,
        reason: 'Nothing to undo.',
      };
    }

    const currentTabs = await this.tabsPort.getWindowTabs(snapshot.windowId);
    const survivingById = new Map(currentTabs.map((t) => [t.id, t]));
    const survivingEntries = snapshot.entries.filter((e) => survivingById.has(e.tabId));

    if (survivingEntries.length === 0) {
      await this.settingsRepo.clearUndoSnapshot();
      return {
        restored: false,
        restoredTabsCount: 0,
        restoredGroupsCount: 0,
        reason: 'Previously tracked tabs are no longer open.',
      };
    }

    // 1. Detach surviving tabs from current groups before restoring original order
    const currentlyGroupedIds = survivingEntries
      .filter((e) => {
        const tab = survivingById.get(e.tabId);
        return tab !== undefined && typeof tab.groupId === 'number' && tab.groupId >= 0;
      })
      .map((e) => e.tabId);

    if (currentlyGroupedIds.length > 0) {
      await this.tabsPort.ungroupTabs(currentlyGroupedIds);
    }

    // 2. Restore original tab strip order
    const sortedByOriginalIndex = [...survivingEntries].sort((a, b) => a.index - b.index);
    for (const entry of sortedByOriginalIndex) {
      await this.tabsPort.moveTab(entry.tabId, entry.index);
    }

    // 3. Recreate previous Chrome Tab Groups with original title, color, and collapsed state
    const entriesByPreviousGroup = new Map<number, TabUndoEntry[]>();
    for (const entry of sortedByOriginalIndex) {
      if (entry.previousGroupId >= 0) {
        const list = entriesByPreviousGroup.get(entry.previousGroupId) ?? [];
        list.push(entry);
        entriesByPreviousGroup.set(entry.previousGroupId, list);
      }
    }

    let restoredGroupsCount = 0;
    for (const groupEntries of entriesByPreviousGroup.values()) {
      const tabIds = groupEntries.map((e) => e.tabId);
      const sample = groupEntries[0];
      if (tabIds.length === 0 || !sample) continue;

      await this.tabsPort.createTabGroup(snapshot.windowId, tabIds, {
        title: sample.groupTitle ?? '',
        color: sample.groupColor ?? 'grey',
        collapsed: Boolean(sample.groupCollapsed),
      });
      restoredGroupsCount++;
    }

    await this.settingsRepo.clearUndoSnapshot();

    return {
      restored: true,
      restoredTabsCount: survivingEntries.length,
      restoredGroupsCount,
    };
  }
}
