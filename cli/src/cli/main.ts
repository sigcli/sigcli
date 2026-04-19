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
import { runCompletion } from './commands/completion.js';
import { runRun } from './commands/run.js';
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
        if (arg === '--') {
            // Everything after -- is positional (for sig run)
            for (let j = i + 1; j < args.length; j++) {
                positionals.push(args[j]);
            }
            break;
        } else if (arg.startsWith('--')) {
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

const HELP = `sig — authenticate once, use everywhere

Usage: sig <command> [options]

Authentication:
  login <url>                  Browser SSO login
    --as <id>                    Custom provider ID
    --token <value>              API key or PAT (no browser)
    --cookie "k=v; k2=v2"       Cookies from DevTools (no browser)
    --username <u> --password <p>  Basic auth (no browser)
    --strategy <name>            Force strategy (cookie|oauth2|api-token|basic)
    --force                      Skip stored/refresh check, go straight to browser
  logout [provider]            Clear credentials (all if none specified)

Credentials:
  get <provider|url>           Retrieve credential headers
    --format json|header|value   Output format (default: json)
  request <url>                Make an authenticated HTTP request
    --method <METHOD>            HTTP method (default: GET)
    --body <json>                Request body
    --header "Name: Value"       Custom header (repeatable)
    --format json|body|headers   Output format (default: json)
  status [provider]            Show authentication status
    --format json|yaml|env|table|plain  Output format
  run <provider|url> -- <cmd>  Run command with credentials injected as SIG_* env vars
    --expand-cookies             Expand individual cookies as SIG_COOKIE_<NAME>=value
    --no-redaction               Disable credential redaction from child output
    --mount <path>               Write credentials to file instead of env vars
    --mount-format env|json      File format for --mount (default: env)

Provider management:
  providers                    List configured providers
    --format json|yaml|env|table|plain  Output format
  rename <old> <new>           Rename a provider
  remove <provider> [...]      Remove provider(s) and their credentials
    --keep-config                Keep config entry, only clear credentials
    --force                      Skip confirmation

Remote & sync:
  remote add <name> <host>     Add an SSH remote
    --user <user>                SSH username
    --path <path>                Remote credentials directory
    --ssh-key <key>              SSH private key path
  remote remove <name>         Remove a remote
  remote list                  List remotes
    --format json|table          Output format
  sync push|pull [remote]      Sync credentials over SSH
    --provider <id>              Sync a specific provider only
    --force                      Overwrite on conflict

Watch:
  watch add <provider>         Add provider to watch list
    --auto-sync <remote>         Auto-sync to remote after refresh
  watch remove <provider>      Remove provider from watch list
  watch list                   Show watched providers
    --format json|table          Output format
  watch start                  Start auto-refresh daemon
    --interval <duration>        Override check interval (e.g. 5m, 1h)
    --once                       Single check cycle, then exit
  watch set-interval <dur>     Set default check interval

Setup:
  init                         Create ~/.sig/config.yaml
    --remote                     Headless machine setup (mode: browserless)
    --yes                        Accept defaults, skip prompts
    --force                      Overwrite existing config
    --channel <name>             Browser channel (chrome|msedge|chromium)
  doctor                       Check environment and configuration
  completion <shell>           Generate shell completion script (bash|zsh|fish)

Global options:
  --verbose                    Debug output to stderr
  --help                       Show this help
`;

const DEPS_COMMANDS: ReadonlySet<string> = new Set([
    Command.GET,
    Command.LOGIN,
    Command.STATUS,
    Command.LOGOUT,
    Command.PROVIDERS,
    Command.REQUEST,
    Command.SYNC,
    Command.WATCH,
    Command.RENAME,
    Command.REMOVE,
    Command.RUN,
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
    if (command === Command.COMPLETION) {
        await runCompletion(positionals, flags);
        return;
    }

    let deps: AuthDeps | undefined;
    if (DEPS_COMMANDS.has(command)) {
        // First-run detection: check if config file exists before loading
        const configPath = getConfigPath();
        if (!existsSync(configPath)) {
            process.stderr.write(
                '\nWelcome to SigCLI!\n\n' +
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
            await runGet(positionals, flags, deps as AuthDeps);
            break;
        case Command.LOGIN:
            await runLogin(positionals, flags, deps as AuthDeps);
            break;
        case Command.REQUEST:
            await runRequest(positionals, flags, deps as AuthDeps);
            break;
        case Command.STATUS:
            await runStatus(positionals, flags, deps as AuthDeps);
            break;
        case Command.LOGOUT:
            await runLogout(positionals, flags, deps as AuthDeps);
            break;
        case Command.PROVIDERS:
            await runProviders(positionals, flags, deps as AuthDeps);
            break;
        case Command.REMOTE:
            await runRemote(positionals, flags);
            break;
        case Command.SYNC:
            await runSync(positionals, flags, deps as AuthDeps);
            break;
        case Command.WATCH:
            await runWatch(positionals, flags, deps);
            break;
        case Command.RENAME:
            await runRename(positionals, flags, deps as AuthDeps);
            break;
        case Command.REMOVE:
            await runRemove(positionals, flags, deps as AuthDeps);
            break;
        case Command.RUN:
            await runRun(positionals, flags, deps as AuthDeps);
            break;
        default:
            process.stderr.write(`Unknown command: ${command}\n\n`);
            process.stdout.write(HELP);
            process.exitCode = ExitCode.GENERAL_ERROR;
    }
}
