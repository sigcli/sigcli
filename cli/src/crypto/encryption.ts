import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { expandHome } from '../utils/path.js';

export interface EncryptedEnvelope {
    version: 1;
    encrypted: true;
    algorithm: 'aes-256-gcm';
    iv: string;
    authTag: string;
    ciphertext: string;
}

const DEFAULT_SIG_DIR = '~/.sig';
const KEY_FILE = 'encryption.key';

export function encrypt(plaintext: string, key: Buffer): EncryptedEnvelope {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
        version: 1,
        encrypted: true,
        algorithm: 'aes-256-gcm',
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        ciphertext: ciphertext.toString('base64'),
    };
}

export function decrypt(envelope: EncryptedEnvelope, key: Buffer): string {
    const iv = Buffer.from(envelope.iv, 'base64');
    const authTag = Buffer.from(envelope.authTag, 'base64');
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function isEncryptedEnvelope(data: unknown): data is EncryptedEnvelope {
    if (data === null || data === undefined || typeof data !== 'object') {
        return false;
    }
    const d = data as Record<string, unknown>;
    return (
        d['encrypted'] === true &&
        d['version'] === 1 &&
        d['algorithm'] === 'aes-256-gcm' &&
        typeof d['iv'] === 'string' &&
        typeof d['authTag'] === 'string' &&
        typeof d['ciphertext'] === 'string'
    );
}

export async function generateEncryptionKey(sigDir?: string): Promise<Buffer> {
    const dir = expandHome(sigDir ?? DEFAULT_SIG_DIR);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });

    const key = randomBytes(32);
    const keyPath = path.join(dir, KEY_FILE);
    await fs.writeFile(keyPath, key.toString('base64') + '\n', { mode: 0o400 });

    return key;
}

export async function loadEncryptionKey(sigDir?: string): Promise<Buffer> {
    const dir = expandHome(sigDir ?? DEFAULT_SIG_DIR);
    const keyPath = path.join(dir, KEY_FILE);

    let raw: string;
    try {
        raw = await fs.readFile(keyPath, 'utf8');
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            return generateEncryptionKey(sigDir);
        }
        throw err;
    }

    const key = Buffer.from(raw.trim(), 'base64');
    if (key.length !== 32) {
        throw new Error(`Invalid encryption key: expected 32 bytes, got ${key.length}`);
    }

    return key;
}
