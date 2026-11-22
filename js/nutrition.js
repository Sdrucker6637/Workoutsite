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
    jar: 'jar', dollop: 'dollop', drizzle: 'drizzle', knob: 'knob', ear: 'ear', cob: 'cob', bunch: 'bunch', pat: 'pat', order: 'serving',
  };
  const WEIGHT = { oz: 28.35, g: 1, lb: 453.6, kg: 1000 };
  // Rough fallback when a serving word isn't defined for a food (flagged as a rough guess)
  const GENERIC_UNIT = { jar: 4, dollop: 0.2, drizzle: 0.1, quarter: 0.25, serving: 1, piece: 1, bowl: 1.5, plate: 2, handful: 1, cup: 1, scoop: 1, package: 1, packet: 1, container: 1, can: 1, bottle: 1, glass: 1, slice: 1, half: 0.5, bag: 1.5, box: 2, pint: 2, quart: 4, spoon: 0.15, spoonful: 0.15, tbsp: 0.1, tsp: 0.04, splash: 0.1, shot: 0.3 };
  const SIZE_WORDS = { thin: 0.75, thick: 1.4, small: 0.75, little: 0.75, mini: 0.6, medium: 1, regular: 1, normal: 1, large: 1.25, big: 1.25, huge: 1.5, giant: 1.5, jumbo: 1.5, xl: 1.5, heaping: 1.25, generous: 1.25 };
  // Descriptive words that don't change the estimate and shouldn't flag an item as "not recognized"
  const STOP = new Set(('of a an the some my i had ate eat eating also just about around approx approximately roughly like ish for at in on to from ' +
    'breakfast lunch dinner snack meal today tonight morning post pre workout leftover leftovers homemade home made fresh plain cooked grilled baked ' +
    'roasted fried scrambled boiled hard soft poached steamed sauteed sautéed pan seared raw lean extra boneless skinless skin on bone in organic ' +
    'nonfat non fat lowfat low fat fatfree free reduced full whole skim 1% 2% unsweetened sweetened vanilla chocolate strawberry plain original classic natural regular ' +
    'restaurant grocery store storebought bought deli-style cold hot iced warm cup-sized sized size serving-sized style stuff thing more another few couple').split(' '));
  // Flavors are fine as descriptors on generic items but are worth noting
  const INVARIANT = new Set(['shrimp', 'fish', 'hummus', 'couscous', 'asparagus', 'swiss', 'oz', 'lbs', 'pbs', 'gas', 'pancreas', 'nachos', 'chips', 'fries', 'oikos', 'ratio', 'molasses', 'brussels', 'peas', 'quinoa', 'grits', 'wheaties', 'cheerios', 'kodiak', 'dal', 'dhal', 'tbs', 'gelato', 'froyo', 'espresso', 'kirkland', 'chomps']);
  // Singular, plural-insensitive token form. Applied to aliases and input alike, so it only has to be consistent.
  // plurals of words whose singular ends in "ie" (veggies → veggie, not veggy)
  const IE_WORDS = new Set(['veggie', 'cookie', 'smoothie', 'brownie', 'pie', 'hoagie', 'calorie', 'birdie', 'pastie', 'cutie', 'rotie', 'sweetie', 'potpie', 'goodie', 'eggroll', 'frie']);
  function sing(w) {
    if (w.length <= 3 || INVARIANT.has(w) || /\d/.test(w)) return w;
    if (w === 'loaves') return 'loaf';
    if (w === 'halves') return 'half';
    if (w === 'knives') return 'knife';
    if (w.endsWith('ies')) return IE_WORDS.has(w.slice(0, -1)) ? w.slice(0, -1) : w.slice(0, -3) + 'y';
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
      .replace(/\.(?!\d)|(^|[^\d])\./g, '$1 ') // sentence periods, not decimals ("0.5")
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
      const ph = WT.FOODS.flatMap((f) => f.a).concat((WT.RECIPES || []).flatMap((r) => r.a), (WT.CHAINS || []).flatMap((c) => c.items.flatMap((i) => i.a))).filter((a) => /\b(and|with|n)\b/.test(a));
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
    // Lean percentages before fractions: "85/15", "93% lean", "90 percent lean", "80-20" → one token ("85lean")
    t = t.replace(/\b([5-9]\d)\s*%?\s*[\/-]\s*(\d{1,2})\s*%?(?=\s|$|,)/g, (m, a, b) => (+a + +b === 100 ? ` ${a}lean ` : m));
    t = t.replace(/\b([5-9]\d)\s*(?:%|percent)\s*(?:lean)?\b/g, ' $1lean ').replace(/\b([7-9]\d)\s+lean\b/g, ' $1lean ');
    // Common abbreviations, misspellings and shorthand
    t = t.replace(/\b(chx|chkn|chik|chiken|chicke)\b/g, 'chicken').replace(/\bevoo\b/g, 'olive oil').replace(/\bavo\b/g, 'avocado').replace(/\bbroc\b/g, 'broccoli')
      .replace(/\bprotien\b/g, 'protein').replace(/\bpotatoe\b/g, 'potato').replace(/\bchipolte\b/g, 'chipotle').replace(/\bsw(?:eet)?\.?\s+pot(?:ato)?\b/g, 'sweet potato')
      .replace(/\bgr(?:ou)?nd\b/g, 'ground').replace(/\bmcd\b/g, 'mcdonalds').replace(/\bpb\s*2\b/g, 'powdered peanut butter').replace(/\bgreek yog\b/g, 'greek yogurt').replace(/\byog\b/g, 'yogurt');
    // "from a grocery store rotisserie chicken", "from the deli", "from a restaurant": where it came from, not more food
    t = t.replace(/\b(?:from|at|out of)\s+(?:a|an|the|my)?\s*(?:local\s+)?(?:grocery\s+store|supermarket|store|deli|costco|sams club|walmart|kroger|whole foods|trader joes|grocery)\b/g, ' ');
    t = t.replace(/\b(?:from|at)\s+(?:a|an|the)?\s*(?:sit\s*down\s+)?restaurant\b/g, ' restaurant_style ');
    // Skin: "with skin" must not split the item; "without skin" / "no skin" mean skinless
    t = t.replace(/\bw\/(?=\s)/g, 'with').replace(/\bw\/o\b/g, 'without');
    t = t.replace(/\b(?:without|no|minus)\s+(?:the\s+)?skin\b|\bskin\s*(?:off|removed)\b|\bremoved\s+(?:the\s+)?skin\b/g, ' skinless ');
    t = t.replace(/\bwith\s+(?:the\s+)?skin(?:\s+on)?\b|\bskin[\s-]+on\b/g, ' skin_on ');
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
    t = t.replace(/\bthree\s+quarters?\s+(?:of\s+)?(?:a|an)?\b/g, '0.75 ').replace(/\b(?:a|one)\s+quarter\s+(?:of\s+)?(?:a|an)?\b/g, '0.25 ').replace(/\bquarter\s+(?:of\s+)?(?:a|an)\b/g, '0.25');
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
  /** All alias words present, in any order ("chicken thighs … rotisserie"); ranks below an in-order match. */
  function matchAny(itemToks, aliasToks) {
    if (aliasToks.length < 2) return null;
    const idx = [];
    for (const a of aliasToks) {
      const i = itemToks.findIndex((t, k) => t === a && !idx.includes(k));
      if (i < 0) return null;
      idx.push(i);
    }
    return { idx: idx.sort((x, y) => x - y), gaps: 2 };
  }
  function bestMatch(toks, withRecipes) {
    let best = null;
    for (const e of withRecipes ? index().concat(recipeIndex()) : index()) {
      if (e.toks.length > toks.length) continue;
      const m = matchAt(toks, e.toks) || matchAny(toks, e.toks);
      if (!m) continue;
      const score = e.toks.length * 10 - m.gaps * 3 + (e.custom ? 15 : 0) + (e.food.label ? 4 : 0) + (e.recipe ? 1 : 0);
      if (!best || score > best.score) best = { score, idx: m.idx, food: e.food, custom: e.custom, recipe: e.recipe };
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
          else if (t.length >= 4 && at.length >= 4 && lev(t, at) <= (t.length >= 6 ? 2 : 1)) s += 2;
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
    // (a brand with one product in this database may still make many others, so the brand alone never identifies it)
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
  const MACRO_NAME = { p: 'Protein', cal: 'Calories', c: 'Carbs', f: 'Fat' };
  function productPer(d, unitWord) {
    const x = d.x;
    const base = d.lib ? Object.assign({}, x.per) : { p: x.p, cal: x.cal, c: x.c, f: x.f };
    const estK = [];
    if (x.est) MACROS.forEach((k) => base[k] == null && x.est[k] != null && (base[k] = x.est[k]) != null && estK.push(k));
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
    return { per, unit, m, approx, rough, estK };
  }
  const STATUS_LABEL = { verified: 'Verified', reference: 'Reference data', user: 'Confirmed by you', estimated: 'Estimate' };
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
    if (pp.estK.length) notes.push(`${pp.estK.map((k) => MACRO_NAME[k]).join(', ')} estimated (not on the label checked)`);
    if (base.sizeWord && base.sizeWord !== 'medium') notes.push(`“${base.sizeWord}” ignored — one ${x.unit || 'serving'} is a fixed size`);
    return Object.assign({
      id: WT.uid(), text: base.text, name, qty: base.qty, unit: pp.unit, per: pp.per,
      foodId: (d.lib ? 'my:' : d.x.remote ? 'x:' : 'p:') + x.id, src: d.lib ? 'my' : d.x.remote ? 'online' : 'product', conf: pp.rough ? 'estimated' : status, brand: x.brand || '',
      note: notes.join(' · '), rough: pp.rough, phrase: base.phrase, match: pp.rough ? 'rough' : 'exact', assumed: base.assumed, estMacros: pp.estK,
    }, extra || {});
  }
  N.candidateLabel = function (c) {
    const d = c.d || c, x = d.x;
    const pp = productPer(d, null);
    const serv = d.lib ? x.serving : x.serv;
    const status = d.lib ? x.status || 'user' : x.status;
    return { id: (d.lib ? 'my:' : d.x.remote ? 'x:' : 'p:') + x.id, name: d.lib ? x.name : N.productName(x), serving: serv || `1 ${x.unit || 'serving'}`, p: pp.per.p, status };
  };
  /** Turn a chosen candidate (p:id / my:id) into an item, keeping the typed amount. */
  /** A record found online (USDA / Open Food Facts, via the lookup cache) shaped like a bundled product. */
  N.remoteProduct = function (id) {
    const rec = WT.lookup && WT.lookup.cached(id);
    if (!rec) return null;
    const s = WT.lookup.servingOf(rec);
    const units = {};
    if (s.unit === 'serving' && s.g > 0) units['100 g'] = WT.round(100 / s.g, 4);
    return {
      id: rec.id, remote: true, brand: rec.brand || '', line: rec.name, flavor: null, flavors: [], key: [], a: [], cat: '', unit: s.unit, serv: s.unit === '100 g' ? '100 g' : s.text, g: s.g || null,
      p: s.per.p, cal: s.per.cal, c: s.per.c, f: s.per.f, units, approx: [], status: rec.status, src: rec.source, checked: null, code: rec.code || '', dataType: rec.dataType || '',
    };
  };
  function itemFromRef(ref, base, variant) {
    const lib = ref.startsWith('my:');
    const x = lib ? LIB().find((f) => f.id === ref.slice(3)) : ref.startsWith('x:') ? N.remoteProduct(ref.slice(2)) : N.productById(ref.slice(2));
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
    // Macros for ONE `unit` of the food. Returns { per, unit, rough, m }.
    const base = custom ? food.per : { p: food.p, cal: food.cal, c: food.c, f: food.f };
    const baseUnit = custom ? food.unit || 'serving' : food.u;
    let m = 1, rough = false;
    if (!unit || unit === baseUnit) unit = baseUnit;
    else if (food.units && food.units[unit] != null) m = +food.units[unit];
    else if (WEIGHT[unit] && food.g) m = WEIGHT[unit] / food.g;
    else if (!custom && food.count === unit && food.countGrams && food.g) m = food.countGrams / food.g;
    else {
      m = GENERIC_UNIT[unit] != null ? GENERIC_UNIT[unit] : 1;
      rough = true;
    }
    m *= sizeMult || 1;
    const r = (v) => (v == null || v === '' ? null : WT.round((+v || 0) * m, 3));
    return { per: { p: r(base.p) || 0, cal: r(base.cal), c: r(base.c), f: r(base.f) }, unit, rough, m };
  }

  /* ───────── Restaurants ───────── */
  let chainIdx = null;
  function chains() {
    if (chainIdx) return chainIdx;
    chainIdx = (WT.CHAINS || []).map((ch) => ({
      ch,
      names: ch.a.map((a) => tokenize(a).map(sing)),
      items: ch.items.flatMap((it) => it.a.map((a) => ({ toks: tokenize(a.replace(/&/g, ' and ')).map(sing), it }))),
      formats: Object.entries(ch.formats || {}).flatMap(([k, fm]) => fm.a.map((a) => ({ toks: tokenize(a).map(sing), k, fm }))),
    }));
    return chainIdx;
  }
  N.chainById = (id) => (WT.CHAINS || []).find((c) => c.id === id);
  /** Chains named in these tokens → [{ c, idx:Set }] (contiguous alias match). */
  function chainsIn(toks) {
    const out = [];
    chains().forEach((c) => {
      let best = null;
      c.names.forEach((nt) => {
        for (let i = 0; i + nt.length <= toks.length; i++) {
          if (nt.every((t, k) => toks[i + k] === t) && (!best || nt.length > best.length)) best = Array.from({ length: nt.length }, (_, k) => i + k);
        }
      });
      if (best) out.push({ c, idx: new Set(best) });
    });
    return out;
  }
  /** Distinctive menu names recognized without the chain ("Big Mac", "Crunchwrap"). */
  let ownIdx = null;
  const ownIndex = () =>
    ownIdx || (ownIdx = chains().flatMap((c) => c.ch.items.filter((it) => Array.isArray(it.own)).flatMap((it) => it.own.map((a) => ({ toks: tokenize(a).map(sing), it, c })))));
  function bestIn(entries, toks, skip) {
    let best = null;
    entries.forEach((e) => {
      if (e.toks.length > toks.length) return;
      const m = matchAt(toks.map((t, i) => (skip && skip.has(i) ? '\u0000' : t)), e.toks);
      if (!m) return;
      const score = e.toks.length * 10 - m.gaps * 3;
      if (!best || score > best.score) best = { score, idx: m.idx, e };
    });
    return best;
  }
  const SIZE_NAMES = { small: 'Small', medium: 'Medium', large: 'Large' };
  function restPer(it, unit) {
    if (it.sizes) return it.sizes[unit] || it.sizes[it.def || 'medium'];
    if (unit === 'half' && it.half) return it.half;
    return it.m;
  }
  /** Units a restaurant item can be switched between in the review screen. */
  function restUnits(it) {
    if (it.sizes) return Object.keys(it.sizes).filter((k, i, a) => !(it.sizeNames && a.findIndex((x) => it.sizeNames[x] === it.sizeNames[k]) !== i));
    if (it.six) return ['6-inch', 'footlong'];
    if (it.half) return ['whole', 'half'];
    return [it.unit || 'serving'];
  }
  function restItem(c, it, opts) {
    const ch = c.ch || c;
    let unit = opts.unit || (it.sizes ? it.def || 'medium' : it.six ? '6-inch' : it.half ? 'whole' : it.unit || 'serving');
    let m = restPer(it, unit);
    if (it.six && unit === 'footlong') m = m.map((v) => v * 2);
    const per = { cal: m[0], p: m[1], c: m[2], f: m[3] };
    const sizeLabel = it.sizes ? (it.sizeNames && it.sizeNames[unit]) || SIZE_NAMES[unit] || unit : it.six ? (unit === 'footlong' ? 'Footlong' : '6-inch') : it.half && unit === 'half' ? 'Half' : '';
    const status = it.st || ch.status;
    const notes = [`${ch.name} ${status === 'reference' ? 'published values' : 'approximate values'}`];
    if (it.serv) notes.push(it.serv);
    if (ch.note && it.six) notes.push(ch.note);
    if (opts.ctx) notes.push(`${ch.name} portion (named earlier in your description)`);
    if (opts.mod) notes.push(opts.mod);
    return {
      id: WT.uid(), text: opts.text, name: `${it.n.startsWith(ch.name) ? '' : ch.name + ' '}${it.n}${sizeLabel && it.sizes ? ` (${sizeLabel})` : sizeLabel ? ` (${sizeLabel})` : ''}`, qty: WT.round(opts.qty || 1, 2),
      unit: it.sizes || it.six || it.half ? unit : it.unit || 'serving', per, foodId: `r:${ch.id}:${it.id}`, src: 'restaurant', conf: status, brand: ch.name,
      note: notes.join(' · '), match: 'exact', phrase: opts.phrase, assumed: opts.assumed, partOf: opts.partOf || '',
    };
  }
  N.restaurantRef = function (ref) {
    const [, cid, iid] = String(ref).split(':');
    const ch = N.chainById(cid);
    const it = ch && ch.items.find((x) => x.id === iid);
    return it ? { ch, it } : null;
  };
  /** Try to read an item as a menu item of chain `c`. Returns an item, an item with parts, or null. */
  function parseChain(c, ctx) {
    const { toks, rawToks, q, base, skip, sizeWord, viaContext } = ctx;
    const ch = c.ch;
    const used = new Set(skip);
    const im = bestIn(c.items, toks, used);
    if (im) im.idx.forEach((i) => used.add(i));
    const fm = ch.formats ? bestIn(c.formats, toks, used) : null;
    if (fm) fm.idx.forEach((i) => used.add(i));
    // own-name match like "Big Mac" with the chain omitted
    if (!im && !fm) return null;
    // In context only (chain named earlier), require that most words are explained by the menu
    const left = toks.filter((t, i) => !used.has(i) && !q.used.has(i) && !STOP.has(t) && !UNIT_WORDS[t] && !SIZE_WORDS[t] && !WT.PORTION_MODS[t] && t !== 'soft' && !/^\d/.test(t));
    if (viaContext && left.length) return null;
    if (!im && left.length) return null; // "Chipotle quinoa bowl": a format plus something not on the menu
    let mult = 1;
    const mods = [];
    toks.forEach((t, i) => {
      if (used.has(i) || WT.PORTION_MODS[t] == null || t === 'side') return;
      if (t === 'half' && im && im.e.it.half) return;
      mult *= WT.PORTION_MODS[t];
      mods.push(t);
    });
    const it = im && im.e.it;
    let unit = null;
    if (it && it.sizes) unit = (sizeWord && (it.sizes[sizeWord] ? sizeWord : null)) || toks.map((t) => it.sizeWords && it.sizeWords[t]).find(Boolean) || null;
    if (it && it.six && base.sizeMult >= 2) unit = 'footlong';
    if (it && it.half && toks.includes('half')) unit = 'half';
    const typedQty = q.qty != null ? q.qty * q.mult : null;
    const phrase = base.phrase;
    const common = { text: base.text, ctx: viaContext, phrase };
    const items = [];
    if (it) {
      let qty = typedQty != null ? typedQty : 1;
      let per = null;
      if (it.count) {
        qty = typedQty != null ? typedQty : it.dq || 1;
        if (it.packs && it.packs[qty]) {
          const pk = it.packs[qty];
          per = { cal: pk[0] / qty, p: pk[1] / qty, c: pk[2] / qty, f: pk[3] / qty };
        }
      }
      const item = restItem(c, it, Object.assign({}, common, { qty: qty * (fm ? 1 : mult), unit, mod: mods.length && !fm ? `${mods.join(' ')} portion (×${mult})` : '', assumed: typedQty == null && !!it.count }));
      if (per) item.per = per;
      if (it.count && it.packs && it.packs[qty]) item.note += ` · ${qty}-piece published value`;
      if (fm) {
        const n = typedQty || 1;
        const adds = (toks.includes('soft') && fm.e.fm.soft) || fm.e.fm.adds;
        adds.forEach(([iid, k]) => {
          const bi = ch.items.find((x) => x.id === iid);
          if (bi) items.push(restItem(c, bi, Object.assign({}, common, { qty: k * n, partOf: `${ch.name} ${fm.e.k}` })));
        });
        item.qty = WT.round(n * mult, 2);
        if (mods.length) item.note += ` · ${mods.join(' ')} (×${mult})`;
        item.partOf = `${ch.name} ${fm.e.k}`;
      }
      items.push(item);
    } else {
      const n = typedQty || 1;
      ((toks.includes('soft') && fm.e.fm.soft) || fm.e.fm.adds).forEach(([iid, k]) => {
        const bi = ch.items.find((x) => x.id === iid);
        if (bi) items.push(restItem(c, bi, Object.assign({}, common, { qty: k * n, partOf: `${ch.name} ${fm.e.k}` })));
      });
      if (!items.length) return { id: WT.uid(), text: base.text, unknown: true, suggestions: [], hint: `Which ${ch.name} ${fm.e.k}? Add the protein and toppings, e.g. “${ch.name} chicken ${fm.e.k} with rice and beans”.`, qty: n, phrase };
      items[items.length - 1].note += ' · Add your protein and toppings as separate items';
    }
    if (items.length === 1) return Object.assign(items[0], { chainId: ch.id });
    return { id: WT.uid(), text: base.text, parts: items, chainId: ch.id, partOf: items[0].partOf };
  }

  /* ───────── Recipes (homemade dishes → components) ───────── */
  let recipeIdx = null;
  const recipeIndex = () => recipeIdx || (recipeIdx = (WT.RECIPES || []).flatMap((r) => r.a.map((a) => ({ toks: tokenize(a.replace(/&/g, ' and ')).map(sing), food: r, recipe: true }))));
  N.recipeById = (id) => (WT.RECIPES || []).find((r) => r.id === id);
  function expandRecipe(r, qty, base) {
    const parts = [];
    r.parts.forEach((p) => {
      const it = N.parseItem(p, { generic: true, noRecipe: true, noLearn: true });
      if (it.unknown || it.ambiguous || it.parts) return;
      it.qty = WT.round(it.qty * qty, 2);
      it.partOf = r.n;
      it.match = 'rough';
      it.conf = 'estimated';
      it.note = `Part of “${r.n}” · ${/\brestaurant/.test(base.text) ? 'restaurant version: portions and dressing vary, so this is a homemade-style estimate' : 'typical homemade portion'}${it.note ? ' · ' + it.note : ''}`;
      it.text = base.text;
      it.recipe = r.id;
      parts.push(it);
    });
    return { id: WT.uid(), text: base.text, parts, recipe: r.id, partOf: r.n, phrase: base.phrase };
  }

  /* ───────── Personalization: learned matches & usual portions ───────── */
  const NS = () => (WT.db && WT.db.nutrition) || {};
  /** The words that identify an item (no amounts, units or filler) — the key for learned corrections. */
  N.phraseKey = function (text) {
    const toks = tokenize(normalize(text)).map(sing);
    return toks.filter((t) => !/^\d/.test(t) && !UNIT_WORDS[t] && !SIZE_WORDS[t] && !/^(a|an|the|of|some|my|i|had|ate)$/.test(t)).join(' ');
  };
  N.learn = function (text, ref) {
    const k = N.phraseKey(text);
    if (!k || !ref) return;
    NS().learned = NS().learned || {};
    NS().learned[k] = { ref, at: new Date().toISOString() };
  };
  N.forget = (text) => NS().learned && delete NS().learned[N.phraseKey(text)];
  N.rememberPortion = function (ref, qty, unit) {
    if (!ref || !(qty > 0)) return;
    NS().portions = NS().portions || {};
    NS().portions[ref] = { qty: WT.round(qty, 2), unit, at: new Date().toISOString() };
  };
  N.usualPortion = (ref) => (NS().portions || {})[ref] || null;
  function applyUsual(it, typed) {
    if (typed || !it || it.unknown || it.ambiguous || it.parts) return it;
    const u = N.usualPortion(it.foodId);
    if (!u) return it;
    const r = N.reunit(it, u.unit);
    if (!r) return it;
    r.qty = u.qty;
    r.assumed = false;
    r.usual = true;
    r.note = `Your usual amount${r.note ? ' · ' + r.note : ''}`;
    return r;
  }

  /* Typo tolerance: a word we don't know that is 1–2 letters from a food word is read as that word (and said so). */
  let VOCAB = null;
  function vocab() {
    if (VOCAB) return VOCAB;
    VOCAB = new Set();
    const add = (s) => ptoks(s).forEach((t) => t.length >= 3 && VOCAB.add(t));
    WT.FOODS.forEach((f) => f.a.forEach(add));
    (WT.RECIPES || []).forEach((r) => r.a.forEach(add));
    (WT.PRODUCTS || []).forEach((x) => [x.brand, x.line, x.flavor].concat(x.flavors || [], x.a || [], x.key || []).forEach((v) => v && add(v)));
    (WT.CHAINS || []).forEach((c) => c.a.concat(c.items.flatMap((i) => i.a)).forEach(add));
    (WT.FLAVOR_WORDS || []).forEach(add);
    Object.keys(WT.FOOD_BRANDS || {}).forEach(add);
    return VOCAB;
  }
  function correctTypos(toks) {
    const V = vocab();
    const lib = new Set(LIB().flatMap((f) => [f.name, f.brand || ''].concat(f.aliases || []).flatMap(ptoks)));
    const fixes = [];
    const out = toks.map((t) => {
      if (t.length < 5 || /\d/.test(t) || V.has(t) || lib.has(t) || STOP.has(t) || N.unitWord(t) || SIZE_WORDS[t] != null || WT.PORTION_MODS[t] != null) return t;
      let best = null;
      V.forEach((v) => {
        if (Math.abs(v.length - t.length) > 2 || v[0] !== t[0]) return;
        const d = lev(t, v);
        if (d <= (t.length >= 7 ? 2 : 1) && (!best || d < best.d)) best = { v, d };
      });
      if (!best) return t;
      fixes.push([t, best.v]);
      return best.v;
    });
    return { toks: out, fixes };
  }

  N.parseItem = function (raw, opts) {
    opts = opts || {};
    const text = raw.trim();
    let sizeMult = 1;
    let pre = text.replace(/\b(\d+)\s*(?:-\s*)?(?:inch|in|")(?=\s|$)/g, (m, n) => {
      sizeMult *= +n >= 10 ? 2 : 1; // a 12-inch / footlong sub is about two 6-inch subs
      return ' ';
    });
    // "a 3-egg omelet", "2 egg scramble": the number counts eggs in one dish, not dishes
    pre = pre.replace(/\b(\d+)[\s-]*eggs?\s+(omelet|omelette|scramble)\b/g, (m, n, d) => {
      sizeMult *= +n / 3;
      return `1 ${d}`;
    });
    if (/\bfoot\s*long\b|\bfootlong\b/.test(pre)) {
      sizeMult *= 2;
      pre = pre.replace(/\bfoot\s*long\b|\bfootlong\b/g, ' ');
    }
    let rawToks = tokenize(pre);
    let toks = rawToks.map(sing);
    const typo = correctTypos(toks);
    if (typo.fixes.length) {
      toks = typo.toks;
      rawToks = rawToks.map((w, i) => (typo.toks[i] !== typo.toks[i] || typo.fixes.some(([a]) => a === sing(w)) ? typo.toks[i] : w));
    }
    const q = readQty(toks);
    const free = toks.map((t, i) => (q.used.has(i) ? null : t));
    let uw = null;
    free.forEach((t) => t && !uw && N.unitWord(t) && (uw = N.unitWord(t)));
    const sizeWord = free.find((t) => t && SIZE_WORDS[t] != null) || null;
    const FL = flavSet();
    const content = free.filter((t) => t && (!STOP.has(t) || FL.has(t)));
    // what was typed, minus the amount: kept as shorthand once you confirm a match ("shake", "bar" stay — they're part of the name)
    const measure = (t) => N.unitWord(t) && !(WT.PRODUCT_CATS || {})[t];
    const phrase = rawToks.filter((w, i) => free[i] && !measure(free[i]) && !/^\d/.test(w) && !/^(a|an|the|of|some|my)$/.test(w)).join(' ');
    const typedAmount = q.qty != null || !!uw;
    const base = { text, qty: WT.round((q.qty != null ? q.qty : 1) * q.mult, 2), uw, phrase, sizeWord, sizeMult, assumed: !typedAmount };
    // 0. A correction you made before ("my shake" → the product you picked)
    if (!opts.noLearn && !opts.generic) {
      const L = (NS().learned || {})[N.phraseKey(text)];
      if (L) {
        const r = N.resolveAs(Object.assign({ id: WT.uid() }, base, { unit: uw }), L.ref);
        if (r && !r.unknown && r.foodId) {
          if (!typedAmount) {
            const u = applyUsual(r, false);
            if (u !== r) return Object.assign(u, { match: 'exact', learned: true, phrase });
          }
          r.qty = base.qty;
          r.note = `Matched the way you corrected it before${r.note ? ' · ' + r.note : ''}`;
          return Object.assign(r, { match: 'exact', learned: true, phrase, assumed: !typedAmount });
        }
      }
    }
    // 1. Branded products and your library
    const pm = opts.generic ? null : N.matchProducts(content);
    if (pm && pm.pick) return applyUsual(productItem(pm.pick, base), typedAmount);
    // 2. Restaurant menus: the chain named in this item, or earlier in the description
    if (!opts.generic) {
      const named = chainsIn(toks);
      const skip = new Set();
      named.forEach((n) => n.idx.forEach((i) => skip.add(i)));
      const ctxs = named.length ? named : opts.chain ? chains().filter((c) => c.ch.id === opts.chain).map((c) => ({ c, via: true })) : [];
      for (const n of ctxs) {
        const r = parseChain(n.c, { toks, rawToks, q, base, skip, sizeWord, viaContext: !!n.via });
        if (r) return r.parts ? r : applyUsual(r, typedAmount);
      }
      if (named.length) {
        // The chain was named but the item isn't on our menu: say so, never invent a menu value
        const ch = named[0].c.ch;
        const fb = N.parseItem(raw.replace(new RegExp(ch.a.map((a) => a.replace(/ /g, '[\\s-]*')).join('|'), 'ig'), ' '), { generic: true });
        if (!fb.unknown && !fb.parts) {
          fb.note = `Not on our ${ch.name} menu · generic ${fb.name.toLowerCase()} estimate${fb.note ? ' · ' + fb.note : ''}`;
          fb.match = 'rough';
          fb.conf = 'estimated';
          fb.brand = ch.name;
          fb.text = text;
          fb.chainId = ch.id;
          return fb;
        }
      }
      // distinctive menu names on their own ("Big Mac", "Crunchwrap Supreme")
      const own = bestIn(ownIndex(), toks);
      if (own) {
        const g = bestMatch(free.map((t) => t || '\u0000'));
        if (!g || g.idx.length <= own.idx.length) {
          const r = parseChain(own.e.c, { toks, rawToks, q, base, skip: new Set(), sizeWord, viaContext: false });
          if (r) return r.parts ? r : applyUsual(r, typedAmount);
        }
      }
    }
    if (pm && pm.ambiguous) {
      const top = { brand: pm.brand };
      // name the flavor as typed: "cookies and cream", not just the word no product explains ("cream")
      const flavorish = pm.unexplained.some((t) => FL.has(t));
      const variant = pm.unexplained.length ? titleCase(rawToks.filter((w, i) => pm.unexplained.includes(toks[i]) || (flavorish && FL.has(toks[i]))).join(' ')) : '';
      const fb = N.parseItem(raw, { generic: true }); // a generic estimate is always an option
      return Object.assign({ id: WT.uid(), ambiguous: true, candidates: pm.ambiguous.map(N.candidateLabel), variant, brand: top.brand || '', fallback: fb.unknown || fb.parts ? null : fb }, base);
    }
    // 3. Homemade recipes and generic foods
    const m = bestMatch(free.map((t) => t || '\u0000'), !opts.noRecipe);
    if (!m) {
      return Object.assign({ id: WT.uid(), unknown: true, suggestions: N.suggest(text) }, base);
    }
    if (m.recipe) {
      const n = q.qty != null ? q.qty * q.mult : 1;
      return expandRecipe(m.food, n, base);
    }
    const food = m.food, custom = m.custom;
    const matched = new Set(m.idx);
    const aliasWords = new Set(m.idx.map((i) => toks[i]));
    let unit = null, unitIdx = -1, sizeUsed = '';
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
        if (!custom && food.sizes && food.sizes[t] && food.g) {
          sizeMult *= food.sizes[t] / food.g;
          sizeUsed = t;
        } else if (!food.fixed && !custom) sizeMult *= SIZE_WORDS[t];
        return;
      }
      if (t === 'fl' || t === 'ml') return;
      if (STOP.has(t) || STOP.has(rawToks[i])) return;
      if (aliasWords.has(t)) return; // "chicken thighs … rotisserie chicken": a repeated word adds nothing
      extras.push(rawToks[i]);
    });
    // A bare count uses the food's counting unit ("10 shrimp", "20 almonds")
    if (!unit && q.qty != null && !custom && food.count) unit = food.count;
    let qty = q.qty != null ? q.qty : q.mult !== 1 || unitIdx >= 0 || custom ? 1 : food.dq || 1;
    qty = WT.round(qty * q.mult, 2);
    // a named size describes the base unit ("a large potato"), not a cup of it
    const r = perFor(food, custom, unit, unit && unit !== (custom ? food.unit : food.u) && sizeUsed ? sizeMult / (food.sizes[sizeUsed] / food.g) : sizeMult);
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
      if (sizeUsed && r.unit === food.u) note = `${sizeUsed} ${food.u} ≈ ${food.sizes[sizeUsed]} g`;
      else if (r.unit === food.u) note = food.serv ? `1 ${food.u}: ${food.serv}` : '';
      else if (!WEIGHT[r.unit]) note = `1 ${r.unit} ≈ ${food.g && food.units && food.units[r.unit] ? Math.round(food.units[r.unit] * food.g) + ' g' : `${N.fmtQty(WT.round(r.m, FR[WT.round(r.m % 1, 2)] ? 2 : 1))} ${N.unitLabel(food.u, r.m)}`}${food.serv ? ` (1 ${food.u}: ${food.serv})` : ''}`;
    }
    const st = custom ? 'user' : food.st === 'reference' ? 'reference' : 'estimated';
    const item = {
      id: WT.uid(), text, name, qty, unit: r.unit, per: r.per, foodId: custom ? 'my:' + food.id : food.id, src: custom ? 'my' : 'db', generic, rough: r.rough, note,
      conf: generic ? 'estimated' : st, brand: brand ? brand.name : '', lookup: !!brand, phrase, sizeMult: sizeMult, sizeWord: sizeUsed,
      match: custom ? 'exact' : generic || r.rough ? 'rough' : 'close', assumed: !typedAmount,
    };
    if (!typedAmount && food.dq && !custom) item.note = `Amount assumed (${N.fmtAmount(qty, r.unit)})${item.note ? ' · ' + item.note : ''}`;
    return applyUsual(item, typedAmount);
  };

  /** Parse free text into items. Unknown items carry `unknown: true` and are never logged as-is.
   * A chain named once ("Chipotle bowl with rice, beans…") applies to the rest of the description.
   * Recipes and build-your-own restaurant orders come back as separate, editable components. */
  N.parse = function (text) {
    let chain = null;
    const out = [];
    splitItems(text).forEach((t, n) => {
      const r = withTypoNote(N.parseItem(t, { chain }), t);
      if (r.chainId) chain = r.chainId;
      const list = r.parts ? r.parts : [r];
      list.forEach((it, i) => {
        it.key = list.length > 1 ? `${t}#${i}` : t;
        it.text = it.text || t;
        out.push(it);
      });
    });
    return out;
  };

  function withTypoNote(r, t) {
    const fixes = correctTypos(tokenize(normalize(t)).map(sing)).fixes;
    if (!fixes.length) return r;
    const note = `Read ${fixes.map(([a, b]) => `“${a}” as “${b}”`).join(', ')}`;
    (r.parts || [r]).forEach((it) => {
      if (it.unknown || it.ambiguous) return;
      it.note = note + (it.note ? ' · ' + it.note : '');
      if (it.match === 'exact') it.match = 'close'; // a guess about what you meant is never an exact match
      it.typo = fixes;
    });
    return r;
  }

  /* ───────── Units: what an item can be measured in, and switching between them ───────── */
  function resolveRef(ref) {
    ref = String(ref || '');
    if (ref.startsWith('r:')) return { kind: 'r', r: N.restaurantRef(ref) };
    if (ref.startsWith('p:') || ref.startsWith('x:')) {
      const x = ref.startsWith('x:') ? N.remoteProduct(ref.slice(2)) : N.productById(ref.slice(2));
      return x ? { kind: 'p', x, d: describe(x, false) } : null;
    }
    if (ref.startsWith('my:')) {
      const x = LIB().find((f) => f.id === ref.slice(3));
      return x ? { kind: 'my', x, d: describe(x, true) } : null;
    }
    const f = N.foodById(ref);
    return f ? { kind: 'db', f } : null;
  }
  /** Serving words this item can switch to (base unit first, then portions, then weights). */
  N.unitsFor = function (it) {
    const r = resolveRef(it && it.foodId);
    let list = [];
    if (!r) list = [it.unit];
    else if (r.kind === 'r') list = r.r ? restUnits(r.r.it) : [it.unit];
    else if (r.kind === 'db') list = [r.f.u].concat(Object.keys(r.f.units || {}), r.f.g ? ['g', 'oz'] : []);
    else {
      const x = r.x;
      list = [x.unit || 'serving'].concat(Object.keys(x.units || {}), x.g ? ['g', 'oz'] : []);
    }
    return [...new Set(list.concat(it.unit ? [it.unit] : []).filter(Boolean))];
  };
  /** The same item measured in another unit. Keeps the amount equivalent when it can (1 cup → 158 g). */
  N.reunit = function (it, unit) {
    const r = resolveRef(it && it.foodId);
    if (!r || !unit) return null;
    const out = Object.assign({}, it, { per: Object.assign({}, it.per) });
    const oldCal = it.per && it.per.cal, oldP = it.per && it.per.p;
    if (r.kind === 'r') {
      if (!r.r) return null;
      const fresh = restItem(r.r.ch, r.r.it, { text: it.text, qty: it.qty, unit, phrase: it.phrase, partOf: it.partOf });
      return Object.assign(out, { per: fresh.per, unit: fresh.unit, name: fresh.name });
    }
    let per, m;
    if (r.kind === 'db') {
      const pf = perFor(r.f, false, unit, unit === r.f.u ? it.sizeMult || 1 : 1);
      if (pf.rough) return null;
      per = pf.per;
      m = pf.m;
      out.rough = false;
    } else {
      const pp = productPer(r.d, unit);
      if (pp.rough) return null;
      per = pp.per;
      m = pp.m;
      out.approx = pp.approx;
    }
    // equivalent amount: same calories (or protein when calories are unknown)
    const ref = oldCal > 0 && per.cal > 0 ? oldCal / per.cal : oldP > 0 && per.p > 0 ? oldP / per.p : null;
    if (ref && it.qty && unit !== it.unit) {
      const q = it.qty * ref;
      out.qty = unit === 'g' ? Math.max(1, Math.round(q)) : unit === 'oz' ? Math.max(0.1, WT.round(q, 1)) : Math.max(0.25, Math.round(q * 4) / 4);
    }
    out.per = per;
    out.unit = unit;
    out.m = m;
    if (out.edited && it.per) {
      // a value you typed scales with the unit change
      ['p', 'cal', 'c', 'f'].forEach((k) => it.per[k] != null && per[k] != null && it.per[k] !== per[k] && (out.per[k] = it.per[k] * (it.qty / out.qty)));
    }
    return out;
  };

  /** Re-interpret an item as a specific food (from a suggestion, a search, or a correction), keeping its amount. */
  N.resolveAs = function (item, id, variant) {
    if (id.startsWith('p:') || id.startsWith('my:') || id.startsWith('x:')) {
      const base = { text: item.text, qty: item.qty || 1, uw: item.uw || null, phrase: item.phrase || '' };
      const it = itemFromRef(id, base, variant);
      if (!it) return item;
      it.match = 'exact';
      return keepUnit(it, item);
    }
    if (id.startsWith('r:')) {
      const rr = N.restaurantRef(id);
      if (!rr) return item;
      const it = restItem(rr.ch, rr.it, { text: item.text, qty: item.qty || (rr.it.count ? rr.it.dq || 1 : 1), phrase: item.phrase || '' });
      return Object.assign(it, { id: item.id || it.id, key: item.key });
    }
    const food = N.foodById(id);
    if (!food) return item;
    const r = perFor(food, false, food.u, 1);
    const it = {
      id: item.id || WT.uid(), key: item.key, text: item.text, name: food.n, qty: item.qty && !item.unknown ? item.qty : food.dq || item.qty || 1, unit: r.unit, per: r.per,
      foodId: food.id, src: 'db', generic: false, note: food.serv ? `1 ${food.u}: ${food.serv}` : '', conf: food.st === 'reference' ? 'reference' : 'estimated', phrase: item.phrase || '',
      match: food.st === 'reference' ? 'close' : 'rough',
    };
    return keepUnit(it, item);
  };
  function keepUnit(it, prev) {
    if (!prev || !prev.unit || prev.unit === it.unit || prev.unknown) return it;
    const u = N.reunit(Object.assign({}, it, { per: Object.assign({}, it.per) }), prev.unit);
    if (!u) return it;
    u.qty = prev.qty; // the typed amount was in this unit
    return u;
  }

  /** How sure the match is, for the review screen. */
  N.confidence = function (it) {
    if (!it || it.unknown || it.ambiguous) return { level: 'none', label: 'Needs a match' };
    if (it.src === 'manual') return { level: 'high', label: 'Your numbers' };
    if (it.match === 'exact' && it.conf !== 'estimated' && !(it.estMacros && it.estMacros.length)) return { level: 'high', label: it.learned ? 'Your match' : 'Exact match' };
    if (it.match === 'exact' || it.match === 'close') return { level: 'medium', label: it.match === 'exact' ? 'Exact item · estimated values' : 'Close match' };
    return { level: 'low', label: 'Rough estimate' };
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
  N.MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snack', 'Snacks']];
  N.mealName = (k) => (N.MEALS.find((m) => m[0] === k) || [k, 'Snacks'])[1];
  /** The meal a time of day most likely belongs to. */
  N.mealAt = function (d) {
    const h = new Date(d || Date.now()).getHours() + new Date(d || Date.now()).getMinutes() / 60;
    return h >= 4 && h < 10.5 ? 'breakfast' : h >= 10.5 && h < 15 ? 'lunch' : h >= 17 && h < 22 ? 'dinner' : 'snack';
  };
  N.fresh = () => ({ entries: [], foods: [], meals: [], learned: {}, portions: {} });
  const STATUSES = ['verified', 'reference', 'user', 'estimated'];
  const MEAL_KEYS = ['breakfast', 'lunch', 'dinner', 'snack'];
  N.normalize = function (n) {
    n = n && typeof n === 'object' ? n : N.fresh();
    n.entries = Array.isArray(n.entries) ? n.entries.filter((e) => e && typeof e === 'object' && N.validDay(e.date)) : [];
    n.foods = Array.isArray(n.foods) ? n.foods.filter((f) => f && typeof f === 'object' && f.name) : [];
    n.meals = Array.isArray(n.meals) ? n.meals.filter((m) => m && typeof m === 'object' && m.name && Array.isArray(m.items)) : [];
    n.learned = n.learned && typeof n.learned === 'object' && !Array.isArray(n.learned) ? n.learned : {};
    n.portions = n.portions && typeof n.portions === 'object' && !Array.isArray(n.portions) ? n.portions : {};
    const fixPer = (o) => {
      o.per = o.per && typeof o.per === 'object' ? o.per : { p: 0, cal: 0, c: 0, f: 0 };
      // protein is always a number; a missing secondary macro stays null ("not on the label"), not 0
      ['p', 'cal', 'c', 'f'].forEach((k) => (o.per[k] = k !== 'p' && (o.per[k] == null || o.per[k] === '') ? null : +o.per[k] || 0));
      o.qty = +o.qty > 0 ? +o.qty : 1;
      o.unit = o.unit || 'serving';
    };
    n.entries.forEach((e) => {
      fixPer(e);
      e.id = e.id || WT.uid();
      // v5: confidence. Older entries: generic estimates were 'db'; your own foods and manual values are yours.
      if (!STATUSES.includes(e.conf)) e.conf = e.src === 'db' || !e.src ? 'estimated' : 'user';
      // v6: meal category (older entries: from the time they were logged) and the group logged together
      if (!MEAL_KEYS.includes(e.meal)) e.meal = N.mealAt(e.at || N.parseDay(e.date).getTime() + 12 * 36e5);
      if (!e.group) e.group = e.id;
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
    n.meals.forEach((m) => {
      m.id = m.id || WT.uid();
      m.name = String(m.name);
      m.items.forEach(fixPer);
      m.items = m.items.filter((i) => i && i.name);
      if (!MEAL_KEYS.includes(m.meal)) m.meal = '';
      m.uses = +m.uses || 0;
      m.fav = !!m.fav;
    });
    return n;
  };
  const S = () => WT.db.nutrition;

  const entryFields = (it) => ({
    name: String(it.name || '').trim() || 'Food', qty: WT.round(+it.qty || 1, 2), unit: it.unit || 'serving', per: Object.assign({ p: 0, cal: null, c: null, f: null }, it.per),
    foodId: it.foodId || null, src: it.src || 'manual', generic: !!it.generic, note: it.note || '', text: it.text || '',
    conf: STATUSES.includes(it.conf) ? it.conf : it.src === 'db' ? 'estimated' : 'user', brand: it.brand || '', match: it.match || '', partOf: it.partOf || '',
  });
  N.addItems = function (items, date, meal, group) {
    const now = new Date();
    const today = N.dayKey(now);
    const at = date && date !== today ? new Date(N.parseDay(date).getTime() + 12 * 36e5).toISOString() : now.toISOString();
    const m = MEAL_KEYS.includes(meal) ? meal : N.mealAt(now);
    const g = group || WT.uid();
    const added = items.map((it) => Object.assign({ id: WT.uid(), date: date || today, at, meal: m, group: g }, entryFields(it)));
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
  N.entriesFor = (date, meal) => S().entries.filter((e) => e.date === date && (!meal || e.meal === meal)).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const sumOf = (list) => {
    const t = { p: 0, cal: 0, c: 0, f: 0, n: list.length, missing: 0 };
    list.forEach((e) => {
      const x = N.itemTotals(e);
      t.p += x.p;
      t.cal += x.cal;
      t.c += x.c;
      t.f += x.f;
      if (e.per.cal == null) t.missing++;
    });
    return t;
  };
  N.sumItems = sumOf;
  N.dayTotals = (date) => sumOf(N.entriesFor(date));
  N.mealTotals = (date, meal) => sumOf(N.entriesFor(date, meal));
  /** Copy entries (a whole meal, or a single item) to a day and meal. */
  N.copyEntries = function (ids, date, meal) {
    const src = ids.map(N.entry).filter(Boolean);
    if (!src.length) return [];
    return N.addItems(src.map((e) => Object.assign({}, e, { per: Object.assign({}, e.per) })), date, meal || src[0].meal);
  };
  /** Last `days` days ending at `end` (inclusive). Days with no entries have logged:false — not "0 eaten". */
  N.range = function (days, end) {
    end = end || N.dayKey();
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = N.addDays(end, -i);
      const t = N.dayTotals(d);
      out.push({ date: d, p: t.p, cal: t.cal, c: t.c, f: t.f, n: t.n, logged: t.n > 0 });
    }
    return out;
  };
  N.trend = function (days, target, end) {
    const r = N.range(days, end);
    const logged = r.filter((d) => d.logged);
    const avg = (k) => (logged.length ? logged.reduce((a, d) => a + d[k], 0) / logged.length : null);
    const t = N.targets();
    return {
      days: r, logged: logged.length, avg: avg('p'), avgCal: avg('cal'), avgC: avg('c'), avgF: avg('f'),
      reached: logged.filter((d) => d.p >= N.band(target || t.p).lo).length,
      calOk: t.cal ? logged.filter((d) => Math.abs(d.cal - t.cal) <= t.cal * 0.1).length : null,
    };
  };
  N.loggedDays = () => [...new Set(S().entries.map((e) => e.date))].sort().reverse();

  /** Daily targets. Protein is set directly; carbs and fat follow from calories unless set. Null = not set. */
  N.targets = function () {
    const p = WT.db.profile;
    const prot = Math.max(1, +p.proteinTarget || 150);
    const cal = +p.calorieTarget > 0 ? +p.calorieTarget : null;
    const rest = cal ? Math.max(0, cal - prot * 4) : null;
    return {
      cal, p: prot,
      c: +p.carbTarget > 0 ? +p.carbTarget : rest != null ? Math.round((rest * 0.55) / 4 / 5) * 5 : null,
      f: +p.fatTarget > 0 ? +p.fatTarget : rest != null ? Math.round((rest * 0.45) / 9 / 5) * 5 : null,
      derived: { c: !(+p.carbTarget > 0), f: !(+p.fatTarget > 0) },
    };
  };

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
    ['brand', 'flavor', 'serving', 'cat', 'g', 'units', 'approx', 'key', 'productId', 'basedOn', 'source', 'checked', 'code', 'remoteId'].forEach((k) => src[k] !== undefined && (data[k] = src[k]));
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
    } else if (ref.startsWith('x:')) {
      const x = N.remoteProduct(ref.slice(2));
      if (!x) return null;
      lib = S().foods.find((f) => f.remoteId === x.id || (x.code && f.code && WT.lookup.sameCode(f.code, x.code)));
      // generic USDA foods stay in the lookup cache; branded products become yours so typing their name finds them
      if (!lib && (x.brand || x.code)) lib = N.saveFood({ name: `${x.brand ? x.brand + ' ' : ''}${x.line}`.trim(), brand: x.brand, unit: x.unit, serving: x.serv, g: x.g || undefined, units: x.units, per: { p: x.p, cal: x.cal, c: x.c, f: x.f }, qty: 1, status: x.status, source: x.src, code: x.code, remoteId: x.id, checked: N.dayKey() }, false);
      if (!lib) return null;
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
  N.relog = function (src, date, meal) {
    const lib = !!src.createdAt;
    const e = N.addItems([{ name: src.name, qty: src.qty, unit: src.unit, per: src.per, foodId: src.foodId || (lib ? 'my:' + src.id : null), src: lib ? 'my' : src.src, generic: src.generic, note: lib ? `${N.statusLabel(src.status)}${src.serving ? ' · 1 ' + src.unit + ' = ' + src.serving : ''}` : src.note, conf: lib ? src.status : src.conf, brand: src.brand || '', match: 'exact' }], date, meal)[0];
    if (lib) N.remember({ foodId: 'my:' + src.id });
    return e;
  };

  /* ───────── Habits: frequent foods, frequent meals, saved meals ───────── */
  const entryKey = (e) => (e.foodId ? e.foodId + '|' : '') + String(e.name).toLowerCase();
  /** Foods you log most (last 60 days), with your most common amount. */
  N.frequent = function (limit, exclude) {
    const since = N.addDays(N.dayKey(), -60);
    const by = new Map();
    S().entries.forEach((e) => {
      if (e.date < since || e.partOf) return; // recipe / build-your-own parts show up as whole meals instead
      const k = entryKey(e);
      const o = by.get(k) || { n: 0, last: e, amounts: new Map() };
      o.n++;
      if (String(e.at) > String(o.last.at)) o.last = e;
      const ak = e.qty + '|' + e.unit;
      const a = o.amounts.get(ak) || { n: 0, e };
      a.n++;
      o.amounts.set(ak, a);
      by.set(k, o);
    });
    const ex = exclude || new Set();
    return [...by.values()]
      .filter((o) => o.n >= 2 && !ex.has(o.last.name.toLowerCase()))
      .sort((a, b) => b.n - a.n || String(b.last.at).localeCompare(String(a.last.at)))
      .slice(0, limit || 8)
      .map((o) => {
        const top = [...o.amounts.values()].sort((a, b) => b.n - a.n)[0].e; // your most common amount
        return Object.assign({}, top, { count: o.n });
      });
  };
  /** Combinations you log together repeatedly ("your usual breakfast"). */
  N.frequentMeals = function (limit) {
    const groups = new Map();
    S().entries.forEach((e) => {
      const g = groups.get(e.group) || [];
      g.push(e);
      groups.set(e.group, g);
    });
    const sig = new Map();
    groups.forEach((list) => {
      if (list.length < 2) return;
      const k = list.map((e) => e.name.toLowerCase()).sort().join(' + ');
      const o = sig.get(k) || { n: 0, last: list, meal: list[0].meal };
      o.n++;
      if (String(list[0].at) > String(o.last[0].at)) o.last = list;
      sig.set(k, o);
    });
    const saved = new Set(S().meals.map((m) => m.items.map((i) => i.name.toLowerCase()).sort().join(' + ')));
    return [...sig.entries()]
      .filter(([k, o]) => o.n >= 2 && !saved.has(k))
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, limit || 3)
      .map(([k, o]) => ({ key: k, count: o.n, meal: o.meal, items: o.last, name: o.last.map((e) => e.name).slice(0, 3).join(', ') + (o.last.length > 3 ? '…' : '') }));
  };
  const mealItem = (e) => ({ name: e.name, qty: e.qty, unit: e.unit, per: Object.assign({}, e.per), foodId: e.foodId || null, src: e.src, conf: e.conf, brand: e.brand || '', note: e.note || '', match: e.match || 'exact', partOf: e.partOf || '' });
  N.saveMeal = function (name, items, meal) {
    name = String(name || '').trim();
    if (!name || !items.length) return null;
    const existing = S().meals.find((m) => m.name.toLowerCase() === name.toLowerCase());
    const data = { name, items: items.map(mealItem), meal: MEAL_KEYS.includes(meal) ? meal : '' };
    if (existing) Object.assign(existing, data);
    else S().meals.push(Object.assign({ id: WT.uid(), createdAt: new Date().toISOString(), uses: 0, fav: false }, data));
    WT.save();
    return existing || S().meals[S().meals.length - 1];
  };
  N.mealById = (id) => S().meals.find((m) => m.id === id);
  N.logMeal = function (id, date, meal) {
    const m = N.mealById(id);
    if (!m) return [];
    m.uses = (m.uses || 0) + 1;
    m.lastUsed = new Date().toISOString();
    return N.addItems(m.items.map((i) => Object.assign({}, i, { per: Object.assign({}, i.per), note: `From “${m.name}”${i.note ? ' · ' + i.note : ''}` })), date, meal || m.meal || undefined);
  };
  N.deleteMeal = function (id) {
    S().meals = S().meals.filter((m) => m.id !== id);
    WT.save();
  };

  /* ───────── Search everything (review → "Replace", Search foods) ─────────
   * Score = how much of the query a result covers (exact or prefix words; a 1-letter typo counts half),
   * plus bonuses for an exact name, a named brand or restaurant, and your own foods.
   * Naming a brand or a restaurant puts its products first ("oikos" → Oikos's yogurts, not generic yogurt).
   */
  N.searchAll = function (q, limit) {
    const C = tokenize(normalize(q).replace(/_/g, ' ')).map(sing).filter((t) => !STOP.has(t) || flavSet().has(t));
    if (!C.length) return [];
    const cover = (words) => {
      const W = new Set(words);
      let hit = 0, exact = 0;
      C.forEach((t) => {
        if (W.has(t)) {
          hit++;
          exact++;
        } else if (t.length >= 3 && [...W].some((w) => w.length > 3 && w.startsWith(t))) hit++;
        else if (t.length >= 5 && [...W].some((w) => w.length >= 5 && lev(t, w) <= 1)) hit += 0.5;
      });
      return { f: hit / C.length, exact };
    };
    const joined = C.join(' ');
    // brands and chains named in the query
    const brandsNamed = new Set();
    LIB().concat(WT.PRODUCTS || []).forEach((x) => {
      const bt = ptoks(x.brand || '');
      if (bt.length && bt.every((t) => C.includes(t))) brandsNamed.add(String(x.brand).toLowerCase());
    });
    const chainsNamed = new Set(chains().filter((c) => c.names.some((n) => n.every((t) => C.includes(t)))).map((c) => c.ch.id));
    const out = [];
    const push = (o, words, extra) => {
      const cv = cover(words);
      if (!cv.exact && cv.f < 1) return;
      if (cv.f < 0.5) return;
      out.push(Object.assign(o, { s: cv.f * 2 + (extra || 0) }));
    };
    // your foods & bundled products
    LIB().forEach((x) => {
      const words = [x.name, x.brand, x.flavor].concat(x.aliases || []).filter(Boolean).flatMap(ptoks);
      const named = x.brand && brandsNamed.has(String(x.brand).toLowerCase());
      push(Object.assign(N.candidateLabel(describe(x, true)), { kind: 'Your foods', brand: x.brand || '', lib: true, cal: x.per.cal }), words, 0.6 + (named ? 1 : 0));
    });
    const shadow = new Set(LIB().map((f) => f.productId).filter(Boolean));
    (WT.PRODUCTS || []).filter((x) => !shadow.has(x.id)).forEach((x) => {
      const words = [x.brand, x.line, x.flavor].concat(x.flavors || [], x.a || [], x.key || []).filter(Boolean).flatMap(ptoks);
      const named = brandsNamed.has(String(x.brand).toLowerCase());
      if (brandsNamed.size && !named) return; // another brand was asked for
      const lab = N.candidateLabel(describe(x, false));
      push(Object.assign(lab, { kind: 'Branded', brand: x.brand, cal: x.cal != null ? x.cal : x.est && x.est.cal != null ? x.est.cal : null }), words, 0.4 + (named ? 1.2 : 0));
    });
    // restaurants: a chain on its own lists its menu
    chains().forEach((c) => {
      const named = chainsNamed.has(c.ch.id);
      if (chainsNamed.size && !named) return;
      const rest = C.filter((t) => !c.names.some((n) => n.includes(t)));
      c.ch.items.forEach((it, i) => {
        const words = it.a.flatMap((a) => tokenize(a).map(sing)).concat(tokenize(it.n).map(sing), named ? c.names.flat() : []);
        const m = restPer(it, it.sizes ? it.def || 'medium' : null);
        const o = { id: `r:${c.ch.id}:${it.id}`, kind: 'Restaurant', name: `${it.n.startsWith(c.ch.name) ? '' : c.ch.name + ' '}${it.n}`, brand: c.ch.name, serving: it.serv || (it.sizes ? (it.sizeNames && it.sizeNames[it.def || 'medium']) || 'Medium' : '1 serving'), p: m[1], cal: m[0], status: it.st || c.ch.status };
        if (named && !rest.length) out.push(Object.assign(o, { s: 2.5 - i * 0.01 }));
        else push(o, words, named ? 1.2 : -0.2);
      });
    });
    // found online before (works offline)
    if (WT.lookup) WT.lookup.searchCache(q, 10).forEach((rec, i) => {
      const sv = WT.lookup.servingOf(rec);
      const named = rec.brand && [...brandsNamed].some((b) => rec.brand.toLowerCase().includes(b));
      push({ id: 'x:' + rec.id, kind: 'Found online before', name: `${rec.brand ? rec.brand + ' ' : ''}${rec.name}`, brand: rec.brand, serving: sv.text, p: sv.per.p, cal: sv.per.cal, status: rec.status, remote: rec }, ptoks(`${rec.brand} ${rec.name}`), 0.3 + (named ? 1 : 0) - i * 0.01);
    });
    // the offline USDA database, when built (tools/build-usda.js)
    if (WT.lookup && WT.lookup.offlineDB()) WT.lookup.searchOffline(q, 10).forEach((rec, i) => {
      const sv = WT.lookup.servingOf(rec);
      push({ id: 'x:' + rec.id, kind: 'USDA reference (offline)', name: rec.name, brand: '', serving: sv.text, p: sv.per.p, cal: sv.per.cal, status: 'reference', remote: rec }, ptoks(rec.name), -0.15 - i * 0.01 - (brandsNamed.size || chainsNamed.size ? 1 : 0));
    });
    // generic foods (brand searches still show the generic option, lower down)
    WT.FOODS.forEach((f) => {
      const exactName = f.a.some((a) => ptoks(a).join(' ') === joined);
      push({ id: f.id, kind: f.st === 'reference' ? 'USDA reference' : 'Generic estimate', name: f.n, brand: '', serving: `1 ${f.u}${f.g ? ` (${Math.round(f.g)} g)` : ''}`, p: f.p, cal: f.cal, status: f.st === 'reference' ? 'reference' : 'estimated' },
        f.a.flatMap((a) => ptoks(a)).concat(ptoks(f.n)), (exactName ? 1 : 0) + (f.st === 'reference' ? 0.1 : 0) - (brandsNamed.size || chainsNamed.size ? 1 : 0));
    });
    const seen = new Set();
    return out.sort((a, b) => b.s - a.s).filter((r) => !seen.has(r.id) && seen.add(r.id)).slice(0, limit || 20);
  };
})();
