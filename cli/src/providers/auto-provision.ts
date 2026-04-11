import type { ProviderConfig } from '../core/types.js';

/**
 * Derive a short, human-friendly provider ID from a hostname.
 *
 * - If the first subdomain segment is >= 8 chars, use it as-is
 *   (e.g., "bdc-cockpit-starkiller-hc-ga" from the long SAP URL)
 * - If < 8 chars, join first two segments with "-"
 *   (e.g., "jira-tools" from "jira.tools.sap")
 *
 * If the derived ID collides with existingIds, appends -2, -3, etc.
 */
export function deriveShortId(hostname: string, existingIds?: Set<string>): string {
    const parts = hostname.split('.');
    let base: string;

    if (parts[0].length >= 8) {
        base = parts[0];
    } else if (parts.length >= 2) {
        base = `${parts[0]}-${parts[1]}`;
    } else {
        base = parts[0];
    }

    if (!existingIds || !existingIds.has(base)) {
        return base;
    }

    let suffix = 2;
    while (existingIds.has(`${base}-${suffix}`)) {
        suffix++;
    }
    return `${base}-${suffix}`;
}

/**
 * Create a default provider config from a URL.
 * Used for auto-provisioning when no configured provider matches.
 *
 * Defaults to cookie strategy (most common for SSO).
 * Provider ID is derived as a short, human-friendly string from the hostname.
 * Full hostname is kept in name and domains for resolution.
 */
export function createDefaultProvider(url: string, existingIds?: Set<string>): ProviderConfig {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        // Treat as hostname — try adding https://
        parsed = new URL(`https://${url}`);
    }

    const hostname = parsed.hostname;
    const id = deriveShortId(hostname, existingIds);

    return {
        id,
        name: hostname,
        domains: [hostname],
        entryUrl: `${parsed.protocol}//${parsed.host}/`,
        strategy: 'cookie',
        strategyConfig: { strategy: 'cookie' },
        autoProvisioned: true,
    };
}
