/**
 * Unified configuration schema for signet.
 * All config lives in ~/.signet/config.yaml — no cascade, no env vars.
 *
 * Strategy config types are defined in core/types.ts (shared vocabulary)
 * and re-exported here for convenience.
 */

import type {
  CredentialType,
  XHeaderConfig,
  StrategyName,
} from '../core/types.js';

// Re-export strategy config types from core/types (the source of truth)
export type {
  CookieStrategyConfig,
  OAuth2StrategyConfig,
  ApiTokenStrategyConfig,
  BasicStrategyConfig,
  StrategyConfig,
  StrategyName,
} from '../core/types.js';

// ============================================================================
// Top-level Config Sections
// ============================================================================

export interface BrowserConfig {
  browserDataDir: string;
  channel: string;
  headlessTimeout: number;
  visibleTimeout: number;
  waitUntil: 'load' | 'networkidle' | 'domcontentloaded' | 'commit';
}

export interface StorageConfig {
  credentialsDir: string;  // MANDATORY
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
  autoSync?: string[];    // Remote names to sync to after refresh
}

export interface WatchEntry {
  interval?: string;                                          // e.g. "1m", "5m"
  providers?: Record<string, WatchProviderEntry | null>;      // provider ID → options (null = watch only)
}

// ============================================================================
// Root Config
// ============================================================================

export type SignetMode = 'browser' | 'browserless';

export interface SignetConfig {
  mode: SignetMode;
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
  strategy: StrategyName;
  config?: Record<string, unknown>;
  acceptedCredentialTypes?: CredentialType[];
  setupInstructions?: string;
  credentialFile?: string;
  xHeaders?: XHeaderConfig[];
  forceVisible?: boolean;
}
