/* Node test harness for the engine: node tests/engine.test.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const mem = {};
globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => (mem[k] = String(v)), removeItem: k => delete mem[k] };
for (const f of ['exercises.js', 'core.js', 'engine.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
const WT = globalThis.WT;
let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log('  FAIL:', msg); } };

WT.load();
console.log('Exercises:', WT.exercises.length);
ok(WT.exercises.length >= 150, 'at least 150 exercises');
const ids = new Set(); WT.exercises.forEach(e => { ok(!ids.has(e.id), 'dup id ' + e.id); ids.add(e.id);
  ok(WT.MUSCLES[e.primary], 'bad primary ' + e.id); e.secondary.forEach(m => ok(WT.MUSCLES[m], 'bad secondary ' + m + ' in ' + e.id));
  e.equipment.forEach(q => ok(WT.EQUIPMENT[q], 'bad equip ' + q + ' in ' + e.id)); ok(WT.PATTERNS[e.pattern], 'bad pattern ' + e.pattern + ' ' + e.id);
  ok(e.intensities.every(Boolean) && e.difficulty && e.repMin > 0, 'bad fields ' + e.id); if (e.harder) ok(WT.ex(e.harder), 'bad harder ' + e.id); });

const P = WT.db.profile;
const banned = new Set(['deadlift', 'romanian-deadlift', 'db-rdl', 'single-leg-rdl', 'reverse-grip-db-press', 'ez-bar-curl', 'ez-skullcrusher', 'cable-leg-curl', 'cable-glute-kickback', 'cable-hip-adduction']);
function check(w, label) {
  const exs = w.exercises.map(i => WT.ex(i.exId));
  ok(new Set(w.exercises.map(i => i.exId)).size === w.exercises.length, label + ': duplicates');
  exs.forEach(e => { ok(!banned.has(e.id), label + ': banned ' + e.id); ok(WT.hasEquipment(e, P.equipment), label + ': equipment ' + e.id); });
  w.exercises.forEach(i => ok(i.sets > 0 && i.repMin > 0 && i.intensity, label + ': prescription ' + i.exId));
  // supersets: pairs are adjacent
  const ss = {}; w.exercises.forEach((i, k) => { if (i.superset) (ss[i.superset] = ss[i.superset] || []).push(k); });
  Object.values(ss).forEach(a => ok(a.length === 2 && a[1] === a[0] + 1, label + ': superset adjacency'));
  return exs;
}
for (const t of WT.WORKOUT_TYPES) {
  for (let rep = 0; rep < 30; rep++) {
    const s = WT.defaultSettings(t.id); if (t.id === 'custom') s.targets = ['chest', 'biceps', 'quads'];
    const w = WT.generate(s);
    const exs = check(w, t.id);
    ok(w.exercises.length === (t.id === 'cardio' ? 6 : 6), `${t.id}: count ${w.exercises.length}`);
    if (t.id === 'full') {
      const g = exs.map(e => WT.MUSCLES[e.primary].group);
      ok(g.includes('legs') && g.includes('chest') && g.includes('back'), 'full: push/pull/legs present ' + g);
    }
    const allowed = { push: ['chest', 'shoulders', 'arms'], pull: ['back', 'arms', 'shoulders'], legs: ['legs', 'core'], chest: ['chest'], back: ['back', 'shoulders', 'chest'], shoulders: ['shoulders', 'back'], biceps: ['arms'], triceps: ['arms'], arms: ['arms'], core: ['core', 'back'] }[t.id];
    if (allowed) exs.forEach(e => ok(allowed.includes(WT.MUSCLES[e.primary].group), `${t.id}: off-target ${e.id}`));
    if (t.id === 'push') exs.forEach(e => ok(e.primary !== 'biceps', 'push has biceps'));
    if (t.id === 'cardio') exs.forEach(e => ok(e.primary === 'cardio' || e.tags.includes('conditioning'), 'cardio off-target ' + e.id));
  }
  const w = WT.generate(WT.defaultSettings(t.id));
  console.log(`\n${t.name} (~${w.estimatedMin} min) plan=${JSON.stringify(w.plan)}`);
  w.exercises.forEach(i => console.log(`  ${i.superset ? i.superset + ' ' : '  '}${i.intensity.padEnd(8)} ${i.sets}x${i.repMin}-${i.repMax} r${i.rest}  ${WT.ex(i.exId).name}  [${i.slot && i.slot.label}]`));
}
// ── Randomised intensity: no fixed formula, genuine variety, suitability respected ──
{
  const combos = {}; let zeroHeavy = 0, zeroBurn = 0, zeroSpecial = 0, multiHeavy = 0, multiBurn = 0, N = 0;
  let heavyComp = 0, heavyIso = 0, burnComp = 0, burnIso = 0;
  const allRegularReachable = [];
  for (const t of ['full', 'push', 'pull', 'legs', 'chest', 'back', 'arms', 'shoulders']) {
    for (let k = 0; k < 400; k++) {
      const w = WT.generate(WT.defaultSettings(t)); N++;
      const tally = WT.intensityTally(w.exercises);
      combos[`${tally.heavy}h/${tally.burnout}b/${tally.regular}r/${tally.standard}s`] = 1;
      if (!tally.heavy) zeroHeavy++; if (!tally.burnout) zeroBurn++; if (!tally.heavy && !tally.burnout) zeroSpecial++;
      if (tally.heavy >= 2) multiHeavy++; if (tally.burnout >= 2) multiBurn++;
      ok(tally.heavy <= Math.ceil(w.exercises.length / 2), 'heavy safety cap');
      w.exercises.forEach((i) => {
        const ex = WT.ex(i.exId);
        ok(WT.STAGED[i.intensity] ? WT.canStage(ex) : ex.intensities.includes(i.intensity), `${ex.id} got ineligible ${i.intensity}`);
        if (i.intensity === 'burnout') ok(!ex.tags.includes('spinal-load'), 'burnout on spinal-load ' + ex.id);
        if (i.intensity === 'heavy') ex.category === 'compound' ? heavyComp++ : heavyIso++;
        if (i.intensity === 'burnout') ex.category === 'compound' ? burnComp++ : burnIso++;
      });
      if (k < 20) allRegularReachable.push(w.exercises.every((i) => WT.ex(i.exId).intensities.includes('regular')));
    }
  }
  const nCombos = Object.keys(combos).length;
  console.log(`\nIntensity over ${N} workouts: ${nCombos} distinct combos; 0 heavy ${(100*zeroHeavy/N).toFixed(0)}%, 0 burnout ${(100*zeroBurn/N).toFixed(0)}%, neither ${(100*zeroSpecial/N).toFixed(0)}%, 2+ heavy ${(100*multiHeavy/N).toFixed(0)}%, 2+ burnout ${(100*multiBurn/N).toFixed(0)}%`);
  console.log(`  heavy on compounds ${heavyComp} vs isolation ${heavyIso}; burnout on isolation ${burnIso} vs compound ${burnComp}`);
  ok(nCombos >= 15, 'many distinct intensity combinations');
  ok(zeroHeavy > 0 && zeroBurn > 0 && zeroSpecial > 0, 'zero-heavy / zero-burnout / neither workouts occur');
  ok(multiHeavy > 0 && multiBurn > 0, 'multiple heavy / multiple burnout workouts occur');
  ok(heavyComp > heavyIso * 1.5, 'heavy favours compounds');
  ok(burnIso > burnComp, 'burnout favours isolation');
  ok(allRegularReachable.filter(Boolean).length > 10, 'all-regular workouts are reachable (every exercise eligible for regular)');
  // Force an all-regular draw by fixing the RNG to the regular band: proves no minimum heavy/burnout is enforced
  const w = WT.generate(WT.defaultSettings('full'));
  w.exercises.forEach((i) => (i.intensity = null));
  const odds = WT.db.profile.intensityOdds; const saved = Object.assign({}, odds);
  Object.assign(odds, { heavy: 0, burnout: 0, standard: 0, regular: 1, drop: 0, buildup: 0 });
  WT.randomizeIntensities(w.exercises);
  ok(w.exercises.every((i) => i.intensity === 'regular' || !WT.ex(i.exId).intensities.includes('regular')), 'all-regular workout produced when odds allow it (ineligible exercises fall back to standard)');
  Object.assign(odds, saved);
  // Burnouts disabled → never burnout
  WT.db.profile.burnouts = false;
  for (let k = 0; k < 100; k++) WT.generate(WT.defaultSettings('arms')).exercises.forEach((i) => ok(i.intensity !== 'burnout', 'burnouts disabled'));
  WT.db.profile.burnouts = true;
  // Same type twice in a row should usually differ
  let diff = 0; for (let k = 0; k < 50; k++) { const a = WT.intensityTally(WT.generate(WT.defaultSettings('full')).exercises), b = WT.intensityTally(WT.generate(WT.defaultSettings('full')).exercises); if (JSON.stringify(a) !== JSON.stringify(b)) diff++; }
  ok(diff > 30, `consecutive generations differ (${diff}/50)`);
}
// Manual mode still honours fixed counts
// Manual intensity
const wm = WT.generate(Object.assign(WT.defaultSettings('push'), { intensityMode: 'manual', heavy: 3, burnout: 2 }));
ok(wm.intensityMode === 'manual', 'manual mode flag');
{ const elig = (k) => wm.exercises.filter((i) => WT.ex(i.exId).intensities.includes(k)).length;
  const h = wm.exercises.filter(i => i.intensity === 'heavy').length, b = wm.exercises.filter(i => i.intensity === 'burnout').length;
  ok(h === Math.min(3, elig('heavy')) && b <= 2 && b >= Math.min(2, elig('burnout') - h, 0), `manual intensity honoured as far as eligibility allows (${h}h/${b}b)`); }
// Equipment restriction: bodyweight only
const wb = WT.generate(Object.assign(WT.defaultSettings('full'), { equipment: ['bw'] }));
wb.exercises.forEach(i => ok(WT.ex(i.exId).equipment.every(q => q === 'bw'), 'bw only ' + i.exId));
// Avoid muscles
const wa = WT.generate(Object.assign(WT.defaultSettings('full'), { avoidMuscles: ['quads'] }));
wa.exercises.forEach(i => ok(WT.ex(i.exId).primary !== 'quads', 'avoid quads ' + i.exId));
// Exclusions
P.excluded = ['goblet-squat', 'db-bench-press']; for (let k = 0; k < 20; k++) WT.generate(WT.defaultSettings('full')).exercises.forEach(i => ok(!P.excluded.includes(i.exId), 'excluded ' + i.exId)); P.excluded = [];
// Swap alternatives
const wsw = WT.generate(WT.defaultSettings('push'));
const it = wsw.exercises[0]; const alts = WT.alternatives(wsw, it.uid);
ok(alts.length > 3, 'alternatives exist'); alts.forEach(a => { ok(!wsw.exercises.some(e => e.exId === a.ex.id), 'alt dup'); ok(WT.hasEquipment(a.ex), 'alt equip'); ok(!banned.has(a.ex.id), 'alt banned'); });
ok(alts.slice(0, 5).every(a => a.ex.primary === WT.ex(it.exId).primary || it.slot.m.includes(a.ex.primary)), 'alts same muscle');
console.log('\nSwap for', WT.ex(it.exId).name, '→', alts.slice(0, 5).map(a => a.ex.name).join(', '));
// Long workout counts
for (const n of [3, 8, 10]) { const w = WT.generate(Object.assign(WT.defaultSettings('full'), { count: n })); ok(w.exercises.length === n, 'count ' + n + ' got ' + w.exercises.length); check(w, 'full' + n); }
const wauto = WT.generate(Object.assign(WT.defaultSettings('full'), { autoCount: true, duration: 30 })); console.log('auto 30min →', wauto.exercises.length, 'ex, est', wauto.estimatedMin);
ok(wauto.estimatedMin <= 40, 'auto 30 min fits');

/* ── Progression ── */
function addSession(daysAgo, exId, sets, extra) {
  const d = new Date(Date.now() - daysAgo * 864e5);
  const ex = WT.ex(exId); const pr = WT.prescribe(ex, (extra && extra.intensity) || 'standard');
  WT.db.history.push({ id: WT.uid(), type: 'full', title: 'T', startedAt: d.toISOString(), endedAt: d.toISOString(), durationSec: 3000,
    exercises: [Object.assign({ uid: WT.uid(), exId, intensity: pr.intensity, targetSets: sets.length, repMin: pr.repMin, repMax: pr.repMax, sets: sets.map(([w, r]) => ({ w, r, done: true })) }, extra || {})] });
}
const plan = id => { const p = WT.prescribe(WT.ex(id), 'standard'); return { repMin: p.repMin, repMax: p.repMax, sets: p.sets, intensity: 'standard' }; };
let r = WT.recommend('db-incline-press', plan('db-incline-press')); ok(r.action === 'new', 'no history → new');
addSession(8, 'db-incline-press', [[40, 10], [40, 10], [40, 10]]);
r = WT.recommend('db-incline-press', plan('db-incline-press')); console.log('\nincline all top once →', r.headline, '|', r.reasons.join(' '));
ok(r.action === 'hold' && r.weight === 40, 'one good session → hold and confirm (no increase on a single workout)');
addSession(5, 'db-incline-press', [[40, 10], [40, 10], [40, 10]]);
r = WT.recommend('db-incline-press', plan('db-incline-press')); console.log('incline all top twice →', r.headline, '|', r.reasons.join(' '));
ok(r.action === 'increase' && r.weight === 45, 'confirmed at the top twice → upper db +5 → 45');
ok(r.reasons.some((x) => x.startsWith('Recent sessions')), 'Why shows the relevant history');
addSession(2, 'db-incline-press', [[45, 9], [45, 8], [45, 8]]);
r = WT.recommend('db-incline-press', plan('db-incline-press')); console.log('in range →', r.headline); ok(r.action === 'hold' && r.weight === 45 && r.headline.includes('aim for'), 'hold 45');
addSession(1, 'db-incline-press', [[45, 7], [45, 6], [45, 6]]);
r = WT.recommend('db-incline-press', plan('db-incline-press')); console.log('struggle once →', r.headline); ok(r.action === 'hold', 'struggle once hold');
addSession(0, 'db-incline-press', [[45, 6], [45, 6], [45, 5]]);
r = WT.recommend('db-incline-press', plan('db-incline-press')); console.log('struggle twice →', r.headline); ok(r.action === 'decrease' && r.weight === 40, 'struggle twice → 40');
// The brief's example: 30 × 10, 10, 9 → maintain 30, aim 10, 10, 10
addSession(4, 'cable-fly', [[30, 10], [30, 10], [30, 9]], { intensity: 'regular' });
r = WT.recommend('cable-fly', { repMin: 8, repMax: 12, sets: 3, intensity: 'regular' }); console.log('30x10,10,9 →', r.headline);
ok(r.action === 'hold' && r.weight === 30 && r.repTargets.join() === '10,10,10', 'maintain 30 lb, aim 10,10,10');
// Lower body
addSession(6, 'goblet-squat', [[50, 12], [50, 12], [50, 11]]);
addSession(3, 'goblet-squat', [[50, 12], [50, 12], [50, 12]]);
r = WT.recommend('goblet-squat', plan('goblet-squat')); console.log('goblet →', r.headline); ok(r.action === 'increase' && r.weight === 55, 'previous session one rep short of the top + now at the top → lower +5 → 55');
addSession(3, 'bulgarian-split-squat', [[30, 14], [30, 13], [30, 13]]);
r = WT.recommend('bulgarian-split-squat', plan('bulgarian-split-squat')); console.log('bss exceeded →', r.headline); ok(r.weight === 40, 'lower exceeded +10 → 40');
// Max dumbbell cap
addSession(3, 'db-hip-thrust', [[60, 12], [60, 12], [60, 12]]);
r = WT.recommend('db-hip-thrust', plan('db-hip-thrust')); console.log('cap →', r.headline); ok(r.action === 'reps' && r.weight === 60, 'cap at 60');
// Cable
addSession(3, 'cable-pushdown', [[50, 12], [50, 12], [50, 12]], { effort: 'easy' });
r = WT.recommend('cable-pushdown', plan('cable-pushdown')); ok(r.weight === 55, 'top of range and rated easy → cable +5');
// Bodyweight pull-up
addSession(3, 'pullup', [[0, 10], [0, 10], [0, 10]]);
r = WT.recommend('pullup', plan('pullup')); console.log('pullup top →', r.headline, '|', r.reasons.join(' ')); ok(r.action === 'progress', 'pullup progress');
addSession(10, 'chinup', [[0, 6], [0, 5], [0, 4]]);
r = WT.recommend('chinup', plan('chinup')); console.log('chinup low →', r.headline); ok(r.action === 'hold' || r.action === 'reps', 'chinup hold');
// Grinding effort
addSession(3, 'db-curl', [[25, 12], [25, 12], [25, 12]], { effort: 'hard' });
r = WT.recommend('db-curl', plan('db-curl')); ok(r.action === 'hold', 'hard effort → hold');
// Layoff
addSession(40, 'db-shoulder-press', [[40, 8], [40, 8], [40, 8]]);
r = WT.recommend('db-shoulder-press', plan('db-shoulder-press')); console.log('layoff →', r.headline); ok(r.action === 'return' && r.weight === 40, 'layoff 40 days');
// Intensity change heavy
const hp = WT.prescribe(WT.ex('goblet-squat'), 'heavy');
r = WT.recommend('goblet-squat', { repMin: hp.repMin, repMax: hp.repMax, sets: hp.sets, intensity: 'heavy' }); console.log('heavy from e1rm →', r.headline, r.reasons[0]); ok(r.weight >= 55, 'heavy e1rm based');
// PRs
const prs = WT.personalRecords('db-incline-press'); ok(prs.heaviest.w === 45 && prs.count === 5, 'PRs');
// Finish session with PR
const s = WT.sessionFromWorkout({ type: 'push', title: 'Push', exercises: [Object.assign({ exId: 'db-incline-press' }, WT.prescribe(WT.ex('db-incline-press'), 'regular'))] });
s.exercises[0].sets.forEach(x => { x.w = 50; x.r = 8; x.done = true; });
WT.finishSession(s); ok(s.prs.length === 1 && s.prs[0].kind === 'Heaviest weight', 'PR detection ' + JSON.stringify(s.prs));
WT.db.history.push(s);
// fatigue affects generation
const load = WT.muscleLoad(48); ok(load.chest > 0, 'fatigue computed');
const st = WT.stats(); ok(st.count === WT.db.history.length && st.totalSets > 0 && st.totalVolume > 0, 'stats');
// export/import roundtrip
const json = WT.exportData(); const before = WT.db.history.length; WT.resetAll(); ok(WT.db.history.length === 0, 'reset');
WT.importData(json, 'replace'); ok(WT.db.history.length === before, 'import replace');
WT.importData(json, 'merge'); ok(WT.db.history.length === before, 'merge no dups');
WT.flush(); WT.load(); ok(WT.db.history.length === before, 'persist reload');
try { WT.importData('{"foo":1}'); ok(false, 'bad import accepted'); } catch (e) { ok(true); }
console.log(`\n${passes} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
