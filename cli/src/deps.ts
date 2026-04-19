import type { IStorage } from './core/interfaces/storage.js';
import type { ILogger, ProviderConfig } from './core/types.js';
import type { SigConfig } from './config/schema.js';
import { AuthManager } from './auth-manager.js';
import { StrategyRegistry } from './strategies/registry.js';
import { CookieStrategyFactory } from './strategies/cookie.strategy.js';
import { OAuth2StrategyFactory } from './strategies/oauth2.strategy.js';
import { ApiTokenStrategyFactory } from './strategies/api-token.strategy.js';
import { BasicAuthStrategyFactory } from './strategies/basic-auth.strategy.js';
import { ProviderRegistry } from './providers/provider-registry.js';
import { DirectoryStorage } from './storage/directory-storage.js';
import { CachedStorage } from './storage/cached-storage.js';
import { PlaywrightAdapter } from './browser/adapters/playwright.adapter.js';
import { NullBrowserAdapter } from './browser/adapters/null.adapter.js';
import { buildStrategyConfig } from './config/validator.js';
import { expandHome } from './utils/path.js';

/**
 * Shared dependency graph used by the CLI and programmatic API.
 */
export interface AuthDeps {
    authManager: AuthManager;
    storage: IStorage;
    providerRegistry: ProviderRegistry;
    strategyRegistry: StrategyRegistry;
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
 * No env vars, no cascade — config is the single source of truth.
 */
export function createAuthDeps(config: SigConfig, options?: { verbose?: boolean }): AuthDeps {
    // 1. Convert config providers to ProviderConfig[]
    const providerConfigs: ProviderConfig[] = Object.entries(config.providers).map(
        ([id, entry]) => ({
            id,
            name: entry.name ?? id,
            domains: entry.domains,
            entryUrl: entry.entryUrl,
            strategy: entry.strategy,
            strategyConfig: buildStrategyConfig(entry.strategy, entry.config),
            acceptedCredentialTypes: entry.acceptedCredentialTypes,
            setupInstructions: entry.setupInstructions,
            xHeaders: entry.xHeaders,
            localStorage: entry.localStorage,
            ...(entry.forceVisible !== undefined ? { forceVisible: entry.forceVisible } : {}),
        }),
    );

    const providerRegistry = new ProviderRegistry(providerConfigs);

    // 2. Build strategy registry with built-in strategies
    const strategyRegistry = new StrategyRegistry();
    strategyRegistry.register(new CookieStrategyFactory());
    strategyRegistry.register(new OAuth2StrategyFactory());
    strategyRegistry.register(new ApiTokenStrategyFactory());
    strategyRegistry.register(new BasicAuthStrategyFactory());

    // 3. Build storage (CachedStorage wrapping DirectoryStorage)
    const credDir = expandHome(config.storage.credentialsDir);
    const storage = new CachedStorage(new DirectoryStorage(credDir), { ttlMs: 5000 });

    // 4. Build browser adapter factory using config.browser
    const browserConfig = config.browser;
    const browserAvailable = config.mode !== 'browserless';
    const browserAdapterFactory = browserAvailable
        ? () => new PlaywrightAdapter(browserConfig)
        : () => new NullBrowserAdapter('Running in browserless mode (mode: browserless)');

    // 5. Build AuthManager
    const logger = options?.verbose ? createConsoleLogger() : undefined;
    const authManager = new AuthManager({
        storage,
        strategyRegistry,
        providerRegistry,
        browserAdapterFactory,
        browserConfig,
        logger,
    });

    return { authManager, storage, providerRegistry, strategyRegistry, config, browserAvailable };
}
