import dlv from 'dlv';
import type { ExtractRule } from '../../../types/extract.js';
import type { IHeadlessExtractor, HeadlessExtractionCtx, ExtractorResult } from '../../../types/interfaces/headless-extractor.js';

export class HeadlessStorageExtractor implements IHeadlessExtractor {
    readonly type = 'localStorage' as const;

    async extract(
        ctx: HeadlessExtractionCtx,
        rule: ExtractRule,
        _domains: string[],
    ): Promise<ExtractorResult | null> {
        const { storageKey, jsonPath } = this.parseKey(rule.key);
        if (!storageKey) return null;

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

    private parseKey(key: string): { storageKey: string | null; jsonPath?: string } {
        if (key.includes('*')) return { storageKey: null };
        const dotIndex = key.indexOf('.');
        if (dotIndex === -1) return { storageKey: key };
        return { storageKey: key.slice(0, dotIndex), jsonPath: key.slice(dotIndex + 1) };
    }
}
