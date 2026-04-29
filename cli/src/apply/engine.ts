import type { ApplyRule } from '../core/types/extract.js';
import type { ExtractedCredentials } from '../core/interfaces/source-strategy.js';

export interface ApplyResult {
    headers: Record<string, string>;
    query?: Record<string, string>;
    body?: Record<string, string>;
}

/**
 * Apply engine: transforms extracted credentials into HTTP request parts
 * via template interpolation rules.
 *
 * Unified engine for: sig get, sig request, sig run, proxy.
 */
export class ApplyEngine {
    /**
     * Apply extracted values to HTTP request via template interpolation.
     */
    applyRules(rules: ApplyRule[], credentials: ExtractedCredentials): ApplyResult {
        const result: ApplyResult = { headers: {} };

        for (const rule of rules) {
            const value = this.interpolate(rule.value, credentials);
            switch (rule.in) {
                case 'header':
                    result.headers[rule.name] = value;
                    break;
                case 'query':
                    if (!result.query) result.query = {};
                    result.query[rule.name] = value;
                    break;
                case 'body':
                    if (!result.body) result.body = {};
                    result.body[rule.name] = value;
                    break;
            }
        }

        return result;
    }

    /**
     * Interpolate ${name} references in a template string.
     */
    interpolate(template: string, values: ExtractedCredentials): string {
        return template.replace(/\$\{([^}]+)\}/g, (_, key) => values[key] ?? '');
    }
}

// Singleton instance for standalone function exports (backward compat)
const defaultEngine = new ApplyEngine();

/**
 * Apply extracted values to HTTP request via template interpolation.
 * Standalone function (backward compatible) — delegates to ApplyEngine.
 */
export function applyRules(rules: ApplyRule[], credentials: ExtractedCredentials): ApplyResult {
    return defaultEngine.applyRules(rules, credentials);
}

/**
 * Interpolate ${name} references in a template string.
 * Standalone function (backward compatible) — delegates to ApplyEngine.
 */
export function interpolate(template: string, values: ExtractedCredentials): string {
    return defaultEngine.interpolate(template, values);
}
