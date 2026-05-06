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
 * Check validity of a stored credential.
 * Checks stored.expiresAt (real cookie/token expiry) first, then falls back to TTL.
 * Returns true if credential is still valid, false if expired.
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
 * Validate a credential by making a test HTTP request.
 * Returns status code and whether the response is a login redirect.
 */
export async function validateCredential(
    provider: ProviderConfig,
    credentials: ExtractedCredentials,
): Promise<{ status: number | null; isLoginRedirect: boolean }> {
    if (!provider.entryUrl) return { status: null, isLoginRedirect: false };
    try {
        const result = ApplyEngine.applyRules(provider.apply, credentials);
        const headers = result.headers;
        const response = await fetch(provider.entryUrl, {
            method: 'GET',
            headers: { ...headers, [HttpHeader.USER_AGENT]: buildUserAgent() },
            redirect: 'manual',
        });
        const location = response.headers.get('location') ?? '';
        const isLoginRedirect =
            response.status >= 300 &&
            response.status < 400 &&
            LOGIN_URL_PATTERNS.some((p) => location.toLowerCase().includes(p));
        return { status: response.status, isLoginRedirect };
    } catch {
        return { status: null, isLoginRedirect: false };
    }
}

/**
 * Calculate when a stored credential expires.
 * Prefers stored.expiresAt (real cookie/token expiry from extraction) over TTL-based estimate.
 * Returns null if no expiry can be determined.
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
