'use client';

import { TerminalAnimation } from '../components/terminal-animation';

export function LandingPage() {
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
                        <a
                            href="/docs/"
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
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                            </svg>
                            Docs
                        </a>
                        <a
                            href="https://github.com/sigcli/sigcli"
                            target="_blank"
                            rel="noopener noreferrer"
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
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                            </svg>
                            GitHub
                        </a>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1">
                {/* Hero */}
                <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
                    <h1
                        style={{
                            fontFamily: "'Bubblegum Sans', cursive",
                            fontSize: 'clamp(3rem, 8vw, 5rem)',
                            fontWeight: 400,
                            margin: 0,
                            lineHeight: 1.1,
                            color: 'var(--text-primary)',
                        }}
                    >
                        SigCLI
                    </h1>
                    <p
                        className="mt-4 mb-12"
                        style={{
                            fontFamily: 'var(--font-secondary)',
                            fontStyle: 'italic',
                            fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)',
                            fontWeight: 400,
                            color: 'var(--text-secondary)',
                            lineHeight: 1.5,
                        }}
                    >
                        Authenticate Once. Use Everywhere.
                    </p>
                    <div className="max-w-2xl mx-auto">
                        <TerminalAnimation />
                    </div>
                </section>

                {/* What is sig */}
                <section className="max-w-4xl mx-auto px-6 pb-16">
                    <h2
                        className="mb-4"
                        style={{
                            fontSize: 'var(--type-heading-2-size)',
                            fontWeight: 560,
                            color: 'var(--text-primary)',
                        }}
                    >
                        What is sig?
                    </h2>
                    <p
                        style={{
                            fontSize: 'var(--type-body-size)',
                            fontWeight: 475,
                            lineHeight: 1.6,
                            color: 'var(--text-primary)',
                            opacity: 0.82,
                        }}
                    >
                        The authentication layer for AI agents and scripts. Login once via browser
                        SSO, then any tool can access your work systems — Jira, Slack, wikis, APIs —
                        without storing passwords. Credentials are encrypted at rest and injected on
                        demand.
                    </p>
                </section>

                {/* Install */}
                <section className="max-w-4xl mx-auto px-6 pb-16">
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
                        <code>npm install -g @sigcli/cli</code>
                    </pre>
                </section>

                {/* Three methods */}
                <section className="max-w-4xl mx-auto px-6 pb-20">
                    <h2
                        className="mb-6"
                        style={{
                            fontSize: 'var(--type-heading-2-size)',
                            fontWeight: 560,
                            color: 'var(--text-primary)',
                        }}
                    >
                        Three ways to use credentials
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <MethodCard
                            command="sig get"
                            description="Get credential headers for your own HTTP calls"
                        />
                        <MethodCard
                            command="sig run"
                            description="Inject credentials as env vars into any command"
                        />
                        <MethodCard
                            command="sig proxy"
                            description="Transparent MITM proxy — apps need zero changes"
                        />
                    </div>
                </section>

                {/* Link to docs */}
                <section className="max-w-4xl mx-auto px-6 pb-24 text-center">
                    <a
                        href="/docs/"
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
                        Read the docs
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

function MethodCard({ command, description }: { command: string; description: string }) {
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
                    fontFamily: 'var(--font-code)',
                    fontSize: 'var(--type-code-size)',
                    fontWeight: 560,
                    color: 'var(--text-primary)',
                }}
            >
                {command}
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
