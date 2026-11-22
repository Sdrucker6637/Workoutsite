/* Analytics: period filters, strength / cardio / consistency / nutrition / body summaries, and insights.
 * Pure logic over WT.db — no DOM. Everything is computed from what you logged; nothing is invented.
 *
 * Insight rules are deterministic. Each one states its minimum data (see MIN below), compares a period
 * with the equal-length period before it, and says nothing when the data can't support a claim.
 */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const DAY = 864e5;

  /* ───────── Periods ───────── */
  WT.PERIODS = [
    ['7d', '7 days', 7], ['30d', '30 days', 30], ['90d', '90 days', 90], ['6m', '6 months', 182], ['1y', '1 year', 365], ['all', 'All time', null],
  ];
  /** First date anything was tracked (workouts, food, body), or null. */
  WT.firstTracked = function () {
    const d = [];
    (WT.db.history || []).forEach((s) => d.push(new Date(s.startedAt).getTime()));
    ((WT.db.nutrition && WT.db.nutrition.entries) || []).forEach((e) => d.push(WT.nut.parseDay(e.date).getTime()));
    const b = WT.db.body || {};
    ['weights', 'measures'].forEach((k) => (b[k] || []).forEach((x) => d.push(WT.nut.parseDay(x.date).getTime())));
    const v = d.filter((x) => !isNaN(x));
    return v.length ? new Date(Math.min(...v)) : null;
  };
  /** { key, label, start, end, days, prevStart, prevEnd } — end is the end of today; start is inclusive. */
  WT.periodRange = function (key, now) {
    now = now ? new Date(now) : new Date();
    const p = WT.PERIODS.find((x) => x[0] === key) || WT.PERIODS[1];
    const end = new Date(WT.startOfDay(now).getTime() + DAY);
    let days = p[2];
    if (days == null) {
      const first = WT.firstTracked();
      days = first ? Math.max(7, Math.ceil((end - WT.startOfDay(first)) / DAY)) : 30;
    }
    const start = new Date(end.getTime() - days * DAY);
    return { key: p[0], label: p[1], start, end, days, prevStart: new Date(start.getTime() - days * DAY), prevEnd: start };
  };
  const inR = (d, a, b) => {
    const t = new Date(d).getTime();
    return t >= a.getTime() && t < b.getTime();
  };
  WT.inRange = inR;
  /** Week buckets (Monday start) covering a range: [{ start, end }]. */
  WT.weekBuckets = function (start, end) {
    const out = [];
    let w = WT.startOfWeek(start);
    while (w < end) {
      const e = new Date(w.getTime());
      e.setDate(e.getDate() + 7);
      out.push({ start: new Date(w), end: e });
      w = e;
    }
    return out;
  };
  /** Month buckets covering a range. */
  WT.monthBuckets = function (start, end) {
    const out = [];
    let m = new Date(start.getFullYear(), start.getMonth(), 1);
    while (m < end) {
      const e = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      out.push({ start: m, end: e });
      m = e;
    }
    return out;
  };
  /** Weekly buckets for short/medium periods, monthly beyond ~6 months. */
  WT.buckets = (r) => (r.days > 200 ? WT.monthBuckets(r.start, r.end).map((b) => Object.assign(b, { kind: 'month' })) : WT.weekBuckets(r.start, r.end).map((b) => Object.assign(b, { kind: 'week' })));
  WT.bucketLabel = (b) => (b.kind === 'month' ? b.start.toLocaleDateString(undefined, { month: 'short' }) : WT.fmtDate(b.start, { month: 'short', day: 'numeric' }));

  /* ───────── Workouts ───────── */
  const doneSets = (e) => (e.skipped ? [] : (e.sets || []).filter((x) => x.done));
  WT.sessionsIn = (a, b) => WT.sessions().filter((s) => inR(s.startedAt, a, b));
  const isCardioEx = (ex) => ex && WT.trackType(ex) === 'cardio';
  const isRun = (ex) => ex && (ex.tags || []).includes('run');
  /** A session counts as a workout if any set was completed. Cardio-only sessions count as workouts too. */
  const isWorkout = (s) => s.exercises.some((e) => doneSets(e).length);

  WT.consistency = function (r) {
    const ss = WT.sessionsIn(r.start, r.end).filter(isWorkout);
    const prev = WT.sessionsIn(r.prevStart, r.prevEnd).filter(isWorkout);
    const weeks = WT.weekBuckets(r.start, r.end).map((w) => {
      const inW = ss.filter((s) => inR(s.startedAt, w.start, w.end));
      return Object.assign(w, {
        count: inW.length,
        strength: inW.filter((s) => s.exercises.some((e) => doneSets(e).length && !isCardioEx(WT.ex(e.exId)))).length,
        sets: inW.reduce((a, s) => a + s.exercises.reduce((b, e) => b + doneSets(e).length, 0), 0),
        volume: inW.reduce((a, s) => a + s.exercises.reduce((b, e) => b + doneSets(e).reduce((c, x) => c + WT.setVolume(x), 0), 0), 0),
      });
    });
    const months = WT.monthBuckets(r.start, r.end).map((m) => Object.assign(m, { count: ss.filter((s) => inR(s.startedAt, m.start, m.end)).length }));
    // Muscle-group frequency: sessions and sets that trained each group (primary muscle)
    const groups = {};
    Object.keys(WT.GROUPS).forEach((g) => (groups[g] = { sessions: 0, sets: 0, last: null }));
    ss.forEach((s) => {
      const hit = new Set();
      s.exercises.forEach((e) => {
        const ex = WT.ex(e.exId);
        const n = doneSets(e).length;
        if (!ex || !n) return;
        const g = (WT.MUSCLES[ex.primary] || {}).group;
        if (!g) return;
        groups[g].sets += n;
        hit.add(g);
        groups[g].last = s.startedAt;
      });
      hit.forEach((g) => groups[g].sessions++);
    });
    // Streaks: weeks in a row meeting the weekly strength goal (this week counts once it's met)
    const goal = Math.max(1, +WT.db.profile.strengthPerWeek || 3);
    const all = WT.sessions().filter(isWorkout);
    let current = 0, longest = 0, run = 0;
    if (all.length) {
      const allWeeks = WT.weekBuckets(new Date(all[0].startedAt), new Date(WT.startOfDay(new Date()).getTime() + DAY));
      const met = allWeeks.map((w) => all.filter((s) => inR(s.startedAt, w.start, w.end) && s.exercises.some((e) => doneSets(e).length && !isCardioEx(WT.ex(e.exId)))).length >= goal);
      met.forEach((m) => {
        run = m ? run + 1 : 0;
        longest = Math.max(longest, run);
      });
      for (let i = met.length - 1; i >= 0; i--) {
        if (met[i]) current++;
        else if (i === met.length - 1) continue; // this week isn't over yet
        else break;
      }
    }
    const days = {};
    ss.forEach((s) => {
      const k = WT.nut.dayKey(s.startedAt);
      days[k] = (days[k] || 0) + 1;
    });
    const fullWeeks = Math.max(1, r.days / 7);
    return {
      count: ss.length, prevCount: prev.length, perWeek: ss.length / fullWeeks, weeks, months, groups, streak: current, longestStreak: longest, goal, days,
      sets: weeks.reduce((a, w) => a + w.sets, 0), volume: weeks.reduce((a, w) => a + w.volume, 0), sessions: ss,
    };
  };

  /* ───────── Strength ───────── */
  /** Per-exercise change across the period. Uses est. 1RM for loaded lifts and best reps for bodyweight work.
   * Compares the mean of the first two sessions with the mean of the last two (one each if only 2–3). */
  WT.strengthSummary = function (r) {
    const list = [];
    WT.trackedExercises().forEach(({ ex }) => {
      if (isCardioEx(ex) || WT.trackType(ex) === 'time') return;
      const h = WT.exerciseHistory(ex.id).filter((x) => inR(x.date, r.start, r.end));
      if (h.length < 2) return;
      const loaded = h.some((x) => x.metrics.topWeight > 0);
      const val = (x) => (loaded ? x.metrics.e1rm : x.metrics.bestReps);
      const k = h.length >= 4 ? 2 : 1;
      const first = h.slice(0, k).reduce((a, x) => a + val(x), 0) / k;
      const last = h.slice(-k).reduce((a, x) => a + val(x), 0) / k;
      if (!(first > 0)) return;
      list.push({ ex, region: WT.region(ex), loaded, first, last, pct: ((last - first) / first) * 100, sessions: h.length, from: h[0].date, to: h[h.length - 1].date });
    });
    const up = list.filter((x) => x.pct >= 2), down = list.filter((x) => x.pct <= -2);
    const med = (a) => {
      if (!a.length) return null;
      const s = a.map((x) => x.pct).sort((x, y) => x - y);
      return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    };
    const byRegion = {};
    ['upper', 'lower', 'core'].forEach((g) => {
      const l = list.filter((x) => x.region === g);
      byRegion[g] = { n: l.length, up: l.filter((x) => x.pct >= 2).length, down: l.filter((x) => x.pct <= -2).length, median: med(l) };
    });
    const prs = [];
    WT.sessionsIn(r.start, r.end).forEach((s) => (s.prs || []).forEach((p) => prs.push(Object.assign({ date: s.startedAt, sessionId: s.id }, p))));
    return { list: list.sort((a, b) => b.pct - a.pct), up, down, median: med(list), byRegion, prs: prs.reverse() };
  };

  /* ───────── Cardio ───────── */
  /** Cardio activities in a range: one row per cardio exercise logged in a session. Distance in miles, time in minutes. */
  WT.cardioIn = function (a, b) {
    const out = [];
    WT.sessionsIn(a, b).forEach((s) =>
      s.exercises.forEach((e) => {
        const ex = WT.ex(e.exId);
        if (!isCardioEx(ex)) return;
        const sets = doneSets(e);
        if (!sets.length) return;
        const dist = sets.reduce((x, y) => x + (+y.dist || 0), 0);
        const time = sets.reduce((x, y) => x + (+y.time || 0), 0);
        out.push({ date: s.startedAt, sessionId: s.id, exId: ex.id, name: ex.name, run: isRun(ex), dist, time, pace: dist > 0 && time > 0 ? time / dist : null });
      })
    );
    return out;
  };
  WT.cardioSummary = function (r) {
    const acts = WT.cardioIn(r.start, r.end);
    const prevActs = WT.cardioIn(r.prevStart, r.prevEnd);
    const runs = acts.filter((x) => x.run), prevRuns = prevActs.filter((x) => x.run);
    const tot = (l) => ({ n: l.length, dist: l.reduce((a, x) => a + x.dist, 0), time: l.reduce((a, x) => a + x.time, 0) });
    const paceOf = (l) => {
      const p = l.filter((x) => x.pace);
      const d = p.reduce((a, x) => a + x.dist, 0), t = p.reduce((a, x) => a + x.time, 0);
      return d > 0 ? t / d : null;
    };
    const buckets = WT.buckets(r).map((b) => {
      const l = runs.filter((x) => inR(x.date, b.start, b.end));
      return Object.assign(b, tot(l), { pace: paceOf(l) });
    });
    const other = {};
    acts.filter((x) => !x.run).forEach((x) => {
      const o = (other[x.name] = other[x.name] || { n: 0, time: 0, dist: 0 });
      o.n++;
      o.time += x.time;
      o.dist += x.dist;
    });
    const t = tot(runs), pt = tot(prevRuns);
    return {
      runs, prevRuns, acts, other, buckets, total: t, prev: pt, pace: paceOf(runs), prevPace: paceOf(prevRuns),
      avgDist: t.n ? t.dist / t.n : null, prevAvgDist: pt.n ? pt.dist / pt.n : null, longest: runs.reduce((a, x) => (!a || x.dist > a.dist ? x : a), null),
      fastest: runs.filter((x) => x.pace && x.dist >= 1).reduce((a, x) => (!a || x.pace < a.pace ? x : a), null), last: WT.cardioIn(new Date(0), new Date(Date.now() + DAY)).filter((x) => x.run).pop() || null,
    };
  };
  /** Pace as m:ss per mile. */
  WT.fmtPace = (minPerMi) => (minPerMi > 0 ? `${WT.fmtRunTime(minPerMi)} /mi` : '—');

  /* ───────── Nutrition ───────── */
  WT.nutritionSummary = function (r) {
    const N = WT.nut;
    const t = N.targets();
    const days = [];
    for (let d = new Date(r.start); d < r.end; d = new Date(d.getTime() + DAY)) {
      const k = N.dayKey(d);
      const x = N.dayTotals(k);
      days.push({ date: k, p: x.p, cal: x.cal, c: x.c, f: x.f, n: x.n, logged: x.n > 0 });
    }
    const logged = days.filter((d) => d.logged);
    const avg = (k) => (logged.length ? logged.reduce((a, d) => a + d[k], 0) / logged.length : null);
    const lo = N.band(t.p).lo;
    const weeks = WT.buckets(r).map((b) => {
      const l = logged.filter((d) => inR(N.parseDay(d.date), b.start, b.end));
      const a = (k) => (l.length ? l.reduce((s, d) => s + d[k], 0) / l.length : null);
      return Object.assign(b, { logged: l.length, cal: a('cal'), p: a('p') });
    });
    const prevDays = [];
    for (let d = new Date(r.prevStart); d < r.prevEnd; d = new Date(d.getTime() + DAY)) {
      const x = N.dayTotals(N.dayKey(d));
      if (x.n) prevDays.push(x);
    }
    return {
      days, logged: logged.length, total: days.length, avgCal: avg('cal'), avgP: avg('p'), avgC: avg('c'), avgF: avg('f'), targets: t,
      proteinMet: logged.filter((d) => d.p >= lo).length, proteinLo: lo, weeks,
      calOnTarget: t.cal ? logged.filter((d) => Math.abs(d.cal - t.cal) <= t.cal * 0.1).length : null,
      prevAvgP: prevDays.length ? prevDays.reduce((a, d) => a + d.p, 0) / prevDays.length : null, prevLogged: prevDays.length,
    };
  };

  /* ───────── Body composition ───────── */
  const B = () => (WT.db.body = WT.db.body || { weights: [], measures: [], photos: [] });
  WT.body = {
    MEASURES: { bodyfat: { name: 'Body fat', unit: '%' }, waist: { name: 'Waist' }, chest: { name: 'Chest' }, arm: { name: 'Arm' }, hips: { name: 'Hips' }, thigh: { name: 'Thigh' }, neck: { name: 'Neck' } },
    measureName: (t) => (WT.body.MEASURES[t] ? WT.body.MEASURES[t].name : WT.cap(String(t))),
    measureUnit: (t, u) => (t === 'bodyfat' ? '%' : u || WT.db.profile.lengthUnit || 'in'),
    weights: () => B().weights.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.at).localeCompare(String(b.at))),
    /** One weigh-in per day: a second entry on the same day replaces the first. */
    addWeight(date, v, u) {
      v = +v;
      if (!(v > 0) || !WT.nut.validDay(date)) return null;
      const unit = u || WT.db.profile.bodyUnit || 'lb';
      const ex = B().weights.find((x) => x.date === date);
      if (ex) Object.assign(ex, { v, u: unit, at: new Date().toISOString() });
      else B().weights.push({ id: WT.uid(), date, v, u: unit, at: new Date().toISOString() });
      WT.save();
      return ex || B().weights[B().weights.length - 1];
    },
    addMeasure(date, type, v, u) {
      v = +v;
      type = String(type || '').trim().toLowerCase();
      if (!(v > 0) || !type || !WT.nut.validDay(date)) return null;
      const unit = type === 'bodyfat' ? '%' : u || WT.db.profile.lengthUnit || 'in';
      const ex = B().measures.find((x) => x.date === date && x.type === type);
      if (ex) Object.assign(ex, { v, u: unit });
      else B().measures.push({ id: WT.uid(), date, type, v, u: unit, at: new Date().toISOString() });
      WT.save();
      return ex || B().measures[B().measures.length - 1];
    },
    remove(kind, id) {
      B()[kind] = B()[kind].filter((x) => x.id !== id);
      WT.save();
    },
    /** Weight converted to the display unit. */
    inUnit(x, unit) {
      unit = unit || WT.db.profile.bodyUnit || 'lb';
      if (!x.u || x.u === unit) return x.v;
      return unit === 'kg' ? x.v * 0.45359237 : x.v / 0.45359237;
    },
    types: () => [...new Set(B().measures.map((m) => m.type))],
  };
  /** Least-squares slope of [{t (ms), v}] per day. */
  function slope(pts) {
    if (pts.length < 2) return null;
    const n = pts.length;
    const mx = pts.reduce((a, p) => a + p.t, 0) / n, my = pts.reduce((a, p) => a + p.v, 0) / n;
    let num = 0, den = 0;
    pts.forEach((p) => {
      num += (p.t - mx) * (p.v - my);
      den += (p.t - mx) ** 2;
    });
    return den ? (num / den) * DAY : null;
  }
  WT.slope = slope;
  WT.bodySummary = function (r) {
    const unit = WT.db.profile.bodyUnit || 'lb';
    const ws = WT.body.weights().filter((x) => inR(WT.nut.parseDay(x.date), r.start, r.end)).map((x) => ({ date: x.date, v: WT.body.inUnit(x, unit), id: x.id }));
    const pts = ws.map((x) => ({ t: WT.nut.parseDay(x.date).getTime(), v: x.v }));
    const span = pts.length > 1 ? (pts[pts.length - 1].t - pts[0].t) / DAY : 0;
    const measures = {};
    B().measures.filter((m) => inR(WT.nut.parseDay(m.date), r.start, r.end)).sort((a, b) => a.date.localeCompare(b.date)).forEach((m) => {
      (measures[m.type] = measures[m.type] || []).push(m);
    });
    const latestAll = WT.body.weights().pop() || null;
    return {
      unit, weights: ws, latest: ws[ws.length - 1] || null, first: ws[0] || null, change: ws.length > 1 ? ws[ws.length - 1].v - ws[0].v : null,
      perWeek: pts.length >= 3 && span >= 14 ? slope(pts) * 7 : null, span, measures, photos: B().photos.filter((p) => inR(WT.nut.parseDay(p.date), r.start, r.end)).sort((a, b) => b.date.localeCompare(a.date)),
      latestAll: latestAll ? { date: latestAll.date, v: WT.body.inUnit(latestAll, unit) } : null,
    };
  };

  /* ───────── Insights ───────── */
  const MIN = { strengthExercises: 2, runsEach: 2, proteinDays: 5, weighIns: 3, weighSpan: 14, groupPrevSets: 6 };
  WT.INSIGHT_RULES = MIN;
  const pctTxt = (v) => `${v > 0 ? '+' : ''}${Math.round(v)}%`;
  const periodWords = (r) => (r.days === 7 ? 'week' : r.days === 30 ? 'month' : r.days === 90 ? '3 months' : r.days === 182 ? '6 months' : r.days === 365 ? 'year' : `${r.days} days`);
  /**
   * → { items: [{ kind: 'up'|'down'|'info', area, text, action }], needMore: string|null }
   * Up = progress, down = something worth attention, info = neutral trend.
   */
  WT.insights = function (key, now) {
    const r = WT.periodRange(key || '30d', now);
    const items = [];
    const first = WT.firstTracked();
    const coversPrev = first && first <= r.prevStart;
    const pw = periodWords(r);

    // 1. Workout consistency: this period vs the one before
    const c = WT.consistency(r);
    if (coversPrev && (c.count || c.prevCount) && r.days >= 14) {
      const diff = c.count - c.prevCount;
      if (diff > 0 && c.prevCount >= 1) items.push({ kind: 'up', area: 'Consistency', text: `You completed ${c.count} workout${c.count === 1 ? '' : 's'} in the last ${pw}, compared with ${c.prevCount} the ${pw} before.`, action: '' });
      else if (diff < 0 && (c.prevCount - c.count) / c.prevCount >= 0.25) items.push({ kind: 'down', area: 'Consistency', text: `You completed ${c.count} workout${c.count === 1 ? '' : 's'} in the last ${pw}, down from ${c.prevCount} the ${pw} before.`, action: `Scheduling your ${c.goal} weekly sessions on fixed days usually helps them stick.` });
    }
    if (c.streak >= 3) items.push({ kind: 'up', area: 'Consistency', text: `You’ve met your goal of ${c.goal} strength sessions a week for ${c.streak} weeks in a row.`, action: '' });

    // 2. Muscle-group balance: a group trained much less than in the previous period
    if (coversPrev && r.days >= 14) {
      const prevC = WT.consistency({ start: r.prevStart, end: r.prevEnd, prevStart: r.prevStart, prevEnd: r.prevStart, days: r.days });
      const names = { legs: 'lower-body', back: 'back', chest: 'chest', shoulders: 'shoulder', arms: 'arm', core: 'core' };
      const drops = Object.keys(names).filter((g) => prevC.groups[g].sets >= MIN.groupPrevSets && c.groups[g].sets <= prevC.groups[g].sets * 0.6);
      drops.slice(0, 2).forEach((g) => {
        const consistencyUp = c.count > c.prevCount;
        items.push({
          kind: 'down', area: 'Balance',
          text: `${consistencyUp ? 'Your workout consistency has improved, but your ' : 'Your '}${names[g]} training has decreased: ${c.groups[g].sets} sets in the last ${pw} vs ${prevC.groups[g].sets} before.`,
          action: g === 'legs' ? 'Add a squat or lunge pattern to your next full-body session, or pick Legs in the generator.' : `Prioritize ${WT.GROUPS[g].toLowerCase()} in your next session (Settings → priority muscles).`,
        });
      });
    }

    // 3. Strength: improvements or declines across several exercises in the same region
    const s = WT.strengthSummary(r);
    const RN = { upper: 'upper-body', lower: 'lower-body', core: 'core' };
    Object.entries(s.byRegion).forEach(([g, v]) => {
      if (v.up >= MIN.strengthExercises && v.up > v.down) items.push({ kind: 'up', area: 'Strength', text: `Your strength has improved across ${v.up} ${RN[g]} exercises over the past ${pw} (median ${pctTxt(v.median)} est. 1RM or reps).`, action: '' });
      else if (v.down >= MIN.strengthExercises && v.down > v.up) items.push({ kind: 'down', area: 'Strength', text: `${v.down} ${RN[g]} exercises have gone backward over the past ${pw} (median ${pctTxt(v.median)}).`, action: 'Check sleep and protein, or take a lighter week before pushing again.' });
    });
    if (!items.some((i) => i.area === 'Strength') && s.list.length === 1 && Math.abs(s.list[0].pct) >= 5) {
      const x = s.list[0];
      items.push({ kind: x.pct > 0 ? 'up' : 'down', area: 'Strength', text: `${x.ex.name}: ${pctTxt(x.pct)} ${x.loaded ? 'est. 1RM' : 'reps'} over ${x.sessions} sessions this ${pw}.`, action: x.pct > 0 ? '' : 'Hold the weight for a session or two and build reps back up.' });
    }

    // 4. Running: average distance and pace vs the previous period
    const cs = WT.cardioSummary(r);
    if (cs.runs.length >= MIN.runsEach && cs.prevRuns.length >= MIN.runsEach) {
      const d = ((cs.avgDist - cs.prevAvgDist) / cs.prevAvgDist) * 100;
      if (cs.prevAvgDist > 0 && Math.abs(d) >= 10)
        items.push({ kind: d > 0 ? 'up' : 'info', area: 'Cardio', text: `Your average run has ${d > 0 ? 'increased' : 'decreased'} from ${WT.fmtNum(WT.round(cs.prevAvgDist, 1))} to ${WT.fmtNum(WT.round(cs.avgDist, 1))} mi over the past ${pw}.`, action: d > 0 ? '' : 'If that wasn’t planned, add ~10% to one run a week.' });
      if (cs.pace && cs.prevPace) {
        const p = ((cs.prevPace - cs.pace) / cs.prevPace) * 100;
        if (Math.abs(p) >= 3) items.push({ kind: p > 0 ? 'up' : 'info', area: 'Cardio', text: `Your average pace is ${p > 0 ? 'faster' : 'slower'}: ${WT.fmtPace(cs.pace)} vs ${WT.fmtPace(cs.prevPace)} before.`, action: '' });
      }
    } else if (cs.runs.length >= 3) {
      const wk = cs.buckets.filter((b) => b.n);
      if (wk.length >= 3) {
        const sl = slope(wk.map((b) => ({ t: b.start.getTime(), v: b.dist })));
        if (sl != null && Math.abs(sl * 7) >= 0.2) items.push({ kind: sl > 0 ? 'up' : 'info', area: 'Cardio', text: `Your weekly running distance has ${sl > 0 ? 'increased' : 'decreased'} over the past ${pw} (about ${WT.fmtNum(WT.round(Math.abs(sl * 7), 1))} mi per week each week).`, action: '' });
      }
    }
    const runGoal = +WT.db.profile.runsPerWeek || 0;
    if (runGoal && r.days >= 14 && cs.runs.length === 0 && coversPrev && cs.prevRuns.length) items.push({ kind: 'down', area: 'Cardio', text: `No runs logged in the last ${pw}; you ran ${cs.prevRuns.length} times the ${pw} before.`, action: `Your plan has ${runGoal} runs a week. Even a short easy run keeps the habit.` });

    // 5. Nutrition: protein vs target, calories vs target
    const n = WT.nutritionSummary(r);
    if (n.logged >= MIN.proteinDays) {
      const under = n.logged - n.proteinMet;
      const t = n.targets.p;
      if (under / n.logged >= 0.6 && n.avgP < t * 0.9) {
        const gap = Math.round((t - n.avgP) / 5) * 5;
        items.push({ kind: 'down', area: 'Nutrition', text: `Your protein intake has been below your target on ${under} of ${n.logged} logged days (average ≈${Math.round(n.avgP)} g vs ${t} g).`, action: gap <= 35 ? `About ${gap} g a day closes the gap: a Greek yogurt or a protein shake.` : `About ${gap} g a day closes the gap: add a protein source to two meals.` });
      } else if (n.proteinMet / n.logged >= 0.8) items.push({ kind: 'up', area: 'Nutrition', text: `You hit your protein target on ${n.proteinMet} of ${n.logged} logged days.`, action: '' });
      if (n.targets.cal && n.avgCal) {
        const off = (n.avgCal - n.targets.cal) / n.targets.cal;
        if (Math.abs(off) >= 0.12)
          items.push({ kind: 'info', area: 'Nutrition', text: `You’ve averaged ≈${WT.fmtNum(Math.round(n.avgCal / 10) * 10)} calories on logged days, ${Math.round(Math.abs(off) * 100)}% ${off > 0 ? 'above' : 'below'} your ${WT.fmtNum(n.targets.cal)} target.`, action: off > 0 ? 'Check portions on your most frequent foods first; small swaps add up.' : 'If you’re training hard, eating closer to target supports recovery.' });
      }
    } else if (n.logged > 0 && n.logged < MIN.proteinDays) items.push({ kind: 'info', area: 'Nutrition', text: `Only ${n.logged} day${n.logged === 1 ? '' : 's'} of food logged this ${pw}; log at least ${MIN.proteinDays} for nutrition trends.`, action: '' });

    // 6. Body weight trend
    const b = WT.bodySummary(r);
    if (b.weights.length >= MIN.weighIns && b.span >= MIN.weighSpan && b.perWeek != null) {
      const w = WT.round(b.perWeek, 1);
      items.push({ kind: 'info', area: 'Body', text: Math.abs(w) < 0.2 ? `Your weight has been stable over the past ${pw} (${b.weights.length} weigh-ins).` : `Your weight is trending ${w < 0 ? 'down' : 'up'} about ${WT.fmtNum(Math.abs(w))} ${b.unit} per week (${b.weights.length} weigh-ins over ${Math.round(b.span)} days).`, action: '' });
    }

    // Nothing to say: explain what's needed rather than guessing
    let needMore = null;
    if (!items.length) {
      const have = [];
      if (c.count) have.push(`${c.count} workout${c.count === 1 ? '' : 's'}`);
      if (cs.runs.length) have.push(`${cs.runs.length} run${cs.runs.length === 1 ? '' : 's'}`);
      if (n.logged) have.push(`${n.logged} day${n.logged === 1 ? '' : 's'} of food`);
      needMore = !first
        ? 'Insights appear once you’ve logged a few workouts, runs or meals. They compare periods, so they need some history.'
        : `${have.length ? `So far this ${pw}: ${have.join(', ')}. ` : ''}Insights compare this ${pw} with the one before and need a few data points in each (2+ sessions per exercise, 2+ runs, 5+ days of food, 3+ weigh-ins over two weeks). Keep tracking and they’ll appear.`;
    }
    const order = { down: 0, up: 1, info: 2 };
    return { items: items.sort((a, b) => order[a.kind] - order[b.kind]), needMore, range: r };
  };
})();
