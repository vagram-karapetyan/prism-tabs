import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Minus,
  Plus,
  Trash2,
  Upload,
} from 'lucide-preact';
import { useRef, useState } from 'preact/hooks';
import { MAX_TABS_PER_GROUP_PRESETS } from '../../domain/defaults';
import { THEME_DESCRIPTORS } from '../../domain/themes';
import {
  CHROME_TAB_GROUP_COLORS,
  GEMINI_MODEL_POOL,
  GROQ_MODEL_POOL,
  RULE_MATCH_TARGETS,
  type AiProvider,
  type ChromeTabGroupColor,
  type DeterministicOptions,
  type DeterministicRule,
  type GeminiModelId,
  type GroqModelId,
  type RuleMatchTarget,
} from '../../domain/types';
import { type PopupStore, type SettingsTabId } from '../state/popup.store';
import {
  CHROME_COLOR_LABELS,
  THEME_PALETTE_PREVIEW,
  getAiStatusBadge,
  handleTabListKeyDown,
} from '../utils/presentation';
import { ToggleSwitch } from './ToggleSwitch';

interface SettingsScreenProps {
  store: PopupStore;
}

const SETTINGS_TAB_IDS: readonly SettingsTabId[] = ['general', 'ai', 'rules'];

const BEHAVIOR_TOGGLES: ReadonlyArray<{
  key: 'collapseOthersOnGroup' | 'closeEmptyTabs' | 'closeYouTubeHomeTabs' | 'discardInactiveTabs';
  label: string;
}> = [
  { key: 'collapseOthersOnGroup', label: 'Collapse inactive groups on sort' },
  { key: 'closeEmptyTabs', label: 'Close empty & New Tab clutter' },
  { key: 'closeYouTubeHomeTabs', label: 'Close idle YouTube home tabs' },
  { key: 'discardInactiveTabs', label: 'Hibernate background tabs (save RAM)' },
];

const LOGIC_TOGGLES: ReadonlyArray<{
  key: Exclude<keyof DeterministicOptions, 'minTabsPerGroup'>;
  label: string;
}> = [
  { key: 'mergeSubdomains', label: 'Merge subdomains (docs.x.com → x.com)' },
  { key: 'groupByFirstPathSegment', label: 'Sub-cluster by URL path segment' },
  { key: 'groupSingletonsIntoMisc', label: 'Bundle singletons into Misc group' },
  { key: 'ignorePinnedTabs', label: 'Keep pinned tabs untouched' },
  { key: 'preserveExistingGroups', label: 'Preserve & Smart-Merge existing groups' },
];

function triggerJsonDownload(jsonContent: string): void {
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `prism-tabs-config-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export function SettingsScreen({ store }: SettingsScreenProps) {
  const settings = store.settings.value;
  const activeTab = store.settingsTab.value;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showApiKey, setShowApiKey] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const [ruleName, setRuleName] = useState('');
  const [ruleEmoji, setRuleEmoji] = useState('🔖');
  const [ruleColor, setRuleColor] = useState<ChromeTabGroupColor>('blue');
  const [ruleTarget, setRuleTarget] = useState<RuleMatchTarget>('hostname');
  const [rulePattern, setRulePattern] = useState('');
  const [ruleIsRegex, setRuleIsRegex] = useState(false);

  async function handleFileSelected(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const content = await file.text();
    const res = await store.importConfigJson(content);
    const warnings = res.warnings.length > 0 ? ` (${res.warnings.join('; ')})` : '';
    setImportFeedback({ ok: res.success, text: `${res.message}${warnings}` });
  }

  function handleAddRule(event: Event): void {
    event.preventDefault();
    const cleanName = ruleName.trim();
    const cleanPattern = rulePattern.trim();
    if (!cleanName || !cleanPattern) {
      store.showToast('warning', 'Rule name and pattern are required.');
      return;
    }

    if (ruleIsRegex) {
      try {
        new RegExp(cleanPattern, 'i');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Invalid regular expression.';
        store.showToast('error', `Invalid regex: ${msg}`);
        return;
      }
    }

    const nextRule: DeterministicRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      emoji: ruleEmoji.trim() || '📌',
      color: ruleColor,
      matchTarget: ruleTarget,
      pattern: cleanPattern,
      isRegex: ruleIsRegex,
      priority: 10,
      enabled: true,
    };

    void store.updateSettings({
      customRules: [...settings.customRules, nextRule],
    });
    setRuleName('');
    setRulePattern('');
    store.showToast('success', `Added rule "${cleanName}".`);
  }

  function updateDeterministicOption<K extends keyof DeterministicOptions>(
    key: K,
    value: DeterministicOptions[K],
  ): void {
    void store.updateSettings({
      deterministicOptions: {
        ...settings.deterministicOptions,
        [key]: value,
      },
    });
  }

  const tabs: ReadonlyArray<{ id: SettingsTabId; label: string }> = [
    { id: 'general', label: 'General' },
    { id: 'ai', label: 'AI & Prompts' },
    { id: 'rules', label: 'Rules' },
  ];

  const onSettingsTabKeyDown = (event: KeyboardEvent): void => {
    handleTabListKeyDown(event, SETTINGS_TAB_IDS, activeTab, (nextTab) => {
      store.setSettingsTab(nextTab);
    });
  };

  return (
    <>
      <nav class="settings-tabs" role="tablist" aria-label="Settings sections">
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              class="settings-tab-btn"
              onKeyDown={onSettingsTabKeyDown}
              onClick={() => {
                store.setSettingsTab(tab.id);
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <main class="prism-scroll-area">
        {activeTab === 'general' && (
          <>
            <section class="settings-section">
              <div class="settings-section-head">
                <h2 class="settings-section-title">Max Tabs Per Group</h2>
                <p class="settings-section-hint">
                  Automatically splits oversized groups into clean sub-clusters.
                </p>
              </div>
              <div class="chip-row" role="group" aria-label="Maximum tabs per group">
                {MAX_TABS_PER_GROUP_PRESETS.map((preset) => {
                  const isActive = settings.maxTabsPerGroup === preset;
                  return (
                    <button
                      key={String(preset)}
                      type="button"
                      class={`size-chip${isActive ? ' is-active' : ''}`}
                      aria-pressed={isActive}
                      onClick={() => void store.updateSettings({ maxTabsPerGroup: preset })}
                    >
                      {preset === null ? '∞ Unlimited' : String(preset)}
                    </button>
                  );
                })}
              </div>
            </section>

            <section class="settings-section">
              <h2 class="settings-section-title">Cleanup & Performance</h2>
              {BEHAVIOR_TOGGLES.map((item) => (
                <ToggleSwitch
                  key={item.key}
                  id={`behavior-${item.key}`}
                  label={item.label}
                  checked={settings[item.key]}
                  onChange={(checked) => {
                    void store.updateSettings({ [item.key]: checked });
                  }}
                />
              ))}
            </section>

            <section class="settings-section">
              <h2 class="settings-section-title">Appearance & Theme</h2>
              <div class="theme-grid">
                {THEME_DESCRIPTORS.map((theme) => {
                  const preview = THEME_PALETTE_PREVIEW[theme.id];
                  const isActive = settings.theme === theme.id;
                  const isWide = theme.id === 'system';
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      class={`theme-card${isWide ? ' theme-card--wide' : ''}${isActive ? ' is-active' : ''}`}
                      aria-pressed={isActive}
                      title={theme.description}
                      onClick={() => void store.updateSettings({ theme: theme.id })}
                    >
                      <span
                        class={`theme-preview-swatch${theme.id === 'system' ? ' is-system' : ''}`}
                        style={{ backgroundColor: preview.canvas }}
                        aria-hidden="true"
                      >
                        {theme.id !== 'system' && (
                          <span
                            class="theme-preview-bar"
                            style={{ backgroundColor: preview.surface }}
                          />
                        )}
                        <span
                          class="theme-preview-dot"
                          style={{ backgroundColor: preview.accent }}
                        />
                      </span>
                      <span class="theme-card-meta">
                        <span class="theme-card-name">{theme.label}</span>
                        <span class="theme-card-tone">
                          {isWide ? theme.description : preview.toneLabel}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section class="settings-section">
              <div class="settings-section-head">
                <h2 class="settings-section-title">Config Backup (BYOK Safe)</h2>
                <p class="settings-section-hint">
                  Exports rules, preferences & presets. API keys are never exported.
                </p>
              </div>
              <div class="input-row">
                <button
                  type="button"
                  class="btn-secondary"
                  style={{ flex: '1 1 auto' }}
                  onClick={() => {
                    triggerJsonDownload(store.exportConfigJson());
                    store.showToast('success', 'Exported config JSON (API keys excluded).');
                  }}
                >
                  <Download size={13} />
                  <span>Export JSON</span>
                </button>
                <button
                  type="button"
                  class="btn-secondary"
                  style={{ flex: '1 1 auto' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={13} />
                  <span>Import JSON</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  class="sr-only"
                  onChange={(event) => void handleFileSelected(event)}
                />
              </div>
              {importFeedback && (
                <div
                  class={`banner ${importFeedback.ok ? 'banner-success' : 'banner-error'}`}
                  role="status"
                >
                  <span class="banner-lead" style={{ alignItems: 'center' }}>
                    {importFeedback.ok ? (
                      <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                    ) : (
                      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                    )}
                    <span>{importFeedback.text}</span>
                  </span>
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'ai' && (
          <>
            <section class="settings-section">
              <div class="settings-section-head">
                <div class="settings-section-head-row">
                  <h2 class="settings-section-title">Meaning Mode Provider (BYOK)</h2>
                  {(() => {
                    const aiStatus = getAiStatusBadge(settings);
                    return (
                      <span
                        class={`ai-ready-pill${aiStatus.ready ? ' is-ready' : ' is-missing'}`}
                      >
                        {aiStatus.ready ? `${aiStatus.label} ready` : 'Key required'}
                      </span>
                    );
                  })()}
                </div>
                <p class="settings-section-hint">
                  Stored locally in Chrome storage. Falls back to Logic Mode if offline or missing.
                </p>
              </div>

              <div class="field-group">
                <label class="field-label" for="ai-provider-select">
                  Provider
                </label>
                <select
                  id="ai-provider-select"
                  class="select-input"
                  value={settings.aiProvider}
                  onChange={(event) => {
                    setShowApiKey(false);
                    void store.updateSettings({
                      aiProvider: event.currentTarget.value as AiProvider,
                    });
                  }}
                >
                  <option value="groq">Groq (Fast LPU Rotation)</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="custom">Custom (OpenAI-Compatible)</option>
                </select>
              </div>

              {settings.aiProvider === 'groq' && (
                <>
                  <div class="field-group">
                    <label class="field-label" for="groq-key-input">
                      Groq API Key
                    </label>
                    <div class="input-row">
                      <input
                        id="groq-key-input"
                        type={showApiKey ? 'text' : 'password'}
                        class="text-input text-input--mono"
                        autocomplete="off"
                        placeholder="gsk_..."
                        value={settings.groqApiKey}
                        onInput={(e) => {
                          void store.updateSettings({ groqApiKey: e.currentTarget.value });
                        }}
                      />
                      <button
                        type="button"
                        class="prism-icon-btn prism-icon-btn--square"
                        aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                        onClick={() => {
                          setShowApiKey((v) => !v);
                        }}
                      >
                        {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div class="field-group">
                    <label class="field-label" for="groq-model-select">
                      Primary Model (with fallback pool)
                    </label>
                    <select
                      id="groq-model-select"
                      class="select-input text-input--mono"
                      value={settings.groqModel}
                      onChange={(e) => {
                        void store.updateSettings({
                          groqModel: e.currentTarget.value as GroqModelId,
                        });
                      }}
                    >
                      {GROQ_MODEL_POOL.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {settings.aiProvider === 'gemini' && (
                <>
                  <div class="field-group">
                    <label class="field-label" for="gemini-key-input">
                      Gemini API Key
                    </label>
                    <div class="input-row">
                      <input
                        id="gemini-key-input"
                        type={showApiKey ? 'text' : 'password'}
                        class="text-input text-input--mono"
                        autocomplete="off"
                        placeholder="AIza..."
                        value={settings.geminiApiKey}
                        onInput={(e) => {
                          void store.updateSettings({ geminiApiKey: e.currentTarget.value });
                        }}
                      />
                      <button
                        type="button"
                        class="prism-icon-btn prism-icon-btn--square"
                        aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                        onClick={() => {
                          setShowApiKey((v) => !v);
                        }}
                      >
                        {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div class="field-group">
                    <label class="field-label" for="gemini-model-select">
                      Primary Model
                    </label>
                    <select
                      id="gemini-model-select"
                      class="select-input text-input--mono"
                      value={settings.geminiModel}
                      onChange={(e) => {
                        void store.updateSettings({
                          geminiModel: e.currentTarget.value as GeminiModelId,
                        });
                      }}
                    >
                      {GEMINI_MODEL_POOL.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {settings.aiProvider === 'custom' && (
                <>
                  <div class="field-group">
                    <label class="field-label" for="custom-url-input">
                      Base URL
                    </label>
                    <input
                      id="custom-url-input"
                      type="url"
                      class="text-input text-input--mono"
                      value={settings.customBaseUrl}
                      onInput={(e) => {
                        void store.updateSettings({ customBaseUrl: e.currentTarget.value });
                      }}
                    />
                  </div>
                  <div class="field-group">
                    <label class="field-label" for="custom-model-input">
                      Model ID
                    </label>
                    <input
                      id="custom-model-input"
                      type="text"
                      class="text-input text-input--mono"
                      value={settings.customModel}
                      onInput={(e) => {
                        void store.updateSettings({ customModel: e.currentTarget.value });
                      }}
                    />
                  </div>
                  <div class="field-group">
                    <label class="field-label" for="custom-key-input">
                      API Key
                    </label>
                    <div class="input-row">
                      <input
                        id="custom-key-input"
                        type={showApiKey ? 'text' : 'password'}
                        class="text-input text-input--mono"
                        autocomplete="off"
                        value={settings.customApiKey}
                        onInput={(e) => {
                          void store.updateSettings({ customApiKey: e.currentTarget.value });
                        }}
                      />
                      <button
                        type="button"
                        class="prism-icon-btn prism-icon-btn--square"
                        aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                        onClick={() => {
                          setShowApiKey((v) => !v);
                        }}
                      >
                        {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>

            <section class="settings-section">
              <h2 class="settings-section-title">Custom Prompt Directive</h2>
              {settings.promptPresets.length > 0 && (
                <div class="field-group">
                  <label class="field-label" for="preset-select">
                    Load Preset
                  </label>
                  <select
                    id="preset-select"
                    class="select-input"
                    value=""
                    onChange={(event) => {
                      const preset = settings.promptPresets.find(
                        (p) => p.id === event.currentTarget.value,
                      );
                      if (preset) {
                        void store.updateSettings({ customPromptDirective: preset.directive });
                      }
                    }}
                  >
                    <option value="">Choose a preset...</option>
                    {settings.promptPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <textarea
                class="textarea-input"
                aria-label="Custom AI prompt directive"
                value={settings.customPromptDirective}
                onInput={(e) => {
                  void store.updateSettings({ customPromptDirective: e.currentTarget.value });
                }}
              />
            </section>
          </>
        )}

        {activeTab === 'rules' && (
          <>
            <section class="settings-section">
              <h2 class="settings-section-title">Logic Mode Heuristics</h2>
              {LOGIC_TOGGLES.map((item) => (
                <ToggleSwitch
                  key={item.key}
                  id={`logic-${item.key}`}
                  label={item.label}
                  checked={settings.deterministicOptions[item.key]}
                  onChange={(checked) => {
                    updateDeterministicOption(item.key, checked);
                  }}
                />
              ))}

              <div class="toggle-row">
                <span class="toggle-row-text">Minimum tabs per group</span>
                <div class="stepper-control" role="group" aria-label="Minimum tabs per group">
                  <button
                    type="button"
                    class="stepper-btn"
                    aria-label="Decrease minimum tabs per group"
                    disabled={settings.deterministicOptions.minTabsPerGroup <= 1}
                    onClick={() => {
                      updateDeterministicOption(
                        'minTabsPerGroup',
                        Math.max(1, settings.deterministicOptions.minTabsPerGroup - 1),
                      );
                    }}
                  >
                    <Minus size={12} />
                  </button>
                  <span class="stepper-val">{settings.deterministicOptions.minTabsPerGroup}</span>
                  <button
                    type="button"
                    class="stepper-btn"
                    aria-label="Increase minimum tabs per group"
                    disabled={settings.deterministicOptions.minTabsPerGroup >= 5}
                    onClick={() => {
                      updateDeterministicOption(
                        'minTabsPerGroup',
                        Math.min(5, settings.deterministicOptions.minTabsPerGroup + 1),
                      );
                    }}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </section>

            <section class="settings-section">
              <h2 class="settings-section-title">
                Custom Rules ({settings.customRules.length})
              </h2>
              {settings.customRules.map((rule) => (
                <div
                  key={rule.id}
                  class={`rule-item${rule.enabled ? '' : ' is-disabled'}`}
                  style={
                    { '--rule-accent': `var(--chrome-${rule.color}-dot)` } as Record<string, string>
                  }
                >
                  <div class="rule-item-main">
                    <div class="rule-meta">
                      <div class="rule-title-row">
                        <span class="rule-title">
                          {rule.emoji} {rule.name}
                        </span>
                        <span class="rule-target-badge">{rule.matchTarget}</span>
                        {rule.isRegex && <span class="rule-target-badge">regex</span>}
                      </div>
                      <span class="rule-pattern" title={rule.pattern}>
                        {rule.pattern}
                      </span>
                    </div>
                  </div>

                  <div class="rule-actions">
                    <input
                      type="checkbox"
                      role="switch"
                      {...({ switch: '' } as Record<string, string>)}
                      class="prism-switch"
                      checked={rule.enabled}
                      aria-label={`Rule ${rule.name}`}
                      onChange={(e) => {
                        const enabled = e.currentTarget.checked;
                        void store.updateSettings({
                          customRules: settings.customRules.map((r) =>
                            r.id === rule.id ? { ...r, enabled } : r,
                          ),
                        });
                      }}
                    />
                    <button
                      type="button"
                      class="group-action-btn"
                      aria-label={`Delete rule ${rule.name}`}
                      title="Delete rule"
                      onClick={() => {
                        void store.updateSettings({
                          customRules: settings.customRules.filter((r) => r.id !== rule.id),
                        });
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}

              <form class="rule-composer" onSubmit={handleAddRule}>
                <div class="rule-composer-label">Add Custom Rule</div>
                <div class="rule-form-grid">
                  <input
                    type="text"
                    class="text-input"
                    placeholder="Rule name"
                    aria-label="New rule name"
                    value={ruleName}
                    onInput={(e) => {
                      setRuleName(e.currentTarget.value);
                    }}
                  />
                  <div class="input-row">
                    <input
                      type="text"
                      class="text-input"
                      style={{ width: '48px', textAlign: 'center' }}
                      aria-label="Rule emoji"
                      value={ruleEmoji}
                      onInput={(e) => {
                        setRuleEmoji(e.currentTarget.value);
                      }}
                    />
                    <select
                      class="select-input"
                      aria-label="Rule color"
                      value={ruleColor}
                      onChange={(e) => {
                        setRuleColor(e.currentTarget.value as ChromeTabGroupColor);
                      }}
                    >
                      {CHROME_TAB_GROUP_COLORS.map((c) => (
                        <option key={c} value={c}>
                          {CHROME_COLOR_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div class="rule-form-grid">
                  <select
                    class="select-input"
                    aria-label="Match target"
                    value={ruleTarget}
                    onChange={(e) => {
                      setRuleTarget(e.currentTarget.value as RuleMatchTarget);
                    }}
                  >
                    {RULE_MATCH_TARGETS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>

                  <div class="rule-toggle-cell">
                    <ToggleSwitch
                      id="new-rule-regex"
                      label="Regex"
                      checked={ruleIsRegex}
                      onChange={setRuleIsRegex}
                    />
                  </div>
                </div>

                <div class="input-row">
                  <input
                    type="text"
                    class="text-input text-input--mono"
                    placeholder="Pattern (e.g. github.com, linear.app)"
                    aria-label="Rule pattern"
                    value={rulePattern}
                    onInput={(e) => {
                      setRulePattern(e.currentTarget.value);
                    }}
                  />
                  <button type="submit" class="btn-secondary" style={{ minBlockSize: '32px' }}>
                    <Plus size={13} />
                    <span>Add</span>
                  </button>
                </div>
              </form>
            </section>
          </>
        )}
      </main>
    </>
  );
}
