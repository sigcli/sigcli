/**
 * sig init — Initialize SigCLI configuration.
 * Detects browser, creates directories, writes config.
 * Providers are added later via "sig login <url>" (auto-provisioning).
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';

import { WaitUntil } from '../types/index.js';
import { generateConfigYaml } from '../config/generator.js';
import { getConfigPath } from '../config/loader.js';
import { loadEncryptionKey } from '../crypto/encryption.js';
import { findNativeBrowser } from '../utils/detect-native.js';
import { findChannelBrowser } from '../utils/detect.js';
import { ExitCode } from '../utils/exit-codes.js';

// ---------------------------------------------------------------------------
// Browser detection
// ---------------------------------------------------------------------------

function detectBrowserChannel(): string {
    const channels = ['msedge', 'chrome', 'chromium'];
    for (const ch of channels) {
        if (findChannelBrowser(ch) !== null) return ch;
    }
    return 'msedge';
}

// ---------------------------------------------------------------------------
// Main command
// ---------------------------------------------------------------------------

export async function runInit(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
): Promise<void> {
    const configPath = getConfigPath();
    const sigDir = path.dirname(configPath);
    const force = flags.force === true;
    const remote = flags.remote === true;
    const yes = flags.yes === true || remote;

    if (fs.existsSync(configPath) && !force) {
        process.stderr.write(
            `Config file already exists: ${configPath}\n` + 'Use --force to overwrite.\n',
        );
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    // Detect defaults
    const detectedChannel = remote ? 'msedge' : detectBrowserChannel();
    const defaultChannel = typeof flags.channel === 'string' ? flags.channel : detectedChannel;
    const defaultBrowserDataDir =
        typeof flags['browser-data-dir'] === 'string'
            ? flags['browser-data-dir']
            : path.join(sigDir, 'browser-data');
    const defaultCredentialsDir =
        typeof flags['credentials-dir'] === 'string'
            ? flags['credentials-dir']
            : path.join(sigDir, 'credentials');

    let channel = defaultChannel;
    const browserDataDir = defaultBrowserDataDir;
    const credentialsDir = defaultCredentialsDir;
    let execPath: string | undefined;

    // Interactive: ask browser channel, detect or prompt for execPath
    const isTTY = process.stdin.isTTY && process.stdout.isTTY;
    if (isTTY && !yes) {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        try {
            process.stderr.write("\nWelcome to SigCLI! Let's set up your configuration.\n\n");

            const browserOptions = ['msedge', 'chrome', 'chromium'];
            const browserStatus = browserOptions.map((ch) => ({
                name: ch,
                found: findChannelBrowser(ch) !== null,
            }));
            const defaultIndex = browserOptions.indexOf(defaultChannel);
            const defaultMenuChoice = defaultIndex >= 0 ? String(defaultIndex + 1) : '1';
            process.stderr.write('Available browsers:\n');
            browserStatus.forEach((b, i) => {
                const mark = b.found ? '✓ (detected)' : '✗ (not found)';
                process.stderr.write(`  ${i + 1}. ${b.name} ${mark}\n`);
            });
            const channelAnswer = await rl.question(`Browser channel [${defaultMenuChoice}]: `);
            const trimmed = channelAnswer.trim();
            if (trimmed) {
                const asNumber = parseInt(trimmed, 10);
                if (!isNaN(asNumber) && asNumber >= 1 && asNumber <= browserOptions.length) {
                    channel = browserOptions[asNumber - 1];
                } else if (browserOptions.includes(trimmed)) {
                    channel = trimmed;
                }
            }

            // Detect execPath
            if (!remote) {
                const nativeBrowser = findNativeBrowser(channel);
                if (nativeBrowser) {
                    execPath = nativeBrowser.execPath;
                    process.stderr.write(`  Detected: ${execPath}\n`);
                } else {
                    process.stderr.write(`  Could not auto-detect ${channel} binary.\n`);
                    const userPath = await rl.question('Browser executable path: ');
                    if (userPath.trim()) {
                        execPath = userPath.trim();
                    }
                }
            }
        } finally {
            rl.close();
        }
    } else if (!remote) {
        const nativeBrowser = findNativeBrowser(channel);
        execPath = nativeBrowser?.execPath;
        if (!execPath) {
            process.stderr.write(
                `Warning: Could not detect browser binary for "${channel}". Set browser.execPath in config manually.\n`,
            );
        }
    }

    // Resolve ~ in paths for display but keep ~ in config for portability
    const displayBrowserDataDir = browserDataDir.replace(os.homedir(), '~');
    const displayCredentialsDir = credentialsDir.replace(os.homedir(), '~');

    // Generate config YAML
    const yaml = generateConfigYaml({
        mode: remote ? 'browserless' : 'browser',
        channel,
        execPath,
        browserDataDir: displayBrowserDataDir,
        credentialsDir: displayCredentialsDir,
        headlessTimeout: 30_000,
        visibleTimeout: 120_000,
        waitUntil: WaitUntil.LOAD,
    });

    // Create directories
    await fsp.mkdir(sigDir, { recursive: true });
    await fsp.mkdir(browserDataDir, { recursive: true });
    await fsp.mkdir(credentialsDir, { recursive: true });

    // Write config
    await fsp.writeFile(configPath, yaml, 'utf-8');

    // Clear stored credentials when reinitializing
    if (force) {
        try {
            const files = fs.readdirSync(credentialsDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    fs.unlinkSync(path.join(credentialsDir, file));
                }
            }
        } catch {
            /* credentials dir may not exist yet */
        }
    }

    // Ensure encryption key exists
    await loadEncryptionKey();

    // Success message
    process.stderr.write(`\n  Config written to ${configPath}\n`);
    process.stderr.write(`  Credentials:    ${credentialsDir}\n`);
    if (!remote) {
        process.stderr.write(`  Browser data:   ${browserDataDir}\n`);
        process.stderr.write(`  Browser:        ${channel}${execPath ? ` (${execPath})` : ''}\n`);
    } else {
        process.stderr.write(`  Browser:        disabled\n`);
    }
    if (remote) {
        process.stderr.write('\nRemote setup complete. To get credentials:\n');
        process.stderr.write('  sig sync pull              Pull from a machine with a browser\n');
        process.stderr.write('  sig login --token <url>    Paste a token manually\n');
    } else {
        process.stderr.write('\nQuick start:\n');
        process.stderr.write(
            '  sig login https://your-service.com   Auto-provisions provider + opens browser\n',
        );
        process.stderr.write('  sig get <provider>                   Get credentials as headers\n');
        process.stderr.write(
            '  sig run <provider> -- curl <url>     Run command with creds injected\n',
        );
        process.stderr.write(
            '\nNo manual config needed — "sig login <url>" creates providers automatically.\n',
        );
    }
    process.stderr.write('\n');
}
