import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isEncryptedEnvelope } from '../../../src/crypto/encryption.js';
import { IdpStore } from '../../../src/idps/idp-store.js';

describe('IdpStore', () => {
    let tmpDir: string;
    let key: Buffer;
    let store: IdpStore;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sig-idp-store-'));
        key = randomBytes(32);
        store = new IdpStore(tmpDir, key);
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('round-trips a secret via setSecret / getSecret', async () => {
        await store.setSecret('idp.example.com', 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
        const got = await store.getSecret('idp.example.com');
        expect(got).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    });

    it('returns null when there is no stored secret for a hostname', async () => {
        expect(await store.getSecret('nonexistent.example.com')).toBeNull();
    });

    it('writes an EncryptedEnvelope to disk — no plaintext secret is visible', async () => {
        const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
        await store.setSecret('idp.example.com', secret);

        const filePath = path.join(tmpDir, 'idp.example.com.json');
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        expect(isEncryptedEnvelope(parsed)).toBe(true);
        // Sanity: the ciphertext should not include the plaintext secret
        expect(content.includes(secret)).toBe(false);
    });

    it('deleteSecret removes the on-disk file and subsequent getSecret returns null', async () => {
        await store.setSecret('idp.example.com', 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
        await store.deleteSecret('idp.example.com');
        expect(await store.getSecret('idp.example.com')).toBeNull();
    });

    it('deleteSecret is a no-op when no file exists (does not throw)', async () => {
        await expect(store.deleteSecret('never-created.example.com')).resolves.toBeUndefined();
    });

    it('setSecret then setSecret overwrites the previous secret', async () => {
        await store.setSecret('idp.example.com', 'OLDSECRETOLDSECRETOLDSECRETOLDSE');
        await store.setSecret('idp.example.com', 'NEWSECRETNEWSECRETNEWSECRETNEWSE');
        expect(await store.getSecret('idp.example.com')).toBe('NEWSECRETNEWSECRETNEWSECRETNEWSE');
    });

    it('sanitizes hostnames — path-traversal characters cannot escape the store dir', async () => {
        // sanitizeId replaces "/" and other unsafe chars with "_". Storing under
        // a hostname like "../etc/passwd" must NOT create a file at ../etc/passwd
        // relative to tmpDir; the file must live inside tmpDir with a mangled name.
        await store.setSecret('../etc/passwd', 'ANYSECRETANYSECRETANYSECRETANYSE');

        // The parent directory must not contain a leaked file.
        const parentDir = path.dirname(tmpDir);
        const escapedPath = path.join(parentDir, 'etc', 'passwd.json');
        await expect(fs.access(escapedPath)).rejects.toThrow();

        // Round-trip must still work through the sanitized filename.
        expect(await store.getSecret('../etc/passwd')).toBe('ANYSECRETANYSECRETANYSECRETANYSE');

        // All actual files must live within tmpDir (no path separators leaked
        // into the filename — sanitizeId replaces "/" with "_", so no on-disk
        // entry can be a subdirectory or an escape).
        const entries = await fs.readdir(tmpDir);
        for (const entry of entries) {
            expect(entry.includes('/')).toBe(false);
            expect(entry.includes(path.sep)).toBe(false);
        }
    });
});
