import { describe, expect, it } from 'vitest';

import { IdpRegistry } from '../../../src/idps/idp-registry.js';
import type { IdpEntry } from '../../../src/idps/types.js';

function makeEntry(hostname: string, label?: string): IdpEntry {
    return { hostname, ...(label ? { label } : {}) };
}

describe('IdpRegistry', () => {
    describe('resolve', () => {
        it('returns the entry for an exact match', () => {
            const reg = new IdpRegistry([
                makeEntry('idp.example.com', 'IDP1'),
                makeEntry('idp.other.com', 'Google'),
                makeEntry('github.com', 'GitHub'),
            ]);
            expect(reg.resolve('idp.example.com')?.label).toBe('IDP1');
            expect(reg.resolve('github.com')?.label).toBe('GitHub');
        });

        it('returns the entry for a matching subdomain', () => {
            const reg = new IdpRegistry([
                makeEntry('idp.example.com', 'IDP2'),
                makeEntry('login.other.com', 'IDP1'),
            ]);
            expect(reg.resolve('sub.idp.example.com')?.label).toBe('IDP2');
        });

        it('longest-suffix wins when multiple entries match', () => {
            const reg = new IdpRegistry([
                makeEntry('example.com', 'idp1'),
                makeEntry('idp.example.com', 'idp1-sub'),
            ]);
            expect(reg.resolve('foo.idp.example.com')?.label).toBe('idp1-sub');
            expect(reg.resolve('idp.example.com')?.label).toBe('idp1-sub');
            // A subdomain of example.com that isn't under idp.example.com falls back
            expect(reg.resolve('other.example.com')?.label).toBe('idp1');
        });

        it('returns null when there is no match', () => {
            const reg = new IdpRegistry([makeEntry('idp.example.com')]);
            expect(reg.resolve('example.com')).toBeNull();
            expect(reg.resolve('evil-example.com')).toBeNull();
        });

        it('returns null for an empty candidate', () => {
            const reg = new IdpRegistry([makeEntry('idp.example.com')]);
            expect(reg.resolve('')).toBeNull();
        });

        it('does not match a non-label-boundary suffix', () => {
            const reg = new IdpRegistry([makeEntry('github.com')]);
            expect(reg.resolve('evil-github.com')).toBeNull();
        });
    });

    describe('list', () => {
        it('returns all entries', () => {
            const entries = [makeEntry('a.com'), makeEntry('b.com'), makeEntry('c.com')];
            const reg = new IdpRegistry(entries);
            expect(reg.list()).toHaveLength(3);
        });

        it('returns a copy — mutating the result does not affect the registry', () => {
            const reg = new IdpRegistry([makeEntry('a.com'), makeEntry('b.com')]);
            const first = reg.list();
            first.push(makeEntry('c.com'));
            expect(reg.list()).toHaveLength(2);
        });
    });
});
