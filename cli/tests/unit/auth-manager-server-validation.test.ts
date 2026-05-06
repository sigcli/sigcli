import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AuthManager } from '../../src/auth-manager.js';
import { MemoryStorage } from '../../src/storage/memory-storage.js';
import { ProviderRegistry } from '../../src/providers/provider-registry.js';
import { StrategyRegistry } from '../../src/strategies/registry.js';
import { CookieStrategyFactory } from '../../src/strategies/cookie.strategy.js';
import { ApiTokenStrategyFactory } from '../../src/strategies/api-token.strategy.js';
import type { ProviderConfig, CookieCredential, ApiKeyCredential } from '../../src/core/types.js';
import type { IBrowserAdapter } from '../../src/core/interfaces/browser-adapter.js';
import { isOk, isErr } from '../../src/core/result.js';

const cookieProvider: ProviderConfig = {
    id: 'sso-app',
    name: 'SSO App',
    domains: ['sso-app.example.com'],
    entryUrl: 'https://sso-app.example.com/',
    strategy: 'cookie',
    strategyConfig: { strategy: 'cookie' },
};

const noEntryProvider: ProviderConfig = {
    id: 'no-entry',
    name: 'No Entry URL',
    domains: ['no-entry.example.com'],
    strategy: 'api-token',
    strategyConfig: { strategy: 'api-token', headerName: 'Authorization', headerPrefix: 'Bearer' },
};

function makeCookieCredential(): CookieCredential {
    return {
        type: 'cookie',
        cookies: [{ name: 'session', value: 'abc123', domain: 'sso-app.example.com', expires: -1 }],
        obtainedAt: new Date().toISOString(),
    };
}

describe('AuthManager - server-side validation in getCredentials()', () => {
    let storage: MemoryStorage;
    let authManager: AuthManager;

    beforeEach(() => {
        storage = new MemoryStorage();
        const strategyRegistry = new StrategyRegistry();
        strategyRegistry.register(new CookieStrategyFactory());
        strategyRegistry.register(new ApiTokenStrategyFactory());
        const providerRegistry = new ProviderRegistry([cookieProvider, noEntryProvider]);

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

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns cached credential when server responds 200', async () => {
        const cred = makeCookieCredential();
        await authManager.setCredential('sso-app', cred);

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, headers: new Headers() }));

        const result = await authManager.getCredentials('sso-app');
        expect(isOk(result)).toBe(true);
        if (result.ok) {
            expect(result.value.type).toBe('cookie');
        }
    });

    it('triggers re-auth when server returns login redirect (302 → /login)', async () => {
        const cred = makeCookieCredential();
        await authManager.setCredential('sso-app', cred);

        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                status: 302,
                headers: new Headers({ location: 'https://idp.example.com/login?redirect=...' }),
            }),
        );

        // Re-auth will fail because browser adapter is a stub — we just verify
        // that stored credential is deleted (not returned as-is)
        const result = await authManager.getCredentials('sso-app');
        // Should attempt re-auth (and fail because of stub adapter)
        expect(isErr(result)).toBe(true);

        // Stored credential should have been cleared
        const stored = await storage.get('sso-app');
        expect(stored).toBeNull();
    });

    it('triggers re-auth when server returns 401', async () => {
        const cred = makeCookieCredential();
        await authManager.setCredential('sso-app', cred);

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401, headers: new Headers() }));

        const result = await authManager.getCredentials('sso-app');
        expect(isErr(result)).toBe(true);

        // Stored credential should have been cleared
        const stored = await storage.get('sso-app');
        expect(stored).toBeNull();
    });

    it('returns cached credential on network error (graceful degradation)', async () => {
        const cred = makeCookieCredential();
        await authManager.setCredential('sso-app', cred);

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

        const result = await authManager.getCredentials('sso-app');
        expect(isOk(result)).toBe(true);
        if (result.ok) {
            expect(result.value.type).toBe('cookie');
        }
    });

    it('skips server probe when provider has no entryUrl', async () => {
        const cred: ApiKeyCredential = {
            type: 'api-key',
            key: 'my-token',
            headerName: 'Authorization',
            headerPrefix: 'Bearer',
        };
        await authManager.setCredential('no-entry', cred);

        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const result = await authManager.getCredentials('no-entry');
        expect(isOk(result)).toBe(true);
        // fetch should never have been called
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not flag non-login redirect as stale', async () => {
        const cred = makeCookieCredential();
        await authManager.setCredential('sso-app', cred);

        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                status: 302,
                headers: new Headers({ location: 'https://app.example.com/dashboard' }),
            }),
        );

        const result = await authManager.getCredentials('sso-app');
        expect(isOk(result)).toBe(true);
    });
});
