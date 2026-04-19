/**
 * sig init — Interactive setup command.
 * Creates ~/.sig/config.yaml with sensible defaults.
 * Does NOT take deps (runs before config exists).
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createInterface } from 'node:readline/promises';
import YAML from 'yaml';
import { getConfigPath } from '../../config/loader.js';
import { generateConfigYaml } from '../../config/generator.js';
import { validateConfig } from '../../config/validator.js';
import { isOk } from '../../core/result.js';
import { findChannelBrowser } from '../../browser/detect.js';
import { ExitCode } from '../exit-codes.js';
import { WaitUntil, StrategyName, HttpHeader, AuthScheme } from '../../core/constants.js';

// ---------------------------------------------------------------------------
// Strategy templates — one per built-in strategy
// ---------------------------------------------------------------------------

interface StrategyTemplate {
    description: string;
    needsEntryUrl: boolean;
    defaultConfig?: Record<string, unknown>;
}

const STRATEGY_TEMPLATES: Record<string, StrategyTemplate> = {
    [StrategyName.COOKIE]: {
        description: 'Browser-based SSO (Jira, Confluence, internal portals)',
        needsEntryUrl: true,
    },
    [StrategyName.OAUTH2]: {
        description: 'OAuth2 with token refresh',
        needsEntryUrl: true,
    },
    [StrategyName.API_TOKEN]: {
        description: 'Static API token (GitHub, GitLab)',
        needsEntryUrl: false,
        defaultConfig: { headerName: HttpHeader.AUTHORIZATION, headerPrefix: AuthScheme.BEARER },
    },
    [StrategyName.BASIC]: {
        description: 'Username + password (HTTP Basic)',
        needsEntryUrl: false,
    },
};

// ---------------------------------------------------------------------------
// Browser channel detection
// ---------------------------------------------------------------------------

function detectBrowserChannel(): string {
    const channels = ['chrome', 'msedge', 'chromium'];
    for (const ch of channels) {
        if (findChannelBrowser(ch) !== null) return ch;
    }
    return 'chrome';
}

// ---------------------------------------------------------------------------
// Interactive prompts
// ---------------------------------------------------------------------------

async function promptProviders(rl: ReturnType<typeof createInterface>): Promise<
    Array<{
        id: string;
        domains: string[];
        strategy: string;
        entryUrl: string;
        config?: Record<string, unknown>;
    }>
> {
    const providers: Array<{
        id: string;
        domains: string[];
        strategy: string;
        entryUrl: string;
        config?: Record<string, unknown>;
    }> = [];

    const addMore = await rl.question('\nWould you like to add a provider? (y/N) ');
    if (addMore.toLowerCase() !== 'y') return providers;

    let keepAdding = true;
    while (keepAdding) {
        const strategyNames = Object.keys(STRATEGY_TEMPLATES);
        process.stderr.write('\nStrategy templates:\n');
        for (let i = 0; i < strategyNames.length; i++) {
            const key = strategyNames[i];
            const tmpl = STRATEGY_TEMPLATES[key];
            process.stderr.write(`  ${i + 1}. ${key} — ${tmpl.description}\n`);
        }

        const choice = await rl.question(`\nSelect strategy (1-${strategyNames.length}): `);
        const choiceNum = parseInt(choice, 10);

        if (choiceNum < 1 || choiceNum > strategyNames.length) {
            process.stderr.write('  Invalid selection.\n');
            const again = await rl.question('\nAdd another provider? (y/N) ');
            keepAdding = again.toLowerCase() === 'y';
            continue;
        }

        const strategyKey = strategyNames[choiceNum - 1];
        const template = STRATEGY_TEMPLATES[strategyKey];

        const id = await rl.question('Provider id (e.g., my-jira): ');
        if (!id.trim()) {
            process.stderr.write('  Skipping — id is required.\n');
            const again = await rl.question('\nAdd another provider? (y/N) ');
            keepAdding = again.toLowerCase() === 'y';
            continue;
        }

        const domain = await rl.question('Domain(s) (comma-separated): ');
        const domains = domain
            .split(',')
            .map((d) => d.trim())
            .filter(Boolean);
        if (domains.length === 0) {
            process.stderr.write('  Skipping — at least one domain is required.\n');
            const again = await rl.question('\nAdd another provider? (y/N) ');
            keepAdding = again.toLowerCase() === 'y';
            continue;
        }

        let entryUrl: string | undefined;
        if (template.needsEntryUrl) {
            const url = await rl.question(`Entry URL (e.g., https://${domains[0]}/): `);
            if (url.trim()) entryUrl = url.trim();
        }

        providers.push({
            id: id.trim(),
            domains,
            strategy: strategyKey,
            entryUrl: entryUrl ?? `https://${domains[0]}/`,
            ...(template.defaultConfig ? { config: template.defaultConfig } : {}),
        });
        process.stderr.write(`  Added "${id.trim()}" (${strategyKey}).\n`);

        const again = await rl.question('\nAdd another provider? (y/N) ');
        keepAdding = again.toLowerCase() === 'y';
    }

    return providers;
}

// ---------------------------------------------------------------------------
// Main command
// ---------------------------------------------------------------------------

export async function runInit(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
): Promise<void> {
    const configPath = getConfigPath();
    const signetDir = path.dirname(configPath);
    const force = flags.force === true;
    const remote = flags.remote === true;
    const yes = flags.yes === true || remote;

    // Check if config already exists
    if (fs.existsSync(configPath) && !force) {
        process.stderr.write(
            `Config file already exists: ${configPath}\n` + 'Use --force to overwrite.\n',
        );
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    // Detect defaults
    const detectedChannel = remote ? 'chrome' : detectBrowserChannel();
    const defaultChannel = typeof flags.channel === 'string' ? flags.channel : detectedChannel;
    const defaultBrowserDataDir =
        typeof flags['browser-data-dir'] === 'string'
            ? flags['browser-data-dir']
            : path.join(signetDir, 'browser-data');
    const defaultCredentialsDir =
        typeof flags['credentials-dir'] === 'string'
            ? flags['credentials-dir']
            : path.join(signetDir, 'credentials');

    let channel = defaultChannel;
    const browserDataDir = defaultBrowserDataDir;
    const credentialsDir = defaultCredentialsDir;
    let providers: Array<{
        id: string;
        domains: string[];
        strategy: string;
        entryUrl: string;
        config?: Record<string, unknown>;
    }> = [];

    // Interactive mode
    const isTTY = process.stdin.isTTY && process.stdout.isTTY;
    if (isTTY && !yes) {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        try {
            process.stderr.write("\nWelcome to Signet! Let's set up your configuration.\n\n");

            const channelAnswer = await rl.question(`Browser channel [${defaultChannel}]: `);
            if (channelAnswer.trim()) channel = channelAnswer.trim();

            providers = await promptProviders(rl);
        } finally {
            rl.close();
        }
    } else {
        if (!yes) {
            // Non-TTY, non-yes: use defaults silently
        }
    }

    // Resolve ~ in paths for display but keep ~ in config for portability
    const displayBrowserDataDir = browserDataDir.replace(os.homedir(), '~');
    const displayCredentialsDir = credentialsDir.replace(os.homedir(), '~');

    // Generate config YAML
    const yaml = generateConfigYaml({
        mode: remote ? 'browserless' : 'browser',
        channel,
        browserDataDir: displayBrowserDataDir,
        credentialsDir: displayCredentialsDir,
        headlessTimeout: 30_000,
        visibleTimeout: 120_000,
        waitUntil: WaitUntil.LOAD,
        providers: providers.length > 0 ? providers : undefined,
    });

    // Validate the generated config before writing (sanity check)
    let raw: unknown;
    try {
        raw = YAML.parse(yaml);
    } catch (e: unknown) {
        process.stderr.write(`Bug: generated invalid YAML: ${(e as Error).message}\n`);
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    const validationResult = validateConfig(raw as Record<string, unknown>);
    if (!isOk(validationResult)) {
        process.stderr.write(
            `Bug: generated config failed validation: ${validationResult.error.message}\n`,
        );
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    // Create directories
    await fsp.mkdir(signetDir, { recursive: true });
    await fsp.mkdir(browserDataDir, { recursive: true });
    await fsp.mkdir(credentialsDir, { recursive: true });

    // Write config
    await fsp.writeFile(configPath, yaml, 'utf-8');

    // Success message
    process.stderr.write(`\n  Config written to ${configPath}\n`);
    process.stderr.write(`  Credentials:    ${credentialsDir}\n`);
    if (!remote) {
        process.stderr.write(`  Browser data:   ${browserDataDir}\n`);
        process.stderr.write(`  Browser:        ${channel}\n`);
    } else {
        process.stderr.write(`  Browser:        disabled\n`);
    }
    if (providers.length > 0) {
        process.stderr.write(`  Providers:      ${providers.map((p) => p.id).join(', ')}\n`);
    }
    if (remote) {
        process.stderr.write('\nRemote setup complete (browser disabled).\n\n');
        process.stderr.write('Get credentials from a machine with a browser:\n');
        process.stderr.write(
            '  sig remote add <name> <host>    Add a remote with browser access\n',
        );
        process.stderr.write(
            '  sig sync pull <name>            Pull credentials from that remote\n',
        );
        process.stderr.write('\nOr set credentials manually:\n');
        process.stderr.write(
            '  sig login <url> --cookie "..."   Set cookies from browser DevTools\n',
        );
        process.stderr.write('  sig login <url> --token <token>  Set an API token\n');
        process.stderr.write('\n  sig doctor                      Check your setup\n');
    } else {
        process.stderr.write('\nNext steps:\n');
        process.stderr.write('  sig login <url>       Authenticate with a service\n');
        process.stderr.write('  sig providers         List configured providers\n');
        process.stderr.write('  sig doctor            Check your setup\n');
    }
    process.stderr.write('\n');
}
