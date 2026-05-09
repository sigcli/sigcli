import type { AuthError } from '../errors.js';
import type { Result } from '../result.js';
import type { ProviderConfig } from '../types.js';

/**
 * Extracted credential values — flat key-value map.
 * Keys come from extract[].as in config.
 */
export type ExtractedCredentials = Record<string, string>;

export interface ExtractionResult {
    credentials: ExtractedCredentials;
    expiresAt?: string;
}

/**
 * Optional context passed to extract() — allows callers to supply
 * pre-filled values (e.g. from --set flags) that skip interactive prompting.
 */
export interface ExtractionContext {
    setValues?: Record<string, string>;
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
        context?: ExtractionContext,
    ): Promise<Result<ExtractionResult, AuthError>>;

    validate?(stored: ExtractedCredentials): Result<boolean, AuthError>;
}
