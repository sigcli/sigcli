import dlv from 'dlv';
import { describe, expect, it } from 'vitest';

/**
 * Tests for jsonPath behavior used by CdpStorageExtractor.
 *
 * The extractor uses `dlv` (a tiny dot-path resolver) internally:
 *   1. Parse the stored string as JSON.
 *   2. Resolve the dot-path with dlv.
 *   3. If resolution returns null/undefined, return null.
 *   4. Otherwise return String(resolved).
 */

function resolveJsonPath(raw: string | null, jsonPath?: string): string | null {
    if (!raw) return null;
    if (!jsonPath) return raw;
    try {
        const parsed = JSON.parse(raw);
        const resolved = dlv(parsed, jsonPath);
        if (resolved == null) return null;
        return String(resolved);
    } catch {
        return null;
    }
}

describe('jsonPath behavior in storage extractors', () => {
    describe('simple top-level path', () => {
        it('resolves "secret" on {"secret": "value"} to "value"', () => {
            const result = resolveJsonPath(JSON.stringify({ secret: 'value' }), 'secret');
            expect(result).toBe('value');
        });

        it('resolves a numeric value as a string', () => {
            const result = resolveJsonPath(JSON.stringify({ count: 42 }), 'count');
            expect(result).toBe('42');
        });

        it('resolves a boolean value as a string', () => {
            const result = resolveJsonPath(JSON.stringify({ enabled: true }), 'enabled');
            expect(result).toBe('true');
        });
    });

    describe('nested path', () => {
        it('resolves "teams.E7RBBBXHB.token" on deeply nested object', () => {
            const payload = {
                teams: {
                    E7RBBBXHB: { token: 'xoxc-secret-team-token' },
                    OTHER: { token: 'xoxc-other' },
                },
            };
            const result = resolveJsonPath(JSON.stringify(payload), 'teams.E7RBBBXHB.token');
            expect(result).toBe('xoxc-secret-team-token');
        });

        it('resolves a two-level path', () => {
            const result = resolveJsonPath(
                JSON.stringify({ auth: { token: 'tok123' } }),
                'auth.token',
            );
            expect(result).toBe('tok123');
        });
    });

    describe('path resolving to null or undefined', () => {
        it('returns null when the path key does not exist', () => {
            const result = resolveJsonPath(JSON.stringify({ other: 'data' }), 'nonexistent');
            expect(result).toBeNull();
        });

        it('returns null when an intermediate node is missing', () => {
            const result = resolveJsonPath(JSON.stringify({ a: {} }), 'a.b.c');
            expect(result).toBeNull();
        });

        it('returns null when the path resolves to explicit null', () => {
            const result = resolveJsonPath(JSON.stringify({ token: null }), 'token');
            expect(result).toBeNull();
        });
    });

    describe('non-JSON input with jsonPath specified', () => {
        it('returns null for a plain string value (not JSON)', () => {
            const result = resolveJsonPath('plain-string-not-json', 'secret');
            expect(result).toBeNull();
        });

        it('returns null for a numeric string', () => {
            const result = resolveJsonPath('12345', 'secret');
            expect(result).toBeNull();
        });

        it('returns null when the stored value is an empty string', () => {
            const result = resolveJsonPath('', 'secret');
            expect(result).toBeNull();
        });
    });

    describe('no jsonPath (pass-through)', () => {
        it('returns the raw string value when jsonPath is omitted', () => {
            const result = resolveJsonPath('raw-value');
            expect(result).toBe('raw-value');
        });

        it('returns the raw JSON string when jsonPath is omitted', () => {
            const raw = JSON.stringify({ a: 1 });
            const result = resolveJsonPath(raw);
            expect(result).toBe(raw);
        });
    });
});
