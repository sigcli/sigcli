import type { AuthDeps } from '../../deps.js';
import type { Credential } from '../../core/types.js';
import { isOk } from '../../core/result.js';
import { formatJson, formatCredentialHeaders } from '../formatters.js';
import { ExitCode } from '../exit-codes.js';
import { CredentialTypeName, HttpHeader, OutputFormat } from '../../core/constants.js';
import { logAuditEvent, AuditAction, AuditStatus } from '../../audit/audit-log.js';
import { extractSensitiveValues, redactOutput } from '../../utils/redact.js';

const PRIMARY_HEADERS = [HttpHeader.COOKIE.toLowerCase(), HttpHeader.AUTHORIZATION.toLowerCase()];

function getLocalStorage(credential: Credential): Record<string, string> | undefined {
    if (
        credential.type === CredentialTypeName.COOKIE ||
        credential.type === CredentialTypeName.BEARER
    ) {
        const ls = credential.localStorage;
        if (ls && Object.keys(ls).length > 0) return ls;
    }
    return undefined;
}

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
            await logAuditEvent({
                action: AuditAction.CREDENTIAL_ACCESS,
                status: AuditStatus.FAILURE,
                provider: providerId,
                metadata: { error: result.error.message },
            });
            process.stderr.write(`Error: ${result.error.message}\n`);
            if (result.error.code === 'BROWSER_UNAVAILABLE') {
                process.stderr.write(
                    `Hint: Run "sig login ${target} --token <token>" or "sig sync pull" to get credentials.\n`,
                );
            }
            process.exitCode =
                result.error.code === 'CREDENTIAL_NOT_FOUND'
                    ? ExitCode.CREDENTIAL_NOT_FOUND
                    : ExitCode.GENERAL_ERROR;
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
            await logAuditEvent({
                action: AuditAction.CREDENTIAL_ACCESS,
                status: AuditStatus.FAILURE,
                metadata: { target, error: result.error.message },
            });
            process.stderr.write(`Error: ${result.error.message}\n`);
            if (result.error.code === 'BROWSER_UNAVAILABLE') {
                process.stderr.write(
                    `Hint: Run "sig login ${target} --token <token>" or "sig sync pull" to get credentials.\n`,
                );
            }
            process.exitCode =
                result.error.code === 'PROVIDER_NOT_FOUND'
                    ? ExitCode.PROVIDER_NOT_FOUND
                    : ExitCode.CREDENTIAL_NOT_FOUND;
            return;
        }
        providerId = result.value.provider.id;
        credential = result.value.credential;
    }

    const headers = deps.authManager.applyToRequest(providerId, credential);
    const noRedaction = flags['no-redaction'] === true;
    await logAuditEvent({
        action: AuditAction.CREDENTIAL_ACCESS,
        status: AuditStatus.SUCCESS,
        provider: providerId,
        metadata: { credentialType: credential.type, redacted: !noRedaction },
    });
    const entries = Object.entries(headers);

    if (entries.length === 0) {
        process.stderr.write(`Error: No credential headers produced for "${providerId}".\n`);
        process.exitCode = ExitCode.CREDENTIAL_NOT_FOUND;
        return;
    }

    const primaryEntry =
        entries.find(([name]) => PRIMARY_HEADERS.includes(name.toLowerCase())) ?? entries[0];
    const [primaryHeaderName, primaryHeaderValue] = primaryEntry;

    const xHeaders: Record<string, string> = {};
    for (const [name, value] of entries) {
        if (name !== primaryHeaderName) {
            xHeaders[name] = value;
        }
    }

    const format = (flags.format as string) ?? OutputFormat.JSON;
    if (noRedaction) {
        process.stderr.write(
            'Warning: Outputting raw credential values — do not expose to untrusted processes.\n',
        );
    }
    const secrets = noRedaction ? [] : extractSensitiveValues(credential);
    const redact = (text: string): string => (noRedaction ? text : redactOutput(text, secrets));

    switch (format) {
        case OutputFormat.JSON: {
            const credentialObj: Record<string, unknown> = {
                type: credential.type,
                headerName: primaryHeaderName,
                value: redact(primaryHeaderValue),
            };
            if (Object.keys(xHeaders).length > 0) {
                const redactedXHeaders: Record<string, string> = {};
                for (const [k, v] of Object.entries(xHeaders)) {
                    redactedXHeaders[k] = redact(v);
                }
                credentialObj.xHeaders = redactedXHeaders;
            }
            const ls = getLocalStorage(credential);
            if (ls) {
                const redactedLs: Record<string, string> = {};
                for (const [k, v] of Object.entries(ls)) {
                    redactedLs[k] = redact(v);
                }
                credentialObj.localStorage = redactedLs;
            }
            const output = {
                provider: providerId,
                credential: credentialObj,
            };
            process.stdout.write(formatJson(output) + '\n');
            break;
        }
        case OutputFormat.HEADER: {
            const redactedHeaders: Record<string, string> = {};
            for (const [k, v] of Object.entries(headers)) {
                redactedHeaders[k] = redact(v);
            }
            process.stdout.write(formatCredentialHeaders(redactedHeaders) + '\n');
            break;
        }
        case OutputFormat.VALUE: {
            process.stdout.write(redact(primaryHeaderValue) + '\n');
            for (const [name, value] of Object.entries(xHeaders)) {
                process.stdout.write(`${name}=${redact(value)}\n`);
            }
            const ls = getLocalStorage(credential);
            if (ls) {
                for (const [name, value] of Object.entries(ls)) {
                    process.stdout.write(`${name}=${redact(value)}\n`);
                }
            }
            break;
        }
        default: {
            process.stderr.write(`Unknown format: ${format}\n`);
            process.exitCode = ExitCode.GENERAL_ERROR;
        }
    }
}
