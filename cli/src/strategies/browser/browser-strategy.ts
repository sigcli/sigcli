import { spawn, type ChildProcess } from 'node:child_process';

import type { BrowserConfig } from '../../config/schema.js';
import {
    BrowserError,
    BrowserTimeoutError,
    err,
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
import { createNoopLogger } from '../../utils/logger.js';
import { expandHome } from '../../utils/path.js';
import { killProcess } from '../../utils/process-kill.js';
import { findFreePort, removeSingletonLock, waitForBrowserReady } from './browser-lifecycle.js';
import { attachToPageTarget, connectCdpWs, type CdpWsClient } from './cdp-ws.js';
import { CdpCookieExtractor } from './extractors/cdp-cookie.js';
import { CdpStorageExtractor } from './extractors/cdp-storage.js';
import type { DomEvaluateFn } from './login-detector.js';
import { PageStateChecker, type IPageStateChecker } from './page-state-checker.js';
import { checkRequired } from './required-checker.js';

export class BrowserStrategy implements IStrategy {
    readonly name = 'browser';
    readonly needsBrowser = true;

    private readonly cdpExtractors: Map<string, IBrowserExtractor>;
    private readonly browserConfig: BrowserConfig;
    private readonly pageState: IPageStateChecker;
    private readonly logger: ILogger;

    constructor(
        browserConfig: BrowserConfig,
        pageStateChecker?: IPageStateChecker,
        logger?: ILogger,
    ) {
        this.browserConfig = browserConfig;
        this.pageState = pageStateChecker ?? new PageStateChecker();
        this.logger = logger ?? createNoopLogger();
        this.cdpExtractors = new Map();
        this.cdpExtractors.set('cookies', new CdpCookieExtractor());
        this.cdpExtractors.set('localStorage', new CdpStorageExtractor());
    }

    async extract(provider: ProviderConfig): Promise<Result<ExtractionResult, AuthError>> {
        this.logger.info(`${provider.id}: starting browser extraction`);
        const headlessResult = await this.tryHeadless(provider);
        if (headlessResult) return ok(headlessResult);
        return this.extractViaCdp(provider);
    }

    // =========================================================================
    // Headless — fast, silent, no interaction needed
    // =========================================================================

    private async tryHeadless(provider: ProviderConfig): Promise<ExtractionResult | null> {
        this.logger.info(`${provider.id}: trying headless`);

        const execPath = this.browserConfig.execPath;
        if (!execPath) {
            this.logger.info(`${provider.id}: no browser found, skipping headless`);
            return null;
        }

        const dataDir = expandHome(this.browserConfig.browserDataDir);
        removeSingletonLock(dataDir);

        let cdpPort: number;
        try {
            cdpPort = await findFreePort();
        } catch {
            this.logger.info(`${provider.id}: failed to find free port for headless`);
            return null;
        }

        const browserArgs: string[] = [
            '--headless',
            `--remote-debugging-port=${cdpPort}`,
            `--user-data-dir=${dataDir}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-gpu',
        ];
        if (provider.networkProxy) {
            browserArgs.push(`--proxy-server=${provider.networkProxy}`);
        }
        browserArgs.push('about:blank');

        let browser: ChildProcess | undefined;
        let cdpClient: CdpWsClient | undefined;

        try {
            browser = spawn(execPath, browserArgs, { detached: false, stdio: 'ignore' });

            const wsUrl = await waitForBrowserReady(cdpPort, this.browserConfig.headlessTimeout);
            cdpClient = await connectCdpWs(wsUrl);
            this.logger.info(`${provider.id}: headless CDP connected`);

            const credentials: ExtractedCredentials = {};
            let expiresAt: string | undefined;

            for (const rule of provider.extract) {
                const extractor = this.cdpExtractors.get(rule.from);
                if (!extractor) continue;
                try {
                    const result = await extractor.extract(cdpClient, rule, provider.domains);
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
                    // Extraction failure for this rule — skip
                }
            }

            if (provider.required?.length) {
                if (checkRequired(provider.required, credentials).length > 0) {
                    this.logger.info(
                        `${provider.id}: headless missing required credentials, falling back`,
                    );
                    return null;
                }
            } else if (Object.keys(credentials).length === 0) {
                this.logger.info(`${provider.id}: headless found no credentials, falling back`);
                return null;
            }

            this.logger.info(
                `${provider.id}: headless extracted ${Object.keys(credentials).length} credential(s)`,
            );
            return { credentials, expiresAt };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.warn(`${provider.id}: headless failed (${msg}), falling back`);
            return null;
        } finally {
            cdpClient?.close();
            if (browser && !browser.killed) {
                killProcess(browser);
            }
        }
    }

    // =========================================================================
    // CDP — native browser, user interacts, poll until auth complete
    // =========================================================================

    private async extractViaCdp(
        provider: ProviderConfig,
    ): Promise<Result<ExtractionResult, AuthError>> {
        const execPath = this.browserConfig.execPath;
        if (!execPath) {
            return err(new BrowserError('No browser found. Install Chrome or Edge.'));
        }

        const dataDir = expandHome(this.browserConfig.browserDataDir);
        removeSingletonLock(dataDir);

        let cdpPort: number;
        try {
            cdpPort = await findFreePort();
        } catch (e) {
            return err(new BrowserError(`Failed to find free port: ${(e as Error).message}`));
        }

        this.logger.info(`${provider.id}: CDP port ${cdpPort}`);

        const browserArgs: string[] = [
            `--remote-debugging-port=${cdpPort}`,
            `--user-data-dir=${dataDir}`,
            '--no-first-run',
            '--no-default-browser-check',
        ];
        if (provider.networkProxy) {
            browserArgs.push(`--proxy-server=${provider.networkProxy}`);
        }
        browserArgs.push(provider.entryUrl);

        let browser: ChildProcess | undefined;
        const cleanup = () => {
            if (browser && !browser.killed) {
                killProcess(browser);
            }
        };
        const sigHandler = () => {
            cleanup();
            process.exit(130);
        };

        process.on('exit', cleanup);
        process.on('SIGINT', sigHandler);
        process.on('SIGTERM', sigHandler);

        let cdpClient: CdpWsClient | undefined;

        try {
            this.logger.info(`${provider.id}: launching browser for CDP`);
            browser = spawn(execPath, browserArgs, { detached: false, stdio: 'ignore' });

            const wsUrl = await waitForBrowserReady(cdpPort, this.browserConfig.visibleTimeout);
            cdpClient = await connectCdpWs(wsUrl);
            this.logger.info(`${provider.id}: CDP connected`);

            const result = await this.pollUntilComplete(cdpClient, provider);
            this.logger.info(
                `${provider.id}: extraction complete (${Object.keys(result.credentials).length} credentials)`,
            );
            return ok(result);
        } catch (e) {
            if (e instanceof BrowserTimeoutError) return err(e);
            return err(new BrowserError(`Browser extraction failed: ${(e as Error).message}`));
        } finally {
            cdpClient?.close();
            cleanup();
            process.removeListener('exit', cleanup);
            process.removeListener('SIGINT', sigHandler);
            process.removeListener('SIGTERM', sigHandler);
        }
    }

    private async pollUntilComplete(
        cdp: CdpWsClient,
        provider: ProviderConfig,
    ): Promise<ExtractionResult> {
        const deadline = Date.now() + this.browserConfig.visibleTimeout;
        const pollInterval = 2000;
        const credentials: ExtractedCredentials = {};
        let expiresAt: string | undefined;

        while (Date.now() < deadline) {
            const sessionId = await attachToPageTarget(cdp).catch(() => null);
            const currentUrl = await this.getCdpPageUrl(cdp, sessionId);
            const evaluate = this.makeCdpEvaluator(cdp, sessionId);

            for (const rule of provider.extract) {
                const extractor = this.cdpExtractors.get(rule.from);
                if (!extractor) continue;
                try {
                    const result = await extractor.extract(cdp, rule, provider.domains);
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

            if (provider.required?.length) {
                if (checkRequired(provider.required, credentials).length === 0) {
                    return { credentials, expiresAt };
                }
            } else {
                const authenticated = await this.pageState.isAuthenticated(
                    currentUrl,
                    provider.domains,
                    evaluate,
                    provider.loginUrlPatterns,
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

        if (provider.required?.length) {
            const missing = checkRequired(provider.required, credentials);
            if (missing.length > 0) {
                throw new BrowserTimeoutError(
                    `extract (missing: ${missing.join(', ')})`,
                    this.browserConfig.visibleTimeout,
                );
            }
        }
        if (Object.keys(credentials).length === 0) {
            throw new BrowserTimeoutError('extract', this.browserConfig.visibleTimeout);
        }
        return { credentials, expiresAt };
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
