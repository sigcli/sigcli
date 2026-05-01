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
        if (rule.match.includes('*')) {
            return this.extractByPattern(ctx, rule.as, rule.match, rule.jsonPath);
        }

        const val = await ctx.evaluate<string | null>(
            `(() => { try { return localStorage.getItem(${JSON.stringify(rule.match)}); } catch { return null; } })()`,
        );
        if (!val) return null;

        if (rule.jsonPath) {
            try {
                const parsed = JSON.parse(val);
                const resolved = dlv(parsed, rule.jsonPath);
                if (resolved == null) return null;
                return { name: rule.as, value: String(resolved) };
            } catch {
                return null;
            }
        }

        return { name: rule.as, value: val };
    }

    private async extractByPattern(
        ctx: HeadlessExtractionCtx,
        name: string,
        pattern: string,
        jsonPath?: string,
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

            const first = matches.find((m) => m != null);
            if (!first) return null;

            if (jsonPath) {
                try {
                    const parsed = JSON.parse(first);
                    const resolved = dlv(parsed, jsonPath);
                    if (resolved == null) return null;
                    return { name, value: String(resolved) };
                } catch {
                    return null;
                }
            }

            return { name, value: first };
        } catch {
            return { name, value: raw };
        }
    }

    private globToRegex(pattern: string): string {
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        return `^${escaped}$`;
    }
}
