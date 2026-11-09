/* Exercise database — stored locally, no network required.
 *
 * Video links: we never hard-code YouTube video IDs (they can't be verified offline and
 * break over time). Each exercise opens a targeted YouTube search for its tutorial; you can
 * paste a specific video URL on any exercise (Library → exercise → Edit) and it will embed.
 *
 * Row format:
 * X(id, name, primary, secondary, equipment, category, pattern, difficulty, intensities,
 *   repRange, restSec, loadType, tags, extra)
 *   category:    c = compound, i = isolation, k = cardio/conditioning
 *   intensities: letters of special classes — h = heavy, r = regular, b = burnout. Every exercise is also
 *                eligible for "standard" (the exercise's own recommended sets/reps, no designation).
 *   loadType:    db, cable, machine, bb, mb, kb, bw (bodyweight), bwl (bodyweight, loadable),
 *                time (timed hold), cardio (time + distance)
 */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const list = [];
  function X(id, name, primary, secondary, equipment, category, pattern, difficulty, intensities, reps, rest, load, tags, extra) {
    const [lo, hi] = String(reps).split('-').map(Number);
    // Eligible intensity classes. "standard" (no special designation) is open to every exercise;
    // "regular" (8–12 hypertrophy) to all loadable strength work; heavy/burnout only where listed.
    const L = new Set(intensities.split(''));
    const intens = [];
    if (load !== 'cardio') {
      if (L.has('h')) intens.push('heavy');
      if (L.has('r') || L.has('h')) intens.push('regular');
      if (L.has('b')) intens.push('burnout');
    }
    intens.push('standard');
    const ex = Object.assign(
      {
        id,
        name,
        primary,
        secondary: secondary ? secondary.split(' ') : [],
        equipment: equipment.split(' '),
        category: { c: 'compound', i: 'isolation', k: 'cardio' }[category],
        pattern,
        difficulty: ['', 'beginner', 'intermediate', 'advanced'][difficulty],
        intensities: intens,
        intensity: 'standard',
        repMin: lo,
        repMax: hi || lo,
        rest,
        load,
        tags: tags ? tags.split(' ') : [],
        sets: load === 'cardio' ? 1 : category === 'c' && intens.includes('heavy') ? 4 : 3,
        builtin: true,
      },
      extra || {}
    );
    list.push(ex);
  }

  /* ───────────── CHEST ───────────── */
  X('db-bench-press', 'Dumbbell Bench Press', 'chest', 'front-delts triceps', 'db bench', 'c', 'h-push', 1, 'hr', '6-10', 120, 'db', 'staple');
  X('db-incline-press', 'Incline Dumbbell Press', 'chest', 'front-delts triceps', 'db bench', 'c', 'incline-push', 1, 'hr', '8-10', 120, 'db', 'upper-chest');
  X('db-decline-press', 'Decline Dumbbell Press', 'chest', 'triceps front-delts', 'db bench', 'c', 'decline-push', 2, 'hr', '8-10', 120, 'db', 'lower-chest', { cue: 'Set the bench to a slight decline (or elevate hips in a bridge) to bias the lower pecs.' });
  X('db-floor-press', 'Dumbbell Floor Press', 'chest', 'triceps front-delts', 'db', 'c', 'h-push', 1, 'hr', '6-10', 120, 'db', '');
  X('db-hip-bridge-press', 'Glute-Bridge Dumbbell Press', 'chest', 'triceps glutes', 'db', 'c', 'decline-push', 2, 'r', '8-12', 90, 'db', 'lower-chest', { cue: 'Lie on the floor, drive hips up into a bridge and press — the decline angle hits the lower chest without a decline bench.' });
  X('db-fly', 'Dumbbell Fly', 'chest', 'front-delts', 'db bench', 'i', 'fly', 1, 'rb', '10-15', 75, 'db', '');
  X('db-incline-fly', 'Incline Dumbbell Fly', 'chest', 'front-delts', 'db bench', 'i', 'fly', 2, 'rb', '10-15', 75, 'db', 'upper-chest');
  X('db-decline-fly', 'Decline Dumbbell Fly', 'chest', 'front-delts', 'db bench', 'i', 'fly', 2, 'rb', '10-15', 75, 'db', 'lower-chest');
  X('db-squeeze-press', 'Dumbbell Squeeze Press', 'chest', 'triceps front-delts', 'db bench', 'c', 'h-push', 1, 'rb', '10-12', 75, 'db', '');
  X('db-pullover', 'Dumbbell Pullover', 'chest', 'lats triceps', 'db bench', 'i', 'pullover', 2, 'r', '10-12', 75, 'db', '');
  X('cable-fly', 'Cable Chest Fly', 'chest', 'front-delts', 'cable', 'i', 'fly', 1, 'rb', '12-15', 60, 'cable', '');
  X('cable-fly-high-low', 'High-to-Low Cable Fly', 'chest', 'front-delts', 'cable', 'i', 'fly', 1, 'rb', '12-15', 60, 'cable', 'lower-chest', { cue: 'Pulleys high, sweep down and together toward your hips — the best cable angle for lower chest.' });
  X('cable-fly-low-high', 'Low-to-High Cable Fly', 'chest', 'front-delts', 'cable', 'i', 'fly', 1, 'rb', '12-15', 60, 'cable', 'upper-chest');
  X('cable-chest-press', 'Standing Cable Chest Press', 'chest', 'triceps front-delts abs', 'cable', 'c', 'h-push', 1, 'r', '10-12', 75, 'cable', '');
  X('cable-decline-press', 'Single-Arm Decline Cable Press', 'chest', 'triceps abs', 'cable', 'c', 'decline-push', 2, 'rb', '10-12', 60, 'cable', 'lower-chest');
  X('cable-crossover-bench', 'Lying Cable Fly', 'chest', 'front-delts', 'cable bench', 'i', 'fly', 2, 'rb', '12-15', 60, 'cable', '');
  X('pushup', 'Push-Up', 'chest', 'triceps front-delts abs', 'bw', 'c', 'h-push', 1, 'rb', '10-20', 60, 'bwl', 'staple', { harder: 'archer-pushup' });
  X('incline-pushup', 'Incline Push-Up (Hands Elevated)', 'chest', 'triceps front-delts', 'bw bench', 'c', 'decline-push', 1, 'rb', '12-20', 60, 'bw', 'lower-chest', { harder: 'pushup' });
  X('decline-pushup', 'Decline Push-Up (Feet Elevated)', 'chest', 'front-delts triceps', 'bw bench', 'c', 'incline-push', 2, 'rb', '8-15', 60, 'bwl', 'upper-chest', { harder: 'archer-pushup' });
  X('wide-pushup', 'Wide-Grip Push-Up', 'chest', 'front-delts', 'bw', 'c', 'h-push', 1, 'rb', '10-20', 60, 'bw', '');
  X('archer-pushup', 'Archer Push-Up', 'chest', 'triceps front-delts', 'bw', 'c', 'h-push', 3, 'r', '5-10', 75, 'bw', '');
  X('mb-pushup', 'Medicine Ball Push-Up', 'chest', 'triceps abs', 'mb bw', 'c', 'h-push', 2, 'rb', '8-15', 60, 'bw', '');
  X('chest-dip', 'Chest Dip', 'chest', 'triceps front-delts', 'dip', 'c', 'dip', 2, 'hrb', '6-12', 120, 'bwl', 'lower-chest', { cue: 'Lean forward ~30° and let elbows flare slightly to bias the lower chest.' });
  X('mb-chest-pass', 'Medicine Ball Chest Pass', 'chest', 'triceps front-delts', 'mb', 'c', 'plyo', 1, 'r', '8-12', 60, 'mb', 'power');
  X('bb-bench-press', 'Barbell Bench Press', 'chest', 'front-delts triceps', 'bb bench', 'c', 'h-push', 2, 'hr', '5-8', 150, 'bb', '');
  X('bb-incline-press', 'Incline Barbell Press', 'chest', 'front-delts triceps', 'bb bench', 'c', 'incline-push', 2, 'hr', '6-10', 150, 'bb', 'upper-chest');
  X('machine-chest-press', 'Machine Chest Press', 'chest', 'triceps front-delts', 'machine', 'c', 'h-push', 1, 'hrb', '8-12', 90, 'machine', '');
  X('pec-deck', 'Pec Deck', 'chest', 'front-delts', 'machine', 'i', 'fly', 1, 'rb', '12-15', 60, 'machine', '');
  X('reverse-grip-db-press', 'Reverse-Grip Dumbbell Bench Press', 'chest', 'front-delts triceps', 'db bench', 'c', 'incline-push', 2, 'r', '8-12', 90, 'db', 'upper-chest reverse-grip-press');

  /* ───────────── BACK ───────────── */
  X('pullup', 'Pull-Up', 'lats', 'biceps upper-back forearms', 'bar', 'c', 'v-pull', 2, 'hrb', '5-10', 120, 'bwl', 'staple', { cue: 'Full hang to chin over bar. Add load with a dumbbell between your feet once you own 3×10.' });
  X('chinup', 'Chin-Up', 'lats', 'biceps upper-back', 'bar', 'c', 'v-pull', 2, 'hrb', '5-10', 120, 'bwl', '');
  X('neutral-pullup', 'Neutral-Grip Pull-Up', 'lats', 'biceps upper-back forearms', 'bar', 'c', 'v-pull', 2, 'hrb', '5-10', 120, 'bwl', '');
  X('pullup-negative', 'Pull-Up Negatives (Slow Eccentric)', 'lats', 'biceps forearms', 'bar', 'c', 'v-pull', 1, 'r', '3-6', 90, 'bw', '', { cue: 'Jump or step to the top, lower yourself over 4–5 seconds. Builds strength toward more full pull-ups.', harder: 'pullup' });
  X('lat-pulldown', 'Lat Pulldown', 'lats', 'biceps upper-back', 'lat', 'c', 'v-pull', 1, 'hrb', '8-12', 90, 'cable', 'staple');
  X('close-grip-pulldown', 'Close-Grip Lat Pulldown', 'lats', 'biceps upper-back', 'lat', 'c', 'v-pull', 1, 'hrb', '8-12', 90, 'cable', '');
  X('wide-grip-pulldown', 'Wide-Grip Lat Pulldown', 'lats', 'upper-back biceps', 'lat', 'c', 'v-pull', 1, 'hr', '8-12', 90, 'cable', '');
  X('single-arm-pulldown', 'Single-Arm Lat Pulldown', 'lats', 'biceps', 'cable', 'c', 'v-pull', 2, 'rb', '10-12', 60, 'cable', '');
  X('straight-arm-pulldown', 'Straight-Arm Pulldown', 'lats', 'triceps abs', 'cable', 'i', 'pullover', 1, 'rb', '12-15', 60, 'cable', '');
  X('seated-cable-row', 'Seated Cable Row', 'upper-back', 'lats biceps rear-delts', 'row', 'c', 'h-pull', 1, 'hrb', '8-12', 90, 'cable', 'staple');
  X('wide-cable-row', 'Wide-Grip Seated Cable Row', 'upper-back', 'rear-delts lats', 'row', 'c', 'h-pull', 1, 'hr', '10-12', 90, 'cable', '');
  X('single-arm-cable-row', 'Single-Arm Cable Row', 'lats', 'upper-back biceps', 'cable', 'c', 'h-pull', 1, 'rb', '10-12', 60, 'cable', '');
  X('db-row', 'One-Arm Dumbbell Row', 'lats', 'upper-back biceps rear-delts', 'db bench', 'c', 'h-pull', 1, 'hr', '8-12', 90, 'db', 'staple');
  X('chest-supported-row', 'Chest-Supported Dumbbell Row', 'upper-back', 'rear-delts lats biceps', 'db bench', 'c', 'h-pull', 1, 'hrb', '8-12', 90, 'db', '', { cue: 'Lie face-down on an incline bench — zero lower-back load.' });
  X('db-bent-row', 'Bent-Over Dumbbell Row', 'upper-back', 'lats biceps lower-back', 'db', 'c', 'h-pull', 2, 'hr', '8-12', 90, 'db', 'spinal-load');
  X('kroc-row', 'Kroc Row (High-Rep DB Row)', 'lats', 'upper-back forearms biceps', 'db bench', 'c', 'h-pull', 2, 'b', '15-20', 90, 'db', '');
  X('renegade-row', 'Renegade Row', 'upper-back', 'abs lats obliques', 'db', 'c', 'h-pull', 3, 'r', '6-10', 75, 'db', '');
  X('inverted-row', 'Inverted Row', 'upper-back', 'lats biceps rear-delts', 'rings', 'c', 'h-pull', 1, 'rb', '8-15', 60, 'bw', '');
  X('db-shrug', 'Dumbbell Shrug', 'traps', 'forearms', 'db', 'i', 'shrug', 1, 'hrb', '10-15', 60, 'db', '');
  X('cable-shrug', 'Cable Shrug', 'traps', 'forearms', 'cable', 'i', 'shrug', 1, 'rb', '12-15', 60, 'cable', '');
  X('bb-row', 'Barbell Row', 'upper-back', 'lats biceps lower-back', 'bb', 'c', 'h-pull', 2, 'hr', '6-10', 120, 'bb', 'spinal-load');
  X('deadlift', 'Conventional Deadlift', 'hamstrings', 'glutes lower-back upper-back forearms', 'bb', 'c', 'hinge', 2, 'hr', '3-6', 180, 'bb', 'deadlift spinal-load');
  X('romanian-deadlift', 'Romanian Deadlift (Barbell)', 'hamstrings', 'glutes lower-back', 'bb', 'c', 'hinge', 2, 'hr', '6-10', 150, 'bb', 'rdl spinal-load');
  X('db-rdl', 'Dumbbell Romanian Deadlift', 'hamstrings', 'glutes lower-back', 'db', 'c', 'hinge', 1, 'hr', '8-12', 120, 'db', 'rdl spinal-load');
  X('single-leg-rdl', 'Single-Leg Dumbbell RDL', 'hamstrings', 'glutes lower-back', 'db', 'c', 'hinge', 2, 'r', '8-12', 75, 'db', 'rdl');
  X('back-extension', 'Back Extension', 'lower-back', 'glutes hamstrings', 'machine', 'i', 'hinge', 1, 'r', '12-15', 60, 'bwl', 'spinal-load');
  X('superman-hold', 'Superman Hold', 'lower-back', 'glutes', 'bw', 'i', 'anti-ext', 1, 'rb', '20-40', 45, 'time', '');
  X('bird-dog', 'Bird Dog', 'lower-back', 'abs glutes', 'bw', 'i', 'anti-rot', 1, 'r', '8-12', 45, 'bw', 'back-friendly');

  /* ───────────── SHOULDERS ───────────── */
  X('db-shoulder-press', 'Seated Dumbbell Shoulder Press', 'front-delts', 'side-delts triceps', 'db bench', 'c', 'v-push', 1, 'hr', '6-10', 120, 'db', 'staple');
  X('standing-db-press', 'Standing Dumbbell Press', 'front-delts', 'side-delts triceps abs', 'db', 'c', 'v-push', 2, 'hr', '6-10', 120, 'db', '');
  X('arnold-press', 'Arnold Press', 'front-delts', 'side-delts triceps', 'db bench', 'c', 'v-push', 2, 'r', '8-12', 90, 'db', '');
  X('single-arm-cable-press', 'Half-Kneeling Single-Arm Cable Press', 'front-delts', 'triceps abs obliques', 'cable', 'c', 'v-push', 2, 'r', '10-12', 60, 'cable', '');
  X('pike-pushup', 'Pike Push-Up', 'front-delts', 'triceps side-delts', 'bw', 'c', 'v-push', 2, 'rb', '8-12', 75, 'bw', '', { harder: 'handstand-pushup' });
  X('handstand-pushup', 'Wall Handstand Push-Up', 'front-delts', 'triceps side-delts', 'bw wall', 'c', 'v-push', 3, 'hr', '3-8', 120, 'bw', '');
  X('machine-shoulder-press', 'Machine Shoulder Press', 'front-delts', 'side-delts triceps', 'machine', 'c', 'v-push', 1, 'hrb', '8-12', 90, 'machine', '');
  X('db-lateral-raise', 'Dumbbell Lateral Raise', 'side-delts', 'traps', 'db', 'i', 'lateral', 1, 'rb', '12-15', 60, 'db', 'staple');
  X('cable-lateral-raise', 'Cable Lateral Raise', 'side-delts', 'traps', 'cable', 'i', 'lateral', 1, 'rb', '12-15', 60, 'cable', '');
  X('lean-away-lateral', 'Lean-Away Lateral Raise', 'side-delts', '', 'db', 'i', 'lateral', 2, 'rb', '10-15', 60, 'db', '');
  X('seated-lateral-raise', 'Seated Dumbbell Lateral Raise', 'side-delts', 'traps', 'db bench', 'i', 'lateral', 1, 'rb', '12-15', 60, 'db', '');
  X('db-upright-row', 'Dumbbell Upright Row', 'side-delts', 'traps front-delts', 'db', 'c', 'upright', 2, 'r', '10-12', 75, 'db', '');
  X('cable-upright-row', 'Cable Upright Row', 'side-delts', 'traps', 'cable', 'c', 'upright', 2, 'rb', '10-15', 60, 'cable', '');
  X('db-front-raise', 'Dumbbell Front Raise', 'front-delts', 'side-delts', 'db', 'i', 'front-raise', 1, 'rb', '10-15', 60, 'db', '');
  X('cable-front-raise', 'Cable Front Raise', 'front-delts', '', 'cable', 'i', 'front-raise', 1, 'rb', '12-15', 60, 'cable', '');
  X('mb-front-raise', 'Medicine Ball Front Raise', 'front-delts', 'side-delts', 'mb', 'i', 'front-raise', 1, 'b', '15-20', 45, 'mb', '');
  X('db-rear-delt-fly', 'Bent-Over Rear Delt Fly', 'rear-delts', 'upper-back', 'db', 'i', 'rear-fly', 1, 'rb', '12-15', 60, 'db', '');
  X('incline-rear-delt-fly', 'Chest-Supported Rear Delt Fly', 'rear-delts', 'upper-back', 'db bench', 'i', 'rear-fly', 1, 'rb', '12-15', 60, 'db', '');
  X('cable-reverse-fly', 'Cable Reverse Fly', 'rear-delts', 'upper-back', 'cable', 'i', 'rear-fly', 1, 'rb', '12-15', 60, 'cable', '');
  X('face-pull', 'Cable Face Pull', 'rear-delts', 'upper-back traps', 'cable', 'i', 'rear-fly', 1, 'rb', '12-15', 60, 'cable', 'shoulder-health');
  X('incline-y-raise', 'Incline Y-Raise', 'rear-delts', 'traps side-delts', 'db bench', 'i', 'rear-fly', 2, 'r', '10-15', 60, 'db', 'shoulder-health');

  /* ───────────── BICEPS ───────────── */
  X('db-curl', 'Dumbbell Biceps Curl', 'biceps', 'forearms', 'db', 'i', 'curl', 1, 'hrb', '8-12', 60, 'db', 'staple');
  X('alt-db-curl', 'Alternating Dumbbell Curl', 'biceps', 'forearms', 'db', 'i', 'curl', 1, 'rb', '8-12', 60, 'db', '');
  X('hammer-curl', 'Hammer Curl', 'biceps', 'forearms', 'db', 'i', 'hammer-curl', 1, 'hrb', '8-12', 60, 'db', 'arm-size', { cue: 'Neutral grip builds the brachialis — it pushes the biceps up and makes the whole arm look thicker.' });
  X('cross-body-hammer', 'Cross-Body Hammer Curl', 'biceps', 'forearms', 'db', 'i', 'hammer-curl', 1, 'rb', '8-12', 60, 'db', 'arm-size');
  X('cable-rope-hammer', 'Cable Rope Hammer Curl', 'biceps', 'forearms', 'cable', 'i', 'hammer-curl', 1, 'rb', '10-15', 60, 'cable', 'arm-size');
  X('incline-db-curl', 'Incline Dumbbell Curl', 'biceps', '', 'db bench', 'i', 'stretch-curl', 2, 'r', '8-12', 60, 'db', '');
  X('bayesian-curl', 'Bayesian Cable Curl', 'biceps', '', 'cable', 'i', 'stretch-curl', 2, 'rb', '10-12', 60, 'cable', '');
  X('concentration-curl', 'Concentration Curl', 'biceps', '', 'db bench', 'i', 'peak-curl', 1, 'rb', '10-12', 45, 'db', '');
  X('db-preacher-curl', 'Dumbbell Preacher Curl (Incline Bench)', 'biceps', '', 'db bench', 'i', 'peak-curl', 1, 'hr', '8-12', 60, 'db', '');
  X('spider-curl', 'Spider Curl', 'biceps', '', 'db bench', 'i', 'peak-curl', 2, 'rb', '10-12', 60, 'db', '');
  X('cable-curl', 'Cable Biceps Curl', 'biceps', 'forearms', 'cable', 'i', 'curl', 1, 'hrb', '10-12', 60, 'cable', '');
  X('high-cable-curl', 'High Cable Curl', 'biceps', '', 'cable', 'i', 'peak-curl', 2, 'rb', '12-15', 45, 'cable', '');
  X('zottman-curl', 'Zottman Curl', 'biceps', 'forearms', 'db', 'i', 'hammer-curl', 2, 'r', '8-12', 60, 'db', '');
  X('chinup-iso-hold', 'Chin-Up Top Hold', 'biceps', 'lats forearms', 'bar', 'i', 'curl', 2, 'b', '15-30', 60, 'time', '');
  X('bb-curl', 'Barbell Curl', 'biceps', 'forearms', 'bb', 'i', 'curl', 1, 'hr', '6-10', 75, 'bb', '');
  X('ez-bar-curl', 'EZ-Bar Curl', 'biceps', 'forearms', 'ez', 'i', 'curl', 1, 'hr', '8-12', 75, 'bb', 'ez-bar');

  /* ───────────── TRICEPS ───────────── */
  X('cable-pushdown', 'Cable Triceps Pushdown', 'triceps', '', 'cable', 'i', 'pushdown', 1, 'hrb', '10-12', 60, 'cable', 'staple');
  X('rope-pushdown', 'Rope Pushdown', 'triceps', '', 'cable', 'i', 'pushdown', 1, 'rb', '12-15', 60, 'cable', '');
  X('single-arm-pushdown', 'Single-Arm Cable Pushdown', 'triceps', '', 'cable', 'i', 'pushdown', 1, 'rb', '12-15', 45, 'cable', '');
  X('overhead-cable-ext', 'Overhead Cable Triceps Extension', 'triceps', '', 'cable', 'i', 'tri-overhead', 1, 'hrb', '10-12', 60, 'cable', 'arm-size', { cue: 'Overhead work trains the long head — the biggest part of the triceps.' });
  X('db-overhead-ext', 'Overhead Dumbbell Triceps Extension', 'triceps', '', 'db', 'i', 'tri-overhead', 1, 'hr', '8-12', 60, 'db', 'arm-size');
  X('db-skullcrusher', 'Dumbbell Skull Crusher', 'triceps', '', 'db bench', 'i', 'tri-ext', 2, 'hr', '8-12', 75, 'db', '');
  X('db-kickback', 'Dumbbell Kickback', 'triceps', '', 'db', 'i', 'tri-ext', 1, 'rb', '12-15', 45, 'db', '');
  X('cable-kickback', 'Cable Triceps Kickback', 'triceps', '', 'cable', 'i', 'tri-ext', 1, 'rb', '12-15', 45, 'cable', '');
  X('tate-press', 'Tate Press', 'triceps', 'chest', 'db bench', 'i', 'tri-ext', 2, 'r', '10-12', 60, 'db', '');
  X('close-grip-db-press', 'Close-Grip Dumbbell Press (Neutral Grip)', 'triceps', 'chest front-delts', 'db bench', 'c', 'tri-press', 1, 'hr', '6-10', 90, 'db', '', { cue: 'Palms facing each other, dumbbells touching, elbows tucked.' });
  X('diamond-pushup', 'Diamond Push-Up', 'triceps', 'chest front-delts', 'bw', 'c', 'tri-press', 2, 'rb', '8-15', 60, 'bwl', '');
  X('bench-dip', 'Bench Dip', 'triceps', 'front-delts chest', 'bw bench', 'c', 'tri-press', 1, 'rb', '12-20', 60, 'bwl', '');
  X('triceps-dip', 'Triceps Dip (Parallel Bars)', 'triceps', 'chest front-delts', 'dip', 'c', 'tri-press', 2, 'hrb', '6-12', 90, 'bwl', '');
  X('ez-skullcrusher', 'EZ-Bar Skull Crusher', 'triceps', '', 'ez bench', 'i', 'tri-ext', 2, 'hr', '8-12', 75, 'bb', 'ez-bar');
  X('cg-bench-press', 'Close-Grip Barbell Bench Press', 'triceps', 'chest front-delts', 'bb bench', 'c', 'tri-press', 2, 'hr', '5-8', 120, 'bb', '');

  /* ───────────── FOREARMS ───────────── */
  X('db-wrist-curl', 'Dumbbell Wrist Curl', 'forearms', '', 'db bench', 'i', 'wrist', 1, 'rb', '12-20', 45, 'db', '');
  X('reverse-wrist-curl', 'Reverse Wrist Curl', 'forearms', '', 'db bench', 'i', 'wrist', 1, 'rb', '12-20', 45, 'db', '');
  X('db-reverse-curl', 'Dumbbell Reverse Curl', 'forearms', 'biceps', 'db', 'i', 'wrist', 1, 'rb', '10-15', 45, 'db', '');
  X('farmers-carry', "Farmer's Carry", 'forearms', 'traps abs glutes', 'db', 'c', 'carry', 1, 'rh', '30-45', 75, 'db', '', { unit: 'sec' });
  X('dead-hang', 'Dead Hang', 'forearms', 'lats', 'bar', 'i', 'carry', 1, 'rb', '30-60', 60, 'time', 'pullup-carryover');

  /* ───────────── LEGS ───────────── */
  X('goblet-squat', 'Goblet Squat', 'quads', 'glutes adductors abs', 'db', 'c', 'squat', 1, 'hrb', '8-12', 120, 'db', 'staple');
  X('heel-elevated-goblet', 'Heels-Elevated Goblet Squat', 'quads', 'glutes', 'db', 'c', 'squat', 1, 'rb', '10-15', 90, 'db', '');
  X('db-front-squat', 'Dumbbell Front Squat', 'quads', 'glutes abs', 'db', 'c', 'squat', 2, 'hr', '6-10', 120, 'db', '');
  X('db-squat', 'Dumbbell Squat (Weights at Sides)', 'quads', 'glutes adductors', 'db', 'c', 'squat', 1, 'hr', '8-12', 120, 'db', '');
  X('db-sumo-squat', 'Dumbbell Sumo Squat', 'quads', 'adductors glutes', 'db', 'c', 'squat', 1, 'r', '10-12', 90, 'db', '');
  X('bulgarian-split-squat', 'Bulgarian Split Squat', 'quads', 'glutes adductors', 'db bench', 'c', 'lunge', 2, 'hr', '8-10', 90, 'db', 'staple');
  X('db-reverse-lunge', 'Dumbbell Reverse Lunge', 'quads', 'glutes hamstrings', 'db', 'c', 'lunge', 1, 'rb', '8-12', 75, 'db', '');
  X('db-walking-lunge', 'Dumbbell Walking Lunge', 'quads', 'glutes hamstrings', 'db', 'c', 'lunge', 1, 'rb', '10-14', 75, 'db', '');
  X('db-step-up', 'Dumbbell Step-Up', 'quads', 'glutes', 'db bench', 'c', 'lunge', 1, 'r', '8-12', 75, 'db', '');
  X('lateral-lunge', 'Dumbbell Lateral Lunge', 'adductors', 'quads glutes', 'db', 'c', 'lunge', 2, 'r', '8-12', 75, 'db', '');
  X('cossack-squat', 'Cossack Squat', 'adductors', 'quads glutes', 'bw', 'c', 'lunge', 3, 'r', '6-10', 60, 'bwl', '');
  X('sissy-squat', 'Sissy Squat', 'quads', 'abs', 'bw', 'i', 'knee-ext', 2, 'rb', '10-15', 60, 'bwl', '', { cue: 'Rise on your toes, drive knees forward and lean back in a straight line from knees to head. Hold a dumbbell to the chest to progress.' });
  X('wall-sit', 'Wall Sit', 'quads', 'glutes', 'bw wall', 'i', 'knee-ext', 1, 'b', '45-90', 45, 'time', '');
  X('jump-squat', 'Jump Squat', 'quads', 'glutes calves', 'bw', 'c', 'plyo', 1, 'rb', '10-15', 60, 'bw', 'conditioning');
  X('db-hip-thrust', 'Dumbbell Hip Thrust', 'glutes', 'hamstrings', 'db bench', 'c', 'hinge', 1, 'hr', '8-12', 90, 'db', 'back-friendly');
  X('glute-bridge', 'Glute Bridge', 'glutes', 'hamstrings', 'bw', 'i', 'hinge', 1, 'rb', '12-20', 45, 'bwl', 'back-friendly');
  X('single-leg-glute-bridge', 'Single-Leg Glute Bridge', 'glutes', 'hamstrings', 'bw', 'i', 'hinge', 1, 'rb', '10-15', 45, 'bw', 'back-friendly');
  X('cable-pull-through', 'Cable Pull-Through', 'glutes', 'hamstrings', 'cable', 'c', 'hinge', 1, 'r', '12-15', 60, 'cable', 'back-friendly', { cue: 'Rope between the legs, hinge at the hips and squeeze the glutes to stand. Light spinal load.' });
  X('db-leg-curl', 'Lying Dumbbell Leg Curl', 'hamstrings', 'calves', 'db bench', 'i', 'knee-flexion', 2, 'r', '10-12', 60, 'db', '');
  X('slider-leg-curl', 'Slider Hamstring Curl', 'hamstrings', 'glutes', 'bw towel', 'i', 'knee-flexion', 2, 'rb', '8-15', 60, 'bw', 'back-friendly', { cue: 'Heels on towels/sliders on a smooth floor, bridge up and curl heels toward your glutes.' });
  X('nordic-curl', 'Nordic Hamstring Curl', 'hamstrings', 'glutes', 'bw anchor', 'i', 'knee-flexion', 3, 'r', '3-6', 90, 'bw', '');
  X('db-calf-raise', 'Standing Dumbbell Calf Raise', 'calves', '', 'db', 'i', 'calf', 1, 'rb', '12-20', 45, 'db', '');
  X('single-leg-calf-raise', 'Single-Leg Calf Raise', 'calves', '', 'bw', 'i', 'calf', 1, 'rb', '10-20', 45, 'bwl', '');
  X('seated-db-calf-raise', 'Seated Dumbbell Calf Raise', 'calves', '', 'db bench', 'i', 'calf', 1, 'rb', '15-20', 45, 'db', '');
  X('copenhagen-plank', 'Copenhagen Plank', 'adductors', 'obliques', 'bench', 'i', 'lateral-flex', 3, 'r', '15-30', 45, 'time', '');
  X('cable-glute-kickback', 'Cable Glute Kickback', 'glutes', 'hamstrings', 'cable ankle', 'i', 'hinge', 1, 'rb', '12-15', 45, 'cable', 'leg-attachment');
  X('cable-leg-curl', 'Standing Cable Leg Curl', 'hamstrings', '', 'cable ankle', 'i', 'knee-flexion', 1, 'rb', '12-15', 45, 'cable', 'leg-attachment');
  X('cable-hip-adduction', 'Cable Hip Adduction', 'adductors', '', 'cable ankle', 'i', 'adduction', 1, 'r', '12-15', 45, 'cable', 'leg-attachment');
  X('bb-back-squat', 'Barbell Back Squat', 'quads', 'glutes adductors lower-back', 'bb', 'c', 'squat', 2, 'hr', '5-8', 180, 'bb', 'spinal-load');
  X('leg-press', 'Leg Press', 'quads', 'glutes adductors', 'machine', 'c', 'squat', 1, 'hrb', '8-12', 120, 'machine', '');
  X('leg-extension', 'Leg Extension', 'quads', '', 'machine', 'i', 'knee-ext', 1, 'rb', '12-15', 60, 'machine', '');
  X('machine-leg-curl', 'Lying Leg Curl (Machine)', 'hamstrings', '', 'machine', 'i', 'knee-flexion', 1, 'rb', '10-15', 60, 'machine', '');
  X('kb-swing', 'Kettlebell Swing', 'glutes', 'hamstrings lower-back cardio', 'kb', 'c', 'hinge', 2, 'rb', '15-20', 60, 'kb', 'conditioning');

  /* ───────────── CORE ───────────── */
  X('plank', 'Plank', 'abs', 'obliques', 'bw', 'i', 'anti-ext', 1, 'rb', '30-60', 45, 'time', '');
  X('side-plank', 'Side Plank', 'obliques', 'abs', 'bw', 'i', 'lateral-flex', 1, 'rb', '30-45', 45, 'time', 'love-handles');
  X('dead-bug', 'Dead Bug', 'abs', 'obliques', 'bw', 'i', 'anti-ext', 1, 'r', '8-12', 45, 'bw', 'back-friendly');
  X('hollow-hold', 'Hollow Body Hold', 'abs', 'obliques', 'bw', 'i', 'anti-ext', 2, 'rb', '20-40', 45, 'time', '');
  X('ab-wheel', 'Ab Wheel Rollout', 'abs', 'lats obliques', 'abwheel', 'i', 'anti-ext', 3, 'r', '6-12', 60, 'bw', '');
  X('hanging-knee-raise', 'Hanging Knee Raise', 'abs', 'obliques forearms', 'bar', 'i', 'leg-raise', 1, 'rb', '10-15', 60, 'bw', '', { harder: 'hanging-leg-raise' });
  X('hanging-leg-raise', 'Hanging Leg Raise', 'abs', 'obliques forearms', 'bar', 'i', 'leg-raise', 3, 'r', '8-12', 60, 'bw', '');
  X('lying-leg-raise', 'Lying Leg Raise', 'abs', '', 'bw', 'i', 'leg-raise', 1, 'rb', '10-15', 45, 'bw', '');
  X('reverse-crunch', 'Reverse Crunch', 'abs', 'obliques', 'bw', 'i', 'leg-raise', 1, 'rb', '12-20', 45, 'bw', '');
  X('cable-crunch', 'Kneeling Cable Crunch', 'abs', 'obliques', 'cable', 'i', 'flexion', 1, 'hrb', '10-15', 60, 'cable', '');
  X('crunch', 'Crunch', 'abs', '', 'bw', 'i', 'flexion', 1, 'b', '15-25', 30, 'bw', '');
  X('mb-v-up', 'Medicine Ball V-Up', 'abs', 'obliques', 'mb', 'i', 'flexion', 2, 'rb', '10-15', 45, 'mb', '');
  X('cable-woodchop', 'Cable Woodchopper', 'obliques', 'abs', 'cable', 'i', 'rotation', 1, 'r', '10-12', 45, 'cable', 'love-handles');
  X('pallof-press', 'Pallof Press', 'obliques', 'abs', 'cable', 'i', 'anti-rot', 1, 'r', '10-12', 45, 'cable', 'back-friendly');
  X('mb-russian-twist', 'Medicine Ball Russian Twist', 'obliques', 'abs', 'mb', 'i', 'rotation', 1, 'rb', '16-24', 45, 'mb', 'love-handles');
  X('mb-rotational-toss', 'Medicine Ball Rotational Wall Toss', 'obliques', 'abs', 'mb', 'i', 'rotation', 2, 'r', '8-12', 45, 'mb', 'power');
  X('bicycle-crunch', 'Bicycle Crunch', 'obliques', 'abs', 'bw', 'i', 'rotation', 1, 'b', '20-30', 30, 'bw', 'love-handles');
  X('heel-taps', 'Heel Taps', 'obliques', 'abs', 'bw', 'i', 'lateral-flex', 1, 'b', '20-30', 30, 'bw', '');
  X('db-side-bend', 'Dumbbell Side Bend', 'obliques', 'abs', 'db', 'i', 'lateral-flex', 1, 'r', '12-15', 45, 'db', '');
  X('suitcase-carry', 'Suitcase Carry', 'obliques', 'forearms traps', 'db', 'c', 'carry', 1, 'r', '30-45', 60, 'db', '', { unit: 'sec' });
  X('mountain-climber', 'Mountain Climber', 'abs', 'cardio front-delts', 'bw', 'k', 'conditioning', 1, 'b', '20-40', 30, 'bw', 'conditioning');
  X('mb-slam', 'Medicine Ball Slam', 'abs', 'lats front-delts cardio', 'mb', 'k', 'conditioning', 1, 'rb', '10-15', 45, 'mb', 'conditioning');

  /* ───────────── CARDIO / CONDITIONING ───────────── */
  X('outdoor-run', 'Outdoor Run', 'cardio', 'quads hamstrings calves', 'bw', 'k', 'run', 1, 'r', '20-40', 0, 'cardio', 'run', { cue: 'Easy conversational pace for steady runs; log time and distance.' });
  X('interval-run', 'Run Intervals', 'cardio', 'quads hamstrings calves', 'bw', 'k', 'run', 2, 'r', '20-30', 0, 'cardio', 'run', { cue: 'e.g. 5 min warm-up, 6–8 × (1 min hard / 2 min easy), 5 min cool-down.' });
  X('treadmill-run', 'Treadmill Run', 'cardio', 'quads calves', 'treadmill', 'k', 'run', 1, 'r', '20-40', 0, 'cardio', 'run');
  X('incline-walk', 'Incline Treadmill Walk', 'cardio', 'glutes calves', 'treadmill', 'k', 'steady', 1, 'r', '20-40', 0, 'cardio', '');
  X('rowing-machine', 'Rowing Machine', 'cardio', 'upper-back quads', 'rower', 'k', 'steady', 1, 'r', '15-30', 0, 'cardio', '');
  X('stationary-bike', 'Stationary Bike', 'cardio', 'quads', 'bike', 'k', 'steady', 1, 'r', '20-40', 0, 'cardio', '');
  X('jump-rope', 'Jump Rope', 'cardio', 'calves', 'rope', 'k', 'conditioning', 1, 'rb', '60-120', 45, 'time', 'conditioning');
  X('burpee', 'Burpee', 'cardio', 'chest quads front-delts', 'bw', 'k', 'conditioning', 2, 'rb', '10-15', 45, 'bw', 'conditioning');
  X('jumping-jacks', 'Jumping Jacks', 'cardio', 'calves side-delts', 'bw', 'k', 'conditioning', 1, 'rb', '45-60', 30, 'time', 'conditioning');
  X('high-knees', 'High Knees', 'cardio', 'quads abs', 'bw', 'k', 'conditioning', 1, 'rb', '30-45', 30, 'time', 'conditioning');
  X('skater-jumps', 'Skater Jumps', 'cardio', 'glutes quads', 'bw', 'k', 'conditioning', 2, 'rb', '16-24', 45, 'bw', 'conditioning');
  X('bear-crawl', 'Bear Crawl', 'cardio', 'abs front-delts quads', 'bw', 'k', 'conditioning', 1, 'r', '30-45', 45, 'time', 'conditioning');
  X('db-thruster', 'Dumbbell Thruster', 'quads', 'front-delts glutes triceps cardio', 'db', 'k', 'conditioning', 2, 'rb', '10-12', 60, 'db', 'conditioning');
  X('mb-wall-ball', 'Medicine Ball Wall Ball', 'quads', 'front-delts glutes cardio', 'mb', 'k', 'conditioning', 1, 'rb', '12-20', 45, 'mb', 'conditioning');
  X('db-snatch', 'Alternating Dumbbell Snatch', 'cardio', 'glutes front-delts upper-back', 'db', 'k', 'conditioning', 3, 'r', '10-16', 60, 'db', 'conditioning');
  X('squat-thrust', 'Squat Thrust', 'cardio', 'quads abs', 'bw', 'k', 'conditioning', 1, 'rb', '12-20', 45, 'bw', 'conditioning');

  /* ═════════════ ZERO-EQUIPMENT BODYWEIGHT LIBRARY ═════════════
   * Everything in this block needs only your body and the floor: no bar, rings, bands, bench, chair,
   * box, wall, towel or partner. (Exercises elsewhere that need a wall, towel or foot anchor list it as
   * equipment, so "Bodyweight only" never picks them.) Sources consulted: r/bodyweightfitness wiki
   * progressions (push-up, squat, pseudo-planche), GMB and Breaking Muscle (shrimp / pistol ladders),
   * ACE Fitness exercise library (prone Y-T-W series), and coaching write-ups of the Hindu / dive bomber,
   * sphinx and tiger-bend push-ups. Primary muscle = the muscle that limits the set; where the chest is
   * only a helper (pseudo-planche, sphinx, tiger bend) it is listed as secondary, not primary.
   *
   * extra.mods: modifications of the SAME exercise (leverage, range, tempo, hand position) — chosen per
   *             workout item and stored as item.variation. level < 0 easier, > 0 harder; 0 = as written.
   * extra.easier / extra.harder: a DIFFERENT exercise one step down / up the progression.
   */
  const M = (id, name, level, cue, o) => Object.assign({ id, name, level, cue }, o || {});
  const KNUCKLE = M('knuckles', 'On knuckles', 0, 'Make fists and press through the flat front of the knuckles so the wrists stay straight — the wrist-friendly way to push.', { wrist: true });
  const ECC = (n) => M('eccentric', 'Slow negatives', -1, `Lower over 4–5 seconds, then reset (knees down or step up) instead of pressing — builds strength toward full ${n}.`);
  const KNEE = M('knees', 'From the knees', -2, 'Knees on the floor, body in one line from knees to head. Same hand position and depth.');
  const HALF = M('partial', 'Reduced range', -1, 'Lower only halfway, under control. Add depth as you get stronger.');

  /* ── Chest (chest is the primary mover) ── */
  X('close-grip-pushup', 'Close-Grip Push-Up', 'chest', 'triceps front-delts abs', 'bw', 'c', 'h-push', 1, 'rb', '8-15', 60, 'bw', '', {
    cue: 'Hands just inside shoulder width, elbows tucked about 20–30° to the body. Chest to an inch off the floor, press back to straight arms. A narrow base raises pec and triceps demand versus the standard push-up.',
    easier: 'pushup', harder: 'diamond-pushup', mods: [KNEE, HALF, KNUCKLE] });
  X('staggered-pushup', 'Staggered-Hand Push-Up', 'chest', 'triceps front-delts abs', 'bw', 'c', 'h-push', 2, 'rb', '6-12', 60, 'bw', 'unilateral-bias', {
    cue: 'One hand a forearm-length ahead of the other. The rear arm takes more of the load. Do equal reps, then switch the hands. A floor-only step toward uneven and one-arm push-ups.',
    easier: 'pushup', harder: 'archer-pushup', mods: [KNEE, KNUCKLE] });
  X('typewriter-pushup', 'Typewriter Push-Up', 'chest', 'triceps front-delts abs', 'bw', 'c', 'h-push', 3, 'r', '4-8', 90, 'bw', 'unilateral-bias', {
    cue: 'Very wide hands. Lower to the bottom, then shift your chest across to one hand and back to the other while staying low, then press up. Loads each side of the chest in turn through a lateral shift.',
    easier: 'archer-pushup', harder: 'one-arm-pushup', mods: [M('one-way', 'One shift per rep', -1, 'Shift to one side only each rep and alternate sides, pressing up between shifts.')] });
  X('one-arm-pushup', 'One-Arm Push-Up', 'chest', 'triceps front-delts obliques abs', 'bw', 'c', 'h-push', 3, 'hr', '3-8', 120, 'bw', 'unilateral-bias', {
    cue: 'Feet wide, free hand behind your back, working hand under the chest. Rotate the torso slightly and lower until the chest is a fist from the floor. Keep hips square.',
    easier: 'archer-pushup', mods: [
      M('eccentric', 'Slow negatives', -2, 'Lower on one arm over 5 seconds, then press up on two. The classic bridge to the full one-arm push-up.'),
      M('knees', 'From the knees', -1, 'One-arm push-up from a wide kneeling base; same torso position.'),
      M('wide-stance', 'Extra-wide stance', -1, 'Feet as wide as you can — a wider base removes much of the anti-rotation demand.'),
      M('narrow-stance', 'Feet together', 1, 'Feet together for maximum anti-rotation challenge.') ] });
  X('hindu-pushup', 'Hindu Push-Up', 'chest', 'front-delts triceps lower-back abs', 'bw', 'c', 'swoop', 2, 'rb', '8-15', 60, 'bw', '', {
    cue: 'Start in a pike (hips high, hands and feet wide). Bend the elbows and swoop the chest down and forward close to the floor, through to an upward-dog arch. From there push the hips straight back up to the pike. A chest-and-shoulder press through an arc rather than a straight line.',
    easier: 'pushup', harder: 'dive-bomber-pushup', mods: [M('half', 'Half swoop', -1, 'Swoop down to the bottom only, then walk/push back to the pike without going all the way to the arch.')] });
  X('dive-bomber-pushup', 'Dive Bomber Push-Up', 'chest', 'front-delts triceps lower-back abs', 'bw', 'c', 'swoop', 3, 'r', '6-12', 75, 'bw', '', {
    cue: 'Like a Hindu push-up, but the return reverses the same path: from the arch, bend the elbows and swoop back under, close to the floor, to the pike. Twice the time under load per rep.',
    easier: 'hindu-pushup', mods: [] });
  X('explosive-pushup', 'Explosive Push-Up', 'chest', 'triceps front-delts', 'bw', 'c', 'plyo', 2, 'r', '5-10', 90, 'bw', 'power', {
    cue: 'Lower under control, then press as fast as you can so the hands leave the floor. Land softly with bent elbows and go straight into the next rep. Stop the set when the height drops.',
    easier: 'pushup', harder: 'clap-pushup', mods: [M('kneeling', 'From the knees', -1, 'Explosive push-ups from the knees — the same intent with less load.')] });
  X('clap-pushup', 'Clap Push-Up', 'chest', 'triceps front-delts abs', 'bw', 'c', 'plyo', 3, 'r', '3-8', 120, 'bw', 'power', {
    cue: 'An explosive push-up with enough height to clap once before landing. Land with soft elbows, hands under the shoulders. Quality over quantity — rest fully between sets.',
    easier: 'explosive-pushup', mods: [] });
  X('spiderman-pushup', 'Spiderman Push-Up', 'chest', 'triceps obliques abs front-delts', 'bw', 'c', 'h-push', 2, 'rb', '6-12', 60, 'bw', '', {
    cue: 'As you lower, bring one knee out to the side toward the same elbow. Press up as the leg returns. Alternate sides. Adds hip flexion and anti-rotation to the press.',
    easier: 'pushup', mods: [KNUCKLE] });
  X('t-pushup', 'T Push-Up (Push-Up with Rotation)', 'chest', 'obliques front-delts triceps', 'bw', 'c', 'h-push', 2, 'r', '6-12', 60, 'bw', '', {
    cue: 'Do a push-up; at the top rotate into a side plank with the top arm reaching to the ceiling (a "T"). Return and repeat to the other side.',
    easier: 'pushup', mods: [M('knees', 'From the knees', -1, 'Push-up from the knees, rotate to a kneeling side plank.')] });
  X('palm-press', 'Palm-Press Chest Squeeze', 'chest', 'front-delts', 'bw', 'i', 'fly', 1, 'rb', '20-40', 30, 'time', 'isometric low-load', {
    cue: 'Stand or kneel tall, palms together in front of the chest, elbows up and out. Press the palms into each other as hard as you can and hold. Self-resisted horizontal adduction — the movement a fly trains — with no equipment and no wrist load.',
    mods: [M('pulses', 'Moving squeeze', 0, 'Keep the press on and slowly move the hands forward and back a few inches.'), M('high', 'Hands high', 0, 'Press at eye level to bias the upper chest.'), M('low', 'Hands low', 0, 'Press at belly-button level, arms angled down, to bias the lower chest.')] });

  /* ── Pressing where the chest helps but another muscle leads ── */
  X('pseudo-planche-pushup', 'Pseudo-Planche Push-Up', 'front-delts', 'chest triceps abs', 'bw', 'c', 'h-push', 3, 'r', '5-10', 90, 'bw', 'chest-secondary', {
    cue: 'Hands by the lower ribs, fingers turned out or back, shoulders leaning forward past the hands. Keep the lean and the protracted shoulder blades for every rep. Front delts lead, chest and triceps assist.',
    easier: 'planche-lean', mods: [M('knees', 'From the knees', -2, 'Same lean and hand position from the knees.'), M('small-lean', 'Small lean', -1, 'Hands at the bottom of the ribs with only a slight forward lean.')] });
  X('planche-lean', 'Planche Lean', 'front-delts', 'chest abs', 'bw', 'i', 'v-push', 2, 'rb', '15-30', 60, 'time', 'chest-secondary isometric', {
    cue: 'Push-up position with fingers turned out. Shift the shoulders forward past the hands, arms locked and shoulder blades pushed apart; hold. Lean further to progress.',
    harder: 'pseudo-planche-pushup', mods: [M('knees', 'From the knees', -1, 'Lean from the knees.')] });

  /* ── Back (floor-based) ── */
  X('superman-raise', 'Superman Raise', 'lower-back', 'glutes upper-back', 'bw', 'i', 'back-ext', 1, 'rb', '10-15', 45, 'bw', 'back-friendly', {
    cue: 'Lie face down, arms overhead. Lift arms, chest and legs a few inches, pause 2 seconds, lower. Lead with the upper back; keep the neck long.',
    harder: 'swimmer', mods: [M('arms-only', 'Arms and chest only', -1, 'Leave the legs down — less lower-back load.')] });
  X('swimmer', 'Prone Swimmers', 'lower-back', 'glutes rear-delts upper-back', 'bw', 'i', 'back-ext', 1, 'rb', '20-30', 45, 'bw', '', {
    cue: 'Face down, arms overhead, lift chest and limbs slightly. Flutter opposite arm and leg up and down quickly without touching down. Count each arm.',
    easier: 'superman-raise' });
  X('reverse-snow-angel', 'Reverse Snow Angel', 'upper-back', 'rear-delts traps lower-back', 'bw', 'i', 'rear-fly', 1, 'rb', '10-15', 45, 'bw', 'shoulder-health', {
    cue: 'Face down, arms by your sides with palms down, chest lifted slightly. Keeping the hands off the floor, sweep the arms in a wide arc overhead, then back to the hips. Squeeze the shoulder blades throughout.' });
  X('prone-ytw', 'Prone Y-T-W Raise', 'rear-delts', 'traps upper-back', 'bw', 'i', 'rear-fly', 1, 'rb', '6-10', 45, 'bw', 'shoulder-health', {
    cue: 'Face down, forehead resting on the floor. Lift straight arms into a Y (overhead, thumbs up), lower; then a T (out to the sides); then a W (elbows bent, pull elbows to the ribs). One Y + T + W = 1 rep. Light, strict and slow.' });
  X('prone-floor-pulldown', 'Prone Floor Pulldown', 'lats', 'upper-back rear-delts', 'bw', 'i', 'pullover', 1, 'rb', '10-15', 45, 'bw', 'back-friendly low-load', {
    cue: 'Face down, arms overhead and hovering. Pull the elbows down to your ribs as if doing a pulldown, squeezing the lats and shoulder blades hard for 2 seconds, then reach back overhead without touching down. No pulling against an object — the load is the hold and the squeeze.' });
  X('back-widow', 'Back Widow', 'upper-back', 'rear-delts traps lats', 'bw', 'i', 'h-pull', 2, 'rb', '8-12', 45, 'bw', '', {
    cue: 'Lie on your back, knees bent, elbows bent at your sides on the floor. Drive the elbows down into the floor to lift the upper back off it, squeeze the shoulder blades together, pause, lower. A floor "row" using your own bodyweight.' });
  X('reverse-plank', 'Reverse Plank', 'lower-back', 'glutes hamstrings rear-delts triceps', 'bw', 'i', 'back-ext', 1, 'rb', '20-40', 45, 'time', '', {
    cue: 'Sit with legs straight, hands behind the hips, fingers toward the feet. Lift the hips until the body is a straight line from shoulders to heels; hold. Open the chest.',
    mods: [M('bent-knee', 'Bent-knee (tabletop)', -1, 'Feet flat, knees at 90°: a tabletop bridge.'), M('leg-lift', 'Alternating leg lift', 1, 'Lift one straight leg at a time while holding.')] });

  /* ── Shoulders ── */
  X('dolphin-pushup', 'Dolphin Push-Up', 'front-delts', 'upper-back abs triceps', 'bw', 'c', 'v-push', 1, 'rb', '8-15', 60, 'bw', '', {
    cue: 'Forearm plank, then walk the feet in until the hips are high (forearm pike). Shift the head forward past the hands, then push the hips back up and away. Shoulders flex overhead under load with no wrist strain.',
    harder: 'pike-pushup', mods: [M('knees', 'Knees bent', -1, 'Keep the knees bent and heels high.')] });
  X('pike-shoulder-tap', 'Pike Shoulder Tap', 'front-delts', 'abs triceps', 'bw', 'i', 'v-push', 2, 'rb', '10-20', 45, 'bw', '', {
    cue: 'Pike position, hips high, weight over the hands. Tap one hand to the opposite shoulder, replace, alternate. Supports most of your weight on one overhead-angled arm.',
    easier: 'shoulder-tap', harder: 'freestanding-handstand' });
  X('freestanding-handstand', 'Freestanding Handstand Hold', 'front-delts', 'side-delts triceps abs traps', 'bw', 'i', 'v-push', 3, 'r', '10-30', 90, 'time', 'skill', {
    cue: 'Kick up to a handstand in open space, arms locked, shoulders pushed tall, body in a straight line; balance with the fingers. Learn to cartwheel out first. Accumulate total time if holds are short.',
    easier: 'pike-pushup', harder: 'freestanding-hspu', mods: [M('crow', 'Crow / frog stand', -2, 'Knees on the backs of the upper arms, lean forward until the feet lift; builds balance on the hands.')] });
  X('freestanding-hspu', 'Freestanding Handstand Push-Up', 'front-delts', 'triceps side-delts traps abs', 'bw', 'c', 'v-push', 3, 'h', '1-5', 150, 'bw', 'skill', {
    cue: 'From a balanced freestanding handstand, lower the head toward the floor in a tripod path, then press back to locked arms while holding the balance. An elite skill — use partial range first.',
    easier: 'freestanding-handstand', mods: [M('partial', 'Partial range', -1, 'Lower only a few inches and press back up.'), M('eccentric', 'Slow negatives', -1, 'Lower under control to the head, come down, kick up again.')] });

  /* ── Arms ── */
  X('sphinx-pushup', 'Sphinx Push-Up', 'triceps', 'chest abs front-delts', 'bw', 'i', 'tri-ext', 2, 'rb', '8-15', 60, 'bw', 'chest-secondary', {
    cue: 'Forearm plank with hands a little ahead of the elbows. Press through the palms to straighten the arms, lifting the elbows off the floor, then lower back to the forearms. A bodyweight skull crusher.',
    easier: 'diamond-pushup', harder: 'tiger-bend-pushup', mods: [M('knees', 'From the knees', -1, 'Same movement from the knees.')] });
  X('tiger-bend-pushup', 'Tiger Bend Push-Up', 'triceps', 'chest front-delts abs', 'bw', 'c', 'tri-press', 3, 'r', '4-10', 90, 'bw', 'chest-secondary', {
    cue: 'From a high plank, lower into a push-up and continue down onto the forearms. Press back up to the hands and to the top without letting the hips pike or sag. Move smoothly — no crashing onto the forearms.',
    easier: 'sphinx-pushup', mods: [M('knees', 'From the knees', -1, 'Kneeling tiger bend to learn the hand-to-forearm transition.')] });
  X('floor-dip', 'Floor Dip (Crab Dip)', 'triceps', 'front-delts', 'bw', 'i', 'tri-press', 1, 'rb', '10-20', 45, 'bw', '', {
    cue: 'Sit with knees bent, hands on the floor behind you, fingers toward your hips. Lift the hips, then bend and straighten the elbows. The floor version of a bench dip — no bench or chair.',
    harder: 'diamond-pushup', mods: [M('straight-legs', 'Legs straight', 1, 'Straighten the legs to put more weight on the arms.')] });
  X('self-resisted-curl', 'Self-Resisted Biceps Curl', 'biceps', 'forearms', 'bw', 'i', 'curl', 1, 'r', '8-12', 45, 'bw', 'isometric low-load', {
    cue: 'Curl one arm while the other hand presses down on the wrist, resisting hard through the whole range (about 3 s up, 3 s down). Switch arms. Manual resistance — honest but light compared with weights; push close to failure.',
    mods: [M('iso', 'Isometric holds', 0, 'Hold the elbow at 90° and fight the other hand for 20–30 s per arm.')] });
  X('leg-resisted-curl', 'Leg-Resisted Biceps Curl', 'biceps', 'forearms', 'bw', 'i', 'curl', 1, 'r', '8-12', 45, 'bw', 'low-load', {
    cue: 'Sit on the floor, knee bent. Cup your hand under the same-side thigh just above the knee and curl the leg up toward you using the arm; let the leg relax so it is the load. Resist with the leg to make it harder. Lower slowly.' });

  /* ── Legs ── */
  X('air-squat', 'Bodyweight Squat', 'quads', 'glutes adductors', 'bw', 'c', 'squat', 1, 'rb', '15-25', 60, 'bw', 'staple', {
    cue: 'Feet shoulder-width, toes slightly out. Sit down and back until the hip crease is below the knee, knees tracking over the toes, chest up. Drive up through the whole foot.',
    harder: 'split-squat', mods: [
      M('partial', 'Partial range', -1, 'Squat only to a depth you control (a half squat). Add depth gradually — the assistance-free beginner progression.'),
      M('tempo', 'Tempo 3-1-1', 1, 'Three seconds down, one-second pause at the bottom, up in one second.'),
      M('pause', 'Bottom pause', 1, 'Hold the bottom position 3 seconds each rep.'),
      M('prisoner', 'Prisoner (hands behind head)', 0, 'Hands behind the head, elbows wide — trains upper-back posture.') ] });
  X('split-squat', 'Split Squat', 'quads', 'glutes adductors', 'bw', 'c', 'lunge', 1, 'rb', '8-15', 60, 'bw', '', {
    cue: 'Long staggered stance, back heel up. Lower straight down until the back knee nearly touches the floor, front shin roughly vertical. Do all reps on one side, then switch. The no-bench alternative to a Bulgarian split squat.',
    easier: 'air-squat', harder: 'shrimp-squat', mods: [M('partial', 'Reduced range', -1, 'Lower only halfway.'), M('one-and-half', '1½ reps', 1, 'Down, halfway up, back down, then all the way up = one rep. Mimics the Bulgarian split squat’s time in the deep range.'), M('front-foot-heavy', 'Front-foot bias', 1, 'Lean forward slightly and push mainly through the front foot; the back foot only balances.')] });
  X('reverse-lunge', 'Reverse Lunge', 'quads', 'glutes hamstrings', 'bw', 'c', 'lunge', 1, 'rb', '10-15', 60, 'bw', 'knee-friendly', {
    cue: 'Step one foot back, lower until both knees are at about 90°, then drive through the front foot to return. Easier on the knees than forward lunges.',
    harder: 'walking-lunge', mods: [M('partial', 'Reduced range', -1, 'Short step and shallow depth.'), M('deficit-free-pause', 'Paused', 1, 'Pause 2 s with the back knee just off the floor.')] });
  X('forward-lunge', 'Forward Lunge', 'quads', 'glutes hamstrings adductors', 'bw', 'c', 'lunge', 1, 'rb', '10-15', 60, 'bw', '', {
    cue: 'Step forward, lower until the back knee nearly touches, then push off the front foot back to standing. Decelerating the step makes it more quad- and knee-demanding than the reverse lunge.',
    easier: 'reverse-lunge', harder: 'walking-lunge' });
  X('walking-lunge', 'Walking Lunge', 'quads', 'glutes hamstrings adductors', 'bw', 'c', 'lunge', 1, 'rb', '16-24', 60, 'bw', '', {
    cue: 'Lunge forward and step straight through into the next lunge with the other leg. Keep the torso tall. Count each leg.',
    easier: 'reverse-lunge', harder: 'jump-lunge' });
  X('curtsy-lunge', 'Curtsy Lunge', 'glutes', 'quads adductors', 'bw', 'c', 'lunge', 1, 'rb', '10-15', 60, 'bw', '', {
    cue: 'Step one leg diagonally behind the other, as in a curtsy, and lower with the hips square. Biases the glute medius of the front leg.' });
  X('jump-lunge', 'Jump Lunge', 'quads', 'glutes calves hamstrings', 'bw', 'c', 'plyo', 2, 'rb', '12-20', 60, 'bw', 'conditioning', {
    cue: 'From a lunge, jump and switch legs in the air, landing softly in a lunge on the other side. Count each landing.',
    easier: 'walking-lunge', mods: [M('step-switch', 'Step switch (no jump)', -1, 'Same pattern, stepping instead of jumping — no impact.')] });
  X('shrimp-squat', 'Shrimp Squat', 'quads', 'glutes', 'bw', 'c', 'lunge', 3, 'r', '4-10', 90, 'bw', 'single-leg', {
    cue: 'Stand on one leg, bend the other knee so the foot is behind you. Squat down until the back knee touches the floor, then stand up. Lean forward for balance. A quad-dominant single-leg squat that needs less hip mobility than a pistol.',
    easier: 'split-squat', harder: 'pistol-squat', mods: [
      M('beginner', 'Beginner (knee and toes down)', -1, 'Let the back knee and toes touch together; arms forward as a counterweight.'),
      M('advanced', 'Hold the back foot', 1, 'Hold the back foot with the same-side hand; only the knee touches.') ] });
  X('pistol-squat', 'Pistol Squat', 'quads', 'glutes adductors abs', 'bw', 'c', 'lunge', 3, 'hr', '3-8', 120, 'bw', 'single-leg', {
    cue: 'Stand on one leg with the other straight in front. Squat all the way down on the standing leg, heel down, then stand without touching the free foot down. Arms forward as a counterweight.',
    easier: 'shrimp-squat', mods: [
      M('partial', 'Partial single-leg squat', -2, 'Single-leg squat to a depth you control, free leg forward. Go a little deeper each week.'),
      M('eccentric', 'Pistol negatives', -1, 'Lower on one leg over 5 seconds, sit down, then stand on two legs. Progress when 3–5 controlled 10-second negatives feel easy.'),
      M('rolling', 'Rolling pistol', -1, 'Lower, roll back onto the back, then roll forward to use momentum to stand on one leg.'),
      M('slow', 'Slow and paused', 1, 'Three seconds down, pause at the bottom.') ] });
  X('calf-raise', 'Calf Raise', 'calves', '', 'bw', 'i', 'calf', 1, 'rb', '15-25', 45, 'bw', '', {
    cue: 'Feet hip-width on the floor. Rise as high as possible onto the balls of the feet, pause 1 s, lower slowly until the heels touch.',
    harder: 'single-leg-calf-raise', mods: [M('pause', 'Top pause', 1, 'Hold 2 s at the top, 3 s down.'), M('bent-knee', 'Bent-knee', 0, 'Knees slightly bent to shift work toward the soleus.')] });
  X('frog-pump', 'Frog Pump', 'glutes', 'adductors', 'bw', 'i', 'hinge', 1, 'rb', '20-30', 45, 'bw', 'back-friendly', {
    cue: 'On your back, soles of the feet together and knees open wide, heels close to the hips. Thrust the hips up, squeezing the glutes hard, then lower. Short range, high reps.' });
  X('donkey-kick', 'Donkey Kick', 'glutes', 'hamstrings', 'bw', 'i', 'hinge', 1, 'rb', '12-20', 45, 'bw', 'back-friendly', {
    cue: 'On hands and knees. Keep one knee bent at 90° and drive that foot up toward the ceiling until the thigh is level with the back. Squeeze, lower, repeat; do all reps on one side.',
    mods: [M('forearms', 'On forearms', 0, 'Rest on the forearms instead of the hands — no wrist load.', { wrist: true })] });
  X('side-lying-abduction', 'Side-Lying Hip Abduction', 'glutes', '', 'bw', 'i', 'abduction', 1, 'rb', '15-20', 30, 'bw', 'back-friendly', {
    cue: 'Lie on your side, body straight. Lift the top leg, toes pointing slightly down and heel leading, to about 40°. Lower slowly. Trains the glute medius.' });
  X('side-lying-adduction', 'Side-Lying Hip Adduction', 'adductors', '', 'bw', 'i', 'adduction', 1, 'rb', '15-20', 30, 'bw', '', {
    cue: 'Lie on your side, bottom leg straight, top foot planted in front of the bottom knee. Lift the bottom leg a few inches, squeeze the inner thigh, lower slowly.' });
  X('bridge-walkout', 'Glute Bridge Walkout', 'hamstrings', 'glutes lower-back', 'bw', 'i', 'knee-flexion', 2, 'rb', '6-10', 60, 'bw', '', {
    cue: 'Hold a glute bridge. Walk the heels out in small steps until the legs are nearly straight, keeping the hips up, then walk them back. One out-and-back = 1 rep. Loads the hamstrings as knee flexors without equipment.',
    easier: 'glute-bridge', mods: [M('short', 'Short walkout', -1, 'Walk out only a few steps.')] });
  X('broad-jump', 'Broad Jump', 'quads', 'glutes hamstrings calves', 'bw', 'c', 'plyo', 2, 'r', '5-8', 75, 'bw', 'power', {
    cue: 'Swing the arms and jump forward as far as you can, landing softly on both feet with bent knees. Walk back and reset each rep.' });

  /* ── Core ── */
  X('v-up', 'V-Up', 'abs', 'obliques', 'bw', 'i', 'flexion', 2, 'rb', '10-15', 45, 'bw', '', {
    cue: 'Lie flat, arms overhead. Lift straight legs and torso together to touch the hands to the shins, balancing on the hips, then lower under control.',
    mods: [M('tuck', 'Tuck-ups', -1, 'Bend the knees and pull them to the chest as you sit up.'), M('single-leg', 'Alternating single-leg', -1, 'Reach to one raised leg at a time.')] });
  X('flutter-kick', 'Flutter Kicks', 'abs', 'obliques', 'bw', 'i', 'leg-raise', 1, 'rb', '20-40', 30, 'bw', '', {
    cue: 'On your back, lower back pressed into the floor, legs straight and a few inches up. Kick the legs up and down in small fast alternating movements. Count each leg.',
    harder: 'hollow-hold', mods: [M('high', 'Legs higher', -1, 'Keep the legs higher (45°) to reduce lower-back demand.')] });
  X('windshield-wiper', 'Lying Windshield Wiper', 'obliques', 'abs', 'bw', 'i', 'rotation', 2, 'r', '8-14', 45, 'bw', 'love-handles', {
    cue: 'On your back, arms out in a T, legs raised to vertical. Lower both legs to one side under control without the shoulders lifting, then to the other. Count each side.',
    mods: [M('bent-knee', 'Bent knees', -1, 'Knees bent at 90° to shorten the lever.')] });
  X('hollow-rock', 'Hollow Rock', 'abs', 'obliques', 'bw', 'i', 'anti-ext', 2, 'rb', '15-30', 45, 'bw', '', {
    cue: 'Hold a hollow body position and rock forward and back from shoulder blades to hips, keeping the shape rigid.',
    easier: 'hollow-hold' });
  X('bw-russian-twist', 'Russian Twist (Bodyweight)', 'obliques', 'abs', 'bw', 'i', 'rotation', 1, 'rb', '20-30', 30, 'bw', 'love-handles', {
    cue: 'Sit leaning back about 45°, feet up or down. Rotate the torso and touch the floor beside each hip with clasped hands. Rotate from the ribs, not just the arms.',
    mods: [M('feet-down', 'Feet down', -1, 'Heels stay on the floor.')] });
  X('side-plank-hip-dip', 'Side Plank Hip Dip', 'obliques', 'abs glutes', 'bw', 'i', 'lateral-flex', 1, 'rb', '10-15', 45, 'bw', 'love-handles', {
    cue: 'Forearm side plank. Lower the hip toward the floor, then lift it higher than the start. Do all reps on one side, then switch.',
    easier: 'side-plank', mods: [M('knees', 'From the knees', -1, 'Bottom knee down.')] });
  X('bear-plank', 'Bear Plank Hold', 'abs', 'front-delts quads', 'bw', 'i', 'anti-ext', 1, 'rb', '20-45', 45, 'time', '', {
    cue: 'On hands and toes, knees bent at 90° and hovering an inch off the floor, back flat. Hold and breathe.' });
  X('shoulder-tap', 'Plank Shoulder Tap', 'abs', 'obliques front-delts', 'bw', 'i', 'anti-rot', 1, 'rb', '16-30', 45, 'bw', '', {
    cue: 'High plank, feet a little wider than the hips. Tap one hand to the opposite shoulder without the hips swaying, replace and alternate. Mainly an anti-rotation core exercise; the shoulders work to stabilise.',
    harder: 'pike-shoulder-tap', mods: [M('knees', 'From the knees', -1, 'Kneeling plank taps.'), M('slow', 'Slow 3-second taps', 1, 'Hold each tap for 3 seconds.')] });
  X('floor-l-sit', 'Floor L-Sit', 'abs', 'triceps front-delts', 'bw', 'i', 'anti-ext', 3, 'r', '5-20', 90, 'time', '', {
    cue: 'Sit with legs straight, hands flat beside the hips. Press down to lift hips and legs off the floor, legs straight in an L. Hold.',
    mods: [M('tuck', 'Tuck sit', -2, 'Knees pulled to the chest, feet off the floor.'), M('one-leg', 'One leg extended', -1, 'One leg tucked, one straight.')] });
  X('situp', 'Sit-Up', 'abs', 'obliques', 'bw', 'i', 'flexion', 1, 'rb', '12-25', 45, 'bw', '', {
    cue: 'On your back, knees bent, feet flat. Curl up vertebra by vertebra to sitting, then lower slowly. Arms across the chest; don’t pull on the neck.',
    easier: 'crunch' });

  /* ── Conditioning ── */
  X('tuck-jump', 'Tuck Jump', 'cardio', 'quads glutes calves', 'bw', 'k', 'conditioning', 2, 'rb', '8-15', 45, 'bw', 'conditioning', {
    cue: 'Jump straight up and pull the knees toward the chest, then land softly and rebound.' });
  X('plank-jack', 'Plank Jack', 'cardio', 'abs front-delts', 'bw', 'k', 'conditioning', 1, 'rb', '20-40', 30, 'bw', 'conditioning', {
    cue: 'High plank; jump the feet wide and back together like a jumping jack, keeping the hips level.' });
  X('crab-walk', 'Crab Walk', 'cardio', 'triceps glutes front-delts', 'bw', 'k', 'conditioning', 1, 'r', '20-40', 45, 'time', 'conditioning', {
    cue: 'Sit, hands behind you, lift the hips. Walk forward and back on hands and feet, hips up.' });

  /* ── Instructions, modifications and progressions for the bodyweight exercises defined above ── */
  const PATCH = {
    pushup: { cue: 'Hands slightly wider than the shoulders, body in one straight line. Lower until the chest is a fist from the floor, elbows about 45° from the body, then press to straight arms.', mods: [M('wall', 'Wall push-up', -3, 'Hands on a wall at chest height, step back and press.', { needs: 'wall' }), KNEE, ECC('push-ups'), HALF, KNUCKLE, M('tempo', 'Tempo 3-1-1', 1, 'Three seconds down, one-second pause just above the floor, press up.'), M('paused', 'Bottom pause', 1, 'Pause 2 seconds with the chest just off the floor.')] },
    'wide-pushup': { cue: 'Hands about 1.5× shoulder width, fingers slightly out. Lower with control until the chest is near the floor; the wider base shifts work toward the chest and away from the triceps.', easier: 'pushup', mods: [KNEE, HALF, KNUCKLE] },
    'archer-pushup': { cue: 'Very wide hands. Lower toward one hand while the other arm straightens out to the side, then press back up. Alternate sides. A step toward the one-arm push-up.', easier: 'staggered-pushup', harder: 'one-arm-pushup', mods: [KNEE, M('assisted', 'Bent assisting arm', -1, 'Let the assisting arm bend a little and take more of the load.')] },
    'diamond-pushup': { cue: 'Thumbs and index fingers touching under the chest in a diamond, elbows close to the body. Lower to the hands and press up. Triceps-dominant.', easier: 'close-grip-pushup', harder: 'sphinx-pushup', mods: [KNEE, HALF] },
    'pike-pushup': { cue: 'Hips high, body in an upside-down V, hands shoulder-width. Bend the elbows to lower the top of the head toward a point just ahead of the hands, then press back. An overhead press with bodyweight.', easier: 'dolphin-pushup', harder: 'freestanding-handstand', mods: [M('bent-knee', 'Knees bent', -1, 'Bend the knees to get the hips over the hands more easily.'), M('eccentric', 'Slow negatives', -1, 'Lower over 4 seconds, then come down to the knees and reset.'), M('feet-in', 'Feet walked in', 1, 'Walk the feet closer to the hands so the torso is more vertical.')] },
    plank: { cue: 'Forearms under the shoulders, body in one straight line, ribs down and glutes squeezed. Breathe and hold.', harder: 'hollow-hold', mods: [M('knees', 'From the knees', -1, 'Knees down, same straight line from knees to head.'), M('high', 'High plank (on hands)', 0, 'On straight arms instead of forearms.')] },
    'side-plank': { cue: 'On one forearm, elbow under the shoulder, feet stacked. Lift the hips into a straight line and hold. Switch sides.', harder: 'side-plank-hip-dip', mods: [M('knees', 'From the knees', -1, 'Bottom knee down.'), M('leg-lift', 'Top leg raised', 1, 'Lift the top leg while holding.')] },
    'dead-bug': { cue: 'On your back, arms up, hips and knees at 90°. Lower the opposite arm and leg toward the floor while the lower back stays pressed down, return, alternate.', harder: 'hollow-hold' },
    'hollow-hold': { cue: 'On your back, press the lower back into the floor, lift shoulders and legs, arms overhead, and hold a shallow banana shape.', easier: 'dead-bug', harder: 'hollow-rock', mods: [M('tuck', 'Tuck hollow', -2, 'Knees bent toward the chest, arms by the sides.'), M('arms-down', 'Arms by sides', -1, 'Arms reaching toward the feet shortens the lever.')] },
    'lying-leg-raise': { cue: 'On your back, hands under the hips if needed. Raise straight legs to vertical, then lower slowly without the lower back arching off the floor.', easier: 'reverse-crunch', harder: 'v-up', mods: [M('bent-knee', 'Bent-knee', -1, 'Bend the knees to shorten the lever.')] },
    'reverse-crunch': { cue: 'On your back, knees bent at 90°. Curl the hips off the floor toward the ribs, then lower slowly.', harder: 'lying-leg-raise' },
    crunch: { cue: 'On your back, knees bent. Curl the shoulders off the floor toward the hips, pause, lower. Hands lightly at the temples.', harder: 'situp' },
    'bicycle-crunch': { cue: 'On your back, hands at the temples. Bring one elbow toward the opposite knee as the other leg extends, then switch in a pedalling motion. Count each side.' },
    'heel-taps': { cue: 'On your back, knees bent, shoulders slightly lifted. Reach side to side to tap each heel.' },
    'mountain-climber': { cue: 'High plank. Drive the knees toward the chest one at a time, quickly, keeping the hips level.', mods: [M('slow', 'Slow and controlled', -1, 'Step each knee in and back slowly.'), M('forearms', 'On forearms', 0, 'From a forearm plank — no wrist load.', { wrist: true })] },
    'superman-hold': { cue: 'Face down, arms overhead. Lift arms, chest and legs off the floor and hold, neck long.', easier: 'superman-raise' },
    'bird-dog': { cue: 'On hands and knees, extend the opposite arm and leg until level with the back, pause, return. Keep the hips square.', mods: [M('forearms', 'On forearms', 0, 'Support on the forearm instead of the hand.', { wrist: true })] },
    'glute-bridge': { cue: 'On your back, knees bent, feet flat. Drive through the heels to lift the hips until the body is straight from shoulders to knees, squeeze the glutes, lower.', harder: 'single-leg-glute-bridge', mods: [M('pause', 'Top pause', 1, 'Hold 3 seconds at the top.')] },
    'single-leg-glute-bridge': { cue: 'One foot planted, the other leg straight or knee pulled in. Bridge up through the planted heel, keeping the hips level.', easier: 'glute-bridge', harder: 'bridge-walkout' },
    'single-leg-calf-raise': { cue: 'Stand on one foot on the floor (hold something light for balance if you need it). Rise as high as possible, pause, lower slowly.', easier: 'calf-raise' },
    'jump-squat': { cue: 'Squat to parallel, then jump as high as you can. Land softly through the balls of the feet into the next squat.', easier: 'air-squat', mods: [M('squat-calf', 'Squat to calf raise', -2, 'No jump: stand up fast and rise onto the toes.'), M('small', 'Small hops', -1, 'Quarter-squat depth and low hops.')] },
    'sissy-squat': { mods: [M('partial', 'Partial range', -1, 'Lean back only as far as you control, then return.'), M('slow', 'Slow eccentric', 1, 'Four seconds down.')] },
    'cossack-squat': { cue: 'Very wide stance. Shift into one leg and squat deeply over it while the other leg stays straight with the toes up. Shift across to the other side.', mods: [M('partial', 'Partial depth', -1, 'Go only as deep as your hips allow.')] },
    burpee: { cue: 'Squat, hands down, jump the feet back to a plank, do a push-up, jump the feet in and jump up with arms overhead.', mods: [M('no-pushup', 'No push-up', -1, 'Skip the push-up.'), M('step', 'Step-back (no jump)', -2, 'Step the feet back and in, and stand instead of jumping.')] },
    'squat-thrust': { cue: 'Squat and put your hands down, jump the feet back to a plank, jump them in, stand.' },
    'high-knees': { cue: 'Run in place driving the knees to hip height, pumping the arms.' },
    'jumping-jacks': { cue: 'Jump the feet wide while the arms go overhead, then back together.' },
    'skater-jumps': { cue: 'Leap sideways from one foot to the other, landing softly and swinging the trailing leg behind. Count each landing.' },
    'bear-crawl': { cue: 'On hands and feet, knees an inch off the floor. Crawl forward and back moving opposite hand and foot together, back flat.' },
  };
  list.forEach((ex) => PATCH[ex.id] && Object.assign(ex, PATCH[ex.id]));

  /* ── Joint demands: lets notes such as "push-ups bother my wrists" steer future workouts ──
   * wrist: hands on the floor with the wrist extended (or loaded wrist flexion);  knee: deep or impact
   * knee flexion;  shoulder: overhead, dips, deep stretch;  back: lumbar extension / spinal load;
   * elbow: heavy triceps extension;  neck: curl-ups;  impact: jumping / running.            */
  const JOINTS = {
    wrist: 'pushup incline-pushup decline-pushup wide-pushup archer-pushup mb-pushup diamond-pushup close-grip-pushup staggered-pushup typewriter-pushup one-arm-pushup hindu-pushup dive-bomber-pushup explosive-pushup clap-pushup spiderman-pushup t-pushup pseudo-planche-pushup planche-lean pike-pushup handstand-pushup freestanding-handstand freestanding-hspu pike-shoulder-tap shoulder-tap sphinx-pushup tiger-bend-pushup floor-dip bench-dip reverse-plank floor-l-sit bear-plank mountain-climber bear-crawl burpee squat-thrust plank-jack crab-walk renegade-row db-wrist-curl reverse-wrist-curl donkey-kick bird-dog',
    knee: 'goblet-squat heel-elevated-goblet db-front-squat db-squat db-sumo-squat bulgarian-split-squat db-reverse-lunge db-walking-lunge db-step-up lateral-lunge cossack-squat sissy-squat wall-sit jump-squat bb-back-squat leg-press leg-extension db-thruster mb-wall-ball air-squat split-squat reverse-lunge forward-lunge walking-lunge curtsy-lunge jump-lunge shrimp-squat pistol-squat broad-jump tuck-jump skater-jumps burpee',
    shoulder: 'db-shoulder-press standing-db-press arnold-press machine-shoulder-press pike-pushup handstand-pushup freestanding-handstand freestanding-hspu chest-dip triceps-dip bench-dip floor-dip db-upright-row cable-upright-row pseudo-planche-pushup planche-lean dive-bomber-pushup hindu-pushup clap-pushup one-arm-pushup db-pullover db-fly',
    back: 'superman-hold superman-raise swimmer back-extension kb-swing situp lying-leg-raise flutter-kick v-up mb-v-up hanging-leg-raise windshield-wiper bw-russian-twist mb-russian-twist bb-row db-bent-row bb-back-squat',
    elbow: 'db-skullcrusher ez-skullcrusher db-overhead-ext overhead-cable-ext tate-press diamond-pushup sphinx-pushup tiger-bend-pushup triceps-dip bench-dip floor-dip close-grip-pushup',
    neck: 'crunch situp bicycle-crunch v-up heel-taps mb-v-up',
    impact: 'jump-squat jump-lunge tuck-jump broad-jump burpee skater-jumps jumping-jacks high-knees jump-rope outdoor-run interval-run treadmill-run plank-jack explosive-pushup clap-pushup',
  };
  const byId = Object.fromEntries(list.map((e) => [e.id, e]));
  list.forEach((e) => (e.joints = []));
  Object.entries(JOINTS).forEach(([j, ids]) => ids.split(' ').forEach((id) => byId[id] && byId[id].joints.push(j)));

  /* Movement family: the plain word people use in notes ("push-ups", "lunges", "planks"…). */
  const FAMILIES = [
    ['push-up', /push-up/i], ['pull-up', /pull-up|chin-up/i], ['squat', /squat|pistol/i], ['lunge', /lunge/i], ['plank', /plank/i],
    ['curl', /curl/i], ['row', /\brow\b/i], ['press', /press/i], ['raise', /raise/i], ['fly', /\bfly\b|pec deck/i], ['dip', /\bdip\b/i],
    ['crunch', /crunch|sit-up|v-up/i], ['bridge', /bridge|hip thrust|frog pump/i], ['burpee', /burpee/i], ['jump', /jump|hop/i], ['run', /\brun\b/i],
    ['extension', /extension|skull crusher|kickback|pushdown/i], ['handstand', /handstand/i], ['leg raise', /leg raise|knee raise|flutter/i],
  ];
  list.forEach((e) => (e.families = FAMILIES.filter(([, re]) => re.test(e.name)).map(([f]) => f)));

  WT.BUILTIN_EXERCISES = list;
})();
