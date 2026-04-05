import { describe, it, expect } from 'vitest';
import { ProviderRegistry } from '../../../src/providers/provider-registry.js';
import type { ProviderConfig } from '../../../src/core/types.js';

const jiraProvider: ProviderConfig = {
  id: 'jira',
  name: 'My Jira',
  domains: ['jira.example.com'],
  entryUrl: 'https://jira.example.com/',
  strategy: 'cookie',
  strategyConfig: { ttl: '24h' },
};

const githubProvider: ProviderConfig = {
  id: 'github',
  name: 'GitHub',
  domains: ['github.com', 'api.github.com'],
  strategy: 'api-token',
  strategyConfig: {},
};

const wildcardProvider: ProviderConfig = {
  id: 'atlassian',
  name: 'Atlassian Cloud',
  domains: ['*.atlassian.net'],
  strategy: 'cookie',
  strategyConfig: {},
};

describe('ProviderRegistry', () => {
  it('resolves by exact domain', () => {
    const registry = new ProviderRegistry([jiraProvider, githubProvider]);
    expect(registry.resolve('https://jira.example.com/browse/PROJ-1')?.id).toBe('jira');
    expect(registry.resolve('https://api.github.com/repos')?.id).toBe('github');
  });

  it('returns null for unknown URL', () => {
    const registry = new ProviderRegistry([jiraProvider]);
    expect(registry.resolve('https://unknown.example.com')).toBeNull();
  });

  it('resolves by wildcard domain', () => {
    const registry = new ProviderRegistry([wildcardProvider]);
    expect(registry.resolve('https://mycompany.atlassian.net/jira')?.id).toBe('atlassian');
    expect(registry.resolve('https://other.atlassian.net')?.id).toBe('atlassian');
  });

  it('exact match takes priority over wildcard', () => {
    const exactProvider: ProviderConfig = {
      ...wildcardProvider,
      id: 'exact-atlassian',
      domains: ['mycompany.atlassian.net'],
    };
    const registry = new ProviderRegistry([wildcardProvider, exactProvider]);
    expect(registry.resolve('https://mycompany.atlassian.net')?.id).toBe('exact-atlassian');
    expect(registry.resolve('https://other.atlassian.net')?.id).toBe('atlassian');
  });

  it('gets provider by ID', () => {
    const registry = new ProviderRegistry([jiraProvider, githubProvider]);
    expect(registry.get('jira')?.name).toBe('My Jira');
    expect(registry.get('unknown')).toBeNull();
  });

  it('lists all providers', () => {
    const registry = new ProviderRegistry([jiraProvider, githubProvider]);
    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map(p => p.id).sort()).toEqual(['github', 'jira']);
  });

  it('registers new provider at runtime', () => {
    const registry = new ProviderRegistry([]);
    registry.register(jiraProvider);
    expect(registry.get('jira')?.name).toBe('My Jira');
  });

  it('overwrites existing provider on register', () => {
    const registry = new ProviderRegistry([jiraProvider]);
    registry.register({ ...jiraProvider, name: 'Updated Jira' });
    expect(registry.get('jira')?.name).toBe('Updated Jira');
  });
});
