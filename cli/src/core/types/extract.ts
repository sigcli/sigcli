/**
 * Extract rule — unified 3-field schema.
 *
 * - from: where to extract (cookies | localStorage | eval | prompt | env)
 * - name: storage key for the extracted value
 * - key: what to extract (* = all, specific name, glob, dot-path, prompt message, env var name)
 */
export interface ExtractRule {
    from: 'cookies' | 'localStorage' | 'eval' | 'prompt' | 'env';
    name: string;
    key: string;
}

/**
 * Apply rule — how to inject extracted values into HTTP requests.
 *
 * - in: injection target (header | body | query)
 * - name: field name (e.g. "Cookie", "Authorization", "api_key")
 * - value: template string with ${name} interpolation
 */
export interface ApplyRule {
    in: 'header' | 'body' | 'query';
    name: string;
    value: string;
}

/**
 * Provider config — new format (post-refactoring).
 */
export interface ProviderConfigV2 {
    id: string;
    name?: string;
    domains: string[];
    entryUrl?: string;

    source: 'browser' | 'prompt' | 'env';
    ttl?: string;
    required?: string[];
    cookiePaths?: string[];
    networkProxy?: string;
    loginMode?: string;

    extract: ExtractRule[];
    apply: ApplyRule[];

    autoProvisioned?: boolean;
}

/**
 * Stored credential — flat map keyed by extract[].name.
 */
export interface StoredCredentialV2 {
    values: Record<string, string>;
    providerId: string;
    source: string;
    updatedAt: string;
}
