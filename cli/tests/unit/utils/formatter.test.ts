import { describe, it, expect, vi, afterEach } from 'vitest';
import { detectFormat, formatOutput, type FormatType } from '../../../src/utils/formatter.js';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('detectFormat', () => {
    it('returns flag value when provided', () => {
        expect(detectFormat('yaml')).toBe('yaml');
        expect(detectFormat('env')).toBe('env');
        expect(detectFormat('json')).toBe('json');
    });

    it('returns defaultFormat when no flag and stdout is TTY', () => {
        Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
        expect(detectFormat(undefined, 'table')).toBe('table');
        expect(detectFormat(undefined, 'plain')).toBe('plain');
    });

    it('auto-downgrades to json when stdout is not TTY', () => {
        Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
        expect(detectFormat(undefined, 'table')).toBe('json');
        expect(detectFormat(undefined, 'plain')).toBe('json');
    });

    it('flag value overrides TTY detection', () => {
        Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
        expect(detectFormat('yaml')).toBe('yaml');
    });
});

describe('formatOutput', () => {
    const singleItem = { id: 'my-app', name: 'My App', valid: true };
    const arrayItems = [
        { id: 'app1', name: 'App 1', valid: true },
        { id: 'app2', name: 'App 2', valid: false },
    ];

    describe('json format', () => {
        it('serializes single object', () => {
            const result = formatOutput(singleItem, 'json');
            expect(JSON.parse(result)).toEqual(singleItem);
        });

        it('serializes array', () => {
            const result = formatOutput(arrayItems, 'json');
            expect(JSON.parse(result)).toEqual(arrayItems);
        });
    });

    describe('yaml format', () => {
        it('serializes single object as key: value lines', () => {
            const result = formatOutput(singleItem, 'yaml');
            expect(result).toContain('id: my-app');
            expect(result).toContain('name: My App');
            expect(result).toContain('valid: true');
        });

        it('serializes array with list prefixes', () => {
            const result = formatOutput(arrayItems, 'yaml');
            expect(result).toContain('- ');
            expect(result).toContain('app1');
            expect(result).toContain('app2');
        });
    });

    describe('env format', () => {
        it('outputs KEY=value lines for single object', () => {
            const result = formatOutput(singleItem, 'env');
            expect(result).toContain('ID=my-app');
            expect(result).toContain('NAME=');
            expect(result).toContain('My App');
            expect(result).toContain('VALID=true');
        });

        it('outputs indexed keys for array', () => {
            const result = formatOutput(arrayItems, 'env');
            expect(result).toContain('ID_0=app1');
            expect(result).toContain('ID_1=app2');
        });
    });

    describe('table format', () => {
        it('outputs aligned columns with headers for array', () => {
            const result = formatOutput(arrayItems, 'table');
            expect(result).toContain('ID');
            expect(result).toContain('NAME');
            expect(result).toContain('app1');
            expect(result).toContain('app2');
        });

        it('outputs single row table for single object', () => {
            const result = formatOutput(singleItem, 'table');
            expect(result).toContain('ID');
            expect(result).toContain('my-app');
        });
    });

    describe('plain format', () => {
        it('outputs key: value lines for single object', () => {
            const result = formatOutput(singleItem, 'plain');
            expect(result).toContain('id: my-app');
            expect(result).toContain('name: My App');
            expect(result).toContain('valid: true');
        });

        it('separates array items with ---', () => {
            const result = formatOutput(arrayItems, 'plain');
            expect(result).toContain('---');
            expect(result).toContain('id: app1');
            expect(result).toContain('id: app2');
        });
    });

    describe('all formats produce non-empty output', () => {
        const formats: FormatType[] = ['json', 'yaml', 'env', 'table', 'plain'];
        for (const fmt of formats) {
            it(`${fmt} produces output`, () => {
                expect(formatOutput(singleItem, fmt).length).toBeGreaterThan(0);
            });
        }
    });
});
