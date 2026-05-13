import { fetch, type Response as UndiciResponse } from 'undici';

import { HttpHeader, isErr, isOk, type ProviderConfig } from '../types/index.js';
import type { ApplyResult } from '../apply/apply-engine.js';
import { isAuthenticatedResponse } from '../utils/credential-validator.js';
import { ExitCode } from '../utils/exit-codes.js';
import { formatJson } from '../utils/formatters.js';
import { buildUserAgent, createProxyDispatcher } from '../utils/http.js';
import { persistIfAutoProvisioned } from '../utils/provider-persist.js';
import { AuditAction, AuditStatus, logAuditEvent } from '../audit/audit-log.js';
import type { AuthManager } from '../auth-manager.js';

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function runRequest(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
    auth: AuthManager,
): Promise<void> {
    const url = positionals[0];
    if (!url) {
        printUsage();
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    const resolveResult = auth.resolveProvider(url);
    if (isErr(resolveResult)) {
        await failWithMessage(url, `Auth error: ${resolveResult.error.message}`, {
            url,
            error: resolveResult.error.message,
        });
        return;
    }

    const provider = resolveResult.value;
    const params = parseFlags(flags);

    auth.logger.info(`request: ${params.method} ${url} via ${provider.id}`);

    try {
        const response = await executeWithReauth(url, params, provider, auth);
        writeOutput(response, params.format);
        await logAuditEvent({
            action: AuditAction.REQUEST,
            status: response.ok ? AuditStatus.SUCCESS : AuditStatus.FAILURE,
            provider: provider.id,
            metadata: { url, method: params.method, statusCode: response.status },
        });
        if (!response.ok) process.exitCode = ExitCode.GENERAL_ERROR;
    } catch (e: unknown) {
        await handleError(e, url, provider.id, params.method);
    }
}

// ---------------------------------------------------------------------------
// Request execution with auto-reauth
// ---------------------------------------------------------------------------

interface ParsedResponse {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
}

async function executeWithReauth(
    url: string,
    params: RequestParams,
    provider: ProviderConfig,
    auth: AuthManager,
): Promise<ParsedResponse> {
    let response = await authenticatedFetch(url, params, provider, auth);
    auth.logger.info(`request: ${response.status} ${response.statusText}`);

    // Persist auto-provisioned provider after first successful credential fetch
    await persistIfAutoProvisioned(provider);

    let parsed = await toParseResponse(response);

    if (!isAuthenticatedResponse(parsed, undefined, provider.validateRule)) {
        auth.logger.info(`request: response failed auth check, re-authenticating...`);
        const reauth = await auth.getExtractedCreds(provider.id, { force: true });
        if (isOk(reauth)) {
            response = await authenticatedFetch(url, params, provider, auth);
            auth.logger.info(`request (retry): ${response.status} ${response.statusText}`);
            parsed = await toParseResponse(response);
        }
    }

    return parsed;
}

async function authenticatedFetch(
    url: string,
    params: RequestParams,
    provider: ProviderConfig,
    auth: AuthManager,
): Promise<UndiciResponse> {
    const credResult = await auth.getExtractedCreds(provider.id);
    if (!isOk(credResult)) {
        throw new CredentialError(credResult.error.message, credResult.error.code);
    }

    const applied = auth.applyExtractedCreds(provider.apply, credResult.value);
    const headers = buildHeaders(params, applied);
    const finalUrl = applyQueryParams(url, applied);
    const finalBody = applyBodyModifications(params.body, headers, applied);
    const dispatcher = createProxyDispatcher(provider.networkProxy);
    const body =
        finalBody && ['POST', 'PUT', 'PATCH'].includes(params.method) ? finalBody : undefined;

    const res = await fetch(finalUrl, { method: params.method, headers, body, dispatcher });
    return res;
}

// ---------------------------------------------------------------------------
// Request building helpers
// ---------------------------------------------------------------------------

interface RequestParams {
    method: string;
    body: string | undefined;
    format: string;
    headers: string[];
}

function parseFlags(flags: Record<string, string | boolean | string[]>): RequestParams {
    const rawHeaders = flags.header;
    const headers: string[] = Array.isArray(rawHeaders)
        ? rawHeaders
        : typeof rawHeaders === 'string'
          ? [rawHeaders]
          : [];

    return {
        method: ((flags.method as string) ?? 'GET').toUpperCase(),
        body: flags.body as string | undefined,
        format: (flags.format as string) ?? 'json',
        headers,
    };
}

function buildHeaders(params: RequestParams, applied: ApplyResult): Record<string, string> {
    const headers: Record<string, string> = {
        [HttpHeader.USER_AGENT]: buildUserAgent(),
        ...applied.headers,
    };

    for (const h of params.headers) {
        const idx = h.indexOf(':');
        if (idx > 0) {
            headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
        }
    }

    if (params.body && ['POST', 'PUT', 'PATCH'].includes(params.method)) {
        headers[HttpHeader.CONTENT_TYPE] ??= 'application/json';
    }

    return headers;
}

function applyQueryParams(url: string, applied: ApplyResult): string {
    if (!applied.query || Object.keys(applied.query).length === 0) return url;

    const parsed = new URL(url);
    for (const [k, v] of Object.entries(applied.query)) {
        parsed.searchParams.set(k, v);
    }
    return parsed.toString();
}

function applyBodyModifications(
    body: string | undefined,
    headers: Record<string, string>,
    applied: ApplyResult,
): string | undefined {
    if (!applied.body || Object.keys(applied.body).length === 0) return body;

    const ct = (headers[HttpHeader.CONTENT_TYPE] ?? '').toLowerCase().split(';')[0].trim();

    if (ct === 'application/x-www-form-urlencoded') {
        const params = new URLSearchParams(body ?? '');
        for (const [k, v] of Object.entries(applied.body)) {
            params.set(k, v);
        }
        return params.toString();
    }

    let json: Record<string, unknown> = {};
    try {
        json = JSON.parse(body ?? '{}') as Record<string, unknown>;
    } catch {
        // keep empty
    }
    for (const [k, v] of Object.entries(applied.body)) {
        json[k] = v;
    }
    return JSON.stringify(json);
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

async function toParseResponse(response: UndiciResponse): Promise<ParsedResponse> {
    const rawBody = await response.text();
    let body: string;
    try {
        body = JSON.stringify(JSON.parse(rawBody), null, 2);
    } catch {
        body = rawBody;
    }

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
        headers[key] = value;
    });

    return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
    };
}

function writeOutput(response: ParsedResponse, format: string): void {
    switch (format) {
        case 'body':
            process.stdout.write(response.body + '\n');
            break;
        case 'headers':
            process.stdout.write(`${response.status} ${response.statusText}\n`);
            for (const [key, value] of Object.entries(response.headers)) {
                process.stdout.write(`${key}: ${value}\n`);
            }
            break;
        case 'json':
        default:
            process.stdout.write(
                formatJson({
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                    body: response.body,
                }) + '\n',
            );
            break;
    }
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

async function handleError(
    e: unknown,
    url: string,
    providerId: string,
    method: string,
): Promise<void> {
    if (e instanceof CredentialError) {
        process.stderr.write(`Auth error: ${e.message}\n`);
        if (e.code === 'BROWSER_UNAVAILABLE') {
            process.stderr.write(
                `Hint: Run "sig login ${url} --token <token>" or "sig sync pull" to get credentials.\n`,
            );
        }
    } else {
        process.stderr.write(`Request failed: ${(e as Error).message}\n`);
    }
    await logAuditEvent({
        action: AuditAction.REQUEST,
        status: AuditStatus.FAILURE,
        provider: providerId,
        metadata: { url, method, error: (e as Error).message },
    });
    process.exitCode = ExitCode.GENERAL_ERROR;
}

async function failWithMessage(
    url: string,
    message: string,
    metadata: Record<string, unknown>,
): Promise<void> {
    process.stderr.write(message + '\n');
    await logAuditEvent({ action: AuditAction.REQUEST, status: AuditStatus.FAILURE, metadata });
    process.exitCode = ExitCode.GENERAL_ERROR;
}

function printUsage(): void {
    process.stderr.write(
        'Usage: sig request <url> [--method GET] [--header "Name: Value"] [--body \'{}\']\n\n' +
            'Credentials stay internal — never exposed to subprocesses, env vars, or shell history.\n' +
            'More secure than "sig run" or "sig get" for one-off API calls.\n',
    );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

class CredentialError extends Error {
    constructor(
        message: string,
        public code?: string,
    ) {
        super(message);
        this.name = 'CredentialError';
    }
}
