/* Views: Dashboard, Generate, Active Workout + swap / add sheets. */
(function () {
  const WT = globalThis.WT;
  const I = WT.icon, esc = WT.esc, H = WT.h, A = WT.A, V = WT.V;

  /* ═════════════════════ DASHBOARD ═════════════════════ */
  V.dashboard = function () {
    const p = WT.db.profile;
    const st = WT.stats();
    const week = st.weeks[st.weeks.length - 1];
    const runsThisWeek = countRunsThisWeek();
    const sugg = WT.suggestNext();
    const ss = WT.sessions();
    const last = ss[ss.length - 1];
    const active = WT.db.active;
    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

    const activeCard = active
      ? `<a href="#/workout" class="card hero row" style="gap:16px;border-color:color-mix(in srgb,var(--good) 35%,transparent)">
          <div class="avatar" style="background:var(--good-soft);color:var(--good)">${I('activity', 22)}</div>
          <div class="grow"><div class="eyebrow" style="color:var(--good)">In progress</div><div class="strong" style="font-size:17px">${esc(active.title)}</div>
          <div class="small muted">${doneSets(active)} of ${totalSets(active)} sets · started ${new Date(active.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div></div>
          <span class="btn btn-good">Resume</span></a>`
      : '';

    const quick = ['full', 'push', 'pull', 'legs', 'chest', 'arms', 'core', 'cardio']
      .map((t) => `<button class="chip" data-act="quickGen" data-k="${t}">${WT.typeName(t)}</button>`)
      .join('');

    const lastCard = last
      ? `<a href="#/history/${last.id}" class="card" style="display:block">
          <div class="card-head"><h3>Last workout</h3><span class="link">${WT.fmtRelDay(last.startedAt)} ${I('chevR', 15)}</span></div>
          <div class="strong" style="font-size:17px">${esc(last.title)}</div>
          <div class="row mt8 small muted wrap" style="gap:14px"><span class="row" style="gap:5px">${I('clock', 15)} ${WT.fmtDuration(last.durationSec)}</span>
          <span class="row" style="gap:5px">${I('check', 15)} ${(last.totals && last.totals.sets) || 0} sets</span>
          ${last.totals && last.totals.volume ? `<span class="row" style="gap:5px">${I('dumbbell', 15)} ${WT.fmtNum(last.totals.volume)} ${p.unit}</span>` : ''}
          ${(last.prs || []).length ? `<span class="badge warn">${I('trophy', 12)} ${last.prs.length} PR${last.prs.length > 1 ? 's' : ''}</span>` : ''}</div>
          <div class="mt12 small faint">${last.exercises.filter((e) => !e.skipped).map((e) => esc(e.name || (WT.ex(e.exId) || {}).name)).join(' · ')}</div></a>`
      : `<div class="card">${H.empty('dumbbell', 'No workouts yet', 'Generate your first workout — everything you log builds your history, PRs, and progression recommendations.', '<a class="btn btn-primary" href="#/generate">' + I('sparkles', 18) + 'Generate workout</a>')}</div>`;

    const prs = st.prs.slice(0, 4);
    const prCard = `<div class="card"><div class="card-head"><h3>Recent records</h3><a class="link" href="#/progress">All stats ${I('chevR', 15)}</a></div>
      ${prs.length ? prs.map((r) => `<div class="pr-item"><div class="trophy">${I('trophy', 17)}</div><div class="grow"><div class="strong ellipsis">${esc((WT.ex(r.exId) || {}).name || r.exId)}</div><div class="small muted">${r.kind} · ${esc(r.value)}</div></div><span class="tiny faint">${WT.fmtRelDay(r.date)}</span></div>`).join('') : `<p class="small muted">Personal records appear here as you beat your previous best weights and reps.</p>`}</div>`;

    const groups = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];
    const recovery = `<div class="card"><div class="card-head"><h3>Muscle groups</h3><span class="tiny faint">last trained</span></div>
      <div class="grid g3" style="gap:8px">${groups
        .map((g) => {
          const t = st.lastTrained[g];
          const days = t ? WT.daysBetween(t, new Date()) : null;
          const cls = days == null ? '' : days <= 1 ? 'heavy' : days <= 3 ? 'good' : 'warn';
          return `<div style="background:var(--surface-2);border-radius:12px;padding:10px 12px"><div class="small strong">${WT.GROUPS[g]}</div><div class="tiny mt8"><span class="badge ${cls}">${days == null ? 'Not yet' : days === 0 ? 'Today' : days === 1 ? 'Yesterday' : days + 'd ago'}</span></div></div>`;
        })
        .join('')}</div></div>`;

    return `
      <div class="page-head"><div><h1>${WT.greeting()}${p.name ? ', ' + esc(p.name) : ''}</h1><div class="sub">${today}</div></div>
        <a class="btn btn-primary hide-m" href="#/generate">${I('sparkles', 18)}New workout</a></div>
      <div class="col" style="gap:16px">
        ${activeCard}
        <div class="grid g2">
          <div class="card hero">
            <div class="card-head"><h3>This week</h3><span class="tiny faint">${st.streak ? `${I('flame', 13)}` : ''}</span></div>
            <div class="row" style="gap:28px;flex-wrap:wrap">
              <div class="ring-wrap">${WT.ring(week.strength, p.strengthPerWeek, 68)}<div class="ring-label"><div class="v">${week.strength}<span class="faint" style="font-size:15px">/${p.strengthPerWeek}</span></div><div class="small muted">Strength</div></div></div>
              <div class="ring-wrap">${WT.ring(runsThisWeek, p.runsPerWeek, 68, 'var(--regular)')}<div class="ring-label"><div class="v">${runsThisWeek}<span class="faint" style="font-size:15px">/${p.runsPerWeek}</span></div><div class="small muted">Runs</div></div></div>
            </div>
            <div class="small muted mt16">${st.streak ? `<span class="strong" style="color:var(--text)">${st.streak}-week streak</span> hitting your strength goal.` : week.strength >= p.strengthPerWeek ? 'Weekly strength goal reached — nice work.' : `${p.strengthPerWeek - week.strength} strength session${p.strengthPerWeek - week.strength === 1 ? '' : 's'} to go this week.`}</div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Up next</h3></div>
            <div class="row" style="gap:14px"><div class="avatar accent">${I(typeIcon(sugg.type), 22)}</div><div class="grow"><div class="strong" style="font-size:17px">${WT.typeName(sugg.type)}</div><div class="small muted">${esc(sugg.reason)}</div></div></div>
            <div class="row mt16" style="gap:8px"><button class="btn btn-primary grow" data-act="quickGen" data-k="${sugg.type}">${I('sparkles', 17)}Generate</button><button class="btn btn-secondary" data-act="logRun">${I('cardio', 17)}Log a run</button></div>
            ${WT.db.draft && !active ? `<button class="btn btn-ghost btn-sm mt8" data-act="startDraft" style="padding-left:0">${I('play', 14)} Start saved draft: ${esc(WT.db.draft.title)}</button>` : ''}
          </div>
        </div>
        <div class="card tight"><div class="row wrap" style="gap:8px"><span class="small muted strong" style="margin-right:4px">Quick generate</span>${quick}</div></div>
        <div class="grid g2">${lastCard}${prCard}</div>
        <div class="grid g2">${recovery}
          <div class="card"><div class="card-head"><h3>Your goals</h3><a class="link" href="#/settings">Edit ${I('chevR', 15)}</a></div>
            <div class="col" style="gap:8px">${p.goals.map((g) => `<div class="row small" style="align-items:flex-start;gap:10px"><span style="color:var(--accent);margin-top:2px">${I('target', 15)}</span><span>${esc(g)}</span></div>`).join('')}</div></div>
        </div>
      </div>`;
  };
  function countRunsThisWeek() {
    const start = WT.startOfWeek(new Date());
    return WT.db.history.filter((s) => new Date(s.startedAt) >= start && s.exercises.some((e) => !e.skipped && WT.ex(e.exId) && WT.ex(e.exId).tags.includes('run'))).length;
  }
  const typeIcon = (t) => (WT.WORKOUT_TYPES.find((x) => x.id === t) || { icon: 'body' }).icon;
  const doneSets = (s) => s.exercises.reduce((a, e) => a + (e.skipped ? 0 : e.sets.filter((x) => x.done).length), 0);
  const totalSets = (s) => s.exercises.reduce((a, e) => a + (e.skipped ? 0 : e.sets.length), 0);

  A.quickGen = (d) => {
    WT.ui.gen = WT.defaultSettings(d.k);
    WT.db.draft = WT.generate(WT.ui.gen);
    WT.save();
    WT.go('generate');
  };
  A.logRun = () => {
    const begin = () => {
      const w = { type: 'cardio', title: 'Run', exercises: [Object.assign({ exId: 'outdoor-run' }, WT.prescribe(WT.ex('outdoor-run'), 'regular'))] };
      WT.db.active = WT.sessionFromWorkout(w);
      WT.save(true);
      WT.go('workout');
    };
    if (WT.db.active) WT.confirm('Replace current workout?', 'You have a workout in progress. Starting a run will discard it.', 'Discard & start', begin, true);
    else begin();
  };

  /* ═════════════════════ GENERATE ═════════════════════ */
  function gen() {
    if (!WT.ui.gen) WT.ui.gen = WT.db.draft && WT.db.draft.settings ? Object.assign(WT.defaultSettings(), WT.db.draft.settings) : WT.defaultSettings();
    return WT.ui.gen;
  }
  V.generate = function () {
    const g = gen();
    const p = WT.db.profile;
    const types = WT.WORKOUT_TYPES.map((t) => `<button class="type-card ${g.type === t.id ? 'on' : ''}" data-act="genType" data-k="${t.id}">${I(t.icon, 20)}<span>${t.name}</span></button>`).join('');
    const auto = WT.autoIntensity(g.type, g.count, g.targets);
    const n = g.count;
    const reg = Math.max(0, n - (+g.heavy || 0) - (+g.burnout || 0));
    const muscles = Object.fromEntries(Object.entries(WT.MUSCLES).filter(([k]) => k !== 'cardio').map(([k, v]) => [k, v.name]));
    const eqCount = g.equipment.length;
    const panel = `
      <div class="card">
        <div class="label" style="margin-bottom:10px">Workout type</div>
        <div class="type-grid">${types}</div>
        ${g.type === 'custom' ? `<div class="label mt16" style="margin-bottom:10px">Target muscles</div>${H.chipGroup(WT.CUSTOM_TARGETS, g.targets, 'genTarget')}` : ''}
        <div class="divider"></div>
        <div class="setting-row"><div><div class="t">Exercises</div><div class="d">${g.autoCount ? 'Fit to duration' : 'Default 5–6'}</div></div>
          ${g.autoCount ? `<button class="btn btn-secondary btn-sm" data-act="genToggle" data-k="autoCount">Auto</button>` : H.stepper(g.count, 'genStep', 'count', 1, 12)}</div>
        <div class="setting-row"><div class="t">Fit exercise count to time</div>${H.toggle(g.autoCount, 'genToggle', 'data-k="autoCount"')}</div>
        <div class="field" style="padding:13px 0;border-bottom:1px solid var(--border)"><div class="row between"><span class="t" style="font-weight:550">Duration</span><span class="small muted num">${g.duration} min</span></div>
          ${H.seg([[30, '30'], [45, '45'], [60, '60'], [75, '75'], [90, '90']], g.duration, 'genSet', 'duration').replace('class="seg"', 'class="seg full"')}</div>
        <div class="field" style="padding:13px 0;border-bottom:1px solid var(--border)"><div class="row between"><span class="t" style="font-weight:550">Intensity mix</span>${H.seg([['auto', 'Auto'], ['manual', 'Manual']], g.intensityMode, 'genSet', 'intensityMode')}</div>
          ${
            g.intensityMode === 'manual'
              ? `<div class="row between mt8"><span class="badge heavy"><span class="dot"></span>Heavy</span>${H.stepper(g.heavy, 'genStep', 'heavy', 0, 12)}</div>
                 <div class="row between"><span class="badge burnout"><span class="dot"></span>Burnout</span>${H.stepper(g.burnout, 'genStep', 'burnout', 0, 12)}</div>
                 <div class="small muted">${reg} regular · heavy goes to compound lifts, burnouts to finishers</div>`
              : `<div class="row small muted" style="gap:8px">${H.intensity('heavy')} ${auto.heavy} ${H.intensity('regular')} ${auto.regular} ${H.intensity('burnout')} ${auto.burnout}</div><div class="tiny faint">${g.autoCount ? 'Final mix scales with the exercise count.' : 'Balanced for the selected workout type.'}</div>`
          }</div>
        <div class="setting-row"><div><div class="t">Supersets</div><div class="d">Pair non-competing exercises to save time</div></div>${H.toggle(g.supersets, 'genToggle', 'data-k="supersets"')}</div>
        <details class="mt8"><summary class="setting-row" style="cursor:pointer;list-style:none"><div><div class="t">Equipment</div><div class="d">${eqCount} available</div></div>${I('chevD', 18)}</summary>
          <div style="padding:6px 0 14px">${H.chipGroup(WT.EQUIPMENT, g.equipment, 'genEquip')}</div></details>
        <details><summary class="setting-row" style="cursor:pointer;list-style:none"><div><div class="t">Prioritize</div><div class="d">${g.prioritize.length ? g.prioritize.map(WT.muscleName).join(', ') : 'None'}</div></div>${I('chevD', 18)}</summary>
          <div style="padding:6px 0 14px">${H.chipGroup(muscles, g.prioritize, 'genPrio')}</div></details>
        <details><summary class="setting-row" style="cursor:pointer;list-style:none"><div><div class="t">Avoid muscles</div><div class="d">${g.avoidMuscles.length ? g.avoidMuscles.map(WT.muscleName).join(', ') : 'None'}</div></div>${I('chevD', 18)}</summary>
          <div style="padding:6px 0 14px">${H.chipGroup(muscles, g.avoidMuscles, 'genAvoid', 'avoid')}</div></details>
        <button class="setting-row" style="width:100%;text-align:left" data-act="openExcluded"><div><div class="t">Excluded exercises</div><div class="d">${p.excluded.length} excluded · ${p.restrictions.length} movement restrictions</div></div>${I('chevR', 18)}</button>
        <button class="btn btn-primary btn-lg btn-block mt16" data-act="generate">${I('sparkles', 19)}Generate workout</button>
      </div>`;

    const d = WT.db.draft;
    let right;
    if (!d) {
      right = `<div class="card">${H.empty('sparkles', 'Build your session', 'Choose a type and options, then generate. Exercises are selected using your goals, equipment, restrictions, and recent training — not at random.', '<button class="btn btn-primary" data-act="generate">' + I('sparkles', 18) + 'Generate workout</button>')}</div>`;
    } else {
      const counts = { heavy: 0, regular: 0, burnout: 0 };
      d.exercises.forEach((i) => (counts[i.intensity] = (counts[i.intensity] || 0) + 1));
      const sets = d.exercises.reduce((a, i) => a + (i.sets || 0), 0);
      right = `
        <div class="card hero">
          <div class="row between" style="align-items:flex-start"><div><div class="eyebrow">Generated workout</div><h2 style="font-size:24px;margin-top:4px">${esc(d.title)}</h2></div>
            <button class="icon-btn" data-act="clearDraft" title="Clear">${I('trash', 18)}</button></div>
          <div class="plan-summary mt16">
            <div><div class="k">Duration</div><div class="v">~${d.estimatedMin}<span class="small muted"> min</span></div></div>
            <div><div class="k">Exercises</div><div class="v">${d.exercises.length}</div></div>
            <div><div class="k">Sets</div><div class="v">${sets}</div></div>
            <div class="row" style="gap:6px">${counts.heavy ? H.intensity('heavy') + `<span class="small num">${counts.heavy}</span>` : ''} ${counts.regular ? H.intensity('regular') + `<span class="small num">${counts.regular}</span>` : ''} ${counts.burnout ? H.intensity('burnout') + `<span class="small num">${counts.burnout}</span>` : ''}</div>
          </div>
          ${(d.notes || []).map((nt) => `<div class="notes-box mt12">${I('info', 16)}<span>${esc(nt)}</span></div>`).join('')}
        </div>
        <div class="plan-list mt16">${planList(d)}</div>
        <button class="btn btn-secondary btn-block mt12" data-act="openAdd" data-ctx="draft" style="border-style:dashed">${I('plus', 18)}Add exercise</button>
        <div class="sticky-actions">
          <button class="btn btn-secondary grow" data-act="regenerate">${I('refresh', 18)}Regenerate</button>
          <button class="btn btn-primary grow" data-act="startDraft">${I('play', 17)}Start workout</button>
        </div>
        <p class="tiny faint mt12" style="text-align:center">Lock exercises you like (${I('lock', 11).replace('<svg', '<svg style="display:inline;vertical-align:-1px"')}) — Regenerate keeps them.</p>`;
    }
    return `<div class="page-head"><div><h1>Generate Workout</h1><div class="sub">Smart selection based on your goals, equipment and recent training.</div></div></div>
      <div class="split"><div class="sticky">${panel}</div><div>${right}</div></div>`;
  };

  function planList(d) {
    const blocks = WT.groupBlocks(d.exercises);
    let n = 0;
    return blocks
      .map((b) => {
        const items = b.map((it, j) => planItem(it, b.length > 1 ? b[0].superset + (j + 1) : String(++n))).join('');
        return b.length > 1 ? `<div class="ss-group"><div class="ss-label">${I('zap', 13)}Superset ${b[0].superset} · alternate sets, rest after both</div>${items}</div>` : items;
      })
      .join('');
  }
  function planItem(it, label) {
    const ex = WT.ex(it.exId);
    if (!ex) return '';
    return `<div class="plan-item ${it.locked ? 'locked' : ''}">
      <div class="plan-idx">${label}</div>
      <div style="min-width:0">
        <button class="plan-name" data-act="exDetail" data-id="${ex.id}">${esc(ex.name)}</button>
        <div class="plan-meta">${H.intensity(it.intensity, 'planIntensity', it.uid)}<span class="num strong" style="color:var(--text)">${H.target(it, ex)}</span>${it.rest ? `<span class="row num" style="gap:4px">${I('timer', 14)}${WT.fmtClock(it.rest)}</span>` : ''}<span>${H.muscles(ex)}</span></div>
        ${it.why && it.why.length ? `<div class="plan-why">${esc(it.why.join(' · '))}</div>` : it.slot ? `<div class="plan-why">${esc(it.slot.label)}</div>` : ''}
      </div>
      <div class="plan-actions">
        <button class="swap-btn" data-act="openSwap" data-ctx="draft" data-uid="${it.uid}">${I('swap', 15)}Swap</button>
        <button class="icon-btn sm ${it.locked ? 'on' : ''}" data-act="planLock" data-uid="${it.uid}" title="${it.locked ? 'Unlock' : 'Lock (keep on regenerate)'}">${I(it.locked ? 'lock' : 'unlock', 17)}</button>
        <button class="icon-btn sm" data-act="planRemove" data-uid="${it.uid}" title="Remove">${I('x', 18)}</button>
      </div></div>`;
  }

  const toggleIn = (arr, k) => (arr.includes(k) ? arr.filter((x) => x !== k) : arr.concat(k));
  A.genType = (d) => {
    gen().type = d.k;
    const g = gen();
    if (WT.ui.gen.intensityMode === 'auto') Object.assign(g, WT.autoIntensity(g.type, g.count, g.targets));
    WT.rerender();
  };
  A.genTarget = (d) => {
    gen().targets = toggleIn(gen().targets, d.k);
    WT.rerender();
  };
  A.genStep = (d) => {
    const g = gen();
    g[d.k] = WT.clamp((+g[d.k] || 0) + +d.d, +d.min, +d.max);
    if (d.k === 'count' && g.intensityMode === 'manual') {
      g.heavy = Math.min(g.heavy, g.count);
      g.burnout = Math.min(g.burnout, g.count - g.heavy);
    }
    if ((d.k === 'heavy' || d.k === 'burnout') && g.heavy + g.burnout > g.count) g[d.k] = g.count - (d.k === 'heavy' ? g.burnout : g.heavy);
    WT.rerender();
  };
  A.genSet = (d) => {
    const g = gen();
    g[d.k] = isNaN(+d.v) ? d.v : +d.v;
    if (d.k === 'intensityMode' && d.v === 'manual') Object.assign(g, WT.autoIntensity(g.type, g.count, g.targets));
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
  A.generate = () => {
    const g = gen();
    if (g.type === 'custom' && !g.targets.length) return WT.toast('Pick at least one target muscle', 'error');
    WT.db.draft = WT.generate(g);
    WT.save();
    WT.rerender();
    if (innerWidth <= 1100) setTimeout(() => document.querySelector('.plan-list') && document.querySelector('.plan-list').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };
  A.regenerate = () => {
    const d = WT.db.draft;
    if (!d) return A.generate();
    const keep = d.exercises.filter((i) => i.locked);
    WT.db.draft = WT.generate(Object.assign({}, d.settings, gen().type === d.type ? gen() : {}), keep);
    WT.save();
    WT.rerender();
    WT.toast(keep.length ? `Regenerated — kept ${keep.length} locked` : 'Regenerated');
  };
  A.clearDraft = () => {
    WT.db.draft = null;
    WT.save();
    WT.rerender();
  };
  const draftItem = (uid) => WT.db.draft && WT.db.draft.exercises.find((i) => i.uid === uid);
  A.planLock = (d) => {
    const it = draftItem(d.uid);
    it.locked = !it.locked;
    WT.save();
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
    WT.rerender();
  };
  A.planIntensity = (d) => {
    const it = draftItem(d.uid);
    const ex = WT.ex(it.exId);
    const order = ['heavy', 'regular', 'burnout'].filter((x) => ex.intensities.includes(x));
    if (order.length < 2) return WT.toast(`${ex.name} is ${order[0]}-only`);
    const next = order[(order.indexOf(it.intensity) + 1) % order.length];
    Object.assign(it, WT.prescribe(ex, next));
    WT.db.draft.estimatedMin = WT.estimateMinutes(WT.db.draft.exercises);
    WT.save();
    WT.rerender();
  };
  A.startDraft = () => {
    const d = WT.db.draft;
    if (!d || !d.exercises.length) return WT.toast('Generate a workout first', 'error');
    const begin = () => {
      WT.db.active = WT.sessionFromWorkout(d);
      WT.db.draft = null;
      WT.unlockAudio();
      WT.save(true);
      WT.go('workout');
    };
    if (WT.db.active) WT.confirm('Replace current workout?', 'A workout is already in progress. Starting this one will discard it.', 'Discard & start', begin, true);
    else begin();
  };

  /* Excluded exercises sheet */
  A.openExcluded = () => {
    WT.openSheet(() => {
      const p = WT.db.profile;
      const list = p.excluded.map((id) => WT.ex(id)).filter(Boolean);
      return {
        title: 'Exclusions',
        body: `<div class="label">Movement restrictions</div>
          <div class="mt8">${Object.entries(WT.RESTRICTION_TAGS)
            .map(([k, v]) => `<div class="setting-row"><div class="t">${esc(v)}</div>${H.toggle(p.restrictions.includes(k), 'toggleRestriction', `data-k="${k}"`)}</div>`)
            .join('')}</div>
          <div class="label mt24">Excluded exercises</div>
          ${list.length ? `<div class="card flush mt8"><div class="list">${list.map((ex) => `<div class="list-row"><div class="grow"><div class="title">${esc(ex.name)}</div><div class="meta">${WT.muscleName(ex.primary)}</div></div><button class="btn btn-ghost btn-sm" data-act="unexclude" data-id="${ex.id}">Restore</button></div>`).join('')}</div></div>` : `<p class="small muted mt8">None. Exclude exercises from the Library or the swap menu.</p>`}`,
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

  /* ═════════════════════ SWAP & ADD SHEETS ═════════════════════ */
  function ctxWorkout(ctx) {
    return ctx === 'active' ? WT.db.active : WT.db.draft;
  }
  A.openSwap = (d) => {
    const state = { wide: false };
    const ctx = d.ctx, uid = d.uid;
    WT.openSheet(() => {
      const w = ctxWorkout(ctx);
      const item = w && w.exercises.find((e) => e.uid === uid);
      if (!item) return { title: 'Swap', body: '' };
      const cur = WT.ex(item.exId);
      const alts = WT.alternatives(w, uid, { wide: state.wide }).slice(0, 40);
      const doneCount = ctx === 'active' ? item.sets.filter((s) => s.done).length : 0;
      return {
        title: 'Swap exercise',
        body: `<div class="notes-box">${I('swap', 16)}<div><div class="strong" style="color:var(--text)">${esc(cur.name)}</div><div>${(item.slot && item.slot.label) || WT.muscleName(cur.primary)} · alternatives keep the same slot, intensity and set count, and respect your equipment and exclusions.</div></div></div>
          ${doneCount ? `<div class="notes-box mt8" style="background:var(--warn-soft);color:var(--warn)">${I('info', 16)}<span>${doneCount} logged set${doneCount > 1 ? 's' : ''} on this exercise will be cleared.</span></div>` : ''}
          <div class="row between mt16"><span class="label">${alts.length} alternatives</span>${H.seg([[0, 'Best match'], [1, 'Same muscle group']], state.wide ? 1 : 0, 'swapWide')}</div>
          <div class="card flush mt8"><div class="list">${
            alts.length
              ? alts
                  .map(
                    (a) => `<button class="list-row" data-act="doSwap" data-id="${a.ex.id}">
                <div class="grow" style="min-width:0"><div class="title">${esc(a.ex.name)} ${WT.db.profile.favorites.includes(a.ex.id) ? `<span style="color:var(--warn);display:inline-block;vertical-align:-2px">${I('star', 13)}</span>` : ''}</div>
                <div class="meta">${H.muscles(a.ex)} · ${a.ex.equipment.map((q) => WT.EQUIPMENT[q]).join(', ')}</div>
                ${a.samePattern ? '<div class="tiny mt8"><span class="badge accent">Same movement</span></div>' : ''}</div>${I('chevR', 18, 'faint')}</button>`
                  )
                  .join('')
              : `<div class="empty small">No alternatives with your current equipment and exclusions. Try “Same muscle group”.</div>`
          }</div></div>
          <button class="btn btn-ghost btn-sm mt16" data-act="excludeFromSwap" data-id="${cur.id}">${I('ban', 15)}Never suggest ${esc(cur.name)}</button>`,
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
        const intensity = ex.intensities.includes(old.intensity) ? old.intensity : ex.intensity;
        const pr = WT.prescribe(ex, intensity);
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
      WT.toast('Swapped in ' + WT.ex(dd.id).name, 'good');
    };
    A.excludeFromSwap = (dd) => {
      const p = WT.db.profile;
      if (!p.excluded.includes(dd.id)) p.excluded.push(dd.id);
      WT.save();
      WT.toast('Excluded from future workouts');
      WT.refreshSheet();
    };
  };

  A.openAdd = (d) => {
    const state = { q: '', mine: true, group: '' };
    const ctx = d.ctx;
    WT.openSheet(
      () => {
        const q = state.q.toLowerCase();
        const list = WT.exercises
          .filter((ex) => (!state.mine || (WT.hasEquipment(ex) && !WT.isRestricted(ex))) && (!state.group || WT.MUSCLES[ex.primary].group === state.group) && (!q || ex.name.toLowerCase().includes(q) || WT.muscleName(ex.primary).toLowerCase().includes(q)))
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, 80);
        return {
          title: 'Add exercise',
          body: `<div class="search"><span>${I('search', 17)}</span><input class="input" id="addSearch" placeholder="Search exercises or muscles" value="${esc(state.q)}" data-in="addSearch" autocomplete="off"></div>
            <div class="row between mt12 wrap">${H.seg([['', 'All'], ...Object.entries(WT.GROUPS)], state.group, 'addGroup')}</div>
            <div class="row between mt12"><span class="small muted">Only exercises I can do</span>${H.toggle(state.mine, 'addMine')}</div>
            <div class="card flush mt12"><div class="list" id="addList">${list.map((ex) => `<button class="list-row" data-act="doAdd" data-id="${ex.id}"><div class="grow" style="min-width:0"><div class="title">${esc(ex.name)}</div><div class="meta">${H.muscles(ex)} · ${ex.equipment.map((q2) => WT.EQUIPMENT[q2]).join(', ')}</div></div>${I('plus', 18, 'faint')}</button>`).join('') || '<div class="empty small">No matches.</div>'}</div></div>`,
          after: (sheet) => {
            const inp = sheet.querySelector('#addSearch');
            if (state.focus && inp) {
              inp.focus();
              inp.setSelectionRange(inp.value.length, inp.value.length);
            }
          },
        };
      },
      { wide: false }
    );
    WT.I.addSearch = (el, ev) => {
      if (ev.type !== 'input') return;
      state.q = el.value;
      state.focus = true;
      WT.refreshSheet();
    };
    A.addGroup = (dd) => {
      state.group = dd.v;
      state.focus = false;
      WT.refreshSheet();
    };
    A.addMine = () => {
      state.mine = !state.mine;
      WT.refreshSheet();
    };
    A.doAdd = (dd) => {
      const ex = WT.ex(dd.id);
      if (ctx === 'active') {
        WT.db.active.exercises.push(WT.sessionItem(ex.id));
      } else {
        if (!WT.db.draft) WT.db.draft = { id: WT.uid(), type: gen().type, title: WT.typeName(gen().type), settings: gen(), notes: [], exercises: [] };
        const pr = WT.prescribe(ex, ex.intensity);
        WT.db.draft.exercises.push(Object.assign({ uid: WT.uid(), exId: ex.id, slot: { label: WT.muscleName(ex.primary), m: [ex.primary], p: null }, slotIndex: 99, why: ['Added manually'], locked: true }, pr));
        WT.db.draft.estimatedMin = WT.estimateMinutes(WT.db.draft.exercises);
      }
      WT.save();
      WT.closeSheet();
      WT.rerender();
      WT.toast('Added ' + ex.name, 'good');
      if (ctx === 'active') setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50);
    };
  };

  /* ═════════════════════ ACTIVE WORKOUT ═════════════════════ */
  V.workout = function () {
    const a = WT.db.active;
    if (!a) {
      return `<div class="page-head"><div><h1>Active Workout</h1><div class="sub">Log sets, reps and weights as you train.</div></div></div>
        <div class="card">${H.empty(
          'activity',
          'No workout in progress',
          'Generate a workout, repeat one from your history, or start an empty session and add exercises as you go.',
          `<div class="row wrap" style="justify-content:center;gap:8px">
            ${WT.db.draft ? `<button class="btn btn-primary" data-act="startDraft">${I('play', 16)}Start “${esc(WT.db.draft.title)}”</button>` : `<a class="btn btn-primary" href="#/generate">${I('sparkles', 17)}Generate workout</a>`}
            <button class="btn btn-secondary" data-act="startEmpty">${I('plus', 17)}Empty workout</button>
            <button class="btn btn-secondary" data-act="logRun">${I('cardio', 17)}Log a run</button></div>`
        )}</div>`;
    }
    const done = doneSets(a), total = totalSets(a);
    const blocks = WT.groupBlocks(a.exercises);
    let n = 0;
    const cards = blocks
      .map((b) => {
        const inner = b.map((it) => exCard(it, b.length > 1 ? b[0].superset + (b.indexOf(it) + 1) : String(++n))).join('');
        return b.length > 1 ? `<div class="ss-group"><div class="ss-label">${I('zap', 13)}Superset ${b[0].superset} — alternate: ${b.map((x) => esc(WT.ex(x.exId) ? WT.ex(x.exId).name : x.name)).join(' ↔ ')}</div>${inner}</div>` : inner;
      })
      .join('');
    return `
      <div class="card hero" style="margin-bottom:16px">
        <div class="wo-head">
          <div class="grow" style="min-width:160px"><div class="eyebrow">${esc(WT.typeName(a.type))}</div><h2 style="font-size:22px;margin-top:3px">${esc(a.title)}</h2></div>
          <div style="text-align:right"><div class="wo-clock num" id="woClock">${WT.fmtClock((Date.now() - new Date(a.startedAt)) / 1000)}</div><div class="tiny faint">elapsed</div></div>
        </div>
        <div class="row mt16" style="gap:12px"><div class="progress grow"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div><span class="small muted num">${done}/${total} sets</span></div>
        <div class="row mt16" style="gap:8px">
          <button class="btn btn-primary grow" data-act="woFinish">${I('check', 18)}Finish workout</button>
          <button class="btn btn-secondary" data-act="woTimerMenu" title="Rest timer">${I('timer', 18)}<span class="hide-m">Timer</span></button>
          <button class="icon-btn" data-act="woDiscard" title="Discard workout">${I('trash', 18)}</button>
        </div>
      </div>
      <div class="col" style="gap:12px">${cards || `<div class="card">${H.empty('dumbbell', 'Empty workout', 'Add your first exercise to start logging.')}</div>`}</div>
      <button class="btn btn-secondary btn-block mt16" data-act="openAdd" data-ctx="active" style="border-style:dashed">${I('plus', 18)}Add exercise</button>
      <div class="card mt16"><div class="label">Workout notes</div><textarea class="input mt8" data-in="sessionNotes" placeholder="How did the session go? Sleep, energy, anything to remember…">${esc(a.notes || '')}</textarea></div>
      <button class="btn btn-primary btn-lg btn-block mt16" data-act="woFinish">${I('check', 19)}Finish workout</button>`;
  };

  function exCard(item, label) {
    const ex = WT.ex(item.exId);
    if (!ex) return `<div class="card">Unknown exercise (${esc(item.exId)})</div>`;
    const tt = WT.trackType(ex);
    const a = WT.db.active;
    const hist = WT.exerciseHistory(ex.id, a.id);
    const last = hist[hist.length - 1];
    const pr = WT.personalRecords(ex.id, a.id);
    const rec = WT.recommend(ex.id, { repMin: item.repMin, repMax: item.repMax, sets: item.targetSets, intensity: item.intensity }, a.id);
    const allDone = item.sets.length && item.sets.every((s) => s.done);
    const anyDone = item.sets.some((s) => s.done);
    const u = WT.db.profile.unit;
    const secUnit = tt === 'time' || ex.unit === 'sec';

    const recIcon = { increase: 'trendUp', progress: 'trendUp', decrease: 'trendDown', hold: 'equal', reps: 'plus', return: 'refresh', new: 'info', info: 'info' }[rec.action] || 'info';
    const canApply = rec.weight != null && (tt === 'weight' || (tt === 'reps' && rec.weight > 0));
    const canApplyLoad = rec.addLoad && tt === 'reps';
    const recHtml =
      item.skipped || allDone
        ? ''
        : `<div class="rec ${rec.action}"><div class="ic">${I(recIcon, 16)}</div><div class="grow" style="min-width:0">
        <div class="h">${esc(rec.headline)}</div>
        <details><summary>Why this recommendation ${I('chevD', 12).replace('<svg', '<svg style="display:inline;vertical-align:-2px"')}</summary>${rec.reasons.map((r) => `<p>${esc(r)}</p>`).join('')}</details></div>
        ${canApply || canApplyLoad ? (item.recApplied ? `<span class="badge good">${I('check', 12)}Applied</span>` : `<button class="btn btn-sm btn-secondary" data-act="woApplyRec" data-uid="${item.uid}">Apply</button>`) : ''}</div>`;

    const lastLine = last
      ? `<div class="last-line"><span>Last (${WT.fmtRelDay(last.date).toLowerCase()}): <span class="num" style="color:var(--text-2)">${fmtSets(last.sets, tt, ex)}</span></span>${pr.heaviest && tt !== 'cardio' ? `<span>Best: <span class="num" style="color:var(--text-2)">${WT.fmtNum(pr.heaviest.w)} ${u} × ${pr.heaviest.r}</span></span>` : pr.reps && tt !== 'cardio' ? `<span>Best: <span class="num" style="color:var(--text-2)">${pr.reps.r}${secUnit ? 's' : ' reps'}</span></span>` : ''}</div>`
      : '';

    let headCols;
    if (tt === 'cardio') headCols = `<th>Set</th><th>Previous</th><th>Min</th><th>Miles</th><th></th>`;
    else if (tt === 'time') headCols = `<th>Set</th><th>Previous</th><th>Sec</th><th></th><th></th>`;
    else headCols = `<th>Set</th><th>Previous</th><th>${tt === 'reps' ? '+' + u : u}</th><th>${secUnit ? 'Sec' : 'Reps'}</th><th></th>`;

    const recW = item.recApplied && rec.weight != null ? rec.weight : null;
    const rows = item.sets
      .map((s, i) => {
        const prev = last ? last.sets[Math.min(i, last.sets.length - 1)] : null;
        const prevTxt = prev ? (tt === 'cardio' ? `${prev.time || '–'}m ${prev.dist ? '· ' + prev.dist : ''}` : tt === 'time' ? `${prev.r}s` : prev.w ? `${WT.fmtNum(prev.w)}×${prev.r}` : `${prev.r}`) : '—';
        const phW = recW != null ? recW : prev && prev.w ? prev.w : '';
        const phR = prev ? prev.r : item.repMax;
        const inp = (f, ph, val, mode) => `<input class="set-input" type="text" inputmode="${mode || 'decimal'}" data-in="setVal" data-uid="${item.uid}" data-i="${i}" data-f="${f}" value="${esc(val)}" placeholder="${esc(ph)}" aria-label="${f}">`;
        let cells;
        if (tt === 'cardio') cells = `<td>${inp('time', prev ? prev.time || '' : item.repMax, s.time || '')}</td><td>${inp('dist', prev ? prev.dist || '' : '', s.dist || '')}</td>`;
        else if (tt === 'time') cells = `<td>${inp('r', phR, s.r, 'numeric')}</td><td></td>`;
        else cells = `<td>${inp('w', tt === 'reps' ? phW || '0' : phW, s.w)}</td><td>${inp('r', phR, s.r, 'numeric')}</td>`;
        return `<tr class="set-row ${s.done ? 'done' : ''}"><td class="set-num">${i + 1}</td><td class="set-prev">${prevTxt}</td>${cells}
          <td><button class="check ${s.done ? 'on' : ''}" data-act="woCheck" data-uid="${item.uid}" data-i="${i}" aria-label="Complete set ${i + 1}">${I('check', 20)}</button></td></tr>`;
      })
      .join('');

    return `<div class="ex-card ${allDone ? 'done' : ''} ${item.skipped ? 'skipped' : ''}" id="ex-${item.uid}">
      <div class="ex-card-head">
        <div class="plan-idx" style="flex-shrink:0">${item.superset ? `<span style="color:var(--accent)">${label}</span>` : label}</div>
        <div class="grow" style="min-width:0">
          <button class="ex-title" data-act="exDetail" data-id="${ex.id}">${esc(ex.name)}</button>
          <div class="plan-meta">${H.intensity(item.intensity, 'woIntensity', item.uid)}<span class="num strong" style="color:var(--text)">${H.target({ sets: item.targetSets, repMin: item.repMin, repMax: item.repMax }, ex)}</span>${item.rest ? `<span class="row num" style="gap:4px">${I('timer', 14)}${WT.fmtClock(item.rest)}</span>` : ''}${item.skipped ? '<span class="badge">Skipped</span>' : ''}</div>
          ${item.note ? `<div class="plan-why">${esc(item.note)}</div>` : ''}
        </div>
        <button class="swap-btn hide-m" data-act="openSwap" data-ctx="active" data-uid="${item.uid}">${I('swap', 15)}Swap</button>
        <button class="icon-btn sm hide-d" data-act="openSwap" data-ctx="active" data-uid="${item.uid}" aria-label="Swap" style="color:var(--accent)">${I('swap', 18)}</button>
        <button class="icon-btn sm" data-act="woMenu" data-uid="${item.uid}" aria-label="More">${I('more', 18)}</button>
      </div>
      ${item.skipped ? '' : recHtml + lastLine}
      ${
        item.skipped
          ? `<div class="ex-foot"><button class="btn btn-secondary btn-sm" data-act="woSkip" data-uid="${item.uid}">Restore exercise</button></div>`
          : `<table class="sets"><thead><tr>${headCols}</tr></thead><tbody>${rows}</tbody></table>
      <div class="ex-foot">
        <button class="btn btn-secondary btn-sm" data-act="woAddSet" data-uid="${item.uid}">${I('plus', 15)}Add set</button>
        ${item.sets.length > 1 ? `<button class="btn btn-ghost btn-sm" data-act="woRemoveSet" data-uid="${item.uid}">${I('minus', 15)}Remove set</button>` : ''}
        <button class="btn btn-ghost btn-sm" data-act="woNoteToggle" data-uid="${item.uid}">${I('note', 15)}${item.notes ? 'Note' : 'Add note'}</button>
        <div class="grow"></div>
        ${item.rest ? `<button class="btn btn-ghost btn-sm num" data-act="timerStart" data-s="${item.rest}">${I('timer', 15)}${WT.fmtClock(item.rest)}</button>` : ''}
      </div>
      ${item.showNotes || item.notes ? `<div class="ex-notes"><textarea class="input" style="min-height:60px" data-in="exNotes" data-uid="${item.uid}" placeholder="Notes for this exercise (seat height, grip, how it felt…)">${esc(item.notes || '')}</textarea></div>` : ''}
      ${anyDone && tt !== 'cardio' ? `<div class="effort"><span>How did it feel?</span>${H.seg([['easy', 'Easy'], ['good', 'Solid'], ['hard', 'Grinding']], item.effort || '', 'woEffort', item.uid)}</div>` : ''}`
      }
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

  const actItem = (uid) => WT.db.active && WT.db.active.exercises.find((e) => e.uid === uid);
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
  A.woCheck = (d) => {
    WT.unlockAudio();
    const it = actItem(d.uid);
    const ex = WT.ex(it.exId);
    const tt = WT.trackType(ex);
    const i = +d.i;
    const s = it.sets[i];
    if (s.done) {
      s.done = false;
      WT.save();
      return WT.rerender();
    }
    // Fill blanks from placeholders (previous performance / applied recommendation)
    const row = document.querySelector(`#ex-${it.uid} tbody tr:nth-child(${i + 1})`);
    if (row)
      row.querySelectorAll('.set-input').forEach((inp) => {
        const f = inp.dataset.f;
        if ((s[f] === '' || s[f] == null) && inp.placeholder !== '' && !isNaN(+inp.placeholder)) s[f] = inp.placeholder;
      });
    if (tt === 'weight' && (s.w === '' || s.w == null)) return WT.toast('Enter the weight used', 'error');
    if ((tt === 'weight' || tt === 'reps' || tt === 'time') && !(+s.r > 0)) return WT.toast(tt === 'time' ? 'Enter seconds held' : 'Enter reps completed', 'error');
    if (tt === 'cardio' && !(+s.time > 0) && !(+s.dist > 0)) return WT.toast('Enter time or distance', 'error');
    if (tt === 'reps' && s.w === '') s.w = '0';
    s.done = true;
    s.at = new Date().toISOString();
    // Carry the weight forward to the next empty set
    const next = it.sets.slice(i + 1).find((x) => !x.done);
    if (next && tt !== 'cardio' && (next.w === '' || next.w == null) && s.w !== '') next.w = s.w;
    // Rest timer / superset flow
    const a = WT.db.active;
    const remaining = a.exercises.some((e) => !e.skipped && e.sets.some((x) => !x.done));
    if (!remaining) WT.toast('All sets complete — finish when ready', 'good');
    else if (it.superset) {
      const group = a.exercises.filter((e) => e.superset === it.superset && !e.skipped);
      const pos = group.indexOf(it);
      const partner = group.slice(pos + 1).find((e) => e.sets.some((x) => !x.done));
      if (partner && pos < group.length - 1) WT.toast('Superset → ' + WT.ex(partner.exId).name);
      else if (it.rest) WT.startTimer(it.rest, 'Rest · Superset ' + it.superset);
    } else if (it.rest && tt !== 'cardio' && it.sets.some((x) => !x.done)) WT.startTimer(it.rest, 'Rest · ' + ex.name);
    else if (it.rest && tt !== 'cardio') WT.startTimer(Math.min(it.rest, 90), 'Next exercise');
    WT.save();
    WT.rerender();
  };
  A.woApplyRec = (d) => {
    const it = actItem(d.uid);
    const ex = WT.ex(it.exId);
    const rec = WT.recommend(it.exId, { repMin: it.repMin, repMax: it.repMax, sets: it.targetSets, intensity: it.intensity }, WT.db.active.id);
    const w = rec.weight != null ? rec.weight : rec.addLoad || null;
    if (w == null) return;
    it.sets.forEach((s) => {
      if (!s.done) s.w = String(w);
    });
    it.recApplied = true;
    WT.save();
    WT.rerender();
    WT.toast(`Set ${ex.name} to ${WT.fmtNum(w)} ${WT.db.profile.unit}`, 'good');
  };
  A.woAddSet = (d) => {
    const it = actItem(d.uid);
    const lastSet = it.sets[it.sets.length - 1];
    it.sets.push({ w: lastSet ? lastSet.w : '', r: '', done: false });
    WT.save();
    WT.rerender();
  };
  A.woRemoveSet = (d) => {
    const it = actItem(d.uid);
    let idx = -1;
    for (let k = it.sets.length - 1; k >= 0; k--)
      if (!it.sets[k].done) {
        idx = k;
        break;
      }
    if (idx < 0) idx = it.sets.length - 1;
    it.sets.splice(idx, 1);
    WT.save();
    WT.rerender();
  };
  A.woNoteToggle = (d) => {
    const it = actItem(d.uid);
    it.showNotes = !it.showNotes || !!it.notes;
    WT.save();
    WT.rerender();
    setTimeout(() => {
      const t = document.querySelector(`[data-in="exNotes"][data-uid="${d.uid}"]`);
      if (t) t.focus();
    }, 30);
  };
  A.woEffort = (d) => {
    const it = actItem(d.k);
    it.effort = it.effort === d.v ? null : d.v;
    WT.save();
    WT.rerender();
  };
  A.woIntensity = (d) => {
    const it = actItem(d.uid);
    const ex = WT.ex(it.exId);
    const order = ['heavy', 'regular', 'burnout'].filter((x) => ex.intensities.includes(x));
    if (order.length < 2) return WT.toast(`${ex.name} is ${order[0]}-only`);
    const next = order[(order.indexOf(it.intensity) + 1) % order.length];
    const pr = WT.prescribe(ex, next);
    Object.assign(it, { intensity: next, repMin: pr.repMin, repMax: pr.repMax, rest: pr.rest, note: pr.note, recApplied: false });
    WT.save();
    WT.rerender();
  };
  A.woSkip = (d) => {
    const it = actItem(d.uid);
    it.skipped = !it.skipped;
    WT.closeSheet(true);
    WT.save();
    WT.rerender();
  };
  A.woMenu = (d) => {
    const it = actItem(d.uid);
    const ex = WT.ex(it.exId);
    const a = WT.db.active;
    const idx = a.exercises.indexOf(it);
    WT.openSheet(() => ({
      title: esc(ex.name),
      body: `<div class="card flush"><div class="list">
        <button class="list-row" data-act="openSwap" data-ctx="active" data-uid="${it.uid}"><div class="avatar accent">${I('swap', 18)}</div><div class="grow"><div class="title">Replace exercise</div><div class="meta">Same muscle, same structure</div></div></button>
        <button class="list-row" data-act="exDetail" data-id="${ex.id}"><div class="avatar">${I('chart', 18)}</div><div class="grow"><div class="title">History, PRs & video</div></div></button>
        <button class="list-row" data-act="woNoteToggle2" data-uid="${it.uid}"><div class="avatar">${I('note', 18)}</div><div class="grow"><div class="title">Add note</div></div></button>
        ${idx > 0 ? `<button class="list-row" data-act="woMove" data-uid="${it.uid}" data-d="-1"><div class="avatar">${I('up', 18)}</div><div class="grow"><div class="title">Move up</div></div></button>` : ''}
        ${idx < a.exercises.length - 1 ? `<button class="list-row" data-act="woMove" data-uid="${it.uid}" data-d="1"><div class="avatar">${I('down', 18)}</div><div class="grow"><div class="title">Move down</div></div></button>` : ''}
        ${it.superset ? `<button class="list-row" data-act="woUnpair" data-uid="${it.uid}"><div class="avatar">${I('zap', 18)}</div><div class="grow"><div class="title">Remove from superset</div></div></button>` : ''}
        <button class="list-row" data-act="woSkip" data-uid="${it.uid}"><div class="avatar">${I('skip', 18)}</div><div class="grow"><div class="title">${it.skipped ? 'Restore exercise' : 'Skip exercise'}</div></div></button>
        <button class="list-row" data-act="woRemove" data-uid="${it.uid}"><div class="avatar" style="color:var(--danger)">${I('trash', 18)}</div><div class="grow"><div class="title" style="color:var(--danger)">Remove from workout</div></div></button>
      </div></div>`,
    }));
  };
  A.woNoteToggle2 = (d) => {
    WT.closeSheet();
    const it = actItem(d.uid);
    it.showNotes = true;
    WT.rerender();
    setTimeout(() => {
      const t = document.querySelector(`[data-in="exNotes"][data-uid="${d.uid}"]`);
      if (t) {
        t.scrollIntoView({ block: 'center' });
        t.focus();
      }
    }, 50);
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
    // A superset must stay adjacent; split it otherwise
    list.forEach((e, k) => {
      if (!e.superset) return;
      const adj = (list[k - 1] && list[k - 1].superset === e.superset) || (list[k + 1] && list[k + 1].superset === e.superset);
      if (!adj) e.superset = null;
    });
  }
  A.woUnpair = (d) => {
    const a = WT.db.active;
    const it = actItem(d.uid);
    const L = it.superset;
    a.exercises.forEach((e) => {
      if (e.superset === L) e.superset = null;
    });
    WT.closeSheet();
    WT.save();
    WT.rerender();
  };
  A.woRemove = (d) => {
    const a = WT.db.active;
    a.exercises = a.exercises.filter((e) => e.uid !== d.uid);
    fixSupersets(a.exercises);
    WT.closeSheet(true);
    WT.save();
    WT.rerender();
  };
  A.woTimerMenu = () => {
    const p = WT.db.profile;
    WT.openSheet(() => ({
      title: 'Rest timer',
      body: `<p class="small muted">Starts automatically when you complete a set, using that exercise's rest period. Start one manually:</p>
        <div class="timer-presets mt16">${[30, 45, 60, 75, 90, 120, 150, 180, 240].map((s) => `<button class="btn btn-secondary num" data-act="timerPreset" data-s="${s}">${WT.fmtClock(s)}</button>`).join('')}</div>
        <div class="setting-row mt16"><div><div class="t">Sound & vibration</div><div class="d">Plays when rest is over</div></div>${H.toggle(p.timerSound, 'toggleSound')}</div>
        <p class="tiny faint mt8">Default rest by intensity can be changed in Settings.</p>`,
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
    WT.confirm('Discard workout?', 'All sets logged in this session will be lost. This cannot be undone.', 'Discard', () => {
      WT.db.active = null;
      WT.save(true);
      WT.go('dashboard');
      WT.toast('Workout discarded');
    }, true);

  A.woFinish = () => {
    const a = WT.db.active;
    const done = doneSets(a), total = totalSets(a);
    let volume = 0;
    a.exercises.forEach((e) => e.sets.forEach((s) => s.done && (volume += (+s.w || 0) * (+s.r || 0))));
    WT.openSheet(() => ({
      title: 'Finish workout',
      body: `<div class="grid g3" style="grid-template-columns:repeat(3,1fr)">
          <div class="stat"><div class="eyebrow">Duration</div><div class="v" style="font-size:24px">${WT.fmtDuration((Date.now() - new Date(a.startedAt)) / 1000)}</div></div>
          <div class="stat"><div class="eyebrow">Sets</div><div class="v" style="font-size:24px">${done}<small>/${total}</small></div></div>
          <div class="stat"><div class="eyebrow">Volume</div><div class="v" style="font-size:24px">${WT.fmtNum(volume)}<small>${WT.db.profile.unit}</small></div></div></div>
        ${done < total ? `<div class="notes-box mt16" style="background:var(--warn-soft);color:var(--warn)">${I('info', 16)}<span>${total - done} unchecked set${total - done > 1 ? 's' : ''} won't be saved. Exercises with no completed sets are marked as skipped.</span></div>` : ''}
        ${done === 0 ? `<div class="notes-box mt8">${I('info', 16)}<span>No sets completed yet — tap the ✓ next to each set as you finish it.</span></div>` : ''}
        <div class="label mt16">Notes</div><textarea class="input mt8" data-in="sessionNotes" placeholder="Optional">${esc(a.notes || '')}</textarea>`,
      foot: `<button class="btn btn-secondary grow" data-act="closeSheet">Keep training</button><button class="btn btn-primary grow" data-act="woSave" ${done === 0 ? 'disabled' : ''}>${I('check', 17)}Save workout</button>`,
    }));
  };
  A.woSave = () => {
    const a = WT.db.active;
    a.timer = null;
    const s = WT.finishSession(JSON.parse(JSON.stringify(a)));
    s.exercises.forEach((e) => {
      delete e.showNotes;
    });
    delete s.timer;
    WT.db.history.push(s);
    WT.db.active = null;
    WT.save(true);
    WT.closeSheet(true);
    WT.go('history', s.id);
    WT.openSheet(() => ({
      title: 'Workout saved',
      body: `<div style="text-align:center;padding:10px 0 4px"><div class="avatar" style="margin:0 auto;width:64px;height:64px;border-radius:20px;background:var(--good-soft);color:var(--good)">${I('check', 30)}</div>
          <h3 style="margin-top:14px;font-size:20px">Nice work.</h3><p class="muted mt8">${WT.fmtDuration(s.durationSec)} · ${s.totals.sets} sets${s.totals.volume ? ' · ' + WT.fmtNum(s.totals.volume) + ' ' + WT.db.profile.unit : ''}</p></div>
        ${s.prs.length ? `<div class="label mt16">New personal records</div><div class="mt8">${s.prs.map((r) => `<div class="pr-item"><div class="trophy">${I('trophy', 17)}</div><div class="grow"><div class="strong">${esc(WT.ex(r.exId).name)}</div><div class="small muted">${r.kind} · ${esc(r.value)}</div></div></div>`).join('')}</div>` : `<p class="small muted mt16" style="text-align:center">Your numbers are saved — next time you'll see progression recommendations based on today.</p>`}`,
      foot: `<button class="btn btn-primary btn-block" data-act="closeSheet">Done</button>`,
    }));
  };
})();
