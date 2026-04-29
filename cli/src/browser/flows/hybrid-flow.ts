import type {
    IBrowserAdapter,
    IBrowserPage,
    IBrowserSession,
} from '../../core/interfaces/browser-adapter.js';
import type {
    BrowserLaunchOptions,
    XHeaderConfig,
    LocalStorageConfig,
    ILogger,
    Cookie,
} from '../../core/types.js';
import type { WaitUntilValue } from '../../core/constants.js';
import { LoginMode } from '../../core/constants.js';
import type { BrowserConfig } from '../../config/schema.js';
import type { Result } from '../../core/result.js';
import { err } from '../../core/result.js';
import { AuthError, BrowserError, BrowserTimeoutError } from '../../core/errors.js';
import { startHeaderCapture } from './header-capture.js';
import { extractLocalStorage } from './localstorage-capture.js';
import { runCdpFlow } from './cdp-flow.js';
import { findNativeBrowser } from '../detect-native.js';

/** Fallback logger used when callers pass the default stderr logger. */
export const stderrLogger: ILogger = {
    debug: () => {},
    info: (msg: string) => process.stderr.write(`[sig] ${msg}\n`),
    warn: (msg: string) => process.stderr.write(`[sig] ${msg}\n`),
    error: (msg: string) => process.stderr.write(`[sig] ${msg}\n`),
};

export interface HybridFlowOptions {
    entryUrl: string;
    /** Called on each page to check if auth is complete */
    isAuthenticated: (page: IBrowserPage) => Promise<boolean>;
    /** Called once auth is detected to extract credentials */
    extractCredentials: (
        page: IBrowserPage,
        xHeaders?: Record<string, string>,
        localStorage?: Record<string, string>,
        meta?: { immediateAuth: boolean },
    ) => Promise<Result<unknown, AuthError>>;
    /** Variant of extractCredentials used in CDP mode (raw cookies already available) */
    extractCredentialsFromCookies?: (
        cookies: Cookie[],
        localStorage?: Record<string, string>,
    ) => Promise<Result<unknown, AuthError>>;
    /** Global browser config (timeouts, waitUntil defaults) */
    browserConfig: BrowserConfig;
    /** Skip headless, go straight to visible (from provider config) */
    forceVisible?: boolean;
    /** Login mode: 'auto' | 'cdp' | 'headless' | 'visible' */
    loginMode?: string;
    /** Strategy-specific waitUntil override (e.g. cookie strategy uses 'networkidle') */
    waitUntil?: WaitUntilValue;
    /** Custom browser launch args */
    browserArgs?: string[];
    /** X-header configs — extra HTTP headers to capture during browser auth */
    xHeaders?: XHeaderConfig[];
    /** Provider domains used for filtering x-header capture and CDP cookie filtering */
    providerDomains?: string[];
    /** Required cookie names for CDP polling (CDP mode) */
    requiredCookies?: string[];
    /** Cookie paths for CDP polling */
    cookiePaths?: string[];
    /** Browser data directory (used in CDP mode) */
    browserDataDir?: string;
    /** Native browser binary path (used in CDP mode) */
    execPath?: string;
    /** localStorage configs — values to extract from browser localStorage after auth */
    localStorage?: LocalStorageConfig[];
    /** Logger for flow progress messages */
    logger: ILogger;
    /** Network proxy for the browser, e.g. "socks5://127.0.0.1:1080" */
    networkProxy?: string;
}

/**
 * Hybrid browser flow: headless → CDP → visible fallback.
 *
 * Phase 1 (headless Playwright): Fast, no user interaction.
 * Phase 2 (native CDP):          Real browser, no automation markers; user logs in manually.
 * Phase 3 (visible Playwright):  Legacy fallback.
 *
 * The active phases depend on `loginMode`:
 * - 'auto' (default): headless → CDP → visible
 * - 'cdp':            CDP only
 * - 'headless':       headless only
 * - 'visible':        visible only
 *
 * This flow is adapter-agnostic — works with any IBrowserAdapter.
 */
export async function runHybridFlow<T>(
    adapter: IBrowserAdapter,
    options: HybridFlowOptions,
): Promise<Result<T, AuthError>> {
    const { headlessTimeout, visibleTimeout } = options.browserConfig;
    const logger = options.logger;
    const loginMode = options.loginMode ?? LoginMode.AUTO;

    // ------------------------------------------------------------------
    // Phase 1: Headless Playwright
    // ------------------------------------------------------------------
    const skipHeadless =
        options.forceVisible === true ||
        loginMode === LoginMode.CDP ||
        loginMode === LoginMode.VISIBLE;

    if (!skipHeadless) {
        logger.info('Trying silent authentication...');
        const headlessResult = await attemptAuth<T>(adapter, {
            ...options,
            logger,
            headless: true,
            timeout: headlessTimeout,
        });
        if (headlessResult.ok) return headlessResult;

        if (loginMode === LoginMode.HEADLESS) {
            // Headless-only mode — don't fall through to other phases
            return headlessResult;
        }

        logger.info(
            `Silent auth failed: ${headlessResult.error.message}. Trying native browser...`,
        );
    }

    // ------------------------------------------------------------------
    // Phase 2: Native CDP (real browser, bypasses automation detection)
    // ------------------------------------------------------------------
    // Skip CDP if the Playwright adapter is unavailable (NullBrowserAdapter or stub)
    // We detect this by checking if the adapter has a functional launch method, OR
    // by its name being 'null' (NullBrowserAdapter convention).
    const browserUnavailable = adapter.name === 'null' || typeof adapter.launch !== 'function';
    if (loginMode === LoginMode.CDP && browserUnavailable) {
        return err(
            new BrowserError(
                'CDP mode requested but running in browserless mode. ' +
                    'Set mode: browser in config or use --token/--cookie.',
            ),
        );
    }
    const useCdp =
        (loginMode === LoginMode.AUTO || loginMode === LoginMode.CDP) && !browserUnavailable;
    if (useCdp) {
        // Resolve browser binary: explicit execPath → auto-detect → skip
        let execPath = options.execPath ?? options.browserConfig.execPath;
        if (!execPath) {
            const detected = findNativeBrowser(options.browserConfig.channel);
            if (detected) {
                execPath = detected.execPath;
                logger.warn(
                    `Auto-detected native browser: ${detected.name} at ${detected.execPath}. ` +
                        `Run "sig init" to persist the browser path in config.`,
                );
            }
        }

        if (execPath) {
            logger.info('Opening native browser — please complete login in the browser window...');
            const browserDataDir =
                options.browserDataDir ??
                options.browserConfig.browserDataDir ??
                '~/.sig/browser-data';

            const cdpResult = await runCdpFlow({
                entryUrl: options.entryUrl,
                browserDataDir,
                execPath,
                domains: options.providerDomains ?? [],
                requiredCookies: options.requiredCookies ?? [],
                cookiePaths: options.cookiePaths ?? [],
                timeout: visibleTimeout,
                logger,
                networkProxy: options.networkProxy,
                localStorage: options.localStorage,
            });

            if (cdpResult.ok) {
                // CDP flow succeeded — convert cookies to credentials
                if (options.extractCredentialsFromCookies) {
                    const credResult = await options.extractCredentialsFromCookies(
                        cdpResult.value.cookies,
                        cdpResult.value.localStorage,
                    );
                    if (credResult.ok) return credResult as Result<T, AuthError>;
                    // Fall through to visible if CDP credential extraction fails
                    logger.info(
                        `CDP credential extraction failed: ${credResult.error.message}. Falling back to visible mode...`,
                    );
                } else {
                    // No CDP-specific extractor — fall through to visible phase
                    logger.info(
                        'No CDP credential extractor configured. Falling back to visible Playwright...',
                    );
                }
            } else if (loginMode === LoginMode.CDP) {
                // CDP-only mode — return error directly
                return cdpResult as Result<T, AuthError>;
            } else {
                logger.info(
                    `Native browser auth failed: ${cdpResult.error.message}. Falling back to visible mode...`,
                );
            }
        } else {
            logger.warn(
                'No native browser found for CDP mode. ' +
                    'Install Chrome, Edge, or Chromium, or set browser.execPath in config.',
            );
            if (loginMode === LoginMode.CDP) {
                return err(
                    new BrowserError(
                        'CDP mode requested but no native browser binary found. ' +
                            'Install Chrome/Edge/Chromium or set browser.execPath in config.',
                    ),
                );
            }
        }
    }

    // ------------------------------------------------------------------
    // Phase 3: Visible Playwright (legacy fallback)
    // ------------------------------------------------------------------
    if (loginMode === LoginMode.CDP) {
        // CDP-only — should not reach here unless execPath was missing (already handled above)
        return err(new BrowserError('CDP mode failed and no fallback available.'));
    }

    logger.info('Opening browser — please complete login in the browser window...');
    return await attemptAuth<T>(adapter, {
        ...options,
        logger,
        headless: false,
        timeout: visibleTimeout,
    });
}

async function captureLocalStorageValues(
    page: IBrowserPage,
    configs?: LocalStorageConfig[],
): Promise<Record<string, string> | undefined> {
    if (!configs || configs.length === 0) return undefined;
    try {
        const values = await extractLocalStorage(page, configs);
        return Object.keys(values).length > 0 ? values : undefined;
    } catch {
        // localStorage extraction is supplementary — never block the primary auth flow
        return undefined;
    }
}

async function attemptAuth<T>(
    adapter: IBrowserAdapter,
    options: HybridFlowOptions & { headless: boolean; timeout: number; logger: ILogger },
): Promise<Result<T, AuthError>> {
    let session: IBrowserSession | undefined;
    let headerCleanup: (() => void) | undefined;
    const logger = options.logger;

    try {
        const args: string[] = [];
        if (options.networkProxy) {
            args.push(`--proxy-server=${options.networkProxy}`);
        }
        if (options.browserArgs) {
            args.push(...options.browserArgs);
        }

        const launchOptions: BrowserLaunchOptions = {
            headless: options.headless,
            timeout: options.timeout,
            args: args.length > 0 ? args : undefined,
        };

        session = await adapter.launch(launchOptions);
        const page = await session.newPage();

        // Set up x-header capture before navigation (so we capture all traffic)
        let xHeaders: Record<string, string> | undefined;
        if (options.xHeaders && options.xHeaders.length > 0) {
            const capture = startHeaderCapture(
                page,
                options.xHeaders,
                options.providerDomains ?? [],
            );
            xHeaders = capture.xHeaders;
            headerCleanup = capture.cleanup;
        }

        // Navigate to entry URL
        // Strategy can override global waitUntil (e.g. cookie forces 'networkidle')
        const waitUntil = options.waitUntil ?? options.browserConfig.waitUntil;
        await page.goto(options.entryUrl, {
            waitUntil,
            timeout: options.timeout,
        });

        // Brief pause to let any client-side redirects start
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Check if already authenticated (cached session/cookies)
        if (await options.isAuthenticated(page)) {
            logger.info('Cached session found, extracting credentials...');
            const localStorageValues = await captureLocalStorageValues(page, options.localStorage);
            const result = await options.extractCredentials(page, xHeaders, localStorageValues, {
                immediateAuth: true,
            });
            return result as Result<T, AuthError>;
        }

        // Wait for authentication to complete (polling)
        if (!options.headless) {
            logger.info('Waiting for login to complete...');
        }
        const authenticated = await pollForAuth(
            page,
            options.isAuthenticated,
            options.timeout,
            logger,
        );

        if (!authenticated) {
            return err(new BrowserTimeoutError('waiting for authentication', options.timeout));
        }

        const localStorageValues = await captureLocalStorageValues(page, options.localStorage);
        const result = await options.extractCredentials(page, xHeaders, localStorageValues, {
            immediateAuth: false,
        });
        return result as Result<T, AuthError>;
    } catch (e: unknown) {
        if (e instanceof AuthError) {
            return err(e);
        }
        return err(new BrowserError((e as Error).message));
    } finally {
        if (headerCleanup) {
            headerCleanup();
        }
        if (session) {
            await session.close().catch(() => {});
        }
    }
}

async function pollForAuth(
    page: IBrowserPage,
    isAuthenticated: (page: IBrowserPage) => Promise<boolean>,
    timeoutMs: number,
    logger: ILogger,
): Promise<boolean> {
    const pollInterval = 2_000;
    const statusInterval = 30_000;
    const deadline = Date.now() + timeoutMs;
    let lastStatus = Date.now();

    while (Date.now() < deadline) {
        try {
            if (await isAuthenticated(page)) {
                logger.info('Authentication detected, extracting credentials...');
                return true;
            }
        } catch {
            // Page might be navigating — ignore and retry
        }

        const now = Date.now();
        if (now - lastStatus >= statusInterval) {
            const elapsed = Math.round((now - (deadline - timeoutMs)) / 1000);
            logger.info(`Still waiting for login... (${elapsed}s elapsed)`);
            lastStatus = now;
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    return false;
}
