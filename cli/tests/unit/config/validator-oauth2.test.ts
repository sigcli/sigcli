import { describe, expect, it } from 'vitest';

import { validateConfig } from '../../../src/config/validator.js';
import { isErr, isOk } from '../../../src/types/index.js';

const BASE_CONFIG = {
    browser: { browserDataDir: '/tmp/.sig/browser' },
    storage: { credentialsDir: '/tmp/.sig/credentials' },
};

function makeConfig(providers: Record<string, unknown>) {
    return { ...BASE_CONFIG, providers };
}

describe('validateConfig — oauth2 strategy', () => {
    describe('valid oauth2 provider', () => {
        it('passes with strategy=oauth2 and tokenUrl present', () => {
            const config = makeConfig({
                'my-api': {
                    domains: ['api.example.com'],
                    strategy: 'oauth2',
                    oauth2: { tokenUrl: 'https://auth.example.com/oauth/token' },
                    apply: [
                        { in: 'header', name: 'Authorization', value: 'Bearer ${access_token}' },
                    ],
                },
            });
            expect(isOk(validateConfig(config))).toBe(true);
        });

        it('passes without entryUrl for oauth2 provider', () => {
            const config = makeConfig({
                'my-api': {
                    domains: ['api.example.com'],
                    strategy: 'oauth2',
                    oauth2: { tokenUrl: 'https://auth.example.com/oauth/token' },
                    apply: [
                        { in: 'header', name: 'Authorization', value: 'Bearer ${access_token}' },
                    ],
                },
            });
            const result = validateConfig(config);
            expect(isOk(result)).toBe(true);
        });

        it('passes without extract array for oauth2 provider', () => {
            const config = makeConfig({
                'my-api': {
                    domains: ['api.example.com'],
                    strategy: 'oauth2',
                    oauth2: { tokenUrl: 'https://auth.example.com/oauth/token' },
                    apply: [
                        { in: 'header', name: 'Authorization', value: 'Bearer ${access_token}' },
                    ],
                },
            });
            const result = validateConfig(config);
            expect(isOk(result)).toBe(true);
        });

        it('passes with optional scopes in oauth2 config', () => {
            const config = makeConfig({
                'my-api': {
                    domains: ['api.example.com'],
                    strategy: 'oauth2',
                    oauth2: {
                        tokenUrl: 'https://auth.example.com/oauth/token',
                        scopes: ['read', 'write'],
                    },
                    apply: [
                        { in: 'header', name: 'Authorization', value: 'Bearer ${access_token}' },
                    ],
                },
            });
            expect(isOk(validateConfig(config))).toBe(true);
        });

        it('parses oauth2 block into config correctly', () => {
            const config = makeConfig({
                'my-api': {
                    domains: ['api.example.com'],
                    strategy: 'oauth2',
                    oauth2: {
                        tokenUrl: 'https://auth.example.com/oauth/token',
                        scopes: ['read'],
                    },
                    apply: [
                        { in: 'header', name: 'Authorization', value: 'Bearer ${access_token}' },
                    ],
                },
            });
            const result = validateConfig(config);
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                const entry = result.value.providers['my-api'];
                expect(entry.oauth2?.tokenUrl).toBe('https://auth.example.com/oauth/token');
                expect(entry.oauth2?.scopes).toEqual(['read']);
            }
        });
    });

    describe('invalid oauth2 provider', () => {
        it('fails when strategy=oauth2 but oauth2 section is missing', () => {
            const config = makeConfig({
                'my-api': {
                    domains: ['api.example.com'],
                    strategy: 'oauth2',
                    apply: [
                        { in: 'header', name: 'Authorization', value: 'Bearer ${access_token}' },
                    ],
                },
            });
            const result = validateConfig(config);
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message).toContain('oauth2');
                expect(result.error.message).toContain('tokenUrl');
            }
        });

        it('fails when strategy=oauth2 but tokenUrl is empty string', () => {
            const config = makeConfig({
                'my-api': {
                    domains: ['api.example.com'],
                    strategy: 'oauth2',
                    oauth2: { tokenUrl: '' },
                    apply: [
                        { in: 'header', name: 'Authorization', value: 'Bearer ${access_token}' },
                    ],
                },
            });
            const result = validateConfig(config);
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message).toContain('oauth2.tokenUrl');
            }
        });

        it('fails when strategy=oauth2 but oauth2 is not an object', () => {
            const config = makeConfig({
                'my-api': {
                    domains: ['api.example.com'],
                    strategy: 'oauth2',
                    oauth2: 'https://auth.example.com/oauth/token',
                    apply: [
                        { in: 'header', name: 'Authorization', value: 'Bearer ${access_token}' },
                    ],
                },
            });
            const result = validateConfig(config);
            expect(isErr(result)).toBe(true);
        });
    });

    describe('non-oauth2 strategies still require entryUrl and extract', () => {
        it('fails for browser strategy without entryUrl', () => {
            const config = makeConfig({
                myapp: {
                    domains: ['example.com'],
                    strategy: 'browser',
                    extract: [{ from: 'cookies', as: 'session', match: '*' }],
                    apply: [{ in: 'header', name: 'Cookie', value: '${session}' }],
                },
            });
            const result = validateConfig(config);
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message).toContain('entryUrl');
            }
        });

        it('fails for browser strategy without extract', () => {
            const config = makeConfig({
                myapp: {
                    domains: ['example.com'],
                    entryUrl: 'https://example.com/',
                    strategy: 'browser',
                    apply: [{ in: 'header', name: 'Cookie', value: '${session}' }],
                },
            });
            const result = validateConfig(config);
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message).toContain('extract');
            }
        });
    });

    it('accepts oauth2 as a valid strategy value', () => {
        const config = makeConfig({
            'my-api': {
                domains: ['api.example.com'],
                strategy: 'oauth2',
                oauth2: { tokenUrl: 'https://auth.example.com/oauth/token' },
                apply: [{ in: 'header', name: 'Authorization', value: 'Bearer ${access_token}' }],
            },
        });
        const result = validateConfig(config);
        expect(isOk(result)).toBe(true);
    });

    it('rejects unknown strategy', () => {
        const config = makeConfig({
            myapp: {
                domains: ['example.com'],
                entryUrl: 'https://example.com/',
                strategy: 'magic',
                extract: [{ from: 'cookies', as: 'session', match: '*' }],
                apply: [{ in: 'header', name: 'Cookie', value: '${session}' }],
            },
        });
        const result = validateConfig(config);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
            expect(result.error.message).toContain('invalid strategy');
        }
    });
});
