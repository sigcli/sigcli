import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthManager } from '../../src/auth-manager.js';
import { MemoryStorage } from '../../src/storage/memory-storage.js';
import { ProviderRegistry } from '../../src/providers/provider-registry.js';
import { StrategyRegistry } from '../../src/strategies/registry.js';
import { ApiTokenStrategyFactory } from '../../src/strategies/api-token.strategy.js';
import { BasicAuthStrategyFactory } from '../../src/strategies/basic-auth.strategy.js';
import { CookieStrategyFactory } from '../../src/strategies/cookie.strategy.js';
import type { ProviderConfig, ApiKeyCredential, Cookie, CookieCredential } from '../../src/core/types.js';
import type { IBrowserAdapter } from '../../src/core/interfaces/browser-adapter.js';
import type { BrowserConfig } from '../../src/config/schema.js';
import { isOk, isErr } from '../../src/core/result.js';
import { ProviderNotFoundError } from '../../src/core/errors.js';

const githubProvider: ProviderConfig = {
  id: 'github',
  name: 'GitHub',
  domains: ['github.com', 'api.github.com'],
  strategy: 'api-token',
  strategyConfig: { strategy: 'api-token', headerName: 'Authorization', headerPrefix: 'Bearer' },
};

const internalApi: ProviderConfig = {
  id: 'internal',
  name: 'Internal API',
  domains: ['api.internal.corp'],
  strategy: 'basic',
  strategyConfig: { strategy: 'basic' },
};

describe('AuthManager', () => {
  let storage: MemoryStorage;
  let authManager: AuthManager;

  beforeEach(() => {
    storage = new MemoryStorage();
    const strategyRegistry = new StrategyRegistry();
    strategyRegistry.register(new ApiTokenStrategyFactory());
    strategyRegistry.register(new BasicAuthStrategyFactory());
    const providerRegistry = new ProviderRegistry([githubProvider, internalApi]);

    authManager = new AuthManager({
      storage,
      strategyRegistry,
      providerRegistry,
      browserAdapterFactory: () => ({} as IBrowserAdapter),
      browserConfig: { browserDataDir: '/tmp/test-browser-data', channel: 'chrome', headlessTimeout: 30000, visibleTimeout: 120000, waitUntil: 'load' },
    });
  });

  describe('getCredentials', () => {
    it('returns stored credential when valid', async () => {
      const cred: ApiKeyCredential = { type: 'api-key', key: 'ghp_abc123', headerName: 'Authorization', headerPrefix: 'Bearer' };
      await authManager.setCredential('github', cred);

      const result = await authManager.getCredentials('github');
      expect(isOk(result)).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe('api-key');
        expect((result.value as ApiKeyCredential).key).toBe('ghp_abc123');
      }
    });

    it('returns error for unknown provider', async () => {
      const result = await authManager.getCredentials('unknown');
      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error.code).toBe('PROVIDER_NOT_FOUND');
      }
    });

    it('returns ManualSetupRequired when no stored cred for api-token provider', async () => {
      const result = await authManager.getCredentials('github');
      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error.code).toBe('MANUAL_SETUP_REQUIRED');
      }
    });
  });

  describe('getCredentialsByUrl', () => {
    it('resolves provider by URL and returns credentials', async () => {
      const cred: ApiKeyCredential = { type: 'api-key', key: 'ghp_test', headerName: 'Authorization', headerPrefix: 'Bearer' };
      await authManager.setCredential('github', cred);

      const result = await authManager.getCredentialsByUrl('https://api.github.com/repos');
      expect(isOk(result)).toBe(true);
      if (result.ok) {
        expect(result.value.provider.id).toBe('github');
        expect(result.value.credential.type).toBe('api-key');
      }
    });

    it('auto-provisions a cookie provider for unmatched URL', () => {
      const provider = authManager.resolveProvider('https://unknown.example.com');
      // Short ID derived from hostname: "unknown" is 7 chars, so joins first two segments
      expect(provider.id).toBe('unknown-example');
      expect(provider.strategy).toBe('cookie');
      expect(provider.domains).toEqual(['unknown.example.com']);
      expect(provider.entryUrl).toBe('https://unknown.example.com/');
      expect(provider.autoProvisioned).toBe(true);

      // Should be registered and findable by ID now
      expect(authManager.providerRegistry.get('unknown-example')).toBe(provider);
    });
  });

  describe('setCredential', () => {
    it('stores credential and makes it retrievable', async () => {
      const cred: ApiKeyCredential = { type: 'api-key', key: 'my-token', headerName: 'Authorization' };
      const setResult = await authManager.setCredential('github', cred);
      expect(isOk(setResult)).toBe(true);

      const getResult = await authManager.getCredentials('github');
      expect(isOk(getResult)).toBe(true);
    });

    it('rejects unknown provider', async () => {
      const cred: ApiKeyCredential = { type: 'api-key', key: 'x', headerName: 'Authorization' };
      const result = await authManager.setCredential('unknown', cred);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('shows unconfigured for unknown provider', async () => {
      const status = await authManager.getStatus('unknown');
      expect(status.configured).toBe(false);
      expect(status.valid).toBe(false);
    });

    it('shows configured but invalid when no credentials', async () => {
      const status = await authManager.getStatus('github');
      expect(status.configured).toBe(true);
      expect(status.valid).toBe(false);
    });

    it('shows valid when credentials exist', async () => {
      const cred: ApiKeyCredential = { type: 'api-key', key: 'token', headerName: 'Authorization' };
      await authManager.setCredential('github', cred);
      const status = await authManager.getStatus('github');
      expect(status.configured).toBe(true);
      expect(status.valid).toBe(true);
      expect(status.credentialType).toBe('api-key');
    });
  });

  describe('clearCredentials', () => {
    it('removes stored credential', async () => {
      const cred: ApiKeyCredential = { type: 'api-key', key: 'token', headerName: 'Authorization' };
      await authManager.setCredential('github', cred);
      await authManager.clearCredentials('github');
      const status = await authManager.getStatus('github');
      expect(status.valid).toBe(false);
    });
  });

  describe('applyToRequest', () => {
    it('returns correct auth headers', () => {
      const cred: ApiKeyCredential = { type: 'api-key', key: 'my-token', headerName: 'Authorization', headerPrefix: 'Bearer' };
      const headers = authManager.applyToRequest('github', cred);
      expect(headers).toEqual({ Authorization: 'Bearer my-token' });
    });
  });

  describe('validateCredential', () => {
    it('returns null status when provider has no entryUrl', async () => {
      // githubProvider has no entryUrl defined
      const cred: ApiKeyCredential = { type: 'api-key', key: 'token', headerName: 'Authorization', headerPrefix: 'Bearer' };
      const result = await authManager.validateCredential(githubProvider, cred);

      expect(result.status).toBeNull();
      expect(result.isLoginRedirect).toBe(false);
    });

    it('returns null status when provider entryUrl is undefined', async () => {
      const providerNoEntry: ProviderConfig = {
        id: 'no-entry',
        name: 'No Entry',
        domains: ['no-entry.example.com'],
        strategy: 'api-token',
        strategyConfig: { strategy: 'api-token' },
        // entryUrl deliberately omitted
      };
      const cred: ApiKeyCredential = { type: 'api-key', key: 'token', headerName: 'Authorization' };
      const result = await authManager.validateCredential(providerNoEntry, cred);

      expect(result.status).toBeNull();
      expect(result.isLoginRedirect).toBe(false);
    });

    it('returns status from fetch response on success', async () => {
      const providerWithEntry: ProviderConfig = {
        id: 'test-api',
        name: 'Test API',
        domains: ['test-api.example.com'],
        entryUrl: 'https://test-api.example.com/',
        strategy: 'api-token',
        strategyConfig: { strategy: 'api-token', headerName: 'Authorization', headerPrefix: 'Bearer' },
      };

      // Mock fetch to return 200
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
      });
      vi.stubGlobal('fetch', mockFetch);

      const cred: ApiKeyCredential = { type: 'api-key', key: 'valid-token', headerName: 'Authorization', headerPrefix: 'Bearer' };
      const result = await authManager.validateCredential(providerWithEntry, cred);

      expect(result.status).toBe(200);
      expect(result.isLoginRedirect).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-api.example.com/',
        expect.objectContaining({
          method: 'GET',
          redirect: 'manual',
        }),
      );

      vi.unstubAllGlobals();
    });

    it('detects login redirect (302 to /login)', async () => {
      const providerWithEntry: ProviderConfig = {
        id: 'sso-app',
        name: 'SSO App',
        domains: ['sso-app.example.com'],
        entryUrl: 'https://sso-app.example.com/',
        strategy: 'api-token',
        strategyConfig: { strategy: 'api-token', headerName: 'Authorization', headerPrefix: 'Bearer' },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        status: 302,
        headers: new Headers({ location: 'https://sso.example.com/login?redirect=...' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const cred: ApiKeyCredential = { type: 'api-key', key: 'expired-token', headerName: 'Authorization' };
      const result = await authManager.validateCredential(providerWithEntry, cred);

      expect(result.status).toBe(302);
      expect(result.isLoginRedirect).toBe(true);

      vi.unstubAllGlobals();
    });

    it('detects redirect to SSO provider (generic IDP)', async () => {
      const providerWithEntry: ProviderConfig = {
        id: 'example-app',
        name: 'Example App',
        domains: ['app.example.com'],
        entryUrl: 'https://app.example.com/',
        strategy: 'api-token',
        strategyConfig: { strategy: 'api-token', headerName: 'Authorization', headerPrefix: 'Bearer' },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        status: 301,
        headers: new Headers({ location: 'https://idp.example.com/saml2/idp/sso?...' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const cred: ApiKeyCredential = { type: 'api-key', key: 'token', headerName: 'Authorization' };
      const result = await authManager.validateCredential(providerWithEntry, cred);

      expect(result.status).toBe(301);
      expect(result.isLoginRedirect).toBe(true);

      vi.unstubAllGlobals();
    });

    it('does not flag non-login redirect as login redirect', async () => {
      const providerWithEntry: ProviderConfig = {
        id: 'redirect-app',
        name: 'Redirect App',
        domains: ['redirect-app.example.com'],
        entryUrl: 'https://redirect-app.example.com/',
        strategy: 'api-token',
        strategyConfig: { strategy: 'api-token', headerName: 'Authorization', headerPrefix: 'Bearer' },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        status: 301,
        headers: new Headers({ location: 'https://redirect-app.example.com/dashboard' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const cred: ApiKeyCredential = { type: 'api-key', key: 'token', headerName: 'Authorization' };
      const result = await authManager.validateCredential(providerWithEntry, cred);

      expect(result.status).toBe(301);
      expect(result.isLoginRedirect).toBe(false);

      vi.unstubAllGlobals();
    });

    it('returns null status when fetch throws (network error)', async () => {
      const providerWithEntry: ProviderConfig = {
        id: 'unreachable',
        name: 'Unreachable',
        domains: ['unreachable.example.com'],
        entryUrl: 'https://unreachable.example.com/',
        strategy: 'api-token',
        strategyConfig: { strategy: 'api-token', headerName: 'Authorization', headerPrefix: 'Bearer' },
      };

      const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      vi.stubGlobal('fetch', mockFetch);

      const cred: ApiKeyCredential = { type: 'api-key', key: 'token', headerName: 'Authorization' };
      const result = await authManager.validateCredential(providerWithEntry, cred);

      expect(result.status).toBeNull();
      expect(result.isLoginRedirect).toBe(false);

      vi.unstubAllGlobals();
    });

    it('returns 401 status for unauthorized response', async () => {
      const providerWithEntry: ProviderConfig = {
        id: 'secure-api',
        name: 'Secure API',
        domains: ['secure-api.example.com'],
        entryUrl: 'https://secure-api.example.com/',
        strategy: 'api-token',
        strategyConfig: { strategy: 'api-token', headerName: 'Authorization', headerPrefix: 'Bearer' },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        status: 401,
        headers: new Headers(),
      });
      vi.stubGlobal('fetch', mockFetch);

      const cred: ApiKeyCredential = { type: 'api-key', key: 'bad-token', headerName: 'Authorization' };
      const result = await authManager.validateCredential(providerWithEntry, cred);

      expect(result.status).toBe(401);
      expect(result.isLoginRedirect).toBe(false);

      vi.unstubAllGlobals();
    });
  });

  describe('resolveProvider', () => {
    it('resolves by provider ID without auto-provisioning', () => {
      const provider = authManager.resolveProvider('github');
      expect(provider.id).toBe('github');
      expect(provider.name).toBe('GitHub');
      expect(provider.autoProvisioned).toBeUndefined();
    });

    it('resolves by provider name (case-insensitive)', () => {
      const provider = authManager.resolveProvider('Internal API');
      expect(provider.id).toBe('internal');
      expect(provider.name).toBe('Internal API');

      const providerLower = authManager.resolveProvider('internal api');
      expect(providerLower.id).toBe('internal');
    });

    it('auto-provisions for unknown URLs (contains dot)', () => {
      const provider = authManager.resolveProvider('https://new-service.example.com/api');
      // "new-service" is 11 chars (>= 8), so first segment used as-is
      expect(provider.id).toBe('new-service');
      expect(provider.strategy).toBe('cookie');
      expect(provider.autoProvisioned).toBe(true);
      expect(provider.domains).toEqual(['new-service.example.com']);

      // Should be registered and findable after auto-provisioning
      expect(authManager.providerRegistry.get('new-service')).toBe(provider);
    });

    it('auto-provisions for bare hostname with dot', () => {
      const provider = authManager.resolveProvider('bare.hostname.com');
      // "bare" is 4 chars (< 8), so joins first two: "bare-hostname"
      expect(provider.id).toBe('bare-hostname');
      expect(provider.autoProvisioned).toBe(true);
    });

    it('throws ProviderNotFoundError for non-URL unknown input', () => {
      expect(() => authManager.resolveProvider('typo-name')).toThrow(ProviderNotFoundError);
      expect(() => authManager.resolveProvider('nonexistent')).toThrow(ProviderNotFoundError);
    });

    it('does not auto-provision when input matches a provider name', () => {
      const provider = authManager.resolveProvider('GitHub');
      expect(provider.id).toBe('github');
      expect(provider.autoProvisioned).toBeUndefined();
    });
  });
});

// ============================================================================
// Cookie Expiry Tests (getExpiresAt 3-tier filtering via getStatus)
// ============================================================================

function makeCookie(name: string, expiresInSeconds: number): Cookie {
  return {
    name,
    value: 'v',
    domain: '.example.com',
    path: '/',
    expires: expiresInSeconds > 0 ? Math.floor(Date.now() / 1000) + expiresInSeconds : -1,
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  };
}

function makeCookieCredential(cookies: Cookie[]): CookieCredential {
  return {
    type: 'cookie',
    cookies,
    obtainedAt: new Date().toISOString(),
  };
}

describe('AuthManager cookie expiry (getStatus)', () => {
  let storage: MemoryStorage;

  function buildAuthManager(provider: ProviderConfig): AuthManager {
    const strategyRegistry = new StrategyRegistry();
    strategyRegistry.register(new CookieStrategyFactory());
    const providerRegistry = new ProviderRegistry([provider]);

    return new AuthManager({
      storage,
      strategyRegistry,
      providerRegistry,
      browserAdapterFactory: () => ({} as IBrowserAdapter),
      browserConfig: { browserDataDir: '/tmp/test-browser-data', channel: 'chrome', headlessTimeout: 30000, visibleTimeout: 120000, waitUntil: 'load' },
    });
  }

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('returns undefined expiresInMinutes when all cookies are session cookies', async () => {
    const provider: ProviderConfig = {
      id: 'session-app',
      name: 'Session App',
      domains: ['session-app.example.com'],
      strategy: 'cookie',
      strategyConfig: { strategy: 'cookie' },
    };
    const authManager = buildAuthManager(provider);
    const cred = makeCookieCredential([
      makeCookie('sid', -1),
      makeCookie('csrf_token', -1),
    ]);
    await authManager.setCredential('session-app', cred);

    const status = await authManager.getStatus('session-app');
    expect(status.configured).toBe(true);
    expect(status.valid).toBe(true);
    expect(status.expiresInMinutes).toBeUndefined();
    expect(status.expiresAt).toBeUndefined();
  });

  it('picks real cookie expiry over tracker cookie expiry', async () => {
    const provider: ProviderConfig = {
      id: 'tracker-mix',
      name: 'Tracker Mix',
      domains: ['tracker-mix.example.com'],
      strategy: 'cookie',
      strategyConfig: { strategy: 'cookie' },
    };
    const authManager = buildAuthManager(provider);
    const oneHour = 3600;
    const farFuture = 365 * 24 * 3600; // 1 year
    const cred = makeCookieCredential([
      makeCookie('AMCV_X', farFuture),
      makeCookie('auth_session', oneHour),
    ]);
    await authManager.setCredential('tracker-mix', cred);

    const status = await authManager.getStatus('tracker-mix');
    expect(status.expiresInMinutes).toBeDefined();
    // auth_session expires in ~60 min, should be close to 60
    expect(status.expiresInMinutes!).toBeGreaterThanOrEqual(58);
    expect(status.expiresInMinutes!).toBeLessThanOrEqual(61);
  });

  it('returns undefined when only tracker cookies have expiry', async () => {
    const provider: ProviderConfig = {
      id: 'tracker-only-expiry',
      name: 'Tracker Only Expiry',
      domains: ['tracker-only.example.com'],
      strategy: 'cookie',
      strategyConfig: { strategy: 'cookie' },
    };
    const authManager = buildAuthManager(provider);
    const cred = makeCookieCredential([
      makeCookie('AMCV_X', 398 * 24 * 3600),
      makeCookie('_ga', 2 * 365 * 24 * 3600),
      makeCookie('session_cookie', -1),
    ]);
    await authManager.setCredential('tracker-only-expiry', cred);

    const status = await authManager.getStatus('tracker-only-expiry');
    expect(status.expiresInMinutes).toBeUndefined();
    expect(status.expiresAt).toBeUndefined();
  });

  it('returns undefined when requiredCookies are session cookies', async () => {
    const provider: ProviderConfig = {
      id: 'required-session',
      name: 'Required Session',
      domains: ['required-session.example.com'],
      strategy: 'cookie',
      strategyConfig: { strategy: 'cookie', requiredCookies: ['id_token'] },
    };
    const authManager = buildAuthManager(provider);
    const cred = makeCookieCredential([
      makeCookie('id_token', -1),
      makeCookie('_ga', 2 * 365 * 24 * 3600),
    ]);
    await authManager.setCredential('required-session', cred);

    const status = await authManager.getStatus('required-session');
    expect(status.expiresInMinutes).toBeUndefined();
    expect(status.expiresAt).toBeUndefined();
  });

  it('uses earliest requiredCookie expiry when requiredCookies configured', async () => {
    const provider: ProviderConfig = {
      id: 'required-expiring',
      name: 'Required Expiring',
      domains: ['required-expiring.example.com'],
      strategy: 'cookie',
      strategyConfig: { strategy: 'cookie', requiredCookies: ['id_token', 'sid'] },
    };
    const authManager = buildAuthManager(provider);
    const oneHour = 3600;
    const twoHours = 7200;
    const cred = makeCookieCredential([
      makeCookie('id_token', oneHour),
      makeCookie('sid', twoHours),
      makeCookie('_ga', 2 * 365 * 24 * 3600),
    ]);
    await authManager.setCredential('required-expiring', cred);

    const status = await authManager.getStatus('required-expiring');
    expect(status.expiresInMinutes).toBeDefined();
    // id_token expires first (~60 min), _ga should be ignored (Tier 1 filters to requiredCookies only)
    expect(status.expiresInMinutes!).toBeGreaterThanOrEqual(58);
    expect(status.expiresInMinutes!).toBeLessThanOrEqual(61);
  });

  it('filters out mixed tracker cookies and uses real cookie expiry', async () => {
    const provider: ProviderConfig = {
      id: 'mixed-trackers',
      name: 'Mixed Trackers',
      domains: ['mixed-trackers.example.com'],
      strategy: 'cookie',
      strategyConfig: { strategy: 'cookie' },
    };
    const authManager = buildAuthManager(provider);
    const eightHours = 8 * 3600;
    const cred = makeCookieCredential([
      makeCookie('_fbp', 90 * 24 * 3600),
      makeCookie('_hjid', 365 * 24 * 3600),
      makeCookie('JSESSIONID', eightHours),
    ]);
    await authManager.setCredential('mixed-trackers', cred);

    const status = await authManager.getStatus('mixed-trackers');
    expect(status.expiresInMinutes).toBeDefined();
    // JSESSIONID expires in ~480 min
    expect(status.expiresInMinutes!).toBeGreaterThanOrEqual(478);
    expect(status.expiresInMinutes!).toBeLessThanOrEqual(481);
  });

  it('returns undefined when all cookies are trackers', async () => {
    const provider: ProviderConfig = {
      id: 'all-trackers',
      name: 'All Trackers',
      domains: ['all-trackers.example.com'],
      strategy: 'cookie',
      strategyConfig: { strategy: 'cookie' },
    };
    const authManager = buildAuthManager(provider);
    const cred = makeCookieCredential([
      makeCookie('_ga', 2 * 365 * 24 * 3600),
      makeCookie('_gid', 24 * 3600),
      makeCookie('NID', 180 * 24 * 3600),
    ]);
    await authManager.setCredential('all-trackers', cred);

    const status = await authManager.getStatus('all-trackers');
    expect(status.expiresInMinutes).toBeUndefined();
    expect(status.expiresAt).toBeUndefined();
  });

  it('falls through to Tier 2 when requiredCookies is empty array', async () => {
    const provider: ProviderConfig = {
      id: 'empty-required',
      name: 'Empty Required',
      domains: ['empty-required.example.com'],
      strategy: 'cookie',
      strategyConfig: { strategy: 'cookie', requiredCookies: [] },
    };
    const authManager = buildAuthManager(provider);
    const oneHour = 3600;
    const cred = makeCookieCredential([
      makeCookie('_ga', 2 * 365 * 24 * 3600),
      makeCookie('real_cookie', oneHour),
    ]);
    await authManager.setCredential('empty-required', cred);

    const status = await authManager.getStatus('empty-required');
    expect(status.expiresInMinutes).toBeDefined();
    // real_cookie expires in ~60 min, _ga filtered out by Tier 2
    expect(status.expiresInMinutes!).toBeGreaterThanOrEqual(58);
    expect(status.expiresInMinutes!).toBeLessThanOrEqual(61);
  });
});
