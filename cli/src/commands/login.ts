import { isErr, isOk, type ProviderConfig } from '../types/index.js';
import { ExitCode } from '../utils/exit-codes.js';
import { formatJson } from '../utils/formatters.js';
import { promptLine, promptSecret } from '../utils/prompt.js';
import { persistIfAutoProvisioned } from '../utils/provider-persist.js';
import { AuditAction, AuditStatus, logAuditEvent } from '../audit/audit-log.js';
import type { AuthManager } from '../auth-manager.js';

async function finishLogin(provider: ProviderConfig, auth: AuthManager): Promise<void> {
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

async function loginOAuth2(
    provider: ProviderConfig,
    flags: Record<string, string | boolean | string[]>,
    auth: AuthManager,
): Promise<boolean> {
    const flagTokenUrl = typeof flags['token-url'] === 'string' ? flags['token-url'] : undefined;
    const flagClientId = typeof flags['client-id'] === 'string' ? flags['client-id'] : undefined;
    const flagClientSecret =
        typeof flags['client-secret'] === 'string' ? flags['client-secret'] : undefined;
    const flagScope = typeof flags['scope'] === 'string' ? flags['scope'] : undefined;

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
            return false;
        }
        const tokenUrlInput = (await promptLine('Token URL: ')).trim();
        if (!tokenUrlInput) {
            process.stderr.write('Error: Token URL is required.\n');
            process.exitCode = ExitCode.GENERAL_ERROR;
            return false;
        }
        const scopeInput = (await promptLine('Scopes (optional, space-separated): ')).trim();
        const scopes = scopeInput.split(' ').filter(Boolean);
        provider.oauth2 = {
            tokenUrl: tokenUrlInput,
            ...(scopes.length > 0 ? { scopes } : {}),
        };
    }

    if (provider.autoProvisioned) {
        provider.apply = [{ in: 'header', name: 'Authorization', value: 'Bearer ${access_token}' }];
        provider.extract = [];
        provider.entryUrl = '';
    }

    const existing = await auth.storage.get(provider.id);

    if (flagClientId || flagClientSecret) {
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
            return false;
        }
        await auth.storage.set(provider.id, {
            providerId: provider.id,
            strategy: 'oauth2',
            updatedAt: new Date().toISOString(),
            values: existing?.values ?? {},
            oauth2: mergedOauth2,
        });
    } else if (!existing?.oauth2?.clientId || !existing?.oauth2?.clientSecret) {
        const isTTY = process.stdin.isTTY && process.stdout.isTTY;
        if (!isTTY) {
            process.stderr.write(
                `Error: No stored credentials for "${provider.id}". ` +
                    `Run: sig login <url> --strategy oauth2 --token-url <url> --client-id <id> --client-secret <secret>\n`,
            );
            process.exitCode = ExitCode.GENERAL_ERROR;
            return false;
        }
        const clientId = (await promptLine('Client ID: ')).trim();
        if (!clientId) {
            process.stderr.write('Error: Client ID is required.\n');
            process.exitCode = ExitCode.GENERAL_ERROR;
            return false;
        }
        const clientSecret = await promptSecret('Client Secret: ');
        if (!clientSecret) {
            process.stderr.write('Error: Client Secret is required.\n');
            process.exitCode = ExitCode.GENERAL_ERROR;
            return false;
        }
        await auth.storage.set(provider.id, {
            providerId: provider.id,
            strategy: 'oauth2',
            updatedAt: new Date().toISOString(),
            values: existing?.values ?? {},
            oauth2: { clientId, clientSecret },
        });
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
        return false;
    }

    return true;
}

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

    if (networkProxy !== undefined && provider.autoProvisioned) {
        provider.networkProxy = networkProxy;
    }
    if (loginMode !== undefined && provider.autoProvisioned) {
        provider.loginMode = loginMode;
    }

    if (typeof flags.as === 'string') {
        const oldId = provider.id;
        provider.id = flags.as;
        if (provider.name === oldId) {
            provider.name = flags.as;
        }
        auth.providerRegistry.register(provider);
    }

    const isOauth2 = flagStrategy === 'oauth2' || provider.strategy === 'oauth2';

    if (isOauth2) {
        if (flagStrategy === 'oauth2') {
            provider.strategy = 'oauth2';
        }
        const ok = await loginOAuth2(provider, flags, auth);
        if (!ok) return;
        await finishLogin(provider, auth);
        return;
    }

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

    await finishLogin(provider, auth);
}
