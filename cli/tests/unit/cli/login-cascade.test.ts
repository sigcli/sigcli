import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthManager } from '../../../src/auth-manager.js';
import { MemoryStorage } from '../../../src/storage/memory-storage.js';
import { ProviderRegistry } from '../../../src/providers/provider-registry.js';
import { StrategyRegistry } from '../../../src/strategies/registry.js';
import { CookieStrategyFactory } from '../../../src/strategies/cookie.strategy.js';
import { OAuth2StrategyFactory } from '../../../src/strategies/oauth2.strategy.js';
import { ApiTokenStrategyFactory } from '../../../src/strategies/api-token.strategy.js';
import { BasicAuthStrategyFactory } from '../../../src/strategies/basic-auth.strategy.js';
import { runLogin } from '../../../src/cli/commands/login.js';
import type { AuthDeps } from '../../../src/deps.js';
import type { ProviderConfig } from '../../../src/core/types.js';
import type { IBrowserAdapter } from '../../../src/core/interfaces/browser-adapter.js';
import type { BrowserConfig, SigConfig } from '../../../src/config/schema.js';

const browserConfig: BrowserConfig = {
    browserDataDir: '/tmp/test-browser-data',
    channel: 'chrome',
    headlessTimeout: 30_000,
    visibleTimeout: 120_000,
    waitUntil: 'load',
};

const nullBrowserFactory = (): IBrowserAdapter => ({
    name: 'null',
    launch: () => {
        throw new Error('Browser not available in test');
    },
});

const apiTokenProvider: ProviderConfig = {
    id: 'test-api',
    name: 'Test API',
    domains: ['api.test.com'],
    entryUrl: 'https://api.test.com/',
    strategy: 'api-token',
    strategyConfig: { strategy: 'api-token' },
};

function createDeps(overrides: Partial<AuthDeps> = {}): AuthDeps {
    const storage = new MemoryStorage();
    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(apiTokenProvider);
    const strategyRegistry = new StrategyRegistry();
    strategyRegistry.register(new CookieStrategyFactory());
    strategyRegistry.register(new OAuth2StrategyFactory());
    strategyRegistry.register(new ApiTokenStrategyFactory());
    strategyRegistry.register(new BasicAuthStrategyFactory());
    const config: SigConfig = {
        mode: 'browser',
        browser: browserConfig,
        storage: { credentialsDir: '/tmp/test-creds' },
        providers: {},
    };
    const authManager = new AuthManager({
        storage,
        strategyRegistry,
        providerRegistry,
        browserAdapterFactory: nullBrowserFactory,
        browserConfig,
    });
    return {
        authManager,
        storage,
        providerRegistry,
        strategyRegistry,
        config,
        browserAvailable: true,
        ...overrides,
    };
}

describe('login cascade behavior', () => {
    let stdoutData: string;
    let stderrData: string;
    const origStdoutWrite = process.stdout.write.bind(process.stdout);
    const origStderrWrite = process.stderr.write.bind(process.stderr);
    const origExitCode = process.exitCode;

    beforeEach(() => {
        stdoutData = '';
        stderrData = '';
        process.stdout.write = (chunk: string | Uint8Array) => {
            stdoutData += chunk.toString();
            return true;
        };
        process.stderr.write = (chunk: string | Uint8Array) => {
            stderrData += chunk.toString();
            return true;
        };
        process.exitCode = undefined;
    });

    afterEach(() => {
        process.stdout.write = origStdoutWrite;
        process.stderr.write = origStderrWrite;
        process.exitCode = origExitCode;
    });

    it('skips browser when valid credential exists', async () => {
        const deps = createDeps();
        await deps.authManager.setCredential('test-api', {
            type: 'api-key',
            key: 'test-key-123',
            headerName: 'Authorization',
            headerPrefix: 'Bearer',
        });

        await runLogin(['api.test.com'], {}, deps);

        expect(stderrData).toContain('valid');
        expect(stderrData).toContain('skipping login');
        const output = JSON.parse(stdoutData);
        expect(output.source).toBe('stored');
        expect(output.provider).toBe('test-api');
        expect(process.exitCode).toBeUndefined();
    });

    it('goes to browser with --force even when valid credential exists', async () => {
        const deps = createDeps({ browserAvailable: false });
        await deps.authManager.setCredential('test-api', {
            type: 'api-key',
            key: 'test-key-123',
            headerName: 'Authorization',
            headerPrefix: 'Bearer',
        });

        await runLogin(['api.test.com'], { force: true }, deps);

        expect(stderrData).not.toContain('skipping login');
        expect(stderrData).toContain('[3/3]');
    });

    it('falls through to browser auth when no credential stored', async () => {
        const deps = createDeps();

        await runLogin(['api.test.com'], {}, deps);

        expect(stderrData).toContain('[1/3]');
        expect(stderrData).toContain('[3/3]');
    });

    it('manual --token bypasses cascade entirely', async () => {
        const deps = createDeps();

        await runLogin(['api.test.com'], { token: 'my-secret-token' }, deps);

        expect(stderrData).not.toContain('[1/3]');
        expect(stderrData).toContain('Token stored');
        expect(process.exitCode).toBeUndefined();
    });

    it('manual --cookie bypasses cascade entirely', async () => {
        const deps = createDeps();

        await runLogin(['https://api.test.com'], { cookie: 'session=abc123' }, deps);

        expect(stderrData).not.toContain('[1/3]');
        expect(stderrData).toContain('Cookie stored');
        expect(process.exitCode).toBeUndefined();
    });
});
