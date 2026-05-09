import { fetch, ProxyAgent, Socks5ProxyAgent, type Dispatcher } from 'undici';

import {
    HttpHeader,
    LOGIN_URL_PATTERNS,
    type ExtractedCredentials,
    type ProviderConfig,
    type StoredCredential,
} from '../types/index.js';
import { ApplyEngine } from '../apply/apply-engine.js';
import { parseDuration } from './duration.js';
import { buildUserAgent } from './http.js';

/**
 * Validate credentials by probing validateUrl ?? entryUrl.
 *
 * Rules:
 *   - empty credentials → false
 *   - not all extract rules produced values → false
 *   - 401/403 → false
 *   - 3xx redirect to login URL → false
 *   - 2xx with JS redirect body (< 4KB) → false
 *   - 2xx → true
 *   - network error → true (optimistic)
 */
export async function validate(
    provider: ProviderConfig,
    credentials: ExtractedCredentials,
): Promise<boolean> {
    if (!credentials || Object.keys(credentials).length === 0) return false;
    if (!provider.extract.every((rule) => !!credentials[rule.as])) return false;

    const url = provider.validateUrl ?? provider.entryUrl;
    if (!url) return true;

    try {
        const headers = ApplyEngine.applyRules(provider.apply, credentials).headers;
        const dispatcher = provider.networkProxy
            ? createProxyDispatcher(provider.networkProxy)
            : undefined;

        const res = await fetch(url, {
            method: 'GET',
            headers: { ...headers, [HttpHeader.USER_AGENT]: buildUserAgent() },
            redirect: 'manual',
            dispatcher,
            signal: AbortSignal.timeout(10_000),
        });

        return isValidResponse(res, provider);
    } catch {
        return true;
    }
}

async function isValidResponse(
    res: Awaited<ReturnType<typeof fetch>>,
    provider: ProviderConfig,
): Promise<boolean> {
    if (res.status === 401 || res.status === 403) return false;

    if (res.status >= 300 && res.status < 400) {
        if (provider.validateUrl) return false;
        const location = (res.headers.get('location') ?? '').toLowerCase();
        return !LOGIN_URL_PATTERNS.some((p) => location.includes(p));
    }

    const body = await res.text().catch(() => '');
    if (body && body.length < 4096 && hasJsRedirect(body)) return false;

    return true;
}

/**
 * Check validity of a stored credential via TTL.
 */
export function checkTtl(stored: StoredCredential, provider: ProviderConfig): boolean {
    if (stored.expiresAt) {
        return Date.now() < new Date(stored.expiresAt).getTime();
    }
    if (!provider.ttl) return true;
    const ttlMs = parseDuration(provider.ttl);
    if (!ttlMs) return true;
    const updatedAt = new Date(stored.updatedAt).getTime();
    return Date.now() - updatedAt < ttlMs;
}

/**
 * Calculate when a stored credential expires.
 */
export function getExpiresAt(stored: StoredCredential, provider: ProviderConfig): Date | null {
    if (stored.expiresAt) {
        return new Date(stored.expiresAt);
    }
    if (provider.ttl) {
        const ttlMs = parseDuration(provider.ttl);
        if (ttlMs) {
            return new Date(new Date(stored.updatedAt).getTime() + ttlMs);
        }
    }
    return null;
}

const JS_REDIRECT_PATTERNS = [
    /window\.location\s*[=.]/i,
    /document\.location\s*[=.]/i,
    /location\.(?:href|replace|assign)\s*[=(]/i,
    /<meta\s+http-equiv\s*=\s*["']?refresh["']?/i,
];

export function hasJsRedirect(body: string): boolean {
    return JS_REDIRECT_PATTERNS.some((re) => re.test(body));
}

function createProxyDispatcher(proxy: string): Dispatcher {
    if (proxy.startsWith('socks5://') || proxy.startsWith('socks://')) {
        return new Socks5ProxyAgent(proxy);
    }
    return new ProxyAgent(proxy);
}
