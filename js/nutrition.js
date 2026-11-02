/* Nutrition: a deterministic natural-language food parser and the food-log store helpers.
 *
 * Parsing ("2 chicken breasts, a protein shake and 2 hot dogs"):
 *   1. Normalize text: fractions, number words ("two", "half a", "a couple of"), "6-inch", "x2".
 *   2. Split into items on commas, "and", "with", "plus", new lines… — while protecting food names that
 *      themselves contain "and" / "with" (rice and beans, mac and cheese, PB&J).
 *   3. For each item: find the best food (your own saved foods first, then the bundled table) by
 *      whole-word, plural-insensitive alias matching; longer matches win.
 *   4. Read the quantity, serving word (scoop, cup, bowl, handful, serving, oz…) and size word (large…).
 *      Words left over are kept: a recognized brand is noted, unknown words (a flavor) mark it generic.
 *   5. Nothing matched → the item is returned as `unknown` with suggestions. It is never logged silently.
 * Everything runs locally; no network, no AI service.
 */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const N = (WT.nut = WT.nut || {});

  /* ───────── Words ───────── */
  const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20 };
  // Serving words → canonical unit
  const UNIT_WORDS = {
    scoop: 'scoop', cup: 'cup', c: 'cup', mug: 'mug', bowl: 'bowl', plate: 'plate', handful: 'handful', fistful: 'handful',
    serving: 'serving', portion: 'serving', helping: 'serving', shake: 'shake', package: 'package', pack: 'package', pkg: 'package', packet: 'packet',
    can: 'can', tin: 'can', bottle: 'bottle', glass: 'glass', container: 'container', tub: 'tub', carton: 'carton', pouch: 'pouch', bag: 'bag', box: 'box',
    slice: 'slice', piece: 'piece', pc: 'piece', bite: 'piece', strip: 'strip', link: 'link', patty: 'patty', fillet: 'fillet', filet: 'fillet', stick: 'stick', bar: 'bar',
    block: 'block', cube: 'cube', square: 'square', wrap: 'wrap', half: 'half', pint: 'pint', quart: 'quart', shot: 'shot', splash: 'splash', sprinkle: 'sprinkle',
    spoon: 'spoon', spoonful: 'spoonful', tbsp: 'tbsp', tablespoon: 'tbsp', tbs: 'tbsp', tbl: 'tbsp', tsp: 'tsp', teaspoon: 'tsp',
    oz: 'oz', ounce: 'oz', g: 'g', gram: 'g', gr: 'g', lb: 'lb', pound: 'lb', kg: 'kg', kilo: 'kg', stack: 'stack', basket: 'basket', schmear: 'schmear', pie: 'pie', cone: 'cone',
  };
  const WEIGHT = { oz: 28.35, g: 1, lb: 453.6, kg: 1000 };
  // Rough fallback when a serving word isn't defined for a food (flagged as a rough guess)
  const GENERIC_UNIT = { serving: 1, piece: 1, bowl: 1.5, plate: 2, handful: 1, cup: 1, scoop: 1, package: 1, packet: 1, container: 1, can: 1, bottle: 1, glass: 1, slice: 1, half: 0.5, bag: 1.5, box: 2, pint: 2, quart: 4, spoon: 0.15, spoonful: 0.15, tbsp: 0.1, tsp: 0.04, splash: 0.1, shot: 0.3 };
  const SIZE_WORDS = { small: 0.75, little: 0.75, mini: 0.6, medium: 1, regular: 1, normal: 1, large: 1.25, big: 1.25, huge: 1.5, giant: 1.5, jumbo: 1.5, xl: 1.5, heaping: 1.25, generous: 1.25 };
  // Descriptive words that don't change the estimate and shouldn't flag an item as "not recognized"
  const STOP = new Set(('of a an the some my i had ate eat eating also just about around approx approximately roughly like ish for at in on to from ' +
    'breakfast lunch dinner snack meal today tonight morning post pre workout leftover leftovers homemade home made fresh plain cooked grilled baked ' +
    'roasted fried scrambled boiled hard soft poached steamed sauteed sautéed pan seared raw lean extra boneless skinless skin on bone in organic ' +
    'nonfat non fat lowfat low fat fatfree free reduced full whole skim 1% 2% unsweetened sweetened vanilla chocolate strawberry plain original classic natural regular ' +
    'cold hot iced warm cup-sized sized size serving-sized style stuff thing more another few couple').split(' '));
  // Flavors are fine as descriptors on generic items but are worth noting
  const INVARIANT = new Set(['shrimp', 'fish', 'hummus', 'couscous', 'asparagus', 'swiss', 'oz', 'lbs', 'pbs', 'gas', 'pancreas', 'nachos', 'chips', 'fries', 'oikos', 'ratio', 'molasses', 'brussels', 'peas', 'quinoa', 'grits', 'wheaties', 'cheerios', 'kodiak', 'dal', 'dhal', 'tbs', 'gelato', 'froyo', 'espresso', 'kirkland', 'chomps']);
  // Singular, plural-insensitive token form. Applied to aliases and input alike, so it only has to be consistent.
  function sing(w) {
    if (w.length <= 3 || INVARIANT.has(w) || /\d/.test(w)) return w;
    if (w === 'loaves') return 'loaf';
    if (w === 'halves') return 'half';
    if (w === 'knives') return 'knife';
    if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.endsWith('oes')) return w.slice(0, -2);
    if (/(ches|shes|xes|sses|zes)$/.test(w)) return w.slice(0, -2);
    if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
    return w;
  }
  N.sing = sing;
  const tokenize = (s) =>
    String(s)
      .toLowerCase()
      .replace(/[’`]/g, "'")
      .replace(/'s\b/g, 's')
      .replace(/'/g, '')
      .replace(/[^a-z0-9%.\s/-]/g, ' ')
      .replace(/(\D)-|-(\D)/g, '$1 $2')
      .split(/\s+/)
      .filter(Boolean);

  /* ───────── Food index (bundled + your saved foods) ───────── */
  let builtinIndex = null;
  function aliasEntries(food, custom) {
    const names = custom ? [food.name].concat(food.aliases || []) : food.a;
    return names.map((a) => ({ toks: tokenize(a.replace(/&/g, ' and ')).map(sing), food, custom }));
  }
  function index() {
    if (!builtinIndex) builtinIndex = WT.FOODS.flatMap((f) => aliasEntries(f, false));
    return builtinIndex;
  }
  N.foodById = (id) => WT.FOODS.find((f) => f.id === id);
  N.myFood = (id) => ((WT.db.nutrition && WT.db.nutrition.foods) || []).find((f) => f.id === id);

  // Phrases that contain a splitter word but are one food. Rebuilt lazily.
  let protectedRe = null;
  function protect(text) {
    if (!protectedRe) {
      const ph = WT.FOODS.flatMap((f) => f.a).filter((a) => /\b(and|with|n)\b/.test(a));
      ph.sort((a, b) => b.length - a.length);
      protectedRe = new RegExp('\\b(' + ph.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')).join('|') + ')', 'g');
    }
    let out = text.replace(protectedRe, (m) => m.replace(/\s+/g, '_')).replace(/\b(\w+)\s+and\s+cream\b/g, '$1_and_cream');
    // Your own foods may contain "and" too ("pb and banana toast")
    ((WT.db && WT.db.nutrition && WT.db.nutrition.foods) || []).forEach((f) => {
      [f.name].concat(f.aliases || []).forEach((nm) => {
        const n = String(nm).toLowerCase().replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();
        if (/\b(and|with)\b/.test(n)) out = out.split(n).join(n.replace(/ /g, '_'));
      });
    });
    return out;
  }

  /* ───────── Text normalization ───────── */
  const FRAC = { '½': ' 1/2', '¼': ' 1/4', '¾': ' 3/4', '⅓': ' 1/3', '⅔': ' 2/3', '⅛': ' 1/8' };
  function normalize(text) {
    let t = ' ' + String(text || '').toLowerCase().replace(/[½¼¾⅓⅔⅛]/g, (c) => FRAC[c]) + ' ';
    t = t.replace(/[’`]/g, "'").replace(/\s*&\s*/g, ' and ').replace(/\bn'\b|\s'n'?\s/g, ' and ');
    t = t.replace(/\bpb\s*(and|&)\s*j\b/g, 'pbj').replace(/([a-z0-9])\+/g, '$1_plus'); // "Protein+" is a name, not a list
    const nw = Object.keys(NUM_WORDS).join('|');
    t = t.replace(new RegExp(`\\b(${nw})\\b`, 'g'), (m) => String(NUM_WORDS[m]));
    t = t.replace(/(\d+)\s+(\d+)\/(\d+)/g, (m, a, b, c) => String(+a + +b / +c));
    t = t.replace(/(\d+)\/(\d+)/g, (m, a, b) => String(WT.round(+a / +b, 3)));
    t = t.replace(/\b(\d+(?:\.\d+)?)\s+and\s+(a\s+)?half\b/g, (m, a) => String(+a + 0.5));
    t = t.replace(/\b(?:a|one)\s+and\s+(?:a\s+)?half\b/g, '1.5');
    t = t.replace(/\b(half\s+(?:a\s+)?dozen)\b/g, '6');
    t = t.replace(/\b(?:a\s+)?dozen\b/g, '12');
    t = t.replace(/\bhalf\s+(?:a|an)\b/g, '0.5').replace(/\ba\s+half\b/g, '0.5');
    t = t.replace(/\b(?:a\s+)?couple\s+(?:of\s+)?/g, '2 ').replace(/\b(?:a\s+)?few\b/g, '3').replace(/\bseveral\b/g, '3');
    t = t.replace(/(\d)\s*(oz|g|lb|lbs|kg|ml)\b/g, '$1 $2');
    return t;
  }

  function splitItems(text) {
    const t = protect(normalize(text));
    return t
      .split(/[,;\n+]|\band\b|\bplus\b|\bwith\b|\balso\b|\bthen\b/)
      .map((s) => s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim())
      .filter((s) => s && /[a-z]/.test(s) && !/^(and|with|a|an|the|some)$/.test(s));
  }
  N.splitItems = splitItems;

  /* ───────── Matching ───────── */
  // Best in-order match of alias tokens within item tokens, allowing up to 2 skipped words.
  function matchAt(itemToks, aliasToks) {
    let best = null;
    for (let start = 0; start < itemToks.length; start++) {
      if (itemToks[start] !== aliasToks[0]) continue;
      const idx = [start];
      let j = start + 1, gaps = 0;
      for (let k = 1; k < aliasToks.length && j < itemToks.length; ) {
        if (itemToks[j] === aliasToks[k]) {
          idx.push(j);
          k++;
        } else gaps++;
        j++;
        if (gaps > 2) break;
      }
      if (idx.length === aliasToks.length && (!best || gaps < best.gaps)) best = { idx, gaps };
    }
    return best;
  }
  function bestMatch(toks) {
    let best = null;
    for (const e of index()) {
      if (e.toks.length > toks.length) continue;
      const m = matchAt(toks, e.toks);
      if (!m) continue;
      const score = e.toks.length * 10 - m.gaps * 3 + (e.custom ? 15 : 0) + (e.food.label ? 4 : 0);
      if (!best || score > best.score) best = { score, idx: m.idx, food: e.food, custom: e.custom };
    }
    return best;
  }
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  /** Close names for something we couldn't match: typo tolerance + shared words. */
  N.suggest = function (text, limit) {
    const toks = tokenize(text).map(sing).filter((t) => !STOP.has(t) && !UNIT_WORDS[t] && !/^\d/.test(t));
    if (!toks.length) return [];
    const scored = new Map();
    for (const e of index()) {
      let s = 0;
      e.toks.forEach((at) =>
        toks.forEach((t) => {
          if (at === t) s += 3;
          else if (t.length >= 4 && at.length >= 4 && lev(t, at) <= (t.length >= 7 ? 2 : 1)) s += 2;
          else if (t.length >= 4 && (at.startsWith(t) || t.startsWith(at)) && at.length >= 3) s += 1;
        })
      );
      if (!s) continue;
      s -= e.toks.length * 0.1;
      const key = e.custom ? 'my:' + e.food.id : e.food.id;
      if (!scored.has(key) || scored.get(key).s < s) scored.set(key, { s, food: e.food, custom: e.custom });
    }
    return [...scored.values()].sort((a, b) => b.s - a.s).slice(0, limit || 4).map((x) => ({ id: x.custom ? 'my:' + x.food.id : x.food.id, name: x.custom ? x.food.name : x.food.n, custom: x.custom }));
  };

  /* ───────── Branded products & your library ─────────
   * Products (js/products.js) and the foods in your library are matched before generic foods.
   * Each candidate is scored on brand, product-identifying words (`key`), aliases, flavor and category.
   * A match is only "confident" if nothing typed contradicts it (an unlisted flavor, another category,
   * an unrecognized word) and it is singled out within its brand. Otherwise the item comes back
   * `ambiguous` with the candidates, and the user chooses — nothing is silently picked.
   */
  const LIB = () => (WT.db && WT.db.nutrition && WT.db.nutrition.foods) || [];
  const ptoks = (s) => tokenize(String(s || '').replace(/&/g, ' and ').replace(/\+/g, ' plus ')).map(sing);
  const ctoks = (s) => ptoks(s).filter((t) => !STOP.has(t) || (generic(), FLAV.has(t))); // as compared with typed text
  let GENERIC = null, FLAV = null;
  function generic() {
    if (GENERIC) return GENERIC;
    GENERIC = new Set(['protein', 'high', 'plus', 'blended', 'nonfat', 'greek', 'classic', 'uncured', 'creamy', 'natural', 'ultra', 'filtered', 'a2', 'pack', 'multipack', 'fl', 'ml', 'flavor', 'flavored', 'brand', 'and', 'with', 'style', 'mix']);
    WT.FOODS.forEach((f) => f.a.forEach((a) => ptoks(a).forEach((t) => GENERIC.add(t))));
    Object.keys(UNIT_WORDS).forEach((t) => GENERIC.add(t));
    STOP.forEach((t) => GENERIC.add(sing(t)));
    Object.keys(WT.PRODUCT_CATS || {}).forEach((t) => GENERIC.add(t));
    FLAV = new Set((WT.FLAVOR_WORDS || []).map(sing));
    FLAV.forEach((t) => GENERIC.delete(t));
    return GENERIC;
  }
  const flavSet = () => (generic(), FLAV);
  N.productById = (id) => (WT.PRODUCTS || []).find((x) => x.id === id);
  /** Display name: brand, product, and the flavor when there is one. */
  N.productName = (x, flavor) => {
    const f = flavor || x.flavor;
    return `${x.brand} ${x.line}${f ? ' · ' + f : ''}`.trim();
  };
  function describe(x, lib) {
    const brand = ptoks(x.brand);
    const name = ptoks(lib ? x.name : x.line);
    const flavors = [x.flavor].concat(x.flavors || []).filter(Boolean);
    const flav = flavors.flatMap(ptoks);
    const phrases = (lib ? [x.name, `${x.brand || ''} ${x.flavor || ''}`].concat(x.aliases || []) : (x.a || []).concat(x.key && x.key.length ? [] : [`${x.brand} ${x.line}`])).map(ctoks).filter((p) => p.length && !(p.length === brand.length && p.every((t, i) => t === brand[i])));
    const keys = (x.key || []).map(ctoks).filter((k) => k.length);
    const G = generic();
    const telling = (p) => p.some((t) => brand.includes(t) || (!G.has(t) && !FLAV.has(t)));
    const ph = phrases.filter((p) => telling(p) || lib).map((p) => Object.assign(p, { exact: !telling(p) }));
    const all = new Set([].concat(brand, name, flav, ph.flat(), keys.flat()));
    // Your own foods may have no category: infer it from their name ("… protein shake" → shake)
    const cat = x.cat || name.map((t) => (WT.PRODUCT_CATS || {})[t]).filter(Boolean).pop() || null;
    return { x, lib, brand, name, flav, flavors, phrases: ph, keys, all, cat, keyDistinct: keys.map(telling) };
  }
  function productIndex() {
    const lib = LIB();
    const shadow = new Set(lib.map((f) => f.productId).filter(Boolean));
    return lib.map((f) => describe(f, true)).concat((WT.PRODUCTS || []).filter((x) => !shadow.has(x.id)).map((x) => describe(x, false)));
  }
  // Everyday flavors never identify a product on their own; a rarer one ("snickerdoodle") does for your own products
  let HEADS = null;
  const foodHeads = () => HEADS || (HEADS = new Set(WT.FOODS.flatMap((f) => f.a.map(ptoks).filter((t) => t.length === 1).map((t) => t[0]))));
  const COMMON_FLAV = new Set(['vanilla', 'chocolate', 'strawberry', 'banana', 'cream', 'cookie', 'peanut', 'berry', 'mixed', 'coffee', 'caramel', 'honey', 'plain', 'original']);
  function scoreProduct(d, C) {
    const G = generic(), FL = flavSet();
    const isDistinct = (t) => !G.has(t) && (!FL.has(t) || (d.lib && !COMMON_FLAV.has(t)));
    const has = (t) => C.has(t);
    const brandHit = d.brand.length > 0 && d.brand.every(has);
    let aliasLen = 0;
    d.phrases.forEach((p) => {
      if (!p.every(has)) return;
      // a saved name made only of everyday words ("Eggs") must match exactly, not inside "egg sandwich"
      if (p.exact && [...C].some((t) => !p.includes(t) && !d.all.has(t) && !UNIT_WORDS[t] && !SIZE_WORDS[t])) return;
      aliasLen = Math.max(aliasLen, p.length);
    });
    let keyHit = false, keyDistinct = false;
    d.keys.forEach((k, i) => {
      if (k.every(has)) {
        keyHit = true;
        if (d.keyDistinct[i]) keyDistinct = true;
      }
    });
    let s = 0, distinct = 0, catConflict = false, catMatch = false;
    const unexplained = [];
    C.forEach((t) => {
      if (d.brand.includes(t)) return;
      const cat = (WT.PRODUCT_CATS || {})[t];
      if (d.all.has(t)) {
        if (isDistinct(t)) distinct++;
        s += isDistinct(t) ? 25 : 6;
        if (cat && cat === d.cat) catMatch = true;
        return;
      }
      if (cat) {
        if (d.cat && cat !== d.cat) catConflict = true;
        else if (cat === d.cat) catMatch = true;
        return;
      }
      if (FL.has(t)) {
        if (d.flav.length || d.lib) unexplained.push(t); // a flavor this product doesn't list
        return;
      }
      if (!G.has(t) && !/^\d/.test(t) && t.length > 2) unexplained.push(t);
    });
    if (brandHit) s += 40;
    if (aliasLen) s += 50 + aliasLen * 3;
    if (keyHit) s += 20;
    if (catMatch) s += 15;
    if (catConflict) s -= 30;
    s -= 15 * unexplained.length;
    if (d.lib) s += 8;
    // Found only through a telling word, but another food is named ("snickerdoodle cookie" vs your shake)? Not this product.
    const otherFood = !brandHit && !aliasLen && !keyDistinct && [...C].some((t) => foodHeads().has(t) && !d.all.has(t) && !UNIT_WORDS[t] && !(WT.PRODUCT_CATS || {})[t]);
    // A key made of everyday words ("milk", "beef frank") only counts once the brand is named
    const candidate = !otherFood && (brandHit || aliasLen > 0 || keyDistinct || distinct > 0);
    const identified = aliasLen > 0 || (keyHit && (brandHit || keyDistinct)) || (!d.keys.length && (brandHit || distinct > 0));
    const confident = candidate && identified && !unexplained.length && !catConflict;
    const typedFlavor = d.flavors.find((f) => ptoks(f).every(has));
    return { d, s, candidate, confident, unexplained, catConflict, brandHit, aliasLen, typedFlavor };
  }
  /** Score products/library against item tokens. → { pick } | { ambiguous: [...], unexplained } | null */
  N.matchProducts = function (tokens) {
    const C = new Set(tokens.filter(Boolean));
    if (!C.size) return null;
    const cands = productIndex().map((d) => scoreProduct(d, C)).filter((r) => r.candidate).sort((a, b) => b.s - a.s);
    if (!cands.length) return null;
    const conf = cands.filter((c) => c.confident);
    if (conf.length) {
      const top = conf[0];
      const rivals = conf.slice(1).filter((c) => top.s - c.s < 15);
      if (!rivals.length || (top.d.lib && rivals.every((r) => !r.d.lib))) return { pick: top };
      return { ambiguous: conf.slice(0, 4), unexplained: [] };
    }
    const fit = cands.filter((c) => !c.catConflict);
    const list = (fit.length ? fit : cands).slice(0, 4);
    // the unknown variety is whatever the brand's own products don't explain ("Snickerdoodle" for Pioneer Pastures)
    const branded = list.filter((c) => c.brandHit);
    const basis = branded.length ? branded : list.slice(0, 1);
    return { ambiguous: list, unexplained: basis[0].unexplained.filter((t) => basis.every((c) => c.unexplained.includes(t))), brand: basis[0].d.x.brand || '' };
  };

  /* Servings for products: label serving words, same-thing synonyms, weight, and volume conversions */
  const COUNT_SYN = {
    shake: ['shake', 'bottle', 'drink', 'carton', 'can', 'serving'], bar: ['bar', 'piece', 'serving'], yogurt: ['cup', 'container', 'tub', 'serving'],
    hotdog: ['link', 'frank', 'wiener', 'piece', 'serving'], cheese: ['slice', 'single', 'serving'], spread: ['serving'], pasta: ['serving'], milk: ['cup', 'glass', 'serving'], pancake: ['serving'],
  };
  const DENSITY = { yogurt: { tbsp: 15, tsp: 5, spoon: 15, spoonful: 15 }, spread: { tbsp: 16.5, tsp: 5.5, spoon: 16.5, spoonful: 16.5 }, milk: { tbsp: 15, splash: 24 } };
  const MACROS = ['p', 'cal', 'c', 'f'];
  function productPer(d, unitWord) {
    const x = d.x;
    const base = d.lib ? x.per : { p: x.p, cal: x.cal, c: x.c, f: x.f };
    const sUnit = x.unit || 'serving';
    const units = x.units || {};
    let m = 1, unit = sUnit, approx = false, rough = false;
    if (unitWord && unitWord !== sUnit) {
      const syn = COUNT_SYN[d.cat] || ['serving'];
      if (units[unitWord] != null) {
        m = +units[unitWord];
        unit = unitWord;
        approx = (x.approx || []).includes(unitWord);
      } else if (unitWord === 'serving' || (syn.includes(unitWord) && syn.includes(sUnit)) || d.name.includes(unitWord)) m = 1; // "shake" of a "… shake" is one
      else if (WEIGHT[unitWord] && x.g) {
        m = WEIGHT[unitWord] / x.g;
        unit = unitWord;
      } else if (x.g && DENSITY[d.cat] && DENSITY[d.cat][unitWord]) {
        m = DENSITY[d.cat][unitWord] / x.g;
        unit = unitWord;
        approx = true;
      } else {
        m = GENERIC_UNIT[unitWord] != null ? GENERIC_UNIT[unitWord] : 1;
        unit = unitWord;
        rough = true;
      }
    }
    const per = {};
    MACROS.forEach((k) => (per[k] = base[k] == null || base[k] === '' ? null : WT.round(+base[k] * m, 3)));
    return { per, unit, m, approx, rough };
  }
  const STATUS_LABEL = { verified: 'Verified', user: 'Confirmed by you', estimated: 'Estimate' };
  N.statusLabel = (s) => STATUS_LABEL[s] || 'Estimate';
  function productItem(r, base, extra) {
    const d = r.d, x = d.x;
    const pp = productPer(d, base.uw);
    const status = d.lib ? x.status || 'user' : x.status;
    const name = d.lib ? x.name : N.productName(x, r.typedFlavor);
    const src = d.lib ? (x.source && x.source.name) || '' : x.src.name;
    const notes = [];
    if (src) notes.push(src);
    const serv = d.lib ? x.serving : x.serv;
    // "1 bottle (11 fl oz)" already names its unit; otherwise say what one serving is
    if (serv) notes.push(new RegExp('^1 ' + (x.unit || 'serving') + '\\b').test(serv) ? serv : `1 ${x.unit || 'serving'} = ${serv}`);
    if (pp.approx) notes.push(`${pp.unit} converted from the label serving (≈)`);
    if (pp.rough) notes.push(`“${pp.unit}” is a rough size for this product`);
    return Object.assign({
      id: WT.uid(), text: base.text, name, qty: base.qty, unit: pp.unit, per: pp.per,
      foodId: (d.lib ? 'my:' : 'p:') + x.id, src: d.lib ? 'my' : 'product', conf: pp.rough ? 'estimated' : status, brand: x.brand || '',
      note: notes.join(' · '), rough: pp.rough, phrase: base.phrase,
    }, extra || {});
  }
  N.candidateLabel = function (c) {
    const d = c.d || c, x = d.x;
    const pp = productPer(d, null);
    const serv = d.lib ? x.serving : x.serv;
    const status = d.lib ? x.status || 'user' : x.status;
    return { id: (d.lib ? 'my:' : 'p:') + x.id, name: d.lib ? x.name : N.productName(x), serving: serv || `1 ${x.unit || 'serving'}`, p: pp.per.p, status };
  };
  /** Turn a chosen candidate (p:id / my:id) into an item, keeping the typed amount. */
  function itemFromRef(ref, base, variant) {
    const lib = ref.startsWith('my:');
    const x = lib ? LIB().find((f) => f.id === ref.slice(3)) : N.productById(ref.slice(2));
    if (!x) return null;
    const d = describe(x, lib);
    const r = { d, typedFlavor: null };
    const it = productItem(r, base, { learn: true });
    if (variant && !lib) {
      // Same product line, but a flavor/variety we don't have data for: use its values as an ESTIMATE.
      it.variant = variant;
      it.name = N.productName(x, variant);
      it.conf = 'estimated';
      it.note = `Estimate — ${variant} isn’t in the database; using ${N.productName(x)} values. Check your label.`;
    }
    return it;
  }

  /* ───────── Quantity & units ───────── */
  function readQty(toks) {
    // Returns { qty, used:Set(indices), mult } — the first number (or a/an), plus "x2"/"2x" multipliers.
    let qty = null, mult = 1;
    const used = new Set();
    toks.forEach((t, i) => {
      let m;
      if ((m = t.match(/^(?:x|×)(\d+(?:\.\d+)?)$/)) || (m = t.match(/^(\d+(?:\.\d+)?)x$/))) {
        mult *= +m[1];
        used.add(i);
      } else if (/^\d+(\.\d+)?$/.test(t) && qty == null) {
        qty = +t;
        used.add(i);
      }
    });
    if (qty == null) {
      const i = toks.findIndex((t) => t === 'a' || t === 'an' || t === 'one');
      if (i >= 0 && i < 2) {
        qty = 1;
        used.add(i);
      }
    }
    return { qty, used, mult };
  }
  N.unitWord = (t) => UNIT_WORDS[t] || UNIT_WORDS[sing(t)] || null;

  const PLURAL_SAME = new Set(['shrimp', 'oz', 'g', 'lb', 'kg', 'tbsp', 'tsp', 'serving of', 'half']);
  N.unitLabel = function (unit, qty) {
    if (!unit) return '';
    if (unit === 'half') return qty === 1 ? 'half' : 'halves';
    if (qty === 1 || PLURAL_SAME.has(unit) || (qty > 0 && qty < 1)) return unit;
    if (/[^aeiou]y$/.test(unit)) return unit.slice(0, -1) + 'ies';
    if (/(s|sh|ch|x)$/.test(unit)) return unit + 'es';
    return unit + 's';
  };
  const FR = { 0.25: '¼', 0.5: '½', 0.75: '¾', 0.33: '⅓', 0.67: '⅔' };
  N.fmtQty = function (q) {
    q = +q || 0;
    const whole = Math.floor(q), frac = WT.round(q - whole, 2);
    if (!frac) return String(whole);
    if (FR[frac]) return (whole ? whole : '') + FR[frac];
    return String(WT.round(q, 2));
  };
  N.fmtAmount = (qty, unit) => `${N.fmtQty(qty)} ${N.unitLabel(unit, qty)}`.trim();

  /* ───────── Parse one item ───────── */
  const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  function brandIn(text) {
    const t = ' ' + tokenize(text).join(' ') + ' ';
    let hit = null;
    Object.keys(WT.FOOD_BRANDS).forEach((k) => {
      const kk = ' ' + tokenize(k).join(' ') + ' ';
      if (t.includes(kk) && (!hit || kk.length > hit.k.length)) hit = { k: kk, name: WT.FOOD_BRANDS[k] };
    });
    return hit;
  }

  function perFor(food, custom, unit, sizeMult) {
    // Macros for ONE `unit` of the food. Returns { per, unit, rough }.
    const base = custom ? food.per : { p: food.p, cal: food.cal, c: food.c, f: food.f };
    const baseUnit = custom ? food.unit || 'serving' : food.u;
    let m = 1, rough = false;
    if (!unit || unit === baseUnit) unit = baseUnit;
    else if (!custom && food.units && food.units[unit] != null) m = food.units[unit];
    else if (WEIGHT[unit] && !custom && food.g) m = WEIGHT[unit] / food.g;
    else if (WEIGHT[unit] && custom && food.g) m = WEIGHT[unit] / food.g;
    else {
      m = GENERIC_UNIT[unit] != null ? GENERIC_UNIT[unit] : 1;
      rough = true;
    }
    m *= sizeMult || 1;
    const r = (v) => WT.round((+v || 0) * m, 2);
    return { per: { p: r(base.p), cal: r(base.cal), c: r(base.c), f: r(base.f) }, unit, rough, m };
  }

  N.parseItem = function (raw, opts) {
    const text = raw.trim();
    let sizeMult = 1;
    let pre = text.replace(/\b(\d+)\s*(?:-\s*)?(?:inch|in|")(?=\s|$)/g, (m, n) => {
      sizeMult *= +n >= 10 ? 2 : 1; // a 12-inch / footlong sub is about two 6-inch subs
      return ' ';
    });
    if (/\bfoot\s*long\b|\bfootlong\b/.test(pre)) {
      sizeMult *= 2;
      pre = pre.replace(/\bfoot\s*long\b|\bfootlong\b/g, ' ');
    }
    const rawToks = tokenize(pre);
    const toks = rawToks.map(sing);
    const q = readQty(toks);
    const free = toks.map((t, i) => (q.used.has(i) ? null : t));
    let uw = null;
    free.forEach((t) => t && !uw && N.unitWord(t) && (uw = N.unitWord(t)));
    const FL = flavSet();
    const content = free.filter((t) => t && (!STOP.has(t) || FL.has(t)));
    // what was typed, minus the amount: kept as shorthand once you confirm a match ("shake", "bar" stay — they're part of the name)
    const measure = (t) => N.unitWord(t) && !(WT.PRODUCT_CATS || {})[t];
    const phrase = rawToks.filter((w, i) => free[i] && !measure(free[i]) && !/^\d/.test(w) && !/^(a|an|the|of|some|my)$/.test(w)).join(' ');
    const base = { text, qty: WT.round((q.qty != null ? q.qty : 1) * q.mult, 2), uw, phrase };
    // 1. Branded products and your library
    const pm = opts && opts.generic ? null : N.matchProducts(content);
    if (pm && pm.pick) return productItem(pm.pick, base);
    if (pm && pm.ambiguous) {
      const top = { brand: pm.brand };
      const variant = pm.unexplained.length ? titleCase(rawToks.filter((w, i) => pm.unexplained.includes(toks[i])).join(' ')) : '';
      const fb = N.parseItem(raw, { generic: true }); // a generic estimate is always an option
      return Object.assign({ id: WT.uid(), ambiguous: true, candidates: pm.ambiguous.map(N.candidateLabel), variant, brand: top.brand || '', fallback: fb.unknown ? null : fb }, base);
    }
    // 2. Generic foods
    const m = bestMatch(free.map((t) => t || '\u0000'));
    if (!m) {
      return Object.assign({ id: WT.uid(), unknown: true, suggestions: N.suggest(text) }, base);
    }
    const food = m.food, custom = m.custom;
    const matched = new Set(m.idx);
    let unit = null, unitIdx = -1;
    const extras = [];
    free.forEach((t, i) => {
      if (t == null || matched.has(i)) return;
      const u = N.unitWord(t);
      if (u && unit == null) {
        unit = u;
        unitIdx = i;
        return;
      }
      if (SIZE_WORDS[t] != null) {
        if (!food.fixed && !custom) sizeMult *= SIZE_WORDS[t];
        return;
      }
      if (t === 'fl' || t === 'ml') return;
      if (STOP.has(t) || STOP.has(rawToks[i])) return;
      extras.push(rawToks[i]);
    });
    // A bare count uses the food's counting unit ("10 shrimp", "20 almonds")
    if (!unit && q.qty != null && !custom && food.count) unit = food.count;
    let qty = q.qty != null ? q.qty : q.mult !== 1 || unitIdx >= 0 || custom ? 1 : food.dq || 1;
    qty = WT.round(qty * q.mult, 2);
    const r = perFor(food, custom, unit, sizeMult);
    const found = brandIn(text);
    const brandToks = found ? tokenize(found.k) : [];
    const typed = new Set(extras.concat(m.idx.map((i) => rawToks[i]), m.idx.map((i) => toks[i])));
    const brand = found && brandToks.every((w) => typed.has(w) || typed.has(sing(w))) ? found : null;
    const unknownWords = brand ? extras.filter((w) => !brandToks.includes(w)) : extras;
    let name = custom ? food.name : food.n;
    let note = '', generic = false;
    if (custom) note = 'Your saved food';
    else if (food.label) note = 'Typical label value — check your package';
    else if (brand && !food.n.toLowerCase().includes(brand.name.toLowerCase())) {
      name = `${brand.name} ${name.toLowerCase()}`;
      note = `${brand.name} recognized · typical ${food.n.toLowerCase()} estimate, not label data`;
      generic = true;
    }
    if (brand && (WT.PRODUCTS || []).some((x) => x.brand.toLowerCase() === brand.name.toLowerCase())) note += ' · Look up the exact product to use its label';
    if (unknownWords.length && !custom) {
      const desc = unknownWords.join(' ');
      name = brand ? `${name} (${desc})` : titleCase(desc) + ' ' + name.toLowerCase();
      note = `Generic ${food.n.toLowerCase()} estimate — “${desc}” not specifically recognized`;
      generic = true;
    }
    if (r.rough) note = (note ? note + ' · ' : '') + `“${unit}” is a rough size for this food`;
    if (!note && !custom) {
      if (r.unit === food.u) note = food.serv ? `1 ${food.u}: ${food.serv}` : '';
      else if (!WEIGHT[r.unit]) note = `1 ${r.unit} ≈ ${N.fmtQty(WT.round(r.m, FR[WT.round(r.m % 1, 2)] ? 2 : 1))} ${N.unitLabel(food.u, r.m)}${food.serv ? ` (1 ${food.u}: ${food.serv})` : ''}`;
    }
    return {
      id: WT.uid(),
      text,
      name,
      qty,
      unit: r.unit,
      per: r.per,
      foodId: custom ? 'my:' + food.id : food.id,
      src: custom ? 'my' : 'db',
      generic,
      rough: r.rough,
      note,
      conf: custom ? 'user' : 'estimated',
      brand: brand ? brand.name : '',
      lookup: !!brand,
      phrase,
    };
  };

  /** Parse free text into items. Unknown items carry `unknown: true` and are never logged as-is. */
  N.parse = (text) => splitItems(text).map(N.parseItem);

  /** Re-interpret an item as a specific food (from a suggestion), keeping its quantity. */
  N.resolveAs = function (item, id, variant) {
    if (id.startsWith('p:') || id.startsWith('my:')) {
      const base = { text: item.text, qty: item.qty || 1, uw: item.uw || null, phrase: item.phrase || '' };
      return itemFromRef(id, base, variant) || item;
    }
    const custom = false;
    const food = custom ? N.myFood(id.slice(3)) : N.foodById(id);
    if (!food) return item;
    const r = perFor(food, custom, custom ? null : food.u, 1);
    return {
      id: item.id, text: item.text, name: custom ? food.name : food.n, qty: item.qty || (custom ? 1 : food.dq || 1), unit: r.unit, per: r.per,
      foodId: custom ? 'my:' + food.id : food.id, src: custom ? 'my' : 'db', generic: false, note: custom ? 'Your saved food' : food.serv || '', conf: 'estimated',
    };
  };

  /* ───────── Rounding (no false precision) ───────── */
  N.rp = (v) => Math.round(+v || 0); // protein: whole grams
  N.rcal = (v) => ((v = +v || 0) < 100 ? Math.round(v / 5) * 5 : Math.round(v / 10) * 10);
  N.rg = (v) => Math.round(+v || 0);
  N.itemTotals = (it) => ({ p: (it.per.p || 0) * it.qty, cal: (it.per.cal || 0) * it.qty, c: (it.per.c || 0) * it.qty, f: (it.per.f || 0) * it.qty });

  /* ───────── Dates ───────── */
  N.dayKey = (d) => {
    const x = d ? new Date(d) : new Date();
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };
  N.parseDay = (k) => {
    const [y, m, d] = String(k).split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  N.addDays = (k, n) => {
    const d = N.parseDay(k);
    d.setDate(d.getDate() + n);
    return N.dayKey(d);
  };
  N.validDay = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k || '') && !isNaN(N.parseDay(k));

  /* ───────── Store ───────── */
  N.fresh = () => ({ entries: [], foods: [] });
  N.normalize = function (n) {
    n = n && typeof n === 'object' ? n : N.fresh();
    n.entries = Array.isArray(n.entries) ? n.entries.filter((e) => e && typeof e === 'object' && N.validDay(e.date)) : [];
    n.foods = Array.isArray(n.foods) ? n.foods.filter((f) => f && typeof f === 'object' && f.name) : [];
    const fixPer = (o) => {
      o.per = o.per && typeof o.per === 'object' ? o.per : { p: 0, cal: 0, c: 0, f: 0 };
      // protein is always a number; a missing secondary macro stays null ("not on the label"), not 0
      ['p', 'cal', 'c', 'f'].forEach((k) => (o.per[k] = k !== 'p' && (o.per[k] == null || o.per[k] === '') ? null : +o.per[k] || 0));
      o.qty = +o.qty > 0 ? +o.qty : 1;
      o.unit = o.unit || 'serving';
    };
    const STATUSES = ['verified', 'user', 'estimated'];
    n.entries.forEach((e) => {
      fixPer(e);
      e.id = e.id || WT.uid();
      // v5: confidence. Older entries: generic estimates were 'db'; your own foods and manual values are yours.
      if (!STATUSES.includes(e.conf)) e.conf = e.src === 'db' || !e.src ? 'estimated' : 'user';
    });
    n.foods.forEach((f) => {
      fixPer(f);
      f.id = f.id || WT.uid();
      f.name = String(f.name);
      f.aliases = Array.isArray(f.aliases) ? f.aliases.map(String).filter((a) => a.trim()) : [];
      if (!STATUSES.includes(f.status)) f.status = 'user';
      ['brand', 'flavor', 'serving', 'cat'].forEach((k) => (f[k] = f[k] == null ? '' : String(f[k])));
      f.uses = +f.uses || 0;
      f.fav = !!f.fav;
    });
    return n;
  };
  const S = () => WT.db.nutrition;

  N.addItems = function (items, date) {
    const now = new Date();
    const today = N.dayKey(now);
    const at = date && date !== today ? new Date(N.parseDay(date).getTime() + 12 * 36e5).toISOString() : now.toISOString();
    const added = items.map((it) => ({
      id: WT.uid(), date: date || today, at, name: it.name, qty: WT.round(+it.qty || 1, 2), unit: it.unit || 'serving',
      per: Object.assign({ p: 0, cal: 0, c: 0, f: 0 }, it.per), foodId: it.foodId || null, src: it.src || 'manual', generic: !!it.generic, note: it.note || '', text: it.text || '',
      conf: it.conf || (it.src === 'db' ? 'estimated' : 'user'), brand: it.brand || '',
    }));
    S().entries.push(...added);
    WT.save();
    return added;
  };
  N.entry = (id) => S().entries.find((e) => e.id === id);
  N.updateEntry = function (id, patch) {
    const e = N.entry(id);
    if (!e) return null;
    Object.assign(e, patch);
    WT.save();
    return e;
  };
  N.deleteEntry = function (id) {
    S().entries = S().entries.filter((e) => e.id !== id);
    WT.save();
  };
  N.entriesFor = (date) => S().entries.filter((e) => e.date === date).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  N.dayTotals = function (date) {
    const list = N.entriesFor(date);
    const t = { p: 0, cal: 0, c: 0, f: 0, n: list.length };
    list.forEach((e) => {
      const x = N.itemTotals(e);
      t.p += x.p;
      t.cal += x.cal;
      t.c += x.c;
      t.f += x.f;
    });
    return t;
  };
  /** Last `days` days ending at `end` (inclusive). Days with no entries have logged:false — not "0 eaten". */
  N.range = function (days, end) {
    end = end || N.dayKey();
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = N.addDays(end, -i);
      const t = N.dayTotals(d);
      out.push({ date: d, p: t.p, cal: t.cal, n: t.n, logged: t.n > 0 });
    }
    return out;
  };
  N.trend = function (days, target, end) {
    const r = N.range(days, end);
    const logged = r.filter((d) => d.logged);
    const avg = logged.length ? logged.reduce((a, d) => a + d.p, 0) / logged.length : null;
    return { days: r, logged: logged.length, avg, reached: logged.filter((d) => d.p >= N.band(target).lo).length };
  };
  N.loggedDays = () => [...new Set(S().entries.map((e) => e.date))].sort().reverse();

  /* ───────── Target guidance (flexible, nonjudgmental) ───────── */
  N.band = (target) => ({ lo: Math.round((target * 0.9) / 5) * 5, hi: Math.round((target * 1.1) / 5) * 5 });
  N.guidance = function (total, target, n, isToday) {
    target = +target || 150;
    if (!n) return { state: 'empty', msg: isToday ? 'Nothing logged yet today. Add food whenever it’s convenient.' : 'Nothing logged for this day — it may just not have been tracked.' };
    const gap = target - total;
    const near = Math.max(15, target * 0.1);
    const g5 = Math.max(5, Math.round(gap / 5) * 5);
    if (gap > near) {
      if (!isToday) return { state: 'under', msg: `About ${g5} g under your target that day.` };
      const hint = gap <= 45 ? 'A Greek yogurt or protein shake could help.' : gap <= 80 ? 'A protein shake plus a Greek yogurt, or a chicken breast, would cover most of it.' : 'A couple of protein-rich meals or snacks would get you there — no need to make it all up at once.';
      return { state: 'under', msg: `You’re about ${g5} g short. ${hint}` };
    }
    if (gap > 0) return { state: 'near', msg: isToday ? 'You’re getting close. Another protein-rich snack would put you around your target.' : 'Close to your target that day.' };
    if (total <= target * 1.2) return { state: 'reached', msg: isToday ? 'You’ve reached your protein goal for today.' : 'Target reached that day.' };
    return { state: 'above', msg: isToday ? 'You’re comfortably above your target.' : 'Comfortably above your target that day.' };
  };

  /* ───────── Quick re-logging ───────── */
  N.recent = function (limit) {
    const seen = new Set();
    const favKeys = new Set(S().foods.filter((f) => f.fav).map((f) => f.name.toLowerCase()));
    const out = [];
    S().entries
      .slice()
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .forEach((e) => {
        const k = e.name.toLowerCase() + '|' + e.qty + '|' + e.unit;
        if (seen.has(k) || favKeys.has(e.name.toLowerCase()) || out.length >= (limit || 8)) return;
        seen.add(k);
        out.push(e);
      });
    return out;
  };
  N.saveFood = function (src, fav) {
    const name = String(src.name || '').trim();
    if (!name) return null;
    const existing = (src.id && S().foods.find((f) => f.id === src.id)) || S().foods.find((f) => f.name.toLowerCase() === name.toLowerCase());
    const data = { name, qty: WT.round(+src.qty || 1, 2), unit: src.unit || 'serving', per: Object.assign({ p: 0, cal: null, c: null, f: null }, src.per), fav: fav === undefined && existing ? existing.fav : fav !== false };
    ['brand', 'flavor', 'serving', 'cat', 'g', 'units', 'approx', 'key', 'productId', 'basedOn', 'source', 'checked'].forEach((k) => src[k] !== undefined && (data[k] = src[k]));
    ['brand', 'flavor', 'serving', 'cat'].forEach((k) => (data[k] = data[k] == null ? (existing && existing[k]) || '' : String(data[k])));
    data.status = src.status || (existing && existing.status) || 'user';
    data.aliases = [...new Set(((existing && existing.aliases) || []).concat(src.aliases || []).map((a) => String(a).trim().toLowerCase()).filter(Boolean))];
    if (existing) Object.assign(existing, data);
    else S().foods.push(Object.assign({ id: WT.uid(), createdAt: new Date().toISOString(), uses: 0 }, data));
    WT.save();
    return existing || S().foods[S().foods.length - 1];
  };
  /** Library copy of a bundled product, keeping its source, status and serving conversions. */
  function libFromProduct(x, variant) {
    return {
      name: N.productName(x, variant), brand: x.brand, flavor: variant || x.flavor || '', cat: x.cat, unit: x.unit, serving: x.serv, g: x.g, units: x.units, approx: x.approx,
      key: variant ? [] : x.key, per: { p: x.p, cal: x.cal, c: x.c, f: x.f }, qty: 1,
      productId: variant ? null : x.id, basedOn: variant ? x.id : undefined, status: variant ? 'estimated' : x.status,
      source: variant ? { name: `${N.productName(x)} values (estimate)`, url: x.src.url } : x.src, checked: variant ? undefined : x.checked,
    };
  }
  /**
   * After logging: keep branded products and your own entries in the library, so they're recognized next time.
   * `learn` adds the words you typed as an alias (after you picked a match), so the same words resolve directly.
   * Returns the library entry, or null for generic foods.
   */
  N.remember = function (it) {
    let lib = null;
    const ref = it.foodId || '';
    if (ref.startsWith('my:')) lib = S().foods.find((f) => f.id === ref.slice(3));
    else if (ref.startsWith('p:')) {
      const x = N.productById(ref.slice(2));
      if (!x) return null;
      lib = S().foods.find((f) => (it.variant ? f.basedOn === x.id && f.flavor.toLowerCase() === it.variant.toLowerCase() : f.productId === x.id));
      if (!lib) lib = N.saveFood(Object.assign(libFromProduct(x, it.variant), it.variant ? { aliases: [it.variant.toLowerCase()] } : {}), false);
    } else if (it.src === 'manual' && it.save !== false) lib = N.saveFood({ name: it.name, unit: it.unit, qty: it.qty, per: it.per, status: 'user', source: { name: 'Entered by you' } }, false);
    if (!lib) return null;
    if (it.learn && it.phrase && it.phrase.length > 2 && it.phrase !== lib.name.toLowerCase()) lib.aliases = [...new Set(lib.aliases.concat(it.phrase))];
    lib.uses = (lib.uses || 0) + 1;
    lib.lastUsed = new Date().toISOString();
    WT.save();
    return lib;
  };
  /** A corrected entry updates its library product too (now confirmed by you). */
  N.correctLibrary = function (e) {
    const ref = e.foodId || '';
    const lib = ref.startsWith('my:') && S().foods.find((f) => f.id === ref.slice(3));
    if (!lib) return null;
    const per = {};
    // stored per one library serving; the entry might be in another unit (e.g. tbsp of a cup)
    const k = e.unit === lib.unit ? 1 : (lib.units && lib.units[e.unit]) || null;
    if (!k) return null;
    MACROS.forEach((m) => (per[m] = e.per[m] == null ? null : WT.round(e.per[m] / k, 3)));
    lib.per = per;
    lib.status = 'user';
    lib.source = { name: 'Corrected by you' };
    WT.save();
    return lib;
  };

  /* ───────── Optional online lookup (Open Food Facts: free, no key, no account) ───────── */
  N.offUrl = (q) =>
    'https://world.openfoodfacts.org/cgi/search.pl?' +
    new URLSearchParams({ search_terms: q, search_simple: '1', action: 'process', json: '1', page_size: '12', fields: 'code,product_name,brands,quantity,serving_size,serving_quantity,nutriments' });
  N.fromOFF = function (p) {
    if (!p) return null;
    const n = p.nutriments || {};
    let g = +p.serving_quantity || null;
    const val = (k, suffix) => (n[k + suffix] == null || n[k + suffix] === '' ? null : +n[k + suffix]);
    const pick = (k) => (val(k, '_serving') != null ? val(k, '_serving') : val(k, '_100g') != null && g ? (val(k, '_100g') * g) / 100 : null);
    let per = { p: pick('proteins'), cal: pick('energy-kcal'), c: pick('carbohydrates'), f: pick('fat') };
    let serving = p.serving_size || (g ? `${g} g` : '');
    if (per.p == null && val('proteins', '_100g') != null) {
      per = { p: val('proteins', '_100g'), cal: val('energy-kcal', '_100g'), c: val('carbohydrates', '_100g'), f: val('fat', '_100g') };
      serving = '100 g';
      g = 100;
    }
    if (per.p == null || !p.product_name) return null;
    MACROS.forEach((k) => (per[k] = per[k] == null || isNaN(per[k]) ? null : WT.round(per[k], 1)));
    return {
      brand: String(p.brands || '').split(',')[0].trim(), name: String(p.product_name).trim(), serving, g, per, code: p.code,
      source: { kind: 'database', name: 'Open Food Facts', url: 'https://world.openfoodfacts.org/product/' + p.code },
    };
  };
  N.lookupOnline = async function (q) {
    if (typeof fetch !== 'function') throw new Error('Online lookup isn’t available here');
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => ctl && ctl.abort(), 9000);
    try {
      const r = await fetch(N.offUrl(q), ctl ? { signal: ctl.signal } : undefined);
      if (!r.ok) throw new Error('Lookup failed (' + r.status + ')');
      const j = await r.json();
      return (j.products || []).map(N.fromOFF).filter(Boolean);
    } finally {
      clearTimeout(timer);
    }
  };
  /** Local search across bundled products and your library (works offline). */
  N.searchLocal = function (q) {
    const C = ptoks(q).filter((t) => !STOP.has(t) || flavSet().has(t));
    if (!C.length) return [];
    const out = [];
    productIndex().forEach((d) => {
      const hits = C.filter((t) => d.all.has(t) || d.brand.includes(t) || [...d.all].some((a) => a.length > 3 && t.length > 2 && a.startsWith(t))).length;
      if (hits) out.push({ d, s: hits / C.length + (d.lib ? 0.1 : 0) });
    });
    return out.sort((a, b) => b.s - a.s).slice(0, 12).map((o) => Object.assign(N.candidateLabel(o.d), { brand: o.d.x.brand || '', lib: o.d.lib }));
  };
  N.deleteFood = function (id) {
    S().foods = S().foods.filter((f) => f.id !== id);
    WT.save();
  };
  /** Log a saved food (one tap) or repeat a past entry. */
  N.relog = function (src, date) {
    const lib = !!src.createdAt;
    const e = N.addItems([{ name: src.name, qty: src.qty, unit: src.unit, per: src.per, foodId: src.foodId || (lib ? 'my:' + src.id : null), src: lib ? 'my' : src.src, generic: src.generic, note: lib ? `${N.statusLabel(src.status)}${src.serving ? ' · 1 ' + src.unit + ' = ' + src.serving : ''}` : src.note, conf: lib ? src.status : src.conf, brand: src.brand || '' }], date)[0];
    if (lib) N.remember({ foodId: 'my:' + src.id });
    return e;
  };
})();
