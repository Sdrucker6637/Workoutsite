/* Programming-quality tests for the workout generator: node tests/programming.test.js
 * Structure (coverage, movement patterns, redundancy), ordering, supersets, intensity, swaps,
 * volume/recovery, determinism and regression. Uses seeded generation so failures are reproducible. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = String(v)), removeItem: (k) => delete mem[k] };
for (const f of ['exercises.js', 'core.js', 'engine.js', 'programming.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
const WT = globalThis.WT;
let fails = 0, passes = 0;
const failMsgs = {};
const ok = (c, msg) => {
  if (c) return passes++;
  fails++;
  const key = String(msg).split(' — ')[0];
  failMsgs[key] = (failMsgs[key] || 0) + 1;
  if (failMsgs[key] <= 3) console.log('  FAIL:', msg);
};
const section = (s) => console.log('\n' + s);
WT.load();
const P = WT.db.profile;
const exOf = (i) => WT.ex(i.exId);
const names = (w) => w.exercises.map((i) => i.exId).join(', ');
const gen = (type, extra, seed) => WT.generate(Object.assign(WT.defaultSettings(type), { seed }, extra || {}));
const ctxFor = (settings) => WT._gen.buildContext(Object.assign(WT.defaultSettings(settings.type), settings));
const covered = (w, tok) => w.exercises.some((i) => WT.P.covers(exOf(i), tok));
const histSnapshot = () => JSON.stringify(WT.db.history);

/* ── Taxonomy ── */
section('Movement-pattern classification');
{
  const resistance = WT.exercises.filter((e) => e.category !== 'cardio' && !e.tags.includes('conditioning'));
  resistance.forEach((e) => ok(WT.MOVES[WT.moveOf(e)] && WT.moveOf(e) !== 'other', 'classified ' + e.id));
  const m = (id) => WT.moveOf(WT.ex(id));
  ok(m('db-bench-press') === 'h-push' && m('db-shoulder-press') === 'v-push' && m('db-row') === 'h-pull' && m('lat-pulldown') === 'v-pull', 'upper-body planes');
  ok(m('goblet-squat') === 'knee' && m('bulgarian-split-squat') === 'knee-uni' && m('db-hip-thrust') === 'hip' && m('glute-bridge') === 'hip-ext' && m('slider-leg-curl') === 'knee-flex', 'lower-body classes');
  ok(m('plank') === 'core-anti-ext' && m('pallof-press') === 'core-anti-rot' && m('cable-crunch') === 'core-flex', 'core classes');
  ok(m('db-lateral-raise') === 'side-delt' && m('face-pull') === 'rear-delt' && m('db-curl') === 'biceps' && m('cable-pushdown') === 'triceps' && m('db-calf-raise') === 'calf', 'isolation classes');
  ok(WT.movesOf(WT.ex('bulgarian-split-squat')).includes('knee'), 'unilateral counts as knee-dominant (secondary)');
  ok(WT.movesOf(WT.ex('close-grip-db-press')).includes('triceps'), 'close-grip press has triceps as a secondary movement');
  // Primary vs secondary muscle contributions
  const b = WT.setShare(WT.ex('db-bench-press'));
  ok(b.chest === 1 && b.triceps === 0.5 && b['front-delts'] === 0.5, 'bench: 1 chest, ½ triceps, ½ front delts');
  const c = WT.setShare(WT.ex('db-curl'));
  ok(c.biceps === 1 && c.forearms === 0.25, 'curl: 1 biceps, ¼ forearms (isolation secondary)');
  ok(!('cardio' in WT.setShare(WT.ex('kb-swing'))), 'cardio is not a muscle');
}

/* ── Full body ── */
section('Full body coverage across equipment configurations');
const ALL_EQ = Object.keys(WT.EQUIPMENT);
const CONFIGS = {
  default: P.equipment.slice(),
  'dumbbells+bench': ['db', 'bench'],
  'dumbbells only': ['db'],
  'cable gym': ['cable', 'lat', 'row', 'bench'],
  'full gym': ALL_EQ,
  'machines': ['machine', 'cable', 'lat', 'row', 'bench'],
  'barbell': ['bb', 'bench', 'bar'],
  'bodyweight + bar': ['bw', 'bar'],
  'bodyweight only': ['bw'],
};
{
  let total = 0, partial = 0;
  for (const [label, equipment] of Object.entries(CONFIGS)) {
    const ctx = ctxFor({ type: 'full', equipment });
    const feasible = ['push', 'pull', 'knee', 'hip'].filter((t) => WT.P.feasible(t, ctx));
    let scoreSum = 0;
    for (let k = 0; k < 100; k++) {
      const w = gen('full', { equipment }, `full-${label}-${k}`);
      total++;
      scoreSum += w.quality.score;
      ok(w.exercises.length === 6, `full/${label}: 6 exercises — ${names(w)}`);
      ok(new Set(w.exercises.map((i) => i.exId)).size === 6, `full/${label}: no duplicates`);
      w.exercises.forEach((i) => ok(WT.hasEquipment(exOf(i), equipment) && !WT.isRestricted(exOf(i)), `full/${label}: equipment/restrictions ${i.exId}`));
      feasible.forEach((t) => ok(covered(w, t), `full/${label}: covers ${t} — ${names(w)}`));
      ['push', 'pull', 'knee', 'hip'].filter((t) => !feasible.includes(t)).forEach((t) => ok(w.notes.some((n) => n.includes(WT.P.TOKEN_LABEL[t])), `full/${label}: explains missing ${t}`));
      if (feasible.length < 4) { partial++; ok(/partial/.test(w.title), `full/${label}: labelled partial when coverage impossible`); }
      else ok(w.title === 'Full Body', `full/${label}: full title`);
      ok(!w.quality.hard.length, `full/${label}: no hard violations — ${w.quality.hard.join('; ')}`);
      // No obvious omissions / pile-ups: no muscle is the primary of more than 2 of 6 exercises
      const prim = {};
      w.exercises.forEach((i) => (prim[exOf(i).primary] = (prim[exOf(i).primary] || 0) + 1));
      ok(Math.max(...Object.values(prim)) <= 2, `full/${label}: no muscle dominates — ${names(w)}`);
      // The 5th/6th exercises are purposeful (each comes from a named slot with a reason)
      w.exercises.forEach((i) => ok(i.slot && i.slot.label && i.role && i.why && i.why.length, `full/${label}: every exercise has a role and reason`));
      const moves = {};
      w.exercises.forEach((i) => { const m = WT.moveOf(exOf(i)); moves[m] = (moves[m] || 0) + 1; });
      ok(Math.max(...Object.values(moves)) <= 2, `full/${label}: no movement pattern more than twice — ${names(w)}`);
    }
    console.log(`  ${label.padEnd(18)} feasible: ${feasible.join(', ').padEnd(22)} avg quality ${(scoreSum / 100).toFixed(1)}`);
  }
  console.log(`  ${total} full-body workouts, ${partial} in configurations where full coverage is impossible`);
  // Counts other than 6
  for (const n of [3, 4, 5, 8, 10]) {
    const w = gen('full', { count: n }, 'fullcount' + n);
    ok(w.exercises.length === n, `full count ${n}`);
    if (n >= 4) ['push', 'pull', 'knee', 'hip'].forEach((t) => ok(covered(w, t), `full ${n}: covers ${t}`));
    else ok(w.notes.some((x) => /no room/.test(x)) && /partial/.test(w.title), 'full 3: explains what does not fit');
  }
  // Avoided muscles drop a requirement with an explanation instead of faking coverage
  const wa = gen('full', { avoidMuscles: ['quads'] }, 'avoidq');
  ok(wa.exercises.every((i) => exOf(i).primary !== 'quads') && wa.notes.some((n) => /avoiding quads/i.test(n)), 'avoided quads explained');
}

/* ── Push / pull / legs / chest / arms ── */
section('Split templates');
{
  const ALLOWED = {
    push: ['chest', 'front-delts', 'side-delts', 'triceps'],
    pull: ['lats', 'upper-back', 'traps', 'rear-delts', 'biceps', 'forearms', 'lower-back'],
    legs: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abs', 'obliques', 'lower-back'],
    chest: ['chest', 'triceps', 'front-delts', 'side-delts'],
    arms: ['biceps', 'triceps', 'forearms'],
  };
  const dupPattern = (w) => {
    const seen = {};
    return w.exercises.some((i) => { const e = exOf(i); const k = e.pattern + '|' + e.primary + '|' + e.load; if (seen[k]) return true; seen[k] = 1; });
  };
  const leads = { push: {}, pull: {}, legs: {}, full: {} };
  for (const type of ['push', 'pull', 'legs', 'chest', 'arms']) {
    for (let k = 0; k < 150; k++) {
      const w = gen(type, null, `${type}-${k}`);
      const exs = w.exercises.map(exOf);
      exs.forEach((e) => ok(ALLOWED[type].includes(e.primary), `${type}: off-target ${e.id}`));
      ok(!w.quality.hard.length, `${type}: hard violations — ${w.quality.hard.join('; ')}`);
      ok(!dupPattern(w), `${type}: near-duplicate exercises — ${names(w)}`);
      const count = (moves) => exs.filter((e) => moves.includes(WT.moveOf(e))).length;
      if (leads[type]) { const l = exOf(w.exercises[0]).id; leads[type][l] = 1; }
      if (type === 'push') {
        ok(covered(w, 'h-push') && covered(w, 'v-push'), `push: horizontal and vertical pressing — ${names(w)}`);
        ok(covered(w, 'side-delt') && covered(w, 'triceps'), `push: lateral delts and triceps — ${names(w)}`);
        ok(count(['h-push', 'v-push']) <= 3, `push: at most 3 presses (triceps/front-delt overlap) — ${names(w)}`);
        ok(exs.filter((e) => e.primary === 'triceps').length <= 2, 'push: triceps support, not domination');
      }
      if (type === 'pull') {
        ok(covered(w, 'v-pull') && covered(w, 'h-pull'), `pull: vertical and horizontal pulling — ${names(w)}`);
        ok(covered(w, 'biceps') && covered(w, 'rear-delt'), `pull: biceps and rear delts — ${names(w)}`);
        ok(count(['h-pull']) <= 2, `pull: not mostly rows — ${names(w)}`);
      }
      if (type === 'legs') {
        ok(covered(w, 'knee') && covered(w, 'hip') && covered(w, 'knee-flex'), `legs: quads, hip extension, knee flexion — ${names(w)}`);
        ok(count(['knee', 'knee-uni']) <= 3, `legs: no pile of squats/lunges — ${names(w)}`);
        ok(exs.filter((e) => ['quads'].includes(e.primary)).length <= 3, 'legs: quads balanced with posterior chain');
      }
      if (type === 'chest') {
        ok(exs.filter((e) => e.primary === 'chest').length >= 5, `chest: chest dominates — ${names(w)}`);
        ok(new Set(exs.filter((e) => e.primary === 'chest').map((e) => e.pattern)).size >= 3, `chest: different angles / movements — ${names(w)}`);
      }
      if (type === 'arms') {
        const b = exs.filter((e) => e.primary === 'biceps').length, t = exs.filter((e) => e.primary === 'triceps').length;
        ok(Math.abs(b - t) <= 1, `arms: biceps/triceps balanced (${b}/${t})`);
        ok(new Set(exs.filter((e) => e.primary === 'biceps').map((e) => e.pattern)).size >= 2 && new Set(exs.filter((e) => e.primary === 'triceps').map((e) => e.pattern)).size >= 2, `arms: different functions — ${names(w)}`);
      }
    }
  }
  ok(Object.keys(leads.push).length >= 4 && Object.keys(leads.pull).length >= 4 && Object.keys(leads.legs).length >= 3, 'variety: the opening lift varies between sessions');
  // Same structure, different exercises: consecutive workouts differ
  let diff = 0;
  for (let k = 0; k < 40; k++) if (names(gen('push', null, 'v' + k)) !== names(gen('push', null, 'v' + (k + 100)))) diff++;
  ok(diff >= 35, `variety: consecutive push workouts differ (${diff}/40)`);
  // Cardio stays separate
  for (let k = 0; k < 60; k++) gen('cardio', null, 'c' + k).exercises.forEach((i) => ok(exOf(i).primary === 'cardio' || exOf(i).tags.includes('conditioning'), 'cardio: resistance exercise ' + i.exId));
}

/* ── Ordering ── */
section('Exercise order');
{
  let leadFirst = 0, N = 0;
  for (const type of ['full', 'push', 'pull', 'legs', 'chest']) {
    for (let k = 0; k < 120; k++) {
      const w = gen(type, null, `ord-${type}-${k}`);
      // Tier order over blocks (a superset block takes the tier of its earlier member)
      const tiers = WT.groupBlocks(w.exercises).map((b) => Math.min(...b.map((i) => WT.P.TIER[i.role])));
      for (let x = 1; x < tiers.length; x++) ok(tiers[x] >= tiers[x - 1], `${type}: tier order — ${w.exercises.map((i) => i.role + (i.superset || '')).join(',')}`);
      // compounds before isolations of the same muscle
      w.exercises.forEach((i, x) => {
        const e = exOf(i);
        if (e.category !== 'compound' || !['primary', 'secondary'].includes(i.role)) return;
        w.exercises.slice(0, x).forEach((j) => { const p = exOf(j); if (p.category === 'isolation' && p.primary === e.primary && i.role !== 'accessory') ok(false, `${type}: isolation ${p.id} before compound ${e.id}`); });
      });
      // Main lifts that share working muscles are not back to back when an alternative exists
      const prim = w.exercises.filter((i) => i.role === 'primary');
      if (prim.length >= 3) for (let x = 1; x < prim.length; x++) ok(WT.P.conflict(prim[x - 1], prim[x]) < 1, `${type}: main lifts alternate — ${prim.map((i) => i.exId)}`);
      const lead = w.exercises.find((i) => i.slot && i.slot.lead);
      if (lead) { N++; if (w.exercises[0] === lead) leadFirst++; }
    }
  }
  ok(leadFirst / N > 0.9, `the session's lead lift opens the workout (${leadFirst}/${N})`);
  // Objective drives order: a shoulder-priority push day often opens with an overhead press
  const saved = P.prioritize.slice();
  P.prioritize = ['side-delts', 'front-delts'];
  let ohpFirst = 0;
  for (let k = 0; k < 100; k++) if (WT.moveOf(exOf(gen('push', null, 'sp' + k).exercises[0])) === 'v-push') ohpFirst++;
  P.prioritize = saved;
  let ohpFirstBase = 0;
  for (let k = 0; k < 100; k++) if (WT.moveOf(exOf(gen('push', null, 'sp' + k).exercises[0])) === 'v-push') ohpFirstBase++;
  console.log(`  overhead press first: ${ohpFirst}% with shoulder priority vs ${ohpFirstBase}% with chest priority`);
  ok(ohpFirst > ohpFirstBase + 20, 'shoulder priority moves the shoulder compound earlier');
  // Legacy drafts without roles still order sensibly
  const legacy = WT.workoutFromSession({ type: 'push', title: 'Push', startedAt: new Date().toISOString(), exercises: [
    { exId: 'cable-pushdown', intensity: 'regular', repMin: 8, repMax: 12, sets: [] }, { exId: 'db-bench-press', intensity: 'heavy', repMin: 5, repMax: 8, sets: [] }, { exId: 'db-lateral-raise', intensity: 'regular', repMin: 12, repMax: 15, sets: [] }] });
  const lo = WT.arrange(legacy.exercises, false, 'push');
  ok(lo[0].exId === 'db-bench-press', 'legacy items: compound first');
}

/* ── Supersets ── */
section('Supersets');
{
  let withSS = 0, N = 0, pairs = 0;
  const kinds = {};
  for (const type of ['full', 'push', 'pull', 'legs', 'chest', 'arms']) {
    for (let k = 0; k < 150; k++) {
      const w = gen(type, null, `ss-${type}-${k}`);
      N++;
      const g = {};
      w.exercises.forEach((i, x) => i.superset && (g[i.superset] = g[i.superset] || []).push(x));
      if (Object.keys(g).length) withSS++;
      Object.values(g).forEach((idx) => {
        pairs++;
        ok(idx.length === 2 && idx[1] === idx[0] + 1, `${type}: pair adjacent`);
        const [a, b] = idx.map((x) => w.exercises[x]);
        const c = WT.P.pairCompat(a, b);
        ok(c.score >= 3, `${type}: compatible pair ${a.exId}+${b.exId}`);
        kinds[c.why.split(' — ')[0]] = (kinds[c.why.split(' — ')[0]] || 0) + 1;
        [a, b].forEach((i) => ok(!['primary', 'secondary'].includes(i.role), `${type}: main/secondary compounds stand alone (${i.exId})`));
        ok(!(exOf(a).category === 'compound' && exOf(b).category === 'compound'), `${type}: never two compounds`);
        [a, b].forEach((i) => ok(!['heavy', 'drop', 'buildup'].includes(i.intensity), `${type}: no heavy/staged work in supersets`));
        ok(b.rest >= WT.db.profile.rest.superset, `${type}: rest after the pair`);
        ok(w.notes.some((n) => n.startsWith('Superset ' + a.superset)), `${type}: superset explained`);
      });
    }
  }
  console.log(`  ${withSS}/${N} workouts include a superset (${pairs} pairs) — ${JSON.stringify(kinds)}`);
  ok(withSS > N * 0.1 && withSS < N * 0.6, 'supersets are optional and relatively infrequent');
  for (let k = 0; k < 80; k++) ok(gen('full', { supersets: false }, 'noss' + k).exercises.every((i) => !i.superset), 'supersets off → none');
  const pc = (a, b) => WT.P.pairCompat({ exId: a }, { exId: b }).score;
  ok(pc('db-curl', 'cable-pushdown') === 5, 'biceps + triceps = antagonists');
  ok(pc('db-lateral-raise', 'db-calf-raise') === 4, 'lateral raise + calves = non-competing');
  ok(pc('leg-extension', 'machine-leg-curl') === 4, 'quads + hamstrings isolation = antagonists');
  ok(pc('db-bench-press', 'db-shoulder-press') === 0, 'two presses compete (triceps, front delts)');
  ok(pc('db-bench-press', 'db-row') === 0, 'two compounds are not paired');
  ok(pc('db-fly', 'db-bench-press') === 0, 'same primary muscle is not paired');
  ok(pc('lat-pulldown', 'close-grip-pulldown') === 0, 'same station is not paired');
  // Time pressure → supersets used to fit; generous time → usually none
  let tight = 0, loose = 0;
  for (let k = 0; k < 60; k++) {
    if (gen('push', { count: 8, duration: 45 }, 'tight' + k).exercises.some((i) => i.superset)) tight++;
    if (gen('push', { count: 5, duration: 90 }, 'loose' + k).exercises.some((i) => i.superset)) loose++;
  }
  console.log(`  short session: ${tight}/60 with supersets; long session: ${loose}/60`);
  ok(tight > loose, 'supersets respond to duration');
}

/* ── Intensity ── */
section('Intensity programming');
{
  const t = { heavy: 0, regular: 0, burnout: 0, standard: 0, drop: 0, buildup: 0 };
  let none = 0, N = 0, heavyOnMain = 0, heavyAll = 0, burnIso = 0, burnAll = 0, combos = {};
  for (const type of ['full', 'push', 'pull', 'legs', 'chest', 'arms']) {
    for (let k = 0; k < 250; k++) {
      const w = gen(type, null, `int-${type}-${k}`);
      N++;
      const tally = WT.intensityTally(w.exercises);
      combos[JSON.stringify(tally)] = 1;
      const adv = w.exercises.filter((i) => !['regular', 'standard'].includes(i.intensity));
      if (!adv.length) none++;
      ok(adv.length <= Math.ceil(w.exercises.length / 2), `${type}: advanced work is a minority`);
      ok((tally.drop || 0) + (tally.buildup || 0) <= 1, `${type}: at most one multi-stage exercise`);
      ok((tally.heavy || 0) <= Math.ceil(w.exercises.length / 2), `${type}: heavy cap`);
      w.exercises.forEach((i) => {
        const ex = exOf(i);
        t[i.intensity]++;
        ok(ex.intensities.includes(i.intensity) || (WT.STAGED[i.intensity] && WT.canStage(ex)), `${type}: eligible ${i.intensity} on ${ex.id}`);
        if (i.intensity === 'heavy') { heavyAll++; if (['primary', 'secondary'].includes(i.role) || type === 'arms') heavyOnMain++; }
        if (i.intensity === 'burnout') { burnAll++; if (['isolation', 'core'].includes(i.role)) burnIso++; ok(i.role !== 'primary', `${type}: no burnout on a main lift (${ex.id})`); ok(!ex.tags.includes('spinal-load'), 'burnout spinal'); }
        if (i.intensity === 'drop') ok(WT.canStage(ex) && ex.category === 'isolation' && i.sets === 2 && i.stageCount === 3, `${type}: drop set only on a suitable isolation (${ex.id})`);
        if (i.intensity === 'buildup') ok(WT.canStage(ex) && ex.category === 'compound' && ['primary', 'secondary'].includes(i.role) && i.sets === 2, `${type}: build-up only on a loadable main/secondary compound (${ex.id})`);
      });
    }
  }
  const items = Object.values(t).reduce((a, b) => a + b, 0);
  const reg = (t.regular + t.standard) / items;
  console.log(`  ${N} workouts: regular/standard ${(100 * reg).toFixed(0)}%, heavy ${(100 * t.heavy / items).toFixed(1)}%, burnout ${(100 * t.burnout / items).toFixed(1)}%, drop ${t.drop}, build-up ${t.buildup}; ${(100 * none / N).toFixed(0)}% with no advanced technique; ${Object.keys(combos).length} distinct mixes`);
  console.log(`  heavy on main/secondary lifts ${heavyOnMain}/${heavyAll}; burnout on isolation/core ${burnIso}/${burnAll}`);
  ok(reg >= 0.65, 'regular work dominates');
  ok(none / N >= 0.15, 'some workouts have no advanced techniques at all');
  ok(heavyOnMain / heavyAll >= 0.85, 'heavy assigned to main lifts');
  ok(burnIso / burnAll >= 0.75, 'burnout assigned to isolation / accessory work');
  ok(t.drop > 0 && t.buildup > 0 && t.drop + t.buildup < N * 0.2, 'drop and build-up sets appear occasionally');
  ok(Object.keys(combos).length >= 15, 'intensity mixes vary');
  // Settings respected
  P.burnouts = false;
  for (let k = 0; k < 100; k++) gen('arms', null, 'nb' + k).exercises.forEach((i) => ok(!['burnout', 'drop'].includes(i.intensity), 'burnouts off → no burnout or drop sets'));
  P.burnouts = true;
  P.stagedSets = false;
  for (let k = 0; k < 100; k++) gen('push', null, 'ns' + k).exercises.forEach((i) => ok(!WT.STAGED[i.intensity], 'staged sets off'));
  delete P.stagedSets;
  P.experience = 'beginner';
  for (let k = 0; k < 100; k++) {
    const w = gen('full', null, 'beg' + k);
    ok(w.exercises.filter((i) => i.intensity === 'heavy').length <= 1 && !w.exercises.some((i) => i.intensity === 'drop'), 'beginner: at most one heavy exercise, no drop sets');
  }
  P.experience = 'intermediate';
  // Re-roll keeps the exercises and the structure
  const w = gen('push', null, 'reroll');
  const ids = w.exercises.map((i) => i.exId).sort().join();
  w.exercises.forEach((i) => (i.intensity = null));
  WT.randomizeIntensities(w.exercises);
  w.exercises.forEach((i) => Object.assign(i, WT.prescribe(exOf(i), i.intensity)));
  ok(WT.arrange(w.exercises, true, 'push').map((i) => i.exId).sort().join() === ids, 're-roll keeps exercises');
}

/* ── Volume & recovery ── */
section('Weekly volume and recovery');
{
  ok(WT.weeklyTarget('lats') === 10 && WT.weeklyTarget('chest') === 14 && WT.weeklyTarget('calves') === 4, 'weekly reference: 10 sets, priorities 14, small muscles 4');
  P.experience = 'beginner'; ok(WT.weeklyTarget('lats') === 8, 'beginner reference 8'); P.experience = 'intermediate';
  const addSess = (hoursAgo, exId, n) => {
    const d = new Date(Date.now() - hoursAgo * 3600e3).toISOString();
    WT.db.history.push({ id: WT.uid(), type: 'full', title: 'T', startedAt: d, endedAt: d, exercises: [{ uid: WT.uid(), exId, intensity: 'regular', repMin: 8, repMax: 12, targetSets: n, sets: Array.from({ length: n }, () => ({ w: 40, r: 10, done: true })) }] });
  };
  const saved = WT.db.history;
  WT.db.history = [];
  addSess(10, 'db-bench-press', 4);
  const f = WT.recentFatigue();
  ok(f.chest === 4 && f.triceps === 2, 'fractional fatigue: 4 bench sets = 4 chest, 2 triceps');
  WT.db.history = [];
  addSess(48, 'db-bench-press', 4);
  ok(Math.abs(WT.recentFatigue().chest - 2) < 0.01, 'fatigue fades: 48 h ago counts half');
  WT.db.history = [];
  addSess(80, 'db-bench-press', 4);
  ok(!WT.recentFatigue().chest && WT.muscleLoad(24 * 7).chest === 4, 'after 72 h fatigue is gone; weekly volume still counts');
  // Heavy recent biceps/triceps work → a full-body day picks fewer arm extras
  const armShare = () => { let a = 0; for (let k = 0; k < 150; k++) a += gen('full', null, 'arm' + k).exercises.filter((i) => ['biceps', 'triceps'].includes(exOf(i).primary)).length; return a; };
  WT.db.history = [];
  const base = armShare();
  for (let d = 0; d < 3; d++) { addSess(20 + d * 30, 'db-curl', 6); addSess(20 + d * 30, 'cable-pushdown', 6); }
  const after = armShare();
  console.log(`  arm isolation picks in 150 full-body days: ${base} fresh vs ${after} after a high-volume arm week`);
  ok(after < base * 0.7, 'recent arm volume reduces arm extras');
  // Under-trained muscles get attention — but the workout is not overloaded with them
  WT.db.history = [];
  for (let d = 0; d < 3; d++) { addSess(30 + d * 40, 'goblet-squat', 6); addSess(30 + d * 40, 'db-bench-press', 6); addSess(30 + d * 40, 'db-row', 6); addSess(30 + d * 40, 'db-hip-thrust', 6); }
  let rear = 0;
  for (let k = 0; k < 150; k++) {
    const w = gen('full', null, 'lag' + k);
    if (w.exercises.some((i) => exOf(i).primary === 'rear-delts' || exOf(i).primary === 'side-delts')) rear++;
    const sess = WT.P.sessionSets(w.exercises);
    Object.entries(sess).forEach(([m, v]) => ok(v <= WT.P.sessionCap(m, ctxFor({ type: 'full' })) + 3, `session volume cap ${m} ${v}`));
  }
  WT.db.history = [];
  let rearBase = 0;
  for (let k = 0; k < 150; k++) if (gen('full', null, 'lag' + k).exercises.some((i) => ['rear-delts', 'side-delts'].includes(exOf(i).primary))) rearBase++;
  console.log(`  delt extras: ${rear}/150 when delts are behind for the week vs ${rearBase}/150 with no history`);
  ok(rear > rearBase, 'muscles behind on weekly volume are favoured');
  WT.db.history = saved;
}

/* ── Swapping ── */
section('Role-preserving swaps');
{
  let preserved = 0, N = 0;
  for (const type of ['full', 'push', 'pull', 'legs']) {
    for (let k = 0; k < 60; k++) {
      const w = gen(type, null, `sw-${type}-${k}`);
      w.exercises.filter((i) => ['primary', 'secondary'].includes(i.role)).forEach((it) => {
        const alts = WT.alternatives(w, it.uid);
        if (!alts.length) return;
        N++;
        const top = alts[0];
        ok(!w.exercises.some((e) => e.exId === top.ex.id), 'swap: no duplicate');
        if (top.preservesRole) preserved++;
        ok(top.ex.primary === exOf(it).primary || (it.slot.m || []).includes(top.ex.primary), `swap: keeps the muscle (${it.exId} → ${top.ex.id})`);
        // Apply the swap and re-check coverage
        const copy = JSON.parse(JSON.stringify(w));
        const target = copy.exercises.find((e) => e.uid === it.uid);
        WT.applySwap(target, top.ex.id);
        (w.requires || []).forEach((t) => { if (covered(w, t)) ok(covered(copy, t), `swap: no coverage gap ${t} (${it.exId} → ${top.ex.id})`); });
        ok(target.role === it.role && target.slot.label === it.slot.label, 'swap: role and slot preserved');
        ok(new Set(copy.exercises.map((e) => e.exId)).size === copy.exercises.length, 'swap: still no duplicates');
      });
    }
  }
  console.log(`  top suggestion preserved the movement role in ${preserved}/${N} main-lift swaps`);
  ok(preserved / N >= 0.95, 'swaps preserve the programming role');
  // Replace the exercise that fills a given movement role; the best suggestion should fill the same role
  const roleOf = (move, type) => {
    let res = null;
    for (let k = 0; k < 30 && !res; k++) {
      const w = gen(type, null, 'sr' + move + k);
      const it = w.exercises.find((i) => WT.moveOf(exOf(i)) === move && ['primary', 'secondary'].includes(i.role));
      if (it) res = WT.alternatives(w, it.uid).slice(0, 3).map((a) => WT.moveOf(a.ex));
    }
    return res || [];
  };
  ok(roleOf('h-push', 'push').every((m) => m === 'h-push'), 'replacing a bench press suggests other horizontal pushes');
  ok(roleOf('knee', 'legs').every((m) => m === 'knee'), 'replacing a squat suggests other knee-dominant lifts');
  ok(roleOf('h-pull', 'pull').every((m) => m === 'h-pull'), 'replacing a row suggests other horizontal pulls');
  // No suitable substitute → limitation explained, free choice still possible
  // A pull day whose only horizontal pull is the row being replaced
  let w = null;
  for (let k = 0; k < 50 && !w; k++) { const c = gen('pull', null, 'limit' + k); if (c.exercises.filter((i) => WT.moveOf(exOf(i)) === 'h-pull').length === 1) w = c; }
  const row = w.exercises.find((i) => WT.moveOf(exOf(i)) === 'h-pull');
  const savedEx = P.excluded.slice();
  P.excluded = WT.exercises.filter((e) => WT.moveOf(e) === 'h-pull' && e.id !== row.exId).map((e) => e.id);
  const narrow = WT.alternatives(w, row.uid);
  const wide = WT.alternatives(w, row.uid, { wide: true });
  ok(!!narrow.limitation && /horizontal|row/i.test(narrow.limitation), 'limitation explained: ' + narrow.limitation);
  ok(wide.length > narrow.length, 'wide search still lets you choose freely');
  ok(wide.some((a) => a.gap.length), 'alternatives that would leave a gap are marked');
  P.excluded = savedEx;
  // applySwap explains the kept role
  const ww = gen('push', null, 'why');
  const first = ww.exercises[0];
  WT.applySwap(first, WT.alternatives(ww, first.uid)[0].ex.id);
  ok(/keeps the/.test(first.why[0]), 'swap reason mentions the kept role');
}

/* ── Quality score ── */
section('Quality evaluation');
{
  const ctx = ctxFor({ type: 'full' });
  const bad = { type: 'full', settings: WT.defaultSettings('full'), requires: ['knee', 'push', 'pull', 'hip'], exercises: ['db-bench-press', 'db-incline-press', 'db-fly', 'cable-fly', 'db-decline-press', 'pushup'].map((id, k) => Object.assign({ uid: 'b' + k, exId: id, role: k < 2 ? 'primary' : 'isolation' }, WT.prescribe(WT.ex(id), 'regular'))) };
  const qb = WT.P.evaluate(bad, ctx);
  ok(qb.hard.some((h) => /knee-dominant/.test(h)) && qb.hard.some((h) => /pull/.test(h)), 'six chest exercises labelled full body fail the hard checks');
  ok(qb.dims.redundancy < 0.5, 'redundancy detected');
  let sum = 0, min = 100, attempts = 0;
  for (let k = 0; k < 200; k++) { const w = gen('full', null, 'q' + k); sum += w.quality.score; min = Math.min(min, w.quality.score); attempts += w.quality.attempts; }
  console.log(`  full body: mean quality ${(sum / 200).toFixed(1)}, min ${min}, mean attempts ${(attempts / 200).toFixed(2)}; hand-built 6× chest "full body": ${qb.score} with ${qb.hard.length} hard failures`);
  ok(sum / 200 >= 90 && min >= 75, 'generated workouts score well');
  ok(attempts / 200 < 1.5, 'regeneration is rarely needed (generator is not over-constrained)');
}

/* ── Determinism ── */
section('Determinism');
{
  const a = gen('full', null, 'same'), b = gen('full', null, 'same');
  ok(JSON.stringify(a.exercises.map((i) => [i.exId, i.intensity, i.sets, i.superset])) === JSON.stringify(b.exercises.map((i) => [i.exId, i.intensity, i.sets, i.superset])), 'same seed → same workout');
  ok(names(gen('full', null, 'x1')) !== names(gen('full', null, 'x2')) || names(gen('full', null, 'x3')) !== names(gen('full', null, 'x4')), 'different seeds → different workouts');
  const r1 = names(WT.generate(WT.defaultSettings('full'))), r2 = names(WT.generate(WT.defaultSettings('full'))), r3 = names(WT.generate(WT.defaultSettings('full')));
  ok(!(r1 === r2 && r2 === r3), 'unseeded generation stays random');
  const t0 = Date.now();
  for (let k = 0; k < 300; k++) gen(['full', 'push', 'pull', 'legs', 'chest', 'arms'][k % 6], null, 'perf' + k);
  const ms = Date.now() - t0;
  console.log(`  300 workouts in ${ms} ms`);
  ok(ms < 15000, 'generation is fast');
}

/* ── Audit fixes (tools/audit-workouts.js findings) ── */
section('Quality-audit regressions');
{
  const savedHist = WT.db.history;
  const addSess = (hoursAgo, list) => { const d = new Date(Date.now() - hoursAgo * 3600e3).toISOString(); WT.db.history.push({ id: WT.uid(), type: 'legs', title: 'T', startedAt: d, endedAt: d, exercises: list.map(([exId, n]) => ({ uid: WT.uid(), exId, intensity: 'regular', repMin: 8, repMax: 12, targetSets: n, sets: Array.from({ length: n }, () => ({ w: 30, r: 10, done: true })) })) }); };
  // 1. Recovery: the day after legs, a full-body session adds no extra lower-body work and no heavy lower-body loading
  WT.db.history = [];
  addSess(20, [['goblet-squat', 4], ['bulgarian-split-squat', 3], ['db-hip-thrust', 4], ['db-leg-curl', 3]]);
  let extraLower = 0;
  for (let k = 0; k < 150; k++) {
    const w = gen('full', null, 'rec' + k);
    const lower = w.exercises.filter((i) => ['quads', 'glutes', 'hamstrings', 'adductors'].includes(exOf(i).primary));
    if (lower.length > 2) extraLower++;
    lower.forEach((i) => ok(!['heavy', 'buildup'].includes(i.intensity), `recovery: no heavy loading on just-trained legs (${i.exId} ${i.intensity})`));
    lower.filter((i) => exOf(i).category === 'compound').forEach((i) => ok(i.sets <= 3, `recovery: just-trained compound trimmed (${i.exId} ${i.sets})`));
  }
  ok(extraLower <= 8, `recovery: extra lower-body exercises the day after legs (${extraLower}/150)`);
  WT.db.history = [];
  // 2. Full-body balance (direct sets per area)
  let imbalanced = 0, lowLower = 0;
  for (let k = 0; k < 200; k++) {
    const a = WT.P.areaSets(gen('full', null, 'bal' + k).exercises);
    if (a.push >= 2 * a.pull || a.pull >= 2 * a.push) imbalanced++;
    if (a.lower / (a.push + a.pull + a.lower) < 0.3) lowLower++;
  }
  console.log(`  full body: ${imbalanced}/200 with a 2:1 push/pull split (mostly priority-driven), ${lowLower}/200 with <30% lower-body sets`);
  ok(imbalanced <= 40 && lowLower <= 10, 'full body stays balanced across push, pull and lower body');
  // 3. Sparse equipment: no off-role or near-identical padding
  for (const type of ['pull', 'push', 'chest', 'arms']) for (let k = 0; k < 40; k++) {
    const w = gen(type, { equipment: ['bw', 'bar', 'bench'] }, `sparse-${type}-${k}`);
    const exs = w.exercises.map(exOf);
    exs.forEach((e, x) => ok(!WT.P.redundantWith(e, exs.slice(0, x).concat(exs.slice(x + 1)).filter((o) => o !== e)) || w.exercises[x].role === 'primary' || !w.exercises[x].slot.pad, `sparse ${type}: redundant padding ${e.id}`));
    if (type === 'pull') exs.forEach((e) => ok(e.primary !== 'lower-back', 'sparse pull: no lower-back filler (' + e.id + ')'));
    // Near-identical bodyweight variants (same muscle, pattern and declared role) are not stacked
    exs.forEach((e, x) => exs.slice(x + 1).forEach((f) => ok(!(e.primary === f.primary && e.pattern === f.pattern && ['bw', 'bwl', 'time'].includes(e.load) && ['bw', 'bwl', 'time'].includes(f.load) && (e.moves2 || []).join() === (f.moves2 || []).join()), `sparse ${type}: ${e.id} ≈ ${f.id}`)));
  }
  // 4. Experience fit
  P.experience = 'beginner';
  for (const type of ['full', 'push', 'pull', 'legs', 'chest']) for (let k = 0; k < 60; k++) gen(type, null, `beg-${type}-${k}`).exercises.forEach((i) => ok(exOf(i).difficulty !== 'advanced', `beginner: no advanced exercise with full equipment (${i.exId})`));
  P.experience = 'intermediate';
  for (const type of ['push', 'chest', 'full']) for (let k = 0; k < 80; k++) gen(type, null, `reg-${type}-${k}`).exercises.filter((i) => ['primary', 'secondary'].includes(i.role)).forEach((i) => ok(!exOf(i).harder, `trained lifter: no easy regression as a main/secondary lift (${i.exId})`));
  // 5. Push-day triceps: after three presses, one direct triceps exercise
  for (let k = 0; k < 150; k++) {
    const exs = gen('push', null, 'tri' + k).exercises.map(exOf);
    if (exs.filter((e) => ['h-push', 'v-push'].includes(WT.moveOf(e))).length >= 3) ok(exs.filter((e) => e.primary === 'triceps').length <= 1, 'push: one triceps isolation after three presses — ' + exs.map((e) => e.id));
  }
  // 6. Practical supersets
  for (const type of ['arms', 'push', 'pull', 'legs', 'chest', 'full']) for (let k = 0; k < 100; k++)
    WT.groupBlocks(gen(type, { count: 7, duration: 45 }, `prac-${type}-${k}`).exercises).filter((b) => b.length > 1).forEach(([a, b]) => {
      const x = exOf(a), y = exOf(b);
      ok(!(x.equipment.includes('cable') && y.equipment.includes('cable')), `superset: one cable station (${x.id} + ${y.id})`);
      ok(!(x.equipment.includes('bench') && y.equipment.includes('bench')), `superset: one bench (${x.id} + ${y.id})`);
    });
  // 7. Holds aren't used as hypertrophy isolation when real options exist
  for (const type of ['pull', 'arms']) for (let k = 0; k < 100; k++) gen(type, null, `hold-${type}-${k}`).exercises.filter((i) => ['biceps', 'forearms'].includes(exOf(i).primary)).forEach((i) => ok(exOf(i).load !== 'time', `${type}: timed hold as isolation (${i.exId})`));
  // 8. Redundancy inside a session
  let latStack = 0, sameRow = 0, rows2 = 0;
  for (let k = 0; k < 200; k++) {
    const exs = gen('pull', null, 'red' + k).exercises.map(exOf);
    if (exs.filter((e) => WT.moveOf(e) === 'v-pull').length >= 2 && exs.some((e) => WT.moveOf(e) === 'lat-iso')) latStack++;
    const rows = exs.filter((e) => WT.moveOf(e) === 'h-pull');
    if (rows.length === 2) { rows2++; if (rows[0].primary === rows[1].primary) sameRow++; }
  }
  ok(latStack === 0, 'pull: never two vertical pulls plus a lat isolation');
  ok(sameRow <= rows2 * 0.25, `pull: a second row usually targets the other muscle (${sameRow}/${rows2} same)`);
  for (const type of ['push', 'chest']) for (let k = 0; k < 150; k++) {
    const ps = gen(type, null, `ang-${type}-${k}`).exercises.filter((i) => exOf(i).primary === 'chest' && WT.moveOf(exOf(i)) === 'h-push').map(exOf);
    if (ps.length >= 2) ok(ps[0].pattern !== ps[1].pattern || ps[0].load !== ps[1].load, `${type}: the first two chest presses differ (${ps[0].id}, ${ps[1].id})`);
    if (type === 'push' && ps.length >= 2) ok(ps[0].pattern !== ps[1].pattern, `push: second chest press uses a different angle (${ps[0].id}, ${ps[1].id})`);
  }
  // 9. Labels describe the movement actually chosen
  for (let k = 0; k < 60; k++) gen('push', { equipment: ['bw', 'bar', 'bench'] }, 'lab' + k).exercises.forEach((i) => {
    const mv = WT.moveOf(exOf(i));
    if (mv === 'h-push' && exOf(i).primary === 'chest') ok(!/overhead/i.test(i.slot.label), `label: ${i.exId} is not an overhead press (${i.slot.label})`);
  });
  WT.db.history = savedHist;
}

/* ── Regression ── */
section('Regression: data, progression, editing');
{
  // History and preferences untouched by generation
  const addS = (daysAgo, exId, sets) => { const d = new Date(Date.now() - daysAgo * 864e5).toISOString(); WT.db.history.push({ id: WT.uid(), type: 'full', title: 'T', startedAt: d, endedAt: d, exercises: [{ uid: WT.uid(), exId, intensity: 'regular', targetSets: sets.length, repMin: 8, repMax: 12, sets: sets.map(([w, r]) => ({ w, r, done: true })) }] }); };
  addS(4, 'db-incline-press', [[40, 12], [40, 12], [40, 12]]);
  const hist = histSnapshot(), prof = JSON.stringify(WT.db.profile), lib = WT.exercises.length;
  for (let k = 0; k < 50; k++) gen(['full', 'push', 'legs'][k % 3], null, 'reg' + k);
  ok(histSnapshot() === hist, 'history unchanged by generation');
  ok(JSON.stringify(WT.db.profile) === prof, 'preferences unchanged by generation');
  ok(WT.exercises.length === lib && lib >= 185, 'exercise library unchanged');
  // Progression: confirmed performance is still the only basis
  let r = WT.recommend('db-incline-press', { repMin: 8, repMax: 12, sets: 3, intensity: 'regular' });
  ok(r.action === 'increase' && r.weight === 45, 'all sets at the top of the range → increase');
  addS(1, 'db-incline-press', [[45, 9], [45, 8], [45, 7]]);
  r = WT.recommend('db-incline-press', { repMin: 8, repMax: 12, sets: 3, intensity: 'regular' });
  ok(r.action === 'hold' && r.weight === 45, 'not enough evidence → hold, no increase');
  ok(WT.recommend('db-fly', { repMin: 10, repMax: 15, sets: 3, intensity: 'regular' }).action === 'new', 'no history → no recommendation to increase');
  // A generated workout becomes a session with staged sets intact
  let staged = null;
  for (let k = 0; k < 200 && !staged; k++) { const w = gen('push', null, 'st' + k); if (w.exercises.some((i) => WT.STAGED[i.intensity])) staged = w; }
  ok(!!staged, 'found a workout with a multi-stage set');
  const s = WT.sessionFromWorkout(staged);
  const si = s.exercises.find((e) => WT.STAGED[e.intensity]);
  ok(si.sets.every((x) => x.type === si.intensity && x.stages.length === 3), 'generated drop/build-up sets log as multi-stage sets');
  // Editing: remove, reorder, add — arrange keeps everything and re-validates supersets
  const w = gen('arms', { supersets: true }, 'edit');
  const added = Object.assign({ uid: 'added', exId: 'db-wrist-curl', locked: true, slot: { label: 'Forearms', m: ['forearms'], p: null } }, WT.prescribe(WT.ex('db-wrist-curl'), 'regular'));
  const edited = w.exercises.slice(1).concat([added]);
  const out = WT.arrange(edited, true, 'arms');
  ok(out.length === edited.length && out.some((i) => i.exId === 'db-wrist-curl'), 'arrange keeps every item after edits');
  Object.values(out.reduce((g, i, x) => (i.superset && (g[i.superset] = (g[i.superset] || []).concat(x)), g), {})).forEach((idx) => ok(idx.length === 2 && idx[1] === idx[0] + 1, 'supersets stay valid after edits'));
  // Locked exercises survive regeneration in their role
  const base = gen('full', null, 'lock');
  const lock = Object.assign({}, base.exercises.find((i) => i.role === 'primary'), { locked: true });
  const regen = WT.generate(Object.assign(WT.defaultSettings('full'), { seed: 'lock2' }), [lock]);
  ok(regen.exercises.some((i) => i.exId === lock.exId && i.locked), 'locked exercise kept on regenerate');
  ok(regen.exercises.length === 6 && ['push', 'pull', 'knee', 'hip'].every((t) => covered(regen, t)), 'regenerate around a locked lift keeps full coverage');
  // Manual (fixed) intensity mode still honoured
  const wm = gen('push', { intensityMode: 'manual', heavy: 2, burnout: 1 }, 'manual');
  const hv = wm.exercises.filter((i) => i.intensity === 'heavy');
  ok(hv.length === 2 && hv.every((i) => ['primary', 'secondary'].includes(i.role)), 'fixed mode: heavy goes to the main lifts');
  ok(wm.exercises.filter((i) => i.intensity === 'burnout').every((i) => ['isolation', 'core', 'accessory'].includes(i.role)), 'fixed mode: burnout goes to isolation work');
  // Exclusions / favorites / restrictions still respected
  P.excluded = ['goblet-squat', 'db-bench-press'];
  for (let k = 0; k < 40; k++) gen('full', null, 'ex' + k).exercises.forEach((i) => ok(!P.excluded.includes(i.exId), 'excluded respected'));
  P.excluded = [];
  let fav = 0;
  for (let k = 0; k < 100; k++) if (gen('legs', null, 'fav' + k).exercises.some((i) => i.exId === 'sissy-squat')) fav++;
  ok(fav > 30, `favorites still favoured (${fav}/100 leg days include Sissy Squat)`);
  for (let k = 0; k < 40; k++) gen('legs', null, 'r' + k).exercises.forEach((i) => ok(!WT.isRestricted(exOf(i)), 'restrictions respected'));
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
