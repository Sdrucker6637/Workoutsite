# Exercise demonstrations: sources and licensing

Forge shows a short looping demonstration for an exercise only when an openly licensed illustration shows **that exact movement**, with the same equipment and body position. Every other exercise shows a neutral placeholder. The mapping lives in `js/media.js`, and each source folder holds its own license text and attribution.

| Folder | Source | Creator | License | Exercises | Format |
|---|---|---|---|---|---|
| `everkinetic/` | [Everkinetic open data](https://github.com/everkinetic/data) | Greg Priday & contributors | CC BY-SA 4.0 | 75 | SVG, start/end pair |
| `workout-guide/` | [Workout Guide](https://github.com/bryllim/workout-guide) (npm `@bryllim/workout-guide` 1.0.0) | Bryl Lim (some frames adapted from Everkinetic) | CC BY-SA 4.0 | 62 | WebP, 3 frames |
| `open-exercise-illustrations/` | [Open Exercise Illustrations](https://github.com/hitmanrepo/open-exercise-illustrations) | Hitman Repo, **AI-generated** | CC0 1.0 | 22 | WebP, 1–3 frames |

**Coverage: 159 of 185 built-in exercises (86%).** User-created exercises always show the placeholder.

The CC BY-SA 4.0 sources require attribution, a link to the license, a note of the changes made, and that adaptations be shared under the same license. Forge meets these requirements as follows:

- A credit line with the creator and a license link appears under every large demonstration: in the viewer, the exercise detail and the active workout.
- All sources are listed in Settings → About.
- Each folder's README lists the changes made.
- The adapted files in this folder remain under CC BY-SA 4.0.

## Sources evaluated and rejected

| Source | Why it was not used |
|---|---|
| ExerciseGymGifsDB (JahelCuadrado) | Its README says the GIFs were collected from the internet and that the author holds no rights to them. |
| free-exercise-db / wrkout exercises.json | The images have no stated creator or license. |
| hasaneyldrm/exercises-dataset | Its notice says the media are © Gym visual and may be redistributed only with the owner's permission. The repository grants no rights to them. |
| rubyosborne/sol-exercise-assets | A mirror of wger images without per-image license or author records. |
| RepDB (`@repdb/exercises`) | A proprietary free tier. It forbids redistribution as a dataset and forbids AI derivation, is "All rights reserved", and its images are AI-generated. |
| fithero / dziku exercise packages | Metadata only, with no images. |
| wger.de, Wikimedia Commons | Not reachable from the build environment. Per-image licenses vary and could not be verified one by one. |

## Candidates rejected on accuracy

These images came from accepted sources but did not match the Forge exercise closely enough:

| Forge exercise | Candidate | Problem |
|---|---|---|
| Low-to-High Cable Fly | Workout Guide drawing | Drawn on an incline bench; an OEI image was used instead. |
| Neutral-Grip Pull-Up | WG and OEI | The grip cannot be verified from the image. |
| Lat Pulldown | WG `lat-pulldown` | The figure is malformed. The WG wide-grip pulldown was used instead. |
| Chest-Supported Row | WG | It shows a T-bar machine; an OEI dumbbell-on-incline image was used instead. |
| Arnold Press | WG | Standing, with no rotation; an OEI seated image was used instead. |
| Dumbbell Front Squat | — | Only barbell front squats were available. |
| Seated Lateral Raise | — | Only standing versions were available. |
| Incline Y-Raise | — | Only floor or prone Y-raises were available. |
| Medicine-Ball Front Raise | — | Only plate front raises were available. |
| Wide-Grip Cable Row | — | Only close-grip rows were available. |
| Towel Curl | — | The only candidate was a stretch. |
| Calf raises | WG | Machine versions. OEI dumbbell standing and seated versions were used instead. |
| Skull crusher / close-grip bench | WG | The movement was drawn wrong; OEI versions were used instead. |
| Wrist curls | WG | Wrong movement; OEI versions were used instead. |
| Cable Triceps Kickback | WG | It shows a glute kickback; an OEI image was used instead. |
| Hollow Hold, Ab Wheel, Cable Crunch | WG | The frames were inconsistent or malformed; OEI images were used instead. |
| Kneeling Cable Crunch | Everkinetic 0288 | Seated, not kneeling. |
| Medicine-Ball V-Up, Russian Twist | — | The candidates had no medicine ball. |
| Outdoor Run | WG running | It shows a treadmill. |
| Chin-Up Isometric Hold | — | The grip cannot be verified. |

## Exercises still without a demonstration (26)

No licensed image showed an exact match for these exercises:

| Group | Exercises | Why |
|---|---|---|
| Chest | Glute-Bridge Dumbbell Press, Single-Arm Decline Cable Press, Medicine Ball Push-Up, Reverse-Grip Dumbbell Bench Press | No image shows the hybrid bridge position, a single-arm decline cable path, hands on a ball, or a supinated grip. |
| Back | Neutral-Grip Pull-Up, Single-Arm Lat Pulldown, Wide-Grip Seated Cable Row | The grip can't be verified, or only two-arm or close-grip versions exist. |
| Shoulders | Half-Kneeling Single-Arm Cable Press, Lean-Away Lateral Raise, Seated Dumbbell Lateral Raise, Medicine Ball Front Raise, Incline Y-Raise | Only standing, plate or floor variations exist. |
| Arms | Bayesian Cable Curl, High Cable Curl, Chin-Up Top Hold, Close-Grip Dumbbell Press (Neutral Grip) | Only standard cable curls and barbell close-grip presses exist; the hold's grip can't be verified. |
| Legs | Dumbbell Front Squat, Lying Dumbbell Leg Curl, Standing Cable Leg Curl, Medicine Ball Wall Ball | Only barbell front squats and machine leg curls exist, and there is no wall-ball throw. |
| Core | Medicine Ball V-Up, Medicine Ball Russian Twist, Medicine Ball Rotational Wall Toss | The candidates have no medicine ball. |
| Cardio | Outdoor Run, Run Intervals, Alternating Dumbbell Snatch | Running images show a treadmill, and no dumbbell snatch exists. |
