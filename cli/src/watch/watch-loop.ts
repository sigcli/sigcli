/**
 * Core watch loop — check, refresh, and sync credentials on a schedule.
 * Decoupled from CLI I/O for testability.
 */

import { Cron } from 'croner';
import type { AuthManager } from '../auth-manager.js';
import type { IStorage } from '../core/interfaces/storage.js';
import type { ILogger } from '../core/types.js';
import type { SignetConfig } from '../config/schema.js';
import { isOk } from '../core/result.js';
import { SyncEngine } from '../sync/sync-engine.js';
import { getRemote } from '../sync/remote-config.js';
import type { WatchProviderEntry } from './watch-config.js';

// ============================================================================
// Types
// ============================================================================

export interface WatchCycleResult {
  cycle: number;
  timestamp: string;
  checked: string[];
  refreshed: string[];
  synced: { providerId: string; remote: string }[];
  errors: { providerId: string; error: string }[];
}

export interface WatchLoopDeps {
  authManager: AuthManager;
  storage: IStorage;
  config: SignetConfig;
  logger: ILogger;
}

export interface WatchLoopOptions {
  intervalMs: number;
  once: boolean;
}

// ============================================================================
// Single Cycle
// ============================================================================

export async function runCycle(
  deps: WatchLoopDeps,
  watchProviders: WatchProviderEntry[],
  cycleNumber: number,
  intervalMs: number,
): Promise<WatchCycleResult> {
  const result: WatchCycleResult = {
    cycle: cycleNumber,
    timestamp: new Date().toISOString(),
    checked: [],
    refreshed: [],
    synced: [],
    errors: [],
  };

  for (const entry of watchProviders) {
    const { providerId } = entry;
    result.checked.push(providerId);

    const status = await deps.authManager.getStatus(providerId);

    if (!status.configured) {
      result.errors.push({ providerId, error: `Provider "${providerId}" not configured` });
      continue;
    }

    // Grace period = interval: refresh if credential expires before the next cycle
    const graceMinutes = Math.ceil(intervalMs / 60_000);
    const expiringSoon = status.valid
      && status.expiresInMinutes !== undefined
      && status.expiresInMinutes <= graceMinutes;

    if (status.valid && !expiringSoon) {
      deps.logger.debug(`${providerId}: valid (expires in ${status.expiresInMinutes ?? '?'}m)`);
      continue;
    }

    const reason = expiringSoon
      ? `expiring in ${status.expiresInMinutes}m`
      : 'expired';
    deps.logger.info(`${providerId}: ${reason}, refreshing...`);
    const credResult = await deps.authManager.getCredentials(providerId);

    if (isOk(credResult)) {
      result.refreshed.push(providerId);
      deps.logger.info(`${providerId}: refreshed`);
    } else {
      result.errors.push({ providerId, error: credResult.error.message });
      deps.logger.error(`${providerId}: refresh failed — ${credResult.error.message}`);
      continue;
    }

    // Auto-sync if configured
    for (const remoteName of entry.autoSync) {
      try {
        const remote = await getRemote(remoteName);
        if (!remote) {
          result.errors.push({ providerId, error: `Remote "${remoteName}" not found` });
          continue;
        }
        const engine = new SyncEngine(deps.storage, remote, deps.config);
        const syncResult = await engine.push([providerId], true);
        if (syncResult.pushed.includes(providerId)) {
          result.synced.push({ providerId, remote: remoteName });
          deps.logger.info(`${providerId}: synced to ${remoteName}`);
        }
        for (const se of syncResult.errors) {
          result.errors.push({ providerId: se.providerId, error: `sync(${remoteName}): ${se.error}` });
        }
      } catch (e: unknown) {
        result.errors.push({ providerId, error: `sync(${remoteName}): ${(e as Error).message}` });
        deps.logger.error(`${providerId}: sync to ${remoteName} failed — ${(e as Error).message}`);
      }
    }
  }

  return result;
}

// ============================================================================
// Interval → Cron Expression
// ============================================================================

/**
 * Convert a millisecond interval to the most appropriate cron expression.
 * Uses 6-field cron (with seconds) for sub-minute intervals.
 */
function intervalToCron(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));

  if (seconds < 60) {
    return `*/${seconds} * * * * *`;
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `0 */${minutes} * * * *`;
  }

  const hours = Math.round(minutes / 60);
  return `0 0 */${hours} * * *`;
}

// ============================================================================
// Watch Loop
// ============================================================================

export async function startWatchLoop(
  deps: WatchLoopDeps,
  options: WatchLoopOptions,
  getWatchProviders: () => Promise<WatchProviderEntry[]>,
  signal: AbortSignal,
  onCycle: (result: WatchCycleResult) => void,
): Promise<void> {
  let cycle = 0;

  async function tick(): Promise<void> {
    cycle++;
    // Re-read watch config each cycle to pick up dynamic changes
    const providers = await getWatchProviders();
    if (providers.length === 0) {
      deps.logger.warn('No providers in watch list, skipping cycle');
      return;
    }
    const result = await runCycle(deps, providers, cycle, options.intervalMs);
    onCycle(result);
  }

  // Run first cycle immediately
  await tick();

  if (options.once || signal.aborted) {
    return;
  }

  // Schedule recurring cycles with croner
  const cronExpr = intervalToCron(options.intervalMs);

  return new Promise<void>((resolve) => {
    const job = new Cron(cronExpr, { protect: true }, async () => {
      if (signal.aborted) {
        job.stop();
        resolve();
        return;
      }
      await tick();
    });

    signal.addEventListener('abort', () => {
      job.stop();
      resolve();
    }, { once: true });
  });
}
