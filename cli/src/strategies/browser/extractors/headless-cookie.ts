import type { ExtractRule } from '../../../types/index.js';
import type {
    ExtractorResult,
    HeadlessExtractionCtx,
    IHeadlessExtractor,
} from '../../../types/interfaces/headless-extractor.js';

export class HeadlessCookieExtractor implements IHeadlessExtractor {
    readonly type = 'cookies' as const;

    async extract(
        ctx: HeadlessExtractionCtx,
        rule: ExtractRule,
        domains: string[],
    ): Promise<ExtractorResult | null> {
        const cookies = await ctx.cookies();
        let filtered = cookies.filter((c) => {
            const d = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
            return domains.some((pd) => d === pd || pd.endsWith('.' + d) || d.endsWith('.' + pd));
        });

        if (!filtered.length) return null;

        if (rule.key !== '*') {
            const names = new Set(rule.key.split(',').map((n) => n.trim()));
            filtered = filtered.filter((c) => names.has(c.name));
            if (!filtered.length) return null;
        }

        const value = filtered.map((c) => `${c.name}=${c.value}`).join('; ');
        const cookieMeta = filtered
            .filter((c) => c.expires > 0)
            .map((c) => ({ name: c.name, expires: c.expires }));

        return { name: rule.name, value, cookies: cookieMeta };
    }
}
