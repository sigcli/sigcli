import type { StoredCredential, StoredEntry } from '../types.js';

/**
 * Credential persistence interface.
 *
 * Implementations:
 * - DirectoryStorage: one JSON file per provider in a directory (production)
 * - CachedStorage: TTL cache decorator wrapping any IStorage
 * - MemoryStorage: in-memory (testing)
 */
export interface IStorage {
    /** Get stored credential for a provider. Returns null if not found. */
    get(providerId: string): Promise<StoredCredential | null>;

    /** Store (or overwrite) credential for a provider. */
    set(providerId: string, credential: StoredCredential): Promise<void>;

    /** Delete stored credential for a provider. No-op if not found. */
    delete(providerId: string): Promise<void>;

    /** List all stored entries (summary, not full credentials). */
    list(): Promise<StoredEntry[]>;

    /** Delete all stored credentials. */
    clear(): Promise<void>;
}
