import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncEngine } from '../../../src/sync/sync-engine.js';
import { MemoryStorage } from '../../../src/storage/memory-storage.js';
import type { StoredCredential } from '../../../src/core/types.js';
import type { RemoteConfig } from '../../../src/sync/types.js';

// Mock SshTransport
const mockListRemote = vi.fn();
const mockReadRemote = vi.fn();
const mockWriteRemote = vi.fn();

vi.mock('../../../src/sync/transports/ssh.js', () => ({
  SshTransport: vi.fn().mockImplementation(() => ({
    listRemote: mockListRemote,
    readRemote: mockReadRemote,
    writeRemote: mockWriteRemote,
  })),
}));

function makeCredential(providerId: string, updatedAt: string): StoredCredential {
  return {
    credential: { type: 'bearer', accessToken: `token-${providerId}` },
    providerId,
    strategy: 'oauth2',
    updatedAt,
  };
}

const testRemote: RemoteConfig = {
  name: 'test-remote',
  type: 'ssh',
  host: 'test.example.com',
  user: 'testuser',
};

describe('SyncEngine', () => {
  let storage: MemoryStorage;
  let engine: SyncEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new MemoryStorage();
    engine = new SyncEngine(storage, testRemote);
  });

  describe('push', () => {
    it('returns empty result when no local credentials exist', async () => {
      mockListRemote.mockResolvedValue([]);

      const result = await engine.push();

      expect(result.pushed).toEqual([]);
      expect(result.pulled).toEqual([]);
      expect(result.skipped).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('pushes single provider to empty remote', async () => {
      const cred = makeCredential('jira', '2026-04-01T00:00:00Z');
      await storage.set('jira', cred);
      mockListRemote.mockResolvedValue([]);
      mockWriteRemote.mockResolvedValue(undefined);

      const result = await engine.push();

      expect(result.pushed).toEqual(['jira']);
      expect(mockWriteRemote).toHaveBeenCalledTimes(1);
      expect(mockWriteRemote).toHaveBeenCalledWith(testRemote, 'jira.json', cred);
    });

    it('skips provider when remote is newer (conflict detection)', async () => {
      const localCred = makeCredential('jira', '2026-04-01T00:00:00Z');
      await storage.set('jira', localCred);

      mockListRemote.mockResolvedValue([
        { providerId: 'jira', updatedAt: '2026-04-02T00:00:00Z', filename: 'jira.json' },
      ]);

      const result = await engine.push();

      expect(result.skipped).toEqual(['jira']);
      expect(result.pushed).toEqual([]);
      expect(mockWriteRemote).not.toHaveBeenCalled();
    });

    it('overwrites newer remote when force is true', async () => {
      const localCred = makeCredential('jira', '2026-04-01T00:00:00Z');
      await storage.set('jira', localCred);

      mockListRemote.mockResolvedValue([
        { providerId: 'jira', updatedAt: '2026-04-02T00:00:00Z', filename: 'jira.json' },
      ]);
      mockWriteRemote.mockResolvedValue(undefined);

      const result = await engine.push(undefined, true);

      expect(result.pushed).toEqual(['jira']);
      expect(result.skipped).toEqual([]);
      expect(mockWriteRemote).toHaveBeenCalledTimes(1);
    });

    it('filters by specific provider IDs', async () => {
      await storage.set('jira', makeCredential('jira', '2026-04-01T00:00:00Z'));
      await storage.set('github', makeCredential('github', '2026-04-01T00:00:00Z'));
      mockListRemote.mockResolvedValue([]);
      mockWriteRemote.mockResolvedValue(undefined);

      const result = await engine.push(['jira']);

      expect(result.pushed).toEqual(['jira']);
      expect(mockWriteRemote).toHaveBeenCalledTimes(1);
    });

    it('pushes local when local is newer than remote', async () => {
      const localCred = makeCredential('jira', '2026-04-02T00:00:00Z');
      await storage.set('jira', localCred);

      mockListRemote.mockResolvedValue([
        { providerId: 'jira', updatedAt: '2026-04-01T00:00:00Z', filename: 'jira.json' },
      ]);
      mockWriteRemote.mockResolvedValue(undefined);

      const result = await engine.push();

      expect(result.pushed).toEqual(['jira']);
      expect(result.skipped).toEqual([]);
    });

    it('records error when writeRemote throws', async () => {
      await storage.set('jira', makeCredential('jira', '2026-04-01T00:00:00Z'));
      mockListRemote.mockResolvedValue([]);
      mockWriteRemote.mockRejectedValue(new Error('SSH connection refused'));

      const result = await engine.push();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].providerId).toBe('jira');
      expect(result.errors[0].error).toBe('SSH connection refused');
    });

    it('pushes multiple providers', async () => {
      await storage.set('jira', makeCredential('jira', '2026-04-01T00:00:00Z'));
      await storage.set('github', makeCredential('github', '2026-04-01T00:00:00Z'));
      mockListRemote.mockResolvedValue([]);
      mockWriteRemote.mockResolvedValue(undefined);

      const result = await engine.push();

      expect(result.pushed).toHaveLength(2);
      expect(result.pushed).toContain('jira');
      expect(result.pushed).toContain('github');
    });
  });

  describe('pull', () => {
    it('returns empty result when remote has no credentials', async () => {
      mockListRemote.mockResolvedValue([]);

      const result = await engine.pull();

      expect(result.pulled).toEqual([]);
      expect(result.pushed).toEqual([]);
      expect(result.skipped).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('pulls single provider from remote and stores locally', async () => {
      const remoteCred = makeCredential('jira', '2026-04-01T00:00:00Z');
      mockListRemote.mockResolvedValue([
        { providerId: 'jira', updatedAt: '2026-04-01T00:00:00Z', filename: 'jira.json' },
      ]);
      mockReadRemote.mockResolvedValue(remoteCred);

      const result = await engine.pull();

      expect(result.pulled).toEqual(['jira']);
      const stored = await storage.get('jira');
      expect(stored).toEqual(remoteCred);
    });

    it('skips provider when local is newer (conflict detection)', async () => {
      const localCred = makeCredential('jira', '2026-04-02T00:00:00Z');
      await storage.set('jira', localCred);

      mockListRemote.mockResolvedValue([
        { providerId: 'jira', updatedAt: '2026-04-01T00:00:00Z', filename: 'jira.json' },
      ]);

      const result = await engine.pull();

      expect(result.skipped).toEqual(['jira']);
      expect(result.pulled).toEqual([]);
      // Local credential should remain unchanged
      const stored = await storage.get('jira');
      expect(stored).toEqual(localCred);
    });

    it('overwrites newer local when force is true', async () => {
      const localCred = makeCredential('jira', '2026-04-02T00:00:00Z');
      await storage.set('jira', localCred);

      const remoteCred = makeCredential('jira', '2026-04-01T00:00:00Z');
      mockListRemote.mockResolvedValue([
        { providerId: 'jira', updatedAt: '2026-04-01T00:00:00Z', filename: 'jira.json' },
      ]);
      mockReadRemote.mockResolvedValue(remoteCred);

      const result = await engine.pull(undefined, true);

      expect(result.pulled).toEqual(['jira']);
      expect(result.skipped).toEqual([]);
      const stored = await storage.get('jira');
      expect(stored).toEqual(remoteCred);
    });

    it('filters by specific provider IDs', async () => {
      mockListRemote.mockResolvedValue([
        { providerId: 'jira', updatedAt: '2026-04-01T00:00:00Z', filename: 'jira.json' },
        { providerId: 'github', updatedAt: '2026-04-01T00:00:00Z', filename: 'github.json' },
      ]);
      const jiraCred = makeCredential('jira', '2026-04-01T00:00:00Z');
      mockReadRemote.mockResolvedValue(jiraCred);

      const result = await engine.pull(['jira']);

      expect(result.pulled).toEqual(['jira']);
      expect(mockReadRemote).toHaveBeenCalledTimes(1);
    });

    it('records error when readRemote returns null', async () => {
      mockListRemote.mockResolvedValue([
        { providerId: 'jira', updatedAt: '2026-04-01T00:00:00Z', filename: 'jira.json' },
      ]);
      mockReadRemote.mockResolvedValue(null);

      const result = await engine.pull();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].providerId).toBe('jira');
      expect(result.errors[0].error).toBe('Failed to read from remote');
    });

    it('records error when readRemote throws', async () => {
      mockListRemote.mockResolvedValue([
        { providerId: 'jira', updatedAt: '2026-04-01T00:00:00Z', filename: 'jira.json' },
      ]);
      mockReadRemote.mockRejectedValue(new Error('Network timeout'));

      const result = await engine.pull();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].providerId).toBe('jira');
      expect(result.errors[0].error).toBe('Network timeout');
    });

    it('pulls when no local credential exists (no conflict)', async () => {
      const remoteCred = makeCredential('new-provider', '2026-04-01T00:00:00Z');
      mockListRemote.mockResolvedValue([
        { providerId: 'new-provider', updatedAt: '2026-04-01T00:00:00Z', filename: 'new-provider.json' },
      ]);
      mockReadRemote.mockResolvedValue(remoteCred);

      const result = await engine.pull();

      expect(result.pulled).toEqual(['new-provider']);
      const stored = await storage.get('new-provider');
      expect(stored).toEqual(remoteCred);
    });
  });
});
