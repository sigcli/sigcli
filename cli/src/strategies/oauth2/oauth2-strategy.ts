import { fetch, type Response as UndiciResponse } from 'undici';

import {
    ConfigError,
    CredentialNotFoundError,
    err,
    ok,
    RefreshError,
    type AuthError,
    type IStrategy,
    type ProviderConfig,
    type Result,
    type StoredCredential,
} from '../../types/index.js';
import type { ExtractionResult } from '../../types/interfaces/strategy.js';
import { createProxyDispatcher } from '../../utils/http.js';

/**
 * OAuth2Strategy — client credentials flow (machine-to-machine).
 *
 * Config (provider.oauth2):   tokenUrl, scopes
 * Secrets (storedCredential.oauth2): clientId, clientSecret
 *
 * POST to tokenUrl:
 *   Authorization: Basic base64(clientId:clientSecret)
 *   Content-Type: application/x-www-form-urlencoded
 *   Body: grant_type=client_credentials [&scope=<scopes>]
 *
 * Returns access_token + computes expiresAt from expires_in if present.
 * Preserves oauth2 clientId/clientSecret in the returned ExtractionResult
 * so auth-manager can persist them alongside the new token.
 */
class OAuth2Strategy implements IStrategy {
    readonly name = 'oauth2';
    readonly needsBrowser = false;

    async extract(
        provider: ProviderConfig,
        stored?: StoredCredential,
    ): Promise<Result<ExtractionResult, AuthError>> {
        if (!provider.oauth2?.tokenUrl) {
            return err(
                new ConfigError(
                    `Provider "${provider.id}" is missing oauth2.tokenUrl in config. ` +
                        'Add it to your config.yaml.',
                ),
            );
        }

        const oauth2 = stored?.oauth2;
        if (!oauth2?.clientId || !oauth2?.clientSecret) {
            return err(new CredentialNotFoundError(provider.id));
        }

        const { tokenUrl, scopes } = provider.oauth2;
        const { clientId, clientSecret } = oauth2;

        const body = new URLSearchParams({ grant_type: 'client_credentials' });
        if (scopes && scopes.length > 0) {
            body.set('scope', scopes.join(' '));
        }

        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        const dispatcher = createProxyDispatcher(provider.networkProxy);

        let response: UndiciResponse;
        try {
            response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: body.toString(),
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
                ...(dispatcher ? { dispatcher: dispatcher as any } : {}),
            });
        } catch (e: unknown) {
            return err(
                new RefreshError(
                    provider.id,
                    `cannot reach token endpoint: ${(e as Error).message}`,
                ),
            );
        }

        let json: Record<string, unknown>;
        try {
            const text = await response.text();
            json = JSON.parse(text) as Record<string, unknown>;
        } catch {
            return err(
                new RefreshError(provider.id, 'unexpected response format from token endpoint'),
            );
        }

        if (response.status === 401) {
            return err(new RefreshError(provider.id, 'invalid client credentials (401)'));
        }

        if (!response.ok) {
            const errDesc =
                typeof json.error_description === 'string'
                    ? json.error_description
                    : typeof json.error === 'string'
                      ? json.error
                      : `HTTP ${response.status}`;
            return err(new RefreshError(provider.id, errDesc));
        }

        const accessToken = json.access_token;
        if (typeof accessToken !== 'string' || !accessToken) {
            return err(new RefreshError(provider.id, 'token endpoint did not return access_token'));
        }

        let expiresAt: string | undefined;
        if (typeof json.expires_in === 'number' && json.expires_in > 0) {
            expiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();
        }

        return ok({
            credentials: { access_token: accessToken },
            ...(expiresAt ? { expiresAt } : {}),
            oauth2: { clientId, clientSecret },
        });
    }
}

export { OAuth2Strategy };
