import type { Credential, ProviderConfig, StoredCredential } from './core/types.js';
import type { ProviderConfigV2 } from './core/types/extract.js';
import { LOGIN_URL_PATTERNS, HttpHeader } from './core/constants.js';
import { buildUserAgent } from './utils/http.js';
import { parseDuration } from './utils/duration.js';
import { ApplyEngine } from './apply/apply-engine.js';
import { credentialToExtracted, toV2Config } from './credential-converter.js';

/**
 * Check TTL-based validity of a stored credential.
 * Returns true if credential is still valid, false if expired.
 */
export function checkTtl(stored: StoredCredential, provider: ProviderConfigV2): boolean {
    if (!provider.ttl) return true; // No TTL = never expires
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
    credential: Credential,
): Promise<{ status: number | null; isLoginRedirect: boolean }> {
    if (!provider.entryUrl) return { status: null, isLoginRedirect: false };
    try {
        const v2 = toV2Config(provider);
        const extracted = credentialToExtracted(credential);
        const result = ApplyEngine.applyRules(v2.apply, extracted);
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
 * Returns null if no expiry can be determined.
 */
export function getExpiresAt(stored: StoredCredential, provider: ProviderConfigV2): Date | null {
    if (provider.ttl) {
        const ttlMs = parseDuration(provider.ttl);
        if (ttlMs) {
            return new Date(new Date(stored.updatedAt).getTime() + ttlMs);
        }
    }
    if (stored.credential?.type === 'bearer' && stored.credential.expiresAt) {
        return new Date(stored.credential.expiresAt);
    }
    return null;
}
