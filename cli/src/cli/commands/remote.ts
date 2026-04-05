import { getRemotes, addRemote, removeRemote } from '../../sync/remote-config.js';
import type { RemoteConfig } from '../../sync/types.js';
import { formatJson, formatTable } from '../formatters.js';

export async function runRemote(positionals: string[], flags: Record<string, string | boolean>): Promise<void> {
  const subcommand = positionals[0];

  switch (subcommand) {
    case 'add': {
      const name = positionals[1];
      const host = positionals[2];
      if (!name || !host) {
        process.stderr.write('Usage: sig remote add <name> <host> [--user <user>] [--path <path>] [--ssh-key <key>]\n');
        process.exitCode = 1;
        return;
      }
      const remote: RemoteConfig = {
        name,
        type: 'ssh',
        host,
        ...(typeof flags.user === 'string' ? { user: flags.user } : {}),
        ...(typeof flags.path === 'string' ? { path: flags.path } : {}),
        ...(typeof flags['ssh-key'] === 'string' ? { sshKey: flags['ssh-key'] } : {}),
      };
      await addRemote(remote);
      process.stderr.write(`Remote "${name}" added (${host})\n`);
      return;
    }

    case 'remove': {
      const name = positionals[1];
      if (!name) {
        process.stderr.write('Usage: sig remote remove <name>\n');
        process.exitCode = 1;
        return;
      }
      const removed = await removeRemote(name);
      if (removed) {
        process.stderr.write(`Remote "${name}" removed\n`);
      } else {
        process.stderr.write(`Remote "${name}" not found\n`);
        process.exitCode = 1;
      }
      return;
    }

    case 'list':
    default: {
      const remotes = await getRemotes();
      if (remotes.length === 0) {
        process.stderr.write('No remotes configured. Use "sig remote add <name> <host>" to add one.\n');
        return;
      }

      const format = typeof flags.format === 'string' ? flags.format : 'table';
      if (format === 'json') {
        process.stdout.write(formatJson(remotes) + '\n');
      } else {
        const rows = remotes.map(r => ({
          name: r.name,
          type: r.type,
          host: r.host,
          user: r.user ?? '-',
          path: r.path ?? '~/.signet/credentials',
        }));
        process.stdout.write(formatTable(rows) + '\n');
      }
      return;
    }
  }
}
