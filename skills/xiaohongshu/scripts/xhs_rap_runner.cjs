const fs = require('fs');
const vm = require('vm');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'xhs_rap.cjs'), 'utf-8');
const script = new vm.Script(code);
const ctx = vm.createContext({ ...global, require, Buffer, TextEncoder, TextDecoder, URL, URLSearchParams, setTimeout, clearTimeout, setInterval, clearInterval, console });
script.runInContext(ctx);

const api = process.argv[2] || '';
const data = process.argv[3] || '';
const appId = process.argv[4] || undefined;

try {
  const result = ctx.generate_x_rap_param(api, data, appId);
  process.stdout.write(result);
} catch (e) {
  process.stderr.write('ERROR: ' + e.message);
  process.exit(1);
}
