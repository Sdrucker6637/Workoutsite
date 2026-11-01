/* Exercise demonstrations — curated, hand-verified mapping to Everkinetic illustrations.
 *
 * Source:  Everkinetic open data (https://github.com/everkinetic/data), illustrations by
 *          Greg Priday (everkinetic.com) and contributors.
 * License: Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0). See media/everkinetic/.
 * Changes: SVGs minified with SVGO and cropped to the figure; the two frames (start/end) are shown
 *          as a looping animation.
 *
 * Every pair below was checked visually against the Forge exercise. An exercise is only listed
 * when the drawing shows that exact movement; everything else falls back to a placeholder.
 */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const MAP = {
    'alt-db-curl': '0223', // Alternating Bicep Curl with Dumbbell
    'back-extension': '0103', // Hyperextensions
    'bb-back-squat': '0122', // Barbell Squat
    'bb-bench-press': '0042', // Bench Press: Barbell
    'bb-curl': '0211', // Biceps Curl: Barbell
    'bb-incline-press': '0043', // Bench Press: Barbell (Incline)
    'bench-dip': '0162', // Bench Dips
    'bicycle-crunch': '0284', // Air Bike
    'cable-crossover-bench': '0057', // Flat Bench Cable Flys
    'cable-curl': '0212', // Standing Biceps Curl with Cable
    'cable-fly-high-low': '0048', // Cable Crossover
    'cable-front-raise': '0008', // Front Cable Raises
    'cable-glute-kickback': '0112', // One Legged Cable Kickback
    'cable-hip-adduction': '0135', // Hip Adduction
    'cable-pushdown': '0205', // Triceps Pushdown: Cable
    'cable-rope-hammer': '0216', // Hammer Curls with Rope and Cable
    'cable-shrug': '0009', // Shoulder Shrugs: Cable
    'cable-upright-row': '0015', // Upright Cable Row
    'chest-dip': '0054', // Chest Dips
    'chinup': '0090', // Narrow Parallel Grip Chin-ups
    'close-grip-pulldown': '0096', // Pull Down: V Bar 
    'concentration-curl': '0220', // Concentration Curls with Dumbbell
    'cross-body-hammer': '0221', // Cross Body Hammer Curl with Dumbbell
    'crunch': '0291', // Crunches
    'db-bench-press': '0055', // Bench Press: Dumbbell
    'db-curl': '0224', // Biceps Curl: Dumbbell
    'db-decline-fly': '0053', // Decline Dumbbell Fly's
    'db-decline-press': '0052', // Bench Press: Dumbbell (Decline)
    'db-fly': '0056', // Dumbbell Flys
    'db-front-raise': '0033', // Front Dumbbell Raise
    'db-incline-fly': '0062', // Incline Dumbbell Fly's
    'db-incline-press': '0061', // Bench Press: Dumbbell (Incline)
    'db-kickback': '0204', // Triceps Kickback with Dumbbell
    'db-lateral-raise': '0018', // Lateral Dumbbell Raises
    'db-overhead-ext': '0198', // Triceps Extension: Dumbbell (Standing)
    'db-preacher-curl': '0249', // Preacher Curl: Dumbbell (Two Arm)
    'db-pullover': '0079', // Straight Arm Dumbbell Pullover
    'db-reverse-curl': '0257', // Biceps Curl: Dumbbell (Reverse)
    'db-reverse-lunge': '0129', // Lunges: Dumbbell (Rear)
    'db-shrug': '0005', // Shoulder Shrugs: Dumbbell
    'db-side-bend': '0294', // Side Bend with Dumbbell
    'db-skullcrusher': '0181', // Triceps Extension: Dumbbell (Lying)
    'db-squat': '0130', // Squats: Dumbbells
    'db-step-up': '0137', // Step Ups: Dumbbell
    'db-sumo-squat': '0152', // Pile Squat with Dumbbell
    'db-upright-row': '0016', // Upright Row: Dumbbell
    'db-walking-lunge': '0121', // Lunges: Dumbbell (Walking)
    'deadlift': '0099', // Dead Lifts: Barbell
    'decline-pushup': '0075', // Push Up: Bench (Feet Elevated)
    'diamond-pushup': '0188', // Close Triceps Pushup
    'ez-bar-curl': '0226', // EZ Bar Curl with Barbell
    'glute-bridge': '0109', // Bridging
    'hammer-curl': '0227', // Biceps Curl: Dumbbell (Hammer)
    'incline-db-curl': '0214', // Alternating Incline Curl with Dumbbell
    'leg-extension': '0142', // Leg Extensions
    'leg-press': '0127', // Leg Press
    'lying-leg-raise': '0021', // Flat Bench Leg Raises
    'machine-chest-press': '0066', // Bench Press: Machine
    'machine-leg-curl': '0117', // Lying Leg Curl Machine
    'pullup': '0087', // Pull Ups
    'pushup': '0077', // Push Up: Body Weight
    'reverse-crunch': '0287', // Bent Knee Hip Raise
    'romanian-deadlift': '0118', // Romanian Dead Lift
    'rope-pushdown': '0206', // Triceps Pushdown: Cable (Rope)
    'seated-cable-row': '0025', // Seated Cable Rows
    'side-plank': '0113', // Side Plank
    'sissy-squat': '0158', // Weighted Sissy Squat with Weight Plate
    'spider-curl': '0225', // Prone Incline Biceps Curl with Dumbbell
    'straight-arm-pulldown': '0092', // Straight Arm Push Down
    'superman-hold': '0105', // Supermans
    'tate-press': '0203', // Tate Press with Dumbbell
    'triceps-dip': '0172', // Triceps Dips: Body Weight
    'zottman-curl': '0251', // Zottman Curl with Dumbbells
  };
  WT.MEDIA = {
    map: MAP,
    base: 'media/everkinetic/',
    credit: 'Illustrations: Everkinetic (Greg Priday & contributors)',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceUrl: 'https://github.com/everkinetic/data',
    files() {
      const out = [];
      new Set(Object.values(MAP)).forEach((id) => out.push(this.base + id + '-a.svg', this.base + id + '-b.svg'));
      return out;
    },
  };
  /** Demonstration frames for an exercise, or null when no verified animation exists. */
  WT.demoFor = function (exId) {
    const id = MAP[exId];
    return id ? { a: WT.MEDIA.base + id + '-a.svg', b: WT.MEDIA.base + id + '-b.svg' } : null;
  };
})();
