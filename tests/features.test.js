/* Tests for exercise demonstrations and the More options panel.
 * Serve the repo on :8765 (python3 -m http.server 8765), then: node tests/features.test.js */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:8765/';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  const mediaHits = {};
  page.on('request', (r) => { if (r.url().includes('/media/')) mediaHits[r.url()] = (mediaHits[r.url()] || 0) + 1; });
  const db = () => page.evaluate(() => JSON.parse(JSON.stringify(WT.db)));
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  /* ───────── 1. More options panel ───────── */
  console.log('More options: stays open while interacting (touch)');
  await page.goto(URL + '#/generate');
  await page.tap('[data-act="genType"][data-k="full"]');
  await page.tap('[data-act="generate"]'); await page.waitForTimeout(500);
  const draftIds = JSON.stringify((await db()).draft.exercises.map((e) => e.exId));
  const isOpen = () => page.evaluate(() => !!document.querySelector('details.adv') && document.querySelector('details.adv').open);
  const g = () => page.evaluate(() => JSON.parse(JSON.stringify(WT.ui.gen)));
  await page.tap('details.adv > summary');
  ok(await isOpen(), 'opens on tap');

  const steps = [
    ['Supersets toggle', '[data-act="genToggle"][data-k="supersets"]', (a, b) => a.supersets !== b.supersets],
    ['Fit to duration toggle', '[data-act="genToggle"][data-k="autoCount"]', (a, b) => a.autoCount !== b.autoCount],
    ['Fit to duration toggle (back)', '[data-act="genToggle"][data-k="autoCount"]', (a, b) => a.autoCount !== b.autoCount],
    ['Intensity → Fixed', '[data-act="genSet"][data-k="intensityMode"][data-v="manual"]', (a, b) => b.intensityMode === 'manual'],
    ['Heavy stepper +', '[data-act="genStep"][data-k="heavy"][data-d="1"]', (a, b) => b.heavy === Math.min(a.heavy + 1, b.count)],
    ['Burnout stepper −', '[data-act="genStep"][data-k="burnout"][data-d="-1"]', (a, b) => b.burnout === Math.max(0, a.burnout - 1)],
    ['Intensity → Randomized', '[data-act="genSet"][data-k="intensityMode"][data-v="random"]', (a, b) => b.intensityMode === 'random'],
    ['Prioritize chip', '[data-act="genPrio"][data-k="quads"]', (a, b) => a.prioritize.includes('quads') !== b.prioritize.includes('quads')],
    ['Equipment chip', '[data-act="genEquip"][data-k="kb"]', (a, b) => a.equipment.includes('kb') !== b.equipment.includes('kb')],
    ['Avoid chip', '[data-act="genAvoid"][data-k="calves"]', (a, b) => a.avoidMuscles.includes('calves') !== b.avoidMuscles.includes('calves')],
  ];
  for (const [label, sel, changed] of steps) {
    const before = await g();
    await page.locator(sel).scrollIntoViewIfNeeded();
    await page.tap(sel);
    await page.waitForTimeout(80);
    const after = await g();
    ok(await isOpen(), `${label}: panel stays open`);
    ok(changed(before, after), `${label}: setting changed`);
    ok(JSON.stringify((await db()).draft.exercises.map((e) => e.exId)) === draftIds, `${label}: generated workout preserved`);
  }
  // Excluded exercises opens a sheet (an explicit action); the panel is still open behind it and after closing it
  await page.tap('details.adv [data-act="openExcluded"]');
  await page.waitForSelector('.sheet');
  await page.tap('.sheet [data-act="toggleRestriction"][data-k="spinal-load"]');
  ok((await db()).profile.restrictions.includes('spinal-load'), 'Exclusions sheet: restriction toggled');
  await page.tap('.sheet-head [data-act="closeSheet"]');
  ok(await isOpen(), 'Exclusions sheet closed: panel still open');
  // Settings link inside the "random" description is a navigation action — skip; tapping elsewhere doesn't close
  await page.tap('.head h1');
  ok(await isOpen(), 'tapping elsewhere on the page does not close it');
  await page.tap('details.adv > summary');
  ok(!(await isOpen()), 'closes when More options is tapped again');
  await page.reload();
  await page.tap('details.adv > summary');
  ok(await isOpen(), 'works after reload');
  await page.tap('details.adv > summary');

  /* ───────── 2. Demonstrations ───────── */
  console.log('Demonstrations: data integrity');
  const integ = await page.evaluate(async () => {
    const keys = Object.keys(WT.MEDIA.map);
    const missingEx = keys.filter((k) => !WT.ex(k));
    const files = WT.MEDIA.files();
    const bad = [];
    for (const f of files) { const r = await fetch(f, { method: 'HEAD' }); if (!r.ok) bad.push(f); }
    return { n: keys.length, missingEx, files: files.length, bad, unmapped: WT.exercises.filter((e) => !WT.demoFor(e.id)).length };
  });
  ok(integ.missingEx.length === 0, `all ${integ.n} mapped ids are real exercises`);
  ok(integ.bad.length === 0, `all ${integ.files} illustration files exist`);
  console.log(`    ${integ.n} exercises with demonstrations, ${integ.unmapped} use the placeholder`);
  const shape = await page.evaluate(() => {
    const bad = [];
    for (const [id, [src, , n]] of Object.entries(WT.MEDIA.map)) {
      const d = WT.demoFor(id);
      const el = document.createElement('div'); el.innerHTML = WT.h.demo(id, 'md');
      const demo = el.firstElementChild;
      if (d.frames.length !== n || demo.querySelectorAll('img').length !== n || !demo.classList.contains('src-' + src)) bad.push(id);
      if (!WT.h.demoCredit(id).includes(d.source.licenseUrl)) bad.push(id + ' (credit)');
      if (d.alsoEk && !WT.h.demoCredit(id).includes('Everkinetic')) bad.push(id + ' (EK credit)');
    }
    return { bad, counts: WT.MEDIA.counts() };
  });
  ok(shape.bad.length === 0, 'every mapping renders its frames, source class and license credit' + (shape.bad.length ? ': ' + shape.bad.join(', ') : ''));
  console.log('    per source:', JSON.stringify(shape.counts));

  console.log('Generated workout');
  await page.goto(URL + '#/generate');
  await page.tap('[data-act="genType"][data-k="chest"]');
  await page.tap('[data-act="generate"]'); await page.waitForTimeout(700);
  const rows = await page.locator('.ex-row').count();
  ok((await page.locator('.ex-row .demo-sm').count()) === rows, 'every plan row has a thumbnail or placeholder');
  ok((await page.locator('.ex-row button.demo.ready').count()) >= 1, 'thumbnails load');
  await page.locator('.ex-row button.demo').first().tap();
  await page.waitForSelector('.sheet .demo-lg.ready');
  ok(await page.locator('.sheet .demo-lg.playing').count() === 1, 'tapping a thumbnail opens a large, playing demonstration');
  ok(await page.locator('.sheet .demo-credit a[href*="creativecommons.org/"]').count() === 1, 'large view shows license attribution');
  await page.screenshot({ path: '/tmp/shots/feat-viewer.png' });
  await page.tap('.sheet-head [data-act="closeSheet"]');

  console.log('Swap previews');
  await page.locator('.ex-row [data-act="openSwap"]').first().tap();
  await page.waitForSelector('[data-act="doSwap"]');
  await page.waitForTimeout(500);
  ok((await page.locator('[data-act="doSwap"] .demo').count()) === (await page.locator('[data-act="doSwap"]').count()), 'every replacement option has a preview');
  ok((await page.locator('[data-act="doSwap"] .demo.ready').count()) >= 1, 'previews load');
  await page.screenshot({ path: '/tmp/shots/feat-swap.png' });
  await page.tap('.sheet-head [data-act="closeSheet"]');

  console.log('Active workout');
  await page.evaluate(() => { WT.db.draft.exercises[0].exId = 'db-bench-press'; WT.save(true); });
  await page.goto(URL + '#/generate'); await page.waitForTimeout(200);
  await page.tap('.sticky-cta [data-act="startDraft"]');
  await page.waitForSelector('.cur');
  await page.evaluate(() => { WT.db.active.focus = WT.db.active.exercises.find((e) => e.exId === 'db-bench-press').uid; WT.rerender(); });
  await page.waitForSelector('.cur .demo-md.ready');
  ok(await page.locator('.cur .demo-md.playing').count() === 1, 'current exercise shows a large playing demonstration');
  const box = await page.locator('.cur .demo-md').boundingBox();
  const edBox = await page.locator('.editor').boundingBox();
  ok(box.y + box.height <= edBox.y, 'demonstration sits above the set editor, not over it');
  await page.screenshot({ path: '/tmp/shots/feat-train.png' });
  // set logging still works with the demo present
  await page.tap('.field-num input[data-f="w"]'); await page.fill('.field-num input[data-f="w"]', '40');
  await page.tap('.editor [data-act="woCheck"]');
  ok((await db()).active.exercises.find((e) => e.exId === 'db-bench-press').sets[0].done, 'set logging unaffected');
  await page.tap('[data-act="timerStop"]').catch(() => {});
  // hide/show from the exercise menu
  await page.tap('.cur [data-act="woMenu"]');
  await page.tap('.sheet [data-act="toggleTrainDemos"]');
  ok(await page.locator('.cur .demo').count() === 0, 'demonstrations can be hidden while training');
  await page.tap('.cur [data-act="woMenu"]');
  await page.tap('.sheet [data-act="toggleTrainDemos"]');
  ok(await page.locator('.cur .demo').count() === 1, '…and shown again');
  // placeholder for an unmapped exercise
  await page.evaluate(() => { const it = WT.db.active.exercises[0]; it.exId = 'bayesian-curl'; WT.db.active.focus = it.uid; WT.rerender(); });
  ok(await page.locator('.cur .demo-md.none').count() === 1 && (await page.locator('.cur .demo-md.none').innerText()).includes('No demonstration'), 'unmapped exercise shows a clean placeholder, not a wrong animation');
  ok(await page.locator('.cur img').count() === 0, 'no image for an unmapped exercise');

  console.log('Exercise library & detail');
  await page.goto(URL + '#/library'); await page.waitForTimeout(600);
  const total = await page.locator('#libList .demo:not(.none)').count();
  const loaded = await page.evaluate(() => document.querySelectorAll('#libList .demo[data-loaded]').length);
  ok(total > 40 && loaded < total, `lazy loading: ${loaded} of ${total} thumbnails loaded on first screen`);
  const firstThumb = page.locator('#libList .demo:not(.none)').first();
  ok(await firstThumb.evaluate((el) => el.classList.contains('playing')), 'on-screen thumbnail is playing');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(400);
  ok(!(await firstThumb.evaluate((el) => el.classList.contains('playing'))), 'offscreen thumbnail is paused');
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
  await page.fill('#libSearch', 'hammer curl'); await page.waitForTimeout(400);
  ok((await page.locator('#libList .demo.ready').count()) >= 1, 'thumbnails re-mount after search re-render');
  await page.locator('#libList button.demo').first().tap();
  await page.waitForSelector('.sheet .demo-lg.ready');
  ok(true, 'library thumbnail opens the demonstration');
  await page.tap('.sheet-head [data-act="closeSheet"]');
  await page.locator('#libList [data-act="exDetail"]').first().tap();
  await page.waitForSelector('.sheet .demo-lg.ready');
  ok(await page.locator('.sheet .watch').count() === 1, 'detail page shows the demonstration and keeps the video link');
  await page.screenshot({ path: '/tmp/shots/feat-detail.png' });
  await page.tap('.sheet-head [data-act="closeSheet"]');

  console.log('Multi-frame sources');
  const seq = async (id) => page.evaluate((id) => new Promise((res) => {
    const wrap = document.createElement('div');
    wrap.innerHTML = WT.h.demo(id, 'lg', { static: true });
    document.getElementById('main').prepend(wrap);
    const el = wrap.firstElementChild;
    WT.mountDemos(wrap);
    const seen = [], maxVis = [];
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (!el.classList.contains('ready')) return;
      const op = [...el.querySelectorAll('img')].map((i) => +getComputedStyle(i).opacity);
      maxVis.push(op.filter((o) => o > 0.95).length);
      const top = op.indexOf(Math.max(...op));
      if (Math.max(...op) > 0.95 && seen[seen.length - 1] !== top) seen.push(top);
      if (Date.now() - t0 > 4600) { clearInterval(iv); wrap.remove(); res({ seen, maxTogether: Math.max(...maxVis), ready: true }); }
    }, 60);
  }), id);
  const wg = await seq('goblet-squat');
  ok(wg.maxTogether === 1, 'transparent frames are never shown on top of each other');
  const wgs = wg.seen.join('');
  ok(new Set(wg.seen).size === 3 && !/02|20/.test(wgs), `3 frames ping-pong start → middle → end → middle, never jumping end → start (${wgs})`);
  const oei = await seq('arnold-press');
  ok(oei.seen.length >= 2 && new Set(oei.seen).size === 2, `2-frame source alternates (${oei.seen.join('')})`);
  const one = await seq('hollow-hold');
  ok(new Set(one.seen).size === 1, 'single-frame hold stays still');
  await page.goto(URL + '#/library'); await page.fill('#libSearch', 'goblet'); await page.waitForTimeout(500);
  await page.locator('#libList button.demo.src-wg').first().tap();
  await page.waitForSelector('.sheet .demo-lg.src-wg.ready');
  ok((await page.locator('.sheet .demo-credit').innerText()).includes('Bryl Lim'), 'Workout Guide credit names the creator');
  await page.screenshot({ path: '/tmp/shots/feat-wg.png' });
  await page.tap('.sheet-head [data-act="closeSheet"]');
  await page.fill('#libSearch', 'arnold'); await page.waitForTimeout(500);
  await page.locator('#libList button.demo.src-oei').first().tap();
  await page.waitForSelector('.sheet .demo-lg.src-oei.ready');
  const oc = await page.locator('.sheet .demo-credit').innerText();
  ok(oc.includes('CC0') && oc.includes('AI-generated'), 'AI-generated source is labelled as such, with CC0');
  await page.screenshot({ path: '/tmp/shots/feat-oei.png' });
  await page.tap('.sheet-head [data-act="closeSheet"]');
  await page.goto(URL + '#/settings'); await page.waitForTimeout(300);
  const about = await page.locator('main').innerText();
  ok(['Everkinetic', 'Workout Guide', 'Open Exercise Illustrations', 'CC BY-SA 4.0', 'CC0'].every((t) => about.includes(t)) && about.includes(`${integ.n} of `), 'Settings credits every illustration source');

  console.log('Caching & fallbacks');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await page.waitForTimeout(500); // page now controlled by the service worker
  await page.goto(URL + '#/library'); await page.fill('#libSearch', 'hammer curl'); await page.waitForTimeout(600);
  const before = Object.assign({}, mediaHits);
  await page.fill('#libSearch', ''); await page.waitForTimeout(150); await page.fill('#libSearch', 'hammer curl'); await page.waitForTimeout(600);
  const fromNet = await page.evaluate(async () => {
    const c = await caches.open('forge-media-v1');
    return (await c.keys()).length;
  });
  ok(fromNet > 0, `viewed demonstrations are stored in the media cache (${fromNet} files)`);
  await ctx.setOffline(true);
  await page.goto(URL + '#/library'); await page.fill('#libSearch', 'hammer curl'); await page.waitForTimeout(600);
  ok((await page.locator('#libList .demo.ready').count()) >= 1 && (await page.locator('#libList .demo.failed').count()) === 0, 'cached demonstrations work offline');
  await page.fill('#libSearch', 'goblet'); await page.waitForTimeout(600);
  ok((await page.locator('#libList .demo.src-wg.ready').count()) >= 1 && (await page.locator('#libList .demo.failed').count()) === 0, 'cached Workout Guide frames work offline');
  await ctx.setOffline(false);
  // a file that cannot load degrades to the fallback (no broken-image icon)
  const failed = await page.evaluate(() => new Promise((res) => {
    const wrap = document.createElement('div');
    wrap.innerHTML = WT.h.demo('db-bench-press', 'md').replace(/data-src="[^"]+"/g, 'data-src="media/everkinetic/does-not-exist.svg"');
    document.getElementById('main').prepend(wrap);
    WT.mountDemos(wrap);
    setTimeout(() => { const el = wrap.firstElementChild; res({ failed: el.classList.contains('failed'), imgVisible: [...el.querySelectorAll('img')].some((i) => getComputedStyle(i).display !== 'none') }); }, 800);
  }));
  ok(failed.failed && !failed.imgVisible, 'a demonstration that fails to load shows the fallback, not a broken image');
  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
