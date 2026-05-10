import { isOk, type ProviderConfig } from '../types/index.js';
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
    const input = positionals[0];
    if (!input) {
        process.stderr.write('Usage: sig login <provider|url|name>\n');
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    const strategyFlag = typeof flags.strategy === 'string' ? flags.strategy : undefined;
    const setValues = parseSetFlags(flags);

    // Resolve or auto-provision provider
    const provider = resolveOrProvision(input, strategyFlag, auth);
    if (!provider) {
        process.stderr.write(
            `Error: No provider found matching "${input}". Run "sig providers" to see configured providers.\n`,
        );
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    applyFlags(provider, flags);

    // Check browser availability
    if (!auth.browserAvailable && provider.strategy === 'browser' && !setValues) {
        process.stderr.write(
            `Browser is not available on this machine.\n` +
                `Provider "${provider.name}" uses browser strategy which requires a browser.\n\n` +
                `Alternatives:\n` +
                `  sig sync pull              Pull credentials from a machine with a browser\n`,
        );
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    // Authenticate
    process.stderr.write(`[sig] Authenticating with "${provider.name}"...\n`);
    const result = await auth.getExtractedCreds(provider.id, {
        force: true,
        ...(setValues ? { setValues } : {}),
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

function resolveOrProvision(
    input: string,
    strategyFlag: string | undefined,
    auth: AuthManager,
): ProviderConfig | null {
    const resolved = auth.resolveProvider(input);
    if (isOk(resolved)) return resolved.value;

    if (!strategyFlag) return null;

    const provider = createProviderByName(input, strategyFlag);
    auth.providerRegistry.register(provider);
    auth.logger.info(`auto-provisioned "${input}" with strategy=${strategyFlag}`);
    return provider;
}

function createProviderByName(name: string, strategy: string): ProviderConfig {
    const provider: ProviderConfig = {
        id: name,
        name,
        domains: [],
        entryUrl: '',
        strategy,
        extract: [],
        apply: [],
        autoProvisioned: true,
    };

    if (strategy === 'oauth2') {
        provider.extract = [
            { from: 'prompt', as: 'client_id', match: 'client_id' },
            { from: 'prompt', as: 'client_secret', match: 'client_secret' },
            { from: 'prompt', as: 'token_url', match: 'token_url' },
        ];
        provider.exchange = { grant_type: 'client_credentials', as: 'access_token' };
        provider.apply = [{ in: 'header', name: 'Authorization', value: 'Bearer ${access_token}' }];
    }

    return provider;
}

function applyFlags(
    provider: ProviderConfig,
    flags: Record<string, string | boolean | string[]>,
): void {
    if (!provider.autoProvisioned) return;

    if (typeof flags['network-proxy'] === 'string') {
        provider.networkProxy = flags['network-proxy'];
    }
    if (typeof flags['mode'] === 'string') {
        provider.loginMode = flags['mode'] as ProviderConfig['loginMode'];
    }
    if (typeof flags.strategy === 'string') {
        provider.strategy = flags.strategy;
    }
    if (typeof flags.as === 'string') {
        provider.name = flags.as;
        provider.id = flags.as;
    }
}

/**
 * Parse --set flags into a key-value map.
 * Accepts: --set key=value (single or repeated)
 */
function parseSetFlags(
    flags: Record<string, string | boolean | string[]>,
): Record<string, string> | undefined {
    const raw = flags['set'];
    if (!raw) return undefined;

    const entries = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
    if (entries.length === 0) return undefined;

    const result: Record<string, string> = {};
    for (const entry of entries) {
        const eqIdx = entry.indexOf('=');
        if (eqIdx === -1) continue;
        const key = entry.slice(0, eqIdx);
        const value = entry.slice(eqIdx + 1);
        if (key) result[key] = value;
    }

    return Object.keys(result).length > 0 ? result : undefined;
}
