from sigcli_sdk.formatter import apply_rules
from sigcli_sdk.types import ApplyRule, ApplyResult


VALUES = {
    "cookie": "sid=abc123; csrf=xyz789",
    "token": "eyJhbGciOiJIUzI1NiIs",
}


def test_apply_rules_single_header():
    rules = [ApplyRule(in_="header", name="Cookie", value="${cookie}")]
    result = apply_rules(VALUES, rules)
    assert result.headers == {"Cookie": "sid=abc123; csrf=xyz789"}
    assert result.query is None
    assert result.body is None


def test_apply_rules_bearer_token_template():
    rules = [ApplyRule(in_="header", name="Authorization", value="Bearer ${token}")]
    result = apply_rules(VALUES, rules)
    assert result.headers == {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIs"}


def test_apply_rules_multiple_rules():
    rules = [
        ApplyRule(in_="header", name="Cookie", value="${cookie}"),
        ApplyRule(in_="header", name="Authorization", value="Bearer ${token}"),
    ]
    result = apply_rules(VALUES, rules)
    assert result.headers == {
        "Cookie": "sid=abc123; csrf=xyz789",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs",
    }


def test_apply_rules_append_action():
    rules = [
        ApplyRule(in_="header", name="Cookie", value="first=1"),
        ApplyRule(in_="header", name="Cookie", value="second=2", action="append"),
    ]
    result = apply_rules(VALUES, rules)
    assert result.headers["Cookie"] == "first=1; second=2"


def test_apply_rules_remove_action():
    rules = [
        ApplyRule(in_="header", name="Cookie", value="${cookie}"),
        ApplyRule(in_="header", name="Cookie", value="", action="remove"),
    ]
    result = apply_rules(VALUES, rules)
    assert "Cookie" not in result.headers


def test_apply_rules_query():
    rules = [ApplyRule(in_="query", name="access_token", value="${token}")]
    result = apply_rules(VALUES, rules)
    assert result.query == {"access_token": "eyJhbGciOiJIUzI1NiIs"}
    assert result.headers == {}
    assert result.body is None


def test_apply_rules_body():
    rules = [ApplyRule(in_="body", name="token", value="${token}")]
    result = apply_rules(VALUES, rules)
    assert result.body == {"token": "eyJhbGciOiJIUzI1NiIs"}
    assert result.headers == {}
    assert result.query is None


def test_apply_rules_missing_value_replaced_with_empty_string():
    rules = [ApplyRule(in_="header", name="X-Missing", value="${does_not_exist}")]
    result = apply_rules(VALUES, rules)
    assert result.headers == {"X-Missing": ""}


def test_apply_rules_empty_rules_returns_empty_result():
    result = apply_rules(VALUES, [])
    assert result.headers == {}
    assert result.query is None
    assert result.body is None


def test_apply_rules_query_remove():
    rules = [
        ApplyRule(in_="query", name="q", value="v1"),
        ApplyRule(in_="query", name="q", value="", action="remove"),
    ]
    result = apply_rules(VALUES, rules)
    assert result.query == {}


def test_apply_rules_body_append():
    rules = [
        ApplyRule(in_="body", name="data", value="part1"),
        ApplyRule(in_="body", name="data", value="part2", action="append"),
    ]
    result = apply_rules(VALUES, rules)
    assert result.body == {"data": "part1; part2"}


def test_apply_rules_set_action_explicit():
    rules = [ApplyRule(in_="header", name="X-Token", value="${token}", action="set")]
    result = apply_rules(VALUES, rules)
    assert result.headers == {"X-Token": "eyJhbGciOiJIUzI1NiIs"}
