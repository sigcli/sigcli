import type { CdpWsClient } from '../../strategies/browser/cdp-ws.js';
import type { ExtractRule } from '../types.js';

export interface IBrowserExtractor {
    readonly type: 'cookies' | 'localStorage' | 'eval';

    extract(
        cdp: CdpWsClient,
        rule: ExtractRule,
        domains: string[],
    ): Promise<{
        name: string;
        value: string;
        cookies?: Array<{ name: string; expires: number }>;
    } | null>;
}
