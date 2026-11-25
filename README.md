# Forge

A free, private, offline-first workout app. It generates workouts from your goals, equipment and recent training, tracks every set, and recommends progressive overload from your logged numbers. A lightweight food diary keeps an approximate count of your daily protein.

- **No accounts, no servers, no paid APIs.** Your data lives in your browser's local storage.
- **Works offline** once it has loaded. YouTube videos are the only thing that needs a connection.
- **Installable on iPhone** as a home-screen app (a PWA).
- **No build step.** It is plain HTML, CSS and JavaScript. The charts and icons are written from scratch, so there are no external libraries or CDNs.

## Design

A quiet, precise interface in the spirit of Apple, Linear and Things: generous whitespace, one typeface, one accent, and very few containers.

**Look**
- **Type:** [Inter](https://rsms.me/inter/), bundled in `fonts/` (OFL), with optical sizes so large titles use the tighter Display cut. Every weight, rep, timer and stat uses tabular figures.
- **Color:** a soft neutral background, near-black text and a single pine-green accent, used only for the primary action and completion. Heavy and burnout appear as small rust and amber dots; nothing else is colored. A dark theme is in Settings.

**Navigation**
- **Desktop:** a quiet sidebar with Home, Generate, Train, Exercises, History, Progress, Food and Settings.
- **Phone:** a 6-tab bar (Home, Generate, Train, History, Progress, Food). Exercises and Settings sit in the top bar.

**Screens**
- **Home:** one focal "Generate workout" panel, a 7-day strip, a small "Protein today" card (can be turned off), the three most recent workouts, and a three-number summary of the last 30 days.
- **Generate:**
  - Type chips plus two options (exercise count and duration); everything else sits under *More options*.
  - The plan is a single list. Each row shows the name, muscle, sets × reps, the suggested weight from your history and a subtle intensity marker, with video, swap and more buttons.
- **Train:**
  - Navigation hides and the screen focuses on the current exercise.
  - Completed sets show as a short checklist.
  - A large editor has −/+ weight and rep controls. Weight steps to the next dumbbell you own; values are pre-filled from your last session.
  - One "Complete set" tap logs the set and starts the rest timer. Supersets alternate automatically.
- **Progress:** one chart at a time (Strength, Frequency or Volume tabs), then personal records and weekly sets per muscle group.

## Features

| Area | What it does |
| --- | --- |
| **Generator** | 13 workout types (Full Body, Push, Pull, Legs, Chest, Back, Shoulders, Arms, Biceps, Triceps, Core, Cardio, Custom multi-muscle). Settings for exercise count (or fit to time), duration, equipment, supersets, priority muscles and muscles to avoid. Each exercise has Swap, Lock and Remove buttons. Regenerate keeps locked exercises, "Re-roll intensities" keeps the exercises and re-draws their intensities, and you can add exercises by hand. |
| **Randomized intensity** | Classes: **heavy** (5–8), **regular** (8–12), **burnout** (12–20+), **standard** (the exercise's own recommendation), plus occasional **drop** and **build-up** sets. Intensities are drawn *after* the structure is set, independently per exercise from configurable odds (default 22 / 30 / 16 / 32), weighted by the exercise's **role**: heavy goes to main lifts, burnout to isolation and core work (never to a main lift or a spinal-loading lift). Each workout also draws a small budget for advanced work, so many sessions have none, most have one or two touches, and regular work stays at roughly 85% of exercises. At most one multi-stage set per workout: a drop set on a loadable isolation, or a build-up set on a loadable main or secondary compound. An exercise never gets a class it isn't eligible for. Tap any intensity label to change it. Settings can switch to fixed counts instead. |
| **Programming** | Structure comes before selection (see *Workout programming* below). Each workout type has a blueprint: required movement slots (full body always gets a squat pattern, a press, a pull and a hinge), then optional slots chosen by your priorities, weekly volume and recovery. Exercises are scored on goal emphasis, priority muscles, favorites, weekly volume, recent fatigue, overlap, recency and difficulty. Exercises are ordered by role, and supersets are formed only from compatible accessory pairs. Every plan shows its objective, and each exercise shows the slot it fills. |
| **Active workout** | A set table with *previous*, weight, reps and ✓ columns. Blank fields fall back to last time's numbers. Supports per-set weights, adding/removing sets, skipping, replacing, reordering, notes and an effort rating. A rest timer starts on its own (with sound and vibration) and is superset-aware. |
| **Progressive overload** | Uses your recorded sets (double progression). For example, 30 lb × 10, 10, 9 gives "Maintain 30 lb — aim for 10, 10, 10". All sets at the top of the range → add weight (+5 lb upper-body dumbbell or +2.5 if you have micro-plates, +5–10 lb lower body, snapped to dumbbells you own). Within range → add reps. Missed reps once → hold; missed twice → drop about 10%. Long layoffs restart conservatively. Bodyweight lifts get more reps, added load or a harder variation. **Weights only change when you tap Apply.** Every recommendation explains why. |
| **Library** | 185 exercises, each with muscles, equipment, category, movement pattern, difficulty, sets, reps, rest, intensity class and a video link. Search, filters, favorites, exclusions, custom exercises and editing are supported. |
| **History** | Permanent log with every set. Open any workout, repeat it, use it as a template, edit notes or delete it. |
| **Progress** | Workouts, per-week average, sets and volume; a workouts-per-week chart; a consistency heatmap; per-exercise charts (est. 1RM, top weight, volume, reps); PRs; weekly volume per muscle group against targets. Everything is calculated from logged data only. |
| **Food & protein** | Type what you ate in plain words ("2 chicken breasts, a protein shake and 2 hot dogs"); each item is recognized and its protein estimated, with a live breakdown before you log. Edit name, amount and protein; delete entries; browse and edit any past day. Favorites and recent foods log with one tap, and your own saved foods are recognized when typed. A flexible daily target (default 150 g, ±10% counts as on target), friendly guidance, and 7/30-day trends that leave unlogged days out of averages. Calories, carbs and fat are optional secondary estimates. |
| **Data** | Export a JSON backup (workouts **and** food log), then import it to merge or fully restore. Erase all data. Storage is persisted between sessions. |

### Your profile (pre-loaded, editable in Settings)
- **Goals:** lean out; lower-chest emphasis; bigger arms; obliques. Priority muscles are chest, biceps, triceps, abs and obliques.
- **Schedule:** 3 strength sessions + 2 runs per week. Full body preferred. Supersets on, burnouts on.
- **Equipment:** dumbbells 5–60 lb, bench, cable machine, lat pulldown, seated row, medicine ball, bodyweight and a pull-up bar. The pull-up bar is included because you want to keep improving pull-ups; untick it if you don't have one. There is no EZ bar and no cable ankle strap.
- **Restrictions:** no conventional deadlifts, no Romanian deadlifts (including DB and single-leg), no reverse-grip dumbbell pressing.
- **Favorites:** Sissy Squat and Pull-Up. The generator prefers them.

### Exercise demonstrations
168 of the 185 built-in exercises (91%) show a demonstration in the plan, the active workout, the library, exercise details and when swapping. Each one was matched to its exercise by hand and checked visually. Exercises without an exact match show a placeholder. The demonstrations come from four licensed sources, each bundled under `media/` with its license text and attribution:

| Source | License | Exercises |
|---|---|---|
| [Everkinetic](https://github.com/everkinetic/data) (Greg Priday & contributors) | CC BY-SA 4.0 | 75 |
| [Workout Guide](https://github.com/bryllim/workout-guide) (Bryl Lim, partly adapted from Everkinetic) | CC BY-SA 4.0 | 62 |
| [Open Exercise Illustrations](https://github.com/hitmanrepo/open-exercise-illustrations) (AI-generated, each frame reviewed) | CC0 1.0 | 22 |
| [RepDB free dataset](https://github.com/RepDB/exercise-dataset) (AI-generated, each frame reviewed) | RepDB Free Tier License: in-app use with attribution; not for reuse outside Forge | 9 |

Exercise data by [RepDB](https://repdb.co).

Single-pose references are labelled "Still image". Attribution appears under every large demonstration and in Settings → About. Frames load lazily, play only while on screen, and are cached by the service worker so they work offline. See `media/README.md` for the sources, the sources that were rejected and why, and the exercises that still have no match.

### About the videos
No video IDs are hard-coded, because they can't be checked offline and they break over time. Each exercise opens a **YouTube search** for that exercise's form tutorial. If you find a video you like, paste its link into the exercise (Library → exercise → paste link, or Edit). After that it **plays embedded** inside the app.

## Workout programming

`js/programming.js` decides **what a session must accomplish** before choosing exercises; `js/engine.js` keeps exercise scoring, prescriptions, progression and history.

1. **Movement classes** are derived from each exercise's existing pattern (no data migration): horizontal / vertical push and pull, knee-dominant (bilateral and unilateral), hip-dominant, hip extension, knee flexion, the core classes (flexion, anti-extension, anti-rotation, rotation, lateral), and isolation classes for delts, arms, calves and so on. Muscle contributions are fractional: a set counts 1 for the primary muscle, ½ for each secondary muscle of a compound lift, and ¼ for each secondary muscle of an isolation exercise. A bench press is 1 chest set, but only ½ a triceps set and ½ a front-delt set.
2. **Blueprints** (full body, push, pull, legs, chest, arms) have *required* slots with roles (main lift, secondary compound, accessory, isolation, core) and a weighted pool of *optional* slots. An emphasis is drawn for each workout (press-led vs overhead-led push, row-led vs vertical-pull-led pull, quad- vs posterior-led legs, which chest angles), so sessions vary inside the same structure. Back, shoulders, biceps, triceps, core, custom and cardio keep their focused slot lists. Cardio never contains resistance work.
3. **Optional slots** (the 5th and 6th exercise by default) are weighted by priority muscles, goal tags, weekly need, recent fatigue and a per-session cap (~10 fractional sets per muscle, 12 for priorities). Each one says why it was added.
4. **Coverage** is a hard check. If equipment, restrictions or avoided muscles make a category impossible, the plan says so and why (for example, "nothing fits your equipment"), and full body is titled *(partial)* rather than claiming coverage.
5. **Order**: main lifts → secondary compounds → accessories → isolation → core. The session's lead lift opens it, and lifts that share working muscles are not placed back to back.
6. **Supersets** are optional and fairly infrequent (about a quarter of sessions, more when the plan runs over your time). They pair only accessory or isolation work that doesn't compete for the same muscles: antagonists (biceps/triceps, quads/hamstrings, chest/upper back) or non-competing work (delts + calves, upper body + core). Main lifts always stand alone.
7. **Quality check**: each plan is scored on coverage, movement variety, redundancy, compound/isolation balance, order, intensity, supersets, volume/recovery, duration and focus. Hard violations trigger regeneration (up to 6 attempts; in practice almost always 1).
8. **Swaps** keep the slot: same-role alternatives (same movement and target muscle) come first. Options that would open a coverage gap or duplicate another exercise are marked. If nothing fits the role, the sheet says so, and *Same muscle group* still lets you choose freely.

**Volume and recovery.** Weekly reference: ~10 fractional sets per muscle (8 for beginners, 12 for advanced, +4 for priorities, 4 for small muscles), scaled by your planned sessions per week. Muscles below their reference are favoured *gently* (diminishing weight), and those well above it are de-emphasised. Recent fatigue is weighted by recency (full for 24 h, fading to zero at 72 h) and lowers both selection and heavy loading.

**Evidence base, and how strongly it is applied.**
- *Currier et al. 2026, ACSM position stand (overview of 137 systematic reviews, >30,000 participants):* hypertrophy is associated with higher weekly volume (≥10 sets/week), and strength with heavier loads, 2–3 sets, ≥2 sessions/week and exercises placed **early in the session**. Many variables (training to failure, set structure such as drop sets, equipment type, periodization) showed **no consistent effect**. Forge uses this for the ~10-set reference, for placing heavy work on the first lifts, and for treating drop / build-up sets as occasional variety rather than a driver of results.
- *Schoenfeld et al. 2017* (dose-response meta-analysis): more weekly sets → more growth, with diminishing returns. This is why volume targets are references with a gentle, saturating pull rather than quotas.
- *Pelland et al. 2025* (dose-response meta-regressions): counting indirect sets as fractions (≈0.5) modelled hypertrophy best, and returns diminish as volume rises. This is the basis for fractional set accounting. The ¼ weight for isolation secondaries is a heuristic, not a finding.
- *Ramos-Campo et al. 2024* (14 studies): split and full-body routines produce similar strength and hypertrophy when volume is equated. Forge therefore doesn't favour either; it balances volume across whatever sessions you choose.
- *Currier et al. 2023* (Bayesian network meta-analysis): heavier loads favour strength, while hypertrophy is similar across a wide range of loads when sets are hard. That is why heavy work is limited to a few main lifts and regular work dominates.

Everything else (slot weights, the session cap, superset frequency, intensity budgets) is a practical coaching heuristic, not a research finding, and can be tuned in `programming.js`.

## Food & protein tracker

Built for speed, not precision: no weighing, no grams, no calorie targets. Every number is an estimate.

**How recognition works** (`js/nutrition.js`, fully local and deterministic — no AI service, no network):
1. The text is normalized: fractions (`½`, `1 1/2`), number words (`two`, `half a`, `a couple of`, `a dozen`), `x2`, `6-inch` / `footlong`.
2. It is split into items on commas, new lines, `and`, `with`, `plus`… except inside names that contain them (*rice and beans*, *mac and cheese*, *PB&J*, your own saved foods).
3. Each item is matched against **your saved foods first**, then the bundled table in `js/foods.js` (≈115 foods, ≈460 aliases), by whole words, ignoring plurals; the longest match wins.
4. The quantity, serving word (`scoop`, `cup`, `bowl`, `handful`, `serving`, `shake`, `package`, `slice`, `can`, `oz`/`g`/`lb`…) and size word (`small`, `large`) set the amount. Each food defines what its servings mean (a scoop of Greek yogurt ≈ ¾ of a single cup; a bowl of protein pasta ≈ 1½ servings).
5. Leftover words are kept honestly: a brand with no product data is named but uses the typical estimate for that kind of food ("Ball Park recognized · typical hot dog estimate, not label data"); an unknown flavor keeps the item an **Estimate**.
6. If nothing matches, the item is **never logged with a made-up value**: you pick a suggestion (typo-tolerant), look the product up, or type your own protein.

Protein shows as whole grams, calories to the nearest 5–10; there are no decimals on screen.

### Branded products

Specific products are matched **before** generic foods, from two places: your library (*My foods*) and the bundled `js/products.js`. Each bundled product stores brand, product, flavor, serving size, protein, calories/carbs/fat when published (blank otherwise, never guessed), category, source URL and the date it was checked.

**Three confidence levels**, shown as a tag on every item:
- **Verified**: protein and serving were read from the manufacturer's own product page.
- **Confirmed by you**: you entered it from the label, confirmed a looked-up result, or corrected a value.
- **Estimate**: a generic value, a retailer-listed label not confirmed with the manufacturer, or a flavor we have no data for.

**Bundled products** (checked 2026-11-02):

| Product | Protein / serving | Status · source |
|---|---|---|
| Pioneer Pastures A2 Protein Shake (Vanilla, Chocolate, Strawberries & Cream) | 30 g / bottle | Verified · pioneerpastures.com |
| Premier Protein Shake (all listed flavors) | 30 g / bottle | Verified · premierprotein.com |
| fairlife Core Power (26 g) | 26 g / 14 fl oz | Verified · fairlife.com |
| fairlife Core Power Elite (42 g) | 42 g / 14 fl oz | Verified · fairlife.com |
| fairlife Nutrition Plan | 30 g / 11.5 fl oz | Verified · fairlife.com |
| Oikos Triple Zero (Vanilla, 5.3 oz cup) | 15 g | Verified · oikos.com |
| Oikos Pro yogurt (5.3 oz cup) | 20 g | Verified · oikos.com |
| Quest Protein Bar, Chocolate Chip Cookie Dough | 21 g / 60 g bar | Verified · questnutrition.com |
| Jif Creamy Peanut Butter | 7 g / 2 tbsp | Verified · jif.com |
| Barilla Protein+ pasta (US) | 17 g / 3.5 oz dry | Verified · barilla.com |
| Kraft Singles American | 4 g / 21 g slice | Verified · kraftheinz.com |
| Oscar Mayer Classic Beef Franks | 5 g / link | Verified · oscarmayer.com |
| Oscar Mayer Classic Wieners | 5 g / link | Verified · oscarmayer.com |
| Kodiak Power Cakes, Buttermilk | 15 g / serving | Verified · kodiakcakes.com |
| Chobani Complete yogurt cup (Vanilla) | 15 g | Estimate · retailer label listing |
| Chobani Complete yogurt drink (Vanilla) | 20 g / 10 fl oz | Estimate · retailer label listing |
| fairlife 2% ultra-filtered milk | ≈13 g / cup | Estimate · fairlife says "up to 13 g" |

**Matching and uncertainty.** A product is picked automatically only when nothing typed contradicts it and it's singled out within its brand: "Oikos Triple Zero", "core power elite", "2 Oscar Mayer beef hot dogs". Otherwise the entry asks, listing each candidate's brand, flavor, serving and protein, plus a generic estimate and "a different product":
- "Fairlife protein shake" (Core Power, Core Power Elite or Nutrition Plan?), "Oikos", "Kraft cheese", "Oscar Mayer hot dogs".
- A flavor the data doesn't list ("Quest cookies and cream", "Pioneer Pastures Snickerdoodle") is never assumed. You can use a listed product's values as a labelled estimate, or add it from the label.
- Generic words never land on a brand: "milk", "greek yogurt", "beef hot dog" and "protein pasta" stay generic estimates.

**Amounts** follow the label serving. Bottles, bars, cups and links multiply directly ("2 shakes" = 2 bottles). Weights use the label grams. Tablespoons and teaspoons are converted from the serving weight (a 150 g Triple Zero cup ≈ 10 tbsp) and marked "≈".

**Adding and correcting products.** *My foods → Find product* searches your library and bundled products (works offline). *Search online* optionally queries [Open Food Facts](https://world.openfoodfacts.org), a free, keyless community database of package labels. A result is shown for checking before saving. *Enter from label* takes values straight from the package. Correcting a logged product's values updates it in the library.

**Personal library.** Branded products are saved to *My foods* automatically when logged, with their source and status. When you resolve an ambiguous entry, the words you typed become shorthand, so "Oscar Mayer hot dogs" or "Snickerdoodle shake" resolve directly next time. You can star favorites (one-tap buttons), edit values, add shorthand names and delete products. *Recent* shows the last distinct foods you logged.

**Storage.** The food log lives in the same local store as workouts (`wt.data.v1`, data version 5) under `nutrition: { entries, foods }`, keyed by local date. Version 4 → 5 only adds fields (product brand / flavor / aliases / status / source, and each entry's confidence); workout data is untouched. Export includes the log and the library with aliases. *Replace* restores them exactly. *Merge* adds missing entries and products by id without duplicates.

## Run locally

```bash
python3 -m http.server 8000     # or: npx serve .
# open http://localhost:8000
```
You can also double-click `index.html`. Everything except offline caching and install works from `file://`.

## Deploy for free (needed for iPhone install + offline)

PWAs need HTTPS. The simplest free host is **GitHub Pages**:

1. Push this repository to GitHub. It is already at `sdrucker6637/workoutsite`.
2. Go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, pick your branch (e.g. `main`) and the `/ (root)` folder, then **Save**.
3. After about a minute the site is live at `https://sdrucker6637.github.io/workoutsite/`.
4. On your iPhone, open that URL in **Safari** → **Share** → **Add to Home Screen**.

Netlify Drop (drag the folder onto app.netlify.com/drop) and Cloudflare Pages also work and are free.

**Updating:** after changing files, bump `VERSION` in `sw.js` so installed copies fetch the new version.

> Data is stored per browser and per origin. The home-screen app and the Safari tab keep **separate** storage on iOS. Use Settings → Export / Import to move data between them, and export a backup now and then.

## Tests

```bash
node tests/engine.test.js                          # generator, intensity statistics over 3,200 workouts, progression, PRs, import/export (≈36k assertions)
node tests/programming.test.js                     # programming quality: 900 full-body workouts over 9 equipment setups, split coverage, order, supersets, intensity, volume, swaps, audit regressions, determinism (≈64k assertions)
node tools/audit-workouts.js                       # quality audit report (not pass/fail): sample across equipment/history/experience, variety, 8-week simulation — see docs/workout-quality-audit.md
python3 -m http.server 8765 & node tests/e2e.test.js   # full browser flow (needs Playwright)
node tests/features.test.js                         # exercise demonstrations + More options panel
node tests/settypes.test.js                         # drop sets, build-up sets, plain set types unchanged
node tests/nutrition.test.js                        # food parser, brands, ambiguity, library, estimates, trends, migration, backup
node tests/food.test.js                             # food tracker in the browser: logging, brands, lookup (mocked), favorites, dates, export/restore
```
The end-to-end test generates every workout type, swaps exercises, logs a full session, refreshes mid-workout, saves, and checks that the next session shows previous weights and an increase recommendation that is only applied on approval. It also checks the v1 → v2 data upgrade, intensity variety across repeated generations through the UI, the intensity picker, PR detection, the charts, export → wipe → import, persistence after refresh, the theme toggle and offline loading.

## Project layout

```
index.html            app shell
css/app.css           design system (dark/light), responsive layout
js/exercises.js       exercise database (185)
js/core.js            taxonomy, default profile, storage, import/export
js/engine.js          history queries, progression, exercise scoring, prescriptions, stats
js/programming.js     workout structure: movement classes, blueprints, coverage, order, supersets, intensity, quality score, swaps
js/charts.js          SVG line/bar charts + rings
js/ui.js              shell, router, sheets, toasts, rest timer
js/views-train.js     Home, Generate, Train (active workout)
js/views-data.js      Exercises, History, Progress, Settings
js/foods.js           bundled generic food reference (typical values per serving)
js/products.js        branded products with sources, serving sizes and status
js/nutrition.js       food parser, food-log store, trends, guidance
js/views-food.js      Food screen, review/edit sheets, My foods
tools/audit-workouts.js  workout quality audit (seeded sample, diagnostics, variety, history simulation)
docs/                 quality audit report and before/after outputs
fonts/                Inter (OFL) + license
sw.js, manifest.webmanifest, icons/   PWA
```
