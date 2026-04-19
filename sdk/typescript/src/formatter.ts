import type { Credential } from './types.js';

/**
 * Convert a credential into HTTP headers.
 * Matches sigcli's strategy.applyToRequest() logic exactly.
 */
export function formatHeaders(credential: Credential): Record<string, string> {
    switch (credential.type) {
        case 'cookie': {
            const headers: Record<string, string> = { ...credential.xHeaders };
            headers['Cookie'] = credential.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
            return headers;
        }
        case 'bearer': {
            const headers: Record<string, string> = { ...credential.xHeaders };
            headers['Authorization'] = `Bearer ${credential.accessToken}`;
            return headers;
        }
        case 'api-key': {
            const value = credential.headerPrefix
                ? `${credential.headerPrefix} ${credential.key}`
                : credential.key;
            return { [credential.headerName]: value };
        }
        case 'basic': {
            const encoded = Buffer.from(`${credential.username}:${credential.password}`).toString(
                'base64',
            );
            return { Authorization: `Basic ${encoded}` };
        }
    }
}

/**
 * Extract localStorage values from a credential.
 * Only cookie and bearer credentials can have localStorage.
 */
export function extractLocalStorage(credential: Credential): Record<string, string> {
    if (credential.type === 'cookie' || credential.type === 'bearer') {
        return { ...(credential.localStorage ?? {}) };
    }
    return {};
}
