import type { AuthDeps } from '../../deps.js';
import { formatJson, formatTable, formatExpiry, formatStatusIndicator } from '../formatters.js';
import type { ProviderStatus } from '../../core/types.js';
import { getWatchProviders, type WatchProviderEntry } from '../../watch/watch-config.js';

function buildRows(
  statuses: ProviderStatus[],
  watchMap: Map<string, WatchProviderEntry>,
): Record<string, string>[] {
  return statuses.map(s => {
    const entry = watchMap.get(s.id);
    return {
      id: s.id,
      strategy: s.strategy,
      status: formatStatusIndicator(s.valid, s.credentialType !== undefined),
      expires: s.expiresInMinutes !== undefined ? formatExpiry(s.expiresInMinutes) : '-',
      watch: entry ? '\u2713' : '-',
      sync: entry?.autoSync.length ? entry.autoSync.join(', ') : '-',
    };
  });
}

export async function runStatus(
  positionals: string[],
  flags: Record<string, string | boolean>,
  deps: AuthDeps,
): Promise<void> {
  const providerId = (flags.provider as string) ?? positionals[0];
  const format = (flags.format as string) ?? (process.stdout.isTTY ? 'table' : 'json');
  const tableOptions = { maxColumnWidths: { id: 30, sync: 20 } };

  const watchEntries = await getWatchProviders();
  const watchMap = new Map(watchEntries.map(e => [e.providerId, e]));

  if (providerId) {
    const resolved = deps.authManager.providerRegistry.resolveFlexible(providerId);
    const status = await deps.authManager.getStatus(resolved?.id ?? providerId);
    if (format === 'json') {
      process.stdout.write(formatJson(status) + '\n');
    } else {
      process.stdout.write(formatTable(buildRows([status], watchMap), tableOptions) + '\n');
    }
    return;
  }

  const statuses = await deps.authManager.getAllStatus();

  if (format === 'json') {
    process.stdout.write(formatJson(statuses) + '\n');
  } else {
    if (statuses.length === 0) {
      process.stderr.write('No providers configured.\n');
      return;
    }
    process.stdout.write(formatTable(buildRows(statuses, watchMap), tableOptions) + '\n');
  }
}
