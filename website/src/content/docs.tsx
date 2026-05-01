import {
    Code,
    CodeBlock,
    Li,
    List,
    P,
    SectionHeading,
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
        title: 'SigCLI User Guide',
        description: 'User guide for SigCLI — authenticate once, use credentials everywhere.',
    },

    toc: [
        tocItem('#how-it-works', 'How it works'),

        tocItem('#getting-started', 'Getting Started'),
        tocItem('#install', 'Install', { level: 1, parent: '#getting-started', prefix: '├ ' }),
        tocItem('#first-login', 'First login', {
            level: 1,
            parent: '#getting-started',
            prefix: '└ ',
        }),

        tocItem('#using-credentials', 'Using Credentials'),
        tocItem('#sig-request', 'sig request', {
            level: 1,
            parent: '#using-credentials',
            prefix: '├ ',
        }),
        tocItem('#sig-run', 'sig run', { level: 1, parent: '#using-credentials', prefix: '├ ' }),
        tocItem('#sig-proxy', 'sig proxy', {
            level: 1,
            parent: '#using-credentials',
            prefix: '├ ',
        }),
        tocItem('#sig-get', 'sig get', { level: 1, parent: '#using-credentials', prefix: '└ ' }),

        tocItem('#configuration', 'Configuration'),
        tocItem('#config-file', 'config.yaml', {
            level: 1,
            parent: '#configuration',
            prefix: '├ ',
        }),
        tocItem('#adding-provider', 'Adding a provider', {
            level: 1,
            parent: '#configuration',
            prefix: '├ ',
        }),
        tocItem('#localstorage', 'localStorage tokens', {
            level: 1,
            parent: '#configuration',
            prefix: '├ ',
        }),
        tocItem('#required-cookies', 'Required cookies', {
            level: 1,
            parent: '#configuration',
            prefix: '└ ',
        }),

        tocItem('#remote-sync', 'Remote & Sync'),
        tocItem('#remote-setup', 'Setup', { level: 1, parent: '#remote-sync', prefix: '├ ' }),
        tocItem('#auto-refresh', 'Auto-refresh', {
            level: 1,
            parent: '#remote-sync',
            prefix: '└ ',
        }),

        tocItem('#troubleshooting', 'Troubleshooting'),
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
                Authenticate once, use credentials everywhere.
            </p>
        </div>
    ),

    sections: [
        /* ── How it works ── */
        {
            content: (
                <>
                    <SectionHeading id="how-it-works" level={1}>
                        How it works
                    </SectionHeading>
                    <P>
                        SigCLI opens a real browser for you to log in — any SSO, any site. It
                        captures the session credentials, encrypts them locally, and makes them
                        available to your scripts and AI agents on demand.
                    </P>
                    <CodeBlock lang="bash">{`You log in once          sig stores credentials       Your tools use them
(real browser, any SSO)  (encrypted, ~/.sig/)          (sig request / run / proxy)`}</CodeBlock>
                    <P>
                        No passwords in shell history. No tokens in your repo. No manual copy-paste.
                    </P>
                </>
            ),
        },

        /* ── Getting Started ── */
        {
            content: (
                <>
                    <SectionHeading id="getting-started" level={1}>
                        Getting Started
                    </SectionHeading>

                    <SectionHeading id="install" level={2}>
                        Install
                    </SectionHeading>
                    <CodeBlock lang="bash">{`npm install -g @sigcli/cli`}</CodeBlock>
                    <P>
                        Requires Node 18+. Then run <Code>sig init</Code> to detect your browser and
                        create the config file.
                    </P>
                    <CodeBlock lang="bash">{`sig init`}</CodeBlock>

                    <SectionHeading id="first-login" level={2}>
                        First login
                    </SectionHeading>
                    <P>
                        Pass any URL — sig opens a browser, you log in normally, sig captures the
                        session:
                    </P>
                    <CodeBlock lang="bash">{`sig login https://jira.example.com`}</CodeBlock>
                    <P>That's it. Check it worked:</P>
                    <CodeBlock lang="bash">{`sig status`}</CodeBlock>
                    <P>Now use the credentials:</P>
                    <CodeBlock lang="bash">{`sig request https://jira.example.com/rest/api/2/myself`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    You can also pass credentials directly without opening a browser:
                    <br />
                    <Code>sig login &lt;url&gt; --token &lt;pat&gt;</Code>
                    <br />
                    <Code>sig login &lt;url&gt; --cookie "key=val"</Code>
                </P>
            ),
        },

        /* ── Using Credentials ── */
        {
            content: (
                <>
                    <SectionHeading id="using-credentials" level={1}>
                        Using Credentials
                    </SectionHeading>
                    <P>Four ways to use stored credentials, from most secure to least:</P>

                    <SectionHeading id="sig-request" level={2}>
                        sig request
                    </SectionHeading>
                    <P>Make an authenticated HTTP request. Credentials never leave the process.</P>
                    <CodeBlock lang="bash">{`sig request https://jira.example.com/rest/api/2/myself

# POST with body
sig request https://jira.example.com/rest/api/2/issue \\
  --method POST \\
  --body '{"fields":{"summary":"Bug"}}' \\
  --header "Content-Type: application/json"

# Output formats
sig request <url> --format body      # response body only
sig request <url> --format headers   # response headers only
sig request <url> --format json      # full structured response`}</CodeBlock>

                    <SectionHeading id="sig-run" level={2}>
                        sig run
                    </SectionHeading>
                    <P>
                        Run any command with credentials injected as environment variables.
                        Sensitive values are automatically redacted from output.
                    </P>
                    <CodeBlock lang="bash">{`# Run a script with credentials
sig run jira -- python fetch_issues.py

# Multiple providers at once
sig run jira slack -- python cross_tool.py

# See what env vars are available
sig run jira -- env | grep SIG_`}</CodeBlock>
                    <P>
                        Injected variables follow the pattern{' '}
                        <Code>SIG_&lt;PROVIDER&gt;_COOKIE</Code> or{' '}
                        <Code>SIG_&lt;PROVIDER&gt;_TOKEN</Code>.
                    </P>

                    <SectionHeading id="sig-proxy" level={2}>
                        sig proxy
                    </SectionHeading>
                    <P>
                        Start a local proxy that injects credentials into any HTTP request
                        transparently. Apps don't need any changes — just point{' '}
                        <Code>HTTP_PROXY</Code> at it.
                    </P>
                    <CodeBlock lang="bash">{`sig proxy start

# Then any tool works automatically:
export HTTP_PROXY=http://127.0.0.1:7891
export HTTPS_PROXY=http://127.0.0.1:7891
curl https://jira.example.com/rest/api/2/myself

sig proxy stop`}</CodeBlock>
                    <P>
                        Best for long-running processes, AI agents, and tools that fork many
                        subprocesses.
                    </P>

                    <SectionHeading id="sig-get" level={2}>
                        sig get
                    </SectionHeading>
                    <P>
                        Print credential headers to stdout. Use sparingly — values are exposed in
                        your shell.
                    </P>
                    <CodeBlock lang="bash">{`sig get jira                          # JSON headers
sig get jira --format value           # raw cookie string
sig get jira --format header          # HTTP header format`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    <strong>Which one should I use?</strong>
                    <br />
                    <Code>sig proxy</Code> — AI agents, daemons
                    <br />
                    <Code>sig request</Code> — one-off API calls
                    <br />
                    <Code>sig run</Code> — wrapping scripts/tools
                    <br />
                    <Code>sig get</Code> — debugging only
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
                        Everything lives in <Code>~/.sig/config.yaml</Code>. Running{' '}
                        <Code>sig login &lt;url&gt;</Code> auto-creates provider entries, so most
                        users never edit this file manually.
                    </P>
                    <CodeBlock lang="yaml">{`# ~/.sig/config.yaml
version: 2
mode: browser

browser:
  execPath: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
  browserDataDir: ~/.sig/browser-data

storage:
  credentialsDir: ~/.sig/credentials

providers:
  jira:
    domains:
      - jira.example.com
    entryUrl: https://jira.example.com/
    strategy: browser
    ttl: 10d
    extract:
      - from: cookies
        as: session
        match: "*"
    apply:
      - in: header
        name: Cookie
        value: "\${session}"`}</CodeBlock>

                    <SectionHeading id="adding-provider" level={2}>
                        Adding a provider
                    </SectionHeading>
                    <P>
                        The easiest way: just <Code>sig login &lt;url&gt;</Code> — sig auto-creates
                        config. For manual setup, add a provider entry with these fields:
                    </P>
                    <CodeBlock lang="yaml">{`my-service:
  domains: [example.com]        # which URLs this provider handles
  entryUrl: https://example.com/  # URL opened for login
  strategy: browser             # use browser to authenticate
  ttl: 12h                      # how long credentials are valid
  extract:
    - from: cookies             # what to capture (cookies or localStorage)
      as: session               # name for the captured value
      match: "*"                # which cookies (* = all)
  apply:
    - in: header                # how to inject into requests
      name: Cookie
      value: "\${session}"       # reference the extracted value`}</CodeBlock>

                    <SectionHeading id="localstorage" level={2}>
                        localStorage tokens
                    </SectionHeading>
                    <P>
                        Some apps store tokens in localStorage instead of cookies (Slack, Microsoft
                        Teams). Use <Code>from: localStorage</Code> with a key pattern and optional{' '}
                        <Code>jsonPath</Code>:
                    </P>
                    <CodeBlock lang="yaml">{`app-slack:
  domains: [your-org.enterprise.slack.com]
  entryUrl: https://app.slack.com/client/YOUR_TEAM_ID
  strategy: browser
  extract:
    - from: cookies
      as: session
      match: "*"
    - from: localStorage
      as: xoxc-token
      match: localConfig_v2
      jsonPath: teams.YOUR_TEAM_ID.token
  apply:
    - in: header
      name: Cookie
      value: "\${session}"
    - in: header
      name: Authorization
      value: "Bearer \${xoxc-token}"`}</CodeBlock>

                    <SectionHeading id="required-cookies" level={2}>
                        Required cookies
                    </SectionHeading>
                    <P>
                        Public sites set tracking cookies to all visitors. Add <Code>required</Code>{' '}
                        so sig knows which cookies mean "actually logged in":
                    </P>
                    <CodeBlock lang="yaml">{`reddit:
  domains: [www.reddit.com]
  entryUrl: https://www.reddit.com/
  strategy: browser
  required:
    - cookie.reddit_session
    - cookie.token_v2
  extract:
    - from: cookies
      as: cookie
      match: "*"
  apply:
    - in: header
      name: Cookie
      value: "\${cookie}"`}</CodeBlock>
                    <P>
                        If required cookies are missing after headless login, sig automatically
                        opens your real browser where you're already logged in.
                    </P>
                </>
            ),
            aside: (
                <P>
                    <strong>Tip:</strong> Use <Code>sig login &lt;url&gt; --as my-name</Code> to
                    pick a custom provider ID instead of the auto-generated one.
                </P>
            ),
        },

        /* ── Remote & Sync ── */
        {
            content: (
                <>
                    <SectionHeading id="remote-sync" level={1}>
                        Remote & Sync
                    </SectionHeading>
                    <P>Log in on your laptop, push credentials to headless servers over SSH.</P>

                    <SectionHeading id="remote-setup" level={2}>
                        Setup
                    </SectionHeading>
                    <CodeBlock lang="bash">{`# On the server — set up without a browser:
sig init --remote

# On your laptop — add the remote and push:
sig remote add prod user@server.example.com
sig sync push prod

# On the server — use credentials:
sig run jira -- python deploy.py`}</CodeBlock>

                    <SectionHeading id="auto-refresh" level={2}>
                        Auto-refresh
                    </SectionHeading>
                    <P>
                        Keep sessions alive automatically. The proxy daemon handles refresh in the
                        background.
                    </P>
                    <CodeBlock lang="bash">{`sig watch add jira              # add to auto-refresh list
sig proxy start                 # proxy also runs the refresh loop

# Optional: auto-sync to remote after each refresh
sig watch add jira --auto-sync prod`}</CodeBlock>
                </>
            ),
        },

        /* ── Troubleshooting ── */
        {
            content: (
                <>
                    <SectionHeading id="troubleshooting" level={1}>
                        Troubleshooting
                    </SectionHeading>
                    <P>
                        Run <Code>sig doctor</Code> first — it checks your browser, config, and
                        permissions.
                    </P>
                    <CodeBlock lang="bash">{`sig doctor`}</CodeBlock>
                    <List>
                        <Li>
                            <strong>Login captures wrong cookies:</strong> Add <Code>required</Code>{' '}
                            to your provider config to specify which cookies mean "logged in".
                        </Li>
                        <Li>
                            <strong>Site blocks headless browser:</strong> Use{' '}
                            <Code>sig login &lt;url&gt; --mode cdp</Code> to use your real browser
                            without automation markers.
                        </Li>
                        <Li>
                            <strong>Credentials expire quickly:</strong> Set a longer{' '}
                            <Code>ttl</Code> or use <Code>sig watch add &lt;provider&gt;</Code> for
                            auto-refresh.
                        </Li>
                        <Li>
                            <strong>Proxy HTTPS errors:</strong> Run <Code>sig proxy trust</Code> to
                            add the local CA to your system.
                        </Li>
                        <Li>
                            <strong>No browser on this machine:</strong> Use{' '}
                            <Code>sig init --remote</Code> + <Code>sig sync pull</Code> to get
                            credentials from another machine.
                        </Li>
                    </List>
                    <P>
                        Add <Code>--verbose</Code> to any command for detailed error output.
                    </P>
                </>
            ),
        },
    ] as EditorialSection[],
};
