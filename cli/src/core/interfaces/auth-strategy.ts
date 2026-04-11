import type { Result } from '../result.js';
import type { AuthError } from '../errors.js';
import type {
  Credential,
  CredentialResult,
  ProviderConfig,
  StrategyConfig,
} from '../types.js';
import type { IBrowserAdapter } from './browser-adapter.js';
import type { ILogger } from '../types.js';
import type { BrowserConfig } from '../../config/schema.js';

/**
 * Context provided to strategies during authentication.
 * Browser adapter is optional — strategies that don't need a browser (api-token, basic)
 * simply ignore it.
 */
export interface AuthContext {
  browserAdapter: IBrowserAdapter;
  browserConfig: BrowserConfig;
  logger?: ILogger;
}

/**
 * Core strategy interface — implements a specific authentication method.
 *
 * Each method returns Result<T, AuthError> instead of throwing.
 * This ensures expected failures (expired tokens, manual setup needed)
 * are handled through types, not catch blocks.
 */
export interface IAuthStrategy {
  /** Check if a credential is still valid (not expired, not revoked). */
  validate(credential: Credential, config: StrategyConfig): Result<boolean, AuthError>;

  /** Perform fresh authentication. May launch a browser. */
  authenticate(
    provider: ProviderConfig,
    context: AuthContext,
  ): Promise<Result<CredentialResult, AuthError>>;

  /**
   * Try to refresh an expired credential without full re-authentication.
   * Returns ok(null) if refresh is not supported by this strategy.
   * Returns ok(credential) if refresh succeeded.
   * Returns err() if refresh was attempted but failed.
   */
  refresh(
    credential: Credential,
    config: StrategyConfig,
  ): Promise<Result<Credential | null, AuthError>>;

  /** Convert a credential into HTTP headers for an outgoing request. */
  applyToRequest(credential: Credential): Record<string, string>;
}

/**
 * Factory for creating strategy instances from YAML config.
 * Each factory is registered in the StrategyRegistry by name.
 */
export interface IAuthStrategyFactory {
  /** Strategy name as used in provider config (e.g. "cookie", "oauth2") */
  readonly name: string;

  /** Create a strategy instance with the given config */
  create(config: StrategyConfig): IAuthStrategy;
}
