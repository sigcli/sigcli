# Signet Improvements

Collected from real-world usage of `sig` with SAP systems (Jira, Wiki, Teams, Grafana, BDC Cockpit, HANA canary landscapes).

---

## 1. Smarter Auto-Provisioned Provider IDs

**Problem**: `sig login <url>` uses the full hostname as the provider ID. For SAP URLs this produces IDs like `bdc-cockpit-starkiller-hc-uclformation-ga.starkiller.hanacloudservices.cloud.sap` — too long for `sig status` tables, hard to type, and clutters `config.yaml`.

**Where**: `src/providers/auto-provision.ts` — `createDefaultProvider()` sets `id: hostname`.

**Proposed behavior**: Derive a short, human-friendly ID from the hostname. Keep the full hostname in `name` and `domains`.

```typescript
function deriveShortId(hostname: string): string {
  const parts = hostname.split(".");
  // Most SAP URLs: the first segment is already descriptive
  //   bdc-cockpit-starkiller-hc-ga.starkiller.hanacloudservices.cloud.sap → bdc-cockpit-starkiller-hc-ga
  //   hana-e2e-bdc.master.canary.eu10.projectorca.cloud → hana-e2e-bdc
  //   jira.tools.sap → jira-tools-sap (too short, keep more)
  const firstSegment = parts[0];

  // If the first segment is already unique enough (>= 8 chars), use it
  if (firstSegment.length >= 8) {
    return firstSegment;
  }

  // Otherwise join first two segments
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1]}`;
  }

  return firstSegment;
}
```

**Collision handling**: If the derived ID already exists in the provider registry, append `-2`, `-3`, etc.

---

## 2. `sig login --as <id> <url>`

**Problem**: No way to specify a custom provider ID at login time. Users must edit `config.yaml` after the fact to rename auto-provisioned entries.

**Proposed**: Add `--as` flag to `sig login`:

```bash
sig login --as bdc-starkiller https://bdc-cockpit-starkiller-hc-ga.starkiller.hanacloudservices.cloud.sap/
```

**Where**: `src/cli/commands/login.ts` — after resolving the provider, override `provider.id` if `--as` is provided.

---

## 3. `sig rename <old-id> <new-id>`

**Problem**: Renaming a provider requires manually editing `config.yaml` AND renaming the credential file in `~/.signet/credentials/`. Error-prone.

**Proposed**: New CLI command that atomically:

1. Updates the provider key in `config.yaml`
2. Renames `credentials/<old-id>.json` to `credentials/<new-id>.json`
3. Updates the `providerId` field inside the credential JSON

---

## ~~4. Truncated Table Output in `sig status`~~ DONE

ID column capped at 30 chars with `…` truncation. Default view shows only `ID | STRATEGY | STATUS | EXPIRES` — dropped redundant `name` and `type` columns.

---

## ~~5. Human-Readable Expiry in `sig status`~~ DONE

`formatExpiry()` in `src/cli/formatters.ts`: `45m` / `5h` / `12d` / `2mo`.

---

## ~~6. Color / Status Indicators~~ DONE

Green `✓` (valid), red `✗` (expired), dim `—` (no credential). TTY-aware, ANSI-safe width calculation in `formatTable`.

---

## 7. `sig doctor` Enhancements

**Current**: Checks basic environment (browser availability, config file).

**Proposed additions**:

- Verify all `entryUrl` values are reachable (HTTP HEAD with timeout)
- Detect duplicate domains across providers
- Warn about auto-provisioned providers that could be merged (same subdomain pattern)
- Check for orphaned credential files with no matching config entry

---

## ~~9. CLI Help & Command Documentation~~ DONE

Help output grouped by resource (Provider / Remote / Setup), tagline added.

---

## 10. Shell Completions

**Problem**: Provider IDs are hard to remember and type. No tab completion support.

**Proposed**: Generate bash/zsh/fish completions:

- `sig login <TAB>` → list provider IDs
- `sig get <TAB>` → list provider IDs
- `sig status <TAB>` → list provider IDs

Implement via `sig completions bash|zsh|fish` that outputs the completion script.

---

## ~~11. `sig remove <provider>` — Full Provider Deletion~~ DONE

`sig remove` command with multi-provider support, `--force`, `--keep-config`, confirmation prompt. Uses `YAML.parseDocument()` to preserve comments when removing from config.

---

## ~~12. Multiple `--header` Flags in `sig request`~~ DONE

Arg parser accumulates repeated flags into arrays. `request.ts` iterates all `--header` values.

---

## ~~13. Credential File Permissions (0o600)~~ DONE

`DirectoryStorage` now uses `mode: 0o600` for credential files and lock files, `mode: 0o700` for directories.

---

## ~~14. `--verbose` / `--debug` Global Flag~~ DONE

`--verbose` global flag creates a console-based logger via `createConsoleLogger()` in `deps.ts`, piped through the dependency graph.

---

## 15. `sig renew` Command

**Problem**: Credentials are only refreshed lazily during `getCredentials`. No way to proactively renew before an AI agent workflow or batch job starts. If a credential expires mid-workflow, the agent is blocked.

**Where**: New command. Infrastructure exists — `AuthManager.getCredentials` already does validate→refresh→authenticate.

**Proposed**: `sig renew [provider]` iterates providers and calls the refresh path, reporting results. Useful as a cron job or pre-flight check:

```bash
sig renew              # Renew all expiring credentials
sig renew jira         # Renew specific provider
sig renew --dry-run    # Show what would be renewed
```

---

## 16. Device Code OAuth2 Strategy (RFC 8628)

**Problem**: On headless/remote machines, the only browserless auth options are manual `--token` or `--cookie` flags. No interactive-but-browserless OAuth2 flow.

**Proposed**: New `device-code` strategy implementing the OAuth2 Device Authorization Grant. Requests a device code from the authorization server, prints a URL + user code, then polls the token endpoint until the user completes auth on any device. Many enterprise identity providers support this flow.

```yaml
providers:
  my-api:
    strategy: device-code
    config:
      authorizationEndpoint: https://idp.example.com/device/authorize
      tokenEndpoint: https://idp.example.com/oauth/token
      clientId: my-client-id
      scopes: [openid, profile]
```

**Key files**: New `src/strategies/device-code.strategy.ts`, update `src/core/types.ts`, `src/config/validator.ts`, `src/deps.ts`.

---

## ~~17. `sig doctor` Bug Fix: `cred?.token` Check~~ DONE

Fixed `cred?.token` → `cred?.accessToken` in `src/cli/commands/doctor.ts`.

---

## 18. Windows Browser Detection

**Problem**: `src/browser/detect.ts` line 41: `// Windows or unknown -- cannot detect, assume null`. `sig doctor` and `sig init` cannot auto-detect browsers on Windows.

**Where**: `src/browser/detect.ts` — add `win32` platform handling.

**Proposed**: Check known Windows installation paths (`Program Files/Google/Chrome/Application/chrome.exe`, Edge paths, etc.) and/or Windows registry queries.

---

## 19. Encrypted Credential Storage

**Problem**: Credentials stored as plain JSON in `~/.signet/credentials/`. Even with 0o600 permissions (#13), root or backup processes can read them.

**Proposed**: New `EncryptedStorage` decorator (wrapping `DirectoryStorage`, like `CachedStorage`) that AES-256-GCM encrypts credentials before writing to disk. Encryption key stored in OS keychain (via `keytar` or Node.js `crypto`).

**Key files**: New `src/storage/encrypted-storage.ts`, `src/deps.ts` (wire decorator), `src/config/schema.ts` (add `encryption` config).

**Complexity**: Large — requires keychain integration, migration path for existing unencrypted creds.

---

## 20. `sig export` / `sig import` Commands

**Problem**: `sig sync` requires SSH between machines. No file-based transfer for air-gapped networks, USB drives, or pasting through chat.

**Proposed**: Export credentials as an encrypted bundle (AES-256-GCM with user passphrase), import on another machine:

```bash
sig export --provider jira --out creds.enc   # Encrypted export
sig import creds.enc                          # Decrypt and store
```

**Dependencies**: Benefits from #19 (encrypted storage) for shared encryption primitives.

---

## 21. Programmatic API Documentation

**Problem**: `src/index.ts` exports a comprehensive public API (AuthManager, strategies, storage) but has no JSDoc examples. No "Programmatic Usage" section in README.

**Proposed**: Add `@example` JSDoc annotations to key exports and a README section showing how to use signet as a library (not just CLI).

---

## 22. Hardcoded Version in User-Agent

**Problem**: `src/utils/http.ts` — `buildUserAgent()` hardcodes `signet/1.0.0` but `package.json` is at `1.1.0`.

**Proposed**: Read version dynamically from `package.json` or a build-time generated constant.

---

## Priority

### Tier 1: Quick Wins (Small effort, High impact)

| #   | Improvement                         | Impact | Effort | Status |
| --- | ----------------------------------- | ------ | ------ | ------ |
| 1   | Smarter auto-provisioned IDs        | High   | Small  |        |
| 2   | `--as` flag for login               | High   | Small  | DONE   |
| 11  | `sig remove` command                | High   | Small  | DONE   |
| 12  | Multiple `--header` flags           | High   | Small  | DONE   |
| 13  | Credential file permissions (0o600) | High   | Small  | DONE   |
| 14  | `--verbose` / `--debug` flag        | High   | Small  | DONE   |
| 15  | `sig renew` command                 | High   | Small  |        |
| 9   | CLI help & command docs             | High   | Small  | DONE   |

### Tier 2: Polish (Small effort, Medium impact)

| #   | Improvement                     | Impact | Effort |
| --- | ------------------------------- | ------ | ------ |
| 8   | "Did you mean?" suggestions     | Medium | Small  |
| 22  | Hardcoded version in User-Agent | Low    | Small  |

### Tier 3: Medium Features

| #   | Improvement                 | Impact | Effort |
| --- | --------------------------- | ------ | ------ |
| 3   | `sig rename` command        | High   | Medium |
| 16  | Device Code OAuth2 strategy | High   | Medium |
| 10  | Shell completions           | Medium | Medium |
| 18  | Windows browser detection   | Medium | Small  |
| 20  | `sig export` / `sig import` | Medium | Medium |
| 21  | Programmatic API docs       | Medium | Small  |

### Tier 4: Large Investments

| #   | Improvement                  | Impact | Effort |
| --- | ---------------------------- | ------ | ------ |
| 19  | Encrypted credential storage | High   | Large  |
| 7   | `sig doctor` enhancements    | Low    | Medium |
