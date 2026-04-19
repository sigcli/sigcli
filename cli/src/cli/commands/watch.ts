import type { AuthDeps } from '../../deps.js';
import {
    addWatchProvider,
    removeWatchProvider,
    setWatchInterval,
} from '../../watch/watch-config.js';
import { getRemote } from '../../sync/remote-config.js';
import { parseDuration } from '../../utils/duration.js';
import { ExitCode } from '../exit-codes.js';
import { WatchSubcommand } from '../../core/constants.js';

const USAGE = `Usage: sig watch <subcommand>

Subcommands:
  add <provider> [--auto-sync <remote>]    Add provider to watch list
  remove <provider>                        Remove provider from watch list
  set-interval <duration>                  Set default interval (e.g. 5m, 1h)
`;

export async function runWatch(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
    deps?: AuthDeps,
): Promise<void> {
    const subcommand = positionals[0];

    switch (subcommand) {
        case WatchSubcommand.ADD:
            await handleAdd(positionals.slice(1), flags, deps);
            break;
        case WatchSubcommand.REMOVE:
            await handleRemove(positionals.slice(1));
            break;
        case WatchSubcommand.SET_INTERVAL:
            await handleSetInterval(positionals.slice(1));
            break;
        default:
            process.stderr.write(USAGE);
            process.exitCode = subcommand ? ExitCode.GENERAL_ERROR : ExitCode.SUCCESS;
    }
}

// ============================================================================
// Subcommands
// ============================================================================

async function handleAdd(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
    deps?: AuthDeps,
): Promise<void> {
    const providerId = positionals[0];
    if (!providerId) {
        process.stderr.write('Usage: sig watch add <provider> [--auto-sync <remote>]\n');
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    // Validate provider exists in config
    if (deps) {
        const provider = deps.providerRegistry.resolveFlexible(providerId);
        if (!provider) {
            process.stderr.write(`Error: Provider "${providerId}" not found in config.\n`);
            process.exitCode = ExitCode.GENERAL_ERROR;
            return;
        }
    }

    // Parse --auto-sync (single remote name for now)
    const autoSync: string[] = [];
    const autoSyncValue = flags['auto-sync'];
    if (typeof autoSyncValue === 'string') {
        // Validate remote exists
        const remote = await getRemote(autoSyncValue);
        if (!remote) {
            process.stderr.write(
                `Error: Remote "${autoSyncValue}" not found. Run "sig remote list" to see configured remotes.\n`,
            );
            process.exitCode = ExitCode.GENERAL_ERROR;
            return;
        }
        autoSync.push(autoSyncValue);
    }

    await addWatchProvider(providerId, { autoSync });
    process.stderr.write(`Added "${providerId}" to watch list`);
    if (autoSync.length > 0) {
        process.stderr.write(` (auto-sync: ${autoSync.join(', ')})`);
    }
    process.stderr.write('\n');
}

async function handleRemove(positionals: string[]): Promise<void> {
    const providerId = positionals[0];
    if (!providerId) {
        process.stderr.write('Usage: sig watch remove <provider>\n');
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    const removed = await removeWatchProvider(providerId);
    if (!removed) {
        process.stderr.write(`Provider "${providerId}" is not in the watch list.\n`);
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    process.stderr.write(`Removed "${providerId}" from watch list.\n`);
}

async function handleSetInterval(positionals: string[]): Promise<void> {
    const interval = positionals[0];
    if (!interval) {
        process.stderr.write('Usage: sig watch set-interval <duration>  (e.g. 5m, 1h)\n');
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    try {
        parseDuration(interval);
    } catch {
        process.stderr.write(
            `Invalid interval: "${interval}". Use format like "30s", "5m", "1h".\n`,
        );
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    await setWatchInterval(interval);
    process.stderr.write(`Watch interval set to ${interval}.\n`);
}
