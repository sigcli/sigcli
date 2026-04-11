import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { expandHome } from '../../../src/utils/path.js';

describe('expandHome', () => {
  const home = os.homedir();

  it('expands ~/relative to the home directory', () => {
    expect(expandHome('~/Documents')).toBe(path.join(home, 'Documents'));
  });

  it('expands ~/ with nested path segments', () => {
    expect(expandHome('~/.signet/config.yaml')).toBe(
      path.join(home, '.signet/config.yaml'),
    );
  });

  it('expands bare ~ to the home directory', () => {
    expect(expandHome('~')).toBe(path.join(home, ''));
  });

  it('does not expand ~ in the middle of a path', () => {
    expect(expandHome('/some/~/path')).toBe('/some/~/path');
  });

  it('does not expand ~user style paths', () => {
    expect(expandHome('~user/dir')).toBe('~user/dir');
  });

  it('returns absolute paths unchanged', () => {
    expect(expandHome('/usr/local/bin')).toBe('/usr/local/bin');
    expect(expandHome('/tmp')).toBe('/tmp');
  });

  it('returns relative paths unchanged', () => {
    expect(expandHome('relative/path')).toBe('relative/path');
    expect(expandHome('./local')).toBe('./local');
    expect(expandHome('../parent')).toBe('../parent');
  });

  it('returns empty string unchanged', () => {
    expect(expandHome('')).toBe('');
  });

  it('handles ~/. (dot after tilde slash)', () => {
    expect(expandHome('~/.ssh')).toBe(path.join(home, '.ssh'));
  });
});
