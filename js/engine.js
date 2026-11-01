/* Engine: history, progressive overload, workout generation, statistics. Pure logic — no DOM. */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});

  /* ═════════════════════ HISTORY ═════════════════════ */
  WT.sessions = () => WT.db.history.slice().sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));

  const validSet = (s, tt) =>
    s && s.done && (tt === 'cardio' ? +s.time > 0 || +s.dist > 0 : tt === 'time' ? +s.r > 0 : +s.r > 0);

  /** All completed performances of one exercise, oldest → newest. */
  WT.exerciseHistory = function (exId, excludeSessionId) {
    const ex = WT.ex(exId);
    const tt = ex ? WT.trackType(ex) : 'weight';
    const out = [];
    WT.sessions().forEach((s) => {
      if (s.id === excludeSessionId) return;
      s.exercises.forEach((e) => {
        if (e.exId !== exId || e.skipped) return;
        const sets = (e.sets || []).filter((x) => validSet(x, tt)).map((x) => ({ w: +x.w || 0, r: +x.r || 0, time: +x.time || 0, dist: +x.dist || 0 }));
        if (!sets.length) return;
        out.push({
          date: s.endedAt || s.startedAt,
          sessionId: s.id,
          sets,
          intensity: e.intensity,
          repMin: e.repMin,
          repMax: e.repMax,
          targetSets: e.targetSets || sets.length,
          effort: e.effort || null,
          metrics: sessionMetrics(sets, tt),
        });
      });
    });
    return out;
  };

  function sessionMetrics(sets, tt) {
    const m = { topWeight: 0, topReps: 0, e1rm: 0, volume: 0, bestReps: 0, totalReps: 0, time: 0, dist: 0 };
    sets.forEach((s) => {
      if (s.w > m.topWeight || (s.w === m.topWeight && s.r > m.topReps)) {
        m.topWeight = s.w;
        m.topReps = s.r;
      }
      m.e1rm = Math.max(m.e1rm, WT.e1rm(s.w, s.r));
      m.volume += s.w * s.r;
      m.bestReps = Math.max(m.bestReps, s.r);
      m.totalReps += s.r;
      m.time += s.time;
      m.dist += s.dist;
    });
    if (tt === 'time') m.bestHold = m.bestReps;
    return m;
  }
  WT.sessionMetrics = sessionMetrics;

  /** Personal records for an exercise. */
  WT.personalRecords = function (exId, excludeSessionId) {
    const h = WT.exerciseHistory(exId, excludeSessionId);
    const pr = { heaviest: null, e1rm: null, reps: null, volume: null, count: h.length, last: h[h.length - 1] || null };
    h.forEach((entry) => {
      entry.sets.forEach((s) => {
        if (s.w > 0 && (!pr.heaviest || s.w > pr.heaviest.w || (s.w === pr.heaviest.w && s.r > pr.heaviest.r)))
          pr.heaviest = { w: s.w, r: s.r, date: entry.date };
        const e = WT.e1rm(s.w, s.r);
        if (e > 0 && (!pr.e1rm || e > pr.e1rm.v)) pr.e1rm = { v: e, w: s.w, r: s.r, date: entry.date };
        if (s.r > 0 && (!pr.reps || s.r > pr.reps.r)) pr.reps = { r: s.r, w: s.w, date: entry.date };
      });
      if (entry.metrics.volume > 0 && (!pr.volume || entry.metrics.volume > pr.volume.v)) pr.volume = { v: entry.metrics.volume, date: entry.date };
    });
    return pr;
  };

  /* ═════════════════════ LOAD INCREMENTS ═════════════════════ */
  WT.dumbbellWeights = function () {
    const d = WT.db.profile.dumbbells;
    const set = new Set();
    for (let w = +d.min; w <= +d.max + 1e-6; w += +d.step || 5) set.add(WT.round(w, 2));
    if (d.microLoad) for (let w = +d.min + 2.5; w < +d.max; w += 5) set.add(WT.round(w, 2));
    return [...set].sort((a, b) => a - b);
  };

  /** Next load up/down, respecting available equipment. Returns {w, capped, note}. */
  WT.stepLoad = function (ex, w, dir, big) {
    const region = WT.region(ex);
    const p = WT.db.profile;
    if (ex.load === 'db') {
      const ws = WT.dumbbellWeights();
      if (dir > 0) {
        const want = region === 'lower' ? w + (big ? 10 : 5) : w + (p.dumbbells.microLoad && w < 30 ? 2.5 : 5);
        const above = ws.filter((x) => x > w);
        if (!above.length) return { w, capped: true };
        const fit = above.filter((x) => x <= want + 1e-6);
        return { w: fit.length ? fit[fit.length - 1] : above[0] };
      }
      const target = w * 0.9;
      const below = ws.filter((x) => x < w);
      if (!below.length) return { w, capped: true };
      const fit = below.filter((x) => x <= target + 1e-6);
      return { w: fit.length ? fit[fit.length - 1] : below[below.length - 1] };
    }
    let step;
    if (ex.load === 'cable' || ex.load === 'machine') step = (+p.cableStep || 5) * (region === 'lower' ? 2 : 1);
    else if (ex.load === 'bb') step = region === 'lower' ? 10 : 5;
    else if (ex.load === 'kb') step = 5;
    else if (ex.load === 'mb') step = 2;
    else step = 5;
    if (p.unit === 'kg') step = Math.max(1, step / 2);
    if (dir > 0) return { w: w + step * (big && region === 'lower' ? 2 : 1) };
    const down = Math.max(step, Math.round((w * 0.1) / step) * step);
    return { w: Math.max(0, w - down) };
  };
  WT.snapLoad = function (ex, w) {
    if (ex.load === 'db') {
      const ws = WT.dumbbellWeights();
      let best = ws[0];
      ws.forEach((x) => {
        if (x <= w + 1e-6) best = x;
      });
      return best;
    }
    const step = ex.load === 'cable' || ex.load === 'machine' ? +WT.db.profile.cableStep || 5 : WT.db.profile.unit === 'kg' ? 1 : 2.5;
    return Math.floor(w / step) * step;
  };

  /* ═════════════════════ PROGRESSIVE OVERLOAD ═════════════════════ */
  /**
   * Recommendation for the next performance of an exercise.
   * plan: { repMin, repMax, sets, intensity }
   * Returns { action, weight, reps, headline, reasons[], basis } — never applied without user approval.
   */
  WT.recommend = function (exId, plan, excludeSessionId) {
    const ex = WT.ex(exId);
    if (!ex) return null;
    const tt = WT.trackType(ex);
    const hist = WT.exerciseHistory(exId, excludeSessionId);
    const u = WT.db.profile.unit;
    plan = plan || { repMin: ex.repMin, repMax: ex.repMax, sets: ex.sets, intensity: ex.intensity };

    if (!hist.length) {
      if (tt === 'cardio') return { action: 'new', headline: 'First logged session', reasons: ['Log time and distance — future sessions will show your pace trend.'] };
      if (tt === 'time') return { action: 'new', headline: `Hold ${plan.repMin}–${plan.repMax}s`, reasons: ['No history yet. Stop each hold just before your form breaks — that becomes your baseline.'] };
      if (tt === 'reps' && ex.load === 'bw')
        return { action: 'new', headline: `Aim for ${plan.repMin}–${plan.repMax} reps`, reasons: ['No history yet. Do clean reps and stop 1–2 short of failure; your result becomes the baseline.'] };
      return {
        action: 'new',
        headline: 'Find your starting weight',
        reasons: [`No history yet. Pick a weight you can lift for ${plan.repMax} reps with about 2 reps left in the tank. Your first session becomes the baseline for future recommendations.`],
      };
    }

    const last = hist[hist.length - 1];
    const prev = hist[hist.length - 2];
    const days = WT.daysBetween(last.date, new Date());
    const when = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
    const basis = { date: last.date, sets: last.sets, days };

    if (tt === 'cardio') {
      const m = last.metrics;
      const pace = m.dist > 0 && m.time > 0 ? m.time / m.dist : null;
      return {
        action: 'info',
        headline: `Last: ${WT.fmtNum(m.time)} min${m.dist ? ' · ' + WT.fmtNum(m.dist) + ' mi' : ''}`,
        reasons: [
          pace ? `Average pace ${WT.fmtPace(pace)} /mi ${when}.` : `Logged ${when}.`,
          'Progress runs gradually: add ~5–10% total distance per week, or one extra interval.',
        ],
        basis,
      };
    }

    const lastMin = last.repMin || plan.repMin;
    const lastMax = last.repMax || plan.repMax;
    const targetSets = Math.min(last.targetSets || plan.sets, Math.max(plan.sets, 1));

    if (tt === 'time') {
      const best = last.metrics.bestReps;
      const allTop = last.sets.length >= targetSets && last.sets.every((s) => s.r >= lastMax);
      if (allTop)
        return { action: 'increase', reps: best + 10, headline: `Hold ${best + 5}–${best + 10}s`, reasons: [`You held ${lastMax}s+ on every set ${when}. Add 5–10 seconds, or progress to a harder variation.`], basis };
      return { action: 'hold', reps: best, headline: `Match ${best}s, then beat it`, reasons: [`Your best hold ${when} was ${best}s. Aim to reach ${lastMax}s on every set before progressing.`], basis };
    }

    // Weight of the working sets = heaviest weight used last time
    const topW = last.metrics.topWeight;
    const workSets = last.sets.filter((s) => s.w === topW);
    const repsStr = workSets.map((s) => s.r).join(', ');
    const loaded = tt === 'weight' || topW > 0;

    // Intensity changed (e.g. last time 8–12 regular, now heavy 5–8) → derive from estimated 1RM
    if (loaded && topW > 0 && Math.abs((lastMin + lastMax) / 2 - (plan.repMin + plan.repMax) / 2) >= 3) {
      const e = Math.max(...last.sets.map((s) => WT.e1rm(s.w, s.r)));
      const targetReps = plan.repMax;
      const w = WT.snapLoad(ex, e / (1 + targetReps / 30));
      return {
        action: w > topW ? 'increase' : w < topW ? 'decrease' : 'hold',
        weight: w,
        reps: `${plan.repMin}–${plan.repMax}`,
        headline: `${WT.fmtNum(w)} ${u} × ${plan.repMin}–${plan.repMax}`,
        reasons: [
          `Different rep target than last time (${lastMin}–${lastMax}). Based on ${WT.fmtNum(topW)} ${u} × ${workSets[0].r} ${when}, your estimated 1-rep max is ~${WT.fmtNum(Math.round(e))} ${u}.`,
          `${WT.fmtNum(w)} ${u} should land you in the ${plan.repMin}–${plan.repMax} range. Adjust after the first set if needed.`,
        ],
        basis,
      };
    }

    const completedEnough = workSets.length >= targetSets;
    const allTop = completedEnough && workSets.every((s) => s.r >= lastMax);
    const allMin = completedEnough && workSets.every((s) => s.r >= lastMin);
    const exceeded = allTop && workSets.every((s) => s.r >= lastMax + 3);
    const avgReps = workSets.reduce((a, s) => a + s.r, 0) / workSets.length;
    const easy = last.effort === 'easy';
    const hard = last.effort === 'hard';
    const prevStruggled = prev && prev.metrics.topWeight === topW && !(prev.sets.filter((s) => s.w === topW).every((s) => s.r >= (prev.repMin || lastMin)));
    const prevTop = prev && prev.metrics.topWeight === topW && prev.sets.filter((s) => s.w === topW).length >= targetSets && prev.sets.filter((s) => s.w === topW).every((s) => s.r >= (prev.repMax || lastMax));
    const lastStr = loaded ? `${WT.fmtNum(topW)} ${u} × ${repsStr}` : `${repsStr} reps`;

    // Long layoff → conservative restart
    if (days > 28) {
      if (!loaded) return { action: 'return', reps: Math.max(lastMin, Math.round(avgReps * 0.8)), headline: `Ease back in: ~${Math.max(lastMin, Math.round(avgReps * 0.8))} reps`, reasons: [`It's been ${days} days. Last time: ${lastStr}. Start around 80% of those reps and rebuild over 1–2 sessions.`], basis };
      const w = days > 56 ? WT.stepLoad(ex, topW, -1).w : topW;
      return {
        action: 'return',
        weight: w,
        reps: `${plan.repMin}–${plan.repMax}`,
        headline: `${WT.fmtNum(w)} ${u} × ${plan.repMin}–${plan.repMax}`,
        reasons: [
          `It's been ${days} days since you did this (${lastStr}).`,
          days > 56 ? 'After a long break, start a step lighter and work back up — strength returns quickly.' : 'Start at your last working weight and see how it feels before progressing.',
        ],
        basis,
      };
    }

    // Bodyweight (no external load)
    if (!loaded) {
      const harder = ex.harder && WT.ex(ex.harder);
      if (allTop) {
        const reasons = [`You hit ${lastMax}+ reps on all ${workSets.length} sets ${when} (${repsStr}).`];
        if (prevTop) reasons.push('That is two sessions in a row at the top of the range.');
        if (ex.load === 'bwl') reasons.push(`Add a small load (e.g. a 5 ${u} dumbbell or vest) and work back up through the range${harder ? `, or progress to ${harder.name}` : ''}.`);
        else if (harder) reasons.push(`Progress to ${harder.name}, or add 1–2 reps per set.`);
        else reasons.push('Add 1–2 reps per set, slow the lowering phase to 3 seconds, or add a set.');
        return { action: ex.load === 'bwl' || harder ? 'progress' : 'reps', reps: lastMax + 2, harder: harder ? harder.id : null, headline: ex.load === 'bwl' ? `Add load: ${5} ${u}` : harder ? `Try ${harder.name}` : `Aim for ${lastMax + 2} reps`, addLoad: ex.load === 'bwl' ? 5 : 0, reasons, basis };
      }
      if (allMin || avgReps >= lastMin) {
        return { action: 'reps', reps: Math.min(lastMax, Math.round(avgReps) + 1), headline: `Beat ${repsStr}: +1 rep per set`, reasons: [`Last time ${when}: ${repsStr} reps. Add a rep to each set until all ${targetSets} sets reach ${lastMax}.`], basis };
      }
      const reasons = [`Last time ${when}: ${repsStr} reps — below the ${lastMin}-rep target.`];
      if (exId.includes('pullup') || exId === 'chinup') reasons.push('Keep the same target and add 2–3 slow negatives after your last set to build strength.');
      else reasons.push('Repeat the same target; consistency will get you there.');
      return { action: 'hold', reps: lastMin, headline: `Match ${repsStr} and push for ${lastMin}`, reasons, basis };
    }

    // Weighted exercise
    if (allTop && !hard) {
      const step = WT.stepLoad(ex, topW, +1, exceeded);
      if (step.capped)
        return {
          action: 'reps',
          weight: topW,
          headline: `Stay at ${WT.fmtNum(topW)} ${u} — add reps or tempo`,
          reasons: [`You hit ${lastMax}+ reps on all sets ${when} (${lastStr}), but ${WT.fmtNum(topW)} ${u} is your heaviest available ${ex.load === 'db' ? 'dumbbell' : 'load'}.`, 'Progress with 1–2 more reps per set, a 3-second lowering phase, a pause at the stretch, or an extra set.'],
          basis,
        };
      const inc = WT.round(step.w - topW, 2);
      const reasons = [`You completed all ${workSets.length} sets at the top of the ${lastMin}–${lastMax} range ${when} (${lastStr}).`];
      if (prevTop) reasons.push('Second session in a row at the top of the range — you are ready.');
      if (easy) reasons.push('You also rated it easy.');
      reasons.push(`Add ${WT.fmtNum(inc)} ${u}${ex.load === 'db' ? ' (next available dumbbell)' : ''} and expect reps to drop toward ${lastMin}–${lastMin + 2}; build back up from there.`);
      return { action: 'increase', weight: step.w, reps: `${lastMin}–${lastMax}`, headline: `${WT.fmtNum(step.w)} ${u} × ${lastMin}–${lastMax}`, delta: inc, reasons, basis };
    }
    if (allTop && hard)
      return { action: 'hold', weight: topW, headline: `Repeat ${WT.fmtNum(topW)} ${u}`, reasons: [`You hit every rep ${when} (${lastStr}) but rated it a grind. Repeat it once more so it feels solid before adding weight.`], basis };

    if (easy && allMin && avgReps >= (lastMin + lastMax) / 2) {
      const step = WT.stepLoad(ex, topW, +1);
      if (!step.capped)
        return {
          action: 'increase',
          weight: step.w,
          reps: `${lastMin}–${lastMax}`,
          headline: `${WT.fmtNum(step.w)} ${u} × ${lastMin}–${lastMax}`,
          delta: WT.round(step.w - topW, 2),
          reasons: [`You rated ${lastStr} as easy and averaged ${WT.fmtNum(avgReps)} reps.`, `A small jump to ${WT.fmtNum(step.w)} ${u} is reasonable.`],
          basis,
        };
    }

    if (allMin) {
      const targets = repTargets(workSets.map((x) => x.r), lastMin, lastMax, targetSets);
      return {
        action: 'hold',
        weight: topW,
        reps: targets.join(', '),
        repTargets: targets,
        headline: `Maintain ${WT.fmtNum(topW)} ${u} — aim for ${targets.join(', ')}`,
        reasons: [`Last time ${when}: ${lastStr}. Every set was in the ${lastMin}–${lastMax} range, but not all at the top.`, `Keep the weight and bring each set up by about a rep. Once all ${targetSets} sets reach ${lastMax}, the next step is a weight increase.`],
        basis,
      };
    }

    // Struggled
    if (prevStruggled) {
      const step = WT.stepLoad(ex, topW, -1);
      return {
        action: 'decrease',
        weight: step.w,
        reps: `${lastMin}–${lastMax}`,
        headline: `Drop to ${WT.fmtNum(step.w)} ${u} × ${lastMin}–${lastMax}`,
        reasons: [`You fell short of ${lastMin} reps at ${WT.fmtNum(topW)} ${u} in your last two sessions (latest: ${repsStr}).`, `Drop to ${WT.fmtNum(step.w)} ${u}, own the full range for a couple of sessions, then build back up.`],
        basis,
      };
    }
    const targets = repTargets(workSets.map((x) => x.r), lastMin, lastMax, targetSets).map((r) => Math.max(lastMin, r));
    return {
      action: 'hold',
      weight: topW,
      reps: targets.join(', '),
      repTargets: targets,
      headline: `Maintain ${WT.fmtNum(topW)} ${u} — aim for ${targets.join(', ')}`,
      reasons: [`Last time ${when}: ${lastStr} — some sets fell short of ${lastMin} reps${workSets.length < targetSets ? ` and only ${workSets.length} of ${targetSets} sets were completed` : ''}.`, 'Repeat this weight and aim to hit the minimum on every set. If it happens again, the app will suggest backing off.'],
      basis,
    };
  };

  /** Conservative per-set rep goals: lift lagging sets toward your best set; +1 when all sets are equal. */
  function repTargets(reps, lo, hi, n) {
    const r = reps.slice(0, n);
    while (r.length < n) r.push(r[r.length - 1] || lo);
    const best = Math.max(...r);
    const allEqual = r.every((x) => x === best);
    return r.map((x) => Math.max(lo, Math.min(hi, allEqual ? x + 1 : Math.max(x, Math.min(best, x + 1)))));
  }
  WT.repTargets = repTargets;

  WT.fmtPace = (minPerMile) => {
    const m = Math.floor(minPerMile);
    const s = Math.round((minPerMile - m) * 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  /* ═════════════════════ TRAINING LOAD ANALYSIS ═════════════════════ */
  /** Completed sets per muscle (primary = 1, secondary = 0.5) within the last `hours`. */
  WT.muscleLoad = function (hours, now) {
    now = now || Date.now();
    const load = {};
    WT.db.history.forEach((s) => {
      const t = new Date(s.endedAt || s.startedAt).getTime();
      if (now - t > hours * 3600e3 || t > now) return;
      s.exercises.forEach((e) => {
        const ex = WT.ex(e.exId);
        if (!ex || e.skipped) return;
        const n = (e.sets || []).filter((x) => x.done).length;
        if (!n) return;
        load[ex.primary] = (load[ex.primary] || 0) + n;
        ex.secondary.forEach((m) => (load[m] = (load[m] || 0) + n * 0.5));
      });
    });
    return load;
  };
  WT.weeklyTarget = function (m) {
    const p = WT.db.profile;
    if (m === 'cardio') return 0;
    if (['calves', 'forearms', 'adductors', 'lower-back', 'traps'].includes(m)) return 4;
    if (p.prioritize.includes(m)) return 14;
    return 10;
  };

  /* ═════════════════════ GENERATOR ═════════════════════ */
  const S = (label, m, p, o) => Object.assign({ label, m, p }, o || {});
  const SLOTS = {
    chest: [
      S('Chest press', ['chest'], ['h-push'], { heavy: true }),
      S('Incline press', ['chest'], ['incline-push']),
      S('Lower-chest press', ['chest'], ['decline-push', 'dip'], { tag: 'lower-chest' }),
      S('Chest fly', ['chest'], ['fly']),
      S('Lower-chest fly', ['chest'], ['fly'], { tag: 'lower-chest' }),
      S('Press variation', ['chest'], ['h-push', 'decline-push', 'incline-push', 'dip', 'plyo']),
      S('Chest accessory', ['chest'], null),
    ],
    back: [
      S('Vertical pull', ['lats', 'upper-back'], ['v-pull'], { heavy: true }),
      S('Horizontal row', ['lats', 'upper-back'], ['h-pull'], { heavy: true }),
      S('Second vertical pull', ['lats'], ['v-pull']),
      S('Single-arm row', ['lats', 'upper-back'], ['h-pull']),
      S('Lat isolation', ['lats'], ['pullover']),
      S('Rear delts', ['rear-delts'], ['rear-fly']),
      S('Traps', ['traps'], ['shrug']),
    ],
    shoulders: [
      S('Overhead press', ['front-delts'], ['v-push'], { heavy: true }),
      S('Lateral raise', ['side-delts'], ['lateral']),
      S('Rear delts', ['rear-delts'], ['rear-fly']),
      S('Second lateral', ['side-delts'], ['lateral', 'upright']),
      S('Front delts', ['front-delts'], ['front-raise', 'v-push']),
      S('Traps', ['traps'], ['shrug']),
      S('Rear delts (2)', ['rear-delts'], ['rear-fly']),
    ],
    biceps: [
      S('Biceps curl', ['biceps'], ['curl'], { heavy: true }),
      S('Hammer curl', ['biceps'], ['hammer-curl']),
      S('Stretch curl', ['biceps'], ['stretch-curl']),
      S('Peak curl', ['biceps'], ['peak-curl']),
      S('Curl variation', ['biceps'], ['curl', 'hammer-curl']),
      S('Forearms', ['forearms'], ['wrist']),
    ],
    triceps: [
      S('Close-grip press / dip', ['triceps'], ['tri-press'], { heavy: true }),
      S('Overhead extension', ['triceps'], ['tri-overhead']),
      S('Pushdown', ['triceps'], ['pushdown']),
      S('Triceps extension', ['triceps'], ['tri-ext']),
      S('Pushdown variation', ['triceps'], ['pushdown', 'tri-overhead']),
      S('Triceps finisher', ['triceps'], ['tri-press', 'tri-ext', 'pushdown']),
    ],
    forearms: [S('Wrist work', ['forearms'], ['wrist']), S('Grip / carry', ['forearms'], ['carry']), S('Forearms (2)', ['forearms'], ['wrist'])],
    quads: [S('Squat', ['quads'], ['squat'], { heavy: true }), S('Single-leg', ['quads'], ['lunge']), S('Quad isolation', ['quads'], ['knee-ext']), S('Squat variation', ['quads'], ['squat', 'lunge'])],
    hamstrings: [S('Leg curl', ['hamstrings'], ['knee-flexion']), S('Hip extension', ['glutes', 'hamstrings'], ['hinge']), S('Leg curl (2)', ['hamstrings'], ['knee-flexion'])],
    glutes: [S('Hip thrust / bridge', ['glutes'], ['hinge'], { heavy: true }), S('Single-leg', ['quads', 'glutes', 'adductors'], ['lunge']), S('Glute accessory', ['glutes'], ['hinge'])],
    calves: [S('Calves', ['calves'], ['calf']), S('Calves (2)', ['calves'], ['calf'])],
    core: [
      S('Anti-extension', ['abs'], ['anti-ext']),
      S('Loaded crunch / leg raise', ['abs'], ['flexion', 'leg-raise']),
      S('Rotation', ['obliques'], ['rotation', 'anti-rot'], { tag: 'love-handles' }),
      S('Side / lateral', ['obliques'], ['lateral-flex', 'carry']),
      S('Lower abs', ['abs'], ['leg-raise']),
      S('Core finisher', ['abs', 'obliques'], null),
    ],
    cardio: [
      S('Main cardio', ['cardio'], ['run', 'steady'], { cardio: true }),
      S('Conditioning', ['cardio', 'abs', 'quads', 'glutes'], ['conditioning', 'plyo'], { cardio: true }),
      S('Conditioning', ['cardio', 'abs', 'quads', 'glutes'], ['conditioning', 'plyo'], { cardio: true }),
      S('Conditioning', ['cardio', 'abs', 'quads', 'glutes'], ['conditioning', 'plyo'], { cardio: true }),
      S('Conditioning', ['cardio', 'abs', 'quads', 'glutes'], ['conditioning', 'plyo'], { cardio: true }),
      S('Conditioning', ['cardio', 'abs', 'quads', 'glutes'], ['conditioning', 'plyo'], { cardio: true }),
    ],
  };
  const W = (slot, weight, essential) => Object.assign({}, slot, { weight, essential: !!essential });

  function templateFor(type, targets) {
    switch (type) {
      case 'full':
        return [
          W(SLOTS.quads[0], 10, true),
          W(S('Chest press', ['chest'], ['h-push', 'decline-push', 'incline-push', 'dip'], { heavy: true }), 10, true),
          W(S('Back pull', ['lats', 'upper-back'], ['v-pull', 'h-pull'], { heavy: true }), 10, true),
          W(S('Hips & hamstrings', ['glutes', 'hamstrings'], ['hinge', 'knee-flexion']), 5),
          W(S('Arms', ['biceps', 'triceps'], null), 4.5),
          W(S('Core', ['abs', 'obliques'], ['anti-ext', 'flexion', 'leg-raise', 'rotation', 'anti-rot', 'lateral-flex'], { core: true }), 4),
          W(S('Shoulders', ['side-delts', 'rear-delts'], ['lateral', 'rear-fly']), 3.5),
          W(S('Second pull', ['lats', 'upper-back'], ['h-pull', 'v-pull']), 3),
          W(S('Chest accessory', ['chest'], ['fly', 'decline-push', 'dip'], { tag: 'lower-chest' }), 3),
          W(S('Arms (2)', ['biceps', 'triceps'], null), 2.5),
          W(SLOTS.quads[1], 2),
          W(SLOTS.calves[0], 1.5),
        ];
      case 'push':
        return [
          W(SLOTS.chest[0], 10, true),
          W(SLOTS.shoulders[0], 10, true),
          W(S('Triceps', ['triceps'], ['tri-press', 'tri-overhead', 'pushdown', 'tri-ext']), 9, true),
          W(SLOTS.chest[2], 6),
          W(SLOTS.shoulders[1], 5.5),
          W(SLOTS.chest[3], 5),
          W(S('Triceps (2)', ['triceps'], ['tri-overhead', 'pushdown', 'tri-ext']), 4.5),
          W(SLOTS.chest[1], 4),
          W(SLOTS.shoulders[3], 3),
          W(SLOTS.chest[5], 2),
        ];
      case 'pull':
        return [
          W(SLOTS.back[0], 10, true),
          W(SLOTS.back[1], 10, true),
          W(S('Biceps', ['biceps'], ['curl', 'stretch-curl', 'peak-curl']), 9, true),
          W(SLOTS.back[5], 6),
          W(SLOTS.biceps[1], 5.5),
          W(SLOTS.back[3], 5),
          W(SLOTS.back[4], 4),
          W(SLOTS.back[6], 3),
          W(SLOTS.biceps[2], 3),
          W(SLOTS.forearms[0], 2),
        ];
      case 'legs':
        return [
          W(SLOTS.quads[0], 10, true),
          W(SLOTS.glutes[0], 10, true),
          W(SLOTS.quads[1], 8, true),
          W(SLOTS.hamstrings[0], 6),
          W(SLOTS.quads[2], 5.5),
          W(SLOTS.calves[0], 5),
          W(S('Adductors', ['adductors'], ['lunge', 'adduction', 'lateral-flex']), 3),
          W(SLOTS.core[0], 2.5),
          W(SLOTS.glutes[2], 2),
          W(SLOTS.calves[1], 1),
        ];
      case 'arms': {
        const out = [];
        for (let i = 0; i < 5; i++) {
          out.push(W(SLOTS.biceps[i], 10 - i * 2, i === 0));
          out.push(W(SLOTS.triceps[i], 9.9 - i * 2, i === 0));
        }
        out.push(W(SLOTS.forearms[0], 0.5));
        return out;
      }
      case 'custom': {
        const ts = targets && targets.length ? targets : ['chest', 'back'];
        const out = [];
        const max = Math.max(...ts.map((t) => (SLOTS[t] || []).length));
        for (let i = 0; i < max; i++)
          ts.forEach((t, j) => {
            const s = (SLOTS[t] || [])[i];
            if (s) out.push(W(s, 10 - i * 2 - j * 0.01, i === 0));
          });
        return out;
      }
      default: {
        const list = SLOTS[type] || SLOTS.chest;
        return list.map((s, i) => W(s, 10 - i, i < 2));
      }
    }
  }
  WT.templateFor = templateFor;

  /* ───────── Intensity model ─────────
   * Four classes: heavy (5–8), regular (8–12), burnout (12–20+), standard (exercise's own
   * recommendation, no designation). By default each exercise is drawn INDEPENDENTLY from
   * configurable odds, weighted by how suitable the exercise is for each class. There is no
   * fixed per-workout formula: 0 heavy / 0 burnout / all-regular / 3 heavy… are all possible.
   */
  WT.INTENSITIES = ['heavy', 'regular', 'burnout', 'standard'];
  WT.INTENSITY_INFO = {
    heavy: { name: 'Heavy', reps: '5–8 reps', text: 'Higher load, longer rest. Reserved for movements that load safely.' },
    regular: { name: 'Regular', reps: '8–12 reps', text: 'Classic hypertrophy work — the backbone of most sessions.' },
    burnout: { name: 'Burnout', reps: '12–20+ reps', text: 'Lighter weight, short rest, last set close to failure.' },
    standard: { name: 'Standard', reps: 'As recommended', text: 'The exercise’s own recommended sets and reps. No special designation.' },
  };

  /** Relative odds of each eligible intensity for one exercise (0 = not allowed). */
  WT.intensityWeights = function (ex, opts) {
    opts = opts || {};
    const p = WT.db.profile;
    const odds = p.intensityOdds || {};
    const comp = ex.category === 'compound';
    const tt = WT.trackType(ex);
    const w = {};
    ex.intensities.forEach((k) => {
      let v = Math.max(0, +odds[k] || 0);
      if (k === 'heavy') {
        v *= comp ? 1 : 0.35; // heavy loading belongs on compounds
        if (tt !== 'weight') v *= 0.6; // bodyweight / timed work is called "heavy" less often
        if (ex.difficulty === 'advanced') v *= 0.6;
        if (p.experience === 'beginner') v *= 0.5;
        if (opts.fatigued) v *= 0.4; // muscle hammered in the last 48h
        if (opts.position != null) v *= opts.position < 0.5 ? 1.25 : 0.7; // early in the session → heavier
      } else if (k === 'burnout') {
        if (!p.burnouts) v = 0;
        v *= comp ? 0.35 : 1; // burnouts favour safer isolation / bodyweight work
        if (ex.tags.includes('spinal-load')) v = 0;
        if (opts.position != null) v *= opts.position >= 0.5 ? 1.3 : 0.6; // finishers come late
      }
      w[k] = v;
    });
    return w;
  };
  function drawWeighted(w, rnd) {
    const keys = Object.keys(w).filter((k) => w[k] > 0);
    if (!keys.length) return 'standard';
    const total = keys.reduce((a, k) => a + w[k], 0);
    let r = (rnd || Math.random)() * total;
    for (const k of keys) {
      r -= w[k];
      if (r <= 0) return k;
    }
    return keys[keys.length - 1];
  }
  WT.drawWeighted = drawWeighted;

  /** Independently randomise intensities for a list of workout items (locked items keep theirs). */
  WT.randomizeIntensities = function (items, ctx, rnd) {
    const n = items.length;
    // Safety rails only — they rarely bind with default odds, and never force a minimum.
    const cap = { heavy: Math.max(1, Math.ceil(n / 2)), burnout: Math.max(1, Math.ceil(n / 3)) };
    const used = { heavy: 0, burnout: 0 };
    items.forEach((i) => i.locked && i.intensity && used[i.intensity] != null && used[i.intensity]++);
    const order = WT.shuffle(items.filter((i) => !(i.locked && i.intensity)));
    order.forEach((i) => {
      const ex = WT.ex(i.exId);
      const pos = n > 1 ? items.indexOf(i) / (n - 1) : 0;
      const fatigued = ctx && ctx.fatigue ? (ctx.fatigue[ex.primary] || 0) >= 8 : false;
      const w = WT.intensityWeights(ex, { position: i.slot && i.slot.heavy ? 0 : pos, fatigued });
      ['heavy', 'burnout'].forEach((k) => used[k] >= cap[k] && (w[k] = 0));
      i.intensity = drawWeighted(w, rnd);
      if (used[i.intensity] != null) used[i.intensity]++;
    });
    return items;
  };

  /** Default counts for manual (non-random) mode. */
  function autoIntensity(type, n) {
    const f = WT.db.profile.intensityFixed || { heavy: 2, burnout: 1 };
    const heavy = Math.min(n, type === 'cardio' ? 0 : +f.heavy || 0);
    const burnout = Math.min(n - heavy, type === 'cardio' ? 0 : +f.burnout || 0);
    return { heavy, burnout, regular: Math.max(0, n - heavy - burnout) };
  }
  WT.autoIntensity = autoIntensity;

  /** Closest allowed intensity when an exercise can't take the requested one (used by swaps). */
  WT.nearestIntensity = function (ex, want) {
    const pref = { heavy: ['heavy', 'regular', 'standard'], burnout: ['burnout', 'standard', 'regular'], regular: ['regular', 'standard'], standard: ['standard'] }[want] || ['standard'];
    return pref.find((k) => ex.intensities.includes(k)) || 'standard';
  };

  WT.defaultSettings = function (type) {
    const p = WT.db.profile;
    return {
      type: type || p.preferredType || 'full',
      count: p.defaultCount,
      autoCount: false,
      duration: p.defaultDuration,
      equipment: p.equipment.slice(),
      intensityMode: p.intensityRandom === false ? 'manual' : 'random',
      heavy: (p.intensityFixed || {}).heavy != null ? +p.intensityFixed.heavy : 2,
      burnout: (p.intensityFixed || {}).burnout != null ? +p.intensityFixed.burnout : 1,
      prioritize: p.prioritize.slice(),
      avoidMuscles: p.avoidMuscles.slice(),
      supersets: p.supersets,
      targets: ['chest', 'biceps', 'triceps'],
    };
  };

  /** Context (fatigue, weekly volume, exercise recency) used by scoring. */
  function buildContext(settings) {
    const p = WT.db.profile;
    const fatigue = WT.muscleLoad(48);
    const weekly = WT.muscleLoad(24 * 7);
    const lastDone = {};
    WT.db.history.forEach((s) =>
      s.exercises.forEach((e) => {
        const t = new Date(s.endedAt || s.startedAt).getTime();
        if (!e.skipped && (!lastDone[e.exId] || lastDone[e.exId] < t)) lastDone[e.exId] = t;
      })
    );
    return {
      p,
      settings,
      fatigue,
      weekly,
      lastDone,
      equipment: settings.equipment || p.equipment,
      prioritize: new Set(settings.prioritize || p.prioritize),
      avoid: new Set(settings.avoidMuscles || p.avoidMuscles),
      excluded: new Set(p.excluded),
      favorites: new Set(p.favorites),
      emphasis: new Set(p.emphasisTags || []),
    };
  }

  function eligible(ex, ctx, used) {
    if (used && used.has(ex.id)) return false;
    if (ctx.excluded.has(ex.id)) return false;
    if (WT.isRestricted(ex, ctx.p)) return false;
    if (!WT.hasEquipment(ex, ctx.equipment)) return false;
    if (ctx.avoid.has(ex.primary)) return false;
    return true;
  }

  function slotMatch(ex, slot, level) {
    if (slot.cardio) {
      const isCardio = ex.primary === 'cardio' || ex.tags.includes('conditioning');
      if (!isCardio) return false;
      return level >= 1 || !slot.p || slot.p.includes(ex.pattern);
    }
    if (ex.category === 'cardio' && !slot.core) return false;
    if (ex.tags.includes('conditioning')) return false;
    if (level === 0) return slot.m.includes(ex.primary) && (!slot.p || slot.p.includes(ex.pattern));
    if (level === 1) return slot.m.includes(ex.primary);
    const groups = new Set(slot.m.map((m) => (WT.MUSCLES[m] || {}).group));
    return groups.has((WT.MUSCLES[ex.primary] || {}).group);
  }

  function scoreExercise(ex, slot, ctx, chosen, focused, jitter) {
    const why = [];
    let s = 10;
    const p = ctx.p;
    if (slot.tag && ex.tags.includes(slot.tag)) {
      s += 3;
    }
    const emph = ex.tags.filter((t) => ctx.emphasis.has(t));
    if (emph.length) {
      s += 1.5;
      why.push({ 'lower-chest': 'Lower-chest emphasis (your goal)', 'arm-size': 'Arm-size builder (your goal)', 'love-handles': 'Targets obliques / love handles (your goal)' }[emph[0]] || 'Matches your goals');
    }
    if (ctx.prioritize.has(ex.primary)) {
      s += 1.5;
      if (!emph.length) why.push(`${WT.muscleName(ex.primary)} is a priority muscle`);
    }
    if (ctx.favorites.has(ex.id)) {
      s += 2.5;
      why.push('One of your favorites');
    }
    if (ex.tags.includes('staple')) s += 1;
    if (slot.heavy && ex.intensities.includes('heavy')) s += 1.5;
    if (ex.tags.includes('spinal-load')) s -= 1.5;
    if (ex.tags.includes('back-friendly')) s += 0.5;
    if (ex.tags.includes('power') && !slot.cardio) s -= 2;
    const exp = p.experience;
    if (ex.difficulty === 'advanced' && exp !== 'advanced') s -= exp === 'beginner' ? 5 : 2;
    if (ex.difficulty === 'intermediate' && exp === 'beginner') s -= 1;
    ex.secondary.forEach((m) => {
      if (ctx.avoid.has(m)) s -= 2;
    });

    // Weekly volume deficit
    const target = WT.weeklyTarget(ex.primary);
    if (target) {
      const done = ctx.weekly[ex.primary] || 0;
      const deficit = WT.clamp((target - done) / target, -0.5, 1);
      s += deficit * 2;
      if (deficit > 0.6 && WT.db.history.length) why.push(`${WT.muscleName(ex.primary)} is behind on weekly volume (${WT.fmtNum(done)}/${target} sets)`);
    }
    // Recent fatigue (last 48h)
    const f = ctx.fatigue[ex.primary] || 0;
    if (f >= 3) {
      s -= Math.min(5, f / 2.5);
    }
    // Exercise recency
    const t = ctx.lastDone[ex.id];
    if (t) {
      const days = (Date.now() - t) / 864e5;
      if (days < 3) s -= 2;
      else {
        s += 0.75;
        why.push('Has history — progression tracked');
      }
    }
    // Overlap within this workout
    chosen.forEach((c) => {
      if (c.primary === ex.primary) s -= focused ? 0.4 : 2;
      if (c.pattern === ex.pattern) s -= focused ? 2.5 : 1.5;
      if (c.secondary.includes(ex.primary) || ex.secondary.includes(c.primary)) s -= 0.3;
      if (c.equipment.join() === ex.equipment.join() && focused) s -= 0.3;
      if (['row', 'lat'].some((st) => c.equipment.includes(st) && ex.equipment.includes(st))) s -= 2.5;
    });
    s += Math.random() * (jitter == null ? 2.5 : jitter);
    return { s, why };
  }

  function pickForSlot(slot, ctx, used, chosen, focused, jitter) {
    for (let level = 0; level <= 2; level++) {
      const cands = WT.exercises.filter((ex) => eligible(ex, ctx, used) && slotMatch(ex, slot, level));
      if (cands.length) {
        let best = null;
        cands.forEach((ex) => {
          const r = scoreExercise(ex, slot, ctx, chosen, focused, jitter);
          if (!best || r.s > best.s) best = { ex, s: r.s, why: r.why };
        });
        return best;
      }
    }
    return null;
  }

  /** Prescribe sets / reps / rest for an exercise at an intensity. */
  WT.prescribe = function (ex, intensity) {
    const p = WT.db.profile;
    const tt = WT.trackType(ex);
    if (!ex.intensities.includes(intensity)) intensity = WT.nearestIntensity(ex, intensity);
    const comp = ex.category === 'compound';
    let sets, repMin, repMax, rest, note = '';
    if (tt === 'cardio') return { intensity: 'standard', sets: 1, repMin: ex.repMin, repMax: ex.repMax, rest: 0, note: 'Minutes' };
    if (intensity === 'heavy') {
      sets = comp ? 4 : 3;
      if (tt === 'reps') {
        repMin = Math.max(3, ex.repMin - 2);
        repMax = Math.max(repMin + 2, ex.repMin + 1);
        note = 'Strict reps — add load if you exceed the range';
      } else if (tt === 'time') {
        repMin = ex.repMax;
        repMax = Math.round(ex.repMax * 1.3);
      } else {
        repMin = comp ? 5 : 6;
        repMax = 8;
        if (ex.unit === 'sec') {
          repMin = 20;
          repMax = 30;
        }
      }
      rest = comp ? p.rest.heavy : Math.round(p.rest.heavy * 0.8);
      note = note || 'Heavy — leave 1–2 reps in reserve';
    } else if (intensity === 'burnout') {
      sets = 2;
      if (tt === 'time') {
        repMin = ex.repMax;
        repMax = Math.round(ex.repMax * 1.5);
      } else {
        repMin = ex.repMax <= 15 ? 15 : 20;
        repMax = repMin + (repMin === 15 ? 5 : 10);
      }
      rest = p.rest.burnout;
      note = 'Burnout — final set close to failure';
    } else if (intensity === 'regular') {
      sets = 3;
      if (tt === 'weight' && ex.unit !== 'sec' && ex.repMin <= 12) {
        repMin = 8;
        repMax = 12;
      } else {
        repMin = ex.repMin;
        repMax = ex.repMax;
      }
      rest = comp ? p.rest.regular : Math.round((p.rest.regular * 0.75) / 5) * 5;
    } else {
      // standard — the exercise's own recommendation
      sets = ex.sets || 3;
      repMin = ex.repMin;
      repMax = ex.repMax;
      rest = Math.round(((ex.rest || 75) * p.rest.regular) / 90 / 5) * 5;
    }
    return { intensity, sets, repMin, repMax, rest, note };
  };

  function workSeconds(item) {
    const ex = WT.ex(item.exId);
    const tt = ex ? WT.trackType(ex) : 'weight';
    if (tt === 'cardio') return ((item.repMin + item.repMax) / 2) * 60;
    if (tt === 'time' || (ex && ex.unit === 'sec')) return (item.repMin + item.repMax) / 2 + 15;
    return Math.min(75, 15 + ((item.repMin + item.repMax) / 2) * 3);
  }
  WT.estimateMinutes = function (items) {
    let sec = 300; // warm-up
    const groups = groupBlocks(items);
    groups.forEach((g) => {
      const sets = Math.max(...g.map((i) => i.sets));
      const round = g.reduce((a, i) => a + workSeconds(i), 0) + (g.length > 1 ? 20 : 0);
      const rest = g[g.length - 1].rest || 0;
      sec += sets * round + Math.max(0, sets - 1) * rest + 60; // + setup / transition
    });
    return Math.round(sec / 60);
  };
  function groupBlocks(items) {
    const out = [];
    items.forEach((i) => {
      const last = out[out.length - 1];
      if (i.superset && last && last[0].superset === i.superset) last.push(i);
      else out.push([i]);
    });
    return out;
  }
  WT.groupBlocks = groupBlocks;

  const ANTAGONIST = { chest: ['back'], back: ['chest', 'shoulders'], shoulders: ['back', 'legs'], legs: ['shoulders', 'chest', 'back', 'arms'], core: ['arms', 'shoulders', 'chest', 'back', 'legs'] };
  function pairScore(a, b) {
    const ea = WT.ex(a.exId), eb = WT.ex(b.exId);
    if (!ea || !eb || ea.primary === eb.primary) return -1;
    if (ea.equipment.includes('lat') && eb.equipment.includes('lat')) return -1;
    if (ea.equipment.includes('row') && eb.equipment.includes('row')) return -1;
    const ga = WT.MUSCLES[ea.primary].group, gb = WT.MUSCLES[eb.primary].group;
    const pa = ea.primary, pb = eb.primary;
    if ((pa === 'biceps' && pb === 'triceps') || (pa === 'triceps' && pb === 'biceps')) return 5;
    if ((pa === 'quads' && pb === 'hamstrings') || (pa === 'hamstrings' && pb === 'quads')) return 4;
    if ((ga === 'chest' && gb === 'back') || (ga === 'back' && gb === 'chest')) return 4;
    if (ea.secondary.includes(pb) || eb.secondary.includes(pa)) return 0.5;
    if (ga !== gb && (ANTAGONIST[ga] || []).includes(gb)) return 3;
    if (ga !== gb) return 2;
    return 0.8; // same group, different muscle (e.g. side delt + rear delt)
  }

  /** Order exercises sensibly and (optionally) form supersets. Mutates items' superset field. */
  WT.arrange = function (items, supersets, type) {
    const rank = (i) => {
      const ex = WT.ex(i.exId);
      if (!ex) return 5;
      if (type === 'cardio') return ex.pattern === 'run' || ex.pattern === 'steady' ? 0 : 2;
      if (i.intensity === 'heavy') return ex.category === 'compound' ? 0 : 0.5;
      if (i.intensity === 'burnout') return 4;
      if (WT.region(ex) === 'core' && type !== 'core') return 3;
      return ex.category === 'compound' ? 1 : 2;
    };
    items.forEach((i) => (i.superset = null));
    const sorted = items.map((it, idx) => ({ it, idx })).sort((a, b) => rank(a.it) - rank(b.it) || a.idx - b.idx).map((x) => x.it);
    let blocks = sorted.map((i) => [i]);
    if (supersets && type !== 'cardio') {
      const pool = sorted.filter((i) => i.intensity !== 'heavy' && WT.trackType(WT.ex(i.exId) || {}) !== 'cardio');
      const paired = new Set();
      const pairs = [];
      pool.forEach((a, ai) => {
        if (paired.has(a.uid)) return;
        let best = null;
        pool.forEach((b, bi) => {
          if (bi <= ai || paired.has(b.uid)) return;
          if ((a.intensity === 'burnout') !== (b.intensity === 'burnout')) return;
          const sc = pairScore(a, b) - Math.abs(ai - bi) * 0.15;
          if (sc > 0 && (!best || sc > best.sc)) best = { b, sc };
        });
        if (best) {
          paired.add(a.uid);
          paired.add(best.b.uid);
          pairs.push([a, best.b]);
        }
      });
      blocks = [];
      sorted.forEach((i) => {
        if (!paired.has(i.uid)) blocks.push([i]);
        else {
          const pr = pairs.find((p) => p[0] === i);
          if (pr) blocks.push(pr);
        }
      });
      blocks.sort((a, b) => Math.min(...a.map(rank)) - Math.min(...b.map(rank)));
    }
    // Avoid back-to-back singles hitting the same primary muscle
    for (let k = 1; k < blocks.length - 1; k++) {
      const prev = WT.ex(blocks[k - 1][blocks[k - 1].length - 1].exId);
      const cur = WT.ex(blocks[k][0].exId);
      const nxt = WT.ex(blocks[k + 1][0].exId);
      if (prev && cur && nxt && prev.primary === cur.primary && nxt.primary !== cur.primary && rank(blocks[k][0]) === rank(blocks[k + 1][0]))
        [blocks[k], blocks[k + 1]] = [blocks[k + 1], blocks[k]];
    }
    let letter = 0;
    const out = [];
    const ssRest = WT.db.profile.rest.superset;
    blocks.forEach((b) => {
      if (b.length > 1) {
        const L = String.fromCharCode(65 + letter++);
        b.forEach((i, j) => {
          i.superset = L;
          if (j === b.length - 1) i.rest = Math.max(i.rest, ssRest);
        });
      }
      out.push(...b);
    });
    return out;
  };

  function fitDuration(items, duration) {
    if (!duration) return;
    let est = WT.estimateMinutes(items);
    // Too long: trim sets from the end (burnouts/isolations first), never below 2
    let guard = 0;
    while (est > duration + 3 && guard++ < 30) {
      const cand = items
        .slice()
        .reverse()
        .find((i) => i.sets > (i.intensity === 'heavy' ? 3 : 2) && WT.trackType(WT.ex(i.exId) || {}) !== 'cardio');
      if (!cand) break;
      cand.sets--;
      est = WT.estimateMinutes(items);
    }
    // Too short: add a set to compounds (max 4 / 5)
    guard = 0;
    while (est < duration - 10 && guard++ < 20) {
      const cand = items.find((i) => {
        const ex = WT.ex(i.exId);
        return ex && ex.category === 'compound' && i.sets < 4 && WT.trackType(ex) !== 'cardio';
      });
      if (!cand) break;
      cand.sets++;
      est = WT.estimateMinutes(items);
    }
  }

  /**
   * Generate a workout.
   * settings: see WT.defaultSettings. keep: optional array of locked items to preserve.
   */
  WT.generate = function (settings, keep) {
    settings = Object.assign(WT.defaultSettings(settings && settings.type), settings || {});
    const type = settings.type;
    const ctx = buildContext(settings);
    let n = settings.autoCount ? WT.clamp(Math.round((settings.duration - 5) / (settings.supersets ? 7.5 : 9)), 3, 10) : WT.clamp(+settings.count || 6, 1, 12);
    if (type === 'cardio') n = Math.min(n, 6);
    const focused = !['full', 'push', 'pull', 'legs', 'custom'].includes(type);
    const notes = [];

    // Rank slots: essentials first, then weight + priority bonus − fatigue penalty
    const tmpl = templateFor(type, settings.targets).map((s, i) => {
      let w = s.weight;
      if (!s.essential) {
        if (s.m.some((m) => ctx.prioritize.has(m))) w += 1.5;
        const fat = Math.max(...s.m.map((m) => ctx.fatigue[m] || 0));
        if (fat >= 8 && !focused) w -= 2.5;
        if (s.m.every((m) => ctx.avoid.has(m))) w -= 20;
      }
      return Object.assign({}, s, { rank: s.essential ? 100 - i : w, order: i });
    });
    let slots = tmpl.slice().sort((a, b) => b.rank - a.rank).slice(0, n);
    // Pad if more exercises requested than template slots
    let pad = 0;
    while (slots.length < n && pad < 20) {
      const base = tmpl[pad % tmpl.length];
      slots.push(Object.assign({}, base, { label: base.label + ' (extra)', p: null, essential: false, order: 100 + pad }));
      pad++;
    }
    slots.sort((a, b) => a.order - b.order);

    // Fatigue notes
    const hot = Object.entries(ctx.fatigue)
      .filter(([m, v]) => v >= 8 && m !== 'cardio')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (hot.length)
      notes.push(`Recently trained hard (last 48h): ${hot.map(([m, v]) => `${WT.muscleName(m)} (${WT.fmtNum(v)} sets)`).join(', ')}. Exercises for these muscles were de-prioritized.`);

    // Intensity plan
    const randomMode = settings.intensityMode !== 'manual';
    const plan = randomMode ? null : { heavy: +settings.heavy || 0, burnout: +settings.burnout || 0 };

    // Fill slots
    const used = new Set();
    const chosen = [];
    const items = [];
    const keepBySlot = {};
    (keep || []).forEach((k) => {
      if (k.slotIndex != null) keepBySlot[k.slotIndex] = k;
      used.add(k.exId);
    });
    slots.forEach((slot, idx) => {
      const kept = keepBySlot[idx];
      if (kept && WT.ex(kept.exId)) {
        chosen.push(WT.ex(kept.exId));
        items.push(Object.assign({}, kept, { slot: stripSlot(slot), slotIndex: idx }));
        return;
      }
      const pick = pickForSlot(slot, ctx, used, chosen, focused);
      if (!pick) return;
      used.add(pick.ex.id);
      chosen.push(pick.ex);
      items.push({ uid: WT.uid(), exId: pick.ex.id, slot: stripSlot(slot), slotIndex: idx, why: pick.why.slice(0, 2), locked: false });
    });
    // Locked items whose slot no longer exists → append
    (keep || []).forEach((k) => {
      if (!items.find((i) => i.uid === k.uid) && WT.ex(k.exId)) items.push(Object.assign({}, k));
    });

    if (randomMode) WT.randomizeIntensities(items, ctx);
    else assignIntensities(items, plan);
    items.forEach((i) => {
      if (i.locked && i.sets) return;
      Object.assign(i, WT.prescribe(WT.ex(i.exId), i.intensity));
    });
    let arranged = WT.arrange(items, settings.supersets, type);
    fitDuration(arranged, settings.duration);

    if (items.length < n) notes.push(`Only ${items.length} suitable exercises were found with your equipment and exclusions.`);
    const supersetCount = new Set(arranged.filter((i) => i.superset).map((i) => i.superset)).size;
    if (supersetCount) notes.push(`${supersetCount} superset${supersetCount > 1 ? 's' : ''} pair non-competing muscles to save time.`);

    return {
      id: WT.uid(),
      type,
      title: type === 'custom' ? 'Custom: ' + (settings.targets || []).map((t) => WT.CUSTOM_TARGETS[t]).join(', ') : WT.typeName(type),
      createdAt: new Date().toISOString(),
      settings,
      plan: WT.intensityTally(arranged),
      intensityMode: randomMode ? 'random' : 'manual',
      notes,
      exercises: arranged,
      estimatedMin: WT.estimateMinutes(arranged),
    };
  };
  WT.intensityTally = (items) => {
    const t = { heavy: 0, regular: 0, burnout: 0, standard: 0 };
    items.forEach((i) => (t[i.intensity] = (t[i.intensity] || 0) + 1));
    return t;
  };
  const stripSlot = (s) => ({ label: s.label, m: s.m, p: s.p, tag: s.tag, cardio: s.cardio, core: s.core, heavy: s.heavy });

  function assignIntensities(items, plan) {
    const fresh = items.filter((i) => !i.locked || !i.intensity);
    fresh.forEach((i) => (i.intensity = null));
    let heavyLeft = plan.heavy - items.filter((i) => i.locked && i.intensity === 'heavy').length;
    let burnLeft = plan.burnout - items.filter((i) => i.locked && i.intensity === 'burnout').length;
    const exOf = (i) => WT.ex(i.exId);
    // Heavy → heavy-capable, compounds first, earliest slot first
    fresh
      .filter((i) => exOf(i).intensities.includes('heavy'))
      .sort((a, b) => (exOf(b).category === 'compound') - (exOf(a).category === 'compound') || (b.slot && b.slot.heavy) - (a.slot && a.slot.heavy) || a.slotIndex - b.slotIndex)
      .forEach((i) => {
        if (heavyLeft > 0) {
          i.intensity = 'heavy';
          heavyLeft--;
        }
      });
    // Burnout → burnout-capable, isolations/bodyweight first, latest slot first
    fresh
      .filter((i) => !i.intensity && exOf(i).intensities.includes('burnout'))
      .sort((a, b) => (exOf(b).category !== 'compound') - (exOf(a).category !== 'compound') || b.slotIndex - a.slotIndex)
      .forEach((i) => {
        if (burnLeft > 0) {
          i.intensity = 'burnout';
          burnLeft--;
        }
      });
    fresh.forEach((i) => {
      if (!i.intensity) {
        const ex = exOf(i);
        i.intensity = ex.intensities.includes('regular') ? 'regular' : 'standard';
      }
    });
  }

  /** Alternatives for swapping an item in a workout. */
  WT.alternatives = function (workout, uid, opts) {
    opts = opts || {};
    const item = workout.exercises.find((e) => e.uid === uid);
    if (!item) return [];
    const cur = WT.ex(item.exId);
    const settings = Object.assign(WT.defaultSettings(workout.type), workout.settings || {});
    const ctx = buildContext(settings);
    const used = new Set(workout.exercises.map((e) => e.exId));
    const chosen = workout.exercises.filter((e) => e.uid !== uid).map((e) => WT.ex(e.exId)).filter(Boolean);
    const slot = item.slot || { m: [cur.primary], p: null };
    const focused = !['full', 'push', 'pull', 'legs', 'custom'].includes(workout.type);
    const out = [];
    WT.exercises.forEach((ex) => {
      if (!eligible(ex, ctx, used)) return;
      const level = slotMatch(ex, slot, 0) ? 0 : slotMatch(ex, slot, 1) || ex.primary === cur.primary ? 1 : slotMatch(ex, slot, 2) ? 2 : -1;
      if (level < 0 || (level === 2 && !opts.wide)) return;
      const r = scoreExercise(ex, slot, ctx, chosen, focused, 0);
      const loaded = (e) => !['bw', 'bwl', 'time', 'cardio'].includes(e.load);
      let bonus = loaded(ex) === loaded(cur) ? 1.5 : 0;
      if (item.intensity && ex.intensities.includes(item.intensity)) bonus += 1;
      out.push({ ex, score: r.s - level * 3 + bonus, level, why: r.why, samePattern: ex.pattern === cur.pattern });
    });
    return out.sort((a, b) => b.score - a.score);
  };

  /** Replace an exercise inside a workout/session item, keeping structure. */
  WT.applySwap = function (item, newExId) {
    const ex = WT.ex(newExId);
    item.exId = newExId;
    item.name = ex.name;
    const intensity = WT.nearestIntensity(ex, item.intensity || 'standard');
    const pr = WT.prescribe(ex, intensity);
    const keepSets = item.sets && typeof item.sets === 'number' ? item.sets : null;
    Object.assign(item, pr);
    if (keepSets && WT.trackType(ex) !== 'cardio') item.sets = keepSets;
    item.why = ['Swapped in'];
    return item;
  };

  /* ═════════════════════ SESSIONS ═════════════════════ */
  WT.sessionFromWorkout = function (w) {
    const now = new Date().toISOString();
    return {
      id: WT.uid(),
      type: w.type,
      title: w.title,
      startedAt: now,
      settings: w.settings || null,
      notes: '',
      exercises: w.exercises.map((i) => WT.sessionItem(i.exId, i)),
    };
  };
  WT.sessionItem = function (exId, base) {
    const ex = WT.ex(exId);
    const pr = base && base.repMin ? base : WT.prescribe(ex, ex.intensity);
    const nSets = pr.sets || 3;
    return {
      uid: WT.uid(),
      exId,
      name: ex.name,
      intensity: pr.intensity,
      targetSets: nSets,
      repMin: pr.repMin,
      repMax: pr.repMax,
      rest: pr.rest,
      superset: base ? base.superset || null : null,
      note: pr.note || '',
      notes: '',
      effort: null,
      skipped: false,
      sets: Array.from({ length: nSets }, () => ({ w: '', r: '', done: false })),
    };
  };
  /** Rebuild a workout draft from a past session (repeat / template). */
  WT.workoutFromSession = function (s) {
    return {
      id: WT.uid(),
      type: s.type,
      title: s.title,
      createdAt: new Date().toISOString(),
      settings: s.settings || WT.defaultSettings(s.type),
      notes: [`Based on your ${WT.fmtDate(s.startedAt)} session.`],
      exercises: s.exercises
        .filter((e) => WT.ex(e.exId))
        .map((e, idx) => ({
          uid: WT.uid(),
          exId: e.exId,
          intensity: e.intensity,
          sets: e.targetSets || Math.max(1, (e.sets || []).length),
          repMin: e.repMin,
          repMax: e.repMax,
          rest: e.rest,
          superset: e.superset || null,
          slot: { label: WT.muscleName(WT.ex(e.exId).primary), m: [WT.ex(e.exId).primary], p: null },
          slotIndex: idx,
          why: [],
        })),
    };
  };

  /** Finalise an active session → returns the saved session including PRs. */
  WT.finishSession = function (session) {
    const end = new Date();
    session.endedAt = end.toISOString();
    session.durationSec = Math.round((end - new Date(session.startedAt)) / 1000) - (session.pausedSec || 0);
    const prs = [];
    let sets = 0, volume = 0;
    session.exercises.forEach((e) => {
      const ex = WT.ex(e.exId);
      const tt = ex ? WT.trackType(ex) : 'weight';
      e.sets = (e.sets || []).filter((s) => s.done);
      if (!e.sets.length) e.skipped = true;
      if (e.skipped || !ex) return;
      const before = WT.personalRecords(e.exId, session.id);
      const m = sessionMetrics(e.sets.map((s) => ({ w: +s.w || 0, r: +s.r || 0, time: +s.time || 0, dist: +s.dist || 0 })), tt);
      sets += e.sets.length;
      volume += m.volume;
      if (before.count === 0) return; // first time = baseline, not a PR
      if (tt === 'cardio') return;
      if (m.topWeight > 0 && (!before.heaviest || m.topWeight > before.heaviest.w)) prs.push({ exId: e.exId, kind: 'Heaviest weight', value: `${WT.fmtNum(m.topWeight)} ${WT.db.profile.unit} × ${m.topReps}` });
      else if (m.e1rm > 0 && before.e1rm && m.e1rm > before.e1rm.v + 0.01) prs.push({ exId: e.exId, kind: 'Est. 1RM', value: `${WT.fmtNum(Math.round(m.e1rm))} ${WT.db.profile.unit}` });
      if ((tt === 'reps' || tt === 'time') && m.topWeight === 0 && before.reps && m.bestReps > before.reps.r)
        prs.push({ exId: e.exId, kind: tt === 'time' ? 'Longest hold' : 'Most reps', value: `${m.bestReps}${tt === 'time' ? 's' : ' reps'}` });
    });
    session.totals = { sets, volume: Math.round(volume) };
    session.prs = prs;
    return session;
  };

  /* ═════════════════════ STATISTICS ═════════════════════ */
  WT.stats = function () {
    const ss = WT.sessions();
    const now = new Date();
    const totalSets = ss.reduce((a, s) => a + s.exercises.reduce((b, e) => b + (e.skipped ? 0 : (e.sets || []).filter((x) => x.done).length), 0), 0);
    const totalVolume = ss.reduce((a, s) => a + s.exercises.reduce((b, e) => b + (e.sets || []).filter((x) => x.done).reduce((c, x) => c + (+x.w || 0) * (+x.r || 0), 0), 0), 0);
    const totalTime = ss.reduce((a, s) => a + (s.durationSec || 0), 0);
    // Weekly buckets (last 12 weeks)
    const weeks = [];
    const thisWeek = WT.startOfWeek(now);
    for (let i = 11; i >= 0; i--) {
      const start = new Date(thisWeek);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const inWeek = ss.filter((s) => new Date(s.startedAt) >= start && new Date(s.startedAt) < end);
      weeks.push({
        start,
        count: inWeek.length,
        strength: inWeek.filter((s) => s.type !== 'cardio').length,
        cardio: inWeek.filter((s) => s.type === 'cardio').length,
        volume: inWeek.reduce((a, s) => a + ((s.totals && s.totals.volume) || 0), 0),
        sets: inWeek.reduce((a, s) => a + ((s.totals && s.totals.sets) || 0), 0),
      });
    }
    const firstDate = ss.length ? new Date(ss[0].startedAt) : now;
    const weeksSpan = Math.max(1, Math.min(12, Math.ceil((now - WT.startOfWeek(firstDate)) / (7 * 864e5))));
    const recentWeeks = weeks.slice(-weeksSpan);
    const avgPerWeek = ss.length ? recentWeeks.reduce((a, w) => a + w.count, 0) / weeksSpan : 0;
    // Day map for consistency heatmap (last 20 weeks)
    const days = {};
    ss.forEach((s) => {
      const k = WT.startOfDay(s.startedAt).toDateString();
      days[k] = (days[k] || 0) + 1;
    });
    // Muscle-group sets last 30 days
    const groupSets = {};
    Object.keys(WT.GROUPS).forEach((g) => (groupSets[g] = 0));
    const muscleSets = WT.muscleLoad(24 * 30);
    Object.entries(muscleSets).forEach(([m, v]) => {
      const g = (WT.MUSCLES[m] || {}).group;
      if (g) groupSets[g] += v;
    });
    // Last trained per group
    const lastTrained = {};
    ss.forEach((s) =>
      s.exercises.forEach((e) => {
        const ex = WT.ex(e.exId);
        if (!ex || e.skipped || !(e.sets || []).some((x) => x.done)) return;
        const g = WT.MUSCLES[ex.primary].group;
        lastTrained[g] = s.startedAt;
      })
    );
    // Streak: consecutive weeks (ending this or last week) meeting strength goal
    const goal = WT.db.profile.strengthPerWeek || 3;
    let streak = 0;
    for (let i = weeks.length - 1; i >= 0; i--) {
      if (weeks[i].strength >= goal) streak++;
      else if (i === weeks.length - 1) continue;
      else break;
    }
    // All PRs (recent)
    const prs = [];
    ss.forEach((s) => (s.prs || []).forEach((p) => prs.push(Object.assign({ date: s.startedAt, sessionId: s.id }, p))));
    prs.reverse();
    return { count: ss.length, totalSets, totalVolume, totalTime, weeks, avgPerWeek, days, groupSets, muscleSets, lastTrained, streak, prs };
  };

  /** Exercises that have logged history, most frequent first. */
  WT.trackedExercises = function () {
    const counts = {};
    WT.db.history.forEach((s) =>
      s.exercises.forEach((e) => {
        if (!e.skipped && (e.sets || []).some((x) => x.done)) counts[e.exId] = (counts[e.exId] || 0) + 1;
      })
    );
    return Object.entries(counts)
      .filter(([id]) => WT.ex(id))
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => ({ ex: WT.ex(id), n }));
  };

  /** Suggest the next workout type based on recency of muscle groups. */
  WT.suggestNext = function () {
    const ss = WT.sessions();
    const p = WT.db.profile;
    if (!ss.length) return { type: p.preferredType, reason: 'Your preferred split — a great place to start.' };
    const last = ss[ss.length - 1];
    const hours = (Date.now() - new Date(last.endedAt || last.startedAt)) / 3600e3;
    if (p.preferredType === 'full') {
      if (hours < 20 && last.type === 'full') return { type: 'cardio', reason: 'You did a full-body session in the last day — a run or conditioning lets you recover.' };
      return { type: 'full', reason: 'Full body is your preferred split. Fatigue from recent sessions is factored into exercise choice.' };
    }
    const order = ['push', 'pull', 'legs'];
    const idx = order.indexOf(last.type);
    if (idx >= 0) return { type: order[(idx + 1) % 3], reason: `Next in your rotation after ${WT.typeName(last.type)}.` };
    return { type: p.preferredType, reason: 'Your preferred split.' };
  };
})();
