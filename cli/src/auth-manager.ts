import {
    err,
    isOk,
    ok,
    ProviderNotFoundError,
    type ApplyRule,
    type AuthError,
    type ExtractedCredentials,
    type ILogger,
    type IProviderRegistry,
    type IStorage,
    type IStrategy,
    type ProviderConfig,
    type ProviderStatus,
    type Result,
    type StoredCredential,
} from './types/index.js';
import type { BrowserConfig, SigConfig } from './config/schema.js';
import { createDefaultProvider } from './providers/auto-provision.js';
import { ProviderRegistry } from './providers/provider-registry.js';
import { CachedStorage } from './storage/cached-storage.js';
import { DirectoryStorage } from './storage/directory-storage.js';
import { loadEncryptionKey } from './crypto/encryption.js';
import { BrowserStrategy } from './strategies/browser/index.js';
import { PromptStrategy } from './strategies/prompt/index.js';
import { ApplyEngine, type ApplyResult } from './apply/apply-engine.js';
import { parseDuration } from './utils/duration.js';
import { createNoopLogger, createOperationalLogger } from './utils/logger.js';
import { expandHome } from './utils/path.js';

/**
 * Central orchestrator for authentication lifecycle.
 *
 * Flow: check stored → TTL valid? return cached → select source → run extract(rules, ctx) → check required → store encrypted → return
 */
export class AuthManager {
    readonly storage: IStorage;
    readonly config: SigConfig;
    readonly browserAvailable: boolean;
    readonly logger: ILogger;

    private readonly providers: IProviderRegistry;
    private readonly browserConfig: BrowserConfig;
    private readonly strategies = new Map<string, IStrategy>();

    private constructor(
        storage: IStorage,
        providers: IProviderRegistry,
        browserConfig: BrowserConfig,
        config: SigConfig,
        logger: ILogger,
    ) {
        this.storage = storage;
        this.providers = providers;
        this.browserConfig = browserConfig;
        this.config = config;
        this.browserAvailable = config.mode !== 'browserless';
        this.logger = logger;
    }

    static async create(config: SigConfig, logger?: ILogger): Promise<AuthManager> {
        const log = logger ?? createOperationalLogger();

        const providerConfigs = Object.entries(config.providers).map(
            ([id, entry]) =>
                ({
                    id,
                    name: entry.name ?? id,
                    domains: entry.domains,
                    entryUrl: entry.entryUrl,
                    strategy: entry.strategy,
                    extract: entry.extract,
                    apply: entry.apply,
                    networkProxy: entry.networkProxy,
                    loginMode: entry.loginMode,
                    required: entry.required,
                    cookiePaths: entry.cookiePaths,
                    ttl: entry.ttl,

                    loginUrlPatterns: entry.loginUrlPatterns,
                    waitUntil: entry.waitUntil,
                }) as ProviderConfig,
        );

        const providerRegistry = new ProviderRegistry(providerConfigs);

        const credDir = expandHome(config.storage.credentialsDir);
        const encryptionKey = await loadEncryptionKey();
        const storage = new CachedStorage(new DirectoryStorage(credDir, encryptionKey, log), {
            ttlMs: 5000,
        });

        const manager = new AuthManager(storage, providerRegistry, config.browser, config, log);

        if (manager.browserAvailable) {
            manager.registerStrategy(new BrowserStrategy(config.browser, undefined, log));
        }
        manager.registerStrategy(new PromptStrategy());

        return manager;
    }

    static async createWithNoopLogger(config: SigConfig): Promise<AuthManager> {
        return AuthManager.create(config, createNoopLogger());
    }

    registerStrategy(strategy: IStrategy): void {
        this.strategies.set(strategy.name, strategy);
    }

    // =========================================================================
    // Core API
    // =========================================================================

    /**
     * Get extracted credentials for a provider.
     * Returns cached if TTL valid, otherwise runs extraction.
     * Pass force=true to clear stored and re-extract (used by login).
     */
    public async getExtractedCreds(
        providerId: string,
        options: { force?: boolean; networkProxy?: string; loginMode?: string } = {},
    ): Promise<Result<ExtractedCredentials, AuthError>> {
        const provider = this.providers.get(providerId);
        if (!provider) return err(new ProviderNotFoundError(providerId));

        if (options.force) {
            await this.storage.delete(providerId);
        }

        const cached = await this.getCached(provider);
        if (cached) return ok(cached);

        const effectiveProvider = { ...provider };
        if (options.networkProxy) effectiveProvider.networkProxy = options.networkProxy;
        if (options.loginMode)
            effectiveProvider.loginMode = options.loginMode as ProviderConfig['loginMode'];

        return this.authenticate(effectiveProvider);
    }

    /**
     * Apply rules to extracted credentials — returns headers, query, body modifications.
     */
    applyExtractedCreds(rules: ApplyRule[], credentials: ExtractedCredentials): ApplyResult {
        return ApplyEngine.applyRules(rules, credentials);
    }

    // =========================================================================
    // Provider resolution
    // =========================================================================

    /**
     * Resolve a provider by ID, name, URL, or domain.
     * Auto-provisions a new provider for URL-like inputs.
     */
    resolveProvider(input: string): Result<ProviderConfig, AuthError> {
        const existing = this.providers.resolveFlexible(input);
        if (existing) return ok(existing);

        const isUrlLike =
            input.startsWith('http://') || input.startsWith('https://') || input.includes('.');
        if (isUrlLike) {
            const existingIds = new Set(this.providers.list().map((p) => p.id));
            const provider = createDefaultProvider(input, existingIds);
            this.providers.register(provider);
            this.logger.info(`auto-provisioned "${provider.id}" for ${input}`);
            return ok(provider);
        }

        return err(new ProviderNotFoundError(input));
    }

    // =========================================================================
    // Status & lifecycle
    // =========================================================================

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

        const cached = await this.getCached(provider);
        const expiresAtDate = await this.getExpiresAt(provider);
        const expiresInMinutes = expiresAtDate
            ? Math.max(0, Math.round((expiresAtDate.getTime() - Date.now()) / 60000))
            : undefined;

        return {
            id: provider.id,
            name: provider.name,
            configured: true,
            valid: cached !== null,
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

    // =========================================================================
    // Internal
    // =========================================================================

    private async getCached(provider: ProviderConfig): Promise<ExtractedCredentials | null> {
        const stored = await this.storage.get(provider.id);
        if (!stored) {
            this.logger.info(`${provider.id}: cache miss`);
            return null;
        }

        const creds = stored.values;
        if (!creds || Object.keys(creds).length === 0) {
            this.logger.info(`${provider.id}: cache miss (empty)`);
            return null;
        }

        const expiresAt = this.computeExpiresAt(stored, provider);
        if (expiresAt && Date.now() >= expiresAt.getTime()) {
            this.logger.info(`${provider.id}: cache expired`);
            return null;
        }

        this.logger.info(`${provider.id}: cache hit`);
        return creds;
    }

    private async getExpiresAt(provider: ProviderConfig): Promise<Date | null> {
        const stored = await this.storage.get(provider.id);
        if (!stored) return null;
        return this.computeExpiresAt(stored, provider);
    }

    private computeExpiresAt(stored: StoredCredential, provider: ProviderConfig): Date | null {
        if (stored.expiresAt) return new Date(stored.expiresAt);

        if (!provider.ttl) return null;

        const ttlMs = parseDuration(provider.ttl);
        if (!ttlMs) return null;

        return new Date(new Date(stored.updatedAt).getTime() + ttlMs);
    }

    private async authenticate(
        provider: ProviderConfig,
    ): Promise<Result<ExtractedCredentials, AuthError>> {
        const strategy = this.strategies.get(provider.strategy);
        if (!strategy) {
            return err(
                new ProviderNotFoundError(`No strategy registered for "${provider.strategy}"`),
            );
        }

        this.logger.info(`${provider.id}: authenticating via ${provider.strategy}`);
        const startTime = Date.now();

        const extractResult = await strategy.extract(provider);
        if (!isOk(extractResult)) {
            this.logger.error(`${provider.id}: auth failed — ${extractResult.error.message}`);
            return extractResult;
        }

        const storedEntry: StoredCredential = {
            providerId: provider.id,
            strategy: provider.strategy,
            updatedAt: new Date().toISOString(),
            values: extractResult.value.credentials,
            ...(extractResult.value.expiresAt ? { expiresAt: extractResult.value.expiresAt } : {}),
        };
        await this.storage.set(provider.id, storedEntry);

        const elapsed = Date.now() - startTime;
        this.logger.info(`${provider.id}: authenticated (${elapsed}ms)`);
        return ok(extractResult.value.credentials);
    }
}
