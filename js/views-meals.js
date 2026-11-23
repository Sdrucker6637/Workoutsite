/* Views: Meal ideas (your kitchen → recipes) and Achievements. Logic lives in ingredients.js / meals.js / achievements.js. */
(function () {
  const WT = globalThis.WT;
  const I = WT.icon, esc = WT.esc, H = WT.h, A = WT.A, V = WT.V, M = WT.meals, ING = WT.ING;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const ui = () => (WT.ui.meals = WT.ui.meals || { tab: 'ideas', mode: 'select', q: '', ideas: null, reason: null, hints: [], shown: [] });
  const st = () => M.store();
  const STATUS = { estimated: ['Estimate', 'e'], user: ['Your values', 'u'], verified: ['Verified', 'v'] };
  const statusTag = (s) => `<span class="tag conf ${(STATUS[s] || STATUS.estimated)[1]}">${(STATUS[s] || STATUS.estimated)[0]}</span>`;
  const r0 = (v) => (v == null || v === '' ? '—' : Math.round(+v));
  const cal10 = (v) => (v == null ? '—' : +v < 100 ? Math.round(+v / 5) * 5 : Math.round(+v / 10) * 10);
  const servingText = (ing) => `${M.fmtAmount(ing.serving.n, ing.serving.unit)}${ing.serving.state && ing.serving.state !== 'sold' ? ' ' + (ing.serving.state === 'dry' ? 'dry' : ing.serving.state) : ''}`;
  const macroLine = (m) => `≈${cal10(m.cal)} cal · ${r0(m.p)} g protein · ${r0(m.c)} g carbs · ${r0(m.f)} g fat`;
  const dn = (n) => (n ? n[0].toUpperCase() + n.slice(1) : n); // stand-alone display: "turkey kielbasa" → "Turkey kielbasa"
  const STYLES = { quick: 'Quick & easy', protein: 'High protein', adventurous: 'Adventurous', cleanup: 'Minimal cleanup', onepan: 'One-pan', air: 'Air fryer' };

  /* ═════════════════════ MEAL IDEAS ═════════════════════ */
  function chip(ing) {
    const s = st();
    const sel = s.selected.includes(ing.id);
    const out = M.unavailable(ing.id);
    const why = M.blockReason(ing);
    const off = !!why;
    const mode = ui().mode;
    const act = mode === 'stock' ? 'mlStock' : 'mlPick';
    const disabled = mode === 'select' && off && !out;
    return `<button class="chip ing ${sel && !off ? 'on' : ''} ${off ? 'out' : ''}" data-act="${act}" data-id="${esc(ing.id)}" aria-pressed="${mode === 'stock' ? !out : sel}" ${why ? `title="${esc(why)}"` : ''} ${disabled ? 'disabled' : ''}>${s.staples.includes(ing.id) ? `<span class="pin" aria-label="Staple">${I('star', 11).replace('fill="none"', 'fill="currentColor"')}</span>` : ''}${esc(dn(ing.name))}${out ? '<span class="sr"> (out of stock)</span>' : ''}</button>`;
  }
  function pickerHtml() {
    const u = ui();
    const found = M.search(u.q);
    if (found) {
      const add = M.addable(u.q);
      const exact = found.concat(add).some((x) => x.name.toLowerCase() === u.q.trim().toLowerCase());
      return `${found.length ? `<div class="chips mt12">${found.map(chip).join('')}</div>` : `<p class="footnote t3 mt12">Not in your kitchen yet.</p>`}
        ${add.length ? `<div class="label mt16">Add to your kitchen</div><div class="list inset mt8">${add.map((x) => H.li({ act: x.type === 'db' ? 'mlAddDb' : 'mlAddDiary', attrs: `data-id="${esc(x.id)}"`, title: esc(x.name) + (x.type === 'diary' ? ' <span class="t3">· from My foods</span>' : ''), sub: `${x.serving ? esc(M.fmtAmount(x.serving.n, x.serving.unit)) + (x.serving.state !== 'sold' && x.serving.state ? ' ' + x.serving.state : '') + ' · ' : x.label ? esc(x.label) + ' · ' : ''}${macroLine(x.macros)}`, trail: `<span class="accent">${I('plus', 17)}</span>` })).join('')}</div>` : ''}
        ${u.q.trim() && !exact ? `<button class="btn btn-secondary btn-sm mt12" data-act="mlAddIng" data-name="${esc(u.q.trim())}">${I('plus', 14)}Add “${esc(u.q.trim())}”</button>` : ''}`;
    }
    return Object.entries(M.CATS)
      .map(([k, name]) => {
        const list = M.sorted(k);
        if (!list.length && !['protein', 'carb', 'veg'].includes(k)) return `<div class="ing-group"><div class="label">${name}</div><div class="chips"><button class="chip ghost sm" data-act="mlAddIng" data-cat="${k}">${I('plus', 13)}Add</button></div></div>`;
        return `<div class="ing-group"><div class="label">${name}</div><div class="chips">${list.map(chip).join('')}<button class="chip ghost" data-act="mlAddIng" data-cat="${k}" aria-label="Add to ${name.toLowerCase()}">${I('plus', 13)}Add</button></div></div>`;
      })
      .join('');
  }
  function selectedBar() {
    const sel = st().selected.map(M.get).filter((x) => x && M.usable(x));
    return `<div class="sel-bar" id="mlSelBar">${sel.length ? `<span class="footnote t2">${plural(sel.length, 'ingredient')}: ${esc(sel.map((x) => dn(x.name)).join(', '))}</span><button class="btn-link footnote" data-act="mlClear">Clear</button>` : `<span class="footnote t3">Tap what you have. No amounts needed — nutrition is estimated for you.</span>`}</div>`;
  }
  const recipeMeta = (r) => `${M.totalTime(r)} min · ≈${r.macros.p} g protein · ≈${r.macros.cal} cal · ${esc(r.method)}`;
  function recipeCard(r, i, ctx) {
    const fav = M.isFavorite(r.key);
    const mine = (r.lines || []).filter((l) => !l.pantry).map((l) => l.name);
    return `<div class="meal-card">
      <button class="grow meal-main" data-act="mlOpen" data-ctx="${ctx}" data-i="${i}">
        <div class="ti">${esc(r.name)}</div>
        ${r.description ? `<div class="su desc">${esc(r.description)}</div>` : ''}
        <div class="su tnum">${recipeMeta(r)}</div>
        <div class="su t3">Uses ${esc(mine.join(', ').toLowerCase())}${r.unused && r.unused.length ? ` · not used: ${esc(r.unused.join(', ').toLowerCase())}` : ''}</div>
      </button>
      <button class="icon-btn sm star ${fav ? 'on' : ''}" data-act="mlFav" data-ctx="${ctx}" data-i="${i}" aria-pressed="${fav}" aria-label="${fav ? 'Remove from saved' : 'Save recipe'}">${I('star', 17).replace('fill="none"', fav ? 'fill="currentColor"' : 'fill="none"')}</button>
    </div>`;
  }
  function styleHtml() {
    const pr = st().prefs;
    const on = (pr.styles || []).map((k) => STYLES[k]).filter(Boolean);
    const meal = { any: 'Any meal', breakfast: 'Breakfast', main: 'Lunch & dinner' }[pr.mealType || 'any'];
    return `<details class="adv mt16" ${H.keepOpen('mealStyle')}><summary>${I('chevR', 14)}Meal &amp; style <span class="t3 footnote" style="margin-left:6px">${esc([meal].concat(on).join(' · '))}</span></summary>
      <div class="adv-body">
        <div class="adv-block"><span class="label">Meal</span>${H.seg([['any', 'Any'], ['breakfast', 'Breakfast'], ['main', 'Lunch & dinner']], pr.mealType || 'any', 'mlMeal', '', 'full')}</div>
        <div class="adv-block"><span class="label">Style</span>${H.chipGroup(STYLES, pr.styles || [], 'mlStyle', 'sm')}</div>
      </div></details>`;
  }
  function prefsHtml() {
    const pr = st().prefs;
    const dis = pr.disliked.map(M.get).filter(Boolean);
    return `<details class="adv mt32" ${H.keepOpen('mealPrefs')}><summary>${I('chevR', 14)}Preferences</summary>
      <div class="adv-body">
        <div class="adv-block"><span class="label">Dietary needs</span>${H.chipGroup(Object.fromEntries(Object.entries(M.DIETS).map(([k, v]) => [k, v.name])), pr.diets, 'mlDiet', 'sm')}</div>
        <div class="adv-block"><span class="label">Avoid</span>
          <div class="chips">${dis.map((x) => `<button class="chip sm on" data-act="mlDislike" data-id="${esc(x.id)}" aria-label="Stop avoiding ${esc(x.name)}">${esc(x.name)} ${I('x', 12)}</button>`).join('')}${pr.dislikedText.map((w, k) => `<button class="chip sm on" data-act="mlDislikeText" data-k="${k}" aria-label="Stop avoiding ${esc(w)}">${esc(w)} ${I('x', 12)}</button>`).join('')}</div>
          <div class="row mt8" style="gap:8px"><input class="input" id="mlDislikeIn" placeholder="e.g. corn, mushrooms, honey" autocomplete="off" aria-label="Add something to avoid"><button class="btn btn-secondary" data-act="mlDislikeAdd">Add</button></div>
          <p class="footnote t3 mt8">Avoided ingredients are never used — including pantry additions. Cornstarch is replaced with potato starch, soy sauce with tamari, when you avoid them.</p></div>
        <div class="adv-block">
          <div class="row between"><div><div class="strong" style="font-size:14.5px">Prioritize protein</div><div class="footnote t3">Favor protein-rich ideas</div></div>${H.toggle(pr.protein !== false, 'mlPrefToggle', 'data-k="protein"')}</div>
          <div class="row between mt16"><div><div class="strong" style="font-size:14.5px">Everyday ingredients</div><div class="footnote t3">Prefer pantry items most groceries carry</div></div>${H.toggle(pr.practical !== false, 'mlPrefToggle', 'data-k="practical"')}</div>
          <div class="row between mt16"><div><div class="strong" style="font-size:14.5px">I have an air fryer</div><div class="footnote t3">Allows air-fryer recipes</div></div>${H.toggle(pr.airFryer !== false, 'mlPrefToggle', 'data-k="airFryer"')}</div>
          <div class="row between mt16"><span class="strong" style="font-size:14.5px">Servings</span>${H.stepper(pr.servings || 2, 'mlServ', 'servings', 1, 6)}</div>
          <div class="row between mt16 wrap" style="gap:10px"><span class="strong" style="font-size:14.5px">Time limit</span>${H.seg([[0, 'Any'], [20, '20'], [30, '30'], [45, '45 min']], pr.maxTime || 0, 'mlTime')}</div>
        </div>
        <div class="adv-block"><button class="row between" style="width:100%" data-act="mlManage"><span><span class="strong" style="font-size:14.5px">Your kitchen</span><span class="footnote t3" style="display:block">Serving sizes, nutrition, staples and your own ingredients</span></span><span class="t3">${I('chevR', 16)}</span></button></div>
      </div></details>`;
  }

  V.meals = function () {
    const u = ui();
    const s = st();
    const favN = s.favorites.length;
    const seg = H.seg([['ideas', 'Ideas'], ['saved', `Saved${favN ? ' · ' + favN : ''}`]], u.tab, 'mlTab', '', 'full');
    const head = `<div class="head head-row"><div><h1 class="large-title">Meal ideas</h1><p class="sub">${u.tab === 'saved' ? 'Recipes you’ve saved.' : 'Pick what you have — get specific, protein-forward recipes with nutrition worked out.'}</p></div><a class="btn btn-plain btn-sm" href="#/food">${I('food', 15)}Food log</a></div>`;
    if (u.tab === 'saved') {
      const list = s.favorites.map(M.normalizeRecipe);
      return `<div class="page">${head}${seg}
        <section class="section">${favN ? `<div class="meal-list">${list.map((r, i) => recipeCard(r, i, 'saved')).join('')}</div>` : H.empty('Nothing saved yet', 'Tap the star on a meal idea to keep it here.', `<button class="btn btn-secondary" data-act="mlTab" data-v="ideas">Find ideas</button>`)}</section>
      </div>`;
    }
    const usable = s.selected.map(M.get).filter((x) => x && M.usable(x));
    const results = u.ideas
      ? `<section class="section" id="mlResults" style="scroll-margin-top:72px">
          <div class="section-title"><h2>Ideas</h2>${u.ideas.length ? `<button class="btn-link footnote" data-act="mlMore">${I('refresh', 13)} Different ideas</button>` : ''}</div>
          ${(u.hints || []).length ? `<div class="callout mb">${I('info', 15)}<span>${esc(u.hints.join(' '))}</span></div>` : ''}
          ${u.ideas.length ? `<div class="meal-list fade-in mt12">${u.ideas.map((r, i) => recipeCard(r, i, 'ideas')).join('')}</div><p class="footnote t3 mt12">For ${plural(s.prefs.servings || 2, 'serving')}. Nutrition per serving is calculated from each ingredient’s amount and is an estimate unless every ingredient uses your own values.</p>` : `<p class="t2">${esc(u.reason || 'No ideas for that combination.')}</p>`}
        </section>`
      : '';
    return `<div class="page">${head}${seg}
      <div class="search mt24"><span>${I('search', 16)}</span><input class="input" id="mlSearch" placeholder="Search or add an ingredient" value="${esc(u.q)}" data-in="mlSearch" autocomplete="off" aria-label="Search or add an ingredient"></div>
      <div class="row between mt16 wrap" style="gap:10px">${H.seg([['select', 'I have'], ['stock', 'Ran out']], u.mode, 'mlMode')}<button class="btn-link footnote" data-act="mlManage">Edit kitchen</button></div>
      ${u.mode === 'stock' ? `<p class="footnote t3 mt8">Tap anything you’ve run out of. Tap again when it’s back.</p>` : ''}
      <div id="mlPicker" class="mt8">${pickerHtml()}</div>
      ${selectedBar()}
      ${styleHtml()}
      <button class="btn btn-primary btn-lg btn-block mt16" data-act="mlGenerate" ${usable.length ? '' : 'disabled'}>${I('sparkles', 18)}${u.ideas ? 'Suggest again' : 'Suggest meals'}</button>
      ${results}
      ${prefsHtml()}
      <p class="footnote t3 mt16">Recipes are composed on this device from cooking methods, flavor profiles and your ingredients, and nutrition comes from a built-in ingredient database — no recipe service, account or connection needed.</p>
    </div>`;
  };
  const repaintPicker = () => {
    const el = document.getElementById('mlPicker');
    if (el) el.innerHTML = pickerHtml();
    const bar = document.getElementById('mlSelBar');
    if (bar) bar.outerHTML = selectedBar();
    const btn = document.querySelector('[data-act="mlGenerate"]');
    if (btn) btn.disabled = !st().selected.map(M.get).some((x) => x && M.usable(x));
  };
  WT.I.mlSearch = (el, ev) => {
    if (ev.type !== 'input') return;
    ui().q = el.value;
    repaintPicker();
  };
  A.mlTab = (d) => {
    ui().tab = d.v;
    WT.rerender();
  };
  A.mlMode = (d) => {
    ui().mode = d.v;
    WT.rerender();
  };
  A.mlPick = (d) => {
    if (M.unavailable(d.id)) M.toggleUnavailable(d.id); // picking a run-out item means it's back
    M.toggleSelect(d.id);
    repaintPicker();
  };
  A.mlStock = (d) => {
    M.toggleUnavailable(d.id);
    const ing = M.get(d.id);
    if (ing) WT.toast(M.unavailable(d.id) ? `${ing.name}: marked as run out` : `${ing.name}: back in stock`);
    repaintPicker();
  };
  A.mlAddDb = (d) => {
    const ing = M.addToKitchen(d.id);
    ui().q = '';
    WT.rerender();
    if (ing) WT.toast(`${ing.name} added to your kitchen`, 'good');
  };
  A.mlAddDiary = (d) => {
    const ing = M.importDiaryFood(d.id);
    ui().q = '';
    WT.rerender();
    if (ing) WT.toast(`${ing.name} added from My foods`, 'good');
  };
  A.mlClear = () => {
    st().selected = [];
    WT.save();
    ui().ideas = null;
    WT.rerender();
  };
  A.mlMeal = (d) => {
    st().prefs.mealType = d.v;
    WT.save();
    WT.rerender();
  };
  A.mlStyle = (d) => {
    const pr = st().prefs;
    pr.styles = (pr.styles || []).includes(d.k) ? pr.styles.filter((x) => x !== d.k) : (pr.styles || []).concat(d.k);
    WT.save();
    WT.rerender();
  };
  function run(exclude, avoid) {
    const u = ui();
    const r = M.generate(Object.assign({ count: 4, exclude }, avoid || {}));
    u.ideas = r.ideas;
    u.reason = r.reason;
    u.hints = r.hints || [];
    u.shown = (exclude || []).concat(r.ideas.map((x) => x.key));
    WT.rerender();
    requestAnimationFrame(() => {
      const el = document.getElementById('mlResults');
      if (el && el.getBoundingClientRect().top > innerHeight * 0.7) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  A.mlGenerate = () => run([]);
  A.mlMore = () => {
    const u = ui();
    const before = u.shown.slice();
    const cur = u.ideas || [];
    run(before, { avoidFormats: cur.map((x) => x.format), avoidFlavors: cur.map((x) => x.flavor) });
    if (!u.ideas.length && before.length) {
      run([]);
      WT.toast('That’s every idea for this selection — starting over');
    }
  };
  const recipeOf = (d) => (d.ctx === 'saved' ? M.normalizeRecipe(st().favorites[+d.i]) : (ui().ideas || [])[+d.i]);
  A.mlFav = (d) => {
    const r = d.ctx === 'saved' ? st().favorites[+d.i] : recipeOf(d);
    if (!r) return;
    const on = M.toggleFavorite(r);
    WT.toast(on ? 'Saved' : 'Removed from saved');
    WT.rerender();
    WT.refreshSheet();
  };

  /* ───────── Recipe ───────── */
  A.mlOpen = (d) => {
    const base = recipeOf(d);
    if (!base) return;
    const view = { r: base, ctx: d.ctx, i: +d.i };
    WT.openSheet(() => {
      const r = view.r;
      const fav = M.isFavorite(r.key);
      const m = r.legacy ? r.macros : M.recipeMacros(r);
      const mine = (r.lines || []).filter((l) => !l.pantry);
      const pantry = (r.lines || []).filter((l) => l.pantry);
      const lineRow = (l) => {
        const ing = !l.legacy && !l.pantry ? M.get(l.id) : null;
        return H.li({
          tag: ing ? 'button' : 'div', act: ing ? 'mlIngInfo' : '', attrs: ing ? `data-id="${esc(l.id)}"` : '',
          title: esc(dn(l.name)) + (ing && ing.label ? ` <span class="t3">· ${esc(ing.label)}</span>` : ''),
          sub: ing ? `${ing.status === 'estimated' ? 'Estimated' : ing.status === 'user' ? 'Your values' : 'Verified'} · ≈${r0(l.q * (ing.macros.p || 0))} g protein per serving` : '',
          trail: `<span class="tnum t2" style="text-align:right">${esc(M.lineAmount(l, r.servings))}</span>`,
        });
      };
      const breakdown = !r.legacy
        ? `<details class="adv mt12" ${H.keepOpen('mlBreak')}><summary>${I('chevR', 13)}How this is calculated</summary>
            <table class="table mt8 tnum"><thead><tr><th style="text-align:left">Per serving</th><th>Cal</th><th>Protein</th><th>Carbs</th><th>Fat</th></tr></thead><tbody>
            ${(r.lines || []).map((l) => {
              const ing = !l.pantry ? M.get(l.id) : null;
              const mm = ing ? Object.fromEntries(['cal', 'p', 'c', 'f'].map((k) => [k, (ing.macros[k] || 0) * l.q])) : l.macros;
              return `<tr><td>${esc(l.name)}${ing ? ` <span class="t3">${ing.status === 'estimated' ? 'est.' : ing.status === 'user' ? 'yours' : 'verified'}</span>` : ''}</td><td>${r0(mm.cal)}</td><td>${r0(mm.p)}</td><td>${r0(mm.c)}</td><td>${r0(mm.f)}</td></tr>`;
            }).join('')}</tbody></table>
            <p class="footnote t3 mt8">Each row is that ingredient’s amount per serving × its nutrition. Generic estimates are typical values, not label data — tap an ingredient to correct it, and recipes update.</p></details>`
        : '';
      return {
        eyebrow: esc(r.method) + (r.airFryer && r.format !== 'air' ? ' · uses the air fryer' : r.onePan && !/pan/i.test(r.method) ? ' · one pan' : ''),
        title: esc(r.name),
        headExtra: `<button class="icon-btn star ${fav ? 'on' : ''}" data-act="mlFavOpen" aria-pressed="${fav}" aria-label="${fav ? 'Remove from saved' : 'Save recipe'}">${I('star', 17).replace('fill="none"', fav ? 'fill="currentColor"' : 'fill="none"')}</button>`,
        body: `${r.description ? `<p class="t2" style="line-height:1.55">${esc(r.description)}</p>` : ''}
          <p class="tnum mt12"><span class="t3">Prep</span> ${r.prep} min · <span class="t3">Cook</span> ${r.cook} min · <span class="t3">Total</span> <span class="strong">${M.totalTime(r)} min</span> · ${plural(r.servings, 'serving')}</p>
          <div class="nutri mt16" aria-label="Nutrition per serving">
            <div><div class="v">≈${m.cal}</div><div class="k">Calories</div></div>
            <div><div class="v">${m.p}<small>g</small></div><div class="k">Protein</div></div>
            <div><div class="v">${m.c}<small>g</small></div><div class="k">Carbs</div></div>
            <div><div class="v">${m.f}<small>g</small></div><div class="k">Fat</div></div>
          </div>
          <p class="footnote t3 mt8">Per serving${m.fiber != null ? ` · ${m.fiber} g fiber` : ''}. ${r.legacy ? 'Saved with the earlier meal planner — values as saved.' : m.estimated ? `Estimated: ${m.estimated} of ${m.ingredients} ingredients use typical values.` : 'All from your own or verified values.'}</p>
          ${breakdown}
          ${!r.legacy ? `<div class="row between mt16"><span class="strong">Servings</span>${H.stepper(r.servings, 'mlOpenServ', 'servings', 1, 8)}</div>` : ''}
          <div class="list-head mt24" style="padding-left:0">Your ingredients</div>
          <div class="list inset">${mine.map(lineRow).join('')}</div>
          ${pantry.length ? `<div class="list-head mt24" style="padding-left:0">Pantry additions <span class="t3">· counted in the nutrition</span></div><div class="list inset">${pantry.map(lineRow).join('')}</div>` : ''}
          ${(r.optional || []).length ? `<div class="list-head mt24" style="padding-left:0">Optional</div><div class="list inset">${r.optional.map((o) => H.li({ title: esc(o.name), sub: 'Not included in the nutrition' })).join('')}</div>` : ''}
          ${r.unused && r.unused.length ? `<p class="footnote t3 mt12">Not used in this one: ${esc(r.unused.join(', '))}.</p>` : ''}
          <div class="list-head mt24" style="padding-left:0">Steps</div>
          <ol class="steps">${(r.steps || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
          <p class="footnote t3 mt16">Cook poultry to 165°F / 74°C, ground meat to 160°F / 71°C, and fish until opaque.</p>`,
        foot: `<button class="btn btn-primary grow" data-act="mlLog">${I('plus', 15)}Log 1 serving</button>${view.ctx === 'ideas' ? `<button class="btn btn-secondary grow" data-act="mlSwapOne">${I('refresh', 15)}Another idea</button>` : ''}`,
      };
    }, { wide: true });
    A.mlOpenServ = (dd) => {
      const n = WT.clamp(view.r.servings + +dd.d, 1, 8);
      const next = M.rescale(view.r, n);
      if (next) view.r = next;
      WT.refreshSheet();
    };
    A.mlFavOpen = () => {
      M.toggleFavorite(view.r);
      WT.refreshSheet();
      WT.rerender();
    };
    A.mlLog = () => {
      const e = M.logServing(view.r);
      if (e) WT.toast(`Logged 1 serving · ≈${Math.round(e.per.p)} g protein`, 'good');
    };
    A.mlSwapOne = () => {
      const u = ui();
      const cur = u.ideas || [];
      const r = M.generate({ count: 1, exclude: u.shown.concat(cur.map((x) => x.key)), avoidFormats: cur.map((x) => x.format), avoidFlavors: cur.map((x) => x.flavor) });
      if (!r.ideas.length) return WT.toast('No other idea for this selection right now');
      u.ideas[view.i] = r.ideas[0];
      u.shown.push(r.ideas[0].key);
      view.r = r.ideas[0];
      WT.refreshSheet();
      WT.rerender();
    };
  };

  /* ───────── Preferences ───────── */
  A.mlDiet = (d) => {
    const pr = st().prefs;
    pr.diets = pr.diets.includes(d.k) ? pr.diets.filter((x) => x !== d.k) : pr.diets.concat(d.k);
    WT.save();
    ui().ideas = null;
    WT.rerender();
  };
  A.mlDislike = (d) => {
    M.toggleDisliked(d.id);
    ui().ideas = null;
    WT.rerender();
  };
  A.mlDislikeText = (d) => {
    st().prefs.dislikedText.splice(+d.k, 1);
    WT.save();
    ui().ideas = null;
    WT.rerender();
  };
  A.mlDislikeAdd = () => {
    const el = document.getElementById('mlDislikeIn');
    const words = String((el && el.value) || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (!words.length) return;
    words.forEach((w) => {
      const ing = M.kitchen().find((x) => x.name.toLowerCase() === w.toLowerCase() || x.name.toLowerCase().replace(/s$/, '') === w.toLowerCase().replace(/s$/, ''));
      if (ing) !M.disliked(ing.id) && M.toggleDisliked(ing.id);
      else if (!st().prefs.dislikedText.includes(w.toLowerCase())) st().prefs.dislikedText.push(w.toLowerCase());
    });
    WT.save();
    ui().ideas = null;
    WT.rerender();
  };
  A.mlPrefToggle = (d) => {
    const pr = st().prefs;
    pr[d.k] = pr[d.k] === false;
    WT.save();
    WT.rerender();
  };
  A.mlServ = (d) => {
    st().prefs.servings = WT.clamp((+st().prefs.servings || 2) + +d.d, 1, 6);
    WT.save();
    WT.rerender();
  };
  A.mlTime = (d) => {
    st().prefs.maxTime = +d.v || 0;
    WT.save();
    WT.rerender();
  };

  /* ───────── Ingredient: add / view / edit ─────────
   * New: type a name → nutrition is estimated live from the built-in database. Values are optional.
   * Existing: shows the source, serving and values; editing values marks them as yours (remembered).
   */
  function ingSheet(init) {
    const existing = init.id ? M.get(init.id) : null;
    const form = { id: existing ? existing.id : null, name: existing ? existing.name : init.name || '', cat: existing ? existing.cat : init.cat || null, tags: existing ? (existing.tags || []).slice() : [], serving: null, macros: {}, edited: false };
    const est = () => (existing && !form.nameChanged ? existing : M.preview(form.name || '', form.cat));
    const estBox = () => {
      const e = est();
      const named = !!(form.name || '').trim();
      if (!named && !existing) return `<p class="footnote t3">Type a name and Forge estimates its nutrition automatically.</p>`;
      const status = existing && !form.nameChanged ? existing.status : e.status;
      const how = existing && !form.nameChanged ? existing.source : e.confidence === 'category' ? 'Rough category estimate — edit if you know the label' : e.confidence === 'product' ? e.source : `Based on ${e.baseName ? e.baseName.toLowerCase() : 'a similar food'} (typical values)`;
      return `<div class="est">
          <div class="row between base"><span class="strong">${esc(servingText(e))}${e.serving.g && ING.unitInfo(e.serving.unit).type !== 'weight' ? ` <span class="t3">≈ ${Math.round(e.serving.g)} g</span>` : ''}</span>${statusTag(status)}</div>
          <div class="nutri sm mt8"><div><div class="v">≈${cal10(e.macros.cal)}</div><div class="k">cal</div></div><div><div class="v">${r0(e.macros.p)}<small>g</small></div><div class="k">protein</div></div><div><div class="v">${r0(e.macros.c)}<small>g</small></div><div class="k">carbs</div></div><div><div class="v">${r0(e.macros.f)}<small>g</small></div><div class="k">fat</div></div></div>
          <p class="footnote t3 mt8">${esc(how)}${e.note ? ' · ' + esc(e.note) : ''}${e.catNote ? ' ' + esc(e.catNote) : ''}</p></div>`;
    };
    const paintEst = () => {
      const el = document.getElementById('mlEst');
      if (el) el.innerHTML = estBox();
    };
    WT.openSheet(() => {
      const e = est();
      const cat = form.cat || (e.cat === 'pantry' ? 'other' : e.cat);
      const sv = form.serving || e.serving;
      const mv = Object.assign({}, e.macros, form.macros);
      const num = (k, v, label) => `<label class="stack grow" style="gap:4px"><span class="label">${label}</span><input class="input tnum" type="number" inputmode="decimal" min="0" step="any" data-in="mlfM" data-k="${k}" value="${v == null ? '' : Math.round(v * 10) / 10}" placeholder="—"></label>`;
      return {
        title: existing ? esc(dn(existing.name)) : 'Add ingredient',
        eyebrow: existing ? (existing.custom ? 'Your ingredient' : 'Built-in ingredient') : 'Nutrition is estimated for you',
        body: `<div class="stack" style="gap:16px">
          <label class="stack" style="gap:6px"><span class="label">Name</span><input class="input" id="mlfName" data-in="mlfName" value="${esc(form.name)}" placeholder="e.g. turkey kielbasa, cod, Fage yogurt" autocomplete="off"></label>
          ${existing && existing.builtin ? '' : `<div><span class="label" style="display:block;margin-bottom:8px">Category</span>${H.seg(Object.entries(M.CATS).map(([k, v]) => [k, v.replace(' ingredients', '').replace('Carbohydrates', 'Carbs')]), cat, 'mlfCat', '', 'full ing-cats')}</div>`}
          <div id="mlEst">${estBox()}</div>
          <details class="adv" ${H.keepOpen('mlfEdit')}><summary>${I('chevR', 13)}Serving size &amp; nutrition label <span class="t3 footnote">· optional</span></summary>
            <div class="stack mt12" style="gap:12px">
              <div class="row" style="gap:10px">
                <label class="stack" style="gap:4px;width:78px"><span class="label">Amount</span><input class="input tnum" type="number" inputmode="decimal" min="0" step="any" data-in="mlfS" data-k="n" value="${sv.n}"></label>
                <label class="stack grow" style="gap:4px"><span class="label">Unit</span><input class="input" data-in="mlfS" data-k="unit" value="${esc(sv.unit)}" placeholder="oz, cup, breast…"></label>
                <label class="stack" style="gap:4px;width:84px"><span class="label">Grams</span><input class="input tnum" type="number" inputmode="decimal" min="0" step="any" data-in="mlfS" data-k="g" value="${sv.g ? Math.round(sv.g) : ''}"></label>
              </div>
              <div class="row between wrap" style="gap:8px"><span class="label">Weighed</span>${H.seg(Object.entries({ raw: 'Raw', cooked: 'Cooked', dry: 'Dry', sold: 'As sold' }), sv.state || 'raw', 'mlfState', '', '')}</div>
              <div class="row" style="gap:10px">${num('cal', mv.cal, 'Calories')}${num('p', mv.p, 'Protein g')}</div>
              <div class="row" style="gap:10px">${num('c', mv.c, 'Carbs g')}${num('f', mv.f, 'Fat g')}</div>
              <div class="row" style="gap:10px">${num('fiber', mv.fiber, 'Fiber g')}${num('sugar', mv.sugar, 'Sugar g')}</div>
              <p class="footnote t3">Values are per the serving above. Changing only the serving size scales the nutrition; entering label values marks them as yours, and recipes use them from then on.</p>
            </div></details>
          ${existing && existing.builtin ? '' : `<div><span class="label" style="display:block;margin-bottom:8px">Contains <span class="t3">· for dietary filters</span></span>${H.chipGroup({ meat: 'Meat', poultry: 'Poultry', pork: 'Pork', fish: 'Fish', shellfish: 'Shellfish', dairy: 'Dairy', egg: 'Egg', gluten: 'Gluten', soy: 'Soy', nut: 'Nuts', corn: 'Corn' }, form.tags.length || existing ? form.tags : e.tags || [], 'mlfTag', 'sm')}</div>`}
        </div>`,
        foot: `${existing ? (existing.custom ? `<button class="btn btn-plain btn-sm" style="color:var(--danger)" data-act="mlfDelete">Delete</button>` : `<button class="btn btn-plain btn-sm" data-act="mlfRemove">Remove from kitchen</button>`) : ''}${existing && (existing.status === 'user' || (existing.builtin && st().overrides[existing.id])) ? `<button class="btn btn-plain btn-sm" data-act="mlfReset">${existing.builtin ? 'Reset' : 'Re-estimate'}</button>` : ''}<span class="grow"></span><button class="btn btn-primary" data-act="mlfSave">${existing ? 'Save' : 'Add to kitchen'}</button>`,
        after: (sheet) => {
          if (!existing && !form._focused) {
            form._focused = true;
            const n = sheet.querySelector('#mlfName');
            if (n) setTimeout(() => (n.focus(), n.setSelectionRange(n.value.length, n.value.length)), 60);
          }
        },
      };
    }, { wide: true });
    let t = null;
    WT.I.mlfName = (el, ev) => {
      if (ev.type !== 'input') return;
      form.name = el.value;
      form.nameChanged = !!existing && el.value !== existing.name;
      clearTimeout(t);
      t = setTimeout(paintEst, 120); // live estimate without re-rendering the input
    };
    WT.I.mlfS = (el) => {
      form.serving = Object.assign({}, form.serving || est().serving, { [el.dataset.k]: el.dataset.k === 'unit' ? el.value : +el.value });
    };
    WT.I.mlfM = (el) => {
      form.macros[el.dataset.k] = el.value;
    };
    A.mlfCat = (d) => {
      form.cat = d.v;
      WT.refreshSheet();
    };
    A.mlfState = (d) => {
      form.serving = Object.assign({}, form.serving || est().serving, { state: d.v });
      WT.refreshSheet();
    };
    A.mlfTag = (d) => {
      const base = form.tags.length || existing ? form.tags : est().tags || [];
      form.tags = base.includes(d.k) ? base.filter((x) => x !== d.k) : base.concat(d.k);
      WT.refreshSheet();
    };
    A.mlfSave = () => {
      try {
        const macros = {};
        Object.entries(form.macros).forEach(([k, v]) => v !== '' && v != null && (macros[k] = v));
        const rec = M.saveIngredient({ id: form.id, name: form.name, cat: form.cat || undefined, serving: form.serving || undefined, macros: Object.keys(macros).length ? macros : undefined, tags: form.tags.length || existing ? form.tags : undefined });
        if (!existing && !st().selected.includes(rec.id)) M.toggleSelect(rec.id);
        ui().q = '';
        WT.closeSheet();
        WT.toast(existing ? 'Saved — recipes use these values' : `${dn(rec.name)} added · ≈${Math.round(rec.macros.p)} g protein per serving`, 'good');
        WT.refreshSheet();
        WT.rerender();
      } catch (e) {
        WT.toast(e.message, 'error');
      }
    };
    A.mlfReset = () => {
      M.resetIngredient(form.id);
      WT.closeSheet();
      WT.refreshSheet();
      WT.rerender();
      WT.toast('Back to typical values');
    };
    A.mlfRemove = () => {
      M.removeFromKitchen(form.id);
      WT.closeSheet();
      WT.refreshSheet();
      WT.rerender();
    };
    A.mlfDelete = () =>
      WT.confirm('Delete ingredient?', 'It will be removed from your kitchen. Saved recipes that used it keep their text.', 'Delete', () => {
        M.deleteIngredient(form.id);
        WT.closeSheet(true);
        WT.rerender();
      }, true);
  }
  A.mlAddIng = (d) => ingSheet({ cat: d.cat || null, name: d.name || '' });
  A.mlIngInfo = (d) => ingSheet({ id: d.id });
  A.mlEditIng = (d) => ingSheet({ id: d.id });
  A.mlManage = () => {
    WT.openSheet(() => {
      const s = st();
      const row = (x) => H.li({
        title: esc(dn(x.name)) + (x.custom ? ' <span class="t3">· yours</span>' : ''),
        sub: `${esc(servingText(x))} · ≈${r0(x.macros.p)} g protein · ≈${cal10(x.macros.cal)} cal${M.unavailable(x.id) ? ' · <span style="color:var(--danger)">out of stock</span>' : ''}`,
        trail: `<span class="row" style="gap:0">
          <button class="icon-btn sm star ${s.staples.includes(x.id) ? 'on' : ''}" data-act="mlStaple" data-id="${esc(x.id)}" aria-pressed="${s.staples.includes(x.id)}" aria-label="Staple: always show ${esc(x.name)} first">${I('star', 16).replace('fill="none"', s.staples.includes(x.id) ? 'fill="currentColor"' : 'fill="none"')}</button>
          <button class="btn btn-plain btn-sm" data-act="mlStockM" data-id="${esc(x.id)}">${M.unavailable(x.id) ? 'Restock' : 'Ran out'}</button>
          <button class="icon-btn sm" data-act="mlEditIng" data-id="${esc(x.id)}" aria-label="Nutrition and serving for ${esc(x.name)}">${I('edit', 15)}</button></span>`,
      });
      return {
        title: 'Your kitchen',
        body: `<p class="footnote t3">Starred staples sort first. Tap the pencil to see where an ingredient’s nutrition comes from, change its serving size, or enter label values.</p>
          ${Object.entries(M.CATS).map(([k, n]) => {
            const list = M.sorted(k);
            return list.length ? `<div class="list-head mt24" style="padding-left:0">${n}</div><div class="list inset">${list.map(row).join('')}</div>` : '';
          }).join('')}`,
        foot: `<button class="btn btn-secondary btn-block" data-act="mlAddIng">${I('plus', 15)}Add ingredient</button>`,
      };
    }, { wide: true });
  };
  A.mlStaple = (d) => {
    M.toggleStaple(d.id);
    WT.refreshSheet();
    WT.rerender();
  };
  A.mlStockM = (d) => {
    M.toggleUnavailable(d.id);
    WT.refreshSheet();
    WT.rerender();
  };

  /* ═════════════════════ ACHIEVEMENTS ═════════════════════ */
  const fmtVal = (v, unit) => (unit === 'mi' ? WT.fmtNum(v) : String(Math.round(v)));
  V.achievements = function () {
    if (!WT.ach.enabled())
      return `<div class="page"><div class="head"><h1 class="large-title">Achievements</h1><p class="sub">Achievements are turned off.</p></div><button class="btn btn-secondary" data-act="achEnable">Turn on achievements</button></div>`;
    WT.ach.check(); // keeps the list current when opened
    const prog = WT.ach.progress();
    const c = WT.ach.counts();
    const rows = (cat) =>
      prog
        .filter((p) => p.def.cat === cat)
        .map((p) => {
          const u = p.unlocked;
          const pct = p.target ? Math.min(1, p.value / p.target) : 0;
          const sub = u
            ? `${esc(WT.ach.text(p.def))}<br><span class="ach-date">Earned ${WT.fmtDate(u.at)}${u.retro ? ' · counted from earlier history' : ''}</span>`
            : `${esc(WT.ach.text(p.def))}${p.target > 1 ? `<span class="ach-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${p.target}" aria-valuenow="${p.value}"><i style="width:${pct * 100}%"></i></span>` : ''}`;
          return `<div class="li ach ${u ? 'got' : 'locked'}"><span class="ach-ic" aria-hidden="true">${I(u ? p.def.icon || 'trophy' : 'lock', 17)}</span><div class="grow"><div class="ti">${esc(p.def.name)}</div><div class="su">${sub}</div></div>${!u && p.target > 1 ? `<span class="tnum footnote t2">${fmtVal(p.value, p.def.unit)}/${fmtVal(p.target, p.def.unit)}${p.def.unit === 'mi' ? ' mi' : ''}</span>` : u ? `<span class="accent">${I('check', 17)}</span>` : ''}</div>`;
        })
        .join('');
    return `<div class="page">
      <div class="head"><h1 class="large-title">Achievements</h1><p class="sub tnum">${c.earned} of ${c.total} earned. Small milestones from what you log — nothing to compete over.</p></div>
      ${Object.entries(WT.ach.CATS).map(([k, n]) => `<div class="group"><div class="list-head">${n}</div><div class="list inset">${rows(k)}</div></div>`).join('')}
      <p class="footnote t3 mt24">Achievements unlock from your logged workouts, runs and food on this device. Consistency is measured against your own weekly goal, and protein days count only when you land in your range — extra sessions or extra protein never earn more. <a class="btn-link" href="#/settings">Achievement settings</a></p>
    </div>`;
  };
  A.achEnable = () => {
    WT.db.profile.achievements = true;
    WT.save();
    WT.rerender();
  };
})();
