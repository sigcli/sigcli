import type { IIdpRegistry } from '../types/interfaces/idp.js';
import { hostnameMatches } from './hostname-match.js';
import type { IdpEntry } from './types.js';

/**
 * Registry of configured Identity Providers, keyed by hostname.
 *
 * `resolve(candidate)` returns the entry whose configured hostname is the
 * longest suffix match of `candidate`. This lets `idp.example.com` win over
 * `example.com` when both are configured.
 */
export class IdpRegistry implements IIdpRegistry {
    private readonly entries: IdpEntry[];

    constructor(entries: IdpEntry[]) {
        this.entries = entries;
    }

    resolve(candidate: string): IdpEntry | null {
        if (!candidate) return null;
        let best: IdpEntry | null = null;
        let bestLen = -1;
        for (const entry of this.entries) {
            if (!hostnameMatches(candidate, entry.hostname)) continue;
            if (entry.hostname.length > bestLen) {
                best = entry;
                bestLen = entry.hostname.length;
            }
        }
        return best;
    }

    list(): IdpEntry[] {
        return [...this.entries];
    }
}
