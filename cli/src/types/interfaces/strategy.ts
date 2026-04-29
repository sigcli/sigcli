import type { Result } from '../result.js';
import type { AuthError } from '../errors.js';
import type { ExtractRule } from '../types.js';

/**
 * Extracted credential values — flat key-value map.
 * Keys come from extract[].name in config.
 */
export type ExtractedCredentials = Record<string, string>;

/**
 * Context passed to strategies during extraction.
 */
export interface ExtractionContext {
    entryUrl: string;
    domains: string[];
    networkProxy?: string;
    cookiePaths?: string[];
    loginMode?: string;
    timeout?: number;
    required?: string[];
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
    ): Promise<Result<ExtractedCredentials, AuthError>>;

    validate?(stored: ExtractedCredentials): Result<boolean, AuthError>;
}
