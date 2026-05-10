import type { AuthError } from '../errors.js';
import type { Result } from '../result.js';
import type { ProviderConfig, StoredCredential } from '../types.js';

/**
 * Extracted credential values — flat key-value map.
 * Keys come from extract[].as in config.
 */
export type ExtractedCredentials = Record<string, string>;

export interface ExtractionResult {
    credentials: ExtractedCredentials;
    expiresAt?: string;
    oauth2?: { clientId: string; clientSecret: string };
}

/**
 * A strategy knows HOW to acquire credentials.
 * Selected by provider.strategy field.
 */
export interface IStrategy {
    readonly name: string;
    readonly needsBrowser: boolean;

    extract(
        provider: ProviderConfig,
        stored?: StoredCredential,
    ): Promise<Result<ExtractionResult, AuthError>>;

    validate?(stored: ExtractedCredentials): Result<boolean, AuthError>;
}
