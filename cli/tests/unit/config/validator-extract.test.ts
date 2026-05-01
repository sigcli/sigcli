import { describe, expect, it } from 'vitest';

import { validateConfig } from '../../../src/config/validator.js';
import { isErr, isOk } from '../../../src/types/index.js';

/**
 * Minimal valid base config used to isolate provider/extract rule validation.
 */
const BASE_CONFIG = {
    browser: { browserDataDir: '/tmp/.sig/browser', channel: 'chrome' },
    storage: { credentialsDir: '/tmp/.sig/credentials' },
};

function makeConfig(providers: Record<string, unknown>) {
    return { ...BASE_CONFIG, providers };
}

function makeProvider(extract: unknown[], apply?: unknown[]) {
    return {
        domains: ['example.com'],
        entryUrl: 'https://example.com/',
        strategy: 'browser',
        extract,
        apply: apply ?? [{ in: 'header', name: 'Cookie', value: '${session}' }],
    };
}

describe('validateConfig — extract rule field names', () => {
    describe('valid extract rules', () => {
        it('passes with valid as and match fields', () => {
            const config = makeConfig({
                myapp: makeProvider([{ from: 'cookies', as: 'session', match: '*' }]),
            });
            expect(isOk(validateConfig(config))).toBe(true);
        });

        it('passes with as, match, and optional jsonPath as string', () => {
            const config = makeConfig({
                myapp: makeProvider([
                    {
                        from: 'localStorage',
                        as: 'token',
                        match: 'localConfig_v2',
                        jsonPath: 'teams.E7RBBBXHB.token',
                    },
                ]),
            });
            expect(isOk(validateConfig(config))).toBe(true);
        });

        it('passes without jsonPath (field is optional)', () => {
            const config = makeConfig({
                myapp: makeProvider([{ from: 'cookies', as: 'session', match: 'session_id' }]),
            });
            expect(isOk(validateConfig(config))).toBe(true);
        });

        it('passes with multiple extract rules', () => {
            const config = makeConfig({
                myapp: makeProvider([
                    { from: 'cookies', as: 'session', match: '*' },
                    {
                        from: 'localStorage',
                        as: 'xoxc',
                        match: 'localConfig_v2',
                        jsonPath: 'token',
                    },
                ]),
            });
            expect(isOk(validateConfig(config))).toBe(true);
        });
    });

    describe('missing required fields', () => {
        it('fails when as is missing', () => {
            const config = makeConfig({
                myapp: makeProvider([{ from: 'cookies', match: '*' }]),
            });
            const result = validateConfig(config);
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message).toContain('extract[0].as is required');
            }
        });

        it('fails when as is empty string', () => {
            const config = makeConfig({
                myapp: makeProvider([{ from: 'cookies', as: '', match: '*' }]),
            });
            const result = validateConfig(config);
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message).toContain('extract[0].as is required');
            }
        });

        it('fails when match is missing', () => {
            const config = makeConfig({
                myapp: makeProvider([{ from: 'cookies', as: 'session' }]),
            });
            const result = validateConfig(config);
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message).toContain('extract[0].match is required');
            }
        });

        it('fails when match is empty string', () => {
            const config = makeConfig({
                myapp: makeProvider([{ from: 'cookies', as: 'session', match: '' }]),
            });
            const result = validateConfig(config);
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message).toContain('extract[0].match is required');
            }
        });

        it('fails when both as and match are missing', () => {
            const config = makeConfig({
                myapp: makeProvider([{ from: 'cookies' }]),
            });
            const result = validateConfig(config);
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message).toContain('extract[0].as is required');
                expect(result.error.message).toContain('extract[0].match is required');
            }
        });
    });

    describe('jsonPath field validation', () => {
        it('passes when jsonPath is a non-empty string', () => {
            const config = makeConfig({
                myapp: makeProvider([
                    { from: 'localStorage', as: 'token', match: 'config', jsonPath: 'auth.token' },
                ]),
            });
            expect(isOk(validateConfig(config))).toBe(true);
        });

        it('fails when jsonPath is a number (not string)', () => {
            const config = makeConfig({
                myapp: makeProvider([
                    { from: 'localStorage', as: 'token', match: 'config', jsonPath: 42 },
                ]),
            });
            const result = validateConfig(config);
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message).toContain('extract[0].jsonPath must be a string');
            }
        });

        it('fails when jsonPath is an array (not string)', () => {
            const config = makeConfig({
                myapp: makeProvider([
                    {
                        from: 'localStorage',
                        as: 'token',
                        match: 'config',
                        jsonPath: ['auth', 'token'],
                    },
                ]),
            });
            const result = validateConfig(config);
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message).toContain('extract[0].jsonPath must be a string');
            }
        });

        it('fails when jsonPath is an object (not string)', () => {
            const config = makeConfig({
                myapp: makeProvider([
                    {
                        from: 'localStorage',
                        as: 'token',
                        match: 'config',
                        jsonPath: { path: 'auth' },
                    },
                ]),
            });
            const result = validateConfig(config);
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message).toContain('extract[0].jsonPath must be a string');
            }
        });
    });

    describe('valid from values', () => {
        it.each(['cookies', 'localStorage', 'eval', 'prompt'])('passes with from: %s', (from) => {
            const config = makeConfig({
                myapp: makeProvider([{ from, as: 'session', match: '*' }]),
            });
            expect(isOk(validateConfig(config))).toBe(true);
        });
    });

    describe('error message references provider id', () => {
        it('includes the provider id in the error message', () => {
            const config = makeConfig({
                my_provider: makeProvider([{ from: 'cookies', match: '*' }]),
            });
            const result = validateConfig(config);
            expect(isErr(result)).toBe(true);
            if (isErr(result)) {
                expect(result.error.message).toContain('"my_provider"');
            }
        });
    });
});
