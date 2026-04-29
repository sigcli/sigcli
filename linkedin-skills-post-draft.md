Been using [sigcli](https://sigcli.ai) for a while now to connect AI agents with my daily work tools. Wanted to share what's actually working.

The idea: you log in once via browser, sig stores credentials encrypted, then your AI agent (Claude Code, Cursor, etc.) calls scripts that hit the real APIs behind your work systems.

What I have running daily:

→ Outlook — summarize unread, draft replies, search old threads
→ MS Teams — read messages, check calendar, send updates
→ Slack — check unreads, search conversations, post to channels
→ Jira — look up tickets, check sprint status, update issues
→ LinkedIn — browse feed, search people/jobs, post updates

Each "skill" is just a set of Python scripts + a doc file. The agent reads the doc and knows which script to call.

Just shipped a one-liner installer:

npx @sigcli/skills

Picks up your AI coding agent automatically (Claude Code, Cursor, Windsurf) and installs the skills you choose.

The part I care most about: credentials never enter the AI's context window. sig injects auth at the network layer — the agent just makes normal HTTP calls through a local proxy.

Open source (MIT): https://github.com/sigcli/sigcli

#AIAgents #DeveloperTools #OpenSource #Productivity
