# Issue Templates

> **Note:** Customize these templates for your Jira projects and issue types. Replace project keys, assignee usernames, component names, and custom field values with those from your Jira instance.

When creating issues, apply these project-specific defaults. User-provided values always override template values.

## Project: MYPROJ

### Test (issuetype id: `11902`)

```json
{
    "issuetype": { "id": "11902" },
    "assignee": { "name": "your-username" },
    "labels": ["your-label"],
    "components": [{ "name": "Your-Component" }],
    "priority": { "name": "Medium" },
    "customfield_10240": { "value": "Your Test Type" },
    "customfield_44240": { "value": "ParentOption", "child": { "value": "ChildOption" } },
    "customfield_43758": [{ "value": "Your Stack Value" }],
    "customfield_22442": { "value": "Manual" },
    "customfield_22453": "/your/test/path"
}
```

### Epic (issuetype id: `7`)

```json
{
    "issuetype": { "id": "7" },
    "assignee": { "name": "your-username" },
    "components": [{ "name": "Your-Component" }],
    "customfield_15141": "Epic Name",
    "customfield_44041": { "value": "Yes" },
    "customfield_43773": { "value": "Yes" }
}
```

### Story (issuetype id: `10500`)

```json
{
    "issuetype": { "id": "10500" },
    "assignee": { "name": "your-username" },
    "components": [{ "name": "Your-Component" }],
    "priority": { "name": "Medium" },
    "customfield_43758": [{ "value": "Your Stack Value" }],
    "fixVersions": [{ "name": "your-version" }],
    "versions": [{ "name": "your-version" }]
}
```

### Activity (issuetype id: `12`)

```json
{
    "issuetype": { "id": "12" },
    "assignee": { "name": "your-username" },
    "priority": { "name": "Medium" },
    "customfield_43758": [{ "value": "Your Stack Value" }],
    "fixVersions": [{ "name": "your-version" }],
    "versions": [{ "name": "your-version" }]
}
```

### Sub-Task (issuetype id: `10401`)

```json
{
    "issuetype": { "id": "10401" },
    "assignee": { "name": "your-username" },
    "components": [{ "name": "Your-Component" }],
    "parent": { "key": "MYPROJ-XXXXX" }
}
```

### Bug (issuetype id: `1`)

```json
{
    "issuetype": { "id": "1" },
    "assignee": { "name": "your-username" },
    "components": [{ "name": "" }],
    "priority": { "name": "Medium" },
    "versions": [{ "name": "your-fix-version" }],
    "customfield_43758": [{ "value": "Your Stack Value" }],
    "description": "*current behavior:*\n\n\n*expected behavior:*\n\n\n*steps to reproduce:*\n1. \n2. \n3. \n\n*environment:*\ninstance: \nuser: \ndevice: "
}
```

## Project: PROJ

### Test (issuetype id: `11902`)

```json
{
    "issuetype": { "id": "11902" },
    "assignee": { "name": "your-username" },
    "labels": ["your-label"],
    "components": [{ "name": "Your-Component" }],
    "priority": { "name": "Low" },
    "customfield_10240": { "value": "Your Test Type" },
    "customfield_44240": { "value": "ParentOption", "child": { "value": "ChildOption" } },
    "customfield_22442": { "value": "Your Execution Type" },
    "customfield_22453": "/your/test/path"
}
```
