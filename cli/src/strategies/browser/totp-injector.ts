/**
 * Inject a TOTP code into the current page during a browser login flow.
 *
 * Called from `BrowserStrategy.pollUntilValid` when the currently attached
 * page's hostname matches a configured IdP with a TOTP secret. The heuristic
 * looks for common OTP input selectors; if none is visible the call is a no-op
 * and the poll loop continues. After filling, the form is always submitted.
 *
 * Users can supply per-IdP selector overrides via `totp.selectors` in
 * `~/.sig/config.yaml` — user selectors are tried BEFORE the built-in defaults.
 *
 * There is NO injection surface — user-supplied selectors and the OTP code
 * are always substituted via JSON.stringify, so quotes/backslashes escape
 * safely into the page-side script.
 */

import type { IdpTotpSelectors } from '../../idps/types.js';
import type { CdpWsClient } from './cdp-ws.js';

export interface TotpFillArgs {
    code: string;
    selectors?: IdpTotpSelectors;
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
    // JSON.stringify is safe for a 6-digit numeric string and for any
    // user-supplied selector strings — quotes and backslashes are escaped.
    const codeLiteral = JSON.stringify(args.code);
    const userInputLiteral = JSON.stringify(args.selectors?.input ?? []);
    const userSubmitLiteral = JSON.stringify(args.selectors?.submit ?? []);

    return `(() => {
  const USER_INPUT = ${userInputLiteral};
  const DEFAULT_INPUT = [
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
  const USER_SUBMIT = ${userSubmitLiteral};
  let input = null;
  for (const sel of USER_INPUT.concat(DEFAULT_INPUT)) {
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
  for (const sel of USER_SUBMIT) {
    const btn = document.querySelector(sel);
    if (btn && btn.offsetParent !== null) {
      btn.click();
      return { filled: true, submitted: true };
    }
  }
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
