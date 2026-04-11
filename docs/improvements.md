# Signet Improvements

Collected from real-world usage of `sig` with SAP systems (Jira, Wiki, Teams, Grafana, BDC Cockpit, HANA canary landscapes).

---

## 1. Smarter Auto-Provisioned Provider IDs

**Problem**: `sig login <url>` uses the full hostname as the provider ID. For SAP URLs this produces IDs like `bdc-cockpit-starkiller-hc-uclformation-ga.starkiller.hanacloudservices.cloud.sap` — too long for `sig status` tables, hard to type, and clutters `config.yaml`.

**Where**: `src/providers/auto-provision.ts` — `createDefaultProvider()` sets `id: hostname`.

**Proposed behavior**: Derive a short, human-friendly ID from the hostname. Keep the full hostname in `name` and `domains`.

```typescript
function deriveShortId(hostname: string): string {
  const parts = hostname.split('.');
  const firstSegment = parts[0];

  if (firstSegment.length >= 8) {
    return firstSegment;
  }

  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1]}`;
  }

  return firstSegment;
}
```

**Collision handling**: If the derived ID already exists in the provider registry, append `-2`, `-3`, etc.

---

## 7. `sig doctor` Enhancements

**Current**: Checks basic environment (browser availability, config file).

**Proposed additions**:

- Verify all `entryUrl` values are reachable (HTTP HEAD with timeout)
- Detect duplicate domains across providers
- Warn about auto-provisioned providers that could be merged (same subdomain pattern)
- Check for orphaned credential files with no matching config entry

---

## 10. Shell Completions

**Problem**: Provider IDs are hard to remember and type. No tab completion support.

**Proposed**: Generate bash/zsh/fish completions:

- `sig login <TAB>` → list provider IDs
- `sig get <TAB>` → list provider IDs
- `sig status <TAB>` → list provider IDs

Implement via `sig completions bash|zsh|fish` that outputs the completion script.

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

## 18. Windows Browser Detection

**Problem**: `src/browser/detect.ts` line 41: `// Windows or unknown -- cannot detect, assume null`. `sig doctor` and `sig init` cannot auto-detect browsers on Windows.

**Where**: `src/browser/detect.ts` — add `win32` platform handling.

**Proposed**: Check known Windows installation paths (`Program Files/Google/Chrome/Application/chrome.exe`, Edge paths, etc.) and/or Windows registry queries.

---

## 19. Encrypted Credential Storage

**Problem**: Credentials stored as plain JSON in `~/.signet/credentials/`. Even with 0o600 permissions, root or backup processes can read them.

**Proposed**: New `EncryptedStorage` decorator (wrapping `DirectoryStorage`, like `CachedStorage`) that AES-256-GCM encrypts credentials before writing to disk. Encryption key stored in OS keychain (via `keytar` or Node.js `crypto`).

**Key files**: New `src/storage/encrypted-storage.ts`, `src/deps.ts` (wire decorator), `src/config/schema.ts` (add `encryption` config).

**Complexity**: Large — requires keychain integration, migration path for existing unencrypted creds.

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

| #   | Improvement                  | Impact | Effort |
| --- | ---------------------------- | ------ | ------ |
| 1   | Smarter auto-provisioned IDs | High   | Small  |

### Tier 2: Polish (Small effort, Medium impact)

| #   | Improvement                     | Impact | Effort |
| --- | ------------------------------- | ------ | ------ |
| 8   | "Did you mean?" suggestions     | Medium | Small  |
| 22  | Hardcoded version in User-Agent | Low    | Small  |

### Tier 3: Medium Features

| #   | Improvement                 | Impact | Effort |
| --- | --------------------------- | ------ | ------ |
| 16  | Device Code OAuth2 strategy | High   | Medium |
| 10  | Shell completions           | Medium | Medium |
| 18  | Windows browser detection   | Medium | Small  |
| 21  | Programmatic API docs       | Medium | Small  |

### Tier 4: Large Investments

| #   | Improvement                  | Impact | Effort |
| --- | ---------------------------- | ------ | ------ |
| 19  | Encrypted credential storage | High   | Large  |
| 7   | `sig doctor` enhancements    | Low    | Medium |
