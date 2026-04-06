import type { AuthDeps } from '../../deps.js';
import { isOk } from '../../core/result.js';
import { buildUserAgent } from '../../utils/http.js';
import { formatJson } from '../formatters.js';

export async function runRequest(
  positionals: string[],
  flags: Record<string, string | boolean>,
  deps: AuthDeps,
): Promise<void> {
  const url = positionals[0];
  if (!url) {
    process.stderr.write('Usage: sig request <url> [--method GET] [--header "Name: Value"] [--body \'{}\']\n');
    process.exitCode = 1;
    return;
  }

  const result = await deps.authManager.getCredentialsByUrl(url);
  if (!isOk(result)) {
    process.stderr.write(`Auth error: ${result.error.message}\n`);
    if (result.error.code === 'BROWSER_UNAVAILABLE') {
      process.stderr.write(`Hint: Run "sig login ${url} --token <token>" or "sig sync pull" to get credentials.\n`);
    }
    process.exitCode = 1;
    return;
  }

  const { provider, credential } = result.value;
  const authHeaders = deps.authManager.applyToRequest(provider.id, credential);

  const requestHeaders: Record<string, string> = {
    'User-Agent': buildUserAgent(),
    ...authHeaders,
  };

  // Parse --header flags (may appear multiple times via positionals workaround, or as single value)
  if (typeof flags.header === 'string') {
    const idx = flags.header.indexOf(':');
    if (idx > 0) {
      requestHeaders[flags.header.slice(0, idx).trim()] = flags.header.slice(idx + 1).trim();
    }
  }

  const httpMethod = ((flags.method as string) ?? 'GET').toUpperCase();
  const fetchOptions: RequestInit = { method: httpMethod, headers: requestHeaders };

  const body = flags.body as string | undefined;
  if (body && ['POST', 'PUT', 'PATCH'].includes(httpMethod)) {
    fetchOptions.body = body;
    if (!requestHeaders['Content-Type']) {
      requestHeaders['Content-Type'] = 'application/json';
    }
  }

  try {
    const response = await fetch(url, fetchOptions);
    const responseBody = await response.text();

    let formattedBody: string;
    try {
      formattedBody = JSON.stringify(JSON.parse(responseBody), null, 2);
    } catch {
      formattedBody = responseBody;
    }

    const format = (flags.format as string) ?? 'json';

    switch (format) {
      case 'body':
        process.stdout.write(formattedBody + '\n');
        break;
      case 'headers': {
        process.stdout.write(`${response.status} ${response.statusText}\n`);
        response.headers.forEach((value, key) => {
          process.stdout.write(`${key}: ${value}\n`);
        });
        break;
      }
      case 'json':
      default: {
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => { responseHeaders[key] = value; });
        process.stdout.write(formatJson({
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: formattedBody,
        }) + '\n');
        break;
      }
    }

    if (!response.ok) {
      process.exitCode = 1;
    }
  } catch (e: unknown) {
    process.stderr.write(`Request failed: ${(e as Error).message}\n`);
    process.exitCode = 1;
  }
}
