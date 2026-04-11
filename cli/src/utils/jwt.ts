/**
 * Lightweight JWT decode without signature verification.
 * Used for reading token expiry and audience — NOT for security validation.
 */

export interface JwtPayload {
  exp?: number; // Expiration time (Unix timestamp)
  iat?: number; // Issued at
  aud?: string | string[]; // Audience
  iss?: string; // Issuer
  sub?: string; // Subject
  [key: string]: unknown;
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string, bufferMs: number = 0): boolean {
  const payload = decodeJwt(token);
  if (!payload?.exp) return false; // No expiry = assume valid
  const expiresAtMs = payload.exp * 1000;
  return Date.now() + bufferMs >= expiresAtMs;
}

export function getJwtExpiresAt(token: string): Date | null {
  const payload = decodeJwt(token);
  if (!payload?.exp) return null;
  return new Date(payload.exp * 1000);
}
