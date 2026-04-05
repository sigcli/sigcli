import { describe, it, expect } from 'vitest';
import { createDefaultProvider } from '../../../src/providers/auto-provision.js';

describe('createDefaultProvider', () => {
  it('creates provider from full URL with path', () => {
    const provider = createDefaultProvider('https://jira.example.com/browse/PROJ-1');

    expect(provider.id).toBe('jira.example.com');
    expect(provider.name).toBe('jira.example.com');
    expect(provider.strategy).toBe('cookie');
    expect(provider.domains).toEqual(['jira.example.com']);
    expect(provider.entryUrl).toBe('https://jira.example.com/');
    expect(provider.autoProvisioned).toBe(true);
    expect(provider.strategyConfig).toEqual({ strategy: 'cookie' });
  });

  it('creates provider from bare hostname (auto-prepends https://)', () => {
    const provider = createDefaultProvider('jira.example.com');

    expect(provider.id).toBe('jira.example.com');
    expect(provider.domains).toEqual(['jira.example.com']);
    expect(provider.entryUrl).toBe('https://jira.example.com/');
    expect(provider.strategy).toBe('cookie');
    expect(provider.autoProvisioned).toBe(true);
  });

  it('handles URL with port', () => {
    const provider = createDefaultProvider('https://internal.corp:8443/app');

    expect(provider.id).toBe('internal.corp');
    expect(provider.domains).toEqual(['internal.corp']);
    expect(provider.entryUrl).toBe('https://internal.corp:8443/');
    expect(provider.autoProvisioned).toBe(true);
  });

  it('preserves http protocol', () => {
    const provider = createDefaultProvider('http://insecure.local/path');

    expect(provider.id).toBe('insecure.local');
    expect(provider.domains).toEqual(['insecure.local']);
    expect(provider.entryUrl).toBe('http://insecure.local/');
    expect(provider.strategy).toBe('cookie');
    expect(provider.autoProvisioned).toBe(true);
  });

  it('handles URL with trailing slash only', () => {
    const provider = createDefaultProvider('https://app.example.com/');

    expect(provider.id).toBe('app.example.com');
    expect(provider.entryUrl).toBe('https://app.example.com/');
  });

  it('handles URL with query string and fragment', () => {
    const provider = createDefaultProvider('https://app.example.com/page?foo=bar#section');

    expect(provider.id).toBe('app.example.com');
    expect(provider.entryUrl).toBe('https://app.example.com/');
    expect(provider.domains).toEqual(['app.example.com']);
  });

  it('produces deterministic provider ID from hostname', () => {
    const p1 = createDefaultProvider('https://site.example.com/path1');
    const p2 = createDefaultProvider('https://site.example.com/path2');

    expect(p1.id).toBe(p2.id);
    expect(p1.entryUrl).toBe(p2.entryUrl);
  });
});
