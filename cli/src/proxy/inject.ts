import type { ProxyInjectRule } from '../types/types.js';
import type { ExtractedCredentials } from '../types/interfaces/strategy.js';
import type * as http from 'node:http';

/**
 * Resolve a value from extracted credentials using a dot-path.
 * Paths are relative to the credentials map: "session", "access_token", etc.
 * Legacy "credential." prefix is stripped for backward compat.
 */
export function resolveFrom(credentials: ExtractedCredentials, fromPath: string): string | null {
    // Strip legacy "credential." prefix
    const key = fromPath.startsWith('credential.') ? fromPath.slice('credential.'.length) : fromPath;

    // Direct key lookup
    if (key in credentials) {
        return credentials[key] ?? null;
    }

    // Legacy mapping: "cookies" → "session", "accessToken" → "access_token"
    const legacyMap: Record<string, string> = {
        cookies: 'session',
        accessToken: 'access_token',
        key: 'token',
        username: 'username',
        password: 'password',
    };

    // Try legacy key mapping
    const mapped = legacyMap[key];
    if (mapped && mapped in credentials) {
        return credentials[mapped] ?? null;
    }

    // Handle "localStorage.<key>" — flatten to just the key
    if (key.startsWith('localStorage.')) {
        const lsKey = key.slice('localStorage.'.length);
        return credentials[lsKey] ?? null;
    }

    return null;
}

export function applyInjectRules(
    rules: ProxyInjectRule[],
    credentials: ExtractedCredentials,
    headers: http.OutgoingHttpHeaders,
    bodyBuffer: Buffer | undefined,
    contentType: string | undefined,
    url: string,
): { headers: http.OutgoingHttpHeaders; body: Buffer | undefined; url: string } {
    const outHeaders = { ...headers };
    let outBody = bodyBuffer;
    let outUrl = url;

    for (const rule of rules) {
        const { action } = rule;
        const value = rule.from ? resolveFrom(credentials, rule.from) : null;

        if (rule.in === 'header') {
            if (action === 'remove') {
                delete outHeaders[rule.name.toLowerCase()];
            } else if (value !== null) {
                const key = rule.name.toLowerCase();
                if (action === 'append') {
                    const existing = outHeaders[key];
                    const existingStr = Array.isArray(existing)
                        ? existing.join(', ')
                        : existing != null
                          ? String(existing)
                          : undefined;
                    outHeaders[key] = existingStr ? `${existingStr}; ${value}` : value;
                } else {
                    outHeaders[key] = value;
                }
            }
        } else if (rule.in === 'body' && action === 'set' && value !== null) {
            const ct = (contentType ?? '').toLowerCase().split(';')[0].trim();
            if (ct === 'application/x-www-form-urlencoded') {
                const params = new URLSearchParams(outBody ? outBody.toString() : '');
                params.set(rule.name, value);
                outBody = Buffer.from(params.toString());
            } else if (ct === 'application/json') {
                let json: Record<string, unknown> = {};
                try {
                    json = JSON.parse(outBody ? outBody.toString() : '{}') as Record<
                        string,
                        unknown
                    >;
                } catch {
                    // keep empty object
                }
                json[rule.name] = value;
                outBody = Buffer.from(JSON.stringify(json));
            }
        } else if (rule.in === 'query' && action === 'set' && value !== null) {
            const parsed = new URL(outUrl);
            parsed.searchParams.set(rule.name, value);
            outUrl = parsed.toString();
        }
    }

    return { headers: outHeaders, body: outBody, url: outUrl };
}
