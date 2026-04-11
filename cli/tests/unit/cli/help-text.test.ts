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

  it('help output contains "Provider commands:" section header', async () => {
    await run(['help']);
    const output = stdoutChunks.join('');
    expect(output).toContain('Provider commands:');
  });

  it('help output contains "Remote commands:" section header', async () => {
    await run(['help']);
    const output = stdoutChunks.join('');
    expect(output).toContain('Remote commands:');
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

  it('help output lists all provider commands', async () => {
    await run(['help']);
    const output = stdoutChunks.join('');
    expect(output).toContain('login');
    expect(output).toContain('logout');
    expect(output).toContain('get');
    expect(output).toContain('request');
    expect(output).toContain('status');
    expect(output).toContain('remove');
    expect(output).toContain('providers');
  });

  it('help output lists remote and sync commands', async () => {
    await run(['help']);
    const output = stdoutChunks.join('');
    expect(output).toContain('remote add|remove|list');
    expect(output).toContain('sync push|pull');
  });

  it('help output lists setup commands (init, doctor)', async () => {
    await run(['help']);
    const output = stdoutChunks.join('');
    expect(output).toContain('init');
    expect(output).toContain('doctor');
  });

  it('help output mentions --verbose in global options', async () => {
    await run(['help']);
    const output = stdoutChunks.join('');
    expect(output).toContain('--verbose');
  });

  it('--help flag on any command shows help text', async () => {
    await run(['status', '--help']);
    const output = stdoutChunks.join('');
    expect(output).toContain('Provider commands:');
    expect(output).toContain('Setup:');
  });

  it('no arguments shows help text', async () => {
    await run([]);
    const output = stdoutChunks.join('');
    expect(output).toContain('signet');
    expect(output).toContain('Provider commands:');
  });

  it('sections appear in correct order: Provider > Remote > Setup > Global', async () => {
    await run(['help']);
    const output = stdoutChunks.join('');
    const providerIdx = output.indexOf('Provider commands:');
    const remoteIdx = output.indexOf('Remote commands:');
    const setupIdx = output.indexOf('Setup:');
    const globalIdx = output.indexOf('Global options:');

    expect(providerIdx).toBeGreaterThan(-1);
    expect(remoteIdx).toBeGreaterThan(providerIdx);
    expect(setupIdx).toBeGreaterThan(remoteIdx);
    expect(globalIdx).toBeGreaterThan(setupIdx);
  });
});
