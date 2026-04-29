import type { AuthContext } from './core/interfaces/auth-strategy.js';
import type { IBrowserAdapter } from './core/interfaces/browser-adapter.js';
import type { IStorage } from './core/interfaces/storage.js';
import type { IProviderRegistry } from './core/interfaces/provider.js';
import type {
    Credential,
    ProviderConfig,
    StoredCredential,
    ProviderStatus,
    ILogger,
} from './core/types.js';
import type { BrowserConfig } from './config/schema.js';
import type { ISourceStrategy, ExtractedCredentials, ExtractionContext } from './core/interfaces/source-strategy.js';
import type { ExtractRule, ApplyRule, NewProviderConfig } from './core/types/extract.js';
import type { ApplyResult } from './apply/engine.js';
import { createDefaultProvider } from './providers/auto-provision.js';
import type { Result } from './core/result.js';
import { ok, err, isOk } from './core/result.js';
import { CredentialTypeError, ProviderNotFoundError, CredentialNotFoundError, type AuthError } from './core/errors.js';
import { StrategyRegistry } from './strategies/registry.js';
import { LOGIN_URL_PATTERNS, HttpHeader, CredentialTypeName } from './core/constants.js';
import { buildUserAgent } from './utils/http.js';
import { applyRules } from './apply/engine.js';
import { checkRequired } from './extraction/required-checker.js';
import { parseDuration } from './utils/duration.js';

export interface AuthManagerDeps {
    storage: IStorage;
    strategyRegistry: StrategyRegistry;
    providerRegistry: IProviderRegistry;
    browserAdapterFactory: () => IBrowserAdapter;
    browserConfig: BrowserConfig;
    logger?: ILogger;
}

/**
 * Central orchestrator for authentication lifecycle.
 * All dependencies are injected — no singletons, no global state.
 *
 * Flow: validate → refresh → authenticate
 */
export class AuthManager {
    private readonly storage: IStorage;
    private readonly strategies: StrategyRegistry;
    private readonly providers: IProviderRegistry;
    private readonly browserAdapterFactory: () => IBrowserAdapter;
    private readonly browserConfig: BrowserConfig;
    private readonly logger?: ILogger;

    constructor(deps: AuthManagerDeps) {
        this.storage = deps.storage;
        this.strategies = deps.strategyRegistry;
        this.providers = deps.providerRegistry;
        this.browserAdapterFactory = deps.browserAdapterFactory;
        this.browserConfig = deps.browserConfig;
        this.logger = deps.logger;
    }

    /**
     * Get valid credentials for a provider.
     * Tries: stored → refresh → authenticate, in that order.
     */
    async getCredentials(
        providerId: string,
        options?: { networkProxy?: string },
    ): Promise<Result<Credential, AuthError>> {
        const provider = this.providers.get(providerId);
        if (!provider) return err(new ProviderNotFoundError(providerId));

        const strategy = this.strategies.get(provider.strategy, provider.strategyConfig);
        const key = this.storageKey(provider);

        // Step 1: Check stored credentials
        const stored = await this.storage.get(key);
        if (stored) {
            const validation = strategy.validate(stored.credential, provider.strategyConfig);
            if (isOk(validation) && validation.value) {
                // Check credential type constraints
                const typeCheck = this.checkCredentialType(provider, stored.credential);
                if (!isOk(typeCheck)) return typeCheck;
                return ok(stored.credential);
            }

            // Step 2: Try refresh
            this.logger?.debug(
                `Credentials for "${providerId}" are invalid, attempting refresh...`,
            );
            const refreshResult = await strategy.refresh(
                stored.credential,
                provider.strategyConfig,
            );
            if (isOk(refreshResult) && refreshResult.value) {
                const typeCheck = this.checkCredentialType(provider, refreshResult.value);
                if (!isOk(typeCheck)) return typeCheck;

                await this.store(key, provider.strategy, refreshResult.value);
                return ok(refreshResult.value);
            }
        }

        // Step 3: Full authentication
        this.logger?.info(`Authenticating with "${providerId}"...`);
        const resolvedProxy = options?.networkProxy ?? provider.networkProxy;
        const context: AuthContext = {
            browserAdapter: this.browserAdapterFactory(),
            browserConfig: this.browserConfig,
            logger: this.logger,
            ...(resolvedProxy !== undefined ? { networkProxy: resolvedProxy } : {}),
        };

        const authResult = await strategy.authenticate(provider, context);
        if (!isOk(authResult)) return authResult;

        const { credential: authedCredential } = authResult.value;
        const typeCheck = this.checkCredentialType(provider, authedCredential);
        if (!isOk(typeCheck)) return typeCheck;

        await this.store(key, provider.strategy, authedCredential);
        return ok(authedCredential);
    }

    /**
     * Resolve a provider by ID, name, URL, or domain.
     * Auto-provisions a default cookie provider only for URL-like inputs that don't match.
     */
    resolveProvider(input: string): ProviderConfig {
        const existing = this.providers.resolveFlexible(input);
        if (existing) return existing;

        // Only auto-provision for URL-like inputs (contains '.' or starts with 'http')
        const isUrlLike =
            input.startsWith('http://') || input.startsWith('https://') || input.includes('.');
        if (isUrlLike) {
            const existingIds = new Set(this.providers.list().map((p) => p.id));
            const provider = createDefaultProvider(input, existingIds);
            this.providers.register(provider);
            this.logger?.info(`Auto-provisioned provider "${provider.id}" for ${input}`);
            return provider;
        }

        // For non-URL inputs that don't resolve, return a not-found error via a sentinel
        // that will be caught by callers. We throw here since the method returns ProviderConfig.
        throw new ProviderNotFoundError(input);
    }

    /**
     * Get credentials for a specific provider, resolving by URL.
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
     * Force re-authentication, deleting any stored credentials first.
     */
    async forceReauth(
        providerId: string,
        options?: { networkProxy?: string },
    ): Promise<Result<Credential, AuthError>> {
        const provider = this.providers.get(providerId);
        if (provider) {
            await this.storage.delete(this.storageKey(provider));
        }
        return this.getCredentials(providerId, options);
    }

    /**
     * Store a credential directly (e.g., user-provided API token).
     */
    async setCredential(
        providerId: string,
        credential: Credential,
    ): Promise<Result<void, AuthError>> {
        const provider = this.providers.get(providerId);
        if (!provider) return err(new ProviderNotFoundError(providerId));

        const typeCheck = this.checkCredentialType(provider, credential);
        if (!isOk(typeCheck)) return typeCheck;

        await this.store(this.storageKey(provider), provider.strategy, credential);
        return ok(undefined);
    }

    /**
     * Get status for a provider (non-triggering — won't start auth).
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

        const stored = await this.storage.get(this.storageKey(provider));
        if (!stored) {
            return {
                id: provider.id,
                name: provider.name,
                configured: true,
                valid: false,
                strategy: provider.strategy,
            };
        }

        const strategy = this.strategies.get(provider.strategy, provider.strategyConfig);
        const validation = strategy.validate(stored.credential, provider.strategyConfig);
        const valid = isOk(validation) && validation.value;

        const expiresAt = this.getExpiresAt(stored.credential, provider);
        const expiresInMinutes = expiresAt
            ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 60000))
            : undefined;

        return {
            id: provider.id,
            name: provider.name,
            configured: true,
            valid,
            credentialType: stored.credential.type,
            strategy: provider.strategy,
            expiresAt: expiresAt?.toISOString(),
            expiresInMinutes,
        };
    }

    /**
     * Get status for all configured providers.
     */
    async getAllStatus(): Promise<ProviderStatus[]> {
        const providers = this.providers.list();
        return Promise.all(providers.map((p) => this.getStatus(p.id)));
    }

    /**
     * Clear stored credentials for a provider.
     */
    async clearCredentials(providerId: string): Promise<void> {
        const provider = this.providers.get(providerId);
        const key = provider ? this.storageKey(provider) : providerId;
        await this.storage.delete(key);
    }

    /**
     * Clear all stored credentials.
     */
    async clearAll(): Promise<void> {
        await this.storage.clear();
    }

    /**
     * Apply credentials to an outgoing request (as headers).
     */
    applyToRequest(providerId: string, credential: Credential): Record<string, string> {
        const provider = this.providers.get(providerId);
        if (!provider) return {};

        const strategy = this.strategies.get(provider.strategy, provider.strategyConfig);
        return strategy.applyToRequest(credential);
    }

    /**
     * Validate a credential by making a test request to the provider's entry URL.
     * Returns the HTTP status and whether the response redirects to a login page.
     */
    async validateCredential(
        provider: ProviderConfig,
        credential: Credential,
    ): Promise<{ status: number | null; isLoginRedirect: boolean }> {
        if (!provider.entryUrl) return { status: null, isLoginRedirect: false };
        try {
            const strategy = this.strategies.get(provider.strategy, provider.strategyConfig);
            const headers = strategy.applyToRequest(credential);
            const response = await fetch(provider.entryUrl, {
                method: 'GET',
                headers: { ...headers, [HttpHeader.USER_AGENT]: buildUserAgent() },
                redirect: 'manual',
            });
            const location = response.headers.get('location') ?? '';
            const isLoginRedirect =
                response.status >= 300 &&
                response.status < 400 &&
                LOGIN_URL_PATTERNS.some((p) => location.toLowerCase().includes(p));
            return { status: response.status, isLoginRedirect };
        } catch {
            return { status: null, isLoginRedirect: false };
        }
    }

    /** Expose the provider registry for handlers */
    get providerRegistry(): IProviderRegistry {
        return this.providers;
    }

    /** Storage key: always the provider ID. */
    private storageKey(provider: ProviderConfig): string {
        return provider.id;
    }

    private checkCredentialType(
        provider: ProviderConfig,
        credential: Credential,
    ): Result<void, AuthError> {
        if (
            provider.acceptedCredentialTypes &&
            provider.acceptedCredentialTypes.length > 0 &&
            !provider.acceptedCredentialTypes.includes(credential.type)
        ) {
            return err(
                new CredentialTypeError(
                    provider.id,
                    provider.acceptedCredentialTypes,
                    credential.type,
                ),
            );
        }
        return ok(undefined);
    }

    private async store(
        providerId: string,
        strategy: string,
        credential: Credential,
    ): Promise<void> {
        const stored: StoredCredential = {
            credential,
            providerId,
            strategy,
            updatedAt: new Date().toISOString(),
        };
        await this.storage.set(providerId, stored);
    }

    private getExpiresAt(credential: Credential, provider?: ProviderConfig): Date | null {
        switch (credential.type) {
            case CredentialTypeName.BEARER:
                return credential.expiresAt ? new Date(credential.expiresAt) : null;
            case CredentialTypeName.COOKIE: {
                // Only consider requiredCookies if configured, otherwise all cookies
                const requiredCookies = (
                    provider?.strategyConfig as unknown as Record<string, unknown>
                )?.requiredCookies as string[] | undefined;
                const cookies =
                    requiredCookies && requiredCookies.length > 0
                        ? credential.cookies.filter((c) => requiredCookies.includes(c.name))
                        : credential.cookies;
                const expiries = cookies.filter((c) => c.expires > 0).map((c) => c.expires * 1000);
                return expiries.length > 0 ? new Date(Math.min(...expiries)) : null;
            }
            default:
                return null;
        }
    }

    // ========================================================================
    // NEW: Extract/Apply system (Phase 4)
    // ========================================================================

    private sourceStrategies = new Map<string, ISourceStrategy>();

    registerSource(source: ISourceStrategy): void {
        this.sourceStrategies.set(source.name, source);
    }

    /**
     * Get credentials using the new extract/apply system.
     * Flow: check TTL → select source → run extract[] → check required → store
     */
    async getExtracted(
        provider: NewProviderConfig,
    ): Promise<Result<ExtractedCredentials, AuthError>> {
        const key = provider.id;

        // Step 1: Check stored + TTL
        const stored = await this.storage.get(key);
        if (stored && provider.ttl) {
            const entry = stored as unknown as { values?: ExtractedCredentials; updatedAt?: string };
            if (entry.values) {
                const ttlMs = parseDuration(provider.ttl);
                if (ttlMs) {
                    const updatedAt = new Date(entry.updatedAt ?? stored.updatedAt).getTime();
                    if (Date.now() - updatedAt < ttlMs) {
                        return ok(entry.values);
                    }
                }
            }
        }

        // Step 2: Select source strategy
        const source = this.sourceStrategies.get(provider.source);
        if (!source) {
            return err(new ProviderNotFoundError(
                `No source strategy registered for "${provider.source}"`,
            ));
        }

        // Step 3: Run extraction
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
                return err(new CredentialNotFoundError(
                    `Required fields not met: ${unmet.join(', ')}`,
                ));
            }
        }

        // Step 5: Store
        const storedEntry = {
            values: extractResult.value,
            providerId: provider.id,
            source: provider.source,
            updatedAt: new Date().toISOString(),
        };
        await this.storage.set(key, storedEntry as unknown as StoredCredential);

        return ok(extractResult.value);
    }

    /**
     * Apply rules to extracted credentials → HTTP headers/query/body.
     */
    applyExtracted(rules: ApplyRule[], credentials: ExtractedCredentials): ApplyResult {
        return applyRules(rules, credentials);
    }
}
