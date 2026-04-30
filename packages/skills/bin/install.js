#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '../data');

const HELP = `@sigcli/skills — Install AI agent skills for authenticated web access

Usage: npx @sigcli/skills [options] [skill...]

Options:
  --agent <name>     Target: claude, cursor, windsurf, cline (auto-detected)
  --dest <path>      Custom install path
  --all              Install/uninstall all skills
  --list             List available skills and install status
  --uninstall        Remove installed skills
  --help, -h         Show this help

Examples:
  npx @sigcli/skills                     # Interactive install
  npx @sigcli/skills --all               # Install all skills
  npx @sigcli/skills outlook slack x     # Install specific skills
  npx @sigcli/skills --agent cursor      # Target Cursor
  npx @sigcli/skills --list              # List skills
  npx @sigcli/skills --uninstall         # Uninstall
`;

function parseArgs(args) {
    const flags = {};
    const positionals = [];
    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        if (arg === '--help' || arg === '-h') {
            flags.help = true;
            i++;
        } else if (arg === '--all') {
            flags.all = true;
            i++;
        } else if (arg === '--list') {
            flags.list = true;
            i++;
        } else if (arg === '--uninstall') {
            flags.uninstall = true;
            i++;
        } else if (arg === '--agent' && args[i + 1]) {
            flags.agent = args[i + 1];
            i += 2;
        } else if (arg === '--dest' && args[i + 1]) {
            flags.dest = args[i + 1];
            i += 2;
        } else if (arg.startsWith('--')) {
            i++;
        } else {
            positionals.push(arg);
            i++;
        }
    }
    return { flags, positionals };
}

function detectDestination(flags) {
    if (flags.dest) return flags.dest;

    const agentMap = {
        claude: join(homedir(), '.claude', 'skills'),
        cursor: join(homedir(), '.cursor', 'skills'),
        windsurf: join(homedir(), '.windsurf', 'skills'),
        cline: join(homedir(), '.cline', 'skills'),
    };

    if (flags.agent) {
        const dest = agentMap[flags.agent];
        if (!dest) {
            process.stderr.write(
                `Unknown agent: ${flags.agent}. Use: claude, cursor, windsurf, cline\n`,
            );
            process.exit(1);
        }
        return dest;
    }

    // Auto-detect
    for (const [agent, dest] of Object.entries(agentMap)) {
        if (existsSync(join(homedir(), `.${agent}`))) {
            process.stderr.write(`Auto-detected: ${agent}\n`);
            return dest;
        }
    }

    return agentMap.claude;
}

async function getAvailableSkills() {
    if (!existsSync(DATA_DIR)) return [];
    const entries = await readdir(DATA_DIR, { withFileTypes: true });
    return entries
        .filter((e) => e.isDirectory() && existsSync(join(DATA_DIR, e.name, 'SKILL.md')))
        .map((e) => e.name)
        .sort();
}

async function promptSelect(skills, action) {
    if (!process.stdin.isTTY) return skills;

    process.stderr.write(`\nAvailable skills (${action}):\n`);
    skills.forEach((s, i) => process.stderr.write(`  ${i + 1}) ${s}\n`));

    const rl = createInterface({ input: process.stdin, output: process.stderr });
    const answer = await new Promise((resolve) =>
        rl.question(`\nEnter numbers (e.g. 1,3,5) or 'a' for all: `, resolve),
    );
    rl.close();

    if (answer.trim().toLowerCase() === 'a' || answer.trim() === '') return skills;

    const selected = [];
    for (const num of answer.split(/[,\s]+/)) {
        const idx = parseInt(num, 10) - 1;
        if (idx >= 0 && idx < skills.length) selected.push(skills[idx]);
    }
    return selected;
}

async function handleInstall(positionals, flags) {
    const dest = detectDestination(flags);
    const available = await getAvailableSkills();

    if (available.length === 0) {
        process.stderr.write('No bundled skills found.\n');
        process.exit(1);
    }

    let selected;
    if (positionals.length > 0) {
        selected = positionals.filter((s) => {
            if (!available.includes(s)) {
                process.stderr.write(`  ! unknown skill: ${s}\n`);
                return false;
            }
            return true;
        });
    } else if (flags.all) {
        selected = available;
    } else {
        selected = await promptSelect(available, 'install');
    }

    if (selected.length === 0) {
        process.stderr.write('No skills selected.\n');
        return;
    }

    await mkdir(dest, { recursive: true });

    for (const skill of selected) {
        const src = join(DATA_DIR, skill);
        const target = join(dest, skill);
        await rm(target, { recursive: true, force: true });
        await cp(src, target, {
            recursive: true,
            filter: (source) => {
                const b = basename(source);
                return b !== 'tests' && b !== '__pycache__' && !b.endsWith('.pyc');
            },
        });
        process.stderr.write(`  + ${skill}\n`);
    }

    process.stderr.write(`\nInstalled ${selected.length} skill(s) to ${dest}\n`);
}

async function handleUninstall(positionals, flags) {
    const dest = detectDestination(flags);

    if (!existsSync(dest)) {
        process.stderr.write(`No skills installed at ${dest}\n`);
        return;
    }

    const available = await getAvailableSkills();
    const entries = await readdir(dest, { withFileTypes: true });
    const installed = entries
        .filter((e) => e.isDirectory() && available.includes(e.name))
        .map((e) => e.name)
        .sort();

    if (installed.length === 0) {
        process.stderr.write('No skills installed.\n');
        return;
    }

    let selected;
    if (positionals.length > 0) {
        selected = positionals.filter((s) => installed.includes(s));
    } else if (flags.all) {
        selected = installed;
    } else {
        selected = await promptSelect(installed, 'uninstall');
    }

    if (selected.length === 0) {
        process.stderr.write('No skills selected.\n');
        return;
    }

    for (const skill of selected) {
        await rm(join(dest, skill), { recursive: true, force: true });
        process.stderr.write(`  - ${skill}\n`);
    }

    process.stderr.write(`\nRemoved ${selected.length} skill(s) from ${dest}\n`);
}

async function handleList(flags) {
    const dest = detectDestination(flags);
    const available = await getAvailableSkills();

    if (available.length === 0) {
        process.stderr.write('No bundled skills found.\n');
        return;
    }

    process.stdout.write('Available skills:\n');
    for (const skill of available) {
        const installed = existsSync(join(dest, skill));
        const marker = installed ? '  [installed]' : '';
        process.stdout.write(`  ${skill}${marker}\n`);
    }
    process.stdout.write(`\nInstall path: ${dest}\n`);
}

// Main
const { flags, positionals } = parseArgs(process.argv.slice(2));

if (flags.help) {
    process.stdout.write(HELP);
} else if (flags.list) {
    await handleList(flags);
} else if (flags.uninstall) {
    await handleUninstall(positionals, flags);
} else {
    await handleInstall(positionals, flags);
}
