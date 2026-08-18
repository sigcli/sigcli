/**
 * Inject a TOTP code into the current page during a browser login flow.
 *
 * Called from `BrowserStrategy.pollUntilValid` when the currently attached
 * page's hostname matches a configured IdP with a TOTP secret. The heuristic
 * looks for common OTP input selectors; if none is visible the call is a no-op
 * and the poll loop continues. After filling, the form is always submitted.
 *
 * There is NO injection surface — the only user input in the script is the
 * 6-digit numeric code, substituted via JSON.stringify.
 */

import type { CdpWsClient } from './cdp-ws.js';

export interface TotpFillArgs {
    code: string;
}

export interface TotpFillResult {
    filled: boolean;
    submitted: boolean;
    reason?: string;
}

/**
 * Build the page-side IIFE that fills the OTP input and submits the form.
 * Pure function — exported so it can be unit-tested without a real browser.
 */
export function buildFillScript(args: TotpFillArgs): string {
    // JSON.stringify is safe for a 6-digit numeric string.
    const codeLiteral = JSON.stringify(args.code);

    return `(() => {
  const trySelectors = [
    '#j_otpcode',
    'input[name="j_otpcode"]',
    '#otp',
    'input[name="otp"]',
    'input[autocomplete="one-time-code"]',
    'input[name="code"]',
    'input[name="passcode"]',
    'input[type="tel"][maxlength="6"]',
    'input[inputmode="numeric"]',
  ];
  let input = null;
  for (const sel of trySelectors) {
    const el = document.querySelector(sel);
    if (el && el.offsetParent !== null) { input = el; break; }
  }
  if (!input) return { filled: false, submitted: false, reason: 'no-input' };
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;
  nativeSetter.call(input, ${codeLiteral});
  input.dispatchEvent(new Event('input',  { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  const form = input.form || input.closest('form');
  if (!form) return { filled: true, submitted: false, reason: 'no-form' };
  if (typeof form.requestSubmit === 'function') form.requestSubmit();
  else form.submit();
  return { filled: true, submitted: true };
})()`;
}

/**
 * Evaluate `buildFillScript` in the given CDP session. Never throws — returns
 * a structured result even when the evaluation fails.
 */
export async function injectTotpFill(
    cdp: CdpWsClient,
    sessionId: string,
    args: TotpFillArgs,
): Promise<TotpFillResult> {
    const expression = buildFillScript(args);
    try {
        const res = (await cdp.send(
            'Runtime.evaluate',
            { expression, returnByValue: true },
            sessionId,
        )) as {
            result?: { value?: unknown };
            exceptionDetails?: unknown;
        };

        if (res?.exceptionDetails) {
            return { filled: false, submitted: false, reason: 'exception' };
        }

        const value = res?.result?.value;
        if (!value || typeof value !== 'object') {
            return { filled: false, submitted: false, reason: 'bad-shape' };
        }
        const v = value as Record<string, unknown>;
        const result: TotpFillResult = {
            filled: v.filled === true,
            submitted: v.submitted === true,
        };
        if (typeof v.reason === 'string') result.reason = v.reason;
        return result;
    } catch {
        return { filled: false, submitted: false, reason: 'error' };
    }
}
