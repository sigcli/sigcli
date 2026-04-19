import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthManager } from '../../../src/auth-manager.js';
import { MemoryStorage } from '../../../src/storage/memory-storage.js';
import { ProviderRegistry } from '../../../src/providers/provider-registry.js';
import { StrategyRegistry } from '../../../src/strategies/registry.js';
import { CookieStrategyFactory } from '../../../src/strategies/cookie.strategy.js';
import { OAuth2StrategyFactory } from '../../../src/strategies/oauth2.strategy.js';
import { ApiTokenStrategyFactory } from '../../../src/strategies/api-token.strategy.js';
import { BasicAuthStrategyFactory } from '../../../src/strategies/basic-auth.strategy.js';
import { runRun } from '../../../src/cli/commands/run.js';
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

describe('runRun', () => {
    let stderrData: string;
    const origStderrWrite = process.stderr.write.bind(process.stderr);
    const origExitCode = process.exitCode;

    beforeEach(() => {
        stderrData = '';
        process.stderr.write = (chunk: string | Uint8Array) => {
            stderrData += chunk.toString();
            return true;
        };
        process.exitCode = undefined;
    });

    afterEach(() => {
        process.stderr.write = origStderrWrite;
        process.exitCode = origExitCode;
    });

    it('fails with usage error when provider is missing', async () => {
        const deps = createDeps();
        await runRun([], {}, deps);
        expect(stderrData).toContain('provider');
        expect(process.exitCode).toBe(1);
    });

    it('fails with usage error when no command after provider', async () => {
        const deps = createDeps();
        await runRun(['test-api'], {}, deps);
        expect(stderrData).toMatch(/command|Usage/i);
        expect(process.exitCode).toBe(1);
    });

    it('fails with error message when provider not found', async () => {
        const deps = createDeps();
        await runRun(['nonexistent', 'echo'], {}, deps);
        expect(stderrData).toMatch(/not found|nonexistent/i);
        expect(process.exitCode).toBe(1);
    });

    it('suggests sig login when no credential stored', async () => {
        const deps = createDeps();
        await runRun(['test-api', 'echo', 'hello'], {}, deps);
        expect(stderrData).toMatch(/sig login/i);
        expect(process.exitCode).toBe(1);
    });

    it('spawns child and passes exit code 0', async () => {
        const deps = createDeps();
        await deps.authManager.setCredential('test-api', {
            type: 'api-key',
            key: 'test-key-12345',
            headerName: 'Authorization',
            headerPrefix: 'Bearer',
        });
        await runRun(['test-api', 'true'], {}, deps);
        expect(process.exitCode).toBeUndefined();
    });

    it('passes through non-zero exit code from child', async () => {
        const deps = createDeps();
        await deps.authManager.setCredential('test-api', {
            type: 'api-key',
            key: 'test-key-12345',
            headerName: 'Authorization',
            headerPrefix: 'Bearer',
        });
        await runRun(['test-api', 'sh', '-c', 'exit 42'], {}, deps);
        expect(process.exitCode).toBe(42);
    });

    it('injects SIG_* env vars into child environment', async () => {
        const deps = createDeps();
        await deps.authManager.setCredential('test-api', {
            type: 'api-key',
            key: 'test-key-12345',
            headerName: 'Authorization',
            headerPrefix: 'Bearer',
        });

        let capturedOutput = '';
        const origWrite = process.stdout.write.bind(process.stdout);
        process.stdout.write = (chunk: string | Uint8Array) => {
            capturedOutput += chunk.toString();
            return true;
        };

        try {
            await runRun(
                ['test-api', 'sh', '-c', 'echo SIG_API_KEY=$SIG_API_KEY'],
                { 'no-redaction': true },
                deps,
            );
        } finally {
            process.stdout.write = origWrite;
        }

        expect(capturedOutput).toContain('SIG_API_KEY=test-key-12345');
    });

    it('redacts credential values from child output by default', async () => {
        const deps = createDeps();
        await deps.authManager.setCredential('test-api', {
            type: 'api-key',
            key: 'supersecretkey9999',
            headerName: 'Authorization',
            headerPrefix: 'Bearer',
        });

        let capturedOutput = '';
        const origWrite = process.stdout.write.bind(process.stdout);
        process.stdout.write = (chunk: string | Uint8Array) => {
            capturedOutput += chunk.toString();
            return true;
        };

        try {
            await runRun(['test-api', 'sh', '-c', 'echo supersecretkey9999'], {}, deps);
        } finally {
            process.stdout.write = origWrite;
        }

        expect(capturedOutput).not.toContain('supersecretkey9999');
        expect(capturedOutput).toContain('****');
    });
});
