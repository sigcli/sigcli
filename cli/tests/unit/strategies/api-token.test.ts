import { describe, it, expect } from 'vitest';
import { ApiTokenStrategyFactory } from '../../../src/strategies/api-token.strategy.js';
import type { ApiKeyCredential, ProviderConfig } from '../../../src/core/types.js';
import { isOk, isErr } from '../../../src/core/result.js';

describe('ApiTokenStrategy', () => {
  const factory = new ApiTokenStrategyFactory();

  it('factory name is "api-token"', () => {
    expect(factory.name).toBe('api-token');
  });

  const strategy = factory.create({
    strategy: 'api-token',
    headerName: 'X-API-Key',
    headerPrefix: '',
    setupInstructions: 'Get a key from the dashboard.',
  });

  const validCred: ApiKeyCredential = {
    type: 'api-key',
    key: 'my-secret-key',
    headerName: 'X-API-Key',
    headerPrefix: '',
  };

  describe('validate', () => {
    it('returns true for valid credential', () => {
      const result = strategy.validate(validCred, { strategy: 'api-token' });
      expect(isOk(result) && result.value).toBe(true);
    });

    it('returns false for empty key', () => {
      const result = strategy.validate({ ...validCred, key: '' }, { strategy: 'api-token' });
      expect(isOk(result) && result.value).toBe(false);
    });

    it('returns false for wrong credential type', () => {
      const basicCred = { type: 'basic' as const, username: 'u', password: 'p' };
      const result = strategy.validate(basicCred, { strategy: 'api-token' });
      expect(isOk(result) && result.value).toBe(false);
    });

    it('detects expired JWT', () => {
      // Create a JWT with exp in the past
      const payload = { exp: Math.floor(Date.now() / 1000) - 3600 };
      const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const jwt = `${header}.${body}.sig`;

      const result = strategy.validate({ ...validCred, key: jwt }, { strategy: 'api-token' });
      expect(isOk(result) && result.value).toBe(false);
    });
  });

  describe('authenticate', () => {
    it('returns ManualSetupRequired error', async () => {
      const provider: ProviderConfig = {
        id: 'test',
        name: 'Test',
        domains: ['test.com'],
        strategy: 'api-token',
        strategyConfig: { strategy: 'api-token' },
      };
      const result = await strategy.authenticate(provider, {});
      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error.code).toBe('MANUAL_SETUP_REQUIRED');
      }
    });
  });

  describe('refresh', () => {
    it('returns null (not supported)', async () => {
      const result = await strategy.refresh(validCred, { strategy: 'api-token' });
      expect(isOk(result) && result.value).toBeNull();
    });
  });

  describe('applyToRequest', () => {
    it('applies header without prefix when prefix is empty', () => {
      const headers = strategy.applyToRequest(validCred);
      expect(headers).toEqual({ 'X-API-Key': 'my-secret-key' });
    });

    it('applies header with prefix', () => {
      const strategyWithPrefix = factory.create({
        strategy: 'api-token',
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
      });
      const cred: ApiKeyCredential = {
        ...validCred,
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
      };
      const headers = strategyWithPrefix.applyToRequest(cred);
      expect(headers).toEqual({ Authorization: 'Bearer my-secret-key' });
    });
  });
});
