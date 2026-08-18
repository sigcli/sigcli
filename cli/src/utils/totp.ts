import { TOTP } from 'otpauth';

/**
 * Compute a TOTP code from a base32-encoded shared secret.
 * Uses SHA-1, 6 digits, 30s period — matching every mainstream authenticator.
 *
 * Throws if `secret` is not valid base32 (letters A-Z, digits 2-7, optional
 * padding). Callers that need graceful handling should try/catch.
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
