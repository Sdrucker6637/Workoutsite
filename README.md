# Forge: Workout Generator & Tracker

A free, private, offline-first workout app. It generates workouts from your goals, equipment and recent training, tracks every set, and recommends progressive overload from your logged numbers.

- **No accounts, no servers, no paid APIs.** Your data lives in your browser's local storage.
- **Works offline** once it has loaded. YouTube videos are the only thing that needs a connection.
- **Installable on iPhone** as a home-screen app (a PWA).
- **No build step.** It is plain HTML, CSS and JavaScript. The charts and icons are written from scratch, so there are no external libraries or CDNs.

## Features

| Area | What it does |
| --- | --- |
| **Generator** | 13 workout types (Full Body, Push, Pull, Legs, Chest, Back, Shoulders, Arms, Biceps, Triceps, Core, Cardio, Custom multi-muscle). Settings for exercise count (or fit to time), duration, equipment, an auto or manual heavy/regular/burnout mix, supersets, priority muscles and muscles to avoid. Each exercise has Swap, Lock and Remove buttons. Regenerate keeps locked exercises, and you can add exercises by hand. |
| **Selection logic** | Slot templates per workout type (for example, full body = squat + chest press + back pull + hips + arms + core). Exercises are scored on goal emphasis (lower chest, arm size, obliques), priority muscles, favorites, weekly volume shortfall per muscle, fatigue from the last 48 hours, overlap within the workout, recency and difficulty. Heavy work goes to compound lifts, burnouts go to finishers, and supersets pair non-competing muscles. |
| **Active workout** | A set table with *previous*, weight, reps and ✓ columns. Blank fields fall back to last time's numbers. Supports per-set weights, adding/removing sets, skipping, replacing, reordering, notes and an effort rating. A rest timer starts on its own (with sound and vibration) and is superset-aware. |
| **Progressive overload** | Uses your recorded sets (double progression). All sets at the top of the range → add weight (+5 lb upper-body dumbbell or +2.5 if you have micro-plates, +5–10 lb lower body, snapped to dumbbells you own). Within range → add reps. Missed reps once → hold; missed twice → drop about 10%. Long layoffs restart conservatively. Bodyweight lifts get more reps, added load or a harder variation. **Weights only change when you tap Apply.** Every recommendation explains why. |
| **Library** | 185 exercises, each with muscles, equipment, category, movement pattern, difficulty, sets, reps, rest, intensity class and a video link. Search, filters, favorites, exclusions, custom exercises and editing are supported. |
| **History** | Permanent log with every set. Open any workout, repeat it, use it as a template, edit notes or delete it. |
| **Progress** | Workouts, per-week average, sets and volume; a workouts-per-week chart; a consistency heatmap; per-exercise charts (est. 1RM, top weight, volume, reps); PRs; weekly volume per muscle group against targets. Everything is calculated from logged data only. |
| **Data** | Export a JSON backup, then import it to merge or fully restore. Erase all data. Storage is persisted between sessions. |

### Your profile (pre-loaded, editable in Settings)
- **Goals:** lean out; lower-chest emphasis; bigger arms; obliques. Priority muscles are chest, biceps, triceps, abs and obliques.
- **Schedule:** 3 strength sessions + 2 runs per week. Full body preferred. Supersets on, burnouts on.
- **Equipment:** dumbbells 5–60 lb, bench, cable machine, lat pulldown, seated row, medicine ball, bodyweight and a pull-up bar. The pull-up bar is included because you want to keep improving pull-ups; untick it if you don't have one. There is no EZ bar and no cable ankle strap.
- **Restrictions:** no conventional deadlifts, no Romanian deadlifts (including DB and single-leg), no reverse-grip dumbbell pressing.
- **Favorites:** Sissy Squat and Pull-Up. The generator prefers them.

### About the videos
No video IDs are hard-coded, because they can't be checked offline and they break over time. Each exercise opens a **YouTube search** for that exercise's form tutorial. If you find a video you like, paste its link into the exercise (Library → exercise → paste link, or Edit). After that it **plays embedded** inside the app.

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
node tests/engine.test.js                          # generator, progression, PRs, import/export (≈11.9k assertions)
python3 -m http.server 8765 & node tests/e2e.test.js   # full browser flow (needs Playwright)
```
The end-to-end test generates every workout type, swaps exercises, logs a full session, refreshes mid-workout, saves, and checks that the next session shows previous weights and an increase recommendation that is only applied on approval. It also checks PR detection, the charts, export → wipe → import, persistence after refresh, the theme toggle and offline loading.

## Project layout

```
index.html            app shell
css/app.css           design system (dark/light), responsive layout
js/exercises.js       exercise database (185)
js/core.js            taxonomy, default profile, storage, import/export
js/engine.js          history queries, progression, generator, stats
js/charts.js          SVG line/bar charts + rings
js/ui.js              shell, router, sheets, toasts, rest timer
js/views-train.js     Dashboard, Generate, Active Workout
js/views-data.js      Library, History, Progress, Settings
sw.js, manifest.webmanifest, icons/   PWA
```
