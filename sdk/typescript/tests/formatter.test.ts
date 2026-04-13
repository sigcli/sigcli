import { describe, it, expect } from 'vitest';
import { formatHeaders, extractLocalStorage } from '../src/formatter.js';
import type { CookieCredential, BearerCredential, ApiKeyCredential, BasicCredential } from '../src/types.js';

describe('formatHeaders', () => {
  it('formats cookie credentials', () => {
    const cred: CookieCredential = {
      type: 'cookie',
      cookies: [
        { name: 'sid', value: 'abc123', domain: '.example.com', path: '/', expires: -1, httpOnly: true, secure: true },
        { name: 'csrf', value: 'xyz789', domain: '.example.com', path: '/', expires: 1750000000, httpOnly: false, secure: true },
      ],
      obtainedAt: '2026-04-13T10:00:00.000Z',
    };
    const headers = formatHeaders(cred);
    expect(headers).toEqual({ Cookie: 'sid=abc123; csrf=xyz789' });
  });

  it('formats bearer credentials', () => {
    const cred: BearerCredential = {
      type: 'bearer',
      accessToken: 'eyJhbGciOiJSUzI1NiJ9.test',
    };
    const headers = formatHeaders(cred);
    expect(headers).toEqual({ Authorization: 'Bearer eyJhbGciOiJSUzI1NiJ9.test' });
  });

  it('formats api-key credentials with prefix', () => {
    const cred: ApiKeyCredential = {
      type: 'api-key',
      key: 'ghp_test123456',
      headerName: 'Authorization',
      headerPrefix: 'Bearer',
    };
    const headers = formatHeaders(cred);
    expect(headers).toEqual({ Authorization: 'Bearer ghp_test123456' });
  });

  it('formats api-key credentials without prefix', () => {
    const cred: ApiKeyCredential = {
      type: 'api-key',
      key: 'my-raw-key',
      headerName: 'X-API-Key',
    };
    const headers = formatHeaders(cred);
    expect(headers).toEqual({ 'X-API-Key': 'my-raw-key' });
  });

  it('formats basic credentials', () => {
    const cred: BasicCredential = {
      type: 'basic',
      username: 'admin',
      password: 's3cret',
    };
    const headers = formatHeaders(cred);
    const expected = Buffer.from('admin:s3cret').toString('base64');
    expect(headers).toEqual({ Authorization: `Basic ${expected}` });
  });

  it('includes xHeaders for cookie credentials', () => {
    const cred: CookieCredential = {
      type: 'cookie',
      cookies: [
        { name: 'id_token', value: 'tok123', domain: '.xiaohongshu.com', path: '/', expires: -1, httpOnly: true, secure: true },
      ],
      obtainedAt: '2026-04-13T10:00:00.000Z',
      xHeaders: {
        'x-csrf-token': 'csrf-abc',
        origin: 'https://www.xiaohongshu.com',
      },
    };
    const headers = formatHeaders(cred);
    expect(headers['Cookie']).toBe('id_token=tok123');
    expect(headers['x-csrf-token']).toBe('csrf-abc');
    expect(headers['origin']).toBe('https://www.xiaohongshu.com');
  });

  it('includes xHeaders for bearer credentials', () => {
    const cred: BearerCredential = {
      type: 'bearer',
      accessToken: 'tok',
      xHeaders: { 'X-Custom': 'val' },
    };
    const headers = formatHeaders(cred);
    expect(headers['Authorization']).toBe('Bearer tok');
    expect(headers['X-Custom']).toBe('val');
  });

  it('Cookie header overwrites any xHeaders Cookie', () => {
    const cred: CookieCredential = {
      type: 'cookie',
      cookies: [
        { name: 'a', value: 'b', domain: '.x.com', path: '/', expires: -1, httpOnly: false, secure: false },
      ],
      obtainedAt: '2026-04-13T10:00:00.000Z',
      xHeaders: { Cookie: 'should-be-overwritten' },
    };
    const headers = formatHeaders(cred);
    expect(headers['Cookie']).toBe('a=b');
  });

  it('Authorization header overwrites any xHeaders Authorization for bearer', () => {
    const cred: BearerCredential = {
      type: 'bearer',
      accessToken: 'real-token',
      xHeaders: { Authorization: 'should-be-overwritten' },
    };
    const headers = formatHeaders(cred);
    expect(headers['Authorization']).toBe('Bearer real-token');
  });

  it('formats cookie credential with empty cookies array', () => {
    const cred: CookieCredential = {
      type: 'cookie',
      cookies: [],
      obtainedAt: '2026-04-13T10:00:00.000Z',
    };
    const headers = formatHeaders(cred);
    expect(headers['Cookie']).toBe('');
  });

  it('formats single cookie without trailing semicolon', () => {
    const cred: CookieCredential = {
      type: 'cookie',
      cookies: [
        { name: 'only', value: 'one', domain: '.x.com', path: '/', expires: -1, httpOnly: false, secure: false },
      ],
      obtainedAt: '2026-04-13T10:00:00.000Z',
    };
    const headers = formatHeaders(cred);
    expect(headers['Cookie']).toBe('only=one');
    expect(headers['Cookie']).not.toContain(';');
  });

  it('handles cookie credential with both xHeaders and localStorage', () => {
    const cred: CookieCredential = {
      type: 'cookie',
      cookies: [
        { name: 'd', value: 'xoxd-abc', domain: '.slack.com', path: '/', expires: -1, httpOnly: true, secure: true },
      ],
      obtainedAt: '2026-04-13T10:00:00.000Z',
      xHeaders: { 'x-custom': 'val' },
      localStorage: { token: 'xoxc-123' },
    };
    const headers = formatHeaders(cred);
    expect(headers['Cookie']).toBe('d=xoxd-abc');
    expect(headers['x-custom']).toBe('val');
    // localStorage should NOT appear in headers
    expect(headers['token']).toBeUndefined();
  });
});

describe('extractLocalStorage', () => {
  it('extracts localStorage from cookie credential', () => {
    const cred: CookieCredential = {
      type: 'cookie',
      cookies: [],
      obtainedAt: '2026-04-13T10:00:00.000Z',
      localStorage: { token: 'xoxc-123' },
    };
    expect(extractLocalStorage(cred)).toEqual({ token: 'xoxc-123' });
  });

  it('extracts localStorage from bearer credential', () => {
    const cred: BearerCredential = {
      type: 'bearer',
      accessToken: 'tok',
      localStorage: { key: 'val' },
    };
    expect(extractLocalStorage(cred)).toEqual({ key: 'val' });
  });

  it('returns empty object for api-key credential', () => {
    const cred: ApiKeyCredential = {
      type: 'api-key',
      key: 'k',
      headerName: 'X-Key',
    };
    expect(extractLocalStorage(cred)).toEqual({});
  });

  it('returns empty object for basic credential', () => {
    const cred: BasicCredential = {
      type: 'basic',
      username: 'u',
      password: 'p',
    };
    expect(extractLocalStorage(cred)).toEqual({});
  });

  it('returns empty object when localStorage is undefined', () => {
    const cred: CookieCredential = {
      type: 'cookie',
      cookies: [],
      obtainedAt: '2026-04-13T10:00:00.000Z',
    };
    expect(extractLocalStorage(cred)).toEqual({});
  });

  it('returns empty object when bearer localStorage is undefined', () => {
    const cred: BearerCredential = {
      type: 'bearer',
      accessToken: 'tok',
    };
    expect(extractLocalStorage(cred)).toEqual({});
  });

  it('returns a copy that does not mutate the original', () => {
    const cred: CookieCredential = {
      type: 'cookie',
      cookies: [],
      obtainedAt: '2026-04-13T10:00:00.000Z',
      localStorage: { key: 'val' },
    };
    const result = extractLocalStorage(cred);
    result['key'] = 'mutated';
    expect(cred.localStorage!['key']).toBe('val');
  });
});
