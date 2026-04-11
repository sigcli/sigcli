/**
 * sig doctor — Environment diagnostics.
 * Runs a series of checks and reports pass/fail for each.
 * Does NOT take deps (can run before config is fully wired).
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getConfigPath, loadConfig } from '../../config/loader.js';
import { isOk } from '../../core/result.js';
import { findChannelBrowser } from '../../browser/detect.js';
import type { SignetConfig } from '../../config/schema.js';
import { BROWSER_REQUIRED_STRATEGIES } from '../../core/constants.js';
import { expandHome } from '../../utils/path.js';
import { ExitCode } from '../exit-codes.js';

interface CheckResult {
    label: string;
    ok: boolean;
    detail?: string;
    hint?: string;
}

const PASS = '\u2713'; // ✓
const FAIL = '\u2717'; // ✗

function printResults(results: CheckResult[]): void {
    let failures = 0;

    for (const r of results) {
        if (r.ok) {
            const detail = r.detail ? ` (${r.detail})` : '';
            process.stderr.write(`  ${PASS} ${r.label}${detail}\n`);
        } else {
            failures++;
            process.stderr.write(`  ${FAIL} ${r.label}\n`);
            if (r.hint) {
                process.stderr.write(`    \u2192 ${r.hint}\n`);
            }
        }
    }

    process.stderr.write('\n');
    if (failures === 0) {
        process.stderr.write('All checks passed.\n');
    } else {
        process.stderr.write(`${failures} issue${failures > 1 ? 's' : ''} found.\n`);
    }
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkConfigExists(): CheckResult {
    const configPath = getConfigPath();
    const exists = fs.existsSync(configPath);
    return {
        label: 'Config file exists',
        ok: exists,
        detail: exists ? configPath.replace(os.homedir(), '~') : undefined,
        hint: exists ? undefined : 'Run "sig init" to create ~/.signet/config.yaml',
    };
}

async function checkConfigValid(): Promise<CheckResult & { config?: SignetConfig }> {
    const configResult = await loadConfig();
    if (!isOk(configResult)) {
        return {
            label: 'Config is valid',
            ok: false,
            hint: configResult.error.message,
        };
    }
    return {
        label: 'Config is valid',
        ok: true,
        config: configResult.value,
    };
}

async function checkCredentialsDir(config: SignetConfig | undefined): Promise<CheckResult> {
    if (!config) {
        return {
            label: 'Credentials directory exists',
            ok: false,
            hint: 'Fix config first',
        };
    }

    const dir = expandHome(config.storage.credentialsDir);
    try {
        await fsp.access(dir, fs.constants.R_OK | fs.constants.W_OK);
        return {
            label: 'Credentials directory exists',
            ok: true,
            detail: config.storage.credentialsDir,
        };
    } catch {
        return {
            label: 'Credentials directory exists',
            ok: false,
            hint: `Directory not found or not writable: ${config.storage.credentialsDir}`,
        };
    }
}

async function checkBrowserDataDir(config: SignetConfig | undefined): Promise<CheckResult> {
    if (!config) {
        return {
            label: 'Browser data directory exists',
            ok: false,
            hint: 'Fix config first',
        };
    }

    const dir = expandHome(config.browser.browserDataDir);
    const exists = fs.existsSync(dir);
    return {
        label: 'Browser data directory exists',
        ok: exists,
        detail: exists ? config.browser.browserDataDir : undefined,
        hint: exists ? undefined : `Directory not found: ${config.browser.browserDataDir}`,
    };
}

async function checkBrowserAvailable(config: SignetConfig | undefined): Promise<CheckResult> {
    if (!config) {
        return {
            label: 'Browser available',
            ok: false,
            hint: 'Fix config first',
        };
    }

    const channel = config.browser.channel;
    try {
        // Verify playwright-core is importable
        await import('playwright-core');

        // Check if the channel browser is installed on the system
        const found = findChannelBrowser(channel) !== null;
        if (found) {
            return {
                label: 'Browser available',
                ok: true,
                detail: channel,
            };
        }

        // Fallback: if we can't detect by channel but playwright-core is available, report cautiously
        return {
            label: 'Browser available',
            ok: true,
            detail: `${channel} (playwright-core loaded, browser not verified)`,
        };
    } catch {
        return {
            label: 'Browser available',
            ok: false,
            hint: 'playwright-core not installed. Run "npm install playwright-core".',
        };
    }
}

function checkNodeVersion(): CheckResult {
    const version = process.version;
    const match = version.match(/^v(\d+)/);
    const major = match ? parseInt(match[1], 10) : 0;
    return {
        label: 'Node.js version',
        ok: major >= 18,
        detail: version,
        hint: major < 18 ? `Node.js >= 18 is required. Current: ${version}` : undefined,
    };
}

async function checkStoredCredentials(config: SignetConfig | undefined): Promise<CheckResult> {
    if (!config) {
        return {
            label: 'Stored credentials',
            ok: true,
            detail: 'skipped (no config)',
        };
    }

    const dir = expandHome(config.storage.credentialsDir);
    try {
        const files = await fsp.readdir(dir);
        const jsonFiles = files.filter((f) => f.endsWith('.json') && !f.endsWith('.lock'));
        const total = jsonFiles.length;

        // Check for expired credentials by reading each file
        let expired = 0;
        for (const file of jsonFiles) {
            try {
                const content = await fsp.readFile(path.join(dir, file), 'utf-8');
                const data = JSON.parse(content) as {
                    credential?: { type?: string; accessToken?: string };
                };
                const cred = data?.credential;
                if (cred?.type === 'bearer' && cred?.accessToken) {
                    try {
                        const { isJwtExpired } = await import('../../utils/jwt.js');
                        if (isJwtExpired(cred.accessToken)) expired++;
                    } catch {
                        // JWT decode failed, skip
                    }
                }
            } catch {
                // Skip unreadable files
            }
        }

        const detail =
            expired > 0
                ? `${total} stored credential${total !== 1 ? 's' : ''} (${expired} expired)`
                : `${total} stored credential${total !== 1 ? 's' : ''}`;

        return {
            label: 'Stored credentials',
            ok: true,
            detail,
        };
    } catch {
        return {
            label: 'Stored credentials',
            ok: true,
            detail: '0 stored credentials',
        };
    }
}

function checkBrowserRequired(
    config: SignetConfig | undefined,
    browserAvailable: boolean,
): CheckResult {
    if (!config) {
        return {
            label: 'Browser needed for configured providers',
            ok: true,
            detail: 'skipped (no config)',
        };
    }

    const browserProviders = Object.entries(config.providers)
        .filter(([, entry]) => BROWSER_REQUIRED_STRATEGIES.has(entry.strategy))
        .map(([id]) => id);

    if (browserProviders.length === 0) {
        return {
            label: 'Browser needed for configured providers',
            ok: true,
            detail: 'no browser-based providers configured',
        };
    }

    if (browserAvailable) {
        return {
            label: 'Browser needed for configured providers',
            ok: true,
            detail: `${browserProviders.join(', ')} (browser available)`,
        };
    }

    return {
        label: 'Browser needed for configured providers',
        ok: false,
        hint:
            `Providers requiring a browser: ${browserProviders.join(', ')}. ` +
            'Use "sig login --token <token>" or "sig sync pull" to get credentials on this machine.',
    };
}

// ---------------------------------------------------------------------------
// Main command
// ---------------------------------------------------------------------------

export async function runDoctor(
    _positionals: string[],
    _flags: Record<string, string | boolean | string[]>,
): Promise<void> {
    const results: CheckResult[] = [];

    // a. Config file exists
    results.push(checkConfigExists());

    // b. Config is valid
    const configCheck = await checkConfigValid();
    results.push(configCheck);
    const config = configCheck.config;

    // c. Credentials directory
    results.push(await checkCredentialsDir(config));

    // d. Browser data directory
    results.push(await checkBrowserDataDir(config));

    // e. Browser available
    const browserCheck = await checkBrowserAvailable(config);
    results.push(browserCheck);

    // f. Browser needed for configured providers
    results.push(checkBrowserRequired(config, browserCheck.ok));

    // g. Node.js version
    results.push(checkNodeVersion());

    // h. Stored credentials
    results.push(await checkStoredCredentials(config));

    printResults(results);

    const hasFailures = results.some((r) => !r.ok);
    if (hasFailures) {
        process.exitCode = ExitCode.GENERAL_ERROR;
    }
}
