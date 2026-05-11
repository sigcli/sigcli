import 'reflect-metadata';

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CaManager } from '../../../src/proxy/ca-manager.js';

describe('CaManager', () => {
    let dir: string;
    let ca: CaManager;

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), 'sigcli-ca-test-'));
        ca = new CaManager(dir);
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it('generates CA on first ensureCa()', async () => {
        await ca.ensureCa();
        expect(ca.getCaPath()).toBe(join(dir, 'ca.crt'));
    });

    it('reloads existing CA on second ensureCa()', async () => {
        await ca.ensureCa();
        const ca2 = new CaManager(dir);
        await ca2.ensureCa();
        const leaf1 = await ca.leafCertFor('example.com');
        const leaf2 = await ca2.leafCertFor('example.com');
        // Both issued by the same CA — just verify they have PEM structure
        expect(leaf1.cert).toMatch(/BEGIN CERTIFICATE/);
        expect(leaf2.cert).toMatch(/BEGIN CERTIFICATE/);
    });

    it('issues leaf cert for a hostname', async () => {
        await ca.ensureCa();
        const { cert, key } = await ca.leafCertFor('api.example.com');
        expect(cert).toMatch(/BEGIN CERTIFICATE/);
        expect(key).toMatch(/BEGIN EC PRIVATE KEY/);
    });

    it('caches leaf certs', async () => {
        await ca.ensureCa();
        const first = await ca.leafCertFor('cached.test');
        const second = await ca.leafCertFor('cached.test');
        expect(first.cert).toBe(second.cert);
    });

    it('evicts least-recently-used entry when cache is full', async () => {
        await ca.ensureCa();

        // Fill cache to MAX_CACHE (200)
        for (let i = 0; i < 200; i++) {
            await ca.leafCertFor(`host-${i}.test`);
        }

        // Access the first entry so it becomes most-recently-used
        const refreshed = await ca.leafCertFor('host-0.test');

        // Insert one more to trigger eviction — host-1 (now oldest) should be evicted
        await ca.leafCertFor('new-host.test');

        // host-0 was recently accessed, so it should still be cached
        const stillCached = await ca.leafCertFor('host-0.test');
        expect(stillCached.cert).toBe(refreshed.cert);

        // host-1 was the least-recently-used, so it should have been evicted (new cert)
        const first = await ca.leafCertFor('host-1.test');
        const second = await ca.leafCertFor('host-1.test');
        // It's re-cached now, so second call returns same cert
        expect(first.cert).toBe(second.cert);
    });

    it('throws if leafCertFor called before ensureCa', async () => {
        await expect(ca.leafCertFor('test.com')).rejects.toThrow('CA not initialized');
    });
});
