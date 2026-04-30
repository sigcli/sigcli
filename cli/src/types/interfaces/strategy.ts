import type { WaitUntilValue } from '../constants.js';
import type { AuthError } from '../errors.js';
import type { Result } from '../result.js';
import type { ExtractRule } from '../types.js';

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
 * Context passed to strategies during extraction.
 */
export interface ExtractionContext {
    entryUrl: string;
    domains: string[];
    timeout: number;
    waitUntil: WaitUntilValue;
    networkProxy?: string;
    cookiePaths?: string[];
    required?: string[];
    loginPatterns?: string[];
}

/**
 * A strategy knows HOW to acquire credentials.
 * Selected by provider.strategy field.
 *
 * Implementations: BrowserSource, PromptSource
 */
export interface IStrategy {
    readonly name: string;
    readonly needsBrowser: boolean;

    extract(
        rules: ExtractRule[],
        ctx: ExtractionContext,
    ): Promise<Result<ExtractionResult, AuthError>>;

    validate?(stored: ExtractedCredentials): Result<boolean, AuthError>;
}
