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
    theme: 'dark',
    goals: [
      'Reduce body fat and get leaner and more defined',
      'Improve chest development — especially the lower chest',
      'Build bigger, more noticeable arms',
      'Reduce stomach fat and love handles',
      'Maintain balanced overall development',
    ],
    strengthPerWeek: 3,
    runsPerWeek: 2,
    preferredType: 'full',
    defaultCount: 6,
    defaultDuration: 60,
    supersets: true,
    burnouts: true,
    experience: 'intermediate',
    equipment: ['db', 'bench', 'cable', 'lat', 'row', 'mb', 'bw', 'bar'],
    dumbbells: { min: 5, max: 60, step: 5, gymMax: 100, microLoad: false },
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
  });

  /* ───────── Store ───────── */
  const KEY = 'wt.data.v1';
  const fresh = () => ({
    version: 1,
    profile: WT.defaultProfile(),
    customExercises: [],
    overrides: {},
    history: [],
    active: null,
    draft: null,
    createdAt: new Date().toISOString(),
  });

  function migrate(d) {
    const base = fresh();
    const out = Object.assign(base, d || {});
    out.profile = Object.assign(WT.defaultProfile(), (d && d.profile) || {});
    out.profile.dumbbells = Object.assign(WT.defaultProfile().dumbbells, out.profile.dumbbells || {});
    out.profile.rest = Object.assign(WT.defaultProfile().rest, out.profile.rest || {});
    out.history = Array.isArray(out.history) ? out.history : [];
    out.customExercises = Array.isArray(out.customExercises) ? out.customExercises : [];
    out.overrides = out.overrides || {};
    return out;
  }

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
