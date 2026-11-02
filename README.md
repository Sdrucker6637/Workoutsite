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
- **Desktop:** a quiet sidebar with Home, Generate, Exercises, History, Progress, Food, Meal ideas, Achievements and Settings.
- **Phone:** a 5-tab bar (Home, Generate, History, Progress, Food). Exercises and Settings sit in the top bar; Meal ideas is linked from Food and Achievements from Progress.
- There is no separate Train tab: the active-workout screen opens when you start a workout and from Home's **Resume workout** (a dot on the Home tab shows one is in progress). Empty workouts and live run tracking are on Generate.

**Screens**
- **Home:** one focal panel with the recommendation (a strength type, a run day or a recovery day, with a short reason), **Record a run**, a 7-day strip with your last run and pace, a small "Protein today" card (can be turned off), the three most recent workouts, and a three-number summary of the last 30 days.
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
| **Randomized intensity** | There are four classes: **heavy** (5–8), **regular** (8–12), **burnout** (12–20+) and **standard** (the exercise's own recommendation, with no label). Each exercise is drawn *independently* from configurable odds (default 22 / 30 / 16 / 32). The odds are weighted by suitability: heavy leans toward compound lifts early in the session; burnout leans toward isolation work late in the session and never goes on spinal-loading lifts. An exercise can never get a class it isn't eligible for. There is no fixed formula, so 0 heavy, 3 heavy, all-regular and 2 + 2 are all possible. The only safety rails are a cap of half the session for heavy and a third for burnout; no minimums are forced. Tap any intensity label to change it. Settings can switch to fixed counts instead. |
| **Selection logic** | Slot templates per workout type (for example, full body = squat + chest press + back pull + hips + arms + core). Exercises are scored on goal emphasis (lower chest, arm size, obliques), priority muscles, favorites, weekly volume shortfall per muscle, fatigue from the last 48 hours, overlap within the workout, recency and difficulty. Heavy work goes to compound lifts, burnouts go to finishers, and supersets pair non-competing muscles. |
| **Active workout** | A set table with *previous*, weight, reps and ✓ columns. Blank fields fall back to last time's numbers. Supports per-set weights, adding/removing sets, skipping, replacing, reordering, notes and an effort rating. A rest timer starts on its own (with sound and vibration) and is superset-aware. |
| **Progressive overload** | Uses your recorded sets (double progression). For example, 30 lb × 10, 10, 9 gives "Maintain 30 lb — aim for 10, 10, 10". All sets at the top of the range → add weight (+5 lb upper-body dumbbell or +2.5 if you have micro-plates, +5–10 lb lower body, snapped to dumbbells you own). Within range → add reps. Missed reps once → hold; missed twice → drop about 10%. Long layoffs restart conservatively. Bodyweight lifts get more reps, added load or a harder variation. **Weights only change when you tap Apply.** Every recommendation explains why. |
| **Library** | 185 exercises, each with muscles, equipment, category, movement pattern, difficulty, sets, reps, rest, intensity class and a video link. Search, filters, favorites, exclusions, custom exercises and editing are supported. |
| **History** | Permanent log with every set. Open any workout, repeat it, use it as a template, edit notes or delete it. |
| **Progress** | Workouts, per-week average, sets and volume; a workouts-per-week chart; a consistency heatmap; per-exercise charts (est. 1RM, top weight, volume, reps); PRs; weekly volume per muscle group against targets. Everything is calculated from logged data only. |
| **Food & protein** | Type what you ate in plain words ("2 chicken breasts, a protein shake and 2 hot dogs"); each item is recognized and its protein estimated, with a live breakdown before you log. Edit name, amount and protein; delete entries; browse and edit any past day. Favorites and recent foods log with one tap, and your own saved foods are recognized when typed. A flexible daily target (default 150 g, ±10% counts as on target), friendly guidance, and 7/30-day trends that leave unlogged days out of averages. Calories, carbs and fat are optional secondary estimates. |
| **Record a run** | From Home: distance, duration (h/m/s), date, optional effort and notes, live average pace. Edit or delete from Home → All runs or from History. Saved in the same format as live-tracked runs. |
| **Meal ideas** | Pick ingredients you have (protein, carbohydrates, vegetables; search, staples, frequent picks, your own ingredients, “ran out” mode) and get several protein-forward recipes with approximate quantities, steps, times and estimated macros. Dietary needs, disliked ingredients, air fryer, servings and a time limit in Preferences. Save favorites, regenerate different ideas, log a serving to the food diary. Fully offline: bundled recipe templates, no API. |
| **Achievements** | 28 milestones across consistency, strength, running, variety and nutrition, computed from logged data with their real dates, progress bars for locked ones, and a small celebration (can be turned off, as can achievements). |
| **Data** | Export a JSON backup (workouts, runs, food log, meal planner and achievements), then import it to merge or fully restore. Erase all data. Storage is persisted between sessions. |

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

**Storage.** The food log lives in the same local store as workouts (`wt.data.v1`, now data version 6 — v6 only adds `meals`, `achievements` and `learn`) under `nutrition: { entries, foods }`, keyed by local date. Version 4 → 5 only adds fields (product brand / flavor / aliases / status / source, and each entry's confidence); workout data is untouched. Export includes the log and the library with aliases. *Replace* restores them exactly. *Merge* adds missing entries and products by id without duplicates.

## Recommendations (v6)

All calculations run on the device; nothing is sent anywhere.

- **What to do next** (`WT.suggestNext`): looks at the last 7 days — strength sessions and runs against your weekly goals, consecutive training days, muscles still recovering (48 h), weekly sets per muscle — and suggests a strength type, a run, or recovery. Push/pull/legs rotate by readiness rather than fixed order. A type you repeatedly pick over the suggestion (3+ of the last 8) is learned, and if your sessions consistently run short the plan is sized to fit.
- **Workout composition**: full-body plans balance coverage across the week — a squat / press / pull slot steps aside when those muscles are already at their weekly target or still recovering, and the slots for muscles that are behind move up. Short notes explain the plan (“Back is due for more weekly volume.”, “Your last session emphasized pushing movements…”).
- **Exercise choice**: adds movement-pattern recency, how often an exercise was done in the last 14 days, progress trend (rising estimated strength is kept in rotation), near-duplicate penalties, and learned skips/removals (needs 2+ misses before anything changes). Instead of always taking the top score it samples among near-best candidates.
- **Intensity**: heavy / regular / burnout / standard plus **drop** and **build-up** sets are drawn from configurable odds (Settings → Intensity; defaults 7 each). Build-up sets favour compound lifts early in the session; drop sets favour isolation (especially cable / machine) work near the end and never go on spinal-loading, explosive, free-weight squat / hinge / lunge or advanced compound lifts; burnouts are also kept off those loaded lifts. Caps per workout: drop and build-up at most one each and two together (7+ exercises), and all techniques together at most ~60% of the exercises. A pattern identical to your last two workouts of that type is redrawn. Fixed mode has drop / build-up counts too. Stage counts and sets can be edited in the plan before starting, and every stage is editable during the workout.
- **Weight progression**: weight goes up only when the top of the range is confirmed — the previous session at that weight was also at (or one rep from) the top, it was rated easy, or every set overshot by 3+ reps. Repeated Hard ratings hold the weight, a 3-week-old comparison becomes a check-in, a declining trend backs off, and a big relative dumbbell jump (>20%) asks for two extra reps first. The *Why* lists the recent sessions. Weights still change only when you tap Apply.

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
node tests/engine.test.js                          # generator, intensity statistics over 3,200 workouts, progression, PRs, import/export (≈37k assertions)
python3 -m http.server 8765 & node tests/e2e.test.js   # full browser flow (needs Playwright)
node tests/features.test.js                         # exercise demonstrations + More options panel
node tests/settypes.test.js                         # drop sets, build-up sets, plain set types unchanged
node tests/nutrition.test.js                        # food parser, brands, ambiguity, library, estimates, trends, migration, backup
node tests/food.test.js                             # food tracker in the browser: logging, brands, lookup (mocked), favorites, dates, export/restore
node tests/recommend.test.js                        # v6 recommendations: weekly balance, variety, drop/build-up assignment, caps, progression, learning, migration
node tests/meals.test.js                            # meal planner + achievements logic
node tests/v6.test.js                               # v6 in the browser: navigation, Record a run, Meal ideas, Achievements, settings, upgrade from v5
```
The end-to-end test generates every workout type, swaps exercises, logs a full session, refreshes mid-workout, saves, and checks that the next session shows previous weights and an increase recommendation that is only applied on approval. It also checks the v1 → v2 data upgrade, intensity variety across repeated generations through the UI, the intensity picker, PR detection, the charts, export → wipe → import, persistence after refresh, the theme toggle and offline loading.

## Project layout

```
index.html            app shell
css/app.css           design system (dark/light), responsive layout
js/exercises.js       exercise database (185)
js/core.js            taxonomy, default profile, storage, import/export
js/engine.js          history queries, progression, generator, stats
js/charts.js          SVG line/bar charts + rings
js/ui.js              shell, router, sheets, toasts, rest timer
js/views-train.js     Home, Generate, Train (active workout)
js/views-data.js      Exercises, History, Progress, Settings
js/foods.js           bundled generic food reference (typical values per serving)
js/products.js        branded products with sources, serving sizes and status
js/nutrition.js       food parser, food-log store, trends, guidance
js/views-food.js      Food screen, review/edit sheets, My foods
js/meals.js           ingredient catalog, bundled recipe templates, offline meal-idea generator
js/achievements.js    achievement definitions, evaluation and celebration
js/views-meals.js     Meal ideas and Achievements screens
fonts/                Inter (OFL) + license
sw.js, manifest.webmanifest, icons/   PWA
```
