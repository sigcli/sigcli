import {
    SectionHeading,
    P,
    Code,
    CodeBlock,
    List,
    Li,
    type EditorialSection,
} from '../components/markdown';
import type { FlatTocItem, TocNodeType } from '../components/toc-tree';

function tocItem(
    href: string,
    label: string,
    opts: { level?: 0 | 1 | 2 | 3; parent?: string; prefix?: string; type?: TocNodeType } = {},
): FlatTocItem {
    return {
        href,
        label,
        type: opts.type ?? (opts.level === 0 || !opts.level ? 'h2' : 'h3'),
        visualLevel: (opts.level ?? 0) as FlatTocItem['visualLevel'],
        prefix: opts.prefix ?? '',
        parentHref: opts.parent ?? null,
        pageHref: '/docs/',
    };
}

export const pageContent = {
    meta: {
        title: 'Sigcli Docs — Complete Reference',
        description:
            'Complete documentation for Sigcli: getting started, commands reference, environment variables, configuration, strategies, browser adapters, SDK, AI agents, and remote sync.',
    },

    toc: [
        tocItem('#getting-started', 'Getting Started'),
        tocItem('#install', 'Install', { level: 1, parent: '#getting-started', prefix: '├ ' }),
        tocItem('#first-login', 'First login', {
            level: 1,
            parent: '#getting-started',
            prefix: '├ ',
        }),
        tocItem('#first-run', 'First sig run', {
            level: 1,
            parent: '#getting-started',
            prefix: '├ ',
        }),
        tocItem('#onboard-proxy', 'Try: sig proxy', {
            level: 1,
            parent: '#getting-started',
            prefix: '├ ',
        }),
        tocItem('#onboard-request', 'Try: sig request', {
            level: 1,
            parent: '#getting-started',
            prefix: '├ ',
        }),
        tocItem('#onboard-choosing', 'Choosing a method', {
            level: 1,
            parent: '#getting-started',
            prefix: '└ ',
        }),
        tocItem('#security', 'Security Model'),
        tocItem('#security-hierarchy', 'Credential access methods', {
            level: 1,
            parent: '#security',
            prefix: '├ ',
        }),
        tocItem('#security-proxy', 'sig proxy', { level: 2, parent: '#security', prefix: '│  ├ ' }),
        tocItem('#security-request', 'sig request', {
            level: 2,
            parent: '#security',
            prefix: '│  ├ ',
        }),
        tocItem('#security-run', 'sig run', { level: 2, parent: '#security', prefix: '│  ├ ' }),
        tocItem('#security-get', 'sig get', { level: 2, parent: '#security', prefix: '│  └ ' }),
        tocItem('#security-shared', 'Shared protections', {
            level: 1,
            parent: '#security',
            prefix: '└ ',
        }),
        tocItem('#commands', 'Commands'),
        tocItem('#cmd-init', 'sig init', { level: 1, parent: '#commands', prefix: '├ ' }),
        tocItem('#cmd-doctor', 'sig doctor', { level: 1, parent: '#commands', prefix: '├ ' }),
        tocItem('#cmd-run', 'sig run', { level: 1, parent: '#commands', prefix: '├ ' }),
        tocItem('#cmd-login', 'sig login', { level: 1, parent: '#commands', prefix: '├ ' }),
        tocItem('#cmd-logout', 'sig logout', { level: 1, parent: '#commands', prefix: '├ ' }),
        tocItem('#cmd-get', 'sig get', { level: 1, parent: '#commands', prefix: '├ ' }),
        tocItem('#cmd-request', 'sig request', { level: 1, parent: '#commands', prefix: '├ ' }),
        tocItem('#cmd-status', 'sig status', { level: 1, parent: '#commands', prefix: '├ ' }),
        tocItem('#cmd-providers', 'sig providers', { level: 1, parent: '#commands', prefix: '├ ' }),
        tocItem('#cmd-rename', 'sig rename', { level: 1, parent: '#commands', prefix: '├ ' }),
        tocItem('#cmd-remove', 'sig remove', { level: 1, parent: '#commands', prefix: '├ ' }),
        tocItem('#cmd-remote', 'sig remote', { level: 1, parent: '#commands', prefix: '├ ' }),
        tocItem('#cmd-sync', 'sig sync', { level: 1, parent: '#commands', prefix: '├ ' }),
        tocItem('#cmd-watch', 'sig watch', { level: 1, parent: '#commands', prefix: '├ ' }),
        tocItem('#cmd-proxy', 'sig proxy', { level: 1, parent: '#commands', prefix: '├ ' }),
        tocItem('#cmd-completion', 'sig completion', {
            level: 1,
            parent: '#commands',
            prefix: '└ ',
        }),
        tocItem('#env-vars', 'Environment Variables'),
        tocItem('#configuration', 'Configuration'),
        tocItem('#config-file', 'config.yaml', {
            level: 1,
            parent: '#configuration',
            prefix: '├ ',
        }),
        tocItem('#config-providers', 'Providers', {
            level: 1,
            parent: '#configuration',
            prefix: '└ ',
        }),
        tocItem('#strategies', 'Auth Strategies'),
        tocItem('#strat-cookie', 'cookie', { level: 1, parent: '#strategies', prefix: '├ ' }),
        tocItem('#strat-oauth2', 'oauth2', { level: 1, parent: '#strategies', prefix: '├ ' }),
        tocItem('#strat-api-token', 'api-token', { level: 1, parent: '#strategies', prefix: '├ ' }),
        tocItem('#strat-basic', 'basic', { level: 1, parent: '#strategies', prefix: '└ ' }),
        tocItem('#browser-adapters', 'Browser Adapters'),
        tocItem('#sdk', 'SDK'),
        tocItem('#sdk-ts', 'TypeScript SDK', { level: 1, parent: '#sdk', prefix: '├ ' }),
        tocItem('#sdk-python', 'Python SDK', { level: 1, parent: '#sdk', prefix: '└ ' }),
        tocItem('#ai-agents', 'AI Agent Integration'),
        tocItem('#remote-ssh', 'Remote & SSH'),
        tocItem('#error-codes', 'Error Codes'),
    ] as FlatTocItem[],

    hero: (
        <div style={{ padding: '20px 0 8px' }}>
            <p
                style={{
                    fontFamily: 'var(--font-secondary)',
                    fontStyle: 'italic',
                    fontSize: '19px',
                    fontWeight: 400,
                    lineHeight: 1.55,
                    color: 'var(--text-primary)',
                    opacity: 0.72,
                    margin: 0,
                }}
            >
                Complete reference for Sigcli — the authentication CLI that signs requests on your
                behalf. Log in once, use credentials everywhere.
            </p>
        </div>
    ),

    sections: [
        /* ── Getting Started ── */
        {
            content: (
                <>
                    <SectionHeading id="getting-started" level={1}>
                        Getting Started
                    </SectionHeading>
                    <P>
                        Sigcli (<Code>sig</Code>) is a personal seal of authority. It handles
                        browser SSO, stores tokens, and injects credentials into any command — so
                        you log in once and every tool just works.
                    </P>

                    <SectionHeading id="install" level={2}>
                        Install
                    </SectionHeading>
                    <CodeBlock lang="bash">{`npm install -g @sigcli/cli

# or without global install:
npx @sigcli/cli sig --help`}</CodeBlock>

                    <SectionHeading id="first-login" level={2}>
                        First login
                    </SectionHeading>
                    <P>
                        Run <Code>sig init</Code> to create <Code>~/.sig/config.yaml</Code>, then
                        sign in to your provider. Sign in with a real browser — credentials are
                        captured automatically via browser SSO.
                    </P>
                    <CodeBlock lang="bash">{`# 1. Create config (interactive)
sig init

# 2. Sign in — opens a real browser, captures cookies automatically
sig login https://jira.example.com

# 3. Confirm it worked
sig status my-jira`}</CodeBlock>

                    <SectionHeading id="first-run" level={2}>
                        First sig run
                    </SectionHeading>
                    <P>
                        <Code>sig run</Code> is the recommended way to use credentials. It injects{' '}
                        <Code>SIG_&lt;PROVIDER&gt;_*</Code> environment variables directly into the
                        child process — nothing leaks into shell history or process lists.
                    </P>
                    <CodeBlock lang="bash">{`# Discover what variables are available
sig run my-jira -- env | grep SIG_

# Run any command with credentials injected
sig run my-jira -- curl https://jira.example.com/api/me

# Run a Python script
sig run my-jira -- python fetch_issues.py`}</CodeBlock>

                    <SectionHeading id="onboard-proxy" level={2}>
                        Try: sig proxy
                    </SectionHeading>
                    <P>
                        The proxy is the <strong>most secure</strong> way to use credentials. It
                        runs a local MITM daemon that intercepts HTTPS traffic and injects
                        credentials transparently — your tools never see the tokens.
                    </P>
                    <CodeBlock lang="bash">{`# Start the proxy daemon
sig proxy start

# Trust the CA certificate (first time only)
sig proxy trust    # prints the CA cert path — add it to your OS trust store

# Set the proxy env vars
export HTTP_PROXY=http://127.0.0.1:7891
export HTTPS_PROXY=http://127.0.0.1:7891

# Now any HTTP client automatically gets credentials injected
curl https://jira.example.com/rest/api/2/myself

# When done
sig proxy stop`}</CodeBlock>

                    <SectionHeading id="onboard-request" level={2}>
                        Try: sig request
                    </SectionHeading>
                    <P>
                        For one-off API calls, <Code>sig request</Code> makes an authenticated HTTP
                        request directly. Credentials stay inside the CLI process and are never
                        exposed to subprocesses or shell history.
                    </P>
                    <CodeBlock lang="bash">{`# Simple GET request
sig request https://jira.example.com/rest/api/2/myself

# POST with body
sig request https://api.example.com/data --method POST --body '{"key": "value"}'

# Just the response body
sig request https://api.example.com/me --format body`}</CodeBlock>

                    <SectionHeading id="onboard-choosing" level={2}>
                        Choosing a method
                    </SectionHeading>
                    <P>
                        Pick the method that matches your use case. When in doubt, prefer higher
                        security.
                    </P>
                    <div className="w-full max-w-full overflow-x-auto" style={{ padding: '8px 0' }}>
                        <table
                            className="w-full"
                            style={{ borderSpacing: 0, borderCollapse: 'collapse' }}
                        >
                            <thead>
                                <tr>
                                    {['Use Case', 'Recommended', 'Why'].map((h) => (
                                        <th
                                            key={h}
                                            className="text-left"
                                            style={{
                                                padding: '4px 12px 4px 0',
                                                fontSize: 'var(--type-table-size)',
                                                fontFamily: 'var(--font-primary)',
                                                fontWeight: 400,
                                                color: 'var(--text-muted)',
                                                borderBottom: '1px solid var(--page-border)',
                                            }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    [
                                        'Long-lived daemon or AI agent',
                                        'sig proxy',
                                        'Credentials never leave proxy process',
                                    ],
                                    [
                                        'One-off API call or script',
                                        'sig request',
                                        'Credentials in-process only, never on disk/env',
                                    ],
                                    [
                                        'Wrapping a tool that reads env vars',
                                        'sig run',
                                        'Injects SIG_* env vars, redacts output',
                                    ],
                                    [
                                        'Debugging credential values',
                                        'sig get',
                                        'Prints to stdout — use with caution',
                                    ],
                                ].map(([useCase, recommended, why]) => (
                                    <tr key={useCase}>
                                        <td
                                            style={{
                                                padding: '4px 12px 4px 0',
                                                fontSize: 'var(--type-table-size)',
                                                fontFamily: 'var(--font-primary)',
                                                fontWeight: 475,
                                                color: 'var(--text-primary)',
                                                borderBottom: '1px solid var(--page-border)',
                                            }}
                                        >
                                            {useCase}
                                        </td>
                                        <td
                                            style={{
                                                padding: '4px 12px 4px 0',
                                                fontSize: 'var(--type-table-size)',
                                                fontFamily: 'var(--font-code)',
                                                fontWeight: 475,
                                                color: 'var(--text-primary)',
                                                borderBottom: '1px solid var(--page-border)',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {recommended}
                                        </td>
                                        <td
                                            style={{
                                                padding: '4px 12px 4px 0',
                                                fontSize: 'var(--type-table-size)',
                                                fontFamily: 'var(--font-primary)',
                                                fontWeight: 475,
                                                color: 'var(--text-primary)',
                                                borderBottom: '1px solid var(--page-border)',
                                            }}
                                        >
                                            {why}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ),
            aside: (
                <P>
                    Credentials are stored in <Code>~/.sig/credentials/</Code> as sealed JSON files.
                    Nothing goes into your repo, shell history, or environment by default.
                </P>
            ),
        },

        /* ── Security Model ── */
        {
            content: (
                <>
                    <SectionHeading id="security" level={1}>
                        Security Model
                    </SectionHeading>
                    <P>
                        Sigcli offers four ways to access credentials. Each makes a different
                        tradeoff between security and convenience. Listed from most to least secure:
                    </P>

                    <SectionHeading id="security-hierarchy" level={2}>
                        Credential access methods
                    </SectionHeading>
                    <div className="w-full max-w-full overflow-x-auto" style={{ padding: '8px 0' }}>
                        <table
                            className="w-full"
                            style={{ borderSpacing: 0, borderCollapse: 'collapse' }}
                        >
                            <thead>
                                <tr>
                                    {[
                                        'Method',
                                        'Credential Exposure',
                                        'Lifetime',
                                        'Visible To',
                                        'Security',
                                    ].map((h) => (
                                        <th
                                            key={h}
                                            className="text-left"
                                            style={{
                                                padding: '4px 12px 4px 0',
                                                fontSize: 'var(--type-table-size)',
                                                fontFamily: 'var(--font-primary)',
                                                fontWeight: 400,
                                                color: 'var(--text-muted)',
                                                borderBottom: '1px solid var(--page-border)',
                                            }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    [
                                        'sig proxy',
                                        'Never leaves proxy process',
                                        'Proxy daemon lifetime',
                                        'Nothing external',
                                        '●●●●● Highest',
                                    ],
                                    [
                                        'sig request',
                                        'In-process memory only',
                                        '~100ms per request',
                                        'Nothing external',
                                        '●●●●○ High',
                                    ],
                                    [
                                        'sig run',
                                        'Child process env vars',
                                        'Child process lifetime',
                                        '/proc/PID/environ, child processes',
                                        '●●●○○ Moderate',
                                    ],
                                    [
                                        'sig get',
                                        'Printed to stdout',
                                        'Captured by shell',
                                        'Terminal, shell history, pipes',
                                        '●●○○○ Low',
                                    ],
                                ].map(([method, exposure, lifetime, visibleTo, security]) => (
                                    <tr key={method}>
                                        <td
                                            style={{
                                                padding: '4px 12px 4px 0',
                                                fontSize: 'var(--type-table-size)',
                                                fontFamily: 'var(--font-code)',
                                                fontWeight: 475,
                                                color: 'var(--text-primary)',
                                                borderBottom: '1px solid var(--page-border)',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {method}
                                        </td>
                                        <td
                                            style={{
                                                padding: '4px 12px 4px 0',
                                                fontSize: 'var(--type-table-size)',
                                                fontFamily: 'var(--font-primary)',
                                                fontWeight: 475,
                                                color: 'var(--text-primary)',
                                                borderBottom: '1px solid var(--page-border)',
                                            }}
                                        >
                                            {exposure}
                                        </td>
                                        <td
                                            style={{
                                                padding: '4px 12px 4px 0',
                                                fontSize: 'var(--type-table-size)',
                                                fontFamily: 'var(--font-primary)',
                                                fontWeight: 475,
                                                color: 'var(--text-primary)',
                                                borderBottom: '1px solid var(--page-border)',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {lifetime}
                                        </td>
                                        <td
                                            style={{
                                                padding: '4px 12px 4px 0',
                                                fontSize: 'var(--type-table-size)',
                                                fontFamily: 'var(--font-primary)',
                                                fontWeight: 475,
                                                color: 'var(--text-primary)',
                                                borderBottom: '1px solid var(--page-border)',
                                            }}
                                        >
                                            {visibleTo}
                                        </td>
                                        <td
                                            style={{
                                                padding: '4px 12px 4px 0',
                                                fontSize: 'var(--type-table-size)',
                                                fontFamily: 'var(--font-code)',
                                                fontWeight: 475,
                                                color: 'var(--text-primary)',
                                                borderBottom: '1px solid var(--page-border)',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {security}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <SectionHeading id="security-proxy" level={2}>
                        sig proxy — credentials never leave the process
                    </SectionHeading>
                    <P>
                        The MITM proxy daemon runs on localhost (127.0.0.1). Client apps set
                        HTTP_PROXY and make normal requests. The proxy intercepts HTTPS connections,
                        injects credentials as HTTP headers, and forwards to the upstream server.
                    </P>
                    <P>
                        Credentials are decrypted from storage and held only in the proxy process
                        memory. Client applications, subprocesses, and env vars never contain
                        tokens. TLS interception uses ECDSA P-256 certificates generated per
                        hostname.
                    </P>
                    <CodeBlock lang="bash">{`sig proxy start && export HTTP_PROXY=http://127.0.0.1:7891 HTTPS_PROXY=http://127.0.0.1:7891`}</CodeBlock>
                    <P>
                        <strong>Use when:</strong> AI agents, CI/CD pipelines, long-running daemons,
                        any tool that supports HTTP_PROXY.
                    </P>

                    <SectionHeading id="security-request" level={2}>
                        sig request — credentials stay internal
                    </SectionHeading>
                    <P>
                        <Code>sig request</Code> loads credentials into process memory, makes a
                        single HTTP request, and discards them. Credentials are never written to env
                        vars, files, or stdout. The exposure window is ~100ms per request.
                    </P>
                    <CodeBlock lang="bash">{`sig request https://api.example.com/me --format body`}</CodeBlock>
                    <P>
                        <strong>Use when:</strong> One-off API calls, shell scripts, pipeline steps
                        that need a single HTTP response.
                    </P>

                    <SectionHeading id="security-run" level={2}>
                        sig run — credentials in env vars
                    </SectionHeading>
                    <P>
                        <Code>sig run</Code> injects <Code>SIG_&lt;PROVIDER&gt;_*</Code> env vars
                        into the child process. This is convenient for tools that read configuration
                        from environment variables, but env vars are readable via <Code>/proc</Code>{' '}
                        on Linux and inherited by all child processes. Output from the child is
                        redacted (credential values replaced with <Code>****</Code>) but redaction
                        is best-effort.
                    </P>
                    <CodeBlock lang="bash">{`sig run my-jira -- bash -c 'curl -H "Cookie: $SIG_MY_JIRA_COOKIE" https://jira.example.com/api/me'`}</CodeBlock>
                    <P>
                        <strong>Use when:</strong> Wrapping tools that read SIG_* env vars, local
                        development, quick scripting.
                    </P>

                    <SectionHeading id="security-get" level={2}>
                        sig get — credentials printed to stdout
                    </SectionHeading>
                    <P>
                        <Code>sig get</Code> outputs credential headers to stdout. By default,
                        values are redacted (<Code>****</Code>), but <Code>--no-redaction</Code>{' '}
                        reveals raw tokens. Even redacted output shows credential structure. Raw
                        values are visible in terminal scrollback, shell history (
                        <Code>~/.bash_history</Code>, <Code>~/.zsh_history</Code>), and piped
                        commands.
                    </P>
                    <CodeBlock lang="bash">{`# Redacted by default
sig get my-jira
# Raw values (use with caution)
sig get my-jira --no-redaction`}</CodeBlock>
                    <P>
                        <strong>Use when:</strong> Debugging credential format, manual API testing.
                        Never pipe raw output into AI agent context or logs.
                    </P>

                    <SectionHeading id="security-shared" level={2}>
                        Shared protections
                    </SectionHeading>
                    <P>All four methods share these protections:</P>
                    <List>
                        <Li>
                            <strong>AES-256-GCM encryption at rest</strong> — all credential files
                            in <Code>~/.sig/credentials/</Code> are encrypted. The encryption key
                            lives at <Code>~/.sig/encryption.key</Code> (mode 0o400, owner-read
                            only).
                        </Li>
                        <Li>
                            <strong>Audit logging</strong> — every credential access, login, logout,
                            sync, and proxy start/stop is logged to <Code>~/.sig/audit.log</Code> as
                            JSON Lines.
                        </Li>
                        <Li>
                            <strong>Result-based error handling</strong> — authentication failures
                            return typed errors (<Code>{'Result<T, AuthError>'}</Code>), never throw
                            exceptions. Credentials are never exposed in error messages.
                        </Li>
                        <Li>
                            <strong>Automatic refresh</strong> — expired credentials are refreshed
                            transparently before use. No stale tokens leak through error paths.
                        </Li>
                    </List>
                </>
            ),
        },

        /* ── Commands ── */
        {
            content: (
                <>
                    <SectionHeading id="commands" level={1}>
                        Commands
                    </SectionHeading>
                    <P>
                        All commands accept <Code>--verbose</Code> for debug output on stderr and{' '}
                        <Code>--help</Code> to show usage.
                    </P>

                    <SectionHeading id="cmd-init" level={2}>
                        sig init
                    </SectionHeading>
                    <P>
                        Creates <Code>~/.sig/config.yaml</Code> interactively. On headless machines
                        use <Code>--remote</Code> to enable browserless mode.
                    </P>
                    <CodeBlock lang="bash">{`sig init                    # interactive setup
sig init --remote           # headless / CI / remote machine
sig init --yes              # accept all defaults, skip prompts
sig init --force            # overwrite existing config
sig init --channel chrome   # use a specific browser (chrome|msedge|chromium)`}</CodeBlock>

                    <SectionHeading id="cmd-doctor" level={2}>
                        sig doctor
                    </SectionHeading>
                    <P>
                        Checks Node version, Playwright installation, config parsing, and that the
                        credentials directory is writable. Run this first when something doesn't
                        work.
                    </P>
                    <CodeBlock lang="bash">{`sig doctor`}</CodeBlock>

                    <SectionHeading id="cmd-run" level={2}>
                        sig run
                    </SectionHeading>
                    <P>
                        <strong>The recommended way to use credentials.</strong> Runs any command
                        with <Code>SIG_&lt;PROVIDER&gt;_*</Code> environment variables injected.
                        Credential values are automatically redacted from the child's stdout and
                        stderr.
                    </P>
                    <CodeBlock lang="bash">{`sig run [provider...] -- <cmd>

# Discover available SIG_<PROVIDER>_* variables
sig run my-jira -- env | grep SIG_MY_JIRA_

# Run with credentials injected
sig run my-jira -- python fetch_issues.py
sig run my-jira -- node export_board.js

# Multiple providers at once
sig run provider-a provider-b -- python cross_tool.py

# No providers — inject all valid credentials
sig run -- python script.py

# Expand individual cookies as SIG_<PROVIDER>_COOKIE_<NAME>=value
sig run my-jira --expand-cookies -- python script.py

# Write credentials to a .env file (auto-deleted after child exits)
sig run my-jira --mount .env -- node app.js
sig run my-jira --mount creds.json --mount-format json -- node app.js`}</CodeBlock>
                </>
            ),
            aside: (
                <>
                    <P>
                        <strong>Why sig run over sig get?</strong> <Code>sig get</Code> exposes raw
                        tokens in shell variables, <Code>ps</Code> output, and AI agent context.{' '}
                        <Code>sig run</Code> injects credentials directly into the child environment
                        and redacts them from output — nothing leaks.
                    </P>
                </>
            ),
        },

        {
            content: (
                <>
                    <SectionHeading id="cmd-login" level={2}>
                        sig login
                    </SectionHeading>
                    <P>
                        Authenticates with a provider. Accepts a URL or provider ID. By default
                        launches Playwright headless; falls back to a visible window when a login
                        page is detected.
                    </P>
                    <CodeBlock lang="bash">{`sig login <url>

# Browser SSO (opens browser automatically)
sig login https://jira.example.com

# Custom provider ID
sig login https://jira.example.com --as my-jira

# API token / Personal Access Token (no browser)
sig login https://jira.example.com --token <your-pat>

# Cookies copied from browser DevTools → Network → Copy as cURL
sig login https://jira.example.com --cookie "SESSION=abc123; csrf_token=xyz"

# HTTP Basic auth
sig login https://jira.example.com --username alice --password hunter2

# Force a specific strategy
sig login https://jira.example.com --strategy cookie
sig login https://jira.example.com --strategy oauth2
sig login https://jira.example.com --strategy api-token
sig login https://jira.example.com --strategy basic

# Skip stored credential check, go straight to browser
sig login https://jira.example.com --force`}</CodeBlock>

                    <SectionHeading id="cmd-logout" level={2}>
                        sig logout
                    </SectionHeading>
                    <CodeBlock lang="bash">{`sig logout my-jira         # clear one provider
sig logout                   # clear all credentials`}</CodeBlock>

                    <SectionHeading id="cmd-get" level={2}>
                        sig get
                    </SectionHeading>
                    <P>
                        Retrieves credential headers for a provider. Prefer <Code>sig run</Code> or{' '}
                        <Code>sig request</Code> over <Code>sig get</Code> — the latter exposes raw
                        values in your shell.
                    </P>
                    <CodeBlock lang="bash">{`sig get my-jira                        # JSON map (default)
sig get my-jira --format json          # structured JSON
sig get my-jira --format header        # HTTP header string
sig get my-jira --format value         # raw value only
sig get jira.example.com                  # by URL`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    Strategy selection: use <Code>--token</Code>, <Code>--cookie</Code>, or{' '}
                    <Code>--username/--password</Code> when you already have credentials — no
                    browser needed. Only launch the browser for SSO sites.
                </P>
            ),
        },

        {
            content: (
                <>
                    <SectionHeading id="cmd-request" level={2}>
                        sig request
                    </SectionHeading>
                    <P>
                        Makes an authenticated HTTP request. Credentials stay internal — never
                        appear in shell history.
                    </P>
                    <CodeBlock lang="bash">{`sig request <url>

sig request https://jira.example.com/api/me
sig request https://jira.example.com/api/issues/123 --format body
sig request https://jira.example.com/api/issues \
  --method POST \
  --body '{"title":"Bug","status":"open"}' \
  --header "Content-Type: application/json"
sig request <url> --format json     # full response (status, headers, body)
sig request <url> --format body     # body only
sig request <url> --format headers  # response headers only`}</CodeBlock>

                    <SectionHeading id="cmd-status" level={2}>
                        sig status
                    </SectionHeading>
                    <CodeBlock lang="bash">{`sig status                       # all providers
sig status my-jira              # one provider
sig status --format json         # machine-readable`}</CodeBlock>

                    <SectionHeading id="cmd-providers" level={2}>
                        sig providers
                    </SectionHeading>
                    <CodeBlock lang="bash">{`sig providers                    # table view
sig providers --format json      # machine-readable`}</CodeBlock>

                    <SectionHeading id="cmd-rename" level={2}>
                        sig rename
                    </SectionHeading>
                    <CodeBlock lang="bash">{`sig rename my-jira my-service   # rename provider ID`}</CodeBlock>

                    <SectionHeading id="cmd-remove" level={2}>
                        sig remove
                    </SectionHeading>
                    <CodeBlock lang="bash">{`sig remove my-jira              # remove provider + credentials
sig remove my-jira --keep-config  # clear credentials only
sig remove my-jira --force        # skip confirmation`}</CodeBlock>
                </>
            ),
        },

        {
            content: (
                <>
                    <SectionHeading id="cmd-remote" level={2}>
                        sig remote
                    </SectionHeading>
                    <P>Manages SSH remotes for credential sync across machines.</P>
                    <CodeBlock lang="bash">{`sig remote add prod ssh://deploy@ci.example.com
sig remote add prod ci.example.com --user deploy --ssh-key ~/.ssh/id_rsa --path ~/.sig
sig remote remove prod
sig remote list
sig remote list --format json`}</CodeBlock>

                    <SectionHeading id="cmd-sync" level={2}>
                        sig sync
                    </SectionHeading>
                    <P>Syncs credentials over SSH. Sign in on your laptop, push to servers.</P>
                    <CodeBlock lang="bash">{`sig sync push prod               # push all credentials to remote
sig sync pull prod               # pull credentials from remote
sig sync push prod --provider my-jira   # sync one provider only
sig sync push --force            # overwrite on conflict`}</CodeBlock>

                    <SectionHeading id="cmd-watch" level={2}>
                        sig watch
                    </SectionHeading>
                    <P>
                        Manages the auto-refresh watch list. The watch loop itself runs as part of
                        the proxy daemon — use <Code>sig proxy start</Code> to keep sessions alive
                        automatically.
                    </P>
                    <CodeBlock lang="bash">{`sig watch add my-jira           # add to watch list
sig watch add my-jira --auto-sync prod   # auto-sync after refresh
sig watch remove my-jira        # remove from watch list
sig watch set-interval 1h       # change default interval`}</CodeBlock>

                    <SectionHeading id="cmd-proxy" level={2}>
                        sig proxy
                    </SectionHeading>
                    <P>
                        Runs a local MITM HTTP/HTTPS proxy daemon. Agents point{' '}
                        <Code>HTTP_PROXY</Code>/<Code>HTTPS_PROXY</Code> at the proxy and make
                        normal requests — credentials are injected transparently and the agent never
                        sees token values. The proxy also runs the watch/refresh loop.
                    </P>
                    <CodeBlock lang="bash">{`sig proxy start                  # start daemon (default port 7891)
sig proxy start --port 8080      # use custom port
sig proxy stop                   # stop daemon
sig proxy status                 # show running state, port, env var hints
sig proxy trust                  # print CA cert path + OS trust instructions

# Usage: point any tool at the proxy
export HTTP_PROXY=http://127.0.0.1:7891
export HTTPS_PROXY=http://127.0.0.1:7891
curl https://jira.example.com/api/me   # credentials injected automatically`}</CodeBlock>
                    <P>
                        <strong>When to use proxy vs sig run:</strong> Use <Code>sig run</Code> for
                        wrapping a single command. Use <Code>sig proxy</Code> for long-lived
                        daemons, tools that fork process trees, or tools that only read proxy env
                        vars.
                    </P>
                    <P>
                        <strong>Inject rules:</strong> For APIs that need credentials in
                        non-standard locations (body fields, query parameters, custom headers), add{' '}
                        <Code>proxy.inject</Code> rules to the provider config. The proxy and{' '}
                        <Code>sig request</Code> apply these rules after standard credential
                        headers.
                    </P>
                    <CodeBlock lang="yaml">{`# Example: inject xoxc token from localStorage as form body parameter
providers:
  app-slack:
    # ... domains, strategy, etc.
    proxy:
      inject:
        - in: body           # header | body | query
          action: set         # set | append | remove
          name: token
          from: credential.localStorage.xoxc-token`}</CodeBlock>
                    <P>
                        The <Code>from</Code> field resolves paths against the stored credential:{' '}
                        <Code>credential.cookies</Code>, <Code>credential.accessToken</Code>,{' '}
                        <Code>credential.localStorage.&lt;key&gt;</Code>,{' '}
                        <Code>credential.xHeaders.&lt;key&gt;</Code>. Body injection supports{' '}
                        <Code>application/json</Code> and{' '}
                        <Code>application/x-www-form-urlencoded</Code> content types.
                    </P>
                    <P>
                        <strong>Auto-refresh:</strong> The proxy daemon runs the watch/refresh loop
                        automatically. Configure which providers to watch in{' '}
                        <Code>config.yaml</Code>:
                    </P>
                    <CodeBlock lang="yaml">{`watch:
  interval: 5m           # check interval (default: 5m)
  providers:
    sap-jira:
      autoSync:            # optional: sync to remotes after refresh
        - dev-server
    ms-teams:`}</CodeBlock>
                    <P>
                        Credentials are refreshed before they expire. Use{' '}
                        <Code>sig watch add &lt;provider&gt;</Code> to manage the watch list, or
                        edit the config directly. The proxy's built-in watch loop replaces the need
                        for a separate <Code>sig watch start</Code> process.
                    </P>
                    <P>
                        <strong>Trusting the CA:</strong> For HTTPS interception, the proxy
                        generates a local CA certificate. Add it to your system trust store:
                    </P>
                    <CodeBlock lang="bash">{`sig proxy trust                  # show CA cert path + instructions

# macOS
sudo security add-trusted-cert -d -r trustRoot \\
  -k /Library/Keychains/System.keychain ~/.sig/proxy/ca.crt

# Ubuntu/Debian
sudo cp ~/.sig/proxy/ca.crt /usr/local/share/ca-certificates/sigcli-proxy.crt
sudo update-ca-certificates

# Per-command (no system trust)
curl --cacert ~/.sig/proxy/ca.crt https://api.example.com`}</CodeBlock>

                    <SectionHeading id="cmd-completion" level={2}>
                        sig completion
                    </SectionHeading>
                    <CodeBlock lang="bash">{`sig completion bash >> ~/.bashrc
sig completion zsh >> ~/.zshrc
sig completion fish > ~/.config/fish/completions/sig.fish`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    Use <Code>sig proxy start</Code> to run the watch loop as a background daemon —
                    it keeps credentials fresh and handles HTTPS interception simultaneously.
                </P>
            ),
        },

        /* ── Environment Variables ── */
        {
            content: (
                <>
                    <SectionHeading id="env-vars" level={1}>
                        Environment Variables
                    </SectionHeading>
                    <P>
                        <Code>sig run</Code> injects <Code>SIG_&lt;PROVIDER&gt;_*</Code> variables
                        into the child process. Use{' '}
                        <Code>sig run my-jira -- env | grep SIG_MY_JIRA_</Code> to discover exactly
                        what's available for a provider.
                    </P>
                    <P>
                        When using the proxy (<Code>sig proxy start</Code>), set{' '}
                        <Code>HTTP_PROXY=http://127.0.0.1:&lt;port&gt;</Code> and{' '}
                        <Code>HTTPS_PROXY=http://127.0.0.1:&lt;port&gt;</Code> — credentials are
                        injected by the proxy and no <Code>SIG_*</Code> variables are needed.
                    </P>
                    <CodeBlock lang="bash">{`# Always present (example: provider "my-jira")
SIG_MY_JIRA_PROVIDER          # provider ID: "my-jira"
SIG_MY_JIRA_CREDENTIAL_TYPE   # credential type: cookie | bearer | api-key | basic

# Bearer / OAuth2 token
SIG_MY_JIRA_TOKEN             # raw token value, e.g. "eyJ..."
SIG_MY_JIRA_AUTH_HEADER       # complete Authorization header value

# Cookie credentials
SIG_MY_JIRA_COOKIE            # full cookie string, e.g. "SESSION=abc; ..."

# With --expand-cookies: individual cookies
SIG_MY_JIRA_COOKIE_SESSION=abc123
SIG_MY_JIRA_COOKIE_CSRF_TOKEN=xyz

# Custom x-headers captured from browser traffic
SIG_MY_JIRA_HEADER_X_AUSERNAME=alice
SIG_MY_JIRA_HEADER_X_ATTOKEN=xyz`}</CodeBlock>

                    <P>Example: reading credentials inside a Python script:</P>
                    <CodeBlock lang="bash">{`import os

# Python script run via: sig run my-jira -- python fetch.py
token = os.environ.get("SIG_MY_JIRA_TOKEN")
cookie = os.environ.get("SIG_MY_JIRA_COOKIE")
auth_type = os.environ.get("SIG_MY_JIRA_CREDENTIAL_TYPE")

if auth_type == "cookie":
    headers = {"Cookie": cookie}
elif auth_type == "bearer":
    headers = {"Authorization": f"Bearer {token}"}`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    Credential values are redacted from child stdout/stderr by default. Use{' '}
                    <Code>--no-redaction</Code> to see raw values during debugging.
                </P>
            ),
        },

        /* ── Configuration ── */
        {
            content: (
                <>
                    <SectionHeading id="configuration" level={1}>
                        Configuration
                    </SectionHeading>

                    <SectionHeading id="config-file" level={2}>
                        config.yaml
                    </SectionHeading>
                    <P>
                        Sigcli reads <Code>~/.sig/config.yaml</Code>. Run <Code>sig init</Code> to
                        generate a starter file. The top-level keys are <Code>mode</Code> and{' '}
                        <Code>providers</Code>.
                    </P>
                    <CodeBlock lang="bash">{`# ~/.sig/config.yaml

mode: browser          # browser | browserless
browserChannel: chrome # chrome | msedge | chromium (default: chromium)

providers:
  my-jira:
    url: https://jira.example.com
    strategy: cookie
    requiredCookies:
      - SESSION
    xHeaders:
      - name: X-User
        header: x-user
      - name: X-Token
        header: x-token`}</CodeBlock>

                    <SectionHeading id="config-providers" level={2}>
                        Provider config options
                    </SectionHeading>
                    <CodeBlock lang="bash">{`providers:
  <provider-id>:
    url: <base-url>              # required: URL to match
    strategy: cookie|oauth2|api-token|basic
    requiredCookies:             # wait until these cookies appear
      - SESSION
    xHeaders:                    # capture these response headers
      - name: X-User        # internal name
        header: x-user      # actual HTTP header name
    forceVisible: true           # always open visible browser (default: false)
    waitUntil: networkidle       # load event: load|domcontentloaded|networkidle
    ttl: 8h                      # credential TTL (e.g. 1h, 8h, 7d)`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    Provider IDs (e.g. <Code>my-jira</Code>) are how you reference a provider in all
                    commands. <Code>sig login</Code> auto-creates a provider entry when you pass a
                    URL; use <Code>--as</Code> to set a custom ID.
                </P>
            ),
        },

        /* ── Auth Strategies ── */
        {
            content: (
                <>
                    <SectionHeading id="strategies" level={1}>
                        Auth Strategies
                    </SectionHeading>
                    <P>
                        A strategy implements <Code>IAuthStrategy</Code>: <Code>validate</Code>,{' '}
                        <Code>authenticate</Code>, <Code>refresh</Code>, and{' '}
                        <Code>applyToRequest</Code>. Sigcli ships four built-in strategies.
                        Auto-detection picks the right one; use <Code>--strategy</Code> to override.
                    </P>

                    <SectionHeading id="strat-cookie" level={3}>
                        cookie
                    </SectionHeading>
                    <P>
                        Captures the cookie jar from a real browser session. Best for SSO sites like
                        Any site with multi-step login (QR codes, SAML, MFA). Supports{' '}
                        <Code>forceVisible</Code>, <Code>waitUntil</Code>, and{' '}
                        <Code>requiredCookies</Code>.
                    </P>
                    <CodeBlock lang="bash">{`sig login https://jira.example.com --strategy cookie`}</CodeBlock>

                    <SectionHeading id="strat-oauth2" level={3}>
                        oauth2
                    </SectionHeading>
                    <P>
                        Watches for <Code>Authorization: Bearer ...</Code> on outgoing requests, or
                        decodes a JWT from an OAuth redirect. Auto-refreshes when a refresh token is
                        present.
                    </P>
                    <CodeBlock lang="bash">{`sig login https://jira.example.com --strategy oauth2`}</CodeBlock>

                    <SectionHeading id="strat-api-token" level={3}>
                        api-token
                    </SectionHeading>
                    <P>
                        For static API keys or Personal Access Tokens you already have. No browser
                        needed — ideal for CI/CD.
                    </P>
                    <CodeBlock lang="bash">{`sig login https://jira.example.com --token <your-pat>`}</CodeBlock>

                    <SectionHeading id="strat-basic" level={3}>
                        basic
                    </SectionHeading>
                    <P>
                        Username and password, encoded to a Basic auth header at request time. The
                        plaintext password is stored only in the sealed credential file under{' '}
                        <Code>~/.sig/credentials/</Code>.
                    </P>
                    <CodeBlock lang="bash">{`sig login https://jira.example.com --username alice --password hunter2`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    Strategies return <Code>{'Result<T, AuthError>'}</Code> — never throw for
                    expected failures. Callers check <Code>isOk()</Code> / <Code>isErr()</Code>.
                    Build custom strategies by implementing <Code>IAuthStrategyFactory</Code>.
                </P>
            ),
        },

        /* ── Browser Adapters ── */
        {
            content: (
                <>
                    <SectionHeading id="browser-adapters" level={1}>
                        Browser Adapters
                    </SectionHeading>
                    <P>
                        Sigcli abstracts the browser behind <Code>IBrowserAdapter</Code> — three
                        small classes: <strong>Adapter → Session → Page</strong>. Two adapters ship
                        in the box.
                    </P>

                    <List>
                        <Li>
                            <strong>playwright</strong> — Default. Uses <Code>playwright-core</Code>{' '}
                            with Chromium, Chrome, or Edge. Supports headless and visible modes.
                            Required for browser SSO.
                        </Li>
                        <Li>
                            <strong>chrome-cdp</strong> — Connects to an existing Chrome instance
                            via the Chrome DevTools Protocol. Useful when you want to attach to your
                            already-open browser without launching a new one.
                        </Li>
                    </List>

                    <P>
                        <Code>sig init --remote</Code> puts Sigcli into <Code>browserless</Code>{' '}
                        mode, where the <Code>NullBrowserAdapter</Code> is used — token/cookie/basic
                        login still works, but SSO flows are disabled.
                    </P>
                    <CodeBlock lang="bash">{`# Which adapter to use?
# → Developer laptop with display: playwright (default)
# → Attach to open Chrome: chrome-cdp
# → Headless CI / remote server: browserless mode + sig sync pull`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    Write a custom adapter by implementing <Code>IBrowserAdapter</Code>,{' '}
                    <Code>IBrowserSession</Code>, and <Code>IBrowserPage</Code>. Lazy-import the
                    browser library and throw <Code>BrowserLaunchError</Code> on import failure so{' '}
                    <Code>sig doctor</Code> can diagnose what's missing.
                </P>
            ),
        },

        /* ── SDK ── */
        {
            content: (
                <>
                    <SectionHeading id="sdk" level={1}>
                        SDK
                    </SectionHeading>
                    <P>
                        Lightweight client SDKs wrap the <Code>sig get</Code> CLI call, parse the
                        JSON output, and return typed credential objects. They are thin wrappers —
                        all auth logic lives in the CLI.
                    </P>

                    <SectionHeading id="sdk-ts" level={2}>
                        TypeScript SDK
                    </SectionHeading>
                    <CodeBlock lang="bash">{`npm install @sigcli/sdk`}</CodeBlock>
                    <CodeBlock lang="bash">{`import { SigClient } from '@sigcli/sdk';

const sig = new SigClient();

// Get credential headers
const headers = await sig.getHeaders('my-jira');
const response = await fetch('https://jira.example.com/api/me', { headers });

// Or use sig.request() directly
const result = await sig.request('https://jira.example.com/api/issues/123');`}</CodeBlock>

                    <SectionHeading id="sdk-python" level={2}>
                        Python SDK
                    </SectionHeading>
                    <CodeBlock lang="bash">{`pip install sigcli-sdk`}</CodeBlock>
                    <CodeBlock lang="bash">{`from sigcli import SigClient

sig = SigClient()

# Get headers
headers = sig.get_headers("my-jira")
response = requests.get("https://jira.example.com/api/me", headers=headers)

# Or use sig.request() directly
result = sig.request("https://jira.example.com/api/issues/123")`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    The SDKs require <Code>sig</Code> to be installed and a valid credential to
                    exist. They call <Code>sig get --format json</Code> internally and parse the
                    result — no browser or network access in the SDK itself.
                </P>
            ),
        },

        /* ── AI Agents ── */
        {
            content: (
                <>
                    <SectionHeading id="ai-agents" level={1}>
                        AI Agent Integration
                    </SectionHeading>
                    <P>
                        Sigcli exposes a stable CLI surface that agents shell out to. No SDK, no MCP
                        server — just commands with predictable exit codes and JSON output.
                    </P>
                    <P>
                        The recommended pattern is <Code>sig run</Code>: the agent spawns a child
                        process with credentials already in the environment. The agent never sees
                        token values. For tools that can't be wrapped — long-lived daemons, tools
                        that fork — use <Code>sig proxy start</Code> instead.
                    </P>
                    <CodeBlock lang="bash">{`# Recommended: sig run keeps credentials out of agent context
sig run my-jira -- python fetch_issues.py
sig run my-jira -- node export_sprint.js

# Alternative: sig proxy for daemons / tools that only read proxy env vars
sig proxy start
export HTTP_PROXY=http://127.0.0.1:7891 HTTPS_PROXY=http://127.0.0.1:7891
# now any tool that respects proxy env vars gets credentials injected

# Discovery: find out what SIG_<PROVIDER>_* vars are available
sig run my-jira -- env | grep SIG_MY_JIRA_

# Alternative: sig request (credentials stay internal)
sig request https://jira.example.com/api/me`}</CodeBlock>

                    <P>
                        For Claude Code, the bundled <Code>/auth</Code> skill wraps these commands.
                        To check auth status before acting:
                    </P>
                    <CodeBlock lang="bash">{`# Always check before logging in — avoid unnecessary browser launches
sig status my-jira --format json
# exit 0 + "valid": true  → credentials ready, skip login
# exit 3                  → no credentials, run sig login
# exit 0 + expired        → sig logout my-jira && sig login https://jira.example.com`}</CodeBlock>
                </>
            ),
            aside: (
                <>
                    <P>
                        The CLI owns locking, TTL, and refresh logic. Shelling out means every
                        caller benefits from those without re-implementing them.
                    </P>
                    <P>
                        Never display <Code>sig get</Code> output in agent context or logs — it may
                        contain raw bearer tokens or API keys.
                    </P>
                </>
            ),
        },

        /* ── Remote & SSH ── */
        {
            content: (
                <>
                    <SectionHeading id="remote-ssh" level={1}>
                        Remote & SSH
                    </SectionHeading>
                    <P>
                        Sign in on your laptop, push credentials to headless servers over SSH. No
                        daemon required — sync uses your existing SSH keys and the same file locking
                        as local storage.
                    </P>
                    <CodeBlock lang="bash">{`# 1. On the headless server — set browserless mode
sig init --remote

# 2. On the laptop — add the remote
sig remote add prod ssh://deploy@ci.example.com
# or with explicit options:
sig remote add prod ci.example.com --user deploy --ssh-key ~/.ssh/id_rsa

# 3. Push all credentials to the server
sig sync push prod

# 4. Push a single provider
sig sync push prod --provider my-jira

# 5. On the server — use immediately, no browser needed
sig run my-jira -- python deploy.py`}</CodeBlock>

                    <P>
                        Pull credentials from a remote machine (e.g. in a CI job that should mirror
                        your dev credentials):
                    </P>
                    <CodeBlock lang="bash">{`sig sync pull prod                # pull all
sig sync pull prod --force        # overwrite on conflict`}</CodeBlock>

                    <P>Keep credentials fresh on the server by pairing watch with auto-sync:</P>
                    <CodeBlock lang="bash">{`# On laptop: refresh my-jira every hour and auto-push to prod
sig watch add my-jira --auto-sync prod
sig watch start --interval 1h`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    Sync transports credential files as-is over SSH — the transport never decodes
                    them. You keep your normal SSH key management; no new infrastructure to run.
                </P>
            ),
        },

        /* ── Error Codes ── */
        {
            content: (
                <>
                    <SectionHeading id="error-codes" level={1}>
                        Error Codes
                    </SectionHeading>
                    <P>All commands exit with a code that scripts can branch on:</P>
                    <CodeBlock lang="bash">{`# Exit codes
0   Success
1   GENERAL_ERROR       — invalid args or unexpected failure
2   PROVIDER_NOT_FOUND  — URL/ID doesn't match any configured provider
3   CREDENTIAL_NOT_FOUND — no stored credentials → run sig login
4   REMOTE_NOT_FOUND    — SSH remote not configured → run sig remote add`}</CodeBlock>

                    <P>
                        Auth error codes from <Code>--verbose</Code> stderr:
                    </P>
                    <CodeBlock lang="bash">{`CREDENTIAL_EXPIRED        # token/cookie expired, refresh failed
                          # fix: sig logout <p> && sig login <url>

CREDENTIAL_TYPE_MISMATCH  # wrong credential type for provider
                          # fix: re-login with --strategy <name>

REFRESH_FAILED            # OAuth2 refresh token rejected
                          # fix: sig logout <p> && sig login <url>

BROWSER_LAUNCH_ERROR      # playwright-core not installed or no browser
                          # fix: sig doctor; install playwright-core

BROWSER_TIMEOUT           # browser auth took too long
                          # fix: retry; if CAPTCHA/MFA ensure visible mode

BROWSER_UNAVAILABLE       # machine is in browserless mode
                          # fix: use --token/--cookie or sig sync pull

CONFIG_ERROR              # malformed ~/.sig/config.yaml
                          # fix: sig doctor to validate

SYNC_CONFLICT             # local/remote credentials differ
                          # fix: sig sync pull --force

STORAGE_ERROR             # cannot read/write credential files
                          # fix: check permissions on ~/.sig/credentials/`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    Add <Code>--verbose</Code> to any command to see detailed error messages on
                    stderr. Use <Code>sig doctor</Code> as the first step when something doesn't
                    work.
                </P>
            ),
        },
    ] as EditorialSection[],
};
