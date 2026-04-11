/**
 * Runtime validation for the unified signet config.
 * Returns Result<SignetConfig, AuthError>.
 */

import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import { ConfigError, type AuthError } from '../core/errors.js';
import type {
  SignetConfig,
  BrowserConfig,
  StorageConfig,
  ProviderEntry,
  RemoteEntry,
  WatchEntry,
  WatchProviderEntry,
  StrategyName as StrategyNameType,
  StrategyConfig,
} from './schema.js';
import { StrategyName, WaitUntil } from '../core/constants.js';

const VALID_STRATEGIES: readonly StrategyNameType[] = [
  StrategyName.COOKIE,
  StrategyName.OAUTH2,
  StrategyName.API_TOKEN,
  StrategyName.BASIC,
];
const VALID_WAIT_UNTIL: readonly string[] = [
  WaitUntil.LOAD,
  WaitUntil.NETWORK_IDLE,
  WaitUntil.DOM_CONTENT_LOADED,
  WaitUntil.COMMIT,
];

/**
 * Validate a raw config object parsed from YAML.
 */
export function validateConfig(raw: Record<string, unknown>): Result<SignetConfig, AuthError> {
  const errors: string[] = [];

  // --- mode ---
  const VALID_MODES = ['browser', 'browserless'];
  if (raw.mode !== undefined && !VALID_MODES.includes(raw.mode as string)) {
    errors.push(`mode must be one of: ${VALID_MODES.join(', ')}`);
  }

  // --- browser section ---
  if (!raw.browser || typeof raw.browser !== 'object') {
    errors.push('Missing required section: "browser"');
  } else {
    const browser = raw.browser as Record<string, unknown>;
    if (typeof browser.browserDataDir !== 'string' || browser.browserDataDir.trim() === '') {
      errors.push('Missing required field: browser.browserDataDir');
    }
    if (typeof browser.channel !== 'string' || browser.channel.trim() === '') {
      errors.push('Missing required field: browser.channel');
    }
    if (browser.headlessTimeout !== undefined && typeof browser.headlessTimeout !== 'number') {
      errors.push('browser.headlessTimeout must be a number');
    }
    if (browser.visibleTimeout !== undefined && typeof browser.visibleTimeout !== 'number') {
      errors.push('browser.visibleTimeout must be a number');
    }
    if (
      browser.waitUntil !== undefined &&
      !VALID_WAIT_UNTIL.includes(browser.waitUntil as string)
    ) {
      errors.push(`browser.waitUntil must be one of: ${VALID_WAIT_UNTIL.join(', ')}`);
    }
  }

  // --- storage section ---
  if (!raw.storage || typeof raw.storage !== 'object') {
    errors.push('Missing required section: "storage"');
  } else {
    const storage = raw.storage as Record<string, unknown>;
    if (typeof storage.credentialsDir !== 'string' || storage.credentialsDir.trim() === '') {
      errors.push('Missing required field: storage.credentialsDir');
    }
  }

  // --- providers section (optional — null/missing means zero providers) ---
  if (raw.providers !== undefined && raw.providers !== null) {
    if (typeof raw.providers !== 'object') {
      errors.push('"providers" must be an object (or omitted)');
    } else {
      const providers = raw.providers as Record<string, unknown>;
      for (const [id, entry] of Object.entries(providers)) {
        if (!entry || typeof entry !== 'object') {
          errors.push(`Provider "${id}": must be an object`);
          continue;
        }
        const providerErrors = validateProviderEntry(id, entry as Record<string, unknown>);
        errors.push(...providerErrors);
      }
    }
  }

  // --- remotes section (optional) ---
  if (raw.remotes !== undefined) {
    if (typeof raw.remotes !== 'object' || raw.remotes === null) {
      errors.push('"remotes" must be an object');
    } else {
      const remotes = raw.remotes as Record<string, unknown>;
      for (const [name, entry] of Object.entries(remotes)) {
        if (!entry || typeof entry !== 'object') {
          errors.push(`Remote "${name}": must be an object`);
          continue;
        }
        const r = entry as Record<string, unknown>;
        if (r.type !== 'ssh') {
          errors.push(`Remote "${name}": only type "ssh" is supported`);
        }
        if (typeof r.host !== 'string' || r.host.trim() === '') {
          errors.push(`Remote "${name}": missing required field "host"`);
        }
      }
    }
  }

  // --- watch section (optional) ---
  if (raw.watch !== undefined && raw.watch !== null) {
    if (typeof raw.watch !== 'object') {
      errors.push('"watch" must be an object');
    } else {
      const watch = raw.watch as Record<string, unknown>;
      if (watch.interval !== undefined && typeof watch.interval !== 'string') {
        errors.push('watch.interval must be a string (e.g. "5m", "1h")');
      }
      if (watch.providers !== undefined && watch.providers !== null) {
        if (typeof watch.providers !== 'object') {
          errors.push('watch.providers must be an object');
        } else {
          const wp = watch.providers as Record<string, unknown>;
          for (const [id, opts] of Object.entries(wp)) {
            if (opts !== null && opts !== undefined && typeof opts === 'object') {
              const o = opts as Record<string, unknown>;
              if (o.autoSync !== undefined) {
                if (!Array.isArray(o.autoSync)) {
                  errors.push(`watch.providers.${id}.autoSync must be an array of remote names`);
                } else {
                  for (const r of o.autoSync) {
                    if (typeof r !== 'string') {
                      errors.push(`watch.providers.${id}.autoSync entries must be strings`);
                      break;
                    }
                  }
                }
              }
            } else if (opts !== null && opts !== undefined) {
              errors.push(`watch.providers.${id} must be an object or null`);
            }
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return err(new ConfigError(`Config validation failed:\n  - ${errors.join('\n  - ')}`));
  }

  // Build the validated config
  const browserRaw = raw.browser as Record<string, unknown>;
  const mode = raw.mode === 'browserless' ? ('browserless' as const) : ('browser' as const);

  const browser: BrowserConfig = {
    browserDataDir: browserRaw.browserDataDir as string,
    channel: browserRaw.channel as string,
    headlessTimeout:
      typeof browserRaw.headlessTimeout === 'number' ? browserRaw.headlessTimeout : 30_000,
    visibleTimeout:
      typeof browserRaw.visibleTimeout === 'number' ? browserRaw.visibleTimeout : 120_000,
    waitUntil:
      typeof browserRaw.waitUntil === 'string'
        ? (browserRaw.waitUntil as BrowserConfig['waitUntil'])
        : WaitUntil.LOAD,
  };

  const storageRaw = raw.storage as Record<string, unknown>;
  const storage: StorageConfig = {
    credentialsDir: storageRaw.credentialsDir as string,
  };

  const providers: Record<string, ProviderEntry> = {};
  if (raw.providers && typeof raw.providers === 'object') {
    for (const [id, entry] of Object.entries(raw.providers as Record<string, unknown>)) {
      providers[id] = parseProviderEntry(entry as Record<string, unknown>);
    }
  }

  let remotes: Record<string, RemoteEntry> | undefined;
  if (raw.remotes && typeof raw.remotes === 'object') {
    remotes = {};
    for (const [name, entry] of Object.entries(raw.remotes as Record<string, unknown>)) {
      const r = entry as Record<string, unknown>;
      remotes[name] = {
        type: 'ssh',
        host: r.host as string,
        ...(typeof r.user === 'string' ? { user: r.user } : {}),
        ...(typeof r.path === 'string' ? { path: r.path } : {}),
        ...(typeof r.sshKey === 'string' ? { sshKey: r.sshKey } : {}),
      };
    }
  }

  let watch: WatchEntry | undefined;
  if (raw.watch && typeof raw.watch === 'object') {
    const w = raw.watch as Record<string, unknown>;
    if (typeof w.interval !== 'string') {
      errors.push('watch: missing required field "interval"');
    }
    if (!w.providers || typeof w.providers !== 'object') {
      errors.push('watch: missing required field "providers"');
    }
    const watchProviders: Record<string, WatchProviderEntry | null> = {};
    if (w.providers && typeof w.providers === 'object') {
      for (const [id, opts] of Object.entries(w.providers as Record<string, unknown>)) {
        if (opts === null || opts === undefined) {
          watchProviders[id] = null;
        } else {
          const o = opts as Record<string, unknown>;
          watchProviders[id] = {
            ...(Array.isArray(o.autoSync) ? { autoSync: o.autoSync as string[] } : {}),
          };
        }
      }
    }
    watch = {
      interval: w.interval as string,
      providers: watchProviders,
    };
  }

  const config: SignetConfig = {
    mode,
    browser,
    storage,
    providers,
    ...(remotes ? { remotes } : {}),
    ...(watch ? { watch } : {}),
  };

  return ok(config);
}

function validateProviderEntry(id: string, raw: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (!Array.isArray(raw.domains) || raw.domains.length === 0) {
    errors.push(`Provider "${id}": missing required field "domains" (non-empty array)`);
  } else {
    for (const d of raw.domains) {
      if (typeof d !== 'string') {
        errors.push(`Provider "${id}": domains must be strings`);
        break;
      }
    }
  }

  if (typeof raw.entryUrl !== 'string' || raw.entryUrl.length === 0) {
    errors.push(`Provider "${id}": missing required field "entryUrl"`);
  }

  if (typeof raw.strategy !== 'string') {
    errors.push(`Provider "${id}": missing required field "strategy"`);
  } else if (!VALID_STRATEGIES.includes(raw.strategy as StrategyNameType)) {
    errors.push(
      `Provider "${id}": invalid strategy "${raw.strategy}". ` +
        `Valid strategies: ${VALID_STRATEGIES.join(', ')}`,
    );
  }

  // Validate forceVisible at provider level
  if (raw.forceVisible !== undefined && typeof raw.forceVisible !== 'boolean') {
    errors.push(`Provider "${id}": forceVisible must be a boolean`);
  }

  // Validate strategy-specific config shape
  if (typeof raw.strategy === 'string' && raw.config && typeof raw.config === 'object') {
    const strategyErrors = validateStrategyConfig(
      id,
      raw.strategy as StrategyNameType,
      raw.config as Record<string, unknown>,
    );
    errors.push(...strategyErrors);
  }

  return errors;
}

function validateStrategyConfig(
  id: string,
  strategy: StrategyNameType,
  config: Record<string, unknown>,
): string[] {
  const errors: string[] = [];

  // Cross-strategy field checks: warn about fields that don't belong
  if (strategy === StrategyName.COOKIE) {
    const oauthFields = ['audiences', 'tokenEndpoint', 'clientId', 'scopes'];
    for (const field of oauthFields) {
      if (config[field] !== undefined) {
        errors.push(
          `Provider "${id}": config.${field} is not valid for strategy "${StrategyName.COOKIE}"`,
        );
      }
    }
  }

  if (strategy === StrategyName.OAUTH2) {
    const cookieFields = ['ttl', 'requiredCookies'];
    for (const field of cookieFields) {
      if (config[field] !== undefined) {
        errors.push(
          `Provider "${id}": config.${field} is not valid for strategy "${StrategyName.OAUTH2}"`,
        );
      }
    }
  }

  return errors;
}

/**
 * Merge a provider entry's strategy + config into a typed StrategyConfig.
 */
export function buildStrategyConfig(
  strategy: StrategyNameType,
  config?: Record<string, unknown>,
): StrategyConfig {
  const c = config ?? {};

  switch (strategy) {
    case StrategyName.COOKIE:
      return {
        strategy: StrategyName.COOKIE,
        ...(typeof c.ttl === 'string' ? { ttl: c.ttl } : {}),
        ...(Array.isArray(c.requiredCookies)
          ? { requiredCookies: c.requiredCookies as string[] }
          : {}),
      };

    case StrategyName.OAUTH2:
      return {
        strategy: StrategyName.OAUTH2,
        ...(Array.isArray(c.audiences) ? { audiences: c.audiences as string[] } : {}),
        ...(typeof c.tokenEndpoint === 'string' ? { tokenEndpoint: c.tokenEndpoint } : {}),
        ...(typeof c.clientId === 'string' ? { clientId: c.clientId } : {}),
        ...(Array.isArray(c.scopes) ? { scopes: c.scopes as string[] } : {}),
      };

    case StrategyName.API_TOKEN:
      return {
        strategy: StrategyName.API_TOKEN,
        ...(typeof c.headerName === 'string' ? { headerName: c.headerName } : {}),
        ...(typeof c.headerPrefix === 'string' ? { headerPrefix: c.headerPrefix } : {}),
        ...(typeof c.setupInstructions === 'string'
          ? { setupInstructions: c.setupInstructions }
          : {}),
      };

    case StrategyName.BASIC:
      return {
        strategy: StrategyName.BASIC,
        ...(typeof c.setupInstructions === 'string'
          ? { setupInstructions: c.setupInstructions }
          : {}),
      };
  }
}

function parseProviderEntry(raw: Record<string, unknown>): ProviderEntry {
  return {
    ...(typeof raw.name === 'string' ? { name: raw.name } : {}),
    domains: raw.domains as string[],
    entryUrl: raw.entryUrl as string,
    strategy: raw.strategy as StrategyNameType,
    ...(raw.config && typeof raw.config === 'object'
      ? { config: raw.config as Record<string, unknown> }
      : {}),
    ...(Array.isArray(raw.acceptedCredentialTypes)
      ? { acceptedCredentialTypes: raw.acceptedCredentialTypes }
      : {}),
    ...(typeof raw.setupInstructions === 'string'
      ? { setupInstructions: raw.setupInstructions }
      : {}),
    ...(Array.isArray(raw.xHeaders) ? { xHeaders: raw.xHeaders } : {}),
    ...(typeof raw.forceVisible === 'boolean' ? { forceVisible: raw.forceVisible } : {}),
  };
}
