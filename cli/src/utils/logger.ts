import type { ILogger } from '../types/index.js';

export function createConsoleLogger(): ILogger {
    return {
        debug(message: string, ...args: unknown[]) {
            process.stderr.write(
                `[DEBUG] ${message}${args.length ? ' ' + args.map(String).join(' ') : ''}\n`,
            );
        },
        info(message: string, ...args: unknown[]) {
            process.stderr.write(
                `[INFO] ${message}${args.length ? ' ' + args.map(String).join(' ') : ''}\n`,
            );
        },
        warn(message: string, ...args: unknown[]) {
            process.stderr.write(
                `[WARN] ${message}${args.length ? ' ' + args.map(String).join(' ') : ''}\n`,
            );
        },
        error(message: string, ...args: unknown[]) {
            process.stderr.write(
                `[ERROR] ${message}${args.length ? ' ' + args.map(String).join(' ') : ''}\n`,
            );
        },
    };
}

export function createOperationalLogger(): ILogger {
    return {
        debug() {},
        info(message: string, ...args: unknown[]) {
            process.stderr.write(
                `[sig] ${message}${args.length ? ' ' + args.map(String).join(' ') : ''}\n`,
            );
        },
        warn(message: string, ...args: unknown[]) {
            process.stderr.write(
                `[sig] WARN: ${message}${args.length ? ' ' + args.map(String).join(' ') : ''}\n`,
            );
        },
        error(message: string, ...args: unknown[]) {
            process.stderr.write(
                `[sig] ERROR: ${message}${args.length ? ' ' + args.map(String).join(' ') : ''}\n`,
            );
        },
    };
}

export function createNoopLogger(): ILogger {
    return {
        debug() {},
        info() {},
        warn() {},
        error() {},
    };
}
