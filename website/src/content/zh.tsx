import { SectionHeading, P, Code, CodeBlock, type EditorialSection } from '../components/markdown';
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
        pageHref: '/zh',
    };
}

export const pageContent = {
    meta: {
        title: 'Signet — 登录一次，随处请求。',
        description:
            '通用身份认证 CLI，支持可插拔策略和浏览器适配器。从真实浏览器中捕获 cookie、令牌和 x-header，并同步到任何地方。',
    },

    toc: [
        tocItem('#overview', '概述'),
        tocItem('#install', '安装', { level: 1, parent: '#overview' }),
        tocItem('#quick-start', '快速开始', { level: 1, parent: '#overview' }),
        tocItem('#how-it-works', '工作原理'),
        tocItem('#configure', '配置提供者', { level: 1, parent: '#how-it-works' }),
        tocItem('#login', '登录一次', { level: 1, parent: '#how-it-works' }),
        tocItem('#use', '使用凭证', { level: 1, parent: '#how-it-works' }),
        tocItem('#strategies', '策略'),
        tocItem('#cookie', 'cookie', { level: 1, parent: '#strategies', prefix: '├ ' }),
        tocItem('#bearer', 'bearer', { level: 1, parent: '#strategies', prefix: '├ ' }),
        tocItem('#api-key', 'api-key', { level: 1, parent: '#strategies', prefix: '├ ' }),
        tocItem('#basic', 'basic', { level: 1, parent: '#strategies', prefix: '└ ' }),
        tocItem('#browser-adapters', '浏览器适配器'),
        tocItem('#sync', '同步与远程'),
        tocItem('#agents', 'AI 代理'),
        tocItem('#commands', '命令'),
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
                通用身份认证
                CLI，支持可插拔策略和浏览器适配器。在浏览器中登录一次，即可在任何地方使用凭证——你的
                AI 代理、你的脚本、你的服务器。
            </p>
        </div>
    ),

    sections: [
        /* ── 概述 ── */
        {
            content: (
                <>
                    <SectionHeading id="overview" level={1}>
                        概述
                    </SectionHeading>
                    <P>
                        Signet 是一个通用身份认证 CLI。你在 YAML
                        配置中描述提供者，使用真实浏览器登录一次，然后其他所有工具——
                        <Code>curl</Code>、你的 AI 代理、CI 任务——都可以向 Signet 索取即用的 HTTP
                        请求头。
                    </P>
                    <P>无需 SDK 封装，不受供应商锁定。一个 CLI，适用于任何你能登录的网站。</P>

                    <CodeBlock lang="diagram">{`┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  ANY AGENT      │     │   ~/.sig             │     │   YOUR BROWSER      │
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

                    <SectionHeading id="install" level={2}>
                        安装
                    </SectionHeading>
                    <CodeBlock lang="bash">{`npm install -g signet-cli

# 或者无需全局安装：
npx signet-cli sig --help`}</CodeBlock>

                    <SectionHeading id="quick-start" level={2}>
                        快速开始
                    </SectionHeading>
                    <CodeBlock lang="bash">{`# 1. 生成配置
sig init

# 2. 登录（打开真实浏览器）
sig login https://chat.openai.com

# 3. 获取任意 HTTP 客户端的请求头
sig get openai --json

# 4. 或让 signet 直接发送请求
sig request https://api.openai.com/v1/models`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    Signet 从实时浏览器网络流量中捕获 cookie、bearer 令牌、localStorage 值和
                    x-header。凭证密封存储在 <Code>~/.sig</Code>{' '}
                    下并使用目录锁——不会在你的代码仓库中留下任何内容。
                </P>
            ),
        },

        /* ── 工作原理 ── */
        {
            content: (
                <>
                    <SectionHeading id="how-it-works" level={1}>
                        工作原理
                    </SectionHeading>
                    <P>
                        三个步骤：配置、登录、请求。认证流程只需执行一次，后续所有调用都从密封存储中读取。
                    </P>
                    <SectionHeading id="configure" level={2}>
                        配置提供者
                    </SectionHeading>
                    <P>
                        <Code>~/.sig/config.yaml</Code> 中的每个提供者条目将 URL
                        模式映射到一个策略，并附带必需 cookie、x-header 过滤器和 TTL 等选项。
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

                    <SectionHeading id="login" level={2}>
                        登录一次
                    </SectionHeading>
                    <P>
                        Signet 启动
                        Playwright（优先无头模式，检测到登录页面时回退为可视窗口）。它监控网络流量，捕获凭证并密封存储。
                    </P>
                    <CodeBlock lang="bash">{`$ sig login openai
→ chromium 无头模式 …
⚠ 检测到登录页面 — 打开窗口
✓ 捕获 6 个 cookie · 1 个 bearer · 2 个 x-header
✓ 密封存储至 ~/.sig/credentials/openai.json`}</CodeBlock>

                    <SectionHeading id="use" level={2}>
                        使用凭证
                    </SectionHeading>
                    <CodeBlock lang="bash">{`# JSON 请求头映射
$ sig get openai --json
{
  "Authorization": "Bearer sk-…",
  "Cookie": "__Secure-next-auth…=…",
  "X-Origin": "web"
}

# curl 前缀
$ curl $(sig get openai --curl) https://api.openai.com/…

# 完整请求
$ sig request https://api.openai.com/v1/models`}</CodeBlock>
                </>
            ),
            aside: (
                <>
                    <P>
                        混合浏览器流程是核心洞察——无头模式快速且不可见，但真实的登录页面需要可视窗口。Signet
                        会自动检测差异。
                    </P>
                    <P>
                        <Code>sig doctor</Code> 验证
                        Node、Playwright、配置解析以及凭证目录是否可写。
                    </P>
                </>
            ),
        },

        /* ── 策略 ── */
        {
            content: (
                <>
                    <SectionHeading id="strategies" level={1}>
                        策略
                    </SectionHeading>
                    <P>
                        策略实现 <Code>IAuthStrategy</Code> 接口：<Code>validate</Code>、
                        <Code>authenticate</Code>、<Code>refresh</Code> 和{' '}
                        <Code>applyToRequest</Code>。内置四种策略。
                    </P>

                    <SectionHeading id="cookie" level={3}>
                        cookie
                    </SectionHeading>
                    <P>
                        从真实浏览器会话中捕获 cookie。支持 <Code>forceVisible</Code>、
                        <Code>waitUntil</Code> 和 <Code>requiredCookies</Code>
                        ，适用于多步骤登录场景（二维码、SSO）。
                    </P>

                    <SectionHeading id="bearer" level={3}>
                        bearer
                    </SectionHeading>
                    <P>
                        监视出站请求中的 <Code>Authorization: Bearer ...</Code>，或从 OAuth
                        重定向中解码 JWT。存在刷新令牌时自动刷新。
                    </P>

                    <SectionHeading id="api-key" level={3}>
                        api-key
                    </SectionHeading>
                    <P>
                        用于手动粘贴令牌。<Code>sig login url --token xxx</Code>{' '}
                        直接写入凭证。适合密钥已在环境变量中的 CI 场景。
                    </P>

                    <SectionHeading id="basic" level={3}>
                        basic
                    </SectionHeading>
                    <P>
                        用户名/密码。在请求时编码为 Basic
                        认证头，明文永远不会存储在密封凭证文件之外。
                    </P>

                    <CodeBlock lang="bash">{`# 添加自定义策略：
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
                    策略返回 <Code>{'Result<T, AuthError>'}</Code>
                    ——对于预期失败从不抛出异常。调用方通过 <Code>isOk()</Code> /{' '}
                    <Code>isErr()</Code> 检查并根据类型化错误进行分发。
                </P>
            ),
        },

        /* ── 浏览器适配器 ── */
        {
            content: (
                <>
                    <SectionHeading id="browser-adapters" level={1}>
                        浏览器适配器
                    </SectionHeading>
                    <P>
                        <Code>IBrowserAdapter</Code> 由三个小类组成：
                        <strong>Adapter → Session → Page</strong>。Playwright 为默认实现。
                        <Code>NullBrowserAdapter</Code> 为服务器上的无浏览器模式提供支持。
                    </P>
                    <P>
                        你可以自行编写适配器来支持 Puppeteer、WebKit 或
                        Electron。延迟导入浏览器库；在导入失败时抛出 <Code>BrowserLaunchError</Code>
                        ，以便 <Code>sig doctor</Code> 报告缺少的依赖。
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

        /* ── 同步 ── */
        {
            content: (
                <>
                    <SectionHeading id="sync" level={1}>
                        同步与远程
                    </SectionHeading>
                    <P>
                        同步通过 SSH
                        在机器之间传输凭证文件。在你的笔记本上登录，推送到服务器。无需守护进程，无需运行服务器——与本地存储相同的锁机制。
                    </P>
                    <CodeBlock lang="bash">{`# 在服务器上：启用无浏览器模式
$ sig init --remote

# 在笔记本上：添加服务器
$ sig remote add prod ssh://deploy@example.com

# 推送所有凭证
$ sig sync push prod

# 在服务器上：立即使用
$ sig request https://api.example.com/deploy`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    同步使用现有的 SSH
                    认证——你可以继续使用常规的密钥管理。凭证按原样复制，传输过程从不解码。
                </P>
            ),
        },

        /* ── AI 代理 ── */
        {
            content: (
                <>
                    <SectionHeading id="agents" level={1}>
                        AI 代理
                    </SectionHeading>
                    <P>
                        Signet 提供稳定的 CLI 接口供代理调用。无需 SDK，无需定制
                        MCP——只需具有可预测退出码和 JSON 输出的命令。
                    </P>
                    <CodeBlock lang="bash">{`// Claude Code / 任意代理
const headers = JSON.parse(
  await bash("sig get openai --json")
)
await fetch(url, { headers })

// 或使用 curl 一行搞定
curl $(sig get openai --curl) \\
     https://api.openai.com/v1/models`}</CodeBlock>
                    <P>
                        内置的 <Code>/auth</Code> Claude Code 技能在底层调用 <Code>sig</Code>。无需
                        MCP 服务器。
                    </P>
                </>
            ),
            aside: (
                <P>
                    CLI 负责锁定、TTL
                    和刷新逻辑。通过命令行调用意味着每个调用方都能受益于这些功能，无需重新实现。
                </P>
            ),
        },

        /* ── 命令 ── */
        {
            content: (
                <>
                    <SectionHeading id="commands" level={1}>
                        命令
                    </SectionHeading>
                    <CodeBlock lang="bash">{`sig init                   # 设置配置（交互式）
sig init --remote          # 无头/远程机器
sig doctor                 # 检查环境和配置
sig get <provider|url>     # 获取凭证请求头
sig login <url>            # 认证（浏览器或令牌）
sig request <url>          # 发送认证 HTTP 请求
sig status [provider]      # 显示认证状态
sig logout [provider]      # 清除凭证
sig providers              # 列出已配置的提供者
sig remote add|remove|list # 管理远程凭证存储
sig sync push|pull [remote]# 与远程同步凭证`}</CodeBlock>
                </>
            ),
        },
    ] as EditorialSection[],
};
