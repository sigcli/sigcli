import {
    LoginPageDetector,
    type DomEvaluateFn,
    type ILoginPageDetector,
} from './login-detector.js';

export interface IPageStateChecker {
    isOnProviderDomain(url: string, domains: string[]): boolean;
    isAuthenticated(
        url: string,
        domains: string[],
        evaluate: DomEvaluateFn,
        loginPatterns?: string[],
    ): Promise<boolean>;
}

export class PageStateChecker implements IPageStateChecker {
    private readonly loginDetector: ILoginPageDetector;

    constructor(loginDetector?: ILoginPageDetector) {
        this.loginDetector = loginDetector ?? new LoginPageDetector();
    }

    isOnProviderDomain(url: string, domains: string[]): boolean {
        const lower = url.toLowerCase();
        return domains.some((d) => lower.includes(d.toLowerCase()));
    }

    async isAuthenticated(
        url: string,
        domains: string[],
        evaluate: DomEvaluateFn,
        loginPatterns?: string[],
    ): Promise<boolean> {
        if (!this.isOnProviderDomain(url, domains)) return false;
        const isLogin = await this.loginDetector.isLoginPage(url, evaluate, loginPatterns);
        return !isLogin;
    }
}
