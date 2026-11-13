import { createDefaultSettings, DEFAULT_MAX_TABS_PER_GROUP } from '../../domain/defaults';
import type { PrismSettings, UndoSnapshot } from '../../domain/types';
import { mergeAndValidateSettings } from '../../domain/validators';
import type { SettingsRepositoryPort } from '../../ports/settings-repository.port';
import type { StoragePort } from '../../ports/storage.port';

export const SETTINGS_V2_STORAGE_KEY = 'prism_settings_v2';
export const SETTINGS_V1_STORAGE_KEY = 'prism_settings_v1';
export const UNDO_V2_STORAGE_KEY = 'prism_last_undo_v2';
const LOGIC_V2_MIN_TABS_MIGRATED_KEY = 'prism_logic_v2_min_tabs_migrated';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export class SettingsRepository implements SettingsRepositoryPort {
  constructor(private readonly storage: StoragePort) {}

  async loadSettings(): Promise<PrismSettings> {
    const storedV2 = await this.storage.get<unknown>(SETTINGS_V2_STORAGE_KEY);
    if (isRecord(storedV2)) {
      const loaded = mergeAndValidateSettings(storedV2, createDefaultSettings());
      const alreadyMigrated = await this.storage.get<boolean>(LOGIC_V2_MIN_TABS_MIGRATED_KEY);
      if (!alreadyMigrated) {
        await this.storage.set(LOGIC_V2_MIN_TABS_MIGRATED_KEY, true);
        if (loaded.deterministicOptions.minTabsPerGroup === 1) {
          const upgraded: PrismSettings = {
            ...loaded,
            deterministicOptions: {
              ...loaded.deterministicOptions,
              minTabsPerGroup: 2,
            },
          };
          await this.storage.set(SETTINGS_V2_STORAGE_KEY, upgraded);
          return upgraded;
        }
      }
      return loaded;
    }

    // One-time lazy migration from v1 storage key if present
    const storedV1 = await this.storage.get<unknown>(SETTINGS_V1_STORAGE_KEY);
    if (isRecord(storedV1)) {
      const defaults = createDefaultSettings();
      const migrated = mergeAndValidateSettings(
        {
          ...storedV1,
          maxTabsPerGroup: DEFAULT_MAX_TABS_PER_GROUP,
        },
        defaults,
      );
      await this.storage.set(SETTINGS_V2_STORAGE_KEY, migrated);
      await this.storage.set(LOGIC_V2_MIN_TABS_MIGRATED_KEY, true);
      return migrated;
    }

    const initial = createDefaultSettings();
    await this.storage.set(SETTINGS_V2_STORAGE_KEY, initial);
    await this.storage.set(LOGIC_V2_MIN_TABS_MIGRATED_KEY, true);
    return initial;
  }

  async saveSettings(settings: PrismSettings): Promise<PrismSettings> {
    const validated = mergeAndValidateSettings(settings, createDefaultSettings());
    await this.storage.set(SETTINGS_V2_STORAGE_KEY, validated);
    await this.storage.set(LOGIC_V2_MIN_TABS_MIGRATED_KEY, true);
    return validated;
  }

  async updateSettings(patch: Partial<PrismSettings>): Promise<PrismSettings> {
    const current = await this.loadSettings();
    const next = mergeAndValidateSettings(patch, current);
    await this.storage.set(SETTINGS_V2_STORAGE_KEY, next);
    await this.storage.set(LOGIC_V2_MIN_TABS_MIGRATED_KEY, true);
    return next;
  }

  async loadUndoSnapshot(): Promise<UndoSnapshot | null> {
    const snapshot = await this.storage.get<UndoSnapshot>(UNDO_V2_STORAGE_KEY);
    if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.entries)) {
      return null;
    }
    return snapshot;
  }

  async saveUndoSnapshot(snapshot: UndoSnapshot): Promise<void> {
    await this.storage.set(UNDO_V2_STORAGE_KEY, snapshot);
  }

  async clearUndoSnapshot(): Promise<void> {
    await this.storage.remove(UNDO_V2_STORAGE_KEY);
  }
}
