import { existsSync } from 'node:fs';

import { Command, isOk } from './types/index.js';
import { getConfigPath, loadConfig } from './config/loader.js';
import { ExitCode } from './utils/exit-codes.js';
import { createNoopLogger, createOperationalLogger } from './utils/logger.js';
import { AuthManager } from './auth-manager.js';
import { runCompletion } from './commands/completion.js';
import { runDoctor } from './commands/doctor.js';
import { runGet } from './commands/get.js';
import { runInit } from './commands/init.js';
import { runLogin } from './commands/login.js';
import { runLogout } from './commands/logout.js';
import { runProviders } from './commands/providers.js';
import { runProxy } from './commands/proxy.js';
import { runRemote } from './commands/remote.js';
import { runRemove } from './commands/remove.js';
import { runRename } from './commands/rename.js';
import { runRequest } from './commands/request.js';
import { runRun } from './commands/run.js';
import { runStatus } from './commands/status.js';
import { runSync } from './commands/sync.js';
import { runWatch } from './commands/watch.js';

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
        } else if (arg === '-h') {
            flags['help'] = true;
            i += 1;
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
  login [provider]|[url --as <id>]  Authenticate via browser
    --as <id>                       Custom provider ID for auto-provisioned
    --force                         Skip stored credentials, force re-auth
    --network-proxy <url>           Browser proxy (e.g. socks5://127.0.0.1:1080)
  logout [provider]                 Clear credentials (all if none specified)

Credentials (most → least secure):
  proxy start [--port 8080]    Start MITM proxy daemon (credentials never leave proxy process)
  proxy stop                   Stop proxy daemon
  proxy status                 Show proxy status and env-var hints
  proxy trust                  Print CA cert path for OS trust setup
  request <url>                Make authenticated HTTP request (credentials in-process only)
    --method <METHOD>            HTTP method (default: GET)
    --body <json>                Request body
    --header "Name: Value"       Custom header (repeatable)
    --format json|body|headers   Output format (default: json)
  run [provider...] -- <cmd>   Run command with SIG_* env vars (redacted output)
    --expand-cookies             Expand individual cookies as SIG_COOKIE_<NAME>=value
    --mount <path>               Write credentials to file instead of env vars
    --mount-format env|json      File format for --mount (default: env)
    No providers: injects all valid credentials. Vars always prefixed: SIG_<PROVIDER>_*
  get <provider|url>           Retrieve credential headers (⚠ prints to stdout)
    --format json|header|value   Output format (default: json)
    --no-redaction               Output raw (unredacted) credential values
  status [provider]            Show authentication status
    --format json|yaml|env|table|plain  Output format

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
  watch set-interval <dur>     Set default check interval

Setup:
  init                         Create ~/.sig/config.yaml
    --remote                     Headless machine setup (mode: browserless)
    --yes                        Accept defaults, skip prompts
    --force                      Overwrite existing config
  doctor                       Check environment, config, and encryption key
  completion <shell>           Generate shell completion script (bash|zsh|fish)

Security: proxy ≥ request > run > get. Full docs at https://sigcli.ai/docs/#security

Global options:
  --verbose                    Show debug output to stderr
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
    Command.PROXY,
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

    let auth: AuthManager | undefined;
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

        const VERBOSE_COMMANDS: ReadonlySet<string> = new Set([
            Command.LOGIN,
            Command.REQUEST,
            Command.RUN,
            Command.SYNC,
            Command.PROXY,
        ]);
        const verbose = flags.verbose === true || VERBOSE_COMMANDS.has(command);
        const logger = verbose ? createOperationalLogger() : createNoopLogger();
        auth = await AuthManager.create(config, logger);
    }

    switch (command) {
        case Command.GET:
            await runGet(positionals, flags, auth as AuthManager);
            break;
        case Command.LOGIN:
            await runLogin(positionals, flags, auth as AuthManager);
            break;
        case Command.REQUEST:
            await runRequest(positionals, flags, auth as AuthManager);
            break;
        case Command.STATUS:
            await runStatus(positionals, flags, auth as AuthManager);
            break;
        case Command.LOGOUT:
            await runLogout(positionals, flags, auth as AuthManager);
            break;
        case Command.PROVIDERS:
            await runProviders(positionals, flags, auth as AuthManager);
            break;
        case Command.REMOTE:
            await runRemote(positionals, flags);
            break;
        case Command.SYNC:
            await runSync(positionals, flags, auth as AuthManager);
            break;
        case Command.WATCH:
            await runWatch(positionals, flags, auth);
            break;
        case Command.RENAME:
            await runRename(positionals, flags, auth as AuthManager);
            break;
        case Command.REMOVE:
            await runRemove(positionals, flags, auth as AuthManager);
            break;
        case Command.RUN:
            await runRun(positionals, flags, auth as AuthManager);
            break;
        case Command.PROXY:
            await runProxy(positionals, flags, auth);
            break;
        default:
            process.stderr.write(`Unknown command: ${command}\n\n`);
            process.stdout.write(HELP);
            process.exitCode = ExitCode.GENERAL_ERROR;
    }
}
