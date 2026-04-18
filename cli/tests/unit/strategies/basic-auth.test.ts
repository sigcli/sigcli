import { describe, it, expect } from 'vitest';
import { BasicAuthStrategyFactory } from '../../../src/strategies/basic-auth.strategy.js';
import type { BasicCredential } from '../../../src/core/types.js';
import { isOk } from '../../../src/core/result.js';

describe('BasicAuthStrategy', () => {
    const factory = new BasicAuthStrategyFactory();
    const strategy = factory.create({ strategy: 'basic' });

    const validCred: BasicCredential = {
        type: 'basic',
        username: 'admin',
        password: 'secret',
    };

    it('factory name is "basic"', () => {
        expect(factory.name).toBe('basic');
    });

    describe('validate', () => {
        it('returns true for valid credentials', () => {
            const result = strategy.validate(validCred, { strategy: 'basic' });
            expect(isOk(result) && result.value).toBe(true);
        });

        it('returns false for empty username', () => {
            const result = strategy.validate({ ...validCred, username: '' }, { strategy: 'basic' });
            expect(isOk(result) && result.value).toBe(false);
        });

        it('returns false for empty password', () => {
            const result = strategy.validate({ ...validCred, password: '' }, { strategy: 'basic' });
            expect(isOk(result) && result.value).toBe(false);
        });
    });

    describe('applyToRequest', () => {
        it('produces correct Basic auth header', () => {
            const headers = strategy.applyToRequest(validCred);
            const expected = Buffer.from('admin:secret').toString('base64');
            expect(headers).toEqual({ Authorization: `Basic ${expected}` });
        });
    });

    describe('refresh', () => {
        it('returns null (not supported)', async () => {
            const result = await strategy.refresh(validCred, { strategy: 'basic' });
            expect(isOk(result) && result.value).toBeNull();
        });
    });
});
