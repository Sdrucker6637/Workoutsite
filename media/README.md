# Exercise demonstrations: sources and licensing

Forge shows a short looping demonstration for an exercise only when an openly licensed illustration shows **that exact movement**, with the same equipment and body position. Every other exercise shows a neutral placeholder. The mapping lives in `js/media.js`, and each source folder holds its own license text and attribution.

| Folder | Source | Creator | License | Exercises | Format |
|---|---|---|---|---|---|
| `everkinetic/` | [Everkinetic open data](https://github.com/everkinetic/data) | Greg Priday & contributors | CC BY-SA 4.0 | 75 | SVG, start/end pair |
| `workout-guide/` | [Workout Guide](https://github.com/bryllim/workout-guide) (npm `@bryllim/workout-guide` 1.0.0) | Bryl Lim (some frames adapted from Everkinetic) | CC BY-SA 4.0 | 62 | WebP, 3 frames |
| `open-exercise-illustrations/` | [Open Exercise Illustrations](https://github.com/hitmanrepo/open-exercise-illustrations) | Hitman Repo, **AI-generated** | CC0 1.0 | 22 | WebP, 1–3 frames |
| `repdb/` | [RepDB free dataset](https://github.com/RepDB/exercise-dataset) | RepDB (Sergei Argutin), **AI-generated** | RepDB Free Tier License (in-app use with attribution; **not an open license**) | 9 | WebP, start/peak pair or single pose |

**Coverage: 168 of 185 built-in exercises (91%).** User-created exercises always show the placeholder. Single-pose references, such as running and the hollow hold, are labelled "Still image" in the app rather than presented as motion.

**Exercise data by [RepDB](https://repdb.co)**: this credit is required by RepDB's free tier and also appears under every RepDB image and in Settings → About. The RepDB files are licensed for in-app use only. Unlike the other folders, they are not available for reuse; see `repdb/README.md`.

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
| wger (wger-project, wger.de API) and the overachiever.eu knowledge graph | **Not evaluated.** wger's images and videos are served only from wger.de and are not in its GitHub repositories. wger.de and overachiever.eu are blocked by this build environment's network policy, so no record, license or media file could be inspected. They could be reconsidered if the hosts are allowed. |
| free-exercise-db (yuhonas) | The Unlicense comes from the person who restructured the data. The photographs come from wrkout/exercises.json, which names no photographer or source. Its titles match a commercial exercise site's catalog, and the same maintainer sells a commercial dataset. Ownership is unclear, so the photos were not used. |
| Flow Exercise Dataset (ozansozuozgit) | The artwork claims CC0, but it was generated with OpenAI Image Gen. For every relevant candidate (single-arm decline cable press, medicine-ball push-up, incline Y-raise, overhead cable curl, close-grip dumbbell press, medicine-ball Russian twist), the prompts were not kept and no references were recorded. The catalog maps one-to-one onto a dataset whose images belong to Gym visual. The documentation itself says provenance is not verified, so it was not used. |
| hasaneyldrm/exercises-dataset | Its notice says the media are © Gym visual and may be redistributed only with the owner's permission. The repository grants no rights to them. |
| rubyosborne/sol-exercise-assets | A mirror of wger images without per-image license or author records. |
| RepDB npm package (`@repdb/exercises`) | Evaluated earlier against open-license criteria and not used. The canonical free tier in `RepDB/exercise-dataset` was later accepted under its own in-app license; see `repdb/`. |
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
| Chin-Up Top Hold | RepDB `chin-ups` (peak), `flexed-arm-hang` | Underhand grip not distinguishable; the flexed-arm hang is drawn overhand. |
| Close-Grip Dumbbell Press (Neutral Grip) | RepDB `close-grip-db-bench-press` | Dumbbells touching, but a neutral grip cannot be confirmed. |
| Medicine Ball Wall Ball | RepDB `wall-ball` | A single squat pose holding a ball: no wall and no throw. |
| Medicine Ball V-Up, Russian Twist | RepDB `v-ups`, `russian-twist` | No medicine ball. |
| Glute-Bridge Dumbbell Press | RepDB `one-arm-kettlebell-floor-glute-bridge-press` | One kettlebell, not two dumbbells. |
| Medicine Ball Push-Up | RepDB `stability-ball-push-up-hands-on-ball` | Stability ball, not a medicine ball. |
| Standing Cable Leg Curl | RepDB `banded-standing-curl` | Resistance band, not a cable. |

## Exercises still without a demonstration (17)

| Group | Exercise | Why |
|---|---|---|
| Chest | Glute-Bridge Dumbbell Press | Only a one-arm kettlebell version exists (RepDB). |
| Chest | Single-Arm Decline Cable Press | Only Flow has one, and its provenance is unverified. |
| Chest | Medicine Ball Push-Up | Only stability-ball versions are verified; Flow's has unverified provenance. |
| Chest | Reverse-Grip Dumbbell Bench Press | No source shows a two-dumbbell supinated press; Flow has only a one-arm version, with unverified provenance. |
| Shoulders | Half-Kneeling Single-Arm Cable Press | No source has it. |
| Shoulders | Lean-Away Lateral Raise | No source has it. |
| Shoulders | Medicine Ball Front Raise | Only dumbbell, cable and plate versions exist. |
| Shoulders | Incline Y-Raise | Only prone, cable and band Y-raises are verified; Flow's has unverified provenance. |
| Arms | Bayesian Cable Curl | No source has the behind-the-body cable curl. |
| Arms | High Cable Curl | Only free-exercise-db (ownership unclear) and Flow (provenance unverified) have it. |
| Arms | Chin-Up Top Hold | The underhand grip cannot be confirmed in any image. |
| Arms | Close-Grip Dumbbell Press (Neutral Grip) | A neutral grip cannot be confirmed in any verified image. |
| Legs | Lying Dumbbell Leg Curl | Only machine, band and ball leg curls exist. |
| Legs | Standing Cable Leg Curl | Only band and machine versions exist. |
| Legs | Medicine Ball Wall Ball | No image shows the throw to a wall. |
| Core | Medicine Ball V-Up | Every V-up image is bodyweight only. |
| Core | Medicine Ball Russian Twist | Verified images show clasped hands; Flow's ball version has unverified provenance. |
