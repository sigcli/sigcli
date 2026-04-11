import { describe, it, expect, vi } from 'vitest';
import { extractLocalStorage } from '../../../src/browser/flows/localstorage-capture.js';
import type { IBrowserPage } from '../../../src/core/interfaces/browser-adapter.js';
import type { LocalStorageConfig } from '../../../src/core/types.js';

/**
 * Create a minimal mock IBrowserPage with a controllable evaluateWithArg.
 */
function createMockPage(returnValues: Array<string | null>): IBrowserPage {
    return {
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
        evaluateWithArg: vi.fn(async () => returnValues),

        // Debug stubs
        screenshot: vi.fn(),
        content: vi.fn(),
        title: vi.fn(),

        // Lifecycle stubs
        close: vi.fn(),
        isClosed: vi.fn(() => false),
        onClose: vi.fn(),
    };
}

describe('extractLocalStorage', () => {
    it('extracts raw string from localStorage', async () => {
        const page = createMockPage(['xoxc-token-value']);
        const configs: LocalStorageConfig[] = [{ name: 'xoxc', key: 'localConfig_v2' }];

        const result = await extractLocalStorage(page, configs);

        expect(result).toEqual({ xoxc: 'xoxc-token-value' });
        expect(page.evaluateWithArg).toHaveBeenCalledOnce();
    });

    it('extracts nested JSON value via jsonPath', async () => {
        const jsonValue = JSON.stringify({
            teams: {
                T12345: {
                    token: 'xoxc-nested-token',
                },
            },
        });
        const page = createMockPage([jsonValue]);
        const configs: LocalStorageConfig[] = [
            { name: 'token', key: 'slackData', jsonPath: 'teams.T12345.token' },
        ];

        const result = await extractLocalStorage(page, configs);

        expect(result).toEqual({ token: 'xoxc-nested-token' });
    });

    it('skips missing keys (null returned)', async () => {
        const page = createMockPage([null]);
        const configs: LocalStorageConfig[] = [{ name: 'missing', key: 'nonexistent-key' }];

        const result = await extractLocalStorage(page, configs);

        expect(result).toEqual({});
    });

    it('skips invalid JSON when jsonPath is set', async () => {
        const page = createMockPage(['not-valid-json']);
        const configs: LocalStorageConfig[] = [
            { name: 'broken', key: 'bad-json', jsonPath: 'some.path' },
        ];

        const result = await extractLocalStorage(page, configs);

        expect(result).toEqual({});
    });

    it('handles multiple configs', async () => {
        const page = createMockPage(['value-a', 'value-b', null]);
        const configs: LocalStorageConfig[] = [
            { name: 'a', key: 'key-a' },
            { name: 'b', key: 'key-b' },
            { name: 'c', key: 'key-c' },
        ];

        const result = await extractLocalStorage(page, configs);

        expect(result).toEqual({ a: 'value-a', b: 'value-b' });
    });

    it('returns empty record when all keys are missing', async () => {
        const page = createMockPage([null, null, null]);
        const configs: LocalStorageConfig[] = [
            { name: 'a', key: 'key-a' },
            { name: 'b', key: 'key-b' },
            { name: 'c', key: 'key-c' },
        ];

        const result = await extractLocalStorage(page, configs);

        expect(result).toEqual({});
    });

    it('skips jsonPath when resolved value is not a string', async () => {
        const jsonValue = JSON.stringify({
            nested: { count: 42 },
        });
        const page = createMockPage([jsonValue]);
        const configs: LocalStorageConfig[] = [
            { name: 'count', key: 'data', jsonPath: 'nested.count' },
        ];

        const result = await extractLocalStorage(page, configs);

        // 42 is a number, not a string — should be skipped
        expect(result).toEqual({});
    });

    it('handles jsonPath with missing intermediate segment', async () => {
        const jsonValue = JSON.stringify({ top: {} });
        const page = createMockPage([jsonValue]);
        const configs: LocalStorageConfig[] = [
            { name: 'deep', key: 'data', jsonPath: 'top.middle.bottom' },
        ];

        const result = await extractLocalStorage(page, configs);

        expect(result).toEqual({});
    });

    it('passes correct keys to evaluateWithArg', async () => {
        const page = createMockPage(['v1', 'v2']);
        const configs: LocalStorageConfig[] = [
            { name: 'first', key: 'localStorage-key-1' },
            { name: 'second', key: 'localStorage-key-2' },
        ];

        await extractLocalStorage(page, configs);

        // Verify the keys array passed to evaluateWithArg
        expect(page.evaluateWithArg).toHaveBeenCalledWith(expect.any(Function), [
            'localStorage-key-1',
            'localStorage-key-2',
        ]);
    });

    // ---- Additional edge cases ----

    it('returns empty record for empty configs array', async () => {
        const page = createMockPage([]);
        const configs: LocalStorageConfig[] = [];

        const result = await extractLocalStorage(page, configs);

        expect(result).toEqual({});
        expect(page.evaluateWithArg).toHaveBeenCalledWith(expect.any(Function), []);
    });

    it('extracts deeply nested jsonPath (4+ levels)', async () => {
        const jsonValue = JSON.stringify({
            level1: {
                level2: {
                    level3: {
                        level4: {
                            token: 'deep-value',
                        },
                    },
                },
            },
        });
        const page = createMockPage([jsonValue]);
        const configs: LocalStorageConfig[] = [
            { name: 'deep', key: 'data', jsonPath: 'level1.level2.level3.level4.token' },
        ];

        const result = await extractLocalStorage(page, configs);

        expect(result).toEqual({ deep: 'deep-value' });
    });

    it('handles array access via numeric index in jsonPath', async () => {
        const jsonValue = JSON.stringify({
            items: ['first', 'second', 'third'],
        });
        const page = createMockPage([jsonValue]);
        const configs: LocalStorageConfig[] = [{ name: 'item', key: 'data', jsonPath: 'items.1' }];

        const result = await extractLocalStorage(page, configs);

        expect(result).toEqual({ item: 'second' });
    });

    it('handles empty string as localStorage value (no jsonPath)', async () => {
        const page = createMockPage(['']);
        const configs: LocalStorageConfig[] = [{ name: 'empty', key: 'empty-key' }];

        const result = await extractLocalStorage(page, configs);

        // Empty string is a valid non-null string value
        expect(result).toEqual({ empty: '' });
    });

    it('handles keys with special characters', async () => {
        const page = createMockPage(['special-value']);
        const configs: LocalStorageConfig[] = [{ name: 'special', key: 'my.dotted.key' }];

        const result = await extractLocalStorage(page, configs);

        expect(result).toEqual({ special: 'special-value' });
    });

    it('skips jsonPath traversal when value resolves to null', async () => {
        const jsonValue = JSON.stringify({
            nested: { value: null },
        });
        const page = createMockPage([jsonValue]);
        const configs: LocalStorageConfig[] = [
            { name: 'nullVal', key: 'data', jsonPath: 'nested.value' },
        ];

        const result = await extractLocalStorage(page, configs);

        // null is not a string, so it should be skipped
        expect(result).toEqual({});
    });

    it('skips jsonPath when resolved value is boolean', async () => {
        const jsonValue = JSON.stringify({
            flags: { active: true },
        });
        const page = createMockPage([jsonValue]);
        const configs: LocalStorageConfig[] = [
            { name: 'flag', key: 'data', jsonPath: 'flags.active' },
        ];

        const result = await extractLocalStorage(page, configs);

        expect(result).toEqual({});
    });

    it('skips jsonPath when resolved value is an object', async () => {
        const jsonValue = JSON.stringify({
            nested: { obj: { a: 1 } },
        });
        const page = createMockPage([jsonValue]);
        const configs: LocalStorageConfig[] = [
            { name: 'obj', key: 'data', jsonPath: 'nested.obj' },
        ];

        const result = await extractLocalStorage(page, configs);

        // Objects are not strings, should be skipped
        expect(result).toEqual({});
    });

    it('handles jsonPath with single segment (top-level key)', async () => {
        const jsonValue = JSON.stringify({
            token: 'top-level-token',
        });
        const page = createMockPage([jsonValue]);
        const configs: LocalStorageConfig[] = [{ name: 'tok', key: 'data', jsonPath: 'token' }];

        const result = await extractLocalStorage(page, configs);

        expect(result).toEqual({ tok: 'top-level-token' });
    });

    it('handles JSON array as top-level localStorage value', async () => {
        const jsonValue = JSON.stringify(['zero', 'one', 'two']);
        const page = createMockPage([jsonValue]);
        const configs: LocalStorageConfig[] = [{ name: 'second', key: 'data', jsonPath: '1' }];

        const result = await extractLocalStorage(page, configs);

        expect(result).toEqual({ second: 'one' });
    });
});
