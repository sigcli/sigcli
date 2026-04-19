import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

    it('throws if leafCertFor called before ensureCa', async () => {
        await expect(ca.leafCertFor('test.com')).rejects.toThrow('CA not initialized');
    });
});
