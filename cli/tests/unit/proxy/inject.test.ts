import { describe, it, expect } from 'vitest';
import { resolveFrom, applyInjectRules } from '../../../src/proxy/inject.js';
import type { CookieCredential, BearerCredential } from '../../../src/core/types.js';

const cookieCred: CookieCredential = {
    type: 'cookie',
    cookies: [
        {
            name: 'xoxd',
            value: 'xoxd-abc',
            domain: 'slack.com',
            path: '/',
            expires: -1,
            httpOnly: true,
            secure: true,
        },
        {
            name: 'session',
            value: 'sess-123',
            domain: 'slack.com',
            path: '/',
            expires: -1,
            httpOnly: true,
            secure: true,
        },
    ],
    obtainedAt: '2026-01-01T00:00:00Z',
    xHeaders: { 'x-sig': 'sig-value' },
    localStorage: { 'xoxc-token': 'xoxc-xyz' },
};

const bearerCred: BearerCredential = {
    type: 'bearer',
    accessToken: 'my-token',
    obtainedAt: '2026-01-01T00:00:00Z',
    localStorage: { 'app-token': 'app-val' },
};

describe('resolveFrom', () => {
    it('returns joined cookie string for credential.cookies', () => {
        expect(resolveFrom(cookieCred, 'credential.cookies')).toBe(
            'xoxd=xoxd-abc; session=sess-123',
        );
    });

    it('returns null for credential.cookies on non-cookie credential', () => {
        expect(resolveFrom(bearerCred, 'credential.cookies')).toBeNull();
    });

    it('returns accessToken for bearer credential', () => {
        expect(resolveFrom(bearerCred, 'credential.accessToken')).toBe('my-token');
    });

    it('returns null for credential.accessToken on cookie credential', () => {
        expect(resolveFrom(cookieCred, 'credential.accessToken')).toBeNull();
    });

    it('resolves credential.localStorage.<key>', () => {
        expect(resolveFrom(cookieCred, 'credential.localStorage.xoxc-token')).toBe('xoxc-xyz');
    });

    it('resolves credential.xHeaders.<name>', () => {
        expect(resolveFrom(cookieCred, 'credential.xHeaders.x-sig')).toBe('sig-value');
    });

    it('returns null for missing localStorage key', () => {
        expect(resolveFrom(cookieCred, 'credential.localStorage.missing')).toBeNull();
    });

    it('returns null for path without credential. prefix', () => {
        expect(resolveFrom(cookieCred, 'cookies')).toBeNull();
    });

    it('returns null for unknown path', () => {
        expect(resolveFrom(cookieCred, 'credential.unknown')).toBeNull();
    });
});

describe('applyInjectRules', () => {
    const baseHeaders = { 'content-type': 'text/html' };

    it('sets a header', () => {
        const { headers } = applyInjectRules(
            [
                {
                    in: 'header',
                    action: 'set',
                    name: 'authorization',
                    from: 'credential.accessToken',
                },
            ],
            bearerCred,
            baseHeaders,
            undefined,
            undefined,
            'https://example.com/',
        );
        expect(headers['authorization']).toBe('my-token');
    });

    it('appends to existing header', () => {
        const initial = { cookie: 'existing=val' };
        const { headers } = applyInjectRules(
            [{ in: 'header', action: 'append', name: 'cookie', from: 'credential.cookies' }],
            cookieCred,
            initial,
            undefined,
            undefined,
            'https://example.com/',
        );
        expect(headers['cookie']).toBe('existing=val; xoxd=xoxd-abc; session=sess-123');
    });

    it('removes a header', () => {
        const initial = { 'x-custom': 'value' };
        const { headers } = applyInjectRules(
            [{ in: 'header', action: 'remove', name: 'x-custom' }],
            bearerCred,
            initial,
            undefined,
            undefined,
            'https://example.com/',
        );
        expect(headers['x-custom']).toBeUndefined();
    });

    it('injects into urlencoded body', () => {
        const body = Buffer.from('field1=value1');
        const { body: outBody } = applyInjectRules(
            [{ in: 'body', action: 'set', name: 'token', from: 'credential.accessToken' }],
            bearerCred,
            baseHeaders,
            body,
            'application/x-www-form-urlencoded',
            'https://example.com/',
        );
        const params = new URLSearchParams(outBody!.toString());
        expect(params.get('field1')).toBe('value1');
        expect(params.get('token')).toBe('my-token');
    });

    it('injects into json body', () => {
        const body = Buffer.from(JSON.stringify({ existing: true }));
        const { body: outBody } = applyInjectRules(
            [{ in: 'body', action: 'set', name: 'token', from: 'credential.accessToken' }],
            bearerCred,
            baseHeaders,
            body,
            'application/json',
            'https://example.com/',
        );
        const parsed = JSON.parse(outBody!.toString()) as Record<string, unknown>;
        expect(parsed['existing']).toBe(true);
        expect(parsed['token']).toBe('my-token');
    });

    it('injects into query params', () => {
        const { url } = applyInjectRules(
            [{ in: 'query', action: 'set', name: 'access_token', from: 'credential.accessToken' }],
            bearerCred,
            baseHeaders,
            undefined,
            undefined,
            'https://example.com/api?foo=bar',
        );
        const parsed = new URL(url);
        expect(parsed.searchParams.get('foo')).toBe('bar');
        expect(parsed.searchParams.get('access_token')).toBe('my-token');
    });
});
