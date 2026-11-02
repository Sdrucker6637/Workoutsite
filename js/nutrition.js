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
    const mine = ((WT.db && WT.db.nutrition && WT.db.nutrition.foods) || []).flatMap((f) => aliasEntries(f, true));
    return mine.concat(builtinIndex);
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
    let out = text.replace(protectedRe, (m) => m.replace(/\s+/g, '_'));
    // Your own foods may contain "and" too ("pb and banana toast")
    ((WT.db && WT.db.nutrition && WT.db.nutrition.foods) || []).forEach((f) => {
      const n = f.name.toLowerCase().replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();
      if (/\b(and|with)\b/.test(n)) out = out.split(n).join(n.replace(/ /g, '_'));
    });
    return out;
  }

  /* ───────── Text normalization ───────── */
  const FRAC = { '½': ' 1/2', '¼': ' 1/4', '¾': ' 3/4', '⅓': ' 1/3', '⅔': ' 2/3', '⅛': ' 1/8' };
  function normalize(text) {
    let t = ' ' + String(text || '').toLowerCase().replace(/[½¼¾⅓⅔⅛]/g, (c) => FRAC[c]) + ' ';
    t = t.replace(/[’`]/g, "'").replace(/\s*&\s*/g, ' and ').replace(/\bn'\b|\s'n'?\s/g, ' and ');
    t = t.replace(/\bpb\s*(and|&)\s*j\b/g, 'pbj');
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

  N.parseItem = function (raw) {
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
    const m = bestMatch(free.map((t) => t || '\u0000'));
    if (!m) {
      return { id: WT.uid(), text, unknown: true, qty: q.qty || 1, suggestions: N.suggest(text) };
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
    };
  };

  /** Parse free text into items. Unknown items carry `unknown: true` and are never logged as-is. */
  N.parse = (text) => splitItems(text).map(N.parseItem);

  /** Re-interpret an item as a specific food (from a suggestion), keeping its quantity. */
  N.resolveAs = function (item, id) {
    const custom = id.startsWith('my:');
    const food = custom ? N.myFood(id.slice(3)) : N.foodById(id);
    if (!food) return item;
    const r = perFor(food, custom, custom ? null : food.u, 1);
    return {
      id: item.id, text: item.text, name: custom ? food.name : food.n, qty: item.qty || (custom ? 1 : food.dq || 1), unit: r.unit, per: r.per,
      foodId: custom ? 'my:' + food.id : food.id, src: custom ? 'my' : 'db', generic: false, note: custom ? 'Your saved food' : food.serv || '',
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
      ['p', 'cal', 'c', 'f'].forEach((k) => (o.per[k] = +o.per[k] || 0));
      o.qty = +o.qty > 0 ? +o.qty : 1;
      o.unit = o.unit || 'serving';
    };
    n.entries.forEach((e) => {
      fixPer(e);
      e.id = e.id || WT.uid();
    });
    n.foods.forEach((f) => {
      fixPer(f);
      f.id = f.id || WT.uid();
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
    const existing = S().foods.find((f) => f.name.toLowerCase() === name.toLowerCase());
    const data = { name, qty: WT.round(+src.qty || 1, 2), unit: src.unit || 'serving', per: Object.assign({ p: 0, cal: 0, c: 0, f: 0 }, src.per), fav: fav !== false };
    if (existing) Object.assign(existing, data);
    else S().foods.push(Object.assign({ id: WT.uid(), createdAt: new Date().toISOString() }, data));
    WT.save();
    return existing || S().foods[S().foods.length - 1];
  };
  N.deleteFood = function (id) {
    S().foods = S().foods.filter((f) => f.id !== id);
    WT.save();
  };
  /** Log a saved food (one tap) or repeat a past entry. */
  N.relog = function (src, date) {
    return N.addItems([{ name: src.name, qty: src.qty, unit: src.unit, per: src.per, foodId: src.foodId || (src.createdAt ? 'my:' + src.id : null), src: src.createdAt ? 'my' : src.src, generic: src.generic, note: src.createdAt ? 'Your saved food' : src.note }], date)[0];
  };
})();
