import type { ExtractRule } from '../types.js';

/**
 * Unified extraction result — same shape for both headless and CDP extractors.
 */
export interface ExtractorResult {
    name: string;
    value: string;
    cookies?: Array<{ name: string; expires: number }>;
}

/**
 * Context adapter for headless (Playwright) extraction.
 * Abstracts BrowserContext.cookies() and Page.evaluate().
 */
export interface HeadlessExtractionCtx {
    cookies(): Promise<Array<{ name: string; value: string; domain: string; expires: number }>>;
    evaluate<T>(expression: string): Promise<T>;
}

/**
 * Sub-extractor that runs inside a headless Playwright session.
 * Mirrors IBrowserExtractor but uses Playwright APIs instead of CDP.
 *
 * Implementations: HeadlessCookieExtractor, HeadlessStorageExtractor
 */
export interface IHeadlessExtractor {
    readonly type: 'cookies' | 'localStorage';

    extract(
        ctx: HeadlessExtractionCtx,
        rule: ExtractRule,
        domains: string[],
    ): Promise<ExtractorResult | null>;
}
