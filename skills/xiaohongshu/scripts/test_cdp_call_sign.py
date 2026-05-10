#!/usr/bin/env python3
"""Export and call xhsSign, xsCommon, xhsToken from module 36385."""
import sys
import json
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xhs_browser import ensure_browser, CdpClient

cookie = os.environ.get("SIG_XIAOHONGSHU_COOKIE", "")
if not cookie:
    print("ERROR: no cookie"); sys.exit(1)

state = ensure_browser(cookie)
cdp = CdpClient(state["ws_url"], timeout=30)

# Load module 36385 and extract the signing functions
js = """
(function() {
    var __require = null;
    self.webpackChunkxhs_pc_web.push([['__sign__'], {}, function(require) {
        __require = require;
    }]);
    if (!__require) return JSON.stringify({error: 'no require'});

    var mod = __require('36385');
    var keys = Object.keys(mod);
    var fnKeys = keys.filter(function(k) { return typeof mod[k] === 'function'; });
    return JSON.stringify({
        allKeys: keys,
        functions: fnKeys,
        hasXhsSign: typeof mod.xhsSign,
        hasXsCommon: typeof mod.xsCommon,
        hasXhsToken: typeof mod.xhsToken,
    });
})()
"""

r = cdp.send("Runtime.evaluate", {"expression": js, "returnByValue": True})
val = r.get("result", {}).get("value", "{}")
data = json.loads(val)
print(f"Module 36385 exports: {json.dumps(data, indent=2)}")

# If functions are not directly exported, they might be internal.
# Let's try to call them through the module's internal mechanism.
# From the snippet: xhsSign(e, a) where e=config, a=request
# Let's see what the module exports

# Try calling the module as a function or accessing its exports differently
js2 = """
(function() {
    var __require = null;
    self.webpackChunkxhs_pc_web.push([['__sign2__'], {}, function(require) {
        __require = require;
    }]);
    var mod = __require('36385');

    // The module source shows these functions: xhsSign, xsCommon, xhsToken, pullDsScript
    // They might not be exported but are defined in the module scope
    // Let's check what IS exported
    var result = {exports: Object.keys(mod).slice(0, 30)};

    // Check if the module has a default export that's a function (axios request interceptor)
    if (typeof mod.default === 'function') {
        result.defaultType = 'function';
        result.defaultName = mod.default.name;
    } else if (typeof mod.default === 'object' && mod.default) {
        result.defaultKeys = Object.keys(mod.default).slice(0, 20);
    }

    // Look for a function that takes (config) and adds headers
    Object.keys(mod).forEach(function(k) {
        if (typeof mod[k] === 'function') {
            result['fn_' + k] = mod[k].toString().substring(0, 200);
        }
    });

    return JSON.stringify(result);
})()
"""

r2 = cdp.send("Runtime.evaluate", {"expression": js2, "returnByValue": True})
val2 = r2.get("result", {}).get("value", "{}")
data2 = json.loads(val2)
print(f"\nModule details:")
print(json.dumps(data2, indent=2)[:2000])

cdp.close()
