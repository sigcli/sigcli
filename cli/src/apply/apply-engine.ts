import type { ApplyRule, ExtractedCredentials } from '../types/index.js';

export interface ApplyResult {
    headers: Record<string, string>;
    query?: Record<string, string>;
    body?: Record<string, string>;
}

/**
 * Transforms extracted credentials into HTTP request parts via template interpolation.
 * Unified for: sig get, sig request, sig run, proxy.
 *
 * Supports action: 'set' (default), 'append' (with ';' separator), 'remove'.
 */
export class ApplyEngine {
    static applyRules(rules: ApplyRule[], credentials: ExtractedCredentials): ApplyResult {
        const result: ApplyResult = { headers: {} };

        for (const rule of rules) {
            const action = rule.action ?? 'set';

            if (rule.in === 'header') {
                if (action === 'remove') {
                    delete result.headers[rule.name];
                } else {
                    const value = ApplyEngine.interpolate(rule.value, credentials);
                    if (action === 'append') {
                        const existing = result.headers[rule.name];
                        result.headers[rule.name] = existing ? `${existing}; ${value}` : value;
                    } else {
                        result.headers[rule.name] = value;
                    }
                }
            } else if (rule.in === 'query') {
                if (action === 'remove') {
                    if (result.query) delete result.query[rule.name];
                } else {
                    if (!result.query) result.query = {};
                    const value = ApplyEngine.interpolate(rule.value, credentials);
                    if (action === 'append') {
                        const existing = result.query[rule.name];
                        result.query[rule.name] = existing ? `${existing}; ${value}` : value;
                    } else {
                        result.query[rule.name] = value;
                    }
                }
            } else if (rule.in === 'body') {
                if (action === 'remove') {
                    if (result.body) delete result.body[rule.name];
                } else {
                    if (!result.body) result.body = {};
                    const value = ApplyEngine.interpolate(rule.value, credentials);
                    if (action === 'append') {
                        const existing = result.body[rule.name];
                        result.body[rule.name] = existing ? `${existing}; ${value}` : value;
                    } else {
                        result.body[rule.name] = value;
                    }
                }
            }
        }

        return result;
    }

    static interpolate(template: string, values: ExtractedCredentials): string {
        return template.replace(/\$\{([^}]+)\}/g, (_, key) => values[key] ?? '');
    }
}
