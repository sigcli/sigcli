export function LanguageSwitcher({ locale, page = 'home' }: { locale: 'en' | 'zh'; page?: 'home' | 'docs' }) {
    const enHref = page === 'docs' ? '/docs/' : '/';
    const zhHref = page === 'docs' ? '/zh/docs/' : '/zh';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <a
                href={enHref}
                style={{
                    fontFamily: 'var(--font-primary)',
                    fontSize: 'var(--type-toc-size)',
                    fontWeight: locale === 'en' ? 560 : 400,
                    color: locale === 'en' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    textDecoration: 'none',
                    transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                    if (locale !== 'en') e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                    if (locale !== 'en') e.currentTarget.style.color = 'var(--text-secondary)';
                }}
            >
                EN
            </a>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--type-toc-size)' }}>
                /
            </span>
            <a
                href={zhHref}
                style={{
                    fontFamily: 'var(--font-primary)',
                    fontSize: 'var(--type-toc-size)',
                    fontWeight: locale === 'zh' ? 560 : 400,
                    color: locale === 'zh' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    textDecoration: 'none',
                    transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                    if (locale !== 'zh') e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                    if (locale !== 'zh') e.currentTarget.style.color = 'var(--text-secondary)';
                }}
            >
                中文
            </a>
        </div>
    );
}
