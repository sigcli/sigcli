import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SigClient } from '../src/client.js';
import { CredentialNotFoundError } from '../src/errors.js';

const FIXTURES_DIR = path.join(import.meta.dirname, 'fixtures');

let tmpDir: string;

beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sigcli-client-test-'));
    // Copy v2 fixtures, naming files by providerId
    for (const fixture of [
        'v2-browser.json',
        'v2-oauth2.json',
        'v2-multi.json',
        'v1-legacy.json',
    ]) {
        const content = await fs.readFile(path.join(FIXTURES_DIR, fixture), 'utf-8');
        const data = JSON.parse(content) as { providerId: string };
        await fs.writeFile(path.join(tmpDir, `${data.providerId}.json`), content);
    }
});

afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('SigClient', () => {
    it('getCredential returns ProviderFile with values', async () => {
        const client = new SigClient({ credentialsDir: tmpDir });
        const cred = await client.getCredential('my-jira');
        expect(cred.providerId).toBe('my-jira');
        expect(cred.strategy).toBe('browser');
        expect(cred.values['cookie']).toBe('sid=abc123; csrf=xyz789');
        client.close();
    });

    it('getCredential throws CredentialNotFoundError for missing provider', async () => {
        const client = new SigClient({ credentialsDir: tmpDir });
        await expect(client.getCredential('nonexistent')).rejects.toThrow(CredentialNotFoundError);
        client.close();
    });

    it('listProviders returns ProviderInfo array', async () => {
        const client = new SigClient({ credentialsDir: tmpDir });
        const providers = await client.listProviders();
        expect(providers.length).toBeGreaterThanOrEqual(3);
        const ids = providers.map((p) => p.providerId).sort();
        expect(ids).toContain('my-jira');
        expect(ids).toContain('my-api');
        expect(ids).toContain('my-slack');
        client.close();
    });

    it('watch emits change events', async () => {
        const client = new SigClient({ credentialsDir: tmpDir });
        const changes: string[] = [];

        client.on('change', (providerId) => {
            changes.push(providerId);
        });

        client.watch();

        // Write a new file to trigger change
        const newFile = {
            version: 2,
            providerId: 'watch-test',
            strategy: 'browser',
            updatedAt: new Date().toISOString(),
            values: { cookie: 'test=1' },
        };
        await fs.writeFile(path.join(tmpDir, 'watch-test.json'), JSON.stringify(newFile));

        // Wait for debounce + async read
        await new Promise((resolve) => setTimeout(resolve, 300));

        expect(changes).toContain('watch-test');
        client.close();
    });

    it('close() is safe to call multiple times', () => {
        const client = new SigClient({ credentialsDir: tmpDir });
        client.close();
        client.close();
    });

    it('watch() is idempotent', () => {
        const client = new SigClient({ credentialsDir: tmpDir });
        client.watch();
        client.watch();
        client.close();
    });
});
