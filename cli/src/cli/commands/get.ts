import type { AuthDeps } from '../../deps.js';
import { isOk } from '../../core/result.js';
import { formatJson, formatCredentialHeaders } from '../formatters.js';
import { ExitCode } from '../exit-codes.js';

const PRIMARY_HEADERS = ['cookie', 'authorization'];

export async function runGet(
  positionals: string[],
  flags: Record<string, string | boolean | string[]>,
  deps: AuthDeps,
): Promise<void> {
  const target = positionals[0];
  if (!target) {
    process.stderr.write('Usage: sig get <provider|url>\n');
    process.exitCode = ExitCode.GENERAL_ERROR;
    return;
  }

  // Unified resolution: try ID → name → URL/domain
  const resolved = deps.authManager.providerRegistry.resolveFlexible(target);
  let providerId: string;
  let credential;

  if (resolved) {
    providerId = resolved.id;
    const result = await deps.authManager.getCredentials(providerId);
    if (!isOk(result)) {
      process.stderr.write(`Error: ${result.error.message}\n`);
      if (result.error.code === 'BROWSER_UNAVAILABLE') {
        process.stderr.write(`Hint: Run "sig login ${target} --token <token>" or "sig sync pull" to get credentials.\n`);
      }
      process.exitCode = result.error.code === 'CREDENTIAL_NOT_FOUND' ? ExitCode.CREDENTIAL_NOT_FOUND : ExitCode.GENERAL_ERROR;
      return;
    }
    credential = result.value;
  } else {
    // Fall through to URL-based resolution (with auto-provisioning) for URL-like inputs
    const isUrl = target.includes('.') || target.startsWith('http');
    if (!isUrl) {
      process.stderr.write(`Error: No provider found matching "${target}".\n`);
      process.exitCode = ExitCode.PROVIDER_NOT_FOUND;
      return;
    }
    const result = await deps.authManager.getCredentialsByUrl(target);
    if (!isOk(result)) {
      process.stderr.write(`Error: ${result.error.message}\n`);
      if (result.error.code === 'BROWSER_UNAVAILABLE') {
        process.stderr.write(`Hint: Run "sig login ${target} --token <token>" or "sig sync pull" to get credentials.\n`);
      }
      process.exitCode = result.error.code === 'PROVIDER_NOT_FOUND' ? ExitCode.PROVIDER_NOT_FOUND : ExitCode.CREDENTIAL_NOT_FOUND;
      return;
    }
    providerId = result.value.provider.id;
    credential = result.value.credential;
  }

  const headers = deps.authManager.applyToRequest(providerId, credential);
  const entries = Object.entries(headers);

  if (entries.length === 0) {
    process.stderr.write(`Error: No credential headers produced for "${providerId}".\n`);
    process.exitCode = ExitCode.CREDENTIAL_NOT_FOUND;
    return;
  }

  const primaryEntry = entries.find(([name]) => PRIMARY_HEADERS.includes(name.toLowerCase()))
    ?? entries[0];
  const [primaryHeaderName, primaryHeaderValue] = primaryEntry;

  const xHeaders: Record<string, string> = {};
  for (const [name, value] of entries) {
    if (name !== primaryHeaderName) {
      xHeaders[name] = value;
    }
  }

  const format = (flags.format as string) ?? 'json';

  switch (format) {
    case 'json': {
      const output: Record<string, unknown> = {
        provider: providerId,
        credential: primaryHeaderValue,
        headerName: primaryHeaderName,
        type: credential.type,
      };
      if (Object.keys(xHeaders).length > 0) output.xHeaders = xHeaders;
      process.stdout.write(formatJson(output) + '\n');
      break;
    }
    case 'header': {
      process.stdout.write(formatCredentialHeaders(headers) + '\n');
      break;
    }
    case 'value': {
      process.stdout.write(primaryHeaderValue + '\n');
      break;
    }
    default: {
      process.stderr.write(`Unknown format: ${format}\n`);
      process.exitCode = ExitCode.GENERAL_ERROR;
    }
  }
}
