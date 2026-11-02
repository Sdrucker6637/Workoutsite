/* Upgrade safety against realistic data produced by the PREVIOUS version of the app.
 *
 * Step 1 uses the v5 app itself (served from the commit before v6) to build ~10 months of realistic data
 * through its own code paths: generated workouts with heavy / burnout / drop / build-up sets, skipped exercises,
 * live-logged runs, typed food entries with brands and saved foods, settings changes, custom exercises,
 * exercise overrides, a draft and an in-progress workout. It also exports a v5 backup.
 * Step 2 opens the v6 app on that storage and checks that everything survived, then exercises backup / restore.
 *
 * Setup:  git worktree add /tmp/forge-v5 5d64e76 && (cd /tmp/forge-v5 && python3 -m http.server 8766 &)
 *         python3 -m http.server 8765 &      (this repo)
 * Run:    node tests/migration.test.js       (requires playwright)
 */
const { chromium } = require('playwright');
const OLD = process.env.OLD_URL || 'http://localhost:8766/';
const NEW = process.env.URL || 'http://localhost:8765/';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  console.log('Building realistic v5 data with the v5 app');
  const oldCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const op = await oldCtx.newPage();
  await op.goto(OLD);
  await op.waitForTimeout(300);
  const v5 = await op.evaluate(() => {
    localStorage.clear();
    WT.resetAll();
    const p = WT.db.profile;
    Object.assign(p, { name: 'Alex', theme: 'dark', unit: 'lb', strengthPerWeek: 3, runsPerWeek: 2, defaultCount: 7, defaultDuration: 45, experience: 'intermediate', proteinTarget: 165, showMacros: false, timerSound: false, lastBackup: new Date(Date.now() - 20 * 864e5).toISOString() });
    p.intensityOdds = { heavy: 25, regular: 35, burnout: 10, standard: 30 };
    p.intensityFixed = { heavy: 1, burnout: 2 };
    p.dumbbells = { min: 5, max: 75, step: 5, microLoad: true };
    p.favorites = ['pullup', 'sissy-squat', 'db-incline-press'];
    p.excluded = ['crunch', 'db-bent-row'];
    p.prioritize = ['chest', 'biceps', 'lats'];
    p.avoidMuscles = ['lower-back'];
    p.restrictions = ['deadlift', 'rdl'];
    p.goals = ['Get stronger', 'Run a 10K'];
    WT.db.customExercises.push({ id: 'custom-landmine', name: 'Landmine Press', primary: 'chest', secondary: ['front-delts'], equipment: ['bb'], category: 'compound', pattern: 'incline-push', difficulty: 'intermediate', intensities: ['heavy', 'regular', 'standard'], repMin: 6, repMax: 10, rest: 90, load: 'bb', tags: [], video: '', cue: 'Brace and press up and forward.', sets: 4, custom: true, intensity: 'standard' });
    WT.db.overrides['db-curl'] = { video: 'https://youtu.be/ykJmrZ5v0Oo', cue: 'Elbows still' };
    WT.rebuildExercises();
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const strength = ['full', 'full', 'push', 'pull', 'legs', 'arms'];
    const DAY = 864e5;
    let start = Date.now() - 300 * DAY;
    for (let day = 0; day < 298; day++) {
      const t = start + day * DAY;
      const dow = new Date(t).getDay();
      if (dow === 1 || dow === 3 || dow === 5) {
        const type = strength[Math.floor(rnd() * strength.length)];
        const w = WT.generate(Object.assign(WT.defaultSettings(type), { targets: ['chest', 'back'] }));
        // the v5 user sometimes picked drop / build-up by hand
        w.exercises.forEach((it) => {
          const ex = WT.ex(it.exId);
          if (WT.canStage(ex) && rnd() < 0.12) Object.assign(it, WT.prescribe(ex, rnd() < 0.5 ? 'drop' : 'buildup'));
        });
        const s = WT.sessionFromWorkout(w);
        s.startedAt = new Date(t + 17 * 36e5).toISOString();
        s.exercises.forEach((e, k) => {
          const ex = WT.ex(e.exId);
          const tt = WT.trackType(ex);
          if (rnd() < 0.07) { e.skipped = true; return; }
          const base = 15 + Math.round(day / 30) * 2.5 + (ex.category === 'compound' ? 15 : 0);
          e.sets.forEach((x, i) => {
            if (rnd() < 0.05) return; // unfinished set
            if (WT.isStagedSet(x)) {
              x.stages.forEach((st, j) => { st.w = String(Math.max(5, base + (x.type === 'drop' ? -10 * j : 5 * j))); st.r = String(st.tr + (rnd() < 0.3 ? 1 : 0)); st.done = j < x.stages.length - (rnd() < 0.1 ? 1 : 0); });
              x.done = x.stages.some((st) => st.done);
            } else {
              if (tt === 'weight') x.w = String(base);
              else if (tt === 'reps') x.w = '0';
              x.r = String(tt === 'time' ? 30 + i * 5 : e.repMin + Math.floor(rnd() * (e.repMax - e.repMin + 1)));
              if (tt === 'cardio') { x.time = '12.5'; x.dist = '1.2'; }
              x.done = true;
              x.at = new Date(t + 17 * 36e5 + (k * 4 + i) * 6e4).toISOString();
            }
          });
          if (rnd() < 0.4) e.effort = ['easy', 'good', 'hard'][Math.floor(rnd() * 3)];
          if (rnd() < 0.05) e.notes = 'Felt the stretch';
        });
        if (rnd() < 0.1) s.notes = 'Good session';
        // finish "an hour later"
        const realNow = Date.now;
        Date.now = () => t + 18 * 36e5;
        const RD = Date;
        // finishSession uses new Date() for endedAt — set afterwards
        Date.now = realNow;
        const fin = WT.finishSession(s);
        fin.endedAt = new Date(t + 18 * 36e5).toISOString();
        fin.durationSec = 3300 + Math.round(rnd() * 900);
        if (fin.exercises.some((e) => !e.skipped)) WT.db.history.push(fin);
      }
      if (dow === 2 || dow === 6) {
        // live-logged run via the v5 "Log a run" model
        const run = WT.sessionFromWorkout({ type: 'cardio', title: 'Run', exercises: [Object.assign({ exId: rnd() < 0.8 ? 'outdoor-run' : 'treadmill-run' }, WT.prescribe(WT.ex('outdoor-run'), 'standard'))] });
        run.startedAt = new Date(t + 7 * 36e5).toISOString();
        const dist = WT.round(2 + rnd() * 4, 1);
        Object.assign(run.exercises[0].sets[0], { time: String(WT.round(dist * (8.5 + rnd()), 4)), dist: String(dist), done: true, at: run.startedAt });
        const fin = WT.finishSession(run);
        fin.endedAt = new Date(t + 7.6 * 36e5).toISOString();
        fin.durationSec = Math.round(+run.exercises[0].sets[0].time * 60);
        WT.db.history.push(fin);
      }
      // food most days, typed like a person would
      if (rnd() < 0.8) {
        const N = WT.nut;
        const texts = ['2 eggs and toast', 'chicken breast with rice', 'a protein shake', 'greek yogurt', 'Premier protein shake', 'Oikos triple zero', 'turkey sandwich', '2 chicken breasts and broccoli', 'salmon and sweet potato'];
        const k = N.dayKey(new Date(t));
        for (let m = 0; m < 3; m++) {
          const items = N.parse(texts[Math.floor(rnd() * texts.length)]).filter((x) => !x.unknown && !x.ambiguous);
          if (items.length) N.addItems(items, k);
        }
      }
    }
    // saved foods / favourites
    WT.nut.saveFood({ name: 'Morning shake', qty: 1, unit: 'shake', per: { p: 42, cal: 260, c: 9, f: 4 }, src: 'manual', conf: 'user' }, true);
    // in-progress workout and a draft
    WT.db.draft = WT.generate(WT.defaultSettings('pull'));
    WT.db.active = WT.sessionFromWorkout(WT.generate(WT.defaultSettings('push')));
    WT.db.active.exercises[0].sets[0] = Object.assign(WT.db.active.exercises[0].sets[0], { w: '45', r: '8', done: true });
    WT.flush();
    return { raw: localStorage.getItem('wt.data.v1'), backup: WT.exportData() };
  });
  await oldCtx.close();
  const old = JSON.parse(v5.raw);
  const stagedCount = old.history.reduce((a, s) => a + s.exercises.reduce((b, e) => b + (e.sets || []).filter((x) => x.stages).length, 0), 0);
  const runCount = old.history.filter((s) => s.type === 'cardio').length;
  console.log(`  v5 data: ${old.history.length} sessions (${runCount} runs, ${stagedCount} drop/build-up sets), ${old.nutrition.entries.length} food entries, ${old.nutrition.foods.length} saved foods, ${(v5.raw.length / 1024).toFixed(0)} KB`);
  ok(old.version === 5 && old.history.length > 150 && stagedCount > 10 && runCount > 50 && old.nutrition.entries.length > 300, 'realistic v5 data generated by the v5 app');

  console.log('Opening it with v6');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(NEW);
  await page.evaluate((raw) => { WT.flush = WT.save = () => {}; localStorage.clear(); localStorage.setItem('wt.data.v1', raw); }, v5.raw);
  await page.reload();
  await page.waitForTimeout(1500);
  const now = await page.evaluate(() => JSON.parse(localStorage.getItem('wt.data.v1')));
  ok(now.version === 6, 'stored as v6');
  ok(JSON.stringify(now.history) === JSON.stringify(old.history), 'every workout and run byte-identical (sets, stages, efforts, notes, skips, PRs, dates)');
  ok(JSON.stringify(now.nutrition) === JSON.stringify(old.nutrition), 'food log and saved foods byte-identical');
  ok(JSON.stringify(now.customExercises) === JSON.stringify(old.customExercises) && JSON.stringify(now.overrides) === JSON.stringify(old.overrides), 'custom exercises and exercise overrides identical');
  ok(JSON.stringify(now.active) === JSON.stringify(old.active), 'in-progress workout identical');
  ok(JSON.stringify(now.draft) === JSON.stringify(old.draft), 'draft plan identical');
  const changedKeys = Object.keys(old.profile).filter((k) => JSON.stringify(old.profile[k]) !== JSON.stringify(now.profile[k]));
  ok(changedKeys.join() === 'intensityOdds,intensityFixed', 'every setting kept (only the intensity odds / fixed counts gained the new drop and build-up keys): ' + changedKeys.join(','));
  ok(Object.entries(old.profile.intensityOdds).every(([k, v]) => now.profile.intensityOdds[k] === v) && now.profile.intensityOdds.drop === 7 && now.profile.intensityOdds.buildup === 7, 'custom odds kept; drop / build-up added');
  ok(now.profile.intensityFixed.heavy === 1 && now.profile.intensityFixed.burnout === 2 && now.profile.intensityFixed.drop === 0, 'fixed counts kept');
  ok(now.profile.theme === 'dark' && (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'dark theme still applied');
  // Exercise history and records computed identically to v5
  const sample = ['db-incline-press', 'pullup', 'db-curl', 'goblet-squat', 'outdoor-run'];
  const v6calc = await page.evaluate((ids) => ids.map((id) => [id, WT.exerciseHistory(id).length, JSON.stringify(WT.personalRecords(id).heaviest), WT.stats().count]), sample);
  const ctxOld = await browser.newContext();
  const op2 = await ctxOld.newPage();
  await op2.goto(OLD);
  await op2.evaluate((raw) => { WT.flush = WT.save = () => {}; localStorage.setItem('wt.data.v1', raw); }, v5.raw);
  await op2.reload();
  const v5calc = await op2.evaluate((ids) => ids.map((id) => [id, WT.exerciseHistory(id).length, JSON.stringify(WT.personalRecords(id).heaviest), WT.stats().count]), sample);
  await ctxOld.close();
  ok(JSON.stringify(v6calc) === JSON.stringify(v5calc), 'exercise history, PRs and stats identical in v5 and v6: ' + v6calc.map((x) => `${x[0]} ${x[1]}`).join(', '));
  const ach = now.achievements;
  ok(ach.since && Object.values(ach.unlocked).every((u) => u.retro), `${Object.keys(ach.unlocked).length} achievements recognised from history, all marked as earlier history`);
  ok((await page.locator('.ach-toast').count()) === 0, 'no celebrations on upgrade');
  // The app works on the upgraded data
  for (const r of ['dashboard', 'generate', 'workout', 'history', 'progress', 'food', 'meals', 'achievements', 'settings']) {
    await page.goto(NEW + '#/' + r); await page.waitForTimeout(200);
    ok((await page.locator('main .page').count()) === 1, `#/${r} renders`);
  }
  await page.goto(NEW + '#/workout'); await page.waitForTimeout(200);
  ok((await page.locator('.cur').count()) === 1, 'in-progress workout resumes');
  const rec = await page.evaluate(() => { const w = WT.generate(WT.defaultSettings('full')); return { n: w.exercises.length, notes: w.notes, ex: w.exercises.map((i) => i.exId) }; });
  ok(rec.n === 7 && !rec.ex.some((id) => ['crunch', 'db-bent-row'].includes(id)), 'generation honours saved count and exclusions');

  console.log('Backups');
  // Old v5 backup → v6 (replace)
  await page.evaluate((b) => { WT.resetAll(); WT.importData(b, 'replace'); }, v5.backup);
  let d = await page.evaluate(() => JSON.parse(JSON.stringify(WT.db)));
  ok(d.version === 6 && JSON.stringify(d.history) === JSON.stringify(old.history) && JSON.stringify(d.nutrition) === JSON.stringify(old.nutrition), 'v5 backup restores fully into v6');
  // Add v6-only data, export, wipe, restore
  await page.evaluate(() => {
    WT.meals.saveIngredient({ name: 'Cod', cat: 'protein', p: 26 });
    WT.db.meals.selected = ['shrimp', 'rice', 'broccoli'];
    WT.meals.toggleStaple('rice');
    WT.meals.toggleUnavailable('salmon');
    WT.db.meals.prefs.diets = ['gluten-free'];
    WT.meals.toggleFavorite(WT.meals.generate().ideas[0]);
    WT.saveRun({ date: WT.nut.dayKey(), h: '', m: '30', s: '', dist: '3.5', kind: 'outdoor-run', effort: 'good', notes: 'v6 run' });
    WT.ach.check();
    WT.recordDrop('cable-fly');
  });
  const v6backup = await page.evaluate(() => WT.exportData());
  const v6data = JSON.parse(v6backup).data;
  await page.evaluate(() => WT.resetAll());
  ok((await page.evaluate(() => WT.db.history.length)) === 0, 'wiped');
  await page.evaluate((b) => WT.importData(b, 'replace'), v6backup);
  d = await page.evaluate(() => JSON.parse(JSON.stringify(WT.db)));
  ok(JSON.stringify(d.history) === JSON.stringify(v6data.history) && JSON.stringify(d.nutrition) === JSON.stringify(v6data.nutrition), 'v6 backup: workouts, runs and food restored exactly');
  ok(JSON.stringify(d.meals) === JSON.stringify(v6data.meals), 'v6 backup: custom ingredients, staples, out-of-stock, diets and saved recipes restored exactly');
  ok(JSON.stringify(d.achievements) === JSON.stringify(v6data.achievements) && JSON.stringify(d.learn) === JSON.stringify(v6data.learn), 'v6 backup: achievements (with dates) and learning data restored exactly');
  ok(JSON.stringify(d.profile) === JSON.stringify(v6data.profile), 'v6 backup: settings restored exactly');
  // Merge the same backup twice: nothing duplicates
  await page.evaluate((b) => { WT.importData(b, 'merge'); WT.importData(b, 'merge'); }, v6backup);
  d = await page.evaluate(() => JSON.parse(JSON.stringify(WT.db)));
  ok(d.history.length === v6data.history.length && d.nutrition.entries.length === v6data.nutrition.entries.length && d.meals.favorites.length === 1 && d.meals.custom.length === 1, 'merging the same backup twice adds no duplicates');
  // Merging a v5 backup into v6 data keeps the v6-only data
  await page.evaluate((b) => WT.importData(b, 'merge'), v5.backup);
  d = await page.evaluate(() => JSON.parse(JSON.stringify(WT.db)));
  ok(d.meals.favorites.length === 1 && d.meals.custom.length === 1 && Object.keys(d.achievements.unlocked).length === Object.keys(v6data.achievements.unlocked).length && d.history.length === v6data.history.length, 'merging an old v5 backup keeps meal planner and achievement data');
  // Through the real UI: Settings → Import → Replace
  await page.goto(NEW + '#/settings'); await page.waitForTimeout(200);
  await page.setInputFiles('input[data-in="importFile"]', { name: 'forge-backup.json', mimeType: 'application/json', buffer: Buffer.from(v5.backup) });
  await page.waitForSelector('.sheet [data-act="doImport"][data-mode="replace"]');
  await page.click('.sheet [data-act="doImport"][data-mode="replace"]');
  await page.waitForTimeout(1200);
  d = await page.evaluate(() => JSON.parse(JSON.stringify(WT.db)));
  ok(d.version === 6 && d.history.length === old.history.length && d.nutrition.entries.length === old.nutrition.entries.length, 'v5 backup restored through Settings → Import');
  ok((await page.locator('.ach-toast').count()) === 0, 'restoring a backup does not celebrate old milestones');

  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
