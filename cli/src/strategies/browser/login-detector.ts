import { LOGIN_URL_PATTERNS } from '../../types/index.js';

/**
 * Function type for evaluating JS in a page context.
 * Implemented by Playwright page.evaluate or CDP Runtime.evaluate wrappers.
 */
export type DomEvaluateFn = <T>(expression: string) => Promise<T>;

export interface ILoginPageDetector {
    isLoginUrl(url: string, customPatterns?: string[]): boolean;
    isLoginDom(evaluate: DomEvaluateFn): Promise<boolean>;
    isLoginPage(url: string, evaluate: DomEvaluateFn, customPatterns?: string[]): Promise<boolean>;
}

const LOGIN_DOM_CHECK = `(() => {
  const pw = document.querySelector('input[type="password"]:not([hidden])');
  if (pw && pw.offsetParent !== null) return true;
  const email = document.querySelector('input[type="email"]:not([hidden])');
  if (email && email.offsetParent !== null) {
    const loggedIn = document.querySelector('.user-menu, .avatar, [data-user], nav [href*="profile"]');
    return !loggedIn;
  }
  return false;
})()`;

export class LoginPageDetector implements ILoginPageDetector {
    isLoginUrl(url: string, customPatterns?: string[]): boolean {
        const lower = url.toLowerCase();
        const patterns = customPatterns
            ? [...LOGIN_URL_PATTERNS, ...customPatterns]
            : LOGIN_URL_PATTERNS;
        return patterns.some((p) => lower.includes(p.toLowerCase()));
    }

    async isLoginDom(evaluate: DomEvaluateFn): Promise<boolean> {
        try {
            return await evaluate<boolean>(LOGIN_DOM_CHECK);
        } catch {
            return false;
        }
    }

    async isLoginPage(
        url: string,
        evaluate: DomEvaluateFn,
        customPatterns?: string[],
    ): Promise<boolean> {
        if (this.isLoginUrl(url, customPatterns)) return true;
        return this.isLoginDom(evaluate);
    }
}
