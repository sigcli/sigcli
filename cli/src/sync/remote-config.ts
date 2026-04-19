/**
 * Remote configuration — reads/writes from the unified ~/.sig/config.yaml.
 */

import YAML from 'yaml';
import type { RemoteConfig } from './types.js';
import { loadDocument, saveDocument } from '../config/document.js';

export async function getRemotes(): Promise<RemoteConfig[]> {
    const doc = await loadDocument();
    const remotesNode = doc.getIn(['remotes']);
    if (!remotesNode) return [];
    const remotes = (YAML.isMap(remotesNode) ? remotesNode.toJSON() : remotesNode) as Record<
        string,
        Omit<RemoteConfig, 'name'>
    >;
    if (!remotes || typeof remotes !== 'object') return [];
    return Object.entries(remotes).map(([name, r]) => ({ name, ...r }));
}

export async function getRemote(name: string): Promise<RemoteConfig | null> {
    const remotes = await getRemotes();
    return remotes.find((r) => r.name === name) ?? null;
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
