// Public API exports for SigCLI

// Config types and loader
export type { SigConfig, BrowserConfig, StorageConfig, ProviderEntry } from './config/schema.js';
export { loadConfig, saveConfig, getConfigPath } from './config/loader.js';
export { validateConfig } from './config/validator.js';
export { generateConfigYaml } from './config/generator.js';
export type { InitOptions } from './config/generator.js';

// Core types
export type {
    ProviderConfig,
    StoredCredential,
    StoredEntry,
    ProviderStatus,
    BrowserLaunchOptions,
    ILogger,
    AuthDiagnostics,
    ExtractRule,
    ApplyRule,
} from './types/index.js';

// Result type
export { ok, err, isOk, isErr } from './types/index.js';
export type { Result } from './types/index.js';

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
} from './types/index.js';

// Interfaces
export type { IStorage } from './types/index.js';
export type { IProviderRegistry } from './types/index.js';
export type { IStrategy, ExtractedCredentials } from './types/index.js';
export type { IBrowserExtractor } from './types/index.js';

// Apply engine
export { ApplyEngine } from './apply/apply-engine.js';
export type { ApplyResult } from './apply/apply-engine.js';
export { checkRequired } from './strategies/browser/required-checker.js';

// Strategies
export { BrowserStrategy } from './strategies/browser/index.js';
export { BrowserStrategy as BrowserSource } from './strategies/browser/index.js';
export { PromptStrategy } from './strategies/prompt/index.js';
export { PromptStrategy as PromptSource } from './strategies/prompt/index.js';
export { CdpCookieExtractor } from './strategies/browser/index.js';
export { CdpStorageExtractor } from './strategies/browser/index.js';
export { StrategyRegistry } from './strategies/registry.js';

// AuthManager
export { AuthManager } from './auth-manager.js';

// Credential helpers
export {
    checkTtl,
    validate,
    validateCredential,
    getExpiresAt,
} from './utils/credential-validator.js';

// Storage implementations
export { DirectoryStorage } from './storage/directory-storage.js';
export { CachedStorage } from './storage/cached-storage.js';
export { MemoryStorage } from './storage/memory-storage.js';

// Provider system
export { ProviderRegistry } from './providers/provider-registry.js';
export { createDefaultProvider } from './providers/auto-provision.js';

// Browser detection
export { findChannelBrowser } from './utils/detect.js';
export { detectNativeBrowsers, findNativeBrowser } from './utils/detect-native.js';
export type { NativeBrowserInfo } from './utils/detect-native.js';

// CDP WebSocket client
export { connectCdpWs } from './strategies/browser/cdp-ws.js';
export type { CdpWsClient } from './strategies/browser/cdp-ws.js';

// CLI
export { parseArgs } from './cli-router.js';
export { ExitCode } from './utils/exit-codes.js';

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
    CredentialTypeName,
    LOGIN_URL_PATTERNS,
    HttpHeader,
    AuthScheme,
    APP_NAME,
    APP_VERSION,
    SIG_DIR,
    CONFIG_FILENAME,
} from './types/index.js';
export type { WaitUntilValue } from './types/index.js';

// Logger
export { createConsoleLogger, createOperationalLogger, createNoopLogger } from './utils/logger.js';

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
