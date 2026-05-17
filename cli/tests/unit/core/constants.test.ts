import { describe, expect, it } from 'vitest';

import {
    APP_NAME,
    APP_VERSION,
    AuthScheme,
    Command,
    CONFIG_FILENAME,
    CredentialTypeName,
    HttpHeader,
    LOGIN_URL_PATTERNS,
    ProxySubcommand,
    RemoteSubcommand,
    SIG_DIR,
    SyncSubcommand,
    WatchSubcommand,
} from '../../../src/types/constants.js';

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
            expect(Command.COMPLETION).toBe('completion');
            expect(Command.RUN).toBe('run');
            expect(Command.PROXY).toBe('proxy');
            expect(Command.HELP).toBe('help');
        });

        it('has exactly the expected number of commands', () => {
            expect(Object.keys(Command)).toHaveLength(17);
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
        it('has add, remove, and set-interval', () => {
            expect(WatchSubcommand.ADD).toBe('add');
            expect(WatchSubcommand.REMOVE).toBe('remove');
            expect(WatchSubcommand.SET_INTERVAL).toBe('set-interval');
        });

        it('has exactly 3 subcommands', () => {
            expect(Object.keys(WatchSubcommand)).toHaveLength(3);
        });
    });

    describe('ProxySubcommand', () => {
        it('has start, stop, status, and trust', () => {
            expect(ProxySubcommand.START).toBe('start');
            expect(ProxySubcommand.STOP).toBe('stop');
            expect(ProxySubcommand.STATUS).toBe('status');
            expect(ProxySubcommand.TRUST).toBe('trust');
        });

        it('has exactly 4 subcommands', () => {
            expect(Object.keys(ProxySubcommand)).toHaveLength(4);
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
            expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
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
