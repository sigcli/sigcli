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
    strategy: string; // Strategy name: "browser" | "prompt"
    autoProvisioned?: boolean; // True if created by auto-provision (not from config file)
    networkProxy?: string; // Browser network proxy, e.g. "socks5://127.0.0.1:1080"
    loginMode?: 'headless' | 'visible' | 'auto'; // Browser login mode

    extract: ExtractRule[];
    apply: ApplyRule[];
    required?: string[];
    cookiePaths?: string[];
    ttl?: string;
    loginUrlPatterns?: string[];
    waitUntil?: string;
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
