import type { AuthDeps } from '../../deps.js';
import { getRemote, getRemotes } from '../../sync/remote-config.js';
import { SyncEngine } from '../../sync/sync-engine.js';
import { SshTransport } from '../../sync/transports/ssh.js';
import { formatJson } from '../formatters.js';
import { ExitCode } from '../exit-codes.js';
import { SyncSubcommand } from '../../core/constants.js';

export async function runSync(
  positionals: string[],
  flags: Record<string, string | boolean | string[]>,
  deps: AuthDeps,
): Promise<void> {
  const subcommand = positionals[0];

  if (subcommand !== SyncSubcommand.PUSH && subcommand !== SyncSubcommand.PULL) {
    process.stderr.write('Usage: sig sync <push|pull> [remote] [--provider <id>] [--force]\n');
    process.exitCode = ExitCode.GENERAL_ERROR;
    return;
  }

  // Resolve remote: explicit name or default (if only one configured)
  const remoteName = positionals[1];
  let remote;

  if (remoteName) {
    remote = await getRemote(remoteName);
    if (!remote) {
      process.stderr.write(
        `Remote "${remoteName}" not found. Run "sig remote list" to see configured remotes.\n`,
      );
      process.exitCode = ExitCode.REMOTE_NOT_FOUND;
      return;
    }
  } else {
    const remotes = await getRemotes();
    if (remotes.length === 0) {
      process.stderr.write('No remotes configured. Run "sig remote add <name> <host>" first.\n');
      process.exitCode = ExitCode.REMOTE_NOT_FOUND;
      return;
    }
    if (remotes.length > 1) {
      process.stderr.write('Multiple remotes configured. Specify which one:\n');
      for (const r of remotes) {
        process.stderr.write(`  ${r.name} (${r.host})\n`);
      }
      process.exitCode = ExitCode.GENERAL_ERROR;
      return;
    }
    remote = remotes[0];
  }

  const engine = new SyncEngine(deps.storage, remote, deps.config, new SshTransport());
  const force = flags.force === true;
  const provider = typeof flags.provider === 'string' ? [flags.provider] : undefined;

  process.stderr.write(
    `${subcommand === SyncSubcommand.PUSH ? 'Pushing' : 'Pulling'} credentials ${subcommand === SyncSubcommand.PUSH ? 'to' : 'from'} "${remote.name}" (${remote.host})...\n`,
  );

  const result =
    subcommand === SyncSubcommand.PUSH
      ? await engine.push(provider, force)
      : await engine.pull(provider, force);

  // Report results
  const synced = subcommand === SyncSubcommand.PUSH ? result.pushed : result.pulled;
  if (synced.length > 0) {
    process.stderr.write(`Synced: ${synced.join(', ')}\n`);
  }
  if (result.skipped.length > 0) {
    process.stderr.write(
      `Skipped (conflict): ${result.skipped.join(', ')} — use --force to overwrite\n`,
    );
  }
  if (result.errors.length > 0) {
    for (const e of result.errors) {
      process.stderr.write(`Error (${e.providerId}): ${e.error}\n`);
    }
    process.exitCode = ExitCode.REMOTE_NOT_FOUND;
  }

  // Report config sync results
  if (result.configSynced.providers.length > 0) {
    process.stderr.write(`Config: ${result.configSynced.providers.join(', ')}\n`);
  }
  if (result.configSynced.error) {
    process.stderr.write(`Config warning: ${result.configSynced.error}\n`);
  }

  // JSON output to stdout
  process.stdout.write(formatJson(result) + '\n');
}
