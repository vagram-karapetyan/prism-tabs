import { createDefaultSettings, DEFAULT_MAX_TABS_PER_GROUP } from './defaults';
import { isValidThemeId } from './themes';
import {
  CHROME_TAB_GROUP_COLORS,
  GEMINI_MODEL_POOL,
  GROQ_MODEL_POOL,
  RULE_MATCH_TARGETS,
  type AiProvider,
  type ChromeTabGroupColor,
  type CustomPromptPreset,
  type DeterministicOptions,
  type DeterministicRule,
  type EngineMode,
  type GeminiModelId,
  type GroqModelId,
  type MaxTabsPerGroup,
  type PrismSettings,
  type RuleMatchTarget,
} from './types';

const COLOR_SET = new Set<string>(CHROME_TAB_GROUP_COLORS);
const TARGET_SET = new Set<string>(RULE_MATCH_TARGETS);
const GROQ_SET = new Set<string>(GROQ_MODEL_POOL);
const GEMINI_SET = new Set<string>(GEMINI_MODEL_POOL);

export function isValidChromeColor(value: unknown): value is ChromeTabGroupColor {
  return typeof value === 'string' && COLOR_SET.has(value);
}

export function isValidRuleTarget(value: unknown): value is RuleMatchTarget {
  return typeof value === 'string' && TARGET_SET.has(value);
}

export function isValidEngineMode(value: unknown): value is EngineMode {
  return value === 'logic' || value === 'meaning';
}

export function isValidAiProvider(value: unknown): value is AiProvider {
  return value === 'groq' || value === 'gemini' || value === 'custom';
}

export function isValidGroqModel(value: unknown): value is GroqModelId {
  return typeof value === 'string' && GROQ_SET.has(value);
}

export function isValidGeminiModel(value: unknown): value is GeminiModelId {
  return typeof value === 'string' && GEMINI_SET.has(value);
}

export function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeMaxTabsPerGroup(
  value: unknown,
  fallback: MaxTabsPerGroup = DEFAULT_MAX_TABS_PER_GROUP,
): MaxTabsPerGroup {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = Math.round(value);
    if (rounded <= 0) return null;
    return Math.min(50, Math.max(2, rounded));
  }
  return fallback;
}

export function normalizeMinTabsPerGroup(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(20, Math.max(1, Math.round(value)));
  }
  return fallback;
}

export function sanitizeDeterministicOptions(
  raw: unknown,
  base: DeterministicOptions,
): DeterministicOptions {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...base };
  }
  const obj = raw as Record<string, unknown>;
  return {
    mergeSubdomains:
      typeof obj['mergeSubdomains'] === 'boolean' ? obj['mergeSubdomains'] : base.mergeSubdomains,
    groupByFirstPathSegment:
      typeof obj['groupByFirstPathSegment'] === 'boolean'
        ? obj['groupByFirstPathSegment']
        : base.groupByFirstPathSegment,
    minTabsPerGroup: normalizeMinTabsPerGroup(obj['minTabsPerGroup'], base.minTabsPerGroup),
    groupSingletonsIntoMisc:
      typeof obj['groupSingletonsIntoMisc'] === 'boolean'
        ? obj['groupSingletonsIntoMisc']
        : base.groupSingletonsIntoMisc,
    ignorePinnedTabs:
      typeof obj['ignorePinnedTabs'] === 'boolean' ? obj['ignorePinnedTabs'] : base.ignorePinnedTabs,
    preserveExistingGroups:
      typeof obj['preserveExistingGroups'] === 'boolean'
        ? obj['preserveExistingGroups']
        : base.preserveExistingGroups,
  };
}

export function sanitizeDeterministicRule(raw: unknown): DeterministicRule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const id = typeof obj['id'] === 'string' ? obj['id'].trim() : '';
  const name = typeof obj['name'] === 'string' ? obj['name'].trim() : '';
  const pattern = typeof obj['pattern'] === 'string' ? obj['pattern'].trim() : '';
  if (!id || !name || !pattern) {
    return null;
  }

  const rawPriority = obj['priority'];
  const priority =
    typeof rawPriority === 'number' && Number.isFinite(rawPriority)
      ? Math.min(999, Math.max(0, Math.round(rawPriority)))
      : 50;

  return {
    id,
    name: name.slice(0, 48),
    emoji:
      typeof obj['emoji'] === 'string' && obj['emoji'].trim().length > 0
        ? obj['emoji'].trim().slice(0, 8)
        : '🏷️',
    color: isValidChromeColor(obj['color']) ? obj['color'] : 'blue',
    matchTarget: isValidRuleTarget(obj['matchTarget']) ? obj['matchTarget'] : 'hostname',
    pattern,
    isRegex: typeof obj['isRegex'] === 'boolean' ? obj['isRegex'] : false,
    priority,
    enabled: typeof obj['enabled'] === 'boolean' ? obj['enabled'] : true,
  };
}

export function sanitizeDeterministicRules(raw: unknown): DeterministicRule[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seenIds = new Set<string>();
  const valid: DeterministicRule[] = [];
  for (const item of raw) {
    const rule = sanitizeDeterministicRule(item);
    if (rule && !seenIds.has(rule.id)) {
      seenIds.add(rule.id);
      valid.push(rule);
    }
  }
  return valid;
}

export function sanitizePromptPreset(raw: unknown): CustomPromptPreset | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const id = typeof obj['id'] === 'string' ? obj['id'].trim() : '';
  const label = typeof obj['label'] === 'string' ? obj['label'].trim() : '';
  const directive = typeof obj['directive'] === 'string' ? obj['directive'].trim() : '';
  if (!id || !label || !directive) {
    return null;
  }
  return {
    id,
    label: label.slice(0, 64),
    directive: directive.slice(0, 2000),
  };
}

export function sanitizePromptPresets(raw: unknown): CustomPromptPreset[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seenIds = new Set<string>();
  const valid: CustomPromptPreset[] = [];
  for (const item of raw) {
    const preset = sanitizePromptPreset(item);
    if (preset && !seenIds.has(preset.id)) {
      seenIds.add(preset.id);
      valid.push(preset);
    }
  }
  return valid;
}

export interface SanitizeSettingsOptions {
  /** When true, API keys in `raw` are ignored (used for portable JSON import). */
  ignoreApiKeys?: boolean;
}

/**
 * Merges an untrusted/partial settings record onto `base` with strict field validation.
 */
export function mergeAndValidateSettings(
  raw: unknown,
  base: PrismSettings = createDefaultSettings(),
  options: SanitizeSettingsOptions = {},
): PrismSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return base;
  }
  const obj = raw as Record<string, unknown>;

  const nextPresets = sanitizePromptPresets(obj['promptPresets']);
  const nextRules = sanitizeDeterministicRules(obj['customRules']);

  const merged: PrismSettings = {
    theme: isValidThemeId(obj['theme']) ? obj['theme'] : base.theme,
    mode: isValidEngineMode(obj['mode']) ? obj['mode'] : base.mode,
    aiProvider: isValidAiProvider(obj['aiProvider']) ? obj['aiProvider'] : base.aiProvider,
    groqApiKey:
      !options.ignoreApiKeys && typeof obj['groqApiKey'] === 'string'
        ? obj['groqApiKey'].trim()
        : base.groqApiKey,
    groqModel: isValidGroqModel(obj['groqModel']) ? obj['groqModel'] : base.groqModel,
    geminiApiKey:
      !options.ignoreApiKeys && typeof obj['geminiApiKey'] === 'string'
        ? obj['geminiApiKey'].trim()
        : base.geminiApiKey,
    geminiModel: isValidGeminiModel(obj['geminiModel']) ? obj['geminiModel'] : base.geminiModel,
    customApiKey:
      !options.ignoreApiKeys && typeof obj['customApiKey'] === 'string'
        ? obj['customApiKey'].trim()
        : base.customApiKey,
    customBaseUrl: isValidHttpUrl(obj['customBaseUrl'])
      ? obj['customBaseUrl'].trim()
      : base.customBaseUrl,
    customModel:
      typeof obj['customModel'] === 'string' && obj['customModel'].trim().length > 0
        ? obj['customModel'].trim().slice(0, 128)
        : base.customModel,
    customPromptDirective:
      typeof obj['customPromptDirective'] === 'string'
        ? obj['customPromptDirective'].trim().slice(0, 2000)
        : base.customPromptDirective,
    promptPresets:
      nextPresets && nextPresets.length > 0
        ? nextPresets
        : base.promptPresets.map((p) => ({ ...p })),
    collapseOthersOnGroup:
      typeof obj['collapseOthersOnGroup'] === 'boolean'
        ? obj['collapseOthersOnGroup']
        : base.collapseOthersOnGroup,
    closeEmptyTabs:
      typeof obj['closeEmptyTabs'] === 'boolean' ? obj['closeEmptyTabs'] : base.closeEmptyTabs,
    closeYouTubeHomeTabs:
      typeof obj['closeYouTubeHomeTabs'] === 'boolean'
        ? obj['closeYouTubeHomeTabs']
        : base.closeYouTubeHomeTabs,
    discardInactiveTabs:
      typeof obj['discardInactiveTabs'] === 'boolean'
        ? obj['discardInactiveTabs']
        : base.discardInactiveTabs,
    maxTabsPerGroup:
      'maxTabsPerGroup' in obj
        ? normalizeMaxTabsPerGroup(obj['maxTabsPerGroup'], base.maxTabsPerGroup)
        : base.maxTabsPerGroup,
    deterministicOptions: sanitizeDeterministicOptions(
      obj['deterministicOptions'],
      base.deterministicOptions,
    ),
    customRules:
      nextRules !== undefined ? nextRules : base.customRules.map((r) => ({ ...r })),
  };

  return merged;
}
