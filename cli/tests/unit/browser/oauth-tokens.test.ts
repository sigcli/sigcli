import { describe, it, expect, vi } from 'vitest';
import { hasOAuthTokens } from '../../../src/browser/flows/oauth-consent.flow.js';
import type { IBrowserPage } from '../../../src/core/interfaces/browser-adapter.js';

// Test JWTs with properly base64url-encoded header and payload
const VALID_JWT_WITH_AUD =
  'eyJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJ0ZXN0LWF1ZGllbmNlIiwiZXhwIjo5OTk5OTk5OTk5fQ.fakesig';
const VALID_JWT_NO_AUD =
  'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjo5OTk5OTk5OTk5fQ.fakesig';
const VALID_JWT_WRONG_AUD =
  'eyJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJ3cm9uZy1hdWRpZW5jZSIsImV4cCI6OTk5OTk5OTk5OX0.fakesig';

/**
 * Creates a minimal mock IBrowserPage whose `evaluate` returns the given
 * storage entries (simulating localStorage/sessionStorage content).
 */
function createMockPage(
  storageEntries: Record<string, string> = {},
): IBrowserPage {
  return {
    goto: vi.fn(),
    url: vi.fn(() => 'https://app.example.com'),
    waitForUrl: vi.fn(),
    waitForNavigation: vi.fn(),
    waitForLoadState: vi.fn(),
    fill: vi.fn(),
    click: vi.fn(),
    type: vi.fn(),
    waitForSelector: vi.fn(),
    cookies: vi.fn(async () => []),
    evaluate: vi.fn(async () => storageEntries),
    evaluateWithArg: vi.fn(),
    screenshot: vi.fn(),
    content: vi.fn(),
    title: vi.fn(),
    close: vi.fn(),
    isClosed: vi.fn(() => false),
    onClose: vi.fn(),
  };
}

/**
 * Creates a mock page whose `evaluate` rejects with an error,
 * simulating a page crash or navigation error.
 */
function createErrorPage(): IBrowserPage {
  return {
    goto: vi.fn(),
    url: vi.fn(() => 'about:blank'),
    waitForUrl: vi.fn(),
    waitForNavigation: vi.fn(),
    waitForLoadState: vi.fn(),
    fill: vi.fn(),
    click: vi.fn(),
    type: vi.fn(),
    waitForSelector: vi.fn(),
    cookies: vi.fn(async () => []),
    evaluate: vi.fn(async () => {
      throw new Error('Page crashed');
    }),
    evaluateWithArg: vi.fn(),
    screenshot: vi.fn(),
    content: vi.fn(),
    title: vi.fn(),
    close: vi.fn(),
    isClosed: vi.fn(() => false),
    onClose: vi.fn(),
  };
}

describe('hasOAuthTokens', () => {
  describe('basic detection', () => {
    it('returns false when localStorage and sessionStorage are empty', async () => {
      const page = createMockPage({});
      const result = await hasOAuthTokens(page);
      expect(result).toBe(false);
    });

    it('returns true when a valid JWT exists in localStorage', async () => {
      const page = createMockPage({
        'local:msal.token': VALID_JWT_NO_AUD,
      });
      const result = await hasOAuthTokens(page);
      expect(result).toBe(true);
    });

    it('returns true when a valid JWT exists in sessionStorage', async () => {
      const page = createMockPage({
        'session:msal.token': VALID_JWT_NO_AUD,
      });
      const result = await hasOAuthTokens(page);
      expect(result).toBe(true);
    });

    it('returns false when storage contains non-JWT values', async () => {
      const page = createMockPage({
        'local:theme': 'dark',
        'session:lang': 'en',
        'local:someKey': 'not-a-jwt-at-all',
      });
      const result = await hasOAuthTokens(page);
      expect(result).toBe(false);
    });
  });

  describe('audience filtering', () => {
    it('returns true when JWT matches expected audience', async () => {
      const page = createMockPage({
        'local:access_token': VALID_JWT_WITH_AUD,
      });
      const result = await hasOAuthTokens(page, ['test-audience']);
      expect(result).toBe(true);
    });

    it('returns false when JWT exists but does not match audience', async () => {
      const page = createMockPage({
        'local:access_token': VALID_JWT_WRONG_AUD,
      });
      const result = await hasOAuthTokens(page, ['test-audience']);
      expect(result).toBe(false);
    });

    it('returns true when one of multiple audiences matches', async () => {
      const page = createMockPage({
        'local:token': VALID_JWT_WITH_AUD,
      });
      const result = await hasOAuthTokens(page, ['other-audience', 'test-audience']);
      expect(result).toBe(true);
    });

    it('returns true with no audience filter even when JWT has an audience', async () => {
      const page = createMockPage({
        'local:token': VALID_JWT_WITH_AUD,
      });
      // No audiences argument — should match any token
      const result = await hasOAuthTokens(page);
      expect(result).toBe(true);
    });

    it('returns false when audiences are specified but JWT has no aud claim', async () => {
      const page = createMockPage({
        'local:token': VALID_JWT_NO_AUD, // has sub but no aud
      });
      const result = await hasOAuthTokens(page, ['test-audience']);
      expect(result).toBe(false);
    });
  });

  describe('graceful error handling', () => {
    it('returns false when page.evaluate throws an error', async () => {
      const page = createErrorPage();
      const result = await hasOAuthTokens(page);
      expect(result).toBe(false);
    });

    it('returns false when page.evaluate throws with audience filter', async () => {
      const page = createErrorPage();
      const result = await hasOAuthTokens(page, ['test-audience']);
      expect(result).toBe(false);
    });
  });

  describe('regression: premature browser closure', () => {
    it('returns false on a non-login page with empty storage (the bug scenario)', async () => {
      // This is the core regression case: the page is NOT a login page
      // (e.g., Teams app loaded) but MSAL hasn't written tokens yet.
      // The old code would have returned isAuthenticated=true here,
      // causing premature browser closure.
      const page = createMockPage({
        'local:msal.interaction.status': 'in_progress',
        'session:msal.account.keys': '[]',
        // No actual JWT tokens in storage yet
      });
      const result = await hasOAuthTokens(page);
      expect(result).toBe(false);
    });

    it('returns true only after tokens appear in storage', async () => {
      // First call: no tokens yet
      const emptyPage = createMockPage({
        'local:msal.interaction.status': 'in_progress',
      });
      expect(await hasOAuthTokens(emptyPage)).toBe(false);

      // Second call: tokens have been written by MSAL
      const populatedPage = createMockPage({
        'local:msal.interaction.status': 'completed',
        'local:msal.token.cache': JSON.stringify({
          accessToken: VALID_JWT_WITH_AUD,
        }),
      });
      expect(await hasOAuthTokens(populatedPage)).toBe(true);
    });
  });
});
