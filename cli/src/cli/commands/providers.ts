import type { AuthDeps } from '../../deps.js';
import { formatJson, formatTable } from '../formatters.js';

export async function runProviders(
  positionals: string[],
  flags: Record<string, string | boolean>,
  deps: AuthDeps,
): Promise<void> {
  const format = (flags.format as string) ?? (process.stdout.isTTY ? 'table' : 'json');
  const providers = deps.authManager.providerRegistry.list();

  const statuses = await Promise.all(
    providers.map(p => deps.authManager.getStatus(p.id)),
  );

  if (format === 'json') {
    const output = statuses.map(s => ({
      id: s.id,
      name: s.name,
      strategy: s.strategy,
      configured: s.configured,
      valid: s.valid,
      credentialType: s.credentialType ?? null,
    }));
    process.stdout.write(formatJson(output) + '\n');
  } else {
    if (statuses.length === 0) {
      process.stderr.write('No providers configured.\n');
      return;
    }
    const rows = statuses.map(s => ({
      id: s.id,
      name: s.name,
      strategy: s.strategy,
      status: s.valid ? 'authenticated' : 'not authenticated',
    }));
    process.stdout.write(formatTable(rows) + '\n');
  }
}
