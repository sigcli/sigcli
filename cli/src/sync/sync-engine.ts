import fs from 'node:fs/promises';
import YAML from 'yaml';
import type { IStorage } from '../core/interfaces/storage.js';
import type { SignetConfig } from '../config/schema.js';
import { getConfigPath } from '../config/loader.js';
import type { RemoteConfig, SyncResult } from './types.js';
import type { ISyncTransport } from './interfaces/transport.js';
import { sanitizeId } from '../utils/sanitize.js';

export class SyncEngine {
    private readonly transport: ISyncTransport;

    constructor(
        private readonly storage: IStorage,
        private readonly remote: RemoteConfig,
        private readonly config: SignetConfig,
        transport: ISyncTransport,
    ) {
        this.transport = transport;
    }

    async push(providerIds?: string[], force = false): Promise<SyncResult> {
        const result: SyncResult = {
            pushed: [],
            pulled: [],
            skipped: [],
            errors: [],
            configSynced: { providers: [] },
        };

        // Get local entries
        const localEntries = await this.storage.list();
        const toPush = providerIds
            ? localEntries.filter((e) => providerIds.includes(e.providerId))
            : localEntries;

        if (toPush.length === 0) {
            // Still sync config even if no credentials to push
            result.configSynced = await this.syncConfigPush(providerIds);
            return result;
        }

        // Get remote entries for conflict detection
        const remoteEntries = await this.transport.listRemote(this.remote);
        const remoteMap = new Map(remoteEntries.map((e) => [e.providerId, e]));

        for (const entry of toPush) {
            try {
                const filename = `${sanitizeId(entry.providerId)}.json`;
                const remoteEntry = remoteMap.get(entry.providerId);

                // Conflict detection: skip if remote is newer
                if (remoteEntry && !force) {
                    const localTime = new Date(entry.updatedAt).getTime();
                    const remoteTime = new Date(remoteEntry.updatedAt).getTime();
                    if (remoteTime > localTime) {
                        result.skipped.push(entry.providerId);
                        continue;
                    }
                }

                const stored = await this.storage.get(entry.providerId);
                if (!stored) continue;

                await this.transport.writeRemote(this.remote, filename, stored);
                result.pushed.push(entry.providerId);
            } catch (e: unknown) {
                result.errors.push({
                    providerId: entry.providerId,
                    error: (e as Error).message,
                });
            }
        }

        // Sync config alongside credentials
        result.configSynced = await this.syncConfigPush(providerIds);

        return result;
    }

    async pull(providerIds?: string[], force = false): Promise<SyncResult> {
        const result: SyncResult = {
            pushed: [],
            pulled: [],
            skipped: [],
            errors: [],
            configSynced: { providers: [] },
        };

        // Get remote entries
        const remoteEntries = await this.transport.listRemote(this.remote);
        const toPull = providerIds
            ? remoteEntries.filter((e) => providerIds.includes(e.providerId))
            : remoteEntries;

        if (toPull.length === 0) {
            // Still sync config even if no credentials to pull
            result.configSynced = await this.syncConfigPull(providerIds);
            return result;
        }

        for (const entry of toPull) {
            try {
                // Conflict detection
                if (!force) {
                    const local = await this.storage.get(entry.providerId);
                    if (local) {
                        const localTime = new Date(local.updatedAt).getTime();
                        const remoteTime = new Date(entry.updatedAt).getTime();
                        if (localTime > remoteTime) {
                            result.skipped.push(entry.providerId);
                            continue;
                        }
                    }
                }

                const stored = await this.transport.readRemote(this.remote, entry.filename);
                if (!stored) {
                    result.errors.push({
                        providerId: entry.providerId,
                        error: 'Failed to read from remote',
                    });
                    continue;
                }

                await this.storage.set(entry.providerId, stored);
                result.pulled.push(entry.providerId);
            } catch (e: unknown) {
                result.errors.push({
                    providerId: entry.providerId,
                    error: (e as Error).message,
                });
            }
        }

        // Sync config alongside credentials
        result.configSynced = await this.syncConfigPull(providerIds);

        return result;
    }

    /** Push local provider definitions to remote config.yaml */
    private async syncConfigPush(
        providerIds?: string[],
    ): Promise<{ providers: string[]; error?: string }> {
        try {
            const allProviders = this.config.providers;
            const localProviders = providerIds
                ? Object.fromEntries(
                      Object.entries(allProviders).filter(([id]) => providerIds.includes(id)),
                  )
                : { ...allProviders };

            if (Object.keys(localProviders).length === 0) {
                return { providers: [] };
            }

            // Read remote config (may not exist)
            const remoteYaml = await this.transport.readRemoteConfig(this.remote);

            let doc: YAML.Document;
            if (remoteYaml === null) {
                // Create a full config so the remote passes validation
                doc = new YAML.Document({
                    mode: 'browserless',
                    browser: {
                        browserDataDir: '~/.sig/browser-data',
                        channel: 'chrome',
                        headlessTimeout: 30000,
                        visibleTimeout: 120000,
                        waitUntil: 'load',
                    },
                    storage: {
                        credentialsDir: '~/.sig/credentials',
                    },
                    providers: localProviders,
                });
            } else {
                // Parse with Document to preserve comments
                doc = YAML.parseDocument(remoteYaml);
                const remoteProviders: Record<string, unknown> =
                    ((doc.getIn(['providers']) as YAML.YAMLMap)?.toJSON() as Record<
                        string,
                        unknown
                    >) ?? {};
                // Merge: local wins on push
                const merged = { ...remoteProviders, ...localProviders };
                doc.setIn(['providers'], doc.createNode(merged));

                // Ensure required sections exist so remote passes validation
                if (!doc.getIn(['mode'])) {
                    doc.setIn(['mode'], 'browserless');
                }
                if (!doc.getIn(['browser'])) {
                    doc.setIn(
                        ['browser'],
                        doc.createNode({
                            browserDataDir: '~/.sig/browser-data',
                            channel: 'chrome',
                            headlessTimeout: 30000,
                            visibleTimeout: 120000,
                            waitUntil: 'load',
                        }),
                    );
                }
                if (!doc.getIn(['storage'])) {
                    doc.setIn(
                        ['storage'],
                        doc.createNode({
                            credentialsDir: '~/.sig/credentials',
                        }),
                    );
                }
            }

            await this.transport.writeRemoteConfig(this.remote, doc.toString());
            return { providers: Object.keys(localProviders) };
        } catch (e: unknown) {
            return { providers: [], error: (e as Error).message };
        }
    }

    /** Pull remote provider definitions into local config.yaml */
    private async syncConfigPull(
        providerIds?: string[],
    ): Promise<{ providers: string[]; error?: string }> {
        try {
            // Read remote config
            const remoteYaml = await this.transport.readRemoteConfig(this.remote);
            if (remoteYaml === null) {
                return {
                    providers: [],
                    error: 'Remote has no config.yaml — run "sig init" on remote first',
                };
            }

            // Parse remote and extract providers
            const remoteDoc = YAML.parseDocument(remoteYaml);
            const allRemoteProviders: Record<string, unknown> =
                ((remoteDoc.getIn(['providers']) as YAML.YAMLMap)?.toJSON() as Record<
                    string,
                    unknown
                >) ?? {};

            // Filter by providerIds if specified
            const remoteProviders = providerIds
                ? Object.fromEntries(
                      Object.entries(allRemoteProviders).filter(([id]) => providerIds.includes(id)),
                  )
                : { ...allRemoteProviders };

            if (Object.keys(remoteProviders).length === 0) {
                return { providers: [] };
            }

            // Read local config preserving comments
            const configPath = getConfigPath();
            const localYaml = await fs.readFile(configPath, 'utf-8');
            const doc = YAML.parseDocument(localYaml);
            const localProviders: Record<string, unknown> =
                ((doc.getIn(['providers']) as YAML.YAMLMap)?.toJSON() as Record<string, unknown>) ??
                {};

            // Merge: remote wins on pull
            const merged = { ...localProviders, ...remoteProviders };
            doc.setIn(['providers'], doc.createNode(merged));

            await fs.writeFile(configPath, doc.toString(), 'utf-8');
            return { providers: Object.keys(remoteProviders) };
        } catch (e: unknown) {
            return { providers: [], error: (e as Error).message };
        }
    }
}
