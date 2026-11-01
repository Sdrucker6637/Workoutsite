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
 *   intensities: letters of allowed classes — h = heavy, r = regular, b = burnout (first = default)
 *   loadType:    db, cable, machine, bb, mb, kb, bw (bodyweight), bwl (bodyweight, loadable),
 *                time (timed hold), cardio (time + distance)
 */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const list = [];
  function X(id, name, primary, secondary, equipment, category, pattern, difficulty, intensities, reps, rest, load, tags, extra) {
    const [lo, hi] = String(reps).split('-').map(Number);
    const intens = intensities.split('').map((c) => ({ h: 'heavy', r: 'regular', b: 'burnout' }[c]));
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
        intensity: intens.includes('regular') ? 'regular' : intens[0],
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
  X('pushup', 'Push-Up', 'chest', 'triceps front-delts abs', 'bw', 'c', 'h-push', 1, 'rb', '10-20', 60, 'bwl', 'staple', { harder: 'decline-pushup' });
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
  X('handstand-pushup', 'Wall Handstand Push-Up', 'front-delts', 'triceps side-delts', 'bw', 'c', 'v-push', 3, 'hr', '3-8', 120, 'bw', '');
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
  X('wall-sit', 'Wall Sit', 'quads', 'glutes', 'bw', 'i', 'knee-ext', 1, 'b', '45-90', 45, 'time', '');
  X('jump-squat', 'Jump Squat', 'quads', 'glutes calves', 'bw', 'c', 'plyo', 1, 'rb', '10-15', 60, 'bw', 'conditioning');
  X('db-hip-thrust', 'Dumbbell Hip Thrust', 'glutes', 'hamstrings', 'db bench', 'c', 'hinge', 1, 'hr', '8-12', 90, 'db', 'back-friendly');
  X('glute-bridge', 'Glute Bridge', 'glutes', 'hamstrings', 'bw', 'i', 'hinge', 1, 'rb', '12-20', 45, 'bwl', 'back-friendly');
  X('single-leg-glute-bridge', 'Single-Leg Glute Bridge', 'glutes', 'hamstrings', 'bw', 'i', 'hinge', 1, 'rb', '10-15', 45, 'bw', 'back-friendly');
  X('cable-pull-through', 'Cable Pull-Through', 'glutes', 'hamstrings', 'cable', 'c', 'hinge', 1, 'r', '12-15', 60, 'cable', 'back-friendly', { cue: 'Rope between the legs, hinge at the hips and squeeze the glutes to stand. Light spinal load.' });
  X('db-leg-curl', 'Lying Dumbbell Leg Curl', 'hamstrings', 'calves', 'db bench', 'i', 'knee-flexion', 2, 'r', '10-12', 60, 'db', '');
  X('slider-leg-curl', 'Slider Hamstring Curl', 'hamstrings', 'glutes', 'bw', 'i', 'knee-flexion', 2, 'rb', '8-15', 60, 'bw', 'back-friendly', { cue: 'Heels on towels/sliders on a smooth floor, bridge up and curl heels toward your glutes.' });
  X('nordic-curl', 'Nordic Hamstring Curl', 'hamstrings', 'glutes', 'bw', 'i', 'knee-flexion', 3, 'r', '3-6', 90, 'bw', '');
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

  WT.BUILTIN_EXERCISES = list;
})();
