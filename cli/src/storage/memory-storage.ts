import type { IStorage } from '../core/interfaces/storage.js';
import type { StoredCredential, StoredEntry } from '../core/types.js';

/**
 * In-memory storage implementation for testing.
 * No persistence — data is lost when the process exits.
 */
export class MemoryStorage implements IStorage {
    private store = new Map<string, StoredCredential>();

    async get(providerId: string): Promise<StoredCredential | null> {
        return this.store.get(providerId) ?? null;
    }

    async set(providerId: string, credential: StoredCredential): Promise<void> {
        this.store.set(providerId, credential);
    }

    async delete(providerId: string): Promise<void> {
        this.store.delete(providerId);
    }

    async list(): Promise<StoredEntry[]> {
        return Array.from(this.store.entries()).map(([providerId, stored]) => ({
            providerId,
            strategy: stored.strategy,
            updatedAt: stored.updatedAt,
            credentialType: stored.credential.type,
        }));
    }

    async clear(): Promise<void> {
        this.store.clear();
    }
}
