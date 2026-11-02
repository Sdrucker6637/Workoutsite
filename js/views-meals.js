/* Views: Meal ideas (ingredient picker → recipes) and Achievements. Logic lives in meals.js / achievements.js. */
(function () {
  const WT = globalThis.WT;
  const I = WT.icon, esc = WT.esc, H = WT.h, A = WT.A, V = WT.V, M = WT.meals;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const ui = () => (WT.ui.meals = WT.ui.meals || { tab: 'ideas', mode: 'select', q: '', ideas: null, reason: null, shown: [] });
  const st = () => WT.db.meals;

  /* ═════════════════════ MEAL IDEAS ═════════════════════ */
  function chip(ing) {
    const s = st();
    const sel = s.selected.includes(ing.id);
    const out = M.unavailable(ing.id);
    const dis = M.disliked(ing.id);
    const conflict = M.dietConflict(ing);
    const off = out || dis || conflict;
    const title = out ? 'Out of stock — tap to restock' : dis ? 'You marked this as disliked' : conflict ? `Not ${conflict.toLowerCase()}` : '';
    const mode = ui().mode;
    const act = mode === 'stock' ? 'mlStock' : 'mlPick';
    const disabled = mode === 'select' && (dis || conflict);
    return `<button class="chip ing ${sel && !off ? 'on' : ''} ${off ? 'out' : ''}" data-act="${act}" data-id="${esc(ing.id)}" aria-pressed="${mode === 'stock' ? !out : sel}" ${title ? `title="${esc(title)}"` : ''} ${disabled ? 'disabled' : ''}>${s.staples.includes(ing.id) ? `<span class="pin" aria-label="Staple">${I('star', 11).replace('fill="none"', 'fill="currentColor"')}</span>` : ''}${esc(ing.name)}${out ? '<span class="sr"> (out)</span>' : ''}</button>`;
  }
  function pickerHtml() {
    const u = ui();
    const found = M.search(u.q);
    if (found) {
      return `<div class="chips mt12">${found.map(chip).join('') || `<p class="footnote t3">No ingredient called “${esc(u.q)}”. <button class="btn-link" data-act="mlAddIng" data-name="${esc(u.q)}">Add it</button></p>`}</div>`;
    }
    const freq = M.frequent(10);
    return `${freq.length ? `<div class="ing-group"><div class="label">Frequent &amp; staples</div><div class="chips">${freq.map(chip).join('')}</div></div>` : ''}
      ${Object.entries(M.CATS).map(([k, name]) => `<div class="ing-group"><div class="label">${name}</div><div class="chips">${M.sorted(k).map(chip).join('')}<button class="chip ghost" data-act="mlAddIng" data-cat="${k}" aria-label="Add a ${name.toLowerCase()} ingredient">${I('plus', 13)}Add</button></div></div>`).join('')}`;
  }
  function selectedBar() {
    const s = st();
    const sel = s.selected.map(M.get).filter((x) => x && M.usable(x));
    return `<div class="sel-bar" id="mlSelBar">${sel.length ? `<span class="footnote t2">${plural(sel.length, 'ingredient')}: ${esc(sel.map((x) => x.name).join(', '))}</span><button class="btn-link footnote" data-act="mlClear">Clear</button>` : `<span class="footnote t3">Tap what you have. No amounts needed.</span>`}</div>`;
  }
  function recipeMeta(r) {
    return `${M.totalTime(r)} min · ≈${r.macros.p} g protein${r.macros.cal ? ` · ≈${r.macros.cal} cal` : ''}${r.airFryer ? ' · Air fryer' : ''}`;
  }
  function recipeCard(r, i, ctx) {
    const fav = M.isFavorite(r.key);
    return `<div class="meal-card">
      <button class="grow meal-main" data-act="mlOpen" data-ctx="${ctx}" data-i="${i}">
        <div class="ti">${esc(r.name)}</div>
        <div class="su tnum">${recipeMeta(r)}</div>
        <div class="su t3">Uses ${esc(WT.listJoin(r.mine.map((x) => x.name.toLowerCase())))}</div>
      </button>
      <button class="icon-btn sm star ${fav ? 'on' : ''}" data-act="mlFav" data-ctx="${ctx}" data-i="${i}" aria-pressed="${fav}" aria-label="${fav ? 'Remove from saved' : 'Save recipe'}">${I('star', 17).replace('fill="none"', fav ? 'fill="currentColor"' : 'fill="none"')}</button>
    </div>`;
  }
  function prefsHtml() {
    const pr = st().prefs;
    const dis = pr.disliked.map(M.get).filter(Boolean);
    return `<details class="adv mt32" ${H.keepOpen('mealPrefs')}><summary>${I('chevR', 14)}Preferences</summary>
      <div class="adv-body">
        <div class="adv-block"><span class="label">Dietary needs</span>${H.chipGroup(Object.fromEntries(Object.entries(M.DIETS).map(([k, v]) => [k, v.name])), pr.diets, 'mlDiet', 'sm')}</div>
        <div class="adv-block"><span class="label">Disliked ingredients</span>
          <div class="chips">${dis.map((x) => `<button class="chip sm on" data-act="mlDislike" data-id="${esc(x.id)}" aria-label="Remove ${esc(x.name)} from disliked">${esc(x.name)} ${I('x', 12)}</button>`).join('')}${pr.dislikedText.map((w, k) => `<button class="chip sm on" data-act="mlDislikeText" data-k="${k}" aria-label="Remove ${esc(w)}">${esc(w)} ${I('x', 12)}</button>`).join('')}</div>
          <div class="row mt8" style="gap:8px"><input class="input" id="mlDislikeIn" placeholder="e.g. mushrooms, cilantro, honey" autocomplete="off" aria-label="Add a disliked ingredient"><button class="btn btn-secondary" data-act="mlDislikeAdd">Add</button></div>
          <p class="footnote t3 mt8">Disliked ingredients are never suggested — including pantry extras like honey or cheese.</p></div>
        <div class="adv-block">
          <div class="row between"><div><div class="strong" style="font-size:14.5px">I have an air fryer</div><div class="footnote t3">Favors air-fryer recipes</div></div>${H.toggle(pr.airFryer !== false, 'mlAir')}</div>
          <div class="row between mt16"><span class="strong" style="font-size:14.5px">Servings</span>${H.stepper(pr.servings || 2, 'mlServ', 'servings', 1, 6)}</div>
          <div class="row between mt16 wrap" style="gap:10px"><span class="strong" style="font-size:14.5px">Time limit</span>${H.seg([[0, 'Any'], [20, '20'], [30, '30'], [45, '45 min']], pr.maxTime || 0, 'mlTime')}</div>
        </div>
        <div class="adv-block"><button class="row between" style="width:100%" data-act="mlManage"><span><span class="strong" style="font-size:14.5px">Manage ingredients</span><span class="footnote t3" style="display:block">Edit names, staples, your own ingredients</span></span><span class="t3">${I('chevR', 16)}</span></button></div>
      </div></details>`;
  }

  V.meals = function () {
    const u = ui();
    const s = st();
    const favN = s.favorites.length;
    const seg = H.seg([['ideas', 'Ideas'], ['saved', `Saved${favN ? ' · ' + favN : ''}`]], u.tab, 'mlTab', '', 'full');
    if (u.tab === 'saved') {
      return `<div class="page">
        <div class="head head-row"><div><h1 class="large-title">Meal ideas</h1><p class="sub">Recipes you’ve saved.</p></div></div>
        ${seg}
        <section class="section">${favN ? `<div class="meal-list">${s.favorites.map((r, i) => recipeCard(r, i, 'saved')).join('')}</div>` : H.empty('Nothing saved yet', 'Tap the star on a meal idea to keep it here.', `<button class="btn btn-secondary" data-act="mlTab" data-v="ideas">Find ideas</button>`)}</section>
      </div>`;
    }
    const usable = s.selected.map(M.get).filter((x) => x && M.usable(x));
    const results = u.ideas
      ? `<section class="section" id="mlResults" style="scroll-margin-top:72px">
          <div class="section-title"><h2>Ideas</h2>${u.ideas.length ? `<button class="btn-link footnote" data-act="mlMore">${I('refresh', 13)} Different ideas</button>` : ''}</div>
          ${u.ideas.length ? `<div class="meal-list fade-in">${u.ideas.map((r, i) => recipeCard(r, i, 'ideas')).join('')}</div><p class="footnote t3 mt12">Amounts are approximate for ${plural(s.prefs.servings || 2, 'serving')}; macros are per serving and only estimates.</p>` : `<p class="t2">${esc(u.reason || 'No ideas for that combination.')}</p>`}
        </section>`
      : '';
    return `<div class="page">
      <div class="head head-row"><div><h1 class="large-title">Meal ideas</h1><p class="sub">Pick what you have and get protein-forward meals to cook. Works offline.</p></div><a class="btn btn-plain btn-sm" href="#/food">${I('food', 15)}Food log</a></div>
      ${seg}
      <div class="search mt24"><span>${I('search', 16)}</span><input class="input" id="mlSearch" placeholder="Search ingredients" value="${esc(u.q)}" data-in="mlSearch" autocomplete="off" aria-label="Search ingredients"></div>
      <div class="row between mt16 wrap" style="gap:10px">${H.seg([['select', 'I have'], ['stock', 'Ran out']], u.mode, 'mlMode')}<span class="footnote t3">${u.mode === 'stock' ? 'Tap anything you’ve run out of. Tap again when it’s back.' : `${s.unavailable.length ? plural(s.unavailable.length, 'item') + ' out of stock' : ''}`}</span></div>
      <div id="mlPicker" class="mt8">${pickerHtml()}</div>
      ${selectedBar()}
      <button class="btn btn-primary btn-lg btn-block mt16" data-act="mlGenerate" ${usable.length ? '' : 'disabled'}>${I('sparkles', 18)}${u.ideas ? 'Suggest again' : 'Suggest meals'}</button>
      ${results}
      ${prefsHtml()}
      <p class="footnote t3 mt16">Ideas come from recipes bundled with Forge and are filled with your ingredients on this device — no recipe service, account or connection needed.</p>
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
    M.toggleSelect(d.id);
    repaintPicker();
  };
  A.mlStock = (d) => {
    M.toggleUnavailable(d.id);
    const ing = M.get(d.id);
    if (ing) WT.toast(M.unavailable(d.id) ? `${ing.name}: marked as run out` : `${ing.name}: back in stock`);
    repaintPicker();
  };
  A.mlClear = () => {
    st().selected = [];
    WT.save();
    ui().ideas = null;
    WT.rerender();
  };
  function run(exclude, avoidTpl) {
    const u = ui();
    const r = M.generate({ count: 4, exclude, avoidTpl });
    u.ideas = r.ideas;
    u.reason = r.reason;
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
    run(before, (u.ideas || []).map((x) => x.tpl));
    // When every combination has been shown, start the rotation over rather than showing nothing
    if (!u.ideas.length && before.length) {
      run([]);
      WT.toast('That’s every idea for this selection — starting over');
    }
  };
  const recipeOf = (d) => (d.ctx === 'saved' ? st().favorites[+d.i] : (ui().ideas || [])[+d.i]);
  A.mlFav = (d) => {
    const r = recipeOf(d);
    if (!r) return;
    const on = M.toggleFavorite(r);
    WT.toast(on ? 'Saved' : 'Removed from saved');
    WT.rerender();
    WT.refreshSheet();
  };
  A.mlOpen = (d) => {
    const base = recipeOf(d);
    if (!base) return;
    const view = { r: base };
    WT.openSheet(() => {
      const r = view.r;
      const fav = M.isFavorite(r.key);
      const showM = WT.db.profile.showMacros !== false;
      return {
        eyebrow: esc(r.method) + (r.airFryer ? ' · air-fryer friendly' : ''),
        title: esc(r.name),
        headExtra: `<button class="icon-btn star ${fav ? 'on' : ''}" data-act="mlFavOpen" aria-pressed="${fav}" aria-label="${fav ? 'Remove from saved' : 'Save recipe'}">${I('star', 17).replace('fill="none"', fav ? 'fill="currentColor"' : 'fill="none"')}</button>`,
        body: `<div class="facts">
            <div><div class="k">Prep</div><div class="v">${r.prep} min</div></div>
            <div><div class="k">Cook</div><div class="v">${r.cook} min</div></div>
            <div><div class="k">Protein</div><div class="v">≈${r.macros.p} g</div></div>
            ${showM ? `<div><div class="k">Calories</div><div class="v">≈${r.macros.cal}</div></div><div><div class="k">Carbs · fat</div><div class="v">≈${r.macros.c} g · ${r.macros.f} g</div></div>` : ''}
          </div>
          <p class="footnote t3 mt8">Per serving, estimated from typical values${r.unknown.length ? ` (not counting ${esc(WT.listJoin(r.unknown))} — no values saved)` : ''}.</p>
          <div class="row between mt24"><span class="strong">Servings</span>${H.stepper(r.servings, 'mlOpenServ', 'servings', 1, 8)}</div>
          <div class="list-head mt24" style="padding-left:0">From your kitchen</div>
          <div class="list inset">${r.mine.map((x) => H.li({ title: esc(x.name) + (x.label ? ` <span class="t3">· ${esc(x.label)}</span>` : ''), trail: `<span class="tnum t2">${esc(x.amount)}</span>` })).join('')}</div>
          ${r.extras.length ? `<div class="list-head mt24" style="padding-left:0">Common additions <span class="t3">· not from your selection</span></div>
          <div class="list inset">${r.extras.map((x) => H.li({ title: esc(x.name), trail: x.amount ? `<span class="tnum t3">${esc(x.amount)}</span>` : '' })).join('')}</div>` : ''}
          <div class="list-head mt24" style="padding-left:0">Steps</div>
          <ol class="steps">${r.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
          <p class="footnote t3 mt16">Cook poultry and ground meat to 165°F / 74°C, seafood until opaque.</p>`,
        foot: `<button class="btn btn-secondary grow" data-act="mlLog">${I('plus', 15)}Log 1 serving</button><button class="btn btn-primary grow" data-act="closeSheet">Done</button>`,
      };
    }, { wide: true });
    A.mlOpenServ = (dd) => {
      const n = WT.clamp(view.r.servings + +dd.d, 1, 8);
      const next = M.rescale(view.r, n);
      if (next) view.r = next;
      else WT.toast('This saved recipe uses an ingredient that no longer exists', 'error');
      WT.refreshSheet();
    };
    A.mlFavOpen = () => {
      M.toggleFavorite(view.r);
      WT.refreshSheet();
      WT.rerender();
    };
    A.mlLog = () => {
      if (!WT.nut) return;
      const r = view.r;
      WT.nut.addItems([{ name: r.name, qty: 1, unit: 'serving', per: { p: r.macros.p, cal: r.macros.cal, c: r.macros.c, f: r.macros.f }, src: 'manual', conf: 'estimated', note: 'Meal idea estimate', text: r.name }]);
      WT.toast(`Logged ≈${r.macros.p} g protein`, 'good');
    };
  };

  /* Preferences */
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
    WT.rerender();
  };
  A.mlDislikeAdd = () => {
    const el = document.getElementById('mlDislikeIn');
    const words = String((el && el.value) || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (!words.length) return;
    words.forEach((w) => {
      const ing = M.all().find((x) => x.name.toLowerCase() === w.toLowerCase() || x.name.toLowerCase().replace(/s$/, '') === w.toLowerCase().replace(/s$/, ''));
      if (ing) !M.disliked(ing.id) && M.toggleDisliked(ing.id);
      else if (!st().prefs.dislikedText.includes(w.toLowerCase())) st().prefs.dislikedText.push(w.toLowerCase());
    });
    WT.save();
    ui().ideas = null;
    WT.rerender();
  };
  A.mlAir = () => {
    st().prefs.airFryer = st().prefs.airFryer === false;
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

  /* Add / edit / manage ingredients */
  function ingForm(init) {
    const form = Object.assign({ id: null, name: '', cat: 'protein', p: '', cal: '', tags: [] }, init);
    const builtin = form.id && M.BUILTIN.some((x) => x.id === form.id);
    WT.openSheet(() => ({
      title: form.id ? 'Edit ingredient' : 'Add ingredient',
      body: `<div class="stack" style="gap:16px">
          <label class="stack" style="gap:6px"><span class="label">Name</span><input class="input" data-in="mlf" data-k="name" value="${esc(form.name)}" placeholder="e.g. Cod, Lentils, Kale" autocomplete="off"></label>
          ${builtin ? '' : `<div><span class="label" style="display:block;margin-bottom:8px">Category</span>${H.seg(Object.entries(M.CATS), form.cat, 'mlfCat', '', 'full')}</div>
          <div class="row" style="gap:12px">
            <label class="stack grow" style="gap:6px"><span class="label">Protein per serving (g)</span><input class="input tnum" type="number" inputmode="decimal" min="0" data-in="mlf" data-k="p" value="${esc(form.p)}" placeholder="Optional"></label>
            <label class="stack grow" style="gap:6px"><span class="label">Calories</span><input class="input tnum" type="number" inputmode="numeric" min="0" data-in="mlf" data-k="cal" value="${esc(form.cal)}" placeholder="Optional"></label>
          </div>
          <div><span class="label" style="display:block;margin-bottom:8px">Contains (for dietary filters)</span>${H.chipGroup({ meat: 'Meat', fish: 'Fish', shellfish: 'Shellfish', dairy: 'Dairy', egg: 'Egg', gluten: 'Gluten', soy: 'Soy' }, form.tags, 'mlfTag', 'sm')}</div>`}
          <p class="footnote t3">${builtin ? 'Renaming keeps its typical portion and nutrition values.' : 'Your own ingredients fit any recipe slot in their category. Values are optional — without them, macros leave this ingredient out.'}</p>
        </div>`,
      foot: `${form.id ? `<button class="btn btn-plain btn-sm" style="color:var(--danger)" data-act="mlfDelete">${builtin ? 'Reset name' : 'Delete'}</button>` : ''}<span class="grow"></span><button class="btn btn-primary" data-act="mlfSave">Save</button>`,
    }));
    WT.I.mlf = (el) => (form[el.dataset.k] = el.value);
    A.mlfCat = (d) => {
      form.cat = d.v;
      WT.refreshSheet();
    };
    A.mlfTag = (d) => {
      form.tags = form.tags.includes(d.k) ? form.tags.filter((x) => x !== d.k) : form.tags.concat(d.k);
      WT.refreshSheet();
    };
    A.mlfSave = () => {
      try {
        const rec = M.saveIngredient(form);
        if (!form.id && !st().selected.includes(rec.id)) M.toggleSelect(rec.id);
        WT.closeSheet();
        WT.toast(form.id ? 'Saved' : `${rec.name} added`);
        WT.refreshSheet();
        WT.rerender();
      } catch (e) {
        WT.toast(e.message, 'error');
      }
    };
    A.mlfDelete = () => {
      M.deleteIngredient(form.id);
      WT.closeSheet();
      WT.refreshSheet();
      WT.rerender();
    };
  }
  A.mlAddIng = (d) => ingForm({ cat: d.cat || 'protein', name: d.name || '' });
  A.mlManage = () => {
    WT.openSheet(() => {
      const s = st();
      const row = (x) => H.li({
        title: esc(x.name) + (x.custom ? ' <span class="t3">· yours</span>' : ''),
        sub: [M.unavailable(x.id) ? 'Out of stock' : '', M.disliked(x.id) ? 'Disliked' : ''].filter(Boolean).join(' · '),
        trail: `<span class="row" style="gap:0">
          <button class="icon-btn sm star ${s.staples.includes(x.id) ? 'on' : ''}" data-act="mlStaple" data-id="${esc(x.id)}" aria-pressed="${s.staples.includes(x.id)}" aria-label="Staple: always show first">${I('star', 16).replace('fill="none"', s.staples.includes(x.id) ? 'fill="currentColor"' : 'fill="none"')}</button>
          <button class="btn btn-plain btn-sm" data-act="mlStockM" data-id="${esc(x.id)}">${M.unavailable(x.id) ? 'Restock' : 'Ran out'}</button>
          <button class="icon-btn sm" data-act="mlEditIng" data-id="${esc(x.id)}" aria-label="Edit ${esc(x.name)}">${I('edit', 15)}</button></span>`,
      });
      return {
        title: 'Ingredients',
        body: `<p class="footnote t3">Starred staples always appear first. “Ran out” keeps an ingredient out of every idea until you restock it.</p>
          ${Object.entries(M.CATS).map(([k, n]) => `<div class="list-head mt24" style="padding-left:0">${n}</div><div class="list inset">${M.sorted(k).map(row).join('')}</div>`).join('')}`,
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
  A.mlEditIng = (d) => {
    const x = M.get(d.id);
    if (!x) return;
    ingForm({ id: x.id, name: x.name, cat: x.cat, p: x.custom && x.per ? x.per.p : '', cal: x.custom && x.per && x.per.cal != null ? x.per.cal : '', tags: (x.tags || []).slice() });
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
