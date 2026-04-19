import { formatTable } from '../cli/formatters.js';

export type FormatType = 'json' | 'yaml' | 'env' | 'table' | 'plain';

export function detectFormat(
    flagValue: string | undefined,
    defaultFormat: FormatType = 'table',
): FormatType {
    if (flagValue) return flagValue as FormatType;
    if (!process.stdout.isTTY) return 'json';
    return defaultFormat;
}

function toYaml(data: Record<string, unknown>[] | Record<string, unknown>): string {
    const serializeValue = (val: unknown, indent: string): string => {
        if (val === null || val === undefined) return 'null';
        if (typeof val === 'boolean' || typeof val === 'number') return String(val);
        if (typeof val === 'string') {
            if (val.includes('\n') || val.includes(':') || val.includes('#'))
                return `"${val.replace(/"/g, '\\"')}"`;
            return val;
        }
        if (Array.isArray(val)) {
            if (val.length === 0) return '[]';
            return (
                '\n' + val.map((v) => `${indent}- ${serializeValue(v, indent + '  ')}`).join('\n')
            );
        }
        if (typeof val === 'object') {
            const obj = val as Record<string, unknown>;
            const keys = Object.keys(obj);
            if (keys.length === 0) return '{}';
            return (
                '\n' +
                keys
                    .map((k) => `${indent}  ${k}: ${serializeValue(obj[k], indent + '  ')}`)
                    .join('\n')
            );
        }
        return String(val);
    };

    const serializeObject = (obj: Record<string, unknown>): string =>
        Object.entries(obj)
            .map(([k, v]) => `${k}: ${serializeValue(v, '')}`)
            .join('\n');

    if (Array.isArray(data)) {
        return data
            .map(
                (item) =>
                    `- ${Object.entries(item)
                        .map(([k, v]) => `${k}: ${serializeValue(v, '  ')}`)
                        .join('\n  ')}`,
            )
            .join('\n');
    }
    return serializeObject(data);
}

function toEnv(data: Record<string, unknown>[] | Record<string, unknown>): string {
    const toEnvKey = (key: string): string => key.toUpperCase().replace(/[^A-Z0-9]/g, '_');

    const serializeEnvValue = (val: unknown): string => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'string')
            return val.includes(' ') || val.includes('"') ? `"${val.replace(/"/g, '\\"')}"` : val;
        return String(val);
    };

    if (Array.isArray(data)) {
        return data
            .map((item, i) =>
                Object.entries(item)
                    .map(([k, v]) => `${toEnvKey(k)}_${i}=${serializeEnvValue(v)}`)
                    .join('\n'),
            )
            .join('\n');
    }
    return Object.entries(data)
        .map(([k, v]) => `${toEnvKey(k)}=${serializeEnvValue(v)}`)
        .join('\n');
}

function toPlain(data: Record<string, unknown>[] | Record<string, unknown>): string {
    const serializePlain = (val: unknown): string => {
        if (val === null || val === undefined) return '-';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    if (Array.isArray(data)) {
        return data
            .map((item) =>
                Object.entries(item)
                    .map(([k, v]) => `${k}: ${serializePlain(v)}`)
                    .join('\n'),
            )
            .join('\n---\n');
    }
    return Object.entries(data)
        .map(([k, v]) => `${k}: ${serializePlain(v)}`)
        .join('\n');
}

export function formatOutput(
    data: Record<string, unknown>[] | Record<string, unknown>,
    format: FormatType,
): string {
    switch (format) {
        case 'json':
            return JSON.stringify(data, null, 2);
        case 'yaml':
            return toYaml(data);
        case 'env':
            return toEnv(data);
        case 'table': {
            const stringify = (v: unknown): string =>
                v === null || v === undefined ? '-' : String(v);
            const toStringRecord = (obj: Record<string, unknown>): Record<string, string> =>
                Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, stringify(v)]));
            const rows = Array.isArray(data) ? data.map(toStringRecord) : [toStringRecord(data)];
            return formatTable(rows);
        }
        case 'plain':
            return toPlain(data);
    }
}
