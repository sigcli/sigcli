import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isErr, isOk, type ProviderConfig } from '../../../src/types/index.js';

// Mock undici fetch at module level
const mockFetch = vi.fn();
vi.mock('undici', () => ({ fetch: (...args: any[]) => mockFetch(...args) }));

// Import after mock
const { OAuth2Strategy } = await import('../../../src/strategies/oauth2/index.js');

function makeProvider(overrides?: Partial<ProviderConfig>): ProviderConfig {
    return {
        id: 'test-oauth',
        name: 'Test OAuth',
        domains: ['api.example.com'],
        entryUrl: 'https://api.example.com/',
        strategy: 'oauth2',
        extract: [
            { from: 'prompt', as: 'client_id', match: 'client_id' },
            { from: 'prompt', as: 'client_secret', match: 'client_secret' },
            { from: 'prompt', as: 'token_url', match: 'token_url' },
        ],
        apply: [{ in: 'header', name: 'Authorization', value: 'Bearer ${access_token}' }],
        exchange: {
            grant_type: 'client_credentials',
            scopes: ['read', 'write'],
            as: 'access_token',
        },
        ...overrides,
    };
}

const SET_VALUES = {
    client_id: 'my-id',
    client_secret: 'my-secret',
    token_url: 'https://auth.example.com/token',
};

/** Helper: mock a successful token response */
function mockTokenResponse(json: Record<string, unknown>) {
    mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(json),
    });
}

describe('OAuth2Strategy', () => {
    let strategy: InstanceType<typeof OAuth2Strategy>;

    beforeEach(() => {
        strategy = new OAuth2Strategy();
        mockFetch.mockReset();
    });

    it('has correct name and needsBrowser=false', () => {
        expect(strategy.name).toBe('oauth2');
        expect(strategy.needsBrowser).toBe(false);
    });

    it('returns error when exchange config is missing', async () => {
        const provider = makeProvider({ exchange: undefined });
        const result = await strategy.extract(provider, { setValues: SET_VALUES });
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
            expect(result.error.message).toContain('exchange');
        }
    });

    it('collects values from --set and performs token exchange', async () => {
        mockTokenResponse({ access_token: 'tok_123', expires_in: 3600 });

        const provider = makeProvider();
        const result = await strategy.extract(provider, { setValues: SET_VALUES });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
            expect(result.value.credentials['access_token']).toBe('tok_123');
            expect(result.value.credentials['client_id']).toBe('my-id');
            expect(result.value.credentials['client_secret']).toBe('my-secret');
            expect(result.value.expiresAt).toBeDefined();
        }
    });

    it('returns error when token endpoint fails', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 401,
            text: async () => 'invalid_client',
        });

        const provider = makeProvider();
        const result = await strategy.extract(provider, { setValues: SET_VALUES });

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
            expect(result.error.message).toContain('401');
        }
    });

    it('returns error when response is not valid JSON', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            text: async () => '<!DOCTYPE html><html>error</html>',
        });

        const provider = makeProvider();
        const result = await strategy.extract(provider, { setValues: SET_VALUES });

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
            expect(result.error.message).toContain('invalid JSON');
        }
    });

    it('returns error when response has no access_token', async () => {
        mockTokenResponse({ token_type: 'bearer' });

        const provider = makeProvider();
        const result = await strategy.extract(provider, { setValues: SET_VALUES });

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
            expect(result.error.message).toContain('access_token');
        }
    });

    it('returns error when token_url is empty', async () => {
        const provider = makeProvider();
        const result = await strategy.extract(provider, {
            setValues: { client_id: 'x', client_secret: 'y', token_url: '' },
        });

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
            expect(result.error.message).toContain('token_url');
        }
    });

    it('sends correct body params and Basic auth header', async () => {
        let capturedBody = '';
        let capturedHeaders: Record<string, string> = {};
        mockFetch.mockImplementation(async (_url: string, opts: any) => {
            capturedBody = opts.body;
            capturedHeaders = opts.headers;
            return { ok: true, text: async () => JSON.stringify({ access_token: 'tok' }) };
        });

        const provider = makeProvider();
        await strategy.extract(provider, { setValues: SET_VALUES });

        const params = new URLSearchParams(capturedBody);
        expect(params.get('grant_type')).toBe('client_credentials');
        expect(params.get('scope')).toBe('read write');
        expect(params.has('client_id')).toBe(false);
        expect(params.has('client_secret')).toBe(false);

        const expectedBasic = Buffer.from('my-id:my-secret').toString('base64');
        expect(capturedHeaders['Authorization']).toBe(`Basic ${expectedBasic}`);
    });

    it('omits expiresAt when expires_in is not in response', async () => {
        mockTokenResponse({ access_token: 'tok_no_exp' });

        const provider = makeProvider();
        const result = await strategy.extract(provider, { setValues: SET_VALUES });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
            expect(result.value.expiresAt).toBeUndefined();
        }
    });

    it('omits scope param when scopes array is empty', async () => {
        let capturedBody = '';
        mockFetch.mockImplementation(async (_url: string, opts: any) => {
            capturedBody = opts.body;
            return { ok: true, text: async () => JSON.stringify({ access_token: 'tok' }) };
        });

        const provider = makeProvider({
            exchange: { grant_type: 'client_credentials', scopes: [], as: 'access_token' },
        });
        await strategy.extract(provider, { setValues: SET_VALUES });

        const params = new URLSearchParams(capturedBody);
        expect(params.has('scope')).toBe(false);
    });
});
