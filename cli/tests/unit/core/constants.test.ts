import { describe, it, expect } from 'vitest';
import {
    Command,
    RemoteSubcommand,
    SyncSubcommand,
    WatchSubcommand,
    WaitUntil,
    StrategyName,
    CredentialTypeName,
    BROWSER_REQUIRED_STRATEGIES,
    LOGIN_URL_PATTERNS,
    HttpHeader,
    AuthScheme,
    APP_NAME,
    APP_VERSION,
    SIG_DIR,
    CONFIG_FILENAME,
} from '../../../src/core/constants.js';
import type { WaitUntilValue } from '../../../src/core/constants.js';

describe('constants', () => {
    describe('Command', () => {
        it('contains all CLI commands', () => {
            expect(Command.INIT).toBe('init');
            expect(Command.DOCTOR).toBe('doctor');
            expect(Command.GET).toBe('get');
            expect(Command.LOGIN).toBe('login');
            expect(Command.REQUEST).toBe('request');
            expect(Command.STATUS).toBe('status');
            expect(Command.LOGOUT).toBe('logout');
            expect(Command.PROVIDERS).toBe('providers');
            expect(Command.REMOTE).toBe('remote');
            expect(Command.SYNC).toBe('sync');
            expect(Command.WATCH).toBe('watch');
            expect(Command.RENAME).toBe('rename');
            expect(Command.REMOVE).toBe('remove');
            expect(Command.HELP).toBe('help');
        });

        it('has exactly the expected number of commands', () => {
            expect(Object.keys(Command)).toHaveLength(15);
        });

        it('values are all lowercase strings', () => {
            for (const value of Object.values(Command)) {
                expect(value).toBe(value.toLowerCase());
                expect(typeof value).toBe('string');
            }
        });
    });

    describe('RemoteSubcommand', () => {
        it('has add, remove, and list', () => {
            expect(RemoteSubcommand.ADD).toBe('add');
            expect(RemoteSubcommand.REMOVE).toBe('remove');
            expect(RemoteSubcommand.LIST).toBe('list');
        });

        it('has exactly 3 subcommands', () => {
            expect(Object.keys(RemoteSubcommand)).toHaveLength(3);
        });
    });

    describe('SyncSubcommand', () => {
        it('has push and pull', () => {
            expect(SyncSubcommand.PUSH).toBe('push');
            expect(SyncSubcommand.PULL).toBe('pull');
        });

        it('has exactly 2 subcommands', () => {
            expect(Object.keys(SyncSubcommand)).toHaveLength(2);
        });
    });

    describe('WatchSubcommand', () => {
        it('has add, remove, list, start, and set-interval', () => {
            expect(WatchSubcommand.ADD).toBe('add');
            expect(WatchSubcommand.REMOVE).toBe('remove');
            expect(WatchSubcommand.LIST).toBe('list');
            expect(WatchSubcommand.START).toBe('start');
            expect(WatchSubcommand.SET_INTERVAL).toBe('set-interval');
        });

        it('has exactly 5 subcommands', () => {
            expect(Object.keys(WatchSubcommand)).toHaveLength(5);
        });
    });

    describe('WaitUntil', () => {
        it('has all page-load wait conditions', () => {
            expect(WaitUntil.LOAD).toBe('load');
            expect(WaitUntil.NETWORK_IDLE).toBe('networkidle');
            expect(WaitUntil.DOM_CONTENT_LOADED).toBe('domcontentloaded');
            expect(WaitUntil.COMMIT).toBe('commit');
        });

        it('has exactly 4 values', () => {
            expect(Object.keys(WaitUntil)).toHaveLength(4);
        });

        it('WaitUntilValue type accepts all WaitUntil values', () => {
            const load: WaitUntilValue = WaitUntil.LOAD;
            const idle: WaitUntilValue = WaitUntil.NETWORK_IDLE;
            const dom: WaitUntilValue = WaitUntil.DOM_CONTENT_LOADED;
            const commit: WaitUntilValue = WaitUntil.COMMIT;
            expect([load, idle, dom, commit]).toHaveLength(4);
        });
    });

    describe('StrategyName', () => {
        it('has all strategy types', () => {
            expect(StrategyName.COOKIE).toBe('cookie');
            expect(StrategyName.OAUTH2).toBe('oauth2');
            expect(StrategyName.API_TOKEN).toBe('api-token');
            expect(StrategyName.BASIC).toBe('basic');
        });

        it('has exactly 4 strategies', () => {
            expect(Object.keys(StrategyName)).toHaveLength(4);
        });
    });

    describe('CredentialTypeName', () => {
        it('has all credential types', () => {
            expect(CredentialTypeName.COOKIE).toBe('cookie');
            expect(CredentialTypeName.BEARER).toBe('bearer');
            expect(CredentialTypeName.API_KEY).toBe('api-key');
            expect(CredentialTypeName.BASIC).toBe('basic');
        });

        it('has exactly 4 types', () => {
            expect(Object.keys(CredentialTypeName)).toHaveLength(4);
        });
    });

    describe('BROWSER_REQUIRED_STRATEGIES', () => {
        it('is a Set containing cookie and oauth2', () => {
            expect(BROWSER_REQUIRED_STRATEGIES).toBeInstanceOf(Set);
            expect(BROWSER_REQUIRED_STRATEGIES.has('cookie')).toBe(true);
            expect(BROWSER_REQUIRED_STRATEGIES.has('oauth2')).toBe(true);
        });

        it('does not contain non-browser strategies', () => {
            expect(BROWSER_REQUIRED_STRATEGIES.has('api-token')).toBe(false);
            expect(BROWSER_REQUIRED_STRATEGIES.has('basic')).toBe(false);
        });

        it('has exactly 2 entries', () => {
            expect(BROWSER_REQUIRED_STRATEGIES.size).toBe(2);
        });

        it('uses StrategyName constants as values', () => {
            expect(BROWSER_REQUIRED_STRATEGIES.has(StrategyName.COOKIE)).toBe(true);
            expect(BROWSER_REQUIRED_STRATEGIES.has(StrategyName.OAUTH2)).toBe(true);
        });
    });

    describe('LOGIN_URL_PATTERNS', () => {
        it('is a non-empty array', () => {
            expect(Array.isArray(LOGIN_URL_PATTERNS)).toBe(true);
            expect(LOGIN_URL_PATTERNS.length).toBeGreaterThan(0);
        });

        it('contains common login path segments', () => {
            expect(LOGIN_URL_PATTERNS).toContain('/login');
            expect(LOGIN_URL_PATTERNS).toContain('/signin');
            expect(LOGIN_URL_PATTERNS).toContain('/sign-in');
            expect(LOGIN_URL_PATTERNS).toContain('/auth');
            expect(LOGIN_URL_PATTERNS).toContain('/sso');
            expect(LOGIN_URL_PATTERNS).toContain('/oauth');
        });

        it('contains enterprise SSO patterns', () => {
            expect(LOGIN_URL_PATTERNS).toContain('/adfs/');
            expect(LOGIN_URL_PATTERNS).toContain('/saml/');
        });

        it('contains identity provider domains', () => {
            expect(LOGIN_URL_PATTERNS).toContain('login.microsoftonline.com');
            expect(LOGIN_URL_PATTERNS).toContain('accounts.google.com');
        });
    });

    describe('HttpHeader', () => {
        it('has standard HTTP header names', () => {
            expect(HttpHeader.AUTHORIZATION).toBe('Authorization');
            expect(HttpHeader.COOKIE).toBe('Cookie');
            expect(HttpHeader.CONTENT_TYPE).toBe('Content-Type');
            expect(HttpHeader.USER_AGENT).toBe('User-Agent');
        });

        it('has exactly 4 headers', () => {
            expect(Object.keys(HttpHeader)).toHaveLength(4);
        });
    });

    describe('AuthScheme', () => {
        it('has Bearer and Basic schemes', () => {
            expect(AuthScheme.BEARER).toBe('Bearer');
            expect(AuthScheme.BASIC).toBe('Basic');
        });

        it('has exactly 2 schemes', () => {
            expect(Object.keys(AuthScheme)).toHaveLength(2);
        });
    });

    describe('Application identity', () => {
        it('APP_NAME is "sig"', () => {
            expect(APP_NAME).toBe('sig');
        });

        it('APP_VERSION is a semver string', () => {
            expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
        });
    });

    describe('Configuration paths', () => {
        it('SIG_DIR is ".sig"', () => {
            expect(SIG_DIR).toBe('.sig');
        });

        it('CONFIG_FILENAME is "config.yaml"', () => {
            expect(CONFIG_FILENAME).toBe('config.yaml');
        });
    });
});
