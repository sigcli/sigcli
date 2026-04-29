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
import type { ApplyRule, ProviderConfigV2 } from './core/types/extract.js';
import type { ApplyResult } from './apply/engine.js';
import { createDefaultProvider } from './providers/auto-provision.js';
import type { Result } from './core/result.js';
import { ok, err, isOk } from './core/result.js';
import { ProviderNotFoundError, CredentialNotFoundError, type AuthError } from './core/errors.js';
import { LOGIN_URL_PATTERNS, HttpHeader } from './core/constants.js';
import { buildUserAgent } from './utils/http.js';
import { applyRules } from './apply/engine.js';
import { checkRequired } from './extraction/required-checker.js';
import { parseDuration } from './utils/duration.js';
import { migrateProvider } from './config/migration.js';

export interface AuthManagerDeps {
    storage: IStorage;
    providerRegistry: IProviderRegistry;
    browserConfig: BrowserConfig;
    logger?: ILogger;
}

/**
 * Central orchestrator for authentication lifecycle.
 * Uses the extract/apply system (v2).
 *
 * Flow: check TTL → select source → run extract[] → check required → store
 */
export class AuthManager {
    private readonly storage: IStorage;
    private readonly providers: IProviderRegistry;
    private readonly browserConfig: BrowserConfig;
    private readonly logger?: ILogger;
    private readonly sourceStrategies = new Map<string, ISourceStrategy>();

    constructor(deps: AuthManagerDeps) {
        this.storage = deps.storage;
        this.providers = deps.providerRegistry;
        this.browserConfig = deps.browserConfig;
        this.logger = deps.logger;
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

        const newProvider = this.toNewConfig(provider);
        if (options?.networkProxy) {
            newProvider.networkProxy = options.networkProxy;
        }

        const result = await this.getExtracted(newProvider);
        if (!isOk(result)) return result;

        // Convert extracted credentials to old Credential format for backward compat
        const credential = this.extractedToCredential(result.value, newProvider);
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
        const source = this.sourceStrategies.get(provider.source);
        if (!source) {
            return err(new ProviderNotFoundError(
                `No source strategy registered for "${provider.source}"`,
            ));
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
                return err(new CredentialNotFoundError(
                    `Required fields not met: ${unmet.join(', ')}`,
                ));
            }
        }

        // Step 5: Store as StoredCredential (compatible with DirectoryStorage)
        const credential = this.extractedToCredential(extractResult.value, provider);
        const storedEntry: StoredCredential = {
            credential,
            providerId: provider.id,
            strategy: provider.source,
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
        return applyRules(rules, credentials);
    }

    /**
     * Apply credentials to an outgoing request (backward compat).
     */
    applyToRequest(providerId: string, credential: Credential): Record<string, string> {
        const provider = this.providers.get(providerId);
        if (!provider) return {};

        const newProvider = this.toNewConfig(provider);
        // Convert old credential to extracted format
        const extracted = this.credentialToExtracted(credential);
        const result = applyRules(newProvider.apply, extracted);
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
     * Force re-authentication.
     */
    async forceReauth(
        providerId: string,
        options?: { networkProxy?: string },
    ): Promise<Result<Credential, AuthError>> {
        await this.storage.delete(providerId);
        return this.getCredentials(providerId, options);
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
        const newProvider = this.toNewConfig(provider);
        let valid = true;
        if (newProvider.ttl) {
            const ttlMs = parseDuration(newProvider.ttl);
            if (ttlMs) {
                const updatedAt = new Date(stored.updatedAt).getTime();
                valid = Date.now() - updatedAt < ttlMs;
            }
        }

        const expiresAt = this.getExpiresAt(stored, newProvider);
        const expiresInMinutes = expiresAt
            ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 60000))
            : undefined;

        return {
            id: provider.id,
            name: provider.name,
            configured: true,
            valid,
            credentialType: stored.credential?.type,
            strategy: provider.strategy,
            expiresAt: expiresAt?.toISOString(),
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
        if (!provider.entryUrl) return { status: null, isLoginRedirect: false };
        try {
            const headers = this.applyToRequest(provider.id, credential);
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

    get providerRegistry(): IProviderRegistry {
        return this.providers;
    }

    // ========================================================================
    // Private helpers
    // ========================================================================

    private toNewConfig(provider: ProviderConfig): ProviderConfigV2 {
        // If provider already has v2 fields, use them directly
        if (provider.extract && provider.apply && provider.source) {
            return {
                id: provider.id,
                name: provider.name,
                domains: provider.domains,
                entryUrl: provider.entryUrl,
                source: provider.source as ProviderConfigV2['source'],
                extract: provider.extract as ProviderConfigV2['extract'],
                apply: provider.apply as ProviderConfigV2['apply'],
                required: provider.required,
                cookiePaths: provider.cookiePaths,
                ttl: provider.ttl,
                networkProxy: provider.networkProxy,
                loginMode: provider.loginMode,
            };
        }
        // Fall back to migration for v1 providers
        const migrated = migrateProvider(provider.id, {
            name: provider.name,
            domains: provider.domains,
            entryUrl: provider.entryUrl,
            strategy: provider.strategy,
            config: provider.strategyConfig as unknown as Record<string, unknown>,
            localStorage: provider.localStorage,
            networkProxy: provider.networkProxy,
            loginMode: provider.loginMode,
        });
        return { id: provider.id, ...migrated } as unknown as ProviderConfigV2;
    }

    private credentialToExtracted(credential: Credential): ExtractedCredentials {
        switch (credential.type) {
            case 'cookie':
                return {
                    session: credential.cookies.map((c) => `${c.name}=${c.value}`).join('; '),
                    ...(credential.localStorage ?? {}),
                };
            case 'bearer':
                return { access_token: credential.accessToken };
            case 'api-key':
                return { token: credential.key };
            case 'basic':
                return { credentials: btoa(`${credential.username}:${credential.password}`) };
        }
    }

    private extractedToCredential(extracted: ExtractedCredentials, provider: ProviderConfigV2): Credential {
        if (extracted.session) {
            const cookies = extracted.session.split('; ').map((pair) => {
                const [name, ...rest] = pair.split('=');
                return {
                    name,
                    value: rest.join('='),
                    domain: provider.domains[0] ?? '',
                    path: '/',
                    expires: -1,
                    httpOnly: false,
                    secure: true,
                };
            });
            const extra: Record<string, string> = {};
            for (const [k, v] of Object.entries(extracted)) {
                if (k !== 'session') extra[k] = v;
            }
            return {
                type: 'cookie' as const,
                cookies,
                obtainedAt: new Date().toISOString(),
                ...(Object.keys(extra).length > 0 ? { localStorage: extra } : {}),
            };
        }
        if (extracted.access_token) {
            return { type: 'bearer' as const, accessToken: extracted.access_token };
        }
        if (extracted.token) {
            return { type: 'api-key' as const, key: extracted.token, headerName: 'Authorization', headerPrefix: 'Bearer' };
        }
        const firstValue = Object.values(extracted)[0] ?? '';
        return {
            type: 'cookie' as const,
            cookies: [{ name: 'data', value: firstValue, domain: provider.domains[0] ?? '', path: '/', expires: -1, httpOnly: false, secure: true }],
            obtainedAt: new Date().toISOString(),
        };
    }

    private getExpiresAt(stored: StoredCredential, provider: ProviderConfigV2): Date | null {
        if (provider.ttl) {
            const ttlMs = parseDuration(provider.ttl);
            if (ttlMs) {
                return new Date(new Date(stored.updatedAt).getTime() + ttlMs);
            }
        }
        if (stored.credential?.type === 'bearer' && stored.credential.expiresAt) {
            return new Date(stored.credential.expiresAt);
        }
        return null;
    }
}
