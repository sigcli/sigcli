import dlv from 'dlv';

import type { ExtractRule } from '../../../types/index.js';
import type { CdpWsClient } from '../cdp-ws.js';

/**
 * Extracts values from browser localStorage via CDP Runtime.evaluate.
 * Requires an active session with Runtime already enabled.
 *
 * key: "localConfig_v2.teams.E7RBBBXHB.token" — dot-path into a localStorage entry
 * key: "msal.*.accesstoken.*" — glob pattern for matching localStorage keys
 */
export class CdpStorageExtractor {
    async extract(
        cdp: CdpWsClient,
        sessionId: string,
        rule: ExtractRule,
    ): Promise<{ name: string; value: string } | null> {
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
    }

    private parseKey(key: string): { storageKey: string; jsonPath?: string } {
        if (key.includes('*')) {
            return { storageKey: key };
        }
        const dotIndex = key.indexOf('.');
        if (dotIndex === -1) {
            return { storageKey: key };
        }
        const firstSegment = key.slice(0, dotIndex);
        const rest = key.slice(dotIndex + 1);
        return { storageKey: firstSegment, jsonPath: rest };
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

            for (const entry of matches) {
                if (!entry) continue;
                const jwt = this.extractJwtFromEntry(entry);
                if (jwt) return jwt;
            }

            return matches.find((m) => m != null) ?? null;
        } catch {
            return raw;
        }
    }

    private extractJwtFromEntry(entry: string): string | null {
        try {
            const parsed = JSON.parse(entry);
            if (parsed?.secret && typeof parsed.secret === 'string') {
                if (parsed.secret.startsWith('eyJ')) {
                    return parsed.secret;
                }
            }
        } catch {
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
