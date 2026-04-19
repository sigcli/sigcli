/**
 * Shared YAML document helpers for reading/writing ~/.sig/config.yaml.
 * Used by sync/remote-config.ts and watch/watch-config.ts.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { getConfigPath } from './loader.js';

/**
 * Load the raw YAML content from disk.
 * Returns empty string if the file doesn't exist.
 */
export async function loadRawContent(): Promise<string> {
    const configPath = getConfigPath();
    try {
        return await fs.readFile(configPath, 'utf-8');
    } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return '';
        throw e;
    }
}

/**
 * Load a YAML Document (preserves comments and formatting).
 */
export async function loadDocument(): Promise<YAML.Document> {
    const content = await loadRawContent();
    if (!content) return new YAML.Document({});
    return YAML.parseDocument(content);
}

/**
 * Save the YAML Document back to disk, preserving comments.
 */
export async function saveDocument(doc: YAML.Document): Promise<void> {
    const configPath = getConfigPath();
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, doc.toString(), 'utf-8');
}
