import { HttpHeader, isErr, isOk } from '../types/index.js';
import { ExitCode } from '../utils/exit-codes.js';
import { formatJson } from '../utils/formatters.js';
import { buildUserAgent } from '../utils/http.js';
import { AuditAction, AuditStatus, logAuditEvent } from '../audit/audit-log.js';
import type { AuthManager } from '../auth-manager.js';

export async function runRequest(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
    auth: AuthManager,
): Promise<void> {
    const url = positionals[0];
    if (!url) {
        process.stderr.write(
            'Usage: sig request <url> [--method GET] [--header "Name: Value"] [--body \'{}\']\n\nCredentials stay internal — never exposed to subprocesses, env vars, or shell history.\nMore secure than "sig run" or "sig get" for one-off API calls.\n',
        );
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    const resolveResult = auth.resolveProvider(url);
    if (isErr(resolveResult)) {
        process.stderr.write(`Auth error: ${resolveResult.error.message}\n`);
        await logAuditEvent({
            action: AuditAction.REQUEST,
            status: AuditStatus.FAILURE,
            metadata: { url, error: resolveResult.error.message },
        });
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }
    const provider = resolveResult.value;

    const credResult = await auth.getExtractedCreds(provider.id);
    if (!isOk(credResult)) {
        process.stderr.write(`Auth error: ${credResult.error.message}\n`);
        if (credResult.error.code === 'BROWSER_UNAVAILABLE') {
            process.stderr.write(
                `Hint: Run "sig login ${url} --token <token>" or "sig sync pull" to get credentials.\n`,
            );
        }
        await logAuditEvent({
            action: AuditAction.REQUEST,
            status: AuditStatus.FAILURE,
            metadata: { url, error: credResult.error.message },
        });
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    const credentials = credResult.value;
    const applyResult = auth.applyExtractedCreds(provider.apply, credentials);

    const requestHeaders: Record<string, string> = {
        [HttpHeader.USER_AGENT]: buildUserAgent(),
        ...applyResult.headers,
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

    // Apply query param modifications
    let finalUrl = url;
    if (applyResult.query && Object.keys(applyResult.query).length > 0) {
        const parsed = new URL(url);
        for (const [k, v] of Object.entries(applyResult.query)) {
            parsed.searchParams.set(k, v);
        }
        finalUrl = parsed.toString();
    }

    // Apply body modifications
    let finalBody: string | undefined = body;
    if (applyResult.body && Object.keys(applyResult.body).length > 0) {
        const ct = (requestHeaders[HttpHeader.CONTENT_TYPE] ?? '')
            .toLowerCase()
            .split(';')[0]
            .trim();
        if (ct === 'application/x-www-form-urlencoded') {
            const params = new URLSearchParams(finalBody ?? '');
            for (const [k, v] of Object.entries(applyResult.body)) {
                params.set(k, v);
            }
            finalBody = params.toString();
        } else {
            let json: Record<string, unknown> = {};
            try {
                json = JSON.parse(finalBody ?? '{}') as Record<string, unknown>;
            } catch {
                // keep empty
            }
            for (const [k, v] of Object.entries(applyResult.body)) {
                json[k] = v;
            }
            finalBody = JSON.stringify(json);
        }
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
