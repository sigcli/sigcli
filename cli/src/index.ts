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
} from './types/types.js';

// Result type
export { ok, err, isOk, isErr } from './types/result.js';
export type { Result } from './types/result.js';

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
} from './types/errors.js';

// Interfaces
export type { IStorage } from './types/interfaces/storage.js';
export type { IProviderRegistry } from './types/interfaces/provider.js';

// New interfaces (extract/apply redesign)
export type {
    ISourceStrategy,
    ExtractedCredentials,
    ExtractionContext,
} from './types/interfaces/source-strategy.js';
export type { IBrowserExtractor } from './types/interfaces/browser-extractor.js';
export type {
    ExtractRule,
    ApplyRule,
    ProviderConfigV2,
    StoredCredentialV2,
} from './types/extract.js';
export { ApplyEngine } from './apply/apply-engine.js';
export type { ApplyResult } from './apply/apply-engine.js';
export { checkRequired } from './strategies/required-checker.js';
export { BrowserStrategy } from './strategies/browser/index.js';
export { BrowserStrategy as BrowserSource } from './strategies/browser/index.js';
export type { BrowserStrategyOptions } from './strategies/browser/index.js';
export type { BrowserStrategyOptions as BrowserSourceOptions } from './strategies/browser/index.js';
export { PromptStrategy } from './strategies/prompt/index.js';
export { PromptStrategy as PromptSource } from './strategies/prompt/index.js';
export { CookieExtractor } from './strategies/browser/index.js';
export { StorageExtractor } from './strategies/browser/index.js';
export { OAuth2Strategy } from './strategies/oauth2/index.js';
export { StrategyRegistry } from './strategies/registry.js';

// AuthManager
export { AuthManager } from './auth-manager.js';

// Credential helpers
export { extractedToCredential, credentialToExtracted, toV2Config } from './utils/credential-converter.js';
export { checkTtl, validateCredential, getExpiresAt } from './utils/credential-validator.js';

// Storage implementations
export { DirectoryStorage } from './storage/directory-storage.js';
export { CachedStorage } from './storage/cached-storage.js';
export { MemoryStorage } from './storage/memory-storage.js';

// Provider system
export { ProviderRegistry } from './providers/provider-registry.js';
export { createDefaultProvider } from './providers/auto-provision.js';

// Browser detection
export { findChannelBrowser } from './browser/detect.js';
export { detectNativeBrowsers, findNativeBrowser } from './browser/detect-native.js';
export type { NativeBrowserInfo } from './browser/detect-native.js';

// CDP WebSocket client
export { connectCdpWs } from './browser/cdp-ws.js';
export type { CdpWsClient } from './browser/cdp-ws.js';

// CLI
export { parseArgs } from './commands/main.js';
export { ExitCode } from './commands/exit-codes.js';

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
} from './types/constants.js';
export type { WaitUntilValue, LoginModeValue } from './types/constants.js';

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
