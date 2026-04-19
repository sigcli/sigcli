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
        it('injects prefixed PROVIDER, CREDENTIAL_TYPE, TOKEN, AUTH_HEADER for bearer', () => {
            const cred: BearerCredential = {
                type: 'bearer',
                accessToken: 'eyJhbGciOiJSUzI1NiJ9',
            };
            const env = credentialToEnvVars(cred, 'my-chat', {});
            expect(env['SIG_MY_CHAT_PROVIDER']).toBe('my-chat');
            expect(env['SIG_MY_CHAT_CREDENTIAL_TYPE']).toBe('bearer');
            expect(env['SIG_MY_CHAT_TOKEN']).toBe('eyJhbGciOiJSUzI1NiJ9');
            expect(env['SIG_MY_CHAT_AUTH_HEADER']).toBe('Bearer eyJhbGciOiJSUzI1NiJ9');
        });
    });

    describe('cookie credential', () => {
        it('injects SIG_MY_JIRA_COOKIE as joined string and SIG_MY_JIRA_CREDENTIAL_TYPE', () => {
            const cred: CookieCredential = {
                type: 'cookie',
                cookies: [makeCookie('session', 'abc'), makeCookie('d', 'xyz')],
                obtainedAt: new Date().toISOString(),
            };
            const env = credentialToEnvVars(cred, 'my-jira', {});
            expect(env['SIG_MY_JIRA_COOKIE']).toBe('session=abc; d=xyz');
            expect(env['SIG_MY_JIRA_CREDENTIAL_TYPE']).toBe('cookie');
            expect(env['SIG_MY_JIRA_AUTH_HEADER']).toBeUndefined();
        });

        it('expands individual cookies when expandCookies=true', () => {
            const cred: CookieCredential = {
                type: 'cookie',
                cookies: [makeCookie('session', 'abc'), makeCookie('d', 'xyz')],
                obtainedAt: new Date().toISOString(),
            };
            const env = credentialToEnvVars(cred, 'x', { expandCookies: true });
            expect(env['SIG_X_COOKIE_SESSION']).toBe('abc');
            expect(env['SIG_X_COOKIE_D']).toBe('xyz');
        });

        it('does not expand cookies when expandCookies is not set', () => {
            const cred: CookieCredential = {
                type: 'cookie',
                cookies: [makeCookie('session', 'abc')],
                obtainedAt: new Date().toISOString(),
            };
            const env = credentialToEnvVars(cred, 'x', {});
            expect(env['SIG_X_COOKIE_SESSION']).toBeUndefined();
        });
    });

    describe('api-key credential', () => {
        it('injects SIG_GITHUB_API_KEY and SIG_GITHUB_AUTH_HEADER with prefix', () => {
            const cred: ApiKeyCredential = {
                type: 'api-key',
                key: 'ghp_xxxx',
                headerName: 'Authorization',
                headerPrefix: 'Bearer',
            };
            const env = credentialToEnvVars(cred, 'github', {});
            expect(env['SIG_GITHUB_API_KEY']).toBe('ghp_xxxx');
            expect(env['SIG_GITHUB_AUTH_HEADER']).toBe('Bearer ghp_xxxx');
            expect(env['SIG_GITHUB_CREDENTIAL_TYPE']).toBe('api-key');
        });

        it('injects SIG_MY_API_AUTH_HEADER without prefix when no headerPrefix', () => {
            const cred: ApiKeyCredential = {
                type: 'api-key',
                key: 'secret123',
                headerName: 'X-API-Key',
            };
            const env = credentialToEnvVars(cred, 'my-api', {});
            expect(env['SIG_MY_API_AUTH_HEADER']).toBe('secret123');
        });
    });

    describe('basic credential', () => {
        it('injects SIG_MY_API_USERNAME, SIG_MY_API_PASSWORD, SIG_MY_API_AUTH_HEADER as Basic base64', () => {
            const cred: BasicCredential = {
                type: 'basic',
                username: 'admin',
                password: 'secret',
            };
            const env = credentialToEnvVars(cred, 'my-api', {});
            expect(env['SIG_MY_API_USERNAME']).toBe('admin');
            expect(env['SIG_MY_API_PASSWORD']).toBe('secret');
            expect(env['SIG_MY_API_AUTH_HEADER']).toBe('Basic YWRtaW46c2VjcmV0');
            expect(env['SIG_MY_API_CREDENTIAL_TYPE']).toBe('basic');
        });
    });

    describe('xHeaders', () => {
        it('maps xHeaders to SIG_X_HEADER_<NAME> with dashes replaced by underscores', () => {
            const cred: CookieCredential = {
                type: 'cookie',
                cookies: [],
                obtainedAt: new Date().toISOString(),
                xHeaders: { 'x-csrf-token': 'abc123', 'x-api-version': 'v2' },
            };
            const env = credentialToEnvVars(cred, 'x', {});
            expect(env['SIG_X_HEADER_X_CSRF_TOKEN']).toBe('abc123');
            expect(env['SIG_X_HEADER_X_API_VERSION']).toBe('v2');
        });
    });

    describe('localStorage', () => {
        it('maps localStorage to SIG_X_LOCAL_<NAME> uppercased', () => {
            const cred: CookieCredential = {
                type: 'cookie',
                cookies: [],
                obtainedAt: new Date().toISOString(),
                localStorage: { token: 'xoxc-xxx', 'boot-data': 'xyz' },
            };
            const env = credentialToEnvVars(cred, 'x', {});
            expect(env['SIG_X_LOCAL_TOKEN']).toBe('xoxc-xxx');
            expect(env['SIG_X_LOCAL_BOOT_DATA']).toBe('xyz');
        });
    });

    describe('SIG_PROVIDER always set', () => {
        it('always includes SIG_TEST_PROVIDER_PROVIDER for any credential type', () => {
            const cred: BasicCredential = { type: 'basic', username: 'u', password: 'p' };
            const env = credentialToEnvVars(cred, 'test-provider', {});
            expect(env['SIG_TEST_PROVIDER_PROVIDER']).toBe('test-provider');
        });
    });

    describe('explicit prefix override', () => {
        it('uses custom prefix when provided', () => {
            const cred: BearerCredential = {
                type: 'bearer',
                accessToken: 'tok123',
            };
            const env = credentialToEnvVars(cred, 'some-provider', { prefix: 'CUSTOM' });
            expect(env['CUSTOM_TOKEN']).toBe('tok123');
            expect(env['CUSTOM_AUTH_HEADER']).toBe('Bearer tok123');
            expect(env['CUSTOM_PROVIDER']).toBe('some-provider');
            expect(env['CUSTOM_CREDENTIAL_TYPE']).toBe('bearer');
        });
    });

    describe('non-overlapping keys for different providers', () => {
        it('produces disjoint env var keys for two different providers', () => {
            const cred: BearerCredential = { type: 'bearer', accessToken: 'tok' };
            const env1 = credentialToEnvVars(cred, 'provider-a', {});
            const env2 = credentialToEnvVars(cred, 'provider-b', {});
            const keys1 = new Set(Object.keys(env1));
            const keys2 = new Set(Object.keys(env2));
            for (const k of keys1) {
                expect(keys2.has(k)).toBe(false);
            }
        });
    });
});
