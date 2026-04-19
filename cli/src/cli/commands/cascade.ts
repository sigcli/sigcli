import type { AuthDeps } from '../../deps.js';
import { isOk } from '../../core/result.js';
import { ProviderNotFoundError } from '../../core/errors.js';
import { BROWSER_REQUIRED_STRATEGIES } from '../../core/constants.js';
import { ExitCode } from '../exit-codes.js';
import { formatJson } from '../formatters.js';

type StepResult =
    | 'valid'
    | 'refreshed'
    | 'authenticated'
    | 'not found'
    | 'expired'
    | 'failed'
    | 'skipped';

function printStep(n: number, total: number, desc: string, result: StepResult): void {
    const icon =
        result === 'valid' || result === 'refreshed' || result === 'authenticated'
            ? '\u2713'
            : '\u2717';
    process.stderr.write(`  [${n}/${total}] ${desc} ${icon} ${result}\n`);
}

export async function runCascade(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
    deps: AuthDeps,
): Promise<void> {
    const target = positionals[0];
    if (!target) {
        process.stderr.write('Usage: sig cascade <url>\n');
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    let provider;
    try {
        provider = deps.authManager.resolveProvider(target);
    } catch (e) {
        if (e instanceof ProviderNotFoundError) {
            process.stderr.write(
                `Error: No provider found matching "${target}". Run "sig providers" to see configured providers.\n`,
            );
            process.exitCode = ExitCode.GENERAL_ERROR;
            return;
        }
        throw e;
    }

    const total = 3;
    process.stderr.write(`Cascade auth for "${provider.name}" (${provider.id})\n`);

    // Step 1: Check stored credentials
    const status = await deps.authManager.getStatus(provider.id);
    if (status.valid) {
        printStep(1, total, 'Checking stored credentials...', 'valid');
        const result = await deps.authManager.getCredentials(provider.id);
        if (isOk(result)) {
            process.stderr.write(
                `Authenticated with "${provider.name}" (using stored credential).\n`,
            );
            process.stdout.write(
                formatJson({
                    provider: provider.id,
                    type: result.value.type,
                    ...(status.expiresAt ? { expiresAt: status.expiresAt } : {}),
                    source: 'stored',
                }) + '\n',
            );
            return;
        }
    }

    if (status.configured && !status.valid) {
        printStep(1, total, 'Checking stored credentials...', 'expired');
        process.stderr.write(`  [2/${total}] Attempting credential refresh... `);

        const refreshResult = await deps.authManager.getCredentials(provider.id);
        if (isOk(refreshResult)) {
            process.stderr.write(`\u2713 refreshed\n`);
            const newStatus = await deps.authManager.getStatus(provider.id);
            process.stderr.write(`Authenticated with "${provider.name}" (credential refreshed).\n`);
            process.stdout.write(
                formatJson({
                    provider: provider.id,
                    type: refreshResult.value.type,
                    ...(newStatus.expiresAt ? { expiresAt: newStatus.expiresAt } : {}),
                    source: 'refreshed',
                }) + '\n',
            );
            return;
        }
        process.stderr.write(`\u2717 failed\n`);
    } else {
        printStep(1, total, 'Checking stored credentials...', 'not found');
        printStep(2, total, 'Attempting credential refresh...', 'skipped');
    }

    // Step 3: Fall back to browser login
    if (!deps.browserAvailable && BROWSER_REQUIRED_STRATEGIES.has(provider.strategy)) {
        printStep(3, total, 'Falling back to browser login...', 'failed');
        process.stderr.write(
            `Browser is not available on this machine.\n` +
                `Provider "${provider.name}" uses "${provider.strategy}" strategy which requires a browser.\n\n` +
                `Alternatives:\n` +
                `  sig login <url> --cookie <string>  Provide cookies manually\n` +
                `  sig login <url> --token <token>    Provide a token directly\n` +
                `  sig sync pull                       Pull credentials from a machine with a browser\n`,
        );
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    process.stderr.write(`  [3/${total}] Falling back to browser login... `);
    const authResult = await deps.authManager.forceReauth(provider.id);
    if (!isOk(authResult)) {
        process.stderr.write(`\u2717 failed\n`);
        process.stderr.write(`Authentication failed: ${authResult.error.message}\n`);
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    process.stderr.write(`\u2713 authenticated\n`);
    const finalStatus = await deps.authManager.getStatus(provider.id);
    process.stderr.write(`Authenticated with "${provider.name}".\n`);
    process.stdout.write(
        formatJson({
            provider: provider.id,
            type: authResult.value.type,
            ...(finalStatus.expiresAt ? { expiresAt: finalStatus.expiresAt } : {}),
            source: 'browser',
        }) + '\n',
    );
}
