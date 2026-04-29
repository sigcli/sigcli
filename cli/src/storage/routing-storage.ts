import type { IStorage } from '../core/interfaces/storage.js';
import type { StoredCredential, StoredEntry, ProviderSource } from '../core/types.js';

/**
 * Routes credential storage operations to project or user storage
 * based on provider source mapping.
 *
 * - Project-sourced providers → projectStorage
 * - User-sourced providers (or unknown) → userStorage
 * - list() merges entries from both storages
 */
export class RoutingStorage implements IStorage {
    constructor(
        private readonly userStorage: IStorage,
        private readonly projectStorage: IStorage | null,
        private readonly providerSources: Record<string, ProviderSource>,
    ) {}

    private storageFor(providerId: string): IStorage {
        if (this.projectStorage && this.providerSources[providerId] === 'project') {
            return this.projectStorage;
        }
        return this.userStorage;
    }

    async get(providerId: string): Promise<StoredCredential | null> {
        return this.storageFor(providerId).get(providerId);
    }

    async set(providerId: string, credential: StoredCredential): Promise<void> {
        return this.storageFor(providerId).set(providerId, credential);
    }

    async delete(providerId: string): Promise<void> {
        return this.storageFor(providerId).delete(providerId);
    }

    async list(): Promise<StoredEntry[]> {
        const entries = await this.userStorage.list();
        if (this.projectStorage) {
            const projectEntries = await this.projectStorage.list();
            entries.push(...projectEntries);
        }
        return entries;
    }

    async clear(): Promise<void> {
        await this.userStorage.clear();
        if (this.projectStorage) {
            await this.projectStorage.clear();
        }
    }
}
