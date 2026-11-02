/* Views: Food — a quick, forgiving protein diary. Parsing and storage live in nutrition.js. */
(function () {
  const WT = globalThis.WT;
  const I = WT.icon, esc = WT.esc, H = WT.h, A = WT.A, V = WT.V, N = WT.nut;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const ui = () => (WT.ui.food = WT.ui.food || { draft: '', fix: {}, trend: 7 });
  const P = () => WT.db.profile;
  const target = () => Math.max(1, +P().proteinTarget || 150);
  const g = (v) => `≈${N.rp(v)} g`;
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
      if (fix.id) return N.resolveAs(it, fix.id);
      if (fix.manual) return manualItem(it, fix.manual.p);
      return it;
    });
  }
  function manualItem(it, p) {
    const qty = it.qty || 1;
    return { id: it.id, text: it.text, name: WT.cap(it.text.replace(/^(\d+(\.\d+)?|an?)\s+/i, '')), qty, unit: 'serving', per: { p: (+p || 0) / qty, cal: 0, c: 0, f: 0 }, src: 'manual', note: 'Your estimate', manual: true };
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
        if (it.unknown)
          return `<div class="li pv unk"><div class="grow"><div class="ti">“${esc(it.text)}”</div><div class="su">Not recognized — pick a match or enter the protein yourself.</div>
            <div class="chips mt8">${it.suggestions.map((s) => `<button class="chip sm" data-act="foodPick" data-t="${esc(it.text)}" data-id="${esc(s.id)}">${esc(s.name)}</button>`).join('')}<button class="chip sm" data-act="foodManual" data-t="${esc(it.text)}">${I('edit', 13)}Enter protein</button></div></div></div>`;
        const tot = N.itemTotals(it);
        return `<div class="li pv"><div class="grow"><div class="ti">${esc(it.name)}${it.generic ? ' <span class="tag">Generic</span>' : ''}</div><div class="su">${esc(N.fmtAmount(it.qty, it.unit))}${it.note ? ' · ' + esc(it.note) : ''}</div></div><span class="tnum strong">${g(tot.p)}</span></div>`;
      })
      .join('');
    const known = items.filter((i) => !i.unknown);
    const sum = known.reduce((a, i) => a + N.itemTotals(i).p, 0);
    const unk = items.length - known.length;
    return `<div class="list inset">${rows}</div>
      <div class="row between mt8 pv-foot"><span class="footnote t2 tnum">${known.length ? `Estimated ${g(sum)} protein` : ''}${unk ? `${known.length ? ' · ' : ''}${plural(unk, 'item')} to check` : ''}</span><button class="btn-link footnote" data-act="foodReview">Review &amp; edit</button></div>`;
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
            return `<div class="li food-row"><button class="grow food-main" data-act="foodEdit" data-id="${e.id}"><div class="ti">${esc(e.name)}${e.generic ? ' <span class="tag">Generic</span>' : ''}${e.src === 'manual' ? ' <span class="tag">Your estimate</span>' : ''}</div><div class="su tnum">${esc(N.fmtAmount(e.qty, e.unit))}${showM && x.cal ? ` · ≈${WT.fmtNum(N.rcal(x.cal))} cal` : ''}</div></button>
              <span class="tnum strong">${g(x.p)}</span><button class="icon-btn sm" data-act="foodDel" data-id="${e.id}" aria-label="Delete ${esc(e.name)}">${I('trash', 15)}</button></div>`;
          })
          .join('')}</div><p class="footnote t3 mt8">All values are estimates. Tap an item to correct it.</p>`
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
    (saveFavs || []).forEach((it) => N.saveFood(it, true));
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
    if (items.some((i) => i.unknown)) return openReview(items);
    logItems(items);
    st.draft = '';
    st.fix = {};
    WT.rerender();
    const t2 = document.getElementById('foodInput');
    if (t2 && window.matchMedia('(hover: hover)').matches) t2.focus();
  };
  A.foodPick = (d) => {
    ui().fix[d.t] = { id: d.id };
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
      const unresolved = rv.filter((i) => i.unknown).length;
      const body = rv
        .map((it, i) => {
          if (it.unknown)
            return `<div class="rv unk"><div class="row between top"><div class="grow"><div class="strong">“${esc(it.text)}”</div><div class="footnote t2">Not recognized. Pick a match, or enter your own estimate.</div></div><button class="icon-btn sm" data-act="rvRemove" data-i="${i}" aria-label="Remove">${I('x', 15)}</button></div>
              ${it.suggestions.length ? `<div class="chips mt8">${it.suggestions.map((s) => `<button class="chip sm" data-act="rvPick" data-i="${i}" data-id="${esc(s.id)}">${esc(s.name)}</button>`).join('')}</div>` : ''}
              <div class="row mt12"><span class="footnote t2 grow">Protein for this item</span>${num('', 'manual', i, 'Protein in grams')}<span class="footnote t3">g</span></div></div>`;
          const tot = N.itemTotals(it);
          return `<div class="rv"><div class="row between top"><input class="input rv-name" data-in="rvName" data-i="${i}" value="${esc(it.name)}" aria-label="Food name"><button class="icon-btn sm" data-act="rvRemove" data-i="${i}" aria-label="Remove">${I('x', 15)}</button></div>
            ${it.note ? `<div class="footnote t3 mt4">${it.generic ? '<span class="tag">Generic</span> ' : ''}${esc(it.note)}</div>` : ''}
            <div class="row mt12 wrap rv-nums"><div class="row" style="gap:8px">${num(it.qty, 'qty', i, 'Quantity', 0.5)}<span class="footnote t2">${esc(N.unitLabel(it.unit, it.qty))}</span></div><span class="grow"></span>
              <div class="row" style="gap:8px"><span class="footnote t2">Protein</span>${num(N.rp(tot.p), 'p', i, 'Protein in grams')}<span class="footnote t3">g</span></div></div>
            ${it.manual ? `<label class="row mt8 footnote t2"><input type="checkbox" data-in="rvSave" data-i="${i}" ${it.save ? 'checked' : ''}> Save to My foods for next time</label>` : ''}</div>`;
        })
        .join('');
      const p = rv.filter((i) => !i.unknown).reduce((a, i) => a + N.itemTotals(i).p, 0);
      return {
        title: 'Check before logging',
        eyebrow: `${dayName(ui().day || today())} · estimates`,
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
    if (el) el.textContent = `${g(WT.ui.review.filter((i) => !i.unknown).reduce((a, i) => a + N.itemTotals(i).p, 0))} protein`;
  };
  A.rvPick = (d) => {
    const rv = WT.ui.review;
    rv[+d.i] = N.resolveAs(rv[+d.i], d.id);
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
    }
    rvTotal();
  };
  A.rvLog = () => {
    const rv = WT.ui.review.filter((i) => !i.unknown);
    if (!rv.length) return;
    rv.forEach((it) => (it.name = String(it.name || '').trim() || WT.cap(it.text)));
    logItems(rv, rv.filter((i) => i.save));
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
    const fnum = (k, label, v, step) => `<label class="fstack" style="gap:6px"><span class="label">${label}</span><input class="input tnum" type="number" inputmode="decimal" min="0" step="${step || 1}" data-in="feNum" data-k="${k}" value="${v}"></label>`;
    WT.openSheet(() => {
      const tot = N.itemTotals(form);
      return {
        eyebrow: 'Estimate',
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
          ${showM ? `<details class="adv" ${H.keepOpen('feMacros')}><summary>${I('chevD', 14)}Calories, carbs and fat</summary><div class="fields mt12" style="grid-template-columns:repeat(3,minmax(0,1fr))">${fnum('cal', 'Calories', N.rcal(tot.cal), 10)}${fnum('c', 'Carbs (g)', N.rg(tot.c))}${fnum('f', 'Fat (g)', N.rg(tot.f))}</div></details>` : ''}
          ${e.note ? `<p class="footnote t3">${esc(e.note)}</p>` : ''}
          ${e.text && e.text.toLowerCase() !== e.name.toLowerCase() ? `<p class="footnote t3">You typed: “${esc(e.text)}”</p>` : ''}
          <p class="footnote t3">Changing the amount scales protein and the other values.</p>
        </div>`,
        foot: `<button class="btn btn-plain btn-sm" style="color:var(--danger)" data-act="feDelete">Delete</button><span class="grow"></span><button class="btn btn-primary" data-act="feSave">Save</button>`,
      };
    });
    WT.I.feText = (el) => (form[el.dataset.k] = el.value);
    WT.I.feNum = (el, ev) => {
      const v = parseFloat(el.value);
      if (isNaN(v) || v < 0) return;
      const k = el.dataset.k;
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
      N.updateEntry(e.id, { name, qty: WT.round(form.qty, 2), unit: String(form.unit).trim() || 'serving', per: form.per, date, src: form.edited ? 'manual' : e.src, note: form.edited ? 'Corrected by you' : e.note, generic: form.edited ? false : e.generic });
      WT.closeSheet();
      WT.rerender();
      WT.toast(date !== e.date ? `Moved to ${dayName(date)}` : 'Saved');
    };
    A.feDelete = () =>
      WT.confirm('Delete entry?', `Remove “${esc(e.name)}”?`, 'Delete', () => {
        N.deleteEntry(e.id);
        WT.closeSheet(true);
        WT.rerender();
        WT.toast('Entry deleted');
      }, true);
    A.feFav = () => {
      N.saveFood({ name: String(form.name).trim(), qty: form.qty, unit: form.unit, per: form.per }, true);
      WT.toast(`Saved “${form.name}” to My foods`, 'good');
    };
  };

  /* ───────── My foods (custom foods + favorites) ───────── */
  A.foodMine = () => {
    WT.openSheet(() => {
      const foods = WT.db.nutrition.foods.slice().sort((a, b) => (b.fav - a.fav) || a.name.localeCompare(b.name));
      const starSvg = (on) => I('star', 17).replace('fill="none"', on ? 'fill="currentColor"' : 'fill="none"');
      return {
        title: 'My foods',
        body: `<p class="t2">Foods you save are recognized when you type them and use your numbers. Starred ones appear as one-tap favorites.</p>
          ${foods.length ? `<div class="list inset mt16">${foods.map((f) => `<div class="li"><button class="icon-btn sm ${f.fav ? 'on' : ''}" data-act="mfStar" data-id="${f.id}" aria-label="${f.fav ? 'Remove from' : 'Add to'} favorites" aria-pressed="${!!f.fav}">${starSvg(f.fav)}</button><button class="grow food-main" data-act="mfEdit" data-id="${f.id}"><div class="ti">${esc(f.name)}</div><div class="su tnum">${esc(N.fmtAmount(f.qty, f.unit))} · ${g(f.per.p * f.qty)} protein</div></button><span class="chev">${I('chevR', 16)}</span></div>`).join('')}</div>` : `<p class="footnote t3 mt16">Nothing saved yet. Tap the star on any logged entry, or add one here.</p>`}`,
        foot: `<span class="grow"></span><button class="btn btn-primary" data-act="mfEdit" data-id="">${I('plus', 16)}New food</button>`,
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
  A.mfEdit = (d) => {
    const f = d.id ? WT.db.nutrition.foods.find((x) => x.id === d.id) : null;
    const form = f ? { name: f.name, qty: f.qty, unit: f.unit, p: N.rp(f.per.p), cal: N.rcal(f.per.cal), c: N.rg(f.per.c), f: N.rg(f.per.f), fav: !!f.fav } : { name: '', qty: 1, unit: 'serving', p: '', cal: '', c: '', f: '', fav: true };
    const fld = (k, label, type, extra) => `<label class="fstack" style="gap:6px"><span class="label">${label}</span><input class="input ${type === 'number' ? 'tnum' : ''}" ${type === 'number' ? 'type="number" inputmode="decimal" min="0"' : ''} data-in="mf" data-k="${k}" value="${esc(form[k])}" ${extra || ''}></label>`;
    WT.openSheet(() => ({
      title: f ? 'Edit food' : 'New food',
      body: `<div class="fstack" style="gap:14px">
        ${fld('name', 'Name', 'text', 'placeholder="e.g. Snickerdoodle protein shake"')}
        <div class="fields">${fld('unit', 'Serving', 'text', 'placeholder="shake, bowl, serving…"')}${fld('p', 'Protein per serving (g)', 'number')}</div>
        ${P().showMacros !== false ? `<div class="fields" style="grid-template-columns:repeat(3,minmax(0,1fr))">${fld('cal', 'Calories', 'number')}${fld('c', 'Carbs (g)', 'number')}${fld('f', 'Fat (g)', 'number')}</div><p class="footnote t3">Calories, carbs and fat are optional.</p>` : ''}
        <div class="fields">${fld('qty', 'Usual amount (servings)', 'number', 'step="0.5"')}<div></div></div>
        ${H.li({ title: 'Favorite', sub: 'Show as a one-tap button', trail: H.toggle(form.fav, 'mfFav') })}
      </div>`,
      foot: `${f ? `<button class="btn btn-plain btn-sm" style="color:var(--danger)" data-act="mfDelete">Delete</button>` : ''}<span class="grow"></span><button class="btn btn-primary" data-act="mfSave">Save</button>`,
    }));
    WT.I.mf = (el) => (form[el.dataset.k] = el.value);
    A.mfFav = () => {
      form.fav = !form.fav;
      WT.refreshSheet();
    };
    A.mfSave = () => {
      const name = String(form.name).trim();
      if (!name) return WT.toast('Give it a name', 'error');
      const p = parseFloat(form.p);
      if (isNaN(p) || p < 0) return WT.toast('Enter the protein per serving', 'error');
      const data = { name, qty: Math.max(0.25, parseFloat(form.qty) || 1), unit: String(form.unit).trim() || 'serving', per: { p, cal: +form.cal || 0, c: +form.c || 0, f: +form.f || 0 }, fav: !!form.fav };
      const clash = WT.db.nutrition.foods.find((x) => x.name.toLowerCase() === name.toLowerCase() && x !== f);
      if (clash) return WT.toast('You already have a food with that name', 'error');
      if (f) Object.assign(f, data);
      else WT.db.nutrition.foods.push(Object.assign({ id: WT.uid(), createdAt: new Date().toISOString() }, data));
      WT.save();
      WT.closeSheet();
      WT.refreshSheet();
      if (WT.ui.route === 'food') WT.rerender();
      WT.toast('Saved', 'good');
    };
    A.mfDelete = () =>
      WT.confirm('Delete food?', `“${esc(f.name)}” will no longer be recognized or shown as a favorite. Entries you already logged are kept.`, 'Delete', () => {
        N.deleteFood(f.id);
        WT.closeSheet();
        WT.refreshSheet();
        if (WT.ui.route === 'food') WT.rerender();
      }, true);
  };
})();
