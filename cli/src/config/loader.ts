/**
 * Config file loader for SigCLI.
 * Global config: ~/.sig/config.yaml (browser, storage, mode, providers)
 * Project config: .sig/config.yaml (providers only, discovered by walking up from CWD)
 */

import { existsSync, realpathSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import YAML from 'yaml';
import type { Result } from '../core/result.js';
import { ok, err, isOk, isErr } from '../core/result.js';
import { ConfigError, type AuthError } from '../core/errors.js';
import type { SigConfig, ProviderEntry, ProjectConfig } from './schema.js';
import type { ProviderSource } from '../core/types.js';
import { validateConfig, validateProjectConfig } from './validator.js';

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
    await fs.writeFile(CONFIG_PATH, YAML.stringify(filtered), 'utf-8');
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
    doc.setIn(['providers', id], doc.createNode(entry));
    await fs.writeFile(CONFIG_PATH, doc.toString(), 'utf-8');
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
 * Get the global config file path (for error messages).
 */
export function getConfigPath(): string {
    return CONFIG_PATH;
}

/**
 * Resolve a path to its canonical form (following symlinks).
 * Falls back to the original path if resolution fails (e.g., path doesn't exist).
 */
function safeRealpath(p: string): string {
    try {
        return realpathSync(p);
    } catch {
        return p;
    }
}

/**
 * Walk up from startDir looking for .sig/config.yaml.
 * Returns the path if found, null otherwise.
 * Skips the global ~/.sig directory (symlink-safe comparison).
 */
export function findProjectConfigPath(startDir?: string): string | null {
    let dir = startDir ?? process.cwd();
    const globalSigDir = safeRealpath(path.join(os.homedir(), '.sig'));
    while (true) {
        const sigDir = path.join(dir, '.sig');
        const candidate = path.join(sigDir, 'config.yaml');
        // Skip if this resolves to the global ~/.sig directory
        const isGlobal = safeRealpath(sigDir) === globalSigDir;
        if (!isGlobal && existsSync(candidate)) {
            return candidate;
        }
        const parent = path.dirname(dir);
        if (parent === dir) return null; // reached filesystem root
        dir = parent;
    }
}

/**
 * Get the path where a project config would be created (CWD/.sig/config.yaml).
 */
export function getProjectConfigPath(): string {
    return path.join(process.cwd(), '.sig', 'config.yaml');
}

/**
 * Load and validate a project-level config (providers only).
 */
export async function loadProjectConfig(
    configPath: string,
): Promise<Result<ProjectConfig, AuthError>> {
    let content: string;
    try {
        content = await fs.readFile(configPath, 'utf-8');
    } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
            return err(new ConfigError(`Project config not found: ${configPath}`));
        }
        return err(new ConfigError(`Failed to read project config: ${(e as Error).message}`));
    }

    let raw: unknown;
    try {
        raw = YAML.parse(content);
    } catch (e: unknown) {
        return err(new ConfigError(`Invalid YAML in ${configPath}: ${(e as Error).message}`));
    }

    if (!raw || typeof raw !== 'object') {
        return err(new ConfigError(`Project config ${configPath} is empty or not an object.`));
    }

    return validateProjectConfig(raw as Record<string, unknown>);
}

/**
 * Result of loading merged global + project config.
 */
export interface MergedConfigResult {
    config: SigConfig;
    providerSources: Record<string, ProviderSource>;
    projectConfigPath: string | null;
}

/**
 * Load global config and merge with project config if found.
 * Project providers override global providers with the same ID.
 */
export async function loadMergedConfig(): Promise<Result<MergedConfigResult, AuthError>> {
    // 1. Load global config (mandatory)
    const globalResult = await loadConfig();
    if (isErr(globalResult)) return globalResult;
    const config = globalResult.value;

    // 2. Track provider sources
    const providerSources: Record<string, ProviderSource> = {};
    for (const id of Object.keys(config.providers)) {
        providerSources[id] = 'user';
    }

    // 3. Discover and load project config
    const projectPath = findProjectConfigPath();
    if (projectPath) {
        const projectResult = await loadProjectConfig(projectPath);
        if (isOk(projectResult)) {
            // Merge: project providers override global
            for (const [id, entry] of Object.entries(projectResult.value.providers)) {
                config.providers[id] = entry;
                providerSources[id] = 'project';
            }
        } else {
            // Warn user their project config has issues — don't silently ignore
            process.stderr.write(
                `Warning: Project config at ${projectPath} has errors:\n` +
                    `  ${projectResult.error.message}\n` +
                    '  Continuing with global config only.\n',
            );
        }
    }

    return ok({ config, providerSources, projectConfigPath: projectPath });
}
