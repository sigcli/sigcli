# SigCLI Improvements

Collected from real-world usage of `sig` with SAP systems (Jira, Wiki, Teams, Grafana, BDC Cockpit, HANA canary landscapes).

---

## 1. Device Code OAuth2 Strategy (RFC 8628)

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

## 2. "Did You Mean?" Suggestions

**Problem**: `sig get unknown-provider` → hard error. No suggestion of similar provider names.

**Proposed**: On `ProviderNotFoundError`, compute Levenshtein distance against known IDs/names and suggest the closest match:

```
Error: No provider found matching "sap-jra".
Did you mean: sap-jira?
```

---

## 4. Windows Browser Detection

**Problem**: `src/browser/detect.ts` line 41: `// Windows or unknown -- cannot detect, assume null`. `sig doctor` and `sig init` cannot auto-detect browsers on Windows.

**Where**: `src/browser/detect.ts` — add `win32` platform handling.

**Proposed**: Check known Windows installation paths (`Program Files/Google/Chrome/Application/chrome.exe`, Edge paths, etc.) and/or Windows registry queries.

---

## 5. Programmatic API Documentation

**Problem**: `src/index.ts` exports a comprehensive public API (AuthManager, strategies, storage) but has no JSDoc examples. No "Programmatic Usage" section in README.

**Proposed**: Add `@example` JSDoc annotations to key exports and a README section showing how to use sigcli as a library (not just CLI).

---

## 6. `sig doctor` Enhancements

**Current**: Checks basic environment (browser availability, config file).

**Proposed additions**:

- Verify all `entryUrl` values are reachable (HTTP HEAD with timeout)
- Detect duplicate domains across providers
- Warn about auto-provisioned providers that could be merged (same subdomain pattern)
- Check for orphaned credential files with no matching config entry

---

## Priority

| #   | Improvement                 | Impact | Effort |
| --- | --------------------------- | ------ | ------ |
| 1   | Device Code OAuth2 strategy | High   | Medium |
| 2   | "Did you mean?" suggestions | Medium | Small  |
| 4   | Windows browser detection   | Medium | Small  |
| 5   | Programmatic API docs       | Medium | Small  |
| 6   | `sig doctor` enhancements   | Low    | Medium |
