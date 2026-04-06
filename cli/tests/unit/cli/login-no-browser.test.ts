import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthManager } from '../../../src/auth-manager.js';
import { MemoryStorage } from '../../../src/storage/memory-storage.js';
import { ProviderRegistry } from '../../../src/providers/provider-registry.js';
import { StrategyRegistry } from '../../../src/strategies/registry.js';
import { CookieStrategyFactory } from '../../../src/strategies/cookie.strategy.js';
import { OAuth2StrategyFactory } from '../../../src/strategies/oauth2.strategy.js';
import { ApiTokenStrategyFactory } from '../../../src/strategies/api-token.strategy.js';
import { BasicAuthStrategyFactory } from '../../../src/strategies/basic-auth.strategy.js';
import { runLogin } from '../../../src/cli/commands/login.js';
import type { AuthDeps } from '../../../src/deps.js';
import type { ProviderConfig } from '../../../src/core/types.js';
import type { IBrowserAdapter } from '../../../src/core/interfaces/browser-adapter.js';
import type { BrowserConfig, SignetConfig } from '../../../src/config/schema.js';

const browserConfig: BrowserConfig = {
  browserDataDir: '/tmp/test-browser-data',
  channel: 'chrome',
  headlessTimeout: 30_000,
  visibleTimeout: 120_000,
  waitUntil: 'load',
};

const cookieProvider: ProviderConfig = {
  id: 'example',
  name: 'Example',
  domains: ['example.com'],
  entryUrl: 'https://example.com/',
  strategy: 'cookie',
  strategyConfig: { strategy: 'cookie' },
};

const oauth2Provider: ProviderConfig = {
  id: 'oauth-app',
  name: 'OAuth App',
  domains: ['oauth-app.example.com'],
  entryUrl: 'https://oauth-app.example.com/',
  strategy: 'oauth2',
  strategyConfig: { strategy: 'oauth2' },
};

const apiTokenProvider: ProviderConfig = {
  id: 'api-app',
  name: 'API App',
  domains: ['api.example.com'],
  strategy: 'api-token',
  strategyConfig: { strategy: 'api-token', headerName: 'Authorization', headerPrefix: 'Bearer' },
};

function createDeps(overrides?: { browserAvailable?: boolean; providers?: ProviderConfig[] }): AuthDeps {
  const storage = new MemoryStorage();
  const strategyRegistry = new StrategyRegistry();
  strategyRegistry.register(new CookieStrategyFactory());
  strategyRegistry.register(new OAuth2StrategyFactory());
  strategyRegistry.register(new ApiTokenStrategyFactory());
  strategyRegistry.register(new BasicAuthStrategyFactory());

  const providers = overrides?.providers ?? [cookieProvider, oauth2Provider, apiTokenProvider];
  const providerRegistry = new ProviderRegistry(providers);

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

  return {
    authManager,
    storage,
    providerRegistry,
    strategyRegistry,
    config,
    browserAvailable: overrides?.browserAvailable ?? true,
  };
}

describe('runLogin — browser-less degradation', () => {
  let stderrChunks: string[];
  let stdoutChunks: string[];
  let originalExitCode: number | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    stderrChunks = [];
    stdoutChunks = [];
    originalExitCode = process.exitCode;
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
    vi.restoreAllMocks();
  });

  // ---- cookie strategy with no browser ----

  it('exits with code 1 when browserAvailable=false and provider uses cookie strategy', async () => {
    const deps = createDeps({ browserAvailable: false });

    await runLogin(['https://example.com/'], {}, deps);

    expect(process.exitCode).toBe(1);
    const stderr = stderrChunks.join('');
    expect(stderr).toContain('Browser is not available');
    expect(stderr).toContain('cookie');
    expect(stderr).toContain('--cookie');
    expect(stderr).toContain('--token');
    expect(stderr).toContain('sig sync pull');
  });

  // ---- oauth2 strategy with no browser ----

  it('exits with code 1 when browserAvailable=false and provider uses oauth2 strategy', async () => {
    const deps = createDeps({ browserAvailable: false });

    await runLogin(['https://oauth-app.example.com/'], {}, deps);

    expect(process.exitCode).toBe(1);
    const stderr = stderrChunks.join('');
    expect(stderr).toContain('Browser is not available');
    expect(stderr).toContain('oauth2');
  });

  // ---- --token bypasses browser check ----

  it('succeeds with --token even when browserAvailable=false', async () => {
    const deps = createDeps({ browserAvailable: false });

    await runLogin(['https://example.com/'], { token: 'my-secret-token' }, deps);

    // Should NOT exit with code 1
    expect(process.exitCode).not.toBe(1);
    const stderr = stderrChunks.join('');
    expect(stderr).toContain('Token stored');
    expect(stderr).not.toContain('Browser is not available');
  });

  // ---- --cookie bypasses browser check ----

  it('succeeds with --cookie even when browserAvailable=false', async () => {
    const deps = createDeps({ browserAvailable: false });

    await runLogin(['https://example.com/'], { cookie: 'session=abc123' }, deps);

    // Should NOT exit with code 1
    expect(process.exitCode).not.toBe(1);
    const stderr = stderrChunks.join('');
    expect(stderr).toContain('Cookie stored');
    expect(stderr).not.toContain('Browser is not available');
  });

  // ---- api-token strategy does not trigger browser warning ----

  it('does not show browser warning for api-token strategy (non-browser strategy)', async () => {
    const deps = createDeps({ browserAvailable: false });

    // api-token strategy triggers ManualSetupRequired, not browser-unavailable
    await runLogin(['https://api.example.com/'], { token: 'my-token' }, deps);

    const stderr = stderrChunks.join('');
    expect(stderr).not.toContain('Browser is not available');
  });

  // ---- guidance message mentions all alternatives ----

  it('guidance message mentions cookie flag, token flag, and sync pull', async () => {
    const deps = createDeps({ browserAvailable: false });

    await runLogin(['https://example.com/'], {}, deps);

    const stderr = stderrChunks.join('');
    expect(stderr).toContain('sig login <url> --cookie');
    expect(stderr).toContain('sig login <url> --token');
    expect(stderr).toContain('sig sync pull');
    expect(stderr).toContain('sig remote add');
    expect(stderr).toContain('sig sync push');
  });
});
