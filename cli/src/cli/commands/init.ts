/**
 * sig init — Interactive setup command.
 * Creates ~/.signet/config.yaml with sensible defaults.
 * Does NOT take deps (runs before config exists).
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import YAML from 'yaml';
import { getConfigPath } from '../../config/loader.js';
import { generateConfigYaml } from '../../config/generator.js';
import { validateConfig } from '../../config/validator.js';
import { isOk } from '../../core/result.js';

// ---------------------------------------------------------------------------
// Provider templates
// ---------------------------------------------------------------------------

interface ProviderTemplate {
  name: string;
  domains: string[];
  strategy: string;
  config?: Record<string, unknown>;
  needsDomain?: boolean;
}

const PROVIDER_TEMPLATES: Record<string, ProviderTemplate> = {
  github: {
    name: 'GitHub',
    domains: ['github.com', 'api.github.com'],
    strategy: 'api-token',
    config: { headerName: 'Authorization', headerPrefix: 'Bearer' },
  },
  gitlab: {
    name: 'GitLab',
    domains: ['gitlab.com'],
    strategy: 'api-token',
    config: { headerName: 'PRIVATE-TOKEN', headerPrefix: '' },
  },
  jira: {
    name: 'Jira (Cloud)',
    domains: [],
    strategy: 'cookie',
    needsDomain: true,
  },
  confluence: {
    name: 'Confluence',
    domains: [],
    strategy: 'cookie',
    needsDomain: true,
  },
};

// ---------------------------------------------------------------------------
// Browser channel detection
// ---------------------------------------------------------------------------

function detectBrowserChannel(): string {
  const platform = process.platform;

  if (platform === 'darwin') {
    if (fs.existsSync('/Applications/Google Chrome.app')) return 'chrome';
    if (fs.existsSync('/Applications/Microsoft Edge.app')) return 'msedge';
    return 'chrome';
  }

  if (platform === 'linux') {
    try { execSync('which google-chrome', { stdio: 'ignore' }); return 'chrome'; } catch { /* not found */ }
    try { execSync('which microsoft-edge', { stdio: 'ignore' }); return 'msedge'; } catch { /* not found */ }
    try { execSync('which chromium', { stdio: 'ignore' }); return 'chromium'; } catch { /* not found */ }
    return 'chrome';
  }

  // Windows or unknown
  return 'chrome';
}

// ---------------------------------------------------------------------------
// Interactive prompts
// ---------------------------------------------------------------------------

async function promptProviders(rl: ReturnType<typeof createInterface>): Promise<Array<{
  id: string;
  domains: string[];
  strategy: string;
  entryUrl?: string;
  config?: Record<string, unknown>;
}>> {
  const providers: Array<{
    id: string;
    domains: string[];
    strategy: string;
    entryUrl?: string;
    config?: Record<string, unknown>;
  }> = [];

  const addMore = await rl.question('\nWould you like to add a provider? (y/N) ');
  if (addMore.toLowerCase() !== 'y') return providers;

  let keepAdding = true;
  while (keepAdding) {
    const templateNames = Object.keys(PROVIDER_TEMPLATES);
    console.log('\nProvider templates:');
    for (let i = 0; i < templateNames.length; i++) {
      const key = templateNames[i];
      const tmpl = PROVIDER_TEMPLATES[key];
      console.log(`  ${i + 1}. ${tmpl.name} (${key})`);
    }
    console.log(`  ${templateNames.length + 1}. Custom`);

    const choice = await rl.question(`\nSelect template (1-${templateNames.length + 1}): `);
    const choiceNum = parseInt(choice, 10);

    if (choiceNum >= 1 && choiceNum <= templateNames.length) {
      const templateKey = templateNames[choiceNum - 1];
      const template = PROVIDER_TEMPLATES[templateKey];

      let domains = template.domains;
      if (template.needsDomain) {
        const domain = await rl.question(`Enter your ${template.name} domain (e.g., ${templateKey}.example.com): `);
        if (domain.trim()) {
          domains = [domain.trim()];
        } else {
          console.log('  Skipping — domain is required.');
          const again = await rl.question('\nAdd another provider? (y/N) ');
          keepAdding = again.toLowerCase() === 'y';
          continue;
        }
      }

      providers.push({
        id: templateKey,
        domains,
        strategy: template.strategy,
        ...(template.config ? { config: template.config } : {}),
      });
      console.log(`  Added ${template.name}.`);
    } else if (choiceNum === templateNames.length + 1) {
      const id = await rl.question('Provider id (e.g., my-api): ');
      if (!id.trim()) {
        console.log('  Skipping — id is required.');
        const again = await rl.question('\nAdd another provider? (y/N) ');
        keepAdding = again.toLowerCase() === 'y';
        continue;
      }
      const domain = await rl.question('Domain(s) (comma-separated): ');
      const domains = domain.split(',').map(d => d.trim()).filter(Boolean);
      if (domains.length === 0) {
        console.log('  Skipping — at least one domain is required.');
        const again = await rl.question('\nAdd another provider? (y/N) ');
        keepAdding = again.toLowerCase() === 'y';
        continue;
      }
      const strategy = await rl.question('Strategy (cookie, oauth2, api-token, basic) [cookie]: ') || 'cookie';
      providers.push({ id: id.trim(), domains, strategy });
      console.log(`  Added custom provider "${id.trim()}".`);
    } else {
      console.log('  Invalid selection.');
    }

    const again = await rl.question('\nAdd another provider? (y/N) ');
    keepAdding = again.toLowerCase() === 'y';
  }

  return providers;
}

// ---------------------------------------------------------------------------
// Main command
// ---------------------------------------------------------------------------

export async function runInit(
  positionals: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const configPath = getConfigPath();
  const signetDir = path.dirname(configPath);
  const force = flags.force === true;
  const yes = flags.yes === true;

  // Check if config already exists
  if (fs.existsSync(configPath) && !force) {
    process.stderr.write(
      `Config file already exists: ${configPath}\n` +
      'Use --force to overwrite.\n',
    );
    process.exitCode = 1;
    return;
  }

  // Detect defaults
  const detectedChannel = detectBrowserChannel();
  const defaultChannel = typeof flags.channel === 'string' ? flags.channel : detectedChannel;
  const defaultBrowserDataDir = typeof flags['browser-data-dir'] === 'string'
    ? flags['browser-data-dir']
    : path.join(signetDir, 'browser-data');
  const defaultCredentialsDir = typeof flags['credentials-dir'] === 'string'
    ? flags['credentials-dir']
    : path.join(signetDir, 'credentials');

  let channel = defaultChannel;
  let browserDataDir = defaultBrowserDataDir;
  let credentialsDir = defaultCredentialsDir;
  let providers: Array<{
    id: string;
    domains: string[];
    strategy: string;
    entryUrl?: string;
    config?: Record<string, unknown>;
  }> = [];

  // Interactive mode
  const isTTY = process.stdin.isTTY && process.stdout.isTTY;
  if (isTTY && !yes) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      console.log('\nWelcome to Signet! Let\'s set up your configuration.\n');

      const channelAnswer = await rl.question(`Browser channel [${defaultChannel}]: `);
      if (channelAnswer.trim()) channel = channelAnswer.trim();

      providers = await promptProviders(rl);
    } finally {
      rl.close();
    }
  } else {
    if (!yes) {
      // Non-TTY, non-yes: use defaults silently
    }
  }

  // Resolve ~ in paths for display but keep ~ in config for portability
  const displayBrowserDataDir = browserDataDir.replace(os.homedir(), '~');
  const displayCredentialsDir = credentialsDir.replace(os.homedir(), '~');

  // Generate config YAML
  const yaml = generateConfigYaml({
    channel,
    browserDataDir: displayBrowserDataDir,
    credentialsDir: displayCredentialsDir,
    headlessTimeout: 30_000,
    visibleTimeout: 120_000,
    waitUntil: 'load',
    providers: providers.length > 0 ? providers : undefined,
  });

  // Validate the generated config before writing (sanity check)
  let raw: unknown;
  try {
    raw = YAML.parse(yaml);
  } catch (e: unknown) {
    process.stderr.write(`Bug: generated invalid YAML: ${(e as Error).message}\n`);
    process.exitCode = 1;
    return;
  }

  const validationResult = validateConfig(raw as Record<string, unknown>);
  if (!isOk(validationResult)) {
    process.stderr.write(`Bug: generated config failed validation: ${validationResult.error.message}\n`);
    process.exitCode = 1;
    return;
  }

  // Create directories
  await fsp.mkdir(signetDir, { recursive: true });
  await fsp.mkdir(browserDataDir, { recursive: true });
  await fsp.mkdir(credentialsDir, { recursive: true });

  // Write config
  await fsp.writeFile(configPath, yaml, 'utf-8');

  // Success message
  console.log(`\n  Config written to ${configPath}`);
  console.log(`  Browser data:   ${browserDataDir}`);
  console.log(`  Credentials:    ${credentialsDir}`);
  console.log(`  Browser:        ${channel}`);
  if (providers.length > 0) {
    console.log(`  Providers:      ${providers.map(p => p.id).join(', ')}`);
  }
  console.log('\nNext steps:');
  console.log('  sig login <url>       Authenticate with a service');
  console.log('  sig providers         List configured providers');
  console.log('  sig doctor            Check your setup');
  console.log('');
}
