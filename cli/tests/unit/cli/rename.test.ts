import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthManager } from '../../../src/auth-manager.js';
import { MemoryStorage } from '../../../src/storage/memory-storage.js';
import { ProviderRegistry } from '../../../src/providers/provider-registry.js';
import { StrategyRegistry } from '../../../src/strategies/registry.js';
import { CookieStrategyFactory } from '../../../src/strategies/cookie.strategy.js';
import { runRename } from '../../../src/cli/commands/rename.js';
import type { AuthDeps } from '../../../src/deps.js';
import type { ProviderConfig, StoredCredential } from '../../../src/core/types.js';
import type { IBrowserAdapter } from '../../../src/core/interfaces/browser-adapter.js';
import type { BrowserConfig, SignetConfig } from '../../../src/config/schema.js';

const browserConfig: BrowserConfig = {
  browserDataDir: '/tmp/test-browser-data',
  channel: 'chrome',
  headlessTimeout: 30_000,
  visibleTimeout: 120_000,
  waitUntil: 'load',
};

const testProvider: ProviderConfig = {
  id: 'old-provider',
  name: 'old-provider',
  domains: ['old.example.com'],
  entryUrl: 'https://old.example.com/',
  strategy: 'cookie',
  strategyConfig: { strategy: 'cookie' },
};

function createDeps(providers?: ProviderConfig[]): { deps: AuthDeps; storage: MemoryStorage; providerRegistry: ProviderRegistry } {
  const storage = new MemoryStorage();
  const strategyRegistry = new StrategyRegistry();
  strategyRegistry.register(new CookieStrategyFactory());

  const providerRegistry = new ProviderRegistry(providers ?? [testProvider]);

  const authManager = new AuthManager({
    storage,
    strategyRegistry,
    providerRegistry,
    browserAdapterFactory: () => ({} as IBrowserAdapter),
    browserConfig,
  });

  const config: SignetConfig = {
    browser: browserConfig,
    storage: { credentialsDir: '/tmp/test-credentials' },
    providers: {},
  };

  const deps: AuthDeps = {
    authManager,
    storage,
    providerRegistry,
    strategyRegistry,
    config,
    browserAvailable: true,
  };

  return { deps, storage, providerRegistry };
}

describe('runRename', () => {
  let stderrChunks: string[];
  let originalExitCode: number | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    stderrChunks = [];
    originalExitCode = process.exitCode;
    process.exitCode = undefined;

    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stderrChunks.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
  });

  it('renames a provider in registry and storage', async () => {
    const { deps, storage, providerRegistry } = createDeps();

    // Pre-store a credential
    const stored: StoredCredential = {
      credential: { type: 'cookie', cookies: [], obtainedAt: new Date().toISOString() },
      providerId: 'old-provider',
      strategy: 'cookie',
      updatedAt: new Date().toISOString(),
    };
    await storage.set('old-provider', stored);

    await runRename(['old-provider', 'new-provider'], {}, deps);

    expect(process.exitCode).not.toBe(1);

    // Registry updated
    expect(providerRegistry.get('old-provider')).toBeNull();
    expect(providerRegistry.get('new-provider')).not.toBeNull();
    expect(providerRegistry.get('new-provider')!.domains).toEqual(['old.example.com']);

    // Storage moved
    expect(await storage.get('old-provider')).toBeNull();
    const newStored = await storage.get('new-provider');
    expect(newStored).not.toBeNull();
    expect(newStored!.providerId).toBe('new-provider');

    // Confirmation message
    const stderr = stderrChunks.join('');
    expect(stderr).toContain('Renamed');
    expect(stderr).toContain('old-provider');
    expect(stderr).toContain('new-provider');
  });

  it('updates provider name when it matches old ID', async () => {
    const { deps, providerRegistry } = createDeps();

    await runRename(['old-provider', 'new-provider'], {}, deps);

    const provider = providerRegistry.get('new-provider');
    expect(provider!.name).toBe('new-provider');
  });

  it('preserves provider name when it differs from old ID', async () => {
    const namedProvider: ProviderConfig = {
      id: 'my-id',
      name: 'My Display Name',
      domains: ['site.example.com'],
      strategy: 'cookie',
      strategyConfig: { strategy: 'cookie' },
    };
    const { deps, providerRegistry } = createDeps([namedProvider]);

    await runRename(['my-id', 'new-id'], {}, deps);

    const provider = providerRegistry.get('new-id');
    expect(provider!.name).toBe('My Display Name');
  });

  it('errors when old provider not found', async () => {
    const { deps } = createDeps();

    await runRename(['nonexistent', 'new-id'], {}, deps);

    expect(process.exitCode).toBe(1);
    const stderr = stderrChunks.join('');
    expect(stderr).toContain('No provider found');
  });

  it('errors when new ID already exists', async () => {
    const other: ProviderConfig = {
      id: 'taken-id',
      name: 'Taken',
      domains: ['taken.example.com'],
      strategy: 'cookie',
      strategyConfig: { strategy: 'cookie' },
    };
    const { deps } = createDeps([testProvider, other]);

    await runRename(['old-provider', 'taken-id'], {}, deps);

    expect(process.exitCode).toBe(1);
    const stderr = stderrChunks.join('');
    expect(stderr).toContain('already exists');
  });

  it('errors when missing positional args', async () => {
    const { deps } = createDeps();

    await runRename([], {}, deps);

    expect(process.exitCode).toBe(1);
    const stderr = stderrChunks.join('');
    expect(stderr).toContain('Usage');
  });

  it('errors when only old ID provided', async () => {
    const { deps } = createDeps();

    await runRename(['old-provider'], {}, deps);

    expect(process.exitCode).toBe(1);
  });

  it('works when no credential exists (config-only rename)', async () => {
    const { deps, providerRegistry } = createDeps();

    await runRename(['old-provider', 'new-provider'], {}, deps);

    expect(process.exitCode).not.toBe(1);
    expect(providerRegistry.get('new-provider')).not.toBeNull();
    expect(providerRegistry.get('old-provider')).toBeNull();
  });

  it('resolves old provider by name (case-insensitive)', async () => {
    const namedProvider: ProviderConfig = {
      id: 'some-id',
      name: 'My Jira',
      domains: ['jira.example.com'],
      strategy: 'cookie',
      strategyConfig: { strategy: 'cookie' },
    };
    const { deps, providerRegistry } = createDeps([namedProvider]);

    await runRename(['my jira', 'jira'], {}, deps);

    expect(process.exitCode).not.toBe(1);
    expect(providerRegistry.get('jira')).not.toBeNull();
    expect(providerRegistry.get('some-id')).toBeNull();
  });
});
