'use client';

const skills = [
    {
        name: 'Outlook',
        platform: 'Email',
        read: 'Inbox, search, folders',
        write: 'Send, reply, forward',
        auth: 'OAuth2',
    },
    {
        name: 'MS Teams',
        platform: 'Chat',
        read: 'Messages, channels, calendar',
        write: 'Send messages',
        auth: 'OAuth2',
    },
    {
        name: 'Slack',
        platform: 'Chat',
        read: 'Channels, search, users',
        write: 'Send messages, reactions',
        auth: 'Cookie',
    },
    {
        name: 'V2EX',
        platform: 'Forum',
        read: 'Hot topics, search, threads',
        write: 'Post, reply, favorite',
        auth: 'Cookie',
    },
    {
        name: 'Reddit',
        platform: 'Forum',
        read: 'Hot posts, search, users',
        write: 'Post, comment, vote',
        auth: 'Cookie',
    },
    {
        name: 'Hacker News',
        platform: 'Forum',
        read: 'Top/new/best, search',
        write: 'Comment, vote',
        auth: 'Cookie',
    },
    {
        name: 'Zhihu',
        platform: 'Q&A',
        read: 'Hot list, search, answers',
        write: 'Read-only',
        auth: 'Cookie',
    },
    {
        name: 'Bilibili',
        platform: 'Video',
        read: 'Trending, search, comments',
        write: 'Like, coin, favorite',
        auth: 'Cookie',
    },
    {
        name: 'YouTube',
        platform: 'Video',
        read: 'Search, channels, comments',
        write: 'Like, subscribe',
        auth: 'Cookie',
    },
    {
        name: 'X (Twitter)',
        platform: 'Social',
        read: 'Users, tweets, trending',
        write: 'Tweet, like, retweet',
        auth: 'Cookie',
    },
    {
        name: 'LinkedIn',
        platform: 'Professional',
        read: 'Profiles, feed, jobs',
        write: 'Post, like, connect',
        auth: 'Cookie',
    },
    {
        name: 'Xiaohongshu',
        platform: 'Social',
        read: 'Search, notes, comments, users, feed',
        write: 'Read-only',
        auth: 'Cookie',
    },
];

export function SkillsPage() {
    return (
        <div
            className="min-h-screen flex flex-col"
            style={{
                background: 'var(--bg)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-primary)',
            }}
        >
            {/* Header */}
            <header style={{ borderBottom: '1px solid var(--page-border)' }}>
                <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
                    <a href="/" className="no-underline">
                        <span
                            style={{
                                fontFamily: "'Bubblegum Sans', cursive",
                                fontSize: '22px',
                                color: 'var(--text-primary)',
                            }}
                        >
                            Sigcli
                        </span>
                    </a>
                    <div className="flex items-center gap-4">
                        <NavLink href="/skills/">Skills</NavLink>
                        <NavLink href="/docs/">Docs</NavLink>
                        <NavLink href="https://github.com/sigcli/sigcli" external>
                            GitHub
                        </NavLink>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1">
                {/* Hero */}
                <section className="max-w-4xl mx-auto px-6 pt-16 pb-12">
                    <h1
                        style={{
                            fontSize: 'clamp(2rem, 5vw, 3rem)',
                            fontWeight: 560,
                            margin: 0,
                            lineHeight: 1.2,
                            color: 'var(--text-primary)',
                        }}
                    >
                        AI Agent Skills
                    </h1>
                    <p
                        className="mt-4 mb-0"
                        style={{
                            fontSize: 'clamp(1rem, 2vw, 1.2rem)',
                            fontWeight: 475,
                            color: 'var(--text-secondary)',
                            lineHeight: 1.6,
                        }}
                    >
                        Pre-built Python scripts that let AI agents operate web services
                        autonomously. Each skill includes scripts + a SKILL.md that agents read and
                        execute on their own.
                    </p>
                </section>

                {/* Demo GIFs */}
                <section className="max-w-4xl mx-auto px-6 pb-12">
                    <div className="grid grid-cols-1 gap-8">
                        <div>
                            <div
                                className="rounded-lg overflow-hidden"
                                style={{ border: '1px solid var(--page-border)' }}
                            >
                                <img
                                    src="/x-demo.gif"
                                    alt="X (Twitter) skill demo: searching tweets and replying from the terminal"
                                    style={{ width: '100%', display: 'block' }}
                                />
                            </div>
                            <p
                                className="mt-2 text-center"
                                style={{
                                    fontSize: '0.85rem',
                                    fontWeight: 475,
                                    color: 'var(--text-tertiary)',
                                }}
                            >
                                X (Twitter) — search and reply from your terminal
                            </p>
                        </div>
                        <div>
                            <div
                                className="rounded-lg overflow-hidden"
                                style={{ border: '1px solid var(--page-border)' }}
                            >
                                <img
                                    src="/xiaohongshu-demo.gif"
                                    alt="Xiaohongshu skill demo: searching notes and reading content from the terminal"
                                    style={{ width: '100%', display: 'block' }}
                                />
                            </div>
                            <p
                                className="mt-2 text-center"
                                style={{
                                    fontSize: '0.85rem',
                                    fontWeight: 475,
                                    color: 'var(--text-tertiary)',
                                }}
                            >
                                Xiaohongshu — search notes and read content from your terminal
                            </p>
                        </div>
                    </div>
                </section>

                {/* Install */}
                <section className="max-w-4xl mx-auto px-6 pb-12">
                    <h2
                        className="mb-4"
                        style={{
                            fontSize: 'var(--type-heading-2-size)',
                            fontWeight: 560,
                            color: 'var(--text-primary)',
                        }}
                    >
                        Install
                    </h2>
                    <pre
                        className="rounded-lg overflow-x-auto"
                        style={{
                            background: '#18181b',
                            border: '1px solid #27272a',
                            padding: '16px 20px',
                            margin: 0,
                            fontFamily: 'var(--font-code)',
                            fontSize: 'var(--type-code-size)',
                            color: '#e4e4e7',
                            lineHeight: 1.6,
                        }}
                    >
                        <code>
                            {`# Install sig
npm install -g @sigcli/cli

# Install skills to your coding agent (Claude Code, Cursor, Windsurf, Cline)
npx @sigcli/skills

# Login to a platform (once)
sig login https://x.com

# AI agent uses sig run to get credentials and call scripts
sig run x -- python3 scripts/x_search.py --query "AI agents"`}
                        </code>
                    </pre>
                </section>

                {/* Skills Catalog */}
                <section className="max-w-4xl mx-auto px-6 pb-12">
                    <h2
                        className="mb-4"
                        style={{
                            fontSize: 'var(--type-heading-2-size)',
                            fontWeight: 560,
                            color: 'var(--text-primary)',
                        }}
                    >
                        Skills Catalog
                    </h2>
                    <div
                        className="overflow-x-auto rounded-lg"
                        style={{ border: '1px solid var(--page-border)' }}
                    >
                        <table
                            style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: '0.9rem',
                            }}
                        >
                            <thead>
                                <tr
                                    style={{
                                        borderBottom: '1px solid var(--page-border)',
                                        background: 'rgba(0,0,0,0.02)',
                                    }}
                                >
                                    <Th>Skill</Th>
                                    <Th>Platform</Th>
                                    <Th>Read</Th>
                                    <Th>Write</Th>
                                    <Th>Auth</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {skills.map((s) => (
                                    <tr
                                        key={s.name}
                                        style={{ borderBottom: '1px solid var(--page-border)' }}
                                    >
                                        <Td bold>{s.name}</Td>
                                        <Td>{s.platform}</Td>
                                        <Td>{s.read}</Td>
                                        <Td>{s.write}</Td>
                                        <Td>{s.auth}</Td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Build Your Own */}
                <section className="max-w-4xl mx-auto px-6 pb-12">
                    <h2
                        className="mb-4"
                        style={{
                            fontSize: 'var(--type-heading-2-size)',
                            fontWeight: 560,
                            color: 'var(--text-primary)',
                        }}
                    >
                        Build Your Own
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <StepCard
                            step="1"
                            title="Find the API"
                            description="Open DevTools → Network, interact with the site, and find the REST endpoints it calls."
                        />
                        <StepCard
                            step="2"
                            title="Write Python scripts"
                            description="One script per action. Use argparse for input, print JSON to stdout. sig run injects credentials."
                        />
                        <StepCard
                            step="3"
                            title="Write SKILL.md"
                            description="Document each script's purpose, args, and examples. The AI agent reads this to operate your skill."
                        />
                    </div>
                    <pre
                        className="rounded-lg overflow-x-auto mt-4"
                        style={{
                            background: '#18181b',
                            border: '1px solid #27272a',
                            padding: '16px 20px',
                            margin: 0,
                            fontFamily: 'var(--font-code)',
                            fontSize: 'var(--type-code-size)',
                            color: '#e4e4e7',
                            lineHeight: 1.6,
                        }}
                    >
                        <code>
                            {`my-skill/
├── SKILL.md           # AI agent reads this to know how to use the skill
├── scripts/
│   ├── my_client.py   # Shared HTTP client (auth, retries)
│   ├── my_search.py   # Search functionality
│   └── my_action.py   # Write operations
└── requirements.txt`}
                        </code>
                    </pre>
                </section>

                {/* CTA */}
                <section className="max-w-4xl mx-auto px-6 pb-24 text-center">
                    <a
                        href="https://github.com/sigcli/sigcli/tree/main/skills"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="no-underline inline-flex items-center gap-2"
                        style={{
                            fontSize: '1.1rem',
                            fontWeight: 560,
                            color: 'var(--link-accent, #0969da)',
                            transition: 'opacity 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '0.7';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '1';
                        }}
                    >
                        View all skills on GitHub
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </a>
                </section>
            </main>
        </div>
    );
}

function NavLink({
    href,
    children,
    external,
}: {
    href: string;
    children: React.ReactNode;
    external?: boolean;
}) {
    return (
        <a
            href={href}
            className="no-underline flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors duration-150"
            style={{
                fontSize: 'var(--type-toc-size)',
                fontWeight: 475,
                color: 'var(--text-secondary)',
                border: '1px solid var(--page-border)',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.borderColor = 'var(--text-tertiary)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--page-border)';
            }}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
            {children}
        </a>
    );
}

function Th({ children }: { children: React.ReactNode }) {
    return (
        <th
            style={{
                textAlign: 'left',
                padding: '10px 14px',
                fontWeight: 560,
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
            }}
        >
            {children}
        </th>
    );
}

function Td({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
    return (
        <td
            style={{
                padding: '10px 14px',
                fontWeight: bold ? 560 : 475,
                color: bold ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
        >
            {children}
        </td>
    );
}

function StepCard({
    step,
    title,
    description,
}: {
    step: string;
    title: string;
    description: string;
}) {
    return (
        <div
            className="rounded-lg p-5"
            style={{
                border: '1px solid var(--page-border)',
                background: 'var(--bg)',
            }}
        >
            <div
                className="mb-2"
                style={{
                    fontSize: '0.8rem',
                    fontWeight: 560,
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                }}
            >
                Step {step}
            </div>
            <div
                className="mb-2"
                style={{
                    fontSize: '1rem',
                    fontWeight: 560,
                    color: 'var(--text-primary)',
                }}
            >
                {title}
            </div>
            <p
                style={{
                    fontSize: 'var(--type-toc-size)',
                    fontWeight: 475,
                    lineHeight: 1.5,
                    color: 'var(--text-secondary)',
                    margin: 0,
                }}
            >
                {description}
            </p>
        </div>
    );
}
