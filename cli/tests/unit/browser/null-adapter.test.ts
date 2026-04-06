import { describe, it, expect } from 'vitest';
import { NullBrowserAdapter } from '../../../src/browser/adapters/null.adapter.js';
import { BrowserUnavailableError } from '../../../src/core/errors.js';

describe('NullBrowserAdapter', () => {
  const reason = 'No browser detected on this machine';

  it('name property returns "null"', () => {
    const adapter = new NullBrowserAdapter(reason);
    expect(adapter.name).toBe('null');
  });

  it('launch() throws BrowserUnavailableError', async () => {
    const adapter = new NullBrowserAdapter(reason);

    await expect(adapter.launch({ headless: true })).rejects.toThrow(BrowserUnavailableError);
  });

  it('thrown error has code BROWSER_UNAVAILABLE', async () => {
    const adapter = new NullBrowserAdapter(reason);

    try {
      await adapter.launch({});
      expect.fail('Expected launch() to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BrowserUnavailableError);
      expect((e as BrowserUnavailableError).code).toBe('BROWSER_UNAVAILABLE');
    }
  });

  it('error message contains the reason string', async () => {
    const customReason = 'playwright-core is not installed';
    const adapter = new NullBrowserAdapter(customReason);

    try {
      await adapter.launch({});
      expect.fail('Expected launch() to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BrowserUnavailableError);
      expect((e as BrowserUnavailableError).message).toContain(customReason);
    }
  });

  it('error message includes guidance about alternatives', async () => {
    const adapter = new NullBrowserAdapter(reason);

    try {
      await adapter.launch({});
      expect.fail('Expected launch() to throw');
    } catch (e) {
      expect((e as BrowserUnavailableError).message).toContain('sig login --token');
      expect((e as BrowserUnavailableError).message).toContain('sig sync pull');
    }
  });
});
