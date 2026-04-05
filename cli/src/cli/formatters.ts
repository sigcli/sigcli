export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function formatTable(rows: Record<string, string>[]): string {
  if (rows.length === 0) return '';

  const columns = Object.keys(rows[0]);
  const widths = new Map<string, number>();

  for (const col of columns) {
    let max = col.length;
    for (const row of rows) {
      const len = (row[col] ?? '').length;
      if (len > max) max = len;
    }
    widths.set(col, max);
  }

  const header = columns.map(c => c.toUpperCase().padEnd(widths.get(c)!)).join('  ');
  const separator = columns.map(c => '-'.repeat(widths.get(c)!)).join('  ');
  const body = rows.map(row =>
    columns.map(c => (row[c] ?? '').padEnd(widths.get(c)!)).join('  ')
  );

  return [header, separator, ...body].join('\n');
}

export function formatCredentialHeaders(headers: Record<string, string>): string {
  return Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n');
}
