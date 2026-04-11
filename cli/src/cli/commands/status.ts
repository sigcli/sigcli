import type { AuthDeps } from '../../deps.js';
import type { FormatTableOptions } from '../formatters.js';
import { formatJson, formatTable, formatExpiry, formatStatusIndicator } from '../formatters.js';
import type { ProviderStatus } from '../../core/types.js';

function buildRows(statuses: ProviderStatus[]): Record<string, string>[] {
  const showName = statuses.some(s => s.name !== s.id);
  return statuses.map(s => {
    const row: Record<string, string> = { id: s.id };
    if (showName) row.name = s.name;
    row.strategy = s.strategy;
    row.status = formatStatusIndicator(s.valid, s.credentialType !== undefined);
    row.type = s.credentialType ?? '-';
    row.expires = s.expiresInMinutes !== undefined ? formatExpiry(s.expiresInMinutes) : '-';
    return row;
  });
}

export async function runStatus(
  positionals: string[],
  flags: Record<string, string | boolean>,
  deps: AuthDeps,
): Promise<void> {
  const providerId = (flags.provider as string) ?? positionals[0];
  const format = (flags.format as string) ?? (process.stdout.isTTY ? 'table' : 'json');
  const tableOptions: FormatTableOptions | undefined =
    flags.full ? undefined : { maxColumnWidths: { id: 30 } };

  if (providerId) {
    const resolved = deps.authManager.providerRegistry.resolveFlexible(providerId);
    const status = await deps.authManager.getStatus(resolved?.id ?? providerId);
    if (format === 'json') {
      process.stdout.write(formatJson(status) + '\n');
    } else {
      process.stdout.write(formatTable(buildRows([status]), tableOptions) + '\n');
    }
    return;
  }

  const statuses = await deps.authManager.getAllStatus();

  if (format === 'json') {
    process.stdout.write(formatJson(statuses) + '\n');
  } else {
    if (statuses.length === 0) {
      process.stderr.write('No providers configured.\n');
      return;
    }
    process.stdout.write(formatTable(buildRows(statuses), tableOptions) + '\n');
  }
}
