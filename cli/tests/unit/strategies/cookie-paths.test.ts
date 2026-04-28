import { describe, it, expect } from 'vitest';
import { buildCookieUrls } from '../../../src/strategies/cookie.strategy.js';

describe('buildCookieUrls', () => {
    // ---- backward compatibility: no cookiePaths ----

    it('produces domain roots only when cookiePaths is empty (backward compat)', () => {
        const urls = buildCookieUrls(['wiki.one.int.sap'], []);
        expect(urls).toEqual(['https://wiki.one.int.sap/']);
    });

    it('produces domain roots for multiple domains when cookiePaths is empty', () => {
        const urls = buildCookieUrls(['a.com', 'b.com'], []);
        expect(urls).toEqual(['https://a.com/', 'https://b.com/']);
    });

    // ---- with cookiePaths ----

    it('produces cartesian product of domains × (root ∪ cookiePaths)', () => {
        const urls = buildCookieUrls(['wiki.one.int.sap'], ['/wiki']);
        expect(urls).toEqual(['https://wiki.one.int.sap/', 'https://wiki.one.int.sap/wiki']);
    });

    it('handles multiple domains × multiple cookiePaths', () => {
        const urls = buildCookieUrls(['a.com', 'b.com'], ['/app', '/api']);
        expect(urls).toEqual([
            'https://a.com/',
            'https://a.com/app',
            'https://a.com/api',
            'https://b.com/',
            'https://b.com/app',
            'https://b.com/api',
        ]);
    });

    it('deduplicates root "/" when cookiePaths contains "/"', () => {
        const urls = buildCookieUrls(['a.com'], ['/', '/wiki']);
        expect(urls).toEqual(['https://a.com/', 'https://a.com/wiki']);
    });

    it('deduplicates repeated cookiePaths entries', () => {
        const urls = buildCookieUrls(['a.com'], ['/wiki', '/wiki']);
        expect(urls).toEqual(['https://a.com/', 'https://a.com/wiki']);
    });
});
