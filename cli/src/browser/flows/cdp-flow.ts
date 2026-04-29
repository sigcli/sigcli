/**
 * Native CDP browser flow.
 *
 * Launches the user's real browser (Chrome/Edge/Chromium) with
 * --remote-debugging-port, then polls for cookies via raw CDP WebSocket.
 * This bypasses automation detection that blocks Playwright.
 *
 * Flow:
 *   1. Remove SingletonLock if present
 *   2. Find a free port
 *   3. Launch browser with --remote-debugging-port
 *   4. Poll /json/version until ready
 *   5. Connect via CDP WebSocket
 *   6. Poll Storage.getCookies every 2s
 *   7. Return cookies when all required ones are present (or timeout)
 *   8. Cleanup: close WS, kill browser
 */

import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Cookie, LocalStorageConfig, ILogger } from '../../core/types.js';
import type { Result } from '../../core/result.js';
import { ok, err } from '../../core/result.js';
import { BrowserError, BrowserTimeoutError, type AuthError } from '../../core/errors.js';
import { connectCdpWs } from '../cdp-ws.js';
import dlv from 'dlv';

// ============================================================================
// Types
// ============================================================================

export interface CdpFlowOptions {
    entryUrl: string;
    browserDataDir: string;
    execPath: string; // Required — browser binary path
    domains: string[];
    requiredCookies: string[];
    cookiePaths: string[];
    timeout: number;
    logger: ILogger;
    networkProxy?: string; // e.g. "socks5://127.0.0.1:3333"
    localStorage?: LocalStorageConfig[]; // localStorage values to extract after auth
}

export interface CdpFlowResult {
    cookies: Cookie[];
    localStorage?: Record<string, string>;
}

// CDP cookie as returned by Storage.getCookies
interface CdpCookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number; // Unix timestamp in seconds (-1 = session cookie)
    httpOnly: boolean;
    secure: boolean;
    sameSite?: string; // "Strict" | "Lax" | "None" | "ExtendedSameSite" | ...
    size?: number;
    session?: boolean;
    priority?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Find an unused TCP port by binding to :0 and reading the assigned port.
 */
function findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            if (!addr || typeof addr === 'string') {
                server.close();
                reject(new Error('Could not determine free port'));
                return;
            }
            const port = addr.port;
            server.close(() => resolve(port));
        });
        server.on('error', reject);
    });
}

/**
 * Fetch a JSON URL using the built-in http module.
 */
function fetchJson(url: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk: string) => (data += chunk));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data) as Record<string, unknown>);
                } catch {
                    reject(new Error(`Failed to parse JSON from ${url}: ${data.slice(0, 200)}`));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(3000, () => {
            req.destroy();
            reject(new Error(`Timeout fetching ${url}`));
        });
    });
}

/**
 * Poll http://localhost:PORT/json/version until the browser is ready.
 * Returns the webSocketDebuggerUrl.
 */
async function waitForBrowserReady(port: number, timeoutMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    const pollInterval = 500;

    while (Date.now() < deadline) {
        try {
            const json = await fetchJson(`http://127.0.0.1:${port}/json/version`);
            const wsUrl = json.webSocketDebuggerUrl as string | undefined;
            if (wsUrl) return wsUrl;
        } catch {
            // Browser not ready yet — keep polling
        }
        await new Promise((r) => setTimeout(r, pollInterval));
    }

    throw new BrowserTimeoutError('waiting for browser CDP endpoint', timeoutMs);
}

/**
 * Map a CDP sameSite string to the sigcli Cookie sameSite type.
 */
function mapSameSite(
    cdpSameSite: string | undefined,
): 'Strict' | 'Lax' | 'None' | undefined {
    if (!cdpSameSite) return undefined;
    const s = cdpSameSite.toLowerCase();
    if (s === 'strict') return 'Strict';
    if (s === 'lax') return 'Lax';
    if (s === 'none') return 'None';
    return undefined;
}

/**
 * Convert CDP cookies to sigcli Cookie format, filtering by domains.
 */
function mapCdpCookies(cdpCookies: CdpCookie[], domains: string[]): Cookie[] {
    return cdpCookies
        .filter((c) => {
            // CDP domain may have a leading dot (e.g. ".example.com")
            const cookieDomain = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
            return domains.some(
                (d) => cookieDomain === d || cookieDomain.endsWith('.' + d) || d.endsWith('.' + cookieDomain),
            );
        })
        .map((c) => ({
            name: c.name,
            value: c.value,
            domain: c.domain.startsWith('.') ? c.domain.slice(1) : c.domain,
            path: c.path,
            expires: c.expires < 0 ? -1 : Math.floor(c.expires),
            httpOnly: c.httpOnly,
            secure: c.secure,
            ...(mapSameSite(c.sameSite) !== undefined
                ? { sameSite: mapSameSite(c.sameSite) }
                : {}),
        }));
}

/**
 * Remove SingletonLock file if present (left by crashed Playwright sessions).
 */
function removeSingletonLock(browserDataDir: string): void {
    const lockFile = path.join(browserDataDir, 'SingletonLock');
    try {
        if (fs.existsSync(lockFile)) {
            fs.unlinkSync(lockFile);
        }
    } catch {
        // Not critical — continue even if removal fails
    }
}

/**
 * Extract localStorage values via CDP Runtime.evaluate on the first page target.
 * Matches the existing Playwright approach: get raw value by key, then use dlv for jsonPath.
 */
async function extractLocalStorageViaCdp(
    cdpClient: { send: (method: string, params?: Record<string, unknown>, sessionId?: string) => Promise<unknown> },
    configs: LocalStorageConfig[],
    logger: ILogger,
): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    if (configs.length === 0) return result;

    try {
        // Get page targets
        const targetsResult = (await cdpClient.send('Target.getTargets')) as {
            targetInfos: Array<{ targetId: string; type: string; url: string }>;
        };
        const pageTarget = targetsResult?.targetInfos?.find((t) => t.type === 'page');
        if (!pageTarget) {
            logger.debug('No page target found for localStorage extraction');
            return result;
        }

        // Attach to the page target to access its JS context
        const attachResult = (await cdpClient.send('Target.attachToTarget', {
            targetId: pageTarget.targetId,
            flatten: true,
        })) as { sessionId: string };
        const sessionId = attachResult?.sessionId;
        if (!sessionId) {
            logger.debug('Failed to attach to page target — no sessionId returned');
            return result;
        }
        logger.debug(`Attached to page target ${pageTarget.targetId} (url: ${pageTarget.url}) with session ${sessionId}`);

        // Enable Runtime domain on the page session
        await cdpClient.send('Runtime.enable', {}, sessionId).catch(() => {});

        // Check current page URL — localStorage is only accessible from the same origin
        const urlResult = (await cdpClient.send('Runtime.evaluate', {
            expression: 'window.location.href',
            returnByValue: true,
        }, sessionId)) as { result?: { value?: string } };
        const currentUrl = urlResult?.result?.value ?? '';
        logger.debug(`Page URL: ${currentUrl}`);

        // Read all localStorage keys in a single evaluate call (scoped to page session)
        const keys = configs.map((c) => c.key);
        logger.debug(`Extracting localStorage keys: ${keys.join(', ')}`);
        const evalResult = (await cdpClient.send('Runtime.evaluate', {
            expression: `(() => { try { return (${JSON.stringify(keys)}).map(k => localStorage.getItem(k)); } catch(e) { return null; } })()`,
            returnByValue: true,
        }, sessionId)) as { result?: { value?: (string | null)[] | null }; exceptionDetails?: unknown };

        if (evalResult?.exceptionDetails) {
            logger.debug(`localStorage evaluate exception: ${JSON.stringify(evalResult.exceptionDetails)}`);
        }

        const rawValues = evalResult?.result?.value ?? [];
        if (!rawValues) {
            logger.debug('localStorage access denied on current page origin');
            return result;
        }
        logger.debug(`localStorage raw values: ${rawValues.map(v => v ? v.slice(0, 30) + '...' : 'null').join(', ')}`);

        for (let i = 0; i < configs.length; i++) {
            const config = configs[i];
            const raw = rawValues[i];
            if (raw == null) continue;

            if (config.jsonPath) {
                try {
                    const parsed = JSON.parse(raw) as Record<string, unknown>;
                    const value = dlv(parsed, config.jsonPath);
                    if (typeof value === 'string') {
                        result[config.name] = value;
                    }
                } catch {
                    // Invalid JSON — skip
                }
            } else {
                result[config.name] = raw;
            }
        }

        // Detach from target
        await cdpClient.send('Target.detachFromTarget', { sessionId }).catch(() => {});
    } catch (e) {
        logger.debug(`localStorage extraction error: ${(e as Error).message}`);
    }

    return result;
}

// ============================================================================
// Main flow
// ============================================================================

/**
 * Run the native CDP authentication flow.
 *
 * Launches the user's real browser (no automation markers), navigates to
 * entryUrl, and waits for the user to log in. Polls for cookies via CDP.
 */
export async function runCdpFlow(
    options: CdpFlowOptions,
): Promise<Result<CdpFlowResult, AuthError>> {
    const {
        entryUrl,
        browserDataDir,
        execPath,
        domains,
        requiredCookies,
        timeout,
        logger,
        networkProxy,
    } = options;

    // Expand ~ in browserDataDir
    const expandedDataDir = browserDataDir.startsWith('~')
        ? path.join(os.homedir(), browserDataDir.slice(1))
        : browserDataDir;

    // Remove stale SingletonLock
    removeSingletonLock(expandedDataDir);

    // Find a free port for CDP
    let cdpPort: number;
    try {
        cdpPort = await findFreePort();
    } catch (e) {
        return err(new BrowserError(`Failed to find free port for CDP: ${(e as Error).message}`));
    }

    // Build browser launch args
    const browserArgs: string[] = [
        `--remote-debugging-port=${cdpPort}`,
        `--user-data-dir=${expandedDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
    ];
    if (networkProxy) {
        // Chromium uses socks5:// natively (does remote DNS by default, unlike curl's socks5h)
        browserArgs.push(`--proxy-server=${networkProxy}`);
    }
    browserArgs.push(entryUrl);

    logger.info(`Launching native browser with CDP on port ${cdpPort}...`);
    logger.info(`Please complete login in the browser window.`);

    let browser: ChildProcess | undefined;

    // Register exit handlers to ensure browser cleanup
    const cleanup = () => {
        if (browser && !browser.killed) {
            browser.kill('SIGTERM');
            // SIGKILL fallback after 3 seconds
            setTimeout(() => {
                if (browser && !browser.killed) {
                    try {
                        browser.kill('SIGKILL');
                    } catch {
                        // Ignore
                    }
                }
            }, 3000).unref();
        }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    try {
        browser = spawn(execPath, browserArgs, {
            detached: false,
            stdio: 'ignore',
        });

        browser.on('error', (e) => {
            logger.error(`Browser process error: ${e.message}`);
        });

        // Wait for browser CDP endpoint to become available (max 15s)
        let wsUrl: string;
        try {
            wsUrl = await waitForBrowserReady(cdpPort, 15_000);
        } catch {
            return err(
                new BrowserTimeoutError(
                    'waiting for native browser to start',
                    15_000,
                ),
            );
        }

        logger.info(`Connected to browser CDP at port ${cdpPort}`);

        // Connect via raw WebSocket
        let cdpClient;
        try {
            cdpClient = await connectCdpWs(wsUrl);
        } catch (e) {
            return err(
                new BrowserError(
                    `Failed to connect to browser CDP: ${(e as Error).message}`,
                ),
            );
        }

        // Build URLs for cookie extraction
        const cookieUrls: string[] = [];
        for (const domain of domains) {
            if (options.cookiePaths.length > 0) {
                for (const p of options.cookiePaths) {
                    cookieUrls.push(`https://${domain}${p}`);
                }
            } else {
                cookieUrls.push(`https://${domain}/`);
            }
        }

        // Poll for cookies until all required ones are present
        const pollInterval = 2_000;
        const statusInterval = 30_000;
        const deadline = Date.now() + timeout;
        let lastStatus = Date.now();

        while (Date.now() < deadline) {
            try {
                // Use Storage.getCookies with the domain URLs
                const result = (await cdpClient.send('Storage.getCookies', {
                    browserContextId: undefined,
                })) as { cookies: CdpCookie[] } | null;

                const allCdpCookies = result?.cookies ?? [];
                const filtered = mapCdpCookies(allCdpCookies, domains);

                if (requiredCookies.length > 0) {
                    const cookieNames = new Set(filtered.map((c) => c.name));
                    const allPresent = requiredCookies.every((name) => cookieNames.has(name));
                    if (allPresent) {
                        logger.info('Authentication detected — all required cookies found.');
                        // Poll localStorage until values appear (Slack needs time to hydrate)
                        let localStorageValues: Record<string, string> | undefined;
                        if (options.localStorage?.length) {
                            const lsDeadline = Date.now() + 15_000; // max 15s for localStorage
                            while (Date.now() < lsDeadline) {
                                await new Promise((r) => setTimeout(r, 2000));
                                localStorageValues = await extractLocalStorageViaCdp(cdpClient, options.localStorage, logger);
                                if (localStorageValues && Object.keys(localStorageValues).length > 0) break;
                                logger.debug('localStorage not ready yet, retrying...');
                            }
                        }
                        if (localStorageValues && Object.keys(localStorageValues).length > 0) {
                            logger.info(`Extracted ${Object.keys(localStorageValues).length} localStorage value(s).`);
                        }
                        cdpClient.close();
                        return ok({ cookies: filtered, localStorage: localStorageValues });
                    }
                } else if (filtered.length > 0) {
                    logger.info(
                        `Authentication detected — ${filtered.length} cookie(s) found.`,
                    );
                    let localStorageValues: Record<string, string> | undefined;
                    if (options.localStorage?.length) {
                        const lsDeadline = Date.now() + 15_000;
                        while (Date.now() < lsDeadline) {
                            await new Promise((r) => setTimeout(r, 2000));
                            localStorageValues = await extractLocalStorageViaCdp(cdpClient, options.localStorage, logger);
                            if (localStorageValues && Object.keys(localStorageValues).length > 0) break;
                            logger.debug('localStorage not ready yet, retrying...');
                        }
                    }
                    if (localStorageValues && Object.keys(localStorageValues).length > 0) {
                        logger.info(`Extracted ${Object.keys(localStorageValues).length} localStorage value(s).`);
                    }
                    cdpClient.close();
                    return ok({ cookies: filtered, localStorage: localStorageValues });
                }
            } catch (e) {
                // CDP error — browser may be navigating, ignore and retry
                logger.debug(`CDP poll error: ${(e as Error).message}`);
            }

            const now = Date.now();
            if (now - lastStatus >= statusInterval) {
                const elapsed = Math.round((now - (deadline - timeout)) / 1000);
                logger.info(`Still waiting for login... (${elapsed}s elapsed)`);
                lastStatus = now;
            }

            await new Promise((r) => setTimeout(r, pollInterval));
        }

        cdpClient.close();
        return err(new BrowserTimeoutError('waiting for authentication via native browser', timeout));
    } finally {
        // Always kill browser on exit
        cleanup();
        process.off('exit', cleanup);
        process.off('SIGINT', cleanup);
        process.off('SIGTERM', cleanup);
    }
}
