import { describe, it, expect } from 'vitest';
import { createDefaultProvider, deriveShortId } from '../../../src/providers/auto-provision.js';

describe('deriveShortId', () => {
    it('uses first segment when >= 8 chars', () => {
        expect(
            deriveShortId('dashboard-analytics-prod-us.analytics.cloudservices.example.com'),
        ).toBe('dashboard-analytics-prod-us');
    });

    it('joins first two segments when first < 8 chars', () => {
        expect(deriveShortId('jira.tools.sap')).toBe('jira-tools');
    });

    it('uses first segment alone for single-segment hostname', () => {
        expect(deriveShortId('localhost')).toBe('localhost');
    });

    it('handles short two-segment hostname', () => {
        expect(deriveShortId('app.com')).toBe('app-com');
    });

    it('handles exactly 8-char first segment', () => {
        expect(deriveShortId('abcdefgh.example.com')).toBe('abcdefgh');
    });

    it('appends -2 on collision', () => {
        const existing = new Set(['grafana']);
        expect(deriveShortId('grafana.example.com', existing)).toBe('grafana-example');
    });

    it('appends -2 when base collides with existingIds', () => {
        const existing = new Set(['dashboard-analytics-prod-us']);
        expect(
            deriveShortId(
                'dashboard-analytics-prod-us.analytics.cloudservices.example.com',
                existing,
            ),
        ).toBe('dashboard-analytics-prod-us-2');
    });

    it('increments suffix until unique', () => {
        const existing = new Set(['jira-tools', 'jira-tools-2', 'jira-tools-3']);
        expect(deriveShortId('jira.tools.sap', existing)).toBe('jira-tools-4');
    });

    it('returns base when existingIds is undefined', () => {
        expect(deriveShortId('jira.tools.sap')).toBe('jira-tools');
    });
});

describe('createDefaultProvider', () => {
    it('creates provider with short ID from full URL', () => {
        const provider = createDefaultProvider(
            'https://dashboard-analytics-prod-us.analytics.cloudservices.example.com/',
        );

        expect(provider.id).toBe('dashboard-analytics-prod-us');
        expect(provider.name).toBe(
            'dashboard-analytics-prod-us.analytics.cloudservices.example.com',
        );
        expect(provider.strategy).toBe('cookie');
        expect(provider.domains).toEqual([
            'dashboard-analytics-prod-us.analytics.cloudservices.example.com',
        ]);
        expect(provider.autoProvisioned).toBe(true);
        expect(provider.strategyConfig).toEqual({ strategy: 'cookie' });
    });

    it('creates provider with joined segments for short hostname', () => {
        const provider = createDefaultProvider('https://jira.tools.sap/browse/PROJ-1');

        expect(provider.id).toBe('jira-tools');
        expect(provider.name).toBe('jira.tools.sap');
        expect(provider.domains).toEqual(['jira.tools.sap']);
        expect(provider.entryUrl).toBe('https://jira.tools.sap/');
    });

    it('creates provider from bare hostname (auto-prepends https://)', () => {
        const provider = createDefaultProvider('jira.example.com');

        expect(provider.id).toBe('jira-example');
        expect(provider.name).toBe('jira.example.com');
        expect(provider.domains).toEqual(['jira.example.com']);
        expect(provider.entryUrl).toBe('https://jira.example.com/');
        expect(provider.strategy).toBe('cookie');
        expect(provider.autoProvisioned).toBe(true);
    });

    it('handles URL with port', () => {
        const provider = createDefaultProvider('https://internal.corp:8443/app');

        // "internal" is 8 chars, so first segment is used as-is
        expect(provider.id).toBe('internal');
        expect(provider.name).toBe('internal.corp');
        expect(provider.domains).toEqual(['internal.corp']);
        expect(provider.entryUrl).toBe('https://internal.corp:8443/');
        expect(provider.autoProvisioned).toBe(true);
    });

    it('preserves http protocol', () => {
        const provider = createDefaultProvider('http://insecure.local/path');

        // "insecure" is 8 chars, so first segment is used as-is
        expect(provider.id).toBe('insecure');
        expect(provider.name).toBe('insecure.local');
        expect(provider.domains).toEqual(['insecure.local']);
        expect(provider.entryUrl).toBe('http://insecure.local/');
        expect(provider.strategy).toBe('cookie');
        expect(provider.autoProvisioned).toBe(true);
    });

    it('handles collision with existingIds', () => {
        const existing = new Set(['jira-tools']);
        const provider = createDefaultProvider('https://jira.tools.sap/', existing);

        expect(provider.id).toBe('jira-tools-2');
        expect(provider.name).toBe('jira.tools.sap');
        expect(provider.domains).toEqual(['jira.tools.sap']);
    });

    it('produces deterministic provider ID from hostname', () => {
        const p1 = createDefaultProvider('https://site.example.com/path1');
        const p2 = createDefaultProvider('https://site.example.com/path2');

        expect(p1.id).toBe(p2.id);
        expect(p1.entryUrl).toBe(p2.entryUrl);
    });
});
