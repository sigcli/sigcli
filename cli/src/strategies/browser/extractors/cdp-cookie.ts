import type { ExtractRule, IBrowserExtractor } from '../../../types/index.js';
import type { CdpWsClient } from '../cdp-ws.js';

export interface CdpCookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite?: string;
}

/**
 * Extracts cookies from the browser via CDP Storage.getCookies.
 *
 * key: "*" = all cookies for provider domains
 * key: "name1, name2" = only specific cookies (still extracts all, filters output)
 *
 * Output value: serialized "name1=val1; name2=val2" string.
 */
export class CdpCookieExtractor implements IBrowserExtractor {
    readonly type = 'cookies' as const;

    async extract(
        cdp: CdpWsClient,
        rule: ExtractRule,
        domains: string[],
        _cookiePaths?: string[],
    ): Promise<{ name: string; value: string; cookies: CdpCookie[] } | null> {
        const result = (await cdp.send('Storage.getCookies', {
            browserContextId: undefined,
        })) as { cookies: CdpCookie[] } | null;

        if (!result?.cookies?.length) return null;

        let filtered = this.filterByDomain(result.cookies, domains);
        if (!filtered.length) return null;

        if (rule.key !== '*') {
            const names = new Set(rule.key.split(',').map((n) => n.trim()));
            filtered = filtered.filter((c) => names.has(c.name));
            if (!filtered.length) return null;
        }

        const serialized = filtered.map((c) => `${c.name}=${c.value}`).join('; ');

        return { name: rule.name, value: serialized, cookies: filtered };
    }

    private filterByDomain(cookies: CdpCookie[], domains: string[]): CdpCookie[] {
        return cookies.filter((c) => {
            const cookieDomain = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
            return domains.some((d) => {
                // Exact match
                if (cookieDomain === d) return true;
                // Cookie domain is parent of provider domain (e.g. slack.com matches sap.enterprise.slack.com)
                if (d.endsWith('.' + cookieDomain)) return true;
                // Cookie domain is subdomain of provider domain
                if (cookieDomain.endsWith('.' + d)) return true;
                return false;
            });
        });
    }
}
