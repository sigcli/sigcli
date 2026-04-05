/**
 * Remote configuration — reads/writes from the unified ~/.signet/config.yaml.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import YAML from 'yaml';
import type { RemoteConfig } from './types.js';

const CONFIG_PATH = path.join(os.homedir(), '.signet', 'config.yaml');

interface ConfigFile {
  browser?: Record<string, unknown>;
  storage?: Record<string, unknown>;
  providers?: Record<string, unknown>;
  remotes?: Record<string, Omit<RemoteConfig, 'name'>>;
}

async function loadRawConfig(): Promise<ConfigFile> {
  try {
    const content = await fs.readFile(CONFIG_PATH, 'utf-8');
    return YAML.parse(content) ?? {};
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw e;
  }
}

async function saveRawConfig(config: ConfigFile): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, YAML.stringify(config), 'utf-8');
}

export async function getRemotes(): Promise<RemoteConfig[]> {
  const config = await loadRawConfig();
  if (!config.remotes) return [];
  return Object.entries(config.remotes).map(([name, r]) => ({ name, ...r }));
}

export async function getRemote(name: string): Promise<RemoteConfig | null> {
  const remotes = await getRemotes();
  return remotes.find(r => r.name === name) ?? null;
}

export async function addRemote(remote: RemoteConfig): Promise<void> {
  const config = await loadRawConfig();
  if (!config.remotes) config.remotes = {};
  const { name, ...rest } = remote;
  config.remotes[name] = rest;
  await saveRawConfig(config);
}

export async function removeRemote(name: string): Promise<boolean> {
  const config = await loadRawConfig();
  if (!config.remotes || !config.remotes[name]) return false;
  delete config.remotes[name];
  await saveRawConfig(config);
  return true;
}
