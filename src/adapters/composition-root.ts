import { ConfigPortabilityUseCase } from '../application/config-portability.usecase';
import { LiveGroupOpsUseCase } from '../application/live-group-ops.usecase';
import { SortWindowUseCase } from '../application/sort-window.usecase';
import { UndoLastSortUseCase } from '../application/undo-last-sort.usecase';
import { UngroupAllUseCase } from '../application/ungroup-all.usecase';
import type { BrowserTabsPort } from '../ports/browser-tabs.port';
import type { ClockPort } from '../ports/clock.port';
import type { LlmGatewayPort } from '../ports/llm-gateway.port';
import type { SettingsRepositoryPort } from '../ports/settings-repository.port';
import type { StoragePort } from '../ports/storage.port';
import { FetchLlmGateway } from './ai/fetch-llm-gateway';
import { ChromeTabsAdapter } from './chrome/chrome-tabs.adapter';
import { SystemClockAdapter } from './clock/system-clock.adapter';
import { ChromeStorageAdapter } from './storage/chrome-storage.adapter';
import { SettingsRepository } from './storage/settings-repository';

export interface PrismServices {
  tabsPort: BrowserTabsPort;
  settingsRepo: SettingsRepositoryPort;
  sortWindow: SortWindowUseCase;
  ungroupAll: UngroupAllUseCase;
  undoLastSort: UndoLastSortUseCase;
  liveGroupOps: LiveGroupOpsUseCase;
  configPortability: ConfigPortabilityUseCase;
}

export interface PrismServiceDependencies {
  tabsPort?: BrowserTabsPort;
  storagePort?: StoragePort;
  llmGateway?: LlmGatewayPort;
  clock?: ClockPort;
}

export function createPrismServices(deps: PrismServiceDependencies = {}): PrismServices {
  const tabsPort = deps.tabsPort ?? new ChromeTabsAdapter();
  const storagePort = deps.storagePort ?? new ChromeStorageAdapter();
  const settingsRepo = new SettingsRepository(storagePort);
  const llmGateway = deps.llmGateway ?? new FetchLlmGateway();
  const clock = deps.clock ?? new SystemClockAdapter();

  return {
    tabsPort,
    settingsRepo,
    sortWindow: new SortWindowUseCase(tabsPort, settingsRepo, llmGateway, clock),
    ungroupAll: new UngroupAllUseCase(tabsPort, settingsRepo, clock),
    undoLastSort: new UndoLastSortUseCase(tabsPort, settingsRepo),
    liveGroupOps: new LiveGroupOpsUseCase(tabsPort),
    configPortability: new ConfigPortabilityUseCase(settingsRepo, clock),
  };
}
