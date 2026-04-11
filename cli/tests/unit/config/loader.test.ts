import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';

// Mock fs before importing the module under test
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
}));

// Import after mocking
import fs from 'node:fs/promises';
import { loadConfig, saveConfig, getConfigPath } from '../../../src/config/loader.js';
import { isOk, isErr } from '../../../src/core/result.js';

const mockFs = vi.mocked(fs);

const EXPECTED_CONFIG_PATH = path.join(os.homedir(), '.signet', 'config.yaml');

const VALID_YAML = `
browser:
  browserDataDir: /tmp/browser-data
  channel: chrome
storage:
  credentialsDir: /tmp/credentials
providers:
  github:
    domains:
      - github.com
    entryUrl: https://github.com/
    strategy: cookie
`;

const VALID_YAML_WITH_REMOTES = `
browser:
  browserDataDir: /tmp/browser-data
  channel: chrome
storage:
  credentialsDir: /tmp/credentials
providers:
  github:
    domains:
      - github.com
    entryUrl: https://github.com/
    strategy: cookie
    config:
      ttl: "24h"
  api:
    domains:
      - api.example.com
    entryUrl: https://api.example.com/
    strategy: api-token
    config:
      headerName: X-API-Key
remotes:
  dev:
    type: ssh
    host: dev.example.com
    user: alice
`;

describe('loadConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when config file does not exist', async () => {
    const enoent = new Error('File not found') as NodeJS.ErrnoException;
    enoent.code = 'ENOENT';
    mockFs.readFile.mockRejectedValue(enoent);

    const result = await loadConfig();
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFIG_ERROR');
      expect(result.error.message).toContain('Config file not found');
      expect(result.error.message).toContain(EXPECTED_CONFIG_PATH);
    }
  });

  it('returns error for non-ENOENT read failures', async () => {
    mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

    const result = await loadConfig();
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFIG_ERROR');
      expect(result.error.message).toContain('Failed to read config');
      expect(result.error.message).toContain('Permission denied');
    }
  });

  it('returns error for invalid YAML', async () => {
    mockFs.readFile.mockResolvedValue('{ invalid yaml: [}');

    const result = await loadConfig();
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFIG_ERROR');
      expect(result.error.message).toContain('Invalid YAML');
    }
  });

  it('returns error for empty file', async () => {
    mockFs.readFile.mockResolvedValue('');

    const result = await loadConfig();
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFIG_ERROR');
      expect(result.error.message).toContain('empty or not an object');
    }
  });

  it('returns error for non-object YAML content (scalar)', async () => {
    mockFs.readFile.mockResolvedValue('just a string');

    const result = await loadConfig();
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFIG_ERROR');
      expect(result.error.message).toContain('empty or not an object');
    }
  });

  it('loads and parses valid YAML config', async () => {
    mockFs.readFile.mockResolvedValue(VALID_YAML);

    const result = await loadConfig();
    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.browser.browserDataDir).toBe('/tmp/browser-data');
      expect(result.value.storage.credentialsDir).toBe('/tmp/credentials');
      expect(result.value.providers.github.domains).toEqual(['github.com']);
      expect(result.value.providers.github.strategy).toBe('cookie');
      expect(result.value.remotes).toBeUndefined();
    }
  });

  it('correctly converts provider entries with config to SignetConfig', async () => {
    mockFs.readFile.mockResolvedValue(VALID_YAML_WITH_REMOTES);

    const result = await loadConfig();
    expect(isOk(result)).toBe(true);
    if (result.ok) {
      // Browser section with optional channel
      expect(result.value.browser.browserDataDir).toBe('/tmp/browser-data');
      expect(result.value.browser.channel).toBe('chrome');

      // Multiple providers
      expect(Object.keys(result.value.providers)).toHaveLength(2);
      expect(result.value.providers.github.config).toEqual({ ttl: '24h' });
      expect(result.value.providers.api.strategy).toBe('api-token');
      expect(result.value.providers.api.config).toEqual({ headerName: 'X-API-Key' });
    }
  });

  it('handles optional remotes section', async () => {
    mockFs.readFile.mockResolvedValue(VALID_YAML_WITH_REMOTES);

    const result = await loadConfig();
    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.remotes).toBeDefined();
      expect(result.value.remotes!.dev).toEqual({
        type: 'ssh',
        host: 'dev.example.com',
        user: 'alice',
      });
    }
  });

  it('passes validation errors through from validator', async () => {
    // Valid YAML but missing mandatory fields
    mockFs.readFile.mockResolvedValue('providers:\n  bad:\n    strategy: cookie\n');

    const result = await loadConfig();
    expect(isErr(result)).toBe(true);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFIG_ERROR');
      // Should contain validation errors from validator (missing browser, storage, domains)
      expect(result.error.message).toContain('browser');
      expect(result.error.message).toContain('storage');
    }
  });

  it('reads from the expected config path', async () => {
    const enoent = new Error('File not found') as NodeJS.ErrnoException;
    enoent.code = 'ENOENT';
    mockFs.readFile.mockRejectedValue(enoent);

    await loadConfig();
    expect(mockFs.readFile).toHaveBeenCalledWith(EXPECTED_CONFIG_PATH, 'utf-8');
  });
});

describe('saveConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes config as YAML to the config path', async () => {
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);

    const config = {
      browser: { browserDataDir: '/tmp/bd' },
      storage: { credentialsDir: '/tmp/creds' },
      providers: {
        test: {
          domains: ['test.com'],
          strategy: 'cookie' as const,
        },
      },
    };

    await saveConfig(config);

    expect(mockFs.mkdir).toHaveBeenCalledWith(
      path.dirname(EXPECTED_CONFIG_PATH),
      { recursive: true },
    );
    expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
    const [writtenPath, writtenContent] = mockFs.writeFile.mock.calls[0] as [string, string, string];
    expect(writtenPath).toBe(EXPECTED_CONFIG_PATH);
    expect(writtenContent).toContain('browserDataDir');
    expect(writtenContent).toContain('test.com');
  });
});

describe('getConfigPath', () => {
  it('returns the expected config file path', () => {
    expect(getConfigPath()).toBe(EXPECTED_CONFIG_PATH);
  });

  it('path ends with config.yaml under .signet', () => {
    const p = getConfigPath();
    expect(p).toMatch(/\.signet[/\\]config\.yaml$/);
  });
});
