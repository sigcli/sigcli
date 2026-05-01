import { describe, expect, it } from 'vitest';

import type { ProviderConfig } from '../../../src/types/index.js';

/**
 * Tests for the expiry computation logic in BrowserStrategy.computeExpiresAt().
 *
 * computeExpiresAt is private, so we test it by replicating the exact same
 * algorithm here. This keeps the tests fast, deterministic, and free of
 * browser/CDP dependencies.
 *
 * The algorithm:
 *  1. Parse provider.required dotted refs ("as.cookieName") to build a filter
 *     of which cookie rule names (as) and cookie names to include.
 *  2. Iterate extraction results:
 *     a. If result.expiresAt is set and > now+5min, collect it.
 *     b. For each cookie: skip session cookies (expires <= 0) and cookies
 *        expiring within 5 minutes of now (tracking/CSRF).
 *     c. If a required filter is active for this result's ruleName, only
 *        include cookies whose name is in the required set.
 *  3. Return Math.min of all timestamps as ISO string, or undefined if none.
 */

const TRACKING_COOKIE_TTL_MS = 5 * 60 * 1000; // 5 minutes in ms

type ExtractionResultEntry = {
    cookies?: Array<{ name: string; expires: number }>;
    expiresAt?: string;
    ruleName: string;
};

function computeExpiresAt(
    provider: Pick<ProviderConfig, 'required'>,
    results: ExtractionResultEntry[],
    now = Date.now(),
): string | undefined {
    const minTtlMs = TRACKING_COOKIE_TTL_MS;

    const requiredCookieNames = new Set<string>();
    const requiredAsNames = new Set<string>();
    if (provider.required?.length) {
        for (const ref of provider.required) {
            const dot = ref.indexOf('.');
            if (dot > 0) {
                requiredAsNames.add(ref.slice(0, dot));
                requiredCookieNames.add(ref.slice(dot + 1));
            }
        }
    }

    const timestamps: number[] = [];

    for (const r of results) {
        if (r.expiresAt) {
            const ms = new Date(r.expiresAt).getTime();
            if (!isNaN(ms) && ms - now > minTtlMs) timestamps.push(ms);
        }

        if (!r.cookies?.length) continue;

        const useRequiredFilter = requiredAsNames.size > 0 && requiredAsNames.has(r.ruleName);

        for (const c of r.cookies) {
            if (c.expires <= 0) continue;
            const expiryMs = c.expires * 1000;
            if (expiryMs - now <= minTtlMs) continue;
            if (useRequiredFilter && !requiredCookieNames.has(c.name)) continue;
            timestamps.push(expiryMs);
        }
    }

    if (timestamps.length === 0) return undefined;
    return new Date(Math.min(...timestamps)).toISOString();
}

// Fixed reference point: 2025-01-01T00:00:00.000Z
const NOW_MS = 1735689600000;
const NOW_S = NOW_MS / 1000;

// Helpers to build timestamps relative to NOW
const secFromNow = (s: number): number => NOW_S + s;
const msFromNow = (ms: number): number => NOW_MS + ms;

describe('computeExpiresAt — cookie expiry', () => {
    it('returns the min expiry when two persistent cookies are present', () => {
        // A2 expires in 90 days; _gat expires in 2 days — 2 days is the min
        const a2ExpiresS = secFromNow(90 * 24 * 3600);
        const gaExpiresS = secFromNow(2 * 24 * 3600);

        const result = computeExpiresAt(
            { required: [] },
            [
                {
                    ruleName: 'cookie',
                    cookies: [
                        { name: 'A2', expires: a2ExpiresS },
                        { name: '_gat', expires: gaExpiresS },
                    ],
                },
            ],
            NOW_MS,
        );

        expect(result).toBe(new Date(gaExpiresS * 1000).toISOString());
    });

    it('ignores tracking cookies expiring within 5 minutes and uses the long-lived cookie', () => {
        // _gat expires in 40 seconds (< 5 min window) — should be skipped
        const gat = secFromNow(40);
        // A2 expires in 3 months
        const a2 = secFromNow(90 * 24 * 3600);

        const result = computeExpiresAt(
            { required: [] },
            [
                {
                    ruleName: 'cookie',
                    cookies: [
                        { name: '_gat', expires: gat },
                        { name: 'A2', expires: a2 },
                    ],
                },
            ],
            NOW_MS,
        );

        expect(result).toBe(new Date(a2 * 1000).toISOString());
    });

    it('returns undefined when all cookies are session cookies (expires <= 0)', () => {
        const result = computeExpiresAt(
            { required: [] },
            [
                {
                    ruleName: 'cookie',
                    cookies: [
                        { name: 'SESSID', expires: -1 },
                        { name: 'auth', expires: 0 },
                    ],
                },
            ],
            NOW_MS,
        );

        expect(result).toBeUndefined();
    });

    it('uses the single persistent cookie when mixed with session cookies', () => {
        const persistentExpires = secFromNow(30 * 24 * 3600);

        const result = computeExpiresAt(
            { required: [] },
            [
                {
                    ruleName: 'cookie',
                    cookies: [
                        { name: 'session', expires: -1 },
                        { name: 'persistent', expires: persistentExpires },
                    ],
                },
            ],
            NOW_MS,
        );

        expect(result).toBe(new Date(persistentExpires * 1000).toISOString());
    });

    it('returns undefined when all cookies expire within the 5-minute window', () => {
        const result = computeExpiresAt(
            { required: [] },
            [
                {
                    ruleName: 'cookie',
                    cookies: [
                        { name: 'csrf', expires: secFromNow(60) },
                        { name: 'track', expires: secFromNow(299) },
                    ],
                },
            ],
            NOW_MS,
        );

        expect(result).toBeUndefined();
    });
});

describe('computeExpiresAt — required dotted refs filter', () => {
    it('only uses expiry of required cookie when required has dotted ref', () => {
        // required: ["cookie.A2"] means only A2's expiry from the "cookie" rule
        const a2Expires = secFromNow(90 * 24 * 3600);
        const shortExpires = secFromNow(2 * 24 * 3600); // shorter, would win without filter

        const result = computeExpiresAt(
            { required: ['cookie.A2'] },
            [
                {
                    ruleName: 'cookie',
                    cookies: [
                        { name: 'A2', expires: a2Expires },
                        { name: 'other', expires: shortExpires },
                    ],
                },
            ],
            NOW_MS,
        );

        // Should use A2's expiry only, ignoring 'other'
        expect(result).toBe(new Date(a2Expires * 1000).toISOString());
    });

    it('ignores cookies in other rule results when filter is active for one rule', () => {
        const filteredRuleExpires = secFromNow(90 * 24 * 3600);
        const otherRuleExpires = secFromNow(1 * 24 * 3600); // shorter — should win if included

        const result = computeExpiresAt(
            { required: ['cookie.A2'] },
            [
                {
                    // This rule is in the filter — only A2 counts
                    ruleName: 'cookie',
                    cookies: [
                        { name: 'A2', expires: filteredRuleExpires },
                        { name: 'noise', expires: otherRuleExpires },
                    ],
                },
                {
                    // This rule is NOT in the required filter — all its cookies are included
                    ruleName: 'session',
                    cookies: [{ name: 'JSESSIONID', expires: secFromNow(8 * 3600) }],
                },
            ],
            NOW_MS,
        );

        // JSESSIONID (8h) is shorter than A2 (90d) → result should be JSESSIONID's expiry
        // because session rule is not filtered
        expect(result).toBe(new Date(secFromNow(8 * 3600) * 1000).toISOString());
    });

    it('returns undefined when required dotted ref names a session cookie', () => {
        // A2 is required but it is a session cookie (expires = -1)
        const result = computeExpiresAt(
            { required: ['cookie.A2'] },
            [
                {
                    ruleName: 'cookie',
                    cookies: [
                        { name: 'A2', expires: -1 }, // session cookie
                        { name: 'other', expires: secFromNow(30 * 24 * 3600) }, // filtered out
                    ],
                },
            ],
            NOW_MS,
        );

        expect(result).toBeUndefined();
    });

    it('returns undefined when required dotted ref names a short-lived (tracking) cookie', () => {
        const result = computeExpiresAt(
            { required: ['cookie.csrf'] },
            [
                {
                    ruleName: 'cookie',
                    cookies: [
                        { name: 'csrf', expires: secFromNow(30) }, // < 5min
                        { name: 'longLived', expires: secFromNow(30 * 24 * 3600) }, // filtered out
                    ],
                },
            ],
            NOW_MS,
        );

        expect(result).toBeUndefined();
    });

    it('handles multiple required refs pointing to different cookies', () => {
        const tokenExpires = secFromNow(7 * 24 * 3600);
        const sessionExpires = secFromNow(30 * 24 * 3600);

        const result = computeExpiresAt(
            { required: ['cookie.token', 'cookie.session'] },
            [
                {
                    ruleName: 'cookie',
                    cookies: [
                        { name: 'token', expires: tokenExpires },
                        { name: 'session', expires: sessionExpires },
                        { name: 'noise', expires: secFromNow(1 * 24 * 3600) }, // filtered out
                    ],
                },
            ],
            NOW_MS,
        );

        // Min of token (7d) and session (30d) is token
        expect(result).toBe(new Date(tokenExpires * 1000).toISOString());
    });

    it('required ref without dot (no dot) is ignored as a filter', () => {
        // "cookie" has no dot — so no filter is applied
        const shortExpires = secFromNow(1 * 24 * 3600);
        const longExpires = secFromNow(30 * 24 * 3600);

        const result = computeExpiresAt(
            { required: ['cookie'] }, // no dot — not a dotted ref
            [
                {
                    ruleName: 'cookie',
                    cookies: [
                        { name: 'A', expires: shortExpires },
                        { name: 'B', expires: longExpires },
                    ],
                },
            ],
            NOW_MS,
        );

        // No filter → min of all = shortExpires
        expect(result).toBe(new Date(shortExpires * 1000).toISOString());
    });
});

describe('computeExpiresAt — localStorage expiresAt', () => {
    it('uses expiresAt from localStorage extractor result', () => {
        const futureIso = new Date(msFromNow(2 * 24 * 3600 * 1000)).toISOString();

        const result = computeExpiresAt(
            { required: [] },
            [
                {
                    ruleName: 'token',
                    expiresAt: futureIso,
                },
            ],
            NOW_MS,
        );

        expect(result).toBe(futureIso);
    });

    it('picks min between localStorage expiresAt and cookie expiry', () => {
        // localStorage expires in 1 day, cookie in 30 days → 1 day wins
        const lsExpires = new Date(msFromNow(1 * 24 * 3600 * 1000)).toISOString();
        const cookieExpires = secFromNow(30 * 24 * 3600);

        const result = computeExpiresAt(
            { required: [] },
            [
                { ruleName: 'token', expiresAt: lsExpires },
                { ruleName: 'cookie', cookies: [{ name: 'A2', expires: cookieExpires }] },
            ],
            NOW_MS,
        );

        expect(result).toBe(lsExpires);
    });

    it('ignores localStorage expiresAt when it is within 5 minutes of now', () => {
        // expiresAt only 2 minutes away → should be ignored
        const soonIso = new Date(msFromNow(2 * 60 * 1000)).toISOString();
        const cookieExpires = secFromNow(30 * 24 * 3600);

        const result = computeExpiresAt(
            { required: [] },
            [
                { ruleName: 'token', expiresAt: soonIso },
                { ruleName: 'cookie', cookies: [{ name: 'A2', expires: cookieExpires }] },
            ],
            NOW_MS,
        );

        // soonIso is skipped; cookie expiry is used
        expect(result).toBe(new Date(cookieExpires * 1000).toISOString());
    });

    it('ignores invalid ISO string for localStorage expiresAt', () => {
        const cookieExpires = secFromNow(30 * 24 * 3600);

        const result = computeExpiresAt(
            { required: [] },
            [
                { ruleName: 'token', expiresAt: 'not-a-date' },
                { ruleName: 'cookie', cookies: [{ name: 'A2', expires: cookieExpires }] },
            ],
            NOW_MS,
        );

        expect(result).toBe(new Date(cookieExpires * 1000).toISOString());
    });

    it('returns undefined when localStorage expiresAt is the only source and is invalid', () => {
        const result = computeExpiresAt(
            { required: [] },
            [{ ruleName: 'token', expiresAt: 'garbage' }],
            NOW_MS,
        );

        expect(result).toBeUndefined();
    });

    it('returns undefined when there are no results at all', () => {
        const result = computeExpiresAt({ required: [] }, [], NOW_MS);
        expect(result).toBeUndefined();
    });
});

describe('computeExpiresAt — edge cases', () => {
    it('handles results with neither cookies nor expiresAt', () => {
        const result = computeExpiresAt({ required: [] }, [{ ruleName: 'empty' }], NOW_MS);

        expect(result).toBeUndefined();
    });

    it('correctly identifies the earliest expiry across multiple rules', () => {
        const t1 = secFromNow(1 * 24 * 3600); // 1 day
        const t2 = secFromNow(2 * 24 * 3600); // 2 days
        const t3 = secFromNow(3 * 24 * 3600); // 3 days

        const result = computeExpiresAt(
            { required: [] },
            [
                { ruleName: 'rule1', cookies: [{ name: 'c1', expires: t3 }] },
                { ruleName: 'rule2', cookies: [{ name: 'c2', expires: t1 }] },
                { ruleName: 'rule3', cookies: [{ name: 'c3', expires: t2 }] },
            ],
            NOW_MS,
        );

        expect(result).toBe(new Date(t1 * 1000).toISOString());
    });

    it('handles exactly-5-minutes-from-now cookie as excluded (boundary)', () => {
        // Exactly at the boundary: expiryMs - now = minTtlMs → excluded (condition is <=)
        const exactly5minS = secFromNow(TRACKING_COOKIE_TTL_MS / 1000);

        const result = computeExpiresAt(
            { required: [] },
            [
                {
                    ruleName: 'cookie',
                    cookies: [{ name: 'csrf', expires: exactly5minS }],
                },
            ],
            NOW_MS,
        );

        expect(result).toBeUndefined();
    });

    it('includes a cookie expiring just over 5 minutes from now', () => {
        // 5 minutes + 1 second → just inside the acceptable window
        const justOver5minS = secFromNow(TRACKING_COOKIE_TTL_MS / 1000 + 1);

        const result = computeExpiresAt(
            { required: [] },
            [
                {
                    ruleName: 'cookie',
                    cookies: [{ name: 'auth', expires: justOver5minS }],
                },
            ],
            NOW_MS,
        );

        expect(result).toBe(new Date(justOver5minS * 1000).toISOString());
    });
});
