import type { Credential, ProxyInjectRule } from '../core/types.js';
import type * as http from 'node:http';

export function resolveFrom(credential: Credential, fromPath: string): string | null {
    if (!fromPath.startsWith('credential.')) return null;
    const rest = fromPath.slice('credential.'.length);

    if (rest === 'cookies') {
        if (credential.type === 'cookie') {
            return credential.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
        }
        return null;
    }

    if (rest === 'accessToken') {
        if (credential.type === 'bearer') return credential.accessToken;
        return null;
    }

    if (rest === 'key') {
        if (credential.type === 'api-key') return credential.key;
        return null;
    }

    if (rest === 'username') {
        if (credential.type === 'basic') return credential.username;
        return null;
    }

    if (rest === 'password') {
        if (credential.type === 'basic') return credential.password;
        return null;
    }

    if (rest.startsWith('xHeaders.')) {
        const headerKey = rest.slice('xHeaders.'.length);
        if ((credential.type === 'cookie' || credential.type === 'bearer') && credential.xHeaders) {
            return credential.xHeaders[headerKey] ?? null;
        }
        return null;
    }

    if (rest.startsWith('localStorage.')) {
        const lsKey = rest.slice('localStorage.'.length);
        if (
            (credential.type === 'cookie' || credential.type === 'bearer') &&
            credential.localStorage
        ) {
            return credential.localStorage[lsKey] ?? null;
        }
        return null;
    }

    return null;
}

export function applyInjectRules(
    rules: ProxyInjectRule[],
    credential: Credential,
    headers: http.OutgoingHttpHeaders,
    bodyBuffer: Buffer | undefined,
    contentType: string | undefined,
    url: string,
): { headers: http.OutgoingHttpHeaders; body: Buffer | undefined; url: string } {
    const outHeaders = { ...headers };
    let outBody = bodyBuffer;
    let outUrl = url;

    for (const rule of rules) {
        const action = rule.action ?? 'set';
        const value = rule.from ? resolveFrom(credential, rule.from) : null;

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
