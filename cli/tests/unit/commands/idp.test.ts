/**
 * Tests for `sig idp add|list|show|remove`.
 *
 * We isolate the command from the real filesystem by mocking:
 *   - `../config/document.js`   → in-memory YAML string
 *   - `../crypto/encryption.js` → deterministic 32-byte key, real encrypt/decrypt
 *   - `../utils/prompt.js`      → controlled promptSecret responses (unused here
 *                                 since we always pass --totp-secret in tests)
 *
 * `IdpStore` writes real encrypted files under a temp dir. To force it there we
 * mock `node:os`.homedir so `~/.sig/idps` resolves under tmpdir.
 */

import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import YAML from 'yaml';

import { runIdp } from '../../../src/commands/idp.js';

// ---------------------------------------------------------------------------
// Module mocks (must be declared before importing runIdp)
// ---------------------------------------------------------------------------

let currentYaml = '';

vi.mock('../../../src/config/document.js', () => ({
    loadDocument: vi.fn(async () => {
        if (!currentYaml) return new YAML.Document({});
        return YAML.parseDocument(currentYaml);
    }),
    saveDocument: vi.fn(async (doc: YAML.Document) => {
        currentYaml = doc.toString();
    }),
    loadRawContent: vi.fn(async () => currentYaml),
}));

const TEST_KEY = randomBytes(32);
vi.mock('../../../src/crypto/encryption.js', async () => {
    const actual = await vi.importActual<typeof import('../../../src/crypto/encryption.js')>(
        '../../../src/crypto/encryption.js',
    );
    return {
        ...actual,
        loadEncryptionKey: vi.fn(async () => TEST_KEY),
    };
});

// Redirect ~/.sig/idps under a per-test tmp dir by mocking os.homedir.
let tmpHome: string;
vi.mock('node:os', async () => {
    const actual = await vi.importActual<typeof import('node:os')>('node:os');
    return {
        ...actual,
        default: { ...actual, homedir: () => tmpHome },
        homedir: () => tmpHome,
    };
});

// ---------------------------------------------------------------------------

const VALID_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const INVALID_SECRET = '!!!not-base32!!!';

describe('sig idp', () => {
    let stderrChunks: string[];
    let stdoutChunks: string[];
    let originalExitCode: number | undefined;

    beforeEach(async () => {
        tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'sig-idp-cmd-'));
        currentYaml = '';
        vi.clearAllMocks();

        stderrChunks = [];
        stdoutChunks = [];
        originalExitCode = process.exitCode;
        process.exitCode = undefined;

        vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
            stderrChunks.push(String(chunk));
            return true;
        });
        vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
            stdoutChunks.push(String(chunk));
            return true;
        });
    });

    afterEach(async () => {
        process.exitCode = originalExitCode;
        vi.restoreAllMocks();
        await fs.rm(tmpHome, { recursive: true, force: true });
    });

    // -----------------------------------------------------------------------
    // add
    // -----------------------------------------------------------------------

    describe('add', () => {
        it('writes YAML metadata (no plaintext secret) and encrypted secret file', async () => {
            await runIdp(['add', 'idp.example.com'], { 'totp-secret': VALID_SECRET });

            // YAML metadata is present with no secret.
            expect(currentYaml).toContain('idps:');
            expect(currentYaml).toContain('idp.example.com');
            expect(currentYaml.includes(VALID_SECRET)).toBe(false);
            expect(currentYaml).not.toMatch(/secret:/);

            // Encrypted file exists under tmpHome/.sig/idps/.
            const idpFile = path.join(tmpHome, '.sig', 'idps', 'idp.example.com.json');
            const content = await fs.readFile(idpFile, 'utf-8');
            const parsed = JSON.parse(content);
            expect(parsed.encrypted).toBe(true);
            expect(parsed.algorithm).toBe('aes-256-gcm');
            expect(content.includes(VALID_SECRET)).toBe(false);
        });

        it('rejects an invalid base32 secret with a clean error and no writes', async () => {
            await runIdp(['add', 'idp.example.com'], { 'totp-secret': INVALID_SECRET });

            expect(process.exitCode).not.toBe(undefined);
            expect(process.exitCode).not.toBe(0);
            const stderr = stderrChunks.join('');
            expect(stderr.toLowerCase()).toContain('invalid totp secret');

            // No YAML entry
            expect(currentYaml).toBe('');
            // No encrypted file
            const idpDir = path.join(tmpHome, '.sig', 'idps');
            await expect(fs.readdir(idpDir)).rejects.toThrow();
        });

        it('normalizes whitespace in the provided secret before validation', async () => {
            // The RFC/valid secret split into groups of 4 with spaces (as most
            // authenticator apps display it).
            const withSpaces = 'GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ';
            await runIdp(['add', 'idp.example.com'], { 'totp-secret': withSpaces });

            // Success path: metadata written, no exit code set.
            expect(process.exitCode).toBeFalsy();
            expect(currentYaml).toContain('idp.example.com');
        });

        it('fails when hostname is missing', async () => {
            await runIdp(['add'], { 'totp-secret': VALID_SECRET });
            expect(process.exitCode).not.toBe(undefined);
            expect(process.exitCode).not.toBe(0);
            const stderr = stderrChunks.join('');
            expect(stderr).toContain('sig idp add');
        });
    });

    // -----------------------------------------------------------------------
    // list
    // -----------------------------------------------------------------------

    describe('list', () => {
        it('lists entries, redacts secrets, reports totp status', async () => {
            await runIdp(['add', 'idp.example.com'], { 'totp-secret': VALID_SECRET });
            stderrChunks.length = 0;
            stdoutChunks.length = 0;

            await runIdp(['list'], { format: 'json' });
            const output = stdoutChunks.join('') + stderrChunks.join('');
            expect(output.includes(VALID_SECRET)).toBe(false);
            expect(output).toContain('idp.example.com');
            expect(output).toContain('configured');
        });

        it('reports "No IdPs configured" when the registry is empty', async () => {
            await runIdp(['list'], {});
            const stderr = stderrChunks.join('');
            expect(stderr).toContain('No IdPs configured');
        });
    });

    // -----------------------------------------------------------------------
    // show
    // -----------------------------------------------------------------------

    describe('show', () => {
        it('shows metadata for a known hostname, redacting the secret', async () => {
            await runIdp(['add', 'idp.example.com'], { 'totp-secret': VALID_SECRET });
            stderrChunks.length = 0;
            stdoutChunks.length = 0;

            await runIdp(['show', 'idp.example.com'], {});
            const output = stdoutChunks.join('');
            expect(output.includes(VALID_SECRET)).toBe(false);
            expect(output).toContain('idp.example.com');
            expect(output).toContain('<redacted>');
        });

        it('errors when hostname is not configured', async () => {
            await runIdp(['show', 'nonexistent.example.com'], {});
            expect(process.exitCode).not.toBe(undefined);
            expect(process.exitCode).not.toBe(0);
            const stderr = stderrChunks.join('');
            expect(stderr).toContain('nonexistent.example.com');
            expect(stderr).toContain('not found');
        });
    });

    // -----------------------------------------------------------------------
    // remove
    // -----------------------------------------------------------------------

    describe('remove', () => {
        it('removes both the YAML entry and the encrypted secret file', async () => {
            await runIdp(['add', 'idp.example.com'], { 'totp-secret': VALID_SECRET });
            const idpFile = path.join(tmpHome, '.sig', 'idps', 'idp.example.com.json');
            await expect(fs.access(idpFile)).resolves.toBeUndefined();

            stderrChunks.length = 0;
            await runIdp(['remove', 'idp.example.com'], {});

            expect(currentYaml).not.toContain('idp.example.com');
            await expect(fs.access(idpFile)).rejects.toThrow();
        });

        it('reports "not found" when hostname is not in config but does not throw', async () => {
            await runIdp(['remove', 'nonexistent.example.com'], {});
            const stderr = stderrChunks.join('');
            expect(stderr).toContain('not found in config');
        });
    });
});
