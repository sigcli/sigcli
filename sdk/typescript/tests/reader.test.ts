import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CredentialNotFoundError, CredentialParseError } from '../src/errors.js';
import { listProviderFiles, readProviderFile } from '../src/reader.js';

const FIXTURES_DIR = path.join(import.meta.dirname, 'fixtures');

let tmpDir: string;

beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sigcli-reader-test-'));
});

afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
});

async function copyFixture(name: string, targetName?: string): Promise<void> {
    const src = path.join(FIXTURES_DIR, name);
    const dest = path.join(tmpDir, targetName ?? name);
    await fs.copyFile(src, dest);
}

describe('readProviderFile', () => {
    it('reads v2 browser format file', async () => {
        await copyFixture('v2-browser.json', 'my-jira.json');
        const result = await readProviderFile('my-jira', tmpDir);
        expect(result.providerId).toBe('my-jira');
        expect(result.strategy).toBe('browser');
        expect(result.updatedAt).toBe('2026-05-11T10:00:00.000Z');
        expect(result.expiresAt).toBe('2026-05-12T10:00:00.000Z');
        expect(result.values['cookie']).toBe('sid=abc123; csrf=xyz789');
    });

    it('reads v2 oauth2 format file', async () => {
        await copyFixture('v2-oauth2.json', 'my-api.json');
        const result = await readProviderFile('my-api', tmpDir);
        expect(result.providerId).toBe('my-api');
        expect(result.strategy).toBe('oauth2');
        expect(result.values['access_token']).toBe('eyJhbGciOiJIUzI1NiIs');
        expect(result.oauth2?.clientId).toBe('client123');
        expect(result.oauth2?.clientSecret).toBe('secret456');
    });

    it('reads v2 multi-value file', async () => {
        await copyFixture('v2-multi.json', 'my-slack.json');
        const result = await readProviderFile('my-slack', tmpDir);
        expect(result.providerId).toBe('my-slack');
        expect(result.values['cookie']).toBe('d=xoxd-xxx');
        expect(result.values['token']).toBe('xoxc-123-456');
        expect(result.expiresAt).toBeUndefined();
    });

    it('reads v1 legacy format (credentials field) for backward compat', async () => {
        await copyFixture('v1-legacy.json', 'legacy-provider.json');
        const result = await readProviderFile('legacy-provider', tmpDir);
        expect(result.providerId).toBe('legacy-provider');
        expect(result.values['session']).toBe('abc123');
    });

    it('throws CredentialNotFoundError for missing provider', async () => {
        await expect(readProviderFile('nonexistent', tmpDir)).rejects.toThrow(
            CredentialNotFoundError,
        );
    });

    it('throws CredentialParseError for malformed JSON', async () => {
        await fs.writeFile(path.join(tmpDir, 'bad.json'), 'not json at all');
        await expect(readProviderFile('bad', tmpDir)).rejects.toThrow(CredentialParseError);
    });

    it('throws CredentialParseError for missing providerId', async () => {
        await fs.writeFile(path.join(tmpDir, 'incomplete.json'), JSON.stringify({ values: {} }));
        await expect(readProviderFile('incomplete', tmpDir)).rejects.toThrow(CredentialParseError);
    });

    it('sanitizes provider IDs with special characters', async () => {
        await copyFixture('v2-browser.json', 'my_jira.json');
        const result = await readProviderFile('my/jira', tmpDir);
        expect(result.providerId).toBe('my-jira');
    });
});

describe('listProviderFiles', () => {
    it('lists v2 provider files', async () => {
        await copyFixture('v2-browser.json', 'my-jira.json');
        await copyFixture('v2-oauth2.json', 'my-api.json');
        await copyFixture('v2-multi.json', 'my-slack.json');

        const providers = await listProviderFiles(tmpDir);
        expect(providers).toHaveLength(3);

        const ids = providers.map((p) => p.providerId).sort();
        expect(ids).toEqual(['my-api', 'my-jira', 'my-slack']);
    });

    it('includes strategy, updatedAt, and optional expiresAt', async () => {
        await copyFixture('v2-browser.json', 'my-jira.json');
        const providers = await listProviderFiles(tmpDir);
        expect(providers[0].strategy).toBe('browser');
        expect(providers[0].updatedAt).toBe('2026-05-11T10:00:00.000Z');
        expect(providers[0].expiresAt).toBe('2026-05-12T10:00:00.000Z');
    });

    it('lists v1 legacy files (credentials field)', async () => {
        await copyFixture('v1-legacy.json', 'legacy-provider.json');
        const providers = await listProviderFiles(tmpDir);
        expect(providers).toHaveLength(1);
        expect(providers[0].providerId).toBe('legacy-provider');
    });

    it('returns empty array for non-existent directory', async () => {
        const result = await listProviderFiles(path.join(tmpDir, 'nope'));
        expect(result).toEqual([]);
    });

    it('skips .lock files', async () => {
        await copyFixture('v2-browser.json', 'my-jira.json');
        await fs.writeFile(path.join(tmpDir, 'my-jira.json.lock'), '{}');

        const providers = await listProviderFiles(tmpDir);
        expect(providers).toHaveLength(1);
    });

    it('skips unparseable files', async () => {
        await copyFixture('v2-browser.json', 'good.json');
        await fs.writeFile(path.join(tmpDir, 'bad.json'), 'not json');

        const providers = await listProviderFiles(tmpDir);
        expect(providers).toHaveLength(1);
        expect(providers[0].providerId).toBe('my-jira');
    });

    it('skips files with missing providerId or values', async () => {
        await fs.writeFile(
            path.join(tmpDir, 'no-provider-id.json'),
            JSON.stringify({ values: { token: 'x' } }),
        );
        await fs.writeFile(
            path.join(tmpDir, 'no-values.json'),
            JSON.stringify({ providerId: 'test' }),
        );

        const providers = await listProviderFiles(tmpDir);
        expect(providers).toHaveLength(0);
    });

    it('returns empty array for empty directory', async () => {
        const result = await listProviderFiles(tmpDir);
        expect(result).toEqual([]);
    });
});
