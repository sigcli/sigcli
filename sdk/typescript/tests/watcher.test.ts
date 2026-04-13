import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { CredentialWatcher } from '../src/watcher.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'signet-watcher-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function waitForEvent(watcher: CredentialWatcher, event: string, timeout = 2000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);
    watcher.once(event, (value: string) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

describe('CredentialWatcher', () => {
  it('emits change when a JSON file is written', async () => {
    const watcher = new CredentialWatcher(tmpDir);
    watcher.start();

    const changePromise = waitForEvent(watcher, 'change');
    await fs.writeFile(path.join(tmpDir, 'test-provider.json'), '{}');
    const providerId = await changePromise;
    expect(providerId).toBe('test-provider');

    watcher.stop();
  });

  it('debounces rapid changes', async () => {
    const watcher = new CredentialWatcher(tmpDir);
    const changes: string[] = [];
    watcher.on('change', (id: string) => changes.push(id));
    watcher.start();

    // Write multiple times rapidly
    for (let i = 0; i < 5; i++) {
      await fs.writeFile(path.join(tmpDir, 'rapid.json'), `{"v":${i}}`);
    }

    // Wait for debounce to settle
    await new Promise(resolve => setTimeout(resolve, 300));

    // Should have fewer events than writes due to debouncing
    expect(changes.length).toBeLessThanOrEqual(2);
    expect(changes).toContain('rapid');

    watcher.stop();
  });

  it('ignores .lock files', async () => {
    const watcher = new CredentialWatcher(tmpDir);
    const changes: string[] = [];
    watcher.on('change', (id: string) => changes.push(id));
    watcher.start();

    await fs.writeFile(path.join(tmpDir, 'test.json.lock'), '{}');
    await new Promise(resolve => setTimeout(resolve, 300));

    expect(changes).toEqual([]);
    watcher.stop();
  });

  it('ignores non-JSON files', async () => {
    const watcher = new CredentialWatcher(tmpDir);
    const changes: string[] = [];
    watcher.on('change', (id: string) => changes.push(id));
    watcher.start();

    await fs.writeFile(path.join(tmpDir, 'readme.txt'), 'hello');
    await new Promise(resolve => setTimeout(resolve, 300));

    expect(changes).toEqual([]);
    watcher.stop();
  });

  it('stop() cleans up properly', async () => {
    const watcher = new CredentialWatcher(tmpDir);
    watcher.start();
    watcher.stop();

    // Should be safe to stop multiple times
    watcher.stop();
    watcher.stop();
  });

  it('start() is idempotent', () => {
    const watcher = new CredentialWatcher(tmpDir);
    watcher.start();
    watcher.start(); // Should not throw or create duplicate watchers
    watcher.stop();
  });
});
