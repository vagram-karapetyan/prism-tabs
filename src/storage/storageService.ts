import {
  DEFAULT_DETERMINISTIC_OPTIONS,
  DEFAULT_DETERMINISTIC_RULES,
} from '../engine/deterministic';
import { DEFAULT_PROMPT_PRESETS } from '../engine/semantic';
import {
  AiProvider,
  PrismExportConfig,
  PrismSettings,
} from '../engine/types';

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
  discardInactiveTabs: false,
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

/**
 * Safely accesses window.localStorage in browser runtime without triggering
 * Node 22's experimental globalThis.localStorage warning during unit tests.
 */
export function getBrowserLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

async function rawGet<T>(key: string): Promise<T | undefined> {
  if (isStorageAvailable()) {
    const res = await chrome.storage.local.get(key);
    return res[key] as T | undefined;
  }
  const local = getBrowserLocalStorage();
  if (local) {
    const val = local.getItem(key);
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
  const local = getBrowserLocalStorage();
  if (local) {
    local.setItem(key, JSON.stringify(value));
    return;
  }
  memoryFallback.set(key, value);
}

async function rawRemove(key: string): Promise<void> {
  if (isStorageAvailable()) {
    await chrome.storage.local.remove(key);
    return;
  }
  const local = getBrowserLocalStorage();
  if (local) {
    local.removeItem(key);
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
    discardInactiveTabs: stored.discardInactiveTabs ?? false,
    deterministicOptions: {
      ...DEFAULT_DETERMINISTIC_OPTIONS,
      ...(stored.deterministicOptions ?? {}),
    },
    customRules:
      Array.isArray(stored.customRules) && stored.customRules.length > 0
        ? stored.customRules
        : DEFAULT_DETERMINISTIC_RULES,
    customPromptDirective:
      stored.customPromptDirective &&
      stored.customPromptDirective !== 'Cluster tabs by high-level task intent across different domains (e.g., grouping a GitHub PR, a Linear ticket, and a Vercel preview deployment for the same feature together).'
        ? stored.customPromptDirective
        : DEFAULT_PROMPT_PRESETS[0].directive,
    promptPresets: (() => {
      if (!Array.isArray(stored.promptPresets) || stored.promptPresets.length === 0) {
        return DEFAULT_PROMPT_PRESETS;
      }
      const legacyDefaultIds = new Set([
        'preset-task-intent',
        'preset-youtube-topics',
        'preset-project-urgency',
        'preset-dev-vs-personal',
        'preset-shopping-gifts',
      ]);
      const customUserPresets = stored.promptPresets.filter((p) => !legacyDefaultIds.has(p.id));
      const hasMagic = stored.promptPresets.some((p) => p.id === 'preset-magic-smart');
      if (!hasMagic) {
        return [DEFAULT_PROMPT_PRESETS[0], ...customUserPresets];
      }
      return stored.promptPresets;
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

/**
 * Creates a clean JSON export object of the user's Prism configuration.
 * Intentionally excludes raw private API keys for security and privacy.
 */
export function exportPrismConfig(settings: PrismSettings): PrismExportConfig {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    theme: settings.theme,
    mode: settings.mode,
    aiProvider: settings.aiProvider,
    groqModel: settings.groqModel,
    geminiModel: settings.geminiModel,
    customBaseUrl: settings.customBaseUrl,
    customModel: settings.customModel,
    customPromptDirective: settings.customPromptDirective,
    promptPresets: settings.promptPresets,
    collapseOthersOnGroup: settings.collapseOthersOnGroup,
    closeEmptyTabs: settings.closeEmptyTabs,
    closeYouTubeHomeTabs: settings.closeYouTubeHomeTabs,
    discardInactiveTabs: settings.discardInactiveTabs,
    deterministicOptions: settings.deterministicOptions,
    customRules: settings.customRules,
  };
}

/**
 * Validates and imports a JSON configuration file, merging rules, presets, and behavior settings
 * safely into storage without breaking or clobbering existing API keys.
 */
export async function importPrismConfig(
  jsonContent: string
): Promise<{ success: boolean; message: string; settings?: PrismSettings }> {
  try {
    const raw = JSON.parse(jsonContent) as Partial<PrismExportConfig>;
    if (!raw || typeof raw !== 'object') {
      return { success: false, message: 'Invalid configuration file: not a JSON object.' };
    }

    const updates: Partial<PrismSettings> = {};

    if (raw.theme && typeof raw.theme === 'string') {
      updates.theme = raw.theme;
    }
    if (raw.mode === 'logic' || raw.mode === 'meaning') {
      updates.mode = raw.mode;
    }
    if (raw.aiProvider === 'groq' || raw.aiProvider === 'gemini' || raw.aiProvider === 'custom') {
      updates.aiProvider = raw.aiProvider;
    }
    if (typeof raw.groqModel === 'string') updates.groqModel = raw.groqModel;
    if (typeof raw.geminiModel === 'string') updates.geminiModel = raw.geminiModel;
    if (typeof raw.customBaseUrl === 'string') updates.customBaseUrl = raw.customBaseUrl;
    if (typeof raw.customModel === 'string') updates.customModel = raw.customModel;
    if (typeof raw.customPromptDirective === 'string') {
      updates.customPromptDirective = raw.customPromptDirective;
    }

    if (Array.isArray(raw.promptPresets)) {
      const validPresets = raw.promptPresets.filter(
        (p) => p && typeof p.id === 'string' && typeof p.label === 'string' && typeof p.directive === 'string'
      );
      if (validPresets.length > 0) {
        updates.promptPresets = validPresets;
      }
    }

    if (typeof raw.collapseOthersOnGroup === 'boolean') {
      updates.collapseOthersOnGroup = raw.collapseOthersOnGroup;
    }
    if (typeof raw.closeEmptyTabs === 'boolean') {
      updates.closeEmptyTabs = raw.closeEmptyTabs;
    }
    if (typeof raw.closeYouTubeHomeTabs === 'boolean') {
      updates.closeYouTubeHomeTabs = raw.closeYouTubeHomeTabs;
    }
    if (typeof raw.discardInactiveTabs === 'boolean') {
      updates.discardInactiveTabs = raw.discardInactiveTabs;
    }

    if (raw.deterministicOptions && typeof raw.deterministicOptions === 'object') {
      updates.deterministicOptions = {
        ...DEFAULT_DETERMINISTIC_OPTIONS,
        ...raw.deterministicOptions,
      };
    }

    if (Array.isArray(raw.customRules)) {
      const validRules = raw.customRules.filter(
        (r) =>
          r &&
          typeof r.id === 'string' &&
          typeof r.name === 'string' &&
          typeof r.pattern === 'string' &&
          typeof r.color === 'string'
      );
      if (validRules.length > 0) {
        updates.customRules = validRules;
      }
    }

    const saved = await saveSettings(updates);
    const ruleCount = updates.customRules?.length ?? 0;
    const presetCount = updates.promptPresets?.length ?? 0;

    return {
      success: true,
      message: `Imported config successfully (${ruleCount} rules, ${presetCount} presets)`,
      settings: saved,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to parse configuration file',
    };
  }
}
