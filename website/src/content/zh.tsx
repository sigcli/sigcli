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
        pageHref: '/zh',
    };
}

export const pageContent = {
    meta: {
        title: 'Sigcli — 登录一次，随处请求。',
        description:
            '通用身份认证 CLI，支持可插拔策略和浏览器适配器。从真实浏览器中捕获 cookie、令牌和 x-header，并同步到任何地方。',
    },

    toc: [
        tocItem('#overview', '概述'),
        tocItem('#install', '安装', { level: 1, parent: '#overview' }),
        tocItem('#quick-start', '快速开始', { level: 1, parent: '#overview' }),
        tocItem('#how-it-works', '工作原理'),
        tocItem('#features', '功能特性'),
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
                        Sigcli 是你的个人凭证印章。你在 YAML
                        配置中描述提供者，使用真实浏览器登录一次， 然后其他所有工具——
                        <Code>curl</Code>、你的 AI 代理、CI 任务——都能将凭证直接注入进程环境。
                    </P>
                    <P>无需 SDK 封装，不受供应商锁定。一个 CLI，适用于任何你能登录的网站。</P>

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
                        安装
                    </SectionHeading>
                    <CodeBlock lang="bash">{`npm install -g @sigcli/cli

# 或者无需全局安装：
npx @sigcli/cli sig --help`}</CodeBlock>

                    <SectionHeading id="quick-start" level={2}>
                        快速开始
                    </SectionHeading>
                    <CodeBlock lang="bash">{`# 1. 生成配置
sig init

# 2. 登录——自动打开真实浏览器，捕获凭证
sig login https://jira.example.com

# 3. 将凭证作为 SIG_<PROVIDER>_* 环境变量注入任意命令
sig run my-jira -- curl https://jira.example.com/api/me

# 探索可用的变量
sig run my-jira -- env | grep SIG_MY_JIRA_`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    凭证从实时浏览器网络流量中捕获，并使用目录锁密封存储在 <Code>~/.sig</Code>{' '}
                    下——不会出现在你的代码仓库或 shell 历史记录中。
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
                        三个步骤：配置、登录、运行。认证流程只执行一次，后续所有调用都从密封存储中读取。
                    </P>
                    <CodeBlock lang="bash">{`# 1. 在 ~/.sig/config.yaml 中描述提供者
providers:
  my-jira:
    url: https://jira.example.com
    strategy: cookie
    requiredCookies: [SESSION]

# 2. 一次认证——优先无头模式，检测到登录页面时切换为可视模式
$ sig login https://jira.example.com
→ chromium 无头模式 …
⚠ 检测到登录页面 — 打开窗口
✓ 捕获 4 个 cookie · 2 个 x-header
✓ 密封存储至 ~/.sig/credentials/my-jira.json

# 3. 通过 sig run 使用凭证——不会泄露到 shell
$ sig run my-jira -- python fetch_issues.py
$ sig run my-jira -- node export_board.js`}</CodeBlock>
                </>
            ),
            aside: (
                <>
                    <P>
                        混合浏览器流程是核心洞察——无头模式快速且不可见，但真实的登录页面需要可视窗口。Sigcli
                        会自动检测差异。
                    </P>
                    <P>
                        <Code>sig doctor</Code> 验证
                        Node、Playwright、配置解析以及凭证目录是否可写。
                    </P>
                </>
            ),
        },

        /* ── 功能特性 ── */
        {
            content: (
                <>
                    <SectionHeading id="features" level={1}>
                        功能特性
                    </SectionHeading>
                    <List>
                        <Li>
                            <strong>MITM 代理</strong> — <Code>sig proxy start</Code> 在本地{' '}
                            <Code>127.0.0.1</Code> 启动 HTTPS 代理。代理设置 <Code>HTTP_PROXY</Code>
                            /<Code>HTTPS_PROXY</Code>，凭证透明注入——
                            代理工具永远不会看到令牌。适用于无法用 <Code>sig run</Code>{' '}
                            包裹的长期守护进程或工具。
                        </Li>
                        <Li>
                            <strong>sig run</strong> — 将 <Code>SIG_&lt;PROVIDER&gt;_*</Code>{' '}
                            凭证直接注入任意子进程，输出中的凭证值自动脱敏。这是使用凭证的推荐方式。
                        </Li>
                        <Li>
                            <strong>4 种策略</strong> — <Code>cookie</Code>（浏览器 SSO）、
                            <Code>oauth2</Code>（Bearer/JWT）、<Code>api-token</Code>（静态密钥）、
                            <Code>basic</Code>（用户名/密码）。自动检测或用 <Code>--strategy</Code>{' '}
                            强制指定。
                        </Li>
                        <Li>
                            <strong>浏览器适配器</strong> — Playwright（默认）或 Chrome
                            CDP。无头模式附带自动可视回退，支持自定义适配器插件。
                        </Li>
                        <Li>
                            <strong>SSH 同步</strong> — 在笔记本上登录，通过{' '}
                            <Code>sig sync push</Code> 推送到 CI 或远程服务器。无需守护进程。
                        </Li>
                        <Li>
                            <strong>AI 代理就绪</strong> — 具有可预测退出码和 JSON 输出的稳定 CLI
                            接口，无需 MCP 服务器。
                        </Li>
                        <Li>
                            <strong>TypeScript & Python SDK</strong> — CLI
                            的轻量级封装，供程序化使用。
                        </Li>
                    </List>
                    <P>
                        <A href="/zh/docs/">完整文档 →</A>
                    </P>
                </>
            ),
            aside: (
                <P>
                    <Code>sig run my-jira -- env | grep SIG_MY_JIRA_</Code>{' '}
                    是探索某个提供者可用环境变量的最快方式。
                </P>
            ),
        },
    ] as EditorialSection[],
};
