import {
  DEFAULT_DETERMINISTIC_OPTIONS,
  DEFAULT_DETERMINISTIC_RULES,
} from '../engine/deterministic';
import { DEFAULT_PROMPT_PRESETS } from '../engine/semantic';
import { AiProvider, PrismSettings } from '../engine/types';

/**
 * Reads `VITE_GROQ_API_KEY` from `.env.local` if available during build/dev initialization.
 * Uses direct `import.meta.env.VITE_GROQ_API_KEY` access so Vite statically replaces it at build time.
 */
export function getEnvGroqApiKey(): string {
  try {
    const envVal = import.meta.env.VITE_GROQ_API_KEY;
    return typeof envVal === 'string' ? envVal.trim() : '';
  } catch {
    return '';
  }
}

export const DEFAULT_PRISM_SETTINGS: PrismSettings = {
  theme: 'prism-deep',
  mode: 'logic',
  aiProvider: 'groq',
  groqApiKey: getEnvGroqApiKey(),
  groqModel: 'llama-3.3-70b-versatile',
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  customApiKey: '',
  customBaseUrl: 'https://api.openai.com/v1',
  customModel: 'gpt-4o-mini',
  customPromptDirective: DEFAULT_PROMPT_PRESETS[0].directive,
  promptPresets: DEFAULT_PROMPT_PRESETS,
  collapseOthersOnGroup: true,
  closeEmptyTabs: true,
  closeYouTubeHomeTabs: false,
  deterministicOptions: DEFAULT_DETERMINISTIC_OPTIONS,
  customRules: DEFAULT_DETERMINISTIC_RULES,
};

/**
 * Resolves the active AI provider credentials and model from `PrismSettings`.
 */
export function getActiveProviderConfig(settings: PrismSettings): {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
} {
  const envKey = getEnvGroqApiKey();
  if (settings.aiProvider === 'groq') {
    return {
      provider: 'groq',
      apiKey: settings.groqApiKey?.trim() || envKey,
      model: settings.groqModel || 'llama-3.3-70b-versatile',
    };
  }
  if (settings.aiProvider === 'custom') {
    return {
      provider: 'custom',
      apiKey: settings.customApiKey,
      model: settings.customModel || 'gpt-4o-mini',
      baseUrl: settings.customBaseUrl || 'https://api.openai.com/v1',
    };
  }
  return {
    provider: 'gemini',
    apiKey: settings.geminiApiKey,
    model: settings.geminiModel || 'gemini-2.5-flash',
  };
}

const SETTINGS_STORAGE_KEY = 'prism_settings_v1';
const UNDO_SNAPSHOT_STORAGE_KEY = 'prism_last_undo_v1';

// In-memory fallback for tests or environments where chrome.storage is unavailable
const memoryFallback = new Map<string, unknown>();

function isStorageAvailable(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.storage !== 'undefined' &&
    typeof chrome.storage.local !== 'undefined'
  );
}

async function rawGet<T>(key: string): Promise<T | undefined> {
  if (isStorageAvailable()) {
    const res = await chrome.storage.local.get(key);
    return res[key] as T | undefined;
  }
  if (typeof localStorage !== 'undefined') {
    const val = localStorage.getItem(key);
    if (!val) return undefined;
    try {
      return JSON.parse(val) as T;
    } catch {
      return undefined;
    }
  }
  return memoryFallback.get(key) as T | undefined;
}

async function rawSet<T>(key: string, value: T): Promise<void> {
  if (isStorageAvailable()) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }
  memoryFallback.set(key, value);
}

async function rawRemove(key: string): Promise<void> {
  if (isStorageAvailable()) {
    await chrome.storage.local.remove(key);
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
    return;
  }
  memoryFallback.delete(key);
}

export async function loadSettings(): Promise<PrismSettings> {
  const stored = await rawGet<Partial<PrismSettings>>(SETTINGS_STORAGE_KEY);
  const envGroqKey = getEnvGroqApiKey();

  if (!stored) {
    const initial: PrismSettings = {
      ...DEFAULT_PRISM_SETTINGS,
      theme: 'prism-deep',
      groqApiKey: envGroqKey,
    };
    await rawSet(SETTINGS_STORAGE_KEY, initial);
    return initial;
  }

  const resolvedGroqKey = stored.groqApiKey?.trim() || envGroqKey;

  const merged: PrismSettings = {
    ...DEFAULT_PRISM_SETTINGS,
    theme: stored.theme || 'prism-deep',
    ...stored,
    groqApiKey: resolvedGroqKey,
    closeEmptyTabs: stored.closeEmptyTabs ?? true,
    closeYouTubeHomeTabs: stored.closeYouTubeHomeTabs ?? false,
    deterministicOptions: {
      ...DEFAULT_DETERMINISTIC_OPTIONS,
      ...(stored.deterministicOptions ?? {}),
    },
    customRules:
      Array.isArray(stored.customRules) && stored.customRules.length > 0
        ? stored.customRules
        : DEFAULT_DETERMINISTIC_RULES,
    promptPresets: (() => {
      if (!Array.isArray(stored.promptPresets) || stored.promptPresets.length === 0) {
        return DEFAULT_PROMPT_PRESETS;
      }
      const existingIds = new Set(stored.promptPresets.map((p) => p.id));
      const missingDefaults = DEFAULT_PROMPT_PRESETS.filter((p) => !existingIds.has(p.id));
      return missingDefaults.length > 0
        ? [...stored.promptPresets, ...missingDefaults]
        : stored.promptPresets;
    })(),
  };

  // Persist auto-seeded VITE_GROQ_API_KEY into chrome.storage.local if it wasn't saved yet
  if (!stored.groqApiKey?.trim() && envGroqKey) {
    await rawSet(SETTINGS_STORAGE_KEY, merged);
  }

  return merged;
}

export async function saveSettings(
  updates: Partial<PrismSettings>
): Promise<PrismSettings> {
  const current = await loadSettings();
  const next: PrismSettings = {
    ...current,
    ...updates,
    deterministicOptions: {
      ...current.deterministicOptions,
      ...(updates.deterministicOptions ?? {}),
    },
  };
  await rawSet(SETTINGS_STORAGE_KEY, next);
  return next;
}

export async function loadLastUndoSnapshot(): Promise<import('../engine/types').UndoSnapshot | null> {
  const snapshot = await rawGet<import('../engine/types').UndoSnapshot>(
    UNDO_SNAPSHOT_STORAGE_KEY
  );
  return snapshot ?? null;
}

export async function saveLastUndoSnapshot(
  snapshot: import('../engine/types').UndoSnapshot
): Promise<void> {
  await rawSet(UNDO_SNAPSHOT_STORAGE_KEY, snapshot);
}

export async function clearLastUndoSnapshot(): Promise<void> {
  await rawRemove(UNDO_SNAPSHOT_STORAGE_KEY);
}
