import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ExtractedCredentials, ProviderConfig } from '../../src/types/index.js';
import { validateCredential } from '../../src/utils/credential-validator.js';

const provider: ProviderConfig = {
    id: 'sso-app',
    name: 'SSO App',
    domains: ['myapp.example.com'],
    entryUrl: 'https://myapp.example.com/',
    strategy: 'browser',
    extract: [{ from: 'cookies', as: 'session', match: 'JSESSIONID' }],
    apply: [{ in: 'header', name: 'Cookie', value: 'JSESSIONID=${session}' }],
};

const noEntryProvider: ProviderConfig = {
    id: 'no-entry',
    name: 'No Entry URL',
    domains: ['no-entry.example.com'],
    strategy: 'browser',
    extract: [{ from: 'cookies', as: 'session', match: 'token' }],
    apply: [{ in: 'header', name: 'Cookie', value: 'token=${session}' }],
};

const credentials: ExtractedCredentials = { session: 'abc123' };

describe('validateCredential — server-side session probe', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns status 200 and no login redirect for valid session', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, headers: new Headers() }));

        const result = await validateCredential(provider, credentials);
        expect(result.status).toBe(200);
        expect(result.isLoginRedirect).toBe(false);
    });

    it('detects login redirect (302 → /login)', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                status: 302,
                headers: new Headers({ location: 'https://idp.example.com/login?redirect=...' }),
            }),
        );

        const result = await validateCredential(provider, credentials);
        expect(result.status).toBe(302);
        expect(result.isLoginRedirect).toBe(true);
    });

    it('detects redirect to SSO/SAML endpoint', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                status: 301,
                headers: new Headers({ location: 'https://idp.example.com/saml/sso?...' }),
            }),
        );

        const result = await validateCredential(provider, credentials);
        expect(result.status).toBe(301);
        expect(result.isLoginRedirect).toBe(true);
    });

    it('returns 401 without flagging as login redirect', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401, headers: new Headers() }));

        const result = await validateCredential(provider, credentials);
        expect(result.status).toBe(401);
        expect(result.isLoginRedirect).toBe(false);
    });

    it('does not flag non-login redirect as login redirect', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                status: 302,
                headers: new Headers({ location: 'https://app.example.com/dashboard' }),
            }),
        );

        const result = await validateCredential(provider, credentials);
        expect(result.status).toBe(302);
        expect(result.isLoginRedirect).toBe(false);
    });

    it('returns null status on network error (graceful degradation)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

        const result = await validateCredential(provider, credentials);
        expect(result.status).toBeNull();
        expect(result.isLoginRedirect).toBe(false);
    });

    it('skips probe when provider has no entryUrl', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const providerNoUrl = {
            ...noEntryProvider,
            entryUrl: undefined,
        } as unknown as ProviderConfig;
        const result = await validateCredential(providerNoUrl, credentials);

        expect(result.status).toBeNull();
        expect(result.isLoginRedirect).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('applies credential headers from apply rules in the probe request', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ status: 200, headers: new Headers() });
        vi.stubGlobal('fetch', fetchMock);

        await validateCredential(provider, credentials);

        expect(fetchMock).toHaveBeenCalledWith(
            'https://myapp.example.com/',
            expect.objectContaining({
                method: 'GET',
                redirect: 'manual',
                headers: expect.objectContaining({ Cookie: 'JSESSIONID=abc123' }),
            }),
        );
    });
});
