import type { Cookie, BrowserLaunchOptions } from '../types.js';
import type { WaitUntilValue } from '../constants.js';

/**
 * Pluggable browser automation adapter.
 *
 * Ships with PlaywrightAdapter. Users can implement this interface
 * for Puppeteer, raw CDP, or any other browser automation tool.
 *
 * Example:
 *   class PuppeteerAdapter implements IBrowserAdapter {
 *     readonly name = 'puppeteer';
 *     async launch(options) { ... }
 *   }
 */
export interface IBrowserAdapter {
  readonly name: string;
  launch(options: BrowserLaunchOptions): Promise<IBrowserSession>;
}

export interface IBrowserSession {
  newPage(): Promise<IBrowserPage>;
  pages(): Promise<IBrowserPage[]>;
  close(): Promise<void>;
  isConnected(): boolean;
}

export interface IBrowserPage {
  // Navigation
  goto(url: string, options?: NavigateOptions): Promise<void>;
  url(): string;
  waitForUrl(pattern: string | RegExp, options?: { timeout?: number }): Promise<void>;
  waitForNavigation(options?: { timeout?: number }): Promise<void>;
  waitForLoadState(state?: 'load' | 'networkidle' | 'domcontentloaded'): Promise<void>;

  // Interaction
  fill(selector: string, value: string): Promise<void>;
  click(selector: string, options?: { timeout?: number }): Promise<void>;
  type(selector: string, text: string, options?: { delay?: number }): Promise<void>;
  waitForSelector(
    selector: string,
    options?: { timeout?: number; state?: 'visible' | 'hidden' | 'attached' },
  ): Promise<void>;

  // Extraction
  cookies(urls?: string[]): Promise<Cookie[]>;
  evaluate<T>(fn: (() => T) | string): Promise<T>;
  evaluateWithArg<T, A>(fn: ((arg: A) => T), arg: A): Promise<T>;

  // Debug
  screenshot(options?: { path?: string; fullPage?: boolean }): Promise<Buffer>;
  content(): Promise<string>;
  title(): Promise<string>;

  // Lifecycle
  close(): Promise<void>;
  isClosed(): boolean;

  // Events
  onClose(handler: () => void): void;

  // Network interception (optional — used for header capture)
  onRequest?(handler: (request: PageRequest) => void): () => void;
  onResponse?(handler: (response: PageResponse) => void): () => void;
}

export interface PageRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
}

export interface PageResponse {
  url: string;
  status: number;
  headers: Record<string, string>;
}

export interface NavigateOptions {
  waitUntil?: WaitUntilValue;
  timeout?: number;
}
