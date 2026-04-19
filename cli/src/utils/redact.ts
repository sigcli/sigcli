import type { Credential } from '../core/types.js';
import { Transform } from 'node:stream';

const MIN_SECRET_LENGTH = 8;

export function extractSensitiveValues(credential: Credential): string[] {
    const values: string[] = [];

    const add = (v: string) => {
        if (v.length >= MIN_SECRET_LENGTH) values.push(v);
    };

    switch (credential.type) {
        case 'bearer':
            add(credential.accessToken);
            if (credential.refreshToken) add(credential.refreshToken);
            for (const v of Object.values(credential.xHeaders ?? {})) add(v);
            for (const v of Object.values(credential.localStorage ?? {})) add(v);
            break;
        case 'cookie':
            for (const c of credential.cookies) add(c.value);
            for (const v of Object.values(credential.xHeaders ?? {})) add(v);
            for (const v of Object.values(credential.localStorage ?? {})) add(v);
            break;
        case 'api-key':
            add(credential.key);
            break;
        case 'basic':
            add(credential.password);
            break;
    }

    return [...new Set(values)];
}

export function redactOutput(text: string, secrets: string[]): string {
    const active = secrets.filter((s) => s.length >= MIN_SECRET_LENGTH);
    if (active.length === 0) return text;
    let result = text;
    for (const secret of active) {
        result = result.split(secret).join('****');
    }
    return result;
}

export function createRedactTransform(secrets: string[]): Transform {
    const active = secrets.filter((s) => s.length >= MIN_SECRET_LENGTH);
    const maxLen = active.length > 0 ? Math.max(...active.map((s) => s.length)) : 0;

    let buffer = '';

    return new Transform({
        transform(chunk: Buffer, _encoding: string, callback: () => void) {
            buffer += chunk.toString();
            if (buffer.length > maxLen * 2) {
                const safe = buffer.slice(0, buffer.length - maxLen);
                this.push(redactOutput(safe, active));
                buffer = buffer.slice(buffer.length - maxLen);
            }
            callback();
        },
        flush(callback: () => void) {
            if (buffer.length > 0) {
                this.push(redactOutput(buffer, active));
                buffer = '';
            }
            callback();
        },
    });
}
