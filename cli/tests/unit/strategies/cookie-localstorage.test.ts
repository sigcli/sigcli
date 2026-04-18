import { describe, it, expect } from 'vitest';
import { CookieStrategyFactory } from '../../../src/strategies/cookie.strategy.js';
import type { CookieCredential, Cookie } from '../../../src/core/types.js';
import { isOk } from '../../../src/core/result.js';

describe('CookieStrategy — localStorage on credential', () => {
    const factory = new CookieStrategyFactory();
    const strategy = factory.create({ strategy: 'cookie', ttl: '24h' });

    function makeCookie(overrides?: Partial<Cookie>): Cookie {
        return {
            name: 'session',
            value: 'abc123',
            domain: 'example.com',
            path: '/',
            expires: -1,
            httpOnly: true,
            secure: true,
            ...overrides,
        };
    }

    function makeCred(overrides?: Partial<CookieCredential>): CookieCredential {
        return {
            type: 'cookie',
            cookies: [makeCookie()],
            obtainedAt: new Date().toISOString(),
            ...overrides,
        };
    }

    it('validate works with localStorage present on credential', () => {
        const cred = makeCred({
            localStorage: { 'xoxc-token': 'xoxc-abc123' },
        });

        const result = strategy.validate(cred, { strategy: 'cookie' });
        expect(isOk(result) && result.value).toBe(true);
    });

    it('applyToRequest does NOT include localStorage in headers (backward compat)', () => {
        const cred = makeCred({
            localStorage: { 'xoxc-token': 'xoxc-abc123' },
        });

        const headers = strategy.applyToRequest(cred);

        // localStorage values should NOT be applied as HTTP headers
        expect(headers).toEqual({ Cookie: 'session=abc123' });
        expect(headers['xoxc-token']).toBeUndefined();
    });

    it('credential with both xHeaders and localStorage', () => {
        const cred = makeCred({
            xHeaders: { 'x-custom': 'header-val' },
            localStorage: { 'xoxc-token': 'xoxc-abc123' },
        });

        const headers = strategy.applyToRequest(cred);

        // xHeaders should be applied, localStorage should not
        expect(headers['Cookie']).toBe('session=abc123');
        expect(headers['x-custom']).toBe('header-val');
        expect(headers['xoxc-token']).toBeUndefined();
    });

    it('validate works with empty localStorage', () => {
        const cred = makeCred({
            localStorage: {},
        });

        const result = strategy.validate(cred, { strategy: 'cookie' });
        expect(isOk(result) && result.value).toBe(true);
    });

    it('validate works without localStorage (backward compat)', () => {
        const cred = makeCred(); // no localStorage field

        const result = strategy.validate(cred, { strategy: 'cookie' });
        expect(isOk(result) && result.value).toBe(true);
    });
});
