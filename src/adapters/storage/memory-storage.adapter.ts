import type { StoragePort } from '../../ports/storage.port';

export class MemoryStorageAdapter implements StoragePort {
  private readonly store = new Map<string, unknown>();

  constructor(initialData?: Record<string, unknown>) {
    if (initialData) {
      for (const [key, value] of Object.entries(initialData)) {
        this.store.set(key, structuredClone(value));
      }
    }
  }

  get<T>(key: string): Promise<T | undefined> {
    const value = this.store.get(key);
    return Promise.resolve(value === undefined ? undefined : (structuredClone(value) as T));
  }

  set(key: string, value: unknown): Promise<void> {
    this.store.set(key, structuredClone(value));
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }
}
