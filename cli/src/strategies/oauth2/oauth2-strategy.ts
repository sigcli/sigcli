import * as readline from 'node:readline';
import { fetch } from 'undici';

import {
    ConfigError,
    err,
    isOk,
    ManualSetupRequired,
    ok,
    type AuthError,
    type ExtractedCredentials,
    type ExtractionContext,
    type IStrategy,
    type ProviderConfig,
    type Result,
} from '../../types/index.js';
import type { ExtractionResult } from '../../types/interfaces/strategy.js';

/**
 * OAuth2Strategy — Client Credentials grant.
 *
 * 1. Collects client_id, client_secret, token_url from extract[] rules (or --set)
 * 2. Exchanges them at the token endpoint
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

        const inputsResult = await this.collectInputs(provider, context);
        if (!isOk(inputsResult)) return inputsResult;
        const inputs = inputsResult.value;

        const tokenResult = await this.exchangeToken(inputs, provider);
        if (!isOk(tokenResult)) return tokenResult;

        return tokenResult;
    }

    private async collectInputs(
        provider: ProviderConfig,
        context?: ExtractionContext,
    ): Promise<Result<ExtractedCredentials, AuthError>> {
        const credentials: ExtractedCredentials = {};
        const setValues = context?.setValues;

        const needsPrompt = provider.extract.some((rule) => setValues?.[rule.match] === undefined);
        const rl = needsPrompt
            ? readline.createInterface({ input: process.stdin, output: process.stderr })
            : null;

        try {
            for (const rule of provider.extract) {
                const preSet = setValues?.[rule.match];
                if (preSet !== undefined) {
                    credentials[rule.as] = preSet;
                    continue;
                }
                const answer = await this.ask(rl!, rule.match);
                if (!answer) {
                    return err(new ManualSetupRequired(rule.as, rule.match));
                }
                credentials[rule.as] = answer;
            }
        } finally {
            rl?.close();
        }

        return ok(credentials);
    }

    private async exchangeToken(
        inputs: ExtractedCredentials,
        provider: ProviderConfig,
    ): Promise<Result<ExtractionResult, AuthError>> {
        const exchange = provider.exchange!;
        const tokenUrl = inputs['token_url'];
        if (!tokenUrl) {
            return err(new ConfigError('token_url is required for oauth2 exchange'));
        }

        const body = new URLSearchParams({
            grant_type: exchange.grant_type,
            client_id: inputs['client_id'] ?? '',
            client_secret: inputs['client_secret'] ?? '',
        });

        if (exchange.scopes?.length) {
            body.set('scope', exchange.scopes.join(' '));
        }

        const res = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            return err(
                new ConfigError(`Token exchange failed (${res.status}): ${text.slice(0, 200)}`),
            );
        }

        const json = (await res.json()) as Record<string, unknown>;
        const accessToken = json['access_token'];
        if (typeof accessToken !== 'string') {
            return err(new ConfigError('Token response missing "access_token" field'));
        }

        const credentials: ExtractedCredentials = {
            ...inputs,
            [exchange.as]: accessToken,
        };

        const expiresAt = this.computeExpiry(json);
        return ok({ credentials, ...(expiresAt ? { expiresAt } : {}) });
    }

    private computeExpiry(json: Record<string, unknown>): string | undefined {
        const expiresIn = json['expires_in'];
        if (typeof expiresIn !== 'number' || expiresIn <= 0) return undefined;
        return new Date(Date.now() + expiresIn * 1000).toISOString();
    }

    private ask(rl: readline.Interface, prompt: string): Promise<string> {
        return new Promise((resolve) => {
            rl.question(`${prompt}: `, resolve);
        });
    }
}
