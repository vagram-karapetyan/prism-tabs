import { isValidThemeId } from '../domain/themes';
import type { PrismExportConfig, PrismSettings } from '../domain/types';
import {
  isValidAiProvider,
  isValidEngineMode,
  isValidGeminiModel,
  isValidGroqModel,
  isValidHttpUrl,
  mergeAndValidateSettings,
  normalizeMaxTabsPerGroup,
  sanitizeDeterministicOptions,
  sanitizeDeterministicRules,
  sanitizePromptPresets,
} from '../domain/validators';
import type { ClockPort } from '../ports/clock.port';
import type { SettingsRepositoryPort } from '../ports/settings-repository.port';

export interface ImportConfigResult {
  success: boolean;
  message: string;
  settings?: PrismSettings;
  importedVersion?: 1 | 2;
  warnings: string[];
}

export class ConfigPortabilityUseCase {
  constructor(
    private readonly settingsRepo: SettingsRepositoryPort,
    private readonly clock: ClockPort,
  ) {}

  /**
   * Produces a portable JSON configuration payload.
   * Raw private API keys are intentionally excluded.
   */
  exportConfig(settings: PrismSettings): PrismExportConfig {
    return {
      version: 2,
      schemaVersion: 2,
      exportedAt: this.clock.nowIso(),
      theme: settings.theme,
      mode: settings.mode,
      aiProvider: settings.aiProvider,
      groqModel: settings.groqModel,
      geminiModel: settings.geminiModel,
      customBaseUrl: settings.customBaseUrl,
      customModel: settings.customModel,
      customPromptDirective: settings.customPromptDirective,
      promptPresets: settings.promptPresets.map((p) => ({ ...p })),
      collapseOthersOnGroup: settings.collapseOthersOnGroup,
      closeEmptyTabs: settings.closeEmptyTabs,
      closeYouTubeHomeTabs: settings.closeYouTubeHomeTabs,
      discardInactiveTabs: settings.discardInactiveTabs,
      maxTabsPerGroup: settings.maxTabsPerGroup,
      deterministicOptions: { ...settings.deterministicOptions },
      customRules: settings.customRules.map((r) => ({ ...r })),
    };
  }

  /**
   * Validates and imports a v1 or v2 JSON config while strictly preserving
   * existing user API keys.
   */
  async importConfig(jsonContent: string): Promise<ImportConfigResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonContent);
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? `Invalid JSON: ${err.message}` : 'Invalid JSON payload.',
        warnings: [],
      };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        success: false,
        message: 'Invalid configuration file: root value must be a JSON object.',
        warnings: [],
      };
    }

    const raw = parsed as Record<string, unknown>;
    const rawVersion = raw['version'];
    if (rawVersion !== 1 && rawVersion !== 2) {
      return {
        success: false,
        message: `Unsupported config version: ${String(rawVersion)}. Expected version 1 or 2.`,
        warnings: [],
      };
    }

    const current = await this.settingsRepo.loadSettings();
    const warnings: string[] = [];
    const patch: Partial<PrismSettings> = {};

    if ('theme' in raw) {
      if (isValidThemeId(raw['theme'])) {
        patch.theme = raw['theme'];
      } else {
        warnings.push('Ignored unrecognized theme value.');
      }
    }

    if ('mode' in raw) {
      if (isValidEngineMode(raw['mode'])) {
        patch.mode = raw['mode'];
      } else {
        warnings.push('Ignored invalid engine mode.');
      }
    }

    if ('aiProvider' in raw) {
      if (isValidAiProvider(raw['aiProvider'])) {
        patch.aiProvider = raw['aiProvider'];
      } else {
        warnings.push('Ignored invalid AI provider.');
      }
    }

    if ('groqModel' in raw) {
      if (isValidGroqModel(raw['groqModel'])) {
        patch.groqModel = raw['groqModel'];
      } else {
        warnings.push('Ignored unsupported Groq model.');
      }
    }

    if ('geminiModel' in raw) {
      if (isValidGeminiModel(raw['geminiModel'])) {
        patch.geminiModel = raw['geminiModel'];
      } else {
        warnings.push('Ignored unsupported Gemini model.');
      }
    }

    if ('customBaseUrl' in raw) {
      if (isValidHttpUrl(raw['customBaseUrl'])) {
        patch.customBaseUrl = raw['customBaseUrl'].trim();
      } else {
        warnings.push('Ignored invalid customBaseUrl (must be http/https).');
      }
    }

    if (typeof raw['customModel'] === 'string' && raw['customModel'].trim().length > 0) {
      patch.customModel = raw['customModel'].trim().slice(0, 128);
    }

    if (typeof raw['customPromptDirective'] === 'string') {
      patch.customPromptDirective = raw['customPromptDirective'].trim().slice(0, 2000);
    }

    if ('promptPresets' in raw) {
      const validPresets = sanitizePromptPresets(raw['promptPresets']);
      if (validPresets && validPresets.length > 0) {
        patch.promptPresets = validPresets;
      } else {
        warnings.push('Ignored invalid or empty promptPresets.');
      }
    }

    if (typeof raw['collapseOthersOnGroup'] === 'boolean') {
      patch.collapseOthersOnGroup = raw['collapseOthersOnGroup'];
    }
    if (typeof raw['closeEmptyTabs'] === 'boolean') {
      patch.closeEmptyTabs = raw['closeEmptyTabs'];
    }
    if (typeof raw['closeYouTubeHomeTabs'] === 'boolean') {
      patch.closeYouTubeHomeTabs = raw['closeYouTubeHomeTabs'];
    }
    if (typeof raw['discardInactiveTabs'] === 'boolean') {
      patch.discardInactiveTabs = raw['discardInactiveTabs'];
    }

    if ('maxTabsPerGroup' in raw) {
      patch.maxTabsPerGroup = normalizeMaxTabsPerGroup(
        raw['maxTabsPerGroup'],
        current.maxTabsPerGroup,
      );
    }

    if ('deterministicOptions' in raw) {
      patch.deterministicOptions = sanitizeDeterministicOptions(
        raw['deterministicOptions'],
        current.deterministicOptions,
      );
    }

    if ('customRules' in raw) {
      const rawRules = raw['customRules'];
      const validRules = sanitizeDeterministicRules(rawRules);
      if (Array.isArray(rawRules) && validRules !== undefined) {
        if (rawRules.length > 0 && validRules.length === 0) {
          warnings.push('Ignored customRules because all entries were invalid.');
        } else {
          patch.customRules = validRules;
        }
      } else {
        warnings.push('Ignored invalid customRules field.');
      }
    }

    // Explicitly enforce ignoreApiKeys: true so existing user keys are never touched
    const merged = mergeAndValidateSettings(patch, current, { ignoreApiKeys: true });
    const saved = await this.settingsRepo.saveSettings(merged);

    const ruleCount = saved.customRules.length;
    const presetCount = saved.promptPresets.length;
    const migrationNote = rawVersion === 1 ? ' (migrated from v1)' : '';

    return {
      success: true,
      message: `Imported config${migrationNote}: ${ruleCount} rules, ${presetCount} presets.`,
      settings: saved,
      importedVersion: rawVersion,
      warnings,
    };
  }
}
