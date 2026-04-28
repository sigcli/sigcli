import { existsSync } from 'node:fs';
import { readdir, rm, mkdir, cp } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { SkillsSubcommand } from '../../core/constants.js';
import { ExitCode } from '../exit-codes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getSkillsDir(): string {
    // Published package: dist/cli/commands/skills.js -> dist/skills/
    const published = join(__dirname, '../../skills');
    if (existsSync(published)) return published;
    // Dev mode: dist/cli/commands/ -> monorepo skills/
    const dev = join(__dirname, '../../../../skills');
    if (existsSync(dev)) return dev;
    return published;
}

const AGENT_MAP: Record<string, string> = {
    claude: join(homedir(), '.claude', 'skills'),
    cursor: join(homedir(), '.cursor', 'skills'),
    windsurf: join(homedir(), '.windsurf', 'skills'),
    cline: join(homedir(), '.cline', 'skills'),
};

function detectDestination(flags: Record<string, string | boolean | string[]>): string {
    if (typeof flags.dest === 'string') return flags.dest;

    if (typeof flags.agent === 'string') {
        const dest = AGENT_MAP[flags.agent];
        if (!dest) {
            process.stderr.write(
                `Unknown agent: ${flags.agent}. Use: claude, cursor, windsurf, cline\n`,
            );
            process.exitCode = ExitCode.GENERAL_ERROR;
            return '';
        }
        return dest;
    }

    // Auto-detect
    for (const [agent, dest] of Object.entries(AGENT_MAP)) {
        if (existsSync(join(homedir(), `.${agent}`))) {
            process.stderr.write(`Auto-detected: ${agent}\n`);
            return dest;
        }
    }

    return AGENT_MAP.claude;
}

async function getAvailableSkills(): Promise<string[]> {
    const dir = getSkillsDir();
    if (!existsSync(dir)) return [];
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
        .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'SKILL.md')))
        .map((e) => e.name)
        .sort();
}

async function promptSelect(skills: string[], action: string): Promise<string[]> {
    if (!process.stdin.isTTY) return skills;

    process.stderr.write(`\nAvailable skills (${action}):\n`);
    skills.forEach((s, i) => process.stderr.write(`  ${i + 1}) ${s}\n`));

    const rl = createInterface({ input: process.stdin, output: process.stderr });
    const answer = await new Promise<string>((resolve) =>
        rl.question(`\nEnter numbers (e.g. 1,3,5) or 'a' for all: `, resolve),
    );
    rl.close();

    if (answer.trim().toLowerCase() === 'a' || answer.trim() === '') return skills;

    const selected: string[] = [];
    for (const num of answer.split(/[,\s]+/)) {
        const idx = parseInt(num, 10) - 1;
        if (idx >= 0 && idx < skills.length) selected.push(skills[idx]);
    }
    return selected;
}

const USAGE = `Usage: sig skills <subcommand>

Subcommands:
  list                         List available skills and install status
  install [skill...]           Install AI agent skills
    --all                        Install all skills
    --agent <name>               Target: claude|cursor|windsurf|cline
    --dest <path>                Custom install path
  uninstall [skill...]         Remove installed skills
    --all                        Remove all skills
`;

export async function runSkills(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
): Promise<void> {
    const subcommand = positionals[0];

    switch (subcommand) {
        case SkillsSubcommand.INSTALL:
            await handleInstall(positionals.slice(1), flags);
            break;
        case SkillsSubcommand.UNINSTALL:
            await handleUninstall(positionals.slice(1), flags);
            break;
        case SkillsSubcommand.LIST:
            await handleList(flags);
            break;
        default:
            process.stderr.write(USAGE);
            if (subcommand) process.exitCode = ExitCode.GENERAL_ERROR;
    }
}

async function handleInstall(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
): Promise<void> {
    const dest = detectDestination(flags);
    if (!dest) return;

    const available = await getAvailableSkills();
    if (available.length === 0) {
        process.stderr.write('No bundled skills found.\n');
        process.exitCode = ExitCode.GENERAL_ERROR;
        return;
    }

    let selected: string[];
    if (positionals.length > 0) {
        selected = positionals.filter((s) => {
            if (!available.includes(s)) {
                process.stderr.write(`  ! unknown skill: ${s}\n`);
                return false;
            }
            return true;
        });
    } else if (flags.all === true) {
        selected = available;
    } else {
        selected = await promptSelect(available, 'install');
    }

    if (selected.length === 0) {
        process.stderr.write('No skills selected.\n');
        return;
    }

    await mkdir(dest, { recursive: true });
    const skillsDir = getSkillsDir();

    for (const skill of selected) {
        const src = join(skillsDir, skill);
        const target = join(dest, skill);
        await rm(target, { recursive: true, force: true });
        await cp(src, target, {
            recursive: true,
            filter: (source: string) => {
                const b = basename(source);
                return b !== 'tests' && b !== '__pycache__' && !b.endsWith('.pyc');
            },
        });
        process.stderr.write(`  + ${skill}\n`);
    }

    process.stderr.write(`\nInstalled ${selected.length} skill(s) to ${dest}\n`);
}

async function handleUninstall(
    positionals: string[],
    flags: Record<string, string | boolean | string[]>,
): Promise<void> {
    const dest = detectDestination(flags);
    if (!dest) return;

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

    let selected: string[];
    if (positionals.length > 0) {
        selected = positionals.filter((s) => installed.includes(s));
    } else if (flags.all === true) {
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

async function handleList(flags: Record<string, string | boolean | string[]>): Promise<void> {
    const dest = detectDestination(flags);
    if (!dest) return;

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
