import type { ExtractedCredentials } from '../core/interfaces/source-strategy.js';

/**
 * Check completion criteria.
 *
 * Format:
 *   "name.field" — credentials[name] contains field
 *     For cookies: checks "field=" appears in the cookie string
 *     For other: checks the value is non-empty
 *   "name" (no dot) — credentials[name] is non-empty
 *
 * Returns list of unmet requirements (empty = all satisfied).
 */
export function checkRequired(
    required: string[],
    credentials: ExtractedCredentials,
): string[] {
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
            } else if (!value.includes(`${field}=`)) {
                unmet.push(req);
            }
        }
    }

    return unmet;
}
