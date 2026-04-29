/**
 * Config migration: v1 (strategy-based) → v2 (extract/apply).
 *
 * Detects old format by checking for `strategy:` field on providers.
 * Converts in-memory and optionally writes back with backup.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import YAML from 'yaml';
import type { ExtractRule, ApplyRule, NewProviderConfig } from '../core/types/extract.js';

export const CONFIG_VERSION = 2;

const CONFIG_PATH = path.join(os.homedir(), '.sig', 'config.yaml');

export interface V2ProviderEntry {
    name?: string;
    domains: string[];
    entryUrl?: string;
    source: 'browser' | 'prompt' | 'env';
    ttl?: string;
    required?: string[];
    cookiePaths?: string[];
    networkProxy?: string;
    loginMode?: string;
    extract: ExtractRule[];
    apply: ApplyRule[];
}

export interface V2Config {
    version: number;
    mode: string;
    browser: Record<string, unknown>;
    storage: Record<string, unknown>;
    remotes?: Record<string, unknown>;
    providers: Record<string, V2ProviderEntry>;
    watch?: Record<string, unknown>;
}

/**
 * Check if a raw config is v1 format (has strategy: on any provider).
 */
export function isV1Config(raw: Record<string, unknown>): boolean {
    if (raw.version === CONFIG_VERSION) return false;
    const providers = raw.providers as Record<string, Record<string, unknown>> | undefined;
    if (!providers) return false;
    return Object.values(providers).some((p) => 'strategy' in p);
}

/**
 * Migrate a v1 config object to v2 format in-memory.
 */
export function migrateV1ToV2(raw: Record<string, unknown>): V2Config {
    const providers = (raw.providers ?? {}) as Record<string, Record<string, unknown>>;
    const migratedProviders: Record<string, V2ProviderEntry> = {};

    for (const [id, entry] of Object.entries(providers)) {
        migratedProviders[id] = migrateProvider(id, entry);
    }

    return {
        version: CONFIG_VERSION,
        mode: (raw.mode as string) ?? 'browser',
        browser: (raw.browser as Record<string, unknown>) ?? {},
        storage: (raw.storage as Record<string, unknown>) ?? {},
        remotes: raw.remotes as Record<string, unknown> | undefined,
        providers: migratedProviders,
        watch: raw.watch as Record<string, unknown> | undefined,
    };
}

export function migrateProvider(id: string, entry: Record<string, unknown>): V2ProviderEntry {
    const strategy = entry.strategy as string;
    const config = (entry.config ?? {}) as Record<string, unknown>;
    const domains = (entry.domains ?? []) as string[];
    const entryUrl = entry.entryUrl as string | undefined;
    const networkProxy = entry.networkProxy as string | undefined;
    const loginMode = entry.loginMode as string | undefined;
    const localStorageConfigs = entry.localStorage as Array<{ name: string; key: string; jsonPath?: string }> | undefined;

    const extract: ExtractRule[] = [];
    const apply: ApplyRule[] = [];
    let source: 'browser' | 'prompt' | 'env' = 'browser';
    let ttl: string | undefined = config.ttl as string | undefined;
    let required: string[] | undefined;
    let cookiePaths: string[] | undefined = config.cookiePaths as string[] | undefined;

    switch (strategy) {
        case 'cookie': {
            source = 'browser';
            extract.push({ from: 'cookies', name: 'session', key: '*' });
            apply.push({ in: 'header', name: 'Cookie', value: '${session}' });

            const requiredCookies = config.requiredCookies as string[] | undefined;
            if (requiredCookies?.length) {
                required = requiredCookies.map((c) => `session.${c}`);
            }

            // Migrate localStorage entries
            if (localStorageConfigs?.length) {
                for (const ls of localStorageConfigs) {
                    const key = ls.jsonPath ? `${ls.key}.${ls.jsonPath}` : ls.key;
                    extract.push({ from: 'localStorage', name: ls.name, key });
                    if (!required) required = [];
                    required.push(ls.name);
                }
            }
            break;
        }
        case 'oauth2': {
            source = 'browser';
            const audiences = config.audiences as string[] | undefined;
            // MSAL keys use | delimiter and contain audience in the key
            const audiencePattern = audiences?.[0]
                ? `*accesstoken*${audiences[0].replace('https://', '')}*`
                : '*accesstoken*';
            extract.push({ from: 'localStorage', name: 'access_token', key: audiencePattern });
            apply.push({ in: 'header', name: 'Authorization', value: 'Bearer ${access_token}' });
            required = ['access_token'];
            break;
        }
        case 'api-token': {
            source = 'prompt';
            const headerName = (config.headerName as string) ?? 'Authorization';
            const headerPrefix = (config.headerPrefix as string) ?? 'Bearer';
            const message = (config.setupInstructions as string) ?? 'Paste your API token';
            extract.push({ from: 'prompt' as ExtractRule['from'], name: 'token', key: message });
            apply.push({ in: 'header', name: headerName, value: `${headerPrefix} \${token}` });
            break;
        }
        case 'basic': {
            source = 'prompt';
            const message = (config.setupInstructions as string) ?? 'Enter username:password';
            extract.push({ from: 'prompt' as ExtractRule['from'], name: 'credentials', key: message });
            apply.push({ in: 'header', name: 'Authorization', value: 'Basic ${credentials}' });
            break;
        }
        default: {
            // Unknown strategy — default to browser cookie
            source = 'browser';
            extract.push({ from: 'cookies', name: 'session', key: '*' });
            apply.push({ in: 'header', name: 'Cookie', value: '${session}' });
            break;
        }
    }

    return {
        ...(entry.name ? { name: entry.name as string } : {}),
        domains,
        ...(entryUrl ? { entryUrl } : {}),
        source,
        ...(ttl ? { ttl } : {}),
        ...(required?.length ? { required } : {}),
        ...(cookiePaths?.length ? { cookiePaths } : {}),
        ...(networkProxy ? { networkProxy } : {}),
        ...(loginMode ? { loginMode } : {}),
        extract,
        apply,
    };
}

/**
 * Migrate config.yaml file in-place. Creates .bak backup.
 */
export async function migrateConfigFile(): Promise<{ migrated: boolean; backupPath?: string }> {
    let content: string;
    try {
        content = await fs.readFile(CONFIG_PATH, 'utf-8');
    } catch {
        return { migrated: false };
    }

    let raw: Record<string, unknown>;
    try {
        raw = YAML.parse(content) as Record<string, unknown>;
    } catch {
        return { migrated: false };
    }

    if (!isV1Config(raw)) {
        return { migrated: false };
    }

    // Backup
    const backupPath = CONFIG_PATH + '.v1.bak';
    await fs.copyFile(CONFIG_PATH, backupPath);

    // Migrate
    const v2 = migrateV1ToV2(raw);

    // Write
    await fs.writeFile(CONFIG_PATH, YAML.stringify(v2, { lineWidth: 120 }), 'utf-8');

    return { migrated: true, backupPath };
}
