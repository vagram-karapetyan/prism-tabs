import { runDeterministicGrouping } from '../engine/deterministic';
import { runSemanticGrouping } from '../engine/semantic';
import {
  applyGroupingPlan,
  captureUndoSnapshot,
  closeEmptyTabsInWindow,
  getCurrentWindowTabGroups,
  getCurrentWindowTabs,
  hasUngroupedGroupableWebTabs,
  isEmptyBrowserTab,
  ungroupAllTabsInWindow,
} from '../services/chromeTabsService';
import { geminiClient } from '../services/geminiService';
import {
  clearLastUndoSnapshot,
  getActiveProviderConfig,
  loadSettings,
  saveLastUndoSnapshot,
} from '../storage/storageService';

/**
 * Non-persistent Manifest V3 Service Worker.
 * Stateless event handlers ensure zero background memory leaks.
 */
async function executeQuickPrismSort(): Promise<void> {
  const [settings, allWindowTabs] = await Promise.all([
    loadSettings(),
    getCurrentWindowTabs(),
  ]);

  if (allWindowTabs.length === 0) return;

  const shouldCloseEmpty = settings.closeEmptyTabs !== false;
  const tabs = shouldCloseEmpty
    ? allWindowTabs.filter((t) => !isEmptyBrowserTab(t))
    : allWindowTabs;

  if (tabs.length > 0) {
    const currentExistingGroups = await getCurrentWindowTabGroups(tabs);
    const hasUngrouped = hasUngroupedGroupableWebTabs(
      tabs,
      currentExistingGroups
    );
    const existingGroups =
      settings.deterministicOptions.preserveExistingGroups && hasUngrouped
        ? currentExistingGroups
        : [];

    const undoSnapshot = await captureUndoSnapshot();
    await saveLastUndoSnapshot(undoSnapshot);

    const activeProvider = getActiveProviderConfig(settings);

    const plan =
      settings.mode === 'meaning'
        ? await runSemanticGrouping({
            tabs,
            provider: activeProvider.provider,
            apiKey: activeProvider.apiKey,
            model: activeProvider.model,
            baseUrl: activeProvider.baseUrl,
            customPromptDirective: settings.customPromptDirective,
            deterministicRules: settings.customRules,
            deterministicOptions: settings.deterministicOptions,
            existingGroups,
            client: geminiClient,
          })
        : runDeterministicGrouping(
            tabs,
            settings.customRules,
            settings.deterministicOptions,
            existingGroups
          );

    await applyGroupingPlan(plan, {
      collapseInactiveGroups: settings.collapseOthersOnGroup,
      staggerMs: 28,
    });
  }

  if (shouldCloseEmpty) {
    await closeEmptyTabsInWindow();
  }
}

if (typeof chrome !== 'undefined' && chrome.commands) {
  chrome.commands.onCommand.addListener((command) => {
    if (command === 'prism-sort-tabs') {
      void executeQuickPrismSort();
    } else if (command === 'prism-ungroup-all') {
      void ungroupAllTabsInWindow().then(() => clearLastUndoSnapshot());
    }
  });
}
