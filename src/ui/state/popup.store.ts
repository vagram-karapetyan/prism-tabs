import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import {
  createPrismServices,
  type PrismServiceDependencies,
  type PrismServices,
} from '../../adapters/composition-root';
import { createDefaultSettings } from '../../domain/defaults';
import { THEME_DESCRIPTORS, resolveConcreteTheme } from '../../domain/themes';
import type {
  ChromeTabGroupColor,
  EngineMode,
  ExistingTabGroup,
  GroupingPlan,
  PrismSettings,
  SortWindowResult,
  TabMetadata,
  ThemeId,
} from '../../domain/types';
import { filterTabsAndGroups, type SearchFilterResult } from '../utils/search-filter';

export type SettingsTabId = 'general' | 'ai' | 'rules';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: number;
  tone: ToastTone;
  text: string;
}

function getBootBackground(concreteTheme: string): string {
  const match = THEME_DESCRIPTORS.find((t) => t.id === concreteTheme);
  return match?.bootBackground ?? '#0b0e17';
}

export function isTabUngrouped(tab: TabMetadata): boolean {
  return tab.groupId === undefined || tab.groupId < 0;
}

export function applyThemeToDom(theme: ThemeId): void {
  if (typeof document === 'undefined') return;

  const prefersDark =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true;

  const concrete = resolveConcreteTheme(theme, prefersDark);
  const root = document.documentElement;
  root.dataset.theme = concrete;
  root.dataset.themeMode = theme;
  root.style.colorScheme = concrete === 'pure-light' ? 'light' : 'dark';
  root.style.backgroundColor = getBootBackground(concrete);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('prism_theme_hint_v2', theme);
    }
  } catch {
    // Ignore storage quota or sandbox errors
  }
}

export interface PopupStore {
  readonly settings: Signal<PrismSettings>;
  readonly windowId: Signal<number | null>;
  readonly tabs: Signal<TabMetadata[]>;
  readonly groups: Signal<ExistingTabGroup[]>;
  readonly lastPlan: Signal<GroupingPlan | null>;
  readonly hasUndoSnapshot: Signal<boolean>;
  readonly isLoading: Signal<boolean>;
  readonly isSorting: Signal<boolean>;
  readonly sortPhase: Signal<string>;
  readonly searchQuery: Signal<string>;
  readonly settingsOpen: Signal<boolean>;
  readonly settingsTab: Signal<SettingsTabId>;
  readonly expandedGroupIds: Signal<number[]>;
  readonly draggingTabId: Signal<number | null>;
  readonly toast: Signal<ToastMessage | null>;
  readonly fallbackBanner: Signal<string | null>;

  readonly searchResult: ReadonlySignal<SearchFilterResult>;
  readonly ungroupedCount: ReadonlySignal<number>;

  init(): Promise<void>;
  refreshWindowState(): Promise<void>;
  runSort(modeOverride?: EngineMode): Promise<SortWindowResult | null>;
  runUngroupAll(): Promise<void>;
  runUndo(): Promise<void>;
  updateSettings(patch: Partial<PrismSettings>): Promise<void>;
  setMode(mode: EngineMode): Promise<void>;
  renameGroup(groupId: number, newTitle: string): Promise<void>;
  recolorGroup(groupId: number, color: ChromeTabGroupColor): Promise<void>;
  ungroupGroup(groupId: number): Promise<void>;
  moveTab(tabId: number, targetGroupId: number | null): Promise<void>;
  exportConfigJson(): string;
  importConfigJson(jsonText: string): Promise<{
    success: boolean;
    message: string;
    warnings: string[];
  }>;
  toggleGroupExpanded(groupId: number): void;
  setSearchQuery(query: string): void;
  clearSearch(): void;
  openSettings(tab?: SettingsTabId): void;
  closeSettings(): void;
  setSettingsTab(tab: SettingsTabId): void;
  setDraggingTabId(tabId: number | null): void;
  dismissFallbackBanner(): void;
  dismissToast(): void;
  showToast(tone: ToastTone, text: string, durationMs?: number): void;
  dispose(): void;
}

export function createPopupStore(deps?: PrismServiceDependencies): PopupStore {
  const services: PrismServices = createPrismServices(deps);

  const settings = signal<PrismSettings>(createDefaultSettings());
  const windowId = signal<number | null>(null);
  const tabs = signal<TabMetadata[]>([]);
  const groups = signal<ExistingTabGroup[]>([]);
  const lastPlan = signal<GroupingPlan | null>(null);
  const hasUndoSnapshot = signal<boolean>(false);
  const isLoading = signal<boolean>(true);
  const isSorting = signal<boolean>(false);
  const sortPhase = signal<string>('Ready');
  const searchQuery = signal<string>('');
  const settingsOpen = signal<boolean>(false);
  const settingsTab = signal<SettingsTabId>('general');
  const expandedGroupIds = signal<number[]>([]);
  const draggingTabId = signal<number | null>(null);
  const toast = signal<ToastMessage | null>(null);
  const fallbackBanner = signal<string | null>(null);

  const searchResult = computed(() =>
    filterTabsAndGroups(tabs.value, groups.value, searchQuery.value),
  );
  const ungroupedCount = computed(() => tabs.value.filter(isTabUngrouped).length);

  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let toastSeq = 0;
  let removeMediaListener: (() => void) | null = null;

  function showToast(tone: ToastTone, text: string, durationMs = 4200): void {
    if (toastTimer !== null) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    toastSeq += 1;
    const id = toastSeq;
    toast.value = { id, tone, text };
    if (durationMs > 0) {
      toastTimer = setTimeout(() => {
        if (toast.value?.id === id) {
          toast.value = null;
        }
      }, durationMs);
    }
  }

  function dismissToast(): void {
    if (toastTimer !== null) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    toast.value = null;
  }

  function applyWindowSnapshot(nextTabs: TabMetadata[], nextGroups: ExistingTabGroup[]): void {
    tabs.value = nextTabs;
    groups.value = nextGroups;
    const validIds = new Set(nextGroups.map((g) => g.id));
    expandedGroupIds.value = expandedGroupIds.value.filter((id) => validIds.has(id));
  }

  async function refreshWindowState(): Promise<void> {
    const activeWindowId =
      windowId.value ?? (await services.tabsPort.getCurrentWindowId());
    windowId.value = activeWindowId;

    const [nextTabs, nextGroups] = await Promise.all([
      services.tabsPort.getWindowTabs(activeWindowId),
      services.tabsPort.getWindowTabGroups(activeWindowId),
    ]);
    applyWindowSnapshot(nextTabs, nextGroups);
  }

  function ensureSystemThemeListener(): void {
    if (
      removeMediaListener ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (): void => {
      if (settings.value.theme === 'system') {
        applyThemeToDom('system');
      }
    };
    mediaQuery.addEventListener('change', handler);
    removeMediaListener = () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }

  async function init(): Promise<void> {
    isLoading.value = true;
    try {
      const [loadedSettings, undoSnap] = await Promise.all([
        services.settingsRepo.loadSettings(),
        services.settingsRepo.loadUndoSnapshot(),
      ]);
      settings.value = loadedSettings;
      hasUndoSnapshot.value = undoSnap !== null;
      applyThemeToDom(loadedSettings.theme);
      ensureSystemThemeListener();

      await refreshWindowState();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize popup state.';
      showToast('error', message);
    } finally {
      isLoading.value = false;
    }
  }

  async function runSort(modeOverride?: EngineMode): Promise<SortWindowResult | null> {
    if (isSorting.value) return null;

    const effectiveMode = modeOverride ?? settings.value.mode;
    isSorting.value = true;
    sortPhase.value =
      effectiveMode === 'meaning' ? 'Refracting with AI...' : 'Refracting locally...';

    try {
      const result = await services.sortWindow.execute({
        modeOverride: effectiveMode,
        windowId: windowId.value ?? undefined,
      });

      lastPlan.value = result.plan;
      hasUndoSnapshot.value = true;
      await refreshWindowState();

      if (result.plan.fallbackTriggered) {
        const reason =
          result.plan.fallbackReason ?? 'AI unavailable; sorted locally with Logic Mode.';
        fallbackBanner.value = reason;
      } else {
        fallbackBanner.value = null;
      }

      const parts: string[] = [
        `${result.plan.groups.length} groups (${Math.round(result.plan.latencyMs)} ms)`,
      ];
      if (result.closedTabsCount > 0) {
        parts.push(`${result.closedTabsCount} closed`);
      }
      if (result.discardedTabsCount > 0) {
        parts.push(`${result.discardedTabsCount} hibernated`);
      }
      if (result.estimatedRamSavedMb > 0) {
        parts.push(`~${result.estimatedRamSavedMb} MB RAM saved`);
      }

      showToast(
        result.plan.fallbackTriggered ? 'warning' : 'success',
        `Sorted into ${parts.join(' • ')}`,
      );
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sorting failed unexpectedly.';
      showToast('error', message);
      return null;
    } finally {
      isSorting.value = false;
      sortPhase.value = 'Ready';
    }
  }

  async function runUngroupAll(): Promise<void> {
    if (isSorting.value) return;
    isSorting.value = true;
    sortPhase.value = 'Ungrouping tabs...';
    try {
      const res = await services.ungroupAll.execute(windowId.value ?? undefined);
      fallbackBanner.value = null;
      hasUndoSnapshot.value = true;
      await refreshWindowState();
      showToast(
        'info',
        res.ungroupedCount > 0
          ? `Ungrouped ${res.ungroupedCount} tabs.`
          : 'No grouped tabs to ungroup.',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ungroup failed.';
      showToast('error', message);
    } finally {
      isSorting.value = false;
      sortPhase.value = 'Ready';
    }
  }

  async function runUndo(): Promise<void> {
    if (isSorting.value) return;
    isSorting.value = true;
    sortPhase.value = 'Restoring previous state...';
    try {
      const res = await services.undoLastSort.execute();
      hasUndoSnapshot.value = false;
      await refreshWindowState();
      if (res.restored) {
        showToast(
          'success',
          `Restored ${res.restoredTabsCount} tabs across ${res.restoredGroupsCount} groups.`,
        );
      } else {
        showToast('warning', res.reason ?? 'Nothing to undo.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Undo failed.';
      showToast('error', message);
    } finally {
      isSorting.value = false;
      sortPhase.value = 'Ready';
    }
  }

  async function updateSettings(patch: Partial<PrismSettings>): Promise<void> {
    const updated = await services.settingsRepo.updateSettings(patch);
    settings.value = updated;
    if (patch.theme !== undefined) {
      applyThemeToDom(updated.theme);
    }
  }

  async function setMode(mode: EngineMode): Promise<void> {
    await updateSettings({ mode });
  }

  async function resolveActiveWindowId(): Promise<number> {
    if (windowId.value !== null) return windowId.value;
    const id = await services.tabsPort.getCurrentWindowId();
    windowId.value = id;
    return id;
  }

  async function renameGroup(groupId: number, newTitle: string): Promise<void> {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const activeWin = await resolveActiveWindowId();
    const snap = await services.liveGroupOps.renameGroup(activeWin, groupId, trimmed);
    applyWindowSnapshot(snap.tabs, snap.groups);
    if (!snap.ok && snap.reason) {
      showToast('warning', snap.reason);
    }
  }

  async function recolorGroup(groupId: number, color: ChromeTabGroupColor): Promise<void> {
    const activeWin = await resolveActiveWindowId();
    const snap = await services.liveGroupOps.recolorGroup(activeWin, groupId, color);
    applyWindowSnapshot(snap.tabs, snap.groups);
    if (!snap.ok && snap.reason) {
      showToast('warning', snap.reason);
    }
  }

  async function ungroupGroup(groupId: number): Promise<void> {
    const activeWin = await resolveActiveWindowId();
    const snap = await services.liveGroupOps.ungroupSingleGroup(activeWin, groupId);
    applyWindowSnapshot(snap.tabs, snap.groups);
    if (!snap.ok && snap.reason) {
      showToast('warning', snap.reason);
    } else {
      showToast('info', 'Group ungrouped.');
    }
  }

  async function moveTab(tabId: number, targetGroupId: number | null): Promise<void> {
    draggingTabId.value = null;
    const activeWin = await resolveActiveWindowId();
    const snap = await services.liveGroupOps.moveTabToGroup(activeWin, tabId, targetGroupId);
    applyWindowSnapshot(snap.tabs, snap.groups);
    if (!snap.ok && snap.reason) {
      showToast('warning', snap.reason);
    }
  }

  function exportConfigJson(): string {
    const exported = services.configPortability.exportConfig(settings.value);
    return JSON.stringify(exported, null, 2);
  }

  async function importConfigJson(jsonText: string): Promise<{
    success: boolean;
    message: string;
    warnings: string[];
  }> {
    const res = await services.configPortability.importConfig(jsonText);
    if (res.success && res.settings) {
      settings.value = res.settings;
      applyThemeToDom(res.settings.theme);
      showToast('success', res.message);
    } else {
      showToast('error', res.message);
    }
    return {
      success: res.success,
      message: res.message,
      warnings: res.warnings,
    };
  }

  function toggleGroupExpanded(groupId: number): void {
    const current = expandedGroupIds.value;
    if (current.includes(groupId)) {
      expandedGroupIds.value = current.filter((id) => id !== groupId);
    } else {
      expandedGroupIds.value = [...current, groupId];
    }
  }

  function dispose(): void {
    if (toastTimer !== null) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    if (removeMediaListener) {
      removeMediaListener();
      removeMediaListener = null;
    }
  }

  return {
    settings,
    windowId,
    tabs,
    groups,
    lastPlan,
    hasUndoSnapshot,
    isLoading,
    isSorting,
    sortPhase,
    searchQuery,
    settingsOpen,
    settingsTab,
    expandedGroupIds,
    draggingTabId,
    toast,
    fallbackBanner,
    searchResult,
    ungroupedCount,
    init,
    refreshWindowState,
    runSort,
    runUngroupAll,
    runUndo,
    updateSettings,
    setMode,
    renameGroup,
    recolorGroup,
    ungroupGroup,
    moveTab,
    exportConfigJson,
    importConfigJson,
    toggleGroupExpanded,
    setSearchQuery: (query: string) => {
      searchQuery.value = query;
    },
    clearSearch: () => {
      searchQuery.value = '';
    },
    openSettings: (tab?: SettingsTabId) => {
      if (tab) settingsTab.value = tab;
      settingsOpen.value = true;
    },
    closeSettings: () => {
      settingsOpen.value = false;
    },
    setSettingsTab: (tab: SettingsTabId) => {
      settingsTab.value = tab;
    },
    setDraggingTabId: (tabId: number | null) => {
      draggingTabId.value = tabId;
    },
    dismissFallbackBanner: () => {
      fallbackBanner.value = null;
    },
    dismissToast,
    showToast,
    dispose,
  };
}
