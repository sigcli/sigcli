import { describe, expect, it } from 'vitest';

import { applyRules } from '../src/formatter.js';
import type { ApplyRule } from '../src/types.js';

describe('applyRules', () => {
    it('interpolates a header template', () => {
        const result = applyRules({ cookie: 'sid=abc123' }, [
            { in: 'header', name: 'Cookie', value: '${cookie}' },
        ]);
        expect(result.headers['Cookie']).toBe('sid=abc123');
    });

    it('interpolates Bearer token template', () => {
        const result = applyRules({ token: 'eyJhbGciOiJIUzI1NiIs' }, [
            { in: 'header', name: 'Authorization', value: 'Bearer ${token}' },
        ]);
        expect(result.headers['Authorization']).toBe('Bearer eyJhbGciOiJIUzI1NiIs');
    });

    it('applies multiple rules', () => {
        const result = applyRules({ cookie: 'sid=abc', token: 'tok123' }, [
            { in: 'header', name: 'Cookie', value: '${cookie}' },
            { in: 'header', name: 'Authorization', value: 'Bearer ${token}' },
        ]);
        expect(result.headers['Cookie']).toBe('sid=abc');
        expect(result.headers['Authorization']).toBe('Bearer tok123');
    });

    it('append action joins values with semicolon', () => {
        const rules: ApplyRule[] = [
            { in: 'header', name: 'Cookie', value: 'a=1' },
            { in: 'header', name: 'Cookie', value: 'b=2', action: 'append' },
        ];
        const result = applyRules({}, rules);
        expect(result.headers['Cookie']).toBe('a=1; b=2');
    });

    it('remove action deletes the header', () => {
        const rules: ApplyRule[] = [
            { in: 'header', name: 'Cookie', value: 'a=1' },
            { in: 'header', name: 'Cookie', value: '', action: 'remove' },
        ];
        const result = applyRules({}, rules);
        expect(result.headers['Cookie']).toBeUndefined();
    });

    it('applies query rules', () => {
        const result = applyRules({ key: 'myapikey' }, [
            { in: 'query', name: 'api_key', value: '${key}' },
        ]);
        expect(result.query?.['api_key']).toBe('myapikey');
        expect(result.headers).toEqual({});
    });

    it('does not include query in result when no query rules', () => {
        const result = applyRules({}, [{ in: 'header', name: 'X-Test', value: 'val' }]);
        expect(result.query).toBeUndefined();
        expect(result.body).toBeUndefined();
    });

    it('replaces missing values with empty string', () => {
        const result = applyRules({}, [
            { in: 'header', name: 'Authorization', value: 'Bearer ${missing_key}' },
        ]);
        expect(result.headers['Authorization']).toBe('Bearer ');
    });

    it('applies body rules', () => {
        const result = applyRules({ secret: 'mysecret' }, [
            { in: 'body', name: 'client_secret', value: '${secret}' },
        ]);
        expect(result.body?.['client_secret']).toBe('mysecret');
    });

    it('append on query joins with semicolon', () => {
        const rules: ApplyRule[] = [
            { in: 'query', name: 'filter', value: 'type=A' },
            { in: 'query', name: 'filter', value: 'type=B', action: 'append' },
        ];
        const result = applyRules({}, rules);
        expect(result.query?.['filter']).toBe('type=A; type=B');
    });

    it('remove on query deletes the param', () => {
        const rules: ApplyRule[] = [
            { in: 'query', name: 'debug', value: '1' },
            { in: 'query', name: 'debug', value: '', action: 'remove' },
        ];
        const result = applyRules({}, rules);
        expect(result.query?.['debug']).toBeUndefined();
    });

    it('returns empty headers for empty rules array', () => {
        const result = applyRules({ cookie: 'x=1' }, []);
        expect(result.headers).toEqual({});
        expect(result.query).toBeUndefined();
        expect(result.body).toBeUndefined();
    });
});
