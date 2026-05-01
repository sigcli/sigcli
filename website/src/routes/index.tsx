import { createFileRoute } from '@tanstack/react-router';

import { LandingPage } from '../content/landing';

export const Route = createFileRoute('/')({
    component: LandingPage,
    head: () => ({
        meta: [
            { title: 'SigCLI — Authenticate Once. Use Everywhere.' },
            {
                name: 'description',
                content:
                    'The authentication layer for AI agents and scripts. Login once via browser SSO, then any tool can access your work systems.',
            },
        ],
    }),
});
