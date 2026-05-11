/** On-disk credential file (v2 format) */
export interface ProviderFile {
    readonly providerId: string;
    readonly strategy: string;
    readonly updatedAt: string;
    readonly expiresAt?: string;
    readonly values: Readonly<Record<string, string>>;
    readonly oauth2?: { readonly clientId: string; readonly clientSecret: string };
}

/** Lightweight provider summary */
export interface ProviderInfo {
    readonly providerId: string;
    readonly strategy: string;
    readonly updatedAt: string;
    readonly expiresAt?: string;
}

/** Apply rule for template interpolation (mirrors CLI config) */
export interface ApplyRule {
    readonly in: 'header' | 'query' | 'body';
    readonly name: string;
    /** Template string: "Bearer ${token}", "${cookie}" */
    readonly value: string;
    readonly action?: 'set' | 'append' | 'remove';
}

/** Result of applying rules to credential values */
export interface ApplyResult {
    readonly headers: Record<string, string>;
    readonly query?: Record<string, string>;
    readonly body?: Record<string, string>;
}
