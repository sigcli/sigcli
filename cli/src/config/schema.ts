/**
 * Unified configuration schema for SigCLI.
 * All config lives in ~/.sig/config.yaml — no cascade, no env vars.
 *
 * Strategy config types are defined in core/types.ts (shared vocabulary)
 * and re-exported here for convenience.
 */

import type {
    CredentialType,
    XHeaderConfig,
    LocalStorageConfig,
    StrategyName,
    ProxyConfig,
} from '../core/types.js';
import type { WaitUntilValue } from '../core/constants.js';

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
} from '../core/types.js';

// ============================================================================
// Top-level Config Sections
// ============================================================================

export interface BrowserConfig {
    browserDataDir: string;
    channel: string;
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
    entryUrl: string;
    strategy: StrategyName;
    config?: Record<string, unknown>;
    acceptedCredentialTypes?: CredentialType[];
    setupInstructions?: string;
    xHeaders?: XHeaderConfig[];
    localStorage?: LocalStorageConfig[];
    forceVisible?: boolean;
    proxy?: ProxyConfig;
}
