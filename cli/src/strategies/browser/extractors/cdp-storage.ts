import dlv from 'dlv';

import type { ExtractRule, IBrowserExtractor } from '../../../types/index.js';
import type { CdpWsClient } from '../cdp-ws.js';

/**
 * Extracts values from browser localStorage via CDP Runtime.evaluate.
 *
 * key: "localConfig_v2.teams.E7RBBBXHB.token" — dot-path into a localStorage entry
 * key: "msal.*.accesstoken.*" — glob pattern for matching localStorage keys
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
        const sessionId = await this.attachToPage(cdp);
        if (!sessionId) return null;

        try {
            await cdp.send('Runtime.enable', {}, sessionId).catch(() => {});

            const { storageKey, jsonPath } = this.parseKey(rule.key);

            let value: string | null;
            if (storageKey.includes('*')) {
                value = await this.extractByPattern(cdp, sessionId, storageKey);
            } else {
                value = await this.extractByKey(cdp, sessionId, storageKey);
            }

            if (!value) return null;

            if (jsonPath) {
                try {
                    const parsed = JSON.parse(value);
                    const resolved = dlv(parsed, jsonPath);
                    if (resolved == null) return null;
                    value = String(resolved);
                } catch {
                    return null;
                }
            }

            return { name: rule.name, value };
        } finally {
            await cdp.send('Target.detachFromTarget', { sessionId }).catch(() => {});
        }
    }

    private parseKey(key: string): { storageKey: string; jsonPath?: string } {
        if (key.includes('*')) {
            return { storageKey: key };
        }
        const dotIndex = key.indexOf('.');
        if (dotIndex === -1) {
            return { storageKey: key };
        }
        // Check if first segment is a plausible localStorage key
        // localStorage keys often contain underscores, camelCase, etc.
        // If the full key has no glob, treat first segment as key, rest as jsonPath
        const firstSegment = key.slice(0, dotIndex);
        const rest = key.slice(dotIndex + 1);
        return { storageKey: firstSegment, jsonPath: rest };
    }

    private async attachToPage(cdp: CdpWsClient): Promise<string | null> {
        const targets = (await cdp.send('Target.getTargets')) as {
            targetInfos: Array<{ targetId: string; type: string; url: string }>;
        };
        const page = targets?.targetInfos?.find((t) => t.type === 'page');
        if (!page) return null;

        const attach = (await cdp.send('Target.attachToTarget', {
            targetId: page.targetId,
            flatten: true,
        })) as { sessionId: string };

        return attach?.sessionId ?? null;
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

            // Extract value from JSON entries using common patterns (secret field, or raw JWT)

            for (const entry of matches) {
                if (!entry) continue;
                const jwt = this.extractJwtFromEntry(entry);
                if (jwt) return jwt;
            }

            // Fallback: return first non-null match as-is
            return matches.find((m) => m != null) ?? null;
        } catch {
            return raw;
        }
    }

    private extractJwtFromEntry(entry: string): string | null {
        // If entry is JSON with a "secret" field containing a JWT, extract it
        try {
            const parsed = JSON.parse(entry);
            if (parsed?.secret && typeof parsed.secret === 'string') {
                if (parsed.secret.startsWith('eyJ')) {
                    return parsed.secret;
                }
            }
        } catch {
            // Not JSON — check if the entry itself is a JWT
            if (entry.startsWith('eyJ') && entry.includes('.')) {
                return entry;
            }
        }
        return null;
    }

    private globToRegex(pattern: string): string {
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        return `^${escaped}$`;
    }
}
