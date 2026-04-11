import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RemoteConfig } from '../../../src/sync/types.js';

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
import { getRemotes, getRemote, addRemote, removeRemote } from '../../../src/sync/remote-config.js';

const mockFs = vi.mocked(fs);

describe('remote-config', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getRemotes', () => {
        it('returns empty array when no config exists', async () => {
            const enoent = new Error('File not found') as NodeJS.ErrnoException;
            enoent.code = 'ENOENT';
            mockFs.readFile.mockRejectedValue(enoent);

            const remotes = await getRemotes();
            expect(remotes).toEqual([]);
        });

        it('returns empty array when config has no remotes key', async () => {
            mockFs.readFile.mockResolvedValue('{}');

            const remotes = await getRemotes();
            expect(remotes).toEqual([]);
        });

        it('returns remotes with name merged from key', async () => {
            mockFs.readFile.mockResolvedValue(
                'remotes:\n  dev:\n    type: ssh\n    host: dev.example.com\n    user: alice\n',
            );

            const remotes = await getRemotes();
            expect(remotes).toEqual([
                { name: 'dev', type: 'ssh', host: 'dev.example.com', user: 'alice' },
            ]);
        });
    });

    describe('getRemote', () => {
        it('returns specific remote by name', async () => {
            mockFs.readFile.mockResolvedValue(
                'remotes:\n  dev:\n    type: ssh\n    host: dev.example.com\n  prod:\n    type: ssh\n    host: prod.example.com\n',
            );

            const remote = await getRemote('prod');
            expect(remote).toEqual({ name: 'prod', type: 'ssh', host: 'prod.example.com' });
        });

        it('returns null for non-existent remote', async () => {
            mockFs.readFile.mockResolvedValue(
                'remotes:\n  dev:\n    type: ssh\n    host: dev.example.com\n',
            );

            const remote = await getRemote('nope');
            expect(remote).toBeNull();
        });
    });

    describe('addRemote', () => {
        it('adds a remote to empty config', async () => {
            const enoent = new Error('File not found') as NodeJS.ErrnoException;
            enoent.code = 'ENOENT';
            mockFs.readFile.mockRejectedValue(enoent);
            mockFs.mkdir.mockResolvedValue(undefined);
            mockFs.writeFile.mockResolvedValue(undefined);

            const remote: RemoteConfig = {
                name: 'work',
                type: 'ssh',
                host: 'work.example.com',
                user: 'jdoe',
            };

            await addRemote(remote);

            expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
            const writtenContent = mockFs.writeFile.mock.calls[0][1] as string;
            expect(writtenContent).toContain('work');
            expect(writtenContent).toContain('work.example.com');
            expect(writtenContent).toContain('jdoe');
        });

        it('overwrites existing remote with same name', async () => {
            mockFs.readFile.mockResolvedValue(
                'remotes:\n  work:\n    type: ssh\n    host: old.example.com\n',
            );
            mockFs.mkdir.mockResolvedValue(undefined);
            mockFs.writeFile.mockResolvedValue(undefined);

            const remote: RemoteConfig = {
                name: 'work',
                type: 'ssh',
                host: 'new.example.com',
            };

            await addRemote(remote);

            const writtenContent = mockFs.writeFile.mock.calls[0][1] as string;
            expect(writtenContent).toContain('new.example.com');
            expect(writtenContent).not.toContain('old.example.com');
        });
    });

    describe('removeRemote', () => {
        it('removes an existing remote and returns true', async () => {
            mockFs.readFile.mockResolvedValue(
                'remotes:\n  work:\n    type: ssh\n    host: work.example.com\n',
            );
            mockFs.mkdir.mockResolvedValue(undefined);
            mockFs.writeFile.mockResolvedValue(undefined);

            const removed = await removeRemote('work');
            expect(removed).toBe(true);
            expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
        });

        it('returns false for non-existent remote', async () => {
            mockFs.readFile.mockResolvedValue(
                'remotes:\n  work:\n    type: ssh\n    host: work.example.com\n',
            );

            const removed = await removeRemote('nope');
            expect(removed).toBe(false);
        });

        it('returns false when config has no remotes', async () => {
            const enoent = new Error('File not found') as NodeJS.ErrnoException;
            enoent.code = 'ENOENT';
            mockFs.readFile.mockRejectedValue(enoent);

            const removed = await removeRemote('anything');
            expect(removed).toBe(false);
        });
    });
});
