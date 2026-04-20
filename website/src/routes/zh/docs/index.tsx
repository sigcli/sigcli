import { createFileRoute } from '@tanstack/react-router';
import { EditorialPage } from '../../../components/markdown';
import { LanguageSwitcher } from '../../../components/language-switcher';
import { pageContent } from '../../../content/docs-zh';

export const Route = createFileRoute('/zh/docs/')({
    component: ZhDocsPage,
    head: () => ({
        meta: [
            { title: pageContent.meta.title },
            { name: 'description', content: pageContent.meta.description },
        ],
        links: [
            { rel: 'alternate', hreflang: 'en', href: '/docs/' },
            { rel: 'alternate', hreflang: 'zh', href: '/zh/docs/' },
        ],
    }),
});

function ZhDocsPage() {
    return (
        <EditorialPage
            toc={pageContent.toc}
            sections={pageContent.sections}
            hero={pageContent.hero}
            logo="/sigcli-logo.svg"
            locale="zh"
            languageSwitcher={<LanguageSwitcher locale="zh" page="docs" />}
        />
    );
}
