import { fetch } from 'undici';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProviderConfig } from '../../../src/types/types.js';
import { validate } from '../../../src/utils/credential-validator.js';

vi.mock('undici', () => ({
    fetch: vi.fn(),
    ProxyAgent: vi.fn(),
    Socks5ProxyAgent: vi.fn(),
}));

const mockFetch = vi.mocked(fetch);

function makeProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
    return {
        id: 'test',
        name: 'Test',
        domains: ['example.com'],
        entryUrl: 'https://example.com/',
        strategy: 'browser',
        extract: [{ from: 'cookies', as: 'cookie', match: '*' }],
        apply: [{ in: 'header', name: 'Cookie', value: '${cookie}' }],
        ...overrides,
    } as ProviderConfig;
}

function mockResponse(status: number, body: string, headers?: Record<string, string>) {
    return {
        status,
        headers: new Map(Object.entries(headers ?? {})),
        text: () => Promise.resolve(body),
    };
}

describe('validate — JS redirect detection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('rejects 200 with window.location redirect', async () => {
        const body = `<html><body><script>window.location.href = '/approuter/v1/redirect?url=%2F';</script></body></html>`;
        mockFetch.mockResolvedValue(mockResponse(200, body) as any);

        const result = await validate(makeProvider(), { cookie: 'session=abc' });
        expect(result).toBe(false);
    });

    it('rejects 200 with document.location redirect', async () => {
        const body = `<script>document.location = 'https://sso.example.com/auth';</script>`;
        mockFetch.mockResolvedValue(mockResponse(200, body) as any);

        const result = await validate(makeProvider(), { cookie: 'session=abc' });
        expect(result).toBe(false);
    });

    it('rejects 200 with meta http-equiv refresh', async () => {
        const body = `<html><head><meta http-equiv='refresh' content='0;url=/login'/></head></html>`;
        mockFetch.mockResolvedValue(mockResponse(200, body) as any);

        const result = await validate(makeProvider(), { cookie: 'session=abc' });
        expect(result).toBe(false);
    });

    it('rejects 200 with location.replace()', async () => {
        const body = `<script>location.replace('/sso/authorize');</script>`;
        mockFetch.mockResolvedValue(mockResponse(200, body) as any);

        const result = await validate(makeProvider(), { cookie: 'session=abc' });
        expect(result).toBe(false);
    });

    it('rejects 200 with bare location= assignment (SAP approuter)', async () => {
        const body = `<html><head><script>document.cookie="sig=x;path=/;";location="https://sso.example.com/oauth/authorize"</script></head></html>`;
        mockFetch.mockResolvedValue(mockResponse(200, body) as any);

        const result = await validate(makeProvider(), { cookie: 'session=abc' });
        expect(result).toBe(false);
    });

    it('accepts 200 with large body even if it contains window.location', async () => {
        const body = 'x'.repeat(4096) + `<script>window.location.href = '/home';</script>`;
        mockFetch.mockResolvedValue(mockResponse(200, body) as any);

        const result = await validate(makeProvider(), { cookie: 'session=abc' });
        expect(result).toBe(true);
    });

    it('accepts 200 with normal HTML content', async () => {
        const body = `<html><body><h1>Dashboard</h1><p>Welcome back!</p></body></html>`;
        mockFetch.mockResolvedValue(mockResponse(200, body) as any);

        const result = await validate(makeProvider(), { cookie: 'session=abc' });
        expect(result).toBe(true);
    });

    it('accepts 200 with empty body', async () => {
        mockFetch.mockResolvedValue(mockResponse(200, '') as any);

        const result = await validate(makeProvider(), { cookie: 'session=abc' });
        expect(result).toBe(true);
    });

    it('rejects empty credentials', async () => {
        const result = await validate(makeProvider(), {});
        expect(result).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rejects 401 response', async () => {
        mockFetch.mockResolvedValue(mockResponse(401, 'Unauthorized') as any);

        const result = await validate(makeProvider(), { cookie: 'session=abc' });
        expect(result).toBe(false);
    });

    it('rejects 3xx redirect to login URL', async () => {
        mockFetch.mockResolvedValue(
            mockResponse(302, '', { location: 'https://example.com/login?next=/' }) as any,
        );

        const result = await validate(makeProvider(), { cookie: 'session=abc' });
        expect(result).toBe(false);
    });
});
