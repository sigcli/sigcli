# Competitive Analysis: Sigcli vs OneCLI vs OpenCLI vs Sigillo

**Date:** 2026-04-19

---

## Executive Summary

We analyzed three competitor projects to understand how sigcli should position and differentiate. Each competitor addresses a different facet of the "auth + CLI + agents" space:

| Tool        | Core Focus                                                                        | Language             | Age       | Commits |
| ----------- | --------------------------------------------------------------------------------- | -------------------- | --------- | ------- |
| **Sigcli**  | CLI auth orchestrator (pluggable strategies, browser automation, credential sync) | TypeScript/Node      | ~2 months | ~50     |
| **OneCLI**  | MITM proxy gateway for AI agent credential injection                              | Rust + Next.js       | ~6 weeks  | 165     |
| **OpenCLI** | Browser automation → deterministic CLI adapters for 101 websites                  | TypeScript/Node      | ~5 weeks  | 877     |
| **Sigillo** | Secrets management platform (Doppler alternative)                                 | Zig CLI + CF Workers | ~3 weeks  | 179     |

**Key insight:** None of these are direct competitors in the traditional sense — each occupies a distinct niche. But they all converge on the same user: **developers and AI agents that need authenticated access to external services**. The opportunity for sigcli is to be the **auth layer** that any of these tools could integrate with.

---

## Feature Comparison Matrix

| Feature                   | Sigcli                                               | OneCLI                                        | OpenCLI                                               | Sigillo                               |
| ------------------------- | ---------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------- | ------------------------------------- |
| **Auth strategies**       | Cookie, Bearer, API-key, Basic (pluggable)           | OAuth injection, API key injection, MITM      | Cookie, CSRF/Header, Network intercept, UI automation | OAuth (Google only), API tokens       |
| **Browser automation**    | Yes (Playwright/Puppeteer adapters)                  | No (proxy-based)                              | Yes (Chrome extension + CDP)                          | No                                    |
| **Credential storage**    | Local directory, cached, memory                      | PostgreSQL (encrypted AES-256-GCM)            | Browser cookies (Chrome)                              | Cloudflare D1 (encrypted AES-256-GCM) |
| **Credential sync**       | SSH-based remote sync                                | N/A (centralized DB)                          | N/A                                                   | N/A (centralized DB)                  |
| **Multi-provider config** | YAML config with URL matching                        | 16 hardcoded OAuth providers                  | 101 site-specific adapters                            | Org → Project → Environment hierarchy |
| **CLI UX**                | `sig get/login/status/logout`                        | Web dashboard only                            | `opencli <site> <command>`                            | `sigillo run/secrets/setup`           |
| **SDK**                   | TypeScript + Python                                  | Container config SDK only                     | No SDK (CLI-only)                                     | No SDK (CLI-only)                     |
| **AI agent support**      | First-class (SKILL.md, cascade login)                | First-class (proxy + error messages for LLMs) | First-class (SKILL.md files, browser primitives)      | First-class (device flow, redaction)  |
| **Self-hostable**         | Local-first (no server needed)                       | Docker Compose                                | Local Chrome extension                                | Cloudflare Workers                    |
| **Secret redaction**      | No                                                   | No                                            | No                                                    | Yes (entropy-based streaming)         |
| **Policy engine**         | No                                                   | Yes (block, rate-limit, manual approval)      | No                                                    | No                                    |
| **Plugin system**         | Strategy/adapter extensibility                       | Rust traits (compile-time)                    | Full plugin lifecycle (github:user/repo)              | No                                    |
| **Vault integration**     | No                                                   | Bitwarden (via Agent Access SDK)              | No                                                    | No                                    |
| **Output formats**        | json, yaml, env, table, plain + header/value for get | JSON error responses                          | table, json, yaml, csv, md, plain                     | env, json, yaml, docker, dotnet-json  |
| **Shell completion**      | bash, zsh, fish                                      | N/A                                           | bash, zsh, fish                                       | No                                    |
| **Desktop app control**   | No                                                   | No                                            | Yes (8 Electron apps via CDP)                         | No                                    |

---

## Detailed Competitor Profiles

### 1. OneCLI — "Secret Vault for AI Agents"

**What it is:** A Rust MITM proxy gateway that sits between AI agents and APIs. Agents route traffic through `HTTPS_PROXY`, and OneCLI transparently injects real credentials (API keys, OAuth tokens) into requests. Web dashboard for management.

**Architecture highlights:**

- Rust gateway (Hyper/Axum) handles CONNECT requests, generates TLS leaf certs per-host via rcgen
- Next.js 16 dashboard with PostgreSQL (Prisma), NextAuth 5 (Google OAuth)
- Policy engine: Block > ManualApproval > RateLimit > Allow (per-agent, per-host, per-path)
- Dual editions: OSS (AES + DashMap) vs Cloud (KMS + Redis + Cognito) via Cargo features
- 16 OAuth app connections (GitHub + 15 Google Workspace APIs)
- Bitwarden vault integration via Agent Access SDK

**Strengths:**

1. LLM-optimized error messages with pre-filled recovery URLs
2. Policy engine (rate limiting, manual approval gates)
3. Zero-config Docker setup
4. Vault integration (Bitwarden)
5. Production-grade security (AES-256-GCM, KMS)

**Weaknesses:**

- No CLI tool — only web dashboard + proxy env vars
- Zero frontend tests
- Only Google OAuth for dashboard login
- Agents need to trust a custom CA cert
- No TypeScript/Python SDK

---

### 2. OpenCLI — "Make Any Website Your CLI"

**What it is:** A CLI framework that turns websites into deterministic, scriptable commands. Uses a Chrome extension + local daemon for browser bridge. 101 pre-built site adapters. Zero LLM cost per invocation.

**Architecture highlights:**

- Chrome Manifest V3 extension ↔ WebSocket daemon (port 19825) ↔ CLI
- 6 strategy tiers: PUBLIC → LOCAL → COOKIE → HEADER → INTERCEPT → UI
- Pipeline DSL for declarative API adapters
- CDP bridge for Electron desktop apps (Cursor, ChatGPT, Notion)
- 16,350 stars in 5 weeks

**Strengths:**

1. Massive adapter library (101 sites)
2. Zero-cost deterministic execution
3. Desktop app control (unique capability)
4. Excellent AI agent skill files
5. sysexits.h exit codes

**Weaknesses:**

- Adapter fragility (DOM/API dependent)
- Chrome-only, Node 21+ required
- No credential management or sync
- No SDK

---

### 3. Sigillo — "Nemesis of Your .env Files"

**What it is:** A self-hostable secrets management platform (Doppler alternative) with a Zig CLI. Runs on Cloudflare Workers + D1 at zero cost.

**Architecture highlights:**

- Zig CLI cross-compiled to 6 platforms
- Event-sourced secrets (append-only audit log)
- RFC 8628 Device Authorization Flow for headless auth
- Shannon entropy-based streaming secret redaction

**Strengths:**

1. Secret redaction from process output (novel)
2. Zero-cost self-hosting on Cloudflare
3. Device flow for agents (RFC 8628)
4. Doppler-compatible UX
5. Zig binary — zero deps, instant startup

**Weaknesses:**

- Google-only login
- Zero backend tests
- Cloudflare-only deployment
- Pre-release, breaking backwards compat

---

## Competitive Positioning

```
                    Credential Injection
                           ▲
                           │
                    OneCLI │
                   (proxy) │
                           │
  Secret Storage ◄─────────┼─────────► Browser Automation
                           │
              Sigillo      │      OpenCLI
           (vault/env)     │   (scraping/adapters)
                           │
                           │
                    Sigcli ●
                (auth orchestrator)
                           │
                           ▼
                    Developer CLI
```

**Sigcli's unique position:** We sit at the intersection — we do credential management AND browser automation AND CLI UX. No competitor covers all three.

---

## Action Plan: What We Should Build

### P1 — Quick Wins (Completed ✓)

| #   | Feature                                               | Inspired By | Status                    |
| --- | ----------------------------------------------------- | ----------- | ------------------------- |
| 1   | AI agent SKILL.md + install.sh                        | OpenCLI     | ✓ Merged                  |
| 2   | Shell completion (bash/zsh/fish)                      | OpenCLI     | ✓ Merged                  |
| 3   | Output format flexibility (json/yaml/env/table/plain) | OpenCLI     | ✓ Merged                  |
| 4   | Cascade login (stored → refresh → browser)            | OpenCLI     | ✓ Merged into `sig login` |
| 5   | Semantic exit codes (sysexits.h)                      | OpenCLI     | Pending                   |

### P2 — High Impact

| #   | Feature                                     | Inspired By |
| --- | ------------------------------------------- | ----------- |
| 6   | LLM-friendly structured error messages      | OneCLI      |
| 7   | Secret redaction in `sig request` output    | Sigillo     |
| 8   | Device flow auth (RFC 8628) for headless/CI | Sigillo     |

### P3 — Enterprise Differentiators

| #   | Feature                                                   | Inspired By |
| --- | --------------------------------------------------------- | ----------- |
| 9   | Policy engine (block/rate-limit/approve)                  | OneCLI      |
| 10  | Vault integration (1Password, Bitwarden, HashiCorp Vault) | OneCLI      |

---

## Key Takeaways

1. **AI-first is the battleground.** All three competitors explicitly target AI agents. We need a first-class agent story — SKILL.md and cascade login are a strong start.
2. **Browser automation is our moat.** Only sigcli and OpenCLI do browser automation. Our Playwright adapter pattern is more robust than OpenCLI's Chrome extension approach.
3. **SDK is our unique advantage.** We're the only tool with both TypeScript AND Python SDKs.
4. **All competitors are very young (3-6 weeks).** The market is nascent. Moving fast establishes leadership.
5. **Self-hosting matters.** Our local-first architecture is already self-hosted by default.
6. **Documentation for AI agents is a product feature.** SKILL.md files are "API docs for LLMs."
