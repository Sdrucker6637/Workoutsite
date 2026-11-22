/* Branded product recognition: brands → product lines → variants → flavors → package sizes.
 * Most checks are GENERATED from the brand catalog (js/brands.js), so every brand and line is covered, not only
 * the examples. The invariant throughout: a product is picked only when what you typed identifies it; otherwise
 * Forge asks — and an incorrect product is never silently substituted.      node tests/brands.test.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = String(v)), removeItem: (k) => delete mem[k] };
for (const f of ['exercises.js', 'core.js', 'engine.js', 'foods.js', 'fooddb.js', 'products.js', 'restaurants.js', 'brands.js', 'nutrition.js', 'lookup.js'])
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
const WT = globalThis.WT, N = WT.nut;
let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log('  FAIL:', msg); } };
const section = (s) => console.log(s);
WT.load();
WT.save = () => {};
const one = (t) => N.parse(t)[0];
const T = (it) => N.itemTotals(it);
const productsOf = (line) => line.p.concat(line.variants.flatMap((v) => (v[2] && v[2].p) || []));
const describeRes = (r) => (r.ambiguous ? `asks [${r.candidates.map((c) => c.id).join(', ')}]` : r.unknown ? 'unknown' : r.foodId);

section('Catalog integrity');
{
  const ids = new Set();
  const owner = new Map();
  WT.BRAND_CATALOG.forEach((b) => {
    ok(!ids.has(b.id) && b.a.length && b.lines.length, `${b.id}: unique, has aliases and lines`);
    ids.add(b.id);
    const lids = new Set();
    b.lines.forEach((l) => {
      ok(!lids.has(l.id) && l.a.length, `${b.id}/${l.id}: unique line with aliases`);
      lids.add(l.id);
      productsOf(l).forEach((pid) => {
        const x = N.productById(pid);
        ok(x && WT.catalogFor(x.brand) === b, `${b.id}/${l.id}: product ${pid} exists and is ${b.name}'s`);
        ok(!owner.has(pid), `${pid} belongs to one line only`);
        owner.set(pid, `${b.id}/${l.id}`);
      });
      if (l.pack) l.pack.sizes.forEach(([sz, g]) => ok(/^\d+(\.\d+)? (oz|g|fl oz)$/.test(sz) && g > 0, `${b.id}/${l.id}: pack size ${sz} = ${g} g`));
    });
  });
  WT.PRODUCTS.forEach((x) => ok(owner.has(x.id), `bundled product ${x.id} is placed in a catalog line (${x.brand})`));
  ok(!JSON.stringify(WT.BRAND_CATALOG).match(/"(cal|protein|carbs|fat)":/), 'the catalog holds no nutrition');
  console.log('  brands:', WT.BRAND_CATALOG.length, '· lines:', WT.BRAND_CATALOG.reduce((a, b) => a + b.lines.length, 0), '· lines with label data:', WT.BRAND_CATALOG.reduce((a, b) => a + b.lines.filter((l) => productsOf(l).length).length, 0));
}

section('Generated: every line, by name');
{
  let n = 0;
  WT.BRAND_CATALOG.forEach((b) => b.lines.forEach((l) => {
    const text = `${b.name} ${l.name}`;
    const r = one(text);
    n++;
    const mine = productsOf(l).map((p) => 'p:' + p);
    if (!r.ambiguous && !r.unknown) {
      // a pick must be this line's own product — never another line's
      ok(mine.includes(r.foodId), `“${text}” picked ${r.foodId}, which isn't a ${l.name} product`);
    } else if (r.ambiguous) {
      const foreign = r.candidates.filter((c) => c.id.startsWith('p:') && !mine.includes(c.id));
      ok(!foreign.length, `“${text}” offers other lines' products: ${foreign.map((c) => c.id).join(', ')}`);
      ok(r.candidates.length > 0, `“${text}” asks with choices`);
      if (!mine.length) ok(r.candidates.some((c) => c.nodata && c.id.startsWith(`c:${b.id}:${l.id}`)), `“${text}”: the line is offered for search / label entry (${describeRes(r)})`);
    } else ok(false, `“${text}” not recognized at all`);
  }));
  console.log('  lines checked:', n);
}

section('Generated: lines with label data resolve to their product');
{
  const expectPick = [];
  WT.BRAND_CATALOG.forEach((b) => b.lines.forEach((l) => {
    if (!l.p.length || l.flavorMatters) return;
    // the line's most specific own phrase (not shared with other lines of the brand)
    const others = new Set(b.lines.filter((o) => o !== l).flatMap((o) => o.a));
    const phrase = l.a.filter((a) => !others.has(a)).sort((x, y) => y.length - x.length)[0];
    if (!phrase) return;
    expectPick.push([b, l, `${b.a[0]} ${phrase}`]);
  }));
  expectPick.forEach(([b, l, text]) => {
    const r = one(text);
    ok(!r.ambiguous && l.p.map((p) => 'p:' + p).includes(r.foodId), `“${text}” → ${l.p[0]} (${describeRes(r)})`);
  });
  console.log('  distinctive phrases checked:', expectPick.length);
}

section('Generated: brand alone never picks when the brand makes several lines');
WT.BRAND_CATALOG.forEach((b) => {
  const r = one(b.name);
  if (b.lines.length > 1) ok(r.ambiguous && !r.per, `“${b.name}” asks (${describeRes(r)})`);
});

section('Generated: another brand named → never that product');
{
  let n = 0;
  WT.BRAND_CATALOG.forEach((a) => a.lines.forEach((l) => {
    if (!l.p.length) return;
    const own = new Set(a.lines.filter((o) => o !== l).flatMap((o) => o.a));
    const phrase = l.a.find((x) => !own.has(x) && x.length > 3 && !a.a.some((al) => x.includes(al)));
    if (!phrase) return;
    WT.BRAND_CATALOG.filter((b) => b !== a && b.cat === a.cat).slice(0, 4).forEach((b) => {
      const text = `${b.name} ${phrase}`;
      const r = one(text);
      n++;
      ok(!(r.foodId && l.p.map((p) => 'p:' + p).includes(r.foodId)), `“${text}” must not be ${a.name}'s ${l.name} (${describeRes(r)})`);
      if (r.ambiguous) ok(!r.candidates.some((c) => c.id.startsWith('p:') && WT.catalogFor(N.productById(c.id.slice(2)).brand) === a), `“${text}” offers ${a.name} products`);
    });
  }));
  console.log('  cross-brand pairs checked:', n);
}

section('Generated: variants are different products');
WT.BRAND_CATALOG.forEach((b) => b.lines.forEach((l) => l.variants.forEach(([vn, va, vo]) => {
  const text = `${b.name} ${l.name} ${va[0]}`;
  const r = one(text);
  const vp = ((vo && vo.p) || []).map((p) => 'p:' + p);
  if (vp.length) ok(!r.ambiguous && vp.includes(r.foodId), `“${text}” → the ${vn} product (${describeRes(r)})`);
  else ok(r.ambiguous && !l.p.map((p) => 'p:' + p).includes(r.foodId) && r.candidates.some((c) => c.nodata && c.variant === vn), `“${text}”: ${vn} has no label → asks, never the regular ${l.name} (${describeRes(r)})`);
})));

section('Generated: flavors');
WT.BRAND_CATALOG.forEach((b) => b.lines.forEach((l) => {
  if (!l.p.length || !l.flavors.length) return;
  const xs = l.p.map(N.productById);
  l.flavors.forEach((fl) => {
    const text = `${b.name} ${l.a[0]} ${fl}`;
    const r = one(text);
    const listed = xs.find((x) => [x.flavor].concat(x.flavors || []).some((f) => f && f.toLowerCase() === fl.toLowerCase()));
    if (listed) ok(!r.ambiguous && r.foodId === 'p:' + listed.id && r.name.includes(fl), `“${text}” → ${listed.id} · ${fl} (${describeRes(r)})`);
    else {
      ok(r.ambiguous && !r.per, `“${text}”: ${fl} has no label data → asks (${describeRes(r)})`);
      ok(r.ambiguous && r.candidates.some((c) => c.nodata && c.flavor && c.flavor.toLowerCase() === fl.toLowerCase()), `“${text}” offers ${fl} for search / label entry`);
      ok(r.ambiguous && r.candidates.filter((c) => !c.nodata && c.id.startsWith('p:')).every((c) => c.flavorMiss), `“${text}”: listed flavors are offered only as labelled estimates`);
    }
  });
}));

section('Generated: package sizes');
WT.BRAND_CATALOG.forEach((b) => b.lines.forEach((l) => {
  if (!l.pack || !l.p.length) return;
  const x = N.productById(l.p[0]);
  l.pack.sizes.forEach(([sz, g]) => {
    const text = `a ${sz} ${l.pack.unit} of ${b.name} ${l.a[0]}`;
    const r = one(text);
    ok(!r.ambiguous && r.unit === `${l.pack.unit} (${sz})` && Math.abs(r.per.p - (x.p * g) / x.g) / ((x.p * g) / x.g) < 0.005, `“${text}” = ${Math.round((g / x.g) * 10) / 10} servings (${describeRes(r)} · ${r.unit})`);
  });
  const def = l.pack.def || l.pack.sizes[0][0];
  const r = one(`a ${l.pack.unit} of ${b.name} ${l.a[0]}`);
  ok(r.unit === `${l.pack.unit} (${def})` && r.assumed && /assumed a/.test(r.note), `“a ${l.pack.unit} of ${b.name} ${l.a[0]}”: the usual ${def} ${l.pack.unit}, marked assumed`);
}));

section('The examples');
{
  let r = one('One Pioneer Pastures snickerdoodle protein shake');
  ok(r.ambiguous && r.variant === 'Snickerdoodle' && r.candidates.some((c) => c.id === 'p:pioneer-a2-shake' && c.flavorMiss === 'Snickerdoodle') && r.candidates.some((c) => c.nodata && c.flavor === 'Snickerdoodle'), 'Pioneer Pastures Snickerdoodle: flavor not in the data → asks; Vanilla values only as a labelled estimate; search / label for Snickerdoodle');
  r = one('Pioneer Pastures strawberries and cream shake');
  ok(r.foodId === 'p:pioneer-a2-shake' && r.per.p === 30 && r.per.cal === null && /left blank/.test(r.note), 'Strawberries & Cream: 30 g protein (sourced); calories NOT copied from Vanilla');
  ok(one('pioneer pastures chocolate shake').per.cal === 160, 'Chocolate: 160 cal (sourced)');
  r = one('premier protein shake cookies and cream');
  ok(r.per.p === 30 && r.per.cal === 160 && r.per.c === null && r.per.f === null, 'Premier flavors share only the protein and calories the source lists; carbs/fat stay blank');

  ok(one('3 tbsp Oikos Triple Zero').foodId === 'p:oikos-triple-zero', 'Oikos Triple Zero');
  ok(one('Oikos Pro').foodId === 'p:oikos-pro-yogurt', 'Oikos Pro (yogurt)');
  r = one('Oikos Pro Drink');
  ok(r.ambiguous && r.candidates.every((c) => c.id !== 'p:oikos-pro-yogurt') && r.candidates.some((c) => c.nodata && /Pro Drink/.test(c.name)), 'Oikos Pro Drink is not Oikos Pro yogurt');
  r = one('Oikos Triple Zero mixed berry');
  ok(r.ambiguous && r.variant === 'Mixed Berry', 'Triple Zero Mixed Berry: only Vanilla has data → asks');
  r = one('a 32 oz tub of Oikos Triple Zero');
  ok(r.unit === 'tub (32 oz)' && Math.round(T(r).p) === 91, '32 oz tub = 907 g ≈ 6 cups ≈ 91 g protein');
  r = one('Fage triple zero');
  ok(r.ambiguous && r.brand === 'Fage' && !r.candidates.some((c) => /oikos/.test(c.id)), '“Fage triple zero” is not Oikos');

  ok(one('a serving of Barilla Protein+').foodId === 'p:barilla-protein-plus' && one('barilla protein plus rotini').foodId === 'p:barilla-protein-plus', 'Barilla Protein+ (also “protein plus rotini”, one item)');
  ok(N.parse('barilla protein plus rotini').length === 1, '“protein plus” is a name, not a list');
  for (const [t, line] of [['Barilla chickpea pasta', 'Chickpea Pasta'], ['Barilla red lentil penne', 'Red Lentil Pasta'], ['Barilla spaghetti', 'Classic Blue Box'], ['Barilla whole grain penne', 'Whole Grain']]) {
    r = one(t);
    ok(r.ambiguous && !r.candidates.some((c) => c.id === 'p:barilla-protein-plus') && r.candidates.some((c) => c.nodata && c.line === line), `“${t}” → ${line} (no label yet), never Protein+`);
  }

  ok(one('2 slices of Dave’s Killer Bread 21 whole grains').foodId === 'p:daves-21-whole-grains', 'Dave’s 21 Whole Grains');
  for (const [t, line, variant] of [['Dave’s Killer Bread white bread', 'White Bread Done Right', ''], ['dave’s killer bread good seed', 'Good Seed', ''], ['Dave’s Killer Bread powerseed', 'Powerseed', ''], ['2 slices of Dave’s Killer Bread thin sliced 21 whole grains', '21 Whole Grains and Seeds', 'Thin-Sliced'], ['dkb epic everything bagel', 'Epic Everything Bagels', '']]) {
    r = one(t);
    ok(r.ambiguous && !r.candidates.some((c) => c.id === 'p:daves-21-whole-grains') && r.candidates.some((c) => c.nodata && c.line === line && c.variant === variant), `“${t}” → ${line}${variant ? ' ' + variant : ''}, never 21 Whole Grains (${describeRes(r)})`);
  }
  r = one('Dave’s Killer Bread');
  ok(r.ambiguous && r.candidates.length >= 8, 'Dave’s Killer Bread alone lists its breads');

  for (const [t, id] of [['Oscar Mayer oven roasted turkey', 'oscar-mayer-turkey'], ['Oscar Mayer honey ham', 'oscar-mayer-ham'], ['3 Oscar Mayer beef franks', 'oscar-mayer-beef-franks'], ['Oscar Mayer wieners', 'oscar-mayer-wieners'], ['2 slices Oscar Mayer bologna', 'oscar-mayer-bologna']])
    ok(one(t).foodId === 'p:' + id, `“${t}” → ${id}`);
  for (const [t, lines] of [['Oscar Mayer turkey', ['Deli Fresh Smoked Turkey Breast', 'Deli Fresh Honey Smoked Turkey Breast']], ['Oscar Mayer ham', ['Deli Fresh Black Forest Ham', 'Deli Fresh Smoked Ham']], ['Oscar Mayer hot dogs', []]]) {
    r = one(t);
    ok(r.ambiguous && lines.every((ln) => r.candidates.some((c) => c.line === ln)), `“${t}” → asks among ${lines.join(', ') || 'beef franks / wieners'} (${describeRes(r)})`);
  }
  for (const [t, line] of [['Oscar Mayer turkey bacon', 'Turkey Bacon'], ['Oscar Mayer smoked turkey', 'Deli Fresh Smoked Turkey Breast'], ['Oscar Mayer black forest ham', 'Deli Fresh Black Forest Ham'], ['Oscar Mayer salami', 'Hard Salami'], ['Oscar Mayer turkey franks', 'Turkey Franks']]) {
    r = one(t);
    ok(r.ambiguous && !r.candidates.some((c) => c.id.startsWith('p:')) && r.candidates.some((c) => c.line === line), `“${t}” → ${line} (no label yet), never another deli meat (${describeRes(r)})`);
  }

  ok(one('Rao’s marinara').foodId === 'p:raos-marinara' && one('Rao’s arrabbiata').foodId === 'p:raos-arrabbiata', 'Rao’s Marinara and Arrabbiata');
  for (const [t, line] of [['Rao’s vodka sauce', 'Vodka Sauce'], ['Rao’s tomato basil', 'Tomato Basil'], ['Rao’s roasted garlic', 'Roasted Garlic'], ['Rao’s alfredo', 'Alfredo']]) {
    r = one(t);
    ok(r.ambiguous && !r.candidates.some((c) => c.id.startsWith('p:')) && r.candidates.some((c) => c.line === line), `“${t}” → ${line}, never Marinara`);
  }
  r = one('Rao’s sensitive marinara');
  ok(r.ambiguous && !r.candidates.some((c) => c.id === 'p:raos-marinara') && r.candidates.some((c) => c.variant === 'Sensitive Formula'), 'Rao’s Sensitive Formula is a different product from Marinara');
  r = one('Rao’s sauce');
  ok(r.ambiguous && r.candidates.some((c) => c.id === 'p:raos-marinara') && !r.candidates.some((c) => /pasta-dry/.test(c.id)), '“Rao’s sauce” asks among the sauces (not their pasta)');

  r = one('Quest bar');
  ok(r.ambiguous && /which flavor/.test(r.askWhy) && r.candidates.some((c) => c.id === 'p:quest-bar-cccd') && r.candidates.some((c) => c.nodata), '“Quest bar”: flavors have different labels → asks which flavor');
  r = one('Oikos Triple Zero');
  ok(r.foodId === 'p:oikos-triple-zero' && r.flavorAssumed === 'Vanilla' && /Flavor not given/.test(r.note) && N.confidence(r).level !== 'high', '“Oikos Triple Zero” (flavors share protein): Vanilla values, said so, never “exact”');
  for (const t of ['Chobani greek yogurt', 'Fage total 0%', 'a Ball Park hot dog', 'Kraft cheese', 'Jif peanut butter', 'fairlife milk', 'Kirkland protein bar', 'Starbucks egg bites'])
    ok(one(t).ambiguous && !one(t).per, `“${t}”: brand known, product not → asks`);
  r = one('Kirkland protein bar');
  ok(r.candidates.length === 1 && r.candidates[0].nodata && r.fallback, 'a brand with no catalog entry: search / label / labelled generic estimate');
}

section('Generic words never become a brand');
for (const t of ['greek yogurt', 'turkey', 'pasta sauce', 'whole wheat bread', 'beef hot dog', 'protein shake', 'peanut butter', 'cottage cheese'])
  ok(!one(t).ambiguous && !String(one(t).foodId).startsWith('p:'), `“${t}” stays generic (${describeRes(one(t))})`);

section('Custom branded products');
{
  WT.db.nutrition = N.fresh();
  // a product the catalog knows but has no label for, saved from its label
  const saved = N.saveFood({ name: "Dave's Killer Bread White Bread Done Right", brand: "Dave's Killer Bread", line: 'White Bread Done Right', unit: 'slice', serving: '1 slice (38 g)', g: 38, per: { p: 3, cal: 100, c: 19, f: 1 }, status: 'user', catLine: 'daves-killer-bread:white-bread-done-right', units: { loaf: 18 } }, false);
  let r = one('2 slices of Dave’s Killer Bread white bread');
  ok(r.foodId === 'my:' + saved.id && r.qty === 2 && T(r).cal === 200 && r.conf === 'user', 'your saved product is found by its line name');
  ok(N.lineOf(saved, true).line === 'White Bread Done Right', 'and stays linked to its catalog line');
  r = one('half a loaf of Dave’s Killer Bread white bread');
  ok(r.unit === 'loaf' && Math.round(T(r).cal) === 900, 'your package size: half a loaf = 9 slices');
  r = one('Dave’s Killer Bread good seed');
  ok(r.ambiguous && !r.candidates.some((c) => c.id === 'my:' + saved.id), 'another line is never replaced by your saved bread');
  ok(one('Dave’s Killer Bread 21 whole grains').foodId === 'p:daves-21-whole-grains', 'bundled lines still resolve');
  r = one('Dave’s Killer Bread');
  ok(r.ambiguous && r.candidates[0].id === 'my:' + saved.id && r.candidates[0].mine, 'brand alone: your product listed first, still asks (two breads known)');
  // a brand Forge has never heard of
  const local = N.saveFood({ name: 'Hilltop Farm Skyr · Vanilla', brand: 'Hilltop Farm', line: 'Skyr', flavor: 'Vanilla', unit: 'cup', g: 150, per: { p: 16, cal: 110, c: 9, f: 0 }, status: 'user' }, false);
  ok(one('hilltop farm skyr vanilla').foodId === 'my:' + local.id, 'your own brand is recognized by name');
  const local2 = N.saveFood({ name: 'Hilltop Farm Skyr · Strawberry', brand: 'Hilltop Farm', line: 'Skyr', flavor: 'Strawberry', unit: 'cup', g: 150, per: { p: 15, cal: 120, c: 13, f: 0 }, status: 'user' }, false);
  r = one('hilltop farm skyr');
  ok(r.ambiguous && [local.id, local2.id].every((id) => r.candidates.some((c) => c.id === 'my:' + id)), 'two of your flavors → asks which');
  ok(one('hilltop farm strawberry skyr').foodId === 'my:' + local2.id, 'flavor picks between your own products');
  // corrections are remembered
  N.learn('my usual bread', 'my:' + saved.id);
  ok(one('2 slices my usual bread').foodId === 'my:' + saved.id, 'shorthand you taught it');
  // only one saved product of a brand → naming the brand finds it
  WT.db.nutrition = N.fresh();
  const jif = N.remember(Object.assign(one('2 tbsp jif creamy'), {}));
  ok(one('1 tbsp jif').foodId === 'my:' + jif.id, 'your only Jif → “jif” finds it');
  ok(one('jif crunchy').ambiguous, '…but “jif crunchy” still asks (a different product)');
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
