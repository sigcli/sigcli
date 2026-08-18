/**
 * Regression test: TOTP auto-fill must run BEFORE the off-domain check.
 *
 * When a login flow redirects to an IdP on a different hostname than the
 * entry URL (e.g. grafana-rel → sub.idp.example.com), `isOffDomain`
 * returns true and the previous ordering caused `continue` to run before
 * the TOTP hook was reached — so the OTP was never filled.
 *
 * This test verifies:
 *   - When current page URL is on an IdP domain (sub.idp.example.com)
 *   - AND the provider's entry hostname is different (grafana.example.com)
 *   - AND an IdP is configured for that IdP hostname with a TOTP secret
 *   - THEN `injectTotpFill` IS called (even though isOffDomain would be true).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BrowserConfig } from '../../../src/config/schema.js';
import type { IdpEntry } from '../../../src/idps/types.js';
import { BrowserStrategy } from '../../../src/strategies/browser/browser-strategy.js';
import * as cdpWsMod from '../../../src/strategies/browser/cdp-ws.js';
import * as totpInjectorMod from '../../../src/strategies/browser/totp-injector.js';
import type { IIdpRegistry, ProviderConfig } from '../../../src/types/index.js';
import { validate } from '../../../src/utils/credential-validator.js';

// ============================================================================
// Module mocks
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

vi.mock('../../../src/strategies/browser/totp-injector.js', () => ({
    injectTotpFill: vi.fn(),
}));

const mockedConnectCdpWs = vi.mocked(cdpWsMod.connectCdpWs);
const mockedAttachToPageTarget = vi.mocked(cdpWsMod.attachToPageTarget);
const mockedValidate = vi.mocked(validate);
const mockedInjectTotpFill = vi.mocked(totpInjectorMod.injectTotpFill);

// ============================================================================
// Constants mirrored from browser-strategy.ts
// ============================================================================

const POLL_INTERVAL_MS = 3000;
const SESSION_ID = 'sess-1';

// ============================================================================
// Helpers
// ============================================================================

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
        id: 'grafana-rel',
        name: 'Grafana Rel',
        domains: ['grafana.example.com'],
        entryUrl: 'https://grafana.example.com/',
        strategy: 'browser',
        extract: [],
        apply: [],
        loginMode: 'visible',
        ...overrides,
    };
}

function makeCdpStub(urlSequence: string[]) {
    let urlCallCount = 0;
    return {
        send: vi.fn(
            async (method: string, params?: Record<string, unknown>, _sessionId?: string) => {
                if (method === 'Target.getTargets') {
                    return {
                        targetInfos: [{ targetId: 'target-1', type: 'page', url: 'mock-page' }],
                    };
                }
                if (method === 'Target.attachToTarget') return { sessionId: SESSION_ID };
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
}

function makeIdpRegistry(entry: IdpEntry): IIdpRegistry {
    return {
        resolve: vi.fn((candidate: string) =>
            candidate === entry.hostname || candidate.endsWith('.' + entry.hostname) ? entry : null,
        ),
        list: vi.fn(() => [entry]),
    };
}

// ============================================================================
// Test suite
// ============================================================================

describe('BrowserStrategy.pollUntilValid — TOTP hook runs before off-domain check', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        mockedAttachToPageTarget.mockResolvedValue(SESSION_ID);
        mockedInjectTotpFill.mockResolvedValue({ filled: true, submitted: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('calls injectTotpFill on IdP hostname even when off-domain from entry URL', async () => {
        // Current URL is on the IdP hostname, which is DIFFERENT from the
        // provider's entry hostname (grafana.example.com). Under the buggy
        // ordering isOffDomain() would return true and `continue` would run
        // before the TOTP block. With the fix, TOTP fill runs first.
        const cdp = makeCdpStub(['https://sub.idp.example.com/saml2/idp/sso']);
        mockedConnectCdpWs.mockResolvedValue(cdp as unknown as cdpWsMod.CdpWsClient);
        mockedValidate.mockResolvedValue(false);

        // Valid base32 TOTP secret (RFC 6238 test vector-ish)
        const idpEntry: IdpEntry = {
            hostname: 'sub.idp.example.com',
            totp: { secret: 'JBSWY3DPEHPK3PXP' },
        };
        const idps = makeIdpRegistry(idpEntry);

        const strategy = new BrowserStrategy(
            makeBrowserConfig({ visibleTimeout: 5000 }),
            undefined,
            undefined,
            idps,
        );
        const provider = makeProvider();

        const extractPromise = strategy.extract(provider);

        // Advance fake time enough for at least one iteration + timeout.
        for (let i = 0; i < 5; i++) {
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 100);
        }
        await extractPromise;

        // The core assertion: injectTotpFill was invoked despite the URL being
        // off-domain from the entry hostname.
        expect(mockedInjectTotpFill).toHaveBeenCalled();
        const call = mockedInjectTotpFill.mock.calls[0];
        // Third arg is { code }
        expect(typeof call[2].code).toBe('string');
        // Registry was consulted with the off-domain hostname
        expect(idps.resolve).toHaveBeenCalledWith('sub.idp.example.com');
    });
});
