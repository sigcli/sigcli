import type { ProviderConfig } from '../types/index.js';
import { addProviderToConfig } from '../config/loader.js';
import type { ProviderEntry } from '../config/schema.js';

/**
 * Convert runtime ProviderConfig to the YAML ProviderEntry format for persistence.
 */
export function toProviderEntry(pc: ProviderConfig): ProviderEntry {
    return {
        ...(pc.name !== pc.id ? { name: pc.name } : {}),
        domains: pc.domains,
        ...(pc.entryUrl ? { entryUrl: pc.entryUrl } : {}),
        strategy: pc.strategy as ProviderEntry['strategy'],
        ...(pc.extract.length > 0 ? { extract: pc.extract } : {}),
        apply: pc.apply,
        ...(pc.ttl ? { ttl: pc.ttl } : {}),
        ...(pc.networkProxy ? { networkProxy: pc.networkProxy } : {}),
        ...(pc.loginMode ? { loginMode: pc.loginMode } : {}),
        ...(pc.oauth2
            ? {
                  oauth2: {
                      tokenUrl: pc.oauth2.tokenUrl,
                      ...(pc.oauth2.scopes?.length ? { scopes: pc.oauth2.scopes } : {}),
                  },
              }
            : {}),
    };
}

/**
 * Persist an auto-provisioned provider to config.yaml so it's available for future use.
 * No-op if the provider was not auto-provisioned.
 */
export async function persistIfAutoProvisioned(provider: ProviderConfig): Promise<void> {
    if (provider.autoProvisioned) {
        await addProviderToConfig(provider.id, toProviderEntry(provider));
    }
}
