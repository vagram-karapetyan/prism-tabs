import {
  DEFAULT_DETERMINISTIC_OPTIONS,
  DEFAULT_DETERMINISTIC_RULES,
} from '../engine/deterministic';
import { DEFAULT_PROMPT_PRESETS } from '../engine/semantic';
import { AiProvider, PrismSettings, UndoSnapshot } from '../engine/types';

const SETTINGS_STORAGE_KEY = 'prism_settings_v1';
const UNDO_STORAGE_KEY = 'prism_last_undo_v1';

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
  if (settings.aiProvider === 'groq') {
    const groqKey = settings.groqApiKey?.trim() || getEnvGroqApiKey();
    return {
      provider: 'groq',
      apiKey: groqKey,
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

const memoryFallbackStore = new Map<string, unknown>();

function hasChromeStorage(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.storage !== 'undefined' &&
    typeof chrome.storage.local !== 'undefined'
  );
}

async function rawGet<T>(key: string): Promise<T | undefined> {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(key);
    return result[key] as T | undefined;
  }
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }
  return memoryFallbackStore.get(key) as T | undefined;
}

async function rawSet<T>(key: string, value: T): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }
  memoryFallbackStore.set(key, value);
}

async function rawRemove(key: string): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.remove(key);
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
    return;
  }
  memoryFallbackStore.delete(key);
}

export async function loadSettings(): Promise<PrismSettings> {
  const stored = await rawGet<Partial<PrismSettings>>(SETTINGS_STORAGE_KEY);
  const envGroqKey = getEnvGroqApiKey();

  if (!stored) {
    const initial: PrismSettings = {
      ...DEFAULT_PRISM_SETTINGS,
      groqApiKey: envGroqKey,
    };
    await rawSet(SETTINGS_STORAGE_KEY, initial);
    return initial;
  }

  const resolvedGroqKey = stored.groqApiKey?.trim() || envGroqKey;

  const merged: PrismSettings = {
    ...DEFAULT_PRISM_SETTINGS,
    ...stored,
    groqApiKey: resolvedGroqKey,
    closeEmptyTabs: stored.closeEmptyTabs ?? true,
    deterministicOptions: {
      ...DEFAULT_DETERMINISTIC_OPTIONS,
      ...(stored.deterministicOptions ?? {}),
    },
    customRules:
      Array.isArray(stored.customRules) && stored.customRules.length > 0
        ? stored.customRules
        : DEFAULT_DETERMINISTIC_RULES,
    promptPresets:
      Array.isArray(stored.promptPresets) && stored.promptPresets.length > 0
        ? stored.promptPresets
        : DEFAULT_PROMPT_PRESETS,
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
  const merged: PrismSettings = {
    ...current,
    ...updates,
    deterministicOptions: {
      ...current.deterministicOptions,
      ...(updates.deterministicOptions ?? {}),
    },
  };
  await rawSet(SETTINGS_STORAGE_KEY, merged);
  return merged;
}

export async function loadLastUndoSnapshot(): Promise<UndoSnapshot | null> {
  const snapshot = await rawGet<UndoSnapshot>(UNDO_STORAGE_KEY);
  return snapshot ?? null;
}

export async function saveLastUndoSnapshot(snapshot: UndoSnapshot): Promise<void> {
  await rawSet(UNDO_STORAGE_KEY, snapshot);
}

export async function clearLastUndoSnapshot(): Promise<void> {
  await rawRemove(UNDO_STORAGE_KEY);
}
