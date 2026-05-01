import dlv from 'dlv';

import type { ExtractRule, IBrowserExtractor } from '../../../types/index.js';
import { attachToPageTarget, type CdpWsClient } from '../cdp-ws.js';

/**
 * Extracts values from browser localStorage via CDP Runtime.evaluate.
 *
 * match: "localConfig_v2" — exact localStorage key lookup
 * match: "msal.*.accesstoken.*" — glob pattern for matching localStorage keys
 * jsonPath: "teams.E7RBBBXHB.token" — dot-path into the parsed JSON value
 *
 * Output value: the resolved string value.
 */
export class CdpStorageExtractor implements IBrowserExtractor {
    readonly type = 'localStorage' as const;

    async extract(
        cdp: CdpWsClient,
        rule: ExtractRule,
        _domains: string[],
    ): Promise<{ name: string; value: string } | null> {
        const sessionId = await attachToPageTarget(cdp);
        if (!sessionId) return null;

        try {
            await cdp.send('Runtime.enable', {}, sessionId).catch(() => {});

            let value: string | null;
            if (rule.match.includes('*')) {
                value = await this.extractByPattern(cdp, sessionId, rule.match);
            } else {
                value = await this.extractByKey(cdp, sessionId, rule.match);
            }

            if (!value) return null;

            if (rule.jsonPath) {
                try {
                    const parsed = JSON.parse(value);
                    const resolved = dlv(parsed, rule.jsonPath);
                    if (resolved == null) return null;
                    value = String(resolved);
                } catch {
                    return null;
                }
            }

            return { name: rule.as, value };
        } finally {
            await cdp.send('Target.detachFromTarget', { sessionId }).catch(() => {});
        }
    }

    private async extractByKey(
        cdp: CdpWsClient,
        sessionId: string,
        key: string,
    ): Promise<string | null> {
        const result = (await cdp.send(
            'Runtime.evaluate',
            {
                expression: `(() => { try { return localStorage.getItem(${JSON.stringify(key)}); } catch(e) { return null; } })()`,
                returnByValue: true,
            },
            sessionId,
        )) as { result?: { value?: string | null } };

        return result?.result?.value ?? null;
    }

    private async extractByPattern(
        cdp: CdpWsClient,
        sessionId: string,
        pattern: string,
    ): Promise<string | null> {
        const regex = this.globToRegex(pattern);

        const result = (await cdp.send(
            'Runtime.evaluate',
            {
                expression: `(() => {
                    try {
                        const regex = new RegExp(${JSON.stringify(regex)});
                        const matches = [];
                        for (let i = 0; i < localStorage.length; i++) {
                            const k = localStorage.key(i);
                            if (k && regex.test(k)) {
                                matches.push(localStorage.getItem(k));
                            }
                        }
                        return JSON.stringify(matches);
                    } catch(e) { return null; }
                })()`,
                returnByValue: true,
            },
            sessionId,
        )) as { result?: { value?: string | null } };

        const raw = result?.result?.value;
        if (!raw) return null;

        try {
            const matches = JSON.parse(raw) as (string | null)[];
            if (!matches?.length) return null;
            return matches.find((m) => m != null) ?? null;
        } catch {
            return raw;
        }
    }

    private globToRegex(pattern: string): string {
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        return `^${escaped}$`;
    }
}
