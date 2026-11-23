/* Browser test: food diary review & editing, saved meals, progress dashboard, quick records, home.
 * node tests/diary.test.js   (Playwright; files are served in-process by tests/serve.js) */
const { chromium } = require('playwright');
const { URL, serve } = require('./serve');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await serve(ctx);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const db = () => page.evaluate(() => JSON.parse(JSON.stringify(WT.db)));
  const nut = async () => (await db()).nutrition;
  const type = async (t) => { await page.fill('#foodInput', t); await page.waitForTimeout(200); };
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  await page.goto(URL);
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();

  console.log('Empty states never show made-up numbers');
  await page.goto(URL + '#/progress'); await page.waitForTimeout(250);
  ok(/appear once you’ve logged/.test(await page.textContent('.ins-card')), 'insights explain what to track');
  for (const t of ['strength', 'cardio', 'consistency', 'nutrition', 'body']) {
    await page.click(`[data-act="progTab"][data-v="${t}"]`); await page.waitForTimeout(150);
    ok((await page.locator('.prog-empty').count()) === 1 && !(await page.locator('.chart svg').count()), `${t}: empty state, no charts`);
  }
  await page.goto(URL + '#/food'); await page.waitForTimeout(150);
  ok(/Set a calorie target/.test(await page.textContent('.nut-sum')), 'no calorie target invented');

  console.log('Quick log vs review');
  await type('a banana');
  ok((await page.textContent('#foodAddBtn')).trim() === 'Log', 'simple, confident entry: one-tap Log');
  await page.click('[data-act="foodMeal"][data-k="breakfast"]');
  await page.click('#foodAddBtn'); await page.waitForTimeout(200);
  let n = await nut();
  ok(n.entries.length === 1 && n.entries[0].meal === 'breakfast' && n.entries[0].name === 'Banana', 'logged straight to Breakfast');
  await type('Chipotle chicken bowl with white rice, black beans, cheese, sour cream and guacamole');
  ok((await page.textContent('#foodAddBtn')).trim() === 'Review', 'complex meal defaults to review');
  ok(/≈970 cal/.test(await page.textContent('#foodPreview')), 'preview total ≈970 cal');

  console.log('Review: edit amount, unit, values; replace; remove; add');
  await page.click('[data-act="foodMeal"][data-k="lunch"]');
  await page.click('#foodAddBtn');
  await page.waitForSelector('.sheet .rv');
  ok((await page.locator('.sheet .rv').count()) === 6, 'six editable components');
  ok((await page.locator('.sheet .mt.high').count()) === 6 && (await page.locator('.sheet .tag.conf.r').count()) === 6, 'each shows Exact match + Reference data');
  ok(/970/.test(await page.textContent('#rvTotal')), 'running total');
  // stepper: double the chicken
  await page.click('.sheet .rv[data-i="0"] [data-act="rvStep"][data-d="1"]');
  await page.click('.sheet .rv[data-i="0"] [data-act="rvStep"][data-d="1"]');
  ok(/1,150|1150/.test(await page.textContent('#rvTotal')), 'total updates live as the amount changes (+180)');
  // remove sour cream
  const scIdx = await page.evaluate(() => WT.ui.review.items.findIndex((i) => /Sour cream/.test(i.name)));
  await page.click(`.sheet [data-act="rvRemove"][data-i="${scIdx}"]`);
  ok((await page.locator('.sheet .rv').count()) === 5 && /1,040|1040/.test(await page.textContent('#rvTotal')), 'removed an ingredient');
  // add a missing item: chain context continues
  await page.fill('#rvAddIn', 'chips');
  await page.click('.sheet [data-act="rvAdd"]');
  await page.waitForTimeout(150);
  ok(await page.evaluate(() => WT.ui.review.items.some((i) => i.foodId === 'r:chipotle:chips')), 'added item uses the same restaurant (Chipotle chips)');
  // replace rice via search
  const riceIdx = await page.evaluate(() => WT.ui.review.items.findIndex((i) => /white rice/.test(i.name)));
  await page.click(`.sheet .rv[data-i="${riceIdx}"] [data-act="rvSearch"]`);
  await page.waitForSelector('#srQ');
  await page.fill('#srQ', 'chipotle brown rice');
  await page.dispatchEvent('#srQ', 'input');
  await page.waitForTimeout(300);
  await page.click('.sheet [data-act="srPick"][data-j="0"]');
  await page.waitForTimeout(150);
  ok(await page.evaluate((i) => WT.ui.review.items[i].foodId === 'r:chipotle:rice-brown' && WT.ui.review.items[i].learnRef === 'r:chipotle:rice-brown', riceIdx), 'replaced white rice with brown rice from search');
  // correct a value
  const gIdx = await page.evaluate(() => WT.ui.review.items.findIndex((i) => /Guacamole/.test(i.name)));
  await page.click(`.sheet .rv[data-i="${gIdx}"] .rv-fix summary`);
  await page.fill(`.sheet [data-in="rvNum"][data-i="${gIdx}"][data-k="v-cal"]`, '200');
  await page.dispatchEvent(`.sheet [data-in="rvNum"][data-i="${gIdx}"][data-k="v-cal"]`, 'change');
  await page.waitForTimeout(150);
  ok(await page.evaluate((i) => Math.round(WT.nut.itemTotals(WT.ui.review.items[i]).cal) === 200 && WT.ui.review.items[i].conf === 'user', gIdx), 'corrected calories, now Confirmed by you');
  // unit change on a generic food: add "1 cup white rice" and switch to grams
  await page.fill('#rvAddIn', 'a cup of jasmine rice');
  await page.click('.sheet [data-act="rvAdd"]');
  await page.waitForTimeout(150);
  const jIdx = await page.evaluate(() => WT.ui.review.items.findIndex((i) => i.foodId === 'rice'));
  ok(jIdx >= 0, 'generic rice added (no chain context words matched)' + jIdx);
  if (jIdx >= 0) {
    await page.selectOption(`.sheet [data-in="rvUnit"][data-i="${jIdx}"]`, 'g');
    await page.waitForTimeout(150);
    ok(await page.evaluate((i) => { const it = WT.ui.review.items[i]; return it.unit === 'g' && it.qty === 158; }, jIdx), '1 cup → 158 g, same amount');
  }
  // save as a meal, log
  await page.click('.sheet [data-act="rvSaveMeal"]');
  await page.fill('.sheet [data-in="rvSaveName"]', 'Chipotle usual');
  await page.dispatchEvent('.sheet [data-in="rvSaveName"]', 'input');
  const count = await page.evaluate(() => WT.ui.review.items.length);
  await page.click('.sheet [data-act="rvLog"]');
  await page.waitForTimeout(250);
  n = await nut();
  ok(n.entries.filter((e) => e.meal === 'lunch').length === count, `${count} items logged to Lunch`);
  ok(n.meals.length === 1 && n.meals[0].name === 'Chipotle usual' && n.meals[0].items.length === count, 'meal saved');
  ok(n.learned['chipotle chicken bowl white rice black bean cheese sour cream guacamole'] === undefined, 'whole-sentence text is not learned as one food');
  ok(n.portions['r:chipotle:chicken'] && n.portions['r:chipotle:chicken'].qty === 2, 'changed amount remembered as your usual portion');

  console.log('Diary: meals, quick add, copy, edit, delete');
  ok((await page.locator('.meal-sec[data-meal="lunch"] .food-row').count()) === count, 'lunch section lists the items');
  ok(/cal/.test(await page.textContent('.meal-sec[data-meal="lunch"] .meal-head')), 'meal subtotal shown');
  const mealChip = page.locator('[data-act="foodQuick"][data-k^="meal:"]');
  ok((await mealChip.count()) === 1, 'saved meal in Quick add');
  await page.click('[data-act="foodMeal"][data-k="dinner"]');
  await mealChip.click(); await page.waitForTimeout(200);
  ok((await nut()).entries.filter((e) => e.meal === 'dinner').length === count, 'saved meal logged to Dinner in one tap');
  // copy breakfast to yesterday
  await page.click('.meal-sec[data-meal="breakfast"] [data-act="mealMenu"]');
  await page.waitForSelector('.sheet [data-act="mmCopy"]');
  const y = await page.evaluate(() => WT.nut.addDays(WT.nut.dayKey(), -1));
  await page.fill('.sheet [data-in="mmText"][data-k="to"]', y);
  await page.dispatchEvent('.sheet [data-in="mmText"][data-k="to"]', 'input');
  await page.click('.sheet [data-act="mmCopy"]'); await page.waitForTimeout(200);
  ok((await nut()).entries.filter((e) => e.date === y && e.meal === 'breakfast').length === 1, 'meal copied to yesterday');
  // edit an entry: move to snack, change unit
  const banana = (await nut()).entries.find((e) => e.name === 'Banana' && e.date !== y);
  await page.click(`[data-act="foodEdit"][data-id="${banana.id}"]`);
  await page.waitForSelector('.sheet [data-in="feUnit"]');
  await page.selectOption('.sheet [data-in="feText"][data-k="meal"]', 'snack');
  await page.selectOption('.sheet [data-in="feUnit"]', 'g');
  await page.waitForTimeout(150);
  ok((await page.inputValue('.sheet [data-in="feNum"][data-k="qty"]')) === '118', 'unit change converts 1 banana → 118 g');
  await page.click('.sheet [data-act="feSave"]'); await page.waitForTimeout(200);
  const b2 = (await nut()).entries.find((e) => e.id === banana.id);
  ok(b2.meal === 'snack' && b2.unit === 'g' && Math.round(b2.per.cal * b2.qty) === 105, 'moved to Snacks, same calories');
  // delete
  const before = (await nut()).entries.length;
  await page.click(`[data-act="foodDel"][data-id="${banana.id}"]`);
  await page.click('[data-act="confirmOk"]'); await page.waitForTimeout(150);
  ok((await nut()).entries.length === before - 1, 'entry deleted');

  console.log('Learned matches');
  await type('lunch bowl');
  await page.click('#foodAddBtn');
  await page.waitForSelector('.sheet .rv');
  await page.click('.sheet .rv[data-i="0"] [data-act="rvSearch"]');
  await page.waitForSelector('#srQ');
  await page.fill('#srQ', 'chipotle chicken'); await page.dispatchEvent('#srQ', 'input'); await page.waitForTimeout(250);
  await page.click('.sheet [data-act="srPick"][data-j="0"]'); await page.waitForTimeout(100);
  await page.click('.sheet [data-act="rvLog"]'); await page.waitForTimeout(200);
  await type('lunch bowl');
  ok(/Chipotle Chicken/.test(await page.textContent('#foodPreview')) && /Your match/.test(await page.textContent('#foodPreview')), 'next time “lunch bowl” resolves to your correction');
  await type('');

  console.log('Targets and trends');
  await page.click('.nut-sum [data-act="foodTargets"]');
  await page.fill('.sheet [data-in="tgNum"][data-k="cal"]', '2200'); await page.dispatchEvent('.sheet [data-in="tgNum"][data-k="cal"]', 'input');
  await page.click('.sheet [data-act="tgSave"]'); await page.waitForTimeout(150);
  ok(/Target 2,200/.test(await page.textContent('.nut-sum')) && (await page.locator('.nut-ring svg').count()) === 1, 'calorie ring with target');
  await page.click('[data-act="foodTab"][data-v="trends"]'); await page.waitForTimeout(250);
  ok((await page.locator('#foodCalChart svg').count()) === 1 && /Calories \/ day/.test(await page.textContent('.summary.four')), 'trends: calories, protein, carbs, fat averages');
  for (const d of [30, 90]) { await page.click(`[data-act="foodTrend"][data-v="${d}"]`); await page.waitForTimeout(150); }
  ok((await page.locator('#foodChart svg').count()) === 1, '90-day trend renders');
  await page.click('[data-act="foodTab"][data-v="diary"]');

  console.log('Home shortcuts: run, weight');
  await page.goto(URL + '#/dashboard'); await page.waitForTimeout(200);
  ok((await page.locator('.shortcut').count()) === 4, 'four shortcuts');
  ok((await page.locator('.food-mini').count()) === 1 && /2,200/.test(await page.textContent('.food-mini')), 'today’s calories and protein on Home');
  await page.click('.shortcut[data-act="recordRun"]');
  await page.waitForSelector('#runDist');
  await page.fill('#runDist', '3.1'); await page.dispatchEvent('#runDist', 'input');
  await page.fill('.sheet [data-in="runF"][data-k="m"]', '27'); await page.dispatchEvent('.sheet [data-in="runF"][data-k="m"]', 'input');
  await page.fill('.sheet [data-in="runF"][data-k="s"]', '54'); await page.dispatchEvent('.sheet [data-in="runF"][data-k="s"]', 'input');
  ok(/9:00 \/mi/.test(await page.textContent('#runPace')), 'pace preview 9:00 /mi');
  await page.click('.sheet [data-act="runSave"]'); await page.waitForTimeout(200);
  let d = await db();
  const run = d.history.find((s) => s.type === 'cardio' && s.exercises[0].sets[0].dist === '3.1');
  ok(run && run.exercises[0].sets[0].dist === '3.1' && Math.round(run.durationSec) === 1674, 'run saved to history');
  ok(/3\.1 mi/.test(await page.textContent('.run-card')) && /9:00 \/mi/.test(await page.textContent('.run-card')), 'Home shows the recent run');
  await page.click('.shortcut[data-act="logWeight"]');
  await page.waitForSelector('#wtIn');
  await page.fill('#wtIn', '182.4'); await page.dispatchEvent('#wtIn', 'input');
  await page.click('.sheet [data-act="wtSave"]'); await page.waitForTimeout(150);
  ok((await db()).body.weights.length === 1 && (await db()).body.weights[0].v === 182.4, 'weight logged');

  console.log('Progress with data');
  await page.evaluate(() => {
    const now = Date.now(), N = WT.nut;
    for (let w = 1; w <= 9; w++) {
      WT.saveRun({ date: N.dayKey(now - (w * 7) * 864e5), dist: 3 - w * 0.1, time: (3 - w * 0.1) * (9 + w * 0.1) });
      WT.body.addWeight(N.dayKey(now - w * 4 * 864e5), 182 + w * 0.4);
    }
    WT.flush();
  });
  await page.goto(URL + '#/progress'); await page.waitForTimeout(200);
  await page.click('[data-act="progTab"][data-v="overview"]'); await page.waitForTimeout(300);
  ok((await page.locator('.ins-list .ins').count()) >= 1 && /average run has increased/.test(await page.textContent('.ins-card')), 'insights from the logged runs');
  await page.click('[data-act="progTab"][data-v="cardio"]'); await page.waitForTimeout(300);
  ok((await page.locator('#runDistChart svg').count()) === 1 && (await page.locator('#runPaceChart svg').count()) === 1, 'distance and pace charts');
  const dist30 = await page.textContent('.summary.four .metric .v');
  await page.click('[data-act="progPeriod"][data-v="7d"]'); await page.waitForTimeout(200);
  const dist7 = await page.textContent('.summary.four .metric .v');
  await page.click('[data-act="progPeriod"][data-v="1y"]'); await page.waitForTimeout(250);
  const dist1y = await page.textContent('.summary.four .metric .v');
  ok(parseFloat(dist7) <= parseFloat(dist30) && parseFloat(dist30) < parseFloat(dist1y), `period filter changes totals (${dist7} ≤ ${dist30} < ${dist1y})`);
  await page.click('[data-act="progTab"][data-v="body"]'); await page.waitForTimeout(250);
  ok((await page.locator('#weightChart svg').count()) === 1 && /Trend per week/.test(await page.textContent('.summary')), 'body: weight chart and weekly trend');
  await page.click('[data-act="logMeasure"]');
  await page.waitForSelector('.sheet [data-act="msSave"]');
  await page.fill('.sheet [data-in="msF"][data-k="v"]', '33.5'); await page.dispatchEvent('.sheet [data-in="msF"][data-k="v"]', 'input');
  await page.click('.sheet [data-act="msSave"]'); await page.waitForTimeout(200);
  ok((await db()).body.measures.some((m) => m.type === 'waist' && m.v === 33.5) && /Waist/.test(await page.textContent('.prog-body')), 'waist measurement recorded and listed');
  await page.click('[data-act="progTab"][data-v="nutrition"]'); await page.waitForTimeout(250);
  ok((await page.locator('#nutCalChart svg').count()) === 1, 'nutrition tab charts');
  await page.click('[data-act="progTab"][data-v="consistency"]'); await page.waitForTimeout(250);
  ok((await page.locator('#weeksChart svg').count()) === 1 && (await page.locator('#monthsChart svg').count()) === 1, 'consistency charts incl. monthly at 1 year');

  console.log('Layout');
  for (const [w, h] of [[390, 844], [1280, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    for (const r of ['dashboard', 'food', 'progress']) {
      await page.goto(URL + '#/' + r); await page.waitForTimeout(200);
      ok(!(await overflow()), `${r} at ${w}px: no horizontal overflow`);
    }
  }
  await page.evaluate(() => { WT.db.profile.theme = 'dark'; WT.applyTheme(); });
  await page.goto(URL + '#/food'); await page.waitForTimeout(150);
  ok((await page.evaluate(() => getComputedStyle(document.querySelector('.nut-sum')).backgroundColor)) !== 'rgb(255, 255, 255)', 'dark theme applies to the new summary');

  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
