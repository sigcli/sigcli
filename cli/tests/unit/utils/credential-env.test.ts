import { describe, it, expect } from 'vitest';
import { credentialToEnvVars } from '../../../src/utils/credential-env.js';
import type {
    CookieCredential,
    BearerCredential,
    ApiKeyCredential,
    BasicCredential,
    Cookie,
} from '../../../src/core/types.js';

function makeCookie(name: string, value: string): Cookie {
    return {
        name,
        value,
        domain: 'example.com',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
    };
}

describe('credentialToEnvVars', () => {
    describe('bearer credential', () => {
        it('injects SIG_PROVIDER, SIG_CREDENTIAL_TYPE, SIG_TOKEN, SIG_AUTH_HEADER', () => {
            const cred: BearerCredential = {
                type: 'bearer',
                accessToken: 'eyJhbGciOiJSUzI1NiJ9',
            };
            const env = credentialToEnvVars(cred, 'ms-teams', {});
            expect(env['SIG_PROVIDER']).toBe('ms-teams');
            expect(env['SIG_CREDENTIAL_TYPE']).toBe('bearer');
            expect(env['SIG_TOKEN']).toBe('eyJhbGciOiJSUzI1NiJ9');
            expect(env['SIG_AUTH_HEADER']).toBe('Bearer eyJhbGciOiJSUzI1NiJ9');
        });
    });

    describe('cookie credential', () => {
        it('injects SIG_COOKIE as joined string and SIG_CREDENTIAL_TYPE', () => {
            const cred: CookieCredential = {
                type: 'cookie',
                cookies: [makeCookie('session', 'abc'), makeCookie('d', 'xyz')],
                obtainedAt: new Date().toISOString(),
            };
            const env = credentialToEnvVars(cred, 'loki-orca', {});
            expect(env['SIG_COOKIE']).toBe('session=abc; d=xyz');
            expect(env['SIG_CREDENTIAL_TYPE']).toBe('cookie');
            expect(env['SIG_AUTH_HEADER']).toBeUndefined();
        });

        it('expands individual cookies when expandCookies=true', () => {
            const cred: CookieCredential = {
                type: 'cookie',
                cookies: [makeCookie('session', 'abc'), makeCookie('d', 'xyz')],
                obtainedAt: new Date().toISOString(),
            };
            const env = credentialToEnvVars(cred, 'x', { expandCookies: true });
            expect(env['SIG_COOKIE_SESSION']).toBe('abc');
            expect(env['SIG_COOKIE_D']).toBe('xyz');
        });

        it('does not expand cookies when expandCookies is not set', () => {
            const cred: CookieCredential = {
                type: 'cookie',
                cookies: [makeCookie('session', 'abc')],
                obtainedAt: new Date().toISOString(),
            };
            const env = credentialToEnvVars(cred, 'x', {});
            expect(env['SIG_COOKIE_SESSION']).toBeUndefined();
        });
    });

    describe('api-key credential', () => {
        it('injects SIG_API_KEY and SIG_AUTH_HEADER with prefix', () => {
            const cred: ApiKeyCredential = {
                type: 'api-key',
                key: 'ghp_xxxx',
                headerName: 'Authorization',
                headerPrefix: 'Bearer',
            };
            const env = credentialToEnvVars(cred, 'github', {});
            expect(env['SIG_API_KEY']).toBe('ghp_xxxx');
            expect(env['SIG_AUTH_HEADER']).toBe('Bearer ghp_xxxx');
            expect(env['SIG_CREDENTIAL_TYPE']).toBe('api-key');
        });

        it('injects SIG_AUTH_HEADER without prefix when no headerPrefix', () => {
            const cred: ApiKeyCredential = {
                type: 'api-key',
                key: 'secret123',
                headerName: 'X-API-Key',
            };
            const env = credentialToEnvVars(cred, 'my-api', {});
            expect(env['SIG_AUTH_HEADER']).toBe('secret123');
        });
    });

    describe('basic credential', () => {
        it('injects SIG_USERNAME, SIG_PASSWORD, SIG_AUTH_HEADER as Basic base64', () => {
            const cred: BasicCredential = {
                type: 'basic',
                username: 'admin',
                password: 'secret',
            };
            const env = credentialToEnvVars(cred, 'my-api', {});
            expect(env['SIG_USERNAME']).toBe('admin');
            expect(env['SIG_PASSWORD']).toBe('secret');
            expect(env['SIG_AUTH_HEADER']).toBe('Basic YWRtaW46c2VjcmV0');
            expect(env['SIG_CREDENTIAL_TYPE']).toBe('basic');
        });
    });

    describe('xHeaders', () => {
        it('maps xHeaders to SIG_HEADER_<NAME> with dashes replaced by underscores', () => {
            const cred: CookieCredential = {
                type: 'cookie',
                cookies: [],
                obtainedAt: new Date().toISOString(),
                xHeaders: { 'x-csrf-token': 'abc123', 'x-api-version': 'v2' },
            };
            const env = credentialToEnvVars(cred, 'x', {});
            expect(env['SIG_HEADER_X_CSRF_TOKEN']).toBe('abc123');
            expect(env['SIG_HEADER_X_API_VERSION']).toBe('v2');
        });
    });

    describe('localStorage', () => {
        it('maps localStorage to SIG_LOCAL_<NAME> uppercased', () => {
            const cred: CookieCredential = {
                type: 'cookie',
                cookies: [],
                obtainedAt: new Date().toISOString(),
                localStorage: { token: 'xoxc-xxx', 'boot-data': 'xyz' },
            };
            const env = credentialToEnvVars(cred, 'x', {});
            expect(env['SIG_LOCAL_TOKEN']).toBe('xoxc-xxx');
            expect(env['SIG_LOCAL_BOOT_DATA']).toBe('xyz');
        });
    });

    describe('SIG_PROVIDER always set', () => {
        it('always includes SIG_PROVIDER for any credential type', () => {
            const cred: BasicCredential = { type: 'basic', username: 'u', password: 'p' };
            const env = credentialToEnvVars(cred, 'test-provider', {});
            expect(env['SIG_PROVIDER']).toBe('test-provider');
        });
    });
});
