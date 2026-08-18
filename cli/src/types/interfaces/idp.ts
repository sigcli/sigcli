import type { IdpEntry } from '../../idps/types.js';

/**
 * Registry of configured Identity Providers. Resolves the best entry for
 * a hostname during browser auth flows (e.g. TOTP fill on a 2FA page).
 */
export interface IIdpRegistry {
    /**
     * Return the entry whose hostname is the longest suffix match of
     * `candidate`, or `null` if none is configured.
     */
    resolve(candidate: string): IdpEntry | null;

    /**
     * List all configured entries.
     */
    list(): IdpEntry[];
}
