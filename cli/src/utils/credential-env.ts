import type { Credential } from '../core/types.js';

export interface CredentialEnvOptions {
    expandCookies?: boolean;
    prefix?: string;
}

export function normalizeKey(key: string): string {
    return key.toUpperCase().replace(/-/g, '_');
}

export function credentialToEnvVars(
    credential: Credential,
    providerId: string,
    options: CredentialEnvOptions,
): Record<string, string> {
    const p = options.prefix ?? `SIG_${normalizeKey(providerId)}`;
    const env: Record<string, string> = {
        [`${p}_PROVIDER`]: providerId,
        [`${p}_CREDENTIAL_TYPE`]: credential.type,
    };

    switch (credential.type) {
        case 'bearer': {
            env[`${p}_TOKEN`] = credential.accessToken;
            env[`${p}_AUTH_HEADER`] = `Bearer ${credential.accessToken}`;
            if (credential.xHeaders) {
                for (const [k, v] of Object.entries(credential.xHeaders)) {
                    env[`${p}_HEADER_${normalizeKey(k)}`] = v;
                }
            }
            if (credential.localStorage) {
                for (const [k, v] of Object.entries(credential.localStorage)) {
                    env[`${p}_LOCAL_${normalizeKey(k)}`] = v;
                }
            }
            break;
        }
        case 'cookie': {
            env[`${p}_COOKIE`] = credential.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
            if (options.expandCookies) {
                for (const c of credential.cookies) {
                    env[`${p}_COOKIE_${normalizeKey(c.name)}`] = c.value;
                }
            }
            if (credential.xHeaders) {
                for (const [k, v] of Object.entries(credential.xHeaders)) {
                    env[`${p}_HEADER_${normalizeKey(k)}`] = v;
                }
            }
            if (credential.localStorage) {
                for (const [k, v] of Object.entries(credential.localStorage)) {
                    env[`${p}_LOCAL_${normalizeKey(k)}`] = v;
                }
            }
            break;
        }
        case 'api-key': {
            env[`${p}_API_KEY`] = credential.key;
            const header = credential.headerPrefix
                ? `${credential.headerPrefix} ${credential.key}`
                : credential.key;
            env[`${p}_AUTH_HEADER`] = header;
            break;
        }
        case 'basic': {
            env[`${p}_USERNAME`] = credential.username;
            env[`${p}_PASSWORD`] = credential.password;
            const encoded = Buffer.from(`${credential.username}:${credential.password}`).toString(
                'base64',
            );
            env[`${p}_AUTH_HEADER`] = `Basic ${encoded}`;
            break;
        }
    }

    return env;
}
