import type { IStorage } from '../core/interfaces/storage.js';
import type { StoredCredential, StoredEntry } from '../core/types.js';

interface CacheEntry {
  value: StoredCredential | null;
  expiresAt: number;
}

/**
 * Decorator that adds a TTL cache over any IStorage implementation.
 * Reads are cached; writes invalidate the cache for the affected key.
 *
 * Usage:
 *   const storage = new CachedStorage(new DirectoryStorage(dir), { ttlMs: 5000 });
 */
export class CachedStorage implements IStorage {
  private cache = new Map<string, CacheEntry>();
  private listCache: { entries: StoredEntry[]; expiresAt: number } | null = null;

  constructor(
    private readonly inner: IStorage,
    private readonly options: { ttlMs: number } = { ttlMs: 5000 },
  ) {}

  async get(providerId: string): Promise<StoredCredential | null> {
    const cached = this.cache.get(providerId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

    const value = await this.inner.get(providerId);
    this.cache.set(providerId, {
      value,
      expiresAt: Date.now() + this.options.ttlMs,
    });
    return value;
  }

  async set(providerId: string, credential: StoredCredential): Promise<void> {
    this.invalidate(providerId);
    await this.inner.set(providerId, credential);
  }

  async delete(providerId: string): Promise<void> {
    this.invalidate(providerId);
    await this.inner.delete(providerId);
  }

  async list(): Promise<StoredEntry[]> {
    if (this.listCache && Date.now() < this.listCache.expiresAt) {
      return this.listCache.entries;
    }

    const entries = await this.inner.list();
    this.listCache = {
      entries,
      expiresAt: Date.now() + this.options.ttlMs,
    };
    return entries;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.listCache = null;
    await this.inner.clear();
  }

  private invalidate(providerId: string): void {
    this.cache.delete(providerId);
    this.listCache = null;
  }
}
