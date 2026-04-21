# Jira Custom Field Mappings

> **Note:** These field mappings are examples from a specific Jira instance. Your instance will have different custom field IDs. Query `GET /rest/api/2/field` to discover yours.

## Custom Field IDs

Jira uses custom field IDs instead of human-readable names. Use these mappings when creating or updating issues.

| Human Name          | Field ID            |
| ------------------- | ------------------- |
| Sprint              | `customfield_12740` |
| Epic Link           | `customfield_15140` |
| Epic Name           | `customfield_15141` |
| Story Points        | `customfield_10013` |
| Test Type           | `customfield_10240` |
| Automation Type     | `customfield_44240` |
| Test Execution Type | `customfield_22442` |
| Test Path           | `customfield_22453` |
| Git Path            | `customfield_44241` |
| Stack               | `customfield_43758` |
| Mobile Required     | `customfield_44041` |
| UI Required         | `customfield_43773` |
| Agile Team          | `customfield_43740` |
| Security Review     | `customfield_43742` |
| QA Contact          | `customfield_43743` |

> These field IDs are instance-specific examples. Run `GET /rest/api/2/field` on your Jira instance to get the actual IDs.

## Field Value Formats

Different field types require different JSON structures. Getting this wrong causes 400 errors.

### option (single select)

```json
{ "value": "Option Name" }
```

Example: `"customfield_10240": {"value": "Functional Integration"}`

### cascading option (parent + child select)

```json
{ "value": "Parent", "child": { "value": "Child" } }
```

Example: `"customfield_44240": {"value": "ParentOption", "child": {"value": "ChildOption"}}`

### array of options (multi-select)

```json
[{ "value": "Name" }]
```

Example: `"customfield_43758": [{"value": "Your Stack Value"}]`

### array of components

```json
[{ "name": "Component Name" }]
```

### array of versions (fixVersions, versions)

```json
[{ "name": "your-version" }]
```

### priority

```json
{ "name": "Medium" }
```

### parent (for sub-tasks)

```json
{ "key": "PROJ-12345" }
```

### string fields

Plain string value — no wrapping object needed.
