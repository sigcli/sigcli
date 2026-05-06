import dlv from 'dlv';

import type { ExtractRule, IBrowserExtractor } from '../../../types/index.js';
import { attachToPageTarget, type CdpWsClient } from '../cdp-ws.js';

export class CdpStorageExtractor implements IBrowserExtractor {
    readonly type = 'localStorage' as const;

    async extract(
        cdp: CdpWsClient,
        rule: ExtractRule,
        _domains: string[],
    ): Promise<{ name: string; value: string; expiresAt?: string } | null> {
        const sessionId = await attachToPageTarget(cdp);
        if (!sessionId) return null;

        try {
            await cdp.send('Runtime.enable', {}, sessionId).catch(() => {});

            let rawValue: string | null;
            if (rule.match.includes('*')) {
                rawValue = await this.extractByPattern(cdp, sessionId, rule.match);
            } else {
                rawValue = await this.extractByKey(cdp, sessionId, rule.match);
            }

            if (!rawValue) return null;

            let expiresAt: string | undefined;
            if (rule.expiresJsonPath) {
                try {
                    const parsed = JSON.parse(rawValue);
                    const raw = dlv(parsed, rule.expiresJsonPath);
                    if (raw != null) {
                        expiresAt = this.toIsoTimestamp(raw);
                    }
                } catch {
                    // ignore parse errors
                }
            }

            let value = rawValue;
            if (rule.jsonPath) {
                try {
                    const parsed = JSON.parse(rawValue);
                    const resolved = dlv(parsed, rule.jsonPath);
                    if (resolved == null) return null;
                    value = String(resolved);
                } catch {
                    return null;
                }
            }

            return { name: rule.as, value, ...(expiresAt ? { expiresAt } : {}) };
        } finally {
            await cdp.send('Target.detachFromTarget', { sessionId }).catch(() => {});
        }
    }

    private toIsoTimestamp(raw: unknown): string | undefined {
        if (typeof raw === 'number') {
            const ms = raw > 1e12 ? raw : raw * 1000;
            return new Date(ms).toISOString();
        }
        if (typeof raw === 'string') {
            // Handle numeric strings (e.g. MSAL "expiresOn": "1777983731")
            if (/^\d+$/.test(raw)) {
                const num = Number(raw);
                const ms = num > 1e12 ? num : num * 1000;
                return new Date(ms).toISOString();
            }
            const d = new Date(raw);
            return isNaN(d.getTime()) ? undefined : d.toISOString();
        }
        return undefined;
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
