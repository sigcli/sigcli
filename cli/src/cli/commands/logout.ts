import type { AuthDeps } from '../../deps.js';

export async function runLogout(
  positionals: string[],
  flags: Record<string, string | boolean>,
  deps: AuthDeps,
): Promise<void> {
  const providerId = positionals[0];

  if (providerId) {
    await deps.authManager.clearCredentials(providerId);
    process.stderr.write(`Credentials cleared for "${providerId}".\n`);
  } else {
    await deps.authManager.clearAll();
    process.stderr.write('All credentials cleared.\n');
  }
}
