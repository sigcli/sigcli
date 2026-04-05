import type { AuthDeps } from '../../deps.js';
import type { ApiKeyCredential, BasicCredential } from '../../core/types.js';
import type { StrategyName } from '../../config/schema.js';
import { buildStrategyConfig } from '../../config/validator.js';
import { isOk } from '../../core/result.js';
import { formatJson } from '../formatters.js';

export async function runLogin(
  positionals: string[],
  flags: Record<string, string | boolean>,
  deps: AuthDeps,
): Promise<void> {
  const url = positionals[0];
  if (!url) {
    process.stderr.write('Usage: sig login <url>\n');
    process.exitCode = 1;
    return;
  }

  const baseProvider = deps.authManager.resolveProvider(url);

  const hasOverrides = flags.strategy !== undefined;
  const provider = hasOverrides
    ? { ...baseProvider }
    : baseProvider;

  if (typeof flags.strategy === 'string') {
    const strategyName = flags.strategy as StrategyName;
    provider.strategy = strategyName;
    provider.strategyConfig = buildStrategyConfig(strategyName);
  }

  if (hasOverrides) {
    deps.authManager.providerRegistry.register(provider);
  }

  if (typeof flags.token === 'string') {
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
    process.stderr.write(`Token stored for "${provider.name}" (${provider.id}).\n`);
    process.stdout.write(formatJson({ provider: provider.id, type: 'api-key' }) + '\n');
    return;
  }

  if (typeof flags.username === 'string' && typeof flags.password === 'string') {
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
    process.stderr.write(`Basic auth credentials stored for "${provider.name}" (${provider.id}).\n`);
    process.stdout.write(formatJson({ provider: provider.id, type: 'basic' }) + '\n');
    return;
  }

  process.stderr.write(`Authenticating with "${provider.name}" via browser...\n`);
  const result = await deps.authManager.forceReauth(provider.id);
  if (!isOk(result)) {
    process.stderr.write(`Authentication failed: ${result.error.message}\n`);
    process.exit(1);
  }

  const status = await deps.authManager.getStatus(provider.id);
  process.stderr.write(`Authenticated with "${provider.name}".\n`);
  process.stdout.write(formatJson({
    provider: provider.id,
    type: result.value.type,
    ...(status.expiresAt ? { expiresAt: status.expiresAt } : {}),
  }) + '\n');
}
