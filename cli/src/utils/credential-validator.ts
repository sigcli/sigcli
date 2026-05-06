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
 *   - 401/403 → retry once, then false
 *   - 3xx redirect to login URL → false
 *   - 2xx → true
 *   - network error → false
 */
export async function validate(
    provider: ProviderConfig,
    credentials: ExtractedCredentials,
): Promise<boolean> {
    if (!credentials || Object.keys(credentials).length === 0) return false;

    const url = provider.validateUrl ?? provider.entryUrl;
    if (!url) return true;

    const headers = ApplyEngine.applyRules(provider.apply, credentials).headers;
    const dispatcher = provider.networkProxy
        ? createProxyDispatcher(provider.networkProxy)
        : undefined;

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: { ...headers, [HttpHeader.USER_AGENT]: buildUserAgent() },
                redirect: 'manual',
                dispatcher,
                signal: AbortSignal.timeout(10_000),
            });

            if (res.status === 401 || res.status === 403) {
                if (attempt === 0) {
                    await new Promise((r) => setTimeout(r, 1000));
                    continue;
                }
                return false;
            }

            if (res.status >= 300 && res.status < 400) {
                if (provider.validateUrl) return false;
                const location = (res.headers.get('location') ?? '').toLowerCase();
                return !LOGIN_URL_PATTERNS.some((p) => location.includes(p));
            }

            return true;
        } catch {
            return false;
        }
    }

    return false;
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

function createProxyDispatcher(proxy: string): Dispatcher {
    if (proxy.startsWith('socks5://') || proxy.startsWith('socks://')) {
        return new Socks5ProxyAgent(proxy);
    }
    return new ProxyAgent(proxy);
}
