/**
 * Read/write the `idps:` section of ~/.sig/config.yaml, preserving comments.
 * Only metadata lives here — secrets are handled by IdpStore.
 */

import YAML from 'yaml';

import { loadDocument, saveDocument } from '../config/document.js';
import type { IdpMetaEntry } from './types.js';

/**
 * Get all IdP metadata entries, keyed by hostname.
 */
export async function getIdpMetaEntries(): Promise<Record<string, IdpMetaEntry>> {
    const doc = await loadDocument();
    const node = doc.getIn(['idps']);
    if (!node) return {};
    const raw = (YAML.isMap(node) ? node.toJSON() : node) as Record<string, IdpMetaEntry> | null;
    if (!raw || typeof raw !== 'object') return {};
    return raw;
}

/**
 * Add or update the metadata for a single hostname. Comment-preserving.
 */
export async function setIdpMetaEntry(hostname: string, entry: IdpMetaEntry): Promise<void> {
    const doc = await loadDocument();
    if (!doc.getIn(['idps'])) {
        doc.setIn(['idps'], doc.createNode({}));
    }
    const idpsNode = doc.getIn(['idps'], true);
    if (YAML.isMap(idpsNode)) {
        idpsNode.set(hostname, doc.createNode(entry));
    }
    await saveDocument(doc);
}

/**
 * Remove a single hostname's metadata. Returns true if present.
 */
export async function removeIdpMetaEntry(hostname: string): Promise<boolean> {
    const doc = await loadDocument();
    if (!doc.getIn(['idps', hostname])) return false;
    doc.deleteIn(['idps', hostname]);
    await saveDocument(doc);
    return true;
}
