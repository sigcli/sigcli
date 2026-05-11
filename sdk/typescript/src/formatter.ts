import type { ApplyResult, ApplyRule } from './types.js';

/**
 * Apply template rules to credential values.
 * Template syntax: ${key} is replaced with values[key] (empty string if missing).
 */
export function applyRules(values: Record<string, string>, rules: ApplyRule[]): ApplyResult {
    const headers: Record<string, string> = {};
    let query: Record<string, string> | undefined;
    let body: Record<string, string> | undefined;

    for (const rule of rules) {
        const action = rule.action ?? 'set';
        const interpolated = interpolate(rule.value, values);

        if (rule.in === 'header') {
            if (action === 'remove') {
                delete headers[rule.name];
            } else if (action === 'append') {
                const existing = headers[rule.name];
                headers[rule.name] = existing ? `${existing}; ${interpolated}` : interpolated;
            } else {
                headers[rule.name] = interpolated;
            }
        } else if (rule.in === 'query') {
            if (!query) query = {};
            if (action === 'remove') {
                delete query[rule.name];
            } else if (action === 'append') {
                const existing = query[rule.name];
                query[rule.name] = existing ? `${existing}; ${interpolated}` : interpolated;
            } else {
                query[rule.name] = interpolated;
            }
        } else if (rule.in === 'body') {
            if (!body) body = {};
            if (action === 'remove') {
                delete body[rule.name];
            } else if (action === 'append') {
                const existing = body[rule.name];
                body[rule.name] = existing ? `${existing}; ${interpolated}` : interpolated;
            } else {
                body[rule.name] = interpolated;
            }
        }
    }

    return { headers, ...(query ? { query } : {}), ...(body ? { body } : {}) };
}

function interpolate(template: string, values: Record<string, string>): string {
    return template.replace(/\$\{([^}]+)\}/g, (_, key) => values[key] ?? '');
}
