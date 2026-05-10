import { fetch } from 'undici';

import {
    ConfigError,
    err,
    ok,
    type AuthError,
    type ExtractedCredentials,
    type ExtractionContext,
    type IStrategy,
    type ProviderConfig,
    type Result,
} from '../../types/index.js';
import type { ExtractionResult } from '../../types/interfaces/strategy.js';
import { collectInputs } from '../collect-inputs.js';

/**
 * OAuth2Strategy — Client Credentials grant.
 *
 * 1. Collects client_id, client_secret, token_url from extract[] rules (or --set)
 * 2. Exchanges them at the token endpoint via Basic auth (RFC 6749 §2.3.1)
 * 3. Stores the access_token under exchange.as
 */
export class OAuth2Strategy implements IStrategy {
    readonly name = 'oauth2';
    readonly needsBrowser = false;

    async extract(
        provider: ProviderConfig,
        context?: ExtractionContext,
    ): Promise<Result<ExtractionResult, AuthError>> {
        if (!provider.exchange) {
            return err(new ConfigError('oauth2 strategy requires an "exchange" config'));
        }

        const inputsResult = await collectInputs(provider, context);
        if (!inputsResult.ok) return inputsResult;

        return this.exchangeToken(inputsResult.value, provider);
    }

    private async exchangeToken(
        inputs: ExtractedCredentials,
        provider: ProviderConfig,
    ): Promise<Result<ExtractionResult, AuthError>> {
        const exchange = provider.exchange;
        if (!exchange) {
            return err(new ConfigError('oauth2 strategy requires an "exchange" config'));
        }
        const { grant_type, scopes, as: outputKey } = exchange;

        const tokenUrl = inputs['token_url'];
        if (!tokenUrl) {
            return err(new ConfigError('token_url is required for oauth2 exchange'));
        }

        const clientId = inputs['client_id'] ?? '';
        const clientSecret = inputs['client_secret'] ?? '';
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        const body = new URLSearchParams({ grant_type });
        if (scopes?.length) {
            body.set('scope', scopes.join(' '));
        }

        const res = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${basicAuth}`,
            },
            body: body.toString(),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            return err(
                new ConfigError(`Token exchange failed (${res.status}): ${text.slice(0, 200)}`),
            );
        }

        const text = await res.text();
        let json: Record<string, unknown>;
        try {
            json = JSON.parse(text);
        } catch {
            return err(
                new ConfigError(`Token endpoint returned invalid JSON: ${text.slice(0, 200)}`),
            );
        }

        const accessToken = json['access_token'];
        if (typeof accessToken !== 'string') {
            return err(new ConfigError('Token response missing "access_token" field'));
        }

        const credentials: ExtractedCredentials = { ...inputs, [outputKey]: accessToken };
        const expiresAt = computeExpiry(json);

        return ok({ credentials, ...(expiresAt ? { expiresAt } : {}) });
    }
}

function computeExpiry(json: Record<string, unknown>): string | undefined {
    const expiresIn = json['expires_in'];
    if (typeof expiresIn !== 'number' || expiresIn <= 0) return undefined;
    return new Date(Date.now() + expiresIn * 1000).toISOString();
}
