/**
 * Unified configuration schema for SigCLI.
 * All config lives in ~/.sig/config.yaml — no cascade, no env vars.
 *
 * Strategy config types are defined in core/types.ts (shared vocabulary)
 * and re-exported here for convenience.
 */

import type {
    CredentialType,
    LocalStorageConfig,
    StrategyName,
    ProxyConfig,
} from '../types/types.js';
import type { WaitUntilValue } from '../types/constants.js';

// Re-export strategy config types from core/types (the source of truth)
export type {
    CookieStrategyConfig,
    OAuth2StrategyConfig,
    ApiTokenStrategyConfig,
    BasicStrategyConfig,
    StrategyConfig,
    StrategyName,
    ProxyConfig,
    ProxyInjectRule,
} from '../types/types.js';

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
    entryUrl?: string;
    // v1 fields
    strategy?: StrategyName;
    config?: Record<string, unknown>;
    acceptedCredentialTypes?: CredentialType[];
    setupInstructions?: string;
    localStorage?: LocalStorageConfig[];
    forceVisible?: boolean;
    proxy?: ProxyConfig;
    // v2 fields
    source?: string;
    extract?: Array<{ from: string; name: string; key: string }>;
    apply?: Array<{ in: string; name: string; value: string }>;
    required?: string[];
    cookiePaths?: string[];
    ttl?: string;
    // shared
    networkProxy?: string;
    loginMode?: string;
}
