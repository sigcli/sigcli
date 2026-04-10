import type { IBrowserAdapter, IBrowserPage, IBrowserSession } from '../../core/interfaces/browser-adapter.js';
import type { BrowserLaunchOptions, XHeaderConfig } from '../../core/types.js';
import type { BrowserConfig } from '../../config/schema.js';
import type { Result } from '../../core/result.js';
import { ok, err } from '../../core/result.js';
import { AuthError, BrowserError, BrowserTimeoutError } from '../../core/errors.js';
import { startHeaderCapture } from './header-capture.js';

export interface HybridFlowOptions {
  entryUrl: string;
  /** Called on each page to check if auth is complete */
  isAuthenticated: (page: IBrowserPage) => Promise<boolean>;
  /** Called once auth is detected to extract credentials */
  extractCredentials: (
    page: IBrowserPage,
    xHeaders?: Record<string, string>,
    meta?: { immediateAuth: boolean },
  ) => Promise<Result<unknown, AuthError>>;
  /** Global browser config (timeouts, waitUntil defaults) */
  browserConfig: BrowserConfig;
  /** Skip headless, go straight to visible (from provider config) */
  forceVisible?: boolean;
  /** Strategy-specific waitUntil override (e.g. cookie strategy uses 'networkidle') */
  waitUntil?: 'load' | 'networkidle' | 'domcontentloaded' | 'commit';
  /** Custom browser launch args */
  browserArgs?: string[];
  /** X-header configs — extra HTTP headers to capture during browser auth */
  xHeaders?: XHeaderConfig[];
  /** Provider domains used for filtering x-header capture */
  providerDomains?: string[];
}

/**
 * Hybrid browser flow: headless → visible fallback.
 *
 * 1. Tries headless browser first (fast, no user interaction)
 * 2. If headless fails (timeout, CAPTCHA, cert dialog), switches to visible
 * 3. In visible mode, waits for user to complete login manually
 * 4. Extracts credentials once authenticated
 *
 * This flow is adapter-agnostic — works with any IBrowserAdapter.
 */
export async function runHybridFlow<T>(
  adapter: IBrowserAdapter,
  options: HybridFlowOptions,
): Promise<Result<T, AuthError>> {
  const { headlessTimeout, visibleTimeout } = options.browserConfig;

  // Phase 1: Try headless (unless forceVisible)
  if (!options.forceVisible) {
    console.error('[signet] Trying silent authentication...');
    const headlessResult = await attemptAuth<T>(adapter, {
      ...options,
      headless: true,
      timeout: headlessTimeout,
    });
    if (headlessResult.ok) return headlessResult;

    console.error(
      `[signet] Silent auth failed: ${headlessResult.error.message}. Switching to visible mode...`,
    );
  }

  // Phase 2: Visible mode (user-assisted)
  console.error('[signet] Opening browser — please complete login in the browser window...');
  return await attemptAuth<T>(adapter, {
    ...options,
    headless: false,
    timeout: visibleTimeout,
  });
}

/**
 * Race `isAuthenticated` polling against an in-flight `page.goto()`.
 *
 * Why: page.goto() blocks until the page fully loads (DOMContentLoaded,
 * networkidle, etc.), but credentials are often available much earlier:
 *   - Cookies: set by SSO redirect responses mid-navigation
 *   - OAuth tokens: written to localStorage by MSAL ~1-2s into page load
 *
 * Instead of waiting for goto() to finish, we poll isAuthenticated()
 * every 500ms while navigation is still in-flight. If credentials appear
 * before the page finishes loading, we return immediately — the caller
 * extracts credentials and session.close() cleans up the pending navigation.
 *
 * Three possible outcomes:
 *   1. Auth detected during navigation → { authDetected: true }
 *   2. Navigation finishes, no auth   → { authDetected: false } (caller falls to poll loop)
 *   3. Navigation errors              → { authDetected: false, navigationError } (caller rethrows)
 */
async function raceAuthAgainstNavigation(
  page: IBrowserPage,
  navigationPromise: Promise<void>,
  isAuthenticated: (page: IBrowserPage) => Promise<boolean>,
  timeoutMs: number,
): Promise<{ authDetected: boolean; navigationError?: Error }> {
  const deadline = Date.now() + timeoutMs;
  let navSettled = false;
  let navigationError: Error | undefined;

  // Attach .then/.catch to track when navigation settles without awaiting it.
  // goto() continues in the background while we poll. We capture any navigation
  // error (timeout, net::ERR, etc.) so the caller can rethrow if needed.
  const navDone = navigationPromise
    .then(() => { navSettled = true; })
    .catch((e: unknown) => {
      navSettled = true;
      navigationError = e as Error;
    });

  while (Date.now() < deadline) {
    try {
      if (await isAuthenticated(page)) {
        return { authDetected: true };
      }
    } catch {
      // Expected during redirects — page context is temporarily invalid.
    }

    if (navSettled) {
      return { authDetected: false, navigationError };
    }

    await Promise.race([
      new Promise<void>(resolve => setTimeout(resolve, 500)),
      navDone,
    ]);

    if (navSettled) {
      try {
        if (await isAuthenticated(page)) {
          return { authDetected: true };
        }
      } catch {
        // Page may still be settling after load event.
      }
      return { authDetected: false, navigationError };
    }
  }

  return { authDetected: false };
}

async function attemptAuth<T>(
  adapter: IBrowserAdapter,
  options: HybridFlowOptions & { headless: boolean; timeout: number },
): Promise<Result<T, AuthError>> {
  let session: IBrowserSession | undefined;
  let headerCleanup: (() => void) | undefined;

  try {
    const launchOptions: BrowserLaunchOptions = {
      headless: options.headless,
      timeout: options.timeout,
      args: options.browserArgs,
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

    // Phase A: Race isAuthenticated polling against in-flight navigation
    const waitUntil = options.waitUntil ?? options.browserConfig.waitUntil;
    const navigationPromise = page.goto(options.entryUrl, {
      waitUntil,
      timeout: options.timeout,
    });

    const raceResult = await raceAuthAgainstNavigation(
      page,
      navigationPromise,
      options.isAuthenticated,
      options.timeout,
    );

    if (raceResult.authDetected) {
      console.error('[signet] Cached session found, extracting credentials...');
      const result = await options.extractCredentials(page, xHeaders, {
        immediateAuth: true,
      });
      return result as Result<T, AuthError>;
    }

    // Navigation finished without auth detected — check for nav errors
    if (raceResult.navigationError) {
      throw raceResult.navigationError;
    }

    // Phase B: Post-navigation poll fallback (for fresh login where user interaction needed)
    // raceAuthAgainstNavigation already did a final isAuthenticated check after nav settled,
    // so go straight to polling for user-interactive login.
    if (!options.headless) {
      console.error('[signet] Waiting for login to complete...');
    }
    const authenticated = await pollForAuth(
      page,
      options.isAuthenticated,
      options.timeout,
    );

    if (!authenticated) {
      return err(
        new BrowserTimeoutError('waiting for authentication', options.timeout),
      );
    }

    const result = await options.extractCredentials(page, xHeaders, {
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
): Promise<boolean> {
  const pollInterval = 1_000;
  const statusInterval = 30_000;
  const deadline = Date.now() + timeoutMs;
  let lastStatus = Date.now();

  while (Date.now() < deadline) {
    try {
      if (await isAuthenticated(page)) {
        console.error('[signet] Authentication detected, extracting credentials...');
        return true;
      }
    } catch {
      // Page might be navigating — ignore and retry
    }

    const now = Date.now();
    if (now - lastStatus >= statusInterval) {
      const elapsed = Math.round((now - (deadline - timeoutMs)) / 1000);
      console.error(
        `[signet] Still waiting for login... (${elapsed}s elapsed)`,
      );
      lastStatus = now;
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return false;
}
