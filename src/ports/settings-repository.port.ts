import type { PrismSettings, UndoSnapshot } from '../domain/types';

export interface SettingsRepositoryPort {
  loadSettings(): Promise<PrismSettings>;
  saveSettings(settings: PrismSettings): Promise<PrismSettings>;
  updateSettings(patch: Partial<PrismSettings>): Promise<PrismSettings>;
  loadUndoSnapshot(): Promise<UndoSnapshot | null>;
  saveUndoSnapshot(snapshot: UndoSnapshot): Promise<void>;
  clearUndoSnapshot(): Promise<void>;
}
