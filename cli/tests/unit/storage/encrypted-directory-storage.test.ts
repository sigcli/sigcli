import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { DirectoryStorage } from '../../../src/storage/directory-storage.js';
import { isEncryptedEnvelope } from '../../../src/crypto/encryption.js';
import type { StoredCredential } from '../../../src/core/types.js';

describe('DirectoryStorage encryption', () => {
    let tmpDir: string;
    let key: Buffer;
    let storage: DirectoryStorage;

    const mockCredential: StoredCredential = {
        credential: {
            type: 'api-key',
            key: 'test-key',
            headerName: 'Authorization',
            headerPrefix: 'Bearer',
        },
        providerId: 'test-provider',
        strategy: 'api-token',
        updatedAt: new Date().toISOString(),
    };

    const cookieCredential: StoredCredential = {
        credential: {
            type: 'cookie',
            cookies: [
                {
                    name: 'sid',
                    value: 'abc123',
                    domain: '.example.com',
                    path: '/',
                    expires: -1,
                    httpOnly: true,
                    secure: true,
                },
            ],
            obtainedAt: new Date().toISOString(),
        },
        providerId: 'cookie-provider',
        strategy: 'cookie',
        updatedAt: new Date().toISOString(),
    };

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'enc-storage-test-'));
        key = randomBytes(32);
        storage = new DirectoryStorage(tmpDir, key);
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('set() writes an encrypted file', async () => {
        await storage.set('test', { ...mockCredential, providerId: 'test' });

        const filePath = path.join(tmpDir, 'test.json');
        const content = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        expect(isEncryptedEnvelope(content)).toBe(true);
        expect(content.providerId).toBeUndefined();
    });

    it('get() returns decrypted credential', async () => {
        const cred: StoredCredential = { ...mockCredential, providerId: 'test' };
        await storage.set('test', cred);
        const retrieved = await storage.get('test');
        expect(retrieved).toEqual(cred);
    });

    it('list() returns entries from encrypted files', async () => {
        await storage.set('provider-a', { ...mockCredential, providerId: 'provider-a' });
        await storage.set('provider-b', { ...cookieCredential, providerId: 'provider-b' });

        const entries = await storage.list();
        expect(entries).toHaveLength(2);
        const ids = entries.map((e) => e.providerId).sort();
        expect(ids).toEqual(['provider-a', 'provider-b']);
    });

    it('delete() removes encrypted file', async () => {
        await storage.set('test', { ...mockCredential, providerId: 'test' });
        await storage.delete('test');
        expect(await storage.get('test')).toBeNull();
    });

    it('clear() removes all encrypted files', async () => {
        await storage.set('a', { ...mockCredential, providerId: 'a' });
        await storage.set('b', { ...cookieCredential, providerId: 'b' });
        await storage.clear();

        expect(await storage.list()).toHaveLength(0);
        expect(await storage.get('a')).toBeNull();
        expect(await storage.get('b')).toBeNull();
    });

    it('roundtrips multiple providers', async () => {
        const credA: StoredCredential = { ...mockCredential, providerId: 'alpha' };
        const credB: StoredCredential = { ...cookieCredential, providerId: 'beta' };

        await storage.set('alpha', credA);
        await storage.set('beta', credB);

        expect(await storage.get('alpha')).toEqual(credA);
        expect(await storage.get('beta')).toEqual(credB);
    });

    it('reads unencrypted legacy file', async () => {
        const legacyData = {
            version: 1,
            providerId: 'legacy',
            credential: {
                type: 'api-key',
                key: 'old-key',
                headerName: 'Authorization',
                headerPrefix: 'Bearer',
            },
            strategy: 'api-token',
            updatedAt: '2026-01-01T00:00:00.000Z',
        };

        const filePath = path.join(tmpDir, 'legacy.json');
        await fs.writeFile(filePath, JSON.stringify(legacyData, null, 2), 'utf-8');

        const retrieved = await storage.get('legacy');
        expect(retrieved).not.toBeNull();
        expect(retrieved!.providerId).toBe('legacy');
        expect(retrieved!.credential.type).toBe('api-key');
    });
});
