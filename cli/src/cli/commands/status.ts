import type { AuthDeps } from '../../deps.js';
import { formatExpiry, formatStatusIndicator, formatTable } from '../formatters.js';
import type { ProviderStatus } from '../../core/types.js';
import { getWatchProviders, type WatchProviderEntry } from '../../watch/watch-config.js';
import { detectFormat, formatOutput } from '../../utils/formatter.js';

function buildRows(
    statuses: ProviderStatus[],
    watchMap: Map<string, WatchProviderEntry>,
): Record<string, string>[] {
    return statuses.map((s) => {
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
    flags: Record<string, string | boolean | string[]>,
    deps: AuthDeps,
): Promise<void> {
    const providerId = (flags.provider as string) ?? positionals[0];
    const format = detectFormat(flags.format as string | undefined, 'table');
    const tableOptions = { maxColumnWidths: { id: 30, sync: 20 } };

    const watchEntries = await getWatchProviders();
    const watchMap = new Map(watchEntries.map((e) => [e.providerId, e]));

    if (providerId) {
        const resolved = deps.authManager.providerRegistry.resolveFlexible(providerId);
        const status = await deps.authManager.getStatus(resolved?.id ?? providerId);
        if (format === 'table') {
            process.stdout.write(formatTable(buildRows([status], watchMap), tableOptions) + '\n');
        } else {
            process.stdout.write(
                formatOutput(status as unknown as Record<string, unknown>, format) + '\n',
            );
        }
        return;
    }

    const statuses = await deps.authManager.getAllStatus();

    if (format === 'table') {
        if (statuses.length === 0) {
            process.stderr.write('No providers configured.\n');
            return;
        }
        process.stdout.write(formatTable(buildRows(statuses, watchMap), tableOptions) + '\n');
    } else {
        process.stdout.write(
            formatOutput(statuses as unknown as Record<string, unknown>[], format) + '\n',
        );
    }
}
