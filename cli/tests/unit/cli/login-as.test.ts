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
import type { BrowserConfig, SignetConfig } from '../../../src/config/schema.js';

// Mock addProviderToConfig to prevent tests from writing to the real ~/.sig/config.yaml
vi.mock('../../../src/config/loader.js', () => ({
    addProviderToConfig: vi.fn(async () => {}),
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

    const config: SignetConfig = {
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

describe('runLogin --as flag', () => {
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

    it('overrides auto-provisioned provider ID with --as value', async () => {
        const { deps, storage } = createDeps();

        await runLogin(
            ['https://bdc-cockpit-starkiller-hc-ga.starkiller.hanacloudservices.cloud.sap/'],
            { as: 'bdc-starkiller', cookie: 'session=abc' },
            deps,
        );

        expect(process.exitCode).not.toBe(1);

        // Credential stored under the custom ID
        const stored = await storage.get('bdc-starkiller');
        expect(stored).not.toBeNull();
        expect(stored!.credential.type).toBe('cookie');

        // Not stored under the auto-derived ID
        const old = await storage.get('bdc-cockpit-starkiller-hc-ga');
        expect(old).toBeNull();
    });

    it('outputs JSON with the custom provider ID', async () => {
        const { deps } = createDeps();

        await runLogin(
            ['https://jira.tools.sap/browse/PROJ-1'],
            { as: 'my-jira', cookie: 'sid=123' },
            deps,
        );

        expect(process.exitCode).not.toBe(1);
        const stdout = stdoutChunks.join('');
        const parsed = JSON.parse(stdout);
        expect(parsed.provider).toBe('my-jira');
    });

    it('updates provider name when it matches the old auto-derived ID', async () => {
        const { deps, providerRegistry } = createDeps();

        await runLogin(['https://jira.tools.sap/'], { as: 'my-jira', token: 'tok123' }, deps);

        expect(process.exitCode).not.toBe(1);

        // Provider registered under custom ID
        const provider = providerRegistry.get('my-jira');
        expect(provider).not.toBeNull();
        expect(provider!.id).toBe('my-jira');
    });

    it('overrides ID for token-based login', async () => {
        const { deps, storage } = createDeps();

        await runLogin(
            ['https://api.example.com/'],
            { as: 'my-api', token: 'bearer-token-123' },
            deps,
        );

        expect(process.exitCode).not.toBe(1);

        const stored = await storage.get('my-api');
        expect(stored).not.toBeNull();
        expect(stored!.credential.type).toBe('api-key');
    });

    it('works with an existing configured provider', async () => {
        const existingProvider: ProviderConfig = {
            id: 'old-name',
            name: 'Old Name',
            domains: ['site.example.com'],
            entryUrl: 'https://site.example.com/',
            strategy: 'cookie',
            strategyConfig: { strategy: 'cookie' },
        };
        const { deps, storage } = createDeps([existingProvider]);

        await runLogin(['https://site.example.com/'], { as: 'new-name', cookie: 'key=val' }, deps);

        expect(process.exitCode).not.toBe(1);

        // Stored under new ID
        const stored = await storage.get('new-name');
        expect(stored).not.toBeNull();

        // Name preserved (was not same as old id)
        const stdout = stdoutChunks.join('');
        const parsed = JSON.parse(stdout);
        expect(parsed.provider).toBe('new-name');
    });
});
