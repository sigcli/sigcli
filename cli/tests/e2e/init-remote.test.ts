/**
 * E2E test: sig init --remote workflow.
 *
 * Uses a temporary HOME directory to isolate from real config.
 * Runs the actual CLI via bin/sig.js.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SIG = path.join(ROOT, 'bin', 'sig.js');

let tmpHome: string;

function sig(args: string): { stdout: string; stderr: string; exitCode: number } {
    const result = spawnSync('node', [SIG, ...args.split(/\s+/)], {
        env: { ...process.env, HOME: tmpHome },
        encoding: 'utf-8',
        timeout: 15_000,
    });
    return {
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        exitCode: result.status ?? 1,
    };
}

describe('E2E: sig init --remote', () => {
    beforeAll(async () => {
        tmpHome = await fsp.mkdtemp(path.join(os.tmpdir(), 'signet-e2e-'));
    });

    afterAll(async () => {
        await fsp.rm(tmpHome, { recursive: true, force: true });
    });

    it('creates config with mode: browserless', () => {
        const result = sig('init --remote');
        expect(result.exitCode).toBe(0);

        const configPath = path.join(tmpHome, '.signet', 'config.yaml');
        expect(fs.existsSync(configPath)).toBe(true);

        const content = fs.readFileSync(configPath, 'utf-8');
        const parsed = YAML.parse(content);

        expect(parsed.mode).toBe('browserless');
        expect(parsed.browser.channel).toBeDefined();
        expect(parsed.browser.browserDataDir).toBeDefined();
        expect(parsed.storage.credentialsDir).toBeDefined();
    });

    it('credentials directory is created', () => {
        const credDir = path.join(tmpHome, '.signet', 'credentials');
        expect(fs.existsSync(credDir)).toBe(true);
    });

    it('sig doctor runs against the generated config', () => {
        const result = sig('doctor');
        const output = result.stdout + result.stderr;
        expect(output).toContain('Config file exists');
        expect(output).toContain('Config is valid');
    });

    it('sig login --cookie stores a cookie credential', () => {
        const result = sig('login https://example.com --cookie session=abc123;token=xyz');
        const output = result.stdout + result.stderr;
        expect(output).toContain('Cookie stored');
        const json = JSON.parse(result.stdout.trim());
        expect(json.type).toBe('cookie');
        expect(json.count).toBe(2);
    });

    it('sig get retrieves the stored cookie credential', () => {
        const result = sig('get example.com --format value');
        expect(result.exitCode).toBe(0);
        const cookieValue = result.stdout.trim();
        expect(cookieValue).toContain('session=abc123');
        expect(cookieValue).toContain('token=xyz');
    });

    it('sig login (browser) fails gracefully when browser disabled', () => {
        const result = sig('login https://no-browser.example.com');
        const output = result.stdout + result.stderr;
        expect(result.exitCode).not.toBe(0);
        expect(output).toContain('Browser is not available');
        expect(output).toContain('sig sync pull');
        expect(output).toContain('--cookie');
    });
});
