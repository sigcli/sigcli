import { createFileRoute } from '@tanstack/react-router';

import { SkillsPage } from '../../content/skills';

export const Route = createFileRoute('/skills/')({
    component: SkillsPage,
    head: () => ({
        meta: [
            { title: 'AI Agent Skills — SigCLI' },
            {
                name: 'description',
                content:
                    'Pre-built Python scripts that let AI agents operate 14+ web services autonomously.',
            },
        ],
    }),
});
