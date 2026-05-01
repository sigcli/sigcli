import { describe, expect, it } from 'vitest';

import { HeadlessStorageExtractor } from '../../../src/strategies/browser/extractors/headless-storage.js';
import type { HeadlessExtractionCtx } from '../../../src/types/interfaces/headless-extractor.js';
import type { ExtractRule } from '../../../src/types/types.js';

/**
 * Build a mock HeadlessExtractionCtx backed by a plain in-memory localStorage map.
 */
function makeCtx(store: Record<string, string>): HeadlessExtractionCtx {
    return {
        async cookies() {
            return [];
        },
        async evaluate<T>(expr: string): Promise<T> {
            // Simulate localStorage.getItem(<key>)
            const getItemMatch = expr.match(/localStorage\.getItem\(("(?:[^"\\]|\\.)*")\)/);
            if (getItemMatch) {
                const key = JSON.parse(getItemMatch[1]) as string;
                const val = store[key] ?? null;
                return val as T;
            }

            // Simulate glob-based scan that returns JSON.stringify(matches)
            const regexMatch = expr.match(/new RegExp\(("(?:[^"\\]|\\.)*")\)/);
            if (regexMatch) {
                const regexSrc = JSON.parse(regexMatch[1]) as string;
                const regex = new RegExp(regexSrc);
                const matches = Object.keys(store)
                    .filter((k) => regex.test(k))
                    .map((k) => store[k]);
                return JSON.stringify(matches) as T;
            }

            return null as T;
        },
    };
}

function makeRule(overrides: Partial<ExtractRule>): ExtractRule {
    return {
        from: 'localStorage',
        as: 'token',
        match: 'myKey',
        ...overrides,
    };
}

describe('HeadlessStorageExtractor', () => {
    const extractor = new HeadlessStorageExtractor();

    it('has type "localStorage"', () => {
        expect(extractor.type).toBe('localStorage');
    });

    describe('exact key match (no glob)', () => {
        it('retrieves the value for an exact localStorage key', async () => {
            const ctx = makeCtx({ myKey: 'myValue' });
            const rule = makeRule({ as: 'result', match: 'myKey' });
            const result = await extractor.extract(ctx, rule, []);

            expect(result).not.toBeNull();
            expect(result!.name).toBe('result');
            expect(result!.value).toBe('myValue');
        });

        it('returns null when the exact key is not in localStorage', async () => {
            const ctx = makeCtx({ otherKey: 'val' });
            const rule = makeRule({ match: 'myKey' });
            const result = await extractor.extract(ctx, rule, []);

            expect(result).toBeNull();
        });

        it('uses rule.as as the output name', async () => {
            const ctx = makeCtx({ myKey: 'val' });
            const rule = makeRule({ as: 'my_output', match: 'myKey' });
            const result = await extractor.extract(ctx, rule, []);

            expect(result!.name).toBe('my_output');
        });
    });

    describe('glob pattern match', () => {
        it('matches a key using *token* glob pattern', async () => {
            const ctx = makeCtx({
                'auth-token-v2': 'secret',
                'user-info': 'profile',
            });
            const rule = makeRule({ as: 'tok', match: '*token*' });
            const result = await extractor.extract(ctx, rule, []);

            expect(result).not.toBeNull();
            expect(result!.name).toBe('tok');
            expect(result!.value).toBe('secret');
        });

        it('returns the first match when multiple keys satisfy the pattern', async () => {
            const ctx = makeCtx({
                'token-a': 'first',
                'token-b': 'second',
            });
            const rule = makeRule({ as: 'tok', match: 'token-*' });
            const result = await extractor.extract(ctx, rule, []);

            expect(result).not.toBeNull();
            // Should be one of the matching values — just non-null
            expect(['first', 'second']).toContain(result!.value);
        });

        it('returns null when no keys match the glob pattern', async () => {
            const ctx = makeCtx({ 'user-info': 'profile' });
            const rule = makeRule({ match: '*token*' });
            const result = await extractor.extract(ctx, rule, []);

            expect(result).toBeNull();
        });
    });

    describe('jsonPath extraction', () => {
        it('extracts a nested field from a JSON value (exact match)', async () => {
            const ctx = makeCtx({
                localConfig_v2: JSON.stringify({ teams: { E7RBBBXHB: { token: 'xoxc-abc' } } }),
            });
            const rule = makeRule({
                as: 'xoxc',
                match: 'localConfig_v2',
                jsonPath: 'teams.E7RBBBXHB.token',
            });
            const result = await extractor.extract(ctx, rule, []);

            expect(result).not.toBeNull();
            expect(result!.name).toBe('xoxc');
            expect(result!.value).toBe('xoxc-abc');
        });

        it('extracts a top-level field from a JSON value', async () => {
            const ctx = makeCtx({
                config: JSON.stringify({ secret: 'mysecret' }),
            });
            const rule = makeRule({ as: 'sec', match: 'config', jsonPath: 'secret' });
            const result = await extractor.extract(ctx, rule, []);

            expect(result!.value).toBe('mysecret');
        });

        it('returns null when jsonPath points to a missing key', async () => {
            const ctx = makeCtx({
                config: JSON.stringify({ other: 'data' }),
            });
            const rule = makeRule({ as: 'sec', match: 'config', jsonPath: 'secret' });
            const result = await extractor.extract(ctx, rule, []);

            expect(result).toBeNull();
        });

        it('returns null when the stored value is not valid JSON and jsonPath is specified', async () => {
            const ctx = makeCtx({
                myKey: 'not-json-at-all',
            });
            const rule = makeRule({ as: 'tok', match: 'myKey', jsonPath: 'token' });
            const result = await extractor.extract(ctx, rule, []);

            expect(result).toBeNull();
        });

        it('extracts jsonPath from a glob-matched JSON value', async () => {
            const ctx = makeCtx({
                'msal.token.abc': JSON.stringify({ secret: 'access-token-123' }),
            });
            const rule = makeRule({
                as: 'tok',
                match: 'msal.*',
                jsonPath: 'secret',
            });
            const result = await extractor.extract(ctx, rule, []);

            expect(result).not.toBeNull();
            expect(result!.value).toBe('access-token-123');
        });

        it('returns null when glob-matched value is not JSON and jsonPath specified', async () => {
            const ctx = makeCtx({
                'msal.token.abc': 'plain-string-not-json',
            });
            const rule = makeRule({
                as: 'tok',
                match: 'msal.*',
                jsonPath: 'secret',
            });
            const result = await extractor.extract(ctx, rule, []);

            expect(result).toBeNull();
        });
    });
});
