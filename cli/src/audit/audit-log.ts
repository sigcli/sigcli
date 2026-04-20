import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';

const AUDIT_DIR = join(os.homedir(), '.sig');
const AUDIT_FILE = join(AUDIT_DIR, 'audit.log');

export const AuditAction = {
    LOGIN: 'login',
    LOGOUT: 'logout',
    CREDENTIAL_ACCESS: 'credential_access',
    CREDENTIAL_SET: 'credential_set',
    REQUEST: 'request',
    SYNC_PUSH: 'sync_push',
    SYNC_PULL: 'sync_pull',
    PROXY_START: 'proxy_start',
    PROXY_STOP: 'proxy_stop',
    PROVIDER_REMOVE: 'provider_remove',
    PROVIDER_RENAME: 'provider_rename',
    RUN: 'run',
} as const;

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditStatus = {
    SUCCESS: 'success',
    FAILURE: 'failure',
} as const;

export type AuditStatusValue = (typeof AuditStatus)[keyof typeof AuditStatus];

export interface AuditEntry {
    timestamp: string;
    action: AuditActionValue;
    status: AuditStatusValue;
    provider?: string;
    metadata?: Record<string, unknown>;
}

export interface AuditEventParams {
    action: AuditActionValue;
    status: AuditStatusValue;
    provider?: string;
    metadata?: Record<string, unknown>;
}

export async function logAuditEvent(params: AuditEventParams): Promise<void> {
    try {
        const entry: AuditEntry = {
            timestamp: new Date().toISOString(),
            ...params,
        };
        await mkdir(AUDIT_DIR, { recursive: true });
        await appendFile(AUDIT_FILE, JSON.stringify(entry) + '\n', 'utf8');
    } catch {
        // Never fail the parent operation due to audit logging
    }
}
