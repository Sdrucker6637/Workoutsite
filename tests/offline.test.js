/* Offline behaviour of the service worker: fresh install, and updating an installed v5 copy to v6.
 * Serves files itself (like GitHub Pages: Cache-Control max-age=600) and can switch the served version.
 * Setup: git worktree add /tmp/forge-v5 5d64e76   (the previous version, for the update test)
 * Run:   node tests/offline.test.js   (requires playwright) */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const V6 = path.join(__dirname, '..');
const V5 = process.env.V5_DIR || '/tmp/forge-v5';
let root = V6;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });
    res.end(buf);
  });
});
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };

(async () => {
  await new Promise((r) => server.listen(8799, r));
  const URL = 'http://localhost:8799/';
  const browser = await chromium.launch();
  const swReady = (page) => page.evaluate(async () => { await navigator.serviceWorker.ready; for (let i = 0; i < 50 && !navigator.serviceWorker.controller; i++) await new Promise((r) => setTimeout(r, 100)); return !!navigator.serviceWorker.controller; });

  console.log('Fresh install of v6, then offline');
  {
    root = V6;
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    ok(await swReady(page), 'service worker installed and controlling the page');
    const caches = await page.evaluate(() => caches.keys());
    ok(caches.includes('forge-v15'), 'app cache forge-v15 created: ' + caches.join(', '));
    const cached = await page.evaluate(async () => (await (await caches.open('forge-v15')).keys()).map((r) => new URL(r.url).pathname));
    ok(['/js/ingredients.js', '/js/meals.js', '/js/achievements.js', '/js/views-meals.js', '/js/feedback.js', '/index.html'].every((p) => cached.includes(p)), 'new scripts are in the cache');
    await ctx.setOffline(true);
    await page.reload(); await page.waitForTimeout(500);
    ok((await page.locator('.tabs .tab').count()) === 5, 'app loads offline');
    for (const r of ['meals', 'achievements', 'generate', 'food', 'settings']) {
      await page.goto(URL + '#/' + r); await page.waitForTimeout(200);
      ok((await page.locator('main .page').count()) === 1, `#/${r} works offline`);
    }
    await page.goto(URL + '#/meals'); await page.waitForTimeout(150);
    for (const id of ['chicken-breast', 'rice', 'broccoli']) await page.click(`[data-act="mlPick"][data-id="${id}"]`);
    await page.click('[data-act="mlGenerate"]'); await page.waitForTimeout(300);
    ok((await page.locator('.meal-card').count()) >= 2, 'meal ideas generated offline');
    const est = await page.evaluate(() => { const x = WT.meals.saveIngredient({ name: 'Butterball turkey kielbasa' }); WT.meals.toggleSelect(x.id); return x; });
    ok(est.macros.p > 7 && est.status === 'estimated', 'a new ingredient gets estimated nutrition offline');
    const logged = await page.evaluate(() => { const r = WT.meals.generate({ seed: 1 }).ideas[0]; return WT.meals.logServing(r); });
    ok(logged && logged.per.p > 0, 'a recipe serving is logged to the food diary offline');
    await page.goto(URL + '#/dashboard'); await page.waitForTimeout(150);
    await page.click('.hero [data-act="runRecord"]'); await page.waitForSelector('.sheet #runDist');
    await page.fill('.sheet #runDist', '3'); await page.fill('.sheet [data-k="m"]', '27');
    await page.click('.sheet [data-act="runSave"]'); await page.waitForTimeout(300);
    ok((await page.evaluate(() => WT.runList().length)) === 1, 'run recorded offline');
    await page.goto(URL + '#/generate'); await page.waitForTimeout(150);
    await page.click('button[data-act="generate"]'); await page.waitForTimeout(600);
    ok((await page.locator('.ex-row').count()) >= 5, 'workout generated offline');
    await page.reload(); await page.waitForTimeout(400);
    ok((await page.evaluate(() => WT.runList().length)) === 1, 'offline data persists across reload');
    ok(errors.length === 0, 'no errors offline' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await ctx.close();
  }

  console.log('Installed v5 copy updated to v6, then offline');
  if (!fs.existsSync(path.join(V5, 'sw.js'))) {
    console.log('  (skipped: no v5 checkout at ' + V5 + ')');
  } else {
    root = V5;
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    ok(await swReady(page), 'v5 installed');
    ok((await page.evaluate(() => caches.keys())).includes('forge-v10'), 'v5 cache forge-v10 present');
    await page.evaluate(() => { WT.saveForTest = 1; WT.db.history.push({ id: 'keep', type: 'full', title: 'Kept', startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), durationSec: 60, prs: [], totals: { sets: 1, volume: 100 }, exercises: [{ uid: 'k', exId: 'db-curl', intensity: 'regular', targetSets: 1, repMin: 8, repMax: 12, sets: [{ w: '20', r: '10', done: true }] }] }); WT.flush(); });
    // Load every page once so the browser's HTTP cache holds the v5 files (as it would for a real user)
    await page.reload(); await page.waitForTimeout(300);
    // Deploy v6
    root = V6;
    // The browser checks sw.js on navigation; the new worker installs, activates and takes over
    await page.reload(); await page.waitForTimeout(300);
    await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
    for (let i = 0; i < 50; i++) {
      const keys = await page.evaluate(() => caches.keys());
      if (keys.includes('forge-v15') && !keys.includes('forge-v10')) break;
      await page.waitForTimeout(200);
    }
    const keys = await page.evaluate(() => caches.keys());
    ok(keys.includes('forge-v15') && !keys.includes('forge-v10'), 'update installs forge-v15 and removes the old cache: ' + keys.join(', '));
    const idx = await page.evaluate(async () => (await (await (await caches.open('forge-v15')).match('./index.html')).text()));
    ok(idx.includes('js/meals.js') && idx.includes('js/views-meals.js'), 'the new cache holds the NEW index.html (not a stale copy from the HTTP cache)');
    // Normal use right after the deploy: the shell is refreshed in the background on every load
    for (let i = 0; i < 3; i++) { await page.reload(); await page.waitForTimeout(400); }
    const stale = await page.evaluate(async () => {
      const c = await caches.open('forge-v15');
      const out = [];
      for (const p of ['./index.html', './js/core.js', './js/ui.js', './sw.js']) {
        const r = await c.match(p);
        if (r) out.push([p, (await r.text()).length]);
      }
      return out;
    });
    const fresh = await page.evaluate(async (ps) => Promise.all(ps.map(async (p) => [p, (await (await fetch(p, { cache: 'no-store' })).text()).length])), stale.map((x) => x[0]));
    ok(JSON.stringify(stale.filter((x) => x[0] !== './sw.js')) === JSON.stringify(fresh.filter((x) => x[0] !== './sw.js')), 'background refreshes keep the cache on the new version (no stale files written back)');
    await ctx.setOffline(true);
    await page.reload(); await page.waitForTimeout(600);
    ok(await page.evaluate(() => !!(WT.meals && WT.ach)), 'offline after the update: v6 code is running');
    ok((await page.evaluate(() => WT.db.version)) === 7 && (await page.evaluate(() => WT.db.history.some((s) => s.id === 'keep'))), 'data upgraded to v7 and kept');
    for (const r of ['meals', 'achievements', 'settings', 'dashboard']) {
      await page.goto(URL + '#/' + r); await page.waitForTimeout(200);
      ok((await page.locator('main .page').count()) === 1, `#/${r} works offline after the update`);
    }
    ok(errors.length === 0, 'no errors through the update' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await ctx.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  server.close();
  process.exit(fail ? 1 : 0);
})();
