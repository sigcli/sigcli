import { describe, it, expect, beforeEach } from 'vitest';
import { RoutingStorage } from '../../../src/storage/routing-storage.js';
import { MemoryStorage } from '../../../src/storage/memory-storage.js';
import type { StoredCredential, ProviderSource } from '../../../src/core/types.js';

describe('RoutingStorage', () => {
    let userStorage: MemoryStorage;
    let projectStorage: MemoryStorage;

    const makeCred = (providerId: string): StoredCredential => ({
        credential: {
            type: 'api-key',
            key: `key-${providerId}`,
            headerName: 'Authorization',
            headerPrefix: 'Bearer',
        },
        providerId,
        strategy: 'api-token',
        updatedAt: new Date().toISOString(),
    });

    beforeEach(() => {
        userStorage = new MemoryStorage();
        projectStorage = new MemoryStorage();
    });

    it('routes project provider to projectStorage', async () => {
        const sources: Record<string, ProviderSource> = { 'proj-api': 'project' };
        const routing = new RoutingStorage(userStorage, projectStorage, sources);

        await routing.set('proj-api', makeCred('proj-api'));

        expect(await projectStorage.get('proj-api')).not.toBeNull();
        expect(await userStorage.get('proj-api')).toBeNull();
    });

    it('routes user provider to userStorage', async () => {
        const sources: Record<string, ProviderSource> = { 'global-api': 'user' };
        const routing = new RoutingStorage(userStorage, projectStorage, sources);

        await routing.set('global-api', makeCred('global-api'));

        expect(await userStorage.get('global-api')).not.toBeNull();
        expect(await projectStorage.get('global-api')).toBeNull();
    });

    it('routes unknown provider to userStorage (fallback)', async () => {
        const sources: Record<string, ProviderSource> = {};
        const routing = new RoutingStorage(userStorage, projectStorage, sources);

        await routing.set('unknown', makeCred('unknown'));

        expect(await userStorage.get('unknown')).not.toBeNull();
        expect(await projectStorage.get('unknown')).toBeNull();
    });

    it('get retrieves from the correct storage', async () => {
        const sources: Record<string, ProviderSource> = { 'proj-api': 'project', jira: 'user' };
        const routing = new RoutingStorage(userStorage, projectStorage, sources);

        const projCred = makeCred('proj-api');
        const userCred = makeCred('jira');
        await projectStorage.set('proj-api', projCred);
        await userStorage.set('jira', userCred);

        expect(await routing.get('proj-api')).toEqual(projCred);
        expect(await routing.get('jira')).toEqual(userCred);
    });

    it('delete removes from the correct storage', async () => {
        const sources: Record<string, ProviderSource> = { 'proj-api': 'project' };
        const routing = new RoutingStorage(userStorage, projectStorage, sources);

        await projectStorage.set('proj-api', makeCred('proj-api'));
        await routing.delete('proj-api');

        expect(await projectStorage.get('proj-api')).toBeNull();
    });

    it('list merges entries from both storages', async () => {
        const sources: Record<string, ProviderSource> = { 'proj-api': 'project', jira: 'user' };
        const routing = new RoutingStorage(userStorage, projectStorage, sources);

        await userStorage.set('jira', makeCred('jira'));
        await projectStorage.set('proj-api', makeCred('proj-api'));

        const entries = await routing.list();
        expect(entries).toHaveLength(2);
        expect(entries.map((e) => e.providerId).sort()).toEqual(['jira', 'proj-api']);
    });

    it('clear removes from both storages', async () => {
        const sources: Record<string, ProviderSource> = { 'proj-api': 'project', jira: 'user' };
        const routing = new RoutingStorage(userStorage, projectStorage, sources);

        await userStorage.set('jira', makeCred('jira'));
        await projectStorage.set('proj-api', makeCred('proj-api'));

        await routing.clear();

        expect(await userStorage.list()).toHaveLength(0);
        expect(await projectStorage.list()).toHaveLength(0);
    });

    it('works with null projectStorage (no project context)', async () => {
        const sources: Record<string, ProviderSource> = { jira: 'user' };
        const routing = new RoutingStorage(userStorage, null, sources);

        await routing.set('jira', makeCred('jira'));
        expect(await routing.get('jira')).not.toBeNull();

        const entries = await routing.list();
        expect(entries).toHaveLength(1);
    });

    it('falls back to userStorage for project providers when projectStorage is null', async () => {
        const sources: Record<string, ProviderSource> = { 'proj-api': 'project' };
        const routing = new RoutingStorage(userStorage, null, sources);

        await routing.set('proj-api', makeCred('proj-api'));
        expect(await userStorage.get('proj-api')).not.toBeNull();
    });
});
