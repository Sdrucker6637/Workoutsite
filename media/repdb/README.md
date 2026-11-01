# RepDB illustrations (free tier)

**Exercise data by [RepDB](https://repdb.co)**

These frames come from the RepDB free public dataset: <https://github.com/RepDB/exercise-dataset>, `images/flat/`.

- **Licensor:** RepDB, operated by Sergei Argutin, Berlin. RepDB states that all images are "original works generated with AI tooling commissioned by RepDB — not copied or derived from any third-party exercise dataset or image library."
- **License:** the RepDB Free Tier License v1.0. The full text is copied unchanged in `LICENSE-DATA.md`, and the upstream attribution snippets are in `UPSTREAM-ATTRIBUTION.md`. **This is not an open license.** It allows personal and commercial use *inside applications*, with a visible attribution link.

## How Forge meets the license

| Term | How Forge complies |
|---|---|
| 1. In-app use | The images are used only as exercise demonstrations inside Forge. |
| 2. Attribution | The visible link "Exercise data by RepDB (repdb.co)" appears under every RepDB demonstration and in Settings → About. It is also at the top of this file and in the project README. |
| 3. No redistribution as a dataset | Only the 15 frames Forge displays are included, as app assets. **They are not offered for reuse.** If you fork Forge, these files stay under RepDB's license, not Forge's license or the CC licenses of the other folders. To build something else, take the images from RepDB directly. |
| 4. Modifications | The frames were resized from 512 px to 400 px and re-encoded as WebP. In the dark theme they are dimmed with a CSS brightness filter. Upscaling and background removal were not done. |
| 5. No generative-AI derivation | The images were not used as input to any generative model. |
| 6. Premium samples | Nothing from `premium-samples/` or any paid tier is used. |

## Changes made for Forge

- Each frame was resized to 400 × 400 and re-encoded as WebP (quality 78).
- Files were renamed from `<id>-start.webp` / `<id>-peak.webp` / `<id>-main.webp` to `<id>-1.webp` / `<id>-2.webp`.
- Start/peak pairs cross-fade in a loop. A single `main` pose is shown as a still image, labelled "Still image".

`sources.json` records the exact upstream URL of every frame.

## Review

RepDB's images are AI-generated, so every frame was inspected for:

- equipment;
- body position;
- grip;
- start and peak positions.

| Forge exercise | Forge id | RepDB id | Frames | Notes |
|---|---|---|---|---|
| Neutral-Grip Pull-Up | `neutral-pullup` | `neutral-grip-pull-ups` | start, peak | Parallel handles with palms facing each other are clearly visible. The start frame is drawn from behind and the peak from the front. |
| Single-Arm Lat Pulldown | `single-arm-pulldown` | `one-arm-lat-pulldown` | start, peak | Single D-handle, seated, one arm. |
| Wide-Grip Seated Cable Row | `wide-cable-row` | `wide-grip-seated-cable-row` | start, peak | Wide bar, overhand grip. |
| Seated Dumbbell Lateral Raise | `seated-lateral-raise` | `seated-dumbbell-lateral-raise` | start, peak | Seated on a bench. |
| Dumbbell Front Squat | `db-front-squat` | `dumbbell-front-squat` | start, peak | Dumbbells racked on the shoulders. |
| Medicine Ball Rotational Wall Toss | `mb-rotational-toss` | `medicine-ball-side-throw` | start, peak | The same rotational throw. No wall is drawn; the throw target does not change the movement. |
| Alternating Dumbbell Snatch | `db-snatch` | `dumbbell-snatch` | start, peak | One rep of the snatch; Forge's version alternates arms each rep. |
| Outdoor Run | `outdoor-run` | `running` | single pose | A runner on open ground, with no treadmill. |
| Run Intervals | `interval-run` | `running` | single pose | The same running movement; only the pacing differs. |

Rejected RepDB candidates are listed in `media/README.md`.
