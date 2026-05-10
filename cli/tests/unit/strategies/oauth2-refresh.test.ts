import { fetch as mockFetch } from 'undici';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProviderRegistry } from '../../../src/providers/provider-registry.js';
import { MemoryStorage } from '../../../src/storage/memory-storage.js';
import { OAuth2Strategy } from '../../../src/strategies/oauth2/index.js';
import { isErr } from '../../../src/types/index.js';
import type { ProviderConfig, StoredCredential } from '../../../src/types/types.js';

// Mock undici fetch
vi.mock('undici', () => ({
    fetch: vi.fn(),
    ProxyAgent: vi.fn(),
    Socks5ProxyAgent: vi.fn(),
}));

const mockedFetch = vi.mocked(mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProvider(): ProviderConfig {
    return {
        id: 'test-provider',
        name: 'Test Provider',
        domains: ['api.example.com'],
        entryUrl: 'https://api.example.com',
        strategy: 'oauth2',
        extract: [],
        apply: [{ in: 'header', name: 'Authorization', value: 'Bearer ${access_token}' }],
        oauth2: { tokenUrl: 'https://mock-token-endpoint/oauth/token' },
    };
}

function makeExpiredStored(): StoredCredential {
    return {
        providerId: 'test-provider',
        strategy: 'oauth2',
        updatedAt: new Date(Date.now() - 7200_000).toISOString(), // 2 hours ago
        expiresAt: new Date(Date.now() - 3600_000).toISOString(), // expired 1 hour ago
        values: { access_token: 'expired-token' },
        oauth2: { clientId: 'test-id', clientSecret: 'test-secret' },
    };
}

function makeValidStored(): StoredCredential {
    return {
        providerId: 'test-provider',
        strategy: 'oauth2',
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600_000).toISOString(), // valid for 1 more hour
        values: { access_token: 'valid-token' },
        oauth2: { clientId: 'test-id', clientSecret: 'test-secret' },
    };
}

function makeTokenResponse(accessToken: string, expiresIn = 3600): Response {
    return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ access_token: accessToken, expires_in: expiresIn }),
    } as unknown as Response;
}

/**
 * Simulates the AuthManager.getCached() + authenticate() flow using
 * MemoryStorage + OAuth2Strategy directly. This mirrors what the real
 * AuthManager does without requiring file I/O or an encryption key.
 */
async function simulateGetExtractedCreds(
    storage: MemoryStorage,
    strategy: OAuth2Strategy,
    provider: ProviderConfig,
): Promise<{ credentials: Record<string, string> } | { error: string }> {
    const stored = await storage.get(provider.id);

    // Mirror AuthManager.getCached() TTL check
    if (stored) {
        const hasValues = stored.values && Object.keys(stored.values).length > 0;
        const expired = stored.expiresAt && Date.now() >= new Date(stored.expiresAt).getTime();
        if (hasValues && !expired) {
            return { credentials: stored.values };
        }
    }

    // Mirror AuthManager.authenticate()
    const extractResult = await strategy.extract(provider, stored ?? undefined);
    if (isErr(extractResult)) {
        return { error: extractResult.error.message };
    }

    const newStored: StoredCredential = {
        providerId: provider.id,
        strategy: provider.strategy,
        updatedAt: new Date().toISOString(),
        values: extractResult.value.credentials,
        ...(extractResult.value.expiresAt ? { expiresAt: extractResult.value.expiresAt } : {}),
        ...(stored?.oauth2 ? { oauth2: stored.oauth2 } : {}),
    };
    await storage.set(provider.id, newStored);

    return { credentials: extractResult.value.credentials };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OAuth2 silent refresh (Slice 3)', () => {
    let storage: MemoryStorage;
    let strategy: OAuth2Strategy;
    let provider: ProviderConfig;

    beforeEach(() => {
        storage = new MemoryStorage();
        strategy = new OAuth2Strategy();
        provider = makeProvider();
        vi.clearAllMocks();
    });

    it('auto-refreshes when access_token is expired', async () => {
        await storage.set('test-provider', makeExpiredStored());
        mockedFetch.mockResolvedValueOnce(makeTokenResponse('new-access-token'));

        const result = await simulateGetExtractedCreds(storage, strategy, provider);

        // Returned the new token
        expect('credentials' in result).toBe(true);
        if ('credentials' in result) {
            expect(result.credentials.access_token).toBe('new-access-token');
        }

        // Made exactly one POST to the token endpoint
        expect(mockedFetch).toHaveBeenCalledOnce();
        const [url, init] = mockedFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://mock-token-endpoint/oauth/token');
        expect(init.method).toBe('POST');

        // Basic auth header uses the stored clientId:clientSecret
        const expectedBasic = Buffer.from('test-id:test-secret').toString('base64');
        expect((init.headers as Record<string, string>)['Authorization']).toBe(
            `Basic ${expectedBasic}`,
        );
    });

    it('stores the new token and expiresAt after refresh', async () => {
        const before = Date.now();
        await storage.set('test-provider', makeExpiredStored());
        mockedFetch.mockResolvedValueOnce(makeTokenResponse('refreshed-token', 7200));

        await simulateGetExtractedCreds(storage, strategy, provider);

        const after = Date.now();
        const updated = await storage.get('test-provider');
        expect(updated).not.toBeNull();
        expect(updated!.values.access_token).toBe('refreshed-token');
        expect(updated!.expiresAt).toBeDefined();

        const expiresMs = new Date(updated!.expiresAt!).getTime();
        expect(expiresMs).toBeGreaterThanOrEqual(before + 7200 * 1000);
        expect(expiresMs).toBeLessThanOrEqual(after + 7200 * 1000);
    });

    it('preserves clientId/clientSecret in stored credential after refresh', async () => {
        await storage.set('test-provider', makeExpiredStored());
        mockedFetch.mockResolvedValueOnce(makeTokenResponse('new-token'));

        await simulateGetExtractedCreds(storage, strategy, provider);

        const updated = await storage.get('test-provider');
        expect(updated!.oauth2).toEqual({ clientId: 'test-id', clientSecret: 'test-secret' });
    });

    it('returns cached token without a network request when token is NOT expired', async () => {
        await storage.set('test-provider', makeValidStored());

        const result = await simulateGetExtractedCreds(storage, strategy, provider);

        // No fetch call — used cached value
        expect(mockedFetch).not.toHaveBeenCalled();

        expect('credentials' in result).toBe(true);
        if ('credentials' in result) {
            expect(result.credentials.access_token).toBe('valid-token');
        }
    });

    it('returns an error when expired token has no stored oauth2 credentials', async () => {
        const stored: StoredCredential = {
            ...makeExpiredStored(),
            oauth2: undefined,
        };
        await storage.set('test-provider', stored);

        const result = await simulateGetExtractedCreds(storage, strategy, provider);

        expect('error' in result).toBe(true);
        expect(mockedFetch).not.toHaveBeenCalled();
    });

    it('verifies provider registry resolves correct provider for the domain', () => {
        const registry = new ProviderRegistry([provider]);
        const resolved = registry.resolve('https://api.example.com/data');
        expect(resolved).not.toBeNull();
        expect(resolved!.id).toBe('test-provider');
        expect(resolved!.strategy).toBe('oauth2');
        expect(resolved!.oauth2?.tokenUrl).toBe('https://mock-token-endpoint/oauth/token');
    });
});
