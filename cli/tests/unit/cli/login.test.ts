import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runLogin } from '../../../src/commands/login.js';
import { ProviderRegistry } from '../../../src/providers/provider-registry.js';
import { MemoryStorage } from '../../../src/storage/memory-storage.js';
import { CredentialNotFoundError, err, ok } from '../../../src/types/index.js';
import type { ProviderConfig } from '../../../src/types/types.js';

// Mock persistIfAutoProvisioned to avoid file I/O
vi.mock('../../../src/utils/provider-persist.js', () => ({
    persistIfAutoProvisioned: vi.fn().mockResolvedValue(undefined),
}));

// Mock audit log to avoid file I/O
vi.mock('../../../src/audit/audit-log.js', () => ({
    logAuditEvent: vi.fn().mockResolvedValue(undefined),
    AuditAction: { LOGIN: 'login' },
    AuditStatus: { SUCCESS: 'success', FAILURE: 'failure' },
}));

function makeOauth2Provider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
    return {
        id: 'my-api',
        name: 'my-api',
        domains: ['api.example.com'],
        entryUrl: '',
        strategy: 'oauth2',
        extract: [],
        apply: [{ in: 'header', name: 'Authorization', value: 'Bearer ${access_token}' }],
        oauth2: { tokenUrl: 'https://auth.example.com/oauth/token' },
        ...overrides,
    };
}

function makeMockAuth(
    provider: ProviderConfig | null,
    storage: MemoryStorage,
    extractResult: { access_token: string } | Error = { access_token: 'tok-abc' },
) {
    const registry = new ProviderRegistry(provider ? [provider] : []);

    return {
        storage,
        browserAvailable: true,
        logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
        providerRegistry: registry,
        resolveProvider: vi.fn((input: string) => {
            const found = registry.resolveFlexible(input);
            if (found) return ok(found);
            // auto-provision for URL-like input
            if (input.startsWith('http')) {
                const autoProvider: ProviderConfig = {
                    id: 'my-api',
                    name: 'api.example.com',
                    domains: ['api.example.com'],
                    entryUrl: 'https://api.example.com/',
                    strategy: 'browser',
                    extract: [{ from: 'cookies' as const, as: 'cookie', match: '*' }],
                    apply: [{ in: 'header' as const, name: 'Cookie', value: '${cookie}' }],
                    autoProvisioned: true,
                };
                registry.register(autoProvider);
                return ok(autoProvider);
            }
            return err(new CredentialNotFoundError(input));
        }),
        getExtractedCreds: vi.fn(async (_id: string) => {
            if (extractResult instanceof Error) return err(extractResult);
            return ok(extractResult);
        }),
        getStatus: vi.fn(async () => ({
            id: provider?.id ?? 'my-api',
            name: provider?.name ?? 'my-api',
            configured: true,
            valid: true,
            strategy: provider?.strategy ?? 'oauth2',
        })),
    };
}

describe('runLogin — oauth2 strategy', () => {
    let storage: MemoryStorage;
    let stderrChunks: string[];
    let stdoutChunks: string[];
    let _originalStderr: typeof process.stderr.write;
    let _originalStdout: typeof process.stdout.write;
    let originalExitCode: number | undefined;

    beforeEach(() => {
        storage = new MemoryStorage();
        stderrChunks = [];
        stdoutChunks = [];
        _originalStderr = process.stderr.write.bind(process.stderr);
        _originalStdout = process.stdout.write.bind(process.stdout);
        originalExitCode = process.exitCode as number | undefined;
        process.exitCode = 0;

        vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
            stderrChunks.push(String(chunk));
            return true;
        });
        vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
            stdoutChunks.push(String(chunk));
            return true;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        process.exitCode = originalExitCode;
    });

    it('succeeds with stored oauth2 credentials and no new flags', async () => {
        const provider = makeOauth2Provider();
        await storage.set('my-api', {
            providerId: 'my-api',
            strategy: 'oauth2',
            updatedAt: new Date().toISOString(),
            values: {},
            oauth2: { clientId: 'client-id', clientSecret: 'client-secret' },
        });
        const auth = makeMockAuth(provider, storage);

        await runLogin(['my-api'], { strategy: 'oauth2' }, auth as never);

        expect(process.exitCode).toBe(0);
        expect(auth.getExtractedCreds).toHaveBeenCalledWith('my-api', { force: true });
        expect(stderrChunks.join('')).toContain('Authenticated with "my-api"');
    });

    it('pre-seeds credentials when --client-id and --client-secret are given', async () => {
        const provider = makeOauth2Provider();
        const auth = makeMockAuth(provider, storage);

        await runLogin(
            ['my-api'],
            {
                strategy: 'oauth2',
                'client-id': 'new-id',
                'client-secret': 'new-secret',
            },
            auth as never,
        );

        expect(process.exitCode).toBe(0);
        const stored = await storage.get('my-api');
        expect(stored?.oauth2?.clientId).toBe('new-id');
        expect(stored?.oauth2?.clientSecret).toBe('new-secret');
        expect(auth.getExtractedCreds).toHaveBeenCalledWith('my-api', { force: true });
    });

    it('merges --client-secret into existing stored oauth2', async () => {
        const provider = makeOauth2Provider();
        await storage.set('my-api', {
            providerId: 'my-api',
            strategy: 'oauth2',
            updatedAt: new Date().toISOString(),
            values: { access_token: 'old-token' },
            oauth2: { clientId: 'existing-id', clientSecret: 'old-secret' },
        });
        const auth = makeMockAuth(provider, storage);

        await runLogin(
            ['my-api'],
            { strategy: 'oauth2', 'client-secret': 'new-secret' },
            auth as never,
        );

        expect(process.exitCode).toBe(0);
        const stored = await storage.get('my-api');
        // clientId kept from existing, clientSecret updated
        expect(stored?.oauth2?.clientId).toBe('existing-id');
        expect(stored?.oauth2?.clientSecret).toBe('new-secret');
    });

    it('fails with error when no stored oauth2 and no flags provided', async () => {
        const provider = makeOauth2Provider();
        const auth = makeMockAuth(provider, storage);

        await runLogin(['my-api'], { strategy: 'oauth2' }, auth as never);

        expect(process.exitCode).toBe(1);
        expect(stderrChunks.join('')).toContain('No stored credentials');
        expect(auth.getExtractedCreds).not.toHaveBeenCalled();
    });

    it('fails when only --client-id given without --client-secret', async () => {
        const provider = makeOauth2Provider();
        const auth = makeMockAuth(provider, storage);

        await runLogin(['my-api'], { strategy: 'oauth2', 'client-id': 'id-only' }, auth as never);

        expect(process.exitCode).toBe(1);
        expect(stderrChunks.join('')).toContain('--client-id and --client-secret');
        expect(auth.getExtractedCreds).not.toHaveBeenCalled();
    });

    it('sets token-url on provider when --token-url flag is given', async () => {
        const provider = makeOauth2Provider({ oauth2: undefined });
        await storage.set('my-api', {
            providerId: 'my-api',
            strategy: 'oauth2',
            updatedAt: new Date().toISOString(),
            values: {},
            oauth2: { clientId: 'id', clientSecret: 'secret' },
        });
        const auth = makeMockAuth(provider, storage);

        await runLogin(
            ['my-api'],
            { strategy: 'oauth2', 'token-url': 'https://new-auth.example.com/token' },
            auth as never,
        );

        expect(process.exitCode).toBe(0);
        expect(provider.oauth2?.tokenUrl).toBe('https://new-auth.example.com/token');
    });

    it('fails when strategy=oauth2 but no tokenUrl and no --token-url flag', async () => {
        const provider = makeOauth2Provider({ oauth2: undefined });
        const auth = makeMockAuth(provider, storage);

        await runLogin(['my-api'], { strategy: 'oauth2' }, auth as never);

        expect(process.exitCode).toBe(1);
        expect(stderrChunks.join('')).toContain('--token-url');
        expect(auth.getExtractedCreds).not.toHaveBeenCalled();
    });

    it('reports error when getExtractedCreds fails', async () => {
        const provider = makeOauth2Provider();
        await storage.set('my-api', {
            providerId: 'my-api',
            strategy: 'oauth2',
            updatedAt: new Date().toISOString(),
            values: {},
            oauth2: { clientId: 'id', clientSecret: 'secret' },
        });
        const auth = makeMockAuth(provider, storage, new CredentialNotFoundError('my-api'));

        await runLogin(['my-api'], { strategy: 'oauth2' }, auth as never);

        expect(process.exitCode).toBe(1);
        expect(stderrChunks.join('')).toContain('Authentication failed');
    });

    it('outputs provider id and strategy on success', async () => {
        const provider = makeOauth2Provider();
        await storage.set('my-api', {
            providerId: 'my-api',
            strategy: 'oauth2',
            updatedAt: new Date().toISOString(),
            values: {},
            oauth2: { clientId: 'id', clientSecret: 'secret' },
        });
        const auth = makeMockAuth(provider, storage);

        await runLogin(['my-api'], { strategy: 'oauth2' }, auth as never);

        const stdout = stdoutChunks.join('');
        expect(stdout).toContain('"provider"');
        expect(stdout).toContain('"my-api"');
        expect(stdout).toContain('"strategy"');
        expect(stdout).toContain('"oauth2"');
    });

    it('fails with no positional arg', async () => {
        const auth = makeMockAuth(null, storage);

        await runLogin([], {}, auth as never);

        expect(process.exitCode).toBe(1);
        expect(stderrChunks.join('')).toContain('Usage: sig login');
    });
});
