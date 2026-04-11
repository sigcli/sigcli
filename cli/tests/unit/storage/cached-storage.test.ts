import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CachedStorage } from '../../../src/storage/cached-storage.js';
import { MemoryStorage } from '../../../src/storage/memory-storage.js';
import type { StoredCredential } from '../../../src/core/types.js';

describe('CachedStorage', () => {
    let inner: MemoryStorage;
    let cached: CachedStorage;

    const mockCred: StoredCredential = {
        credential: { type: 'api-key', key: 'k', headerName: 'Authorization' },
        providerId: 'test',
        strategy: 'api-token',
        updatedAt: new Date().toISOString(),
    };

    beforeEach(() => {
        inner = new MemoryStorage();
        cached = new CachedStorage(inner, { ttlMs: 100 });
    });

    it('caches get() results', async () => {
        await inner.set('test', mockCred);
        const spy = vi.spyOn(inner, 'get');

        await cached.get('test'); // First call: hits inner
        await cached.get('test'); // Second call: cached

        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('invalidates cache on set()', async () => {
        await inner.set('test', mockCred);
        const spy = vi.spyOn(inner, 'get');

        await cached.get('test');
        await cached.set('test', { ...mockCred, updatedAt: 'new' });
        await cached.get('test');

        expect(spy).toHaveBeenCalledTimes(2); // Re-fetched after set
    });

    it('invalidates cache on delete()', async () => {
        await inner.set('test', mockCred);
        const spy = vi.spyOn(inner, 'get');

        await cached.get('test');
        await cached.delete('test');
        await cached.get('test');

        expect(spy).toHaveBeenCalledTimes(2);
    });

    it('expires cache after TTL', async () => {
        await inner.set('test', mockCred);
        const spy = vi.spyOn(inner, 'get');

        await cached.get('test');
        await new Promise((resolve) => setTimeout(resolve, 150)); // Wait for TTL
        await cached.get('test');

        expect(spy).toHaveBeenCalledTimes(2);
    });

    it('clears all caches', async () => {
        await cached.set('a', mockCred);
        await cached.set('b', mockCred);
        await cached.get('a');

        await cached.clear();

        expect(await cached.get('a')).toBeNull();
        expect(await cached.list()).toHaveLength(0);
    });
});
