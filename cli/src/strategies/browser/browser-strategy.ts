import { spawn, type ChildProcess } from 'node:child_process';

import type { BrowserConfig } from '../../config/schema.js';
import {
    BrowserError,
    BrowserTimeoutError,
    err,
    LOGIN_URL_PATTERNS,
    ok,
    type AuthError,
    type ExtractedCredentials,
    type IBrowserExtractor,
    type ILogger,
    type IStrategy,
    type ProviderConfig,
    type Result,
} from '../../types/index.js';
import type { ExtractionResult } from '../../types/interfaces/strategy.js';
import { validate } from '../../utils/credential-validator.js';
import { parseDuration } from '../../utils/duration.js';
import { createNoopLogger } from '../../utils/logger.js';
import { expandHome } from '../../utils/path.js';
import { killProcess } from '../../utils/process-kill.js';
import { findFreePort, waitForBrowserReady } from './browser-lifecycle.js';
import { acquireBrowser, releaseBrowser } from './cdp-state.js';
import { attachToPageTarget, connectCdpWs, type CdpWsClient } from './cdp-ws.js';
import { CdpCookieExtractor } from './extractors/cdp-cookie.js';
import { CdpStorageExtractor } from './extractors/cdp-storage.js';

const TRACKING_COOKIE_TTL_MS = 60_000;
const EXISTING_STATE_TIMEOUT = 5000;
const LOGIN_PAGE_SETTLE_MS = 5000;
const POLL_INTERVAL_MS = 3000;

interface CookieExpiry {
    name: string;
    expires: number;
}

interface RuleExpiry {
    cookies?: CookieExpiry[];
    expiresAt?: string;
    ruleName: string;
}

export class BrowserStrategy implements IStrategy {
    readonly name = 'browser';
    readonly needsBrowser = true;

    private readonly extractors: Map<string, IBrowserExtractor>;
    private readonly config: BrowserConfig;
    private readonly logger: ILogger;

    constructor(browserConfig: BrowserConfig, _?: unknown, logger?: ILogger) {
        this.config = browserConfig;
        this.logger = logger ?? createNoopLogger();
        this.extractors = new Map<string, IBrowserExtractor>();
        this.extractors.set('cookies', new CdpCookieExtractor());
        this.extractors.set('localStorage', new CdpStorageExtractor());
    }

    async extract(provider: ProviderConfig): Promise<Result<ExtractionResult, AuthError>> {
        const mode = provider.loginMode ?? 'auto';
        this.logger.info(`${provider.id}: extract mode=${mode}`);

        if (mode === 'visible') return this.tryVisible(provider);

        const existing = await this.tryExistingState(provider);
        if (existing) return ok(existing);

        const headless = await this.tryHeadless(provider);
        if (headless) return ok(headless);

        if (mode === 'headless') return err(new BrowserError('Headless extraction failed'));

        return this.tryVisible(provider);
    }

    // =========================================================================
    // tryExistingState — headless CDP, no navigation, read browser data dir
    // =========================================================================

    private async tryExistingState(provider: ProviderConfig): Promise<ExtractionResult | null> {
        const execPath = this.config.execPath;
        if (!execPath) return null;

        this.logger.info(`${provider.id}: tryExistingState`);
        const dataDir = expandHome(this.config.browserDataDir);

        const port = await findFreePort().catch(() => null);
        if (!port) return null;

        const args = this.headlessArgs(dataDir, port);
        args.push('about:blank');

        return this.withHeadlessBrowser(
            execPath,
            args,
            port,
            EXISTING_STATE_TIMEOUT,
            async (cdp) => {
                const [credentials, expiry] = await this.runExtractors(cdp, provider);
                if (!(await validate(provider, credentials))) return null;
                this.logger.info(`${provider.id}: credentials validated`);
                return { credentials, expiresAt: this.computeExpiresAt(provider, expiry) };
            },
        );
    }

    // =========================================================================
    // tryHeadless — navigate to entryUrl, poll until valid or login page settles
    // =========================================================================

    private async tryHeadless(provider: ProviderConfig): Promise<ExtractionResult | null> {
        const execPath = this.config.execPath;
        if (!execPath) return null;

        this.logger.info(`${provider.id}: tryHeadless → ${provider.entryUrl}`);
        const dataDir = expandHome(this.config.browserDataDir);

        const port = await findFreePort().catch(() => null);
        if (!port) return null;

        const args = this.headlessArgs(dataDir, port, provider.networkProxy);
        args.push(provider.entryUrl);

        return this.withHeadlessBrowser(
            execPath,
            args,
            port,
            this.config.headlessTimeout,
            async (cdp) => {
                return this.pollUntilValid(cdp, provider, this.config.headlessTimeout, true);
            },
        );
    }

    // =========================================================================
    // tryVisible — real browser, user interacts, poll until valid or timeout
    // =========================================================================

    private async tryVisible(
        provider: ProviderConfig,
    ): Promise<Result<ExtractionResult, AuthError>> {
        const execPath = this.config.execPath;
        if (!execPath) return err(new BrowserError('No browser found. Install Chrome or Edge.'));

        this.logger.info(`${provider.id}: tryVisible → ${provider.entryUrl}`);
        const dataDir = expandHome(this.config.browserDataDir);
        const args = [
            `--user-data-dir=${dataDir}`,
            '--no-first-run',
            '--no-default-browser-check',
            ...(provider.networkProxy ? [`--proxy-server=${provider.networkProxy}`] : []),
            provider.entryUrl,
        ];

        let cdp: CdpWsClient | undefined;
        let released = false;

        const cleanup = async () => {
            if (released) return;
            released = true;
            cdp?.close();
            await releaseBrowser(dataDir, this.logger).catch(() => {});
        };
        const onSignal = () => void cleanup().finally(() => process.exit(130));
        process.on('SIGINT', onSignal);
        process.on('SIGTERM', onSignal);

        try {
            const { wsUrl } = await acquireBrowser(
                dataDir,
                execPath,
                args,
                this.config.visibleTimeout,
                this.logger,
                provider.entryUrl,
            );
            cdp = await connectCdpWs(wsUrl);

            const result = await this.pollUntilValid(
                cdp,
                provider,
                this.config.visibleTimeout,
                false,
            );
            if (!result) throw new BrowserTimeoutError('extract', this.config.visibleTimeout);
            return ok(result);
        } catch (e) {
            if (e instanceof BrowserTimeoutError) return err(e);
            return err(new BrowserError(`Browser extraction failed: ${(e as Error).message}`));
        } finally {
            await cleanup();
            process.removeListener('SIGINT', onSignal);
            process.removeListener('SIGTERM', onSignal);
        }
    }

    // =========================================================================
    // Core: poll loop — shared by tryHeadless and tryVisible
    // =========================================================================

    private async pollUntilValid(
        cdp: CdpWsClient,
        provider: ProviderConfig,
        timeout: number,
        exitOnLoginPage: boolean,
    ): Promise<ExtractionResult | null> {
        const deadline = Date.now() + timeout;
        let loginPageSince: number | null = null;
        const entryHostname = new URL(provider.entryUrl).hostname;

        await this.waitForPageReady(cdp, deadline);

        while (Date.now() < deadline) {
            const sessionId = await attachToPageTarget(cdp).catch(() => null);
            const url = await this.getPageUrl(cdp, sessionId);

            if (this.isOffDomain(url, entryHostname)) {
                this.logger.info(`${provider.id}: waiting for redirect back to ${entryHostname}`);
                if (sessionId)
                    await cdp.send('Target.detachFromTarget', { sessionId }).catch(() => {});
                await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
                continue;
            }

            // Check login/captcha pages BEFORE validate. A permissive validateUrl can
            // pass while the user is still on a login or captcha page (e.g. xhs /captcha),
            // producing a half-cooked cookie. loginUrlPatterns prevents this by gating
            // validation: if we are on a login page, skip validate entirely this iteration.
            const onLoginPage = this.isLoginUrl(url, provider.loginUrlPatterns);

            if (onLoginPage) {
                if (exitOnLoginPage) {
                    // Headless cascade: settle then bail so visible mode takes over.
                    loginPageSince = this.checkLoginPageSettled(
                        url,
                        provider.loginUrlPatterns,
                        loginPageSince,
                    );
                    if (loginPageSince && Date.now() - loginPageSince > LOGIN_PAGE_SETTLE_MS) {
                        this.logger.info(
                            `${provider.id}: login page settled, needs user interaction`,
                        );
                        return null;
                    }
                }
                // Visible mode (or pre-settle headless): wait for user to finish, do NOT validate.
                if (sessionId)
                    await cdp.send('Target.detachFromTarget', { sessionId }).catch(() => {});
                await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
                continue;
            }

            // Not on a login page — reset settle counter and proceed with validation.
            loginPageSince = null;

            const [credentials, expiry] = await this.runExtractors(cdp, provider);

            if (await validate(provider, credentials)) {
                this.logger.info(`${provider.id}: credentials validated`);
                return { credentials, expiresAt: this.computeExpiresAt(provider, expiry) };
            }

            if (sessionId) await cdp.send('Target.detachFromTarget', { sessionId }).catch(() => {});
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }

        return null;
    }

    // =========================================================================
    // Extraction — run all configured extractors against CDP
    // =========================================================================

    private async runExtractors(
        cdp: CdpWsClient,
        provider: ProviderConfig,
    ): Promise<[ExtractedCredentials, RuleExpiry[]]> {
        const credentials: ExtractedCredentials = {};
        const expiry: RuleExpiry[] = [];

        for (const rule of provider.extract) {
            const extractor = this.extractors.get(rule.from);
            if (!extractor) continue;
            try {
                const result = await extractor.extract(cdp, rule, provider.domains);
                if (!result) continue;
                credentials[result.name] = result.value;
                const idx = expiry.findIndex((r) => r.ruleName === rule.as);
                const entry: RuleExpiry = {
                    cookies: result.cookies,
                    expiresAt: result.expiresAt,
                    ruleName: rule.as,
                };
                if (idx >= 0) expiry[idx] = entry;
                else expiry.push(entry);
            } catch {
                // transient — skip
            }
        }

        this.logger.info(`${provider.id}: extracted keys=[${Object.keys(credentials).join(', ')}]`);
        return [credentials, expiry];
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private headlessArgs(dataDir: string, port: number, proxy?: string): string[] {
        return [
            '--headless',
            `--remote-debugging-port=${port}`,
            `--user-data-dir=${dataDir}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-gpu',
            ...(proxy ? [`--proxy-server=${proxy}`] : []),
        ];
    }

    private async withHeadlessBrowser<T>(
        execPath: string,
        args: string[],
        port: number,
        timeout: number,
        fn: (cdp: CdpWsClient) => Promise<T>,
    ): Promise<T | null> {
        let browser: ChildProcess | undefined;
        let cdp: CdpWsClient | undefined;

        try {
            browser = spawn(execPath, args, { detached: false, stdio: 'ignore' });
            const wsUrl = await waitForBrowserReady(port, timeout);
            cdp = await connectCdpWs(wsUrl);
            return await fn(cdp);
        } catch {
            return null;
        } finally {
            if (cdp) {
                await cdp.send('Browser.close').catch(() => {});
                cdp.close();
            }
            if (browser && !browser.killed) {
                await this.gracefulKill(browser);
            }
        }
    }

    private async gracefulKill(browser: ChildProcess): Promise<void> {
        await new Promise<void>((resolve) => {
            const t = setTimeout(() => resolve(), 3000);
            browser.on('exit', () => {
                clearTimeout(t);
                resolve();
            });
        });
        if (!browser.killed) killProcess(browser);
    }

    private isOffDomain(url: string, entryHostname: string): boolean {
        if (!url) return false;
        try {
            return new URL(url).hostname !== entryHostname;
        } catch {
            return false;
        }
    }

    private checkLoginPageSettled(
        url: string,
        customPatterns: string[] | undefined,
        since: number | null,
    ): number | null {
        if (!this.isLoginUrl(url, customPatterns)) return null;
        return since ?? Date.now();
    }

    private isLoginUrl(url: string, customPatterns?: string[]): boolean {
        if (!url) return false;
        const lower = url.toLowerCase();
        const patterns = customPatterns
            ? [...LOGIN_URL_PATTERNS, ...customPatterns]
            : LOGIN_URL_PATTERNS;
        return patterns.some((p) => lower.includes(p));
    }

    private computeExpiresAt(provider: ProviderConfig, results: RuleExpiry[]): string | undefined {
        const now = Date.now();
        const timestamps: number[] = [];
        const ttlMs = provider.ttl ? parseDuration(provider.ttl) : null;
        const ttlExpiry = ttlMs ? now + ttlMs : null;

        for (const r of results) {
            if (r.expiresAt) {
                const ms = new Date(r.expiresAt).getTime();
                if (!isNaN(ms) && ms > now) timestamps.push(ms);
            }
            if (!r.cookies?.length) continue;
            for (const c of r.cookies) {
                if (c.expires <= 0) {
                    if (ttlExpiry) timestamps.push(ttlExpiry);
                    continue;
                }
                const expiryMs = c.expires * 1000;
                if (expiryMs - now <= TRACKING_COOKIE_TTL_MS) continue;
                timestamps.push(expiryMs);
            }
        }

        if (timestamps.length === 0) return undefined;
        return new Date(Math.min(...timestamps)).toISOString();
    }

    private async getPageUrl(cdp: CdpWsClient, sessionId: string | null): Promise<string> {
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

    private async waitForPageReady(cdp: CdpWsClient, deadline: number): Promise<void> {
        while (Date.now() < deadline) {
            const sessionId = await attachToPageTarget(cdp).catch(() => null);
            if (sessionId) {
                try {
                    await cdp.send('Runtime.enable', {}, sessionId).catch(() => {});
                    const result = (await cdp.send(
                        'Runtime.evaluate',
                        { expression: 'document.readyState', returnByValue: true },
                        sessionId,
                    )) as { result?: { value?: string } };
                    if (result?.result?.value === 'complete') return;
                } catch {
                    // page mid-navigation
                }
                await cdp.send('Target.detachFromTarget', { sessionId }).catch(() => {});
            }
            await new Promise((r) => setTimeout(r, 500));
        }
    }
}
