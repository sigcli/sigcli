import { createInterface } from 'node:readline/promises';

import { isErr, isOk } from '../types/index.js';
import { ExitCode } from '../utils/exit-codes.js';
import { formatJson } from '../utils/formatters.js';
import { persistIfAutoProvisioned } from '../utils/provider-persist.js';
import { AuditAction, AuditStatus, logAuditEvent } from '../audit/audit-log.js';
import type { AuthManager } from '../auth-manager.js';

export async function runLogin(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
    auth: AuthManager,
): Promise<void> {
    const url = positionals[0];
    if (!url) {
        process.stderr.write('Usage: sig login <provider|url>\n');
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    const flagStrategy = typeof flags['strategy'] === 'string' ? flags['strategy'] : undefined;
    const flagTokenUrl = typeof flags['token-url'] === 'string' ? flags['token-url'] : undefined;
    const flagClientId = typeof flags['client-id'] === 'string' ? flags['client-id'] : undefined;
    const flagClientSecret =
        typeof flags['client-secret'] === 'string' ? flags['client-secret'] : undefined;
    const flagScope = typeof flags['scope'] === 'string' ? flags['scope'] : undefined;

    // Step 1: Resolve provider (auto-provision if URL)
    const resolved = auth.resolveProvider(url);
    if (isErr(resolved)) {
        process.stderr.write(
            `Error: No provider found matching "${url}". Run "sig providers" to see configured providers.\n`,
        );
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }
    const provider = resolved.value;
    auth.logger.info(`login: provider="${provider.id}" strategy=${provider.strategy}`);

    const networkProxy =
        typeof flags['network-proxy'] === 'string' ? flags['network-proxy'] : undefined;
    const loginMode =
        typeof flags['mode'] === 'string'
            ? (flags['mode'] as 'headless' | 'visible' | 'auto')
            : undefined;

    // Apply networkProxy to auto-provisioned providers so it persists in config
    if (networkProxy !== undefined && provider.autoProvisioned) {
        provider.networkProxy = networkProxy;
    }
    // Apply loginMode to auto-provisioned providers so it persists in config
    if (loginMode !== undefined && provider.autoProvisioned) {
        provider.loginMode = loginMode;
    }

    // Step 2: --as <id>: rename the auto-provisioned provider
    if (typeof flags.as === 'string') {
        const oldId = provider.id;
        provider.id = flags.as;
        if (provider.name === oldId) {
            provider.name = flags.as;
        }
        auth.providerRegistry.register(provider);
    }

    // Step 3: OAuth2 strategy handling
    const isOauth2 = flagStrategy === 'oauth2' || provider.strategy === 'oauth2';

    if (isOauth2) {
        // Override provider strategy if explicitly requested
        if (flagStrategy === 'oauth2') {
            provider.strategy = 'oauth2';
        }

        // Apply token-url and scope flags to provider config (overrides config file)
        if (flagTokenUrl) {
            provider.oauth2 = {
                tokenUrl: flagTokenUrl,
                ...(flagScope ? { scopes: flagScope.split(' ').filter(Boolean) } : {}),
            };
        } else if (!provider.oauth2?.tokenUrl) {
            const isTTY = process.stdin.isTTY && process.stdout.isTTY;
            if (!isTTY) {
                process.stderr.write(
                    `Error: OAuth2 requires --token-url. ` +
                        `Run: sig login <url> --strategy oauth2 --token-url <url> --client-id <id> --client-secret <secret>\n`,
                );
                process.exitCode = ExitCode.GENERAL_ERROR;
                return;
            }
            const rl = createInterface({ input: process.stdin, output: process.stderr });
            try {
                const tokenUrlInput = await rl.question('Token URL: ');
                const trimmedTokenUrl = tokenUrlInput.trim();
                if (!trimmedTokenUrl) {
                    process.stderr.write('Error: Token URL is required.\n');
                    process.exitCode = ExitCode.GENERAL_ERROR;
                    return;
                }
                const scopeInput = await rl.question('Scopes (optional, space-separated): ');
                const scopes = scopeInput.trim().split(' ').filter(Boolean);
                provider.oauth2 = {
                    tokenUrl: trimmedTokenUrl,
                    ...(scopes.length > 0 ? { scopes } : {}),
                };
            } finally {
                rl.close();
            }
        }

        // Set default apply rules for auto-provisioned oauth2 providers
        if (provider.autoProvisioned) {
            provider.apply = [
                { in: 'header', name: 'Authorization', value: 'Bearer ${access_token}' },
            ];
            // Clear the browser-default extract/entryUrl since oauth2 doesn't need them
            provider.extract = [];
            provider.entryUrl = '';
        }

        // Handle client credentials: merge flags into stored credential
        if (flagClientId || flagClientSecret) {
            // Load existing stored credential to preserve fields not being updated
            const existing = await auth.storage.get(provider.id);
            const existingOauth2 = existing?.oauth2 ?? { clientId: '', clientSecret: '' };

            const mergedOauth2 = {
                clientId: flagClientId ?? existingOauth2.clientId,
                clientSecret: flagClientSecret ?? existingOauth2.clientSecret,
            };

            if (!mergedOauth2.clientId || !mergedOauth2.clientSecret) {
                process.stderr.write(
                    `Error: OAuth2 requires both --client-id and --client-secret for first-time setup.\n`,
                );
                process.exitCode = ExitCode.GENERAL_ERROR;
                return;
            }

            // Pre-seed the credential store with oauth2 secrets so the strategy can read them
            await auth.storage.set(provider.id, {
                providerId: provider.id,
                strategy: 'oauth2',
                updatedAt: new Date().toISOString(),
                values: existing?.values ?? {},
                oauth2: mergedOauth2,
            });
        } else {
            // No credential flags — verify stored credential has oauth2 secrets
            const existing = await auth.storage.get(provider.id);
            if (!existing?.oauth2?.clientId || !existing?.oauth2?.clientSecret) {
                const isTTY = process.stdin.isTTY && process.stdout.isTTY;
                if (!isTTY) {
                    process.stderr.write(
                        `Error: No stored credentials for "${provider.id}". ` +
                            `Run: sig login <url> --strategy oauth2 --token-url <url> --client-id <id> --client-secret <secret>\n`,
                    );
                    process.exitCode = ExitCode.GENERAL_ERROR;
                    return;
                }
                const rl = createInterface({ input: process.stdin, output: process.stderr });
                let clientId: string;
                let clientSecret: string;
                try {
                    const clientIdInput = await rl.question('Client ID: ');
                    clientId = clientIdInput.trim();
                    if (!clientId) {
                        process.stderr.write('Error: Client ID is required.\n');
                        process.exitCode = ExitCode.GENERAL_ERROR;
                        return;
                    }
                    // Mask client secret input by temporarily suppressing echo
                    process.stderr.write('Client Secret: ');
                    process.stdin.setRawMode?.(true);
                    clientSecret = await new Promise<string>((resolve) => {
                        let input = '';
                        const onData = (chunk: Buffer) => {
                            const char = chunk.toString('utf8');
                            if (char === '\r' || char === '\n') {
                                process.stdin.removeListener('data', onData);
                                process.stdin.setRawMode?.(false);
                                process.stderr.write('\n');
                                resolve(input);
                            } else if (char === '\u0003') {
                                // Ctrl+C
                                process.stdin.removeListener('data', onData);
                                process.stdin.setRawMode?.(false);
                                process.stderr.write('\n');
                                resolve('');
                            } else if (char === '\u007f' || char === '\b') {
                                // Backspace
                                input = input.slice(0, -1);
                            } else {
                                input += char;
                            }
                        };
                        process.stdin.on('data', onData);
                        process.stdin.resume();
                    });
                } finally {
                    rl.close();
                }
                if (!clientSecret) {
                    process.stderr.write('Error: Client Secret is required.\n');
                    process.exitCode = ExitCode.GENERAL_ERROR;
                    return;
                }
                const mergedOauth2 = {
                    clientId,
                    clientSecret,
                };
                // Pre-seed the credential store with oauth2 secrets so the strategy can read them
                await auth.storage.set(provider.id, {
                    providerId: provider.id,
                    strategy: 'oauth2',
                    updatedAt: new Date().toISOString(),
                    values: existing?.values ?? {},
                    oauth2: mergedOauth2,
                });
            }
        }

        process.stderr.write(`[sig] Authenticating with "${provider.name}" (oauth2)...\n`);
        const result = await auth.getExtractedCreds(provider.id, { force: true });
        if (!isOk(result)) {
            await logAuditEvent({
                action: AuditAction.LOGIN,
                status: AuditStatus.FAILURE,
                provider: provider.id,
                metadata: { error: result.error.message },
            });
            process.stderr.write(`Authentication failed: ${result.error.message}\n`);
            process.exitCode = ExitCode.GENERAL_ERROR;
            return;
        }

        // Persist auto-provisioned provider to config.yaml after successful auth
        await persistIfAutoProvisioned(provider);

        const status = await auth.getStatus(provider.id);
        await logAuditEvent({
            action: AuditAction.LOGIN,
            status: AuditStatus.SUCCESS,
            provider: provider.id,
            metadata: { strategy: provider.strategy },
        });
        auth.logger.info(`login: success`);
        process.stderr.write(`Authenticated with "${provider.name}".\n`);
        process.stdout.write(
            formatJson({
                provider: provider.id,
                strategy: provider.strategy,
                ...(status.expiresAt ? { expiresAt: status.expiresAt } : {}),
            }) + '\n',
        );
        return;
    }

    // Step 4: Check browser availability for browser-based strategies
    if (!auth.browserAvailable && provider.strategy === 'browser') {
        process.stderr.write(
            `Browser is not available on this machine.\n` +
                `Provider "${provider.name}" uses "${provider.strategy}" strategy which requires a browser.\n\n` +
                `Alternatives:\n` +
                `  sig sync pull              Pull credentials from a machine with a browser\n\n` +
                `To set up sync:\n` +
                `  1. On a machine with a browser: sig login <url>\n` +
                `  2. Then: sig remote add <name> <this-host>\n` +
                `  3. Then: sig sync push <name>\n`,
        );
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    // Step 5: Authenticate (3-phase cascade: no-nav → headless → visible)
    process.stderr.write(`[sig] Authenticating with "${provider.name}"...\n`);
    const result = await auth.getExtractedCreds(provider.id, {
        force: true,
        ...(networkProxy !== undefined ? { networkProxy } : {}),
        ...(loginMode !== undefined ? { loginMode } : {}),
    });
    if (!isOk(result)) {
        await logAuditEvent({
            action: AuditAction.LOGIN,
            status: AuditStatus.FAILURE,
            provider: provider.id,
            metadata: { error: result.error.message },
        });
        process.stderr.write(`Authentication failed: ${result.error.message}\n`);
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    // Persist auto-provisioned provider to config.yaml after successful auth
    await persistIfAutoProvisioned(provider);

    const status = await auth.getStatus(provider.id);
    await logAuditEvent({
        action: AuditAction.LOGIN,
        status: AuditStatus.SUCCESS,
        provider: provider.id,
        metadata: { strategy: provider.strategy },
    });
    auth.logger.info(`login: success`);
    process.stderr.write(`Authenticated with "${provider.name}".\n`);
    process.stdout.write(
        formatJson({
            provider: provider.id,
            strategy: provider.strategy,
            ...(status.expiresAt ? { expiresAt: status.expiresAt } : {}),
        }) + '\n',
    );
}
