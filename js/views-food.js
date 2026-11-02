/* Views: Food — a quick, forgiving protein diary. Parsing and storage live in nutrition.js. */
(function () {
  const WT = globalThis.WT;
  const I = WT.icon, esc = WT.esc, H = WT.h, A = WT.A, V = WT.V, N = WT.nut;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const ui = () => (WT.ui.food = WT.ui.food || { draft: '', fix: {}, trend: 7 });
  const P = () => WT.db.profile;
  const target = () => Math.max(1, +P().proteinTarget || 150);
  const g = (v) => `≈${N.rp(v)} g`;
  /** Confidence tag: Verified (from a manufacturer page) · Confirmed by you · Estimate */
  const TAGCLS = { verified: 'v', user: 'u', estimated: 'e' };
  const confTag = (c) => `<span class="tag conf ${TAGCLS[c] || 'e'}">${N.statusLabel(c)}</span>`;
  WT.foodConfTag = confTag;
  const macroLine = (t) => `≈${WT.fmtNum(N.rcal(t.cal))} cal · ${N.rg(t.c)} g carbs · ${N.rg(t.f)} g fat`;
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

  /* ───────── Parsing with the user's corrections applied ───────── */
  function currentItems() {
    const st = ui();
    return N.parse(st.draft).map((it) => {
      const fix = st.fix[it.text];
      if (!fix) return it;
      if (fix.generic) return it.fallback || N.parseItem(it.text, { generic: true });
      if (fix.id) return Object.assign(N.resolveAs(it, fix.id, fix.variant), { learn: true });
      if (fix.manual) return manualItem(it, fix.manual.p);
      return it;
    });
  }
  function manualItem(it, p) {
    const qty = it.qty || 1;
    return { id: it.id, text: it.text, name: WT.cap(it.text.replace(/^(\d+(\.\d+)?|an?)\s+/i, '')), qty, unit: 'serving', per: { p: (+p || 0) / qty, cal: null, c: null, f: null }, src: 'manual', note: 'Entered by you', manual: true, conf: 'user', save: true };
  }

  /* ───────── Summary ───────── */
  function summary(day, compact) {
    const t = N.dayTotals(day);
    const tg = target();
    const band = N.band(tg);
    const isToday = day === today();
    const gd = N.guidance(t.p, tg, t.n, isToday);
    const scale = Math.max(tg * 1.25, t.p);
    const pct = (v) => Math.min(100, (v / scale) * 100);
    const track = `<div class="track food-track" role="progressbar" aria-label="Protein toward target" aria-valuemin="0" aria-valuemax="${tg}" aria-valuenow="${N.rp(t.p)}">
        <span class="band" style="left:${pct(band.lo)}%;width:${pct(band.hi) - pct(band.lo)}%"></span><i style="width:${t.n ? pct(t.p) : 0}%"></i><span class="tgt" style="left:${pct(tg)}%"></span></div>`;
    const left = t.n ? (t.p < tg ? `≈${N.rp(tg - t.p)} g to go` : gd.state === 'above' ? 'Above target' : 'Target reached') : '';
    if (compact)
      return `<a class="panel food-mini" href="#/food">
        <div class="row between base"><span class="tnum"><span class="strong">${t.n ? g(t.p) : 'Nothing logged yet'}</span>${t.n ? ` <span class="t3">of ~${tg} g</span>` : ''}</span><span class="footnote t2">${left || 'Log food'}</span></div>
        ${track}</a>`;
    return `<div class="panel food-sum ${gd.state}">
      <div class="row between base"><span class="kicker">Protein${isToday ? ' today' : ''}</span><span class="footnote t3 tnum">Target ~${tg} g · aim ${band.lo}–${band.hi}</span></div>
      <div class="food-big tnum" id="foodTotal">${t.n ? `≈${N.rp(t.p)}<small>g</small>` : '—'}</div>
      ${track}
      <div class="row between mt8"><span class="footnote t2 tnum">${left}</span>${t.n ? `<span class="footnote t3">${plural(t.n, 'item')}</span>` : ''}</div>
      <p class="food-msg">${gd.state === 'reached' || gd.state === 'above' ? I('check', 15) : ''}${esc(gd.msg)}</p>
      ${P().showMacros !== false && t.n ? `<p class="footnote t3 tnum mt8">${macroLine(t)}</p>` : ''}
    </div>`;
  }
  WT.foodHomeSummary = function () {
    if (P().homeProtein === false) return '';
    return `<section class="section"><div class="section-title"><h2>Protein today</h2><a class="btn-link footnote" href="#/food">Log food</a></div>${summary(today(), true)}</section>`;
  };

  /* ───────── Preview of what was typed ───────── */
  function previewHtml(items) {
    if (!items.length) return '';
    const rows = items
      .map((it) => {
        const t = esc(it.text);
        if (it.unknown)
          return `<div class="li pv unk"><div class="grow"><div class="ti">“${t}”</div><div class="su">Not recognized — pick a match, look up the product, or enter the protein yourself.</div>
            <div class="chips mt8">${it.suggestions.map((s) => `<button class="chip sm" data-act="foodPick" data-t="${t}" data-id="${esc(s.id)}">${esc(s.name)}</button>`).join('')}<button class="chip sm" data-act="productAdd" data-t="${t}">${I('search', 13)}Look up</button><button class="chip sm" data-act="foodManual" data-t="${t}">${I('edit', 13)}Enter protein</button></div></div></div>`;
        if (it.ambiguous) return `<div class="li pv unk amb"><div class="grow"><div class="ti">“${t}”</div><div class="su">${ambiguousHelp(it)}</div>${candidateChips(it, 'foodPick', `data-t="${t}"`)}</div></div>`;
        const tot = N.itemTotals(it);
        return `<div class="li pv"><div class="grow"><div class="ti">${esc(it.name)} ${confTag(it.conf)}</div><div class="su">${esc(N.fmtAmount(it.qty, it.unit))}${it.note ? ' · ' + esc(it.note) : ''}${it.lookup ? ` · <button class="btn-link" data-act="productAdd" data-t="${t}">Find the exact product</button>` : ''}</div></div><span class="tnum strong">${g(tot.p)}</span></div>`;
      })
      .join('');
    const known = items.filter((i) => !i.unknown && !i.ambiguous);
    const sum = known.reduce((a, i) => a + N.itemTotals(i).p, 0);
    const unk = items.length - known.length;
    return `<div class="list inset">${rows}</div>
      <div class="row between mt8 pv-foot"><span class="footnote t2 tnum">${known.length ? `Estimated ${g(sum)} protein` : ''}${unk ? `${known.length ? ' · ' : ''}${plural(unk, 'item')} to check` : ''}</span><button class="btn-link footnote" data-act="foodReview">Review &amp; edit</button></div>`;
  }
  /** Which product? — candidates show brand, flavor, serving, protein and how sure we are. */
  function ambiguousHelp(it) {
    if (it.variant) return `${esc(it.brand)} ${esc(it.variant)} isn’t in your library yet. Use a listed product’s values as an estimate, or add it from the label.`;
    return it.candidates.length > 1 ? 'More than one product matches — which one?' : 'Is this the product? (No other matching product is saved yet.)';
  }
  function candidateChips(it, act, attrs) {
    const chips = it.candidates.map((c) => `<button class="chip cand" data-act="${act}" ${attrs} data-id="${esc(c.id)}" ${it.variant ? `data-variant="${esc(it.variant)}"` : ''}>
        <span class="cn">${esc(c.name)}${it.variant ? ` <span class="t3">→ ${esc(it.variant)}</span>` : ''}</span><span class="cs tnum">${esc(c.serving)} · ${N.rp(c.p)} g protein · ${N.statusLabel(it.variant ? 'estimated' : c.status)}</span></button>`);
    if (it.fallback) chips.push(`<button class="chip cand" data-act="${act}" ${attrs} data-id="__generic"><span class="cn">Generic estimate · ${esc(it.fallback.name)}</span><span class="cs tnum">${esc(N.fmtAmount(it.fallback.qty, it.fallback.unit))} · ≈${N.rp(N.itemTotals(it.fallback).p)} g protein · Estimate</span></button>`);
    chips.push(`<button class="chip sm" data-act="productAdd" ${attrs} data-brand="${esc(it.brand || '')}" data-variant="${esc(it.variant || '')}">${I('plus', 13)}${it.variant ? `Add ${esc(it.variant)} from the label` : 'A different product'}</button>`);
    return `<div class="chips mt8 cands">${chips.join('')}</div>`;
  }
  function paintPreview() {
    const host = document.getElementById('foodPreview');
    const items = currentItems();
    if (host) host.innerHTML = previewHtml(items);
    const btn = document.getElementById('foodAddBtn');
    if (btn) btn.disabled = !items.length;
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
    const entries = N.entriesFor(day);
    const favs = WT.db.nutrition.foods.filter((f) => f.fav);
    const recent = N.recent(8);
    const chip = (k, name, p) => `<button class="chip qa" data-act="foodQuick" data-k="${k}" title="Log ${esc(name)}">${I('plus', 13)}<span class="ellipsis">${esc(name)}</span><span class="t3 tnum">${N.rp(p)} g</span></button>`;
    const quick = favs.length || recent.length
      ? `<section class="section food-quick">
          ${favs.length ? `<div class="label">Favorites</div><div class="qa-row">${favs.map((f) => chip('fav:' + f.id, f.qty !== 1 ? `${f.name} ×${N.fmtQty(f.qty)}` : f.name, f.per.p * f.qty)).join('')}</div>` : ''}
          ${recent.length ? `<div class="label ${favs.length ? 'mt16' : ''}">Recent</div><div class="qa-row">${recent.map((e) => chip('rec:' + e.id, `${e.name} · ${N.fmtAmount(e.qty, e.unit)}`, e.per.p * e.qty)).join('')}</div>` : ''}
          <p class="footnote t3 mt8">One tap logs it to ${isToday ? 'today' : dayName(day)}.</p>
        </section>`
      : '';
    const showM = P().showMacros !== false;
    const list = entries.length
      ? `<div class="list inset">${entries
          .map((e) => {
            const x = N.itemTotals(e);
            return `<div class="li food-row"><button class="grow food-main" data-act="foodEdit" data-id="${e.id}"><div class="ti">${esc(e.name)} ${confTag(e.conf)}</div><div class="su tnum">${esc(N.fmtAmount(e.qty, e.unit))}${showM && x.cal ? ` · ≈${WT.fmtNum(N.rcal(x.cal))} cal` : ''}</div></button>
              <span class="tnum strong">${g(x.p)}</span><button class="icon-btn sm" data-act="foodDel" data-id="${e.id}" aria-label="Delete ${esc(e.name)}">${I('trash', 15)}</button></div>`;
          })
          .join('')}</div><p class="footnote t3 mt8">Verified values come from the manufacturer; everything else is an estimate. Tap an item to correct it.</p>`
      : `<p class="t2">${isToday ? 'Nothing logged yet today.' : 'Nothing logged for this day.'}</p>`;

    return `<div class="page">
      <div class="head"><div class="over">${N.parseDay(day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div><h1 class="large-title">Food</h1></div>
      <div class="food-date">
        <a class="icon-btn" href="#/food/${N.addDays(day, -1)}" aria-label="Previous day" data-act="foodDay" data-k="${N.addDays(day, -1)}">${I('chevL', 20)}</a>
        <label class="food-day"><span class="strong">${dayName(day)}</span>${I('calendar', 15)}<input type="date" data-in="foodDate" value="${day}" max="${t}" aria-label="Choose a date"></label>
        <a class="icon-btn ${isToday ? 'off' : ''}" ${isToday ? 'aria-disabled="true"' : `href="#/food/${N.addDays(day, 1)}"`} aria-label="Next day" data-act="foodDay" data-k="${isToday ? '' : N.addDays(day, 1)}">${I('chevR', 20)}</a>
        ${isToday ? '' : `<a class="btn-link footnote" href="#/food" data-act="foodDay" data-k="">Today</a>`}
        <span class="grow"></span>
        <button class="btn btn-plain btn-sm" data-act="foodMine">${I('star', 14)}My foods</button>
      </div>
      ${summary(day)}
      <section class="section food-log">
        <label class="label" for="foodInput">What did you eat${isToday ? '' : ` on ${dayName(day)}`}?</label>
        <div class="food-entry mt8">
          <textarea id="foodInput" class="input" rows="2" data-in="foodText" placeholder="e.g. 2 chicken breasts, a protein shake and 3 eggs" autocomplete="off" autocapitalize="sentences" enterkeyhint="done">${esc(st.draft)}</textarea>
          <button class="btn btn-primary" id="foodAddBtn" data-act="foodAdd" ${N.parse(st.draft).length ? '' : 'disabled'}>Add</button>
        </div>
        <div id="foodPreview" class="mt12" aria-live="polite">${previewHtml(currentItems())}</div>
      </section>
      ${quick}
      <section class="section">
        <div class="section-title"><h2>${isToday ? 'Today' : dayName(day)}</h2>${entries.length ? `<span class="footnote t2 tnum">${g(N.dayTotals(day).p)} protein</span>` : ''}</div>
        ${list}
      </section>
      ${trends()}
    </div>`;
  };

  function trends() {
    const st = ui();
    const days = st.trend === 30 ? 30 : 7;
    const tr = N.trend(days, target());
    const any = WT.db.nutrition.entries.length;
    if (!any) return '';
    const rows = (days === 7 ? tr.days.slice().reverse() : tr.days.filter((d) => d.logged).reverse())
      .map((d) =>
        H.li({ href: `#/food/${d.date}`, title: dayName(d.date), sub: d.logged ? plural(d.n, 'item') : 'Not logged', trail: d.logged ? `<span class="tnum strong">${g(d.p)}</span>` : `<span class="t3">—</span>`, chev: true, cls: d.logged ? '' : 'muted' })
      )
      .join('');
    const unlogged = days - tr.logged;
    return `<section class="section">
      <div class="section-title"><h2>Trend</h2>${H.seg([[7, '7 days'], [30, '30 days']], days, 'foodTrend', '', '')}</div>
      <div class="summary">
        <div class="metric"><div class="v">${tr.avg == null ? '—' : '≈' + N.rp(tr.avg) + '<small>g</small>'}</div><div class="k">Average on logged days</div></div>
        <div class="metric"><div class="v">${tr.logged}<small>/ ${days}</small></div><div class="k">Days logged</div></div>
        <div class="metric"><div class="v">${tr.reached}</div><div class="k">Days near target</div></div>
      </div>
      <div id="foodChart" class="mt16"></div>
      <p class="footnote t3 mt8">${unlogged ? `${plural(unlogged, 'day')} with nothing logged ${unlogged === 1 ? 'is' : 'are'} left out of the average — that usually just means it wasn’t tracked.` : 'Every day in this range has entries.'}</p>
      ${rows ? `<div class="list inset mt16">${rows}</div>` : ''}
    </section>`;
  }

  V.foodAfter = function () {
    const el = document.getElementById('foodChart');
    if (el) {
      const days = ui().trend === 30 ? 30 : 7;
      const tr = N.trend(days, target());
      const t = today();
      WT.barChart(
        el,
        tr.days.map((d, i) => ({
          label: days === 7 ? N.parseDay(d.date).toLocaleDateString(undefined, { weekday: 'narrow' }) : i % 5 === 4 || i === days - 1 ? String(N.parseDay(d.date).getDate()) : '',
          value: d.logged ? Math.round(d.p) : 0,
          highlight: d.date === t,
          tip: d.logged ? `<b>${g(d.p)}</b><br><span class="faint">${dayName(d.date)} · ${plural(d.n, 'item')}</span>` : `<b>Not logged</b><br><span class="faint">${dayName(d.date)}</span>`,
        })),
        { ref: target(), refLabel: 'Target', height: 180 }
      );
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

  /* ───────── Actions: logging ───────── */
  function logItems(items, saveFavs) {
    const day = ui().day || today();
    const added = N.addItems(items, day);
    added.forEach((e, i) => {
      const lib = N.remember(items[i]);
      if (!lib) return;
      e.foodId = 'my:' + lib.id; // later corrections to this entry update the library product
      if (items[i].edited && N.correctLibrary(e)) e.conf = 'user';
    });
    (saveFavs || []).forEach((it) => N.saveFood(it, true));
    WT.save();
    const p = added.reduce((a, e) => a + N.itemTotals(e).p, 0);
    WT.toast(`Logged ${plural(added.length, 'item')} · ${g(p)} protein`, 'good');
    return added;
  }
  A.foodAdd = () => {
    const st = ui();
    const ta = document.getElementById('foodInput');
    if (ta) st.draft = ta.value;
    const items = currentItems();
    if (!items.length) return WT.toast('Type what you ate — e.g. “3 eggs and toast”');
    if (items.some((i) => i.unknown || i.ambiguous)) return openReview(items);
    logItems(items);
    st.draft = '';
    st.fix = {};
    WT.rerender();
    const t2 = document.getElementById('foodInput');
    if (t2 && window.matchMedia('(hover: hover)').matches) t2.focus();
  };
  A.foodPick = (d) => {
    ui().fix[d.t] = d.id === '__generic' ? { generic: true } : { id: d.id, variant: d.variant || '' };
    paintPreview();
  };
  A.foodManual = (d) => {
    const it = N.parse(ui().draft).find((x) => x.text === d.t);
    openReview(currentItems(), it && it.text);
  };
  A.foodReview = () => openReview(currentItems());
  A.foodQuick = (d) => {
    const [kind, id] = d.k.split(':');
    const src = kind === 'fav' ? WT.db.nutrition.foods.find((f) => f.id === id) : N.entry(id);
    if (!src) return;
    N.relog(src, ui().day || today());
    WT.toast(`Logged ${src.name} · ${g(src.per.p * src.qty)}`, 'good');
    WT.rerender();
  };
  A.foodDel = (d) => {
    const e = N.entry(d.id);
    if (!e) return;
    WT.confirm('Delete entry?', `Remove “${esc(e.name)}” (${g(N.itemTotals(e).p)} protein) from ${dayName(e.date)}?`, 'Delete', () => {
      N.deleteEntry(d.id);
      WT.rerender();
      WT.toast('Entry deleted');
    }, true);
  };

  /* ───────── Review sheet (before logging) ───────── */
  const num = (v, k, i, label, step) => `<input class="input tnum num-in" type="number" inputmode="decimal" min="0" step="${step || 1}" data-in="rvNum" data-i="${i}" data-k="${k}" value="${v}" aria-label="${label}">`;
  function openReview(items, focusText) {
    const rv = items.map((it) => Object.assign({}, it, { per: it.per ? Object.assign({}, it.per) : null }));
    WT.ui.review = rv;
    WT.openSheet(() => {
      const unresolved = rv.filter((i) => i.unknown || i.ambiguous).length;
      const body = rv
        .map((it, i) => {
          if (it.ambiguous)
            return `<div class="rv unk"><div class="row between top"><div class="grow"><div class="strong">“${esc(it.text)}”</div><div class="footnote t2">${ambiguousHelp(it)}</div></div><button class="icon-btn sm" data-act="rvRemove" data-i="${i}" aria-label="Remove">${I('x', 15)}</button></div>${candidateChips(it, 'rvPick', `data-i="${i}" data-t="${esc(it.text)}"`)}</div>`;
          if (it.unknown)
            return `<div class="rv unk"><div class="row between top"><div class="grow"><div class="strong">“${esc(it.text)}”</div><div class="footnote t2">Not recognized. Pick a match, or enter your own estimate.</div></div><button class="icon-btn sm" data-act="rvRemove" data-i="${i}" aria-label="Remove">${I('x', 15)}</button></div>
              <div class="chips mt8">${it.suggestions.map((s) => `<button class="chip sm" data-act="rvPick" data-i="${i}" data-id="${esc(s.id)}">${esc(s.name)}</button>`).join('')}<button class="chip sm" data-act="productAdd" data-t="${esc(it.text)}" data-i="${i}">${I('search', 13)}Look up product</button></div>
              <div class="row mt12"><span class="footnote t2 grow">Protein for this item</span>${num('', 'manual', i, 'Protein in grams')}<span class="footnote t3">g</span></div></div>`;
          const tot = N.itemTotals(it);
          return `<div class="rv"><div class="row between top"><input class="input rv-name" data-in="rvName" data-i="${i}" value="${esc(it.name)}" aria-label="Food name"><button class="icon-btn sm" data-act="rvRemove" data-i="${i}" aria-label="Remove">${I('x', 15)}</button></div>
            <div class="footnote t3 mt4">${confTag(it.conf)} ${esc(it.note || '')}</div>
            <div class="row mt12 wrap rv-nums"><div class="row" style="gap:8px">${num(it.qty, 'qty', i, 'Quantity', 0.5)}<span class="footnote t2">${esc(N.unitLabel(it.unit, it.qty))}</span></div><span class="grow"></span>
              <div class="row" style="gap:8px"><span class="footnote t2">Protein</span>${num(N.rp(tot.p), 'p', i, 'Protein in grams')}<span class="footnote t3">g</span></div></div>
            ${it.manual ? `<label class="row mt8 footnote t2"><input type="checkbox" data-in="rvSave" data-i="${i}" ${it.save ? 'checked' : ''}> Save to My foods for next time</label>` : ''}</div>`;
        })
        .join('');
      const p = rv.filter((i) => !i.unknown && !i.ambiguous).reduce((a, i) => a + N.itemTotals(i).p, 0);
      return {
        title: 'Check before logging',
        eyebrow: dayName(ui().day || today()),
        body: rv.length ? `<div class="fstack" style="gap:12px">${body}</div>` : '<p class="t2">Nothing left to log.</p>',
        foot: `<span class="footnote t2 grow tnum" id="rvTotal">${rv.length ? `${g(p)} protein` : ''}</span><button class="btn btn-secondary" data-act="closeSheet">Cancel</button><button class="btn btn-primary" data-act="rvLog" ${unresolved || !rv.length ? 'disabled' : ''}>${unresolved ? `${plural(unresolved, 'item')} to check` : `Log ${plural(rv.length, 'item')}`}</button>`,
        after: (sheet) => {
          if (!focusText) return;
          const idx = rv.findIndex((x) => x.text === focusText && x.unknown);
          const inp = idx >= 0 && sheet.querySelector(`[data-in="rvNum"][data-i="${idx}"][data-k="manual"]`);
          if (inp) inp.focus();
          focusText = null;
        },
      };
    });
  }
  const rvTotal = () => {
    const el = document.getElementById('rvTotal');
    if (el) el.textContent = `${g(WT.ui.review.filter((i) => !i.unknown && !i.ambiguous).reduce((a, i) => a + N.itemTotals(i).p, 0))} protein`;
  };
  A.rvPick = (d) => {
    const rv = WT.ui.review;
    const cur = rv[+d.i];
    if (d.id === '__generic') rv[+d.i] = cur.fallback || N.parseItem(cur.text, { generic: true });
    else rv[+d.i] = Object.assign(N.resolveAs(cur, d.id, d.variant), { learn: true });
    if (d.t) ui().fix[d.t] = d.id === '__generic' ? { generic: true } : { id: d.id, variant: d.variant || '' };
    WT.refreshSheet();
  };
  A.rvRemove = (d) => {
    WT.ui.review.splice(+d.i, 1);
    WT.refreshSheet();
  };
  WT.I.rvName = (el) => {
    const it = WT.ui.review[+el.dataset.i];
    if (it) it.name = el.value;
  };
  WT.I.rvSave = (el) => {
    const it = WT.ui.review[+el.dataset.i];
    if (it) it.save = el.checked;
  };
  WT.I.rvNum = (el, ev) => {
    const rv = WT.ui.review;
    const i = +el.dataset.i, k = el.dataset.k;
    const it = rv[i];
    if (!it) return;
    const v = parseFloat(el.value);
    if (k === 'manual') {
      if (ev.type !== 'change' || !el.isConnected || isNaN(v) || v < 0 || !it.unknown) return;
      rv[i] = manualItem(it, v);
      return WT.refreshSheet();
    }
    if (isNaN(v) || v < 0) return;
    if (k === 'qty') {
      if (!(v > 0)) return;
      it.qty = v;
      if (ev.type === 'change' && el.isConnected) WT.refreshSheet();
      else {
        const pin = el.closest('.rv').querySelector('[data-k="p"]');
        if (pin) pin.value = N.rp(N.itemTotals(it).p);
      }
    } else if (k === 'p') {
      it.per.p = v / (it.qty || 1);
      it.edited = true;
      it.conf = 'user';
    }
    rvTotal();
  };
  A.rvLog = () => {
    const rv = WT.ui.review.filter((i) => !i.unknown && !i.ambiguous);
    if (!rv.length) return;
    rv.forEach((it) => (it.name = String(it.name || '').trim() || WT.cap(it.text)));
    logItems(rv);
    ui().draft = '';
    ui().fix = {};
    WT.closeSheet(true);
    WT.rerender();
  };

  /* ───────── Edit a logged entry ───────── */
  A.foodEdit = (d) => {
    const e = N.entry(d.id);
    if (!e) return;
    const form = { name: e.name, qty: e.qty, unit: e.unit, per: Object.assign({}, e.per), date: e.date };
    const showM = P().showMacros !== false;
    const fnum = (k, label, v, step) => `<label class="fstack" style="gap:6px"><span class="label">${label}</span><input class="input tnum" type="number" inputmode="decimal" min="0" step="${step || 1}" data-in="feNum" data-k="${k}" value="${v == null ? '' : v}"></label>`;
    const libRef = (e.foodId || '').startsWith('my:') ? WT.db.nutrition.foods.find((f) => f.id === e.foodId.slice(3)) : null;
    WT.openSheet(() => {
      const tot = N.itemTotals(form);
      const blank = (k, v) => (form.per[k] == null ? null : v);
      return {
        eyebrow: N.statusLabel(e.conf),
        title: 'Edit entry',
        headExtra: `<button class="icon-btn" data-act="feFav" aria-label="Save to My foods" title="Save to My foods">${I('star', 18)}</button>`,
        body: `<div class="fstack" style="gap:14px">
          <label class="fstack" style="gap:6px"><span class="label">Food</span><input class="input" data-in="feText" data-k="name" value="${esc(form.name)}"></label>
          <div class="fields">
            ${fnum('qty', 'Amount', form.qty, 0.5)}
            <label class="fstack" style="gap:6px"><span class="label">Serving</span><input class="input" data-in="feText" data-k="unit" value="${esc(form.unit)}"></label>
          </div>
          <div class="fields">
            ${fnum('p', 'Protein (g)', N.rp(tot.p))}
            <label class="fstack" style="gap:6px"><span class="label">Date</span><input class="input" type="date" data-in="feText" data-k="date" value="${form.date}" max="${today()}"></label>
          </div>
          ${showM ? `<details class="adv" ${H.keepOpen('feMacros')}><summary>${I('chevD', 14)}Calories, carbs and fat</summary><div class="fields mt12" style="grid-template-columns:repeat(3,minmax(0,1fr))">${fnum('cal', 'Calories', blank('cal', N.rcal(tot.cal)), 10)}${fnum('c', 'Carbs (g)', blank('c', N.rg(tot.c)))}${fnum('f', 'Fat (g)', blank('f', N.rg(tot.f)))}</div></details>` : ''}
          <p class="footnote t3">${confTag(e.conf)} ${esc(e.note || '')}</p>
          ${e.text && e.text.toLowerCase() !== e.name.toLowerCase() ? `<p class="footnote t3">You typed: “${esc(e.text)}”</p>` : ''}
          <p class="footnote t3">Changing the amount scales protein and the other values.${libRef ? ` Correcting the values also updates “${esc(libRef.name)}” in My foods.` : ''}</p>
        </div>`,
        foot: `<button class="btn btn-plain btn-sm" style="color:var(--danger)" data-act="feDelete">Delete</button><span class="grow"></span><button class="btn btn-primary" data-act="feSave">Save</button>`,
      };
    });
    WT.I.feText = (el) => (form[el.dataset.k] = el.value);
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
      N.updateEntry(e.id, { name, qty: WT.round(form.qty, 2), unit: String(form.unit).trim() || 'serving', per: form.per, date, src: edited && e.src === 'db' ? 'manual' : e.src, note: edited ? 'Corrected by you' : e.note, generic: edited ? false : e.generic, conf: edited ? 'user' : e.conf });
      let msg = date !== e.date ? `Moved to ${dayName(date)}` : 'Saved';
      if (edited) {
        // Corrections to a product are kept: update its library entry, or save a branded item as your product
        let lib = N.correctLibrary(N.entry(e.id));
        if (!lib && (e.brand || e.src === 'product')) {
          lib = N.saveFood({ name, brand: e.brand, unit: form.unit, qty: 1, per: form.per, status: 'user', source: { name: 'Corrected by you' } }, false);
          N.updateEntry(e.id, { foodId: 'my:' + lib.id });
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
    A.feFav = () => {
      if (libRef) {
        libRef.fav = true;
        WT.save();
      } else N.saveFood({ name: String(form.name).trim(), brand: e.brand, qty: form.qty, unit: form.unit, per: form.per, status: e.conf }, true);
      WT.toast(`Saved “${form.name}” to My foods`, 'good');
    };
  };

  /* ───────── My foods: your personal library of products and foods ───────── */
  const starSvg = (on) => I('star', 17).replace('fill="none"', on ? 'fill="currentColor"' : 'fill="none"');
  A.foodMine = () => {
    WT.openSheet(() => {
      const foods = WT.db.nutrition.foods.slice().sort((a, b) => (b.fav - a.fav) || String(b.lastUsed || '').localeCompare(String(a.lastUsed || '')) || a.name.localeCompare(b.name));
      return {
        title: 'My foods',
        body: `<p class="t2">Products and foods you’ve logged or saved. They’re recognized when you type them — even by shorthand — and use these values. Starred ones are one-tap favorites.</p>
          ${foods.length ? `<div class="list inset mt16">${foods.map((f) => `<div class="li"><button class="icon-btn sm ${f.fav ? 'on' : ''}" data-act="mfStar" data-id="${f.id}" aria-label="${f.fav ? 'Remove from' : 'Add to'} favorites" aria-pressed="${!!f.fav}">${starSvg(f.fav)}</button><button class="grow food-main" data-act="mfEdit" data-id="${f.id}"><div class="ti">${esc(f.name)} ${confTag(f.status)}</div><div class="su tnum">${esc(f.serving || N.fmtAmount(1, f.unit))} · ${g(f.per.p)} protein per ${esc(f.unit)}${f.aliases.length ? ` · also “${esc(f.aliases.slice(0, 2).join('”, “'))}”` : ''}</div></button><span class="chev">${I('chevR', 16)}</span></div>`).join('')}</div>` : `<p class="footnote t3 mt16">Nothing saved yet. Branded products are saved automatically once you log them.</p>`}`,
        foot: `<button class="btn btn-secondary" data-act="mfEdit" data-id="">${I('edit', 15)}Enter from label</button><span class="grow"></span><button class="btn btn-primary" data-act="productAdd">${I('search', 15)}Find product</button>`,
      };
    });
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
      p: v(per.p), cal: v(per.cal), c: v(per.c), f: v(per.f), aliases: (src.aliases || []).join(', '), qty: src.qty || 1, fav: f ? !!f.fav : !!opts.fav,
    };
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
      };
      if (f) f.aliases = []; // aliases come from the form as edited
      if (data.productId && !f && WT.db.nutrition.foods.some((x) => x.productId === data.productId)) delete data.productId;
      const saved = N.saveFood(data, !!form.fav);
      WT.closeSheet(true);
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
