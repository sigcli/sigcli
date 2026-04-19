/** Individual browser cookie */
export interface Cookie {
    readonly name: string;
    readonly value: string;
    readonly domain: string;
    readonly path: string;
    /** Unix timestamp in seconds. -1 means session cookie. */
    readonly expires: number;
    readonly httpOnly: boolean;
    readonly secure: boolean;
    readonly sameSite?: 'Strict' | 'Lax' | 'None';
}

/** Cookie-based credential (e.g. session cookies from browser login) */
export interface CookieCredential {
    readonly type: 'cookie';
    readonly cookies: readonly Cookie[];
    readonly obtainedAt: string;
    readonly xHeaders?: Readonly<Record<string, string>>;
    readonly localStorage?: Readonly<Record<string, string>>;
}

/** OAuth2 bearer token credential */
export interface BearerCredential {
    readonly type: 'bearer';
    readonly accessToken: string;
    readonly refreshToken?: string;
    readonly expiresAt?: string;
    readonly scopes?: readonly string[];
    readonly tokenEndpoint?: string;
    readonly xHeaders?: Readonly<Record<string, string>>;
    readonly localStorage?: Readonly<Record<string, string>>;
}

/** API key credential with configurable header */
export interface ApiKeyCredential {
    readonly type: 'api-key';
    readonly key: string;
    /** HTTP header name (e.g. "Authorization", "X-API-Key") */
    readonly headerName: string;
    /** Optional prefix before the key (e.g. "Bearer", "Token") */
    readonly headerPrefix?: string;
}

/** HTTP Basic authentication credential */
export interface BasicCredential {
    readonly type: 'basic';
    readonly username: string;
    readonly password: string;
}

/** Discriminated union of all credential types */
export type Credential = CookieCredential | BearerCredential | ApiKeyCredential | BasicCredential;

/** String literal union of credential type discriminators */
export type CredentialType = Credential['type'];

/** On-disk file format written by sigcli CLI (version 1) */
export interface ProviderFile {
    readonly version: number;
    readonly providerId: string;
    readonly credential: Credential;
    readonly strategy: string;
    readonly updatedAt: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Lightweight provider summary returned by listProviders() */
export interface ProviderInfo {
    readonly providerId: string;
    readonly credentialType: CredentialType;
    readonly strategy: string;
    readonly updatedAt: string;
}
