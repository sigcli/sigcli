import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProxyServer } from '../../../src/proxy/proxy-server.js';
import { CaManager } from '../../../src/proxy/ca-manager.js';
import { MemoryStorage } from '../../../src/storage/memory-storage.js';
import { ProviderRegistry } from '../../../src/providers/provider-registry.js';
import { StrategyRegistry } from '../../../src/strategies/registry.js';
import { ApiTokenStrategyFactory } from '../../../src/strategies/api-token.strategy.js';
import { CookieStrategyFactory } from '../../../src/strategies/cookie.strategy.js';
import { AuthManager } from '../../../src/auth-manager.js';
import type { AuthDeps } from '../../../src/deps.js';
import type { IBrowserAdapter } from '../../../src/core/interfaces/browser-adapter.js';
import type {
    ProviderConfig,
    ApiKeyCredential,
    CookieCredential,
} from '../../../src/core/types.js';
import type { SigConfig } from '../../../src/config/schema.js';

const testProvider: ProviderConfig = {
    id: 'test-provider',
    name: 'Test',
    domains: ['127.0.0.1'],
    strategy: 'api-token',
    strategyConfig: { strategy: 'api-token', headerName: 'Authorization', headerPrefix: 'Bearer' },
    proxy: {
        inject: [{ in: 'header', action: 'set', name: 'authorization', from: 'credential.key' }],
    },
};

function makeMinimalConfig(): SigConfig {
    return {
        mode: 'browserless',
        providers: {},
        storage: { credentialsDir: '~/.sig/credentials' },
        browser: {
            browserDataDir: '/tmp',
            channel: 'chrome',
            headlessTimeout: 30000,
            visibleTimeout: 120000,
            waitUntil: 'load',
        },
    } as unknown as SigConfig;
}

function makeAuthDeps(providers: ProviderConfig[] = [], storage = new MemoryStorage()): AuthDeps {
    const strategyRegistry = new StrategyRegistry();
    strategyRegistry.register(new ApiTokenStrategyFactory());
    strategyRegistry.register(new CookieStrategyFactory());
    const providerRegistry = new ProviderRegistry(providers);
    const authManager = new AuthManager({
        storage,
        strategyRegistry,
        providerRegistry,
        browserAdapterFactory: () => ({}) as IBrowserAdapter,
        browserConfig: {
            browserDataDir: '/tmp',
            channel: 'chrome',
            headlessTimeout: 30000,
            visibleTimeout: 120000,
            waitUntil: 'load',
        },
    });
    return {
        authManager,
        storage,
        providerRegistry,
        strategyRegistry,
        config: makeMinimalConfig(),
        browserAvailable: false,
    };
}

function makeRequest(
    proxyPort: number,
    targetHost: string,
    targetPort: number,
    path = '/',
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                hostname: '127.0.0.1',
                port: proxyPort,
                method: 'GET',
                path: `http://${targetHost}:${targetPort}${path}`,
                headers: { host: `${targetHost}:${targetPort}` },
            },
            (res) => {
                let body = '';
                res.on('data', (chunk: Buffer) => (body += chunk.toString()));
                res.on('end', () =>
                    resolve({ status: res.statusCode ?? 0, headers: res.headers, body }),
                );
            },
        );
        req.on('error', reject);
        req.end();
    });
}

function makePostRequest(
    proxyPort: number,
    targetHost: string,
    targetPort: number,
    formBody: string,
    path = '/',
): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
        const bodyBuf = Buffer.from(formBody);
        const req = http.request(
            {
                hostname: '127.0.0.1',
                port: proxyPort,
                method: 'POST',
                path: `http://${targetHost}:${targetPort}${path}`,
                headers: {
                    host: `${targetHost}:${targetPort}`,
                    'content-type': 'application/x-www-form-urlencoded',
                    'content-length': String(bodyBuf.length),
                },
            },
            (res) => {
                let body = '';
                res.on('data', (chunk: Buffer) => (body += chunk.toString()));
                res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
            },
        );
        req.on('error', reject);
        req.write(bodyBuf);
        req.end();
    });
}

describe('ProxyServer', () => {
    let dir: string;
    let caManager: CaManager;
    let upstream: http.Server;
    let upstreamPort: number;

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), 'sigcli-proxy-test-'));
        caManager = new CaManager(dir);

        // Start a simple upstream HTTP server
        upstream = http.createServer((req, res) => {
            res.writeHead(200, { 'content-type': 'text/plain' });
            res.end(JSON.stringify({ receivedHeaders: req.headers }));
        });
        await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
        upstreamPort = (upstream.address() as { port: number }).port;
    });

    afterEach(async () => {
        await new Promise<void>((resolve) => upstream.close(() => resolve()));
        await rm(dir, { recursive: true, force: true });
    });

    it('starts and listens on port 0', async () => {
        const proxy = new ProxyServer({ port: 0, authDeps: makeAuthDeps(), caManager });
        const { port } = await proxy.start();
        expect(port).toBeGreaterThan(0);
        await proxy.stop();
    });

    it('proxies plain HTTP request without provider (passthrough)', async () => {
        const proxy = new ProxyServer({ port: 0, authDeps: makeAuthDeps(), caManager });
        const { port: proxyPort } = await proxy.start();

        const result = await makeRequest(proxyPort, '127.0.0.1', upstreamPort);
        expect(result.status).toBe(200);

        await proxy.stop();
    });

    it('injects auth headers when provider matches', async () => {
        const storage = new MemoryStorage();
        const credential: ApiKeyCredential = { type: 'api-key', key: 'test-token-xyz' };
        await storage.set('test-provider', { credential, providerId: 'test-provider' });

        const deps = makeAuthDeps([testProvider], storage);
        const proxy = new ProxyServer({ port: 0, authDeps: deps, caManager });
        const { port: proxyPort } = await proxy.start();

        const result = await makeRequest(proxyPort, '127.0.0.1', upstreamPort);
        expect(result.status).toBe(200);

        const body = JSON.parse(result.body) as { receivedHeaders: Record<string, string> };
        expect(body.receivedHeaders['authorization']).toBe('test-token-xyz');

        await proxy.stop();
    });

    it('injects token into POST body via proxy.inject rules', async () => {
        const storage = new MemoryStorage();
        const credential: CookieCredential = {
            type: 'cookie',
            cookies: [
                {
                    name: 'xoxd',
                    value: 'xoxd-abc',
                    domain: '127.0.0.1',
                    path: '/',
                    expires: -1,
                    httpOnly: true,
                    secure: false,
                },
            ],
            obtainedAt: new Date().toISOString(),
            localStorage: { 'xoxc-token': 'xoxc-xyz' },
        };
        const bodyProvider: ProviderConfig = {
            id: 'body-provider',
            name: 'Body',
            domains: ['127.0.0.1'],
            strategy: 'cookie',
            strategyConfig: { strategy: 'cookie' },
            proxy: {
                inject: [
                    {
                        in: 'body',
                        action: 'set',
                        name: 'token',
                        from: 'credential.localStorage.xoxc-token',
                    },
                ],
            },
        };

        await storage.set('body-provider', { credential, providerId: 'body-provider' });

        upstream.removeAllListeners('request');
        upstream.on('request', (req: http.IncomingMessage, res: http.ServerResponse) => {
            const chunks: Buffer[] = [];
            req.on('data', (chunk: Buffer) => chunks.push(chunk));
            req.on('end', () => {
                const received = Buffer.concat(chunks).toString();
                res.writeHead(200, { 'content-type': 'text/plain' });
                res.end(JSON.stringify({ receivedBody: received }));
            });
        });

        const deps = makeAuthDeps([bodyProvider], storage);
        const proxy = new ProxyServer({ port: 0, authDeps: deps, caManager });
        const { port: proxyPort } = await proxy.start();

        const result = await makePostRequest(proxyPort, '127.0.0.1', upstreamPort, 'field=value');
        expect(result.status).toBe(200);

        const parsed = JSON.parse(result.body) as { receivedBody: string };
        const params = new URLSearchParams(parsed.receivedBody);
        expect(params.get('field')).toBe('value');
        expect(params.get('token')).toBe('xoxc-xyz');

        await proxy.stop();
    });
});
