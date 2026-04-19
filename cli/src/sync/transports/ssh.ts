import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import type { RemoteConfig } from '../types.js';
import type { StoredCredential } from '../../core/types.js';
import type { ISyncTransport, RemoteEntry } from '../interfaces/transport.js';
import { encrypt, decrypt, isEncryptedEnvelope } from '../../crypto/encryption.js';

const execFileAsync = promisify(execFile);

const DEFAULT_REMOTE_PATH = '~/.sig';

export class SshTransport implements ISyncTransport {
    private remoteKeyCache = new Map<string, Buffer>();

    private remoteKeyCacheKey(remote: RemoteConfig): string {
        return `${remote.host}:${remote.user ?? 'default'}`;
    }

    async fetchRemoteKey(remote: RemoteConfig): Promise<Buffer> {
        const cacheKey = this.remoteKeyCacheKey(remote);
        const cached = this.remoteKeyCache.get(cacheKey);
        if (cached) return cached;

        const target = this.remoteTarget(remote);
        const rpath = this.remotePath(remote);
        const keyFile = `${rpath}/encryption.key`;

        try {
            const { stdout } = await execFileAsync('ssh', [
                ...this.sshArgs(remote),
                target,
                `cat ${keyFile}`,
            ]);
            const key = Buffer.from(stdout.trim(), 'base64');
            if (key.length !== 32) {
                throw new Error(
                    `Invalid remote encryption key: expected 32 bytes, got ${key.length}`,
                );
            }
            this.remoteKeyCache.set(cacheKey, key);
            return key;
        } catch (e: unknown) {
            const msg = (e as Error).message ?? '';
            if (
                msg.includes('No such file') ||
                msg.includes('ENOENT') ||
                msg.includes('Command failed')
            ) {
                const { randomBytes } = await import('node:crypto');
                const key = randomBytes(32);
                const keyBase64 = key.toString('base64') + '\n';
                await this.sshWrite(
                    remote,
                    `mkdir -p ${rpath} && cat > ${rpath}/encryption.key && chmod 400 ${rpath}/encryption.key`,
                    keyBase64,
                );
                this.remoteKeyCache.set(cacheKey, key);
                return key;
            }
            throw e;
        }
    }

    private sshArgs(remote: RemoteConfig): string[] {
        const args: string[] = [];
        if (remote.sshKey) args.push('-i', remote.sshKey);
        args.push('-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new');
        return args;
    }

    private remoteTarget(remote: RemoteConfig): string {
        const user = remote.user ?? os.userInfo().username;
        return `${user}@${remote.host}`;
    }

    private remotePath(remote: RemoteConfig): string {
        return remote.path ?? DEFAULT_REMOTE_PATH;
    }

    private remoteCredentialsPath(remote: RemoteConfig): string {
        return `${this.remotePath(remote)}/credentials`;
    }

    /** List provider files on the remote */
    async listRemote(remote: RemoteConfig): Promise<RemoteEntry[]> {
        const target = this.remoteTarget(remote);
        const rpath = this.remoteCredentialsPath(remote);

        try {
            const { stdout } = await execFileAsync('ssh', [
                ...this.sshArgs(remote),
                target,
                `find ${rpath} -maxdepth 1 -name '*.json' -print 2>/dev/null || true`,
            ]);

            const files = stdout.trim().split('\n').filter(Boolean);
            const entries: RemoteEntry[] = [];

            for (const file of files) {
                const filename = path.basename(file);
                try {
                    const { stdout: content } = await execFileAsync('ssh', [
                        ...this.sshArgs(remote),
                        target,
                        `cat "${file}"`,
                    ]);
                    let parsed: unknown = JSON.parse(content);
                    if (isEncryptedEnvelope(parsed)) {
                        const remoteKey = await this.fetchRemoteKey(remote);
                        parsed = JSON.parse(decrypt(parsed, remoteKey));
                    }
                    const data = parsed as {
                        providerId: string;
                        updatedAt: string;
                    };
                    entries.push({
                        providerId: data.providerId,
                        updatedAt: data.updatedAt,
                        filename,
                    });
                } catch {
                    // Skip unreadable files
                }
            }

            return entries;
        } catch {
            return [];
        }
    }

    /** Read a single credential from remote */
    async readRemote(remote: RemoteConfig, filename: string): Promise<StoredCredential | null> {
        const target = this.remoteTarget(remote);
        const rpath = this.remoteCredentialsPath(remote);

        try {
            const { stdout } = await execFileAsync('ssh', [
                ...this.sshArgs(remote),
                target,
                `cat ${rpath}/"${filename}"`,
            ]);
            let parsed: unknown = JSON.parse(stdout);
            if (isEncryptedEnvelope(parsed)) {
                const remoteKey = await this.fetchRemoteKey(remote);
                parsed = JSON.parse(decrypt(parsed, remoteKey));
            }
            const data = parsed as StoredCredential & {
                version?: number;
                metadata?: Record<string, unknown>;
            };
            return {
                credential: data.credential,
                providerId: data.providerId,
                strategy: data.strategy,
                updatedAt: data.updatedAt,
                ...(data.metadata ? { metadata: data.metadata } : {}),
            };
        } catch {
            return null;
        }
    }

    /** Write a credential file to remote via ssh pipe (avoids scp tilde issues) */
    async writeRemote(
        remote: RemoteConfig,
        filename: string,
        stored: StoredCredential,
    ): Promise<void> {
        const rpath = this.remoteCredentialsPath(remote);

        const data = {
            version: 1,
            providerId: stored.providerId,
            credential: stored.credential,
            strategy: stored.strategy,
            updatedAt: stored.updatedAt,
            ...(stored.metadata ? { metadata: stored.metadata } : {}),
        };

        const remoteKey = await this.fetchRemoteKey(remote);
        const plaintext = JSON.stringify(data, null, 2);
        const envelope = encrypt(plaintext, remoteKey);
        const content = JSON.stringify(envelope, null, 2);

        await this.sshWrite(remote, `mkdir -p ${rpath} && cat > ${rpath}/"${filename}"`, content);
    }

    /** Read config.yaml from the remote base directory */
    async readRemoteConfig(remote: RemoteConfig): Promise<string | null> {
        const target = this.remoteTarget(remote);
        const rpath = this.remotePath(remote);

        try {
            const { stdout } = await execFileAsync('ssh', [
                ...this.sshArgs(remote),
                target,
                `cat ${rpath}/config.yaml`,
            ]);
            return stdout;
        } catch {
            return null;
        }
    }

    /** Write config.yaml to the remote base directory */
    async writeRemoteConfig(remote: RemoteConfig, content: string): Promise<void> {
        const rpath = this.remotePath(remote);
        await this.sshWrite(remote, `mkdir -p ${rpath} && cat > ${rpath}/config.yaml`, content);
    }

    private sshWrite(remote: RemoteConfig, command: string, stdin: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const target = this.remoteTarget(remote);
            const proc = execFile('ssh', [...this.sshArgs(remote), target, command], (error) => {
                if (error) reject(error as Error);
                else resolve();
            });

            proc.stdin?.write(stdin);
            proc.stdin?.end();
        });
    }
}
