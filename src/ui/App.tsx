import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { runDeterministicGrouping } from '../engine/deterministic';
import { runSemanticGrouping } from '../engine/semantic';
import {
  DeterministicOptions,
  DeterministicRule,
  EngineMode,
  ExistingTabGroup,
  GroupingPlan,
  PrismSettings,
  ProposedTabGroup,
  SortChoreographyProgress,
  TabMetadata,
  TabStripOrientation,
  UndoSnapshot,
} from '../engine/types';
import {
  applyGroupingPlan,
  captureUndoSnapshot,
  getCurrentWindowTabGroups,
  getCurrentWindowTabs,
  restoreUndoSnapshot,
  ungroupAllTabsInWindow,
} from '../services/chromeTabsService';
import { geminiClient } from '../services/geminiService';
import {
  clearLastUndoSnapshot,
  DEFAULT_PRISM_SETTINGS,
  getActiveProviderConfig,
  loadLastUndoSnapshot,
  loadSettings,
  saveLastUndoSnapshot,
  saveSettings,
} from '../storage/storageService';
import { GroupPreviewList } from './components/GroupPreviewModal';
import { PrismRefractionBar } from './components/PrismRefractionBar';
import { RulesDrawer } from './components/RulesDrawer';
import { SemanticSettingsDrawer } from './components/SemanticSettingsDrawer';
import {
  Cpu,
  GitMerge,
  Layers,
  RotateCcw,
  Settings2,
  Sparkles,
  Unlink,
  Zap,
} from 'lucide-react';

type ActiveDrawer = 'none' | 'rules' | 'semantic';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<PrismSettings>(DEFAULT_PRISM_SETTINGS);
  const [tabs, setTabs] = useState<TabMetadata[]>([]);
  const [existingGroups, setExistingGroups] = useState<ExistingTabGroup[]>([]);
  const [plan, setPlan] = useState<GroupingPlan | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>('none');
  const [isSorting, setIsSorting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [choreography, setChoreography] =
    useState<SortChoreographyProgress | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const tabsById = useMemo(() => {
    const map = new Map<number, TabMetadata>();
    for (const tab of tabs) {
      map.set(tab.id, tab);
    }
    return map;
  }, [tabs]);

  const showToast = useCallback((msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Load initial state including existing Chrome Tab Groups
  useEffect(() => {
    let mounted = true;
    Promise.all([
      loadSettings(),
      getCurrentWindowTabs(),
      loadLastUndoSnapshot(),
    ]).then(async ([loadedSettings, windowTabs, lastUndo]) => {
      if (!mounted) return;
      const currentExistingGroups = await getCurrentWindowTabGroups(windowTabs);
      if (!mounted) return;

      setSettings(loadedSettings);
      setTabs(windowTabs);
      setExistingGroups(currentExistingGroups);
      setUndoSnapshot(lastUndo);

      const initialLogicPlan = runDeterministicGrouping(
        windowTabs,
        loadedSettings.customRules,
        loadedSettings.deterministicOptions,
        loadedSettings.deterministicOptions.preserveExistingGroups
          ? currentExistingGroups
          : []
      );
      setPlan(initialLogicPlan);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleUpdateSettings = useCallback(
    async (updates: Partial<PrismSettings>) => {
      const next = await saveSettings(updates);
      setSettings(next);

      if (next.mode === 'logic') {
        const refreshedPlan = runDeterministicGrouping(
          tabs,
          next.customRules,
          next.deterministicOptions,
          next.deterministicOptions.preserveExistingGroups ? existingGroups : []
        );
        setPlan(refreshedPlan);
      }
    },
    [tabs, existingGroups]
  );

  const handleTogglePreserveExisting = useCallback(() => {
    const nextPreserve = !settings.deterministicOptions.preserveExistingGroups;
    void handleUpdateSettings({
      deterministicOptions: {
        ...settings.deterministicOptions,
        preserveExistingGroups: nextPreserve,
      },
    });
  }, [settings.deterministicOptions, handleUpdateSettings]);

  const handleToggleOrientation = useCallback(
    (nextOrientation: TabStripOrientation) => {
      void handleUpdateSettings({ tabStripOrientation: nextOrientation });
    },
    [handleUpdateSettings]
  );

  const handleSwitchMode = useCallback(
    async (mode: EngineMode) => {
      const next = await saveSettings({ mode });
      setSettings(next);
      if (mode === 'logic') {
        const logicPlan = runDeterministicGrouping(
          tabs,
          next.customRules,
          next.deterministicOptions,
          next.deterministicOptions.preserveExistingGroups ? existingGroups : []
        );
        setPlan(logicPlan);
        if (activeDrawer === 'semantic') {
          setActiveDrawer('none');
        }
      } else {
        // Clear any stale fallback warning banner when switching into Meaning Mode
        setPlan((prev) =>
          prev
            ? {
                ...prev,
                fallbackTriggered: false,
                fallbackReason: undefined,
              }
            : prev
        );
        if (activeDrawer === 'rules') {
          setActiveDrawer('semantic');
        }
      }
    },
    [tabs, existingGroups, activeDrawer]
  );

  const executeApplyPlan = useCallback(
    async (targetPlan: GroupingPlan) => {
      setIsApplying(true);
      try {
        const snapshot = await captureUndoSnapshot();
        await saveLastUndoSnapshot(snapshot);
        setUndoSnapshot(snapshot);

        await applyGroupingPlan(targetPlan, {
          collapseInactiveGroups: settings.collapseOthersOnGroup,
          staggerMs: 36,
          onProgress: (prog) => setChoreography(prog),
        });

        const refreshedTabs = await getCurrentWindowTabs();
        const refreshedGroups = await getCurrentWindowTabGroups(refreshedTabs);
        setTabs(refreshedTabs);
        setExistingGroups(refreshedGroups);

        const mergedCount = targetPlan.groups.reduce(
          (acc, g) => acc + (g.addedTabIds?.length ?? 0),
          0
        );

        showToast(
          mergedCount > 0
            ? `Merged +${mergedCount} tabs into existing groups & synced ${targetPlan.groups.length} clusters`
            : `Synced ${targetPlan.groups.reduce(
                (acc, g) => acc + g.tabIds.length,
                0
              )} tabs across ${targetPlan.groups.length} Chrome groups`
        );
      } finally {
        setIsApplying(false);
        setTimeout(() => setChoreography(null), 500);
      }
    },
    [settings.collapseOthersOnGroup, showToast]
  );

  const handlePrismSort = useCallback(async () => {
    setIsSorting(true);
    try {
      const latestSettings = await loadSettings();
      setSettings(latestSettings);

      const currentTabs = await getCurrentWindowTabs();
      const currentExistingGroups = await getCurrentWindowTabGroups(currentTabs);
      setTabs(currentTabs);
      setExistingGroups(currentExistingGroups);

      const effectiveExisting = latestSettings.deterministicOptions
        .preserveExistingGroups
        ? currentExistingGroups
        : [];

      const activeProvider = getActiveProviderConfig(latestSettings);

      let computedPlan: GroupingPlan;
      if (latestSettings.mode === 'meaning') {
        computedPlan = await runSemanticGrouping({
          tabs: currentTabs,
          provider: activeProvider.provider,
          apiKey: activeProvider.apiKey,
          model: activeProvider.model,
          baseUrl: activeProvider.baseUrl,
          customPromptDirective: latestSettings.customPromptDirective,
          deterministicRules: latestSettings.customRules,
          deterministicOptions: latestSettings.deterministicOptions,
          existingGroups: effectiveExisting,
          client: geminiClient,
        });
      } else {
        computedPlan = runDeterministicGrouping(
          currentTabs,
          latestSettings.customRules,
          latestSettings.deterministicOptions,
          effectiveExisting
        );
      }

      setPlan(computedPlan);

      if (latestSettings.instantExecution && computedPlan.groups.length > 0) {
        await executeApplyPlan(computedPlan);
      }
    } finally {
      setIsSorting(false);
    }
  }, [executeApplyPlan]);

  const handleUpdateGroupInPlan = useCallback(
    (groupId: string, updates: Partial<ProposedTabGroup>) => {
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          groups: prev.groups.map((g) =>
            g.id === groupId ? { ...g, ...updates } : g
          ),
        };
      });
    },
    []
  );

  const handleRemoveGroupFromPlan = useCallback((groupId: string) => {
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        groups: prev.groups.filter((g) => g.id !== groupId),
      };
    });
  }, []);

  const handleUngroupAll = useCallback(async () => {
    const snapshot = await captureUndoSnapshot();
    await saveLastUndoSnapshot(snapshot);
    setUndoSnapshot(snapshot);

    const count = await ungroupAllTabsInWindow();
    const refreshedTabs = await getCurrentWindowTabs();
    const refreshedGroups = await getCurrentWindowTabGroups(refreshedTabs);
    setTabs(refreshedTabs);
    setExistingGroups(refreshedGroups);

    const freshPlan = runDeterministicGrouping(
      refreshedTabs,
      settings.customRules,
      settings.deterministicOptions,
      settings.deterministicOptions.preserveExistingGroups ? refreshedGroups : []
    );
    setPlan(freshPlan);

    showToast(
      count > 0
        ? `Ungrouped ${count} tabs`
        : 'All tabs in this window are already ungrouped'
    );
  }, [settings.customRules, settings.deterministicOptions, showToast]);

  const handleUndo = useCallback(async () => {
    if (!undoSnapshot) return;
    await restoreUndoSnapshot(undoSnapshot);
    await clearLastUndoSnapshot();
    setUndoSnapshot(null);

    const refreshedTabs = await getCurrentWindowTabs();
    const refreshedGroups = await getCurrentWindowTabGroups(refreshedTabs);
    setTabs(refreshedTabs);
    setExistingGroups(refreshedGroups);

    const freshPlan = runDeterministicGrouping(
      refreshedTabs,
      settings.customRules,
      settings.deterministicOptions,
      settings.deterministicOptions.preserveExistingGroups ? refreshedGroups : []
    );
    setPlan(freshPlan);

    showToast('Restored previous tab layout & groups');
  }, [
    undoSnapshot,
    settings.customRules,
    settings.deterministicOptions,
    showToast,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        void handlePrismSort();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && undoSnapshot) {
          e.preventDefault();
          void handleUndo();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePrismSort, handleUndo, undoSnapshot]);

  const preserveOn = settings.deterministicOptions.preserveExistingGroups;
  const providerLabel =
    settings.aiProvider === 'groq'
      ? 'Groq'
      : settings.aiProvider === 'custom'
      ? 'Custom'
      : 'Gemini';

  return (
    <div className="flex flex-col min-h-[560px] max-h-[600px] bg-prism-bg text-slate-100 p-3.5 gap-2.5 select-none">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-slate-700/80 flex items-center justify-center shadow-sm">
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
                PRISM
              </h1>
              <span className="rounded bg-slate-800/90 border border-slate-700/70 px-1.5 py-0.2 text-[9px] font-mono text-slate-400">
                MV3
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Smart Dual-Engine Tab Organizer
            </p>
          </div>
        </div>

        {/* Drawer Toggles */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              setActiveDrawer((prev) => (prev === 'rules' ? 'none' : 'rules'))
            }
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
              activeDrawer === 'rules'
                ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                : 'border-slate-800 bg-prism-surface text-slate-400 hover:text-slate-200'
            }`}
            title="Configure Deterministic Rules & Smart Merge"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Rules</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveDrawer((prev) =>
                prev === 'semantic' ? 'none' : 'semantic'
              )
            }
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
              activeDrawer === 'semantic'
                ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-300'
                : 'border-slate-800 bg-prism-surface text-slate-400 hover:text-slate-200'
            }`}
            title="Configure BYOK AI Provider (Groq / Gemini / Custom) & Directives"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Setup</span>
          </button>
        </div>
      </header>

      {/* Dual-Engine Mode Switcher Pill */}
      <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-prism-surface p-1 border border-slate-800/90">
        <button
          type="button"
          onClick={() => handleSwitchMode('logic')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2.5 text-xs font-semibold transition-all ${
            settings.mode === 'logic'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Logic Mode</span>
          <span className="text-[9px] font-normal opacity-75">(0ms)</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchMode('meaning')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2.5 text-xs font-semibold transition-all ${
            settings.mode === 'meaning'
              ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Meaning Mode</span>
          <span className="text-[9px] font-normal opacity-75">
            ({providerLabel})
          </span>
        </button>
      </div>

      {/* Signature Prism Refraction & Layout-Aware Choreography Visualizer */}
      <PrismRefractionBar
        isSorting={isSorting || isApplying}
        mode={settings.mode}
        providerLabel={providerLabel}
        orientation={settings.tabStripOrientation}
        onToggleOrientation={handleToggleOrientation}
        tabCount={tabs.length}
        groups={plan?.groups ?? []}
        choreography={choreography}
      />

      {/* Primary Action Button + Preserve Existing Groups Toggle */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={isSorting || isApplying}
          onClick={handlePrismSort}
          className={`relative flex-1 overflow-hidden flex items-center justify-between rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-lg transition-all active:scale-[0.99] ${
            settings.mode === 'meaning'
              ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 shadow-indigo-500/20'
              : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:via-teal-500 hover:to-cyan-500 shadow-emerald-500/20'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 fill-current" />
            <span>
              {isSorting
                ? 'Clustering Tabs…'
                : settings.instantExecution
                ? 'Prism Tabs (1-Click)'
                : settings.mode === 'meaning'
                ? `Analyze (${providerLabel} AI)`
                : 'Refresh Logic Preview'}
            </span>
          </span>
          <kbd className="rounded bg-black/25 px-1.5 py-0.5 text-[10px] font-mono text-white/90 border border-white/15">
            Alt+P
          </kbd>
        </button>

        {/* Prominent Preserve Existing Groups Toggle Switch */}
        <button
          type="button"
          onClick={handleTogglePreserveExisting}
          className={`flex flex-col items-center justify-center rounded-xl border px-2 py-1 text-[9px] font-medium transition-colors ${
            preserveOn
              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
              : 'border-slate-800 bg-prism-surface text-slate-400 hover:text-slate-200'
          }`}
          title={
            preserveOn
              ? 'Preserve existing groups: ON (Non-Destructive Smart Merge)'
              : 'Preserve existing groups: OFF (Clean Slate Mode — rebuild all groups from scratch)'
          }
        >
          <span className="flex items-center gap-0.5">
            <GitMerge className="w-2.5 h-2.5" />
            <span>Preserve</span>
          </span>
          <span className="font-bold">{preserveOn ? 'ON' : 'CLEAN'}</span>
        </button>

        {/* 1-Click Instant Execution Toggle */}
        <button
          type="button"
          onClick={() =>
            handleUpdateSettings({
              instantExecution: !settings.instantExecution,
            })
          }
          className={`flex flex-col items-center justify-center rounded-xl border px-2 py-1 text-[9px] font-medium transition-colors ${
            settings.instantExecution
              ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
              : 'border-slate-800 bg-prism-surface text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle between visual confirmation preview and instant 1-click grouping"
        >
          <span>1-Click</span>
          <span className="font-bold">
            {settings.instantExecution ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      {/* Collapsible Drawers OR Group Preview List */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        {activeDrawer === 'rules' ? (
          <RulesDrawer
            rules={settings.customRules}
            options={settings.deterministicOptions}
            onUpdateRules={(customRules: DeterministicRule[]) =>
              handleUpdateSettings({ customRules })
            }
            onUpdateOptions={(partialOpts: Partial<DeterministicOptions>) =>
              handleUpdateSettings({
                deterministicOptions: {
                  ...settings.deterministicOptions,
                  ...partialOpts,
                },
              })
            }
          />
        ) : activeDrawer === 'semantic' ? (
          <SemanticSettingsDrawer
            settings={settings}
            onSaveSettings={handleUpdateSettings}
          />
        ) : (
          <GroupPreviewList
            plan={plan}
            tabsById={tabsById}
            isLoading={isSorting}
            orientation={settings.tabStripOrientation}
            choreography={choreography}
            onUpdateGroup={handleUpdateGroupInPlan}
            onRemoveGroup={handleRemoveGroupFromPlan}
            onConfirmApply={() => plan && executeApplyPlan(plan)}
            isApplying={isApplying}
          />
        )}
      </main>

      {/* Toast Notification Banner */}
      {statusMessage && (
        <div className="rounded-lg bg-slate-800/95 border border-slate-700 px-3 py-1.5 text-center text-[11px] font-medium text-emerald-300 animate-fade-in">
          {statusMessage}
        </div>
      )}

      {/* Footer Utility Bar: Undo, Ungroup All, Auto-Collapse Toggle */}
      <footer className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!undoSnapshot}
            onClick={handleUndo}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-prism-surface px-2.5 py-1 text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            title="Undo last grouping action (Ctrl+Z)"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Undo</span>
          </button>

          <button
            type="button"
            onClick={handleUngroupAll}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-prism-surface px-2.5 py-1 text-slate-300 hover:text-red-300 hover:border-red-500/30 transition-colors"
            title="Ungroup all tabs in current window (Alt+U)"
          >
            <Unlink className="w-3 h-3" />
            <span>Ungroup All</span>
          </button>
        </div>

        <label
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-300 cursor-pointer"
          title="Automatically collapse all tab groups except the active/last group after sorting"
        >
          <input
            type="checkbox"
            checked={settings.collapseOthersOnGroup}
            onChange={(e) =>
              handleUpdateSettings({
                collapseOthersOnGroup: e.target.checked,
              })
            }
            className="rounded accent-indigo-500"
          />
          <span>Auto-collapse groups</span>
        </label>
      </footer>
    </div>
  );
};
