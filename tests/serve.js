/* In-process static file server for the browser tests.
 *
 * Playwright answers every request to the test origin straight from the repository on disk,
 * so the tests don't need a separate HTTP server process. If you'd rather run a real server
 * (python3 -m http.server 8765), set REAL_SERVER=1 and this does nothing.
 *
 *   const { URL, serve } = require('./serve');
 *   const ctx = await browser.newContext(...); await serve(ctx);
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const URL = process.env.URL || 'http://localhost:8765/';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.woff2': 'font/woff2', '.md': 'text/plain; charset=utf-8',
};

async function serve(ctx) {
  if (process.env.REAL_SERVER) return;
  const origin = new globalThis.URL(URL).origin;
  await ctx.route(origin + '/**', async (route) => {
    let p = decodeURIComponent(new globalThis.URL(route.request().url()).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: 'Not found' });
    return route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' } });
  });
}

module.exports = { URL, serve };
