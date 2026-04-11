export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
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
      const len = (row[col] ?? '').length;
      if (len > max) max = len;
    }
    const cap = options?.maxColumnWidths?.[col];
    if (cap && max > cap) max = cap;
    widths.set(col, max);
  }

  const truncate = (value: string, width: number): string =>
    value.length > width ? value.slice(0, width - 1) + '\u2026' : value;

  const header = columns.map(c => c.toUpperCase().padEnd(widths.get(c)!)).join('  ');
  const separator = columns.map(c => '-'.repeat(widths.get(c)!)).join('  ');
  const body = rows.map(row =>
    columns.map(c => truncate(row[c] ?? '', widths.get(c)!).padEnd(widths.get(c)!)).join('  ')
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
  return Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n');
}
