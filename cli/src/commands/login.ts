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

    // Step 3: Check browser availability for browser-based strategies
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

    // Step 4: Authenticate (3-phase cascade: no-nav → headless → visible)
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
