import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { readProviderFile, listProviderFiles } from '../src/reader.js';
import { CredentialNotFoundError, CredentialParseError } from '../src/errors.js';

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
    it('reads cookie provider file', async () => {
        await copyFixture('cookie-provider.json', 'my-jira.json');
        const result = await readProviderFile('my-jira', tmpDir);
        expect(result.version).toBe(1);
        expect(result.providerId).toBe('my-jira');
        expect(result.credential.type).toBe('cookie');
        if (result.credential.type === 'cookie') {
            expect(result.credential.cookies).toHaveLength(2);
            expect(result.credential.cookies[0].name).toBe('sid');
        }
    });

    it('reads bearer provider file', async () => {
        await copyFixture('bearer-provider.json', 'azure-graph.json');
        const result = await readProviderFile('azure-graph', tmpDir);
        expect(result.credential.type).toBe('bearer');
        if (result.credential.type === 'bearer') {
            expect(result.credential.accessToken).toContain('eyJ');
        }
    });

    it('reads api-key provider file', async () => {
        await copyFixture('apikey-provider.json', 'github.json');
        const result = await readProviderFile('github', tmpDir);
        expect(result.credential.type).toBe('api-key');
        if (result.credential.type === 'api-key') {
            expect(result.credential.key).toBe('ghp_test123456');
            expect(result.credential.headerPrefix).toBe('Bearer');
        }
    });

    it('reads basic provider file', async () => {
        await copyFixture('basic-provider.json', 'legacy-api.json');
        const result = await readProviderFile('legacy-api', tmpDir);
        expect(result.credential.type).toBe('basic');
        if (result.credential.type === 'basic') {
            expect(result.credential.username).toBe('admin');
        }
    });

    it('reads cookie with xHeaders', async () => {
        await copyFixture('cookie-xheaders.json', 'xiaohongshu.json');
        const result = await readProviderFile('xiaohongshu', tmpDir);
        if (result.credential.type === 'cookie') {
            expect(result.credential.xHeaders).toBeDefined();
            expect(result.credential.xHeaders!['x-csrf-token']).toBe('csrf-abc');
        }
    });

    it('reads credential with localStorage', async () => {
        await copyFixture('bearer-localstorage.json', 'slack.json');
        const result = await readProviderFile('slack', tmpDir);
        if (result.credential.type === 'cookie') {
            expect(result.credential.localStorage).toBeDefined();
            expect(result.credential.localStorage!['token']).toBe('xoxc-123-456');
        }
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

    it('throws CredentialParseError for missing required fields', async () => {
        await fs.writeFile(path.join(tmpDir, 'incomplete.json'), JSON.stringify({ foo: 'bar' }));
        await expect(readProviderFile('incomplete', tmpDir)).rejects.toThrow(CredentialParseError);
    });

    it('sanitizes provider IDs with special characters', async () => {
        await copyFixture('cookie-provider.json', 'my_provider.json');
        const result = await readProviderFile('my/provider', tmpDir);
        expect(result.providerId).toBe('my-jira');
    });

    it('reads api-key provider without headerPrefix', async () => {
        await copyFixture('apikey-no-prefix.json', 'custom-api.json');
        const result = await readProviderFile('custom-api', tmpDir);
        expect(result.credential.type).toBe('api-key');
        if (result.credential.type === 'api-key') {
            expect(result.credential.key).toBe('raw-key-no-prefix');
            expect(result.credential.headerName).toBe('X-API-Key');
            expect(result.credential.headerPrefix).toBeUndefined();
        }
    });

    it('throws CredentialParseError for partial fields (missing credential)', async () => {
        await fs.writeFile(
            path.join(tmpDir, 'partial.json'),
            JSON.stringify({ version: 1, providerId: 'partial' }),
        );
        await expect(readProviderFile('partial', tmpDir)).rejects.toThrow(CredentialParseError);
    });

    it('throws CredentialParseError for version 0 (falsy version)', async () => {
        await fs.writeFile(
            path.join(tmpDir, 'zero-ver.json'),
            JSON.stringify({
                version: 0,
                providerId: 'zero-ver',
                credential: { type: 'basic', username: 'u', password: 'p' },
            }),
        );
        await expect(readProviderFile('zero-ver', tmpDir)).rejects.toThrow(CredentialParseError);
    });

    it('throws CredentialParseError for empty JSON object', async () => {
        await fs.writeFile(path.join(tmpDir, 'empty-obj.json'), '{}');
        await expect(readProviderFile('empty-obj', tmpDir)).rejects.toThrow(CredentialParseError);
    });

    it('preserves metadata field when present', async () => {
        const data = {
            version: 1,
            providerId: 'meta-test',
            credential: { type: 'basic', username: 'u', password: 'p' },
            strategy: 'basic',
            updatedAt: '2026-04-13T10:00:00.000Z',
            metadata: { source: 'test' },
        };
        await fs.writeFile(path.join(tmpDir, 'meta-test.json'), JSON.stringify(data));
        const result = await readProviderFile('meta-test', tmpDir);
        expect(result.metadata).toEqual({ source: 'test' });
    });
});

describe('listProviderFiles', () => {
    it('lists all provider files', async () => {
        await copyFixture('cookie-provider.json', 'my-jira.json');
        await copyFixture('bearer-provider.json', 'azure-graph.json');
        await copyFixture('apikey-provider.json', 'github.json');

        const providers = await listProviderFiles(tmpDir);
        expect(providers).toHaveLength(3);

        const ids = providers.map((p) => p.providerId).sort();
        expect(ids).toEqual(['azure-graph', 'github', 'my-jira']);
    });

    it('returns empty array for non-existent directory', async () => {
        const result = await listProviderFiles(path.join(tmpDir, 'nope'));
        expect(result).toEqual([]);
    });

    it('skips .lock files', async () => {
        await copyFixture('cookie-provider.json', 'my-jira.json');
        await fs.writeFile(path.join(tmpDir, 'my-jira.json.lock'), '{}');

        const providers = await listProviderFiles(tmpDir);
        expect(providers).toHaveLength(1);
    });

    it('skips unparseable files', async () => {
        await copyFixture('cookie-provider.json', 'good.json');
        await fs.writeFile(path.join(tmpDir, 'bad.json'), 'not json');

        const providers = await listProviderFiles(tmpDir);
        expect(providers).toHaveLength(1);
        expect(providers[0].providerId).toBe('my-jira');
    });

    it('includes credential type and strategy', async () => {
        await copyFixture('bearer-provider.json', 'azure-graph.json');
        const providers = await listProviderFiles(tmpDir);
        expect(providers[0].credentialType).toBe('bearer');
        expect(providers[0].strategy).toBe('oauth2');
    });

    it('returns empty array for empty directory', async () => {
        const result = await listProviderFiles(tmpDir);
        expect(result).toEqual([]);
    });

    it('skips non-JSON files', async () => {
        await copyFixture('cookie-provider.json', 'valid.json');
        await fs.writeFile(path.join(tmpDir, 'notes.txt'), 'just a text file');
        await fs.writeFile(path.join(tmpDir, 'data.yaml'), 'key: val');

        const providers = await listProviderFiles(tmpDir);
        expect(providers).toHaveLength(1);
        expect(providers[0].providerId).toBe('my-jira');
    });

    it('skips files with missing providerId or credential', async () => {
        await fs.writeFile(
            path.join(tmpDir, 'no-provider-id.json'),
            JSON.stringify({ version: 1, credential: { type: 'basic' } }),
        );
        await fs.writeFile(
            path.join(tmpDir, 'no-credential.json'),
            JSON.stringify({ version: 1, providerId: 'test' }),
        );

        const providers = await listProviderFiles(tmpDir);
        expect(providers).toHaveLength(0);
    });
});
