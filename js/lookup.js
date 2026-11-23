/* Online food lookup: USDA FoodData Central (generic + branded reference data) and Open Food Facts
 * (branded grocery products, barcodes), with a local cache so anything found once works offline.
 *
 * Services (both free):
 *   USDA FoodData Central  https://api.nal.usda.gov/fdc/v1/foods/search — needs an api.data.gov key.
 *     Forge never ships a private key. It uses the public DEMO_KEY (≈30 requests an hour per IP) unless you
 *     paste your own free key in Settings; that key stays in this browser and is left out of backups.
 *     Data: public domain (US government work).
 *   Open Food Facts  https://world.openfoodfacts.org — no key. Product by barcode via /api/v2/product/{code};
 *     text search via Search-a-licious (search.openfoodfacts.org/search), falling back to the classic
 *     /cgi/search.pl endpoint. Data: ODbL, community-entered — shown as an estimate until you confirm it.
 *     (Browsers don't allow setting the User-Agent header Open Food Facts asks apps for; requests come
 *     straight from your device and fall under its per-user rate limits.)
 *
 * Status of a result (always shown):
 *   USDA Foundation / SR Legacy / Survey (FNDDS) → 'reference'   (lab or survey reference values)
 *   USDA Branded                                  → 'reference'   (manufacturer-submitted label data)
 *   Open Food Facts                               → 'estimated'   (community data: check your label)
 * A result missing a value keeps it missing (null) — nothing is filled in.
 *
 * Nothing here is required: logging works offline from the bundled database, your foods and this cache.
 */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const L = (WT.lookup = WT.lookup || {});
  const FDC = 'https://api.nal.usda.gov/fdc/v1';
  const OFF = 'https://world.openfoodfacts.org';
  const OFF_SEARCH = 'https://search.openfoodfacts.org/search';
  const OFF_FIELDS = 'code,product_name,product_name_en,brands,quantity,serving_size,serving_quantity,nutriments,nutrition_data_per,image_front_small_url';
  const CACHE_KEY = 'wt.foodcache.v1';
  const MAX_ITEMS = 600, MAX_QUERIES = 200, QUERY_TTL = 14 * 864e5, MISS_TTL = 864e5;

  /* ───────── Settings ───────── */
  const P = () => (WT.db && WT.db.profile) || {};
  L.enabled = () => P().onlineLookup !== false;
  L.fdcKey = () => String(P().fdcKey || '').trim() || 'DEMO_KEY';
  L.usingDemoKey = () => L.fdcKey() === 'DEMO_KEY';

  /* ───────── Cache (separate from your data; never exported) ───────── */
  const store = globalThis.localStorage || { getItem: () => null, setItem: () => {} };
  let cache = null;
  function C() {
    if (cache) return cache;
    try {
      cache = JSON.parse(store.getItem(CACHE_KEY)) || null;
    } catch (e) {
      cache = null;
    }
    if (!cache || cache.v !== 1) cache = { v: 1, items: {}, queries: {}, codes: {} };
    return cache;
  }
  function persist() {
    const c = C();
    // keep it bounded: least recently used out first
    const ids = Object.keys(c.items);
    if (ids.length > MAX_ITEMS) ids.sort((a, b) => (c.items[a].used || 0) - (c.items[b].used || 0)).slice(0, ids.length - MAX_ITEMS).forEach((id) => delete c.items[id]);
    const qs = Object.keys(c.queries);
    if (qs.length > MAX_QUERIES) qs.sort((a, b) => c.queries[a].at - c.queries[b].at).slice(0, qs.length - MAX_QUERIES).forEach((k) => delete c.queries[k]);
    try {
      store.setItem(CACHE_KEY, JSON.stringify(c));
    } catch (e) {
      // storage full: drop half the cache rather than fail
      Object.keys(c.items).slice(0, Math.floor(Object.keys(c.items).length / 2)).forEach((k) => delete c.items[k]);
      try {
        store.setItem(CACHE_KEY, JSON.stringify(c));
      } catch (e2) {}
    }
  }
  L.cacheStats = () => ({ items: Object.keys(C().items).length, queries: Object.keys(C().queries).length });
  L.clearCache = () => {
    cache = { v: 1, items: {}, queries: {}, codes: {} };
    persist();
  };
  L.cached = (id) => C().items[id] || (String(id).startsWith('usda:') ? L.usdaRecord(id) : null);

  /* ───────── Offline USDA database (js/data/usda.json, built by tools/build-usda.js) ───────── */
  let usdaP = null;
  L.offlineDB = () => WT.USDA_DB || null;
  /** Load the bundled USDA file once (it's cached with the app, so this works offline). Never throws. */
  L.loadOffline = function () {
    if (WT.USDA_DB) return Promise.resolve(WT.USDA_DB);
    if (usdaP) return usdaP;
    if (typeof fetch !== 'function') return Promise.resolve(null);
    usdaP = fetch('js/data/usda.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => L.setOfflineDB(j))
      .catch(() => null);
    return usdaP;
  };
  L.setOfflineDB = function (j) {
    if (!j || !Array.isArray(j.foods)) return null;
    WT.USDA_DB = j;
    WT.USDA_INDEX = new Map(j.foods.map((f) => [String(f[0]), f]));
    return j;
  };
  L.usdaRecord = function (id) {
    const f = WT.USDA_INDEX && WT.USDA_INDEX.get(String(id).replace(/^usda:/, ''));
    if (!f) return null;
    const [fdcId, desc, cal, p, c, fat, cat, portions] = f;
    const por = (portions || [])[0];
    return {
      id: 'usda:' + fdcId, src: 'fdc', dataType: cat || 'USDA', name: desc, brand: '', code: '', per100: { cal, p, c, f: fat },
      serving: por ? { g: por[1], text: `${por[0]} (${Math.round(por[1])} g)` } : null, portions: portions || [], status: 'reference',
      source: { name: 'USDA FoodData Central (offline copy)', url: `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients` },
    };
  };
  /** Search the offline USDA copy by words in the description. */
  L.searchOffline = function (q, limit) {
    const db = WT.USDA_DB;
    if (!db || !db.foods.length) return [];
    const toks = qkey(q).split(' ').filter((t) => t.length > 1).map((t) => t.replace(/s$/, ''));
    if (!toks.length) return [];
    const out = [];
    for (const f of db.foods) {
      const d = String(f[1]).toLowerCase();
      let h = 0;
      for (const t of toks) if (d.includes(t)) h++;
      if (h === toks.length) out.push({ f, s: h - d.length / 400 - (d.indexOf(toks[0]) > 0 ? 0.3 : 0) });
    }
    return out.sort((a, b) => b.s - a.s).slice(0, limit || 10).map((x) => L.usdaRecord(x.f[0]));
  };
  function remember(rec) {
    if (!rec) return rec;
    rec.used = Date.now();
    C().items[rec.id] = rec;
    return rec;
  }
  const qkey = (q) => String(q || '').toLowerCase().replace(/[^a-z0-9+% ]+/g, ' ').replace(/\s+/g, ' ').trim();

  /* ───────── Barcodes ───────── */
  /** Digits only; a 12-digit UPC-A and its 13-digit EAN form compare equal. */
  L.normCode = (c) => String(c || '').replace(/\D/g, '');
  L.sameCode = (a, b) => {
    const x = L.normCode(a).replace(/^0+/, ''), y = L.normCode(b).replace(/^0+/, '');
    return !!x && x === y;
  };
  /** GS1 check digit (EAN-8, UPC-A, EAN-13, GTIN-14). */
  L.validCode = function (c) {
    c = L.normCode(c);
    if (![8, 12, 13, 14].includes(c.length)) return false;
    const d = c.split('').map(Number);
    const check = d.pop();
    let sum = 0;
    d.reverse().forEach((v, i) => (sum += v * (i % 2 === 0 ? 3 : 1)));
    return (10 - (sum % 10)) % 10 === check;
  };

  /* ───────── Normalizing results ───────── */
  const num = (v) => (v == null || v === '' || isNaN(+v) ? null : +v);
  const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
  const titleCase = (s) => String(s || '').toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  const NUTR = { cal: [1008, 2047, 2048], p: [1003], c: [1005], f: [1004] };
  const NUTR_NO = { cal: ['208', '957', '958'], p: ['203'], c: ['205'], f: ['204'] };
  /** USDA FoodData Central search hit → record (values per 100 g). */
  L.fromFDC = function (f) {
    if (!f || !f.fdcId || !f.description) return null;
    const ns = f.foodNutrients || [];
    const get = (k) => {
      for (const id of NUTR[k]) {
        const n = ns.find((x) => +x.nutrientId === id && (k !== 'cal' || /kcal/i.test(x.unitName || 'kcal')));
        if (n && num(n.value) != null) return num(n.value);
      }
      for (const no of NUTR_NO[k]) {
        const n = ns.find((x) => String(x.nutrientNumber) === no && (k !== 'cal' || /kcal/i.test(x.unitName || 'kcal')));
        if (n && num(n.value) != null) return num(n.value);
      }
      return null;
    };
    const per100 = { cal: r1(get('cal')), p: r1(get('p')), c: r1(get('c')), f: r1(get('f')) };
    if (per100.p == null && per100.cal == null) return null;
    let serving = null;
    const su = String(f.servingSizeUnit || '').toLowerCase();
    if (num(f.servingSize) > 0 && /^(g|grm|gram|ml|mlt)$/.test(su)) serving = { g: num(f.servingSize), text: f.householdServingFullText ? `${f.householdServingFullText} (${num(f.servingSize)} ${su.startsWith('m') ? 'ml' : 'g'})` : `${num(f.servingSize)} ${su.startsWith('m') ? 'ml' : 'g'}`, ml: su.startsWith('m') };
    else {
      const m = (f.foodMeasures || []).find((x) => num(x.gramWeight) > 0 && x.disseminationText && !/not specified/i.test(x.disseminationText));
      if (m) serving = { g: num(m.gramWeight), text: `${m.disseminationText} (${Math.round(num(m.gramWeight))} g)` };
    }
    const branded = f.dataType === 'Branded';
    return {
      id: 'fdc:' + f.fdcId, src: 'fdc', dataType: f.dataType || '', name: branded ? titleCase(f.description) : f.description, brand: branded ? titleCase(f.brandName || f.brandOwner || '') : '',
      code: f.gtinUpc ? L.normCode(f.gtinUpc) : '', per100, serving, status: 'reference',
      source: { name: branded ? 'USDA FoodData Central · Branded (manufacturer label data)' : `USDA FoodData Central · ${f.dataType || 'reference'}`, url: `https://fdc.nal.usda.gov/food-details/${f.fdcId}/nutrients` },
    };
  };
  /** Open Food Facts product → record (per 100 g, plus the label serving when given). */
  L.fromOFFProduct = function (p) {
    if (!p) return null;
    const name = String(p.product_name || p.product_name_en || '').trim();
    if (!name) return null;
    const n = p.nutriments || {};
    const v = (k, s) => num(n[k + s]);
    const per100 = { cal: r1(v('energy-kcal', '_100g')), p: r1(v('proteins', '_100g')), c: r1(v('carbohydrates', '_100g')), f: r1(v('fat', '_100g')) };
    const perServing = { cal: r1(v('energy-kcal', '_serving')), p: r1(v('proteins', '_serving')), c: r1(v('carbohydrates', '_serving')), f: r1(v('fat', '_serving')) };
    // kJ only: convert honestly (1 kcal = 4.184 kJ) — that's a unit conversion, not a guess
    if (per100.cal == null && v('energy-kj', '_100g') != null) per100.cal = r1(v('energy-kj', '_100g') / 4.184);
    const has = (o) => o.p != null || o.cal != null;
    if (!has(per100) && !has(perServing)) return null;
    const g = num(p.serving_quantity);
    const serving = g > 0 ? { g, text: p.serving_size || `${g} g` } : p.serving_size ? { g: null, text: p.serving_size } : null;
    const code = L.normCode(p.code || p._id);
    return {
      id: 'off:' + code, src: 'off', name, brand: String(p.brands || '').split(',')[0].trim(), code, quantity: p.quantity || '',
      per100: has(per100) ? per100 : null, perServing: has(perServing) ? perServing : null, serving, status: 'estimated',
      source: { name: 'Open Food Facts (community data — check your label)', url: `${OFF}/product/${code}` },
    };
  };
  /** Macros for one serving if we know it, else for 100 g. → { per, unit, g, text } */
  L.servingOf = function (rec) {
    const s = rec.serving;
    if (s && s.g > 0 && rec.per100) {
      const k = s.g / 100;
      const per = {};
      ['cal', 'p', 'c', 'f'].forEach((x) => (per[x] = rec.per100[x] == null ? (rec.perServing ? rec.perServing[x] : null) : r1(rec.per100[x] * k)));
      return { per, unit: 'serving', g: s.g, text: s.text };
    }
    if (rec.perServing && (rec.perServing.p != null || rec.perServing.cal != null)) return { per: rec.perServing, unit: 'serving', g: s && s.g, text: (s && s.text) || '1 serving (label)' };
    return { per: rec.per100, unit: '100 g', g: 100, text: '100 g' };
  };

  /* ───────── Network ───────── */
  function offlineErr() {
    const e = new Error('You’re offline');
    e.kind = 'offline';
    return e;
  }
  async function getJSON(url, ms) {
    if (typeof fetch !== 'function') throw offlineErr();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw offlineErr();
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), ms || 9000);
    try {
      const r = await fetch(url, ctl ? { signal: ctl.signal, headers: { Accept: 'application/json' } } : undefined);
      if (r.status === 429) throw Object.assign(new Error('rate limited'), { kind: 'rate' });
      if (r.status === 503) throw Object.assign(new Error('busy'), { kind: 'busy' });
      if (r.status === 403 || r.status === 401) throw Object.assign(new Error('key'), { kind: 'key' });
      if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { kind: 'http' });
      return await r.json();
    } catch (e) {
      if (e.kind) throw e;
      throw Object.assign(new Error(e.name === 'AbortError' ? 'timed out' : 'unreachable'), { kind: e.name === 'AbortError' ? 'timeout' : 'network' });
    } finally {
      clearTimeout(t);
    }
  }
  /** What to tell you when a source fails. */
  L.errorText = function (src, e) {
    const who = src === 'fdc' ? 'USDA FoodData Central' : 'Open Food Facts';
    if (e.kind === 'offline') return 'You’re offline — showing foods saved on this device.';
    if (e.kind === 'rate') return src === 'fdc' ? `${who}: hourly limit reached${L.usingDemoKey() ? ' for the shared demo key — add your own free key in Settings' : ''}.` : `${who} is limiting requests; try again in a minute.`;
    if (e.kind === 'key') return `${who} rejected the API key — check it in Settings.`;
    if (e.kind === 'busy') return `${who} is busy right now.`;
    if (e.kind === 'timeout') return `${who} didn’t answer in time.`;
    return `Couldn’t reach ${who}.`;
  };

  L.fdcUrl = (q, n) => `${FDC}/foods/search?` + new URLSearchParams({ api_key: L.fdcKey(), query: q, pageSize: String(n || 12), dataType: 'Foundation,SR Legacy,Survey (FNDDS),Branded' });
  L.offSearchUrl = (q, n) => `${OFF_SEARCH}?` + new URLSearchParams({ q, page_size: String(n || 12), langs: 'en', fields: OFF_FIELDS });
  L.offLegacyUrl = (q, n) => `${OFF}/cgi/search.pl?` + new URLSearchParams({ search_terms: q, search_simple: '1', action: 'process', json: '1', page_size: String(n || 12), fields: OFF_FIELDS });
  L.offProductUrl = (code) => `${OFF}/api/v2/product/${encodeURIComponent(L.normCode(code))}.json?fields=${OFF_FIELDS}`;

  async function fdcSearch(q) {
    const j = await getJSON(L.fdcUrl(q, 15));
    return (j.foods || []).map(L.fromFDC).filter(Boolean);
  }
  async function offSearch(q) {
    let j = null;
    try {
      j = await getJSON(L.offSearchUrl(q, 15));
    } catch (e) {
      if (e.kind === 'offline') throw e;
      j = null;
    }
    let list = j && (Array.isArray(j.hits) ? j.hits : Array.isArray(j.products) ? j.products : null);
    if (!list) list = ((await getJSON(L.offLegacyUrl(q, 15))).products || []);
    return list.map(L.fromOFFProduct).filter(Boolean);
  }

  /** Search both services. Never throws. → { results, errors: [{src, text}], cached: bool } */
  L.search = async function (q) {
    const k = qkey(q);
    if (!k || k.length < 2) return { results: [], errors: [], cached: false };
    const c = C();
    const hit = c.queries[k];
    const fromCache = () => (hit ? hit.ids.map((id) => c.items[id]).filter(Boolean) : []);
    if (hit && Date.now() - hit.at < QUERY_TTL) return { results: fromCache(), errors: [], cached: true };
    if (!L.enabled()) return { results: fromCache(), errors: [{ src: 'all', text: 'Online lookup is off (Settings → Nutrition).' }], cached: true };
    const [a, b] = await Promise.allSettled([fdcSearch(q), offSearch(q)]);
    const errors = [];
    const results = [];
    if (a.status === 'fulfilled') results.push(...a.value);
    else errors.push({ src: 'fdc', text: L.errorText('fdc', a.reason) });
    if (b.status === 'fulfilled') results.push(...b.value);
    else errors.push({ src: 'off', text: L.errorText('off', b.reason) });
    if (a.status === 'rejected' && b.status === 'rejected') {
      // both failed: whatever we found before is still useful
      return { results: fromCache(), errors: errors.slice(0, a.reason.kind === 'offline' ? 1 : 2), cached: true };
    }
    results.forEach(remember);
    c.queries[k] = { at: Date.now(), ids: results.map((r) => r.id) };
    persist();
    return { results, errors, cached: false };
  };

  /** Look up a barcode: your saved foods → Forge's bundled products → cache → Open Food Facts → USDA Branded. Never throws.
   * → { rec, from: 'library'|'bundled'|'cache'|'off'|'fdc', libId, ref } | { rec: null, errors } */
  L.barcode = async function (code) {
    code = L.normCode(code);
    const lib = ((WT.db && WT.db.nutrition && WT.db.nutrition.foods) || []).find((f) => f.code && L.sameCode(f.code, code));
    if (lib) return { rec: null, libId: lib.id, from: 'library' };
    // a product bundled with Forge whose barcode is printed in a retailer / Open Food Facts listing
    const bp = WT.nut && WT.nut.productByCode && WT.nut.productByCode(code);
    if (bp) return { rec: null, ref: 'p:' + bp.x.id, flavor: bp.flavor, from: 'bundled' };
    const c = C();
    const known = Object.values(c.items).find((r) => r.code && L.sameCode(r.code, code));
    if (known) return { rec: remember(known), from: 'cache' };
    const miss = c.codes[code];
    if (miss && miss.none && Date.now() - miss.at < MISS_TTL) return { rec: null, errors: [], notFound: true };
    if (!L.enabled()) return { rec: null, errors: [{ src: 'all', text: 'Online lookup is off (Settings → Nutrition).' }] };
    const errors = [];
    try {
      const j = await getJSON(L.offProductUrl(code));
      const rec = j && (j.status === 1 || j.status === 'success' || j.product) ? L.fromOFFProduct(Object.assign({ code }, j.product)) : null;
      if (rec) {
        remember(rec);
        persist();
        return { rec, from: 'off' };
      }
    } catch (e) {
      errors.push({ src: 'off', text: L.errorText('off', e) });
      if (e.kind === 'offline') return { rec: null, errors };
    }
    try {
      const j = await getJSON(`${FDC}/foods/search?` + new URLSearchParams({ api_key: L.fdcKey(), query: code, dataType: 'Branded', pageSize: '5' }));
      const f = (j.foods || []).find((x) => L.sameCode(x.gtinUpc, code));
      const rec = f && L.fromFDC(f);
      if (rec) {
        remember(rec);
        persist();
        return { rec, from: 'fdc' };
      }
    } catch (e) {
      errors.push({ src: 'fdc', text: L.errorText('fdc', e) });
    }
    if (!errors.length) {
      c.codes[code] = { none: true, at: Date.now() };
      persist();
    }
    return { rec: null, errors, notFound: !errors.length };
  };

  /** Offline search over everything fetched before. */
  L.searchCache = function (q, limit) {
    const toks = qkey(q).split(' ').filter((t) => t.length > 1);
    if (!toks.length) return [];
    return Object.values(C().items)
      .map((r) => {
        const hay = `${r.brand} ${r.name}`.toLowerCase();
        const h = toks.filter((t) => hay.includes(t)).length;
        return { r, s: h / toks.length };
      })
      .filter((x) => x.s >= 0.99 || (toks.length > 2 && x.s >= 0.66))
      .sort((a, b) => b.s - a.s || (b.r.used || 0) - (a.r.used || 0))
      .slice(0, limit || 10)
      .map((x) => x.r);
  };
})();
