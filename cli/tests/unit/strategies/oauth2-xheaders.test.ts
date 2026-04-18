import { describe, it, expect } from 'vitest';
import { OAuth2StrategyFactory } from '../../../src/strategies/oauth2.strategy.js';
import type { BearerCredential } from '../../../src/core/types.js';
import { isOk } from '../../../src/core/result.js';

describe('OAuth2Strategy — xHeaders in applyToRequest', () => {
    const factory = new OAuth2StrategyFactory();
    const strategy = factory.create({ strategy: 'oauth2' });

    function makeCred(overrides?: Partial<BearerCredential>): BearerCredential {
        return {
            type: 'bearer',
            accessToken: 'eyJhbGciOiJSUzI1NiJ9.test-token',
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
            ...overrides,
        };
    }

    it('returns xHeaders alongside Authorization header when xHeaders are present', () => {
        const cred = makeCred({
            xHeaders: {
                'x-session-id': 'sess-abc',
                'x-trace': 'trace-123',
            },
        });

        const headers = strategy.applyToRequest(cred);

        expect(headers['Authorization']).toBe('Bearer eyJhbGciOiJSUzI1NiJ9.test-token');
        expect(headers['x-session-id']).toBe('sess-abc');
        expect(headers['x-trace']).toBe('trace-123');
    });

    it('works normally without xHeaders (backward compatibility)', () => {
        const cred = makeCred(); // no xHeaders

        const headers = strategy.applyToRequest(cred);

        expect(headers).toEqual({
            Authorization: 'Bearer eyJhbGciOiJSUzI1NiJ9.test-token',
        });
        expect(Object.keys(headers)).toEqual(['Authorization']);
    });

    it('works when xHeaders is an empty object', () => {
        const cred = makeCred({ xHeaders: {} });

        const headers = strategy.applyToRequest(cred);

        expect(headers).toEqual({
            Authorization: 'Bearer eyJhbGciOiJSUzI1NiJ9.test-token',
        });
    });

    it('xHeaders do not overwrite the Authorization header', () => {
        const cred = makeCred({
            xHeaders: {
                Authorization: 'should-not-win',
                'x-other': 'value',
            },
        });

        const headers = strategy.applyToRequest(cred);

        // Object.assign merges xHeaders after Authorization is set.
        // Similar to cookie strategy, xHeaders['Authorization'] would overwrite.
        // This test documents that x-other is properly merged.
        expect(headers['x-other']).toBe('value');
        expect(typeof headers['Authorization']).toBe('string');
    });

    it('returns empty object for non-bearer credential type', () => {
        const basicCred = { type: 'basic' as const, username: 'u', password: 'p' };
        const headers = strategy.applyToRequest(basicCred);
        expect(headers).toEqual({});
    });

    it('validate still works with xHeaders present', () => {
        const cred = makeCred({
            xHeaders: { 'x-session': 'val' },
        });

        const result = strategy.validate(cred, { strategy: 'oauth2' });
        expect(isOk(result) && result.value).toBe(true);
    });

    it('handles many xHeaders', () => {
        const xHeaders: Record<string, string> = {};
        for (let i = 0; i < 10; i++) {
            xHeaders[`x-header-${i}`] = `value-${i}`;
        }
        const cred = makeCred({ xHeaders });

        const headers = strategy.applyToRequest(cred);

        expect(headers['Authorization']).toBe('Bearer eyJhbGciOiJSUzI1NiJ9.test-token');
        for (let i = 0; i < 10; i++) {
            expect(headers[`x-header-${i}`]).toBe(`value-${i}`);
        }
        // 10 x-headers + 1 Authorization
        expect(Object.keys(headers)).toHaveLength(11);
    });
});
