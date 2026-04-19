import { createFileRoute } from '@tanstack/react-router';
import { EditorialPage } from '../../components/markdown';
import { LanguageSwitcher } from '../../components/language-switcher';
import { pageContent } from '../../content/docs';

export const Route = createFileRoute('/docs/')({
    component: DocsPage,
    head: () => ({
        meta: [
            { title: pageContent.meta.title },
            { name: 'description', content: pageContent.meta.description },
        ],
        links: [
            { rel: 'alternate', hreflang: 'en', href: '/docs/' },
            { rel: 'alternate', hreflang: 'zh', href: '/zh/docs/' },
            { rel: 'alternate', hreflang: 'x-default', href: '/docs/' },
        ],
    }),
});

function DocsPage() {
    return (
        <EditorialPage
            toc={pageContent.toc}
            sections={pageContent.sections}
            hero={pageContent.hero}
            logo="/sigcli-logo.svg"
            languageSwitcher={<LanguageSwitcher locale="en" page="docs" />}
        />
    );
}
