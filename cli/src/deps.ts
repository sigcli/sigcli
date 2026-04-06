import os from 'node:os';
import type { IStorage } from './core/interfaces/storage.js';
import type { ProviderConfig } from './core/types.js';
import type { SignetConfig } from './config/schema.js';
import { AuthManager } from './auth-manager.js';
import { StrategyRegistry } from './strategies/registry.js';
import { CookieStrategyFactory } from './strategies/cookie.strategy.js';
import { OAuth2StrategyFactory } from './strategies/oauth2.strategy.js';
import { ApiTokenStrategyFactory } from './strategies/api-token.strategy.js';
import { BasicAuthStrategyFactory } from './strategies/basic-auth.strategy.js';
import { ProviderRegistry } from './providers/provider-registry.js';
import { DirectoryStorage } from './storage/directory-storage.js';
import { CachedStorage } from './storage/cached-storage.js';
import { PlaywrightAdapter } from './browser/adapters/playwright.adapter.js';
import { NullBrowserAdapter } from './browser/adapters/null.adapter.js';
import { buildStrategyConfig } from './config/validator.js';

/**
 * Shared dependency graph used by the CLI and programmatic API.
 */
export interface AuthDeps {
  authManager: AuthManager;
  storage: IStorage;
  providerRegistry: ProviderRegistry;
  strategyRegistry: StrategyRegistry;
  config: SignetConfig;
  browserAvailable: boolean;
}

/**
 * Create the auth dependency graph from a validated SignetConfig.
 * No env vars, no cascade — config is the single source of truth.
 */
export function createAuthDeps(config: SignetConfig): AuthDeps {
  // 1. Convert config providers to ProviderConfig[]
  const providerConfigs: ProviderConfig[] = Object.entries(config.providers).map(
    ([id, entry]) => ({
      id,
      name: entry.name ?? id,
      domains: entry.domains,
      entryUrl: entry.entryUrl,
      strategy: entry.strategy,
      strategyConfig: buildStrategyConfig(entry.strategy, entry.config),
      acceptedCredentialTypes: entry.acceptedCredentialTypes,
      setupInstructions: entry.setupInstructions,
      credentialFile: entry.credentialFile,
      xHeaders: entry.xHeaders,
      ...(entry.forceVisible !== undefined ? { forceVisible: entry.forceVisible } : {}),
    }),
  );

  const providerRegistry = new ProviderRegistry(providerConfigs);

  // 2. Build strategy registry with built-in strategies
  const strategyRegistry = new StrategyRegistry();
  strategyRegistry.register(new CookieStrategyFactory());
  strategyRegistry.register(new OAuth2StrategyFactory());
  strategyRegistry.register(new ApiTokenStrategyFactory());
  strategyRegistry.register(new BasicAuthStrategyFactory());

  // 3. Build storage (CachedStorage wrapping DirectoryStorage)
  const credDir = config.storage.credentialsDir.replace(/^~/, os.homedir());
  const storage = new CachedStorage(
    new DirectoryStorage(credDir),
    { ttlMs: 5000 },
  );

  // 4. Build browser adapter factory using config.browser
  const browserConfig = config.browser;
  const browserAvailable = config.mode !== 'browserless';
  const browserAdapterFactory = browserAvailable
    ? () => new PlaywrightAdapter(browserConfig)
    : () => new NullBrowserAdapter('Running in browserless mode (mode: browserless)');

  // 5. Build AuthManager
  const authManager = new AuthManager({
    storage,
    strategyRegistry,
    providerRegistry,
    browserAdapterFactory,
    browserConfig,
  });

  return { authManager, storage, providerRegistry, strategyRegistry, config, browserAvailable };
}
