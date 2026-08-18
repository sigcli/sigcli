/**
 * TOTP known-answer tests based on RFC 6238 Appendix B (SHA-1 vector).
 *
 * The RFC vector uses the ASCII secret "12345678901234567890", base32-encoded
 * as "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ".
 *
 * The RFC prints 8-digit codes; the underlying HOTP truncation is the same, so
 * we compute 8-digit codes here for direct comparison with the RFC table.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { computeTotp } from '../../../src/utils/totp.js';

const SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('computeTotp — RFC 6238 Appendix B known answers (SHA-1, 8 digits)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // RFC 6238 Appendix B table — SHA-1 column
    const cases: Array<{ ts: number; code: string }> = [
        { ts: 59, code: '94287082' },
        { ts: 1111111109, code: '07081804' },
        { ts: 1111111111, code: '14050471' },
        { ts: 1234567890, code: '89005924' },
        { ts: 2000000000, code: '69279037' },
    ];

    for (const { ts, code } of cases) {
        it(`ts=${ts} → ${code}`, () => {
            vi.setSystemTime(new Date(ts * 1000));
            expect(computeTotp(SECRET_BASE32, { digits: 8, period: 30 })).toBe(code);
        });
    }
});

describe('computeTotp — defaults', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(59_000)); // matches ts=59 in the RFC table
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns a 6-digit numeric string with default options', () => {
        const code = computeTotp(SECRET_BASE32);
        expect(code).toMatch(/^\d{6}$/);
    });

    it('the 6-digit code equals the last 6 digits of the 8-digit RFC code', () => {
        // The 8-digit code at ts=59 is 94287082 → 6-digit truncation is 287082.
        const code6 = computeTotp(SECRET_BASE32);
        const code8 = computeTotp(SECRET_BASE32, { digits: 8 });
        expect(code6).toBe(code8.slice(-6));
    });
});

describe('computeTotp — invalid input', () => {
    it('throws on invalid base32 secret', () => {
        // '1' and '0' are not valid base32 alphabet characters (base32 is A-Z, 2-7).
        expect(() => computeTotp('!!!not-base32!!!')).toThrow();
    });
});
