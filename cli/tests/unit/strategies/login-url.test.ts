import { describe, expect, it } from 'vitest';

import { LoginPageDetector } from '../../../src/strategies/browser/login-detector.js';

const detector = new LoginPageDetector();

describe('login URL pattern scoping', () => {
    it.each(['login', 'auth', 'sso'])('does not treat the %s subdomain as a login path', (name) => {
        expect(detector.isLoginUrl(`https://${name}.example.test/dashboard`)).toBe(false);
    });

    it.each([
        'https://app.example.test/dashboard?next=/login',
        'https://app.example.test/dashboard?next=https://accounts.google.com/login',
        'https://app.example.test/dashboard#help=/login',
        'https://app.example.test/accounts.google.com/dashboard',
        'https://accounts.google.com.example.test/dashboard',
        'https://notaccounts.google.com/dashboard',
    ])('ignores incidental built-in pattern matches in %s', (url) => {
        expect(detector.isLoginUrl(url)).toBe(false);
    });

    it.each([
        'https://app.example.test/login',
        'https://app.example.test/auth/callback',
        'https://app.example.test/#/login',
        'https://app.example.test/#!/signin',
        'https://app.example.test/#/auth?next=/dashboard',
        'https://accounts.google.com/',
        'https://sub.accounts.google.com/',
        '/login?next=/dashboard',
        '//accounts.google.com/',
    ])('still detects genuine login routes or identity-provider hosts in %s', (url) => {
        expect(detector.isLoginUrl(url)).toBe(true);
    });

    it('does not treat a query inside a SPA route as the route pathname', () => {
        expect(detector.isLoginUrl('https://app.example.test/#/dashboard?next=/login')).toBe(false);
    });

    it('preserves explicit custom full-URL substring patterns, case-insensitively', () => {
        expect(
            detector.isLoginUrl('https://app.example.test/dashboard?flow=CHALLENGE', [
                'flow=challenge',
            ]),
        ).toBe(true);
        expect(
            detector.isLoginUrl('https://app.example.test/#verify-account', ['#verify-account']),
        ).toBe(true);
        expect(detector.isLoginUrl('https://app.example.test/?next=/captcha', ['/captcha'])).toBe(
            true,
        );
    });

    it.each(['', 'http://['])('handles an empty or malformed URL without throwing', (url) => {
        expect(detector.isLoginUrl(url)).toBe(false);
    });

    it('still checks the DOM on an authenticated-looking URL', async () => {
        const evaluate = async <T>() => true as T;
        expect(await detector.isLoginPage('https://login.example.test/dashboard', evaluate)).toBe(
            true,
        );
    });
});
