import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { ProviderFile, ProviderInfo } from './types.js';
import { CredentialNotFoundError, CredentialParseError } from './errors.js';
import { isEncryptedEnvelope, decrypt, loadEncryptionKey } from './crypto.js';

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
        const data = parsed as ProviderFile;
        if (!data.version || !data.providerId || !data.credential) {
            throw new Error('Missing required fields');
        }
        return data;
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
            const data = parsed as ProviderFile;
            if (data.providerId && data.credential) {
                results.push({
                    providerId: data.providerId,
                    credentialType: data.credential.type,
                    strategy: data.strategy,
                    updatedAt: data.updatedAt,
                });
            }
        } catch {
            /* skip unparseable files */
        }
    }
    return results;
}
