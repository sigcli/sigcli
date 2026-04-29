import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';
import * as tls from 'node:tls';
import { isOk } from '../types/result.js';
import type { Credential } from '../types/types.js';
import type { AuthManager } from '../auth-manager.js';
import type { CaManager } from './ca-manager.js';
import { applyInjectRules } from './inject.js';

const HOP_BY_HOP = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'proxy-connection',
    'te',
    'trailers',
    'transfer-encoding',
    'upgrade',
]);

function stripHopByHop(headers: http.IncomingHttpHeaders): http.OutgoingHttpHeaders {
    const out: http.OutgoingHttpHeaders = {};
    for (const [k, v] of Object.entries(headers)) {
        if (!HOP_BY_HOP.has(k.toLowerCase())) {
            out[k] = v;
        }
    }
    return out;
}

function resolveProvider(url: string, auth: AuthManager) {
    return auth.providerRegistry.resolve(url);
}

async function applyInjection(
    url: string,
    baseHeaders: http.OutgoingHttpHeaders,
    bodyBuffer: Buffer | undefined,
    contentType: string | undefined,
    auth: AuthManager,
): Promise<{ headers: http.OutgoingHttpHeaders; body: Buffer | undefined; url: string }> {
    const provider = resolveProvider(url, auth);
    if (!provider) return { headers: baseHeaders, body: bodyBuffer, url };

    const credResult = await auth.getCredentials(provider.id);
    if (!isOk(credResult)) return { headers: baseHeaders, body: bodyBuffer, url };

    // Always apply strategy-level credential headers (Cookie, Authorization, etc.)
    const authHeaders = auth.applyToRequest(provider.id, credResult.value);
    const mergedHeaders: http.OutgoingHttpHeaders = { ...baseHeaders };
    for (const [key, value] of Object.entries(authHeaders)) {
        mergedHeaders[key.toLowerCase()] = value;
    }

    // Then layer inject rules on top if configured
    if (provider.proxy?.inject?.length) {
        return applyInjectRules(
            provider.proxy.inject,
            credResult.value,
            mergedHeaders,
            bodyBuffer,
            contentType,
            url,
        );
    }

    return { headers: mergedHeaders, body: bodyBuffer, url };
}

async function handlePlainHttp(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    auth: AuthManager,
): Promise<void> {
    const rawUrl = req.url ?? '/';
    const targetUrl = rawUrl.startsWith('http') ? rawUrl : `http://${req.headers.host}${rawUrl}`;
    try {
        new URL(targetUrl);
    } catch {
        res.writeHead(400);
        res.end('Bad Request');
        return;
    }

    const baseHeaders = stripHopByHop(req.headers);
    const contentType = req.headers['content-type'];

    const provider = resolveProvider(targetUrl, auth);
    const hasBodyRule = provider?.proxy?.inject?.some((r) => r.in === 'body') ?? false;

    if (hasBodyRule) {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        await new Promise<void>((resolve) => req.on('end', resolve));
        const bodyBuffer = Buffer.concat(chunks);

        const {
            headers,
            body,
            url: injectedUrl,
        } = await applyInjection(targetUrl, baseHeaders, bodyBuffer, contentType, auth);

        const injParsed = new URL(injectedUrl);
        const outHeaders =
            body !== undefined ? { ...headers, 'content-length': String(body.length) } : headers;

        const options: http.RequestOptions = {
            hostname: injParsed.hostname,
            port: injParsed.port || 80,
            path: injParsed.pathname + injParsed.search,
            method: req.method,
            headers: outHeaders,
        };

        const proxyReq = http.request(options, (proxyRes) => {
            const outResHeaders = stripHopByHop(proxyRes.headers);
            res.writeHead(proxyRes.statusCode ?? 200, outResHeaders);
            proxyRes.pipe(res, { end: true });
        });

        proxyReq.on('error', () => {
            if (!res.headersSent) res.writeHead(502);
            res.end('Bad Gateway');
        });

        if (body && body.length > 0) proxyReq.write(body);
        proxyReq.end();
    } else {
        const { headers, url: injectedUrl } = await applyInjection(
            targetUrl,
            baseHeaders,
            undefined,
            contentType,
            auth,
        );

        const injParsed = new URL(injectedUrl);
        const options: http.RequestOptions = {
            hostname: injParsed.hostname,
            port: injParsed.port || 80,
            path: injParsed.pathname + injParsed.search,
            method: req.method,
            headers,
        };

        const proxyReq = http.request(options, (proxyRes) => {
            const outHeaders = stripHopByHop(proxyRes.headers);
            res.writeHead(proxyRes.statusCode ?? 200, outHeaders);
            proxyRes.pipe(res, { end: true });
        });

        proxyReq.on('error', () => {
            if (!res.headersSent) res.writeHead(502);
            res.end('Bad Gateway');
        });

        req.pipe(proxyReq, { end: true });
    }
}

async function handleConnectMitm(
    req: http.IncomingMessage,
    clientSocket: net.Socket,
    hostname: string,
    port: number,
    auth: AuthManager,
    caManager: CaManager,
): Promise<void> {
    let leafCert: { cert: string; key: string };
    try {
        leafCert = await caManager.leafCertFor(hostname);
    } catch {
        clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        clientSocket.destroy();
        return;
    }

    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

    const tlsServer = new tls.TLSSocket(clientSocket, {
        isServer: true,
        cert: leafCert.cert,
        key: leafCert.key,
    });

    tlsServer.on('error', () => tlsServer.destroy());

    const chunks: Buffer[] = [];
    let headersParsed = false;
    let method = '';
    let path = '';
    const parsedHeaders: http.IncomingHttpHeaders = {};
    let expectedBodyLen = 0;
    let headerEndOffset = 0;

    const processRequest = async (bodyBuf: Buffer | undefined) => {
        const targetUrl = `https://${hostname}${path}`;
        const baseHeaders = stripHopByHop(parsedHeaders);
        const contentType = parsedHeaders['content-type'];

        const provider = resolveProvider(targetUrl, auth);
        const hasBodyRule = provider?.proxy?.inject?.some((r) => r.in === 'body') ?? false;

        if (hasBodyRule) {
            const result = await applyInjection(
                targetUrl,
                baseHeaders,
                bodyBuf ?? Buffer.alloc(0),
                contentType,
                auth,
            );
            const outHeaders = {
                ...result.headers,
                'content-length': String(result.body?.length ?? 0),
            };
            const options: https.RequestOptions = {
                hostname,
                port,
                path,
                method,
                headers: outHeaders,
                rejectUnauthorized: false,
            };
            const proxyReq = https.request(options, (proxyRes) => {
                const outResHeaders = stripHopByHop(proxyRes.headers);
                let statusLine = `HTTP/1.1 ${proxyRes.statusCode ?? 200} ${proxyRes.statusMessage ?? 'OK'}\r\n`;
                for (const [k, v] of Object.entries(outResHeaders)) {
                    const val = Array.isArray(v) ? v.join(', ') : v;
                    if (val !== undefined) statusLine += `${k}: ${val}\r\n`;
                }
                statusLine += '\r\n';
                tlsServer.write(statusLine);
                proxyRes.pipe(tlsServer, { end: true });
            });
            proxyReq.on('error', () => tlsServer.destroy());
            if (result.body && result.body.length > 0) proxyReq.write(result.body);
            proxyReq.end();
            return;
        }

        const { headers, url: injectedUrl } = await applyInjection(
            targetUrl,
            baseHeaders,
            undefined,
            contentType,
            auth,
        );
        const injPath = new URL(injectedUrl).pathname + new URL(injectedUrl).search;

        const options: https.RequestOptions = {
            hostname,
            port,
            path: injPath,
            method,
            headers,
            rejectUnauthorized: false,
        };

        const proxyReq = https.request(options, (proxyRes) => {
            const outHeaders = stripHopByHop(proxyRes.headers);
            let statusLine = `HTTP/1.1 ${proxyRes.statusCode ?? 200} ${proxyRes.statusMessage ?? 'OK'}\r\n`;
            for (const [k, v] of Object.entries(outHeaders)) {
                const val = Array.isArray(v) ? v.join(', ') : v;
                if (val !== undefined) statusLine += `${k}: ${val}\r\n`;
            }
            statusLine += '\r\n';
            tlsServer.write(statusLine);
            proxyRes.pipe(tlsServer, { end: true });
        });

        proxyReq.on('error', () => tlsServer.destroy());

        if (bodyBuf && bodyBuf.length > 0) proxyReq.write(bodyBuf);
        proxyReq.end();
    };

    tlsServer.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        const accumulated = Buffer.concat(chunks);

        if (!headersParsed) {
            const headerEnd = accumulated.indexOf('\r\n\r\n');
            if (headerEnd === -1) return;

            headersParsed = true;
            headerEndOffset = headerEnd + 4;
            const headerStr = accumulated.slice(0, headerEnd).toString();
            const lines = headerStr.split('\r\n');
            const requestLine = lines[0] ?? '';
            const parts = requestLine.split(' ');
            method = parts[0] ?? '';
            path = parts[1] ?? '';

            if (!method || !path) {
                tlsServer.destroy();
                return;
            }

            for (let i = 1; i < lines.length; i++) {
                const colonIdx = lines[i].indexOf(':');
                if (colonIdx === -1) continue;
                const name = lines[i].slice(0, colonIdx).trim().toLowerCase();
                const value = lines[i].slice(colonIdx + 1).trim();
                parsedHeaders[name] = value;
            }

            expectedBodyLen = parseInt(parsedHeaders['content-length'] ?? '0', 10);
        }

        const bodyReceived = accumulated.length - headerEndOffset;
        if (bodyReceived >= expectedBodyLen) {
            tlsServer.removeAllListeners('data');
            const bodyBuf =
                expectedBodyLen > 0
                    ? accumulated.slice(headerEndOffset, headerEndOffset + expectedBodyLen)
                    : undefined;
            processRequest(bodyBuf).catch(() => tlsServer.destroy());
        }
    });
}

function handleConnectTunnel(clientSocket: net.Socket, hostname: string, port: number): void {
    const upstream = net.connect(port, hostname, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        upstream.pipe(clientSocket, { end: true });
        clientSocket.pipe(upstream, { end: true });
    });
    upstream.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => upstream.destroy());
}

export interface ProxyServerOptions {
    port: number;
    auth: AuthManager;
    caManager: CaManager;
}

export class ProxyServer {
    private server: http.Server;
    private _port: number;
    private readonly auth: AuthManager;
    private readonly caManager: CaManager;

    constructor(opts: ProxyServerOptions) {
        this._port = opts.port;
        this.auth = opts.auth;
        this.caManager = opts.caManager;
        this.server = http.createServer();
        this.server.on('request', (req, res) => {
            handlePlainHttp(req, res, this.auth).catch(() => {
                if (!res.headersSent) res.writeHead(500);
                res.end();
            });
        });
        this.server.on('connect', (req, clientSocket: net.Socket, head: Buffer) => {
            const hostHeader = req.url ?? '';
            const colonIdx = hostHeader.lastIndexOf(':');
            const hostname = colonIdx >= 0 ? hostHeader.slice(0, colonIdx) : hostHeader;
            const port = colonIdx >= 0 ? parseInt(hostHeader.slice(colonIdx + 1), 10) : 443;

            if (head.length > 0) clientSocket.unshift(head);

            const provider = resolveProvider(`https://${hostname}`, this.auth);
            if (provider) {
                handleConnectMitm(
                    req,
                    clientSocket,
                    hostname,
                    port,
                    this.auth,
                    this.caManager,
                ).catch(() => {
                    clientSocket.destroy();
                });
            } else {
                handleConnectTunnel(clientSocket, hostname, port);
            }
        });
    }

    async start(): Promise<{ port: number }> {
        await this.caManager.ensureCa();
        return new Promise((resolve, reject) => {
            this.server.listen(this._port, '127.0.0.1', () => {
                const addr = this.server.address();
                this._port = typeof addr === 'object' && addr ? addr.port : this._port;
                resolve({ port: this._port });
            });
            this.server.once('error', reject);
        });
    }

    async stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server.close((err) => (err ? reject(err) : resolve()));
        });
    }

    get port(): number {
        return this._port;
    }
}
