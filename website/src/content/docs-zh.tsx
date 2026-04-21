import {
    SectionHeading,
    P,
    Code,
    CodeBlock,
    List,
    Li,
    A,
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
        pageHref: '/zh/docs/',
    };
}

export const pageContent = {
    meta: {
        title: 'Sigcli 文档 — 完整参考',
        description:
            'Sigcli 完整文档：快速上手、命令参考、环境变量、配置、认证策略、浏览器适配器、SDK、AI 代理集成与远程同步。',
    },

    toc: [
        tocItem('#getting-started', '快速上手'),
        tocItem('#install', '安装', { level: 1, parent: '#getting-started', prefix: '├ ' }),
        tocItem('#first-login', '首次登录', { level: 1, parent: '#getting-started', prefix: '├ ' }),
        tocItem('#first-run', '首次 sig run', {
            level: 1,
            parent: '#getting-started',
            prefix: '├ ',
        }),
        tocItem('#onboard-proxy', '试试: sig proxy', {
            level: 1,
            parent: '#getting-started',
            prefix: '├ ',
        }),
        tocItem('#onboard-request', '试试: sig request', {
            level: 1,
            parent: '#getting-started',
            prefix: '├ ',
        }),
        tocItem('#onboard-choosing', '选择方法', {
            level: 1,
            parent: '#getting-started',
            prefix: '└ ',
        }),
        tocItem('#security', '安全模型'),
        tocItem('#security-hierarchy', '凭证访问方式', {
            level: 1,
            parent: '#security',
            prefix: '├ ',
        }),
        tocItem('#security-proxy', 'sig proxy', {
            level: 2,
            parent: '#security',
            prefix: '│  ├ ',
        }),
        tocItem('#security-request', 'sig request', {
            level: 2,
            parent: '#security',
            prefix: '│  ├ ',
        }),
        tocItem('#security-run', 'sig run', {
            level: 2,
            parent: '#security',
            prefix: '│  ├ ',
        }),
        tocItem('#security-get', 'sig get', {
            level: 2,
            parent: '#security',
            prefix: '│  └ ',
        }),
        tocItem('#security-shared', '共享安全特性', {
            level: 1,
            parent: '#security',
            prefix: '└ ',
        }),
        tocItem('#commands', '命令参考'),
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
        tocItem('#env-vars', '环境变量'),
        tocItem('#configuration', '配置'),
        tocItem('#config-file', 'config.yaml', {
            level: 1,
            parent: '#configuration',
            prefix: '├ ',
        }),
        tocItem('#config-providers', '提供者选项', {
            level: 1,
            parent: '#configuration',
            prefix: '└ ',
        }),
        tocItem('#strategies', '认证策略'),
        tocItem('#strat-cookie', 'cookie', { level: 1, parent: '#strategies', prefix: '├ ' }),
        tocItem('#strat-oauth2', 'oauth2', { level: 1, parent: '#strategies', prefix: '├ ' }),
        tocItem('#strat-api-token', 'api-token', { level: 1, parent: '#strategies', prefix: '├ ' }),
        tocItem('#strat-basic', 'basic', { level: 1, parent: '#strategies', prefix: '└ ' }),
        tocItem('#browser-adapters', '浏览器适配器'),
        tocItem('#sdk', 'SDK'),
        tocItem('#sdk-ts', 'TypeScript SDK', { level: 1, parent: '#sdk', prefix: '├ ' }),
        tocItem('#sdk-python', 'Python SDK', { level: 1, parent: '#sdk', prefix: '└ ' }),
        tocItem('#ai-agents', 'AI 代理集成'),
        tocItem('#skills', '技能'),
        tocItem('#skills-catalog', '可用技能', { level: 1, parent: '#skills', prefix: '├ ' }),
        tocItem('#skills-build', '创建技能', { level: 1, parent: '#skills', prefix: '└ ' }),
        tocItem('#remote-ssh', '远程与 SSH'),
        tocItem('#error-codes', '错误代码'),
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
                Sigcli 完整参考文档——代表你签署请求的认证 CLI。登录一次，凭证随处可用。
            </p>
        </div>
    ),

    sections: [
        /* ── 快速上手 ── */
        {
            content: (
                <>
                    <SectionHeading id="getting-started" level={1}>
                        快速上手
                    </SectionHeading>
                    <P>
                        Sigcli（<Code>sig</Code>）是你的个人凭证印章。它处理浏览器 SSO、存储令牌，
                        并将凭证注入任何命令——让你只需登录一次，所有工具即可正常运行。
                    </P>

                    <SectionHeading id="install" level={2}>
                        安装
                    </SectionHeading>
                    <CodeBlock lang="bash">{`npm install -g @sigcli/cli

# 或者无需全局安装：
npx @sigcli/cli sig --help`}</CodeBlock>

                    <SectionHeading id="first-login" level={2}>
                        首次登录
                    </SectionHeading>
                    <P>
                        运行 <Code>sig init</Code> 创建 <Code>~/.sig/config.yaml</Code>，然后登录
                        然后登录你的服务。以下示例使用浏览器 SSO 进行认证。
                    </P>
                    <CodeBlock lang="bash">{`# 1. 创建配置（交互式）
sig init

# 2. 登录——自动打开真实浏览器，捕获 cookie
sig login https://jira.example.com

# 3. 确认登录成功
sig status my-jira`}</CodeBlock>

                    <SectionHeading id="first-run" level={2}>
                        首次 sig run
                    </SectionHeading>
                    <P>
                        <Code>sig run</Code> 是使用凭证的推荐方式。它将{' '}
                        <Code>SIG_&lt;PROVIDER&gt;_*</Code> 环境变量直接注入子进程——不会泄露到 shell
                        历史记录或进程列表中。
                    </P>
                    <CodeBlock lang="bash">{`# 探索可用的变量
sig run my-jira -- env | grep SIG_

# 注入凭证并运行任意命令
sig run my-jira -- curl https://jira.example.com/api/me

# 运行 Python 脚本
sig run my-jira -- python fetch_issues.py`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    凭证以密封 JSON 文件的形式存储在 <Code>~/.sig/credentials/</Code>{' '}
                    中。默认情况下，不会有任何内容进入你的代码仓库、shell 历史记录或环境变量。
                </P>
            ),
        },

        /* ── 快速上手（续）── */
        {
            content: (
                <>
                    <SectionHeading id="onboard-proxy" level={2}>
                        试试: sig proxy
                    </SectionHeading>
                    <P>
                        代理是<strong>最安全</strong>的凭证使用方式。它在本地运行一个 MITM
                        守护进程，拦截 HTTPS 流量并透明注入凭证——你的工具永远不会看到令牌。
                    </P>
                    <CodeBlock lang="bash">{`# 启动代理守护进程
sig proxy start

# 信任 CA 证书（首次使用时）
sig proxy trust    # 打印 CA 证书路径——添加到系统信任存储

# 设置代理环境变量
export HTTP_PROXY=http://127.0.0.1:7891
export HTTPS_PROXY=http://127.0.0.1:7891

# 任何 HTTP 客户端都会自动获得凭证注入
curl https://jira.example.com/rest/api/2/myself

# 完成后
sig proxy stop`}</CodeBlock>

                    <SectionHeading id="onboard-request" level={2}>
                        试试: sig request
                    </SectionHeading>
                    <P>
                        对于一次性 API 调用，<Code>sig request</Code> 直接发起认证的 HTTP
                        请求。凭证保持在 CLI 进程内部，不会暴露到子进程或 shell 历史记录中。
                    </P>
                    <CodeBlock lang="bash">{`# 简单 GET 请求
sig request https://jira.example.com/rest/api/2/myself

# POST 请求
sig request https://api.example.com/data --method POST --body '{"key": "value"}'

# 只获取响应体
sig request https://api.example.com/me --format body`}</CodeBlock>

                    <SectionHeading id="onboard-choosing" level={2}>
                        选择方法
                    </SectionHeading>
                    <P>根据你的使用场景选择合适的方法。如有疑问，优先选择更安全的方式。</P>
                    <div
                        style={{
                            width: '100%',
                            overflowX: 'auto',
                            padding: '8px 0',
                        }}
                    >
                        <table
                            style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontFamily: 'var(--font-primary)',
                                fontSize: 'var(--type-table-size)',
                            }}
                        >
                            <thead>
                                <tr>
                                    <th
                                        style={{
                                            textAlign: 'left',
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                        }}
                                    >
                                        使用场景
                                    </th>
                                    <th
                                        style={{
                                            textAlign: 'left',
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                        }}
                                    >
                                        推荐方法
                                    </th>
                                    <th
                                        style={{
                                            textAlign: 'left',
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                        }}
                                    >
                                        原因
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        长期运行的守护进程或 AI 代理
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                            fontFamily: 'var(--font-code)',
                                        }}
                                    >
                                        sig proxy
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        凭证永远不会离开代理进程
                                    </td>
                                </tr>
                                <tr>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        一次性 API 调用或脚本
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                            fontFamily: 'var(--font-code)',
                                        }}
                                    >
                                        sig request
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        凭证仅在进程内，不涉及磁盘或环境变量
                                    </td>
                                </tr>
                                <tr>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        包装需要读取环境变量的工具
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                            fontFamily: 'var(--font-code)',
                                        }}
                                    >
                                        sig run
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        注入 SIG_* 环境变量，自动脱敏输出
                                    </td>
                                </tr>
                                <tr>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        调试凭证值
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            color: 'var(--text-secondary)',
                                            fontFamily: 'var(--font-code)',
                                        }}
                                    >
                                        sig get
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        输出到标准输出——谨慎使用
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </>
            ),
        },

        /* ── 安全模型 ── */
        {
            content: (
                <>
                    <SectionHeading id="security" level={1}>
                        安全模型
                    </SectionHeading>
                    <P>
                        Sigcli 提供四种凭证访问方式，每种在安全性和便捷性之间有不同的权衡。
                        按安全级别从高到低排列：
                    </P>

                    <SectionHeading id="security-hierarchy" level={2}>
                        凭证访问方式
                    </SectionHeading>
                    <div
                        style={{
                            width: '100%',
                            overflowX: 'auto',
                            padding: '8px 0',
                        }}
                    >
                        <table
                            style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontFamily: 'var(--font-primary)',
                                fontSize: 'var(--type-table-size)',
                            }}
                        >
                            <thead>
                                <tr>
                                    <th
                                        style={{
                                            textAlign: 'left',
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                        }}
                                    >
                                        方法
                                    </th>
                                    <th
                                        style={{
                                            textAlign: 'left',
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                        }}
                                    >
                                        凭证暴露
                                    </th>
                                    <th
                                        style={{
                                            textAlign: 'left',
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                        }}
                                    >
                                        内存生命周期
                                    </th>
                                    <th
                                        style={{
                                            textAlign: 'left',
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                        }}
                                    >
                                        可见于
                                    </th>
                                    <th
                                        style={{
                                            textAlign: 'left',
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                        }}
                                    >
                                        安全级别
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            fontFamily: 'var(--font-code)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        sig proxy
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        永远不会离开代理进程
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        代理守护进程生命周期
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        无外部可见
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        ●●●●● 最高
                                    </td>
                                </tr>
                                <tr>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            fontFamily: 'var(--font-code)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        sig request
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        仅在进程内存中
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        每次请求约 100ms
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        无外部可见
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        ●●●●○ 高
                                    </td>
                                </tr>
                                <tr>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            fontFamily: 'var(--font-code)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        sig run
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        子进程环境变量
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        子进程生命周期
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        /proc/PID/environ、子进程
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--page-border)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        ●●●○○ 中等
                                    </td>
                                </tr>
                                <tr>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            fontFamily: 'var(--font-code)',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        sig get
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        输出到标准输出
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        N/A（被 shell 捕获）
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        终端、shell 历史、管道
                                    </td>
                                    <td
                                        style={{
                                            padding: '8px 12px',
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        ●●○○○ 低
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <SectionHeading id="security-proxy" level={3}>
                        sig proxy — 凭证永远不会离开进程
                    </SectionHeading>
                    <P>
                        MITM 代理守护进程运行在本地（127.0.0.1）。客户端应用设置 HTTP_PROXY
                        并正常发起请求。代理拦截 HTTPS 连接，将凭证作为 HTTP
                        头注入，然后转发到上游服务器。
                    </P>
                    <P>
                        凭证从存储中解密后仅保存在代理进程的内存中。客户端应用、子进程和环境变量都不会包含令牌。TLS
                        拦截使用为每个主机名生成的 ECDSA P-256 证书。
                    </P>
                    <CodeBlock lang="bash">{`sig proxy start
export HTTP_PROXY=http://127.0.0.1:7891 HTTPS_PROXY=http://127.0.0.1:7891`}</CodeBlock>
                    <P>
                        <strong>适用场景：</strong>AI 代理、CI/CD
                        流水线、长期运行的守护进程、任何支持 HTTP_PROXY 的工具。
                    </P>

                    <SectionHeading id="security-request" level={3}>
                        sig request — 凭证保持在内部
                    </SectionHeading>
                    <P>
                        <Code>sig request</Code> 将凭证加载到进程内存中，发起一次 HTTP
                        请求，然后丢弃。凭证永远不会写入环境变量、文件或标准输出。
                        暴露窗口约为每次请求 100ms。
                    </P>
                    <CodeBlock lang="bash">{`sig request https://api.example.com/me --format body`}</CodeBlock>
                    <P>
                        <strong>适用场景：</strong>一次性 API 调用、shell 脚本、需要单个 HTTP
                        响应的流水线步骤。
                    </P>

                    <SectionHeading id="security-run" level={3}>
                        sig run — 凭证在环境变量中
                    </SectionHeading>
                    <P>
                        <Code>sig run</Code> 将 <Code>SIG_&lt;PROVIDER&gt;_*</Code>{' '}
                        环境变量注入子进程。这对于从环境变量读取配置的工具很方便，但在 Linux
                        上环境变量可以通过 <Code>/proc</Code>{' '}
                        读取，并且会被所有子进程继承。子进程的输出会自动脱敏（凭证值替换为{' '}
                        <Code>****</Code>），但脱敏是尽力而为的。
                    </P>
                    <CodeBlock lang="bash">{`sig run my-jira -- curl https://jira.example.com/api/me`}</CodeBlock>
                    <P>
                        <strong>适用场景：</strong>包装读取 SIG_*
                        环境变量的工具、本地开发、快速脚本编写。
                    </P>

                    <SectionHeading id="security-get" level={3}>
                        sig get — 凭证输出到标准输出
                    </SectionHeading>
                    <P>
                        <Code>sig get</Code> 将凭证头输出到标准输出。默认情况下值会被脱敏（
                        <Code>****</Code>），但 <Code>--no-redaction</Code>{' '}
                        会显示原始令牌。原始值在终端回滚、shell 历史记录（
                        <Code>~/.bash_history</Code>、<Code>~/.zsh_history</Code>
                        ）和管道命令中可见。
                    </P>
                    <CodeBlock lang="bash">{`# 默认脱敏
sig get my-jira
# 原始值（谨慎使用）
sig get my-jira --no-redaction`}</CodeBlock>
                    <P>
                        <strong>适用场景：</strong>调试凭证格式、手动 API 测试。切勿将原始输出传入
                        AI 代理上下文或日志。
                    </P>

                    <SectionHeading id="security-shared" level={2}>
                        共享安全特性
                    </SectionHeading>
                    <P>所有四种方式共享以下安全保护：</P>
                    <List>
                        <Li>
                            <strong>AES-256-GCM 静态加密</strong> — <Code>~/.sig/credentials/</Code>{' '}
                            中的所有凭证文件都经过加密。加密密钥存储在{' '}
                            <Code>~/.sig/encryption.key</Code>（权限 0o400，仅所有者可读）。
                        </Li>
                        <Li>
                            <strong>审计日志</strong> —
                            每次凭证访问、登录、登出、同步以及代理启动/停止都记录在{' '}
                            <Code>~/.sig/audit.log</Code> 中（JSON Lines 格式）。
                        </Li>
                        <Li>
                            <strong>基于 Result 的错误处理</strong> — 认证失败返回类型化错误（
                            <Code>{'Result<T, AuthError>'}</Code>
                            ），永远不会抛出异常。错误信息中不会暴露凭证。
                        </Li>
                        <Li>
                            <strong>自动刷新</strong> —
                            过期凭证在使用前会透明地刷新。不会有过期令牌通过错误路径泄露。
                        </Li>
                    </List>
                </>
            ),
            aside: (
                <P>
                    对于 AI 代理，优先使用 <Code>sig proxy</Code> 或 <Code>sig run</Code>。 切勿将{' '}
                    <Code>sig get</Code> 的输出传入代理上下文。
                </P>
            ),
        },

        /* ── 命令参考 ── */
        {
            content: (
                <>
                    <SectionHeading id="commands" level={1}>
                        命令参考
                    </SectionHeading>
                    <P>
                        所有命令都支持 <Code>--verbose</Code>（在 stderr 输出调试信息）和{' '}
                        <Code>--help</Code>（显示用法）。
                    </P>

                    <SectionHeading id="cmd-init" level={2}>
                        sig init
                    </SectionHeading>
                    <P>
                        交互式创建 <Code>~/.sig/config.yaml</Code>。在无头机器上使用{' '}
                        <Code>--remote</Code> 启用无浏览器模式。
                    </P>
                    <CodeBlock lang="bash">{`sig init                    # 交互式配置
sig init --remote           # 无头 / CI / 远程机器
sig init --yes              # 接受所有默认值，跳过提示
sig init --force            # 覆盖现有配置
sig init --channel chrome   # 指定浏览器（chrome|msedge|chromium）`}</CodeBlock>

                    <SectionHeading id="cmd-doctor" level={2}>
                        sig doctor
                    </SectionHeading>
                    <P>
                        检查 Node 版本、Playwright
                        安装、配置解析以及凭证目录是否可写。出现问题时首先运行此命令。
                    </P>
                    <CodeBlock lang="bash">{`sig doctor`}</CodeBlock>

                    <SectionHeading id="cmd-run" level={2}>
                        sig run
                    </SectionHeading>
                    <P>
                        <strong>使用凭证的推荐方式。</strong>运行任意命令，同时注入{' '}
                        <Code>SIG_&lt;PROVIDER&gt;_*</Code> 环境变量。子进程的 stdout 和 stderr
                        中的凭证值会被自动脱敏。
                    </P>
                    <CodeBlock lang="bash">{`sig run [provider...] -- <cmd>

# 探索可用的 SIG_<PROVIDER>_* 变量
sig run my-jira -- env | grep SIG_MY_JIRA_

# 注入凭证并运行
sig run my-jira -- python fetch_issues.py
sig run my-jira -- node export_board.js

# 同时注入多个提供者
sig run provider-a provider-b -- python cross_tool.py

# 不指定提供者——注入所有有效凭证
sig run -- python script.py

# 将单个 cookie 展开为 SIG_<PROVIDER>_COOKIE_<NAME>=value
sig run my-jira --expand-cookies -- python script.py

# 将凭证写入 .env 文件（子进程退出后自动删除）
sig run my-jira --mount .env -- node app.js
sig run my-jira --mount creds.json --mount-format json -- node app.js`}</CodeBlock>
                </>
            ),
            aside: (
                <>
                    <P>
                        <strong>为什么选 sig run 而非 sig get？</strong> <Code>sig get</Code>{' '}
                        会将原始令牌暴露在 shell 变量、<Code>ps</Code> 输出和 AI 代理上下文中。
                        <Code>sig run</Code>{' '}
                        直接将凭证注入子进程环境并从输出中脱敏——不会有任何泄露。
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
                        向提供者进行认证。接受 URL 或提供者 ID。默认启动 Playwright
                        无头模式；检测到登录页面时回退为可视窗口。
                    </P>
                    <CodeBlock lang="bash">{`sig login <url>

# 浏览器 SSO（自动打开浏览器）
sig login https://jira.example.com

# 自定义提供者 ID
sig login https://jira.example.com --as my-jira

# API 令牌 / 个人访问令牌（无需浏览器）
sig login https://jira.example.com --token <your-pat>

# 从浏览器 DevTools → Network → Copy as cURL 复制的 cookie
sig login https://jira.example.com --cookie "SESSION=abc123; csrf_token=xyz"

# HTTP 基本认证
sig login https://jira.example.com --username alice --password hunter2

# 强制指定策略
sig login https://jira.example.com --strategy cookie
sig login https://jira.example.com --strategy oauth2
sig login https://jira.example.com --strategy api-token
sig login https://jira.example.com --strategy basic

# 跳过存储的凭证检查，直接进入浏览器
sig login https://jira.example.com --force`}</CodeBlock>

                    <SectionHeading id="cmd-logout" level={2}>
                        sig logout
                    </SectionHeading>
                    <CodeBlock lang="bash">{`sig logout my-jira         # 清除单个提供者
sig logout                   # 清除所有凭证`}</CodeBlock>

                    <SectionHeading id="cmd-get" level={2}>
                        sig get
                    </SectionHeading>
                    <P>
                        获取提供者的凭证请求头。建议优先使用 <Code>sig run</Code> 或{' '}
                        <Code>sig request</Code>——<Code>sig get</Code> 会在 shell 中暴露原始值。
                    </P>
                    <CodeBlock lang="bash">{`sig get my-jira                        # JSON 映射（默认）
sig get my-jira --format json          # 结构化 JSON
sig get my-jira --format header        # HTTP 请求头字符串
sig get my-jira --format value         # 仅原始值
sig get jira.example.com                  # 按 URL 查询`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    策略选择：当你已有凭证时，使用 <Code>--token</Code>、<Code>--cookie</Code> 或{' '}
                    <Code>--username/--password</Code>——无需浏览器。只对需要 SSO 的网站启动浏览器。
                </P>
            ),
        },

        {
            content: (
                <>
                    <SectionHeading id="cmd-request" level={2}>
                        sig request
                    </SectionHeading>
                    <P>发送认证 HTTP 请求。凭证保持内部传递——不会出现在 shell 历史记录中。</P>
                    <CodeBlock lang="bash">{`sig request <url>

sig request https://jira.example.com/api/me
sig request https://jira.example.com/api/issues/123 --format body
sig request https://jira.example.com/api/issues \
  --method POST \
  --body '{"title":"Bug","status":"open"}' \
  --header "Content-Type: application/json"
sig request <url> --format json     # 完整响应（状态、头、体）
sig request <url> --format body     # 仅响应体
sig request <url> --format headers  # 仅响应头`}</CodeBlock>

                    <SectionHeading id="cmd-status" level={2}>
                        sig status
                    </SectionHeading>
                    <CodeBlock lang="bash">{`sig status                       # 所有提供者
sig status my-jira              # 单个提供者
sig status --format json         # 机器可读`}</CodeBlock>

                    <SectionHeading id="cmd-providers" level={2}>
                        sig providers
                    </SectionHeading>
                    <CodeBlock lang="bash">{`sig providers                    # 表格视图
sig providers --format json      # 机器可读`}</CodeBlock>

                    <SectionHeading id="cmd-rename" level={2}>
                        sig rename
                    </SectionHeading>
                    <CodeBlock lang="bash">{`sig rename my-jira my-service   # 重命名提供者 ID`}</CodeBlock>

                    <SectionHeading id="cmd-remove" level={2}>
                        sig remove
                    </SectionHeading>
                    <CodeBlock lang="bash">{`sig remove my-jira              # 删除提供者和凭证
sig remove my-jira --keep-config  # 仅清除凭证
sig remove my-jira --force        # 跳过确认`}</CodeBlock>
                </>
            ),
        },

        {
            content: (
                <>
                    <SectionHeading id="cmd-remote" level={2}>
                        sig remote
                    </SectionHeading>
                    <P>管理跨机器凭证同步的 SSH 远程。</P>
                    <CodeBlock lang="bash">{`sig remote add prod ssh://deploy@ci.example.com
sig remote add prod ci.example.com --user deploy --ssh-key ~/.ssh/id_rsa --path ~/.sig
sig remote remove prod
sig remote list
sig remote list --format json`}</CodeBlock>

                    <SectionHeading id="cmd-sync" level={2}>
                        sig sync
                    </SectionHeading>
                    <P>通过 SSH 同步凭证。在笔记本上登录，推送到服务器。</P>
                    <CodeBlock lang="bash">{`sig sync push prod               # 推送所有凭证到远程
sig sync pull prod               # 从远程拉取凭证
sig sync push prod --provider my-jira   # 仅同步一个提供者
sig sync push --force            # 冲突时覆盖`}</CodeBlock>

                    <SectionHeading id="cmd-watch" level={2}>
                        sig watch
                    </SectionHeading>
                    <P>
                        管理自动刷新监视列表。监视循环本身作为代理守护进程的一部分运行——使用{' '}
                        <Code>sig proxy start</Code> 自动保持会话活跃。
                    </P>
                    <CodeBlock lang="bash">{`sig watch add my-jira           # 添加到监视列表
sig watch add my-jira --auto-sync prod   # 刷新后自动同步
sig watch remove my-jira        # 从监视列表移除
sig watch set-interval 1h       # 更改默认间隔`}</CodeBlock>

                    <SectionHeading id="cmd-proxy" level={2}>
                        sig proxy
                    </SectionHeading>
                    <P>
                        运行本地 MITM HTTP/HTTPS 代理守护进程。代理工具将 <Code>HTTP_PROXY</Code>/
                        <Code>HTTPS_PROXY</Code> 指向代理后发起普通请求——
                        凭证透明注入，代理工具永远不会看到令牌值。代理同时运行监视/刷新循环。
                    </P>
                    <CodeBlock lang="bash">{`sig proxy start                  # 启动守护进程（默认端口 7891）
sig proxy start --port 8080      # 使用自定义端口
sig proxy stop                   # 停止守护进程
sig proxy status                 # 显示运行状态、端口和环境变量提示
sig proxy trust                  # 打印 CA 证书路径和操作系统信任说明

# 用法：将任意工具指向代理
export HTTP_PROXY=http://127.0.0.1:7891
export HTTPS_PROXY=http://127.0.0.1:7891
curl https://jira.example.com/api/me   # 凭证自动注入`}</CodeBlock>
                    <P>
                        <strong>何时用代理 vs sig run：</strong>用 <Code>sig run</Code>{' '}
                        包裹单个命令；用 <Code>sig proxy</Code>{' '}
                        处理长期守护进程、会派生进程树的工具， 或只读取代理环境变量的工具。
                    </P>
                    <P>
                        <strong>注入规则：</strong>
                        对于需要在非标准位置（请求体字段、查询参数、自定义标头） 注入凭证的
                        API，可在 Provider 配置中添加 <Code>proxy.inject</Code> 规则。 代理和{' '}
                        <Code>sig request</Code> 会在标准凭证标头之后应用这些规则。
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
                        <Code>from</Code> 字段对已存储凭证中的路径进行解析：{' '}
                        <Code>credential.cookies</Code>、<Code>credential.accessToken</Code>、{' '}
                        <Code>credential.localStorage.&lt;key&gt;</Code>、
                        <Code>credential.xHeaders.&lt;key&gt;</Code>。 请求体注入支持{' '}
                        <Code>application/json</Code> 和{' '}
                        <Code>application/x-www-form-urlencoded</Code> 内容类型。
                    </P>
                    <P>
                        <strong>自动刷新：</strong>代理守护进程会自动运行监视/刷新循环。 在{' '}
                        <Code>config.yaml</Code> 中配置需要监视的 Provider：
                    </P>
                    <CodeBlock lang="yaml">{`watch:
  interval: 5m           # check interval (default: 5m)
  providers:
    jira:
      autoSync:            # optional: sync to remotes after refresh
        - dev-server
    ms-teams:`}</CodeBlock>
                    <P>
                        凭证会在过期前刷新。使用 <Code>sig watch add &lt;provider&gt;</Code>{' '}
                        管理监视列表，或直接编辑配置文件。 代理内置的监视循环无需单独运行{' '}
                        <Code>sig watch start</Code> 进程。
                    </P>
                    <P>
                        <strong>信任 CA 证书：</strong>进行 HTTPS 拦截时，代理会生成本地 CA 证书。
                        将其添加到系统信任存储：
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
                    使用 <Code>sig proxy start</Code>{' '}
                    将监视循环作为后台守护进程运行——它同时保持凭证新鲜并处理 HTTPS 拦截。
                </P>
            ),
        },

        /* ── 环境变量 ── */
        {
            content: (
                <>
                    <SectionHeading id="env-vars" level={1}>
                        环境变量
                    </SectionHeading>
                    <P>
                        <Code>sig run</Code> 将 <Code>SIG_&lt;PROVIDER&gt;_*</Code>{' '}
                        变量注入子进程。使用 <Code>sig run my-jira -- env | grep SIG_MY_JIRA_</Code>{' '}
                        来探索某个提供者可用的具体变量。
                    </P>
                    <P>
                        使用代理时（<Code>sig proxy start</Code>），设置{' '}
                        <Code>HTTP_PROXY=http://127.0.0.1:&lt;port&gt;</Code> 和{' '}
                        <Code>HTTPS_PROXY=http://127.0.0.1:&lt;port&gt;</Code>——凭证由代理注入，
                        无需 <Code>SIG_*</Code> 环境变量。
                    </P>
                    <CodeBlock lang="bash">{`# 始终存在（以提供者 "my-jira" 为例）
SIG_MY_JIRA_PROVIDER          # 提供者 ID："my-jira"
SIG_MY_JIRA_CREDENTIAL_TYPE   # 凭证类型：cookie | bearer | api-key | basic

# Bearer / OAuth2 令牌
SIG_MY_JIRA_TOKEN             # 原始令牌值，例如 "eyJ..."
SIG_MY_JIRA_AUTH_HEADER       # 完整的 Authorization 请求头值

# Cookie 凭证
SIG_MY_JIRA_COOKIE            # 完整 cookie 字符串，例如 "SESSION=abc; ..."

# 使用 --expand-cookies 时：单独的 cookie
SIG_MY_JIRA_COOKIE_SESSION=abc123
SIG_MY_JIRA_COOKIE_CSRF_TOKEN=xyz

# 从浏览器流量捕获的自定义 x-header
SIG_MY_JIRA_HEADER_X_AUSERNAME=alice
SIG_MY_JIRA_HEADER_X_ATTOKEN=xyz`}</CodeBlock>

                    <P>Python 脚本中读取凭证的示例：</P>
                    <CodeBlock lang="bash">{`import os

# 通过以下方式运行：sig run my-jira -- python fetch.py
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
                    默认情况下，子进程的 stdout/stderr 中的凭证值会被脱敏。调试时使用{' '}
                    <Code>--no-redaction</Code> 查看原始值。
                </P>
            ),
        },

        /* ── 配置 ── */
        {
            content: (
                <>
                    <SectionHeading id="configuration" level={1}>
                        配置
                    </SectionHeading>

                    <SectionHeading id="config-file" level={2}>
                        config.yaml
                    </SectionHeading>
                    <P>
                        Sigcli 读取 <Code>~/.sig/config.yaml</Code>。运行 <Code>sig init</Code>{' '}
                        生成初始文件。顶级键为 <Code>mode</Code> 和 <Code>providers</Code>。
                    </P>
                    <CodeBlock lang="bash">{`# ~/.sig/config.yaml

mode: browser          # browser | browserless
browserChannel: chrome # chrome | msedge | chromium（默认：chromium）

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
                        提供者配置选项
                    </SectionHeading>
                    <CodeBlock lang="bash">{`providers:
  <provider-id>:
    url: <base-url>              # 必填：要匹配的 URL
    strategy: cookie|oauth2|api-token|basic
    requiredCookies:             # 等待这些 cookie 出现
      - SESSION
    xHeaders:                    # 捕获这些响应头
      - name: X-User        # 内部名称
        header: x-user      # 实际 HTTP 请求头名称
    forceVisible: true           # 始终打开可视浏览器（默认：false）
    waitUntil: networkidle       # 加载事件：load|domcontentloaded|networkidle
    ttl: 8h                      # 凭证 TTL（例如 1h、8h、7d）`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    提供者 ID（例如 <Code>my-jira</Code>）是在所有命令中引用提供者的方式。 当你向{' '}
                    <Code>sig login</Code> 传入 URL 时，它会自动创建提供者条目；使用{' '}
                    <Code>--as</Code> 设置自定义 ID。
                </P>
            ),
        },

        /* ── 认证策略 ── */
        {
            content: (
                <>
                    <SectionHeading id="strategies" level={1}>
                        认证策略
                    </SectionHeading>
                    <P>
                        策略实现 <Code>IAuthStrategy</Code> 接口：<Code>validate</Code>、
                        <Code>authenticate</Code>、<Code>refresh</Code> 和{' '}
                        <Code>applyToRequest</Code>。Sigcli 内置四种策略，自动检测会选择正确的策略；
                        使用 <Code>--strategy</Code> 覆盖。
                    </P>

                    <SectionHeading id="strat-cookie" level={3}>
                        cookie
                    </SectionHeading>
                    <P>
                        从真实浏览器会话中捕获 cookie。适合任何 等 SSO
                        网站或多步骤登录（二维码、SAML、MFA）。 支持 <Code>forceVisible</Code>、
                        <Code>waitUntil</Code> 和 <Code>requiredCookies</Code>。
                    </P>
                    <CodeBlock lang="bash">{`sig login https://jira.example.com --strategy cookie`}</CodeBlock>

                    <SectionHeading id="strat-oauth2" level={3}>
                        oauth2
                    </SectionHeading>
                    <P>
                        监视出站请求中的 <Code>Authorization: Bearer ...</Code>，或从 OAuth
                        重定向中解码 JWT。存在刷新令牌时自动刷新。
                    </P>
                    <CodeBlock lang="bash">{`sig login https://jira.example.com --strategy oauth2`}</CodeBlock>

                    <SectionHeading id="strat-api-token" level={3}>
                        api-token
                    </SectionHeading>
                    <P>适用于你已有的静态 API 密钥或个人访问令牌。无需浏览器——非常适合 CI/CD。</P>
                    <CodeBlock lang="bash">{`sig login https://jira.example.com --token <your-pat>`}</CodeBlock>

                    <SectionHeading id="strat-basic" level={3}>
                        basic
                    </SectionHeading>
                    <P>
                        用户名和密码，在请求时编码为 Basic 认证头。明文密码仅存储在{' '}
                        <Code>~/.sig/credentials/</Code> 下的密封凭证文件中。
                    </P>
                    <CodeBlock lang="bash">{`sig login https://jira.example.com --username alice --password hunter2`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    策略返回 <Code>{'Result<T, AuthError>'}</Code>——对于预期失败从不抛出异常。
                    通过实现 <Code>IAuthStrategyFactory</Code> 构建自定义策略。
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
                        Sigcli 通过 <Code>IBrowserAdapter</Code> 抽象浏览器——三个小类：
                        <strong>Adapter → Session → Page</strong>。内置两个适配器。
                    </P>

                    <List>
                        <Li>
                            <strong>playwright</strong>——默认。使用 <Code>playwright-core</Code>{' '}
                            配合 Chromium、Chrome 或 Edge。支持无头和可视模式。浏览器 SSO 必需。
                        </Li>
                        <Li>
                            <strong>chrome-cdp</strong>——通过 Chrome DevTools Protocol 连接到现有
                            Chrome 实例。适用于附加到已打开的浏览器而无需启动新实例的场景。
                        </Li>
                    </List>

                    <P>
                        <Code>sig init --remote</Code> 将 Sigcli 置于 <Code>browserless</Code>{' '}
                        模式，使用 <Code>NullBrowserAdapter</Code>——令牌/cookie/basic 登录仍然有效，
                        但 SSO 流程被禁用。
                    </P>
                    <CodeBlock lang="bash">{`# 选择哪个适配器？
# → 带显示器的开发笔记本：playwright（默认）
# → 附加到已打开的 Chrome：chrome-cdp
# → 无头 CI / 远程服务器：browserless 模式 + sig sync pull`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    通过实现 <Code>IBrowserAdapter</Code>、<Code>IBrowserSession</Code> 和{' '}
                    <Code>IBrowserPage</Code> 编写自定义适配器。延迟导入浏览器库，并在导入失败时抛出{' '}
                    <Code>BrowserLaunchError</Code>，以便 <Code>sig doctor</Code> 诊断缺失的依赖。
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
                        轻量级客户端 SDK 封装了 <Code>sig get</Code> CLI 调用，解析 JSON
                        输出，并返回类型化的凭证对象。它们是薄层封装——所有认证逻辑都在 CLI 中。
                    </P>

                    <SectionHeading id="sdk-ts" level={2}>
                        TypeScript SDK
                    </SectionHeading>
                    <CodeBlock lang="bash">{`npm install @sigcli/sdk`}</CodeBlock>
                    <CodeBlock lang="bash">{`import { SigClient } from '@sigcli/sdk';

const sig = new SigClient();

// 获取凭证请求头
const headers = await sig.getHeaders('my-jira');
const response = await fetch('https://jira.example.com/api/me', { headers });

// 或直接使用 sig.request()
const result = await sig.request('https://jira.example.com/api/issues/123');`}</CodeBlock>

                    <SectionHeading id="sdk-python" level={2}>
                        Python SDK
                    </SectionHeading>
                    <CodeBlock lang="bash">{`pip install sigcli-sdk`}</CodeBlock>
                    <CodeBlock lang="bash">{`from sigcli import SigClient

sig = SigClient()

# 获取请求头
headers = sig.get_headers("my-jira")
response = requests.get("https://jira.example.com/api/me", headers=headers)

# 或直接使用 sig.request()
result = sig.request("https://jira.example.com/api/issues/123")`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    SDK 要求安装 <Code>sig</Code> 并存在有效凭证。它们在内部调用{' '}
                    <Code>sig get --format json</Code> 并解析结果——SDK 本身不进行浏览器或网络访问。
                </P>
            ),
        },

        /* ── AI 代理集成 ── */
        {
            content: (
                <>
                    <SectionHeading id="ai-agents" level={1}>
                        AI 代理集成
                    </SectionHeading>
                    <P>
                        Sigcli 提供稳定的 CLI 接口供代理调用。无需 SDK，无需 MCP
                        服务器——只需具有可预测退出码和 JSON 输出的命令。
                    </P>
                    <P>
                        推荐模式是 <Code>sig run</Code>：代理启动一个子进程，凭证已在环境中。
                        代理永远不会看到令牌值。对于无法包裹的工具——长期守护进程、会派生进程的工具——
                        请改用 <Code>sig proxy start</Code>。
                    </P>
                    <CodeBlock lang="bash">{`# 推荐：sig run 将凭证排除在代理上下文之外
sig run my-jira -- python fetch_issues.py
sig run my-jira -- node export_sprint.js

# 备选：sig proxy，适用于守护进程或只读取代理环境变量的工具
sig proxy start
export HTTP_PROXY=http://127.0.0.1:7891 HTTPS_PROXY=http://127.0.0.1:7891
# 现在任何遵循代理环境变量的工具都会自动注入凭证

# 探索可用的 SIG_<PROVIDER>_* 变量
sig run my-jira -- env | grep SIG_MY_JIRA_

# 备选：sig request（凭证保持内部）
sig request https://jira.example.com/api/me`}</CodeBlock>

                    <P>行动前检查认证状态：</P>
                    <CodeBlock lang="bash">{`# 行动前始终检查——避免不必要的浏览器启动
sig status my-jira --format json
# 退出码 0 + "valid": true  → 凭证就绪，跳过登录
# 退出码 3                  → 无凭证，运行 sig login
# 退出码 0 + 已过期          → sig logout my-jira && sig login https://jira.example.com`}</CodeBlock>
                </>
            ),
            aside: (
                <>
                    <P>
                        CLI 负责锁定、TTL 和刷新逻辑。通过命令行调用意味着每个调用方都能受益，
                        无需重新实现。
                    </P>
                    <P>
                        切勿在代理上下文或日志中显示 <Code>sig get</Code> 的输出——它可能包含原始
                        bearer 令牌或 API 密钥。
                    </P>
                </>
            ),
        },

        /* ── 技能 ── */
        {
            content: (
                <>
                    <SectionHeading id="skills" level={1}>
                        技能
                    </SectionHeading>
                    <P>
                        技能是可直接使用的扩展包，让 AI 代理（Claude
                        Code、Cursor、Windsurf、Cline）能够通过认证访问特定服务。每个技能是一个包含{' '}
                        <Code>SKILL.md</Code> 指南和 Python
                        辅助脚本的目录。代理读取指南，调用脚本，sigcli 透明处理认证。
                    </P>
                    <CodeBlock lang="bash">{`# 安装所有技能（自动检测代理）
./skills/install.sh

# 指定代理
./skills/install.sh --agent cursor

# 查看已安装
./skills/install.sh --list`}</CodeBlock>

                    <SectionHeading id="skills-catalog" level={2}>
                        可用技能
                    </SectionHeading>
                    <List>
                        <Li>
                            <Code>sigcli-auth</Code> — 认证指南：策略选择、命令参考、错误恢复。
                        </Li>
                        <Li>
                            <Code>outlook</Code> — 通过 Microsoft Graph
                            读取、发送、搜索、回复邮件。使用 <Code>ms-graph</Code>{' '}
                            提供者（OAuth2）。
                        </Li>
                        <Li>
                            <Code>msteams</Code> — 消息、对话、人员搜索、日历。使用{' '}
                            <Code>ms-teams</Code> 和 <Code>ms-graph</Code> 提供者。
                        </Li>
                        <Li>
                            <Code>slack</Code> — 频道、消息、搜索、表情。使用 <Code>app-slack</Code>{' '}
                            提供者（cookie + localStorage）。
                        </Li>
                    </List>

                    <SectionHeading id="skills-build" level={2}>
                        10 分钟创建技能
                    </SectionHeading>
                    <P>
                        一个技能只需一个文件：<Code>SKILL.md</Code>。如果 API
                        响应解析复杂，可添加辅助脚本。
                    </P>

                    <P>
                        <strong>1. 创建目录</strong>
                    </P>
                    <CodeBlock lang="bash">{`mkdir -p skills/my-service/scripts`}</CodeBlock>

                    <P>
                        <strong>
                            2. 编写 <Code>SKILL.md</Code>
                        </strong>
                    </P>
                    <CodeBlock lang="markdown">{`---
name: my-service
description: '与 My Service 交互 — 创建、列出和更新项目。'
---

# My Service

通过 REST API 创建、列出和更新项目。

## 认证

| 提供者        | 类型   | 登录命令                                  |
|------------- |--------|----------------------------------------|
| \`my-service\` | cookie | \`sig login https://my-service.example.com/\` |

**运行脚本：**
\`\`\`bash
sig run my-service -- python3 scripts/list_items.py \\
  --cookie "$SIG_MY_SERVICE_COOKIE"
\`\`\``}</CodeBlock>

                    <P>
                        <strong>3. 添加辅助脚本</strong>（可选）
                    </P>
                    <CodeBlock lang="python">{`#!/usr/bin/env python3
"""列出 My Service API 中的项目。"""
import argparse, json, sys, requests

BASE = "https://my-service.example.com/api/v1"

def list_items(cookie, query=None, limit=20):
    headers = {"Cookie": cookie} if cookie else {}
    params = {"limit": limit}
    if query:
        params["q"] = query
    resp = requests.get(f"{BASE}/items", headers=headers, params=params, timeout=15)
    resp.raise_for_status()
    return {"items": resp.json().get("items", []), "count": len(resp.json().get("items", []))}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--cookie", default="")
    p.add_argument("--query")
    p.add_argument("--limit", type=int, default=20)
    args = p.parse_args()
    try:
        json.dump(list_items(args.cookie, args.query, args.limit), sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": f"HTTP_{e.response.status_code}"}, sys.stdout, indent=2)

if __name__ == "__main__":
    main()`}</CodeBlock>

                    <P>
                        <strong>4. 注册并安装</strong>
                    </P>
                    <CodeBlock lang="bash">{`# 在 skills/install.sh 的 ALL_SKILLS 中添加，然后：
./skills/install.sh`}</CodeBlock>

                    <P>
                        就这样。代理读取 <Code>SKILL.md</Code>，调用{' '}
                        <Code>sig run my-service -- python3 scripts/list_items.py</Code>，获取 JSON
                        结果。无需 SDK，无需框架 — 只需一个 Markdown 文件和一个脚本。
                    </P>
                </>
            ),
            aside: (
                <>
                    <P>
                        <strong>技能约定：</strong>
                    </P>
                    <List>
                        <Li>脚本输出 JSON 到 stdout，错误格式为 {`{"error": "..."}`}</Li>
                        <Li>
                            凭证通过 <Code>sig run</Code> 环境变量传递：
                            <Code>SIG_{'<PROVIDER>'}_COOKIE</Code>
                        </Li>
                        <Li>
                            Token 参数可选（默认 <Code>{`""`}</Code>），兼容 <Code>sig run</Code> 和{' '}
                            <Code>sig proxy</Code>
                        </Li>
                        <Li>
                            测试使用 <Code>responses</Code> 库模拟 HTTP
                        </Li>
                    </List>
                </>
            ),
        },

        /* ── 远程与 SSH ── */
        {
            content: (
                <>
                    <SectionHeading id="remote-ssh" level={1}>
                        远程与 SSH
                    </SectionHeading>
                    <P>
                        在笔记本上登录，通过 SSH 将凭证推送到无头服务器。无需守护进程——
                        同步使用你现有的 SSH 密钥和与本地存储相同的文件锁。
                    </P>
                    <CodeBlock lang="bash">{`# 1. 在无头服务器上——设置无浏览器模式
sig init --remote

# 2. 在笔记本上——添加远程
sig remote add prod ssh://deploy@ci.example.com
# 或使用明确选项：
sig remote add prod ci.example.com --user deploy --ssh-key ~/.ssh/id_rsa

# 3. 推送所有凭证到服务器
sig sync push prod

# 4. 仅推送单个提供者
sig sync push prod --provider my-jira

# 5. 在服务器上——无需浏览器即可立即使用
sig run my-jira -- python deploy.py`}</CodeBlock>

                    <P>从远程机器拉取凭证（例如在应镜像开发凭证的 CI 任务中）：</P>
                    <CodeBlock lang="bash">{`sig sync pull prod                # 拉取全部
sig sync pull prod --force        # 冲突时覆盖`}</CodeBlock>

                    <P>通过将 watch 与 auto-sync 配对保持服务器凭证新鲜：</P>
                    <CodeBlock lang="bash">{`# 在笔记本上：每小时刷新 my-jira 并自动推送到 prod
sig watch add my-jira --auto-sync prod
sig watch start --interval 1h`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    同步通过 SSH 按原样传输凭证文件——传输过程从不解码。你保留常规的 SSH
                    密钥管理；无需运行新基础设施。
                </P>
            ),
        },

        /* ── 错误代码 ── */
        {
            content: (
                <>
                    <SectionHeading id="error-codes" level={1}>
                        错误代码
                    </SectionHeading>
                    <P>所有命令都以可供脚本分支的退出码退出：</P>
                    <CodeBlock lang="bash">{`# 退出码
0   成功
1   GENERAL_ERROR       — 无效参数或意外失败
2   PROVIDER_NOT_FOUND  — URL/ID 不匹配任何已配置的提供者
3   CREDENTIAL_NOT_FOUND — 无存储凭证 → 运行 sig login
4   REMOTE_NOT_FOUND    — SSH 远程未配置 → 运行 sig remote add`}</CodeBlock>

                    <P>
                        来自 <Code>--verbose</Code> stderr 的认证错误代码：
                    </P>
                    <CodeBlock lang="bash">{`CREDENTIAL_EXPIRED        # 令牌/cookie 已过期，刷新失败
                          # 修复：sig logout <p> && sig login <url>

CREDENTIAL_TYPE_MISMATCH  # 提供者的凭证类型错误
                          # 修复：使用 --strategy <name> 重新登录

REFRESH_FAILED            # OAuth2 刷新令牌被拒绝
                          # 修复：sig logout <p> && sig login <url>

BROWSER_LAUNCH_ERROR      # playwright-core 未安装或无浏览器
                          # 修复：sig doctor；安装 playwright-core

BROWSER_TIMEOUT           # 浏览器认证超时
                          # 修复：重试；如有 CAPTCHA/MFA 确保可视模式

BROWSER_UNAVAILABLE       # 机器处于无浏览器模式
                          # 修复：使用 --token/--cookie 或 sig sync pull

CONFIG_ERROR              # ~/.sig/config.yaml 格式错误
                          # 修复：sig doctor 验证

SYNC_CONFLICT             # 本地/远程凭证不同
                          # 修复：sig sync pull --force

STORAGE_ERROR             # 无法读写凭证文件
                          # 修复：检查 ~/.sig/credentials/ 的权限`}</CodeBlock>
                </>
            ),
            aside: (
                <P>
                    为任何命令添加 <Code>--verbose</Code> 以在 stderr 上查看详细错误信息。
                    出现问题时，首先使用 <Code>sig doctor</Code>。
                </P>
            ),
        },
    ] as EditorialSection[],
};
