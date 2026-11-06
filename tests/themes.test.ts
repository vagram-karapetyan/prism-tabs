import { describe, expect, it } from 'vitest';
import { PRISM_THEMES, THEME_LIST, applyPrismTheme, resolveEffectiveThemeId } from '../src/ui/themes';
import { DEFAULT_PRISM_SETTINGS, exportPrismConfig, importPrismConfig, loadSettings, saveSettings } from '../src/storage/storageService';
import { ConcreteThemeId } from '../src/engine/types';

describe('Prism Modern Themes System', () => {
  it('defines 6 distinct, curated modern themes', () => {
    expect(THEME_LIST.length).toBe(6);

    const expectedIds: ConcreteThemeId[] = [
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

  it('updates document styles, colorScheme, and localStorage cache when DOM is present', () => {
    const rootEl = {
      setAttribute: (name: string, val: string) => { (rootEl as any)[name] = val; },
      style: {
        setProperty: (prop: string, val: string) => { (rootEl.style as any)[prop] = val; },
        backgroundColor: '',
        colorScheme: '',
      },
      classList: {
        add: (cls: string) => { (rootEl as any).class = cls; },
        remove: (_cls: string) => {},
      },
    };
    const bodyEl = {
      style: {
        backgroundColor: '',
        colorScheme: '',
      },
    };
    const metaEl = {
      content: '',
    };
    const rootDiv = {
      style: {
        backgroundColor: '',
      },
    };

    const mockStorage = new Map<string, string>();
    const mockLocalStorage = {
      setItem: (k: string, v: string) => mockStorage.set(k, v),
      getItem: (k: string) => mockStorage.get(k) || null,
    };

    (global as any).document = {
      documentElement: rootEl,
      body: bodyEl,
      getElementById: (id: string) => {
        if (id === 'prism-color-scheme') return metaEl;
        if (id === 'root') return rootDiv;
        return null;
      },
    };
    (global as any).window = {
      localStorage: mockLocalStorage,
    };

    try {
      applyPrismTheme('prism-deep');
      expect(rootEl.style.backgroundColor).toBe('#090A0F');
      expect(rootEl.style.colorScheme).toBe('dark');
      expect(bodyEl.style.colorScheme).toBe('dark');
      expect(metaEl.content).toBe('dark');
      expect(mockLocalStorage.getItem('prism_theme_mode')).toBe('dark');

      applyPrismTheme('pure-light');
      expect(rootEl.style.backgroundColor).toBe('#F8FAFC');
      expect(rootEl.style.colorScheme).toBe('light');
      expect(bodyEl.style.colorScheme).toBe('light');
      expect(metaEl.content).toBe('light');
      expect(mockLocalStorage.getItem('prism_theme_mode')).toBe('light');
    } finally {
      delete (global as any).document;
      delete (global as any).window;
    }
  });

  it('correctly resolves system theme dynamically via matchMedia', () => {
    // 1. Without matchMedia, defaults to prism-deep
    expect(resolveEffectiveThemeId('system')).toBe('prism-deep');

    // 2. Concrete themes pass through unchanged
    expect(resolveEffectiveThemeId('midnight-nebula')).toBe('midnight-nebula');
    expect(resolveEffectiveThemeId('pure-light')).toBe('pure-light');

    // 3. With matchMedia preferring light
    (global as any).window = {
      matchMedia: (q: string) => ({
        matches: q.includes('light'),
      }),
    };
    try {
      expect(resolveEffectiveThemeId('system')).toBe('pure-light');
    } finally {
      delete (global as any).window;
    }

    // 4. With matchMedia preferring dark
    (global as any).window = {
      matchMedia: (q: string) => ({
        matches: q.includes('dark'),
      }),
    };
    try {
      expect(resolveEffectiveThemeId('system')).toBe('prism-deep');
    } finally {
      delete (global as any).window;
    }
  });

  it('allows saving and persisting system theme mode', async () => {
    await saveSettings({ theme: 'system' });
    const loaded = await loadSettings();
    expect(loaded.theme).toBe('system');

    // Restore default
    await saveSettings({ theme: 'prism-deep' });
  });

  it('exports and imports configuration safely without leaking or overwriting keys', async () => {
    const current = await loadSettings();
    const exported = exportPrismConfig(current);

    expect(exported.version).toBe(1);
    expect(exported.exportedAt).toBeDefined();
    expect((exported as any).groqApiKey).toBeUndefined();
    expect((exported as any).geminiApiKey).toBeUndefined();
    expect(exported.theme).toBe('prism-deep');

    const jsonString = JSON.stringify({
      version: 1,
      theme: 'emerald-forest',
      closeEmptyTabs: true,
      customRules: [
        {
          id: 'imported-rule-1',
          name: 'Cloud Infrastructure',
          emoji: '☁️',
          color: 'cyan',
          matchTarget: 'hostname',
          pattern: 'cloud.google.com, aws.amazon.com',
          isRegex: false,
          priority: 5,
          enabled: true,
        },
      ],
    });

    const result = await importPrismConfig(jsonString);
    expect(result.success).toBe(true);
    expect(result.settings?.theme).toBe('emerald-forest');
    expect(result.settings?.customRules.some((r) => r.id === 'imported-rule-1')).toBe(true);

    // Reset back
    await saveSettings({ theme: 'prism-deep' });
  });
});
