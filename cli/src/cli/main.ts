import { existsSync } from 'node:fs';
import { loadConfig, getConfigPath } from '../config/loader.js';
import { createAuthDeps } from '../deps.js';
import { isOk } from '../core/result.js';
import type { AuthDeps } from '../deps.js';

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

const HELP = `Usage: sig <command> [options]

Commands:
  init                   Set up Signet configuration (interactive)
  get <provider|url>     Get credential headers for a provider or URL
  login <provider|url>   Authenticate with a system (browser or token)
                         --as <id>  Use a custom provider ID
  request <url>          Make an authenticated HTTP request
  status [provider]      Show authentication status
  logout [provider]      Clear stored credentials
  rename <old> <new>     Rename a provider
  providers              List configured providers
  remote                 Manage remote credential stores
  sync                   Sync credentials with a remote
  watch                  Monitor and auto-refresh credentials
  doctor                 Check environment and configuration

Global options:
  --format <json|table|header|value|body>   Output format
  --help                                    Show this help message
`;

const DEPS_COMMANDS = new Set(['get', 'login', 'status', 'logout', 'providers', 'request', 'sync', 'watch', 'rename']);

export async function run(args: string[]): Promise<void> {
  const { command, positionals, flags } = parseArgs(args);

  if (command === 'help' || flags.help === true) {
    process.stdout.write(HELP);
    return;
  }

  // Commands that don't need deps (run before config exists)
  if (command === 'init') {
    await runInit(positionals, flags);
    return;
  }
  if (command === 'doctor') {
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
      process.exitCode = 1;
      return;
    }

    const configResult = await loadConfig();
    if (!isOk(configResult)) {
      process.stderr.write(`Config error: ${configResult.error.message}\n`);
      process.exitCode = 1;
      return;
    }
    const config = configResult.value;
    deps = createAuthDeps(config);
  }

  switch (command) {
    case 'get':
      await runGet(positionals, flags, deps!);
      break;
    case 'login':
      await runLogin(positionals, flags, deps!);
      break;
    case 'request':
      await runRequest(positionals, flags, deps!);
      break;
    case 'status':
      await runStatus(positionals, flags, deps!);
      break;
    case 'logout':
      await runLogout(positionals, flags, deps!);
      break;
    case 'providers':
      await runProviders(positionals, flags, deps!);
      break;
    case 'remote':
      await runRemote(positionals, flags);
      break;
    case 'sync':
      await runSync(positionals, flags, deps!);
      break;
    case 'watch':
      await runWatch(positionals, flags, deps);
      break;
    case 'rename':
      await runRename(positionals, flags, deps!);
      break;
    default:
      process.stderr.write(`Unknown command: ${command}\n\n`);
      process.stdout.write(HELP);
      process.exitCode = 1;
  }
}
