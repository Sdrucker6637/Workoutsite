/* Online lookup (USDA FoodData Central + Open Food Facts) with a mocked network: normalizing, caching,
 * failures, barcodes, and how found foods flow into logging.   node tests/lookup.test.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = String(v)), removeItem: (k) => delete mem[k] };
for (const f of ['exercises.js', 'core.js', 'engine.js', 'foods.js', 'fooddb.js', 'products.js', 'restaurants.js', 'nutrition.js', 'lookup.js', 'analytics.js'])
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
const WT = globalThis.WT, N = WT.nut, L = WT.lookup;
let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log('  FAIL:', msg); } };
const section = (s) => console.log(s);
WT.load();
WT.save = () => {};

/* ── Fixtures in the shape the services return ── */
const FDC_HITS = {
  foods: [
    { fdcId: 2346384, description: 'OIKOS PRO DRINK VANILLA', dataType: 'Branded', brandOwner: 'Danone US, LLC', brandName: 'OIKOS', gtinUpc: '036632075109', servingSize: 207, servingSizeUnit: 'ml', householdServingFullText: '1 bottle',
      foodNutrients: [{ nutrientId: 1008, nutrientNumber: '208', unitName: 'KCAL', value: 67.6 }, { nutrientId: 1003, nutrientNumber: '203', unitName: 'G', value: 11.1 }, { nutrientId: 1005, nutrientNumber: '205', unitName: 'G', value: 2.4 }, { nutrientId: 1004, nutrientNumber: '204', unitName: 'G', value: 0.97 }] },
    { fdcId: 171477, description: 'Chicken, broilers or fryers, thigh, meat and skin, cooked, roasted', dataType: 'SR Legacy',
      foodNutrients: [{ nutrientId: 1008, unitName: 'KCAL', value: 229 }, { nutrientId: 1003, unitName: 'G', value: 23.3 }, { nutrientId: 1005, unitName: 'G', value: 0 }, { nutrientId: 1004, unitName: 'G', value: 14.7 }],
      foodMeasures: [{ disseminationText: 'Quantity not specified', gramWeight: 62 }, { disseminationText: '1 thigh, bone removed', gramWeight: 62 }] },
    { fdcId: 999, description: 'NO NUTRIENTS', dataType: 'Branded', foodNutrients: [] },
  ],
};
const OFF_HITS = {
  hits: [
    { code: '0036632037008', product_name: 'Triple Zero Blended Vanilla', brands: 'Oikos,Danone', serving_size: '1 container (150 g)', serving_quantity: 150, nutriments: { 'energy-kcal_100g': 60, proteins_100g: 10, carbohydrates_100g: 4.7, fat_100g: 0, 'energy-kcal_serving': 90, proteins_serving: 15 } },
    { code: '123', product_name: 'Mystery', brands: 'X', nutriments: {} },
  ],
};
const OFF_PRODUCT = { status: 1, product: { code: '0076808280531', product_name: 'Protein+ Penne', brands: 'Barilla', serving_size: '56 g', serving_quantity: 56, nutriments: { 'energy-kcal_100g': 357, proteins_100g: 17.9, carbohydrates_100g: 66, fat_100g: 2.7 } } };

let calls = [], mode = {};
globalThis.fetch = async (url) => {
  calls.push(url);
  const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  if (mode.offline) throw new TypeError('Failed to fetch');
  if (url.startsWith('https://api.nal.usda.gov/')) {
    if (mode.fdc === 429) return resp(429, {});
    if (mode.fdc === 'down') throw new TypeError('Failed to fetch');
    if (/query=0?0?76808280531|query=0?036632075109/.test(url)) return resp(200, { foods: FDC_HITS.foods.slice(0, 1) });
    return resp(200, FDC_HITS);
  }
  if (url.startsWith('https://search.openfoodfacts.org/')) {
    if (mode.sal === 'down') return resp(502, {});
    return resp(200, OFF_HITS);
  }
  if (url.startsWith('https://world.openfoodfacts.org/cgi/search.pl')) return resp(200, { products: OFF_HITS.hits });
  if (url.startsWith('https://world.openfoodfacts.org/api/v2/product/')) {
    if (mode.off === 503) return resp(503, {});
    return url.includes('0076808280531') ? resp(200, OFF_PRODUCT) : resp(200, { status: 0, status_verbose: 'product not found' });
  }
  return resp(404, {});
};
globalThis.navigator = { onLine: true };

(async () => {
  section('Barcodes');
  ok(L.validCode('036632075109') && L.validCode('0036632075109') && L.validCode('96385074') && !L.validCode('036632075108') && !L.validCode('12345'), 'GS1 check digits (UPC-A, EAN-13, EAN-8)');
  ok(L.sameCode('036632075109', '0036632075109') && !L.sameCode('1', '2'), 'UPC-A and its EAN-13 form are the same product');

  section('Normalizing USDA FoodData Central');
  const b = L.fromFDC(FDC_HITS.foods[0]);
  ok(b.id === 'fdc:2346384' && b.status === 'reference' && /Branded \(manufacturer label data\)/.test(b.source.name) && /food-details\/2346384/.test(b.source.url), 'branded hit: reference data, sourced');
  ok(b.name === 'Oikos Pro Drink Vanilla' && b.brand === 'Oikos' && b.code === '036632075109', 'names cleaned, brand and UPC kept');
  ok(b.per100.cal === 67.6 && b.per100.p === 11.1 && b.serving.g === 207 && b.serving.ml, 'per 100 g values and the label serving');
  const sv = L.servingOf(b);
  ok(sv.unit === 'serving' && Math.round(sv.per.p) === 23 && Math.round(sv.per.cal) === 140, 'serving = 207 ml → 23 g protein, 140 cal');
  const sr = L.fromFDC(FDC_HITS.foods[1]);
  ok(sr.status === 'reference' && /SR Legacy/.test(sr.source.name) && sr.serving.g === 62 && /1 thigh/.test(sr.serving.text), 'SR Legacy: household measure used (not "quantity not specified")');
  ok(L.fromFDC(FDC_HITS.foods[2]) === null, 'a hit with no nutrition is dropped, not filled in');

  section('Normalizing Open Food Facts');
  const o = L.fromOFFProduct(OFF_HITS.hits[0]);
  ok(o.status === 'estimated' && /community data/.test(o.source.name) && o.brand === 'Oikos' && o.code === '0036632037008', 'community data is an estimate, brand = first listed');
  ok(L.servingOf(o).per.p === 15 && L.servingOf(o).per.cal === 90, 'serving values from per-100 g × serving grams');
  ok(L.fromOFFProduct(OFF_HITS.hits[1]) === null, 'no nutrition → dropped');
  const kj = L.fromOFFProduct({ code: '1', product_name: 'kJ only', nutriments: { 'energy-kj_100g': 418.4, proteins_100g: 5 } });
  ok(kj.per100.cal === 100, 'kJ converted to kcal (4.184), nothing guessed');
  const noServ = L.fromOFFProduct({ code: '2', product_name: 'Per 100 g only', nutriments: { 'energy-kcal_100g': 200, proteins_100g: 10 } });
  ok(L.servingOf(noServ).unit === '100 g', 'no serving on the label → values per 100 g, said so');

  section('Search: both services, merged, cached');
  calls = [];
  let r = await L.search('oikos');
  ok(r.errors.length === 0 && r.results.length === 3 && !r.cached, 'USDA + Open Food Facts results merged (no-nutrition hits dropped)');
  ok(calls.some((u) => /api_key=DEMO_KEY/.test(u)) && calls.some((u) => u.startsWith('https://search.openfoodfacts.org/search?q=oikos')), 'DEMO_KEY used without a personal key; Search-a-licious queried');
  calls = [];
  r = await L.search('  OIKOS ');
  ok(r.cached && calls.length === 0 && r.results.length === 3, 'same search again: from the cache, no network');
  mode.sal = 'down';
  r = await L.search('triple zero');
  ok(r.results.some((x) => x.src === 'off') && calls.some((u) => /cgi\/search\.pl/.test(u)), 'Search-a-licious down → classic search endpoint');
  mode.sal = null;
  WT.db.profile.fdcKey = 'my-secret-key';
  calls = [];
  await L.search('chicken thigh roasted');
  ok(calls.some((u) => /api_key=my-secret-key/.test(u)), 'your own key is used when set');
  const backup = JSON.parse(WT.exportData());
  ok(backup.data.profile.fdcKey === '' && WT.db.profile.fdcKey === 'my-secret-key', 'the key is never written into a backup');
  WT.db.profile.fdcKey = '';

  section('Failures never break logging');
  mode.fdc = 429;
  r = await L.search('greek yogurt bowl');
  ok(r.results.some((x) => x.src === 'off') && r.errors.length === 1 && /hourly limit/.test(r.errors[0].text) && /own free key/.test(r.errors[0].text), 'USDA rate limit: Open Food Facts results still shown, with a clear message');
  mode.fdc = 'down';
  mode.offline = true;
  r = await L.search('oikos');
  ok(r.results.length === 3 && r.cached, 'offline: a cached search still answers');
  r = await L.search('never searched before');
  ok(r.results.length === 0 && r.errors.length >= 1 && !r.errors.some((e) => /undefined/.test(e.text)), 'offline + uncached: empty with an explanation, no exception');
  globalThis.navigator.onLine = false;
  r = await L.search('something new');
  ok(/offline/.test(r.errors[0].text), 'navigator.onLine=false → “You’re offline”');
  globalThis.navigator.onLine = true;
  mode = {};
  WT.db.profile.onlineLookup = false;
  calls = [];
  r = await L.search('brand new query');
  ok(calls.length === 0 && /off/.test(r.errors[0].text), 'lookup turned off → no network at all');
  WT.db.profile.onlineLookup = true;
  const parsed = N.parse('2 eggs and a banana');
  ok(parsed.length === 2 && parsed.every((i) => i.per), 'logging works the same with no network');

  section('Found foods behave like products');
  const offRec = L.cached('off:0036632037008');
  let it = N.resolveAs({ text: 'oikos', qty: 1 }, 'x:off:0036632037008');
  ok(it.foodId === 'x:off:0036632037008' && it.conf === 'estimated' && N.rp(N.itemTotals(it).p) === 15 && it.src === 'online', 'resolves to an item with its source status');
  ok(N.unitsFor(it).includes('g') && N.unitsFor(it).includes('100 g'), 'units: serving, 100 g, grams, ounces');
  const g = N.reunit(it, 'g');
  ok(g.qty === 150 && N.rp(N.itemTotals(g).p) === 15, 'serving → 150 g, same protein');
  WT.db.nutrition = N.fresh();
  const added = N.addItems([it], N.dayKey(), 'snack');
  const lib = N.remember(Object.assign({}, it));
  ok(lib && lib.code === '0036632037008' && lib.status === 'estimated' && /Open Food Facts/.test(lib.source.name), 'logging a found product saves it to My foods with barcode and source');
  ok(N.parse('Oikos Triple Zero Blended Vanilla')[0].foodId === 'my:' + lib.id, 'typed by name later → your saved copy');
  const usda = N.resolveAs({ text: 'thigh', qty: 2 }, 'x:fdc:171477');
  ok(usda.conf === 'reference' && usda.unit === 'serving' && Math.round(N.itemTotals(usda).cal) === 284, 'USDA SR Legacy: 2 × 62 g thigh = 284 cal');
  ok(!N.remember(Object.assign({}, usda)), 'generic USDA foods are not copied into My foods');
  ok(N.searchAll('blended vanilla').some((x) => x.id === 'my:' + lib.id || x.id === 'x:off:0036632037008'), 'found foods searchable offline afterwards');
  ok(N.searchAll('broilers thigh').some((x) => x.kind === 'Found online before' && x.id === 'x:fdc:171477'), 'cached USDA foods listed as “Found online before”');

  section('Barcode lookup chain');
  let bc = await L.barcode('0036632037008');
  ok(bc.libId === lib.id && bc.from === 'library', 'a barcode you saved → your food first, no network');
  calls = [];
  bc = await L.barcode('0076808280531');
  ok(bc.rec && bc.from === 'off' && bc.rec.brand === 'Barilla' && calls.length === 1, 'Open Food Facts by barcode');
  calls = [];
  bc = await L.barcode('076808280531');
  ok(bc.rec && bc.from === 'cache' && calls.length === 0, 'the 12-digit form of the same code → cache');
  L.clearCache(); // so this exercises the network path, not the earlier search
  calls = [];
  bc = await L.barcode('036632075109');
  ok(bc.rec && bc.from === 'fdc' && bc.rec.id === 'fdc:2346384', 'not on Open Food Facts → USDA Branded by UPC');
  bc = await L.barcode('012345678905');
  ok(!bc.rec && bc.notFound && !bc.errors.length, 'unknown everywhere → not found (nothing substituted)');
  calls = [];
  bc = await L.barcode('012345678905');
  ok(bc.notFound && calls.length === 0, 'a recent miss is remembered for a day');
  mode.off = 503;
  mode.fdc = 'down';
  bc = await L.barcode('040000000006');
  ok(!bc.rec && bc.errors.length === 2 && !bc.notFound, 'services failing → errors, not “not found”');
  mode = {};

  section('Cache stays bounded and separate');
  ok(L.cacheStats().items > 0 && !JSON.parse(WT.exportData()).data.foodcache, 'cache not part of your backup');
  for (let k = 0; k < 700; k++) L.fromFDC && (await (async () => {})());
  L.clearCache();
  ok(L.cacheStats().items === 0, 'cache can be cleared');

  section('Offline USDA database (tools/build-usda.js)');
  {
    const { convert } = require(path.join(__dirname, '..', 'tools', 'build-usda.js'));
    const db = convert([path.join(__dirname, 'fixtures', 'fdc-sr-legacy-sample.json'), path.join(__dirname, 'fixtures', 'fdc-foundation-sample.json')]);
    ok(db.foods.length === 3 && !db.foods.some((f) => /Water/.test(f[1])), 'foods without energy or protein are skipped, not filled in');
    const thigh = db.foods.find((f) => f[0] === 171477);
    ok(thigh[2] === 229 && thigh[3] === 23.3 && thigh[5] === 14.7 && thigh[7][0][0] === '1 thigh, bone removed' && thigh[7][0][1] === 62, 'kcal (not kJ), macros and household portions read from SR Legacy');
    const kale = db.foods.find((f) => f[0] === 2346393);
    ok(kale[2] === 42 && kale[7][0][0] === '1 cup, chopped', 'Foundation Foods: Atwater energy and full portion description');
    const placeholder = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'js', 'data', 'usda.json'), 'utf8'));
    ok(Array.isArray(placeholder.foods), 'the shipped data file is valid (empty until built)');
    L.setOfflineDB(db);
    const hits = N.searchAll('chicken thigh roasted');
    const off = hits.find((x) => x.kind === 'USDA reference (offline)');
    ok(off && off.id === 'x:usda:171477' && hits.indexOf(off) > 0, 'offline USDA foods searchable, after the curated foods');
    const it = N.resolveAs({ text: 'thigh', qty: 2 }, 'x:usda:171477');
    ok(it.conf === 'reference' && Math.round(N.itemTotals(it).cal) === 284 && /offline copy/.test(it.note), '2 thighs from the offline copy = 284 cal, reference data');
    ok(N.unitsFor(it).includes('g') && N.reunit(it, 'g').qty === 124, 'grams available (2 × 62 g = 124 g)');
    ok(N.searchAll('kale').some((x) => x.id === 'x:usda:2346393'), 'a food the curated list lacks (kale) comes from the offline copy');
  }

  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})();
