import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import type { RemoteConfig } from '../types.js';
import type { StoredCredential } from '../../core/types.js';
import type { ISyncTransport, RemoteEntry } from '../interfaces/transport.js';

const execFileAsync = promisify(execFile);

const DEFAULT_REMOTE_PATH = '~/.signet';

export class SshTransport implements ISyncTransport {
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
                    const data = JSON.parse(content) as {
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
            const data = JSON.parse(stdout) as StoredCredential & {
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

        const content = JSON.stringify(data, null, 2);

        // Write via ssh stdin pipe — avoids scp's tilde expansion issues
        // The remote shell handles ~ expansion in mkdir and cat redirect
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
