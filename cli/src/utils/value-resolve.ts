import dlv from 'dlv';

import type { Cookie } from '../types/types.js';

export type ExtractedValues = Record<string, unknown>;

export function isCookieArray(value: unknown): value is Cookie[] {
    if (!Array.isArray(value) || value.length === 0) return false;
    const first = value[0];
    return (
        typeof first === 'object' &&
        first !== null &&
        'name' in first &&
        'value' in first &&
        'domain' in first
    );
}

export function serializeCookies(cookies: Cookie[]): string {
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

/**
 * Resolve a reference like "session" or "session.d" against extracted credentials.
 *
 * Rules:
 *   - Split ref on first dot → (as, path?)
 *   - Look up credentials[as]
 *   - If no path:
 *       Cookie[] → serialize to "n1=v1; n2=v2"
 *       string   → return as-is
 *       object   → JSON.stringify
 *   - If path:
 *       Cookie[] → find cookie by name, return its value
 *       object   → dlv(value, path)
 *       string   → try JSON.parse + dlv, else null
 */
export function resolveRef(credentials: ExtractedValues, ref: string): string | null {
    const dotIndex = ref.indexOf('.');
    const as = dotIndex === -1 ? ref : ref.slice(0, dotIndex);
    const path = dotIndex === -1 ? undefined : ref.slice(dotIndex + 1);

    const value = credentials[as];
    if (value == null) return null;

    if (!path) {
        if (isCookieArray(value)) return serializeCookies(value);
        if (typeof value === 'string') return value;
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    }

    if (isCookieArray(value)) {
        const cookie = value.find((c) => c.name === path);
        return cookie?.value ?? null;
    }

    if (typeof value === 'object') {
        const resolved = dlv(value as Record<string, unknown>, path);
        if (resolved == null) return null;
        return typeof resolved === 'string' ? resolved : JSON.stringify(resolved);
    }

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            const resolved = dlv(parsed, path);
            if (resolved == null) return null;
            return typeof resolved === 'string' ? resolved : JSON.stringify(resolved);
        } catch {
            return null;
        }
    }

    return null;
}

/**
 * Interpolate a template string like "Bearer ${access_token.secret}".
 * Each ${ref} is resolved via resolveRef.
 */
export function interpolateTemplate(template: string, credentials: ExtractedValues): string {
    return template.replace(/\$\{([^}]+)\}/g, (_, ref) => resolveRef(credentials, ref) ?? '');
}

/**
 * Check if a requirement is met. Same resolution as resolveRef —
 * returns true if the resolved value is non-null and non-empty.
 */
export function checkRequirement(credentials: ExtractedValues, req: string): boolean {
    const resolved = resolveRef(credentials, req);
    return resolved != null && resolved !== '';
}
