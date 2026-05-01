/**
 * Single config file loader for SigCLI.
 * Reads ONLY ~/.sig/config.yaml — no cascade, no env vars.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import YAML, { isCollection } from 'yaml';

import { ConfigError, err, type AuthError, type Result } from '../types/index.js';
import type { ProviderEntry, SigConfig } from './schema.js';
import { validateConfig } from './validator.js';

const CONFIG_PATH = path.join(os.homedir(), '.sig', 'config.yaml');

/**
 * Load and validate the unified config from ~/.sig/config.yaml.
 * Returns Result<SigConfig, AuthError>.
 */
export async function loadConfig(): Promise<Result<SigConfig, AuthError>> {
    let content: string;
    try {
        content = await fs.readFile(CONFIG_PATH, 'utf-8');
    } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
            return err(
                new ConfigError(
                    `Config file not found: ${CONFIG_PATH}. ` +
                        'Create it with browser.browserDataDir, storage.credentialsDir, and providers sections.',
                ),
            );
        }
        return err(
            new ConfigError(`Failed to read config from ${CONFIG_PATH}: ${(e as Error).message}`),
        );
    }

    let raw: unknown;
    try {
        raw = YAML.parse(content);
    } catch (e: unknown) {
        return err(new ConfigError(`Invalid YAML in ${CONFIG_PATH}: ${(e as Error).message}`));
    }

    if (!raw || typeof raw !== 'object') {
        return err(new ConfigError(`Config file ${CONFIG_PATH} is empty or not an object.`));
    }

    return validateConfig(raw as Record<string, unknown>);
}

/**
 * Save the full config back to ~/.sig/config.yaml.
 * Used by remote add/remove commands to persist changes.
 * Auto-provisioned providers are filtered out — they should not be persisted.
 */
export async function saveConfig(config: SigConfig): Promise<void> {
    const filtered = {
        ...config,
        providers: Object.fromEntries(
            Object.entries(config.providers).filter(
                ([, p]) => !(p as unknown as { autoProvisioned?: boolean }).autoProvisioned,
            ),
        ),
    };
    await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
    await fs.writeFile(
        CONFIG_PATH,
        YAML.stringify(filtered, { collectionStyle: 'block' }),
        'utf-8',
    );
}

/**
 * Add a provider entry to config.yaml, preserving comments and formatting.
 * Used to persist auto-provisioned providers after successful login.
 */
export async function addProviderToConfig(id: string, entry: ProviderEntry): Promise<void> {
    let content: string;
    try {
        content = await fs.readFile(CONFIG_PATH, 'utf-8');
    } catch {
        return; // No config file — nothing to update
    }
    const doc = YAML.parseDocument(content);
    if (!doc.getIn(['providers'])) {
        doc.setIn(['providers'], doc.createNode({}));
    }
    const providersNode = doc.getIn(['providers'], true);
    if (isCollection(providersNode)) providersNode.flow = false;
    const providerNode = doc.createNode(entry);
    setBlockStyle(providerNode);
    doc.setIn(['providers', id], providerNode);
    await fs.writeFile(CONFIG_PATH, doc.toString(), 'utf-8');
}

function setBlockStyle(node: unknown): void {
    if (isCollection(node)) {
        node.flow = false;
        for (const item of node.items) {
            if (typeof item === 'object' && item !== null) {
                if ('value' in item) setBlockStyle(item.value);
                if ('key' in item) setBlockStyle(item.key);
                setBlockStyle(item);
            }
        }
    }
}

/**
 * Rename a provider in config.yaml, preserving comments and formatting.
 * Copies the entry under the new key and deletes the old key.
 */
export async function renameProviderInConfig(oldId: string, newId: string): Promise<void> {
    let content: string;
    try {
        content = await fs.readFile(CONFIG_PATH, 'utf-8');
    } catch {
        return; // No config file — nothing to update
    }
    const doc = YAML.parseDocument(content);
    const entry = doc.getIn(['providers', oldId]);
    if (entry === undefined) return;

    doc.setIn(['providers', newId], entry);
    doc.deleteIn(['providers', oldId]);
    await fs.writeFile(CONFIG_PATH, doc.toString(), 'utf-8');
}

/**
 * Remove a provider from config.yaml, preserving comments and formatting.
 */
export async function removeProviderFromConfig(id: string): Promise<void> {
    let content: string;
    try {
        content = await fs.readFile(CONFIG_PATH, 'utf-8');
    } catch {
        return;
    }
    const doc = YAML.parseDocument(content);
    doc.deleteIn(['providers', id]);
    await fs.writeFile(CONFIG_PATH, doc.toString(), 'utf-8');
}

/**
 * Get the config file path (for error messages).
 */
export function getConfigPath(): string {
    return CONFIG_PATH;
}
