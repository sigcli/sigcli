import { describe, it, expect } from 'vitest';
import { logAuditEvent, AuditAction, AuditStatus } from '../../../src/audit/audit-log.js';

describe('AuditAction constants', () => {
    it('defines all expected action values', () => {
        expect(AuditAction.LOGIN).toBe('login');
        expect(AuditAction.LOGOUT).toBe('logout');
        expect(AuditAction.CREDENTIAL_ACCESS).toBe('credential_access');
        expect(AuditAction.CREDENTIAL_SET).toBe('credential_set');
        expect(AuditAction.REQUEST).toBe('request');
        expect(AuditAction.SYNC_PUSH).toBe('sync_push');
        expect(AuditAction.SYNC_PULL).toBe('sync_pull');
        expect(AuditAction.PROXY_START).toBe('proxy_start');
        expect(AuditAction.PROXY_STOP).toBe('proxy_stop');
        expect(AuditAction.PROVIDER_REMOVE).toBe('provider_remove');
        expect(AuditAction.PROVIDER_RENAME).toBe('provider_rename');
        expect(AuditAction.RUN).toBe('run');
    });
});

describe('AuditStatus constants', () => {
    it('defines success and failure', () => {
        expect(AuditStatus.SUCCESS).toBe('success');
        expect(AuditStatus.FAILURE).toBe('failure');
    });
});

describe('logAuditEvent', () => {
    it('does not throw on any input', async () => {
        await expect(
            logAuditEvent({
                action: AuditAction.LOGIN,
                status: AuditStatus.SUCCESS,
                provider: 'test-provider',
                metadata: { method: 'token' },
            }),
        ).resolves.not.toThrow();
    });

    it('does not throw when metadata is omitted', async () => {
        await expect(
            logAuditEvent({
                action: AuditAction.LOGOUT,
                status: AuditStatus.SUCCESS,
            }),
        ).resolves.not.toThrow();
    });
});
