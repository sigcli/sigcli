import type { IBrowserExtractor } from '../../../types/interfaces/browser-extractor.js';
import type { CdpWsClient } from '../../../browser/cdp-ws.js';
import type { ExtractRule } from '../../../types/extract.js';

interface CdpCookie {
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
export class CookieExtractor implements IBrowserExtractor {
    readonly type = 'cookies' as const;

    async extract(
        cdp: CdpWsClient,
        rule: ExtractRule,
        domains: string[],
        // todo: should extract cookies from paths, e.g. path of /y on x.com, should get all from x.com and x.com/y
        _cookiePaths?: string[],
    ): Promise<{ name: string; value: string; expiresAt?: string } | null> {
        const result = (await cdp.send('Storage.getCookies', {
            browserContextId: undefined,
        })) as { cookies: CdpCookie[] } | null;

        if (!result?.cookies?.length) return null;

        const filtered = this.filterByDomain(result.cookies, domains);
        if (!filtered.length) return null;

        const serialized = filtered.map((c) => `${c.name}=${c.value}`).join('; ');

        // Compute expiresAt from minimum cookie expiry
        const expiries = filtered.filter((c) => c.expires > 0).map((c) => c.expires * 1000);
        const expiresAt =
            expiries.length > 0 ? new Date(Math.min(...expiries)).toISOString() : undefined;

        return { name: rule.name, value: serialized, expiresAt };
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
