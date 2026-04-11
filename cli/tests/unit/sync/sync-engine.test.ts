import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncEngine } from '../../../src/sync/sync-engine.js';
import { MemoryStorage } from '../../../src/storage/memory-storage.js';
import type { StoredCredential } from '../../../src/core/types.js';
import type { RemoteConfig } from '../../../src/sync/types.js';
import type { SignetConfig } from '../../../src/config/schema.js';
import type { ISyncTransport } from '../../../src/sync/interfaces/transport.js';

// Mock transport
const mockListRemote = vi.fn();
const mockReadRemote = vi.fn();
const mockWriteRemote = vi.fn();
const mockReadRemoteConfig = vi.fn();
const mockWriteRemoteConfig = vi.fn();

function createMockTransport(): ISyncTransport {
  return {
    listRemote: mockListRemote,
    readRemote: mockReadRemote,
    writeRemote: mockWriteRemote,
    readRemoteConfig: mockReadRemoteConfig,
    writeRemoteConfig: mockWriteRemoteConfig,
  };
}

// Mock fs for config pull (local config read/write)
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
  },
}));

// Mock getConfigPath
vi.mock('../../../src/config/loader.js', () => ({
  getConfigPath: () => '/home/testuser/.signet/config.yaml',
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

const testConfig: SignetConfig = {
  browser: {
    browserDataDir: '~/.signet/browser-data',
    channel: 'chrome',
    headlessTimeout: 30000,
    visibleTimeout: 120000,
    waitUntil: 'load',
  },
  storage: {
    credentialsDir: '~/.signet/credentials',
  },
  providers: {
    jira: {
      domains: ['jira.example.com'],
      strategy: 'cookie',
      config: { ttl: '12h' },
    },
    github: {
      domains: ['github.com', 'api.github.com'],
      strategy: 'api-token',
      config: { headerName: 'Authorization', headerPrefix: 'Bearer' },
    },
  },
};

const remoteConfigYaml = `# Signet config
browser:
  browserDataDir: ~/.signet/browser-data
  channel: chrome
  headlessTimeout: 30000
  visibleTimeout: 120000
  waitUntil: load
storage:
  credentialsDir: ~/.signet/credentials
providers:
  existing-remote:
    domains:
      - remote.example.com
    strategy: cookie
`;

const localConfigYaml = `# Signet config
browser:
  browserDataDir: ~/.signet/browser-data
  channel: chrome
  headlessTimeout: 30000
  visibleTimeout: 120000
  waitUntil: load
storage:
  credentialsDir: ~/.signet/credentials
providers:
  local-only:
    domains:
      - local.example.com
    strategy: cookie
`;

describe('SyncEngine', () => {
  let storage: MemoryStorage;
  let engine: SyncEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new MemoryStorage();
    engine = new SyncEngine(storage, testRemote, testConfig, createMockTransport());
    // Default: config methods return null (no remote config)
    mockReadRemoteConfig.mockResolvedValue(null);
    mockWriteRemoteConfig.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(localConfigYaml);
    mockWriteFile.mockResolvedValue(undefined);
  });

  describe('push', () => {
    it('returns empty result when no local credentials exist', async () => {
      mockListRemote.mockResolvedValue([]);

      const result = await engine.push();

      expect(result.pushed).toEqual([]);
      expect(result.pulled).toEqual([]);
      expect(result.skipped).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.configSynced).toBeDefined();
    });

    it('pushes single provider to empty remote', async () => {
      const cred = makeCredential('jira', '2026-04-01T00:00:00Z');
      await storage.set('jira', cred);
      mockListRemote.mockResolvedValue([]);
      mockWriteRemote.mockResolvedValue(undefined);
      mockReadRemoteConfig.mockResolvedValue(remoteConfigYaml);

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
      mockReadRemoteConfig.mockResolvedValue(remoteConfigYaml);

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
      mockReadRemoteConfig.mockResolvedValue(remoteConfigYaml);

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
      mockReadRemoteConfig.mockResolvedValue(remoteConfigYaml);

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
      mockReadRemoteConfig.mockResolvedValue(remoteConfigYaml);

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
      expect(result.configSynced).toBeDefined();
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

  describe('config sync - push', () => {
    it('syncs provider definitions to remote config', async () => {
      const cred = makeCredential('jira', '2026-04-01T00:00:00Z');
      await storage.set('jira', cred);
      mockListRemote.mockResolvedValue([]);
      mockWriteRemote.mockResolvedValue(undefined);
      mockReadRemoteConfig.mockResolvedValue(remoteConfigYaml);

      const result = await engine.push();

      expect(result.configSynced.providers).toContain('jira');
      expect(result.configSynced.providers).toContain('github');
      expect(mockWriteRemoteConfig).toHaveBeenCalledTimes(1);

      // Verify the written YAML contains both local and remote providers
      const writtenYaml = mockWriteRemoteConfig.mock.calls[0][1];
      expect(writtenYaml).toContain('jira');
      expect(writtenYaml).toContain('github');
      expect(writtenYaml).toContain('existing-remote');
    });

    it('creates config on remote when none exists', async () => {
      const cred = makeCredential('jira', '2026-04-01T00:00:00Z');
      await storage.set('jira', cred);
      mockListRemote.mockResolvedValue([]);
      mockWriteRemote.mockResolvedValue(undefined);
      mockReadRemoteConfig.mockResolvedValue(null);

      const result = await engine.push();

      expect(result.configSynced.providers).toContain('jira');
      expect(result.configSynced.providers).toContain('github');
      expect(result.configSynced.error).toBeUndefined();
      expect(mockWriteRemoteConfig).toHaveBeenCalledTimes(1);
      const writtenYaml = mockWriteRemoteConfig.mock.calls[0][1];
      expect(writtenYaml).toContain('jira');
      expect(writtenYaml).toContain('github');
    });

    it('applies provider filter to config sync on push', async () => {
      await storage.set('jira', makeCredential('jira', '2026-04-01T00:00:00Z'));
      mockListRemote.mockResolvedValue([]);
      mockWriteRemote.mockResolvedValue(undefined);
      mockReadRemoteConfig.mockResolvedValue(remoteConfigYaml);

      const result = await engine.push(['jira']);

      expect(result.configSynced.providers).toEqual(['jira']);
      expect(result.configSynced.providers).not.toContain('github');
    });

    it('merges local and remote providers (local wins on push)', async () => {
      // Remote has existing-remote, local has jira + github
      const cred = makeCredential('jira', '2026-04-01T00:00:00Z');
      await storage.set('jira', cred);
      mockListRemote.mockResolvedValue([]);
      mockWriteRemote.mockResolvedValue(undefined);
      mockReadRemoteConfig.mockResolvedValue(remoteConfigYaml);

      const result = await engine.push();

      expect(mockWriteRemoteConfig).toHaveBeenCalledTimes(1);
      const writtenYaml = mockWriteRemoteConfig.mock.calls[0][1];
      // All three providers should be in the merged result
      expect(writtenYaml).toContain('existing-remote');
      expect(writtenYaml).toContain('jira');
      expect(writtenYaml).toContain('github');
      expect(result.configSynced.error).toBeUndefined();
    });
  });

  describe('config sync - pull', () => {
    it('merges remote providers into local config', async () => {
      const remoteCred = makeCredential('jira', '2026-04-01T00:00:00Z');
      mockListRemote.mockResolvedValue([
        { providerId: 'jira', updatedAt: '2026-04-01T00:00:00Z', filename: 'jira.json' },
      ]);
      mockReadRemote.mockResolvedValue(remoteCred);
      mockReadRemoteConfig.mockResolvedValue(remoteConfigYaml);

      const result = await engine.pull();

      expect(result.configSynced.providers).toContain('existing-remote');
      expect(mockWriteFile).toHaveBeenCalledTimes(1);

      // Verify written YAML contains both local and remote providers
      const writtenYaml = mockWriteFile.mock.calls[0][1];
      expect(writtenYaml).toContain('local-only');
      expect(writtenYaml).toContain('existing-remote');
    });

    it('returns warning when remote has no config.yaml', async () => {
      mockListRemote.mockResolvedValue([]);
      mockReadRemoteConfig.mockResolvedValue(null);

      const result = await engine.pull();

      expect(result.configSynced.providers).toEqual([]);
      expect(result.configSynced.error).toContain('no config.yaml');
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('applies provider filter to config sync on pull', async () => {
      mockListRemote.mockResolvedValue([
        { providerId: 'jira', updatedAt: '2026-04-01T00:00:00Z', filename: 'jira.json' },
      ]);
      const jiraCred = makeCredential('jira', '2026-04-01T00:00:00Z');
      mockReadRemote.mockResolvedValue(jiraCred);

      // Remote config has existing-remote provider
      mockReadRemoteConfig.mockResolvedValue(remoteConfigYaml);

      // Pull only jira — existing-remote should not be synced since it's not in filter
      const result = await engine.pull(['jira']);

      // existing-remote is in the remote config but not in the filter
      // jira is in the filter but not in the remote config YAML
      // So nothing should be pulled for config
      expect(result.configSynced.providers).toEqual([]);
    });

    it('pulls remote providers when no filter specified', async () => {
      mockListRemote.mockResolvedValue([]);
      mockReadRemoteConfig.mockResolvedValue(remoteConfigYaml);

      const result = await engine.pull();

      expect(result.configSynced.providers).toContain('existing-remote');
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
    });
  });
});
