export interface RemoteConfig {
    name: string;
    type: 'ssh';
    host: string;
    user?: string;
    path?: string; // defaults to ~/.signet (base dir)
    sshKey?: string; // path to SSH key
}

export interface SyncResult {
    pushed: string[]; // provider IDs successfully synced
    pulled: string[];
    skipped: string[]; // conflicts (skipped unless --force)
    errors: { providerId: string; error: string }[];
    configSynced: { providers: string[]; error?: string };
}
