import { ExitCode } from '../exit-codes.js';

const SUBCOMMANDS =
    'init doctor get login request status logout providers remote sync watch rename remove completion';

function bashScript(): string {
    return [
        '_sig_completions() {',
        '    local cur prev commands',
        '    cur="${COMP_WORDS[COMP_CWORD]}"',
        '    prev="${COMP_WORDS[COMP_CWORD-1]}"',
        `    commands="${SUBCOMMANDS}"`,
        '',
        '    case "$prev" in',
        '        sig)',
        '            COMPREPLY=($(compgen -W "$commands" -- "$cur"))',
        '            ;;',
        '        get|login|status|logout|rename|remove)',
        '            local providers',
        "            providers=$(sig providers --format json 2>/dev/null | node -e \"process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{JSON.parse(d).forEach(p=>console.log(p.id))}catch{}})\" 2>/dev/null)",
        '            COMPREPLY=($(compgen -W "$providers" -- "$cur"))',
        '            ;;',
        '        remote)',
        '            COMPREPLY=($(compgen -W "add remove list" -- "$cur"))',
        '            ;;',
        '        sync)',
        '            COMPREPLY=($(compgen -W "push pull" -- "$cur"))',
        '            ;;',
        '        watch)',
        '            COMPREPLY=($(compgen -W "add remove list start set-interval" -- "$cur"))',
        '            ;;',
        '        completion)',
        '            COMPREPLY=($(compgen -W "bash zsh fish" -- "$cur"))',
        '            ;;',
        '        --format)',
        '            COMPREPLY=($(compgen -W "json table yaml env plain" -- "$cur"))',
        '            ;;',
        '        --method)',
        '            COMPREPLY=($(compgen -W "GET POST PUT PATCH DELETE HEAD OPTIONS" -- "$cur"))',
        '            ;;',
        '        *)',
        '            COMPREPLY=()',
        '            ;;',
        '    esac',
        '}',
        'complete -F _sig_completions sig',
        '',
    ].join('\n');
}

function zshScript(): string {
    return [
        '#compdef sig',
        '',
        '_sig() {',
        '    local state',
        '    local -a commands',
        '    commands=(',
        "        'init:Create ~/.sig/config.yaml'",
        "        'doctor:Check environment and configuration'",
        "        'get:Retrieve credential headers'",
        "        'login:Browser SSO login'",
        "        'request:Make an authenticated HTTP request'",
        "        'status:Show authentication status'",
        "        'logout:Clear credentials'",
        "        'providers:List configured providers'",
        "        'remote:Manage remote credential stores'",
        "        'sync:Sync credentials with remote'",
        "        'watch:Auto-refresh credentials'",
        "        'rename:Rename a provider'",
        "        'remove:Remove provider and credentials'",
        "        'completion:Generate shell completion script'",
        '    )',
        '',
        '    _arguments -C \\',
        "        '1: :->command' \\",
        "        '*: :->args' \\",
        "        '--verbose[Debug output to stderr]' \\",
        "        '--help[Show help]'",
        '',
        '    case $state in',
        '        command)',
        "            _describe 'sig commands' commands",
        '            ;;',
        '        args)',
        '            case $words[2] in',
        '                get|login|status|logout|rename|remove)',
        '                    local providers',
        "                    providers=($(sig providers --format json 2>/dev/null | node -e \"process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{JSON.parse(d).forEach(p=>console.log(p.id))}catch{}})\" 2>/dev/null))",
        "                    _describe 'providers' providers",
        '                    ;;',
        '                remote)',
        '                    local -a sub=(add remove list)',
        "                    _describe 'remote subcommands' sub",
        '                    ;;',
        '                sync)',
        '                    local -a sub=(push pull)',
        "                    _describe 'sync subcommands' sub",
        '                    ;;',
        '                watch)',
        '                    local -a sub=(add remove list start set-interval)',
        "                    _describe 'watch subcommands' sub",
        '                    ;;',
        '                completion)',
        '                    local -a shells=(bash zsh fish)',
        "                    _describe 'shells' shells",
        '                    ;;',
        '            esac',
        '            ;;',
        '    esac',
        '}',
        '',
        'compdef _sig sig',
        '',
    ].join('\n');
}

function fishScript(): string {
    return [
        '# Fish shell completions for sig',
        '',
        'complete -c sig -f',
        'complete -c sig -n "__fish_use_subcommand" -a init -d "Create ~/.sig/config.yaml"',
        'complete -c sig -n "__fish_use_subcommand" -a doctor -d "Check environment and configuration"',
        'complete -c sig -n "__fish_use_subcommand" -a get -d "Retrieve credential headers"',
        'complete -c sig -n "__fish_use_subcommand" -a login -d "Browser SSO login"',
        'complete -c sig -n "__fish_use_subcommand" -a request -d "Make an authenticated HTTP request"',
        'complete -c sig -n "__fish_use_subcommand" -a status -d "Show authentication status"',
        'complete -c sig -n "__fish_use_subcommand" -a logout -d "Clear credentials"',
        'complete -c sig -n "__fish_use_subcommand" -a providers -d "List configured providers"',
        'complete -c sig -n "__fish_use_subcommand" -a remote -d "Manage remote credential stores"',
        'complete -c sig -n "__fish_use_subcommand" -a sync -d "Sync credentials with remote"',
        'complete -c sig -n "__fish_use_subcommand" -a watch -d "Auto-refresh credentials"',
        'complete -c sig -n "__fish_use_subcommand" -a rename -d "Rename a provider"',
        'complete -c sig -n "__fish_use_subcommand" -a remove -d "Remove provider and credentials"',
        'complete -c sig -n "__fish_use_subcommand" -a completion -d "Generate shell completion script"',
        '',
        'function __sig_providers',
        "    sig providers --format json 2>/dev/null | node -e \"process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{JSON.parse(d).forEach(p=>console.log(p.id))}catch{}}\" 2>/dev/null",
        'end',
        '',
        'complete -c sig -n "__fish_seen_subcommand_from get login status logout rename remove" -a "(__sig_providers)"',
        'complete -c sig -n "__fish_seen_subcommand_from remote" -a "add remove list"',
        'complete -c sig -n "__fish_seen_subcommand_from sync" -a "push pull"',
        'complete -c sig -n "__fish_seen_subcommand_from watch" -a "add remove list start set-interval"',
        'complete -c sig -n "__fish_seen_subcommand_from completion" -a "bash zsh fish"',
        'complete -c sig -l verbose -d "Debug output to stderr"',
        'complete -c sig -l help -d "Show help"',
        'complete -c sig -l format -d "Output format" -a "json table yaml env plain"',
        'complete -c sig -l method -d "HTTP method" -a "GET POST PUT PATCH DELETE HEAD OPTIONS"',
        '',
    ].join('\n');
}

export async function runCompletion(
    positionals: string[],
    _flags: Record<string, string | boolean | string[]>,
): Promise<void> {
    let shell = positionals[0];

    if (!shell) {
        const envShell = process.env.SHELL ?? '';
        if (envShell.endsWith('/bash')) shell = 'bash';
        else if (envShell.endsWith('/zsh')) shell = 'zsh';
        else if (envShell.endsWith('/fish')) shell = 'fish';
        else {
            process.stderr.write('Usage: sig completion <shell>\n');
            process.stderr.write('Supported shells: bash, zsh, fish\n');
            process.exitCode = ExitCode.GENERAL_ERROR;
            return;
        }
    }

    switch (shell) {
        case 'bash':
            process.stdout.write(bashScript());
            break;
        case 'zsh':
            process.stdout.write(zshScript());
            break;
        case 'fish':
            process.stdout.write(fishScript());
            break;
        default:
            process.stderr.write(`Unknown shell: ${shell}\n`);
            process.stderr.write('Supported shells: bash, zsh, fish\n');
            process.exitCode = ExitCode.GENERAL_ERROR;
    }
}
