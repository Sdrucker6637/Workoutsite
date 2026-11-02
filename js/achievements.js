/* Achievements: quiet milestones for consistency, progress and exploration.
 *
 * Every achievement is computed from data you actually logged (workouts, runs, food). Each evaluator returns
 * { value, target, at } — `at` is the moment the threshold was really crossed (e.g. the date of your 10th
 * workout), so dates are never invented. The first time achievements are checked, anything already earned
 * is recorded as "reached before achievements were tracked" (retro) — it keeps its real date, but there's
 * no celebration and it's labelled honestly. Nothing rewards extra sessions per day, extreme volume, very
 * low calories or protein far above target.
 */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const A = (WT.ach = WT.ach || {});

  A.CATS = { consistency: 'Consistency', strength: 'Strength', running: 'Running', variety: 'Variety', nutrition: 'Nutrition' };

  /* ───────── Helpers over logged data ───────── */
  const iso = (d) => new Date(d).toISOString();
  const when = (s) => s.endedAt || s.startedAt;
  /** Workouts = sessions with at least one completed exercise that isn't a run (runs count separately). */
  const workouts = () =>
    WT.sessions().filter((s) => s.exercises.some((e) => {
      const ex = WT.ex(e.exId);
      return ex && !e.skipped && !ex.tags.includes('run') && (e.sets || []).some((x) => x.done);
    }));
  const runs = () =>
    WT.sessions()
      .map((s) => {
        let dist = 0, time = 0;
        s.exercises.forEach((e) => {
          const ex = WT.ex(e.exId);
          if (!ex || e.skipped || !ex.tags.includes('run')) return;
          (e.sets || []).forEach((x) => {
            if (!x.done) return;
            dist += +x.dist || 0;
            time += +x.time || 0;
          });
        });
        return dist > 0 || time > 0 ? { s, dist, time, at: when(s) } : null;
      })
      .filter(Boolean);
  /** The nth item's date (1-based) or null. */
  const nth = (list, n, dateOf) => (list.length >= n ? iso(dateOf(list[n - 1])) : null);
  const count = (list, n, dateOf) => ({ value: Math.min(list.length, n), target: n, at: nth(list, n, dateOf) });

  /**
   * Weeks (Mon–Sun) in a row meeting your weekly workout goal (from Settings — so the goal is yours, and doing
   * more than it earns nothing extra). The current week can still be in progress, so it never breaks a streak.
   * `at` is the date of the session that completed the n-th week.
   */
  function weekStreak(n) {
    const goal = Math.max(1, +WT.db.profile.strengthPerWeek || 3);
    const ss = workouts();
    if (!ss.length) return { value: 0, target: n, at: null };
    const byWeek = new Map();
    ss.forEach((s) => {
      const k = WT.startOfWeek(s.startedAt).getTime();
      if (!byWeek.has(k)) byWeek.set(k, []);
      byWeek.get(k).push(s);
    });
    const thisWeek = WT.startOfWeek(new Date()).getTime();
    const wk = WT.startOfWeek(ss[0].startedAt);
    let run = 0, at = null;
    for (let guard = 0; wk.getTime() <= thisWeek && guard < 2000; guard++) {
      const k = wk.getTime();
      const list = byWeek.get(k) || [];
      if (list.length >= goal) {
        run++;
        if (run >= n && !at) at = iso(when(list[goal - 1]));
      } else if (k !== thisWeek) run = 0;
      wk.setDate(wk.getDate() + 7); // calendar step: safe across daylight-saving changes
    }
    return { value: at ? n : Math.min(n, run), target: n, at };
  }

  /** Walk every logged exercise in date order, calling fn(entry, previousEntries) per exercise performance. */
  function eachPerformance(fn) {
    const seen = {};
    WT.sessions().forEach((s) =>
      s.exercises.forEach((e) => {
        const ex = WT.ex(e.exId);
        if (!ex || e.skipped) return;
        const parts = [];
        (e.sets || []).forEach((x) => WT.setParts(x).forEach((p) => parts.push({ w: +p.w || 0, r: +p.r || 0 })));
        if (!parts.length) return;
        const m = { topW: Math.max(...parts.map((p) => p.w)), bestR: Math.max(...parts.map((p) => p.r)) };
        const prev = seen[e.exId] || [];
        fn({ s, e, ex, m, at: when(s) }, prev);
        seen[e.exId] = prev.concat(m);
      })
    );
  }
  const firstWhere = (pred) => {
    let at = null;
    eachPerformance((p, prev) => {
      if (!at && pred(p, prev)) at = iso(p.at);
    });
    return at;
  };
  const bool = (at) => ({ value: at ? 1 : 0, target: 1, at });

  /* Nutrition days (only days with entries) */
  function foodDays() {
    const N = WT.nut;
    if (!N || !WT.db.nutrition) return [];
    const tg = Math.max(1, +WT.db.profile.proteinTarget || 150);
    const band = N.band(tg);
    const days = [...new Set(WT.db.nutrition.entries.map((e) => e.date))].sort();
    return days.map((d) => {
      const t = N.dayTotals(d);
      // On target = inside the flexible band. Going far above it is never rewarded.
      return { date: d, p: t.p, on: t.p >= band.lo && t.p <= band.hi * 1.15, at: iso(N.parseDay(d).getTime() + 20 * 36e5) };
    });
  }
  function logStreak(n) {
    const N = WT.nut;
    const days = foodDays().map((d) => d.date);
    let run = 0, best = 0, at = null, prev = null;
    days.forEach((d) => {
      run = prev && N.addDays(prev, 1) === d ? run + 1 : 1;
      prev = d;
      best = Math.max(best, run);
      if (run >= n && !at) at = iso(N.parseDay(d).getTime() + 20 * 36e5);
    });
    const today = N ? N.dayKey() : '';
    const live = prev && (prev === today || (N && N.addDays(prev, 1) === today)) ? run : 0;
    return { value: Math.min(n, at ? n : live), target: n, at };
  }

  const MAJOR = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];
  const ALL_TYPES = ['full', 'push', 'pull', 'legs', 'chest', 'back', 'shoulders', 'arms', 'core', 'cardio'];

  /* ───────── Definitions ───────── */
  const D = (id, cat, name, text, icon, fn, opts) => Object.assign({ id, cat, name, text, icon, fn }, opts || {});
  A.LIST = [
    // Consistency
    D('first-workout', 'consistency', 'First Spark', 'Complete your first workout.', 'flame', () => count(workouts(), 1, when)),
    D('workouts-3', 'consistency', 'Warming Up', 'Complete 3 workouts.', 'flame', () => count(workouts(), 3, when)),
    D('workouts-10', 'consistency', 'Habit Forming', 'Complete 10 workouts.', 'flame', () => count(workouts(), 10, when)),
    D('workouts-25', 'consistency', 'Iron Regular', 'Complete 25 workouts.', 'dumbbell', () => count(workouts(), 25, when)),
    D('workouts-50', 'consistency', 'Half-Century Club', 'Complete 50 workouts.', 'trophy', () => count(workouts(), 50, when)),
    D('streak-2', 'consistency', 'In the Groove', 'Meet your weekly workout goal 2 weeks in a row.', 'calendar', () => weekStreak(2), { unit: 'weeks' }),
    D('streak-4', 'consistency', 'Monthly Momentum', 'Meet your weekly workout goal 4 weeks in a row.', 'calendar', () => weekStreak(4), { unit: 'weeks' }),
    D('streak-12', 'consistency', 'Season of Strength', 'Meet your weekly workout goal 12 weeks in a row.', 'trophy', () => weekStreak(12), { unit: 'weeks' }),
    // Strength
    D('first-pr', 'strength', 'Personal Best', 'Set your first personal record.', 'trophy', () => {
      const s = WT.sessions().find((x) => (x.prs || []).length);
      return bool(s ? iso(when(s)) : null);
    }),
    D('weight-up', 'strength', 'Heavier Than Before', 'Lift more weight on an exercise than you did last time.', 'trendUp', () =>
      bool(firstWhere((p, prev) => p.m.topW > 0 && prev.length && p.m.topW > prev[prev.length - 1].topW))
    ),
    D('pullup-up', 'strength', 'Higher Ground', 'Beat your pull-up or chin-up best — more reps, or added weight.', 'up', () =>
      bool(firstWhere((p, prev) => /pull-?up|chin-?up/i.test(p.ex.id + ' ' + p.ex.name) && prev.length && (p.m.bestR > Math.max(...prev.map((x) => x.bestR)) || p.m.topW > Math.max(...prev.map((x) => x.topW)))))
    ),
    D('weight-milestone', 'strength', 'New Plateau', () => `Reach a new ${WT.db.profile.unit === 'kg' ? '10 kg' : '25 lb'} milestone on any lift (after your first session of it).`, 'target', () => {
      const step = WT.db.profile.unit === 'kg' ? 10 : 25;
      return bool(firstWhere((p, prev) => p.m.topW >= step && prev.length && Math.floor(p.m.topW / step) > Math.floor(Math.max(...prev.map((x) => x.topW)) / step)));
    }),
    // Running
    D('first-run', 'running', 'Out the Door', 'Record your first run.', 'cardio', () => count(runs(), 1, (r) => r.at)),
    D('runs-5', 'running', 'Finding Your Stride', 'Record 5 runs.', 'cardio', () => count(runs(), 5, (r) => r.at)),
    D('runs-10', 'running', 'Road Regular', 'Record 10 runs.', 'cardio', () => count(runs(), 10, (r) => r.at)),
    D('first-5k', 'running', '5K Finisher', 'Run 5 km (3.1 miles) in one go.', 'trophy', () => {
      const r = runs();
      const best = Math.max(0, ...r.map((x) => x.dist));
      const hit = r.find((x) => x.dist >= 3.1);
      return { value: WT.round(Math.min(best, 3.1), 1), target: 3.1, at: hit ? iso(hit.at) : null, unit: 'mi' };
    }, { unit: 'mi' }),
    ...[[25, 'Quarter Century', 'mi'], [50, 'Fifty-Mile Legs', 'mi'], [100, 'Century Runner', 'mi']].map(([n, name]) =>
      D('run-dist-' + n, 'running', name, `Run ${n} miles in total.`, 'activity', () => {
        let tot = 0, at = null;
        runs().forEach((x) => {
          tot += x.dist;
          if (!at && tot >= n) at = iso(x.at);
        });
        return { value: WT.round(Math.min(tot, n), 1), target: n, at };
      }, { unit: 'mi' })
    ),
    D('pace-up', 'running', 'Quicker Feet', 'Beat your best average pace on a run of a mile or more (after 2 runs).', 'zap', () => {
      let best = null, n = 0, at = null;
      runs().forEach((x) => {
        if (!(x.dist >= 1 && x.time > 0)) return;
        const pace = x.time / x.dist;
        if (best != null && n >= 2 && pace < best - 1 / 60 && !at) at = iso(x.at);
        best = best == null ? pace : Math.min(best, pace);
        n++;
      });
      return bool(at);
    }),
    // Variety
    D('ex-10', 'variety', 'Explorer', 'Try 10 different exercises.', 'book', () => {
      const ids = [];
      let at = null;
      eachPerformance((p) => {
        if (!ids.includes(p.e.exId)) {
          ids.push(p.e.exId);
          if (ids.length === 10) at = iso(p.at);
        }
      });
      return { value: Math.min(ids.length, 10), target: 10, at };
    }),
    D('all-types', 'variety', 'Full Spectrum', 'Complete every main workout type: Full Body, Push, Pull, Legs, Chest, Back, Shoulders, Arms, Core and Cardio.', 'sparkles', () => {
      const done = new Set();
      let at = null;
      WT.sessions().forEach((s) => {
        if (!ALL_TYPES.includes(s.type) || !s.exercises.some((e) => !e.skipped && (e.sets || []).some((x) => x.done))) return;
        done.add(s.type);
        if (!at && done.size === ALL_TYPES.length) at = iso(when(s));
      });
      return { value: done.size, target: ALL_TYPES.length, at };
    }),
    D('new-category', 'variety', 'Branching Out', 'After your first 3 workouts, try a movement pattern you’ve never done before.', 'swap', () => {
      const pats = new Set();
      let sessions = 0, at = null, lastSess = null;
      eachPerformance((p) => {
        if (p.s !== lastSess) {
          lastSess = p.s;
          sessions++;
        }
        if (!at && sessions > 3 && !pats.has(p.ex.pattern)) at = iso(p.at);
        pats.add(p.ex.pattern);
      });
      return bool(at);
    }),
    D('head-to-toe', 'variety', 'Head to Toe', 'Complete a workout that works chest, back, shoulders, arms, legs and core.', 'body', () => {
      let at = null, best = 0;
      WT.sessions().forEach((s) => {
        const g = new Set();
        s.exercises.forEach((e) => {
          const ex = WT.ex(e.exId);
          if (!ex || e.skipped || !(e.sets || []).some((x) => x.done)) return;
          [ex.primary].concat(ex.secondary).forEach((m) => WT.MUSCLES[m] && g.add(WT.MUSCLES[m].group));
        });
        const n = MAJOR.filter((x) => g.has(x)).length;
        best = Math.max(best, n);
        if (!at && n === MAJOR.length) at = iso(when(s));
      });
      return { value: best, target: MAJOR.length, at };
    }),
    // Nutrition
    D('log-7', 'nutrition', 'Week of Plates', 'Log food on 7 different days.', 'food', () => count(foodDays(), 7, (d) => d.at)),
    D('protein-5', 'nutrition', 'On Target', 'Land in your protein range on 5 days.', 'target', () => count(foodDays().filter((d) => d.on), 5, (d) => d.at)),
    D('protein-15', 'nutrition', 'Dialed In', 'Land in your protein range on 15 days.', 'target', () => count(foodDays().filter((d) => d.on), 15, (d) => d.at)),
    D('log-streak', 'nutrition', 'Steady Logger', 'Log food 10 days in a row.', 'calendar', () => logStreak(10), { unit: 'days' }),
  ];
  A.text = (a) => (typeof a.text === 'function' ? a.text() : a.text);

  /* ───────── Store & evaluation ───────── */
  const S = () => WT.db.achievements;
  A.enabled = () => WT.db.profile.achievements !== false;
  A.unlocked = (id) => (S() && S().unlocked[id]) || null;
  /** Progress for every achievement: [{ def, value, target, at, unlocked }] */
  A.progress = function () {
    return A.LIST.map((def) => {
      let r;
      try {
        r = def.fn() || { value: 0, target: 1, at: null };
      } catch (e) {
        console.warn('achievement', def.id, e);
        r = { value: 0, target: 1, at: null };
      }
      return Object.assign({ def, unlocked: A.unlocked(def.id) }, r);
    });
  };
  /**
   * Record anything newly earned. Returns the list of new unlocks that deserve a celebration (not retro).
   * opts.silent — record without celebrating (used for the first ever check and for imports).
   */
  A.check = function (opts) {
    opts = opts || {};
    const st = S();
    if (!st) return [];
    const first = !st.since;
    const now = new Date().toISOString();
    const fresh = [];
    A.progress().forEach((p) => {
      if (st.unlocked[p.def.id] || !p.at) return;
      // Retro = it happened before achievements were being tracked on this device (or arrived via import)
      const retro = first || opts.silent || (st.since && new Date(p.at) < new Date(st.since) - 864e5);
      st.unlocked[p.def.id] = { at: p.at, found: now, retro: !!retro };
      if (!retro) fresh.push(p.def);
    });
    if (first) st.since = now;
    if (fresh.length || first) WT.save();
    return fresh;
  };
  A.counts = function () {
    const st = S();
    const n = A.LIST.filter((d) => st && st.unlocked[d.id]).length;
    return { earned: n, total: A.LIST.length };
  };

  /* Celebrate quietly: a small card that slides in and fades — never a modal. */
  A.celebrate = function (defs) {
    if (!defs.length || typeof document === 'undefined') return;
    if (WT.db.profile.achCelebrate === false) return;
    const host = document.getElementById('toasts');
    if (!host) return;
    defs.slice(0, 2).forEach((d, i) => {
      setTimeout(() => {
        // Non-interactive and brief, so it can never cover a button you're about to tap
        const el = document.createElement('div');
        el.className = 'toast ach-toast';
        el.setAttribute('aria-label', `Achievement unlocked: ${d.name}`);
        el.innerHTML = `<span class="ach-burst" aria-hidden="true">${WT.icon(d.icon || 'trophy', 16)}<i></i><i></i><i></i><i></i><i></i><i></i></span><span><span class="ach-k">Achievement unlocked</span><span class="ach-n">${WT.esc(d.name)}</span></span>`;
        while (host.children.length > 2) host.firstChild.remove();
        host.appendChild(el);
        setTimeout(() => {
          el.style.transition = 'opacity .4s, transform .4s';
          el.style.opacity = 0;
          el.style.transform = 'translateY(-8px)';
          setTimeout(() => el.remove(), 420);
        }, 4200);
      }, i * 900);
    });
    if (defs.length > 2) setTimeout(() => WT.toast && WT.toast(`+${defs.length - 2} more achievements`), 1900);
  };

  /* Re-check shortly after data changes (debounced; cheap even with years of history). */
  let timer = null, lastSig = null;
  const signature = () => {
    const h = WT.db.history, n = (WT.db.nutrition && WT.db.nutrition.entries) || [];
    const p = WT.db.profile;
    return [h.length, h.length && h[h.length - 1].id, h.length && h[h.length - 1].endedAt, n.length, n.length && n[n.length - 1].id, p.proteinTarget, p.strengthPerWeek, p.unit, Object.keys(WT.db.achievements.unlocked).length].join('|');
  };
  A.schedule = function () {
    if (!A.enabled() || !WT.db || !WT.db.achievements) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const sig = signature();
      if (sig === lastSig) return; // nothing that achievements depend on has changed
      lastSig = sig;
      // Never interrupt an active workout with a celebration — it'll be noticed after saving.
      const fresh = A.check();
      if (fresh.length) A.celebrate(fresh);
      if (WT.ui && WT.ui.route === 'achievements' && fresh.length && WT.rerender) WT.rerender();
    }, 700);
  };
  WT.onSaved = A.schedule;
})();
