/**
 * Encrypted per-hostname TOTP secret store at `~/.sig/idps/`.
 *
 * Deliberately separate from `DirectoryStorage` (which is for provider
 * credentials): mixing them would pollute `sig providers` / `sig status`
 * listings and blur the security boundary between "credentials I fetch"
 * and "secrets I use to fetch credentials".
 *
 * Uses the same atomic-write + file-lock pattern as `DirectoryStorage`.
 */

import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import lockfile from 'proper-lockfile';

import { StorageError } from '../types/index.js';
import { decrypt, encrypt, isEncryptedEnvelope } from '../crypto/encryption.js';
import { restrictFileWindows } from '../utils/restrict-windows.js';
import { sanitizeId } from '../utils/sanitize.js';

interface IdpSecretFile {
    version: 1;
    hostname: string;
    totpSecret: string;
    updatedAt: string;
}

export class IdpStore {
    constructor(
        private readonly dirPath: string,
        private readonly encryptionKey: Buffer,
    ) {}

    async getSecret(hostname: string): Promise<string | null> {
        const filePath = this.filePathFor(hostname);
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const parsed: unknown = JSON.parse(content);
            let raw: Record<string, unknown>;
            if (isEncryptedEnvelope(parsed)) {
                raw = JSON.parse(decrypt(parsed, this.encryptionKey)) as Record<string, unknown>;
            } else {
                // Legacy / unencrypted — read but do not warn (secret store is new)
                raw = parsed as Record<string, unknown>;
            }
            const totpSecret = raw.totpSecret;
            if (typeof totpSecret !== 'string' || totpSecret.length === 0) return null;
            return totpSecret;
        } catch (e: unknown) {
            if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
            throw new StorageError('read', (e as Error).message);
        }
    }

    async setSecret(hostname: string, totpSecret: string): Promise<void> {
        const filePath = this.filePathFor(hostname);
        await this.ensureDir();

        const data: IdpSecretFile = {
            version: 1,
            hostname,
            totpSecret,
            updatedAt: new Date().toISOString(),
        };

        await this.withLock(filePath, async () => {
            await this.atomicWrite(filePath, data);
        });
    }

    async deleteSecret(hostname: string): Promise<void> {
        const filePath = this.filePathFor(hostname);
        try {
            await fs.unlink(filePath);
        } catch (e: unknown) {
            if ((e as NodeJS.ErrnoException).code === 'ENOENT') return;
            throw new StorageError('delete', (e as Error).message);
        }
    }

    // ---------------------------------------------------------------------------
    // Private helpers — mirrors DirectoryStorage
    // ---------------------------------------------------------------------------

    private filePathFor(hostname: string): string {
        return path.join(this.dirPath, `${sanitizeId(hostname)}.json`);
    }

    private async ensureDir(): Promise<void> {
        await fs.mkdir(this.dirPath, { recursive: true, mode: 0o700 });
    }

    private async atomicWrite(filePath: string, data: IdpSecretFile): Promise<void> {
        const tmpPath = `${filePath}.tmp.${randomBytes(8).toString('hex')}`;
        try {
            const plaintext = JSON.stringify(data, null, 2);
            const envelope = encrypt(plaintext, this.encryptionKey);
            const content = JSON.stringify(envelope, null, 2);
            await fs.writeFile(tmpPath, content, { encoding: 'utf-8', mode: 0o600 });
            await fs.rename(tmpPath, filePath);
            await restrictFileWindows(filePath);
        } catch (e: unknown) {
            await fs.unlink(tmpPath).catch(() => {});
            throw new StorageError('write', (e as Error).message);
        }
    }

    private async withLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
        await this.ensureDir();
        const lockPath = `${filePath}.lock`;
        await fs.writeFile(lockPath, '', { flag: 'a', mode: 0o600 });

        let release: (() => Promise<void>) | undefined;
        try {
            release = await lockfile.lock(lockPath, {
                retries: { retries: 5, minTimeout: 100, maxTimeout: 1000 },
                stale: 10000,
            });
            return await fn();
        } catch (e: unknown) {
            if ((e as Error).message?.includes('ELOCKED')) {
                throw new StorageError(
                    'lock',
                    'Could not acquire file lock. Another process may be writing.',
                );
            }
            throw e;
        } finally {
            if (release) {
                await release().catch(() => {});
            }
        }
    }
}
