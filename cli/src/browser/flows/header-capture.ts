import type { IBrowserPage } from '../../core/interfaces/browser-adapter.js';
import type { XHeaderConfig } from '../../core/types.js';

export interface HeaderCaptureResult {
    /** Captured headers (keyed by original config name, values last-write-wins) */
    xHeaders: Record<string, string>;
    /** Call to remove network listeners */
    cleanup: () => void;
}

/**
 * Start capturing HTTP headers from browser network traffic.
 *
 * - Static values are populated immediately.
 * - Dynamic values are captured via onRequest/onResponse listeners.
 * - Filters by providerDomains and optional urlPattern per config entry.
 * - Header name matching is case-insensitive.
 * - Gracefully degrades if the page doesn't support onRequest/onResponse.
 *
 * @param page           Browser page to observe
 * @param configs        Header capture configurations
 * @param providerDomains  Domains belonging to the provider (used as URL filter)
 * @returns xHeaders record and a cleanup function
 */
export function startHeaderCapture(
    page: IBrowserPage,
    configs: XHeaderConfig[],
    providerDomains: string[],
): HeaderCaptureResult {
    const xHeaders: Record<string, string> = {};
    const cleanups: Array<() => void> = [];

    // Separate static vs dynamic configs
    const dynamicConfigs: XHeaderConfig[] = [];

    for (const cfg of configs) {
        if (cfg.staticValue !== undefined) {
            xHeaders[cfg.name] = cfg.staticValue;
        } else {
            dynamicConfigs.push(cfg);
        }
    }

    // If no dynamic configs or page doesn't support interception, return early
    if (dynamicConfigs.length === 0) {
        return { xHeaders, cleanup: () => {} };
    }

    // Build a set of request-source and response-source configs
    const requestConfigs = dynamicConfigs.filter((c) => !c.source || c.source === 'request');
    const responseConfigs = dynamicConfigs.filter((c) => !c.source || c.source === 'response');

    // Helper: check if a URL matches the provider domains and optional urlPattern
    function matchesUrl(url: string, urlPattern?: string): boolean {
        // Must match at least one provider domain
        let domainMatch = false;
        try {
            const parsed = new URL(url);
            for (const domain of providerDomains) {
                // Support wildcard domains like *.example.com
                if (domain.startsWith('*.')) {
                    const suffix = domain.slice(1); // .example.com
                    if (parsed.hostname.endsWith(suffix) || parsed.hostname === domain.slice(2)) {
                        domainMatch = true;
                        break;
                    }
                } else if (parsed.hostname === domain) {
                    domainMatch = true;
                    break;
                }
            }
        } catch {
            return false;
        }
        if (!domainMatch) return false;

        // Optional urlPattern filter (simple substring match on full URL)
        if (urlPattern) {
            return url.includes(urlPattern);
        }
        return true;
    }

    // Helper: extract matching headers from a headers record
    function extractHeaders(
        configs: XHeaderConfig[],
        url: string,
        headers: Record<string, string>,
    ): void {
        for (const cfg of configs) {
            if (!matchesUrl(url, cfg.urlPattern)) continue;

            // Case-insensitive header lookup
            const lowerName = cfg.name.toLowerCase();
            for (const [key, value] of Object.entries(headers)) {
                if (key.toLowerCase() === lowerName) {
                    xHeaders[cfg.name] = value;
                    break;
                }
            }
        }
    }

    // Set up request listener
    if (requestConfigs.length > 0 && page.onRequest) {
        const unsub = page.onRequest((req) => {
            extractHeaders(requestConfigs, req.url, req.headers);
        });
        cleanups.push(unsub);
    }

    // Set up response listener
    if (responseConfigs.length > 0 && page.onResponse) {
        const unsub = page.onResponse((res) => {
            extractHeaders(responseConfigs, res.url, res.headers);
        });
        cleanups.push(unsub);
    }

    return {
        xHeaders,
        cleanup: () => {
            for (const fn of cleanups) {
                fn();
            }
        },
    };
}
