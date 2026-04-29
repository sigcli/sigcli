import type { IStorage } from './types/interfaces/storage.js';
import type { IProviderRegistry } from './types/interfaces/provider.js';
import type {
    Credential,
    ProviderConfig,
    StoredCredential,
    ProviderStatus,
    ILogger,
} from './types/types.js';
import type { BrowserConfig, SigConfig } from './config/schema.js';
import type {
    ISourceStrategy,
    ExtractedCredentials,
    ExtractionContext,
} from './types/interfaces/source-strategy.js';
import type { ApplyRule, ProviderConfigV2 } from './types/extract.js';

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
import {
    extractedToCredential,
    credentialToExtracted,
    toV2Config,
} from './utils/credential-converter.js';
import { checkTtl, validateCredential, getExpiresAt } from './utils/credential-validator.js';

/**
 * Central orchestrator for authentication lifecycle.
 *
 * Flow: check TTL → select source → run extract[] → check required → store
 */
export class AuthManager {
    readonly storage: IStorage;
    private readonly providers: IProviderRegistry;
    private readonly browserConfig: BrowserConfig;
    private readonly logger?: ILogger;
    private readonly sourceStrategies = new Map<string, ISourceStrategy>();

    readonly config: SigConfig;
    readonly browserAvailable: boolean;

    private constructor(
        storage: IStorage,
        providers: IProviderRegistry,
        browserConfig: BrowserConfig,
        config: SigConfig,
        logger?: ILogger,
    ) {
        this.storage = storage;
        this.providers = providers;
        this.browserConfig = browserConfig;
        this.config = config;
        this.browserAvailable = config.mode !== 'browserless';
        this.logger = logger;
    }

    /**
     * Create an AuthManager from a validated SigConfig.
     * This is the only way to instantiate — wires all dependencies.
     */
    static async create(config: SigConfig, options?: { verbose?: boolean }): Promise<AuthManager> {
        const providerConfigs = Object.entries(config.providers).map(
            ([id, entry]) => ({
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
            }),
        ) as ProviderConfig[];

        const providerRegistry = new ProviderRegistry(providerConfigs);

        const credDir = expandHome(config.storage.credentialsDir);
        const encryptionKey = await loadEncryptionKey();
        const storage = new CachedStorage(new DirectoryStorage(credDir, encryptionKey), {
            ttlMs: 5000,
        });

        const logger = options?.verbose ? createConsoleLogger() : undefined;
        const manager = new AuthManager(storage, providerRegistry, config.browser, config, logger);

        if (manager.browserAvailable) {
            manager.registerSource(
                new BrowserStrategy({
                    browserDataDir: config.browser.browserDataDir,
                    channel: config.browser.channel,
                    execPath: config.browser.execPath,
                }),
            );
        }
        manager.registerSource(new PromptStrategy());

        return manager;
    }

    registerSource(source: ISourceStrategy): void {
        this.sourceStrategies.set(source.name, source);
    }

    /**
     * Get credentials for a provider using the new extract/apply system.
     * Backward compatible: converts old ProviderConfig on the fly.
     */
    async getCredentials(
        providerId: string,
        options?: { networkProxy?: string },
    ): Promise<Result<Credential, AuthError>> {
        const provider = this.providers.get(providerId);
        if (!provider) return err(new ProviderNotFoundError(providerId));

        const newProvider = toV2Config(provider);
        if (options?.networkProxy) {
            newProvider.networkProxy = options.networkProxy;
        }

        const result = await this.getExtracted(newProvider);
        if (!isOk(result)) return result;

        // Convert extracted credentials to old Credential format for backward compat
        const credential = extractedToCredential(result.value, newProvider);
        return ok(credential);
    }

    /**
     * Get credentials using the new extract/apply system directly.
     */
    async getExtracted(
        provider: ProviderConfigV2,
    ): Promise<Result<ExtractedCredentials, AuthError>> {
        const key = provider.id;

        // Step 1: Check stored credentials
        const stored = await this.storage.get(key);
        if (stored) {
            const cached = stored.metadata?.extractedValues as ExtractedCredentials | undefined;
            if (cached) {
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
        const source = this.sourceStrategies.get(provider.strategy);
        if (!source) {
            return err(
                new ProviderNotFoundError(`No source strategy registered for "${provider.strategy}"`),
            );
        }

        // Step 3: Run extraction
        this.logger?.info(`Authenticating with "${provider.id}"...`);
        const ctx: ExtractionContext = {
            entryUrl: provider.entryUrl ?? '',
            domains: provider.domains,
            networkProxy: provider.networkProxy,
            cookiePaths: provider.cookiePaths,
            loginMode: provider.loginMode,
            required: provider.required,
            timeout: this.browserConfig.visibleTimeout,
        };

        const extractResult = await source.extract(provider.extract, ctx);
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

        // Step 5: Store as StoredCredential (compatible with DirectoryStorage)
        const credential = extractedToCredential(extractResult.value, provider);
        const storedEntry: StoredCredential = {
            credential,
            providerId: provider.id,
            strategy: provider.strategy,
            updatedAt: new Date().toISOString(),
            metadata: { extractedValues: extractResult.value },
        };
        await this.storage.set(key, storedEntry);

        return ok(extractResult.value);
    }

    /**
     * Apply rules to extracted credentials.
     */
    applyExtracted(rules: ApplyRule[], credentials: ExtractedCredentials): ApplyResult {
        return ApplyEngine.applyRules(rules, credentials);
    }

    /**
     * Apply credentials to an outgoing request (backward compat).
     */
    applyToRequest(providerId: string, credential: Credential): Record<string, string> {
        const provider = this.providers.get(providerId);
        if (!provider) return {};

        const newProvider = toV2Config(provider);
        // Convert old credential to extracted format
        const extracted = credentialToExtracted(credential);
        const result = ApplyEngine.applyRules(newProvider.apply, extracted);
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
            this.logger?.info(`Auto-provisioned provider "${provider.id}" for ${input}`);
            return provider;
        }

        throw new ProviderNotFoundError(input);
    }

    /**
     * Get credentials for a provider, resolving by URL.
     */
    async getCredentialsByUrl(
        url: string,
    ): Promise<Result<{ provider: ProviderConfig; credential: Credential }, AuthError>> {
        const provider = this.resolveProvider(url);
        const result = await this.getCredentials(provider.id);
        if (!isOk(result)) return result;
        return ok({ provider, credential: result.value });
    }

    /**
     * Force re-authentication (clears stored credential and re-runs extraction).
     */
    async reauthenticate(
        providerId: string,
        options?: { networkProxy?: string },
    ): Promise<Result<Credential, AuthError>> {
        await this.storage.delete(providerId);
        return this.getCredentials(providerId, options);
    }

    /**
     * @deprecated Use reauthenticate() instead.
     */
    async forceReauth(
        providerId: string,
        options?: { networkProxy?: string },
    ): Promise<Result<Credential, AuthError>> {
        return this.reauthenticate(providerId, options);
    }

    /**
     * Store a credential directly (user-provided token/cookie).
     */
    async setCredential(
        providerId: string,
        credential: Credential,
    ): Promise<Result<void, AuthError>> {
        const provider = this.providers.get(providerId);
        if (!provider) return err(new ProviderNotFoundError(providerId));

        const stored: StoredCredential = {
            credential,
            providerId,
            strategy: provider.strategy,
            updatedAt: new Date().toISOString(),
        };
        await this.storage.set(providerId, stored);
        return ok(undefined);
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
        const newProvider = toV2Config(provider);
        const valid = checkTtl(stored, newProvider);

        const expiresAtDate = getExpiresAt(stored, newProvider);
        const expiresInMinutes = expiresAtDate
            ? Math.max(0, Math.round((expiresAtDate.getTime() - Date.now()) / 60000))
            : undefined;

        return {
            id: provider.id,
            name: provider.name,
            configured: true,
            valid,
            credentialType: stored.credential?.type,
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

    /**
     * Validate a credential by making a test request.
     */
    async validateCredential(
        provider: ProviderConfig,
        credential: Credential,
    ): Promise<{ status: number | null; isLoginRedirect: boolean }> {
        return validateCredential(provider, credential);
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
