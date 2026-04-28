import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthManager } from '../../../src/auth-manager.js';
import { MemoryStorage } from '../../../src/storage/memory-storage.js';
import { ProviderRegistry } from '../../../src/providers/provider-registry.js';
import { StrategyRegistry } from '../../../src/strategies/registry.js';
import { CookieStrategyFactory } from '../../../src/strategies/cookie.strategy.js';
import { ApiTokenStrategyFactory } from '../../../src/strategies/api-token.strategy.js';
import { runLogin } from '../../../src/cli/commands/login.js';
import type { AuthDeps } from '../../../src/deps.js';
import type { ProviderConfig } from '../../../src/core/types.js';
import type { IBrowserAdapter } from '../../../src/core/interfaces/browser-adapter.js';
import type { BrowserConfig, SigConfig } from '../../../src/config/schema.js';

const addProviderToConfig = vi.fn(async () => {});

vi.mock('../../../src/config/loader.js', () => ({
    addProviderToConfig: (...args: unknown[]) => addProviderToConfig(...args),
    removeProviderFromConfig: vi.fn(async () => {}),
    loadConfig: vi.fn(),
    getConfigPath: vi.fn(() => '/tmp/test-config.yaml'),
    saveConfig: vi.fn(),
}));

const browserConfig: BrowserConfig = {
    browserDataDir: '/tmp/test-browser-data',
    channel: 'chrome',
    headlessTimeout: 30_000,
    visibleTimeout: 120_000,
    waitUntil: 'load',
};

function createDeps(providers?: ProviderConfig[]): {
    deps: AuthDeps;
    storage: MemoryStorage;
    providerRegistry: ProviderRegistry;
} {
    const storage = new MemoryStorage();
    const strategyRegistry = new StrategyRegistry();
    strategyRegistry.register(new CookieStrategyFactory());
    strategyRegistry.register(new ApiTokenStrategyFactory());

    const providerRegistry = new ProviderRegistry(providers ?? []);

    const authManager = new AuthManager({
        storage,
        strategyRegistry,
        providerRegistry,
        browserAdapterFactory: () => ({}) as IBrowserAdapter,
        browserConfig,
    });

    const config: SigConfig = {
        browser: browserConfig,
        storage: { credentialsDir: '/tmp/test-credentials' },
        providers: {},
    };

    const deps: AuthDeps = {
        authManager,
        storage,
        providerRegistry,
        strategyRegistry,
        config,
        browserAvailable: true,
    };

    return { deps, storage, providerRegistry };
}

describe('runLogin --network-proxy', () => {
    let stderrChunks: string[];
    let stdoutChunks: string[];
    let originalExitCode: number | undefined;

    beforeEach(() => {
        vi.clearAllMocks();
        stderrChunks = [];
        stdoutChunks = [];
        originalExitCode = process.exitCode;
        process.exitCode = undefined;

        vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
            stderrChunks.push(String(chunk));
            return true;
        });

        vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
            stdoutChunks.push(String(chunk));
            return true;
        });
    });

    afterEach(() => {
        process.exitCode = originalExitCode;
        vi.restoreAllMocks();
    });

    describe('auto-provisioned provider', () => {
        it('persists networkProxy in config when provider is auto-provisioned', async () => {
            const { deps } = createDeps();

            // Use --cookie to avoid browser launch, --network-proxy to set proxy
            await runLogin(
                ['https://blocked-site.example.com/'],
                { 'network-proxy': 'socks5h://127.0.0.1:1080', cookie: 'session=abc123' },
                deps,
            );

            expect(process.exitCode).not.toBe(1);

            // addProviderToConfig should have been called with networkProxy in the entry
            expect(addProviderToConfig).toHaveBeenCalledTimes(1);
            const [id, entry] = addProviderToConfig.mock.calls[0];
            expect(id).toBe('blocked-site');
            expect(entry.networkProxy).toBe('socks5h://127.0.0.1:1080');
        });

        it('includes networkProxy alongside other provider fields', async () => {
            const { deps } = createDeps();

            await runLogin(
                ['https://jira.corp.example.com/browse/PROJ-1'],
                { 'network-proxy': 'http://proxy.corp.com:8080', cookie: 'sid=xyz' },
                deps,
            );

            expect(process.exitCode).not.toBe(1);
            expect(addProviderToConfig).toHaveBeenCalledTimes(1);
            const [, entry] = addProviderToConfig.mock.calls[0];
            expect(entry.networkProxy).toBe('http://proxy.corp.com:8080');
            expect(entry.strategy).toBe('cookie');
            expect(entry.domains).toContain('jira.corp.example.com');
        });
    });

    describe('existing provider', () => {
        it('does NOT persist networkProxy when provider already exists', async () => {
            const existingProvider: ProviderConfig = {
                id: 'jira',
                name: 'Jira',
                domains: ['jira.example.com'],
                entryUrl: 'https://jira.example.com/',
                strategy: 'api-token',
                strategyConfig: { strategy: 'api-token' },
            };
            const { deps } = createDeps([existingProvider]);

            await runLogin(
                ['jira'],
                { 'network-proxy': 'socks5h://127.0.0.1:1080', token: 'my-token' },
                deps,
            );

            expect(process.exitCode).not.toBe(1);
            // Should NOT call addProviderToConfig (provider already exists, not auto-provisioned)
            expect(addProviderToConfig).not.toHaveBeenCalled();
        });

        it('applies proxy for this login session (existing provider uses token path)', async () => {
            const existingProvider: ProviderConfig = {
                id: 'github',
                name: 'GitHub',
                domains: ['github.com', 'api.github.com'],
                entryUrl: 'https://github.com/',
                strategy: 'api-token',
                strategyConfig: { strategy: 'api-token' },
            };
            const { deps, storage } = createDeps([existingProvider]);

            await runLogin(
                ['github'],
                { 'network-proxy': 'socks5h://127.0.0.1:7890', token: 'ghp_abc' },
                deps,
            );

            expect(process.exitCode).not.toBe(1);

            // Token still stored successfully
            const stored = await storage.get('github');
            expect(stored).not.toBeNull();
            expect(stored!.credential.type).toBe('api-key');

            // Proxy NOT persisted
            expect(addProviderToConfig).not.toHaveBeenCalled();
        });
    });

    describe('without --network-proxy flag', () => {
        it('does not include networkProxy when flag is not provided', async () => {
            const { deps } = createDeps();

            await runLogin(['https://new-service.example.com/'], { cookie: 'token=abc' }, deps);

            expect(process.exitCode).not.toBe(1);
            expect(addProviderToConfig).toHaveBeenCalledTimes(1);
            const [, entry] = addProviderToConfig.mock.calls[0];
            expect(entry.networkProxy).toBeUndefined();
        });
    });
});
