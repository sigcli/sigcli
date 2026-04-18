import type { AuthDeps } from '../../deps.js';
import { isOk } from '../../core/result.js';
import { buildUserAgent } from '../../utils/http.js';
import { formatJson } from '../formatters.js';
import { HttpHeader } from '../../core/constants.js';
import { ExitCode } from '../exit-codes.js';

export async function runRequest(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
    deps: AuthDeps,
): Promise<void> {
    const url = positionals[0];
    if (!url) {
        process.stderr.write(
            'Usage: sig request <url> [--method GET] [--header "Name: Value"] [--body \'{}\']\n',
        );
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    const result = await deps.authManager.getCredentialsByUrl(url);
    if (!isOk(result)) {
        process.stderr.write(`Auth error: ${result.error.message}\n`);
        if (result.error.code === 'BROWSER_UNAVAILABLE') {
            process.stderr.write(
                `Hint: Run "sig login ${url} --token <token>" or "sig sync pull" to get credentials.\n`,
            );
        }
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    const { provider, credential } = result.value;
    const authHeaders = deps.authManager.applyToRequest(provider.id, credential);

    const requestHeaders: Record<string, string> = {
        [HttpHeader.USER_AGENT]: buildUserAgent(),
        ...authHeaders,
    };

    // Parse --header flags (may appear multiple times)
    const rawHeaders = flags.header;
    const headerList: string[] = Array.isArray(rawHeaders)
        ? rawHeaders
        : typeof rawHeaders === 'string'
          ? [rawHeaders]
          : [];
    for (const h of headerList) {
        const idx = h.indexOf(':');
        if (idx > 0) {
            requestHeaders[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
        }
    }

    const httpMethod = ((flags.method as string) ?? 'GET').toUpperCase();
    const fetchOptions: RequestInit = { method: httpMethod, headers: requestHeaders };

    const body = flags.body as string | undefined;
    if (body && ['POST', 'PUT', 'PATCH'].includes(httpMethod)) {
        fetchOptions.body = body;
        if (!requestHeaders[HttpHeader.CONTENT_TYPE]) {
            requestHeaders[HttpHeader.CONTENT_TYPE] = 'application/json';
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
                response.headers.forEach((value, key) => {
                    responseHeaders[key] = value;
                });
                process.stdout.write(
                    formatJson({
                        status: response.status,
                        statusText: response.statusText,
                        headers: responseHeaders,
                        body: formattedBody,
                    }) + '\n',
                );
                break;
            }
        }

        if (!response.ok) {
            process.exitCode = ExitCode.GENERAL_ERROR;
        }
    } catch (e: unknown) {
        process.stderr.write(`Request failed: ${(e as Error).message}\n`);
        process.exitCode = ExitCode.GENERAL_ERROR;
    }
}
