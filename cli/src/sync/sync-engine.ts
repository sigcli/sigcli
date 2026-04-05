import type { IStorage } from '../core/interfaces/storage.js';
import type { RemoteConfig, SyncResult } from './types.js';
import { SshTransport } from './transports/ssh.js';

function sanitizeId(providerId: string): string {
  return providerId.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export class SyncEngine {
  private readonly transport: SshTransport;

  constructor(
    private readonly storage: IStorage,
    private readonly remote: RemoteConfig,
  ) {
    this.transport = new SshTransport();
  }

  async push(providerIds?: string[], force = false): Promise<SyncResult> {
    const result: SyncResult = { pushed: [], pulled: [], skipped: [], errors: [] };

    // Get local entries
    const localEntries = await this.storage.list();
    const toPush = providerIds
      ? localEntries.filter(e => providerIds.includes(e.providerId))
      : localEntries;

    if (toPush.length === 0) {
      return result;
    }

    // Get remote entries for conflict detection
    const remoteEntries = await this.transport.listRemote(this.remote);
    const remoteMap = new Map(remoteEntries.map(e => [e.providerId, e]));

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

    return result;
  }

  async pull(providerIds?: string[], force = false): Promise<SyncResult> {
    const result: SyncResult = { pushed: [], pulled: [], skipped: [], errors: [] };

    // Get remote entries
    const remoteEntries = await this.transport.listRemote(this.remote);
    const toPull = providerIds
      ? remoteEntries.filter(e => providerIds.includes(e.providerId))
      : remoteEntries;

    if (toPull.length === 0) {
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
          result.errors.push({ providerId: entry.providerId, error: 'Failed to read from remote' });
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

    return result;
  }
}
