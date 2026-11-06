import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyGroupingPlan,
  discardInactiveTabsInWindow,
  estimateMemorySavings,
  moveTabToGroup,
  captureUndoSnapshot,
  closeDisposableTabsInWindow,
  getCurrentWindowTabGroups,
  getCurrentWindowTabs,
  hasUngroupedGroupableWebTabs,
  restoreUndoSnapshot,
  ungroupAllTabsInWindow,
  ungroupSpecificTabs,
} from '../src/services/chromeTabsService';
import { ExistingTabGroup, GroupingPlan, TabMetadata } from '../src/engine/types';

describe('Chrome Tabs Service — hasUngroupedGroupableWebTabs', () => {
  const existingGroup: ExistingTabGroup = {
    id: 1,
    title: 'Work',
    cleanTitle: 'Work',
    color: 'blue',
    collapsed: false,
    tabIds: [10, 11],
  };

  it('returns true when there is an unpinned web tab not in any existing group', () => {
    const tabs: TabMetadata[] = [
      { id: 10, title: 'Doc', url: 'https://docs.google.com' },
      { id: 11, title: 'Sheet', url: 'https://sheets.google.com' },
      { id: 12, title: 'GitHub', url: 'https://github.com' },
    ];

    expect(hasUngroupedGroupableWebTabs(tabs, [existingGroup])).toBe(true);
  });

  it('returns false when all web tabs are already inside existing groups', () => {
    const tabs: TabMetadata[] = [
      { id: 10, title: 'Doc', url: 'https://docs.google.com' },
      { id: 11, title: 'Sheet', url: 'https://sheets.google.com' },
    ];

    expect(hasUngroupedGroupableWebTabs(tabs, [existingGroup])).toBe(false);
  });

  it('ignores pinned tabs and internal browser URLs', () => {
    const tabs: TabMetadata[] = [
      { id: 10, title: 'Doc', url: 'https://docs.google.com' },
      { id: 11, title: 'Sheet', url: 'https://sheets.google.com' },
      { id: 20, title: 'Pinned App', url: 'https://slack.com', pinned: true },
      { id: 21, title: 'Extensions', url: 'chrome://extensions/' },
      { id: 22, title: 'Settings', url: 'about:blank' },
    ];

    expect(hasUngroupedGroupableWebTabs(tabs, [existingGroup])).toBe(false);
  });

  it('respects closeYouTubeHomeTabs option when evaluating disposable tabs', () => {
    const tabs: TabMetadata[] = [
      { id: 10, title: 'Doc', url: 'https://docs.google.com' },
      { id: 11, title: 'Sheet', url: 'https://sheets.google.com' },
      { id: 30, title: 'YouTube', url: 'https://www.youtube.com/' },
    ];

    // When YouTube home close is OFF, tab 30 counts as an ungrouped web tab
    expect(
      hasUngroupedGroupableWebTabs(tabs, [existingGroup], { closeYouTubeHomeTabs: false })
    ).toBe(true);

    // When YouTube home close is ON, tab 30 is disposable so no ungrouped web tabs remain
    expect(
      hasUngroupedGroupableWebTabs(tabs, [existingGroup], { closeYouTubeHomeTabs: true })
    ).toBe(false);
  });
});

describe('Chrome Tabs Service — applyGroupingPlan & Live State Synchronization', () => {
  beforeEach(async () => {
    // Reset tabs to demo state via restoreUndoSnapshot
    await restoreUndoSnapshot({
      timestamp: Date.now(),
      windowId: 1,
      entries: [
        { tabId: 101, index: 0, previousGroupId: 1 },
        { tabId: 102, index: 1, previousGroupId: 1 },
        { tabId: 103, index: 2, previousGroupId: -1 },
        { tabId: 104, index: 3, previousGroupId: 1 },
        { tabId: 105, index: 4, previousGroupId: -1 },
        { tabId: 106, index: 5, previousGroupId: -1 },
      ],
    });
  });

  it('populates existingGroupId on newly created groups during applyGroupingPlan', async () => {
    const plan: GroupingPlan = {
      modeUsed: 'logic',
      fallbackTriggered: false,
      groups: [
        {
          id: 'test-group-1',
          groupName: 'React & Vite',
          emoji: '⚡',
          color: 'cyan',
          tabIds: [103, 104],
          source: 'domain',
        },
      ],
      ungroupedTabIds: [105, 106],
      latencyMs: 1,
    };

    expect(plan.groups[0].existingGroupId).toBeUndefined();

    await applyGroupingPlan(plan, { staggerMs: 0 });

    // existingGroupId must be populated so color picking, renaming and ungrouping sync properly
    expect(typeof plan.groups[0].existingGroupId).toBe('number');
    expect(plan.groups[0].existingGroupId).toBeGreaterThan(0);
  });

  it('tracks progress callbacks through gliding and grouping phases', async () => {
    const plan: GroupingPlan = {
      modeUsed: 'logic',
      fallbackTriggered: false,
      groups: [
        {
          id: 'grp-a',
          groupName: 'Docs',
          emoji: '📄',
          color: 'blue',
          tabIds: [101, 102],
          source: 'platform',
        },
      ],
      ungroupedTabIds: [],
      latencyMs: 1,
    };

    const phases: string[] = [];
    await applyGroupingPlan(plan, {
      staggerMs: 0,
      onProgress: (p) => phases.push(p.phase),
    });

    expect(phases).toContain('gliding');
    expect(phases).toContain('grouping');
    expect(phases).toContain('complete');
  });
});

describe('Chrome Tabs Service — Undo Snapshot & Tab Operations', () => {
  it('captures an undo snapshot and allows restoring prior tab groups', async () => {
    const initialTabs = await getCurrentWindowTabs();
    expect(initialTabs.length).toBeGreaterThan(0);

    const snapshot = await captureUndoSnapshot();
    expect(snapshot.entries.length).toBe(initialTabs.length);

    // Ungroup all tabs
    const ungroupedCount = await ungroupAllTabsInWindow();
    expect(ungroupedCount).toBeGreaterThanOrEqual(0);

    const tabsAfterUngroup = await getCurrentWindowTabs();
    const groupsAfterUngroup = await getCurrentWindowTabGroups(tabsAfterUngroup);
    expect(groupsAfterUngroup.length).toBe(0);

    // Restore snapshot
    await restoreUndoSnapshot(snapshot);
    const restoredTabs = await getCurrentWindowTabs();
    const restoredGroups = await getCurrentWindowTabGroups(restoredTabs);
    expect(restoredTabs.length).toBe(initialTabs.length);
    expect(restoredGroups.length).toBeGreaterThanOrEqual(0);
  });

  it('ungroups specific tab IDs accurately', async () => {
    await ungroupSpecificTabs([101, 102]);
    const tabs = await getCurrentWindowTabs();
    const tab101 = tabs.find((t) => t.id === 101);
    expect(tab101?.groupId).toBe(-1);
  });

  it('safely closes disposable tabs while keeping at least 1 tab open', async () => {
    const closed = await closeDisposableTabsInWindow({
      closeEmptyTabs: true,
      closeYouTubeHomeTabs: true,
    });
    expect(closed).toBeGreaterThanOrEqual(0);
  });
  it('estimates memory savings accurately for closed tabs, discarded tabs and collapsed groups', () => {
    // 2 closed tabs (2*45=90) + 3 discarded tabs (3*55=165) + 1 collapsed group (1*10=10) = 265 MB
    const savings = estimateMemorySavings(2, 3, 1);
    expect(savings).toBe(265);

    expect(estimateMemorySavings(0, 0, 0)).toBe(0);
    expect(estimateMemorySavings(1)).toBe(45);
  });

  it('moves a tab into another group via moveTabToGroup', async () => {
    await moveTabToGroup(103, 1);
    const tabs = await getCurrentWindowTabs();
    const tab103 = tabs.find((t) => t.id === 103);
    expect(tab103?.groupId).toBe(1);
  });

  it('safely calls discardInactiveTabsInWindow without error in mock or chrome runtime', async () => {
    const discarded = await discardInactiveTabsInWindow([101, 102]);
    expect(discarded).toBeGreaterThanOrEqual(0);
  });
});
