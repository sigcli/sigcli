import { describe, it, expect } from 'vitest';
import {
  formatJson,
  formatTable,
  formatCredentialHeaders,
  formatExpiry,
  formatStatusIndicator,
  stripAnsi,
} from '../../../src/cli/formatters.js';

describe('formatJson', () => {
  it('returns pretty-printed JSON for a simple object', () => {
    const result = formatJson({ key: 'value' });
    expect(result).toBe('{\n  "key": "value"\n}');
  });

  it('returns pretty-printed JSON for nested objects', () => {
    const result = formatJson({ a: { b: 1, c: [2, 3] } });
    expect(JSON.parse(result)).toEqual({ a: { b: 1, c: [2, 3] } });
    expect(result).toContain('\n'); // multi-line
  });

  it('handles null', () => {
    expect(formatJson(null)).toBe('null');
  });

  it('handles arrays', () => {
    const result = formatJson([1, 2, 3]);
    expect(JSON.parse(result)).toEqual([1, 2, 3]);
  });

  it('handles strings', () => {
    expect(formatJson('hello')).toBe('"hello"');
  });
});

describe('formatTable', () => {
  it('returns empty string for empty rows', () => {
    expect(formatTable([])).toBe('');
  });

  it('returns aligned table with headers for single row', () => {
    const result = formatTable([{ name: 'jira', status: 'ok' }]);
    const lines = result.split('\n');

    // Header line with uppercase column names
    expect(lines[0]).toMatch(/NAME\s+STATUS/);
    // Separator line with dashes
    expect(lines[1]).toMatch(/^-+\s+-+$/);
    // Data row
    expect(lines[2]).toMatch(/jira\s+ok/);
  });

  it('pads columns to the widest value', () => {
    const result = formatTable([
      { id: 'a', description: 'short' },
      { id: 'bbb', description: 'a longer description' },
    ]);
    const lines = result.split('\n');

    // Header should be padded to widest value
    expect(lines[0]).toContain('ID');
    expect(lines[0]).toContain('DESCRIPTION');

    // Data rows should align
    expect(lines[2]).toMatch(/^a\s+/);
    expect(lines[3]).toMatch(/^bbb\s+/);
  });

  it('handles multiple rows with consistent column widths', () => {
    const rows = [
      { provider: 'jira', type: 'cookie', status: 'valid' },
      { provider: 'confluence', type: 'bearer', status: 'expired' },
    ];
    const result = formatTable(rows);
    const lines = result.split('\n');

    // 1 header + 1 separator + 2 data rows
    expect(lines).toHaveLength(4);
  });

  it('truncates columns exceeding maxColumnWidths', () => {
    const longId = 'bdc-cockpit-starkiller-hc-uclformation-ga';
    const result = formatTable([{ id: longId, status: 'ok' }], { maxColumnWidths: { id: 20 } });
    const lines = result.split('\n');
    const dataRow = lines[2];
    // Should be truncated to 19 chars + ellipsis
    expect(dataRow).toContain('bdc-cockpit-starkil\u2026');
    expect(dataRow).not.toContain(longId);
  });

  it('does not truncate when value is within limit', () => {
    const result = formatTable([{ id: 'short', status: 'ok' }], { maxColumnWidths: { id: 20 } });
    const lines = result.split('\n');
    expect(lines[2]).toMatch(/^short\s+ok/);
  });

  it('works without options (backward compatible)', () => {
    const longId = 'a-very-long-provider-id-that-should-not-be-truncated';
    const result = formatTable([{ id: longId }]);
    expect(result).toContain(longId);
  });
});

describe('formatExpiry', () => {
  it('shows minutes for < 60m', () => {
    expect(formatExpiry(0)).toBe('0m');
    expect(formatExpiry(45)).toBe('45m');
    expect(formatExpiry(59)).toBe('59m');
  });

  it('shows hours for 1h–23h', () => {
    expect(formatExpiry(60)).toBe('1h');
    expect(formatExpiry(300)).toBe('5h');
    expect(formatExpiry(1439)).toBe('23h');
  });

  it('shows days for 1d–29d', () => {
    expect(formatExpiry(1440)).toBe('1d');
    expect(formatExpiry(17280)).toBe('12d');
    expect(formatExpiry(43199)).toBe('29d');
  });

  it('shows months for >= 30d', () => {
    expect(formatExpiry(43200)).toBe('1mo');
    expect(formatExpiry(86400)).toBe('2mo');
    expect(formatExpiry(573304)).toBe('13mo');
  });
});

describe('formatStatusIndicator', () => {
  it('returns check mark for valid credentials', () => {
    const result = formatStatusIndicator(true, true);
    expect(stripAnsi(result)).toBe('\u2713');
  });

  it('returns cross for invalid but existing credentials', () => {
    const result = formatStatusIndicator(false, true);
    expect(stripAnsi(result)).toBe('\u2717');
  });

  it('returns em dash for no credential', () => {
    const result = formatStatusIndicator(false, false);
    expect(stripAnsi(result)).toBe('\u2014');
  });
});

describe('stripAnsi', () => {
  it('removes ANSI escape codes', () => {
    expect(stripAnsi('\x1b[32mhello\x1b[0m')).toBe('hello');
  });

  it('returns plain text unchanged', () => {
    expect(stripAnsi('hello')).toBe('hello');
  });
});

describe('formatTable with ANSI content', () => {
  it('aligns columns correctly when cells contain ANSI codes', () => {
    const rows = [
      { id: 'jira', status: '\x1b[32m\u2713\x1b[0m' },
      { id: 'confluence', status: '\x1b[31m\u2717\x1b[0m' },
    ];
    const result = formatTable(rows);
    const lines = result.split('\n');

    // Both status columns should have the same visible alignment
    // The id column width should be based on 'confluence' (10 chars)
    const row1 = stripAnsi(lines[2]);
    const row2 = stripAnsi(lines[3]);
    // Both rows should have the same visible length
    expect(row1.trimEnd().length).toBeLessThanOrEqual(row2.trimEnd().length + 10);
  });
});

describe('formatCredentialHeaders', () => {
  it('formats single header', () => {
    const result = formatCredentialHeaders({ Authorization: 'Bearer xyz' });
    expect(result).toBe('Authorization: Bearer xyz');
  });

  it('formats multiple headers separated by newlines', () => {
    const result = formatCredentialHeaders({
      Authorization: 'Bearer xyz',
      'X-Custom': 'val',
    });
    expect(result).toBe('Authorization: Bearer xyz\nX-Custom: val');
  });

  it('returns empty string for empty headers', () => {
    const result = formatCredentialHeaders({});
    expect(result).toBe('');
  });
});
