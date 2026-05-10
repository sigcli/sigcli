import { fetch as mockFetch } from 'undici';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OAuth2Strategy } from '../../../src/strategies/oauth2/index.js';
import { isErr, isOk } from '../../../src/types/index.js';
import type { ProviderConfig, StoredCredential } from '../../../src/types/types.js';

// Mock undici fetch
vi.mock('undici', () => ({
    fetch: vi.fn(),
    ProxyAgent: vi.fn(),
    Socks5ProxyAgent: vi.fn(),
}));

const mockedFetch = vi.mocked(mockFetch);

function makeProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
    return {
        id: 'test-oauth2',
        name: 'Test OAuth2',
        domains: ['api.example.com'],
        entryUrl: 'https://api.example.com',
        strategy: 'oauth2',
        extract: [],
        apply: [{ in: 'header', name: 'Authorization', value: 'Bearer ${access_token}' }],
        oauth2: {
            tokenUrl: 'https://auth.example.com/oauth/token',
        },
        ...overrides,
    };
}

function makeStored(overrides: Partial<StoredCredential> = {}): StoredCredential {
    return {
        providerId: 'test-oauth2',
        strategy: 'oauth2',
        updatedAt: new Date().toISOString(),
        values: {},
        oauth2: { clientId: 'client-id', clientSecret: 'client-secret' },
        ...overrides,
    };
}

function makeResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    } as unknown as Response;
}

describe('OAuth2Strategy', () => {
    let strategy: OAuth2Strategy;

    beforeEach(() => {
        strategy = new OAuth2Strategy();
        vi.clearAllMocks();
    });

    it('has correct name and needsBrowser=false', () => {
        expect(strategy.name).toBe('oauth2');
        expect(strategy.needsBrowser).toBe(false);
    });

    it('returns error when oauth2 config missing from provider', async () => {
        const provider = makeProvider({ oauth2: undefined });
        const result = await strategy.extract(provider, makeStored());
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
            expect(result.error.message).toMatch(/oauth2.tokenUrl/);
        }
    });

    it('returns error when tokenUrl is missing', async () => {
        const provider = makeProvider({
            oauth2: { tokenUrl: '' },
        });
        const result = await strategy.extract(provider, makeStored());
        expect(isErr(result)).toBe(true);
    });

    it('returns error when stored credential has no oauth2 field', async () => {
        const stored = makeStored({ oauth2: undefined });
        const result = await strategy.extract(makeProvider(), stored);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
            expect(result.error.code).toBe('CREDENTIAL_NOT_FOUND');
        }
    });

    it('returns error when stored credential is undefined', async () => {
        const result = await strategy.extract(makeProvider(), undefined);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
            expect(result.error.code).toBe('CREDENTIAL_NOT_FOUND');
        }
    });

    it('returns error when clientId is empty string', async () => {
        const stored = makeStored({ oauth2: { clientId: '', clientSecret: 'secret' } });
        const result = await strategy.extract(makeProvider(), stored);
        expect(isErr(result)).toBe(true);
    });

    it('successfully exchanges credentials and returns access_token', async () => {
        mockedFetch.mockResolvedValueOnce(
            makeResponse({ access_token: 'tok-abc123', token_type: 'bearer' }),
        );

        const result = await strategy.extract(makeProvider(), makeStored());

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
            expect(result.value.credentials.access_token).toBe('tok-abc123');
            expect(result.value.expiresAt).toBeUndefined();
        }
    });

    it('sends correct Basic auth header and form body', async () => {
        mockedFetch.mockResolvedValueOnce(
            makeResponse({ access_token: 'tok', token_type: 'bearer' }),
        );

        await strategy.extract(makeProvider(), makeStored());

        expect(mockedFetch).toHaveBeenCalledOnce();
        const [url, init] = mockedFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://auth.example.com/oauth/token');

        const expectedBasic = Buffer.from('client-id:client-secret').toString('base64');
        expect((init.headers as Record<string, string>)['Authorization']).toBe(
            `Basic ${expectedBasic}`,
        );
        expect((init.headers as Record<string, string>)['Content-Type']).toBe(
            'application/x-www-form-urlencoded',
        );
        expect(init.body as string).toContain('grant_type=client_credentials');
        expect(init.method).toBe('POST');
    });

    it('includes scope in body when scopes are configured', async () => {
        mockedFetch.mockResolvedValueOnce(
            makeResponse({ access_token: 'tok', token_type: 'bearer' }),
        );

        const provider = makeProvider({
            oauth2: {
                tokenUrl: 'https://auth.example.com/oauth/token',
                scopes: ['read', 'write'],
            },
        });

        await strategy.extract(provider, makeStored());

        const [, init] = mockedFetch.mock.calls[0] as [string, RequestInit];
        expect(init.body as string).toContain('scope=read+write');
    });

    it('handles 401 from token endpoint', async () => {
        mockedFetch.mockResolvedValueOnce(makeResponse({ error: 'invalid_client' }, 401));

        const result = await strategy.extract(makeProvider(), makeStored());

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
            expect(result.error.message).toMatch(/invalid client credentials/);
        }
    });

    it('handles non-2xx non-401 response from token endpoint', async () => {
        mockedFetch.mockResolvedValueOnce(
            makeResponse({ error: 'server_error', error_description: 'Internal error' }, 500),
        );

        const result = await strategy.extract(makeProvider(), makeStored());

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
            expect(result.error.message).toMatch(/Internal error/);
        }
    });

    it('handles non-JSON response from token endpoint', async () => {
        mockedFetch.mockResolvedValueOnce(makeResponse('<html>error</html>'));

        const result = await strategy.extract(makeProvider(), makeStored());

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
            expect(result.error.message).toMatch(/unexpected response format/);
        }
    });

    it('handles missing access_token in response', async () => {
        mockedFetch.mockResolvedValueOnce(makeResponse({ token_type: 'bearer' }));

        const result = await strategy.extract(makeProvider(), makeStored());

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
            expect(result.error.message).toMatch(/access_token/);
        }
    });

    it('computes expiresAt from expires_in', async () => {
        const before = Date.now();
        mockedFetch.mockResolvedValueOnce(makeResponse({ access_token: 'tok', expires_in: 3600 }));

        const result = await strategy.extract(makeProvider(), makeStored());
        const after = Date.now();

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
            expect(result.value.expiresAt).toBeDefined();
            const expiresMs = new Date(result.value.expiresAt!).getTime();
            expect(expiresMs).toBeGreaterThanOrEqual(before + 3600 * 1000);
            expect(expiresMs).toBeLessThanOrEqual(after + 3600 * 1000);
        }
    });

    it('omits expiresAt when expires_in not present', async () => {
        mockedFetch.mockResolvedValueOnce(
            makeResponse({ access_token: 'tok', token_type: 'bearer' }),
        );

        const result = await strategy.extract(makeProvider(), makeStored());

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
            expect(result.value.expiresAt).toBeUndefined();
        }
    });

    it('handles network failure (fetch throws)', async () => {
        mockedFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

        const result = await strategy.extract(makeProvider(), makeStored());

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
            expect(result.error.message).toMatch(/cannot reach token endpoint/);
        }
    });

    it('passes networkProxy dispatcher when configured', async () => {
        mockedFetch.mockResolvedValueOnce(
            makeResponse({ access_token: 'tok', token_type: 'bearer' }),
        );

        const provider = makeProvider({ networkProxy: 'http://proxy.example.com:8080' });
        await strategy.extract(provider, makeStored());

        const [, init] = mockedFetch.mock.calls[0] as [
            string,
            RequestInit & { dispatcher?: unknown },
        ];
        expect(init.dispatcher).toBeDefined();
    });

    it('does not include dispatcher when networkProxy is not set', async () => {
        mockedFetch.mockResolvedValueOnce(
            makeResponse({ access_token: 'tok', token_type: 'bearer' }),
        );

        await strategy.extract(makeProvider(), makeStored());

        const [, init] = mockedFetch.mock.calls[0] as [
            string,
            RequestInit & { dispatcher?: unknown },
        ];
        expect(init.dispatcher).toBeUndefined();
    });
});
