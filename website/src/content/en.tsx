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
        title: 'sig — Connect your systems. Let AI do the rest.',
        description:
            'The authentication layer for AI agents. Log in once via browser SSO, then let your AI agent access Jira, wikis, calendars, and internal APIs — without ever seeing your credentials.',
    },

    toc: [
        tocItem('#overview', 'Overview'),
        tocItem('#the-problem', 'The problem', { level: 1, parent: '#overview' }),
        tocItem('#the-solution', 'The solution', { level: 1, parent: '#overview' }),
        tocItem('#quick-start', 'Quick start'),
        tocItem('#how-it-works', 'How it works'),
        tocItem('#features', 'Features'),
        tocItem('#security', 'Security'),
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
                The authentication layer for AI agents. Log in once in your browser — your AI agent
                handles the rest.
            </p>
            <div style={{ margin: '24px 0 0' }}>
                <img
                    src="/demo.gif"
                    alt="sig demo — login, status, request, run, proxy"
                    style={{
                        width: '100%',
                        maxWidth: '720px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-primary)',
                    }}
                />
            </div>
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

                    <SectionHeading id="the-problem" level={2}>
                        The problem
                    </SectionHeading>
                    <P>
                        AI coding agents (Claude Code, Cursor, Copilot) need to call your work APIs.
                        But credentials leak into shell history, <Code>ps</Code> output, and agent
                        context windows. You can't give an agent your SSO password. You can't paste
                        cookies into every script.
                    </P>

                    <SectionHeading id="the-solution" level={2}>
                        The solution
                    </SectionHeading>
                    <P>
                        sig sits between your browser and your AI agent. You authenticate once via
                        real browser SSO. sig captures cookies, tokens, and headers — encrypts them
                        — and injects them into any process your agent runs. The agent
                        authenticates. It never sees secrets.
                    </P>
                </>
            ),
            aside: (
                <P>
                    Credentials are captured from live browser network traffic and sealed under{' '}
                    <Code>~/.sig</Code> with AES-256-GCM encryption — nothing in your repo, nothing
                    in your shell history, nothing in your agent context window.
                </P>
            ),
        },

        /* ── Quick start ── */
        {
            content: (
                <>
                    <SectionHeading id="quick-start" level={1}>
                        Quick start
                    </SectionHeading>
                    <CodeBlock lang="bash">{`# 1. Install
npm install -g @sigcli/cli

# or without global install:
npx @sigcli/cli sig --help`}</CodeBlock>

                    <CodeBlock lang="bash">{`# 2. Generate config
sig init

# 3. Sign in — opens a real browser, captures credentials automatically
sig login https://my-jira.example.com

# 4. Make authenticated requests — credentials stay internal, never leak to agents
sig request https://my-jira.example.com/rest/api/2/myself

# Or start the MITM proxy — agents set HTTP_PROXY and credentials inject automatically
sig proxy start
export HTTP_PROXY=http://127.0.0.1:$(sig proxy status --port)
curl https://my-jira.example.com/rest/api/2/myself`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    <Code>sig run my-jira -- env | grep SIG_MY_JIRA_</Code> is the quickest way to
                    discover exactly which environment variables are available for a provider.
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
                        Three steps: configure, authenticate once, let your AI agent operate. The
                        auth flow runs once; every subsequent call reads from encrypted storage.
                    </P>

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

                    <P>
                        <strong>Step 1 — Configure providers in YAML:</strong>
                    </P>
                    <CodeBlock lang="yaml">{`providers:
  my-jira:
    url: https://my-jira.example.com
    strategy: cookie
    requiredCookies: [SESSION]`}</CodeBlock>

                    <P>
                        <strong>
                            Step 2 — Authenticate once (browser SSO, headless → visible):
                        </strong>
                    </P>
                    <CodeBlock lang="bash">{`$ sig login https://my-jira.example.com
→ chromium headless …
⚠ login page detected — opening window
✓ captured 4 cookies · 2 x-headers
✓ sealed under ~/.sig/credentials/my-jira.json`}</CodeBlock>

                    <P>
                        <strong>Step 3 — Your AI agent operates:</strong>
                    </P>
                    <CodeBlock lang="bash">{`# sig run — inject credentials as env vars
$ sig run my-jira -- python fetch_issues.py

# sig proxy — zero-trust MITM injection
$ HTTP_PROXY=http://127.0.0.1:8080 claude "fetch all open issues from my-jira"

# sig request — direct authenticated HTTP
$ sig request https://my-jira.example.com/rest/api/2/myself`}</CodeBlock>
                </>
            ),
            aside: (
                <>
                    <P>
                        The hybrid browser flow is the key insight — headless is fast and invisible,
                        but real login pages need a visible window. sig detects the difference
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
                            <strong>MITM proxy</strong> — zero-trust credential injection.{' '}
                            <Code>sig proxy start</Code> runs a local HTTPS proxy at{' '}
                            <Code>127.0.0.1</Code>. Your agent sets <Code>HTTP_PROXY</Code>/
                            <Code>HTTPS_PROXY</Code> and sig handles the rest. The agent
                            authenticates — it never sees tokens.
                        </Li>
                        <Li>
                            <strong>sig run</strong> — inject <Code>SIG_&lt;PROVIDER&gt;_*</Code>{' '}
                            env vars into any process. Multi-provider. Output redacted. The simplest
                            way to give an agent access to a single service.
                        </Li>
                        <Li>
                            <strong>4 auth strategies</strong> — <Code>cookie</Code> (browser SSO),{' '}
                            <Code>oauth2</Code> (Bearer/JWT), <Code>api-token</Code> (static keys),{' '}
                            <Code>basic</Code> (username/password). Auto-detected or forced with{' '}
                            <Code>--strategy</Code>.
                        </Li>
                        <Li>
                            <strong>Encrypted at rest</strong> — AES-256-GCM. Every credential
                            access is audit-logged. Legacy unencrypted files are automatically
                            re-encrypted on read.
                        </Li>
                        <Li>
                            <strong>SSH sync</strong> — log in on your laptop, push credentials to
                            CI or remote servers with <Code>sig sync push</Code>. No daemon
                            required.
                        </Li>
                        <Li>
                            <strong>TypeScript & Python SDKs</strong> — thin wrappers around the CLI
                            for programmatic use in agents and scripts.
                        </Li>
                    </List>
                </>
            ),
            aside: (
                <P>
                    sig works with any AI agent that can run shell commands or set environment
                    variables — Claude Code, Cursor, Copilot, custom scripts. No MCP server, no SDK
                    required.
                </P>
            ),
        },

        /* ── Security ── */
        {
            content: (
                <>
                    <SectionHeading id="security" level={1}>
                        Security
                    </SectionHeading>
                    <P>
                        sig provides four ways for agents to use credentials, ordered from most to
                        least secure:
                    </P>
                    <CodeBlock lang="diagram" showLineNumbers={false}>{`
 Method          Security    How
 ─────────────────────────────────────────────────────────────────────────────
 sig proxy       Highest     MITM daemon — credentials never leave proxy memory
 sig request     High        Direct authenticated HTTP — credentials in-process only
 sig run         Moderate    Env vars injected — output redacted
 sig get         Low         Prints to stdout — use with caution
`}</CodeBlock>
                    <P>
                        For AI agents, use <Code>sig proxy</Code> (best) or <Code>sig request</Code>
                        . Never pipe <Code>sig get</Code> output into agent context.
                    </P>
                    <P>
                        <A href="/docs/">Full documentation →</A>
                    </P>
                </>
            ),
            aside: (
                <P>
                    The encryption key lives at <Code>~/.sig/encryption.key</Code> (mode{' '}
                    <Code>0400</Code>). Every credential file is encrypted with a unique nonce —
                    even if one file is compromised, others remain safe.
                </P>
            ),
        },
    ] as EditorialSection[],
};
