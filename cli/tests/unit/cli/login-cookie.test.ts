import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthManager } from '../../../src/auth-manager.js';
import { MemoryStorage } from '../../../src/storage/memory-storage.js';
import { ProviderRegistry } from '../../../src/providers/provider-registry.js';
import { StrategyRegistry } from '../../../src/strategies/registry.js';
import { CookieStrategyFactory } from '../../../src/strategies/cookie.strategy.js';
import { ApiTokenStrategyFactory } from '../../../src/strategies/api-token.strategy.js';
import { runLogin } from '../../../src/cli/commands/login.js';
import type { AuthDeps } from '../../../src/deps.js';
import type { ProviderConfig, CookieCredential } from '../../../src/core/types.js';
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
  id: 'test-site',
  name: 'Test Site',
  domains: ['test-site.example.com'],
  entryUrl: 'https://test-site.example.com/',
  strategy: 'cookie',
  strategyConfig: { strategy: 'cookie' },
};

function createDeps(providers?: ProviderConfig[]): { deps: AuthDeps; storage: MemoryStorage } {
  const storage = new MemoryStorage();
  const strategyRegistry = new StrategyRegistry();
  strategyRegistry.register(new CookieStrategyFactory());
  strategyRegistry.register(new ApiTokenStrategyFactory());

  const providerRegistry = new ProviderRegistry(providers ?? [testProvider]);

  const authManager = new AuthManager({
    storage,
    strategyRegistry,
    providerRegistry,
    browserAdapterFactory: () => ({}) as IBrowserAdapter,
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

  return { deps, storage };
}

describe('runLogin --cookie flag', () => {
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

  // ---- single cookie parsing ----

  it('parses "name=value" into a single cookie with correct domain from URL', async () => {
    const { deps, storage } = createDeps();

    await runLogin(['https://test-site.example.com/page'], { cookie: 'session=abc123' }, deps);

    expect(process.exitCode).not.toBe(1);

    // Verify credential was stored
    const stored = await storage.get('test-site');
    expect(stored).not.toBeNull();
    expect(stored!.credential.type).toBe('cookie');

    const cred = stored!.credential as CookieCredential;
    expect(cred.cookies).toHaveLength(1);
    expect(cred.cookies[0].name).toBe('session');
    expect(cred.cookies[0].value).toBe('abc123');
    expect(cred.cookies[0].domain).toBe('test-site.example.com');
    expect(cred.cookies[0].path).toBe('/');
    expect(cred.cookies[0].secure).toBe(true);
  });

  // ---- multiple cookies parsing ----

  it('parses "name1=value1; name2=value2" into two cookies', async () => {
    const { deps, storage } = createDeps();

    await runLogin(['https://test-site.example.com/'], { cookie: 'session=abc; token=xyz' }, deps);

    expect(process.exitCode).not.toBe(1);

    const stored = await storage.get('test-site');
    expect(stored).not.toBeNull();

    const cred = stored!.credential as CookieCredential;
    expect(cred.cookies).toHaveLength(2);
    expect(cred.cookies[0].name).toBe('session');
    expect(cred.cookies[0].value).toBe('abc');
    expect(cred.cookies[1].name).toBe('token');
    expect(cred.cookies[1].value).toBe('xyz');
  });

  // ---- stored credential has correct type and obtainedAt ----

  it('stores CookieCredential with correct type, obtainedAt, and parsed cookies', async () => {
    const { deps, storage } = createDeps();
    const before = new Date().toISOString();

    await runLogin(['https://test-site.example.com/'], { cookie: 'key=val' }, deps);

    const stored = await storage.get('test-site');
    expect(stored).not.toBeNull();

    const cred = stored!.credential as CookieCredential;
    expect(cred.type).toBe('cookie');
    expect(cred.obtainedAt).toBeDefined();
    // obtainedAt should be a valid ISO timestamp and after or equal to `before`
    expect(new Date(cred.obtainedAt).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
    expect(cred.cookies).toHaveLength(1);
  });

  // ---- empty cookie string → error ----

  it('errors when cookie string is empty', async () => {
    const { deps } = createDeps();

    await runLogin(['https://test-site.example.com/'], { cookie: '' }, deps);

    expect(process.exitCode).toBe(1);
    const stderr = stderrChunks.join('');
    expect(stderr).toContain('No valid cookies');
  });

  // ---- cookie string with only whitespace/semicolons → error ----

  it('errors when cookie string has no valid cookies (just semicolons)', async () => {
    const { deps } = createDeps();

    await runLogin(['https://test-site.example.com/'], { cookie: '; ; ;' }, deps);

    expect(process.exitCode).toBe(1);
    const stderr = stderrChunks.join('');
    expect(stderr).toContain('No valid cookies');
  });

  // ---- URL without protocol prefix gets https:// added ----

  it('works with URL that has no protocol prefix (adds https://)', async () => {
    const { deps, storage } = createDeps();

    // URL without protocol — the provider is resolved by domain matching
    await runLogin(['test-site.example.com'], { cookie: 'sid=999' }, deps);

    expect(process.exitCode).not.toBe(1);

    const stored = await storage.get('test-site');
    expect(stored).not.toBeNull();

    const cred = stored!.credential as CookieCredential;
    expect(cred.cookies[0].domain).toBe('test-site.example.com');
    expect(cred.cookies[0].value).toBe('999');
  });

  // ---- output includes JSON with provider and type ----

  it('outputs JSON with provider id and type on stdout', async () => {
    const { deps } = createDeps();

    await runLogin(['https://test-site.example.com/'], { cookie: 'a=1; b=2' }, deps);

    expect(process.exitCode).not.toBe(1);

    const stdout = stdoutChunks.join('');
    const parsed = JSON.parse(stdout);
    expect(parsed.provider).toBe('test-site');
    expect(parsed.type).toBe('cookie');
    expect(parsed.count).toBe(2);
  });

  // ---- stderr confirms storage with cookie count ----

  it('stderr reports cookie count', async () => {
    const { deps } = createDeps();

    await runLogin(['https://test-site.example.com/'], { cookie: 'x=1; y=2; z=3' }, deps);

    const stderr = stderrChunks.join('');
    expect(stderr).toContain('3 cookie(s)');
  });

  // ---- cookies with = in value ----

  it('handles cookies with = in the value', async () => {
    const { deps, storage } = createDeps();

    await runLogin(['https://test-site.example.com/'], { cookie: 'token=abc=def=ghi' }, deps);

    expect(process.exitCode).not.toBe(1);

    const stored = await storage.get('test-site');
    const cred = stored!.credential as CookieCredential;
    expect(cred.cookies[0].name).toBe('token');
    expect(cred.cookies[0].value).toBe('abc=def=ghi');
  });

  // ---- cookie default fields ----

  it('sets correct default cookie fields (expires, httpOnly, secure, path)', async () => {
    const { deps, storage } = createDeps();

    await runLogin(['https://test-site.example.com/'], { cookie: 'sid=test' }, deps);

    const stored = await storage.get('test-site');
    const cred = stored!.credential as CookieCredential;
    const cookie = cred.cookies[0];

    expect(cookie.expires).toBe(-1);
    expect(cookie.httpOnly).toBe(false);
    expect(cookie.secure).toBe(true);
    expect(cookie.path).toBe('/');
  });
});
