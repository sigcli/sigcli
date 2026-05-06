import type { ExtractedCredentials } from '../types/index.js';

export interface CredentialEnvOptions {
    expandCookies?: boolean;
    prefix?: string;
}

export function normalizeKey(key: string): string {
    return key.toUpperCase().replace(/-/g, '_');
}

/**
 * Convert extracted credentials (flat key-value map) to environment variables.
 * Each key becomes SIG_<PROVIDER>_<KEY> (uppercased, dashes to underscores).
 */
export function credentialToEnvVars(
    credentials: ExtractedCredentials,
    providerId: string,
    options: CredentialEnvOptions,
): Record<string, string> {
    const p = options.prefix ?? `SIG_${normalizeKey(providerId)}`;
    const env: Record<string, string> = {
        [`${p}_PROVIDER`]: providerId,
    };

    for (const [key, value] of Object.entries(credentials)) {
        env[`${p}_${normalizeKey(key)}`] = value;
    }

    return env;
}
