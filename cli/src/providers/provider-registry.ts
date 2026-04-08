import type { IProviderRegistry } from '../core/interfaces/provider.js';
import type { ProviderConfig } from '../core/types.js';

/**
 * Registry for provider configurations.
 * Resolves URLs to providers using glob-style domain matching.
 *
 * Domain matching rules:
 * - Exact: "api.example.com" matches only "api.example.com"
 * - Wildcard: "*.example.com" matches "api.example.com", "www.example.com", etc.
 * - Exact matches take priority over wildcard matches.
 */
export class ProviderRegistry implements IProviderRegistry {
  private providers = new Map<string, ProviderConfig>();

  constructor(initialProviders: ProviderConfig[] = []) {
    for (const provider of initialProviders) {
      this.providers.set(provider.id, provider);
    }
  }

  resolve(url: string): ProviderConfig | null {
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      // If URL parsing fails, treat the input as a hostname
      hostname = url;
    }

    // First pass: exact domain match (higher priority)
    for (const provider of this.providers.values()) {
      for (const domain of provider.domains) {
        if (!domain.includes('*') && hostname === domain) {
          return provider;
        }
      }
    }

    // Second pass: glob/wildcard match
    for (const provider of this.providers.values()) {
      for (const domain of provider.domains) {
        if (domain.includes('*') && matchGlob(hostname, domain)) {
          return provider;
        }
      }
    }

    return null;
  }

  get(id: string): ProviderConfig | null {
    return this.providers.get(id) ?? null;
  }

  list(): ProviderConfig[] {
    return Array.from(this.providers.values());
  }

  register(provider: ProviderConfig): void {
    this.providers.set(provider.id, provider);
  }

  resolveFlexible(input: string): ProviderConfig | null {
    // 1. Exact ID match
    const byId = this.providers.get(input);
    if (byId) return byId;

    // 2. Case-insensitive name match
    const inputLower = input.toLowerCase();
    for (const provider of this.providers.values()) {
      if (provider.name.toLowerCase() === inputLower) {
        return provider;
      }
    }

    // 3. URL/domain match (existing behavior)
    return this.resolve(input);
  }
}

/**
 * Simple glob matching for domain patterns.
 * Supports only "*" as a wildcard segment prefix.
 * Examples:
 *   "*.example.com" matches "api.example.com", "www.example.com"
 *   "*.*.example.com" matches "a.b.example.com"
 */
function matchGlob(hostname: string, pattern: string): boolean {
  // Convert glob to regex: *.example.com → ^[^.]+\.example\.com$
  const escaped = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '[^.]+');
  const regex = new RegExp(`^${escaped}$`, 'i');
  return regex.test(hostname);
}
