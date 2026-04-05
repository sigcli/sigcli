import { describe, it, expect } from 'vitest';
import { formatJson, formatTable, formatCredentialHeaders } from '../../../src/cli/formatters.js';

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
