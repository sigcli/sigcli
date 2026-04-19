import { spawn } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import type { AuthDeps } from '../../deps.js';
import { isOk } from '../../core/result.js';
import { ExitCode } from '../exit-codes.js';
import { credentialToEnvVars } from '../../utils/credential-env.js';
import { extractSensitiveValues, redactOutput } from '../../utils/redact.js';

export async function runRun(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
    deps: AuthDeps,
): Promise<void> {
    const provider = positionals[0];
    if (!provider) {
        process.stderr.write(
            'Error: provider is required\nUsage: sig run <provider|url> -- <command> [args]\n',
        );
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    // Validate provider exists
    if (!deps.providerRegistry.get(provider)) {
        process.stderr.write(
            `Error: No provider "${provider}" found. Run "sig providers" to list configured providers.\n`,
        );
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    const cmdArgs = positionals.slice(1);
    if (cmdArgs.length === 0) {
        process.stderr.write(
            'Error: No command specified\nUsage: sig run <provider|url> -- <command> [args]\n',
        );
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    const credResult = await deps.authManager.getCredentials(provider);
    if (!isOk(credResult)) {
        process.stderr.write(`Error: ${credResult.error.message}\n`);
        if (credResult.error.code === 'PROVIDER_NOT_FOUND') {
            process.stderr.write(
                `No provider "${provider}" found. Run "sig providers" to list configured providers.\n`,
            );
        } else {
            process.stderr.write(`Run "sig login <url>" first to authenticate.\n`);
        }
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    const credential = credResult.value;
    const expandCookies = flags['expand-cookies'] === true;
    const noRedaction = flags['no-redaction'] === true;
    const mount = typeof flags['mount'] === 'string' ? flags['mount'] : undefined;
    const mountFormat = typeof flags['mount-format'] === 'string' ? flags['mount-format'] : 'env';

    const sigEnv = credentialToEnvVars(credential, provider, { expandCookies });
    const childEnv = { ...process.env, ...sigEnv };

    // Mount mode: write credentials to file
    if (mount) {
        let content: string;
        if (mountFormat === 'json') {
            content = JSON.stringify(sigEnv, null, 2) + '\n';
        } else {
            content =
                Object.entries(sigEnv)
                    .map(([k, v]) => `${k}=${v}`)
                    .join('\n') + '\n';
        }
        writeFileSync(mount, content, { encoding: 'utf8', mode: 0o600 });
    }

    const [cmd, ...args] = cmdArgs;
    const secrets = noRedaction ? [] : extractSensitiveValues(credential);
    let redactionNoticeShown = false;

    const child = spawn(cmd, args, {
        env: childEnv,
        stdio: ['inherit', 'pipe', 'pipe'],
    });

    const cleanup = () => {
        if (mount) {
            try {
                unlinkSync(mount);
            } catch {
                /* ignore */
            }
        }
    };

    const forwardSignal = (signal: NodeJS.Signals) => {
        cleanup();
        child.kill(signal);
    };

    process.on('SIGINT', () => forwardSignal('SIGINT'));
    process.on('SIGTERM', () => forwardSignal('SIGTERM'));

    const writeRedacted = (chunk: Buffer, dest: NodeJS.WriteStream) => {
        if (noRedaction) {
            dest.write(chunk);
            return;
        }
        const text = chunk.toString();
        const redacted = redactOutput(text, secrets);
        if (!redactionNoticeShown && redacted !== text) {
            redactionNoticeShown = true;
            process.stderr.write(
                '[sig] Credential values redacted. Use --no-redaction to disable.\n',
            );
        }
        dest.write(redacted);
    };

    child.stdout.on('data', (chunk: Buffer) => writeRedacted(chunk, process.stdout));
    child.stderr.on('data', (chunk: Buffer) => writeRedacted(chunk, process.stderr));

    await new Promise<void>((resolve) => {
        child.on('close', (code) => {
            cleanup();
            if (code !== null && code !== 0) {
                process.exitCode = code;
            }
            resolve();
        });
    });
}
