import { createFileRoute } from '@tanstack/react-router';
import { EditorialPage } from '../../components/markdown';
import { LanguageSwitcher } from '../../components/language-switcher';
import { pageContent } from '../../content/zh';

export const Route = createFileRoute('/zh/')({
    component: ZhIndexPage,
    head: () => ({
        meta: [
            { title: pageContent.meta.title },
            { name: 'description', content: pageContent.meta.description },
        ],
        links: [
            { rel: 'alternate', hreflang: 'en', href: '/' },
            { rel: 'alternate', hreflang: 'zh', href: '/zh' },
            { rel: 'alternate', hreflang: 'x-default', href: '/' },
        ],
    }),
});

function ZhIndexPage() {
    return (
        <EditorialPage
            toc={pageContent.toc}
            sections={pageContent.sections}
            hero={pageContent.hero}
            logo="/signet-logo.svg"
            languageSwitcher={<LanguageSwitcher locale="zh" />}
        />
    );
}
