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

const cookieProvider: ProviderConfig = {
    id: 'test-cookie',
    name: 'Test Cookie',
    domains: ['cookie.test.com'],
    entryUrl: 'https://cookie.test.com/',
    strategy: 'cookie',
    strategyConfig: { strategy: 'cookie' },
};

const bearerProvider: ProviderConfig = {
    id: 'test-bearer',
    name: 'Test Bearer',
    domains: ['bearer.test.com'],
    entryUrl: 'https://bearer.test.com/',
    strategy: 'oauth2',
    strategyConfig: { strategy: 'oauth2' },
};

function createDeps(overrides: Partial<AuthDeps> = {}): AuthDeps {
    const storage = new MemoryStorage();
    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(apiTokenProvider);
    providerRegistry.register(cookieProvider);
    providerRegistry.register(bearerProvider);
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
        expect(stderrData).toMatch(/No command specified|No valid credentials/i);
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
        // 'nonexistent' is not in registry → zero-provider mode → no credentials → error
        await runRun(['nonexistent', 'echo'], {}, deps);
        expect(stderrData).toMatch(/No valid credentials found/i);
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
                ['test-api', 'sh', '-c', 'echo "HAS_KEY=${SIG_TEST_API_API_KEY:+yes}"'],
                {},
                deps,
            );
        } finally {
            process.stdout.write = origWrite;
        }

        expect(capturedOutput).toContain('HAS_KEY=yes');
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

    it('injects multiple providers with prefixed env vars', async () => {
        const deps = createDeps();
        await deps.authManager.setCredential('test-api', {
            type: 'api-key',
            key: 'apikey-abc',
            headerName: 'Authorization',
            headerPrefix: 'Bearer',
        });
        await deps.authManager.setCredential('test-bearer', {
            type: 'bearer',
            accessToken: 'bearer-xyz',
        });

        let capturedOutput = '';
        const origWrite = process.stdout.write.bind(process.stdout);
        process.stdout.write = (chunk: string | Uint8Array) => {
            capturedOutput += chunk.toString();
            return true;
        };

        try {
            await runRun(
                [
                    'test-api',
                    'test-bearer',
                    'sh',
                    '-c',
                    'echo "API=${SIG_TEST_API_API_KEY:+yes} TEAMS=${SIG_TEST_BEARER_TOKEN:+yes}"',
                ],
                {},
                deps,
            );
        } finally {
            process.stdout.write = origWrite;
        }

        expect(capturedOutput).toContain('API=yes');
        expect(capturedOutput).toContain('TEAMS=yes');
    });

    it('zero-provider mode injects all valid providers', async () => {
        const deps = createDeps();
        await deps.authManager.setCredential('test-api', {
            type: 'api-key',
            key: 'apikey-abc',
            headerName: 'Authorization',
            headerPrefix: 'Bearer',
        });
        await deps.authManager.setCredential('test-bearer', {
            type: 'bearer',
            accessToken: 'bearer-xyz',
        });

        let capturedOutput = '';
        const origWrite = process.stdout.write.bind(process.stdout);
        process.stdout.write = (chunk: string | Uint8Array) => {
            capturedOutput += chunk.toString();
            return true;
        };

        try {
            await runRun(
                [
                    'sh',
                    '-c',
                    'echo "API=${SIG_TEST_API_API_KEY:+yes} TEAMS=${SIG_TEST_BEARER_TOKEN:+yes}"',
                ],
                {},
                deps,
            );
        } finally {
            process.stdout.write = origWrite;
        }

        expect(capturedOutput).toContain('API=yes');
        expect(capturedOutput).toContain('TEAMS=yes');
    });

    it('zero-provider mode skips providers without credentials', async () => {
        const deps = createDeps();
        await deps.authManager.setCredential('test-api', {
            type: 'api-key',
            key: 'apikey-abc',
            headerName: 'Authorization',
            headerPrefix: 'Bearer',
        });
        // test-bearer has no credential stored

        let capturedOutput = '';
        const origWrite = process.stdout.write.bind(process.stdout);
        process.stdout.write = (chunk: string | Uint8Array) => {
            capturedOutput += chunk.toString();
            return true;
        };

        try {
            await runRun(
                [
                    'sh',
                    '-c',
                    'echo "API=${SIG_TEST_API_API_KEY:+yes} TEAMS=${SIG_TEST_BEARER_TOKEN:+yes}"',
                ],
                {},
                deps,
            );
        } finally {
            process.stdout.write = origWrite;
        }

        expect(capturedOutput).toContain('API=yes');
        expect(capturedOutput).not.toContain('TEAMS=yes');
    });

    it('zero-provider mode errors when no valid credentials', async () => {
        const deps = createDeps();
        // No credentials stored for any provider
        await runRun(['sh', '-c', 'echo hello'], {}, deps);
        expect(stderrData).toMatch(/No valid credentials found/i);
        expect(process.exitCode).toBe(1);
    });

    it('rejects provider IDs with invalid characters at registration', () => {
        const deps = createDeps();
        expect(() =>
            deps.providerRegistry.register({
                id: 'foo_bar',
                name: 'Foo_Bar',
                domains: ['foobar.com'],
                entryUrl: 'https://foobar.com/',
                strategy: 'api-token',
                strategyConfig: { strategy: 'api-token' },
            }),
        ).toThrow(/only lowercase letters, digits, and hyphens/);
    });
});
