import { describe, expect, it } from 'vitest';

/**
 * Tests for jsonPath behavior used by HeadlessStorageExtractor and CdpStorageExtractor.
 *
 * Both extractors use `dlv` (a tiny dot-path resolver) internally, but the behavior
 * is tested here at the integration level — simulating what the extractors do:
 *
 *   1. Parse the stored string as JSON.
 *   2. Resolve the dot-path with dlv.
 *   3. If resolution returns null/undefined, return null.
 *   4. Otherwise return String(resolved).
 *
 * This avoids importing dlv directly and keeps tests focused on observable behavior.
 */

import { HeadlessStorageExtractor } from '../../../src/strategies/browser/extractors/headless-storage.js';
import type { HeadlessExtractionCtx } from '../../../src/types/interfaces/headless-extractor.js';
import type { ExtractRule } from '../../../src/types/types.js';

/**
 * Minimal ctx that returns a fixed localStorage value for a fixed key.
 */
function ctxWithValue(key: string, value: string | null): HeadlessExtractionCtx {
    return {
        async cookies() {
            return [];
        },
        async evaluate<T>(expr: string): Promise<T> {
            // Only handle exact getItem calls — this test file uses exact keys only
            const match = expr.match(/localStorage\.getItem\(("(?:[^"\\]|\\.)*")\)/);
            if (match) {
                const k = JSON.parse(match[1]) as string;
                return (k === key ? value : null) as T;
            }
            return null as T;
        },
    };
}

function makeRule(match: string, as: string, jsonPath?: string): ExtractRule {
    return { from: 'localStorage', as, match, jsonPath };
}

describe('jsonPath behavior in storage extractors', () => {
    const extractor = new HeadlessStorageExtractor();

    describe('simple top-level path', () => {
        it('resolves "secret" on {"secret": "value"} to "value"', async () => {
            const ctx = ctxWithValue('myKey', JSON.stringify({ secret: 'value' }));
            const rule = makeRule('myKey', 'out', 'secret');
            const result = await extractor.extract(ctx, rule, []);

            expect(result).not.toBeNull();
            expect(result!.value).toBe('value');
        });

        it('resolves a numeric value as a string', async () => {
            const ctx = ctxWithValue('myKey', JSON.stringify({ count: 42 }));
            const rule = makeRule('myKey', 'out', 'count');
            const result = await extractor.extract(ctx, rule, []);

            expect(result!.value).toBe('42');
        });

        it('resolves a boolean value as a string', async () => {
            const ctx = ctxWithValue('myKey', JSON.stringify({ enabled: true }));
            const rule = makeRule('myKey', 'out', 'enabled');
            const result = await extractor.extract(ctx, rule, []);

            expect(result!.value).toBe('true');
        });
    });

    describe('nested path', () => {
        it('resolves "teams.E7RBBBXHB.token" on deeply nested object', async () => {
            const payload = {
                teams: {
                    E7RBBBXHB: { token: 'xoxc-secret-team-token' },
                    OTHER: { token: 'xoxc-other' },
                },
            };
            const ctx = ctxWithValue('localConfig_v2', JSON.stringify(payload));
            const rule = makeRule('localConfig_v2', 'xoxc', 'teams.E7RBBBXHB.token');
            const result = await extractor.extract(ctx, rule, []);

            expect(result).not.toBeNull();
            expect(result!.value).toBe('xoxc-secret-team-token');
        });

        it('resolves a two-level path', async () => {
            const ctx = ctxWithValue('cfg', JSON.stringify({ auth: { token: 'tok123' } }));
            const rule = makeRule('cfg', 'tok', 'auth.token');
            const result = await extractor.extract(ctx, rule, []);

            expect(result!.value).toBe('tok123');
        });
    });

    describe('path resolving to null or undefined', () => {
        it('returns null when the path key does not exist', async () => {
            const ctx = ctxWithValue('cfg', JSON.stringify({ other: 'data' }));
            const rule = makeRule('cfg', 'tok', 'nonexistent');
            const result = await extractor.extract(ctx, rule, []);

            expect(result).toBeNull();
        });

        it('returns null when an intermediate node is missing', async () => {
            const ctx = ctxWithValue('cfg', JSON.stringify({ a: {} }));
            const rule = makeRule('cfg', 'tok', 'a.b.c');
            const result = await extractor.extract(ctx, rule, []);

            expect(result).toBeNull();
        });

        it('returns null when the path resolves to explicit null', async () => {
            const ctx = ctxWithValue('cfg', JSON.stringify({ token: null }));
            const rule = makeRule('cfg', 'tok', 'token');
            const result = await extractor.extract(ctx, rule, []);

            expect(result).toBeNull();
        });
    });

    describe('non-JSON input with jsonPath specified', () => {
        it('returns null for a plain string value (not JSON)', async () => {
            const ctx = ctxWithValue('myKey', 'plain-string-not-json');
            const rule = makeRule('myKey', 'out', 'secret');
            const result = await extractor.extract(ctx, rule, []);

            expect(result).toBeNull();
        });

        it('returns null for a numeric string', async () => {
            const ctx = ctxWithValue('myKey', '12345');
            // JSON.parse("12345") === 12345 (a number), dlv(12345, "secret") → undefined
            const rule = makeRule('myKey', 'out', 'secret');
            const result = await extractor.extract(ctx, rule, []);

            expect(result).toBeNull();
        });

        it('returns null when the stored value is an empty string', async () => {
            // empty string → falsy in HeadlessStorageExtractor → returns null before jsonPath
            const ctx = ctxWithValue('myKey', '');
            const rule = makeRule('myKey', 'out', 'secret');
            const result = await extractor.extract(ctx, rule, []);

            expect(result).toBeNull();
        });
    });

    describe('no jsonPath (pass-through)', () => {
        it('returns the raw string value when jsonPath is omitted', async () => {
            const ctx = ctxWithValue('myKey', 'raw-value');
            const rule = makeRule('myKey', 'out');
            const result = await extractor.extract(ctx, rule, []);

            expect(result).not.toBeNull();
            expect(result!.value).toBe('raw-value');
        });

        it('returns the raw JSON string when jsonPath is omitted', async () => {
            const raw = JSON.stringify({ a: 1 });
            const ctx = ctxWithValue('myKey', raw);
            const rule = makeRule('myKey', 'out');
            const result = await extractor.extract(ctx, rule, []);

            expect(result!.value).toBe(raw);
        });
    });
});
