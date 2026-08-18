/**
 * Strict suffix-match for hostnames used in IdP resolution.
 *
 * `hostnameMatches("idp.example.com", "example.com")` → true
 * `hostnameMatches("evilexample.com", "example.com")`     → false (not a suffix on a label boundary)
 * `hostnameMatches("example.com", "example.com")`         → true
 */
export function hostnameMatches(candidate: string, key: string): boolean {
    const c = candidate.toLowerCase().replace(/\.$/, '');
    const k = key.toLowerCase().replace(/\.$/, '');
    return c === k || c.endsWith('.' + k);
}
