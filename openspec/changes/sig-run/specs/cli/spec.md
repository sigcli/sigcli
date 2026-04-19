# Spec: sig run — CLI Command

## Purpose

Credential-injected process execution with output redaction.

## Requirements

### Requirement: Process Spawning

The system SHALL spawn a child process with credentials injected as `SIG_*` environment variables.

#### Scenario: Bearer credential injection

- GIVEN a valid bearer credential for provider "ms-teams"
- WHEN the user runs `sig run --provider ms-teams -- env`
- THEN the child process environment contains `SIG_PROVIDER=ms-teams`
- AND `SIG_CREDENTIAL_TYPE=bearer`
- AND `SIG_TOKEN=<token-value>`
- AND `SIG_AUTH_HEADER=Bearer <token-value>`

#### Scenario: Cookie credential injection

- GIVEN a valid cookie credential for provider "sap-jira" with cookies `session=abc` and `d=xyz`
- WHEN the user runs `sig run --provider sap-jira -- env`
- THEN the child process environment contains `SIG_COOKIE=session=abc; d=xyz`
- AND `SIG_CREDENTIAL_TYPE=cookie`

#### Scenario: Cookie expansion

- GIVEN a valid cookie credential with cookies `session=abc` and `d=xyz`
- WHEN the user runs `sig run --provider x --expand-cookies -- env`
- THEN the child process environment contains `SIG_COOKIE_SESSION=abc`
- AND `SIG_COOKIE_D=xyz`

#### Scenario: API key credential injection

- GIVEN a valid api-key credential with key `ghp_xxxx`, headerName `Authorization`, headerPrefix `Bearer`
- WHEN the user runs `sig run --provider github -- env`
- THEN the child process environment contains `SIG_API_KEY=ghp_xxxx`
- AND `SIG_AUTH_HEADER=Bearer ghp_xxxx`

#### Scenario: Basic credential injection

- GIVEN a valid basic credential with username `admin` and password `secret`
- WHEN the user runs `sig run --provider my-api -- env`
- THEN the child process environment contains `SIG_USERNAME=admin`
- AND `SIG_PASSWORD=secret`
- AND `SIG_AUTH_HEADER=Basic YWRtaW46c2VjcmV0`

#### Scenario: xHeaders injection

- GIVEN a credential with xHeaders `{ "x-csrf-token": "abc123" }`
- WHEN the user runs `sig run --provider x -- env`
- THEN the child process environment contains `SIG_HEADER_X_CSRF_TOKEN=abc123`

#### Scenario: localStorage injection

- GIVEN a credential with localStorage `{ "token": "xoxc-xxx" }`
- WHEN the user runs `sig run --provider x -- env`
- THEN the child process environment contains `SIG_LOCAL_TOKEN=xoxc-xxx`

---

### Requirement: Exit Code Pass-Through

The system MUST pass through the child process exit code as its own exit code.

#### Scenario: Child exits with code 42

- GIVEN a valid credential
- WHEN the user runs `sig run --provider x -- sh -c 'exit 42'`
- THEN the sig process exits with code 42

#### Scenario: Child exits with code 0

- GIVEN a valid credential
- WHEN the user runs `sig run --provider x -- true`
- THEN the sig process exits with code 0

---

### Requirement: Output Redaction

The system SHALL redact known credential values from child process stdout and stderr by default.

#### Scenario: Token appears in child stdout

- GIVEN a bearer credential with token `eyJhbGciOiJSUzI1NiJ9`
- WHEN the child process prints the token to stdout
- THEN the output shows `****` instead of the token value

#### Scenario: Multiple secrets in output

- GIVEN a cookie credential with cookies `session=abcdef123456` and `d=longcookievalue99`
- WHEN the child process prints both values
- THEN both are replaced with `****`

#### Scenario: Short values are not redacted

- GIVEN a credential with a cookie value `abc` (less than 8 chars)
- WHEN the child process prints `abc`
- THEN the output shows `abc` unchanged

#### Scenario: Redaction notice

- GIVEN redaction is active and a secret is redacted
- WHEN the first redaction occurs
- THEN stderr shows `[sig] Credential values redacted. Use --no-redaction to disable.`

#### Scenario: Disable redaction

- GIVEN a valid credential
- WHEN the user runs `sig run --provider x --no-redaction -- <command>`
- THEN output is passed through without any redaction

---

### Requirement: Credential Cascade (Non-Interactive)

The system MUST check stored credentials and attempt refresh, but MUST NOT open a browser.

#### Scenario: Valid stored credential

- GIVEN a valid stored credential for provider "sap-jira"
- WHEN the user runs `sig run --provider sap-jira -- <command>`
- THEN the credential is used without any auth flow

#### Scenario: Expired credential with refresh

- GIVEN an expired credential that can be refreshed
- WHEN the user runs `sig run --provider x -- <command>`
- THEN the credential is refreshed and used

#### Scenario: No credential available

- GIVEN no stored credential for provider "nonexistent"
- WHEN the user runs `sig run --provider nonexistent -- echo hello`
- THEN the command fails with error message
- AND the error suggests `sig login <url>` first
- AND no browser is opened

---

### Requirement: Mount Mode

The system SHOULD support writing credentials to a file instead of environment variables.

#### Scenario: Mount as env file

- GIVEN a valid credential
- WHEN the user runs `sig run --provider x --mount .env -- <command>`
- THEN a file `.env` is created with `SIG_*=value` lines before the child starts
- AND the file is deleted after the child exits

#### Scenario: Mount as JSON file

- GIVEN a valid credential
- WHEN the user runs `sig run --provider x --mount creds.json --mount-format json -- <command>`
- THEN a file `creds.json` is created with a JSON object of `SIG_*` keys
- AND the file is deleted after the child exits

#### Scenario: Mount file cleanup on signal

- GIVEN a mount file exists and the child is running
- WHEN SIGINT or SIGTERM is received
- THEN the mount file is deleted
- AND the signal is forwarded to the child process

---

### Requirement: Error Handling

The system MUST provide clear errors for missing arguments.

#### Scenario: No provider specified

- GIVEN no `--provider` flag
- WHEN the user runs `sig run -- echo hello`
- THEN the command fails with usage error

#### Scenario: No command after --

- GIVEN a valid provider
- WHEN the user runs `sig run --provider x`
- THEN the command fails with usage error
