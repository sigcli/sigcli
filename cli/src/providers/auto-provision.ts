import type { ProviderConfig } from '../core/types.js';

/**
 * Create a default provider config from a URL.
 * Used for auto-provisioning when no configured provider matches.
 *
 * Defaults to cookie strategy (most common for SSO).
 * Provider ID = hostname, making it deterministic across restarts.
 */
export function createDefaultProvider(url: string): ProviderConfig {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Treat as hostname — try adding https://
    parsed = new URL(`https://${url}`);
  }

  const hostname = parsed.hostname;

  return {
    id: hostname,
    name: hostname,
    domains: [hostname],
    entryUrl: `${parsed.protocol}//${parsed.host}/`,
    strategy: 'cookie',
    strategyConfig: { strategy: 'cookie' },
    autoProvisioned: true,
  };
}
