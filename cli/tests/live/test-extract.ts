/**
 * Live test: Extract credentials using the new extract/apply system.
 *
 * Usage: npx tsx tests/live/test-extract.ts <provider>
 *
 * Reads ~/.sig/config.yaml, finds the provider, and runs extraction
 * using the new BrowserSource/CookieExtractor/StorageExtractor.
 */
import { ApplyEngine } from '../../src/apply/apply-engine.js';
import { loadConfig } from '../../src/config/loader.js';
import { BrowserStrategy } from '../../src/strategies/browser/index.js';
import type { ApplyRule, ExtractRule } from '../../src/types/extract.js';
import { isOk } from '../../src/types/result.js';

// New-format provider definitions for testing
const TEST_PROVIDERS: Record<
    string,
    {
        domains: string[];
        entryUrl: string;
        source: 'browser';
        ttl?: string;
        networkProxy?: string;
        extract: ExtractRule[];
        apply: ApplyRule[];
    }
> = {
    'sap-jira': {
        domains: ['jira.tools.sap'],
        entryUrl: 'https://jira.tools.sap/',
        source: 'browser',
        ttl: '10d',
        extract: [{ from: 'cookies', name: 'session', key: '*' }],
        apply: [{ in: 'header', name: 'Cookie', value: '${session}' }],
    },
    'sap-wiki': {
        domains: ['wiki.one.int.sap'],
        entryUrl: 'https://wiki.one.int.sap/',
        source: 'browser',
        ttl: '12h',
        extract: [{ from: 'cookies', name: 'session', key: '*' }],
        apply: [{ in: 'header', name: 'Cookie', value: '${session}' }],
    },
    'app-slack': {
        domains: ['sap.enterprise.slack.com'],
        entryUrl: 'https://app.slack.com/client/E7RBBBXHB',
        source: 'browser',
        ttl: '7d',
        required: ['session.d', 'xoxc-token'],
        extract: [
            { from: 'cookies', name: 'session', key: '*' },
            {
                from: 'localStorage',
                name: 'xoxc-token',
                key: 'localConfig_v2.teams.E7RBBBXHB.token',
            },
        ],
        apply: [
            { in: 'header', name: 'Cookie', value: '${session}' },
            { in: 'header', name: 'Authorization', value: 'Bearer ${xoxc-token}' },
        ],
    },
    'ms-teams': {
        domains: ['teams.cloud.microsoft'],
        entryUrl: 'https://teams.cloud.microsoft/v2/',
        source: 'browser',
        required: ['access_token'],
        extract: [
            {
                from: 'localStorage',
                name: 'access_token',
                key: '*accesstoken*ic3.teams.office.com*',
            },
        ],
        apply: [{ in: 'header', name: 'Authorization', value: 'Bearer ${access_token}' }],
    },
    reddit: {
        domains: ['www.reddit.com', 'reddit.com'],
        entryUrl: 'https://www.reddit.com/login',
        source: 'browser',
        ttl: '7d',
        networkProxy: 'socks5://127.0.0.1:3333',
        required: ['session.reddit_session', 'session.token_v2'],
        extract: [{ from: 'cookies', name: 'session', key: '*' }],
        apply: [{ in: 'header', name: 'Cookie', value: '${session}' }],
    },
    'sap-cats': {
        domains: ['sapit-finance-prod-eagle.launchpad.cfapps.eu10.hana.ondemand.com'],
        entryUrl: 'https://sapit-finance-prod-eagle.launchpad.cfapps.eu10.hana.ondemand.com/',
        source: 'browser',
        ttl: '12h',
        extract: [{ from: 'cookies', name: 'session', key: '*' }],
        apply: [{ in: 'header', name: 'Cookie', value: '${session}' }],
    },
    zhihu: {
        domains: ['www.zhihu.com', 'zhihu.com'],
        entryUrl: 'https://www.zhihu.com/signin',
        source: 'browser',
        ttl: '7d',
        required: ['session.z_c0'],
        extract: [{ from: 'cookies', name: 'session', key: '*' }],
        apply: [{ in: 'header', name: 'Cookie', value: '${session}' }],
    },
    bilibili: {
        domains: ['www.bilibili.com', 'bilibili.com', 'api.bilibili.com'],
        entryUrl: 'https://www.bilibili.com/',
        source: 'browser',
        ttl: '7d',
        required: ['session.SESSDATA', 'session.bili_jct'],
        extract: [{ from: 'cookies', name: 'session', key: '*' }],
        apply: [{ in: 'header', name: 'Cookie', value: '${session}' }],
    },
};

async function main() {
    const providerId = process.argv[2];
    if (!providerId) {
        console.error('Usage: npx tsx tests/live/test-extract.ts <provider>');
        console.error('Available:', Object.keys(TEST_PROVIDERS).join(', '));
        process.exit(1);
    }

    const provider = TEST_PROVIDERS[providerId];
    if (!provider) {
        console.error(`Unknown provider: ${providerId}`);
        console.error('Available:', Object.keys(TEST_PROVIDERS).join(', '));
        process.exit(1);
    }

    // Load existing config for browser settings
    const configResult = await loadConfig();
    if (!isOk(configResult)) {
        console.error('Failed to load config:', configResult.error.message);
        process.exit(1);
    }
    const config = configResult.value;

    console.log(`\n--- Testing extraction for: ${providerId} ---`);
    console.log(`Source: ${provider.source}`);
    console.log(`Domains: ${provider.domains.join(', ')}`);
    console.log(`Entry URL: ${provider.entryUrl}`);
    console.log(`Extract rules: ${provider.extract.length}`);
    console.log('');

    const browserSource = new BrowserStrategy({
        browserDataDir: config.browser.browserDataDir,
        channel: config.browser.channel,
    });

    console.log('Launching browser...');
    const result = await browserSource.extract(provider.extract, {
        entryUrl: provider.entryUrl,
        domains: provider.domains,
        networkProxy: provider.networkProxy,
        timeout: 120000,
    });

    if (!isOk(result)) {
        console.error('Extraction failed:', result.error.message);
        process.exit(1);
    }

    const credentials = result.value;
    console.log('\n--- Extracted Credentials ---');
    for (const [name, value] of Object.entries(credentials)) {
        const display = value.length > 80 ? value.slice(0, 80) + '...' : value;
        console.log(`  ${name}: ${display}`);
    }

    // Apply rules
    const applied = ApplyEngine.applyRules(provider.apply, credentials);
    console.log('\n--- Applied Headers ---');
    for (const [name, value] of Object.entries(applied.headers)) {
        const display = value.length > 80 ? value.slice(0, 80) + '...' : value;
        console.log(`  ${name}: ${display}`);
    }

    console.log('\n✓ Done');
}

main().catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
});
