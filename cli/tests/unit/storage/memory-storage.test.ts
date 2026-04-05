import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage } from '../../../src/storage/memory-storage.js';
import type { StoredCredential } from '../../../src/core/types.js';

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  const mockCredential: StoredCredential = {
    credential: { type: 'api-key', key: 'test-key', headerName: 'Authorization', headerPrefix: 'Bearer' },
    providerId: 'test-provider',
    strategy: 'api-token',
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('returns null for unknown provider', async () => {
    expect(await storage.get('unknown')).toBeNull();
  });

  it('stores and retrieves a credential', async () => {
    await storage.set('test', mockCredential);
    const retrieved = await storage.get('test');
    expect(retrieved).toEqual(mockCredential);
  });

  it('overwrites existing credential', async () => {
    await storage.set('test', mockCredential);
    const updated = { ...mockCredential, updatedAt: 'updated' };
    await storage.set('test', updated);
    expect(await storage.get('test')).toEqual(updated);
  });

  it('deletes a credential', async () => {
    await storage.set('test', mockCredential);
    await storage.delete('test');
    expect(await storage.get('test')).toBeNull();
  });

  it('delete is a no-op for unknown provider', async () => {
    await storage.delete('unknown'); // should not throw
  });

  it('lists stored entries', async () => {
    await storage.set('a', { ...mockCredential, providerId: 'a' });
    await storage.set('b', { ...mockCredential, providerId: 'b', strategy: 'cookie' });
    const entries = await storage.list();
    expect(entries).toHaveLength(2);
    expect(entries.map(e => e.providerId).sort()).toEqual(['a', 'b']);
  });

  it('clears all credentials', async () => {
    await storage.set('a', mockCredential);
    await storage.set('b', mockCredential);
    await storage.clear();
    expect(await storage.list()).toHaveLength(0);
    expect(await storage.get('a')).toBeNull();
  });
});
