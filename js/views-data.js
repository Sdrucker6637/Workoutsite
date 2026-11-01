/* Views: Library, Exercise detail/edit, History, Progress, Settings. */
(function () {
  const WT = globalThis.WT;
  const I = WT.icon, esc = WT.esc, H = WT.h, A = WT.A, V = WT.V;
  const toggleIn = (arr, k) => (arr.includes(k) ? arr.filter((x) => x !== k) : arr.concat(k));

  /* ═════════════════════ LIBRARY ═════════════════════ */
  function libFiltered() {
    const f = WT.ui.lib;
    const q = f.q.trim().toLowerCase();
    const p = WT.db.profile;
    return WT.exercises
      .filter((ex) => {
        if (q && !(ex.name.toLowerCase().includes(q) || WT.muscleName(ex.primary).toLowerCase().includes(q) || ex.secondary.some((m) => WT.muscleName(m).toLowerCase().includes(q)))) return false;
        if (f.group && WT.MUSCLES[ex.primary].group !== f.group && ex.primary !== f.group) return false;
        if (f.equip && !ex.equipment.includes(f.equip)) return false;
        if (f.cat && ex.category !== f.cat) return false;
        if (f.diff && ex.difficulty !== f.diff) return false;
        if (f.intensity && !ex.intensities.includes(f.intensity)) return false;
        if (f.avail === 'mine' && (!WT.hasEquipment(ex) || WT.isRestricted(ex))) return false;
        if (f.avail === 'excluded' && !(p.excluded.includes(ex.id) || WT.isRestricted(ex))) return false;
        if (f.avail === 'custom' && !ex.custom) return false;
        if (f.fav && !p.favorites.includes(ex.id)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  function libRows(list) {
    const p = WT.db.profile;
    if (!list.length) return `<div class="empty">No exercises match these filters.</div>`;
    return list
      .map((ex) => {
        const fav = p.favorites.includes(ex.id);
        const excl = p.excluded.includes(ex.id) || WT.isRestricted(ex);
        const noEq = !WT.hasEquipment(ex);
        return `<div class="list-row lib-row" style="padding:10px 10px 10px 16px">
          <button class="grow" style="min-width:0;text-align:left" data-act="exDetail" data-id="${ex.id}">
            <div class="title ellipsis">${esc(ex.name)}${ex.custom ? ' <span class="badge accent" style="vertical-align:1px">Custom</span>' : ''}</div>
            <div class="meta ellipsis">${H.muscles(ex)} · ${ex.equipment.map((q) => WT.EQUIPMENT[q]).join(', ')}</div>
            <div class="row mt8" style="gap:5px;flex-wrap:wrap">${ex.intensities.map((i) => `<span class="badge ${i}" style="height:19px;font-size:10.5px">${WT.cap(i)}</span>`).join('')}<span class="badge" style="height:19px;font-size:10.5px">${WT.cap(ex.difficulty)}</span>${excl ? `<span class="badge" style="height:19px;font-size:10.5px;color:var(--danger)">Excluded</span>` : ''}${noEq ? `<span class="badge" style="height:19px;font-size:10.5px">No equipment</span>` : ''}</div>
          </button>
          <button class="icon-btn ${fav ? 'on' : ''}" data-act="favToggle" data-id="${ex.id}" aria-label="Favorite" style="${fav ? 'color:var(--warn)' : ''}">${I('star', 19).replace('fill="none"', fav ? 'fill="currentColor"' : 'fill="none"')}</button>
        </div>`;
      })
      .join('');
  }
  V.library = function () {
    const f = WT.ui.lib;
    const list = libFiltered();
    const sel = (key, label, opts) => `<select class="input" data-in="libFilter" data-k="${key}" aria-label="${label}"><option value="">${label}</option>${opts.map(([v, l]) => `<option value="${v}" ${f[key] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const groupOpts = Object.entries(WT.GROUPS).map(([k, v]) => [k, v]).concat(Object.entries(WT.MUSCLES).filter(([k]) => k !== 'cardio').map(([k, v]) => [k, '— ' + v.name]));
    return `<div class="page-head"><div><h1>Exercise Library</h1><div class="sub">${WT.exercises.length} exercises · tap any exercise for instructions and video.</div></div>
        <button class="btn btn-primary" data-act="exEdit">${I('plus', 18)}Custom exercise</button></div>
      <div class="search"><span>${I('search', 17)}</span><input class="input" style="height:46px" placeholder="Search by name or muscle" value="${esc(f.q)}" data-in="libSearch" autocomplete="off" id="libSearch"></div>
      <div class="lib-filters mt12">
        ${sel('group', 'All muscles', groupOpts)}
        ${sel('equip', 'All equipment', Object.entries(WT.EQUIPMENT))}
        ${sel('cat', 'All types', [['compound', 'Compound'], ['isolation', 'Isolation'], ['cardio', 'Cardio / conditioning']])}
        ${sel('diff', 'Any difficulty', [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']])}
        ${sel('intensity', 'Any intensity', [['heavy', 'Heavy'], ['regular', 'Regular'], ['burnout', 'Burnout']])}
      </div>
      <div class="row between wrap" style="margin-bottom:12px;gap:10px">
        ${H.seg([['mine', 'Available to me'], ['all', 'All'], ['excluded', 'Excluded'], ['custom', 'Custom']], f.avail, 'libAvail')}
        <button class="chip sm ${f.fav ? 'on' : ''}" data-act="libFav">${I('star', 14)}Favorites</button>
      </div>
      <div class="small muted" id="libCount" style="margin-bottom:8px">${list.length} exercise${list.length === 1 ? '' : 's'}</div>
      <div class="card flush"><div class="list" id="libList">${libRows(list)}</div></div>`;
  };
  WT.I.libSearch = (el, ev) => {
    if (ev.type !== 'input') return;
    WT.ui.lib.q = el.value;
    const list = libFiltered();
    document.getElementById('libList').innerHTML = libRows(list);
    document.getElementById('libCount').textContent = `${list.length} exercise${list.length === 1 ? '' : 's'}`;
  };
  WT.I.libFilter = (el, ev) => {
    if (ev.type !== 'change') return;
    WT.ui.lib[el.dataset.k] = el.value;
    WT.rerender();
  };
  A.libAvail = (d) => {
    WT.ui.lib.avail = d.v;
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
    if (WT.ui.route === 'library') {
      const list = libFiltered();
      document.getElementById('libList').innerHTML = libRows(list);
    }
    WT.refreshSheet();
  };

  /* ═════════════════════ EXERCISE DETAIL ═════════════════════ */
  A.exDetail = (d) => {
    const id = d.id;
    WT.openSheet(
      () => {
        const ex = WT.ex(id);
        if (!ex) return { title: 'Not found', body: '' };
        const p = WT.db.profile;
        const fav = p.favorites.includes(id);
        const excl = p.excluded.includes(id);
        const restricted = WT.isRestricted(ex);
        const vid = WT.youtubeId(ex.video);
        const hist = WT.exerciseHistory(id);
        const pr = WT.personalRecords(id);
        const tt = WT.trackType(ex);
        const u = p.unit;
        const rec = hist.length ? WT.recommend(id) : null;
        const video = vid
          ? `<div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${vid}?rel=0&modestbranding=1&playsinline=1" title="${esc(ex.name)} tutorial" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>
             <div class="row mt8" style="gap:8px"><a class="btn btn-ghost btn-sm" href="https://www.youtube.com/watch?v=${vid}" target="_blank" rel="noopener">${I('ext', 15)}Open on YouTube</a><a class="btn btn-ghost btn-sm" href="${WT.videoUrl(Object.assign({}, ex, { video: null }))}" target="_blank" rel="noopener">${I('search', 15)}Other tutorials</a></div>`
          : `<a class="video-cta" href="${esc(WT.videoUrl(ex))}" target="_blank" rel="noopener"><div class="yt">${I('play', 20).replace('fill="none"', 'fill="currentColor"')}</div><div class="grow"><div class="strong">Watch form tutorials on YouTube</div><div class="small muted">${ex.video ? 'Opens your saved link' : 'Opens a YouTube search for this exercise'}</div></div>${I('ext', 18, 'faint')}</a>
             <form class="row mt8" data-act="noop" onsubmit="return false"><input class="input" id="vidUrl" placeholder="Paste a YouTube link to embed it here" style="height:38px;font-size:14px"><button class="btn btn-secondary btn-sm" data-act="saveVideo" data-id="${id}" style="height:38px">Save</button></form>`;
        const stats = hist.length
          ? `<div class="label mt24">Your performance</div>
             <div class="grid g3 mt8" style="grid-template-columns:repeat(3,1fr);gap:8px">
               ${tt === 'cardio' ? `<div class="kv" style="grid-template-columns:1fr"><div><div class="k">Sessions</div><div class="v">${hist.length}</div></div></div>` : `
               <div class="kv" style="grid-template-columns:1fr"><div><div class="k">${pr.heaviest ? 'Heaviest' : 'Best'}</div><div class="v num">${pr.heaviest ? `${WT.fmtNum(pr.heaviest.w)} × ${pr.heaviest.r}` : pr.reps ? pr.reps.r + (tt === 'time' ? 's' : ' reps') : '—'}</div></div></div>
               <div class="kv" style="grid-template-columns:1fr"><div><div class="k">Est. 1RM</div><div class="v num">${pr.e1rm ? WT.fmtNum(Math.round(pr.e1rm.v)) + ' ' + u : '—'}</div></div></div>
               <div class="kv" style="grid-template-columns:1fr"><div><div class="k">Sessions</div><div class="v num">${hist.length}</div></div></div>`}
             </div>
             ${hist.length > 1 && tt !== 'cardio' ? `<div id="exChart" class="mt12"></div>` : ''}
             ${rec ? `<div class="rec ${rec.action} mt12" style="margin-left:0;margin-right:0"><div class="ic">${I(rec.action === 'increase' || rec.action === 'progress' ? 'trendUp' : rec.action === 'decrease' ? 'trendDown' : 'equal', 16)}</div><div><div class="h">Next time: ${esc(rec.headline)}</div><p class="small muted" style="margin-top:4px">${esc(rec.reasons.join(' '))}</p></div></div>` : ''}
             <table class="hist-table mt12"><thead><tr><th>Date</th><th>Sets</th></tr></thead><tbody>${hist
               .slice(-6)
               .reverse()
               .map((h) => `<tr><td class="nowrap" style="white-space:nowrap">${WT.fmtDate(h.date, { month: 'short', day: 'numeric' })}</td><td class="num">${WT.fmtSets(h.sets, tt, ex)}</td></tr>`)
               .join('')}</tbody></table>`
          : `<div class="notes-box mt24">${I('info', 16)}<span>No history yet. Once you log this exercise, you'll see previous weights, PRs, a progress chart and recommendations here.</span></div>`;
        return {
          title: esc(ex.name),
          headExtra: `<button class="icon-btn" data-act="favToggle" data-id="${id}" style="${fav ? 'color:var(--warn)' : ''}" aria-label="Favorite">${I('star', 20).replace('fill="none"', fav ? 'fill="currentColor"' : 'fill="none"')}</button>`,
          body: `${video}
            ${ex.cue ? `<div class="notes-box mt16">${I('info', 16)}<span>${esc(ex.cue)}</span></div>` : ''}
            <div class="kv mt16">
              <div><div class="k">Primary</div><div class="v">${WT.muscleName(ex.primary)}</div></div>
              <div><div class="k">Secondary</div><div class="v">${ex.secondary.map(WT.muscleName).join(', ') || '—'}</div></div>
              <div><div class="k">Equipment</div><div class="v">${ex.equipment.map((q) => WT.EQUIPMENT[q]).join(', ')}</div></div>
              <div><div class="k">Category</div><div class="v">${WT.cap(ex.category)} · ${WT.PATTERNS[ex.pattern] || ex.pattern}</div></div>
              <div><div class="k">Recommended</div><div class="v num">${ex.sets} × ${ex.repMin}–${ex.repMax}${tt === 'time' || ex.unit === 'sec' ? 's' : tt === 'cardio' ? ' min' : ''}</div></div>
              <div><div class="k">Rest</div><div class="v num">${ex.rest ? WT.fmtClock(ex.rest) : '—'}</div></div>
              <div><div class="k">Difficulty</div><div class="v">${WT.cap(ex.difficulty)}</div></div>
              <div><div class="k">Intensity</div><div class="v row" style="gap:4px;flex-wrap:wrap">${ex.intensities.map((i) => `<span class="badge ${i}">${WT.cap(i)}</span>`).join('')}</div></div>
            </div>
            ${restricted ? `<div class="notes-box mt12" style="color:var(--danger)">${I('ban', 16)}<span>Blocked by your movement restrictions (Settings).</span></div>` : ''}
            ${stats}`,
          foot: `<button class="btn btn-secondary" data-act="exEdit" data-id="${id}">${I('edit', 16)}Edit</button>
            <button class="btn ${excl ? 'btn-secondary' : 'btn-danger'}" data-act="exExclude" data-id="${id}">${I('ban', 16)}${excl ? 'Include' : 'Exclude'}</button>
            <div class="grow"></div>
            ${WT.db.active ? `<button class="btn btn-primary" data-act="exAddTo" data-id="${id}" data-ctx="active">${I('plus', 16)}<span class="hide-m">Add to workout</span><span class="hide-d">Add</span></button>` : WT.db.draft ? `<button class="btn btn-primary" data-act="exAddTo" data-id="${id}" data-ctx="draft">${I('plus', 16)}<span class="hide-m">Add to draft</span><span class="hide-d">Add</span></button>` : ''}`,
          after: (sheet) => {
            const el = sheet.querySelector('#exChart');
            if (el) {
              const pts = hist.map((h) => ({ x: h.date, y: h.metrics.e1rm || h.metrics.bestReps, tip: `<b>${WT.fmtSets(h.sets, tt, ex)}</b><br><span class="faint">${WT.fmtDate(h.date)}</span>` }));
              WT.lineChart(el, pts, { height: 160 });
              el.insertAdjacentHTML('afterbegin', `<div class="tiny faint" style="margin-bottom:4px">${hist[0].metrics.e1rm ? 'Estimated 1-rep max' : 'Best reps'} over time</div>`);
            }
          },
        };
      },
      { wide: true }
    );
  };
  A.noop = () => {};
  A.saveVideo = (d) => {
    const url = document.getElementById('vidUrl').value.trim();
    if (!WT.youtubeId(url)) return WT.toast('That doesn’t look like a YouTube video link', 'error');
    setOverride(d.id, { video: url });
    WT.toast('Video saved', 'good');
    WT.refreshSheet();
  };
  function setOverride(id, patch) {
    const ex = WT.ex(id);
    if (ex.custom) {
      const c = WT.db.customExercises.find((e) => e.id === id);
      Object.assign(c, patch);
    } else WT.db.overrides[id] = Object.assign({}, WT.db.overrides[id] || {}, patch);
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
    if (d.ctx === 'active') WT.db.active.exercises.push(WT.sessionItem(ex.id));
    else {
      const pr = WT.prescribe(ex, ex.intensity);
      WT.db.draft.exercises.push(Object.assign({ uid: WT.uid(), exId: ex.id, slot: { label: WT.muscleName(ex.primary), m: [ex.primary], p: null }, slotIndex: 99, why: ['Added manually'], locked: true }, pr));
      WT.db.draft.estimatedMin = WT.estimateMinutes(WT.db.draft.exercises);
    }
    WT.save();
    WT.closeSheet(true);
    WT.toast(`Added ${ex.name}`, 'good');
    WT.go(d.ctx === 'active' ? 'workout' : 'generate');
  };

  /* Edit / create exercise */
  A.exEdit = (d) => {
    const id = d.id;
    const base = id ? WT.ex(id) : null;
    const form = base
      ? JSON.parse(JSON.stringify(base))
      : { name: '', primary: 'chest', secondary: [], equipment: ['db'], category: 'isolation', pattern: 'fly', difficulty: 'beginner', intensities: ['regular'], repMin: 8, repMax: 12, rest: 60, load: 'db', tags: [], video: '', cue: '', sets: 3 };
    WT.openSheet(
      () => {
        const muscles = Object.fromEntries(Object.entries(WT.MUSCLES).map(([k, v]) => [k, v.name]));
        const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');
        return {
          title: base ? 'Edit exercise' : 'New exercise',
          body: `<div class="col" style="gap:14px">
            <div class="field"><label>Name</label><input class="input" data-in="exf" data-k="name" value="${esc(form.name)}" placeholder="e.g. Landmine Press"></div>
            <div class="grid g2" style="gap:12px">
              <div class="field"><label>Primary muscle</label><select class="input" data-in="exf" data-k="primary">${opt(muscles, form.primary)}</select></div>
              <div class="field"><label>Movement pattern</label><select class="input" data-in="exf" data-k="pattern">${opt(WT.PATTERNS, form.pattern)}</select></div>
              <div class="field"><label>Category</label><select class="input" data-in="exf" data-k="category">${opt({ compound: 'Compound', isolation: 'Isolation', cardio: 'Cardio / conditioning' }, form.category)}</select></div>
              <div class="field"><label>Difficulty</label><select class="input" data-in="exf" data-k="difficulty">${opt({ beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }, form.difficulty)}</select></div>
              <div class="field"><label>Tracking / load</label><select class="input" data-in="exf" data-k="load">${opt({ db: 'Dumbbell (weight × reps)', cable: 'Cable (weight × reps)', machine: 'Machine (weight × reps)', bb: 'Barbell (weight × reps)', mb: 'Medicine ball', kb: 'Kettlebell', bwl: 'Bodyweight (+ optional load)', bw: 'Bodyweight reps', time: 'Timed hold (seconds)', cardio: 'Cardio (minutes + distance)' }, form.load)}</select></div>
              <div class="field"><label>Rest (seconds)</label><input class="input num" type="number" inputmode="numeric" data-in="exf" data-k="rest" value="${form.rest}"></div>
              <div class="field"><label>Rep range — min</label><input class="input num" type="number" inputmode="numeric" data-in="exf" data-k="repMin" value="${form.repMin}"></div>
              <div class="field"><label>Rep range — max</label><input class="input num" type="number" inputmode="numeric" data-in="exf" data-k="repMax" value="${form.repMax}"></div>
            </div>
            <div class="field"><label>Secondary muscles</label>${H.chipGroup(muscles, form.secondary, 'exfSec').replace(/class="chip /g, 'class="chip sm ')}</div>
            <div class="field"><label>Equipment required</label>${H.chipGroup(WT.EQUIPMENT, form.equipment, 'exfEq').replace(/class="chip /g, 'class="chip sm ')}</div>
            <div class="field"><label>Intensity classes</label>${H.chipGroup({ heavy: 'Heavy', regular: 'Regular', burnout: 'Burnout' }, form.intensities, 'exfInt')}</div>
            <div class="field"><label>YouTube video link (optional)</label><input class="input" data-in="exf" data-k="video" value="${esc(form.video || '')}" placeholder="https://www.youtube.com/watch?v=…"></div>
            <div class="field"><label>Instructions / cues</label><textarea class="input" data-in="exf" data-k="cue" placeholder="Setup, cues, things to remember">${esc(form.cue || '')}</textarea></div>
          </div>`,
          foot: `${base && !base.custom && WT.db.overrides[id] ? `<button class="btn btn-ghost" data-act="exfReset">Reset to default</button>` : ''}${base && base.custom ? `<button class="btn btn-danger" data-act="exfDelete">${I('trash', 16)}Delete</button>` : ''}<div class="grow"></div><button class="btn btn-primary" data-act="exfSave">Save</button>`,
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
      if (!form.name.trim()) return WT.toast('Give the exercise a name', 'error');
      if (!form.intensities.length) form.intensities = ['regular'];
      if (!form.equipment.length) form.equipment = ['bw'];
      if (form.video && !WT.youtubeId(form.video)) return WT.toast('Video link must be a YouTube video URL', 'error');
      form.repMin = Math.max(1, form.repMin || 1);
      form.repMax = Math.max(form.repMin, form.repMax || form.repMin);
      form.intensity = form.intensities.includes('regular') ? 'regular' : form.intensities[0];
      form.sets = form.load === 'cardio' ? 1 : form.category === 'compound' && form.intensities.includes('heavy') ? 4 : 3;
      form.secondary = form.secondary.filter((m) => m !== form.primary);
      if (base && !base.custom) {
        const keys = ['name', 'primary', 'secondary', 'equipment', 'category', 'pattern', 'difficulty', 'intensities', 'intensity', 'repMin', 'repMax', 'rest', 'load', 'video', 'cue', 'sets'];
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
      WT.refreshSheet();
      if (WT.ui.route === 'library') WT.rerender();
      WT.toast('Exercise saved', 'good');
    };
    A.exfReset = () => {
      delete WT.db.overrides[id];
      WT.rebuildExercises();
      WT.save();
      WT.closeSheet();
      WT.refreshSheet();
      WT.toast('Reset to default');
    };
    A.exfDelete = () =>
      WT.confirm('Delete exercise?', 'It will be removed from the library. Past workouts that used it keep their logged sets.', 'Delete', () => {
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
      return `<div class="page-head"><div><h1>Workout History</h1><div class="sub">Every completed workout is saved here permanently.</div></div></div>
        <div class="card">${H.empty('clock', 'No workouts logged yet', 'Finish a workout and it will appear here with every set, rep and weight.', `<a class="btn btn-primary" href="#/generate">${I('sparkles', 17)}Generate workout</a>`)}</div>`;
    const byMonth = {};
    ss.forEach((s) => {
      const k = new Date(s.startedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      (byMonth[k] = byMonth[k] || []).push(s);
    });
    const u = WT.db.profile.unit;
    return `<div class="page-head"><div><h1>Workout History</h1><div class="sub">${ss.length} workout${ss.length > 1 ? 's' : ''} logged</div></div></div>
      ${Object.entries(byMonth)
        .map(
          ([m, list]) => `<div class="section-title">${m} <span class="faint">· ${list.length}</span></div>
        <div class="card flush"><div class="list">${list
          .map((s) => {
            const d = new Date(s.startedAt);
            const names = s.exercises.filter((e) => !e.skipped).map((e) => esc(e.name || (WT.ex(e.exId) || {}).name));
            return `<a class="list-row" href="#/history/${s.id}">
              <div class="avatar" style="flex-direction:column;gap:0;line-height:1;width:46px;height:46px"><span class="tiny faint" style="font-size:10px;text-transform:uppercase;font-weight:700">${d.toLocaleDateString(undefined, { weekday: 'short' })}</span><span class="strong num" style="font-size:17px;color:var(--text)">${d.getDate()}</span></div>
              <div class="grow" style="min-width:0"><div class="title row" style="gap:8px">${esc(s.title)}${(s.prs || []).length ? `<span class="badge warn" style="height:19px">${I('trophy', 11)}${s.prs.length}</span>` : ''}</div>
                <div class="meta">${WT.fmtDuration(s.durationSec)} · ${(s.totals && s.totals.sets) || 0} sets${s.totals && s.totals.volume ? ` · ${WT.fmtNum(s.totals.volume)} ${u}` : ''}</div>
                <div class="tiny faint ellipsis mt8">${names.join(' · ')}</div></div>${I('chevR', 18, 'faint')}</a>`;
          })
          .join('')}</div></div>`
        )
        .join('')}`;
  };
  function historyDetail(id) {
    const s = WT.db.history.find((x) => x.id === id);
    if (!s) return `<div class="card">${H.empty('clock', 'Workout not found', 'It may have been deleted.', '<a class="btn btn-secondary" href="#/history">Back to history</a>')}</div>`;
    const u = WT.db.profile.unit;
    const d = new Date(s.startedAt);
    const prIds = new Set((s.prs || []).map((p) => p.exId));
    const ex = s.exercises
      .map((e) => {
        const def = WT.ex(e.exId);
        const tt = def ? WT.trackType(def) : 'weight';
        const sec = tt === 'time' || (def && def.unit === 'sec');
        const rows = (e.sets || [])
          .map((st, i) => {
            const cols = tt === 'cardio' ? `<td class="num">${st.time || '—'} min</td><td class="num">${st.dist ? st.dist + ' mi' : '—'}</td>` : tt === 'time' ? `<td class="num">${st.r}s</td><td></td>` : `<td class="num">${+st.w ? WT.fmtNum(+st.w) + ' ' + u : tt === 'reps' ? 'BW' : '—'}</td><td class="num">${st.r}${sec ? 's' : ''}</td>`;
            return `<tr><td class="faint num">${i + 1}</td>${cols}</tr>`;
          })
          .join('');
        return `<div class="card ${e.skipped ? '' : ''}" style="${e.skipped ? 'opacity:.55' : ''}">
          <div class="row between" style="align-items:flex-start"><div style="min-width:0">
            <button class="ex-title" data-act="exDetail" data-id="${e.exId}">${esc(e.name || (def || {}).name || e.exId)}</button>
            <div class="plan-meta">${e.superset ? `<span class="ss-tag">${e.superset}</span>` : ''}${H.intensity(e.intensity || 'regular')}<span class="num">Target ${e.targetSets || '?'} × ${e.repMin}–${e.repMax}</span>${e.effort ? `<span class="badge">${{ easy: 'Felt easy', good: 'Felt solid', hard: 'Grinding' }[e.effort]}</span>` : ''}${prIds.has(e.exId) ? `<span class="badge warn">${I('trophy', 11)}PR</span>` : ''}${e.skipped ? '<span class="badge">Skipped</span>' : ''}</div></div></div>
          ${rows ? `<table class="hist-table mt12"><thead><tr><th style="width:44px">Set</th><th>${tt === 'cardio' ? 'Time' : tt === 'time' ? 'Hold' : 'Weight'}</th><th>${tt === 'cardio' ? 'Distance' : tt === 'time' ? '' : sec ? 'Time' : 'Reps'}</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
          ${e.notes ? `<div class="notes-box mt12">${I('note', 15)}<span>${esc(e.notes)}</span></div>` : ''}</div>`;
      })
      .join('');
    return `<div class="row" style="margin-bottom:14px"><a class="btn btn-ghost btn-sm" href="#/history" style="padding-left:4px">${I('chevL', 17)}History</a></div>
      <div class="card hero">
        <div class="eyebrow">${d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
        <h2 style="font-size:26px;margin-top:6px">${esc(s.title)}</h2>
        <div class="plan-summary mt16">
          <div><div class="k">Duration</div><div class="v">${WT.fmtDuration(s.durationSec)}</div></div>
          <div><div class="k">Exercises</div><div class="v">${s.exercises.filter((e) => !e.skipped).length}</div></div>
          <div><div class="k">Sets</div><div class="v">${(s.totals && s.totals.sets) || 0}</div></div>
          ${s.totals && s.totals.volume ? `<div><div class="k">Volume</div><div class="v">${WT.fmtNum(s.totals.volume)}<span class="small muted"> ${u}</span></div></div>` : ''}
          ${(s.prs || []).length ? `<div><div class="k">Records</div><div class="v" style="color:var(--warn)">${s.prs.length}</div></div>` : ''}
        </div>
        ${s.notes ? `<div class="notes-box mt16">${I('note', 15)}<span>${esc(s.notes)}</span></div>` : ''}
        <div class="row wrap mt16" style="gap:8px">
          <button class="btn btn-primary" data-act="histRepeat" data-id="${s.id}">${I('play', 16)}Repeat now</button>
          <button class="btn btn-secondary" data-act="histTemplate" data-id="${s.id}">${I('copy', 16)}Use as template</button>
          <button class="btn btn-ghost" data-act="histNotes" data-id="${s.id}">${I('edit', 16)}Notes</button>
          <button class="btn btn-ghost" data-act="histDelete" data-id="${s.id}" style="color:var(--danger)">${I('trash', 16)}Delete</button>
        </div>
      </div>
      ${(s.prs || []).length ? `<div class="card mt16"><div class="card-head"><h3>Personal records</h3></div>${s.prs.map((r) => `<div class="pr-item"><div class="trophy">${I('trophy', 17)}</div><div class="grow"><div class="strong">${esc((WT.ex(r.exId) || {}).name || r.exId)}</div><div class="small muted">${r.kind} · ${esc(r.value)}</div></div></div>`).join('')}</div>` : ''}
      <div class="col mt16" style="gap:12px">${ex}</div>`;
  }
  A.histRepeat = (d) => {
    const s = WT.db.history.find((x) => x.id === d.id);
    const begin = () => {
      WT.db.active = WT.sessionFromWorkout(WT.workoutFromSession(s));
      WT.save(true);
      WT.go('workout');
    };
    if (WT.db.active) WT.confirm('Replace current workout?', 'A workout is in progress. Repeating this one will discard it.', 'Discard & start', begin, true);
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
    WT.toast('Loaded as a draft — swap, add or remove exercises, then start');
  };
  A.histNotes = (d) => {
    const s = WT.db.history.find((x) => x.id === d.id);
    WT.openSheet(() => ({
      title: 'Workout notes',
      body: `<textarea class="input" id="histNotesTa" style="min-height:140px">${esc(s.notes || '')}</textarea>`,
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
  A.histDelete = (d) =>
    WT.confirm('Delete this workout?', 'It will be removed from your history, stats and progression data. Consider exporting a backup first.', 'Delete', () => {
      WT.db.history = WT.db.history.filter((x) => x.id !== d.id);
      WT.save(true);
      WT.go('history');
      WT.toast('Workout deleted');
    }, true);

  /* ═════════════════════ PROGRESS ═════════════════════ */
  V.progress = function () {
    const st = WT.stats();
    const u = WT.db.profile.unit;
    if (!st.count)
      return `<div class="page-head"><div><h1>Progress & Statistics</h1><div class="sub">Calculated only from workouts you've logged.</div></div></div>
        <div class="card">${H.empty('chart', 'No data yet', 'Charts and records appear after your first completed workout. Nothing here is estimated or made up — it all comes from your logged sets.', `<a class="btn btn-primary" href="#/generate">${I('sparkles', 17)}Generate workout</a>`)}</div>`;
    const tracked = WT.trackedExercises().filter((t) => WT.trackType(t.ex) !== 'cardio');
    if (!WT.ui.prog.ex || !tracked.find((t) => t.ex.id === WT.ui.prog.ex)) WT.ui.prog.ex = tracked[0] ? tracked[0].ex.id : null;
    const exId = WT.ui.prog.ex;
    const ex = exId && WT.ex(exId);
    const tt = ex ? WT.trackType(ex) : null;
    const hist = ex ? WT.exerciseHistory(exId) : [];
    const pr = ex ? WT.personalRecords(exId) : null;
    const loaded = hist.some((h) => h.metrics.topWeight > 0);
    const metrics = loaded ? [['e1rm', 'Est. 1RM'], ['top', 'Top weight'], ['volume', 'Volume'], ['reps', 'Best reps']] : [['reps', tt === 'time' ? 'Best hold' : 'Best reps'], ['total', 'Total reps']];
    if (!metrics.find((m) => m[0] === WT.ui.prog.metric)) WT.ui.prog.metric = metrics[0][0];

    const groupRows = Object.entries(st.groupSets)
      .filter(([g]) => g !== 'cardio')
      .map(([g, v]) => {
        const perWeek = v / (30 / 7);
        const target = Object.keys(WT.MUSCLES).filter((m) => WT.MUSCLES[m].group === g).reduce((a, m) => a + WT.weeklyTarget(m), 0);
        return { g, perWeek, target };
      });
    const maxG = Math.max(...groupRows.map((r) => Math.max(r.perWeek, r.target)), 1);

    // Heatmap (20 weeks)
    const weeksN = 20;
    const start = WT.startOfWeek(new Date());
    start.setDate(start.getDate() - (weeksN - 1) * 7);
    const today = WT.startOfDay(new Date());
    let cells = '';
    for (let w = 0; w < weeksN; w++)
      for (let dd = 0; dd < 7; dd++) {
        const day = new Date(start);
        day.setDate(day.getDate() + w * 7 + dd);
        const c = st.days[day.toDateString()] || 0;
        cells += `<i class="${day > today ? 'future' : c >= 2 ? 'l2' : c ? 'l2' : ''}" title="${WT.fmtDate(day)}${c ? ' · ' + c + ' workout' + (c > 1 ? 's' : '') : ''}"></i>`;
      }
    const activeDays = Object.keys(st.days).filter((k) => new Date(k) >= start).length;

    return `<div class="page-head"><div><h1>Progress & Statistics</h1><div class="sub">Calculated only from workouts you've logged.</div></div></div>
      <div class="grid g4">
        <div class="card stat"><div class="eyebrow">Workouts</div><div class="v">${st.count}</div><div class="d">${WT.fmtDuration(st.totalTime)} trained</div></div>
        <div class="card stat"><div class="eyebrow">Per week</div><div class="v">${WT.fmtNum(WT.round(st.avgPerWeek, 1))}</div><div class="d">avg, last ${Math.min(12, Math.max(1, Math.ceil((Date.now() - WT.startOfWeek(WT.sessions()[0].startedAt)) / (7 * 864e5))))} wk</div></div>
        <div class="card stat"><div class="eyebrow">Sets</div><div class="v">${WT.fmtNum(st.totalSets)}</div><div class="d">completed</div></div>
        <div class="card stat"><div class="eyebrow">Volume</div><div class="v">${st.totalVolume >= 100000 ? WT.fmtNum(Math.round(st.totalVolume / 1000)) + '<small>k ' + u + '</small>' : WT.fmtNum(st.totalVolume) + '<small>' + u + '</small>'}</div><div class="d">weight × reps</div></div>
      </div>

      <div class="card mt16">
        <div class="card-head" style="flex-wrap:wrap"><h3>Exercise progression</h3>
          ${tracked.length ? `<select class="input" style="width:auto;max-width:100%;height:38px" data-in="progEx">${tracked.map((t) => `<option value="${t.ex.id}" ${t.ex.id === exId ? 'selected' : ''}>${esc(t.ex.name)} (${t.n})</option>`).join('')}</select>` : ''}</div>
        ${
          ex
            ? `${H.seg(metrics, WT.ui.prog.metric, 'progMetric')}
          <div id="progChart" class="mt16" style="min-height:220px"></div>
          <div class="grid g4 mt16" style="gap:8px">
            ${pr.heaviest ? `<div class="kv" style="grid-template-columns:1fr"><div><div class="k">Heaviest</div><div class="v num">${WT.fmtNum(pr.heaviest.w)} ${u} × ${pr.heaviest.r}</div></div></div>` : ''}
            ${pr.e1rm ? `<div class="kv" style="grid-template-columns:1fr"><div><div class="k">Best est. 1RM</div><div class="v num">${WT.fmtNum(Math.round(pr.e1rm.v))} ${u}</div></div></div>` : ''}
            ${pr.reps ? `<div class="kv" style="grid-template-columns:1fr"><div><div class="k">${tt === 'time' ? 'Longest hold' : 'Most reps'}</div><div class="v num">${pr.reps.r}${tt === 'time' ? 's' : ''}${pr.reps.w ? ' @ ' + WT.fmtNum(pr.reps.w) : ''}</div></div></div>` : ''}
            ${pr.volume ? `<div class="kv" style="grid-template-columns:1fr"><div><div class="k">Best session volume</div><div class="v num">${WT.fmtNum(pr.volume.v)} ${u}</div></div></div>` : ''}
          </div>
          <table class="hist-table mt16"><thead><tr><th>Date</th><th>Sets</th><th class="hide-m">Est. 1RM</th></tr></thead><tbody>${hist
            .slice(-8)
            .reverse()
            .map((h) => `<tr><td style="white-space:nowrap">${WT.fmtDate(h.date, { month: 'short', day: 'numeric' })}</td><td class="num">${WT.fmtSets(h.sets, tt, ex)}</td><td class="num hide-m">${h.metrics.e1rm ? WT.fmtNum(Math.round(h.metrics.e1rm)) : '—'}</td></tr>`)
            .join('')}</tbody></table>`
            : `<p class="small muted">Log a strength exercise to see its progression.</p>`
        }
      </div>

      <div class="grid g2 mt16">
        <div class="card"><div class="card-head"><h3>Workouts per week</h3><span class="tiny faint">last 12 weeks</span></div><div id="weeksChart"></div></div>
        <div class="card"><div class="card-head"><h3>Consistency</h3><span class="tiny faint">${activeDays} active days · 20 weeks</span></div>
          <div class="row" style="gap:8px;align-items:stretch"><div class="col tiny faint" style="gap:0;justify-content:space-between;padding:2px 0"><span>Mon</span><span>Thu</span><span>Sun</span></div><div class="heatmap grow">${cells}</div></div>
          <div class="row tiny faint mt12" style="gap:6px;justify-content:flex-end">Less <i style="width:11px;height:11px;border-radius:3px;background:var(--heat-0);display:inline-block"></i><i style="width:11px;height:11px;border-radius:3px;background:var(--accent);display:inline-block"></i> Workout</div></div>
      </div>

      <div class="grid g2 mt16">
        <div class="card"><div class="card-head"><h3>Muscle group volume</h3><span class="tiny faint">sets / week · last 30 days</span></div>
          ${groupRows.map((r) => `<div class="hbar-row"><span class="strong">${WT.GROUPS[r.g]}</span><div class="hbar-track"><i style="width:${(r.perWeek / maxG) * 100}%"></i><span class="tgt" style="left:${(r.target / maxG) * 100}%" title="Weekly target ${r.target} sets"></span></div><span class="num small muted" style="text-align:right">${WT.fmtNum(WT.round(r.perWeek, 1))}<span class="faint">/${r.target}</span></span></div>`).join('')}
          <p class="tiny faint mt8">Primary muscle = 1 set, secondary = ½. Marker = weekly target (higher for your priority muscles).</p></div>
        <div class="card"><div class="card-head"><h3>Personal records</h3></div>
          ${st.prs.length ? st.prs.slice(0, 8).map((r) => `<div class="pr-item"><div class="trophy">${I('trophy', 17)}</div><div class="grow" style="min-width:0"><div class="strong ellipsis">${esc((WT.ex(r.exId) || {}).name || r.exId)}</div><div class="small muted">${r.kind} · ${esc(r.value)}</div></div><a class="tiny faint" href="#/history/${r.sessionId}">${WT.fmtDate(r.date, { month: 'short', day: 'numeric' })}</a></div>`).join('') : `<p class="small muted">Beat a previous best weight or rep count and it shows up here.</p>`}</div>
      </div>`;
  };
  V.progressAfter = function () {
    const st = WT.stats();
    const wEl = document.getElementById('weeksChart');
    if (wEl)
      WT.barChart(
        wEl,
        st.weeks.map((w, i) => ({ label: i % 2 === 1 || i === 11 ? WT.fmtDate(w.start, { month: 'numeric', day: 'numeric' }) : '', value: w.count, highlight: i === 11, tip: `<b>${w.count} workout${w.count === 1 ? '' : 's'}</b> · week of ${WT.fmtDate(w.start, { month: 'short', day: 'numeric' })}<br><span class="faint">${w.strength} strength · ${w.cardio} cardio · ${w.sets} sets</span>` })),
        { ref: WT.db.profile.strengthPerWeek, refLabel: 'Goal ' + WT.db.profile.strengthPerWeek, height: 200 }
      );
    const pEl = document.getElementById('progChart');
    const exId = WT.ui.prog.ex;
    if (pEl && exId) {
      const ex = WT.ex(exId);
      const tt = WT.trackType(ex);
      const u = WT.db.profile.unit;
      const m = WT.ui.prog.metric;
      const hist = WT.exerciseHistory(exId);
      const val = (h) => ({ e1rm: Math.round(h.metrics.e1rm), top: h.metrics.topWeight, volume: h.metrics.volume, reps: h.metrics.bestReps, total: h.metrics.totalReps }[m]);
      const unit = { e1rm: u, top: u, volume: u, reps: tt === 'time' ? 's' : 'reps', total: 'reps' }[m];
      if (hist.length === 1) pEl.insertAdjacentHTML('beforebegin', '');
      WT.lineChart(
        pEl,
        hist.map((h) => ({ x: h.date, y: val(h), tip: `<b>${WT.fmtNum(val(h))} ${unit}</b> · ${WT.fmtDate(h.date, { month: 'short', day: 'numeric' })}<br><span class="faint">${WT.fmtSets(h.sets, tt, ex)}</span>` })),
        { height: 220 }
      );
      if (hist.length === 1) pEl.insertAdjacentHTML('beforeend', '<p class="tiny faint" style="text-align:center">One session logged — the trend line appears after your next one.</p>');
    }
  };
  WT.I.progEx = (el, ev) => {
    if (ev.type !== 'change') return;
    WT.ui.prog.ex = el.value;
    WT.rerender();
  };
  A.progMetric = (d) => {
    WT.ui.prog.metric = d.v;
    WT.rerender();
  };

  /* ═════════════════════ SETTINGS ═════════════════════ */
  V.settings = function () {
    const p = WT.db.profile;
    const muscles = Object.fromEntries(Object.entries(WT.MUSCLES).filter(([k]) => k !== 'cardio').map(([k, v]) => [k, v.name]));
    const num = (k, v, step, sub) => `<input class="input num" style="width:96px;text-align:center" type="number" inputmode="decimal" step="${step || 1}" data-in="pfNum" data-k="${k}" ${sub ? `data-sub="${sub}"` : ''} value="${v}">`;
    const last = p.lastBackup ? WT.fmtRelDay(p.lastBackup) : 'Never';
    return `<div class="page-head"><div><h1>Settings</h1><div class="sub">Your training profile drives workout generation and recommendations.</div></div></div>
      <div class="grid g2" style="align-items:start">
      <div class="col" style="gap:16px">
        <div class="card"><div class="card-head"><h3>Profile</h3></div>
          <div class="field"><label>Name</label><input class="input" data-in="pfText" data-k="name" value="${esc(p.name)}" placeholder="Optional"></div>
          <div class="setting-row mt8"><div class="t">Appearance</div>${H.seg([['dark', 'Dark'], ['light', 'Light'], ['system', 'Auto']], p.theme, 'pfTheme')}</div>
          <div class="setting-row"><div><div class="t">Units</div><div class="d">Labels only — existing numbers aren't converted</div></div>${H.seg([['lb', 'lb'], ['kg', 'kg']], p.unit, 'pfSeg', 'unit')}</div>
          <div class="setting-row"><div class="t">Experience</div>${H.seg([['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']], p.experience, 'pfSeg', 'experience')}</div>
        </div>
        <div class="card"><div class="card-head"><h3>Goals</h3></div>
          <textarea class="input" style="min-height:130px" data-in="pfGoals">${esc(p.goals.join('\n'))}</textarea><p class="tiny faint mt8">One goal per line. Shown on your dashboard.</p>
          <div class="label mt16">Goal emphasis in exercise selection</div>
          <div class="mt8">${H.chipGroup({ 'lower-chest': 'Lower chest', 'upper-chest': 'Upper chest', 'arm-size': 'Arm size', 'love-handles': 'Obliques / love handles', 'back-friendly': 'Back-friendly', 'shoulder-health': 'Shoulder health' }, p.emphasisTags, 'pfEmph')}</div>
        </div>
        <div class="card"><div class="card-head"><h3>Schedule & generator defaults</h3></div>
          <div class="setting-row"><div class="t">Strength sessions / week</div>${H.stepper(p.strengthPerWeek, 'pfStep', 'strengthPerWeek', 1, 7)}</div>
          <div class="setting-row"><div class="t">Runs / week</div>${H.stepper(p.runsPerWeek, 'pfStep', 'runsPerWeek', 0, 7)}</div>
          <div class="setting-row"><div class="t">Preferred split</div><select class="input" style="width:auto" data-in="pfSelect" data-k="preferredType">${WT.WORKOUT_TYPES.filter((t) => t.id !== 'custom').map((t) => `<option value="${t.id}" ${p.preferredType === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}</select></div>
          <div class="setting-row"><div class="t">Default exercises</div>${H.stepper(p.defaultCount, 'pfStep', 'defaultCount', 2, 12)}</div>
          <div class="setting-row"><div class="t">Default duration</div>${H.seg([[30, '30'], [45, '45'], [60, '60'], [75, '75'], [90, '90']], p.defaultDuration, 'pfSeg', 'defaultDuration')}</div>
          <div class="setting-row"><div><div class="t">Prefer supersets</div><div class="d">Saves time by pairing exercises</div></div>${H.toggle(p.supersets, 'pfToggle', 'data-k="supersets"')}</div>
          <div class="setting-row"><div><div class="t">Include burnout sets</div><div class="d">A high-rep finisher in most workouts</div></div>${H.toggle(p.burnouts, 'pfToggle', 'data-k="burnouts"')}</div>
        </div>
        <div class="card"><div class="card-head"><h3>Rest timer</h3></div>
          <div class="setting-row"><div class="t">Heavy sets</div>${num('heavy', p.rest.heavy, 5, 'rest')}</div>
          <div class="setting-row"><div class="t">Regular sets (baseline)</div>${num('regular', p.rest.regular, 5, 'rest')}</div>
          <div class="setting-row"><div class="t">Burnout sets</div>${num('burnout', p.rest.burnout, 5, 'rest')}</div>
          <div class="setting-row"><div class="t">After a superset pair</div>${num('superset', p.rest.superset, 5, 'rest')}</div>
          <div class="setting-row"><div class="t">Sound & vibration</div>${H.toggle(p.timerSound, 'pfToggle', 'data-k="timerSound"')}</div>
          <p class="tiny faint">Seconds. Applies to newly generated workouts.</p>
        </div>
      </div>
      <div class="col" style="gap:16px">
        <div class="card"><div class="card-head"><h3>Equipment</h3></div>${H.chipGroup(WT.EQUIPMENT, p.equipment, 'pfEquip')}
          <p class="tiny faint mt8">Cable exercises assume standard handles, rope and straight-bar attachments.</p>
          <div class="label mt16">Dumbbells</div>
          <div class="setting-row"><div class="t">Lightest</div>${num('min', p.dumbbells.min, 2.5, 'dumbbells')}</div>
          <div class="setting-row"><div class="t">Heaviest</div>${num('max', p.dumbbells.max, 2.5, 'dumbbells')}</div>
          <div class="setting-row"><div class="t">Increment</div>${num('step', p.dumbbells.step, 2.5, 'dumbbells')}</div>
          <div class="setting-row"><div><div class="t">2.5 lb in-between weights</div><div class="d">e.g. 22.5, 27.5 (adjustable dumbbells)</div></div>${H.toggle(p.dumbbells.microLoad, 'pfMicro')}</div>
          <div class="setting-row"><div class="t">Cable stack increment</div>${num('cableStep', p.cableStep, 1)}</div>
          <p class="tiny faint">Weight recommendations only suggest dumbbells you actually have: ${WT.dumbbellWeights().slice(0, 8).join(', ')}${WT.dumbbellWeights().length > 8 ? ' … ' + WT.dumbbellWeights().slice(-1)[0] : ''}.</p>
        </div>
        <div class="card"><div class="card-head"><h3>Muscle priorities</h3></div>
          <div class="label">Prioritize</div><div class="mt8">${H.chipGroup(muscles, p.prioritize, 'pfPrio')}</div>
          <div class="label mt16">Avoid</div><div class="mt8">${H.chipGroup(muscles, p.avoidMuscles, 'pfAvoid', 'avoid')}</div>
        </div>
        <div class="card"><div class="card-head"><h3>Restrictions & exclusions</h3></div>
          ${Object.entries(WT.RESTRICTION_TAGS).map(([k, v]) => `<div class="setting-row"><div class="t">Avoid ${esc(v.toLowerCase())}</div>${H.toggle(p.restrictions.includes(k), 'toggleRestriction', `data-k="${k}"`)}</div>`).join('')}
          <button class="setting-row" style="width:100%;text-align:left" data-act="openExcluded"><div><div class="t">Excluded exercises</div><div class="d">${p.excluded.length} excluded</div></div>${I('chevR', 18)}</button>
          <div class="setting-row" style="display:block"><div class="t">Favorites</div><div class="d">${p.favorites.map((id) => (WT.ex(id) ? esc(WT.ex(id).name) : '')).filter(Boolean).join(', ') || 'None'} — favorites are preferred by the generator.</div></div>
        </div>
        <div class="card"><div class="card-head"><h3>Data & backup</h3><span class="tiny faint">Last backup: ${last}</span></div>
          <p class="small muted">Everything is stored locally in this browser — no account, no server. Export a backup regularly, especially before clearing browser data.</p>
          <div class="row wrap mt16" style="gap:8px">
            <button class="btn btn-primary" data-act="exportJson">${I('download', 17)}Export backup</button>
            <label class="btn btn-secondary" style="cursor:pointer">${I('upload', 17)}Import / restore<input type="file" accept="application/json,.json" data-in="importFile" hidden></label>
          </div>
          <div class="small muted mt16" id="storageInfo">${WT.db.history.length} workouts · ${WT.db.customExercises.length} custom exercises</div>
          <div class="divider"></div>
          <button class="btn btn-danger btn-sm" data-act="resetAll">${I('trash', 15)}Erase all data</button>
        </div>
        <div class="card"><div class="card-head"><h3>Install on iPhone</h3>${I('phone', 18, 'faint')}</div>
          <ol class="small muted" style="margin:0;padding-left:18px;line-height:1.7">
            <li>Open this site in <b>Safari</b> (must be served over HTTPS, e.g. GitHub Pages).</li>
            <li>Tap the <b>Share</b> button, then <b>Add to Home Screen</b>.</li>
            <li>Launch it from your home screen — it runs full-screen and works offline.</li></ol>
          <p class="tiny faint mt8">Installed apps keep their own storage — export a backup before switching between Safari and the home-screen app.</p>
        </div>
      </div></div>`;
  };
  V.settingsAfter = async function () {
    const el = document.getElementById('storageInfo');
    if (el && navigator.storage && navigator.storage.estimate) {
      try {
        const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
        const bytes = new Blob([localStorage.getItem('wt.data.v1') || '']).size;
        el.innerHTML = `${WT.db.history.length} workouts · ${WT.db.customExercises.length} custom exercises · ${(bytes / 1024).toFixed(1)} KB used${persisted ? ' · <span style="color:var(--good)">persistent storage granted</span>' : ''}`;
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
    WT.toast('Backup exported', 'good');
    WT.rerender();
  };
  WT.I.importFile = (el, ev) => {
    if (ev.type !== 'change' || !el.files[0]) return;
    const file = el.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try {
        data = WT.validateImport(reader.result);
      } catch (e) {
        el.value = '';
        return WT.toast(e.message.includes('JSON') ? 'Invalid JSON file' : e.message, 'error');
      }
      const text = reader.result;
      el.value = '';
      WT.openSheet(() => ({
        title: 'Restore backup',
        body: `<p class="muted">This backup contains <b>${data.history.length}</b> workouts and <b>${(data.customExercises || []).length}</b> custom exercises.</p>
          <div class="card flush mt16"><div class="list">
            <button class="list-row" data-act="doImport" data-mode="merge"><div class="avatar accent">${I('copy', 18)}</div><div class="grow"><div class="title">Merge</div><div class="meta">Add workouts not already here. Keeps your current settings.</div></div></button>
            <button class="list-row" data-act="doImport" data-mode="replace"><div class="avatar" style="color:var(--danger)">${I('refresh', 18)}</div><div class="grow"><div class="title">Replace everything</div><div class="meta">Restore exactly as backed up. Current data is overwritten.</div></div></button>
          </div></div>`,
      }));
      A.doImport = (d) => {
        try {
          WT.importData(text, d.mode);
          WT.applyTheme();
          WT.ui.gen = null;
          WT.closeSheet(true);
          WT.rerender();
          WT.toast(d.mode === 'merge' ? 'Backup merged' : 'Backup restored', 'good');
        } catch (e) {
          WT.toast(e.message, 'error');
        }
      };
    };
    reader.readAsText(file);
  };
  A.resetAll = () =>
    WT.confirm('Erase all data?', 'This permanently deletes your workout history, custom exercises and settings from this device. Export a backup first if you might want it back.', 'Erase everything', () => {
      WT.resetAll();
      WT.applyTheme();
      WT.ui.gen = null;
      WT.go('dashboard');
      WT.toast('All data erased');
    }, true);
})();
