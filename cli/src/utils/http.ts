import os from 'node:os';

/**
 * Build a User-Agent string identifying signet.
 */
export function buildUserAgent(): string {
  const platform = os.platform();
  const arch = os.arch();
  const nodeVersion = process.version;
  return `signet/1.0.0 (${platform}; ${arch}) Node/${nodeVersion}`;
}
