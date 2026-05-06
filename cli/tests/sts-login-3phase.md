# STS: sig login 3-Phase Validation Refactor

## Scope

Validates the refactored `sig login` flow:

- 3-phase cascade: `tryExistingState` → `tryHeadless` → `tryVisible`
- Single `validate()` function as success signal
- No cache layer — always extracts from browser

---

## Test Matrix

### 1. validate() Function

| ID   | Scenario                                      | Precondition                                                                     | Action                      | Expected                                                  |
| ---- | --------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------- |
| V-01 | Required fields present, no expiry            | Provider: `required: [cookie.ct0]`, cookie ct0 exists                            | `validate(provider, creds)` | `true`                                                    |
| V-02 | Required field missing                        | Provider: `required: [cookie.ct0]`, cookie ct0 absent                            | `validate(provider, creds)` | `false`                                                   |
| V-03 | Required field present but expired            | Provider: `required: [access_token]`, token has `expiresJsonPath`, value expired | `validate(provider, creds)` | `true` (expiry check is at extractor level, not validate) |
| V-04 | SSO site — redirect to login                  | Provider: no required, apply+entryUrl set. Server returns 302 → /login           | `validate(provider, creds)` | `false`                                                   |
| V-05 | SSO site — no redirect (valid)                | Provider: no required, apply+entryUrl set. Server returns 200                    | `validate(provider, creds)` | `true`                                                    |
| V-06 | SSO site — network error                      | fetch throws                                                                     | `validate(provider, creds)` | `true` (optimistic)                                       |
| V-07 | Empty credentials                             | `credentials = {}`                                                               | `validate(provider, creds)` | `false`                                                   |
| V-08 | No required, no apply (impossible per config) | Edge case                                                                        | `validate(provider, creds)` | `true` (any non-empty)                                    |

---

### 2. tryExistingState

| ID   | Scenario                                  | Precondition                                  | Expected                                                                  |
| ---- | ----------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| E-01 | Fresh session cookies in browser data dir | Previously logged into jira.tools.sap         | Extracts cookies → validate passes → returns ExtractionResult             |
| E-02 | Expired/stale cookies in data dir         | SSO session expired, cookies still in browser | Extracts cookies → validate (redirect check) returns false → returns null |
| E-03 | No browser installed                      | `execPath` is null                            | Returns null immediately                                                  |
| E-04 | Browser data dir empty                    | First-time use, no cookies                    | Extracts empty → validate fails → returns null                            |
| E-05 | CDP port unavailable                      | All ports busy                                | Returns null                                                              |
| E-06 | Timeout (browser slow to start)           | Browser takes >5s to respond                  | Returns null (caught)                                                     |

---

### 3. tryHeadless

| ID   | Scenario                                 | Precondition                                       | Provider                                 | Expected                                                                     |
| ---- | ---------------------------------------- | -------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| H-01 | SSO auto-completes (silent)              | Valid IDP session exists                           | jira.tools.sap (no required)             | Navigates → SSO redirects → cookies set → validate passes → returns result   |
| H-02 | SSO session expired, lands on login page | No valid IDP session                               | jira.tools.sap (no required)             | Navigates → lands on IDP login → login page settles >5s → returns null       |
| H-03 | SSO transient hop through login URL      | Valid session, SSO passes through /adfs/ls briefly | sap-cats                                 | Navigates → passes /adfs/ls → continues → cookies set → validate passes      |
| H-04 | Public site, required cookies not set    | Not logged in                                      | reddit (required: cookie.reddit_session) | Navigates → no session cookies → validate fails → returns null after timeout |
| H-05 | Network proxy configured                 | `networkProxy: socks5://...`                       | reddit                                   | Browser launched with `--proxy-server=...`, navigation uses proxy            |
| H-06 | Timeout (30s)                            | SSO hangs                                          | any                                      | Returns null after headlessTimeout                                           |

---

### 4. tryVisible

| ID     | Scenario                     | Precondition                          | Provider | Expected                                                   |
| ------ | ---------------------------- | ------------------------------------- | -------- | ---------------------------------------------------------- |
| VIS-01 | User completes login         | User enters credentials, MFA          | reddit   | Polls → detects cookies → validate passes → returns result |
| VIS-02 | User completes SSO           | User clicks "approve" on consent page | ms-teams | Polls → localStorage token appears → validate passes       |
| VIS-03 | Timeout — user doesn't login | User leaves browser idle              | any      | Polls for visibleTimeout → returns BrowserTimeoutError     |
| VIS-04 | No browser installed         | `execPath` null                       | any      | Returns BrowserError                                       |
| VIS-05 | SIGINT during visible        | User presses Ctrl+C                   | any      | Cleanup runs, browser released, process exits 130          |
| VIS-06 | Browser crashes mid-poll     | CDP connection drops                  | any      | Returns BrowserError                                       |

---

### 5. Mode Routing (extract entry point)

| ID   | Mode     | Existing valid? | Headless valid? | Expected path                                          |
| ---- | -------- | --------------- | --------------- | ------------------------------------------------------ |
| M-01 | auto     | yes             | —               | tryExistingState succeeds, returns                     |
| M-02 | auto     | no              | yes             | tryExistingState fails → tryHeadless succeeds, returns |
| M-03 | auto     | no              | no              | tryExistingState → tryHeadless → tryVisible            |
| M-04 | headless | no              | no              | tryExistingState → tryHeadless → BrowserError          |
| M-05 | headless | yes             | —               | tryExistingState succeeds, returns                     |
| M-06 | visible  | —               | —               | Skips existing/headless, goes straight to tryVisible   |

---

### 6. Login Command (login.ts)

| ID   | Scenario                   | Flags                                           | Expected                                               |
| ---- | -------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| L-01 | First-time login           | `sig login https://jira.tools.sap`              | Auto-provisions → 3-phase → stores creds → JSON output |
| L-02 | Re-login existing provider | `sig login jira-tools`                          | Resolves provider → 3-phase → stores → output          |
| L-03 | Force flag (no-op now)     | `sig login jira-tools --force`                  | Same as L-02 (force always true internally)            |
| L-04 | Rename with --as           | `sig login https://x.com --as twitter`          | Auto-provisions → renames → 3-phase → stores           |
| L-05 | No browser available       | browserless mode                                | Error: "Browser is not available..."                   |
| L-06 | Network proxy flag         | `sig login reddit --network-proxy socks5://...` | Proxy applied to provider config                       |
| L-07 | Mode flag                  | `sig login jira --mode visible`                 | Skips existing/headless, goes to visible               |
| L-08 | Auth failure               | Browser timeout on all phases                   | Exit code 1, error message, audit log                  |

---

### 7. Login Page Debounce (Phase 2 early exit)

| ID   | Scenario                         | URL Sequence                                          | Expected                               |
| ---- | -------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| D-01 | Settled on login page            | `/login` for 6 seconds                                | Returns null after 5s settle           |
| D-02 | Transient login hop              | `/login` → `/consent` → `/app` (within 3s)            | Does NOT exit early, continues polling |
| D-03 | Multiple hops through login URLs | `/adfs/ls` (2s) → `/saml/sso` (2s) → `/app`           | Each hop resets timer, no early exit   |
| D-04 | Custom loginUrlPatterns          | Provider has `loginUrlPatterns: ["/my-custom-login"]` | Custom pattern included in detection   |

---

### 8. Credential Storage (post-login)

| ID   | Scenario                           | Expected                                                                     |
| ---- | ---------------------------------- | ---------------------------------------------------------------------------- |
| S-01 | Successful login                   | StoredCredential written: providerId, strategy, updatedAt, values, expiresAt |
| S-02 | ExpiresAt computed from cookies    | `expiresAt` = min(cookie expires timestamps, excluding tracking cookies)     |
| S-03 | ExpiresAt from localStorage (MSAL) | `expiresAt` from `expiresJsonPath` field in extraction                       |
| S-04 | No expiry info available           | `expiresAt` = undefined (omitted)                                            |
| S-05 | TTL fallback for session cookies   | Session cookies (expires=-1) use provider.ttl for expiresAt computation      |

---

### 9. Real Provider Scenarios

| ID   | Provider        | Category                                            | Expected Flow                                                                                 |
| ---- | --------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| R-01 | jira-tools      | SSO, no required                                    | tryExisting (if fresh) OR tryHeadless (SSO auto) → validate via redirect                      |
| R-02 | wiki-one        | SSO, no required                                    | Same as R-01                                                                                  |
| R-03 | sap-cats        | SSO, no required                                    | Same — SAP Launchpad SSO                                                                      |
| R-04 | reddit          | Public, required                                    | tryExisting → tryHeadless (fails, public) → tryVisible → user logs in → validate via required |
| R-05 | x               | Public, required, proxy                             | Same as R-04 but with networkProxy                                                            |
| R-06 | ms-teams        | localStorage token                                  | tryExisting (if MSAL token fresh) OR tryHeadless → validate via required                      |
| R-07 | app-slack       | Mixed (cookies + localStorage)                      | tryExisting → validate checks session.d + xoxc-token → done or cascade                        |
| R-08 | grafana-ingress | SSO, loginMode=visible                              | Skips existing/headless → tryVisible directly                                                 |
| R-09 | hackernews      | Public, required, proxy, session cookie (no expiry) | tryExisting → validate checks cookie.user exists → no expiry to reject                        |

---

## Edge Cases

| ID    | Scenario                                         | Expected                                                         |
| ----- | ------------------------------------------------ | ---------------------------------------------------------------- |
| EC-01 | Browser singleton lock exists                    | `removeSingletonLock` clears it before spawn                     |
| EC-02 | CDP already in use (port conflict)               | `findFreePort` retries or returns null → cascade continues       |
| EC-03 | Provider entryUrl is HTTPS with self-signed cert | Browser may reject — tryHeadless fails → tryVisible              |
| EC-04 | Very slow network                                | Validate HTTP probe times out → returns null → accept optimistic |
| EC-05 | Cookie value is extremely large (>4KB)           | Extraction succeeds, stored as-is                                |
| EC-06 | Multiple extract rules, one fails                | Failed rule skipped, others continue                             |
| EC-07 | validate() called with null credentials          | Returns false                                                    |

---

## Manual Testing Checklist

```bash
# SSO site — should auto-complete in tryHeadless
SIG_LOG=debug sig login jira-tools

# Public site — needs visible (user interaction)
SIG_LOG=debug sig login reddit

# Token-based — tryExisting should work if recent
SIG_LOG=debug sig login ms-teams

# Force visible mode
SIG_LOG=debug sig login jira-tools --mode visible

# Verify stored after login
sig status jira-tools

# Verify credentials usable
sig get jira-tools
sig request https://jira.tools.sap/rest/api/2/myself
```
