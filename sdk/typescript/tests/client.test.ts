import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SignetClient } from '../src/client.js';
import { CredentialNotFoundError } from '../src/errors.js';

const FIXTURES_DIR = path.join(import.meta.dirname, 'fixtures');

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'signet-client-test-'));
  // Copy all fixtures
  const files = await fs.readdir(FIXTURES_DIR);
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const content = await fs.readFile(path.join(FIXTURES_DIR, file), 'utf-8');
    const data = JSON.parse(content);
    // Name the file after the providerId
    await fs.writeFile(path.join(tmpDir, `${data.providerId}.json`), content);
  }
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('SignetClient', () => {
  it('getHeaders returns correct headers for cookie provider', async () => {
    const client = new SignetClient({ credentialsDir: tmpDir });
    const headers = await client.getHeaders('my-jira');
    expect(headers['Cookie']).toBe('sid=abc123; csrf=xyz789');
    client.close();
  });

  it('getHeaders returns correct headers for bearer provider', async () => {
    const client = new SignetClient({ credentialsDir: tmpDir });
    const headers = await client.getHeaders('azure-graph');
    expect(headers['Authorization']).toContain('Bearer eyJ');
    client.close();
  });

  it('getHeaders returns correct headers for api-key provider', async () => {
    const client = new SignetClient({ credentialsDir: tmpDir });
    const headers = await client.getHeaders('github');
    expect(headers['Authorization']).toBe('Bearer ghp_test123456');
    client.close();
  });

  it('getHeaders returns correct headers for basic provider', async () => {
    const client = new SignetClient({ credentialsDir: tmpDir });
    const headers = await client.getHeaders('legacy-api');
    const expected = Buffer.from('admin:s3cret').toString('base64');
    expect(headers['Authorization']).toBe(`Basic ${expected}`);
    client.close();
  });

  it('getHeaders throws CredentialNotFoundError for missing provider', async () => {
    const client = new SignetClient({ credentialsDir: tmpDir });
    await expect(client.getHeaders('nonexistent')).rejects.toThrow(CredentialNotFoundError);
    client.close();
  });

  it('getCredential returns credential object', async () => {
    const client = new SignetClient({ credentialsDir: tmpDir });
    const cred = await client.getCredential('my-jira');
    expect(cred).not.toBeNull();
    expect(cred!.type).toBe('cookie');
    client.close();
  });

  it('getCredential returns null for missing provider', async () => {
    const client = new SignetClient({ credentialsDir: tmpDir });
    const cred = await client.getCredential('nonexistent');
    expect(cred).toBeNull();
    client.close();
  });

  it('getLocalStorage returns localStorage values', async () => {
    const client = new SignetClient({ credentialsDir: tmpDir });
    const ls = await client.getLocalStorage('slack');
    expect(ls).toEqual({ token: 'xoxc-123-456' });
    client.close();
  });

  it('getLocalStorage returns empty object for missing provider', async () => {
    const client = new SignetClient({ credentialsDir: tmpDir });
    const ls = await client.getLocalStorage('nonexistent');
    expect(ls).toEqual({});
    client.close();
  });

  it('listProviders returns all providers', async () => {
    const client = new SignetClient({ credentialsDir: tmpDir });
    const providers = await client.listProviders();
    expect(providers.length).toBeGreaterThanOrEqual(4);
    const ids = providers.map(p => p.providerId).sort();
    expect(ids).toContain('my-jira');
    expect(ids).toContain('azure-graph');
    expect(ids).toContain('github');
    expect(ids).toContain('legacy-api');
    client.close();
  });

  it('close() is safe to call multiple times', () => {
    const client = new SignetClient({ credentialsDir: tmpDir });
    client.close();
    client.close();
    client.close();
    // Should not throw
  });

  it('close() after watch() is safe', () => {
    const client = new SignetClient({ credentialsDir: tmpDir });
    client.watch();
    client.close();
    client.close();
    // Should not throw
  });

  it('watch() is idempotent', () => {
    const client = new SignetClient({ credentialsDir: tmpDir });
    client.watch();
    client.watch(); // Should not create a second watcher
    client.close();
  });

  it('getHeaders includes xHeaders for cookie provider', async () => {
    const client = new SignetClient({ credentialsDir: tmpDir });
    const headers = await client.getHeaders('xiaohongshu');
    expect(headers['Cookie']).toBe('id_token=tok123');
    expect(headers['x-csrf-token']).toBe('csrf-abc');
    expect(headers['origin']).toBe('https://www.xiaohongshu.com');
    client.close();
  });

  it('getLocalStorage returns empty object for provider without localStorage', async () => {
    const client = new SignetClient({ credentialsDir: tmpDir });
    const ls = await client.getLocalStorage('my-jira');
    expect(ls).toEqual({});
    client.close();
  });

  it('getCredential returns correctly typed credential', async () => {
    const client = new SignetClient({ credentialsDir: tmpDir });

    const cookie = await client.getCredential('my-jira');
    expect(cookie).not.toBeNull();
    expect(cookie!.type).toBe('cookie');

    const bearer = await client.getCredential('azure-graph');
    expect(bearer).not.toBeNull();
    expect(bearer!.type).toBe('bearer');

    const apiKey = await client.getCredential('github');
    expect(apiKey).not.toBeNull();
    expect(apiKey!.type).toBe('api-key');

    const basic = await client.getCredential('legacy-api');
    expect(basic).not.toBeNull();
    expect(basic!.type).toBe('basic');

    client.close();
  });
});
