import { spawn, type ChildProcess } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import {
    BrowserError,
    BrowserTimeoutError,
    err,
    ok,
    type AuthError,
    type ExtractedCredentials,
    type ExtractionContext,
    type ExtractRule,
    type IBrowserExtractor,
    type IStrategy,
    type Result,
    type WaitUntilValue,
} from '../../types/index.js';
import type {
    HeadlessExtractionCtx,
    IHeadlessExtractor,
} from '../../types/interfaces/headless-extractor.js';
import type { ExtractionResult } from '../../types/interfaces/strategy.js';
import { findFreePort, removeSingletonLock, waitForBrowserReady } from './browser-lifecycle.js';
import { connectCdpWs, type CdpWsClient } from './cdp-ws.js';
import { CdpCookieExtractor } from './extractors/cdp-cookie.js';
import { CdpStorageExtractor } from './extractors/cdp-storage.js';
import { HeadlessCookieExtractor } from './extractors/headless-cookie.js';
import { HeadlessStorageExtractor } from './extractors/headless-storage.js';
import type { DomEvaluateFn } from './login-detector.js';
import { PageStateChecker, type IPageStateChecker } from './page-state-checker.js';
import { checkRequired } from './required-checker.js';

export interface BrowserStrategyOptions {
    browserDataDir: string;
    execPath: string;
    channel: string;
    waitUntil: WaitUntilValue;
}

export class BrowserStrategy implements IStrategy {
    readonly name = 'browser';
    readonly needsBrowser = true;

    private readonly cdpExtractors: Map<string, IBrowserExtractor>;
    private readonly headlessExtractors: Map<string, IHeadlessExtractor>;
    private readonly options: BrowserStrategyOptions;
    private readonly pageState: IPageStateChecker;

    constructor(options: BrowserStrategyOptions, pageStateChecker?: IPageStateChecker) {
        this.options = options;
        this.pageState = pageStateChecker ?? new PageStateChecker();
        this.cdpExtractors = new Map();
        this.cdpExtractors.set('cookies', new CdpCookieExtractor());
        this.cdpExtractors.set('localStorage', new CdpStorageExtractor());
        this.headlessExtractors = new Map();
        this.headlessExtractors.set('cookies', new HeadlessCookieExtractor());
        this.headlessExtractors.set('localStorage', new HeadlessStorageExtractor());
    }

    async extract(
        rules: ExtractRule[],
        ctx: ExtractionContext,
    ): Promise<Result<ExtractionResult, AuthError>> {
        const headlessResult = await this.tryHeadless(rules, ctx);
        if (headlessResult) return ok(headlessResult);
        return this.extractViaCdp(rules, ctx);
    }

    // =========================================================================
    // Headless — fast, silent, no interaction needed
    // =========================================================================

    private async tryHeadless(
        rules: ExtractRule[],
        ctx: ExtractionContext,
    ): Promise<ExtractionResult | null> {
        try {
            // @ts-expect-error - playwright is an optional dependency
            const pw = await import('playwright').catch(() => null);
            if (!pw) return null;

            const dataDir = expandDataDir(this.options.browserDataDir);
            const browserCtx = await pw.chromium.launchPersistentContext(dataDir, {
                headless: true,
                channel: this.options.channel,
                ...(ctx.networkProxy ? { proxy: { server: ctx.networkProxy } } : {}),
            });

            try {
                const page = browserCtx.pages()[0] ?? (await browserCtx.newPage());
                const waitUntil = ctx.waitUntil ?? this.options.waitUntil;

                if (ctx.entryUrl) {
                    await page.goto(ctx.entryUrl, { waitUntil, timeout: ctx.timeout ?? 15000 });
                }

                const currentUrl = (page.url() as string).toLowerCase();
                const evaluate: DomEvaluateFn = <T>(expr: string) =>
                    page.evaluate(expr) as Promise<T>;

                const authenticated = await this.pageState.isAuthenticated(
                    currentUrl,
                    ctx.domains,
                    evaluate,
                    ctx.loginPatterns,
                );
                if (!authenticated) return null;

                // Build headless extraction context adapter
                const headlessCtx: HeadlessExtractionCtx = {
                    cookies: () => browserCtx.cookies(),
                    evaluate: <T>(expr: string) => page.evaluate(expr) as Promise<T>,
                };

                const { credentials, expiresAt } = await this.runHeadlessExtractors(
                    headlessCtx,
                    rules,
                    ctx.domains,
                );

                if (ctx.required?.length) {
                    if (checkRequired(ctx.required, credentials).length > 0) return null;
                }

                return { credentials, expiresAt };
            } finally {
                await browserCtx.close();
            }
        } catch {
            return null;
        }
    }

    private async runHeadlessExtractors(
        ctx: HeadlessExtractionCtx,
        rules: ExtractRule[],
        domains: string[],
    ): Promise<{ credentials: ExtractedCredentials; expiresAt?: string }> {
        const credentials: ExtractedCredentials = {};
        let expiresAt: string | undefined;

        for (const rule of rules) {
            const extractor = this.headlessExtractors.get(rule.from);
            if (!extractor) continue;

            const result = await extractor.extract(ctx, rule, domains);
            if (result) {
                credentials[result.name] = result.value;
                if (result.cookies?.length) {
                    const expiries = result.cookies
                        .filter((c) => c.expires > 0)
                        .map((c) => c.expires * 1000);
                    if (expiries.length > 0) {
                        expiresAt = new Date(Math.min(...expiries)).toISOString();
                    }
                }
            }
        }

        return { credentials, expiresAt };
    }

    // =========================================================================
    // CDP — native browser, user interacts, poll until auth complete
    // =========================================================================

    private async extractViaCdp(
        rules: ExtractRule[],
        ctx: ExtractionContext,
    ): Promise<Result<ExtractionResult, AuthError>> {
        const execPath = this.options.execPath;
        if (!execPath) {
            return err(new BrowserError('No browser found. Install Chrome, Edge, or Chromium.'));
        }

        const dataDir = expandDataDir(this.options.browserDataDir);
        removeSingletonLock(dataDir);

        let cdpPort: number;
        try {
            cdpPort = await findFreePort();
        } catch (e) {
            return err(new BrowserError(`Failed to find free port: ${(e as Error).message}`));
        }

        const browserArgs: string[] = [
            `--remote-debugging-port=${cdpPort}`,
            `--user-data-dir=${dataDir}`,
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
            browser = spawn(execPath, browserArgs, { detached: false, stdio: 'ignore' });

            const wsUrl = await waitForBrowserReady(cdpPort, 15000);
            cdpClient = await connectCdpWs(wsUrl);

            const result = await this.pollUntilComplete(cdpClient, rules, ctx);
            return ok(result);
        } catch (e) {
            if (e instanceof BrowserTimeoutError) return err(e);
            return err(new BrowserError(`Browser extraction failed: ${(e as Error).message}`));
        } finally {
            cdpClient?.close();
            cleanup();
            process.removeListener('exit', cleanup);
            process.removeListener('SIGINT', cleanup);
            process.removeListener('SIGTERM', cleanup);
        }
    }

    private async pollUntilComplete(
        cdp: CdpWsClient,
        rules: ExtractRule[],
        ctx: ExtractionContext,
    ): Promise<ExtractionResult> {
        const deadline = Date.now() + ctx.timeout;
        const pollInterval = 2000;
        const credentials: ExtractedCredentials = {};
        let expiresAt: string | undefined;

        while (Date.now() < deadline) {
            const sessionId = await this.attachToPageTarget(cdp);
            const currentUrl = await this.getCdpPageUrl(cdp, sessionId);
            const evaluate = this.makeCdpEvaluator(cdp, sessionId);

            for (const rule of rules) {
                const extractor = this.cdpExtractors.get(rule.from);
                if (!extractor) continue;
                try {
                    const result = await extractor.extract(cdp, rule, ctx.domains, ctx.cookiePaths);
                    if (result) {
                        credentials[result.name] = result.value;
                        if (result.cookies?.length) {
                            const expiries = result.cookies
                                .filter((c) => c.expires > 0)
                                .map((c) => c.expires * 1000);
                            if (expiries.length > 0) {
                                expiresAt = new Date(Math.min(...expiries)).toISOString();
                            }
                        }
                    }
                } catch {
                    // Transient failure — keep polling
                }
            }

            if (ctx.required?.length) {
                if (checkRequired(ctx.required, credentials).length === 0) {
                    return { credentials, expiresAt };
                }
            } else {
                const authenticated = await this.pageState.isAuthenticated(
                    currentUrl,
                    ctx.domains,
                    evaluate,
                    ctx.loginPatterns,
                );
                if (authenticated && Object.keys(credentials).length > 0) {
                    return { credentials, expiresAt };
                }
            }

            if (sessionId) {
                await cdp.send('Target.detachFromTarget', { sessionId }).catch(() => {});
            }
            await new Promise((r) => setTimeout(r, pollInterval));
        }

        return { credentials, expiresAt };
    }

    private async attachToPageTarget(cdp: CdpWsClient): Promise<string | null> {
        try {
            const targets = (await cdp.send('Target.getTargets')) as {
                targetInfos: Array<{ targetId: string; type: string; url: string }>;
            };
            const page = targets?.targetInfos?.find((t) => t.type === 'page');
            if (!page) return null;

            const attach = (await cdp.send('Target.attachToTarget', {
                targetId: page.targetId,
                flatten: true,
            })) as { sessionId: string };
            return attach?.sessionId ?? null;
        } catch {
            return null;
        }
    }

    private async getCdpPageUrl(cdp: CdpWsClient, sessionId: string | null): Promise<string> {
        if (!sessionId) return '';
        try {
            await cdp.send('Runtime.enable', {}, sessionId).catch(() => {});
            const result = (await cdp.send(
                'Runtime.evaluate',
                { expression: 'window.location.href', returnByValue: true },
                sessionId,
            )) as { result?: { value?: string } };
            return result?.result?.value ?? '';
        } catch {
            return '';
        }
    }

    private makeCdpEvaluator(cdp: CdpWsClient, sessionId: string | null): DomEvaluateFn {
        return async <T>(expression: string): Promise<T> => {
            if (!sessionId) return undefined as T;
            const result = (await cdp.send(
                'Runtime.evaluate',
                { expression, returnByValue: true },
                sessionId,
            )) as { result?: { value?: T } };
            return result?.result?.value as T;
        };
    }
}

// =========================================================================
// Helpers
// =========================================================================

function expandDataDir(dir: string): string {
    return dir.startsWith('~') ? path.join(os.homedir(), dir.slice(1)) : dir;
}
