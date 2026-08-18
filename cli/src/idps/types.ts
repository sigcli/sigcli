/**
 * IdP (Identity Provider) types.
 *
 * IdP entries wire per-hostname secrets (e.g. TOTP) that the browser strategy
 * uses to auto-fill 2FA / MFA prompts during a login flow.
 *
 * Storage split:
 * - Metadata (hostname, label, totp presence) lives in ~/.sig/config.yaml
 *   under a top-level `idps:` map keyed by hostname.
 * - Secrets (totp.secret) live in per-hostname encrypted JSON at ~/.sig/idps/.
 */

export interface IdpTotpConfig {
    secret: string;
}

export interface IdpEntry {
    hostname: string;
    label?: string;
    totp?: IdpTotpConfig;
}

/**
 * The YAML-side shape of an IdP entry — no secrets.
 */
export interface IdpMetaEntry {
    label?: string;
    totp?: Record<string, never>;
}
