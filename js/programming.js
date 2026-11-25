/* Programming layer — decides what a workout must accomplish (STRUCTURE) before choosing exercises (SELECTION).
 *
 * WT.generate → P.generate runs, for each attempt:
 *   1. blueprint  — type-specific slots: required coverage slots (e.g. full body: squat pattern, press, pull,
 *                   hinge) plus a weighted pool of optional slots. Emphasis is drawn per workout (press-led vs
 *                   overhead-led push, quad- vs posterior-led legs…) so sessions vary inside a fixed structure.
 *   2. fill       — required slots first, then optional slots drawn by priority, weekly-volume need, recent
 *                   fatigue and a per-session volume cap. Exercises are chosen by the existing scorer
 *                   (recency, favorites, experience, near-best jitter) plus movement-pattern preferences.
 *   3. coverage   — hard check of the required movement categories; gaps are repaired or explained.
 *   4. intensity  — role-aware, budgeted and independent per exercise; regular work dominates.
 *   5. order      — by role tier (main lifts → secondary → accessories → isolation → core), then
 *                   fatigue-aware sequencing so consecutive exercises don't share the same working muscles.
 *   6. supersets  — only compatible pairs (antagonist / non-competing accessories), only when useful.
 *   7. evaluate   — programming-quality score with hard constraints; the best of up to 6 attempts is kept.
 * Pure logic, no DOM. Uses the engine's internals through WT._gen.
 */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const P = (WT.P = {});
  const G = () => WT._gen;

  /* ═════════════════════ Deterministic RNG ═════════════════════ */
  /** Seeded generator (mulberry32). WT.generate({ …, seed }) is fully reproducible; without a seed it uses Math.random. */
  WT.rng = function (seed) {
    let a = 0;
    const s = String(seed);
    for (let i = 0; i < s.length; i++) a = (Math.imul(31, a) + s.charCodeAt(i)) | 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  /** Weighted pick from [[value, weight], …]. */
  function pickW(entries, rnd) {
    const live = entries.filter((e) => e[1] > 0);
    if (!live.length) return null;
    const tot = live.reduce((a, e) => a + e[1], 0);
    let r = (rnd || Math.random)() * tot;
    for (const [k, w] of live) {
      r -= w;
      if (r <= 0) return k;
    }
    return live[live.length - 1][0];
  }
  P.pickW = pickW;

  /* ═════════════════════ Movement-pattern classification ═════════════════════
   * Derived from the existing `pattern` field (no schema change, works for custom exercises).
   * An exercise may set `move` to override its primary movement, or `moves2` to add secondary ones.
   */
  WT.MOVES = {
    'h-push': 'Horizontal push',
    'v-push': 'Vertical push',
    'h-pull': 'Horizontal pull',
    'v-pull': 'Vertical pull',
    knee: 'Knee-dominant',
    'knee-uni': 'Unilateral knee-dominant',
    hip: 'Hip-dominant',
    'hip-ext': 'Hip extension',
    'knee-flex': 'Knee flexion',
    'quad-iso': 'Knee extension',
    calf: 'Calf isolation',
    adduction: 'Adduction',
    'core-flex': 'Core flexion',
    'core-anti-ext': 'Core anti-extension',
    'core-anti-rot': 'Core anti-rotation',
    'core-rot': 'Core rotation',
    'core-lat': 'Core lateral flexion',
    'chest-iso': 'Chest fly',
    'lat-iso': 'Lat isolation',
    'side-delt': 'Lateral deltoid isolation',
    'rear-delt': 'Rear deltoid isolation',
    'front-delt': 'Front deltoid isolation',
    biceps: 'Biceps isolation',
    triceps: 'Triceps isolation',
    shrug: 'Trap isolation',
    forearm: 'Forearm / grip',
    carry: 'Loaded carry',
    power: 'Power',
    conditioning: 'Conditioning',
    cardio: 'Cardio',
    other: 'Other',
  };
  const PATTERN_MOVE = {
    'h-push': 'h-push', 'incline-push': 'h-push', 'decline-push': 'h-push', dip: 'h-push', 'tri-press': 'h-push',
    'v-push': 'v-push', 'h-pull': 'h-pull', 'v-pull': 'v-pull',
    fly: 'chest-iso', plyo: 'power', shrug: 'shrug',
    lateral: 'side-delt', upright: 'side-delt', 'front-raise': 'front-delt', 'rear-fly': 'rear-delt',
    curl: 'biceps', 'hammer-curl': 'biceps', 'stretch-curl': 'biceps', 'peak-curl': 'biceps',
    pushdown: 'triceps', 'tri-overhead': 'triceps', 'tri-ext': 'triceps',
    wrist: 'forearm', carry: 'carry', squat: 'knee', lunge: 'knee-uni', 'knee-ext': 'quad-iso', 'knee-flexion': 'knee-flex',
    calf: 'calf', adduction: 'adduction',
    'anti-ext': 'core-anti-ext', 'anti-rot': 'core-anti-rot', 'leg-raise': 'core-flex', flexion: 'core-flex', rotation: 'core-rot', 'lateral-flex': 'core-lat',
    conditioning: 'conditioning', run: 'cardio', steady: 'cardio',
  };
  /** Primary movement class of an exercise. */
  WT.moveOf = function (ex) {
    if (!ex) return 'other';
    if (ex.move && WT.MOVES[ex.move]) return ex.move;
    if (ex.pattern === 'run' || ex.pattern === 'steady') return 'cardio';
    if (ex.category === 'cardio' || (ex.tags || []).includes('conditioning')) return 'conditioning';
    if (ex.pattern === 'hinge') return ex.category === 'compound' ? 'hip' : 'hip-ext';
    if (ex.pattern === 'pullover') return ex.primary === 'chest' ? 'chest-iso' : 'lat-iso';
    if (ex.pattern === 'lateral-flex' && ex.primary === 'adductors') return 'adduction';
    if (ex.pattern === 'carry') return ex.primary === 'obliques' ? 'core-lat' : ex.load === 'time' ? 'forearm' : 'carry';
    return PATTERN_MOVE[ex.pattern] || 'other';
  };
  /** Primary + secondary movement classes. */
  WT.movesOf = function (ex) {
    const m = WT.moveOf(ex);
    const out = [m];
    if (m === 'knee-uni') out.push('knee'); // a lunge is still knee-dominant lower-body work
    if (ex && ex.pattern === 'tri-press') out.push('triceps'); // close-grip press / dip: triceps-driven pressing
    ((ex && ex.moves2) || []).forEach((x) => !out.includes(x) && out.push(x));
    return out;
  };

  /* ═════════════════════ Coverage tokens ═════════════════════ */
  const COVER = {
    push: ['h-push', 'v-push'], pull: ['h-pull', 'v-pull'], knee: ['knee', 'knee-uni'], hip: ['hip', 'hip-ext', 'knee-flex'],
    'h-push': ['h-push'], 'v-push': ['v-push'], 'h-pull': ['h-pull'], 'v-pull': ['v-pull'], 'knee-flex': ['knee-flex'],
    biceps: ['biceps'], triceps: ['triceps'], 'side-delt': ['side-delt'], 'rear-delt': ['rear-delt'], 'chest-iso': ['chest-iso'],
  };
  P.TOKEN_LABEL = {
    push: 'upper-body push', pull: 'upper-body pull', knee: 'knee-dominant lower body', hip: 'hip-dominant / posterior-chain work',
    'h-push': 'horizontal press', 'v-push': 'overhead press', 'h-pull': 'horizontal pull (row)', 'v-pull': 'vertical pull',
    'knee-flex': 'hamstring curl', biceps: 'direct biceps work', triceps: 'direct triceps work', 'side-delt': 'lateral-delt work',
    'rear-delt': 'rear-delt work', chest: 'chest work', 'chest-iso': 'chest fly',
  };
  const TOKEN_MUSCLES = {
    push: ['chest', 'front-delts'], pull: ['lats', 'upper-back'], knee: ['quads'], hip: ['glutes', 'hamstrings'],
    'h-push': ['chest'], 'v-push': ['front-delts'], 'h-pull': ['upper-back', 'lats'], 'v-pull': ['lats'], 'knee-flex': ['hamstrings'],
    biceps: ['biceps'], triceps: ['triceps'], 'side-delt': ['side-delts'], 'rear-delt': ['rear-delts'], chest: ['chest'], 'chest-iso': ['chest'],
  };
  const isConditioning = (ex) => ex.category === 'cardio' || ex.tags.includes('conditioning');
  /** Does an exercise satisfy a coverage token? (secondary movements count; conditioning never does) */
  P.covers = function (ex, token) {
    if (!ex || isConditioning(ex)) return false;
    if (token === 'chest') return ex.primary === 'chest';
    const acc = COVER[token] || [token];
    const ok = WT.movesOf(ex).some((m) => acc.includes(m));
    if (!ok) return false;
    // A coverage slot is about its target muscles: a close-grip press is triceps work, not "the push" of a full-body day
    if ((token === 'push' || token === 'h-push') && ex.primary === 'triceps') return token === 'push';
    return true;
  };
  /** Could any usable exercise cover this token? */
  P.feasible = function (token, ctx) {
    return WT.exercises.some((ex) => G().eligible(ex, ctx, null) && P.covers(ex, token));
  };
  /** Plain-language reason a token can't be covered. */
  P.whyMissing = function (token, ctx) {
    const all = WT.exercises.filter((ex) => P.covers(ex, token));
    if (!all.length) return 'the exercise library has none';
    const ms = TOKEN_MUSCLES[token] || [];
    if (ms.length && ms.every((m) => ctx.avoid.has(m))) return `you're avoiding ${ms.map(WT.muscleName).join(' and ').toLowerCase()}`;
    const fit = all.filter((ex) => WT.hasEquipment(ex, ctx.equipment));
    if (!fit.length) {
      const need = [...new Set(all.flatMap((ex) => ex.equipment.filter((q) => q !== 'bw')))].map((q) => WT.EQUIPMENT[q] || q);
      return `nothing fits your equipment (options need ${need.slice(0, 3).join(', ').toLowerCase()})`;
    }
    if (fit.every((ex) => WT.isRestricted(ex, ctx.p) || ctx.excluded.has(ex.id))) return 'your restrictions and exclusions rule out every option';
    return 'avoided muscles rule out the remaining options';
  };

  /* ═════════════════════ Volume accounting ═════════════════════ */
  /** Fractional sets per muscle a planned workout delivers (primary 1, secondary 0.5 / 0.25). */
  P.sessionSets = function (items) {
    const out = {};
    items.forEach((i) => {
      const ex = WT.ex(i.exId);
      if (!ex) return;
      const n = typeof i.sets === 'number' ? i.sets : 3;
      Object.entries(WT.setShare(ex)).forEach(([m, f]) => (out[m] = (out[m] || 0) + f * n));
    });
    return out;
  };
  /** Soft per-session ceiling on fractional sets for one muscle (non-focused workouts). Beyond ~10 hard sets per
   *  muscle per session returns diminish, and recovery cost keeps rising. */
  P.sessionCap = function (m, ctx) {
    if (['calves', 'forearms', 'adductors', 'lower-back', 'traps'].includes(m)) return 6;
    return ctx.prioritize.has(m) ? 12 : 10;
  };
  /** −1 (well over weekly target) … +1 (nothing done this week). Neutral with no history. */
  P.need = function (m, ctx) {
    const t = WT.weeklyTarget(m);
    if (!t || !WT.db.history.length) return 0;
    return WT.clamp((t - (ctx.weekly[m] || 0)) / t, -1, 1);
  };

  /* ═════════════════════ Blueprints ═════════════════════ */
  const slot = (id, label, role, moves, o) => Object.assign({ id, label, role, moves, cover: [] }, o || {});
  const prio = (ctx, ...ms) => ms.some((m) => ctx.prioritize.has(m));
  const other = (x) => ({ 'h-push': 'v-push', 'v-push': 'h-push', 'h-pull': 'v-pull', 'v-pull': 'h-pull' }[x]);
  const PUSH_M = { 'h-push': ['chest'], 'v-push': ['front-delts'] };
  const PULL_M = { 'h-pull': ['upper-back', 'lats'], 'v-pull': ['lats'] };
  const PRESS_LABEL = { 'h-push': 'Horizontal press', 'v-push': 'Overhead press' };
  const PULL_LABEL = { 'h-pull': 'Horizontal row', 'v-pull': 'Vertical pull' };
  const CORE_MOVES = ['core-anti-ext', 'core-flex', 'core-anti-rot', 'core-rot', 'core-lat'];
  const ANGLE = { flat: ['h-push'], incline: ['incline-push'], lower: ['decline-push', 'dip'] };
  const ANGLE_LABEL = { flat: 'Flat press', incline: 'Incline press', lower: 'Lower-chest press' };

  const BP = {};
  BP.full = (ctx, rnd) => {
    let hW = 0.65;
    if (prio(ctx, 'chest')) hW = 0.8;
    if (prio(ctx, 'front-delts', 'side-delts')) hW = 0.45;
    const push = pickW([['h-push', hW], ['v-push', 1 - hW]], rnd);
    const pull = pickW([['v-pull', 0.5], ['h-pull', 0.5]], rnd);
    const lead = pickW([['lower', 0.6], ['upper', 0.4]], rnd);
    const knee = pickW([['knee', 0.7], ['knee-uni', 0.3]], rnd);
    const LEG_M = ['quads', 'glutes', 'adductors'];
    return {
      type: 'full',
      emphasis: `${lead === 'lower' ? 'lower-body' : 'upper-body'} lead, ${push === 'h-push' ? 'horizontal' : 'overhead'} press, ${pull === 'v-pull' ? 'vertical' : 'horizontal'} pull`,
      require: ['knee', 'push', 'pull', 'hip'],
      required: [
        slot('knee', knee === 'knee' ? 'Squat pattern' : 'Single-leg squat', 'primary', ['knee', 'knee-uni'], { preferMove: knee, m: LEG_M, cat: 'compound', cover: ['knee'], heavy: true, fallback: ['quad-iso'], lead: lead === 'lower' }),
        slot('push', PRESS_LABEL[push], 'primary', [push], { m: PUSH_M[push], cat: 'compound', cover: ['push'], heavy: true, fallback: [other(push)], lead: lead === 'upper' }),
        slot('pull', PULL_LABEL[pull], 'primary', [pull], { m: PULL_M[pull], cat: 'compound', cover: ['pull'], heavy: true, fallback: [other(pull)] }),
        slot('hip', 'Hinge / posterior chain', 'secondary', ['hip', 'hip-ext', 'knee-flex'], { preferMove: 'hip', m: ['glutes', 'hamstrings', 'lower-back'], cover: ['hip'] }),
      ],
      optional: [
        slot('push2', PRESS_LABEL[other(push)], 'secondary', [other(push)], { m: PUSH_M[other(push)], cat: 'compound', w: 2.2, repeat: true }),
        slot('pull2', PULL_LABEL[other(pull)], 'secondary', [other(pull)], { m: PULL_M[other(pull)], cat: 'compound', w: 2.4, repeat: true }),
        slot('biceps', 'Biceps', 'isolation', ['biceps'], { m: ['biceps'], w: 1.9 }),
        slot('triceps', 'Triceps', 'isolation', ['triceps'], { m: ['triceps'], cat: 'isolation', w: 1.9 }),
        slot('side', 'Lateral delts', 'isolation', ['side-delt'], { m: ['side-delts'], w: 1.9 }),
        slot('rear', 'Rear delts', 'isolation', ['rear-delt'], { m: ['rear-delts'], w: 1.3 }),
        slot('core', 'Core', 'core', CORE_MOVES, { m: ['abs', 'obliques'], w: 2.1, core: true }),
        knee === 'knee'
          ? slot('uni', 'Single-leg work', 'accessory', ['knee-uni'], { m: LEG_M, cat: 'compound', w: 1.1 })
          : slot('knee2', 'Squat pattern', 'accessory', ['knee'], { m: LEG_M, cat: 'compound', w: 0.9, repeat: true }),
        slot('hams', 'Hamstring curl', 'isolation', ['knee-flex'], { m: ['hamstrings'], w: 1.1 }),
        slot('fly', 'Chest fly', 'isolation', ['chest-iso'], { m: ['chest'], w: 1.1, tag: 'lower-chest' }),
        slot('calves', 'Calves', 'isolation', ['calf'], { m: ['calves'], w: 0.6 }),
      ],
      caps: [{ moves: ['h-push', 'v-push'], max: 2 }, { moves: ['h-pull', 'v-pull'], max: 2 }, { moves: ['knee', 'knee-uni'], max: 2 }],
    };
  };
  BP.push = (ctx, rnd) => {
    let sW = 0.3;
    if (prio(ctx, 'front-delts', 'side-delts')) sW = 0.55;
    else if (prio(ctx, 'chest')) sW = 0.2;
    const lead = pickW([['chest', 1 - sW], ['shoulders', sW]], rnd);
    const angle = pickW([['flat', 0.6], ['incline', 0.4]], rnd);
    const angle2 = pickW([['incline', angle === 'flat' ? 0.5 : 0], ['flat', angle === 'incline' ? 0.5 : 0], ['lower', ctx.emphasis.has('lower-chest') ? 0.7 : 0.35]], rnd);
    const chest1 = (role) => slot('press', ANGLE_LABEL[angle], role, ['h-push'], { m: ['chest'], cat: 'compound', prefer: ANGLE[angle], cover: ['push'], heavy: role === 'primary', fallback: ['v-push'], lead: lead === 'chest' });
    const ohp = (role) => slot('ohp', 'Overhead press', role, ['v-push'], { m: ['front-delts'], cat: 'compound', cover: ['push'], heavy: role === 'primary', fallback: ['h-push'], lead: lead === 'shoulders' });
    return {
      type: 'push',
      emphasis: lead === 'chest' ? 'chest-led' : 'shoulder-led (overhead press first)',
      describe: (items) => {
        const main = items.find((i) => i.role === 'primary');
        return lead === 'chest' && main ? `chest-led (${String(main.slot.label).toLowerCase()} first)` : 'shoulder-led (overhead press first)';
      },
      require: ['push', 'side-delt', 'triceps'],
      required: lead === 'chest'
        ? [chest1('primary'), ohp('secondary'), slot('side', 'Lateral raise', 'isolation', ['side-delt'], { m: ['side-delts'], cover: ['side-delt'] }), slot('tri', 'Triceps isolation', 'isolation', ['triceps'], { m: ['triceps'], cat: 'isolation', cover: ['triceps'] })]
        : [ohp('primary'), chest1('secondary'), slot('side', 'Lateral raise', 'isolation', ['side-delt'], { m: ['side-delts'], cover: ['side-delt'] }), slot('tri', 'Triceps isolation', 'isolation', ['triceps'], { m: ['triceps'], cat: 'isolation', cover: ['triceps'] })],
      optional: [
        slot('press2', ANGLE_LABEL[angle2], 'accessory', ['h-push'], { m: ['chest'], cat: 'compound', prefer: ANGLE[angle2], tag: angle2 === 'lower' ? 'lower-chest' : null, w: 2.4, repeat: true }),
        slot('fly', 'Chest fly', 'isolation', ['chest-iso'], { m: ['chest'], w: 2.4, tag: 'lower-chest' }),
        slot('tri2', 'Second triceps (different angle)', 'isolation', ['triceps'], { m: ['triceps'], cat: 'isolation', w: 1.8, repeat: true, differ: 'tri' }),
        slot('dip', 'Triceps press / dip', 'accessory', ['h-push'], { m: ['triceps'], cat: 'compound', w: 0.7, repeat: true }),
        slot('side2', 'Second lateral raise', 'isolation', ['side-delt'], { m: ['side-delts'], w: 0.6, repeat: true, differ: 'side' }),
        slot('front', 'Front raise', 'isolation', ['front-delt'], { m: ['front-delts'], w: 0.25 }),
      ],
      caps: [{ moves: ['h-push', 'v-push'], max: 3 }],
      primaryCaps: { triceps: 2, 'side-delts': 2 },
    };
  };
  BP.pull = (ctx, rnd) => {
    const lead = pickW([['v-pull', 0.5], ['h-pull', 0.5]], rnd);
    const main = (mv, role) => slot(mv, PULL_LABEL[mv], role, [mv], { m: PULL_M[mv], cat: 'compound', cover: ['pull', mv], heavy: role === 'primary', lead: role === 'primary' });
    return {
      type: 'pull',
      emphasis: lead === 'v-pull' ? 'vertical-pull led' : 'row led',
      require: ['v-pull', 'h-pull', 'rear-delt', 'biceps'],
      required: [main(lead, 'primary'), main(other(lead), 'secondary'), slot('bi', 'Biceps curl', 'isolation', ['biceps'], { m: ['biceps'], cover: ['biceps'] }), slot('rear', 'Rear delts', 'isolation', ['rear-delt'], { m: ['rear-delts'], cover: ['rear-delt'] })],
      optional: [
        slot('row2', 'Second row (different grip / support)', 'accessory', ['h-pull'], { m: ['lats', 'upper-back'], cat: 'compound', w: 2.1, repeat: true }),
        slot('bi2', 'Second biceps (different function)', 'isolation', ['biceps'], { m: ['biceps'], w: 2.1, repeat: true, differ: 'bi' }),
        slot('lat', 'Lat isolation', 'isolation', ['lat-iso'], { m: ['lats'], w: 1.8 }),
        slot('vpull2', 'Second vertical pull', 'accessory', ['v-pull'], { m: ['lats'], cat: 'compound', w: 1.0, repeat: true }),
        slot('traps', 'Traps', 'isolation', ['shrug'], { m: ['traps'], w: 0.9 }),
        slot('forearms', 'Forearms', 'isolation', ['forearm'], { m: ['forearms'], w: 0.5 }),
      ],
      caps: [{ moves: ['h-pull'], max: 2 }, { moves: ['h-pull', 'v-pull'], max: 3 }],
    };
  };
  BP.legs = (ctx, rnd) => {
    let pW = 0.35;
    if (prio(ctx, 'glutes', 'hamstrings')) pW = 0.55;
    const lead = pickW([['quad', 1 - pW], ['posterior', pW]], rnd);
    const quadLead = lead === 'quad';
    return {
      type: 'legs',
      emphasis: quadLead ? 'quad-led (squat first)' : 'posterior-chain led (hinge first)',
      require: ['knee', 'hip', 'knee-flex'],
      required: [
        slot('squat', 'Squat pattern', quadLead ? 'primary' : 'secondary', ['knee'], { m: ['quads', 'glutes', 'adductors'], cat: 'compound', cover: ['knee'], heavy: true, fallback: ['knee-uni'], lead: quadLead }),
        slot('hinge', 'Hip hinge / thrust', quadLead ? 'secondary' : 'primary', ['hip'], { m: ['glutes', 'hamstrings'], cat: 'compound', cover: ['hip'], heavy: true, fallback: ['hip-ext'], lead: !quadLead }),
        slot('uni', 'Single-leg work', 'accessory', ['knee-uni'], { m: ['quads', 'glutes', 'adductors'], cat: 'compound', fallback: ['knee'] }),
        slot('curl', 'Hamstring curl (knee flexion)', 'isolation', ['knee-flex'], { m: ['hamstrings'], cover: ['knee-flex'], fallback: ['hip-ext'] }),
      ],
      optional: [
        slot('quad', 'Quad isolation', 'isolation', ['quad-iso'], { m: ['quads'], w: 2.2 }),
        slot('calves', 'Calves', 'isolation', ['calf'], { m: ['calves'], w: 2.2 }),
        slot('glute', 'Glute isolation', 'isolation', ['hip-ext'], { m: ['glutes'], w: 1.3, skipIf: (exs) => exs.some((ex) => ex.primary === 'glutes' && WT.moveOf(ex) === 'hip') }),
        slot('add', 'Adductors', 'isolation', ['adduction'], { m: ['adductors'], w: 0.6 }),
        slot('core', 'Core', 'core', CORE_MOVES, { m: ['abs', 'obliques'], w: 1.0, core: true }),
      ],
      caps: [{ moves: ['knee', 'knee-uni'], max: 3 }, { moves: ['hip'], max: 2 }],
    };
  };
  BP.chest = (ctx, rnd) => {
    const lowerW = ctx.emphasis.has('lower-chest') ? 0.25 : 0.12;
    const a1 = pickW([['flat', 0.55], ['incline', 0.45 - lowerW / 2], ['lower', lowerW]], rnd);
    const a2 = pickW([['flat', a1 === 'flat' ? 0 : 0.4], ['incline', a1 === 'incline' ? 0 : 0.45], ['lower', a1 === 'lower' ? 0 : 0.35 + lowerW]], rnd);
    const a3 = ['flat', 'incline', 'lower'].find((a) => a !== a1 && a !== a2);
    const press = (id, a, role, o) => slot(id, ANGLE_LABEL[a], role, ['h-push'], Object.assign({ m: ['chest'], cat: 'compound', prefer: ANGLE[a], tag: a === 'lower' ? 'lower-chest' : null }, o));
    return {
      type: 'chest',
      emphasis: `${a1} press first, then ${a2}`,
      describe: (items) => {
        const presses = items.filter((i) => i.slot && /press/i.test(i.slot.label) && WT.ex(i.exId).primary === 'chest').map((i) => String(i.slot.label).toLowerCase().replace(' press', ''));
        return presses.length ? `${[...new Set(presses)].join(', ')} pressing, plus fly work` : null;
      },
      require: ['chest', 'chest-iso'],
      required: [press('press1', a1, 'primary', { heavy: true, cover: ['chest'], lead: true }), press('press2', a2, 'secondary', {}), slot('fly', 'Chest fly', 'isolation', ['chest-iso'], { m: ['chest'], cover: ['chest-iso'] })],
      optional: [
        press('press3', a3, 'accessory', { w: 2.6, repeat: true }),
        slot('fly2', 'Second fly (different line of pull)', 'isolation', ['chest-iso'], { m: ['chest'], w: 2.2, repeat: true, differ: 'fly', tag: 'lower-chest' }),
        slot('tri', 'Supporting triceps', 'isolation', ['triceps'], { m: ['triceps'], cat: 'isolation', w: 1.2, support: true }),
        slot('side', 'Supporting lateral delts', 'isolation', ['side-delt'], { m: ['side-delts'], w: 0.8, support: true }),
      ],
      supportCap: (n) => (n >= 8 ? 2 : 1),
      caps: [{ moves: ['h-push'], max: 4 }],
    };
  };
  BP.arms = (ctx, rnd) => {
    const triLead = pickW([['press', 0.4], ['iso', 0.6]], rnd);
    const bi = (id, label, role, o) => slot(id, label, role, ['biceps'], Object.assign({ m: ['biceps'] }, o));
    const tri = (id, label, role, o) => slot(id, label, role, ['triceps'], Object.assign({ m: ['triceps'] }, o));
    return {
      type: 'arms',
      emphasis: triLead === 'press' ? 'compound triceps press + curls' : 'isolation-focused',
      require: ['biceps', 'triceps'],
      required: [
        bi('bi1', 'Main curl', 'primary', { prefer: ['curl', 'hammer-curl'], heavy: true, cover: ['biceps'], lead: true }),
        triLead === 'press' ? slot('tri1', 'Close-grip press / dip', 'primary', ['h-push'], { m: ['triceps'], cat: 'compound', heavy: true, cover: ['triceps'], fallback: ['triceps'] }) : tri('tri1', 'Main triceps extension', 'primary', { cat: 'isolation', prefer: ['tri-overhead', 'pushdown'], heavy: true, cover: ['triceps'] }),
        bi('bi2', 'Curl — different function', 'isolation', { repeat: true, differ: 'bi1' }),
        tri('tri2', 'Triceps — different angle', 'isolation', { cat: 'isolation', repeat: true, differ: 'tri1' }),
      ],
      optional: [
        bi('bi3', 'Third curl variation', 'isolation', { w: 2, repeat: true, differ: 'bi2' }),
        tri('tri3', 'Third triceps variation', 'isolation', { cat: 'isolation', w: 2, repeat: true, differ: 'tri2' }),
        slot('fore', 'Forearms', 'isolation', ['forearm'], { m: ['forearms'], w: 0.7 }),
      ],
      balance: true,
    };
  };
  P.BLUEPRINTS = BP;

  /** Legacy single-focus types (back, shoulders, biceps, triceps, core, custom, cardio) keep their proven slot lists. */
  function legacyBlueprint(type, settings, ctx, n) {
    const focused = !['full', 'push', 'pull', 'legs', 'custom'].includes(type);
    const tmpl = WT.templateFor(type, settings.targets).map((s, i) => {
      let w = s.weight;
      if (!s.essential) {
        if (s.m.some((m) => ctx.prioritize.has(m))) w += 1.5;
        const fat = Math.max(...s.m.map((m) => ctx.fatigue[m] || 0));
        if (fat >= 8 && !focused) w -= 2.5;
        if (s.m.every((m) => ctx.avoid.has(m))) w -= 20;
      }
      return Object.assign({}, s, { id: 'l' + i, legacy: true, rank: s.essential ? 100 - i : w, order: i });
    });
    const slots = tmpl.slice().sort((a, b) => b.rank - a.rank).slice(0, n).sort((a, b) => a.order - b.order);
    return { type, legacy: true, emphasis: null, require: [], required: slots, optional: [], pad: tmpl };
  }

  /* ═════════════════════ Selection ═════════════════════ */
  function matchSlot(ex, slot, level) {
    if (slot.legacy || !slot.moves) return G().slotMatch(ex, slot, level);
    if (isConditioning(ex)) return false;
    const mv = WT.moveOf(ex);
    if (level === 0) return slot.moves.includes(mv) && (!slot.m || slot.m.includes(ex.primary)) && (!slot.cat || ex.category === slot.cat);
    if (level === 1) {
      const acc = slot.moves.concat(slot.fallback || []);
      if (!WT.movesOf(ex).some((x) => acc.includes(x))) return false;
      return !slot.m || slot.m.includes(ex.primary) || (slot.fallback || []).includes(mv);
    }
    const groups = new Set((slot.m || []).map((m) => (WT.MUSCLES[m] || {}).group));
    return groups.has((WT.MUSCLES[ex.primary] || {}).group);
  }
  P.matchSlot = matchSlot;

  /** Programming bonuses on top of the engine's exercise score. */
  function slotBonus(ex, slot, chosen, byId) {
    let s = 0;
    const mv = WT.moveOf(ex);
    if (slot.preferMove && mv === slot.preferMove) s += 1.5;
    if (slot.prefer && slot.prefer.includes(ex.pattern)) s += 1.5;
    if (slot.differ && byId[slot.differ] && byId[slot.differ].pattern === ex.pattern) s -= 2.5;
    if (slot.role === 'primary' && ex.category === 'compound' && WT.trackType(ex) === 'weight') s += 0.5; // loadable main lifts progress best
    // Main and secondary lifts should be progressively loadable: an unloaded regression is a poor choice for trained users
    if (['primary', 'secondary'].includes(slot.role) && ex.category === 'compound' && WT.db.profile.experience !== 'beginner') s -= ex.load === 'bw' ? 2 : ex.load === 'bwl' ? 0.5 : 0;
    if (ex.tags.includes('spinal-load') && chosen.some((c) => c.tags.includes('spinal-load'))) s -= 2;
    chosen.forEach((c) => {
      if (!slot.repeat && WT.moveOf(c) === mv) s -= 1;
      if (c.pattern === ex.pattern && c.load === ex.load && c.primary === ex.primary) s -= 3.5; // near-duplicate (e.g. two DB flat presses)
    });
    return s;
  }
  function fillSlot(slot, ctx, used, chosen, focused, byId, maxLevel) {
    const top = maxLevel != null ? maxLevel : slot.legacy ? 2 : 1;
    for (let level = 0; level <= top; level++) {
      const cands = WT.exercises.filter((ex) => G().eligible(ex, ctx, used) && matchSlot(ex, slot, level));
      if (!cands.length) continue;
      let best = null;
      cands.forEach((ex) => {
        const r = G().scoreExercise(ex, slot, ctx, chosen, focused);
        const s = r.s + slotBonus(ex, slot, chosen, byId || {});
        if (!best || s > best.s) best = { ex, s, why: r.why, level };
      });
      return best;
    }
    return null;
  }
  P.fillSlot = fillSlot;

  /** Role for items without one (legacy templates, user-added, old drafts). */
  P.inferRole = function (ex, type, slot) {
    if (!ex) return 'isolation';
    if (type === 'cardio') return ex.pattern === 'run' || ex.pattern === 'steady' ? 'primary' : 'accessory';
    if (WT.region(ex) === 'core' && type !== 'core') return 'core';
    if (ex.category === 'compound') return slot && slot.heavy ? 'primary' : 'secondary';
    return 'isolation';
  };
  P.roleOf = (i, type) => i.role || P.inferRole(WT.ex(i.exId), type, i.slot);
  P.ROLE_LABEL = { primary: 'Main lift', secondary: 'Secondary compound', accessory: 'Accessory', isolation: 'Isolation', core: 'Core' };

  const strip = (s) => ({ label: s.label, m: s.m, p: s.p, moves: s.moves, cover: s.cover, tag: s.tag, cardio: s.cardio, core: s.core, heavy: s.heavy, cat: s.cat, fallback: s.fallback, role: s.role, lead: s.lead || undefined, support: s.support || undefined });

  /** Chest-press slots are labelled by the angle actually chosen (a preference, not a requirement). */
  const PATTERN_ANGLE = { 'h-push': 'flat', 'incline-push': 'incline', 'decline-push': 'lower', dip: 'lower' };
  function labelled(s, ex) {
    if (!s.prefer || !s.moves || !s.moves.includes('h-push') || ex.primary !== 'chest' || !PATTERN_ANGLE[ex.pattern]) return s;
    return Object.assign({}, s, { label: ANGLE_LABEL[PATTERN_ANGLE[ex.pattern]] });
  }
  function optWeight(s, bp, ctx, items, n) {
    const ms = s.m || [];
    if (ms.length && ms.every((m) => ctx.avoid.has(m))) return 0;
    const exs = items.map((i) => WT.ex(i.exId));
    if (!s.repeat && exs.some((ex) => s.moves.includes(WT.moveOf(ex)))) return 0;
    if (s.skipIf && s.skipIf(exs)) return 0;
    if (s.support && bp.supportCap && items.filter((i) => i.slot && i.slot.support).length >= bp.supportCap(n)) return 0;
    for (const [m, max] of Object.entries(bp.primaryCaps || {})) if (ms.includes(m) && exs.filter((ex) => ex.primary === m).length >= max) return 0;
    for (const c of bp.caps || []) if (s.moves.some((m) => c.moves.includes(m)) && exs.filter((ex) => c.moves.includes(WT.moveOf(ex))).length >= c.max) return 0;
    if (bp.balance) {
      const b = exs.filter((ex) => ex.primary === 'biceps').length, t = exs.filter((ex) => ex.primary === 'triceps').length;
      if ((ms.includes('biceps') && b > t) || (ms.includes('triceps') && t > b)) return 0.05;
    }
    let w = s.w || 1;
    if (ms.some((m) => ctx.prioritize.has(m))) w *= 1.8;
    if (s.tag && ctx.emphasis.has(s.tag)) w *= 1.25;
    if (ms.length) w *= 1 + 0.6 * (ms.reduce((a, m) => a + P.need(m, ctx), 0) / ms.length);
    if (Math.max(0, ...ms.map((m) => ctx.fatigue[m] || 0)) >= 6) w *= 0.5;
    if (!bp.focused) {
      const sess = P.sessionSets(items);
      if (ms.length && ms.every((m) => (sess[m] || 0) + 3 > P.sessionCap(m, ctx))) w *= 0.15;
    }
    return Math.max(0, w);
  }
  function purpose(s, ctx) {
    const ms = s.m || [];
    const pm = ms.find((m) => ctx.prioritize.has(m));
    if (pm) return `${s.label}: ${WT.muscleName(pm)} is a priority`;
    const lag = ms.find((m) => P.need(m, ctx) > 0.6);
    if (lag) return `${s.label}: ${WT.muscleName(lag)} is behind on weekly volume`;
    return `${s.label}: rounds out the session`;
  }

  /* ═════════════════════ Intensity ═════════════════════ */
  /** Role multipliers on top of WT.intensityWeights (which already handles eligibility, odds, compound/isolation, fatigue). */
  const ROLE_INT = {
    primary: { heavy: 1.6, burnout: 0 },
    secondary: { heavy: 0.8, burnout: 0.25 },
    accessory: { heavy: 0.15, burnout: 0.8 },
    isolation: { heavy: 0.25, burnout: 1.4 },
    core: { heavy: 0.1, burnout: 1.0 },
  };
  /** Per-workout cap on advanced work: many sessions get none, most get one or two touches. */
  P.intensityBudget = function (n, rnd) {
    const p = WT.db.profile;
    let heavy = pickW([[0, 0.3], [1, 0.45], [2, 0.25], [3, n >= 8 ? 0.1 : 0]], rnd);
    if (p.experience === 'beginner') heavy = Math.min(heavy, 1);
    const burnout = pickW([[0, 0.35], [1, 0.48], [2, 0.17]], rnd);
    return { heavy, burnout };
  };
  P.randomize = function (items, ctx, rnd) {
    rnd = rnd || (ctx && ctx.rnd) || Math.random;
    const p = WT.db.profile;
    const odds = p.intensityOdds || {};
    const n = items.length;
    const type = ctx && ctx.settings ? ctx.settings.type : null;
    const budget = P.intensityBudget(n, rnd);
    const cap = { heavy: Math.min(budget.heavy, Math.max(1, Math.ceil(n / 2))), burnout: Math.min(budget.burnout, Math.max(1, Math.ceil(n / 3))) };
    const used = { heavy: 0, burnout: 0 };
    const maxAdv = Math.max(1, Math.ceil(n / 2)); // advanced work stays a minority of the session
    items.forEach((i) => i.locked && i.intensity && used[i.intensity] != null && used[i.intensity]++);
    const free = items.filter((i) => !(i.locked && i.intensity));
    const tier = (i) => TIER[P.roleOf(i, type)] != null ? TIER[P.roleOf(i, type)] : 3;
    const order = WT.shuffle(free, rnd).sort((a, b) => tier(a) - tier(b)); // main lifts get first claim on heavy
    order.forEach((i) => {
      const ex = WT.ex(i.exId);
      const fatigued = ctx && ctx.fatigue ? (ctx.fatigue[ex.primary] || 0) >= 6 : false;
      const w = WT.intensityWeights(ex, { fatigued });
      const rm = ROLE_INT[P.roleOf(i, type)] || {};
      Object.keys(w).forEach((k) => rm[k] != null && (w[k] *= rm[k]));
      ['heavy', 'burnout'].forEach((k) => used[k] >= cap[k] && (w[k] = 0));
      if (used.heavy + used.burnout >= maxAdv) w.heavy = w.burnout = 0;
      i.intensity = WT.drawWeighted(w, rnd);
      if (used[i.intensity] != null) used[i.intensity]++;
    });
    // Occasional multi-stage sets: at most one per workout, only where suitable.
    if (p.stagedSets !== false && type !== 'cardio' && used.heavy + used.burnout < maxAdv) {
      const pickLast = (arr) => arr[arr.length - 1];
      if ((+odds.burnout || 0) > 0 && p.burnouts && p.experience !== 'beginner' && rnd() < 0.08) {
        const c = pickLast(free.filter((i) => ['isolation', 'accessory'].includes(P.roleOf(i, type)) && WT.canStage(WT.ex(i.exId)) && WT.ex(i.exId).category === 'isolation' && i.intensity !== 'heavy'));
        if (c) c.intensity = 'drop';
      } else if ((+odds.heavy || 0) > 0 && rnd() < 0.05) {
        const c = free.find((i) => ['primary', 'secondary'].includes(P.roleOf(i, type)) && WT.canStage(WT.ex(i.exId)) && WT.ex(i.exId).category === 'compound' && i.intensity !== 'burnout');
        if (c) c.intensity = 'buildup';
      }
    }
    return items;
  };
  /** Suitability of an intensity for an item — used by tests and the quality check. */
  P.intensitySuitable = function (i, type) {
    const role = P.roleOf(i, type);
    const ex = WT.ex(i.exId);
    if (i.intensity === 'heavy') return ['primary', 'secondary'].includes(role) || (type === 'arms' || !['full', 'push', 'pull', 'legs', 'chest'].includes(type));
    if (i.intensity === 'burnout') return role !== 'primary';
    if (i.intensity === 'drop') return WT.canStage(ex) && ex.category === 'isolation';
    if (i.intensity === 'buildup') return WT.canStage(ex);
    return true;
  };

  /* ═════════════════════ Ordering ═════════════════════ */
  const TIER = { primary: 0, secondary: 1, accessory: 2, isolation: 3, core: 4 };
  P.TIER = TIER;
  /** How much exercise a pre-fatigues the muscles b needs (shared fractional contribution). */
  P.conflict = function (a, b) {
    const ea = WT.ex(a.exId || a), eb = WT.ex(b.exId || b);
    if (!ea || !eb) return 0;
    const sa = WT.setShare(ea), sb = WT.setShare(eb);
    let c = 0;
    Object.keys(sa).forEach((m) => sb[m] && (c += Math.min(sa[m], sb[m])));
    if (ea.tags.includes('spinal-load') && eb.tags.includes('spinal-load')) c += 0.5;
    return c;
  };
  P.order = function (items, type, ctx) {
    const prioritize = ctx ? ctx.prioritize : new Set(WT.db.profile.prioritize);
    if (type === 'cardio') {
      const r = (i) => { const ex = WT.ex(i.exId); return ex && (ex.pattern === 'run' || ex.pattern === 'steady') ? 0 : 2; };
      return items.map((it, idx) => ({ it, idx })).sort((a, b) => r(a.it) - r(b.it) || a.idx - b.idx).map((x) => x.it);
    }
    const tier = (i) => { const t = TIER[P.roleOf(i, type)]; return t != null ? t : 3; };
    const fine = (i) => {
      const ex = WT.ex(i.exId);
      let r = 0;
      if (i.intensity === 'heavy' || i.intensity === 'buildup') r -= 0.3;
      if (i.intensity === 'burnout' || i.intensity === 'drop') r += 0.4;
      if (i.slot && i.slot.lead) r -= 0.5; // the session's planned lead lift goes first
      if (ex && prioritize.has(ex.primary)) r -= 0.1;
      if (ex && ex.category === 'compound') r -= 0.15; // within a tier, multi-joint work first
      if (ex && ['arms'].includes((WT.MUSCLES[ex.primary] || {}).group) && type !== 'arms') r += 0.05; // small muscles after larger ones
      return r + (i.slotIndex || 0) * 0.001;
    };
    const left = items.slice();
    const out = [];
    while (left.length) {
      const minT = Math.min(...left.map(tier));
      let best = null;
      left.filter((i) => tier(i) === minT).forEach((i) => {
        const s = fine(i) + (out.length ? 0.6 * P.conflict(out[out.length - 1], i) : 0);
        if (!best || s < best.s) best = { i, s };
      });
      out.push(best.i);
      left.splice(left.indexOf(best.i), 1);
    }
    return out;
  };

  /* ═════════════════════ Supersets ═════════════════════ */
  const supersetable = (i, type) => {
    const ex = WT.ex(i.exId);
    if (!ex || WT.trackType(ex) === 'cardio' || ex.tags.includes('spinal-load')) return false;
    if (['heavy', 'drop', 'buildup'].includes(i.intensity)) return false;
    return ['accessory', 'isolation', 'core'].includes(P.roleOf(i, type));
  };
  /** Compatibility of two exercises as a superset: { score, why }. score ≥ 3 is a defensible pairing. */
  P.pairCompat = function (a, b) {
    const ea = WT.ex(a.exId), eb = WT.ex(b.exId);
    const no = { score: 0, why: '' };
    if (!ea || !eb || ea.primary === eb.primary) return no;
    if (ea.category === 'compound' && eb.category === 'compound') return no; // compounds stand alone
    if (['lat', 'row'].some((q) => ea.equipment.includes(q) && eb.equipment.includes(q))) return no;
    if (P.conflict(a, b) >= 0.5) return no; // competing for the same muscles
    const has = (m) => ea.primary === m || eb.primary === m;
    const anyOf = (ms) => ms.includes(ea.primary) || ms.includes(eb.primary);
    const ga = (WT.MUSCLES[ea.primary] || {}).group, gb = (WT.MUSCLES[eb.primary] || {}).group;
    let r = no;
    if (has('biceps') && has('triceps')) r = { score: 5, why: 'antagonists — biceps and triceps' };
    else if (has('quads') && has('hamstrings')) r = { score: 4, why: 'antagonists — quads and hamstrings' };
    else if (has('chest') && anyOf(['rear-delts', 'upper-back', 'lats'])) r = { score: 4, why: 'antagonists — chest and upper back' };
    else if (anyOf(['side-delts', 'rear-delts']) && has('calves')) r = { score: 4, why: 'non-competing — delts and calves' };
    else if ((ga === 'core') !== (gb === 'core')) r = { score: 3, why: `non-competing — ${WT.muscleName(ga === 'core' ? eb.primary : ea.primary).toLowerCase()} and core` };
    else if (WT.region(ea) !== WT.region(eb)) r = { score: 3, why: 'non-competing — upper and lower body' };
    else if (ga !== gb && P.conflict(a, b) === 0) r = { score: 3, why: `non-competing accessories — ${WT.muscleName(ea.primary).toLowerCase()} and ${WT.muscleName(eb.primary).toLowerCase()}` };
    if (r.score && ea.equipment.includes('cable') && eb.equipment.includes('cable')) r = { score: r.score - 0.5, why: r.why };
    return r;
  };
  function letterPairs(out) {
    let letter = 0;
    const ssRest = WT.db.profile.rest.superset;
    for (let k = 0; k < out.length; k++) {
      const a = out[k], b = out[k + 1];
      if (a._pair && b && a._pair === b.uid) {
        const L = String.fromCharCode(65 + letter++);
        a.superset = b.superset = L;
        b.rest = Math.max(b.rest || 0, ssRest);
        k++;
      }
    }
    out.forEach((i) => delete i._pair);
    return out;
  }
  /** Fresh pairing: optional, infrequent, driven by time pressure. */
  P.pairSupersets = function (items, opts) {
    opts = opts || {};
    const rnd = opts.rnd || Math.random;
    const type = opts.type;
    const est = WT.estimateMinutes(items);
    const over = opts.duration ? est - opts.duration : -99;
    let maxPairs = over > 8 ? 2 : over > 0 ? 1 : rnd() < 0.3 ? 1 : 0;
    if (items.length >= 8 && over > 0) maxPairs++;
    if (!maxPairs) return items;
    const cands = items.filter((i) => supersetable(i, type));
    const pairs = [];
    for (let x = 0; x < cands.length; x++)
      for (let y = x + 1; y < cands.length; y++) {
        const c = P.pairCompat(cands[x], cands[y]);
        if (c.score >= 3) pairs.push({ a: cands[x], b: cands[y], s: c.score + rnd() * 0.6, why: c.why });
      }
    pairs.sort((p, q) => q.s - p.s);
    const taken = new Set();
    let out = items.slice();
    let made = 0;
    for (const pr of pairs) {
      if (made >= maxPairs) break;
      if (taken.has(pr.a.uid) || taken.has(pr.b.uid)) continue;
      taken.add(pr.a.uid);
      taken.add(pr.b.uid);
      const [first, second] = out.indexOf(pr.a) < out.indexOf(pr.b) ? [pr.a, pr.b] : [pr.b, pr.a];
      // The pair runs where its earlier member sits; the block takes that member's tier
      out.splice(out.indexOf(second), 1);
      out.splice(out.indexOf(first) + 1, 0, second);
      first._pair = second.uid;
      first.supersetWhy = second.supersetWhy = pr.why;
      made++;
    }
    return letterPairs(out);
  };
  /** Order + supersets. fresh: decide pairings anew; otherwise keep existing pairs that are still compatible. */
  P.arrange = function (items, supersets, type, opts) {
    opts = opts || {};
    const before = {};
    items.forEach((i, k) => {
      const nx = items[k + 1];
      if (i.superset && nx && nx.superset === i.superset) before[i.uid] = nx.uid;
    });
    items.forEach((i) => (i.superset = null));
    let out = P.order(items, type, opts.ctx);
    if (!supersets || type === 'cardio') {
      out.forEach((i) => (i.supersetWhy = null));
      return out;
    }
    if (opts.fresh) return P.pairSupersets(out, Object.assign({ type }, opts));
    // keep mode (re-roll intensities, edits): re-form previous pairs that are still compatible
    Object.entries(before).forEach(([ua, ub]) => {
      const a = out.find((i) => i.uid === ua), b = out.find((i) => i.uid === ub);
      if (!a || !b || !supersetable(a, type) || !supersetable(b, type) || P.pairCompat(a, b).score < 3) return;
      out.splice(out.indexOf(b), 1);
      out.splice(out.indexOf(a) + 1, 0, b);
      a._pair = b.uid;
    });
    out.forEach((i) => !Object.values(before).includes(i.uid) && !before[i.uid] && (i.supersetWhy = null));
    return letterPairs(out);
  };

  /* ═════════════════════ Quality evaluation ═════════════════════ */
  const ALLOWED = {
    push: ['chest', 'front-delts', 'side-delts', 'triceps'],
    pull: ['lats', 'upper-back', 'traps', 'rear-delts', 'biceps', 'forearms', 'lower-back'],
    legs: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abs', 'obliques', 'lower-back'],
    chest: ['chest', 'triceps', 'front-delts', 'side-delts'],
    arms: ['biceps', 'triceps', 'forearms'],
  };
  const COMPOUND_RANGE = { full: [0.5, 0.9], push: [0.33, 0.75], pull: [0.33, 0.75], legs: [0.4, 0.9], chest: [0.33, 0.8], arms: [0, 0.5] };
  const DIM_W = { coverage: 0.2, movement: 0.08, redundancy: 0.12, balance: 0.08, order: 0.1, intensity: 0.1, supersets: 0.06, volume: 0.08, duration: 0.06, focus: 0.12 };
  P.DIM_W = DIM_W;
  /**
   * Programming-quality score (0–100) with hard-constraint violations.
   * Hard: equipment / restrictions / exclusions (unless the user locked or added the exercise), duplicates,
   * resistance work in a cardio session, missing required coverage that is feasible and fits the count.
   */
  P.evaluate = function (w, ctx) {
    const type = w.type;
    const items = w.exercises;
    const exs = items.map((i) => WT.ex(i.exId));
    const n = items.length || 1;
    const hard = [];
    const dims = {};
    items.forEach((i, k) => {
      const ex = exs[k];
      if (!ex) return hard.push('Unknown exercise ' + i.exId);
      if (i.locked) return;
      if (!WT.hasEquipment(ex, ctx.equipment)) hard.push(`${ex.name} needs equipment you don't have`);
      if (WT.isRestricted(ex, ctx.p)) hard.push(`${ex.name} is restricted`);
      if (ctx.excluded.has(ex.id)) hard.push(`${ex.name} is excluded`);
      if (ctx.avoid.has(ex.primary)) hard.push(`${ex.name} trains an avoided muscle`);
    });
    if (new Set(items.map((i) => i.exId)).size !== items.length) hard.push('Duplicate exercise');
    if (type === 'cardio' && exs.some((ex) => ex && !isConditioning(ex) && ex.primary !== 'cardio')) hard.push('Resistance exercise in a cardio workout');
    const valid = exs.filter(Boolean);
    // Coverage
    const req = (w.requires || []).filter((t) => !(w.dropped || []).includes(t));
    const got = req.filter((t) => valid.some((ex) => P.covers(ex, t)));
    req.filter((t) => !got.includes(t) && P.feasible(t, ctx)).forEach((t) => hard.push(`Missing ${P.TOKEN_LABEL[t] || t}`));
    dims.coverage = req.length ? got.length / req.length : 1;
    // Movement variety (patterns for single-focus sessions)
    const focusedType = !['full', 'push', 'pull', 'legs'].includes(type);
    const kinds = new Set(valid.map((ex) => (focusedType ? ex.pattern : WT.moveOf(ex))));
    dims.movement = Math.min(1, kinds.size / Math.max(1, Math.min(valid.length - 1, focusedType ? 3 : 5)));
    // Redundancy
    let red = 0;
    for (let a = 0; a < valid.length; a++)
      for (let b = a + 1; b < valid.length; b++) {
        const x = valid[a], y = valid[b];
        if (x.pattern === y.pattern && x.primary === y.primary) red += x.load === y.load ? 1 : focusedType ? 0.25 : 0.5;
      }
    if (!focusedType) {
      const prim = {};
      valid.forEach((ex) => (prim[ex.primary] = (prim[ex.primary] || 0) + 1));
      Object.values(prim).forEach((c) => c > 2 && (red += (c - 2) * 0.5));
    }
    dims.redundancy = Math.max(0, 1 - red / Math.max(1, valid.length / 3));
    // Compound / isolation balance
    const range = COMPOUND_RANGE[type] || [0, 1];
    const comp = valid.filter((ex) => ex.category === 'compound').length / Math.max(1, valid.length);
    dims.balance = comp < range[0] ? Math.max(0, 1 - (range[0] - comp) * 3) : comp > range[1] ? Math.max(0, 1 - (comp - range[1]) * 3) : 1;
    // Order: tier progression and back-to-back fatigue
    let bad = 0;
    const blocks = WT.groupBlocks(items);
    const bt = (b) => Math.min(...b.map((i) => TIER[P.roleOf(i, type)] ?? 3));
    for (let k = 1; k < blocks.length; k++) {
      if (bt(blocks[k]) < bt(blocks[k - 1]) && type !== 'cardio') bad += 1;
      const a = blocks[k - 1][blocks[k - 1].length - 1], b = blocks[k][0];
      if (bt(blocks[k - 1]) <= 1 && bt(blocks[k]) <= 1 && P.conflict(a, b) >= 1.25) bad += 0.5;
    }
    dims.order = Math.max(0, 1 - bad / Math.max(1, items.length - 1));
    // Intensity distribution
    const tally = WT.intensityTally(items);
    const regShare = ((tally.regular || 0) + (tally.standard || 0)) / n;
    let ip = regShare >= 0.5 ? 1 : regShare / 0.5;
    items.forEach((i) => !i.locked && !P.intensitySuitable(i, type) && (ip -= 0.25));
    if ((tally.drop || 0) + (tally.buildup || 0) > 1) ip -= 0.25;
    dims.intensity = Math.max(0, ip);
    // Supersets
    const groups = {};
    items.forEach((i) => i.superset && (groups[i.superset] = groups[i.superset] || []).push(i));
    const ss = Object.values(groups);
    dims.supersets = ss.length ? ss.filter((g) => g.length === 2 && P.pairCompat(g[0], g[1]).score >= 3).length / ss.length : 1;
    // Volume & recovery
    let vol = 1;
    if (!focusedType) {
      const sess = P.sessionSets(items);
      Object.entries(sess).forEach(([m, v]) => v > P.sessionCap(m, ctx) + 2 && (vol -= 0.2));
    }
    valid.forEach((ex) => {
      const t = WT.weeklyTarget(ex.primary);
      if (t && WT.db.history.length && (ctx.weekly[ex.primary] || 0) > t * 1.6) vol -= 0.1;
      if ((ctx.fatigue[ex.primary] || 0) >= 8) vol -= 0.1;
    });
    dims.volume = Math.max(0, vol);
    // Duration
    const dur = (w.settings || {}).duration;
    dims.duration = dur ? WT.clamp(1 - Math.max(0, Math.abs((w.estimatedMin || WT.estimateMinutes(items)) - dur) - 8) / 20, 0, 1) : 1;
    // Focus: no unrelated muscles filling slots
    const allowed = ALLOWED[type];
    dims.focus = allowed ? valid.filter((ex) => allowed.includes(ex.primary)).length / Math.max(1, valid.length) : 1;
    let score = 0;
    Object.entries(DIM_W).forEach(([k, wt]) => (score += wt * dims[k]));
    return { score: Math.round(score * 100), hard, dims };
  };

  /* ═════════════════════ Generation ═════════════════════ */
  function buildOnce(type, n, settings, ctx, keep, rnd) {
    const focused = !['full', 'push', 'pull', 'legs', 'custom'].includes(type);
    const bp = BP[type] ? BP[type](ctx, rnd) : legacyBlueprint(type, settings, ctx, n);
    bp.focused = focused;
    const used = new Set();
    const chosen = [];
    const items = [];
    const limits = [];
    const dropped = [];
    const byId = {};
    const keepLeft = (keep || []).filter((k) => WT.ex(k.exId)).map((k) => Object.assign({}, k));
    keepLeft.forEach((k) => used.add(k.exId));
    const room = () => n - items.length - keepLeft.length;
    const place = (s, ex, why, base) => {
      chosen.push(ex);
      byId[s.id] = ex;
      const role = s.legacy ? P.inferRole(ex, type, s) : s.role;
      items.push(Object.assign({ uid: WT.uid(), exId: ex.id, locked: false }, base || {}, { slot: strip(Object.assign({}, s, { role })), slotIndex: items.length, role, why: why }));
    };
    // Required coverage tokens whose muscles are all avoided are dropped, with a note
    (bp.require || []).forEach((t) => {
      const ms = TOKEN_MUSCLES[t] || [];
      if (ms.length && ms.every((m) => ctx.avoid.has(m))) {
        dropped.push(t);
        limits.push(`No ${P.TOKEN_LABEL[t]} today — you're avoiding ${ms.map(WT.muscleName).join(' and ').toLowerCase()}.`);
      }
    });
    // 1. Required slots (locked items claim a slot they fit)
    bp.required.forEach((s) => {
      if ((s.cover || []).length && s.cover.every((t) => dropped.includes(t))) return;
      const k = keepLeft.find((x) => matchSlot(WT.ex(x.exId), s, 0) || matchSlot(WT.ex(x.exId), s, 1));
      if (k) {
        keepLeft.splice(keepLeft.indexOf(k), 1);
        place(s, WT.ex(k.exId), k.why || ['Locked by you'], k);
        return;
      }
      if (room() <= 0) return;
      const pick = fillSlot(s, ctx, used, chosen, focused, byId);
      if (!pick) return;
      used.add(pick.ex.id);
      const why = [s.legacy ? s.label : `${P.ROLE_LABEL[s.role]} — ${s.label.toLowerCase()}`].concat(pick.why);
      if (pick.level > 0 && !s.legacy) why.push('Closest available match');
      place(labelled(s, pick.ex), pick.ex, why.slice(0, 3));
    });
    // 2. Optional slots, drawn by need
    const pool = bp.optional.slice();
    let guard = 0;
    while (room() > 0 && pool.length && guard++ < 40) {
      const ws = pool.map((s) => [s, optWeight(s, bp, ctx, items, n)]);
      const s = pickW(ws, rnd);
      if (!s) break;
      pool.splice(pool.indexOf(s), 1);
      const pick = fillSlot(s, ctx, used, chosen, focused, byId);
      if (!pick) continue;
      used.add(pick.ex.id);
      place(labelled(s, pick.ex), pick.ex, [purpose(s, ctx)].concat(pick.why).slice(0, 3));
    }
    // 3. Pad (very high counts or sparse equipment)
    const padFrom = bp.pad || bp.required.concat(bp.optional);
    guard = 0;
    while (room() > 0 && padFrom.length && guard < padFrom.length * 2) {
      const base = padFrom[guard++ % padFrom.length];
      const s = Object.assign({}, base, { id: base.id + '-x' + guard, label: base.label + (base.legacy ? ' (extra)' : ''), repeat: true, p: base.legacy ? null : base.p, role: base.role === 'primary' ? 'accessory' : base.role, essential: false, heavy: false, lead: false });
      const pick = fillSlot(s, ctx, used, chosen, focused, byId, 2);
      if (!pick) continue;
      used.add(pick.ex.id);
      place(s, pick.ex, [`Extra ${(s.label || '').toLowerCase()}`].concat(pick.why).slice(0, 3));
    }
    // 4. Locked items that fit no required slot
    keepLeft.forEach((k) => {
      const ex = WT.ex(k.exId);
      chosen.push(ex);
      const role = k.role || P.inferRole(ex, type, k.slot);
      items.push(Object.assign({}, k, { role, slotIndex: items.length, slot: k.slot || { label: WT.muscleName(ex.primary), m: [ex.primary], p: null, role } }));
    });
    // 5. Coverage check & explanation
    (bp.require || []).forEach((t) => {
      if (dropped.includes(t) || items.some((i) => P.covers(WT.ex(i.exId), t))) return;
      const idx = bp.required.findIndex((s) => (s.cover || []).includes(t));
      if (idx >= n) limits.push(`With ${n} exercise${n === 1 ? '' : 's'} there's no room for ${P.TOKEN_LABEL[t]}.`);
      else limits.push(`No ${P.TOKEN_LABEL[t]} could be included — ${P.whyMissing(t, ctx)}.`);
    });
    return { bp, items, limits, dropped };
  }

  P.generate = function (settings, keep) {
    settings = Object.assign(WT.defaultSettings(settings && settings.type), settings || {});
    const type = settings.type;
    const rnd = settings.seed != null ? WT.rng(settings.seed) : Math.random;
    const ctx = G().buildContext(settings);
    ctx.rnd = rnd;
    let n = settings.autoCount ? WT.clamp(Math.round((settings.duration - 5) / (settings.supersets ? 7.5 : 9)), 3, 10) : WT.clamp(+settings.count || 6, 1, 12);
    if (type === 'cardio') n = Math.min(n, 6);
    const randomMode = settings.intensityMode !== 'manual';
    let best = null;
    const tries = type === 'cardio' ? 1 : 6;
    for (let attempt = 0; attempt < tries; attempt++) {
      const { bp, items, limits, dropped } = buildOnce(type, n, settings, ctx, keep, rnd);
      if (randomMode) P.randomize(items, ctx, rnd);
      else G().assignIntensities(items, { heavy: +settings.heavy || 0, burnout: +settings.burnout || 0 }, type);
      items.forEach((i) => {
        if (i.locked && i.sets) return;
        Object.assign(i, WT.prescribe(WT.ex(i.exId), i.intensity));
      });
      const arranged = P.arrange(items, settings.supersets, type, { fresh: true, duration: settings.duration, rnd, ctx });
      G().fitDuration(arranged, settings.duration);
      const draft = { type, settings, exercises: arranged, requires: bp.require || [], dropped, estimatedMin: WT.estimateMinutes(arranged) };
      const quality = P.evaluate(draft, ctx);
      const cand = { bp, items: arranged, limits, quality, dropped, attempts: attempt + 1 };
      if (!best || quality.hard.length < best.quality.hard.length || (quality.hard.length === best.quality.hard.length && quality.score > best.quality.score)) best = cand;
      if (!quality.hard.length && quality.score >= 80) break;
    }
    best.quality.attempts = best.attempts;
    return assemble(type, settings, n, best, ctx, randomMode);
  };

  function assemble(type, settings, n, best, ctx, randomMode) {
    const arranged = best.items;
    const notes = [];
    const hot = Object.entries(ctx.fatigue)
      .filter(([m, v]) => v >= 8 && m !== 'cardio')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (hot.length) notes.push(`Recently trained hard: ${hot.map(([m, v]) => `${WT.muscleName(m)} (~${WT.fmtNum(Math.round(v))} sets)`).join(', ')}. Those muscles were given less work today.`);
    best.limits.forEach((l) => notes.push(l));
    if (arranged.length < n) notes.push(`Only ${arranged.length} suitable exercises were found with your equipment and exclusions.`);
    const groups = {};
    arranged.forEach((i) => i.superset && (groups[i.superset] = groups[i.superset] || []).push(i));
    Object.entries(groups).forEach(([L, g]) => notes.push(`Superset ${L}: ${g.map((i) => WT.ex(i.exId).name).join(' + ')} — ${g[0].supersetWhy || 'non-competing muscles'}, to save time.`));
    if (best.bp.describe) best.bp.emphasis = best.bp.describe(arranged);
    const objective = P.objective(type, best.bp, arranged);
    const majorGap = type === 'full' && (best.bp.require || []).some((t) => !best.dropped.includes(t) && !arranged.some((i) => P.covers(WT.ex(i.exId), t)));
    const title = type === 'custom' ? 'Custom: ' + (settings.targets || []).map((t) => WT.CUSTOM_TARGETS[t]).join(', ') : WT.typeName(type) + (majorGap ? ' (partial)' : '');
    return {
      id: WT.uid(),
      type,
      title,
      createdAt: new Date().toISOString(),
      settings,
      plan: WT.intensityTally(arranged),
      intensityMode: randomMode ? 'random' : 'manual',
      objective,
      requires: best.bp.require || [],
      quality: best.quality,
      notes,
      exercises: arranged,
      estimatedMin: WT.estimateMinutes(arranged),
    };
  }

  /** One-line description of what the session is for. */
  P.objective = function (type, bp, items) {
    if (type === 'cardio') return 'Conditioning: a main cardio block plus short conditioning work — no resistance training.';
    const main = items.filter((i) => i.role === 'primary').map((i) => WT.ex(i.exId).name);
    const lead = { full: 'Full body', push: 'Push', pull: 'Pull', legs: 'Legs', chest: 'Chest', arms: 'Arms' }[type] || WT.typeName(type);
    const extras = items.filter((i) => i.why && /priority|behind/.test(i.why[0] || '')).map((i) => WT.muscleName(WT.ex(i.exId).primary).toLowerCase());
    let s = `${lead}${bp.emphasis ? ` — ${bp.emphasis}` : ''}.`;
    if (main.length) s += ` Main lift${main.length > 1 ? 's' : ''}: ${main.join(', ')}.`;
    if (extras.length) s += ` Extra ${[...new Set(extras)].join(' & ')} for your goals.`;
    return s;
  };

  /* ═════════════════════ Role-preserving swaps ═════════════════════ */
  P.alternatives = function (workout, uid, opts) {
    opts = opts || {};
    const item = workout.exercises.find((e) => e.uid === uid);
    if (!item) return [];
    const cur = WT.ex(item.exId);
    const settings = Object.assign(WT.defaultSettings(workout.type), workout.settings || {});
    const ctx = G().buildContext(settings);
    const used = new Set(workout.exercises.map((e) => e.exId));
    const others = workout.exercises.filter((e) => e.uid !== uid);
    const chosen = others.map((e) => WT.ex(e.exId)).filter(Boolean);
    const curMove = WT.moveOf(cur);
    const base = item.slot || {};
    // Slots from older drafts (or user-added items) have no movement info: derive it from the current exercise
    const slot = base.moves
      ? Object.assign({}, base, { legacy: false })
      : Object.assign({}, base, { legacy: false, label: WT.MOVES[curMove], moves: [curMove], m: base.m || [cur.primary], role: P.roleOf(item, workout.type) });
    const focused = !['full', 'push', 'pull', 'legs', 'custom'].includes(workout.type);
    // Coverage the current exercise alone provides — losing it would open a gap
    const reqs = workout.requires || (workout.type === 'full' ? ['knee', 'push', 'pull', 'hip'] : []);
    const sole = reqs.filter((t) => P.covers(cur, t) && !chosen.some((c) => P.covers(c, t)));
    const loaded = (e) => !['bw', 'bwl', 'time', 'cardio'].includes(e.load);
    const out = [];
    WT.exercises.forEach((ex) => {
      if (!G().eligible(ex, ctx, used)) return;
      if (workout.type !== 'cardio' && isConditioning(ex) && !isConditioning(cur)) return;
      const level = matchSlot(ex, slot, 0) ? 0 : matchSlot(ex, slot, 1) || ex.primary === cur.primary ? 1 : matchSlot(ex, slot, 2) ? 2 : -1;
      if (level < 0 || (level === 2 && !opts.wide)) return;
      const r = G().scoreExercise(ex, slot, ctx, chosen, focused, 0);
      let bonus = loaded(ex) === loaded(cur) ? 1.5 : 0;
      if (item.intensity && ex.intensities.includes(item.intensity)) bonus += 1;
      if (WT.moveOf(ex) === curMove) bonus += 1;
      const gap = sole.filter((t) => !P.covers(ex, t));
      const duplicate = chosen.some((c) => c.pattern === ex.pattern && c.primary === ex.primary && c.load === ex.load);
      out.push({ ex, score: r.s - level * 4 + (level === 0 && !gap.length ? 3 : 0) + bonus - gap.length * 4 - (duplicate ? 2 : 0), level, why: r.why, samePattern: ex.pattern === cur.pattern, preservesRole: level === 0 && !gap.length, gap: gap.map((t) => P.TOKEN_LABEL[t]), duplicate });
    });
    out.sort((a, b) => b.score - a.score);
    out.role = slot.label;
    if (!out.some((a) => a.preservesRole))
      out.limitation = `No other ${String(slot.label || WT.MOVES[curMove]).toLowerCase()} fits your equipment and restrictions${opts.wide ? '' : ' — switch to “Same muscle group” to choose freely'}.`;
    return out;
  };
})();
