---
name: jira
description: "Interact with Jira — search, create, update, and manage issues, sprints, boards, and more via sig-authenticated HTTP requests. Use this skill whenever the user mentions Jira issues (e.g. PROJ-1234, PROJ-999, MYPROJ-567, MYPROJ-5678), wants to search/create/update Jira tickets, check sprint status, look up issue details, manage boards, or do anything involving Jira. Also trigger when the user references ticket IDs, JQL queries, sprint planning, or asks about their assigned issues. Even if the user just pastes a Jira key like 'PROJ-1234' or 'MYPROJ-123' and asks a question about it, use this skill."
---

# Jira

Interact with Jira — search, create, update, and manage issues, sprints, boards, and more.

Uses `sig request` for authenticated API calls. No MCP server needed.

## Configuration

Configure your Jira provider in `~/.sig/config.yaml`:

```yaml
providers:
    jira:
        url: https://<your-jira-domain>
        strategy: browser-cookie
```

Then authenticate: `sig login https://<your-jira-domain>/`

## Authentication

All requests go through sig which handles cookie injection automatically.

**For read operations (GET):**

```bash
sig request "https://<your-jira-domain>/rest/api/2/..." --format body
```

**For write operations (POST/PUT/DELETE) — include CSRF headers:**

```bash
sig request "https://<your-jira-domain>/rest/api/2/..." \
  --method POST \
  --header "Content-Type: application/json" \
  --header "X-Requested-With: XMLHttpRequest" \
  --header "Origin: https://<your-jira-domain>" \
  --header "Referer: https://<your-jira-domain>/" \
  --body '{"fields": {...}}' \
  --format body
```

**If auth fails (401/403 or login redirect):**

1. Run `sig login https://<your-jira-domain>/` to re-authenticate
2. Retry the original request

## API Endpoints Reference

**Base URLs:**

- REST API v2: `https://<your-jira-domain>/rest/api/2/`
- Agile API v1: `https://<your-jira-domain>/rest/agile/1.0/`

### Issues

| Operation                   | Method | URL                                                                                                            |
| --------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| Search                      | GET    | `/rest/api/2/search?jql={jql}&maxResults=50&fields=summary,status,assignee,priority,issuetype,created,updated` |
| Get issue                   | GET    | `/rest/api/2/issue/{key}`                                                                                      |
| Get issue (specific fields) | GET    | `/rest/api/2/issue/{key}?fields=summary,status,assignee,description`                                           |
| Create issue                | POST   | `/rest/api/2/issue` with body `{"fields": {...}}`                                                              |
| Update issue                | PUT    | `/rest/api/2/issue/{key}` with body `{"fields": {...}}`                                                        |
| Delete issue                | DELETE | `/rest/api/2/issue/{key}`                                                                                      |

### Comments

| Operation      | Method | URL                                                            |
| -------------- | ------ | -------------------------------------------------------------- |
| Add comment    | POST   | `/rest/api/2/issue/{key}/comment` with body `{"body": "text"}` |
| Delete comment | DELETE | `/rest/api/2/issue/{key}/comment/{commentId}`                  |

### Users

| Operation        | Method | URL                                        |
| ---------------- | ------ | ------------------------------------------ |
| Search users     | GET    | `/rest/api/2/user/search?username={query}` |
| Get current user | GET    | `/rest/api/2/myself`                       |

**Profile enrichment:** When you call `/rest/api/2/myself`, persist the Jira username to `memory/user-profile.md` (see `CLAUDE.md`). Check the profile first to avoid redundant calls.

### Fields & Metadata

| Operation               | Method | URL                                                                  |
| ----------------------- | ------ | -------------------------------------------------------------------- |
| List all fields         | GET    | `/rest/api/2/field`                                                  |
| Issue types for project | GET    | `/rest/api/2/issue/createmeta/{projectKey}/issuetypes`               |
| Fields for issue type   | GET    | `/rest/api/2/issue/createmeta/{projectKey}/issuetypes/{issueTypeId}` |

### Transitions (Status Changes)

| Operation          | Method | URL                                                                           |
| ------------------ | ------ | ----------------------------------------------------------------------------- |
| Get transitions    | GET    | `/rest/api/2/issue/{key}/transitions`                                         |
| Execute transition | POST   | `/rest/api/2/issue/{key}/transitions` with body `{"transition": {"id": "X"}}` |

To change status: first GET transitions to find the transition ID, then POST it.

### Sprints

| Operation            | Method | URL                                                                           |
| -------------------- | ------ | ----------------------------------------------------------------------------- |
| Move issue to sprint | POST   | `/rest/agile/1.0/sprint/{sprintId}/issue` with body `{"issues": ["KEY-123"]}` |
| Get sprint issues    | GET    | `/rest/agile/1.0/sprint/{sprintId}/issue?maxResults=50`                       |

### Boards (Agile API)

| Operation     | Method | URL                                                                |
| ------------- | ------ | ------------------------------------------------------------------ |
| List boards   | GET    | `/rest/agile/1.0/board?projectKeyOrId={project}&maxResults=50`     |
| Get board     | GET    | `/rest/agile/1.0/board/{boardId}`                                  |
| Board config  | GET    | `/rest/agile/1.0/board/{boardId}/configuration`                    |
| Board issues  | GET    | `/rest/agile/1.0/board/{boardId}/issue?maxResults=50`              |
| Board sprints | GET    | `/rest/agile/1.0/board/{boardId}/sprint?state=active`              |
| Active sprint | GET    | `/rest/agile/1.0/board/{boardId}/sprint?state=active&maxResults=1` |

### Attachments

| Operation         | Method | URL                                         |
| ----------------- | ------ | ------------------------------------------- |
| List attachments  | GET    | `/rest/api/2/issue/{key}?fields=attachment` |
| Delete attachment | DELETE | `/rest/api/2/attachment/{attachmentId}`     |

**Upload attachment** — requires multipart form-data (not possible via `sig request`). Use `sig run` with curl:

```bash
sig run jira -- bash -c 'curl -X POST "https://<your-jira-domain>/rest/api/2/issue/{key}/attachments" \
  -H "Cookie: $SIG_JIRA_COOKIE" \
  -H "X-Atlassian-Token: no-check" \
  -H "X-Requested-With: XMLHttpRequest" \
  -F "file=@/path/to/file"'
```

The env var name follows the rule: `SIG_<PROVIDER>_COOKIE` where `<PROVIDER>` is the provider name uppercased with `-` replaced by `_`.

## Field Mappings & Issue Templates

Jira uses custom field IDs (e.g., `customfield_12740` for Sprint) and project-specific issue templates with default values.

Read `references/field-mappings.md` for:

- Custom field ID mappings (Sprint, Epic Link, Story Points, etc.)
- Field value format rules (options, cascading options, arrays, etc.)

Read `references/issue-templates.md` for:

- Pre-configured issue templates per project (MYPROJ, PROJ)
- Default field values for each issue type (Test, Epic, Story, Bug, etc.)

When creating issues, always check the templates first — they save the user from having to specify every field.

## JQL Reference

### Common Patterns

```
# My open issues
assignee = currentUser() AND status != Closed ORDER BY updated DESC

# Issues in project
project = MYPROJ AND status = "In Progress" ORDER BY priority DESC

# Created recently
project = MYPROJ AND created >= -7d ORDER BY created DESC

# Text search
project = MYPROJ AND summary ~ "keyword" ORDER BY updated DESC

# Sprint issues
project = MYPROJ AND sprint = "My Sprint 1" ORDER BY priority DESC

# By component
project = MYPROJ AND component = "My-Component" ORDER BY updated DESC

# Multiple projects
project IN (MYPROJ, PROJ) AND assignee = currentUser() ORDER BY updated DESC

# Unresolved bugs
project = MYPROJ AND issuetype = Bug AND resolution = Unresolved ORDER BY priority DESC
```

### JQL Tips

- `currentUser()` — the authenticated user
- Date functions: `created >= -7d`, `updated >= startOfMonth()`
- Multiple values: `status IN ("Open", "In Progress")`
- Negation: `status NOT IN (Closed, Resolved)`
- Text search: `summary ~ "keyword"`, `description ~ "text"`
- Empty check: `labels IS EMPTY`, `fixVersion IS NOT EMPTY`
- Ordering: `ORDER BY priority DESC, updated DESC`

### Common Statuses

Open, To Do, In Progress, In Review, Done, Closed, Resolved

### Common Priorities

Blocker, Critical, High, Medium, Low

### Common Issue Types

Bug, Story, Task, Sub-Task, Epic, Activity, Test

## Error Handling

- **401/403**: Auth expired. Run `sig login https://<your-jira-domain>/` then retry.
- **400 Bad Request**: Usually invalid field values. Check field metadata via `GET /rest/api/2/issue/createmeta/{project}/issuetypes/{typeId}` to see allowed values.
- **404**: Issue/resource not found. Verify the key/ID.
- **Login page in response** (HTML containing a login provider or "Sign in"): Session expired, re-authenticate.

## Workflow Examples

### Search and display issues

1. Build JQL from user request
2. `GET /rest/api/2/search?jql={encoded_jql}&maxResults=20&fields=summary,status,assignee,priority,issuetype,updated`
3. Format results as a table: Key | Summary | Status | Assignee | Priority

### Create an issue

1. Identify project and issue type
2. Read `references/issue-templates.md` and start with the matching template
3. Merge in user-provided fields (user values override template)
4. `POST /rest/api/2/issue` with the merged fields
5. Return the created issue key and URL: `https://<your-jira-domain>/browse/{key}`

### Change issue status

1. `GET /rest/api/2/issue/{key}/transitions` to list available transitions
2. Find the transition matching the target status
3. `POST /rest/api/2/issue/{key}/transitions` with `{"transition": {"id": "X"}}`

### Move issue to sprint

1. Find the board: `GET /rest/agile/1.0/board?projectKeyOrId={project}`
2. Find the sprint: `GET /rest/agile/1.0/board/{boardId}/sprint?state=active`
3. Move: `POST /rest/agile/1.0/sprint/{sprintId}/issue` with `{"issues": ["KEY-123"]}`
