import { Transform } from 'node:stream';

const MIN_SECRET_LENGTH = 8;

export function extractSensitiveValues(credentials: Record<string, unknown>): string[] {
    const values: string[] = [];

    for (const v of Object.values(credentials)) {
        if (typeof v === 'string' && v.length >= MIN_SECRET_LENGTH) {
            values.push(v);
        }
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
