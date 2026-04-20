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
        title: 'sig — 连接你的系统，让 AI 替你工作。',
        description:
            'AI 代理的认证层。通过浏览器 SSO 登录一次，让 AI 代理代你访问 Jira、Wiki、日历和内部 API——无需暴露凭证。',
    },

    toc: [
        tocItem('#overview', '概述'),
        tocItem('#pain', '痛点', { level: 1, parent: '#overview' }),
        tocItem('#solution', '解决方案', { level: 1, parent: '#overview' }),
        tocItem('#quick-start', '快速开始'),
        tocItem('#how-it-works', '工作原理'),
        tocItem('#features', '功能特性'),
        tocItem('#security', '安全模型'),
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
                AI 代理的认证层。在浏览器中登录一次——剩下的交给 AI。
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

                    <SectionHeading id="pain" level={2}>
                        痛点
                    </SectionHeading>
                    <P>
                        AI 编程代理（Claude Code、Cursor、Copilot）越来越需要调用你的工作 API——查
                        Jira、读 Wiki、查日历、访问内部接口。但凭证管理是个难题：密钥会泄露到 shell
                        历史、<Code>ps</Code> 输出和代理的上下文窗口。你不可能把 SSO 密码直接交给
                        AI，也没法在每个脚本里手动粘贴 cookie。
                    </P>

                    <SectionHeading id="solution" level={2}>
                        解决方案
                    </SectionHeading>
                    <P>
                        sig 位于你的浏览器和 AI 代理之间。你通过真实浏览器完成一次 SSO 认证，sig
                        捕获 cookie、令牌和请求头，加密存储——然后注入到 AI
                        代理运行的任何进程中。代理顺利完成任务，但永远看不到你的秘密。
                    </P>
                    <div style={{ margin: '24px 0' }}>
                        <img
                            src="/demo.gif"
                            alt="sig 演示 — 登录、状态、请求、运行、代理"
                            style={{
                                width: '100%',
                                maxWidth: '720px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-primary)',
                            }}
                        />
                    </div>

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
                </>
            ),
            aside: (
                <P>
                    sig 的定位是：<strong>连接你的系统，让 AI 替你工作。</strong>
                    你登录一次，sig 处理认证，你的 AI 代理完成工作。
                </P>
            ),
        },

        /* ── 快速开始 ── */
        {
            content: (
                <>
                    <SectionHeading id="quick-start" level={1}>
                        快速开始
                    </SectionHeading>
                    <CodeBlock lang="bash">{`# 安装
npm install -g @sigcli/cli

# 1. 初始化配置
sig init

# 2. 登录——自动打开浏览器，捕获凭证
sig login https://jira.example.com

# 3. 发起认证请求——凭证始终在进程内部，不会泄露
sig request https://jira.example.com/rest/api/2/myself

# 或启动 MITM 代理——代理自动注入凭证，AI 代理无需接触秘密
sig proxy start`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    凭证从实时浏览器网络流量中捕获，使用 AES-256-GCM 加密后存储在{' '}
                    <Code>~/.sig</Code> 下——不会出现在代码仓库或 shell 历史记录中。
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
                    <P>三步搞定：配置提供者、认证一次、让 AI 代理替你工作。</P>
                    <CodeBlock lang="bash">{`# 步骤一：在 ~/.sig/config.yaml 中配置提供者
providers:
  my-jira:
    url: https://jira.example.com
    strategy: cookie
    requiredCookies: [SESSION]
  grafana:
    url: https://grafana.example.com
    strategy: bearer
  my-api:
    url: https://api.example.com
    strategy: api-token

# 步骤二：认证一次（浏览器 SSO，无头→可视自动切换）
$ sig login https://jira.example.com
→ chromium 无头模式启动 …
⚠ 检测到登录页面 — 切换为可视模式
✓ 捕获 4 个 cookie · 2 个 x-header
✓ 加密存储至 ~/.sig/credentials/my-jira.json

# 步骤三：AI 代理替你工作
$ sig run my-jira -- claude "把所有 P1 Bug 整理成摘要发给我"
$ sig run grafana -- python analyze_metrics.py
$ sig run my-api -- node sync_data.js`}</CodeBlock>
                </>
            ),
            aside: (
                <>
                    <P>
                        混合浏览器流程是核心能力——无头模式快速且静默，但遇到真实登录页面时自动弹出可视窗口。sig
                        会自动识别并切换，无需手动干预。
                    </P>
                    <P>
                        <Code>sig doctor</Code> 可以验证
                        Node、Playwright、配置解析及凭证目录是否就绪。
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
                            <Code>127.0.0.1</Code> 启动 HTTPS 代理，零信任凭证注入。设置{' '}
                            <Code>HTTP_PROXY</Code>/<Code>HTTPS_PROXY</Code>{' '}
                            后，凭证透明注入到所有出站请求——代理工具永远看不到令牌。适合无法用{' '}
                            <Code>sig run</Code> 包裹的长期守护进程。
                        </Li>
                        <Li>
                            <strong>sig run</strong> — 将 <Code>SIG_&lt;PROVIDER&gt;_*</Code>{' '}
                            凭证直接注入任意子进程环境，输出中的凭证值自动脱敏。这是推荐的使用方式，让
                            AI 代理既能完成任务又无法窃取秘密。
                        </Li>
                        <Li>
                            <strong>4 种认证策略</strong> — <Code>cookie</Code>（浏览器 SSO）、
                            <Code>oauth2</Code>（Bearer/JWT）、<Code>api-token</Code>（静态密钥）、
                            <Code>basic</Code>（用户名/密码）。自动检测或通过{' '}
                            <Code>--strategy</Code> 手动指定。
                        </Li>
                        <Li>
                            <strong>加密存储</strong> — 所有凭证使用 AES-256-GCM
                            加密存储，密钥存放于 <Code>~/.sig/encryption.key</Code>
                            （权限 0o400）。每次访问生成审计记录，历史未加密文件自动迁移。
                        </Li>
                        <Li>
                            <strong>SSH 同步</strong> — 在笔记本上完成登录，通过{' '}
                            <Code>sig sync push</Code> 推送到 CI
                            服务器或远程机器。无需守护进程，一条命令搞定。
                        </Li>
                        <Li>
                            <strong>TypeScript & Python SDK</strong> — CLI
                            的轻量级封装，供程序化集成使用。
                        </Li>
                    </List>
                </>
            ),
            aside: (
                <P>
                    <Code>sig run my-jira -- env | grep SIG_MY_JIRA_</Code>{' '}
                    是查看某个提供者注入了哪些环境变量的最快方式。
                </P>
            ),
        },

        /* ── 安全模型 ── */
        {
            content: (
                <>
                    <SectionHeading id="security" level={1}>
                        安全模型
                    </SectionHeading>
                    <P>sig 采用四层安全设计，确保凭证在整个生命周期内不暴露给 AI 代理。</P>
                    <table
                        style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '14px',
                            lineHeight: 1.6,
                        }}
                    >
                        <thead>
                            <tr
                                style={{
                                    borderBottom: '2px solid var(--border-color, #e5e7eb)',
                                    textAlign: 'left',
                                }}
                            >
                                <th style={{ padding: '8px 12px 8px 0', fontWeight: 600 }}>层级</th>
                                <th style={{ padding: '8px 12px', fontWeight: 600 }}>机制</th>
                                <th style={{ padding: '8px 0 8px 12px', fontWeight: 600 }}>效果</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                                <td style={{ padding: '8px 12px 8px 0', verticalAlign: 'top' }}>
                                    <strong>加密存储</strong>
                                </td>
                                <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                                    AES-256-GCM，密钥存于 <Code>~/.sig/encryption.key</Code>
                                </td>
                                <td style={{ padding: '8px 0 8px 12px', verticalAlign: 'top' }}>
                                    凭证文件即使被读取也无法解密
                                </td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                                <td style={{ padding: '8px 12px 8px 0', verticalAlign: 'top' }}>
                                    <strong>进程隔离</strong>
                                </td>
                                <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                                    <Code>sig run</Code> 通过环境变量注入，子进程退出后自动清理
                                </td>
                                <td style={{ padding: '8px 0 8px 12px', verticalAlign: 'top' }}>
                                    凭证不出现在 shell 历史或 <Code>ps</Code> 输出中
                                </td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                                <td style={{ padding: '8px 12px 8px 0', verticalAlign: 'top' }}>
                                    <strong>输出脱敏</strong>
                                </td>
                                <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                                    stdout/stderr 中的凭证值自动替换为 <Code>[REDACTED]</Code>
                                </td>
                                <td style={{ padding: '8px 0 8px 12px', verticalAlign: 'top' }}>
                                    AI 代理的上下文窗口中不会出现真实令牌
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 12px 8px 0', verticalAlign: 'top' }}>
                                    <strong>零信任代理</strong>
                                </td>
                                <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                                    MITM 代理在网络层注入，应用层不感知
                                </td>
                                <td style={{ padding: '8px 0 8px 12px', verticalAlign: 'top' }}>
                                    AI 工具无需读取凭证即可完成认证请求
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </>
            ),
            aside: (
                <P>
                    凭证从不出现在 AI 代理的上下文窗口中。sig
                    在网络层或进程环境层完成注入，代理只看到请求结果，看不到秘密本身。
                </P>
            ),
        },
    ] as EditorialSection[],
};
