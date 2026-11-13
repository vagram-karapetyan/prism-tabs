import { describe, expect, it } from 'vitest';
import { createPrismServices } from '../src/adapters/composition-root';
import { MemoryStorageAdapter } from '../src/adapters/storage/memory-storage.adapter';
import { MemoryBrowserAdapter } from '../src/adapters/test/memory-browser.adapter';
import { handleBackgroundCommand } from '../src/background/index';
import { DEFAULT_DETERMINISTIC_OPTIONS } from '../src/domain/defaults';
import type { ClockPort } from '../src/ports/clock.port';
import type { LlmGatewayPort } from '../src/ports/llm-gateway.port';

const testClock: ClockPort = {
  nowMs: () => 1_763_057_000_000,
  nowIso: () => '2026-11-13T18:15:00.000Z',
  performanceNow: () => 5,
};

const noopGateway: LlmGatewayPort = {
  requestGrouping: () => Promise.reject(new Error('No AI call expected in Logic Mode tests')),
};

describe('Orchestrator integration: atomic ordering, safety guards, Undo, LiveOps & Background', () => {
  it('enforces Snapshot -> Plan -> Apply Groups -> Close Disposable -> Discard Inactive order and RAM metric', async () => {
    const browser = new MemoryBrowserAdapter(
      [
        { id: 1, windowId: 1, index: 0, url: 'chrome://newtab/', title: 'New Tab', active: true },
        { id: 2, windowId: 1, index: 1, url: 'chrome://newtab/', title: 'Pinned Blank', pinned: true },
        { id: 3, windowId: 1, index: 2, url: 'https://www.youtube.com/', title: 'YouTube' },
        {
          id: 4,
          windowId: 1,
          index: 3,
          url: 'https://www.youtube.com/watch?v=abc',
          title: 'Music Stream',
          audible: true,
        },
        {
          id: 5,
          windowId: 1,
          index: 4,
          url: 'https://github.com/acme/web/pull/1',
          title: 'PR #1',
        },
        {
          id: 6,
          windowId: 1,
          index: 5,
          url: 'https://github.com/acme/web/issues/2',
          title: 'Issue #2',
        },
      ],
      [],
      1,
    );
    const storage = new MemoryStorageAdapter();
    const services = createPrismServices({
      tabsPort: browser,
      storagePort: storage,
      llmGateway: noopGateway,
      clock: testClock,
    });

    await services.settingsRepo.updateSettings({
      closeEmptyTabs: true,
      closeYouTubeHomeTabs: true,
      discardInactiveTabs: true,
      collapseOthersOnGroup: true,
    });

    const result = await services.sortWindow.execute();

    // Assert exact phase ordering in operationLog
    const firstGroupIdx = browser.operationLog.findIndex((op) => op.startsWith('createTabGroup:'));
    const closeIdx = browser.operationLog.findIndex((op) => op.startsWith('closeTabs:'));
    const firstDiscardIdx = browser.operationLog.findIndex((op) => op.startsWith('discardTab:'));

    expect(firstGroupIdx).toBeGreaterThanOrEqual(0);
    expect(closeIdx).toBeGreaterThan(firstGroupIdx);
    expect(firstDiscardIdx).toBeGreaterThan(closeIdx);

    // Tabs 1 (active empty) & 3 (YT homepage) closed AFTER grouping; pinned tab 2 untouched
    expect(result.closedTabsCount).toBe(2);
    const remainingTabs = await browser.getWindowTabs(1);
    expect(remainingTabs.map((t) => t.id)).toEqual([2, 4, 5, 6]);
    expect(remainingTabs.find((t) => t.id === 2)?.groupId).toBe(-1);

    // Audible tab 4 was NOT discarded; tabs 5 & 6 were discarded
    // Under minTabsPerGroup: 2, single YouTube tab 4 stays ungrouped instead of forming a 1-tab noise group
    expect(remainingTabs.find((t) => t.id === 4)?.discarded).toBeFalsy();
    expect(remainingTabs.find((t) => t.id === 5)?.discarded).toBe(true);
    expect(remainingTabs.find((t) => t.id === 6)?.discarded).toBe(true);
    expect(result.discardedTabsCount).toBe(2);
    expect(result.collapsedGroupsCount).toBe(1);
    expect(result.estimatedRamSavedMb).toBe(2 * 45 + 2 * 55 + 1 * 10);

    // appliedGroupIds maps plan IDs to real browser groupIds
    for (const group of result.plan.groups) {
      expect(result.appliedGroupIds[group.id]).toBeGreaterThanOrEqual(100);
    }
  });

  it('never closes the last remaining tab when 100% of window tabs are disposable', async () => {
    const browser = new MemoryBrowserAdapter(
      [
        { id: 10, windowId: 1, index: 0, url: 'chrome://newtab/', title: 'New Tab', active: true },
        { id: 11, windowId: 1, index: 1, url: 'about:blank', title: 'about:blank' },
        { id: 12, windowId: 1, index: 2, url: 'edge://newtab/', title: 'New Tab' },
      ],
      [],
      1,
    );
    const services = createPrismServices({
      tabsPort: browser,
      storagePort: new MemoryStorageAdapter(),
      llmGateway: noopGateway,
      clock: testClock,
    });

    const result = await services.sortWindow.execute();
    expect(result.closedTabsCount).toBe(2);
    const tabsLeft = await browser.getWindowTabs(1);
    expect(tabsLeft).toHaveLength(1);
  });

  it('isolates sorting and Ungroup All strictly to the active window', async () => {
    const browser = new MemoryBrowserAdapter(
      [
        { id: 1, windowId: 1, index: 0, url: 'https://github.com/a/b', title: 'Repo B' },
        { id: 2, windowId: 1, index: 1, url: 'https://github.com/a/b/issues', title: 'Issues' },
        { id: 101, windowId: 2, index: 0, url: 'https://docs.rs/tokio', title: 'Tokio', groupId: 50 },
      ],
      [{ id: 50, windowId: 2, title: '🦀 Rust', color: 'orange', collapsed: false }],
      1,
    );

    const services = createPrismServices({
      tabsPort: browser,
      storagePort: new MemoryStorageAdapter(),
      llmGateway: noopGateway,
      clock: testClock,
    });

    await handleBackgroundCommand('prism-sort-tabs', services);
    const win1GroupsAfterSort = await browser.getWindowTabGroups(1);
    const win2GroupsAfterSort = await browser.getWindowTabGroups(2);
    expect(win1GroupsAfterSort).toHaveLength(1);
    expect(win2GroupsAfterSort).toHaveLength(1);
    expect(win2GroupsAfterSort[0]?.id).toBe(50);

    await handleBackgroundCommand('prism-ungroup-all', services);
    expect(await browser.getWindowTabGroups(1)).toHaveLength(0);
    // Window 2 remains completely untouched
    expect(await browser.getWindowTabGroups(2)).toHaveLength(1);
    expect(await handleBackgroundCommand('unknown-command', services)).toBe(false);
  });

  it('restores original tab order and previous group metadata (title, color, collapsed) on Undo', async () => {
    const browser = new MemoryBrowserAdapter(
      [
        {
          id: 1,
          windowId: 1,
          index: 0,
          url: 'https://linear.app/issue/1',
          title: 'Linear 1',
          groupId: 20,
        },
        {
          id: 2,
          windowId: 1,
          index: 1,
          url: 'https://figma.com/file/1',
          title: 'Figma 1',
          groupId: 20,
        },
        {
          id: 3,
          windowId: 1,
          index: 2,
          url: 'https://habr.com/ru/post/1',
          title: 'Habr 1',
          groupId: -1,
        },
      ],
      [{ id: 20, windowId: 1, title: '💼 Work', color: 'purple', collapsed: true }],
      1,
    );

    const services = createPrismServices({
      tabsPort: browser,
      storagePort: new MemoryStorageAdapter(),
      llmGateway: noopGateway,
      clock: testClock,
    });

    // Ungroup all, then Undo
    await services.ungroupAll.execute();
    expect(await browser.getWindowTabGroups(1)).toHaveLength(0);

    const undoRes = await services.undoLastSort.execute();
    expect(undoRes.restored).toBe(true);
    expect(undoRes.restoredGroupsCount).toBe(1);

    const restoredGroups = await browser.getWindowTabGroups(1);
    expect(restoredGroups).toHaveLength(1);
    expect(restoredGroups[0]?.title).toBe('💼 Work');
    expect(restoredGroups[0]?.color).toBe('purple');
    expect(restoredGroups[0]?.collapsed).toBe(true);
    expect(restoredGroups[0]?.tabIds).toEqual([1, 2]);

    const restoredTabs = await browser.getWindowTabs(1);
    expect(restoredTabs.map((t) => t.id)).toEqual([1, 2, 3]);
    expect(restoredTabs.find((t) => t.id === 3)?.groupId).toBe(-1);

    // Snapshot is cleared after undo
    const secondUndo = await services.undoLastSort.execute();
    expect(secondUndo.restored).toBe(false);
  });

  it('handles LiveGroupOps (rename, recolor, DnD move, ungroup) and missing tabs/groups safely', async () => {
    const browser = new MemoryBrowserAdapter(
      [
        { id: 1, windowId: 1, index: 0, url: 'https://a.com', title: 'A', groupId: 10 },
        { id: 2, windowId: 1, index: 1, url: 'https://b.com', title: 'B', groupId: 11 },
        { id: 3, windowId: 1, index: 2, url: 'https://c.com', title: 'C', groupId: 11 },
      ],
      [
        { id: 10, windowId: 1, title: '🌐 Group A', color: 'blue', collapsed: false },
        { id: 11, windowId: 1, title: '🌐 Group B', color: 'green', collapsed: false },
      ],
      1,
    );

    const services = createPrismServices({
      tabsPort: browser,
      storagePort: new MemoryStorageAdapter(),
      llmGateway: noopGateway,
      clock: testClock,
    });

    const renamed = await services.liveGroupOps.renameGroup(1, 10, '🚀 Launch');
    expect(renamed.ok).toBe(true);
    expect(renamed.groups.find((g) => g.id === 10)?.title).toBe('🚀 Launch');

    const recolored = await services.liveGroupOps.recolorGroup(1, 10, 'cyan');
    expect(recolored.ok).toBe(true);
    expect(recolored.groups.find((g) => g.id === 10)?.color).toBe('cyan');

    // Drag tab 1 from Group 10 into Group 11 -> Group 10 automatically empties & closes
    const moved = await services.liveGroupOps.moveTabToGroup(1, 1, 11);
    expect(moved.ok).toBe(true);
    expect(moved.groups).toHaveLength(1);
    expect(moved.groups[0]?.tabIds).toEqual([1, 2, 3]);

    // Simulate user manually closing tab 2, and attempting operation on vanished Group 10
    browser.simulateUserCloseTab(2);
    const missingGroup = await services.liveGroupOps.renameGroup(1, 10, 'Ghost');
    expect(missingGroup.ok).toBe(false);

    const missingTab = await services.liveGroupOps.moveTabToGroup(1, 2, 11);
    expect(missingTab.ok).toBe(false);

    const ungrouped = await services.liveGroupOps.ungroupSingleGroup(1, 11);
    expect(ungrouped.ok).toBe(true);
    expect(ungrouped.groups).toHaveLength(0);
  });

  it('aligns interleaved groups contiguously on the tab strip and restores original order on Undo', async () => {
    const browser = new MemoryBrowserAdapter(
      [
        { id: 1, windowId: 1, index: 0, url: 'https://mail.google.com', title: 'Pinned Mail', pinned: true },
        { id: 2, windowId: 1, index: 1, url: 'https://www.youtube.com/watch?v=ai1', title: 'LLM Agents Architecture - YouTube' },
        { id: 3, windowId: 1, index: 2, url: 'https://github.com/acme/api/issues/1', title: 'Issue #1', active: true },
        { id: 4, windowId: 1, index: 3, url: 'https://www.youtube.com/watch?v=g1', title: 'Elden Ring Boss Guide - YouTube' },
        { id: 5, windowId: 1, index: 4, url: 'https://en.wikipedia.org/wiki/Moon', title: 'Moon - Wikipedia' },
        { id: 6, windowId: 1, index: 5, url: 'https://www.youtube.com/watch?v=ai2', title: 'Claude Agents Workflow - YouTube' },
        { id: 7, windowId: 1, index: 6, url: 'https://github.com/acme/api/pull/2', title: 'PR #2' },
        { id: 8, windowId: 1, index: 7, url: 'https://www.youtube.com/watch?v=g2', title: 'Cyberpunk 2077 Патч - YouTube' },
      ],
      [],
      1,
    );
    const storage = new MemoryStorageAdapter();
    const services = createPrismServices({
      tabsPort: browser,
      storagePort: storage,
      llmGateway: noopGateway,
      clock: testClock,
    });

    const result = await services.sortWindow.execute();
    const orderedTabs = (await browser.getWindowTabs(1)).sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0),
    );

    // Pinned tab remains at index 0; Dev group [3, 7] appears before YouTube groups [2, 6] & [4, 8];
    // lone Wikipedia singleton [5] sits cleanly at the end rather than scattering YouTube chunks.
    expect(orderedTabs[0]?.id).toBe(1);
    const groupedTabIdsInStripOrder = orderedTabs
      .filter((t) => typeof t.groupId === 'number' && t.groupId >= 0)
      .map((t) => t.id);
    expect(groupedTabIdsInStripOrder).toHaveLength(6);

    // Each group's tabs occupy one contiguous slice with zero interleaving
    const seenGroups: number[] = [];
    for (const tabItem of orderedTabs) {
      if (typeof tabItem.groupId === 'number' && tabItem.groupId >= 0) {
        if (seenGroups[seenGroups.length - 1] !== tabItem.groupId) {
          expect(seenGroups).not.toContain(tabItem.groupId);
          seenGroups.push(tabItem.groupId);
        }
      }
    }
    expect(seenGroups).toHaveLength(result.plan.groups.length);

    // Undo cleanly restores original interleaved tab order
    await services.undoLastSort.execute();
    const restoredTabs = (await browser.getWindowTabs(1)).sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0),
    );
    expect(restoredTabs.map((t) => t.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('appends multiple new groups with moveTab(-1) cleanly when preserved existing groups exist and restores on Undo', async () => {
    const browser = new MemoryBrowserAdapter(
      [
        { id: 1, windowId: 1, index: 0, url: 'https://github.com/acme/ui/issues/1', title: 'UI Bug 1', groupId: 10 },
        { id: 2, windowId: 1, index: 1, url: 'https://www.youtube.com/watch?v=ai1', title: 'Claude Code AI Agents - YouTube' },
        { id: 3, windowId: 1, index: 2, url: 'https://github.com/acme/ui/pull/2', title: 'UI PR 2', groupId: 10 },
        { id: 4, windowId: 1, index: 3, url: 'https://www.youtube.com/watch?v=g1', title: 'Elden Ring Boss Guide - YouTube' },
        { id: 5, windowId: 1, index: 4, url: 'https://www.youtube.com/watch?v=ai2', title: 'DeepSeek R1 LLM - YouTube' },
        { id: 6, windowId: 1, index: 5, url: 'https://www.youtube.com/watch?v=g2', title: 'Baldur’s Gate 3 Patch - YouTube' },
      ],
      [
        {
          id: 10,
          windowId: 1,
          title: '🐙 GitHub: acme/ui',
          color: 'purple',
          collapsed: false,
        },
      ],
      1,
    );
    const services = createPrismServices({
      tabsPort: browser,
      storagePort: new MemoryStorageAdapter(),
      llmGateway: noopGateway,
      clock: testClock,
    });

    await services.sortWindow.execute();

    expect(browser.operationLog.some((entry) => entry.includes('->-1'))).toBe(true);
    const groupsAfter = await browser.getWindowTabGroups(1);
    expect(groupsAfter.length).toBeGreaterThanOrEqual(3);

    const tabsAfter = (await browser.getWindowTabs(1)).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const seenGroups: number[] = [];
    for (const t of tabsAfter) {
      if (typeof t.groupId === 'number' && t.groupId >= 0) {
        if (seenGroups[seenGroups.length - 1] !== t.groupId) {
          expect(seenGroups).not.toContain(t.groupId);
          seenGroups.push(t.groupId);
        }
      }
    }

    await services.undoLastSort.execute();
    const restored = (await browser.getWindowTabs(1)).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    expect(restored.map((t) => t.id)).toEqual([1, 2, 3, 4, 5, 6]);
    const restoredGroups = await browser.getWindowTabGroups(1);
    expect(restoredGroups).toHaveLength(1);
    expect(restoredGroups[0]?.title).toBe('🐙 GitHub: acme/ui');
    expect(restoredGroups[0]?.tabIds).toEqual([1, 3]);
    expect(restored.find((t) => t.id === 2)?.groupId).toBe(-1);
  });

  it('detaches stale chrome groups from ungrouped tabs BEFORE sequential moveTab in Clean Slate mode', async () => {
    const browser = new MemoryBrowserAdapter(
      [
        { id: 1, windowId: 1, index: 0, url: 'https://github.com/acme/a/issues/1', title: 'Issue 1', groupId: 50 },
        { id: 2, windowId: 1, index: 1, url: 'https://en.wikipedia.org/wiki/Moon', title: 'Moon Wiki', groupId: 50 },
        { id: 3, windowId: 1, index: 2, url: 'https://github.com/acme/a/pull/2', title: 'PR 2', groupId: 50 },
        { id: 4, windowId: 1, index: 3, url: 'https://www.youtube.com/watch?v=ai1', title: 'DeepSeek R1 LLM - YouTube', groupId: 51 },
        { id: 5, windowId: 1, index: 4, url: 'https://www.youtube.com/watch?v=ai2', title: 'Claude Code AI - YouTube', groupId: 51 },
      ],
      [
        { id: 50, windowId: 1, title: 'Old Mixed', color: 'grey', collapsed: false },
        { id: 51, windowId: 1, title: 'Old Videos', color: 'red', collapsed: false },
      ],
      1,
    );
    const services = createPrismServices({
      tabsPort: browser,
      storagePort: new MemoryStorageAdapter(),
      llmGateway: noopGateway,
      clock: testClock,
    });

    await services.settingsRepo.updateSettings({
      deterministicOptions: {
        ...DEFAULT_DETERMINISTIC_OPTIONS,
        preserveExistingGroups: false,
        groupSingletonsIntoMisc: false,
      },
    });

    const result = await services.sortWindow.execute();
    expect(result.plan.ungroupedTabIds).toContain(2);

    const staleUngroupIdx = browser.operationLog.findIndex(
      (op) => op.startsWith('ungroupTabs:') && op.includes('2'),
    );
    const firstMoveIdx = browser.operationLog.findIndex((op) => op.startsWith('moveTab:'));
    expect(staleUngroupIdx).toBeGreaterThanOrEqual(0);
    expect(firstMoveIdx).toBeGreaterThan(staleUngroupIdx);

    const tabsAfter = await browser.getWindowTabs(1);
    expect(tabsAfter.find((t) => t.id === 2)?.groupId).toBe(-1);
  });
});
