import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// We need to mock CONFIG_PATH before importing the module
const tmpDir = path.join(os.tmpdir(), `sig-loader-test-${Date.now()}`);

vi.mock('node:os', async () => {
    const actual = await vi.importActual<typeof import('node:os')>('node:os');
    return {
        ...actual,
        default: {
            ...actual,
            homedir: () => path.join(tmpDir, 'home'),
        },
    };
});

// The module computes CONFIG_PATH at import time using os.homedir()
// so we need to ensure the mock is in place first
const { addProviderToConfig } = await import('../../../src/config/loader.js');

const HOME_SIG = path.join(tmpDir, 'home', '.sig');
const CONFIG_PATH = path.join(HOME_SIG, 'config.yaml');

describe('addProviderToConfig', () => {
    beforeEach(async () => {
        await fs.mkdir(HOME_SIG, { recursive: true });
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    const baseEntry = {
        domains: ['example.com'],
        entryUrl: 'https://example.com/',
        strategy: 'browser' as const,
        extract: [{ from: 'cookies' as const, as: 'session', match: '*' }],
        apply: [{ in: 'header' as const, name: 'Cookie', value: '${session}' }],
        ttl: '2h',
    };

    it('creates timestamped backup in backups/ folder before writing', async () => {
        const original = 'version: 2\nproviders:\n  existing:\n    domains: [foo.com]\n';
        await fs.writeFile(CONFIG_PATH, original);

        await addProviderToConfig('new-provider', baseEntry);

        const backupDir = path.join(HOME_SIG, 'backups');
        const files = await fs.readdir(backupDir);
        expect(files.length).toBe(1);
        expect(files[0]).toMatch(/^config\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*\.yaml$/);
        const backup = await fs.readFile(path.join(backupDir, files[0]), 'utf-8');
        expect(backup).toBe(original);
    });

    it('emits warning to stderr when overwriting existing provider', async () => {
        const original =
            'version: 2\nproviders:\n  my-provider:\n    domains: [old.com]\n    entryUrl: https://old.com/\n    strategy: browser\n';
        await fs.writeFile(CONFIG_PATH, original);

        const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

        await addProviderToConfig('my-provider', baseEntry);

        expect(stderrSpy).toHaveBeenCalledWith(
            expect.stringContaining('overwriting provider "my-provider"'),
        );
        expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('backups'));
        stderrSpy.mockRestore();
    });

    it('does not warn when writing a new provider', async () => {
        const original = 'version: 2\nproviders:\n  other:\n    domains: [other.com]\n';
        await fs.writeFile(CONFIG_PATH, original);

        const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

        await addProviderToConfig('brand-new', baseEntry);

        expect(stderrSpy).not.toHaveBeenCalled();
        stderrSpy.mockRestore();
    });

    it('backup contains original content that can be restored', async () => {
        const original =
            'version: 2\nproviders:\n  precious:\n    domains: [precious.com]\n    entryUrl: https://precious.com/\n    strategy: browser\n    ttl: 7d\n    networkProxy: socks5://127.0.0.1:1080\n';
        await fs.writeFile(CONFIG_PATH, original);

        const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        await addProviderToConfig('precious', baseEntry);
        stderrSpy.mockRestore();

        // Config was overwritten
        const newContent = await fs.readFile(CONFIG_PATH, 'utf-8');
        expect(newContent).not.toBe(original);

        // But backup preserves the original
        const backupDir = path.join(HOME_SIG, 'backups');
        const files = await fs.readdir(backupDir);
        const backup = await fs.readFile(path.join(backupDir, files[0]), 'utf-8');
        expect(backup).toBe(original);
    });

    it('does nothing if config file does not exist', async () => {
        // No config file created — should return silently
        await addProviderToConfig('test', baseEntry);

        // Neither config nor backup should exist
        await expect(fs.access(CONFIG_PATH)).rejects.toThrow();
        await expect(fs.access(CONFIG_PATH + '.bak')).rejects.toThrow();
    });
});
