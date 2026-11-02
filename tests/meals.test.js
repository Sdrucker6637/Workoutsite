/* Meal planner and achievements logic. Run: node tests/meals.test.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = String(v)), removeItem: (k) => delete mem[k] };
for (const f of ['exercises.js', 'core.js', 'foods.js', 'products.js', 'nutrition.js', 'engine.js', 'meals.js', 'achievements.js'])
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
const WT = globalThis.WT, M = WT.meals, A = WT.ach, N = WT.nut;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', m); } };
const section = (t) => console.log('\n' + t);
WT.load();
const st = () => WT.db.meals;
const pick = (ids) => { st().selected = []; ids.forEach((id) => M.toggleSelect(id)); };
const show = (r) => r.ideas.forEach((x) => console.log(`   · ${x.name} — ${x.prep + x.cook} min, ≈${x.macros.p} g protein, ≈${x.macros.cal} cal`));

section('Ingredient catalog and selection');
{
  const cats = { protein: 12, carb: 8, veg: 11 };
  Object.entries(cats).forEach(([c, n]) => ok(M.sorted(c).length === n, `${n} preloaded ${c} ingredients`));
  ['Chicken breast', 'Chicken thighs', 'Ground chicken', 'Ground beef', 'Ground turkey', 'Shrimp', 'Salmon', 'Tuna', 'Eggs', 'Greek yogurt', 'Cottage cheese', 'Tofu', 'Potatoes', 'Sweet potatoes', 'Rice', 'Pasta', 'Protein pasta', 'Bread', 'Tortillas', 'Quinoa', 'Spinach', 'Bok choy', 'Broccoli', 'Bell peppers', 'Onions', 'Mushrooms', 'Tomatoes', 'Zucchini', 'Asparagus', 'Jalapeños', 'Garlic']
    .forEach((n) => ok(M.all().some((x) => x.name === n), 'has ' + n));
  pick(['shrimp', 'sweet-potato', 'spinach', 'jalapeno']);
  ok(st().selected.length === 4, 'multiple selections');
  M.toggleSelect('spinach');
  ok(!st().selected.includes('spinach'), 'tapping again deselects');
  M.toggleSelect('spinach');
  ok(M.search('pot').map((x) => x.id).sort().join() === 'potato,sweet-potato', 'search finds ingredients');
  ok(M.search('') === null, 'empty search shows categories');
  // Frequently used rise to the top
  for (let k = 0; k < 4; k++) { M.toggleSelect('tofu'); M.toggleSelect('tofu'); }
  ok(M.sorted('protein')[0].id === 'tofu', 'frequently selected ingredients sort first');
  ok(M.frequent().some((x) => x.id === 'tofu'), 'and appear under Frequent');
  M.toggleStaple('rice');
  ok(M.sorted('carb')[0].id === 'rice' && M.frequent()[0].id === 'rice', 'staples are pinned first');
  // Custom ingredients
  const cod = M.saveIngredient({ name: 'Cod', cat: 'protein', p: 26, cal: 120, tags: ['fish'] });
  ok(M.get(cod.id).name === 'Cod' && M.get(cod.id).custom, 'custom ingredient added');
  let threw = false; try { M.saveIngredient({ name: 'cod', cat: 'protein' }); } catch (e) { threw = true; }
  ok(threw, 'duplicate names are refused');
  M.saveIngredient({ id: cod.id, name: 'Atlantic cod', cat: 'protein', p: 27, cal: 120, tags: ['fish'] });
  ok(M.get(cod.id).name === 'Atlantic cod' && M.get(cod.id).per.p === 27, 'custom ingredient edited');
  M.saveIngredient({ id: 'bok-choy', name: 'Baby bok choy', cat: 'veg' });
  ok(M.get('bok-choy').name === 'Baby bok choy' && M.get('bok-choy').per.p === 3, 'built-in renamed, values kept');
  M.deleteIngredient('bok-choy');
  ok(M.get('bok-choy').name === 'Bok choy', 'built-in rename can be reset');
  const kale = M.saveIngredient({ name: 'Kale', cat: 'veg' });
  pick([cod.id, kale.id, 'rice']);
  const rc = M.generate();
  ok(rc.ideas.length >= 2 && rc.ideas.every((x) => x.uses.includes(cod.id)), 'custom protein is used in ideas');
  ok(rc.ideas.some((x) => x.uses.includes(kale.id)), 'custom vegetable is used in ideas');
  ok(rc.ideas.every((x) => x.mine.find((m) => m.id === kale.id) ? x.unknown.includes('Kale') : true), 'macros say which ingredient has no values');
  M.deleteIngredient(kale.id);
  ok(!M.get(kale.id) && !st().selected.includes(kale.id), 'custom ingredient deleted and deselected');
}

section('Meal generation — the brief’s examples and more');
{
  for (const [label, ids] of [['shrimp + sweet potato + spinach + jalapeños', ['shrimp', 'sweet-potato', 'spinach', 'jalapeno']], ['chicken thighs + protein pasta + bok choy + garlic', ['chicken-thigh', 'protein-pasta', 'bok-choy', 'garlic']], ['eggs + spinach + bread', ['eggs', 'spinach', 'bread']], ['ground turkey + rice + peppers + onions', ['ground-turkey', 'rice', 'bell-pepper', 'onion']], ['salmon only', ['salmon']], ['tofu + quinoa + broccoli', ['tofu', 'quinoa', 'broccoli']], ['tuna + tortillas + Greek yogurt', ['tuna', 'tortilla', 'greek-yogurt']]]) {
    pick(ids);
    const r = M.generate({ count: 4 });
    console.log('  ' + label + ':');
    show(r);
    ok(r.ideas.length >= (ids.length === 1 ? 1 : 2), `${label}: multiple ideas`);
    r.ideas.forEach((x) => {
      ok(x.name && x.mine.length && x.steps.length >= 2 && x.prep > 0 && x.cook > 0, 'idea has name, ingredients, steps and times');
      ok(x.mine.every((m) => m.amount), 'every ingredient has an approximate quantity');
      ok(x.uses.every((id) => ids.includes(id)), 'only selected ingredients are listed as yours');
      ok(x.extras.every((e) => !ids.includes(e.id)), 'pantry additions are listed separately');
      ok(x.macros.p > 0 && x.macros.cal > 0, 'protein and calories estimated');
      ok(x.uses.includes(x.mine[0].id) && M.get(x.mine[0].id).cat === 'protein', 'built around a protein');
      ok(x.macros.p <= 70, 'protein per serving stays reasonable (' + x.macros.p + ')');
    });
    ok(new Set(r.ideas.map((x) => x.tpl)).size === r.ideas.length, 'no two ideas from the same recipe template');
  }
  pick(['shrimp', 'sweet-potato']);
  const r1 = M.generate();
  ok(r1.ideas.some((x) => !x.mine.some((m) => M.get(m.id).cat === 'veg')), 'a meal can skip a category (no vegetables needed)');
  pick(['chicken-breast', 'broccoli']);
  ok(M.generate().ideas.length >= 2, 'works without a carbohydrate');
  pick(['rice', 'spinach']);
  ok(M.generate().ideas.length === 0 && /protein/.test(M.generate().reason), 'no protein → explains instead of inventing');
  pick([]);
  ok(/Pick/.test(M.generate().reason), 'nothing selected → prompt');
}

section('Variety, regenerate, favourites');
{
  pick(['chicken-breast', 'rice', 'broccoli', 'bell-pepper', 'onion']);
  st().recent = [];
  const a = M.generate({ count: 4 });
  const b = M.generate({ count: 4, exclude: a.ideas.map((x) => x.key) });
  ok(b.ideas.length && b.ideas.every((x) => !a.ideas.some((y) => y.key === x.key)), 'regenerate shows different ideas');
  const tplCount = {};
  for (let k = 0; k < 12; k++) M.generate({ count: 4 }).ideas.forEach((x) => (tplCount[x.tpl] = (tplCount[x.tpl] || 0) + 1));
  console.log('  templates across 12 rounds:', JSON.stringify(tplCount));
  ok(Object.keys(tplCount).length >= 6, 'suggestions rotate through many recipes over time');
  const fav = a.ideas[0];
  ok(M.toggleFavorite(fav) === true && M.isFavorite(fav.key), 'save a recipe');
  ok(st().favorites[0].steps.length === fav.steps.length, 'saved recipe keeps its full text');
  const r4 = M.rescale(st().favorites[0], 4);
  ok(r4.servings === 4 && r4.mine[0].amount !== fav.mine[0].amount && r4.macros.p === fav.macros.p, 'rescaling changes amounts, not per-serving macros');
  ok(M.toggleFavorite(fav) === false && !M.isFavorite(fav.key), 'unsave a recipe');
  M.toggleFavorite(fav);
}

section('Unavailable, disliked and dietary restrictions');
{
  pick(['shrimp', 'chicken-breast', 'rice', 'broccoli']);
  M.toggleUnavailable('shrimp');
  ok(!st().selected.includes('shrimp') && M.unavailable('shrimp'), 'marking run-out removes it from the selection');
  st().selected.push('shrimp');
  ok(M.generate().ideas.every((x) => !x.uses.includes('shrimp')), 'run-out ingredients never appear even if selected');
  M.toggleUnavailable('shrimp');
  ok(!M.unavailable('shrimp'), 'restocked');
  M.toggleDisliked('broccoli');
  ok(M.generate().ideas.every((x) => !x.uses.includes('broccoli')), 'disliked ingredients are avoided');
  M.toggleDisliked('broccoli');
  st().prefs.dislikedText = ['honey', 'parmesan'];
  pick(['salmon', 'rice', 'bok-choy', 'chicken-breast', 'pasta', 'spinach']);
  for (let k = 0; k < 6; k++) M.generate().ideas.forEach((x) => ok(!x.extras.some((e) => /honey|parmesan/i.test(e.name)), 'disliked pantry extras are left out'));
  st().prefs.dislikedText = [];
  st().prefs.diets = ['vegetarian'];
  pick(['chicken-breast', 'tofu', 'eggs', 'rice', 'spinach']);
  let r = M.generate();
  ok(r.ideas.length && r.ideas.every((x) => !x.uses.includes('chicken-breast')), 'vegetarian: no meat');
  st().prefs.diets = ['gluten-free'];
  pick(['chicken-thigh', 'pasta', 'rice', 'bok-choy']);
  r = M.generate();
  ok(r.ideas.every((x) => !x.uses.includes('pasta')), 'gluten-free: no pasta');
  ok(r.ideas.filter((x) => x.extras.some((e) => /tamari/.test(e.name))).length === r.ideas.filter((x) => x.extras.some((e) => /Soy sauce/.test(e.name))).length, 'gluten-free: soy sauce is swapped for tamari');
  st().prefs.diets = ['dairy-free'];
  pick(['ground-beef', 'potato', 'tomato', 'greek-yogurt']);
  r = M.generate();
  ok(r.ideas.every((x) => !x.uses.includes('greek-yogurt') && !x.extras.some((e) => /cheese|parmesan/i.test(e.name))), 'dairy-free: no yogurt or cheese');
  st().prefs.diets = ['low-carb'];
  pick(['salmon', 'rice', 'asparagus']);
  r = M.generate();
  ok(r.ideas.length && r.ideas.every((x) => !x.uses.includes('rice')), 'lower carb: carbohydrates are skipped');
  st().prefs.diets = [];
  st().prefs.maxTime = 20;
  pick(['chicken-breast', 'rice', 'broccoli', 'spinach', 'potato']);
  ok(M.generate().ideas.every((x) => x.prep + x.cook <= 20), 'time limit respected');
  st().prefs.maxTime = 0;
  st().prefs.airFryer = true;
  pick(['chicken-breast', 'potato', 'broccoli']);
  let air = 0;
  for (let k = 0; k < 10; k++) air += M.generate().ideas.filter((x) => x.airFryer).length;
  ok(air >= 10, 'air-fryer recipes are favoured when you have one (' + air + ' in 10 rounds)');
}

section('Achievements');
{
  WT.resetAll();
  const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
  const s = (d, exs, extra) => WT.db.history.push(Object.assign({ id: WT.uid(), type: 'full', title: 'W', startedAt: ago(d), endedAt: ago(d), durationSec: 3000, prs: [], totals: { sets: 3 },
    exercises: exs.map(([exId, w, r]) => ({ uid: WT.uid(), exId, intensity: 'regular', targetSets: 3, repMin: 8, repMax: 12, sets: [{ w: String(w), r: String(r), done: true }] })) }, extra || {}));
  ok(A.check().length === 0 && WT.db.achievements.since, 'first check sets the tracking start');
  // History that existed before tracking → retro, real dates
  WT.resetAll();
  s(40, [['db-curl', 20, 10]]); s(30, [['db-curl', 25, 10]]); s(20, [['pullup', 0, 5]]); s(10, [['pullup', 0, 7]]);
  const before = A.check();
  ok(before.length === 0, 'already-earned achievements are not celebrated on first check');
  const u = WT.db.achievements.unlocked;
  ok(u['first-workout'] && u['first-workout'].retro && Math.abs(new Date(u['first-workout'].at) - new Date(ago(40))) < 1000, 'retro achievements keep their real date (first workout 40 days ago)');
  ok(u['workouts-3'] && Math.abs(new Date(u['workouts-3'].at) - new Date(ago(20))) < 1000, '3rd workout dated when it happened');
  ok(u['weight-up'] && Math.abs(new Date(u['weight-up'].at) - new Date(ago(30))) < 1000, 'weight increase detected at the right session');
  ok(u['pullup-up'], 'improved pull-up performance');
  ok(!u['workouts-10'], 'locked ones stay locked');
  const p10 = A.progress().find((p) => p.def.id === 'workouts-10');
  ok(p10.value === 4 && p10.target === 10, 'progress toward 10 workouts: 4/10');
  // New activity after tracking began → celebrated with today's date
  ok(u['weight-milestone'] && u['weight-milestone'].retro, 'reaching 25 lb on curls (before tracking) is retro');
  for (let k = 0; k < 6; k++) s(0, [['goblet-squat', 40, 10]]); // reaches 10 workouts today
  const fresh = A.check();
  ok(fresh.map((d) => d.id).includes('workouts-10'), 'reaching 10 workouts now is celebrated: ' + fresh.map((d) => d.id).join(', '));
  const w10 = WT.db.achievements.unlocked['workouts-10'];
  ok(!w10.retro && Date.now() - new Date(w10.at) < 864e5 + 1000, 'and dated today, not retro');
  ok(WT.db.achievements.unlocked['workouts-3'].retro, 'earlier unlocks keep their retro label and date');
  ok(A.check().length === 0, 'an achievement is only awarded once');
  // Runs
  const run = (d, dist, time) => WT.db.history.push({ id: WT.uid(), type: 'cardio', title: 'Run', startedAt: ago(d), endedAt: ago(d), durationSec: time * 60, prs: [], totals: { sets: 1 }, exercises: [{ uid: WT.uid(), exId: 'outdoor-run', intensity: 'standard', targetSets: 1, repMin: 20, repMax: 40, sets: [{ w: '', r: '', time: String(time), dist: String(dist), done: true }] }] });
  run(0.5, 2, 20); run(0.4, 2, 19); run(0.3, 3.2, 30);
  const fr = A.check().map((d) => d.id);
  ok(fr.includes('first-run') && fr.includes('first-5k') && fr.includes('pace-up'), 'first run, first 5K and improved pace: ' + fr.join(', '));
  ok(!WT.db.achievements.unlocked['runs-5'], '5 runs still locked');
  ok(A.progress().find((p) => p.def.id === 'runs-5').value === 3, 'run progress 3/5');
  ok(A.progress().find((p) => p.def.id === 'first-workout').value === 1, 'runs do not count as workouts double');
  // Nutrition: on-target days count only inside the protein band, never far above
  const tg = WT.db.profile.proteinTarget;
  for (let k = 1; k <= 7; k++) N.addItems([{ name: 'Chicken', qty: 1, per: { p: k <= 2 ? tg * 2 : tg } }], N.addDays(N.dayKey(), -k));
  A.check();
  ok(WT.db.achievements.unlocked['log-7'], 'logged food on 7 days');
  ok(A.progress().find((p) => p.def.id === 'protein-5').value === 5, 'days with double the protein target do not count toward protein achievements');
  ok(WT.db.achievements.unlocked['protein-5'], 'reached protein target 5 times');
  ok(A.progress().find((p) => p.def.id === 'log-streak').value === 7, 'logging streak progress 7/10');
  // Variety
  ok(A.progress().find((p) => p.def.id === 'all-types').target === 10, 'every main workout type tracked');
  // Week streak based on the user's weekly goal
  WT.resetAll();
  WT.db.profile.strengthPerWeek = 2;
  A.check();
  const wk = WT.startOfWeek(new Date());
  for (let w = 3; w >= 1; w--) for (const off of [0, 2]) { const d = new Date(wk); d.setDate(d.getDate() - 7 * w + off); d.setHours(12); WT.db.history.push({ id: WT.uid(), type: 'full', title: 'W', startedAt: d.toISOString(), endedAt: d.toISOString(), durationSec: 3000, prs: [], totals: { sets: 1 }, exercises: [{ uid: 'x', exId: 'db-curl', intensity: 'regular', targetSets: 1, repMin: 8, repMax: 12, sets: [{ w: '20', r: '10', done: true }] }] }); }
  A.check({ silent: true });
  ok(WT.db.achievements.unlocked['streak-2'] && !WT.db.achievements.unlocked['streak-4'], '3 weeks meeting a 2-a-week goal → 2-week streak, not 4');
  ok(A.progress().find((p) => p.def.id === 'streak-4').value === 3, 'streak progress 3/4 (current week in progress does not break it)');
  ok(A.LIST.every((d) => !/per day|calorie deficit|most volume/i.test(A.text(d))), 'no achievement rewards excess');
  // Export / import keeps earliest unlocks
  const json = WT.exportData();
  WT.resetAll();
  WT.importData(json, 'replace');
  ok(WT.db.achievements.unlocked['streak-2'], 'achievements survive backup and restore');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
