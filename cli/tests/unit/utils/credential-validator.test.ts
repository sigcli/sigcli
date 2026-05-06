import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';

import type { ProviderConfig } from '../../../src/types/index.js';
import { validate } from '../../../src/utils/credential-validator.js';

function makeProvider(port: number, overrides: Partial<ProviderConfig> = {}): ProviderConfig {
    return {
        id: 'test',
        name: 'test',
        strategy: 'browser',
        domains: ['127.0.0.1'],
        entryUrl: `http://127.0.0.1:${port}/`,
        extract: [],
        apply: [{ in: 'header', name: 'Cookie', value: '${session}' }],
        ...overrides,
    } as ProviderConfig;
}

describe('validate()', () => {
    let server: http.Server;
    let port: number;

    afterEach(() => {
        server?.close();
    });

    function startServer(handler: http.RequestListener): Promise<void> {
        server = http.createServer(handler);
        return new Promise((r) =>
            server.listen(0, '127.0.0.1', () => {
                port = (server.address() as { port: number }).port;
                r();
            }),
        );
    }

    it('returns false for empty credentials', async () => {
        expect(await validate(makeProvider(0), {})).toBe(false);
        expect(await validate(makeProvider(0), null as any)).toBe(false);
    });

    it('returns true when no entryUrl/validateUrl configured', async () => {
        const provider = { ...makeProvider(0), entryUrl: '', validateUrl: undefined } as any;
        expect(await validate(provider, { session: 'abc' })).toBe(true);
    });

    it('returns true on 200 response', async () => {
        await startServer((_req, res) => {
            res.writeHead(200);
            res.end('OK');
        });
        expect(await validate(makeProvider(port), { session: 'valid' })).toBe(true);
    });

    it('returns false on persistent 401', async () => {
        await startServer((_req, res) => {
            res.writeHead(401);
            res.end();
        });
        expect(await validate(makeProvider(port), { session: 'expired' })).toBe(false);
    });

    it('returns false on persistent 403', async () => {
        await startServer((_req, res) => {
            res.writeHead(403);
            res.end();
        });
        expect(await validate(makeProvider(port), { session: 'expired' })).toBe(false);
    });

    it('retries once on transient 401 then succeeds', async () => {
        let count = 0;
        await startServer((_req, res) => {
            count++;
            if (count === 1) {
                res.writeHead(401);
                res.end();
            } else {
                res.writeHead(200);
                res.end('OK');
            }
        });
        expect(await validate(makeProvider(port), { session: 'valid' })).toBe(true);
        expect(count).toBe(2);
    });

    it('returns false on redirect to login URL', async () => {
        await startServer((_req, res) => {
            res.writeHead(302, { Location: 'https://sso.example.com/login?redirect=/' });
            res.end();
        });
        expect(await validate(makeProvider(port), { session: 'expired' })).toBe(false);
    });

    it('returns true on redirect to non-login URL', async () => {
        await startServer((_req, res) => {
            res.writeHead(302, { Location: 'https://example.com/dashboard' });
            res.end();
        });
        expect(await validate(makeProvider(port), { session: 'valid' })).toBe(true);
    });

    it('returns false on any redirect when validateUrl is set', async () => {
        await startServer((_req, res) => {
            res.writeHead(302, { Location: 'https://example.com/dashboard' });
            res.end();
        });
        const provider = makeProvider(port, {
            validateUrl: `http://127.0.0.1:${port}/api/me`,
        });
        expect(await validate(provider, { session: 'expired' })).toBe(false);
    });

    it('returns false on network error (DNS failure)', async () => {
        const provider = makeProvider(0, { entryUrl: 'https://nonexistent.invalid/' });
        expect(await validate(provider, { session: 'stale' })).toBe(false);
    });

    it('returns true on 503 (server error treated as valid)', async () => {
        await startServer((_req, res) => {
            res.writeHead(503);
            res.end();
        });
        expect(await validate(makeProvider(port), { session: 'valid' })).toBe(true);
    });
});
