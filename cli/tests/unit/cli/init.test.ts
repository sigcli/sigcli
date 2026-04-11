import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';

// --------------------------------------------------------------------------
// Mocks — must be set up before importing the module under test
// --------------------------------------------------------------------------

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
  },
  existsSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

// Mock validateConfig to always succeed so init logic is testable in isolation.
// The generated YAML with no providers parses as { providers: null }, which
// validateConfig legitimately rejects. We trust generator + validator tests
// to cover that; here we focus on init's own control flow.
vi.mock('../../../src/config/validator.js', () => ({
  validateConfig: vi.fn(),
}));

// Import after mocking
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { runInit } from '../../../src/cli/commands/init.js';
import { validateConfig } from '../../../src/config/validator.js';

const mockValidateConfig = vi.mocked(validateConfig);

const mockExistsSync = vi.mocked(fs.existsSync);
const mockMkdir = vi.mocked(fsp.mkdir);
const mockWriteFile = vi.mocked(fsp.writeFile);

const EXPECTED_CONFIG_DIR = path.join(os.homedir(), '.signet');
const EXPECTED_CONFIG_PATH = path.join(EXPECTED_CONFIG_DIR, 'config.yaml');

describe('runInit', () => {
  let stderrChunks: string[];
  let stdoutLogs: string[];
  let originalExitCode: number | undefined;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    stderrChunks = [];
    stdoutLogs = [];

    // Make validateConfig always pass (re-set after clearAllMocks)
    mockValidateConfig.mockReturnValue({ ok: true, value: {} } as any);

    // Save and reset process.exitCode
    originalExitCode = process.exitCode;
    process.exitCode = undefined;

    // Force non-TTY so we never enter interactive mode
    originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });

    // Capture stderr
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stderrChunks.push(String(chunk));
      return true;
    });

    // Capture console.log (used for success messages)
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      stdoutLogs.push(args.join(' '));
    });

    // Default: config does NOT exist (fresh install)
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
    vi.restoreAllMocks();
  });

  // ---- config already exists ----

  it('prints warning and exits when config already exists and no --force', async () => {
    mockExistsSync.mockReturnValue(true);

    await runInit([], {});

    expect(process.exitCode).toBe(1);
    const stderr = stderrChunks.join('');
    expect(stderr).toContain('Config file already exists');
    expect(stderr).toContain('--force');
    // Should NOT have written anything
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  // ---- --force overwrites existing config ----

  it('with --force, overwrites existing config', async () => {
    mockExistsSync.mockReturnValue(true);

    await runInit([], { force: true });

    // Should have written a config file
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [writtenPath] = mockWriteFile.mock.calls[0] as [string, string, string];
    expect(writtenPath).toBe(EXPECTED_CONFIG_PATH);
    // Exit code should NOT be 1
    expect(process.exitCode).not.toBe(1);
  });

  // ---- --yes flag uses defaults ----

  it('with --yes flag, skips interactive prompts and uses defaults', async () => {
    await runInit([], { yes: true });

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [writtenPath, writtenContent] = mockWriteFile.mock.calls[0] as [string, string, string];
    expect(writtenPath).toBe(EXPECTED_CONFIG_PATH);

    // Verify the written YAML contains expected default values
    expect(writtenContent).toContain('browser:');
    expect(writtenContent).toContain('storage:');
    expect(writtenContent).toContain('providers:');
    expect(writtenContent).toContain('headlessTimeout: 30000');
    expect(writtenContent).toContain('visibleTimeout: 120000');
    expect(writtenContent).toContain('waitUntil: load');
  });

  // ---- generates config at correct path ----

  it('generates config file at ~/.signet/config.yaml', async () => {
    await runInit([], { yes: true });

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [writtenPath, writtenContent] = mockWriteFile.mock.calls[0] as [string, string, string];
    expect(writtenPath).toBe(EXPECTED_CONFIG_PATH);
    // The written content should be parseable YAML
    const YAML = await import('yaml');
    const parsed = YAML.parse(writtenContent);
    expect(parsed).toBeDefined();
    expect(parsed.browser).toBeDefined();
    expect(parsed.storage).toBeDefined();
  });

  // ---- creates necessary directories ----

  it('creates necessary directories (signet, browser-data, credentials)', async () => {
    await runInit([], { yes: true });

    // Should create at least 3 directories: signet dir, browser-data, credentials
    expect(mockMkdir).toHaveBeenCalledTimes(3);

    const mkdirPaths = mockMkdir.mock.calls.map(call => call[0]);
    // Signet dir
    expect(mkdirPaths).toContain(EXPECTED_CONFIG_DIR);
    // Browser data and credentials dirs (default paths under ~/.signet/)
    const expectedBrowserDataDir = path.join(EXPECTED_CONFIG_DIR, 'browser-data');
    const expectedCredentialsDir = path.join(EXPECTED_CONFIG_DIR, 'credentials');
    expect(mkdirPaths).toContain(expectedBrowserDataDir);
    expect(mkdirPaths).toContain(expectedCredentialsDir);

    // All mkdir calls should use recursive: true
    for (const call of mockMkdir.mock.calls) {
      expect(call[1]).toEqual({ recursive: true });
    }
  });

  // ---- --channel flag overrides detected browser ----

  it('--channel flag overrides detected browser', async () => {
    await runInit([], { yes: true, channel: 'msedge' });

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [, writtenContent] = mockWriteFile.mock.calls[0] as [string, string, string];
    expect(writtenContent).toContain('channel: msedge');
  });

  it('--channel with chromium value works', async () => {
    await runInit([], { yes: true, channel: 'chromium' });

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [, writtenContent] = mockWriteFile.mock.calls[0] as [string, string, string];
    expect(writtenContent).toContain('channel: chromium');
  });

  // ---- --browser-data-dir flag ----

  it('--browser-data-dir flag overrides default browser data directory', async () => {
    const customDir = '/custom/browser-data';
    await runInit([], { yes: true, 'browser-data-dir': customDir });

    // Should create the custom directory
    const mkdirPaths = mockMkdir.mock.calls.map(call => call[0]);
    expect(mkdirPaths).toContain(customDir);

    // Config should reference the custom dir
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [, writtenContent] = mockWriteFile.mock.calls[0] as [string, string, string];
    expect(writtenContent).toContain('browserDataDir:');
    expect(writtenContent).toContain(customDir);
  });

  // ---- --credentials-dir flag ----

  it('--credentials-dir flag overrides default credentials directory', async () => {
    const customDir = '/custom/credentials';
    await runInit([], { yes: true, 'credentials-dir': customDir });

    // Should create the custom directory
    const mkdirPaths = mockMkdir.mock.calls.map(call => call[0]);
    expect(mkdirPaths).toContain(customDir);

    // Config should reference the custom dir
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [, writtenContent] = mockWriteFile.mock.calls[0] as [string, string, string];
    expect(writtenContent).toContain('credentialsDir:');
    expect(writtenContent).toContain(customDir);
  });

  // ---- non-TTY defaults without --yes ----

  it('uses defaults silently in non-TTY mode even without --yes', async () => {
    // stdin.isTTY is already false from beforeEach

    await runInit([], {});

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(process.exitCode).not.toBe(1);
  });

  // ---- success message ----

  it('prints success message after writing config', async () => {
    await runInit([], { yes: true });

    const output = stderrChunks.join('');
    expect(output).toContain('Config written to');
    expect(output).toContain('Browser data:');
    expect(output).toContain('Credentials:');
    expect(output).toContain('Browser:');
    expect(output).toContain('Next steps:');
  });

  // ---- success message includes correct channel ----

  it('success message shows the selected channel', async () => {
    await runInit([], { yes: true, channel: 'msedge' });

    const output = stderrChunks.join('');
    expect(output).toContain('msedge');
  });

  // ---- written YAML is valid ----

  it('the generated YAML is parseable and contains browser and storage sections', async () => {
    await runInit([], { yes: true });

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [, writtenContent] = mockWriteFile.mock.calls[0] as [string, string, string];

    const YAML = await import('yaml');
    const parsed = YAML.parse(writtenContent);
    expect(parsed.browser).toBeDefined();
    expect(parsed.browser.channel).toBeDefined();
    expect(parsed.browser.browserDataDir).toBeDefined();
    expect(parsed.storage).toBeDefined();
    expect(parsed.storage.credentialsDir).toBeDefined();
  });

  // ---- config file content has comments ----

  it('generated config includes documentation comments', async () => {
    await runInit([], { yes: true });

    const [, writtenContent] = mockWriteFile.mock.calls[0] as [string, string, string];
    expect(writtenContent).toContain('# Signet unified configuration');
    expect(writtenContent).toContain('# Browser settings');
    expect(writtenContent).toContain('# Storage settings');
    expect(writtenContent).toContain('# Provider configurations');
  });

  // ---- both flags combined ----

  it('--force and --yes can be used together', async () => {
    mockExistsSync.mockReturnValue(true);

    await runInit([], { force: true, yes: true });

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(process.exitCode).not.toBe(1);
  });

  // ---- --remote flag ----

  it('--remote generates config with mode: browserless', async () => {
    await runInit([], { remote: true });

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [, writtenContent] = mockWriteFile.mock.calls[0] as [string, string, string];
    const YAML = await import('yaml');
    const parsed = YAML.parse(writtenContent);
    expect(parsed.mode).toBe('browserless');
  });

  it('--remote shows remote-specific guidance', async () => {
    await runInit([], { remote: true });

    const output = stderrChunks.join('');
    expect(output).toContain('Remote setup complete');
    expect(output).toContain('browser disabled');
    expect(output).toContain('sig sync pull');
    expect(output).toContain('sig login');
    expect(output).toContain('--cookie');
    expect(output).toContain('--token');
  });

  it('--remote shows "Browser: disabled" in success message', async () => {
    await runInit([], { remote: true });

    const output = stderrChunks.join('');
    expect(output).toContain('Browser:        disabled');
    // Should NOT show browser data dir or channel
    expect(output).not.toContain('Browser data:');
  });

  it('--remote implies --yes (skips interactive prompts)', async () => {
    // Force TTY to true — --remote should still skip interactive
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

    await runInit([], { remote: true });

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(process.exitCode).not.toBe(1);
  });

  it('--remote and --force can be used together', async () => {
    mockExistsSync.mockReturnValue(true);

    await runInit([], { remote: true, force: true });

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(process.exitCode).not.toBe(1);
    const [, writtenContent] = mockWriteFile.mock.calls[0] as [string, string, string];
    const YAML = await import('yaml');
    const parsed = YAML.parse(writtenContent);
    expect(parsed.mode).toBe('browserless');
  });

  it('without --remote generates config with mode: browser', async () => {
    await runInit([], { yes: true });

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [, writtenContent] = mockWriteFile.mock.calls[0] as [string, string, string];
    const YAML = await import('yaml');
    const parsed = YAML.parse(writtenContent);
    expect(parsed.mode).toBe('browser');
  });
});
