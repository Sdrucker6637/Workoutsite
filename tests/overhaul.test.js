/* Nutrition overhaul + progress analytics: parser, food database, restaurants, recipes, personalization,
 * meals, migration, analytics and insights. Pure logic, no browser.   node tests/overhaul.test.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = String(v)), removeItem: (k) => delete mem[k] };
for (const f of ['exercises.js', 'core.js', 'engine.js', 'foods.js', 'fooddb.js', 'products.js', 'restaurants.js', 'nutrition.js', 'analytics.js'])
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
const WT = globalThis.WT, N = WT.nut;
let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log('  FAIL:', msg); } };
const section = (s) => console.log(s);
const near = (a, b, tol) => Math.abs(a - b) <= tol;
WT.load();
WT.save = () => {};
const T = (it) => N.itemTotals(it);
const parse = (t) => N.parse(t);
const DAY = 864e5;

section('Food database integrity');
{
  const ids = new Set();
  WT.FOODS.forEach((f) => {
    ok(!ids.has(f.id), 'unique food id ' + f.id); ids.add(f.id);
    ok(['reference', 'estimated'].includes(f.st), `${f.id}: status reference|estimated`);
    if (f.per100) {
      const { cal, p, c, f: fat } = f.per100;
      const atw = p * 4 + c * 4 + fat * 9;
      ok(cal === 0 || Math.abs(atw - cal) / Math.max(cal, 1) < 0.25 || Math.abs(atw - cal) < 25, `${f.id}: calories consistent with macros (${cal} vs ${Math.round(atw)})`);
      ok(f.g > 0, `${f.id}: base portion has grams`);
    }
    Object.values(f.sizes || {}).forEach((g) => ok(g > 0, `${f.id}: size grams > 0`));
  });
  // no alias maps to two foods
  const seen = new Map();
  WT.FOODS.forEach((f) => f.a.forEach((a) => { const k = a.toLowerCase(); ok(!seen.has(k) || seen.get(k) === f.id, `alias “${a}” only on one food (${seen.get(k)} / ${f.id})`); seen.set(k, f.id); }));
  WT.CHAINS.forEach((ch) => {
    ok(['reference', 'estimated'].includes(ch.status) && ch.src, `${ch.id}: chain has status and source`);
    const iid = new Set();
    ch.items.forEach((it) => {
      ok(!iid.has(it.id), `${ch.id}:${it.id} unique`); iid.add(it.id);
      const vals = it.sizes ? Object.values(it.sizes) : [it.m];
      vals.forEach((m) => {
        ok(Array.isArray(m) && m.length === 4 && m.every((v) => typeof v === 'number' && v >= 0), `${ch.id}:${it.id} macros`);
        const atw = m[1] * 4 + m[2] * 4 + m[3] * 9;
        ok(m[0] <= 50 || Math.abs(atw - m[0]) / m[0] < 0.2, `${ch.id}:${it.id} calories consistent with macros (${m[0]} vs ${Math.round(atw)})`);
      });
    });
  });
  (WT.RECIPES || []).forEach((r) => r.parts.forEach((p) => { const it = N.parseItem(p, { generic: true, noRecipe: true }); ok(!it.unknown && !it.ambiguous && !it.parts, `recipe ${r.id}: part “${p}” resolves`); }));
  console.log('  foods:', WT.FOODS.length, '· USDA-based:', WT.FOODS.filter((f) => f.st === 'reference').length, '· restaurant items:', WT.CHAINS.reduce((a, c) => a + c.items.length, 0), '· recipes:', WT.RECIPES.length, '· products:', WT.PRODUCTS.length);
}

section('Examples from the brief');
{
  let r = parse('Two scrambled eggs, two slices of toast with butter and a glass of orange juice');
  ok(r.length === 4 && r.every((i) => !i.unknown && !i.ambiguous), '4 items recognized');
  ok(r[0].foodId === 'egg-scrambled' && r[0].qty === 2, 'scrambled eggs × 2');
  ok(r[1].foodId === 'bread' && r[1].qty === 2 && r[1].unit === 'slice', '2 slices of toast');
  ok(r[2].foodId === 'butter' && r[2].assumed, 'butter: amount assumed and flagged');
  ok(r[3].foodId === 'orange-juice' && r[3].unit === 'glass' && near(T(r[3]).cal, 112, 3), 'glass of OJ ≈ 112 cal (USDA, 8 fl oz)');
  ok(near(N.sumItems(r).cal, 510, 40), 'breakfast total ≈ 510 cal (' + Math.round(N.sumItems(r).cal) + ')');

  r = parse('Chipotle chicken bowl with white rice, black beans, cheese, sour cream and guacamole');
  ok(r.length === 6 && r.every((i) => i.src === 'restaurant' && i.brand === 'Chipotle'), 'six Chipotle components');
  ok(Math.round(N.sumItems(r).cal) === 970 && Math.round(N.sumItems(r).p) === 54, 'Chipotle bowl = 970 cal, 54 g protein (published portions)');
  ok(r.every((i) => N.confidence(i).level === 'high'), 'all exact matches');

  r = parse('Two rotisserie chicken thighs with skin and a medium baked potato');
  ok(r.length === 2, '"with skin" does not split the item');
  ok(r[0].foodId === 'chicken-thigh-skin' && r[0].qty === 2, 'rotisserie thigh WITH skin');
  ok(r[1].foodId === 'potato' && r[1].sizeWord === 'medium' && near(T(r[1]).cal, 161, 2), 'medium baked potato ≈ 161 cal (173 g)');

  r = parse('One serving of Barilla Protein+ pasta with half a jar of Rao’s sauce');
  ok(r.length === 2 && r[0].foodId === 'p:barilla-protein-plus' && r[0].qty === 1, 'Barilla Protein+ serving');
  ok(T(r[0]).p === 17 && r[0].estMacros.includes('cal') && /estimated/.test(r[0].note), 'verified protein; missing calories estimated AND flagged');
  ok(r[1].foodId === 'p:raos-marinara' && r[1].unit === 'jar' && r[1].qty === 0.5 && near(T(r[1]).cal, 275, 1), 'half a jar of Rao’s = 2.75 servings');

  r = parse('Large Oikos Triple Zero yogurt and a handful of blueberries');
  ok(r[0].foodId === 'p:oikos-triple-zero' && T(r[0]).p === 15 && /fixed size/.test(r[0].note), 'Triple Zero; "large" ignored for a fixed cup, and said so');
  ok(r[1].foodId === 'blueberries' && r[1].unit === 'handful' && near(T(r[1]).cal, 42, 2), 'handful of blueberries ≈ ½ cup');
}

section('Preparations are distinguished');
{
  const id = (t) => parse(t)[0].foodId;
  ok(id('chicken breast') === 'chicken-breast' && id('raw chicken breast') === 'chicken-breast-raw' && id('6 oz chicken breast raw') === 'chicken-breast-raw', 'breast cooked vs raw');
  ok(id('chicken thigh') === 'chicken-thigh' && id('chicken thigh with skin') === 'chicken-thigh-skin' && id('chicken thighs skin on') === 'chicken-thigh-skin', 'thigh vs thigh with skin');
  ok(id('rotisserie chicken thigh without skin') === 'chicken-thigh-rotisserie-skinless' && id('rotisserie chicken thigh no skin') === 'chicken-thigh-rotisserie-skinless', 'rotisserie without skin');
  ok(id('rotisserie chicken breast') === 'chicken-breast-skin', 'rotisserie breast defaults to with skin');
  ok(T(parse('100 g chicken thigh with skin')[0]).f > T(parse('100 g chicken thigh')[0]).f, 'skin adds fat');
  for (const [t, want] of [['4 oz 93/7 ground beef', 'ground-beef-93'], ['4 oz 80/20 ground beef', 'ground-beef-80'], ['85% lean ground beef', 'ground-beef-85'], ['ground beef 90 percent lean', 'ground-beef-90'], ['1 lb 95/5 ground beef raw', 'ground-beef-95-raw'], ['ground beef', 'ground-beef'], ['lean ground beef', 'ground-beef-lean']])
    ok(id(t) === want, `“${t}” → ${want} (got ${id(t)})`);
  ok(T(parse('4 oz 80/20 ground beef')[0]).f > T(parse('4 oz 95/5 ground beef')[0]).f * 2, '80/20 much fattier than 95/5');
  ok(id('white rice') === 'rice' && id('brown rice') === 'rice-brown' && id('1/4 cup dry rice') === 'rice-dry' && id('uncooked brown rice') === 'rice-brown-dry', 'rice white/brown, cooked/dry');
  ok(near(T(parse('1 cup dry rice')[0]).cal / T(parse('1 cup white rice')[0]).cal, 3.3, 0.4), 'a cup of dry rice ≈ 3 cups cooked');
  ok(id('spaghetti') === 'pasta' && id('2 oz dry pasta') === 'pasta-dry' && id('whole wheat pasta') === 'pasta-whole-wheat', 'pasta cooked/dry/whole wheat');
  ok(id('sweet potato') === 'sweet-potato' && id('red potatoes') === 'potato-red' && id('mashed potatoes') === 'mashed-potato' && id('roasted potatoes') === 'potato-roasted' && id('hash browns') === 'hash-brown', 'potato kinds');
  ok(near(T(parse('a large baked potato')[0]).cal / T(parse('a small baked potato')[0]).cal, 299 / 138, 0.05), 'potato sizes use grams, not a flat multiplier');
  ok(id('black beans') === 'beans-black' && id('pinto beans') === 'beans-pinto' && id('kidney beans') === 'beans-kidney' && id('refried beans') === 'beans-refried' && id('cannellini beans') === 'beans-white' && id('chickpeas') === 'chickpeas', 'bean varieties');
  ok(id('scrambled eggs') === 'egg-scrambled' && id('2 fried eggs') === 'egg-fried' && id('hard boiled egg') === 'egg', 'egg preparations');
  ok(id('skim milk') === 'milk-skim' && id('whole milk') === 'milk-whole' && id('milk') === 'milk', 'milk fat levels');
}

section('Natural quantities');
{
  const one = (t) => parse(t)[0];
  ok(one('a bowl of white rice').unit === 'bowl' && near(T(one('a bowl of white rice')).cal, 308, 5), 'a bowl');
  ok(one('a plate of spaghetti').unit === 'plate', 'a plate');
  ok(one('a cup of black beans').unit === 'cup' && one('a tablespoon of peanut butter').unit === 'tbsp', 'cup / tablespoon');
  ok(one('half a package of dry pasta').qty === 0.5 && one('half a package of dry pasta').unit === 'package', 'half a package');
  ok(one('a few pieces of chicken breast').qty === 3, 'a few pieces');
  ok(one('150 g white rice').unit === 'g' && near(T(one('150 g white rice')).cal, 195, 1), 'exact grams used as typed');
  ok(one('6 oz salmon').unit === 'oz' && near(T(one('6 oz salmon')).p, 37.6, 0.5), 'exact ounces used');
  ok(one('a large chicken breast').sizeWord === 'large' && T(one('a large chicken breast')).p > T(one('a chicken breast')).p, 'a large chicken breast');
  ok(one('McDonalds medium fries').unit === 'medium' && one('mcdonalds large fries').unit === 'large' && T(one('mcdonalds large fries')).cal === 480, 'small/medium/large restaurant sizes');
  ok(one('one restaurant portion of fried rice').unit === 'serving', 'one restaurant portion');
  ok(one('a banana').assumed === false && one('banana').assumed === true, 'assumed amounts are flagged');
}

section('Restaurants');
{
  let r = parse('chipotle double steak burrito with extra rice and pinto beans');
  ok(r[0].foodId === 'r:chipotle:tortilla-burrito' && r[1].foodId === 'r:chipotle:steak' && r[1].qty === 2 && r[2].qty === 1.5, 'burrito = tortilla + double steak; extra rice ×1.5');
  r = parse('chipotle soft tacos with chicken');
  ok(r[0].foodId === 'r:chipotle:taco-flour' && r[0].qty === 3, 'soft tacos → 3 flour tortillas');
  ok(parse('McDonalds Big Mac and a large fries').map((i) => i.foodId).join() === 'r:mcdonalds:big-mac,r:mcdonalds:fries', 'chain context carries to the next item');
  ok(parse('Big Mac')[0].foodId === 'r:mcdonalds:big-mac' && parse('a crunchwrap supreme')[0].foodId === 'r:tacobell:crunchwrap', 'distinctive names without the chain');
  ok(T(parse('10 piece mcnuggets')[0]).cal === 410 && T(parse('20 mcnuggets')[0]).cal === 830 && near(T(parse('7 mcnuggets')[0]).cal, 297.5, 0.1), 'nugget packs use published values; odd counts scale');
  ok(T(parse('chick fil a 12 count nuggets')[0]).p === 40, 'Chick-fil-A 12 ct = 40 g protein');
  ok(T(parse('footlong turkey sub from subway')[0]).cal === 540 && parse('subway turkey sub')[0].unit === '6-inch', 'Subway 6-inch vs footlong');
  ok(parse('panera cup of broccoli cheddar soup')[0].unit === 'small' && parse('panera bowl of broccoli cheddar soup')[0].unit === 'medium', 'Panera cup vs bowl');
  ok(parse('chicken')[0].src === 'db' && parse('nuggets')[0].src === 'db', 'generic words stay generic without a chain');
  const offMenu = parse('chipotle quinoa')[0];
  ok(offMenu.match === 'rough' && /Not on our Chipotle menu/.test(offMenu.note), 'off-menu item: generic estimate, says so');
  ok(parse('subway cookie')[0].conf === 'estimated', 'approximate chains are marked Estimate');
  ok(parse('Chipotle bowl with chicken, rice, and 2 eggs').pop().src === 'db', 'non-menu food after a chain stays generic');
}

section('Homemade recipes: similar dishes are distinct');
{
  const sig = (t) => parse(t).map((i) => i.foodId).join('+');
  const tot = (t) => Math.round(N.sumItems(parse(t)).cal);
  const wrap = sig('chicken caesar wrap'), salad = sig('grilled chicken caesar salad'), sand = sig('crispy chicken caesar sandwich');
  ok(wrap !== salad && salad !== sand && wrap !== sand, 'wrap / salad / sandwich break down differently');
  ok(wrap.includes('flour-tortilla-large') && salad.includes('croutons') && sand.includes('crispy-chicken-fillet') && sand.includes('bun'), 'each has the right components');
  ok(new Set([tot('chicken caesar wrap'), tot('grilled chicken caesar salad'), tot('crispy chicken caesar sandwich')]).size === 3, 'and different totals');
  const r = parse('2 chicken caesar wraps');
  ok(r.every((i) => i.partOf === 'Chicken Caesar wrap' && i.conf === 'estimated' && i.match === 'rough'), 'recipe parts are labelled as an estimated breakdown');
  ok(r.find((i) => i.foodId === 'flour-tortilla-large').qty === 2, 'quantity multiplies every part');
  ok(parse('spaghetti with meat sauce').length === 3 && parse('spaghetti').length === 1, '"with" inside a dish name doesn’t split it');
}

section('Unknown foods are never given numbers');
{
  const u = parse('a plate of zorbleberries')[0];
  ok(u.unknown && !u.per, 'unknown has no values');
  ok(N.confidence(u).level === 'none', 'confidence: needs a match');
}

section('Units: switching keeps the amount equivalent');
{
  const it = parse('1 cup white rice')[0];
  const g = N.reunit(it, 'g');
  ok(g.unit === 'g' && g.qty === 158 && near(T(g).cal, T(it).cal, 1), '1 cup → 158 g, same calories');
  const oz = N.reunit(it, 'oz');
  ok(near(T(oz).cal, T(it).cal, 4), 'cup → oz within rounding');
  ok(N.unitsFor(it).includes('bowl') && N.unitsFor(it).includes('g'), 'units offered include portions and weights');
  const fr = parse('mcdonalds medium fries')[0];
  ok(N.unitsFor(fr).join() === 'small,medium,large' && T(N.reunit(fr, 'small')).cal === 230, 'restaurant size switch');
  const sub = parse('subway turkey sub')[0];
  ok(T(N.reunit(sub, 'footlong')).cal === 540, '6-inch → footlong');
  const tz = parse('Oikos Triple Zero')[0];
  const tzg = N.reunit(tz, 'g');
  ok(tzg && tzg.qty === 150 && T(tzg).p === 15, 'product cup → 150 g');
  ok(N.reunit(parse('a banana')[0], 'jar') === null, 'nonsense unit refused, never guessed');
}

section('Personalization: learned matches, usual portions');
{
  WT.db.nutrition = N.fresh();
  const before = parse('my usual yogurt')[0];
  ok(before.foodId !== 'p:oikos-triple-zero', 'not known before');
  N.learn('my usual yogurt', 'p:oikos-triple-zero');
  const after = parse('my usual yogurt')[0];
  ok(after.foodId === 'p:oikos-triple-zero' && after.learned && N.confidence(after).label === 'Your match', 'learned phrase resolves directly');
  ok(parse('2 my usual yogurts')[0].qty === 2, 'learned match keeps the typed amount');
  N.learn('chicken', 'chicken-thigh');
  ok(parse('chicken')[0].foodId === 'chicken-thigh' && parse('6 oz chicken')[0].unit === 'oz', 'a corrected generic match is remembered');
  delete WT.db.nutrition.learned.chicken;
  N.rememberPortion('rice', 1.5, 'cup');
  const usual = parse('white rice')[0];
  ok(usual.qty === 1.5 && usual.unit === 'cup' && usual.usual && /usual amount/.test(usual.note), 'no amount typed → your usual amount');
  ok(parse('2 cups white rice')[0].qty === 2, 'typed amount always wins');
  N.rememberPortion('rice', 200, 'g');
  ok(parse('rice')[0].unit === 'g' && parse('rice')[0].qty === 200, 'usual portion can be in grams');
}

section('Diary: meals, totals, copy, saved meals, habits');
{
  WT.db.nutrition = N.fresh();
  const t = N.dayKey(), y = N.addDays(t, -1);
  ok(N.mealAt(new Date(2026, 0, 1, 7, 30)) === 'breakfast' && N.mealAt(new Date(2026, 0, 1, 12)) === 'lunch' && N.mealAt(new Date(2026, 0, 1, 19)) === 'dinner' && N.mealAt(new Date(2026, 0, 1, 15, 30)) === 'snack', 'meal from time of day');
  const b = N.addItems(parse('2 scrambled eggs and a banana'), t, 'breakfast');
  N.addItems(parse('Chipotle chicken bowl with white rice and black beans'), t, 'lunch');
  ok(b.every((e) => e.meal === 'breakfast') && b[0].group === b[1].group, 'items logged together share a meal and a group');
  ok(N.entriesFor(t, 'lunch').length === 3 && N.mealTotals(t, 'lunch').cal === 520, 'meal totals (Chipotle 180+210+130)');
  const day = N.dayTotals(t);
  ok(near(day.cal, N.mealTotals(t, 'breakfast').cal + 520, 0.01), 'day total = sum of meals');
  const copied = N.copyEntries(b.map((e) => e.id), y, 'breakfast');
  ok(copied.length === 2 && N.entriesFor(y).length === 2 && copied[0].id !== b[0].id, 'duplicate a meal to another day');
  const m = N.saveMeal('Usual breakfast', b, 'breakfast');
  ok(m && m.items.length === 2 && !m.items[0].id, 'saved meal stores items, not entry ids');
  const re = N.logMeal(m.id, t, 'breakfast');
  ok(re.length === 2 && N.mealById(m.id).uses === 1, 'saved meal logs in one step');
  ok(N.saveMeal('usual BREAKFAST', b) === m && WT.db.nutrition.meals.length === 1, 'same name updates instead of duplicating');
  N.addItems(parse('2 scrambled eggs and a banana'), N.addDays(t, -2), 'breakfast');
  N.addItems(parse('2 scrambled eggs and a banana'), N.addDays(t, -3), 'breakfast');
  const fr = N.frequent(5);
  ok(fr[0].name === 'Scrambled eggs' || fr[0].name === 'Banana', 'frequent foods ranked by count');
  WT.db.nutrition.meals = [];
  const combos = N.frequentMeals(3);
  ok(combos.length >= 1 && combos[0].count >= 3 && /Scrambled eggs|Banana/.test(combos[0].name), 'frequently logged combinations detected');
  // targets
  WT.db.profile.calorieTarget = null;
  ok(N.targets().cal === null && N.targets().c === null, 'no calorie target → none invented');
  WT.db.profile.calorieTarget = 2400;
  WT.db.profile.proteinTarget = 180;
  const tg = N.targets();
  ok(tg.c > 0 && tg.f > 0 && Math.abs(tg.p * 4 + tg.c * 4 + tg.f * 9 - 2400) < 50, 'carbs and fat derived from calories after protein');
  WT.db.profile.carbTarget = 200;
  ok(N.targets().c === 200, 'explicit carb target wins');
  Object.assign(WT.db.profile, { calorieTarget: null, carbTarget: null, proteinTarget: 150 });
}

section('Search across every source');
{
  const r = N.searchAll('chipotle chicken');
  ok(r[0] && r[0].id === 'r:chipotle:chicken', 'restaurant item first for "chipotle chicken"');
  const b = N.searchAll('brown rice');
  ok(b[0].id === 'rice-brown', 'generic USDA food for "brown rice"');
  ok(N.searchAll('triple zero').some((x) => x.id === 'p:oikos-triple-zero'), 'branded products searchable');
  const rep = N.resolveAs(parse('1 cup white rice')[0], 'rice-brown');
  ok(rep.foodId === 'rice-brown' && rep.qty === 1 && rep.unit === 'cup', 'replacing keeps amount and unit when the new food has it');
}

section('Migration v5 → v6 keeps everything');
{
  const v5 = { version: 5, profile: { name: 'Sam', proteinTarget: 160 }, history: [{ id: 'h1', type: 'push', title: 'Push', startedAt: '2026-10-01T17:00:00.000Z', exercises: [] }], customExercises: [], overrides: {},
    nutrition: { entries: [{ id: 'e1', date: '2026-10-02', at: '2026-10-02T07:45:00', name: 'Eggs', qty: 2, unit: 'egg', per: { p: 6, cal: 72, c: 0.5, f: 5 }, src: 'db', conf: 'estimated' }, { id: 'e2', date: '2026-10-02', at: '2026-10-02T19:10:00', name: 'Steak', qty: 1, unit: 'steak', per: { p: 50, cal: 400, c: 0, f: 22 }, src: 'db' }], foods: [{ id: 'f1', name: 'My shake', per: { p: 30 }, aliases: ['shake'], fav: true }] } };
  mem['wt.data.v1'] = JSON.stringify(v5);
  WT.load();
  const d = WT.db;
  ok(d.version === 6, 'version 6');
  ok(d.profile.name === 'Sam' && d.profile.proteinTarget === 160 && d.profile.calorieTarget === null, 'profile kept; new targets unset');
  ok(JSON.stringify(d.history) === JSON.stringify(v5.history), 'workout history untouched');
  ok(d.nutrition.entries.length === 2 && d.nutrition.entries[0].meal === 'breakfast' && d.nutrition.entries[1].meal === 'dinner', 'old entries get a meal from the time they were logged');
  ok(d.nutrition.entries.every((e) => e.group), 'old entries get a group');
  ok(d.nutrition.foods[0].fav && d.nutrition.foods[0].aliases[0] === 'shake', 'saved foods kept');
  ok(Array.isArray(d.nutrition.meals) && typeof d.nutrition.learned === 'object' && Array.isArray(d.body.weights), 'new collections created empty');
  // export → import round trip, merge without duplicates
  N.saveMeal('Test meal', d.nutrition.entries.slice(0, 1), 'breakfast');
  WT.body.addWeight('2026-10-03', 180);
  const backup = WT.exportData();
  WT.resetAll();
  WT.save = () => {};
  WT.importData(backup, 'replace');
  ok(WT.db.nutrition.meals.length === 1 && WT.db.body.weights.length === 1 && WT.db.nutrition.entries.length === 2, 'replace restores meals and body data');
  WT.importData(backup, 'merge');
  ok(WT.db.nutrition.meals.length === 1 && WT.db.body.weights.length === 1 && WT.db.nutrition.entries.length === 2, 'merge adds no duplicates');
}

section('Analytics: periods');
{
  const now = new Date(2026, 10, 22, 15);
  const r = WT.periodRange('30d', now);
  ok(r.days === 30 && r.end - r.start === 30 * DAY && r.prevEnd.getTime() === r.start.getTime(), '30-day range and the one before it');
  ok(WT.periodRange('7d', now).days === 7 && WT.periodRange('6m', now).days === 182 && WT.periodRange('1y', now).days === 365, 'other periods');
  ok(WT.buckets(WT.periodRange('1y', now))[0].kind === 'month' && WT.buckets(WT.periodRange('90d', now))[0].kind === 'week', 'weekly buckets, monthly beyond ~6 months');
}

// Build a controlled history: 8 weeks, progressing upper body, fading legs, runs getting longer
function buildHistory() {
  WT.resetAll();
  WT.save = () => {};
  const now = Date.now();
  const mk = (daysAgo, exs) => {
    const start = new Date(now - daysAgo * DAY); start.setHours(18, 0, 0, 0);
    const s = { id: WT.uid(), type: 'full', title: 'Full Body', startedAt: start.toISOString(), exercises: exs.map(([id, w, r]) => { const it = WT.sessionItem(id); it.sets = [0, 1, 2].map(() => ({ w: String(w), r: String(r), done: true })); return it; }) };
    WT.finishSession(s); s.endedAt = start.toISOString(); s.durationSec = 3600;
    WT.db.history.push(s);
  };
  for (let wk = 8; wk >= 0; wk--) {
    const k = 8 - wk, n = wk < 4 ? 3 : 2;
    for (let j = 0; j < n; j++) {
      const ex = [['db-bench-press', 40 + k * 2.5, 10], ['lat-pulldown', 100 + k * 5, 10], ['db-shoulder-press', 30 + k * 1.5, 10]];
      if (wk >= 4 || j === 0) ex.push(['goblet-squat', 40 + k * 2.5, 12]);
      mk(wk * 7 + j * 2 + 1, ex);
    }
    WT.saveRun({ date: N.dayKey(now - (wk * 7 + 3) * DAY), dist: 2 + k * 0.2, time: (2 + k * 0.2) * (10 - k * 0.1) });
  }
}

section('Analytics: strength, cardio, consistency');
{
  buildHistory();
  const r = WT.periodRange('30d');
  const s = WT.strengthSummary(r);
  ok(s.list.length >= 3 && s.byRegion.upper.up >= 3 && s.median > 0, 'upper-body lifts improving (' + s.list.map((x) => x.ex.id + ' ' + Math.round(x.pct) + '%').join(', ') + ')');
  const cs = WT.cardioSummary(r);
  ok(cs.total.n === 4 || cs.total.n === 5, 'runs in the last 30 days (' + cs.total.n + ')');
  ok(near(cs.pace, cs.total.time / cs.total.dist, 1e-9) && cs.prevAvgDist < cs.avgDist, 'pace = time / distance; longer runs than before');
  ok(WT.parseRunTime('28:30') === 28.5 && WT.parseRunTime('1:05:00') === 65 && WT.parseRunTime('31') === 31, 'run time parsing');
  const c = WT.consistency(r);
  ok(c.count > c.prevCount, 'more workouts this period than the previous one');
  ok(c.groups.legs.sets < WT.consistency({ start: r.prevStart, end: r.prevEnd, prevStart: r.prevStart, prevEnd: r.prevStart, days: 30 }).groups.legs.sets, 'lower-body sets dropped');
  ok(c.streak >= 3, 'weekly streak counted (' + c.streak + ')');
  const saved = WT.db.history[WT.db.history.length - 1];
  ok(saved.recorded && saved.type === 'cardio' && saved.exercises[0].sets[0].done && saved.durationSec > 0, 'a recorded run is a normal history session');
}

section('Insights are grounded in the data');
{
  const ins = WT.insights('30d');
  const txt = ins.items.map((x) => x.text).join(' | ');
  ok(ins.items.some((x) => x.area === 'Strength' && x.kind === 'up' && /upper-body/.test(x.text)), 'strength improved across upper-body exercises');
  ok(ins.items.some((x) => x.area === 'Consistency' && /compared with/.test(x.text)), 'workout count vs previous period');
  ok(ins.items.some((x) => x.area === 'Balance' && /lower-body/.test(x.text) && x.action), 'lower-body decline flagged with a recommendation');
  ok(ins.items.some((x) => x.area === 'Cardio' && /average run has increased/.test(x.text)), 'running distance increase');
  ok(!ins.items.some((x) => x.area === 'Nutrition' && /below your target/.test(x.text)), 'no nutrition claims without food data');
  ok(!ins.items.some((x) => /great job|keep it up|you got this/i.test(x.text)), 'no generic motivation');
  console.log('   ', txt.slice(0, 400));
  // protein insight needs ≥5 logged days
  const t = N.dayKey();
  for (let d = 1; d <= 4; d++) N.addItems(parse('4 oz chicken breast'), N.addDays(t, -d), 'dinner');
  ok(!WT.insights('30d').items.some((x) => /protein intake/.test(x.text)), 'four days of food: no protein claim yet');
  N.addItems(parse('4 oz chicken breast'), N.addDays(t, -5), 'dinner');
  const p = WT.insights('30d').items.find((x) => /protein intake has been below/.test(x.text));
  ok(p && /5 of 5/.test(p.text) && p.action, 'five days below target → protein insight with an action');
  // weight trend needs 3 weigh-ins over 2 weeks
  WT.body.addWeight(N.addDays(t, -20), 190);
  WT.body.addWeight(N.addDays(t, -10), 189);
  ok(!WT.insights('30d').items.some((x) => x.area === 'Body'), 'two weigh-ins: no weight trend');
  WT.body.addWeight(t, 188);
  ok(WT.insights('30d').items.some((x) => x.area === 'Body' && /down about 0\.7/.test(x.text)), 'three weigh-ins over 20 days → trend ≈ 0.7 lb/week');
  ok(WT.body.addWeight(t, 187.5) && WT.body.weights().filter((w) => w.date === t).length === 1, 'same-day weigh-in replaces, no duplicates');
}

section('Not enough data → says so');
{
  WT.resetAll();
  WT.save = () => {};
  const ins = WT.insights('30d');
  ok(!ins.items.length && /appear once you’ve logged/.test(ins.needMore), 'empty: explains what to track');
  WT.saveRun({ date: N.dayKey(), dist: 3, time: 30 });
  const one = WT.insights('30d');
  ok(!one.items.length && /1 run/.test(one.needMore) && /2\+ runs/.test(one.needMore), 'a single run: no trend claimed, thresholds explained');
  ok(WT.cardioSummary(WT.periodRange('7d')).pace === 10, 'single run pace 10:00 /mi');
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
