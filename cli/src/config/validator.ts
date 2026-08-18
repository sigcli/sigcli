/**
 * Runtime validation for the unified SigCLI config.
 * Returns Result<SigConfig, AuthError>.
 *
 * v2-only format: strategy must be 'browser' | 'prompt',
 * extract and apply must be arrays of rule objects.
 */

import { ConfigError, err, ok, type AuthError, type Result } from '../types/index.js';
import type { IdpMetaEntry } from '../idps/types.js';
import type {
    BrowserConfig,
    ProviderEntry,
    RemoteEntry,
    SigConfig,
    StorageConfig,
    WatchEntry,
    WatchProviderEntry,
} from './schema.js';

const VALID_STRATEGIES: readonly string[] = ['browser', 'prompt', 'oauth2'];

/**
 * Validate a raw config object parsed from YAML.
 */
export function validateConfig(raw: Record<string, unknown>): Result<SigConfig, AuthError> {
    const errors: string[] = [];

    // --- mode ---
    const VALID_MODES = ['browser', 'browserless'];
    if (raw.mode !== undefined && !VALID_MODES.includes(raw.mode as string)) {
        errors.push(`mode must be one of: ${VALID_MODES.join(', ')}`);
    }

    // --- browser section ---
    if (!raw.browser || typeof raw.browser !== 'object') {
        errors.push('Missing required section: "browser"');
    } else {
        const browser = raw.browser as Record<string, unknown>;
        if (typeof browser.browserDataDir !== 'string' || browser.browserDataDir.trim() === '') {
            errors.push('Missing required field: browser.browserDataDir');
        }
        if (browser.headlessTimeout !== undefined && typeof browser.headlessTimeout !== 'number') {
            errors.push('browser.headlessTimeout must be a number');
        }
        if (browser.visibleTimeout !== undefined && typeof browser.visibleTimeout !== 'number') {
            errors.push('browser.visibleTimeout must be a number');
        }
    }

    // --- storage section ---
    if (!raw.storage || typeof raw.storage !== 'object') {
        errors.push('Missing required section: "storage"');
    } else {
        const storage = raw.storage as Record<string, unknown>;
        if (typeof storage.credentialsDir !== 'string' || storage.credentialsDir.trim() === '') {
            errors.push('Missing required field: storage.credentialsDir');
        }
    }

    // --- providers section (optional — null/missing means zero providers) ---
    if (raw.providers !== undefined && raw.providers !== null) {
        if (typeof raw.providers !== 'object') {
            errors.push('"providers" must be an object (or omitted)');
        } else {
            const providers = raw.providers as Record<string, unknown>;
            for (const [id, entry] of Object.entries(providers)) {
                if (!entry || typeof entry !== 'object') {
                    errors.push(`Provider "${id}": must be an object`);
                    continue;
                }
                const providerErrors = validateProviderEntry(id, entry as Record<string, unknown>);
                errors.push(...providerErrors);
            }
        }
    }

    // --- remotes section (optional) ---
    if (raw.remotes !== undefined) {
        if (typeof raw.remotes !== 'object' || raw.remotes === null) {
            errors.push('"remotes" must be an object');
        } else {
            const remotes = raw.remotes as Record<string, unknown>;
            for (const [name, entry] of Object.entries(remotes)) {
                if (!entry || typeof entry !== 'object') {
                    errors.push(`Remote "${name}": must be an object`);
                    continue;
                }
                const r = entry as Record<string, unknown>;
                if (r.type !== 'ssh') {
                    errors.push(`Remote "${name}": only type "ssh" is supported`);
                }
                if (typeof r.host !== 'string' || r.host.trim() === '') {
                    errors.push(`Remote "${name}": missing required field "host"`);
                }
            }
        }
    }

    // --- watch section (optional) ---
    if (raw.watch !== undefined && raw.watch !== null) {
        if (typeof raw.watch !== 'object') {
            errors.push('"watch" must be an object');
        } else {
            const watch = raw.watch as Record<string, unknown>;
            if (watch.interval !== undefined && typeof watch.interval !== 'string') {
                errors.push('watch.interval must be a string (e.g. "5m", "1h")');
            }
            if (watch.providers !== undefined && watch.providers !== null) {
                if (typeof watch.providers !== 'object') {
                    errors.push('watch.providers must be an object');
                } else {
                    const wp = watch.providers as Record<string, unknown>;
                    for (const [id, opts] of Object.entries(wp)) {
                        if (opts !== null && opts !== undefined && typeof opts === 'object') {
                            const o = opts as Record<string, unknown>;
                            if (o.autoSync !== undefined) {
                                if (!Array.isArray(o.autoSync)) {
                                    errors.push(
                                        `watch.providers.${id}.autoSync must be an array of remote names`,
                                    );
                                } else {
                                    for (const r of o.autoSync) {
                                        if (typeof r !== 'string') {
                                            errors.push(
                                                `watch.providers.${id}.autoSync entries must be strings`,
                                            );
                                            break;
                                        }
                                    }
                                }
                            }
                        } else if (opts !== null && opts !== undefined) {
                            errors.push(`watch.providers.${id} must be an object or null`);
                        }
                    }
                }
            }
        }
    }

    // --- idps section (optional) ---
    if (raw.idps !== undefined && raw.idps !== null) {
        if (typeof raw.idps !== 'object') {
            errors.push('"idps" must be an object');
        } else {
            const idps = raw.idps as Record<string, unknown>;
            for (const [hostname, entry] of Object.entries(idps)) {
                if (entry === null || entry === undefined) continue;
                if (typeof entry !== 'object') {
                    errors.push(`IdP "${hostname}": must be an object`);
                    continue;
                }
                const e = entry as Record<string, unknown>;
                if (e.label !== undefined && typeof e.label !== 'string') {
                    errors.push(`IdP "${hostname}": label must be a string`);
                }
                if (Object.keys(e).some((k) => /^(secret|totpSecret)$/i.test(k))) {
                    errors.push(
                        `IdP "${hostname}": secrets must not be stored in config.yaml — use "sig idp add"`,
                    );
                }
                if (e.totp !== undefined && e.totp !== null) {
                    if (typeof e.totp !== 'object') {
                        errors.push(`IdP "${hostname}": totp must be an object`);
                    } else {
                        const t = e.totp as Record<string, unknown>;
                        if (Object.keys(t).some((k) => /^secret$/i.test(k))) {
                            errors.push(
                                `IdP "${hostname}": totp.secret must not be stored in config.yaml — use "sig idp add"`,
                            );
                        }
                        if (t.selectors !== undefined && t.selectors !== null) {
                            if (typeof t.selectors !== 'object') {
                                errors.push(`IdP "${hostname}": totp.selectors must be an object`);
                            } else {
                                const s = t.selectors as Record<string, unknown>;
                                for (const field of ['input', 'submit'] as const) {
                                    if (s[field] === undefined) continue;
                                    if (!Array.isArray(s[field])) {
                                        errors.push(
                                            `IdP "${hostname}": totp.selectors.${field} must be an array of strings`,
                                        );
                                        continue;
                                    }
                                    for (const v of s[field] as unknown[]) {
                                        if (typeof v !== 'string') {
                                            errors.push(
                                                `IdP "${hostname}": totp.selectors.${field} entries must be strings`,
                                            );
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (errors.length > 0) {
        return err(new ConfigError(`Config validation failed:\n  - ${errors.join('\n  - ')}`));
    }

    // Build the validated config
    const browserRaw = raw.browser as Record<string, unknown>;
    const mode = raw.mode === 'browserless' ? ('browserless' as const) : ('browser' as const);

    const browser: BrowserConfig = {
        browserDataDir: browserRaw.browserDataDir as string,
        execPath: typeof browserRaw.execPath === 'string' ? browserRaw.execPath : '',
        headlessTimeout:
            typeof browserRaw.headlessTimeout === 'number' ? browserRaw.headlessTimeout : 20_000,
        visibleTimeout:
            typeof browserRaw.visibleTimeout === 'number' ? browserRaw.visibleTimeout : 120_000,
    };

    const storageRaw = raw.storage as Record<string, unknown>;
    const storage: StorageConfig = {
        credentialsDir: storageRaw.credentialsDir as string,
    };

    const providers: Record<string, ProviderEntry> = {};
    if (raw.providers && typeof raw.providers === 'object') {
        for (const [id, entry] of Object.entries(raw.providers as Record<string, unknown>)) {
            providers[id] = parseProviderEntry(entry as Record<string, unknown>);
        }
    }

    let remotes: Record<string, RemoteEntry> | undefined;
    if (raw.remotes && typeof raw.remotes === 'object') {
        remotes = {};
        for (const [name, entry] of Object.entries(raw.remotes as Record<string, unknown>)) {
            const r = entry as Record<string, unknown>;
            remotes[name] = {
                type: 'ssh',
                host: r.host as string,
                ...(typeof r.user === 'string' ? { user: r.user } : {}),
                ...(typeof r.path === 'string' ? { path: r.path } : {}),
                ...(typeof r.sshKey === 'string' ? { sshKey: r.sshKey } : {}),
            };
        }
    }

    let watch: WatchEntry | undefined;
    if (raw.watch && typeof raw.watch === 'object') {
        const w = raw.watch as Record<string, unknown>;
        const watchProviders: Record<string, WatchProviderEntry | null> = {};
        if (w.providers && typeof w.providers === 'object') {
            for (const [id, opts] of Object.entries(w.providers as Record<string, unknown>)) {
                if (opts === null || opts === undefined) {
                    watchProviders[id] = null;
                } else {
                    const o = opts as Record<string, unknown>;
                    watchProviders[id] = {
                        ...(Array.isArray(o.autoSync) ? { autoSync: o.autoSync as string[] } : {}),
                    };
                }
            }
        }
        watch = {
            interval: w.interval as string,
            providers: watchProviders,
        };
    }

    let idps: Record<string, IdpMetaEntry> | undefined;
    if (raw.idps && typeof raw.idps === 'object') {
        idps = {};
        for (const [hostname, entry] of Object.entries(raw.idps as Record<string, unknown>)) {
            if (entry === null || entry === undefined || typeof entry !== 'object') continue;
            const e = entry as Record<string, unknown>;
            const meta: IdpMetaEntry = {};
            if (typeof e.label === 'string') meta.label = e.label;
            if (e.totp && typeof e.totp === 'object') {
                const t = e.totp as Record<string, unknown>;
                meta.totp = {};
                if (t.selectors && typeof t.selectors === 'object') {
                    const s = t.selectors as Record<string, unknown>;
                    const selectors: { input?: string[]; submit?: string[] } = {};
                    if (Array.isArray(s.input)) selectors.input = s.input as string[];
                    if (Array.isArray(s.submit)) selectors.submit = s.submit as string[];
                    if (selectors.input || selectors.submit) meta.totp.selectors = selectors;
                }
            }
            idps[hostname] = meta;
        }
    }

    const config: SigConfig = {
        mode,
        browser,
        storage,
        providers,
        ...(remotes ? { remotes } : {}),
        ...(watch ? { watch } : {}),
        ...(idps ? { idps } : {}),
    };

    return ok(config);
}

function validateProviderEntry(id: string, raw: Record<string, unknown>): string[] {
    const errors: string[] = [];

    if (!Array.isArray(raw.domains) || raw.domains.length === 0) {
        errors.push(`Provider "${id}": missing required field "domains" (non-empty array)`);
    } else {
        for (const d of raw.domains) {
            if (typeof d !== 'string') {
                errors.push(`Provider "${id}": domains must be strings`);
                break;
            }
        }
    }

    // Validate strategy first so we can use it for conditional checks below
    if (!raw.strategy || typeof raw.strategy !== 'string') {
        errors.push(`Provider "${id}": missing required field "strategy"`);
    } else if (!VALID_STRATEGIES.includes(raw.strategy)) {
        errors.push(
            `Provider "${id}": invalid strategy "${raw.strategy}". Valid: ${VALID_STRATEGIES.join(', ')}`,
        );
    }

    const isOauth2 = raw.strategy === 'oauth2';

    // entryUrl is required for browser/prompt strategies; optional for oauth2
    if (!isOauth2 && (typeof raw.entryUrl !== 'string' || raw.entryUrl.length === 0)) {
        errors.push(`Provider "${id}": missing required field "entryUrl"`);
    }

    // oauth2.tokenUrl is required when strategy is oauth2
    if (isOauth2) {
        if (!raw.oauth2 || typeof raw.oauth2 !== 'object') {
            errors.push(
                `Provider "${id}": strategy "oauth2" requires an "oauth2" section with "tokenUrl"`,
            );
        } else {
            const o = raw.oauth2 as Record<string, unknown>;
            if (typeof o.tokenUrl !== 'string' || o.tokenUrl.trim() === '') {
                errors.push(`Provider "${id}": oauth2.tokenUrl is required`);
            }
        }
    }

    // Validate extract array — optional for oauth2 (strategy handles extraction internally)
    if (!isOauth2 && !Array.isArray(raw.extract)) {
        errors.push(`Provider "${id}": missing required field "extract" (array)`);
    } else if (Array.isArray(raw.extract)) {
        for (let i = 0; i < raw.extract.length; i++) {
            const rule = raw.extract[i] as Record<string, unknown>;
            if (!rule || typeof rule !== 'object') {
                errors.push(`Provider "${id}": extract[${i}] must be an object`);
                continue;
            }
            if (typeof rule.from !== 'string') {
                errors.push(`Provider "${id}": extract[${i}].from is required (string)`);
            }
            if (typeof rule.as !== 'string' || rule.as.trim() === '') {
                errors.push(`Provider "${id}": extract[${i}].as is required (string)`);
            }
            if (typeof rule.match !== 'string' || rule.match.trim() === '') {
                errors.push(`Provider "${id}": extract[${i}].match is required (string)`);
            }
            if (rule.jsonPath !== undefined && typeof rule.jsonPath !== 'string') {
                errors.push(`Provider "${id}": extract[${i}].jsonPath must be a string`);
            }
            if (rule.expiresJsonPath !== undefined && typeof rule.expiresJsonPath !== 'string') {
                errors.push(`Provider "${id}": extract[${i}].expiresJsonPath must be a string`);
            }
        }
    }

    // Validate apply array
    if (!Array.isArray(raw.apply)) {
        errors.push(`Provider "${id}": missing required field "apply" (array)`);
    } else {
        const VALID_IN = ['header', 'body', 'query'];
        const VALID_ACTIONS = ['set', 'append', 'remove'];
        for (let i = 0; i < raw.apply.length; i++) {
            const rule = raw.apply[i] as Record<string, unknown>;
            if (!rule || typeof rule !== 'object') {
                errors.push(`Provider "${id}": apply[${i}] must be an object`);
                continue;
            }
            if (typeof rule.in !== 'string' || !VALID_IN.includes(rule.in)) {
                errors.push(
                    `Provider "${id}": apply[${i}].in must be one of: ${VALID_IN.join(', ')}`,
                );
            }
            if (typeof rule.name !== 'string' || rule.name.trim() === '') {
                errors.push(`Provider "${id}": apply[${i}].name is required (string)`);
            }
            if (typeof rule.value !== 'string') {
                errors.push(`Provider "${id}": apply[${i}].value is required (string)`);
            }
            if (rule.action !== undefined) {
                if (!VALID_ACTIONS.includes(rule.action as string)) {
                    errors.push(
                        `Provider "${id}": apply[${i}].action must be one of: ${VALID_ACTIONS.join(', ')}`,
                    );
                }
            }
        }
    }

    return errors;
}

function parseProviderEntry(raw: Record<string, unknown>): ProviderEntry {
    return {
        ...(typeof raw.name === 'string' ? { name: raw.name } : {}),
        domains: raw.domains as string[],
        ...(typeof raw.entryUrl === 'string' ? { entryUrl: raw.entryUrl } : {}),
        ...(typeof raw.validateUrl === 'string' ? { validateUrl: raw.validateUrl } : {}),
        strategy: raw.strategy as ProviderEntry['strategy'],
        ...(Array.isArray(raw.extract) ? { extract: raw.extract as ProviderEntry['extract'] } : {}),
        apply: raw.apply as ProviderEntry['apply'],
        ...(typeof raw.ttl === 'string' ? { ttl: raw.ttl } : {}),
        ...(typeof raw.networkProxy === 'string' ? { networkProxy: raw.networkProxy } : {}),
        ...(raw.oauth2 && typeof raw.oauth2 === 'object'
            ? {
                  oauth2: {
                      tokenUrl: (raw.oauth2 as Record<string, unknown>).tokenUrl as string,
                      ...(Array.isArray((raw.oauth2 as Record<string, unknown>).scopes)
                          ? { scopes: (raw.oauth2 as Record<string, unknown>).scopes as string[] }
                          : {}),
                  },
              }
            : {}),
        ...(Array.isArray(raw.loginUrlPatterns)
            ? { loginUrlPatterns: raw.loginUrlPatterns as string[] }
            : {}),
        ...(typeof raw.validateRule === 'string' ? { validateRule: raw.validateRule } : {}),
    };
}
