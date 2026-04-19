/**
 * Watch configuration — reads/writes from the unified ~/.sig/config.yaml.
 */

import YAML from 'yaml';
import { loadDocument, saveDocument } from '../config/document.js';

export interface WatchProviderOpts {
    autoSync: string[]; // empty array = no sync
}

export interface WatchConfig {
    interval: string;
    providers: Record<string, WatchProviderOpts>;
}

export interface WatchProviderEntry {
    providerId: string;
    autoSync: string[];
}

const DEFAULT_INTERVAL = '5m';

/**
 * Parse a raw YAML provider opts entry into a strict WatchProviderOpts.
 * YAML null or missing fields are normalized to empty arrays.
 */
function parseProviderOpts(raw: unknown): WatchProviderOpts {
    if (raw === null || raw === undefined || typeof raw !== 'object') {
        return { autoSync: [] };
    }
    const o = raw as Record<string, unknown>;
    return {
        autoSync: Array.isArray(o.autoSync) ? (o.autoSync as string[]) : [],
    };
}

/**
 * Get the full watch config section.
 */
export async function getWatchConfig(): Promise<WatchConfig | null> {
    const doc = await loadDocument();
    const watchNode = doc.getIn(['watch']);
    if (!watchNode) return null;

    const raw = (YAML.isMap(watchNode) ? watchNode.toJSON() : watchNode) as Record<string, unknown>;
    if (!raw || typeof raw !== 'object') return null;

    const interval = typeof raw.interval === 'string' ? raw.interval : DEFAULT_INTERVAL;
    const providers: Record<string, WatchProviderOpts> = {};

    if (raw.providers && typeof raw.providers === 'object') {
        for (const [id, opts] of Object.entries(raw.providers as Record<string, unknown>)) {
            providers[id] = parseProviderOpts(opts);
        }
    }

    return { interval, providers };
}

/**
 * Get watched providers as a flat list.
 */
export async function getWatchProviders(): Promise<WatchProviderEntry[]> {
    const config = await getWatchConfig();
    if (!config) return [];

    return Object.entries(config.providers).map(([providerId, opts]) => ({
        providerId,
        autoSync: opts.autoSync,
    }));
}

/**
 * Add or update a provider in the watch list.
 */
export async function addWatchProvider(
    providerId: string,
    opts: { autoSync: string[] },
): Promise<void> {
    const doc = await loadDocument();

    // Ensure watch section exists
    if (!doc.getIn(['watch'])) {
        doc.setIn(['watch'], doc.createNode({ interval: DEFAULT_INTERVAL, providers: {} }));
    }

    // Ensure watch.providers exists
    if (!doc.getIn(['watch', 'providers'])) {
        doc.setIn(['watch', 'providers'], doc.createNode({}));
    }

    // Build the provider value: null in YAML for no-sync, object for sync
    const value = opts.autoSync.length > 0 ? { autoSync: opts.autoSync } : null;

    const providersNode = doc.getIn(['watch', 'providers'], true);
    if (YAML.isMap(providersNode)) {
        providersNode.set(providerId, doc.createNode(value));
    }

    await saveDocument(doc);
}

/**
 * Remove a provider from the watch list.
 */
export async function removeWatchProvider(providerId: string): Promise<boolean> {
    const doc = await loadDocument();
    const providersNode = doc.getIn(['watch', 'providers'], true);
    if (!YAML.isMap(providersNode) || !providersNode.has(providerId)) {
        return false;
    }

    providersNode.delete(providerId);
    await saveDocument(doc);
    return true;
}

/**
 * Set the watch interval.
 */
export async function setWatchInterval(interval: string): Promise<void> {
    const doc = await loadDocument();

    if (!doc.getIn(['watch'])) {
        doc.setIn(['watch'], doc.createNode({ interval, providers: {} }));
    } else {
        doc.setIn(['watch', 'interval'], interval);
    }

    await saveDocument(doc);
}
