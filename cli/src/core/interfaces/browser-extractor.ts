import type { CdpWsClient } from '../../browser/cdp-ws.js';
import type { ExtractRule } from '../types/extract.js';

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
        sessionId: string,
        rule: ExtractRule,
        domains: string[],
        cookiePaths?: string[],
    ): Promise<{ name: string; value: string } | null>;
}
