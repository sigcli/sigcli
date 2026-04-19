import { createFileRoute } from '@tanstack/react-router';
import { EditorialPage } from '../components/markdown';
import { LanguageSwitcher } from '../components/language-switcher';
import { pageContent } from '../content/en';

export const Route = createFileRoute('/')({
    component: IndexPage,
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

function IndexPage() {
    return (
        <EditorialPage
            toc={pageContent.toc}
            sections={pageContent.sections}
            hero={pageContent.hero}
            logo="/sigcli-logo.svg"
            languageSwitcher={<LanguageSwitcher locale="en" />}
        />
    );
}
