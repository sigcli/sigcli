import { EventEmitter } from 'node:events';
import path from 'node:path';
import os from 'node:os';
import type { Credential, ProviderInfo } from './types.js';
import { readProviderFile, listProviderFiles } from './reader.js';
import { formatHeaders, extractLocalStorage } from './formatter.js';
import { CredentialWatcher } from './watcher.js';

export interface SignetClientOptions {
    /** Path to credentials directory. Defaults to ~/.signet/credentials */
    credentialsDir?: string;
}

export interface SignetClientEvents {
    change: [providerId: string, headers: Record<string, string>];
    error: [error: Error];
}

export class SignetClient extends EventEmitter<SignetClientEvents> {
    private readonly credentialsDir: string;
    private watcher: CredentialWatcher | null = null;

    constructor(opts?: SignetClientOptions) {
        super();
        this.credentialsDir =
            opts?.credentialsDir ?? path.join(os.homedir(), '.signet', 'credentials');
    }

    /**
     * Get HTTP headers for a provider, ready to use with fetch/axios.
     *
     * Returns a plain object whose keys are HTTP header names and values are header values.
     * The headers produced depend on the credential type stored for the provider:
     *
     * - **cookie** -- `{ Cookie: "name=value; ...", ...xHeaders }`
     * - **bearer** -- `{ Authorization: "Bearer <token>", ...xHeaders }`
     * - **api-key** -- `{ [headerName]: "[prefix] <key>" }`
     * - **basic** -- `{ Authorization: "Basic <base64>" }`
     *
     * For `cookie` and `bearer` types, any captured `xHeaders` (e.g. CSRF tokens,
     * origin headers) are merged into the result. The primary header (`Cookie` or
     * `Authorization`) always takes precedence over xHeaders with the same name.
     *
     * @param providerId - The provider identifier (e.g. "my-jira", "github")
     * @returns A promise resolving to a `Record<string, string>` of HTTP headers
     * @throws {CredentialNotFoundError} If no credential file exists for the provider
     * @throws {CredentialParseError} If the credential file exists but cannot be parsed
     *
     * @example
     * ```typescript
     * const headers = await client.getHeaders('my-jira');
     * // cookie provider: { Cookie: "sid=abc; csrf=xyz", "x-csrf-token": "tok" }
     * // bearer provider: { Authorization: "Bearer eyJhbG..." }
     * const res = await fetch('https://jira.example.com/rest/api/2/search', { headers });
     * ```
     */
    async getHeaders(providerId: string): Promise<Record<string, string>> {
        const file = await readProviderFile(providerId, this.credentialsDir);
        return formatHeaders(file.credential);
    }

    /**
     * Get the raw credential object for a provider.
     *
     * Returns the full credential object with all fields, or `null` if the provider
     * has no stored credential or the file cannot be read/parsed. The returned object
     * is a discriminated union on the `type` field:
     *
     * - `CookieCredential` -- `{ type: "cookie", cookies, obtainedAt, xHeaders?, localStorage? }`
     * - `BearerCredential` -- `{ type: "bearer", accessToken, refreshToken?, expiresAt?, scopes?, tokenEndpoint?, xHeaders?, localStorage? }`
     * - `ApiKeyCredential` -- `{ type: "api-key", key, headerName, headerPrefix? }`
     * - `BasicCredential` -- `{ type: "basic", username, password }`
     *
     * @param providerId - The provider identifier (e.g. "my-jira", "github")
     * @returns A promise resolving to the `Credential` object, or `null` if not found
     *
     * @example
     * ```typescript
     * const cred = await client.getCredential('github');
     * if (cred?.type === 'bearer') {
     *   console.log('Token expires at:', cred.expiresAt);
     * }
     * ```
     */
    async getCredential(providerId: string): Promise<Credential | null> {
        try {
            const file = await readProviderFile(providerId, this.credentialsDir);
            return file.credential;
        } catch {
            return null;
        }
    }

    /**
     * Get extracted localStorage values for a provider.
     *
     * Returns a plain object of key-value string pairs extracted from the browser's
     * localStorage during authentication. Only `cookie` and `bearer` credential types
     * can carry localStorage values; `api-key` and `basic` always return `{}`.
     *
     * This is useful for services like Slack where an additional token (e.g. `xoxc`)
     * is stored in localStorage alongside session cookies.
     *
     * @param providerId - The provider identifier (e.g. "my-slack")
     * @returns A promise resolving to `Record<string, string>`, or `{}` if not found
     *
     * @example
     * ```typescript
     * const ls = await client.getLocalStorage('my-slack');
     * // { "token": "xoxc-123-456" }
     * ```
     */
    async getLocalStorage(providerId: string): Promise<Record<string, string>> {
        try {
            const file = await readProviderFile(providerId, this.credentialsDir);
            return extractLocalStorage(file.credential);
        } catch {
            return {};
        }
    }

    /**
     * List all providers that have credential files in the credentials directory.
     *
     * @returns A promise resolving to an array of `ProviderInfo` objects
     *
     * @example
     * ```typescript
     * const providers = await client.listProviders();
     * for (const p of providers) {
     *   console.log(`${p.providerId} (${p.credentialType}) updated ${p.updatedAt}`);
     * }
     * ```
     */
    async listProviders(): Promise<ProviderInfo[]> {
        return listProviderFiles(this.credentialsDir);
    }

    /**
     * Start watching the credentials directory for changes.
     *
     * When a credential file is created, modified, or deleted, the client emits
     * a `'change'` event with `(providerId, headers)`. If reading the updated
     * credential fails, an empty headers object is emitted.
     *
     * Watcher errors are emitted as `'error'` events.
     *
     * @example
     * ```typescript
     * client.on('change', (providerId, headers) => {
     *   console.log(`${providerId} credentials updated`);
     * });
     * client.watch();
     * ```
     */
    watch(): void {
        if (this.watcher) return;
        this.watcher = new CredentialWatcher(this.credentialsDir);

        this.watcher.on('change', (providerId: string) => {
            void (async () => {
                try {
                    const headers = await this.getHeaders(providerId);
                    this.emit('change', providerId, headers);
                } catch {
                    this.emit('change', providerId, {});
                }
            })();
        });

        this.watcher.on('error', (err: Error) => {
            this.emit('error', err);
        });

        this.watcher.start();
    }

    /**
     * Stop watching and clean up resources.
     *
     * Safe to call multiple times. After calling `close()`, the client can be
     * restarted by calling `watch()` again.
     */
    close(): void {
        if (this.watcher) {
            this.watcher.stop();
            this.watcher = null;
        }
    }
}
