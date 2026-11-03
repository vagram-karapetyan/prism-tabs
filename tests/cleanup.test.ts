import { describe, expect, it } from 'vitest';
import {
  isDisposableTab,
  isEmptyBrowserTab,
  isYouTubeHomeTab,
} from '../src/services/chromeTabsService';

describe('Disposable Tab Detection & Cleanup', () => {
  describe('isYouTubeHomeTab', () => {
    it('identifies standard desktop and mobile YouTube homepage URLs', () => {
      expect(isYouTubeHomeTab({ url: 'https://www.youtube.com/' })).toBe(true);
      expect(isYouTubeHomeTab({ url: 'https://www.youtube.com' })).toBe(true);
      expect(isYouTubeHomeTab({ url: 'http://youtube.com/' })).toBe(true);
      expect(isYouTubeHomeTab({ url: 'https://youtube.com' })).toBe(true);
      expect(isYouTubeHomeTab({ url: 'https://m.youtube.com/' })).toBe(true);
      expect(isYouTubeHomeTab({ url: 'https://m.youtube.com' })).toBe(true);
      expect(isYouTubeHomeTab({ pendingUrl: 'https://www.youtube.com/' })).toBe(true);
    });

    it('ignores general tracking parameters on root homepage', () => {
      expect(isYouTubeHomeTab({ url: 'https://www.youtube.com/?feature=ytca' })).toBe(true);
      expect(isYouTubeHomeTab({ url: 'https://www.youtube.com/?app=desktop' })).toBe(true);
    });

    it('does NOT match video watch pages or shorts', () => {
      expect(isYouTubeHomeTab({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })).toBe(false);
      expect(isYouTubeHomeTab({ url: 'https://www.youtube.com/shorts/3xyz123' })).toBe(false);
      expect(isYouTubeHomeTab({ url: 'https://m.youtube.com/watch?v=12345' })).toBe(false);
      expect(isYouTubeHomeTab({ url: 'https://www.youtube.com/?v=dQw4w9WgXcQ' })).toBe(false);
    });

    it('does NOT match playlists, channels, feeds, or studio pages', () => {
      expect(isYouTubeHomeTab({ url: 'https://www.youtube.com/playlist?list=PL12345' })).toBe(false);
      expect(isYouTubeHomeTab({ url: 'https://www.youtube.com/?list=PL12345' })).toBe(false);
      expect(isYouTubeHomeTab({ url: 'https://www.youtube.com/@veritasium' })).toBe(false);
      expect(isYouTubeHomeTab({ url: 'https://www.youtube.com/feed/subscriptions' })).toBe(false);
      expect(isYouTubeHomeTab({ url: 'https://studio.youtube.com/' })).toBe(false);
      expect(isYouTubeHomeTab({ url: 'https://music.youtube.com/' })).toBe(false);
    });

    it('never matches pinned tabs even if URL is YouTube homepage', () => {
      expect(isYouTubeHomeTab({ url: 'https://www.youtube.com/', pinned: true })).toBe(false);
    });
  });

  describe('isEmptyBrowserTab', () => {
    it('identifies new tab pages and about:blank', () => {
      expect(isEmptyBrowserTab({ url: 'chrome://newtab/' })).toBe(true);
      expect(isEmptyBrowserTab({ url: 'edge://newtab/' })).toBe(true);
      expect(isEmptyBrowserTab({ url: 'about:blank' })).toBe(true);
      expect(isEmptyBrowserTab({ url: 'chrome://new-tab-page/' })).toBe(true);
      expect(isEmptyBrowserTab({ url: '', title: 'New Tab' })).toBe(true);
    });

    it('does not match regular web pages', () => {
      expect(isEmptyBrowserTab({ url: 'https://example.com' })).toBe(false);
      expect(isEmptyBrowserTab({ url: 'https://google.com' })).toBe(false);
    });

    it('never matches pinned tabs', () => {
      expect(isEmptyBrowserTab({ url: 'chrome://newtab/', pinned: true })).toBe(false);
    });
  });

  describe('isDisposableTab', () => {
    const emptyTab = { id: 1, url: 'chrome://newtab/' };
    const ytHomeTab = { id: 2, url: 'https://www.youtube.com/' };
    const ytVideoTab = { id: 3, url: 'https://www.youtube.com/watch?v=test' };
    const regularTab = { id: 4, url: 'https://github.com' };
    const pinnedYtHomeTab = { id: 5, url: 'https://www.youtube.com/', pinned: true };

    it('respects closeEmptyTabs setting', () => {
      expect(isDisposableTab(emptyTab, { closeEmptyTabs: true, closeYouTubeHomeTabs: false })).toBe(true);
      expect(isDisposableTab(emptyTab, { closeEmptyTabs: false, closeYouTubeHomeTabs: false })).toBe(false);
    });

    it('respects closeYouTubeHomeTabs setting', () => {
      expect(isDisposableTab(ytHomeTab, { closeEmptyTabs: false, closeYouTubeHomeTabs: true })).toBe(true);
      expect(isDisposableTab(ytHomeTab, { closeEmptyTabs: false, closeYouTubeHomeTabs: false })).toBe(false);
      expect(isDisposableTab(ytHomeTab, { closeEmptyTabs: true, closeYouTubeHomeTabs: false })).toBe(false);
      expect(isDisposableTab(ytVideoTab, { closeEmptyTabs: true, closeYouTubeHomeTabs: true })).toBe(false);
    });

    it('never disposes regular or pinned tabs', () => {
      expect(isDisposableTab(regularTab, { closeEmptyTabs: true, closeYouTubeHomeTabs: true })).toBe(false);
      expect(isDisposableTab(pinnedYtHomeTab, { closeEmptyTabs: true, closeYouTubeHomeTabs: true })).toBe(false);
    });
  });
});
