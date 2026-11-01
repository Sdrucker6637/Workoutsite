/* Exercise demonstrations — curated, hand-verified mapping from Forge exercises to openly
 * licensed illustration frames. An exercise is listed only when the frames show that exact movement
 * with the same equipment and body position; everything else falls back to a placeholder.
 * Full attribution and license texts live next to the files in media/<source>/ (see media/README.md).
 *
 *  ek   Everkinetic — Greg Priday & contributors · CC BY-SA 4.0 · SVG start/end pairs
 *  wg   Workout Guide — Bryl Lim · CC BY-SA 4.0 (a few frames adapted from Everkinetic) · 3 WebP frames
 *  oei  Open Exercise Illustrations — Hitman Repo · CC0 1.0 · AI-generated, each frame reviewed · WebP
 */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const SOURCES = {
    ek: {
      name: 'Everkinetic', by: 'Greg Priday & contributors', license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', url: 'https://github.com/everkinetic/data',
      base: 'media/everkinetic/', frames: (id) => [id + '-a.svg', id + '-b.svg'],
    },
    wg: {
      name: 'Workout Guide', by: 'Bryl Lim', license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', url: 'https://github.com/bryllim/workout-guide',
      base: 'media/workout-guide/', frames: (id, n) => Array.from({ length: n }, (_, i) => id + '-' + (i + 1) + '.webp'),
    },
    oei: {
      name: 'Open Exercise Illustrations', by: 'Hitman Repo (AI-generated)', license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', url: 'https://github.com/hitmanrepo/open-exercise-illustrations',
      base: 'media/open-exercise-illustrations/', frames: (id, n) => Array.from({ length: n }, (_, i) => id + '-' + (i + 1) + '.webp'),
    },
  };
  // Workout Guide drawings whose frames are partly adapted from Everkinetic (credited to both).
  const WG_FROM_EK = new Set(['cable-fly', 'inverted-row', 'barbell-row']);
  // exercise id → [source, asset id, frame count]
  const MAP = {
    // ── Everkinetic
    'alt-db-curl': ['ek', '0223', 2], // Alternating Bicep Curl with Dumbbell
    'back-extension': ['ek', '0103', 2], // Hyperextensions
    'bb-back-squat': ['ek', '0122', 2], // Barbell Squat
    'bb-bench-press': ['ek', '0042', 2], // Bench Press: Barbell
    'bb-curl': ['ek', '0211', 2], // Biceps Curl: Barbell
    'bb-incline-press': ['ek', '0043', 2], // Bench Press: Barbell (Incline)
    'bench-dip': ['ek', '0162', 2], // Bench Dips
    'bicycle-crunch': ['ek', '0284', 2], // Air Bike
    'cable-crossover-bench': ['ek', '0057', 2], // Flat Bench Cable Flys
    'cable-curl': ['ek', '0212', 2], // Standing Biceps Curl with Cable
    'cable-fly-high-low': ['ek', '0048', 2], // Cable Crossover
    'cable-front-raise': ['ek', '0008', 2], // Front Cable Raises
    'cable-glute-kickback': ['ek', '0112', 2], // One Legged Cable Kickback
    'cable-hip-adduction': ['ek', '0135', 2], // Hip Adduction
    'cable-pushdown': ['ek', '0205', 2], // Triceps Pushdown: Cable
    'cable-rope-hammer': ['ek', '0216', 2], // Hammer Curls with Rope and Cable
    'cable-shrug': ['ek', '0009', 2], // Shoulder Shrugs: Cable
    'cable-upright-row': ['ek', '0015', 2], // Upright Cable Row
    'chest-dip': ['ek', '0054', 2], // Chest Dips
    'chinup': ['ek', '0090', 2], // Narrow Parallel Grip Chin-ups
    'close-grip-pulldown': ['ek', '0096', 2], // Pull Down: V Bar
    'concentration-curl': ['ek', '0220', 2], // Concentration Curls with Dumbbell
    'cross-body-hammer': ['ek', '0221', 2], // Cross Body Hammer Curl with Dumbbell
    'crunch': ['ek', '0291', 2], // Crunches
    'db-bench-press': ['ek', '0055', 2], // Bench Press: Dumbbell
    'db-curl': ['ek', '0224', 2], // Biceps Curl: Dumbbell
    'db-decline-fly': ['ek', '0053', 2], // Decline Dumbbell Fly's
    'db-decline-press': ['ek', '0052', 2], // Bench Press: Dumbbell (Decline)
    'db-fly': ['ek', '0056', 2], // Dumbbell Flys
    'db-front-raise': ['ek', '0033', 2], // Front Dumbbell Raise
    'db-incline-fly': ['ek', '0062', 2], // Incline Dumbbell Fly's
    'db-incline-press': ['ek', '0061', 2], // Bench Press: Dumbbell (Incline)
    'db-kickback': ['ek', '0204', 2], // Triceps Kickback with Dumbbell
    'db-lateral-raise': ['ek', '0018', 2], // Lateral Dumbbell Raises
    'db-overhead-ext': ['ek', '0198', 2], // Triceps Extension: Dumbbell (Standing)
    'db-preacher-curl': ['ek', '0249', 2], // Preacher Curl: Dumbbell (Two Arm)
    'db-pullover': ['ek', '0079', 2], // Straight Arm Dumbbell Pullover
    'db-reverse-curl': ['ek', '0257', 2], // Biceps Curl: Dumbbell (Reverse)
    'db-reverse-lunge': ['ek', '0129', 2], // Lunges: Dumbbell (Rear)
    'db-shrug': ['ek', '0005', 2], // Shoulder Shrugs: Dumbbell
    'db-side-bend': ['ek', '0294', 2], // Side Bend with Dumbbell
    'db-skullcrusher': ['ek', '0181', 2], // Triceps Extension: Dumbbell (Lying)
    'db-squat': ['ek', '0130', 2], // Squats: Dumbbells
    'db-step-up': ['ek', '0137', 2], // Step Ups: Dumbbell
    'db-sumo-squat': ['ek', '0152', 2], // Pile Squat with Dumbbell
    'db-upright-row': ['ek', '0016', 2], // Upright Row: Dumbbell
    'db-walking-lunge': ['ek', '0121', 2], // Lunges: Dumbbell (Walking)
    'deadlift': ['ek', '0099', 2], // Dead Lifts: Barbell
    'decline-pushup': ['ek', '0075', 2], // Push Up: Bench (Feet Elevated)
    'diamond-pushup': ['ek', '0188', 2], // Close Triceps Pushup
    'ez-bar-curl': ['ek', '0226', 2], // EZ Bar Curl with Barbell
    'glute-bridge': ['ek', '0109', 2], // Bridging
    'hammer-curl': ['ek', '0227', 2], // Biceps Curl: Dumbbell (Hammer)
    'incline-db-curl': ['ek', '0214', 2], // Alternating Incline Curl with Dumbbell
    'incline-rear-delt-fly': ['ek', '0023', 2], // Rear Delt Raise: Dumbbell (Incline Bench)
    'leg-extension': ['ek', '0142', 2], // Leg Extensions
    'leg-press': ['ek', '0127', 2], // Leg Press
    'lying-leg-raise': ['ek', '0021', 2], // Flat Bench Leg Raises
    'machine-chest-press': ['ek', '0066', 2], // Bench Press: Machine
    'machine-leg-curl': ['ek', '0117', 2], // Lying Leg Curl Machine
    'pullup': ['ek', '0087', 2], // Pull Ups
    'pushup': ['ek', '0077', 2], // Push Up: Body Weight
    'reverse-crunch': ['ek', '0287', 2], // Bent Knee Hip Raise
    'romanian-deadlift': ['ek', '0118', 2], // Romanian Dead Lift
    'rope-pushdown': ['ek', '0206', 2], // Triceps Pushdown: Cable (Rope)
    'seated-cable-row': ['ek', '0025', 2], // Seated Cable Rows
    'side-plank': ['ek', '0113', 2], // Side Plank
    'single-arm-pushdown': ['ek', '0166', 2], // Single-Arm Triceps Pushdown: Cable
    'sissy-squat': ['ek', '0158', 2], // Weighted Sissy Squat with Weight Plate
    'spider-curl': ['ek', '0225', 2], // Prone Incline Biceps Curl with Dumbbell
    'straight-arm-pulldown': ['ek', '0092', 2], // Straight Arm Push Down
    'superman-hold': ['ek', '0105', 2], // Supermans
    'tate-press': ['ek', '0203', 2], // Tate Press with Dumbbell
    'triceps-dip': ['ek', '0172', 2], // Triceps Dips: Body Weight
    'zottman-curl': ['ek', '0251', 2], // Zottman Curl with Dumbbells
    // ── Workout Guide
    'archer-pushup': ['wg', 'archer-push-up', 3], // Archer Push-up
    'bb-row': ['wg', 'barbell-row', 3], // Barbell Row
    'bear-crawl': ['wg', 'bear-crawl', 3], // Bear Crawl
    'bird-dog': ['wg', 'bird-dog', 3], // Bird Dog
    'bulgarian-split-squat': ['wg', 'bulgarian-split-squat', 3], // Bulgarian Split Squat
    'burpee': ['wg', 'burpee', 3], // Burpee
    'cable-fly': ['wg', 'cable-fly', 3], // Cable Fly
    'cable-lateral-raise': ['wg', 'cable-lateral-raise', 3], // Cable Lateral Raise
    'cable-pull-through': ['wg', 'cable-pull-through', 3], // Cable Pull-Through
    'cable-reverse-fly': ['wg', 'cable-rear-delt-fly', 3], // Cable Rear Delt Fly
    'cable-woodchop': ['wg', 'cable-woodchop', 3], // Cable Woodchop
    'copenhagen-plank': ['wg', 'copenhagen-plank', 3], // Copenhagen Plank
    'cossack-squat': ['wg', 'cossack-squat', 3], // Cossack Squat
    'db-bent-row': ['wg', 'dumbbell-bent-over-row', 3], // Dumbbell Bent Over Row
    'db-hip-thrust': ['wg', 'dumbbell-hip-thrust', 3], // Dumbbell Hip Thrust
    'db-rdl': ['wg', 'dumbbell-romanian-deadlift', 3], // Dumbbell Romanian Deadlift
    'db-rear-delt-fly': ['wg', 'bent-over-rear-delt-raise', 3], // Bent-Over Rear Delt Raise
    'db-row': ['wg', 'one-arm-dumbbell-row', 3], // One-Arm Dumbbell Row
    'db-shoulder-press': ['wg', 'seated-dumbbell-press', 3], // Dumbbell Seated Shoulder Press
    'dead-bug': ['wg', 'dead-bug', 3], // Dead Bug
    'dead-hang': ['wg', 'dead-hang', 3], // Dead Hang
    'face-pull': ['wg', 'face-pull', 3], // Face Pull
    'farmers-carry': ['wg', 'farmer-carry', 3], // Farmer Carry
    'goblet-squat': ['wg', 'goblet-squat', 3], // Goblet Squat
    'handstand-pushup': ['wg', 'wall-handstand-push-up', 3], // Wall Handstand Push-up
    'hanging-knee-raise': ['wg', 'hanging-knee-raise', 3], // Hanging Knee Raise
    'hanging-leg-raise': ['wg', 'hanging-leg-raise', 3], // Hanging Leg Raise
    'heel-elevated-goblet': ['wg', 'heel-elevated-goblet-squat', 3], // Heel-Elevated Goblet Squat
    'heel-taps': ['wg', 'heel-tap', 3], // Heel Tap
    'high-knees': ['wg', 'high-knees', 3], // High Knees
    'incline-pushup': ['wg', 'incline-push-up', 3], // Incline Push-up
    'incline-walk': ['wg', 'treadmill-incline-walk', 3], // Treadmill Incline Walk
    'inverted-row': ['wg', 'inverted-row', 3], // Inverted Row
    'jump-rope': ['wg', 'jump-rope', 3], // Jump Rope
    'jump-squat': ['wg', 'jump-squat', 3], // Jump Squat
    'jumping-jacks': ['wg', 'jumping-jack', 3], // Jumping Jack
    'kb-swing': ['wg', 'kettlebell-swing', 3], // Kettlebell Swing
    'kroc-row': ['wg', 'one-arm-dumbbell-row', 3], // One-Arm Dumbbell Row
    'lat-pulldown': ['wg', 'wide-grip-lat-pulldown', 3], // Wide-Grip Lat Pulldown
    'lateral-lunge': ['wg', 'dumbbell-lateral-lunge', 3], // Dumbbell Lateral Lunge
    'machine-shoulder-press': ['wg', 'machine-shoulder-press', 3], // Machine Shoulder Press
    'mountain-climber': ['wg', 'mountain-climber', 3], // Mountain Climber
    'nordic-curl': ['wg', 'nordic-hamstring-curl', 3], // Nordic Hamstring Curl
    'overhead-cable-ext': ['wg', 'overhead-tricep-extension', 3], // Overhead Tricep Extension
    'pallof-press': ['wg', 'pallof-press', 3], // Pallof Press
    'pec-deck': ['wg', 'pec-deck', 3], // Pec Deck
    'pike-pushup': ['wg', 'pike-push-up', 3], // Pike Push-up
    'plank': ['wg', 'plank', 3], // Plank
    'pullup-negative': ['wg', 'negative-pull-up', 3], // Negative Pull-up
    'rowing-machine': ['wg', 'rowing', 3], // Rowing
    'single-arm-cable-row': ['wg', 'single-arm-cable-row', 3], // Single-Arm Cable Row
    'single-leg-calf-raise': ['wg', 'single-leg-calf-raise', 3], // Single-Leg Calf Raise
    'single-leg-glute-bridge': ['wg', 'single-leg-glute-bridge', 3], // Single-Leg Glute Bridge
    'single-leg-rdl': ['wg', 'single-leg-romanian-deadlift', 3], // Single-Leg Romanian Deadlift
    'skater-jumps': ['wg', 'skater-hop', 3], // Skater Hop
    'squat-thrust': ['wg', 'squat-thrust', 3], // Squat Thrust
    'standing-db-press': ['wg', 'standing-dumbbell-press', 3], // Standing Dumbbell Press
    'stationary-bike': ['wg', 'cycling', 3], // Cycling
    'treadmill-run': ['wg', 'running', 3], // Running
    'wall-sit': ['wg', 'wall-sit', 3], // Wall Sit
    'wide-grip-pulldown': ['wg', 'wide-grip-lat-pulldown', 3], // Wide-Grip Lat Pulldown
    'wide-pushup': ['wg', 'wide-push-up', 3], // Wide Push-up
    // ── Open Exercise Illustrations
    'ab-wheel': ['oei', 'ab-wheel-rollout', 2], // Ab Wheel Rollout
    'arnold-press': ['oei', 'arnold-press', 2], // Arnold Press
    'cable-chest-press': ['oei', 'standing-cable-chest-press', 2], // Standing Cable Chest Press
    'cable-crunch': ['oei', 'cable-crunch', 2], // Cable Crunch
    'cable-fly-low-high': ['oei', 'cable-fly-low-to-high', 2], // Cable Fly Low To High
    'cable-kickback': ['oei', 'cable-triceps-kickback', 2], // Cable Triceps Kickback
    'cg-bench-press': ['oei', 'close-grip-bench-press', 2], // Close-Grip Bench Press
    'chest-supported-row': ['oei', 'chest-supported-dumbbell-row', 2], // Chest-Supported Dumbbell Row
    'db-calf-raise': ['oei', 'dumbbell-calf-raise', 2], // Dumbbell Calf Raise
    'db-floor-press': ['oei', 'dumbbell-floor-press', 2], // Dumbbell Floor Press
    'db-squeeze-press': ['oei', 'dumbbell-squeeze-press', 2], // Dumbbell Squeeze Press
    'db-thruster': ['oei', 'dumbbell-thruster', 2], // Dumbbell Thruster
    'db-wrist-curl': ['oei', 'dumbbell-wrist-curl', 2], // Dumbbell Wrist Curl
    'ez-skullcrusher': ['oei', 'skull-crushers', 2], // Skull Crusher
    'hollow-hold': ['oei', 'hollow-body-hold', 1], // Hollow Body Hold
    'mb-chest-pass': ['oei', 'medicine-ball-chest-pass', 3], // Medicine Ball Chest Pass
    'mb-slam': ['oei', 'medicine-ball-slam', 2], // Medicine Ball Slam
    'renegade-row': ['oei', 'renegade-row', 2], // Renegade Row
    'reverse-wrist-curl': ['oei', 'dumbbell-reverse-wrist-curl', 2], // Dumbbell Reverse Wrist Curl
    'seated-db-calf-raise': ['oei', 'seated-calf-raise', 2], // Seated Calf Raise
    'slider-leg-curl': ['oei', 'sliding-hamstring-curl', 2], // Sliding Hamstring Curl
    'suitcase-carry': ['oei', 'suitcase-carry', 2], // Suitcase Carry
  };

  WT.MEDIA = {
    map: MAP,
    sources: SOURCES,
    /** Every frame file, for integrity checks and offline pre-caching. */
    files() {
      const out = new Set();
      Object.values(MAP).forEach(([s, id, n]) => SOURCES[s].frames(id, n).forEach((f) => out.add(SOURCES[s].base + f)));
      return [...out];
    },
    /** Exercises covered, per source. */
    counts() {
      const c = {};
      Object.values(MAP).forEach(([s]) => (c[s] = (c[s] || 0) + 1));
      return c;
    },
  };
  /** { src, frames: [urls], source, alsoEk } for an exercise, or null when there is no verified demonstration. */
  WT.demoFor = function (exId) {
    const e = MAP[exId];
    if (!e) return null;
    const [s, id, n] = e;
    const src = SOURCES[s];
    return { src: s, frames: src.frames(id, n).map((f) => src.base + f), source: src, alsoEk: s === 'wg' && WG_FROM_EK.has(id) };
  };
})();
