import type { IBrowserPage } from '../../core/interfaces/browser-adapter.js';
import { LOGIN_URL_PATTERNS } from '../../core/constants.js';

/**
 * Detect and check for common login form patterns.
 * Returns true if the page appears to be a login page.
 */
export async function isLoginPage(page: IBrowserPage): Promise<boolean> {
  try {
    const url = page.url().toLowerCase();
    if (LOGIN_URL_PATTERNS.some((p) => url.includes(p))) return true;

    // Check for common form elements
    const hasLoginForm = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      let hasPassword = false;
      let hasEmail = false;
      for (const input of inputs) {
        const type = input.type.toLowerCase();
        const name = (input.name || input.id || '').toLowerCase();
        if (type === 'password') hasPassword = true;
        if (type === 'email' || name.includes('email') || name.includes('user')) hasEmail = true;
      }
      return hasPassword || hasEmail;
    });

    return hasLoginForm;
  } catch {
    return false;
  }
}
