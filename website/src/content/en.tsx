import {
    SectionHeading,
    P,
    Code,
    CodeBlock,
    A,
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
        pageHref: '/',
    };
}

export const pageContent = {
    meta: {
        title: 'Sigcli — Log in once. Request anywhere.',
        description:
            'General-purpose authentication CLI with pluggable strategies and browser adapters. Capture cookies, tokens and x-headers from a real browser and sync them everywhere.',
    },

    toc: [
        tocItem('#overview', 'Overview'),
        tocItem('#install', 'Install', { level: 1, parent: '#overview' }),
        tocItem('#quick-start', 'Quick start', { level: 1, parent: '#overview' }),
        tocItem('#how-it-works', 'How it works'),
        tocItem('#features', 'Features'),
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
                General-purpose authentication CLI with pluggable strategies and browser adapters.
                Log in once in your browser, use those credentials everywhere — your agents, your
                scripts, your servers.
            </p>
        </div>
    ),

    sections: [
        /* ── Overview ── */
        {
            content: (
                <>
                    <SectionHeading id="overview" level={1}>
                        Overview
                    </SectionHeading>
                    <P>
                        Sigcli is a personal seal of authority. You describe providers in a YAML
                        config, sign in once with a real browser, and every other tool —{' '}
                        <Code>curl</Code>, your AI agent, a CI job — gets ready-to-use credentials
                        injected directly into the process environment.
                    </P>
                    <P>No SDK wrappers, no vendor lock-in. One CLI, any site you can sign in to.</P>

                    <CodeBlock lang="diagram" showLineNumbers={false}>{`
 ┌──────────────────┐    ┌───────────────────────┐    ┌──────────────────────┐
 │  ANY AGENT       │    │  ~/.sig               │    │  YOUR BROWSER        │
 │                  │    │                       │    │                      │
 │  ┌────────────┐  │    │  config.yaml          │    │  ┌────────────────┐  │
 │  │ sig run    ├──┼───>│  credentials/         │<───┼──┤ Playwright     │  │
 │  │ sig req    │  │    │    my-jira.json       │    │  │ (headless or   │  │
 │  └─────┬──────┘  │    │    github.json        │    │  │  visible)      │  │
 │        │         │    │    grafana.json       │    │  └───────┬────────┘  │
 │        v         │    │                       │    │          │           │
 │  curl, fetch,    │    │  ┌─────────────────┐  │    │  cookies, tokens,    │
 │  agents, CI      │<───┼──┤ SSH transport   │  │    │  x-headers,          │
 │                  │    │  │ sig sync push   │  │    │  localStorage        │
 │  ┌────────────┐  │    │  └─────────────────┘  │    │                      │
 │  │HTTP_PROXY= ├──┼──> │  ┌─────────────────┐  │    │                      │
 │  │sig proxy   │  │    │  │ MITM proxy      │  │    │                      │
 │  └────────────┘  │    │  │ sig proxy start │  │    │                      │
 │                  │    │  └─────────────────┘  │    │                      │
 └──────────────────┘    └───────────────────────┘    └──────────────────────┘
`}</CodeBlock>

                    <SectionHeading id="install" level={2}>
                        Install
                    </SectionHeading>
                    <CodeBlock lang="bash">{`npm install -g @sigcli/cli

# or without global install:
npx @sigcli/cli sig --help`}</CodeBlock>

                    <SectionHeading id="quick-start" level={2}>
                        Quick start
                    </SectionHeading>
                    <CodeBlock lang="bash">{`# 1. generate config
sig init

# 2. sign in — opens a real browser, captures credentials automatically
sig login https://jira.example.com

# 3. run any command with credentials injected as SIG_<PROVIDER>_* env vars
sig run my-jira -- curl https://jira.example.com/api/me

# discover what variables are available
sig run my-jira -- env | grep SIG_MY_JIRA_`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    Credentials are captured from live browser network traffic and sealed under{' '}
                    <Code>~/.sig</Code> with a directory lock — nothing in your repo, nothing in
                    your shell history.
                </P>
            ),
        },

        /* ── How it works ── */
        {
            content: (
                <>
                    <SectionHeading id="how-it-works" level={1}>
                        How it works
                    </SectionHeading>
                    <P>
                        Three steps: configure, login, run. The auth flow runs once; every
                        subsequent call reads from sealed storage.
                    </P>
                    <CodeBlock lang="bash">{`# 1. Describe the provider in ~/.sig/config.yaml
providers:
  my-jira:
    url: https://jira.example.com
    strategy: cookie
    requiredCookies: [SESSION]

# 2. Authenticate once — headless first, visible on login page detection
$ sig login https://jira.example.com
→ chromium headless …
⚠ login page detected — opening window
✓ captured 4 cookies · 2 x-headers
✓ sealed under ~/.sig/credentials/my-jira.json

# 3. Use credentials via sig run — nothing leaks to shell
$ sig run my-jira -- python fetch_issues.py
$ sig run my-jira -- node export_board.js`}</CodeBlock>
                </>
            ),
            aside: (
                <>
                    <P>
                        The hybrid browser flow is the key insight — headless is fast and invisible,
                        but real login pages need a visible window. Sigcli detects the difference
                        automatically.
                    </P>
                    <P>
                        <Code>sig doctor</Code> verifies Node, Playwright, config parsing, and that
                        the credentials directory is writable.
                    </P>
                </>
            ),
        },

        /* ── Features ── */
        {
            content: (
                <>
                    <SectionHeading id="features" level={1}>
                        Features
                    </SectionHeading>
                    <List>
                        <Li>
                            <strong>MITM proxy</strong> — <Code>sig proxy start</Code> runs a local
                            HTTPS proxy at <Code>127.0.0.1</Code>. Agents set{' '}
                            <Code>HTTP_PROXY</Code>/<Code>HTTPS_PROXY</Code> and credentials are
                            injected transparently — the agent never sees tokens. Ideal for
                            long-lived daemons or tools that can't be wrapped with{' '}
                            <Code>sig run</Code>.
                        </Li>
                        <Li>
                            <strong>sig run</strong> — inject <Code>SIG_&lt;PROVIDER&gt;_*</Code>{' '}
                            credentials directly into any child process. Values are redacted from
                            output. The recommended way to use credentials.
                        </Li>
                        <Li>
                            <strong>4 strategies</strong> — <Code>cookie</Code> (browser SSO),{' '}
                            <Code>oauth2</Code> (Bearer/JWT), <Code>api-token</Code> (static keys),{' '}
                            <Code>basic</Code> (username/password). Auto-detected or forced with{' '}
                            <Code>--strategy</Code>.
                        </Li>
                        <Li>
                            <strong>Browser adapters</strong> — Playwright (default) or Chrome CDP.
                            Headless with automatic visible fallback. Pluggable for custom adapters.
                        </Li>
                        <Li>
                            <strong>SSH sync</strong> — sign in on your laptop, push to CI or remote
                            servers with <Code>sig sync push</Code>. No daemon required.
                        </Li>
                        <Li>
                            <strong>AI agent ready</strong> — stable CLI surface with predictable
                            exit codes and JSON output. No MCP server needed.
                        </Li>
                        <Li>
                            <strong>TypeScript & Python SDKs</strong> — thin wrappers around the CLI
                            for programmatic use.
                        </Li>
                    </List>
                    <P>
                        <A href="/docs/">Full documentation →</A>
                    </P>
                </>
            ),
            aside: (
                <P>
                    <Code>sig run my-jira -- env | grep SIG_MY_JIRA_</Code> is the quickest way to
                    discover exactly which environment variables are available for a provider.
                </P>
            ),
        },
    ] as EditorialSection[],
};
