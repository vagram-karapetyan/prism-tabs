export interface StoragePort {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}
