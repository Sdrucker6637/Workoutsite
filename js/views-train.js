/* Views: Today (dashboard), Generate, Train (active workout) + shared sheets. */
(function () {
  const WT = globalThis.WT;
  const I = WT.icon, esc = WT.esc, H = WT.h, A = WT.A, V = WT.V;
  const pad2 = (n) => String(n).padStart(2, '0');
  const wordNum = (n) => ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][n] || String(n);
  const italicLast = (t) => {
    const parts = esc(t).split(' ');
    if (parts.length < 2) return `<em>${parts[0]}</em>`;
    return parts.slice(0, -1).join(' ') + ' <em>' + parts[parts.length - 1] + '</em>';
  };
  WT.italicLast = italicLast;
  const abbr = (s) => (s.type === 'cardio' ? 'Run' : { full: 'FB', push: 'Pu', pull: 'Pl', legs: 'Lg', chest: 'Ch', back: 'Bk', shoulders: 'Sh', arms: 'Ar', biceps: 'Bi', triceps: 'Tr', core: 'Co', custom: 'Cu' }[s.type] || '•');

  /* ═════════════════════ TODAY ═════════════════════ */
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
    const part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
    const title = p.name ? `Good ${part}, <em>${esc(p.name)}</em>.` : `Good <em>${part}</em>.`;

    // Lead sentence, written from real data
    const weekly = WT.muscleLoad(24 * 7);
    const behind = p.prioritize.filter((m) => (weekly[m] || 0) < WT.weeklyTarget(m) * 0.5).map(WT.muscleName);
    let lead;
    if (!ss.length) lead = 'A fresh journal. Compose your first session — every set you log becomes the baseline for what comes next.';
    else {
      lead = `${wordNum(week.strength)} of ${wordNum(p.strengthPerWeek).toLowerCase()} strength sessions logged this week${runs ? `, plus ${runs === 1 ? 'a run' : runs + ' runs'}` : ''}. ${sugg.reason}`;
      if (behind.length && sugg.type !== 'cardio') lead += ` ${listJoin(behind.slice(0, 3))} ${behind.length === 1 ? 'is' : 'are'} light on volume.`;
    }

    // Week strip
    const start = WT.startOfWeek(now);
    const today = WT.startOfDay(now);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const sess = ss.filter((s) => WT.startOfDay(s.startedAt).getTime() === d.getTime());
      days.push(`<div class="day ${d.getTime() === today.getTime() ? 'today' : ''} ${d > today ? 'future' : ''}">
        <span class="dname">${d.toLocaleDateString(undefined, { weekday: 'short' })}</span><span class="dnum">${d.getDate()}</span>
        ${sess.map((s) => `<a class="day-mark ${s.type === 'cardio' ? 'run' : ''}" data-abbr="${abbr(s)}" href="#/history/${s.id}" title="${esc(s.title)}">${esc(s.title)}</a>`).join('')}</div>`);
    }
    const weekEnd = new Date(start);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const recent = ss.slice(-4).reverse();
    const u = p.unit;
    const entries = recent.length
      ? recent
          .map(
            (s) => `<a class="entry" href="#/history/${s.id}">
          <div class="entry-date">${WT.fmtDate(s.startedAt, { month: 'short', day: 'numeric' })}<span class="d2">${new Date(s.startedAt).toLocaleDateString(undefined, { weekday: 'long' })}</span></div>
          <div><div class="entry-title">${esc(s.title)}</div>
            <div class="entry-meta"><span>${WT.fmtDuration(s.durationSec)}</span><span>${plural((s.totals && s.totals.sets) || 0, 'set')}</span>${s.totals && s.totals.volume ? `<span>${WT.fmtNum(s.totals.volume)} ${u}</span>` : ''}${(s.prs || []).length ? `<span class="pr-mark">★ ${s.prs.length} record${s.prs.length > 1 ? 's' : ''}</span>` : ''}</div>
            <div class="entry-ex">${s.exercises.filter((e) => !e.skipped).map((e) => esc(e.name || (WT.ex(e.exId) || {}).name)).join(' · ')}</div></div>
          <span class="faint">${I('chevR', 18)}</span></a>`
          )
          .join('')
      : `<p class="footnote" style="font-size:17px;padding:22px 0">Nothing written here yet. Your sessions will collect on this page, newest first.</p>`;

    const groups = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];
    const last4 = st.weeks.slice(-4).reduce((a, w) => a + w.count, 0) / 4;
    const ledger = `
      <div class="section-head"><h2>Ledger</h2><a class="link quiet" href="#/progress">Progress</a></div>
      <div class="row" style="gap:36px;padding:14px 0 6px;align-items:flex-start">
        <div class="figure"><span class="v">${st.count}</span><span class="eyebrow">Sessions</span></div>
        <div class="figure"><span class="v">${WT.fmtNum(WT.round(last4, 1))}</span><span class="eyebrow">Per week · 4 wk</span></div>
      </div>
      <div class="eyebrow mt24" style="margin-bottom:4px">Last trained</div>
      ${groups
        .map((g) => {
          const t = st.lastTrained[g];
          const d = t ? WT.daysBetween(t, now) : null;
          return `<div class="leader"><span>${WT.GROUPS[g]}</span><span class="mono ${d != null && d <= 1 ? '' : 'faint'}" style="font-size:12px">${d == null ? '—' : d === 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days'}</span></div>`;
        })
        .join('')}
      <div class="eyebrow mt24" style="margin-bottom:4px">Latest records</div>
      ${st.prs.length ? st.prs.slice(0, 3).map((r) => `<div class="leader"><span class="ellipsis">${esc((WT.ex(r.exId) || {}).name || r.exId)}</span><span class="mono" style="font-size:12px">${esc(r.value)}</span></div>`).join('') : `<p class="small faint" style="padding:6px 0">Beat a previous best and it’s recorded here.</p>`}`;

    const resume = active
      ? `<a class="resume" href="#/workout"><span class="live-dot"></span>
          <div><div class="eyebrow" style="color:var(--forest)">In session</div><div class="h4" style="margin-top:4px">${esc(active.title)}</div><div class="small muted mt4">${doneSets(active)} of ${totalSets(active)} sets complete</div></div>
          <div class="row" style="gap:20px"><span class="t hide-m" id="dashClock">${WT.fmtClock((Date.now() - new Date(active.startedAt)) / 1000)}</span><span class="btn btn-primary">Resume <span class="arrow">${I('chevR', 16)}</span></span></div></a>`
      : '';

    const jumpTypes = ['full', 'push', 'pull', 'legs', 'chest', 'arms', 'core', 'cardio'].filter((t) => t !== sugg.type);

    return `
      <div class="page-head" style="margin-bottom:28px"><div class="eyebrow"><span>${now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div></div>
      ${resume}
      <section class="masthead">
        <div>
          <h1 class="display">${title}</h1>
          <p class="lead">${esc(lead)}</p>
          <div class="masthead-cta">
            ${active ? '' : `<button class="btn btn-primary btn-lg" data-act="quickGen" data-k="${sugg.type}">Compose a ${WT.typeName(sugg.type)} session <span class="arrow">${I('chevR', 18)}</span></button>`}
            <button class="link" data-act="logRun">Log a run</button>
            ${WT.db.draft && !active ? `<a class="link quiet" href="#/generate">Open draft: ${esc(WT.db.draft.title)}</a>` : ''}
          </div>
          <div class="jump"><span style="margin-right:10px">Or</span>${jumpTypes.map((t, i) => `${i ? '<span class="sep">/</span>' : ''}<button data-act="quickGen" data-k="${t}">${WT.typeName(t)}</button>`).join('')}</div>
        </div>
        <div class="week-sum hide-m">
          <div class="figure lg"><span class="v">${week.strength}<small>/ ${p.strengthPerWeek}</small></span><span class="eyebrow">Strength</span></div>
          <div class="figure lg"><span class="v">${runs}<small>/ ${p.runsPerWeek}</small></span><span class="eyebrow">Runs</span></div>
        </div>
      </section>

      <section>
        <div class="row between wrap" style="margin-bottom:12px;align-items:baseline;gap:6px"><h2 class="h4">This week</h2><span class="eyebrow">${WT.fmtDate(start, { month: 'short', day: 'numeric' })} — ${WT.fmtDate(weekEnd, { month: 'short', day: 'numeric' })}<span class="hide-d"> · ${week.strength}/${p.strengthPerWeek} strength · ${runs}/${p.runsPerWeek} runs</span></span></div>
        <div class="week">${days.join('')}</div>
      </section>

      <section class="grid-asym mt64">
        <div><div class="section-head"><h2>Recent entries</h2>${ss.length ? `<a class="link quiet" href="#/history">Full log</a>` : ''}</div><div class="entries">${entries}</div></div>
        <aside>${ledger}</aside>
      </section>

      <section class="mt64">
        <div class="section-head"><h2>Intent</h2><a class="link quiet" href="#/settings">Edit</a></div>
        <ol class="goals" style="padding:0;margin:0">${p.goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ol>
      </section>`;
  };
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  WT.plural = plural;
  function listJoin(a) {
    return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  }
  function runsThisWeek() {
    const start = WT.startOfWeek(new Date());
    return WT.db.history.filter((s) => new Date(s.startedAt) >= start && s.exercises.some((e) => !e.skipped && WT.ex(e.exId) && WT.ex(e.exId).tags.includes('run'))).length;
  }
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
      const w = { type: 'cardio', title: 'Run', exercises: [Object.assign({ exId: 'outdoor-run' }, WT.prescribe(WT.ex('outdoor-run'), 'standard'))] };
      WT.db.active = WT.sessionFromWorkout(w);
      WT.save(true);
      WT.go('workout');
    };
    if (WT.db.active) WT.confirm('Replace current workout?', 'You have a workout in progress. Starting a run will discard it.', 'Discard and start', begin, true);
    else begin();
  };

  /* ═════════════════════ GENERATE ═════════════════════ */
  function gen() {
    if (!WT.ui.gen) WT.ui.gen = WT.db.draft && WT.db.draft.settings ? Object.assign(WT.defaultSettings(), WT.db.draft.settings) : WT.defaultSettings();
    if (WT.ui.gen.intensityMode === 'auto') WT.ui.gen.intensityMode = 'random';
    return WT.ui.gen;
  }
  V.generate = function () {
    const g = gen();
    const p = WT.db.profile;
    const odds = p.intensityOdds;
    const types = WT.WORKOUT_TYPES.map((t, i, all) => `<span class="ti"><button class="${g.type === t.id ? 'on' : ''}" data-act="genType" data-k="${t.id}" aria-pressed="${g.type === t.id}">${t.name}</button>${i < all.length - 1 ? '<span class="slash" aria-hidden="true">/</span>' : ''}</span>`).join('');
    const reg = Math.max(0, g.count - (+g.heavy || 0) - (+g.burnout || 0));
    const muscles = Object.fromEntries(Object.entries(WT.MUSCLES).filter(([k]) => k !== 'cardio').map(([k, v]) => [k, v.name]));
    const random = g.intensityMode !== 'manual';

    const controls = `
      <div class="eyebrow" style="margin-bottom:12px">Session type</div>
      <div class="typeset">${types}</div>
      ${g.type === 'custom' ? `<div class="mt24"><div class="label" style="margin-bottom:10px">Muscle groups <span class="faint" style="font-weight:400">— any combination</span></div>${H.chipGroup(WT.CUSTOM_TARGETS, g.targets, 'genTarget')}</div>` : ''}
      <div class="mt32" style="border-top:1.5px solid var(--ink)">
        <div class="spec-row"><div><div class="k">Exercises</div><div class="d">${g.autoCount ? 'Fitted to your duration' : 'Default is 5–6'}</div></div>
          ${g.autoCount ? `<span class="mono faint">auto</span>` : H.stepper(g.count, 'genStep', 'count', 1, 12)}</div>
        <div class="spec-row stack"><div class="row between"><span class="k">Duration</span><span class="mono small faint">${g.duration} min</span></div>
          ${H.seg([[30, '30'], [45, '45'], [60, '60'], [75, '75'], [90, '90']], g.duration, 'genSet', 'duration', 'full num')}
          <div class="row between"><span class="small muted">Fit exercise count to time</span>${H.toggle(g.autoCount, 'genToggle', 'data-k="autoCount"')}</div></div>
        <div class="spec-row stack"><div class="row between"><span class="k">Intensity</span>${H.seg([['random', 'Randomized'], ['manual', 'Fixed']], random ? 'random' : 'manual', 'genSet', 'intensityMode')}</div>
          ${
            random
              ? `${H.oddsBar(odds)}<div class="itally">${['heavy', 'regular', 'burnout', 'standard'].map((k) => `<span class="imark ${k}">${H.pct(odds, k)}% ${k}</span>`).join('')}</div>
                 <p class="small faint">Each exercise is drawn independently, weighted by what suits it. No fixed formula. <a class="link quiet" href="#/settings">Adjust odds</a></p>`
              : `<div class="row between"><span class="imark heavy">Heavy</span>${H.stepper(g.heavy, 'genStep', 'heavy', 0, 12)}</div>
                 <div class="row between"><span class="imark burnout">Burnout</span>${H.stepper(g.burnout, 'genStep', 'burnout', 0, 12)}</div>
                 <p class="small faint">${reg} regular. Heavy goes to compound lifts, burnouts to finishers.</p>`
          }</div>
        <div class="spec-row"><div><div class="k">Supersets</div><div class="d">Pair non-competing exercises</div></div>${H.toggle(g.supersets, 'genToggle', 'data-k="supersets"')}</div>
        <details class="disclose"><summary class="spec-row"><div><div class="k">Equipment</div><div class="d">${g.equipment.length} available</div></div><span class="chev">${I('chevD', 18)}</span></summary>
          <div class="disclose-body">${H.chipGroup(WT.EQUIPMENT, g.equipment, 'genEquip').replace(/class="chip /g, 'class="chip sm ')}</div></details>
        <details class="disclose"><summary class="spec-row"><div><div class="k">Prioritize</div><div class="d">${g.prioritize.length ? g.prioritize.map(WT.muscleName).join(', ') : 'Nothing in particular'}</div></div><span class="chev">${I('chevD', 18)}</span></summary>
          <div class="disclose-body">${H.chipGroup(muscles, g.prioritize, 'genPrio').replace(/class="chip /g, 'class="chip sm ')}</div></details>
        <details class="disclose"><summary class="spec-row"><div><div class="k">Avoid muscles</div><div class="d">${g.avoidMuscles.length ? g.avoidMuscles.map(WT.muscleName).join(', ') : 'None'}</div></div><span class="chev">${I('chevD', 18)}</span></summary>
          <div class="disclose-body">${H.chipGroup(muscles, g.avoidMuscles, 'genAvoid', 'avoid sm')}</div></details>
        <button class="spec-row" data-act="openExcluded"><div><div class="k">Excluded exercises</div><div class="d">${p.excluded.length} excluded · ${p.restrictions.length} movement restrictions</div></div><span class="faint">${I('chevR', 18)}</span></button>
      </div>
      <button class="btn btn-primary btn-lg btn-block mt24" data-act="generate">${WT.db.draft ? 'Compose a new session' : 'Compose session'} <span class="arrow">${I('chevR', 18)}</span></button>`;

    const d = WT.db.draft;
    let plan;
    if (WT.ui.composing) {
      plan = `<div class="plan" aria-busy="true"><div class="eyebrow">Composing…</div><div class="composing mt24"><i style="width:40%;height:44px"></i><i style="width:70%"></i><i style="width:90%"></i><i style="width:60%"></i><i style="width:85%"></i><i style="width:50%"></i></div></div>`;
    } else if (!d) {
      plan = `<div class="blank"><div class="eyebrow">Training plan</div><h3 class="mt16">An empty page.</h3><p>Choose a session type and compose. Exercises are chosen from your goals, equipment, restrictions and the last few days of training, then each one gets its own intensity.</p>
        <button class="btn btn-primary mt24" data-act="generate">Compose session <span class="arrow">${I('chevR', 16)}</span></button></div>`;
    } else {
      const tally = WT.intensityTally(d.exercises);
      const sets = d.exercises.reduce((a, i) => a + (i.sets || 0), 0);
      plan = `<article class="plan">
        <header class="plan-head">
          <div class="row between"><span class="eyebrow">Training plan · ${WT.fmtDate(d.createdAt || Date.now(), { month: 'short', day: 'numeric' })}</span><button class="icon-btn sm" data-act="clearDraft" title="Discard plan" aria-label="Discard plan">${I('x', 18)}</button></div>
          <h2 class="plan-title">${italicLast(d.title)}</h2>
          <div class="plan-meta">
            <div class="figure"><span class="v">~${d.estimatedMin}<small>min</small></span></div>
            <div class="figure"><span class="v">${d.exercises.length}<small>exercises</small></span></div>
            <div class="figure"><span class="v">${sets}<small>sets</small></span></div>
          </div>
          <div class="row between wrap mt24" style="gap:12px">
            <div class="itally">${['heavy', 'regular', 'burnout', 'standard'].filter((k) => tally[k]).map((k) => `<span class="imark ${k}"><span>${tally[k]}</span>&nbsp;${WT.INTENSITY_INFO[k].name}</span>`).join('')}</div>
            <button class="link quiet" data-act="rerollIntensity">${I('refresh', 14)}Re-roll intensities</button>
          </div>
          ${(d.notes || []).length ? `<div class="plan-notes mt16">${d.notes.map((nt, i) => `<p class="footnote">${'†‡§'[i] || '*'} ${esc(nt)}</p>`).join('')}</div>` : ''}
        </header>
        <div class="plan-rows">${planRows(d)}</div>
        <div class="plan-foot"><button class="btn btn-secondary btn-sm" data-act="openAdd" data-ctx="draft">${I('plus', 16)}Add exercise</button><span class="small faint">Lock an exercise to keep it when you regenerate.</span></div>
        <div class="row mt32" style="gap:10px">
          <button class="btn btn-secondary btn-lg" data-act="regenerate" aria-label="Regenerate">${I('refresh', 18)}<span class="hide-m">Regenerate</span></button>
          <button class="btn btn-primary btn-lg grow" data-act="startDraft">Start session <span class="arrow">${I('chevR', 18)}</span></button>
        </div>
      </article>`;
    }
    return `<div class="page-head"><div class="eyebrow"><span>Generator</span></div><h1 class="h1">Compose a <em>session</em>.</h1></div>
      <div class="gen"><div class="gen-controls">${controls}</div><div id="planCol" style="scroll-margin-top:80px">${plan}</div></div>`;
  };

  function planRows(d) {
    let n = 0;
    return WT.groupBlocks(d.exercises)
      .map((b) => {
        const rows = b.map((it) => planRow(it, pad2(++n))).join('');
        return b.length > 1 ? `<div class="ss"><div class="ss-label">Superset ${b[0].superset} <span class="faint">alternate sets · rest after both</span></div>${rows}</div>` : rows;
      })
      .join('');
  }
  function planRow(it, label) {
    const ex = WT.ex(it.exId);
    if (!ex) return '';
    const eq = ex.equipment.filter((q) => q !== 'bw').map((q) => WT.EQUIPMENT[q]);
    return `<div class="prow ${it.locked ? 'locked' : ''}">
      <div class="prow-idx">${label}</div>
      <div style="min-width:0">
        <button class="prow-name" data-act="exDetail" data-id="${ex.id}">${esc(ex.name)}</button>
        <div class="prow-sub">${H.muscles(ex)}${eq.length ? ' — ' + esc(eq.join(', ')) : ''}</div>
        ${it.why && it.why.length ? `<div class="prow-why">${esc(it.why.join('; '))}</div>` : ''}
      </div>
      <div class="prow-rx"><div class="big">${H.target(it, ex)}</div>${it.rest ? `<div class="rest">${WT.fmtClock(it.rest)} rest</div>` : ''}</div>
      <div class="prow-foot"><div class="prow-int">${H.intensity(it.intensity, 'pickIntensity', it.uid, 'draft')}</div>
      <div class="prow-act">
        <button class="swap" data-act="openSwap" data-ctx="draft" data-uid="${it.uid}">${I('swap', 15)}Swap</button>
        <button class="icon-btn sm ${it.locked ? 'on' : ''}" data-act="planLock" data-uid="${it.uid}" aria-pressed="${!!it.locked}" title="${it.locked ? 'Unlock' : 'Lock — keep on regenerate'}" aria-label="${it.locked ? 'Unlock' : 'Lock'} ${esc(ex.name)}">${I(it.locked ? 'lock' : 'unlock', 17)}</button>
        <button class="icon-btn sm" data-act="planRemove" data-uid="${it.uid}" title="Remove" aria-label="Remove ${esc(ex.name)}">${I('x', 18)}</button>
      </div></div></div>`;
  }

  const toggleIn = (arr, k) => (arr.includes(k) ? arr.filter((x) => x !== k) : arr.concat(k));
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
    const g = gen();
    g[d.k] = isNaN(+d.v) ? d.v : +d.v;
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
    if (innerWidth <= 1180) {
      const el = document.getElementById('planCol');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setTimeout(() => {
      WT.ui.composing = false;
      WT.db.draft = make();
      WT.save();
      WT.render(true);
      document.getElementById('main').classList.remove('calm'); // let plan rows rise in
      if (msg) WT.toast(msg);
    }, 420);
  }
  A.generate = () => {
    const g = gen();
    if (g.type === 'custom' && !g.targets.length) return WT.toast('Pick at least one muscle group', 'error');
    compose(() => WT.generate(g));
  };
  A.regenerate = () => {
    const d = WT.db.draft;
    if (!d) return A.generate();
    const keep = d.exercises.filter((i) => i.locked);
    compose(() => WT.generate(Object.assign({}, d.settings, gen().type === d.type ? gen() : {}), keep), keep.length ? `Regenerated — kept ${keep.length} locked` : null);
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
    WT.render(true);
    document.getElementById('main').classList.remove('calm');
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

  /* Intensity picker — draft and active session */
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
        body: `<div class="opt-list">${WT.INTENSITIES.map((k) => {
          const ok = ex.intensities.includes(k);
          const pr = ok ? WT.prescribe(ex, k) : null;
          const info = WT.INTENSITY_INFO[k];
          return `<button class="opt ${it.intensity === k ? 'on' : ''}" data-act="setIntensity" data-k="${k}" ${ok ? '' : 'disabled'}>
            <div><div class="row wrap" style="gap:6px 14px"><span class="imark ${k}">${info.name}</span>${pr ? `<span class="mono small">${H.target(Object.assign({}, pr, { targetSets: pr.sets }), ex)}${pr.rest ? ` · ${WT.fmtClock(pr.rest)} rest` : ''}</span>` : ''}</div>
            <div class="m" style="margin-top:6px">${ok ? info.text : `Not suitable for ${esc(ex.name)}.`}</div></div>${it.intensity === k ? `<span style="color:var(--forest)">${I('check', 18)}</span>` : ''}</button>`;
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
    if (!d || !d.exercises.length) return WT.toast('Compose a session first', 'error');
    const begin = () => {
      WT.db.active = WT.sessionFromWorkout(d);
      WT.db.draft = null;
      WT.unlockAudio();
      WT.save(true);
      WT.go('workout');
    };
    if (WT.db.active) WT.confirm('Replace current workout?', 'A workout is already in progress. Starting this one will discard it.', 'Discard and start', begin, true);
    else begin();
  };

  /* Exclusions */
  A.openExcluded = () => {
    WT.openSheet(() => {
      const p = WT.db.profile;
      const list = p.excluded.map((id) => WT.ex(id)).filter(Boolean);
      return {
        eyebrow: 'Generator',
        title: 'Exclusions',
        body: `<div class="label">Movement restrictions</div>
          <div class="mt8">${Object.entries(WT.RESTRICTION_TAGS).map(([k, v]) => `<div class="spec-row"><div class="k" style="font-weight:500">${esc(v)}</div>${H.toggle(p.restrictions.includes(k), 'toggleRestriction', `data-k="${k}"`)}</div>`).join('')}</div>
          <div class="label mt32">Excluded exercises</div>
          ${list.length ? `<div class="opt-list mt8">${list.map((ex) => `<div class="opt"><div><div class="t">${esc(ex.name)}</div><div class="m">${WT.muscleName(ex.primary)}</div></div><button class="btn btn-ghost btn-sm" data-act="unexclude" data-id="${ex.id}">Restore</button></div>`).join('')}</div>` : `<p class="small faint mt8">None yet. Exclude exercises from the Library or from the swap sheet.</p>`}`,
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
      const info = WT.INTENSITY_INFO[item.intensity] || WT.INTENSITY_INFO.standard;
      return {
        eyebrow: 'Swap · ' + esc((item.slot && item.slot.label) || WT.muscleName(cur.primary)),
        title: esc(cur.name),
        body: `<p class="small muted">Alternatives keep this exercise’s place, its set count and — where suitable — its <b>${info.name.toLowerCase()}</b> intensity. Only equipment you have; exclusions respected.</p>
          ${doneCount ? `<div class="callout warn mt12">${I('info', 16)}<span>${doneCount} logged set${doneCount > 1 ? 's' : ''} on this exercise will be cleared.</span></div>` : ''}
          <div class="row between wrap mt24" style="gap:10px"><span class="eyebrow">${alts.length} alternatives</span>${H.seg([[0, 'Best match'], [1, 'Whole muscle group']], state.wide ? 1 : 0, 'swapWide')}</div>
          <div class="opt-list mt12">${
            alts.length
              ? alts
                  .map(
                    (a) => `<button class="opt" data-act="doSwap" data-id="${a.ex.id}"><div style="min-width:0"><div class="t">${esc(a.ex.name)}${WT.db.profile.favorites.includes(a.ex.id) ? ` <span class="star on" aria-label="Favorite">★</span>` : ''}</div>
                <div class="m">${H.muscles(a.ex)} — ${a.ex.equipment.map((q) => WT.EQUIPMENT[q]).join(', ')}${a.samePattern ? ' · <span style="color:var(--forest)">same movement</span>' : ''}</div></div><span class="faint">${I('chevR', 18)}</span></button>`
                  )
                  .join('')
              : `<p class="small muted" style="padding:18px 0">No alternatives with your current equipment and exclusions. Try “Whole muscle group”.</p>`
          }</div>
          <button class="btn btn-ghost btn-sm mt16" data-act="excludeFromSwap" data-id="${cur.id}" style="padding-left:0">${I('ban', 15)}Never suggest ${esc(cur.name)}</button>`,
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
      WT.toast('Swapped in ' + WT.ex(dd.id).name, 'good');
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
    const state = { q: '', mine: true, group: '' };
    const ctx = d.ctx;
    WT.openSheet(() => {
      const q = state.q.toLowerCase();
      const list = WT.exercises
        .filter((ex) => (!state.mine || (WT.hasEquipment(ex) && !WT.isRestricted(ex))) && (!state.group || WT.MUSCLES[ex.primary].group === state.group) && (!q || ex.name.toLowerCase().includes(q) || WT.muscleName(ex.primary).toLowerCase().includes(q)))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 80);
      return {
        eyebrow: ctx === 'active' ? 'Current session' : 'Training plan',
        title: 'Add an exercise',
        body: `<div class="search"><span>${I('search', 17)}</span><input class="input" id="addSearch" placeholder="Search exercises or muscles" value="${esc(state.q)}" data-in="addSearch" autocomplete="off"></div>
          <div class="mt12">${H.seg([['', 'All'], ...Object.entries(WT.GROUPS)], state.group, 'addGroup')}</div>
          <div class="row between mt12"><span class="small muted">Only exercises I can do</span>${H.toggle(state.mine, 'addMine')}</div>
          <div class="opt-list mt12">${list.map((ex) => `<button class="opt" data-act="doAdd" data-id="${ex.id}"><div style="min-width:0"><div class="t">${esc(ex.name)}</div><div class="m">${H.muscles(ex)} — ${ex.equipment.map((q2) => WT.EQUIPMENT[q2]).join(', ')}</div></div><span class="faint">${I('plus', 18)}</span></button>`).join('') || '<p class="small muted" style="padding:18px 0">No matches.</p>'}</div>`,
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
      if (ctx === 'active') WT.db.active.exercises.push(WT.sessionItem(ex.id));
      else {
        if (!WT.db.draft) WT.db.draft = { id: WT.uid(), type: gen().type, title: WT.typeName(gen().type), createdAt: new Date().toISOString(), settings: gen(), notes: [], exercises: [] };
        WT.db.draft.exercises.push(Object.assign({ uid: WT.uid(), exId: ex.id, slot: { label: WT.muscleName(ex.primary), m: [ex.primary], p: null }, slotIndex: 99, why: ['Added by you'], locked: true }, WT.prescribe(ex, ex.intensity)));
        WT.db.draft.estimatedMin = WT.estimateMinutes(WT.db.draft.exercises);
      }
      WT.save();
      WT.closeSheet();
      WT.rerender();
      WT.toast('Added ' + ex.name, 'good');
      if (ctx === 'active') setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 60);
    };
  };

  /* ═════════════════════ TRAIN (active workout) ═════════════════════ */
  V.workout = function () {
    const a = WT.db.active;
    if (!a) {
      return `<div class="page-head"><div class="eyebrow"><span>Train</span></div><h1 class="h1">Nothing <em>underway</em>.</h1>
        <p class="lead">Start from a composed plan, repeat a session from your log, or begin with a blank page and add exercises as you go.</p></div>
        <div class="row wrap" style="gap:12px">
          ${WT.db.draft ? `<button class="btn btn-primary btn-lg" data-act="startDraft">Start ${esc(WT.db.draft.title)} <span class="arrow">${I('chevR', 18)}</span></button>` : `<a class="btn btn-primary btn-lg" href="#/generate">Compose a session <span class="arrow">${I('chevR', 18)}</span></a>`}
          <button class="btn btn-secondary btn-lg" data-act="startEmpty">Blank session</button>
          <button class="link" data-act="logRun" style="margin-left:8px">Log a run</button>
        </div>`;
    }
    const done = doneSets(a), total = totalSets(a);
    const live = a.exercises.filter((e) => !e.skipped);
    const exDone = live.filter((e) => e.sets.length && e.sets.every((s) => s.done)).length;
    const current = a.exercises.find((e) => !e.skipped && e.sets.some((s) => !s.done));
    let n = 0;
    const blocks = WT.groupBlocks(a.exercises)
      .map((b) => {
        const cards = b.map((it) => exCard(it, pad2(++n), it === current)).join('');
        return b.length > 1 ? `<div class="ss-run">Superset ${b[0].superset} — alternate sets, rest after both</div>${cards}` : cards;
      })
      .join('');
    return `
      <header class="wo-top">
        <div style="min-width:0"><div class="eyebrow">${esc(WT.typeName(a.type))} · began ${new Date(a.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div><h1 class="h2 mt12" style="font-size:clamp(34px,4.6vw,52px)">${italicLast(a.title)}</h1></div>
        <div class="hide-m"><div class="wo-clock" id="woClock">${WT.fmtClock((Date.now() - new Date(a.startedAt)) / 1000)}</div><div class="eyebrow" style="text-align:right;margin-top:8px">Elapsed</div></div>
      </header>
      <div class="wo-progress" role="progressbar" aria-label="Sets completed" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${total}"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div>
      <div class="row between wrap" style="padding:14px 0 6px;gap:12px">
        <span class="mono small muted">${done} / ${total} sets · ${exDone} / ${live.length} exercises</span>
        <div class="row" style="gap:4px">
          <button class="btn btn-ghost btn-sm" data-act="woTimerMenu">${I('timer', 16)}Rest timer</button>
          <button class="btn btn-ghost btn-sm" data-act="woDiscard" aria-label="Discard session">${I('trash', 16)}<span class="hide-m">Discard</span></button>
          <button class="btn btn-primary btn-sm hide-m" data-act="woFinish">Finish session</button>
        </div>
      </div>
      <div class="wo-list">${blocks || `<div class="empty"><h3>A blank page.</h3><p>Add your first exercise to start logging.</p></div>`}</div>
      <div class="wo-list mt24">
        <button class="btn btn-secondary" data-act="openAdd" data-ctx="active" style="align-self:flex-start">${I('plus', 17)}Add exercise</button>
        <div class="mt48"><div class="eyebrow" style="margin-bottom:10px">Session notes</div><textarea class="input" data-in="sessionNotes" placeholder="Sleep, energy, anything worth remembering…">${esc(a.notes || '')}</textarea></div>
        <button class="btn btn-primary btn-lg btn-block mt24" data-act="woFinish">Finish session</button>
      </div>`;
  };

  function exCard(item, label, isCurrent) {
    const ex = WT.ex(item.exId);
    if (!ex) return `<div class="xc">Unknown exercise (${esc(item.exId)})</div>`;
    const a = WT.db.active;
    const tt = WT.trackType(ex);
    const allDone = item.sets.length && item.sets.every((s) => s.done);
    const u = WT.db.profile.unit;
    const secUnit = tt === 'time' || ex.unit === 'sec';

    if ((allDone || item.skipped) && !item.expanded) {
      const summary = item.skipped ? 'Skipped' : fmtSets(item.sets.map((s) => ({ w: +s.w || 0, r: +s.r || 0, time: +s.time || 0, dist: +s.dist || 0 })), tt, ex);
      return `<div class="xc collapsed ${item.skipped ? 'skipped' : 'done'}" id="ex-${item.uid}">
        <button class="xc-sum" data-act="xcToggle" data-uid="${item.uid}" aria-expanded="false">
          ${item.skipped ? `<span class="xc-idx" style="font-size:22px">${label}</span>` : `<span class="tick">${I('check', 15)}</span>`}
          <div style="min-width:0"><div class="nm ellipsis">${esc(ex.name)}</div><div class="sm ellipsis">${summary}</div></div>
          <span class="faint">${I('chevD', 18)}</span></button></div>`;
    }

    const hist = WT.exerciseHistory(ex.id, a.id);
    const last = hist[hist.length - 1];
    const pr = WT.personalRecords(ex.id, a.id);
    const rec = WT.recommend(ex.id, { repMin: item.repMin, repMax: item.repMax, sets: item.targetSets, intensity: item.intensity }, a.id);
    const anyDone = item.sets.some((s) => s.done);
    const recIcon = { increase: 'trendUp', progress: 'trendUp', decrease: 'trendDown', hold: 'equal', reps: 'plus', return: 'refresh' }[rec.action] || 'info';
    const canApply = (rec.weight != null && (tt === 'weight' || (tt === 'reps' && rec.weight > 0))) || (rec.addLoad && tt === 'reps');
    const advice =
      item.skipped || allDone
        ? ''
        : `<div class="advice ${rec.action}"><span class="ic">${I(recIcon, 18)}</span><div style="min-width:0"><div class="h">${esc(rec.headline)}</div>
          <details><summary>Why ${I('chevD', 12)}</summary>${rec.reasons.map((r) => `<p>${esc(r)}</p>`).join('')}</details></div>
          ${canApply ? (item.recApplied ? `<span class="applied">${I('check', 13)}Applied</span>` : `<button class="btn btn-secondary btn-sm" data-act="woApplyRec" data-uid="${item.uid}">Apply</button>`) : ''}</div>`;

    const lastLine = last
      ? `<div class="lastline"><span>Last · ${WT.fmtRelDay(last.date).toLowerCase()} <b>${fmtSets(last.sets, tt, ex)}</b></span>${pr.heaviest && tt !== 'cardio' ? `<span>Best <b>${WT.fmtNum(pr.heaviest.w)} × ${pr.heaviest.r}</b></span>` : pr.reps && tt !== 'cardio' ? `<span>Best <b>${pr.reps.r}${secUnit ? 's' : ' reps'}</b></span>` : ''}</div>`
      : '';

    let head;
    if (tt === 'cardio') head = `<span>Set</span><span>Prev</span><span>Min</span><span></span><span>Miles</span><span></span>`;
    else if (tt === 'time') head = `<span>Set</span><span>Prev</span><span></span><span></span><span>Sec</span><span></span>`;
    else head = `<span>Set</span><span>Prev</span><span>${tt === 'reps' ? '+' + u : u}</span><span></span><span>${secUnit ? 'Sec' : 'Reps'}</span><span></span>`;

    const recW = item.recApplied ? (rec.weight != null ? rec.weight : rec.addLoad || null) : null;
    const repT = rec.repTargets || null;
    const rows = item.sets
      .map((s, i) => {
        const prev = last ? last.sets[Math.min(i, last.sets.length - 1)] : null;
        const prevTxt = prev ? (tt === 'cardio' ? `${prev.time || '–'}′` : tt === 'time' ? `${prev.r}s` : prev.w ? `${WT.fmtNum(prev.w)}×${prev.r}` : `${prev.r}`) : '—';
        const phW = recW != null ? recW : prev && prev.w ? prev.w : '';
        const phR = repT && repT[i] != null ? repT[i] : prev ? prev.r : item.repMax;
        const inp = (f, ph, val, mode, lbl) => `<input class="num-in" type="text" inputmode="${mode || 'decimal'}" data-in="setVal" data-uid="${item.uid}" data-i="${i}" data-f="${f}" value="${esc(val)}" placeholder="${esc(ph)}" aria-label="Set ${i + 1} ${lbl}" autocomplete="off">`;
        let cells;
        if (tt === 'cardio') cells = `${inp('time', prev ? prev.time || '' : item.repMax, s.time || '', 'decimal', 'minutes')}<span class="set-x">·</span>${inp('dist', prev ? prev.dist || '' : '', s.dist || '', 'decimal', 'miles')}`;
        else if (tt === 'time') cells = `<span></span><span></span>${inp('r', phR, s.r, 'numeric', 'seconds')}`;
        else cells = `${inp('w', tt === 'reps' ? phW || '0' : phW, s.w, 'decimal', 'weight')}<span class="set-x">×</span>${inp('r', phR, s.r, 'numeric', secUnit ? 'seconds' : 'reps')}`;
        const just = WT.ui.justSet === item.uid + ':' + i;
        return `<div class="set ${s.done ? 'done' : ''} ${just ? 'just' : ''}"><span class="set-no">${i + 1}</span><span class="set-prev">${prevTxt}</span>${cells}
          <button class="check ${s.done ? 'on' : ''}" data-act="woCheck" data-uid="${item.uid}" data-i="${i}" aria-pressed="${!!s.done}" aria-label="${s.done ? 'Undo' : 'Complete'} set ${i + 1}">${I('check', 22)}</button></div>`;
      })
      .join('');

    return `<section class="xc ${isCurrent ? 'current' : ''} ${allDone ? 'done' : ''}" id="ex-${item.uid}" style="scroll-margin-top:90px">
      <div class="xc-head">
        <span class="xc-idx">${label}</span>
        <div style="min-width:0">
          ${isCurrent ? `<div class="now-tag" style="margin-bottom:6px">Now${item.superset ? ' · Superset ' + item.superset : ''}</div>` : item.superset ? `<div class="now-tag" style="margin-bottom:6px;color:var(--ink-3)">Superset ${item.superset}</div>` : ''}
          <button class="xc-title" data-act="exDetail" data-id="${ex.id}">${esc(ex.name)}</button>
          <div class="xc-meta">${H.intensity(item.intensity, 'pickIntensity', item.uid, 'active')}<span class="rx">${H.target({ sets: item.targetSets, repMin: item.repMin, repMax: item.repMax }, ex)}</span>${item.rest ? `<span>${WT.fmtClock(item.rest)} rest</span>` : ''}</div>
          ${item.note && (item.intensity === 'heavy' || item.intensity === 'burnout') ? `<div class="footnote mt8">${esc(item.note)}</div>` : ''}
        </div>
        <div class="xc-tools">
          <button class="swap hide-m" data-act="openSwap" data-ctx="active" data-uid="${item.uid}">${I('swap', 15)}Swap</button>
          <button class="icon-btn hide-d" data-act="openSwap" data-ctx="active" data-uid="${item.uid}" aria-label="Swap exercise" style="color:var(--forest)">${I('swap', 20)}</button>
          <button class="icon-btn" data-act="woMenu" data-uid="${item.uid}" aria-label="More options">${I('more', 20)}</button>
          ${allDone || item.skipped ? `<button class="icon-btn" data-act="xcToggle" data-uid="${item.uid}" aria-label="Collapse">${I('chevD', 18).replace('<svg', '<svg style="transform:rotate(180deg)"')}</button>` : ''}
        </div>
      </div>
      ${item.skipped ? `<div class="xc-foot"><button class="btn btn-secondary btn-sm" data-act="woSkip" data-uid="${item.uid}">Restore exercise</button></div>` : `
      ${advice}${lastLine}
      <div class="sets"><div class="sets-head">${head}</div>${rows}</div>
      <div class="xc-foot">
        <button class="btn btn-ghost btn-sm" data-act="woAddSet" data-uid="${item.uid}">${I('plus', 15)}Set</button>
        ${item.sets.length > 1 ? `<button class="btn btn-ghost btn-sm" data-act="woRemoveSet" data-uid="${item.uid}">${I('minus', 15)}Set</button>` : ''}
        <button class="btn btn-ghost btn-sm" data-act="woNoteToggle" data-uid="${item.uid}">${I('note', 15)}${item.notes ? 'Note' : 'Add note'}</button>
        <span class="grow"></span>
        ${item.rest ? `<button class="btn btn-ghost btn-sm mono" data-act="timerStart" data-s="${item.rest}" aria-label="Start ${WT.fmtClock(item.rest)} rest">${I('timer', 15)}${WT.fmtClock(item.rest)}</button>` : ''}
      </div>
      ${item.showNotes || item.notes ? `<div class="xc-notes"><textarea class="input" style="min-height:64px" data-in="exNotes" data-uid="${item.uid}" placeholder="Seat height, grip, how it felt…">${esc(item.notes || '')}</textarea></div>` : ''}
      ${anyDone && tt !== 'cardio' ? `<div class="effort"><span>How did it feel?</span>${H.seg([['easy', 'Easy'], ['good', 'Solid'], ['hard', 'Grinding']], item.effort || '', 'woEffort', item.uid)}</div>` : ''}`}
    </section>`;
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
  A.xcToggle = (d) => {
    const it = actItem(d.uid);
    it.expanded = !it.expanded;
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
  A.woCheck = (d) => {
    WT.unlockAudio();
    const it = actItem(d.uid);
    const ex = WT.ex(it.exId);
    const tt = WT.trackType(ex);
    const i = +d.i;
    const s = it.sets[i];
    if (s.done) {
      s.done = false;
      WT.ui.justSet = null;
      WT.save();
      return WT.rerender();
    }
    // Blank fields take what's shown as the placeholder (last time / applied recommendation / rep target)
    const row = document.querySelectorAll(`#ex-${it.uid} .set`)[i];
    if (row)
      row.querySelectorAll('.num-in').forEach((inp) => {
        const f = inp.dataset.f;
        if ((s[f] === '' || s[f] == null) && inp.placeholder !== '' && !isNaN(+inp.placeholder)) s[f] = inp.placeholder;
      });
    if (tt === 'weight' && (s.w === '' || s.w == null)) return WT.toast('Enter the weight used', 'error');
    if ((tt === 'weight' || tt === 'reps' || tt === 'time') && !(+s.r > 0)) return WT.toast(tt === 'time' ? 'Enter seconds held' : 'Enter reps completed', 'error');
    if (tt === 'cardio' && !(+s.time > 0) && !(+s.dist > 0)) return WT.toast('Enter time or distance', 'error');
    if (tt === 'reps' && s.w === '') s.w = '0';
    s.done = true;
    s.at = new Date().toISOString();
    WT.ui.justSet = it.uid + ':' + i;
    if (tt !== 'cardio' && s.w !== '') it.sets.slice(i + 1).forEach((x) => !x.done && (x.w === '' || x.w == null) && (x.w = s.w));
    const a = WT.db.active;
    const exComplete = it.sets.every((x) => x.done);
    const remaining = a.exercises.some((e) => !e.skipped && e.sets.some((x) => !x.done));
    if (!remaining) WT.toast('Every set logged — finish when ready', 'good');
    else if (it.superset) {
      const group = a.exercises.filter((e) => e.superset === it.superset && !e.skipped);
      const pos = group.indexOf(it);
      const partner = group.slice(pos + 1).find((e) => e.sets.some((x) => !x.done));
      if (partner && pos < group.length - 1) WT.toast('Now: ' + WT.ex(partner.exId).name);
      else if (it.rest) WT.startTimer(it.rest, 'Rest · Superset ' + it.superset);
    } else if (it.rest && tt !== 'cardio' && !exComplete) WT.startTimer(it.rest, 'Rest · ' + ex.name);
    else if (it.rest && tt !== 'cardio') WT.startTimer(Math.min(it.rest, 90), 'Next exercise');
    if (exComplete && remaining && !it.superset) WT.toast(ex.name + ' complete', 'good');
    WT.save();
    WT.rerender();
    if (exComplete && remaining) {
      const nxt = a.exercises.find((e) => !e.skipped && e.sets.some((x) => !x.done));
      if (nxt && (!it.superset || nxt.superset !== it.superset))
        setTimeout(() => {
          const el = document.getElementById('ex-' + nxt.uid);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 220);
    }
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
    WT.toast(`${ex.name}: ${WT.fmtNum(w)} ${WT.db.profile.unit}`, 'good');
  };
  A.woAddSet = (d) => {
    const it = actItem(d.uid);
    const lastSet = it.sets[it.sets.length - 1];
    it.sets.push({ w: lastSet ? lastSet.w : '', r: '', done: false });
    it.expanded = true;
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
    WT.closeSheet(true);
    WT.save();
    WT.rerender();
    setTimeout(() => {
      const t = document.querySelector(`[data-in="exNotes"][data-uid="${d.uid}"]`);
      if (t) {
        t.scrollIntoView({ block: 'center', behavior: 'smooth' });
        t.focus({ preventScroll: true });
      }
    }, 40);
  };
  A.woNoteToggle2 = (d) => {
    const it = actItem(d.uid);
    it.showNotes = false;
    it.expanded = true;
    A.woNoteToggle(d);
  };
  A.woEffort = (d) => {
    const it = actItem(d.k);
    it.effort = it.effort === d.v ? null : d.v;
    WT.save();
    WT.rerender();
  };
  A.woIntensity = (d) => A.pickIntensity({ uid: d.uid, ctx: 'active' });
  A.planIntensity = (d) => A.pickIntensity({ uid: d.uid, ctx: 'draft' });
  A.woSkip = (d) => {
    const it = actItem(d.uid);
    it.skipped = !it.skipped;
    it.expanded = false;
    WT.closeSheet(true);
    WT.save();
    WT.rerender();
  };
  A.woMenu = (d) => {
    const it = actItem(d.uid);
    const ex = WT.ex(it.exId);
    const a = WT.db.active;
    const idx = a.exercises.indexOf(it);
    const opt = (act, title, meta, extra, cls) => `<button class="opt ${cls || ''}" data-act="${act}" data-uid="${it.uid}" ${extra || ''}><div><div class="t">${title}</div>${meta ? `<div class="m">${meta}</div>` : ''}</div></button>`;
    WT.openSheet(() => ({
      eyebrow: 'Exercise',
      title: esc(ex.name),
      body: `<div class="opt-list">
        ${opt('openSwap', 'Replace exercise', 'Same muscle, same place in the session', 'data-ctx="active"')}
        <button class="opt" data-act="exDetail" data-id="${ex.id}"><div><div class="t">History, records and video</div></div></button>
        ${opt('pickIntensity', 'Change intensity', (WT.INTENSITY_INFO[it.intensity] || WT.INTENSITY_INFO.standard).name, 'data-ctx="active"')}
        ${opt('woNoteToggle2', 'Add a note')}
        ${idx > 0 ? opt('woMove', 'Move up', '', 'data-d="-1"') : ''}
        ${idx < a.exercises.length - 1 ? opt('woMove', 'Move down', '', 'data-d="1"') : ''}
        ${it.superset ? opt('woUnpair', 'Split superset') : ''}
        ${opt('woSkip', it.skipped ? 'Restore exercise' : 'Skip exercise')}
        ${opt('woRemove', 'Remove from session', '', '', 'danger')}
      </div>`,
    }));
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
    const a = WT.db.active;
    const L = actItem(d.uid).superset;
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
      eyebrow: 'Train',
      title: 'Rest timer',
      body: `<p class="small muted">Starts by itself when you complete a set, using that exercise’s rest. Or start one now:</p>
        <div class="row wrap mt16" style="gap:8px">${[30, 45, 60, 75, 90, 120, 150, 180, 240].map((s) => `<button class="btn btn-secondary mono" style="min-width:76px" data-act="timerPreset" data-s="${s}">${WT.fmtClock(s)}</button>`).join('')}</div>
        <div class="spec-row mt16"><div><div class="k">Sound and vibration</div><div class="d">When rest is over</div></div>${H.toggle(p.timerSound, 'toggleSound')}</div>`,
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
    WT.db.active = { id: WT.uid(), type: 'custom', title: 'Session', startedAt: new Date().toISOString(), notes: '', exercises: [] };
    WT.save(true);
    WT.rerender();
    A.openAdd({ ctx: 'active' });
  };
  A.woDiscard = () =>
    WT.confirm('Discard this session?', 'Every set logged in this session will be lost. This can’t be undone.', 'Discard', () => {
      WT.db.active = null;
      WT.save(true);
      WT.go('dashboard');
      WT.toast('Session discarded');
    }, true);

  A.woFinish = () => {
    const a = WT.db.active;
    if (!a) return;
    const done = doneSets(a), total = totalSets(a);
    let volume = 0;
    a.exercises.forEach((e) => e.sets.forEach((s) => s.done && (volume += (+s.w || 0) * (+s.r || 0))));
    WT.openSheet(() => ({
      eyebrow: 'Finish',
      title: esc(a.title),
      body: `<div class="row wrap" style="gap:32px;padding:6px 0 4px;align-items:flex-start">
          <div class="figure"><span class="v">${WT.fmtDuration((Date.now() - new Date(a.startedAt)) / 1000)}</span><span class="eyebrow">Duration</span></div>
          <div class="figure"><span class="v">${done}<small>/ ${total}</small></span><span class="eyebrow">Sets</span></div>
          <div class="figure"><span class="v">${WT.fmtNum(volume)}<small>${WT.db.profile.unit}</small></span><span class="eyebrow">Volume</span></div></div>
        ${done < total ? `<div class="callout warn mt16">${I('info', 16)}<span>${total - done} unchecked set${total - done > 1 ? 's' : ''} won’t be saved. Exercises with no completed sets are recorded as skipped.</span></div>` : ''}
        ${done === 0 ? `<div class="callout mt8">${I('info', 16)}<span>No sets completed yet — tap the check beside each set as you finish it.</span></div>` : ''}
        <div class="label mt24" style="margin-bottom:8px">Notes</div><textarea class="input" data-in="sessionNotes" placeholder="Optional">${esc(a.notes || '')}</textarea>`,
      foot: `<button class="btn btn-secondary grow" data-act="closeSheet">Keep training</button><button class="btn btn-primary grow" data-act="woSave" ${done === 0 ? 'disabled' : ''}>Save to log</button>`,
    }));
  };
  A.woSave = () => {
    const a = WT.db.active;
    a.timer = null;
    const s = WT.finishSession(JSON.parse(JSON.stringify(a)));
    s.exercises.forEach((e) => {
      delete e.showNotes;
      delete e.expanded;
    });
    delete s.timer;
    WT.db.history.push(s);
    WT.db.active = null;
    WT.ui.justSet = null;
    WT.save(true);
    WT.closeSheet(true);
    WT.go('history', s.id);
    WT.openSheet(() => ({
      eyebrow: 'Saved to your log',
      title: 'Well <em>done</em>.',
      body: `<div class="row wrap" style="gap:32px;padding:6px 0;align-items:flex-start">
          <div class="figure"><span class="v">${WT.fmtDuration(s.durationSec)}</span><span class="eyebrow">Duration</span></div>
          <div class="figure"><span class="v">${s.totals.sets}</span><span class="eyebrow">Sets</span></div>
          ${s.totals.volume ? `<div class="figure"><span class="v">${WT.fmtNum(s.totals.volume)}<small>${WT.db.profile.unit}</small></span><span class="eyebrow">Volume</span></div>` : ''}</div>
        ${s.prs.length ? `<div class="eyebrow mt32" style="margin-bottom:6px;color:var(--burn)">★ New records</div>${s.prs.map((r) => `<div class="leader"><span>${esc(WT.ex(r.exId).name)} <span class="faint">· ${r.kind}</span></span><span class="mono">${esc(r.value)}</span></div>`).join('')}` : `<p class="footnote mt24" style="font-size:16px">Today’s numbers are now your baseline — next time, each exercise suggests where to go from here.</p>`}`,
      foot: `<button class="btn btn-primary btn-block" data-act="closeSheet">Done</button>`,
    }));
  };
})();
