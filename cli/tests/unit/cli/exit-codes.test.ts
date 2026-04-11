import { describe, it, expect } from 'vitest';
import { ExitCode } from '../../../src/cli/exit-codes.js';

describe('ExitCode', () => {
  it('SUCCESS is 0', () => {
    expect(ExitCode.SUCCESS).toBe(0);
  });

  it('GENERAL_ERROR is 1', () => {
    expect(ExitCode.GENERAL_ERROR).toBe(1);
  });

  it('PROVIDER_NOT_FOUND is 2', () => {
    expect(ExitCode.PROVIDER_NOT_FOUND).toBe(2);
  });

  it('CREDENTIAL_NOT_FOUND is 3', () => {
    expect(ExitCode.CREDENTIAL_NOT_FOUND).toBe(3);
  });

  it('REMOTE_NOT_FOUND is 4', () => {
    expect(ExitCode.REMOTE_NOT_FOUND).toBe(4);
  });

  it('has exactly 5 exit codes', () => {
    expect(Object.keys(ExitCode)).toHaveLength(5);
  });

  it('all values are unique non-negative integers', () => {
    const values = Object.values(ExitCode);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
    for (const v of values) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it('values are ordered from 0 upward', () => {
    const values = Object.values(ExitCode).sort((a, b) => a - b);
    expect(values[0]).toBe(0);
    expect(values[values.length - 1]).toBe(4);
  });
});
