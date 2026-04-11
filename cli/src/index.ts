// Public API exports for signet

// Config types and loader
export type {
  SignetConfig,
  BrowserConfig,
  StorageConfig,
  ProviderEntry,
} from './config/schema.js';
export { loadConfig, saveConfig, getConfigPath } from './config/loader.js';
export { validateConfig, buildStrategyConfig } from './config/validator.js';
export { generateConfigYaml } from './config/generator.js';
export type { InitOptions } from './config/generator.js';

// Dependency wiring
export { createAuthDeps } from './deps.js';
export type { AuthDeps } from './deps.js';

// Core types
export type {
  Credential,
  CookieCredential,
  BearerCredential,
  ApiKeyCredential,
  BasicCredential,
  CredentialType,
  Cookie,
  ProviderConfig,
  StrategyConfig,
  CookieStrategyConfig,
  OAuth2StrategyConfig,
  ApiTokenStrategyConfig,
  BasicStrategyConfig,
  StoredCredential,
  StoredEntry,
  ProviderStatus,
  BrowserLaunchOptions,
  ILogger,
  XHeaderConfig,
  AuthDiagnostics,
  CredentialResult,
} from './core/types.js';

// Result type
export { ok, err, isOk, isErr } from './core/result.js';
export type { Result } from './core/result.js';

// Errors
export {
  AuthError,
  ProviderNotFoundError,
  CredentialNotFoundError,
  CredentialExpiredError,
  CredentialTypeError,
  RefreshError,
  BrowserError,
  BrowserLaunchError,
  BrowserTimeoutError,
  BrowserNavigationError,
  StorageError,
  ConfigError,
  ManualSetupRequired,
  SyncError,
  RemoteNotFoundError,
  BrowserUnavailableError,
  SyncConflictError,
} from './core/errors.js';

// Interfaces (for implementing custom adapters/strategies)
export type { IAuthStrategy, IAuthStrategyFactory, AuthContext } from './core/interfaces/auth-strategy.js';
export type { IBrowserAdapter, IBrowserSession, IBrowserPage, NavigateOptions, PageRequest, PageResponse } from './core/interfaces/browser-adapter.js';
export type { IStorage } from './core/interfaces/storage.js';
export type { IProviderRegistry } from './core/interfaces/provider.js';

// AuthManager
export { AuthManager } from './auth-manager.js';

// Strategy factories (for custom registration)
export { CookieStrategyFactory } from './strategies/cookie.strategy.js';
export { OAuth2StrategyFactory } from './strategies/oauth2.strategy.js';
export { ApiTokenStrategyFactory } from './strategies/api-token.strategy.js';
export { BasicAuthStrategyFactory } from './strategies/basic-auth.strategy.js';
export { StrategyRegistry } from './strategies/registry.js';

// Storage implementations
export { DirectoryStorage } from './storage/directory-storage.js';
export { CachedStorage } from './storage/cached-storage.js';
export { MemoryStorage } from './storage/memory-storage.js';

// Provider system
export { ProviderRegistry } from './providers/provider-registry.js';
export { createDefaultProvider } from './providers/auto-provision.js';

// Browser adapters
export { PlaywrightAdapter } from './browser/adapters/playwright.adapter.js';
export { NullBrowserAdapter } from './browser/adapters/null.adapter.js';

// Browser detection
export { findChannelBrowser } from './browser/detect.js';

// CLI
export { parseArgs } from './cli/main.js';
export { ExitCode } from './cli/exit-codes.js';

// Sync
export { SyncEngine } from './sync/sync-engine.js';
export { SshTransport } from './sync/transports/ssh.js';
export { getRemotes, getRemote, addRemote, removeRemote } from './sync/remote-config.js';
export type { RemoteConfig, SyncResult } from './sync/types.js';
export type { ISyncTransport, RemoteEntry } from './sync/interfaces/transport.js';

// Constants
export {
  Command,
  RemoteSubcommand,
  SyncSubcommand,
  WatchSubcommand,
  WaitUntil,
  StrategyName,
  CredentialTypeName,
  LOGIN_URL_PATTERNS,
  BROWSER_REQUIRED_STRATEGIES,
  HttpHeader,
  AuthScheme,
  APP_NAME,
  APP_VERSION,
  SIGNET_DIR,
  CONFIG_FILENAME,
} from './core/constants.js';
export type { WaitUntilValue } from './core/constants.js';

// Utilities
export { decodeJwt, isJwtExpired, getJwtExpiresAt } from './utils/jwt.js';
export { parseDuration, formatDuration } from './utils/duration.js';
export { buildUserAgent } from './utils/http.js';
export { sanitizeId } from './utils/sanitize.js';
export { expandHome } from './utils/path.js';
