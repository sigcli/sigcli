/**
 * Minimal raw WebSocket CDP client using Node's built-in `http` module.
 * Node 18 does not have a native WebSocket class, so we implement
 * the handshake and framing ourselves.
 *
 * Limitations (intentional — CDP only needs these):
 * - Text frames only (JSON payloads)
 * - Masking on client→server frames (required by RFC 6455)
 * - No fragmented frames
 */

import net from 'node:net';
import crypto from 'node:crypto';
import { URL } from 'node:url';

export interface CdpWsClient {
    send(method: string, params?: Record<string, unknown>): Promise<unknown>;
    close(): void;
}

// ============================================================================
// WebSocket constants
// ============================================================================

const WS_OPCODE_TEXT = 0x1;
const WS_OPCODE_CLOSE = 0x8;
const WS_OPCODE_PING = 0x9;
const WS_OPCODE_PONG = 0xa;
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const WS_VERSION = '13';

// ============================================================================
// Frame builder (client→server, always masked)
// ============================================================================

function buildTextFrame(payload: string): Buffer {
    const data = Buffer.from(payload, 'utf-8');
    const len = data.length;
    const mask = crypto.randomBytes(4);

    let headerSize: number;
    if (len <= 125) {
        headerSize = 6; // 2 + 4 mask
    } else if (len <= 65535) {
        headerSize = 8; // 2 + 2 ext-len + 4 mask
    } else {
        headerSize = 14; // 2 + 8 ext-len + 4 mask
    }

    const frame = Buffer.allocUnsafe(headerSize + len);
    frame[0] = 0x80 | WS_OPCODE_TEXT; // FIN + text

    if (len <= 125) {
        frame[1] = 0x80 | len;
        mask.copy(frame, 2);
    } else if (len <= 65535) {
        frame[1] = 0x80 | 126;
        frame.writeUInt16BE(len, 2);
        mask.copy(frame, 4);
    } else {
        frame[1] = 0x80 | 127;
        frame.writeUInt32BE(0, 2);
        frame.writeUInt32BE(len, 6);
        mask.copy(frame, 10);
    }

    for (let i = 0; i < len; i++) {
        frame[headerSize + i] = data[i] ^ mask[i % 4];
    }

    return frame;
}

// ============================================================================
// Frame parser: returns parsed frame and bytes consumed, or null if incomplete
// ============================================================================

function tryParseFrame(
    buf: Buffer,
): { opcode: number; payload: Buffer; consumed: number } | null {
    if (buf.length < 2) return null;

    const byte1 = buf[1];
    const masked = (byte1 & 0x80) !== 0;
    let payloadLen = byte1 & 0x7f;
    let headerLen = 2;

    if (payloadLen === 126) {
        if (buf.length < 4) return null;
        payloadLen = buf.readUInt16BE(2);
        headerLen = 4;
    } else if (payloadLen === 127) {
        if (buf.length < 10) return null;
        // High 32 bits must be 0 for any realistic CDP message
        payloadLen = buf.readUInt32BE(6);
        headerLen = 10;
    }

    if (masked) headerLen += 4;

    const totalLen = headerLen + payloadLen;
    if (buf.length < totalLen) return null;

    let payload: Buffer;
    if (masked) {
        const maskOffset = headerLen - 4;
        payload = Buffer.allocUnsafe(payloadLen);
        for (let i = 0; i < payloadLen; i++) {
            payload[i] = buf[headerLen + i] ^ buf[maskOffset + (i % 4)];
        }
    } else {
        // Server frames are not masked — just slice
        payload = buf.subarray(headerLen, totalLen);
    }

    return { opcode: buf[0] & 0x0f, payload, consumed: totalLen };
}

// ============================================================================
// connectCdpWs
// ============================================================================

/**
 * Connect to a Chrome DevTools Protocol WebSocket endpoint.
 * Returns a client that can send CDP commands and receive responses.
 *
 * Only supports ws:// (Chrome's CDP endpoint is always plain HTTP/WS locally).
 */
export function connectCdpWs(wsUrl: string): Promise<CdpWsClient> {
    return new Promise((resolve, reject) => {
        const url = new URL(wsUrl);
        const host = url.hostname;
        const port = url.port ? parseInt(url.port, 10) : 80;
        const wsPath = url.pathname + (url.search ?? '');

        // Generate WebSocket upgrade key
        const key = crypto.randomBytes(16).toString('base64');
        const expectedAccept = crypto
            .createHash('sha1')
            .update(key + WS_MAGIC)
            .digest('base64');

        const upgradeRequest = [
            `GET ${wsPath} HTTP/1.1`,
            `Host: ${host}:${port}`,
            `Upgrade: websocket`,
            `Connection: Upgrade`,
            `Sec-WebSocket-Key: ${key}`,
            `Sec-WebSocket-Version: ${WS_VERSION}`,
            '',
            '',
        ].join('\r\n');

        const socket = net.createConnection({ host, port });
        socket.on('error', reject);

        // State machine
        let upgradeComplete = false;
        let rawBuf = Buffer.alloc(0);

        // Pending CDP requests: id → {resolve, reject}
        const pending = new Map<
            number,
            { resolve: (v: unknown) => void; reject: (e: Error) => void }
        >();
        let nextId = 1;

        const client: CdpWsClient = {
            send(method: string, params?: Record<string, unknown>): Promise<unknown> {
                return new Promise<unknown>((res, rej) => {
                    const id = nextId++;
                    pending.set(id, { resolve: res, reject: rej });
                    const msg = JSON.stringify({ id, method, params: params ?? {} });
                    socket.write(buildTextFrame(msg));
                });
            },
            close() {
                const closeFrame = Buffer.allocUnsafe(2);
                closeFrame[0] = 0x80 | WS_OPCODE_CLOSE;
                closeFrame[1] = 0;
                try {
                    socket.write(closeFrame);
                } catch {
                    // Ignore — socket may already be gone
                }
                socket.destroy();
            },
        };

        socket.on('connect', () => {
            socket.write(upgradeRequest);
        });

        socket.on('data', (chunk: Buffer) => {
            rawBuf = Buffer.concat([rawBuf, chunk]);

            if (!upgradeComplete) {
                // Look for end of HTTP headers
                const headerEnd = rawBuf.indexOf('\r\n\r\n');
                if (headerEnd === -1) return; // Need more data

                const headerStr = rawBuf.subarray(0, headerEnd).toString('ascii');

                if (!headerStr.includes('101')) {
                    socket.destroy();
                    reject(new Error(`WebSocket upgrade failed:\n${headerStr.split('\r\n')[0]}`));
                    return;
                }
                if (!headerStr.includes(expectedAccept)) {
                    socket.destroy();
                    reject(new Error('WebSocket Sec-WebSocket-Accept header mismatch'));
                    return;
                }

                upgradeComplete = true;
                // Everything after the headers is WS frame data
                rawBuf = rawBuf.subarray(headerEnd + 4);
                resolve(client);
                // Fall through to process any WS frames already in buffer
            }

            // Process complete WS frames
            while (rawBuf.length > 0) {
                const frame = tryParseFrame(rawBuf);
                if (!frame) break;

                rawBuf = rawBuf.subarray(frame.consumed);

                switch (frame.opcode) {
                    case WS_OPCODE_PING: {
                        // Send pong with same payload
                        const pong = Buffer.allocUnsafe(2 + frame.payload.length);
                        pong[0] = 0x80 | WS_OPCODE_PONG;
                        pong[1] = frame.payload.length & 0x7f;
                        frame.payload.copy(pong, 2);
                        socket.write(pong);
                        break;
                    }
                    case WS_OPCODE_CLOSE:
                        socket.destroy();
                        break;
                    case WS_OPCODE_TEXT: {
                        let msg: Record<string, unknown>;
                        try {
                            msg = JSON.parse(frame.payload.toString('utf-8')) as Record<
                                string,
                                unknown
                            >;
                        } catch {
                            break;
                        }

                        const msgId = msg.id as number | undefined;
                        if (msgId !== undefined) {
                            const handler = pending.get(msgId);
                            if (handler) {
                                pending.delete(msgId);
                                if (msg.error) {
                                    const cdpError = msg.error as Record<string, unknown>;
                                    handler.reject(new Error(cdpError.message as string));
                                } else {
                                    handler.resolve(msg.result ?? null);
                                }
                            }
                        }
                        break;
                    }
                    default:
                        // Ignore unknown opcodes (binary, continuation, etc.)
                        break;
                }
            }
        });

        socket.on('close', () => {
            // Reject any outstanding requests
            for (const { reject: rej } of pending.values()) {
                rej(new Error('WebSocket connection closed'));
            }
            pending.clear();
        });
    });
}
