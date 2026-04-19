import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthManager } from '../../../src/auth-manager.js';
import { MemoryStorage } from '../../../src/storage/memory-storage.js';
import { ProviderRegistry } from '../../../src/providers/provider-registry.js';
import { StrategyRegistry } from '../../../src/strategies/registry.js';
import { CookieStrategyFactory } from '../../../src/strategies/cookie.strategy.js';
import { OAuth2StrategyFactory } from '../../../src/strategies/oauth2.strategy.js';
import { ApiTokenStrategyFactory } from '../../../src/strategies/api-token.strategy.js';
import { BasicAuthStrategyFactory } from '../../../src/strategies/basic-auth.strategy.js';
import { runCascade } from '../../../src/cli/commands/cascade.js';
import type { AuthDeps } from '../../../src/deps.js';
import type {
    ProviderConfig,
    ApiKeyCredential,
    CookieCredential,
} from '../../../src/core/types.js';
import type { IBrowserAdapter } from '../../../src/core/interfaces/browser-adapter.js';
import type { BrowserConfig, SigConfig } from '../../../src/config/schema.js';

const browserConfig: BrowserConfig = {
    browserDataDir: '/tmp/test-browser-data',
    channel: 'chrome',
    headlessTimeout: 30_000,
    visibleTimeout: 120_000,
    waitUntil: 'load',
};

const cookieProvider: ProviderConfig = {
    id: 'example',
    name: 'Example',
    domains: ['example.com'],
    entryUrl: 'https://example.com/',
    strategy: 'cookie',
    strategyConfig: { strategy: 'cookie' },
};

const apiTokenProvider: ProviderConfig = {
    id: 'api-app',
    name: 'API App',
    domains: ['api.example.com'],
    strategy: 'api-token',
    strategyConfig: { strategy: 'api-token', headerName: 'Authorization', headerPrefix: 'Bearer' },
};

function createDeps(overrides?: {
    browserAvailable?: boolean;
    providers?: ProviderConfig[];
}): AuthDeps {
    const storage = new MemoryStorage();
    const strategyRegistry = new StrategyRegistry();
    strategyRegistry.register(new CookieStrategyFactory());
    strategyRegistry.register(new OAuth2StrategyFactory());
    strategyRegistry.register(new ApiTokenStrategyFactory());
    strategyRegistry.register(new BasicAuthStrategyFactory());

    const providers = overrides?.providers ?? [cookieProvider, apiTokenProvider];
    const providerRegistry = new ProviderRegistry(providers);

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

    return {
        authManager,
        storage,
        providerRegistry,
        strategyRegistry,
        config,
        browserAvailable: overrides?.browserAvailable ?? true,
    };
}

describe('runCascade', () => {
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

    it('prints usage and sets exit code when no url provided', async () => {
        const deps = createDeps();
        await runCascade([], {}, deps);
        expect(process.exitCode).toBe(1);
        expect(stderrChunks.join('')).toContain('Usage: sig cascade <url>');
    });

    it('errors when provider not found for non-url input', async () => {
        const deps = createDeps();
        await runCascade(['unknown-provider-xyz'], {}, deps);
        expect(process.exitCode).toBe(1);
        expect(stderrChunks.join('')).toContain('No provider found');
    });

    it('uses stored credential when valid — no browser triggered', async () => {
        const deps = createDeps({ providers: [apiTokenProvider] });
        const apiKeyCredential: ApiKeyCredential = {
            type: 'api-key',
            key: 'secret-token',
            headerName: 'Authorization',
            headerPrefix: 'Bearer',
        };
        await deps.authManager.setCredential('api-app', apiKeyCredential);

        const forceReauthSpy = vi.spyOn(deps.authManager, 'forceReauth');

        await runCascade(['https://api.example.com/'], {}, deps);

        expect(forceReauthSpy).not.toHaveBeenCalled();
        expect(process.exitCode).toBeUndefined();
        const stderr = stderrChunks.join('');
        expect(stderr).toContain('valid');
        expect(stderr).toContain('stored credential');
        const stdout = stdoutChunks.join('');
        const json = JSON.parse(stdout);
        expect(json.source).toBe('stored');
        expect(json.provider).toBe('api-app');
    });

    it('shows step-by-step progress output', async () => {
        const deps = createDeps({ providers: [apiTokenProvider] });
        const apiKeyCredential: ApiKeyCredential = {
            type: 'api-key',
            key: 'test-token',
            headerName: 'Authorization',
            headerPrefix: 'Bearer',
        };
        await deps.authManager.setCredential('api-app', apiKeyCredential);

        await runCascade(['https://api.example.com/'], {}, deps);

        const stderr = stderrChunks.join('');
        expect(stderr).toMatch(/\[1\/3\]/);
        expect(stderr).toContain('Checking stored credentials');
    });

    it('falls through to browser when no credential exists', async () => {
        const deps = createDeps({ providers: [cookieProvider] });
        const forceReauthSpy = vi.spyOn(deps.authManager, 'forceReauth').mockResolvedValue({
            ok: true,
            value: {
                type: 'cookie',
                cookies: [
                    {
                        name: 'session',
                        value: 'abc',
                        domain: 'example.com',
                        path: '/',
                        expires: -1,
                        httpOnly: false,
                        secure: true,
                    },
                ],
                obtainedAt: new Date().toISOString(),
            },
        } as { ok: true; value: CookieCredential });

        await runCascade(['https://example.com/'], {}, deps);

        expect(forceReauthSpy).toHaveBeenCalledWith('example');
        expect(process.exitCode).toBeUndefined();
        const stdout = stdoutChunks.join('');
        const json = JSON.parse(stdout);
        expect(json.source).toBe('browser');
    });

    it('fails gracefully when browser unavailable and no stored credential', async () => {
        const deps = createDeps({ providers: [cookieProvider], browserAvailable: false });

        await runCascade(['https://example.com/'], {}, deps);

        expect(process.exitCode).toBe(1);
        const stderr = stderrChunks.join('');
        expect(stderr).toContain('Browser is not available');
        expect(stderr).toContain('--cookie');
        expect(stderr).toContain('--token');
    });

    it('reports failure when browser auth fails', async () => {
        const deps = createDeps({ providers: [cookieProvider] });
        vi.spyOn(deps.authManager, 'forceReauth').mockResolvedValue({
            ok: false,
            error: { message: 'Browser timeout', code: 'BROWSER_TIMEOUT' } as never,
        });

        await runCascade(['https://example.com/'], {}, deps);

        expect(process.exitCode).toBe(1);
        const stderr = stderrChunks.join('');
        expect(stderr).toContain('Authentication failed');
        expect(stderr).toContain('Browser timeout');
    });
});
