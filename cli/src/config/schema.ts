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
    channel: string;
    headlessTimeout: number;
    visibleTimeout: number;
    waitUntil: WaitUntilValue;
    execPath?: string; // Native browser binary path for CDP mode
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
    entryUrl: string;
    strategy: 'browser' | 'prompt';
    extract: Array<{ from: string; name: string; key: string }>;
    apply: Array<{ in: string; name: string; value: string; action?: 'set' | 'append' | 'remove' }>;
    required?: string[];
    cookiePaths?: string[];
    ttl?: string;
    networkProxy?: string;
    loginMode?: string;
    loginPatterns?: string[];
    waitUntil?: WaitUntilValue;
}
