import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../../../src/cli/main.js';

describe('CLI help text grouping (#9)', () => {
  let stdoutChunks: string[];
  let stderrChunks: string[];
  let originalExitCode: number | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    stdoutChunks = [];
    stderrChunks = [];
    originalExitCode = process.exitCode;
    process.exitCode = undefined;

    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stdoutChunks.push(String(chunk));
      return true;
    });

    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stderrChunks.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
  });

  it('help output contains "Authentication:" section header', async () => {
    await run(['help']);
    const output = stdoutChunks.join('');
    expect(output).toContain('Authentication:');
  });

  it('help output contains "Credentials:" section header', async () => {
    await run(['help']);
    const output = stdoutChunks.join('');
    expect(output).toContain('Credentials:');
  });

  it('help output contains "Remote & sync:" section header', async () => {
    await run(['help']);
    const output = stdoutChunks.join('');
    expect(output).toContain('Remote & sync:');
  });

  it('help output contains "Setup:" section header', async () => {
    await run(['help']);
    const output = stdoutChunks.join('');
    expect(output).toContain('Setup:');
  });

  it('help output contains "Global options:" section header', async () => {
    await run(['help']);
    const output = stdoutChunks.join('');
    expect(output).toContain('Global options:');
  });

  it('help output lists all commands', async () => {
    await run(['help']);
    const output = stdoutChunks.join('');
    expect(output).toContain('login');
    expect(output).toContain('logout');
    expect(output).toContain('get');
    expect(output).toContain('request');
    expect(output).toContain('status');
    expect(output).toContain('remove');
    expect(output).toContain('providers');
    expect(output).toContain('rename');
    expect(output).toContain('watch');
  });

  it('help output lists command flags', async () => {
    await run(['help']);
    const output = stdoutChunks.join('');
    expect(output).toContain('--as <id>');
    expect(output).toContain('--token <value>');
    expect(output).toContain('--cookie');
    expect(output).toContain('--method <METHOD>');
    expect(output).toContain('--body <json>');
    expect(output).toContain('--keep-config');
    expect(output).toContain('--provider <id>');
    expect(output).toContain('--auto-sync <remote>');
    expect(output).toContain('--once');
  });

  it('help output lists remote subcommands and flags', async () => {
    await run(['help']);
    const output = stdoutChunks.join('');
    expect(output).toContain('remote add <name> <host>');
    expect(output).toContain('remote remove <name>');
    expect(output).toContain('remote list');
    expect(output).toContain('sync push|pull');
    expect(output).toContain('--user <user>');
    expect(output).toContain('--ssh-key <key>');
  });

  it('help output lists setup commands and flags', async () => {
    await run(['help']);
    const output = stdoutChunks.join('');
    expect(output).toContain('init');
    expect(output).toContain('doctor');
    expect(output).toContain('--remote');
    expect(output).toContain('--channel <name>');
  });

  it('help output mentions --verbose in global options', async () => {
    await run(['help']);
    const output = stdoutChunks.join('');
    expect(output).toContain('--verbose');
  });

  it('--help flag on any command shows help text', async () => {
    await run(['status', '--help']);
    const output = stdoutChunks.join('');
    expect(output).toContain('Authentication:');
    expect(output).toContain('Setup:');
  });

  it('no arguments shows help text', async () => {
    await run([]);
    const output = stdoutChunks.join('');
    expect(output).toContain('signet');
    expect(output).toContain('Authentication:');
  });

  it('sections appear in correct order: Auth > Credentials > Provider > Remote > Watch > Setup > Global', async () => {
    await run(['help']);
    const output = stdoutChunks.join('');
    const authIdx = output.indexOf('Authentication:');
    const credIdx = output.indexOf('Credentials:');
    const providerIdx = output.indexOf('Provider management:');
    const remoteIdx = output.indexOf('Remote & sync:');
    const watchIdx = output.indexOf('Watch:');
    const setupIdx = output.indexOf('Setup:');
    const globalIdx = output.indexOf('Global options:');

    expect(authIdx).toBeGreaterThan(-1);
    expect(credIdx).toBeGreaterThan(authIdx);
    expect(providerIdx).toBeGreaterThan(credIdx);
    expect(remoteIdx).toBeGreaterThan(providerIdx);
    expect(watchIdx).toBeGreaterThan(remoteIdx);
    expect(setupIdx).toBeGreaterThan(watchIdx);
    expect(globalIdx).toBeGreaterThan(setupIdx);
  });
});
