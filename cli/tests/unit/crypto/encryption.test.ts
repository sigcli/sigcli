import { describe, it, expect, afterEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
    encrypt,
    decrypt,
    isEncryptedEnvelope,
    generateEncryptionKey,
    loadEncryptionKey,
    type EncryptedEnvelope,
} from '../../../src/crypto/encryption.js';

const isWindows = process.platform === 'win32';

describe('encrypt / decrypt', () => {
    const key = randomBytes(32);

    it('roundtrips plain text', () => {
        const plaintext = 'hello world';
        const envelope = encrypt(plaintext, key);
        expect(decrypt(envelope, key)).toBe(plaintext);
    });

    it('roundtrips empty string', () => {
        const envelope = encrypt('', key);
        expect(decrypt(envelope, key)).toBe('');
    });

    it('roundtrips unicode', () => {
        const plaintext = 'Credentials: token=abc123';
        const envelope = encrypt(plaintext, key);
        expect(decrypt(envelope, key)).toBe(plaintext);
    });

    it('produces unique IV per call', () => {
        const a = encrypt('same', key);
        const b = encrypt('same', key);
        expect(a.iv).not.toBe(b.iv);
    });

    it('throws with wrong key', () => {
        const envelope = encrypt('secret', key);
        const wrongKey = randomBytes(32);
        expect(() => decrypt(envelope, wrongKey)).toThrow();
    });

    it('throws with tampered ciphertext', () => {
        const envelope = encrypt('secret', key);
        const tampered: EncryptedEnvelope = {
            ...envelope,
            ciphertext: Buffer.from('tampered').toString('base64'),
        };
        expect(() => decrypt(tampered, key)).toThrow();
    });

    it('throws with tampered authTag', () => {
        const envelope = encrypt('secret', key);
        const tampered: EncryptedEnvelope = {
            ...envelope,
            authTag: randomBytes(16).toString('base64'),
        };
        expect(() => decrypt(tampered, key)).toThrow();
    });
});

describe('isEncryptedEnvelope', () => {
    it('returns true for valid envelope', () => {
        const key = randomBytes(32);
        const envelope = encrypt('test', key);
        expect(isEncryptedEnvelope(envelope)).toBe(true);
    });

    it('returns false for null', () => {
        expect(isEncryptedEnvelope(null)).toBe(false);
    });

    it('returns false for undefined', () => {
        expect(isEncryptedEnvelope(undefined)).toBe(false);
    });

    it('returns false for plain object missing fields', () => {
        expect(isEncryptedEnvelope({ version: 1, encrypted: true })).toBe(false);
    });

    it('returns false for unencrypted provider file', () => {
        expect(
            isEncryptedEnvelope({
                version: 1,
                providerId: 'test',
                credential: { type: 'api-key' },
                strategy: 'api-token',
                updatedAt: '2026-01-01T00:00:00.000Z',
            }),
        ).toBe(false);
    });

    it('returns false for wrong version', () => {
        const key = randomBytes(32);
        const envelope = encrypt('test', key);
        expect(isEncryptedEnvelope({ ...envelope, version: 2 })).toBe(false);
    });
});

describe('generateEncryptionKey', () => {
    const tmpDirs: string[] = [];

    afterEach(async () => {
        for (const d of tmpDirs) {
            await fs.rm(d, { recursive: true, force: true }).catch(() => {});
        }
        tmpDirs.length = 0;
    });

    it('creates a 32-byte key', async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sig-key-test-'));
        tmpDirs.push(tmpDir);

        const key = await generateEncryptionKey(tmpDir);
        expect(key.length).toBe(32);
    });

    it('writes key file to disk', async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sig-key-test-'));
        tmpDirs.push(tmpDir);

        await generateEncryptionKey(tmpDir);
        const keyPath = path.join(tmpDir, 'encryption.key');
        const content = await fs.readFile(keyPath, 'utf8');
        const decoded = Buffer.from(content.trim(), 'base64');
        expect(decoded.length).toBe(32);
    });

    it.skipIf(isWindows)('key file has mode 0o400', async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sig-key-test-'));
        tmpDirs.push(tmpDir);

        await generateEncryptionKey(tmpDir);
        const keyPath = path.join(tmpDir, 'encryption.key');
        const stat = await fs.stat(keyPath);
        expect(stat.mode & 0o777).toBe(0o400);
    });
});

describe('loadEncryptionKey', () => {
    const tmpDirs: string[] = [];

    afterEach(async () => {
        for (const d of tmpDirs) {
            await fs.rm(d, { recursive: true, force: true }).catch(() => {});
        }
        tmpDirs.length = 0;
    });

    it('reads an existing key', async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sig-key-test-'));
        tmpDirs.push(tmpDir);

        const original = await generateEncryptionKey(tmpDir);
        const loaded = await loadEncryptionKey(tmpDir);
        expect(loaded).toEqual(original);
    });

    it('auto-generates key when file is missing', async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sig-key-test-'));
        tmpDirs.push(tmpDir);

        const key = await loadEncryptionKey(tmpDir);
        expect(key.length).toBe(32);

        // Verify file was created
        const keyPath = path.join(tmpDir, 'encryption.key');
        const stat = await fs.stat(keyPath);
        expect(stat.isFile()).toBe(true);
    });

    it('throws on invalid key length', async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sig-key-test-'));
        tmpDirs.push(tmpDir);

        const keyPath = path.join(tmpDir, 'encryption.key');
        await fs.writeFile(keyPath, Buffer.from('short').toString('base64') + '\n');

        await expect(loadEncryptionKey(tmpDir)).rejects.toThrow('Invalid encryption key');
    });
});
