import dlv from 'dlv';

import type { ExtractedCredentials } from '../../types/index.js';

/**
 * Check completion criteria.
 *
 * Format:
 *   "name.field" — use dlv to traverse into credentials[name]
 *     For cookies: checks "field=" appears in the cookie string
 *     For other: traverses dot-path into the value
 *   "name" (no dot) — credentials[name] is non-empty
 *
 * Returns list of unmet requirements (empty = all satisfied).
 */
export function checkRequired(required: string[], credentials: ExtractedCredentials): string[] {
    const unmet: string[] = [];

    for (const req of required) {
        const dotIndex = req.indexOf('.');
        if (dotIndex === -1) {
            if (!credentials[req]) {
                unmet.push(req);
            }
        } else {
            const name = req.slice(0, dotIndex);
            const field = req.slice(dotIndex + 1);
            const value = credentials[name];
            if (!value) {
                unmet.push(req);
                continue;
            }
            // For cookie strings, check "field=" presence
            if (value.includes('=')) {
                if (!value.includes(`${field}=`)) {
                    unmet.push(req);
                }
            } else {
                // For JSON-like values, use dlv for dot-path traversal
                try {
                    const parsed = JSON.parse(value);
                    const resolved = dlv(parsed, field);
                    if (resolved == null || resolved === '') {
                        unmet.push(req);
                    }
                } catch {
                    // Not JSON — treat as plain string, check non-empty
                    if (!value) {
                        unmet.push(req);
                    }
                }
            }
        }
    }

    return unmet;
}
