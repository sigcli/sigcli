import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DirectoryStorage } from '../../../src/storage/directory-storage.js';
import type { StoredCredential } from '../../../src/core/types.js';

const isWindows = process.platform === 'win32';

describe('DirectoryStorage', () => {
    let tmpDir: string;
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
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dir-storage-test-'));
        storage = new DirectoryStorage(tmpDir);
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('returns null for unknown provider', async () => {
        expect(await storage.get('unknown')).toBeNull();
    });

    it('stores and retrieves a credential (round-trip)', async () => {
        // DirectoryStorage uses the providerId from the key argument for the stored file,
        // so the retrieved credential's providerId reflects the key, not the original object.
        const cred: StoredCredential = { ...mockCredential, providerId: 'test' };
        await storage.set('test', cred);
        const retrieved = await storage.get('test');
        expect(retrieved).toEqual(cred);
    });

    it('creates the directory if it does not exist', async () => {
        const nestedDir = path.join(tmpDir, 'nested', 'subdir');
        const nestedStorage = new DirectoryStorage(nestedDir);

        const cred: StoredCredential = { ...mockCredential, providerId: 'test' };
        await nestedStorage.set('test', cred);
        const retrieved = await nestedStorage.get('test');
        expect(retrieved).toEqual(cred);

        // Verify the directory was actually created
        const stat = await fs.stat(nestedDir);
        expect(stat.isDirectory()).toBe(true);
    });

    it('overwrites existing credential', async () => {
        const cred: StoredCredential = { ...mockCredential, providerId: 'test' };
        await storage.set('test', cred);
        const updated: StoredCredential = {
            ...cred,
            updatedAt: '2026-01-01T00:00:00.000Z',
            strategy: 'cookie',
        };
        await storage.set('test', updated);
        const retrieved = await storage.get('test');
        expect(retrieved).toEqual(updated);
    });

    it('deletes a credential', async () => {
        await storage.set('test', mockCredential);
        await storage.delete('test');
        expect(await storage.get('test')).toBeNull();
    });

    it('delete is a no-op for unknown provider', async () => {
        // Should not throw
        await storage.delete('unknown');
    });

    it('lists all stored entries with correct summary fields', async () => {
        await storage.set('provider-a', { ...mockCredential, providerId: 'provider-a' });
        await storage.set('provider-b', { ...cookieCredential, providerId: 'provider-b' });

        const entries = await storage.list();
        expect(entries).toHaveLength(2);

        const sorted = entries.sort((a, b) => a.providerId.localeCompare(b.providerId));
        expect(sorted[0]).toEqual({
            providerId: 'provider-a',
            strategy: 'api-token',
            updatedAt: mockCredential.updatedAt,
            credentialType: 'api-key',
        });
        expect(sorted[1]).toEqual({
            providerId: 'provider-b',
            strategy: 'cookie',
            updatedAt: cookieCredential.updatedAt,
            credentialType: 'cookie',
        });
    });

    it('returns empty array for empty directory', async () => {
        const entries = await storage.list();
        expect(entries).toEqual([]);
    });

    it('returns empty array when directory does not exist', async () => {
        const missingStorage = new DirectoryStorage(path.join(tmpDir, 'nonexistent'));
        const entries = await missingStorage.list();
        expect(entries).toEqual([]);
    });

    it('clears all credentials', async () => {
        await storage.set('a', { ...mockCredential, providerId: 'a' });
        await storage.set('b', { ...cookieCredential, providerId: 'b' });
        await storage.clear();

        expect(await storage.list()).toHaveLength(0);
        expect(await storage.get('a')).toBeNull();
        expect(await storage.get('b')).toBeNull();
    });

    it('writing provider A does not affect provider B (file-per-provider isolation)', async () => {
        await storage.set('providerA', { ...mockCredential, providerId: 'providerA' });
        await storage.set('providerB', { ...cookieCredential, providerId: 'providerB' });

        // Overwrite provider A
        const updatedA: StoredCredential = {
            ...mockCredential,
            providerId: 'providerA',
            updatedAt: '2026-06-01T00:00:00.000Z',
        };
        await storage.set('providerA', updatedA);

        // Provider B should be unchanged
        const retrievedB = await storage.get('providerB');
        expect(retrievedB).toEqual({ ...cookieCredential, providerId: 'providerB' });

        // Provider A should have the updated value
        const retrievedA = await storage.get('providerA');
        expect(retrievedA).toEqual(updatedA);
    });

    // ---------------------------------------------------------------------------
    // Credential file permissions (#13)
    // ---------------------------------------------------------------------------

    it.skipIf(isWindows)('creates directory with mode 0o700', async () => {
        const nestedDir = path.join(tmpDir, 'perm-test-dir');
        const nestedStorage = new DirectoryStorage(nestedDir);

        const cred: StoredCredential = { ...mockCredential, providerId: 'perm-test' };
        await nestedStorage.set('perm-test', cred);

        const stat = await fs.stat(nestedDir);
        expect(stat.isDirectory()).toBe(true);
        // mode & 0o777 masks out file type bits to get permission bits
        expect(stat.mode & 0o777).toBe(0o700);
    });

    it.skipIf(isWindows)('writes credential files with mode 0o600', async () => {
        const cred: StoredCredential = { ...mockCredential, providerId: 'perm-file' };
        await storage.set('perm-file', cred);

        const filePath = path.join(tmpDir, 'perm-file.json');
        const stat = await fs.stat(filePath);
        expect(stat.mode & 0o777).toBe(0o600);
    });

    it.skipIf(isWindows)('lock files have mode 0o600', async () => {
        const cred: StoredCredential = { ...mockCredential, providerId: 'lock-perm' };
        await storage.set('lock-perm', cred);

        const lockPath = path.join(tmpDir, 'lock-perm.json.lock');
        const stat = await fs.stat(lockPath);
        expect(stat.mode & 0o777).toBe(0o600);
    });

    it.skipIf(isWindows)('overwritten files retain mode 0o600', async () => {
        const cred: StoredCredential = { ...mockCredential, providerId: 'overwrite-perm' };
        await storage.set('overwrite-perm', cred);
        await storage.set('overwrite-perm', { ...cred, updatedAt: '2026-06-01T00:00:00.000Z' });

        const filePath = path.join(tmpDir, 'overwrite-perm.json');
        const stat = await fs.stat(filePath);
        expect(stat.mode & 0o777).toBe(0o600);
    });

    it('provider IDs with special characters produce valid filenames and round-trip correctly', async () => {
        const specialIds = [
            'https://example.com',
            'provider/with/slashes',
            'provider with spaces',
            'provider@domain.com',
            '.hidden-provider',
            'provider:8080',
        ];

        for (const id of specialIds) {
            const cred: StoredCredential = { ...mockCredential, providerId: id };
            await storage.set(id, cred);
            const retrieved = await storage.get(id);
            expect(retrieved).toEqual(cred);
        }
    });

    it('each provider gets its own separate JSON file with human-readable names', async () => {
        await storage.set('alpha', { ...mockCredential, providerId: 'alpha' });
        await storage.set('beta', { ...cookieCredential, providerId: 'beta' });

        const files = (await fs.readdir(tmpDir))
            .filter((f) => f.endsWith('.json') && !f.endsWith('.lock'))
            .sort();
        expect(files).toHaveLength(2);

        // Filenames are human-readable provider IDs
        expect(files).toEqual(['alpha.json', 'beta.json']);

        // Verify each file contains the correct provider data
        const alphaContent = JSON.parse(
            await fs.readFile(path.join(tmpDir, 'alpha.json'), 'utf-8'),
        );
        expect(alphaContent.providerId).toBe('alpha');
        expect(alphaContent.version).toBe(1);

        const betaContent = JSON.parse(await fs.readFile(path.join(tmpDir, 'beta.json'), 'utf-8'));
        expect(betaContent.providerId).toBe('beta');
        expect(betaContent.version).toBe(1);
    });
});
