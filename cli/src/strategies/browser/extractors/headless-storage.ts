import dlv from 'dlv';

import type { ExtractRule } from '../../../types/index.js';
import type {
    ExtractorResult,
    HeadlessExtractionCtx,
    IHeadlessExtractor,
} from '../../../types/interfaces/headless-extractor.js';

export class HeadlessStorageExtractor implements IHeadlessExtractor {
    readonly type = 'localStorage' as const;

    async extract(
        ctx: HeadlessExtractionCtx,
        rule: ExtractRule,
        _domains: string[],
    ): Promise<ExtractorResult | null> {
        const { storageKey, jsonPath } = this.parseKey(rule.key);

        if (storageKey === null) return null;

        if (storageKey.includes('*')) {
            return this.extractByPattern(ctx, rule.name, storageKey);
        }

        const val = await ctx.evaluate<string | null>(
            `(() => { try { return localStorage.getItem(${JSON.stringify(storageKey)}); } catch { return null; } })()`,
        );
        if (!val) return null;

        if (jsonPath) {
            try {
                const parsed = JSON.parse(val);
                const resolved = dlv(parsed, jsonPath);
                if (resolved == null) return null;
                return { name: rule.name, value: String(resolved) };
            } catch {
                return null;
            }
        }

        return { name: rule.name, value: val };
    }

    private async extractByPattern(
        ctx: HeadlessExtractionCtx,
        name: string,
        pattern: string,
    ): Promise<ExtractorResult | null> {
        const regex = this.globToRegex(pattern);

        const raw = await ctx.evaluate<string | null>(
            `(() => {
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
        );
        if (!raw) return null;

        try {
            const matches = JSON.parse(raw) as (string | null)[];
            if (!matches?.length) return null;

            for (const entry of matches) {
                if (!entry) continue;
                const jwt = this.extractJwtFromEntry(entry);
                if (jwt) return { name, value: jwt };
            }

            const first = matches.find((m) => m != null);
            return first ? { name, value: first } : null;
        } catch {
            return { name, value: raw };
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

    private parseKey(key: string): { storageKey: string | null; jsonPath?: string } {
        if (key.includes('*')) {
            return { storageKey: key };
        }
        const dotIndex = key.indexOf('.');
        if (dotIndex === -1) return { storageKey: key };
        return { storageKey: key.slice(0, dotIndex), jsonPath: key.slice(dotIndex + 1) };
    }

    private globToRegex(pattern: string): string {
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        return `^${escaped}$`;
    }
}
