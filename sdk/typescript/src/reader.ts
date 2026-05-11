import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { decrypt, isEncryptedEnvelope, loadEncryptionKey } from './crypto.js';
import { CredentialNotFoundError, CredentialParseError } from './errors.js';
import type { ProviderFile, ProviderInfo } from './types.js';

const DEFAULT_CREDENTIALS_DIR = path.join(os.homedir(), '.sig', 'credentials');

let cachedKey: Buffer | null = null;

async function getEncryptionKey(): Promise<Buffer> {
    if (!cachedKey) {
        cachedKey = await loadEncryptionKey();
    }
    return cachedKey;
}

function sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function readProviderFile(
    providerId: string,
    credentialsDir: string = DEFAULT_CREDENTIALS_DIR,
): Promise<ProviderFile> {
    const filePath = path.join(credentialsDir, `${sanitizeId(providerId)}.json`);
    let content: string;
    try {
        content = await fs.readFile(filePath, 'utf-8');
    } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new CredentialNotFoundError(providerId);
        }
        throw e;
    }
    try {
        let parsed: unknown = JSON.parse(content);
        if (isEncryptedEnvelope(parsed)) {
            const key = await getEncryptionKey();
            parsed = JSON.parse(decrypt(parsed, key));
        }
        const data = parsed as Record<string, unknown>;
        if (!data['providerId']) {
            throw new Error('Missing required fields');
        }
        const values = (data['values'] ?? data['credentials'] ?? {}) as Record<string, string>;
        return {
            providerId: data['providerId'] as string,
            strategy: (data['strategy'] as string) ?? '',
            updatedAt: (data['updatedAt'] as string) ?? '',
            ...(data['expiresAt'] !== undefined ? { expiresAt: data['expiresAt'] as string } : {}),
            values,
            ...(data['oauth2'] !== undefined
                ? { oauth2: data['oauth2'] as ProviderFile['oauth2'] }
                : {}),
        };
    } catch (e) {
        if (e instanceof CredentialNotFoundError) throw e;
        throw new CredentialParseError(filePath, e instanceof Error ? e : undefined);
    }
}

export async function listProviderFiles(
    credentialsDir: string = DEFAULT_CREDENTIALS_DIR,
): Promise<ProviderInfo[]> {
    let files: string[];
    try {
        files = await fs.readdir(credentialsDir);
    } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw e;
    }
    const results: ProviderInfo[] = [];
    for (const file of files) {
        if (!file.endsWith('.json') || file.endsWith('.lock')) continue;
        try {
            const content = await fs.readFile(path.join(credentialsDir, file), 'utf-8');
            let parsed: unknown = JSON.parse(content);
            if (isEncryptedEnvelope(parsed)) {
                const key = await getEncryptionKey();
                parsed = JSON.parse(decrypt(parsed, key));
            }
            const data = parsed as Record<string, unknown>;
            if (data['providerId'] && (data['values'] || data['credentials'])) {
                results.push({
                    providerId: data['providerId'] as string,
                    strategy: (data['strategy'] as string) ?? '',
                    updatedAt: (data['updatedAt'] as string) ?? '',
                    ...(data['expiresAt'] !== undefined
                        ? { expiresAt: data['expiresAt'] as string }
                        : {}),
                });
            }
        } catch {
            /* skip unparseable files */
        }
    }
    return results;
}
