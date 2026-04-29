import dlv from 'dlv';
import type { IBrowserExtractor } from '../core/interfaces/browser-extractor.js';
import type { CdpWsClient } from '../browser/cdp-ws.js';
import type { ExtractRule } from '../core/types/extract.js';

/**
 * Extracts values from browser localStorage via CDP Runtime.evaluate.
 *
 * key: "localConfig_v2.teams.E7RBBBXHB.token" — dot-path into a localStorage entry
 * key: "msal.*.accesstoken.*" — glob pattern for matching localStorage keys
 *
 * Output value: the resolved string value.
 */
export class StorageExtractor implements IBrowserExtractor {
    readonly type = 'localStorage' as const;

    async extract(
        cdp: CdpWsClient,
        _sessionId: string,
        rule: ExtractRule,
        _domains: string[],
        _cookiePaths?: string[],
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
                        for (let i = 0; i < localStorage.length; i++) {
                            const k = localStorage.key(i);
                            if (k && regex.test(k)) {
                                return localStorage.getItem(k);
                            }
                        }
                        return null;
                    } catch(e) { return null; }
                })()`,
                returnByValue: true,
            },
            sessionId,
        )) as { result?: { value?: string | null } };

        return result?.result?.value ?? null;
    }

    private globToRegex(pattern: string): string {
        const escaped = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*');
        return `^${escaped}$`;
    }
}
