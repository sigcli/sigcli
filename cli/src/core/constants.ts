import pkg from '../../package.json' with { type: 'json' };

/**
 * Shared constants for SigCLI.
 * Centralizes magic strings and patterns to avoid duplication across modules.
 */

/**
 * CLI command names used in the main router and help text.
 */
export const Command = {
    INIT: 'init',
    DOCTOR: 'doctor',
    GET: 'get',
    LOGIN: 'login',
    REQUEST: 'request',
    STATUS: 'status',
    LOGOUT: 'logout',
    PROVIDERS: 'providers',
    REMOTE: 'remote',
    SYNC: 'sync',
    WATCH: 'watch',
    RENAME: 'rename',
    REMOVE: 'remove',
    COMPLETION: 'completion',
    RUN: 'run',
    HELP: 'help',
} as const;

/**
 * Subcommands for the 'remote' command.
 */
export const RemoteSubcommand = {
    ADD: 'add',
    REMOVE: 'remove',
    LIST: 'list',
} as const;

/**
 * Subcommands for the 'sync' command.
 */
export const SyncSubcommand = {
    PUSH: 'push',
    PULL: 'pull',
} as const;

/**
 * Subcommands for the 'watch' command.
 */
export const WatchSubcommand = {
    ADD: 'add',
    REMOVE: 'remove',
    LIST: 'list',
    START: 'start',
    SET_INTERVAL: 'set-interval',
} as const;

/**
 * Page load wait conditions for browser navigation.
 */
export const WaitUntil = {
    LOAD: 'load',
    NETWORK_IDLE: 'networkidle',
    DOM_CONTENT_LOADED: 'domcontentloaded',
    COMMIT: 'commit',
} as const;

export type WaitUntilValue = (typeof WaitUntil)[keyof typeof WaitUntil];

/**
 * Strategy names matching StrategyConfig discriminator values.
 */
export const StrategyName = {
    COOKIE: 'cookie',
    OAUTH2: 'oauth2',
    API_TOKEN: 'api-token',
    BASIC: 'basic',
} as const;

/**
 * Credential type discriminators matching the Credential union.
 */
export const CredentialTypeName = {
    COOKIE: 'cookie',
    BEARER: 'bearer',
    API_KEY: 'api-key',
    BASIC: 'basic',
} as const;

/**
 * Strategies that require a browser for authentication.
 */
export const BROWSER_REQUIRED_STRATEGIES: ReadonlySet<string> = new Set([
    StrategyName.COOKIE,
    StrategyName.OAUTH2,
]);

/**
 * URL patterns that indicate a login/auth page.
 */
export const LOGIN_URL_PATTERNS: readonly string[] = [
    '/login',
    '/signin',
    '/sign-in',
    '/auth',
    '/sso',
    '/oauth',
    '/adfs/',
    '/saml/',
    'login.microsoftonline.com',
    'accounts.google.com',
] as const;

/**
 * HTTP header names.
 */
export const HttpHeader = {
    AUTHORIZATION: 'Authorization',
    COOKIE: 'Cookie',
    CONTENT_TYPE: 'Content-Type',
    USER_AGENT: 'User-Agent',
} as const;

/**
 * Authorization scheme prefixes.
 */
export const AuthScheme = {
    BEARER: 'Bearer',
    BASIC: 'Basic',
} as const;

/**
 * Output format options for `sig get`.
 */
export const OutputFormat = {
    JSON: 'json',
    HEADER: 'header',
    VALUE: 'value',
} as const;

export type OutputFormatValue = (typeof OutputFormat)[keyof typeof OutputFormat];

/**
 * Application identity.
 */
export const APP_NAME = 'sig';
export const APP_VERSION = pkg.version;

/**
 * Default configuration directory and filename.
 */
export const SIG_DIR = '.sig';
export const CONFIG_FILENAME = 'config.yaml';
