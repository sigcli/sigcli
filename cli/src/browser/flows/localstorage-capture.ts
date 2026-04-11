import type { IBrowserPage } from '../../core/interfaces/browser-adapter.js';
import type { LocalStorageConfig } from '../../core/types.js';

/**
 * Resolve a dot-delimited JSON path on an object.
 * Numeric segments index into arrays (e.g. "teams.0.token").
 * Returns undefined if any segment is missing.
 */
function resolveJsonPath(obj: unknown, path: string): unknown {
    let current = obj;
    for (const segment of path.split('.')) {
        if (current == null || typeof current !== 'object') return undefined;
        if (Array.isArray(current)) {
            const index = Number(segment);
            if (!Number.isInteger(index) || index < 0) return undefined;
            current = current[index] as unknown;
        } else {
            current = (current as Record<string, unknown>)[segment];
        }
    }
    return current;
}

/**
 * Extract values from the browser's localStorage.
 *
 * For each config entry:
 * 1. Read localStorage.getItem(key) via page.evaluate
 * 2. If jsonPath is set, parse the value as JSON and walk the path
 * 3. Store the result under config.name
 *
 * Silently skips entries where the key is missing or the path doesn't resolve.
 */
export async function extractLocalStorage(
    page: IBrowserPage,
    configs: LocalStorageConfig[],
): Promise<Record<string, string>> {
    const result: Record<string, string> = {};

    // Read all localStorage keys in a single evaluate call for efficiency
    const keys = configs.map((c) => c.key);
    const rawValues = await page.evaluateWithArg(
        (keysArg: string[]) => keysArg.map((k) => localStorage.getItem(k)),
        keys,
    );

    for (let i = 0; i < configs.length; i++) {
        const config = configs[i];
        const raw = rawValues[i];
        if (raw == null) continue;

        if (config.jsonPath) {
            try {
                const parsed: unknown = JSON.parse(raw);
                const value = resolveJsonPath(parsed, config.jsonPath);
                if (typeof value === 'string') {
                    result[config.name] = value;
                }
            } catch {
                // Invalid JSON — skip
            }
        } else {
            result[config.name] = raw;
        }
    }

    return result;
}
