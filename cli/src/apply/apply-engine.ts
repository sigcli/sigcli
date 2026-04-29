import type { ApplyRule } from '../core/types/extract.js';
import type { ExtractedCredentials } from '../core/interfaces/source-strategy.js';

export interface ApplyResult {
    headers: Record<string, string>;
    query?: Record<string, string>;
    body?: Record<string, string>;
}

/**
 * Transforms extracted credentials into HTTP request parts via template interpolation.
 * Unified for: sig get, sig request, sig run, proxy.
 */
export class ApplyEngine {
    static applyRules(rules: ApplyRule[], credentials: ExtractedCredentials): ApplyResult {
        const result: ApplyResult = { headers: {} };

        for (const rule of rules) {
            const value = ApplyEngine.interpolate(rule.value, credentials);
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

    static interpolate(template: string, values: ExtractedCredentials): string {
        return template.replace(/\$\{([^}]+)\}/g, (_, key) => values[key] ?? '');
    }
}
