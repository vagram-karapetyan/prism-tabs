import { describe, expect, it } from 'vitest';
import { MemoryStorageAdapter } from '../src/adapters/storage/memory-storage.adapter';
import { MemoryBrowserAdapter } from '../src/adapters/test/memory-browser.adapter';
import type { ClockPort } from '../src/ports/clock.port';
import type { LlmGatewayPort } from '../src/ports/llm-gateway.port';
import { createPopupStore } from '../src/ui/state/popup.store';
import { classifyPopupShortcut, isEditableEventTarget } from '../src/ui/utils/keyboard-guard';
import { filterTabsAndGroups, splitHighlightSegments } from '../src/ui/utils/search-filter';

const testClock: ClockPort = {
  nowMs: () => 1_763_057_000_000,
  nowIso: () => '2026-11-13T18:30:00.000Z',
  performanceNow: () => 4,
};

describe('UI Helpers: search-filter, keyboard-guard & popup.store', () => {
  it('splits highlight segments and filters groups & ungrouped tabs case-insensitively', () => {
    const segments = splitHighlightSegments('GitHub Pull Request #42', 'pull');
    expect(segments).toEqual([
      { text: 'GitHub ', matched: false },
      { text: 'Pull', matched: true },
      { text: ' Request #42', matched: false },
    ]);

    const filtered = filterTabsAndGroups(
      [
        { id: 1, title: 'PR #10', url: 'https://github.com/org/repo/pull/10', groupId: 10 },
        { id: 2, title: 'Docs', url: 'https://developer.mozilla.org/', groupId: 10 },
        { id: 3, title: 'News', url: 'https://news.ycombinator.com/', groupId: -1 },
      ],
      [
        {
          id: 10,
          title: '💻 Dev',
          cleanTitle: 'Dev',
          emoji: '💻',
          color: 'purple',
          collapsed: false,
          tabIds: [1, 2],
        },
      ],
      'github',
    );

    expect(filtered.groups).toHaveLength(1);
    expect(filtered.groups[0]?.tabs.map((t) => t.id)).toEqual([1]);
    expect(filtered.ungroupedTabs).toHaveLength(0);
    expect(filtered.matchedTabCount).toBe(1);
  });

  it('guards popup shortcuts when focus is inside editable inputs or IME composition', () => {
    expect(isEditableEventTarget({ tagName: 'input' })).toBe(true);
    expect(isEditableEventTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isEditableEventTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isEditableEventTarget({ tagName: 'div', isContentEditable: true })).toBe(true);
    expect(isEditableEventTarget({ tagName: 'button' })).toBe(false);

    expect(classifyPopupShortcut({ key: 'p', altKey: true, target: { tagName: 'BUTTON' } })).toBe(
      'sort',
    );
    expect(classifyPopupShortcut({ key: 'p', altKey: true, target: { tagName: 'INPUT' } })).toBe(
      null,
    );
    expect(classifyPopupShortcut({ key: 'u', altKey: true, target: { tagName: 'DIV' } })).toBe(
      'ungroup',
    );
    expect(classifyPopupShortcut({ key: 'z', ctrlKey: true, target: { tagName: 'DIV' } })).toBe(
      'undo',
    );
    expect(
      classifyPopupShortcut({ key: 'z', ctrlKey: true, target: { tagName: 'TEXTAREA' } }),
    ).toBe(null);
    expect(
      classifyPopupShortcut({ key: 'Escape', target: { tagName: 'INPUT' } }),
    ).toBe('escape');
    expect(
      classifyPopupShortcut({ key: 'p', altKey: true, isComposing: true, target: { tagName: 'DIV' } }),
    ).toBe(null);
  });

  it('runs sort, AI fallback banner, live group ops, DnD move, undo & key-safe portability via store', async () => {
    const browser = new MemoryBrowserAdapter([
      { id: 1, windowId: 1, index: 0, url: 'https://github.com/a/b', title: 'Repo B', active: true },
      { id: 2, windowId: 1, index: 1, url: 'https://github.com/a/c', title: 'Repo C' },
      { id: 3, windowId: 1, index: 2, url: 'https://youtube.com/watch?v=1', title: 'Ambient Mix' },
      { id: 4, windowId: 1, index: 3, url: 'https://youtube.com/watch?v=2', title: 'Lofi Beats' },
    ]);
    const storage = new MemoryStorageAdapter();
    const failingGateway: LlmGatewayPort = {
      requestGrouping: () => Promise.reject(new Error('HTTP 429 rate limited')),
    };

    const store = createPopupStore({
      tabsPort: browser,
      storagePort: storage,
      llmGateway: failingGateway,
      clock: testClock,
    });

    await store.init();
    expect(store.tabs.value).toHaveLength(4);
    expect(store.ungroupedCount.value).toBe(4);

    await store.updateSettings({ maxTabsPerGroup: 6, groqApiKey: 'gsk_local_secret' });

    const sortRes = await store.runSort('meaning');
    expect(sortRes).not.toBeNull();
    expect(sortRes?.plan.fallbackTriggered).toBe(true);
    expect(store.fallbackBanner.value).toBeTruthy();
    expect(store.hasUndoSnapshot.value).toBe(true);
    expect(store.groups.value.length).toBeGreaterThanOrEqual(2);
    expect(store.toast.value?.text).toContain('MB RAM saved');

    const firstGroup = store.groups.value[0];
    expect(firstGroup).toBeDefined();
    if (!firstGroup) return;

    await store.renameGroup(firstGroup.id, '🚀 Sprint');
    await store.recolorGroup(firstGroup.id, 'cyan');
    const updatedGroup = store.groups.value.find((g) => g.id === firstGroup.id);
    expect(updatedGroup?.title).toBe('🚀 Sprint');
    expect(updatedGroup?.color).toBe('cyan');

    // Drag & drop tab out to ungrouped (targetGroupId = null)
    const tabToMove = firstGroup.tabIds[0];
    expect(tabToMove).toBeDefined();
    if (tabToMove === undefined) return;
    await store.moveTab(tabToMove, null);
    expect(store.ungroupedCount.value).toBe(1);

    // Export excludes API keys; import preserves existing groqApiKey
    const exported = store.exportConfigJson();
    expect(exported).not.toContain('gsk_local_secret');
    const importRes = await store.importConfigJson(exported);
    expect(importRes.success).toBe(true);
    expect(store.settings.value.groqApiKey).toBe('gsk_local_secret');

    // Undo restores all tabs to ungrouped pre-sort state
    await store.runUndo();
    expect(store.groups.value).toHaveLength(0);
    expect(store.ungroupedCount.value).toBe(4);
    expect(store.hasUndoSnapshot.value).toBe(false);

    store.dispose();
  });
});
