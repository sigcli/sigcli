import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthManager } from '../../src/auth-manager.js';
import { MemoryStorage } from '../../src/storage/memory-storage.js';
import { ProviderRegistry } from '../../src/providers/provider-registry.js';
import { StrategyRegistry } from '../../src/strategies/registry.js';
import { ApiTokenStrategyFactory } from '../../src/strategies/api-token.strategy.js';
import { BasicAuthStrategyFactory } from '../../src/strategies/basic-auth.strategy.js';
import type { ProviderConfig, ApiKeyCredential } from '../../src/core/types.js';
import type { IBrowserAdapter } from '../../src/core/interfaces/browser-adapter.js';
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
      browserAdapterFactory: () => ({}) as IBrowserAdapter,
      browserConfig: {
        browserDataDir: '/tmp/test-browser-data',
        channel: 'chrome',
        headlessTimeout: 30000,
        visibleTimeout: 120000,
        waitUntil: 'load',
      },
    });
  });

  describe('getCredentials', () => {
    it('returns stored credential when valid', async () => {
      const cred: ApiKeyCredential = {
        type: 'api-key',
        key: 'ghp_abc123',
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
      };
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
      const cred: ApiKeyCredential = {
        type: 'api-key',
        key: 'ghp_test',
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
      };
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
      const cred: ApiKeyCredential = {
        type: 'api-key',
        key: 'my-token',
        headerName: 'Authorization',
      };
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
      const cred: ApiKeyCredential = {
        type: 'api-key',
        key: 'my-token',
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
      };
      const headers = authManager.applyToRequest('github', cred);
      expect(headers).toEqual({ Authorization: 'Bearer my-token' });
    });
  });

  describe('validateCredential', () => {
    it('returns null status when provider has no entryUrl', async () => {
      // githubProvider has no entryUrl defined
      const cred: ApiKeyCredential = {
        type: 'api-key',
        key: 'token',
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
      };
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
        strategyConfig: {
          strategy: 'api-token',
          headerName: 'Authorization',
          headerPrefix: 'Bearer',
        },
      };

      // Mock fetch to return 200
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
      });
      vi.stubGlobal('fetch', mockFetch);

      const cred: ApiKeyCredential = {
        type: 'api-key',
        key: 'valid-token',
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
      };
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
        strategyConfig: {
          strategy: 'api-token',
          headerName: 'Authorization',
          headerPrefix: 'Bearer',
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        status: 302,
        headers: new Headers({ location: 'https://sso.example.com/login?redirect=...' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const cred: ApiKeyCredential = {
        type: 'api-key',
        key: 'expired-token',
        headerName: 'Authorization',
      };
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
        strategyConfig: {
          strategy: 'api-token',
          headerName: 'Authorization',
          headerPrefix: 'Bearer',
        },
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
        strategyConfig: {
          strategy: 'api-token',
          headerName: 'Authorization',
          headerPrefix: 'Bearer',
        },
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
        strategyConfig: {
          strategy: 'api-token',
          headerName: 'Authorization',
          headerPrefix: 'Bearer',
        },
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
        strategyConfig: {
          strategy: 'api-token',
          headerName: 'Authorization',
          headerPrefix: 'Bearer',
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        status: 401,
        headers: new Headers(),
      });
      vi.stubGlobal('fetch', mockFetch);

      const cred: ApiKeyCredential = {
        type: 'api-key',
        key: 'bad-token',
        headerName: 'Authorization',
      };
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
