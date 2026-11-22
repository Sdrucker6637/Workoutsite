/* Views: Progress — overview, strength, cardio, consistency, nutrition and body composition, with insights.
 * One period filter (7 days … all time) drives every number and chart. Analytics live in analytics.js.
 * Also: quick sheets to record a run, a weigh-in, a measurement or a progress photo (used by Home too).
 */
(function () {
  const WT = globalThis.WT;
  const I = WT.icon, esc = WT.esc, H = WT.h, A = WT.A, V = WT.V, N = WT.nut;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const st = () => (WT.ui.prog = Object.assign({ ex: null, metric: 'e1rm', tab: 'overview', period: '30d' }, WT.ui.prog || {}));
  const TABS = [['overview', 'Overview'], ['strength', 'Strength'], ['cardio', 'Cardio'], ['consistency', 'Consistency'], ['nutrition', 'Nutrition'], ['body', 'Body']];
  const mi = (v) => WT.fmtNum(WT.round(v || 0, 1));
  const metric = (v, k, small) => `<div class="metric"><div class="v">${v}${small ? `<small>${small}</small>` : ''}</div><div class="k">${k}</div></div>`;
  const delta = (cur, prev, unit, invert) => {
    if (prev == null || cur == null || !(prev > 0)) return '';
    const d = cur - prev;
    if (Math.abs(d) < 1e-9) return `<span class="dl eq">same as before</span>`;
    const good = invert ? d < 0 : d > 0;
    return `<span class="dl ${good ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${WT.fmtNum(WT.round(Math.abs(d), 1))}${unit || ''} vs previous</span>`;
  };
  const empty = (title, text, cta) => `<div class="empty prog-empty"><h3>${title}</h3><p>${text}</p>${cta ? `<div class="mt16 row wrap">${cta}</div>` : ''}</div>`;
  const today = () => N.dayKey();

  /* ═════════════════════ PROGRESS ═════════════════════ */
  V.progress = function (param) {
    const s = st();
    if (param && TABS.some((t) => t[0] === param)) s.tab = param;
    const r = WT.periodRange(s.period);
    const tabs = `<div class="prog-tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" class="${k === s.tab ? 'on' : ''}" aria-selected="${k === s.tab}" data-act="progTab" data-v="${k}">${n}</button>`).join('')}</div>`;
    const periods = `<div class="seg period-seg" role="group" aria-label="Time period">${WT.PERIODS.map(([k, n]) => `<button class="${k === s.period ? 'on' : ''}" aria-pressed="${k === s.period}" data-act="progPeriod" data-v="${k}">${k === 'all' ? 'All' : n.replace(' days', 'd').replace(' months', 'm').replace(' year', 'y')}</button>`).join('')}</div>`;
    const body = { overview, strength, cardio, consistency, nutrition, bodyTab }[s.tab === 'body' ? 'bodyTab' : s.tab](r);
    return `<div class="page">
      <div class="head head-row"><div><div class="over">${esc(r.label === 'All time' ? 'All time' : 'Last ' + r.label)}</div><h1 class="large-title">Progress</h1></div>${periods}</div>
      ${tabs}
      <div class="prog-body">${body}</div>
    </div>`;
  };

  /* ───────── Overview ───────── */
  function insightsCard(key) {
    const ins = WT.insights(key);
    const icon = { up: 'trendUp', down: 'info', info: 'equal' };
    const list = ins.items.slice(0, 5).map((x) => `<li class="ins ${x.kind}"><span class="ins-i">${I(icon[x.kind], 15)}</span><div><span class="ins-a">${esc(x.area)}</span><p>${esc(x.text)}</p>${x.action ? `<p class="ins-act">${esc(x.action)}</p>` : ''}</div></li>`).join('');
    return `<section class="section"><div class="section-title"><h2>Insights</h2><span class="footnote t3">From your data · this period vs the one before</span></div>
      <div class="panel ins-card">${list ? `<ul class="ins-list">${list}</ul>` : `<p class="t2 ins-need">${I('bulb', 16)}${esc(ins.needMore)}</p>`}</div></section>`;
  }
  function overview(r) {
    const c = WT.consistency(r), sS = WT.strengthSummary(r), cs = WT.cardioSummary(r), n = WT.nutritionSummary(r), b = WT.bodySummary(r);
    const card = (tab, icon, title, inner, has) => `<button class="panel ov-card ${has ? '' : 'none'}" data-act="progTab" data-v="${tab}"><div class="ov-h">${I(icon, 16)}<span>${title}</span>${I('chevR', 15)}</div>${inner}</button>`;
    const recent = c.sessions.slice(-3).reverse();
    return `${insightsCard(r.key)}
      <section class="section"><div class="section-title"><h2>At a glance</h2></div>
      <div class="ov-grid">
        ${card('consistency', 'calendar', 'Consistency', c.count ? `<div class="ov-v tnum">${c.count}<small> workouts</small></div><div class="ov-s">${WT.fmtNum(WT.round(c.perWeek, 1))} per week · streak ${plural(c.streak, 'week')}</div>${delta(c.count, r.key === 'all' ? null : c.prevCount, '')}` : `<div class="ov-s">No workouts in this period</div>`, c.count)}
        ${card('strength', 'dumbbell', 'Strength', sS.list.length ? `<div class="ov-v tnum">${sS.up.length}<small> of ${sS.list.length} improving</small></div><div class="ov-s">Median change ${sS.median >= 0 ? '+' : ''}${WT.round(sS.median, 1)}% · ${plural(sS.prs.length, 'PR')}</div>` : `<div class="ov-s">${sS.prs.length ? plural(sS.prs.length, 'PR') + ' · ' : ''}Log an exercise twice in this period to see its trend</div>`, sS.list.length || sS.prs.length)}
        ${card('cardio', 'run', 'Cardio', cs.total.n ? `<div class="ov-v tnum">${mi(cs.total.dist)}<small> mi</small></div><div class="ov-s">${plural(cs.total.n, 'run')} · ${cs.pace ? WT.fmtPace(cs.pace) : WT.fmtDuration(cs.total.time * 60)}</div>${delta(cs.total.dist, r.key === 'all' ? null : cs.prev.dist, ' mi')}` : `<div class="ov-s">${cs.acts.length ? plural(cs.acts.length, 'cardio session') : 'No runs in this period'}</div>`, cs.total.n || cs.acts.length)}
        ${card('nutrition', 'food', 'Nutrition', n.logged ? `<div class="ov-v tnum">${WT.fmtNum(N.rcal(n.avgCal))}<small> cal / day</small></div><div class="ov-s">${N.rp(n.avgP)} g protein avg · target met ${n.proteinMet}/${n.logged} days</div>` : `<div class="ov-s">No food logged in this period</div>`, n.logged)}
        ${card('body', 'scale', 'Body', b.latest ? `<div class="ov-v tnum">${WT.fmtNum(WT.round(b.latest.v, 1))}<small> ${b.unit}</small></div><div class="ov-s">${b.change != null ? `${b.change > 0 ? '+' : ''}${WT.fmtNum(WT.round(b.change, 1))} ${b.unit} this period` : '1 weigh-in this period'}</div>` : `<div class="ov-s">${b.latestAll ? `Last: ${WT.fmtNum(WT.round(b.latestAll.v, 1))} ${b.unit} on ${WT.fmtDate(N.parseDay(b.latestAll.date), { month: 'short', day: 'numeric' })}` : 'Optional · track weight or measurements'}</div>`, b.latest)}
      </div></section>
      <section class="section"><div class="section-title"><h2>Recent training</h2>${c.count ? `<a class="btn-link footnote" href="#/history">History</a>` : ''}</div>
        ${recent.length ? `<div class="list inset">${recent.map((x) => H.li({ href: `#/history/${x.id}`, title: esc(x.title), sub: `${WT.fmtRelDay(x.startedAt)} · ${WT.fmtDuration(x.durationSec)} · ${plural((x.totals && x.totals.sets) || 0, 'set')}`, trail: (x.prs || []).length ? `<span class="badge-pr">${plural(x.prs.length, 'PR')}</span>` : '', chev: true })).join('')}</div>` : `<p class="t2">No workouts in this period. <a class="btn-link" href="#/generate">Generate one</a> or <button class="btn-link" data-act="recordRun">record a run</button>.</p>`}
      </section>`;
  }

  /* ───────── Strength (exercise tracking preserved) ───────── */
  function strength(r) {
    const s = st();
    const u = WT.db.profile.unit;
    const sum = WT.strengthSummary(r);
    const tracked = WT.trackedExercises().filter((t) => WT.trackType(t.ex) !== 'cardio');
    if (!tracked.length) return empty('No strength data yet', 'Charts appear after your first workout. Everything here comes from sets you’ve logged.', `<a class="btn btn-primary" href="#/generate">${I('sparkles', 16)}Generate workout</a>`);
    if (!s.ex || !tracked.find((t) => t.ex.id === s.ex)) s.ex = tracked[0].ex.id;
    const ex = WT.ex(s.ex);
    const hist = WT.exerciseHistory(ex.id).filter((h) => WT.inRange(h.date, r.start, r.end));
    const pr = WT.personalRecords(ex.id);
    const loaded = WT.exerciseHistory(ex.id).some((h) => h.metrics.topWeight > 0);
    let dl = '';
    if (hist.length > 1 && loaded) {
      const ch = Math.round(hist[hist.length - 1].metrics.e1rm - hist[0].metrics.e1rm);
      dl = `<span class="${ch > 0 ? 'accent' : 't3'} strong">${ch > 0 ? '+' : ''}${ch} ${u}</span> <span class="t3">since ${WT.fmtDate(hist[0].date, { month: 'short', day: 'numeric' })}</span>`;
    }
    const metricSel = H.seg(loaded ? [['e1rm', 'Est. 1RM'], ['top', 'Top weight'], ['volume', 'Volume'], ['reps', 'Reps']] : [['reps', 'Reps'], ['volume', 'Volume']], loaded ? s.metric : s.metric === 'volume' ? 'volume' : 'reps', 'progMetric', '', '');
    const rows = sum.list.slice(0, 8).map((x) => `<div class="li"><div class="grow"><div class="ti">${esc(x.ex.name)}</div><div class="su">${plural(x.sessions, 'session')} · ${x.loaded ? `${WT.fmtNum(Math.round(x.first))} → ${WT.fmtNum(Math.round(x.last))} ${u} est. 1RM` : `${Math.round(x.first)} → ${Math.round(x.last)} reps`}</div></div><span class="tnum strong ${x.pct >= 2 ? 'accent' : x.pct <= -2 ? 'neg' : 't3'}">${x.pct > 0 ? '+' : ''}${WT.round(x.pct, 1)}%</span></div>`).join('');
    const st2 = WT.stats();
    const c = WT.consistency(r);
    const weeksIn = Math.max(1, r.days / 7);
    const groupRows = Object.keys(WT.GROUPS).filter((g) => g !== 'cardio').map((g) => ({ g, perWeek: c.groups[g].sets / weeksIn, target: Object.keys(WT.MUSCLES).filter((m) => WT.MUSCLES[m].group === g).reduce((a, m) => a + WT.weeklyTarget(m), 0) }));
    const maxG = Math.max(...groupRows.map((x) => Math.max(x.perWeek, x.target)), 1);
    return `<section class="section first">
        <div class="summary">${metric(sum.list.length ? `${sum.up.length}<small>/ ${sum.list.length}</small>` : '—', 'Exercises improving')}${metric(sum.median == null ? '—' : `${sum.median >= 0 ? '+' : ''}${WT.round(sum.median, 1)}<small>%</small>`, 'Median change')}${metric(sum.prs.length, 'Personal records')}</div>
        <p class="footnote t3 mt8">Overall strength compares your first and last sessions in this period for every exercise done at least twice (est. 1RM for weighted lifts, reps for bodyweight).</p>
      </section>
      ${rows ? `<section class="section"><div class="section-title"><h2>By exercise</h2><span class="footnote t3">${sum.down.length ? `${sum.down.length} declining` : 'none declining'}</span></div><div class="list inset">${rows}</div></section>` : ''}
      <section class="section">
        <div class="section-title"><h2>Exercise detail</h2></div>
        <div class="row between wrap" style="gap:10px"><select class="pill-select" data-in="progEx" aria-label="Exercise">${tracked.map((t) => `<option value="${t.ex.id}" ${t.ex.id === ex.id ? 'selected' : ''}>${esc(t.ex.name)}</option>`).join('')}</select><span class="footnote tnum">${dl}</span></div>
        <div class="mt12">${metricSel}</div>
        <div id="progChart" class="mt12"></div>
        <div class="summary mt24">
          ${pr.heaviest ? metric(`${WT.fmtNum(pr.heaviest.w)}<small>× ${pr.heaviest.r}</small>`, 'Heaviest set') : metric(pr.reps ? pr.reps.r : '—', 'Most reps')}
          ${pr.e1rm ? metric(`${WT.fmtNum(Math.round(pr.e1rm.v))}<small>${u}</small>`, 'Best est. 1RM') : '<div></div>'}
          ${metric(`${hist.length}<small>/ ${pr.count}</small>`, 'Sessions (period / all)')}
        </div>
      </section>
      <section class="section">
        <div class="section-title"><h2>Personal records</h2><span class="footnote t3">This period</span></div>
        ${sum.prs.length ? `<div class="list inset">${sum.prs.slice(0, 8).map((x) => H.li({ href: `#/history/${x.sessionId}`, title: esc((WT.ex(x.exId) || {}).name || x.exId), sub: `${x.kind} · ${WT.fmtDate(x.date, { month: 'short', day: 'numeric' })}`, trail: `<span class="strong tnum">${esc(x.value)}</span>` })).join('')}</div>` : `<p class="t2">${st2.prs.length ? 'No new records in this period.' : 'Beat a previous best and it will be recorded here.'}</p>`}
      </section>
      <section class="section">
        <div class="section-title"><h2>Weekly sets by muscle group</h2><span class="footnote t3">Average this period</span></div>
        ${groupRows.map((x) => `<div class="bar-row"><span>${WT.GROUPS[x.g]}</span><div class="track"><i style="width:${(x.perWeek / maxG) * 100}%"></i><span class="tgt" style="left:${(x.target / maxG) * 100}%" title="Target ${x.target}"></span></div><span class="tnum t2" style="text-align:right">${WT.fmtNum(WT.round(x.perWeek, 1))} <span class="t3">/ ${x.target}</span></span></div>`).join('')}
        <p class="footnote t3 mt8">Marker shows your weekly target, higher for priority muscles.</p>
      </section>`;
  }

  /* ───────── Cardio ───────── */
  function cardio(r) {
    const cs = WT.cardioSummary(r);
    const btn = `<button class="btn btn-primary" data-act="recordRun">${I('run', 16)}Record a run</button>`;
    if (!cs.acts.length)
      return empty('No cardio in this period', cs.last ? `Your last run was ${WT.fmtRelDay(cs.last.date).toLowerCase()}. Record runs here or log them in a workout; distance and time build your pace and distance trends.` : 'Record a run with its distance and time, or log one in a cardio workout. Distance, pace and weekly totals appear here.', btn);
    const t = cs.total;
    const other = Object.entries(cs.other);
    const recent = cs.acts.slice().reverse().slice(0, 8);
    return `<section class="section first">
        <div class="summary four">${metric(mi(t.dist), 'Distance', ' mi')}${metric(t.n, plural(t.n, 'Run').replace(/^\d+ /, ''))}${metric(WT.fmtDuration(t.time * 60), 'Running time')}${metric(cs.pace ? WT.fmtRunTime(cs.pace) : '—', 'Average pace', cs.pace ? ' /mi' : '')}</div>
        <div class="row wrap mt8" style="gap:12px">${r.key === 'all' ? '' : delta(t.dist, cs.prev.dist, ' mi')}${cs.pace && cs.prevPace ? `<span class="dl ${cs.pace < cs.prevPace ? 'up' : 'down'}">pace ${cs.pace < cs.prevPace ? 'faster' : 'slower'} than previous (${WT.fmtPace(cs.prevPace)})</span>` : ''}</div>
      </section>
      ${t.n ? `<section class="section"><div class="section-title"><h2>Distance per ${cs.buckets[0] && cs.buckets[0].kind === 'month' ? 'month' : 'week'}</h2><span class="footnote t3">miles</span></div><div id="runDistChart"></div></section>` : ''}
      ${cs.runs.filter((x) => x.pace).length > 1 ? `<section class="section"><div class="section-title"><h2>Pace</h2><span class="footnote t3">min per mile · lower is faster</span></div><div id="runPaceChart"></div></section>` : ''}
      ${t.n ? `<section class="section"><div class="summary">${metric(cs.longest ? mi(cs.longest.dist) : '—', 'Longest run', ' mi')}${metric(cs.fastest ? WT.fmtRunTime(cs.fastest.pace) : '—', 'Fastest pace (1+ mi)', cs.fastest ? ' /mi' : '')}${metric(cs.avgDist ? mi(cs.avgDist) : '—', 'Average run', ' mi')}</div></section>` : ''}
      ${other.length ? `<section class="section"><div class="section-title"><h2>Other cardio</h2></div><div class="list inset">${other.map(([n, o]) => H.li({ title: esc(n), sub: `${plural(o.n, 'session')}${o.time ? ' · ' + WT.fmtDuration(o.time * 60) : ''}${o.dist ? ' · ' + mi(o.dist) + ' mi' : ''}` })).join('')}</div></section>` : ''}
      <section class="section"><div class="section-title"><h2>Recent</h2>${btn.replace('btn-primary', 'btn-secondary btn-sm')}</div>
        <div class="list inset">${recent.map((x) => H.li({ href: `#/history/${x.sessionId}`, title: esc(x.name), sub: `${WT.fmtRelDay(x.date)}${x.dist ? ' · ' + mi(x.dist) + ' mi' : ''}${x.time ? ' · ' + WT.fmtRunTime(x.time) : ''}`, trail: x.pace ? `<span class="tnum strong">${WT.fmtPace(x.pace)}</span>` : '', chev: true })).join('')}</div></section>`;
  }

  /* ───────── Consistency ───────── */
  function consistency(r) {
    const c = WT.consistency(r);
    if (!WT.sessions().length) return empty('No workouts yet', 'Finish a workout or record a run and your frequency, streaks and training calendar build from there.', `<a class="btn btn-primary" href="#/generate">${I('sparkles', 16)}Generate workout</a><button class="btn btn-secondary" data-act="recordRun">${I('run', 16)}Record a run</button>`);
    const u = WT.db.profile.unit;
    const groups = Object.entries(c.groups).filter(([g, v]) => v.sessions || g !== 'cardio');
    const maxS = Math.max(1, ...groups.map(([, v]) => v.sessions));
    return `<section class="section first">
        <div class="summary four">${metric(c.count, 'Workouts')}${metric(WT.fmtNum(WT.round(c.perWeek, 1)), 'Per week')}${metric(c.streak, `Week streak (goal ${c.goal}/wk)`)}${metric(c.longestStreak, 'Longest streak')}</div>
        <div class="mt8">${r.key === 'all' ? '' : delta(c.count, c.prevCount, '')}</div>
      </section>
      <section class="section"><div class="section-title"><h2>Workouts per week</h2></div><div id="weeksChart"></div></section>
      ${r.days >= 60 ? `<section class="section"><div class="section-title"><h2>Per month</h2></div><div id="monthsChart"></div></section>` : ''}
      <section class="section"><div class="section-title"><h2>Training volume</h2><span class="footnote t3">${WT.fmtNum(c.sets)} sets · ${c.volume >= 10000 ? WT.fmtNum(Math.round(c.volume / 1000)) + 'k' : WT.fmtNum(c.volume)} ${u}</span></div><div id="volChart"></div></section>
      <section class="section"><div class="section-title"><h2>Muscle groups trained</h2><span class="footnote t3">sessions · sets</span></div>
        ${groups.map(([g, v]) => `<div class="bar-row"><span>${WT.GROUPS[g]}</span><div class="track"><i style="width:${(v.sessions / maxS) * 100}%"></i></div><span class="tnum t2" style="text-align:right">${v.sessions} <span class="t3">· ${v.sets}</span></span></div>`).join('')}
        <p class="footnote t3 mt8">${groups.filter(([g, v]) => g !== 'cardio' && !v.sessions).map(([g]) => WT.GROUPS[g]).join(', ') ? `Not trained this period: ${groups.filter(([g, v]) => g !== 'cardio' && !v.sessions).map(([g]) => WT.GROUPS[g]).join(', ')}.` : 'Every muscle group was trained this period.'}</p>
      </section>
      <section class="section"><div class="section-title"><h2>Calendar</h2><span class="footnote t3">${Object.keys(c.days).length} training days</span></div>${heatmap(r, c.days)}</section>`;
  }
  function heatmap(r, days) {
    const weeks = Math.min(26, Math.ceil(r.days / 7) + 1);
    const end = WT.startOfDay(new Date());
    const start = WT.startOfWeek(new Date(end.getTime() - (weeks - 1) * 7 * 864e5));
    const cols = [];
    for (let w = 0; w < weeks; w++) {
      const cells = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(start.getTime() + (w * 7 + d) * 864e5);
        if (day > end) {
          cells.push('<i class="hm-c off"></i>');
          continue;
        }
        const k = N.dayKey(day);
        const n = days[k] || 0;
        const inP = day >= r.start;
        cells.push(`<i class="hm-c ${n ? 'on' : ''} ${inP ? '' : 'out'}" title="${WT.fmtDate(day, { month: 'short', day: 'numeric' })}${n ? ` · ${plural(n, 'workout')}` : ''}"></i>`);
      }
      cols.push(`<div class="hm-w">${cells.join('')}</div>`);
    }
    return `<div class="heatmap" role="img" aria-label="Training calendar">${cols.join('')}</div>`;
  }

  /* ───────── Nutrition ───────── */
  function nutrition(r) {
    const n = WT.nutritionSummary(r);
    if (!n.logged) return empty('No food logged in this period', 'Log meals in Food — even a few days gives averages for calories and protein, and how often you hit your protein target.', `<a class="btn btn-primary" href="#/food">${I('food', 16)}Log food</a>`);
    const t = n.targets;
    return `<section class="section first">
        <div class="summary four">${metric(WT.fmtNum(N.rcal(n.avgCal)), `Calories / day${t.cal ? ` · target ${WT.fmtNum(t.cal)}` : ''}`)}${metric(N.rp(n.avgP), `Protein / day · target ${t.p}`, ' g')}${metric(`${n.proteinMet}<small>/ ${n.logged}</small>`, 'Days near protein target')}${metric(`${n.logged}<small>/ ${n.total}</small>`, 'Days logged')}</div>
        <p class="footnote t3 mt8">Averages use logged days only. Carbs ${N.rg(n.avgC)} g · fat ${N.rg(n.avgF)} g per day.${n.prevLogged && r.key !== 'all' ? ` Protein the period before: ≈${N.rp(n.prevAvgP)} g.` : ''}</p>
      </section>
      <section class="section"><div class="section-title"><h2>Calories</h2><span class="footnote t3">average per ${n.weeks[0] && n.weeks[0].kind === 'month' ? 'month' : 'week'}, logged days</span></div><div id="nutCalChart"></div></section>
      <section class="section"><div class="section-title"><h2>Protein</h2></div><div id="nutPChart"></div></section>
      <p class="mt16"><a class="btn btn-secondary btn-sm" href="#/food" data-act="openFoodTrends">Daily detail in Food → Trends</a></p>`;
  }
  A.openFoodTrends = (d, el, ev) => {
    if (ev) ev.preventDefault();
    WT.ui.food = Object.assign(WT.ui.food || {}, { tab: 'trends' });
    WT.go('food');
  };

  /* ───────── Body composition ───────── */
  function bodyTab(r) {
    const b = WT.bodySummary(r);
    const actions = `<div class="row wrap" style="gap:8px"><button class="btn btn-primary btn-sm" data-act="logWeight">${I('scale', 15)}Log weight</button><button class="btn btn-secondary btn-sm" data-act="logMeasure">${I('plus', 15)}Measurement</button><button class="btn btn-secondary btn-sm" data-act="addPhoto">${I('camera', 15)}Photo</button></div>`;
    const types = Object.keys(b.measures);
    const allTypes = WT.body.types();
    const hasAny = WT.db.body.weights.length || WT.db.body.measures.length || WT.db.body.photos.length;
    if (!hasAny) return `${empty('Body tracking is optional', 'Record your weight, body fat or measurements whenever you like — nothing here is required. Trends appear once you have a few entries.', actions)}`;
    const mRows = (types.length ? types : allTypes).map((tp) => {
      const l = b.measures[tp] || [];
      const all = WT.db.body.measures.filter((m) => m.type === tp).sort((a, c) => a.date.localeCompare(c.date));
      const last = l[l.length - 1] || all[all.length - 1];
      const first = l[0];
      const ch = l.length > 1 ? last.v - first.v : null;
      return H.li({ title: WT.body.measureName(tp), sub: `${last ? WT.fmtDate(N.parseDay(last.date), { month: 'short', day: 'numeric' }) : ''}${l.length ? ` · ${plural(l.length, 'entry')} this period` : ' · none this period'}`, trail: `<span class="tnum strong">${last ? WT.fmtNum(WT.round(last.v, 1)) + ' ' + WT.body.measureUnit(tp, last.u) : '—'}</span>${ch != null ? `<span class="tnum dl ${ch < 0 ? 'neutral' : 'neutral'}" style="margin-left:8px">${ch > 0 ? '+' : ''}${WT.fmtNum(WT.round(ch, 1))}</span>` : ''}` });
    }).join('');
    const wl = WT.body.weights().slice(-6).reverse();
    return `<section class="section first">
        <div class="summary">${metric(b.latest ? WT.fmtNum(WT.round(b.latest.v, 1)) : b.latestAll ? WT.fmtNum(WT.round(b.latestAll.v, 1)) : '—', b.latest ? 'Latest weight' : 'Last weight (before this period)', ` ${b.unit}`)}${metric(b.change == null ? '—' : `${b.change > 0 ? '+' : ''}${WT.fmtNum(WT.round(b.change, 1))}`, 'Change this period', b.change == null ? '' : ` ${b.unit}`)}${metric(b.perWeek == null ? '—' : `${b.perWeek > 0 ? '+' : ''}${WT.fmtNum(WT.round(b.perWeek, 2))}`, b.perWeek == null ? 'Trend (needs 3+ over 2 weeks)' : 'Trend per week', b.perWeek == null ? '' : ` ${b.unit}`)}</div>
        <div class="mt16">${actions}</div>
      </section>
      ${b.weights.length > 1 ? `<section class="section"><div class="section-title"><h2>Weight</h2><span class="footnote t3">${plural(b.weights.length, 'weigh-in')}</span></div><div id="weightChart"></div></section>` : ''}
      ${wl.length ? `<section class="section"><div class="section-title"><h2>Recent weigh-ins</h2></div><div class="list inset">${wl.map((w) => `<div class="li"><div class="grow"><div class="ti tnum">${WT.fmtNum(WT.round(WT.body.inUnit(w), 1))} ${esc(WT.db.profile.bodyUnit || 'lb')}</div><div class="su">${WT.fmtDate(N.parseDay(w.date), { weekday: 'short', month: 'short', day: 'numeric' })}</div></div><button class="icon-btn sm" data-act="bodyDel" data-k="weights" data-id="${w.id}" aria-label="Delete weigh-in">${I('trash', 15)}</button></div>`).join('')}</div></section>` : ''}
      ${allTypes.length ? `<section class="section"><div class="section-title"><h2>Measurements</h2></div><div class="list inset">${mRows}</div></section>` : ''}
      <section class="section"><div class="section-title"><h2>Progress photos</h2><span class="footnote t3">Stored only on this device</span></div>
        ${b.photos.length ? `<div class="photo-grid">${b.photos.map((p) => `<figure class="ph" data-id="${p.id}"><button class="ph-img" data-act="photoView" data-id="${p.id}" aria-label="Photo from ${esc(p.date)}"><img alt="" data-photo="${p.id}"></button><figcaption>${WT.fmtDate(N.parseDay(p.date), { month: 'short', day: 'numeric', year: 'numeric' })}${p.note ? ' · ' + esc(p.note) : ''}</figcaption></figure>`).join('')}</div>` : `<p class="t2">${WT.db.body.photos.length ? 'No photos in this period.' : 'Add a photo now and then to compare over time. Photos never leave your device and aren’t included in backups.'}</p>`}
      </section>`;
  }

  /* ───────── Charts after render ───────── */
  V.progressAfter = function () {
    const s = st();
    const r = WT.periodRange(s.period);
    const u = WT.db.profile.unit;
    const el = (id) => document.getElementById(id);
    if (el('progChart') && s.ex) {
      const ex = WT.ex(s.ex);
      const tt = WT.trackType(ex);
      const all = WT.exerciseHistory(ex.id);
      const hist = all.filter((h) => WT.inRange(h.date, r.start, r.end));
      const loaded = all.some((h) => h.metrics.topWeight > 0);
      const m = loaded ? s.metric : s.metric === 'volume' ? 'volume' : 'reps';
      const val = (h) => (m === 'e1rm' ? Math.round(h.metrics.e1rm) : m === 'top' ? h.metrics.topWeight : m === 'volume' ? Math.round(h.metrics.volume) : h.metrics.bestReps);
      const unit = m === 'reps' ? 'reps' : u;
      if (hist.length) WT.lineChart(el('progChart'), hist.map((h) => ({ x: h.date, y: val(h), tip: `<b>${WT.fmtNum(val(h))} ${unit}</b> · ${WT.fmtDate(h.date, { month: 'short', day: 'numeric' })}<br><span class="faint">${WT.fmtSets(h.sets, tt, ex)}</span>` })), { height: 220 });
      else el('progChart').innerHTML = `<p class="footnote t3 chart-empty">No sessions of this exercise in this period. Try a longer period.</p>`;
      if (hist.length === 1) el('progChart').insertAdjacentHTML('beforeend', '<p class="footnote t3" style="text-align:center">The line starts after your next session.</p>');
    }
    const short = r.days <= 200;
    const bl = (b, i, n) => (n <= 8 || i % Math.ceil(n / 7) === 0 ? WT.bucketLabel(b) : '');
    if (el('weeksChart') || el('volChart') || el('monthsChart')) {
      const c = WT.consistency(r);
      const wk = c.weeks;
      if (el('weeksChart')) WT.barChart(el('weeksChart'), wk.map((w, i) => ({ label: bl(w, i, wk.length), value: w.count, highlight: i === wk.length - 1, tip: `<b>${plural(w.count, 'workout')}</b><br><span class="faint">Week of ${WT.fmtDate(w.start, { month: 'short', day: 'numeric' })}</span>` })), { ref: WT.db.profile.strengthPerWeek, refLabel: 'Goal', height: 200 });
      if (el('volChart')) WT.barChart(el('volChart'), wk.map((w, i) => ({ label: bl(w, i, wk.length), value: Math.round(w.volume), highlight: i === wk.length - 1, tip: `<b>${WT.fmtNum(Math.round(w.volume))} ${u}</b><br><span class="faint">${plural(w.sets, 'set')} · week of ${WT.fmtDate(w.start, { month: 'short', day: 'numeric' })}</span>` })), { height: 200 });
      if (el('monthsChart')) WT.barChart(el('monthsChart'), c.months.map((m, i) => ({ label: m.start.toLocaleDateString(undefined, { month: 'short' }), value: m.count, highlight: i === c.months.length - 1, tip: `<b>${plural(m.count, 'workout')}</b><br><span class="faint">${m.start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>` })), { height: 180 });
    }
    if (el('runDistChart') || el('runPaceChart')) {
      const cs = WT.cardioSummary(r);
      if (el('runDistChart')) WT.barChart(el('runDistChart'), cs.buckets.map((b, i) => ({ label: bl(b, i, cs.buckets.length), value: WT.round(b.dist, 1), highlight: i === cs.buckets.length - 1, tip: `<b>${mi(b.dist)} mi</b><br><span class="faint">${plural(b.n, 'run')}${b.pace ? ' · ' + WT.fmtPace(b.pace) : ''}</span>` })), { height: 190 });
      if (el('runPaceChart')) WT.lineChart(el('runPaceChart'), cs.runs.filter((x) => x.pace).map((x) => ({ x: x.date, y: WT.round(x.pace, 2), tip: `<b>${WT.fmtPace(x.pace)}</b> · ${mi(x.dist)} mi<br><span class="faint">${WT.fmtDate(x.date, { month: 'short', day: 'numeric' })}</span>` })), { height: 190, yFmt: (v) => WT.fmtRunTime(v) });
    }
    if (el('nutCalChart') || el('nutPChart')) {
      const n = WT.nutritionSummary(r);
      const src = short && r.days <= 31 ? n.days.map((d) => Object.assign({}, d, { label: N.parseDay(d.date), kind: 'day' })) : n.weeks;
      const lab = (b, i) => (b.kind === 'day' ? (src.length <= 8 ? N.parseDay(b.date).toLocaleDateString(undefined, { weekday: 'narrow' }) : i % 5 === 4 ? String(N.parseDay(b.date).getDate()) : '') : bl(b, i, src.length));
      const tip = (b, v) => `<b>${v}</b><br><span class="faint">${b.kind === 'day' ? WT.fmtDate(N.parseDay(b.date), { weekday: 'short', month: 'short', day: 'numeric' }) : `${b.logged} logged day${b.logged === 1 ? '' : 's'} · from ${WT.fmtDate(b.start, { month: 'short', day: 'numeric' })}`}</span>`;
      const ok = (b) => (b.kind === 'day' ? b.logged : b.logged > 0);
      if (el('nutCalChart')) WT.barChart(el('nutCalChart'), src.map((b, i) => ({ label: lab(b, i), value: ok(b) ? Math.round(b.cal) : 0, tip: ok(b) ? tip(b, `${WT.fmtNum(N.rcal(b.cal))} cal`) : tip(b, 'Not logged') })), { ref: n.targets.cal || 0, refLabel: 'Target', height: 180 });
      if (el('nutPChart')) WT.barChart(el('nutPChart'), src.map((b, i) => ({ label: lab(b, i), value: ok(b) ? Math.round(b.p) : 0, tip: ok(b) ? tip(b, `${N.rp(b.p)} g protein`) : tip(b, 'Not logged') })), { ref: n.targets.p, refLabel: 'Target', height: 180 });
    }
    if (el('weightChart')) {
      const b = WT.bodySummary(r);
      WT.lineChart(el('weightChart'), b.weights.map((w) => ({ x: N.parseDay(w.date), y: WT.round(w.v, 1), tip: `<b>${WT.fmtNum(WT.round(w.v, 1))} ${b.unit}</b> · ${WT.fmtDate(N.parseDay(w.date), { month: 'short', day: 'numeric' })}` })), { height: 200 });
    }
    document.querySelectorAll('img[data-photo]').forEach((img) => WT.photos.url(img.dataset.photo).then((u2) => u2 && (img.src = u2)).catch(() => {}));
  };
  WT.I.progEx = (el, ev) => {
    if (ev.type !== 'change') return;
    st().ex = el.value;
    WT.rerender();
  };
  A.progTab = (d) => {
    st().tab = d.v;
    if (WT.ui.param) return WT.go('progress');
    WT.rerender();
  };
  A.progPeriod = (d) => {
    st().period = d.v;
    WT.rerender();
  };
  A.progMetric = (d) => {
    st().metric = d.v;
    WT.rerender();
  };

  /* ═════════════════════ Quick records (Progress + Home) ═════════════════════ */
  const parseTime = (s) => {
    // "28:30", "1:05:00", "28.5" (minutes), "28" → minutes
    s = String(s || '').trim();
    if (!s) return 0;
    if (/^\d+(\.\d+)?$/.test(s)) return +s;
    const p = s.split(':').map(Number);
    if (p.some(isNaN)) return 0;
    return p.length === 3 ? p[0] * 60 + p[1] + p[2] / 60 : p[0] + p[1] / 60;
  };
  WT.parseRunTime = parseTime;
  /** Save a completed run as a workout in history (so it counts everywhere workouts do). */
  WT.saveRun = function (o) {
    const exId = WT.ex(o.exId) ? o.exId : 'outdoor-run';
    const ex = WT.ex(exId);
    const date = N.validDay(o.date) ? o.date : today();
    const start = date === today() ? new Date(Date.now() - Math.round((o.time || 0) * 60000)) : new Date(N.parseDay(date).getTime() + 8 * 36e5);
    const item = WT.sessionItem(exId);
    item.sets = [{ time: String(WT.round(o.time || 0, 2)), dist: o.dist ? String(WT.round(o.dist, 2)) : '', w: '', r: '', done: true, at: start.toISOString() }];
    item.targetSets = 1;
    const s = { id: WT.uid(), type: 'cardio', title: ex.name, startedAt: start.toISOString(), settings: null, notes: o.notes || '', exercises: [item], recorded: true };
    WT.finishSession(s);
    s.endedAt = new Date(start.getTime() + Math.round((o.time || 0) * 60000)).toISOString();
    s.durationSec = Math.round((o.time || 0) * 60);
    WT.db.history.push(s);
    WT.save(true);
    return s;
  };
  A.recordRun = () => {
    const runs = WT.exercises.filter((e) => WT.trackType(e) === 'cardio');
    const f = { date: today(), dist: '', time: '', exId: 'outdoor-run', notes: '' };
    WT.openSheet(() => {
      const t = parseTime(f.time), d = +f.dist;
      return {
        title: 'Record a run',
        body: `<div class="fstack" style="gap:14px">
          <div class="fields"><label class="fstack" style="gap:6px"><span class="label">Distance (mi)</span><input class="input tnum" id="runDist" type="number" inputmode="decimal" step="0.01" min="0" data-in="runF" data-k="dist" value="${esc(f.dist)}" placeholder="3.1"></label>
            <label class="fstack" style="gap:6px"><span class="label">Time (h:mm:ss or minutes)</span><input class="input tnum" type="text" inputmode="numeric" data-in="runF" data-k="time" value="${esc(f.time)}" placeholder="28:30"></label></div>
          <div class="fields"><label class="fstack" style="gap:6px"><span class="label">Activity</span><select class="input" data-in="runF" data-k="exId">${runs.map((e) => `<option value="${e.id}" ${e.id === f.exId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
            <label class="fstack" style="gap:6px"><span class="label">Date</span><input class="input" type="date" data-in="runF" data-k="date" value="${f.date}" max="${today()}"></label></div>
          <label class="fstack" style="gap:6px"><span class="label">Notes (optional)</span><input class="input" data-in="runF" data-k="notes" value="${esc(f.notes)}" placeholder="Easy, hilly, intervals…"></label>
          <p class="footnote t2 tnum" id="runPace">${d > 0 && t > 0 ? `Pace ${WT.fmtPace(t / d)}` : 'Enter distance and time to see your pace.'}</p>
        </div>`,
        foot: `<span class="grow"></span><button class="btn btn-secondary" data-act="closeSheet">Cancel</button><button class="btn btn-primary" data-act="runSave">Save run</button>`,
        after: (sh) => {
          const i = sh.querySelector('#runDist');
          if (i && !i.dataset.f) {
            i.dataset.f = 1;
            i.focus();
          }
        },
      };
    });
    WT.I.runF = (el) => {
      f[el.dataset.k] = el.value;
      const p = document.getElementById('runPace');
      const t = parseTime(f.time), d = +f.dist;
      if (p) p.textContent = d > 0 && t > 0 ? `Pace ${WT.fmtPace(t / d)}` : 'Enter distance and time to see your pace.';
    };
    A.runSave = () => {
      const t = parseTime(f.time), d = +f.dist;
      if (!(t > 0) && !(d > 0)) return WT.toast('Enter a distance or a time', 'error');
      if (d < 0 || d > 200) return WT.toast('Check the distance', 'error');
      WT.saveRun({ date: f.date, dist: d > 0 ? d : 0, time: t, exId: f.exId, notes: f.notes });
      WT.closeSheet();
      WT.rerender();
      WT.toast(`Run saved${d > 0 ? ` · ${mi(d)} mi` : ''}${d > 0 && t > 0 ? ` · ${WT.fmtPace(t / d)}` : ''}`, 'good');
    };
  };

  A.logWeight = () => {
    const unit = WT.db.profile.bodyUnit || 'lb';
    const last = WT.body.weights().pop();
    const f = { date: today(), v: '', bf: '' };
    WT.openSheet(() => ({
      title: 'Log weight',
      body: `<div class="fstack" style="gap:14px">
        <div class="fields"><label class="fstack" style="gap:6px"><span class="label">Weight (${unit})</span><input class="input tnum" id="wtIn" type="number" inputmode="decimal" step="0.1" min="0" data-in="wtF" data-k="v" value="${esc(f.v)}" placeholder="${last ? WT.fmtNum(WT.round(WT.body.inUnit(last), 1)) : ''}"></label>
          <label class="fstack" style="gap:6px"><span class="label">Date</span><input class="input" type="date" data-in="wtF" data-k="date" value="${f.date}" max="${today()}"></label></div>
        <label class="fstack" style="gap:6px"><span class="label">Body fat % (optional)</span><input class="input tnum" type="number" inputmode="decimal" step="0.1" min="0" max="70" data-in="wtF" data-k="bf" value="${esc(f.bf)}"></label>
        <div class="row between"><span class="footnote t3">${last ? `Last: ${WT.fmtNum(WT.round(WT.body.inUnit(last), 1))} ${unit} on ${WT.fmtDate(N.parseDay(last.date), { month: 'short', day: 'numeric' })}` : 'Weigh in at a similar time of day for the most consistent trend.'}</span>${H.seg([['lb', 'lb'], ['kg', 'kg']], unit, 'wtUnit', '', '')}</div>
      </div>`,
      foot: `<span class="grow"></span><button class="btn btn-secondary" data-act="closeSheet">Cancel</button><button class="btn btn-primary" data-act="wtSave">Save</button>`,
      after: (sh) => {
        const i = sh.querySelector('#wtIn');
        if (i && !i.dataset.f) {
          i.dataset.f = 1;
          i.focus();
        }
      },
    }));
    WT.I.wtF = (el) => (f[el.dataset.k] = el.value);
    A.wtUnit = (d) => {
      WT.db.profile.bodyUnit = d.v;
      WT.save();
      WT.closeSheet();
      A.logWeight();
    };
    A.wtSave = () => {
      const v = parseFloat(f.v);
      if (!(v > 0) || v > 1000) return WT.toast('Enter your weight', 'error');
      WT.body.addWeight(f.date, v);
      const bf = parseFloat(f.bf);
      if (bf > 0 && bf < 70) WT.body.addMeasure(f.date, 'bodyfat', bf);
      WT.closeSheet();
      WT.rerender();
      WT.toast(`Weight saved · ${WT.fmtNum(v)} ${WT.db.profile.bodyUnit || 'lb'}`, 'good');
    };
  };

  A.logMeasure = () => {
    const unit = WT.db.profile.lengthUnit || 'in';
    const f = { date: today(), type: 'waist', custom: '', v: '' };
    WT.openSheet(() => ({
      title: 'Add a measurement',
      body: `<div class="fstack" style="gap:14px">
        <label class="fstack" style="gap:6px"><span class="label">What</span><select class="input" data-in="msF" data-k="type">${Object.entries(WT.body.MEASURES).map(([k, m]) => `<option value="${k}" ${k === f.type ? 'selected' : ''}>${m.name}</option>`).join('')}${WT.body.types().filter((t) => !WT.body.MEASURES[t]).map((t) => `<option value="${esc(t)}" ${t === f.type ? 'selected' : ''}>${esc(WT.cap(t))}</option>`).join('')}<option value="__custom" ${f.type === '__custom' ? 'selected' : ''}>Other…</option></select></label>
        ${f.type === '__custom' ? `<label class="fstack" style="gap:6px"><span class="label">Name</span><input class="input" data-in="msF" data-k="custom" value="${esc(f.custom)}" placeholder="e.g. Calf"></label>` : ''}
        <div class="fields"><label class="fstack" style="gap:6px"><span class="label">Value (${f.type === 'bodyfat' ? '%' : unit})</span><input class="input tnum" type="number" inputmode="decimal" step="0.1" min="0" data-in="msF" data-k="v" value="${esc(f.v)}"></label>
          <label class="fstack" style="gap:6px"><span class="label">Date</span><input class="input" type="date" data-in="msF" data-k="date" value="${f.date}" max="${today()}"></label></div>
        ${f.type === 'bodyfat' ? '' : `<div class="row between"><span class="footnote t3">Unit</span>${H.seg([['in', 'in'], ['cm', 'cm']], unit, 'msUnit', '', '')}</div>`}
      </div>`,
      foot: `<span class="grow"></span><button class="btn btn-secondary" data-act="closeSheet">Cancel</button><button class="btn btn-primary" data-act="msSave">Save</button>`,
    }));
    WT.I.msF = (el, ev) => {
      f[el.dataset.k] = el.value;
      if (el.dataset.k === 'type' && ev.type === 'change') WT.refreshSheet();
    };
    A.msUnit = (d) => {
      WT.db.profile.lengthUnit = d.v;
      WT.save();
      WT.refreshSheet();
    };
    A.msSave = () => {
      const type = f.type === '__custom' ? String(f.custom).trim().toLowerCase() : f.type;
      if (!type) return WT.toast('Name the measurement', 'error');
      const v = parseFloat(f.v);
      if (!(v > 0)) return WT.toast('Enter a value', 'error');
      WT.body.addMeasure(f.date, type, v);
      WT.closeSheet();
      WT.rerender();
      WT.toast(`${WT.body.measureName(type)} saved`, 'good');
    };
  };
  A.bodyDel = (d) =>
    WT.confirm('Delete entry?', 'This removes it from your body tracking.', 'Delete', () => {
      WT.body.remove(d.k, d.id);
      WT.rerender();
    }, true);

  /* ───────── Progress photos: images in IndexedDB (they'd overflow localStorage), metadata in the store ───────── */
  const DBN = 'forge-photos';
  const idb = () =>
    new Promise((res, rej) => {
      if (!globalThis.indexedDB) return rej(new Error('Photos need IndexedDB'));
      const r = indexedDB.open(DBN, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('photos');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  const tx = (mode, fn) => idb().then((db) => new Promise((res, rej) => {
    const t = db.transaction('photos', mode);
    const req = fn(t.objectStore('photos'));
    t.oncomplete = () => res(req && req.result);
    t.onerror = () => rej(t.error);
  }));
  const urls = {};
  WT.photos = {
    put: (id, blob) => tx('readwrite', (s) => s.put(blob, id)),
    get: (id) => tx('readonly', (s) => s.get(id)),
    del: (id) => tx('readwrite', (s) => s.delete(id)),
    url: (id) => (urls[id] ? Promise.resolve(urls[id]) : WT.photos.get(id).then((b) => (b ? (urls[id] = URL.createObjectURL(b)) : null))),
  };
  /** Downscale to at most 1280 px on the long side, JPEG ~0.85 — plenty for comparisons, small on disk. */
  function shrink(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      const u = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 1280 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        c.toBlob((b) => (b ? res(b) : rej(new Error('Could not process the image'))), 'image/jpeg', 0.85);
      };
      img.onerror = () => rej(new Error('That file isn’t an image'));
      img.src = u;
    });
  }
  A.addPhoto = () => {
    const f = { date: today(), note: '' };
    WT.openSheet(() => ({
      title: 'Add a progress photo',
      body: `<div class="fstack" style="gap:14px">
        <label class="btn btn-secondary photo-pick">${I('camera', 16)}Choose photo<input type="file" accept="image/*" id="photoFile" hidden></label>
        <div class="fields"><label class="fstack" style="gap:6px"><span class="label">Date</span><input class="input" type="date" data-in="phF" data-k="date" value="${f.date}" max="${today()}"></label>
          <label class="fstack" style="gap:6px"><span class="label">Note (optional)</span><input class="input" data-in="phF" data-k="note" value="${esc(f.note)}" placeholder="Front, relaxed"></label></div>
        <p class="footnote t3">Photos are stored only in this browser on this device. They aren’t uploaded anywhere and aren’t included in exported backups.</p>
      </div>`,
      foot: `<span class="grow"></span><button class="btn btn-secondary" data-act="closeSheet">Cancel</button>`,
      after: (sh) => {
        const inp = sh.querySelector('#photoFile');
        if (!inp || inp.dataset.w) return;
        inp.dataset.w = 1;
        inp.addEventListener('change', async () => {
          const file = inp.files && inp.files[0];
          if (!file) return;
          try {
            const blob = await shrink(file);
            const id = WT.uid();
            await WT.photos.put(id, blob);
            WT.db.body.photos.push({ id, date: N.validDay(f.date) ? f.date : today(), note: String(f.note || '').trim(), at: new Date().toISOString() });
            WT.save(true);
            WT.closeSheet();
            WT.rerender();
            WT.toast('Photo saved on this device', 'good');
          } catch (e) {
            WT.toast(e.message || 'Could not save the photo', 'error');
          }
        });
      },
    }));
    WT.I.phF = (el) => (f[el.dataset.k] = el.value);
  };
  A.photoView = (d) => {
    const p = WT.db.body.photos.find((x) => x.id === d.id);
    if (!p) return;
    WT.openSheet(() => ({
      eyebrow: WT.fmtDate(N.parseDay(p.date), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      title: p.note ? esc(p.note) : 'Progress photo',
      body: `<img class="ph-full" alt="Progress photo" data-photo="${p.id}">`,
      foot: `<button class="btn btn-plain btn-sm" style="color:var(--danger)" data-act="photoDel" data-id="${p.id}">Delete</button><span class="grow"></span><button class="btn btn-secondary" data-act="closeSheet">Close</button>`,
      after: (sh) => {
        const img = sh.querySelector('img[data-photo]');
        WT.photos.url(p.id).then((u) => u && (img.src = u)).catch(() => {});
      },
    }), { wide: true });
  };
  A.photoDel = (d) =>
    WT.confirm('Delete photo?', 'It will be removed from this device.', 'Delete', () => {
      WT.db.body.photos = WT.db.body.photos.filter((x) => x.id !== d.id);
      WT.save(true);
      WT.photos.del(d.id).catch(() => {});
      WT.closeSheet(true);
      WT.rerender();
    }, true);
})();
