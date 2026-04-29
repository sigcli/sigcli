import type { IStorage } from './types/interfaces/storage.js';
import type { IProviderRegistry } from './types/interfaces/provider.js';
import type { ProviderConfig, StoredCredential, ProviderStatus, ILogger } from './types/types.js';
import type { BrowserConfig, SigConfig } from './config/schema.js';
import type {
    IStrategy,
    ExtractedCredentials,
    ExtractionContext,
} from './types/interfaces/strategy.js';

import { ProviderRegistry } from './providers/provider-registry.js';
import { DirectoryStorage } from './storage/directory-storage.js';
import { CachedStorage } from './storage/cached-storage.js';
import { BrowserStrategy } from './strategies/browser/index.js';
import { PromptStrategy } from './strategies/prompt/index.js';
import { createDefaultProvider } from './providers/auto-provision.js';
import type { Result } from './types/result.js';
import { ok, err, isOk } from './types/result.js';
import { ProviderNotFoundError, CredentialNotFoundError, type AuthError } from './types/errors.js';
import { ApplyEngine, type ApplyResult } from './apply/apply-engine.js';
import { checkRequired } from './strategies/required-checker.js';
import { parseDuration } from './utils/duration.js';
import { expandHome } from './utils/path.js';
import { loadEncryptionKey } from './crypto/encryption.js';
import { checkTtl, getExpiresAt } from './utils/credential-validator.js';

/**
 * Central orchestrator for authentication lifecycle.
 *
 * Flow: check TTL → select strategy → run extract[] → check required → store
 */
export class AuthManager {
    readonly storage: IStorage;
    private readonly providers: IProviderRegistry;
    private readonly browserConfig: BrowserConfig;
    private readonly logger: ILogger;
    private readonly strategies = new Map<string, IStrategy>();

    readonly config: SigConfig;
    readonly browserAvailable: boolean;

    private constructor(
        storage: IStorage,
        providers: IProviderRegistry,
        browserConfig: BrowserConfig,
        config: SigConfig,
    ) {
        this.storage = storage;
        this.providers = providers;
        this.browserConfig = browserConfig;
        this.config = config;
        this.browserAvailable = config.mode !== 'browserless';
        this.logger = createConsoleLogger();
    }

    /**
     * Create an AuthManager from a validated SigConfig.
     * This is the only way to instantiate — wires all dependencies.
     */
    static async create(config: SigConfig): Promise<AuthManager> {
        const providerConfigs = Object.entries(config.providers).map(([id, entry]) => ({
            id,
            name: entry.name ?? id,
            domains: entry.domains,
            entryUrl: entry.entryUrl,
            strategy: entry.strategy,
            extract: entry.extract,
            apply: entry.apply,
            ...(entry.proxy !== undefined ? { proxy: entry.proxy } : {}),
            ...(entry.networkProxy !== undefined ? { networkProxy: entry.networkProxy } : {}),
            ...(entry.required !== undefined ? { required: entry.required } : {}),
            ...(entry.cookiePaths !== undefined ? { cookiePaths: entry.cookiePaths } : {}),
            ...(entry.ttl !== undefined ? { ttl: entry.ttl } : {}),
            ...(entry.loginMode !== undefined ? { loginMode: entry.loginMode } : {}),
        })) as ProviderConfig[];

        const providerRegistry = new ProviderRegistry(providerConfigs);

        const credDir = expandHome(config.storage.credentialsDir);
        const encryptionKey = await loadEncryptionKey();
        const storage = new CachedStorage(new DirectoryStorage(credDir, encryptionKey), {
            ttlMs: 5000,
        });

        const manager = new AuthManager(storage, providerRegistry, config.browser, config);

        if (manager.browserAvailable) {
            manager.registerStrategy(
                new BrowserStrategy({
                    browserDataDir: config.browser.browserDataDir,
                    channel: config.browser.channel,
                    execPath: config.browser.execPath ?? '',
                }),
            );
        }
        manager.registerStrategy(new PromptStrategy());

        return manager;
    }

    registerStrategy(strategy: IStrategy): void {
        this.strategies.set(strategy.name, strategy);
    }

    /**
     * Get credentials for a provider. Returns ExtractedCredentials (flat key-value map).
     */
    async getCredentials(
        providerId: string,
        options?: { networkProxy?: string },
    ): Promise<Result<ExtractedCredentials, AuthError>> {
        const provider = this.providers.get(providerId);
        if (!provider) return err(new ProviderNotFoundError(providerId));

        const effectiveProvider = options?.networkProxy
            ? { ...provider, networkProxy: options.networkProxy }
            : provider;

        return this.extractAndStore(effectiveProvider);
    }

    /**
     * Run the extract/store flow for a provider.
     */
    private async extractAndStore(
        provider: ProviderConfig,
    ): Promise<Result<ExtractedCredentials, AuthError>> {
        const key = provider.id;

        // Step 1: Check stored credentials
        const stored = await this.storage.get(key);
        if (stored) {
            const cached = stored.credentials as ExtractedCredentials | undefined;
            if (cached && Object.keys(cached).length > 0) {
                // If TTL is configured, check expiry
                if (provider.ttl) {
                    const ttlMs = parseDuration(provider.ttl);
                    if (ttlMs) {
                        const updatedAt = new Date(stored.updatedAt).getTime();
                        if (Date.now() - updatedAt < ttlMs) {
                            return ok(cached);
                        }
                    }
                } else {
                    // No TTL = never expires (valid until manually cleared)
                    return ok(cached);
                }
            }
        }

        // Step 2: Select source strategy
        const strategy = this.strategies.get(provider.strategy);
        if (!strategy) {
            return err(
                new ProviderNotFoundError(`No strategy registered for "${provider.strategy}"`),
            );
        }

        // Step 3: Run extraction
        this.logger.info(`Authenticating with "${provider.id}"...`);
        const ctx: ExtractionContext = {
            entryUrl: provider.entryUrl,
            domains: provider.domains,
            networkProxy: provider.networkProxy,
            cookiePaths: provider.cookiePaths,
            loginMode: provider.loginMode,
            required: provider.required,
            timeout: this.browserConfig.visibleTimeout,
        };

        const extractResult = await strategy.extract(provider.extract, ctx);
        if (!isOk(extractResult)) return extractResult;

        // Step 4: Check required
        if (provider.required?.length) {
            const unmet = checkRequired(provider.required, extractResult.value);
            if (unmet.length > 0) {
                return err(
                    new CredentialNotFoundError(`Required fields not met: ${unmet.join(', ')}`),
                );
            }
        }

        // Step 5: Store
        const storedEntry: StoredCredential = {
            providerId: provider.id,
            strategy: provider.strategy,
            updatedAt: new Date().toISOString(),
            credentials: extractResult.value,
        };
        await this.storage.set(key, storedEntry);

        return ok(extractResult.value);
    }

    /**
     * Apply rules to extracted credentials — returns headers/body/query modifications.
     */
    applyCredentials(provider: ProviderConfig, credentials: ExtractedCredentials): ApplyResult {
        return ApplyEngine.applyRules(provider.apply, credentials);
    }

    /**
     * Apply credentials to an outgoing request. Returns headers to inject.
     */
    applyToRequest(providerId: string, credentials: ExtractedCredentials): Record<string, string> {
        const provider = this.providers.get(providerId);
        if (!provider) return {};

        const result = ApplyEngine.applyRules(provider.apply, credentials);
        return result.headers;
    }

    /**
     * Resolve a provider by ID, name, URL, or domain.
     */
    resolveProvider(input: string): ProviderConfig {
        const existing = this.providers.resolveFlexible(input);
        if (existing) return existing;

        const isUrlLike =
            input.startsWith('http://') || input.startsWith('https://') || input.includes('.');
        if (isUrlLike) {
            const existingIds = new Set(this.providers.list().map((p) => p.id));
            const provider = createDefaultProvider(input, existingIds);
            this.providers.register(provider);
            this.logger.info(`Auto-provisioned provider "${provider.id}" for ${input}`);
            return provider;
        }

        throw new ProviderNotFoundError(input);
    }

    /**
     * Get credentials for a provider, resolving by URL.
     */
    async getCredentialsByUrl(
        url: string,
    ): Promise<Result<{ provider: ProviderConfig; credentials: ExtractedCredentials }, AuthError>> {
        const provider = this.resolveProvider(url);
        const result = await this.getCredentials(provider.id);
        if (!isOk(result)) return result;
        return ok({ provider, credentials: result.value });
    }

    /**
     * Force re-authentication (clears stored credential and re-runs extraction).
     */
    async reauthenticate(
        providerId: string,
        options?: { networkProxy?: string },
    ): Promise<Result<ExtractedCredentials, AuthError>> {
        await this.storage.delete(providerId);
        return this.getCredentials(providerId, options);
    }

    /**
     * @deprecated Use reauthenticate() instead.
     */
    async forceReauth(
        providerId: string,
        options?: { networkProxy?: string },
    ): Promise<Result<ExtractedCredentials, AuthError>> {
        return this.reauthenticate(providerId, options);
    }

    /**
     * Get status for a provider.
     */
    async getStatus(providerId: string): Promise<ProviderStatus> {
        const provider = this.providers.get(providerId);
        if (!provider) {
            return {
                id: providerId,
                name: providerId,
                configured: false,
                valid: false,
                strategy: 'unknown',
            };
        }

        const stored = await this.storage.get(providerId);
        if (!stored) {
            return {
                id: provider.id,
                name: provider.name,
                configured: true,
                valid: false,
                strategy: provider.strategy,
            };
        }

        // Check validity via TTL
        const valid = checkTtl(stored, provider);

        const expiresAtDate = getExpiresAt(stored, provider);
        const expiresInMinutes = expiresAtDate
            ? Math.max(0, Math.round((expiresAtDate.getTime() - Date.now()) / 60000))
            : undefined;

        return {
            id: provider.id,
            name: provider.name,
            configured: true,
            valid,
            strategy: provider.strategy,
            expiresAt: expiresAtDate?.toISOString(),
            expiresInMinutes,
        };
    }

    async getAllStatus(): Promise<ProviderStatus[]> {
        const providers = this.providers.list();
        return Promise.all(providers.map((p) => this.getStatus(p.id)));
    }

    async clearCredentials(providerId: string): Promise<void> {
        await this.storage.delete(providerId);
    }

    async clearAll(): Promise<void> {
        await this.storage.clear();
    }

    get providerRegistry(): IProviderRegistry {
        return this.providers;
    }
}

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
