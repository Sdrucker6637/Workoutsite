/* Drop sets and build-up sets (multi-stage sets), plus regression checks for plain set types.
 * Serve the repo root on :8765 first:  python3 -m http.server 8765
 * then: node tests/settypes.test.js   (requires playwright) */
const { chromium, devices } = require('playwright');
const URL = process.env.URL || 'http://localhost:8765/';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };

const daysAgo = (n, h = 17) => { const d = new Date(Date.now() - n * 864e5); d.setHours(h, 0, 0, 0); return d.toISOString(); };
// Existing (v2) data written by the previous version of the app: plain sets only.
const plainSets = [{ w: '30', r: '12', done: true, at: daysAgo(4) }, { w: '30', r: '11', done: true, at: daysAgo(4) }, { w: '30', r: '10', done: true, at: daysAgo(4) }];
const SEED = {
  version: 2,
  profile: { name: 'Keep me', unit: 'lb', theme: 'light', dumbbells: { min: 5, max: 100, step: 5, microLoad: false }, favorites: ['pullup'] },
  customExercises: [],
  overrides: {},
  history: [
    { id: 'old-1', type: 'arms', title: 'Arms', startedAt: daysAgo(4), endedAt: daysAgo(4, 18), durationSec: 3600, totals: { sets: 6, volume: 2730 }, prs: [], notes: 'kept',
      exercises: [
        { uid: 'a', exId: 'db-curl', name: 'Dumbbell Curl', intensity: 'regular', targetSets: 3, repMin: 8, repMax: 12, rest: 60, sets: JSON.parse(JSON.stringify(plainSets)) },
        { uid: 'b', exId: 'cable-pushdown', name: 'Cable Pushdown', intensity: 'regular', targetSets: 3, repMin: 8, repMax: 12, rest: 60, sets: [{ w: '50', r: '12', done: true }, { w: '50', r: '12', done: true }, { w: '50', r: '12', done: true }] },
      ] },
  ],
  active: null,
  draft: null,
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const db = () => page.evaluate(() => JSON.parse(JSON.stringify(WT.db)));
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('wt.data.v1')));
  const item = async (exId) => (await db()).active.exercises.find((e) => e.exId === exId);
  const focus = async (exId) => { const it = await item(exId); await page.tap(`[data-act="woFocus"][data-uid="${it.uid}"]`); await page.waitForTimeout(80); return it.uid; };
  const clearTimer = () => page.evaluate(() => { WT.db.active.timer = null; WT.renderTimer(); });
  const timer = () => page.evaluate(() => WT.db.active && WT.db.active.timer ? WT.db.active.timer.label : null);
  const val = (sel) => page.locator(sel).inputValue();
  const counter = async () => (await page.locator('.train-head ~ .footnote').first().innerText()).trim();

  /* ───────── 1. Existing data is preserved and migrated ───────── */
  console.log('Existing data');
  await page.goto(URL);
  // stop the page's own unload flush from overwriting the seed (as tests/e2e.test.js does)
  await page.evaluate((seed) => { WT.flush = WT.save = () => {}; localStorage.setItem('wt.data.v1', JSON.stringify(seed)); }, SEED);
  await page.reload();
  await page.waitForTimeout(300);
  let m = await db();
  ok(m.version === 3, 'data model migrated v2 → v3');
  ok(m.history.length === 1 && m.history[0].notes === 'kept' && m.profile.name === 'Keep me' && m.profile.favorites[0] === 'pullup', 'history, notes and settings untouched');
  ok(JSON.stringify(m.history[0].exercises[0].sets) === JSON.stringify(plainSets), 'existing plain sets are byte-for-byte unchanged');
  ok((await stored()).history.length === 1, 'nothing cleared from localStorage');

  /* ───────── 2. Set-type picker ───────── */
  console.log('Set-type picker');
  await page.evaluate(() => {
    const mk = (exId, int) => WT.sessionItem(exId, Object.assign({ exId }, WT.prescribe(WT.ex(exId), int)));
    WT.db.active = { id: 'live', type: 'custom', title: 'Mixed', startedAt: new Date().toISOString(), notes: '', exercises: [mk('db-bench-press', 'heavy'), mk('cable-pushdown', 'regular'), mk('db-lateral-raise', 'burnout'), mk('db-curl', 'regular'), mk('leg-press', 'regular'), mk('pushup', 'regular')] };
    WT.db.active.focus = WT.db.active.exercises[3].uid;
    WT.save(true);
  });
  await page.goto(URL + '#/workout');
  await page.waitForTimeout(300);
  await page.tap('.cur [data-act="pickIntensity"]');
  await page.waitForTimeout(350);
  const names = await page.locator('.sheet [data-act="setIntensity"] .ti').allInnerTexts();
  ok(['Heavy', 'Regular', 'Burnout', 'Standard', 'Drop set', 'Build-up set'].every((n) => names.some((x) => x.includes(n))), 'picker lists all set types incl. Drop set and Build-up set');
  ok(!(await page.locator('.sheet [data-act="setIntensity"][data-k="drop"]').isDisabled()), 'drop set available for a weighted exercise');
  ok((await page.locator('.sheet [data-act="setIntensity"][data-k="drop"]').innerText()).includes('2 × 3 stages'), 'drop set shows its default: 2 sets × 3 stages');
  await page.tap('.sheet [data-act="setIntensity"][data-k="drop"]');
  await page.waitForTimeout(350);
  let it = await item('db-curl');
  ok(it.intensity === 'drop' && it.sets.length === 3 && it.sets.every((s) => s.type === 'drop' && s.stages.length === 3), 'switching mid-workout keeps the 3 sets, each now 3 drop stages');
  ok(JSON.stringify(it.sets[0].stages.map((s) => s.tr)) === '[8,8,10]', 'stage rep targets 8, 8, 10');
  await focus('pushup');
  await page.tap('.cur [data-act="pickIntensity"]');
  await page.waitForTimeout(350);
  ok(await page.locator('.sheet [data-act="setIntensity"][data-k="drop"]').isDisabled(), 'drop set is not offered for a bodyweight exercise');
  ok(await page.locator('.sheet [data-act="setIntensity"][data-k="buildup"]').isDisabled(), 'build-up set is not offered for a bodyweight exercise');
  await page.tap('.sheet-head [data-act="closeSheet"]');
  await page.waitForTimeout(300);

  /* ───────── 3. Plain set types behave exactly as before ───────── */
  console.log('Heavy / Regular / Burnout unchanged');
  for (const [exId, w, r] of [['db-bench-press', '50', '6'], ['cable-pushdown', '40', '10'], ['db-lateral-raise', '15', '15']]) {
    const uid = await focus(exId);
    await clearTimer();
    await page.fill('.cur [data-in="setVal"][data-f="w"]', w);
    await page.fill('.cur [data-in="setVal"][data-f="r"]', r);
    await page.tap(`[data-act="woCheck"][data-uid="${uid}"]`);
    await page.waitForTimeout(120);
    const x = await item(exId);
    // same shape as before this feature (woCheck has always stored w, r, time, done, at)
    ok(x.sets[0].done && Object.keys(x.sets[0]).sort().join() === 'at,done,r,time,w' && !('stages' in x.sets[0]) && !('type' in x.sets[0]) && x.sets[0].w === w && x.sets[0].r === r, `${x.intensity}: plain set stored exactly as before (no stages/type)`);
    ok(x.sets[1].w === w && !x.sets[1].done, `${x.intensity}: weight carries to the next set`);
    ok((await timer()) === 'Rest', `${x.intensity}: rest timer after the set`);
    ok((await page.locator('.cur .editor.staged').count()) === 0, `${x.intensity}: regular editor, no stage editor`);
  }

  /* ───────── 4. Drop set: log, defaults, add / edit / remove, complete ───────── */
  console.log('Drop set');
  let uid = await focus('db-curl');
  await clearTimer();
  const before = await counter();
  ok((await page.locator('.cur .editor.staged.drop').count()) === 1, 'compact stage editor shown');
  ok((await page.locator('.cur .set-line.stage').count()) === 3, 'three stages listed');
  ok((await page.locator('.cur .editor-label').innerText()).includes('Drop set 1 of 3 · Stage 1 of 3'), 'label names the set and the current stage');
  ok((await page.locator('.cur .stage-hint').innerText()).includes('Lower the weight each stage'), 'tells the user weight goes down');
  ok((await page.locator('.cur .set-line.stage.editing').getAttribute('aria-current')) === 'step', 'current stage is highlighted');
  await page.fill('.cur [data-in="setVal"][data-k="0"][data-f="w"]', '40');
  await page.fill('.cur [data-in="setVal"][data-k="0"][data-f="r"]', '8');
  await page.tap(`[data-act="woStageCheck"][data-uid="${uid}"][data-k="0"]`);
  await page.waitForTimeout(120);
  it = await item('db-curl');
  ok(it.sets[0].stages[0].done && it.sets[0].stages[0].w === '40' && !it.sets[0].done, 'stage 1 logged; the set stays open');
  ok((await timer()) === null, 'no rest timer between drop-set stages');
  ok((await counter()) === before, 'set counter unchanged mid-sequence');
  ok((await page.locator('.cur .editor-label').innerText()).includes('Stage 2 of 3'), 'moves on to stage 2');
  ok(+(await val('.cur [data-in="setVal"][data-k="1"][data-f="w"]')) === 30, 'stage 2 suggests a lighter weight (30 lb after 40 lb)');
  // weight going the wrong way is flagged, not blocked
  await page.fill('.cur [data-in="setVal"][data-k="1"][data-f="w"]', '45');
  await page.evaluate(() => WT.rerender());
  ok((await page.locator('.cur .stage-warn').innerText()).includes('Not lighter than stage 1'), 'warns when a drop stage is not lighter');
  await page.fill('.cur [data-in="setVal"][data-k="1"][data-f="w"]', '30');
  await page.tap(`.cur [data-act="adj"][data-k="1"][data-f="r"][data-d="1"]`); // 8 → 9 with the stepper
  await page.waitForTimeout(80);
  ok((await page.locator('.cur .stage-warn').count()) === 0, 'warning clears once the weight drops');
  await page.tap(`[data-act="woStageCheck"][data-uid="${uid}"][data-k="1"]`);
  await page.waitForTimeout(100);
  // add a fourth stage, then remove it again
  await page.tap(`.cur [data-act="woStageAdd"]`);
  await page.waitForTimeout(100);
  ok((await page.locator('.cur .set-line.stage').count()) === 4 && (await page.locator('.cur .editor-label').innerText()).includes('Stage 4 of 4'), 'Add stage appends a stage and selects it');
  it = await item('db-curl');
  ok(it.sets[1].stages.length === 4, 'new stage count carries to the next unlogged drop set');
  await page.tap(`.cur [data-act="woStageRemove"][data-k="3"]`);
  await page.waitForTimeout(100);
  ok((await page.locator('.cur .set-line.stage').count()) === 3, 'Remove stage deletes it');
  ok(+(await val('.cur [data-in="setVal"][data-k="2"][data-f="w"]')) === 20, 'stage 3 suggests lighter again (20 lb)');
  await page.fill('.cur [data-in="setVal"][data-k="2"][data-f="r"]', '10');
  await page.tap(`[data-act="woStageCheck"][data-uid="${uid}"][data-k="2"]`);
  await page.waitForTimeout(150);
  it = await item('db-curl');
  ok(it.sets[0].done && it.sets[0].stages.every((s) => s.done), 'logging the last stage completes the set');
  ok(JSON.stringify(it.sets[0].stages.map((s) => [s.w, s.r])) === '[["40","8"],["30","9"],["20","10"]]', 'each stage keeps its own weight and reps');
  ok(it.sets.filter((s) => s.done).length === 1, 'the whole sequence counts as ONE set');
  ok((await timer()) === 'Rest', 'normal rest timer after the full sequence');
  ok((await page.locator(`.cur .set-line:not(.stage)`).first().innerText()).includes('40×8 → 30×9 → 20×10'), 'set line summarises the stages');
  // edit a completed stage
  await page.tap(`.cur .set-line[data-act="woEditSet"][data-i="0"]`);
  await page.waitForTimeout(80);
  ok((await page.locator('.cur .editor-label').innerText()).includes('Edit drop set 1'), 'completed drop set can be reopened');
  await page.tap(`.cur [data-act="woStageSel"][data-i="0"][data-k="1"]`);
  await page.waitForTimeout(80);
  await page.tap(`.cur [data-act="adj"][data-k="1"][data-f="r"][data-d="1"]`);
  await page.tap(`.cur [data-act="woStageDone"]`);
  await page.waitForTimeout(80);
  it = await item('db-curl');
  ok(it.sets[0].stages[1].r === '10' && it.sets[0].done, 'editing a logged stage updates only that stage');
  // second drop set ended early (incomplete sequence)
  await clearTimer();
  await page.fill('.cur [data-in="setVal"][data-k="0"][data-f="w"]', '40');
  await page.fill('.cur [data-in="setVal"][data-k="0"][data-f="r"]', '7');
  await page.tap(`[data-act="woStageCheck"][data-uid="${uid}"][data-k="0"]`);
  await page.waitForTimeout(100);
  ok((await page.locator('.cur [data-act="woStageFinish"]').innerText()).includes('End set after 1 stage'), 'can end a sequence early');
  await page.tap('.cur [data-act="woStageFinish"]');
  await page.waitForTimeout(150);
  it = await item('db-curl');
  ok(it.sets[1].done && it.sets[1].stages.filter((s) => s.done).length === 1, 'incomplete sequence saved as a done set with 1 logged stage');

  /* ───────── 5. Build-up set ───────── */
  console.log('Build-up set');
  uid = await focus('leg-press');
  await page.tap('.cur [data-act="pickIntensity"]');
  await page.waitForTimeout(350);
  await page.tap('.sheet [data-act="setIntensity"][data-k="buildup"]');
  await page.waitForTimeout(350);
  it = await item('leg-press');
  ok(it.intensity === 'buildup' && it.sets.every((s) => s.type === 'buildup' && s.stages.length === 3) && JSON.stringify(it.sets[0].stages.map((s) => s.tr)) === '[12,9,6]', 'build-up: 3 stages, reps falling 12 → 9 → 6');
  ok((await page.locator('.cur .stage-hint').innerText()).includes('Add weight each stage'), 'tells the user weight goes up');
  await clearTimer();
  await page.fill('.cur [data-in="setVal"][data-k="0"][data-f="w"]', '100');
  await page.tap(`[data-act="woStageCheck"][data-uid="${uid}"][data-k="0"]`);
  await page.waitForTimeout(100);
  ok(/stage 2/i.test((await timer()) || ''), 'rest between build-up stages (optional timer started)');
  const w2 = +(await val('.cur [data-in="setVal"][data-k="1"][data-f="w"]'));
  ok(w2 > 100, `stage 2 suggests a heavier weight (${w2} after 100)`);
  await page.tap(`[data-act="woStageCheck"][data-uid="${uid}"][data-k="1"]`);
  await page.waitForTimeout(80);
  const w3 = +(await val('.cur [data-in="setVal"][data-k="2"][data-f="w"]'));
  ok(w3 > w2, `stage 3 heavier again (${w3})`);
  await page.fill('.cur [data-in="setVal"][data-k="2"][data-f="w"]', String(w2));
  await page.evaluate(() => WT.rerender());
  ok((await page.locator('.cur .stage-warn').innerText()).includes('Not heavier than stage 2'), 'warns when a build-up stage is not heavier');
  await page.fill('.cur [data-in="setVal"][data-k="2"][data-f="w"]', String(w3));
  await page.tap(`[data-act="woStageCheck"][data-uid="${uid}"][data-k="2"]`);
  await page.waitForTimeout(120);
  it = await item('leg-press');
  ok(it.sets[0].done && it.sets[0].stages.map((s) => +s.w).join() === `100,${w2},${w3}`, 'build-up set completes with increasing stage weights');
  // second build-up set: partially logged then the workout ends (unfinished set is not saved)
  await page.tap(`[data-act="woStageCheck"][data-uid="${uid}"][data-k="0"]`);
  await page.waitForTimeout(80);

  /* ───────── 6. Mobile layout ───────── */
  const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  ok(!over, 'stage editor fits a phone screen (no horizontal scroll)');
  await page.screenshot({ path: '/tmp/shots/settypes-buildup.png' });

  /* ───────── 7. Save and review ───────── */
  console.log('History');
  const live = await db();
  const plainDone = live.active.exercises.filter((e) => !e.intensity.match(/drop|buildup/)).reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  await page.tap('button.btn-block[data-act="woFinish"]');
  await page.waitForTimeout(350);
  await page.tap('[data-act="woSave"]');
  await page.waitForTimeout(500);
  m = await db();
  const saved = m.history.find((s) => s.id === 'live');
  const curl = saved.exercises.find((e) => e.exId === 'db-curl');
  const lp = saved.exercises.find((e) => e.exId === 'leg-press');
  ok(curl.sets.length === 2 && curl.sets[0].stages.length === 3 && curl.sets[1].stages.length === 1, 'drop sets saved with every logged stage (3 and 1)');
  ok(lp.sets.length === 1 && lp.sets[0].stages.length === 3, 'unfinished build-up sequence not saved; finished one kept');
  ok(saved.totals.sets === plainDone + 3, `set total counts each sequence once (${saved.totals.sets} = ${plainDone} plain + 3 staged)`);
  const vol = (s) => (s.stages ? s.stages : [s]).reduce((a, x) => a + (+x.w || 0) * (+x.r || 0), 0);
  ok(saved.totals.volume === Math.round(saved.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + vol(s), 0), 0)), 'volume includes every stage');
  ok(saved.exercises.filter((e) => e.exId !== 'db-curl' && e.exId !== 'leg-press').every((e) => e.sets.every((s) => !('stages' in s))), 'plain sets saved without stages');
  ok((await stored()).history.length === 2 && (await stored()).history[0].id === 'old-1', 'saved to localStorage alongside the old history');
  await page.evaluate(() => WT.closeSheet(true));
  await page.goto(URL + '#/history/live');
  await page.waitForTimeout(300);
  ok((await page.locator('tr.staged-head').count()) === 3, 'history shows one row per sequence');
  ok((await page.locator('tr.stage-row').count()) === 7, 'with every stage listed underneath (3 + 1 + 3)');
  const txt = await page.locator('main').innerText();
  ok(txt.includes('Drop set · 3 stages') && txt.includes('Drop set · 1 stage') && txt.includes('Build-up set · 3 stages'), 'sequence rows name the set type and stage count');
  ok(/Stage 1\s*40 lb × 8/.test(txt) && /Stage 2\s*30 lb × 10/.test(txt), 'stage weights and reps are shown');
  await page.screenshot({ path: '/tmp/shots/settypes-history.png', fullPage: true });

  /* ───────── 8. Progression ───────── */
  console.log('Progression');
  const prog = await page.evaluate(() => {
    const drop = WT.recommend('db-curl', { repMin: 8, repMax: 12, sets: 2, intensity: 'drop', stages: 3 });
    const reg = WT.recommend('db-curl', { repMin: 8, repMax: 12, sets: 3, intensity: 'regular' });
    const straightHist = WT.exerciseHistory('db-curl', null, 'straight');
    const dropHist = WT.exerciseHistory('db-curl', null, 'drop');
    return { drop, reg, straightN: straightHist.length, straightSets: straightHist.map((h) => h.sets.length), dropGroups: dropHist.map((h) => h.groups.map((g) => g.length)) };
  });
  ok(prog.drop.kind === 'drop' && prog.drop.stages.length === 3, 'drop-set recommendation gives a target per stage');
  ok(prog.drop.reasons.some((r) => r.startsWith('Stage 1: 40 lb × 8')) && prog.drop.reasons.some((r) => r.startsWith('Stage 2: 30 lb × 10')), 'compares each stage with the same stage last time');
  ok(prog.drop.stages[0].w === 40 && prog.drop.stages[1].w === 35 && prog.drop.stages[2].w === 20, 'only the stage that beat its target moves up (40 → 35 → 20)');
  ok(prog.straightN === 1 && prog.straightSets[0] === 3, 'plain-set history excludes stages (still the 3 old plain sets)');
  ok(prog.reg.basis && prog.reg.basis.sets.length === 3 && prog.reg.basis.sets.every((s) => s.w === 30), 'regular recommendation still based on plain sets only');
  ok(JSON.stringify(prog.dropGroups) === '[[3,1]]', 'drop history keeps both sequences grouped');
  // repeat the workout: set types and stage counts carry over
  await page.tap('[data-act="histRepeat"]');
  await page.waitForTimeout(400);
  m = await db();
  const rc = m.active.exercises.find((e) => e.exId === 'db-curl');
  const rl = m.active.exercises.find((e) => e.exId === 'leg-press');
  ok(rc.intensity === 'drop' && rc.sets.every((s) => s.type === 'drop' && s.stages.length === 3), 'repeat workout keeps drop sets (3 stages)');
  ok(rl.intensity === 'buildup' && rl.stageRest === 60, 'repeat workout keeps build-up sets');
  await page.tap(`[data-act="woFocus"][data-uid="${rc.uid}"]`);
  await page.waitForTimeout(150);
  ok((await page.locator('.cur .advice .h').innerText()).startsWith('Drop set: 40 → 35 → 20'), 'recommendation shown during the next drop set');
  await page.tap('.cur [data-act="woApplyRec"]');
  await page.waitForTimeout(100);
  m = await db();
  ok(m.active.exercises.find((e) => e.exId === 'db-curl').sets[0].stages.map((s) => s.w).join() === '40,35,20', 'Apply fills each stage with its recommended load');
  await page.evaluate(() => { WT.db.active = null; WT.save(true); });

  /* ───────── 9. Plans (draft) ───────── */
  console.log('Plans');
  await page.evaluate(() => {
    WT.db.draft = { id: 'd1', type: 'arms', title: 'Arms', createdAt: new Date().toISOString(), settings: WT.defaultSettings('arms'), notes: [], exercises: [Object.assign({ uid: 'p1', exId: 'db-curl', slot: { label: 'Biceps', m: ['biceps'], p: null }, slotIndex: 0, why: [] }, WT.prescribe(WT.ex('db-curl'), 'regular'))] };
    WT.save(true);
  });
  await page.goto(URL + '#/generate');
  await page.waitForTimeout(300);
  await page.tap('.ex-row [data-act="pickIntensity"]');
  await page.waitForTimeout(350);
  await page.tap('.sheet [data-act="setIntensity"][data-k="drop"]');
  await page.waitForTimeout(350);
  ok((await page.locator('.ex-row').first().innerText()).includes('2 × 3 stages'), 'plan row shows the drop-set prescription');
  ok((await page.locator('.ex-row').first().innerText()).includes('40 → 35 → 20 lb'), 'plan row shows the per-stage loads');
  await page.tap('.sticky-cta [data-act="startDraft"]');
  await page.waitForTimeout(400);
  m = await db();
  ok(m.active.exercises[0].sets.every((s) => s.type === 'drop' && s.stages.length === 3), 'starting the plan creates drop sets');
  await page.evaluate(() => { WT.db.active = null; WT.save(true); });

  /* ───────── 10. Export / import ───────── */
  console.log('Export & import');
  const rt = await page.evaluate(() => {
    const before = JSON.stringify(WT.db.history);
    const txt = WT.exportData();
    WT.importData(txt, 'replace');
    const afterReplace = JSON.stringify(WT.db.history);
    const keep = JSON.parse(txt);
    WT.db.history = [];
    WT.importData(JSON.stringify(keep), 'merge');
    return { same: afterReplace === before, merged: JSON.stringify(WT.db.history) === before, v: WT.db.version };
  });
  ok(rt.same && rt.v === 3, 'export → import (replace) keeps every stage');
  ok(rt.merged, 'export → import (merge) keeps every stage');
  const oldImport = await page.evaluate((seed) => { WT.importData(JSON.stringify({ app: 'workout-tracker', data: seed }), 'replace'); return { v: WT.db.version, sets: JSON.stringify(WT.db.history[0].exercises[0].sets) }; }, SEED);
  ok(oldImport.v === 3 && oldImport.sets === JSON.stringify(plainSets), 'importing an old (v2) backup still works and is migrated');

  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
