import type {
  IBrowserAdapter,
  IBrowserSession,
  IBrowserPage,
  NavigateOptions,
  PageRequest,
  PageResponse,
} from '../../core/interfaces/browser-adapter.js';
import type { Cookie, BrowserLaunchOptions } from '../../core/types.js';
import type { BrowserConfig } from '../../config/schema.js';
import { BrowserLaunchError } from '../../core/errors.js';
import { expandHome } from '../../utils/path.js';

/**
 * Playwright-based browser adapter.
 * Uses playwright-core (no bundled browsers) — requires a system Chrome/Chromium/Edge.
 * Defaults to system Chrome (channel: 'chrome') when no explicit browser is configured.
 */
export class PlaywrightAdapter implements IBrowserAdapter {
  readonly name = 'playwright';

  constructor(private readonly browserConfig: BrowserConfig) {}

  async launch(options: BrowserLaunchOptions): Promise<IBrowserSession> {
    const { browserDataDir, channel } = this.browserConfig;

    let pw: typeof import('playwright-core');
    try {
      pw = await import('playwright-core');
    } catch {
      throw new BrowserLaunchError(
        'playwright-core is not available. Run: npm install playwright-core',
      );
    }

    try {
      const context = await pw.chromium.launchPersistentContext(expandHome(browserDataDir), {
        channel: channel,
        headless: options.headless ?? true,
        timeout: options.timeout,
        args: options.args,
      });
      return new PlaywrightSession(context);
    } catch (e: unknown) {
      const msg = (e as Error).message;
      const hint =
        msg.includes('executable') || msg.includes('Failed to launch')
          ? `${msg}. Ensure a system browser is installed, or check browser.channel in ~/.signet/config.yaml.`
          : msg;
      throw new BrowserLaunchError(hint);
    }
  }
}

class PlaywrightSession implements IBrowserSession {
  constructor(private readonly context: import('playwright-core').BrowserContext) {}

  async newPage(): Promise<IBrowserPage> {
    const page = await this.context.newPage();
    return new PlaywrightPage(page, this.context);
  }

  async pages(): Promise<IBrowserPage[]> {
    return this.context.pages().map((p) => new PlaywrightPage(p, this.context));
  }

  async close(): Promise<void> {
    try {
      await this.context.close();
    } catch {
      // Suppress close errors
    }
  }

  isConnected(): boolean {
    return true; // Persistent context doesn't expose isConnected
  }
}

class PlaywrightPage implements IBrowserPage {
  constructor(
    private readonly page: import('playwright-core').Page,
    private readonly context: import('playwright-core').BrowserContext,
  ) {}

  async goto(url: string, options?: NavigateOptions): Promise<void> {
    await this.page.goto(url, {
      waitUntil: options?.waitUntil,
      timeout: options?.timeout,
    });
  }

  url(): string {
    return this.page.url();
  }

  async waitForUrl(pattern: string | RegExp, options?: { timeout?: number }): Promise<void> {
    await this.page.waitForURL(pattern, options);
  }

  async waitForNavigation(options?: { timeout?: number }): Promise<void> {
    await this.page.waitForLoadState('networkidle', options);
  }

  async waitForLoadState(state?: 'load' | 'networkidle' | 'domcontentloaded'): Promise<void> {
    await this.page.waitForLoadState(state);
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.page.locator(selector).fill(value);
  }

  async click(selector: string, options?: { timeout?: number }): Promise<void> {
    await this.page.locator(selector).click({ timeout: options?.timeout });
  }

  async type(selector: string, text: string, options?: { delay?: number }): Promise<void> {
    await this.page.locator(selector).pressSequentially(text, { delay: options?.delay });
  }

  async waitForSelector(
    selector: string,
    options?: { timeout?: number; state?: 'visible' | 'hidden' | 'attached' },
  ): Promise<void> {
    await this.page.locator(selector).waitFor({
      timeout: options?.timeout,
      state: options?.state,
    });
  }

  async cookies(urls?: string[]): Promise<Cookie[]> {
    const rawCookies = await this.context.cookies(urls);
    return rawCookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite:
        c.sameSite === 'Strict'
          ? 'Strict'
          : c.sameSite === 'Lax'
            ? 'Lax'
            : c.sameSite === 'None'
              ? 'None'
              : undefined,
    }));
  }

  async evaluate<T>(fn: (() => T) | string): Promise<T> {
    if (typeof fn === 'string') {
      return (await this.page.evaluate(fn)) as T;
    }
    return await this.page.evaluate(fn);
  }

  async evaluateWithArg<T, A>(fn: (arg: A) => T, arg: A): Promise<T> {
    return await this.page.evaluate(fn as any, arg as any);
  }

  async screenshot(options?: { path?: string; fullPage?: boolean }): Promise<Buffer> {
    return Buffer.from(await this.page.screenshot(options));
  }

  async content(): Promise<string> {
    return await this.page.content();
  }

  async title(): Promise<string> {
    return await this.page.title();
  }

  async close(): Promise<void> {
    if (!this.page.isClosed()) {
      await this.page.close();
    }
  }

  isClosed(): boolean {
    return this.page.isClosed();
  }

  onClose(handler: () => void): void {
    this.page.on('close', handler);
  }

  onRequest(handler: (request: PageRequest) => void): () => void {
    const listener = (req: import('playwright-core').Request) => {
      handler({
        url: req.url(),
        method: req.method(),
        headers: req.headers(),
      });
    };
    this.page.on('request', listener);
    return () => {
      this.page.off('request', listener);
    };
  }

  onResponse(handler: (response: PageResponse) => void): () => void {
    const listener = (res: import('playwright-core').Response) => {
      handler({
        url: res.url(),
        status: res.status(),
        headers: res.headers(),
      });
    };
    this.page.on('response', listener);
    return () => {
      this.page.off('response', listener);
    };
  }
}
