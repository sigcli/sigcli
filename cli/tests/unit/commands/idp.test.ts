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

        // The `requireConfig()` guard checks that ~/.sig/config.yaml exists.
        // Tests here mock the YAML doc via document.js, so we create a
        // touch-file on disk to satisfy the existence check.
        await fs.mkdir(path.join(tmpHome, '.sig'), { recursive: true });
        await fs.writeFile(path.join(tmpHome, '.sig', 'config.yaml'), '', 'utf-8');

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

        it('refuses to write when ~/.sig/config.yaml is missing', async () => {
            // Remove the touch-file set up in beforeEach.
            await fs.rm(path.join(tmpHome, '.sig', 'config.yaml'), { force: true });

            await runIdp(['add', 'idp.example.com'], { 'totp-secret': VALID_SECRET });

            expect(process.exitCode).not.toBe(undefined);
            expect(process.exitCode).not.toBe(0);
            const stderr = stderrChunks.join('');
            expect(stderr).toContain('Config not found');
            expect(stderr).toContain('sig init');

            // YAML doc was never touched by the command.
            expect(currentYaml).toBe('');
            // No encrypted file, and the idps/ dir was never created.
            const idpDir = path.join(tmpHome, '.sig', 'idps');
            await expect(fs.readdir(idpDir)).rejects.toThrow();
        });

        it('rejects a short but alphabet-valid secret with a clean error', async () => {
            // 8 chars, all in base32 alphabet — otpauth would silently accept
            // this without isValidBase32.
            await runIdp(['add', 'idp.example.com'], { 'totp-secret': 'GEZDGNBV' });

            expect(process.exitCode).not.toBe(undefined);
            expect(process.exitCode).not.toBe(0);
            const stderr = stderrChunks.join('');
            expect(stderr.toLowerCase()).toContain('invalid totp secret');
            expect(stderr).toContain('at least 16');

            // No YAML write, no encrypted file.
            expect(currentYaml).toBe('');
            const idpDir = path.join(tmpHome, '.sig', 'idps');
            await expect(fs.readdir(idpDir)).rejects.toThrow();
        });

        it('preserves existing label when rotating the secret without --label', async () => {
            await runIdp(['add', 'idp.example.com'], {
                'totp-secret': VALID_SECRET,
                label: 'primary',
            });
            expect(currentYaml).toContain('label: primary');

            stderrChunks.length = 0;
            await runIdp(['add', 'idp.example.com'], { 'totp-secret': VALID_SECRET });

            // label survives the rotation
            expect(currentYaml).toContain('label: primary');
        });

        it('preserves hand-configured totp.selectors across a secret rotation', async () => {
            // Simulate a user who hand-edited config.yaml to add selectors.
            currentYaml = [
                'idps:',
                '  idp.example.com:',
                '    label: primary',
                '    totp:',
                '      selectors:',
                '        input:',
                '          - "#passcode-field"',
                '        submit:',
                '          - button.confirm',
                '',
            ].join('\n');

            await runIdp(['add', 'idp.example.com'], { 'totp-secret': VALID_SECRET });

            // Rotation must NOT drop the hand-configured selectors.
            expect(currentYaml).toContain('#passcode-field');
            expect(currentYaml).toContain('button.confirm');
            expect(currentYaml).toContain('label: primary');
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

    // -----------------------------------------------------------------------
    // import
    // -----------------------------------------------------------------------

    describe('import', () => {
        let importFile: string;

        beforeEach(async () => {
            importFile = path.join(tmpHome, 'authenticator.txt');
        });

        it('imports valid otpauth URIs from a file', async () => {
            await fs.writeFile(
                importFile,
                [
                    'otpauth://totp/GitHub:alice?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=GitHub',
                    'otpauth://totp/corp-idp.example.com:user?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=corp-idp.example.com',
                ].join('\n'),
                'utf-8',
            );

            await runIdp(['import', importFile], {});

            const stderr = stderrChunks.join('');
            expect(stderr).toContain('ADDED: github');
            expect(stderr).toContain('ADDED: corp-idp.example.com');
            expect(stderr).toContain('2 added');
            expect(stderr).toContain('0 skipped');

            // Secrets must not appear in YAML
            expect(currentYaml.includes('GEZDGNBVGY3TQOJQ')).toBe(false);

            // Encrypted files must exist
            const gitHubFile = path.join(tmpHome, '.sig', 'idps', 'github.json');
            await expect(fs.access(gitHubFile)).resolves.toBeUndefined();
        });

        it('skips duplicate entries without --force', async () => {
            await fs.writeFile(
                importFile,
                'otpauth://totp/GitHub:alice?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=GitHub',
                'utf-8',
            );

            await runIdp(['import', importFile], {});
            stderrChunks.length = 0;
            await runIdp(['import', importFile], {});

            const stderr = stderrChunks.join('');
            expect(stderr).toContain('SKIP (exists): github');
            expect(stderr).toContain('0 added');
            expect(stderr).toContain('1 skipped');
        });

        it('overwrites duplicates with --force', async () => {
            await fs.writeFile(
                importFile,
                'otpauth://totp/GitHub:alice?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=GitHub',
                'utf-8',
            );

            await runIdp(['import', importFile], {});
            stderrChunks.length = 0;
            await runIdp(['import', importFile], { force: true });

            const stderr = stderrChunks.join('');
            expect(stderr).toContain('ADDED: github');
            expect(stderr).toContain('1 added');
            expect(stderr).toContain('0 skipped');
        });

        it('skips blank lines and non-otpauth lines', async () => {
            await fs.writeFile(
                importFile,
                [
                    '',
                    '# this is a comment',
                    'not-a-uri',
                    'otpauth://totp/GitHub:alice?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=GitHub',
                ].join('\n'),
                'utf-8',
            );

            await runIdp(['import', importFile], {});

            const stderr = stderrChunks.join('');
            expect(stderr).toContain('1 added');
        });

        it('counts invalid URIs as failed', async () => {
            await fs.writeFile(
                importFile,
                'otpauth://totp/GitHub:alice?secret=TOOSHORT&issuer=GitHub',
                'utf-8',
            );

            await runIdp(['import', importFile], {});

            const stderr = stderrChunks.join('');
            expect(stderr).toContain('0 added');
            expect(stderr).toContain('1 failed');
        });

        it('errors when file path is missing', async () => {
            await runIdp(['import'], {});
            expect(process.exitCode).not.toBe(undefined);
            expect(process.exitCode).not.toBe(0);
            const stderr = stderrChunks.join('');
            expect(stderr).toContain('sig idp import');
        });

        it('errors when file does not exist', async () => {
            await runIdp(['import', '/nonexistent/path/file.txt'], {});
            expect(process.exitCode).not.toBe(undefined);
            expect(process.exitCode).not.toBe(0);
            const stderr = stderrChunks.join('');
            expect(stderr).toContain('Error reading file');
        });
    });
});
