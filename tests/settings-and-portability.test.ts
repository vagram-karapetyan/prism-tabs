import { describe, expect, it } from 'vitest';
import { MemoryStorageAdapter } from '../src/adapters/storage/memory-storage.adapter';
import {
  SETTINGS_V1_STORAGE_KEY,
  SETTINGS_V2_STORAGE_KEY,
  SettingsRepository,
} from '../src/adapters/storage/settings-repository';
import { ConfigPortabilityUseCase } from '../src/application/config-portability.usecase';
import { DEFAULT_MAX_TABS_PER_GROUP } from '../src/domain/defaults';
import type { ClockPort } from '../src/ports/clock.port';

const fixedClock: ClockPort = {
  nowMs: () => 1_763_056_000_000,
  nowIso: () => '2026-11-13T18:00:00.000Z',
  performanceNow: () => 10,
};

describe('SettingsRepository & v1 -> v2 migration', () => {
  it('initializes clean v2 defaults with maxTabsPerGroup = 8 and empty API keys', async () => {
    const storage = new MemoryStorageAdapter();
    const repo = new SettingsRepository(storage);

    const settings = await repo.loadSettings();

    expect(settings.maxTabsPerGroup).toBe(DEFAULT_MAX_TABS_PER_GROUP);
    expect(settings.maxTabsPerGroup).toBe(8);
    expect(settings.theme).toBe('prism-deep');
    expect(settings.groqApiKey).toBe('');
    expect(settings.geminiApiKey).toBe('');
    expect(settings.customApiKey).toBe('');

    const storedV2 = await storage.get(SETTINGS_V2_STORAGE_KEY);
    expect(storedV2).toBeDefined();
  });

  it('performs one-time lazy migration from prism_settings_v1 and sanitizes invalid fields', async () => {
    const storage = new MemoryStorageAdapter({
      [SETTINGS_V1_STORAGE_KEY]: {
        theme: 'midnight-nebula',
        mode: 'meaning',
        aiProvider: 'gemini',
        groqApiKey: 'gsk_user_key_123',
        geminiApiKey: 'AIza_user_key_456',
        customBaseUrl: 'javascript:alert(1)',
        closeEmptyTabs: false,
        deterministicOptions: {
          minTabsPerGroup: 99,
          preserveExistingGroups: false,
        },
        customRules: [
          {
            id: 'r1',
            name: 'Work',
            emoji: '💼',
            color: 'blue',
            matchTarget: 'hostname',
            pattern: 'linear.app',
            isRegex: false,
            priority: -5,
            enabled: true,
          },
          {
            id: 'broken-rule',
            name: '',
            pattern: '',
          },
        ],
      },
    });
    const repo = new SettingsRepository(storage);

    const migrated = await repo.loadSettings();

    expect(migrated.theme).toBe('midnight-nebula');
    expect(migrated.mode).toBe('meaning');
    expect(migrated.aiProvider).toBe('gemini');
    expect(migrated.groqApiKey).toBe('gsk_user_key_123');
    expect(migrated.geminiApiKey).toBe('AIza_user_key_456');
    expect(migrated.customBaseUrl).toBe('https://api.openai.com/v1');
    expect(migrated.closeEmptyTabs).toBe(false);
    expect(migrated.maxTabsPerGroup).toBe(8);
    expect(migrated.deterministicOptions.minTabsPerGroup).toBe(20);
    expect(migrated.deterministicOptions.preserveExistingGroups).toBe(false);
    expect(migrated.customRules).toHaveLength(1);
    expect(migrated.customRules[0]?.priority).toBe(0);

    // Subsequent loads read v2 directly without overwriting v2 changes
    await repo.updateSettings({ maxTabsPerGroup: 10 });
    const reloaded = await repo.loadSettings();
    expect(reloaded.maxTabsPerGroup).toBe(10);
  });

  it('saves, loads, and clears UndoSnapshot safely', async () => {
    const storage = new MemoryStorageAdapter();
    const repo = new SettingsRepository(storage);

    expect(await repo.loadUndoSnapshot()).toBeNull();

    await repo.saveUndoSnapshot({
      timestamp: 1000,
      windowId: 42,
      entries: [
        {
          tabId: 1,
          index: 0,
          previousGroupId: 7,
          groupTitle: '💻 Dev',
          groupColor: 'purple',
          groupCollapsed: false,
        },
      ],
    });

    const loaded = await repo.loadUndoSnapshot();
    expect(loaded?.windowId).toBe(42);
    expect(loaded?.entries).toHaveLength(1);

    await repo.clearUndoSnapshot();
    expect(await repo.loadUndoSnapshot()).toBeNull();
  });
});

describe('ConfigPortabilityUseCase (export & v1/v2 import)', () => {
  it('exports v2 schema without exposing any raw API keys', async () => {
    const storage = new MemoryStorageAdapter();
    const repo = new SettingsRepository(storage);
    const portability = new ConfigPortabilityUseCase(repo, fixedClock);

    const settings = await repo.updateSettings({
      theme: 'arctic-frost',
      groqApiKey: 'gsk_secret_do_not_export',
      geminiApiKey: 'AIza_secret_do_not_export',
      customApiKey: 'sk-secret_do_not_export',
      maxTabsPerGroup: 10,
    });

    const exported = portability.exportConfig(settings);
    const json = JSON.stringify(exported);

    expect(exported.version).toBe(2);
    expect(exported.schemaVersion).toBe(2);
    expect(exported.exportedAt).toBe('2026-11-13T18:00:00.000Z');
    expect(exported.maxTabsPerGroup).toBe(10);
    expect(json).not.toContain('gsk_secret_do_not_export');
    expect(json).not.toContain('AIza_secret_do_not_export');
    expect(json).not.toContain('sk-secret_do_not_export');
    expect('groqApiKey' in exported).toBe(false);
    expect('geminiApiKey' in exported).toBe(false);
    expect('customApiKey' in exported).toBe(false);
  });

  it('imports a v1 config transparently and preserves existing API keys', async () => {
    const storage = new MemoryStorageAdapter();
    const repo = new SettingsRepository(storage);
    const portability = new ConfigPortabilityUseCase(repo, fixedClock);

    await repo.updateSettings({
      groqApiKey: 'existing_groq_key',
      geminiApiKey: 'existing_gemini_key',
      customApiKey: 'existing_custom_key',
      maxTabsPerGroup: 12,
    });

    const v1Json = JSON.stringify({
      version: 1,
      exportedAt: '2026-10-01T12:00:00.000Z',
      theme: 'emerald-forest',
      mode: 'meaning',
      aiProvider: 'groq',
      groqModel: 'llama-3.3-70b-versatile',
      // Attempt to inject keys via JSON must be ignored
      groqApiKey: 'injected_bad_key',
      geminiApiKey: '',
      collapseOthersOnGroup: false,
      deterministicOptions: {
        mergeSubdomains: false,
        minTabsPerGroup: 2,
      },
      customRules: [
        {
          id: 'rule-v1',
          name: 'Infra',
          emoji: '🛠️',
          color: 'cyan',
          matchTarget: 'hostname',
          pattern: 'grafana.internal, prometheus.internal',
          isRegex: false,
          priority: 5,
          enabled: true,
        },
      ],
    });

    const result = await portability.importConfig(v1Json);

    expect(result.success).toBe(true);
    expect(result.importedVersion).toBe(1);
    expect(result.settings?.theme).toBe('emerald-forest');
    expect(result.settings?.mode).toBe('meaning');
    expect(result.settings?.collapseOthersOnGroup).toBe(false);
    expect(result.settings?.maxTabsPerGroup).toBe(12);
    expect(result.settings?.deterministicOptions.mergeSubdomains).toBe(false);
    expect(result.settings?.deterministicOptions.minTabsPerGroup).toBe(2);
    expect(result.settings?.customRules).toHaveLength(1);
    expect(result.settings?.customRules[0]?.id).toBe('rule-v1');
    // Existing API keys must remain completely untouched
    expect(result.settings?.groqApiKey).toBe('existing_groq_key');
    expect(result.settings?.geminiApiKey).toBe('existing_gemini_key');
    expect(result.settings?.customApiKey).toBe('existing_custom_key');
  });

  it('imports a v2 config and validates numeric ranges, colors, targets, and URLs', async () => {
    const storage = new MemoryStorageAdapter();
    const repo = new SettingsRepository(storage);
    const portability = new ConfigPortabilityUseCase(repo, fixedClock);

    const v2Json = JSON.stringify({
      version: 2,
      schemaVersion: 2,
      theme: 'invalid-theme',
      mode: 'invalid-mode',
      customBaseUrl: 'ftp://not-allowed.example',
      maxTabsPerGroup: 1, // clamped to 2
      customRules: [
        {
          id: 'r-valid',
          name: 'Docs',
          emoji: '📚',
          color: 'not-a-chrome-color',
          matchTarget: 'not-a-target',
          pattern: 'docs.rs',
          isRegex: false,
          priority: 1500, // clamped to 999
          enabled: true,
        },
      ],
    });

    const result = await portability.importConfig(v2Json);

    expect(result.success).toBe(true);
    expect(result.importedVersion).toBe(2);
    expect(result.warnings.length).toBeGreaterThanOrEqual(3);
    expect(result.settings?.theme).toBe('prism-deep');
    expect(result.settings?.mode).toBe('logic');
    expect(result.settings?.customBaseUrl).toBe('https://api.openai.com/v1');
    expect(result.settings?.maxTabsPerGroup).toBe(2);
    expect(result.settings?.customRules[0]?.color).toBe('blue');
    expect(result.settings?.customRules[0]?.matchTarget).toBe('hostname');
    expect(result.settings?.customRules[0]?.priority).toBe(999);
  });

  it('rejects malformed JSON, non-object payloads, and unsupported versions cleanly', async () => {
    const storage = new MemoryStorageAdapter();
    const repo = new SettingsRepository(storage);
    const portability = new ConfigPortabilityUseCase(repo, fixedClock);

    const badJson = await portability.importConfig('{not valid json');
    expect(badJson.success).toBe(false);

    const arrayJson = await portability.importConfig('[]');
    expect(arrayJson.success).toBe(false);

    const unsupportedVer = await portability.importConfig(JSON.stringify({ version: 99 }));
    expect(unsupportedVer.success).toBe(false);
    expect(unsupportedVer.message).toContain('99');
  });

  it('upgrades legacy v2 minTabsPerGroup: 1 -> 2 once without overriding subsequent manual user changes', async () => {
    const storage = new MemoryStorageAdapter({
      [SETTINGS_V2_STORAGE_KEY]: {
        deterministicOptions: {
          minTabsPerGroup: 1,
        },
      },
    });
    const repo = new SettingsRepository(storage);

    const firstLoad = await repo.loadSettings();
    expect(firstLoad.deterministicOptions.minTabsPerGroup).toBe(2);

    // If user explicitly chooses 1 afterward, future loads must respect user preference
    await repo.updateSettings({
      deterministicOptions: {
        ...firstLoad.deterministicOptions,
        minTabsPerGroup: 1,
      },
    });
    const secondLoad = await repo.loadSettings();
    expect(secondLoad.deterministicOptions.minTabsPerGroup).toBe(1);
  });
});
