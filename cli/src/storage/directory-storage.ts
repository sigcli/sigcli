import fs from 'node:fs/promises';
import path from 'node:path';
import lockfile from 'proper-lockfile';
import type { IStorage } from '../core/interfaces/storage.js';
import type { StoredCredential, StoredEntry } from '../core/types.js';
import { StorageError } from '../core/errors.js';
import { sanitizeId } from '../utils/sanitize.js';

interface ProviderFile {
  version: 1;
  providerId: string;
  credential: StoredCredential['credential'];
  strategy: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Per-provider directory-based storage.
 * Each provider's credentials are stored in a separate JSON file
 * under the configured directory: `{dirPath}/{sanitizedProviderId}.json`.
 *
 * Uses per-file advisory locking via `proper-lockfile` and atomic writes
 * (write to tmp + rename) for safe concurrent access.
 */
export class DirectoryStorage implements IStorage {
  constructor(private readonly dirPath: string) {}

  async get(providerId: string): Promise<StoredCredential | null> {
    const filePath = this.filePathFor(providerId);
    try {
      const data = await this.readFile(filePath);
      return this.toStoredCredential(data);
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw new StorageError('read', (e as Error).message);
    }
  }

  async set(providerId: string, credential: StoredCredential): Promise<void> {
    const filePath = this.filePathFor(providerId);
    await this.ensureDir();

    const data: ProviderFile = {
      version: 1,
      providerId,
      credential: credential.credential,
      strategy: credential.strategy,
      updatedAt: credential.updatedAt,
      ...(credential.metadata ? { metadata: credential.metadata } : {}),
    };

    await this.withLock(filePath, async () => {
      await this.atomicWrite(filePath, data);
    });
  }

  async delete(providerId: string): Promise<void> {
    const filePath = this.filePathFor(providerId);
    try {
      await fs.unlink(filePath);
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        return; // No-op if not found
      }
      throw new StorageError('delete', (e as Error).message);
    }
  }

  async list(): Promise<StoredEntry[]> {
    let files: string[];
    try {
      files = await fs.readdir(this.dirPath);
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw new StorageError('list', (e as Error).message);
    }

    const entries: StoredEntry[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(this.dirPath, file);
      try {
        const data = await this.readFile(filePath);
        entries.push({
          providerId: data.providerId,
          strategy: data.strategy,
          updatedAt: data.updatedAt,
          credentialType: data.credential.type,
        });
      } catch {
        // Skip files that can't be read or parsed
        continue;
      }
    }

    return entries;
  }

  async clear(): Promise<void> {
    let files: string[];
    try {
      files = await fs.readdir(this.dirPath);
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw new StorageError('clear', (e as Error).message);
    }

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(this.dirPath, file);
      try {
        await fs.unlink(filePath);
      } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw new StorageError('clear', (e as Error).message);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private filePathFor(providerId: string): string {
    return path.join(this.dirPath, `${sanitizeId(providerId)}.json`);
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.dirPath, { recursive: true, mode: 0o700 });
  }

  private async readFile(filePath: string): Promise<ProviderFile> {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as ProviderFile;
    if (!data.version || !data.providerId || !data.credential) {
      throw new StorageError('read', `Invalid provider file: ${filePath}`);
    }
    return data;
  }

  private toStoredCredential(data: ProviderFile): StoredCredential {
    return {
      credential: data.credential,
      providerId: data.providerId,
      strategy: data.strategy,
      updatedAt: data.updatedAt,
      ...(data.metadata ? { metadata: data.metadata } : {}),
    };
  }

  private async atomicWrite(filePath: string, data: ProviderFile): Promise<void> {
    try {
      const content = JSON.stringify(data, null, 2);
      const tmpPath = `${filePath}.tmp.${process.pid}`;
      await fs.writeFile(tmpPath, content, { encoding: 'utf-8', mode: 0o600 });
      await fs.rename(tmpPath, filePath);
    } catch (e: unknown) {
      throw new StorageError('write', (e as Error).message);
    }
  }

  private async withLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
    await this.ensureDir();

    // Use a separate .lock file so we never create dummy credential files
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
        throw new StorageError('lock', 'Could not acquire file lock. Another process may be writing.');
      }
      throw e;
    } finally {
      if (release) {
        await release().catch(() => {});
      }
    }
  }
}
