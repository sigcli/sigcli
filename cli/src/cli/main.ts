import { existsSync } from 'node:fs';
import { loadConfig, getConfigPath } from '../config/loader.js';
import { createAuthDeps } from '../deps.js';
import { isOk } from '../core/result.js';
import type { AuthDeps } from '../deps.js';
import { Command } from '../core/constants.js';

import { runGet } from './commands/get.js';
import { runLogin } from './commands/login.js';
import { runStatus } from './commands/status.js';
import { runLogout } from './commands/logout.js';
import { runProviders } from './commands/providers.js';
import { runRequest } from './commands/request.js';
import { runRemote } from './commands/remote.js';
import { runSync } from './commands/sync.js';
import { runWatch } from './commands/watch.js';
import { runInit } from './commands/init.js';
import { runDoctor } from './commands/doctor.js';
import { runRename } from './commands/rename.js';
import { runRemove } from './commands/remove.js';
import { ExitCode } from './exit-codes.js';

interface ParsedArgs {
  command: string;
  positionals: string[];
  flags: Record<string, string | boolean | string[]>;
}

export function parseArgs(args: string[]): ParsedArgs {
  const firstIsFlag = args[0]?.startsWith('--');
  const command = firstIsFlag ? 'help' : (args[0] ?? 'help');
  const positionals: string[] = [];
  const flags: Record<string, string | boolean | string[]> = {};

  let i = firstIsFlag ? 0 : 1;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        const existing = flags[key];
        if (typeof existing === 'string') {
          flags[key] = [existing, next];
        } else if (Array.isArray(existing)) {
          existing.push(next);
        } else {
          flags[key] = next;
        }
        i += 2;
      } else {
        flags[key] = true;
        i += 1;
      }
    } else {
      positionals.push(arg);
      i += 1;
    }
  }

  return { command, positionals, flags };
}

const HELP = `signet — authenticate once, use everywhere

Usage: sig <command> [options]

Provider commands:
  login <provider|url>     Authenticate with a provider
                           --as <id>  Use a custom provider ID
  logout [provider]        Clear stored credentials
  get <provider|url>       Get credential headers
  request <url>            Make an authenticated HTTP request
  status [provider]        Show authentication status
  remove <provider>        Remove a provider and its credentials
  rename <old> <new>       Rename a provider
  providers                List configured providers
  watch [provider]         Monitor and auto-refresh credentials

Remote commands:
  remote add|remove|list   Manage remote credential stores
  sync push|pull [remote]  Sync credentials with a remote

Setup:
  init                     Set up Signet configuration
  doctor                   Check environment and configuration

Global options:
  --format <json|table|header|value|body>   Output format
  --verbose                                 Show debug output
  --help                                    Show this help message
`;

const DEPS_COMMANDS: ReadonlySet<string> = new Set([
  Command.GET, Command.LOGIN, Command.STATUS, Command.LOGOUT,
  Command.PROVIDERS, Command.REQUEST, Command.SYNC, Command.WATCH,
  Command.RENAME, Command.REMOVE,
]);

export async function run(args: string[]): Promise<void> {
  const { command, positionals, flags } = parseArgs(args);

  if (command === Command.HELP || flags.help === true) {
    process.stdout.write(HELP);
    return;
  }

  // Commands that don't need deps (run before config exists)
  if (command === Command.INIT) {
    await runInit(positionals, flags);
    return;
  }
  if (command === Command.DOCTOR) {
    await runDoctor(positionals, flags);
    return;
  }

  let deps: AuthDeps | undefined;
  if (DEPS_COMMANDS.has(command)) {
    // First-run detection: check if config file exists before loading
    const configPath = getConfigPath();
    if (!existsSync(configPath)) {
      process.stderr.write(
        '\nWelcome to Signet!\n\n' +
        `  No config file found at ${configPath}\n` +
        '  Run "sig init" to set up your configuration.\n\n',
      );
      process.exitCode = ExitCode.GENERAL_ERROR;
      return;
    }

    const configResult = await loadConfig();
    if (!isOk(configResult)) {
      process.stderr.write(`Config error: ${configResult.error.message}\n`);
      process.exitCode = ExitCode.GENERAL_ERROR;
      return;
    }
    const config = configResult.value;
    const verbose = flags.verbose === true;
    deps = createAuthDeps(config, { verbose });
  }

  switch (command) {
    case Command.GET:
      await runGet(positionals, flags, deps!);
      break;
    case Command.LOGIN:
      await runLogin(positionals, flags, deps!);
      break;
    case Command.REQUEST:
      await runRequest(positionals, flags, deps!);
      break;
    case Command.STATUS:
      await runStatus(positionals, flags, deps!);
      break;
    case Command.LOGOUT:
      await runLogout(positionals, flags, deps!);
      break;
    case Command.PROVIDERS:
      await runProviders(positionals, flags, deps!);
      break;
    case Command.REMOTE:
      await runRemote(positionals, flags);
      break;
    case Command.SYNC:
      await runSync(positionals, flags, deps!);
      break;
    case Command.WATCH:
      await runWatch(positionals, flags, deps);
      break;
    case Command.RENAME:
      await runRename(positionals, flags, deps!);
      break;
    case Command.REMOVE:
      await runRemove(positionals, flags, deps!);
      break;
    default:
      process.stderr.write(`Unknown command: ${command}\n\n`);
      process.stdout.write(HELP);
      process.exitCode = ExitCode.GENERAL_ERROR;
  }
}
