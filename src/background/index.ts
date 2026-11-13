import { createPrismServices, type PrismServices } from '../adapters/composition-root';
import { APP_VERSION } from '../domain/version';

export async function handleBackgroundCommand(
  command: string,
  services: PrismServices,
): Promise<boolean> {
  if (command === 'prism-sort-tabs') {
    await services.sortWindow.execute();
    return true;
  }
  if (command === 'prism-ungroup-all') {
    await services.ungroupAll.execute();
    return true;
  }
  return false;
}

const chromeApi = (globalThis as { chrome?: typeof chrome }).chrome;

if (chromeApi) {
  const services = createPrismServices();

  chromeApi.runtime.onInstalled.addListener(() => {
    console.debug(`Prism Tabs v${APP_VERSION} service worker initialized`);
  });

  chromeApi.commands.onCommand.addListener((command) => {
    void handleBackgroundCommand(command, services).catch((err: unknown) => {
      console.error('Prism command execution failed:', err);
    });
  });
}
