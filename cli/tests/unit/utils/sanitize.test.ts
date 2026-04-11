import { describe, it, expect } from 'vitest';
import { sanitizeId } from '../../../src/utils/sanitize.js';

describe('sanitizeId', () => {
    it('passes through simple alphanumeric ids', () => {
        expect(sanitizeId('jira')).toBe('jira');
        expect(sanitizeId('github')).toBe('github');
        expect(sanitizeId('myProvider123')).toBe('myProvider123');
    });

    it('allows dots, hyphens, and underscores', () => {
        expect(sanitizeId('my-provider')).toBe('my-provider');
        expect(sanitizeId('my_provider')).toBe('my_provider');
        expect(sanitizeId('my.provider')).toBe('my.provider');
        expect(sanitizeId('a.b-c_d')).toBe('a.b-c_d');
    });

    it('replaces spaces with underscores', () => {
        expect(sanitizeId('my provider')).toBe('my_provider');
        expect(sanitizeId('a b c')).toBe('a_b_c');
    });

    it('replaces slashes with underscores', () => {
        expect(sanitizeId('path/to/thing')).toBe('path_to_thing');
        expect(sanitizeId('a\\b')).toBe('a_b');
    });

    it('replaces special characters with underscores', () => {
        expect(sanitizeId('pro@vider')).toBe('pro_vider');
        expect(sanitizeId('pro!vider')).toBe('pro_vider');
        expect(sanitizeId('pro#vider')).toBe('pro_vider');
        expect(sanitizeId('pro$vider')).toBe('pro_vider');
        expect(sanitizeId('foo:bar')).toBe('foo_bar');
        expect(sanitizeId('foo=bar')).toBe('foo_bar');
    });

    it('replaces multiple consecutive unsafe chars individually', () => {
        expect(sanitizeId('a@#b')).toBe('a__b');
        expect(sanitizeId('a   b')).toBe('a___b');
    });

    it('handles URLs by replacing all unsafe characters', () => {
        expect(sanitizeId('https://example.com/api')).toBe('https___example.com_api');
    });

    it('returns empty string for empty input', () => {
        expect(sanitizeId('')).toBe('');
    });

    it('replaces all non-ASCII characters', () => {
        expect(sanitizeId('caf\u00e9')).toBe('caf_');
        expect(sanitizeId('\u00fcber')).toBe('_ber');
    });

    it('handles strings that are entirely unsafe characters', () => {
        expect(sanitizeId('!!!')).toBe('___');
        expect(sanitizeId('@#$')).toBe('___');
    });

    it('preserves case', () => {
        expect(sanitizeId('MyProvider')).toBe('MyProvider');
        expect(sanitizeId('ABC')).toBe('ABC');
        expect(sanitizeId('abc')).toBe('abc');
    });
});
