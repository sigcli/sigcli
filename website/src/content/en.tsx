import {
  SectionHeading,
  P,
  Code,
  CodeBlock,
  type EditorialSection,
} from '../components/markdown'
import type { FlatTocItem, TocNodeType } from '../components/toc-tree'

function tocItem(href: string, label: string, opts: { level?: 0|1|2|3; parent?: string; prefix?: string; type?: TocNodeType } = {}): FlatTocItem {
  return {
    href,
    label,
    type: opts.type ?? (opts.level === 0 || !opts.level ? 'h2' : 'h3'),
    visualLevel: (opts.level ?? 0) as FlatTocItem['visualLevel'],
    prefix: opts.prefix ?? '',
    parentHref: opts.parent ?? null,
    pageHref: '/',
  }
}

export const pageContent = {
  meta: {
    title: 'Signet — Log in once. Request anywhere.',
    description:
      'General-purpose authentication CLI with pluggable strategies and browser adapters. Capture cookies, tokens and x-headers from a real browser and sync them everywhere.',
  },

  toc: [
    tocItem('#overview', 'Overview'),
    tocItem('#install', 'Install', { level: 1, parent: '#overview' }),
    tocItem('#quick-start', 'Quick start', { level: 1, parent: '#overview' }),
    tocItem('#how-it-works', 'How it works'),
    tocItem('#configure', 'Configure providers', { level: 1, parent: '#how-it-works' }),
    tocItem('#login', 'Log in once', { level: 1, parent: '#how-it-works' }),
    tocItem('#use', 'Use the credential', { level: 1, parent: '#how-it-works' }),
    tocItem('#strategies', 'Strategies'),
    tocItem('#cookie', 'cookie', { level: 1, parent: '#strategies', prefix: '├ ' }),
    tocItem('#bearer', 'bearer', { level: 1, parent: '#strategies', prefix: '├ ' }),
    tocItem('#api-key', 'api-key', { level: 1, parent: '#strategies', prefix: '├ ' }),
    tocItem('#basic', 'basic', { level: 1, parent: '#strategies', prefix: '└ ' }),
    tocItem('#browser-adapters', 'Browser adapters'),
    tocItem('#sync', 'Sync & remotes'),
    tocItem('#agents', 'AI agents'),
    tocItem('#commands', 'Commands'),
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
        Log in once in your browser, use those credentials everywhere — your agents, your scripts, your servers.
      </p>
    </div>
  ),

  sections: [
    /* ── Overview ── */
    {
      content: (
        <>
          <SectionHeading id="overview" level={1}>Overview</SectionHeading>
          <P>
            Signet is a general-purpose authentication CLI. You describe providers in a YAML config, sign in once with a real browser, and every other tool — <Code>curl</Code>, your AI agent, a CI job — asks Signet for ready-to-use HTTP headers.
          </P>
          <P>
            No SDK wrappers, no vendor lock-in. One CLI, any site you can sign in to.
          </P>

          <CodeBlock lang="diagram">{`┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  ANY AGENT      │     │   ~/.signet          │     │   YOUR BROWSER      │
│                 │     │                      │     │                     │
│  ┌───────────┐  │     │  config.yaml         │     │  ┌───────────────┐  │
│  │ sig get   │──────>│  credentials/         │<──────│  Playwright   │  │
│  │ sig req   │  │     │    openai.json        │     │  │  (headless or │  │
│  └───────────┘  │     │    slack.json         │     │  │   visible)    │  │
│       │         │     │    notion.json        │     │  └───────────────┘  │
│       v         │     │                      │     │         │           │
│  curl, fetch,   │     │  ┌────────────────┐  │     │   cookies, tokens,  │
│  agents, CI     │<──────│  SSH transport  │  │     │   x-headers,        │
│                 │     │  │  sig sync push  │  │     │   localStorage      │
│                 │     │  └────────────────┘  │     │                     │
└─────────────────┘     └──────────────────────┘     └─────────────────────┘`}</CodeBlock>

          <SectionHeading id="install" level={2}>Install</SectionHeading>
          <CodeBlock lang="bash">{`npm install -g signet-cli

# or without global install:
npx signet-cli sig --help`}</CodeBlock>

          <SectionHeading id="quick-start" level={2}>Quick start</SectionHeading>
          <CodeBlock lang="bash">{`# 1. generate config
sig init

# 2. sign in (opens a real browser)
sig login https://chat.openai.com

# 3. get headers for any HTTP client
sig get openai --json

# 4. or let signet make the request
sig request https://api.openai.com/v1/models`}</CodeBlock>
        </>
      ),
      aside: (
        <P>
          Signet captures cookies, bearer tokens, localStorage values, and x-headers from live browser network traffic. Credentials are sealed under <Code>~/.signet</Code> with a directory lock — nothing in your repo.
        </P>
      ),
    },

    /* ── How it works ── */
    {
      content: (
        <>
          <SectionHeading id="how-it-works" level={1}>How it works</SectionHeading>
          <P>
            Three steps: configure, login, request. The auth flow runs once; every subsequent call reads from sealed storage.
          </P>
          <SectionHeading id="configure" level={2}>Configure providers</SectionHeading>
          <P>
            Each provider entry in <Code>~/.signet/config.yaml</Code> maps URL patterns to a strategy, plus options like required cookies, x-header filters, and TTLs.
          </P>
          <CodeBlock lang="bash">{`providers:
  openai:
    url: https://chat.openai.com
    strategy: cookie
    requiredCookies:
      - __Secure-next-auth.session-token
    xHeaders:
      - name: X-Origin
        header: origin`}</CodeBlock>

          <SectionHeading id="login" level={2}>Log in once</SectionHeading>
          <P>
            Signet launches Playwright (headless first, visible on fallback when a login page is detected). It watches network traffic, captures the credential, and seals it.
          </P>
          <CodeBlock lang="bash">{`$ sig login openai
→ chromium headless …
⚠ login page detected — opening window
✓ captured 6 cookies · 1 bearer · 2 x-headers
✓ sealed under ~/.signet/credentials/openai.json`}</CodeBlock>

          <SectionHeading id="use" level={2}>Use the credential</SectionHeading>
          <CodeBlock lang="bash">{`# JSON header map
$ sig get openai --json
{
  "Authorization": "Bearer sk-…",
  "Cookie": "__Secure-next-auth…=…",
  "X-Origin": "web"
}

# curl prefix
$ curl $(sig get openai --curl) https://api.openai.com/…

# full request
$ sig request https://api.openai.com/v1/models`}</CodeBlock>
        </>
      ),
      aside: (
        <>
          <P>
            The hybrid browser flow is the key insight — headless is fast and invisible, but real login pages need a visible window. Signet detects the difference automatically.
          </P>
          <P>
            <Code>sig doctor</Code> verifies Node, Playwright, config parsing, and that the credentials directory is writeable.
          </P>
        </>
      ),
    },

    /* ── Strategies ── */
    {
      content: (
        <>
          <SectionHeading id="strategies" level={1}>Strategies</SectionHeading>
          <P>
            A strategy implements <Code>IAuthStrategy</Code>: <Code>validate</Code>, <Code>authenticate</Code>, <Code>refresh</Code>, and <Code>applyToRequest</Code>. Four ship in the box.
          </P>

          <SectionHeading id="cookie" level={3}>cookie</SectionHeading>
          <P>
            Captures the cookie jar from a real browser session. Supports <Code>forceVisible</Code>, <Code>waitUntil</Code>, and <Code>requiredCookies</Code> for sites with multi-step login (QR codes, SSO).
          </P>

          <SectionHeading id="bearer" level={3}>bearer</SectionHeading>
          <P>
            Watches for <Code>Authorization: Bearer ...</Code> on outgoing requests, or decodes a JWT from an OAuth redirect. Auto-refreshes when a refresh token is present.
          </P>

          <SectionHeading id="api-key" level={3}>api-key</SectionHeading>
          <P>
            For tokens you paste in. <Code>sig login url --token xxx</Code> writes the credential directly. Ideal for CI where the key is already in an env var.
          </P>

          <SectionHeading id="basic" level={3}>basic</SectionHeading>
          <P>
            Username/password. Encoded to a Basic auth header at request time, never stored in plaintext outside the sealed credential file.
          </P>

          <CodeBlock lang="bash">{`# Adding a custom strategy:
export class OtpStrategyFactory implements IAuthStrategyFactory {
  readonly name = 'otp'
  create(config: StrategyConfig) {
    return new OtpStrategy(parseConfig(config))
  }
}`}</CodeBlock>
        </>
      ),
      aside: (
        <P>
          Strategies return <Code>{'Result<T, AuthError>'}</Code> — never throw for expected failures. Callers check <Code>isOk()</Code> / <Code>isErr()</Code> and dispatch on the typed error.
        </P>
      ),
    },

    /* ── Browser adapters ── */
    {
      content: (
        <>
          <SectionHeading id="browser-adapters" level={1}>Browser adapters</SectionHeading>
          <P>
            <Code>IBrowserAdapter</Code> is three small classes: <strong>Adapter → Session → Page</strong>. Playwright ships as the default. <Code>NullBrowserAdapter</Code> powers browserless mode on servers.
          </P>
          <P>
            Write your own to back Puppeteer, WebKit, or Electron. Lazy-import the browser library; throw <Code>BrowserLaunchError</Code> on import failure so <Code>sig doctor</Code> can report what's missing.
          </P>
          <CodeBlock lang="bash">{`export class PuppeteerAdapter implements IBrowserAdapter {
  readonly name = 'puppeteer'
  async launch(options) {
    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.launch(options)
    return new PuppeteerSession(browser)
  }
}`}</CodeBlock>
        </>
      ),
    },

    /* ── Sync ── */
    {
      content: (
        <>
          <SectionHeading id="sync" level={1}>Sync & remotes</SectionHeading>
          <P>
            Sync moves credential files between machines over SSH. Sign in on your laptop, push to servers. No daemon, no server to run — same locking as local storage.
          </P>
          <CodeBlock lang="bash">{`# on the server: enable browserless mode
$ sig init --remote

# on the laptop: add the server
$ sig remote add prod ssh://deploy@example.com

# push everything
$ sig sync push prod

# on the server: use immediately
$ sig request https://api.example.com/deploy`}</CodeBlock>
        </>
      ),
      aside: (
        <P>
          Sync uses existing SSH auth — you get your normal key management. Credentials are copied as-is; the transport never decodes them.
        </P>
      ),
    },

    /* ── AI agents ── */
    {
      content: (
        <>
          <SectionHeading id="agents" level={1}>AI agents</SectionHeading>
          <P>
            Signet exposes a stable CLI surface that agents shell out to. No SDK, no bespoke MCP — just commands with predictable exit codes and JSON output.
          </P>
          <CodeBlock lang="bash">{`// Claude Code / any agent
const headers = JSON.parse(
  await bash("sig get openai --json")
)
await fetch(url, { headers })

// or one-liner with curl
curl $(sig get openai --curl) \\
     https://api.openai.com/v1/models`}</CodeBlock>
          <P>
            The bundled <Code>/auth</Code> Claude Code skill shells out to <Code>sig</Code> under the hood. No MCP server needed.
          </P>
        </>
      ),
      aside: (
        <P>
          The CLI owns locking, TTL, and refresh logic. Shelling out means every caller benefits from those without re-implementing them.
        </P>
      ),
    },

    /* ── Commands ── */
    {
      content: (
        <>
          <SectionHeading id="commands" level={1}>Commands</SectionHeading>
          <CodeBlock lang="bash">{`sig init                   # set up config (interactive)
sig init --remote          # headless/remote machine
sig doctor                 # check environment and config
sig get <provider|url>     # get credential headers
sig login <url>            # authenticate (browser or token)
sig request <url>          # make authenticated HTTP request
sig status [provider]      # show auth status
sig logout [provider]      # clear credentials
sig providers              # list configured providers
sig remote add|remove|list # manage remote credential stores
sig sync push|pull [remote]# sync credentials with remote`}</CodeBlock>
        </>
      ),
    },

  ] as EditorialSection[],
}
