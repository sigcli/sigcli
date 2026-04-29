import type { AuthManager } from '../auth-manager.js';
import type { ProviderConfig } from '../types/types.js';
import type { ProviderEntry } from '../config/schema.js';
import { addProviderToConfig } from '../config/loader.js';
import { isOk } from '../types/result.js';
import { formatJson } from '../utils/formatters.js';
import { ProviderNotFoundError } from '../types/errors.js';
import { ExitCode } from '../utils/exit-codes.js';
import { logAuditEvent, AuditAction, AuditStatus } from '../audit/audit-log.js';

/** Convert runtime ProviderConfig to the YAML ProviderEntry format. */
function toProviderEntry(pc: ProviderConfig): ProviderEntry {
    return {
        ...(pc.name !== pc.id ? { name: pc.name } : {}),
        domains: pc.domains,
        entryUrl: pc.entryUrl,
        strategy: pc.strategy as ProviderEntry['strategy'],
        extract: pc.extract,
        apply: pc.apply,
        ...(pc.required?.length ? { required: pc.required } : {}),
        ...(pc.cookiePaths?.length ? { cookiePaths: pc.cookiePaths } : {}),
        ...(pc.ttl ? { ttl: pc.ttl } : {}),
        ...(pc.proxy ? { proxy: pc.proxy } : {}),
        ...(pc.networkProxy ? { networkProxy: pc.networkProxy } : {}),
    };
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

    // Step 1: Resolve provider (auto-provision if URL)
    let provider;
    try {
        provider = auth.resolveProvider(url);
    } catch (e) {
        if (e instanceof ProviderNotFoundError) {
            process.stderr.write(
                `Error: No provider found matching "${url}". Run "sig providers" to see configured providers.\n`,
            );
            process.exitCode = ExitCode.GENERAL_ERROR;
            return;
        }
        throw e;
    }

    const networkProxy =
        typeof flags['network-proxy'] === 'string' ? flags['network-proxy'] : undefined;

    // Apply networkProxy to auto-provisioned providers so it persists in config
    if (networkProxy !== undefined && provider.autoProvisioned) {
        provider.networkProxy = networkProxy;
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

    // Step 3: If not --force, check stored creds
    if (flags.force !== true) {
        process.stderr.write(`  [1/2] Checking stored credentials...`);
        const status = await auth.getStatus(provider.id);

        if (status.valid) {
            process.stderr.write(` valid (skipping login)\n`);
            const credResult = await auth.getCredentials(provider.id);
            if (isOk(credResult)) {
                process.stdout.write(
                    formatJson({
                        provider: provider.id,
                        strategy: provider.strategy,
                        ...(status.expiresAt ? { expiresAt: status.expiresAt } : {}),
                        method: 'stored',
                    }) + '\n',
                );
                return;
            }
        }

        if (status.configured && !status.valid) {
            process.stderr.write(` expired\n`);
        } else if (!status.configured) {
            process.stderr.write(` not found\n`);
        }
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

    // Step 5: Authenticate via forceReauth (clears stored and re-extracts)
    process.stderr.write(`  [2/2] Authenticating with "${provider.name}"...\n`);
    const result = await auth.forceReauth(
        provider.id,
        networkProxy !== undefined ? { networkProxy } : undefined,
    );
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
    if (provider.autoProvisioned) {
        await addProviderToConfig(provider.id, toProviderEntry(provider));
    }

    const status = await auth.getStatus(provider.id);
    await logAuditEvent({
        action: AuditAction.LOGIN,
        status: AuditStatus.SUCCESS,
        provider: provider.id,
        metadata: { strategy: provider.strategy },
    });
    process.stderr.write(`Authenticated with "${provider.name}".\n`);
    process.stdout.write(
        formatJson({
            provider: provider.id,
            strategy: provider.strategy,
            ...(status.expiresAt ? { expiresAt: status.expiresAt } : {}),
        }) + '\n',
    );
}
