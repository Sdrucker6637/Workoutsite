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
  const db = () => page.evaluate(() => JSON.parse(JSON.stringify(WT.db)));
  const shot = (n) => page.screenshot({ path: `/tmp/shots/e2e-${n}.png` }).catch(() => {});
  const gen = async () => { await page.click('[data-act="generate"]'); await page.waitForTimeout(520); };
  await page.goto(URL);

  console.log('Upgrade from v1 data keeps everything');
  await page.evaluate(() => { WT.flush = WT.save = () => {}; });
  await page.evaluate(() => localStorage.setItem('wt.data.v1', JSON.stringify({ version: 1, profile: { theme: 'dark', name: 'Old', unit: 'lb', goals: ['Reduce body fat and get leaner and more defined', 'Improve chest development — especially the lower chest', 'Build bigger, more noticeable arms', 'Reduce stomach fat and love handles', 'Maintain balanced overall development'], favorites: ['pullup'], excluded: ['crunch'] },
    history: [{ id: 'old1', type: 'push', title: 'Push', startedAt: '2026-10-01T17:00:00.000Z', endedAt: '2026-10-01T18:00:00.000Z', durationSec: 3600, totals: { sets: 3, volume: 1200 }, prs: [], exercises: [{ uid: 'u1', exId: 'db-bench-press', name: 'Dumbbell Bench Press', intensity: 'regular', targetSets: 3, repMin: 6, repMax: 10, sets: [{ w: '40', r: '10', done: true }, { w: '40', r: '10', done: true }, { w: '40', r: '10', done: true }] }] }], customExercises: [], overrides: {} })));
  await page.reload();
  let m = await db();
  ok(m.version === 7 && m.history.length === 1 && m.profile.name === 'Old' && m.profile.excluded[0] === 'crunch', 'v1 history and settings preserved');
  ok(m.profile.theme === 'light' && m.profile.goals[0].startsWith('Reduce overall') && m.profile.intensityRandom === true, 'new defaults applied (theme, unedited goals, intensity odds)');
  ok((await page.evaluate(() => WT.personalRecords('db-bench-press').heaviest.w)) === 40, 'old history feeds records');
  await page.evaluate(() => { WT.flush = WT.save = () => {}; localStorage.clear(); });
  await page.reload();

  console.log('Navigation');
  ok((await page.locator('.tabs .tab').count()) === 5, 'compact 5-tab bar on mobile (Train tab removed; incl. Food)');
  ok((await page.locator('.tabs [data-nav="workout"], .side [data-nav="workout"]').count()) === 0, 'no Train entry in the navigation');
  for (const r of ['dashboard', 'generate', 'workout', 'library', 'history', 'progress', 'food', 'meals', 'achievements', 'settings']) {
    await page.goto(URL + '#/' + r); await page.waitForTimeout(120);
    const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    ok(!over, `${r}: no horizontal overflow`);
  }

  console.log('Generation for every type (via UI)');
  await page.goto(URL + '#/generate');
  for (const t of ['full', 'push', 'pull', 'legs', 'chest', 'back', 'shoulders', 'arms', 'core', 'cardio', 'custom']) {
    await page.click(`[data-act="genType"][data-k="${t}"]`);
    await gen();
    const d = (await db()).draft;
    const n = await page.locator('.ex-row').count();
    ok(d && d.type === t && n === d.exercises.length && n >= 5, `${t}: ${n} exercises`);
  }
  ok((await page.locator('.ex-row a[href*="youtube.com"]').count()) >= 5, 'each exercise has a video link');
  await shot('generate');

  console.log('Randomised intensity through the UI');
  await page.click('[data-act="genType"][data-k="full"]');
  const tallies = new Set(); let noSpecial = false;
  for (let k = 0; k < 18; k++) {
    await gen();
    const ex = (await db()).draft.exercises;
    tallies.add(['heavy', 'regular', 'burnout', 'standard', 'drop', 'buildup'].map((x) => ex.filter((e) => e.intensity === x).length).join('/'));
    if (!ex.some((e) => e.intensity === 'heavy' || e.intensity === 'burnout')) noSpecial = true;
    ok(await page.evaluate(() => WT.db.draft.exercises.every((e) => (WT.STAGED[e.intensity] ? WT.canStage(WT.ex(e.exId)) : WT.ex(e.exId).intensities.includes(e.intensity)))), 'assigned intensities are eligible');
  }
  ok(tallies.size >= 5, `intensity mix varies (${tallies.size} distinct in 18)`);
  console.log('    a workout with no heavy/burnout seen in this sample:', noSpecial);
  // Manual intensity change via the row menu
  const firstUid = (await db()).draft.exercises[0].uid;
  await page.locator('.ex-row [data-act="planMenu"]').first().click();
  await page.click('.sheet [data-act="pickIntensity"]');
  await page.click('[data-act="setIntensity"][data-k="standard"]');
  ok((await db()).draft.exercises.find((e) => e.uid === firstUid).intensity === 'standard', 'manual intensity change applied');
  const ids = JSON.stringify((await db()).draft.exercises.map((e) => e.exId).sort());
  await page.click('[data-act="rerollIntensity"]');
  ok(JSON.stringify((await db()).draft.exercises.map((e) => e.exId).sort()) === ids, 're-roll keeps the same exercises');

  console.log('Swap, lock, remove, add');
  const before = (await db()).draft.exercises[0];
  await page.locator('.ex-row [data-act="openSwap"]').first().click();
  await page.waitForSelector('[data-act="doSwap"]');
  await shot('swap');
  await page.locator('[data-act="doSwap"]').first().click();
  const after = (await db()).draft.exercises.find((e) => e.uid === before.uid);
  const [exB, exA] = await page.evaluate(([a, b]) => [WT.ex(a), WT.ex(b)], [before.exId, after.exId]);
  ok(after.exId !== before.exId, `swapped ${before.exId} → ${after.exId}`);
  ok(exA.primary === exB.primary || before.slot.m.includes(exA.primary), 'swap kept the muscle group');
  ok(after.intensity === before.intensity || !exA.intensities.includes(before.intensity), 'swap kept intensity where eligible');
  const lockEx = (await db()).draft.exercises[1].exId;
  await page.locator('.ex-row [data-act="planMenu"]').nth(1).click();
  await page.click('.sheet [data-act="planLock"]');
  await page.click('[data-act="regenerate"]'); await page.waitForTimeout(520);
  ok((await db()).draft.exercises.some((e) => e.exId === lockEx && e.locked), 'locked exercise survives regenerate');
  const cnt = (await db()).draft.exercises.length;
  await page.locator('.ex-row [data-act="planMenu"]').last().click();
  await page.click('.sheet [data-act="planRemove"]');
  ok((await db()).draft.exercises.length === cnt - 1, 'removed exercise');
  await page.click('[data-act="openAdd"][data-ctx="draft"]');
  await page.fill('#addSearch', 'sissy'); await page.waitForTimeout(80);
  await page.locator('[data-act="doAdd"]').first().click();
  ok((await db()).draft.exercises.some((e) => e.exId === 'sissy-squat'), 'added Sissy Squat');

  console.log('Workout 1: log sets with the editor');
  await page.click('[data-act="genType"][data-k="full"]'); await gen();
  // This flow logs plain sets; staged (drop / build-up) logging is covered in settypes.test.js and v6.test.js
  await page.evaluate(() => { WT.db.draft.exercises.forEach((i) => { if (WT.STAGED[i.intensity]) { delete i.stageCount; delete i.stageRest; Object.assign(i, WT.prescribe(WT.ex(i.exId), 'regular')); } }); WT.save(true); });
  await page.click('.sticky-cta [data-act="startDraft"]');
  await page.waitForSelector('.cur');
  ok(await page.evaluate(() => document.body.classList.contains('focus')), 'focus mode hides navigation while training');
  let a = (await db()).active;
  const cur0 = await page.evaluate(() => WT.currentItem(WT.db.active));
  const ex0 = await page.evaluate((id) => WT.ex(id), cur0.exId);
  const tt0 = await page.evaluate((id) => WT.trackType(WT.ex(id)), cur0.exId);
  for (let i = 0; i < cur0.sets.length; i++) {
    const wIn = page.locator('.field-num input[data-f="w"]');
    if (tt0 === 'weight' && i === 0) await wIn.fill('40');
    const rIn = page.locator('.field-num input[data-f="r"]');
    if (await rIn.count()) await rIn.fill(String(cur0.repMax));
    if (tt0 === 'cardio') await page.locator('.field-num input[data-part="m"]').fill('20');
    await page.click(`[data-act="woCheck"][data-uid="${cur0.uid}"]`);
    if (i === 0) { await shot('train-after-set'); ok(!!(await db()).active.timer || !!cur0.superset, 'rest timer starts (or superset partner) after a set'); }
    // superset partner may take focus; bring this exercise back
    if (i < cur0.sets.length - 1) await page.click(`[data-act="woFocus"][data-uid="${cur0.uid}"]`);
  }
  a = (await db()).active;
  const done0 = a.exercises.find((e) => e.uid === cur0.uid);
  ok(done0.sets.every((s) => s.done), 'all sets of first exercise completed');
  if (tt0 === 'weight') ok(done0.sets.every((s) => s.w === '40'), 'weight carried forward to every set');
  // − / + controls
  const cur1 = await page.evaluate(() => WT.currentItem(WT.db.active));
  if (cur1 && (await page.locator('.field-num input[data-f="r"]').count())) {
    const r0 = +(await page.locator('.field-num input[data-f="r"]').inputValue());
    await page.click('[data-act="adj"][data-f="r"][data-d="1"]');
    ok(+(await page.locator('.field-num input[data-f="r"]').inputValue()) === r0 + 1, '+ increases reps');
  }
  // edit a completed set
  await page.click(`[data-act="woFocus"][data-uid="${cur0.uid}"]`);
  await page.click(`[data-act="woEditSet"][data-uid="${cur0.uid}"][data-i="0"]`);
  ok(await page.locator('[data-act="woUndoSet"]').count() === 1, 'tapping a done set opens it for editing');
  await page.click(`[data-act="woCheck"][data-uid="${cur0.uid}"]`);
  // effort, skip, replace
  if ((await db()).active.askEffort) { await page.click('[data-act="woEffort"][data-v="good"]'); ok((await db()).active.exercises.find((e) => e.uid === cur0.uid).effort === 'good', 'effort recorded'); }
  const lastUid = a.exercises[a.exercises.length - 1].uid;
  await page.click(`[data-act="woFocus"][data-uid="${lastUid}"]`);
  await page.click(`.cur [data-act="woMenu"]`);
  await page.click('.sheet [data-act="woSkip"]');
  ok((await db()).active.exercises.find((e) => e.uid === lastUid).skipped, 'skipped an exercise');
  const swapIt = (await page.evaluate(() => WT.currentItem(WT.db.active)));
  await page.click('.cur [data-act="openSwap"]');
  await page.locator('[data-act="doSwap"]').first().click();
  ok((await db()).active.exercises.find((e) => e.uid === swapIt.uid).exId !== swapIt.exId, 'replaced an exercise mid-workout');
  await page.fill('[data-in="sessionNotes"]', 'Felt strong today');

  console.log('Persistence mid-workout');
  await page.waitForTimeout(300);
  await page.reload(); await page.waitForSelector('.cur');
  a = (await db()).active;
  ok(a && a.exercises.find((e) => e.uid === cur0.uid).sets.every((s) => s.done) && a.notes === 'Felt strong today', 'active workout restored after refresh');

  console.log('Finish & save');
  await page.click('.mtop [data-act="woFinish"]');
  await page.click('[data-act="woSave"]'); await page.waitForTimeout(300);
  let d = await db();
  ok(d.history.length === 1 && !d.active, 'workout saved');
  ok(page.url().includes('#/history/' + d.history[0].id), 'opened history entry');
  await page.click('.sheet [data-act="closeSheet"]');
  ok(d.history[0].exercises.find((e) => e.uid === lastUid).skipped, 'skipped exercise recorded');

  console.log('History → next session uses real data');
  await page.evaluate(() => { const s = WT.db.history[0]; const t = Date.now() - 3 * 864e5; s.startedAt = new Date(t - 3600e3).toISOString(); s.endedAt = new Date(t).toISOString();
    // A second, earlier session at the same numbers: weight only goes up once the top of the range is confirmed
    const p = JSON.parse(JSON.stringify(s)); p.id = 'confirm-prev'; p.startedAt = new Date(t - 3 * 864e5 - 3600e3).toISOString(); p.endedAt = new Date(t - 3 * 864e5).toISOString(); WT.db.history.unshift(p); WT.flush(); });
  await page.click('[data-act="histRepeat"]'); await page.waitForSelector('.cur');
  await page.click(`[data-act="woFocus"][data-uid="${(await db()).active.exercises.find((e) => e.exId === cur0.exId).uid}"]`);
  const it = (await db()).active.exercises.find((e) => e.exId === cur0.exId);
  ok((await page.locator('.editor-label').innerText()).includes('Last time'), 'editor shows last time: ' + (await page.locator('.editor-label').innerText()).replace(/\s+/g, ' '));
  const rec = await page.evaluate((x) => WT.recommend(x.exId, { repMin: x.repMin, repMax: x.repMax, sets: x.targetSets, intensity: x.intensity }, WT.db.active.id), it);
  console.log('    recommendation:', rec.headline, '|', rec.reasons.join(' '));
  if (tt0 === 'weight') {
    ok(rec.action === 'increase' && rec.weight > 40, `top of range → increase (${rec.weight})`);
    ok(+(await page.locator('.field-num input[data-f="w"]').inputValue()) === 40, 'weight NOT auto-increased (shows last weight 40)');
    await page.click('[data-act="woApplyRec"]');
    ok(+(await page.locator('.field-num input[data-f="w"]').inputValue()) === rec.weight, 'Apply sets recommended weight only on approval');
    for (let i = 0; i < it.sets.length; i++) { await page.click(`[data-act="woCheck"][data-uid="${it.uid}"]`); if (i < it.sets.length - 1) await page.click(`[data-act="woFocus"][data-uid="${it.uid}"]`); }
    await shot('train-progress');
  } else await page.click(`[data-act="woCheck"][data-uid="${it.uid}"]`); // bodyweight / timed: log one set so the workout can be saved
  await page.click('.mtop [data-act="woFinish"]'); await page.click('[data-act="woSave"]'); await page.waitForTimeout(300);
  d = await db();
  ok(d.history.length === 3, 'second workout saved (plus the seeded earlier session)');
  if (tt0 === 'weight') ok(d.history[2].prs.some((p) => p.exId === cur0.exId), 'PR detected');
  await page.click('.sheet [data-act="closeSheet"]');

  console.log('Progress');
  await page.goto(URL + '#/progress'); await page.waitForTimeout(350);
  ok((await page.locator('#progChart svg').count()) === 1, 'one chart at a time (strength)');
  await page.click('[data-act="progTab"][data-v="frequency"]'); await page.waitForTimeout(250);
  ok((await page.locator('#weeksChart svg').count()) === 1 && (await page.locator('#progChart').count()) === 0, 'frequency tab swaps the chart');
  await page.click('[data-act="progTab"][data-v="volume"]'); await page.waitForTimeout(250);
  ok((await page.locator('#volChart svg').count()) === 1, 'volume chart');

  console.log('Exercises');
  await page.goto(URL + '#/library');
  await page.fill('#libSearch', 'hammer'); await page.waitForTimeout(80);
  ok((await page.locator('#libList .lib-row').count()) >= 3, 'search filters list');
  const favBefore = (await db()).profile.favorites.length;
  await page.locator('#libList [data-act="favToggle"]').first().click();
  ok((await db()).profile.favorites.length === favBefore + 1, 'favorited');
  await page.locator('#libList [data-act="exDetail"]').first().click();
  await page.waitForSelector('.watch');
  ok((await page.locator('.watch').getAttribute('href')).startsWith('https://www.youtube.com/results?search_query='), 'YouTube tutorial link');
  await page.click('.sheet [data-act="exExclude"]');
  ok((await db()).profile.excluded.length === 1, 'excluded');
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
  ok(exported.data.history.length === 3 && exported.data.customExercises.length === 1, 'export contains history + custom exercises');
  await page.evaluate(() => WT.resetAll()); await page.reload();
  ok((await db()).history.length === 0, 'data wiped');
  await page.goto(URL + '#/settings');
  await page.setInputFiles('[data-in="importFile"]', file);
  await page.click('[data-act="doImport"][data-mode="replace"]');
  d = await db();
  ok(d.history.length === 3 && d.customExercises.length === 1 && d.profile.excluded.length === 1, 'import restored everything');
  await page.setInputFiles('[data-in="importFile"]', file);
  await page.click('[data-act="doImport"][data-mode="merge"]');
  ok((await db()).history.length === 3, 'merge import does not duplicate');
  await page.reload();
  ok((await db()).history.length === 3, 'data persists after refresh');
  await page.goto(URL + '#/history');
  ok((await page.locator('[data-entry]').count()) === 3, 'history lists all workouts');

  console.log('Theme & offline');
  await page.goto(URL + '#/settings');
  await page.click('[data-act="pfTheme"][data-v="dark"]');
  await page.reload();
  ok((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'dark theme persists');
  await page.goto(URL + '#/dashboard'); await page.waitForTimeout(300); await shot('dark-home');
  await page.goto(URL + '#/settings'); await page.click('[data-act="pfTheme"][data-v="light"]');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await page.waitForTimeout(400);
  await ctx.setOffline(true);
  await page.reload(); await page.waitForTimeout(300);
  ok((await page.locator('.tabs').count()) === 1, 'loads offline from service-worker cache');
  await ctx.setOffline(false);

  console.log('Run time in minutes and seconds');
  await page.evaluate(() => { WT.db.active = null; WT.db.history.push({ id: 'run-old', type: 'cardio', title: 'Run', startedAt: '2026-10-20T07:00:00Z', endedAt: '2026-10-20T07:30:00Z', durationSec: 1800, totals: { sets: 1, volume: 0 }, prs: [], exercises: [{ uid: 'r0', exId: 'outdoor-run', name: 'Outdoor Run', intensity: 'standard', targetSets: 1, repMin: 20, repMax: 40, sets: [{ w: '', r: '', time: '30', dist: '3', done: true }] }] }); WT.save(true); });
  await page.goto(URL + '#/workout'); await page.waitForTimeout(200);
  await page.click('[data-act="logRun"]'); await page.waitForTimeout(300);
  ok((await page.locator('[data-part="m"]').inputValue()) === '30' && (await page.locator('[data-part="s"]').inputValue()) === '00', 'old whole-minute run pre-fills as 30:00');
  await page.locator('[data-part="m"]').fill('25'); await page.locator('[data-part="s"]').fill('30');
  await page.locator('.field-num input[data-f="dist"]').fill('3.1');
  ok((await db()).active.exercises[0].sets[0].time === '25.5', 'minutes and seconds stored as decimal minutes (25:30 → 25.5)');
  await page.click('[data-act="adj"][data-f="time"][data-d="1"]');
  ok((await page.locator('[data-part="m"]').inputValue()) === '26' && (await page.locator('[data-part="s"]').inputValue()) === '30', '+ adds a minute and keeps the seconds');
  await page.click('[data-act="adj"][data-f="time"][data-d="-1"]');
  await page.click('[data-act="woCheck"]'); await page.waitForTimeout(100);
  ok((await page.locator('.cur .set-line').first().innerText()).includes('25:30 · 3.1 mi'), 'logged run shows 25:30');
  await page.click('button.btn-block[data-act="woFinish"]'); await page.waitForTimeout(300); await page.click('[data-act="woSave"]'); await page.waitForTimeout(400);
  ok((await page.locator('main table').innerText()).includes('25:30'), 'history shows the run as 25:30');
  ok(await page.evaluate(() => WT.recommend('outdoor-run').reasons[0].includes('8:14')), 'pace still calculated (8:14 /mi)');
  ok(JSON.stringify(await page.evaluate(() => [WT.fmtRunTime(30), WT.fmtRunTime(65.25), WT.fmtRunTime(25 + 7 / 60)])) === '["30:00","1:05:15","25:07"]', 'formats m:ss and h:mm:ss');

  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
