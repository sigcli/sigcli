import type { ProviderConfig } from '../types.js';

/**
 * Registry for provider configurations.
 * Providers are loaded from YAML config files and can be registered at runtime.
 */
export interface IProviderRegistry {
    /** Resolve a provider by matching a URL against registered domains. */
    resolve(url: string): ProviderConfig | null;

    /** Get a provider by its ID. */
    get(id: string): ProviderConfig | null;

    /** List all registered providers. */
    list(): ProviderConfig[];

    /** Register a new provider at runtime. Overwrites if ID already exists. */
    register(provider: ProviderConfig): void;

    /** Remove a provider by ID. Returns true if it existed. */
    unregister(id: string): boolean;

    /** Resolve a provider by ID, name (case-insensitive), or URL/domain, in that order. */
    resolveFlexible(input: string): ProviderConfig | null;
}
