import React, { useState } from 'react';
import {
  CHROME_TAB_GROUP_COLORS,
  ChromeTabGroupColor,
  DeterministicOptions,
  DeterministicRule,
  RuleMatchTarget,
} from '../../engine/types';
import { CHROME_COLOR_STYLES } from '../colorPalette';
import { Plus, Trash2, Sliders, CheckSquare, Square } from 'lucide-react';

interface RulesDrawerProps {
  rules: DeterministicRule[];
  options: DeterministicOptions;
  onUpdateRules: (rules: DeterministicRule[]) => void;
  onUpdateOptions: (options: Partial<DeterministicOptions>) => void;
}

export const RulesDrawer: React.FC<RulesDrawerProps> = ({
  rules,
  options,
  onUpdateRules,
  onUpdateOptions,
}) => {
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleEmoji, setNewRuleEmoji] = useState('⚡');
  const [newRuleColor, setNewRuleColor] = useState<ChromeTabGroupColor>('cyan');
  const [newRuleTarget, setNewRuleTarget] = useState<RuleMatchTarget>('hostname');
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleIsRegex, setNewRuleIsRegex] = useState(false);

  const handleToggleRule = (id: string) => {
    const next = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    onUpdateRules(next);
  };

  const handleDeleteRule = (id: string) => {
    onUpdateRules(rules.filter((r) => r.id !== id));
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim() || !newRulePattern.trim()) return;

    const created: DeterministicRule = {
      id: `custom-${Date.now()}`,
      name: newRuleName.trim().slice(0, 22),
      emoji: newRuleEmoji.trim() || '📁',
      color: newRuleColor,
      matchTarget: newRuleTarget,
      pattern: newRulePattern.trim(),
      isRegex: newRuleIsRegex,
      priority: 5,
      enabled: true,
    };

    onUpdateRules([created, ...rules]);
    setNewRuleName('');
    setNewRulePattern('');
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-prism-surface/95 p-3 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
          <Sliders className="w-3.5 h-3.5 text-emerald-400" />
          <span>Deterministic Logic Rules & Heuristics</span>
        </div>
      </div>

      {/* Domain & Clustering Heuristics Toggles */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <button
          type="button"
          onClick={() =>
            onUpdateOptions({ mergeSubdomains: !options.mergeSubdomains })
          }
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-left text-slate-300 hover:border-slate-700"
        >
          {options.mergeSubdomains ? (
            <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <Square className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          )}
          <span className="truncate">Merge Subdomains</span>
        </button>

        <button
          type="button"
          onClick={() =>
            onUpdateOptions({
              groupByFirstPathSegment: !options.groupByFirstPathSegment,
            })
          }
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-left text-slate-300 hover:border-slate-700"
        >
          {options.groupByFirstPathSegment ? (
            <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <Square className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          )}
          <span className="truncate">Split by URL Path</span>
        </button>

        <button
          type="button"
          onClick={() =>
            onUpdateOptions({
              groupSingletonsIntoMisc: !options.groupSingletonsIntoMisc,
            })
          }
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-left text-slate-300 hover:border-slate-700"
        >
          {options.groupSingletonsIntoMisc ? (
            <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <Square className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          )}
          <span className="truncate">Group Singletons</span>
        </button>

        <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-slate-300">
          <span>Min Tabs:</span>
          <select
            value={options.minTabsPerGroup}
            onChange={(e) =>
              onUpdateOptions({ minTabsPerGroup: Number(e.target.value) })
            }
            className="bg-slate-800 text-slate-100 rounded px-1.5 py-0.5 text-[11px] focus:outline-none"
          >
            <option value={1}>1 tab</option>
            <option value={2}>2 tabs</option>
            <option value={3}>3 tabs</option>
          </select>
        </div>
      </div>

      {/* Existing Custom & Preset Rules */}
      <div className="space-y-1.5">
        {rules.map((rule) => {
          const cStyle = CHROME_COLOR_STYLES[rule.color] ?? CHROME_COLOR_STYLES.grey;
          return (
            <div
              key={rule.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/90 bg-slate-900/60 px-2.5 py-1.5 text-[11px]"
            >
              <div
                onClick={() => handleToggleRule(rule.id)}
                className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleToggleRule(rule.id);
                  }}
                  className="rounded accent-emerald-500 cursor-pointer"
                />
                <span>{rule.emoji}</span>
                <span
                  className={`font-medium truncate ${
                    rule.enabled ? 'text-slate-200' : 'text-slate-500 line-through'
                  }`}
                >
                  {rule.name}
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] ${cStyle.bgClass} ${cStyle.textClass}`}
                >
                  {rule.isRegex ? 'Regex' : rule.matchTarget}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteRule(rule.id)}
                className="text-slate-500 hover:text-red-400 p-0.5"
                title="Delete rule"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add New Custom Rule Form */}
      <form
        onSubmit={handleAddRule}
        className="space-y-2 border-t border-slate-800/80 pt-2 text-[11px]"
      >
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Add Custom Rule
        </div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newRuleEmoji}
            onChange={(e) => setNewRuleEmoji(e.target.value)}
            className="w-9 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-center"
            placeholder="⚡"
            maxLength={2}
          />
          <input
            type="text"
            value={newRuleName}
            onChange={(e) => setNewRuleName(e.target.value)}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            placeholder="Group Name (e.g. Cloud Ops)"
          />
          <select
            value={newRuleColor}
            onChange={(e) => setNewRuleColor(e.target.value as ChromeTabGroupColor)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
          >
            {CHROME_TAB_GROUP_COLORS.map((c) => (
              <option key={c} value={c}>
                {CHROME_COLOR_STYLES[c].label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-1.5">
          <select
            value={newRuleTarget}
            onChange={(e) => setNewRuleTarget(e.target.value as RuleMatchTarget)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
          >
            <option value="hostname">Hostname</option>
            <option value="url">Full URL</option>
            <option value="path">URL Path</option>
            <option value="title">Tab Title</option>
          </select>

          <input
            type="text"
            value={newRulePattern}
            onChange={(e) => setNewRulePattern(e.target.value)}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            placeholder={
              newRuleIsRegex
                ? 'Regex (e.g. /pull/\\d+)'
                : 'aws.amazon.com, vercel.com'
            }
          />
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={newRuleIsRegex}
              onChange={(e) => setNewRuleIsRegex(e.target.checked)}
              className="rounded accent-emerald-500"
            />
            <span>Use Regular Expression (Regex)</span>
          </label>

          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-2.5 py-1 transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>Add Rule</span>
          </button>
        </div>
      </form>
    </div>
  );
};
