/**
 * Core type definitions for signet.
 * These types have zero external dependencies — they are the shared vocabulary
 * used across all layers (strategies, storage, providers, handlers).
 */

// ============================================================================
// Discriminated Strategy Configs
// ============================================================================

export interface CookieStrategyConfig {
  strategy: 'cookie';
  ttl?: string;
  requiredCookies?: string[];
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
// Credential Types
// ============================================================================

export type CredentialType = 'cookie' | 'bearer' | 'api-key' | 'basic';

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;       // Unix timestamp in seconds (-1 = session cookie)
  httpOnly: boolean;
  secure: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface CookieCredential {
  type: 'cookie';
  cookies: Cookie[];
  obtainedAt: string;    // ISO timestamp
  xHeaders?: Record<string, string>;  // Extra captured HTTP headers (e.g. x-s, x-t)
}

export interface BearerCredential {
  type: 'bearer';
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;    // ISO timestamp
  scopes?: string[];
  tokenEndpoint?: string; // For refresh
  xHeaders?: Record<string, string>;  // Extra captured HTTP headers (e.g. x-s, x-t)
}

export interface ApiKeyCredential {
  type: 'api-key';
  key: string;
  headerName: string;    // e.g. "Authorization", "X-API-Key"
  headerPrefix?: string; // e.g. "Bearer", "Token"
}

export interface BasicCredential {
  type: 'basic';
  username: string;
  password: string;
}

export type Credential =
  | CookieCredential
  | BearerCredential
  | ApiKeyCredential
  | BasicCredential;

// ============================================================================
// X-Header Configuration (extra HTTP headers captured during browser auth)
// ============================================================================

export interface XHeaderConfig {
  name: string;                           // Header name to capture (case-insensitive match)
  source?: 'request' | 'response';        // Where to capture from (default: both)
  urlPattern?: string;                     // Only capture from URLs matching this pattern
  staticValue?: string;                    // Use a fixed value instead of capturing dynamically
}

// ============================================================================
// Provider Configuration
// ============================================================================

export interface ProviderConfig {
  id: string;
  name: string;
  domains: string[];                       // Exact or glob: ["*.example.com", "api.example.com"]
  entryUrl?: string;                       // Starting URL for browser auth
  strategy: string;                        // Strategy name: "cookie", "oauth2", "api-token", "basic"
  strategyConfig: StrategyConfig;  // Discriminated union strategy config
  acceptedCredentialTypes?: CredentialType[]; // Enforce which credential types are valid
  setupInstructions?: string;              // Shown when manual setup is needed
  credentialFile?: string;                 // Custom credential filename (default: provider ID)
  xHeaders?: XHeaderConfig[];              // Extra HTTP headers to capture during browser auth
  autoProvisioned?: boolean;               // True if created by auto-provision (not from config file)
  forceVisible?: boolean;                  // Skip headless, go straight to visible browser mode
}

// ============================================================================
// Storage Types
// ============================================================================

export interface StoredCredential {
  credential: Credential;
  providerId: string;
  strategy: string;          // Strategy name that produced this credential
  updatedAt: string;         // ISO timestamp
  metadata?: Record<string, unknown>;
}

export interface StoredEntry {
  providerId: string;
  strategy: string;
  updatedAt: string;
  credentialType: CredentialType;
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
  credentialType?: CredentialType;
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
  authDetectedImmediately: boolean;   // isAuthenticated returned true on first check
  oauthTokensDetected: boolean;       // OAuth JWTs found in localStorage (even in cookie strategy)
  cookiesExtracted: number;           // Number of cookies found
  testRequestStatus?: number;         // HTTP status of validation request
  suggestions: string[];              // Human-readable fix suggestions
}

