import type { IAuthStrategy, IAuthStrategyFactory, AuthContext } from '../core/interfaces/auth-strategy.js';
import type { Credential, BearerCredential, ProviderConfig } from '../core/types.js';
import type { StrategyConfig, OAuth2StrategyConfig } from '../config/schema.js';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import { BrowserError, RefreshError, type AuthError } from '../core/errors.js';
import { runHybridFlow } from '../browser/flows/hybrid-flow.js';
import { extractOAuthTokens, hasOAuthTokens } from '../browser/flows/oauth-consent.flow.js';
import { isLoginPage } from '../browser/flows/form-login.flow.js';

const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

/**
 * OAuth2 authentication strategy.
 * Supports browser-based authorization with token extraction from localStorage,
 * and silent refresh using refresh tokens.
 */
class OAuth2Strategy implements IAuthStrategy {
  private readonly strategyConfig: OAuth2StrategyConfig;

  constructor(config: OAuth2StrategyConfig) {
    this.strategyConfig = config;
  }

  validate(credential: Credential): Result<boolean, AuthError> {
    if (credential.type !== 'bearer') return ok(false);

    if (!credential.accessToken || credential.accessToken.trim() === '') {
      return ok(false);
    }

    // Check expiry with buffer
    if (credential.expiresAt) {
      const expiresAtMs = new Date(credential.expiresAt).getTime();
      if (Date.now() + EXPIRY_BUFFER_MS >= expiresAtMs) {
        return ok(false);
      }
    }

    return ok(true);
  }

  async authenticate(
    provider: ProviderConfig,
    context: AuthContext,
  ): Promise<Result<Credential, AuthError>> {
    const adapter = context.browserAdapter;

    if (!provider.entryUrl) {
      return err(new BrowserError(
        `Provider "${provider.id}" requires an entryUrl for OAuth2 authentication.`,
        provider.id,
      ));
    }

    return await runHybridFlow<Credential>(adapter, {
      entryUrl: provider.entryUrl,
      browserConfig: context.browserConfig,
      forceVisible: provider.forceVisible ?? false,
      xHeaders: provider.xHeaders,
      providerDomains: provider.domains,

      isAuthenticated: async (page) => {
        const onLogin = await isLoginPage(page);
        if (onLogin) return false;
        return await hasOAuthTokens(page, this.strategyConfig.audiences);
      },

      extractCredentials: async (page, xHeaders, meta) => {
        const result = await extractOAuthTokens(page, {
          audiences: this.strategyConfig.audiences,
          extractRefreshToken: true,
          maxRetries: 6, // ~5.1s worst case with exponential backoff
        });
        // Attach captured headers to the bearer credential
        if (result.ok && xHeaders && Object.keys(xHeaders).length > 0) {
          const cred = result.value as BearerCredential;
          cred.xHeaders = xHeaders;
        }
        // Attach diagnostics metadata for post-auth validation
        if (result.ok) {
          (result.value as any).__diagnostics = {
            authDetectedImmediately: meta?.immediateAuth ?? false,
            oauthTokensDetected: true,
            cookiesExtracted: 0,
          };
        }
        return result;
      },
    });
  }

  async refresh(
    credential: Credential,
  ): Promise<Result<Credential | null, AuthError>> {
    if (credential.type !== 'bearer') return ok(null);
    if (!credential.refreshToken) return ok(null);

    if (!this.strategyConfig.tokenEndpoint || !this.strategyConfig.clientId) {
      return ok(null); // Can't refresh without endpoint and client ID
    }

    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.strategyConfig.clientId,
        refresh_token: credential.refreshToken,
      });

      if (this.strategyConfig.scopes && this.strategyConfig.scopes.length > 0) {
        body.set('scope', this.strategyConfig.scopes.join(' '));
      }

      const response = await fetch(this.strategyConfig.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return err(new RefreshError(
          credential.tokenEndpoint ?? 'unknown',
          `Token refresh failed (${response.status}): ${errorBody}`,
        ));
      }

      const tokenResponse = await response.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
      };

      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
        : undefined;

      const refreshed: BearerCredential = {
        type: 'bearer',
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token ?? credential.refreshToken,
        expiresAt,
        scopes: tokenResponse.scope?.split(' '),
        tokenEndpoint: credential.tokenEndpoint,
        ...(credential.xHeaders ? { xHeaders: credential.xHeaders } : {}),
      };

      return ok(refreshed);
    } catch (e: unknown) {
      return err(new RefreshError(
        credential.tokenEndpoint ?? 'unknown',
        (e as Error).message,
      ));
    }
  }

  applyToRequest(credential: Credential): Record<string, string> {
    if (credential.type !== 'bearer') return {};

    // Apply x-headers first, then set Authorization so it always wins
    const headers: Record<string, string> = { ...credential.xHeaders };
    headers['Authorization'] = `Bearer ${credential.accessToken}`;

    return headers;
  }
}

export class OAuth2StrategyFactory implements IAuthStrategyFactory {
  readonly name = 'oauth2';

  create(config: StrategyConfig): IAuthStrategy {
    if (config.strategy !== 'oauth2') {
      throw new Error(`OAuth2StrategyFactory received wrong config type: ${config.strategy}`);
    }
    return new OAuth2Strategy(config);
  }
}
