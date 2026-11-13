import type { BrowserTabsPort } from '../ports/browser-tabs.port';
import type { ClockPort } from '../ports/clock.port';
import type { SettingsRepositoryPort } from '../ports/settings-repository.port';
import { buildUndoSnapshot } from './undo-snapshot';

export interface UngroupAllResult {
  windowId: number;
  ungroupedCount: number;
}

export class UngroupAllUseCase {
  constructor(
    private readonly tabsPort: BrowserTabsPort,
    private readonly settingsRepo: SettingsRepositoryPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(targetWindowId?: number): Promise<UngroupAllResult> {
    const windowId = targetWindowId ?? (await this.tabsPort.getCurrentWindowId());
    const [windowTabs, existingGroups] = await Promise.all([
      this.tabsPort.getWindowTabs(windowId),
      this.tabsPort.getWindowTabGroups(windowId),
    ]);

    const groupedTabIds = windowTabs
      .filter((t) => typeof t.groupId === 'number' && t.groupId >= 0)
      .map((t) => t.id);

    if (groupedTabIds.length === 0) {
      return { windowId, ungroupedCount: 0 };
    }

    const snapshot = buildUndoSnapshot(windowId, windowTabs, existingGroups, this.clock.nowMs());
    await this.settingsRepo.saveUndoSnapshot(snapshot);

    await this.tabsPort.ungroupTabs(groupedTabIds);
    return {
      windowId,
      ungroupedCount: groupedTabIds.length,
    };
  }
}
