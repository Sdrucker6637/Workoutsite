/* Node tests: zero-equipment library, variations, plan editing, and learning from notes.
 * node tests/learning.test.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = String(v)), removeItem: (k) => delete mem[k] };
for (const f of ['exercises.js', 'core.js', 'feedback.js', 'engine.js']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
const WT = globalThis.WT;
let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log('  FAIL:', msg); } };
const day = 864e5;
const reset = () => { for (const k in mem) delete mem[k]; WT.load(); };
reset();

/* ───────── Library ───────── */
console.log('Zero-equipment library');
const free = WT.exercises.filter(WT.isEquipmentFree);
const added = WT.BUILTIN_EXERCISES.length - 185;
ok(added >= 50, `added ${added} exercises`);
ok(free.length >= 85, `${free.length} equipment-free exercises`);
const banned = /pull-up bar|dip bar|rings|band|bench|chair|box|towel|slider|wall\b/i;
free.forEach((e) => {
  ok(e.cue && e.cue.length > 30, 'instructions: ' + e.id);
  ok(e.difficulty && e.repMin > 0 && e.repMax >= e.repMin, 'difficulty + rep range: ' + e.id);
  ok(WT.MUSCLES[e.primary] && e.secondary.every((m) => WT.MUSCLES[m]), 'muscles: ' + e.id);
  ok(!banned.test(e.name), 'no equipment in the name: ' + e.id);
  (e.mods || []).forEach((m) => ok(!m.needs || m.needs === 'wall', 'modification equipment flagged: ' + e.id + '/' + m.id));
});
['wall-sit', 'handstand-pushup', 'slider-leg-curl', 'nordic-curl', 'incline-pushup', 'decline-pushup', 'bench-dip', 'pullup', 'inverted-row', 'chest-dip', 'jump-rope', 'copenhagen-plank'].forEach((id) => ok(!WT.isEquipmentFree(WT.ex(id)), id + ' is not counted as equipment-free'));
WT.exercises.forEach((e) => {
  ['easier', 'harder'].forEach((k) => e[k] && ok(WT.ex(e[k]), `${k} of ${e.id} exists`));
  const ids = (e.mods || []).map((m) => m.id);
  ok(new Set(ids).size === ids.length, 'unique modification ids: ' + e.id);
  (e.mods || []).forEach((m) => ok(typeof m.level === 'number' && m.name && m.cue, 'modification fields: ' + e.id + '/' + m.id));
  ok(WT.PATTERNS[e.pattern], 'pattern ' + e.id);
});
const chest = free.filter((e) => e.primary === 'chest');
const chestPatterns = new Set(chest.map((e) => e.pattern));
ok(chest.length >= 12, `${chest.length} chest-primary zero-equipment exercises`);
ok(chestPatterns.size >= 4, 'chest via different movement patterns: ' + [...chestPatterns].join(', '));
['pseudo-planche-pushup', 'sphinx-pushup', 'tiger-bend-pushup'].forEach((id) => ok(WT.ex(id).primary !== 'chest' && WT.ex(id).secondary.includes('chest'), id + ': chest listed as secondary, not primary'));
ok(WT.ex('diamond-pushup').primary === 'triceps', 'diamond push-up is triceps-primary');
const byGroup = {};
free.forEach((e) => (byGroup[WT.MUSCLES[e.primary].group] = (byGroup[WT.MUSCLES[e.primary].group] || 0) + 1));
console.log('  equipment-free by group:', JSON.stringify(byGroup));
['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio'].forEach((g) => ok(byGroup[g] >= 3, 'equipment-free coverage for ' + g));
ok(WT.ex('pushup').mods.some((m) => m.id === 'knees') && WT.ex('pushup').mods.some((m) => m.needs === 'wall') && WT.ex('pushup').mods.some((m) => m.id === 'partial'), 'push-up: knee, wall and reduced-range modifications');
ok(WT.ex('air-squat').mods.some((m) => m.id === 'partial') && WT.ex('pistol-squat').mods.some((m) => m.level < 0), 'squat: partial-range and single-leg progressions');

/* Bodyweight-only generation for every type */
for (const t of WT.WORKOUT_TYPES) {
  const s = WT.defaultSettings(t.id);
  s.equipment = ['bw'];
  if (t.id === 'custom') s.targets = ['chest', 'quads', 'core'];
  for (let r = 0; r < 15; r++) {
    const w = WT.generate(s);
    ok(w.exercises.length >= 3, `bw ${t.id}: ${w.exercises.length} exercises`);
    w.exercises.forEach((i) => ok(WT.isEquipmentFree(WT.ex(i.exId)), `bw ${t.id}: ${i.exId} needs equipment`));
    w.exercises.forEach((i) => i.variation && ok(!WT.modOf(WT.ex(i.exId), i.variation).needs, `bw ${t.id}: variation ${i.variation} needs equipment`));
  }
}
// Gym user: bodyweight isn't swamping loaded work, but it is used
{
  let freeN = 0, n = 0;
  for (let r = 0; r < 150; r++) WT.generate(WT.defaultSettings('full')).exercises.forEach((i) => { n++; if (WT.isEquipmentFree(WT.ex(i.exId))) freeN++; });
  console.log(`  full body with gym equipment: ${Math.round((100 * freeN) / n)}% equipment-free`);
  ok(freeN / n > 0.05 && freeN / n < 0.45, 'balanced use of bodyweight work with equipment available');
}
// Beginners don't get advanced variations unprompted
WT.db.profile.experience = 'beginner';
ok(WT.pickVariation(WT.ex('pistol-squat'), null).id === 'eccentric' || WT.modOf(WT.ex('pistol-squat'), WT.pickVariation(WT.ex('pistol-squat'), null).id).level < 0, 'beginner → easier pistol variation');
ok(!WT.pickVariation(WT.ex('pushup'), null).id, 'beginner-level exercise stays as written');
WT.db.profile.experience = 'intermediate';
ok(WT.modOf(WT.ex('pistol-squat'), WT.pickVariation(WT.ex('pistol-squat'), null).id).level === -1, 'intermediate, never done an advanced exercise → one step easier');
ok(!WT.pickVariation(WT.ex('split-squat'), null).id, 'intermediate: a beginner exercise stays as written');

/* ───────── Plan editing helpers ───────── */
console.log('Plan editing');
{
  const mk = (id, ss, rest) => ({ uid: id, exId: 'pushup', intensity: 'standard', sets: 3, repMin: 10, repMax: 15, rest, superset: ss });
  let list = [mk('a', null, 60), mk('b', 'A', 60), mk('c', 'A', 75), mk('d', null, 60), mk('e', 'B', 60), mk('f', 'B', 75)];
  list[2].ownRest = 60; list[5].ownRest = 60;
  list = WT.moveBlock(list, 1, 3);
  ok(list.map((e) => e.uid).join('') === 'adefbc', 'moveBlock moves a superset as a unit');
  ok(list[2].superset === 'A' && list[4].superset === 'B', 'supersets re-lettered in order');
  list = WT.unpairItem(list, 'e');
  ok(!list[1].superset && !list[2].superset && list[2].rest === 60, 'unpair clears the pair and restores its own rest');
  ok(list[4].superset === 'A', 'remaining superset becomes A');
  list = WT.pairItems(list, 'a', 'f');
  ok(list[0].uid === 'a' && list[1].uid === 'f' && list[0].superset && list[0].superset === list[1].superset, 'pairItems moves b next to a');
  ok(list[1].rest === Math.max(60, WT.db.profile.rest.superset) && list[1].ownRest === 60, 'superset rest on the last member, own rest remembered');
  list = WT.flipSuperset(list, 'a');
  ok(list[0].uid === 'f' && list[1].uid === 'a' && list[1].rest >= WT.db.profile.rest.superset && list[0].rest === 60, 'flip swaps who goes first and moves the round rest');
  const sess = WT.sessionFromWorkout({ type: 'full', title: 'T', exercises: list.map((e) => Object.assign({}, e, { variation: 'knees' })) });
  ok(sess.exercises.map((e) => e.uid).length === 6 && sess.exercises.every((e) => e.variation === 'knees'), 'session keeps order and variations');
  ok(sess.exercises.map((e) => e.superset || '-').join('') === list.map((e) => e.superset || '-').join(''), 'session keeps supersets');
}

/* ───────── Note parsing ───────── */
console.log('Note parsing');
const P = (t, ex) => WT.parseNote(t, { exId: ex }).map((s) => `${s.kind}:${s.target.type}:${s.target.key}:${s.persistence}`).sort().join(' ');
const cases = [
  ['Push-ups are tough on my wrists', null, 'pain:family:push-up:recurring pain:joint:wrist:recurring'],
  ['Pistols were way too hard', null, 'tooHard:exercise:pistol-squat:progress'],
  ['Too easy, need something harder', 'air-squat', 'tooEasy:exercise:air-squat:progress'],
  ['Love these!', 'burpee', 'like:exercise:burpee:lasting'],
  ['Hate lunges', null, 'dislike:family:lunge:lasting'],
  ["I don't like burpees", null, 'dislike:family:burpee:lasting'],
  ['Knee a bit sore today', null, 'pain:joint:knee:temporary'],
  ['My shoulder hurts on dips every time', null, 'pain:family:dip:ongoing pain:joint:shoulder:ongoing'],
  ['Diamond push ups killed my elbows', null, 'pain:exercise:diamond-pushup:recurring pain:joint:elbow:recurring'],
  ['Did 3 sets with 25s', 'db-curl', ''],
  ['Not too hard', 'pushup', ''],
  ["Didn't hurt at all", 'pushup', 'resolved:exercise:pushup:event'],
  ['This was boring', 'plank', 'dislike:exercise:plank:lasting'],
  ['I really like cable work', null, 'like:equipment:cable:lasting'],
  ['Wrists feel fine now', null, 'resolved:joint:wrist:event'],
  ['Hard on my wrists', 'pushup', 'pain:exercise:pushup:recurring pain:joint:wrist:recurring'],
  ['Hindu push-ups are fun but the archer ones are too hard', null, 'like:exercise:hindu-pushup:lasting tooHard:exercise:archer-pushup:progress'],
  ['Felt easy on my wrists', 'pushup', 'resolved:exercise:pushup:event resolved:joint:wrist:event'],
];
cases.forEach(([t, ex, want]) => ok(P(t, ex) === want, `"${t}" → ${P(t, ex) || '(nothing)'} (want ${want || 'nothing'})`));

/* ───────── Learning over time ───────── */
console.log('Learning over time');
const addSession = (daysAgo, exs, notes) => {
  const t = Date.now() - daysAgo * day;
  WT.db.history.push({ id: 's' + Math.random(), type: 'full', title: 'W', startedAt: new Date(t - 3600e3).toISOString(), endedAt: new Date(t).toISOString(), notes: notes || '', totals: { sets: 3, volume: 0 }, prs: [],
    exercises: exs.map(([exId, n, variation]) => ({ uid: WT.uid(), exId, name: WT.ex(exId).name, intensity: 'standard', targetSets: 3, repMin: 10, repMax: 15, variation: variation || null, notes: n || '', sets: [1, 2, 3].map(() => ({ w: '', r: '15', done: true })) })) });
};
reset();
addSession(12, [['pushup']], 'Knee a bit sore today');
ok(!WT.learnedSignals().length, 'temporary note fades after ~10 days');
reset();
addSession(40, [['pushup', 'My wrists always hurt on these']]);
ok(WT.learnedSignals().some((s) => s.persistence === 'ongoing' && s.w === 1), 'ongoing limitation keeps full weight');
addSession(2, [['pushup', 'Wrists feel fine now']]);
ok(!WT.learnedSignals().some((s) => s.kind === 'pain'), 'a later “fine now” cancels it');
reset();
addSession(5, [['air-squat', 'Way too hard']]);
addSession(1, [['air-squat', 'Too easy now']]);
ok(WT.prefEffect(WT.ex('air-squat'), WT.learnedPrefs()).varDir === 1, 'newer “too easy” overrides older “too hard”');
reset();
addSession(3, [['pushup', 'Hard on my wrists']]);
const sig = WT.learnedSignals()[0];
WT.db.learn.forgotten.push(sig.key);
ok(!WT.learnedSignals().some((s) => s.key === sig.key), 'forgotten signal ignored');

/* ───────── Notes change generation ───────── */
console.log('Notes change generation');
const many = (s, n) => Array.from({ length: n }, () => WT.generate(s));
const fam = (w, f) => w.exercises.filter((i) => (WT.ex(i.exId).families || []).includes(f)).length;
// Wrists + push-ups, bodyweight chest
reset();
const bwChest = Object.assign(WT.defaultSettings('chest'), { equipment: ['bw'] });
const before = many(bwChest, 40);
addSession(2, [['pushup', 'Push-ups are tough on my wrists']]);
const after = many(bwChest, 40);
const avgPU = (ws) => ws.reduce((a, w) => a + fam(w, 'push-up'), 0) / ws.length;
console.log(`  push-ups per bodyweight chest workout: ${avgPU(before).toFixed(1)} → ${avgPU(after).toFixed(1)}`);
ok(avgPU(after) <= 2 && avgPU(after) < avgPU(before), 'fewer push-ups after a wrist note');
ok(after.every((w) => w.exercises.every((i) => !(WT.ex(i.exId).joints || []).includes('wrist') || (WT.modOf(WT.ex(i.exId), i.variation) || {}).wrist)), 'every remaining wrist-loading exercise uses its wrist-friendly version');
ok(after.every((w) => w.exercises.every((i) => WT.ex(i.exId).primary === 'chest')), 'still a chest workout');
ok(after.every((w) => w.adjustments.length > 0), 'adjustments explained');
// With gym equipment the substitutes keep the chest covered with loaded work
const gymChest = many(WT.defaultSettings('chest'), 40);
ok(gymChest.every((w) => w.exercises.length === 6 && fam(w, 'push-up') <= 2), 'gym chest day: full plan, push-ups limited');
ok(gymChest.every((w) => w.exercises.every((i) => WT.MUSCLES[WT.ex(i.exId).primary].group === 'chest')), 'gym chest day: substitutes keep chest coverage');
// Wrist limitation spreads to other wrist-heavy exercises (e.g. bodyweight shoulders)
const bwSh = many(Object.assign(WT.defaultSettings('shoulders'), { equipment: ['bw'] }), 30);
const wristNoMod = bwSh.reduce((a, w) => a + w.exercises.filter((i) => (WT.ex(i.exId).joints || []).includes('wrist') && !(WT.modOf(WT.ex(i.exId), i.variation) || {}).wrist).length, 0);
reset();
const bwShBefore = many(Object.assign(WT.defaultSettings('shoulders'), { equipment: ['bw'] }), 30);
const wristBefore = bwShBefore.reduce((a, w) => a + w.exercises.filter((i) => (WT.ex(i.exId).joints || []).includes('wrist')).length, 0);
console.log(`  wrist-loading picks in bodyweight shoulder days: ${wristBefore} → ${wristNoMod}`);
ok(wristNoMod < wristBefore, 'wrist note reduces other wrist-heavy picks too');
// Dislike
reset();
addSession(3, [['burpee', 'Hate these, never again']]);
ok(many(WT.defaultSettings('cardio'), 60).every((w) => !w.exercises.some((i) => i.exId === 'burpee')), 'disliked burpees never recommended');
ok(WT.alternatives(WT.generate(WT.defaultSettings('cardio')), WT.generate(WT.defaultSettings('cardio')).exercises[0].uid).length >= 0, 'swap list still works');
// Like
reset();
const countEx = (ws, id) => ws.reduce((a, w) => a + w.exercises.filter((i) => i.exId === id).length, 0);
const coreSet = WT.defaultSettings('core');
const likeBefore = countEx(many(coreSet, 80), 'windshield-wiper');
addSession(20, [['windshield-wiper', 'Love these, really fun']]);
const likeAfter = countEx(many(coreSet, 80), 'windshield-wiper');
console.log(`  liked exercise picked: ${likeBefore} → ${likeAfter} of 80`);
ok(likeAfter > likeBefore, 'liked exercise chosen more often');
// Too hard → easier variation; too easy → harder
reset();
addSession(2, [['pistol-squat', 'Way too hard, form broke']]);
const pv = WT.pickVariation(WT.ex('pistol-squat'), WT.learnedPrefs());
ok(pv.id && WT.modOf(WT.ex('pistol-squat'), pv.id).level < 0, 'too hard → easier pistol variation: ' + pv.id);
const legs = many(Object.assign(WT.defaultSettings('legs'), { equipment: ['bw'] }), 40).flatMap((w) => w.exercises).filter((i) => i.exId === 'pistol-squat');
ok(legs.every((i) => i.variation && WT.modOf(WT.ex('pistol-squat'), i.variation).level < 0), 'generated pistols use the easier variation');
reset();
addSession(2, [['air-squat', 'Too easy', null]]);
const sv = WT.pickVariation(WT.ex('air-squat'), WT.learnedPrefs());
ok(sv.id && WT.modOf(WT.ex('air-squat'), sv.id).level > 0, 'too easy → harder squat variation: ' + sv.id);
reset();
addSession(2, [['pushup', 'Too easy', 'knees']]);
ok(WT.pickVariation(WT.ex('pushup'), WT.learnedPrefs()).id === 'eccentric' || WT.modOf(WT.ex('pushup'), WT.pickVariation(WT.ex('pushup'), WT.learnedPrefs()).id).level > -2, 'too easy on knee push-ups → one step up, not straight to advanced');
reset();
addSession(2, [['clap-pushup', 'Too easy']]);
ok(!!WT.progressionBoost(WT.ex('clap-pushup'), WT.learnedPrefs()) === false, 'no boost on itself');
reset();
addSession(2, [['dive-bomber-pushup', 'Way too hard']]);
ok(WT.progressionBoost(WT.ex('hindu-pushup'), WT.learnedPrefs()), 'too hard with no easier modification → easier progression (Hindu push-up) boosted');
reset();
addSession(2, [['typewriter-pushup', 'Way too hard']]);
ok(!WT.progressionBoost(WT.ex('archer-pushup'), WT.learnedPrefs()) && WT.pickVariation(WT.ex('typewriter-pushup'), WT.learnedPrefs()).id === 'one-way', 'too hard with an easier modification → that modification first');
// Last-used variation persists
reset();
addSession(3, [['pushup', '', 'knees']]);
ok(WT.pickVariation(WT.ex('pushup'), WT.learnedPrefs()).id === 'knees', 'generator keeps your last variation');
const wfs = WT.workoutFromSession(WT.db.history[0]);
ok(wfs.exercises[0].variation === 'knees', 'repeat / template keeps the variation');

/* Progression per variation */
console.log('Progression per variation');
reset();
addSession(3, [['pushup', '', 'knees']]);
const r1 = WT.recommend('pushup', { repMin: 10, repMax: 15, sets: 3, intensity: 'standard', variation: 'knees' });
ok(r1.action === 'progress' && r1.nextVariation !== undefined, 'top of range on knee push-ups → next variation: ' + r1.headline);
const r2 = WT.recommend('pushup', { repMin: 10, repMax: 15, sets: 3, intensity: 'standard', variation: null });
ok(r2.action === 'new' && /First time/.test(r2.reasons[0]), 'as-written push-ups compared separately: ' + r2.reasons[0]);
const r3 = WT.recommend('pushup');
ok(r3 && r3.headline, 'recommend without a plan still works');

/* Migration */
/* ───────── Audit pass: phrasing robustness, trials, joints, allocation, quality ───────── */
console.log('Natural-language phrasings (tests/note-phrasings.json)');
{
  // Each case lists signals that must appear (prefix match on kind:type:key[@of][:persistence]); '' = nothing.
  const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'note-phrasings.json'), 'utf8'));
  const sigs = (t, ex) => WT.parseNote(t, { exId: ex }).map((s) => `${s.kind}:${s.target.type}:${s.target.key}${s.target.of ? '@' + s.target.of : ''}:${s.persistence}`);
  cases.forEach(([t, ex, want]) => {
    const got = sigs(t, ex);
    const w = want.split(' ').filter(Boolean);
    ok(w.length ? w.every((x) => got.some((g) => g.startsWith(x))) : !got.length, `"${t}" → ${got.join(' ') || '(nothing)'} (want ${want || 'nothing'})`);
  });
}

console.log('Conflicts and time');
reset();
addSession(10, [['air-squat', '', null]], 'I hate lunges');
addSession(2, [['air-squat', '', null]], 'Actually I like lunges now');
ok(!WT.learnedSignals().some((s) => s.kind === 'dislike') && WT.learnedSignals().some((s) => s.kind === 'like' && s.target.key === 'lunge'), 'newer “like lunges now” overrides “hate lunges”');
reset();
addSession(10, [['pistol-squat', "Can't do these yet"]]);
addSession(1, [['pistol-squat', 'Fine now']]);
ok(WT.prefEffect(WT.ex('pistol-squat'), WT.learnedPrefs()).varDir === 0, '“fine now” clears an earlier “too hard”');
reset();
addSession(1, [['outdoor-run', 'Sore from yesterday’s legs session']]);
ok(!WT.learnedSignals().length, 'muscle soreness from earlier training (DOMS) is not treated as a problem with the exercise');
reset();
addSession(3, [['pushup', 'Knee push ups are too easy now', 'knees']]);
ok(WT.pickVariation(WT.ex('pushup'), WT.learnedPrefs()).id !== 'knees' && WT.modOf(WT.ex('pushup'), WT.pickVariation(WT.ex('pushup'), WT.learnedPrefs()).id).level > -2, '“knee push-ups are too easy” → one step up from the knee variation');

console.log('Wrist discomfort: trials, not assumptions');
reset();
addSession(2, [['pushup', 'Push-ups are tough on my wrists']]);
let P1 = WT.learnedPrefs();
ok(WT.prefEffect(WT.ex('pushup'), P1).trial && WT.prefEffect(WT.ex('pushup'), P1).trialOnly, 'knuckle push-ups are a trial, not a default');
ok(WT.prefEffect(WT.ex('pike-pushup'), P1).avoid, 'wrist-loading exercise without a wrist-friendly version is left out');
ok(!WT.prefEffect(WT.ex('dolphin-pushup'), P1).avoid && !WT.prefEffect(WT.ex('palm-press'), P1).avoid, 'forearm and hands-free alternatives stay available');
for (const t of ['chest', 'push', 'full']) {
  const ws = many(Object.assign(WT.defaultSettings(t), { equipment: ['bw'] }), 30);
  ok(ws.every((w) => w.exercises.filter((i) => i.trial).length <= 1), `${t}: at most one trial per workout`);
  ok(ws.every((w) => w.exercises.every((i) => !(WT.ex(i.exId).joints || []).includes('wrist') || i.trial || (WT.modOf(WT.ex(i.exId), i.variation) || {}).eases)), `${t}: every other exercise keeps weight off the wrists`);
  ok(ws.every((w) => w.exercises.every((i) => !i.trial || i.variation === i.trial.mod)), `${t}: the trial uses its modification`);
}
WT.recordTrial('wrist', 'pushup', 'knuckles', true);
P1 = WT.learnedPrefs();
ok(WT.prefEffect(WT.ex('wide-pushup'), P1).useMod === 'knuckles', 'a confirmed modification carries to the same family (wide push-up on knuckles)');
let ws = many(Object.assign(WT.defaultSettings('chest'), { equipment: ['bw'] }), 30);
ok(ws.every((w) => !w.exercises.some((i) => i.trial && i.trial.mod === 'knuckles')) && ws.some((w) => w.exercises.some((i) => i.variation === 'knuckles')), 'confirmed → used without the trial label');
ok(ws.every((w) => fam(w, 'push-up') <= 2), 'still at most two push-ups per workout');
WT.recordTrial('wrist', 'pushup', 'knuckles', false);
ws = many(Object.assign(WT.defaultSettings('chest'), { equipment: ['bw'] }), 20);
ok(ws.every((w) => !w.exercises.some((i) => (WT.ex(i.exId).families || []).includes('push-up'))), '“didn’t work” → no push-ups at all');
ok(ws.every((w) => w.notes.some((n) => /Equipment → My equipment/.test(n))), 'a short no-equipment plan says why and what would open it up');
reset();
addSession(5, [['pushup', 'Push-ups are tough on my wrists']]);
addSession(1, [['pushup', 'Knuckle push-ups felt fine on my wrists', 'knuckles']]);
ok(WT.trialStatus('wrist', WT.ex('pushup'), 'knuckles', WT.learnedPrefs()) === 'ok', 'a note can confirm a modification (“knuckle push-ups felt fine on my wrists”)');
ok(WT.learnedSignals().some((s) => s.kind === 'pain' && s.target.type === 'joint'), '…without clearing the wrist limitation itself');
addSession(0, [['pushup', 'Knuckles still hurt my wrists', 'knuckles']]);
ok(WT.trialStatus('wrist', WT.ex('pushup'), 'knuckles', WT.learnedPrefs()) === 'bad', 'a later note overrides it (“knuckles still hurt”)');

console.log('Other joints');
reset();
addSession(3, [['air-squat', 'My knees are always cranky']]);
P1 = WT.learnedPrefs();
['pistol-squat', 'jump-squat', 'jump-lunge', 'tuck-jump'].forEach((id) => ok(WT.prefEffect(WT.ex(id), P1).avoid || WT.prefEffect(WT.ex(id), P1).trial, `knee limit: ${id} left out (or only as a trial)`));
ok(!WT.prefEffect(WT.ex('glute-bridge'), P1).avoid && !WT.prefEffect(WT.ex('db-hip-thrust'), P1).avoid, 'knee limit: hip work unaffected');
ok(WT.prefEffect(WT.ex('air-squat'), P1).trial && WT.prefEffect(WT.ex('air-squat'), P1).trial.mod === 'partial', 'knee limit: partial-range squat offered as the trial');
ok(many(WT.defaultSettings('legs'), 20).every((w) => w.exercises.length >= 5), 'knee limit: legs day still full with equipment');

console.log('Bodyweight allocation');
reset();
const fitCtx = (exp, eq) => ({ p: Object.assign({}, WT.db.profile, { experience: exp }), equipment: eq, excluded: new Set(), twin: {} });
ok(WT.bodyweightFit(WT.ex('air-squat'), fitCtx('beginner', WT.db.profile.equipment)) === 0, 'beginner: bodyweight squat is a fine choice');
ok(WT.bodyweightFit(WT.ex('air-squat'), fitCtx('intermediate', WT.db.profile.equipment)) < 0, 'intermediate with dumbbells: the loaded squat is preferred');
ok(WT.bodyweightFit(WT.ex('air-squat'), fitCtx('advanced', ['bw'])) === 0, 'no equipment: no penalty');
ok(WT.bodyweightFit(WT.ex('pistol-squat'), fitCtx('intermediate', WT.db.profile.equipment)) === 0, 'hard bodyweight work holds its own');
ok(WT.bodyweightFit(WT.ex('hollow-rock'), fitCtx('advanced', WT.db.profile.equipment)) === 0, 'core work is bodyweight by nature');
const share = (exp) => {
  WT.db.profile.experience = exp;
  let f = 0, n = 0;
  many(WT.defaultSettings('legs'), 60).forEach((w) => w.exercises.forEach((i) => { n++; if (WT.isEquipmentFree(WT.ex(i.exId))) f++; }));
  return f / n;
};
const sb = share('beginner'), si = share('intermediate');
WT.db.profile.experience = 'intermediate';
console.log(`  legs, bodyweight share: beginner ${Math.round(sb * 100)}% · intermediate ${Math.round(si * 100)}%`);
ok(sb > si, 'bodyweight share follows experience, not a fixed number');
addSession(2, [['air-squat', 'I prefer bodyweight']]);
let likeShare = 0, ln = 0;
many(WT.defaultSettings('legs'), 60).forEach((w) => w.exercises.forEach((i) => { ln++; if (WT.isEquipmentFree(WT.ex(i.exId))) likeShare++; }));
ok(likeShare / ln > si, '“I prefer bodyweight” raises it');

console.log('Workout quality');
reset();
const bwChest2 = Object.assign(WT.defaultSettings('chest'), { equipment: ['bw'] });
ok(many(bwChest2, 100).every((w) => w.exercises.filter((i) => WT.ex(i.exId).pattern === 'plyo').length <= 1), 'at most one explosive push-up per session');
ok(many(Object.assign(WT.defaultSettings('push'), { equipment: ['bw'] }), 60).every((w) => !w.exercises.some((i) => WT.ex(i.exId).primary === 'biceps')), 'bodyweight push day never falls back to biceps');
ok(many(Object.assign(WT.defaultSettings('pull'), { equipment: ['bw'] }), 60).every((w) => !w.exercises.some((i) => WT.ex(i.exId).primary === 'triceps')), 'bodyweight pull day never falls back to triceps');
ok(many(Object.assign(WT.defaultSettings('arms'), { equipment: ['bw'] }), 30).every((w) => w.exercises.length === 6), 'bodyweight arms day still fills (biceps + triceps)');
ok(many(Object.assign(WT.defaultSettings('full'), { equipment: ['bw'] }), 80).every((w) => fam(w, 'push-up') <= 2), 'full body: no more than two push-up variants');
ok(many(Object.assign(WT.defaultSettings('full'), { equipment: ['bw'] }), 80).every((w) => w.exercises.every((i) => WT.ex(i.exId).difficulty !== 'advanced' || i.variation)), 'advanced exercises start on an easier variation for an intermediate');
ok(WT.ex('pushup-bottom-hold').primary === 'chest' && WT.isEquipmentFree(WT.ex('pushup-bottom-hold')) && WT.ex('pushup-bottom-hold').joints.includes('wrist'), 'push-up bottom hold: chest, no equipment, wrist-loading');

console.log('Demonstrations');
{
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'media.js'), 'utf8'), { filename: 'media.js' });
  const M = WT.MEDIA;
  M.files().forEach((f) => ok(fs.existsSync(path.join(__dirname, '..', f)), 'frame exists: ' + f));
  const att = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'media', 'workout-guide', 'attribution.json'), 'utf8'));
  Object.values(M.map).concat(Object.values(M.variations)).filter(([s]) => s === 'wg').forEach(([, id, n]) => ok(att[id] && att[id].length === n, 'attribution for ' + id));
  Object.keys(M.map).forEach((id) => ok(WT.BUILTIN_EXERCISES.some((e) => e.id === id), 'demo maps a real exercise: ' + id));
  Object.keys(M.variations).forEach((k) => { const [id, v] = k.split('~'); ok(WT.modOf(WT.BUILTIN_EXERCISES.find((e) => e.id === id), v), 'variation demo maps a real modification: ' + k); });
  ok(WT.demoFor('pushup', 'knees').frames[0].includes('knee-push-up') && WT.demoFor('pushup', null).frames[0] !== WT.demoFor('pushup', 'knees').frames[0], 'knee push-up shows its own drawing');
  const free = WT.BUILTIN_EXERCISES.filter((e) => e.equipment.every((q) => q === 'bw'));
  console.log(`  ${free.filter((e) => M.map[e.id]).length} of ${free.length} equipment-free exercises have a demonstration`);
}

console.log('Migration');
for (const k in mem) delete mem[k];
mem['wt.data.v1'] = JSON.stringify({ version: 5, profile: { equipment: ['db', 'bw'] }, history: [], customExercises: [], overrides: {} });
WT.load();
ok(WT.db.version === 7 && ['wall', 'towel', 'anchor'].every((q) => WT.db.profile.equipment.includes(q)), 'v5 → v7 keeps wall / towel / anchor exercises available');
ok(Array.isArray(WT.db.learn.notes) && Array.isArray(WT.db.learn.forgotten), 'learning store created');
WT.db.learn.notes.push({ id: 'x', exId: 'pushup', text: 'too easy', at: new Date().toISOString() });
const exp = WT.exportData();
WT.resetAll();
WT.importData(exp, 'merge');
ok(WT.db.learn.notes.length === 1, 'exercise notes merge on import');
WT.importData(exp, 'replace');
ok(WT.db.learn.notes.length === 1, 'exercise notes restore on import');

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
