import { TOTP } from 'otpauth';

/**
 * Compute a TOTP code from a base32-encoded shared secret.
 * Uses SHA-1, 6 digits, 30s period — matching every mainstream authenticator.
 *
 * Does NOT validate the alphabet — `otpauth` only throws on characters outside
 * the base32 range, so all-letter garbage like "HELLOWORLD" would silently
 * generate a code. Callers that need strict validation must run
 * `isValidBase32` first.
 */
export function computeTotp(
    secret: string,
    options?: { digits?: number; period?: number },
): string {
    const totp = new TOTP({
        algorithm: 'SHA1',
        digits: options?.digits ?? 6,
        period: options?.period ?? 30,
        secret,
    });
    return totp.generate();
}

/**
 * Return true if `secret` is a syntactically valid base32 TOTP secret.
 * Rules:
 *   - Whitespace is normalized out (authenticator apps often group digits).
 *   - Alphabet is A-Z and 2-7 (RFC 4648, case-insensitive; caller-facing form
 *     is uppercase).
 *   - Optional `=` padding after the payload.
 *   - Minimum 16 characters after normalization (real TOTP shared secrets are
 *     at least 80 bits = 16 base32 chars).
 */
export function isValidBase32(secret: string): boolean {
    const normalized = secret.replace(/\s+/g, '').toUpperCase();
    if (normalized.length < 16) return false;
    return /^[A-Z2-7]+=*$/.test(normalized);
}
