/* Views: Exercises, exercise detail/edit, History, Progress, Settings. */
(function () {
  const WT = globalThis.WT;
  const I = WT.icon, esc = WT.esc, H = WT.h, A = WT.A, V = WT.V;
  const toggleIn = (arr, k) => (arr.includes(k) ? arr.filter((x) => x !== k) : arr.concat(k));
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  /* ═════════════════════ EXERCISES ═════════════════════ */
  function libFiltered() {
    const f = WT.ui.lib;
    const q = f.q.trim().toLowerCase();
    const p = WT.db.profile;
    return WT.exercises
      .filter((ex) => {
        if (q && !(ex.name.toLowerCase().includes(q) || WT.muscleName(ex.primary).toLowerCase().includes(q))) return false;
        if (f.group && WT.MUSCLES[ex.primary].group !== f.group) return false;
        if (f.equip && !ex.equipment.includes(f.equip)) return false;
        if (f.cat && ex.category !== f.cat) return false;
        if (f.avail === 'mine' && (!WT.hasEquipment(ex) || WT.isRestricted(ex))) return false;
        if (f.avail === 'excluded' && !(p.excluded.includes(ex.id) || WT.isRestricted(ex))) return false;
        if (f.avail === 'custom' && !ex.custom) return false;
        if (f.fav && !p.favorites.includes(ex.id)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const starSvg = (on) => I('star', 17).replace('fill="none"', on ? 'fill="currentColor"' : 'fill="none"');
  function libRows(list) {
    const p = WT.db.profile;
    if (!list.length) return `<div class="li"><div class="grow su">No exercises match. Try clearing a filter.</div></div>`;
    return list
      .map((ex) => {
        const fav = p.favorites.includes(ex.id);
        const excl = p.excluded.includes(ex.id) || WT.isRestricted(ex);
        return `<div class="li lib-row">${H.demo(ex.id, 'sm')}<button class="grow" style="text-align:left;min-width:0" data-act="exDetail" data-id="${ex.id}">
            <div class="ti ellipsis">${esc(ex.name)}</div>
            <div class="su ellipsis">${WT.muscleName(ex.primary)} · ${ex.equipment.map((q) => WT.EQUIPMENT[q]).join(', ')}${excl ? ' · <span style="color:var(--danger)">Excluded</span>' : ''}</div></button>
          <button class="icon-btn sm star ${fav ? 'on' : ''}" data-act="favToggle" data-id="${ex.id}" aria-pressed="${fav}" aria-label="Favorite">${starSvg(fav)}</button></div>`;
      })
      .join('');
  }
  V.library = function () {
    const f = WT.ui.lib;
    const list = libFiltered();
    const sel = (key, label, opts) => `<select class="pill-select ${f[key] && !(key === 'avail' && f[key] === 'mine') ? 'set' : ''}" data-in="libFilter" data-k="${key}" aria-label="${label}"><option value="">${label}</option>${opts.map(([v, l]) => `<option value="${v}" ${f[key] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    return `<div class="page">
      <div class="head head-row"><div><h1 class="large-title">Exercises</h1><p class="sub">${WT.exercises.length} exercises, each with a form tutorial.</p></div>
        <button class="btn btn-secondary btn-sm" data-act="exEdit">${I('plus', 15)}New</button></div>
      <div class="search"><span>${I('search', 16)}</span><input class="input" placeholder="Search exercises" value="${esc(f.q)}" data-in="libSearch" autocomplete="off" id="libSearch" aria-label="Search exercises"></div>
      <div class="filters">
        ${sel('group', 'Muscle', Object.entries(WT.GROUPS))}
        ${sel('equip', 'Equipment', Object.entries(WT.EQUIPMENT))}
        ${sel('cat', 'Type', [['compound', 'Compound'], ['isolation', 'Isolation'], ['cardio', 'Cardio']])}
        ${sel('avail', 'Show', [['mine', 'Available to me'], ['all', 'All exercises'], ['excluded', 'Excluded'], ['custom', 'My exercises']]).replace('<option value="">Show</option>', '')}
        <button class="chip sm ${f.fav ? 'on' : ''}" data-act="libFav" style="height:32px">${I('star', 13)}Favorites</button>
      </div>
      <div class="footnote t3 mt24" id="libCount" style="padding-left:2px">${plural(list.length, 'exercise')}</div>
      <div class="list inset mt8" id="libList">${libRows(list)}</div>
    </div>`;
  };
  WT.I.libSearch = (el, ev) => {
    if (ev.type !== 'input') return;
    WT.ui.lib.q = el.value;
    const list = libFiltered();
    document.getElementById('libList').innerHTML = libRows(list);
    document.getElementById('libCount').textContent = plural(list.length, 'exercise');
  };
  WT.I.libFilter = (el, ev) => {
    if (ev.type !== 'change') return;
    WT.ui.lib[el.dataset.k] = el.value || (el.dataset.k === 'avail' ? 'mine' : '');
    WT.rerender();
  };
  A.libFav = () => {
    WT.ui.lib.fav = !WT.ui.lib.fav;
    WT.rerender();
  };
  A.favToggle = (d) => {
    const p = WT.db.profile;
    p.favorites = toggleIn(p.favorites, d.id);
    WT.save();
    if (WT.ui.route === 'library') document.getElementById('libList').innerHTML = libRows(libFiltered());
    WT.refreshSheet();
  };

  /* Exercise detail */
  A.exDetail = (d) => {
    const id = d.id;
    WT.openSheet(
      () => {
        const ex = WT.ex(id);
        if (!ex) return { title: 'Not found' };
        const p = WT.db.profile;
        const fav = p.favorites.includes(id);
        const excl = p.excluded.includes(id);
        const vid = WT.youtubeId(ex.video);
        const hist = WT.exerciseHistory(id);
        const pr = WT.personalRecords(id);
        const tt = WT.trackType(ex);
        const u = p.unit;
        const rec = hist.length ? WT.recommend(id) : null;
        const video = vid
          ? `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${vid}?rel=0&modestbranding=1&playsinline=1" title="${esc(ex.name)} tutorial" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>
             <div class="row mt8" style="gap:16px"><a class="btn-link footnote" href="https://www.youtube.com/watch?v=${vid}" target="_blank" rel="noopener">Open on YouTube</a><a class="btn-link footnote" href="${WT.videoUrl(Object.assign({}, ex, { video: null }))}" target="_blank" rel="noopener">Other tutorials</a></div>`
          : `<a class="watch" href="${esc(WT.videoUrl(ex))}" target="_blank" rel="noopener"><span class="play">${I('play', 16).replace('fill="none"', 'fill="currentColor"')}</span><div class="grow"><div class="strong">Watch tutorial</div><div class="footnote t2">${ex.video ? 'Your saved video on YouTube' : 'Opens YouTube search'}</div></div><span class="t3">${I('ext', 16)}</span></a>
             <details class="adv mt8" ${H.keepOpen('embedVideo')}><summary>${I('chevR', 13)}Embed a specific video</summary><div class="row mt8" style="gap:8px"><input class="input" id="vidUrl" placeholder="Paste a YouTube link"><button class="btn btn-secondary" data-act="saveVideo" data-id="${id}">Save</button></div></details>`;
        const unitTxt = tt === 'time' || ex.unit === 'sec' ? ' sec' : tt === 'cardio' ? ' min' : '';
        const historyHtml = hist.length
          ? `<div class="section-title mt32"><h2>Your history</h2><span class="footnote t3">${plural(hist.length, 'session')}</span></div>
             ${tt !== 'cardio' && (pr.heaviest || pr.reps) ? `<div class="facts">${pr.heaviest ? `<div><div class="k">Heaviest</div><div class="v">${WT.fmtNum(pr.heaviest.w)} ${u} × ${pr.heaviest.r}</div></div>` : `<div><div class="k">Best</div><div class="v">${pr.reps.r}${tt === 'time' ? ' sec' : ' reps'}</div></div>`}${pr.e1rm ? `<div><div class="k">Est. 1-rep max</div><div class="v">${WT.fmtNum(Math.round(pr.e1rm.v))} ${u}</div></div>` : ''}${rec && rec.headline ? `<div><div class="k">Next time</div><div class="v">${esc(rec.headline.replace(/^Maintain /, ''))}</div></div>` : ''}</div>` : ''}
             ${hist.length > 1 && tt !== 'cardio' ? `<div id="exChart" class="mt24"></div>` : ''}
             <table class="table mt16"><tbody>${hist.slice(-5).reverse().map((h) => `<tr><td class="t2" style="width:90px">${WT.fmtDate(h.date, { month: 'short', day: 'numeric' })}</td><td>${WT.fmtSets(h.sets, tt, ex)}</td></tr>`).join('')}</tbody></table>`
          : `<p class="footnote t3 mt32">No history yet — your weights and records will appear here after you log it.</p>`;
        return {
          eyebrow: `${WT.muscleName(ex.primary)}${ex.secondary.length ? ' · ' + ex.secondary.slice(0, 2).map(WT.muscleName).join(', ') : ''}`,
          title: esc(ex.name),
          headExtra: `<button class="icon-btn star ${fav ? 'on' : ''}" data-act="favToggle" data-id="${id}" aria-pressed="${fav}" aria-label="Favorite">${starSvg(fav)}</button>`,
          body: `${H.demo(id, 'lg', { static: true })}${H.demoCredit(id)}<div class="mt16">${video}</div>
            ${ex.cue ? `<p class="mt24" style="line-height:1.6">${esc(ex.cue)}</p>` : ''}
            <div class="facts mt24">
              <div><div class="k">Recommended</div><div class="v">${ex.sets} × ${ex.repMin}–${ex.repMax}${unitTxt}</div></div>
              <div><div class="k">Rest</div><div class="v">${ex.rest ? WT.fmtClock(ex.rest) : '—'}</div></div>
              <div><div class="k">Level</div><div class="v">${WT.cap(ex.difficulty)}</div></div>
              <div><div class="k">Equipment</div><div class="v">${ex.equipment.map((q) => WT.EQUIPMENT[q]).join(', ')}</div></div>
              <div><div class="k">Type</div><div class="v">${WT.cap(ex.category)}</div></div>
              <div><div class="k">Intensity</div><div class="v row wrap" style="gap:4px 10px">${ex.intensities.filter((k) => k !== 'standard').map((k) => H.intensity(k)).join('') || '<span class="t3">Standard only</span>'}</div></div>
            </div>
            ${WT.isRestricted(ex) ? `<div class="callout warn mt16">${I('ban', 15)}<span>Blocked by your restrictions in Settings.</span></div>` : ''}
            ${historyHtml}`,
          foot: `<button class="btn btn-plain btn-sm" data-act="exEdit" data-id="${id}">Edit</button>
            <button class="btn btn-plain btn-sm" data-act="exExclude" data-id="${id}" ${excl ? '' : 'style="color:var(--danger)"'}>${excl ? 'Include' : 'Exclude'}</button>
            <span class="grow"></span>
            ${WT.db.active ? `<button class="btn btn-primary btn-sm" data-act="exAddTo" data-id="${id}" data-ctx="active">Add to workout</button>` : WT.db.draft ? `<button class="btn btn-primary btn-sm" data-act="exAddTo" data-id="${id}" data-ctx="draft">Add to plan</button>` : ''}`,
          after: (sheet) => {
            const el = sheet.querySelector('#exChart');
            if (el) WT.lineChart(el, hist.map((h) => ({ x: h.date, y: h.metrics.e1rm ? Math.round(h.metrics.e1rm) : h.metrics.bestReps, tip: `<b>${WT.fmtSets(h.sets, tt, ex)}</b><br><span class="faint">${WT.fmtDate(h.date)}</span>` })), { height: 150 });
          },
        };
      },
      { wide: true }
    );
  };
  A.saveVideo = (d) => {
    const url = document.getElementById('vidUrl').value.trim();
    if (!WT.youtubeId(url)) return WT.toast('That isn’t a YouTube video link', 'error');
    setOverride(d.id, { video: url });
    WT.toast('Video saved');
    WT.refreshSheet();
  };
  function setOverride(id, patch) {
    const ex = WT.ex(id);
    if (ex.custom) Object.assign(WT.db.customExercises.find((e) => e.id === id), patch);
    else WT.db.overrides[id] = Object.assign({}, WT.db.overrides[id] || {}, patch);
    WT.rebuildExercises();
    WT.save();
  }
  A.exExclude = (d) => {
    const p = WT.db.profile;
    p.excluded = toggleIn(p.excluded, d.id);
    WT.save();
    WT.toast(p.excluded.includes(d.id) ? 'Excluded from generated workouts' : 'Included again');
    WT.refreshSheet();
    if (WT.ui.route === 'library') WT.rerender();
  };
  A.exAddTo = (d) => {
    const ex = WT.ex(d.id);
    if (d.ctx === 'active') {
      const it = WT.sessionItem(ex.id);
      WT.db.active.exercises.push(it);
      WT.db.active.focus = it.uid;
    } else {
      WT.db.draft.exercises.push(Object.assign({ uid: WT.uid(), exId: ex.id, slot: { label: WT.muscleName(ex.primary), m: [ex.primary], p: null }, slotIndex: 99, why: ['Added by you'], locked: true }, WT.prescribe(ex, ex.intensity)));
      WT.db.draft.estimatedMin = WT.estimateMinutes(WT.db.draft.exercises);
    }
    WT.save();
    WT.closeSheet(true);
    WT.toast(`Added ${ex.name}`);
    WT.go(d.ctx === 'active' ? 'workout' : 'generate');
  };

  /* Edit / create */
  A.exEdit = (d) => {
    const id = d.id;
    const base = id ? WT.ex(id) : null;
    const form = base
      ? JSON.parse(JSON.stringify(base))
      : { name: '', primary: 'chest', secondary: [], equipment: ['db'], category: 'isolation', pattern: 'fly', difficulty: 'beginner', intensities: ['regular', 'standard'], repMin: 8, repMax: 12, rest: 60, load: 'db', tags: [], video: '', cue: '', sets: 3 };
    WT.closeSheet(true);
    WT.openSheet(
      () => {
        const muscles = Object.fromEntries(Object.entries(WT.MUSCLES).map(([k, v]) => [k, v.name]));
        const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');
        const fld = (label, inner) => `<label class="stack" style="gap:6px"><span class="label">${label}</span>${inner}</label>`;
        return {
          title: base ? 'Edit exercise' : 'New exercise',
          body: `<div class="stack" style="gap:16px">
            ${fld('Name', `<input class="input" data-in="exf" data-k="name" value="${esc(form.name)}" placeholder="e.g. Landmine Press">`)}
            <div class="row" style="gap:12px;align-items:flex-start">${fld('Primary muscle', `<select class="input" data-in="exf" data-k="primary">${opt(muscles, form.primary)}</select>`).replace('class="stack"', 'class="stack grow"')}${fld('Type', `<select class="input" data-in="exf" data-k="category">${opt({ compound: 'Compound', isolation: 'Isolation', cardio: 'Cardio' }, form.category)}</select>`).replace('class="stack"', 'class="stack grow"')}</div>
            <div class="row" style="gap:12px;align-items:flex-start">${fld('Tracking', `<select class="input" data-in="exf" data-k="load">${opt({ db: 'Dumbbell', cable: 'Cable', machine: 'Machine', bb: 'Barbell', mb: 'Medicine ball', kb: 'Kettlebell', bwl: 'Bodyweight + load', bw: 'Bodyweight reps', time: 'Timed hold', cardio: 'Cardio' }, form.load)}</select>`).replace('class="stack"', 'class="stack grow"')}${fld('Movement', `<select class="input" data-in="exf" data-k="pattern">${opt(WT.PATTERNS, form.pattern)}</select>`).replace('class="stack"', 'class="stack grow"')}</div>
            <div class="row" style="gap:12px">${fld('Reps from', `<input class="input tnum" type="number" inputmode="numeric" data-in="exf" data-k="repMin" value="${form.repMin}">`).replace('class="stack"', 'class="stack grow"')}${fld('to', `<input class="input tnum" type="number" inputmode="numeric" data-in="exf" data-k="repMax" value="${form.repMax}">`).replace('class="stack"', 'class="stack grow"')}${fld('Rest (sec)', `<input class="input tnum" type="number" inputmode="numeric" data-in="exf" data-k="rest" value="${form.rest}">`).replace('class="stack"', 'class="stack grow"')}</div>
            ${fld('Difficulty', `<select class="input" data-in="exf" data-k="difficulty">${opt({ beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }, form.difficulty)}</select>`)}
            <div><span class="label" style="display:block;margin-bottom:8px">Equipment</span>${H.chipGroup(WT.EQUIPMENT, form.equipment, 'exfEq', 'sm')}</div>
            <div><span class="label" style="display:block;margin-bottom:8px">Secondary muscles</span>${H.chipGroup(muscles, form.secondary, 'exfSec', 'sm')}</div>
            <div><span class="label" style="display:block;margin-bottom:8px">Can be programmed as</span>${H.chipGroup({ heavy: 'Heavy', regular: 'Regular', burnout: 'Burnout' }, form.intensities, 'exfInt', 'sm')}</div>
            ${fld('YouTube link', `<input class="input" data-in="exf" data-k="video" value="${esc(form.video || '')}" placeholder="Optional">`)}
            ${fld('Instructions', `<textarea class="input" data-in="exf" data-k="cue" placeholder="Setup and cues">${esc(form.cue || '')}</textarea>`)}
          </div>`,
          foot: `${base && !base.custom && WT.db.overrides[id] ? `<button class="btn btn-plain btn-sm" data-act="exfReset">Reset</button>` : ''}${base && base.custom ? `<button class="btn btn-plain btn-sm" style="color:var(--danger)" data-act="exfDelete">Delete</button>` : ''}<span class="grow"></span><button class="btn btn-primary" data-act="exfSave">Save</button>`,
        };
      },
      { wide: true }
    );
    WT.I.exf = (el) => {
      const k = el.dataset.k;
      form[k] = ['rest', 'repMin', 'repMax'].includes(k) ? +el.value : el.value;
    };
    A.exfSec = (dd) => {
      form.secondary = toggleIn(form.secondary, dd.k);
      WT.refreshSheet();
    };
    A.exfEq = (dd) => {
      form.equipment = toggleIn(form.equipment, dd.k);
      WT.refreshSheet();
    };
    A.exfInt = (dd) => {
      form.intensities = toggleIn(form.intensities, dd.k);
      WT.refreshSheet();
    };
    A.exfSave = () => {
      if (!form.name.trim()) return WT.toast('Give it a name', 'error');
      if (!form.equipment.length) form.equipment = ['bw'];
      if (form.video && !WT.youtubeId(form.video)) return WT.toast('Video link must be a YouTube video', 'error');
      form.intensities = WT.INTENSITIES.filter((k) => k === 'standard' || form.intensities.includes(k));
      if (form.load === 'cardio') form.intensities = ['standard'];
      form.repMin = Math.max(1, form.repMin || 1);
      form.repMax = Math.max(form.repMin, form.repMax || form.repMin);
      form.intensity = 'standard';
      form.sets = form.load === 'cardio' ? 1 : form.category === 'compound' && form.intensities.includes('heavy') ? 4 : 3;
      form.secondary = form.secondary.filter((m) => m !== form.primary);
      if (base && !base.custom) {
        const keys = ['name', 'primary', 'secondary', 'equipment', 'category', 'pattern', 'difficulty', 'intensities', 'repMin', 'repMax', 'rest', 'load', 'video', 'cue', 'sets'];
        const orig = WT.BUILTIN_EXERCISES.find((e) => e.id === id);
        const patch = {};
        keys.forEach((k) => {
          if (JSON.stringify(form[k] || '') !== JSON.stringify(orig[k] || '')) patch[k] = form[k];
        });
        WT.db.overrides[id] = patch;
      } else if (base && base.custom) {
        const i = WT.db.customExercises.findIndex((e) => e.id === id);
        WT.db.customExercises[i] = Object.assign({}, form, { custom: true });
      } else {
        form.id = 'custom-' + WT.uid();
        form.custom = true;
        form.tags = [];
        WT.db.customExercises.push(form);
      }
      WT.rebuildExercises();
      WT.save();
      WT.closeSheet();
      if (WT.ui.route === 'library') WT.rerender();
      WT.toast('Saved');
    };
    A.exfReset = () => {
      delete WT.db.overrides[id];
      WT.rebuildExercises();
      WT.save();
      WT.closeSheet();
      WT.toast('Reset to default');
    };
    A.exfDelete = () =>
      WT.confirm('Delete exercise?', 'Past workouts that used it keep their logged sets.', 'Delete', () => {
        WT.db.customExercises = WT.db.customExercises.filter((e) => e.id !== id);
        WT.rebuildExercises();
        WT.save();
        WT.closeSheet(true);
        WT.rerender();
      }, true);
  };

  /* ═════════════════════ HISTORY ═════════════════════ */
  V.history = function (id) {
    if (id) return historyDetail(id);
    const ss = WT.sessions().reverse();
    if (!ss.length)
      return `<div class="page"><div class="head"><h1 class="large-title">History</h1><p class="sub">Every workout you finish is saved here.</p></div><a class="btn btn-primary btn-lg" href="#/generate">${I('sparkles', 18)}Generate workout</a></div>`;
    const byMonth = {};
    ss.forEach((s) => {
      const d = new Date(s.startedAt);
      const k = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      (byMonth[k] = byMonth[k] || []).push(s);
    });
    const u = WT.db.profile.unit;
    return `<div class="page"><div class="head"><h1 class="large-title">History</h1><p class="sub">${plural(ss.length, 'workout')}</p></div>
      ${Object.entries(byMonth)
        .map(
          ([m, list]) => `<div class="group"><div class="list-head">${m}</div><div class="list inset">${list
            .map((s) => {
              const d = new Date(s.startedAt);
              return H.li({
                href: `#/history/${s.id}`,
                attrs: 'data-entry',
                lead: `<div class="day"><div class="d">${d.getDate()}</div><div class="w">${d.toLocaleDateString(undefined, { weekday: 'short' })}</div></div>`,
                title: esc(s.title),
                sub: `${WT.fmtDuration(s.durationSec)} · ${plural((s.totals && s.totals.sets) || 0, 'set')}${s.totals && s.totals.volume ? ` · ${WT.fmtNum(s.totals.volume)} ${u}` : ''}`,
                trail: (s.prs || []).length ? `<span class="badge-pr">${plural(s.prs.length, 'PR')}</span>` : '',
                chev: true,
              });
            })
            .join('')}</div></div>`
        )
        .join('')}</div>`;
  };
  function historyDetail(id) {
    const s = WT.db.history.find((x) => x.id === id);
    if (!s) return `<div class="page">${H.empty('Workout not found', 'It may have been deleted.', '<a class="btn btn-secondary" href="#/history">Back to history</a>')}</div>`;
    const u = WT.db.profile.unit;
    const d = new Date(s.startedAt);
    const prIds = new Set((s.prs || []).map((p) => p.exId));
    const exs = s.exercises
      .map((e) => {
        const def = WT.ex(e.exId);
        const tt = def ? WT.trackType(def) : 'weight';
        const sec = tt === 'time' || (def && def.unit === 'sec');
        const rows = (e.sets || [])
          .map((st, i) => {
            if (WT.isStagedSet(st)) {
              // One row for the sequence (it is one set), its stages listed underneath
              const info = WT.STAGED[st.type] || WT.STAGED.drop;
              const head = `<tr class="staged-head"><td class="n">${i + 1}</td><td>${info.name} · ${st.stages.length} stage${st.stages.length === 1 ? '' : 's'}</td></tr>`;
              return head + st.stages.map((x, k) => `<tr class="stage-row"><td class="n"></td><td><span class="t3">Stage ${k + 1}</span> ${k ? I(st.type === 'drop' ? 'trendDown' : 'trendUp', 12) : ''}${WT.fmtNum(+x.w)} ${u} × ${x.r}${x.tr ? `<span class="t3"> / ${x.tr}</span>` : ''}</td></tr>`).join('');
            }
            const v = tt === 'cardio' ? `${WT.fmtRunTime(st.time) || '—'}${st.dist ? ' · ' + st.dist + ' mi' : ''}` : tt === 'time' ? `${st.r} sec` : `${+st.w ? WT.fmtNum(+st.w) + ' ' + u : tt === 'reps' ? 'Bodyweight' : '—'} × ${st.r}${sec ? ' sec' : ''}`;
            return `<tr><td class="n">${i + 1}</td><td>${v}</td></tr>`;
          })
          .join('');
        return `<div class="section" style="margin-top:28px;${e.skipped ? 'opacity:.5' : ''}">
          <div class="row between base"><button class="headline" data-act="exDetail" data-id="${e.exId}" style="text-align:left">${esc(e.name || (def || {}).name || e.exId)}</button>${prIds.has(e.exId) ? `<span class="badge-pr">PR</span>` : e.skipped ? '<span class="footnote t3">Skipped</span>' : ''}</div>
          <div class="row wrap footnote t2 mt4" style="gap:4px 12px">${e.intensity && e.intensity !== 'standard' && WT.INTENSITY_INFO[e.intensity] ? H.intensity(e.intensity) : ''}<span class="tnum">Target ${WT.STAGED[e.intensity] ? `${e.targetSets || '?'} × ${e.stageCount || '?'} stages` : `${e.targetSets || '?'} × ${e.repMin}–${e.repMax}`}</span>${e.effort ? `<span>${{ easy: 'Felt easy', good: 'Felt solid', hard: 'Felt hard' }[e.effort]}</span>` : ''}</div>
          ${rows ? `<table class="table mt8"><tbody>${rows}</tbody></table>` : ''}
          ${e.notes ? `<p class="footnote t2 mt8">${esc(e.notes)}</p>` : ''}</div>`;
      })
      .join('');
    return `<div class="page">
      <a class="btn btn-plain btn-sm hide-m" href="#/history" style="margin:-8px 0 16px -10px">${I('chevL', 16)}History</a>
      <div class="head" style="margin-bottom:24px"><div class="over">${d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div><h1 class="large-title">${esc(s.title)}</h1></div>
      <div class="summary">
        <div class="metric"><div class="v">${WT.fmtDuration(s.durationSec)}</div><div class="k">Duration</div></div>
        <div class="metric"><div class="v">${(s.totals && s.totals.sets) || 0}</div><div class="k">Sets</div></div>
        <div class="metric"><div class="v">${s.totals && s.totals.volume ? WT.fmtNum(s.totals.volume) + `<small>${u}</small>` : '—'}</div><div class="k">Volume</div></div>
      </div>
      <div class="row wrap mt24" style="gap:8px">
        <button class="btn btn-primary" data-act="histRepeat" data-id="${s.id}">Repeat workout</button>
        <button class="btn btn-secondary" data-act="histTemplate" data-id="${s.id}">Edit as new plan</button>
        <button class="icon-btn" data-act="histMenu" data-id="${s.id}" aria-label="More">${I('more', 19)}</button>
      </div>
      ${s.notes ? `<p class="t2 mt24" style="line-height:1.6">${esc(s.notes)}</p>` : ''}
      <div class="mt16">${exs}</div>
    </div>`;
  }
  A.histMenu = (d) =>
    WT.openSheet(() => ({
      title: 'Workout',
      body: `<div class="list inset">${H.li({ act: 'histNotes', attrs: `data-id="${d.id}"`, title: 'Edit notes' })}${H.li({ act: 'histDelete', attrs: `data-id="${d.id}"`, title: 'Delete workout', cls: 'danger' })}</div>`,
    }));
  A.histRepeat = (d) => {
    const s = WT.db.history.find((x) => x.id === d.id);
    const begin = () => {
      WT.db.active = WT.sessionFromWorkout(WT.workoutFromSession(s));
      WT.warmDemos(WT.db.active.exercises.map((e) => e.exId));
      WT.save(true);
      WT.go('workout');
    };
    if (WT.db.active) WT.confirm('Replace current workout?', 'A workout is in progress. Repeating this one will discard it.', 'Discard and start', begin, true);
    else begin();
  };
  A.histTemplate = (d) => {
    const s = WT.db.history.find((x) => x.id === d.id);
    WT.db.draft = WT.workoutFromSession(s);
    WT.db.draft.exercises.forEach((i) => (i.locked = true));
    WT.db.draft.estimatedMin = WT.estimateMinutes(WT.db.draft.exercises);
    WT.ui.gen = Object.assign(WT.defaultSettings(s.type), s.settings || {}, { type: s.type });
    WT.save();
    WT.go('generate');
  };
  A.histNotes = (d) => {
    const s = WT.db.history.find((x) => x.id === d.id);
    WT.closeSheet(true);
    WT.openSheet(() => ({
      title: 'Notes',
      body: `<textarea class="input" id="histNotesTa" style="min-height:160px">${esc(s.notes || '')}</textarea>`,
      foot: `<button class="btn btn-primary btn-block" data-act="histNotesSave" data-id="${s.id}">Save</button>`,
    }));
  };
  A.histNotesSave = (d) => {
    const s = WT.db.history.find((x) => x.id === d.id);
    s.notes = document.getElementById('histNotesTa').value;
    WT.save();
    WT.closeSheet();
    WT.rerender();
  };
  A.histDelete = (d) => {
    WT.closeSheet(true);
    WT.confirm('Delete workout?', 'It will be removed from your history and statistics.', 'Delete', () => {
      WT.db.history = WT.db.history.filter((x) => x.id !== d.id);
      WT.save(true);
      WT.go('history');
    }, true);
  };

  /* ═════════════════════ PROGRESS ═════════════════════ */
  V.progress = function () {
    const st = WT.stats();
    const u = WT.db.profile.unit;
    if (!st.count) return `<div class="page"><div class="head"><h1 class="large-title">Progress</h1><p class="sub">Charts appear after your first workout. Everything here comes from sets you’ve logged.</p></div><a class="btn btn-primary btn-lg" href="#/generate">${I('sparkles', 18)}Generate workout</a></div>`;
    const tab = WT.ui.prog.tab || 'strength';
    const tracked = WT.trackedExercises().filter((t) => WT.trackType(t.ex) !== 'cardio');
    if (!WT.ui.prog.ex || !tracked.find((t) => t.ex.id === WT.ui.prog.ex)) WT.ui.prog.ex = tracked[0] ? tracked[0].ex.id : null;
    const ex = WT.ui.prog.ex && WT.ex(WT.ui.prog.ex);
    const hist = ex ? WT.exerciseHistory(ex.id) : [];
    const pr = ex ? WT.personalRecords(ex.id) : null;
    const loaded = hist.some((h) => h.metrics.topWeight > 0);

    let top;
    if (tab === 'strength') {
      let delta = '';
      if (hist.length > 1 && loaded) {
        const ch = Math.round(hist[hist.length - 1].metrics.e1rm - hist[0].metrics.e1rm);
        delta = `<span class="${ch > 0 ? 'accent' : 't3'} strong">${ch > 0 ? '+' : ''}${ch} ${u}</span> <span class="t3">since ${WT.fmtDate(hist[0].date, { month: 'short', day: 'numeric' })}</span>`;
      }
      top = ex
        ? `<div class="row between wrap" style="gap:10px"><select class="pill-select" data-in="progEx" aria-label="Exercise">${tracked.map((t) => `<option value="${t.ex.id}" ${t.ex.id === ex.id ? 'selected' : ''}>${esc(t.ex.name)}</option>`).join('')}</select><span class="footnote tnum">${delta}</span></div>
           <div class="footnote t3 mt16">${loaded ? 'Estimated 1-rep max' : 'Best reps'}</div>
           <div id="progChart" class="mt8"></div>
           <div class="summary mt24">
             ${pr.heaviest ? `<div class="metric"><div class="v">${WT.fmtNum(pr.heaviest.w)}<small>× ${pr.heaviest.r}</small></div><div class="k">Heaviest set</div></div>` : `<div class="metric"><div class="v">${pr.reps ? pr.reps.r : '—'}</div><div class="k">Most reps</div></div>`}
             ${pr.e1rm ? `<div class="metric"><div class="v">${WT.fmtNum(Math.round(pr.e1rm.v))}<small>${u}</small></div><div class="k">Best est. 1RM</div></div>` : '<div></div>'}
             <div class="metric"><div class="v">${hist.length}</div><div class="k">Sessions</div></div>
           </div>`
        : `<p class="t2">Log a strength exercise to see its progression.</p>`;
    } else if (tab === 'frequency') {
      top = `<div class="row between base"><span class="footnote t3">Workouts per week</span><span class="footnote t2 tnum">${WT.fmtNum(WT.round(st.avgPerWeek, 1))} per week on average</span></div><div id="weeksChart" class="mt12"></div>`;
    } else {
      const thisW = st.weeks[st.weeks.length - 1].volume, lastW = st.weeks[st.weeks.length - 2].volume;
      top = `<div class="row between base"><span class="footnote t3">Volume per week (${u})</span><span class="footnote t2 tnum">This week ${WT.fmtNum(thisW)} · last ${WT.fmtNum(lastW)}</span></div><div id="volChart" class="mt12"></div>`;
    }

    const groupRows = Object.entries(st.groupSets)
      .filter(([g]) => g !== 'cardio')
      .map(([g, v]) => ({ g, perWeek: v / (30 / 7), target: Object.keys(WT.MUSCLES).filter((m) => WT.MUSCLES[m].group === g).reduce((a, m) => a + WT.weeklyTarget(m), 0) }));
    const maxG = Math.max(...groupRows.map((r) => Math.max(r.perWeek, r.target)), 1);

    return `<div class="page">
      <div class="head"><h1 class="large-title">Progress</h1><p class="sub tnum">${plural(st.count, 'workout')} · ${WT.fmtNum(st.totalSets)} sets · ${st.totalVolume >= 10000 ? WT.fmtNum(Math.round(st.totalVolume / 1000)) + 'k' : WT.fmtNum(st.totalVolume)} ${u} lifted</p></div>
      ${H.seg([['strength', 'Strength'], ['frequency', 'Frequency'], ['volume', 'Volume']], tab, 'progTab', '', 'full')}
      <div class="mt24">${top}</div>
      <section class="section">
        <div class="section-title"><h2>Personal records</h2></div>
        ${st.prs.length ? `<div class="list inset">${st.prs.slice(0, 6).map((r) => H.li({ href: `#/history/${r.sessionId}`, title: esc((WT.ex(r.exId) || {}).name || r.exId), sub: `${r.kind} · ${WT.fmtDate(r.date, { month: 'short', day: 'numeric' })}`, trail: `<span class="strong tnum">${esc(r.value)}</span>` })).join('')}</div>` : `<p class="t2">Beat a previous best and it will be recorded here.</p>`}
      </section>
      <section class="section">
        <div class="section-title"><h2>Weekly sets by muscle group</h2><span class="footnote t3">Last 30 days</span></div>
        ${groupRows.map((r) => `<div class="bar-row"><span>${WT.GROUPS[r.g]}</span><div class="track"><i style="width:${(r.perWeek / maxG) * 100}%"></i><span class="tgt" style="left:${(r.target / maxG) * 100}%" title="Target ${r.target}"></span></div><span class="tnum t2" style="text-align:right">${WT.fmtNum(WT.round(r.perWeek, 1))} <span class="t3">/ ${r.target}</span></span></div>`).join('')}
        <p class="footnote t3 mt8">Marker shows your weekly target, higher for priority muscles.</p>
      </section></div>`;
  };
  V.progressAfter = function () {
    const st = WT.stats();
    const u = WT.db.profile.unit;
    const wEl = document.getElementById('weeksChart');
    if (wEl)
      WT.barChart(wEl, st.weeks.map((w, i) => ({ label: i % 2 === 1 ? WT.fmtDate(w.start, { month: 'short', day: 'numeric' }) : '', value: w.count, highlight: i === 11, tip: `<b>${plural(w.count, 'workout')}</b><br><span class="faint">Week of ${WT.fmtDate(w.start, { month: 'short', day: 'numeric' })}</span>` })), { ref: WT.db.profile.strengthPerWeek, refLabel: 'Goal', height: 220 });
    const vEl = document.getElementById('volChart');
    if (vEl) WT.barChart(vEl, st.weeks.map((w, i) => ({ label: i % 2 === 1 ? WT.fmtDate(w.start, { month: 'short', day: 'numeric' }) : '', value: w.volume, highlight: i === 11, tip: `<b>${WT.fmtNum(w.volume)} ${u}</b><br><span class="faint">${plural(w.sets, 'set')} · week of ${WT.fmtDate(w.start, { month: 'short', day: 'numeric' })}</span>` })), { height: 220 });
    const pEl = document.getElementById('progChart');
    if (pEl && WT.ui.prog.ex) {
      const ex = WT.ex(WT.ui.prog.ex);
      const tt = WT.trackType(ex);
      const hist = WT.exerciseHistory(ex.id);
      const loaded = hist.some((h) => h.metrics.topWeight > 0);
      WT.lineChart(pEl, hist.map((h) => { const y = loaded ? Math.round(h.metrics.e1rm) : h.metrics.bestReps; return { x: h.date, y, tip: `<b>${WT.fmtNum(y)} ${loaded ? u : 'reps'}</b> · ${WT.fmtDate(h.date, { month: 'short', day: 'numeric' })}<br><span class="faint">${WT.fmtSets(h.sets, tt, ex)}</span>` }; }), { height: 220 });
      if (hist.length === 1) pEl.insertAdjacentHTML('beforeend', '<p class="footnote t3" style="text-align:center">The line starts after your next session.</p>');
    }
  };
  WT.I.progEx = (el, ev) => {
    if (ev.type !== 'change') return;
    WT.ui.prog.ex = el.value;
    WT.rerender();
  };
  A.progTab = (d) => {
    WT.ui.prog.tab = d.v;
    WT.rerender();
  };

  /* ═════════════════════ SETTINGS ═════════════════════ */
  V.settings = function () {
    const p = WT.db.profile;
    const muscles = Object.fromEntries(Object.entries(WT.MUSCLES).filter(([k]) => k !== 'cardio').map(([k, v]) => [k, v.name]));
    const num = (k, v, step, sub) => `<input class="input tnum" style="width:84px;text-align:right;height:34px" type="number" inputmode="decimal" step="${step || 1}" data-in="pfNum" data-k="${k}" ${sub ? `data-sub="${sub}"` : ''} value="${v}" aria-label="${k}">`;
    const grp = (head, rows, foot, id) => `<div class="group" ${id ? `id="${id}"` : ''}>${head ? `<div class="list-head">${head}</div>` : ''}<div class="list inset">${rows}</div>${foot ? `<div class="list-foot">${foot}</div>` : ''}</div>`;
    const block = (inner) => `<div class="li" style="display:block;padding-top:14px;padding-bottom:14px">${inner}</div>`;
    const odds = p.intensityOdds;
    return `<div class="page">
      <div class="head"><h1 class="large-title">Settings</h1></div>
      ${grp('Profile', `
        ${H.li({ title: 'Name', trail: `<input class="input" style="width:180px;height:34px;text-align:right" data-in="pfText" data-k="name" value="${esc(p.name)}" placeholder="Optional" aria-label="Name">` })}
        ${H.li({ title: 'Appearance', trail: H.seg([['light', 'Light'], ['dark', 'Dark'], ['system', 'Auto']], p.theme, 'pfTheme') })}
        ${H.li({ title: 'Units', trail: H.seg([['lb', 'lb'], ['kg', 'kg']], p.unit, 'pfSeg', 'unit') })}
        ${H.li({ title: 'Experience', trail: H.seg([['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']], p.experience, 'pfSeg', 'experience') })}`)}
      ${grp('Goals', block(`<textarea class="input" style="min-height:120px;box-shadow:none;padding:0;background:transparent" data-in="pfGoals" aria-label="Goals">${esc(p.goals.join('\n'))}</textarea>`) + block(`<div class="label" style="margin-bottom:10px">Emphasis in exercise selection</div>${H.chipGroup({ 'lower-chest': 'Lower chest', 'upper-chest': 'Upper chest', 'arm-size': 'Arm size', 'love-handles': 'Obliques', 'back-friendly': 'Back-friendly', 'shoulder-health': 'Shoulder health' }, p.emphasisTags, 'pfEmph', 'sm')}`), 'One goal per line.')}
      ${grp('Schedule', `
        ${H.li({ title: 'Workouts per week', trail: H.stepper(p.strengthPerWeek, 'pfStep', 'strengthPerWeek', 1, 7) })}
        ${H.li({ title: 'Runs per week', trail: H.stepper(p.runsPerWeek, 'pfStep', 'runsPerWeek', 0, 7) })}
        ${H.li({ title: 'Preferred workout', trail: `<select class="pill-select" data-in="pfSelect" data-k="preferredType" aria-label="Preferred workout">${WT.WORKOUT_TYPES.filter((t) => t.id !== 'custom').map((t) => `<option value="${t.id}" ${p.preferredType === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}</select>` })}
        ${H.li({ title: 'Default exercises', trail: H.stepper(p.defaultCount, 'pfStep', 'defaultCount', 2, 12) })}
        ${H.li({ title: 'Default duration', trail: H.seg([[30, '30'], [45, '45'], [60, '60'], [75, '75'], [90, '90']], p.defaultDuration, 'pfSeg', 'defaultDuration') })}
        ${H.li({ title: 'Supersets', sub: 'Pair non-competing exercises', trail: H.toggle(p.supersets, 'pfToggle', 'data-k="supersets"') })}`)}
      ${grp('Intensity', `
        ${H.li({ title: 'Randomize intensity', sub: 'Assign each exercise independently', trail: H.toggle(p.intensityRandom !== false, 'pfIntRandom') })}
        ${
          p.intensityRandom !== false
            ? block(`${H.oddsBar(odds)}<div class="mt8">${['heavy', 'regular', 'burnout', 'standard'].map((k) => `<div class="odds-row"><span class="int ${k}">${WT.INTENSITY_INFO[k].name}</span><input class="range" type="range" min="0" max="60" step="1" value="${odds[k]}" data-in="pfOdds" data-k="${k}" aria-label="${k} odds"><span class="tnum footnote t2" style="text-align:right" id="odds-${k}">${H.pct(odds, k)}%</span></div>`).join('')}</div>`)
            : `${H.li({ title: '<span class="int heavy">Heavy per workout</span>', trail: H.stepper(p.intensityFixed.heavy, 'pfFixed', 'heavy', 0, 6) })}${H.li({ title: '<span class="int burnout">Burnout per workout</span>', trail: H.stepper(p.intensityFixed.burnout, 'pfFixed', 'burnout', 0, 6) })}`
        }
        ${H.li({ title: 'Allow burnout sets', trail: H.toggle(p.burnouts, 'pfToggle', 'data-k="burnouts"') })}`, p.intensityRandom !== false ? 'Heavy favours compound lifts early in a workout; burnout favours isolation work near the end. Exercises unsuited to a category never receive it. <button class="btn-link" data-act="pfOddsReset">Reset</button>' : 'The rest are regular.', 'intensity')}
      ${grp('Equipment', block(H.chipGroup(WT.EQUIPMENT, p.equipment, 'pfEquip', 'sm')) + `
        ${H.li({ title: 'Lightest dumbbell', trail: num('min', p.dumbbells.min, 2.5, 'dumbbells') })}
        ${H.li({ title: 'Heaviest dumbbell', trail: num('max', p.dumbbells.max, 2.5, 'dumbbells') })}
        ${H.li({ title: 'Dumbbell increment', trail: num('step', p.dumbbells.step, 2.5, 'dumbbells') })}
        ${H.li({ title: '2.5 lb in-between weights', trail: H.toggle(p.dumbbells.microLoad, 'pfMicro') })}
        ${H.li({ title: 'Cable stack increment', trail: num('cableStep', p.cableStep, 1) })}`, 'Weight suggestions only use dumbbells you own.')}
      ${grp('Muscles', block(`<div class="label" style="margin-bottom:10px">Prioritize</div>${H.chipGroup(muscles, p.prioritize, 'pfPrio', 'sm')}`) + block(`<div class="label" style="margin-bottom:10px">Avoid</div>${H.chipGroup(muscles, p.avoidMuscles, 'pfAvoid', 'avoid sm')}`))}
      ${grp('Restrictions', Object.entries(WT.RESTRICTION_TAGS).map(([k, v]) => H.li({ title: esc(v), trail: H.toggle(p.restrictions.includes(k), 'toggleRestriction', `data-k="${k}"`) })).join('') + H.li({ act: 'openExcluded', title: 'Excluded exercises', trail: `<span class="footnote t2">${p.excluded.length}</span>`, chev: true }))}
      ${grp('Rest timer', `
        ${H.li({ title: '<span class="int heavy">Heavy</span>', trail: num('heavy', p.rest.heavy, 5, 'rest') })}
        ${H.li({ title: '<span class="int regular">Regular</span>', trail: num('regular', p.rest.regular, 5, 'rest') })}
        ${H.li({ title: '<span class="int burnout">Burnout</span>', trail: num('burnout', p.rest.burnout, 5, 'rest') })}
        ${H.li({ title: 'After a superset', trail: num('superset', p.rest.superset, 5, 'rest') })}
        ${H.li({ title: 'Sound and vibration', trail: H.toggle(p.timerSound, 'pfToggle', 'data-k="timerSound"') })}`, 'In seconds.')}
      ${grp('Data', `
        ${H.li({ act: 'exportJson', title: 'Export backup', sub: `Last backup: ${p.lastBackup ? WT.fmtRelDay(p.lastBackup) : 'never'}`, trail: `<span class="t3">${I('download', 16)}</span>` })}
        <label class="li" style="cursor:pointer"><div class="grow"><div class="ti">Import or restore</div><div class="su">From a Forge JSON backup</div></div><span class="t3">${I('upload', 16)}</span><input type="file" accept="application/json,.json" data-in="importFile" hidden></label>
        ${H.li({ act: 'resetAll', title: 'Erase all data', cls: 'danger' })}`, `<span id="storageInfo">${plural(WT.db.history.length, 'workout')} stored on this device. No account, no server.</span>`)}
      ${grp('About', `
        ${(() => {
          const M = WT.MEDIA, n = M.counts(), S = M.sources, total = Object.keys(M.map).length;
          const notes = { ek: 'Adapted: minified, cropped and animated.', wg: 'Some frames adapted from Everkinetic. Adapted: cropped, resized and animated.', oei: 'AI-generated; each frame reviewed before use. Adapted: resized and animated.', rdb: 'Exercise data by <a class="btn-link" href="https://repdb.co" target="_blank" rel="noopener">RepDB (repdb.co)</a>. AI-generated; each frame reviewed before use. Adapted: resized and animated. Used in-app under the free tier.' };
          const lic = (s) => `<a class="btn-link footnote" href="${s.licenseUrl}" target="_blank" rel="noopener">License</a>`;
          return H.li({ title: 'Exercise illustrations', sub: `${total} of ${WT.BUILTIN_EXERCISES.length} built-in exercises have a verified demonstration. The rest show a placeholder.` }) +
            ['ek', 'wg', 'oei', 'rdb'].map((k) => H.li({ title: `<a class="btn-link" href="${S[k].url}" target="_blank" rel="noopener">${S[k].name}</a>`, sub: `${S[k].by} · ${S[k].license} · ${n[k] || 0} exercises. ${notes[k]}`, trail: lic(S[k]) })).join('');
        })()}
        ${H.li({ title: 'Typeface', sub: 'Inter by Rasmus Andersson · SIL Open Font License' })}
        ${H.li({ title: 'Demonstrations while training', trail: H.toggle(p.trainDemos !== false, 'pfToggleDemos') })}`)}
      ${grp('Install on iPhone', block(`<p class="t2" style="line-height:1.6">Open the site in Safari, tap Share, then <span class="strong" style="color:var(--text)">Add to Home Screen</span>. It runs full-screen and works offline. The home-screen app keeps its own storage, so export a backup before switching.</p>`))}
    </div>`;
  };
  V.settingsAfter = async function () {
    const el = document.getElementById('storageInfo');
    if (el && navigator.storage && navigator.storage.persisted) {
      try {
        if (await navigator.storage.persisted()) el.textContent += ' Persistent storage is on.';
      } catch (e) {}
    }
  };
  const P = () => WT.db.profile;
  WT.I.pfText = (el) => {
    P()[el.dataset.k] = el.value;
    WT.save();
  };
  WT.I.pfSelect = (el, ev) => {
    if (ev.type !== 'change') return;
    P()[el.dataset.k] = el.value;
    WT.save();
    WT.ui.gen = null;
  };
  WT.I.pfGoals = (el) => {
    P().goals = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
    WT.save();
  };
  WT.I.pfNum = (el, ev) => {
    if (ev.type !== 'change') return;
    const v = parseFloat(el.value);
    if (isNaN(v) || v < 0) return;
    if (el.dataset.sub) P()[el.dataset.sub][el.dataset.k] = v;
    else P()[el.dataset.k] = v;
    const d = P().dumbbells;
    if (d.max < d.min) d.max = d.min;
    if (!(d.step > 0)) d.step = 5;
    WT.save();
    WT.rerender();
  };
  WT.I.pfOdds = (el, ev) => {
    const odds = P().intensityOdds;
    odds[el.dataset.k] = +el.value;
    WT.save();
    WT.ui.gen = null;
    ['heavy', 'regular', 'burnout', 'standard'].forEach((k) => {
      const o = document.getElementById('odds-' + k);
      if (o) o.textContent = WT.h.pct(odds, k) + '%';
    });
    const bar = document.querySelector('#intensity .oddsbar');
    if (bar) bar.outerHTML = WT.h.oddsBar(odds);
    if (ev.type === 'change' && Object.values(odds).every((v) => !v)) {
      odds.standard = 10;
      WT.rerender();
    }
  };
  A.pfOddsReset = () => {
    P().intensityOdds = Object.assign({}, WT.defaultProfile().intensityOdds);
    WT.save();
    WT.rerender();
  };
  A.pfIntRandom = () => {
    P().intensityRandom = P().intensityRandom === false;
    WT.save();
    WT.ui.gen = null;
    WT.rerender();
  };
  A.pfFixed = (d) => {
    P().intensityFixed[d.k] = WT.clamp((+P().intensityFixed[d.k] || 0) + +d.d, +d.min, +d.max);
    WT.save();
    WT.ui.gen = null;
    WT.rerender();
  };
  A.pfTheme = (d) => {
    P().theme = d.v;
    WT.applyTheme();
    WT.save();
    WT.rerender();
  };
  A.pfSeg = (d) => {
    P()[d.k] = isNaN(+d.v) ? d.v : +d.v;
    WT.save();
    WT.ui.gen = null;
    WT.rerender();
  };
  A.pfStep = (d) => {
    P()[d.k] = WT.clamp((+P()[d.k] || 0) + +d.d, +d.min, +d.max);
    WT.save();
    WT.ui.gen = null;
    WT.rerender();
  };
  A.pfToggle = (d) => {
    P()[d.k] = !P()[d.k];
    WT.save();
    WT.ui.gen = null;
    WT.rerender();
  };
  A.pfToggleDemos = () => {
    P().trainDemos = P().trainDemos === false;
    WT.save();
    WT.rerender();
  };
  A.pfMicro = () => {
    P().dumbbells.microLoad = !P().dumbbells.microLoad;
    WT.save();
    WT.rerender();
  };
  const chipPf = (key) => (d) => {
    P()[key] = toggleIn(P()[key], d.k);
    WT.save();
    WT.ui.gen = null;
    WT.rerender();
  };
  A.pfEquip = chipPf('equipment');
  A.pfPrio = chipPf('prioritize');
  A.pfAvoid = chipPf('avoidMuscles');
  A.pfEmph = chipPf('emphasisTags');

  A.exportJson = () => {
    P().lastBackup = new Date().toISOString();
    WT.save(true);
    const blob = new Blob([WT.exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `forge-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
    WT.toast('Backup exported');
    WT.rerender();
  };
  WT.I.importFile = (el, ev) => {
    if (ev.type !== 'change' || !el.files[0]) return;
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try {
        data = WT.validateImport(reader.result);
      } catch (e) {
        el.value = '';
        return WT.toast(e.message.includes('JSON') ? 'That file isn’t valid JSON' : e.message, 'error');
      }
      const text = reader.result;
      el.value = '';
      WT.openSheet(() => ({
        title: 'Restore backup',
        body: `<p class="t2">This backup contains ${plural(data.history.length, 'workout')} and ${plural((data.customExercises || []).length, 'custom exercise')}.</p>
          <div class="list inset mt16">
            ${H.li({ act: 'doImport', attrs: 'data-mode="merge"', title: 'Merge', sub: 'Add workouts that aren’t here yet. Keeps your settings.' })}
            ${H.li({ act: 'doImport', attrs: 'data-mode="replace"', title: 'Replace everything', sub: 'Restore exactly as backed up.', cls: 'danger' })}
          </div>`,
      }));
      A.doImport = (d) => {
        try {
          WT.importData(text, d.mode);
          WT.applyTheme();
          WT.ui.gen = null;
          WT.closeSheet(true);
          WT.rerender();
          WT.toast(d.mode === 'merge' ? 'Backup merged' : 'Backup restored');
        } catch (e) {
          WT.toast(e.message, 'error');
        }
      };
    };
    reader.readAsText(el.files[0]);
  };
  A.resetAll = () =>
    WT.confirm('Erase all data?', 'This permanently deletes your history, custom exercises and settings from this device.', 'Erase everything', () => {
      WT.resetAll();
      WT.applyTheme();
      WT.ui.gen = null;
      WT.go('dashboard');
    }, true);
})();
