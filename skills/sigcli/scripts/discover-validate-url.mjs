#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * discover-validate-url.mjs
 *
 * Discover candidate validateUrl endpoints for a sigcli provider.
 * Launches browser with sig's browser-data profile, observes GET API requests
 * during page load, then lets the user log in and compares before/after.
 *
 * Usage:
 *   node discover-validate-url.mjs https://www.example.com
 *
 * Requirements:
 *   - Node.js 22+ (native WebSocket)
 *   - sig must be initialized (~/.sig/config.yaml exists with browser config)
 */
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';

// --- Config ---
const TARGET_URL = process.argv[2];
if (!TARGET_URL) {
    console.error('Usage: node discover-validate-url.mjs <url>');
    process.exit(1);
}

const DOMAIN = new URL(TARGET_URL).hostname;
const PORT = 9334;

// Read sig config for browser path
let execPath = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
let dataDir = resolve(homedir(), '.sig/browser-data');
try {
    const config = readFileSync(resolve(homedir(), '.sig/config.yaml'), 'utf8');
    const execMatch = config.match(/execPath:\s*['"]?([^'"\n]+)/);
    if (execMatch) execPath = execMatch[1].trim();
    const dataMatch = config.match(/browserDataDir:\s*['"]?([^'"\n]+)/);
    if (dataMatch) dataDir = dataMatch[1].replace('~', homedir()).trim();
} catch {
    /* use defaults */
}

// --- Helpers ---
function createCDP(wsUrl) {
    const ws = new WebSocket(wsUrl);
    let id = 1;
    const pending = {};

    ws.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && pending[msg.id]) {
            pending[msg.id](msg);
            delete pending[msg.id];
        }
    });

    const send = (method, params = {}) => {
        const msgId = id++;
        return new Promise((resolve) => {
            pending[msgId] = resolve;
            ws.send(JSON.stringify({ id: msgId, method, params }));
        });
    };

    const ready = new Promise((r) => ws.addEventListener('open', r));
    return { ws, send, ready };
}

// --- Main ---
console.log(`[1/5] Launching browser → ${TARGET_URL}`);
const proc = spawn(
    execPath,
    [`--remote-debugging-port=${PORT}`, `--user-data-dir=${dataDir}`, '--no-first-run', TARGET_URL],
    { stdio: 'ignore', detached: true },
);
proc.unref();

await new Promise((r) => setTimeout(r, 4000));

// Connect CDP
let pages;
try {
    const resp = await fetch(`http://127.0.0.1:${PORT}/json`);
    pages = await resp.json();
} catch {
    console.error(`Failed to connect to CDP on port ${PORT}. Browser may not have started.`);
    process.exit(1);
}

const page = pages.find((p) => p.url.includes(DOMAIN)) || pages[0];
if (!page) {
    console.error('No matching page found');
    process.exit(1);
}

const { ws, send, ready } = createCDP(page.webSocketDebuggerUrl);
await ready;

// Enable network monitoring
await send('Network.enable');

// Collect GET API requests during page load
const apiRequests = new Map();
ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Network.requestWillBeSent') {
        const r = msg.params.request;
        if (
            r.method === 'GET' &&
            r.url.includes(DOMAIN) &&
            (r.url.includes('/rest/') ||
                r.url.includes('/api/') ||
                r.url.includes('/graphql') ||
                r.url.includes('/ajax/'))
        ) {
            const path = new URL(r.url).pathname;
            if (!apiRequests.has(path)) {
                apiRequests.set(path, { url: r.url.split('?')[0], status: null });
            }
        }
    }
    if (msg.method === 'Network.responseReceived') {
        const url = msg.params.response.url;
        const path = (() => {
            try {
                return new URL(url).pathname;
            } catch {
                return null;
            }
        })();
        if (path && apiRequests.has(path)) {
            apiRequests.get(path).status = msg.params.response.status;
        }
    }
});

console.log(`[2/5] Observing API requests (waiting 8s for page load)...`);
await send('Page.reload');
await new Promise((r) => setTimeout(r, 8000));

console.log(`\n--- Discovered GET API endpoints ---`);
for (const [, entry] of apiRequests) {
    console.log(`  [${entry.status}] ${entry.url}`);
}

if (apiRequests.size === 0) {
    console.log('  (none found — site may use only POST APIs or different URL patterns)');
}

// Test candidates with cookie-only fetch
console.log(`\n[3/5] Testing endpoints with cookie-only fetch (no extra headers)...`);
const paths = [...apiRequests.keys()];
const testExpr = `
(async () => {
    const paths = ${JSON.stringify(paths)};
    const results = {};
    for (const p of paths) {
        try {
            const r = await fetch(p, { credentials: 'include' });
            const ct = r.headers.get('content-type') || '';
            const body = ct.includes('json') ? await r.text() : null;
            results[p] = { status: r.status, hasJson: ct.includes('json'), body: body?.slice(0, 200) };
        } catch(e) { results[p] = { status: -1, error: e.message }; }
    }
    return JSON.stringify(results);
})()`;

const evalResult = await send('Runtime.evaluate', { expression: testExpr, awaitPromise: true });
const withCookie = JSON.parse(evalResult.result?.result?.value || '{}');

console.log('\n--- With cookies (current state) ---');
for (const [path, data] of Object.entries(withCookie)) {
    const body = data.body ? ` → ${data.body.slice(0, 80)}` : '';
    console.log(`  [${data.status}] ${path}${body}`);
}

// Test without cookies
const testNoCookie = `
(async () => {
    const paths = ${JSON.stringify(paths)};
    const results = {};
    for (const p of paths) {
        try {
            const r = await fetch(p, { credentials: 'omit' });
            const ct = r.headers.get('content-type') || '';
            const body = ct.includes('json') ? await r.text() : null;
            results[p] = { status: r.status, hasJson: ct.includes('json'), body: body?.slice(0, 200) };
        } catch(e) { results[p] = { status: -1, error: e.message }; }
    }
    return JSON.stringify(results);
})()`;

const evalResult2 = await send('Runtime.evaluate', {
    expression: testNoCookie,
    awaitPromise: true,
});
const withoutCookie = JSON.parse(evalResult2.result?.result?.value || '{}');

console.log('\n--- Without cookies (simulating logged out) ---');
for (const [path, data] of Object.entries(withoutCookie)) {
    const body = data.body ? ` → ${data.body.slice(0, 80)}` : '';
    console.log(`  [${data.status}] ${path}${body}`);
}

// Compare and recommend
console.log('\n[4/5] === Analysis ===');
let found = false;
for (const path of paths) {
    const before = withoutCookie[path];
    const after = withCookie[path];
    if (!before || !after) continue;

    if (before.status !== after.status) {
        console.log(`\n✓ CANDIDATE: ${path}`);
        console.log(
            `  Status differs: ${before.status} (no cookie) vs ${after.status} (with cookie)`,
        );
        if (before.status === 401 || before.status === 403) {
            console.log(`  → Use as validateUrl (returns ${before.status} without auth)`);
        } else if (before.status >= 300 && before.status < 400) {
            console.log(`  → Use as validateUrl (redirects without auth)`);
        }
        found = true;
    } else if (before.body !== after.body && before.body && after.body) {
        console.log(`\n~ CANDIDATE (needs validateRule): ${path}`);
        console.log(`  Both return ${after.status} but body differs:`);
        console.log(`  Without cookie: ${before.body.slice(0, 100)}`);
        console.log(`  With cookie:    ${after.body.slice(0, 100)}`);
        found = true;
    }
}

if (!found) {
    console.log('\n  No cookie-only endpoints found that differentiate auth state.');
    console.log('  This site may require extra headers (CSRF, signatures) beyond cookies.');
    console.log('  Try asking the user which API endpoint they use.');
}

console.log('\n[5/5] Done. Closing browser.');
ws.close();
try {
    process.kill(-proc.pid);
} catch {
    proc.kill();
}
process.exit(0);
