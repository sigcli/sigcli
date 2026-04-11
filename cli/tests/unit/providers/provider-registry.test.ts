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
    expect(list.map((p) => p.id).sort()).toEqual(['github', 'jira']);
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

  it('unregisters a provider by ID', () => {
    const registry = new ProviderRegistry([jiraProvider, githubProvider]);
    expect(registry.unregister('jira')).toBe(true);
    expect(registry.get('jira')).toBeNull();
    expect(registry.list()).toHaveLength(1);
  });

  it('unregister returns false for non-existent ID', () => {
    const registry = new ProviderRegistry([jiraProvider]);
    expect(registry.unregister('nonexistent')).toBe(false);
  });

  describe('resolveFlexible', () => {
    it('resolves by exact provider ID', () => {
      const registry = new ProviderRegistry([jiraProvider, githubProvider]);
      expect(registry.resolveFlexible('jira')?.id).toBe('jira');
      expect(registry.resolveFlexible('github')?.id).toBe('github');
    });

    it('resolves by name (case-insensitive)', () => {
      const registry = new ProviderRegistry([jiraProvider, githubProvider]);
      expect(registry.resolveFlexible('My Jira')?.id).toBe('jira');
      expect(registry.resolveFlexible('my jira')?.id).toBe('jira');
      expect(registry.resolveFlexible('MY JIRA')?.id).toBe('jira');
      expect(registry.resolveFlexible('GitHub')?.id).toBe('github');
      expect(registry.resolveFlexible('github')?.id).toBe('github'); // matches ID first, same result
    });

    it('resolves by full URL (existing behavior preserved)', () => {
      const registry = new ProviderRegistry([jiraProvider, githubProvider]);
      expect(registry.resolveFlexible('https://jira.example.com/browse/PROJ-1')?.id).toBe('jira');
      expect(registry.resolveFlexible('https://api.github.com/repos')?.id).toBe('github');
    });

    it('resolves by bare hostname', () => {
      const registry = new ProviderRegistry([jiraProvider]);
      expect(registry.resolveFlexible('jira.example.com')?.id).toBe('jira');
    });

    it('ID takes priority over name', () => {
      // Create a provider whose ID is the same string as another provider's name
      const providerA: ProviderConfig = {
        id: 'GitHub',
        name: 'Provider A',
        domains: ['a.example.com'],
        strategy: 'cookie',
        strategyConfig: {},
      };
      const providerB: ProviderConfig = {
        id: 'provider-b',
        name: 'GitHub',
        domains: ['b.example.com'],
        strategy: 'cookie',
        strategyConfig: {},
      };
      const registry = new ProviderRegistry([providerA, providerB]);
      // "GitHub" should match providerA by ID, not providerB by name
      expect(registry.resolveFlexible('GitHub')?.id).toBe('GitHub');
    });

    it('ID takes priority over domain', () => {
      // Create a provider whose ID matches a hostname that another provider's domain covers
      const domainProvider: ProviderConfig = {
        id: 'corp-jira',
        name: 'Corp Jira',
        domains: ['myapp'],
        strategy: 'cookie',
        strategyConfig: {},
      };
      const idProvider: ProviderConfig = {
        id: 'myapp',
        name: 'My App',
        domains: ['myapp.example.com'],
        strategy: 'cookie',
        strategyConfig: {},
      };
      const registry = new ProviderRegistry([domainProvider, idProvider]);
      // "myapp" should match idProvider by ID, not domainProvider by domain
      expect(registry.resolveFlexible('myapp')?.id).toBe('myapp');
    });

    it('returns null for no match', () => {
      const registry = new ProviderRegistry([jiraProvider, githubProvider]);
      expect(registry.resolveFlexible('nonexistent')).toBeNull();
      expect(registry.resolveFlexible('some-random-thing')).toBeNull();
    });

    it('empty string returns null', () => {
      const registry = new ProviderRegistry([jiraProvider, githubProvider]);
      expect(registry.resolveFlexible('')).toBeNull();
    });
  });
});
