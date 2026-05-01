import { createFileRoute } from '@tanstack/react-router';

import { EditorialPage } from '../../components/markdown';
import { pageContent } from '../../content/docs';

export const Route = createFileRoute('/docs/')({
    component: DocsPage,
    head: () => ({
        meta: [
            { title: pageContent.meta.title },
            { name: 'description', content: pageContent.meta.description },
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
        />
    );
}
