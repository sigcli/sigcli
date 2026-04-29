import type { Credential, ProviderConfig } from '../types/types.js';
import type { ExtractedCredentials } from '../types/interfaces/strategy.js';
import type { ProviderConfigV2 } from '../types/extract.js';
import { migrateProvider } from '../config/migration.js';

/**
 * Converts between ExtractedCredentials (v2 flat map) and old Credential format.
 */

/**
 * Convert extracted credentials to old Credential format for backward compat.
 */
export function extractedToCredential(
    extracted: ExtractedCredentials,
    provider: ProviderConfigV2,
): Credential {
    if (extracted.session) {
        const cookies = extracted.session.split('; ').map((pair) => {
            const [name, ...rest] = pair.split('=');
            return {
                name,
                value: rest.join('='),
                domain: provider.domains[0] ?? '',
                path: '/',
                expires: -1,
                httpOnly: false,
                secure: true,
            };
        });
        const extra: Record<string, string> = {};
        for (const [k, v] of Object.entries(extracted)) {
            if (k !== 'session') extra[k] = v;
        }
        return {
            type: 'cookie' as const,
            cookies,
            obtainedAt: new Date().toISOString(),
        };
    }
    if (extracted.access_token) {
        return { type: 'bearer' as const, accessToken: extracted.access_token };
    }
    if (extracted.token) {
        return {
            type: 'api-key' as const,
            key: extracted.token,
            headerName: 'Authorization',
            headerPrefix: 'Bearer',
        };
    }
    const firstValue = Object.values(extracted)[0] ?? '';
    return {
        type: 'cookie' as const,
        cookies: [
            {
                name: 'data',
                value: firstValue,
                domain: provider.domains[0] ?? '',
                path: '/',
                expires: -1,
                httpOnly: false,
                secure: true,
            },
        ],
        obtainedAt: new Date().toISOString(),
    };
}

/**
 * Convert old Credential to ExtractedCredentials (v2 flat map).
 */
export function credentialToExtracted(credential: Credential): ExtractedCredentials {
    switch (credential.type) {
        case 'cookie':
            return {
                session: credential.cookies.map((c) => `${c.name}=${c.value}`).join('; '),
            };
        case 'bearer':
            return { access_token: credential.accessToken };
        case 'api-key':
            return { token: credential.key };
        case 'basic':
            return { credentials: btoa(`${credential.username}:${credential.password}`) };
    }
}

/**
 * Convert old ProviderConfig to ProviderConfigV2.
 */
export function toV2Config(provider: ProviderConfig): ProviderConfigV2 {
    // If provider already has v2 fields, use them directly
    if (provider.extract && provider.apply && provider.strategy) {
        return {
            id: provider.id,
            name: provider.name,
            domains: provider.domains,
            entryUrl: provider.entryUrl,
            strategy: provider.strategy as ProviderConfigV2['strategy'],
            extract: provider.extract as ProviderConfigV2['extract'],
            apply: provider.apply as ProviderConfigV2['apply'],
            required: provider.required,
            cookiePaths: provider.cookiePaths,
            ttl: provider.ttl,
            networkProxy: provider.networkProxy,
        };
    }
    // Fall back to migration for v1 providers
    const migrated = migrateProvider(provider.id, {
        name: provider.name,
        domains: provider.domains,
        entryUrl: provider.entryUrl,
        strategy: provider.strategy,
        networkProxy: provider.networkProxy,
    });
    return { id: provider.id, ...migrated } as unknown as ProviderConfigV2;
}
