import { describe, it, expect } from 'vitest';
import { OAuth2StrategyFactory } from '../../../src/strategies/oauth2.strategy.js';
import type { BearerCredential } from '../../../src/core/types.js';
import { isOk } from '../../../src/core/result.js';

describe('OAuth2Strategy — localStorage on credential', () => {
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

    it('validate works with localStorage present on credential', () => {
        const cred = makeCred({
            localStorage: { 'xoxc-token': 'xoxc-abc123' },
        });

        const result = strategy.validate(cred, { strategy: 'oauth2' });
        expect(isOk(result) && result.value).toBe(true);
    });

    it('applyToRequest does NOT include localStorage in headers', () => {
        const cred = makeCred({
            localStorage: { 'xoxc-token': 'xoxc-abc123' },
        });

        const headers = strategy.applyToRequest(cred);

        expect(headers['Authorization']).toBe('Bearer eyJhbGciOiJSUzI1NiJ9.test-token');
        expect(headers['xoxc-token']).toBeUndefined();
    });

    it('credential with both xHeaders and localStorage', () => {
        const cred = makeCred({
            xHeaders: { 'x-custom': 'header-val' },
            localStorage: { 'xoxc-token': 'xoxc-abc123' },
        });

        const headers = strategy.applyToRequest(cred);

        // xHeaders should be applied, localStorage should not
        expect(headers['Authorization']).toBe('Bearer eyJhbGciOiJSUzI1NiJ9.test-token');
        expect(headers['x-custom']).toBe('header-val');
        expect(headers['xoxc-token']).toBeUndefined();
    });

    it('validate works with empty localStorage', () => {
        const cred = makeCred({
            localStorage: {},
        });

        const result = strategy.validate(cred, { strategy: 'oauth2' });
        expect(isOk(result) && result.value).toBe(true);
    });

    it('validate works without localStorage (backward compat)', () => {
        const cred = makeCred(); // no localStorage field

        const result = strategy.validate(cred, { strategy: 'oauth2' });
        expect(isOk(result) && result.value).toBe(true);
    });
});

describe('OAuth2Strategy — localStorage preserved during refresh', () => {
    const factory = new OAuth2StrategyFactory();

    it('preserves localStorage on refreshed credential', async () => {
        const strategy = factory.create({
            strategy: 'oauth2',
            tokenEndpoint: 'https://auth.example.com/token',
            clientId: 'test-client',
        });

        const original = makeCred({
            refreshToken: 'refresh-abc',
            tokenEndpoint: 'https://auth.example.com/token',
            localStorage: { 'session-key': 'session-value', 'user-token': 'tok-123' },
        });

        // Mock fetch to return a valid token response
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () =>
            new Response(
                JSON.stringify({
                    access_token: 'new-access-token',
                    refresh_token: 'new-refresh-token',
                    expires_in: 3600,
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            );

        try {
            const result = await strategy.refresh(original, { strategy: 'oauth2' });
            expect(isOk(result)).toBe(true);
            if (result.ok && result.value) {
                const refreshed = result.value as BearerCredential;
                expect(refreshed.accessToken).toBe('new-access-token');
                expect(refreshed.localStorage).toEqual({
                    'session-key': 'session-value',
                    'user-token': 'tok-123',
                });
            }
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('preserves xHeaders alongside localStorage during refresh', async () => {
        const strategy = factory.create({
            strategy: 'oauth2',
            tokenEndpoint: 'https://auth.example.com/token',
            clientId: 'test-client',
        });

        const original = makeCred({
            refreshToken: 'refresh-abc',
            tokenEndpoint: 'https://auth.example.com/token',
            xHeaders: { 'x-session': 'sess-val' },
            localStorage: { 'local-key': 'local-val' },
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () =>
            new Response(
                JSON.stringify({
                    access_token: 'new-token',
                    expires_in: 3600,
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            );

        try {
            const result = await strategy.refresh(original, { strategy: 'oauth2' });
            expect(isOk(result)).toBe(true);
            if (result.ok && result.value) {
                const refreshed = result.value as BearerCredential;
                expect(refreshed.xHeaders).toEqual({ 'x-session': 'sess-val' });
                expect(refreshed.localStorage).toEqual({ 'local-key': 'local-val' });
            }
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('does not include localStorage on refreshed credential when original had none', async () => {
        const strategy = factory.create({
            strategy: 'oauth2',
            tokenEndpoint: 'https://auth.example.com/token',
            clientId: 'test-client',
        });

        const original = makeCred({
            refreshToken: 'refresh-abc',
            tokenEndpoint: 'https://auth.example.com/token',
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () =>
            new Response(
                JSON.stringify({
                    access_token: 'new-token',
                    expires_in: 3600,
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            );

        try {
            const result = await strategy.refresh(original, { strategy: 'oauth2' });
            expect(isOk(result)).toBe(true);
            if (result.ok && result.value) {
                const refreshed = result.value as BearerCredential;
                expect(refreshed.localStorage).toBeUndefined();
            }
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    function makeCred(overrides?: Partial<BearerCredential>): BearerCredential {
        return {
            type: 'bearer',
            accessToken: 'eyJhbGciOiJSUzI1NiJ9.old-token',
            expiresAt: new Date(Date.now() - 1000).toISOString(), // expired
            ...overrides,
        };
    }
});
