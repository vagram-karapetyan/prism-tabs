import React, { useState } from 'react';
import {
  AiProvider,
  CustomPromptPreset,
  GeminiModelId,
  GroqModelId,
  PrismSettings,
} from '../../engine/types';
import {
  Eye,
  EyeOff,
  KeyRound,
  Sparkles,
  ShieldCheck,
  BookmarkPlus,
  ExternalLink,
  Zap,
  Globe,
} from 'lucide-react';

interface SemanticSettingsDrawerProps {
  settings: PrismSettings;
  onSaveSettings: (updates: Partial<PrismSettings>) => void;
}

export const SemanticSettingsDrawer: React.FC<SemanticSettingsDrawerProps> = ({
  settings,
  onSaveSettings,
}) => {
  const [showKey, setShowKey] = useState(false);
  const [newPresetLabel, setNewPresetLabel] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  const {
  aiProvider,
  groqApiKey,
  groqModel,
  geminiApiKey,
  geminiModel,
  customApiKey,
  customBaseUrl,
  customModel,
  customPromptDirective,
  promptPresets,
  } = settings;

  const handleSavePreset = () => {
    if (!newPresetLabel.trim() || !customPromptDirective.trim()) return;
    const newPreset: CustomPromptPreset = {
      id: `user-preset-${Date.now()}`,
      label: newPresetLabel.trim().slice(0, 28),
      directive: customPromptDirective.trim(),
    };
    onSaveSettings({
      promptPresets: [...promptPresets, newPreset],
    });
    setNewPresetLabel('');
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-indigo-500/30 bg-prism-surface/95 p-3 space-y-2.5 animate-fade-in shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Multi-Provider BYOK AI & Directives</span>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
          <ShieldCheck className="w-3 h-3" />
          Local Storage
        </span>
      </div>

      {/* Provider Selector Tabs (Groq Recommended Default, Gemini, Custom) */}
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800 text-[10px]">
        <button
          type="button"
          onClick={() => onSaveSettings({ aiProvider: 'groq' as AiProvider })}
          className={`flex items-center justify-center gap-1 rounded-md py-1 px-1.5 font-semibold transition-all ${
            aiProvider === 'groq'
              ? 'bg-amber-500 text-white shadow-xs dark:bg-amber-500/20 dark:text-amber-300 dark:border dark:border-amber-500/40'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Zap className="w-3 h-3" />
          <span>Groq (Fast)</span>
        </button>

        <button
          type="button"
          onClick={() => onSaveSettings({ aiProvider: 'gemini' as AiProvider })}
          className={`flex items-center justify-center gap-1 rounded-md py-1 px-1.5 font-semibold transition-all ${
            aiProvider === 'gemini'
              ? 'bg-indigo-600 text-white shadow-xs dark:bg-indigo-500/20 dark:text-indigo-200 dark:border dark:border-indigo-500/40'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          <span>Gemini</span>
        </button>

        <button
          type="button"
          onClick={() => onSaveSettings({ aiProvider: 'custom' as AiProvider })}
          className={`flex items-center justify-center gap-1 rounded-md py-1 px-1.5 font-semibold transition-all ${
            aiProvider === 'custom'
              ? 'bg-cyan-600 text-white shadow-xs dark:bg-cyan-500/20 dark:text-cyan-200 dark:border dark:border-cyan-500/40'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Globe className="w-3 h-3" />
          <span>Custom</span>
        </button>
      </div>

      {/* Provider-Specific Configuration & Quick Links */}
      {aiProvider === 'groq' && (
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between">
            <label className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <KeyRound className="w-3 h-3 text-amber-500 dark:text-amber-400" />
              <span>Groq API Key</span>
              <span className="text-[9px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 px-1.5 py-0.2 rounded font-semibold">
                Recommended
              </span>
            </label>
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-300 hover:text-amber-700 dark:hover:text-amber-200 underline underline-offset-2"
            >
              <span>Get free API key</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>

          <div className="flex gap-1.5">
            <div className="relative flex-1 flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={groqApiKey}
                onChange={(e) => onSaveSettings({ groqApiKey: e.target.value })}
                placeholder="gsk_... (Stored in chrome.storage.local)"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-2.5 pr-7 py-1 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title={showKey ? 'Hide API Key' : 'Show API Key'}
              >
                {showKey ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <select
              value={groqModel}
              onChange={(e) =>
                onSaveSettings({ groqModel: e.target.value as GroqModelId })
              }
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[10px] text-slate-800 dark:text-amber-200 focus:outline-none focus:border-amber-500"
              aria-label="Groq Model"
            >
              <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
              <option value="openai/gpt-oss-120b">GPT OSS 120B</option>
              <option value="openai/gpt-oss-20b">GPT OSS 20B (Fast)</option>
              <option value="qwen/qwen3.8-27b">Qwen 3.8 27B</option>
              <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant</option>
            </select>
          </div>
        </div>
      )}

      {aiProvider === 'gemini' && (
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between">
            <label className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <KeyRound className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
              <span>Google Gemini API Key</span>
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 underline underline-offset-2"
            >
              <span>Get free API key</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>

          <div className="flex gap-1.5">
            <div className="relative flex-1 flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={geminiApiKey}
                onChange={(e) => onSaveSettings({ geminiApiKey: e.target.value })}
                placeholder="AIzaSy... (Stored in chrome.storage.local)"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-2.5 pr-7 py-1 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title={showKey ? 'Hide API Key' : 'Show API Key'}
              >
                {showKey ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <select
              value={geminiModel}
              onChange={(e) =>
                onSaveSettings({ geminiModel: e.target.value as GeminiModelId })
              }
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[10px] text-slate-800 dark:text-indigo-200 focus:outline-none focus:border-indigo-500"
              aria-label="Gemini Model"
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            </select>
          </div>
        </div>
      )}

      {aiProvider === 'custom' && (
        <div className="space-y-1.5 text-[11px]">
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              value={customBaseUrl}
              onChange={(e) => onSaveSettings({ customBaseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[10px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              title="OpenAI-compatible Base URL"
            />
            <input
              type="text"
              value={customModel}
              onChange={(e) => onSaveSettings({ customModel: e.target.value })}
              placeholder="Model (e.g. gpt-4o-mini)"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[10px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              title="Custom Model ID"
            />
          </div>

          <div className="relative flex items-center">
            <input
              type={showKey ? 'text' : 'password'}
              value={customApiKey}
              onChange={(e) => onSaveSettings({ customApiKey: e.target.value })}
              placeholder="sk-... (OpenAI-compatible API Key)"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-2.5 pr-7 py-1 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="button"
              onClick={() => setShowKey((prev) => !prev)}
              className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              {showKey ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Custom User Prompting & Directives */}
      <div className="space-y-1.5 text-[11px] border-t border-slate-200 dark:border-slate-800/80 pt-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            Custom AI Sorting Instructions / Directives
          </span>
          {savedNotice && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              Saved preset!
            </span>
          )}
        </div>

        {/* Quick Preset Pills */}
        <div className="flex flex-wrap gap-1">
          {promptPresets.map((preset) => {
            const isSelected =
              customPromptDirective.trim() === preset.directive.trim();
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  onSaveSettings({ customPromptDirective: preset.directive })
                }
                className={`rounded-full px-2 py-0.5 text-[10px] transition-colors border ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs dark:bg-indigo-500/25 dark:text-indigo-200 dark:border-indigo-400/50 font-medium'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <textarea
          rows={2}
          value={customPromptDirective}
          onChange={(e) =>
            onSaveSettings({ customPromptDirective: e.target.value })
          }
          placeholder="e.g. Group YouTube videos by topic into isolated groups, cluster by project urgency, or separate dev from personal..."
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-[11px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
        />

        {/* Save current directive as reusable preset */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <input
            type="text"
            value={newPresetLabel}
            onChange={(e) => setNewPresetLabel(e.target.value)}
            placeholder="Save directive as preset (e.g. Sprint Triage)..."
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/90 px-2 py-1 text-[10px] text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={handleSavePreset}
            disabled={!newPresetLabel.trim()}
            className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/15 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 disabled:opacity-40 text-indigo-700 dark:text-indigo-200 px-2 py-1 text-[10px] font-semibold transition-colors"
          >
            <BookmarkPlus className="w-3 h-3" />
            <span>Save Preset</span>
          </button>
        </div>
      </div>
    </div>
  );
};
