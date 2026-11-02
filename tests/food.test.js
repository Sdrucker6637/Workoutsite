/* Food & protein tracker, end to end in a phone-sized browser.
 * Serve the repo on :8765 (python3 -m http.server 8765), then: node tests/food.test.js */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:8765/';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  const db = () => page.evaluate(() => JSON.parse(JSON.stringify(WT.db)));
  const nut = async () => (await db()).nutrition;
  const today = () => page.evaluate(() => WT.nut.dayKey());
  const total = (d) => page.evaluate((d) => Math.round(WT.nut.dayTotals(d || WT.nut.dayKey()).p), d);
  const type = async (t) => { await page.fill('#foodInput', t); await page.waitForTimeout(200); };
  const closeAll = () => page.evaluate(() => WT.closeSheet(true));

  /* Existing workout data written by the previous version (v3) */
  console.log('Existing workout data is upgraded, not touched');
  const SEED = {
    version: 3,
    profile: { name: 'Lifter', unit: 'lb', theme: 'light', favorites: ['pullup'] },
    history: [
      { id: 'w1', type: 'push', title: 'Push', startedAt: '2026-10-20T17:00:00.000Z', endedAt: '2026-10-20T18:00:00.000Z', durationSec: 3600, totals: { sets: 3, volume: 1200 }, prs: [], exercises: [{ uid: 'u1', exId: 'db-bench-press', name: 'Dumbbell Bench Press', intensity: 'regular', targetSets: 3, repMin: 6, repMax: 10, sets: [{ w: '40', r: '10', done: true }, { w: '40', r: '10', done: true }, { w: '40', r: '10', done: true }] }] },
    ],
    customExercises: [], overrides: {}, active: null, draft: null,
  };
  await page.goto(URL);
  await page.evaluate((s) => { WT.flush = WT.save = () => {}; localStorage.clear(); localStorage.setItem('wt.data.v1', JSON.stringify(s)); }, SEED);
  await page.reload();
  let m = await db();
  ok(m.version === 4 && JSON.stringify(m.history) === JSON.stringify(SEED.history), 'v3 → v4: workout history byte-identical');
  ok(m.profile.name === 'Lifter' && m.profile.proteinTarget === 150 && m.nutrition.entries.length === 0, 'settings kept; empty food log; 150 g default target');
  const histBefore = JSON.stringify(m.history);

  console.log('Navigation');
  ok((await page.locator('.tabs .tab[data-nav="food"]').count()) === 1, 'Food tab in the phone tab bar');
  await page.tap('.tabs .tab[data-nav="food"]');
  await page.waitForSelector('#foodInput');
  ok((await page.evaluate(() => location.hash)) === '#/food', 'Food screen opens');
  ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no horizontal overflow on a phone');
  ok(/Nothing logged yet today/.test(await page.textContent('.food-sum')), 'empty day explained, not shown as 0 g short');

  console.log('Logging one food');
  await type('3 eggs');
  ok(/Eggs/.test(await page.textContent('#foodPreview')) && /≈18 g/.test(await page.textContent('#foodPreview')), 'live breakdown before logging');
  await page.tap('#foodAddBtn');
  await page.waitForTimeout(250);
  let n = await nut();
  ok(n.entries.length === 1 && n.entries[0].name === 'Eggs' && n.entries[0].qty === 3, 'one entry logged');
  ok((await total()) === 18, 'daily total 18 g');
  ok((await page.inputValue('#foodInput')) === '', 'input cleared after logging');

  console.log('Logging multiple foods in one sentence (Enter key)');
  await type('2 chicken breasts, a protein shake, and 2 hot dogs');
  ok((await page.locator('#foodPreview .li.pv').count()) === 3, 'three items previewed');
  await page.press('#foodInput', 'Enter');
  await page.waitForTimeout(250);
  n = await nut();
  ok(n.entries.length === 4, 'three more entries logged');
  ok((await total()) === 18 + 106 + 25 + 10, 'daily total adds up (' + (await total()) + ')');
  ok((await page.locator('.food-row').count()) === 4, 'four rows in the list');
  ok(/reached your protein goal/.test(await page.textContent('.food-msg')), 'guidance shown: ' + (await page.textContent('.food-msg')));

  console.log('Serving descriptions');
  await type('2 scoops of Greek yogurt, a handful of almonds, a cup of milk, 1 serving of shrimp, a bowl of protein pasta, a turkey sandwich');
  const pv = await page.textContent('#foodPreview');
  ok(['Greek yogurt', 'Almonds', 'Milk', 'Shrimp', 'Protein pasta', 'Turkey sandwich'].every((s) => pv.includes(s)), 'all six recognized');
  ok(['2 scoops', '1 handful', '1 cup', '1 serving', '1 bowl', '1 sandwich'].every((s) => pv.includes(s)), 'serving words understood');
  await type('2 Oscar Mayer hot dogs and 1 Snickerdoodle protein shake');
  const pv2 = await page.textContent('#foodPreview');
  ok(/Oscar Mayer hot dog/.test(pv2) && /not label data/.test(pv2), 'brand recognized, labelled as typical estimate');
  ok(/Snickerdoodle protein shake/.test(pv2) && /Generic/.test(pv2), 'unknown flavor → generic, clearly labelled');
  await type('');

  console.log('Unrecognized food must be resolved, never silently logged');
  await type('3 eggs and a plate of zorbleberries');
  ok((await page.locator('#foodPreview .li.unk').count()) === 1, 'unknown item flagged in preview');
  await page.tap('#foodAddBtn');
  await page.waitForSelector('.sheet [data-act="rvLog"]');
  ok(await page.isDisabled('.sheet [data-act="rvLog"]'), 'Log is disabled until it is resolved');
  ok((await nut()).entries.length === 4, 'nothing logged yet');
  await page.fill('.sheet [data-in="rvNum"][data-k="manual"]', '4');
  await page.dispatchEvent('.sheet [data-in="rvNum"][data-k="manual"]', 'change');
  await page.waitForTimeout(100);
  ok(!(await page.isDisabled('.sheet [data-act="rvLog"]')), 'resolved with the user’s own estimate');
  await page.tap('.sheet [data-act="rvLog"]');
  await page.waitForTimeout(250);
  n = await nut();
  ok(n.entries.length === 6, 'both items logged');
  const manual = n.entries.find((e) => e.src === 'manual');
  ok(manual && Math.round(manual.per.p * manual.qty) === 4 && /zorbleberr/i.test(manual.name), 'manual item keeps the user’s 4 g');
  // typo → pick a suggestion inline
  await type('chiken brest');
  await page.tap('#foodPreview [data-act="foodPick"]');
  await page.waitForTimeout(150);
  ok(/Chicken breast/.test(await page.textContent('#foodPreview')) && !(await page.locator('#foodPreview .li.unk').count()), 'typo resolved by tapping a suggestion');
  await page.tap('#foodAddBtn');
  await page.waitForTimeout(250);
  ok((await nut()).entries.length === 7, 'resolved suggestion logged');

  console.log('Editing estimated protein and quantity');
  const firstId = (await nut()).entries.find((e) => e.name === 'Chicken breast' && e.qty === 2).id;
  await page.tap(`[data-act="foodEdit"][data-id="${firstId}"]`);
  await page.waitForSelector('.sheet [data-in="feNum"][data-k="p"]');
  await page.fill('.sheet [data-in="feNum"][data-k="p"]', '90');
  await page.dispatchEvent('.sheet [data-in="feNum"][data-k="p"]', 'input');
  await page.fill('.sheet [data-in="feText"][data-k="name"]', 'Chicken breast (small)');
  await page.dispatchEvent('.sheet [data-in="feText"][data-k="name"]', 'input');
  await page.tap('.sheet [data-act="feSave"]');
  await page.waitForTimeout(200);
  let e = (await nut()).entries.find((x) => x.id === firstId);
  ok(Math.round(e.per.p * e.qty) === 90 && e.name === 'Chicken breast (small)' && e.src === 'manual', 'protein + name corrected');
  await page.tap(`[data-act="foodEdit"][data-id="${firstId}"]`);
  await page.waitForSelector('.sheet [data-in="feNum"][data-k="qty"]');
  await page.fill('.sheet [data-in="feNum"][data-k="qty"]', '1');
  await page.dispatchEvent('.sheet [data-in="feNum"][data-k="qty"]', 'change');
  await page.waitForTimeout(100);
  ok((await page.inputValue('.sheet [data-in="feNum"][data-k="p"]')) === '45', 'halving the amount halves protein in the form');
  await page.tap('.sheet [data-act="feSave"]');
  await page.waitForTimeout(200);
  e = (await nut()).entries.find((x) => x.id === firstId);
  ok(e.qty === 1 && Math.round(e.per.p * e.qty) === 45, 'quantity edit saved and scaled');

  console.log('Saving and reusing a favorite');
  await page.tap('[data-act="foodMine"]');
  await page.waitForSelector('.sheet [data-act="mfEdit"][data-id=""]');
  await page.tap('.sheet [data-act="mfEdit"][data-id=""]');
  await page.waitForSelector('.sheet [data-in="mf"][data-k="name"]');
  for (const [k, v] of [['name', 'Snickerdoodle protein shake'], ['unit', 'bottle'], ['p', '30'], ['cal', '160']]) {
    await page.fill(`.sheet [data-in="mf"][data-k="${k}"]`, v);
    await page.dispatchEvent(`.sheet [data-in="mf"][data-k="${k}"]`, 'input');
  }
  await page.tap('.sheet [data-act="mfSave"]');
  await page.waitForTimeout(150);
  await closeAll();
  await page.waitForTimeout(150);
  n = await nut();
  ok(n.foods.length === 1 && n.foods[0].fav && n.foods[0].per.p === 30, 'custom food saved as a favorite');
  const fav = page.locator('[data-act="foodQuick"][data-k^="fav:"]');
  ok((await fav.count()) === 1 && /Snickerdoodle/.test(await fav.textContent()), 'favorite shows as a one-tap button');
  const before = await total();
  await fav.tap();
  await page.waitForTimeout(200);
  ok((await total()) === before + 30, 'one tap logs 30 g');
  await type('1 Snickerdoodle protein shake');
  ok(/Your saved food/.test(await page.textContent('#foodPreview')) && /≈30 g/.test(await page.textContent('#foodPreview')), 'typing the name now uses the saved values (30 g, not generic 25 g)');
  await type('');
  const rec = page.locator('[data-act="foodQuick"][data-k^="rec:"]').first();
  const recCount = (await nut()).entries.length;
  await rec.tap();
  await page.waitForTimeout(200);
  ok((await nut()).entries.length === recCount + 1, 'recent food re-logged with one tap');
  // star an existing entry
  const eggId = (await nut()).entries.find((x) => x.name === 'Eggs').id;
  await page.tap(`[data-act="foodEdit"][data-id="${eggId}"]`);
  await page.waitForSelector('.sheet [data-act="feFav"]');
  await page.tap('.sheet [data-act="feFav"]');
  await closeAll();
  ok((await nut()).foods.some((f) => f.name === 'Eggs' && f.fav), 'logged entry saved to My foods via star');

  console.log('Deleting entries');
  const cnt = (await nut()).entries.length;
  const delId = (await nut()).entries.find((x) => x.name === 'Hot dog').id;
  await page.tap(`[data-act="foodDel"][data-id="${delId}"]`);
  await page.tap('[data-act="confirmOk"]');
  await page.waitForTimeout(200);
  ok((await nut()).entries.length === cnt - 1 && !(await nut()).entries.some((x) => x.id === delId), 'entry deleted after confirmation');

  console.log('Navigating between dates and editing history');
  const t = await today();
  const y = await page.evaluate(() => WT.nut.addDays(WT.nut.dayKey(), -1));
  await page.tap('.food-date [aria-label="Previous day"]');
  await page.waitForTimeout(250);
  ok((await page.evaluate(() => location.hash)) === '#/food/' + y, 'previous day');
  ok(/Yesterday/.test(await page.textContent('.food-day')) && /Nothing logged for this day/.test(await page.textContent('.food-sum')), 'past empty day explained');
  await type('a cup of cottage cheese');
  await page.tap('#foodAddBtn');
  await page.waitForTimeout(200);
  ok((await total(y)) === 25 && (await nut()).entries.find((x) => x.date === y).name === 'Cottage cheese', 'logged to the day being viewed');
  const yId = (await nut()).entries.find((x) => x.date === y).id;
  await page.tap(`[data-act="foodEdit"][data-id="${yId}"]`);
  await page.waitForSelector('.sheet [data-in="feNum"][data-k="p"]');
  await page.fill('.sheet [data-in="feNum"][data-k="p"]', '28');
  await page.dispatchEvent('.sheet [data-in="feNum"][data-k="p"]', 'input');
  await page.tap('.sheet [data-act="feSave"]');
  await page.waitForTimeout(200);
  ok((await total(y)) === 28, 'historical entry edited');
  ok((await page.locator('.food-date [aria-label="Next day"].off').count()) === 0, 'next is available from a past day');
  await page.tap('.food-date [aria-label="Next day"]');
  await page.waitForTimeout(200);
  ok((await page.evaluate(() => location.hash)) === '#/food/' + t, 'next day returns to today');
  ok((await page.locator('.food-date [aria-label="Next day"].off').count()) === 1, 'cannot go past today');
  await page.goto(URL + '#/food/2026-01-15');
  await page.waitForTimeout(200);
  ok(/January 15/.test(await page.textContent('.head .over')), 'deep link to a date');
  await page.goto(URL + '#/food/2999-01-01');
  await page.waitForTimeout(200);
  ok(/Today/.test(await page.textContent('.food-day')), 'future date falls back to today');

  console.log('Trends (7 / 30 days)');
  await page.goto(URL + '#/food');
  await page.waitForTimeout(300);
  ok((await page.locator('#foodChart svg').count()) === 1, '7-day chart drawn');
  ok(/2\s*\/\s*7/.test(await page.textContent('.summary')), '2 of 7 days logged');
  ok(/left out of the average/.test(await page.textContent('body')), 'unlogged days explained');
  ok((await page.locator('.li.muted').count()) === 5, 'unlogged days listed as “Not logged”, not 0 g');
  await page.tap('[data-act="foodTrend"][data-v="30"]');
  await page.waitForTimeout(250);
  ok(/2\s*\/\s*30/.test(await page.textContent('.summary')) && (await page.locator('#foodChart svg').count()) === 1, '30-day view');

  console.log('Target setting');
  await page.goto(URL + '#/settings');
  await page.waitForSelector('[data-in="pfProtein"]');
  await page.fill('[data-in="pfProtein"]', '180');
  await page.dispatchEvent('[data-in="pfProtein"]', 'change');
  await page.waitForTimeout(150);
  ok((await db()).profile.proteinTarget === 180, 'target changed to 180 g');
  await page.goto(URL + '#/food');
  await page.waitForTimeout(200);
  ok(/Target ~180 g/.test(await page.textContent('.food-sum')) && /160–200/.test(await page.textContent('.food-sum')), 'summary uses the new target and range');
  await page.goto(URL + '#/settings');
  await page.tap('[data-act="pfToggleOn"][data-k="showMacros"]');
  await page.goto(URL + '#/food');
  await page.waitForTimeout(200);
  ok(!/cal ·/.test(await page.textContent('.food-sum')), 'calories/carbs/fat can be hidden');

  console.log('Home summary stays small');
  await page.goto(URL + '#/dashboard');
  await page.waitForTimeout(200);
  ok((await page.locator('.food-mini').count()) === 1 && (await page.locator('.hero [data-act="quickGen"]').count()) === 1, 'Home shows the workout hero plus a small protein card');

  console.log('Persistence after refresh');
  const snap = JSON.stringify(await nut());
  await page.evaluate(() => WT.flush());
  await page.reload();
  await page.waitForTimeout(250);
  ok(JSON.stringify(await nut()) === snap, 'food log identical after reload');
  ok(JSON.stringify((await db()).history) === histBefore, 'workout history still intact');

  console.log('Export → erase → restore');
  await page.goto(URL + '#/settings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.tap('[data-act="exportJson"]')]);
  const file = '/tmp/forge-food-backup.json';
  await dl.saveAs(file);
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok(backup.data.nutrition.entries.length === JSON.parse(snap).entries.length && backup.data.nutrition.foods.length === 2, 'backup file contains entries and saved foods');
  ok(backup.data.history.length === 1, 'backup still contains workouts');
  await page.evaluate(() => { WT.resetAll(); });
  await page.reload();
  ok((await nut()).entries.length === 0, 'erased');
  await page.goto(URL + '#/settings');
  await page.setInputFiles('[data-in="importFile"]', file);
  await page.waitForSelector('.sheet [data-mode="replace"]');
  ok(/food entr/.test(await page.textContent('.sheet')), 'restore sheet mentions food entries');
  await page.tap('.sheet [data-mode="replace"]');
  await page.waitForTimeout(250);
  const restored = await db();
  ok(JSON.stringify(restored.nutrition) === snap, 'food log restored exactly');
  ok(restored.profile.proteinTarget === 180, 'target restored');
  ok(JSON.stringify(restored.history) === histBefore, 'workouts restored exactly');
  await page.goto(URL + '#/settings');
  await page.setInputFiles('[data-in="importFile"]', file);
  await page.waitForSelector('.sheet [data-mode="merge"]');
  await page.tap('.sheet [data-mode="merge"]');
  await page.waitForTimeout(200);
  ok(JSON.stringify((await db()).nutrition) === snap, 'merging the same backup creates no duplicates');

  console.log('Workout features still work alongside');
  await page.goto(URL + '#/generate');
  await page.tap('[data-act="genType"][data-k="full"]');
  await page.tap('[data-act="generate"]');
  await page.waitForTimeout(600);
  ok((await page.locator('.ex-row').count()) >= 5, 'generator still works');
  ok(JSON.stringify((await db()).history) === histBefore, 'logging food never touched workout history');

  for (const w of [390, 1280]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(URL + '#/food');
    await page.waitForTimeout(200);
    ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `no overflow at ${w}px`);
  }
  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
