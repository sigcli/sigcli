import { describe, expect, it } from 'vitest';

import type { ExtractedCredentials } from '../../../src/types/interfaces/strategy.js';
import { credentialToEnvVars } from '../../../src/utils/credential-env.js';

describe('credentialToEnvVars', () => {
    describe('bearer-like credentials (access_token)', () => {
        it('injects prefixed PROVIDER and ACCESS_TOKEN', () => {
            const cred: ExtractedCredentials = {
                access_token: 'eyJhbGciOiJSUzI1NiJ9',
            };
            const env = credentialToEnvVars(cred, 'my-chat', {});
            expect(env['SIG_MY_CHAT_PROVIDER']).toBe('my-chat');
            expect(env['SIG_MY_CHAT_ACCESS_TOKEN']).toBe('eyJhbGciOiJSUzI1NiJ9');
        });
    });

    describe('cookie-like credentials (session)', () => {
        it('injects SIG_MY_JIRA_SESSION as joined string', () => {
            const cred: ExtractedCredentials = {
                session: 'session=abc; d=xyz',
            };
            const env = credentialToEnvVars(cred, 'my-jira', {});
            expect(env['SIG_MY_JIRA_SESSION']).toBe('session=abc; d=xyz');
        });
    });

    describe('token credentials', () => {
        it('injects SIG_GITHUB_TOKEN', () => {
            const cred: ExtractedCredentials = {
                token: 'ghp_xxxx',
            };
            const env = credentialToEnvVars(cred, 'github', {});
            expect(env['SIG_GITHUB_TOKEN']).toBe('ghp_xxxx');
        });
    });

    describe('multiple extracted values', () => {
        it('maps all extracted keys to env vars', () => {
            const cred: ExtractedCredentials = {
                session: 'xoxd=xoxd-abc; session=sess-123',
                'xoxc-token': 'xoxc-xyz',
            };
            const env = credentialToEnvVars(cred, 'slack', {});
            expect(env['SIG_SLACK_SESSION']).toBe('xoxd=xoxd-abc; session=sess-123');
            expect(env['SIG_SLACK_XOXC_TOKEN']).toBe('xoxc-xyz');
            expect(env['SIG_SLACK_PROVIDER']).toBe('slack');
        });
    });

    describe('explicit prefix override', () => {
        it('uses custom prefix when provided', () => {
            const cred: ExtractedCredentials = {
                access_token: 'tok123',
            };
            const env = credentialToEnvVars(cred, 'some-provider', { prefix: 'CUSTOM' });
            expect(env['CUSTOM_ACCESS_TOKEN']).toBe('tok123');
            expect(env['CUSTOM_PROVIDER']).toBe('some-provider');
        });
    });

    describe('non-overlapping keys for different providers', () => {
        it('produces disjoint env var keys for two different providers', () => {
            const cred: ExtractedCredentials = { access_token: 'tok' };
            const env1 = credentialToEnvVars(cred, 'provider-a', {});
            const env2 = credentialToEnvVars(cred, 'provider-b', {});
            const keys1 = new Set(Object.keys(env1));
            const keys2 = new Set(Object.keys(env2));
            for (const k of keys1) {
                expect(keys2.has(k)).toBe(false);
            }
        });
    });

    describe('key normalization', () => {
        it('converts dashes to underscores and uppercases keys', () => {
            const cred: ExtractedCredentials = {
                'boot-data': 'xyz',
            };
            const env = credentialToEnvVars(cred, 'x', {});
            expect(env['SIG_X_BOOT_DATA']).toBe('xyz');
        });
    });
});
