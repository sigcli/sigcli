/**
 * Tests for the toIsoTimestamp() + expiresJsonPath logic inside CdpStorageExtractor.
 *
 * CdpStorageExtractor.extract() is designed to call out to a live CDP session,
 * so we test the timestamp-conversion logic in isolation by replicating the
 * exact same algorithm here (matching the implementation in cdp-storage.ts).
 *
 * toIsoTimestamp() rules:
 *   - number > 1e12 → treat as epoch-milliseconds
 *   - number ≤ 1e12 → treat as epoch-seconds (× 1000)
 *   - string → parse with new Date(); return ISO if valid, else undefined
 *   - anything else → undefined
 *
 * expiresJsonPath resolution (via dlv):
 *   - Parse raw JSON, traverse the dot-path, pass to toIsoTimestamp()
 *   - Missing key → expiresAt is undefined
 *   - No expiresJsonPath → expiresAt is undefined
 *   - Unparseable JSON → expiresAt is undefined (caught silently)
 */

import dlv from 'dlv';
import { describe, expect, it } from 'vitest';

// Replicate the private toIsoTimestamp helper from CdpStorageExtractor
function toIsoTimestamp(raw: unknown): string | undefined {
    if (typeof raw === 'number') {
        const ms = raw > 1e12 ? raw : raw * 1000;
        return new Date(ms).toISOString();
    }
    if (typeof raw === 'string') {
        // Handle numeric strings (e.g. MSAL "expiresOn": "1777983731")
        if (/^\d+$/.test(raw)) {
            const num = Number(raw);
            const ms = num > 1e12 ? num : num * 1000;
            return new Date(ms).toISOString();
        }
        const d = new Date(raw);
        return isNaN(d.getTime()) ? undefined : d.toISOString();
    }
    return undefined;
}

// Replicate the expiresJsonPath resolution from CdpStorageExtractor.extract()
function resolveExpiresJsonPath(rawValue: string, expiresJsonPath?: string): string | undefined {
    if (!expiresJsonPath) return undefined;
    try {
        const parsed = JSON.parse(rawValue);
        const raw = dlv(parsed, expiresJsonPath);
        if (raw == null) return undefined;
        return toIsoTimestamp(raw);
    } catch {
        return undefined;
    }
}

describe('toIsoTimestamp', () => {
    describe('epoch-milliseconds (number > 1e12)', () => {
        it('converts epoch-ms number to ISO string', () => {
            const epochMs = 1735689600000; // 2025-01-01T00:00:00.000Z
            const result = toIsoTimestamp(epochMs);
            expect(result).toBe('2025-01-01T00:00:00.000Z');
        });

        it('converts a far-future epoch-ms (year 2099)', () => {
            const epochMs = 4070908800000; // ~2099-01-01
            const result = toIsoTimestamp(epochMs);
            expect(result).toBeDefined();
            expect(result).toContain('2099');
        });

        it('boundary: value exactly at 1e12 + 1 is treated as ms', () => {
            const epochMs = 1e12 + 1;
            const result = toIsoTimestamp(epochMs);
            // Should be treated as milliseconds (year ~2001)
            expect(result).toBeDefined();
            const year = new Date(result!).getFullYear();
            expect(year).toBeGreaterThan(2000);
            expect(year).toBeLessThan(2100);
        });
    });

    describe('epoch-seconds (number ≤ 1e12)', () => {
        it('converts epoch-seconds number to ISO string', () => {
            const epochSec = 1735689600; // 2025-01-01T00:00:00.000Z
            const result = toIsoTimestamp(epochSec);
            expect(result).toBe('2025-01-01T00:00:00.000Z');
        });

        it('boundary: value exactly at 1e12 is treated as seconds', () => {
            // 1e12 seconds is year ~33658 — a valid but far-future timestamp
            const epochSec = 1e12;
            const result = toIsoTimestamp(epochSec);
            expect(result).toBeDefined();
            const year = new Date(result!).getFullYear();
            expect(year).toBeGreaterThan(30000); // epoch-seconds × 1000 = very far future
        });

        it('handles a typical near-future epoch-seconds timestamp', () => {
            const epochSec = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
            const result = toIsoTimestamp(epochSec);
            expect(result).toBeDefined();
            // The resulting date should be roughly 1 hour ahead
            const parsed = new Date(result!).getTime();
            expect(parsed).toBeGreaterThan(Date.now());
        });
    });

    describe('ISO string input', () => {
        it('returns the ISO form of a valid ISO string as-is', () => {
            const iso = '2025-06-15T12:00:00.000Z';
            const result = toIsoTimestamp(iso);
            expect(result).toBe(iso);
        });

        it('normalizes a date-only string to midnight UTC', () => {
            const result = toIsoTimestamp('2025-06-15');
            expect(result).toBeDefined();
            expect(result).toContain('2025-06-15');
        });

        it('returns undefined for a garbage string', () => {
            expect(toIsoTimestamp('not-a-date')).toBeUndefined();
            expect(toIsoTimestamp('hello world')).toBeUndefined();
            expect(toIsoTimestamp('')).toBeUndefined();
        });

        it('parses a numeric string as epoch-milliseconds', () => {
            // A string "1735689600000" is detected as all-digits → treated as epoch-ms
            const result = toIsoTimestamp('1735689600000');
            expect(result).toBe('2025-01-01T00:00:00.000Z');
        });

        it('parses a numeric string as epoch-seconds when ≤ 1e12', () => {
            // MSAL stores expiresOn as a numeric string (e.g. "1735689600")
            const result = toIsoTimestamp('1735689600');
            expect(result).toBe('2025-01-01T00:00:00.000Z');
        });
    });

    describe('non-date inputs', () => {
        it('returns undefined for null', () => {
            expect(toIsoTimestamp(null)).toBeUndefined();
        });

        it('returns undefined for undefined', () => {
            expect(toIsoTimestamp(undefined)).toBeUndefined();
        });

        it('returns undefined for boolean', () => {
            expect(toIsoTimestamp(true)).toBeUndefined();
            expect(toIsoTimestamp(false)).toBeUndefined();
        });

        it('returns undefined for an object', () => {
            expect(toIsoTimestamp({ ts: 1735689600000 })).toBeUndefined();
        });

        it('returns undefined for an array', () => {
            expect(toIsoTimestamp([1735689600000])).toBeUndefined();
        });
    });
});

describe('resolveExpiresJsonPath', () => {
    describe('epoch-milliseconds via expiresJsonPath', () => {
        it('resolves epoch-ms number at top-level path', () => {
            const epochMs = 1735689600000;
            const raw = JSON.stringify({ expiresAt: epochMs });
            const result = resolveExpiresJsonPath(raw, 'expiresAt');
            expect(result).toBe('2025-01-01T00:00:00.000Z');
        });

        it('resolves epoch-ms at nested path', () => {
            const epochMs = 1735689600000;
            const raw = JSON.stringify({ auth: { expiry: epochMs } });
            const result = resolveExpiresJsonPath(raw, 'auth.expiry');
            expect(result).toBe('2025-01-01T00:00:00.000Z');
        });
    });

    describe('epoch-seconds via expiresJsonPath', () => {
        it('resolves epoch-seconds number at top-level path', () => {
            const epochSec = 1735689600;
            const raw = JSON.stringify({ exp: epochSec });
            const result = resolveExpiresJsonPath(raw, 'exp');
            expect(result).toBe('2025-01-01T00:00:00.000Z');
        });

        it('resolves epoch-seconds in a deeply nested path', () => {
            const epochSec = 1735689600;
            const raw = JSON.stringify({ session: { token: { exp: epochSec } } });
            const result = resolveExpiresJsonPath(raw, 'session.token.exp');
            expect(result).toBe('2025-01-01T00:00:00.000Z');
        });
    });

    describe('ISO string via expiresJsonPath', () => {
        it('resolves ISO string at top-level path', () => {
            const iso = '2025-01-01T00:00:00.000Z';
            const raw = JSON.stringify({ expiresAt: iso });
            const result = resolveExpiresJsonPath(raw, 'expiresAt');
            expect(result).toBe(iso);
        });

        it('resolves ISO string at nested path', () => {
            const iso = '2025-07-04T12:30:00.000Z';
            const raw = JSON.stringify({ meta: { expires: iso } });
            const result = resolveExpiresJsonPath(raw, 'meta.expires');
            expect(result).toBe(iso);
        });
    });

    describe('missing or undefined path', () => {
        it('returns undefined when expiresJsonPath points to a missing key', () => {
            const raw = JSON.stringify({ other: 'data' });
            const result = resolveExpiresJsonPath(raw, 'expiresAt');
            expect(result).toBeUndefined();
        });

        it('returns undefined when an intermediate node is missing', () => {
            const raw = JSON.stringify({ a: {} });
            const result = resolveExpiresJsonPath(raw, 'a.b.exp');
            expect(result).toBeUndefined();
        });

        it('returns undefined when the path resolves to explicit null', () => {
            const raw = JSON.stringify({ expiresAt: null });
            const result = resolveExpiresJsonPath(raw, 'expiresAt');
            expect(result).toBeUndefined();
        });
    });

    describe('no expiresJsonPath provided', () => {
        it('returns undefined when expiresJsonPath is omitted', () => {
            const raw = JSON.stringify({ expiresAt: 1735689600000 });
            const result = resolveExpiresJsonPath(raw);
            expect(result).toBeUndefined();
        });

        it('returns undefined when expiresJsonPath is undefined explicitly', () => {
            const raw = JSON.stringify({ expiresAt: 1735689600000 });
            const result = resolveExpiresJsonPath(raw, undefined);
            expect(result).toBeUndefined();
        });
    });

    describe('garbage / non-date values at path', () => {
        it('returns undefined when the path resolves to a non-date string', () => {
            const raw = JSON.stringify({ expiresAt: 'not-a-date' });
            const result = resolveExpiresJsonPath(raw, 'expiresAt');
            expect(result).toBeUndefined();
        });

        it('returns undefined when the path resolves to a boolean', () => {
            const raw = JSON.stringify({ expired: true });
            const result = resolveExpiresJsonPath(raw, 'expired');
            expect(result).toBeUndefined();
        });

        it('returns undefined when the path resolves to an object', () => {
            const raw = JSON.stringify({ expires: { nested: 1735689600000 } });
            const result = resolveExpiresJsonPath(raw, 'expires');
            expect(result).toBeUndefined();
        });

        it('returns undefined when the raw value is not valid JSON', () => {
            const result = resolveExpiresJsonPath('not-json', 'expiresAt');
            expect(result).toBeUndefined();
        });

        it('returns undefined when the raw value is an empty string', () => {
            const result = resolveExpiresJsonPath('', 'expiresAt');
            expect(result).toBeUndefined();
        });
    });
});
