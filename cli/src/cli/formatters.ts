export function formatJson(data: unknown): string {
    return JSON.stringify(data, null, 2);
}

// ANSI helpers — color only when stdout is a TTY
const isTTY = process.stdout.isTTY;
function green(s: string): string {
    return isTTY ? `\x1b[32m${s}\x1b[0m` : s;
}
function red(s: string): string {
    return isTTY ? `\x1b[31m${s}\x1b[0m` : s;
}
function dim(s: string): string {
    return isTTY ? `\x1b[2m${s}\x1b[0m` : s;
}

export function stripAnsi(s: string): string {
    return s.replace(/\x1b\[[0-9;]*m/g, '');
}

export function formatStatusIndicator(valid: boolean, hasCredential: boolean): string {
    if (valid) return green('\u2713');
    if (hasCredential) return red('\u2717');
    return dim('\u2014');
}

export interface FormatTableOptions {
    maxColumnWidths?: Record<string, number>;
}

export function formatTable(rows: Record<string, string>[], options?: FormatTableOptions): string {
    if (rows.length === 0) return '';

    const columns = Object.keys(rows[0]);
    const widths = new Map<string, number>();

    for (const col of columns) {
        let max = col.length;
        for (const row of rows) {
            const len = stripAnsi(row[col] ?? '').length;
            if (len > max) max = len;
        }
        const cap = options?.maxColumnWidths?.[col];
        if (cap && max > cap) max = cap;
        widths.set(col, max);
    }

    const truncate = (value: string, width: number): string =>
        stripAnsi(value).length > width ? value.slice(0, width - 1) + '\u2026' : value;

    const padEnd = (value: string, width: number): string => {
        const visible = stripAnsi(value).length;
        return value + ' '.repeat(Math.max(0, width - visible));
    };

    const header = columns.map((c) => c.toUpperCase().padEnd(widths.get(c)!)).join('  ');
    const separator = columns.map((c) => '-'.repeat(widths.get(c)!)).join('  ');
    const body = rows.map((row) =>
        columns
            .map((c) => padEnd(truncate(row[c] ?? '', widths.get(c)!), widths.get(c)!))
            .join('  '),
    );

    return [header, separator, ...body].join('\n');
}

export function formatExpiry(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
    if (minutes < 43200) return `${Math.floor(minutes / 1440)}d`;
    return `${Math.floor(minutes / 43200)}mo`;
}

export function formatCredentialHeaders(headers: Record<string, string>): string {
    return Object.entries(headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
}
