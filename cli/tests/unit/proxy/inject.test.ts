import { describe, it, expect } from 'vitest';
import { resolveFrom, applyInjectRules } from '../../../src/proxy/inject.js';
import type { ExtractedCredentials } from '../../../src/types/interfaces/strategy.js';

const cookieCred: ExtractedCredentials = {
    session: 'xoxd=xoxd-abc; session=sess-123',
    'xoxc-token': 'xoxc-xyz',
};

const bearerCred: ExtractedCredentials = {
    access_token: 'my-token',
    'app-token': 'app-val',
};

describe('resolveFrom', () => {
    it('returns session for credential.cookies (legacy path)', () => {
        expect(resolveFrom(cookieCred, 'credential.cookies')).toBe(
            'xoxd=xoxd-abc; session=sess-123',
        );
    });

    it('returns null for credential.cookies when no session key', () => {
        expect(resolveFrom(bearerCred, 'credential.cookies')).toBeNull();
    });

    it('returns access_token for credential.accessToken (legacy path)', () => {
        expect(resolveFrom(bearerCred, 'credential.accessToken')).toBe('my-token');
    });

    it('returns null for credential.accessToken when key missing', () => {
        expect(resolveFrom(cookieCred, 'credential.accessToken')).toBeNull();
    });

    it('resolves credential.localStorage.<key> to flat key', () => {
        expect(resolveFrom(cookieCred, 'credential.localStorage.xoxc-token')).toBe('xoxc-xyz');
    });

    it('returns null for missing localStorage key', () => {
        expect(resolveFrom(cookieCred, 'credential.localStorage.missing')).toBeNull();
    });

    it('returns null for path without credential. prefix when key missing', () => {
        expect(resolveFrom(cookieCred, 'nonexistent')).toBeNull();
    });

    it('resolves direct key lookup', () => {
        expect(resolveFrom(bearerCred, 'access_token')).toBe('my-token');
        expect(resolveFrom(bearerCred, 'app-token')).toBe('app-val');
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
