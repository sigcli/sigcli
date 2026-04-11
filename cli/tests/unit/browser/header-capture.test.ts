import { describe, it, expect, vi } from 'vitest';
import { startHeaderCapture } from '../../../src/browser/flows/header-capture.js';
import type {
  IBrowserPage,
  PageRequest,
  PageResponse,
} from '../../../src/core/interfaces/browser-adapter.js';
import type { XHeaderConfig } from '../../../src/core/types.js';

/**
 * Create a minimal mock IBrowserPage with controllable onRequest/onResponse.
 * Listeners are stored so tests can fire fake network events.
 */
function createMockPage(options?: { supportsListeners?: boolean }) {
  const supportsListeners = options?.supportsListeners ?? true;
  const requestListeners: Array<(req: PageRequest) => void> = [];
  const responseListeners: Array<(res: PageResponse) => void> = [];

  const page: IBrowserPage = {
    // Navigation stubs
    goto: vi.fn(),
    url: vi.fn(() => 'https://example.com'),
    waitForUrl: vi.fn(),
    waitForNavigation: vi.fn(),
    waitForLoadState: vi.fn(),

    // Interaction stubs
    fill: vi.fn(),
    click: vi.fn(),
    type: vi.fn(),
    waitForSelector: vi.fn(),

    // Extraction stubs
    cookies: vi.fn(async () => []),
    evaluate: vi.fn(),
    evaluateWithArg: vi.fn(),

    // Debug stubs
    screenshot: vi.fn(),
    content: vi.fn(),
    title: vi.fn(),

    // Lifecycle stubs
    close: vi.fn(),
    isClosed: vi.fn(() => false),
    onClose: vi.fn(),
  };

  if (supportsListeners) {
    page.onRequest = (handler: (req: PageRequest) => void) => {
      requestListeners.push(handler);
      return () => {
        const idx = requestListeners.indexOf(handler);
        if (idx >= 0) requestListeners.splice(idx, 1);
      };
    };

    page.onResponse = (handler: (res: PageResponse) => void) => {
      responseListeners.push(handler);
      return () => {
        const idx = responseListeners.indexOf(handler);
        if (idx >= 0) responseListeners.splice(idx, 1);
      };
    };
  }

  return {
    page,
    fireRequest: (req: PageRequest) => {
      for (const fn of requestListeners) fn(req);
    },
    fireResponse: (res: PageResponse) => {
      for (const fn of responseListeners) fn(res);
    },
    getRequestListenerCount: () => requestListeners.length,
    getResponseListenerCount: () => responseListeners.length,
  };
}

describe('startHeaderCapture', () => {
  const providerDomains = ['example.com'];

  it('returns empty xHeaders when no configs provided', () => {
    const { page } = createMockPage();
    const result = startHeaderCapture(page, [], providerDomains);

    expect(result.xHeaders).toEqual({});
    expect(typeof result.cleanup).toBe('function');
  });

  it('populates static values immediately without network activity', () => {
    const { page } = createMockPage();
    const configs: XHeaderConfig[] = [
      { name: 'x-custom', staticValue: 'static-val' },
      { name: 'x-another', staticValue: 'another-val' },
    ];

    const result = startHeaderCapture(page, configs, providerDomains);

    expect(result.xHeaders).toEqual({
      'x-custom': 'static-val',
      'x-another': 'another-val',
    });
  });

  it('captures dynamic request-source headers via onRequest', () => {
    const mock = createMockPage();
    const configs: XHeaderConfig[] = [{ name: 'x-token', source: 'request' }];

    const result = startHeaderCapture(mock.page, configs, providerDomains);
    expect(result.xHeaders['x-token']).toBeUndefined();

    mock.fireRequest({
      url: 'https://example.com/api/data',
      method: 'GET',
      headers: { 'x-token': 'req-value-123' },
    });

    expect(result.xHeaders['x-token']).toBe('req-value-123');
  });

  it('captures dynamic response-source headers via onResponse', () => {
    const mock = createMockPage();
    const configs: XHeaderConfig[] = [{ name: 'x-resp-id', source: 'response' }];

    const result = startHeaderCapture(mock.page, configs, providerDomains);
    expect(result.xHeaders['x-resp-id']).toBeUndefined();

    mock.fireResponse({
      url: 'https://example.com/api/data',
      status: 200,
      headers: { 'x-resp-id': 'resp-456' },
    });

    expect(result.xHeaders['x-resp-id']).toBe('resp-456');
  });

  it('defaults source to request when not specified', () => {
    const mock = createMockPage();
    const configs: XHeaderConfig[] = [
      { name: 'x-default' }, // no source specified
    ];

    const result = startHeaderCapture(mock.page, configs, providerDomains);

    // Should be captured from requests (default)
    mock.fireRequest({
      url: 'https://example.com/api',
      method: 'GET',
      headers: { 'x-default': 'from-request' },
    });

    expect(result.xHeaders['x-default']).toBe('from-request');
  });

  describe('URL pattern matching', () => {
    it('captures headers when URL matches the pattern', () => {
      const mock = createMockPage();
      const configs: XHeaderConfig[] = [{ name: 'x-api', source: 'request', urlPattern: '/api/' }];

      const result = startHeaderCapture(mock.page, configs, providerDomains);

      mock.fireRequest({
        url: 'https://example.com/api/users',
        method: 'GET',
        headers: { 'x-api': 'matched' },
      });

      expect(result.xHeaders['x-api']).toBe('matched');
    });

    it('does not capture headers when URL does not match the pattern', () => {
      const mock = createMockPage();
      const configs: XHeaderConfig[] = [{ name: 'x-api', source: 'request', urlPattern: '/api/' }];

      const result = startHeaderCapture(mock.page, configs, providerDomains);

      mock.fireRequest({
        url: 'https://example.com/static/logo.png',
        method: 'GET',
        headers: { 'x-api': 'should-not-capture' },
      });

      expect(result.xHeaders['x-api']).toBeUndefined();
    });
  });

  describe('domain matching', () => {
    it('captures headers for matching provider domain', () => {
      const mock = createMockPage();
      const configs: XHeaderConfig[] = [{ name: 'x-auth', source: 'request' }];

      const result = startHeaderCapture(mock.page, configs, ['api.example.com']);

      mock.fireRequest({
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: { 'x-auth': 'domain-match' },
      });

      expect(result.xHeaders['x-auth']).toBe('domain-match');
    });

    it('does not capture headers for non-matching domain', () => {
      const mock = createMockPage();
      const configs: XHeaderConfig[] = [{ name: 'x-auth', source: 'request' }];

      const result = startHeaderCapture(mock.page, configs, ['api.example.com']);

      mock.fireRequest({
        url: 'https://other-site.com/data',
        method: 'GET',
        headers: { 'x-auth': 'wrong-domain' },
      });

      expect(result.xHeaders['x-auth']).toBeUndefined();
    });

    it('supports wildcard domain matching (*.example.com)', () => {
      const mock = createMockPage();
      const configs: XHeaderConfig[] = [{ name: 'x-wild', source: 'request' }];

      const result = startHeaderCapture(mock.page, configs, ['*.example.com']);

      // Subdomain should match
      mock.fireRequest({
        url: 'https://api.example.com/endpoint',
        method: 'GET',
        headers: { 'x-wild': 'sub-match' },
      });
      expect(result.xHeaders['x-wild']).toBe('sub-match');
    });

    it('wildcard domain matches the bare domain as well', () => {
      const mock = createMockPage();
      const configs: XHeaderConfig[] = [{ name: 'x-wild', source: 'request' }];

      const result = startHeaderCapture(mock.page, configs, ['*.example.com']);

      mock.fireRequest({
        url: 'https://example.com/endpoint',
        method: 'GET',
        headers: { 'x-wild': 'bare-match' },
      });
      expect(result.xHeaders['x-wild']).toBe('bare-match');
    });

    it('wildcard domain does not match unrelated domains', () => {
      const mock = createMockPage();
      const configs: XHeaderConfig[] = [{ name: 'x-wild', source: 'request' }];

      const result = startHeaderCapture(mock.page, configs, ['*.example.com']);

      mock.fireRequest({
        url: 'https://evil-example.com/endpoint',
        method: 'GET',
        headers: { 'x-wild': 'should-not-match' },
      });
      expect(result.xHeaders['x-wild']).toBeUndefined();
    });
  });

  it('performs case-insensitive header name matching', () => {
    const mock = createMockPage();
    const configs: XHeaderConfig[] = [{ name: 'X-Custom-Token', source: 'request' }];

    const result = startHeaderCapture(mock.page, configs, providerDomains);

    mock.fireRequest({
      url: 'https://example.com/api',
      method: 'GET',
      headers: { 'x-custom-token': 'lower-case-val' }, // lowercase in actual headers
    });

    // Should be stored under the original config name
    expect(result.xHeaders['X-Custom-Token']).toBe('lower-case-val');
  });

  it('last-write-wins: later captures overwrite earlier ones for same header', () => {
    const mock = createMockPage();
    const configs: XHeaderConfig[] = [{ name: 'x-session', source: 'request' }];

    const result = startHeaderCapture(mock.page, configs, providerDomains);

    mock.fireRequest({
      url: 'https://example.com/first',
      method: 'GET',
      headers: { 'x-session': 'first-value' },
    });
    expect(result.xHeaders['x-session']).toBe('first-value');

    mock.fireRequest({
      url: 'https://example.com/second',
      method: 'GET',
      headers: { 'x-session': 'second-value' },
    });
    expect(result.xHeaders['x-session']).toBe('second-value');
  });

  it('cleanup function removes listeners and stops further captures', () => {
    const mock = createMockPage();
    const configs: XHeaderConfig[] = [{ name: 'x-token', source: 'request' }];

    const result = startHeaderCapture(mock.page, configs, providerDomains);

    // Verify listener was registered
    expect(mock.getRequestListenerCount()).toBe(1);

    // Capture one value
    mock.fireRequest({
      url: 'https://example.com/api',
      method: 'GET',
      headers: { 'x-token': 'before-cleanup' },
    });
    expect(result.xHeaders['x-token']).toBe('before-cleanup');

    // Call cleanup
    result.cleanup();
    expect(mock.getRequestListenerCount()).toBe(0);

    // Fire another request — should NOT update xHeaders
    mock.fireRequest({
      url: 'https://example.com/api',
      method: 'GET',
      headers: { 'x-token': 'after-cleanup' },
    });
    expect(result.xHeaders['x-token']).toBe('before-cleanup');
  });

  describe('graceful degradation', () => {
    it('works without errors when page lacks onRequest/onResponse', () => {
      const { page } = createMockPage({ supportsListeners: false });
      const configs: XHeaderConfig[] = [
        { name: 'x-dynamic', source: 'request' },
        { name: 'x-static', staticValue: 'still-works' },
      ];

      // Should not throw
      const result = startHeaderCapture(page, configs, providerDomains);

      // Static values still populated
      expect(result.xHeaders['x-static']).toBe('still-works');
      // Dynamic value not captured (no listener support)
      expect(result.xHeaders['x-dynamic']).toBeUndefined();
      // Cleanup should be a no-op but not throw
      expect(() => result.cleanup()).not.toThrow();
    });

    it('returns only static values when page lacks listener support', () => {
      const { page } = createMockPage({ supportsListeners: false });
      const configs: XHeaderConfig[] = [
        { name: 'x-a', staticValue: 'val-a' },
        { name: 'x-b', staticValue: 'val-b' },
      ];

      const result = startHeaderCapture(page, configs, providerDomains);
      expect(result.xHeaders).toEqual({ 'x-a': 'val-a', 'x-b': 'val-b' });
    });
  });

  it('handles a mix of static and dynamic configs', () => {
    const mock = createMockPage();
    const configs: XHeaderConfig[] = [
      { name: 'x-static', staticValue: 'fixed' },
      { name: 'x-dynamic', source: 'request' },
      { name: 'x-resp', source: 'response' },
    ];

    const result = startHeaderCapture(mock.page, configs, providerDomains);

    // Static is immediately available
    expect(result.xHeaders['x-static']).toBe('fixed');
    expect(result.xHeaders['x-dynamic']).toBeUndefined();
    expect(result.xHeaders['x-resp']).toBeUndefined();

    // Fire request and response
    mock.fireRequest({
      url: 'https://example.com/api',
      method: 'POST',
      headers: { 'x-dynamic': 'dyn-val' },
    });
    mock.fireResponse({
      url: 'https://example.com/api',
      status: 200,
      headers: { 'x-resp': 'resp-val' },
    });

    expect(result.xHeaders).toEqual({
      'x-static': 'fixed',
      'x-dynamic': 'dyn-val',
      'x-resp': 'resp-val',
    });
  });

  it('does not capture headers when request URL is invalid', () => {
    const mock = createMockPage();
    const configs: XHeaderConfig[] = [{ name: 'x-test', source: 'request' }];

    const result = startHeaderCapture(mock.page, configs, providerDomains);

    // Fire a request with an invalid URL
    mock.fireRequest({
      url: 'not-a-valid-url',
      method: 'GET',
      headers: { 'x-test': 'should-not-capture' },
    });

    expect(result.xHeaders['x-test']).toBeUndefined();
  });
});
