import {
    X509CertificateGenerator,
    X509Certificate,
    KeyUsagesExtension,
    KeyUsageFlags,
    BasicConstraintsExtension,
    SubjectAlternativeNameExtension,
    cryptoProvider,
} from '@peculiar/x509';
import { webcrypto } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

cryptoProvider.set(webcrypto as Crypto);

const MAX_CACHE = 200;
const CA_CN = 'SigCLI Local Proxy CA';

interface LeafEntry {
    cert: string;
    key: string;
    expiresAt: Date;
}

function bufToPem(type: string, buf: ArrayBuffer): string {
    const b64 = Buffer.from(buf).toString('base64');
    const lines = b64.match(/.{1,64}/g) ?? [];
    return `-----BEGIN ${type}-----\n${lines.join('\n')}\n-----END ${type}-----\n`;
}

function pemToBuf(pem: string): ArrayBuffer {
    const b64 = pem
        .split('\n')
        .filter((l) => !l.startsWith('-----'))
        .join('');
    const bytes = Buffer.from(b64, 'base64');
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export class CaManager {
    private caCert: X509Certificate | null = null;
    private caPrivKey: CryptoKey | null = null;
    private readonly leafCache = new Map<string, LeafEntry>();
    private readonly proxyDir: string;

    constructor(proxyDir: string) {
        this.proxyDir = proxyDir;
    }

    async ensureCa(): Promise<void> {
        const keyPath = join(this.proxyDir, 'ca.key');
        const crtPath = join(this.proxyDir, 'ca.crt');

        try {
            const keyPem = await readFile(keyPath, 'utf8');
            const crtPem = await readFile(crtPath, 'utf8');

            const privKey = await webcrypto.subtle.importKey(
                'pkcs8',
                pemToBuf(keyPem),
                { name: 'ECDSA', namedCurve: 'P-256' },
                false,
                ['sign'],
            );

            this.caCert = new X509Certificate(crtPem);
            this.caPrivKey = privKey;
            return;
        } catch {
            // Generate a fresh CA below
        }

        await mkdir(this.proxyDir, { recursive: true });

        const keys = await webcrypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['sign', 'verify'],
        );

        const notBefore = new Date();
        const notAfter = new Date(notBefore.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);

        const cert = await X509CertificateGenerator.createSelfSigned({
            keys,
            name: `CN=${CA_CN}`,
            notBefore,
            notAfter,
            signingAlgorithm: { name: 'ECDSA', hash: 'SHA-256' },
            extensions: [
                new BasicConstraintsExtension(true, 0, true),
                new KeyUsagesExtension(KeyUsageFlags.keyCertSign | KeyUsageFlags.cRLSign, true),
            ],
        });

        const keyDer = await webcrypto.subtle.exportKey('pkcs8', keys.privateKey);
        await writeFile(keyPath, bufToPem('EC PRIVATE KEY', keyDer), { mode: 0o400 });
        await writeFile(crtPath, cert.toString('pem'), { mode: 0o644 });

        this.caCert = cert;
        this.caPrivKey = keys.privateKey;
    }

    async leafCertFor(hostname: string): Promise<{ cert: string; key: string }> {
        if (!this.caCert || !this.caPrivKey) {
            throw new Error('CA not initialized — call ensureCa() first');
        }

        const cached = this.leafCache.get(hostname);
        if (cached && cached.expiresAt > new Date()) {
            return { cert: cached.cert, key: cached.key };
        }

        const keys = await webcrypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['sign', 'verify'],
        );

        const notBefore = new Date();
        const notAfter = new Date(notBefore.getTime() + 365 * 24 * 60 * 60 * 1000);

        const cert = await X509CertificateGenerator.create({
            publicKey: keys.publicKey,
            signingKey: this.caPrivKey,
            subject: `CN=${hostname}`,
            issuer: `CN=${CA_CN}`,
            notBefore,
            notAfter,
            signingAlgorithm: { name: 'ECDSA', hash: 'SHA-256' },
            extensions: [new SubjectAlternativeNameExtension([{ type: 'dns', value: hostname }])],
        });

        const keyDer = await webcrypto.subtle.exportKey('pkcs8', keys.privateKey);
        const entry: LeafEntry = {
            cert: cert.toString('pem'),
            key: bufToPem('EC PRIVATE KEY', keyDer),
            expiresAt: notAfter,
        };

        if (this.leafCache.size >= MAX_CACHE) {
            const oldest = this.leafCache.keys().next().value;
            if (oldest !== undefined) this.leafCache.delete(oldest);
        }
        this.leafCache.set(hostname, entry);

        return { cert: entry.cert, key: entry.key };
    }

    getCaPath(): string {
        return join(this.proxyDir, 'ca.crt');
    }
}
