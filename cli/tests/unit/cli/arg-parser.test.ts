import { describe, it, expect } from 'vitest';
import { parseArgs } from '../../../src/cli/main.js';

describe('parseArgs', () => {
  it('parses a simple command with one positional', () => {
    const result = parseArgs(['get', 'my-jira']);
    expect(result.command).toBe('get');
    expect(result.positionals).toEqual(['my-jira']);
    expect(result.flags).toEqual({});
  });

  it('parses a command with a flag that has a value', () => {
    const result = parseArgs(['get', 'my-jira', '--format', 'json']);
    expect(result.command).toBe('get');
    expect(result.positionals).toEqual(['my-jira']);
    expect(result.flags).toEqual({ format: 'json' });
  });

  it('parses boolean flags without a value', () => {
    const result = parseArgs(['sync', 'push', '--force']);
    expect(result.command).toBe('sync');
    expect(result.positionals).toEqual(['push']);
    expect(result.flags).toEqual({ force: true });
  });

  it('parses multiple positionals with mixed flags', () => {
    const result = parseArgs(['sync', 'push', 'work-server', '--provider', 'jira']);
    expect(result.command).toBe('sync');
    expect(result.positionals).toEqual(['push', 'work-server']);
    expect(result.flags).toEqual({ provider: 'jira' });
  });

  it('parses login with URL and token flag', () => {
    const result = parseArgs(['login', 'https://example.com', '--token', 'abc123']);
    expect(result.command).toBe('login');
    expect(result.positionals).toEqual(['https://example.com']);
    expect(result.flags).toEqual({ token: 'abc123' });
  });

  it('defaults to help when no args provided', () => {
    const result = parseArgs([]);
    expect(result.command).toBe('help');
    expect(result.positionals).toEqual([]);
    expect(result.flags).toEqual({});
  });

  it('parses remote command with multiple positionals and multiple flags', () => {
    const result = parseArgs([
      'remote', 'add', 'dev', 'host.com',
      '--user', 'jdoe',
      '--ssh-key', '~/.ssh/id_ed25519',
    ]);
    expect(result.command).toBe('remote');
    expect(result.positionals).toEqual(['add', 'dev', 'host.com']);
    expect(result.flags).toEqual({
      user: 'jdoe',
      'ssh-key': '~/.ssh/id_ed25519',
    });
  });

  it('treats consecutive flags as booleans', () => {
    const result = parseArgs(['sync', 'push', '--force', '--verbose']);
    expect(result.command).toBe('sync');
    expect(result.positionals).toEqual(['push']);
    expect(result.flags).toEqual({ force: true, verbose: true });
  });

  it('handles flag at end of args as boolean', () => {
    const result = parseArgs(['status', '--help']);
    expect(result.command).toBe('status');
    expect(result.positionals).toEqual([]);
    expect(result.flags).toEqual({ help: true });
  });

  it('handles only a command with no positionals or flags', () => {
    const result = parseArgs(['providers']);
    expect(result.command).toBe('providers');
    expect(result.positionals).toEqual([]);
    expect(result.flags).toEqual({});
  });
});
