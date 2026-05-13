/**
 * Core type definitions for SigCLI.
 * These types have zero external dependencies — they are the shared vocabulary
 * used across all layers (strategies, storage, providers, handlers).
 */

// ============================================================================
// Provider Configuration
// ============================================================================

export interface ExtractRule {
    from: 'cookies' | 'localStorage' | 'eval' | 'prompt';
    as: string;
    match: string;
    jsonPath?: string;
    expiresJsonPath?: string; // dot-path into the stored JSON value for the expiration timestamp
}

export interface ApplyRule {
    in: 'header' | 'body' | 'query';
    name: string;
    value: string; // Template: "${session}", "Bearer ${token}"
    action?: 'set' | 'append' | 'remove'; // Default: 'set'
}

export interface ProviderConfig {
    id: string;
    name: string;
    domains: string[]; // Exact or glob: ["*.example.com", "api.example.com"]
    entryUrl: string; // Starting URL for browser auth
    validateUrl?: string; // Protected URL for credential validation (defaults to entryUrl)
    strategy: string; // Strategy name: "browser" | "prompt" | "oauth2"
    autoProvisioned?: boolean; // True if created by auto-provision (not from config file)
    networkProxy?: string; // Browser network proxy, e.g. "socks5://127.0.0.1:1080"
    loginMode?: 'headless' | 'visible' | 'auto'; // Browser login mode
    oauth2?: { tokenUrl: string; scopes?: string[] }; // OAuth2 client credentials config

    extract: ExtractRule[];
    apply: ApplyRule[];
    required?: string[];
    cookiePaths?: string[];
    ttl?: string;
    loginUrlPatterns?: string[];
    waitUntil?: string;
    validateRule?: string; // JS expression evaluated against response: "res.body.status_code === 0"
}

// ============================================================================
// Storage Types
// ============================================================================

export interface StoredCredential {
    providerId: string;
    strategy: string; // Strategy name that produced this credential
    updatedAt: string; // ISO timestamp
    expiresAt?: string; // ISO timestamp — computed from cookie expiry
    values: Record<string, string>; // Renamed from 'credentials', narrowed from 'unknown'
    oauth2?: { clientId: string; clientSecret: string }; // OAuth2 client credentials (encrypted at rest)
}

export interface StoredEntry {
    providerId: string;
    strategy: string;
    updatedAt: string;
}

// ============================================================================
// Browser Types
// ============================================================================

/**
 * Browser cookie (used by IBrowserPage.cookies() adapter interface).
 */
export interface Cookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number; // Unix timestamp in seconds (-1 = session cookie)
    httpOnly: boolean;
    secure: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface BrowserLaunchOptions {
    headless?: boolean;
    timeout?: number;
    args?: string[];
}

// ============================================================================
// Provider Status (returned by auth_status tool)
// ============================================================================

export interface ProviderStatus {
    id: string;
    name: string;
    configured: boolean;
    valid: boolean;
    strategy: string;
    expiresAt?: string;
    expiresInMinutes?: number;
}

// ============================================================================
// Logger Interface
// ============================================================================

export interface ILogger {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
}

// ============================================================================
// Auth Diagnostics (post-auth validation)
// ============================================================================

export interface AuthDiagnostics {
    authDetectedImmediately?: boolean; // isAuthenticated returned true on first check
    oauthTokensDetected?: boolean; // OAuth JWTs found in localStorage (even in cookie strategy)
    cookiesExtracted?: number; // Number of cookies found
    testRequestStatus?: number; // HTTP status of validation request
    suggestions?: string[]; // Human-readable fix suggestions
    hint?: string;
    entryUrl?: string;
    finalUrl?: string;
    authDuration?: number;
    [key: string]: unknown;
}
