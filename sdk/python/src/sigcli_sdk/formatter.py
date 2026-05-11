import re
from typing import Optional
from .types import ApplyRule, ApplyResult

def apply_rules(values: dict[str, str], rules: list[ApplyRule]) -> ApplyResult:
    """Apply template rules to credential values.

    Template syntax: ${key} is replaced with values[key] (empty string if missing).
    """
    headers: dict[str, str] = {}
    query: Optional[dict[str, str]] = None
    body: Optional[dict[str, str]] = None

    for rule in rules:
        action = rule.action or "set"
        interpolated = _interpolate(rule.value, values)

        if rule.in_ == "header":
            if action == "remove":
                headers.pop(rule.name, None)
            elif action == "append":
                existing = headers.get(rule.name)
                headers[rule.name] = f"{existing}; {interpolated}" if existing else interpolated
            else:
                headers[rule.name] = interpolated
        elif rule.in_ == "query":
            if query is None:
                query = {}
            if action == "remove":
                query.pop(rule.name, None)
            elif action == "append":
                existing = query.get(rule.name)
                query[rule.name] = f"{existing}; {interpolated}" if existing else interpolated
            else:
                query[rule.name] = interpolated
        elif rule.in_ == "body":
            if body is None:
                body = {}
            if action == "remove":
                body.pop(rule.name, None)
            elif action == "append":
                existing = body.get(rule.name)
                body[rule.name] = f"{existing}; {interpolated}" if existing else interpolated
            else:
                body[rule.name] = interpolated

    return ApplyResult(headers=headers, query=query, body=body)

def _interpolate(template: str, values: dict[str, str]) -> str:
    return re.sub(r"\$\{([^}]+)\}", lambda m: values.get(m.group(1), ""), template)
