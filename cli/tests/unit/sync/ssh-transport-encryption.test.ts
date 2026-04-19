import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encrypt, decrypt, isEncryptedEnvelope } from '../../../src/crypto/encryption.js';

describe('SSH transport encryption roundtrip logic', () => {
    it('encrypts and decrypts a credential payload', () => {
        const key = randomBytes(32);
        const data = {
            version: 1,
            providerId: 'test-provider',
            credential: {
                type: 'api-key',
                key: 'secret',
                headerName: 'Authorization',
                headerPrefix: 'Bearer',
            },
            strategy: 'api-token',
            updatedAt: '2026-01-01T00:00:00.000Z',
        };

        const plaintext = JSON.stringify(data, null, 2);
        const envelope = encrypt(plaintext, key);

        expect(isEncryptedEnvelope(envelope)).toBe(true);
        expect(envelope.algorithm).toBe('aes-256-gcm');

        const decrypted = decrypt(envelope, key);
        const parsed = JSON.parse(decrypted);
        expect(parsed.providerId).toBe('test-provider');
        expect(parsed.credential.key).toBe('secret');
    });

    it('different remote keys produce different envelopes', () => {
        const key1 = randomBytes(32);
        const key2 = randomBytes(32);
        const plaintext = JSON.stringify({ test: true });

        const envelope1 = encrypt(plaintext, key1);
        const envelope2 = encrypt(plaintext, key2);

        expect(envelope1.ciphertext).not.toBe(envelope2.ciphertext);
    });

    it('envelope encrypted with key A cannot be decrypted with key B', () => {
        const keyA = randomBytes(32);
        const keyB = randomBytes(32);
        const plaintext = JSON.stringify({ secret: 'data' });

        const envelope = encrypt(plaintext, keyA);
        expect(() => decrypt(envelope, keyB)).toThrow();
    });

    it('handles legacy unencrypted data detection', () => {
        const legacyData = {
            version: 1,
            providerId: 'legacy',
            credential: { type: 'cookie', cookies: [] },
            strategy: 'cookie',
            updatedAt: '2026-01-01T00:00:00.000Z',
        };

        expect(isEncryptedEnvelope(legacyData)).toBe(false);
    });
});
