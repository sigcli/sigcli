/**
 * Remote configuration — reads/writes from the unified ~/.signet/config.yaml.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import YAML from 'yaml';
import type { RemoteConfig } from './types.js';

const CONFIG_PATH = path.join(os.homedir(), '.signet', 'config.yaml');

/**
 * Load the raw YAML content from disk.
 * Returns empty string if the file doesn't exist.
 */
async function loadRawContent(): Promise<string> {
  try {
    return await fs.readFile(CONFIG_PATH, 'utf-8');
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw e;
  }
}

/**
 * Load a YAML Document (preserves comments and formatting).
 */
async function loadDocument(): Promise<YAML.Document> {
  const content = await loadRawContent();
  if (!content) return new YAML.Document({});
  return YAML.parseDocument(content);
}

/**
 * Save the YAML Document back to disk, preserving comments.
 */
async function saveDocument(doc: YAML.Document): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, doc.toString(), 'utf-8');
}

export async function getRemotes(): Promise<RemoteConfig[]> {
  const doc = await loadDocument();
  const remotesNode = doc.getIn(['remotes']);
  if (!remotesNode) return [];
  const remotes = (YAML.isMap(remotesNode) ? remotesNode.toJSON() : remotesNode) as Record<string, Omit<RemoteConfig, 'name'>>;
  if (!remotes || typeof remotes !== 'object') return [];
  return Object.entries(remotes).map(([name, r]) => ({ name, ...r }));
}

export async function getRemote(name: string): Promise<RemoteConfig | null> {
  const remotes = await getRemotes();
  return remotes.find(r => r.name === name) ?? null;
}

export async function addRemote(remote: RemoteConfig): Promise<void> {
  const doc = await loadDocument();
  const { name, ...rest } = remote;

  if (!doc.getIn(['remotes'])) {
    doc.setIn(['remotes'], doc.createNode({}));
  }
  const remotesNode = doc.getIn(['remotes'], true);
  if (YAML.isMap(remotesNode)) {
    remotesNode.set(name, doc.createNode(rest));
  }

  await saveDocument(doc);
}

export async function removeRemote(name: string): Promise<boolean> {
  const doc = await loadDocument();
  const remotesNode = doc.getIn(['remotes']);
  if (!remotesNode) return false;

  if (!doc.getIn(['remotes', name])) return false;
  doc.deleteIn(['remotes', name]);

  await saveDocument(doc);
  return true;
}
