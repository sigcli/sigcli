import type { AuthDeps } from '../../deps.js';
import type {
    ApiKeyCredential,
    BasicCredential,
    Cookie,
    CookieCredential,
    ProviderConfig,
} from '../../core/types.js';
import type { ProviderEntry, StrategyName } from '../../config/schema.js';
import { buildStrategyConfig } from '../../config/validator.js';
import { addProviderToConfig } from '../../config/loader.js';
import { isOk } from '../../core/result.js';
import { formatJson } from '../formatters.js';
import { ProviderNotFoundError } from '../../core/errors.js';
import {
    BROWSER_REQUIRED_STRATEGIES,
    HttpHeader,
    AuthScheme,
    StrategyName as StrategyNameConst,
    CredentialTypeName,
} from '../../core/constants.js';
import { ExitCode } from '../exit-codes.js';

/** Convert runtime ProviderConfig to the YAML ProviderEntry format. */
function toProviderEntry(pc: ProviderConfig): ProviderEntry {
    const { strategy: _s, ...strategyRest } = pc.strategyConfig;
    return {
        ...(pc.name !== pc.id ? { name: pc.name } : {}),
        domains: pc.domains,
        entryUrl: pc.entryUrl ?? `https://${pc.domains[0]}/`,
        strategy: pc.strategy as StrategyName,
        ...(Object.keys(strategyRest).length > 0 ? { config: strategyRest } : {}),
        ...(pc.acceptedCredentialTypes
            ? { acceptedCredentialTypes: pc.acceptedCredentialTypes }
            : {}),
        ...(pc.xHeaders ? { xHeaders: pc.xHeaders } : {}),
        ...(pc.forceVisible !== undefined ? { forceVisible: pc.forceVisible } : {}),
    };
}

function parseCookieString(raw: string, domain: string): Cookie[] {
    return raw
        .split(';')
        .map((pair) => {
            const idx = pair.indexOf('=');
            const name = (idx > -1 ? pair.slice(0, idx) : pair).trim();
            const value = idx > -1 ? pair.slice(idx + 1).trim() : '';
            return {
                name,
                value,
                domain,
                path: '/',
                expires: -1,
                httpOnly: false,
                secure: true,
            };
        })
        .filter((c) => c.name.length > 0);
}

export async function runLogin(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
    deps: AuthDeps,
): Promise<void> {
    const url = positionals[0];
    if (!url) {
        process.stderr.write('Usage: sig login <provider|url>\n');
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    let baseProvider;
    try {
        baseProvider = deps.authManager.resolveProvider(url);
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

    const hasOverrides = flags.strategy !== undefined || typeof flags.as === 'string';
    const provider = hasOverrides ? { ...baseProvider } : baseProvider;

    // --as <id>: override the provider ID (useful for auto-provisioned providers)
    if (typeof flags.as === 'string') {
        const oldId = provider.id;
        provider.id = flags.as;
        if (provider.name === oldId) {
            provider.name = flags.as;
        }
    }

    if (typeof flags.strategy === 'string') {
        const strategyName = flags.strategy as StrategyName;
        provider.strategy = strategyName;
        provider.strategyConfig = buildStrategyConfig(strategyName);
    }

    if (hasOverrides) {
        deps.authManager.providerRegistry.register(provider);
    }

    if (typeof flags.token === 'string') {
        // Align strategy with credential type for auto-provisioned providers
        if (provider.autoProvisioned && provider.strategy !== StrategyNameConst.API_TOKEN) {
            provider.strategy = StrategyNameConst.API_TOKEN;
            provider.strategyConfig = buildStrategyConfig(StrategyNameConst.API_TOKEN);
        }

        // Read headerName/headerPrefix from the typed strategy config if api-token
        const headerName =
            provider.strategyConfig.strategy === StrategyNameConst.API_TOKEN
                ? (provider.strategyConfig.headerName ?? HttpHeader.AUTHORIZATION)
                : HttpHeader.AUTHORIZATION;
        const headerPrefix =
            provider.strategyConfig.strategy === StrategyNameConst.API_TOKEN
                ? (provider.strategyConfig.headerPrefix ?? AuthScheme.BEARER)
                : AuthScheme.BEARER;

        const credential: ApiKeyCredential = {
            type: CredentialTypeName.API_KEY,
            key: flags.token,
            headerName,
            headerPrefix,
        };
        const result = await deps.authManager.setCredential(provider.id, credential);
        if (!isOk(result)) {
            process.stderr.write(`Error: ${result.error.message}\n`);
            process.exitCode = ExitCode.GENERAL_ERROR;
            return;
        }
        if (provider.autoProvisioned) {
            await addProviderToConfig(provider.id, toProviderEntry(provider));
        }
        process.stderr.write(`Token stored for "${provider.name}" (${provider.id}).\n`);
        process.stdout.write(
            formatJson({ provider: provider.id, type: CredentialTypeName.API_KEY }) + '\n',
        );
        return;
    }

    if (typeof flags.cookie === 'string') {
        let domain: string;
        try {
            domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
        } catch {
            process.stderr.write(`Error: Invalid URL "${url}"\n`);
            process.exitCode = ExitCode.GENERAL_ERROR;
            return;
        }
        const cookies = parseCookieString(flags.cookie, domain);
        if (cookies.length === 0) {
            process.stderr.write('Error: No valid cookies found in the provided string.\n');
            process.exitCode = ExitCode.GENERAL_ERROR;
            return;
        }
        const credential: CookieCredential = {
            type: CredentialTypeName.COOKIE,
            cookies,
            obtainedAt: new Date().toISOString(),
        };
        const result = await deps.authManager.setCredential(provider.id, credential);
        if (!isOk(result)) {
            process.stderr.write(`Error: ${result.error.message}\n`);
            process.exitCode = ExitCode.GENERAL_ERROR;
            return;
        }
        if (provider.autoProvisioned) {
            await addProviderToConfig(provider.id, toProviderEntry(provider));
        }
        process.stderr.write(
            `Cookie stored for "${provider.name}" (${provider.id}) — ${cookies.length} cookie(s).\n`,
        );
        process.stdout.write(
            formatJson({
                provider: provider.id,
                type: CredentialTypeName.COOKIE,
                count: cookies.length,
            }) + '\n',
        );
        return;
    }

    if (typeof flags.username === 'string' && typeof flags.password === 'string') {
        // Align strategy with credential type for auto-provisioned providers
        if (provider.autoProvisioned && provider.strategy !== StrategyNameConst.BASIC) {
            provider.strategy = StrategyNameConst.BASIC;
            provider.strategyConfig = buildStrategyConfig(StrategyNameConst.BASIC);
        }

        const credential: BasicCredential = {
            type: CredentialTypeName.BASIC,
            username: flags.username,
            password: flags.password,
        };
        const result = await deps.authManager.setCredential(provider.id, credential);
        if (!isOk(result)) {
            process.stderr.write(`Error: ${result.error.message}\n`);
            process.exitCode = ExitCode.GENERAL_ERROR;
            return;
        }
        if (provider.autoProvisioned) {
            await addProviderToConfig(provider.id, toProviderEntry(provider));
        }
        process.stderr.write(
            `Basic auth credentials stored for "${provider.name}" (${provider.id}).\n`,
        );
        process.stdout.write(
            formatJson({ provider: provider.id, type: CredentialTypeName.BASIC }) + '\n',
        );
        return;
    }

    // Cascade: check stored → refresh → browser (unless --force skips to browser)
    if (flags.force !== true) {
        process.stderr.write(`  [1/3] Checking stored credentials...`);
        const status = await deps.authManager.getStatus(provider.id);

        if (status.valid) {
            process.stderr.write(` ✓ valid (skipping login)\n`);
            const credResult = await deps.authManager.getCredentials(provider.id);
            if (isOk(credResult)) {
                process.stdout.write(
                    formatJson({
                        provider: provider.id,
                        type: credResult.value.type,
                        ...(status.expiresAt ? { expiresAt: status.expiresAt } : {}),
                        source: 'stored',
                    }) + '\n',
                );
                return;
            }
        }

        if (status.configured && !status.valid) {
            process.stderr.write(` expired\n`);
            process.stderr.write(`  [2/3] Refreshing credentials...`);
            const refreshResult = await deps.authManager.getCredentials(provider.id);
            if (isOk(refreshResult)) {
                const refreshedStatus = await deps.authManager.getStatus(provider.id);
                process.stderr.write(` ✓ refreshed\n`);
                process.stdout.write(
                    formatJson({
                        provider: provider.id,
                        type: refreshResult.value.type,
                        ...(refreshedStatus.expiresAt
                            ? { expiresAt: refreshedStatus.expiresAt }
                            : {}),
                        source: 'refreshed',
                    }) + '\n',
                );
                return;
            }
            process.stderr.write(` ✗ failed\n`);
        } else if (!status.configured) {
            process.stderr.write(` not found\n`);
        }
    }

    // Step 3: Browser fallback
    if (!deps.browserAvailable && BROWSER_REQUIRED_STRATEGIES.has(provider.strategy)) {
        process.stderr.write(
            `Browser is not available on this machine.\n` +
                `Provider "${provider.name}" uses "${provider.strategy}" strategy which requires a browser.\n\n` +
                `Alternatives:\n` +
                `  sig login <url> --cookie <string>  Provide cookies manually\n` +
                `  sig login <url> --token <token>    Provide a token directly\n` +
                `  sig sync pull                       Pull credentials from a machine with a browser\n\n` +
                `To set up sync:\n` +
                `  1. On a machine with a browser: sig login <url>\n` +
                `  2. Then: sig remote add <name> <this-host>\n` +
                `  3. Then: sig sync push <name>\n`,
        );
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    process.stderr.write(`  [3/3] Opening browser...\n`);
    process.stderr.write(`Authenticating with "${provider.name}" via browser...\n`);
    const result = await deps.authManager.forceReauth(provider.id);
    if (!isOk(result)) {
        process.stderr.write(`Authentication failed: ${result.error.message}\n`);
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    // Persist auto-provisioned provider to config.yaml after successful auth
    if (provider.autoProvisioned) {
        await addProviderToConfig(provider.id, toProviderEntry(provider));
    }

    const status = await deps.authManager.getStatus(provider.id);
    process.stderr.write(`Authenticated with "${provider.name}".\n`);
    process.stdout.write(
        formatJson({
            provider: provider.id,
            type: result.value.type,
            ...(status.expiresAt ? { expiresAt: status.expiresAt } : {}),
        }) + '\n',
    );
}
