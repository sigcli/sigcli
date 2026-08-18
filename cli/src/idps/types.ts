/**
 * IdP (Identity Provider) types.
 *
 * IdP entries wire per-hostname secrets (e.g. TOTP) that the browser strategy
 * uses to auto-fill 2FA / MFA prompts during a login flow.
 *
 * Storage split:
 * - Metadata (hostname, label, totp presence, custom selectors) lives in
 *   ~/.sig/config.yaml under a top-level `idps:` map keyed by hostname.
 * - Secrets (totp.secret) live in per-hostname encrypted JSON at ~/.sig/idps/.
 */

/**
 * Optional per-IdP selector overrides used by the TOTP injector.
 *
 * User-provided selectors are tried BEFORE the built-in default list for the
 * input; and BEFORE the form-submit fallback for the submit button.
 */
export interface IdpTotpSelectors {
    /** OTP input candidates. Tried in order, before the built-in defaults. */
    input?: string[];
    /**
     * Submit button candidates. Tried in order via `.click()`. If none match,
     * the injector falls back to `form.requestSubmit()` / `form.submit()`.
     */
    submit?: string[];
}

export interface IdpTotpConfig {
    secret: string;
    selectors?: IdpTotpSelectors;
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
    totp?: {
        selectors?: IdpTotpSelectors;
    };
}
