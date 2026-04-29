import type { IStorage } from './core/interfaces/storage.js';
import type { ILogger, ProviderConfig } from './core/types.js';
import type { SigConfig } from './config/schema.js';
import { AuthManager } from './auth-manager.js';
import { ProviderRegistry } from './providers/provider-registry.js';
import { DirectoryStorage } from './storage/directory-storage.js';
import { CachedStorage } from './storage/cached-storage.js';
import { BrowserSource } from './extraction/browser-source.js';
import { PromptSource } from './extraction/prompt-source.js';
import { buildStrategyConfig } from './config/validator.js';
import { expandHome } from './utils/path.js';
import { loadEncryptionKey } from './crypto/encryption.js';

/**
 * Shared dependency graph used by the CLI and programmatic API.
 */
export interface AuthDeps {
    authManager: AuthManager;
    storage: IStorage;
    providerRegistry: ProviderRegistry;
    config: SigConfig;
    browserAvailable: boolean;
}

/**
 * Create a logger that writes to stderr with level prefixes.
 */
export function createConsoleLogger(): ILogger {
    return {
        debug(message: string, ...args: unknown[]) {
            process.stderr.write(
                `[DEBUG] ${message}${args.length ? ' ' + args.map(String).join(' ') : ''}\n`,
            );
        },
        info(message: string, ...args: unknown[]) {
            process.stderr.write(
                `[INFO] ${message}${args.length ? ' ' + args.map(String).join(' ') : ''}\n`,
            );
        },
        warn(message: string, ...args: unknown[]) {
            process.stderr.write(
                `[WARN] ${message}${args.length ? ' ' + args.map(String).join(' ') : ''}\n`,
            );
        },
        error(message: string, ...args: unknown[]) {
            process.stderr.write(
                `[ERROR] ${message}${args.length ? ' ' + args.map(String).join(' ') : ''}\n`,
            );
        },
    };
}

/**
 * Create the auth dependency graph from a validated SigConfig.
 */
export async function createAuthDeps(
    config: SigConfig,
    options?: { verbose?: boolean },
): Promise<AuthDeps> {
    // 1. Convert config providers to ProviderConfig[]
    const providerConfigs: ProviderConfig[] = Object.entries(config.providers).map(
        ([id, entry]) => ({
            id,
            name: entry.name ?? id,
            domains: entry.domains,
            entryUrl: entry.entryUrl ?? '',
            strategy: entry.strategy ?? entry.source ?? 'browser',
            strategyConfig: entry.strategy ? buildStrategyConfig(entry.strategy, entry.config) : { strategy: 'cookie' as const },
            acceptedCredentialTypes: entry.acceptedCredentialTypes,
            setupInstructions: entry.setupInstructions,
            localStorage: entry.localStorage,
            ...(entry.forceVisible !== undefined ? { forceVisible: entry.forceVisible } : {}),
            ...(entry.proxy !== undefined ? { proxy: entry.proxy } : {}),
            ...(entry.networkProxy !== undefined ? { networkProxy: entry.networkProxy } : {}),
            ...(entry.loginMode !== undefined ? { loginMode: entry.loginMode } : {}),
            // v2 fields
            ...(entry.source !== undefined ? { source: entry.source } : {}),
            ...(entry.extract !== undefined ? { extract: entry.extract } : {}),
            ...(entry.apply !== undefined ? { apply: entry.apply } : {}),
            ...(entry.required !== undefined ? { required: entry.required } : {}),
            ...(entry.cookiePaths !== undefined ? { cookiePaths: entry.cookiePaths } : {}),
            ...(entry.ttl !== undefined ? { ttl: entry.ttl } : {}),
        }),
    );

    const providerRegistry = new ProviderRegistry(providerConfigs);

    // 2. Build storage (CachedStorage wrapping DirectoryStorage)
    const credDir = expandHome(config.storage.credentialsDir);
    const encryptionKey = await loadEncryptionKey();
    const storage = new CachedStorage(new DirectoryStorage(credDir, encryptionKey), {
        ttlMs: 5000,
    });

    // 3. Build AuthManager with source strategies
    const browserConfig = config.browser;
    const browserAvailable = config.mode !== 'browserless';
    const logger = options?.verbose ? createConsoleLogger() : undefined;
    const authManager = new AuthManager({
        storage,
        providerRegistry,
        browserConfig,
        logger,
    });

    // Register source strategies
    if (browserAvailable) {
        authManager.registerSource(new BrowserSource({
            browserDataDir: config.browser.browserDataDir,
            channel: config.browser.channel,
            execPath: config.browser.execPath,
        }));
    }
    authManager.registerSource(new PromptSource());

    return { authManager, storage, providerRegistry, config, browserAvailable };
}
