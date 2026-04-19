import type { Credential } from '../core/types.js';

export interface CredentialEnvOptions {
    expandCookies?: boolean;
}

function normalizeKey(key: string): string {
    return key.toUpperCase().replace(/-/g, '_');
}

export function credentialToEnvVars(
    credential: Credential,
    providerId: string,
    options: CredentialEnvOptions,
): Record<string, string> {
    const env: Record<string, string> = {
        SIG_PROVIDER: providerId,
        SIG_CREDENTIAL_TYPE: credential.type,
    };

    switch (credential.type) {
        case 'bearer': {
            env['SIG_TOKEN'] = credential.accessToken;
            env['SIG_AUTH_HEADER'] = `Bearer ${credential.accessToken}`;
            if (credential.xHeaders) {
                for (const [k, v] of Object.entries(credential.xHeaders)) {
                    env[`SIG_HEADER_${normalizeKey(k)}`] = v;
                }
            }
            if (credential.localStorage) {
                for (const [k, v] of Object.entries(credential.localStorage)) {
                    env[`SIG_LOCAL_${normalizeKey(k)}`] = v;
                }
            }
            break;
        }
        case 'cookie': {
            env['SIG_COOKIE'] = credential.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
            if (options.expandCookies) {
                for (const c of credential.cookies) {
                    env[`SIG_COOKIE_${normalizeKey(c.name)}`] = c.value;
                }
            }
            if (credential.xHeaders) {
                for (const [k, v] of Object.entries(credential.xHeaders)) {
                    env[`SIG_HEADER_${normalizeKey(k)}`] = v;
                }
            }
            if (credential.localStorage) {
                for (const [k, v] of Object.entries(credential.localStorage)) {
                    env[`SIG_LOCAL_${normalizeKey(k)}`] = v;
                }
            }
            break;
        }
        case 'api-key': {
            env['SIG_API_KEY'] = credential.key;
            const header = credential.headerPrefix
                ? `${credential.headerPrefix} ${credential.key}`
                : credential.key;
            env['SIG_AUTH_HEADER'] = header;
            break;
        }
        case 'basic': {
            env['SIG_USERNAME'] = credential.username;
            env['SIG_PASSWORD'] = credential.password;
            const encoded = Buffer.from(`${credential.username}:${credential.password}`).toString(
                'base64',
            );
            env['SIG_AUTH_HEADER'] = `Basic ${encoded}`;
            break;
        }
    }

    return env;
}
