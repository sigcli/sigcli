# Security Policy

## Supported Versions

Security fixes are issued against the latest minor release line of each package.

| Package               | Supported version |
| --------------------- | ----------------- |
| `@sigcli/cli`         | Latest 1.x        |
| `@sigcli/sdk`         | Latest 2.x        |
| `sigcli-sdk` (Python) | Latest 0.x        |

Older versions do not receive security patches. Please upgrade before reporting.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security reports.**

Please report vulnerabilities privately via either:

- GitHub Security Advisories: https://github.com/sigcli/sigcli/security/advisories/new (preferred — encrypted, tracked)
- Email: pylon.peng@gmail.com with the subject `[sigcli security]`

Include in your report:

- Affected package and version (`sig --version` for the CLI)
- A description of the vulnerability and the impact you observed
- Reproduction steps or a proof-of-concept, if available
- Your suggested remediation, if any

You can expect:

- Acknowledgement within **3 business days**
- An initial assessment and severity rating within **7 business days**
- A patched release for confirmed High/Critical issues within **14 days** of confirmation, where feasible
- Public disclosure coordinated with you after a patched release is available

## Scope

In scope:

- Code in this repository (`cli/`, `sdk/typescript/`, `sdk/python/`)
- Credential handling, encryption-at-rest, proxy, and authentication flows
- Supply-chain integrity of published packages (`@sigcli/cli`, `@sigcli/sdk`, `sigcli-sdk`)

Out of scope:

- The `website/` workspace (marketing site only, not published as a package)
- Issues that require physical access to an unlocked user machine
- Social engineering against package maintainers
- Vulnerabilities in third-party browser engines, operating systems, or upstream Node.js

## Security Practices

- All credentials are encrypted at rest with AES-256-GCM using a per-machine key at `~/.sig/encryption.key` (mode `0o400`)
- Released packages have no `preinstall`, `install`, or `postinstall` lifecycle scripts
- Releases are gated on a manually-triggered GitHub Actions workflow on `main`, with `--frozen-lockfile` installs
- All direct and transitive licences are permissive (MIT / ISC / 0BSD)

For a current snapshot of dependency advisories, run `pnpm audit --prod` from the relevant workspace.
