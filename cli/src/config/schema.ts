/**
 * Unified configuration schema for SigCLI.
 * All config lives in ~/.sig/config.yaml — no cascade, no env vars.
 */

import type { WaitUntilValue } from '../types/index.js';

// ============================================================================
// Top-level Config Sections
// ============================================================================

export interface BrowserConfig {
    browserDataDir: string;
    execPath: string;
    headlessTimeout: number;
    visibleTimeout: number;
    waitUntil: WaitUntilValue;
}

export interface StorageConfig {
    credentialsDir: string; // MANDATORY
}

export interface RemoteEntry {
    type: 'ssh';
    host: string;
    user?: string;
    path?: string;
    sshKey?: string;
}

// ============================================================================
// Watch Config
// ============================================================================

export interface WatchProviderEntry {
    autoSync?: string[]; // Remote names to sync to after refresh
}

export interface WatchEntry {
    interval: string; // e.g. "1m", "5m"
    providers: Record<string, WatchProviderEntry | null>; // provider ID → options (null = watch only)
}

// ============================================================================
// Root Config
// ============================================================================

export type SigMode = 'browser' | 'browserless';

export interface SigConfig {
    mode: SigMode;
    browser: BrowserConfig;
    storage: StorageConfig;
    remotes?: Record<string, RemoteEntry>;
    providers: Record<string, ProviderEntry>;
    watch?: WatchEntry;
}

// ============================================================================
// Provider Entry (as it appears in YAML)
// ============================================================================

export interface ProviderEntry {
    name?: string;
    domains: string[];
    entryUrl?: string; // Required for browser/prompt; optional for oauth2 (no browser navigation needed)
    validateUrl?: string;
    strategy: 'browser' | 'prompt' | 'oauth2';
    extract?: Array<{
        from: string;
        as: string;
        match: string;
        jsonPath?: string;
        expiresJsonPath?: string;
    }>; // Required for browser/prompt; optional for oauth2 (strategy handles extraction internally)
    apply: Array<{ in: string; name: string; value: string; action?: 'set' | 'append' | 'remove' }>;
    required?: string[];
    cookiePaths?: string[];
    ttl?: string;
    networkProxy?: string;
    loginMode?: 'headless' | 'visible' | 'auto';
    oauth2?: { tokenUrl: string; scopes?: string[] };

    loginUrlPatterns?: string[];
    waitUntil?: WaitUntilValue;
    validateRule?: string;
}
