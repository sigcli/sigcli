import net from 'node:net';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import type {
    IStrategy,
    ExtractedCredentials,
    ExtractionContext,
    ExtractionResult,
} from '../../types/interfaces/strategy.js';
import type { IBrowserExtractor } from '../../types/interfaces/browser-extractor.js';
import type { ExtractRule } from '../../types/extract.js';
import type { CdpWsClient } from '../../browser/cdp-ws.js';
import type { Result } from '../../types/result.js';
import type { AuthError } from '../../types/errors.js';
import { ok, err } from '../../types/result.js';
import { BrowserError, BrowserTimeoutError } from '../../types/errors.js';
import { connectCdpWs } from '../../browser/cdp-ws.js';
import { findNativeBrowser } from '../../browser/detect-native.js';
import { CookieExtractor } from './extractors/cookie.js';
import { StorageExtractor } from './extractors/storage.js';
import { checkRequired } from '../required-checker.js';

export interface BrowserStrategyOptions {
    browserDataDir: string;
    execPath: string;
    channel: string;
}

/**
 * BrowserStrategy — launches a browser via CDP and runs sub-extractors.
 *
 * Flow:
 * 1. Find native browser binary
 * 2. Launch with --remote-debugging-port
 * 3. Connect via WebSocket CDP
 * 4. Poll sub-extractors until `required` criteria met or timeout
 * 5. Return extracted credentials
 */
export class BrowserStrategy implements IStrategy {
    readonly name = 'browser';
    readonly needsBrowser = true;

    private lastExpiresAt?: string;
    private readonly extractors: Map<string, IBrowserExtractor>;
    private readonly options: BrowserStrategyOptions;

    constructor(options: BrowserStrategyOptions) {
        this.options = options;
        this.extractors = new Map();
        this.extractors.set('cookies', new CookieExtractor());
        this.extractors.set('localStorage', new StorageExtractor());
    }

    async extract(
        rules: ExtractRule[],
        ctx: ExtractionContext,
    ): Promise<Result<ExtractionResult, AuthError>> {
        // Cascade: headless → CDP

        const headlessResult = await this.tryHeadless(rules, ctx);
        if (headlessResult) return ok({ credentials: headlessResult });

        // CDP mode
        return this.extractViaCdp(rules, ctx);
    }

    private async tryHeadless(
        rules: ExtractRule[],
        ctx: ExtractionContext,
    ): Promise<ExtractedCredentials | null> {
        try {
            // @ts-ignore - playwright is an optional dependency
            const pw = await import('playwright').catch(() => null);
            if (!pw) return null;

            const expandedDataDir = this.options.browserDataDir.startsWith('~')
                ? path.join(os.homedir(), this.options.browserDataDir.slice(1))
                : this.options.browserDataDir;

            const browserCtx = await pw.chromium.launchPersistentContext(expandedDataDir, {
                headless: true,
                channel: this.options.channel,
                ...(ctx.networkProxy ? { proxy: { server: ctx.networkProxy } } : {}),
            });

            try {
                const page = browserCtx.pages()[0] ?? (await browserCtx.newPage());
                if (ctx.entryUrl) {
                    // todo: waitUntil, timeout are from config
                    await page.goto(ctx.entryUrl, { waitUntil: 'load', timeout: 15000 });
                }

                const credentials: ExtractedCredentials = {};
                for (const rule of rules) {
                    if (rule.from === 'cookies') {
                        // todo: should be an extractor: HeadlessCookieExtractor
                        const cookies = await browserCtx.cookies();
                        const domainFiltered = cookies.filter(
                            (c: { domain: string; name: string; value: string }) => {
                                const d = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
                                return ctx.domains.some(
                                    (pd) =>
                                        d === pd || pd.endsWith('.' + d) || d.endsWith('.' + pd),
                                );
                            },
                        );
                        if (domainFiltered.length > 0) {
                            credentials[rule.name] = domainFiltered
                                .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
                                .join('; ');
                        }
                    } else if (rule.from === 'localStorage') {
                        // todo: should be an extractor: HeadlessStorageExtractor
                        // todo: if key = x.y.z, did you apply y.z? dlv or lodash
                        const storageKey = rule.key.includes('*') ? null : rule.key.split('.')[0];
                        if (storageKey) {
                            const val = await page.evaluate((k: string) => {
                                try {
                                    return localStorage.getItem(k);
                                } catch {
                                    return null;
                                }
                            }, storageKey);
                            if (val) credentials[rule.name] = val;
                        }
                    }
                }

                // Check required
                if (ctx.required?.length) {
                    const unmet = checkRequired(ctx.required, credentials);
                    if (unmet.length > 0) return null;
                } else {
                    const allExtracted = rules.every((r) => !!credentials[r.name]);
                    if (!allExtracted) return null;
                }

                return credentials;
            } finally {
                await browserCtx.close();
            }
        } catch {
            return null;
        }
    }

    private async extractViaCdp(
        rules: ExtractRule[],
        ctx: ExtractionContext,
    ): Promise<Result<ExtractionResult, AuthError>> {
        const execPath = this.options.execPath;
        if (!execPath) {
            return err(new BrowserError('No browser found. Install Chrome, Edge, or Chromium.'));
        }

        const expandedDataDir = this.options.browserDataDir.startsWith('~')
            ? path.join(os.homedir(), this.options.browserDataDir.slice(1))
            : this.options.browserDataDir;

        removeSingletonLock(expandedDataDir);

        let cdpPort: number;
        try {
            cdpPort = await findFreePort();
        } catch (e) {
            return err(new BrowserError(`Failed to find free port: ${(e as Error).message}`));
        }

        const browserArgs: string[] = [
            `--remote-debugging-port=${cdpPort}`,
            `--user-data-dir=${expandedDataDir}`,
            '--no-first-run',
            '--no-default-browser-check',
        ];
        if (ctx.networkProxy) {
            browserArgs.push(`--proxy-server=${ctx.networkProxy}`);
        }
        browserArgs.push(ctx.entryUrl);

        let browser: ChildProcess | undefined;
        const cleanup = () => {
            if (browser && !browser.killed) {
                browser.kill('SIGTERM');
                setTimeout(() => {
                    if (browser && !browser.killed) {
                        try {
                            browser.kill('SIGKILL');
                        } catch {
                            /* ignore */
                        }
                    }
                }, 3000).unref();
            }
        };

        process.on('exit', cleanup);
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        let cdpClient: CdpWsClient | undefined;

        try {
            browser = spawn(execPath, browserArgs, {
                detached: false,
                stdio: 'ignore',
            });

            const wsUrl = await waitForBrowserReady(cdpPort, 15000);
            cdpClient = await connectCdpWs(wsUrl);

            const timeout = ctx.timeout;
            const credentials = await this.pollExtractors(
                cdpClient,
                rules,
                ctx.domains,
                ctx.cookiePaths,
                ctx.required,
                timeout,
            );

            return ok({ credentials, expiresAt: this.lastExpiresAt });
        } catch (e) {
            if (e instanceof BrowserTimeoutError) {
                return err(e);
            }
            return err(new BrowserError(`Browser extraction failed: ${(e as Error).message}`));
        } finally {
            cdpClient?.close();
            cleanup();
            process.removeListener('exit', cleanup);
            process.removeListener('SIGINT', cleanup);
            process.removeListener('SIGTERM', cleanup);
        }
    }

    private async pollExtractors(
        cdp: CdpWsClient,
        rules: ExtractRule[],
        domains: string[],
        cookiePaths?: string[],
        required?: string[],
        timeout = 120000,
    ): Promise<ExtractedCredentials> {
        const deadline = Date.now() + timeout;
        const pollInterval = 2000;
        let credentials: ExtractedCredentials = {};

        while (Date.now() < deadline) {
            for (const rule of rules) {
                const extractor = this.extractors.get(rule.from);
                if (!extractor) continue;

                try {
                    const result = await extractor.extract(cdp, rule, domains, cookiePaths);
                    if (result) {
                        if (result.expiresAt) this.lastExpiresAt = result.expiresAt;
                        credentials[result.name] = result.value;
                    }
                } catch {
                    // Extraction may fail transiently — keep polling
                }
            }

            // Check completion: required criteria or all values present
            if (required?.length) {
                const unmet = checkRequired(required, credentials);
                if (unmet.length === 0) return credentials;
            } else {
                // todo: for old approach, if no required set, it will wait until user not in login page.
                // here is flaky as we may get stale cookies or irrelevant cookies
                const allExtracted = rules.every((r) => !!credentials[r.name]);
                if (allExtracted) return credentials;
            }

            await new Promise((r) => setTimeout(r, pollInterval));
        }

        return credentials;
    }
}

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

async function waitForBrowserReady(port: number, timeoutMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    const pollInterval = 500;

    while (Date.now() < deadline) {
        try {
            const json = await fetchJson(`http://127.0.0.1:${port}/json/version`);
            const wsUrl = json.webSocketDebuggerUrl as string | undefined;
            if (wsUrl) return wsUrl;
        } catch {
            // Browser not ready yet
        }
        await new Promise((r) => setTimeout(r, pollInterval));
    }

    throw new BrowserTimeoutError('waiting for browser CDP endpoint', timeoutMs);
}

function fetchJson(url: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk: string) => (data += chunk));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data) as Record<string, unknown>);
                } catch {
                    reject(new Error(`Failed to parse JSON from ${url}`));
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

function removeSingletonLock(dataDir: string): void {
    const lockFile = path.join(dataDir, 'SingletonLock');
    try {
        fs.unlinkSync(lockFile);
    } catch {
        // Not critical
    }
}
