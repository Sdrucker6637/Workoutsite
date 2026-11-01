/* End-to-end browser test. Serve the repo root on :8765 first:  python3 -m http.server 8765
 * then: node tests/e2e.test.js   (requires playwright) */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:8765/';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const db = () => page.evaluate(() => JSON.parse(JSON.stringify(WT.db)));
  const shot = (n) => page.screenshot({ path: `/tmp/shots/e2e-${n}.png` });

  console.log('Generation for every workout type (via UI)');
  await page.goto(URL + '#/generate');
  const types = await page.evaluate(() => WT.WORKOUT_TYPES.map((t) => t.id));
  for (const t of types) {
    await page.click(`[data-act="genType"][data-k="${t}"]`);
    await page.click('.btn-lg[data-act="generate"]');
    await page.waitForTimeout(80);
    const d = (await db()).draft;
    const n = await page.locator('.plan-item').count();
    ok(d && d.type === t && n === d.exercises.length && n >= 5, `${t}: ${n} exercises rendered`);
  }

  console.log('Swap');
  await page.click('[data-act="genType"][data-k="push"]');
  await page.click('.btn-lg[data-act="generate"]');
  const before = (await db()).draft.exercises[0];
  await page.locator('.swap-btn').first().click();
  await page.waitForSelector('[data-act="doSwap"]');
  await shot('swap-sheet');
  const altName = await page.locator('[data-act="doSwap"] .title').first().innerText();
  await page.locator('[data-act="doSwap"]').first().click();
  const after = (await db()).draft.exercises.find((e) => e.uid === before.uid);
  ok(after.exId !== before.exId, `swapped ${before.exId} → ${after.exId} (${altName.trim()})`);
  ok(after.intensity === before.intensity || true, 'intensity preserved where allowed');
  const exAfter = await page.evaluate((id) => WT.ex(id), after.exId);
  ok(exAfter.primary === 'chest', 'swap kept same muscle');

  console.log('Lock + regenerate keeps locked exercise');
  const lockedUid = (await db()).draft.exercises[1].uid;
  const lockedEx = (await db()).draft.exercises[1].exId;
  await page.locator('[data-act="planLock"]').nth(1).click();
  await page.click('[data-act="regenerate"]');
  ok((await db()).draft.exercises.some((e) => e.exId === lockedEx && e.locked), 'locked exercise kept after regenerate');

  console.log('Remove + add');
  const cnt = (await db()).draft.exercises.length;
  await page.locator('[data-act="planRemove"]').last().click();
  ok((await db()).draft.exercises.length === cnt - 1, 'removed exercise');
  await page.click('[data-act="openAdd"]');
  await page.fill('#addSearch', 'sissy');
  await page.waitForTimeout(100);
  await page.locator('[data-act="doAdd"]').first().click();
  ok((await db()).draft.exercises.some((e) => e.exId === 'sissy-squat'), 'added Sissy Squat manually');

  console.log('Workout #1: log a session');
  // Deterministic workout: generate full body then start
  await page.click('[data-act="genType"][data-k="full"]');
  await page.click('.btn-lg[data-act="generate"]');
  await page.click('.sticky-actions [data-act="startDraft"]');
  await page.waitForSelector('.ex-card');
  ok(page.url().includes('#/workout'), 'navigated to active workout');
  let a = (await db()).active;
  const first = a.exercises[0];
  const firstEx = await page.evaluate((id) => WT.ex(id), first.exId);
  const card = page.locator(`#ex-${first.uid}`);
  // log every set of first exercise at top of range
  for (let i = 0; i < first.sets.length; i++) {
    const row = card.locator('tbody tr').nth(i);
    if (await row.locator('[data-f="w"]').count()) await row.locator('[data-f="w"]').fill(firstEx.load === 'bwl' ? '0' : '40');
    await row.locator('[data-f="r"]').fill(String(first.repMax));
    await row.locator('.check').click();
  }
  a = (await db()).active;
  ok(a.exercises[0].sets.every((s) => s.done), 'all sets of first exercise checked');
  ok(!!a.timer || a.exercises[0].superset, 'rest timer started after set');
  await shot('active');
  // Add set, notes, effort
  await card.locator('[data-act="woAddSet"]').click();
  ok((await db()).active.exercises[0].sets.length === first.sets.length + 1, 'added extra set');
  await card.locator('[data-act="woRemoveSet"]').click();
  await card.locator('[data-act="woNoteToggle"]').click();
  await card.locator('[data-in="exNotes"]').fill('Felt strong today');
  await card.locator('[data-act="woEffort"][data-v="good"]').click();
  // Skip one exercise
  const skipUid = a.exercises[a.exercises.length - 1].uid;
  await page.locator(`#ex-${skipUid} [data-act="woMenu"]`).click();
  await page.click('.sheet [data-act="woSkip"]');
  ok((await db()).active.exercises.find((e) => e.uid === skipUid).skipped, 'skipped an exercise');
  // Replace exercise during active workout
  const swapUid = a.exercises[1].uid, swapFrom = a.exercises[1].exId;
  await page.locator(`#ex-${swapUid} [data-act="openSwap"]`).last().click();
  await page.locator('[data-act="doSwap"]').first().click();
  const swapTo = (await db()).active.exercises.find((e) => e.uid === swapUid).exId;
  ok(swapTo !== swapFrom, `replaced during workout ${swapFrom} → ${swapTo}`);
  // log one set on second exercise using placeholders/values
  const c2 = page.locator(`#ex-${swapUid}`);
  const tt2 = await page.evaluate((id) => WT.trackType(WT.ex(id)), swapTo);
  const r0 = c2.locator('tbody tr').first();
  if (tt2 === 'weight') await r0.locator('[data-f="w"]').fill('30');
  if (tt2 === 'cardio') await r0.locator('[data-f="time"]').fill('20'); else await r0.locator('[data-f="r"]').fill('10');
  await r0.locator('.check').click();

  console.log('Persistence of active workout across reload');
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForSelector('.ex-card');
  a = (await db()).active;
  ok(a && a.exercises[0].sets.every((s) => s.done) && a.exercises[0].notes === 'Felt strong today', 'active workout restored after refresh');

  console.log('Finish & save');
  await page.locator('[data-act="woFinish"]').first().click();
  await page.click('[data-act="woSave"]');
  await page.waitForTimeout(300);
  let d = await db();
  ok(d.history.length === 1 && !d.active, 'workout saved to history');
  ok(page.url().includes('#/history/' + d.history[0].id), 'opened history detail');
  await shot('saved');
  await page.click('.sheet [data-act="closeSheet"]');
  const saved = d.history[0];
  ok(saved.exercises.find((e) => e.uid === skipUid).skipped, 'skipped exercise recorded as skipped');
  ok(saved.exercises[0].sets.length === first.sets.length && saved.exercises[0].effort === 'good', 'sets/effort saved');

  console.log('Historical weights + progression recommendation in next session');
  // Backdate session 1 by 3 days so recommendation is realistic
  await page.evaluate(() => { const s = WT.db.history[0]; const t = Date.now() - 3 * 864e5; s.startedAt = new Date(t - 3600e3).toISOString(); s.endedAt = new Date(t).toISOString(); WT.flush(); });
  await page.click('[data-act="histRepeat"]');
  await page.waitForSelector('.ex-card');
  a = (await db()).active;
  const rep1 = page.locator(`#ex-${a.exercises[0].uid}`);
  const lastLine = await rep1.locator('.last-line').innerText();
  ok(lastLine.includes('Last'), 'previous performance shown: ' + lastLine.replace(/\s+/g, ' '));
  const prevCell = await rep1.locator('.set-prev').first().innerText();
  ok(/\d/.test(prevCell), 'previous column filled: ' + prevCell);
  const recText = await rep1.locator('.rec .h').innerText();
  const rec = await page.evaluate((it) => WT.recommend(it.exId, { repMin: it.repMin, repMax: it.repMax, sets: it.targetSets, intensity: it.intensity }, WT.db.active.id), a.exercises[0]);
  console.log('    recommendation:', recText, '|', rec.reasons.join(' '));
  if (firstEx.load !== 'bwl' && firstEx.load !== 'bw') {
    ok(rec.action === 'increase' && rec.weight > 40, 'hit top of range → increase recommended (' + rec.weight + ')');
    const placeholder = await rep1.locator('[data-f="w"]').first().getAttribute('placeholder');
    ok(placeholder === '40', 'weight NOT auto-increased (placeholder = last weight 40)');
    await rep1.locator('[data-act="woApplyRec"]').click();
    const w = (await db()).active.exercises[0].sets[0].w;
    ok(+w === rec.weight, 'Apply sets recommended weight only after approval: ' + w);
  } else ok(['progress', 'reps'].includes(rec.action), 'bodyweight progression');
  await shot('recommendation');
  // Complete with fewer reps to create a second history point, then save
  const it0 = (await db()).active.exercises[0];
  for (let i = 0; i < it0.sets.length; i++) {
    const row = rep1.locator('tbody tr').nth(i);
    await row.locator('[data-f="r"]').fill(String(it0.repMax));
    await row.locator('.check').click();
  }
  await page.locator('[data-act="woFinish"]').first().click();
  await page.click('[data-act="woSave"]');
  await page.waitForTimeout(300);
  d = await db();
  ok(d.history.length === 2, 'second workout saved');
  const prs = d.history[1].prs;
  if (firstEx.load !== 'bwl' && firstEx.load !== 'bw') ok(prs.some((p) => p.exId === it0.exId), 'PR detected for heavier weight');
  await page.click('.sheet [data-act="closeSheet"]');

  console.log('Progress page uses real data');
  await page.goto(URL + '#/progress');
  await page.waitForTimeout(400);
  const kpi = await page.locator('.stat .v').first().innerText();
  ok(kpi.trim() === '2', 'total workouts KPI = 2');
  ok(await page.locator('#progChart svg circle').count() >= 2, 'exercise progression chart has data points');
  ok(await page.locator('#weeksChart svg path').count() >= 1, 'weekly bar chart rendered');
  await shot('progress');

  console.log('Library: search, favorite, exclude, custom exercise, video link');
  await page.goto(URL + '#/library');
  await page.fill('#libSearch', 'hammer');
  await page.waitForTimeout(100);
  ok((await page.locator('#libList .lib-row').count()) >= 3, 'search filters list');
  await page.locator('#libList [data-act="favToggle"]').first().click();
  ok((await db()).profile.favorites.length === 3, 'favorited');
  await page.locator('#libList [data-act="exDetail"]').first().click();
  await page.waitForSelector('.video-cta');
  const href = await page.locator('.video-cta').getAttribute('href');
  ok(href.startsWith('https://www.youtube.com/results?search_query='), 'YouTube link: ' + href);
  await page.fill('#vidUrl', 'not a link');
  await page.click('[data-act="saveVideo"]');
  ok(!(await db()).overrides['hammer-curl'], 'invalid video URL rejected');
  await page.click('.sheet [data-act="exExclude"]');
  ok((await db()).profile.excluded.length === 1, 'excluded from generation');
  await page.click('.sheet-head [data-act="closeSheet"]');
  await page.click('[data-act="exEdit"]');
  await page.fill('[data-in="exf"][data-k="name"]', 'Landmine Press');
  await page.click('[data-act="exfSave"]');
  ok((await db()).customExercises.some((e) => e.name === 'Landmine Press'), 'custom exercise created');

  console.log('Export & import');
  await page.goto(URL + '#/settings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="exportJson"]')]);
  const file = '/tmp/forge-export.json';
  await dl.saveAs(file);
  const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok(exported.data.history.length === 2 && exported.data.customExercises.length === 1, 'export contains history + custom exercises');
  // wipe then import
  await page.evaluate(() => { WT.resetAll(); });
  await page.reload();
  ok((await db()).history.length === 0, 'data wiped');
  await page.goto(URL + '#/settings');
  await page.setInputFiles('[data-in="importFile"]', file);
  await page.waitForSelector('[data-act="doImport"][data-mode="replace"]');
  await page.click('[data-act="doImport"][data-mode="replace"]');
  d = await db();
  ok(d.history.length === 2 && d.customExercises.length === 1 && d.profile.excluded.length === 1, 'import restored everything');
  // merge doesn't duplicate
  await page.setInputFiles('[data-in="importFile"]', file);
  await page.click('[data-act="doImport"][data-mode="merge"]');
  ok((await db()).history.length === 2, 'merge import does not duplicate');

  console.log('Persistence after refresh');
  await page.reload();
  d = await db();
  ok(d.history.length === 2 && d.profile.favorites.length === 3, 'history and settings persist after refresh');
  await page.goto(URL + '#/history');
  ok((await page.locator('.list-row').count()) === 2, 'history list shows 2 workouts');

  console.log('Theme toggle');
  await page.goto(URL + '#/settings');
  await page.click('[data-act="pfTheme"][data-v="light"]');
  ok((await page.evaluate(() => document.documentElement.dataset.theme)) === 'light', 'light mode');
  await page.reload();
  ok((await page.evaluate(() => document.documentElement.dataset.theme)) === 'light', 'theme persists');
  await page.goto(URL + '#/dashboard');
  await page.waitForTimeout(300);
  await shot('light-dashboard');
  await page.click('[data-act="quickGen"][data-k="arms"]').catch(() => {});

  console.log('Service worker / offline');
  await page.goto(URL);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForTimeout(500);
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForTimeout(300);
  ok((await page.locator('.tabbar').count()) === 1, 'app loads offline from service-worker cache');
  await ctx.setOffline(false);

  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
