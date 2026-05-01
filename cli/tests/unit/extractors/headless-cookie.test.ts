import { describe, expect, it } from 'vitest';

import { HeadlessCookieExtractor } from '../../../src/strategies/browser/extractors/headless-cookie.js';
import type { HeadlessExtractionCtx } from '../../../src/types/interfaces/headless-extractor.js';
import type { ExtractRule } from '../../../src/types/types.js';

/**
 * Build a mock HeadlessExtractionCtx with preset cookies.
 */
function makeCtx(
    cookies: Array<{ name: string; value: string; domain: string; expires?: number }>,
): HeadlessExtractionCtx {
    return {
        async cookies() {
            return cookies.map((c) => ({
                name: c.name,
                value: c.value,
                domain: c.domain,
                expires: c.expires ?? -1,
            }));
        },
        async evaluate<T>(_expr: string): Promise<T> {
            return null as T;
        },
    };
}

function makeRule(overrides: Partial<ExtractRule>): ExtractRule {
    return {
        from: 'cookies',
        as: 'session',
        match: '*',
        ...overrides,
    };
}

const DOMAIN = 'example.com';
const DOMAINS = [DOMAIN];

describe('HeadlessCookieExtractor', () => {
    const extractor = new HeadlessCookieExtractor();

    it('has type "cookies"', () => {
        expect(extractor.type).toBe('cookies');
    });

    describe('match: "*" returns all domain-matching cookies', () => {
        it('returns all cookies joined as cookie header string', async () => {
            const ctx = makeCtx([
                { name: 'session_id', value: 'abc123', domain: DOMAIN },
                { name: 'csrf_token', value: 'xyz', domain: DOMAIN },
            ]);
            const rule = makeRule({ as: 'session', match: '*' });
            const result = await extractor.extract(ctx, rule, DOMAINS);

            expect(result).not.toBeNull();
            expect(result!.name).toBe('session');
            expect(result!.value).toBe('session_id=abc123; csrf_token=xyz');
        });

        it('uses rule.as as the output name', async () => {
            const ctx = makeCtx([{ name: 'auth', value: 'tok', domain: DOMAIN }]);
            const rule = makeRule({ as: 'my_auth', match: '*' });
            const result = await extractor.extract(ctx, rule, DOMAINS);

            expect(result!.name).toBe('my_auth');
        });
    });

    describe('match: specific cookie name', () => {
        it('filters to the named cookie only', async () => {
            const ctx = makeCtx([
                { name: 'session_id', value: 'abc123', domain: DOMAIN },
                { name: 'csrf_token', value: 'xyz', domain: DOMAIN },
                { name: 'pref', value: 'dark', domain: DOMAIN },
            ]);
            const rule = makeRule({ as: 'session', match: 'session_id' });
            const result = await extractor.extract(ctx, rule, DOMAINS);

            expect(result).not.toBeNull();
            expect(result!.value).toBe('session_id=abc123');
        });

        it('returns null when the named cookie is not present', async () => {
            const ctx = makeCtx([{ name: 'csrf_token', value: 'xyz', domain: DOMAIN }]);
            const rule = makeRule({ as: 'session', match: 'session_id' });
            const result = await extractor.extract(ctx, rule, DOMAINS);

            expect(result).toBeNull();
        });
    });

    describe('domain filtering', () => {
        it('returns null when no cookies match the provider domains', async () => {
            const ctx = makeCtx([{ name: 'session', value: 'abc', domain: 'other.com' }]);
            const rule = makeRule({ match: '*' });
            const result = await extractor.extract(ctx, rule, DOMAINS);

            expect(result).toBeNull();
        });

        it('matches cookies whose domain has a leading dot', async () => {
            const ctx = makeCtx([{ name: 'session', value: 'abc', domain: '.example.com' }]);
            const rule = makeRule({ match: '*' });
            const result = await extractor.extract(ctx, rule, DOMAINS);

            expect(result).not.toBeNull();
            expect(result!.value).toBe('session=abc');
        });

        it('matches cookies where provider domain is a subdomain of cookie domain', async () => {
            // Cookie set on parent domain, provider is subdomain
            const ctx = makeCtx([{ name: 'token', value: 'xyz', domain: 'example.com' }]);
            const rule = makeRule({ match: '*' });
            const result = await extractor.extract(ctx, rule, ['sub.example.com']);

            expect(result).not.toBeNull();
        });
    });

    describe('cookies metadata', () => {
        it('includes cookies metadata with expiry for non-session cookies', async () => {
            const expiresAt = 9999999999;
            const ctx = makeCtx([
                { name: 'session', value: 'abc', domain: DOMAIN, expires: expiresAt },
                { name: 'pref', value: 'dark', domain: DOMAIN, expires: -1 },
            ]);
            const rule = makeRule({ match: '*' });
            const result = await extractor.extract(ctx, rule, DOMAINS);

            expect(result).not.toBeNull();
            expect(result!.cookies).toBeDefined();
            expect(result!.cookies).toHaveLength(1);
            expect(result!.cookies![0]).toEqual({ name: 'session', expires: expiresAt });
        });

        it('returns empty cookies array when all cookies are session cookies', async () => {
            const ctx = makeCtx([{ name: 'csrf', value: 'tok', domain: DOMAIN, expires: -1 }]);
            const rule = makeRule({ match: '*' });
            const result = await extractor.extract(ctx, rule, DOMAINS);

            expect(result).not.toBeNull();
            expect(result!.cookies).toHaveLength(0);
        });
    });

    it('returns null when no cookies exist', async () => {
        const ctx = makeCtx([]);
        const rule = makeRule({ match: '*' });
        const result = await extractor.extract(ctx, rule, DOMAINS);

        expect(result).toBeNull();
    });
});
