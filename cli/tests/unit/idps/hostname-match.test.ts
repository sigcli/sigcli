import { describe, expect, it } from 'vitest';

import { hostnameMatches } from '../../../src/idps/hostname-match.js';

describe('hostnameMatches', () => {
    it('matches exact hostname', () => {
        expect(hostnameMatches('idp.example.com', 'idp.example.com')).toBe(true);
        expect(hostnameMatches('github.com', 'github.com')).toBe(true);
    });

    it('matches on label boundary (subdomain)', () => {
        expect(hostnameMatches('sub.idp.example.com', 'idp.example.com')).toBe(true);
        expect(hostnameMatches('foo.bar.baz.example.com', 'example.com')).toBe(true);
    });

    it('SECURITY: does NOT match a non-label-boundary suffix', () => {
        // The critical case — evil-github.com should not match github.com.
        expect(hostnameMatches('evil-github.com', 'github.com')).toBe(false);
        expect(hostnameMatches('evilexample.com', 'example.com')).toBe(false);
        expect(hostnameMatches('notidp.example.com'.replace('.', ''), 'idp.example.com')).toBe(
            false,
        );
    });

    it('does NOT match when the separator is missing', () => {
        // The concatenation of two labels without a dot is never a match.
        expect(hostnameMatches('githubXcom', 'github.com')).toBe(false);
        expect(hostnameMatches('subgithub.com', 'github.com')).toBe(false);
    });

    it('is case-insensitive on both sides', () => {
        expect(hostnameMatches('IDP.EXAMPLE.COM', 'idp.example.com')).toBe(true);
        expect(hostnameMatches('idp.example.com', 'IDP.EXAMPLE.COM')).toBe(true);
        expect(hostnameMatches('Idp.Example.com', 'idp.EXAMPLE.COM')).toBe(true);
    });

    it('returns false for unrelated hosts', () => {
        expect(hostnameMatches('example.com', 'github.com')).toBe(false);
        expect(hostnameMatches('idp.example.com', 'idp.other.com')).toBe(false);
    });

    it('returns false when the candidate is a strict parent of the key', () => {
        // example.com is not a subdomain of idp.example.com — it's the other way round.
        expect(hostnameMatches('example.com', 'idp.example.com')).toBe(false);
    });

    it('strips trailing DNS dot from candidate and key', () => {
        expect(hostnameMatches('github.com.', 'github.com')).toBe(true);
        expect(hostnameMatches('github.com', 'github.com.')).toBe(true);
        expect(hostnameMatches('idp.example.com.', 'example.com')).toBe(true);
    });
});
