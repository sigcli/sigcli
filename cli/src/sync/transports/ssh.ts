import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import type { RemoteConfig } from '../types.js';
import type { StoredCredential } from '../../core/types.js';

const execFileAsync = promisify(execFile);

const DEFAULT_REMOTE_PATH = '~/.signet/credentials';

export class SshTransport {

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

  /** List provider files on the remote */
  async listRemote(remote: RemoteConfig): Promise<{ providerId: string; updatedAt: string; filename: string }[]> {
    const target = this.remoteTarget(remote);
    const rpath = this.remotePath(remote);

    try {
      const { stdout } = await execFileAsync('ssh', [
        ...this.sshArgs(remote),
        target,
        `find ${rpath} -maxdepth 1 -name '*.json' -print 2>/dev/null || true`,
      ]);

      const files = stdout.trim().split('\n').filter(Boolean);
      const entries: { providerId: string; updatedAt: string; filename: string }[] = [];

      for (const file of files) {
        const filename = path.basename(file);
        try {
          const { stdout: content } = await execFileAsync('ssh', [
            ...this.sshArgs(remote),
            target,
            `cat "${file}"`,
          ]);
          const data = JSON.parse(content);
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
    const rpath = this.remotePath(remote);

    try {
      const { stdout } = await execFileAsync('ssh', [
        ...this.sshArgs(remote),
        target,
        `cat ${rpath}/"${filename}"`,
      ]);
      const data = JSON.parse(stdout);
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
  async writeRemote(remote: RemoteConfig, filename: string, stored: StoredCredential): Promise<void> {
    const rpath = this.remotePath(remote);

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

  private sshWrite(remote: RemoteConfig, command: string, stdin: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const target = this.remoteTarget(remote);
      const proc = execFile('ssh', [
        ...this.sshArgs(remote),
        target,
        command,
      ], (error) => {
        if (error) reject(error);
        else resolve();
      });

      proc.stdin?.write(stdin);
      proc.stdin?.end();
    });
  }
}
