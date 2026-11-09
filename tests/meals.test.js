/* Meal planner (ingredient database, estimates, kitchen, recipe generation, nutrition, logging) and
 * achievements logic. Run: node tests/meals.test.js — runs fully offline (fetch is disabled below). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = String(v)), removeItem: (k) => delete mem[k] };
// Offline: any network use would throw
globalThis.fetch = () => { throw new Error('network used'); };
globalThis.XMLHttpRequest = function () { throw new Error('network used'); };
for (const f of ['exercises.js', 'core.js', 'foods.js', 'products.js', 'nutrition.js', 'feedback.js', 'engine.js', 'ingredients.js', 'meals.js', 'achievements.js'])
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
const WT = globalThis.WT, M = WT.meals, A = WT.ach, N = WT.nut, ING = WT.ING;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', m); } };
const section = (t) => console.log('\n' + t);
const near = (a, b, tol) => Math.abs(a - b) <= tol;
WT.load();
const st = () => WT.db.meals;
const pick = (ids) => { st().selected = []; ids.forEach((id) => M.toggleSelect(id)); };
const show = (r) => r.ideas.forEach((x) => console.log(`   · ${x.name} — ${x.prep + x.cook} min, ≈${x.macros.p} g protein, ≈${x.macros.cal} cal`));
const fresh = () => { WT.db.meals = M.fresh(); };

section('1. A custom ingredient with no nutrition gets reasonable estimated macros automatically');
{
  fresh();
  const kb = M.saveIngredient({ name: 'turkey kielbasa' });
  ok(kb.custom && kb.status === 'estimated' && kb.base === 'turkey-kielbasa', 'turkey kielbasa → typical turkey kielbasa profile, marked Estimate');
  ok(kb.serving.n === 2 && kb.serving.unit === 'oz' && near(kb.macros.p, 8, 1.5) && near(kb.macros.cal, 85, 15) && kb.macros.f > 2, `≈ 8 g protein, ≈ 85 cal per 2 oz (${kb.macros.p} g, ${kb.macros.cal} cal)`);
  ok(kb.kind === 'sausage' && kb.precooked, 'it cooks like a precooked sausage in recipes');
  const bb = M.saveIngredient({ name: 'Butterball turkey kielbasa' });
  ok(bb.base === 'turkey-kielbasa' && bb.status === 'estimated' && /Butterball-specific values aren’t on file/.test(bb.note), 'a brand with no product data uses the generic estimate and says so');
  ok(M.preview('Oscar Mayer beef franks').status === 'verified' && M.preview('Oscar Mayer beef franks').macros.p === 5, 'a brand product already on file uses its verified label values');
  const odd = M.saveIngredient({ name: 'mystery stew meat', cat: 'protein' });
  ok(odd.macros.p > 10 && odd.macros.cal > 50, 'an unrecognised protein still gets a non-zero estimate');
  const odd2 = M.saveIngredient({ name: 'dragonfruit', cat: 'fruit' });
  ok(odd2.macros.cal > 0 && odd2.macros.c > 0 && odd2.status === 'estimated' && /Rough/.test(odd2.source), 'an unknown fruit gets a rough, clearly labelled category estimate');
  let zero = 0;
  ['quail eggs', 'bison burger', 'arctic char', 'farro', 'swiss chard', 'gochujang', 'plantains', 'ricotta', 'pumpkin seeds', 'whatever'].forEach((n) => {
    const e = M.preview(n, 'other');
    if (!(e.macros.cal > 0)) zero++;
  });
  ok(zero === 0, 'no ingredient is ever given zero calories');
  ok(st().kitchen.includes(kb.id) && M.sorted('protein').some((x) => x.id === kb.id), 'custom ingredient appears once, in its category');
}

section('2. Manually entered nutrition facts are used');
{
  fresh();
  const x = M.saveIngredient({ name: 'Brand X chicken sausage', cat: 'protein', macros: { cal: 110, p: 14, c: 2, f: 5 } });
  ok(x.status === 'user' && x.macros.p === 14 && x.macros.cal === 110 && x.macros.c === 2 && x.macros.f === 5, 'label values replace the estimate');
  ok(x.fields.join() === 'cal,p,c,f' && /Your values/.test(x.source), 'source says they are yours');
  const y = M.saveIngredient({ name: 'Homemade turkey patty', cat: 'protein', p: 24 });
  ok(y.macros.p === 24 && y.macros.cal > 0 && y.status === 'user' && /others estimated/.test(y.source), 'partial values: entered ones kept, the rest estimated (and said so)');
  pick([x.id, 'potato', 'bell-pepper']);
  const r = M.generate({ seed: 3 });
  const rec = r.ideas.find((i) => i.uses.includes(x.id));
  const line = rec.lines.find((l) => l.id === x.id);
  ok(near(line.macros.p, 14 * line.q, 0.01), 'recipes use the entered values');
}

section('3. Generic estimates for common ingredients');
{
  const cases = [
    ['chicken breast', 'raw', 1, 'breast', [33, 43], [180, 230]],
    ['turkey kielbasa', 'sold', 2, 'oz', [7, 9], [75, 100]],
    ['shrimp', 'raw', 4, 'oz', [20, 25], [85, 115]],
    ['rice', 'cooked', 1, 'cup cooked', [3.5, 5], [190, 215]],
    ['potatoes', 'raw', 1, 'medium potato', [3.5, 5], [150, 175]],
    ['sweet potatoes', 'raw', 1, 'medium sweet potato', [1.5, 2.5], [100, 120]],
    ['ground beef', 'raw', 4, 'oz', [21, 24], [185, 210]],
  ];
  cases.forEach(([n, state, sn, unit, p, cal]) => {
    const e = M.preview(n);
    ok(e.serving.state === state && e.serving.n === sn && e.serving.unit === unit && e.macros.p >= p[0] && e.macros.p <= p[1] && e.macros.cal >= cal[0] && e.macros.cal <= cal[1], `${n}: ${e.macros.p} g protein, ${e.macros.cal} cal per ${sn} ${unit} ${state}`);
  });
  ok(/90% lean/.test(M.preview('ground beef').note), 'ground beef states its fat assumption (90% lean)');
  ok(M.preview('80/20 ground beef').macros.cal > M.preview('ground beef').macros.cal * 1.3, '80/20 ground beef is recognised separately');
}

section('4. Raw vs cooked measurements');
{
  const raw = M.preview('chicken breast'), cooked = M.preview('rotisserie chicken');
  ok(raw.serving.state === 'raw' && cooked.serving.state === 'cooked', 'raw chicken breast vs cooked chicken');
  ok(ING.get('cooked-chicken').per100.p > ING.get('chicken-breast').per100.p, 'cooked meat is denser per gram than raw');
  const ckd = M.preview('rice'), dry = M.preview('dry rice');
  ok(ckd.serving.state === 'cooked' && dry.serving.state === 'dry' && ING.get('rice-dry').per100.cal > ING.get('rice').per100.cal * 2.5, 'cooked rice vs dry rice');
  ok(M.preview('pasta').serving.state === 'dry' && M.preview('pasta').serving.unit === 'oz dry', 'pasta is measured dry');
  fresh();
  pick(['chicken-breast', 'rice', 'broccoli']);
  const r = M.generate({ seed: 2 }).ideas[0];
  const cl = r.lines.find((l) => l.id === 'chicken-breast');
  ok(/raw\)/.test(M.lineAmount(cl, r.servings)), 'recipe amounts say raw where it matters: ' + M.lineAmount(cl, r.servings));
  ok(/cooked/.test(M.lineAmount(r.lines.find((l) => l.id === 'rice'), r.servings)), 'and cooked for rice');
}

section('5. Editing and reusing a custom ingredient');
{
  fresh();
  let kb = M.saveIngredient({ name: 'turkey kielbasa' });
  const p2oz = kb.macros.p;
  kb = M.saveIngredient({ id: kb.id, name: 'turkey kielbasa', serving: { n: 4, unit: 'oz', g: 112 } });
  ok(kb.serving.n === 4 && near(kb.macros.p, p2oz * 2, 0.2) && kb.status === 'estimated', 'changing only the serving size scales the nutrition (2 oz → 4 oz)');
  kb = M.saveIngredient({ id: kb.id, name: 'Turkey kielbasa (Hillshire)' });
  ok(kb.name === 'Turkey kielbasa (Hillshire)' && kb.base === 'turkey-kielbasa', 'renamed');
  const diary = WT.db.nutrition.foods.find((f) => f.ingredientId === kb.id);
  ok(diary && diary.name === kb.name && near(diary.per.p, kb.macros.p, 0.01), 'the ingredient is available in the food diary (My foods) and stays in sync');
  const parsed = N.parse('Turkey kielbasa (Hillshire)')[0];
  ok(parsed && !parsed.unknown && near(parsed.per.p * parsed.qty, kb.macros.p, 0.5), 'typing it in the food diary uses the same values');
  pick([kb.id, 'rice', 'bell-pepper']);
  ok(M.generate({ seed: 1 }).ideas.length >= 2, 'reused in meal ideas');
  M.deleteIngredient(kb.id);
  ok(!M.get(kb.id) && !WT.db.nutrition.foods.some((f) => f.ingredientId === kb.id), 'deleting removes it from the kitchen and My foods');
  // A food from My foods can come into the kitchen with its values
  const f = N.saveFood({ name: 'Protein bagel', qty: 1, unit: 'bagel', per: { p: 15, cal: 230, c: 40, f: 2 }, status: 'user' }, false);
  const imp = M.importDiaryFood(f.id, 'carb');
  ok(imp && imp.macros.p === 15 && imp.cat === 'carb' && imp.status === 'user', 'a My foods item can be added to the kitchen with its values');
}

section('6. User corrections are remembered');
{
  fresh();
  M.saveIngredient({ id: 'chicken-breast', name: 'Chicken breast', serving: { n: 1, unit: 'breast', g: 227 } });
  ok(near(M.get('chicken-breast').macros.p, 51, 1.5), 'bigger breasts (8 oz): values scale with the grams');
  M.saveIngredient({ id: 'shrimp', name: 'Shrimp', macros: { p: 20, cal: 90 } });
  ok(M.get('shrimp').status === 'user' && M.get('shrimp').macros.p === 20, 'label values for a built-in are stored as your correction');
  WT.flush();
  WT.load();
  ok(M.get('shrimp').macros.p === 20 && near(M.get('chicken-breast').serving.g, 227, 0.1), 'corrections survive a reload');
  pick(['shrimp', 'rice', 'spinach']);
  const r = M.generate({ seed: 4 }).ideas[0];
  ok(near(r.lines.find((l) => l.id === 'shrimp').macros.p, 20 * r.lines.find((l) => l.id === 'shrimp').q, 0.01), 'recipes use the corrected values');
  M.resetIngredient('shrimp');
  ok(M.get('shrimp').status === 'estimated' && near(M.get('shrimp').macros.p, 22.6, 0.2), 'reset returns to typical values');
}

section('7. Recipes with custom ingredients');
{
  fresh();
  const kb = M.saveIngredient({ name: 'turkey kielbasa' });
  pick([kb.id, 'sweet-potato', 'bok-choy']);
  const r = M.generate({ seed: 5 });
  show(r);
  ok(r.ideas.length === 4 && r.ideas.every((x) => x.uses.includes(kb.id)), 'four ideas built around turkey kielbasa');
  ok(r.ideas.some((x) => x.steps.some((s) => /precooked/.test(s))), 'cooked as a precooked sausage');
  ok(r.ideas.every((x) => !x.steps.join(' ').match(/\beggs?\b/i)), 'no egg appears in the instructions (eggs were not selected)');
  ok(new Set(r.ideas.map((x) => x.format)).size === 4 && new Set(r.ideas.map((x) => x.flavor)).size === 4, 'four different dish types and flavors');
  const odd = M.saveIngredient({ name: 'kohlrabi', cat: 'veg' });
  pick(['chicken-thigh', odd.id, 'rice']);
  ok(M.generate({ seed: 1 }).ideas.some((x) => x.uses.includes(odd.id)), 'an unknown custom vegetable is used too');
}

section('8. Instructions never use unlisted ingredients (sweep)');
{
  fresh();
  ['turkey-kielbasa', 'chicken-sausage', 'steak', 'pork-chop', 'cod', 'black-beans', 'chickpeas', 'cooked-chicken', 'bacon', 'ham', 'brown-rice', 'couscous', 'oats', 'egg-noodles', 'rice-noodles', 'pita', 'kale', 'cabbage', 'cauliflower', 'green-beans', 'carrot', 'cucumber', 'lettuce', 'green-onion', 'ginger', 'canned-tomatoes', 'mozzarella', 'milk', 'mango', 'pineapple', 'almonds', 'strawberries', 'apple'].forEach((id) => M.addToKitchen(id));
  const K = M.kitchen();
  const by = (c) => K.filter((x) => x.cat === c).map((x) => x.id);
  let seed = 7;
  const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const take = (a, n) => { const c = a.slice(), o = []; while (o.length < n && c.length) o.push(c.splice(Math.floor(R() * c.length), 1)[0]); return o; };
  M._fails.length = 0;
  const allNames = ING.DB.flatMap((x) => [x.name].concat(x.a || []).map((n) => ({ id: x.id, n: ING.norm(n) }))).sort((a, b) => b.n.length - a.n.length);
  let ideas = 0, leaks = [], unusedListed = 0, sumOff = 0, dups = 0, batches = 0;
  for (let i = 0; i < 220; i++) {
    pick([...take(by('protein'), 1 + (R() < 0.3)), ...take(by('carb'), R() < 0.8 ? 1 : 0), ...take(by('veg'), Math.floor(R() * 4)), ...take(by('fruit'), R() < 0.2 ? 1 : 0), ...take(by('dairy'), R() < 0.25 ? 1 : 0)]);
    const r = M.generate({ seed: i + 1 });
    batches++;
    const seen = new Set();
    r.ideas.forEach((x) => {
      ideas++;
      // independent check: mask every listed name, then look for any other database ingredient name
      let t = ' ' + ING.norm(x.steps.join(' ')) + ' ';
      const listed = x.lines.map((l) => l.name).concat(x.optional.map((o) => o.name));
      const ids = new Set(x.lines.map((l) => l.id));
      x.lines.forEach((l) => { const d = ING.get(l.id); if (d) (d.a || []).forEach((a) => listed.push(a)); });
      ['chicken', 'turkey', 'kielbasa', 'sausage', 'steak', 'pork', 'fish', 'potatoes', 'sweet potatoes', 'eggs', 'ground turkey', 'ground beef', 'ground chicken'].forEach((sh) => x.lines.some((l) => ING.norm(l.name).includes(sh.split(' ').pop().replace(/s$/, '')) || (ING.get(l.id) && ING.get(l.id).kind && ['poultry', 'sausage', 'beef', 'pork', 'fish-fatty', 'fish-lean', 'potato', 'egg', 'ground'].includes(ING.get(l.id).kind))) && listed.push(sh));
      listed.map(ING.norm).sort((a, b) => b.length - a.length).forEach((n) => { t = t.split(' ' + n + ' ').join(' # ').split(' ' + n + 's ').join(' # '); });
      allNames.forEach((e) => { if (!ids.has(e.id) && t.includes(' ' + e.n + ' ')) leaks.push(`${x.name}: “${e.n}”`); });
      if (/ (oil) /.test(' ' + ING.norm(x.steps.join(' ')) + ' ') && !x.lines.some((l) => /oil|spray/i.test(l.name))) leaks.push(`${x.name}: oil not listed`);
      // listed ingredients are all used
      x.lines.filter((l) => !l.pantry).forEach((l) => { if (!new RegExp(ING.norm(l.name).split(' ').pop().replace(/s$/, '')).test(ING.norm(x.steps.join(' ')))) unusedListed++; });
      const s = x.lines.reduce((a, l) => a + (+l.macros.p || 0), 0);
      if (Math.abs(Math.round(s) - x.macros.p) > 1) sumOff++;
      const k = x.uses.slice().sort().join('+') + '|' + x.family;
      if (seen.has(k)) dups++;
      seen.add(k);
    });
  }
  console.log(`  ${batches} selections → ${ideas} ideas; generator integrity rejections: ${M._fails.length}`);
  ok(M._fails.length === 0, 'the generator never had to reject a recipe for mentioning an unlisted ingredient');
  ok(leaks.length === 0, 'independent scan: no instruction mentions an unlisted ingredient' + (leaks.length ? ': ' + leaks.slice(0, 5).join(' | ') : ''));
  ok(unusedListed === 0, 'every listed ingredient is used in the steps');
  ok(sumOff === 0, 'per-serving protein equals the sum of the ingredient lines');
  ok(dups === 0, 'no two ideas in a batch use the same ingredients cooked the same way');
}

section('9. Nutrition is calculated from ingredient quantities');
{
  fresh();
  pick(['chicken-breast', 'rice', 'broccoli']);
  const r = M.generate({ seed: 9 }).ideas[0];
  let exp = { cal: 0, p: 0 };
  r.lines.forEach((l) => {
    const d = l.pantry ? ING.pantry(l.id) : ING.get(l.id);
    const grams = l.q * d.serving.g;
    exp.cal += (d.per100.cal * grams) / 100;
    exp.p += (d.per100.p * grams) / 100;
  });
  ok(near(r.macros.exact.p, exp.p, 0.6) && near(r.macros.exact.cal, exp.cal, 6), `per serving = Σ grams × per-100 g values (${Math.round(exp.p)} g protein, ${Math.round(exp.cal)} cal)`);
  ok(r.macros.p === Math.round(r.macros.exact.p) && r.macros.cal % 10 === 0, 'display rounds protein to whole grams and calories to 10 (no false precision)');
  ok(r.macros.estimated === 3 && r.macros.ingredients === 3, 'says how many values are estimates');
  const chicken = r.lines.find((l) => l.id === 'chicken-breast');
  ok(chicken.q === 1, 'one chicken breast per serving');
}

section('10. Serving-size adjustments');
{
  fresh();
  pick(['shrimp', 'rice', 'spinach']);
  const r = M.generate({ seed: 2 }).ideas[0];
  const r4 = M.rescale(r, 4);
  const amt = (rec, id) => M.lineAmount(rec.lines.find((l) => l.id === id), rec.servings);
  ok(amt(r, 'shrimp') !== amt(r4, 'shrimp') && /20 oz|1 ¼ lb/.test(amt(r4, 'shrimp')), `amounts scale (${amt(r, 'shrimp')} → ${amt(r4, 'shrimp')})`);
  ok(r4.macros.p === r.macros.p && r4.macros.cal === r.macros.cal, 'per-serving nutrition stays the same');
  const before = WT.db.nutrition.entries.length;
  const e = M.logServing(r4);
  ok(WT.db.nutrition.entries.length === before + 1 && near(e.per.p, r.macros.exact.p, 0.6) && near(e.per.cal, r.macros.exact.cal, 1) && e.name === r.name, 'logging transfers this recipe’s per-serving totals to the food diary');
  ok(e.conf === 'estimated' && /1 of 4 servings/.test(e.note) && e.recipe && e.recipe.ingredients.length === 3, 'the diary entry is labelled as an estimate and linked to the recipe');
  M.saveIngredient({ id: 'shrimp', name: 'Shrimp', macros: { cal: 90, p: 21, c: 0, f: 1 } });
  M.saveIngredient({ id: 'rice', name: 'Rice', macros: { cal: 200, p: 4, c: 44, f: 0.5 } });
  M.saveIngredient({ id: 'spinach', name: 'Spinach', macros: { cal: 14, p: 2, c: 2, f: 0 } });
  ok(M.logServing(r).conf === 'user', 'with your own values for every ingredient it logs as “Confirmed by you”');
  M.toggleFavorite(r);
  const saved = M.normalizeRecipe(st().favorites[0]);
  ok(saved.lines.length === r.lines.length && M.rescale(saved, 3).servings === 3, 'saved recipes keep their lines and can be rescaled');
}

section('11. Variety and near-duplicates');
{
  fresh();
  pick(['chicken-thigh', 'rice', 'broccoli', 'bell-pepper', 'onion']);
  st().recent = [];
  const a = M.generate({ seed: 21 });
  const b = M.generate({ seed: 22, exclude: a.ideas.map((x) => x.key), avoidFormats: a.ideas.map((x) => x.format), avoidFlavors: a.ideas.map((x) => x.flavor) });
  show(a);
  console.log('   then:');
  show(b);
  ok(b.ideas.every((x) => !a.ideas.some((y) => y.key === x.key)), 'Different ideas never repeats an idea');
  ok(b.ideas.filter((x) => !a.ideas.some((y) => y.format === x.format)).length >= 3, 'and mostly uses different dish types');
  ok(b.ideas.filter((x) => !a.ideas.some((y) => y.flavor === x.flavor)).length >= 3, 'and different flavors');
  const fm = new Set(), fl = new Set();
  for (let k = 0; k < 15; k++) M.generate({ seed: 100 + k }).ideas.forEach((x) => (fm.add(x.format), fl.add(x.flavor)));
  console.log(`   over 15 rounds: ${fm.size} dish types, ${fl.size} flavor profiles`);
  ok(fm.size >= 8 && fl.size >= 12, 'repeated suggestions rotate through many dish types and flavors');
  ok(M.FORMATS.length === 20 && M.FLAVORS.length === 26, `${M.FORMATS.length} dish formats × ${M.FLAVORS.length} flavor profiles`);
}

section('12. Dietary preferences and things to avoid');
{
  fresh();
  ok(st().prefs.dislikedText.join() === 'corn,cornstarch,flour', 'new kitchens start with your stated avoid list (corn, cornstarch, flour)');
  pick(['tofu', 'rice', 'broccoli']);
  let all = [];
  for (let k = 0; k < 6; k++) all = all.concat(M.generate({ seed: k }).ideas);
  ok(all.every((x) => !x.lines.some((l) => /cornstarch|flour/i.test(l.name))), 'no cornstarch or flour is added');
  ok(all.some((x) => x.lines.some((l) => l.id === 'potato-starch')), 'potato starch is used instead (crispy tofu, sauces)');
  M.addToKitchen('corn-tortilla');
  ok(!M.usable(M.get('corn-tortilla')) && /corn/.test(M.blockReason(M.get('corn-tortilla'))), 'corn tortillas are blocked when you avoid corn');
  st().prefs.dislikedText = [];
  st().prefs.diets = ['vegetarian'];
  pick(['chicken-breast', 'tofu', 'eggs', 'rice', 'spinach']);
  let r = M.generate({ seed: 3 });
  ok(r.ideas.length && r.ideas.every((x) => !x.uses.includes('chicken-breast')), 'vegetarian: no meat');
  st().prefs.diets = ['gluten-free'];
  pick(['chicken-thigh', 'pasta', 'rice', 'bok-choy']);
  r = M.generate({ seed: 3 });
  ok(r.ideas.every((x) => !x.uses.includes('pasta') && !x.lines.some((l) => l.id === 'soy-sauce')), 'gluten-free: no pasta, no regular soy sauce');
  ok(r.ideas.some((x) => x.lines.some((l) => l.id === 'tamari')) || !r.ideas.some((x) => /soy|tamari/.test(x.steps.join(' '))), 'soy sauce becomes tamari');
  st().prefs.diets = ['dairy-free'];
  pick(['shrimp', 'pasta', 'spinach', 'parmesan']);
  r = M.generate({ seed: 4 });
  ok(r.ideas.length && r.ideas.every((x) => !x.lines.some((l) => ['butter', 'pesto', 'parmesan'].includes(l.id))), 'dairy-free: no butter, pesto or parmesan');
  st().prefs.diets = ['nut-free'];
  pick(['chicken-breast', 'rice-noodles', 'cabbage', 'carrot']);
  r = M.generate({ seed: 5 });
  ok(r.ideas.every((x) => x.flavor !== 'peanut'), 'nut-free: no peanut sauce');
  st().prefs.diets = ['low-carb'];
  pick(['salmon', 'rice', 'asparagus']);
  r = M.generate({ seed: 6 });
  ok(r.ideas.length && r.ideas.every((x) => !x.uses.includes('rice')), 'lower carb: carbs left out');
  st().prefs.diets = [];
  M.toggleDisliked('broccoli');
  pick(['chicken-breast', 'rice', 'broccoli', 'spinach']);
  ok(M.generate({ seed: 1 }).ideas.every((x) => !x.uses.includes('broccoli')), 'a disliked ingredient is never used');
  M.toggleDisliked('broccoli');
  st().prefs.dislikedText = ['honey'];
  pick(['salmon', 'rice', 'broccoli']);
  for (let k = 0; k < 5; k++) ok(M.generate({ seed: k }).ideas.every((x) => !x.lines.some((l) => l.id === 'honey')), 'avoided pantry item (honey) never added');
  st().prefs.dislikedText = [];
  st().prefs.airFryer = false;
  pick(['chicken-breast', 'potato', 'broccoli']);
  ok(M.generate({ seed: 2 }).ideas.every((x) => !x.airFryer), 'no air fryer → no air-fryer steps');
  st().prefs.airFryer = true;
  st().prefs.styles = ['air'];
  ok(M.generate({ seed: 2 }).ideas.filter((x) => x.airFryer).length >= 2, 'Air fryer style favors air-fryer recipes');
  st().prefs.styles = ['onepan'];
  ok(M.generate({ seed: 2 }).ideas.every((x) => x.onePan), 'One-pan style keeps every idea to one pan');
  st().prefs.styles = ['quick'];
  ok(M.generate({ seed: 2 }).ideas.every((x) => x.prep + x.cook <= 30), 'Quick & easy keeps ideas to 30 minutes');
  st().prefs.styles = ['protein'];
  const hp = M.generate({ seed: 2 }).ideas[0].macros.p;
  st().prefs.styles = [];
  ok(hp >= M.generate({ seed: 2 }).ideas[0].macros.p, 'High protein makes portions more protein-forward');
  st().prefs.mealType = 'breakfast';
  pick(['eggs', 'potato', 'bell-pepper', 'greek-yogurt', 'berries']);
  ok(M.generate({ seed: 2 }).ideas.every((x) => ['scramble', 'frittata', 'hash', 'tacos', 'quesadilla', 'melt', 'yogurt', 'oats'].includes(x.format)), 'Breakfast shows breakfast-friendly dishes');
  st().prefs.mealType = 'any';
}

section('13. Incomplete or incompatible selections');
{
  fresh();
  pick([]);
  ok(/Pick a few/.test(M.generate().reason), 'nothing picked → prompt');
  pick(['rice', 'spinach']);
  ok(!M.generate().ideas.length && /Add a protein/.test(M.generate().reason), 'no protein → explains what to add');
  M.addToKitchen('bacon');
  pick(['bacon']);
  ok(/another protein/.test(M.generate().reason), 'bacon alone → suggests pairing it');
  pick(['tuna']);
  ok(/Canned fish needs a partner/.test(M.generate().reason), 'tuna alone → explains');
  pick(['cottage-cheese']);
  ok(/sauce or base/.test(M.generate().reason), 'dairy alone → explains what to add');
  pick(['chicken-breast']);
  const r = M.generate({ seed: 1 });
  ok(r.ideas.length >= 2 && r.hints.some((h) => /vegetable/.test(h)) && r.hints.some((h) => /carb/.test(h)), 'protein only → simple ideas plus hints to add a vegetable and a carb');
  pick(['chicken-breast', 'rice', 'broccoli', 'banana']);
  const r2 = M.generate({ seed: 1 });
  ok(r2.ideas.every((x) => !x.uses.includes('banana')) && r2.ideas.every((x) => x.unused.includes('Bananas')) && r2.hints.some((h) => /Bananas/.test(h)), 'an ingredient that doesn’t fit (banana with chicken dinner) is left out and named as unused');
}

section('14. Works offline');
{
  // fetch / XMLHttpRequest throw in this test (set at the top): estimation, generation and logging never touched them
  fresh();
  const x = M.saveIngredient({ name: 'Butterball turkey kielbasa' });
  pick([x.id, 'rice', 'bell-pepper']);
  const r = M.generate({ seed: 1 });
  const e = M.logServing(r.ideas[0]);
  ok(x.macros.p > 0 && r.ideas.length && e, 'estimate → generate → log ran with no network available');
}

section('Migration: first meal planner (schema 1) → schema 2');
{
  const old = {
    custom: [{ id: 'ing-a', name: 'Cod', cat: 'protein', kind: 'custom', tags: ['fish'], per: { n: 1, unit: 'serving', p: 26, cal: 120, c: null, f: null } }, { id: 'ing-b', name: 'Kale', cat: 'veg', kind: 'custom', tags: [], per: null }],
    edits: { 'bok-choy': { name: 'Baby bok choy' } },
    selected: ['shrimp', 'ing-a'], unavailable: ['salmon'], staples: ['rice'], usage: { shrimp: 5 },
    favorites: [{ key: 'garlic-pasta|shrimp||pasta|spinach|', tpl: 'garlic-pasta', name: 'Garlicky pasta with shrimp and spinach', method: 'Stovetop', prep: 5, cook: 20, servings: 2, mine: [{ id: 'shrimp', name: 'Shrimp', amount: '12 oz', m: { p: 34, cal: 145, c: 0, f: 1 } }], extras: [{ id: 'oil', name: 'Olive oil', amount: '2 tsp', m: { p: 0, cal: 40, c: 0, f: 4.5 } }], steps: ['Boil the pasta.', 'Cook the shrimp.'], macros: { p: 43, cal: 420, c: 40, f: 9 } }],
    recent: [{ tpl: 'stir-fry', key: 'x' }],
    prefs: { diets: ['gluten-free'], disliked: ['mushroom'], dislikedText: ['honey'], airFryer: false, servings: 3, maxTime: 30 },
  };
  const m = M.normalize(JSON.parse(JSON.stringify(old)));
  ok(m.schema === 2, 'upgraded to schema 2');
  const cod = m.custom.find((x) => x.id === 'ing-a');
  ok(cod && cod.macros.p === 26 && cod.macros.cal === 120 && cod.status === 'user' && cod.macros.f != null && cod.base === 'cod', 'custom ingredient keeps your protein and calories; carbs and fat are estimated from the name');
  const kale = m.custom.find((x) => x.id === 'ing-b');
  ok(kale && kale.macros.cal > 0 && kale.status === 'estimated', 'a custom ingredient with no values gets an estimate');
  ok(m.overrides['bok-choy'].name === 'Baby bok choy', 'renamed built-in kept');
  ok(['shrimp', 'ing-a', 'salmon', 'rice', 'mushroom', 'ing-b'].every((id) => m.kitchen.includes(id)), 'everything selected, starred, out of stock or disliked is in the kitchen');
  ok(m.selected.join() === 'shrimp,ing-a' && m.unavailable[0] === 'salmon' && m.staples[0] === 'rice' && m.usage.shrimp === 5, 'selection, stock and staples kept');
  ok(m.favorites.length === 1 && m.favorites[0].name === old.favorites[0].name && m.favorites[0].steps.length === 2, 'saved recipe kept as-is');
  ok(m.prefs.diets[0] === 'gluten-free' && m.prefs.disliked[0] === 'mushroom' && m.prefs.dislikedText.join() === 'honey' && m.prefs.airFryer === false && m.prefs.servings === 3 && m.prefs.maxTime === 30, 'preferences kept exactly (your avoid list is not replaced)');
  ok(JSON.stringify(M.normalize(JSON.parse(JSON.stringify(m)))) === JSON.stringify(m), 'normalising again changes nothing (idempotent)');
  WT.db.meals = m;
  const legacy = M.normalizeRecipe(m.favorites[0]);
  ok(legacy.legacy && legacy.lines.length === 2 && legacy.macros.p === 43, 'old saved recipe still displays with its saved values');
  const e = M.logServing(m.favorites[0]);
  ok(e && e.per.p === 43, 'and can still be logged');
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
  // Turning achievements off and back on never replays celebrations
  {
    WT.resetAll();
    const w = (d) => WT.db.history.push({ id: WT.uid(), type: 'full', title: 'W', startedAt: ago(d), endedAt: ago(d), durationSec: 3000, prs: [], totals: { sets: 1 }, exercises: [{ uid: WT.uid(), exId: 'db-curl', intensity: 'regular', targetSets: 1, repMin: 8, repMax: 12, sets: [{ w: '20', r: '10', done: true }] }] });
    A.check();
    w(1);
    const f1 = A.check();
    ok(f1.some((d) => d.id === 'first-workout'), 'a milestone reached while on is celebrated');
    const firstAt = WT.db.achievements.unlocked['first-workout'].at;
    WT.db.profile.achievements = false;
    ok(A.check().length === 0 && WT.db.achievements.off === true, 'while off nothing is recorded');
    w(0.5); w(0.4); // 3 workouts reached while achievements are off
    ok(!WT.db.achievements.unlocked['workouts-3'], 'not recorded while off');
    WT.db.profile.achievements = true;
    const f2 = A.check();
    ok(f2.length === 0, 'turning them back on replays no celebration');
    ok(WT.db.achievements.unlocked['workouts-3'] && WT.db.achievements.unlocked['workouts-3'].retro, 'milestones reached while off are recorded quietly');
    ok(Math.abs(new Date(WT.db.achievements.unlocked['workouts-3'].at) - new Date(ago(0.4))) < 1000, '…with the date they actually happened');
    ok(WT.db.achievements.unlocked['first-workout'].at === firstAt && !WT.db.achievements.unlocked['first-workout'].retro, 'earlier unlocks keep their original date and status');
    // After re-enabling, genuinely new milestones are celebrated again
    for (let k = 0; k < 7; k++) w(0.01);
    ok(A.check().some((d) => d.id === 'workouts-10'), 'a new milestone after re-enabling is celebrated');
    // Off → on → off → on with nothing new: nothing at all
    WT.db.profile.achievements = false; A.check(); WT.db.profile.achievements = true;
    ok(A.check().length === 0, 'toggling again with nothing new does nothing');
    // Celebrations switched off: recorded, never replayed when switched back on
    WT.db.profile.achCelebrate = false;
    for (let k = 0; k < 15; k++) w(0.005);
    const f3 = A.check();
    ok(f3.some((d) => d.id === 'workouts-25'), 'recorded while celebrations are off');
    WT.db.profile.achCelebrate = true;
    ok(A.check().length === 0, 'turning celebrations back on replays nothing');
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
