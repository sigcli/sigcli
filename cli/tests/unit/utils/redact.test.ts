import { describe, it, expect } from 'vitest';
import {
    extractSensitiveValues,
    redactOutput,
    createRedactTransform,
} from '../../../src/utils/redact.js';
import type { CookieCredential, BearerCredential } from '../../../src/core/types.js';
import type { Cookie } from '../../../src/core/types.js';

function makeCookie(name: string, value: string): Cookie {
    return {
        name,
        value,
        domain: 'example.com',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
    };
}

describe('extractSensitiveValues', () => {
    it('extracts bearer accessToken', () => {
        const cred: BearerCredential = { type: 'bearer', accessToken: 'eyJhbGciOiJSUzI1NiJ9' };
        const secrets = extractSensitiveValues(cred);
        expect(secrets).toContain('eyJhbGciOiJSUzI1NiJ9');
    });

    it('extracts cookie values (long enough)', () => {
        const cred: CookieCredential = {
            type: 'cookie',
            cookies: [makeCookie('session', 'abcdef123456'), makeCookie('short', 'abc')],
            obtainedAt: new Date().toISOString(),
        };
        const secrets = extractSensitiveValues(cred);
        expect(secrets).toContain('abcdef123456');
        expect(secrets).not.toContain('abc');
    });

    it('extracts xHeader values', () => {
        const cred: CookieCredential = {
            type: 'cookie',
            cookies: [],
            obtainedAt: new Date().toISOString(),
            xHeaders: { 'x-csrf-token': 'longcsrftokenvalue' },
        };
        const secrets = extractSensitiveValues(cred);
        expect(secrets).toContain('longcsrftokenvalue');
    });

    it('extracts localStorage values', () => {
        const cred: CookieCredential = {
            type: 'cookie',
            cookies: [],
            obtainedAt: new Date().toISOString(),
            localStorage: { token: 'xoxc-longtoken12345' },
        };
        const secrets = extractSensitiveValues(cred);
        expect(secrets).toContain('xoxc-longtoken12345');
    });
});

describe('redactOutput', () => {
    it('replaces a known secret with ****', () => {
        const result = redactOutput('token is eyJhbGciOiJSUzI1NiJ9 end', ['eyJhbGciOiJSUzI1NiJ9']);
        expect(result).toBe('token is **** end');
    });

    it('replaces multiple secrets in a single string', () => {
        const result = redactOutput('a=abcdef123456 b=longcookievalue99', [
            'abcdef123456',
            'longcookievalue99',
        ]);
        expect(result).toBe('a=**** b=****');
    });

    it('does not replace short values (< 8 chars)', () => {
        const result = redactOutput('value is abc end', ['abc']);
        expect(result).toBe('value is abc end');
    });

    it('returns text unchanged when no secrets', () => {
        const result = redactOutput('hello world', []);
        expect(result).toBe('hello world');
    });

    it('replaces all occurrences of a secret', () => {
        const result = redactOutput('token=abcdef12345 token=abcdef12345', ['abcdef12345']);
        expect(result).toBe('token=**** token=****');
    });
});

describe('createRedactTransform', () => {
    it('passes through text without secrets unchanged', async () => {
        const transform = createRedactTransform([]);
        const chunks: string[] = [];
        transform.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));

        await new Promise<void>((resolve) => {
            transform.on('end', resolve);
            transform.write('hello world\n');
            transform.end();
        });

        expect(chunks.join('')).toContain('hello world');
    });

    it('redacts secrets in streaming data', async () => {
        const secret = 'supersecrettoken12345';
        const transform = createRedactTransform([secret]);
        const chunks: string[] = [];
        transform.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));

        await new Promise<void>((resolve) => {
            transform.on('end', resolve);
            transform.write(`my token is ${secret} done\n`);
            transform.end();
        });

        const output = chunks.join('');
        expect(output).not.toContain(secret);
        expect(output).toContain('****');
    });
});
