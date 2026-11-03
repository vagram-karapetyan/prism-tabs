import { describe, expect, it } from 'vitest';
import { PRISM_THEMES, THEME_LIST, applyPrismTheme } from '../src/ui/themes';
import { DEFAULT_PRISM_SETTINGS, loadSettings, saveSettings } from '../src/storage/storageService';
import { PrismThemeId } from '../src/engine/types';

describe('Prism Modern Themes System', () => {
  it('defines 6 distinct, curated modern themes', () => {
    expect(THEME_LIST.length).toBe(6);

    const expectedIds: PrismThemeId[] = [
      'prism-deep',
      'midnight-nebula',
      'emerald-forest',
      'sunset-amber',
      'arctic-frost',
      'pure-light',
    ];

    expectedIds.forEach((id) => {
      const theme = PRISM_THEMES[id];
      expect(theme).toBeDefined();
      expect(theme.name).toBeTruthy();
      expect(theme.tagline).toBeTruthy();
      expect(theme.emoji).toBeTruthy();
      expect(theme.colors.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.colors.surface).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.colors.border).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.colors.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.colors.previewDots.length).toBe(3);
    });
  });

  it('defaults to prism-deep theme in default settings', () => {
    expect(DEFAULT_PRISM_SETTINGS.theme).toBe('prism-deep');
  });

  it('persists and loads custom theme selection via storageService', async () => {
    await saveSettings({ theme: 'midnight-nebula' });
    const loaded = await loadSettings();
    expect(loaded.theme).toBe('midnight-nebula');

    // Restore default
    await saveSettings({ theme: 'prism-deep' });
    const restored = await loadSettings();
    expect(restored.theme).toBe('prism-deep');
  });

  it('safely handles applyPrismTheme in test environment without throwing', () => {
    expect(() => applyPrismTheme('emerald-forest')).not.toThrow();
    expect(() => applyPrismTheme('pure-light')).not.toThrow();
    expect(() => applyPrismTheme('prism-deep')).not.toThrow();
  });
});

