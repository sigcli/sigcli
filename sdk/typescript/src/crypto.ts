import { createDecipheriv } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export interface EncryptedEnvelope {
    version: 1;
    encrypted: true;
    algorithm: 'aes-256-gcm';
    iv: string;
    authTag: string;
    ciphertext: string;
}

const DEFAULT_SIG_DIR = path.join(os.homedir(), '.sig');
const KEY_FILE = 'encryption.key';

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

export async function loadEncryptionKey(sigDir?: string): Promise<Buffer> {
    const dir = sigDir ?? DEFAULT_SIG_DIR;
    const keyPath = path.join(dir, KEY_FILE);

    let raw: string;
    try {
        raw = await fs.readFile(keyPath, 'utf8');
    } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(
                'Encryption key not found at ' + keyPath + '. Run "sig init" to generate one.',
                { cause: e },
            );
        }
        throw e;
    }

    const key = Buffer.from(raw.trim(), 'base64');
    if (key.length !== 32) {
        throw new Error(`Invalid encryption key: expected 32 bytes, got ${key.length}`);
    }

    return key;
}
