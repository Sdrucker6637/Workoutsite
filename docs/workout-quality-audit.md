# Workout quality audit

`node tools/audit-workouts.js` generates a seeded, representative sample and prints every workout with diagnostics:
- 20 full body, 15 push, 15 pull, 15 legs, 10 chest and 10 arms workouts;
- 5 equipment setups × 3 training histories × 3 experience levels;
- 200 workouts per type at identical settings (variety);
- an 8-week simulation in which every workout is logged into history.

Seeds are fixed, so runs are directly comparable. `docs/audit/before.txt` is the generator before this audit and `docs/audit/after.txt` is after it, with identical seeds and scenarios.

## Results

| | Before | After |
|---|---|---|
| Flags in the 85-workout sample | 55 | 20 |
| Flags in 1,200 identical-settings workouts | 347 | ~140 |
| Mean / minimum quality score (sample) | 94.2 / 68 | 94.6 / 75 |
| Triceps overload on push/chest days (sample / 1,200 runs) | 8 / 59 | 2 / 0 |
| Impractical supersets (cable + cable, bench + bench) | 3 / 12 | 0 / 0 |
| Redundant pairs in the sample | 23 | 1 |
| Full body: lower body < 30% of direct sets (200 runs) | ~25 | 4–6 |

The remaining flags are mostly equipment-limited sessions (bodyweight + bar) and 4-of-6 isolation push/pull days for an arm-priority profile, which is acceptable programming.

## Problems found, by severity, and fixes

1. **High: recovery ignored for optional work.** The day after legs, full-body days still added a second squat or hamstring exercise, and heavy or build-up sets went to just-trained muscles.
   - Fatigue now covers every muscle an exercise substantially loads (≥ ½ set share), not only its primary.
   - Optional slots for recently trained muscles are almost never chosen (×0.15 weight).
   - Those muscles get no heavy or build-up work.
   - Their compounds are capped at 3 sets, and duration fitting doesn't add sets back.
2. **High: full-body area balance.** Optional slots could stack on one side (4 vs 11 direct push/pull sets) or add a third and fourth lower-body exercise.
   - Extras are now steered by *direct* sets: pushing against pulling, and lower body against the average upper-body area. Fractional sets over-counted pulling.
   - Lateral-delt work is neutral.
   - The remaining 2:1 cases mostly come from the profile's chest and triceps priorities.
3. **High: padding with sparse equipment.** Off-role filler (Bird Dog as a "row") and near-identical variants (pull-up + chin-up + negatives, pike + handstand push-up, diamond push-up + bench dip).
   - Padding and "second variation" slots now reject exercises with the same primary muscle, pattern and implement family.
   - Padding stays within the session's target muscles.
   - The plan says when it is shorter rather than repeating itself.
4. **Medium-high: experience fit.**
   - Beginners no longer get advanced exercises (the Cossack squat), unless a required movement has no other option.
   - Trained lifters no longer get easy regressions (incline push-up) as main or secondary presses.
   - Single-leg slots prefer quad-dominant lunges and split squats over adductor-biased ones.
5. **Medium: triceps overload on push days.**
   - After three presses, only one direct triceps exercise is added.
   - The "close-grip press / dip" extra was removed from push days.
   - A third press is skipped if two triceps exercises are already planned.
6. **Medium: impractical supersets.** Two cable exercises (re-rigging one station every round) or two bench exercises (resetting the angle) are no longer paired.
7. **Medium: holds used as hypertrophy work.**
   - Timed holds (chin-up hold, dead hang) are only a fallback outside core slots.
   - A chin-up can now fill a biceps slot when no curl is available (`moves2: ['biceps']`).
8. **Medium: redundant compound pairs.**
   - Push days: the second chest press must use a different angle than the main press; this now outweighs the lower-chest goal bonus.
   - Pull days: a second row prefers the other primary muscle (lats vs upper back).
   - Pull days: two vertical pulls plus a lat isolation are never combined.
9. **Low: variety side effects.**
   - The second chest fly is free to vary; only the first serves the lower-chest goal.
   - A second isolation may repeat a pattern with a different implement (DB fly → cable fly).
10. **Low: labels.** A slot's label follows the movement actually chosen (a push-up isn't labelled "Overhead press").

## Variety (200 workouts at identical settings, no history)

| Type | Distinct workouts | Exercises used | Comment |
|---|---|---|---|
| Full body | 195 | 57 | Lead lift, press and pull planes, and extras all vary |
| Push | 173 | 34 | Shoulder press appears in ~70% (the only overhead options with this equipment) |
| Pull | 178 | 35 | Pull-Up in ~99%: it's a favorite. With real history the main lift rotates (56% over 8 weeks) |
| Legs | 135 | 24 | Hip thrust in ~93%: RDLs and deadlifts are restricted in this profile, leaving two hip compounds |
| Chest | 118 | 30 | Lower after the angle rule: three different press angles narrow the choices |
| Arms | 172 | 25 | |

In the 8-week simulation, main lifts stay fairly consistent (good for progression), while 27 different isolation/core exercises appear across 28 push/pull/leg sessions.

## Known limitations
- **Bodyweight-only lower body:** the library has no basic bodyweight squat or split squat, so the only bodyweight knee-dominant compound is the advanced Cossack squat. Adding exercises (with demonstrations) would fix this.
- **Pull-Up + a pulldown** still appears in ~10% of pull days (heavy bodyweight work, then loadable volume). This is defensible and was left in.
- **Arms days are short** (~35–40 min at a 60-minute setting), because duration fitting only adds sets to compound lifts.
- **Gym layout is unknown:** "different stations" supersets (machine + cable) are allowed.
