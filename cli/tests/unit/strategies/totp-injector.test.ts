/* eslint-disable @typescript-eslint/no-this-alias, @typescript-eslint/no-implied-eval */
/**
 * Tests for buildFillScript. We evaluate the produced script in a minimal
 * hand-rolled DOM shim (no jsdom dependency) — just enough surface to run:
 *   - document.querySelector
 *   - offsetParent access on the returned element
 *   - Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
 *   - element.dispatchEvent + event listeners for 'input' / 'change'
 *   - form.requestSubmit / submit + a 'submit' listener
 */

import { describe, expect, it } from 'vitest';

import { buildFillScript } from '../../../src/strategies/browser/totp-injector.js';

// -----------------------------------------------------------------------------
// Minimal DOM shim
// -----------------------------------------------------------------------------

interface ShimEvent {
    type: string;
    bubbles: boolean;
}

interface ShimListeners {
    [type: string]: Array<(e: ShimEvent) => void>;
}

class ShimElement {
    tagName: string;
    attrs: Record<string, string> = {};
    value: string = '';
    offsetParent: object | null = { tag: 'body' };
    form: ShimForm | null = null;
    listeners: ShimListeners = {};
    _parent: ShimElement | null = null;

    constructor(tagName: string) {
        this.tagName = tagName.toUpperCase();
    }

    addEventListener(type: string, cb: (e: ShimEvent) => void) {
        (this.listeners[type] ||= []).push(cb);
    }

    dispatchEvent(e: ShimEvent) {
        (this.listeners[e.type] || []).forEach((cb) => cb(e));
    }

    closest(sel: string): ShimElement | null {
        if (sel === 'form') {
            let node: ShimElement | null = this;
            while (node) {
                if (node.tagName === 'FORM') return node;
                node = node._parent;
            }
            return null;
        }
        return null;
    }
}

class ShimForm extends ShimElement {
    constructor() {
        super('FORM');
    }
    requestSubmit() {
        this.dispatchEvent({ type: 'submit', bubbles: true });
    }
    submit() {
        this.dispatchEvent({ type: 'submit', bubbles: true });
    }
}

/**
 * Very small selector engine — supports id, tag, and attribute-value selectors
 * of the form `input[name="x"]`, `input[type="tel"][maxlength="6"]`,
 * `input[autocomplete="one-time-code"]`, `input[inputmode="numeric"]`.
 * That's enough for the totp-injector's fallback list.
 */
function matchesSelector(el: ShimElement, selector: string): boolean {
    // #id (may be followed by nothing else in our test selectors)
    if (selector.startsWith('#')) return el.attrs.id === selector.slice(1);
    // tag.class — split off leading class portion
    const classMatch = selector.match(/^([a-zA-Z]+)\.([a-zA-Z][a-zA-Z0-9_-]*)$/);
    if (classMatch) {
        const [, tag, cls] = classMatch;
        if (el.tagName !== tag.toUpperCase()) return false;
        return (el.attrs.class ?? '').split(/\s+/).includes(cls);
    }
    // input[attr="val"]... — split into tag + bracketed conditions
    const bracketRegex = /\[([a-zA-Z-]+)="([^"]+)"\]/g;
    const tagMatch = selector.match(/^([a-zA-Z]+)/);
    const tag = tagMatch ? tagMatch[1].toUpperCase() : null;
    if (tag && el.tagName !== tag) return false;
    let m: RegExpExecArray | null;
    while ((m = bracketRegex.exec(selector)) !== null) {
        const [, name, val] = m;
        if (el.attrs[name] !== val) return false;
    }
    return true;
}

function makeDocument(elements: ShimElement[]) {
    return {
        querySelector(selector: string): ShimElement | null {
            for (const el of elements) {
                if (matchesSelector(el, selector)) return el;
            }
            return null;
        },
    };
}

function makeSandbox(elements: ShimElement[]) {
    // Emulate the native value setter used by the script.
    const nativeSetter = function (this: ShimElement, v: string) {
        this.value = v;
    };
    const HTMLInputElement = {
        prototype: {} as Record<string, unknown>,
    };
    Object.defineProperty(HTMLInputElement.prototype, 'value', {
        set: nativeSetter,
        get() {
            return (this as ShimElement).value;
        },
        configurable: true,
    });
    return {
        document: makeDocument(elements),
        window: { HTMLInputElement },
        Event: class {
            type: string;
            bubbles: boolean;
            constructor(type: string, init?: { bubbles?: boolean }) {
                this.type = type;
                this.bubbles = init?.bubbles ?? false;
            }
        },
    };
}

/**
 * Evaluate the built script in a sandbox constructed from the shim globals.
 * Uses `new Function` (no eval on the outer scope) with the sandbox globals
 * as named parameters so the script sees `document`, `window`, `Event`.
 */
function runScript(script: string, sandbox: ReturnType<typeof makeSandbox>): unknown {
    // The script is an IIFE — wrap in `return (...)` so we can capture the value.
    const fn = new Function('document', 'window', 'Event', 'Object', `return ${script};`);
    return fn(sandbox.document, sandbox.window, sandbox.Event, Object);
}

function makeInput(attrs: Record<string, string>): ShimElement {
    const el = new ShimElement('INPUT');
    el.attrs = { ...attrs };
    return el;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('buildFillScript', () => {
    it('fills input[name="otp"] and dispatches input + change events', () => {
        const input = makeInput({ name: 'otp' });
        let inputFired = false;
        let changeFired = false;
        input.addEventListener('input', () => {
            inputFired = true;
        });
        input.addEventListener('change', () => {
            changeFired = true;
        });

        const sandbox = makeSandbox([input]);
        const script = buildFillScript({ code: '123456' });
        const result = runScript(script, sandbox) as { filled: boolean; submitted: boolean };

        expect(input.value).toBe('123456');
        expect(inputFired).toBe(true);
        expect(changeFired).toBe(true);
        expect(result.filled).toBe(true);
        // No ancestor form → not submitted, but filled.
        expect(result.submitted).toBe(false);
    });

    it('uses the fallback selector input[name="passcode"] when otp is absent', () => {
        const input = makeInput({ name: 'passcode' });
        const sandbox = makeSandbox([input]);
        const script = buildFillScript({ code: '999999' });
        const result = runScript(script, sandbox) as { filled: boolean };
        expect(input.value).toBe('999999');
        expect(result.filled).toBe(true);
    });

    it('triggers a submit event on the ancestor form', () => {
        const form = new ShimForm();
        const input = makeInput({ name: 'otp' });
        input.form = form;
        input._parent = form;
        let submitFired = false;
        form.addEventListener('submit', () => {
            submitFired = true;
        });

        const sandbox = makeSandbox([input]);
        const script = buildFillScript({ code: '111111' });
        const result = runScript(script, sandbox) as { filled: boolean; submitted: boolean };

        expect(input.value).toBe('111111');
        expect(submitFired).toBe(true);
        expect(result.filled).toBe(true);
        expect(result.submitted).toBe(true);
    });

    it('returns { filled: false, reason: "no-input" } when no OTP input is visible', () => {
        const sandbox = makeSandbox([]);
        const script = buildFillScript({ code: '123456' });
        const result = runScript(script, sandbox) as {
            filled: boolean;
            submitted: boolean;
            reason?: string;
        };
        expect(result.filled).toBe(false);
        expect(result.submitted).toBe(false);
        expect(result.reason).toBe('no-input');
    });

    it('skips hidden inputs (offsetParent === null)', () => {
        const hidden = makeInput({ name: 'otp' });
        hidden.offsetParent = null;
        const sandbox = makeSandbox([hidden]);
        const script = buildFillScript({ code: '123456' });
        const result = runScript(script, sandbox) as {
            filled: boolean;
            reason?: string;
        };
        expect(result.filled).toBe(false);
        expect(result.reason).toBe('no-input');
    });

    it('returns { filled: true, reason: "no-form" } when input has no ancestor form', () => {
        const input = makeInput({ name: 'otp' });
        // no .form, no ancestor form
        const sandbox = makeSandbox([input]);
        const script = buildFillScript({ code: '123456' });
        const result = runScript(script, sandbox) as {
            filled: boolean;
            submitted: boolean;
            reason?: string;
        };
        expect(result.filled).toBe(true);
        expect(result.submitted).toBe(false);
        expect(result.reason).toBe('no-form');
    });

    it('user input selector matches BEFORE the built-in defaults', () => {
        // Two inputs: one that would match a built-in selector, and one that
        // only matches the user-provided selector. The user's must win.
        const builtinTarget = makeInput({ name: 'otp' });
        const userTarget = makeInput({ id: 'passcode-field' });
        const sandbox = makeSandbox([builtinTarget, userTarget]);
        const script = buildFillScript({
            code: '654321',
            selectors: { input: ['#passcode-field'] },
        });
        const result = runScript(script, sandbox) as { filled: boolean };

        expect(result.filled).toBe(true);
        expect(userTarget.value).toBe('654321');
        expect(builtinTarget.value).toBe(''); // never touched
    });

    it('falls through to the built-in list when all user input selectors miss', () => {
        const input = makeInput({ name: 'otp' });
        const sandbox = makeSandbox([input]);
        const script = buildFillScript({
            code: '123456',
            selectors: { input: ['#nonexistent-a', '#nonexistent-b'] },
        });
        const result = runScript(script, sandbox) as { filled: boolean };

        expect(result.filled).toBe(true);
        expect(input.value).toBe('123456');
    });

    it('clicks a user-provided submit selector before falling back to form.submit', () => {
        const input = makeInput({ name: 'otp' });
        const button = new ShimElement('BUTTON');
        button.attrs = { class: 'confirm' };
        let clicked = false;
        (button as ShimElement & { click: () => void }).click = () => {
            clicked = true;
        };
        // Attach a form so we can verify submit was NOT invoked when the
        // button was clicked.
        const form = new ShimForm();
        input.form = form;
        input._parent = form;
        let submitFired = false;
        form.addEventListener('submit', () => {
            submitFired = true;
        });

        const sandbox = makeSandbox([input, button]);
        const script = buildFillScript({
            code: '111222',
            selectors: { submit: ['button.confirm'] },
        });
        const result = runScript(script, sandbox) as { filled: boolean; submitted: boolean };

        expect(clicked).toBe(true);
        expect(submitFired).toBe(false);
        expect(result.filled).toBe(true);
        expect(result.submitted).toBe(true);
    });

    it('falls back to form.requestSubmit when all user submit selectors miss', () => {
        const form = new ShimForm();
        const input = makeInput({ name: 'otp' });
        input.form = form;
        input._parent = form;
        let submitFired = false;
        form.addEventListener('submit', () => {
            submitFired = true;
        });

        const sandbox = makeSandbox([input]);
        const script = buildFillScript({
            code: '333444',
            selectors: { submit: ['button.does-not-exist'] },
        });
        const result = runScript(script, sandbox) as { filled: boolean; submitted: boolean };

        expect(submitFired).toBe(true);
        expect(result.submitted).toBe(true);
    });

    it('safely escapes user-supplied selector strings — quotes/backslashes cannot break the script', () => {
        // Feed a selector with embedded quotes/backslashes. buildFillScript
        // uses JSON.stringify on the array, so this must still produce a
        // syntactically valid IIFE that safely no-ops the malicious selector.
        const evil = `#a"]; alert(1); //`;
        const input = makeInput({ name: 'otp' });
        const sandbox = makeSandbox([input]);
        const script = buildFillScript({
            code: '123456',
            selectors: { input: [evil], submit: [evil] },
        });

        expect(() => new Function(`return ${script};`)).not.toThrow();
        const result = runScript(script, sandbox) as { filled: boolean };
        // The evil selector doesn't match anything (our shim ignores it), so
        // the built-in fallback fills input[name=otp].
        expect(result.filled).toBe(true);
        expect(input.value).toBe('123456');
    });

    it('safely escapes the code — malicious quotes in the code cannot break out of the string literal', () => {
        // JSON.stringify() escapes quotes and backslashes. buildFillScript should
        // produce a valid JS expression regardless of the input code. We drive
        // an extreme code containing quotes/backslashes and confirm:
        //   1. The script parses/runs (no syntax error).
        //   2. The input receives the code verbatim (proof of proper escaping).
        const evil = `6"); alert(1); //`;
        const input = makeInput({ name: 'otp' });
        const sandbox = makeSandbox([input]);
        const script = buildFillScript({ code: evil });

        // The script should be a syntactically valid expression.
        expect(() => new Function(`return ${script};`)).not.toThrow();

        const result = runScript(script, sandbox) as { filled: boolean };
        expect(result.filled).toBe(true);
        expect(input.value).toBe(evil);
    });
});
