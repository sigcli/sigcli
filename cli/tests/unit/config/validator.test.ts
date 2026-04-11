import { describe, it, expect } from 'vitest';
import { validateConfig, buildStrategyConfig } from '../../../src/config/validator.js';
import { isOk, isErr } from '../../../src/core/result.js';

/**
 * Helper: returns a minimal valid raw config object.
 * Tests can override individual sections/fields via spread.
 */
function validRawConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        browser: { browserDataDir: '/tmp/browser-data', channel: 'chrome' },
        storage: { credentialsDir: '/tmp/credentials' },
        providers: {
            github: {
                domains: ['github.com'],
                entryUrl: 'https://github.com/',
                strategy: 'cookie',
            },
        },
        ...overrides,
    };
}

describe('validateConfig', () => {
    // ---- happy path ----

    it('accepts a valid complete config', () => {
        const result = validateConfig(validRawConfig());
        expect(isOk(result)).toBe(true);
        if (result.ok) {
            expect(result.value.browser.browserDataDir).toBe('/tmp/browser-data');
            expect(result.value.storage.credentialsDir).toBe('/tmp/credentials');
            expect(result.value.providers.github.strategy).toBe('cookie');
            expect(result.value.providers.github.domains).toEqual(['github.com']);
        }
    });

    it('accepts config with different browser channel', () => {
        const result = validateConfig(
            validRawConfig({
                browser: {
                    browserDataDir: '/tmp/bd',
                    channel: 'msedge',
                },
            }),
        );
        expect(isOk(result)).toBe(true);
        if (result.ok) {
            expect(result.value.browser.channel).toBe('msedge');
        }
    });

    it('returns error when browser.channel is missing', () => {
        const result = validateConfig(
            validRawConfig({
                browser: { browserDataDir: '/tmp/bd' },
            }),
        );
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('browser.channel');
        }
    });

    it('accepts config with remotes section', () => {
        const result = validateConfig(
            validRawConfig({
                remotes: {
                    dev: {
                        type: 'ssh',
                        host: 'dev.example.com',
                        user: 'alice',
                        path: '/home/alice/.signet',
                        sshKey: '~/.ssh/id_ed25519',
                    },
                },
            }),
        );
        expect(isOk(result)).toBe(true);
        if (result.ok) {
            expect(result.value.remotes).toBeDefined();
            expect(result.value.remotes!.dev.host).toBe('dev.example.com');
            expect(result.value.remotes!.dev.user).toBe('alice');
            expect(result.value.remotes!.dev.path).toBe('/home/alice/.signet');
            expect(result.value.remotes!.dev.sshKey).toBe('~/.ssh/id_ed25519');
        }
    });

    it('omits remotes when section is not present', () => {
        const result = validateConfig(validRawConfig());
        expect(isOk(result)).toBe(true);
        if (result.ok) {
            expect(result.value.remotes).toBeUndefined();
        }
    });

    it('parses multiple providers', () => {
        const result = validateConfig(
            validRawConfig({
                providers: {
                    github: {
                        domains: ['github.com'],
                        entryUrl: 'https://github.com/',
                        strategy: 'cookie',
                    },
                    api: {
                        domains: ['api.example.com'],
                        entryUrl: 'https://api.example.com/',
                        strategy: 'api-token',
                        config: { headerName: 'X-Key' },
                    },
                },
            }),
        );
        expect(isOk(result)).toBe(true);
        if (result.ok) {
            expect(Object.keys(result.value.providers)).toHaveLength(2);
            expect(result.value.providers.api.config).toEqual({ headerName: 'X-Key' });
        }
    });

    // ---- browser section errors ----

    it('returns error when browser section is missing', () => {
        const raw = validRawConfig();
        delete raw.browser;
        const result = validateConfig(raw);
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.code).toBe('CONFIG_ERROR');
            expect(result.error.message).toContain('Missing required section: "browser"');
        }
    });

    it('returns error when browser is not an object', () => {
        const result = validateConfig(validRawConfig({ browser: 'bad' }));
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('Missing required section: "browser"');
        }
    });

    it('returns error when browser.browserDataDir is missing', () => {
        const result = validateConfig(validRawConfig({ browser: {} }));
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('browser.browserDataDir');
        }
    });

    it('returns error when browser.browserDataDir is empty string', () => {
        const result = validateConfig(validRawConfig({ browser: { browserDataDir: '  ' } }));
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('browser.browserDataDir');
        }
    });

    // ---- storage section errors ----

    it('returns error when storage section is missing', () => {
        const raw = validRawConfig();
        delete raw.storage;
        const result = validateConfig(raw);
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('Missing required section: "storage"');
        }
    });

    it('returns error when storage is not an object', () => {
        const result = validateConfig(validRawConfig({ storage: 42 }));
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('Missing required section: "storage"');
        }
    });

    it('returns error when storage.credentialsDir is missing', () => {
        const result = validateConfig(validRawConfig({ storage: {} }));
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('storage.credentialsDir');
        }
    });

    it('returns error when storage.credentialsDir is empty string', () => {
        const result = validateConfig(validRawConfig({ storage: { credentialsDir: '' } }));
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('storage.credentialsDir');
        }
    });

    // ---- providers section errors ----

    it('accepts config when providers section is missing (zero providers)', () => {
        const raw = validRawConfig();
        delete raw.providers;
        const result = validateConfig(raw);
        expect(isOk(result)).toBe(true);
        if (result.ok) {
            expect(Object.keys(result.value.providers)).toHaveLength(0);
        }
    });

    it('accepts config when providers is null (YAML comment-only section)', () => {
        const result = validateConfig(validRawConfig({ providers: null }));
        expect(isOk(result)).toBe(true);
        if (result.ok) {
            expect(Object.keys(result.value.providers)).toHaveLength(0);
        }
    });

    it('returns error when providers is not an object', () => {
        const result = validateConfig(validRawConfig({ providers: 'nope' }));
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('"providers" must be an object');
        }
    });

    it('returns error when a provider entry is not an object', () => {
        const result = validateConfig(
            validRawConfig({
                providers: { bad: 'not-an-object' },
            }),
        );
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('Provider "bad": must be an object');
        }
    });

    it('returns error when provider is missing domains', () => {
        const result = validateConfig(
            validRawConfig({
                providers: {
                    noDomains: { strategy: 'cookie' },
                },
            }),
        );
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('Provider "noDomains"');
            expect(result.error.message).toContain('domains');
        }
    });

    it('returns error when provider has empty domains array', () => {
        const result = validateConfig(
            validRawConfig({
                providers: {
                    empty: { domains: [], strategy: 'cookie' },
                },
            }),
        );
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('Provider "empty"');
            expect(result.error.message).toContain('domains');
            expect(result.error.message).toContain('non-empty');
        }
    });

    it('returns error when domains contains non-string values', () => {
        const result = validateConfig(
            validRawConfig({
                providers: {
                    badDomains: { domains: [123], strategy: 'cookie' },
                },
            }),
        );
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('domains must be strings');
        }
    });

    it('returns error when provider has unknown strategy', () => {
        const result = validateConfig(
            validRawConfig({
                providers: {
                    badStrategy: { domains: ['example.com'], strategy: 'magic' },
                },
            }),
        );
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid strategy "magic"');
            expect(result.error.message).toContain('cookie');
            expect(result.error.message).toContain('oauth2');
            expect(result.error.message).toContain('api-token');
            expect(result.error.message).toContain('basic');
        }
    });

    it('returns error when provider is missing strategy', () => {
        const result = validateConfig(
            validRawConfig({
                providers: {
                    noStrategy: { domains: ['example.com'] },
                },
            }),
        );
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('Provider "noStrategy"');
            expect(result.error.message).toContain('strategy');
        }
    });

    // ---- strategy-specific config validation ----

    it('returns error when provider has non-boolean forceVisible', () => {
        const result = validateConfig(
            validRawConfig({
                providers: {
                    bad: {
                        domains: ['x.com'],
                        entryUrl: 'https://x.com/',
                        strategy: 'cookie',
                        forceVisible: 'yes',
                    },
                },
            }),
        );
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('forceVisible must be a boolean');
        }
    });

    it('accepts forceVisible as boolean at provider level', () => {
        const result = validateConfig(
            validRawConfig({
                providers: {
                    xhs: {
                        domains: ['x.com'],
                        entryUrl: 'https://x.com/',
                        strategy: 'cookie',
                        forceVisible: true,
                    },
                },
            }),
        );
        expect(isOk(result)).toBe(true);
        if (result.ok) {
            expect(result.value.providers.xhs.forceVisible).toBe(true);
        }
    });

    // ---- browser section: new flow fields ----

    it('returns error when browser.headlessTimeout is not a number', () => {
        const result = validateConfig(
            validRawConfig({
                browser: { browserDataDir: '/tmp/bd', channel: 'chrome', headlessTimeout: 'fast' },
            }),
        );
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('browser.headlessTimeout must be a number');
        }
    });

    it('returns error when browser.visibleTimeout is not a number', () => {
        const result = validateConfig(
            validRawConfig({
                browser: { browserDataDir: '/tmp/bd', channel: 'chrome', visibleTimeout: true },
            }),
        );
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('browser.visibleTimeout must be a number');
        }
    });

    it('returns error when browser.waitUntil is invalid', () => {
        const result = validateConfig(
            validRawConfig({
                browser: { browserDataDir: '/tmp/bd', channel: 'chrome', waitUntil: 'never' },
            }),
        );
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('browser.waitUntil must be one of');
        }
    });

    it('accepts valid browser flow fields in browser section', () => {
        const result = validateConfig(
            validRawConfig({
                browser: {
                    browserDataDir: '/tmp/bd',
                    channel: 'chrome',
                    headlessTimeout: 30000,
                    visibleTimeout: 120000,
                    waitUntil: 'networkidle',
                },
            }),
        );
        expect(isOk(result)).toBe(true);
        if (result.ok) {
            expect(result.value.browser.headlessTimeout).toBe(30000);
            expect(result.value.browser.visibleTimeout).toBe(120000);
            expect(result.value.browser.waitUntil).toBe('networkidle');
        }
    });

    it('returns error when cookie config contains oauth2-only fields', () => {
        const result = validateConfig(
            validRawConfig({
                providers: {
                    bad: {
                        domains: ['x.com'],
                        entryUrl: 'https://x.com/',
                        strategy: 'cookie',
                        config: { tokenEndpoint: 'https://token' },
                    },
                },
            }),
        );
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('tokenEndpoint');
            expect(result.error.message).toContain('not valid for strategy "cookie"');
        }
    });

    it('returns error when oauth2 config contains cookie-only fields', () => {
        const result = validateConfig(
            validRawConfig({
                providers: {
                    bad: {
                        domains: ['x.com'],
                        entryUrl: 'https://x.com/',
                        strategy: 'oauth2',
                        config: { ttl: '1h' },
                    },
                },
            }),
        );
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('ttl');
            expect(result.error.message).toContain('not valid for strategy "oauth2"');
        }
    });

    // Note: browser flow fields (forceVisible, headlessTimeout, visibleTimeout, waitUntil) have been
    // moved out of strategy config. forceVisible is now a provider-level field, and timeouts/waitUntil
    // are in the global browser section. Unknown fields in strategy config are silently ignored.

    // ---- remotes validation ----

    it('returns error when remotes is not an object', () => {
        const result = validateConfig(validRawConfig({ remotes: 'bad' }));
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('"remotes" must be an object');
        }
    });

    it('returns error when remote entry is not an object', () => {
        const result = validateConfig(validRawConfig({ remotes: { dev: 42 } }));
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('Remote "dev": must be an object');
        }
    });

    it('returns error when remote type is not ssh', () => {
        const result = validateConfig(
            validRawConfig({
                remotes: { dev: { type: 'ftp', host: 'example.com' } },
            }),
        );
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('only type "ssh" is supported');
        }
    });

    it('returns error when remote is missing host', () => {
        const result = validateConfig(
            validRawConfig({
                remotes: { dev: { type: 'ssh' } },
            }),
        );
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('missing required field "host"');
        }
    });

    // ---- multiple errors aggregated ----

    it('aggregates multiple validation errors into a single error', () => {
        const raw = {
            // missing browser and storage entirely
            providers: {
                bad: { strategy: 'unknown' },
            },
        };
        const result = validateConfig(raw);
        expect(isErr(result)).toBe(true);
        if (!result.ok) {
            expect(result.error.message).toContain('Missing required section: "browser"');
            expect(result.error.message).toContain('Missing required section: "storage"');
            expect(result.error.message).toContain('Provider "bad"');
        }
    });

    // ---- provider entry parsing ----

    it('parses optional provider fields (name, entryUrl, acceptedCredentialTypes, xHeaders)', () => {
        const result = validateConfig(
            validRawConfig({
                providers: {
                    full: {
                        name: 'Full Provider',
                        domains: ['full.example.com'],
                        entryUrl: 'https://full.example.com/login',
                        strategy: 'oauth2',
                        config: { clientId: 'abc', scopes: ['openid'] },
                        acceptedCredentialTypes: ['bearer'],
                        setupInstructions: 'Go to settings',
                        xHeaders: [{ name: 'X-Custom', pattern: '.*' }],
                    },
                },
            }),
        );
        expect(isOk(result)).toBe(true);
        if (result.ok) {
            const p = result.value.providers.full;
            expect(p.name).toBe('Full Provider');
            expect(p.entryUrl).toBe('https://full.example.com/login');
            expect(p.acceptedCredentialTypes).toEqual(['bearer']);
            expect(p.setupInstructions).toBe('Go to settings');
            expect(p.xHeaders).toEqual([{ name: 'X-Custom', pattern: '.*' }]);
        }
    });
});

describe('buildStrategyConfig', () => {
    // ---- cookie strategy ----

    it('builds cookie strategy config with all fields', () => {
        const result = buildStrategyConfig('cookie', {
            ttl: '24h',
            requiredCookies: ['sid', 'token'],
        });
        expect(result).toEqual({
            strategy: 'cookie',
            ttl: '24h',
            requiredCookies: ['sid', 'token'],
        });
    });

    it('builds cookie strategy config with defaults (no config object)', () => {
        const result = buildStrategyConfig('cookie');
        expect(result).toEqual({ strategy: 'cookie' });
    });

    it('builds cookie strategy config with empty config object', () => {
        const result = buildStrategyConfig('cookie', {});
        expect(result).toEqual({ strategy: 'cookie' });
    });

    // ---- oauth2 strategy ----

    it('builds oauth2 strategy config with all fields', () => {
        const result = buildStrategyConfig('oauth2', {
            tokenEndpoint: 'https://auth.example.com/token',
            clientId: 'my-client',
            scopes: ['openid', 'profile'],
            audiences: ['https://api.example.com'],
        });
        expect(result).toEqual({
            strategy: 'oauth2',
            tokenEndpoint: 'https://auth.example.com/token',
            clientId: 'my-client',
            scopes: ['openid', 'profile'],
            audiences: ['https://api.example.com'],
        });
    });

    it('builds oauth2 strategy config with defaults', () => {
        const result = buildStrategyConfig('oauth2');
        expect(result).toEqual({ strategy: 'oauth2' });
    });

    // ---- api-token strategy ----

    it('builds api-token strategy config with all fields', () => {
        const result = buildStrategyConfig('api-token', {
            headerName: 'X-API-Key',
            headerPrefix: 'Token',
            setupInstructions: 'Visit dashboard to generate key',
        });
        expect(result).toEqual({
            strategy: 'api-token',
            headerName: 'X-API-Key',
            headerPrefix: 'Token',
            setupInstructions: 'Visit dashboard to generate key',
        });
    });

    it('builds api-token strategy config with defaults', () => {
        const result = buildStrategyConfig('api-token');
        expect(result).toEqual({ strategy: 'api-token' });
    });

    // ---- basic strategy ----

    it('builds basic strategy config with all fields', () => {
        const result = buildStrategyConfig('basic', {
            setupInstructions: 'Use LDAP credentials',
        });
        expect(result).toEqual({
            strategy: 'basic',
            setupInstructions: 'Use LDAP credentials',
        });
    });

    it('builds basic strategy config with defaults', () => {
        const result = buildStrategyConfig('basic');
        expect(result).toEqual({ strategy: 'basic' });
    });

    // ---- ignores wrong-typed values ----

    it('ignores fields with wrong types (non-string ttl, non-array requiredCookies)', () => {
        const result = buildStrategyConfig('cookie', {
            ttl: 123, // should be string, gets ignored
            requiredCookies: 'sid', // should be array, gets ignored
        });
        expect(result).toEqual({ strategy: 'cookie' });
    });

    it('ignores fields with wrong types for api-token', () => {
        const result = buildStrategyConfig('api-token', {
            headerName: 42, // should be string, gets ignored
            headerPrefix: true, // should be string, gets ignored
        });
        expect(result).toEqual({ strategy: 'api-token' });
    });

    it('ignores fields with wrong types for oauth2', () => {
        const result = buildStrategyConfig('oauth2', {
            tokenEndpoint: 123, // should be string, gets ignored
            clientId: false, // should be string, gets ignored
            scopes: 'openid', // should be array, gets ignored
            audiences: 'aud', // should be array, gets ignored
        });
        expect(result).toEqual({ strategy: 'oauth2' });
    });
});
