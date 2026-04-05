import type { IAuthStrategy, IAuthStrategyFactory, AuthContext } from '../core/interfaces/auth-strategy.js';
import type { Credential, ApiKeyCredential, ProviderConfig } from '../core/types.js';
import type { StrategyConfig, ApiTokenStrategyConfig } from '../config/schema.js';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import { ManualSetupRequired, type AuthError } from '../core/errors.js';
import { decodeJwt } from '../utils/jwt.js';

const DEFAULT_HEADER_NAME = 'Authorization';
const DEFAULT_HEADER_PREFIX = 'Bearer';
const DEFAULT_SETUP_INSTRUCTIONS = 'Please provide an API token or Personal Access Token.';

/**
 * Static API token strategy.
 * User provides the token manually — no browser automation needed.
 * Optionally checks JWT expiry if the token is a JWT.
 */
class ApiTokenStrategy implements IAuthStrategy {
  private readonly headerName: string;
  private readonly headerPrefix: string;
  private readonly setupInstructions: string;

  constructor(config: ApiTokenStrategyConfig) {
    this.headerName = config.headerName ?? DEFAULT_HEADER_NAME;
    this.headerPrefix = config.headerPrefix ?? DEFAULT_HEADER_PREFIX;
    this.setupInstructions = config.setupInstructions ?? DEFAULT_SETUP_INSTRUCTIONS;
  }

  validate(credential: Credential): Result<boolean, AuthError> {
    if (credential.type !== 'api-key') {
      return ok(false);
    }

    if (!credential.key || credential.key.trim() === '') {
      return ok(false);
    }

    // If the key looks like a JWT, check its expiry
    const jwt = decodeJwt(credential.key);
    if (jwt?.exp) {
      const expiresAtMs = jwt.exp * 1000;
      if (Date.now() >= expiresAtMs) {
        return ok(false);
      }
    }

    return ok(true);
  }

  async authenticate(
    provider: ProviderConfig,
  ): Promise<Result<Credential, AuthError>> {
    // API tokens cannot be obtained automatically — user must provide them.
    return err(
      new ManualSetupRequired(
        provider.id,
        this.setupInstructions,
      ),
    );
  }

  async refresh(): Promise<Result<Credential | null, AuthError>> {
    // Static tokens cannot be refreshed
    return ok(null);
  }

  applyToRequest(credential: Credential): Record<string, string> {
    if (credential.type !== 'api-key') return {};

    const value = this.headerPrefix
      ? `${this.headerPrefix} ${credential.key}`
      : credential.key;

    return { [this.headerName]: value };
  }
}

export class ApiTokenStrategyFactory implements IAuthStrategyFactory {
  readonly name = 'api-token';

  create(config: StrategyConfig): IAuthStrategy {
    if (config.strategy !== 'api-token') {
      throw new Error(`ApiTokenStrategyFactory received wrong config type: ${config.strategy}`);
    }
    return new ApiTokenStrategy(config);
  }
}
