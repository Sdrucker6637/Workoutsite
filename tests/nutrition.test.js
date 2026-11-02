/* Food & protein tracker: parser, estimates, store, migration and backup. node tests/nutrition.test.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = String(v)), removeItem: (k) => delete mem[k] };
for (const f of ['exercises.js', 'core.js', 'engine.js', 'foods.js', 'nutrition.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
const WT = globalThis.WT, N = WT.nut;
let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log('  FAIL:', msg); } };
const section = (s) => console.log(s);

WT.load();
WT.save = () => {}; // keep tests synchronous
const one = (t) => { const r = N.parse(t); ok(r.length === 1, `"${t}" → 1 item (got ${r.length})`); return r[0]; };
const P = (it) => N.rp(N.itemTotals(it).p);

section('Food table integrity');
const ids = new Set();
WT.FOODS.forEach((f) => {
  ok(!ids.has(f.id), 'unique id ' + f.id); ids.add(f.id);
  ok(f.n && f.a.length && f.u, 'fields ' + f.id);
  ['p', 'cal', 'c', 'f'].forEach((k) => ok(typeof f[k] === 'number' && f[k] >= 0, `${f.id}.${k} number`));
  ok(f.cal >= f.p * 4 * 0.6 || f.cal < 20, `${f.id}: calories plausible for protein`);
  Object.values(f.units || {}).forEach((m) => ok(m > 0, `${f.id} unit multiplier > 0`));
});
console.log('  foods:', WT.FOODS.length, '· aliases:', WT.FOODS.reduce((a, f) => a + f.a.length, 0));

section('Examples from the brief');
const cases = [
  ['2 scoops of Greek yogurt', 'greek-yogurt', 2, 'scoop', [18, 28]],
  ['2 chicken breasts', 'chicken-breast', 2, 'breast', [90, 115]],
  ['2 Oscar Mayer hot dogs', 'hot-dog', 2, 'hot dog', [8, 12]],
  ['1 Snickerdoodle protein shake', 'protein-shake', 1, 'shake', [20, 32]],
  ['A bowl of protein pasta', 'protein-pasta', 1, 'bowl', [12, 22]],
  ['3 eggs', 'egg', 3, 'egg', [17, 20]],
  ['A handful of almonds', 'almonds', 1, 'handful', [5, 7]],
  ['A cup of milk', 'milk', 1, 'cup', [8, 8]],
  ['1 serving of shrimp', 'shrimp', 1, 'serving', [20, 28]],
  ['A turkey sandwich', 'turkey-sandwich', 1, 'sandwich', [20, 28]],
];
for (const [t, id, qty, unit, [lo, hi]] of cases) {
  const it = one(t);
  ok(!it.unknown && it.foodId === id, `"${t}" → ${id} (got ${it.foodId})`);
  ok(it.qty === qty, `"${t}" qty ${qty} (got ${it.qty})`);
  ok(it.unit === unit, `"${t}" unit ${unit} (got ${it.unit})`);
  ok(P(it) >= lo && P(it) <= hi, `"${t}" protein ${P(it)} in ${lo}–${hi}`);
  console.log(`  ${t.padEnd(32)} → ${it.name} · ${N.fmtAmount(it.qty, it.unit)} · ≈${P(it)} g${it.note ? '  [' + it.note + ']' : ''}`);
}
const oscar = one('2 Oscar Mayer hot dogs');
ok(/^Oscar Mayer hot dog/.test(oscar.name) && oscar.generic && /not label data/.test(oscar.note), 'brand recognized, labelled as a typical (not label) estimate');
const snick = one('1 Snickerdoodle protein shake');
ok(/^Snickerdoodle protein shake$/.test(snick.name) && snick.generic && /generic/i.test(snick.note), 'unknown flavor → clearly labelled generic estimate');

section('Multiple foods in one sentence');
let r = N.parse('2 chicken breasts, a protein shake, and 2 hot dogs');
ok(r.length === 3 && r.map((x) => x.foodId).join() === 'chicken-breast,protein-shake,hot-dog', 'three items via commas + "and": ' + r.map((x) => x.foodId));
ok(Math.abs(r.reduce((a, x) => a + N.itemTotals(x).p, 0) - (106 + 25 + 10)) < 1, 'total protein adds up');
r = N.parse('3 eggs and toast with peanut butter\nprotein shake; greek yogurt plus a banana');
ok(r.map((x) => x.foodId).join() === 'egg,bread,peanut-butter,protein-shake,greek-yogurt,banana', 'and / with / newline / ; / plus: ' + r.map((x) => x.foodId));
r = N.parse('rice and beans and a chicken breast');
ok(r.length === 2 && r[0].foodId === 'rice-and-beans' && r[1].foodId === 'chicken-breast', '"rice and beans" stays one food');
r = N.parse('mac and cheese, a turkey and cheese sandwich & a pb&j');
ok(r.map((x) => x.foodId).join() === 'mac-and-cheese,turkey-sandwich,pbj', 'protected names with and/&: ' + r.map((x) => x.foodId));
ok(N.parse('').length === 0 && N.parse(' , and ').length === 0, 'empty input → nothing');

section('Quantities and serving words');
const q = (t, qty, unit, id) => { const it = one(t); ok(it.qty === qty && it.unit === unit && (!id || it.foodId === id), `"${t}" → ${qty} ${unit}${id ? ' ' + id : ''} (got ${it.qty} ${it.unit} ${it.foodId})`); return it; };
q('two chicken breasts', 2, 'breast');
q('1 1/2 cups of cottage cheese', 1.5, 'cup', 'cottage-cheese');
q('½ cup cottage cheese', 0.5, 'cup');
q('half a cup of greek yogurt', 0.5, 'cup');
q('a couple of eggs', 2, 'egg');
q('a dozen almonds', 12, 'almond');
q('20 almonds', 20, 'almond');
q('10 shrimp', 10, 'shrimp');
q('shrimp', 1, 'serving');
q('eggs', 2, 'egg');
q('2 scoops protein', 2, 'scoop', 'protein-powder');
q('a scoop of whey', 1, 'scoop', 'protein-powder');
q('1 package of jerky', 1, 'package', 'beef-jerky');
q('a can of tuna', 1, 'can', 'tuna');
q('2 cans of tuna', 2, 'can', 'tuna');
q('a glass of milk', 1, 'glass', 'milk');
q('2 slices of pizza', 2, 'slice', 'pizza');
q('3 slices of bacon', 3, 'slice', 'bacon');
q('peanut butter', 2, 'tbsp');
q('1 shake', 1, 'shake', 'protein-shake');
q('eggs x3', 3, 'egg');
q('one and a half chicken breasts', 1.5, 'breast');
q('8 oz chicken breast', 8, 'oz', 'chicken-breast');
const oz = one('8 oz chicken breast');
ok(P(oz) >= 66 && P(oz) <= 72, '8 oz chicken breast ≈ 70 g protein (' + P(oz) + ')');
const big = one('a large chicken breast'), plain = one('a chicken breast');
ok(P(big) > P(plain), 'size words scale (large > regular)');
ok(P(one('3 large eggs')) === P(one('3 eggs')), 'eggs ignore size words');
const sub = one('a footlong turkey sub');
ok(sub.foodId === 'turkey-sandwich' && sub.qty === 1 && P(sub) >= 40, 'footlong ≈ two 6-inch subs');
ok(one('6 inch turkey sub').qty === 1, '"6 inch" is a size, not a quantity');
ok(one('2 bowls of rice').unit === 'bowl', 'plural serving word');
ok(one('a handful of cheese').unit === 'handful', 'handful of cheese');
const rough = one('a scoop of chicken');
ok(rough.rough && /rough/.test(rough.note), 'unusual serving word is flagged as a rough size');

section('Plural / typo / phrasing tolerance');
ok(one('chicken breasts').foodId === 'chicken-breast', 'plural');
ok(one('Greek Yoghurt').foodId === 'greek-yogurt', 'spelling variant');
ok(one('I had 2 grilled chicken breasts for lunch').foodId === 'chicken-breast', 'filler words ignored');
ok(!one('grilled chicken breast').generic, 'cooking words do not mark an item generic');
ok(one('2 hot-dogs').foodId === 'hot-dog', 'hyphenated');
ok(one('greek vanilla yogurt').foodId === 'greek-yogurt', 'word in between');

section('Brands');
ok(one('premier protein shake').foodId === 'premier-protein' && P(one('premier protein shake')) === 30, 'Premier Protein label item');
ok(/check your package/.test(one('premier protein shake').note), 'label item still marked as estimate');
ok(one('core power elite').foodId === 'core-power-elite', 'Core Power Elite');
ok(one('fairlife core power').foodId === 'core-power', 'Fairlife Core Power');
ok(one('a cup of fairlife milk').foodId === 'fairlife-milk', 'Fairlife milk');
ok(one('oikos pro').foodId === 'oikos-pro', 'Oikos Pro');
const chob = one('chobani greek yogurt');
ok(chob.foodId === 'greek-yogurt' && /Chobani/.test(chob.name) && /not label data/.test(chob.note), 'brand without label data → generic with note');
ok(one('a quest bar').foodId === 'quest-bar', 'Quest bar');

section('Unrecognized foods are never silently logged');
const unk = one('a plate of zorbleberries');
ok(unk.unknown === true && !unk.per, 'unknown item flagged, no made-up protein');
const typo = one('chiken brest');
ok(typo.unknown && typo.suggestions.length && typo.suggestions[0].id === 'chicken-breast', 'typo → suggestion "Chicken breast" first: ' + JSON.stringify(typo.suggestions.map((s) => s.id)));
const res = N.resolveAs(typo, 'chicken-breast');
ok(!res.unknown && res.foodId === 'chicken-breast' && P(res) === 53, 'resolving a suggestion gives the estimate');

section('Store: log, edit, delete, totals, dates');
WT.db.nutrition = N.fresh();
const today = N.dayKey();
const yesterday = N.addDays(today, -1);
let added = N.addItems(N.parse('2 chicken breasts, a protein shake'), today);
ok(added.length === 2 && WT.db.nutrition.entries.length === 2, 'logged 2 entries');
ok(N.rp(N.dayTotals(today).p) === 131, 'daily total = 106 + 25 (' + N.rp(N.dayTotals(today).p) + ')');
N.addItems(N.parse('3 eggs'), yesterday);
ok(N.entriesFor(yesterday).length === 1 && N.rp(N.dayTotals(yesterday).p) === 18, 'past day logged separately');
ok(N.dayTotals(N.addDays(today, -2)).n === 0, 'empty day has n = 0');
// edit protein (sets per-unit) and quantity (scales)
const e = added[0];
N.updateEntry(e.id, { per: Object.assign({}, e.per, { p: 40 / e.qty }) });
ok(N.rp(N.itemTotals(N.entry(e.id)).p) === 40, 'edited protein');
N.updateEntry(e.id, { qty: 1 });
ok(N.rp(N.itemTotals(N.entry(e.id)).p) === 20, 'quantity change scales edited protein');
N.deleteEntry(added[1].id);
ok(WT.db.nutrition.entries.length === 2 && !N.entry(added[1].id), 'deleted one entry');
ok(N.rp(N.dayTotals(today).p) === 20, 'total updates after delete');
N.updateEntry(e.id, { date: yesterday });
ok(N.entriesFor(yesterday).length === 2 && N.entriesFor(today).length === 0, 'entry moved to another date');
ok(N.addDays('2026-03-01', -1) === '2026-02-28' && N.addDays('2024-12-31', 1) === '2025-01-01', 'date arithmetic');

section('Trends treat unlogged days as missing, not zero');
WT.db.nutrition = N.fresh();
N.addItems([{ name: 'X', qty: 1, unit: 'serving', per: { p: 120 } }], today);
N.addItems([{ name: 'Y', qty: 1, unit: 'serving', per: { p: 160 } }], N.addDays(today, -3));
const t7 = N.trend(7, 150);
ok(t7.days.length === 7 && t7.logged === 2 && t7.avg === 140, '7-day average over logged days only (' + t7.avg + ')');
ok(t7.reached === 1, 'days at target counted');
ok(N.trend(30, 150).days.length === 30, '30-day window');
ok(N.trend(7, 150, N.addDays(today, -20)).avg === null, 'no logged days → no average');

section('Guidance');
const g = (p, n, today) => N.guidance(p, 150, n, today);
ok(g(0, 0, true).state === 'empty', 'empty');
ok(g(110, 2, true).state === 'under' && /40 g short/.test(g(110, 2, true).msg) && /Greek yogurt or protein shake/.test(g(110, 2, true).msg), 'under: ' + g(110, 2, true).msg);
ok(g(140, 2, true).state === 'near' && /getting close/.test(g(140, 2, true).msg), 'near');
ok(g(150, 2, true).state === 'reached' && /reached your protein goal/.test(g(150, 2, true).msg), 'reached');
ok(g(200, 2, true).state === 'above' && /comfortably above/.test(g(200, 2, true).msg), 'above');
ok(!/more|eat/i.test(g(200, 2, true).msg), 'above target does not push more food');
ok(/that day/.test(g(100, 2, false).msg), 'past days use past phrasing');
ok(N.band(150).lo === 135 && N.band(150).hi === 165, 'flexible range 135–165');

section('Saved foods & favorites');
WT.db.nutrition = N.fresh();
const myShake = N.saveFood({ name: 'Snickerdoodle shake', qty: 1, unit: 'bottle', per: { p: 30, cal: 160, c: 4, f: 3 } }, true);
ok(myShake && myShake.fav && WT.db.nutrition.foods.length === 1, 'saved food');
let s = one('snickerdoodle shake');
ok(s.src === 'my' && P(s) === 30 && s.name === 'Snickerdoodle shake', 'parser recognizes saved food (beats generic)');
s = one('2 snickerdoodle shakes');
ok(P(s) === 60, 'saved food with quantity');
const logged = N.relog(myShake, today);
ok(logged.name === 'Snickerdoodle shake' && N.rp(N.dayTotals(today).p) === 30, 'one-tap relog');
N.saveFood({ name: 'snickerdoodle SHAKE', qty: 1, unit: 'bottle', per: { p: 32 } });
ok(WT.db.nutrition.foods.length === 1 && WT.db.nutrition.foods[0].per.p === 32, 'saving same name updates instead of duplicating');
N.addItems(N.parse('3 eggs'), today);
N.addItems(N.parse('3 eggs'), yesterday);
ok(N.recent().length === 1 && N.recent()[0].name === 'Eggs', 'recents de-duplicated, favorites excluded');
const saved2 = N.saveFood({ name: 'PB and banana toast', per: { p: 12 } });
ok(one('pb and banana toast').src === 'my', 'saved food containing "and" stays one item');
N.deleteFood(saved2.id);
ok(WT.db.nutrition.foods.length === 1, 'deleted saved food');

section('Migration, export and restore');
// v3 data (before the food log existed) upgrades without touching workouts
const v3 = { version: 3, profile: { name: 'Me', unit: 'kg' }, history: [{ id: 'w1', type: 'push', title: 'Push', startedAt: '2026-10-01T17:00:00Z', exercises: [{ exId: 'db-bench-press', sets: [{ w: '40', r: '10', done: true }] }] }], customExercises: [{ id: 'c1', name: 'Mine', primary: 'chest', secondary: [], equipment: ['bw'], intensities: ['standard'], intensity: 'standard', tags: [] }], overrides: {} };
mem['wt.data.v1'] = JSON.stringify(v3);
WT.load();
ok(WT.db.version === 4, 'migrated to v4');
ok(JSON.stringify(WT.db.history) === JSON.stringify(v3.history), 'workout history byte-identical after migration');
ok(WT.db.customExercises.length === 1 && WT.db.profile.unit === 'kg' && WT.db.profile.name === 'Me', 'custom exercises and settings kept');
ok(Array.isArray(WT.db.nutrition.entries) && WT.db.nutrition.entries.length === 0 && WT.db.profile.proteinTarget === 150, 'empty food log + default 150 g target');
// corrupt nutrition is sanitized
mem['wt.data.v1'] = JSON.stringify(Object.assign({}, v3, { version: 4, nutrition: { entries: [{ id: 'a', date: 'bad' }, { id: 'b', date: '2026-10-02', name: 'Eggs', qty: 'x' }, null], foods: 'nope' } }));
WT.load();
ok(WT.db.nutrition.entries.length === 1 && WT.db.nutrition.entries[0].qty === 1 && WT.db.nutrition.foods.length === 0, 'bad nutrition data sanitized');
// export → replace restore
WT.db.nutrition = N.fresh();
N.addItems(N.parse('2 chicken breasts and a protein shake'), today);
N.saveFood({ name: 'My shake', per: { p: 30 } });
WT.db.profile.proteinTarget = 170;
const backup = WT.exportData();
ok(JSON.parse(backup).data.nutrition.entries.length === 2, 'export contains food entries');
const before = JSON.stringify(WT.db.nutrition), hist = JSON.stringify(WT.db.history);
WT.db.nutrition = N.fresh(); WT.db.profile.proteinTarget = 150;
WT.importData(backup, 'replace');
ok(JSON.stringify(WT.db.nutrition) === before && WT.db.profile.proteinTarget === 170, 'replace restores food log + target exactly');
ok(JSON.stringify(WT.db.history) === hist, 'workouts intact after restore');
// merge
WT.db.nutrition.entries.splice(0, 1);
N.addItems(N.parse('3 eggs'), today);
WT.importData(backup, 'merge');
ok(WT.db.nutrition.entries.length === 3, 'merge adds missing entries and keeps new ones');
WT.importData(backup, 'merge');
ok(WT.db.nutrition.entries.length === 3 && WT.db.nutrition.foods.length === 1, 'merging twice does not duplicate');
// an old backup (no nutrition) merges without wiping the food log
WT.importData(JSON.stringify({ app: 'workout-tracker', data: v3 }), 'merge');
ok(WT.db.nutrition.entries.length === 3, 'merging a pre-nutrition backup keeps the food log');

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
