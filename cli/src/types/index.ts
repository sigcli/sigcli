// Barrel re-export for src/types/
// NOTE: Individual modules should import from specific files (e.g., ./types/types.js)
// to avoid naming collisions. This barrel is for external package consumers only.

export type {
    ProviderConfig,
    StoredCredential,
    StoredEntry,
    BrowserLaunchOptions,
    ProviderStatus,
    ILogger,
    AuthDiagnostics,
    ExtractRule,
    ApplyRule,
    ExchangeConfig,
} from './types.js';

export { ok, err, isOk, isErr } from './result.js';
export type { Result } from './result.js';

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
} from './errors.js';
export type { AuthErrorCode } from './errors.js';

export {
    Command,
    RemoteSubcommand,
    SyncSubcommand,
    WatchSubcommand,
    ProxySubcommand,
    WaitUntil,
    CredentialTypeName,
    LOGIN_URL_PATTERNS,
    HttpHeader,
    AuthScheme,
    OutputFormat,
    APP_NAME,
    APP_VERSION,
    SIG_DIR,
    CONFIG_FILENAME,
} from './constants.js';
export type { WaitUntilValue, OutputFormatValue } from './constants.js';

export type { IStrategy, ExtractedCredentials, ExtractionContext } from './interfaces/strategy.js';
export type { IBrowserExtractor } from './interfaces/browser-extractor.js';
export type { IStorage } from './interfaces/storage.js';
export type { IProviderRegistry } from './interfaces/provider.js';
