import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthManager } from '../../../src/auth-manager.js';
import { MemoryStorage } from '../../../src/storage/memory-storage.js';
import { ProviderRegistry } from '../../../src/providers/provider-registry.js';
import { StrategyRegistry } from '../../../src/strategies/registry.js';
import { CookieStrategyFactory } from '../../../src/strategies/cookie.strategy.js';
import { ApiTokenStrategyFactory } from '../../../src/strategies/api-token.strategy.js';
import { runRemove } from '../../../src/cli/commands/remove.js';
import type { AuthDeps } from '../../../src/deps.js';
import type { ProviderConfig, StoredCredential } from '../../../src/core/types.js';
import type { IBrowserAdapter } from '../../../src/core/interfaces/browser-adapter.js';
import type { BrowserConfig, SignetConfig } from '../../../src/config/schema.js';

// Mock removeProviderFromConfig since it touches the filesystem
vi.mock('../../../src/config/loader.js', () => ({
  removeProviderFromConfig: vi.fn(async () => {}),
  loadConfig: vi.fn(),
  getConfigPath: vi.fn(() => '/tmp/test-config.yaml'),
  saveConfig: vi.fn(),
  addProviderToConfig: vi.fn(),
}));

import { removeProviderFromConfig } from '../../../src/config/loader.js';

const browserConfig: BrowserConfig = {
  browserDataDir: '/tmp/test-browser-data',
  channel: 'chrome',
  headlessTimeout: 30_000,
  visibleTimeout: 120_000,
  waitUntil: 'load',
};

const providerJira: ProviderConfig = {
  id: 'jira',
  name: 'Jira',
  domains: ['jira.example.com'],
  entryUrl: 'https://jira.example.com/',
  strategy: 'cookie',
  strategyConfig: { strategy: 'cookie' },
};

const providerConfluence: ProviderConfig = {
  id: 'confluence',
  name: 'Confluence',
  domains: ['confluence.example.com'],
  entryUrl: 'https://confluence.example.com/',
  strategy: 'cookie',
  strategyConfig: { strategy: 'cookie' },
};

const providerGithub: ProviderConfig = {
  id: 'github',
  name: 'GitHub',
  domains: ['github.com'],
  entryUrl: 'https://github.com/',
  strategy: 'api-token',
  strategyConfig: { strategy: 'api-token' },
};

const mockCredential: StoredCredential = {
  credential: {
    type: 'cookie',
    cookies: [{ name: 'sid', value: 'abc123', domain: '.example.com', path: '/', expires: -1, httpOnly: true, secure: true }],
    obtainedAt: new Date().toISOString(),
  },
  providerId: 'jira',
  strategy: 'cookie',
  updatedAt: new Date().toISOString(),
};

function createDeps(providers?: ProviderConfig[]): { deps: AuthDeps; storage: MemoryStorage; providerRegistry: ProviderRegistry } {
  const storage = new MemoryStorage();
  const strategyRegistry = new StrategyRegistry();
  strategyRegistry.register(new CookieStrategyFactory());
  strategyRegistry.register(new ApiTokenStrategyFactory());

  const providerRegistry = new ProviderRegistry(providers ?? [providerJira, providerConfluence, providerGithub]);

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

describe('runRemove (#11)', () => {
  let stderrChunks: string[];
  let stdoutChunks: string[];
  let originalExitCode: number | undefined;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    stderrChunks = [];
    stdoutChunks = [];
    originalExitCode = process.exitCode;
    originalIsTTY = process.stdin.isTTY;
    process.exitCode = undefined;

    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stderrChunks.push(String(chunk));
      return true;
    });

    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stdoutChunks.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true, configurable: true });
    vi.restoreAllMocks();
  });

  // ---- Usage when no args ----

  it('prints usage and exits with code 1 when no positionals provided', async () => {
    const { deps } = createDeps();

    await runRemove([], {}, deps);

    expect(process.exitCode).toBe(1);
    const stderr = stderrChunks.join('');
    expect(stderr).toContain('Usage:');
    expect(stderr).toContain('sig remove');
  });

  // ---- Single provider removal with --force ----

  it('removes a single provider credential and config with --force', async () => {
    const { deps, storage, providerRegistry } = createDeps();

    // Pre-populate credential
    await storage.set('jira', { ...mockCredential, providerId: 'jira' });

    await runRemove(['jira'], { force: true }, deps);

    expect(process.exitCode).not.toBe(1);

    // Credential should be deleted
    const stored = await storage.get('jira');
    expect(stored).toBeNull();

    // Provider should be unregistered
    expect(providerRegistry.get('jira')).toBeNull();

    // Config should be updated
    expect(removeProviderFromConfig).toHaveBeenCalledWith('jira');

    // Summary message
    const stderr = stderrChunks.join('');
    expect(stderr).toContain('Removed 1 provider(s)');
  });

  // ---- Multiple providers with --force ----

  it('removes multiple providers with --force', async () => {
    const { deps, storage, providerRegistry } = createDeps();

    await storage.set('jira', { ...mockCredential, providerId: 'jira' });
    await storage.set('confluence', { ...mockCredential, providerId: 'confluence' });

    await runRemove(['jira', 'confluence'], { force: true }, deps);

    expect(process.exitCode).not.toBe(1);

    expect(await storage.get('jira')).toBeNull();
    expect(await storage.get('confluence')).toBeNull();
    expect(providerRegistry.get('jira')).toBeNull();
    expect(providerRegistry.get('confluence')).toBeNull();
    expect(removeProviderFromConfig).toHaveBeenCalledTimes(2);

    const stderr = stderrChunks.join('');
    expect(stderr).toContain('Removed 2 provider(s)');
  });

  // ---- --keep-config removes credential but keeps config ----

  it('--keep-config removes credential but does not call removeProviderFromConfig', async () => {
    const { deps, storage } = createDeps();

    await storage.set('jira', { ...mockCredential, providerId: 'jira' });

    await runRemove(['jira'], { force: true, 'keep-config': true }, deps);

    expect(process.exitCode).not.toBe(1);

    // Credential deleted
    expect(await storage.get('jira')).toBeNull();

    // Config NOT removed
    expect(removeProviderFromConfig).not.toHaveBeenCalled();
  });

  // ---- Unknown provider errors ----

  it('errors on unknown provider', async () => {
    const { deps } = createDeps();

    await runRemove(['nonexistent'], { force: true }, deps);

    expect(process.exitCode).toBe(1);
    const stderr = stderrChunks.join('');
    expect(stderr).toContain('Unknown provider(s)');
    expect(stderr).toContain('nonexistent');
  });

  it('errors when one of multiple providers is unknown', async () => {
    const { deps } = createDeps();

    await runRemove(['jira', 'unknown-provider'], { force: true }, deps);

    expect(process.exitCode).toBe(1);
    const stderr = stderrChunks.join('');
    expect(stderr).toContain('Unknown provider(s)');
    expect(stderr).toContain('unknown-provider');

    // None should be removed (early exit on unknown)
    expect(removeProviderFromConfig).not.toHaveBeenCalled();
  });

  // ---- Non-TTY without --force ----

  it('requires --force on non-TTY without it', async () => {
    const { deps } = createDeps();

    // Simulate non-TTY
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true, configurable: true });

    await runRemove(['jira'], {}, deps);

    expect(process.exitCode).toBe(1);
    const stderr = stderrChunks.join('');
    expect(stderr).toContain('--force');
    expect(stderr).toContain('Cannot confirm interactively');
  });

  // ---- Provider resolved by name (case-insensitive) ----

  it('resolves provider by name (case-insensitive)', async () => {
    const { deps, storage } = createDeps();

    await storage.set('jira', { ...mockCredential, providerId: 'jira' });

    await runRemove(['Jira'], { force: true }, deps);

    expect(process.exitCode).not.toBe(1);
    expect(await storage.get('jira')).toBeNull();
  });

  // ---- Provider resolved by URL/domain ----

  it('resolves provider by domain', async () => {
    const { deps, storage } = createDeps();

    await storage.set('github', { ...mockCredential, providerId: 'github' });

    await runRemove(['https://github.com/'], { force: true }, deps);

    expect(process.exitCode).not.toBe(1);
    expect(await storage.get('github')).toBeNull();
  });

  // ---- Summary message correctness ----

  it('summary message shows correct count for 3 providers', async () => {
    const { deps, storage } = createDeps();

    await storage.set('jira', { ...mockCredential, providerId: 'jira' });
    await storage.set('confluence', { ...mockCredential, providerId: 'confluence' });
    await storage.set('github', { ...mockCredential, providerId: 'github' });

    await runRemove(['jira', 'confluence', 'github'], { force: true }, deps);

    const stderr = stderrChunks.join('');
    expect(stderr).toContain('Removed 3 provider(s)');
  });

  // ---- Removing a provider that has no stored credential still works ----

  it('removes provider from registry and config even when no credential is stored', async () => {
    const { deps, providerRegistry } = createDeps();

    // No credential stored, but provider is registered
    expect(providerRegistry.get('jira')).not.toBeNull();

    await runRemove(['jira'], { force: true }, deps);

    expect(process.exitCode).not.toBe(1);
    expect(providerRegistry.get('jira')).toBeNull();
    expect(removeProviderFromConfig).toHaveBeenCalledWith('jira');
  });
});
