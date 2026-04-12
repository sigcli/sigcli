import dlv from 'dlv';

import type { IBrowserPage } from '../../core/interfaces/browser-adapter.js';
import type { LocalStorageConfig } from '../../core/types.js';

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
                const value = dlv(parsed as Record<string, unknown>, config.jsonPath);
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
