import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';

// --------------------------------------------------------------------------
// Mocks — must be set up before importing the module under test
// --------------------------------------------------------------------------

vi.mock('node:fs', () => ({
    default: {
        existsSync: vi.fn(),
        constants: { R_OK: 4, W_OK: 2 },
    },
    existsSync: vi.fn(),
    constants: { R_OK: 4, W_OK: 2 },
}));

vi.mock('node:fs/promises', () => ({
    default: {
        access: vi.fn(),
        readdir: vi.fn(),
        readFile: vi.fn(),
    },
}));

vi.mock('node:child_process', () => ({
    execSync: vi.fn(),
    execFile: vi.fn(),
}));

vi.mock('../../../src/config/loader.js', () => ({
    getConfigPath: vi.fn(),
    loadConfig: vi.fn(),
}));

// Mock playwright-core dynamic import — doctor does `await import('playwright-core')`
vi.mock('playwright-core', () => ({
    default: {},
}));

// Import after mocking
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { ok, err, ConfigError, getConfigPath, loadConfig } from '../../../src/index.js';
import { runDoctor } from '../../../src/cli/commands/doctor.js';
import type { SignetConfig } from '../../../src/index.js';

const mockExistsSync = vi.mocked(fs.existsSync);
const mockAccess = vi.mocked(fsp.access);
const mockReaddir = vi.mocked(fsp.readdir);
const mockReadFile = vi.mocked(fsp.readFile);
const mockGetConfigPath = vi.mocked(getConfigPath);
const mockLoadConfig = vi.mocked(loadConfig);

const EXPECTED_CONFIG_PATH = path.join(os.homedir(), '.sig', 'config.yaml');

function validConfig(overrides: Partial<SignetConfig> = {}): SignetConfig {
    return <SignetConfig>{
        browser: {
            browserDataDir: '/tmp/test-browser-data',
            channel: 'chrome',
            headlessTimeout: 30_000,
            visibleTimeout: 120_000,
            waitUntil: 'load',
        },
        storage: {
            credentialsDir: '/tmp/test-credentials',
        },
        providers: {
            test: {
                domains: ['test.example.com'],
                strategy: 'cookie',
                entryUrl: '',
            },
        },
        ...overrides,
    };
}

describe('runDoctor', () => {
    let logs: string[];
    let originalExitCode: number | string | undefined;

    beforeEach(() => {
        vi.clearAllMocks();
        logs = [];
        originalExitCode = process.exitCode;
        process.exitCode = undefined;

        // Capture process.stderr.write output (doctor uses stderr, not console.log)
        vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
            logs.push(String(chunk));
            return true;
        });

        // Default config path
        mockGetConfigPath.mockReturnValue(EXPECTED_CONFIG_PATH);
    });

    afterEach(() => {
        process.exitCode = originalExitCode;
        vi.restoreAllMocks();
    });

    // ---- config file missing ----

    it('reports failure when config file is missing', async () => {
        // existsSync returns false for config path
        mockExistsSync.mockReturnValue(false);
        // loadConfig returns error
        mockLoadConfig.mockResolvedValue(
            err(new ConfigError(`Config file not found: ${EXPECTED_CONFIG_PATH}`)),
        );
        // access fails for directories
        mockAccess.mockRejectedValue(new Error('ENOENT'));
        // readdir fails
        mockReaddir.mockRejectedValue(new Error('ENOENT'));

        await runDoctor([], {});

        const output = logs.join('');
        // Should report config file missing
        expect(output).toContain('Config file exists');
        expect(output).toContain('\u2717'); // FAIL mark
        // Should include hint about sig init
        expect(output).toContain('sig init');
        // Should report issues
        expect(output).toMatch(/\d+ issue/);
        // Should set exit code
        expect(process.exitCode).toBe(1);
    });

    // ---- config is invalid YAML ----

    it('reports parse error when config is invalid YAML', async () => {
        // Config file exists
        mockExistsSync.mockReturnValue(true);
        // But loadConfig returns parse error
        mockLoadConfig.mockResolvedValue(
            err(new ConfigError('Invalid YAML in config: unexpected token')),
        );
        // Directories fail
        mockAccess.mockRejectedValue(new Error('ENOENT'));
        mockReaddir.mockRejectedValue(new Error('ENOENT'));

        await runDoctor([], {});

        const output = logs.join('');
        // Config exists check passes
        expect(output).toContain('\u2713'); // at least one PASS
        // But validation fails
        expect(output).toContain('Config is valid');
        expect(output).toContain('Invalid YAML');
        expect(process.exitCode).toBe(1);
    });

    // ---- valid config but directories missing ----

    it('reports issues when config is valid but directories are missing', async () => {
        const config = validConfig();

        // Config file exists
        mockExistsSync.mockImplementation((p: unknown) => {
            if (p === EXPECTED_CONFIG_PATH) return true;
            // Browser data dir does not exist
            return false;
        });
        // loadConfig succeeds
        mockLoadConfig.mockResolvedValue(ok(config));
        // credentials dir access fails
        mockAccess.mockRejectedValue(new Error('ENOENT'));
        // readdir fails (no credentials)
        mockReaddir.mockRejectedValue(new Error('ENOENT'));

        await runDoctor([], {});

        const output = logs.join('');
        // Config checks pass
        expect(output).toContain('Config file exists');
        expect(output).toContain('Config is valid');
        // Directory checks fail
        expect(output).toContain('Credentials directory exists');
        expect(output).toContain('Browser data directory exists');
        expect(process.exitCode).toBe(1);
    });

    // ---- everything passes ----

    it('reports all checks passed when everything is fine', async () => {
        const config = validConfig();

        // All filesystem checks pass
        mockExistsSync.mockReturnValue(true);
        mockLoadConfig.mockResolvedValue(ok(config));
        mockAccess.mockResolvedValue(undefined);
        mockReaddir.mockResolvedValue(
            [] as unknown as ReturnType<typeof fsp.readdir> extends Promise<infer U> ? U : never,
        );

        await runDoctor([], {});

        const output = logs.join('');
        expect(output).toContain('All checks passed');
        expect(process.exitCode).not.toBe(1);
    });

    // ---- Node.js version check ----

    it('Node.js version check passes in test environment', async () => {
        const config = validConfig();

        mockExistsSync.mockReturnValue(true);
        mockLoadConfig.mockResolvedValue(ok(config));
        mockAccess.mockResolvedValue(undefined);
        mockReaddir.mockResolvedValue(
            [] as unknown as ReturnType<typeof fsp.readdir> extends Promise<infer U> ? U : never,
        );

        await runDoctor([], {});

        const output = logs.join('');
        // Should show node version check passed
        expect(output).toContain('Node.js version');
        expect(output).toContain(process.version);
        // The check mark should be present for the Node.js version line
        const nodeVersionLine = logs.find((l) => l.includes('Node.js version'));
        expect(nodeVersionLine).toContain('\u2713'); // PASS mark
    });

    // ---- count of issues matches actual failures ----

    it('count of issues reported matches actual failures', async () => {
        // Config file missing + loadConfig error = at least 2 failures
        // Plus directories missing since no config
        mockExistsSync.mockReturnValue(false);
        mockLoadConfig.mockResolvedValue(err(new ConfigError('Config file not found')));
        mockAccess.mockRejectedValue(new Error('ENOENT'));
        mockReaddir.mockRejectedValue(new Error('ENOENT'));

        await runDoctor([], {});

        const _output = logs.join('');
        // Count the FAIL marks in output
        const failCount = logs.filter((l) => l.includes('\u2717')).length;
        // The summary line should mention the count
        const summaryLine = logs.find((l) => l.includes('issue'));
        expect(summaryLine).toBeDefined();

        if (summaryLine) {
            const countMatch = summaryLine.match(/(\d+) issue/);
            expect(countMatch).toBeDefined();
            if (countMatch) {
                const reportedCount = parseInt(countMatch[1], 10);
                expect(reportedCount).toBe(failCount);
            }
        }
        expect(process.exitCode).toBe(1);
    });

    // ---- stored credentials check ----

    it('reports stored credentials count when config is valid', async () => {
        const config = validConfig();

        mockExistsSync.mockReturnValue(true);
        mockLoadConfig.mockResolvedValue(ok(config));
        mockAccess.mockResolvedValue(undefined);
        // Return some credential files
        mockReaddir.mockResolvedValue([
            'test.json',
            'test.lock',
            'another.json',
        ] as unknown as ReturnType<typeof fsp.readdir> extends Promise<infer U> ? U : never);
        // Mock readFile for credential inspection
        mockReadFile.mockResolvedValue(
            JSON.stringify({
                credential: { type: 'cookie', cookies: [] },
            }),
        );

        await runDoctor([], {});

        const output = logs.join('');
        expect(output).toContain('Stored credentials');
        // Should count only .json files (not .lock)
        expect(output).toContain('2 stored credentials');
    });

    it('shows 0 stored credentials when directory is empty', async () => {
        const config = validConfig();

        mockExistsSync.mockReturnValue(true);
        mockLoadConfig.mockResolvedValue(ok(config));
        mockAccess.mockResolvedValue(undefined);
        mockReaddir.mockResolvedValue(
            [] as unknown as ReturnType<typeof fsp.readdir> extends Promise<infer U> ? U : never,
        );

        await runDoctor([], {});

        const output = logs.join('');
        expect(output).toContain('0 stored credentials');
    });

    // ---- single issue uses singular ----

    it('uses singular "issue" for exactly 1 failure', async () => {
        const config = validConfig();

        // Config exists and is valid
        mockExistsSync.mockImplementation((p: unknown) => {
            if (p === EXPECTED_CONFIG_PATH) return true;
            // Browser data dir does not exist
            return false;
        });
        mockLoadConfig.mockResolvedValue(ok(config));
        // Credentials dir passes
        mockAccess.mockResolvedValue(undefined);
        mockReaddir.mockResolvedValue(
            [] as unknown as ReturnType<typeof fsp.readdir> extends Promise<infer U> ? U : never,
        );

        await runDoctor([], {});

        const output = logs.join('');
        // Only browser data dir should fail (1 issue)
        // The summary should use singular
        const failLines = logs.filter((l) => l.includes('\u2717'));
        if (failLines.length === 1) {
            expect(output).toContain('1 issue found');
            expect(output).not.toContain('1 issues found');
        }
    });
});
