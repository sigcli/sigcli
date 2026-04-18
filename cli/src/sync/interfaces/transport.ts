import type { RemoteConfig } from '../types.js';
import type { StoredCredential } from '../../core/types.js';

export interface RemoteEntry {
    providerId: string;
    updatedAt: string;
    filename: string;
}

export interface ISyncTransport {
    listRemote(remote: RemoteConfig): Promise<RemoteEntry[]>;
    readRemote(remote: RemoteConfig, filename: string): Promise<StoredCredential | null>;
    writeRemote(remote: RemoteConfig, filename: string, stored: StoredCredential): Promise<void>;
    readRemoteConfig(remote: RemoteConfig): Promise<string | null>;
    writeRemoteConfig(remote: RemoteConfig, content: string): Promise<void>;
}
