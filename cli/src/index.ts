// Public API exports for SigCLI

// Config types and loader
export type { SigConfig, BrowserConfig, StorageConfig, ProviderEntry } from './config/schema.js';
export { loadConfig, saveConfig, getConfigPath } from './config/loader.js';
export { validateConfig } from './config/validator.js';
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
    StoredCredential,
    StoredEntry,
    ProviderStatus,
    BrowserLaunchOptions,
    ILogger,
    LocalStorageConfig,
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
    EncryptionError,
} from './core/errors.js';

// Interfaces
export type {
    IBrowserAdapter,
    IBrowserSession,
    IBrowserPage,
    NavigateOptions,
    PageRequest,
    PageResponse,
} from './core/interfaces/browser-adapter.js';
export type { IStorage } from './core/interfaces/storage.js';
export type { IProviderRegistry } from './core/interfaces/provider.js';

// New interfaces (extract/apply redesign)
export type {
    ISourceStrategy,
    ExtractedCredentials,
    ExtractionContext,
} from './core/interfaces/source-strategy.js';
export type { IBrowserExtractor } from './core/interfaces/browser-extractor.js';
export type {
    ExtractRule,
    ApplyRule,
    ProviderConfigV2,
    StoredCredentialV2,
} from './core/types/extract.js';
export { applyRules, interpolate } from './apply/engine.js';
export type { ApplyResult } from './apply/engine.js';
export { checkRequired } from './extraction/required-checker.js';
export { BrowserSource } from './extraction/browser-source.js';
export type { BrowserSourceOptions } from './extraction/browser-source.js';
export { PromptSource } from './extraction/prompt-source.js';
export { EnvSource } from './extraction/env-source.js';
export { CookieExtractor } from './extraction/cookie-extractor.js';
export { StorageExtractor } from './extraction/storage-extractor.js';

// AuthManager
export { AuthManager } from './auth-manager.js';

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
export { detectNativeBrowsers, findNativeBrowser } from './browser/detect-native.js';
export type { NativeBrowserInfo } from './browser/detect-native.js';

// CDP WebSocket client
export { connectCdpWs } from './browser/cdp-ws.js';
export type { CdpWsClient } from './browser/cdp-ws.js';

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
    LoginMode,
    CredentialTypeName,
    LOGIN_URL_PATTERNS,
    HttpHeader,
    AuthScheme,
    APP_NAME,
    APP_VERSION,
    SIG_DIR,
    CONFIG_FILENAME,
} from './core/constants.js';
export type { WaitUntilValue, LoginModeValue } from './core/constants.js';

// Utilities
export { decodeJwt, isJwtExpired, getJwtExpiresAt } from './utils/jwt.js';
export { parseDuration, formatDuration } from './utils/duration.js';
export { buildUserAgent } from './utils/http.js';
export { sanitizeId } from './utils/sanitize.js';
export { expandHome } from './utils/path.js';

// Crypto
export {
    encrypt,
    decrypt,
    isEncryptedEnvelope,
    loadEncryptionKey,
    generateEncryptionKey,
} from './crypto/encryption.js';
export type { EncryptedEnvelope } from './crypto/encryption.js';

// Audit
export { logAuditEvent, AuditAction, AuditStatus } from './audit/audit-log.js';
export type {
    AuditEntry,
    AuditEventParams,
    AuditActionValue,
    AuditStatusValue,
} from './audit/audit-log.js';
