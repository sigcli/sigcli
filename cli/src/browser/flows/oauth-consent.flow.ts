import type { IBrowserPage } from '../../core/interfaces/browser-adapter.js';
import type { BearerCredential } from '../../core/types.js';
import type { Result } from '../../core/result.js';
import { ok, err } from '../../core/result.js';
import { BrowserError, type AuthError } from '../../core/errors.js';
import { decodeJwt, getJwtExpiresAt } from '../../utils/jwt.js';

const EXPIRY_BUFFER_MS = 60_000; // 1 minute buffer

/** Returns true if the JWT payload has a valid (non-expired) exp claim. */
function isTokenValid(payload: ReturnType<typeof decodeJwt>): boolean {
  if (!payload?.exp) return false;
  return payload.exp * 1000 > Date.now() + EXPIRY_BUFFER_MS;
}

/**
 * Extract OAuth tokens from browser localStorage.
 * Searches for JWT-like strings and validates them against expected audiences.
 */
export async function extractOAuthTokens(
  page: IBrowserPage,
  options?: {
    audiences?: string[];
    extractRefreshToken?: boolean;
    /** Max retries to wait for tokens to appear (default: 5, 2s apart) */
    maxRetries?: number;
  },
): Promise<Result<BearerCredential, AuthError>> {
  const maxRetries = options?.maxRetries ?? 5;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await tryExtractTokens(page, options);
    if (result.ok) return result;

    // If this isn't the last attempt, wait and retry (MSAL may still be writing tokens)
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      return result; // Return the last error
    }
  }

  return err(new BrowserError('Token extraction exhausted all retries.'));
}

/**
 * Check if OAuth tokens (JWTs) exist in browser storage.
 * Used as a guard to ensure MSAL has finished writing tokens before
 * the browser is closed.
 */
export async function hasOAuthTokens(
  page: IBrowserPage,
  audiences?: string[],
): Promise<boolean> {
  try {
    const storage = await page.evaluate(() => {
      const entries: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) entries['local:' + key] = localStorage.getItem(key) ?? '';
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) entries['session:' + key] = sessionStorage.getItem(key) ?? '';
      }
      return entries;
    });

    const jwtRegex = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
    const tokens: string[] = [];

    for (const value of Object.values(storage)) {
      const matches = value.match(jwtRegex);
      if (matches) tokens.push(...matches);
    }

    if (tokens.length === 0) return false;

    for (const token of tokens) {
      const payload = decodeJwt(token);
      if (!payload || !isTokenValid(payload)) continue;

      if (audiences && audiences.length > 0) {
        const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
        if (audiences.some(a => aud.includes(a))) return true;
      } else {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

async function tryExtractTokens(
  page: IBrowserPage,
  options?: {
    audiences?: string[];
    extractRefreshToken?: boolean;
  },
): Promise<Result<BearerCredential, AuthError>> {
  try {
    // Extract all entries from both localStorage and sessionStorage
    const storage = await page.evaluate(() => {
      const entries: Record<string, string> = {};
      // Check localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) entries['local:' + key] = localStorage.getItem(key) ?? '';
      }
      // Check sessionStorage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) entries['session:' + key] = sessionStorage.getItem(key) ?? '';
      }
      return entries;
    });

    // Find JWTs in localStorage values
    const jwtRegex = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
    const tokens: string[] = [];

    for (const value of Object.values(storage)) {
      const matches = value.match(jwtRegex);
      if (matches) tokens.push(...matches);
    }

    if (tokens.length === 0) {
      return err(new BrowserError('No OAuth tokens found in browser localStorage.'));
    }

    // Find the best matching token: must be non-expired, match audience if specified,
    // and prefer the one with the latest expiry.
    let bestToken: string | undefined;
    let bestPayload: ReturnType<typeof decodeJwt> | undefined;

    for (const token of tokens) {
      const payload = decodeJwt(token);
      if (!payload || !isTokenValid(payload)) continue;

      if (options?.audiences && options.audiences.length > 0) {
        const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
        if (!options.audiences.some(a => aud.includes(a))) continue;
      }

      // Prefer the token with the latest expiry
      if (!bestPayload || (payload.exp ?? 0) > (bestPayload.exp ?? 0)) {
        bestToken = token;
        bestPayload = payload;
      }
    }

    if (!bestToken) {
      return err(new BrowserError(
        `No valid (non-expired) token matching audiences [${options?.audiences?.join(', ')}] found. ` +
        `Found ${tokens.length} token(s) in storage.`,
      ));
    }

    // Extract refresh token (MSAL format: keys containing "refreshtoken")
    let refreshToken: string | undefined;
    if (options?.extractRefreshToken) {
      for (const [rawKey, value] of Object.entries(storage)) {
        // Strip the 'local:' or 'session:' prefix for key matching
        const key = rawKey.replace(/^(local|session):/, '');
        if (key.toLowerCase().includes('refreshtoken')) {
          try {
            const parsed = JSON.parse(value);
            if (parsed.secret) {
              refreshToken = parsed.secret;
              break;
            }
          } catch {
            // Not JSON — skip
          }
        }
      }
    }

    const expiresAt = bestPayload?.exp
      ? new Date(bestPayload.exp * 1000).toISOString()
      : undefined;

    const credential: BearerCredential = {
      type: 'bearer',
      accessToken: bestToken,
      refreshToken,
      expiresAt,
      scopes: bestPayload?.scp
        ? String(bestPayload.scp).split(' ')
        : undefined,
    };

    return ok(credential);
  } catch (e: unknown) {
    return err(new BrowserError(`Token extraction failed: ${(e as Error).message}`));
  }
}
