import {
    HttpHeader,
    LOGIN_URL_PATTERNS,
    type ExtractedCredentials,
    type ProviderConfig,
    type StoredCredential,
} from '../types/index.js';
import { checkRequired } from '../strategies/browser/required-checker.js';
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
 * Respects provider.networkProxy if configured.
 */
export async function validateCredential(
    provider: ProviderConfig,
    credentials: ExtractedCredentials,
): Promise<{ status: number | null; isLoginRedirect: boolean }> {
    if (!provider.entryUrl) return { status: null, isLoginRedirect: false };
    try {
        const headers = ApplyEngine.applyRules(provider.apply, credentials).headers;
        const response = await fetch(provider.entryUrl, {
            method: 'GET',
            headers: { ...headers, [HttpHeader.USER_AGENT]: buildUserAgent() },
            redirect: 'manual',
        });
        return { status: response.status, isLoginRedirect: await isLoginResponse(response) };
    } catch {
        return { status: null, isLoginRedirect: false };
    }
}

async function isLoginResponse(response: Response): Promise<boolean> {
    if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location') ?? '';
        return matchesLoginPattern(location);
    }
    if (response.status !== 200) return false;
    const ct = response.headers.get('content-type') ?? '';
    if (!ct.includes('text/html')) return false;
    const body = await response.text().catch(() => '');
    return matchesLoginPattern(body);
}

function matchesLoginPattern(text: string): boolean {
    const lower = text.toLowerCase();
    return LOGIN_URL_PATTERNS.some((p) => lower.includes(p));
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

/**
 * The single validation check used at all 3 phases of sig login.
 *
 * Logic:
 * - If required[] set → check fields exist + not expired. Authoritative, no HTTP probe.
 * - If no required[] → redirect detection via HTTP probe (SSO sites).
 * - Fallback: any non-empty credentials accepted.
 *
 * Network errors during HTTP probe → accept optimistically.
 */
export async function validate(
    provider: ProviderConfig,
    credentials: ExtractedCredentials,
): Promise<boolean> {
    if (!credentials || Object.keys(credentials).length === 0) return false;

    if (provider.required?.length) {
        const unmet = checkRequired(provider.required, credentials);
        if (unmet.length > 0) return false;
        return true;
    }

    if (provider.apply?.length && provider.entryUrl) {
        const { status, isLoginRedirect } = await validateCredential(provider, credentials);
        if (status === null) return true;
        return !isLoginRedirect;
    }

    return true;
}
