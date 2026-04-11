/**
 * Error hierarchy for signet.
 * These are used as Result.err values, NOT thrown for control flow.
 * Only truly unexpected errors (programmer bugs, I/O failures) are thrown.
 */

export type AuthErrorCode =
  | 'PROVIDER_NOT_FOUND'
  | 'CREDENTIAL_NOT_FOUND'
  | 'CREDENTIAL_EXPIRED'
  | 'CREDENTIAL_TYPE_MISMATCH'
  | 'REFRESH_FAILED'
  | 'BROWSER_ERROR'
  | 'BROWSER_LAUNCH_ERROR'
  | 'BROWSER_TIMEOUT'
  | 'BROWSER_NAVIGATION_ERROR'
  | 'STORAGE_ERROR'
  | 'CONFIG_ERROR'
  | 'MANUAL_SETUP_REQUIRED'
  | 'SYNC_ERROR'
  | 'REMOTE_NOT_FOUND'
  | 'BROWSER_UNAVAILABLE'
  | 'SYNC_CONFLICT';

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: AuthErrorCode,
    public readonly providerId?: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ProviderNotFoundError extends AuthError {
  constructor(urlOrId: string) {
    super(
      `No provider matches "${urlOrId}". Check your config.yaml or run "sig providers" to see configured ones.`,
      'PROVIDER_NOT_FOUND',
    );
    this.name = 'ProviderNotFoundError';
  }
}

export class CredentialNotFoundError extends AuthError {
  constructor(providerId: string) {
    super(
      `No stored credentials for provider "${providerId}". Run "sig login" first.`,
      'CREDENTIAL_NOT_FOUND',
      providerId,
    );
    this.name = 'CredentialNotFoundError';
  }
}

export class CredentialExpiredError extends AuthError {
  constructor(providerId: string) {
    super(
      `Credentials for "${providerId}" have expired and could not be refreshed.`,
      'CREDENTIAL_EXPIRED',
      providerId,
    );
    this.name = 'CredentialExpiredError';
  }
}

export class CredentialTypeError extends AuthError {
  constructor(providerId: string, expected: string[], actual: string) {
    super(
      `Provider "${providerId}" expects credential type [${expected.join(', ')}] but got "${actual}".`,
      'CREDENTIAL_TYPE_MISMATCH',
      providerId,
    );
    this.name = 'CredentialTypeError';
  }
}

export class RefreshError extends AuthError {
  constructor(providerId: string, reason: string) {
    super(`Token refresh failed for "${providerId}": ${reason}`, 'REFRESH_FAILED', providerId);
    this.name = 'RefreshError';
  }
}

export class BrowserError extends AuthError {
  constructor(message: string, providerId?: string) {
    super(message, 'BROWSER_ERROR', providerId);
    this.name = 'BrowserError';
  }
}

export class BrowserLaunchError extends AuthError {
  constructor(reason: string) {
    super(`Failed to launch browser: ${reason}`, 'BROWSER_LAUNCH_ERROR');
    this.name = 'BrowserLaunchError';
  }
}

export class BrowserTimeoutError extends AuthError {
  constructor(operation: string, timeoutMs: number, providerId?: string) {
    super(
      `Browser operation "${operation}" timed out after ${timeoutMs}ms`,
      'BROWSER_TIMEOUT',
      providerId,
    );
    this.name = 'BrowserTimeoutError';
  }
}

export class BrowserNavigationError extends AuthError {
  constructor(url: string, reason: string, providerId?: string) {
    super(`Failed to navigate to ${url}: ${reason}`, 'BROWSER_NAVIGATION_ERROR', providerId);
    this.name = 'BrowserNavigationError';
  }
}

export class BrowserUnavailableError extends AuthError {
  constructor(reason: string) {
    super(
      `Browser is not available: ${reason}. ` +
        'On headless machines, use "sig login --token <token>" or "sig sync pull" to get credentials.',
      'BROWSER_UNAVAILABLE',
    );
    this.name = 'BrowserUnavailableError';
  }
}

export class StorageError extends AuthError {
  constructor(operation: string, reason: string) {
    super(`Storage ${operation} failed: ${reason}`, 'STORAGE_ERROR');
    this.name = 'StorageError';
  }
}

export class ConfigError extends AuthError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}

export class ManualSetupRequired extends AuthError {
  constructor(
    providerId: string,
    public readonly instructions: string,
  ) {
    super(
      `Provider "${providerId}" requires manual setup. ${instructions}`,
      'MANUAL_SETUP_REQUIRED',
      providerId,
    );
    this.name = 'ManualSetupRequired';
  }
}

export class SyncError extends AuthError {
  constructor(message: string, providerId?: string) {
    super(message, 'SYNC_ERROR', providerId);
    this.name = 'SyncError';
  }
}

export class RemoteNotFoundError extends AuthError {
  constructor(remoteName: string) {
    super(
      `Remote "${remoteName}" not found. Run "sig remote add ${remoteName} <host>" first.`,
      'REMOTE_NOT_FOUND',
    );
    this.name = 'RemoteNotFoundError';
  }
}

export class SyncConflictError extends AuthError {
  constructor(providerId: string, localUpdated: string, remoteUpdated: string) {
    super(
      `Conflict for "${providerId}": local updated ${localUpdated}, remote updated ${remoteUpdated}. Use --force to overwrite.`,
      'SYNC_CONFLICT',
      providerId,
    );
    this.name = 'SyncConflictError';
  }
}
