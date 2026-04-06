/**
 * Single config file loader for signet.
 * Reads ONLY ~/.signet/config.yaml — no cascade, no env vars.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import YAML from 'yaml';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import { ConfigError, type AuthError } from '../core/errors.js';
import type { SignetConfig } from './schema.js';
import { validateConfig } from './validator.js';

const CONFIG_PATH = path.join(os.homedir(), '.signet', 'config.yaml');

/**
 * Load and validate the unified config from ~/.signet/config.yaml.
 * Returns Result<SignetConfig, AuthError>.
 */
export async function loadConfig(): Promise<Result<SignetConfig, AuthError>> {
  let content: string;
  try {
    content = await fs.readFile(CONFIG_PATH, 'utf-8');
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return err(new ConfigError(
        `Config file not found: ${CONFIG_PATH}. ` +
        'Create it with browser.browserDataDir, storage.credentialsDir, and providers sections.',
      ));
    }
    return err(new ConfigError(
      `Failed to read config from ${CONFIG_PATH}: ${(e as Error).message}`,
    ));
  }

  let raw: unknown;
  try {
    raw = YAML.parse(content);
  } catch (e: unknown) {
    return err(new ConfigError(
      `Invalid YAML in ${CONFIG_PATH}: ${(e as Error).message}`,
    ));
  }

  if (!raw || typeof raw !== 'object') {
    return err(new ConfigError(
      `Config file ${CONFIG_PATH} is empty or not an object.`,
    ));
  }

  return validateConfig(raw as Record<string, unknown>);
}

/**
 * Save the full config back to ~/.signet/config.yaml.
 * Used by remote add/remove commands to persist changes.
 * Auto-provisioned providers are filtered out — they should not be persisted.
 */
export async function saveConfig(config: SignetConfig): Promise<void> {
  const filtered = {
    ...config,
    providers: Object.fromEntries(
      Object.entries(config.providers).filter(
        ([, p]) => !(p as unknown as { autoProvisioned?: boolean }).autoProvisioned,
      ),
    ),
  };
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, YAML.stringify(filtered), 'utf-8');
}

/**
 * Get the config file path (for error messages).
 */
export function getConfigPath(): string {
  return CONFIG_PATH;
}
