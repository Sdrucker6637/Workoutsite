/* Views: Library (catalog), exercise detail/edit, Log (history), Progress, Settings. */
(function () {
  const WT = globalThis.WT;
  const I = WT.icon, esc = WT.esc, H = WT.h, A = WT.A, V = WT.V;
  const toggleIn = (arr, k) => (arr.includes(k) ? arr.filter((x) => x !== k) : arr.concat(k));

  /* ═════════════════════ LIBRARY ═════════════════════ */
  function matchesGroup(ex, g) {
    if (!g) return true;
    if (WT.GROUPS[g]) return WT.MUSCLES[ex.primary].group === g;
    return ex.primary === g;
  }
  function libFiltered(ignoreGroup) {
    const f = WT.ui.lib;
    const q = f.q.trim().toLowerCase();
    const p = WT.db.profile;
    return WT.exercises
      .filter((ex) => {
        if (q && !(ex.name.toLowerCase().includes(q) || WT.muscleName(ex.primary).toLowerCase().includes(q) || ex.secondary.some((m) => WT.muscleName(m).toLowerCase().includes(q)))) return false;
        if (!ignoreGroup && !matchesGroup(ex, f.group)) return false;
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
  const starSvg = (on) => I('star', 19).replace('fill="none"', on ? 'fill="currentColor"' : 'fill="none"');
  function catalog(list) {
    const p = WT.db.profile;
    if (!list.length) return `<div class="empty"><h3>No entries.</h3><p>Nothing matches these filters. Try clearing the search or switching to “All”.</p></div>`;
    const byLetter = {};
    list.forEach((ex) => (byLetter[ex.name[0].toUpperCase()] = byLetter[ex.name[0].toUpperCase()] || []).push(ex));
    return Object.entries(byLetter)
      .map(
        ([L, exs]) => `<div class="letter-block"><div class="letter" aria-hidden="true">${L}</div><div>${exs
          .map((ex) => {
            const fav = p.favorites.includes(ex.id);
            const excl = p.excluded.includes(ex.id) || WT.isRestricted(ex);
            const noEq = !WT.hasEquipment(ex);
            const special = ex.intensities.filter((k) => k === 'heavy' || k === 'burnout');
            return `<div class="cat-item">
              <button class="cat-main" data-act="exDetail" data-id="${ex.id}" style="min-width:0;text-align:left">
                <div class="cat-name">${esc(ex.name)}</div>
                <div class="cat-sub">${H.muscles(ex)} — ${ex.equipment.map((q) => WT.EQUIPMENT[q]).join(', ')}</div>
              </button>
              <div class="cat-flags">${special.map((k) => `<span class="imark ${k} hide-m" title="Eligible for ${k}">${k === 'heavy' ? 'H' : 'B'}</span>`).join('')}${excl ? `<span class="flag bad">Excluded</span>` : noEq ? `<span class="flag">No equip.</span>` : ''}${ex.custom ? `<span class="flag" style="color:var(--forest)">Yours</span>` : ''}</div>
              <button class="icon-btn star ${fav ? 'on' : ''}" data-act="favToggle" data-id="${ex.id}" aria-pressed="${fav}" aria-label="${fav ? 'Remove from' : 'Add to'} favorites">${starSvg(fav)}</button>
            </div>`;
          })
          .join('')}</div></div>`
      )
      .join('');
  }
  V.library = function () {
    const f = WT.ui.lib;
    const list = libFiltered();
    const base = libFiltered(true);
    const sel = (key, label, opts) => `<select class="input" data-in="libFilter" data-k="${key}" aria-label="${label}"><option value="">${label}</option>${opts.map(([v, l]) => `<option value="${v}" ${f[key] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const groups = [['', 'Everything', base.length]].concat(Object.entries(WT.GROUPS).map(([k, v]) => [k, v, base.filter((ex) => matchesGroup(ex, k)).length]));
    return `<div class="page-head"><div class="eyebrow"><span>Reference</span></div>
        <div class="row between wrap top" style="gap:20px"><h1 class="h1">The <em>catalog</em>.</h1><button class="btn btn-secondary" data-act="exEdit">${I('plus', 17)}Add your own</button></div>
        <p class="lead">${WT.exercises.length} movements with muscles, equipment, prescriptions and a form tutorial for each.</p></div>
      <div class="lib">
        <aside class="lib-side">
          <div class="eyebrow hide-m" style="margin-bottom:10px">Muscle group</div>
          <div class="lib-groups">${groups.map(([k, v, c]) => `<button class="${f.group === k ? 'on' : ''}" data-act="libGroup" data-k="${k}"><span>${v}</span><span class="c">${c}</span></button>`).join('')}</div>
          <div class="hide-m"><div class="eyebrow mt32" style="margin-bottom:10px">Show</div>
            <div class="lib-groups">${[['mine', 'Available to me'], ['all', 'Everything'], ['excluded', 'Excluded'], ['custom', 'Your own']].map(([k, v]) => `<button class="${f.avail === k ? 'on' : ''}" data-act="libAvail" data-v="${k}"><span>${v}</span></button>`).join('')}
            <button class="${f.fav ? 'on' : ''}" data-act="libFav"><span>Favorites only</span><span class="c">${WT.db.profile.favorites.length}</span></button></div></div>
        </aside>
        <div style="min-width:0">
          <div class="search-xl"><span>${I('search', 22)}</span><input placeholder="Search by name or muscle" value="${esc(f.q)}" data-in="libSearch" autocomplete="off" id="libSearch" aria-label="Search exercises"></div>
          <div class="lib-filters mt16">
            ${sel('equip', 'Any equipment', Object.entries(WT.EQUIPMENT))}
            ${sel('cat', 'Any type', [['compound', 'Compound'], ['isolation', 'Isolation'], ['cardio', 'Cardio / conditioning']])}
            ${sel('diff', 'Any difficulty', [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']])}
            ${sel('intensity', 'Any intensity', [['heavy', 'Heavy-eligible'], ['regular', 'Regular-eligible'], ['burnout', 'Burnout-eligible']])}
          </div>
          <div class="row between wrap hide-d mt12" style="gap:10px">${H.seg([['mine', 'Available'], ['all', 'All'], ['excluded', 'Excluded'], ['custom', 'Yours']], f.avail, 'libAvail')}<button class="chip sm ${f.fav ? 'on' : ''}" data-act="libFav">${I('star', 13)}Favorites</button></div>
          <div class="eyebrow mt24" id="libCount">${list.length} entr${list.length === 1 ? 'y' : 'ies'}</div>
          <div id="libList">${catalog(list)}</div>
        </div>
      </div>`;
  };
  WT.I.libSearch = (el, ev) => {
    if (ev.type !== 'input') return;
    WT.ui.lib.q = el.value;
    const list = libFiltered();
    document.getElementById('libList').innerHTML = catalog(list);
    document.getElementById('libCount').textContent = `${list.length} entr${list.length === 1 ? 'y' : 'ies'}`;
  };
  WT.I.libFilter = (el, ev) => {
    if (ev.type !== 'change') return;
    WT.ui.lib[el.dataset.k] = el.value;
    WT.rerender();
  };
  A.libGroup = (d) => {
    WT.ui.lib.group = d.k;
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
    if (WT.ui.route === 'library') document.getElementById('libList').innerHTML = catalog(libFiltered());
    WT.refreshSheet();
  };

  /* ═════════════════════ EXERCISE DETAIL ═════════════════════ */
  A.exDetail = (d) => {
    const id = d.id;
    WT.openSheet(
      () => {
        const ex = WT.ex(id);
        if (!ex) return { title: 'Not found' };
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
             <div class="row mt12" style="gap:18px"><a class="link quiet" href="https://www.youtube.com/watch?v=${vid}" target="_blank" rel="noopener">${I('ext', 14)}Open on YouTube</a><a class="link quiet" href="${WT.videoUrl(Object.assign({}, ex, { video: null }))}" target="_blank" rel="noopener">${I('search', 14)}Other tutorials</a></div>`
          : `<a class="video-cta" href="${esc(WT.videoUrl(ex))}" target="_blank" rel="noopener"><span class="play">${I('play', 20).replace('fill="none"', 'fill="currentColor"')}</span><div><div class="t">Watch form tutorials</div><div class="s">${ex.video ? 'Opens your saved link on YouTube' : 'Opens a YouTube search for this exercise'}</div></div>${I('ext', 18)}</a>
             <form class="row mt12" onsubmit="return false" style="gap:8px"><input class="input" id="vidUrl" placeholder="Paste a YouTube link to embed it here" style="height:40px;font-size:14px"><button class="btn btn-secondary btn-sm" data-act="saveVideo" data-id="${id}" style="height:40px">Save</button></form>`;
        const fig = (label, v) => `<div class="figure"><span class="v" style="font-size:30px">${v}</span><span class="eyebrow">${label}</span></div>`;
        const stats = hist.length
          ? `<div class="section-head mt48"><h2>Your record</h2><span class="eyebrow">${hist.length} session${hist.length > 1 ? 's' : ''}</span></div>
             ${tt === 'cardio' ? '' : `<div class="row wrap" style="gap:36px;padding:10px 0 4px;align-items:flex-start">
               ${pr.heaviest ? fig('Heaviest', `${WT.fmtNum(pr.heaviest.w)}<small>× ${pr.heaviest.r}</small>`) : pr.reps ? fig('Best', `${pr.reps.r}<small>${tt === 'time' ? 's' : 'reps'}</small>`) : ''}
               ${pr.e1rm ? fig('Est. 1-rep max', `${WT.fmtNum(Math.round(pr.e1rm.v))}<small>${u}</small>`) : ''}</div>`}
             ${hist.length > 1 && tt !== 'cardio' ? `<div id="exChart" class="mt16"></div>` : ''}
             ${rec ? `<div class="advice ${rec.action} mt16" style="margin-left:0"><span class="ic">${I(rec.action === 'increase' || rec.action === 'progress' ? 'trendUp' : rec.action === 'decrease' ? 'trendDown' : 'equal', 18)}</span><div><div class="h">Next time: ${esc(rec.headline)}</div><p class="small muted mt4">${esc(rec.reasons.join(' '))}</p></div><span></span></div>` : ''}
             <table class="sheet-table mt16"><thead><tr><th>Date</th><th>Sets</th></tr></thead><tbody>${hist
               .slice(-6)
               .reverse()
               .map((h) => `<tr><td style="white-space:nowrap">${WT.fmtDate(h.date, { month: 'short', day: 'numeric' })}</td><td>${WT.fmtSets(h.sets, tt, ex)}</td></tr>`)
               .join('')}</tbody></table>`
          : `<p class="footnote mt32" style="font-size:16px">No history yet. Once you log this exercise, previous weights, records, a progress line and recommendations collect here.</p>`;
        return {
          eyebrow: `${WT.GROUPS[WT.MUSCLES[ex.primary].group]} · ${WT.cap(ex.category)}`,
          title: esc(ex.name),
          headExtra: `<button class="icon-btn star ${fav ? 'on' : ''}" data-act="favToggle" data-id="${id}" aria-pressed="${fav}" aria-label="Favorite">${starSvg(fav)}</button>`,
          body: `${video}
            ${ex.cue ? `<p class="pullquote mt32">${esc(ex.cue)}</p>` : ''}
            <dl class="spec mt32" style="margin-bottom:0">
              <div><dt>Primary</dt><dd>${WT.muscleName(ex.primary)}</dd></div>
              <div><dt>Secondary</dt><dd>${ex.secondary.map(WT.muscleName).join(', ') || '—'}</dd></div>
              <div><dt>Equipment</dt><dd>${ex.equipment.map((q) => WT.EQUIPMENT[q]).join(', ')}</dd></div>
              <div><dt>Movement</dt><dd>${WT.PATTERNS[ex.pattern] || ex.pattern}</dd></div>
              <div><dt>Recommended</dt><dd class="mono">${ex.sets} × ${ex.repMin}–${ex.repMax}${tt === 'time' || ex.unit === 'sec' ? 's' : tt === 'cardio' ? ' min' : ''}</dd></div>
              <div><dt>Rest</dt><dd class="mono">${ex.rest ? WT.fmtClock(ex.rest) : '—'}</dd></div>
              <div><dt>Difficulty</dt><dd>${WT.cap(ex.difficulty)}</dd></div>
              <div><dt>Intensity</dt><dd class="row wrap" style="gap:6px 14px;margin-top:8px">${ex.intensities.map((k) => `<span class="imark ${k}">${WT.INTENSITY_INFO[k].name}</span>`).join('')}</dd></div>
            </dl>
            ${restricted ? `<div class="callout warn mt16">${I('ban', 16)}<span>Blocked by your movement restrictions (Settings).</span></div>` : ''}
            ${stats}`,
          foot: `<button class="btn btn-secondary btn-sm" data-act="exEdit" data-id="${id}">${I('edit', 15)}Edit</button>
            <button class="btn btn-sm ${excl ? 'btn-secondary' : 'btn-danger'}" data-act="exExclude" data-id="${id}">${excl ? 'Include again' : 'Exclude'}</button>
            <span class="grow"></span>
            ${WT.db.active ? `<button class="btn btn-primary btn-sm" data-act="exAddTo" data-id="${id}" data-ctx="active">${I('plus', 15)}Add to session</button>` : WT.db.draft ? `<button class="btn btn-primary btn-sm" data-act="exAddTo" data-id="${id}" data-ctx="draft">${I('plus', 15)}Add to plan</button>` : ''}`,
          after: (sheet) => {
            const el = sheet.querySelector('#exChart');
            if (el) {
              const pts = hist.map((h) => ({ x: h.date, y: h.metrics.e1rm ? Math.round(h.metrics.e1rm) : h.metrics.bestReps, tip: `<b>${WT.fmtSets(h.sets, tt, ex)}</b><br><span class="faint">${WT.fmtDate(h.date)}</span>` }));
              WT.lineChart(el, pts, { height: 170 });
              el.insertAdjacentHTML('afterbegin', `<div class="eyebrow" style="margin-bottom:6px">${hist[0].metrics.e1rm ? 'Estimated 1-rep max' : 'Best reps'}</div>`);
            }
          },
        };
      },
      { wide: true }
    );
  };
  A.saveVideo = (d) => {
    const url = document.getElementById('vidUrl').value.trim();
    if (!WT.youtubeId(url)) return WT.toast('That doesn’t look like a YouTube video link', 'error');
    setOverride(d.id, { video: url });
    WT.toast('Video saved', 'good');
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
    WT.toast(p.excluded.includes(d.id) ? 'Excluded from generated sessions' : 'Included again');
    WT.refreshSheet();
    if (WT.ui.route === 'library') WT.rerender();
  };
  A.exAddTo = (d) => {
    const ex = WT.ex(d.id);
    if (d.ctx === 'active') WT.db.active.exercises.push(WT.sessionItem(ex.id));
    else {
      WT.db.draft.exercises.push(Object.assign({ uid: WT.uid(), exId: ex.id, slot: { label: WT.muscleName(ex.primary), m: [ex.primary], p: null }, slotIndex: 99, why: ['Added by you'], locked: true }, WT.prescribe(ex, ex.intensity)));
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
      : { name: '', primary: 'chest', secondary: [], equipment: ['db'], category: 'isolation', pattern: 'fly', difficulty: 'beginner', intensities: ['regular', 'standard'], repMin: 8, repMax: 12, rest: 60, load: 'db', tags: [], video: '', cue: '', sets: 3 };
    WT.openSheet(
      () => {
        const muscles = Object.fromEntries(Object.entries(WT.MUSCLES).map(([k, v]) => [k, v.name]));
        const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');
        return {
          eyebrow: base ? 'Library · edit' : 'Library · new',
          title: base ? esc(base.name) : 'A new exercise',
          body: `<div class="col" style="gap:16px">
            <div class="field"><label>Name</label><input class="input" data-in="exf" data-k="name" value="${esc(form.name)}" placeholder="e.g. Landmine Press"></div>
            <div class="grid-2" style="gap:14px">
              <div class="field"><label>Primary muscle</label><select class="input" data-in="exf" data-k="primary">${opt(muscles, form.primary)}</select></div>
              <div class="field"><label>Movement pattern</label><select class="input" data-in="exf" data-k="pattern">${opt(WT.PATTERNS, form.pattern)}</select></div>
              <div class="field"><label>Category</label><select class="input" data-in="exf" data-k="category">${opt({ compound: 'Compound', isolation: 'Isolation', cardio: 'Cardio / conditioning' }, form.category)}</select></div>
              <div class="field"><label>Difficulty</label><select class="input" data-in="exf" data-k="difficulty">${opt({ beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }, form.difficulty)}</select></div>
              <div class="field"><label>Tracking</label><select class="input" data-in="exf" data-k="load">${opt({ db: 'Dumbbell (weight × reps)', cable: 'Cable (weight × reps)', machine: 'Machine (weight × reps)', bb: 'Barbell (weight × reps)', mb: 'Medicine ball', kb: 'Kettlebell', bwl: 'Bodyweight (+ optional load)', bw: 'Bodyweight reps', time: 'Timed hold (seconds)', cardio: 'Cardio (minutes + distance)' }, form.load)}</select></div>
              <div class="field"><label>Rest (seconds)</label><input class="input mono" type="number" inputmode="numeric" data-in="exf" data-k="rest" value="${form.rest}"></div>
              <div class="field"><label>Reps — minimum</label><input class="input mono" type="number" inputmode="numeric" data-in="exf" data-k="repMin" value="${form.repMin}"></div>
              <div class="field"><label>Reps — maximum</label><input class="input mono" type="number" inputmode="numeric" data-in="exf" data-k="repMax" value="${form.repMax}"></div>
            </div>
            <div class="field"><label>Secondary muscles</label>${H.chipGroup(muscles, form.secondary, 'exfSec').replace(/class="chip /g, 'class="chip sm ')}</div>
            <div class="field"><label>Equipment required</label>${H.chipGroup(WT.EQUIPMENT, form.equipment, 'exfEq').replace(/class="chip /g, 'class="chip sm ')}</div>
            <div class="field"><label>Eligible intensities <span class="faint" style="font-weight:400">— standard is always allowed</span></label>${H.chipGroup({ heavy: 'Heavy', regular: 'Regular', burnout: 'Burnout' }, form.intensities, 'exfInt')}</div>
            <div class="field"><label>YouTube video link <span class="faint" style="font-weight:400">— optional</span></label><input class="input" data-in="exf" data-k="video" value="${esc(form.video || '')}" placeholder="https://www.youtube.com/watch?v=…"></div>
            <div class="field"><label>Instructions and cues</label><textarea class="input" data-in="exf" data-k="cue" placeholder="Setup, cues, things to remember">${esc(form.cue || '')}</textarea></div>
          </div>`,
          foot: `${base && !base.custom && WT.db.overrides[id] ? `<button class="btn btn-ghost btn-sm" data-act="exfReset">Reset to default</button>` : ''}${base && base.custom ? `<button class="btn btn-danger btn-sm" data-act="exfDelete">Delete</button>` : ''}<span class="grow"></span><button class="btn btn-primary" data-act="exfSave">Save</button>`,
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
      if (!form.equipment.length) form.equipment = ['bw'];
      if (form.video && !WT.youtubeId(form.video)) return WT.toast('Video link must be a YouTube video URL', 'error');
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
      WT.confirm('Delete this exercise?', 'It will be removed from the library. Past sessions that used it keep their logged sets.', 'Delete', () => {
        WT.db.customExercises = WT.db.customExercises.filter((e) => e.id !== id);
        WT.rebuildExercises();
        WT.save();
        WT.closeSheet(true);
        WT.rerender();
      }, true);
  };

  /* ═════════════════════ LOG (history) ═════════════════════ */
  V.history = function (id) {
    if (id) return historyDetail(id);
    const ss = WT.sessions().reverse();
    const head = (lead) => `<div class="page-head"><div class="eyebrow"><span>Log</span></div><h1 class="h1">The <em>log</em>.</h1><p class="lead">${lead}</p></div>`;
    if (!ss.length)
      return head('Every finished session is kept here permanently — each set, rep and weight.') + `<div class="row wrap"><a class="btn btn-primary btn-lg" href="#/generate">Compose your first session <span class="arrow">${I('chevR', 18)}</span></a></div>`;
    const byMonth = {};
    ss.forEach((s) => {
      const d = new Date(s.startedAt);
      const k = d.getFullYear() + '-' + d.getMonth();
      (byMonth[k] = byMonth[k] || { d, list: [] }).list.push(s);
    });
    const u = WT.db.profile.unit;
    const first = ss[ss.length - 1];
    return (
      head(`${ss.length} session${ss.length > 1 ? 's' : ''} since ${WT.fmtDate(first.startedAt, { month: 'long', day: 'numeric', year: 'numeric' })}.`) +
      Object.values(byMonth)
        .map(
          ({ d, list }) => `<section class="month">
          <div><div class="month-name">${d.toLocaleDateString(undefined, { month: 'long' })}<span class="eyebrow">${d.getFullYear()} · ${list.length} session${list.length > 1 ? 's' : ''}</span></div></div>
          <div>${list
            .map((s) => {
              const sd = new Date(s.startedAt);
              const names = s.exercises.filter((e) => !e.skipped).map((e) => esc(e.name || (WT.ex(e.exId) || {}).name));
              return `<a class="log-entry" href="#/history/${s.id}">
                <div class="log-day">${sd.getDate()}<span class="eyebrow">${sd.toLocaleDateString(undefined, { weekday: 'short' })}</span></div>
                <div style="min-width:0"><div class="entry-title">${esc(s.title)}</div>
                  <div class="entry-meta"><span>${WT.fmtDuration(s.durationSec)}</span><span>${WT.plural((s.totals && s.totals.sets) || 0, 'set')}</span>${(s.prs || []).length ? `<span class="pr-mark">★ ${s.prs.length} record${s.prs.length > 1 ? 's' : ''}</span>` : ''}</div>
                  <div class="entry-ex">${names.join(' · ')}</div></div>
                <div class="log-vol">${s.totals && s.totals.volume ? `${WT.fmtNum(s.totals.volume)} ${u}` : ''}</div></a>`;
            })
            .join('')}</div></section>`
        )
        .join('')
    );
  };
  function historyDetail(id) {
    const s = WT.db.history.find((x) => x.id === id);
    if (!s) return `<div class="empty"><h3>Entry not found.</h3><p>It may have been deleted.</p><div class="mt24"><a class="btn btn-secondary" href="#/history">Back to the log</a></div></div>`;
    const u = WT.db.profile.unit;
    const d = new Date(s.startedAt);
    const prIds = new Set((s.prs || []).map((p) => p.exId));
    const ex = s.exercises
      .map((e, idx) => {
        const def = WT.ex(e.exId);
        const tt = def ? WT.trackType(def) : 'weight';
        const sec = tt === 'time' || (def && def.unit === 'sec');
        const rows = (e.sets || [])
          .map((st, i) => {
            const cols =
              tt === 'cardio'
                ? `<td>${st.time || '—'} min</td><td class="r">${st.dist ? st.dist + ' mi' : '—'}</td>`
                : tt === 'time'
                ? `<td>—</td><td class="r">${st.r}s</td>`
                : `<td>${+st.w ? WT.fmtNum(+st.w) + ' ' + u : tt === 'reps' ? 'Bodyweight' : '—'}</td><td class="r">${st.r}${sec ? 's' : ''}</td>`;
            return `<tr><td class="faint">${i + 1}</td>${cols}</tr>`;
          })
          .join('');
        return `<div class="log-ex" style="${e.skipped ? 'opacity:.55' : ''}">
          <div><div class="row" style="gap:12px;align-items:baseline"><span class="xc-idx" style="font-size:24px">${String(idx + 1).padStart(2, '0')}</span>
            <button class="xc-title" style="font-size:22px" data-act="exDetail" data-id="${e.exId}">${esc(e.name || (def || {}).name || e.exId)}</button></div>
            <div class="xc-meta" style="margin-left:36px">${e.intensity ? H.intensity(WT.INTENSITY_INFO[e.intensity] ? e.intensity : 'standard') : ''}<span>Target ${e.targetSets || '?'} × ${e.repMin}–${e.repMax}</span>${e.superset ? `<span style="color:var(--forest)">Superset ${e.superset}</span>` : ''}</div>
            <div class="row wrap mt8" style="margin-left:36px;gap:6px 14px">${e.effort ? `<span class="small muted">${{ easy: 'Felt easy', good: 'Felt solid', hard: 'A grind' }[e.effort]}</span>` : ''}${prIds.has(e.exId) ? `<span class="pr-mark">★ Record</span>` : ''}${e.skipped ? '<span class="flag">Skipped</span>' : ''}</div>
            ${e.notes ? `<p class="footnote mt12" style="margin-left:36px">“${esc(e.notes)}”</p>` : ''}</div>
          <div>${rows ? `<table class="sheet-table"><thead><tr><th style="width:40px">Set</th><th>${tt === 'cardio' ? 'Time' : 'Load'}</th><th class="r">${tt === 'cardio' ? 'Distance' : sec ? 'Time' : 'Reps'}</th></tr></thead><tbody>${rows}</tbody></table>` : ''}</div>
        </div>`;
      })
      .join('');
    return `<a class="link quiet" href="#/history" style="margin-bottom:28px">${I('chevL', 15)}The log</a>
      <div class="page-head mt24" style="margin-bottom:32px"><div class="eyebrow"><span>${d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div>
        <h1 class="h1">${WT.italicLast(s.title)}</h1></div>
      <div class="ledger">
        <div class="figure"><span class="v">${WT.fmtDuration(s.durationSec)}</span><span class="eyebrow">Duration</span></div>
        <div class="figure"><span class="v">${s.exercises.filter((e) => !e.skipped).length}</span><span class="eyebrow">Exercises</span></div>
        <div class="figure"><span class="v">${(s.totals && s.totals.sets) || 0}</span><span class="eyebrow">Sets</span></div>
        <div class="figure"><span class="v">${s.totals && s.totals.volume ? WT.fmtNum(s.totals.volume) + '<small>' + u + '</small>' : '—'}</span><span class="eyebrow">Volume</span></div>
      </div>
      ${s.notes ? `<p class="pullquote mt32">${esc(s.notes)}</p>` : ''}
      <div class="row wrap mt32" style="gap:10px">
        <button class="btn btn-primary" data-act="histRepeat" data-id="${s.id}">Repeat this session <span class="arrow">${I('chevR', 16)}</span></button>
        <button class="btn btn-secondary" data-act="histTemplate" data-id="${s.id}">Use as a template</button>
        <button class="btn btn-ghost" data-act="histNotes" data-id="${s.id}">${I('edit', 15)}Notes</button>
        <button class="btn btn-ghost" data-act="histDelete" data-id="${s.id}" style="color:var(--danger)">${I('trash', 15)}Delete</button>
      </div>
      ${(s.prs || []).length ? `<div class="mt48"><div class="section-head"><h2>Records set</h2></div>${s.prs.map((r) => `<div class="leader" style="font-size:15px;padding:10px 0"><span>${esc((WT.ex(r.exId) || {}).name || r.exId)} <span class="faint">· ${r.kind}</span></span><span class="mono">${esc(r.value)}</span></div>`).join('')}</div>` : ''}
      <div class="mt48"><div class="section-head"><h2>Exercises</h2><span class="eyebrow">As logged</span></div>${ex}</div>`;
  }
  A.histRepeat = (d) => {
    const s = WT.db.history.find((x) => x.id === d.id);
    const begin = () => {
      WT.db.active = WT.sessionFromWorkout(WT.workoutFromSession(s));
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
    WT.toast('Loaded as a plan — swap, add or remove, then start');
  };
  A.histNotes = (d) => {
    const s = WT.db.history.find((x) => x.id === d.id);
    WT.openSheet(() => ({
      eyebrow: 'Log',
      title: 'Session notes',
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
  A.histDelete = (d) =>
    WT.confirm('Delete this entry?', 'It will be removed from your log, statistics and progression data. Consider exporting a backup first.', 'Delete', () => {
      WT.db.history = WT.db.history.filter((x) => x.id !== d.id);
      WT.save(true);
      WT.go('history');
      WT.toast('Entry deleted');
    }, true);

  /* ═════════════════════ PROGRESS ═════════════════════ */
  V.progress = function () {
    const st = WT.stats();
    const u = WT.db.profile.unit;
    if (!st.count)
      return `<div class="page-head"><div class="eyebrow"><span>Progress</span></div><h1 class="h1">Nothing to <em>measure</em> yet.</h1>
        <p class="lead">Charts and records appear after your first logged session. Nothing here is estimated or invented — it all comes from sets you’ve recorded.</p></div>
        <a class="btn btn-primary btn-lg" href="#/generate">Compose a session <span class="arrow">${I('chevR', 18)}</span></a>`;
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
    const firstD = WT.sessions()[0].startedAt;
    const weeksSpan = Math.min(12, Math.max(1, Math.ceil((Date.now() - WT.startOfWeek(firstD)) / (7 * 864e5))));

    // Change since first session for the selected exercise
    let delta = '';
    if (hist.length > 1 && loaded) {
      const a = hist[0].metrics.e1rm, b = hist[hist.length - 1].metrics.e1rm;
      const ch = Math.round(b - a);
      delta = `<span class="mono small ${ch > 0 ? '' : 'faint'}" style="${ch > 0 ? 'color:var(--forest)' : ''}">${ch > 0 ? '+' : ''}${ch} ${u} est. 1RM since ${WT.fmtDate(hist[0].date, { month: 'short', day: 'numeric' })}</span>`;
    }

    const groupRows = Object.entries(st.groupSets)
      .filter(([g]) => g !== 'cardio')
      .map(([g, v]) => ({ g, perWeek: v / (30 / 7), target: Object.keys(WT.MUSCLES).filter((m) => WT.MUSCLES[m].group === g).reduce((a, m) => a + WT.weeklyTarget(m), 0) }));
    const maxG = Math.max(...groupRows.map((r) => Math.max(r.perWeek, r.target)), 1);

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
        cells += `<i class="${day > today ? 'future' : c ? 'l1' : ''}" title="${WT.fmtDate(day)}${c ? ' · ' + c + ' session' + (c > 1 ? 's' : '') : ''}"></i>`;
      }
    const activeDays = Object.keys(st.days).filter((k) => new Date(k) >= start).length;

    return `<div class="page-head"><div class="eyebrow"><span>Progress</span></div><h1 class="h1">The <em>long</em> view.</h1>
        <p class="lead">${st.count} session${st.count > 1 ? 's' : ''} since ${WT.fmtDate(firstD, { month: 'long', day: 'numeric' })} — ${WT.fmtNum(WT.round(st.avgPerWeek, 1))} a week on average.</p></div>
      <div class="ledger">
        <div class="figure"><span class="v">${st.count}</span><span class="eyebrow">Sessions</span></div>
        <div class="figure"><span class="v">${WT.fmtNum(WT.round(st.avgPerWeek, 1))}</span><span class="eyebrow">Per week · ${weeksSpan} wk</span></div>
        <div class="figure"><span class="v">${WT.fmtNum(st.totalSets)}</span><span class="eyebrow">Sets completed</span></div>
        <div class="figure"><span class="v">${st.totalVolume >= 100000 ? WT.fmtNum(Math.round(st.totalVolume / 1000)) + '<small>k ' + u + '</small>' : WT.fmtNum(st.totalVolume) + '<small>' + u + '</small>'}</span><span class="eyebrow">Volume lifted</span></div>
      </div>

      <section class="mt64">
        <div class="eyebrow" style="margin-bottom:12px">Exercise progression</div>
        ${
          ex
            ? `<div class="row between wrap" style="gap:16px;align-items:flex-end">
                <select class="metric-select" data-in="progEx" aria-label="Exercise">${tracked.map((t) => `<option value="${t.ex.id}" ${t.ex.id === exId ? 'selected' : ''}>${esc(t.ex.name)}</option>`).join('')}</select>
                ${H.seg(metrics, WT.ui.prog.metric, 'progMetric')}</div>
              <div class="row between wrap mt16" style="gap:8px">${delta}<span class="eyebrow">${hist.length} session${hist.length > 1 ? 's' : ''}</span></div>
              <div id="progChart" class="mt16" style="min-height:240px"></div>
              <div class="grid-2 mt32">
                <div><div class="section-head"><h2>Records</h2></div>
                  ${pr.heaviest ? `<div class="leader"><span>Heaviest set</span><span class="mono">${WT.fmtNum(pr.heaviest.w)} ${u} × ${pr.heaviest.r}</span></div>` : ''}
                  ${pr.e1rm ? `<div class="leader"><span>Best est. 1-rep max</span><span class="mono">${WT.fmtNum(Math.round(pr.e1rm.v))} ${u}</span></div>` : ''}
                  ${pr.reps ? `<div class="leader"><span>${tt === 'time' ? 'Longest hold' : 'Most reps in a set'}</span><span class="mono">${pr.reps.r}${tt === 'time' ? 's' : ''}${pr.reps.w ? ' @ ' + WT.fmtNum(pr.reps.w) : ''}</span></div>` : ''}
                  ${pr.volume ? `<div class="leader"><span>Best session volume</span><span class="mono">${WT.fmtNum(pr.volume.v)} ${u}</span></div>` : ''}</div>
                <div><div class="section-head"><h2>Recent sessions</h2></div>
                  <table class="sheet-table"><tbody>${hist.slice(-6).reverse().map((h) => `<tr><td style="white-space:nowrap" class="faint">${WT.fmtDate(h.date, { month: 'short', day: 'numeric' })}</td><td>${WT.fmtSets(h.sets, tt, ex)}</td></tr>`).join('')}</tbody></table></div>
              </div>`
            : `<p class="muted">Log a strength exercise to see its progression.</p>`
        }
      </section>

      <section class="grid-2 mt64">
        <div><div class="section-head"><h2>Consistency</h2><span class="eyebrow">${activeDays} days · 20 weeks</span></div>
          <div class="row mt16" style="gap:10px;align-items:stretch"><div class="col eyebrow" style="gap:0;justify-content:space-between;font-size:9.5px;padding:1px 0"><span>Mon</span><span>Thu</span><span>Sun</span></div><div class="heatmap grow">${cells}</div></div></div>
        <div><div class="section-head"><h2>Sessions per week</h2><span class="eyebrow">12 weeks</span></div><div id="weeksChart" class="mt16"></div></div>
      </section>

      <section class="grid-2 mt64">
        <div><div class="section-head"><h2>Muscle group volume</h2><span class="eyebrow">Sets / week · 30 days</span></div>
          ${groupRows.map((r) => `<div class="mrow"><span>${WT.GROUPS[r.g]}</span><div class="mtrack"><i style="width:${(r.perWeek / maxG) * 100}%"></i><span class="tgt" style="left:${(r.target / maxG) * 100}%" title="Weekly target: ${r.target} sets"></span></div><span class="mono small" style="text-align:right">${WT.fmtNum(WT.round(r.perWeek, 1))}<span class="faint"> / ${r.target}</span></span></div>`).join('')}
          <p class="footnote mt12">Primary muscle counts one set, secondary half. The tick marks your weekly target — higher for priority muscles.</p></div>
        <div><div class="section-head"><h2>Personal records</h2><span class="eyebrow">Latest</span></div>
          ${st.prs.length ? st.prs.slice(0, 8).map((r) => `<a class="leader" href="#/history/${r.sessionId}"><span class="ellipsis">${esc((WT.ex(r.exId) || {}).name || r.exId)} <span class="faint">· ${WT.fmtDate(r.date, { month: 'short', day: 'numeric' })}</span></span><span class="mono">${esc(r.value)}</span></a>`).join('') : `<p class="footnote mt12">Beat a previous best weight or rep count and it’s recorded here.</p>`}</div>
      </section>`;
  };
  V.progressAfter = function () {
    const st = WT.stats();
    const wEl = document.getElementById('weeksChart');
    if (wEl)
      WT.barChart(
        wEl,
        st.weeks.map((w, i) => ({ label: i % 2 === 1 || i === 11 ? WT.fmtDate(w.start, { month: 'numeric', day: 'numeric' }) : '', value: w.count, highlight: i === 11, tip: `<b>${w.count} session${w.count === 1 ? '' : 's'}</b> · week of ${WT.fmtDate(w.start, { month: 'short', day: 'numeric' })}<br><span class="faint">${w.strength} strength · ${w.cardio} cardio · ${w.sets} sets</span>` })),
        { ref: WT.db.profile.strengthPerWeek, refLabel: 'Goal ' + WT.db.profile.strengthPerWeek, height: 190 }
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
      WT.lineChart(pEl, hist.map((h) => ({ x: h.date, y: val(h), tip: `<b>${WT.fmtNum(val(h))} ${unit}</b> · ${WT.fmtDate(h.date, { month: 'short', day: 'numeric' })}<br><span class="faint">${WT.fmtSets(h.sets, tt, ex)}</span>` })), { height: 240 });
      if (hist.length === 1) pEl.insertAdjacentHTML('beforeend', '<p class="footnote" style="text-align:center">One session logged — the line begins after your next.</p>');
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
    const num = (k, v, step, sub) => `<input class="input mono" style="width:96px;text-align:center;height:40px" type="number" inputmode="decimal" step="${step || 1}" data-in="pfNum" data-k="${k}" ${sub ? `data-sub="${sub}"` : ''} value="${v}">`;
    const last = p.lastBackup ? WT.fmtRelDay(p.lastBackup) : 'never';
    const sec = (title, desc, body, id) => `<section class="set-sec" ${id ? `id="${id}"` : ''}><div><h3>${title}</h3>${desc ? `<p class="desc">${desc}</p>` : ''}</div><div>${body}</div></section>`;
    const odds = p.intensityOdds;
    return `<div class="page-head"><div class="eyebrow"><span>Settings</span></div><h1 class="h1">Your <em>profile</em>.</h1>
        <p class="lead">These preferences drive which exercises are chosen, how hard they’re prescribed, and how progression is recommended.</p></div>
      ${sec(
        'Profile',
        'Name is optional — it only appears in the greeting.',
        `<div class="field"><label>Name</label><input class="input" style="max-width:360px" data-in="pfText" data-k="name" value="${esc(p.name)}" placeholder="Optional"></div>
         <div class="spec-row mt8"><div class="k">Appearance</div>${H.seg([['light', 'Paper'], ['dark', 'Night'], ['system', 'Auto']], p.theme, 'pfTheme')}</div>
         <div class="spec-row"><div><div class="k">Units</div><div class="d">Labels only — logged numbers aren’t converted</div></div>${H.seg([['lb', 'lb'], ['kg', 'kg']], p.unit, 'pfSeg', 'unit')}</div>
         <div class="spec-row"><div class="k">Experience</div>${H.seg([['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']], p.experience, 'pfSeg', 'experience')}</div>`
      )}
      ${sec(
        'Goals',
        'One per line. Shown on Today; the emphasis tags below steer exercise choice.',
        `<textarea class="input" style="min-height:150px;font-family:var(--f-display);font-size:17px" data-in="pfGoals">${esc(p.goals.join('\n'))}</textarea>
         <div class="label mt24" style="margin-bottom:10px">Emphasis</div>${H.chipGroup({ 'lower-chest': 'Lower chest', 'upper-chest': 'Upper chest', 'arm-size': 'Arm size', 'love-handles': 'Obliques', 'back-friendly': 'Back-friendly', 'shoulder-health': 'Shoulder health' }, p.emphasisTags, 'pfEmph')}`
      )}
      ${sec(
        'Intensity',
        'By default every exercise is independently assigned heavy, regular, burnout or standard, weighted by what suits it. Odds are relative — they needn’t add to 100.',
        `<div class="spec-row" style="padding-top:0"><div><div class="k">Randomize intensity</div><div class="d">Off = fixed counts below, the rest regular</div></div>${H.toggle(p.intensityRandom !== false, 'pfIntRandom')}</div>
         ${
           p.intensityRandom !== false
             ? `<div class="mt16">${H.oddsBar(odds)}</div><div class="mt12">${['heavy', 'regular', 'burnout', 'standard']
                 .map((k) => `<div class="odds-row"><span class="imark ${k}">${WT.INTENSITY_INFO[k].name}</span><input class="range" type="range" min="0" max="60" step="1" value="${odds[k]}" data-in="pfOdds" data-k="${k}" aria-label="${k} odds"><span class="mono small" style="text-align:right" id="odds-${k}">${H.pct(odds, k)}%</span></div>`)
                 .join('')}</div>
               <p class="small faint mt12">Heavy is weighted toward compound lifts early in a session; burnout toward isolation work near the end. Exercises that aren’t suited to a class can never receive it.</p>
               <button class="link quiet mt12" data-act="pfOddsReset">Reset to defaults</button>`
             : `<div class="spec-row"><span class="imark heavy">Heavy per session</span>${H.stepper(p.intensityFixed.heavy, 'pfFixed', 'heavy', 0, 6)}</div>
                <div class="spec-row"><span class="imark burnout">Burnout per session</span>${H.stepper(p.intensityFixed.burnout, 'pfFixed', 'burnout', 0, 6)}</div>`
         }
         <div class="spec-row"><div><div class="k">Allow burnout sets</div><div class="d">High-rep finishers, close to failure</div></div>${H.toggle(p.burnouts, 'pfToggle', 'data-k="burnouts"')}</div>`,
        'intensity'
      )}
      ${sec(
        'Schedule',
        'Used for weekly goals and the defaults when composing.',
        `<div class="spec-row" style="padding-top:0"><div class="k">Strength sessions a week</div>${H.stepper(p.strengthPerWeek, 'pfStep', 'strengthPerWeek', 1, 7)}</div>
         <div class="spec-row"><div class="k">Runs a week</div>${H.stepper(p.runsPerWeek, 'pfStep', 'runsPerWeek', 0, 7)}</div>
         <div class="spec-row"><div class="k">Preferred session</div><select class="input" style="width:auto;height:40px" data-in="pfSelect" data-k="preferredType">${WT.WORKOUT_TYPES.filter((t) => t.id !== 'custom').map((t) => `<option value="${t.id}" ${p.preferredType === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}</select></div>
         <div class="spec-row"><div class="k">Default exercises</div>${H.stepper(p.defaultCount, 'pfStep', 'defaultCount', 2, 12)}</div>
         <div class="spec-row"><div class="k">Default duration</div>${H.seg([[30, '30'], [45, '45'], [60, '60'], [75, '75'], [90, '90']], p.defaultDuration, 'pfSeg', 'defaultDuration', 'num')}</div>
         <div class="spec-row"><div><div class="k">Prefer supersets</div><div class="d">Pairs non-competing exercises to save time</div></div>${H.toggle(p.supersets, 'pfToggle', 'data-k="supersets"')}</div>`
      )}
      ${sec(
        'Equipment',
        'Only exercises you can do are generated, and weight suggestions only use dumbbells you own.',
        `${H.chipGroup(WT.EQUIPMENT, p.equipment, 'pfEquip')}
         <p class="small faint mt12">Cable exercises assume standard handles, a rope and a straight bar.</p>
         <div class="mt24">
           <div class="spec-row"><div class="k">Lightest dumbbell</div>${num('min', p.dumbbells.min, 2.5, 'dumbbells')}</div>
           <div class="spec-row"><div class="k">Heaviest dumbbell</div>${num('max', p.dumbbells.max, 2.5, 'dumbbells')}</div>
           <div class="spec-row"><div class="k">Dumbbell increment</div>${num('step', p.dumbbells.step, 2.5, 'dumbbells')}</div>
           <div class="spec-row"><div><div class="k">2.5 lb in-between weights</div><div class="d">e.g. 22.5 or 27.5 on adjustable dumbbells</div></div>${H.toggle(p.dumbbells.microLoad, 'pfMicro')}</div>
           <div class="spec-row"><div class="k">Cable stack increment</div>${num('cableStep', p.cableStep, 1)}</div>
         </div>
         <p class="mono small faint mt12">${WT.dumbbellWeights().join(' · ')}</p>`
      )}
      ${sec(
        'Muscles',
        'Prioritized muscles get more weekly volume and are favoured in selection, without crowding out the rest.',
        `<div class="label" style="margin-bottom:10px">Prioritize</div>${H.chipGroup(muscles, p.prioritize, 'pfPrio')}
         <div class="label mt24" style="margin-bottom:10px">Avoid</div>${H.chipGroup(muscles, p.avoidMuscles, 'pfAvoid', 'avoid')}`
      )}
      ${sec(
        'Restrictions',
        'Movements that never appear in generated sessions or swap suggestions.',
        `${Object.entries(WT.RESTRICTION_TAGS).map(([k, v]) => `<div class="spec-row"><div class="k" style="font-weight:500">Avoid ${esc(v.toLowerCase())}</div>${H.toggle(p.restrictions.includes(k), 'toggleRestriction', `data-k="${k}"`)}</div>`).join('')}
         <button class="spec-row" data-act="openExcluded"><div><div class="k">Excluded exercises</div><div class="d">${p.excluded.length} excluded</div></div><span class="faint">${I('chevR', 18)}</span></button>
         <div class="spec-row" style="display:block"><div class="k">Favorites</div><div class="d">${p.favorites.map((id) => (WT.ex(id) ? esc(WT.ex(id).name) : '')).filter(Boolean).join(', ') || 'None'} — preferred when composing.</div></div>`
      )}
      ${sec(
        'Rest timer',
        'Seconds. Applies to newly composed sessions.',
        `<div class="spec-row" style="padding-top:0"><span class="imark heavy">Heavy sets</span>${num('heavy', p.rest.heavy, 5, 'rest')}</div>
         <div class="spec-row"><span class="imark regular">Regular sets</span>${num('regular', p.rest.regular, 5, 'rest')}</div>
         <div class="spec-row"><span class="imark burnout">Burnout sets</span>${num('burnout', p.rest.burnout, 5, 'rest')}</div>
         <div class="spec-row"><div class="k">After a superset pair</div>${num('superset', p.rest.superset, 5, 'rest')}</div>
         <div class="spec-row"><div class="k">Sound and vibration</div>${H.toggle(p.timerSound, 'pfToggle', 'data-k="timerSound"')}</div>`
      )}
      ${sec(
        'Data',
        `Stored only in this browser. Last backup: ${last}.`,
        `<p class="muted">No account and no server. Export a backup regularly — especially before clearing browser data or moving to the home-screen app.</p>
         <div class="row wrap mt24" style="gap:10px">
           <button class="btn btn-primary" data-act="exportJson">${I('download', 17)}Export backup</button>
           <label class="btn btn-secondary" style="cursor:pointer">${I('upload', 17)}Import or restore<input type="file" accept="application/json,.json" data-in="importFile" hidden></label>
         </div>
         <p class="mono small faint mt16" id="storageInfo">${WT.db.history.length} sessions · ${WT.db.customExercises.length} custom exercises</p>
         <button class="btn btn-danger btn-sm mt24" data-act="resetAll">Erase all data</button>`
      )}
      ${sec(
        'Install',
        'Runs full-screen and offline from your home screen.',
        `<ol class="goals" style="padding:0;margin:0;grid-template-columns:1fr">
           <li>Open the site in Safari — it must be served over HTTPS, e.g. GitHub Pages.</li>
           <li>Tap Share, then Add to Home Screen.</li>
           <li>Launch it from the home screen. Back up before switching between Safari and the app — they keep separate storage.</li></ol>`
      )}`;
  };
  V.settingsAfter = async function () {
    const el = document.getElementById('storageInfo');
    if (el && navigator.storage) {
      try {
        const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
        const bytes = new Blob([localStorage.getItem('wt.data.v1') || '']).size;
        el.innerHTML = `${WT.db.history.length} sessions · ${WT.db.customExercises.length} custom exercises · ${(bytes / 1024).toFixed(1)} KB${persisted ? ' · <span style="color:var(--forest)">persistent storage granted</span>' : ''}`;
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
    // live update without re-rendering (keeps the slider under the finger)
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
        eyebrow: 'Data',
        title: 'Restore a backup',
        body: `<p class="muted">This backup holds <b>${data.history.length}</b> sessions and <b>${(data.customExercises || []).length}</b> custom exercises.</p>
          <div class="opt-list mt24">
            <button class="opt" data-act="doImport" data-mode="merge"><div><div class="t">Merge</div><div class="m">Add sessions not already here. Keeps your current settings.</div></div></button>
            <button class="opt danger" data-act="doImport" data-mode="replace"><div><div class="t">Replace everything</div><div class="m">Restore exactly as backed up. Current data is overwritten.</div></div></button>
          </div>`,
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
    reader.readAsText(el.files[0]);
  };
  A.resetAll = () =>
    WT.confirm('Erase all data?', 'This permanently deletes your log, custom exercises and settings from this device. Export a backup first if you might want it back.', 'Erase everything', () => {
      WT.resetAll();
      WT.applyTheme();
      WT.ui.gen = null;
      WT.go('dashboard');
      WT.toast('All data erased');
    }, true);
})();
