/* Engine: history, progressive overload, workout generation, statistics. Pure logic — no DOM. */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});

  /* ═════════════════════ HISTORY ═════════════════════ */
  WT.sessions = () => WT.db.history.slice().sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));

  const validSet = (s, tt) =>
    s && s.done && (tt === 'cardio' ? +s.time > 0 || +s.dist > 0 : tt === 'time' ? +s.r > 0 : +s.r > 0);

  /** 'drop' | 'buildup' for a multi-stage set, 'straight' for a plain set. */
  WT.setKind = (s) => (WT.isStagedSet(s) ? s.type : 'straight');
  WT.kindOf = (intensity) => (WT.STAGED[intensity] ? intensity : 'straight');

  /**
   * All completed performances of one exercise, oldest → newest.
   * kind (optional): 'straight' keeps only plain sets, 'drop' / 'buildup' only that kind of staged set,
   * so a drop set is never compared with plain sets as if its stages were separate sets.
   * Each entry's `sets` is flat ({w, r, …}); a stage carries g (its set's index) and k (stage index).
   * `groups` lists the staged sets as arrays of their stages.
   */
  WT.exerciseHistory = function (exId, excludeSessionId, kind) {
    const ex = WT.ex(exId);
    const tt = ex ? WT.trackType(ex) : 'weight';
    const out = [];
    WT.sessions().forEach((s) => {
      if (s.id === excludeSessionId) return;
      s.exercises.forEach((e) => {
        if (e.exId !== exId || e.skipped) return;
        const sets = [], groups = [];
        let g = 0, gtype = null;
        (e.sets || []).forEach((x) => {
          if (kind && WT.setKind(x) !== kind) return;
          if (WT.isStagedSet(x)) {
            if (!x.done) return;
            const parts = x.stages.filter((st) => validSet(st, tt)).map((st, k) => ({ w: +st.w || 0, r: +st.r || 0, time: 0, dist: 0, g, k, tr: +st.tr || null }));
            if (!parts.length) return;
            parts.forEach((p) => sets.push(p));
            parts.type = x.type;
            groups.push(parts);
            gtype = gtype || x.type;
            g++;
          } else if (validSet(x, tt)) sets.push({ w: +x.w || 0, r: +x.r || 0, time: +x.time || 0, dist: +x.dist || 0 });
        });
        if (!sets.length) return;
        const nSets = groups.length + sets.filter((x) => x.g == null).length;
        out.push({
          date: s.endedAt || s.startedAt,
          sessionId: s.id,
          sets,
          groups,
          kind: !groups.length ? 'straight' : sets.some((x) => x.g == null) ? 'mixed' : gtype,
          intensity: e.intensity,
          repMin: e.repMin,
          repMax: e.repMax,
          targetSets: e.targetSets || nSets,
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
    const u = WT.db.profile.unit;
    plan = plan || { repMin: ex.repMin, repMax: ex.repMax, sets: ex.sets, intensity: ex.intensity };
    if (WT.STAGED[plan.intensity] && WT.canStage(ex)) return recommendStaged(ex, plan, excludeSessionId);
    // Plain sets are compared only with plain sets: stages of a drop/build-up set are not separate sets.
    const hist = WT.exerciseHistory(exId, excludeSessionId, 'straight');

    if (!hist.length && tt === 'weight') {
      const staged = WT.exerciseHistory(exId, excludeSessionId).filter((h) => h.groups.length);
      const e = stagedE1rm(staged);
      if (e > 0) {
        const w = WT.snapLoad(ex, e / (1 + plan.repMax / 30));
        return {
          action: 'new',
          weight: w,
          reps: `${plan.repMin}–${plan.repMax}`,
          headline: `${WT.fmtNum(w)} ${u} × ${plan.repMin}–${plan.repMax}`,
          reasons: [`No plain sets logged yet. From your drop/build-up sets your estimated 1-rep max is ~${WT.fmtNum(Math.round(e))} ${u}.`, `${WT.fmtNum(w)} ${u} should land you in the ${plan.repMin}–${plan.repMax} range — adjust after the first set.`],
        };
      }
    }

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
        headline: `Last: ${m.time ? WT.fmtRunTime(m.time) : '—'}${m.dist ? ' · ' + WT.fmtNum(m.dist) + ' mi' : ''}`,
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

    // Weighted exercise — look at several recent sessions, not just the last one.
    const recentH = hist.filter((h) => WT.daysBetween(h.date, new Date()) <= 56).slice(-4);
    const fmtH = (h) => {
      const tw = h.metrics.topWeight;
      return `${WT.fmtDate(h.date, { month: 'short', day: 'numeric' })}: ${WT.fmtNum(tw)}×${h.sets.filter((x) => x.w === tw).map((x) => x.r).join(',')}`;
    };
    const histLine = recentH.length > 1 ? `Recent sessions — ${recentH.slice(-3).map(fmtH).join(' · ')}.` : null;
    const withHist = (r) => {
      if (histLine && !r.reasons.includes(histLine)) r.reasons.push(histLine);
      r.history = recentH.slice(-3).map((h) => ({ date: h.date, sets: h.sets.filter((x) => x.w === h.metrics.topWeight).map((x) => ({ w: x.w, r: x.r })) }));
      return r;
    };
    const hardRecent = recentH.slice(-3).filter((h) => h.effort === 'hard').length;
    const prevNearTop = prev && prev.metrics.topWeight === topW && WT.daysBetween(prev.date, last.date) <= 21 && (() => {
      const ps = prev.sets.filter((x) => x.w === topW);
      return ps.length >= targetSets && ps.reduce((a, x) => a + x.r, 0) / ps.length >= (prev.repMax || lastMax) - 1;
    })();
    const declining = recentH.length >= 3 && recentH.slice(-3).every((h, i, a) => i === 0 || h.metrics.e1rm < a[i - 1].metrics.e1rm - 0.01);
    const stale = days > 21; // a 3-week-old comparison is a check-in, not a basis for adding load
    if (allTop && hardRecent >= 2)
      return withHist({ action: 'hold', weight: topW, headline: `Repeat ${WT.fmtNum(topW)} ${u}`, reasons: [`You reached the top of the range ${when} (${lastStr}), but rated this exercise hard in ${hardRecent} of your last ${Math.min(3, recentH.length)} sessions.`, 'Hold the weight until it feels solid — consistent hard ratings mean the load is already challenging.'], basis });
    if (allTop && !hard) {
      const step = WT.stepLoad(ex, topW, +1, exceeded);
      if (step.capped)
        return withHist({
          action: 'reps',
          weight: topW,
          headline: `Stay at ${WT.fmtNum(topW)} ${u} — add reps or tempo`,
          reasons: [`You hit ${lastMax}+ reps on all sets ${when} (${lastStr}), but ${WT.fmtNum(topW)} ${u} is your heaviest available ${ex.load === 'db' ? 'dumbbell' : 'load'}.`, 'Progress with 1–2 more reps per set, a 3-second lowering phase, a pause at the stretch, or an extra set.'],
          basis,
        });
      // One good day isn't enough: add weight only when it's confirmed — the session before was also at (or one
      // rep from) the top at this weight, you rated it easy, or every set clearly overshot the range.
      const confirmed = prevTop || prevNearTop || easy || exceeded;
      if (!confirmed || stale)
        return withHist({
          action: 'hold',
          weight: topW,
          reps: `${lastMax}`,
          repTargets: workSets.map(() => lastMax).slice(0, targetSets),
          headline: `Repeat ${WT.fmtNum(topW)} ${u} — confirm ${lastMax} reps`,
          reasons: stale
            ? [`You hit the top of the range last time (${lastStr}), but that was ${days} days ago.`, 'Repeat the weight as a check-in; if it still feels this good, the next session adds load.']
            : [`You hit the top of the ${lastMin}–${lastMax} range on every set ${when} (${lastStr}).`, `Match it once more at ${WT.fmtNum(topW)} ${u}. Two sessions at the top confirm you're ready — weight isn't raised on a single good day.`],
          basis,
        });
      const inc = WT.round(step.w - topW, 2);
      // Realistic dumbbell jumps: when the next dumbbell is a big relative jump on upper-body work, earn it with reps first.
      const jump = inc / Math.max(1, topW);
      const bestReps = Math.min(...workSets.map((x) => x.r));
      if (ex.load === 'db' && WT.region(ex) !== 'lower' && jump > 0.2 && bestReps < lastMax + 2)
        return withHist({
          action: 'reps',
          weight: topW,
          reps: `${lastMax + 2}`,
          repTargets: workSets.map(() => lastMax + 2).slice(0, targetSets),
          headline: `Stay at ${WT.fmtNum(topW)} ${u} — build to ${lastMax + 2} reps`,
          reasons: [`You're at the top of the range (${lastStr}). The next dumbbell, ${WT.fmtNum(step.w)} ${u}, is a ${Math.round(jump * 100)}% jump.`, `Build to ${lastMax + 2} reps on every set first so the heavier dumbbell lands back in range.`],
          basis,
        });
      const reasons = [`You completed all ${workSets.length} sets at the top of the ${lastMin}–${lastMax} range ${when} (${lastStr}).`];
      if (prevTop || prevNearTop) reasons.push('Your previous session at this weight was there too — the progress is consistent.');
      else if (exceeded) reasons.push(`Every set went at least 3 reps past ${lastMax}, so the weight is clearly light for this range.`);
      if (easy) reasons.push('You also rated it easy.');
      reasons.push(`Add ${WT.fmtNum(inc)} ${u}${ex.load === 'db' ? ' (next available dumbbell)' : ''} and expect reps to drop toward ${lastMin}–${lastMin + 2}; build back up from there.`);
      return withHist({ action: 'increase', weight: step.w, reps: `${lastMin}–${lastMax}`, headline: `${WT.fmtNum(step.w)} ${u} × ${lastMin}–${lastMax}`, delta: inc, reasons, basis });
    }
    if (allTop && hard)
      return withHist({ action: 'hold', weight: topW, headline: `Repeat ${WT.fmtNum(topW)} ${u}`, reasons: [`You hit every rep ${when} (${lastStr}) but rated it a grind. Repeat it once more so it feels solid before adding weight.`], basis });

    if (easy && allMin && avgReps >= (lastMin + lastMax) / 2 && prev && prev.effort === 'easy' && !stale) {
      const step = WT.stepLoad(ex, topW, +1);
      if (!step.capped)
        return withHist({
          action: 'increase',
          weight: step.w,
          reps: `${lastMin}–${lastMax}`,
          headline: `${WT.fmtNum(step.w)} ${u} × ${lastMin}–${lastMax}`,
          delta: WT.round(step.w - topW, 2),
          reasons: [`You rated this easy two sessions running (latest ${lastStr}, averaging ${WT.fmtNum(avgReps)} reps).`, `A small jump to ${WT.fmtNum(step.w)} ${u} is reasonable.`],
          basis,
        });
    }
    if (declining && !allMin) {
      const step = WT.stepLoad(ex, topW, -1);
      return withHist({
        action: 'decrease',
        weight: step.w,
        reps: `${lastMin}–${lastMax}`,
        headline: `Ease to ${WT.fmtNum(step.w)} ${u} × ${lastMin}–${lastMax}`,
        reasons: [`Your last three sessions have trended down (latest ${lastStr}).`, `A lighter session at ${WT.fmtNum(step.w)} ${u} lets you recover and rebuild; sleep and food matter as much as load.`],
        basis,
      });
    }

    if (allMin) {
      const targets = repTargets(workSets.map((x) => x.r), lastMin, lastMax, targetSets);
      return withHist({
        action: 'hold',
        weight: topW,
        reps: targets.join(', '),
        repTargets: targets,
        headline: `Maintain ${WT.fmtNum(topW)} ${u} — aim for ${targets.join(', ')}`,
        reasons: [`Last time ${when}: ${lastStr}. Every set was in the ${lastMin}–${lastMax} range, but not all at the top.`, `Keep the weight and bring each set up by about a rep. Once all ${targetSets} sets reach ${lastMax}, the next step is a weight increase.`],
        basis,
      });
    }

    // Struggled
    if (prevStruggled) {
      const step = WT.stepLoad(ex, topW, -1);
      return withHist({
        action: 'decrease',
        weight: step.w,
        reps: `${lastMin}–${lastMax}`,
        headline: `Drop to ${WT.fmtNum(step.w)} ${u} × ${lastMin}–${lastMax}`,
        reasons: [`You fell short of ${lastMin} reps at ${WT.fmtNum(topW)} ${u} in your last two sessions (latest: ${repsStr}).`, `Drop to ${WT.fmtNum(step.w)} ${u}, own the full range for a couple of sessions, then build back up.`],
        basis,
      });
    }
    const targets = repTargets(workSets.map((x) => x.r), lastMin, lastMax, targetSets).map((r) => Math.max(lastMin, r));
    return withHist({
      action: 'hold',
      weight: topW,
      reps: targets.join(', '),
      repTargets: targets,
      headline: `Maintain ${WT.fmtNum(topW)} ${u} — aim for ${targets.join(', ')}`,
      reasons: [`Last time ${when}: ${lastStr} — some sets fell short of ${lastMin} reps${workSets.length < targetSets ? ` and only ${workSets.length} of ${targetSets} sets were completed` : ''}.`, 'Repeat this weight and aim to hit the minimum on every set. If it happens again, the app will suggest backing off.'],
      basis,
    });
  };

  /**
   * Estimated 1RM from staged sets, using only fresh stages: the first stage of a drop set (later
   * stages are pre-fatigued) and every stage of a build-up set.
   */
  function stagedE1rm(entries) {
    let e = 0;
    entries.forEach((h) => h.groups.forEach((grp) => {
      (grp.type === 'buildup' ? grp : grp.slice(0, 1)).forEach((st) => (e = Math.max(e, WT.e1rm(st.w, st.r))));
    }));
    return e;
  }

  /** Default rep target for each stage. Drop: steady reps (last stage a little higher). Build-up: reps fall as load rises. */
  WT.stageReps = function (kind, n, repMin, repMax) {
    const out = [];
    for (let k = 0; k < n; k++) {
      if (kind === 'buildup') out.push(n === 1 ? repMax : Math.round(repMax - ((repMax - repMin) * k) / (n - 1)));
      else out.push(k > 0 && k === n - 1 ? Math.min(repMax, repMin + 2) : repMin);
    }
    return out;
  };
  /** Next stage's load: drop sets go ~20% lighter (at least one step), build-up sets one step heavier. */
  WT.stageLoad = function (ex, w, kind) {
    w = +w || 0;
    if (!(w > 0)) return '';
    if (kind === 'buildup') return WT.stepLoad(ex, w, +1).w;
    let x = w;
    for (let i = 0; i < 8; i++) {
      const nx = WT.stepLoad(ex, x, -1).w;
      if (nx >= x) break;
      x = nx;
      if (x <= w * 0.8 + 1e-6) break;
    }
    return x < w ? x : '';
  };

  /**
   * Progression for drop / build-up sets. Compares each stage with the SAME stage of the last set of
   * the same kind (stage 1 with stage 1, stage 2 with stage 2…): a stage that beat its rep target by
   * 2+ reps moves up one load step; otherwise it holds. Loads stay ordered (drop: each stage
   * lighter; build-up: each heavier). Returns per-stage targets in `stages: [{w, r}]`.
   */
  function recommendStaged(ex, plan, excludeSessionId) {
    const kind = plan.intensity;
    const info = WT.STAGED[kind];
    const u = WT.db.profile.unit;
    const n = Math.max(1, plan.stages || 3);
    const reps = WT.stageReps(kind, n, plan.repMin, plan.repMax);
    const same = WT.exerciseHistory(ex.id, excludeSessionId, kind);
    const last = same[same.length - 1];
    const order = (ws) => {
      for (let k = 1; k < ws.length; k++) {
        if (!(ws[k - 1] > 0)) continue;
        const ok = kind === 'drop' ? ws[k] > 0 && ws[k] < ws[k - 1] : ws[k] > ws[k - 1];
        if (!ok) ws[k] = WT.stageLoad(ex, ws[k - 1], kind) || ws[k];
      }
      return ws;
    };
    const fmtW = (ws) => ws.map((w) => WT.fmtNum(w)).join(' → ') + ' ' + u;

    if (last) {
      const days = WT.daysBetween(last.date, new Date());
      const when = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
      const grp = last.groups[0];
      const hard = last.effort === 'hard';
      const reasons = [];
      let up = 0, held = 0;
      const ws = [];
      const rs = [];
      for (let k = 0; k < n; k++) {
        const st = grp[k];
        const tr = (st && st.tr) || reps[k];
        rs.push(tr);
        if (!st) {
          ws.push(k ? WT.stageLoad(ex, ws[k - 1], kind) || 0 : 0);
          continue;
        }
        if (days > 28) {
          ws.push(st.w);
          held++;
        } else if (st.r >= tr + 2 && !hard) {
          // Clearly beat the stage's target (like reaching the top of a rep range) → one load step
          const step = WT.stepLoad(ex, st.w, +1);
          ws.push(step.capped ? st.w : step.w);
          if (!step.capped) {
            up++;
            reasons.push(`Stage ${k + 1}: ${WT.fmtNum(st.w)} ${u} × ${st.r} beat the ${tr}-rep target → ${WT.fmtNum(step.w)} ${u}.`);
          } else {
            held++;
            reasons.push(`Stage ${k + 1}: ${WT.fmtNum(st.w)} ${u} is your heaviest available load — add reps instead.`);
          }
        } else {
          ws.push(st.w);
          held++;
          reasons.push(
            st.r >= tr
              ? `Stage ${k + 1}: ${WT.fmtNum(st.w)} ${u} × ${st.r} hit the target — stay here; ${tr + 2}+ reps moves it up.`
              : `Stage ${k + 1}: ${WT.fmtNum(st.w)} ${u} × ${st.r} — stay here and aim for ${tr} reps.`
          );
        }
      }
      order(ws);
      const done = grp.length;
      const lastStr = grp.map((st) => `${WT.fmtNum(st.w)}×${st.r}`).join(' → ');
      reasons.unshift(`Last ${info.name.toLowerCase()} ${when}: ${lastStr}${done < n ? ` (${done} of ${n} stages)` : ''}. Each stage is compared with the same stage last time.`);
      if (days > 28) reasons.push(`It's been ${days} days, so start at last time's loads.`);
      if (hard) reasons.push('You rated it hard, so loads hold this time.');
      return {
        action: up ? 'increase' : 'hold',
        kind,
        stages: ws.map((w, k) => ({ w: w > 0 ? w : null, r: rs[k] })),
        weight: ws[0] > 0 ? ws[0] : null,
        headline: `${info.name}: ${fmtW(ws.filter((w) => w > 0))}`,
        reasons,
        basis: { date: last.date, sets: last.sets, days },
      };
    }

    // No set of this kind yet: start from the best estimate of strength available.
    const all = WT.exerciseHistory(ex.id, excludeSessionId);
    let e = 0;
    all.forEach((h) => h.sets.forEach((st) => st.g == null && (e = Math.max(e, WT.e1rm(st.w, st.r)))));
    if (!e) e = stagedE1rm(all.filter((h) => h.groups.length));
    if (e > 0) {
      const ws = [];
      if (kind === 'drop') {
        ws.push(WT.snapLoad(ex, e / (1 + reps[0] / 30)));
        for (let k = 1; k < n; k++) ws.push(WT.stageLoad(ex, ws[k - 1], kind) || 0);
      } else {
        // build-up: top stage near a hard set for its reps, earlier stages from the same estimate
        for (let k = 0; k < n; k++) ws.push(WT.snapLoad(ex, (e / (1 + reps[k] / 30)) * (k === n - 1 ? 0.95 : 0.85)));
        order(ws);
      }
      return {
        action: 'new',
        kind,
        stages: ws.map((w, k) => ({ w: w > 0 ? w : null, r: reps[k] })),
        weight: ws[0] > 0 ? ws[0] : null,
        headline: `${info.name}: ${fmtW(ws.filter((w) => w > 0))}`,
        reasons: [`First ${info.name.toLowerCase()} for this exercise. Loads are estimated from your best set (~${WT.fmtNum(Math.round(e))} ${u} 1-rep max).`, `${info.verb}; reps ${reps.join(', ')}.`],
      };
    }
    return {
      action: 'new',
      kind,
      stages: reps.map((r) => ({ w: null, r })),
      weight: null,
      headline: 'Find your starting weight',
      reasons: [`No history yet. ${info.verb} (${info.rest}); aim for ${reps.join(', ')} reps. This first ${info.name.toLowerCase()} becomes the baseline.`],
    };
  }

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
    drop: { name: 'Drop set', reps: '3 stages', text: 'Each set runs through stages at decreasing weight with little or no rest. Counts as one set.' },
    buildup: { name: 'Build-up set', reps: '3 stages', text: 'Each set climbs through stages at increasing weight, reps falling as the load rises. Rest between stages as needed.' },
  };
  /** Every set type a user can choose. Generation still only draws from WT.INTENSITIES. */
  WT.SET_TYPES = ['heavy', 'regular', 'burnout', 'standard', 'drop', 'buildup'];
  /** Drop / build-up sets need a load to change: weighted, rep-based exercises only. */
  WT.canStage = (ex) => !!ex && WT.trackType(ex) === 'weight' && ex.unit !== 'sec';

  /** Every set type the generator may draw automatically (drop / build-up only on weighted exercises). */
  WT.AUTO_TYPES = ['heavy', 'regular', 'burnout', 'standard', 'drop', 'buildup'];
  /** Fatigue-heavy techniques: these are budgeted together so a workout never stacks too many. */
  WT.TECHNIQUES = ['heavy', 'burnout', 'drop', 'buildup'];

  /**
   * Movements where piling on fatigue (a burnout or drop set) costs technique before it builds muscle:
   * spinal loading, explosive work, free-weight squats / hinges / lunges, and advanced compound lifts.
   */
  WT.fatigueRisky = function (ex) {
    if (!ex) return true;
    if (ex.tags.includes('spinal-load') || ex.tags.includes('power') || ex.pattern === 'plyo') return true;
    if (['hinge', 'squat', 'lunge'].includes(ex.pattern) && ['db', 'bb', 'kb'].includes(ex.load)) return true;
    if (ex.category === 'compound' && (ex.load === 'bb' || ex.difficulty === 'advanced')) return true;
    return false;
  };

  /** Relative odds of each eligible intensity for one exercise (0 = not allowed). */
  WT.intensityWeights = function (ex, opts) {
    opts = opts || {};
    const p = WT.db.profile;
    const odds = p.intensityOdds || {};
    const comp = ex.category === 'compound';
    const tt = WT.trackType(ex);
    const pos = opts.position;
    const w = {};
    ex.intensities.forEach((k) => {
      let v = Math.max(0, +odds[k] || 0);
      if (k === 'heavy') {
        v *= comp ? 1 : 0.35; // heavy loading belongs on compounds
        if (tt !== 'weight') v *= 0.6; // bodyweight / timed work is called "heavy" less often
        if (ex.difficulty === 'advanced') v *= 0.6;
        if (p.experience === 'beginner') v *= 0.5;
        if (opts.fatigued) v *= 0.4; // muscle hammered in the last 48h
        if (pos != null) v *= pos < 0.5 ? 1.25 : 0.7; // early in the session → heavier
      } else if (k === 'burnout') {
        if (!p.burnouts) v = 0;
        v *= comp ? 0.35 : 1; // burnouts favour safer isolation / bodyweight work
        if (ex.tags.includes('spinal-load')) v = 0;
        // A near-failure set on a loaded squat, hinge or barbell compound adds injury risk for little gain
        else if (WT.fatigueRisky(ex) && tt === 'weight') v = 0;
        if (pos != null) v *= pos >= 0.5 ? 1.3 : 0.6; // finishers come late
      }
      w[k] = v;
    });
    // Drop and build-up sets: only weighted, rep-based exercises (they need a load to change).
    if (WT.canStage(ex)) {
      const beginner = p.experience === 'beginner';
      let d = Math.max(0, +odds.drop || 0);
      if (d) {
        if (WT.fatigueRisky(ex)) d = 0; // stripping weight to failure on these compromises technique
        d *= comp ? 0.25 : 1; // isolation work first
        if (ex.load === 'cable' || ex.load === 'machine') d *= 1.3; // quick, safe weight changes
        if (pos != null) d *= pos >= 0.5 ? 1.5 : 0.25; // end of the workout
        if (opts.fatigued) d *= 0.5;
        if (beginner) d *= 0.3;
        w.drop = d;
      }
      let b = Math.max(0, +odds.buildup || 0);
      if (b) {
        if (ex.tags.includes('power') || ex.pattern === 'plyo') b = 0;
        if (ex.tags.includes('spinal-load')) b *= 0.5;
        b *= comp ? 1 : 0.35; // pyramids suit compound lifts
        if (ex.difficulty === 'advanced') b *= 0.6;
        if (pos != null) b *= pos < 0.6 ? 1.2 : 0.4; // early-to-middle, while fresh
        if (opts.fatigued) b *= 0.5;
        if (beginner) b *= 0.4;
        w.buildup = b;
      }
    }
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

  /** Per-workout limits so techniques are balanced rather than stacked. */
  WT.intensityCaps = function (n) {
    return {
      heavy: Math.max(1, Math.ceil(n / 2)),
      burnout: Math.max(1, Math.ceil(n / 3)),
      drop: 1,
      buildup: 1,
      staged: n >= 7 ? 2 : 1, // drop + build-up together
      techniques: Math.max(2, Math.ceil(n * 0.6)), // heavy + burnout + drop + build-up together
    };
  };
  const tallyKey = (items) => WT.AUTO_TYPES.map((k) => items.filter((i) => i.intensity === k).length).join('/');

  /**
   * Independently randomise intensities for a list of workout items (locked items keep theirs).
   * Each draw is weighted by suitability (position, compound vs isolation, fatigue, safety), then capped so
   * one workout never piles up techniques. If the result repeats the pattern of BOTH of your last two
   * workouts of this type, it's drawn again (up to a few times) so sessions don't settle into a template.
   */
  WT.randomizeIntensities = function (items, ctx, rnd) {
    const n = items.length;
    const cap = WT.intensityCaps(n);
    const avoid = (ctx && ctx.recentTallies) || [];
    const fixed = items.filter((i) => i.locked && i.intensity);
    const draw = () => {
      const used = { heavy: 0, burnout: 0, drop: 0, buildup: 0 };
      fixed.forEach((i) => used[i.intensity] != null && used[i.intensity]++);
      const order = WT.shuffle(items.filter((i) => !(i.locked && i.intensity)));
      order.forEach((i) => {
        const ex = WT.ex(i.exId);
        const pos = n > 1 ? items.indexOf(i) / (n - 1) : 0;
        const fatigued = ctx && ctx.fatigue ? (ctx.fatigue[ex.primary] || 0) >= 8 : false;
        const w = WT.intensityWeights(ex, { position: i.slot && i.slot.heavy ? 0 : pos, fatigued });
        const tech = used.heavy + used.burnout + used.drop + used.buildup;
        ['heavy', 'burnout', 'drop', 'buildup'].forEach((k) => used[k] >= cap[k] && (w[k] = 0));
        if (used.drop + used.buildup >= cap.staged) w.drop = w.buildup = 0;
        if (tech >= cap.techniques) WT.TECHNIQUES.forEach((k) => (w[k] = 0));
        i.intensity = drawWeighted(w, rnd);
        if (used[i.intensity] != null) used[i.intensity]++;
      });
    };
    draw();
    for (let t = 0; avoid.length >= 2 && t < 3 && avoid.every((a) => a === tallyKey(items)); t++) draw();
    return items;
  };

  /** Default counts for manual (non-random) mode. */
  function autoIntensity(type, n) {
    const f = WT.db.profile.intensityFixed || { heavy: 2, burnout: 1 };
    const heavy = Math.min(n, type === 'cardio' ? 0 : +f.heavy || 0);
    const burnout = Math.min(n - heavy, type === 'cardio' ? 0 : +f.burnout || 0);
    const drop = Math.min(n - heavy - burnout, type === 'cardio' ? 0 : +f.drop || 0);
    const buildup = Math.min(n - heavy - burnout - drop, type === 'cardio' ? 0 : +f.buildup || 0);
    return { heavy, burnout, drop, buildup, regular: Math.max(0, n - heavy - burnout - drop - buildup) };
  }
  WT.autoIntensity = autoIntensity;

  /** Closest allowed intensity when an exercise can't take the requested one (used by swaps). */
  WT.nearestIntensity = function (ex, want) {
    if (WT.STAGED[want]) return WT.canStage(ex) ? want : ex.intensities.includes('regular') ? 'regular' : 'standard';
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
      drop: +(p.intensityFixed || {}).drop || 0,
      buildup: +(p.intensityFixed || {}).buildup || 0,
      prioritize: p.prioritize.slice(),
      avoidMuscles: p.avoidMuscles.slice(),
      supersets: p.supersets,
      targets: ['chest', 'biceps', 'triceps'],
    };
  };

  /** Context (fatigue, weekly volume, exercise / pattern recency, progress, learned habits) used by scoring. */
  function buildContext(settings) {
    const p = WT.db.profile;
    const now = Date.now();
    const fatigue = WT.muscleLoad(48);
    const weekly = WT.muscleLoad(24 * 7);
    const lastDone = {}, patternLast = {}, exCount14 = {}, muscleLast = {};
    WT.db.history.forEach((s) => {
      const t = new Date(s.endedAt || s.startedAt).getTime();
      s.exercises.forEach((e) => {
        if (e.skipped || !(e.sets || []).some((x) => x.done)) return;
        if (!lastDone[e.exId] || lastDone[e.exId] < t) lastDone[e.exId] = t;
        const ex = WT.ex(e.exId);
        if (ex && (!patternLast[ex.pattern] || patternLast[ex.pattern] < t)) patternLast[ex.pattern] = t;
        if (ex && (!muscleLast[ex.primary] || muscleLast[ex.primary] < t)) muscleLast[ex.primary] = t;
        if (now - t < 14 * 864e5) exCount14[e.exId] = (exCount14[e.exId] || 0) + 1;
      });
    });
    const trends = {};
    const adapt = p.adaptive !== false ? WT.adaptStats() : null;
    // Intensity patterns of the last two workouts of this type (so a third in a row can be avoided)
    const sameType = WT.sessions().filter((s) => s.type === settings.type && s.plan).slice(-2);
    return {
      p,
      settings,
      now,
      fatigue,
      weekly,
      lastDone,
      patternLast,
      muscleLast,
      exCount14,
      hasHistory: WT.db.history.length > 0,
      trend: (id) => (trends[id] !== undefined ? trends[id] : (trends[id] = WT.progressTrend(id))),
      adapt,
      recentTallies: sameType.map((s) => WT.AUTO_TYPES.map((k) => +s.plan[k] || 0).join('/')),
      equipment: settings.equipment || p.equipment,
      prioritize: new Set(settings.prioritize || p.prioritize),
      avoid: new Set(settings.avoidMuscles || p.avoidMuscles),
      excluded: new Set(p.excluded),
      favorites: new Set(p.favorites),
      emphasis: new Set(p.emphasisTags || []),
    };
  }
  WT.buildContext = buildContext;

  /**
   * Is the user progressing on an exercise? Looks at up to the last 4 plain-set sessions in the past 10 weeks.
   * 'up' — estimated strength (or best reps for bodyweight work) rose across them; 'down' — it fell;
   * 'flat' — no real change; null — not enough recent history to tell.
   */
  WT.progressTrend = function (exId) {
    const ex = WT.ex(exId);
    if (!ex || WT.trackType(ex) === 'cardio') return null;
    const h = WT.exerciseHistory(exId, null, 'straight').filter((x) => WT.daysBetween(x.date, new Date()) <= 70).slice(-4);
    if (h.length < 3) return null;
    const v = h.map((x) => (x.metrics.e1rm > 0 ? x.metrics.e1rm : x.metrics.bestReps));
    const first = v[0], last = v[v.length - 1];
    const rises = v.slice(1).filter((x, i) => x > v[i] + 1e-6).length;
    const falls = v.slice(1).filter((x, i) => x < v[i] - 1e-6).length;
    if (last > first * 1.02 && rises >= falls + 1) return 'up';
    if (last < first * 0.97 && falls >= rises + 1) return 'down';
    return 'flat';
  };

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

  /**
   * Score one candidate for a slot. Returns { s, why } where `why` holds short, human reasons ordered by
   * importance — never the raw arithmetic.
   */
  function scoreExercise(ex, slot, ctx, chosen, focused, jitter) {
    const reasons = []; // [priority, text]
    const why = (pr, t) => reasons.push([pr, t]);
    let s = 10;
    const p = ctx.p;
    const now = ctx.now || Date.now();
    if (slot.tag && ex.tags.includes(slot.tag)) {
      s += 3;
    }
    const emph = ex.tags.filter((t) => ctx.emphasis.has(t));
    if (emph.length) {
      s += 1.5;
      why(3, { 'lower-chest': 'Lower-chest emphasis (your goal)', 'arm-size': 'Arm-size builder (your goal)', 'love-handles': 'Targets obliques / love handles (your goal)' }[emph[0]] || 'Matches your goals');
    }
    if (ctx.prioritize.has(ex.primary)) {
      s += 1.5;
      if (!emph.length) why(2, `${WT.muscleName(ex.primary)} is a priority muscle`);
    }
    if (ctx.favorites.has(ex.id)) {
      s += 2.5;
      why(3.5, 'One of your favorites');
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

    // Weekly volume: muscles that are behind get a boost, muscles already at target step aside
    const target = WT.weeklyTarget(ex.primary);
    if (target) {
      const done = ctx.weekly[ex.primary] || 0;
      const deficit = WT.clamp((target - done) / target, -0.5, 1);
      s += deficit * 2.5;
      if (deficit > 0.5 && ctx.hasHistory) why(5, `${WT.muscleName(ex.primary)} is due for more weekly volume (${WT.fmtNum(done)} of ${target} sets)`);
    }
    // Recent fatigue (last 48h)
    const f = ctx.fatigue[ex.primary] || 0;
    if (f >= 3) {
      s -= Math.min(5, f / 2.5);
    }
    if (!slot.cardio && ctx.hasHistory) {
      // Movement pattern recency: rotate patterns across the week rather than repeating yesterday's
      const pt = ctx.patternLast && ctx.patternLast[ex.pattern];
      const pdays = pt ? (now - pt) / 864e5 : null;
      if (pdays != null && pdays < 2) s -= 1.2;
      else if (pdays != null && pdays >= 7) s += 0.6;
      // Exercise recency and frequency
      const t = ctx.lastDone[ex.id];
      const n14 = (ctx.exCount14 && ctx.exCount14[ex.id]) || 0;
      // Done a lot lately — let something else have a turn. Capped, and halved for favorites, so an exercise you
      // love is rotated rather than shut out.
      // (Not stacked on top of the "done in the last 3 days" penalty below — that already covers it.)
      const recentlyDone = t && (now - t) / 864e5 < 3;
      if (n14 >= 3 && !recentlyDone) s -= Math.min(2.5, (n14 - 1) * 1) * (ctx.favorites.has(ex.id) ? 0.5 : 1);
      if (t) {
        const days = (now - t) / 864e5;
        if (days < 3) s -= 2;
        else {
          s += 0.75;
          if (days >= 10) why(2.5, 'This exercise hasn’t appeared in your recent workouts');
        }
      }
      // Progress: keep what's working in rotation; a long stall makes room for a variation
      const tr = ctx.trend ? ctx.trend(ex.id) : null;
      if (tr === 'up') {
        s += 1.5;
        why(4, 'You’ve made consistent progress on this exercise');
      } else if (tr === 'down') s -= 0.5;
      // Learned behaviour: repeatedly skipped / removed → suggested less; reliably completed → kept
      const ad = ctx.adapt && ctx.adapt.ex[ex.id];
      if (ad) {
        if (ad.penalty) s -= ad.penalty;
        if (ad.completed >= 3 && !ad.penalty) s += 0.5;
      }
    }
    // Overlap within this workout: avoid two exercises that do essentially the same job
    chosen.forEach((c) => {
      if (c.primary === ex.primary) s -= focused ? 0.4 : 2;
      if (c.pattern === ex.pattern) s -= focused ? 2.5 : 1.5;
      if (!focused && c.primary === ex.primary && c.pattern === ex.pattern) s -= 3; // near-duplicate
      if (focused && c.pattern === ex.pattern && c.equipment.join() === ex.equipment.join()) s -= 1;
      if (c.secondary.includes(ex.primary) || ex.secondary.includes(c.primary)) s -= 0.3;
      if (c.equipment.join() === ex.equipment.join() && focused) s -= 0.3;
      if (['row', 'lat'].some((st) => c.equipment.includes(st) && ex.equipment.includes(st))) s -= 2.5;
    });
    s += Math.random() * (jitter == null ? 1.2 : jitter);
    return { s, why: reasons.sort((a, b) => b[0] - a[0]).map((r) => r[1]) };
  }

  /**
   * Choose an exercise for a slot. Rather than always taking the single top score, it samples among the
   * candidates close to the best (weighted toward the best), so effective choices dominate while workouts
   * still vary from one generation to the next.
   */
  function pickForSlot(slot, ctx, used, chosen, focused, jitter) {
    for (let level = 0; level <= 2; level++) {
      const cands = WT.exercises.filter((ex) => eligible(ex, ctx, used) && slotMatch(ex, slot, level));
      if (cands.length) {
        const scored = cands.map((ex) => Object.assign({ ex }, scoreExercise(ex, slot, ctx, chosen, focused, jitter))).sort((a, b) => b.s - a.s);
        const best = scored[0].s;
        const pool = scored.filter((x) => x.s >= best - 1.5).slice(0, 4);
        const weights = pool.map((x) => Math.exp((x.s - best) / 0.8));
        let r = Math.random() * weights.reduce((a, x) => a + x, 0);
        for (let k = 0; k < pool.length; k++) {
          r -= weights[k];
          if (r <= 0) return pool[k];
        }
        return pool[0];
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
    if (WT.STAGED[intensity]) {
      // Only reached when canStage(ex) — nearestIntensity() maps unsuitable exercises to regular.
      if (intensity === 'drop')
        return { intensity, sets: 2, stageCount: 3, stageRest: 0, repMin: 8, repMax: 12, rest: comp ? p.rest.heavy : p.rest.regular, note: 'Drop set — lower the weight each stage, little or no rest' };
      return { intensity, sets: 2, stageCount: 3, stageRest: 60, repMin: 6, repMax: 12, rest: comp ? p.rest.heavy : p.rest.regular, note: 'Build-up set — add weight each stage, rest as needed' };
    }
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
    const one = Math.min(75, 15 + ((item.repMin + item.repMax) / 2) * 3);
    if (WT.STAGED[item.intensity]) {
      const k = item.stageCount || 3;
      return k * (one - 5) + (k - 1) * ((item.stageRest || 0) + 10); // a staged set runs its stages back to back
    }
    return one;
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
      if (i.intensity === 'burnout' || i.intensity === 'drop') return 4;
      if (i.intensity === 'buildup') return ex.category === 'compound' ? 0.75 : 1.5;
      if (WT.region(ex) === 'core' && type !== 'core') return 3;
      return ex.category === 'compound' ? 1 : 2;
    };
    items.forEach((i) => (i.superset = null));
    const sorted = items.map((it, idx) => ({ it, idx })).sort((a, b) => rank(a.it) - rank(b.it) || a.idx - b.idx).map((x) => x.it);
    let blocks = sorted.map((i) => [i]);
    if (supersets && type !== 'cardio') {
      const pool = sorted.filter((i) => i.intensity !== 'heavy' && !WT.STAGED[i.intensity] && WT.trackType(WT.ex(i.exId) || {}) !== 'cardio');
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

  const listJoin = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  WT.listJoin = listJoin;
  /** How much a slot's muscles still need this week: 1 = nothing done yet, 0 = at target, < 0 = past it. */
  function slotNeed(muscles, ctx) {
    const vals = muscles.map((m) => {
      const t = WT.weeklyTarget(m);
      return t ? WT.clamp((t - (ctx.weekly[m] || 0)) / t, -0.5, 1) : 0;
    });
    return vals.length ? vals.reduce((a, x) => a + x, 0) / vals.length : 0;
  }
  const FAMILY = { chest: 'push', 'front-delts': 'push', 'side-delts': 'push', triceps: 'push', lats: 'pull', 'upper-back': 'pull', 'rear-delts': 'pull', biceps: 'pull', traps: 'pull', quads: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs', adductors: 'legs' };
  const MAIN_GROUPS = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];
  /**
   * Week-level picture used for workout selection and explanations: which groups are behind (`due`),
   * already covered (`covered`), still recovering (`recovering`), and what the last session emphasized.
   */
  WT.trainingAnalysis = function (ctx) {
    ctx = ctx || { weekly: WT.muscleLoad(24 * 7), fatigue: WT.muscleLoad(48) };
    const groups = {};
    MAIN_GROUPS.forEach((g) => (groups[g] = { done: 0, target: 0, fatigue: 0 }));
    Object.keys(WT.MUSCLES).forEach((m) => {
      const g = WT.MUSCLES[m].group;
      if (!groups[g]) return;
      groups[g].done += ctx.weekly[m] || 0;
      groups[g].target += WT.weeklyTarget(m);
      groups[g].fatigue = Math.max(groups[g].fatigue, ctx.fatigue[m] || 0);
    });
    const ratio = (g) => (groups[g].target ? groups[g].done / groups[g].target : 1);
    const due = MAIN_GROUPS.filter((g) => ratio(g) < 0.5 && groups[g].fatigue < 8).sort((a, b) => ratio(a) - ratio(b));
    const covered = MAIN_GROUPS.filter((g) => ratio(g) >= 1);
    const recovering = MAIN_GROUPS.filter((g) => groups[g].fatigue >= 8).sort((a, b) => groups[b].fatigue - groups[a].fatigue);
    // Emphasis of the most recent strength session (within 4 days): push / pull / legs if one took ≥ 55% of the sets
    let lastEmphasis = null;
    const last = WT.sessions().filter((x) => x.type !== 'cardio').slice(-1)[0];
    if (last && Date.now() - new Date(last.endedAt || last.startedAt) < 4 * 864e5) {
      const fam = { push: 0, pull: 0, legs: 0 };
      let tot = 0;
      last.exercises.forEach((e) => {
        const ex = WT.ex(e.exId);
        const n = e.skipped ? 0 : (e.sets || []).filter((x) => x.done).length;
        if (!ex || !n) return;
        tot += n;
        if (FAMILY[ex.primary]) fam[FAMILY[ex.primary]] += n;
      });
      const top = Object.entries(fam).sort((a, b) => b[1] - a[1])[0];
      if (tot >= 6 && top[1] / tot >= 0.55) lastEmphasis = top[0];
    }
    return { groups, due, covered, recovering, lastEmphasis, familyOf: (m) => FAMILY[m] || null };
  };

  /* ───────── Adaptive learning (all on-device) ─────────
   * Signals: exercises skipped in finished workouts, exercises removed or swapped out of a plan before
   * starting (WT.recordDrop), workout types picked instead of the suggestion, actual vs planned duration and
   * how much of each plan was completed. Every signal needs repetition — one skipped exercise or one odd
   * session changes nothing.
   */
  WT.recordDrop = function (exId) {
    if (!exId || !WT.db.learn) return;
    const d = WT.db.learn.dropped;
    d[exId] = (d[exId] || []).concat(new Date().toISOString()).slice(-10);
  };
  let adaptCache = null;
  WT.adaptStats = function () {
    const h = WT.db.history;
    const key = h.length + ':' + (h.length ? h[h.length - 1].id + (h[h.length - 1].endedAt || '') : '') + ':' + JSON.stringify((WT.db.learn || {}).dropped || {}).length;
    if (adaptCache && adaptCache.key === key && adaptCache.db === WT.db) return adaptCache.v;
    const now = Date.now();
    const W = 60 * 864e5;
    const ex = {};
    const get = (id) => (ex[id] = ex[id] || { seen: 0, skipped: 0, dropped: 0, completed: 0, penalty: 0 });
    const ss = WT.sessions();
    ss.filter((s) => now - new Date(s.startedAt) < W).forEach((s) =>
      s.exercises.forEach((e) => {
        const r = get(e.exId);
        r.seen++;
        const done = (e.sets || []).filter((x) => x.done).length;
        if (e.skipped || !done) r.skipped++;
        else if (done >= (e.targetSets || done)) r.completed++;
      })
    );
    Object.entries(((WT.db.learn || {}).dropped) || {}).forEach(([id, list]) => {
      const n = (list || []).filter((t) => now - new Date(t) < W).length;
      if (n) get(id).dropped += n;
    });
    Object.values(ex).forEach((r) => {
      const misses = r.skipped + r.dropped;
      // At least two misses before anything changes, scaled by how often it's missed when offered
      if (misses >= 2) r.penalty = WT.round(Math.min(4, (misses / (r.seen + r.dropped)) * 4 + (misses - 2) * 0.25), 2);
    });
    // Workout types chosen over the suggestion (last 8 sessions that recorded a suggestion)
    const withSug = ss.filter((s) => s.meta && s.meta.suggested && s.type !== 'cardio').slice(-8);
    const overrides = {};
    withSug.forEach((s) => s.type !== s.meta.suggested && (overrides[s.type] = (overrides[s.type] || 0) + 1));
    const pref = Object.entries(overrides).sort((a, b) => b[1] - a[1])[0];
    const preferredType = pref && pref[1] >= 3 && pref[1] / withSug.length >= 0.4 ? pref[0] : null;
    // Duration and completion of recent strength sessions
    const recent = ss.filter((s) => s.type !== 'cardio' && s.durationSec > 0 && !(s.meta && s.meta.source === 'run')).slice(-6);
    const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)] : null);
    const actualMin = recent.length >= 4 ? med(recent.map((s) => s.durationSec / 60)) : null;
    const planned = recent.filter((s) => s.meta && s.meta.plannedSets > 0);
    const completion = planned.length >= 3 ? planned.reduce((a, s) => a + Math.min(1, ((s.totals && s.totals.sets) || 0) / s.meta.plannedSets), 0) / planned.length : null;
    const v = { ex, preferredType, overrides, actualMin, completion, samples: recent.length };
    adaptCache = { key, db: WT.db, v };
    return v;
  };
  /** Suggested session length from what you actually complete; null when there's no consistent signal. */
  WT.suggestedDuration = function () {
    const p = WT.db.profile;
    if (p.adaptive === false) return null;
    const a = WT.adaptStats();
    const def = +p.defaultDuration || 60;
    let est = null;
    if (a.actualMin != null && a.actualMin < def * 0.8) est = a.actualMin;
    if (a.completion != null && a.completion < 0.75) est = Math.min(est || def, def * Math.max(0.6, a.completion + 0.1));
    if (est == null) return null;
    const opts = [30, 45, 60, 75, 90];
    const pick = opts.reduce((b, o) => (Math.abs(o - est) < Math.abs(b - est) ? o : b), opts[0]);
    return pick < def ? pick : null;
  };

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

    const analysis = WT.trainingAnalysis(ctx);
    const balance = type === 'full' && ctx.hasHistory; // full body: balance across the week, not every muscle every time
    // Rank slots: essentials first, then weight + priority bonus + weekly need − fatigue penalty
    const tmpl = templateFor(type, settings.targets).map((s, i) => {
      let w = s.weight;
      let essential = s.essential;
      const need = slotNeed(s.m, ctx);
      const fat = Math.max(...s.m.map((m) => ctx.fatigue[m] || 0));
      // Days since any of this slot's muscles was last a main target (Infinity if never)
      const since = Math.min(...s.m.map((m) => (ctx.muscleLast[m] ? (ctx.now - ctx.muscleLast[m]) / 864e5 : Infinity)));
      // A full-body essential (squat / press / pull) can step aside while its muscles are still recovering, or
      // when they already have the week's volume AND were trained in the last 3 days. Once recovered it comes
      // back — a big session must not keep a muscle out of full-body plans for the rest of the week.
      if (balance && essential && (fat >= 8 || (need <= 0 && since < 3))) {
        essential = false;
        w -= 3;
      }
      if (!essential) {
        if (s.m.some((m) => ctx.prioritize.has(m))) w += 1.5;
        if (ctx.hasHistory) w += need * 3;
        // Rotation: muscles that haven't been a main target for a while come around, even when every area is behind
        if (balance && since >= 6) w += since >= 10 ? 3.5 : 2;
        if (fat >= 8 && !focused) w -= 2.5;
        if (balance && analysis.lastEmphasis && s.m.every((m) => analysis.familyOf(m) === analysis.lastEmphasis)) w -= 1.5;
        if (s.m.every((m) => ctx.avoid.has(m))) w -= 20;
      }
      return Object.assign({}, s, { essential, rank: essential ? 100 - i : w, order: i });
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

    // Short explanations of the session as a whole
    if (ctx.hasHistory) {
      const inPlan = (g) => slots.some((sl) => sl.m.some((m) => (WT.MUSCLES[m] || {}).group === g));
      const due = analysis.due.filter(inPlan).slice(0, 2);
      if (due.length) notes.push(`${listJoin(due.map((g) => WT.GROUPS[g]))} ${due.length > 1 ? 'are' : 'is'} due for more weekly volume.`);
      if (analysis.recovering.length) notes.push(`Your ${listJoin(analysis.recovering.slice(0, 2).map((g) => WT.GROUPS[g].toLowerCase()))} may benefit from more recovery.`);
      if (balance && analysis.lastEmphasis) notes.push(`Your last session emphasized ${analysis.lastEmphasis === 'legs' ? 'legs' : analysis.lastEmphasis + 'ing movements'}, so this one leans elsewhere.`);
      const covered = analysis.covered.filter((g) => !inPlan(g)).slice(0, 2);
      if (balance && covered.length) notes.push(`${listJoin(covered.map((g) => WT.GROUPS[g]))} already ${covered.length > 1 ? 'have' : 'has'} enough work this week.`);
    }

    // Intensity plan
    const randomMode = settings.intensityMode !== 'manual';
    const plan = randomMode ? null : { heavy: +settings.heavy || 0, burnout: +settings.burnout || 0, drop: +settings.drop || 0, buildup: +settings.buildup || 0 };

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
      generated: true,
      suggested: settings.suggested || null,
      notes,
      exercises: arranged,
      estimatedMin: WT.estimateMinutes(arranged),
    };
  };
  WT.intensityTally = (items) => {
    const t = { heavy: 0, regular: 0, burnout: 0, standard: 0, drop: 0, buildup: 0 };
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
    // Build-up → stageable compounds early on; drop → stageable, lower-risk isolation late.
    let buildLeft = (+plan.buildup || 0) - items.filter((i) => i.locked && i.intensity === 'buildup').length;
    fresh
      .filter((i) => !i.intensity && WT.canStage(exOf(i)) && !exOf(i).tags.includes('power'))
      .sort((a, b) => (exOf(b).category === 'compound') - (exOf(a).category === 'compound') || a.slotIndex - b.slotIndex)
      .forEach((i) => {
        if (buildLeft > 0) {
          i.intensity = 'buildup';
          buildLeft--;
        }
      });
    let dropLeft = (+plan.drop || 0) - items.filter((i) => i.locked && i.intensity === 'drop').length;
    fresh
      .filter((i) => !i.intensity && WT.canStage(exOf(i)) && !WT.fatigueRisky(exOf(i)))
      .sort((a, b) => (exOf(b).category !== 'compound') - (exOf(a).category !== 'compound') || b.slotIndex - a.slotIndex)
      .forEach((i) => {
        if (dropLeft > 0) {
          i.intensity = 'drop';
          dropLeft--;
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
      // What was planned — lets recommendations learn from what actually happens (stays on this device)
      meta: { source: w.source || (w.generated ? 'generated' : 'plan'), suggested: w.suggested || null, plannedSets: w.exercises.reduce((a, i) => a + (+i.sets || +i.targetSets || 0), 0), plannedMin: w.estimatedMin || null },
      plan: w.generated ? WT.intensityTally(w.exercises) : undefined,
    };
  };
  /** A new, empty set for an exercise item: plain, or staged with one empty stage per planned stage. */
  WT.newSet = function (item, stageCount) {
    if (!WT.STAGED[item.intensity]) return { w: '', r: '', done: false };
    const n = Math.max(1, stageCount || item.stageCount || 3);
    const reps = WT.stageReps(item.intensity, n, item.repMin, item.repMax);
    return { type: item.intensity, done: false, stages: reps.map((tr) => ({ w: '', r: '', tr, done: false })) };
  };
  WT.sessionItem = function (exId, base) {
    const ex = WT.ex(exId);
    const pr = base && base.repMin ? base : WT.prescribe(ex, ex.intensity);
    const nSets = pr.sets || 3;
    const staged = WT.STAGED[pr.intensity] ? { stageCount: pr.stageCount || 3, stageRest: pr.stageRest != null ? pr.stageRest : WT.prescribe(ex, pr.intensity).stageRest } : {};
    const item = Object.assign({
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
    }, staged);
    item.sets = Array.from({ length: nSets }, () => WT.newSet(item));
    return item;
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
          ...(WT.STAGED[e.intensity] ? { stageCount: e.stageCount || Math.max(1, ...(e.sets || []).map((x) => (x.stages || []).length)), stageRest: e.stageRest != null ? e.stageRest : 0 } : {}),
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
      // A staged set keeps only the stages actually performed (sequences can end early).
      e.sets.forEach((s) => WT.isStagedSet(s) && (s.stages = s.stages.filter((st) => st.done)));
      e.sets = e.sets.filter((s) => !Array.isArray(s.stages) || s.stages.length);
      if (!e.sets.length) e.skipped = true;
      if (e.skipped || !ex) return;
      const before = WT.personalRecords(e.exId, session.id);
      const parts = [];
      e.sets.forEach((s) => WT.setParts(s).forEach((x) => parts.push(x)));
      const m = sessionMetrics(parts.map((s) => ({ w: +s.w || 0, r: +s.r || 0, time: +s.time || 0, dist: +s.dist || 0 })), tt);
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
    const totalVolume = ss.reduce((a, s) => a + s.exercises.reduce((b, e) => b + (e.sets || []).filter((x) => x.done).reduce((c, x) => c + WT.setVolume(x), 0), 0), 0);
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

  /** Does a session contain a logged run? */
  WT.isRunSession = (s) => !!s && s.exercises.some((e) => !e.skipped && WT.ex(e.exId) && WT.ex(e.exId).tags.includes('run') && (e.sets || []).some((x) => x.done));
  WT.isStrengthSession = (s) => !!s && s.type !== 'cardio' && !WT.isRunSession(s);

  const SPLIT_MUSCLES = {
    push: ['chest', 'front-delts', 'side-delts', 'triceps'],
    pull: ['lats', 'upper-back', 'rear-delts', 'biceps'],
    legs: ['quads', 'hamstrings', 'glutes', 'calves'],
    full: ['chest', 'lats', 'upper-back', 'quads', 'glutes', 'hamstrings', 'side-delts', 'biceps', 'triceps', 'abs'],
  };

  /**
   * What to do next — strength (and which type), a run, or recovery — from the whole recent picture:
   * weekly strength / run goals, consecutive training days, muscles still recovering, weekly volume per muscle,
   * the order of recent sessions, and learned habits (types you pick instead of the suggestion, how long your
   * sessions really run). Returns { type, kind: 'strength' | 'run' | 'recovery', reason, reasons, duration }.
   * `type` is always something the generator can build, so "Generate" keeps working on every kind.
   */
  WT.suggestNext = function () {
    const ss = WT.sessions();
    const p = WT.db.profile;
    const pref = p.preferredType || 'full';
    const duration = WT.suggestedDuration ? WT.suggestedDuration() : null;
    const out = (o) => Object.assign({ reasons: [], duration }, o);
    if (!ss.length) return out({ type: pref, kind: 'strength', reason: 'Your preferred split — a great place to start.' });
    const now = Date.now();
    const t = (s) => new Date(s.endedAt || s.startedAt).getTime();
    // Weekly goals use the calendar week (Mon–Sun), exactly like Home's "This week" counts
    const weekStart = WT.startOfWeek(new Date()).getTime();
    const week = ss.filter((s) => new Date(s.startedAt).getTime() >= weekStart);
    const strength7 = week.filter(WT.isStrengthSession).length;
    const runs7 = week.filter(WT.isRunSession).length;
    const lastStrength = ss.filter(WT.isStrengthSession).slice(-1)[0];
    const hoursSinceStrength = lastStrength ? (now - t(lastStrength)) / 3600e3 : Infinity;
    // Consecutive days trained, ending today or yesterday
    const days = new Set(ss.map((s) => WT.startOfDay(s.startedAt).getTime()));
    let streak = 0;
    const d0 = WT.startOfDay(new Date());
    if (!days.has(d0.getTime())) d0.setDate(d0.getDate() - 1);
    while (days.has(d0.getTime())) {
      streak++;
      d0.setDate(d0.getDate() - 1);
    }
    const trainedToday = days.has(WT.startOfDay(new Date()).getTime());
    const goalS = +p.strengthPerWeek || 3, goalR = +p.runsPerWeek || 0;
    const ctx = { weekly: WT.muscleLoad(24 * 7), fatigue: WT.muscleLoad(48) };
    const an = WT.trainingAnalysis(ctx);
    const readiness = (type) => {
      const ms = SPLIT_MUSCLES[type];
      if (!ms) return 0;
      return ms.reduce((a, m) => {
        const tg = WT.weeklyTarget(m) || 1;
        return a + WT.clamp((tg - (ctx.weekly[m] || 0)) / tg, -0.5, 1) - ((ctx.fatigue[m] || 0) >= 6 ? 0.8 : 0);
      }, 0) / ms.length;
    };
    const runsBehind = goalR > 0 && runs7 < goalR;
    const strengthBehind = strength7 < goalS;
    const groupList = (gs) => WT.listJoin(gs.map((g) => WT.GROUPS[g]));

    // 1. Recovery: several days in a row, or a hard day already done today
    if (streak >= 4 || (streak >= 3 && !strengthBehind)) {
      return out({ type: pref, kind: 'recovery', reason: `You've trained ${streak} days in a row. A rest day or an easy walk will help you come back stronger.`, reasons: an.recovering.length ? [`${groupList(an.recovering)} ${an.recovering.length > 1 ? 'are' : 'is'} still recovering.`] : [] });
    }
    // 2. Run: runs are behind and legs/lungs are the better use of today
    if (runsBehind && (hoursSinceStrength < 22 || !strengthBehind || (goalR - runs7) >= (goalS - strength7))) {
      const why = hoursSinceStrength < 22 ? 'You lifted in the last day — a run keeps you moving while your muscles recover.' : !strengthBehind ? `You've done your ${goalS} workouts this week.` : 'Runs are furthest behind this week.';
      return out({ type: 'cardio', kind: 'run', reason: `${why} ${runs7} of ${goalR} runs this week.` });
    }
    // 3. Weekly goals met → optional session, nothing is due
    if (!strengthBehind && !runsBehind) {
      return out({ type: pref, kind: 'recovery', reason: `You've met this week's goals (${strength7} workouts${goalR ? `, ${runs7} runs` : ''}). Rest, or train lightly if you feel like it.` });
    }
    // 4. A strength session. Full-body heavy day less than a day ago → recover first.
    if (hoursSinceStrength < 20 && lastStrength.type === 'full' && pref === 'full') {
      return out({ type: goalR ? 'cardio' : pref, kind: goalR ? 'run' : 'recovery', reason: 'You did a full-body session in the last day — a run, conditioning or rest lets you recover.' });
    }
    let type = pref;
    const reasons = [];
    let reason;
    if (['push', 'pull', 'legs'].includes(pref)) {
      // Rotate by readiness (muscles behind for the week and recovered), not blindly by order
      const cands = ['push', 'pull', 'legs'].map((k) => ({ k, r: readiness(k) - (lastStrength && lastStrength.type === k ? 1 : 0) })).sort((x, y) => y.r - x.r);
      type = cands[0].k;
      reason = `${WT.typeName(type)} muscles are the most recovered and furthest behind this week.`;
    } else if (pref === 'full') {
      reason = an.due.length ? `${groupList(an.due.slice(0, 2))} ${an.due.length > 1 ? 'are' : 'is'} due for more weekly volume — the plan leans that way.` : 'Full body is your preferred split. The plan balances muscles across your week.';
      if (an.recovering.length) reasons.push(`Your ${groupList(an.recovering.slice(0, 2)).toLowerCase()} may benefit from more recovery.`);
    } else reason = 'Your preferred split.';
    // Learned preference: a type you keep choosing instead of the suggestion (needs 3+ times)
    const ad = p.adaptive !== false ? WT.adaptStats() : null;
    if (ad && ad.preferredType && ad.preferredType !== type && WT.WORKOUT_TYPES.some((x) => x.id === ad.preferredType)) {
      const ms = SPLIT_MUSCLES[ad.preferredType];
      const hot = ms && ms.some((m) => (ctx.fatigue[m] || 0) >= 8);
      if (!hot) {
        type = ad.preferredType;
        reason = `You've often chosen ${WT.typeName(type)} over the suggestion, so Forge suggests it.`;
      }
    }
    if (duration) reasons.push(`Your recent workouts run about ${duration} minutes, so the plan is sized to fit.`);
    if (trainedToday) reasons.push('You already trained today — keep it short if you go again.');
    return out({ type, kind: 'strength', reason, reasons });
  };
})();
