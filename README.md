# Forge

A free, private, offline-first fitness app. It generates workouts from your goals, equipment and recent training, tracks every set and run, and recommends progressive overload from your logged numbers. A food diary turns plain sentences (“Chipotle chicken bowl with rice, beans and guac”) into calories and macros. A Progress dashboard covers strength, cardio, consistency, nutrition and body composition, and explains trends from your own data.

- **No accounts, no servers, no paid APIs.** Your data lives in your browser's local storage. Online food lookup (USDA FoodData Central and Open Food Facts, both free) is optional.
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
- **Home:** one focal panel with the recommendation (a strength type, a run day or a recovery day, with a short reason) and **Record a run**; four shortcuts (Log food, Start workout, Record run, Log weight); today's calories and protein; a 7-day strip with your last run and pace; your latest run; one insight with a three-number summary of the last 30 days; and recent workouts.
- **Generate:**
  - Type chips plus two options (exercise count and duration); everything else sits under *More options*.
  - The plan is a single list. Each row shows the name, muscle, sets × reps, the suggested weight from your history and a subtle intensity marker, with video, swap and more buttons.
- **Train:**
  - Navigation hides and the screen focuses on the current exercise.
  - Completed sets show as a short checklist.
  - A large editor has −/+ weight and rep controls. Weight steps to the next dumbbell you own; values are pre-filled from your last session.
  - One "Complete set" tap logs the set and starts the rest timer. Supersets alternate automatically.
- **Progress:** a period filter (7 days to all time) and six tabs: Overview (insights + one card per area), Strength (the per-exercise charts, PRs and weekly sets per muscle are kept, plus an overall summary), Cardio, Consistency, Nutrition and Body. Each tab without data shows an empty state that says what to track.
- **Food:** a daily diary (Breakfast, Lunch, Dinner, Snacks) under a calories ring and protein/carbs/fat bars, a plain-language log box with a meal picker, Quick add (saved meals, usual combinations, favorites, frequent, recent) and a Trends tab.

## Features

| Area | What it does |
| --- | --- |
| **Generator** | 13 workout types (Full Body, Push, Pull, Legs, Chest, Back, Shoulders, Arms, Biceps, Triceps, Core, Cardio, Custom multi-muscle). Settings for exercise count (or fit to time), duration, equipment, supersets, priority muscles and muscles to avoid. Each exercise has Swap, Lock and Remove buttons. Regenerate keeps locked exercises, "Re-roll intensities" keeps the exercises and re-draws their intensities, and you can add exercises by hand. |
| **Randomized intensity** | There are four classes: **heavy** (5–8), **regular** (8–12), **burnout** (12–20+) and **standard** (the exercise's own recommendation, with no label). Each exercise is drawn *independently* from configurable odds (default 22 / 30 / 16 / 32). The odds are weighted by suitability: heavy leans toward compound lifts early in the session; burnout leans toward isolation work late in the session and never goes on spinal-loading lifts. An exercise can never get a class it isn't eligible for. There is no fixed formula, so 0 heavy, 3 heavy, all-regular and 2 + 2 are all possible. The only safety rails are a cap of half the session for heavy and a third for burnout; no minimums are forced. Tap any intensity label to change it. Settings can switch to fixed counts instead. |
| **Selection logic** | Slot templates per workout type (for example, full body = squat + chest press + back pull + hips + arms + core). Exercises are scored on goal emphasis (lower chest, arm size, obliques), priority muscles, favorites, weekly volume shortfall per muscle, fatigue from the last 48 hours, overlap within the workout, recency and difficulty. Heavy work goes to compound lifts, burnouts go to finishers, and supersets pair non-competing muscles. |
| **Active workout** | A set table with *previous*, weight, reps and ✓ columns. Blank fields fall back to last time's numbers. Supports per-set weights, adding/removing sets, skipping, replacing, reordering, notes and an effort rating. A rest timer starts on its own (with sound and vibration) and is superset-aware. |
| **Progressive overload** | Uses your recorded sets (double progression). For example, 30 lb × 10, 10, 9 gives "Maintain 30 lb — aim for 10, 10, 10". All sets at the top of the range → add weight (+5 lb upper-body dumbbell or +2.5 if you have micro-plates, +5–10 lb lower body, snapped to dumbbells you own). Within range → add reps. Missed reps once → hold; missed twice → drop about 10%. Long layoffs restart conservatively. Bodyweight lifts get more reps, added load or a harder variation. **Weights only change when you tap Apply.** Every recommendation explains why. |
| **Library** | 244 exercises (90 need no equipment at all), each with muscles, equipment, category, movement pattern, difficulty, sets, reps, rest, intensity class and a video link. Search, filters, favorites, exclusions, custom exercises and editing are supported. |
| **Plan customisation** | Before you start: drag any exercise (or a whole superset) by its handle to reorder — or focus the handle and use the arrow keys, or *Move up / down* in the row menu. Tap a *Superset* label to separate it (each exercise keeps its sets, reps and intensity and gets its own rest back) or swap who goes first; *Superset with…* pairs any two exercises by hand. Your order and supersets carry into the workout, history and *Repeat*; re-rolling intensities keeps them. |
| **Bodyweight & variations** | *Equipment → None* on Generate builds a workout that needs only your body and the floor (no bar, bench, wall, towel or band). Exercises have **modifications** (same exercise: knee, reduced-range, slow-negative, knuckle, tempo…) and **progressions** (the next exercise down or up, e.g. Push-Up → Archer → One-Arm). Pick either from the variation tag or the row menu, before or during a workout. The variation is shown on the plan, the workout and history, kept on Repeat, and tracked separately for progression — with “top of range on knee push-ups → try the next variation”. Beginners start on an easier modification of harder exercises; nobody is moved to an advanced one unprompted. |
| **Learns from your notes** | Notes on exercises (during a workout or from an exercise's detail sheet) and workout notes are read locally — no AI service — and shape future plans. “Push-ups are tough on my wrists” → wrist-loading moves are left out and **one** wrist-friendly modification (e.g. push-ups on knuckles) is offered per workout as a labelled *trial*; after its last set Forge asks how your wrists felt. *Fine* makes it a regular option (also for related push-ups, at most two per workout); *Not good* rules it out. You can also mark modifications as working or not in the variation sheet, or say so in a note (“knuckle push-ups are fine on my wrists”). Other joints work the same way, except that only demanding exercises (advanced, jumping) are left out — partial-range squats are the knee trial. Substitutes come from the same slot, so muscle coverage stays. “Too hard” / “too easy” → one step easier / harder variation (or the neighbouring progression). “Love these” → chosen more; “hate lunges” → not suggested. Temporary notes (“knee a bit sore today”) fade in about a week; ongoing ones (“always”, “old injury”) last; a later note (“wrists feel fine now”) overrides an earlier one. The plan lists every adjustment; *Settings → Learned from notes* shows what Forge has learned and lets you forget any of it. |
| **History** | Permanent log with every set. Open any workout, repeat it, use it as a template, edit notes or delete it. |
| **Progress** | Every number follows the selected period (7d / 30d / 90d / 6m / 1y / all). **Strength:** exercises improving vs declining and median change (first vs last sessions in the period), plus per-exercise charts (est. 1RM, top weight, volume, reps), PRs, and weekly sets per muscle group against targets. **Cardio:** distance, runs, time, average pace, distance per week or month, pace over time, longest run, fastest pace, other cardio. **Consistency:** workouts, per week, week streak and longest streak, per-week and per-month charts, volume, muscle-group frequency and a training calendar. **Nutrition:** average calories and macros on logged days, days near the protein target. **Body:** weight trend (least-squares per week), measurements, progress photos. Everything is calculated from logged data only. |
| **Insights** | Deterministic rules (`js/analytics.js`) that compare this period with the one before. Each rule has a minimum amount of data: 2+ sessions per exercise, 2+ runs in each period, 5+ logged food days, 3+ weigh-ins over 14 days, and the previous period at least ¾ tracked. They cover workout count, strength by region, muscle-group balance (e.g. lower-body sets falling), run distance and pace, protein and calories vs target, and weight trend. Each comes with an action where one makes sense. Without enough data you get an explanation, not a guess. No AI service is used. |
| **Body** | Optional weigh-ins (lb/kg, one per day), body fat, waist/chest/arm/hips/thigh/neck or custom measurements, and progress photos. Photos are downscaled and kept in IndexedDB on the device; they are never uploaded and not included in backups. |
| **Food diary** | Calories, protein, carbs and fat against your targets. You set calories and protein; carbs and fat follow from them unless you set them too, and nothing is assumed when a target isn't set. Entries are grouped by meal. You can edit, delete, move between meals and days, duplicate a meal to another day, save meals, and browse any date. See *Food diary & natural-language logging* below. |
| **Food (original protein tracker)** | Type what you ate in plain words ("2 chicken breasts, a protein shake and 2 hot dogs"); each item is recognized and its protein estimated, with a live breakdown before you log. Edit name, amount and protein; delete entries; browse and edit any past day. Favorites and recent foods log with one tap, and your own saved foods are recognized when typed. A flexible daily target (default 150 g, ±10% counts as on target), friendly guidance, and 7/30-day trends that leave unlogged days out of averages. Calories, carbs and fat are optional secondary estimates. |
| **Record a run** | From Home: distance, duration (h/m/s), date, optional effort and notes, live average pace. Edit or delete from Home → All runs or from History. Saved in the same format as live-tracked runs. |
| **Meal ideas** | Your kitchen of ingredients (proteins, carbs, vegetables, fruits, dairy, other) — each a data object with a serving size and nutrition, estimated automatically when you add it. Recipes are composed offline from dish formats × flavor profiles × your ingredients, with quantities, steps, and calories / protein / carbs / fat calculated from the amounts used. Save, rescale, swap one idea, and log a serving to the food diary with its calculated totals. See *Meal ideas* below. |
| **Achievements** | 28 milestones across consistency, strength, running, variety and nutrition, computed from logged data with their real dates, progress bars for locked ones, and a small celebration (can be turned off, as can achievements). |
| **Data** | Export a JSON backup (workouts, runs, food log, saved meals, body records, meal planner and achievements), then import it to merge or fully restore. Erase all data. Storage is persisted between sessions. |

### Your profile (pre-loaded, editable in Settings)
- **Goals:** lean out; lower-chest emphasis; bigger arms; obliques. Priority muscles are chest, biceps, triceps, abs and obliques.
- **Schedule:** 3 strength sessions + 2 runs per week. Full body preferred. Supersets on, burnouts on.
- **Equipment:** dumbbells 5–60 lb, bench, cable machine, lat pulldown, seated row, medicine ball, bodyweight and a pull-up bar. The pull-up bar is included because you want to keep improving pull-ups; untick it if you don't have one. There is no EZ bar and no cable ankle strap.
- **Restrictions:** no conventional deadlifts, no Romanian deadlifts (including DB and single-leg), no reverse-grip dumbbell pressing.
- **Favorites:** Sissy Squat and Pull-Up. The generator prefers them.

### Exercise demonstrations
185 of the 244 built-in exercises show a demonstration (16 bodyweight exercises and Medicine Ball Russian Twist were added later from the same Workout Guide package; the push-up's knee variation has its own drawing) in the plan, the active workout, the library, exercise details and when swapping. Each one was matched to its exercise by hand and checked visually. Exercises without an exact match show a placeholder. The demonstrations come from four licensed sources, each bundled under `media/` with its license text and attribution:

| Source | License | Exercises |
|---|---|---|
| [Everkinetic](https://github.com/everkinetic/data) (Greg Priday & contributors) | CC BY-SA 4.0 | 75 |
| [Workout Guide](https://github.com/bryllim/workout-guide) (Bryl Lim, partly adapted from Everkinetic) | CC BY-SA 4.0 | 79 |
| [Open Exercise Illustrations](https://github.com/hitmanrepo/open-exercise-illustrations) (AI-generated, each frame reviewed) | CC0 1.0 | 22 |
| [RepDB free dataset](https://github.com/RepDB/exercise-dataset) (AI-generated, each frame reviewed) | RepDB Free Tier License: in-app use with attribution; not for reuse outside Forge | 9 |

Exercise data by [RepDB](https://repdb.co).

Single-pose references are labelled "Still image". Attribution appears under every large demonstration and in Settings → About. Frames load lazily, play only while on screen, and are cached by the service worker so they work offline. See `media/README.md` for the sources, the sources that were rejected and why, and the exercises that still have no match.

### About the videos
No video IDs are hard-coded, because they can't be checked offline and they break over time. Each exercise opens a **YouTube search** for that exercise's form tutorial. If you find a video you like, paste its link into the exercise (Library → exercise → paste link, or Edit). After that it **plays embedded** inside the app.

## Food diary & natural-language logging

Type a meal the way you'd say it. Forge splits it into items, recognizes brands, restaurant items and preparations, reads quantities ("a handful", "two slices", "half a jar", "a medium potato", "150 g"), and shows calories, protein, carbs and fat for each item before anything is saved.

**Matching priority** (`js/nutrition.js`, deterministic and offline):
1. A correction you made before.
2. An exact branded product, or one of your foods.
3. A restaurant menu item. A chain named once applies to the rest of the sentence, so in "Chipotle chicken bowl with white rice, black beans…" the rice is Chipotle's 4 oz portion.
4. A homemade recipe, broken into editable components.
5. A generic food with the right preparation.
6. Unknown, which gets suggestions and is never given numbers.

**Quick log or review.** One or two confident items log in one tap. Anything else opens the review screen. That includes multi-part meals, rough estimates, unknown items and ambiguous brands. On the review screen you can:
- change amounts with −/+ and switch units (the amount stays equivalent: 1 cup of rice becomes 158 g);
- **Replace** an item by searching your foods, branded products, restaurant menus and USDA foods;
- remove items or add missing ones;
- correct the values;
- pick the meal and save the whole thing as a meal.

Totals update live.

**Two separate labels on every item:**
- *Where the numbers come from:* **Verified** (checked on the manufacturer's page), **Reference data** (USDA FoodData Central or the chain's published nutrition, transcribed), **Confirmed by you**, or **Estimate**.
- *How well it matched what you typed:* **Exact match**, **Close match** or **Rough estimate**.

Amounts Forge had to assume are marked "(assumed)". Macros missing from a product label are filled only from a clearly labelled estimate (Barilla Protein+ calories, for example).

**It learns from you.** A match you replace is remembered for the same words ("lunch bowl" → Chipotle chicken). An amount you change becomes your usual amount when you don't type one. Products you log are saved to *My foods*, and frequent foods and meals you repeat show up in Quick add. Similar dishes stay distinct: a chicken Caesar wrap, a grilled chicken Caesar salad and a crispy chicken Caesar sandwich each break down differently.

### Branded products: brands, lines, variants, flavors, sizes

`js/brands.js` is a catalog of 66 brands and 232 product lines. It holds no nutrition. It records each line's identifying phrases, variants, flavors and package sizes, and which lines have bundled label data. The matcher uses it so a product is picked only when what you typed identifies it:
- “Barilla chickpea pasta” is never Protein+.
- “Oscar Mayer turkey bacon” is never deli turkey.
- “Fage triple zero” is never Oikos.
- “a 32 oz jar of Rao’s” is read by net weight.
- A flavor keeps only the values its source confirms.

When a brand is recognized but the exact product isn’t, Forge asks. It lists your products, products with labels, and the brand’s other lines (*No label saved yet*), with search online, enter from the label, or a labelled generic estimate. Your saved products keep their brand, line, flavor, barcode and package size, and are found by name afterwards. See [`docs/BRANDED_MATCHING_AUDIT.md`](docs/BRANDED_MATCHING_AUDIT.md) for the audit, the rules and the before/after results; `tests/brands.test.js` checks it with about 1,700 assertions generated from the catalog.

### Branded grocery labels (Phase 4)

`js/products.js` now holds 75 product labels: 52 added in this phase and 3 corrected (Barilla Protein+, Rao’s Marinara, Oscar Mayer Oven Roasted Turkey), covering protein shakes and bars, yogurt, bread and bagels, deli meat, pasta, pasta sauce, breakfast, dairy and spreads. Each flavor with its own label is a separate product (Oikos Triple Zero Vanilla / Mixed Berry / Strawberry / Peach; Quest Cookie Dough / Cookies & Cream / Birthday Cake / Brownie). Every product records:
- brand, product line, flavor, serving size and serving weight, and calories, protein, carbs and fat. A value no source showed is `null` and shown as *not listed*, never 0 and never guessed;
- the package (net weight and label servings per package), so “half a jar”, “a loaf” and “the whole bag” are read from the package;
- the barcode printed in a retailer or Open Food Facts listing (36 products; every code passes the GS1 check digit). Scanning one opens the bundled label, offline;
- its evidence: **Verified** only when every value is on a manufacturer page, **Reference data** when two or more retailer labels agree, **Estimate** when the sources disagree or only one was found. The note says which;
- its source link and the date it was checked.

With several flavor products in one line and no flavor named, Forge uses the line’s first product, says the flavor wasn’t given, and marks it *Close*. Lines whose flavors have materially different labels (Quest bars) ask instead.

**Your product library.** Every product you confirm or enter is saved to *My foods* with brand, product, line, flavor, serving, package size (net weight and servings), nutrition, barcode, source and the date you last checked it against the label. You can edit all of these. A label you saved for a product comes before the bundled one, and your foods are listed first in search.

**Online results** (USDA and Open Food Facts) are ranked by how well they fit what you searched. Tags show *Barcode match*, *Brand matches*, *Same product line* and *Flavor matches*, and warn on *Different brand*, *Different product*, *Different flavor* or a different package size. Each result shows its serving size, its source and every macro, with *not listed* for missing values. An *Enter from the label* row is always offered below the results.

**Coverage report.** Settings → Nutrition → *Branded coverage* shows how many branded products have complete, partial or no labels on this device, including your own labels, the barcodes, the evidence mix, and the most important missing products. `node tools/coverage.js --write` writes the same numbers, with a before/after comparison, to [`docs/NUTRITION_COVERAGE.md`](docs/NUTRITION_COVERAGE.md). `tests/grocery.test.js` checks the named searches (Oikos Triple Zero, Pioneer Pastures, Barilla Protein+, Dave’s Killer Bread, Oscar Mayer turkey, Rao’s, Quest bars, fairlife milk) and many more against their label values and serving sizes.

### Search, online lookup and barcode scanning

**Search foods** (under the log box) searches, instantly and offline:
- your foods and saved products;
- bundled branded products;
- restaurant menus;
- USDA-based foods;
- foods found online before.

Naming a brand or a restaurant lists its products first: “Oikos” shows Oikos’s yogurts, “Barilla Protein+” shows the product rather than plain pasta, “chipotle” shows the menu, and “rotisserie chicken” separates breast and thigh, with and without skin. **Search online** adds live results from two services (`js/lookup.js`):

| Service | Used for | Key | Status shown |
|---|---|---|---|
| [USDA FoodData Central](https://fdc.nal.usda.gov) API (`/fdc/v1/foods/search`) | Generic reference foods (Foundation, SR Legacy, FNDDS) and USDA Branded label data | api.data.gov key. Forge ships none; it uses the public `DEMO_KEY` (about 30 requests an hour) unless you paste your own free key in Settings → Nutrition. Your key stays in this browser and is stripped from exported backups. | **Reference data** |
| [Open Food Facts](https://world.openfoodfacts.org) (`/api/v2/product/{barcode}`, Search-a-licious text search with the classic `/cgi/search.pl` as fallback) | Branded grocery products and barcodes | None | **Estimate** (community data; check it against your label) |

- Search goes online by itself only when this device has little to offer; otherwise you tap the button. That saves the free quotas.
- **Results are cached** on the device (`wt.foodcache.v1`, up to 600 foods, separate from your data and backups), so a search or barcode that worked once works offline.
- **Failures never break logging.** Offline, rate limits (HTTP 429), a rejected key, a busy service or a timeout each produce a one-line message, and local results stay on screen. If Search-a-licious fails, the classic search endpoint is tried.
- **Missing values stay missing.** The only conversion is kJ → kcal.
- A branded product you log is saved to *My foods* with its barcode and source. Generic USDA foods stay in the cache instead.
- Online lookup can be turned off in Settings.

**Scan barcode** opens the camera. It decodes with the browser’s `BarcodeDetector` where available (Chrome on Android); elsewhere, including iOS Safari, it uses the bundled ZXing decoder (`js/vendor/`, Apache-2.0), loaded only when you scan.
- Only EAN-13, EAN-8, UPC-A and UPC-E codes with a valid check digit are accepted, and ZXing needs two matching reads.
- Lookup order: your foods → Forge’s bundled products (by printed barcode) → cache → Open Food Facts → USDA Branded (by UPC).
- The product appears with its source, status, per-serving and per-100 g values; *Add to diary* opens the review screen.
- **Not found:** you can search by name, or *enter it from the label*. That saves it with its barcode, so the next scan finds it instantly, even offline. Forge never substitutes a generic food.
- You can always type the barcode digits instead.
- If camera permission is denied, the camera is missing or busy, or the page isn’t HTTPS, you get a specific explanation, and manual entry stays available.

**Offline USDA database (optional).** `tools/build-usda.js` converts FoodData Central’s free bulk downloads (SR Legacy, about 7,800 foods, and Foundation Foods) into `js/data/usda.json`. Forge then searches those foods offline as “USDA reference (offline)”. The repository ships the file empty, because this build environment couldn’t download the datasets. Run `node tools/build-usda.js <downloaded JSON files>` and commit the result. The converter is tested against fixtures in the official format.

### Accuracy audit

`node tests/accuracy.test.js --report` checks 169 realistic descriptions and writes [`docs/FOOD_ACCURACY_REPORT.md`](docs/FOOD_ACCURACY_REPORT.md). The descriptions cover branded products, fast food, restaurant meals, homemade dishes, generic ingredients, portions, sauces, ambiguous inputs, look-alike dishes, typos, and inputs that must not be fabricated. Each case checks the food, brand, portion, calories (calculated by hand) and the confidence label that should be shown. Every item’s calories are also recomputed from the source data. Current result: 0 failures and 0 calculation errors (see the report for the breakdown). The report also lists the issues the audit found and how they were fixed.

### Food database

| Source | File | What | Status |
|---|---|---|---|
| USDA FoodData Central (SR Legacy / FNDDS) | `js/fooddb.js` | ≈90 generic foods, entered per 100 g with typical portions and named sizes. They cover distinct preparations: chicken breast/thigh/drumstick (raw, cooked, with or without skin, rotisserie), ground beef 80/85/90/93/95 (cooked and raw), white/brown rice (cooked and dry), pasta (cooked, dry, whole wheat), russet/red/sweet/mashed/roasted potatoes, black/pinto/kidney/white/refried/baked beans, eggs (boiled, scrambled, fried), milk by fat level, fruit, vegetables, oils, sauces | Reference data |
| Homemade recipes | `js/fooddb.js` | 21 dishes (Caesar wrap/salad/sandwich, stir-fries, spaghetti with meat sauce, burrito bowl, smoothie…) as component breakdowns | Estimate |
| Restaurant menus | `js/restaurants.js` | Chipotle (every component, plus bowl/burrito/tacos/salad builds), McDonald's, Chick-fil-A, Taco Bell, Subway, Shake Shack, Panera. Sizes, nugget counts, 6-inch vs footlong, Panera cup vs bowl; `extra`, `double` and `light` portions | Chipotle, McDonald's, Chick-fil-A and Taco Bell core items: Reference data. Subway, Panera and Shake Shack: Estimate |
| Branded products | `js/products.js` | 75 labels: 14 verified against manufacturer pages, 34 reference (agreeing retailer labels), 27 estimates (sources disagree, or a single source). Checked 2026-11-02 and 2026-11-22 | Verified, Reference data or Estimate |
| The original generic table | `js/foods.js` | ≈100 everyday foods, sandwiches and drinks | Estimate |
| Open Food Facts (optional, online) | `js/nutrition.js` | Label lookup from *My foods → Find product* | Estimate until you confirm it |

The bundled USDA and restaurant values were **transcribed**. This build environment had no network access to FoodData Central or the chains' sites, so they could not be re-imported or re-checked automatically. They are labelled accordingly, and any correction you make is saved as yours. `tests/overhaul.test.js` checks each food's calories against its macros (4/4/9 kcal per gram, within tolerance) and checks that no alias points to two foods.

## Food & protein tracker (original)

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

**Storage.** Everything lives in one local store (`wt.data.v1`, **data version 7**):
- `nutrition: { entries, foods, meals, learned, portions }` — the food diary, your products, saved meals, learned matches and usual portions;
- `body: { weights, measures, photos }`;
- `meals` (the meal planner's kitchen and recipes), `achievements` and `learn` (recommendation learning, exercise notes and trials);
- profile fields `calorieTarget`, `carbTarget`, `fatTarget` (null means not set), `bodyUnit`, `lengthUnit`, `achievements`, `achCelebrate` and `adaptive`.

Every migration has been additive and runs on every load, so data saved by any earlier build upgrades cleanly:
- 4 → 5 added product fields and confidence.
- 5 → 6 gave each entry a `meal` and a `group`, added saved meals, learned matches, usual portions and body tracking, and added the `meals`, `achievements` and `learn` stores.
- 6 → 7 made walls, towels and foot anchors explicit equipment (kept for everyone who had them) and added note learning to `learn`.

Workout history is never rewritten. Export includes all of it except photo images. *Replace* restores exactly. *Merge* adds missing entries, products, meals, body records, planner items and achievements without duplicates.

## Meal ideas

Everything runs on the device: no recipe service, no AI service, no account.

**Ingredients** (`js/ingredients.js`). 123 built-in ingredients (with about 450 alternative names) plus 46 pantry items, each with a category, a cooking role, a familiar default serving (one chicken breast ≈ 6 oz raw, one medium potato, 1 cup cooked rice, 4 oz shrimp…) marked raw / cooked / dry / as sold, and nutrition per 100 g (calories, protein, carbs, fat, fiber, sugar) from rounded typical (USDA-style) values. Assumptions are stated (ground beef = 90% lean; farmed salmon; precooked turkey kielbasa).

**Automatic estimates.** Adding an ingredient never needs numbers: (1) a branded product already in the product table uses its recorded label values; (2) an exact name or alias match uses that ingredient; (3) otherwise the closest generic ingredient in the name is used ("Butterball turkey kielbasa" → typical turkey kielbasa, labelled as not brand-specific); (4) keyword classes cover the rest ("halibut" → lean white fish); (5) a rough, clearly labelled category default as the last resort — never zero. Label values you enter replace the estimate for those fields and are marked as yours; changing only the serving size scales the nutrition. Corrections to built-ins are stored separately and can be reset. Custom ingredients also appear in the food diary's My foods, and My foods can be added to the kitchen.

**Recipes** (`js/meals.js`). 20 dish formats (skillet, hash, stir-fry, fried rice, bowl, pasta, noodles, sheet pan, air fryer, soup, stew/curry, salad, tacos & wraps, quesadillas, scramble, frittata, stuffed potatoes, melts, yogurt bowls, protein oats) × 26 flavor profiles (Cajun, smoky paprika, BBQ, chili-lime, chipotle-honey, Korean-style, teriyaki, garlic-ginger, Thai-style peanut, lemon-herb, Greek, Tuscan garlic, marinara, pesto, coconut curry, jerk, honey-mustard, Buffalo, Moroccan, lemon-pepper, miso-ginger, garlic-butter, Southwest, herb-and-garlic, two breakfast profiles). Each ingredient cooks according to its own profile (precooked sausage is crisped, shrimp 3–4 minutes, chicken to 165°F…). Candidates are scored for protein, how many of your ingredients they use, flavor pairing, time, style preferences and recent repeats; four are chosen with different dish types and flavors, and "Different ideas" moves away from the ones shown.

**Integrity.** Every step is written through a builder that records each ingredient it mentions; a recipe is kept only if everything listed is used and everything used is listed, and a second pass scans the finished text for any other ingredient name (plus oil and salt). Pantry additions (oil, salt and pepper, spices, sauces) are listed with amounts and counted in the nutrition; optional garnishes are listed separately and not counted.

**Nutrition** per serving = Σ (amount used ÷ serving) × that ingredient's values, using your corrections. Shown as ≈ calories to the nearest 10 and whole grams, with a per-ingredient breakdown. Logging a serving sends those totals to the food diary, labelled as an estimate unless every ingredient uses your own or verified values.

**Preferences.** Diets (vegetarian, pescatarian, dairy-, gluten-, egg-, soy-, nut-free, no shellfish, no pork, lower carb), an avoid list (pre-set to corn, cornstarch and flour; cornstarch is replaced by potato starch, soy sauce by tamari), prioritize protein, everyday ingredients, air fryer, servings, time limit; optional meal type and styles (quick & easy, high protein, adventurous, minimal cleanup, one-pan, air fryer).

## Recommendations (v6)

All calculations run on the device; nothing is sent anywhere.

- **What to do next** (`WT.suggestNext`): looks at the last 7 days — strength sessions and runs against your weekly goals, consecutive training days, muscles still recovering (48 h), weekly sets per muscle — and suggests a strength type, a run, or recovery. Push/pull/legs rotate by readiness rather than fixed order. A type you repeatedly pick over the suggestion (3+ of the last 8) is learned, and if your sessions consistently run short the plan is sized to fit.
- **Workout composition**: full-body plans balance coverage across the week — a squat / press / pull slot steps aside when those muscles are already at their weekly target or still recovering, and the slots for muscles that are behind move up. Short notes explain the plan (“Back is due for more weekly volume.”, “Your last session emphasized pushing movements…”).
- **Exercise choice**: adds movement-pattern recency, how often an exercise was done in the last 14 days, progress trend (rising estimated strength is kept in rotation), near-duplicate penalties, and learned skips/removals (needs 2+ misses before anything changes). Instead of always taking the top score it samples among near-best candidates.
- **Intensity**: heavy / regular / burnout / standard plus **drop** and **build-up** sets are drawn from configurable odds (Settings → Intensity; defaults 7 each). Build-up sets favour compound lifts early in the session; drop sets favour isolation (especially cable / machine) work near the end and never go on spinal-loading, explosive, free-weight squat / hinge / lunge or advanced compound lifts; burnouts are also kept off those loaded lifts. Caps per workout: drop and build-up at most one each and two together (7+ exercises), and all techniques together at most ~60% of the exercises. Because suitability and these caps apply after the odds, the share you see is lower than the slider's percentage (default 7 → about 3–4% of exercises; one appears in roughly a fifth to a third of workouts depending on length); 0 always means never. A pattern identical to your last two workouts of that type is redrawn. Fixed mode has drop / build-up counts too. Stage counts and sets can be edited in the plan before starting, and every stage is editable during the workout.
- **Weight progression**: weight goes up only when the top of the range is confirmed — the previous session at that weight was also at (or one rep from) the top, it was rated easy, or every set overshot by 3+ reps. Repeated Hard ratings hold the weight, a 3-week-old comparison becomes a check-in, a declining trend backs off, and a big relative dumbbell jump (>20%) asks for two extra reps first. The *Why* lists the recent sessions. Weights still change only when you tap Apply.

## Bodyweight library

Everything tagged *No equipment* needs only your body and the floor. Exercises that need a wall (wall sit, wall handstand push-up), a towel or sliders (slider curls) or a foot anchor (Nordic curls) list that as equipment, so they never appear in a no-equipment plan. Existing profiles keep those three items ticked on upgrade.

The 59 added exercises were checked against r/bodyweightfitness progressions, GMB / Breaking Muscle squat ladders, ACE Fitness (prone Y-T-W series) and coaching write-ups of the Hindu, dive bomber, sphinx and tiger-bend push-ups. The primary muscle is the one that limits the set: pseudo-planche push-ups and planche leans are front-delt primary, sphinx and tiger-bend push-ups triceps primary, with chest secondary.

| Group | Added (all equipment-free) |
| --- | --- |
| Chest (12) | Push-up bottom hold (isometric at the stretched position); close-grip, staggered-hand, typewriter, one-arm, Hindu, dive bomber, explosive and clap push-ups; Spiderman and T push-ups; palm-press chest squeeze (isometric adduction — the no-equipment “fly”) |
| Shoulders (7) | Pseudo-planche push-up, planche lean, dolphin push-up, pike shoulder tap, prone Y-T-W raise, freestanding handstand hold and push-up (skills, de-prioritised unless you're advanced) |
| Back (6) | Superman raise, prone swimmers, reverse snow angel, prone floor pulldown, back widow, reverse plank |
| Arms (5) | Sphinx and tiger-bend push-ups, floor (crab) dip, self-resisted curl, leg-resisted curl |
| Legs (16) | Bodyweight squat, split squat, forward / reverse / walking / curtsy / jump lunges, shrimp and pistol squats, calf raise, frog pump, donkey kick, side-lying abduction and adduction, bridge walkout, broad jump |
| Core (10) | V-up, flutter kicks, windshield wipers, hollow rock, bodyweight Russian twist, side-plank hip dip, bear plank, plank shoulder tap, floor L-sit, sit-up |
| Conditioning (3) | Tuck jump, plank jack, crab walk |

Instructions, modifications and progressions were also added to the existing bodyweight exercises (push-up, wide and diamond push-ups, pike push-up, planks, bridges, leg raises…). **Limits:** without anything to pull on, back training is extension, scapular and isometric work — no floor exercise replaces rows or pull-ups. Bodyweight biceps work is self-resisted and light. There is no honest floor-only side-delt exercise. Uneven push-ups need an object under one hand, so the staggered-hand push-up is the floor version.

**Chest diversity, honestly:** without equipment, chest training is horizontal pressing plus isometrics. The library covers the distinct stimuli that exist — bilateral and close-grip pressing, unilateral loading (staggered, archer, typewriter, one-arm), arcing presses (Hindu, dive bomber), power (explosive, clap — at most one per session), anti-rotation (T, Spiderman), lengthened isometric (bottom hold) and isometric adduction (palm press) — but most are push-up family movements, and Forge doesn't pretend otherwise.

**How much bodyweight work?** There is no fixed share. A no-equipment exercise is chosen freely when nothing you own does the same job (same muscle and movement), for core and conditioning, and when it's hard enough for you. It steps back only when an equivalent loaded exercise is available *and* the bodyweight version is below your level. So a beginner sees more bodyweight squats than an intermediate with dumbbells, and notes like “I prefer bodyweight” shift it further.

**Data:** version 7 adds `notes`, `forgotten` and `trials` to the `learn` store (standing exercise notes, dismissed note signals, and your answers on which joint-friendly modifications work), and makes wall / towel / foot anchor explicit equipment (kept ticked for existing profiles), and adds `variation` / `ownRest` / `ownRest` on plan and workout items. Nothing existing is rewritten.

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
node tests/e2e.test.js                              # full browser flow (needs Playwright)
node tests/features.test.js                         # exercise demonstrations + More options panel
node tests/settypes.test.js                         # drop sets, build-up sets, plain set types unchanged
node tests/nutrition.test.js                        # food parser, brands, ambiguity, library, estimates, trends, migration, backup
node tests/food.test.js                             # food tracker in the browser: logging, brands, lookup (mocked), favorites, dates, export/restore
node tests/overhaul.test.js                         # food DB integrity, brief examples, preparations, restaurants, recipes, units, learning, meals, migration v6, analytics, insights
node tests/diary.test.js                            # diary in the browser: review/edit/replace/add, saved meals, copy, targets, trends, run & weight, progress filters, layout
node tests/lookup.test.js                           # USDA / Open Food Facts normalizing, caching, failures, barcodes, offline USDA build (mocked network)
node tests/scan.test.js                             # browser: ZXing decoding, fake camera, permission denied, manual entry, not-found → label, online search (mocked)
node tests/accuracy.test.js [--report]              # recognition accuracy audit → docs/FOOD_ACCURACY_REPORT.md
node tests/brands.test.js                           # brand → line → variant → flavor → size matching, generated from the catalog
node tests/grocery.test.js                          # branded grocery labels, servings & packages, barcodes, library, online fit, coverage
node tools/coverage.js [--write]                    # branded nutrition coverage → docs/NUTRITION_COVERAGE.md
node tests/recommend.test.js                        # v6 recommendations: weekly balance, variety, drop/build-up assignment, caps, progression, learning, migration
node tests/meals.test.js                            # ingredients, estimates, recipe integrity sweep, nutrition, diets, migration + achievements
node tests/v6.test.js                               # v6 in the browser: navigation, Record a run, Meal ideas, Achievements, settings, upgrade from v5
node tests/migration.test.js                        # builds realistic data with the previous version (worktree of 5d64e76 on :8766) and upgrades / restores it
node tests/offline.test.js                          # service worker: fresh install offline, and updating an installed v5 copy (serves its own files)
node tests/learning.test.js                         # bodyweight library, variations, plan editing, note parsing (+ tests/note-phrasings.json), trials, joints, allocation, quality, demos
node tests/customize.test.js                        # browser: reorder (drag + keys), supersets, variations, no-equipment plans, notes → next plan, history
```
The browser tests use Playwright. `tests/serve.js` serves the repository to the browser in-process, so no separate server is needed; set `REAL_SERVER=1` to use one on :8765 instead.
The end-to-end test generates every workout type, swaps exercises, logs a full session, refreshes mid-workout, saves, and checks that the next session shows previous weights and an increase recommendation that is only applied on approval. It also checks the v1 → v2 data upgrade, intensity variety across repeated generations through the UI, the intensity picker, PR detection, the charts, export → wipe → import, persistence after refresh, the theme toggle and offline loading.

## Project layout

```
index.html            app shell
css/app.css           design system (dark/light), responsive layout
js/exercises.js       exercise database (244): muscles, equipment, cues, modifications, progressions, joint demands
js/feedback.js        learning from notes: parsing, decay, preferences, variation choice
js/core.js            taxonomy, default profile, storage, import/export
js/engine.js          history queries, progression, generator, stats
js/charts.js          SVG line/bar charts + rings
js/ui.js              shell, router, sheets, toasts, rest timer
js/views-train.js     Home, Generate, Train (active workout)
js/views-data.js      Exercises, History, Progress, Settings
js/foods.js           original generic food table (typical values per serving)
js/fooddb.js          USDA-based foods with preparations and sizes; homemade recipes
js/restaurants.js     restaurant menus (Chipotle, McDonald's, Chick-fil-A, Taco Bell, Subway, Shake Shack, Panera)
js/lookup.js          online lookup (USDA FoodData Central, Open Food Facts), cache, barcodes
js/scan.js            barcode scanner (BarcodeDetector or bundled ZXing), manual entry
js/vendor/            ZXing barcode decoder (Apache-2.0)
js/data/usda.json     optional offline USDA database (built by tools/build-usda.js)
tools/build-usda.js   converts FoodData Central bulk downloads for offline use
js/analytics.js       period filters, strength/cardio/consistency/nutrition/body summaries, insights
js/products.js        branded products with sources, serving sizes and status
js/brands.js          brand catalog: product lines, variants, flavors, package sizes (no nutrition)
js/nutrition.js       food parser, food-log store, trends, guidance
js/views-food.js      Food diary, review/edit/replace sheets, targets, trends, My foods
js/views-progress.js  Progress dashboard, record run / weight / measurement / photo sheets
docs/IMPLEMENTATION_PLAN.md   audit and plan for the nutrition and progress overhaul
docs/FOOD_ACCURACY_REPORT.md  generated recognition accuracy report
docs/BRANDED_MATCHING_AUDIT.md  branded recognition audit, rules and results
docs/NUTRITION_COVERAGE.md      branded nutrition coverage (generated by tools/coverage.js)
tools/coverage.js     coverage report generator
js/ingredients.js     ingredient nutrition database + offline estimator
js/meals.js           kitchen store, recipe composer (formats × flavors), nutrition, logging
js/achievements.js    achievement definitions, evaluation and celebration
js/views-meals.js     Meal ideas and Achievements screens
fonts/                Inter (OFL) + license
sw.js, manifest.webmanifest, icons/   PWA
```
