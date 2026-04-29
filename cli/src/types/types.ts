/**
 * Core type definitions for SigCLI.
 * These types have zero external dependencies — they are the shared vocabulary
 * used across all layers (strategies, storage, providers, handlers).
 */
import type { WaitUntilValue } from './constants.js';

// ============================================================================
// Discriminated Strategy Configs
// ============================================================================

export interface CookieStrategyConfig {
    strategy: 'cookie';
    ttl?: string;
    waitUntil?: WaitUntilValue;
    requiredCookies?: string[];
    cookiePaths?: string[];
}

export interface OAuth2StrategyConfig {
    strategy: 'oauth2';
    audiences?: string[];
    tokenEndpoint?: string;
    clientId?: string;
    scopes?: string[];
}

export interface ApiTokenStrategyConfig {
    strategy: 'api-token';
    headerName?: string;
    headerPrefix?: string;
    setupInstructions?: string;
}

export interface BasicStrategyConfig {
    strategy: 'basic';
    setupInstructions?: string;
}

export type StrategyConfig =
    | CookieStrategyConfig
    | OAuth2StrategyConfig
    | ApiTokenStrategyConfig
    | BasicStrategyConfig;

export type StrategyName = StrategyConfig['strategy'];

// ============================================================================
// LocalStorage Configuration (values extracted from browser localStorage)
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

export interface LocalStorageConfig {
    name: string; // Name to store the extracted value under
    key: string; // localStorage key to read
    jsonPath?: string; // Optional dot-delimited path into parsed JSON value
}

// ============================================================================
// Proxy Injection Rules
// ============================================================================

export interface ProxyInjectRule {
    in: 'header' | 'body' | 'query';
    action: 'set' | 'append' | 'remove';
    name: string;
    from?: string;
}

export interface ProxyConfig {
    inject?: ProxyInjectRule[];
}

// ============================================================================
// Provider Configuration
// ============================================================================

export interface ExtractRule {
    from: 'cookies' | 'localStorage' | 'eval' | 'prompt';
    name: string;
    key: string;
}

export interface ApplyRule {
    in: 'header' | 'body' | 'query';
    name: string;
    value: string;
}

export interface ProviderConfig {
    id: string;
    name: string;
    domains: string[]; // Exact or glob: ["*.example.com", "api.example.com"]
    entryUrl: string; // Starting URL for browser auth
    strategy: string; // Strategy name: "cookie", "oauth2", "api-token", "basic"
    autoProvisioned?: boolean; // True if created by auto-provision (not from config file)
    proxy?: ProxyConfig; // MITM proxy injection rules
    networkProxy?: string; // Browser network proxy, e.g. "socks5://127.0.0.1:1080"
    loginMode?: string; // Login mode: auto|cdp|headless|visible
    extract: ExtractRule[];
    apply: ApplyRule[];
    required?: string[];
    cookiePaths?: string[];
    ttl?: string;
}

// ============================================================================
// Storage Types
// ============================================================================

export interface StoredCredential {
    providerId: string;
    strategy: string; // Strategy name that produced this credential
    updatedAt: string; // ISO timestamp
    expiresAt?: string; // ISO timestamp — computed from cookie expiry
    credentials: Record<string, unknown>;
}

export interface StoredEntry {
    providerId: string;
    strategy: string;
    updatedAt: string;
}

// ============================================================================
// Browser Types
// ============================================================================

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
