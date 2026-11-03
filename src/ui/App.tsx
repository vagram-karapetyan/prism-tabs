import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  parseExistingGroupTitle,
  runDeterministicGrouping,
} from '../engine/deterministic';
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
  UndoSnapshot,
} from '../engine/types';
import {
  applyGroupingPlan,
  captureUndoSnapshot,
  closeDisposableTabsInWindow,
  getCurrentWindowTabGroups,
  getCurrentWindowTabs,
  hasUngroupedGroupableWebTabs,
  isDisposableTab,
  restoreUndoSnapshot,
  ungroupAllTabsInWindow,
  ungroupSpecificTabs,
  updateLiveChromeTabGroup,
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
  AlertTriangle,
  Check,
  Cpu,
  Layers,
  Loader2,
  RotateCcw,
  Settings,
  Sparkles,
  Unlink,
  X,
  Zap,
} from 'lucide-react';

type SettingsTab = 'ai' | 'rules';

/**
 * Builds a GroupingPlan representing the currently active Chrome Tab Groups in the window.
 */
function buildExistingWindowGroupsPlan(
  windowTabs: TabMetadata[],
  existingGroups: ExistingTabGroup[]
): GroupingPlan {
  const groupedIds = new Set(existingGroups.flatMap((eg) => eg.tabIds));
  const groups: ProposedTabGroup[] = existingGroups.map((eg) => {
    const parsed = parseExistingGroupTitle(eg.title || eg.cleanTitle || 'Group');
    return {
      id: `existing-${eg.id}`,
      groupName: eg.cleanTitle || parsed.cleanTitle || 'Group',
      emoji: eg.emoji || parsed.emoji || '📁',
      color: eg.color,
      tabIds: [...eg.tabIds],
      existingGroupId: eg.id,
      existingTabIds: [...eg.tabIds],
      addedTabIds: [],
      source: 'existing-merge',
    };
  });

  return {
    modeUsed: 'meaning',
    groups,
    ungroupedTabIds: windowTabs
      .filter((t) => !groupedIds.has(t.id))
      .map((t) => t.id),
    fallbackTriggered: false,
    latencyMs: 0,
  };
}

export const App: React.FC = () => {
  const [settings, setSettings] = useState<PrismSettings>(DEFAULT_PRISM_SETTINGS);
  const [tabs, setTabs] = useState<TabMetadata[]>([]);
  const [existingGroups, setExistingGroups] = useState<ExistingTabGroup[]>([]);
  const [plan, setPlan] = useState<GroupingPlan | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('ai');

  const [isSorting, setIsSorting] = useState(false);
  const [sortDoneSuccess, setSortDoneSuccess] = useState(false);
  const [choreography, setChoreography] =
    useState<SortChoreographyProgress | null>(null);

  const [errorBanner, setErrorBanner] = useState<string | null>(null);
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
    }, 2800);
  }, []);

  /**
   * Computes the deterministic Logic Mode preview plan.
   * If `preserveExistingGroups` is ON and there are ungrouped web tabs, merges them into existing groups.
   * If 100% of web tabs are already grouped, computes a clean Logic Mode plan so the user can see
   * and apply Logic Mode's own deterministic structure.
   */
  const computeLogicPlanForWindow = useCallback(
    (
      windowTabs: TabMetadata[],
      currentSettings: PrismSettings,
      currentExistingGroups: ExistingTabGroup[]
    ): GroupingPlan => {
      const cleanupOpts = {
        closeEmptyTabs: currentSettings.closeEmptyTabs !== false,
        closeYouTubeHomeTabs: Boolean(currentSettings.closeYouTubeHomeTabs),
      };
      const filteredTabs = windowTabs.filter((t) => !isDisposableTab(t, cleanupOpts));
      const hasUngrouped = hasUngroupedGroupableWebTabs(
        windowTabs,
        currentExistingGroups,
        cleanupOpts
      );
      const effectiveExisting =
        currentSettings.deterministicOptions.preserveExistingGroups &&
        hasUngrouped
          ? currentExistingGroups
          : [];

      return runDeterministicGrouping(
        filteredTabs,
        currentSettings.customRules,
        currentSettings.deterministicOptions,
        effectiveExisting
      );
    },
    []
  );

  // Load initial state strictly from the current active Chrome window
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

      if (
        loadedSettings.mode === 'meaning' &&
        currentExistingGroups.length > 0
      ) {
        setPlan(buildExistingWindowGroupsPlan(windowTabs, currentExistingGroups));
      } else if (loadedSettings.mode === 'meaning') {
        setPlan(null);
      } else {
        setPlan(
          computeLogicPlanForWindow(
            windowTabs,
            loadedSettings,
            currentExistingGroups
          )
        );
      }
    });
    return () => {
      mounted = false;
    };
  }, [computeLogicPlanForWindow]);

  const handleUpdateSettings = useCallback(
    async (updates: Partial<PrismSettings>) => {
      const next = await saveSettings(updates);
      setSettings(next);

      if (next.mode === 'logic') {
        setPlan(computeLogicPlanForWindow(tabs, next, existingGroups));
      }
    },
    [tabs, existingGroups, computeLogicPlanForWindow]
  );

  const handleSwitchMode = useCallback(
    async (mode: EngineMode) => {
      setErrorBanner(null);
      const next = await saveSettings({ mode });
      setSettings(next);
      if (mode === 'logic') {
        setPlan(computeLogicPlanForWindow(tabs, next, existingGroups));
      } else if (existingGroups.length > 0) {
        setPlan(buildExistingWindowGroupsPlan(tabs, existingGroups));
      } else {
        setPlan(null);
      }
    },
    [tabs, existingGroups, computeLogicPlanForWindow]
  );

  /**
   * One-Click Instant Sort & Group in the active Chrome window (`Alt+P` or main "Prism Tabs" button).
   *
   * IMPORTANT ORDER OF OPERATIONS:
   * 1. Exclude disposable tabs (empty New Tabs / YouTube homepage) in memory and run grouping + `applyGroupingPlan` FIRST.
   *    (If `chrome.tabs.remove` were called BEFORE grouping while a disposable tab is active,
   *    Chrome would immediately close the extension popup and abort the JS context before grouping runs!)
   * 2. Close all disposable tabs AFTER `applyGroupingPlan` has finished grouping all web tabs.
   */
  const handlePrismSort = useCallback(async () => {
    setIsSorting(true);
    setSortDoneSuccess(false);
    setErrorBanner(null);

    try {
      const latestSettings = await loadSettings();
      setSettings(latestSettings);

      const allWindowTabs = await getCurrentWindowTabs();
      const cleanupOpts = {
        closeEmptyTabs: latestSettings.closeEmptyTabs !== false,
        closeYouTubeHomeTabs: Boolean(latestSettings.closeYouTubeHomeTabs),
      };
      const filteredTabs = allWindowTabs.filter((t) => !isDisposableTab(t, cleanupOpts));

      const currentExistingGroups = await getCurrentWindowTabGroups(filteredTabs);
      setTabs(filteredTabs);
      setExistingGroups(currentExistingGroups);

      // Check if there are any ungrouped web tabs outside existing groups.
      // Excludes pinned tabs, empty New Tabs, YouTube home tabs, and internal browser tabs (e.g. chrome://extensions).
      // If 100% of real web tabs are already in groups, re-cluster all web tabs from scratch
      // when the user explicitly clicks "Prism Tabs".
      const hasUngroupedWebTabs = hasUngroupedGroupableWebTabs(
        allWindowTabs,
        currentExistingGroups,
        cleanupOpts
      );

      const effectiveExisting =
        latestSettings.deterministicOptions.preserveExistingGroups &&
        hasUngroupedWebTabs
          ? currentExistingGroups
          : [];

      const activeProvider = getActiveProviderConfig(latestSettings);

      let computedPlan: GroupingPlan;
      if (latestSettings.mode === 'meaning') {
        computedPlan = await runSemanticGrouping({
          tabs: filteredTabs,
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
          filteredTabs,
          latestSettings.customRules,
          latestSettings.deterministicOptions,
          effectiveExisting
        );
      }

      setPlan(computedPlan);

      if (computedPlan.fallbackTriggered && computedPlan.fallbackReason) {
        setErrorBanner(computedPlan.fallbackReason);
      }

      if (computedPlan.groups.length > 0) {
        const snapshot = await captureUndoSnapshot();
        await saveLastUndoSnapshot(snapshot);
        setUndoSnapshot(snapshot);

        await applyGroupingPlan(computedPlan, {
          collapseInactiveGroups: latestSettings.collapseOthersOnGroup,
          staggerMs: 28,
          onProgress: (prog) => setChoreography(prog),
        });
      }

      // Now that all Chrome Tab Groups are created and applied, close disposable tabs
      let closedCount = 0;
      if (cleanupOpts.closeEmptyTabs || cleanupOpts.closeYouTubeHomeTabs) {
        closedCount = await closeDisposableTabsInWindow(cleanupOpts);
      }

      const refreshedTabs = await getCurrentWindowTabs();
      const refreshedGroups = await getCurrentWindowTabGroups(refreshedTabs);
      setTabs(refreshedTabs);
      setExistingGroups(refreshedGroups);
      setPlan({ ...computedPlan, groups: [...computedPlan.groups] });

      if (closedCount > 0) {
        showToast(
          `Closed ${closedCount} leftover ${
            closedCount === 1 ? 'tab' : 'tabs'
          } & grouped ${computedPlan.groups.length} clusters`
        );
      }

      setSortDoneSuccess(true);
      setTimeout(() => setSortDoneSuccess(false), 1800);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unexpected error while grouping tabs in this window.';
      setErrorBanner(message);
    } finally {
      setIsSorting(false);
      setTimeout(() => setChoreography(null), 400);
    }
  }, [showToast]);

  const handleUpdateGroupInPlan = useCallback(
    (groupId: string, updates: Partial<ProposedTabGroup>) => {
      setPlan((prev) => {
        if (!prev) return prev;
        const nextGroups = prev.groups.map((g) => {
          if (g.id !== groupId) return g;
          const updated = { ...g, ...updates };
          if (typeof updated.existingGroupId === 'number') {
            void updateLiveChromeTabGroup(updated.existingGroupId, {
              title: `${updated.emoji} ${updated.groupName}`.trim(),
              color: updated.color,
            });
          }
          return updated;
        });
        return {
          ...prev,
          groups: nextGroups,
        };
      });
    },
    []
  );

  const handleRemoveGroupFromPlan = useCallback((groupId: string) => {
    setPlan((prev) => {
      if (!prev) return prev;
      const target = prev.groups.find((g) => g.id === groupId);
      if (target && typeof target.existingGroupId === 'number') {
        void ungroupSpecificTabs(target.tabIds);
      }
      return {
        ...prev,
        groups: prev.groups.filter((g) => g.id !== groupId),
      };
    });
  }, []);

  const handleUngroupAll = useCallback(async () => {
    try {
      setErrorBanner(null);
      const snapshot = await captureUndoSnapshot();
      await saveLastUndoSnapshot(snapshot);
      setUndoSnapshot(snapshot);

      const count = await ungroupAllTabsInWindow();
      const refreshedTabs = await getCurrentWindowTabs();
      const refreshedGroups = await getCurrentWindowTabGroups(refreshedTabs);
      setTabs(refreshedTabs);
      setExistingGroups(refreshedGroups);

      const freshPlan = computeLogicPlanForWindow(
        refreshedTabs,
        settings,
        refreshedGroups
      );
      setPlan(freshPlan);

      showToast(
        count > 0 ? `Ungrouped ${count} tabs` : 'All tabs are already ungrouped'
      );
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Could not ungroup tabs.'
      );
    }
  }, [settings, showToast, computeLogicPlanForWindow]);

  const handleUndo = useCallback(async () => {
    if (!undoSnapshot) return;
    try {
      setErrorBanner(null);
      await restoreUndoSnapshot(undoSnapshot);
      await clearLastUndoSnapshot();
      setUndoSnapshot(null);

      const refreshedTabs = await getCurrentWindowTabs();
      const refreshedGroups = await getCurrentWindowTabGroups(refreshedTabs);
      setTabs(refreshedTabs);
      setExistingGroups(refreshedGroups);

      if (settings.mode === 'meaning' && refreshedGroups.length > 0) {
        setPlan(buildExistingWindowGroupsPlan(refreshedTabs, refreshedGroups));
      } else {
        setPlan(
          computeLogicPlanForWindow(refreshedTabs, settings, refreshedGroups)
        );
      }

      showToast('Restored previous tab layout');
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Could not restore undo snapshot.'
      );
    }
  }, [undoSnapshot, settings, showToast, computeLogicPlanForWindow]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        void handlePrismSort();
      } else if (e.altKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        void handleUngroupAll();
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
  }, [handlePrismSort, handleUngroupAll, handleUndo, undoSnapshot]);

  const providerLabel =
    settings.aiProvider === 'groq'
      ? 'Groq'
      : settings.aiProvider === 'custom'
      ? 'Custom'
      : 'Gemini';

  return (
    <div className="flex flex-col max-h-[440px] bg-prism-bg text-slate-100 p-3 gap-2 select-none">
      {/* Top Minimal Header Bar */}
      <header className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-slate-700/80 flex items-center justify-center shadow-sm">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <h1 className="text-sm font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
            PRISM
          </h1>
        </div>

        {/* Single Settings Gear Button ⚙️ */}
        <button
          type="button"
          onClick={() => setIsSettingsOpen((prev) => !prev)}
          className={`inline-flex items-center justify-center rounded-lg border p-1.5 transition-colors ${
            isSettingsOpen
              ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-300'
              : 'border-slate-800 bg-prism-surface text-slate-400 hover:text-slate-200'
          }`}
          title="Settings (AI Setup, Rules, Smart Merge & Auto-Collapse)"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </header>

      {/* Dual-Engine Mode Switcher Pill */}
      <div className="grid shrink-0 grid-cols-2 gap-1.5 rounded-xl bg-prism-surface p-1 border border-slate-800/90">
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
        </button>
      </div>

      {/* Main Content: Either Unified Settings Sheet OR One-Click Prism Interface */}
      {isSettingsOpen ? (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5 animate-fade-in">
          {/* Quick Behavior Toggles (Close Empty Tabs, Close YouTube Home, Preserve Existing Groups & Auto-Collapse) */}
          <div className="rounded-xl border border-slate-800 bg-prism-surface/95 p-2.5 space-y-2 text-[11px]">
            <label className="flex items-center justify-between gap-2 cursor-pointer text-slate-200">
              <span>Close empty &ldquo;New Tab&rdquo; tabs</span>
              <input
                type="checkbox"
                checked={settings.closeEmptyTabs !== false}
                onChange={(e) =>
                  handleUpdateSettings({
                    closeEmptyTabs: e.target.checked,
                  })
                }
                className="rounded accent-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between gap-2 cursor-pointer text-slate-200 border-t border-slate-800/70 pt-1.5">
              <span className="flex items-center gap-1.5">
                <span>Close YouTube homepage tabs</span>
                <span className="text-[9px] font-mono text-slate-400 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">
                  youtube.com/
                </span>
              </span>
              <input
                type="checkbox"
                checked={Boolean(settings.closeYouTubeHomeTabs)}
                onChange={(e) =>
                  handleUpdateSettings({
                    closeYouTubeHomeTabs: e.target.checked,
                  })
                }
                className="rounded accent-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between gap-2 cursor-pointer text-slate-200 border-t border-slate-800/70 pt-1.5">
              <span>Preserve existing groups (Smart Merge)</span>
              <input
                type="checkbox"
                checked={settings.deterministicOptions.preserveExistingGroups}
                onChange={(e) =>
                  handleUpdateSettings({
                    deterministicOptions: {
                      ...settings.deterministicOptions,
                      preserveExistingGroups: e.target.checked,
                    },
                  })
                }
                className="rounded accent-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between gap-2 cursor-pointer text-slate-200 border-t border-slate-800/70 pt-1.5">
              <span>Auto-collapse inactive groups</span>
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
            </label>
          </div>

          {/* Sub-Tabs for AI Setup vs. Logic Rules */}
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-950 p-1 border border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => setSettingsTab('ai')}
              className={`rounded-md py-1 font-medium transition-colors ${
                settingsTab === 'ai'
                  ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              AI Setup ({providerLabel})
            </button>
            <button
              type="button"
              onClick={() => setSettingsTab('rules')}
              className={`rounded-md py-1 font-medium transition-colors ${
                settingsTab === 'rules'
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Logic Rules
            </button>
          </div>

          {settingsTab === 'ai' ? (
            <SemanticSettingsDrawer
              settings={settings}
              onSaveSettings={handleUpdateSettings}
            />
          ) : (
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
          )}
        </div>
      ) : (
        <>
          {/* Compact Prism Spectrum Bar */}
          <PrismRefractionBar
            isSorting={isSorting}
            mode={settings.mode}
            providerLabel={providerLabel}
            tabCount={tabs.length}
            groups={plan?.groups ?? []}
            choreography={choreography}
          />

          {/* Primary One-Click Action Button */}
          <button
            type="button"
            disabled={isSorting}
            onClick={handlePrismSort}
            className={`relative shrink-0 overflow-hidden flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-lg transition-all active:scale-[0.99] disabled:opacity-80 ${
              sortDoneSuccess
                ? 'bg-emerald-600 shadow-emerald-500/25'
                : settings.mode === 'meaning'
                ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 shadow-indigo-500/20'
                : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:via-teal-500 hover:to-cyan-500 shadow-emerald-500/20'
            }`}
          >
            <span className="flex items-center gap-2">
              {isSorting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sorting...</span>
                </>
              ) : sortDoneSuccess ? (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Done!</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Prism Tabs</span>
                </>
              )}
            </span>

            <kbd className="rounded bg-black/25 px-1.5 py-0.5 text-[10px] font-mono text-white/90 border border-white/15">
              Alt+P
            </kbd>
          </button>

          {/* Clean Group List (Single non-duplicated view) */}
          <main className="flex-1 min-h-0 overflow-y-auto pr-0.5">
            <GroupPreviewList
              plan={plan}
              tabsById={tabsById}
              isLoading={isSorting}
              choreography={choreography}
              onUpdateGroup={handleUpdateGroupInPlan}
              onRemoveGroup={handleRemoveGroupFromPlan}
            />
          </main>
        </>
      )}

      {/* Dismissible Error / Fallback Banner */}
      {errorBanner && (
        <div className="flex shrink-0 items-start justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-950/60 px-2.5 py-1.5 text-[11px] text-amber-200 max-h-20 overflow-y-auto animate-fade-in">
          <div className="flex items-start gap-1.5 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span className="break-words leading-tight">{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-amber-300/70 hover:text-amber-100 p-0.5 shrink-0"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Toast Notification Banner */}
      {statusMessage && !errorBanner && (
        <div className="shrink-0 rounded-lg bg-slate-800/95 border border-slate-700 px-3 py-1 text-center text-[11px] font-medium text-emerald-300 animate-fade-in">
          {statusMessage}
        </div>
      )}

      {/* Minimal Footer Bar: Undo & Ungroup All */}
      <footer className="flex shrink-0 items-center justify-between border-t border-slate-800/80 pt-1.5 text-[11px]">
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
      </footer>
    </div>
  );
};
