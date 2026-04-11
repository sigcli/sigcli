import type {
    IAuthStrategy,
    IAuthStrategyFactory,
    AuthContext,
} from '../core/interfaces/auth-strategy.js';
import type {
    Credential,
    CookieCredential,
    CredentialResult,
    ProviderConfig,
    AuthDiagnostics,
} from '../core/types.js';
import type { StrategyConfig, CookieStrategyConfig } from '../config/schema.js';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import { BrowserError, type AuthError } from '../core/errors.js';
import { parseDuration } from '../utils/duration.js';
import { runHybridFlow, stderrLogger } from '../browser/flows/hybrid-flow.js';
import { isLoginPage } from '../browser/flows/form-login.flow.js';
import { hasOAuthTokens } from '../browser/flows/oauth-consent.flow.js';
import { HttpHeader, WaitUntil, StrategyName, CredentialTypeName } from '../core/constants.js';

const DEFAULT_TTL = '24h';

/**
 * Cookie-based authentication strategy.
 * Launches a browser, navigates to the login page, waits for user auth,
 * then extracts cookies from the authenticated session.
 */
class CookieStrategy implements IAuthStrategy {
    private readonly ttlMs: number;
    private readonly requiredCookies: string[];

    constructor(config: CookieStrategyConfig) {
        this.ttlMs = parseDuration(config.ttl ?? DEFAULT_TTL);
        this.requiredCookies = config.requiredCookies ?? [];
    }

    validate(credential: Credential): Result<boolean, AuthError> {
        if (credential.type !== CredentialTypeName.COOKIE) return ok(false);

        // Check TTL based on obtainedAt
        const obtainedAt = new Date(credential.obtainedAt).getTime();
        if (Date.now() - obtainedAt > this.ttlMs) {
            return ok(false);
        }

        // Check individual cookie expiry
        const now = Date.now() / 1000;
        const hasExpired = credential.cookies.some((c) => c.expires > 0 && c.expires < now);
        if (hasExpired) return ok(false);

        // Ensure we have at least one cookie
        if (credential.cookies.length === 0) return ok(false);

        return ok(true);
    }

    async authenticate(
        provider: ProviderConfig,
        context: AuthContext,
    ): Promise<Result<CredentialResult, AuthError>> {
        const adapter = context.browserAdapter;

        if (!provider.entryUrl) {
            return err(
                new BrowserError(
                    `Provider "${provider.id}" requires an entryUrl for cookie authentication.`,
                    provider.id,
                ),
            );
        }

        return await runHybridFlow<CredentialResult>(adapter, {
            entryUrl: provider.entryUrl,
            browserConfig: context.browserConfig,
            forceVisible: provider.forceVisible ?? false,
            waitUntil: WaitUntil.COMMIT,
            xHeaders: provider.xHeaders,
            providerDomains: provider.domains,
            logger: context.logger ?? stderrLogger,

            isAuthenticated: async (page) => {
                // If requiredCookies is set, auth is complete only when those cookies exist
                if (this.requiredCookies.length > 0) {
                    const urls = provider.domains.map((d) => `https://${d}/`);
                    const cookies = await page.cookies(urls);
                    const cookieNames = new Set(cookies.map((c) => c.name));
                    return this.requiredCookies.every((name) => cookieNames.has(name));
                }

                // Default: auth is complete when we're no longer on a login page
                const onLoginPage = await isLoginPage(page);
                return !onLoginPage;
            },

            extractCredentials: async (page, xHeaders, meta) => {
                // Only extract cookies matching this provider's domains (not all cookies from the shared profile)
                // Include both domain roots AND current page URL (to capture path-scoped cookies like /wiki)
                const urls = provider.domains.map((d) => `https://${d}/`);
                const currentUrl = page.url();
                if (currentUrl && !urls.includes(currentUrl)) urls.push(currentUrl);
                const cookies = await page.cookies(urls);
                if (cookies.length === 0) {
                    return err(
                        new BrowserError(
                            'No cookies found after authentication. ' +
                                'If this site sets cookies late (e.g. after client-side JS), try:\n' +
                                '  1. Set "waitUntil: networkidle" in the provider config to wait for all network activity\n' +
                                '  2. Set "requiredCookies: [cookie_name]" to wait for specific cookies before extracting',
                            provider.id,
                        ),
                    );
                }

                // Probe for OAuth tokens in browser storage (strategy mismatch detection)
                const oauthTokensDetected = await hasOAuthTokens(page).catch(() => false);

                const diagnostics: AuthDiagnostics = {
                    authDetectedImmediately: meta?.immediateAuth ?? false,
                    oauthTokensDetected,
                    cookiesExtracted: cookies.length,
                };

                const credential: CookieCredential = {
                    type: CredentialTypeName.COOKIE,
                    cookies,
                    obtainedAt: new Date().toISOString(),
                    ...(xHeaders && Object.keys(xHeaders).length > 0 ? { xHeaders } : {}),
                };

                return ok({ credential, diagnostics });
            },
        });
    }

    async refresh(): Promise<Result<Credential | null, AuthError>> {
        // Cookies can't be refreshed — must re-authenticate via browser
        return ok(null);
    }

    applyToRequest(credential: Credential): Record<string, string> {
        if (credential.type !== CredentialTypeName.COOKIE) return {};

        const cookieStr = credential.cookies.map((c) => `${c.name}=${c.value}`).join('; ');

        // Apply x-headers first, then set Cookie so it always wins
        const headers: Record<string, string> = { ...credential.xHeaders };
        headers[HttpHeader.COOKIE] = cookieStr;

        return headers;
    }
}

export class CookieStrategyFactory implements IAuthStrategyFactory {
    readonly name = StrategyName.COOKIE;

    create(config: StrategyConfig): IAuthStrategy {
        if (config.strategy !== StrategyName.COOKIE) {
            throw new Error(`CookieStrategyFactory received wrong config type: ${config.strategy}`);
        }
        return new CookieStrategy(config);
    }
}
