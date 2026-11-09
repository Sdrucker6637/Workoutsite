/* Recommendation engine (v6): weekly balance, workout-type choice, exercise variety, automatic drop / build-up
 * sets, intensity caps and settings, multi-session weight progression, adaptive learning, migration and backup.
 * Run: node tests/recommend.test.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = String(v)), removeItem: (k) => delete mem[k] };
for (const f of ['exercises.js', 'core.js', 'foods.js', 'products.js', 'nutrition.js', 'feedback.js', 'engine.js', 'ingredients.js', 'meals.js', 'achievements.js'])
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
const WT = globalThis.WT;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', m); } };
const section = (t) => console.log('\n' + t);
const reset = () => { WT.resetAll(); };
const ago = (d, h = 17) => { const x = new Date(Date.now() - d * 864e5); x.setHours(h, 0, 0, 0); return x.toISOString(); };
/** Push a finished session. exs: [[exId, [[w, r], …], extra]] */
function sess(daysAgo, type, exs, extra) {
  const s = Object.assign({ id: WT.uid(), type, title: type, startedAt: ago(daysAgo, 16), endedAt: ago(daysAgo, 17), durationSec: 3600, prs: [], totals: { sets: 0, volume: 0 },
    exercises: exs.map(([exId, sets, x]) => Object.assign({ uid: WT.uid(), exId, name: WT.ex(exId).name, intensity: 'regular', targetSets: sets.length, repMin: 8, repMax: 12, sets: sets.map(([w, r]) => ({ w: String(w), r: String(r), done: true })) }, x || {})) }, extra || {});
  s.totals.sets = s.exercises.reduce((a, e) => a + e.sets.length, 0);
  WT.db.history.push(s);
  return s;
}
const S3 = (w, r) => [[w, r], [w, r], [w, r]];
const groupsOf = (w) => w.exercises.map((i) => WT.MUSCLES[WT.ex(i.exId).primary].group);

WT.load();

/* ───────── Workout selection: balance across the week ───────── */
section('Balanced weekly coverage (full-body preference)');
{
  reset();
  // Two leg-and-chest heavy sessions this week; back / arms / shoulders untouched
  for (const d of [3, 1]) sess(d, 'full', [['goblet-squat', S3(50, 10)], ['bulgarian-split-squat', S3(30, 10)], ['db-bench-press', S3(50, 10)], ['db-incline-press', S3(40, 10)], ['leg-extension', S3(80, 12)].filter(() => WT.ex('leg-extension'))].filter((x) => WT.ex(x[0])));
  let legs = 0, back = 0, armsSh = 0, N = 60;
  for (let k = 0; k < N; k++) {
    const g = groupsOf(WT.generate(WT.defaultSettings('full')));
    legs += g.filter((x) => x === 'legs').length; back += g.filter((x) => x === 'back').length; armsSh += g.filter((x) => x === 'arms' || x === 'shoulders').length;
  }
  console.log(`  per workout: legs ${(legs / N).toFixed(2)}, back ${(back / N).toFixed(2)}, arms+shoulders ${(armsSh / N).toFixed(2)}`);
  ok(back / N >= 1, 'back (untrained this week) is always covered');
  ok(legs / N < 1.2, 'legs (already trained twice) get less work');
  ok(armsSh / N >= 1, 'arms / shoulders that are behind are covered');
  const w = WT.generate(WT.defaultSettings('full'));
  console.log('  notes:', w.notes.join(' | '));
  ok(w.notes.some((n) => /due for more weekly volume|recovery|already/.test(n)), 'workout explains its balance in plain words');
  ok(w.exercises.some((i) => (i.why || []).length), 'exercises carry short reasons');
  ok(w.exercises.every((i) => (i.why || []).every((t) => !/\d+\.\d{2,}|score/i.test(t))), 'reasons never expose scoring arithmetic');
}
section('Essential slots step aside when muscles are covered / recovering');
{
  reset();
  // Chest well past target and hammered yesterday
  sess(1, 'chest', [['db-bench-press', [[50, 10], [50, 10], [50, 10], [50, 10]]], ['db-incline-press', [[40, 10], [40, 10], [40, 10], [40, 10]]], ['cable-fly', S3(30, 12)], ['push-up', S3(0, 20)].filter(() => WT.ex('push-up'))].filter((x) => x[0]));
  sess(3, 'chest', [['db-bench-press', S3(50, 10)], ['db-incline-press', S3(40, 10)]]);
  let chest = 0, N = 50;
  for (let k = 0; k < N; k++) chest += groupsOf(WT.generate(WT.defaultSettings('full'))).filter((g) => g === 'chest').length;
  console.log(`  chest exercises per full-body workout after a big chest week: ${(chest / N).toFixed(2)}`);
  ok(chest / N < 0.8, 'chest is not forced into every full-body session');
}
section('No overcorrection: a big session does not exclude a muscle for the rest of the week');
{
  const bigLegs = [['goblet-squat', 6], ['bulgarian-split-squat', 5], ['db-hip-thrust', 5], ['leg-extension', 4], ['slider-leg-curl', 4]];
  const legShare = (daysAgo) => {
    reset();
    sess(daysAgo, 'legs', bigLegs.map(([id, n]) => [id, Array.from({ length: n }, () => [30, 10])]));
    let c = 0;
    for (let k = 0; k < 100; k++) c += groupsOf(WT.generate(WT.defaultSettings('full'))).includes('legs') ? 1 : 0;
    return c;
  };
  const d1 = legShare(1), d3 = legShare(3), d5 = legShare(5);
  console.log(`  legs in full-body plans after a 24-set leg day: 1 day later ${d1}%, 3 days ${d3}%, 5 days ${d5}%`);
  ok(d1 <= 10, 'the day after: legs are still recovering and step aside');
  ok(d3 >= 90 && d5 >= 90, 'from 3 days later legs are back in full-body plans');
}
section('No overcorrection: a favorite done often is rotated, not shut out');
{
  reset();
  for (let k = 0; k < 6; k++) sess(2 + k * 2.3, 'full', [['pullup', S3(0, 8)]]);
  let c = 0;
  for (let k = 0; k < 200; k++) c += WT.generate(WT.defaultSettings('full')).exercises.some((i) => i.exId === 'pullup') ? 1 : 0;
  console.log(`  favorite pull-up done 6× in 2 weeks → in ${c / 2}% of full-body plans`);
  ok(c >= 30, 'still appears regularly (≥ 15% of plans)');
  ok(c < 200, 'but not in every plan');
}
section('Rotation: every main group comes around in full-body plans');
{
  // Simulate 4 weeks of Mon / Wed / Fri full-body sessions, logging whatever is generated
  reset();
  const G = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];
  const gap = {}, maxGap = {};
  G.forEach((g) => (gap[g] = maxGap[g] = 0));
  const offsets = [];
  for (let w = 3; w >= 0; w--) for (const d of [4, 2, 0]) offsets.push(w * 7 + d + 1);
  offsets.forEach((daysAgo) => {
    const ctxNow = Date.now;
    Date.now = () => ctxNow() - daysAgo * 864e5; // generate as of that day
    const w = WT.generate(WT.defaultSettings('full'));
    Date.now = ctxNow;
    const s = WT.sessionFromWorkout(w);
    s.exercises.forEach((e) => e.sets.forEach((x) => { x.done = true; x.w = '20'; x.r = String(e.repMax); (x.stages || []).forEach((st) => { st.done = true; st.w = '20'; st.r = String(st.tr); }); }));
    s.startedAt = s.endedAt = ago(daysAgo);
    s.durationSec = 3000;
    WT.db.history.push(s);
    const gs = new Set(groupsOf(w));
    G.forEach((g) => (gs.has(g) ? (gap[g] = 0) : (maxGap[g] = Math.max(maxGap[g], ++gap[g]))));
  });
  console.log('  longest run of sessions without each group:', JSON.stringify(maxGap));
  ok(G.every((g) => maxGap[g] <= 4), 'no main muscle group is left out of more than 4 sessions in a row');
}
section('Exercise variety: recently repeated exercises rotate out');
{
  reset();
  for (const d of [12, 9, 6]) sess(d, 'full', [['goblet-squat', S3(50, 10)]]);
  let goblet = 0; const N = 250;
  for (let k = 0; k < N; k++) goblet += WT.generate(WT.defaultSettings('full')).exercises.some((i) => i.exId === 'goblet-squat') ? 1 : 0;
  reset();
  let fresh = 0;
  for (let k = 0; k < N; k++) fresh += WT.generate(WT.defaultSettings('full')).exercises.some((i) => i.exId === 'goblet-squat') ? 1 : 0;
  console.log(`  goblet squat chosen: after 3 uses in 2 weeks ${goblet}/${N}, with no history ${fresh}/${N}`);
  ok(goblet < fresh, 'frequent recent use lowers how often it is chosen');
  const distinct = new Set();
  for (let k = 0; k < 30; k++) distinct.add(WT.generate(WT.defaultSettings('push')).exercises.map((i) => i.exId).sort().join());
  ok(distinct.size >= 15, `generation is varied, not always the top score (${distinct.size}/30 distinct push plans)`);
  // No near-duplicates in mixed workouts
  let dup = 0;
  for (let k = 0; k < 200; k++) {
    const exs = WT.generate(WT.defaultSettings('full')).exercises.map((i) => WT.ex(i.exId));
    exs.forEach((a, i) => exs.forEach((b, j) => j > i && a.primary === b.primary && a.pattern === b.pattern && dup++));
  }
  ok(dup <= 10, `full-body workouts rarely contain two exercises doing the same job (${dup} in 200)`);
}
section('Progress favouritism');
{
  reset();
  [[20, 30, 9], [14, 30, 11], [7, 35, 9], [3, 35, 11]].forEach(([d, w, r]) => sess(d, 'arms', [['db-curl', S3(w, r)]]));
  ok(WT.progressTrend('db-curl') === 'up', 'a rising estimated 1RM reads as progress');
  const ctx = WT.buildContext(WT.defaultSettings('arms'));
  ok(ctx.trend('db-curl') === 'up', 'context exposes the trend');
  let why = false;
  for (let k = 0; k < 40 && !why; k++) why = WT.generate(WT.defaultSettings('arms')).exercises.some((i) => i.exId === 'db-curl' && i.why.includes('You’ve made consistent progress on this exercise'));
  ok(why, '“You’ve made consistent progress on this exercise” explains the pick');
}

/* ───────── Intensities: drop / build-up assignment, caps, settings ───────── */
section('Automatic drop and build-up sets');
{
  reset();
  const P = WT.db.profile;
  ok(P.intensityOdds.drop > 0 && P.intensityOdds.buildup > 0, 'drop / build-up odds exist with non-zero defaults');
  let drop = 0, build = 0, dropIso = 0, buildComp = 0, dropLate = 0, buildEarly = 0, workouts = 0, maxStaged = 0, maxTech = 0, risky = 0;
  for (const t of ['full', 'push', 'pull', 'legs', 'arms', 'chest', 'back', 'shoulders']) {
    for (let k = 0; k < 250; k++) {
      const w = WT.generate(WT.defaultSettings(t)); workouts++;
      const n = w.exercises.length;
      let st = 0, tech = 0;
      w.exercises.forEach((i, idx) => {
        const ex = WT.ex(i.exId);
        if (WT.TECHNIQUES.includes(i.intensity)) tech++;
        if (i.intensity === 'drop') { drop++; st++; if (ex.category !== 'compound') dropIso++; if (idx >= n / 2) dropLate++; if (WT.fatigueRisky(ex)) risky++; }
        if (i.intensity === 'buildup') { build++; st++; if (ex.category === 'compound') buildComp++; if (idx < n * 0.6) buildEarly++; }
        if (WT.STAGED[i.intensity]) {
          ok(WT.canStage(ex), 'staged set only on a weighted exercise: ' + ex.id);
          ok(i.stageCount >= 2 && i.sets >= 1 && i.repMin > 0 && i.repMax >= i.repMin, 'staged item has stages, sets and rep targets');
          const reps = WT.stageReps(i.intensity, i.stageCount, i.repMin, i.repMax);
          if (i.intensity === 'buildup') ok(reps.every((r, j) => !j || r <= reps[j - 1]), 'build-up reps fall as load rises');
          ok(!i.superset, 'staged sets are not superset');
        }
        if (i.intensity === 'burnout') ok(!(WT.fatigueRisky(ex) && WT.trackType(ex) === 'weight'), 'no burnout on a risky loaded lift ' + ex.id);
      });
      maxStaged = Math.max(maxStaged, st); maxTech = Math.max(maxTech, tech);
      ok(st <= WT.intensityCaps(n).staged, 'drop + build-up capped per workout');
      ok(tech <= WT.intensityCaps(n).techniques, 'techniques capped per workout');
    }
  }
  console.log(`  ${workouts} workouts: drop ${drop} (isolation ${dropIso}, late ${dropLate}), build-up ${build} (compound ${buildComp}, early ${buildEarly}); max staged/workout ${maxStaged}, max techniques ${maxTech}`);
  ok(drop > 50 && build > 50, 'both are assigned automatically');
  ok(drop < workouts * 0.6 && build < workouts * 0.6, 'neither appears in most workouts');
  ok(dropIso > drop * 0.7, 'drop sets favour isolation exercises');
  ok(dropLate > drop * 0.7, 'drop sets sit toward the end');
  ok(risky === 0, 'drop sets never land on squats / hinges / spinal-load / explosive lifts');
  ok(buildComp > build * 0.6, 'build-up sets favour compound exercises');
  ok(buildEarly > build * 0.6, 'build-up sets come early to mid-session');
  // Generated stages have sensible default weights from history
  sess(5, 'arms', [['cable-curl', S3(40, 10)]]);
  const rec = WT.recommend('cable-curl', { repMin: 8, repMax: 12, sets: 2, intensity: 'drop', stages: 3 });
  ok(rec.stages && rec.stages.length === 3 && rec.stages.every((s, j) => s.w > 0 && (!j || s.w < rec.stages[j - 1].w)), 'drop-set stage loads derived from history and decreasing: ' + rec.stages.map((s) => s.w).join(' → '));
  const rb = WT.recommend('cable-curl', { repMin: 6, repMax: 12, sets: 2, intensity: 'buildup', stages: 3 });
  ok(rb.stages.every((s, j) => s.w > 0 && (!j || s.w > rb.stages[j - 1].w)) && rb.stages[0].r >= rb.stages[2].r, 'build-up stage loads increase while reps fall: ' + rb.stages.map((s) => `${s.w}×${s.r}`).join(' → '));
}
section('Drop / build-up frequency by workout size, and odds of 0 per size');
{
  reset();
  const odds = WT.db.profile.intensityOdds;
  const T = ['full', 'push', 'pull', 'legs', 'arms', 'back', 'shoulders'];
  const rate = (n, k) => {
    let items = 0, hit = 0, wk = 0;
    for (const t of T) for (let i = 0; i < 80; i++) {
      const w = WT.generate(Object.assign(WT.defaultSettings(t), { count: n }));
      const c = w.exercises.filter((x) => x.intensity === k).length;
      items += w.exercises.length; hit += c; wk += c ? 1 : 0;
    }
    return { perEx: hit / items, perWorkout: wk / (T.length * 80) };
  };
  for (const n of [3, 6, 10]) {
    const d = rate(n, 'drop'), b = rate(n, 'buildup');
    console.log(`  ${n} exercises: drop ${(d.perEx * 100).toFixed(1)}% of exercises (${(d.perWorkout * 100).toFixed(0)}% of workouts), build-up ${(b.perEx * 100).toFixed(1)}% (${(b.perWorkout * 100).toFixed(0)}%)`);
    ok(d.perWorkout > 0.03 && b.perWorkout > 0.03, `${n} exercises: both appear in ordinary generation`);
    odds.drop = 0;
    ok(rate(n, 'drop').perEx === 0, `${n} exercises: drop odds 0 → never`);
    odds.drop = 7; odds.buildup = 0;
    ok(rate(n, 'buildup').perEx === 0, `${n} exercises: build-up odds 0 → never`);
    odds.buildup = 7;
  }
  // Higher odds → more often (the slider is a real control)
  const lo = rate(6, 'drop').perEx;
  odds.drop = 25;
  const hi = rate(6, 'drop').perEx;
  odds.drop = 7;
  console.log(`  drop odds 7 → ${(lo * 100).toFixed(1)}%, odds 25 → ${(hi * 100).toFixed(1)}% of exercises`);
  ok(hi > lo * 1.4, 'raising the drop-set odds makes them clearly more frequent');
}
section('Intensity settings');
{
  reset();
  const odds = WT.db.profile.intensityOdds;
  Object.assign(odds, { drop: 0, buildup: 0 });
  let staged = 0;
  for (let k = 0; k < 300; k++) staged += WT.generate(WT.defaultSettings('arms')).exercises.filter((i) => WT.STAGED[i.intensity]).length;
  ok(staged === 0, 'odds of 0 turn drop / build-up off');
  Object.assign(odds, { heavy: 0, regular: 0, burnout: 0, standard: 0, drop: 60, buildup: 0 });
  let d = 0, total = 0;
  for (let k = 0; k < 100; k++) { const w = WT.generate(WT.defaultSettings('arms')); d += w.exercises.filter((i) => i.intensity === 'drop').length; total++; }
  ok(d > 0 && d <= total * WT.intensityCaps(6).staged, `high drop odds still respect the per-workout cap (${d} in ${total})`);
  Object.assign(odds, WT.defaultProfile().intensityOdds);
  // Manual (fixed) mode with drop / build-up counts
  const wm = WT.generate(Object.assign(WT.defaultSettings('push'), { intensityMode: 'manual', heavy: 1, burnout: 1, drop: 1, buildup: 1 }));
  const t = WT.intensityTally(wm.exercises);
  ok(t.drop === 1 && t.buildup === 1 && t.heavy === 1, 'fixed mode honours drop / build-up counts ' + JSON.stringify(t));
  // Avoid repeating the same intensity pattern three times in a row
  const s1 = WT.generate(WT.defaultSettings('full'));
  const tallyKey = (w) => WT.AUTO_TYPES.map((k) => w.plan[k] || 0).join('/');
  WT.db.history.push(Object.assign(WT.sessionFromWorkout(s1), { endedAt: ago(4), startedAt: ago(4) }));
  WT.db.history.push(Object.assign(WT.sessionFromWorkout(s1), { id: WT.uid(), endedAt: ago(2), startedAt: ago(2) }));
  let same = 0;
  for (let k = 0; k < 100; k++) same += tallyKey(WT.generate(WT.defaultSettings('full'))) === tallyKey(s1) ? 1 : 0;
  console.log(`  same intensity pattern as the last two workouts: ${same}/100`);
  ok(same < 12, 'rarely repeats an identical intensity pattern a third time');
  // Duration estimate accounts for stages
  const it = Object.assign({ exId: 'cable-curl' }, WT.prescribe(WT.ex('cable-curl'), 'drop'));
  ok(WT.estimateMinutes([it]) > WT.estimateMinutes([Object.assign({ exId: 'cable-curl' }, WT.prescribe(WT.ex('cable-curl'), 'regular'), { sets: 2 })]), 'a drop set takes longer than a plain set in the time estimate');
}

/* ───────── Weight progression ───────── */
section('Weight progression');
{
  reset();
  const plan = { repMin: 8, repMax: 12, sets: 3, intensity: 'regular' };
  sess(3, 'push', [['db-incline-press', S3(40, 12)]]);
  let r = WT.recommend('db-incline-press', plan);
  ok(r.action === 'hold' && r.weight === 40, 'one good workout is not enough to add weight');
  ok(/Two sessions at the top confirm/.test(r.reasons.join(' ')), 'and says why');
  reset();
  sess(6, 'push', [['db-incline-press', S3(40, 11)]]);
  sess(3, 'push', [['db-incline-press', S3(40, 12)]]);
  r = WT.recommend('db-incline-press', plan);
  ok(r.action === 'increase' && r.weight === 45, 'consistent sessions at the top → +5 lb to the next dumbbell');
  ok(r.history && r.history.length === 2 && r.reasons.some((x) => x.startsWith('Recent sessions')), 'Why lists the recent sessions behind it');
  // Repeated Hard ratings hold
  reset();
  sess(9, 'push', [['db-incline-press', S3(40, 12)]], );
  sess(6, 'push', [['db-incline-press', S3(40, 12), { effort: 'hard' }]]);
  sess(3, 'push', [['db-incline-press', S3(40, 12), { effort: 'good' }]]);
  WT.db.history[1].exercises[0].effort = 'hard'; WT.db.history[0].exercises[0].effort = 'hard';
  r = WT.recommend('db-incline-press', plan);
  ok(r.action === 'hold' && /rated this exercise hard/.test(r.reasons[0]), 'consistently Hard → hold');
  // Stale comparison
  reset();
  sess(30, 'push', [['db-incline-press', S3(40, 11)]]);
  sess(24, 'push', [['db-incline-press', S3(40, 12)]]);
  r = WT.recommend('db-incline-press', plan);
  ok(r.action === 'hold' && /days ago/.test(r.reasons[0]), 'a 3+ week-old comparison is a check-in, not an increase');
  // Realistic dumbbell increments: 10 → 15 lb is a 50% jump
  reset();
  sess(6, 'shoulders', [['db-lateral-raise', S3(10, 12)]]);
  sess(3, 'shoulders', [['db-lateral-raise', S3(10, 12)]]);
  r = WT.recommend('db-lateral-raise', plan);
  ok(r.action === 'reps' && r.weight === 10 && /jump/.test(r.reasons.join(' ')), 'a big relative dumbbell jump asks for reps first: ' + r.headline);
  sess(1, 'shoulders', [['db-lateral-raise', S3(10, 14)]]);
  r = WT.recommend('db-lateral-raise', plan);
  ok(r.action === 'increase' && r.weight === 15, 'once reps are built up, it moves to the next dumbbell');
  WT.db.profile.dumbbells.microLoad = true;
  reset(); WT.db.profile.dumbbells.microLoad = true;
  sess(6, 'shoulders', [['db-lateral-raise', S3(15, 12)]]);
  sess(3, 'shoulders', [['db-lateral-raise', S3(15, 12)]]);
  r = WT.recommend('db-lateral-raise', plan);
  ok(r.action === 'increase' && r.weight === 17.5, 'with 2.5 lb in-between dumbbells it uses them (15 → 17.5)');
  WT.db.profile.dumbbells.microLoad = false;
  // Declining trend
  reset();
  sess(9, 'push', [['db-incline-press', S3(45, 10)]]);
  sess(6, 'push', [['db-incline-press', S3(45, 8)]]);
  sess(3, 'push', [['db-incline-press', [[45, 7], [45, 6], [45, 6]]]]);
  r = WT.recommend('db-incline-press', plan);
  ok(r.action === 'decrease' && r.weight === 40, 'struggling repeatedly → back off a step');
  // Never changes logged weights: recommend() is pure
  const before = JSON.stringify(WT.db.history);
  WT.recommend('db-incline-press', plan);
  ok(JSON.stringify(WT.db.history) === before, 'recommendations never modify logged data');
}

/* ───────── Workout type, runs and recovery ───────── */
section('What to do next');
{
  reset();
  ok(WT.suggestNext().kind === 'strength', 'no history → strength');
  sess(0, 'full', [['goblet-squat', S3(50, 10)], ['db-bench-press', S3(50, 10)], ['lat-pulldown', S3(100, 10)].filter(() => WT.ex('lat-pulldown'))].filter((x) => WT.ex(x[0])));
  WT.db.history[0].startedAt = new Date(Date.now() - 5 * 3600e3).toISOString(); WT.db.history[0].endedAt = new Date(Date.now() - 4 * 3600e3).toISOString();
  let s = WT.suggestNext();
  ok(s.kind === 'run' && s.type === 'cardio', 'lifted a few hours ago and runs are behind → run day: ' + s.reason);
  WT.db.profile.runsPerWeek = 0;
  s = WT.suggestNext();
  ok(s.kind === 'recovery', 'no runs planned → recovery after a full-body session within a day');
  WT.db.profile.runsPerWeek = 2;
  reset();
  for (const d of [3, 2, 1, 0]) sess(d, 'full', [['goblet-squat', S3(50, 10)]]);
  s = WT.suggestNext();
  ok(s.kind === 'recovery' && /in a row/.test(s.reason), '4 days in a row → recovery');
  reset();
  // Goals are counted per calendar week (like Home), so put everything in this week: today
  sess(0, 'full', [['goblet-squat', S3(50, 10)]]); sess(0, 'full', [['db-bench-press', S3(50, 10)]]); sess(0, 'full', [['db-row', S3(50, 10)].filter(() => WT.ex('db-row'))].filter((x) => x[0]).concat([['seated-cable-row', S3(100, 10)]].filter((x) => WT.ex(x[0]))));
  const runSet = [['outdoor-run', [[0, 0]]]];
  for (const d of [0, 0]) { const r = sess(d, 'cardio', runSet); r.exercises[0].sets = [{ w: '', r: '', time: '30', dist: '3', done: true }]; }
  s = WT.suggestNext();
  ok(s.kind === 'recovery' && /met this week/.test(s.reason), 'weekly goals met → optional / rest');
  // Split rotation by readiness
  reset();
  WT.db.profile.preferredType = 'push';
  WT.db.profile.runsPerWeek = 0;
  sess(2, 'push', [['db-bench-press', S3(50, 10)], ['db-shoulder-press', S3(40, 10)], ['cable-pushdown', S3(50, 12)]]);
  sess(1, 'legs', [['goblet-squat', S3(50, 10)], ['bulgarian-split-squat', S3(30, 10)]]);
  s = WT.suggestNext();
  ok(s.type === 'pull' && s.kind === 'strength', 'push/pull/legs: the least-trained, most-recovered split comes next (' + s.type + ')');
  WT.db.profile.preferredType = 'full';
  WT.db.profile.runsPerWeek = 2;
}
section('Adaptive learning');
{
  reset();
  // One skip changes nothing
  sess(10, 'full', [['goblet-squat', S3(50, 10)], ['cable-fly', [], { skipped: true }]]);
  ok(!(WT.adaptStats().ex['cable-fly'] || {}).penalty, 'a single skipped exercise does not change anything');
  sess(6, 'full', [['goblet-squat', S3(50, 10)], ['cable-fly', [], { skipped: true }]]);
  WT.recordDrop('cable-fly');
  const pen = WT.adaptStats().ex['cable-fly'].penalty;
  ok(pen > 0, 'repeated skips / removals lower its frequency (penalty ' + pen + ')');
  // Suggested vs chosen type
  reset();
  for (const d of [10, 8, 6, 4]) sess(d, 'push', [['db-bench-press', S3(50, 10)]], { meta: { suggested: 'full', plannedSets: 3 } });
  ok(WT.adaptStats().preferredType === 'push', 'a type repeatedly chosen over the suggestion is learned');
  // Duration
  reset();
  for (const d of [12, 9, 6, 3]) sess(d, 'full', [['goblet-squat', S3(50, 10)]], { durationSec: 40 * 60, meta: { suggested: 'full', plannedSets: 3 } });
  ok(WT.suggestedDuration() === 45, 'consistently ~40-minute sessions → 45-minute suggestion (default 60)');
  ok(WT.suggestNext().duration === 45, 'Home suggestion carries the duration');
  WT.db.profile.adaptive = false;
  ok(WT.suggestedDuration() === null, 'learning can be turned off');
  WT.db.profile.adaptive = true;
  // Session meta is recorded at start
  const w = WT.generate(Object.assign(WT.defaultSettings('full'), { suggested: 'full' }));
  const live = WT.sessionFromWorkout(w);
  ok(live.meta.suggested === 'full' && live.meta.plannedSets > 0 && live.meta.source === 'generated', 'sessions remember what was planned');
}

/* ───────── Data safety ───────── */
section('Migration v5 → v6 and backups');
{
  const v5 = {
    version: 5,
    profile: { name: 'Keep', unit: 'lb', intensityOdds: { heavy: 10, regular: 50, burnout: 10, standard: 30 }, intensityFixed: { heavy: 3, burnout: 0 }, favorites: ['pullup'], proteinTarget: 140 },
    customExercises: [{ id: 'custom-x', name: 'My Lift', primary: 'chest', secondary: [], equipment: ['db'], category: 'isolation', pattern: 'fly', difficulty: 'beginner', intensities: ['regular', 'standard'], repMin: 8, repMax: 12, rest: 60, load: 'db', tags: [], sets: 3 }],
    overrides: { 'db-curl': { video: 'https://youtu.be/abcdefghijk' } },
    history: [{ id: 'h1', type: 'push', title: 'Push', startedAt: ago(3), endedAt: ago(3), durationSec: 3000, totals: { sets: 3, volume: 1200 }, prs: [], exercises: [{ uid: 'u', exId: 'db-bench-press', name: 'DB Bench', intensity: 'regular', targetSets: 3, repMin: 8, repMax: 12, sets: [{ w: '40', r: '10', done: true }] }] }],
    nutrition: { entries: [{ id: 'n1', date: '2026-10-30', at: '2026-10-30T12:00:00Z', name: 'Chicken', qty: 1, unit: 'serving', per: { p: 40, cal: 200, c: 0, f: 4 } }], foods: [{ id: 'f1', name: 'My shake', per: { p: 30 } }] },
    active: null, draft: null,
  };
  mem['wt.data.v1'] = JSON.stringify(v5);
  WT.load();
  const d = WT.db;
  ok(d.version === 7, 'version bumped to 7');
  ok(d.history.length === 1 && d.history[0].exercises[0].sets[0].w === '40', 'workout history untouched');
  ok(d.profile.name === 'Keep' && d.profile.proteinTarget === 140 && d.profile.favorites[0] === 'pullup', 'settings and favorites kept');
  ok(d.profile.intensityOdds.heavy === 10 && d.profile.intensityOdds.regular === 50 && d.profile.intensityOdds.drop > 0 && d.profile.intensityOdds.buildup > 0, 'custom intensity odds kept; drop / build-up odds added');
  ok(d.profile.intensityFixed.heavy === 3 && d.profile.intensityFixed.drop === 0, 'fixed counts kept; new ones default to 0');
  ok(d.customExercises.length === 1 && d.overrides['db-curl'].video, 'custom exercises and overrides kept');
  ok(d.nutrition.entries.length === 1 && d.nutrition.foods.length === 1, 'nutrition kept');
  ok(d.meals && Array.isArray(d.meals.selected) && d.achievements && d.achievements.unlocked && d.learn, 'new stores created empty');
  // Backup includes new data
  WT.meals.saveIngredient({ name: 'Cod', cat: 'protein', p: 25 });
  d.meals.selected = ['shrimp', 'spinach'];
  const idea = WT.meals.generate().ideas[0];
  WT.meals.toggleFavorite(idea);
  WT.ach.check();
  const json = WT.exportData();
  const parsed = JSON.parse(json).data;
  ok(parsed.meals.custom.length === 1 && parsed.meals.favorites.length === 1 && parsed.achievements.since, 'export includes custom ingredients, saved recipes and achievements');
  WT.resetAll();
  WT.importData(json, 'replace');
  ok(WT.db.meals.favorites[0].key === idea.key && WT.db.meals.custom[0].name === 'Cod' && WT.db.history.length === 1, 'replace restores everything');
  WT.db.meals.favorites = []; WT.db.meals.custom = [];
  WT.importData(json, 'merge');
  WT.importData(json, 'merge');
  ok(WT.db.meals.favorites.length === 1 && WT.db.meals.custom.length === 1 && WT.db.history.length === 1, 'merge adds missing recipes / ingredients without duplicates');
  WT.flush(); WT.load();
  ok(WT.db.meals.favorites.length === 1, 'persists across reload');
  // An old (v5) backup still imports
  WT.importData(JSON.stringify({ app: 'workout-tracker', data: v5 }), 'replace');
  ok(WT.db.version === 7 && WT.db.history.length === 1 && WT.db.meals.favorites.length === 0, 'a v5 backup imports and upgrades');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
