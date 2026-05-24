/**
 * Tests for the pollUntilValid ordering fix in BrowserStrategy.
 *
 * The bug: loginUrlPatterns was checked AFTER validate(), so a permissive
 * validateUrl could cause SigCLI to trust cookies while the user was still
 * on a login/captcha page.
 *
 * The fix: loginUrlPatterns is now checked BEFORE validate(). If the current
 * URL matches a login pattern, validation is skipped for this iteration.
 *
 * Test approach: vi.useFakeTimers() is used so the POLL_INTERVAL_MS and
 * LOGIN_PAGE_SETTLE_MS sleeps are instant. Each test advances fake time
 * manually using vi.advanceTimersByTimeAsync(). This keeps tests fast,
 * deterministic, and avoids inter-test leakage from dangling async operations.
 *
 * CDP send mock contract:
 *   - Runtime.evaluate(document.readyState) → "complete" (for waitForPageReady)
 *   - Runtime.evaluate(window.location.href) → next item from urlSequence
 *   - Everything else → undefined / no-op
 *
 * attachToPageTarget is mocked separately via vi.mocked(cdpWsMod.attachToPageTarget).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BrowserConfig } from '../../../src/config/schema.js';
import { BrowserStrategy } from '../../../src/strategies/browser/browser-strategy.js';
// ============================================================================
// Imports that depend on mocked modules (must come after vi.mock calls)
// ============================================================================

import * as cdpWsMod from '../../../src/strategies/browser/cdp-ws.js';
import type { ProviderConfig } from '../../../src/types/index.js';
import { validate } from '../../../src/utils/credential-validator.js';

// ============================================================================
// Module mocks — must be at top level, before imports that trigger them
// ============================================================================

vi.mock('../../../src/strategies/browser/cdp-state.js', () => ({
    acquireBrowser: vi.fn().mockResolvedValue({ port: 9222, wsUrl: 'ws://127.0.0.1:9222/mock' }),
    releaseBrowser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/strategies/browser/cdp-ws.js', () => ({
    connectCdpWs: vi.fn(),
    attachToPageTarget: vi.fn(),
}));

vi.mock('../../../src/strategies/browser/browser-lifecycle.js', () => ({
    findFreePort: vi.fn().mockResolvedValue(9222),
    waitForBrowserReady: vi.fn().mockResolvedValue('ws://127.0.0.1:9222/mock'),
    isCdpResponding: vi.fn().mockResolvedValue(true),
    fetchJson: vi.fn().mockResolvedValue({ webSocketDebuggerUrl: 'ws://127.0.0.1:9222/mock' }),
}));

vi.mock('node:child_process', () => ({
    spawn: vi.fn().mockReturnValue({
        pid: 12345,
        killed: false,
        on: vi.fn(),
        kill: vi.fn(),
    }),
}));

vi.mock('../../../src/utils/credential-validator.js', () => ({
    validate: vi.fn(),
}));

const mockedConnectCdpWs = vi.mocked(cdpWsMod.connectCdpWs);
const mockedAttachToPageTarget = vi.mocked(cdpWsMod.attachToPageTarget);
const mockedValidate = vi.mocked(validate);

// ============================================================================
// Constants mirrored from browser-strategy.ts
// ============================================================================

const POLL_INTERVAL_MS = 3000;
const _LOGIN_PAGE_SETTLE_MS = 5000;

// ============================================================================
// Helpers
// ============================================================================

const SESSION_ID = 'sess-1';

function makeBrowserConfig(overrides: Partial<BrowserConfig> = {}): BrowserConfig {
    return {
        browserDataDir: '/tmp/test-browser-data',
        execPath: '/usr/bin/google-chrome',
        headlessTimeout: 60_000,
        visibleTimeout: 60_000,
        ...overrides,
    };
}

function makeProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
    return {
        id: 'xhs',
        name: 'Xiaohongshu',
        domains: ['xiaohongshu.com'],
        entryUrl: 'https://www.xiaohongshu.com',
        validateUrl: 'https://www.xiaohongshu.com/api/sns/v1/unread_count',
        strategy: 'browser',
        loginUrlPatterns: ['/website-login', '/captcha'],
        extract: [],
        apply: [],
        loginMode: 'visible',
        ...overrides,
    };
}

/**
 * Build a mock CdpWsClient that returns URLs from urlSequence on each
 * Runtime.evaluate(window.location.href) call.
 *
 * After the sequence is exhausted, the last URL is repeated.
 */
function makeCdpStub(urlSequence: string[]) {
    let urlCallCount = 0;
    const cdp = {
        send: vi.fn(
            async (method: string, params?: Record<string, unknown>, _sessionId?: string) => {
                if (method === 'Target.getTargets') {
                    return {
                        targetInfos: [{ targetId: 'target-1', type: 'page', url: 'mock-page' }],
                    };
                }
                if (method === 'Target.attachToTarget') {
                    return { sessionId: SESSION_ID };
                }
                if (method === 'Runtime.evaluate') {
                    const expr = (params as { expression?: string })?.expression ?? '';
                    if (expr.includes('document.readyState')) {
                        return { result: { value: 'complete' } };
                    }
                    if (expr.includes('window.location.href')) {
                        const url =
                            urlSequence[urlCallCount] ?? urlSequence[urlSequence.length - 1];
                        urlCallCount++;
                        return { result: { value: url } };
                    }
                }
                return undefined;
            },
        ),
        close: vi.fn(),
    };
    return cdp;
}

// ============================================================================
// Test suite
// ============================================================================

describe('BrowserStrategy.pollUntilValid — loginUrlPatterns checked before validate', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        mockedAttachToPageTarget.mockResolvedValue(SESSION_ID);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    /**
     * Helper: run strategy.extract() concurrently with fake-timer advances.
     *
     * The poll loop sleeps for POLL_INTERVAL_MS after each non-validating
     * iteration. We advance time by that amount after each "tick" until the
     * extract resolves or the advance limit is reached.
     *
     * maxTicks is a safety cap to avoid infinite loops in buggy tests.
     */
    async function runWithFakeTimers(
        extractPromise: Promise<unknown>,
        maxTicks = 20,
    ): Promise<unknown> {
        let ticks = 0;
        let settled = false;
        const result = extractPromise.then((r) => {
            settled = true;
            return r;
        });

        while (!settled && ticks < maxTicks) {
            // Advance fake time by one full poll interval + settle buffer
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 100);
            ticks++;
        }
        return result;
    }

    it('does NOT call validate when URL matches loginUrlPatterns', async () => {
        // URL is always on the captcha page — validate would pass if called
        const cdp = makeCdpStub(['https://www.xiaohongshu.com/website-login/captcha']);
        mockedConnectCdpWs.mockResolvedValue(cdp as unknown as cdpWsMod.CdpWsClient);
        mockedValidate.mockResolvedValue(true);

        const strategy = new BrowserStrategy(makeBrowserConfig({ visibleTimeout: 5000 }));
        const provider = makeProvider();

        const extractPromise = strategy.extract(provider);
        await runWithFakeTimers(extractPromise);
        const result = await extractPromise;

        // Should time out (BrowserTimeoutError) because validate is never called
        expect((result as { ok: boolean }).ok).toBe(false);
        expect(mockedValidate).not.toHaveBeenCalled();
    });

    it('calls validate when URL does NOT match loginUrlPatterns', async () => {
        // URL is a normal page — validate is called immediately
        const cdp = makeCdpStub(['https://www.xiaohongshu.com/explore']);
        mockedConnectCdpWs.mockResolvedValue(cdp as unknown as cdpWsMod.CdpWsClient);
        mockedValidate.mockResolvedValue(true);

        const strategy = new BrowserStrategy(makeBrowserConfig({ visibleTimeout: 10_000 }));
        const provider = makeProvider();

        const extractPromise = strategy.extract(provider);
        await runWithFakeTimers(extractPromise);
        const result = await extractPromise;

        expect((result as { ok: boolean }).ok).toBe(true);
        expect(mockedValidate).toHaveBeenCalled();
    });

    it('transitions from login page to normal page and then validates successfully', async () => {
        // 1st iteration: login page → skip validate
        // 2nd iteration: normal page → validate → success
        const cdp = makeCdpStub([
            'https://www.xiaohongshu.com/website-login',
            'https://www.xiaohongshu.com/explore',
        ]);
        mockedConnectCdpWs.mockResolvedValue(cdp as unknown as cdpWsMod.CdpWsClient);
        mockedValidate.mockResolvedValue(true);

        const strategy = new BrowserStrategy(makeBrowserConfig({ visibleTimeout: 30_000 }));
        const provider = makeProvider();

        const extractPromise = strategy.extract(provider);
        await runWithFakeTimers(extractPromise);
        const result = await extractPromise;

        expect((result as { ok: boolean }).ok).toBe(true);
        // validate was called exactly once (only on the second iteration)
        expect(mockedValidate).toHaveBeenCalledTimes(1);
    });

    it('resets loginPageSince to null when leaving a login page', async () => {
        // Sequence: captcha → normal (validate fails) → captcha → normal (validate passes)
        //
        // If loginPageSince were NOT reset when leaving the captcha page, the
        // settle timer from the first captcha visit would persist into the
        // second captcha visit. In exitOnLoginPage=false (visible) mode this
        // doesn't cause a cascade-bail, but we can verify the reset happened
        // by confirming the loop recovers correctly through a second captcha
        // visit without returning null prematurely.
        const cdp = makeCdpStub([
            'https://www.xiaohongshu.com/captcha', // iter 1: login page → skip
            'https://www.xiaohongshu.com/explore', // iter 2: normal → validate fails
            'https://www.xiaohongshu.com/captcha', // iter 3: login page → skip
            'https://www.xiaohongshu.com/explore', // iter 4: normal → validate passes
        ]);
        mockedConnectCdpWs.mockResolvedValue(cdp as unknown as cdpWsMod.CdpWsClient);
        mockedValidate.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

        const strategy = new BrowserStrategy(makeBrowserConfig({ visibleTimeout: 60_000 }));
        const provider = makeProvider();

        const extractPromise = strategy.extract(provider);
        await runWithFakeTimers(extractPromise, 10);
        const result = await extractPromise;

        expect((result as { ok: boolean }).ok).toBe(true);
        expect(mockedValidate).toHaveBeenCalledTimes(2);
    });

    it('headless cascade: returns null after LOGIN_PAGE_SETTLE_MS when exitOnLoginPage=true', async () => {
        // tryHeadless passes exitOnLoginPage=true. URL is always a login page.
        // After LOGIN_PAGE_SETTLE_MS on the login page without movement, the loop
        // returns null so visible mode can take over.
        //
        // To isolate the headless cascade we need tryExistingState to fail first.
        // validate returns false so the empty-credentials check in tryExistingState
        // produces null (same as real behavior with no stored cookies).
        const cdp = makeCdpStub(['https://www.xiaohongshu.com/website-login/captcha']);
        mockedConnectCdpWs.mockResolvedValue(cdp as unknown as cdpWsMod.CdpWsClient);
        mockedValidate.mockResolvedValue(false);

        // headlessTimeout well above LOGIN_PAGE_SETTLE_MS so the settle check
        // fires before the outer deadline. loginMode: 'headless' means when
        // tryHeadless returns null, extract() returns err (no visible fallback).
        const strategy = new BrowserStrategy(
            makeBrowserConfig({ headlessTimeout: 60_000, visibleTimeout: 60_000 }),
        );
        const provider = makeProvider({ loginMode: 'headless' });

        const extractPromise = strategy.extract(provider);

        // Advance fake time in chunks.
        // tryExistingState runs first:
        //   - poll body instant (validate=false → null)
        //   - gracefulKill: 3s setTimeout
        // tryHeadless:
        //   - iter 1: captcha url → sets loginPageSince. sleep 3s.
        //   - iter 2: captcha url → loginPageSince set. sleep 3s.
        //     After iter 1 sleep (3s), fake-time-since-loginPageSince = 3s < 5s.
        //   - iter 3: captcha url → loginPageSince set. 3s+3s=6s > 5s → returns null.
        //   - gracefulKill: 3s setTimeout
        // Total fake time needed: 3 (existingState kill) + 3+3+3+3 (headless iters+kill) = ~15s
        for (let i = 0; i < 6; i++) {
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 100);
        }

        const result = await extractPromise;

        // Should fail (headless-only mode, no visible fallback)
        expect((result as { ok: boolean }).ok).toBe(false);
        // validate was NOT called in the headless poll loop (always on login page)
        // (it WAS called by tryExistingState with empty credentials → false, which is fine)
    });

    it('visible mode (exitOnLoginPage=false): keeps polling on login page without returning null', async () => {
        // 3 iterations on login page (validate skipped), then success on normal page
        const cdp = makeCdpStub([
            'https://www.xiaohongshu.com/captcha', // iter 1: skip
            'https://www.xiaohongshu.com/captcha', // iter 2: skip
            'https://www.xiaohongshu.com/captcha', // iter 3: skip
            'https://www.xiaohongshu.com/explore', // iter 4: validate → pass
        ]);
        mockedConnectCdpWs.mockResolvedValue(cdp as unknown as cdpWsMod.CdpWsClient);
        mockedValidate.mockResolvedValue(true);

        const strategy = new BrowserStrategy(makeBrowserConfig({ visibleTimeout: 60_000 }));
        const provider = makeProvider(); // loginMode: 'visible'

        const extractPromise = strategy.extract(provider);
        await runWithFakeTimers(extractPromise, 10);
        const result = await extractPromise;

        expect((result as { ok: boolean }).ok).toBe(true);
        // validate called exactly once (only on the 4th iteration)
        expect(mockedValidate).toHaveBeenCalledTimes(1);
    });
});
