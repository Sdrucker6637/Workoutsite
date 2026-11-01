/* Views: Home, Generate, Train (active workout) + shared sheets. */
(function () {
  const WT = globalThis.WT;
  const I = WT.icon, esc = WT.esc, H = WT.h, A = WT.A, V = WT.V;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  WT.plural = plural;
  const toggleIn = (arr, k) => (arr.includes(k) ? arr.filter((x) => x !== k) : arr.concat(k));
  const doneSets = (s) => s.exercises.reduce((a, e) => a + (e.skipped ? 0 : e.sets.filter((x) => x.done).length), 0);
  const totalSets = (s) => s.exercises.reduce((a, e) => a + (e.skipped ? 0 : e.sets.length), 0);

  /** What weight to show next to an exercise in a plan — from history, never invented. */
  WT.suggestedLoad = function (exId, item) {
    const ex = WT.ex(exId);
    const tt = WT.trackType(ex);
    const u = WT.db.profile.unit;
    if (tt === 'cardio' || tt === 'time') return '';
    const rec = WT.recommend(exId, { repMin: item.repMin, repMax: item.repMax, sets: item.sets || item.targetSets, intensity: item.intensity });
    if (rec && rec.weight != null && rec.weight > 0) return `${WT.fmtNum(rec.weight)} ${u}`;
    if (tt === 'reps') return rec && rec.addLoad ? `+${rec.addLoad} ${u}` : 'Bodyweight';
    return '';
  };

  /* ═════════════════════ HOME ═════════════════════ */
  V.dashboard = function () {
    const p = WT.db.profile;
    const st = WT.stats();
    const ss = WT.sessions();
    const active = WT.db.active;
    const now = new Date();
    const week = st.weeks[st.weeks.length - 1];
    const runs = runsThisWeek();
    const sugg = WT.suggestNext();
    const h = now.getHours();
    const greet = `Good ${h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'}${p.name ? ', ' + esc(p.name) : ''}`;

    // Focal action
    const hero = active
      ? `<div class="panel hero">
          <div class="kicker">In progress</div>
          <h2>${esc(active.title)}</h2>
          <p class="tnum">${doneSets(active)} of ${totalSets(active)} sets · <span id="dashClock">${WT.fmtClock((Date.now() - new Date(active.startedAt)) / 1000)}</span></p>
          <div class="actions"><a class="btn btn-primary btn-lg" href="#/workout">Resume workout</a></div></div>`
      : `<div class="panel hero">
          <div class="kicker">Up next</div>
          <h2>${WT.typeName(sugg.type)}</h2>
          <p>${esc(sugg.reason)}</p>
          <div class="actions">
            <button class="btn btn-primary btn-lg" data-act="quickGen" data-k="${sugg.type}">${I('sparkles', 18)}Generate workout</button>
            <a class="btn btn-plain" href="#/generate">Choose another type</a>
          </div></div>`;

    // Week
    const start = WT.startOfWeek(now);
    const today = WT.startOfDay(now);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const sess = ss.filter((s) => WT.startOfDay(s.startedAt).getTime() === d.getTime());
      const strength = sess.find((s) => s.type !== 'cardio');
      const run = sess.find((s) => s.type === 'cardio');
      const s = strength || run;
      const cls = strength ? 'done' : run ? 'run' : '';
      const letter = d.toLocaleDateString(undefined, { weekday: 'narrow' });
      days.push(`<div class="wd ${d.getTime() === today.getTime() ? 'today' : ''}"><span class="l">${letter}</span>${
        s ? `<a class="dot ${cls}" href="#/history/${s.id}" title="${esc(s.title)}">${d.getDate()}</a>` : `<span class="dot">${d.getDate()}</span>`
      }</div>`);
    }

    // Recent
    const recent = ss.slice(-3).reverse();
    const recentHtml = recent.length
      ? `<div class="list inset">${recent
          .map((s) =>
            H.li({
              href: `#/history/${s.id}`,
              title: esc(s.title),
              sub: `${WT.fmtRelDay(s.startedAt)} · ${WT.fmtDuration(s.durationSec)} · ${plural((s.totals && s.totals.sets) || 0, 'set')}`,
              trail: (s.prs || []).length ? `<span class="badge-pr">${plural(s.prs.length, 'PR')}</span>` : '',
              chev: true,
            })
          )
          .join('')}</div>`
      : `<p class="t2">Workouts you finish will appear here.</p>`;

    // Minimal summary: last 30 days
    const mStart = new Date(Date.now() - 30 * 864e5);
    const monthSess = ss.filter((s) => new Date(s.startedAt) >= mStart);
    const monthVol = monthSess.reduce((a, s) => a + ((s.totals && s.totals.volume) || 0), 0);
    const monthPRs = monthSess.reduce((a, s) => a + (s.prs || []).length, 0);
    const vol = monthVol >= 10000 ? WT.fmtNum(WT.round(monthVol / 1000, 1)) + '<small>k ' + p.unit + '</small>' : WT.fmtNum(monthVol) + `<small>${p.unit}</small>`;

    return `<div class="page">
      <div class="head"><div class="over">${now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div><h1 class="large-title">${greet}</h1></div>
      ${hero}
      <section class="section">
        <div class="section-title"><h2>This week</h2><span class="footnote t2 tnum">${week.strength} of ${p.strengthPerWeek} workouts${p.runsPerWeek ? ` · ${runs} of ${p.runsPerWeek} runs` : ''}</span></div>
        <div class="week">${days.join('')}</div>
      </section>
      <section class="section">
        <div class="section-title"><h2>Recent</h2>${ss.length ? `<a class="btn-link footnote" href="#/history">See all</a>` : ''}</div>
        ${recentHtml}
      </section>
      ${
        ss.length
          ? `<section class="section">
        <div class="section-title"><h2>Last 30 days</h2><a class="btn-link footnote" href="#/progress">Progress</a></div>
        <div class="summary">
          <div class="metric"><div class="v">${monthSess.length}</div><div class="k">Workouts</div></div>
          <div class="metric"><div class="v">${vol}</div><div class="k">Volume</div></div>
          <div class="metric"><div class="v">${monthPRs}</div><div class="k">Personal records</div></div>
        </div></section>`
          : ''
      }
    </div>`;
  };
  function runsThisWeek() {
    const start = WT.startOfWeek(new Date());
    return WT.db.history.filter((s) => new Date(s.startedAt) >= start && s.exercises.some((e) => !e.skipped && WT.ex(e.exId) && WT.ex(e.exId).tags.includes('run'))).length;
  }

  A.quickGen = (d) => {
    WT.ui.gen = WT.defaultSettings(d.k);
    WT.db.draft = WT.generate(WT.ui.gen);
    WT.save();
    WT.go('generate');
  };
  A.logRun = () => {
    const begin = () => {
      const w = { type: 'cardio', title: 'Run', exercises: [Object.assign({ exId: 'outdoor-run' }, WT.prescribe(WT.ex('outdoor-run'), 'standard'))] };
      WT.db.active = WT.sessionFromWorkout(w);
      WT.save(true);
      WT.go('workout');
    };
    if (WT.db.active) WT.confirm('Replace current workout?', 'A workout is in progress. Starting a run will discard it.', 'Discard and start', begin, true);
    else begin();
  };

  /* ═════════════════════ GENERATE ═════════════════════ */
  const GEN_TYPES = ['full', 'push', 'pull', 'legs', 'chest', 'back', 'shoulders', 'arms', 'core', 'cardio', 'custom'];
  function gen() {
    if (!WT.ui.gen) WT.ui.gen = WT.db.draft && WT.db.draft.settings ? Object.assign(WT.defaultSettings(), WT.db.draft.settings) : WT.defaultSettings();
    if (WT.ui.gen.intensityMode === 'auto') WT.ui.gen.intensityMode = 'random';
    return WT.ui.gen;
  }
  V.generate = function () {
    const g = gen();
    const p = WT.db.profile;
    const random = g.intensityMode !== 'manual';
    const muscles = Object.fromEntries(Object.entries(WT.MUSCLES).filter(([k]) => k !== 'cardio').map(([k, v]) => [k, v.name]));
    const types = GEN_TYPES.concat(GEN_TYPES.includes(g.type) ? [] : [g.type])
      .map((t) => `<button class="chip ${g.type === t ? 'on' : ''}" data-act="genType" data-k="${t}" aria-pressed="${g.type === t}">${WT.typeName(t)}</button>`)
      .join('');
    const reg = Math.max(0, g.count - (+g.heavy || 0) - (+g.burnout || 0));

    const advanced = `
      <details class="adv mt24" ${H.keepOpen('genAdv')}><summary>${I('chevR', 14)}More options</summary>
        <div class="adv-body">
          <div class="adv-block"><span class="label">Intensity</span>
            <div class="row between wrap" style="gap:12px">${H.seg([['random', 'Randomized'], ['manual', 'Fixed']], random ? 'random' : 'manual', 'genSet', 'intensityMode')}
            ${random ? `<span class="footnote t3 tnum">${['heavy', 'regular', 'burnout'].map((k) => `${H.pct(p.intensityOdds, k)}% ${k}`).join(' · ')}</span>` : ''}</div>
            ${
              random
                ? `<p class="footnote t3 mt12">Each exercise is assigned independently, weighted by what suits it — some workouts have no heavy or burnout work at all. <a class="btn-link" href="#/settings">Adjust odds</a></p>`
                : `<div class="row between mt16"><span class="int heavy">Heavy</span>${H.stepper(g.heavy, 'genStep', 'heavy', 0, 12)}</div>
                   <div class="row between mt12"><span class="int burnout">Burnout</span>${H.stepper(g.burnout, 'genStep', 'burnout', 0, 12)}</div>
                   <p class="footnote t3 mt12">${reg} regular.</p>`
            }</div>
          <div class="adv-block"><div class="row between"><div><div class="strong" style="font-size:14.5px">Supersets</div><div class="footnote t3">Pair non-competing exercises</div></div>${H.toggle(g.supersets, 'genToggle', 'data-k="supersets"')}</div>
            <div class="row between mt16"><div><div class="strong" style="font-size:14.5px">Fit to duration</div><div class="footnote t3">Choose the exercise count automatically</div></div>${H.toggle(g.autoCount, 'genToggle', 'data-k="autoCount"')}</div></div>
          <div class="adv-block"><span class="label">Prioritize</span>${H.chipGroup(muscles, g.prioritize, 'genPrio', 'sm')}</div>
          <div class="adv-block"><span class="label">Equipment</span>${H.chipGroup(WT.EQUIPMENT, g.equipment, 'genEquip', 'sm')}</div>
          <div class="adv-block"><span class="label">Avoid</span>${H.chipGroup(muscles, g.avoidMuscles, 'genAvoid', 'avoid sm')}</div>
          <div class="adv-block"><button class="row between" style="width:100%" data-act="openExcluded"><span><span class="strong" style="font-size:14.5px">Excluded exercises</span><span class="footnote t3" style="display:block">${p.excluded.length} excluded · ${p.restrictions.length} restrictions</span></span><span class="t3">${I('chevR', 16)}</span></button></div>
        </div></details>`;

    const d = WT.db.draft;
    let plan = '';
    if (WT.ui.composing) plan = `<section class="section"><div class="plan-list skeleton" aria-busy="true"><i style="width:35%"></i><i style="width:80%"></i><i style="width:65%"></i><i style="width:75%"></i><i style="width:55%"></i></div></section>`;
    else if (d) {
      const sets = d.exercises.reduce((a, i) => a + (i.sets || 0), 0);
      plan = `<section class="section" id="planCol" style="scroll-margin-top:72px">
        <div class="plan-head"><div><h2 class="title2">${esc(d.title)}</h2><div class="plan-meta">${plural(d.exercises.length, 'exercise')} · ${sets} sets · about ${d.estimatedMin} min</div></div>
          <div class="row" style="gap:2px"><button class="icon-btn" data-act="rerollIntensity" title="Re-roll intensities" aria-label="Re-roll intensities">${I('zap', 17)}</button><button class="icon-btn" data-act="regenerate" title="Regenerate" aria-label="Regenerate">${I('refresh', 17)}</button><button class="icon-btn" data-act="clearDraft" title="Discard" aria-label="Discard plan">${I('x', 18)}</button></div></div>
        <div class="plan-list fade-in">${planRows(d)}</div>
        <div class="row between mt12"><button class="btn btn-plain btn-sm" data-act="openAdd" data-ctx="draft" style="margin-left:-10px">${I('plus', 15)}Add exercise</button>${(d.notes || []).length ? `<span class="footnote t3">${esc(d.notes[d.notes.length - 1])}</span>` : ''}</div>
        <div class="sticky-cta"><button class="btn btn-primary btn-lg btn-block" data-act="startDraft">Start workout</button></div>
      </section>`;
    }

    return `<div class="page">
      <div class="head"><h1 class="large-title">Generate</h1><p class="sub">Built from your goals, equipment and recent training.</p></div>
      <div class="types">${types}</div>
      ${g.type === 'custom' ? `<div class="mt16"><div class="label" style="margin-bottom:10px">Muscle groups</div>${H.chipGroup(WT.CUSTOM_TARGETS, g.targets, 'genTarget', 'sm')}</div>` : ''}
      <div class="opts mt32">
        <span class="opt-label">Exercises</span><div>${g.autoCount ? `<span class="t2">Automatic</span>` : H.stepper(g.count, 'genStep', 'count', 1, 12)}</div>
        <span class="opt-label">Duration</span><div>${H.seg([[30, '30'], [45, '45'], [60, '60'], [75, '75'], [90, '90 min']], g.duration, 'genSet', 'duration')}</div>
      </div>
      ${advanced}
      ${d ? `<button class="btn btn-secondary mt24" data-act="generate">${I('sparkles', 16)}Generate again</button>` : `<button class="btn btn-primary btn-lg btn-block mt24" data-act="generate">${I('sparkles', 18)}Generate workout</button>`}
      ${plan}
    </div>`;
  };

  function planRows(d) {
    let n = 0;
    return WT.groupBlocks(d.exercises)
      .map((b) => {
        const rows = b.map((it) => planRow(it, ++n, b.length > 1 ? b[0].superset : null)).join('');
        return b.length > 1 ? `<div class="ss">${rows}</div>` : rows;
      })
      .join('');
  }
  function planRow(it, n, ss) {
    const ex = WT.ex(it.exId);
    if (!ex) return '';
    const load = WT.suggestedLoad(ex.id, it);
    return `<div class="ex-row ${it.locked ? 'locked' : ''}">
      <span class="n">${it.locked ? I('lock', 13).replace('<svg', '<svg style="margin:0 auto"') : n}</span>
      ${H.demo(ex.id, 'sm')}
      <div style="min-width:0">
        <button class="nm" data-act="exDetail" data-id="${ex.id}">${esc(ex.name)}</button>
        <div class="meta"><span>${WT.muscleName(ex.primary)}</span><span class="rx">${H.target(it, ex)}</span>${load ? `<span>${load}</span>` : ''}${it.intensity !== 'standard' ? H.intensity(it.intensity, 'pickIntensity', it.uid, 'draft') : ''}${ss ? `<span class="ss-tag">Superset ${ss}</span>` : ''}</div>
      </div>
      <div class="acts">
        <a class="icon-btn sm" href="${esc(WT.videoUrl(ex))}" target="_blank" rel="noopener" title="Watch tutorial" aria-label="Watch ${esc(ex.name)} tutorial">${I('play', 15)}</a>
        <button class="icon-btn sm" data-act="openSwap" data-ctx="draft" data-uid="${it.uid}" title="Swap" aria-label="Swap ${esc(ex.name)}">${I('swap', 16)}</button>
        <button class="icon-btn sm" data-act="planMenu" data-uid="${it.uid}" aria-label="More options for ${esc(ex.name)}">${I('more', 17)}</button>
      </div></div>`;
  }

  A.genType = (d) => {
    gen().type = d.k;
    WT.rerender();
  };
  A.genTarget = (d) => {
    gen().targets = toggleIn(gen().targets, d.k);
    WT.rerender();
  };
  A.genStep = (d) => {
    const g = gen();
    g[d.k] = WT.clamp((+g[d.k] || 0) + +d.d, +d.min, +d.max);
    if (d.k === 'count') {
      g.heavy = Math.min(g.heavy, g.count);
      g.burnout = Math.min(g.burnout, g.count - g.heavy);
    }
    if ((d.k === 'heavy' || d.k === 'burnout') && g.heavy + g.burnout > g.count) g[d.k] = g.count - (d.k === 'heavy' ? g.burnout : g.heavy);
    WT.rerender();
  };
  A.genSet = (d) => {
    gen()[d.k] = isNaN(+d.v) ? d.v : +d.v;
    WT.rerender();
  };
  A.genToggle = (d) => {
    gen()[d.k] = !gen()[d.k];
    WT.rerender();
  };
  A.genEquip = (d) => {
    gen().equipment = toggleIn(gen().equipment, d.k);
    WT.rerender();
  };
  A.genPrio = (d) => {
    gen().prioritize = toggleIn(gen().prioritize, d.k);
    WT.rerender();
  };
  A.genAvoid = (d) => {
    gen().avoidMuscles = toggleIn(gen().avoidMuscles, d.k);
    WT.rerender();
  };
  function compose(make, msg) {
    WT.ui.composing = true;
    WT.rerender();
    setTimeout(() => {
      WT.ui.composing = false;
      WT.db.draft = make();
      WT.save();
      WT.render(true);
      document.getElementById('main').classList.remove('calm');
      const el = document.getElementById('planCol');
      if (el && el.getBoundingClientRect().top > innerHeight * 0.6) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (msg) WT.toast(msg);
    }, 380);
  }
  A.generate = () => {
    const g = gen();
    if (g.type === 'custom' && !g.targets.length) return WT.toast('Choose at least one muscle group', 'error');
    compose(() => WT.generate(g));
  };
  A.regenerate = () => {
    const d = WT.db.draft;
    if (!d) return A.generate();
    const keep = d.exercises.filter((i) => i.locked);
    compose(() => WT.generate(Object.assign({}, d.settings, gen().type === d.type ? gen() : {}), keep), keep.length ? `Kept ${plural(keep.length, 'locked exercise')}` : null);
  };
  A.rerollIntensity = () => {
    const d = WT.db.draft;
    const before = JSON.stringify(WT.intensityTally(d.exercises));
    let tries = 0;
    do {
      d.exercises.forEach((i) => !i.locked && (i.intensity = null));
      WT.randomizeIntensities(d.exercises);
    } while (JSON.stringify(WT.intensityTally(d.exercises)) === before && ++tries < 6);
    d.exercises.forEach((i) => Object.assign(i, WT.prescribe(WT.ex(i.exId), i.intensity)));
    d.exercises = WT.arrange(d.exercises, (d.settings || {}).supersets !== false, d.type);
    d.estimatedMin = WT.estimateMinutes(d.exercises);
    WT.save();
    WT.rerender();
    WT.toast('Intensities re-rolled');
  };
  A.clearDraft = () => {
    WT.db.draft = null;
    WT.save();
    WT.rerender();
  };
  const draftItem = (uid) => WT.db.draft && WT.db.draft.exercises.find((i) => i.uid === uid);
  A.planMenu = (d) => {
    const it = draftItem(d.uid);
    const ex = WT.ex(it.exId);
    WT.openSheet(() => ({
      eyebrow: WT.muscleName(ex.primary),
      title: esc(ex.name),
      body: `<div class="list inset">
        ${H.li({ act: 'openSwap', attrs: `data-ctx="draft" data-uid="${it.uid}"`, title: 'Swap exercise', chev: true })}
        ${H.li({ act: 'pickIntensity', attrs: `data-ctx="draft" data-uid="${it.uid}"`, title: 'Intensity', trail: `<span class="footnote t2">${WT.INTENSITY_INFO[it.intensity].name}</span>`, chev: true })}
        ${H.li({ act: 'exDetail', attrs: `data-id="${ex.id}"`, title: 'Details and history', chev: true })}
        ${H.li({ act: 'planLock', attrs: `data-uid="${it.uid}"`, title: it.locked ? 'Unlock' : 'Lock', sub: 'Locked exercises stay when you regenerate' })}
        ${H.li({ act: 'planRemove', attrs: `data-uid="${it.uid}"`, title: 'Remove', cls: 'danger' })}
      </div>`,
    }));
  };
  A.planLock = (d) => {
    const it = draftItem(d.uid);
    it.locked = !it.locked;
    WT.save();
    WT.closeSheet(true);
    WT.rerender();
  };
  A.planRemove = (d) => {
    const dr = WT.db.draft;
    dr.exercises = dr.exercises.filter((i) => i.uid !== d.uid);
    const left = {};
    dr.exercises.forEach((i) => i.superset && (left[i.superset] = (left[i.superset] || 0) + 1));
    dr.exercises.forEach((i) => {
      if (i.superset && left[i.superset] < 2) i.superset = null;
    });
    dr.estimatedMin = WT.estimateMinutes(dr.exercises);
    WT.save();
    WT.closeSheet(true);
    WT.rerender();
  };

  /* Intensity picker */
  A.pickIntensity = (d) => {
    const ctx = d.ctx, uid = d.uid;
    WT.closeSheet(true);
    WT.openSheet(() => {
      const w = ctx === 'active' ? WT.db.active : WT.db.draft;
      const it = w && w.exercises.find((e) => e.uid === uid);
      if (!it) return { title: '' };
      const ex = WT.ex(it.exId);
      return {
        eyebrow: esc(ex.name),
        title: 'Intensity',
        body: `<div class="list inset">${WT.INTENSITIES.map((k) => {
          const ok = ex.intensities.includes(k);
          const pr = ok ? WT.prescribe(ex, k) : null;
          const info = WT.INTENSITY_INFO[k];
          return H.li({
            act: 'setIntensity',
            cls: it.intensity === k ? 'on' : '',
            attrs: `data-k="${k}" ${ok ? '' : 'disabled'}`,
            title: `<span class="int ${k}" style="font-size:15px">${info.name}</span>`,
            sub: ok ? `${H.target(Object.assign({}, pr, { targetSets: pr.sets }), ex)}${pr.rest ? ` · ${WT.fmtClock(pr.rest)} rest` : ''} — ${info.text}` : 'Not suitable for this exercise',
            trail: it.intensity === k ? `<span class="accent">${I('check', 18)}</span>` : '',
          });
        }).join('')}</div>`,
      };
    });
    A.setIntensity = (dd) => {
      const w = ctx === 'active' ? WT.db.active : WT.db.draft;
      const it = w.exercises.find((e) => e.uid === uid);
      const pr = WT.prescribe(WT.ex(it.exId), dd.k);
      if (ctx === 'active') Object.assign(it, { intensity: pr.intensity, repMin: pr.repMin, repMax: pr.repMax, rest: pr.rest, note: pr.note, recApplied: false });
      else {
        Object.assign(it, pr);
        w.estimatedMin = WT.estimateMinutes(w.exercises);
      }
      WT.save();
      WT.closeSheet();
      WT.rerender();
    };
  };

  A.startDraft = () => {
    const d = WT.db.draft;
    if (!d || !d.exercises.length) return WT.toast('Generate a workout first', 'error');
    const begin = () => {
      WT.db.active = WT.sessionFromWorkout(d);
      WT.warmDemos(d.exercises.map((e) => e.exId));
      WT.db.draft = null;
      WT.unlockAudio();
      WT.save(true);
      WT.go('workout');
    };
    if (WT.db.active) WT.confirm('Replace current workout?', 'A workout is already in progress. Starting this one will discard it.', 'Discard and start', begin, true);
    else begin();
  };

  A.openExcluded = () => {
    WT.closeSheet(true);
    WT.openSheet(() => {
      const p = WT.db.profile;
      const list = p.excluded.map((id) => WT.ex(id)).filter(Boolean);
      return {
        title: 'Exclusions',
        body: `<div class="list-head" style="padding-left:0">Movement restrictions</div>
          <div class="list inset">${Object.entries(WT.RESTRICTION_TAGS).map(([k, v]) => H.li({ title: esc(v), trail: H.toggle(p.restrictions.includes(k), 'toggleRestriction', `data-k="${k}"`) })).join('')}</div>
          <div class="list-head mt24" style="padding-left:0">Excluded exercises</div>
          ${list.length ? `<div class="list inset">${list.map((ex) => H.li({ title: esc(ex.name), sub: WT.muscleName(ex.primary), trail: `<button class="btn btn-plain btn-sm" data-act="unexclude" data-id="${ex.id}">Restore</button>` })).join('')}</div>` : `<p class="footnote t3">None. You can exclude exercises from Exercises or when swapping.</p>`}`,
      };
    });
  };
  A.toggleRestriction = (d) => {
    const p = WT.db.profile;
    p.restrictions = toggleIn(p.restrictions, d.k);
    WT.save();
    WT.refreshSheet();
    WT.rerender();
  };
  A.unexclude = (d) => {
    WT.db.profile.excluded = WT.db.profile.excluded.filter((x) => x !== d.id);
    WT.save();
    WT.refreshSheet();
    WT.rerender();
  };

  /* ═════════════════════ SWAP & ADD ═════════════════════ */
  const ctxWorkout = (ctx) => (ctx === 'active' ? WT.db.active : WT.db.draft);
  A.openSwap = (d) => {
    const state = { wide: false };
    const ctx = d.ctx, uid = d.uid;
    WT.closeSheet(true);
    WT.openSheet(() => {
      const w = ctxWorkout(ctx);
      const item = w && w.exercises.find((e) => e.uid === uid);
      if (!item) return { title: 'Swap' };
      const cur = WT.ex(item.exId);
      const alts = WT.alternatives(w, uid, { wide: state.wide }).slice(0, 40);
      const doneCount = ctx === 'active' ? item.sets.filter((s) => s.done).length : 0;
      return {
        eyebrow: 'Replace ' + esc(cur.name),
        title: 'Swap exercise',
        body: `${H.seg([[0, 'Same movement'], [1, 'Same muscle group']], state.wide ? 1 : 0, 'swapWide', '', 'full')}
          ${doneCount ? `<div class="callout warn mt12">${I('info', 15)}<span>${plural(doneCount, 'logged set')} on this exercise will be cleared.</span></div>` : ''}
          <div class="list inset mt16">${
            alts.length
              ? alts.map((a) => H.li({ act: 'doSwap', attrs: `data-id="${a.ex.id}"`, lead: H.demo(a.ex.id, 'sm', { static: true }), title: esc(a.ex.name) + (WT.db.profile.favorites.includes(a.ex.id) ? ' <span class="star on">★</span>' : ''), sub: `${WT.muscleName(a.ex.primary)} · ${a.ex.equipment.map((q) => WT.EQUIPMENT[q]).join(', ')}` })).join('')
              : `<div class="li"><div class="grow su">No alternatives with your equipment and exclusions.</div></div>`
          }</div>
          <p class="footnote t3 mt12">Keeps its place, set count and intensity where suitable. <button class="btn-link" data-act="excludeFromSwap" data-id="${cur.id}">Never suggest ${esc(cur.name)}</button></p>`,
      };
    });
    A.swapWide = (dd) => {
      state.wide = dd.v === '1';
      WT.refreshSheet();
    };
    A.doSwap = (dd) => {
      const w = ctxWorkout(ctx);
      const idx = w.exercises.findIndex((e) => e.uid === uid);
      if (idx < 0) return;
      const old = w.exercises[idx];
      if (ctx === 'active') {
        const ex = WT.ex(dd.id);
        const pr = WT.prescribe(ex, WT.nearestIntensity(ex, old.intensity || 'standard'));
        if (WT.trackType(ex) !== 'cardio') pr.sets = old.targetSets;
        const ni = WT.sessionItem(dd.id, pr);
        ni.superset = old.superset;
        ni.uid = old.uid;
        w.exercises[idx] = ni;
      } else {
        WT.applySwap(old, dd.id);
        w.estimatedMin = WT.estimateMinutes(w.exercises);
      }
      WT.save();
      WT.closeSheet();
      WT.rerender();
      WT.toast('Swapped in ' + WT.ex(dd.id).name);
    };
    A.excludeFromSwap = (dd) => {
      const p = WT.db.profile;
      if (!p.excluded.includes(dd.id)) p.excluded.push(dd.id);
      WT.save();
      WT.toast('Won’t be suggested again');
      WT.refreshSheet();
    };
  };

  A.openAdd = (d) => {
    const state = { q: '', mine: true };
    const ctx = d.ctx;
    WT.closeSheet(true);
    WT.openSheet(() => {
      const q = state.q.toLowerCase();
      const list = WT.exercises
        .filter((ex) => (!state.mine || (WT.hasEquipment(ex) && !WT.isRestricted(ex))) && (!q || ex.name.toLowerCase().includes(q) || WT.muscleName(ex.primary).toLowerCase().includes(q)))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 60);
      return {
        title: 'Add exercise',
        body: `<div class="search"><span>${I('search', 16)}</span><input class="input" id="addSearch" placeholder="Search" value="${esc(state.q)}" data-in="addSearch" autocomplete="off"></div>
          <div class="row between mt12"><span class="footnote t2">Only what I can do</span>${H.toggle(state.mine, 'addMine')}</div>
          <div class="list inset mt12">${list.map((ex) => H.li({ act: 'doAdd', attrs: `data-id="${ex.id}"`, lead: H.demo(ex.id, 'sm', { static: true }), title: esc(ex.name), sub: WT.muscleName(ex.primary), trail: `<span class="t3">${I('plus', 16)}</span>` })).join('') || '<div class="li"><div class="su">No matches.</div></div>'}</div>`,
        after: (sheet) => {
          const inp = sheet.querySelector('#addSearch');
          if (state.focus && inp) {
            inp.focus();
            inp.setSelectionRange(inp.value.length, inp.value.length);
          }
        },
      };
    });
    WT.I.addSearch = (el, ev) => {
      if (ev.type !== 'input') return;
      state.q = el.value;
      state.focus = true;
      WT.refreshSheet();
    };
    A.addMine = () => {
      state.mine = !state.mine;
      WT.refreshSheet();
    };
    A.doAdd = (dd) => {
      const ex = WT.ex(dd.id);
      if (ctx === 'active') {
        const it = WT.sessionItem(ex.id);
        WT.db.active.exercises.push(it);
        WT.db.active.focus = it.uid;
      } else {
        if (!WT.db.draft) WT.db.draft = { id: WT.uid(), type: gen().type, title: WT.typeName(gen().type), createdAt: new Date().toISOString(), settings: gen(), notes: [], exercises: [] };
        WT.db.draft.exercises.push(Object.assign({ uid: WT.uid(), exId: ex.id, slot: { label: WT.muscleName(ex.primary), m: [ex.primary], p: null }, slotIndex: 99, why: ['Added by you'], locked: true }, WT.prescribe(ex, ex.intensity)));
        WT.db.draft.estimatedMin = WT.estimateMinutes(WT.db.draft.exercises);
      }
      WT.save();
      WT.closeSheet();
      WT.rerender();
      WT.toast('Added ' + ex.name);
    };
  };

  /* ═════════════════════ TRAIN ═════════════════════ */
  const actItem = (uid) => WT.db.active && WT.db.active.exercises.find((e) => e.uid === uid);
  function currentItem(a) {
    const f = a.exercises.find((e) => e.uid === a.focus && !e.skipped);
    if (f) return f;
    return a.exercises.find((e) => !e.skipped && e.sets.some((s) => !s.done)) || a.exercises.find((e) => !e.skipped) || null;
  }
  WT.currentItem = currentItem;
  const editIndex = (it) => (it.edit != null && it.sets[it.edit] ? it.edit : it.sets.findIndex((s) => !s.done));

  /** Values shown in the editor when a field is blank: previous set → last session → targets. Never raises weight on its own. */
  function defaults(it, i, ctx) {
    const ex = WT.ex(it.exId);
    const tt = WT.trackType(ex);
    const prevSet = it.sets.slice(0, i).reverse().find((s) => s.done);
    const last = ctx.last;
    const ls = last ? last.sets[Math.min(i, last.sets.length - 1)] : null;
    const rec = ctx.rec;
    let w = '';
    if (it.recApplied && rec && (rec.weight != null || rec.addLoad)) w = rec.weight != null ? rec.weight : rec.addLoad;
    else if (prevSet && prevSet.w !== '' && prevSet.w != null) w = prevSet.w;
    else if (ls && ls.w) w = ls.w;
    else if (tt === 'reps') w = 0;
    let r = rec && rec.repTargets && rec.repTargets[i] != null ? rec.repTargets[i] : ls ? ls.r : it.repMax;
    if (tt === 'time') r = ls ? ls.r : it.repMax;
    return { w, r, time: ls ? ls.time || it.repMax : it.repMax, dist: ls ? ls.dist || '' : '' };
  }
  const val = (s, f, d) => (s[f] !== '' && s[f] != null ? s[f] : d[f]);

  V.workout = function () {
    const a = WT.db.active;
    if (!a)
      return `<div class="page"><div class="head"><h1 class="large-title">Train</h1><p class="sub">No workout in progress.</p></div>
        <div class="row wrap" style="gap:10px">
          ${WT.db.draft ? `<button class="btn btn-primary btn-lg" data-act="startDraft">Start ${esc(WT.db.draft.title)}</button>` : `<a class="btn btn-primary btn-lg" href="#/generate">${I('sparkles', 18)}Generate workout</a>`}
          <button class="btn btn-secondary btn-lg" data-act="startEmpty">Empty workout</button>
          <button class="btn btn-plain btn-lg" data-act="logRun">Log a run</button>
        </div></div>`;
    const done = doneSets(a), total = totalSets(a);
    const it = currentItem(a);
    const ask = a.askEffort && actItem(a.askEffort);

    const next = a.exercises
      .map((e, k) => {
        const ex = WT.ex(e.exId);
        if (!ex) return '';
        const d = e.sets.filter((s) => s.done).length;
        const complete = e.sets.length && d === e.sets.length;
        const cls = e.skipped ? 'skipped' : complete ? 'done' : e === it ? 'current' : '';
        return `<button class="next-row ${cls}" data-act="woFocus" data-uid="${e.uid}">
          <span class="state">${complete ? I('check', 13) : k + 1}</span>
          <div style="min-width:0"><div class="ti ellipsis">${esc(ex.name)}</div><div class="su">${e.skipped ? 'Skipped' : H.target({ sets: e.targetSets, repMin: e.repMin, repMax: e.repMax }, ex)}${e.superset ? ` · Superset ${e.superset}` : ''}</div></div>
          <span class="cnt">${e.skipped ? '' : `${d}/${e.sets.length}`}</span></button>`;
      })
      .join('');

    return `<div class="page">
      <div class="train-head"><div><div class="footnote t3">${esc(WT.typeName(a.type))}</div><h1 class="title2">${esc(a.title)}</h1></div>
        <div class="row" style="gap:6px"><span class="clock t2" id="woClock" style="margin-right:8px">${WT.fmtClock((Date.now() - new Date(a.startedAt)) / 1000)}</span>
          <button class="icon-btn" data-act="woTimerMenu" title="Rest timer" aria-label="Rest timer">${I('timer', 18)}</button>
          <button class="btn btn-primary" data-act="woFinish">Finish</button></div></div>
      <div class="progress" role="progressbar" aria-label="Sets completed" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${total}"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div>
      <div class="footnote t3 tnum mt8">${done} of ${total} sets</div>
      ${ask ? effortPrompt(ask) : ''}
      <div class="mt16">${it ? current(it, a) : `<div class="empty"><h3>Empty workout</h3><p>Add an exercise to start logging.</p></div>`}</div>
      <section class="section">
        <div class="section-title"><h2>Exercises</h2><button class="btn-link footnote" data-act="openAdd" data-ctx="active">Add</button></div>
        <div class="list">${next}</div>
      </section>
      <section class="section">
        <textarea class="input" data-in="sessionNotes" placeholder="Workout notes" style="min-height:72px">${esc(a.notes || '')}</textarea>
        <button class="btn btn-primary btn-lg btn-block mt16" data-act="woFinish">Finish workout</button>
        <div style="text-align:center" class="mt12"><button class="btn btn-plain btn-sm" data-act="woDiscard">Discard workout</button></div>
      </section>
    </div>`;
  };

  function effortPrompt(it) {
    const ex = WT.ex(it.exId);
    return `<div class="effort fade-in"><span>How did <span class="strong" style="color:var(--text)">${esc(ex.name)}</span> feel?</span>${H.seg([['easy', 'Easy'], ['good', 'Solid'], ['hard', 'Hard']], it.effort || '', 'woEffort', it.uid)}<button class="icon-btn sm" data-act="dismissEffort" aria-label="Dismiss">${I('x', 15)}</button></div>`;
  }

  function current(it, a) {
    const ex = WT.ex(it.exId);
    if (!ex) return '';
    const tt = WT.trackType(ex);
    const u = WT.db.profile.unit;
    const hist = WT.exerciseHistory(ex.id, a.id);
    const last = hist[hist.length - 1];
    const rec = WT.recommend(ex.id, { repMin: it.repMin, repMax: it.repMax, sets: it.targetSets, intensity: it.intensity }, a.id);
    const ctx = { last, rec };
    const ei = editIndex(it);
    const secUnit = tt === 'time' || ex.unit === 'sec';
    const allDone = it.sets.length && it.sets.every((s) => s.done);
    const fmt = (s, d) => {
      if (tt === 'cardio') return `${val(s, 'time', d) || '–'} min${val(s, 'dist', d) ? ' · ' + val(s, 'dist', d) + ' mi' : ''}`;
      if (tt === 'time') return `${val(s, 'r', d)} s`;
      const w = +val(s, 'w', d);
      if (tt === 'reps') return `${w ? '+' + WT.fmtNum(w) + ' ' + u + ' × ' : ''}${val(s, 'r', d)} reps`;
      return `${val(s, 'w', d) === '' ? '—' : WT.fmtNum(w) + ' ' + u} × ${val(s, 'r', d)}${secUnit ? 's' : ''}`;
    };

    const setLines = it.sets
      .map((s, i) => {
        const d = defaults(it, i, ctx);
        const editing = i === ei;
        const fresh = WT.ui.justSet === it.uid + ':' + i;
        const cls = `${s.done ? 'done' : 'todo'} ${editing ? 'editing' : ''} ${fresh ? 'fresh' : ''}`;
        return `<button class="set-line ${cls}" data-act="woEditSet" data-uid="${it.uid}" data-i="${i}" aria-label="Set ${i + 1}"><span class="sn">${i + 1}</span><span class="sv">${fmt(s, d)}</span><span class="ck">${s.done ? I('check', 13) : ''}</span></button>`;
      })
      .join('');

    let editor = '';
    if (ei >= 0) {
      const s = it.sets[ei];
      const d = defaults(it, ei, ctx);
      const field = (f, label, step, mode) => `<div class="field-num">
          <button data-act="adj" data-uid="${it.uid}" data-i="${ei}" data-f="${f}" data-d="-1" aria-label="Decrease ${label}">${I('minus', 20)}</button>
          <input type="text" inputmode="${mode || 'decimal'}" data-in="setVal" data-uid="${it.uid}" data-i="${ei}" data-f="${f}" value="${esc(val(s, f, d))}" aria-label="${label}" autocomplete="off">
          <span class="u">${label}</span>
          <button data-act="adj" data-uid="${it.uid}" data-i="${ei}" data-f="${f}" data-d="1" aria-label="Increase ${label}">${I('plus', 20)}</button></div>`;
      let fields;
      if (tt === 'cardio') fields = `<div class="fields">${field('time', 'minutes')}${field('dist', 'miles')}</div>`;
      else if (tt === 'time') fields = `<div class="fields one">${field('r', 'seconds', 1, 'numeric')}</div>`;
      else if (ex.load === 'bw') fields = `<div class="fields one">${field('r', 'reps', 1, 'numeric')}</div>`;
      else fields = `<div class="fields">${field('w', tt === 'reps' ? 'added ' + u : u)}${field('r', secUnit ? 'seconds' : 'reps', 1, 'numeric')}</div>`;
      const editingDone = s.done;
      const ls = last ? last.sets[Math.min(ei, last.sets.length - 1)] : null;
      editor = `<div class="editor">
        <div class="editor-label"><span>${editingDone ? 'Edit set ' + (ei + 1) : 'Set ' + (ei + 1) + ' of ' + it.sets.length}</span>${ls ? `<span class="t3">Last time ${fmt(ls, {})}</span>` : ''}</div>
        ${fields}
        ${
          editingDone
            ? `<div class="row complete" style="gap:8px"><button class="btn btn-secondary btn-lg grow" data-act="woUndoSet" data-uid="${it.uid}" data-i="${ei}">Mark not done</button><button class="btn btn-primary btn-lg grow" data-act="woCheck" data-uid="${it.uid}" data-i="${ei}">Save</button></div>`
            : `<button class="btn btn-primary btn-lg btn-block complete" data-act="woCheck" data-uid="${it.uid}" data-i="${ei}">${I('check', 19)}Complete set</button>`
        }</div>`;
    } else if (allDone) {
      const nxt = a.exercises.find((e) => !e.skipped && e.sets.some((s) => !s.done));
      editor = `<div class="editor"><div class="row between wrap" style="gap:12px"><span class="strong accent">${I('check', 16).replace('<svg', '<svg style="display:inline;vertical-align:-3px;margin-right:6px"')}Exercise complete</span>
        ${nxt ? `<button class="btn btn-primary" data-act="woFocus" data-uid="${nxt.uid}">Next: ${esc(WT.ex(nxt.exId).name)}</button>` : `<button class="btn btn-primary" data-act="woFinish">Finish workout</button>`}</div></div>`;
    }

    const recIcon = { increase: 'trendUp', progress: 'trendUp', decrease: 'trendDown', hold: 'equal', reps: 'plus', return: 'refresh' }[rec.action] || 'info';
    const lastTop = last ? last.metrics.topWeight : null;
    const canApply = (rec.weight != null && rec.weight !== lastTop && (tt === 'weight' || (tt === 'reps' && rec.weight > 0))) || (rec.addLoad && tt === 'reps');
    const advice =
      allDone || it.skipped
        ? ''
        : `<div class="advice ${rec.action}"><span class="ic">${I(recIcon, 17)}</span><div class="grow"><div class="h">${esc(rec.headline)}</div>
          <details><summary>Why</summary>${rec.reasons.map((r) => `<p>${esc(r)}</p>`).join('')}</details></div>
          ${canApply ? (it.recApplied ? `<span class="applied">Applied</span>` : `<button class="btn btn-secondary btn-sm" data-act="woApplyRec" data-uid="${it.uid}">Apply</button>`) : ''}</div>`;

    return `<div class="panel cur" id="ex-${it.uid}">
      <div class="cur-top"><div class="grow">
          ${it.superset ? `<div class="cur-over">Superset ${it.superset}</div>` : ''}
          <h2><button data-act="exDetail" data-id="${ex.id}">${esc(ex.name)}</button></h2>
          <div class="cur-meta"><span class="rx">${H.target({ sets: it.targetSets, repMin: it.repMin, repMax: it.repMax }, ex)}</span>${it.rest ? `<span>${WT.fmtClock(it.rest)} rest</span>` : ''}${H.intensity(it.intensity, 'pickIntensity', it.uid, 'active')}</div>
        </div>
        <div class="row" style="gap:0;margin:-6px -8px 0 0">
          <button class="icon-btn" data-act="openSwap" data-ctx="active" data-uid="${it.uid}" title="Swap" aria-label="Swap exercise">${I('swap', 18)}</button>
          <button class="icon-btn" data-act="woMenu" data-uid="${it.uid}" aria-label="More options">${I('more', 19)}</button>
        </div></div>
      ${WT.db.profile.trainDemos !== false ? `<div class="cur-demo">${H.demo(ex.id, 'md')}${H.demoCredit(ex.id)}</div>` : ''}
      ${advice}
      <div class="sets">${setLines}</div>
      ${editor}
      ${it.showNotes || it.notes ? `<textarea class="input mt12" style="min-height:60px" data-in="exNotes" data-uid="${it.uid}" placeholder="Notes for this exercise">${esc(it.notes || '')}</textarea>` : ''}
    </div>`;
  }
  function fmtSets(sets, tt, ex) {
    if (tt === 'cardio') return sets.map((s) => `${s.time || 0} min${s.dist ? ' · ' + s.dist + ' mi' : ''}`).join(', ');
    if (tt === 'time' || (ex && ex.unit === 'sec' && !sets.some((s) => s.w))) return sets.map((s) => s.r + 's').join(', ');
    const allSameW = sets.every((s) => s.w === sets[0].w);
    if (!sets[0].w && allSameW) return sets.map((s) => s.r).join(', ') + ' reps';
    if (allSameW) return `${WT.fmtNum(sets[0].w)} × ${sets.map((s) => s.r).join(', ')}`;
    return sets.map((s) => `${WT.fmtNum(s.w)}×${s.r}`).join(', ');
  }
  WT.fmtSets = fmtSets;

  function ctxFor(it) {
    const a = WT.db.active;
    const hist = WT.exerciseHistory(it.exId, a.id);
    return { last: hist[hist.length - 1], rec: WT.recommend(it.exId, { repMin: it.repMin, repMax: it.repMax, sets: it.targetSets, intensity: it.intensity }, a.id) };
  }
  /** Step a value up/down: dumbbells move to the next one you own; reps by one. */
  function stepValue(ex, f, v, dir) {
    v = +v || 0;
    if (f === 'r') return Math.max(0, v + dir * (WT.trackType(ex) === 'time' ? 5 : 1));
    if (f === 'time') return Math.max(0, v + dir);
    if (f === 'dist') return Math.max(0, WT.round(v + dir * 0.1, 1));
    if (ex.load === 'db') {
      const ws = WT.dumbbellWeights();
      if (dir > 0) return ws.find((x) => x > v + 1e-6) != null ? ws.find((x) => x > v + 1e-6) : v;
      const below = ws.filter((x) => x < v - 1e-6);
      return below.length ? below[below.length - 1] : 0;
    }
    const p = WT.db.profile;
    const step = ex.load === 'cable' || ex.load === 'machine' ? +p.cableStep || 5 : ex.load === 'mb' ? 2 : p.unit === 'kg' ? 2.5 : 5;
    return Math.max(0, WT.round(v + dir * step, 2));
  }
  A.adj = (d) => {
    const it = actItem(d.uid);
    const s = it.sets[+d.i];
    const cur = val(s, d.f, defaults(it, +d.i, ctxFor(it)));
    s[d.f] = String(stepValue(WT.ex(it.exId), d.f, cur, +d.d));
    WT.save();
    WT.rerender();
  };
  WT.I.setVal = (el) => {
    const it = actItem(el.dataset.uid);
    if (!it) return;
    const v = el.value.replace(',', '.').replace(/[^0-9.]/g, '');
    if (v !== el.value) el.value = v;
    it.sets[+el.dataset.i][el.dataset.f] = v;
    WT.save();
  };
  WT.I.exNotes = (el) => {
    const it = actItem(el.dataset.uid);
    if (it) {
      it.notes = el.value;
      WT.save();
    }
  };
  WT.I.sessionNotes = (el) => {
    if (WT.db.active) {
      WT.db.active.notes = el.value;
      WT.save();
    }
  };
  A.woFocus = (d) => {
    WT.db.active.focus = d.uid;
    const it = actItem(d.uid);
    if (it.skipped) it.skipped = false;
    it.edit = null;
    WT.save();
    WT.rerender();
    const el = document.getElementById('ex-' + d.uid);
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  A.woEditSet = (d) => {
    const it = actItem(d.uid);
    const i = +d.i;
    it.edit = it.sets[i].done || i !== it.sets.findIndex((s) => !s.done) ? i : null;
    WT.save();
    WT.rerender();
  };
  A.woUndoSet = (d) => {
    const it = actItem(d.uid);
    it.sets[+d.i].done = false;
    it.edit = null;
    WT.ui.justSet = null;
    WT.save();
    WT.rerender();
  };
  A.woCheck = (d) => {
    WT.unlockAudio();
    const a = WT.db.active;
    const it = actItem(d.uid);
    const ex = WT.ex(it.exId);
    const tt = WT.trackType(ex);
    const i = +d.i;
    const s = it.sets[i];
    const df = defaults(it, i, ctxFor(it));
    ['w', 'r', 'time', 'dist'].forEach((f) => {
      if ((s[f] === '' || s[f] == null) && df[f] !== '' && df[f] != null) s[f] = String(df[f]);
    });
    if (tt === 'weight' && (s.w === '' || s.w == null)) return WT.toast('Enter the weight', 'error');
    if (tt !== 'cardio' && !(+s.r > 0)) return WT.toast(tt === 'time' ? 'Enter seconds held' : 'Enter reps', 'error');
    if (tt === 'cardio' && !(+s.time > 0) && !(+s.dist > 0)) return WT.toast('Enter time or distance', 'error');
    const wasEditing = s.done;
    s.done = true;
    s.at = s.at || new Date().toISOString();
    it.edit = null;
    if (wasEditing) {
      WT.save();
      WT.rerender();
      return WT.toast('Set updated');
    }
    WT.ui.justSet = it.uid + ':' + i;
    a.askEffort = null;
    if (tt !== 'cardio' && s.w !== '') it.sets.slice(i + 1).forEach((x) => !x.done && (x.w === '' || x.w == null) && (x.w = s.w));
    const exComplete = it.sets.every((x) => x.done);
    const remaining = a.exercises.some((e) => !e.skipped && e.sets.some((x) => !x.done));

    // Supersets alternate: go to the partner that's behind; rest once the round is complete
    let rest = it.rest && tt !== 'cardio';
    if (it.superset) {
      const group = a.exercises.filter((e) => e.superset === it.superset && !e.skipped && e.sets.some((x) => !x.done));
      const doneOf = (e) => e.sets.filter((x) => x.done).length;
      const behind = group.filter((e) => e !== it && doneOf(e) < doneOf(it));
      if (behind.length) {
        a.focus = behind[0].uid;
        rest = false;
        WT.toast('Now ' + WT.ex(behind[0].exId).name);
      } else if (group.length) a.focus = group.sort((x, y) => doneOf(x) - doneOf(y))[0].uid;
    }
    if (exComplete) {
      if (tt !== 'cardio') a.askEffort = it.uid;
      const nxt = a.exercises.find((e) => !e.skipped && e.sets.some((x) => !x.done) && (!it.superset || e.superset !== it.superset || true));
      if (nxt && (!it.superset || !a.exercises.some((e) => e.superset === it.superset && e.sets.some((x) => !x.done)))) a.focus = nxt.uid;
    }
    if (!remaining) {
      rest = false;
      WT.toast('All sets done — finish when you’re ready');
    }
    if (rest) WT.startTimer(exComplete ? Math.min(it.rest, 120) : it.rest, exComplete ? 'Next exercise' : 'Rest');
    WT.save();
    WT.rerender();
  };
  A.dismissEffort = () => {
    WT.db.active.askEffort = null;
    WT.save();
    WT.rerender();
  };
  A.woEffort = (d) => {
    const it = actItem(d.k);
    it.effort = it.effort === d.v ? null : d.v;
    WT.db.active.askEffort = null;
    WT.save();
    WT.rerender();
  };
  A.woApplyRec = (d) => {
    const it = actItem(d.uid);
    const rec = WT.recommend(it.exId, { repMin: it.repMin, repMax: it.repMax, sets: it.targetSets, intensity: it.intensity }, WT.db.active.id);
    const w = rec.weight != null ? rec.weight : rec.addLoad || null;
    if (w == null) return;
    it.sets.forEach((s) => {
      if (!s.done) s.w = String(w);
    });
    it.recApplied = true;
    WT.save();
    WT.rerender();
    WT.toast(`Set to ${WT.fmtNum(w)} ${WT.db.profile.unit}`);
  };
  A.woAddSet = (d) => {
    const it = actItem(d.uid);
    const lastSet = it.sets[it.sets.length - 1];
    it.sets.push({ w: lastSet ? lastSet.w : '', r: '', done: false });
    WT.db.active.focus = it.uid;
    WT.closeSheet(true);
    WT.save();
    WT.rerender();
  };
  A.woRemoveSet = (d) => {
    const it = actItem(d.uid);
    if (it.sets.length < 2) return;
    let idx = -1;
    for (let k = it.sets.length - 1; k >= 0; k--)
      if (!it.sets[k].done) {
        idx = k;
        break;
      }
    if (idx < 0) idx = it.sets.length - 1;
    it.sets.splice(idx, 1);
    it.edit = null;
    WT.closeSheet(true);
    WT.save();
    WT.rerender();
  };
  A.woNoteToggle = (d) => {
    const it = actItem(d.uid);
    it.showNotes = true;
    WT.db.active.focus = it.uid;
    WT.closeSheet(true);
    WT.save();
    WT.rerender();
    setTimeout(() => {
      const t = document.querySelector(`[data-in="exNotes"][data-uid="${d.uid}"]`);
      if (t) t.focus();
    }, 40);
  };
  A.woSkip = (d) => {
    const a = WT.db.active;
    const it = actItem(d.uid);
    it.skipped = !it.skipped;
    if (it.skipped && a.focus === it.uid) a.focus = null;
    WT.closeSheet(true);
    WT.save();
    WT.rerender();
  };
  A.woMenu = (d) => {
    const it = actItem(d.uid);
    const ex = WT.ex(it.exId);
    const a = WT.db.active;
    const idx = a.exercises.indexOf(it);
    const u = `data-uid="${it.uid}"`;
    WT.openSheet(() => ({
      eyebrow: WT.muscleName(ex.primary),
      title: esc(ex.name),
      body: `<div class="list inset">
          ${H.li({ act: 'openSwap', attrs: `data-ctx="active" ${u}`, title: 'Replace exercise', chev: true })}
          ${H.li({ act: 'exDetail', attrs: `data-id="${ex.id}"`, title: 'Video, details and history', chev: true })}
          ${H.li({ act: 'pickIntensity', attrs: `data-ctx="active" ${u}`, title: 'Intensity', trail: `<span class="footnote t2">${WT.INTENSITY_INFO[it.intensity] ? WT.INTENSITY_INFO[it.intensity].name : ''}</span>`, chev: true })}
        </div>
        <div class="list inset mt16">
          ${H.li({ act: 'woAddSet', attrs: u, title: 'Add a set' })}
          ${it.sets.length > 1 ? H.li({ act: 'woRemoveSet', attrs: u, title: 'Remove a set' }) : ''}
          ${H.li({ act: 'woNoteToggle', attrs: u, title: 'Add a note' })}
          ${H.li({ act: 'toggleTrainDemos', title: WT.db.profile.trainDemos !== false ? 'Hide demonstrations' : 'Show demonstrations', sub: 'While training' })}
          ${idx > 0 ? H.li({ act: 'woMove', attrs: `${u} data-d="-1"`, title: 'Move up' }) : ''}
          ${idx < a.exercises.length - 1 ? H.li({ act: 'woMove', attrs: `${u} data-d="1"`, title: 'Move down' }) : ''}
          ${it.superset ? H.li({ act: 'woUnpair', attrs: u, title: 'Split superset' }) : ''}
        </div>
        <div class="list inset mt16">
          ${H.li({ act: 'woSkip', attrs: u, title: it.skipped ? 'Restore exercise' : 'Skip exercise' })}
          ${H.li({ act: 'woRemove', attrs: u, title: 'Remove from workout', cls: 'danger' })}
        </div>`,
    }));
  };
  A.toggleTrainDemos = () => {
    WT.db.profile.trainDemos = WT.db.profile.trainDemos === false;
    WT.save();
    WT.closeSheet(true);
    WT.rerender();
  };
  A.woMove = (d) => {
    const a = WT.db.active;
    const i = a.exercises.findIndex((e) => e.uid === d.uid);
    const j = i + +d.d;
    if (j < 0 || j >= a.exercises.length) return;
    [a.exercises[i], a.exercises[j]] = [a.exercises[j], a.exercises[i]];
    fixSupersets(a.exercises);
    WT.closeSheet();
    WT.save();
    WT.rerender();
  };
  function fixSupersets(list) {
    list.forEach((e, k) => {
      if (!e.superset) return;
      const adj = (list[k - 1] && list[k - 1].superset === e.superset) || (list[k + 1] && list[k + 1].superset === e.superset);
      if (!adj) e.superset = null;
    });
  }
  A.woUnpair = (d) => {
    const L = actItem(d.uid).superset;
    WT.db.active.exercises.forEach((e) => {
      if (e.superset === L) e.superset = null;
    });
    WT.closeSheet();
    WT.save();
    WT.rerender();
  };
  A.woRemove = (d) => {
    const a = WT.db.active;
    a.exercises = a.exercises.filter((e) => e.uid !== d.uid);
    if (a.focus === d.uid) a.focus = null;
    fixSupersets(a.exercises);
    WT.closeSheet(true);
    WT.save();
    WT.rerender();
  };
  A.woTimerMenu = () => {
    const p = WT.db.profile;
    WT.openSheet(() => ({
      title: 'Rest timer',
      body: `<p class="t2">Starts automatically after each set. Or start one now.</p>
        <div class="row wrap mt16" style="gap:8px">${[30, 60, 90, 120, 150, 180].map((s) => `<button class="btn btn-secondary tnum" style="min-width:72px" data-act="timerPreset" data-s="${s}">${WT.fmtClock(s)}</button>`).join('')}</div>
        <div class="list inset mt24">${H.li({ title: 'Sound and vibration', trail: H.toggle(p.timerSound, 'toggleSound') })}</div>`,
    }));
  };
  A.timerPreset = (d) => {
    WT.startTimer(+d.s, 'Rest');
    WT.closeSheet();
  };
  A.toggleSound = () => {
    WT.db.profile.timerSound = !WT.db.profile.timerSound;
    WT.save();
    WT.refreshSheet();
  };
  A.startEmpty = () => {
    WT.db.active = { id: WT.uid(), type: 'custom', title: 'Workout', startedAt: new Date().toISOString(), notes: '', exercises: [] };
    WT.save(true);
    WT.rerender();
    A.openAdd({ ctx: 'active' });
  };
  A.woDiscard = () =>
    WT.confirm('Discard workout?', 'All sets logged in this workout will be lost.', 'Discard', () => {
      WT.db.active = null;
      WT.save(true);
      WT.go('dashboard');
    }, true);

  A.woFinish = () => {
    const a = WT.db.active;
    if (!a) return;
    const done = doneSets(a), total = totalSets(a);
    let volume = 0;
    a.exercises.forEach((e) => e.sets.forEach((s) => s.done && (volume += (+s.w || 0) * (+s.r || 0))));
    WT.openSheet(() => ({
      title: 'Finish workout?',
      body: `<div class="summary">
          <div class="metric"><div class="v">${WT.fmtDuration((Date.now() - new Date(a.startedAt)) / 1000)}</div><div class="k">Duration</div></div>
          <div class="metric"><div class="v">${done}<small>/ ${total}</small></div><div class="k">Sets</div></div>
          <div class="metric"><div class="v">${WT.fmtNum(volume)}<small>${WT.db.profile.unit}</small></div><div class="k">Volume</div></div></div>
        ${done < total ? `<div class="callout mt24">${I('info', 15)}<span>${plural(total - done, 'unfinished set')} won’t be saved.</span></div>` : ''}`,
      foot: `<button class="btn btn-secondary btn-lg grow" data-act="closeSheet">Keep going</button><button class="btn btn-primary btn-lg grow" data-act="woSave" ${done === 0 ? 'disabled' : ''}>Save workout</button>`,
    }));
  };
  A.woSave = () => {
    const a = WT.db.active;
    a.timer = null;
    const s = WT.finishSession(JSON.parse(JSON.stringify(a)));
    s.exercises.forEach((e) => {
      delete e.showNotes;
      delete e.expanded;
      delete e.edit;
    });
    delete s.timer;
    delete s.focus;
    delete s.askEffort;
    WT.db.history.push(s);
    WT.db.active = null;
    WT.ui.justSet = null;
    WT.save(true);
    WT.closeSheet(true);
    WT.go('history', s.id);
    WT.openSheet(() => ({
      title: 'Workout saved',
      body: `<div class="summary">
          <div class="metric"><div class="v">${WT.fmtDuration(s.durationSec)}</div><div class="k">Duration</div></div>
          <div class="metric"><div class="v">${s.totals.sets}</div><div class="k">Sets</div></div>
          <div class="metric"><div class="v">${s.prs.length}</div><div class="k">Personal records</div></div></div>
        ${s.prs.length ? `<div class="list inset mt24">${s.prs.map((r) => H.li({ title: esc(WT.ex(r.exId).name), sub: r.kind, trail: `<span class="tnum strong">${esc(r.value)}</span>` })).join('')}</div>` : `<p class="t2 mt24">Next time, each exercise will suggest where to go from today’s numbers.</p>`}`,
      foot: `<button class="btn btn-primary btn-lg btn-block" data-act="closeSheet">Done</button>`,
    }));
  };
})();
