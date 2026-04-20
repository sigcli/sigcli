import { spawn } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import type { AuthDeps } from '../../deps.js';
import { isOk } from '../../core/result.js';
import { ExitCode } from '../exit-codes.js';
import { credentialToEnvVars } from '../../utils/credential-env.js';
import { extractSensitiveValues, redactOutput } from '../../utils/redact.js';
import { logAuditEvent, AuditAction, AuditStatus } from '../../audit/audit-log.js';

export async function runRun(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
    deps: AuthDeps,
): Promise<void> {
    // Split positionals into providers and command args.
    // Heuristic: iterate positionals, each that matches providerRegistry.get() is a provider.
    // First non-match and everything after is the command.
    const providers: string[] = [];
    let cmdStartIdx = 0;
    for (let i = 0; i < positionals.length; i++) {
        if (deps.providerRegistry.get(positionals[i])) {
            providers.push(positionals[i]);
            cmdStartIdx = i + 1;
        } else {
            break;
        }
    }
    const cmdArgs = positionals.slice(cmdStartIdx);

    if (cmdArgs.length === 0) {
        process.stderr.write(
            'Error: No command specified\nUsage: sig run [provider...] -- <cmd> [args]\n',
        );
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    const explicitMode = providers.length > 0;

    if (!explicitMode) {
        const allProviders = deps.providerRegistry.list();
        for (const p of allProviders) {
            const credResult = await deps.authManager.getCredentials(p.id);
            if (isOk(credResult)) {
                providers.push(p.id);
            }
        }
        if (providers.length === 0) {
            process.stderr.write(
                'Error: No valid credentials found. Run "sig login <url>" first.\n',
            );
            process.exitCode = ExitCode.GENERAL_ERROR;
            return;
        }
    }

    const expandCookies = flags['expand-cookies'] === true;
    const allEnv: Record<string, string> = {};
    const allSecrets: string[] = [];

    for (const providerId of providers) {
        const credResult = await deps.authManager.getCredentials(providerId);
        if (!isOk(credResult)) {
            if (explicitMode) {
                process.stderr.write(`Error: ${credResult.error.message}\n`);
                if (credResult.error.code === 'PROVIDER_NOT_FOUND') {
                    process.stderr.write(
                        `No provider "${providerId}" found. Run "sig providers" to list configured providers.\n`,
                    );
                } else {
                    process.stderr.write(`Run "sig login <url>" first to authenticate.\n`);
                }
                process.exitCode = ExitCode.GENERAL_ERROR;
                return;
            }
            continue;
        }
        const sigEnv = credentialToEnvVars(credResult.value, providerId, { expandCookies });
        Object.assign(allEnv, sigEnv);
        allSecrets.push(...extractSensitiveValues(credResult.value));
    }

    const secrets = [...new Set(allSecrets)];
    const mount = typeof flags['mount'] === 'string' ? flags['mount'] : undefined;
    const mountFormat = typeof flags['mount-format'] === 'string' ? flags['mount-format'] : 'env';
    const childEnv = { ...process.env, ...allEnv };

    if (mount) {
        let content: string;
        if (mountFormat === 'json') {
            content = JSON.stringify(allEnv, null, 2) + '\n';
        } else {
            content =
                Object.entries(allEnv)
                    .map(([k, v]) => `${k}=${v}`)
                    .join('\n') + '\n';
        }
        writeFileSync(mount, content, { encoding: 'utf8', mode: 0o600 });
    }

    await logAuditEvent({
        action: AuditAction.RUN,
        status: AuditStatus.SUCCESS,
        metadata: { providers, command: cmdArgs[0], providerCount: providers.length },
    });

    const [cmd, ...args] = cmdArgs;
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
        const text = chunk.toString();
        const redacted = redactOutput(text, secrets);
        if (!redactionNoticeShown && redacted !== text) {
            redactionNoticeShown = true;
            process.stderr.write('[sig] Credential values redacted from output.\n');
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
