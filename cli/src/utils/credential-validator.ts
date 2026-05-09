import { fetch } from 'undici';

import {
    HttpHeader,
    LOGIN_URL_PATTERNS,
    type ExtractedCredentials,
    type ProviderConfig,
    type StoredCredential,
} from '../types/index.js';
import { ApplyEngine } from '../apply/apply-engine.js';
import { parseDuration } from './duration.js';
import { buildUserAgent, createProxyDispatcher } from './http.js';

/**
 * Validate credentials by probing validateUrl ?? entryUrl.
 *
 * Rules:
 *   - empty credentials → false
 *   - not all extract rules produced values → false
 *   - 401/403/406 → false
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
        const dispatcher = createProxyDispatcher(provider.networkProxy);

        const res = await fetch(url, {
            method: 'GET',
            headers: { ...headers, [HttpHeader.USER_AGENT]: buildUserAgent() },
            redirect: 'manual',
            dispatcher,
            signal: AbortSignal.timeout(10_000),
        });

        const body = await res.text().catch(() => '');
        const resHeaders: Record<string, string | undefined> = {
            location: res.headers.get('location') ?? undefined,
        };
        return isAuthenticatedResponse(
            { status: res.status, body, headers: resHeaders },
            !!provider.validateUrl,
        );
    } catch {
        return true;
    }
}

export interface HttpResponse {
    status: number;
    body: string;
    headers: Record<string, string | undefined>;
}

/**
 * Check if an HTTP response indicates valid authentication.
 * Shared by validate() probe and sig request reauth logic.
 */
export function isAuthenticatedResponse(res: HttpResponse, validateUrl?: boolean): boolean {
    if (res.status === 401 || res.status === 403 || res.status === 406) return false;

    if (res.status >= 300 && res.status < 400) {
        if (validateUrl) return false;
        const location = (res.headers['location'] ?? '').toLowerCase();
        return !LOGIN_URL_PATTERNS.some((p) => location.includes(p));
    }

    if (res.body && res.body.length < 4096 && hasJsRedirect(res.body)) return false;

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

function hasJsRedirect(body: string): boolean {
    return JS_REDIRECT_PATTERNS.some((re) => re.test(body));
}
