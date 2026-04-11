import type { AuthDeps } from "../../deps.js";
import {
  getWatchConfig,
  getWatchProviders,
  addWatchProvider,
  removeWatchProvider,
  setWatchInterval,
} from "../../watch/watch-config.js";
import { startWatchLoop } from "../../watch/watch-loop.js";
import { getRemote } from "../../sync/remote-config.js";
import { parseDuration, formatDuration } from "../../utils/duration.js";
import { formatJson, formatTable } from "../formatters.js";

const USAGE = `Usage: sig watch <subcommand>

Subcommands:
  add <provider> [--auto-sync <remote>]    Add provider to watch list
  remove <provider>                        Remove provider from watch list
  list                                     Show watched providers
  start [--interval 5m] [--once]           Start the watch daemon
  set-interval <duration>                  Set default interval (e.g. 5m, 1h)
`;

export async function runWatch(
  positionals: string[],
  flags: Record<string, string | boolean>,
  deps?: AuthDeps,
): Promise<void> {
  const subcommand = positionals[0];

  switch (subcommand) {
    case "add":
      await handleAdd(positionals.slice(1), flags, deps);
      break;
    case "remove":
      await handleRemove(positionals.slice(1));
      break;
    case "list":
      await handleList(flags);
      break;
    case "start":
      if (!deps) {
        process.stderr.write('Error: Config required. Run "sig init" first.\n');
        process.exitCode = 1;
        return;
      }
      await handleStart(flags, deps);
      break;
    case "set-interval":
      await handleSetInterval(positionals.slice(1));
      break;
    default:
      process.stderr.write(USAGE);
      process.exitCode = subcommand ? 1 : 0;
  }
}

// ============================================================================
// Subcommands
// ============================================================================

async function handleAdd(
  positionals: string[],
  flags: Record<string, string | boolean>,
  deps?: AuthDeps,
): Promise<void> {
  const providerId = positionals[0];
  if (!providerId) {
    process.stderr.write(
      "Usage: sig watch add <provider> [--auto-sync <remote>]\n",
    );
    process.exitCode = 1;
    return;
  }

  // Validate provider exists in config
  if (deps) {
    const provider = deps.providerRegistry.resolveFlexible(providerId);
    if (!provider) {
      process.stderr.write(
        `Error: Provider "${providerId}" not found in config.\n`,
      );
      process.exitCode = 1;
      return;
    }
  }

  // Parse --auto-sync (single remote name for now)
  const autoSync: string[] = [];
  const autoSyncValue = flags["auto-sync"];
  if (typeof autoSyncValue === "string") {
    // Validate remote exists
    const remote = await getRemote(autoSyncValue);
    if (!remote) {
      process.stderr.write(
        `Error: Remote "${autoSyncValue}" not found. Run "sig remote list" to see configured remotes.\n`,
      );
      process.exitCode = 1;
      return;
    }
    autoSync.push(autoSyncValue);
  }

  await addWatchProvider(providerId, { autoSync });
  process.stderr.write(`Added "${providerId}" to watch list`);
  if (autoSync.length > 0) {
    process.stderr.write(` (auto-sync: ${autoSync.join(", ")})`);
  }
  process.stderr.write("\n");
}

async function handleRemove(positionals: string[]): Promise<void> {
  const providerId = positionals[0];
  if (!providerId) {
    process.stderr.write("Usage: sig watch remove <provider>\n");
    process.exitCode = 1;
    return;
  }

  const removed = await removeWatchProvider(providerId);
  if (!removed) {
    process.stderr.write(
      `Provider "${providerId}" is not in the watch list.\n`,
    );
    process.exitCode = 1;
    return;
  }

  process.stderr.write(`Removed "${providerId}" from watch list.\n`);
}

async function handleList(
  flags: Record<string, string | boolean>,
): Promise<void> {
  const config = await getWatchConfig();
  if (!config || Object.keys(config.providers).length === 0) {
    process.stderr.write(
      'No providers in watch list. Use "sig watch add <provider>" to add one.\n',
    );
    return;
  }

  const format =
    (flags.format as string) ?? (process.stdout.isTTY ? "table" : "json");
  const entries = Object.entries(config.providers).map(([id, opts]) => ({
    provider: id,
    autoSync: opts.autoSync.length > 0 ? opts.autoSync.join(", ") : "-",
  }));

  if (format === "json") {
    const providers = await getWatchProviders();
    process.stdout.write(
      formatJson({ interval: config.interval, providers }) + "\n",
    );
  } else {
    process.stderr.write(`Interval: ${config.interval}\n\n`);
    process.stdout.write(formatTable(entries) + "\n");
  }
}

async function handleSetInterval(positionals: string[]): Promise<void> {
  const interval = positionals[0];
  if (!interval) {
    process.stderr.write(
      "Usage: sig watch set-interval <duration>  (e.g. 5m, 1h)\n",
    );
    process.exitCode = 1;
    return;
  }

  try {
    parseDuration(interval);
  } catch {
    process.stderr.write(
      `Invalid interval: "${interval}". Use format like "30s", "5m", "1h".\n`,
    );
    process.exitCode = 1;
    return;
  }

  await setWatchInterval(interval);
  process.stderr.write(`Watch interval set to ${interval}.\n`);
}

async function handleStart(
  flags: Record<string, string | boolean>,
  deps: AuthDeps,
): Promise<void> {
  // Load watch config
  const watchConfig = await getWatchConfig();
  if (!watchConfig || Object.keys(watchConfig.providers).length === 0) {
    process.stderr.write(
      'No providers in watch list. Use "sig watch add <provider>" first.\n',
    );
    process.exitCode = 1;
    return;
  }

  // Parse interval (flag overrides config)
  const intervalStr =
    typeof flags.interval === "string" ? flags.interval : watchConfig.interval;
  let intervalMs: number;
  try {
    intervalMs = parseDuration(intervalStr);
  } catch {
    process.stderr.write(
      `Invalid interval: "${intervalStr}". Use format like "30s", "5m", "1h".\n`,
    );
    process.exitCode = 1;
    return;
  }

  const once = flags.once === true;

  // Validate all autoSync remotes exist
  for (const [providerId, opts] of Object.entries(watchConfig.providers)) {
    for (const remoteName of opts.autoSync) {
      const remote = await getRemote(remoteName);
      if (!remote) {
        process.stderr.write(
          `Error: Provider "${providerId}" has autoSync remote "${remoteName}" which does not exist.\n`,
        );
        process.exitCode = 1;
        return;
      }
    }
  }

  // Graceful shutdown
  const controller = new AbortController();
  const shutdown = () => {
    process.stderr.write("\nShutting down...\n");
    controller.abort();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const providerIds = Object.keys(watchConfig.providers);
  process.stderr.write(
    `Watching ${providerIds.length} provider(s): ${providerIds.join(", ")}\n` +
      `Interval: ${formatDuration(intervalMs)}` +
      (once ? " | Mode: single cycle" : "") +
      "\n\n",
  );

  const logger = {
    debug: (msg: string) => process.stderr.write(`  ${msg}\n`),
    info: (msg: string) => process.stderr.write(`  ${msg}\n`),
    warn: (msg: string) => process.stderr.write(`  WARN: ${msg}\n`),
    error: (msg: string) => process.stderr.write(`  ERROR: ${msg}\n`),
  };

  await startWatchLoop(
    {
      authManager: deps.authManager,
      storage: deps.storage,
      config: deps.config,
      logger,
    },
    { intervalMs, once },
    getWatchProviders,
    controller.signal,
    (result) => {
      const summary = {
        cycle: result.cycle,
        checked: result.checked,
        refreshed: result.refreshed,
        synced: result.synced,
        errors: result.errors,
      };
      process.stdout.write(formatJson(summary) + "\n");

      if (result.errors.length === 0 && result.refreshed.length === 0) {
        process.stderr.write(`  Cycle ${result.cycle}: all valid\n`);
      } else if (result.errors.length > 0) {
        process.stderr.write(
          `  Cycle ${result.cycle}: ${result.refreshed.length} refreshed, ${result.errors.length} error(s)\n`,
        );
      } else {
        process.stderr.write(
          `  Cycle ${result.cycle}: ${result.refreshed.length} refreshed\n`,
        );
      }
    },
  );

  // Cleanup
  process.off("SIGINT", shutdown);
  process.off("SIGTERM", shutdown);
}
