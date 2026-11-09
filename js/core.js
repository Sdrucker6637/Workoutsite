/* Core: constants, persistent store, utilities. */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});

  /* ───────── Taxonomy ───────── */
  WT.MUSCLES = {
    chest: { name: 'Chest', group: 'chest' },
    lats: { name: 'Lats', group: 'back' },
    'upper-back': { name: 'Upper Back', group: 'back' },
    traps: { name: 'Traps', group: 'back' },
    'lower-back': { name: 'Lower Back', group: 'back' },
    'front-delts': { name: 'Front Delts', group: 'shoulders' },
    'side-delts': { name: 'Side Delts', group: 'shoulders' },
    'rear-delts': { name: 'Rear Delts', group: 'shoulders' },
    biceps: { name: 'Biceps', group: 'arms' },
    triceps: { name: 'Triceps', group: 'arms' },
    forearms: { name: 'Forearms', group: 'arms' },
    quads: { name: 'Quads', group: 'legs' },
    hamstrings: { name: 'Hamstrings', group: 'legs' },
    glutes: { name: 'Glutes', group: 'legs' },
    calves: { name: 'Calves', group: 'legs' },
    adductors: { name: 'Adductors', group: 'legs' },
    abs: { name: 'Abs', group: 'core' },
    obliques: { name: 'Obliques', group: 'core' },
    cardio: { name: 'Cardio', group: 'cardio' },
  };
  WT.GROUPS = {
    chest: 'Chest',
    back: 'Back',
    shoulders: 'Shoulders',
    arms: 'Arms',
    legs: 'Legs',
    core: 'Core',
    cardio: 'Cardio',
  };
  WT.EQUIPMENT = {
    db: 'Dumbbells',
    bench: 'Bench',
    cable: 'Cable machine',
    lat: 'Lat pulldown',
    row: 'Seated cable row',
    mb: 'Medicine ball',
    bw: 'Bodyweight',
    bar: 'Pull-up bar',
    dip: 'Dip station',
    rings: 'Rings / suspension trainer',
    abwheel: 'Ab wheel',
    rope: 'Jump rope',
    bb: 'Barbell',
    ez: 'EZ bar',
    kb: 'Kettlebell',
    machine: 'Selectorized machines',
    ankle: 'Cable ankle strap',
    treadmill: 'Treadmill',
    rower: 'Rowing machine',
    bike: 'Stationary bike',
    wall: 'Wall',
    towel: 'Towel / sliders',
    anchor: 'Foot anchor (couch, partner)',
  };
  WT.PATTERNS = {
    'h-push': 'Horizontal press',
    'incline-push': 'Incline press',
    'decline-push': 'Decline / lower-chest press',
    dip: 'Dip',
    fly: 'Fly',
    pullover: 'Pullover',
    plyo: 'Power / plyometric',
    'v-pull': 'Vertical pull',
    'h-pull': 'Horizontal row',
    shrug: 'Shrug',
    hinge: 'Hip hinge',
    'v-push': 'Overhead press',
    lateral: 'Lateral raise',
    upright: 'Upright row',
    'front-raise': 'Front raise',
    'rear-fly': 'Rear-delt fly',
    curl: 'Curl',
    'hammer-curl': 'Hammer curl',
    'stretch-curl': 'Stretch curl',
    'peak-curl': 'Peak curl',
    pushdown: 'Pushdown',
    'tri-overhead': 'Overhead extension',
    'tri-ext': 'Triceps extension',
    'tri-press': 'Close-grip press / dip',
    wrist: 'Wrist / grip',
    carry: 'Carry / hang',
    squat: 'Squat',
    lunge: 'Lunge / single-leg',
    'knee-ext': 'Knee extension',
    'knee-flexion': 'Leg curl',
    calf: 'Calf raise',
    adduction: 'Adduction',
    abduction: 'Hip abduction',
    'back-ext': 'Back extension (floor)',
    swoop: 'Swooping push-up',
    'anti-ext': 'Anti-extension',
    'anti-rot': 'Anti-rotation',
    'leg-raise': 'Leg raise',
    flexion: 'Crunch',
    rotation: 'Rotation',
    'lateral-flex': 'Lateral flexion',
    conditioning: 'Conditioning',
    run: 'Running',
    steady: 'Steady-state cardio',
  };
  WT.RESTRICTION_TAGS = {
    deadlift: 'Conventional deadlifts',
    rdl: 'Romanian deadlifts (incl. single-leg / DB)',
    'reverse-grip-press': 'Reverse-grip dumbbell pressing',
    'spinal-load': 'Heavy spinal-loading movements (bent rows, back squats…)',
  };
  WT.WORKOUT_TYPES = [
    { id: 'full', name: 'Full Body', icon: 'body' },
    { id: 'push', name: 'Push', icon: 'push' },
    { id: 'pull', name: 'Pull', icon: 'pull' },
    { id: 'legs', name: 'Legs', icon: 'legs' },
    { id: 'chest', name: 'Chest', icon: 'chest' },
    { id: 'back', name: 'Back', icon: 'back' },
    { id: 'shoulders', name: 'Shoulders', icon: 'shoulders' },
    { id: 'arms', name: 'Arms', icon: 'arms' },
    { id: 'biceps', name: 'Biceps', icon: 'arms' },
    { id: 'triceps', name: 'Triceps', icon: 'arms' },
    { id: 'core', name: 'Core / Abs', icon: 'core' },
    { id: 'cardio', name: 'Cardio', icon: 'cardio' },
    { id: 'custom', name: 'Custom', icon: 'custom' },
  ];
  WT.CUSTOM_TARGETS = {
    chest: 'Chest',
    back: 'Back',
    shoulders: 'Shoulders',
    biceps: 'Biceps',
    triceps: 'Triceps',
    forearms: 'Forearms',
    quads: 'Quads',
    hamstrings: 'Hamstrings',
    glutes: 'Glutes',
    calves: 'Calves',
    core: 'Core',
    cardio: 'Cardio',
  };

  /* ───────── Default profile (pre-populated from your preferences) ───────── */
  WT.defaultProfile = () => ({
    name: '',
    unit: 'lb',
    theme: 'light',
    goals: [
      'Reduce overall body fat and achieve a leaner physique',
      'Improve chest development — particularly the lower chest',
      'Build more noticeable arms',
      'Improve overall muscular definition',
      'Maintain balanced development',
    ],
    strengthPerWeek: 3,
    runsPerWeek: 2,
    preferredType: 'full',
    defaultCount: 6,
    defaultDuration: 60,
    supersets: true,
    burnouts: true,
    // Intensity: probability-based randomisation (default) or fixed counts
    intensityRandom: true,
    // Drop / build-up sets can also be drawn automatically (v6). Low odds: they are techniques, not defaults.
    intensityOdds: { heavy: 22, regular: 30, burnout: 16, standard: 32, drop: 7, buildup: 7 },
    intensityFixed: { heavy: 2, burnout: 1, drop: 0, buildup: 0 },
    experience: 'intermediate',
    equipment: ['db', 'bench', 'cable', 'lat', 'row', 'mb', 'bw', 'bar', 'wall', 'towel', 'anchor'],
    dumbbells: { min: 5, max: 60, step: 5, microLoad: false },
    cableStep: 5,
    prioritize: ['chest', 'biceps', 'triceps', 'abs', 'obliques'],
    emphasisTags: ['lower-chest', 'arm-size', 'love-handles'],
    avoidMuscles: [],
    restrictions: ['deadlift', 'rdl', 'reverse-grip-press'],
    excluded: [],
    favorites: ['sissy-squat', 'pullup'],
    rest: { heavy: 150, regular: 90, burnout: 60, superset: 75 },
    timerSound: true,
    lastBackup: null,
    // Nutrition (protein first; the other macros are optional and easy to ignore)
    proteinTarget: 150,
    showMacros: true,
    homeProtein: true,
    // Achievements (v6): optional and quiet. Celebrations can be turned off separately.
    achievements: true,
    achCelebrate: true,
    // Recommendations learn from what you actually do (all on-device)
    adaptive: true,
  });

  /* ───────── Store ───────── */
  const KEY = 'wt.data.v1';
  const DATA_VERSION = 7;
  const fresh = () => ({
    version: DATA_VERSION,
    profile: WT.defaultProfile(),
    customExercises: [],
    overrides: {},
    history: [],
    active: null,
    draft: null,
    nutrition: { entries: [], foods: [] },
    meals: freshMeals(),
    achievements: freshAch(),
    learn: freshLearn(),
    createdAt: new Date().toISOString(),
  });

  /* v6 stores. Each is self-contained so older data simply gains empty ones. */
  function freshMeals() {
    if (WT.meals && WT.meals.fresh) return WT.meals.fresh();
    return { custom: [], edits: {}, selected: [], unavailable: [], staples: [], usage: {}, favorites: [], recent: [], prefs: { diets: [], disliked: [], dislikedText: [], airFryer: true, servings: 2, maxTime: 0 } };
  }
  function freshAch() {
    // unlocked: { id: { at: date it was reached, found: when Forge noticed, retro: reached before tracking began } }
    return { unlocked: {}, since: null, seen: [] };
  }
  function freshLearn() {
    // Draft-level signals the history can't show: exercises removed or swapped out of a plan before starting.
    // v7: notes: standing exercise notes ({ id, exId, text, at }); forgotten: keys of note signals you dismissed.
    return { dropped: {}, notes: [], forgotten: [] };
  }
  WT.freshMeals = freshMeals;
  const arr = (a) => (Array.isArray(a) ? a : []);
  function normalizeMeals(m) {
    // The meal planner owns its schema (js/meals.js); this fallback only keeps the shape valid without it
    if (WT.meals && WT.meals.normalize) return WT.meals.normalize(m);
    const f = freshMeals();
    m = m && typeof m === 'object' ? m : {};
    const out = Object.assign(f, m);
    ['custom', 'selected', 'unavailable', 'staples', 'favorites', 'recent'].forEach((k) => (out[k] = arr(out[k])));
    out.custom = out.custom.filter((x) => x && x.id && x.name && ['protein', 'carb', 'veg'].includes(x.cat));
    out.favorites = out.favorites.filter((x) => x && x.key && x.name);
    out.edits = out.edits && typeof out.edits === 'object' ? out.edits : {};
    out.usage = out.usage && typeof out.usage === 'object' ? out.usage : {};
    out.prefs = Object.assign(freshMeals().prefs, out.prefs || {});
    ['diets', 'disliked', 'dislikedText'].forEach((k) => (out.prefs[k] = arr(out.prefs[k])));
    return out;
  }
  function normalizeAch(a) {
    a = a && typeof a === 'object' ? a : {};
    const out = Object.assign(freshAch(), a);
    out.unlocked = out.unlocked && typeof out.unlocked === 'object' ? out.unlocked : {};
    out.seen = arr(out.seen);
    return out;
  }
  function normalizeLearn(l) {
    l = l && typeof l === 'object' ? l : {};
    const out = Object.assign(freshLearn(), l);
    out.dropped = out.dropped && typeof out.dropped === 'object' ? out.dropped : {};
    out.notes = arr(out.notes).filter((n) => n && typeof n.text === 'string');
    out.forgotten = arr(out.forgotten);
    return out;
  }
  WT.normalizeMeals = normalizeMeals;

  const V1_GOALS = [
    'Reduce body fat and get leaner and more defined',
    'Improve chest development — especially the lower chest',
    'Build bigger, more noticeable arms',
    'Reduce stomach fat and love handles',
    'Maintain balanced overall development',
  ];
  function migrate(d) {
    const base = fresh();
    const out = Object.assign(base, d || {});
    out.profile = Object.assign(WT.defaultProfile(), (d && d.profile) || {});
    out.profile.dumbbells = Object.assign(WT.defaultProfile().dumbbells, out.profile.dumbbells || {});
    out.profile.rest = Object.assign(WT.defaultProfile().rest, out.profile.rest || {});
    out.profile.intensityOdds = Object.assign(WT.defaultProfile().intensityOdds, out.profile.intensityOdds || {});
    out.profile.intensityFixed = Object.assign(WT.defaultProfile().intensityFixed, out.profile.intensityFixed || {});
    // v1 → v2: new art direction defaults to the ivory theme; refresh goal wording only if never edited.
    if (d && (d.version || 1) < 2) {
      if (out.profile.theme === 'dark') out.profile.theme = 'light';
      if (JSON.stringify(out.profile.goals) === JSON.stringify(V1_GOALS)) out.profile.goals = WT.defaultProfile().goals;
      out.version = 2;
    }
    out.history = Array.isArray(out.history) ? out.history : [];
    out.customExercises = Array.isArray(out.customExercises) ? out.customExercises : [];
    out.overrides = out.overrides || {};
    // v3 → v4: food & protein log. v4 → v5: branded products — library entries gain brand / flavor / aliases /
    // status / source, log entries gain a confidence level. Purely additive; workout data is untouched.
    out.nutrition = normalizeNutrition(out.nutrition);
    if (!(+out.profile.proteinTarget > 0)) out.profile.proteinTarget = 150;
    // v5 → v6: meal planner, achievements and recommendation learning get their own stores. Purely additive;
    // nothing existing is rewritten. New intensity odds (drop / build-up) arrive through the defaults merge above.
    out.meals = normalizeMeals(out.meals);
    out.achievements = normalizeAch(out.achievements);
    out.learn = normalizeLearn(out.learn);
    // v2 → v3: multi-stage sets (drop / build-up). Existing sets need no change — a set without
    // `stages` is a plain set. Only sanitise staged sets so later code can rely on their shape.
    // v6 → v7: walls, towels and foot anchors became explicit equipment (so "no equipment" really means
    // none). Everyone who trained with them before keeps them. Standing exercise notes and dismissed note
    // signals join the `learn` store (normalizeLearn). Purely additive.
    if (d && (d.version || 1) < 7) {
      ['wall', 'towel', 'anchor'].forEach((q) => !out.profile.equipment.includes(q) && out.profile.equipment.push(q));
    }
    if ((out.version || 1) < DATA_VERSION) out.version = DATA_VERSION;
    const fixSets = (e) => (e && Array.isArray(e.sets) ? e.sets.forEach(normalizeStagedSet(e)) : null);
    out.history.forEach((sess) => (sess.exercises || []).forEach(fixSets));
    if (out.active) (out.active.exercises || []).forEach(fixSets);
    return out;
  }
  function normalizeNutrition(n) {
    if (WT.nut && WT.nut.normalize) return WT.nut.normalize(n);
    n = n && typeof n === 'object' ? n : {};
    n.entries = Array.isArray(n.entries) ? n.entries : [];
    n.foods = Array.isArray(n.foods) ? n.foods : [];
    return n;
  }
  const normalizeStagedSet = (e) => (set) => {
    if (!set || set.stages == null) return;
    if (!Array.isArray(set.stages)) return delete set.stages;
    set.stages = set.stages.filter((st) => st && typeof st === 'object');
    if (!set.stages.length) return delete set.stages;
    if (!WT.STAGED[set.type]) set.type = WT.STAGED[e.intensity] ? e.intensity : 'drop';
  };

  /* ───────── Multi-stage sets ─────────
   * A drop set or build-up set is ONE set in `exercise.sets` (so it counts once everywhere), shaped
   *   { type: 'drop' | 'buildup', done, at, stages: [{ w, r, tr, done, at }] }
   * where w / r are the performed weight and reps (strings, '' until logged) and tr the stage's
   * target reps. Plain sets keep their original shape { w, r, done, at } and never have `stages`.
   */
  WT.STAGED = {
    drop: { name: 'Drop set', dir: -1, verb: 'Lower the weight each stage', rest: 'little or no rest' },
    buildup: { name: 'Build-up set', dir: 1, verb: 'Add weight each stage', rest: 'rest as needed' },
  };
  WT.isStagedSet = (s) => !!(s && Array.isArray(s.stages) && s.stages.length);
  /** Performed parts of a set: the done stages of a staged set, or the set itself. */
  WT.setParts = (s) => (WT.isStagedSet(s) ? s.stages.filter((st) => st.done) : s && s.done ? [s] : []);
  WT.setVolume = (s) => WT.setParts(s).reduce((a, x) => a + (+x.w || 0) * (+x.r || 0), 0);

  const storage = globalThis.localStorage || { getItem: () => null, setItem: () => {}, removeItem: () => {} };

  WT.load = function () {
    let d = null;
    try {
      d = JSON.parse(storage.getItem(KEY));
    } catch (e) {
      console.warn('Corrupt data, starting fresh', e);
    }
    WT.db = migrate(d);
    WT.rebuildExercises();
    return WT.db;
  };
  let saveTimer = null;
  WT.save = function (immediate) {
    clearTimeout(saveTimer);
    const write = () => {
      try {
        storage.setItem(KEY, JSON.stringify(WT.db));
      } catch (e) {
        console.error(e);
        WT.toast && WT.toast('Could not save — storage may be full. Export a backup.', 'error');
      }
      if (WT.onSaved) WT.onSaved();
    };
    if (immediate) write();
    else saveTimer = setTimeout(write, 150);
  };
  WT.flush = () => WT.save(true);
  WT.resetAll = function () {
    WT.db = fresh();
    WT.rebuildExercises();
    WT.save(true);
  };

  /* Export / import */
  WT.exportData = function () {
    return JSON.stringify({ app: 'workout-tracker', exportedAt: new Date().toISOString(), data: WT.db }, null, 2);
  };
  WT.validateImport = function (text) {
    const parsed = JSON.parse(text);
    const data = parsed && parsed.data ? parsed.data : parsed;
    if (!data || typeof data !== 'object' || !Array.isArray(data.history) || !data.profile) {
      throw new Error('This file is not a Workout Tracker backup.');
    }
    return data;
  };
  WT.importData = function (text, mode) {
    const data = WT.validateImport(text);
    if (mode === 'merge') {
      const ids = new Set(WT.db.history.map((s) => s.id));
      data.history.forEach((s) => {
        if (!ids.has(s.id)) WT.db.history.push(s);
      });
      WT.db.history.sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
      const cids = new Set(WT.db.customExercises.map((e) => e.id));
      (data.customExercises || []).forEach((e) => {
        if (!cids.has(e.id)) WT.db.customExercises.push(e);
      });
      WT.db.overrides = Object.assign({}, data.overrides || {}, WT.db.overrides);
      // Food log: add entries and saved foods that aren't here yet (matched by id)
      const nIn = normalizeNutrition(JSON.parse(JSON.stringify(data.nutrition || {})));
      const nut = (WT.db.nutrition = normalizeNutrition(WT.db.nutrition));
      const eids = new Set(nut.entries.map((e) => e.id));
      nIn.entries.forEach((e) => !eids.has(e.id) && nut.entries.push(e));
      const fids = new Set(nut.foods.map((f) => f.id));
      const fnames = new Set(nut.foods.map((f) => String(f.name).toLowerCase()));
      nIn.foods.forEach((f) => !fids.has(f.id) && !fnames.has(String(f.name).toLowerCase()) && nut.foods.push(f));
      // Meal planner: add custom ingredients and saved recipes that aren't here; keep this device's selections and prefs.
      const mIn = normalizeMeals(JSON.parse(JSON.stringify(data.meals || {})));
      const meals = (WT.db.meals = normalizeMeals(WT.db.meals));
      const mids = new Set(meals.custom.map((x) => x.id));
      const mnames = new Set(meals.custom.map((x) => String(x.name).toLowerCase()));
      mIn.custom.forEach((x) => !mids.has(x.id) && !mnames.has(String(x.name).toLowerCase()) && meals.custom.push(x));
      if (Array.isArray(mIn.kitchen) && Array.isArray(meals.kitchen)) mIn.kitchen.forEach((id) => !meals.kitchen.includes(id) && (meals.custom.some((c) => c.id === id) || !id.startsWith('ing-')) && meals.kitchen.push(id));
      if (mIn.overrides && meals.overrides) Object.entries(mIn.overrides).forEach(([k, v]) => !meals.overrides[k] && (meals.overrides[k] = v)); // this device's corrections win
      const rkeys = new Set(meals.favorites.map((x) => x.key));
      mIn.favorites.forEach((x) => !rkeys.has(x.key) && meals.favorites.push(x));
      mIn.staples.forEach((x) => !meals.staples.includes(x) && meals.staples.push(x));
      Object.entries(mIn.usage).forEach(([k, v]) => (meals.usage[k] = Math.max(+meals.usage[k] || 0, +v || 0)));
      // Achievements: keep the earliest record of each one.
      const aIn = normalizeAch(data.achievements);
      const ach = (WT.db.achievements = normalizeAch(WT.db.achievements));
      Object.entries(aIn.unlocked).forEach(([k, v]) => {
        const cur = ach.unlocked[k];
        if (!cur || (v && v.at && new Date(v.at) < new Date(cur.at))) ach.unlocked[k] = v;
      });
      if (aIn.since && (!ach.since || new Date(aIn.since) < new Date(ach.since))) ach.since = aIn.since;
      // Exercise notes and forgotten note signals
      const lIn = normalizeLearn(JSON.parse(JSON.stringify(data.learn || {})));
      const lrn = (WT.db.learn = normalizeLearn(WT.db.learn));
      const nids = new Set(lrn.notes.map((n) => n.id));
      lIn.notes.forEach((n) => !nids.has(n.id) && lrn.notes.push(n));
      lIn.forgotten.forEach((k) => !lrn.forgotten.includes(k) && lrn.forgotten.push(k));
    } else {
      WT.db = migrate(data);
    }
    WT.rebuildExercises();
    WT.save(true);
    return WT.db;
  };

  /* ───────── Exercises (builtin + overrides + custom) ───────── */
  WT.rebuildExercises = function () {
    const db = WT.db;
    const all = WT.BUILTIN_EXERCISES.map((e) => Object.assign({}, e, db.overrides[e.id] || {}));
    db.customExercises.forEach((e) => all.push(Object.assign({ custom: true }, e)));
    all.forEach((e) => {
      if (!e.intensities.includes('standard')) e.intensities = e.intensities.concat('standard');
      if (!e.intensities.includes(e.intensity)) e.intensity = 'standard';
    });
    WT.exercises = all;
    WT.exMap = Object.fromEntries(all.map((e) => [e.id, e]));
  };
  WT.ex = (id) => WT.exMap[id];
  WT.trackType = (ex) => (ex.load === 'cardio' ? 'cardio' : ex.load === 'time' ? 'time' : ex.load === 'bw' || ex.load === 'bwl' ? 'reps' : 'weight');
  WT.region = (ex) => {
    const g = (WT.MUSCLES[ex.primary] || {}).group;
    return g === 'legs' ? 'lower' : g === 'core' ? 'core' : g === 'cardio' ? 'cardio' : 'upper';
  };
  WT.videoUrl = (ex) =>
    ex.video || 'https://www.youtube.com/results?search_query=' + encodeURIComponent(ex.name + ' exercise proper form tutorial');
  WT.youtubeId = function (url) {
    if (!url) return null;
    const m = String(url).match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  };
  WT.hasEquipment = function (ex, equipment) {
    const eq = new Set(equipment || WT.db.profile.equipment);
    eq.add('bw');
    return ex.equipment.every((e) => eq.has(e));
  };
  /** Truly equipment-free: body and floor only (no bar, bench, wall, towel, anchor…). */
  WT.isEquipmentFree = (ex) => !!ex && ex.equipment.every((q) => q === 'bw');
  /** A modification of an exercise (item.variation → ex.mods entry), or null for the exercise as written. */
  WT.modOf = (ex, id) => (ex && id && (ex.mods || []).find((m) => m.id === id)) || null;
  /** Display name including the chosen modification, e.g. "Push-Up · From the knees". */
  WT.itemName = (item) => {
    const ex = WT.ex(item.exId);
    const base = ex ? ex.name : item.name || item.exId;
    const m = WT.modOf(ex, item.variation);
    return m ? `${base} · ${m.name}` : base;
  };
  WT.isRestricted = function (ex, profile) {
    profile = profile || WT.db.profile;
    return ex.tags.some((t) => profile.restrictions.includes(t));
  };

  /* ───────── Utilities ───────── */
  WT.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  WT.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  WT.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  WT.round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
  WT.fmtNum = (n) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 }));
  WT.fmtWeight = (w) => (w == null || w === '' ? '—' : WT.fmtNum(w) + ' ' + WT.db.profile.unit);
  WT.fmtDuration = function (sec) {
    sec = Math.max(0, Math.round(sec || 0));
    const h = Math.floor(sec / 3600),
      m = Math.floor((sec % 3600) / 60),
      s = sec % 60;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m${s && m < 10 ? ' ' + s + 's' : ''}`;
    return `${s}s`;
  };
  WT.fmtClock = function (sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600),
      m = Math.floor((sec % 3600) / 60),
      s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  };
  /** Run / cardio time. Stored as (decimal) minutes; shown as m:ss, or h:mm:ss from an hour. */
  WT.fmtRunTime = function (min) {
    const t = Math.round((+min || 0) * 60);
    if (!(t > 0)) return '';
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  };
  WT.fmtDate = (d, opts) => new Date(d).toLocaleDateString(undefined, opts || { month: 'short', day: 'numeric', year: 'numeric' });
  WT.fmtRelDay = function (d) {
    const days = WT.daysBetween(d, new Date());
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return days + ' days ago';
    if (days < 30) return Math.round(days / 7) + ' wk ago';
    return WT.fmtDate(d);
  };
  WT.startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  WT.daysBetween = (a, b) => Math.round((WT.startOfDay(b) - WT.startOfDay(a)) / 864e5);
  WT.startOfWeek = (d) => {
    const x = WT.startOfDay(d);
    const day = (x.getDay() + 6) % 7; // Monday start
    x.setDate(x.getDate() - day);
    return x;
  };
  WT.e1rm = (w, r) => (w > 0 && r > 0 ? (r === 1 ? w : w * (1 + r / 30)) : 0);
  WT.typeName = (id) => (WT.WORKOUT_TYPES.find((t) => t.id === id) || { name: id }).name;
  WT.muscleName = (m) => (WT.MUSCLES[m] || { name: m }).name;
  WT.cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  WT.shuffle = (a) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
})();
