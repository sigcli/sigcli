import { EventEmitter } from 'node:events';
import os from 'node:os';
import path from 'node:path';

import { listProviderFiles, readProviderFile } from './reader.js';
import type { ProviderFile, ProviderInfo } from './types.js';
import { CredentialWatcher } from './watcher.js';

export interface SigClientOptions {
    credentialsDir?: string;
}

export interface SigClientEvents {
    change: [providerId: string, credential: ProviderFile];
    error: [error: Error];
}

export class SigClient extends EventEmitter<SigClientEvents> {
    private readonly credentialsDir: string;
    private watcher: CredentialWatcher | null = null;

    constructor(opts?: SigClientOptions) {
        super();
        this.credentialsDir =
            opts?.credentialsDir ?? path.join(os.homedir(), '.sig', 'credentials');
    }

    async getCredential(providerId: string): Promise<ProviderFile> {
        return readProviderFile(providerId, this.credentialsDir);
    }

    async listProviders(): Promise<ProviderInfo[]> {
        return listProviderFiles(this.credentialsDir);
    }

    watch(): void {
        if (this.watcher) return;
        this.watcher = new CredentialWatcher(this.credentialsDir);

        this.watcher.on('change', (providerId: string) => {
            void (async () => {
                try {
                    const credential = await this.getCredential(providerId);
                    this.emit('change', providerId, credential);
                } catch {
                    // File was deleted or unparseable - skip
                }
            })();
        });

        this.watcher.on('error', (err: Error) => {
            this.emit('error', err);
        });

        this.watcher.start();
    }

    close(): void {
        if (this.watcher) {
            this.watcher.stop();
            this.watcher = null;
        }
    }
}
