# Workout Guide illustrations

These frames come from **Workout Guide** by **Bryl Lim** (<https://bryllim.com>).

- Source repository: <https://github.com/bryllim/workout-guide> (`packages/workout-guide`)
- Copy used: npm package [`@bryllim/workout-guide`](https://www.npmjs.com/package/@bryllim/workout-guide) version 1.0.0
- License: [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/). The full text is in `LICENSE.md`.
- Upstream license and attribution notices are kept unchanged in `UPSTREAM-LICENSE-ASSETS.txt` and `UPSTREAM-ATTRIBUTION.md`. Per-frame attribution from the upstream manifest is in `attribution.json`.

## Provenance

The package's `LICENSE-ASSETS` states: "Copyright (c) 2026 Bryl Lim, except where ATTRIBUTION.md identifies an upstream source." Every frame in the upstream manifest carries its own attribution record.

Some frames are adaptations of **Everkinetic** artwork (Greg Priday & contributors, CC BY-SA 4.0). Three of the drawings used here contain such frames, and they are credited to both Bryl Lim and Everkinetic wherever they are shown:

- `cable-fly`: frame 1 adapted from https://github.com/everkinetic/data/blob/main/dist/svg/0048-tension.svg
- `inverted-row`: frame 1 adapted from https://github.com/everkinetic/data/blob/main/dist/svg/0086-tension.svg
- `barbell-row`: frame 1 adapted from https://github.com/everkinetic/data/blob/main/dist/svg/0026-tension.svg

## Changes made for Forge

- Each drawing's frames were cropped to a shared bounding box with a small margin, so the figure does not jump between frames.
- Frames were resized to fit within 360 × 360 px and re-encoded from PNG to WebP.
- Files were renamed from `<slug>/frame-N.png` to `<slug>-N.webp`.
- In the app, the frames are recolored by an invert filter in the light theme, shown as-is in the dark theme, and played as a loop: frame 1 → 2 → 3 → 2.

These adapted files are shared under the same CC BY-SA 4.0 license.

## How frames were matched

Each Forge exercise below was compared by eye against all three frames. A drawing was used only when it shows the same movement, with the same equipment and body position. Drawings showing a related but different movement, such as a machine instead of dumbbells or standing instead of seated, were rejected. See `media/README.md` for the rejected candidates.

| Forge exercise | Forge id | Workout Guide slug | Frames |
|---|---|---|---|
| Archer Push-Up | `archer-pushup` | `archer-push-up` | 3 |
| Barbell Row | `bb-row` | `barbell-row` | 3 |
| Bear Crawl | `bear-crawl` | `bear-crawl` | 3 |
| Bent-Over Dumbbell Row | `db-bent-row` | `dumbbell-bent-over-row` | 3 |
| Bent-Over Rear Delt Fly | `db-rear-delt-fly` | `bent-over-rear-delt-raise` | 3 |
| Bird Dog | `bird-dog` | `bird-dog` | 3 |
| Bulgarian Split Squat | `bulgarian-split-squat` | `bulgarian-split-squat` | 3 |
| Burpee | `burpee` | `burpee` | 3 |
| Cable Chest Fly | `cable-fly` | `cable-fly` | 3 |
| Cable Face Pull | `face-pull` | `face-pull` | 3 |
| Cable Lateral Raise | `cable-lateral-raise` | `cable-lateral-raise` | 3 |
| Cable Pull-Through | `cable-pull-through` | `cable-pull-through` | 3 |
| Cable Reverse Fly | `cable-reverse-fly` | `cable-rear-delt-fly` | 3 |
| Cable Woodchopper | `cable-woodchop` | `cable-woodchop` | 3 |
| Copenhagen Plank | `copenhagen-plank` | `copenhagen-plank` | 3 |
| Cossack Squat | `cossack-squat` | `cossack-squat` | 3 |
| Dead Bug | `dead-bug` | `dead-bug` | 3 |
| Dead Hang | `dead-hang` | `dead-hang` | 3 |
| Dumbbell Hip Thrust | `db-hip-thrust` | `dumbbell-hip-thrust` | 3 |
| Dumbbell Lateral Lunge | `lateral-lunge` | `dumbbell-lateral-lunge` | 3 |
| Dumbbell Romanian Deadlift | `db-rdl` | `dumbbell-romanian-deadlift` | 3 |
| Farmer's Carry | `farmers-carry` | `farmer-carry` | 3 |
| Goblet Squat | `goblet-squat` | `goblet-squat` | 3 |
| Hanging Knee Raise | `hanging-knee-raise` | `hanging-knee-raise` | 3 |
| Hanging Leg Raise | `hanging-leg-raise` | `hanging-leg-raise` | 3 |
| Heel Taps | `heel-taps` | `heel-tap` | 3 |
| Heels-Elevated Goblet Squat | `heel-elevated-goblet` | `heel-elevated-goblet-squat` | 3 |
| High Knees | `high-knees` | `high-knees` | 3 |
| Incline Push-Up (Hands Elevated) | `incline-pushup` | `incline-push-up` | 3 |
| Incline Treadmill Walk | `incline-walk` | `treadmill-incline-walk` | 3 |
| Inverted Row | `inverted-row` | `inverted-row` | 3 |
| Jump Rope | `jump-rope` | `jump-rope` | 3 |
| Jump Squat | `jump-squat` | `jump-squat` | 3 |
| Jumping Jacks | `jumping-jacks` | `jumping-jack` | 3 |
| Kettlebell Swing | `kb-swing` | `kettlebell-swing` | 3 |
| Kroc Row (High-Rep DB Row) | `kroc-row` | `one-arm-dumbbell-row` | 3 |
| Lat Pulldown | `lat-pulldown` | `wide-grip-lat-pulldown` | 3 |
| Machine Shoulder Press | `machine-shoulder-press` | `machine-shoulder-press` | 3 |
| Mountain Climber | `mountain-climber` | `mountain-climber` | 3 |
| Nordic Hamstring Curl | `nordic-curl` | `nordic-hamstring-curl` | 3 |
| One-Arm Dumbbell Row | `db-row` | `one-arm-dumbbell-row` | 3 |
| Overhead Cable Triceps Extension | `overhead-cable-ext` | `overhead-tricep-extension` | 3 |
| Pallof Press | `pallof-press` | `pallof-press` | 3 |
| Pec Deck | `pec-deck` | `pec-deck` | 3 |
| Pike Push-Up | `pike-pushup` | `pike-push-up` | 3 |
| Plank | `plank` | `plank` | 3 |
| Pull-Up Negatives (Slow Eccentric) | `pullup-negative` | `negative-pull-up` | 3 |
| Rowing Machine | `rowing-machine` | `rowing` | 3 |
| Seated Dumbbell Shoulder Press | `db-shoulder-press` | `seated-dumbbell-press` | 3 |
| Single-Arm Cable Row | `single-arm-cable-row` | `single-arm-cable-row` | 3 |
| Single-Leg Calf Raise | `single-leg-calf-raise` | `single-leg-calf-raise` | 3 |
| Single-Leg Dumbbell RDL | `single-leg-rdl` | `single-leg-romanian-deadlift` | 3 |
| Single-Leg Glute Bridge | `single-leg-glute-bridge` | `single-leg-glute-bridge` | 3 |
| Skater Jumps | `skater-jumps` | `skater-hop` | 3 |
| Squat Thrust | `squat-thrust` | `squat-thrust` | 3 |
| Standing Dumbbell Press | `standing-db-press` | `standing-dumbbell-press` | 3 |
| Stationary Bike | `stationary-bike` | `cycling` | 3 |
| Treadmill Run | `treadmill-run` | `running` | 3 |
| Wall Handstand Push-Up | `handstand-pushup` | `wall-handstand-push-up` | 3 |
| Wall Sit | `wall-sit` | `wall-sit` | 3 |
| Wide-Grip Lat Pulldown | `wide-grip-pulldown` | `wide-grip-lat-pulldown` | 3 |
| Wide-Grip Push-Up | `wide-pushup` | `wide-push-up` | 3 |
