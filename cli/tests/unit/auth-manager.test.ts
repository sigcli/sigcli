/**
 * AuthManager wiring tests.
 *
 * Focuses on the paths where AuthManager.create composes optional pieces of
 * config — currently: the idps section may be omitted entirely.
 */

import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthManager } from '../../src/auth-manager.js';
import type { SigConfig } from '../../src/config/schema.js';
import { createNoopLogger } from '../../src/utils/logger.js';

// Deterministic encryption key so AuthManager.create doesn't touch the real
// ~/.sig/encryption.key.
const TEST_KEY = randomBytes(32);
vi.mock('../../src/crypto/encryption.js', async () => {
    const actual = await vi.importActual<typeof import('../../src/crypto/encryption.js')>(
        '../../src/crypto/encryption.js',
    );
    return {
        ...actual,
        loadEncryptionKey: vi.fn(async () => TEST_KEY),
    };
});

// Redirect ~/.sig under a per-test tmp dir.
let tmpHome: string;
vi.mock('node:os', async () => {
    const actual = await vi.importActual<typeof import('node:os')>('node:os');
    return {
        ...actual,
        default: { ...actual, homedir: () => tmpHome },
        homedir: () => tmpHome,
    };
});

function baseConfig(): SigConfig {
    return <SigConfig>{
        mode: 'browser',
        browser: {
            browserDataDir: '/tmp/test-browser-data',
            execPath: '',
            headlessTimeout: 20_000,
            visibleTimeout: 120_000,
        },
        storage: {
            credentialsDir: path.join(tmpHome, 'creds'),
        },
        providers: {},
    };
}

describe('AuthManager.create — idps wiring', () => {
    beforeEach(async () => {
        tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'sig-auth-mgr-'));
    });

    afterEach(async () => {
        await fs.rm(tmpHome, { recursive: true, force: true });
    });

    it('exposes an empty IdP registry when config has no idps section', async () => {
        const config = baseConfig();
        // Sanity — the omitted section is the case under test.
        expect(config.idps).toBeUndefined();

        const manager = await AuthManager.create(config, createNoopLogger());

        expect(manager.idps.list()).toEqual([]);
        expect(manager.idps.resolve('anything.com')).toBeNull();
    });

    it('threads totp.selectors from config through to IdpEntry.totp.selectors', async () => {
        // Write a real encrypted secret for the hostname so the IdpStore path
        // populates entry.totp with a secret. Only then are selectors attached.
        const { IdpStore } = await import('../../src/idps/idp-store.js');
        const store = new IdpStore(path.join(tmpHome, '.sig', 'idps'), TEST_KEY);
        await store.setSecret('idp.example.com', 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');

        const config = baseConfig();
        config.idps = {
            'idp.example.com': {
                label: 'primary',
                totp: {
                    selectors: {
                        input: ['#passcode-field'],
                        submit: ['button.confirm'],
                    },
                },
            },
        };

        const manager = await AuthManager.create(config, createNoopLogger());
        const entry = manager.idps.resolve('idp.example.com');

        expect(entry).not.toBeNull();
        expect(entry?.totp?.secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
        expect(entry?.totp?.selectors?.input).toEqual(['#passcode-field']);
        expect(entry?.totp?.selectors?.submit).toEqual(['button.confirm']);
    });
});
