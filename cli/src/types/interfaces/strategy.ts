import type { AuthError } from '../errors.js';
import type { Result } from '../result.js';
import type { ProviderConfig } from '../types.js';

/**
 * Extracted credential values — flat key-value map.
 * Keys come from extract[].name in config.
 */
export type ExtractedCredentials = Record<string, string>;

export interface ExtractionResult {
    credentials: ExtractedCredentials;
    expiresAt?: string;
}

/**
 * A strategy knows HOW to acquire credentials.
 * Selected by provider.strategy field.
 */
export interface IStrategy {
    readonly name: string;
    readonly needsBrowser: boolean;

    extract(provider: ProviderConfig): Promise<Result<ExtractionResult, AuthError>>;

    validate?(stored: ExtractedCredentials): Result<boolean, AuthError>;
}
