/* v6 features in the browser: navigation without the Train tab, Record a run from Home, Meal ideas,
 * Achievements, drop / build-up settings and stage editing, and upgrading existing (v5) data.
 * Serve the repo root on :8765 first:  python3 -m http.server 8765
 * then: node tests/v6.test.js   (requires playwright) */
const { chromium, devices } = require('playwright');
const URL = process.env.URL || 'http://localhost:8765/';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };
const SHOTS = process.env.SHOTS || '/tmp/shots';
const daysAgo = (n, h = 17) => { const d = new Date(Date.now() - n * 864e5); d.setHours(h, 0, 0, 0); return d.toISOString(); };
const dayKey = (n) => { const d = new Date(Date.now() - n * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Data as the previous version (v5) stored it
const V5 = {
  version: 5,
  profile: { name: 'Sam', unit: 'lb', theme: 'light', favorites: ['pullup', 'sissy-squat'], excluded: ['crunch'], proteinTarget: 160, intensityOdds: { heavy: 20, regular: 40, burnout: 10, standard: 30 }, runsPerWeek: 2, strengthPerWeek: 3 },
  customExercises: [],
  overrides: {},
  history: [
    { id: 'w1', type: 'full', title: 'Full Body', startedAt: daysAgo(9), endedAt: daysAgo(9, 18), durationSec: 3300, totals: { sets: 6, volume: 3000 }, prs: [], notes: 'old notes',
      exercises: [{ uid: 'a', exId: 'db-bench-press', name: 'Dumbbell Bench Press', intensity: 'regular', targetSets: 3, repMin: 8, repMax: 12, sets: [{ w: '50', r: '12', done: true }, { w: '50', r: '12', done: true }, { w: '50', r: '11', done: true }] },
        { uid: 'b', exId: 'goblet-squat', name: 'Goblet Squat', intensity: 'regular', targetSets: 3, repMin: 8, repMax: 12, sets: [{ w: '45', r: '12', done: true }, { w: '45', r: '12', done: true }, { w: '45', r: '12', done: true }] }] },
    { id: 'r1', type: 'cardio', title: 'Run', startedAt: daysAgo(5, 7), endedAt: daysAgo(5, 8), durationSec: 1800, totals: { sets: 1, volume: 0 }, prs: [],
      exercises: [{ uid: 'c', exId: 'outdoor-run', name: 'Outdoor Run', intensity: 'standard', targetSets: 1, repMin: 20, repMax: 40, sets: [{ w: '', r: '', time: '27', dist: '3', done: true }] }] },
  ],
  nutrition: { entries: [{ id: 'n1', date: dayKey(2), at: daysAgo(2, 12), name: 'Chicken breast', qty: 1, unit: 'breast', per: { p: 45, cal: 230, c: 0, f: 5 }, src: 'db', conf: 'estimated' }], foods: [] },
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
  const shot = (n) => page.screenshot({ path: `${SHOTS}/v6-${n}.png`, fullPage: true }).catch(() => {});
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

  console.log('Upgrade keeps existing data');
  await page.goto(URL);
  await page.evaluate((s) => { WT.flush = WT.save = () => {}; localStorage.clear(); localStorage.setItem('wt.data.v1', JSON.stringify(s)); }, V5);
  await page.reload();
  await page.waitForTimeout(1000);
  let m = await stored();
  ok(m.version === 6, 'stored data upgraded to v6');
  ok(JSON.stringify(m.history) === JSON.stringify(V5.history), 'workout and run history byte-identical');
  ok(JSON.stringify(m.nutrition.entries.map((e) => [e.id, e.date, e.per.p])) === JSON.stringify(V5.nutrition.entries.map((e) => [e.id, e.date, e.per.p])), 'food log kept');
  ok(m.profile.name === 'Sam' && m.profile.proteinTarget === 160 && m.profile.favorites.join() === 'pullup,sissy-squat' && m.profile.excluded[0] === 'crunch', 'settings, favorites and exclusions kept');
  ok(m.profile.intensityOdds.regular === 40 && m.profile.intensityOdds.drop > 0, 'custom odds kept, drop / build-up odds added');
  ok(m.achievements.since && Object.values(m.achievements.unlocked).every((u) => u.retro), 'achievements already earned are recorded as earlier history (no fake dates)');
  ok(m.achievements.unlocked['first-run'] && Math.abs(new Date(m.achievements.unlocked['first-run'].at) - new Date(V5.history[1].endedAt)) < 1000, '…and keep the date they actually happened');
  ok((await page.locator('.ach-toast').count()) === 0, 'no celebration for old milestones');

  console.log('Navigation without the Train tab');
  ok((await page.locator('.tabs .tab').count()) === 5, '5 tabs: ' + (await page.locator('.tabs .tab span:not(.slot)').allInnerTexts()).join(', '));
  ok((await page.locator('[data-nav="workout"]').count()) === 0, 'no Train link anywhere');
  for (const r of ['dashboard', 'generate', 'workout', 'library', 'history', 'progress', 'food', 'meals', 'achievements', 'settings']) {
    await page.goto(URL + '#/' + r); await page.waitForTimeout(150);
    ok((await page.locator('main .page').count()) === 1 && (await noOverflow()), `#/${r} renders with no horizontal overflow`);
  }
  await page.goto(URL + '#/workout'); await page.waitForTimeout(150);
  ok((await page.locator('[data-act="startEmpty"]').count()) === 1 && (await page.locator('[data-act="logRun"]').count()) === 1, 'the workout screen still offers empty workout and live run tracking');
  await page.goto(URL + '#/generate'); await page.waitForTimeout(150);
  ok((await page.locator('[data-act="startEmpty"]').count()) === 1 && (await page.locator('[data-act="runRecord"]').count()) === 1, 'Generate offers “Start an empty workout” and “Record a run”');
  await page.goto(URL + '#/food'); await page.waitForTimeout(150);
  ok((await page.locator('main a[href="#/meals"]').count()) === 1, 'Food links to Meal ideas');
  await page.goto(URL + '#/progress'); await page.waitForTimeout(150);
  ok((await page.locator('main a[href="#/achievements"]').count()) === 1, 'Progress links to Achievements');

  console.log('Workouts still start, run and resume');
  await page.goto(URL + '#/dashboard'); await page.waitForTimeout(200);
  const kind = await page.evaluate(() => WT.suggestNext().kind);
  ok(['strength', 'run', 'recovery'].includes(kind), 'Home shows a recommendation (' + kind + ')');
  await page.goto(URL + '#/generate'); await page.waitForTimeout(150);
  await page.tap('[data-act="genType"][data-k="push"]');
  await page.tap('button[data-act="generate"]'); await page.waitForTimeout(600);
  ok((await page.locator('.plan-why li').count()) >= 1, 'plan explains itself: ' + (await page.locator('.plan-why li').allInnerTexts()).join(' | '));
  ok((await page.locator('.ex-row .why').count()) >= 1, 'exercises show a short reason');
  await page.tap('[data-act="startDraft"]'); await page.waitForTimeout(300);
  ok(page.url().endsWith('#/workout') && (await page.locator('.cur').count()) === 1, 'starting a workout opens the workout screen');
  ok((await db()).active.meta.plannedSets > 0, 'the plan is remembered for learning');
  await page.goto(URL + '#/dashboard'); await page.waitForTimeout(200);
  ok((await page.locator('.tabs [data-nav="dashboard"] .live').count()) === 1, 'Home tab shows the workout-in-progress dot');
  await page.tap('.hero a[href="#/workout"]'); await page.waitForTimeout(200);
  ok((await page.locator('.cur').count()) === 1, 'Resume workout returns to it');
  await page.evaluate(() => { WT.db.active = null; WT.save(true); });

  console.log('Record a run from Home');
  await page.goto(URL + '#/dashboard'); await page.waitForTimeout(250);
  ok((await page.locator('.hero [data-act="runRecord"]').count()) === 1, '“Record a run” is on Home');
  await page.tap('.hero [data-act="runRecord"]'); await page.waitForSelector('.sheet #runDist');
  await page.tap('.sheet [data-act="runSave"]'); await page.waitForTimeout(150);
  ok((await page.locator('.toast.error').last().innerText()).includes('distance or a time'), 'empty run is refused with a clear message');
  await page.fill('.sheet #runDist', '3.1');
  await page.fill('.sheet [data-k="m"]', '25');
  await page.fill('.sheet [data-k="s"]', '30');
  ok((await page.locator('#runPace').innerText()).includes('8:14 /mi'), 'average pace calculated live (25:30 for 3.1 mi → 8:14)');
  await page.tap('.sheet [data-act="runEffort"][data-v="good"]');
  await page.fill('.sheet textarea[data-k="notes"]', 'Felt smooth');
  await shot('run-form');
  const before = (await db()).history.length;
  await page.tap('.sheet [data-act="runSave"]'); await page.waitForTimeout(900);
  m = await db();
  const run = m.history[m.history.length - 1];
  ok(m.history.length === before + 1 && run.type === 'cardio' && run.exercises[0].exId === 'outdoor-run', 'saved as a run in history (same model as live runs)');
  ok(run.exercises[0].sets[0].time === '25.5' && run.exercises[0].sets[0].dist === '3.1' && run.durationSec === 1530, 'distance and time stored');
  ok(run.exercises[0].effort === 'good' && run.notes === 'Felt smooth', 'effort and notes stored');
  ok((await page.locator('main').innerText()).includes('Last run today · 3.1 mi in 25:30 · 8:14 /mi'), 'Home shows the last run with pace');
  ok((await page.locator('.ach-toast').count()) >= 1 && (await page.locator('.ach-toast').first().innerText()).includes('Achievement unlocked'), 'a new achievement is celebrated: ' + (await page.locator('.ach-toast').allInnerTexts()).join(' / ').replace(/\s+/g, ' '));
  await shot('home-after-run');
  // Past date
  await page.tap('.hero [data-act="runRecord"]'); await page.waitForSelector('.sheet #runDist');
  await page.fill('.sheet #runDist', '2');
  await page.fill('.sheet [data-k="m"]', '18');
  await page.fill('.sheet input[data-k="date"]', dayKey(3));
  await page.tap('.sheet [data-act="runSave"]'); await page.waitForTimeout(300);
  m = await db();
  const past = m.history.find((s) => s.type === 'cardio' && s.exercises[0].sets[0].dist === '2');
  ok(past && new Date(past.startedAt).toDateString() === new Date(Date.now() - 3 * 864e5).toDateString(), 'a run can be recorded for an earlier date');
  // Edit and delete
  await page.tap('[data-act="runList"]'); await page.waitForSelector('.sheet [data-act="runEdit"]');
  ok((await page.locator('.sheet [data-act="runEdit"]').count()) === 3, 'all runs listed (including the one from before the update)');
  await page.locator(`.sheet [data-act="runEdit"][data-id="${past.id}"]`).tap(); await page.waitForSelector('.sheet #runDist');
  ok((await page.inputValue('.sheet #runDist')) === '2' && (await page.inputValue('.sheet [data-k="m"]')) === '18', 'edit form pre-filled');
  await page.fill('.sheet #runDist', '2.5');
  await page.tap('.sheet [data-act="runSave"]'); await page.waitForTimeout(300);
  m = await db();
  ok(m.history.find((s) => s.id === past.id).exercises[0].sets[0].dist === '2.5', 'run edited');
  await page.tap('[data-act="runList"]'); await page.waitForSelector('.sheet [data-act="runEdit"]');
  await page.locator(`.sheet [data-act="runEdit"][data-id="${past.id}"]`).tap(); await page.waitForSelector('.sheet [data-act="runDelete"]');
  await page.tap('.sheet [data-act="runDelete"]'); await page.tap('[data-act="confirmOk"]'); await page.waitForTimeout(300);
  ok(!(await db()).history.some((s) => s.id === past.id), 'run deleted');
  ok((await db()).history.some((s) => s.id === 'r1'), 'older runs untouched');
  // Edit from History too
  await page.goto(URL + '#/history/' + run.id); await page.waitForTimeout(200);
  await page.tap('[data-act="histMenu"]');
  ok((await page.locator('.sheet [data-act="runEdit"]').count()) === 1, 'History → run → “Edit run”');
  await page.tap('.sheet [data-act="closeSheet"]');

  console.log('Meal ideas');
  await page.goto(URL + '#/meals'); await page.waitForTimeout(200);
  ok((await page.locator('[data-act="mlGenerate"]').isDisabled()), 'Suggest is disabled until something is picked');
  for (const id of ['shrimp', 'sweet-potato', 'spinach', 'jalapeno']) await page.tap(`[data-act="mlPick"][data-id="${id}"]`);
  ok((await page.locator('.chip.ing.on').count()) === 4, 'four ingredients selected');
  await page.tap('[data-act="mlGenerate"]'); await page.waitForTimeout(400);
  const cards = await page.locator('.meal-card').count();
  ok(cards >= 2, `${cards} meal ideas`);
  console.log('    ' + (await page.locator('.meal-card .ti').allInnerTexts()).join(' | '));
  await shot('meals');
  await page.locator('.meal-card [data-act="mlOpen"]').first().tap(); await page.waitForSelector('.sheet ol.steps');
  const sheetTxt = await page.locator('.sheet').innerText();
  ok(/From your kitchen/i.test(sheetTxt) && /Common additions/i.test(sheetTxt) && /Prep/.test(sheetTxt) && /Protein/.test(sheetTxt), 'recipe shows your ingredients, pantry additions, times and protein');
  ok((await page.locator('.sheet ol.steps li').count()) >= 2, 'cooking steps listed');
  const amt0 = await page.locator('.sheet .list .tnum').first().innerText();
  await page.tap('.sheet [data-act="mlOpenServ"][data-d="1"]'); await page.waitForTimeout(100);
  ok((await page.locator('.sheet .list .tnum').first().innerText()) !== amt0, 'changing servings rescales quantities');
  await shot('recipe');
  await page.tap('.sheet [data-act="mlFavOpen"]'); await page.waitForTimeout(100);
  await page.tap('.sheet [data-act="mlLog"]'); await page.waitForTimeout(200);
  ok((await db()).nutrition.entries.some((e) => e.note === 'Meal idea estimate'), 'a serving can be logged to the food diary');
  await page.tap('.sheet [data-act="closeSheet"]');
  ok((await db()).meals.favorites.length === 1, 'recipe saved');
  const keys = () => page.evaluate(() => WT.ui.meals.ideas.map((x) => x.key));
  const first = await keys();
  await page.tap('[data-act="mlMore"]'); await page.waitForTimeout(300);
  const second = await keys();
  console.log('    then: ' + (await page.locator('.meal-card .ti').allInnerTexts()).join(' | '));
  ok(second.length && second.every((k) => !first.includes(k)), 'Different ideas shows new recipes');
  const tpl = (k) => k.split('|')[0];
  ok(second.filter((k) => !first.map(tpl).includes(tpl(k))).length >= Math.min(2, second.length), 'and mostly different recipes, not just different combinations');
  await page.tap('[data-act="mlTab"][data-v="saved"]'); await page.waitForTimeout(150);
  ok((await page.locator('.meal-card').count()) === 1, 'Saved tab lists the saved recipe');
  await page.reload(); await page.waitForTimeout(300);
  await page.tap('[data-act="mlTab"][data-v="saved"]'); await page.waitForTimeout(150);
  ok((await page.locator('.meal-card').count()) === 1, 'saved recipes persist after reload');
  await page.tap('[data-act="mlTab"][data-v="ideas"]'); await page.waitForTimeout(150);
  // Ran out
  await page.tap('[data-act="mlMode"][data-v="stock"]');
  await page.tap('[data-act="mlStock"][data-id="shrimp"]'); await page.waitForTimeout(100);
  ok((await page.locator('[data-act="mlStock"][data-id="shrimp"].out').count()) === 1 && !(await db()).meals.selected.includes('shrimp'), 'Ran out marks shrimp unavailable and deselects it');
  await page.tap('[data-act="mlMode"][data-v="select"]');
  // Custom ingredient
  await page.tap('[data-act="mlAddIng"][data-cat="protein"]'); await page.waitForSelector('.sheet [data-k="name"]');
  await page.fill('.sheet [data-k="name"]', 'Cod');
  await page.fill('.sheet [data-k="p"]', '26');
  await page.tap('.sheet [data-act="mlfSave"]'); await page.waitForTimeout(200);
  m = await db();
  const cod = m.meals.custom.find((x) => x.name === 'Cod');
  ok(cod && m.meals.selected.includes(cod.id), 'custom ingredient added and selected');
  await page.tap('[data-act="mlGenerate"]'); await page.waitForTimeout(400);
  ok((await page.locator('.meal-card .su.t3').allInnerTexts()).some((t) => /cod/.test(t)) && !(await page.locator('.meal-card .su.t3').allInnerTexts()).some((t) => /shrimp/.test(t)), 'ideas use cod and skip the run-out shrimp');
  // Search
  await page.fill('#mlSearch', 'pota'); await page.waitForTimeout(100);
  ok((await page.locator('#mlPicker .chip.ing').count()) === 2, 'search filters ingredients');
  await page.fill('#mlSearch', ''); await page.waitForTimeout(100);
  // Preferences
  await page.tap('details.adv summary'); await page.waitForTimeout(100);
  await page.fill('#mlDislikeIn', 'spinach'); await page.tap('[data-act="mlDislikeAdd"]'); await page.waitForTimeout(150);
  ok((await db()).meals.prefs.disliked.includes('spinach') && !(await db()).meals.selected.includes('spinach'), 'disliked ingredient recorded and removed from the selection');
  await page.tap('[data-act="mlDiet"][data-k="pescatarian"]'); await page.waitForTimeout(100);
  ok((await page.locator('[data-act="mlPick"][data-id="chicken-breast"][disabled]').count()) === 1, 'pescatarian greys out chicken');
  ok(await noOverflow(), 'meal planner fits the phone width');
  await shot('meals-prefs');

  console.log('Achievements screen');
  await page.goto(URL + '#/achievements'); await page.waitForTimeout(250);
  const earned = await page.locator('.li.ach.got').count(), locked = await page.locator('.li.ach.locked').count();
  ok(earned >= 3 && locked >= 10, `${earned} earned and ${locked} locked shown`);
  ok((await page.locator('.ach-bar').count()) >= 5, 'progress bars for locked achievements');
  ok((await page.locator('.li.ach.got .ach-date').first().innerText()).startsWith('Earned'), 'earned dates shown');
  ok((await page.locator('main').innerText()).includes('counted from earlier history'), 'pre-existing milestones labelled honestly');
  await shot('achievements');
  await page.goto(URL + '#/settings'); await page.waitForTimeout(200);
  await page.locator('[data-act="pfToggleOn"][data-k="achievements"]').tap(); await page.waitForTimeout(150);
  ok((await db()).profile.achievements === false, 'achievements can be turned off');
  await page.goto(URL + '#/achievements'); await page.waitForTimeout(150);
  ok((await page.locator('[data-act="achEnable"]').count()) === 1, 'turned-off screen offers to turn them back on');
  await page.tap('[data-act="achEnable"]');

  console.log('Intensity settings and editable stages');
  await page.goto(URL + '#/settings'); await page.waitForTimeout(200);
  ok((await page.locator('input[data-in="pfOdds"][data-k="drop"]').count()) === 1 && (await page.locator('input[data-in="pfOdds"][data-k="buildup"]').count()) === 1, 'drop and build-up odds sliders in Settings');
  await page.evaluate(() => { const set = (k, v) => { const el = document.querySelector(`input[data-in="pfOdds"][data-k="${k}"]`); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }; set('drop', 60); set('buildup', 0); });
  ok((await db()).profile.intensityOdds.drop === 60 && (await db()).profile.intensityOdds.buildup === 0, 'odds saved');
  ok((await page.locator('#odds-drop').innerText()).trim().endsWith('%'), 'percentage shown');
  await page.goto(URL + '#/generate'); await page.waitForTimeout(150);
  await page.tap('[data-act="genType"][data-k="arms"]');
  let staged = null;
  for (let k = 0; k < 8 && !staged; k++) {
    await page.tap('button[data-act="generate"]'); await page.waitForTimeout(500);
    staged = (await db()).draft.exercises.find((e) => e.intensity === 'drop');
  }
  ok(!!staged, 'a drop set is assigned automatically');
  ok(!(await db()).draft.exercises.some((e) => e.intensity === 'buildup'), 'build-up odds of 0 → none');
  ok((await page.locator('.ex-row .int.drop').count()) >= 1, 'plan shows the drop-set marker');
  await page.locator(`.ex-row [data-act="planMenu"][data-uid="${staged.uid}"]`).tap(); await page.waitForSelector('.sheet [data-act="planStages"]');
  await page.tap('.sheet [data-act="planStages"][data-d="1"]'); await page.waitForTimeout(100);
  ok((await db()).draft.exercises.find((e) => e.uid === staged.uid).stageCount === 4, 'stages per set editable before starting (3 → 4)');
  await page.tap('.sheet [data-act="closeSheet"]');
  await page.tap('[data-act="startDraft"]'); await page.waitForTimeout(300);
  const act = (await db()).active.exercises.find((e) => e.exId === staged.exId);
  ok(act.sets.every((s) => s.stages && s.stages.length === 4 && s.stages.every((st) => st.tr > 0)), 'workout starts with 4 stages per drop set, each with a rep target');
  await page.evaluate(() => { WT.db.active = null; WT.db.profile.intensityOdds = WT.defaultProfile().intensityOdds; WT.save(true); });

  console.log('Desktop sidebar');
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const dp = await dctx.newPage();
  await dp.goto(URL); await dp.waitForTimeout(300);
  const side = await dp.locator('.side .nav').allInnerTexts();
  ok(!side.some((t) => /Train/.test(t)) && side.some((t) => /Meal ideas/.test(t)) && side.some((t) => /Achievements/.test(t)), 'sidebar: ' + side.map((t) => t.trim()).join(', '));
  await dp.goto(URL + '#/meals'); await dp.waitForTimeout(200);
  await dp.screenshot({ path: `${SHOTS}/v6-desktop-meals.png` }).catch(() => {});
  await dctx.close();

  console.log('Export / import includes the new data');
  const json = await page.evaluate(() => WT.exportData());
  const data = JSON.parse(json).data;
  ok(data.meals.favorites.length === 1 && data.meals.custom.length === 1 && Object.keys(data.achievements.unlocked).length >= 3, 'export includes saved recipes, custom ingredients and achievements');
  await page.evaluate((j) => { WT.resetAll(); WT.importData(j, 'replace'); }, json);
  m = await db();
  ok(m.meals.favorites.length === 1 && m.history.some((s) => s.id === 'w1') && m.nutrition.entries.some((e) => e.id === 'n1'), 'restore brings everything back');

  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
