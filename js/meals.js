/* Meal planner: your kitchen (ingredients with nutrition data), and an offline recipe generator.
 *
 * Ingredients come from js/ingredients.js (built-in database + offline estimator). Recipes are composed, not
 * picked from a list: a dish FORMAT (skillet, stir-fry, sheet pan, soup, tacos…) × a FLAVOR profile (Cajun,
 * Korean-style, lemon-herb, curry…) × the ingredients you picked, cooked according to each ingredient's own
 * cooking profile. Every step is written through a builder that records which ingredients it mentions, so a
 * recipe can only refer to ingredients it lists (checked again by scanning the finished text). Nutrition is
 * calculated from the quantity of each ingredient used. Everything runs on the device.
 */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const M = (WT.meals = WT.meals || {});
  const ING = WT.ING;
  const join = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  M.CATS = ING.CATS;
  M.SCHEMA = 2;

  /* ═════════════════════ STORE ═════════════════════ */
  const DEFAULT_KITCHEN = () => ING.DB.filter((x) => x.def).map((x) => x.id);
  const DEFAULT_PREFS = () => ({
    diets: [], disliked: [],
    // Avoid list (words): pre-set from your stated preferences — corn, cornstarch and flour are left out of
    // pantry additions (potato starch is used instead). Remove any of them in Preferences.
    dislikedText: ['corn', 'cornstarch', 'flour'],
    airFryer: true, servings: 2, maxTime: 0, styles: [], mealType: 'any', protein: true, practical: true,
  });
  M.fresh = () => ({ schema: M.SCHEMA, kitchen: DEFAULT_KITCHEN(), custom: [], overrides: {}, selected: [], unavailable: [], staples: [], usage: {}, favorites: [], recent: [], prefs: DEFAULT_PREFS() });
  const arr = (a) => (Array.isArray(a) ? a : []);
  const CAT_OK = (c) => !!ING.CATS[c];

  /** Normalise (and upgrade) a meals store. Idempotent; never drops custom ingredients, saved recipes or prefs. */
  M.normalize = function (m) {
    m = m && typeof m === 'object' ? m : {};
    const out = Object.assign(M.fresh(), m);
    ['selected', 'unavailable', 'staples', 'favorites', 'recent', 'custom', 'kitchen'].forEach((k) => (out[k] = arr(m[k] === undefined ? out[k] : m[k])));
    out.usage = m.usage && typeof m.usage === 'object' ? m.usage : {};
    out.overrides = m.overrides && typeof m.overrides === 'object' ? m.overrides : {};
    const hadPrefs = m.prefs && typeof m.prefs === 'object';
    out.prefs = Object.assign(DEFAULT_PREFS(), hadPrefs ? m.prefs : {});
    ['diets', 'disliked', 'dislikedText', 'styles'].forEach((k) => (out.prefs[k] = arr(out.prefs[k])));
    if (!(m.schema >= 2)) upgradeFrom1(out, m, hadPrefs);
    out.favorites = out.favorites.filter((x) => x && x.key && x.name);
    out.custom = out.custom.filter((x) => x && x.id && x.name).map(fixCustom);
    const known = (id) => !!(ING.get(id) || out.custom.some((x) => x.id === id));
    out.kitchen = [...new Set(out.kitchen.filter(known))];
    out.schema = M.SCHEMA;
    return out;
  };
  /**
   * Schema 1 (first meal planner) → 2: custom ingredients gain full nutrition (your entered protein / calories
   * are kept and marked as yours; anything missing is estimated from the name), built-in renames become
   * overrides, and every ingredient you had selected, starred or marked out of stock joins your kitchen.
   */
  function upgradeFrom1(out, m, hadPrefs) {
    const old = arr(m.custom);
    out.custom = old.filter((x) => x && x.id && x.name).map((x) => {
      const cat = { protein: 'protein', carb: 'carb', veg: 'veg' }[x.cat] || 'other';
      const est = ING.estimate(x.name, cat);
      const rec = customFromEstimate(x.name, cat, est, x.id);
      rec.tags = [...new Set(rec.tags.concat(arr(x.tags)))];
      const per = x.per && typeof x.per === 'object' ? x.per : null;
      if (per && (per.p != null || per.cal != null)) {
        // Old values were "per serving" with no size: keep them, take the estimate's serving as the size
        const fields = [];
        if (per.p != null && per.p !== '') (rec.macros.p = +per.p || 0), fields.push('p');
        if (per.cal != null && per.cal !== '') (rec.macros.cal = +per.cal || 0), fields.push('cal');
        rec.status = 'user';
        rec.fields = fields;
        rec.source = 'Your values' + (fields.length < 4 ? ' (others estimated)' : '');
      }
      rec.createdAt = x.createdAt || new Date().toISOString();
      return rec;
    });
    Object.entries(m.edits || {}).forEach(([id, e]) => {
      if (e && e.name && ING.get(id)) out.overrides[id] = Object.assign({}, out.overrides[id] || {}, { name: String(e.name) });
    });
    out.kitchen = [...new Set(DEFAULT_KITCHEN().concat(out.custom.map((x) => x.id), arr(m.selected), arr(m.unavailable), arr(m.staples), arr((m.prefs || {}).disliked)))];
    // Existing avoid words are kept exactly; the corn/flour defaults are only added for a store that had none
    if (hadPrefs && arr(m.prefs.dislikedText).length) out.prefs.dislikedText = arr(m.prefs.dislikedText);
    out.recent = [];
  }
  function customFromEstimate(name, cat, est, id) {
    const c = CAT_OK(cat) ? cat : est.cat === 'pantry' ? 'other' : est.cat;
    const sameCat = est.cat === c || (est.cat === 'pantry' && c === 'other');
    return {
      id: id || 'ing-' + WT.uid(), name: String(name).trim(), cat: c,
      kind: sameCat ? est.kind : ING.CLASS[c].kind,
      tags: (est.tags || []).slice(), serving: Object.assign({}, est.serving), macros: Object.assign({}, est.macros),
      status: est.status, source: est.source, note: est.note || '', base: est.base, confidence: est.confidence,
      precooked: !!est.precooked, meal: est.meal || 1, pantryId: est.pantryId || null, productId: est.productId || null,
      fields: [], createdAt: new Date().toISOString(),
    };
  }
  function fixCustom(x) {
    if (!CAT_OK(x.cat)) x.cat = 'other';
    if (!x.serving || !(+x.serving.n > 0)) x.serving = Object.assign({}, ING.estimate(x.name, x.cat).serving);
    if (!x.macros) x.macros = Object.assign({}, ING.estimate(x.name, x.cat).macros);
    ['cal', 'p', 'c', 'f'].forEach((k) => (x.macros[k] = +x.macros[k] || 0));
    x.tags = arr(x.tags);
    x.fields = arr(x.fields);
    x.kind = x.kind || ING.CLASS[x.cat].kind;
    x.status = ['estimated', 'user', 'verified'].includes(x.status) ? x.status : 'estimated';
    x.meal = +x.meal || 1;
    return x;
  }
  const S = () => (WT.db.meals = WT.db.meals && WT.db.meals.schema >= 2 ? WT.db.meals : M.normalize(WT.db.meals));
  M.store = S;

  /* ═════════════════════ INGREDIENTS ═════════════════════ */
  /** The ingredient as recipes and the UI see it: database or custom record, with your corrections applied. */
  M.get = function (id) {
    const st = S();
    const c = st.custom.find((x) => x.id === id);
    if (c) return Object.assign({}, c, { custom: true });
    const x = ING.get(id);
    if (!x) return null;
    const pantry = x.cat === 'pantry';
    const o = st.overrides[id] || {};
    const base = {
      id, name: o.name || x.name, cat: pantry ? 'other' : x.cat, kind: x.kind, tags: (x.tags || []).slice(),
      serving: Object.assign({}, x.serving, o.serving || {}), macros: Object.assign(ING.servingMacros(x), o.macros || {}),
      status: o.macros ? 'user' : 'estimated', source: o.macros ? 'Your values' : `Typical values for ${x.name.toLowerCase()}${x.label ? ` (${x.label})` : ''}`,
      note: x.note || '', label: x.label || '', base: id, builtin: true, precooked: !!x.precooked, meal: x.meal || 1, one: x.one, plural: x.plural, pantryId: pantry ? id : null,
      fields: o.fields || [],
    };
    // A changed serving size without new label values keeps the same nutrition density
    if (o.serving && !o.macros && o.serving.g && x.serving.g) {
      const k = o.serving.g / x.serving.g;
      base.macros = scaleMacros(ING.servingMacros(x), k);
    }
    return base;
  };
  const scaleMacros = (m, k) => Object.fromEntries(Object.entries(m).map(([key, v]) => [key, v == null ? null : Math.round(v * k * 10) / 10]));
  M.kitchen = () => S().kitchen.map(M.get).filter(Boolean);
  M.all = M.kitchen;
  const words = (s) => ING.norm(s).split(' ').filter(Boolean);
  const avoidWords = () => S().prefs.dislikedText.map((w) => ING.singAll(w)).filter(Boolean);
  const matchesAvoid = (name, tags) => {
    const n = ' ' + ING.singAll(name) + ' ';
    return avoidWords().find((w) => n.includes(' ' + w + ' ') || (tags || []).includes(w)) || null;
  };
  M.unavailable = (id) => S().unavailable.includes(id);
  M.disliked = (id) => S().prefs.disliked.includes(id);
  M.DIETS = {
    vegetarian: { name: 'Vegetarian', no: ['meat', 'poultry', 'fish', 'shellfish'] },
    pescatarian: { name: 'Pescatarian', no: ['meat', 'poultry'] },
    'dairy-free': { name: 'Dairy-free', no: ['dairy'] },
    'gluten-free': { name: 'Gluten-free', no: ['gluten'] },
    'egg-free': { name: 'Egg-free', no: ['egg'] },
    'shellfish-free': { name: 'No shellfish', no: ['shellfish'] },
    'soy-free': { name: 'Soy-free', no: ['soy'] },
    'nut-free': { name: 'Nut-free', no: ['nut', 'peanut'] },
    'no-pork': { name: 'No pork', no: ['pork'] },
    'low-carb': { name: 'Lower carb', no: [], lowCarb: true },
  };
  const blocked = () => {
    const out = new Set();
    S().prefs.diets.forEach((d) => (M.DIETS[d] ? M.DIETS[d].no : []).forEach((t) => out.add(t)));
    return out;
  };
  M.lowCarb = () => S().prefs.diets.includes('low-carb');
  /** Why an ingredient can't be used right now (null when it can). */
  M.blockReason = function (ing) {
    if (!ing) return 'Unknown';
    if (M.unavailable(ing.id)) return 'Out of stock';
    if (M.disliked(ing.id)) return 'Disliked';
    const no = blocked();
    const t = (ing.tags || []).find((x) => no.has(x));
    if (t) return 'Not ' + Object.values(M.DIETS).find((d) => d.no.includes(t) && S().prefs.diets.some((k) => M.DIETS[k] === d)).name.toLowerCase();
    const w = matchesAvoid(ing.name, ing.tags);
    if (w) return `You avoid ${w}`;
    return null;
  };
  M.usable = (ing) => !M.blockReason(ing);
  M.dietConflict = (ing) => {
    const r = M.blockReason(ing);
    return r && r.startsWith('Not ') ? r.slice(4) : null;
  };

  M.toggleSelect = function (id) {
    const st = S();
    if (st.selected.includes(id)) st.selected = st.selected.filter((x) => x !== id);
    else {
      if (!st.kitchen.includes(id)) st.kitchen.push(id);
      st.selected.push(id);
      st.usage[id] = (+st.usage[id] || 0) + 1;
    }
    WT.save();
  };
  M.toggleUnavailable = function (id) {
    const st = S();
    if (st.unavailable.includes(id)) st.unavailable = st.unavailable.filter((x) => x !== id);
    else {
      st.unavailable.push(id);
      st.selected = st.selected.filter((x) => x !== id);
    }
    WT.save();
  };
  M.toggleStaple = function (id) {
    const st = S();
    st.staples = st.staples.includes(id) ? st.staples.filter((x) => x !== id) : st.staples.concat(id);
    WT.save();
  };
  M.toggleDisliked = function (id) {
    const pr = S().prefs;
    pr.disliked = pr.disliked.includes(id) ? pr.disliked.filter((x) => x !== id) : pr.disliked.concat(id);
    S().selected = S().selected.filter((x) => !pr.disliked.includes(x));
    WT.save();
  };
  /** Kitchen ingredients of one category: staples first, then alphabetical. Each appears once. */
  M.sorted = function (cat) {
    const st = S();
    return M.kitchen()
      .filter((x) => x.cat === cat)
      .sort((a, b) => st.staples.includes(b.id) - st.staples.includes(a.id) || a.name.localeCompare(b.name));
  };
  /** Kitchen search (what you have). */
  M.search = function (q) {
    const t = ING.singAll(q);
    if (!t) return null;
    return M.kitchen().filter((x) => (' ' + ING.singAll(x.name)).includes(' ' + t) || ING.singAll(x.name).includes(t));
  };
  /** Database + food diary search for ingredients not in your kitchen yet. */
  M.addable = function (q) {
    const st = S();
    const inK = new Set(st.kitchen);
    const db = ING.search(q, 10).filter((x) => !inK.has(x.id)).map((x) => ({ type: 'db', id: x.id, name: x.name, cat: x.cat, label: x.label || '', macros: ING.servingMacros(x), serving: x.serving }));
    const t = ING.singAll(q);
    const kNames = new Set(M.kitchen().map((x) => ING.singAll(x.name)));
    const diary = ((WT.db.nutrition && WT.db.nutrition.foods) || [])
      .filter((f) => !f.ingredientId && t && ING.singAll(f.name).includes(t) && !kNames.has(ING.singAll(f.name)))
      .slice(0, 4)
      .map((f) => ({ type: 'diary', id: f.id, name: f.name, label: f.serving || '', macros: { cal: f.per.cal, p: f.per.p, c: f.per.c, f: f.per.f } }));
    return db.concat(diary);
  };
  M.addToKitchen = function (id) {
    const st = S();
    if (!M.get(id)) return null;
    if (!st.kitchen.includes(id)) st.kitchen.push(id);
    if (!st.selected.includes(id)) M.toggleSelect(id);
    WT.save();
    return M.get(id);
  };
  M.removeFromKitchen = function (id) {
    const st = S();
    st.kitchen = st.kitchen.filter((x) => x !== id);
    ['selected', 'unavailable', 'staples'].forEach((k) => (st[k] = st[k].filter((x) => x !== id)));
    WT.save();
  };
  /** Preview the automatic estimate for a name (what "Add" would store). */
  M.preview = (name, cat) => ING.estimate(name, cat || null);

  /**
   * Add or edit an ingredient. form: { id?, name, cat?, serving?: {n, unit, g, state}, macros?: {cal,p,c,f,fiber,sugar}, tags? }
   * - A new custom ingredient gets automatic estimated nutrition from its name. Any label values you enter
   *   replace the estimate for those fields and mark it as yours.
   * - Editing a built-in stores only your corrections (name / serving / values); "Reset" removes them.
   * - Changing just the serving size keeps the nutrition density (values scale with the grams).
   */
  M.saveIngredient = function (form) {
    const st = S();
    const name = String(form.name || '').trim();
    if (!name) throw new Error('Give the ingredient a name');
    const dup = M.kitchen().concat(st.custom).find((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== form.id);
    if (dup) throw new Error(`${dup.name} is already in your kitchen`);
    const given = cleanMacros(form.macros || (form.p != null || form.cal != null ? { p: form.p, cal: form.cal } : null));
    const builtin = form.id && ING.get(form.id) && !st.custom.some((x) => x.id === form.id);
    if (builtin) {
      const x = ING.get(form.id);
      const o = Object.assign({}, st.overrides[form.id] || {});
      if (name !== x.name) o.name = name;
      else delete o.name;
      if (form.serving && servingChanged(form.serving, x.serving)) o.serving = cleanServing(form.serving, x.serving);
      if (given && macrosChanged(given, M.get(form.id).macros)) {
        o.macros = Object.assign({}, M.get(form.id).macros, given.values);
        o.fields = given.fields;
      }
      if (Object.keys(o).length) st.overrides[form.id] = Object.assign(o, { edited: new Date().toISOString() });
      else delete st.overrides[form.id];
      if (!st.kitchen.includes(form.id)) st.kitchen.push(form.id);
      WT.save();
      return M.get(form.id);
    }
    const i = form.id ? st.custom.findIndex((x) => x.id === form.id) : -1;
    let rec;
    if (i >= 0) {
      rec = st.custom[i];
      const renamed = rec.name !== name;
      rec.name = name;
      if (form.cat && CAT_OK(form.cat) && form.cat !== rec.cat) {
        rec.cat = form.cat;
        if (rec.status === 'estimated') Object.assign(rec, pick(customFromEstimate(name, form.cat, ING.estimate(name, form.cat), rec.id)));
      } else if (renamed && rec.status === 'estimated') Object.assign(rec, pick(customFromEstimate(name, rec.cat, ING.estimate(name, rec.cat), rec.id)));
      if (form.serving && servingChanged(form.serving, rec.serving)) {
        const ns = cleanServing(form.serving, rec.serving);
        if (!given && rec.serving.g && ns.g) rec.macros = scaleMacros(rec.macros, ns.g / rec.serving.g);
        rec.serving = ns;
      }
    } else {
      const cat = CAT_OK(form.cat) ? form.cat : null;
      const est = ING.estimate(name, cat);
      rec = customFromEstimate(name, cat || est.cat, est);
      if (form.serving) {
        const ns = cleanServing(form.serving, rec.serving);
        if (!given && rec.serving.g && ns.g) rec.macros = scaleMacros(rec.macros, ns.g / rec.serving.g);
        rec.serving = ns;
      }
      st.custom.push(rec);
    }
    if (Array.isArray(form.tags)) rec.tags = [...new Set(form.tags)];
    if (given && macrosChanged(given, rec.macros)) {
      Object.assign(rec.macros, given.values);
      rec.fields = [...new Set((rec.fields || []).concat(given.fields))];
      rec.status = 'user';
      rec.source = 'Your values' + (rec.fields.filter((k) => ['cal', 'p', 'c', 'f'].includes(k)).length < 4 ? ' (others estimated)' : '');
    }
    rec.updatedAt = new Date().toISOString();
    if (!st.kitchen.includes(rec.id)) st.kitchen.push(rec.id);
    syncDiary(rec);
    WT.save();
    return M.get(rec.id);
  };
  const pick = (r) => ({ kind: r.kind, tags: r.tags, serving: r.serving, macros: r.macros, source: r.source, note: r.note, base: r.base, confidence: r.confidence, precooked: r.precooked, meal: r.meal, status: r.status });
  function cleanMacros(m) {
    if (!m) return null;
    const values = {}, fields = [];
    ['cal', 'p', 'c', 'f', 'fiber', 'sugar'].forEach((k) => {
      if (m[k] === '' || m[k] == null || isNaN(+m[k])) return;
      values[k] = Math.max(0, +m[k]);
      fields.push(k);
    });
    return fields.length ? { values, fields } : null;
  }
  const macrosChanged = (g, cur) => g.fields.some((k) => Math.abs((+cur[k] || 0) - g.values[k]) > 0.05);
  const servingChanged = (a, b) => ['n', 'unit', 'g', 'state'].some((k) => a[k] != null && a[k] !== '' && String(a[k]) !== String(b[k]));
  function cleanServing(s, prev) {
    return { n: +s.n > 0 ? +s.n : prev.n, unit: String(s.unit || prev.unit).trim() || prev.unit, g: +s.g > 0 ? +s.g : prev.g, state: ING.STATES[s.state] ? s.state : prev.state };
  }
  /** Reset a built-in to typical values, or re-estimate a custom ingredient from its name. */
  M.resetIngredient = function (id) {
    const st = S();
    if (st.overrides[id]) delete st.overrides[id];
    const c = st.custom.find((x) => x.id === id);
    if (c) {
      Object.assign(c, pick(customFromEstimate(c.name, c.cat, ING.estimate(c.name, c.cat), c.id)), { fields: [] });
      syncDiary(c);
    }
    WT.save();
    return M.get(id);
  };
  M.deleteIngredient = function (id) {
    const st = S();
    if (st.custom.some((x) => x.id === id)) {
      st.custom = st.custom.filter((x) => x.id !== id);
      const f = ((WT.db.nutrition && WT.db.nutrition.foods) || []).find((x) => x.ingredientId === id);
      if (f && WT.nut) WT.nut.deleteFood(f.id);
    } else delete st.overrides[id];
    M.removeFromKitchen(id);
    st.prefs.disliked = st.prefs.disliked.filter((x) => x !== id);
    WT.save();
  };
  /** Add a food from your food diary's "My foods" to the kitchen (its values come along). */
  M.importDiaryFood = function (foodId, cat) {
    const f = ((WT.db.nutrition && WT.db.nutrition.foods) || []).find((x) => x.id === foodId);
    if (!f) return null;
    const est = ING.estimate(f.name, cat || null);
    const rec = customFromEstimate(f.name, cat || est.cat, est);
    const per = f.per || {};
    rec.macros = { cal: per.cal != null ? +per.cal : est.macros.cal, p: +per.p || 0, c: per.c != null ? +per.c : est.macros.c, f: per.f != null ? +per.f : est.macros.f, fiber: null, sugar: null };
    rec.serving = { n: +f.qty || 1, unit: f.unit === 'serving' && f.serving ? f.serving : f.unit || 'serving', g: +f.g || est.serving.g, state: 'sold' };
    rec.status = f.status === 'verified' ? 'verified' : f.status === 'user' ? 'user' : 'estimated';
    rec.source = 'From your food diary (My foods)';
    rec.diaryFoodId = f.id;
    S().custom.push(rec);
    S().kitchen.push(rec.id);
    M.toggleSelect(rec.id);
    WT.save();
    return M.get(rec.id);
  };
  /** Custom ingredients are also available in the food diary (My foods), linked so edits carry over. */
  function syncDiary(rec) {
    const N = WT.nut;
    if (!N || !N.saveFood || !WT.db.nutrition || rec.diaryFoodId) return;
    const foods = WT.db.nutrition.foods;
    const existing = foods.find((f) => f.ingredientId === rec.id);
    const saved = N.saveFood({
      id: existing ? existing.id : undefined, name: rec.name, qty: 1, unit: 'serving', serving: `${M.fmtAmount(rec.serving.n, rec.serving.unit)}${rec.serving.state && rec.serving.state !== 'sold' ? ' ' + rec.serving.state : ''}`,
      g: rec.serving.g || undefined, per: { p: rec.macros.p, cal: rec.macros.cal, c: rec.macros.c, f: rec.macros.f },
      status: rec.status === 'user' ? 'user' : rec.status === 'verified' ? 'verified' : 'estimated', source: { kind: 'kitchen', name: 'Meal ideas kitchen' }, aliases: [rec.name.toLowerCase()],
    }, existing ? existing.fav : false);
    if (saved) saved.ingredientId = rec.id;
  }

  /* ═════════════════════ QUANTITIES ═════════════════════ */
  const VOL = { tsp: 1, tbsp: 3, cup: 48 };
  const FR = [[0.25, '¼'], [0.33, '⅓'], [0.5, '½'], [0.67, '⅔'], [0.75, '¾']];
  M.fmtQty = function (n) {
    if (n == null) return '';
    const whole = Math.floor(n + 1e-6);
    const frac = n - whole;
    if (frac < 0.12) return String(whole || (n > 0 ? '¼' : '0'));
    if (frac > 0.88) return String(whole + 1);
    const f = FR.reduce((b, x) => (Math.abs(x[0] - frac) < Math.abs(b[0] - frac) ? x : b), FR[0]);
    return (whole ? whole + ' ' : '') + f[1];
  };
  const PLURAL = { breast: 'breasts', thigh: 'thighs', fillet: 'fillets', link: 'links', chop: 'chops', can: 'cans', slice: 'slices', tortilla: 'tortillas', pita: 'pitas', bun: 'buns', muffin: 'muffins', bagel: 'bagels', pepper: 'peppers', onion: 'onions', clove: 'cloves', spear: 'spears', lemon: 'lemons', lime: 'limes', avocado: 'avocados', stalk: 'stalks', shallot: 'shallots', drumstick: 'drumsticks', block: 'blocks', cucumber: 'cucumbers', orange: 'oranges', frank: 'franks', serving: 'servings', 'green onion': 'green onions', 'large egg': 'large eggs', 'medium potato': 'medium potatoes', 'medium sweet potato': 'medium sweet potatoes', 'medium tomato': 'medium tomatoes', 'medium zucchini': 'medium zucchini', 'medium carrot': 'medium carrots', 'medium banana': 'medium bananas', 'medium apple': 'medium apples' };
  const plural = (u, n) => {
    if (n <= 1.01) return u;
    const head = Object.keys(PLURAL).sort((a, b) => b.length - a.length).find((k) => u === k || u.startsWith(k + ' '));
    if (head) return PLURAL[head] + u.slice(head.length);
    if (/^cup\b/.test(u)) return u.replace(/^cup/, 'cups');
    return u;
  };
  /**
   * A human amount for n × unit. Rounds to sensible kitchen precision (no false precision): counts to ½ (¼
   * under 1), ounces to whole numbers (½ under 4), volumes to ¼; small volumes step up to tbsp / cups.
   */
  M.fmtAmount = function (n, unit) {
    if (n == null) return unit || '';
    let u = String(unit || '').trim();
    const head = u.split(' ')[0];
    if (head === 'oz') {
      const oz = n < 4 ? Math.round(n * 2) / 2 : Math.round(n);
      const rest = u.slice(2).trim();
      if (oz >= 16 && oz % 4 === 0) return `${M.fmtQty(oz / 16)} lb${rest ? ' ' + rest : ''} (≈${Math.round(oz * 28.35 / 10) * 10} g)`;
      return `${oz} oz${rest ? ' ' + rest : ''} (≈${Math.round(oz * 28.35 / 5) * 5} g)`;
    }
    if (VOL[head]) {
      let tsp = n * VOL[head];
      const rest = u.slice(head.length).trim();
      const r = (x) => Math.max(0.25, Math.round(x * 4) / 4);
      if (tsp >= 12) return `${M.fmtQty(r(tsp / 48))} ${r(tsp / 48) > 1.01 ? 'cups' : 'cup'}${rest ? ' ' + rest : ''}`;
      if (tsp >= 3 && head !== 'tsp' ? true : tsp >= 3) return `${M.fmtQty(r(tsp / 3))} tbsp${rest ? ' ' + rest : ''}`;
      return `${M.fmtQty(r(tsp))} tsp${rest ? ' ' + rest : ''}`;
    }
    if (head === 'pinch' || head === 'spray') return n <= 1.5 ? `1 ${head}` : `${Math.round(n)} ${head === 'pinch' ? 'pinches' : 'sprays'}`;
    const q = n < 1 ? Math.max(0.25, Math.round(n * 4) / 4) : Math.round(n * 2) / 2;
    return `${M.fmtQty(q)} ${plural(u, q)}`.trim();
  };
  /** "2 breasts (≈ 12 oz raw)" — counts of meat / fish also show the weight. */
  function amountText(ing, total) {
    const s = ing.serving;
    const n = total * s.n;
    let txt = M.fmtAmount(n, s.unit);
    const info = ING.unitInfo(s.unit);
    if (info.type === 'count' && s.g && ['protein'].includes(ing.cat) && !/egg/.test(s.unit)) {
      const oz = (total * s.g) / 28.35;
      txt += ` (≈ ${oz < 4 ? Math.round(oz * 2) / 2 : Math.round(oz)} oz${s.state === 'raw' ? ' raw' : ''})`;
    } else if (s.state === 'raw' && info.type === 'weight' && ing.cat === 'protein') txt = txt.replace(/\)$/, ' raw)');
    return txt;
  }
  M.amountText = amountText;

  /* ═════════════════════ COOKING PROFILES ═════════════════════ */
  // Protein kinds → how they cook by method. Minutes are [min, max].
  const PK = {
    poultry: { pan: [6, 8], air: [380, 12, 16], sheet: [425, 18, 22], simmer: [12, 15], done: 'cooked through (165°F / 74°C)', cut: 'bite-size pieces' },
    'cooked-poultry': { pan: [2, 3], air: [380, 4, 5], sheet: [425, 6, 8], simmer: [3, 4], done: 'heated through', cut: 'bite-size pieces', precooked: true },
    ground: { pan: [6, 8], simmer: [8, 10], done: 'browned with no pink left', cut: null },
    beef: { pan: [6, 8], air: [400, 8, 12], sheet: [425, 8, 10], simmer: [10, 12], done: 'medium (135°F / 57°C)', cut: 'thin strips against the grain' },
    pork: { pan: [8, 10], air: [380, 12, 14], sheet: [425, 15, 20], simmer: [10, 12], done: '145°F (63°C)', cut: 'bite-size pieces' },
    sausage: { pan: [4, 6], air: [375, 8, 10], sheet: [425, 15, 18], simmer: [5, 8], done: 'browned', simmerDone: 'heated through', cut: '½-inch coins' },
    bacon: { pan: [6, 8], air: [375, 8, 10], sheet: [400, 15, 18], done: 'crisp', cut: null },
    deli: { pan: [2, 3], done: 'warmed', cut: 'strips', precooked: true },
    shrimp: { pan: [3, 4], air: [400, 6, 8], sheet: [425, 6, 8], simmer: [3, 4], done: 'pink and just opaque', cut: null },
    shellfish: { pan: [3, 4], air: [400, 6, 8], sheet: [425, 8, 10], simmer: [3, 4], done: 'just opaque', cut: null },
    'fish-fatty': { pan: [7, 8], air: [400, 8, 10], sheet: [425, 10, 12], simmer: [5, 6], done: 'flaking easily (145°F / 63°C)', cut: 'chunks' },
    'fish-lean': { pan: [5, 7], air: [400, 7, 9], sheet: [425, 10, 12], simmer: [4, 5], done: 'opaque and flaking easily (145°F / 63°C)', cut: 'chunks' },
    'canned-fish': { done: 'drained', cut: null, precooked: true, noCook: true },
    egg: { done: 'just set', cut: null },
    tofu: { pan: [8, 10], air: [400, 12, 15], sheet: [425, 20, 25], simmer: [5, 6], done: 'golden and crisp at the edges', simmerDone: 'heated through and soaking up the flavor', cut: '¾-inch cubes' },
    legume: { pan: [3, 4], air: [400, 12, 15], sheet: [425, 18, 20], simmer: [8, 10], done: 'heated through', cut: null, precooked: true },
    'generic-protein': { pan: [6, 10], air: [380, 10, 15], sheet: [425, 15, 20], simmer: [10, 12], done: 'cooked through (check its package for the safe temperature)', cut: 'bite-size pieces' },
  };
  // Vegetable kinds: prep words and cook minutes per method
  const VK = {
    leafy: { prep: '', pan: [1, 2], simmer: [1, 2], raw: true, wilt: true },
    greens: { prep: 'chopped', pan: [3, 5], air: [375, 5, 7], sheet: [425, 8, 10], simmer: [3, 5], raw: true },
    lettuce: { prep: 'chopped', raw: true, rawOnly: true },
    crucifer: { prep: 'cut into bite-size florets', pan: [6, 8], air: [400, 10, 14], sheet: [425, 20, 25], simmer: [6, 8] },
    allium: { prep: 'sliced', pan: [4, 6], air: [380, 10, 12], sheet: [425, 18, 22], simmer: [5, 8], raw: true, aromatic: true },
    scallion: { prep: 'sliced', pan: [1, 2], raw: true, garnish: true, aromatic: true },
    chili: { prep: 'seeded and minced (keep some seeds for more heat)', pan: [1, 2], sheet: [425, 15, 20], simmer: [5, 8], raw: true, aromatic: true },
    pepper: { prep: 'sliced into strips', pan: [4, 5], air: [380, 8, 10], sheet: [425, 18, 20], simmer: [6, 8], raw: true },
    mushroom: { prep: 'sliced', pan: [5, 7], air: [380, 8, 10], sheet: [425, 18, 20], simmer: [6, 8] },
    tomato: { prep: 'chopped', pan: [2, 3], air: [380, 6, 8], sheet: [425, 15, 18], simmer: [8, 10], raw: true },
    'tomato-canned': { prep: '', pan: [5, 6], simmer: [10, 15], sauce: true },
    squash: { prep: 'cut into half-moons', pan: [4, 5], air: [400, 10, 12], sheet: [425, 18, 20], simmer: [6, 8] },
    'starchy-veg': { prep: '', pan: [4, 6], air: [400, 12, 15], sheet: [425, 20, 25], simmer: [8, 12] },
    stalk: { prep: 'trimmed and cut into 2-inch pieces', pan: [4, 6], air: [400, 7, 9], sheet: [425, 12, 15], simmer: [4, 6], raw: true },
    root: { prep: 'sliced thin', pan: [7, 9], air: [400, 12, 15], sheet: [425, 22, 25], simmer: [12, 15], raw: true },
    cucumber: { prep: 'diced', raw: true, rawOnly: true },
    'generic-veg': { prep: 'chopped', pan: [4, 6], air: [400, 8, 12], sheet: [425, 18, 22], simmer: [6, 8] },
  };
  const VPREP = { broccoli: 'cut into florets', cauliflower: 'cut into florets', brussels: 'halved', 'bok-choy': 'halved lengthwise (or chopped)', kale: 'stems removed, chopped', cabbage: 'shredded', zucchini: 'cut into half-moons', eggplant: 'cut into 1-inch cubes', butternut: 'peeled and cut into ¾-inch cubes', carrot: 'sliced thin', tomato: 'chopped', 'bell-pepper': 'sliced into strips', onion: 'sliced', mushroom: 'sliced', asparagus: 'trimmed and cut into 2-inch pieces', 'green-beans': 'trimmed', 'snap-peas': 'trimmed', celery: 'sliced', cucumber: 'diced', corn: '', peas: '' };
  const vk = (ing) => VK[ing.kind] || VK['generic-veg'];
  const pk = (ing) => PK[ing.kind] || PK['generic-protein'];
  const isAromatic = (ing) => ['allium', 'scallion', 'chili', 'garlic', 'ginger'].includes(ing.kind);
  const range = (r) => (r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`);
  const T = (f) => `${f}°F (${Math.round(((f - 32) * 5) / 9 / 5) * 5}°C)`;

  /* ═════════════════════ FLAVOR PROFILES ═════════════════════
   * season(B) writes the seasoning through the builder (so every pantry item is listed with an amount).
   * fit: formats it suits · bad: ingredient kinds it clashes with · likes: ids/kinds that pair especially well
   * adv: 0 everyday · 1 a little different · 2 adventurous. title: the adjective used in names.
   */
  const F = (o) => Object.assign({ adv: 0, bad: [], likes: [], tags: [], season: (B) => B.p('salt-pepper', [1, 'pinch']) }, o);
  M.FLAVORS = [
    F({ id: 'cajun', title: 'Cajun', taste: 'Smoky, peppery Cajun spice', fit: ['skillet', 'hash', 'sheet', 'air', 'pasta', 'bowl', 'tacos', 'soup', 'stuffed'], bad: ['canned-fish', 'yogurt', 'fruit', 'noodle'], likes: ['sausage', 'shrimp', 'poultry', 'potato', 'pepper', 'allium', 'rice', 'tomato', 'chili'],
      season: (B) => `${B.p('cajun', [1, 'tsp'])}, ${B.p('paprika', [0.25, 'tsp'])} and ${B.garlic()}`, finish: (B) => `Finish with ${B.acid('lemon', 0.5)}.` }),
    F({ id: 'smoky', title: 'smoky paprika', taste: 'Smoky paprika and garlic', fit: ['skillet', 'hash', 'sheet', 'air', 'stew', 'bowl', 'soup', 'stuffed', 'scramble'], bad: ['canned-fish', 'yogurt', 'noodle'], likes: ['sausage', 'potato', 'pepper', 'allium', 'legume', 'egg', 'poultry', 'shrimp', 'tomato', 'greens'],
      season: (B) => `${B.p('paprika', [1, 'tsp'])}, ${B.garlic()} and ${B.p('cumin', [0.25, 'tsp'])}`, finish: (B) => `Brighten with ${B.acid('lemon', 0.5)}.` }),
    F({ id: 'bbq', title: 'BBQ', taste: 'Sticky, sweet-smoky BBQ', fit: ['sheet', 'air', 'bowl', 'tacos', 'stuffed', 'skillet', 'melt'], bad: ['fish-fatty', 'fish-lean', 'canned-fish', 'shrimp', 'shellfish', 'egg', 'yogurt', 'noodle', 'pasta'], likes: ['poultry', 'pork', 'sausage', 'ground', 'tofu', 'potato', 'allium', 'pepper', 'cabbage', 'cheese-melt'],
      season: (B) => `${B.p('paprika', [0.5, 'tsp'])} and ${B.garlic()}`, sauce: (B) => B.p('bbq-sauce', [2, 'tbsp']) }),
    F({ id: 'chililime', title: 'chili-lime', taste: 'Zesty chili-lime with cumin', fit: ['bowl', 'tacos', 'skillet', 'sheet', 'air', 'salad', 'soup', 'quesadilla', 'stuffed'], bad: ['yogurt-main', 'noodle', 'pasta'], likes: ['poultry', 'shrimp', 'ground', 'fish-lean', 'legume', 'pepper', 'allium', 'chili', 'avocado', 'tomato', 'rice', 'tortilla', 'mango', 'pineapple', 'cheese-crumble'],
      season: (B) => `${B.p('chili-powder', [1, 'tsp'])}, ${B.p('cumin', [0.5, 'tsp'])} and ${B.garlic()}`, finish: (B) => `Squeeze over ${B.acid('lime', 1)}.` }),
    F({ id: 'chipotle', title: 'chipotle-honey', taste: 'Smoky-sweet chipotle with a little heat', adv: 1, fit: ['bowl', 'tacos', 'sheet', 'air', 'skillet', 'stuffed'], bad: ['canned-fish', 'yogurt-main', 'noodle', 'pasta'], likes: ['poultry', 'shrimp', 'pork', 'sweet-potato', 'legume', 'pepper', 'allium', 'avocado', 'cheese-crumble'],
      season: (B) => `${B.p('chipotle', [0.5, 'tsp'])}, ${B.p('cumin', [0.25, 'tsp'])} and ${B.garlic()}`, sauce: (B) => `${B.p('honey', [1, 'tsp'])} and ${B.acid('lime', 0.5)}` }),
    F({ id: 'korean', proper: true, title: 'Korean-style', taste: 'Sweet-spicy Korean-style sesame-soy glaze', adv: 1, fit: ['stirfry', 'bowl', 'friedrice', 'tacos', 'noodle', 'air', 'skillet'], bad: ['canned-fish', 'cheese-melt', 'cheese-crumble', 'cheese-hard', 'yogurt', 'cottage'], likes: ['beef', 'ground', 'pork', 'tofu', 'poultry', 'sausage', 'rice', 'greens', 'cabbage', 'scallion', 'mushroom', 'egg', 'cucumber'],
      season: (B) => `${B.garlic()} and ${B.ginger()}`, sauce: (B) => `${B.soy(1)}, ${B.p('honey', [1, 'tsp'])}, ${B.p('sriracha', [1, 'tsp'])} and ${B.p('sesame-oil', [0.5, 'tsp'])}` }),
    F({ id: 'teriyaki', title: 'teriyaki', taste: 'Glossy honey-soy teriyaki', fit: ['stirfry', 'bowl', 'sheet', 'air', 'noodle', 'friedrice'], bad: ['canned-fish', 'cheese-melt', 'cheese-crumble', 'cheese-hard', 'yogurt', 'cottage', 'sausage', 'pasta', 'tortilla'], likes: ['fish-fatty', 'poultry', 'tofu', 'shrimp', 'crucifer', 'pineapple', 'rice', 'pepper', 'scallion', 'greens'],
      season: (B) => `${B.ginger()} and ${B.garlic()}`, sauce: (B) => `${B.soy(1)}, ${B.p('honey', [2, 'tsp'])} and ${B.starch()} stirred into 1 tbsp water per serving` }),
    F({ id: 'garlicginger', title: 'garlic-ginger', taste: 'Punchy garlic, ginger and soy', fit: ['stirfry', 'noodle', 'friedrice', 'soup', 'bowl'], bad: ['canned-fish', 'cheese-melt', 'cheese-crumble', 'cheese-hard', 'yogurt', 'cottage', 'tortilla'], likes: ['poultry', 'beef', 'shrimp', 'tofu', 'pork', 'greens', 'crucifer', 'stalk', 'mushroom', 'pepper', 'noodle', 'rice', 'egg'],
      season: (B) => `${B.garlic(1.5)} and ${B.ginger()}`, sauce: (B) => `${B.soy(1)}, ${B.p('vinegar', [1, 'tsp'])} and ${B.p('sesame-oil', [0.5, 'tsp'])}` }),
    F({ id: 'peanut', title: 'Thai-style peanut', taste: 'Creamy peanut-lime sauce with a kick', adv: 1, tags: ['peanut', 'nut'], fit: ['noodle', 'bowl', 'stirfry', 'salad', 'tacos'], bad: ['canned-fish', 'cheese-melt', 'cheese-crumble', 'cheese-hard', 'sausage', 'yogurt'], likes: ['poultry', 'tofu', 'shrimp', 'cabbage', 'pepper', 'root', 'cucumber', 'noodle', 'rice', 'scallion', 'edamame'],
      season: (B) => `${B.garlic()} and ${B.ginger()}`,
      sauce: (B) => `${B.p('peanut-butter', [1, 'tbsp'])}, ${B.soy(0.67)}, ${B.acid('lime', 1)}, ${B.p('sriracha', [0.5, 'tsp'])} and ${B.p('honey', [0.5, 'tsp'])} whisked with 1 tbsp warm water per serving` }),
    F({ id: 'lemonherb', title: 'lemon-herb', taste: 'Bright lemon, garlic and oregano', fit: ['sheet', 'air', 'bowl', 'salad', 'pasta', 'skillet', 'soup', 'tacos'], bad: ['bacon', 'noodle'], likes: ['poultry', 'fish-lean', 'fish-fatty', 'shrimp', 'legume', 'squash', 'tomato', 'stalk', 'potato', 'grain', 'cheese-crumble', 'greens', 'leafy', 'canned-fish'],
      season: (B) => `${B.p('oregano', [0.5, 'tsp'])} and ${B.garlic()}`, finish: (B) => `Finish with ${B.acid('lemon', 1)}.` }),
    F({ id: 'greek', proper: true, title: 'Greek', taste: 'Greek-style oregano, lemon and garlic', fit: ['bowl', 'tacos', 'salad', 'sheet', 'air'], bad: ['sausage', 'bacon', 'fish-fatty', 'noodle'], likes: ['poultry', 'ground', 'legume', 'cucumber', 'tomato', 'allium', 'cheese-crumble', 'yogurt', 'flatbread', 'rice', 'grain', 'olive', 'lettuce', 'spread'],
      season: (B) => `${B.p('oregano', [1, 'tsp'])}, ${B.garlic()} and ${B.p('vinegar', [1, 'tsp'])}`, finish: (B) => `Finish with ${B.acid('lemon', 1)}.`, yogurtSauce: true }),
    F({ id: 'tuscan', title: 'Tuscan garlic', taste: 'Garlicky Italian herbs with a pinch of chili', fit: ['pasta', 'skillet', 'sheet', 'soup', 'stuffed', 'frittata', 'melt'], bad: ['yogurt', 'noodle', 'tofu', 'tortilla'], likes: ['sausage', 'poultry', 'shrimp', 'legume', 'tomato', 'leafy', 'squash', 'mushroom', 'pasta', 'cheese-hard', 'cheese-melt', 'greens'],
      season: (B) => `${B.p('italian-seasoning', [1, 'tsp'])}, ${B.garlic(1.5)} and ${B.p('red-pepper-flakes', [0.25, 'tsp'])}` }),
    F({ id: 'marinara', title: 'marinara', taste: 'Rich tomato-basil marinara', fit: ['pasta', 'skillet', 'stuffed', 'melt', 'soup'], bad: ['fish-fatty', 'canned-fish', 'yogurt', 'bacon', 'noodle', 'tofu', 'tortilla', 'shrimp-noodle'], likes: ['ground', 'sausage', 'poultry', 'egg', 'cheese-melt', 'cheese-hard', 'squash', 'mushroom', 'leafy', 'pepper', 'allium', 'legume'],
      season: (B) => `${B.p('italian-seasoning', [0.5, 'tsp'])} and ${B.garlic()}`, sauce: (B) => B.p('marinara', [0.5, 'cup']) }),
    F({ id: 'pesto', title: 'pesto', taste: 'Fragrant basil pesto', tags: ['dairy', 'nut'], fit: ['pasta', 'bowl', 'sheet', 'salad', 'melt', 'frittata'], bad: ['canned-fish', 'yogurt', 'bacon', 'noodle', 'tofu', 'tortilla'], likes: ['poultry', 'shrimp', 'legume', 'tomato', 'squash', 'leafy', 'pasta', 'cheese-melt', 'potato', 'stalk'],
      sauce: (B) => B.p('pesto', [1, 'tbsp']) }),
    F({ id: 'curry', title: 'coconut curry', taste: 'Warm, mellow coconut curry', adv: 1, fit: ['stew', 'skillet', 'sheet', 'soup', 'bowl'], bad: ['canned-fish', 'cheese-melt', 'cheese-crumble', 'cheese-hard', 'sausage', 'bacon', 'deli', 'pasta', 'tortilla', 'bread'], likes: ['poultry', 'shrimp', 'legume', 'tofu', 'potato', 'leafy', 'crucifer', 'tomato-canned', 'rice', 'allium', 'pepper', 'starchy-veg'],
      season: (B) => `${B.p('curry-powder', [1.5, 'tsp'])}, ${B.garlic()} and ${B.ginger()}`, sauce: (B) => B.p('coconut-milk', [0.25, 'cup']), finish: (B) => `Finish with ${B.acid('lime', 0.5)}.` }),
    F({ id: 'jerk', proper: true, title: 'jerk-spiced', taste: 'Caribbean-style jerk heat with a sweet edge', adv: 2, fit: ['sheet', 'air', 'bowl', 'skillet', 'tacos'], bad: ['canned-fish', 'cheese-melt', 'cheese-hard', 'yogurt', 'bacon', 'pasta', 'noodle'], likes: ['poultry', 'pork', 'shrimp', 'sweet-potato', 'pineapple', 'mango', 'pepper', 'rice', 'legume', 'allium'],
      season: (B) => `${B.p('jerk', [1, 'tsp'])} and ${B.garlic()}`, finish: (B) => `Finish with ${B.p('honey', [0.5, 'tsp'])} and ${B.acid('lime', 0.5)}.` }),
    F({ id: 'honeymustard', title: 'honey-mustard', taste: 'Tangy honey-mustard glaze', fit: ['sheet', 'air', 'salad', 'bowl', 'tacos', 'skillet'], bad: ['canned-fish', 'yogurt', 'cheese-crumble', 'noodle', 'pasta'], likes: ['poultry', 'pork', 'sausage', 'fish-fatty', 'potato', 'crucifer', 'stalk', 'apple', 'root', 'leafy'],
      season: (B) => B.garlic(), sauce: (B) => `${B.p('dijon', [1.5, 'tsp'])} and ${B.p('honey', [1, 'tsp'])}` }),
    F({ id: 'buffalo', proper: true, title: 'Buffalo', taste: 'Tangy Buffalo heat, cooled down with something creamy', fit: ['air', 'tacos', 'salad', 'bowl', 'stuffed', 'sheet'], bad: ['fish-fatty', 'fish-lean', 'canned-fish', 'pork', 'sausage', 'egg', 'fruit', 'noodle'], likes: ['poultry', 'cooked-poultry', 'tofu', 'legume', 'crucifer', 'stalk', 'root', 'lettuce', 'yogurt', 'cottage', 'cheese-crumble', 'potato'],
      season: (B) => B.p('garlic-powder', [0.25, 'tsp']), sauce: (B) => `${B.p('hot-sauce', [1.5, 'tbsp'])} and ${B.p('butter', [1, 'tsp'])}`, yogurtSauce: true }),
    F({ id: 'moroccan', title: 'Moroccan-spiced', taste: 'Warm cumin, paprika and a hint of cinnamon', adv: 2, fit: ['sheet', 'stew', 'bowl', 'skillet', 'soup'], bad: ['canned-fish', 'sausage', 'bacon', 'cheese-melt', 'pasta', 'noodle', 'tortilla'], likes: ['poultry', 'legume', 'ground', 'sweet-potato', 'root', 'crucifer', 'allium', 'grain', 'tomato-canned', 'leafy'],
      season: (B) => `${B.p('cumin', [0.75, 'tsp'])}, ${B.p('paprika', [0.5, 'tsp'])}, ${B.p('cinnamon', [0.125, 'tsp'])} and ${B.garlic()}`, finish: (B) => `Finish with ${B.acid('lemon', 0.5)}.`, yogurtSauce: true }),
    F({ id: 'lemonpepper', title: 'lemon-pepper', taste: 'Simple, zippy lemon-pepper', fit: ['air', 'sheet', 'skillet', 'bowl', 'pasta'], bad: ['canned-fish', 'sausage', 'yogurt', 'noodle', 'tortilla'], likes: ['poultry', 'fish-lean', 'fish-fatty', 'shrimp', 'stalk', 'crucifer', 'potato', 'squash'],
      season: (B) => `${B.p('lemon-pepper', [1, 'tsp'])} and ${B.garlic()}`, finish: (B) => `Finish with ${B.acid('lemon', 0.5)}.` }),
    F({ id: 'miso', title: 'miso-ginger', taste: 'Savory-sweet miso with fresh ginger', adv: 2, fit: ['soup', 'bowl', 'sheet', 'noodle', 'air'], bad: ['canned-fish', 'cheese-melt', 'cheese-crumble', 'cheese-hard', 'yogurt', 'cottage', 'sausage', 'bacon', 'pasta', 'tortilla', 'bread'], likes: ['fish-fatty', 'tofu', 'greens', 'mushroom', 'noodle', 'rice', 'scallion', 'poultry', 'shrimp', 'crucifer', 'starchy-veg'],
      season: (B) => B.ginger(), sauce: (B) => `${B.p('miso', [1, 'tsp'])}, ${B.p('honey', [0.5, 'tsp'])} and ${B.p('vinegar', [1, 'tsp'])}` }),
    F({ id: 'garlicbutter', title: 'garlic-butter', taste: 'Garlic butter with a squeeze of lemon', fit: ['skillet', 'pasta', 'sheet', 'air', 'bowl'], bad: ['canned-fish', 'yogurt', 'legume', 'tofu', 'noodle', 'tortilla'], likes: ['shrimp', 'beef', 'poultry', 'fish-fatty', 'fish-lean', 'potato', 'stalk', 'mushroom', 'leafy', 'pasta', 'cheese-hard'],
      season: (B) => B.garlic(1.5), sauce: (B) => B.p('butter', [1, 'tsp']), finish: (B) => `Finish with ${B.acid('lemon', 0.5)}.` }),
    F({ id: 'southwest', proper: true, title: 'Southwest', taste: 'Southwest-style chili, cumin and salsa', fit: ['scramble', 'frittata', 'hash', 'tacos', 'stuffed', 'quesadilla', 'bowl'], bad: ['fish-fatty', 'fish-lean', 'yogurt-main', 'fruit', 'noodle', 'pasta'], likes: ['egg', 'sausage', 'ground', 'legume', 'pepper', 'allium', 'chili', 'potato', 'tortilla', 'cheese-melt', 'avocado', 'tomato'],
      season: (B) => `${B.p('chili-powder', [0.5, 'tsp'])} and ${B.p('cumin', [0.25, 'tsp'])}`, sauce: (B) => B.p('salsa', [0.25, 'cup']) }),
    F({ id: 'herb', title: 'herb-and-garlic', taste: 'Savory garlic and herbs', fit: ['scramble', 'frittata', 'hash', 'melt', 'soup', 'salad'], bad: ['yogurt-main', 'fruit', 'noodle', 'tortilla'], likes: ['egg', 'leafy', 'mushroom', 'tomato', 'cheese-melt', 'cheese-crumble', 'cheese-hard', 'potato', 'allium', 'stalk', 'deli', 'bacon', 'sausage'],
      season: (B) => `${B.p('italian-seasoning', [0.5, 'tsp'])} and ${B.garlic(0.5)}` }),
    F({ id: 'cinnamon', title: 'cinnamon-honey', taste: 'Cinnamon and a drizzle of honey', breakfast: true, fit: ['yogurt', 'oats'], bad: [], likes: ['berries', 'banana', 'apple', 'fruit', 'nut', 'seed', 'yogurt', 'cottage', 'oats'],
      season: (B) => B.p('cinnamon', [0.25, 'tsp']), sauce: (B) => B.p('honey', [1, 'tsp']) }),
    F({ id: 'vanillamaple', title: 'maple', taste: 'Maple-sweetened with warm spice', breakfast: true, fit: ['yogurt', 'oats'], bad: [], likes: ['berries', 'banana', 'apple', 'nut', 'seed', 'yogurt', 'cottage', 'oats', 'milk'],
      season: (B) => B.p('cinnamon', [0.125, 'tsp']), sauce: (B) => B.p('maple-syrup', [1, 'tsp']) }),
  ];

  /* ═════════════════════ BUILDER ═════════════════════
   * Everything a recipe mentions goes through here: your ingredients (B.n / B.s), pantry items (B.p), and the
   * helpers that prefer something you picked (B.garlic, B.ginger, B.acid) before falling back to the pantry.
   */
  class Skip extends Error {}
  function builder(ctx) {
    const used = new Set();
    const pantry = new Map(); // id → q (servings of the pantry item, per recipe serving)
    const optional = new Map();
    const short = {}; // short references allowed for an ingredient ("the chicken")
    const B = {
      used, pantry, optional, short,
      n: (ing) => (used.add(ing.id), lname(ing)),
      s: (ing) => {
        used.add(ing.id);
        const sh = shortName(ing);
        (short[ing.id] = short[ing.id] || new Set()).add(sh);
        return sh;
      },
      list: (a) => join(a.map((x) => B.n(x))),
      p: (id, amt) => {
        const x = resolvePantry(id);
        if (!x) throw new Skip('pantry ' + id);
        const q = amt ? toServings(amt, x.serving) : 1;
        pantry.set(x.id, (pantry.get(x.id) || 0) + q);
        return pantryText(x);
      },
      opt: (id) => {
        const x = resolvePantry(id);
        if (x) optional.set(x.id, 1);
        return x ? pantryText(x) : '';
      },
      soy: (tbsp) => B.p('soy-sauce', [tbsp, 'tbsp']),
      starch: () => B.p('cornstarch', [0.5, 'tsp']),
      garlic: (cloves) => {
        const g = ctx.pick('garlic');
        if (g) {
          ctx.extra(g, (cloves || 1) / (g.serving.n || 1));
          return `${B.n(g)} (minced)`;
        }
        return B.p('garlic-powder', [0.25 * (cloves || 1), 'tsp']);
      },
      ginger: () => {
        const g = ctx.pick('ginger');
        if (g) {
          ctx.extra(g, 0.33);
          return `${B.n(g)} (grated)`;
        }
        return B.p('ground-ginger', [0.25, 'tsp']);
      },
      acid: (which, tbsp) => {
        const fr = ctx.pick(which);
        if (fr) {
          ctx.extra(fr, (tbsp || 1) / (which === 'lime' ? 2 : 3)); // a lemon ≈ 3 tbsp juice, a lime ≈ 2
          return `${B.n(fr)} juice`;
        }
        return B.p(which === 'lime' ? 'lime-juice' : 'lemon-juice', [tbsp || 1, 'tbsp']);
      },
    };
    return B;
  }
  const lname = (ing) => (ing.custom ? ing.name : ing.name.toLowerCase());
  const PROPER = /^(Italian|Dijon|Frank|Cajun|BBQ|Greek|Thai|Korean)/;
  /** Pantry item as it reads mid-sentence: lower-case first letter, proper names kept. */
  const pantryText = (x) => (PROPER.test(x.name) ? x.name : x.name[0].toLowerCase() + x.name.slice(1));
  /** Short way to refer back to an ingredient in later steps. */
  function shortName(ing) {
    const k = ing.kind;
    if (ing.custom) return ing.name.toLowerCase();
    if (k === 'poultry' || k === 'cooked-poultry') return /turkey/.test(ing.id) ? 'turkey' : 'chicken';
    if (k === 'sausage') return /kielbasa/.test(ing.id) ? 'kielbasa' : 'sausage';
    if (k === 'beef') return 'steak';
    if (k === 'pork') return 'pork';
    if (k === 'fish-fatty' || k === 'fish-lean') return 'fish';
    if (k === 'potato') return ing.id === 'sweet-potato' ? 'sweet potatoes' : 'potatoes';
    if (k === 'egg') return 'eggs';
    if (k === 'ground') return ing.name.toLowerCase().replace(/^\d+\/\d+ /, '');
    return lname(ing);
  }
  /** Pantry item, honouring avoid words and diets: cornstarch → potato starch, soy sauce → tamari … */
  function resolvePantry(id) {
    let x = ING.pantry(id);
    const no = blocked();
    for (let guard = 0; x && guard < 4; guard++) {
      const bad = matchesAvoid(x.name, x.tags) || (x.tags || []).find((t) => no.has(t));
      if (!bad && !S().prefs.disliked.includes(x.id)) return x;
      x = x.alt ? ING.pantry(x.alt) : null;
    }
    return null;
  }
  M.resolvePantry = resolvePantry;
  /** [n, unit] → multiples of a serving. Volumes convert tsp ↔ tbsp ↔ cup. */
  function toServings(amt, serving) {
    const [n, unit] = amt;
    const a = VOL[unit], b = VOL[String(serving.unit).split(' ')[0]];
    if (a && b) return (n * a) / (serving.n * b);
    return n / (serving.n || 1);
  }

  /* ═════════════════════ COOKING TEXT ═════════════════════ */
  /** Prep line for a protein in a given method (or null when nothing to do). */
  function proteinPrep(B, ing, method) {
    const k = pk(ing);
    const nm = B.n(ing);
    if (ing.kind === 'canned-fish') return `Drain the ${nm} and flake it.`;
    if (ing.kind === 'legume') return `Drain and rinse the ${nm}${method === 'air' || method === 'sheet' ? ', then pat dry' : ''}.`;
    if (ing.kind === 'tofu') return `Press the ${nm} for 10 minutes, cut into ¾-inch cubes and toss with ${B.starch()} so it crisps.`;
    if (ing.kind === 'egg') return null;
    if (ing.kind === 'ground' || ing.kind === 'bacon') return null;
    if (method === 'air' && ['poultry', 'beef', 'pork', 'fish-fatty', 'fish-lean'].includes(ing.kind)) return `Pat the ${nm} dry.`;
    if (k.cut) return `Cut the ${nm} into ${ing.kind === 'beef' && method !== 'stirfry' ? 'bite-size pieces' : k.cut}.`;
    return null;
  }
  /** One sentence that cooks a protein by method. oilFn adds the oil through the builder. */
  function proteinCook(B, ing, method, oil) {
    const k = pk(ing);
    const s = B.s(ing);
    const o = oil ? ` in ${oil}` : '';
    if (k.noCook) return null;
    if (ing.kind === 'egg') return null;
    if (method === 'simmer') return `Add the ${s} and simmer ${range(k.simmer || [8, 10])} minutes, until ${k.simmerDone || k.done}.`;
    if (method === 'air' && k.air) return `Air-fry the ${s} at ${T(k.air[0])} for ${range(k.air.slice(1))} minutes, shaking or flipping halfway, until ${k.done}.`;
    if (method === 'sheet' && k.sheet) return `Roast the ${s} at ${T(k.sheet[0])} for ${range(k.sheet.slice(1))} minutes, until ${k.done}.`;
    if (ing.kind === 'ground') return `Brown the ${s}${o} over medium-high heat, breaking it up, ${range(k.pan)} minutes until ${k.done}.`;
    if (ing.kind === 'bacon') return `Cook the ${s} until ${k.done}, ${range(k.pan)} minutes, then chop.`;
    if (ing.kind === 'sausage' && !ing.precooked) return `Cook the ${s}${o} over medium-high heat, ${range([8, 10])} minutes, until browned and cooked through (160°F / 71°C).`;
    if (ing.kind === 'sausage') return `Brown the ${s}${o} over medium-high heat, ${range(k.pan)} minutes — it’s precooked, so you’re just crisping it.`;
    if (ing.kind === 'legume' && method !== 'air' && method !== 'sheet') return `Warm the ${s}${o} for ${range(k.pan)} minutes.`;
    if (ing.kind === 'beef' && method !== 'stirfry') return `Sear the ${s}${o} over high heat, ${range([2, 3])} minutes per side for ${k.done}, then rest 5 minutes and slice.`;
    if (['fish-fatty', 'fish-lean'].includes(ing.kind)) return `Sear the ${s}${o} over medium-high heat, ${range(k.pan)} minutes total, turning once, until ${k.done}.`;
    return `Cook the ${s}${o} over medium-high heat, ${range(k.pan || [6, 8])} minutes, until ${k.done}.`;
  }
  const vegPrepText = (B, vs) => {
    const parts = vs.filter((v) => (VPREP[v.id] != null ? VPREP[v.id] : vk(v).prep)).map((v) => `${B.n(v)} ${VPREP[v.id] != null ? VPREP[v.id] : vk(v).prep}`);
    return parts.length ? `Prep the vegetables: ${join(parts)}.` : null;
  };
  /** Vegetables by method: dense first, quick ones (leafy, tomato, scallion) last. */
  function vegCook(B, vs, method, oil, phase) {
    if (!vs.length) return null;
    const slow = vs.filter((v) => !vk(v).wilt && v.kind !== 'scallion' && v.kind !== 'tomato');
    const quick = vs.filter((v) => vk(v).wilt || v.kind === 'tomato');
    const scal = vs.filter((v) => v.kind === 'scallion');
    const out = [];
    if (method === 'air') {
      const air = slow.filter((v) => vk(v).air);
      if (air.length) {
        const mx = Math.max(...air.map((v) => vk(v).air[2]));
        const mn = Math.max(...air.map((v) => vk(v).air[1]));
        out.push(`Toss the ${B.list(air)} with ${oil || B.p('olive-oil', [0.5, 'tsp'])}, ${B.p('salt-pepper', [1, 'pinch'])}, and air-fry at ${T(400)} for ${range([mn, mx])} minutes, shaking once, until tender and browned at the edges.`);
      }
      const pan = slow.filter((v) => !vk(v).air).concat(quick);
      if (pan.length) out.push(`Meanwhile, sauté the ${B.list(pan)} in a pan for ${range([2, 4])} minutes${pan.some((v) => vk(v).wilt) ? ', just until wilted' : ''}.`);
    } else if (method === 'sheet') {
      const long = slow.filter((v) => vk(v).sheet && vk(v).sheet[2] >= 15);
      const short = slow.filter((v) => vk(v).sheet && vk(v).sheet[2] < 15);
      const oilT = oil || B.p('olive-oil', [0.5, 'tsp']);
      // phase 'now': what goes in at the start · 'late': what's added near the end (after the roasting step)
      if (phase !== 'late' && long.length) out.push(`Spread the ${B.list(long)} on the pan with ${oilT}, ${B.p('salt-pepper', [1, 'pinch'])}.`);
      if (phase !== 'now' && short.length) out.push(`Add the ${B.list(short)}${long.length ? '' : ` tossed with ${oil || B.p('olive-oil', [0.5, 'tsp'])}`} for the last ${range([Math.max(...short.map((v) => vk(v).sheet[1])), Math.max(...short.map((v) => vk(v).sheet[2]))])} minutes.`);
      const late = slow.filter((v) => !vk(v).sheet).concat(quick);
      if (phase !== 'now' && late.length) out.push(`Scatter the ${B.list(late)} over the pan for the last 3–5 minutes.`);
    } else if (method === 'simmer') {
      if (slow.length) out.push(`Add the ${B.list(slow)} and simmer ${range([Math.max(...slow.map((v) => (vk(v).simmer || [6, 8])[0])), Math.max(...slow.map((v) => (vk(v).simmer || [6, 8])[1]))])} minutes.`);
      if (quick.length) out.push(`Stir in the ${B.list(quick)} for the last 2 minutes.`);
    } else {
      // pan / stir-fry
      if (slow.length) {
        const lo = Math.max(...slow.map((v) => (vk(v).pan || [4, 6])[0])), hi = Math.max(...slow.map((v) => (vk(v).pan || [4, 6])[1]));
        out.push(`${oil ? `Add ${oil} and the` : 'Add the'} ${B.list(slow)}${method === 'stirfry' ? ' and stir-fry over high heat' : ' and cook'} ${range([lo, hi])} minutes${slow.some((v) => v.kind === 'crucifer') ? ' (add a splash of water and cover for a minute to steam the florets)' : ''}, until crisp-tender.`);
      }
      if (quick.length) out.push(`Add the ${B.list(quick)} and cook ${range([1, 2])} minutes${quick.some((v) => vk(v).wilt) ? ', until just wilted' : ''}.`);
    }
    if (scal.length) out.push(`Top with the ${B.list(scal)}.`);
    return out.join(' ');
  }
  function carbCook(B, c, how) {
    if (!c) return null;
    const nm = B.n(c);
    switch (c.kind) {
      case 'rice':
        if (c.serving && c.serving.state === 'dry') return `Cook the ${nm}: about 2 parts water to 1 part rice, simmered covered 15–18 minutes.`;
        return how === 'cold' ? `Use cold, cooked ${nm} if you have it (freshly cooked grains turn mushy) — or cook it and spread it on a tray to cool for 10 minutes.` : `Cook the ${nm} (or reheat leftovers).`;
      case 'grain':
        return /quinoa/.test(c.id) ? `Rinse the ${nm} and simmer 1 part to 2 parts water for 15 minutes, then rest covered for 5.` : `Cook the ${nm} according to the package.`;
      case 'oats':
        return null;
      case 'pasta':
      case 'noodle':
        return `Boil the ${nm} in salted water until just tender; save ½ cup of the cooking water before draining.`;
      case 'potato': {
        if (how === 'air') return `Cut the ${nm} into ¾-inch cubes, toss with ${B.p('olive-oil', [0.5, 'tsp'])}, ${B.p('salt-pepper', [1, 'pinch'])}, and air-fry at ${T(400)} for 18–22 minutes, shaking twice.`;
        if (how === 'sheet') return `Cut the ${nm} into ¾-inch cubes, toss with ${B.p('olive-oil', [0.5, 'tsp'])}, ${B.p('salt-pepper', [1, 'pinch'])}, and roast at ${T(425)} for 25–30 minutes, turning once.`;
        if (how === 'simmer') return `Peel and dice the ${nm} into ¾-inch cubes.`;
        if (how === 'whole') return `Pierce the ${nm} with a fork and microwave 5–8 minutes until tender (or bake at ${T(400)} for 45–50 minutes).`;
        return `Dice the ${nm} into ¾-inch cubes and microwave 4–5 minutes to par-cook.`;
      }
      case 'bread':
        return `Toast the ${nm}.`;
      case 'tortilla':
      case 'flatbread':
        return `Warm the ${nm} in a dry pan or the microwave.`;
      default:
        return `Prepare the ${nm} as usual (or as its package says).`;
    }
  }

  /* ═════════════════════ DISH FORMATS ═════════════════════
   * Each format says what it needs and how to cook. need: protein kinds it accepts ('*' = any cookable);
   * carb: kinds + need ('required' | 'optional' | 'none'); veg: [min, max] and kinds it can't use; method
   * family (for "same ingredients, same method" de-duplication); pans; equipment; meal type.
   */
  const COOKABLE = ['poultry', 'cooked-poultry', 'ground', 'beef', 'pork', 'sausage', 'shrimp', 'shellfish', 'fish-fatty', 'fish-lean', 'tofu', 'legume', 'generic-protein'];
  const fmt = (o) => Object.assign({ meal: 'main', pans: 1, equip: null, eggTop: false, cheese: false, avocado: false, fruitOk: [], vegBad: [] }, o);
  M.FORMATS = [
    fmt({ id: 'skillet', name: 'Skillet', method: 'pan', family: 'pan', protein: COOKABLE.concat(['deli']), carb: { kinds: ['potato', 'rice', 'grain'], need: 'optional' }, veg: [0, 3], vegBad: ['lettuce', 'cucumber'], cheese: true, eggTop: true, avocado: true,
      title: (r) => r.c && r.c.kind === 'potato' ? `${cap(r.fl.title)} ${r.sP} & ${r.c.one || r.sC} skillet${r.v.length ? ` with ${r.sV}` : ''}` : `${cap(r.fl.title)} ${r.sP} skillet${r.v.length ? ` with ${r.sV}` : r.c ? ` with ${r.sC}` : ''}`,
      pitch: (r) => `all cooked in one pan${r.c && r.c.kind === 'potato' ? ' with crisp-edged ' + r.sC : ''}`,
      time: (r) => ({ prep: 10, cook: (r.c && r.c.kind === 'potato' ? 12 : 0) + 12 }),
      steps(r, B) {
        const s = [];
        if (r.c && r.c.kind === 'potato') s.push(carbCook(B, r.c, 'pan'));
        else if (r.c) s.push(carbCook(B, r.c));
        const pp = proteinPrep(B, r.p, 'pan');
        if (pp) s.push(pp);
        s.push(vegPrepText(B, r.v));
        s.push(`Mix the seasoning: ${r.fl.season(B)}.`);
        if (r.c && r.c.kind === 'potato') s.push(`Heat ${B.p('olive-oil', [1, 'tsp'])} in a large skillet and cook the ${B.s(r.c)} over medium-high heat, 8–10 minutes, until golden. Push them to the side.`);
        s.push(proteinCook(B, r.p, 'pan', r.c && r.c.kind === 'potato' ? null : B.p('olive-oil', [1, 'tsp'])) || `Add the ${B.n(r.p)} to the pan.`);
        s.push(vegCook(B, r.v, 'pan'));
        s.push(`Sprinkle in the seasoning${r.fl.sauce ? ` and add ${r.fl.sauce(B)}` : ''}, toss everything together and cook 1 more minute.${r.c && r.c.kind !== 'potato' ? ` Fold in the ${B.n(r.c)}.` : ''}`);
        addToppings(r, B, s);
        if (r.fl.finish) s.push(r.fl.finish(B));
        return s;
      } }),
    fmt({ id: 'hash', name: 'Hash', method: 'pan', family: 'pan', meal: 'any', protein: ['sausage', 'ground', 'bacon', 'deli', 'cooked-poultry', 'beef', 'legume', 'tofu', 'egg', 'poultry'], carb: { kinds: ['potato'], need: 'required' }, veg: [0, 3], vegBad: ['lettuce', 'cucumber'], eggTop: true, cheese: true, avocado: true,
      title: (r) => `${cap(r.fl.title)} ${r.sP} & ${r.c.one || r.sC} hash${r.v.length ? ` with ${r.sV}` : ''}`,
      pitch: (r) => `crispy diced ${r.sC} and browned ${r.sP}${r.p2 ? ', topped with a soft egg' : ''}`,
      time: () => ({ prep: 10, cook: 22 }),
      steps(r, B) {
        const s = [carbCook(B, r.c, 'pan')];
        const pp = r.p.kind === 'egg' ? null : proteinPrep(B, r.p, 'pan');
        if (pp) s.push(pp);
        s.push(vegPrepText(B, r.v));
        s.push(`Heat ${B.p('olive-oil', [1.5, 'tsp'])} in a large skillet and cook the ${B.s(r.c)} over medium-high heat, 8–10 minutes, until golden and crisp.`);
        if (r.p.kind !== 'egg') s.push(proteinCook(B, r.p, 'pan') || `Stir in the ${B.n(r.p)}.`);
        s.push(vegCook(B, r.v, 'pan'));
        s.push(`Season with ${r.fl.season(B)}${r.fl.sauce ? ` and ${r.fl.sauce(B)}` : ''}, and toss for 1 minute.`);
        if (r.p.kind === 'egg') s.push(`Make wells in the hash, crack in the ${B.n(r.p)}, cover and cook 4–6 minutes until the whites are set.`);
        addToppings(r, B, s);
        if (r.fl.finish) s.push(r.fl.finish(B));
        return s;
      } }),
    fmt({ id: 'stirfry', name: 'Stir-fry', method: 'stirfry', family: 'pan', protein: ['poultry', 'beef', 'pork', 'shrimp', 'shellfish', 'tofu', 'ground', 'sausage', 'cooked-poultry', 'legume'], carb: { kinds: ['rice', 'noodle', 'grain'], need: 'optional' }, veg: [2, 4], vegBad: ['lettuce', 'cucumber', 'tomato', 'tomato-canned', 'starchy-veg'], eggTop: false,
      title: (r) => `${cap(r.fl.title)} ${r.sP} & ${r.sV1} stir-fry${r.c ? ` over ${r.sC}` : ''}`,
      pitch: (r) => `crisp-tender vegetables and ${r.sP} tossed in the sauce over high heat`,
      time: () => ({ prep: 15, cook: 12 }),
      steps(r, B) {
        const s = [];
        if (r.c) s.push(carbCook(B, r.c));
        const pp = proteinPrep(B, r.p, 'stirfry');
        if (pp) s.push(pp);
        s.push(vegPrepText(B, r.v));
        s.push(`Stir together the sauce: ${r.fl.sauce ? r.fl.sauce(B) : B.soy(1)}.`);
        s.push(proteinCook(B, r.p, 'stirfry', B.p('olive-oil', [1, 'tsp'])) + ' Move it to a plate.');
        s.push(`In the same pan, add ${r.fl.season(B)} for 30 seconds.`);
        s.push(vegCook(B, r.v, 'stirfry'));
        s.push(`Return the ${B.s(r.p)}, pour in the sauce and toss for 1 minute until glossy.${r.c ? ` Serve over the ${B.n(r.c)}.` : ''}`);
        s.push(`Top with ${B.opt('sesame-seeds')} if you like.`);
        if (r.fl.finish) s.push(r.fl.finish(B));
        return s;
      } }),
    fmt({ id: 'friedrice', name: 'Fried rice', method: 'stirfry', family: 'pan', protein: ['poultry', 'cooked-poultry', 'shrimp', 'pork', 'sausage', 'tofu', 'ground', 'egg', 'beef', 'deli', 'bacon'], carb: { kinds: ['rice', 'grain'], need: 'required' }, veg: [0, 4], vegBad: ['lettuce', 'cucumber', 'tomato', 'tomato-canned', 'leafy'], eggTop: true,
      title: (r) => `${cap(r.fl.title)} ${r.p.kind === 'egg' ? 'egg' : r.sP} fried ${r.c.one || r.sC}${r.v.length ? ` with ${r.sV}` : ''}`,
      pitch: (r) => `day-old ${r.sC} fried hot with ${r.sV || 'aromatics'}${r.p.kind === 'egg' || r.p2 ? ' and scrambled egg' : ''}`,
      time: () => ({ prep: 10, cook: 12 }),
      steps(r, B) {
        const s = [carbCook(B, r.c, 'cold')];
        const pp = r.p.kind === 'egg' ? null : proteinPrep(B, r.p, 'stirfry');
        if (pp) s.push(pp);
        s.push(vegPrepText(B, r.v));
        if (r.p.kind !== 'egg') s.push(proteinCook(B, r.p, 'stirfry', B.p('olive-oil', [1, 'tsp'])) + ' Set aside.');
        const frV = r.v.filter((v) => v.kind !== 'scallion');
        s.push(`Heat ${B.p('olive-oil', [1, 'tsp'])} in a large pan and add ${r.fl.season(B)}${frV.length ? `, then the ${B.list(frV)}; stir-fry 3–4 minutes` : ' for 30 seconds'}.`);
        const egg = r.p.kind === 'egg' ? r.p : r.p2;
        if (egg) s.push(`Push everything to the side, scramble the ${B.n(egg)} in the gap until just set, then break them up.`);
        s.push(`Add the ${B.n(r.c)}${r.p.kind !== 'egg' ? ` and the ${B.s(r.p)}` : ''}, pour over ${r.fl.sauce ? r.fl.sauce(B) : B.soy(1)}, and fry, tossing, 3–4 minutes until hot and starting to crisp.`);
        const sc = r.v.filter((v) => v.kind === 'scallion');
        if (sc.length) s.push(`Top with the ${B.list(sc)}.`);
        if (r.fl.finish) s.push(r.fl.finish(B));
        return s;
      } }),
    fmt({ id: 'bowl', name: 'Bowl', method: 'pan', family: 'bowl', protein: COOKABLE.concat(['canned-fish', 'egg', 'deli']), carb: { kinds: ['rice', 'grain', 'potato', 'noodle'], need: 'required' }, veg: [0, 3], eggTop: true, cheese: true, avocado: true, fruitOk: ['mango', 'pineapple'],
      title: (r) => r.p.kind === 'egg' ? `${cap(r.fl.title)} ${r.c.one || r.sC} bowl with soft-boiled eggs${r.v.length ? ` and ${r.sV}` : ''}` : `${cap(r.fl.title)} ${r.sP} ${r.c.one || r.sC} bowl${r.v.length ? ` with ${r.sV}` : ''}`,
      pitch: (r) => `${r.p.kind === 'egg' ? 'jammy eggs' : r.sP} over ${r.sC}${r.sV ? ` with ${r.sV}` : ''}${r.ys ? ' and a cool yogurt sauce' : ''}`,
      time: (r) => ({ prep: 12, cook: r.c.kind === 'potato' ? 22 : 15 }),
      steps(r, B) {
        const how = r.c.kind === 'potato' ? (r.air ? 'air' : 'sheet') : null;
        const s = [carbCook(B, r.c, how)];
        const method = r.air && pk(r.p).air ? 'air' : 'pan';
        const pp = proteinPrep(B, r.p, method);
        if (pp) s.push(pp);
        s.push(vegPrepText(B, r.v));
        if (r.p.kind === 'egg') s.push(`Soft-boil the ${B.n(r.p)}: 7 minutes in boiling water, then into cold water; peel and halve.`);
        else if (!pk(r.p).noCook) {
          s.push(`Season the ${B.s(r.p)} with ${r.fl.season(B)}.`);
          s.push(proteinCook(B, r.p, method, method === 'air' ? null : B.p('olive-oil', [1, 'tsp'])));
        } else s.push(`Season with ${r.fl.season(B)}.`);
        const cookV = r.v.filter((v) => !vk(v).rawOnly);
        const rawV = r.v.filter((v) => vk(v).rawOnly);
        if (cookV.length) s.push(vegCook(B, cookV, method === 'air' ? 'air' : 'pan', B.p('olive-oil', [0.5, 'tsp'])));
        if (rawV.length) s.push(`Slice the ${B.list(rawV)} to serve fresh.`);
        if (r.fl.sauce || r.ys) s.push(sauceStep(r, B));
        s.push(`Build the bowls: ${B.n(r.c)}, the ${pk(r.p).noCook || r.p.kind === 'egg' ? B.n(r.p) : B.s(r.p)}${r.v.length ? ' and vegetables' : ''}${r.fl.sauce || r.ys ? ', then spoon over the sauce' : ''}.`);
        addToppings(r, B, s);
        if (r.fl.finish) s.push(r.fl.finish(B));
        return s;
      } }),
    fmt({ id: 'pasta', name: 'Pasta', method: 'pan', family: 'pasta', pans: 2, protein: ['poultry', 'cooked-poultry', 'ground', 'sausage', 'shrimp', 'shellfish', 'fish-lean', 'fish-fatty', 'canned-fish', 'legume', 'beef', 'tofu', 'cottage', 'deli', 'bacon'], carb: { kinds: ['pasta'], need: 'required' }, veg: [0, 3], vegBad: ['lettuce', 'cucumber', 'root'], cheese: true,
      title: (r) => r.p.kind === 'cottage' ? `Creamy ${r.fl.title} ${r.sC}${r.v.length ? ` with ${r.sV}` : ''}` : `${cap(r.fl.title)} ${r.sC} with ${r.sP}${r.v.length ? ` and ${r.sV}` : ''}`,
      pitch: (r) => r.p.kind === 'cottage' ? `a blended cottage-cheese sauce that turns silky and high-protein` : `${r.sP}${r.sV ? ` and ${r.sV}` : ''} tossed with ${r.sC} and a splash of the cooking water`,
      time: () => ({ prep: 10, cook: 18 }),
      steps(r, B) {
        const s = [carbCook(B, r.c)];
        if (r.p.kind === 'cottage') s.push(`Blend the ${B.n(r.p)} with a splash of the cooking water until smooth — this is the sauce.`);
        else {
          const pp = proteinPrep(B, r.p, 'pan');
          if (pp) s.push(pp);
        }
        s.push(vegPrepText(B, r.v));
        if (r.p.kind !== 'cottage') s.push(proteinCook(B, r.p, 'pan', B.p('olive-oil', [1, 'tsp'])) || `Set the ${B.n(r.p)} aside.`);
        s.push(vegCook(B, r.v, 'pan', r.p.kind === 'cottage' ? B.p('olive-oil', [1, 'tsp']) : null));
        s.push(`Add ${r.fl.season(B)}${r.fl.sauce ? `, then ${r.fl.sauce(B)}` : ''} and cook 1 minute.`);
        s.push(`Toss in the drained ${B.s(r.c) || B.n(r.c)}${r.p.kind === 'cottage' ? ` and the ${B.n(r.p)} sauce` : ` and the ${pk(r.p).noCook ? B.n(r.p) : B.s(r.p)}`} with a splash of the cooking water until glossy.`);
        addToppings(r, B, s);
        if (r.fl.finish) s.push(r.fl.finish(B));
        return s;
      } }),
    fmt({ id: 'noodle', name: 'Noodles', method: 'stirfry', family: 'pasta', pans: 2, protein: ['poultry', 'cooked-poultry', 'shrimp', 'tofu', 'beef', 'pork', 'ground', 'egg', 'legume'], carb: { kinds: ['noodle', 'pasta'], need: 'required' }, veg: [1, 4], vegBad: ['tomato', 'tomato-canned', 'starchy-veg', 'lettuce'], eggTop: true,
      title: (r) => `${cap(r.fl.title)} ${r.p.kind === 'egg' ? 'egg' : r.sP} noodles with ${r.sV}`,
      pitch: (r) => `slurpable ${r.sC} coated in the sauce with ${r.sV}`,
      time: () => ({ prep: 12, cook: 12 }),
      steps(r, B) {
        const s = [carbCook(B, r.c)];
        const pp = r.p.kind === 'egg' ? null : proteinPrep(B, r.p, 'stirfry');
        if (pp) s.push(pp);
        s.push(vegPrepText(B, r.v));
        s.push(`Whisk the sauce: ${r.fl.sauce ? r.fl.sauce(B) : B.soy(1)}.`);
        if (r.p.kind === 'egg') s.push(`Scramble the ${B.n(r.p)} in ${B.p('olive-oil', [0.5, 'tsp'])} until just set; set aside.`);
        else s.push(proteinCook(B, r.p, 'stirfry', B.p('olive-oil', [1, 'tsp'])) + ' Set aside.');
        s.push(`Add ${r.fl.season(B)} to the pan for 30 seconds.`);
        s.push(vegCook(B, r.v, 'stirfry'));
        s.push(`Add the drained ${B.n(r.c)}, the ${B.s(r.p)} and the sauce; toss over the heat for 1–2 minutes (loosen with a splash of the cooking water).`);
        if (r.fl.finish) s.push(r.fl.finish(B));
        return s;
      } }),
    fmt({ id: 'sheet', name: 'Sheet pan', method: 'sheet', family: 'oven', protein: ['poultry', 'sausage', 'shrimp', 'fish-fatty', 'fish-lean', 'tofu', 'legume', 'pork', 'beef', 'shellfish', 'generic-protein'], carb: { kinds: ['potato'], need: 'optional' }, veg: [0, 3], vegBad: ['lettuce', 'cucumber', 'tomato-canned'], cheese: false, avocado: true,
      title: (r) => `Sheet-pan ${r.fl.title} ${r.sP}${r.c || r.v.length ? ` with ${withList(r)}` : ''}`,
      pitch: () => `roasted together on one pan for caramelized edges and almost no cleanup`,
      time: (r) => ({ prep: 12, cook: r.c ? 30 : 22 }),
      steps(r, B) {
        const s = [`Heat the oven to ${T(425)} and line a large sheet pan.`];
        const pp = proteinPrep(B, r.p, 'sheet');
        if (pp) s.push(pp);
        s.push(vegPrepText(B, r.v));
        const oil = B.p('olive-oil', [1.5, 'tsp']);
        if (r.c) s.push(`Toss the ${B.n(r.c)}, cut into ¾-inch cubes, with half of the ${oil}, ${B.p('salt-pepper', [1, 'pinch'])}; roast 10 minutes first.`);
        s.push(`Toss the ${B.s(r.p)} with ${r.fl.season(B)}${r.fl.sauce ? ` and ${r.fl.sauce(B)}` : ''}.`);
        s.push(vegCook(B, r.v, 'sheet', r.c ? `the rest of the ${oil}` : oil, 'now'));
        s.push(['shrimp', 'fish-fatty', 'fish-lean', 'shellfish'].includes(r.p.kind) ? `Add the ${B.s(r.p)} to the pan for the last 8–12 minutes, until ${pk(r.p).done}.` : proteinCook(B, r.p, 'sheet'));
        s.push(vegCook(B, r.v, 'sheet', r.c ? null : oil, 'late'));
        addToppings(r, B, s);
        if (r.fl.finish) s.push(r.fl.finish(B));
        return s;
      } }),
    fmt({ id: 'air', name: 'Air fryer', method: 'air', family: 'air', equip: 'airFryer', pans: 1, protein: ['poultry', 'sausage', 'shrimp', 'fish-fatty', 'fish-lean', 'tofu', 'legume', 'pork', 'beef', 'shellfish', 'generic-protein'], carb: { kinds: ['potato', 'rice', 'grain', 'flatbread'], need: 'optional' }, veg: [0, 2], vegBad: ['lettuce', 'cucumber', 'tomato-canned'], avocado: true,
      title: (r) => `Air-fryer ${r.fl.title} ${r.sP}${r.c || r.v.length ? ` with ${withList(r, r.c && r.c.kind === 'potato' ? 'crispy ' : '')}` : ''}`,
      pitch: () => `crisp outside, juicy inside, with very little oil`,
      time: (r) => ({ prep: 10, cook: (r.c && r.c.kind === 'potato' ? 20 : 0) + 14 }),
      steps(r, B) {
        const s = [];
        if (r.c) s.push(carbCook(B, r.c, 'air'));
        const pp = proteinPrep(B, r.p, 'air');
        if (pp) s.push(pp);
        s.push(vegPrepText(B, r.v));
        s.push(`Season the ${B.s(r.p)} with ${r.fl.season(B)}, then give it a spritz of ${B.p('cooking-spray', [1, 'spray'])}.`);
        s.push(proteinCook(B, r.p, 'air'));
        if (r.fl.sauce) s.push(`Brush with ${r.fl.sauce(B)} for the last 2 minutes.`);
        s.push(vegCook(B, r.v, 'air', B.p('olive-oil', [0.5, 'tsp'])));
        addToppings(r, B, s);
        if (r.fl.finish) s.push(r.fl.finish(B));
        return s;
      } }),
    fmt({ id: 'soup', name: 'Soup', method: 'simmer', family: 'pot', protein: ['poultry', 'cooked-poultry', 'ground', 'sausage', 'shrimp', 'legume', 'tofu', 'fish-lean', 'beef', 'pork'], carb: { kinds: ['pasta', 'noodle', 'rice', 'potato', 'grain'], need: 'optional' }, veg: [2, 4], vegBad: ['lettuce', 'cucumber'], cheese: true,
      title: (r) => `${cap(r.fl.title)} ${r.sP}${r.c ? ` & ${r.sC}` : ''} soup with ${r.sV}`,
      pitch: (r) => `a brothy, warming pot with ${r.sP} and ${r.sV}`,
      time: () => ({ prep: 12, cook: 25 }),
      steps(r, B) {
        const s = [];
        const pp = proteinPrep(B, r.p, 'simmer');
        if (pp) s.push(pp);
        s.push(vegPrepText(B, r.v));
        const aro = r.v.filter(isAromatic).filter((v) => v.kind !== 'scallion');
        s.push(`Warm ${B.p('olive-oil', [1, 'tsp'])} in a pot${aro.length ? ` and soften the ${B.list(aro)} for 3–4 minutes` : ''}; stir in ${r.fl.season(B)}.`);
        if (['ground', 'sausage'].includes(r.p.kind)) s.push(proteinCook(B, r.p, 'pan'));
        s.push(`Pour in ${B.p('broth', [1.5, 'cup'])}${r.fl.sauce ? ` and ${r.fl.sauce(B)}` : ''} and bring to a simmer.`);
        if (r.c && r.c.kind === 'potato') s.push(`${carbCook(B, r.c, 'simmer')} Add them and simmer 10 minutes.`);
        s.push(vegCook(B, r.v.filter((v) => !aro.includes(v)), 'simmer'));
        if (!['ground', 'sausage'].includes(r.p.kind)) s.push(proteinCook(B, r.p, 'simmer') || `Stir in the ${B.n(r.p)}.`);
        if (r.c && r.c.kind !== 'potato') s.push(`Cook the ${B.n(r.c)} separately (so ${/s$/.test(lname(r.c)) ? 'they don’t' : 'it doesn’t'} soak up the broth) and add ${/s$/.test(lname(r.c)) ? 'them' : 'it'} to each bowl.`);
        addToppings(r, B, s);
        if (r.fl.finish) s.push(r.fl.finish(B));
        return s;
      } }),
    fmt({ id: 'stew', name: 'Stew', method: 'simmer', family: 'pot', protein: ['poultry', 'ground', 'shrimp', 'legume', 'tofu', 'beef', 'pork', 'fish-lean', 'sausage'], carb: { kinds: ['rice', 'grain', 'potato', 'flatbread'], need: 'optional' }, veg: [2, 4], vegBad: ['lettuce', 'cucumber'],
      title: (r) => r.fl.id === 'curry' ? `${cap(r.sP)} & ${r.sV1} coconut curry${r.c ? ` with ${r.sC}` : ''}` : `${cap(r.fl.title)} ${r.sP} stew with ${r.sV}${r.c ? ` over ${r.sC}` : ''}`,
      pitch: (r) => `simmered until the sauce is thick and spoonable${r.c ? `, served with ${r.sC}` : ''}`,
      time: () => ({ prep: 12, cook: 25 }),
      steps(r, B) {
        const s = [];
        if (r.c && r.c.kind !== 'potato') s.push(carbCook(B, r.c));
        const pp = proteinPrep(B, r.p, 'simmer');
        if (pp) s.push(pp);
        s.push(vegPrepText(B, r.v));
        const aro = r.v.filter(isAromatic).filter((v) => v.kind !== 'scallion');
        s.push(`Heat ${B.p('olive-oil', [1, 'tsp'])} in a deep pan${aro.length ? ` and soften the ${B.list(aro)} for 4 minutes` : ''}, then stir in ${r.fl.season(B)} for 30 seconds.`);
        if (['ground', 'sausage', 'beef'].includes(r.p.kind)) s.push(proteinCook(B, r.p, 'pan'));
        s.push(`Add ${r.fl.sauce ? r.fl.sauce(B) : B.p('broth', [0.5, 'cup'])}${r.fl.sauce ? ` and ${B.p('broth', [0.33, 'cup'])}` : ''}${r.c && r.c.kind === 'potato' ? ` with the ${B.n(r.c)}, peeled and diced into ¾-inch cubes` : ''}; simmer ${r.c && r.c.kind === 'potato' ? 12 : 5} minutes.`);
        s.push(vegCook(B, r.v.filter((v) => !aro.includes(v)), 'simmer'));
        if (!['ground', 'sausage', 'beef'].includes(r.p.kind)) s.push(proteinCook(B, r.p, 'simmer'));
        if (r.c && r.c.kind !== 'potato') s.push(`Serve over the ${B.n(r.c)}.`);
        addToppings(r, B, s);
        if (r.fl.finish) s.push(r.fl.finish(B));
        return s;
      } }),
    fmt({ id: 'salad', name: 'Salad', method: 'pan', family: 'salad', protein: COOKABLE.concat(['canned-fish', 'egg', 'deli']).filter((k) => k !== 'ground'), carb: { kinds: ['grain', 'potato', 'pasta', 'flatbread'], need: 'optional' }, veg: [2, 4], needVeg: ['leafy', 'greens', 'lettuce', 'cucumber', 'tomato', 'pepper', 'cabbage'], vegBad: ['tomato-canned', 'starchy-veg'], cheese: true, avocado: true, fruitOk: ['apple', 'berries', 'strawberries', 'mango', 'orange', 'grapes'],
      title: (r) => `${cap(r.fl.title)} ${r.sP} salad with ${r.sV}${r.c ? ` and ${r.sC}` : ''}`,
      pitch: (r) => `crunchy, fresh ${r.sV} with warm ${r.sP} and a punchy dressing`,
      time: (r) => ({ prep: 15, cook: pk(r.p).noCook ? 0 : 12 }),
      steps(r, B) {
        const s = [];
        if (r.c) s.push(carbCook(B, r.c, r.c.kind === 'potato' ? (r.air ? 'air' : 'sheet') : null) + (r.c.kind === 'pasta' || r.c.kind === 'grain' ? ' Rinse under cold water to cool.' : ''));
        const method = r.air && pk(r.p).air ? 'air' : 'pan';
        if (r.p.kind === 'egg') s.push(`Hard-boil the ${B.n(r.p)} (10 minutes), cool in cold water, peel and quarter.`);
        else {
          const pp = proteinPrep(B, r.p, method);
          if (pp) s.push(pp);
          if (!pk(r.p).noCook) s.push(`Season the ${B.s(r.p)} with ${r.fl.season(B)}. ${proteinCook(B, r.p, method, method === 'air' ? null : B.p('olive-oil', [0.5, 'tsp']))}`);
        }
        const raw = r.v.filter((v) => vk(v).raw);
        const cooked = r.v.filter((v) => !vk(v).raw);
        s.push(vegPrepText(B, r.v));
        if (cooked.length) s.push(vegCook(B, cooked, method === 'air' ? 'air' : 'pan'));
        s.push(`Whisk the dressing: ${B.p('olive-oil', [1.5, 'tsp'])}, ${r.fl.sauce ? r.fl.sauce(B) : B.p('vinegar', [1, 'tsp'])}${pk(r.p).noCook || r.p.kind === 'egg' ? `, ${r.fl.season(B)}` : ''} and ${B.p('salt-pepper', [1, 'pinch'])}.`);
        s.push(`Toss the ${raw.length ? B.list(raw) : 'vegetables'}${cooked.length ? ' and the warm vegetables' : ''} with most of the dressing and top with the ${pk(r.p).noCook || r.p.kind === 'egg' ? B.n(r.p) : B.s(r.p)}${r.c ? ` and ${B.n(r.c)}` : ''}; drizzle with the rest.`);
        addToppings(r, B, s);
        if (r.fl.finish) s.push(r.fl.finish(B));
        return s;
      } }),
    fmt({ id: 'tacos', name: 'Tacos & wraps', method: 'pan', family: 'handheld', meal: 'any', protein: COOKABLE.concat(['canned-fish', 'egg', 'deli']), carb: { kinds: ['tortilla', 'flatbread'], need: 'optional' }, needCarbOrLettuce: true, veg: [0, 3], vegBad: ['tomato-canned', 'starchy-veg', 'crucifer', 'root'], cheese: true, avocado: true, fruitOk: ['mango', 'pineapple'],
      title: (r) => { const w = r.v.length ? ` with ${r.sV}` : ''; return !r.c ? `${cap(r.fl.title)} ${r.sP} lettuce wraps` : r.c.kind === 'flatbread' ? `${cap(r.fl.title)} ${r.sP} pitas${w}` : r.p.kind === 'egg' ? `${cap(r.fl.title)} breakfast tacos${w}` : `${cap(r.fl.title)} ${r.sP} tacos${w}`; },
      pitch: (r) => `${r.c ? 'warm ' + r.sC : 'crisp lettuce cups'} piled with ${r.sP}${r.sV ? ` and ${r.sV}` : ''}`,
      time: () => ({ prep: 12, cook: 12 }),
      steps(r, B) {
        const s = [];
        const lettuce = r.v.find((v) => v.kind === 'lettuce' || v.id === 'cabbage');
        const pp = proteinPrep(B, r.p, 'pan');
        if (pp) s.push(pp);
        s.push(vegPrepText(B, r.v));
        if (r.p.kind === 'egg') s.push(`Scramble the ${B.n(r.p)} with ${r.fl.season(B)} in ${B.p('olive-oil', [0.5, 'tsp'])} over medium-low heat until just set.`);
        else if (!pk(r.p).noCook) {
          s.push(`Season the ${B.s(r.p)} with ${r.fl.season(B)}.`);
          s.push(proteinCook(B, r.p, 'pan', B.p('olive-oil', [1, 'tsp'])) + (['poultry', 'beef', 'pork', 'fish-fatty', 'fish-lean'].includes(r.p.kind) ? ' Slice or flake it.' : ''));
        } else s.push(`Season with ${r.fl.season(B)}.`);
        const cookV = r.v.filter((v) => !vk(v).raw && v !== lettuce);
        const rawV = r.v.filter((v) => vk(v).raw && v !== lettuce);
        if (cookV.length) s.push(vegCook(B, cookV, 'pan'));
        if (r.fl.sauce || r.ys) s.push(sauceStep(r, B));
        if (r.c) s.push(carbCook(B, r.c));
        s.push(`Fill the ${r.c ? B.n(r.c) : lettuce ? B.n(lettuce) + ' leaves' : 'wraps'} with the ${r.p.kind === 'egg' || pk(r.p).noCook ? B.n(r.p) : B.s(r.p)}${rawV.length ? `, the ${B.list(rawV)}` : ''}${cookV.length ? ' and vegetables' : ''}${r.fl.sauce || r.ys ? ', and spoon over the sauce' : ''}.`);
        addToppings(r, B, s);
        if (r.fl.finish) s.push(r.fl.finish(B));
        return s;
      } }),
    fmt({ id: 'quesadilla', name: 'Quesadillas', method: 'pan', family: 'handheld', meal: 'any', protein: COOKABLE.concat(['egg', 'deli', 'canned-fish']).filter((k) => !['fish-fatty', 'shellfish'].includes(k)), carb: { kinds: ['tortilla'], need: 'required' }, needCheese: true, veg: [0, 3], vegBad: ['tomato-canned', 'crucifer', 'root', 'lettuce', 'cucumber'], avocado: true,
      title: (r) => `${cap(r.fl.title)} ${r.p.kind === 'egg' ? 'egg' : r.sP} quesadillas${r.v.length ? ` with ${r.sV}` : ''}`,
      pitch: (r) => `melty ${r.ch ? lname(r.ch) : 'cheese'} and ${r.sP}, crisped in a dry pan`,
      time: () => ({ prep: 10, cook: 12 }),
      steps(r, B) {
        const s = [];
        const pp = proteinPrep(B, r.p, 'pan');
        if (pp) s.push(pp);
        s.push(vegPrepText(B, r.v));
        if (r.p.kind === 'egg') s.push(`Softly scramble the ${B.n(r.p)} with ${r.fl.season(B)}.`);
        else if (!pk(r.p).noCook) s.push(`${proteinCook(B, r.p, 'pan', B.p('olive-oil', [1, 'tsp']))} Season with ${r.fl.season(B)}.`);
        else s.push(`Season the ${B.n(r.p)} with ${r.fl.season(B)}.`);
        if (r.v.length) s.push(vegCook(B, r.v.filter((v) => !vk(v).rawOnly), 'pan'));
        s.push(`Fill half of each ${B.n(r.c).replace(/s$/, '')} with the ${B.n(r.ch)}, the ${r.p.kind === 'egg' ? B.n(r.p) : B.s(r.p)}${r.v.length ? ' and vegetables' : ''}; fold over.`);
        s.push(r.air ? `Air-fry at ${T(375)} for 5–6 minutes, flipping halfway, until crisp and melted.` : `Toast in a dry pan over medium heat, 2–3 minutes per side, until crisp and melted.`);
        if (r.fl.sauce) s.push(`Serve with ${r.fl.sauce(B)} for dipping.`);
        addToppings(r, B, s, { noCheese: true });
        return s;
      } }),
    fmt({ id: 'scramble', name: 'Scramble', method: 'pan', family: 'eggs', meal: 'breakfast', needEgg: true, protein: ['egg'], second: ['sausage', 'bacon', 'deli', 'ground', 'cooked-poultry', 'legume'], carb: { kinds: ['bread', 'tortilla', 'potato', 'flatbread'], need: 'optional' }, veg: [0, 3], vegBad: ['tomato-canned', 'crucifer', 'root', 'lettuce', 'cucumber', 'starchy-veg'], cheese: true, avocado: true,
      title: (r) => `${cap(r.fl.title)} ${r.p2 ? lname(r.p2).replace(/s$/, '') + ' & egg' : 'egg'} scramble${r.v.length ? ` with ${r.sV}` : ''}${r.c ? (r.c.kind === 'bread' ? ' on toast' : r.c.kind === 'potato' ? ` and ${r.sC}` : ` in ${r.sC}`) : ''}`,
      pitch: (r) => `soft, creamy eggs${r.p2 ? ` with ${lname(r.p2)}` : ''}${r.v.length ? ` and ${r.sV}` : ''}, ready in about 15 minutes`,
      time: (r) => ({ prep: 5, cook: r.c && r.c.kind === 'potato' ? 18 : 10 }),
      steps(r, B) {
        const s = [];
        if (r.c) s.push(r.c.kind === 'potato' ? `${carbCook(B, r.c, 'pan')} Crisp in ${B.p('olive-oil', [1, 'tsp'])} for 8–10 minutes; keep warm.` : carbCook(B, r.c));
        if (r.p2) {
          const pp = proteinPrep(B, r.p2, 'pan');
          if (pp) s.push(pp);
          s.push(proteinCook(B, r.p2, 'pan', B.p('cooking-spray', [1, 'spray'])) || `Warm the ${B.n(r.p2)} in the pan.`);
        }
        s.push(vegPrepText(B, r.v));
        if (r.v.length) s.push(vegCook(B, r.v, 'pan', r.p2 ? null : B.p('olive-oil', [0.5, 'tsp'])));
        s.push(`Whisk the ${B.n(r.p)} with ${r.fl.season(B)} and ${B.p('salt-pepper', [1, 'pinch'])}; pour into the pan and stir gently over medium-low heat until just set.`);
        if (r.fl.sauce) s.push(`Spoon over ${r.fl.sauce(B)}.`);
        addToppings(r, B, s);
        if (r.c && r.c.kind !== 'potato') s.push(`Serve ${r.c.kind === 'bread' ? 'on' : 'in'} the ${B.n(r.c)}.`);
        return s;
      } }),
    fmt({ id: 'frittata', name: 'Frittata', method: 'oven', family: 'eggs', meal: 'any', needEgg: true, protein: ['egg'], second: ['sausage', 'bacon', 'deli', 'cooked-poultry', 'ground'], carb: { kinds: ['potato'], need: 'optional' }, veg: [1, 3], vegBad: ['tomato-canned', 'lettuce', 'cucumber', 'root'], cheese: true,
      title: (r) => `${cap(r.fl.title)} ${r.sV1}${r.p2 ? ` & ${lname(r.p2)}` : ''} frittata${r.c ? ` with ${r.sC}` : ''}`,
      pitch: () => `a sliceable, make-ahead egg bake that’s good warm or cold`,
      time: () => ({ prep: 10, cook: 22 }),
      steps(r, B) {
        const s = [`Heat the oven to ${T(400)}.`];
        if (r.c) s.push(carbCook(B, r.c, 'pan'));
        s.push(vegPrepText(B, r.v));
        if (r.p2) {
          const pp = proteinPrep(B, r.p2, 'pan');
          if (pp) s.push(pp);
          s.push(proteinCook(B, r.p2, 'pan', B.p('olive-oil', [0.5, 'tsp'])) || `Warm the ${B.n(r.p2)}.`);
        }
        s.push(vegCook(B, r.v.concat(r.c ? [] : []), 'pan', r.p2 ? null : B.p('olive-oil', [1, 'tsp'])) + (r.c ? ` Add the ${B.s(r.c)} to the pan.` : ''));
        s.push(`Whisk the ${B.n(r.p)} with ${r.fl.season(B)} and ${B.p('salt-pepper', [1, 'pinch'])}${r.ch ? `, stir in most of the ${B.n(r.ch)}` : ''}, and pour over the filling in an oven-safe skillet.`);
        s.push(`Cook on the stove 2 minutes until the edges set, ${r.ch ? `top with the rest of the ${B.n(r.ch)}, ` : ''}then bake 10–14 minutes until the center is just set.`);
        if (r.fl.sauce) s.push(`Serve with ${r.fl.sauce(B)}.`);
        addToppings(r, B, s, { noCheese: true });
        return s;
      } }),
    fmt({ id: 'stuffed', name: 'Stuffed potatoes', method: 'oven', family: 'oven', protein: ['ground', 'sausage', 'poultry', 'cooked-poultry', 'legume', 'canned-fish', 'cottage', 'bacon', 'deli', 'beef'], carb: { kinds: ['potato'], need: 'required' }, veg: [0, 3], vegBad: ['lettuce', 'cucumber', 'tomato-canned'], cheese: true,
      title: (r) => `${cap(r.fl.title)} ${r.sP}-stuffed ${r.c.one || r.sC}${r.v.length ? ` with ${r.sV}` : ''}`,
      pitch: (r) => `fluffy baked ${r.sC} loaded with ${r.sP}`,
      time: () => ({ prep: 10, cook: 25 }),
      steps(r, B) {
        const s = [carbCook(B, r.c, 'whole') + (r.air ? ` Then air-fry at ${T(400)} for 8–10 minutes for crisp skin.` : '')];
        const pp = proteinPrep(B, r.p, 'pan');
        if (pp) s.push(pp);
        s.push(vegPrepText(B, r.v));
        if (r.p.kind === 'cottage') s.push(`Season the ${B.n(r.p)} with ${r.fl.season(B)}.`);
        else if (!pk(r.p).noCook) s.push(`${proteinCook(B, r.p, 'pan', B.p('olive-oil', [1, 'tsp']))} Season with ${r.fl.season(B)}.`);
        else s.push(`Season the ${B.n(r.p)} with ${r.fl.season(B)}.`);
        s.push(vegCook(B, r.v.filter((v) => !vk(v).rawOnly), 'pan'));
        if (r.fl.sauce) s.push(`Stir in ${r.fl.sauce(B)}.`);
        s.push(`Split the ${B.s(r.c)}, fluff the insides with a fork and pile in the filling${r.p.kind === 'cottage' ? ` and the ${B.n(r.p)}` : ''}.`);
        addToppings(r, B, s);
        if (r.fl.finish) s.push(r.fl.finish(B));
        return s;
      } }),
    fmt({ id: 'melt', name: 'Melt / sandwich', method: 'pan', family: 'handheld', meal: 'any', protein: ['canned-fish', 'cooked-poultry', 'deli', 'egg', 'sausage', 'poultry', 'bacon', 'legume', 'pork', 'beef', 'fish-lean'], carb: { kinds: ['bread', 'flatbread'], need: 'required' }, veg: [0, 3], vegBad: ['crucifer', 'root', 'starchy-veg', 'tomato-canned'], cheese: true, yogurtAsMayo: true, avocado: true,
      title: (r) => `${cap(r.fl.title)} ${r.sP} ${r.ch ? 'melt' : 'sandwich'}${r.v.length ? ` with ${r.sV}` : ''}`,
      pitch: (r) => `${r.ch ? 'toasty and melted' : 'stacked and fresh'}, made in about 15 minutes`,
      time: () => ({ prep: 10, cook: 8 }),
      steps(r, B) {
        const s = [];
        const pp = proteinPrep(B, r.p, 'pan');
        if (pp) s.push(pp);
        if (r.p.kind === 'egg') s.push(`Fry or scramble the ${B.n(r.p)} with ${r.fl.season(B)}.`);
        else if (!pk(r.p).noCook) s.push(`${proteinCook(B, r.p, 'pan', B.p('cooking-spray', [1, 'spray']))} Season with ${r.fl.season(B)}.`);
        else s.push(`Mix the ${B.n(r.p)} with ${r.ys ? `the ${B.n(r.ys)} (instead of mayo)` : B.p('dijon', [1, 'tsp'])} and ${r.fl.season(B)}.`);
        s.push(vegPrepText(B, r.v));
        const cookV = r.v.filter((v) => !vk(v).raw);
        if (cookV.length) s.push(vegCook(B, cookV, 'pan'));
        if (r.fl.sauce) s.push(`Spread the ${B.n(r.c)} with ${r.fl.sauce(B)}.`);
        s.push(`Layer the ${r.p.kind === 'egg' || pk(r.p).noCook ? B.n(r.p) : B.s(r.p)}${r.v.length ? ` and ${B.list(r.v)}` : ''}${r.ch ? ` and ${B.n(r.ch)}` : ''} on the ${B.n(r.c)}${r.ch ? `, then toast in a pan or under the broiler until melted` : ''}.`);
        addToppings(r, B, s, { noCheese: true });
        return s;
      } }),
    fmt({ id: 'yogurt', name: 'Yogurt bowl', method: 'none', family: 'nocook', meal: 'breakfast', protein: ['yogurt', 'cottage'], carb: { kinds: ['oats'], need: 'optional' }, veg: [0, 0], needFruit: true, flavorsOnly: ['cinnamon', 'vanillamaple'],
      title: (r) => `${cap(r.fl.title)} ${lname(r.p)} bowl with ${r.sF}`,
      pitch: (r) => `thick, high-protein ${lname(r.p)} with ${r.sF}`,
      time: () => ({ prep: 5, cook: 0 }),
      steps(r, B) {
        const s = [];
        s.push(`Spoon the ${B.n(r.p)} into bowls and stir in ${r.fl.season(B)}.`);
        s.push(`Top with the ${B.list(r.fr)}${r.c ? ` and ${B.n(r.c)}` : ''}${r.nut ? ` and ${B.n(r.nut)}` : ''}.`);
        s.push(`Drizzle with ${r.fl.sauce(B)}.`);
        return s;
      } }),
    fmt({ id: 'oats', name: 'Protein oats', method: 'pan', family: 'nocook', meal: 'breakfast', protein: ['yogurt', 'cottage', 'egg', 'milk'], carb: { kinds: ['oats'], need: 'required' }, veg: [0, 0], needFruit: true, flavorsOnly: ['cinnamon', 'vanillamaple'],
      title: (r) => `${cap(r.fl.title)} protein oats with ${r.sF}`,
      pitch: (r) => `creamy oats made more filling with ${lname(r.p)}`,
      time: () => ({ prep: 3, cook: 6 }),
      steps(r, B) {
        const s = [];
        if (r.p.kind === 'egg') s.push(`Simmer the ${B.n(r.c)} in water (about 1 cup per ½ cup oats) for 3 minutes, then whisk in the ${B.n(r.p)} and stir 1–2 minutes more until thick and creamy.`);
        else if (r.p.kind === 'milk') s.push(`Simmer the ${B.n(r.c)} in the ${B.n(r.p)} for 4–5 minutes, stirring, until creamy.`);
        else s.push(`Simmer the ${B.n(r.c)} in water (about 1 cup per ½ cup oats) for 4–5 minutes; take off the heat and stir in the ${B.n(r.p)}.`);
        s.push(`Stir in ${r.fl.season(B)} and top with the ${B.list(r.fr)}${r.nut ? ` and ${B.n(r.nut)}` : ''}.`);
        s.push(`Drizzle with ${r.fl.sauce(B)}.`);
        return s;
      } }),
  ];
  /** Toppings: cheese, egg on top, avocado, nuts — only things you picked. */
  function addToppings(r, B, s, o) {
    const t = [];
    if (r.ch && !(o && o.noCheese)) t.push(`${r.ch.kind === 'cheese-hard' ? 'grated' : r.ch.kind === 'cheese-crumble' ? 'crumbled' : 'shredded'} ${B.n(r.ch)}`);
    if (r.av) t.push(`sliced ${B.n(r.av)}`);
    if (r.frT) t.push(`diced ${B.n(r.frT)}`);
    if (r.nut && !['yogurt', 'oats'].includes(r.f.id)) t.push(`a sprinkle of ${B.n(r.nut)}`);
    if (r.p2 && r.p2.kind !== 'egg' && !B.used.has(r.p2.id)) {
      const k = pk(r.p2);
      s.push(r.p2.kind === 'bacon' ? `Cook the ${B.n(r.p2)} until crisp, ${range(k.pan)} minutes, then chop and scatter over the top.` : `${proteinCook(B, r.p2, 'pan') || `Warm the ${B.n(r.p2)}.`} Scatter it over the top.`);
    }
    if (r.p2 && r.p2.kind === 'egg' && r.f.eggTop && !['friedrice', 'scramble', 'frittata'].includes(r.f.id)) s.push(`Fry the ${B.n(r.p2)} in ${B.p('cooking-spray', [1, 'spray'])} until the whites set and the yolks are still runny; slide on top.`);
    if (t.length) s.push(`Top with ${join(t)}.`);
    if (r.ys && !s.some((x) => /sauce/.test(x) && x.includes(lname(r.ys)))) s.push(`Serve with the ${B.n(r.ys)} on the side.`);
  }
  function sauceStep(r, B) {
    const parts = [];
    if (r.ys) parts.push(`${B.n(r.ys)} with ${B.acid(r.fl.id === 'chililime' || r.fl.id === 'chipotle' ? 'lime' : 'lemon', 0.5)} and ${B.p('salt-pepper', [1, 'pinch'])}`);
    if (r.fl.sauce) parts.push(r.fl.sauce(B));
    const txt = join(parts);
    return parts.length > 1 || /,| and /.test(txt) ? `Make the sauce: stir together ${txt}.` : `Have the ${txt} ready to spoon over.`;
  }

  /* ═════════════════════ GENERATION ═════════════════════ */
  const NAME_STOP = (ing) => isAromatic(ing);
  /** "rice, bell peppers and broccoli" — carb then the title vegetables, one list. */
  const withList = (r, carbAdj) => {
    const vs = r.v.filter((v) => !NAME_STOP(v));
    return join((r.c ? [(carbAdj || '') + r.sC] : []).concat((vs.length ? vs : r.v).map(lname)));
  };
  /** Readable list of vegetables for a title (aromatics only when nothing else). */
  const vegTitle = (vs) => {
    const main = vs.filter((v) => !NAME_STOP(v));
    return join((main.length ? main : vs).map(lname));
  };
  /** What kind of thing an ingredient can be in a dish. */
  function roleOf(ing) {
    if (ing.cat === 'protein') return 'protein';
    if (ing.cat === 'carb') return 'carb';
    if (ing.cat === 'veg') return ['garlic', 'ginger'].includes(ing.kind) ? 'aroma' : 'veg';
    if (ing.cat === 'fruit') return ing.kind === 'citrus' ? 'citrus' : ing.kind === 'avocado' ? 'avocado' : 'fruit';
    if (ing.cat === 'dairy') return ['yogurt', 'cottage'].includes(ing.kind) ? 'dairyp' : ing.kind === 'milk' ? 'milk' : 'cheese';
    if (ing.cat === 'other') return ['nut', 'seed'].includes(ing.kind) ? 'nut' : 'other';
    return 'other';
  }
  M.roleOf = roleOf;
  const KIND_PROTEIN = (ing) => (ing.cat === 'dairy' ? (ing.kind === 'milk' ? 'milk' : ing.kind) : ing.kind);
  /** Does a flavor clash with any of these ingredients? */
  const clash = (fl, ings) => ings.some((x) => x && (fl.bad.includes(x.kind) || fl.bad.includes(x.id) || (x.cat === 'fruit' && fl.bad.includes('fruit')) || (x.cat === 'dairy' && fl.bad.includes(x.kind))));
  const affinity = (fl, ings) => ings.reduce((a, x) => a + (x && (fl.likes.includes(x.id) || fl.likes.includes(x.kind) || (x.id === 'sweet-potato' && fl.likes.includes('sweet-potato'))) ? 1 : 0), 0);
  /** Small deterministic RNG so tests can reproduce a run. */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Meal ideas from the selected ingredients.
   * opts: { count (default 4), exclude: [keys], avoidFormats, avoidFlavors, seed }
   * Returns { ideas, reason, hints, unused } — reason explains an empty result; hints suggest what would help.
   */
  M.generate = function (opts) {
    opts = opts || {};
    const st = S();
    const pr = st.prefs;
    const count = opts.count || 4;
    const servings = Math.max(1, +pr.servings || 2);
    const rnd = opts.rnd || rng(opts.seed != null ? opts.seed : Date.now());
    const sel = st.selected.map(M.get).filter(Boolean).filter(M.usable);
    const lowCarb = M.lowCarb();
    const by = (r) => sel.filter((x) => roleOf(x) === r);
    const P = by('protein'), C = lowCarb ? [] : by('carb'), V = by('veg'), DP = by('dairyp'), CH = by('cheese'), MILK = by('milk');
    const FRUIT = by('fruit'), AV = by('avocado'), NUT = by('nut');
    const hints = [];
    if (!sel.length) return { ideas: [], reason: 'Pick a few ingredients you have, and Forge will suggest meals.', hints: [] };
    const hasProteinSource = P.length || DP.length || MILK.length;
    if (!hasProteinSource) return { ideas: [], reason: 'Add a protein — eggs, chicken, tuna, Greek yogurt, beans or tofu — and Forge can build meals around it.', hints: [] };
    const styles = new Set(pr.styles || []);
    const meal = pr.mealType || 'any';
    const air = pr.airFryer !== false;
    const maxTime = +pr.maxTime || (styles.has('quick') ? 30 : 0);
    const exclude = new Set(opts.exclude || []);
    const avoidF = new Set(opts.avoidFormats || []), avoidFl = new Set(opts.avoidFlavors || []);
    const recent = st.recent || [];
    const recentF = {}, recentFl = {};
    recent.slice(-24).forEach((r, i, a) => {
      const w = i >= a.length - 8 ? 1 : 0.4;
      recentF[r.format] = (recentF[r.format] || 0) + w;
      recentFl[r.flavor] = (recentFl[r.flavor] || 0) + w;
    });
    const favKeys = new Set(st.favorites.map((f) => f.key));
    const flavors = M.FLAVORS.filter((fl) => !(fl.tags || []).some((t) => blocked().has(t)) && flavorPantryOk(fl));
    const cands = [];
    const eggs = P.filter((x) => x.kind === 'egg');

    M.FORMATS.forEach((f) => {
      if (f.equip === 'airFryer' && !air) return;
      if (meal === 'breakfast' && f.meal === 'main') return;
      if (meal === 'main' && f.meal === 'breakfast') return;
      if (styles.has('onepan') && f.pans > 1) return;
      if (f.needEgg && !eggs.length) return;
      if (f.needFruit && !FRUIT.length) return;
      if (f.needCheese && !CH.length) return;
      // Main item
      // Bacon is a supporting protein (a few slices on top), never the main one
      const mains = (f.needEgg ? eggs : P.concat(DP, MILK)).filter((x) => f.protein.includes(KIND_PROTEIN(x)) && x.kind !== 'bacon');
      mains.forEach((p) => {
        const carbs = C.filter((c) => f.carb.kinds.includes(c.kind));
        if (f.carb.need === 'required' && !carbs.length) return;
        const carbOpts = f.carb.need === 'required' ? carbs : carbs.concat([null]);
        const secondKinds = f.second || ['bacon'];
        const seconds = P.filter((x) => x !== p && secondKinds.includes(x.kind) && (f.second || ['hash', 'pasta', 'salad', 'stuffed', 'melt', 'skillet', 'bowl'].includes(f.id))).concat([null]);
        carbOpts.forEach((c) => {
          if (f.needCarbOrLettuce && !c && !V.some((v) => v.kind === 'lettuce' || v.id === 'cabbage')) return;
          seconds.forEach((p2) => {
            flavors.forEach((fl) => {
              if (f.flavorsOnly ? !f.flavorsOnly.includes(fl.id) : fl.breakfast) return;
              if (!fl.fit.includes(f.id)) return;
              if (clash(fl, [p, p2, c])) return;
              if (fl.bad.includes('yogurt-main') && ['yogurt', 'cottage'].includes(p.kind)) return;
              // Vegetables that suit the format and flavor, most compatible first
              const vOk = V.filter((v) => !f.vegBad.includes(v.kind) && !clash(fl, [v]));
              if (f.needVeg && !vOk.some((v) => f.needVeg.includes(v.kind) || f.needVeg.includes(v.id))) return;
              const ranked = vOk.slice().sort((a, b) => affinity(fl, [b]) - affinity(fl, [a]) || (isAromatic(a) - isAromatic(b)));
              const mains2 = ranked.filter((v) => !isAromatic(v)).slice(0, f.veg[1]);
              const aros = ranked.filter((v) => isAromatic(v)).slice(0, 2);
              const vsets = [mains2.concat(aros)];
              if (mains2.length > 1) vsets.push(mains2.slice(0, Math.max(1, mains2.length - 1)).concat(aros.slice(0, 1)));
              if (f.needCarbOrLettuce && !c) {
                const leaf = vOk.find((v) => v.kind === 'lettuce' || v.id === 'cabbage');
                if (!leaf) return;
                vsets.forEach((vs, i) => !vs.includes(leaf) && (vsets[i] = [leaf].concat(vs.filter((v) => v !== leaf)).slice(0, f.veg[1] + 2)));
              }
              if (!vsets[0].length && f.veg[0] === 0) vsets.splice(1);
              vsets.forEach((vs) => {
                if (vs.filter((v) => !isAromatic(v)).length < f.veg[0]) return;
                if (f.veg[1] === 0 && vs.length) vs = [];
                const ch = f.cheese || f.needCheese ? CH.filter((x) => !clash(fl, [x])).sort((a, b) => affinity(fl, [b]) - affinity(fl, [a]))[0] || null : null;
                if (f.needCheese && !ch) return;
                const ys = (fl.yogurtSauce || f.yogurtAsMayo) && !['yogurt', 'cottage'].includes(p.kind) ? DP.find((x) => x.kind === 'yogurt' || (f.yogurtAsMayo && x.kind === 'cottage')) || null : null;
                const av = f.avocado && AV.length && affinity(fl, AV) ? AV[0] : null;
                const fr = f.needFruit ? FRUIT.slice(0, 2) : [];
                const frT = !f.needFruit && f.fruitOk.length ? FRUIT.find((x) => f.fruitOk.includes(x.id) && affinity(fl, [x])) || null : null;
                const nut = (f.needFruit || f.id === 'salad') ? NUT[0] || null : null;
                const egg2 = !p2 && f.eggTop && p.kind !== 'egg' && eggs.length && ['hash', 'bowl', 'skillet', 'friedrice', 'noodle'].includes(f.id) && (styles.has('protein') || f.id === 'hash' || f.id === 'friedrice') ? eggs[0] : null;
                const r = { f, fl, p, p2: p2 || egg2, c, v: vs, ch, ys, av, fr, frT, nut, air: air && (styles.has('air') || ['stuffed', 'quesadilla'].includes(f.id)) };
                cands.push(r);
              });
            });
          });
        });
      });
    });
    if (!cands.length && P.length && P.every((x) => x.kind === 'bacon')) return { ideas: [], reason: 'Bacon works best alongside another protein — add eggs, chicken or beans and Forge will scatter it on top.', hints: [] };
    if (!cands.length) return { ideas: [], reason: explainNone(sel, P, C, V, DP, CH, FRUIT), hints: suggest(P, C, V) };

    // Build, validate and score
    const built = [];
    const seenKeys = new Set();
    cands.forEach((r) => {
      const rec = M.build(r, servings);
      if (!rec || exclude.has(rec.key) || seenKeys.has(rec.key)) return;
      seenKeys.add(rec.key);
      if (maxTime && rec.prep + rec.cook > maxTime) return;
      const used = new Set(rec.uses);
      let sc = 0;
      sc += Math.min(45, rec.macros.p) / (styles.has('protein') ? 3.5 : pr.protein !== false ? 5.5 : 7);
      sc += used.size * 1.1;
      sc += affinity(r.fl, [r.p, r.c].concat(r.v)) * 0.9;
      sc -= (rec.prep + rec.cook) / (styles.has('quick') ? 6 : 15);
      if (r.f.id === 'air' && air) sc += styles.has('air') ? 4 : 1;
      if (styles.has('air') && r.f.id !== 'air') sc -= 1.5;
      if (styles.has('cleanup') || styles.has('onepan')) sc += r.f.pans === 1 ? 2 : -2.5;
      sc += styles.has('adventurous') ? r.fl.adv * 1.2 : -(r.fl.adv * (pr.practical !== false ? 0.8 : 0.3));
      if (pr.practical !== false && !flavorCommon(r.fl)) sc -= styles.has('adventurous') ? 0 : 1;
      if (meal === 'breakfast' && r.f.meal === 'any') sc += 1;
      sc -= (recentF[r.f.id] || 0) * 1.1 + (recentFl[r.fl.id] || 0) * 1.3; // rotate through dishes and flavors over time
      if (avoidF.has(r.f.id)) sc -= 6;
      if (avoidFl.has(r.fl.id)) sc -= 5;
      if (favKeys.has(rec.key)) sc -= 1.5;
      rec._score = sc + rnd() * 3;
      rec._r = r;
      built.push(rec);
    });
    built.sort((a, b) => b._score - a._score);
    // Pick distinct ideas: different format AND flavor, never the same dish twice
    const out = [];
    const usedF = new Set(), usedFl = new Set(), dish = new Set();
    const dishKey = (x) => [x._r.p.id, x._r.c ? x._r.c.id : '', x._r.v.map((v) => v.id).sort().join('+'), x._r.f.family].join('|');
    const pTake = {};
    for (let pass = 0; pass < 3 && out.length < count; pass++) {
      for (const x of built) {
        if (out.length >= count) break;
        if (out.includes(x) || dish.has(dishKey(x))) continue;
        if (usedF.has(x._r.f.id)) continue;
        if (pass < 2 && usedFl.has(x._r.fl.id)) continue;
        if (pass === 0 && (pTake[x._r.p.id] || 0) >= Math.ceil(count / Math.max(1, P.length + DP.length))) continue;
        out.push(x);
        usedF.add(x._r.f.id);
        usedFl.add(x._r.fl.id);
        dish.add(dishKey(x));
        pTake[x._r.p.id] = (pTake[x._r.p.id] || 0) + 1;
      }
    }
    const ideas = out.map((x) => {
      const y = Object.assign({}, x);
      delete y._r;
      delete y._score;
      y.unused = sel.filter((s) => !x.uses.includes(s.id) && roleOf(s) !== 'aroma').map((s) => s.name);
      return y;
    });
    // Hints: incomplete selections
    if (!V.length) hints.push('Add a vegetable (spinach, peppers, broccoli…) to round these out.');
    if (!C.length && !lowCarb && P.length) hints.push('Add a carb — rice, potatoes, pasta or tortillas — for more filling options.');
    const neverUsed = sel.filter((s) => roleOf(s) !== 'aroma' && !ideas.some((r) => r.uses.includes(s.id)));
    if (neverUsed.length && ideas.length) hints.push(`${join(neverUsed.map((s) => s.name))} didn’t fit these ideas — try “Different ideas”, or pair ${neverUsed.length > 1 ? 'them' : 'it'} with another protein.`);
    st.recent = recent.concat(ideas.map((r) => ({ format: r.format, flavor: r.flavor, key: r.key, at: new Date().toISOString() }))).slice(-40);
    WT.save();
    return { ideas, reason: null, hints, total: built.length };
  };
  const flavorCommon = (fl) => {
    try {
      const B = builder({ pick: () => null, extra: () => {} });
      if (fl.season) fl.season(B);
      if (fl.sauce) fl.sauce(B);
      return [...B.pantry.keys()].every((id) => ING.pantry(id).common !== false);
    } catch (e) {
      return false;
    }
  };
  function flavorPantryOk(fl) {
    try {
      const B = builder({ pick: () => null, extra: () => {} });
      if (fl.season) fl.season(B);
      if (fl.sauce) fl.sauce(B);
      if (fl.finish) fl.finish(B);
      return true;
    } catch (e) {
      return false; // a pantry item it needs is avoided and has no substitute
    }
  }
  function explainNone(sel, P, C, V, DP, CH, FRUIT) {
    if (!P.length && DP.length && !FRUIT.length && !C.length) return `${join(DP.map((x) => x.name))} makes a great sauce or base — add a fruit for a breakfast bowl, oats, or another protein (eggs, chicken, tuna…) for a meal.`;
    if (!P.length && DP.length) return `Add fruit (for a yogurt bowl) or oats, or another protein, to build a meal around ${join(DP.map((x) => x.name.toLowerCase()))}.`;
    if (P.length && P.every((x) => x.kind === 'canned-fish') && !C.length && !V.length) return 'Canned fish needs a partner: add bread or tortillas (for a melt or wraps), pasta, rice, or salad vegetables.';
    return 'These ingredients don’t make a sensible meal together yet — add a vegetable or a carbohydrate, or a different protein.';
  }
  function suggest(P, C, V) {
    const out = [];
    if (!V.length) out.push('A vegetable like spinach, peppers or broccoli');
    if (!C.length) out.push('A carb like rice, potatoes or tortillas');
    return out;
  }

  /** Every name and alias of every ingredient, longest first (for the integrity scan). */
  let NAMES = null;
  function allNames() {
    if (NAMES) return NAMES;
    NAMES = [];
    ING.DB.forEach((x) => [x.name].concat(x.a || []).forEach((n) => NAMES.push({ id: x.id, t: ING.norm(n) })));
    NAMES.sort((a, b) => b.t.length - a.t.length);
    return NAMES;
  }

  /**
   * Turn a chosen combination into a recipe. Returns null if the result fails the integrity check
   * (an instruction mentions something that isn't listed, or a listed ingredient is never used).
   */
  M._fails = []; // integrity failures (should stay empty — tests check it)
  M.build = function (r, servings) {
    const lines = new Map(); // id → q (servings of that ingredient per person)
    const ctx = {
      pick: (k) => {
        const all = [r.p, r.p2, r.c, r.ch, r.av].concat(r.v, r.fr || []).filter(Boolean);
        const selected = S().selected.map(M.get).filter((x) => x && M.usable(x));
        if (k === 'garlic') return selected.find((x) => x.kind === 'garlic') || null;
        if (k === 'ginger') return selected.find((x) => x.kind === 'ginger') || null;
        if (k === 'lemon' || k === 'lime') return selected.find((x) => x.kind === 'citrus' && ING.norm(x.name).includes(k)) || all.find((x) => x && x.kind === 'citrus' && ING.norm(x.name).includes(k)) || null;
        return null;
      },
      extra: (ing, q) => lines.set(ing.id, (lines.get(ing.id) || 0) + q),
    };
    const B = builder(ctx);
    // Names used in titles
    const sP = shortTitle(r.p);
    const nv = r.v.filter((v) => !NAME_STOP(v));
    Object.assign(r, { sP, sC: r.c ? lname(r.c) : '', sV: vegTitle(r.v), sV1: lname(nv[0] || r.v[0] || r.p), sF: join((r.fr || []).map(lname)) });
    let steps;
    try {
      steps = r.f.steps(r, B).filter(Boolean).map((x) => x.replace(/\s+/g, ' ').replace(/\s+([.,])/g, '$1').trim());
    } catch (e) {
      if (e instanceof Skip) return null;
      throw e;
    }
    // Portions of your ingredients (per person)
    const prot = styles().has('protein') ? 1.2 : 1;
    const nV = r.v.filter((v) => !isAromatic(v)).length;
    const vEach = nV <= 1 ? 1.25 : nV === 2 ? 0.9 : 0.7;
    const portion = (ing, role) => {
      if (role === 'main') {
        if (ing.cat === 'dairy') return ing.kind === 'cottage' ? (r.f.id === 'pasta' ? 1.25 : 1.5) : ing.kind === 'milk' ? 1 : 1.33;
        return (ing.meal || 1) * (r.p2 && r.p2.kind !== 'egg' ? 0.75 : 1) * prot;
      }
      if (role === 'second') return ing.kind === 'egg' ? (r.f.needEgg ? 1 : 1) : Math.max(0.5, (ing.meal || 1) * 0.5);
      if (role === 'carb') return ing.kind === 'oats' ? 1 : ing.meal || 1;
      if (role === 'veg') {
        if (ing.kind === 'garlic') return 1 / (ing.serving.n || 1);
        if (ing.kind === 'allium') return 0.33;
        if (ing.kind === 'chili') return 0.5;
        if (ing.kind === 'scallion') return 0.5;
        return vEach;
      }
      if (role === 'cheese') return ing.kind === 'cheese-hard' ? 1 : 0.75;
      if (role === 'ys') return 0.33;
      if (role === 'avocado') return 0.5;
      if (role === 'fruit') return r.fr && r.fr.length > 1 ? 0.5 : 0.75;
      if (role === 'frT') return 0.33;
      if (role === 'nut') return 0.5;
      return 1;
    };
    const add = (ing, role) => ing && lines.set(ing.id, (lines.get(ing.id) || 0) + portion(ing, role));
    add(r.p, 'main');
    if (r.p2) add(r.p2, 'second');
    if (r.c) add(r.c, 'carb');
    r.v.forEach((v) => add(v, 'veg'));
    if (r.ch) add(r.ch, 'cheese');
    if (r.ys) add(r.ys, 'ys');
    if (r.av) add(r.av, 'avocado');
    (r.fr || []).forEach((x) => add(x, 'fruit'));
    if (r.frT) add(r.frT, 'frT');
    if (r.nut) add(r.nut, 'nut');
    // Integrity: listed ⇄ used
    // Ingredient list order: main protein, second protein, carb, vegetables, dairy, fruit, then aromatics / citrus
    const order = (id) => {
      if (id === r.p.id) return 0;
      if (r.p2 && id === r.p2.id) return 1;
      if (r.c && id === r.c.id) return 2;
      const ing = M.get(id);
      const role = ing ? roleOf(ing) : 'other';
      return { veg: 3, cheese: 4, dairyp: 4, milk: 4, fruit: 5, avocado: 5, nut: 6, other: 6, aroma: 7, citrus: 8 }[role] || 6;
    };
    const listed = [...lines.keys()].sort((a, b) => order(a) - order(b));
    const unusedListed = listed.filter((id) => !B.used.has(id));
    const unlistedUsed = [...B.used].filter((id) => !lines.has(id));
    if (unusedListed.length || unlistedUsed.length) {
      M._fails.push({ why: 'listed⇄used', f: r.f.id, fl: r.fl.id, unusedListed, unlistedUsed });
      return null;
    }
    const mine = listed.map((id) => {
      const ing = M.get(id);
      return { id, name: ing.name, cat: ing.cat, q: lines.get(id), unit: ing.serving.unit, state: ing.serving.state, status: ing.status, label: ing.label || '', macros: perQ(ing.macros, lines.get(id)), optional: false };
    });
    const pantry = [...B.pantry.entries()].map(([id, q]) => {
      const x = ING.pantry(id);
      return { id, name: x.name, q, unit: x.serving.unit, serving: x.serving, macros: perQ(ING.servingMacros(x), q), pantry: true };
    });
    const optional = [...B.optional.keys()].map((id) => ({ id, name: ING.pantry(id).name }));
    const text = steps.join(' ');
    const bad = integrityScan(text, mine, pantry, optional, B.short);
    if (bad.length) {
      M._fails.push({ why: 'text', f: r.f.id, fl: r.fl.id, found: bad, text });
      return null;
    }
    const t = r.f.time(r);
    const key = [r.f.id, r.fl.id, r.p.id, r.p2 ? r.p2.id : '', r.c ? r.c.id : '', r.v.map((v) => v.id).sort().join('+'), [r.ch, r.ys, r.av, r.frT, r.nut].concat(r.fr || []).filter(Boolean).map((x) => x.id).sort().join('+')].join('|');
    const rec = {
      v: 2, key, format: r.f.id, flavor: r.fl.id, method: r.f.name, family: r.f.family,
      name: cap(r.f.title(r).replace(/\s+/g, ' ').trim()),
      description: `${cap(r.f.pitch(r))} — ${r.fl.proper ? r.fl.taste : r.fl.taste[0].toLowerCase() + r.fl.taste.slice(1)}.`.replace(/\s+/g, ' '),
      airFryer: r.f.id === 'air' || steps.some((s) => /air-fry/i.test(s)), onePan: r.f.pans === 1,
      prep: t.prep, cook: t.cook, servings,
      lines: mine.concat(pantry), optional, steps,
      uses: listed,
    };
    rec.macros = M.recipeMacros(rec);
    return rec;
  };
  const styles = () => new Set(S().prefs.styles || []);
  const shortTitle = (ing) => (ing.kind === 'egg' ? 'egg' : lname(ing).replace(/^\d+\/\d+ /, ''));
  const perQ = (m, q) => Object.fromEntries(Object.entries(m || {}).map(([k, v]) => [k, v == null ? null : v * q]));

  /**
   * Text-level integrity guard: after removing every listed ingredient name (and the short references the
   * builder registered), pantry names and optional items, no other ingredient name may remain in the steps.
   */
  function integrityScan(text, mine, pantry, optional, short) {
    let t = ' ' + ING.norm(text) + ' ';
    const mask = (n) => {
      const k = ING.norm(n);
      if (!k) return;
      t = t.split(' ' + k + ' ').join(' # ');
      // plural / singular variants
      const alt = k.endsWith('s') ? k.slice(0, -1) : k + 's';
      t = t.split(' ' + alt + ' ').join(' # ');
    };
    const names = [];
    pantry.forEach((x) => names.push(x.name));
    optional.forEach((x) => names.push(x.name));
    mine.forEach((x) => {
      names.push(x.name);
      const ing = M.get(x.id);
      if (ing && ING.get(x.id)) (ING.get(x.id).a || []).forEach((a) => names.push(a));
      (short[x.id] ? [...short[x.id]] : []).forEach((s) => names.push(s));
    });
    names.sort((a, b) => ING.norm(b).length - ING.norm(a).length).forEach(mask);
    const listedIds = new Set(mine.map((x) => x.id));
    const found = [];
    // Basic pantry words must also be listed: any mention of oil or salt needs an oil / salt line
    const raw = ' ' + ING.norm(text) + ' ';
    const pIds = new Set(pantry.map((x) => x.id).concat(optional.map((x) => x.id)));
    if (/ (oil|oils) /.test(raw) && !['olive-oil', 'sesame-oil', 'cooking-spray'].some((id) => pIds.has(id))) found.push('oil');
    if (/ salt /.test(raw) && !pIds.has('salt-pepper') && !pIds.has('cajun')) found.push('salt');
    allNames().forEach((e) => {
      if (listedIds.has(e.id)) return;
      if (t.includes(' ' + e.t + ' ')) found.push(e.t);
    });
    // Custom ingredient names you have that aren't listed
    S().custom.forEach((c) => {
      if (!listedIds.has(c.id) && t.includes(' ' + ING.norm(c.name) + ' ')) found.push(c.name);
    });
    return found;
  }
  M._integrityScan = integrityScan;

  /** Nutrition per serving from the ingredient quantities (live values: your corrections apply). */
  M.recipeMacros = function (rec) {
    const tot = { cal: 0, p: 0, c: 0, f: 0, fiber: 0, sugar: 0 };
    let fiberKnown = true, sugarKnown = true, est = 0, yours = 0, n = 0;
    (rec.lines || []).forEach((l) => {
      let m = l.macros;
      if (!l.pantry && !l.legacy) {
        const ing = M.get(l.id);
        if (ing) {
          m = perQ(ing.macros, l.q);
          n++;
          if (ing.status === 'estimated') est++;
          else yours++;
        }
      }
      if (!m) return;
      ['cal', 'p', 'c', 'f'].forEach((k) => (tot[k] += +m[k] || 0));
      if (m.fiber == null) fiberKnown = !l.pantry ? false : fiberKnown;
      else tot.fiber += m.fiber;
      if (m.sugar == null) sugarKnown = !l.pantry ? false : sugarKnown;
      else tot.sugar += m.sugar;
    });
    return {
      cal: Math.round(tot.cal / 10) * 10, p: Math.round(tot.p), c: Math.round(tot.c), f: Math.round(tot.f),
      fiber: fiberKnown ? Math.round(tot.fiber) : null, sugar: sugarKnown ? Math.round(tot.sugar) : null,
      estimated: est, yours, ingredients: n, exact: { cal: tot.cal, p: tot.p, c: tot.c, f: tot.f },
    };
  };
  /** Display amounts for a recipe at its current servings. */
  M.lineAmount = function (l, servings) {
    if (l.legacy) return l.amount || '';
    if (l.pantry) {
      if (l.id === 'salt-pepper') return 'to taste';
      const x = ING.pantry(l.id);
      return x ? M.fmtAmount(l.q * x.serving.n * servings, x.serving.unit) : '';
    }
    const ing = M.get(l.id);
    if (!ing) return M.fmtAmount(l.q * servings, l.unit);
    return amountText(ing, l.q * servings);
  };
  M.rescale = function (rec, servings) {
    if (rec.v !== 2) return null;
    const out = Object.assign({}, rec, { servings: Math.max(1, Math.min(12, servings)) });
    out.macros = M.recipeMacros(out);
    return out;
  };

  /* ═════════════════════ SAVED RECIPES & LOGGING ═════════════════════ */
  /** Saved recipes from the first meal planner keep their text; shown as-is (amounts fixed). */
  M.normalizeRecipe = function (r) {
    if (!r) return null;
    if (r.v === 2) return Object.assign({}, r, { macros: M.recipeMacros(r) });
    const lines = (r.mine || []).map((x) => ({ id: x.id, name: x.name, amount: x.amount, legacy: true, macros: x.m ? { cal: x.m.cal, p: x.m.p, c: x.m.c, f: x.m.f } : null }))
      .concat((r.extras || []).map((x) => ({ id: x.id, name: x.name, amount: x.amount, legacy: true, pantry: true, macros: x.m ? { cal: x.m.cal, p: x.m.p, c: x.m.c, f: x.m.f } : null })));
    return Object.assign({}, r, { legacy: true, lines, optional: [], description: r.description || '', macros: Object.assign({ fiber: null, sugar: null, estimated: lines.length, yours: 0 }, r.macros || {}) });
  };
  M.isFavorite = (key) => S().favorites.some((f) => f.key === key);
  M.toggleFavorite = function (recipe) {
    const st = S();
    if (M.isFavorite(recipe.key)) st.favorites = st.favorites.filter((f) => f.key !== recipe.key);
    else {
      const copy = JSON.parse(JSON.stringify(recipe));
      delete copy.unused;
      st.favorites.unshift(Object.assign(copy, { savedAt: new Date().toISOString() }));
    }
    WT.save();
    return M.isFavorite(recipe.key);
  };
  /**
   * Log one serving to the food diary with the recipe's own ingredient-based totals.
   * Confidence: "Confirmed by you" only when every ingredient uses your or verified values; otherwise Estimate.
   */
  M.logServing = function (recipe, date) {
    const N = WT.nut;
    if (!N) return null;
    const r = M.normalizeRecipe(recipe);
    const m = r.legacy ? r.macros : M.recipeMacros(r);
    const allYours = !r.legacy && m.ingredients > 0 && m.estimated === 0;
    const exact = m.exact || m;
    const added = N.addItems([{
      name: r.name, qty: 1, unit: 'serving', per: { p: Math.round(exact.p), cal: Math.round(exact.cal), c: Math.round(exact.c), f: Math.round(exact.f) },
      src: 'recipe', conf: allYours ? 'user' : 'estimated', text: r.name,
      note: `Meal idea · 1 of ${r.servings} servings · calculated from ${r.legacy ? 'the saved recipe' : `${m.ingredients} ingredients`}${allYours ? '' : ' (estimates)'}`,
    }], date);
    if (added && added[0]) added[0].recipe = { key: r.key, servings: r.servings, ingredients: (r.lines || []).filter((l) => !l.pantry).map((l) => l.id) };
    WT.save();
    return added && added[0];
  };
  M.totalTime = (r) => (r.prep || 0) + (r.cook || 0);
})();
