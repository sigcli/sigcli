import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';

// Mock fs modules
vi.mock('node:fs/promises', () => ({
    default: {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        mkdir: vi.fn(),
    },
}));

vi.mock('node:fs', () => ({
    existsSync: vi.fn(),
    realpathSync: vi.fn((p: string) => p),
    default: {
        existsSync: vi.fn(),
        realpathSync: vi.fn((p: string) => p),
    },
}));

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import {
    findProjectConfigPath,
    loadProjectConfig,
    loadMergedConfig,
    getProjectConfigPath,
} from '../../../src/config/loader.js';
import { isOk, isErr } from '../../../src/core/result.js';

const mockFs = vi.mocked(fs);
const mockExistsSync = vi.mocked(existsSync);

const VALID_PROJECT_YAML = `
providers:
  my-jira:
    domains:
      - jira.example.com
    entryUrl: https://jira.example.com/
    strategy: cookie
`;

const VALID_GLOBAL_YAML = `
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

describe('Project Config', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('findProjectConfigPath', () => {
        it('returns null when no .sig/config.yaml found', () => {
            mockExistsSync.mockReturnValue(false);
            const result = findProjectConfigPath('/home/user/project/src');
            expect(result).toBeNull();
        });

        it('finds .sig/config.yaml in current directory', () => {
            const projectDir = '/home/user/project';
            mockExistsSync.mockImplementation((p) => {
                return p === path.join(projectDir, '.sig', 'config.yaml');
            });
            const result = findProjectConfigPath(projectDir);
            expect(result).toBe(path.join(projectDir, '.sig', 'config.yaml'));
        });

        it('walks up directories to find .sig/config.yaml', () => {
            const rootConfig = '/home/user/project/.sig/config.yaml';
            mockExistsSync.mockImplementation((p) => {
                return p === rootConfig;
            });
            const result = findProjectConfigPath('/home/user/project/packages/frontend/src');
            expect(result).toBe(rootConfig);
        });

        it('skips global ~/.sig/config.yaml', () => {
            const globalPath = path.join(os.homedir(), '.sig', 'config.yaml');
            mockExistsSync.mockImplementation((p) => {
                return p === globalPath;
            });
            const result = findProjectConfigPath(os.homedir());
            expect(result).toBeNull();
        });
    });

    describe('loadProjectConfig', () => {
        it('loads and validates a valid project config', async () => {
            mockFs.readFile.mockResolvedValue(VALID_PROJECT_YAML);
            const result = await loadProjectConfig('/project/.sig/config.yaml');
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value.providers['my-jira']).toBeDefined();
                expect(result.value.providers['my-jira'].strategy).toBe('cookie');
            }
        });

        it('rejects config with browser section', async () => {
            const invalidYaml = `
browser:
  browserDataDir: /tmp
  channel: chrome
providers:
  test:
    domains: ["example.com"]
    entryUrl: https://example.com/
    strategy: cookie
`;
            mockFs.readFile.mockResolvedValue(invalidYaml);
            const result = await loadProjectConfig('/project/.sig/config.yaml');
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message).toContain('does not support "browser"');
            }
        });

        it('rejects config with storage section', async () => {
            const invalidYaml = `
storage:
  credentialsDir: /tmp
providers:
  test:
    domains: ["example.com"]
    entryUrl: https://example.com/
    strategy: cookie
`;
            mockFs.readFile.mockResolvedValue(invalidYaml);
            const result = await loadProjectConfig('/project/.sig/config.yaml');
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message).toContain('does not support "storage"');
            }
        });

        it('returns error for missing file', async () => {
            mockFs.readFile.mockRejectedValue(
                Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
            );
            const result = await loadProjectConfig('/missing/.sig/config.yaml');
            expect(isErr(result)).toBe(true);
        });
    });

    describe('loadMergedConfig', () => {
        const FAKE_CWD = '/workspace/my-project';
        let cwdSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(FAKE_CWD);
        });

        afterEach(() => {
            cwdSpy.mockRestore();
        });

        it('merges project providers over global providers', async () => {
            const projectConfigPath = path.join(FAKE_CWD, '.sig', 'config.yaml');
            const globalConfigPath = path.join(os.homedir(), '.sig', 'config.yaml');

            mockFs.readFile.mockImplementation(async (filePath: unknown) => {
                const p = String(filePath);
                if (p === globalConfigPath) return VALID_GLOBAL_YAML;
                if (p === projectConfigPath) return VALID_PROJECT_YAML;
                throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
            });
            mockExistsSync.mockImplementation((p) => {
                const s = p.toString();
                return s === projectConfigPath || s === globalConfigPath;
            });

            const result = await loadMergedConfig();
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                const { config, providerSources } = result.value;
                // Both global and project providers present
                expect(config.providers['github']).toBeDefined();
                expect(config.providers['my-jira']).toBeDefined();
                // Sources tracked correctly
                expect(providerSources['github']).toBe('user');
                expect(providerSources['my-jira']).toBe('project');
            }
        });

        it('project provider overrides global provider with same ID', async () => {
            const projectYamlOverride = `
providers:
  github:
    domains:
      - github.enterprise.com
    entryUrl: https://github.enterprise.com/
    strategy: cookie
`;
            const projectConfigPath = path.join(FAKE_CWD, '.sig', 'config.yaml');
            const globalConfigPath = path.join(os.homedir(), '.sig', 'config.yaml');

            mockFs.readFile.mockImplementation(async (filePath: unknown) => {
                const p = String(filePath);
                if (p === globalConfigPath) return VALID_GLOBAL_YAML;
                if (p === projectConfigPath) return projectYamlOverride;
                throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
            });
            mockExistsSync.mockImplementation((p) => {
                const s = p.toString();
                return s === projectConfigPath || s === globalConfigPath;
            });

            const result = await loadMergedConfig();
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                const { config, providerSources } = result.value;
                expect(config.providers['github'].domains).toEqual(['github.enterprise.com']);
                expect(providerSources['github']).toBe('project');
            }
        });

        it('works without project config (global only)', async () => {
            mockFs.readFile.mockResolvedValue(VALID_GLOBAL_YAML);
            mockExistsSync.mockReturnValue(false);

            const result = await loadMergedConfig();
            expect(isOk(result)).toBe(true);
            if (isOk(result)) {
                expect(result.value.projectConfigPath).toBeNull();
                expect(result.value.providerSources['github']).toBe('user');
            }
        });
    });

    describe('getProjectConfigPath', () => {
        it('returns CWD/.sig/config.yaml', () => {
            const expected = path.join(process.cwd(), '.sig', 'config.yaml');
            expect(getProjectConfigPath()).toBe(expected);
        });
    });
});
