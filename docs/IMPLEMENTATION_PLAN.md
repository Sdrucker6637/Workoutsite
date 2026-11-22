# Forge: nutrition overhaul and fitness progress plan

## 1. Audit of the existing nutrition system (before this change)

| Area | State before | Verdict |
|---|---|---|
| **Food data** | `js/foods.js`: about 115 generic foods with typical values per portion (protein-first). Preparations were mostly merged: "chicken thigh" was a single entry, "rice" covered white/brown/fried, and "potato" covered baked/sweet/mashed. | Keep the format. Split the merged foods into USDA-based entries, one per preparation. |
| **Branded products** | `js/products.js`: 17 products with sources, serving sizes and status. Each was checked against the manufacturer's page on 2026-11-02. Matching uses brand, key words, flavor and category, and asks when unsure. | Works well. Keep it and add products. |
| **Restaurants** | Chain names were in `FOOD_BRANDS`, but there were no menus. "Chipotle bowl" fell back to a generic burrito. | Missing. Add chain menus. |
| **Parser** | `js/nutrition.js`: a deterministic parser. It handles fractions, number words, list splitting, alias matching, serving words, size words, unknown words that mark an item as an estimate, and typo suggestions. | Solid. Extend it rather than replace it. |
| **Macros** | Protein was the main number. Calories, carbs and fat were optional extras, and there were no targets for them. | Make all four macros first-class and add targets. |
| **Logging and history** | Entries were keyed by local date, with edit, delete, browsing by date and a 7/30-day protein trend. There were **no meal categories** and no saved meals. | Add meals and saved meals. |
| **Custom foods and corrections** | Products could be saved to "My foods" with aliases. Corrections updated the library. | Keep. Also remember serving sizes and corrected matches for generic and restaurant foods. |
| **Dashboard** | A protein-only summary, a log box, quick chips, a list of entries and a protein trend. | Rebuild it as a daily diary. |
| **Schema** | `localStorage['wt.data.v1']`, `version: 5`, with additive migrations in `core.js` (`migrate`). | Bump to v6. The change is additive only. |
| **Meal planner and achievements** | Not present in the codebase. Only PRs exist; there is nothing else called achievements. | Nothing to preserve. PRs are kept. |

## 2. Principles
- Keep the stack: plain JS, offline-first, no build step, no paid or AI API. Online lookup (Open Food Facts) stays optional.
- **Additive migration.** v5 data loads unchanged. New fields get defaults, and nothing is renamed or dropped.
- **Honest data.** Every food carries a provenance status:
  - `verified`: checked against the manufacturer's page.
  - `reference`: published USDA or chain values. These were transcribed, because this environment has no network access to re-check them.
  - `user`: confirmed by the user.
  - `estimated`: a typical value.

  Every parsed item also gets a separate **match confidence** (`exact` / `close` / `rough`). Unknown foods are never given numbers.

## 3. Schema changes (data version 5 → 6)
```
nutrition.entries[]   + meal: 'breakfast'|'lunch'|'dinner'|'snack'   (v5 entries: inferred from the time they were logged)
                      + group: id shared by items logged together    (enables "duplicate meal")
                      + match: 'exact'|'close'|'rough'
nutrition.meals[]     NEW saved meals { id, name, items[], meal, uses, lastUsed, fav }
nutrition.learned{}   NEW typed phrase → food ref (corrected matches)
nutrition.portions{}  NEW food ref → { qty, unit } remembered serving sizes
profile               + calorieTarget, carbTarget, fatTarget (null = derived), weightUnit
body                  NEW { weights[], measures[], photos[] } (photo images live in IndexedDB; only metadata is stored here)
```
Import/export: replace restores everything. Merge adds new records by id and never duplicates.

## 4. Food database
- `js/fooddb.js` adds USDA-based generic foods. Values are entered per 100 g and converted to the existing portion format. Each food comes in distinct preparations: chicken breast or thigh, raw or cooked, with or without skin, rotisserie; ground beef at 80, 85, 90, 93 and 95% lean; white or brown rice, cooked or dry; cooked or dry pasta; russet, red, sweet and mashed potatoes, and fries; five kinds of beans.
- The same file adds **recipes** (homemade dishes). Each recipe expands into its components, so they can be edited one by one.
- `js/restaurants.js` adds chain menus: Chipotle, McDonald's, Chick-fil-A, Taco Bell, Subway, Shake Shack and Panera. Each item has standard portions, a small/medium/large size, and component roles so a bowl or burrito can be customized.
- `js/products.js` adds branded products: Rao's, Oscar Mayer deli meats and more.

## 5. Parser upgrades (`js/nutrition.js`)
Matching priority:
1. A learned correction.
2. A branded product or one of your foods.
3. A restaurant item, from the chain named anywhere earlier in the sentence.
4. A recipe.
5. A generic food with the right preparation.
6. Unknown, which comes with suggestions.

Other changes:
- "with/without skin" and "skin on" are normalized.
- Named sizes are converted to grams ("medium baked potato" → 173 g).
- `jar`, `extra`, `light` and `double` are understood.
- A remembered portion is used when no amount is typed.
- `N.unitsFor` and `N.reunit` let the review screen change units without losing the match.

## 6. UI
- **Food**: a daily diary with a summary card (calories ring; protein, carbs and fat bars against targets) and Breakfast/Lunch/Dinner/Snacks sections. A natural-language box has a meal selector. Simple, confident entries log in one tap. Complex or uncertain ones open the **review sheet**, where you can edit the amount and unit, replace an item via search, remove it, add items, see live totals and confidence, and save the meal. Saved, frequent and recent foods and meals are available.
- **Trends** tab: averages, days meeting the protein target, logging consistency, and calorie and protein charts.
- **Progress**: an overview plus Strength (the existing exercise charts, PRs and muscle sets are preserved), Cardio, Consistency, Nutrition and Body. A shared period filter (7d, 30d, 90d, 6m, 1y, all) applies to every tab. Empty states explain what to track.
- **Insights** (`js/analytics.js`): deterministic rules that compare equal periods and set minimum-data thresholds.
- **Home**: today's calories and protein, the next workout, the week, the last run, one insight, and shortcuts to log food, start a workout, record a run and log weight.

## 7. Testing
- Node tests: parser cases from the brief, restaurants, recipes, personalization, migration v5→v6, analytics and insights.
- Browser tests: the diary, review editing, saved meals, the progress filters and the home shortcuts. These run on an in-process static server (`tests/serve.js`).
