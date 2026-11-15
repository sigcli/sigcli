import { LOGIN_URL_PATTERNS } from '../types/index.js';

/** Match built-in path/domain rules without confusing URL components. */
export function isLoginUrl(url: string, customPatterns?: string[]): boolean {
    if (!url) return false;
    const lower = url.toLowerCase();
    // Custom rules historically inspect the full URL, including query/fragment markers.
    if (customPatterns?.some((pattern) => lower.includes(pattern.toLowerCase()))) return true;

    let parsed: URL;
    try {
        // Relative redirect locations use the same rules, without inventing an IdP host.
        parsed = new URL(url, 'https://relative.invalid');
    } catch {
        return false;
    }
    const paths = [parsed.pathname.toLowerCase()];
    const hashRoute = parsed.hash.slice(1).replace(/^!/, '');
    if (hashRoute.startsWith('/')) {
        paths.push(new URL(`https://relative.invalid${hashRoute}`).pathname.toLowerCase());
    }
    const hostname = parsed.hostname.toLowerCase();
    return LOGIN_URL_PATTERNS.some((pattern) =>
        pattern.startsWith('/')
            ? paths.some((pathname) => pathname.includes(pattern))
            : hostname === pattern || hostname.endsWith(`.${pattern}`),
    );
}
