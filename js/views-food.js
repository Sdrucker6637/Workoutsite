/* Views: Food — a daily food diary with natural-language logging. Parsing and storage live in nutrition.js.
 *
 *   Diary   summary (calories + macros vs targets) → "What did you eat?" → Breakfast / Lunch / Dinner / Snacks
 *   Review  every recognized item is editable before logging: amount, unit, match, values; add or remove items
 *   Trends  averages, protein-target days and logging consistency over 7 / 30 / 90 days
 */
(function () {
  const WT = globalThis.WT;
  const I = WT.icon, esc = WT.esc, H = WT.h, A = WT.A, V = WT.V, N = WT.nut;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const ui = () => (WT.ui.food = WT.ui.food || { draft: '', fix: {}, trend: 7, tab: 'diary', meal: null });
  const P = () => WT.db.profile;
  const target = () => N.targets().p;
  const g = (v) => `≈${N.rp(v)} g`;
  const cal = (v) => `${WT.fmtNum(N.rcal(v))}`;
  /** Data source tag: Verified · Reference data · Confirmed by you · Estimate */
  const TAGCLS = { verified: 'v', reference: 'r', user: 'u', estimated: 'e' };
  const confTag = (c) => `<span class="tag conf ${TAGCLS[c] || 'e'}">${N.statusLabel(c)}</span>`;
  WT.foodConfTag = confTag;
  /** Match confidence: Exact match · Close match · Rough estimate */
  const matchTag = (it) => {
    const c = N.confidence(it);
    return `<span class="mt ${c.level}" title="How closely this matches what you typed">${c.level === 'high' ? I('check', 12) : ''}${esc(c.label)}</span>`;
  };
  const macroLine = (t) => `≈${cal(t.cal)} cal · ${N.rg(t.c)} g carbs · ${N.rg(t.f)} g fat`;
  const macroShort = (t) => `${N.rp(t.p)}P · ${N.rg(t.c)}C · ${N.rg(t.f)}F`;
  const today = () => N.dayKey();
  function dayOf(param) {
    const t = today();
    return N.validDay(param) && param <= t ? param : t;
  }
  function dayName(k, long) {
    const t = today();
    if (k === t) return 'Today';
    if (k === N.addDays(t, -1)) return 'Yesterday';
    return N.parseDay(k).toLocaleDateString(undefined, long ? { weekday: 'long', month: 'long', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' });
  }
  /** The meal new food goes to: the one you picked, else the one for the time of day (past days: snack → you choose). */
  const curMeal = () => ui().meal || N.mealAt();
  const amountLabel = (it) => {
    const a = N.fmtAmount(it.qty, it.unit);
    return it.assumed ? `${a} (assumed)` : a;
  };

  /* ───────── Parsing with the user's corrections applied ───────── */
  function currentItems() {
    const st = ui();
    return N.parse(st.draft).map((it) => {
      const fix = st.fix[it.key || it.text];
      if (!fix) return it;
      if (fix.generic) return Object.assign(it.fallback || N.parseItem(it.text, { generic: true }), { key: it.key });
      if (fix.id) return Object.assign(N.resolveAs(it, fix.id, fix.variant), { learn: true, learnRef: fix.id, key: it.key });
      if (fix.manual) return manualItem(it, fix.manual);
      return it;
    });
  }
  function manualItem(it, v) {
    const qty = 1;
    const num = (x) => (x === '' || x == null || isNaN(+x) ? null : +x);
    return {
      id: it.id, key: it.key, text: it.text, name: WT.cap(it.text.replace(/^(\d+(\.\d+)?|an?)\s+/i, '')), qty, unit: 'serving',
      per: { p: num(v.p) || 0, cal: num(v.cal), c: num(v.c), f: num(v.f) }, src: 'manual', note: 'Entered by you', manual: true, conf: 'user', save: true, match: 'exact',
    };
  }
  /** Simple, confident entries log in one tap; anything uncertain or multi-part opens the review screen. */
  function quickOK(items) {
    if (!items.length || items.length > 2) return false;
    return items.every((i) => !i.unknown && !i.ambiguous && !i.partOf && N.confidence(i).level !== 'low');
  }

  /* ───────── Summary ───────── */
  function bar(label, val, tgt, unit, cls) {
    const pct = tgt ? Math.min(100, (val / tgt) * 100) : 0;
    const over = tgt && val > tgt * 1.1;
    return `<div class="mac ${cls || ''}"><div class="mk">${label}</div><div class="tnum mv"><b>${N.rg(val)}</b>${tgt ? ` / ${tgt}` : ''} ${unit}</div>
      <div class="track mac-track ${over ? 'over' : ''}" role="progressbar" aria-label="${label}" aria-valuenow="${N.rg(val)}" ${tgt ? `aria-valuemax="${tgt}"` : ''}><i style="width:${tgt ? pct : 0}%"></i></div></div>`;
  }
  function summary(day, compact) {
    const t = N.dayTotals(day);
    const tg = N.targets();
    const isToday = day === today();
    const gd = N.guidance(t.p, tg.p, t.n, isToday);
    const left = tg.cal ? tg.cal - t.cal : null;
    if (compact) {
      const pctP = Math.min(100, (t.p / tg.p) * 100);
      return `<a class="panel food-mini" href="#/food">
        <div class="mini-grid">
          <div><div class="mini-k">Calories</div><div class="mini-v tnum">${t.n ? cal(t.cal) : '—'}${tg.cal ? `<small> / ${WT.fmtNum(tg.cal)}</small>` : ''}</div>
            ${tg.cal ? `<div class="track mac-track"><i style="width:${Math.min(100, (t.cal / tg.cal) * 100)}%"></i></div>` : `<div class="footnote t3">No target set</div>`}</div>
          <div><div class="mini-k">Protein</div><div class="mini-v tnum">${t.n ? N.rp(t.p) : '—'}<small> / ${tg.p} g</small></div>
            <div class="track mac-track"><i style="width:${t.n ? pctP : 0}%"></i></div></div>
        </div>
        <div class="footnote t2 mt8">${t.n ? (left != null ? (left >= 0 ? `${cal(left)} calories left · ` : `${cal(-left)} over · `) : '') + (t.p < tg.p ? `${N.rp(tg.p - t.p)} g protein to go` : 'Protein target reached') : 'Nothing logged yet today'}</div></a>`;
    }
    const ring = tg.cal ? WT.ring(t.cal, tg.cal, 116, t.cal > tg.cal * 1.1 ? 'var(--burn)' : 'var(--accent)') : WT.ring(0, 1, 116);
    return `<div class="panel nut-sum ${gd.state}">
      <div class="nut-top">
        <div class="nut-ring" aria-hidden="true">${ring}<div class="ring-in"><b class="tnum">${t.n ? cal(t.cal) : '0'}</b><span>${tg.cal ? 'of ' + WT.fmtNum(tg.cal) : 'calories'}</span></div></div>
        <div class="nut-cal">
          <div class="kicker">${isToday ? 'Today' : dayName(day)}</div>
          <div class="nut-left tnum" id="calLeft">${tg.cal ? (left >= 0 ? `${cal(left)} <small>left</small>` : `${cal(-left)} <small>over</small>`) : `${N.rp(t.p)} <small>g protein</small>`}</div>
          <div class="footnote t2 tnum">${tg.cal ? `Target ${WT.fmtNum(tg.cal)} · eaten ${cal(t.cal)}` : `<button class="btn-link" data-act="foodTargets">Set a calorie target</button>`}${t.missing ? ` · ${t.missing} item${t.missing === 1 ? '' : 's'} without calories` : ''}</div>
        </div>
        <button class="icon-btn sm nut-edit" data-act="foodTargets" aria-label="Edit targets" title="Edit targets">${I('sliders', 16)}</button>
      </div>
      <div class="macs">${bar('Protein', t.p, tg.p, 'g', 'p')}${bar('Carbs', t.c, tg.c, 'g', 'c')}${bar('Fat', t.f, tg.f, 'g', 'f')}</div>
      <p class="food-msg">${gd.state === 'reached' || gd.state === 'above' ? I('check', 15) : ''}${esc(gd.msg)}</p>
    </div>`;
  }
  WT.foodHomeSummary = function (title) {
    if (P().homeProtein === false) return '';
    return `<section class="section"><div class="section-title"><h2>${title || 'Nutrition today'}</h2><a class="btn-link footnote" href="#/food">Log food</a></div>${summary(today(), true)}</section>`;
  };

  /* ───────── Preview of what was typed ───────── */
  function previewHtml(items) {
    if (!items.length) return '';
    let lastPart = '';
    const rows = items
      .map((it) => {
        const t = esc(it.key || it.text);
        if (it.unknown)
          return `<div class="li pv unk"><div class="grow"><div class="ti">“${esc(it.text)}”</div><div class="su">${esc(it.hint || 'Not recognized — pick a match, search, or enter the values yourself.')}</div>
            <div class="chips mt8">${(it.suggestions || []).map((s) => `<button class="chip sm" data-act="foodPick" data-t="${t}" data-id="${esc(s.id)}">${esc(s.name)}</button>`).join('')}<button class="chip sm" data-act="foodReview" data-t="${t}">${I('search', 13)}Search</button><button class="chip sm" data-act="foodManual" data-t="${t}">${I('edit', 13)}Enter values</button></div></div></div>`;
        if (it.ambiguous) return `<div class="li pv unk amb"><div class="grow"><div class="ti">“${esc(it.text)}”</div><div class="su">${ambiguousHelp(it)}</div>${candidateChips(it, 'foodPick', `data-t="${t}"`)}</div></div>`;
        const tot = N.itemTotals(it);
        const head = it.partOf && it.partOf !== lastPart ? `<div class="pv-group">${esc(it.partOf)}</div>` : '';
        lastPart = it.partOf || '';
        return `${head}<div class="li pv ${it.partOf ? 'part' : ''}"><div class="grow"><div class="ti">${esc(it.name)} ${confTag(it.conf)}${matchTag(it)}</div><div class="su">${esc(amountLabel(it))} · ${macroShort(tot)}${it.lookup ? ` · <button class="btn-link" data-act="productAdd" data-t="${esc(it.text)}">Find the exact product</button>` : ''}</div>${it.note ? `<div class="su pv-note">${esc(it.note)}</div>` : ''}</div><span class="tnum strong">${cal(tot.cal)}<small class="t3"> cal</small></span></div>`;
      })
      .join('');
    const known = items.filter((i) => !i.unknown && !i.ambiguous);
    const sum = N.sumItems(known);
    const unk = items.length - known.length;
    const quick = quickOK(items);
    return `<div class="list inset">${rows}</div>
      <div class="row between mt8 pv-foot"><span class="footnote t2 tnum">${known.length ? `≈${cal(sum.cal)} cal · ${g(sum.p)} protein` : ''}${unk ? `${known.length ? ' · ' : ''}${plural(unk, 'item')} to check` : ''}</span><button class="btn-link footnote" data-act="foodReview">${quick ? 'Review &amp; edit' : 'Review'}</button></div>`;
  }
  /** Which product? — candidates show brand, flavor, serving, protein and how sure we are. */
  function ambiguousHelp(it) {
    if (it.askWhy) return esc(it.askWhy);
    if (it.variant) return `${esc(it.brand)} ${esc(it.variant)} isn’t in your library yet. Use a listed product’s values as an estimate, or add it from the label.`;
    return it.candidates.length > 1 ? 'More than one product matches — which one?' : 'Is this the product? (No other matching product is saved yet.)';
  }
  function candidateChips(it, act, attrs) {
    const chips = it.candidates.map((c) => {
      // catalog items: only the candidates that lack your flavor get the "use these values as an estimate" arrow
      const v = it.catalog ? c.flavorMiss || '' : it.variant || '';
      if (c.nodata)
        return `<button class="chip cand nodata" data-act="${act}" ${attrs} data-id="${esc(c.id)}"><span class="cn">${esc(c.name)}</span><span class="cs">No label saved yet · search online or enter it from the label</span></button>`;
      return `<button class="chip cand" data-act="${act}" ${attrs} data-id="${esc(c.id)}" ${v ? `data-variant="${esc(v)}"` : ''}>
        <span class="cn">${esc(c.name)}${v ? ` <span class="t3">→ ${esc(v)} (estimate from this flavor)</span>` : ''}</span><span class="cs tnum">${esc(c.serving)} · ${c.p == null ? '—' : N.rp(c.p)} g protein · ${N.statusLabel(v ? 'estimated' : c.status)}${c.mine ? ' · yours' : ''}</span></button>`;
    });
    if (it.fallback) chips.push(`<button class="chip cand" data-act="${act}" ${attrs} data-id="__generic"><span class="cn">Generic estimate · ${esc(it.fallback.name)}</span><span class="cs tnum">${esc(N.fmtAmount(it.fallback.qty, it.fallback.unit))} · ≈${N.rp(N.itemTotals(it.fallback).p)} g protein · Estimate</span></button>`);
    chips.push(`<button class="chip sm" data-act="productAdd" ${attrs} data-brand="${esc(it.brand || '')}" data-variant="${esc(it.variant || '')}">${I('plus', 13)}${it.variant ? `Add ${esc(it.variant)} from the label` : it.catalog ? `Another ${esc(it.brand)} product` : 'A different product'}</button>`);
    return `<div class="chips mt8 cands">${chips.join('')}</div>`;
  }
  function paintPreview() {
    const host = document.getElementById('foodPreview');
    const items = currentItems();
    if (host) host.innerHTML = previewHtml(items);
    const btn = document.getElementById('foodAddBtn');
    if (btn) {
      btn.disabled = !items.length;
      btn.textContent = !items.length || quickOK(items) ? 'Log' : 'Review';
    }
  }
  let pvTimer = null;
  WT.I.foodText = (el, ev) => {
    if (ev.type !== 'input') return;
    ui().draft = el.value;
    clearTimeout(pvTimer);
    pvTimer = setTimeout(paintPreview, 90);
  };

  /* ═════════════════════ FOOD ═════════════════════ */
  V.food = function (param) {
    const day = dayOf(param);
    const st = ui();
    st.day = day;
    const t = today();
    const isToday = day === t;
    const tab = st.tab === 'trends' ? 'trends' : 'diary';
    const dateNav = `<div class="food-date">
        <a class="icon-btn" href="#/food/${N.addDays(day, -1)}" aria-label="Previous day" data-act="foodDay" data-k="${N.addDays(day, -1)}">${I('chevL', 20)}</a>
        <label class="food-day"><span class="strong">${dayName(day)}</span>${I('calendar', 15)}<input type="date" data-in="foodDate" value="${day}" max="${t}" aria-label="Choose a date"></label>
        <a class="icon-btn ${isToday ? 'off' : ''}" ${isToday ? 'aria-disabled="true"' : `href="#/food/${N.addDays(day, 1)}"`} aria-label="Next day" data-act="foodDay" data-k="${isToday ? '' : N.addDays(day, 1)}">${I('chevR', 20)}</a>
        ${isToday ? '' : `<a class="btn-link footnote" href="#/food" data-act="foodDay" data-k="">Today</a>`}
        <span class="grow"></span>
        <button class="btn btn-plain btn-sm" data-act="foodMine">${I('star', 14)}My foods</button>
      </div>`;
    const head = `<div class="head head-row"><div><div class="over">${N.parseDay(day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div><h1 class="large-title">Food</h1></div>
      ${H.seg([['diary', 'Diary'], ['trends', 'Trends']], tab, 'foodTab', '', 'food-tabs')}</div>`;
    if (tab === 'trends') return `<div class="page">${head}${trends()}</div>`;

    const meal = st.meal || (isToday ? N.mealAt() : 'snack');
    const mealSeg = `<div class="seg meal-seg" role="group" aria-label="Meal">${N.MEALS.map(([k, n]) => `<button class="${k === meal ? 'on' : ''}" data-act="foodMeal" data-k="${k}" aria-pressed="${k === meal}">${n}</button>`).join('')}</div>`;
    const items = currentItems();
    return `<div class="page">
      ${head}
      ${dateNav}
      ${summary(day)}
      <section class="section food-log" id="foodLog">
        <div class="row between wrap" style="gap:8px"><label class="label" for="foodInput">What did you eat${isToday ? '' : ` on ${dayName(day)}`}?</label>${mealSeg}</div>
        <div class="food-entry mt12">
          <textarea id="foodInput" class="input" rows="2" data-in="foodText" placeholder="e.g. Chipotle chicken bowl with rice, black beans and guac" autocomplete="off" autocapitalize="sentences" enterkeyhint="done">${esc(st.draft)}</textarea>
          <button class="btn btn-primary" id="foodAddBtn" data-act="foodAdd" ${items.length ? '' : 'disabled'}>${!items.length || quickOK(items) ? 'Log' : 'Review'}</button>
        </div>
        <div class="log-tools"><button class="btn btn-plain btn-sm" data-act="foodSearch">${I('search', 15)}Search foods</button><button class="btn btn-plain btn-sm" data-act="foodScan">${I('barcode', 15)}Scan barcode</button></div>
        <div id="foodPreview" class="mt12" aria-live="polite">${previewHtml(items)}</div>
      </section>
      ${quickAdd(day)}
      ${N.MEALS.map(([k]) => mealSection(day, k)).join('')}
      <p class="footnote t3 mt16">Tags show where values come from: <b>Verified</b> (manufacturer), <b>Reference data</b> (USDA or the restaurant’s published values), <b>Confirmed by you</b>, or <b>Estimate</b>. Tap any item to correct it.</p>
    </div>`;
  };

  function quickAdd(day) {
    const favs = WT.db.nutrition.foods.filter((f) => f.fav);
    const favNames = new Set(favs.map((f) => f.name.toLowerCase()));
    const freq = N.frequent(6, favNames);
    const freqNames = new Set(freq.map((e) => e.name.toLowerCase()));
    const recent = N.recent(6).filter((e) => !freqNames.has(e.name.toLowerCase()));
    const meals = WT.db.nutrition.meals.slice().sort((a, b) => (b.fav - a.fav) || (b.uses || 0) - (a.uses || 0)).slice(0, 6);
    const combos = N.frequentMeals(2);
    if (!favs.length && !freq.length && !recent.length && !meals.length && !combos.length) return '';
    const chip = (k, name, c, p) => `<button class="chip qa" data-act="foodQuick" data-k="${k}" title="Log ${esc(name)}">${I('plus', 13)}<span class="ellipsis">${esc(name)}</span><span class="t3 tnum">${c != null ? cal(c) + ' cal' : N.rp(p) + ' g'}</span></button>`;
    const row = (label, html) => (html ? `<div class="qa-block"><div class="label">${label}</div><div class="qa-row">${html}</div></div>` : '');
    const totalOf = (list) => N.sumItems(list);
    return `<section class="section food-quick">
      <div class="section-title"><h2>Quick add</h2><span class="footnote t3">One tap logs to ${esc(N.mealName(curMealFor(day)))}</span></div>
      ${row('Saved meals', meals.map((m) => chip('meal:' + m.id, m.name, totalOf(m.items).cal, totalOf(m.items).p)).join('') + combos.map((c, i) => chip('combo:' + i, `Usual: ${c.name}`, totalOf(c.items).cal, totalOf(c.items).p)).join(''))}
      ${row('Favorites', favs.map((f) => chip('fav:' + f.id, f.qty !== 1 ? `${f.name} ×${N.fmtQty(f.qty)}` : f.name, f.per.cal != null ? f.per.cal * f.qty : null, f.per.p * f.qty)).join(''))}
      ${row('Frequent', freq.map((e) => chip('rec:' + e.id, `${e.name} · ${N.fmtAmount(e.qty, e.unit)}`, e.per.cal != null ? e.per.cal * e.qty : null, e.per.p * e.qty)).join(''))}
      ${row('Recent', recent.map((e) => chip('rec:' + e.id, `${e.name} · ${N.fmtAmount(e.qty, e.unit)}`, e.per.cal != null ? e.per.cal * e.qty : null, e.per.p * e.qty)).join(''))}
    </section>`;
  }
  const curMealFor = (day) => ui().meal || (day === today() ? N.mealAt() : 'snack');

  function mealSection(day, meal) {
    const list = N.entriesFor(day, meal);
    const t = N.sumItems(list);
    const rows = list
      .map((e) => {
        const x = N.itemTotals(e);
        return `<div class="li food-row"><button class="grow food-main" data-act="foodEdit" data-id="${e.id}"><div class="ti">${esc(e.name)} ${confTag(e.conf)}</div><div class="su tnum">${esc(N.fmtAmount(e.qty, e.unit))} · ${macroShort(x)}</div></button>
          <span class="tnum fr-cal">${e.per.cal == null ? '—' : cal(x.cal)}</span><button class="icon-btn sm" data-act="foodDel" data-id="${e.id}" aria-label="Delete ${esc(e.name)}">${I('trash', 15)}</button></div>`;
      })
      .join('');
    return `<section class="meal-sec" data-meal="${meal}">
      <div class="meal-head"><h2>${N.mealName(meal)}</h2><span class="footnote t2 tnum">${list.length ? `${cal(t.cal)} cal · ${N.rp(t.p)} g protein` : ''}</span><span class="grow"></span>
        ${list.length ? `<button class="icon-btn sm" data-act="mealMenu" data-meal="${meal}" aria-label="${N.mealName(meal)} options">${I('more', 18)}</button>` : ''}</div>
      ${rows ? `<div class="list inset">${rows}</div>` : ''}
      <button class="meal-add" data-act="mealAdd" data-meal="${meal}">${I('plus', 15)}Add to ${N.mealName(meal).toLowerCase()}</button>
    </section>`;
  }

  /* ───────── Trends ───────── */
  function trends() {
    const st = ui();
    const days = [7, 30, 90].includes(+st.trend) ? +st.trend : 7;
    const tr = N.trend(days, target());
    const tg = N.targets();
    const any = WT.db.nutrition.entries.length;
    const seg = H.seg([[7, '7 days'], [30, '30 days'], [90, '90 days']], days, 'foodTrend', '', '');
    if (!any) return `<section class="section"><div class="section-title"><h2>Trends</h2>${seg}</div>${H.empty('No food logged yet', 'Log a few days of meals in the Diary and your averages, protein-target days and charts will appear here.', `<button class="btn btn-primary" data-act="foodTab" data-v="diary">Go to diary</button>`)}</section>`;
    const avg = (v, unit, k) => (v == null ? '—' : unit === 'cal' ? cal(v) : N.rg(v) + `<small>${unit}</small>`);
    const rows = tr.days.slice().reverse().filter((d) => days === 7 || d.logged)
      .map((d) => H.li({ href: `#/food/${d.date}`, title: dayName(d.date), sub: d.logged ? `${plural(d.n, 'item')} · ${macroShort(d)}` : 'Not logged', trail: d.logged ? `<span class="tnum strong">${cal(d.cal)}<small class="t3"> cal</small></span>` : `<span class="t3">—</span>`, chev: true, cls: d.logged ? '' : 'muted' }))
      .join('');
    const unlogged = days - tr.logged;
    return `<section class="section">
      <div class="section-title"><h2>Averages</h2>${seg}</div>
      <div class="summary four">
        <div class="metric"><div class="v">${avg(tr.avgCal, 'cal')}</div><div class="k">Calories / day${tg.cal ? ` · target ${WT.fmtNum(tg.cal)}` : ''}</div></div>
        <div class="metric"><div class="v">${avg(tr.avg, 'g')}</div><div class="k">Protein · target ${tg.p} g</div></div>
        <div class="metric"><div class="v">${avg(tr.avgC, 'g')}</div><div class="k">Carbs${tg.c ? ` · target ${tg.c} g` : ''}</div></div>
        <div class="metric"><div class="v">${avg(tr.avgF, 'g')}</div><div class="k">Fat${tg.f ? ` · target ${tg.f} g` : ''}</div></div>
      </div>
      <div class="summary mt16">
        <div class="metric"><div class="v">${tr.logged}<small>/ ${days}</small></div><div class="k">Days logged</div></div>
        <div class="metric"><div class="v">${tr.reached}<small>/ ${tr.logged}</small></div><div class="k">Days near protein target</div></div>
        <div class="metric"><div class="v">${tr.calOk == null ? '—' : `${tr.calOk}<small>/ ${tr.logged}</small>`}</div><div class="k">${tr.calOk == null ? 'Set a calorie target' : 'Days within 10% of calories'}</div></div>
      </div>
      <div class="chart-title mt24">Calories</div><div id="foodCalChart" class="mt8"></div>
      <div class="chart-title mt16">Protein</div><div id="foodChart" class="mt8"></div>
      <p class="footnote t3 mt8">${unlogged ? `${plural(unlogged, 'day')} with nothing logged ${unlogged === 1 ? 'is' : 'are'} left out of the averages — that usually just means it wasn’t tracked.` : 'Every day in this range has entries.'}</p>
      ${rows ? `<div class="list inset mt16">${rows}</div>` : ''}
    </section>`;
  }

  V.foodAfter = function () {
    const st = ui();
    const days = [7, 30, 90].includes(+st.trend) ? +st.trend : 7;
    const t = today();
    const lbl = (d, i) => (days === 7 ? N.parseDay(d.date).toLocaleDateString(undefined, { weekday: 'narrow' }) : i % (days === 90 ? 15 : 5) === (days === 90 ? 14 : 4) || i === days - 1 ? String(N.parseDay(d.date).getDate()) : '');
    const pEl = document.getElementById('foodChart');
    const cEl = document.getElementById('foodCalChart');
    if (pEl || cEl) {
      const tr = N.trend(days, target());
      const tip = (d, v) => (d.logged ? `<b>${v}</b><br><span class="faint">${dayName(d.date)} · ${plural(d.n, 'item')}</span>` : `<b>Not logged</b><br><span class="faint">${dayName(d.date)}</span>`);
      if (pEl) WT.barChart(pEl, tr.days.map((d, i) => ({ label: lbl(d, i), value: d.logged ? Math.round(d.p) : 0, highlight: d.date === t, tip: tip(d, g(d.p) + ' protein') })), { ref: target(), refLabel: 'Target', height: 170 });
      if (cEl) WT.barChart(cEl, tr.days.map((d, i) => ({ label: lbl(d, i), value: d.logged ? Math.round(d.cal) : 0, highlight: d.date === t, tip: tip(d, cal(d.cal) + ' cal') })), { ref: N.targets().cal || 0, refLabel: 'Target', height: 170 });
    }
    const ta = document.getElementById('foodInput');
    if (ta && !ta.dataset.wired) {
      ta.dataset.wired = '1';
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          clearTimeout(pvTimer);
          ui().draft = ta.value;
          A.foodAdd();
        }
      });
    }
  };

  /* ───────── Actions: navigation ───────── */
  A.foodDay = (d, el, ev) => {
    if (ev) ev.preventDefault();
    if (el && el.getAttribute('aria-disabled')) return;
    WT.go('food', d.k || null);
  };
  WT.I.foodDate = (el, ev) => {
    if (ev.type !== 'change' || !N.validDay(el.value)) return;
    WT.go('food', el.value > today() ? null : el.value === today() ? null : el.value);
  };
  A.foodTrend = (d) => {
    ui().trend = +d.v;
    WT.rerender();
  };
  A.foodTab = (d) => {
    ui().tab = d.v;
    WT.rerender();
  };
  A.foodMeal = (d) => {
    ui().meal = d.k;
    document.querySelectorAll('.meal-seg button').forEach((b) => {
      b.classList.toggle('on', b.dataset.k === d.k);
      b.setAttribute('aria-pressed', b.dataset.k === d.k);
    });
    const qa = document.querySelector('.food-quick .section-title .footnote');
    if (qa) qa.textContent = `One tap logs to ${N.mealName(d.k)}`;
  };
  A.mealAdd = (d) => {
    A.foodMeal({ k: d.meal });
    const ta = document.getElementById('foodInput');
    const log = document.getElementById('foodLog');
    if (log && log.scrollIntoView) log.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (ta) ta.focus({ preventScroll: true });
  };

  /* ───────── Actions: logging ───────── */
  /** Log items; learn from corrections (matches you picked, amounts you changed). */
  function logItems(items, opts) {
    opts = opts || {};
    const day = ui().day || today();
    const meal = opts.meal || curMealFor(day);
    const added = N.addItems(items, day, meal);
    added.forEach((e, i) => {
      const it = items[i];
      const lib = N.remember(it);
      if (lib) {
        e.foodId = 'my:' + lib.id; // later corrections to this entry update the library product
        if (it.edited && N.correctLibrary(e)) e.conf = 'user';
      }
      // a match you chose replaces the automatic one next time you type the same words
      if (it.learnRef && !it.partOf && it.text) N.learn(it.text, it.learnRef);
      // an amount you changed becomes your usual amount for this food
      if (it.qtyEdited && it.foodId) N.rememberPortion(it.foodId, it.qty, it.unit);
    });
    if (opts.saveAs) N.saveMeal(opts.saveAs, added, meal);
    WT.save();
    const t = N.sumItems(added);
    WT.toast(`Logged ${plural(added.length, 'item')} to ${N.mealName(meal)} · ≈${cal(t.cal)} cal`, 'good');
    return added;
  }
  A.foodAdd = () => {
    const st = ui();
    const ta = document.getElementById('foodInput');
    if (ta) st.draft = ta.value;
    const items = currentItems();
    if (!items.length) return WT.toast('Type what you ate — e.g. “3 eggs and toast”');
    if (!quickOK(items)) return openReview(items);
    logItems(items);
    st.draft = '';
    st.fix = {};
    WT.rerender();
    const t2 = document.getElementById('foodInput');
    if (t2 && window.matchMedia('(hover: hover)').matches) t2.focus();
  };
  A.foodPick = (d) => {
    if (String(d.id).startsWith('c:')) return A.catPick(d);
    ui().fix[d.t] = d.id === '__generic' ? { generic: true } : { id: d.id, variant: d.variant || '' };
    paintPreview();
  };
  A.foodManual = (d) => openReview(currentItems(), d.t);
  A.foodReview = (d) => openReview(currentItems(), d && d.t, d && d.t ? 'search' : null);
  A.foodQuick = (d) => {
    const [kind, id] = d.k.split(':');
    const day = ui().day || today();
    const meal = curMealFor(day);
    if (kind === 'meal') {
      const m = N.mealById(id);
      if (!m) return;
      const added = N.logMeal(id, day, meal);
      WT.toast(`Logged “${m.name}” to ${N.mealName(meal)} · ≈${cal(N.sumItems(added).cal)} cal`, 'good');
      return WT.rerender();
    }
    if (kind === 'combo') {
      const c = N.frequentMeals(2)[+id];
      if (!c) return;
      const added = N.copyEntries(c.items.map((e) => e.id), day, meal);
      WT.toast(`Logged ${plural(added.length, 'item')} to ${N.mealName(meal)}`, 'good');
      return WT.rerender();
    }
    const src = kind === 'fav' ? WT.db.nutrition.foods.find((f) => f.id === id) : N.entry(id);
    if (!src) return;
    N.relog(src, day, meal);
    WT.toast(`Logged ${src.name} to ${N.mealName(meal)}`, 'good');
    WT.rerender();
  };
  A.foodDel = (d) => {
    const e = N.entry(d.id);
    if (!e) return;
    WT.confirm('Delete entry?', `Remove “${esc(e.name)}” (≈${cal(N.itemTotals(e).cal)} cal) from ${dayName(e.date)}?`, 'Delete', () => {
      N.deleteEntry(d.id);
      WT.rerender();
      WT.toast('Entry deleted');
    }, true);
  };

  /* ───────── A product the catalog knows but whose label isn't on this device ───────── */
  A.catPick = (d) => {
    const rv = d.i != null && d.i !== '' && WT.ui.review ? WT.ui.review.items[+d.i] : null;
    const item = rv || currentItems().find((x) => (x.key || x.text) === d.t);
    const cand = item && item.candidates ? item.candidates.find((c) => c.id === d.id) : null;
    if (!cand) return;
    const key = item.key || item.text;
    const q = [cand.brand, cand.line, cand.variant, cand.flavor].filter(Boolean).join(' ');
    const setFix = (fix) => {
      ui().fix[key] = fix;
      if (rv) {
        WT.closeSheet(true);
        openReview(currentItems());
      } else {
        WT.closeSheet(true);
        paintPreview();
      }
    };
    WT.openSheet(() => ({
      eyebrow: esc(cand.brand),
      title: esc(cand.name),
      body: `<p class="t2">Forge recognizes this product but doesn’t have its nutrition label on this device. It won’t use another product’s numbers in its place.</p>
        <div class="fstack mt16" style="gap:8px">
          <button class="btn btn-primary" data-act="cpLabel">${I('edit', 15)}Enter it from the label</button>
          <button class="btn btn-secondary" data-act="cpSearch">${I('search', 15)}Search online for “${esc(q)}”</button>
          ${item.fallback ? `<button class="btn btn-plain" data-act="cpGeneric">Use a generic estimate (${esc(item.fallback.name)})</button>` : ''}
        </div>
        <p class="footnote t3 mt12">Whatever you choose is remembered: typing “${esc(item.phrase || item.text)}” again finds it directly.</p>`,
    }));
    A.cpLabel = () => {
      WT.closeSheet();
      productForm({
        prefill: { brand: cand.brand, line: [cand.line, cand.variant].filter(Boolean).join(' · ').replace(' · ', ' ') || '', flavor: cand.flavor || '', unit: cand.unit || 'serving', cat: cand.cat || '', catLine: cand.id.replace(/\|.*$/, '').replace(/^c:/, ''), status: 'user', aliases: item.phrase ? [item.phrase] : [] },
        fav: false,
        onSaved: (saved) => {
          WT.toast(`Saved “${saved.name}” to My foods`, 'good');
          if (item.text) N.learn(item.text, 'my:' + saved.id);
          setFix({ id: 'my:' + saved.id });
        },
      });
    };
    A.cpSearch = () => {
      WT.closeSheet();
      openSearch({
        eyebrow: `For “${esc(item.text)}”`,
        q,
        autoOnline: true,
        onPick: (r) => setFix({ id: r.id }),
      });
    };
    A.cpGeneric = () => setFix({ generic: true });
  };

  /* ───────── Meal options: save, copy, clear ───────── */
  A.mealMenu = (d) => {
    const day = ui().day || today();
    const list = N.entriesFor(day, d.meal);
    if (!list.length) return;
    const form = { name: `${N.mealName(d.meal)} · ${list.slice(0, 2).map((e) => e.name).join(', ')}`.slice(0, 60), to: today(), toMeal: d.meal };
    WT.openSheet(() => ({
      eyebrow: dayName(day),
      title: N.mealName(d.meal),
      body: `<div class="fstack" style="gap:18px">
        <div class="fstack" style="gap:8px"><span class="label">Save as a meal</span>
          <div class="row" style="gap:8px"><input class="input grow" data-in="mmText" data-k="name" value="${esc(form.name)}" aria-label="Meal name"><button class="btn btn-secondary" data-act="mmSave">Save</button></div>
          <p class="footnote t3">Saved meals appear under Quick add and log in one tap.</p></div>
        <div class="fstack" style="gap:8px"><span class="label">Copy ${plural(list.length, 'item')} to</span>
          <div class="fields"><input class="input" type="date" data-in="mmText" data-k="to" value="${form.to}" max="${today()}" aria-label="Date"><select class="input" data-in="mmText" data-k="toMeal" aria-label="Meal">${N.MEALS.map(([k, n]) => `<option value="${k}" ${k === form.toMeal ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
          <button class="btn btn-secondary" data-act="mmCopy">${I('swap', 15)}Copy</button></div>
      </div>`,
      foot: `<button class="btn btn-plain btn-sm" style="color:var(--danger)" data-act="mmClear">Delete all ${plural(list.length, 'item')}</button><span class="grow"></span><button class="btn btn-secondary" data-act="closeSheet">Done</button>`,
    }));
    WT.I.mmText = (el) => (form[el.dataset.k] = el.value);
    A.mmSave = () => {
      if (!String(form.name).trim()) return WT.toast('Give the meal a name', 'error');
      N.saveMeal(form.name, list, d.meal);
      WT.closeSheet();
      WT.rerender();
      WT.toast(`Saved “${form.name.trim()}”`, 'good');
    };
    A.mmCopy = () => {
      if (!N.validDay(form.to) || form.to > today()) return WT.toast('Pick a date up to today', 'error');
      const added = N.copyEntries(list.map((e) => e.id), form.to, form.toMeal);
      WT.closeSheet();
      WT.rerender();
      WT.toast(`Copied ${plural(added.length, 'item')} to ${dayName(form.to)} · ${N.mealName(form.toMeal)}`, 'good');
    };
    A.mmClear = () =>
      WT.confirm(`Delete ${N.mealName(d.meal).toLowerCase()}?`, `Remove all ${plural(list.length, 'item')} from ${dayName(day)}?`, 'Delete', () => {
        list.forEach((e) => N.deleteEntry(e.id));
        WT.closeSheet(true);
        WT.rerender();
        WT.toast('Deleted');
      }, true);
  };

  /* ───────── Targets ───────── */
  A.foodTargets = () => {
    const p = P();
    const form = { cal: p.calorieTarget || '', p: p.proteinTarget || 150, c: p.carbTarget || '', f: p.fatTarget || '' };
    const fld = (k, label, ph) => `<label class="fstack" style="gap:6px"><span class="label">${label}</span><input class="input tnum" type="number" inputmode="numeric" min="0" step="1" data-in="tgNum" data-k="${k}" value="${form[k]}" placeholder="${ph || ''}"></label>`;
    WT.openSheet(() => {
      const t = N.targets();
      return {
        title: 'Daily targets',
        body: `<div class="fstack" style="gap:14px">
          <div class="fields">${fld('cal', 'Calories', 'Not set')}${fld('p', 'Protein (g)')}</div>
          <div class="fields">${fld('c', 'Carbs (g)', t.c ? `Auto · ${t.c}` : 'Auto')}${fld('f', 'Fat (g)', t.f ? `Auto · ${t.f}` : 'Auto')}</div>
          <p class="footnote t3">Leave carbs and fat empty to split the calories left after protein about 55 / 45 between them. Targets are yours to set — Forge doesn’t guess them.</p>
        </div>`,
        foot: `<span class="grow"></span><button class="btn btn-primary" data-act="tgSave">Save</button>`,
      };
    });
    WT.I.tgNum = (el) => (form[el.dataset.k] = el.value);
    A.tgSave = () => {
      const n = (v) => (v === '' || v == null || !(+v > 0) ? null : Math.round(+v));
      if (!n(form.p)) return WT.toast('Protein target must be above 0', 'error');
      Object.assign(p, { calorieTarget: n(form.cal), proteinTarget: n(form.p), carbTarget: n(form.c), fatTarget: n(form.f) });
      WT.save();
      WT.closeSheet();
      WT.rerender();
      WT.toast('Targets saved', 'good');
    };
  };

  /* ───────── Review sheet (before logging) ───────── */
  const numIn = (v, k, i, label, step, extra) => `<input class="input tnum num-in" type="number" inputmode="decimal" min="0" step="${step || 1}" data-in="rvNum" data-i="${i}" data-k="${k}" value="${v}" aria-label="${label}" ${extra || ''}>`;
  function reviewCard(it, i) {
    const rm = `<button class="icon-btn sm" data-act="rvRemove" data-i="${i}" aria-label="Remove ${esc(it.name || it.text)}">${I('x', 15)}</button>`;
    if (it.ambiguous)
      return `<div class="rv unk" data-i="${i}"><div class="row between top"><div class="grow"><div class="strong">“${esc(it.text)}”</div><div class="footnote t2">${ambiguousHelp(it)}</div></div>${rm}</div>${candidateChips(it, 'rvPick', `data-i="${i}" data-t="${esc(it.key || it.text)}"`)}</div>`;
    if (it.unknown)
      return `<div class="rv unk" data-i="${i}"><div class="row between top"><div class="grow"><div class="strong">“${esc(it.text)}”</div><div class="footnote t2">${esc(it.hint || 'Not recognized. Pick a match, search, or enter the values from a label.')}</div></div>${rm}</div>
        <div class="chips mt8">${(it.suggestions || []).map((s) => `<button class="chip sm" data-act="rvPick" data-i="${i}" data-id="${esc(s.id)}">${esc(s.name)}</button>`).join('')}<button class="chip sm" data-act="rvSearch" data-i="${i}">${I('search', 13)}Search foods</button><button class="chip sm" data-act="productAdd" data-t="${esc(it.text)}" data-i="${i}">${I('plus', 13)}Branded product</button></div>
        <div class="rv-manual mt12"><span class="footnote t2">Or enter it:</span><div class="rv-macros">${['cal', 'p', 'c', 'f'].map((k) => `<label><span>${{ cal: 'Cal', p: 'Protein', c: 'Carbs', f: 'Fat' }[k]}</span>${numIn('', 'manual-' + k, i, k)}</label>`).join('')}</div>
          <button class="btn btn-secondary btn-sm mt8" data-act="rvManual" data-i="${i}">Use these values</button></div></div>`;
    const tot = N.itemTotals(it);
    const units = N.unitsFor(it);
    const unitSel = units.length > 1
      ? `<select class="input unit-sel" data-in="rvUnit" data-i="${i}" aria-label="Unit">${units.map((u) => `<option value="${esc(u)}" ${u === it.unit ? 'selected' : ''}>${esc(N.unitLabel(u, 2) === u ? u : N.unitLabel(u, it.qty))}</option>`).join('')}</select>`
      : `<span class="footnote t2">${esc(N.unitLabel(it.unit, it.qty))}</span>`;
    const step = it.unit === 'g' ? 10 : it.unit === 'oz' ? 0.5 : it.qty < 1 ? 0.25 : 0.5;
    const v = (x) => (x == null ? '' : x);
    return `<div class="rv" data-i="${i}">
      <div class="row between top"><input class="input rv-name" data-in="rvName" data-i="${i}" value="${esc(it.name)}" aria-label="Food name">${rm}</div>
      <div class="rv-meta">${it.brand ? `<span class="t2">${esc(it.brand)}</span>` : ''}${confTag(it.conf)}${matchTag(it)}${it.partOf ? `<span class="t3">· ${esc(it.partOf)}</span>` : ''}</div>
      <div class="rv-amt">
        <div class="stepper sm"><button data-act="rvStep" data-i="${i}" data-d="-1" aria-label="Less">${I('minus', 14)}</button>${numIn(it.qty, 'qty', i, 'Amount', step)}<button data-act="rvStep" data-i="${i}" data-d="1" aria-label="More">${I('plus', 14)}</button></div>
        ${unitSel}<span class="grow"></span>
        <button class="btn btn-plain btn-sm" data-act="rvSearch" data-i="${i}">${I('swap', 14)}Replace</button>
      </div>
      <div class="rv-tot tnum" id="rvTot${i}"><b>${it.per.cal == null ? '—' : cal(tot.cal)}</b> cal · <b>${N.rp(tot.p)}</b> g protein · ${it.per.c == null ? '—' : N.rg(tot.c)} g carbs · ${it.per.f == null ? '—' : N.rg(tot.f)} g fat</div>
      ${it.note ? `<div class="footnote t3 mt4">${esc(it.note)}</div>` : ''}
      <details class="adv rv-fix" ${H.keepOpen('rvfix' + i)}><summary>${I('chevD', 14)}Correct the values</summary>
        <div class="rv-macros mt8">${['cal', 'p', 'c', 'f'].map((k) => `<label><span>${{ cal: 'Cal', p: 'Protein', c: 'Carbs', f: 'Fat' }[k]}</span>${numIn(v(it.per[k] == null ? null : k === 'cal' ? N.rcal(tot[k]) : N.rg(tot[k])), 'v-' + k, i, k, k === 'cal' ? 5 : 1)}</label>`).join('')}</div>
        <p class="footnote t3 mt4">Totals for this amount. Corrected values are saved as yours.</p></details>
      ${it.manual ? `<label class="row mt8 footnote t2"><input type="checkbox" data-in="rvSave" data-i="${i}" ${it.save ? 'checked' : ''}> Save to My foods for next time</label>` : ''}
    </div>`;
  }
  const rvState = () => WT.ui.review;
  function rvTotals() {
    const rv = rvState();
    const ok = rv.items.filter((i) => !i.unknown && !i.ambiguous);
    return N.sumItems(ok);
  }
  function openReview(items, focusText, mode) {
    const rv = (WT.ui.review = {
      items: items.map((it) => Object.assign({}, it, { per: it.per ? Object.assign({}, it.per) : null })),
      meal: curMealFor(ui().day || today()), save: false, saveName: '', add: '',
    });
    WT.openSheet(() => {
      const list = rv.items;
      const unresolved = list.filter((i) => i.unknown || i.ambiguous).length;
      const t = rvTotals();
      let lastPart = '';
      const body = list.map((it, i) => {
        const head = it.partOf && it.partOf !== lastPart ? `<div class="rv-group">${esc(it.partOf)}</div>` : '';
        lastPart = it.partOf || '';
        return head + reviewCard(it, i);
      }).join('');
      return {
        title: 'Review meal',
        eyebrow: dayName(ui().day || today()),
        wide: true,
        body: `<div class="seg meal-seg full mb12" role="group" aria-label="Meal">${N.MEALS.map(([k, n]) => `<button class="${k === rv.meal ? 'on' : ''}" data-act="rvMeal" data-k="${k}" aria-pressed="${k === rv.meal}">${n}</button>`).join('')}</div>
          ${list.length ? `<div class="fstack" style="gap:12px">${body}</div>` : '<p class="t2">Nothing to log yet. Add an item below.</p>'}
          <div class="rv-add mt16"><input class="input grow" id="rvAddIn" data-in="rvAddText" value="${esc(rv.add)}" placeholder="Add a missing item, e.g. “a side of guac”" aria-label="Add an item"><button class="btn btn-secondary" data-act="rvAdd">${I('plus', 15)}Add</button></div>
          <div class="rv-save mt16">${H.li({ title: 'Save as a meal', sub: 'Log it again in one tap from Quick add', trail: H.toggle(rv.save, 'rvSaveMeal') })}
            ${rv.save ? `<input class="input mt8" data-in="rvSaveName" value="${esc(rv.saveName)}" placeholder="Meal name, e.g. Usual Chipotle bowl" aria-label="Meal name">` : ''}</div>`,
        foot: `<div class="rv-sum grow tnum" id="rvTotal"><b>≈${cal(t.cal)}</b> cal<span class="t2"> · ${N.rp(t.p)} P · ${N.rg(t.c)} C · ${N.rg(t.f)} F</span></div><button class="btn btn-secondary" data-act="closeSheet">Cancel</button><button class="btn btn-primary" data-act="rvLog" ${unresolved || !list.length ? 'disabled' : ''}>${unresolved ? `${plural(unresolved, 'item')} to check` : `Log ${plural(list.length, 'item')}`}</button>`,
        after: (sheet) => {
          if (!focusText) return;
          const idx = list.findIndex((x) => (x.key || x.text) === focusText);
          focusText = null;
          if (idx < 0) return;
          if (mode === 'search') return A.rvSearch({ i: idx });
          const inp = sheet.querySelector(`[data-in="rvNum"][data-i="${idx}"][data-k="manual-cal"]`);
          if (inp) inp.focus();
        },
      };
    }, { wide: true });
  }
  WT.openFoodReview = openReview;
  function paintCard(i) {
    const it = rvState().items[i];
    const el = document.getElementById('rvTot' + i);
    if (el && it && it.per) {
      const tot = N.itemTotals(it);
      el.innerHTML = `<b>${it.per.cal == null ? '—' : cal(tot.cal)}</b> cal · <b>${N.rp(tot.p)}</b> g protein · ${it.per.c == null ? '—' : N.rg(tot.c)} g carbs · ${it.per.f == null ? '—' : N.rg(tot.f)} g fat`;
    }
    const t = rvTotals();
    const tt = document.getElementById('rvTotal');
    if (tt) tt.innerHTML = `<b>≈${cal(t.cal)}</b> cal<span class="t2"> · ${N.rp(t.p)} P · ${N.rg(t.c)} C · ${N.rg(t.f)} F</span>`;
  }
  A.rvMeal = (d) => {
    rvState().meal = d.k;
    WT.refreshSheet();
  };
  A.rvPick = (d) => {
    if (String(d.id).startsWith('c:')) return A.catPick(d);
    const rv = rvState().items;
    const cur = rv[+d.i];
    if (!cur) return;
    if (d.id === '__generic') rv[+d.i] = Object.assign(cur.fallback || N.parseItem(cur.text, { generic: true }), { key: cur.key });
    else rv[+d.i] = Object.assign(N.resolveAs(cur, d.id, d.variant), { learn: true, learnRef: d.id, key: cur.key, partOf: cur.partOf });
    if (d.t) ui().fix[d.t] = d.id === '__generic' ? { generic: true } : { id: d.id, variant: d.variant || '' };
    WT.refreshSheet();
  };
  A.rvRemove = (d) => {
    rvState().items.splice(+d.i, 1);
    WT.refreshSheet();
  };
  A.rvStep = (d) => {
    const it = rvState().items[+d.i];
    if (!it) return;
    const step = it.unit === 'g' ? 10 : it.unit === 'oz' ? 0.5 : it.qty < 1 || (it.qty === 1 && +d.d < 0) ? 0.25 : 0.5;
    const next = WT.round(Math.max(step, it.qty + +d.d * step), 2);
    setQty(it, next);
    const inp = document.querySelector(`[data-in="rvNum"][data-i="${d.i}"][data-k="qty"]`);
    if (inp) inp.value = next;
    paintCard(+d.i);
  };
  function setQty(it, q) {
    if (it.edited && it.per) {
      // keep corrected totals proportional: per-unit values don't change
    }
    it.qty = q;
    it.qtyEdited = true;
    it.assumed = false;
  }
  WT.I.rvUnit = (el, ev) => {
    if (ev.type !== 'change') return;
    const rv = rvState().items;
    const i = +el.dataset.i;
    const r = N.reunit(rv[i], el.value);
    if (!r) return WT.toast(`“${el.value}” isn’t a measured size for this food`, 'error');
    rv[i] = Object.assign(r, { qtyEdited: true, assumed: false });
    WT.refreshSheet();
  };
  WT.I.rvName = (el) => {
    const it = rvState().items[+el.dataset.i];
    if (it) it.name = el.value;
  };
  WT.I.rvSave = (el) => {
    const it = rvState().items[+el.dataset.i];
    if (it) it.save = el.checked;
  };
  WT.I.rvAddText = (el) => (rvState().add = el.value);
  WT.I.rvSaveName = (el) => (rvState().saveName = el.value);
  A.rvSaveMeal = () => {
    const rv = rvState();
    rv.save = !rv.save;
    if (rv.save && !rv.saveName) rv.saveName = rv.items.filter((i) => !i.unknown).slice(0, 2).map((i) => i.name).join(', ').slice(0, 50);
    WT.refreshSheet();
  };
  A.rvAdd = () => {
    const rv = rvState();
    const el = document.getElementById('rvAddIn');
    const txt = String((el && el.value) || rv.add || '').trim();
    if (!txt) return WT.toast('Type the item to add');
    // keep the restaurant context of the meal ("…Chipotle bowl" + "chips" = Chipotle chips)
    const chain = (rv.items.find((x) => x.foodId && String(x.foodId).startsWith('r:')) || {}).foodId;
    const ctx = chain ? chain.split(':')[1] : null;
    const parsed = N.parse(txt).map((it) => (ctx && !it.chainId && !String(it.foodId || '').startsWith('r:') ? Object.assign(N.parseItem(it.text, { chain: ctx }), { key: it.key }) : it));
    const flat = parsed.flatMap((p) => (p.parts ? p.parts : [p]));
    flat.forEach((p) => (p.key = 'add:' + WT.uid()));
    rv.items.push(...flat);
    rv.add = '';
    WT.refreshSheet();
  };
  WT.I.rvNum = (el, ev) => {
    const rv = rvState().items;
    const i = +el.dataset.i, k = el.dataset.k;
    const it = rv[i];
    if (!it) return;
    const v = parseFloat(el.value);
    if (k.startsWith('manual-')) return;
    if (k === 'qty') {
      if (isNaN(v) || !(v > 0)) return;
      setQty(it, v);
      return paintCard(i);
    }
    if (k.startsWith('v-')) {
      const m = k.slice(2);
      if (el.value === '' && m !== 'p') it.per[m] = null;
      else if (isNaN(v) || v < 0) return;
      else it.per[m] = v / (it.qty || 1);
      it.edited = true;
      it.conf = 'user';
      if (ev.type === 'change') return WT.refreshSheet();
      return paintCard(i);
    }
  };
  A.rvManual = (d) => {
    const i = +d.i;
    const it = rvState().items[i];
    if (!it) return;
    const get = (k) => {
      const el = document.querySelector(`[data-in="rvNum"][data-i="${i}"][data-k="manual-${k}"]`);
      return el ? el.value : '';
    };
    const vals = { cal: get('cal'), p: get('p'), c: get('c'), f: get('f') };
    if (vals.cal === '' && vals.p === '') return WT.toast('Enter at least calories or protein', 'error');
    rvState().items[i] = manualItem(it, vals);
    WT.refreshSheet();
  };
  A.rvLog = () => {
    const rv = rvState();
    const list = rv.items.filter((i) => !i.unknown && !i.ambiguous);
    if (!list.length) return;
    list.forEach((it) => (it.name = String(it.name || '').trim() || WT.cap(it.text)));
    if (rv.save && !String(rv.saveName).trim()) return WT.toast('Give the meal a name, or turn off “Save as a meal”', 'error');
    logItems(list, { meal: rv.meal, saveAs: rv.save ? String(rv.saveName).trim() : null });
    ui().draft = '';
    ui().fix = {};
    ui().meal = null;
    WT.closeSheet(true);
    WT.rerender();
  };

  /* ───────── Search & replace (all sources) ───────── */
  /**
   * Search sheet: everything on this device first (your foods, bundled products, restaurants, USDA reference foods,
   * foods found online before), then — optionally — live USDA FoodData Central and Open Food Facts results.
   * opts: { title, eyebrow, q, onPick(result), foot }
   */
  function openSearch(opts) {
    const L = WT.lookup;
    const st = { q: opts.q || '', res: [], online: null, busy: false, errors: [], seq: 0, asked: '' };
    const srcTag = (r) => (r.remote ? (r.remote.src === 'fdc' ? 'USDA' : 'Open Food Facts') : '');
    const row = (r, j) => `<button class="li food-main sr" data-act="srPick" data-j="${j}"><div class="grow"><div class="ti">${esc(r.name)} ${confTag(r.status || 'estimated')}${srcTag(r) ? `<span class="tag src">${srcTag(r)}</span>` : ''}</div><div class="su tnum">${esc(r.serving || '')}${r.cal != null ? ` · ${cal(r.cal)} cal` : ''} · ${r.p == null ? '—' : N.rp(r.p)} g protein</div></div></button>`;
    const localHtml = () => {
      const fresh = new Set((st.online || []).map((r) => 'x:' + r.id));
      const local = N.searchAll(st.q, 24).filter((x) => !fresh.has(x.id)); // this search's online results get their own sections
      const online = (st.online || []).map((rec) => {
        const sv = L.servingOf(rec);
        return { id: 'x:' + rec.id, kind: rec.src === 'fdc' ? 'Online · USDA FoodData Central' : 'Online · Open Food Facts', name: `${rec.brand ? rec.brand + ' ' : ''}${rec.name}`, brand: rec.brand, serving: sv.text, p: sv.per.p, cal: sv.per.cal, status: rec.status, remote: rec };
      });
      online.sort((a, b) => (a.kind === b.kind ? 0 : a.kind.includes('USDA') ? 1 : -1)); // branded grocery first
      st.res = local.concat(online);
      if (!st.res.length) return `<p class="footnote t3 sr-none">${st.q.trim().length < 2 ? 'Type a food, brand or restaurant item.' : 'Nothing on this device matches. Try fewer words, search online, or enter it from the label.'}</p>`;
      let last = '';
      return `<div class="list inset sr-list">${st.res.map((r, j) => {
        const h = r.kind !== last ? `<div class="label sr-kind">${esc(r.kind)}</div>` : '';
        last = r.kind;
        return h + row(r, j);
      }).join('')}</div>`;
    };
    const onlineBar = () => {
      if (!L) return '';
      if (!L.enabled()) return `<p class="footnote t3">Online lookup is off. Turn it on in Settings → Nutrition to search USDA and Open Food Facts.</p>`;
      const msg = st.busy ? 'Searching USDA and Open Food Facts…' : st.online ? `${st.online.length ? `${st.online.length} online result${st.online.length === 1 ? '' : 's'}` : 'No online results'}${st.cached ? ' (saved earlier)' : ''}` : 'USDA FoodData Central and Open Food Facts — free, optional';
      return `<div class="row between sr-online"><span class="footnote t2">${msg}</span><button class="btn btn-secondary btn-sm" data-act="srOnline" ${st.busy || st.q.trim().length < 2 ? 'disabled' : ''}>${I('search', 14)}${st.online ? 'Search again' : 'Search online'}</button></div>
        ${st.errors.map((e) => `<p class="footnote sr-err">${esc(e.text)}</p>`).join('')}`;
    };
    const paint = () => {
      const a1 = document.getElementById('srList'), a2 = document.getElementById('srOnlineBar');
      if (a1) a1.innerHTML = localHtml();
      if (a2) a2.innerHTML = onlineBar();
    };
    async function goOnline(auto) {
      const q = st.q.trim();
      if (q.length < 2 || !L || !L.enabled()) return;
      if (auto && st.asked === q.toLowerCase()) return;
      st.asked = q.toLowerCase();
      const my = ++st.seq;
      st.busy = true;
      st.errors = [];
      paint();
      const r = await L.search(q);
      if (my !== st.seq) return; // a newer search replaced this one
      st.busy = false;
      st.online = r.results;
      st.cached = r.cached;
      st.errors = r.errors;
      paint();
    }
    WT.openSheet(() => ({
      eyebrow: opts.eyebrow || '',
      title: opts.title || 'Search foods',
      body: `<input class="input" id="srQ" data-in="srQ" value="${esc(st.q)}" placeholder="Food, brand, product or restaurant item" autocomplete="off" aria-label="Search foods" enterkeyhint="search">
        <div id="srOnlineBar" class="mt8">${onlineBar()}</div>
        <div id="srList" class="mt8">${localHtml()}</div>`,
      foot: opts.foot || `<button class="btn btn-plain btn-sm" data-act="productAdd">${I('plus', 14)}Enter from a label</button><span class="grow"></span><button class="btn btn-secondary" data-act="closeSheet">Cancel</button>`,
      after: (sh) => {
        const q = sh.querySelector('#srQ');
        if (q && !q.dataset.f) {
          q.dataset.f = 1;
          q.focus();
          q.select();
          q.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), goOnline(false)));
        }
      },
    }), { wide: true });
    let qt = null, ot = null;
    WT.I.srQ = (el, ev) => {
      if (ev.type !== 'input') return;
      st.q = el.value;
      st.online = null;
      st.errors = [];
      st.seq++;
      st.busy = false;
      clearTimeout(qt);
      clearTimeout(ot);
      qt = setTimeout(paint, 120);
      // look online by itself only when this device has little to offer (keeps the free quotas for when they matter)
      ot = setTimeout(() => {
        const strong = N.searchAll(st.q, 6).filter((r) => r.s >= 2).length;
        if (st.q.trim().length >= 4 && strong < 2 && navigator.onLine !== false) goOnline(true);
      }, 900);
    };
    A.srOnline = () => goOnline(false);
    A.srPick = (dd) => {
      const r = st.res[+dd.j];
      if (r) opts.onPick(r);
    };
    if (opts.q && opts.autoOnline) setTimeout(() => goOnline(true), 50);
    // the offline USDA copy (if built) loads on first use; refresh the list when it arrives
    if (L && !L.offlineDB()) L.loadOffline().then((db) => db && db.foods.length && paint());
  }
  WT.openFoodSearch = openSearch;

  /** Replace an item in the review with a search result. */
  A.rvSearch = (d) => {
    const i = +d.i;
    const cur = rvState().items[i];
    if (!cur) return;
    openSearch({
      eyebrow: `Replace “${esc(cur.name || cur.text)}”`,
      q: cur.unknown || cur.ambiguous ? cur.phrase || cur.text : cur.phrase || cur.name,
      foot: `<button class="btn btn-plain btn-sm" data-act="productAdd" data-t="${esc(cur.text)}" data-i="${i}">${I('plus', 14)}Branded product from label</button><span class="grow"></span><button class="btn btn-secondary" data-act="closeSheet">Cancel</button>`,
      onPick: (r) => {
        const items = rvState().items;
        const next = N.resolveAs(Object.assign({}, cur), r.id);
        items[i] = Object.assign(next, { key: cur.key, learnRef: r.id, partOf: cur.partOf, phrase: cur.phrase, text: cur.text, qtyEdited: cur.qtyEdited });
        WT.closeSheet(); // back to the review
        WT.refreshSheet();
      },
    });
  };
  /** Search foods → pick one → review it (amount, meal) → log. */
  A.foodSearch = () => {
    openSearch({
      title: 'Search foods',
      q: '',
      onPick: (r) => {
        WT.closeSheet(true);
        const it = N.resolveAs({ id: WT.uid(), text: r.name, qty: 1, phrase: '' }, r.id);
        if (!it || !it.per) return WT.toast('Couldn’t open that food', 'error');
        it.key = 'search:' + r.id;
        it.match = it.src === 'restaurant' || it.src === 'product' || it.src === 'my' || it.src === 'online' ? 'exact' : it.match || 'close';
        openReview([it]);
      },
    });
  };

  /* ───────── Edit a logged entry ───────── */
  A.foodEdit = (d) => {
    const e = N.entry(d.id);
    if (!e) return;
    const form = { name: e.name, qty: e.qty, unit: e.unit, per: Object.assign({}, e.per), date: e.date, meal: e.meal, foodId: e.foodId };
    const libRef = (e.foodId || '').startsWith('my:') ? WT.db.nutrition.foods.find((f) => f.id === e.foodId.slice(3)) : null;
    WT.openSheet(() => {
      const tot = N.itemTotals(form);
      const units = N.unitsFor(form);
      const fnum = (k, label, v, step) => `<label class="fstack" style="gap:6px"><span class="label">${label}</span><input class="input tnum" type="number" inputmode="decimal" min="0" step="${step || 1}" data-in="feNum" data-k="${k}" value="${v == null ? '' : v}"></label>`;
      const blank = (k, v) => (form.per[k] == null ? null : v);
      return {
        eyebrow: `${N.statusLabel(e.conf)} · ${dayName(e.date)}`,
        title: 'Edit entry',
        headExtra: `<button class="icon-btn" data-act="feFav" aria-label="Save to My foods" title="Save to My foods">${I('star', 18)}</button>`,
        body: `<div class="fstack" style="gap:14px">
          <label class="fstack" style="gap:6px"><span class="label">Food</span><input class="input" data-in="feText" data-k="name" value="${esc(form.name)}"></label>
          <div class="fields">
            ${fnum('qty', 'Amount', form.qty, form.unit === 'g' ? 10 : 0.5)}
            <label class="fstack" style="gap:6px"><span class="label">Serving</span>${units.length > 1 && form.foodId ? `<select class="input" data-in="feUnit">${units.map((u) => `<option value="${esc(u)}" ${u === form.unit ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select>` : `<input class="input" data-in="feText" data-k="unit" value="${esc(form.unit)}">`}</label>
          </div>
          <div class="fields">
            <label class="fstack" style="gap:6px"><span class="label">Meal</span><select class="input" data-in="feText" data-k="meal">${N.MEALS.map(([k, n]) => `<option value="${k}" ${k === form.meal ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
            <label class="fstack" style="gap:6px"><span class="label">Date</span><input class="input" type="date" data-in="feText" data-k="date" value="${form.date}" max="${today()}"></label>
          </div>
          <div class="fields four">${fnum('cal', 'Calories', blank('cal', N.rcal(tot.cal)), 5)}${fnum('p', 'Protein (g)', N.rp(tot.p))}${fnum('c', 'Carbs (g)', blank('c', N.rg(tot.c)))}${fnum('f', 'Fat (g)', blank('f', N.rg(tot.f)))}</div>
          <p class="footnote t3">${confTag(e.conf)} ${esc(e.note || '')}</p>
          ${e.text && e.text.toLowerCase() !== e.name.toLowerCase() ? `<p class="footnote t3">You typed: “${esc(e.text)}”</p>` : ''}
          <p class="footnote t3">Changing the amount scales every value.${libRef ? ` Correcting the values also updates “${esc(libRef.name)}” in My foods.` : ''}</p>
        </div>`,
        foot: `<button class="btn btn-plain btn-sm" style="color:var(--danger)" data-act="feDelete">Delete</button><button class="btn btn-plain btn-sm" data-act="feCopy">${I('swap', 14)}${e.date === today() ? 'Duplicate' : 'Copy to today'}</button><span class="grow"></span><button class="btn btn-primary" data-act="feSave">Save</button>`,
      };
    });
    WT.I.feText = (el) => (form[el.dataset.k] = el.value);
    WT.I.feUnit = (el, ev) => {
      if (ev.type !== 'change') return;
      const r = N.reunit(Object.assign({}, form, { per: Object.assign({}, form.per) }), el.value);
      if (!r) return WT.toast(`“${el.value}” isn’t a measured size for this food`, 'error');
      Object.assign(form, { qty: r.qty, unit: r.unit, per: r.per, unitChanged: true });
      WT.refreshSheet();
    };
    WT.I.feNum = (el, ev) => {
      const v = parseFloat(el.value);
      const k = el.dataset.k;
      if (k !== 'p' && k !== 'qty' && el.value === '') {
        form.per[k] = null;
        return;
      }
      if (isNaN(v) || v < 0) return;
      if (k === 'qty') {
        if (!(v > 0)) return;
        form.qty = v;
        form.qtyEdited = true;
        if (ev.type === 'change' && el.isConnected) WT.refreshSheet(); // not for the 'change' fired while it's being replaced
        return;
      }
      form.per[k] = v / (form.qty || 1);
      form.edited = true;
    };
    A.feSave = () => {
      const name = String(form.name).trim();
      if (!name) return WT.toast('Give it a name', 'error');
      const date = N.validDay(form.date) && form.date <= today() ? form.date : e.date;
      const edited = !!form.edited;
      N.updateEntry(e.id, { name, qty: WT.round(form.qty, 2), unit: String(form.unit).trim() || 'serving', per: form.per, date, meal: form.meal, src: edited && e.src === 'db' ? 'manual' : e.src, note: edited ? 'Corrected by you' : e.note, generic: edited ? false : e.generic, conf: edited ? 'user' : e.conf });
      if ((form.qtyEdited || form.unitChanged) && e.foodId && !edited) N.rememberPortion(e.foodId, form.qty, form.unit);
      let msg = date !== e.date ? `Moved to ${dayName(date)}` : 'Saved';
      if (edited) {
        // Corrections to a product are kept: update its library entry, or save a branded item as your product
        let lib = N.correctLibrary(N.entry(e.id));
        if (!lib && (e.brand || e.src === 'product' || e.src === 'restaurant')) {
          lib = N.saveFood({ name, brand: e.brand, unit: form.unit, qty: 1, per: form.per, status: 'user', source: { name: 'Corrected by you' } }, false);
          N.updateEntry(e.id, { foodId: 'my:' + lib.id });
          if (e.text) N.learn(e.text, 'my:' + lib.id);
        }
        if (lib) msg = 'Saved · updated in My foods';
      }
      WT.closeSheet();
      WT.rerender();
      WT.toast(msg);
    };
    A.feDelete = () =>
      WT.confirm('Delete entry?', `Remove “${esc(e.name)}”?`, 'Delete', () => {
        N.deleteEntry(e.id);
        WT.closeSheet(true);
        WT.rerender();
        WT.toast('Entry deleted');
      }, true);
    A.feCopy = () => {
      N.copyEntries([e.id], today(), e.date === today() ? e.meal : curMealFor(today()));
      WT.closeSheet(true);
      WT.rerender();
      WT.toast(`Copied “${e.name}” to today`, 'good');
    };
    A.feFav = () => {
      if (libRef) {
        libRef.fav = true;
        WT.save();
      } else N.saveFood({ name: String(form.name).trim(), brand: e.brand, qty: form.qty, unit: form.unit, per: form.per, status: e.conf === 'estimated' ? 'estimated' : e.conf === 'verified' ? 'verified' : 'user' }, true);
      WT.toast(`Saved “${form.name}” to My foods`, 'good');
    };
  };

  /* ───────── My foods: your personal library of products and foods ───────── */
  const starSvg = (on) => I('star', 17).replace('fill="none"', on ? 'fill="currentColor"' : 'fill="none"');
  A.foodMine = (d) => {
    const st = { tab: (d && d.tab) || 'foods' };
    WT.openSheet(() => {
      const foods = WT.db.nutrition.foods.slice().sort((a, b) => (b.fav - a.fav) || String(b.lastUsed || '').localeCompare(String(a.lastUsed || '')) || a.name.localeCompare(b.name));
      const meals = WT.db.nutrition.meals.slice().sort((a, b) => (b.fav - a.fav) || (b.uses || 0) - (a.uses || 0) || a.name.localeCompare(b.name));
      const learned = Object.entries(WT.db.nutrition.learned || {});
      const tabs = H.seg([['foods', `Foods${foods.length ? ' · ' + foods.length : ''}`], ['meals', `Meals${meals.length ? ' · ' + meals.length : ''}`], ['learned', 'Learned']], st.tab, 'mfTab', '', 'full');
      let body = '';
      if (st.tab === 'meals')
        body = meals.length
          ? `<div class="list inset mt16">${meals.map((m) => {
              const t = N.sumItems(m.items);
              return `<div class="li"><button class="icon-btn sm ${m.fav ? 'on' : ''}" data-act="mlStar" data-id="${m.id}" aria-label="${m.fav ? 'Unstar' : 'Star'} meal" aria-pressed="${!!m.fav}">${starSvg(m.fav)}</button><div class="grow"><div class="ti">${esc(m.name)}</div><div class="su tnum">${plural(m.items.length, 'item')} · ≈${cal(t.cal)} cal · ${N.rp(t.p)} g protein${m.meal ? ' · ' + N.mealName(m.meal) : ''}</div><div class="su t3">${esc(m.items.map((i) => i.name).join(', '))}</div></div>
                <button class="btn btn-secondary btn-sm" data-act="mlLog" data-id="${m.id}">Log</button><button class="icon-btn sm" data-act="mlDel" data-id="${m.id}" aria-label="Delete ${esc(m.name)}">${I('trash', 15)}</button></div>`;
            }).join('')}</div>`
          : `<p class="footnote t3 mt16">No saved meals yet. In the diary, open a meal’s ⋯ menu and choose “Save as a meal”, or turn on “Save as a meal” when reviewing.</p>`;
      else if (st.tab === 'learned')
        body = `<p class="t2 mt16">When you replace a match or change an amount, Forge remembers it for the next time you type the same words.</p>${learned.length ? `<div class="list inset mt12">${learned.map(([k, v]) => {
          const r = N.resolveAs({ text: k, qty: 1, unit: null }, v.ref);
          return `<div class="li"><div class="grow"><div class="ti">“${esc(k)}”</div><div class="su">→ ${esc(r && r.name ? r.name : v.ref)}</div></div><button class="icon-btn sm" data-act="mfForget" data-k="${esc(k)}" aria-label="Forget">${I('x', 15)}</button></div>`;
        }).join('')}</div>` : `<p class="footnote t3 mt8">Nothing learned yet.</p>`}`;
      else
        body = `<p class="t2 mt16">Products and foods you’ve logged or saved. They’re recognized when you type them — even by shorthand — and use these values. Starred ones are one-tap favorites.</p>
          ${foods.length ? `<div class="list inset mt16">${foods.map((f) => `<div class="li"><button class="icon-btn sm ${f.fav ? 'on' : ''}" data-act="mfStar" data-id="${f.id}" aria-label="${f.fav ? 'Remove from' : 'Add to'} favorites" aria-pressed="${!!f.fav}">${starSvg(f.fav)}</button><button class="grow food-main" data-act="mfEdit" data-id="${f.id}"><div class="ti">${esc(f.name)} ${confTag(f.status)}</div><div class="su tnum">${esc(f.serving || N.fmtAmount(1, f.unit))} · ${f.per.cal != null ? cal(f.per.cal) + ' cal · ' : ''}${g(f.per.p)} protein per ${esc(f.unit)}${f.aliases.length ? ` · also “${esc(f.aliases.slice(0, 2).join('”, “'))}”` : ''}</div></button><span class="chev">${I('chevR', 16)}</span></div>`).join('')}</div>` : `<p class="footnote t3 mt16">Nothing saved yet. Branded products are saved automatically once you log them.</p>`}`;
      return {
        title: 'My foods',
        body: tabs + body,
        foot: st.tab === 'foods' ? `<button class="btn btn-secondary" data-act="mfEdit" data-id="">${I('edit', 15)}Enter from label</button><span class="grow"></span><button class="btn btn-primary" data-act="productAdd">${I('search', 15)}Find product</button>` : `<span class="grow"></span><button class="btn btn-secondary" data-act="closeSheet">Done</button>`,
      };
    });
    A.mfTab = (dd) => {
      st.tab = dd.v;
      WT.refreshSheet();
    };
  };
  A.mlStar = (d) => {
    const m = N.mealById(d.id);
    if (!m) return;
    m.fav = !m.fav;
    WT.save();
    WT.refreshSheet();
  };
  A.mlLog = (d) => {
    const m = N.mealById(d.id);
    if (!m) return;
    const day = ui().day || today();
    const meal = curMealFor(day);
    const added = N.logMeal(d.id, day, meal);
    WT.closeSheet(true);
    if (WT.ui.route === 'food') WT.rerender();
    WT.toast(`Logged “${m.name}” to ${N.mealName(meal)} · ≈${cal(N.sumItems(added).cal)} cal`, 'good');
  };
  A.mlDel = (d) => {
    const m = N.mealById(d.id);
    if (!m) return;
    WT.confirm('Delete saved meal?', `“${esc(m.name)}” will be removed from Quick add. Entries you already logged are kept.`, 'Delete', () => {
      N.deleteMeal(d.id);
      WT.refreshSheet();
      if (WT.ui.route === 'food') WT.rerender();
    }, true);
  };
  A.mfForget = (d) => {
    delete WT.db.nutrition.learned[d.k];
    WT.save();
    WT.refreshSheet();
  };
  A.mfStar = (d) => {
    const f = WT.db.nutrition.foods.find((x) => x.id === d.id);
    if (!f) return;
    f.fav = !f.fav;
    WT.save();
    WT.refreshSheet();
    if (WT.ui.route === 'food') WT.rerender();
  };

  /**
   * Product form — edit a library product, add one from the label, or confirm one found online.
   * opts: { id } existing library entry · { prefill } values to start from · { ctx: { text, review } } typed item to resolve after saving
   */
  function productForm(opts) {
    opts = opts || {};
    const f = opts.id ? WT.db.nutrition.foods.find((x) => x.id === opts.id) : null;
    const src = f || opts.prefill || {};
    const per = src.per || {};
    const v = (x) => (x == null || x === '' ? '' : WT.round(+x, 1));
    const lineOf = (x) => {
      if (x.line) return x.line;
      let n = x.name || '';
      if (x.brand && n.toLowerCase().startsWith(x.brand.toLowerCase())) n = n.slice(x.brand.length).trim();
      if (x.flavor) n = n.replace(/\s·\s.*$/, '');
      return n;
    };
    const form = {
      brand: src.brand || '', line: lineOf(src), flavor: src.flavor || '', unit: src.unit || 'serving', serving: src.serving || '', g: src.g || '',
      p: v(per.p), cal: v(per.cal), c: v(per.c), f: v(per.f), aliases: (src.aliases || []).join(', '), qty: src.qty || 1, fav: f ? !!f.fav : !!opts.fav, code: src.code || '',
      // package: "a jar is 5.5 servings" — so "half a jar" works for your own products too
      pkgUnit: src.pkgUnit || '', pkgServings: src.pkgServings || '',
    };
    if (!form.pkgUnit && src.units) {
      const pk = Object.keys(src.units).find((k) => /^(jar|tub|box|bag|package|bottle|container|can|carton|pouch|loaf)$/.test(k));
      if (pk) Object.assign(form, { pkgUnit: pk, pkgServings: WT.round(src.units[pk], 2) });
    }
    const snap = () => JSON.stringify([form.p, form.cal, form.c, form.f, form.unit, form.serving].map((x) => String(x).trim()));
    const orig = snap();
    const status = f ? f.status : opts.prefill && opts.prefill.status ? opts.prefill.status : 'user';
    const source = (f && f.source) || (opts.prefill && opts.prefill.source) || null;
    const fld = (k, label, type, extra) => `<label class="fstack" style="gap:6px"><span class="label">${label}</span><input class="input ${type === 'number' ? 'tnum' : ''}" ${type === 'number' ? 'type="number" inputmode="decimal" min="0" step="any"' : ''} data-in="mf" data-k="${k}" value="${esc(form[k])}" ${extra || ''}></label>`;
    WT.openSheet(() => ({
      eyebrow: f ? 'My foods' : source ? 'Check against your package' : 'From the label',
      title: f ? 'Edit product' : 'New product',
      body: `<div class="fstack" style="gap:14px">
        ${source ? `<p class="footnote t2">${confTag(status)} Source: ${source.url ? `<a class="btn-link" href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.name)}</a>` : esc(source.name)}${(f && f.checked) || (opts.prefill && opts.prefill.checked) ? ` · checked ${esc((f && f.checked) || opts.prefill.checked)}` : ''}${status !== 'verified' ? ' · Saving confirms these values match your package.' : ' · Changing a value marks it as confirmed by you.'}</p>` : ''}
        <div class="fields">${fld('brand', 'Brand', 'text', 'placeholder="e.g. Pioneer Pastures"')}${fld('flavor', 'Flavor or variety', 'text', 'placeholder="e.g. Snickerdoodle"')}</div>
        ${fld('line', 'Product', 'text', 'placeholder="e.g. A2 Protein Shake"')}
        <div class="fields">${fld('unit', 'One serving is a…', 'text', 'placeholder="bottle, bar, cup, serving"')}${fld('serving', 'Serving size on the label', 'text', 'placeholder="e.g. 1 bottle (11 fl oz)"')}</div>
        <div class="fields">${fld('p', 'Protein per serving (g)', 'number')}${fld('g', 'Serving weight (g, optional)', 'number')}</div>
        ${P().showMacros !== false ? `<div class="fields" style="grid-template-columns:repeat(3,minmax(0,1fr))">${fld('cal', 'Calories', 'number')}${fld('c', 'Carbs (g)', 'number')}${fld('f', 'Fat (g)', 'number')}</div><p class="footnote t3">Calories, carbs and fat are optional — leave them blank if you like.</p>` : ''}
        ${fld('aliases', 'Shorthand names (optional, comma-separated)', 'text', 'placeholder="e.g. snickerdoodle shake, my shake"')}
        ${fld('code', 'Barcode (optional)', 'text', 'inputmode="numeric" placeholder="Digits under the barcode"')}
        <div class="fields">${fld('pkgUnit', 'Package (optional)', 'text', 'placeholder="jar, tub, box, bag…"')}${fld('pkgServings', 'Servings per package', 'number', 'step="0.5"')}</div>
        <div class="fields">${fld('qty', 'Usual amount (servings)', 'number', 'step="0.5"')}<div></div></div>
        ${H.li({ title: 'Favorite', sub: 'Show as a one-tap button', trail: H.toggle(form.fav, 'mfFav') })}
      </div>`,
      foot: `${f ? `<button class="btn btn-plain btn-sm" style="color:var(--danger)" data-act="mfDelete">Delete</button>` : ''}<span class="grow"></span><button class="btn btn-primary" data-act="mfSave">${f ? 'Save' : 'Save product'}</button>`,
    }));
    WT.I.mf = (el) => (form[el.dataset.k] = el.value);
    A.mfFav = () => {
      form.fav = !form.fav;
      WT.refreshSheet();
    };
    A.mfSave = () => {
      const brand = String(form.brand).trim(), line = String(form.line).trim(), flavor = String(form.flavor).trim();
      if (!line && !brand) return WT.toast('Give it a name', 'error');
      const p = parseFloat(form.p);
      if (isNaN(p) || p < 0) return WT.toast('Enter the protein per serving', 'error');
      const name = `${brand ? brand + ' ' : ''}${line}${flavor ? ' · ' + flavor : ''}`.trim();
      const clash = WT.db.nutrition.foods.find((x) => x.name.toLowerCase() === name.toLowerCase() && x !== f);
      if (clash) return WT.toast('You already have a product with that name', 'error');
      const num = (x) => (x === '' || x == null || isNaN(parseFloat(x)) ? null : parseFloat(x));
      // Verified stays verified only if the nutrition wasn't changed; anything else you save is confirmed by you
      const newStatus = status === 'verified' && snap() === orig ? 'verified' : 'user';
      const pre = opts.prefill || {};
      const data = {
        id: f ? f.id : undefined, name, line, brand, flavor, unit: String(form.unit).trim() || 'serving', serving: String(form.serving).trim(), g: num(form.g) || undefined,
        qty: Math.max(0.25, parseFloat(form.qty) || 1), per: { p, cal: num(form.cal), c: num(form.c), f: num(form.f) },
        aliases: String(form.aliases).split(',').map((a) => a.trim().toLowerCase()).filter(Boolean), status: newStatus,
        source: newStatus === 'verified' ? source : source ? { name: `${source.name}, confirmed by you`.replace(/(, confirmed by you)+$/, ', confirmed by you'), url: source.url } : { name: 'Entered by you from the label' },
        productId: f ? f.productId : pre.productId, cat: (f && f.cat) || pre.cat || '',
        units: (f && f.units) || pre.units, approx: (f && f.approx) || pre.approx, key: (f && f.key) || pre.key,
        checked: newStatus === 'verified' ? (f && f.checked) || pre.checked : today(),
        code: String(form.code || '').replace(/\D/g, '') || undefined,
        catLine: (f && f.catLine) || pre.catLine || undefined,
      };
      // package size → a serving multiplier ("1 jar" = 5.5 servings)
      const pkgU = String(form.pkgUnit || '').trim().toLowerCase(), pkgN = num(form.pkgServings);
      if (pkgU && !(pkgN > 0)) return WT.toast('Enter how many servings the package holds', 'error');
      if (pkgU) data.units = Object.assign({}, data.units || {}, { [pkgU]: pkgN });
      if (data.code && WT.lookup && !WT.lookup.validCode(data.code)) return WT.toast('That barcode’s check digit doesn’t add up — check the digits', 'error');
      if (f) f.aliases = []; // aliases come from the form as edited
      if (data.productId && !f && WT.db.nutrition.foods.some((x) => x.productId === data.productId)) delete data.productId;
      const saved = N.saveFood(data, !!form.fav);
      WT.closeSheet(true);
      if (opts.onSaved) return opts.onSaved(saved);
      if (opts.ctx && opts.ctx.text) {
        ui().fix[opts.ctx.text] = { id: 'my:' + saved.id };
        if (opts.ctx.review != null) {
          WT.toast(`Saved “${name}” to My foods`, 'good');
          return openReview(currentItems());
        }
      }
      if (WT.ui.route === 'food') WT.rerender();
      WT.toast(`Saved “${name}” to My foods`, 'good');
    };
    A.mfDelete = () =>
      WT.confirm('Delete product?', `“${esc(f.name)}” will no longer be recognized or shown as a favorite. Entries you already logged are kept.`, 'Delete', () => {
        N.deleteFood(f.id);
        WT.closeSheet(true);
        if (WT.ui.route === 'food') WT.rerender();
        WT.toast('Deleted');
      }, true);
  }
  WT.productForm = productForm;
  A.mfEdit = (d) => productForm({ id: d.id || null, fav: !d.id }); // a food you add by hand is usually one you want one tap away

  /* ───────── Find a product: your library + bundled products (offline), then an optional online lookup ───────── */
  A.productAdd = (d) => {
    d = d || {};
    WT.closeSheet(true); // replaces My foods / the review sheet; the typed text and choices are kept
    const ctx = d.t ? { text: d.t, review: d.i != null && d.i !== '' ? +d.i : null } : null;
    const guess = d.t ? N.parse(d.t)[0] : null;
    const st = { q: [d.brand, d.variant].filter(Boolean).join(' ') || (guess && guess.phrase) || d.t || '', online: null, busy: false, err: '' };
    const prefillFrom = (r) => {
      if (r.id && r.id.startsWith('p:')) {
        const x = N.productById(r.id.slice(2));
        return { brand: x.brand, line: x.line, flavor: x.flavor || '', unit: x.unit, serving: x.serv, g: x.g, per: { p: x.p, cal: x.cal, c: x.c, f: x.f }, status: x.status, source: x.src, productId: x.id, cat: x.cat, units: x.units, approx: x.approx, key: x.key, checked: x.checked };
      }
      return { brand: r.brand, line: r.name, unit: 'serving', serving: r.serving, g: r.g, per: r.per, status: 'estimated', source: r.source };
    };
    const row = (r, act, i) => `<button class="li food-main" data-act="${act}" data-i="${i}"><div class="grow"><div class="ti">${esc(r.name)} ${confTag(r.status || 'estimated')}</div><div class="su tnum">${esc(r.serving || '')} · ${r.p == null ? '—' : N.rp(r.p)} g protein${r.lib ? ' · in My foods' : ''}</div></div></button>`;
    let local = [];
    const localHtml = () => {
      local = N.searchLocal(st.q);
      return local.length ? `<div class="label" style="margin-bottom:8px">On this device</div><div class="list inset">${local.map((r, i) => row(r, 'paPickLocal', i)).join('')}</div>` : `<p class="footnote t3">No saved or bundled product matches.</p>`;
    };
    WT.openSheet(() => ({
      title: 'Find a product',
      body: `<div class="fstack" style="gap:12px">
        <input class="input" data-in="paQ" value="${esc(st.q)}" placeholder="Brand and product, e.g. Oikos Triple Zero" autocomplete="off" aria-label="Search products">
        <div id="paLocal">${localHtml()}</div>
        <div>
          <div class="row between"><span class="label">Online · Open Food Facts</span><button class="btn btn-secondary btn-sm" data-act="paOnline" ${st.busy ? 'disabled' : ''}>${st.busy ? 'Searching…' : I('search', 14) + 'Search online'}</button></div>
          <p class="footnote t3 mt4">A free community database of package labels. Optional — logging never needs it.</p>
          ${st.err ? `<p class="footnote mt8 pa-err" style="color:var(--burn)">${esc(st.err)}</p>` : ''}
          ${st.online ? (st.online.length ? `<div class="list inset mt8" id="paOnlineList">${st.online.map((r, i) => row({ name: `${r.brand ? r.brand + ' ' : ''}${r.name}`, serving: r.serving, p: r.per.p, status: 'estimated' }, 'paPickOnline', i)).join('')}</div>` : `<p class="footnote t3 mt8">Nothing found online. Enter it from the label instead.</p>`) : ''}
        </div>
      </div>`,
      foot: `<span class="grow"></span><button class="btn btn-primary" data-act="paManual">${I('edit', 15)}Enter from label</button>`,
    }));
    let qt = null;
    WT.I.paQ = (el, ev) => {
      if (ev.type !== 'input') return;
      st.q = el.value;
      clearTimeout(qt);
      qt = setTimeout(() => {
        const host = document.getElementById('paLocal');
        if (host) host.innerHTML = localHtml();
      }, 120);
    };
    A.paPickLocal = (dd) => {
      const r = local[+dd.i];
      if (!r) return;
      WT.closeSheet();
      if (r.lib) {
        if (ctx) {
          ui().fix[ctx.text] = { id: r.id };
          return ctx.review != null ? openReview(currentItems()) : paintPreview();
        }
        return productForm({ id: r.id.slice(3) });
      }
      productForm({ prefill: prefillFrom(r), ctx });
    };
    A.paOnline = async () => {
      if (!st.q.trim()) return WT.toast('Type a brand and product first');
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        st.err = 'You’re offline. Saved products still work — or enter this one from the label.';
        return WT.refreshSheet();
      }
      st.busy = true;
      st.err = '';
      WT.refreshSheet();
      try {
        st.online = await N.lookupOnline(st.q);
      } catch (e) {
        st.online = null;
        st.err = 'Couldn’t reach the online database. Saved products still work — or enter this one from the label.';
      }
      st.busy = false;
      WT.refreshSheet();
    };
    A.paPickOnline = (dd) => {
      const r = st.online && st.online[+dd.i];
      if (!r) return;
      WT.closeSheet();
      productForm({ prefill: prefillFrom(r), ctx });
    };
    A.paManual = () => {
      WT.closeSheet();
      // a new flavor of a product line we know: prefill the product and serving — never the nutrition
      const sib = d.brand && guess && guess.ambiguous ? N.productById((guess.candidates.find((c) => c.id.startsWith('p:')) || { id: 'p:' }).id.slice(2)) : null;
      const pre = { brand: d.brand || '', flavor: d.variant || '', line: d.brand ? '' : guess && guess.phrase ? WT.cap(guess.phrase) : '' };
      if (sib && sib.brand === d.brand) Object.assign(pre, { line: sib.line, unit: sib.unit, serving: sib.serv, cat: sib.cat, g: sib.g, units: sib.units, approx: sib.approx });
      productForm({ prefill: pre, ctx });
    };
  };
})();
