import type { AuthDeps } from '../../deps.js';
import type { ApiKeyCredential, BasicCredential, Cookie, CookieCredential, ProviderConfig } from '../../core/types.js';
import type { ProviderEntry, StrategyName } from '../../config/schema.js';
import { buildStrategyConfig } from '../../config/validator.js';
import { addProviderToConfig } from '../../config/loader.js';
import { isOk } from '../../core/result.js';
import { formatJson } from '../formatters.js';
import { ProviderNotFoundError } from '../../core/errors.js';

/** Convert runtime ProviderConfig to the YAML ProviderEntry format. */
function toProviderEntry(pc: ProviderConfig): ProviderEntry {
  const { strategy: _s, ...strategyRest } = pc.strategyConfig;
  return {
    ...(pc.name !== pc.id ? { name: pc.name } : {}),
    domains: pc.domains,
    ...(pc.entryUrl ? { entryUrl: pc.entryUrl } : {}),
    strategy: pc.strategy as StrategyName,
    ...(Object.keys(strategyRest).length > 0 ? { config: strategyRest } : {}),
    ...(pc.acceptedCredentialTypes ? { acceptedCredentialTypes: pc.acceptedCredentialTypes } : {}),
    ...(pc.xHeaders ? { xHeaders: pc.xHeaders } : {}),
    ...(pc.forceVisible !== undefined ? { forceVisible: pc.forceVisible } : {}),
  };
}

function parseCookieString(raw: string, domain: string): Cookie[] {
  return raw.split(';').map((pair) => {
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
  }).filter((c) => c.name.length > 0);
}

export async function runLogin(
  positionals: string[],
  flags: Record<string, string | boolean>,
  deps: AuthDeps,
): Promise<void> {
  const url = positionals[0];
  if (!url) {
    process.stderr.write('Usage: sig login <provider|url>\n');
    process.exitCode = 1;
    return;
  }

  let baseProvider;
  try {
    baseProvider = deps.authManager.resolveProvider(url);
  } catch (e) {
    if (e instanceof ProviderNotFoundError) {
      process.stderr.write(`Error: No provider found matching "${url}". Run "sig providers" to see configured providers.\n`);
      process.exitCode = 1;
      return;
    }
    throw e;
  }

  const hasOverrides = flags.strategy !== undefined || typeof flags.as === 'string';
  const provider = hasOverrides
    ? { ...baseProvider }
    : baseProvider;

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
    if (provider.autoProvisioned && provider.strategy !== 'api-token') {
      provider.strategy = 'api-token';
      provider.strategyConfig = buildStrategyConfig('api-token');
    }

    // Read headerName/headerPrefix from the typed strategy config if api-token
    const headerName = provider.strategyConfig.strategy === 'api-token'
      ? provider.strategyConfig.headerName ?? 'Authorization'
      : 'Authorization';
    const headerPrefix = provider.strategyConfig.strategy === 'api-token'
      ? provider.strategyConfig.headerPrefix ?? 'Bearer'
      : 'Bearer';

    const credential: ApiKeyCredential = {
      type: 'api-key',
      key: flags.token,
      headerName,
      headerPrefix,
    };
    const result = await deps.authManager.setCredential(provider.id, credential);
    if (!isOk(result)) {
      process.stderr.write(`Error: ${result.error.message}\n`);
      process.exitCode = 1;
      return;
    }
    if (provider.autoProvisioned) {
      await addProviderToConfig(provider.id, toProviderEntry(provider));
    }
    process.stderr.write(`Token stored for "${provider.name}" (${provider.id}).\n`);
    process.stdout.write(formatJson({ provider: provider.id, type: 'api-key' }) + '\n');
    return;
  }

  if (typeof flags.cookie === 'string') {
    let domain: string;
    try {
      domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    } catch {
      process.stderr.write(`Error: Invalid URL "${url}"\n`);
      process.exitCode = 1;
      return;
    }
    const cookies = parseCookieString(flags.cookie, domain);
    if (cookies.length === 0) {
      process.stderr.write('Error: No valid cookies found in the provided string.\n');
      process.exitCode = 1;
      return;
    }
    const credential: CookieCredential = {
      type: 'cookie',
      cookies,
      obtainedAt: new Date().toISOString(),
    };
    const result = await deps.authManager.setCredential(provider.id, credential);
    if (!isOk(result)) {
      process.stderr.write(`Error: ${result.error.message}\n`);
      process.exitCode = 1;
      return;
    }
    if (provider.autoProvisioned) {
      await addProviderToConfig(provider.id, toProviderEntry(provider));
    }
    process.stderr.write(`Cookie stored for "${provider.name}" (${provider.id}) — ${cookies.length} cookie(s).\n`);
    process.stdout.write(formatJson({ provider: provider.id, type: 'cookie', count: cookies.length }) + '\n');
    return;
  }

  if (typeof flags.username === 'string' && typeof flags.password === 'string') {
    // Align strategy with credential type for auto-provisioned providers
    if (provider.autoProvisioned && provider.strategy !== 'basic') {
      provider.strategy = 'basic';
      provider.strategyConfig = buildStrategyConfig('basic');
    }

    const credential: BasicCredential = {
      type: 'basic',
      username: flags.username,
      password: flags.password,
    };
    const result = await deps.authManager.setCredential(provider.id, credential);
    if (!isOk(result)) {
      process.stderr.write(`Error: ${result.error.message}\n`);
      process.exitCode = 1;
      return;
    }
    if (provider.autoProvisioned) {
      await addProviderToConfig(provider.id, toProviderEntry(provider));
    }
    process.stderr.write(`Basic auth credentials stored for "${provider.name}" (${provider.id}).\n`);
    process.stdout.write(formatJson({ provider: provider.id, type: 'basic' }) + '\n');
    return;
  }

  // Check if browser is available for strategies that require it
  const browserStrategies = new Set(['cookie', 'oauth2']);
  if (!deps.browserAvailable && browserStrategies.has(provider.strategy)) {
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
    process.exitCode = 1;
    return;
  }

  process.stderr.write(`Authenticating with "${provider.name}" via browser...\n`);
  const result = await deps.authManager.forceReauth(provider.id);
  if (!isOk(result)) {
    process.stderr.write(`Authentication failed: ${result.error.message}\n`);
    process.exitCode = 1;
    return;
  }

  // Persist auto-provisioned provider to config.yaml after successful auth
  if (provider.autoProvisioned) {
    await addProviderToConfig(provider.id, toProviderEntry(provider));
  }

  const status = await deps.authManager.getStatus(provider.id);
  process.stderr.write(`Authenticated with "${provider.name}".\n`);
  process.stdout.write(formatJson({
    provider: provider.id,
    type: result.value.type,
    ...(status.expiresAt ? { expiresAt: status.expiresAt } : {}),
  }) + '\n');
}
