import type { AuthDeps } from '../../deps.js';
import { isOk } from '../../core/result.js';
import { buildUserAgent } from '../../utils/http.js';
import { formatJson } from '../formatters.js';
import { HttpHeader } from '../../core/constants.js';
import { ExitCode } from '../exit-codes.js';
import { applyInjectRules } from '../../proxy/inject.js';
import { logAuditEvent, AuditAction, AuditStatus } from '../../audit/audit-log.js';

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
        await logAuditEvent({
            action: AuditAction.REQUEST,
            status: AuditStatus.FAILURE,
            metadata: { url, error: result.error.message },
        });
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

    const body = flags.body as string | undefined;
    const contentType = requestHeaders[HttpHeader.CONTENT_TYPE];
    if (body && ['POST', 'PUT', 'PATCH'].includes(httpMethod)) {
        if (!contentType) {
            requestHeaders[HttpHeader.CONTENT_TYPE] = 'application/json';
        }
    }

    // Apply provider inject rules (header/body/query injection from proxy config)
    let finalUrl = url;
    let finalBody: string | undefined = body;
    const injectRules = provider.proxy?.inject;
    if (injectRules?.length) {
        const bodyBuffer = body ? Buffer.from(body) : undefined;
        const ct = requestHeaders[HttpHeader.CONTENT_TYPE];
        const injected = applyInjectRules(
            injectRules,
            credential,
            requestHeaders as Record<string, string | number | string[]>,
            bodyBuffer,
            ct,
            url,
        );
        // Merge injected headers back
        for (const [key, value] of Object.entries(injected.headers)) {
            if (value != null) {
                requestHeaders[key] = String(value);
            } else {
                delete requestHeaders[key];
            }
        }
        finalUrl = injected.url;
        finalBody = injected.body ? injected.body.toString() : finalBody;
    }

    const fetchOptions: RequestInit = { method: httpMethod, headers: requestHeaders };
    if (finalBody && ['POST', 'PUT', 'PATCH'].includes(httpMethod)) {
        fetchOptions.body = finalBody;
    }

    try {
        const response = await fetch(finalUrl, fetchOptions);
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

        await logAuditEvent({
            action: AuditAction.REQUEST,
            status: response.ok ? AuditStatus.SUCCESS : AuditStatus.FAILURE,
            provider: provider.id,
            metadata: {
                url: finalUrl,
                method: httpMethod,
                statusCode: response.status,
                injectedRules: injectRules?.length ?? 0,
            },
        });

        if (!response.ok) {
            process.exitCode = ExitCode.GENERAL_ERROR;
        }
    } catch (e: unknown) {
        await logAuditEvent({
            action: AuditAction.REQUEST,
            status: AuditStatus.FAILURE,
            provider: provider.id,
            metadata: { url: finalUrl, method: httpMethod, error: (e as Error).message },
        });
        process.stderr.write(`Request failed: ${(e as Error).message}\n`);
        process.exitCode = ExitCode.GENERAL_ERROR;
    }
}
