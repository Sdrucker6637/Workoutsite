/* Workout quality audit — prints a representative sample of generated workouts with diagnostics.
 *   node tools/audit-workouts.js            → full report (sample + variety + flags)
 *   node tools/audit-workouts.js --summary  → flag counts only
 * Seeded, so runs are comparable before/after a change. Not a pass/fail test. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = String(v)), removeItem: (k) => delete mem[k] };
for (const f of ['exercises.js', 'core.js', 'engine.js', 'programming.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
const WT = globalThis.WT;
WT.load();
const SUMMARY = process.argv.includes('--summary');
const out = (s) => !SUMMARY && console.log(s);
const exOf = (i) => WT.ex(i.exId);
const P = WT.db.profile;
const BASE = JSON.parse(JSON.stringify(P));

/* ── Scenarios: equipment × history × experience ── */
const EQUIP = {
  default: BASE.equipment,
  'dumbbells+bench': ['db', 'bench'],
  'full gym': Object.keys(WT.EQUIPMENT),
  'cable+machines': ['cable', 'lat', 'row', 'machine', 'bench'],
  'bodyweight+bar': ['bw', 'bar', 'bench'],
};
function addSess(hoursAgo, list) {
  const d = new Date(Date.now() - hoursAgo * 3600e3).toISOString();
  WT.db.history.push({ id: WT.uid(), type: 'full', title: 'T', startedAt: d, endedAt: d, exercises: list.map(([exId, n]) => ({ uid: WT.uid(), exId, intensity: 'regular', repMin: 8, repMax: 12, targetSets: n, sets: Array.from({ length: n }, () => ({ w: 30, r: 10, done: true })) })) });
}
const HISTORY = {
  none: () => {},
  'upper-heavy week': () => { addSess(26, [['db-bench-press', 4], ['db-shoulder-press', 3], ['cable-pushdown', 3], ['db-curl', 3]]); addSess(74, [['lat-pulldown', 4], ['db-row', 4], ['db-incline-press', 4]]); },
  'legs yesterday': () => { addSess(20, [['goblet-squat', 4], ['bulgarian-split-squat', 3], ['db-hip-thrust', 4], ['db-leg-curl', 3]]); },
};
const EXP = ['beginner', 'intermediate', 'advanced'];
const PLAN = { full: 20, push: 15, pull: 15, legs: 15, chest: 10, arms: 10 };

function setScenario(i) {
  const eqKeys = Object.keys(EQUIP), hKeys = Object.keys(HISTORY);
  const eq = eqKeys[i % eqKeys.length], h = hKeys[Math.floor(i / eqKeys.length) % hKeys.length], exp = EXP[i % 3];
  Object.assign(P, JSON.parse(JSON.stringify(BASE)), { experience: exp });
  WT.db.history = [];
  HISTORY[h]();
  return { eq, h, exp, equipment: EQUIP[eq] };
}

/* ── Diagnostics ── */
const GROUP = (m) => ({ chest: 'push', 'front-delts': 'push', triceps: 'push', lats: 'pull', 'upper-back': 'pull', 'rear-delts': 'pull', biceps: 'pull', traps: 'pull', forearms: 'pull', quads: 'lower', glutes: 'lower', hamstrings: 'lower', calves: 'lower', adductors: 'lower', 'lower-back': 'lower', abs: 'core', obliques: 'core', 'side-delts': 'push' }[m] || 'other');
function diagnose(w) {
  const items = w.exercises, exs = items.map(exOf), flags = [];
  const sets = WT.P.sessionSets(items);
  const by = {};
  Object.entries(sets).forEach(([m, v]) => (by[GROUP(m)] = (by[GROUP(m)] || 0) + v));
  const total = Object.values(by).reduce((a, b) => a + b, 0) || 1;
  const iso = exs.filter((e) => e.category === 'isolation').length;
  // Functional redundancy: same movement class + same primary muscle, or very high shared load
  for (let a = 0; a < items.length; a++)
    for (let b = a + 1; b < items.length; b++) {
      const x = exs[a], y = exs[b];
      if (x.primary === y.primary && x.pattern === y.pattern && (x.moves2 || []).join() === (y.moves2 || []).join() && !(['arms', 'chest'].includes(w.type) && x.load !== y.load))
        flags.push(`redundant: ${x.name} ≈ ${y.name}`);
    }
  if (w.type === 'full') {
    // Direct sets per area (primary muscle), the way a coach would count a full-body session
    const a = { push: 0, pull: 0, lower: 0 }; // direct sets per area (side delts neutral)
    items.forEach((i) => { const g = GROUP(exOf(i).primary); if (a[g] != null && exOf(i).primary !== 'side-delts') a[g] += i.sets; });
    const tot = a.push + a.pull + a.lower || 1;
    const lower = a.lower / tot;
    by.push = a.push; by.pull = a.pull; by.lower = a.lower; delete by.core; delete by.other;
    if (lower < 0.3) flags.push(`full: lower body only ${(100 * lower).toFixed(0)}% of direct sets`);
    if (lower > 0.55) flags.push(`full: lower-dominant ${(100 * lower).toFixed(0)}% of direct sets`);
    if (a.push >= 2 * (a.pull || 1) || a.pull >= 2 * (a.push || 1)) flags.push(`full: push/pull imbalance ${a.push}/${a.pull} direct sets`);
  }
  if (['push', 'chest'].includes(w.type) && (sets.triceps || 0) > 10) flags.push(`triceps load ${sets.triceps.toFixed(1)} fractional sets`);
  if (['full', 'push', 'pull', 'legs'].includes(w.type) && iso / exs.length > 0.6) flags.push(`isolation-heavy ${iso}/${exs.length}`);
  if (w.type === 'legs' && (sets.quads || 0) > 2.2 * ((sets.hamstrings || 0) + (sets.glutes || 0)) / 2) flags.push('legs: quad-dominant');
  // Order: any isolation before a compound of the same primary muscle
  items.forEach((it, k) => { const e = exs[k]; if (e.category === 'compound' && ['primary', 'secondary'].includes(it.role)) exs.slice(0, k).forEach((p) => p.category === 'isolation' && p.primary === e.primary && flags.push(`order: ${p.name} before ${e.name}`)); });
  // Supersets: practicality
  WT.groupBlocks(items).filter((b) => b.length > 1).forEach((b) => {
    const [x, y] = b.map(exOf);
    if (x.equipment.includes('cable') && y.equipment.includes('cable')) flags.push(`superset needs one cable re-rigged: ${x.name} + ${y.name}`);
    const bench = (e) => e.equipment.includes('bench');
    if (bench(x) && bench(y) && x.pattern !== y.pattern) flags.push(`superset needs two bench setups: ${x.name} + ${y.name}`);
    const floor = (e) => ['bw', 'time'].includes(e.load) && WT.region(e) === 'core';
    if ((x.equipment.includes('machine') && !y.equipment.includes('machine')) || (y.equipment.includes('machine') && !x.equipment.includes('machine'))) if (!floor(x) && !floor(y)) flags.push(`superset across stations: ${x.name} + ${y.name}`);
  });
  if (!w.exercises.some((i) => i.role === 'primary')) flags.push('no main lift');
  return { flags, by, total, iso };
}
const fmt = (w, d) => {
  const lines = [`  ${w.title} — ~${w.estimatedMin} min — quality ${w.quality.score}`, `    ${w.objective}`];
  w.exercises.forEach((i, k) => lines.push(`    ${k + 1}. ${i.superset ? i.superset : ' '} ${exOf(i).name} — ${i.sets}×${i.repMin}–${i.repMax} ${i.intensity}  [${i.role}: ${i.slot.label}]`));
  lines.push(`    ${w.type === 'full' ? 'direct' : 'fractional'} sets by area: ${Object.entries(d.by).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')}; isolation ${d.iso}/${w.exercises.length}`);
  d.flags.forEach((f) => lines.push('    ⚑ ' + f));
  w.notes.filter((n) => !n.startsWith('Superset')).forEach((n) => lines.push('    note: ' + n));
  return lines.join('\n');
};

/* ── 1. Sample ── */
const flagCount = {};
let n = 0, scen = 0;
for (const [type, count] of Object.entries(PLAN)) {
  out(`\n══════ ${type.toUpperCase()} (${count}) ══════`);
  for (let k = 0; k < count; k++) {
    const s = setScenario(scen++);
    const w = WT.generate(Object.assign(WT.defaultSettings(type), { equipment: s.equipment, seed: `audit-${type}-${k}` }));
    const d = diagnose(w);
    n++;
    d.flags.forEach((f) => { const key = f.split(':')[0]; flagCount[key] = (flagCount[key] || 0) + 1; });
    out(`\n[${type} ${k + 1}] equipment: ${s.eq} · history: ${s.h} · ${s.exp}\n` + fmt(w, d));
  }
}
Object.assign(P, JSON.parse(JSON.stringify(BASE)));
WT.db.history = [];

/* ── 2. Variety at identical settings ── */
const variety = {};
for (const type of ['full', 'push', 'pull', 'legs', 'chest', 'arms']) {
  const freq = {}, openers = {}, sigs = new Set();
  const N = 200;
  let worst = 101, worstW = null;
  for (let k = 0; k < N; k++) {
    const w = WT.generate(Object.assign(WT.defaultSettings(type), { seed: `var-${type}-${k}` }));
    w.exercises.forEach((i) => (freq[i.exId] = (freq[i.exId] || 0) + 1));
    openers[w.exercises[0].exId] = (openers[w.exercises[0].exId] || 0) + 1;
    sigs.add(w.exercises.map((i) => i.exId).sort().join());
    const d = diagnose(w);
    d.flags.forEach((f) => { const key = 'variety-run ' + f.split(':')[0]; flagCount[key] = (flagCount[key] || 0) + 1; });
    if (w.quality.score < worst) { worst = w.quality.score; worstW = [w, d]; }
  }
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  variety[type] = { distinct: sigs.size, used: top.length, top: top.slice(0, 6).map(([id, c]) => `${WT.ex(id).name} ${Math.round((100 * c) / N)}%`), openers: Object.keys(openers).length, worst };
  out(`\n── variety: ${type} (${N} identical-settings workouts) ──\n  distinct workouts ${sigs.size}/${N}; ${top.length} different exercises used; ${Object.keys(openers).length} different openers\n  most frequent: ${variety[type].top.join(', ')}\n  lowest-quality workout (${worst}):\n${fmt(...worstW)}`);
}
console.log(`\n══════ FLAG SUMMARY (${n} sample workouts + 1,200 variety-run workouts) ══════`);
Object.entries(flagCount).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`));
console.log('\nVariety:');
Object.entries(variety).forEach(([t, v]) => console.log(`  ${t.padEnd(6)} distinct ${v.distinct}/200, exercises used ${v.used}, openers ${v.openers}, lowest quality ${v.worst}; top: ${v.top.slice(0, 3).join(', ')}`));

/* ── 3. Real-world simulation: 8 weeks of training logged into history ── */
function simulate(label, rotation, weeks) {
  Object.assign(P, JSON.parse(JSON.stringify(BASE)));
  WT.db.history = [];
  const perSlot = {}, perEx = {};
  let day = weeks * 7, k = 0;
  const rows = [];
  while (day > 0) {
    const type = rotation[k % rotation.length];
    const w = WT.generate(Object.assign(WT.defaultSettings(type), { seed: `${label}-${k}` }));
    // log it as completed `day` days ago (all sets at the top of the range)
    const at = new Date(Date.now() - day * 864e5).toISOString();
    WT.db.history.push({ id: WT.uid(), type, title: w.title, startedAt: at, endedAt: at, exercises: w.exercises.map((i) => ({ uid: WT.uid(), exId: i.exId, intensity: i.intensity, repMin: i.repMin, repMax: i.repMax, targetSets: i.sets, sets: Array.from({ length: i.sets }, () => ({ w: 30, r: i.repMax, done: true })) })) });
    w.exercises.forEach((i) => {
      const key = `${type}/${i.role}`;
      (perSlot[key] = perSlot[key] || {})[i.exId] = (perSlot[key][i.exId] || 0) + 1;
      perEx[i.exId] = (perEx[i.exId] || 0) + 1;
    });
    if (k < rotation.length * 2) rows.push(`    ${type.padEnd(5)} ${w.exercises.map((i) => exOf(i).name).join(' · ')}`);
    day -= rotation.length === 3 ? 2 : 2; // every other day
    k++;
  }
  const sessions = k;
  console.log(`\n── simulation: ${label} — ${sessions} sessions over ${weeks} weeks (logged into history) ──`);
  rows.forEach((r) => console.log(r));
  const weekly = WT.muscleLoad(24 * 7);
  console.log('    last-7-day fractional sets: ' + ['chest', 'lats', 'upper-back', 'side-delts', 'rear-delts', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs'].map((m) => `${m} ${(weekly[m] || 0).toFixed(1)}`).join(', '));
  Object.entries(perSlot).filter(([k]) => /primary|secondary|accessory/.test(k)).forEach(([key, m]) => {
    const tot = Object.values(m).reduce((a, b) => a + b, 0);
    const top = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, c]) => `${WT.ex(id).name} ${Math.round((100 * c) / tot)}%`);
    console.log(`    ${key.padEnd(18)} ${Object.keys(m).length} different: ${top.join(', ')}`);
  });
  const iso = Object.entries(perSlot).filter(([k]) => /isolation|core/.test(k)).reduce((acc, [, m]) => Object.assign(acc, m), {});
  console.log(`    isolation/core: ${Object.keys(iso).length} different exercises across ${sessions} sessions`);
  Object.assign(P, JSON.parse(JSON.stringify(BASE)));
  WT.db.history = [];
}
simulate('PPL', ['push', 'pull', 'legs'], 8);
simulate('Full body ×3', ['full'], 8);
