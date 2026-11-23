/* Phase 4 — branded grocery nutrition: exact products return their own label values and serving sizes; packages,
 * barcodes, your library, online-result fit and the coverage report. Run: node tests/grocery.test.js */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
for (const f of ['exercises.js', 'core.js', 'engine.js', 'foods.js', 'fooddb.js', 'products.js', 'restaurants.js', 'brands.js', 'nutrition.js', 'lookup.js'])
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
WT.load();
WT.save = () => {};
const N = WT.nut;
let pass = 0, fail = 0;
const ok = (c, m) => (c ? pass++ : (fail++, console.log('  FAIL: ' + m)));
const section = (s) => console.log(s);
const one = (t) => N.parse(t)[0];
const T = (it) => N.itemTotals(it);
const near = (a, b, tol) => a != null && Math.abs(a - b) <= (tol == null ? Math.max(0.6, Math.abs(b) * 0.015) : tol);
const desc = (r) => (r.ambiguous ? `asks [${r.candidates.map((c) => c.id).join(', ')}]` : r.unknown ? 'unknown' : `${r.foodId} ${Math.round(T(r).cal)} cal ${T(r).p} g`);

/** text → product id, servings, and the label values for that amount */
function label(text, id, { qty, unit, cal, p, c, f, serv, status } = {}) {
  const r = one(text);
  ok(!r.ambiguous && r.foodId === 'p:' + id, `“${text}” → ${id} (${desc(r)})`);
  if (r.ambiguous || r.foodId !== 'p:' + id) return r;
  const t = T(r);
  if (qty != null) ok(r.qty === qty, `“${text}”: qty ${qty} (got ${r.qty})`);
  if (unit) ok(r.unit === unit, `“${text}”: unit ${unit} (got ${r.unit})`);
  for (const [k, v] of [['cal', cal], ['p', p], ['c', c], ['f', f]]) if (v !== undefined) ok(v === null ? r.per[k] == null : near(t[k], v), `“${text}”: ${k} ${v} (got ${v === null ? r.per[k] : t[k]})`);
  if (serv) ok(r.note.includes(serv), `“${text}”: shows the label serving “${serv}” (${r.note})`);
  if (status) ok(r.conf === status, `“${text}”: ${status} (got ${r.conf})`);
  return r;
}

section('The named searches return the exact product and its label');
label('Oikos Triple Zero vanilla', 'oikos-triple-zero', { cal: 80, p: 15, c: 6, f: 0, serv: '5.3 oz / 150 g', status: 'verified' });
label('Oikos Triple Zero mixed berry', 'oikos-tz-mixed-berry', { cal: 90, p: 15, c: 7, f: 0, status: 'reference' });
label('oikos triple zero strawberry', 'oikos-tz-strawberry', { cal: 90, p: 15 });
label('oikos triple zero peach yogurt', 'oikos-tz-peach', { cal: 90, p: 15 });
let r = one('Oikos Triple Zero');
ok(r.foodId === 'p:oikos-triple-zero' && r.flavorAssumed === 'Vanilla' && N.confidence(r).level !== 'high', 'Triple Zero, no flavor: the line’s default (Vanilla), said so, not “exact”');
r = one('Oikos Triple Zero black cherry');
ok(r.ambiguous && r.variant === 'Black Cherry' && r.candidates.some((c) => c.nodata && c.flavor === 'Black Cherry'), 'a flavor with no label → asks; offers search / label entry for it');

label('Pioneer Pastures vanilla protein shake', 'pioneer-a2-shake', { cal: 160, p: 30, c: null, f: null, serv: '11 fl oz', status: 'verified' });
label('pioneer pastures chocolate protein shake', 'pioneer-a2-shake', { cal: 160, p: 30 });
r = one('Pioneer Pastures snickerdoodle protein shake');
ok(r.ambiguous && r.variant === 'Snickerdoodle', 'Pioneer Pastures Snickerdoodle: not in the data → asks (no borrowed numbers)');

label('a serving of Barilla Protein+', 'barilla-protein-plus', { qty: 1, cal: 190, p: 10, c: 38, f: 1, serv: '2 oz dry (56 g)', status: 'reference' });
label('2 oz barilla protein plus penne', 'barilla-protein-plus', { unit: 'oz', cal: 190, p: 10 });
label('a box of barilla protein plus', 'barilla-protein-plus', { unit: 'box (14.5 oz)', cal: 1330, p: 70 });
label('1 serving of barilla chickpea rotini', 'barilla-chickpea', { cal: 190, p: 12, c: 34, f: 3.5 });
label('barilla red lentil penne', 'barilla-red-lentil', { cal: 190, p: 13, status: 'estimated' });
label('barilla spaghetti', 'barilla-classic', { cal: 200, p: 7, c: 42, f: 1 });

label('2 slices of Dave’s Killer Bread good seed', 'dkb-good-seed', { qty: 2, unit: 'slice', cal: 240, p: 10, c: 46, f: 5, serv: '45 g' });
label('1 slice daves killer bread 21 whole grains thin sliced', 'dkb-21-thin', { cal: 70, p: 3, serv: '28 g' });
label('2 slices dkb powerseed', 'dkb-powerseed', { cal: 180, p: 10 });
label('1 slice of dave’s killer bread white bread', 'dkb-white-done-right', { cal: 110, p: 4 });
label('2 slices of Dave’s Killer Bread 21 whole grains', 'daves-21-whole-grains', { cal: 220, p: 10 });
r = one('1 slice of dave’s killer bread 21 whole grains');
ok(r.foodId === 'p:daves-21-whole-grains', 'regular 21 Whole Grains is not the Thin-Sliced product');

label('2 oz oscar mayer smoked turkey', 'om-smoked-turkey', { cal: 50, p: 9, c: 2, f: 1, status: 'reference' });
label('oscar mayer oven roasted turkey', 'oscar-mayer-turkey', { cal: 60, p: 9 });
label('oscar mayer honey smoked turkey', 'om-honey-smoked-turkey', { cal: 50, p: 9, status: 'estimated' });
r = one('Oscar Mayer turkey');
ok(r.ambiguous && ['p:oscar-mayer-turkey', 'p:om-smoked-turkey', 'p:om-honey-smoked-turkey'].every((id) => r.candidates.some((c) => c.id === id)), '“Oscar Mayer turkey”: several turkeys → asks which');
r = one('Oscar Mayer turkey bacon');
ok(r.foodId === 'p:om-turkey-bacon' && T(r).cal === 45, 'Oscar Mayer turkey bacon is bacon, never deli turkey');

label('Rao’s marinara', 'raos-marinara', { cal: 100, p: 2, c: 6, f: 7, serv: '½ cup (125 g)', status: 'reference' });
label('rao’s vodka sauce', 'raos-vodka', { cal: 90, p: 3, c: 7, f: 6 });
label('raos tomato basil', 'raos-tomato-basil', { cal: 80, p: 2, c: 6, f: 5 });
r = one('Rao’s roasted garlic');
ok(r.ambiguous && !r.candidates.some((c) => c.id.startsWith('p:')), 'Rao’s Roasted Garlic: no label → asks, never Marinara’s numbers');

label('quest cookies and cream bar', 'quest-bar-cookies-cream', { cal: 190, p: 21, c: 22, f: 8, serv: '60 g' });
label('quest birthday cake bar', 'quest-bar-birthday-cake', { cal: 180, p: 21 });
label('quest chocolate brownie protein bar', 'quest-bar-brownie', { cal: 170, p: 20 });
label('quest chocolate chip cookie dough bar', 'quest-bar-cccd', { p: 21 });
r = one('quest bar');
ok(r.ambiguous && /which flavor/.test(r.askWhy) && r.candidates.filter((c) => c.id.startsWith('p:quest-bar')).length === 4, '“Quest bar”: flavors have different labels → asks, listing the four labelled flavors');

label('1 cup fairlife whole milk', 'fairlife-whole-milk', { cal: 150, p: 13, c: 6, f: 8, serv: '240 mL' });
label('a cup of fairlife fat free milk', 'fairlife-fat-free-milk', { cal: 80, p: 13, f: 0 });
label('fairlife chocolate milk', 'fairlife-2-chocolate', { cal: 140, p: 13, c: 13, f: 4.5 });
label('a cup of fairlife 2% milk', 'fairlife-2-milk', { p: 13 });
r = one('fairlife milk');
ok(r.ambiguous && r.candidates.filter((c) => c.id.startsWith('p:fairlife')).length >= 4, '“fairlife milk”: 2%, whole, fat free or chocolate → asks');

section('More grocery products');
label('fage total 0%', 'fage-total-0-plain', { cal: 80, p: 16 });
label('1 fage 2% yogurt', 'fage-total-2-plain', { cal: 100, p: 15, f: 3 });
label('siggis vanilla skyr', 'siggis-vanilla-skyr', { cal: 110, p: 16 });
label('two good vanilla yogurt', 'two-good-vanilla', { cal: 80, p: 12 });
label('chobani zero sugar vanilla', 'chobani-zero-sugar-vanilla', { cal: 60, p: 11, status: 'estimated' });
label('kraft singles 2%', 'kraft-singles-2pct', { cal: 45, p: 4, serv: '19 g' });
label('rxbar chocolate sea salt', 'rxbar-choc-sea-salt', { cal: 200, p: 12, status: 'verified' });
label('clif builders bar', 'clif-builders-choc-pb', { cal: 290, p: 20 });
label('1 scoop gold standard whey', 'on-gold-standard-choc', { cal: 120, p: 24, c: null });
label('thomas english muffin', 'thomas-original-muffin', { cal: 150, p: 5 });
label('a dkb epic everything bagel', 'dkb-epic-everything', { cal: 280, p: 13 });
label('1/2 cup quaker old fashioned oats', 'quaker-old-fashioned', { cal: 150, p: 5 });
label('1 oz jack links original beef jerky', 'jack-links-original', { cal: 80, p: 10 });
label('hillshire farm ultra thin turkey', 'hillshire-ultra-thin-turkey', { cal: 60, p: 10 });
label('banza penne', 'banza-chickpea', { cal: 190, p: 11 });

section('Serving-size intelligence: package weight vs serving weight vs servings');
label('1 slice of dave’s killer bread powerseed', 'dkb-powerseed', { qty: 1, unit: 'slice', cal: 90 });
r = label('2 slices of oscar mayer smoked turkey', 'om-smoked-turkey', { qty: 2, unit: 'slice' });
ok(near(T(r).cal, 17, 1) && /converted from the label serving/.test(r.note), '2 deli slices ≈ ⅓ of a 2 oz serving, flagged ≈');
label('1 pioneer pastures vanilla shake', 'pioneer-a2-shake', { qty: 1, unit: 'bottle', p: 30 });
label('1 oikos triple zero vanilla yogurt', 'oikos-triple-zero', { qty: 1, unit: 'cup', cal: 80 });
r = label('half a bag of jack links original', 'jack-links-original', { qty: 0.5, unit: 'bag (2.85 oz)' });
ok(near(T(r).cal, 114, 1) && /2\.85 servings on its label/.test(r.note) && r.assumed, 'half a 2.85 oz bag = 1.4 servings; bag size assumed and said so');
r = label('half a jar of rao’s marinara', 'raos-marinara', { qty: 0.5, unit: 'jar (24 oz)' });
ok(near(T(r).cal, 272, 1), 'half a 24 oz jar of Rao’s marinara: 680 g ÷ 125 g × ½ ≈ 2.7 servings ≈ 272 cal');
r = label('half a 32 oz jar of rao’s marinara', 'raos-marinara', { unit: 'jar (32 oz)' });
ok(near(T(r).cal, 363, 1), 'a 32 oz jar uses its own net weight');
label('1 serving of barilla chickpea pasta', 'barilla-chickpea', { qty: 1, unit: 'serving', cal: 190 });
r = label('3 tablespoons of rao’s marinara', 'raos-marinara', { qty: 3, unit: 'tbsp' });
ok(near(T(r).cal, 37.5, 0.6) && /converted/.test(r.note), '3 tbsp = 3/8 of a ½-cup serving ≈ 38 cal, flagged ≈');
r = label('half a jar of jif creamy', 'jif-creamy', { unit: 'jar (16 oz)' });
ok(near(T(r).cal, 1330, 1), 'half a 16 oz Jif jar uses the label’s 14 servings');
r = label('a loaf of daves killer bread good seed', 'dkb-good-seed', { unit: 'loaf (27 oz)' });
ok(near(T(r).cal, 2040, 1), 'a 27 oz Good Seed loaf = 17 slices on the label');
r = label('a package of oscar mayer smoked turkey', 'om-smoked-turkey', { unit: 'package (9 oz)' });
ok(near(T(r).cal, 225, 1), 'a 9 oz deli package = 4.5 servings');
label('100 g barilla protein plus', 'barilla-protein-plus', { qty: 100, unit: 'g', p: 17.9 });
ok(N.netGrams('24 oz') === 680 && N.netGrams('1 lb 4 oz') === 567 && N.netGrams('52 fl oz') === 1538 && N.netGrams('jar') === null, 'net weight text → grams');

section('Evidence: never “verified” without the manufacturer');
WT.PRODUCTS.forEach((x) => {
  if (x.status === 'verified') ok(x.src.kind === 'manufacturer' && /^https:\/\//.test(x.src.url), `${x.id}: verified only from a manufacturer page`);
  ok(x.src && /^https:\/\//.test(x.src.url) && x.src.name, `${x.id}: names its source with a link`);
  ['p', 'cal', 'c', 'f'].forEach((k) => ok(x[k] === null || typeof x[k] === 'number', `${x.id}.${k}: a number or null (unknown) — never a placeholder`));
  (x.upc || []).forEach((u) => ok(WT.lookup.validCode(u.code) && u.from, `${x.id}: barcode ${u.code} passes the GS1 check digit and says where it was printed`));
  if (x.pkg) ok(x.pkg.unit && x.pkg.size && x.pkg.g > 0 && x.pkg.servings > 0, `${x.id}: package has unit, size, net weight and servings`);
  if (x.pkg && x.g) ok(Math.abs(x.pkg.g / x.g - x.pkg.servings) / x.pkg.servings < 0.12, `${x.id}: label servings agree with net weight ÷ serving weight`);
});
const codes = WT.PRODUCTS.flatMap((x) => (x.upc || []).map((u) => u.code.replace(/^0+/, '')));
ok(new Set(codes).size === codes.length, 'no barcode is claimed by two products');
r = one('a ratio vanilla protein yogurt');
ok(r.foodId === 'p:ratio-protein-vanilla' && r.per.c === null && r.per.f === 4, 'a value the source didn’t show stays null (missing), a 0 stays 0');
ok(one('oikos triple zero vanilla').per.f === 0, 'a real zero is 0, not missing');

section('Barcodes');
let hit = N.productByCode('036632008350');
ok(hit && hit.x.id === 'oikos-tz-mixed-berry', 'UPC-A → Triple Zero Mixed Berry');
hit = N.productByCode('0036632008350');
ok(hit && hit.x.id === 'oikos-tz-mixed-berry', 'EAN-13 form of the same code → same product');
hit = N.productByCode('850067605041');
ok(hit && hit.x.id === 'pioneer-a2-shake' && hit.flavor === 'Chocolate', 'a flavor’s barcode names that flavor');
ok(!N.productByCode('012345678905'), 'an unknown barcode is not matched to anything');

section('Your product library');
WT.db.nutrition = N.fresh();
let it = one('2 slices of dave’s killer bread good seed');
const lib = N.remember(it);
ok(lib && lib.productId === 'dkb-good-seed' && lib.code === '013764027039' && lib.pkg && lib.pkg.size === '27 oz' && lib.checked === '2026-11-22' && lib.catLine === 'daves-killer-bread:good-seed' && lib.line === 'Good Seed' && lib.source && lib.source.url,
  'a confirmed product is saved with brand, line, serving, package, barcode, source and last-checked date');
const mine = N.saveFood({ name: "Dave's Killer Bread Good Seed (my loaf)", brand: "Dave's Killer Bread", line: 'Good Seed', unit: 'slice', serving: '1 slice (45 g)', g: 45, per: { p: 6, cal: 130, c: 24, f: 3 }, status: 'user', catLine: 'daves-killer-bread:good-seed', units: { loaf: 17 }, pkg: { unit: 'loaf', size: '27 oz', g: 765, servings: 17 }, checked: '2026-11-20' }, false);
r = one('a slice of daves killer bread good seed');
ok(r.foodId === 'my:' + mine.id || r.foodId === 'my:' + lib.id, `a label you saved comes before the bundled one (${desc(r)})`);
const hits = N.searchAll('good seed', 6);
ok(hits.length && hits[0].lib, 'search lists your saved products first');
r = one('half a loaf of daves killer bread good seed');
ok(r.unit === 'loaf (27 oz)' || r.unit === 'loaf', 'your package size works for “half a loaf”');
WT.db.nutrition = N.fresh();

section('Online results: fit to what you searched');
const rec = (o) => Object.assign({ id: 'off:1', src: 'off', name: '', brand: '', code: '', quantity: '', per100: { cal: 60, p: 10, c: 5, f: 0 }, perServing: null, serving: { g: 150, text: '1 container (150 g)' }, status: 'estimated', source: { name: 'Open Food Facts', url: 'https://world.openfoodfacts.org' } }, o);
let fit = N.onlineFit('Oikos Triple Zero Black Cherry', rec({ name: 'Triple Zero Blended Mixed Berry', brand: 'Oikos' }));
ok(fit.tags.some((t) => /Brand matches/.test(t.t)) && fit.tags.some((t) => t.kind === 'warn' && /Different flavor/.test(t.t)), 'same brand, different flavor → flagged');
const fitExact = N.onlineFit('Oikos Triple Zero Black Cherry', rec({ name: 'Triple Zero Black Cherry Greek Yogurt', brand: 'Oikos' }));
ok(fitExact.s > fit.s && fitExact.tags.some((t) => /Flavor matches/.test(t.t)), 'the exact flavor ranks above a different flavor');
fit = N.onlineFit('Oikos Triple Zero vanilla', rec({ name: 'Triple Zero Vanilla', brand: 'Chobani' }));
ok(fit.tags.some((t) => t.kind === 'warn' && /Different brand/.test(t.t)), 'another brand → flagged');
fit = N.onlineFit("Rao's marinara 32 oz", rec({ name: 'Marinara Sauce', brand: "Rao's Homemade", quantity: '32 oz (907 g)' }));
ok(fit.tags.some((t) => t.kind === 'good' && /Package/.test(t.t)), 'package size that matches is noted');
fit = N.onlineFit('036632008350', rec({ name: 'Triple Zero Mixed Berry', brand: 'Oikos', code: '0036632008350' }));
ok(fit.tags.some((t) => /Barcode match/.test(t.t)) && fit.s >= 100, 'an exact barcode match ranks first');
fit = N.onlineFit('quest bar', rec({ name: 'Protein Bar', brand: 'Quest', per100: { cal: 300, p: 35, c: null, f: 10 } }));
ok(fit.missing.includes('Carbs') && !fit.missing.includes('Fat'), 'missing values are listed as missing, not shown as 0');

section('Coverage report');
const cov = N.coverage();
ok(cov.lines === cov.complete + cov.partial + cov.none + cov.userOnly, 'every branded product is counted once');
ok(cov.products === WT.PRODUCTS.length && cov.barcodesValid === cov.barcodes, 'labels and barcodes counted; every barcode valid');
ok(cov.complete >= 50, `complete labels: ${cov.complete}`);
ok(cov.missing.length === cov.partial + cov.none && cov.missing[0].group === 'Protein shakes & bars', 'missing list covers partial + without, priority categories first');
ok(cov.groups.some((g) => g.group === 'Frozen meals' && g.none > 0), 'frozen meals are listed as a gap (recognized, no labels yet)');
WT.db.nutrition = N.fresh();
N.saveFood({ name: 'Healthy Choice Power Bowl Chicken Feta', brand: 'Healthy Choice', line: 'Power Bowls', unit: 'meal', per: { p: 22, cal: 330, c: 40, f: 9 }, status: 'user', catLine: 'healthy-choice:power-bowls' }, false);
const cov2 = N.coverage();
ok(cov2.userOnly === cov.userOnly + 1 && cov2.none === cov.none - 1 && cov2.userLabels === 1, 'a label you enter moves that product from “without” to “your label”');
WT.db.nutrition = N.fresh();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
