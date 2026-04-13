import { EventEmitter } from 'node:events';
import path from 'node:path';
import os from 'node:os';
import type { Credential, ProviderInfo } from './types.js';
import { readProviderFile, listProviderFiles } from './reader.js';
import { formatHeaders, extractLocalStorage } from './formatter.js';
import { CredentialWatcher } from './watcher.js';

export interface SignetClientOptions {
  /** Path to credentials directory. Defaults to ~/.signet/credentials */
  credentialsDir?: string;
}

export interface SignetClientEvents {
  change: [providerId: string, headers: Record<string, string>];
  error: [error: Error];
}

export class SignetClient extends EventEmitter<SignetClientEvents> {
  private readonly credentialsDir: string;
  private watcher: CredentialWatcher | null = null;

  constructor(opts?: SignetClientOptions) {
    super();
    this.credentialsDir = opts?.credentialsDir
      ?? path.join(os.homedir(), '.signet', 'credentials');
  }

  /** Get HTTP headers for a provider, ready to use with fetch/axios. */
  async getHeaders(providerId: string): Promise<Record<string, string>> {
    const file = await readProviderFile(providerId, this.credentialsDir);
    return formatHeaders(file.credential);
  }

  /** Get the raw credential object. Returns null if not found. */
  async getCredential(providerId: string): Promise<Credential | null> {
    try {
      const file = await readProviderFile(providerId, this.credentialsDir);
      return file.credential;
    } catch {
      return null;
    }
  }

  /** Get extracted localStorage values. Returns empty object if not found. */
  async getLocalStorage(providerId: string): Promise<Record<string, string>> {
    try {
      const file = await readProviderFile(providerId, this.credentialsDir);
      return extractLocalStorage(file.credential);
    } catch {
      return {};
    }
  }

  /** List all provider IDs that have credential files. */
  async listProviders(): Promise<ProviderInfo[]> {
    return listProviderFiles(this.credentialsDir);
  }

  /** Start watching the credentials directory for changes. */
  watch(): void {
    if (this.watcher) return;
    this.watcher = new CredentialWatcher(this.credentialsDir);

    this.watcher.on('change', async (providerId: string) => {
      try {
        const headers = await this.getHeaders(providerId);
        this.emit('change', providerId, headers);
      } catch {
        this.emit('change', providerId, {});
      }
    });

    this.watcher.on('error', (err: Error) => {
      this.emit('error', err);
    });

    this.watcher.start();
  }

  /** Stop watching and clean up resources. */
  close(): void {
    if (this.watcher) {
      this.watcher.stop();
      this.watcher = null;
    }
  }
}
