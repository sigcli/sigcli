import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getWatchConfig,
    getWatchProviders,
    addWatchProvider,
    removeWatchProvider,
    setWatchInterval,
} from '../../../src/watch/watch-config.js';

// Mock fs
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();

vi.mock('node:fs/promises', () => ({
    default: {
        readFile: (...args: unknown[]) => mockReadFile(...args),
        writeFile: (...args: unknown[]) => mockWriteFile(...args),
        mkdir: (...args: unknown[]) => mockMkdir(...args),
    },
}));

beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
});

describe('watch-config', () => {
    describe('getWatchConfig', () => {
        it('returns null when no config file exists', async () => {
            mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
            const result = await getWatchConfig();
            expect(result).toBeNull();
        });

        it('returns null when config has no watch section', async () => {
            mockReadFile.mockResolvedValue(
                'providers:\n  jira:\n    strategy: cookie\n    domains: [jira.example.com]\n',
            );
            const result = await getWatchConfig();
            expect(result).toBeNull();
        });

        it('parses watch config with providers', async () => {
            mockReadFile.mockResolvedValue(
                'watch:\n' +
                    '  interval: "2m"\n' +
                    '  providers:\n' +
                    '    sap-jira:\n' +
                    '      autoSync:\n' +
                    '        - devbox\n' +
                    '    sap-wiki:\n',
            );
            const result = await getWatchConfig();
            expect(result).toEqual({
                interval: '2m',
                providers: {
                    'sap-jira': { autoSync: ['devbox'] },
                    'sap-wiki': { autoSync: [] },
                },
            });
        });

        it('defaults interval to 5m when not specified', async () => {
            mockReadFile.mockResolvedValue('watch:\n' + '  providers:\n' + '    jira:\n');
            const result = await getWatchConfig();
            expect(result?.interval).toBe('5m');
        });
    });

    describe('getWatchProviders', () => {
        it('returns empty array when no watch config', async () => {
            mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
            const result = await getWatchProviders();
            expect(result).toEqual([]);
        });

        it('returns flat list of providers', async () => {
            mockReadFile.mockResolvedValue(
                'watch:\n' +
                    '  interval: "1m"\n' +
                    '  providers:\n' +
                    '    jira:\n' +
                    '      autoSync:\n' +
                    '        - devbox\n' +
                    '    wiki:\n',
            );
            const result = await getWatchProviders();
            expect(result).toEqual([
                { providerId: 'jira', autoSync: ['devbox'] },
                { providerId: 'wiki', autoSync: [] },
            ]);
        });
    });

    describe('addWatchProvider', () => {
        it('creates watch section when it does not exist', async () => {
            mockReadFile.mockResolvedValue(
                'providers:\n  jira:\n    strategy: cookie\n    domains: [jira.example.com]\n',
            );
            await addWatchProvider('jira', { autoSync: [] });
            expect(mockWriteFile).toHaveBeenCalledOnce();
            const written = mockWriteFile.mock.calls[0][1] as string;
            expect(written).toContain('watch:');
            expect(written).toContain('jira');
        });

        it('adds provider with autoSync', async () => {
            mockReadFile.mockResolvedValue('watch:\n' + '  interval: "5m"\n' + '  providers: {}\n');
            await addWatchProvider('jira', { autoSync: ['devbox'] });
            const written = mockWriteFile.mock.calls[0][1] as string;
            expect(written).toContain('jira');
            expect(written).toContain('devbox');
        });

        it('adds provider without autoSync as null in YAML', async () => {
            mockReadFile.mockResolvedValue('watch:\n' + '  interval: "5m"\n' + '  providers: {}\n');
            await addWatchProvider('wiki', { autoSync: [] });
            const written = mockWriteFile.mock.calls[0][1] as string;
            expect(written).toContain('wiki');
        });
    });

    describe('removeWatchProvider', () => {
        it('removes an existing provider', async () => {
            mockReadFile.mockResolvedValue(
                'watch:\n' +
                    '  interval: "5m"\n' +
                    '  providers:\n' +
                    '    jira:\n' +
                    '      autoSync:\n' +
                    '        - devbox\n',
            );
            const result = await removeWatchProvider('jira');
            expect(result).toBe(true);
            const written = mockWriteFile.mock.calls[0][1] as string;
            expect(written).not.toContain('jira');
        });

        it('returns false for non-existent provider', async () => {
            mockReadFile.mockResolvedValue(
                'watch:\n' + '  interval: "5m"\n' + '  providers:\n' + '    jira:\n',
            );
            const result = await removeWatchProvider('unknown');
            expect(result).toBe(false);
            expect(mockWriteFile).not.toHaveBeenCalled();
        });

        it('returns false when no watch section exists', async () => {
            mockReadFile.mockResolvedValue('providers: {}\n');
            const result = await removeWatchProvider('jira');
            expect(result).toBe(false);
        });
    });

    describe('setWatchInterval', () => {
        it('sets interval in existing watch section', async () => {
            mockReadFile.mockResolvedValue(
                'watch:\n' + '  interval: "5m"\n' + '  providers:\n' + '    jira:\n',
            );
            await setWatchInterval('1m');
            const written = mockWriteFile.mock.calls[0][1] as string;
            expect(written).toContain('1m');
        });

        it('creates watch section when missing', async () => {
            mockReadFile.mockResolvedValue('providers: {}\n');
            await setWatchInterval('10m');
            const written = mockWriteFile.mock.calls[0][1] as string;
            expect(written).toContain('watch:');
            expect(written).toContain('10m');
        });
    });
});
