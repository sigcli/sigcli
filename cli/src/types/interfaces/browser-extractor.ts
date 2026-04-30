import type { CdpWsClient } from '../../browser/cdp-ws.js';
import type { ExtractRule } from '../types.js';

/**
 * Sub-extractor that runs inside a browser session via CDP.
 * BrowserSource dispatches to these based on extract[].from.
 *
 * Implementations: CookieExtractor, StorageExtractor, EvalExtractor
 */
export interface IBrowserExtractor {
    readonly type: 'cookies' | 'localStorage' | 'eval';

    extract(
        cdp: CdpWsClient,
        rule: ExtractRule,
        domains: string[],
        cookiePaths?: string[],
    ): Promise<{
        name: string;
        value: string;
        cookies?: Array<{ name: string; expires: number }>;
    } | null>;
}
