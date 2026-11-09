/* Learning from notes: turns the free-text notes you leave on exercises and workouts into signals the
 * generator uses. Fully local and deterministic — keyword rules, no AI service, no network.
 *
 *   "Push-ups are tough on my wrists"   → pain · push-up family · wrist   (recurring)
 *   "Pistols were way too hard"          → too hard · Pistol Squat         (favour an easier variation)
 *   "Too easy, need something harder"    → too easy · this exercise        (step the variation up)
 *   "Love these!" / "Hate lunges"        → like / dislike                  (selection bonus / avoid)
 *   "Knee a bit sore today"              → pain · knee                     (temporary: fades in days)
 *   "Wrists feel fine now"               → resolved · wrist                (cancels earlier wrist pain)
 *
 * Sources: exercise notes and workout notes in history (and the workout in progress), plus standing
 * notes added from an exercise's detail sheet (db.learn.notes). A signal can be forgotten from
 * Settings (db.learn.forgotten holds its key). Later notes override earlier contradicting ones.
 */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});

  /* ───────── Text normalisation ───────── */
  const stem = (w) => (w.length > 4 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
  function flat(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/\b(push|press|pull|chin|sit|v|step)[\s-]?ups?\b/g, (m, a) => (a === 'press' ? 'push' : a) + ' up')
      .replace(/[^a-z0-9' ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const norm = (text) => flat(text).split(' ').map(stem).join(' ');

  /* ───────── Vocabulary ───────── */
  const NEG = /\b(not|no|never|isn't|wasn't|didn't|doesn't|don't|without|nothing)\b[^.]{0,18}$/;
  const KINDS = {
    resolved: /\b(no (more )?(pain|discomfort)|pain ?free|(doesn't|does not|didn't|did not|don't|do not) (hurt|bother|ache)|feels? (fine|better|good|great|ok|okay) now|(fine|better|healed|recovered|okay|ok) now|no longer (hurt|bother|ache)\w*|all good now|easy on my)\b/,
    dislike: /\b(hate[sd]?|hating|dislike[sd]?|(don't|do not|didn't|did not) (like|enjoy|love)|not a fan|boring|annoying|never again|can't stand|cannot stand|awful|terrible|not for me|no more of (these|this|those)|skip (this|these|those) next time|rather not)\b/,
    pain: /\b(hurts?|hurting|hurted|pain|painful|aches?|aching|achy|sore|soreness|tweak\w*|strain\w*|pinch\w*|uncomfortable|discomfort|bother\w*|aggravat\w*|irritat\w*|flare\w*|injur\w*|tendonitis|tendinitis|arthritis|clicking|popping|tough on|hard on|rough on|kills? my|killed my|killing my|stress on)\b/,
    tooHard: /\b(too (hard|difficult|heavy|tough|advanced|much)|(couldn't|could not|can't|cannot|unable to|wasn't able to) (do|finish|complete|get|manage|hold)|failed|struggl\w*|way too|impossible|brutal|form (broke|breaks|fell apart)|need(s)? (to be )?easier|too many)\b/,
    tooEasy: /\b(too (easy|light)|very easy|so easy|really easy|pretty easy|easy|effortless|breeze|not (challenging|hard enough)|could (have )?(do|done) (a lot )?more|need(s)? (to be )?harder|more challenging|want(ed)? (it )?harder)\b/,
    like: /\b(love[sd]?|loving|enjoy\w*|i like|like (it|this|these|them|that)|liked|really like|fun|favou?rite|awesome|amazing|felt (good|great|strong)|good pump|great pump|keep (this|these|it)|more of (this|these))\b/,
  };
  const ONGOING = /\b(always|every ?time|whenever|chronic|old injury|injury|injured|surgery|arthritis|tendonitis|tendinitis|bad (wrist|knee|shoulder|back|elbow|neck)s?|tend to|tends to|usually|keeps?|anymore|any more|every session|each time|again)\b/;
  const TEMP = /\b(today|tonight|this (time|morning|evening|week|session|workout)|right now|a bit|a little|slightly|tired|fatigued|exhausted|didn't sleep|no sleep|bad sleep|hungover|sore from|still sore|yesterday|after (the )?run|doms)\b/;

  const JOINT_WORDS = [
    ['wrist', /\bwrists?\b/], ['knee', /\bknees?\b/], ['elbow', /\belbows?\b/], ['neck', /\bneck\b/],
    ['back', /\b(lower back|low back|lumbar|back)\b/], ['shoulder', /\b(shoulders?|rotator cuff)\b/], ['impact', /\b(ankles?|shins?|achilles|feet|foot|impact|jumping|jumps)\b/],
  ];
  const JOINT_NAMES = { wrist: 'wrists', knee: 'knees', elbow: 'elbows', neck: 'neck', back: 'lower back', shoulder: 'shoulders', impact: 'impact / jumping' };
  const MUSCLE_WORDS = [
    ['chest', /\b(chest|pecs?)\b/], ['biceps', /\bbiceps?\b/], ['triceps', /\btriceps?\b/], ['quads', /\bquads?\b/], ['hamstrings', /\bhamstrings?|hammies\b/],
    ['glutes', /\bglutes?\b/], ['calves', /\bcal(f|ves)\b/], ['abs', /\babs\b/], ['obliques', /\bobliques?\b/], ['forearms', /\bforearms?\b/],
    ['g:legs', /\blegs?\b/], ['g:arms', /\barms?\b/], ['g:core', /\bcore\b/], ['g:shoulders', /\b(shoulders|delts)\b/], ['g:back', /\bback\b/], ['g:cardio', /\bcardio\b/],
  ];
  const EQUIP_WORDS = [
    ['cable', /\bcables?\b/], ['machine', /\bmachines?\b/], ['db', /\bdumbbells?\b/], ['bb', /\bbarbells?\b/], ['kb', /\bkettlebells?\b/], ['mb', /\bmed(icine)? ?balls?\b/], ['bw', /\b(bodyweight|body weight|no equipment|calisthenics)\b/],
  ];
  // Plain words people use for a family of exercises (matched after specific exercise names).
  const FAMILY_WORDS = [
    ['push-up', /\bpush ups?\b/], ['pull-up', /\b(pull|chin) ups?\b/], ['squat', /\bsquats?\b/], ['lunge', /\blunges?\b/], ['plank', /\bplanks?\b/],
    ['curl', /\bcurls?\b/], ['row', /\brows\b/], ['fly', /\b(flys|flyes|flies|fly)\b/], ['dip', /\bdips?\b/], ['crunch', /\b(crunch(es)?|sit ups?|situps?)\b/],
    ['bridge', /\b(bridges?|hip thrusts?)\b/], ['burpee', /\bburpees?\b/], ['jump', /\b(jumps|jumping|plyos?|plyometrics?)\b/], ['run', /\b(runs?|running)\b/],
    ['raise', /\braises\b/], ['leg raise', /\bleg raises?\b/], ['handstand', /\bhandstands?\b/], ['press', /\bpresses\b/],
  ];
  // Short names people actually type for specific exercises.
  const ALIASES = {
    pistols: 'pistol-squat', pistol: 'pistol-squat', shrimp: 'shrimp-squat', sissy: 'sissy-squat', archer: 'archer-pushup', diamond: 'diamond-pushup', diamonds: 'diamond-pushup',
    nordic: 'nordic-curl', nordics: 'nordic-curl', hindu: 'hindu-pushup', 'dive bomber': 'dive-bomber-pushup', sphinx: 'sphinx-pushup', 'tiger bend': 'tiger-bend-pushup',
    'mountain climber': 'mountain-climber', superman: 'superman-raise', 'v up': 'v-up', 'l sit': 'floor-l-sit', 'pike push up': 'pike-pushup', 'pike': 'pike-pushup',
    'wall sit': 'wall-sit', 'jumping jack': 'jumping-jacks', 'bear crawl': 'bear-crawl', 'hollow hold': 'hollow-hold', 'dead bug': 'dead-bug', 'bird dog': 'bird-dog',
    'skull crusher': 'db-skullcrusher', 'face pull': 'face-pull', 'lat pulldown': 'lat-pulldown', 'pulldown': 'lat-pulldown', 'kroc': 'kroc-row', 'hammer curl': 'hammer-curl',
    'goblet': 'goblet-squat', 'bulgarian': 'bulgarian-split-squat', 'bulgarians': 'bulgarian-split-squat', 'hip thrust': 'db-hip-thrust', 'calf raise': 'calf-raise',
    'one arm push up': 'one-arm-pushup', 'clap push up': 'clap-pushup', 'side plank': 'side-plank',
  };

  const GENERIC = new Set(['push up', 'pull up', 'chin up', 'sit up']);
  /** Alias index for exercise names: [[normalized phrase, exId]], longest first. Rebuilt when the library changes. */
  let aliasCache = null, aliasFor = null;
  function aliasIndex() {
    if (aliasCache && aliasFor === WT.exercises) return aliasCache;
    const out = [];
    WT.exercises.forEach((ex) => {
      const names = new Set([norm(ex.name), norm(ex.name.replace(/\(.*?\)/g, '')), norm(ex.id.replace(/-/g, ' '))]);
      // Generic words ('push up', 'pull up'…) stay family words, not one specific exercise.
      names.forEach((n) => n.split(' ').length >= 2 && !GENERIC.has(n) && out.push([n, ex.id]));
    });
    Object.entries(ALIASES).forEach(([k, id]) => WT.ex(id) && out.push([norm(k), id]));
    out.sort((a, b) => b[0].length - a[0].length);
    aliasCache = out;
    aliasFor = WT.exercises;
    return out;
  }

  /* ───────── Parsing ───────── */
  function findKinds(c) {
    const found = new Set();
    Object.entries(KINDS).forEach(([k, re]) => {
      const g = new RegExp(re.source, 'g');
      let m;
      while ((m = g.exec(c))) {
        const before = c.slice(Math.max(0, m.index - 22), m.index);
        const negated = k !== 'dislike' && k !== 'resolved' && NEG.test(before);
        if (!negated) found.add(k);
        else if (k === 'pain') found.add('resolved');
        else if (k === 'like') found.add('dislike');
        if (!g.global) break;
      }
    });
    // "easy on my wrists" is relief, not "too easy"; "too hard" isn't also "easy".
    if (found.has('resolved') && /\beasy on\b/.test(c)) found.delete('tooEasy');
    if (found.has('tooHard')) found.delete('tooEasy');
    if (found.has('dislike')) found.delete('like');
    if (found.has('resolved')) found.delete('pain');
    return [...found];
  }

  /**
   * Parse one note into signals.
   * ctx: { exId?: exercise the note is attached to }
   * Returns [{ kind, target: {type, key}, joint?, persistence, clause }]
   */
  WT.parseNote = function (text, ctx) {
    ctx = ctx || {};
    const clauses = String(text || '').split(/[.!?;\n]+|\bbut\b|\bthough\b|\bhowever\b|\balthough\b/i).map((c) => c.trim()).filter(Boolean);
    const out = [];
    clauses.forEach((raw) => {
      const toks = flat(raw).split(' ').filter(Boolean);
      if (!toks.length) return;
      const kinds = findKinds(' ' + toks.join(' ') + ' ');
      if (!kinds.length) return;
      // Targets: specific exercises (longest name first, matched on singularised words), then families,
      // joints, muscles and equipment in the words that are left.
      const st = toks.map(stem);
      const used = toks.map(() => false);
      const targets = [];
      aliasIndex().forEach(([n, id]) => {
        const nt = n.split(' ');
        for (let i = 0; i + nt.length <= st.length; i++) {
          if (nt.every((w, k) => st[i + k] === w && !used[i + k])) {
            nt.forEach((w, k) => (used[i + k] = true));
            if (!targets.some((t) => t.type === 'exercise' && t.key === id)) targets.push({ type: 'exercise', key: id });
          }
        }
      });
      const rest = toks.map((t, i) => (used[i] ? '#' : t)).join(' ');
      const fl = ' ' + rest + ' ';
      const flRaw = ' ' + flat(raw) + ' ';
      FAMILY_WORDS.forEach(([f, re]) => re.test(fl) && targets.push({ type: 'family', key: f }));
      const joints = JOINT_WORDS.filter(([, re]) => re.test(flRaw)).map(([j]) => j);
      const painish = kinds.includes('pain') || kinds.includes('resolved');
      // "back"/"shoulders" are joints when something hurts, muscle groups otherwise
      if (!painish) MUSCLE_WORDS.forEach(([m, re]) => re.test(fl) && targets.push({ type: m.startsWith('g:') ? 'group' : 'muscle', key: m.replace('g:', '') }));
      EQUIP_WORDS.forEach(([q, re]) => re.test(fl) && targets.push({ type: 'equipment', key: q }));
      if (targets.some((t) => t.type === 'family' && t.key === 'jump') && joints.includes('impact') && !painish) joints.splice(joints.indexOf('impact'), 1);
      const direct = targets.filter((t) => t.type === 'exercise' || t.type === 'family');
      // Unnamed subject ("this", "it", or nothing) → the exercise the note is attached to.
      if (!direct.length && ctx.exId && !(painish && joints.length && targets.length)) targets.unshift({ type: 'exercise', key: ctx.exId });
      const persistence = (k) => {
        if (k === 'like' || k === 'dislike') return 'lasting';
        if (k === 'tooHard' || k === 'tooEasy') return TEMP.test(flRaw) && !ONGOING.test(flRaw) ? 'temporary' : 'progress';
        if (k === 'resolved') return 'event';
        if (ONGOING.test(flRaw)) return 'ongoing';
        if (TEMP.test(flRaw) || /\bsore(ness)?\b/.test(flRaw)) return 'temporary';
        return 'recurring';
      };
      kinds.forEach((kind) => {
        const p = persistence(kind);
        if (kind === 'pain' || kind === 'resolved') {
          const exTargets = targets.filter((t) => t.type === 'exercise' || t.type === 'family');
          exTargets.forEach((t) => out.push({ kind, target: t, joints, persistence: p, clause: raw }));
          joints.forEach((j) => out.push({ kind, target: { type: 'joint', key: j }, joints: [j], persistence: p, clause: raw, viaExercise: exTargets.length > 0 }));
          return;
        }
        targets.forEach((t) => out.push({ kind, target: t, joints, persistence: p, clause: raw }));
      });
    });
    return out;
  };

  /* ───────── Sources ───────── */
  /** Every note Forge learns from: [{ key, text, date, exId, where }], oldest first. */
  WT.noteSources = function () {
    const out = [];
    const sess = (WT.db.history || []).slice();
    if (WT.db.active) sess.push(Object.assign({ live: true }, WT.db.active));
    sess.forEach((s) => {
      const date = s.endedAt || s.startedAt;
      if (s.notes && s.notes.trim()) out.push({ key: `${s.id}:session`, text: s.notes, date, exId: null, where: s.live ? 'Current workout' : s.title });
      (s.exercises || []).forEach((e) => e.notes && e.notes.trim() && out.push({ key: `${s.id}:${e.uid}`, text: e.notes, date, exId: e.exId, where: s.live ? 'Current workout' : s.title }));
    });
    ((WT.db.learn && WT.db.learn.notes) || []).forEach((n) => out.push({ key: `note:${n.id}`, text: n.text, date: n.at, exId: n.exId || null, where: 'Exercise note' }));
    return out.sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  /** Weight of a signal today, 0…1, by how long it should last. */
  function decay(persistence, days) {
    if (persistence === 'temporary') return days > 10 ? 0 : Math.exp(-days / 4);
    if (persistence === 'ongoing') return days <= 120 ? 1 : Math.exp(-(days - 120) / 60);
    if (persistence === 'recurring') return Math.pow(0.5, days / 60);
    if (persistence === 'progress') return Math.pow(0.5, days / 45);
    if (persistence === 'lasting') return Math.pow(0.5, days / 180);
    return 0;
  }
  const OPPOSITE = { tooHard: 'tooEasy', tooEasy: 'tooHard', like: 'dislike', dislike: 'like', pain: 'resolved', resolved: 'pain' };
  const tkey = (t) => t.type + ':' + t.key;

  /** All live signals (decayed, de-conflicted, minus forgotten ones), newest last. */
  WT.learnedSignals = function (now) {
    now = now || Date.now();
    const forgotten = new Set(((WT.db.learn && WT.db.learn.forgotten) || []));
    const all = [];
    WT.noteSources().forEach((src) => {
      WT.parseNote(src.text, { exId: src.exId }).forEach((sig, i) => {
        const key = `${src.key}#${sig.kind}#${tkey(sig.target)}`;
        if (forgotten.has(key)) return;
        const days = Math.max(0, (now - new Date(src.date).getTime()) / 864e5);
        all.push(Object.assign(sig, { key, date: src.date, days, source: src, w: decay(sig.persistence, days) }));
      });
    });
    // A later note cancels an earlier contradicting one about the same target ("too hard" → "too easy";
    // "wrists hurt" → "wrists feel fine now"). Joint relief also clears exercise pain tied to that joint.
    all.forEach((s, i) => {
      for (let j = i + 1; j < all.length; j++) {
        const later = all[j];
        if (later.kind !== OPPOSITE[s.kind]) continue;
        if (tkey(later.target) === tkey(s.target) || (s.kind === 'pain' && later.target.type === 'joint' && s.joints.includes(later.target.key))) {
          s.w = 0;
          s.supersededBy = later.key;
          break;
        }
      }
    });
    return all.filter((s) => s.w > 0.05 && s.kind !== 'resolved');
  };

  /* ───────── Preferences used by the generator ───────── */
  WT.learnedPrefs = function (now) {
    const signals = WT.learnedSignals(now);
    return { signals, byTarget: groupBy(signals, (s) => tkey(s.target)), joints: jointSummary(signals), cache: {} };
  };
  function groupBy(a, f) {
    const o = {};
    a.forEach((x) => (o[f(x)] = o[f(x)] || []).push(x));
    return o;
  }
  function jointSummary(signals) {
    const j = {};
    signals.forEach((s) => {
      if (s.kind !== 'pain') return;
      s.joints.forEach((k) => {
        const cur = j[k] || { w: 0, ongoing: false, quote: s.clause, viaExercise: true };
        if (s.w > cur.w) Object.assign(cur, { w: s.w, quote: s.clause });
        cur.ongoing = cur.ongoing || s.persistence === 'ongoing';
        cur.lasting = cur.lasting || s.persistence !== 'temporary';
        cur.viaExercise = cur.viaExercise && !!(s.viaExercise || s.target.type !== 'joint');
        j[k] = cur;
      });
    });
    return j;
  }
  const quote = (s) => `“${s.clause.length > 60 ? s.clause.slice(0, 57) + '…' : s.clause}”`;
  const wristMod = (ex) => (ex.mods || []).find((m) => m.wrist);

  /**
   * How your notes affect one exercise.
   * Returns { delta, avoid, varDir (-1 easier / +1 harder / 0), wrist (prefer wrist-friendly mod),
   *           cap (limit to one of its family, one set fewer), reasons[] }.
   */
  WT.prefEffect = function (ex, prefs) {
    const r = { delta: 0, avoid: false, varDir: 0, wrist: false, cap: false, reasons: [] };
    if (!prefs || !ex) return r;
    if (prefs.cache[ex.id]) return prefs.cache[ex.id];
    const by = prefs.byTarget;
    const g = (WT.MUSCLES[ex.primary] || {}).group;
    const direct = [].concat(by['exercise:' + ex.id] || [], ...(ex.families || []).map((f) => by['family:' + f] || []));
    const say = (txt) => r.reasons.length < 3 && !r.reasons.includes(txt) && r.reasons.push(txt);
    const wm = wristMod(ex);
    direct.forEach((s) => {
      const fam = s.target.type === 'family';
      const w = s.w;
      if (s.kind === 'dislike') {
        r.delta -= (fam ? 6 : 8) * w;
        if (w > (fam ? 0.6 : 0.5)) r.avoid = true;
        say(`You don’t enjoy it: ${quote(s)}`);
      } else if (s.kind === 'like') {
        r.delta += (fam ? 2 : 2.5) * w;
        say(`You enjoy it: ${quote(s)}`);
      } else if (s.kind === 'pain') {
        // "Push-ups are tough on my wrists" is about wrist-loading push-ups: a forearm (dolphin) push-up is fine.
        if (fam && s.joints.length && !s.joints.some((j) => (ex.joints || []).includes(j))) return;
        const wristOnly = s.joints.length ? s.joints.every((j) => j === 'wrist') : (ex.joints || []).includes('wrist') && (ex.joints || []).length === 1;
        if (wm && wristOnly) {
          r.delta -= 2 * w;
          r.wrist = true;
          r.cap = true;
          say(`Wrist-friendly version and fewer sets: ${quote(s)}`);
        } else {
          r.delta -= 9 * w;
          if (w > 0.5 && s.persistence !== 'temporary') r.avoid = true;
          r.cap = true;
          say(`Uncomfortable for you: ${quote(s)}`);
        }
      } else if (s.kind === 'tooHard') {
        r.varDir = Math.min(r.varDir, -1);
        r.delta -= 1 * w;
        say(`Easier variation — you found it too hard: ${quote(s)}`);
      } else if (s.kind === 'tooEasy') {
        r.varDir = Math.max(r.varDir, 1);
        say(`Harder variation — you found it too easy: ${quote(s)}`);
      }
    });
    // Joint limitations reach every exercise that loads that joint, not just the one you named.
    Object.entries(prefs.joints).forEach(([j, info]) => {
      if (!(ex.joints || []).includes(j) || direct.some((s) => s.kind === 'pain')) return;
      if (j === 'wrist' && wm) {
        r.delta -= 1.5 * info.w;
        r.wrist = true;
        say(`Wrist-friendly version: ${quote({ clause: info.quote })}`);
      } else {
        r.delta -= (info.ongoing ? 6 : 4.5) * info.w;
        // A lasting joint limit rules out exercises that load that joint with no friendlier version.
        if (info.lasting && info.w > 0.6) r.avoid = true;
        say(`Loads your ${JOINT_NAMES[j]}: ${quote({ clause: info.quote })}`);
      }
    });
    // Muscle / group / equipment preferences (gentle)
    []
      .concat(by['muscle:' + ex.primary] || [], by['group:' + g] || [], ...ex.equipment.filter((q) => q !== 'bw').map((q) => by['equipment:' + q] || []), WT.isEquipmentFree(ex) ? by['equipment:bw'] || [] : [])
      .forEach((s) => {
        const eq = s.target.type === 'equipment';
        if (s.kind === 'like') r.delta += (eq ? 1 : 1.2) * s.w;
        else if (s.kind === 'dislike') r.delta -= (eq ? 2.5 : 1.5) * s.w;
        else if (s.kind === 'tooEasy' && !eq) r.varDir = Math.max(r.varDir, 1);
        else if (s.kind === 'tooHard' && !eq) r.varDir = Math.min(r.varDir, -1);
      });
    prefs.cache[ex.id] = r;
    return r;
  };

  /** Bonus for the next exercise down / up a progression when the current one is too hard / too easy. */
  WT.progressionBoost = function (ex, prefs) {
    if (!prefs) return null;
    let best = null;
    WT.exercises.forEach((o) => {
      if (o.easier !== ex.id && o.harder !== ex.id) return;
      const e = WT.prefEffect(o, prefs);
      const mods = (o.mods || []).filter((m) => !m.needs);
      // Only when the source exercise has no variation left in that direction
      if (o.harder === ex.id && e.varDir > 0 && !mods.some((m) => m.level > 0)) best = { delta: 2.5, why: `Next step up from ${o.name} (you found it too easy)` };
      if (o.easier === ex.id && e.varDir < 0 && !mods.some((m) => m.level < 0)) best = { delta: 2.5, why: `Easier progression of ${o.name} (you found it too hard)` };
    });
    return best;
  };

  /* ───────── Variations (modifications) ───────── */
  const levelOf = (ex, id) => (WT.modOf(ex, id) || { level: 0 }).level;
  /** Most recently used modification of an exercise in your history (null = as written; undefined = never done). */
  WT.lastVariation = function (exId) {
    const ss = WT.db.history || [];
    for (let i = ss.length - 1; i >= 0; i--) {
      const e = (ss[i].exercises || []).filter((x) => x.exId === exId && !x.skipped).pop();
      if (e) return e.variation || null;
    }
    return undefined;
  };
  /** Next variation one step easier (dir -1) or harder (+1) than `cur`; null id = as written. Returns undefined if none. */
  WT.stepVariation = function (ex, cur, dir, equipment) {
    const lv = levelOf(ex, cur);
    const opts = [{ id: null, name: 'As written', level: 0 }].concat((ex.mods || []).filter((m) => m.level !== 0 && (!m.needs || (equipment || WT.db.profile.equipment).includes(m.needs))));
    const c = opts.filter((o) => (dir > 0 ? o.level > lv : o.level < lv)).sort((a, b) => (dir > 0 ? a.level - b.level : b.level - a.level));
    return c[0];
  };
  /**
   * Variation to prescribe when an exercise is generated: your last one, nudged by notes
   * (too hard → one step easier, too easy → one step harder, sore wrists → wrist-friendly), and
   * an easier one for beginners on harder exercises. Never jumps to an advanced variation unprompted.
   */
  WT.pickVariation = function (ex, prefs, equipment) {
    if (!ex || !(ex.mods || []).length) return { id: null };
    const eff = WT.prefEffect(ex, prefs);
    const wm = wristMod(ex);
    if (eff.wrist && wm) return { id: wm.id, why: 'Wrist-friendly version (from your notes)' };
    const last = WT.lastVariation(ex.id);
    let cur = last === undefined ? null : last;
    if (eff.varDir) {
      const st = WT.stepVariation(ex, cur, eff.varDir, equipment);
      if (st) return { id: st.id, why: eff.varDir < 0 ? `${st.name} — easier, from your notes` : `${st.name} — harder, from your notes` };
    }
    if (last === undefined && WT.db.profile.experience === 'beginner' && ex.difficulty !== 'beginner') {
      const st = WT.stepVariation(ex, null, -1, equipment);
      if (st) return { id: st.id, why: 'Easier variation to start with' };
    }
    if (cur && !WT.modOf(ex, cur)) cur = null;
    return { id: cur, why: cur ? 'Same variation as last time' : null };
  };

  /** Plain-language label for a signal, for the "Learned from your notes" lists. */
  WT.describeSignal = function (s) {
    const t = s.target;
    const what = t.type === 'exercise' ? (WT.ex(t.key) || { name: t.key }).name : t.type === 'family' ? t.key + 's' : t.type === 'joint' ? 'your ' + JOINT_NAMES[t.key] : t.type === 'equipment' ? WT.EQUIPMENT[t.key] || t.key : t.type === 'muscle' ? WT.muscleName(t.key) : WT.GROUPS[t.key] || t.key;
    const verb = { pain: t.type === 'joint' ? 'Go easy on' : 'Uncomfortable:', tooHard: 'Too hard:', tooEasy: 'Too easy:', like: 'You enjoy', dislike: 'You don’t enjoy' }[s.kind];
    const dur = { temporary: 'temporary', ongoing: 'ongoing', recurring: 'recurring', progress: 'until you progress', lasting: 'lasting' }[s.persistence];
    return { title: `${verb} ${what}`, dur, quote: s.clause };
  };
})();
