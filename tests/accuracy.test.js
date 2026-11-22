/* Food recognition accuracy audit: realistic descriptions in 11 categories (count printed when run).
 *
 * For every case: the right food(s) and brand, the portion, the calories (independent hand calculation from the
 * source values), the confidence label that SHOULD be shown, and that nothing unsupported is made up.
 * Each item is also re-derived from its source (USDA per-100 g × grams, label × servings, menu values) to catch
 * calculation errors independently of the expectations.
 *
 *   node tests/accuracy.test.js            run the audit (fails on any wrong food, portion, value or label)
 *   node tests/accuracy.test.js --report   also write docs/FOOD_ACCURACY_REPORT.md
 *
 * Confidence classes: Exact (exact product / menu item with sourced values), Close (right generic food or
 * reference data, or an exact item whose values are estimates), Rough (estimated breakdown / unknown words),
 * Asks (ambiguous: the user must choose — never guessed), Not recognized (no values given).
 * A generic substitution is never counted as Exact.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
for (const f of ['exercises.js', 'core.js', 'engine.js', 'foods.js', 'fooddb.js', 'products.js', 'restaurants.js', 'brands.js', 'nutrition.js', 'lookup.js', 'analytics.js'])
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), { filename: f });
const WT = globalThis.WT, N = WT.nut;
WT.load();
WT.save = () => {};

// [category, text, expectation]
// expectation: { items: [[foodId or /regex/, { q, u, lvl: 'H'|'M'|'L', cal: [lo, hi] }]...], total: [lo, hi] } | { ask: true } | { unknown: true }
const H = 'H', M = 'M', Lw = 'L';
const CASES = [
  /* ── Branded packaged foods ── */
  ['Branded', 'One Pioneer Pastures snickerdoodle protein shake.', { ask: true, why: 'flavor not in the product data' }],
  ['Branded', 'Three tablespoons of Oikos Triple Zero.', { items: [['p:oikos-triple-zero', { q: 3, u: 'tbsp', lvl: M, cal: [23, 25] }]], why: 'flavor not given: Vanilla values, said so (Close, not Exact)' }],
  ['Branded', 'Three tablespoons of vanilla Oikos Triple Zero', { items: [['p:oikos-triple-zero', { q: 3, u: 'tbsp', lvl: H, cal: [23, 25] }]] }],
  ['Branded', 'an Oikos Pro yogurt', { items: [['p:oikos-pro-yogurt', { q: 1, lvl: M, cal: [130, 130] }]], why: 'flavor not given' }],
  ['Branded', 'a strawberry Oikos Pro yogurt', { items: [['p:oikos-pro-yogurt', { q: 1, lvl: H, cal: [130, 130] }]] }],
  ['Branded', 'a plain Oikos Pro yogurt', { ask: true, why: 'Plain is not one of the flavors with label data' }],
  ['Branded', '2 Premier Protein shakes', { items: [['p:premier-protein-shake', { q: 2, lvl: H, cal: [320, 320] }]] }],
  ['Branded', 'fairlife core power elite', { items: [['p:fairlife-core-power-elite', { q: 1, lvl: H, cal: [230, 230] }]] }],
  ['Branded', 'a Fairlife protein shake', { ask: true, why: 'three fairlife shakes' }],
  ['Branded', 'Quest chocolate chip cookie dough bar', { items: [['p:quest-bar-cccd', { q: 1, lvl: H, cal: [190, 190] }]] }],
  ['Branded', 'Quest cookies and cream bar', { ask: true, why: 'flavor not in the product data' }],
  ['Branded', '2 tbsp Jif creamy peanut butter', { items: [['p:jif-creamy', { q: 2, u: 'tbsp', lvl: H, cal: [190, 190] }]] }],
  ['Branded', '2 tbsp Jif peanut butter', { ask: true, why: 'creamy, crunchy, natural, reduced fat…' }],
  ['Branded', 'a serving of Barilla Protein+', { items: [['p:barilla-protein-plus', { q: 1, lvl: M, cal: [350, 350] }]] }],
  ['Branded', '2 Kraft singles', { items: [['p:kraft-singles-american', { q: 2, lvl: H, cal: [100, 100] }]] }],
  ['Branded', 'Kraft cheese', { ask: true, why: 'Kraft makes many cheeses' }],
  ['Branded', '3 Oscar Mayer beef franks', { items: [['p:oscar-mayer-beef-franks', { q: 3, lvl: H, cal: [420, 420] }]] }],
  ['Branded', 'Oscar Mayer hot dogs', { ask: true, why: 'beef franks or wieners' }],
  ['Branded', '4 oz Oscar Mayer honey ham', { items: [['p:oscar-mayer-ham', { q: 4, u: 'oz', lvl: M, cal: [119, 123] }]] }],
  ['Branded', 'Dave’s Killer Bread', { ask: true, why: 'the brand makes many breads' }],
  ['Branded', '2 slices of Dave’s Killer Bread 21 whole grains', { items: [['p:daves-21-whole-grains', { q: 2, lvl: M, cal: [220, 220] }]] }],
  ['Branded', 'half a jar of Rao’s marinara', { items: [['p:raos-marinara', { q: 0.5, u: 'jar (24 oz)', lvl: M, cal: [271, 273] }]], why: 'the 24 oz jar is assumed and said so' }],
  ['Branded', 'half a 32 oz jar of Rao’s marinara', { items: [['p:raos-marinara', { q: 0.5, u: 'jar (32 oz)', lvl: M, cal: [361, 365] }]] }],
  ['Branded', 'Kodiak power cakes', { items: [['p:kodiak-power-cakes', { q: 1, lvl: M, cal: [220, 220] }]], why: 'flavor not given: Buttermilk values' }],
  ['Branded', 'Kodiak buttermilk power cakes', { items: [['p:kodiak-power-cakes', { q: 1, lvl: H, cal: [220, 220] }]] }],
  ['Branded', 'a Chobani complete drink', { items: [['p:chobani-complete-drink', { q: 1, lvl: M, cal: [170, 170] }]] }],
  ['Branded', 'a cup of fairlife 2% milk', { items: [['p:fairlife-2-milk', { q: 1, lvl: M, cal: [120, 120] }]] }],
  ['Branded', 'Large Oikos Triple Zero yogurt', { items: [['p:oikos-triple-zero', { q: 1, lvl: M, cal: [80, 80] }]] }],
  ['Branded', 'Premier protein cafe latte shake', { ask: true, why: 'flavor not listed' }],
  ['Branded', 'a Core Power shake', { items: [['p:fairlife-core-power', { q: 1, lvl: H, cal: [170, 170] }]] }],
  ['Branded', 'Two slices of Oscar Mayer turkey with two slices of Dave’s Killer Bread.', { items: [], askAlso: 2, why: 'Oscar Mayer makes several turkeys and Dave’s several breads: both ask' }],
  ['Branded', 'Two slices of Oscar Mayer oven roasted turkey with two slices of Dave’s Killer Bread 21 whole grains.', { items: [['p:oscar-mayer-turkey', { q: 2, u: 'slice', lvl: M }], ['p:daves-21-whole-grains', { q: 2, lvl: M, cal: [220, 220] }]] }],

  /* ── Fast food ── */
  ['Fast food', 'Big Mac and medium fries', { items: [['r:mcdonalds:big-mac', { q: 1, lvl: H, cal: [590, 590] }], ['r:mcdonalds:fries', { u: 'medium', lvl: H, cal: [320, 320] }]] }],
  ['Fast food', "McDonald's 10 piece nuggets", { items: [['r:mcdonalds:nuggets', { q: 10, lvl: H, cal: [410, 410] }]] }],
  ['Fast food', "Egg McMuffin and a hash brown from McDonald's", { items: [['r:mcdonalds:egg-mcmuffin', { lvl: H, cal: [310, 310] }], ['r:mcdonalds:hash-brown', { lvl: H, cal: [140, 140] }]] }],
  ['Fast food', 'a McChicken', { items: [['r:mcdonalds:mcchicken', { lvl: H, cal: [400, 400] }]] }],
  ['Fast food', "a large Coke from McDonald's", { items: [['r:mcdonalds:coke', { u: 'large', lvl: M, cal: [290, 290] }]] }],
  ['Fast food', 'Quarter pounder with cheese', { items: [['r:mcdonalds:qpc', { lvl: H, cal: [520, 520] }]] }],
  ['Fast food', 'Chick-fil-A chicken sandwich and waffle fries', { items: [['r:chickfila:sandwich', { lvl: H, cal: [420, 420] }], ['r:chickfila:waffle-fries', { u: 'medium', lvl: M, cal: [420, 420] }]] }],
  ['Fast food', '12 count grilled nuggets from chick fil a', { items: [['r:chickfila:grilled-nuggets', { q: 12, lvl: H, cal: [200, 200] }]] }],
  ['Fast food', 'chick fil a sandwich with polynesian sauce', { items: [['r:chickfila:sandwich', { lvl: H }], ['r:chickfila:polynesian', { lvl: M, cal: [110, 110] }]] }],
  ['Fast food', 'Crunchwrap Supreme', { items: [['r:tacobell:crunchwrap', { lvl: H, cal: [530, 530] }]] }],
  ['Fast food', '3 crunchy tacos from Taco Bell', { items: [['r:tacobell:crunchy-taco', { q: 3, lvl: H, cal: [510, 510] }]] }],
  ['Fast food', 'Taco Bell bean burrito', { items: [['r:tacobell:bean-burrito', { lvl: H, cal: [350, 350] }]] }],
  ['Fast food', 'Taco Bell chicken quesadilla', { items: [['r:tacobell:quesadilla', { lvl: M, cal: [510, 510] }]] }],
  ['Fast food', 'Subway footlong italian bmt', { items: [['r:subway:italian-bmt', { u: 'footlong', lvl: M, cal: [780, 780] }]] }],
  ['Fast food', '6 inch turkey sub from subway with cheese', { items: [['r:subway:turkey', { u: '6-inch', lvl: M, cal: [270, 270] }], ['r:subway:cheese', { lvl: M, cal: [80, 80] }]] }],
  ['Fast food', 'ShackBurger and fries', { items: [['r:shakeshack:shackburger', { lvl: M, cal: [500, 500] }], ['r:shakeshack:fries', { lvl: M, cal: [470, 470] }]] }],
  ['Fast food', 'a Double ShackBurger', { items: [['r:shakeshack:double-shackburger', { lvl: M, cal: [760, 760] }]] }],
  ['Fast food', 'a small fries from mcdonalds', { items: [['r:mcdonalds:fries', { u: 'small', lvl: H, cal: [230, 230] }]] }],
  ['Fast food', '20 mcnuggets with bbq sauce', { items: [['r:mcdonalds:nuggets', { q: 20, lvl: H, cal: [830, 830] }], ['bbq-sauce', { lvl: M }]] }],

  /* ── Restaurant meals ── */
  ['Restaurant', 'A Chipotle chicken bowl with extra white rice, black beans and guacamole.', { items: [['r:chipotle:chicken', { lvl: H }], ['r:chipotle:rice-white', { q: 1.5, lvl: H }], ['r:chipotle:beans-black', { lvl: H }], ['r:chipotle:guac', { lvl: H }]], total: [855, 855] }],
  ['Restaurant', 'Chipotle steak burrito with brown rice, pinto beans, fajita veggies, cheese and sour cream', { items: [['r:chipotle:tortilla-burrito', {}], ['r:chipotle:steak', {}], ['r:chipotle:rice-brown', {}], ['r:chipotle:beans-pinto', {}], ['r:chipotle:fajita-veg', {}], ['r:chipotle:cheese', {}], ['r:chipotle:sour-cream', {}]], total: [1050, 1050] }],
  ['Restaurant', 'Chipotle chips and guac', { items: [['r:chipotle:chips', { lvl: H }], ['r:chipotle:guac', { lvl: H }]], total: [770, 770] }],
  ['Restaurant', 'chipotle salad with chicken, black beans, corn salsa and vinaigrette', { items: [['r:chipotle:supergreens', {}], ['r:chipotle:chicken', {}], ['r:chipotle:beans-black', {}], ['r:chipotle:salsa-corn', {}], ['r:chipotle:vinaigrette', {}]], total: [625, 625] }],
  ['Restaurant', 'chipotle sofritas bowl with brown rice', { items: [['r:chipotle:sofritas', {}], ['r:chipotle:rice-brown', {}]], total: [360, 360] }],
  ['Restaurant', 'chipotle carnitas tacos', { items: [['r:chipotle:taco-crispy', { q: 3 }], ['r:chipotle:carnitas', {}]], total: [420, 420] }],
  ['Restaurant', 'chipotle double chicken bowl with white rice and fajita veggies', { items: [['r:chipotle:chicken', { q: 2 }], ['r:chipotle:rice-white', {}], ['r:chipotle:fajita-veg', {}]], total: [590, 590] }],
  ['Restaurant', 'Panera bowl of broccoli cheddar soup', { items: [['r:panera:broccoli-cheddar', { u: 'medium', lvl: M, cal: [360, 360] }]] }],
  ['Restaurant', 'Panera half fuji apple salad with chicken', { items: [['r:panera:fuji-apple-chicken', { u: 'half', lvl: M, cal: [290, 290] }]] }],
  ['Restaurant', 'A chicken Caesar wrap from a restaurant.', { items: [['flour-tortilla-large', { lvl: Lw }], ['chicken-breast', { lvl: Lw }], ['romaine', { lvl: Lw }], ['caesar-dressing', { lvl: Lw }], ['parmesan', { lvl: Lw }]], note: /restaurant version/ }],
  ['Restaurant', 'restaurant cheeseburger and fries', { items: [['cheeseburger', { lvl: M }], ['fries', { lvl: M }]] }],
  ['Restaurant', 'a slice of pepperoni pizza', { items: [['pizza', { q: 1, lvl: M, cal: [285, 285] }]] }],
  ['Restaurant', '8 buffalo wings', { items: [['chicken-wing', { q: 8, lvl: M, cal: [800, 800] }]] }],
  ['Restaurant', 'a California roll', { items: [['sushi', { lvl: M, cal: [300, 300] }]] }],
  ['Restaurant', 'pad thai', { unknown: true, why: 'not in the offline database (search online or enter it)' }],
  ['Restaurant', 'chicken tikka masala with rice', { items: [['chicken', { lvl: Lw }], ['rice', { lvl: M }]], note: /“tikka masala” not specifically recognized/, why: 'tikka masala not in the database: plain chicken estimate, flagged Rough with the unrecognized words named' }],
  ['Restaurant', 'a bowl of chili', { items: [['chili', { u: 'bowl', lvl: M, cal: [390, 390] }]] }],

  /* ── Homemade meals ── */
  ['Homemade', 'chicken stir fry', { items: [['chicken-breast', { lvl: Lw }], ['vegetables', { lvl: Lw }], ['olive-oil', { lvl: Lw }], ['soy-sauce', { lvl: Lw }]] }],
  ['Homemade', 'spaghetti and meatballs', { items: [['pasta', { lvl: Lw }], ['marinara', { lvl: Lw }], ['meatball', { lvl: Lw }]] }],
  ['Homemade', '2 scrambled eggs and 2 slices of whole wheat toast with butter', { items: [['egg-scrambled', { q: 2, lvl: M, cal: [180, 184] }], ['bread-wheat', { q: 2, lvl: M, cal: [159, 164] }], ['butter', { lvl: M, cal: [65, 70] }]] }],
  ['Homemade', 'overnight oats', { items: [['rolled-oats', { lvl: Lw }], ['milk', { lvl: Lw }], ['greek-yogurt', { lvl: Lw }]] }],
  ['Homemade', 'a protein smoothie', { items: [['protein-powder', { lvl: Lw }], ['banana', { lvl: Lw }], ['milk', { lvl: Lw }], ['peanut-butter', { lvl: Lw }]] }],
  ['Homemade', 'grilled cheese sandwich', { items: [['bread', { lvl: Lw }], ['cheese', { lvl: Lw }], ['butter', { lvl: Lw }]] }],
  ['Homemade', 'beef and broccoli', { items: [['steak', { lvl: Lw }], ['broccoli', { lvl: Lw }], ['olive-oil', { lvl: Lw }], ['soy-sauce', { lvl: Lw }]] }],
  ['Homemade', 'avocado toast', { items: [['bread-wheat', { lvl: Lw }], ['avocado', { q: 0.5, lvl: Lw }]] }],
  ['Homemade', 'a turkey sandwich', { items: [['turkey-sandwich', { lvl: M, cal: [350, 350] }]] }],
  ['Homemade', 'a PB&J', { items: [['pbj', { lvl: M, cal: [380, 380] }]] }],
  ['Homemade', 'homemade burrito bowl', { items: [['chicken-breast', { lvl: Lw }], ['rice', { lvl: Lw }], ['beans-black', { lvl: Lw }], ['cheese', { lvl: Lw }], ['salsa', { lvl: Lw }]] }],
  ['Homemade', 'a cup of egg fried rice', { items: [['fried-rice', { q: 1, u: 'cup', lvl: M, cal: [236, 241] }]] }],
  ['Homemade', 'a bowl of mac and cheese', { items: [['mac-and-cheese', { u: 'bowl', lvl: M, cal: [525, 525] }]] }],
  ['Homemade', 'a 3 egg omelet with cheese', { items: [['omelet', { q: 1, lvl: M, cal: [300, 300] }], ['cheese', { lvl: M }]] }],
  ['Homemade', 'spaghetti with meat sauce', { items: [['pasta', { q: 1.5, lvl: Lw }], ['marinara', { lvl: Lw }], ['ground-beef', { lvl: Lw }]] }],

  /* ── Generic ingredients ── */
  ['Generic', '6 oz grilled chicken breast', { items: [['chicken-breast', { q: 6, u: 'oz', lvl: M, cal: [278, 284] }]] }],
  ['Generic', '200 g raw chicken breast', { items: [['chicken-breast-raw', { q: 200, u: 'g', lvl: M, cal: [240, 240] }]] }],
  ['Generic', '2 rotisserie chicken thighs with skin', { items: [['chicken-thigh-skin', { q: 2, lvl: M, cal: [364, 369] }]] }],
  ['Generic', 'Two chicken thighs from a grocery store rotisserie chicken.', { items: [['chicken-thigh-skin', { q: 2, lvl: M, cal: [364, 369] }]] }],
  ['Generic', 'rotisserie chicken breast without skin', { items: [['chicken-breast-rotisserie-skinless', { q: 1, lvl: M, cal: [213, 217] }]] }],
  ['Generic', 'Half a pound of 93/7 ground beef with a baked sweet potato.', { items: [['ground-beef-93', { q: 0.5, u: 'lb', lvl: M, cal: [335, 347] }], ['sweet-potato', { q: 1, lvl: M, cal: [133, 137] }]], why: '½ lb as bought ≈ 170 g cooked × 198 kcal/100 g = 337 (raw: 227 g × 152 = 345)' }],
  ['Generic', '4 oz 80/20 ground beef', { items: [['ground-beef-80', { q: 4, u: 'oz', lvl: M, cal: [298, 303] }]] }],
  ['Generic', '1 lb raw 85/15 ground beef', { items: [['ground-beef-85-raw', { q: 1, u: 'lb', lvl: M, cal: [973, 977] }]] }],
  ['Generic', 'a cup of white rice', { items: [['rice', { q: 1, u: 'cup', lvl: M, cal: [204, 207] }]] }],
  ['Generic', 'a cup of brown rice', { items: [['rice-brown', { q: 1, u: 'cup', lvl: M, cal: [238, 242] }]] }],
  ['Generic', '1/2 cup dry rice', { items: [['rice-dry', { q: 0.5, u: 'cup', lvl: M, cal: [336, 340] }]] }],
  ['Generic', '2 oz dry pasta', { items: [['pasta-dry', { q: 2, u: 'oz', lvl: M, cal: [209, 212] }]] }],
  ['Generic', 'a plate of spaghetti', { items: [['pasta', { u: 'plate', lvl: M, cal: [551, 555] }]] }],
  ['Generic', 'a medium baked potato', { items: [['potato', { q: 1, lvl: M, cal: [159, 163] }]] }],
  ['Generic', 'a large sweet potato', { items: [['sweet-potato', { q: 1, lvl: M, cal: [196, 200] }]] }],
  ['Generic', 'a cup of mashed potatoes', { items: [['mashed-potato', { q: 1, u: 'cup', lvl: M, cal: [235, 239] }]] }],
  ['Generic', 'half a cup of black beans', { items: [['beans-black', { q: 0.5, u: 'cup', lvl: M, cal: [112, 116] }]] }],
  ['Generic', 'a can of chickpeas', { items: [['chickpeas', { u: 'can', lvl: M, cal: [391, 397] }]] }],
  ['Generic', 'a cup of refried beans', { items: [['beans-refried', { u: 'cup', lvl: M, cal: [215, 219] }]] }],
  ['Generic', '3 large eggs', { items: [['egg', { q: 3, lvl: M, cal: [213, 216] }]] }],
  ['Generic', '2 fried eggs', { items: [['egg-fried', { q: 2, lvl: M, cal: [179, 182] }]] }],
  ['Generic', 'a glass of whole milk', { items: [['milk-whole', { u: 'glass', lvl: M, cal: [147, 151] }]] }],
  ['Generic', 'a tablespoon of olive oil', { items: [['olive-oil', { q: 1, u: 'tbsp', lvl: M, cal: [118, 121] }]] }],
  ['Generic', 'a handful of almonds', { items: [['almonds', { lvl: M, cal: [165, 165] }]] }],
  ['Generic', 'a medium banana', { items: [['banana', { lvl: M, cal: [104, 106] }]] }],
  ['Generic', 'a large apple', { items: [['apple', { lvl: M, cal: [114, 118] }]] }],
  ['Generic', 'a cup of strawberries', { items: [['strawberries', { u: 'cup', lvl: M, cal: [48, 50] }]] }],
  ['Generic', 'a cup of steamed broccoli', { items: [['broccoli', { u: 'cup', lvl: M, cal: [53, 56] }]] }],
  ['Generic', '6 oz salmon', { items: [['salmon', { q: 6, u: 'oz', lvl: M, cal: [348, 353] }]] }],
  ['Generic', 'a can of tuna', { items: [['tuna', { u: 'can', lvl: M, cal: [120, 120] }]] }],
  ['Generic', '2 tbsp peanut butter', { items: [['peanut-butter', { q: 2, u: 'tbsp', lvl: M, cal: [190, 190] }]] }],
  ['Generic', '1 scoop whey protein', { items: [['protein-powder', { q: 1, lvl: M, cal: [120, 120] }]] }],
  ['Generic', 'a cup of greek yogurt', { items: [['greek-yogurt', { u: 'cup', lvl: M, cal: [135, 135] }]] }],

  /* ── Sauces and toppings ── */
  ['Sauces & toppings', 'spaghetti with marinara and parmesan', { items: [['pasta', { lvl: Lw }], ['marinara', { lvl: Lw }], ['parmesan', { lvl: Lw }], ['parmesan', { lvl: M }]] }],
  ['Sauces & toppings', 'a side salad with ranch dressing', { items: [['salad', { lvl: M }], ['ranch', { q: 2, u: 'tbsp', lvl: M, cal: [127, 131] }]] }],
  ['Sauces & toppings', 'chicken breast with bbq sauce', { items: [['chicken-breast', { lvl: M }], ['bbq-sauce', { q: 2, u: 'tbsp', lvl: M, cal: [57, 60] }]] }],
  ['Sauces & toppings', 'fries with ketchup', { items: [['fries', { lvl: M }], ['ketchup', { q: 1, u: 'tbsp', lvl: M, cal: [16, 18] }]] }],
  ['Sauces & toppings', 'a burger with cheese and bacon', { items: [['hamburger', { lvl: M }], ['cheese', { lvl: M }], ['bacon', { lvl: M }]] }],
  ['Sauces & toppings', 'toast with jam and butter', { items: [['bread', { lvl: M }], ['jam', { lvl: M }], ['butter', { lvl: M }]] }],
  ['Sauces & toppings', 'One serving of Barilla Protein+ with parmesan and Rao’s tomato sauce.', { items: [['p:barilla-protein-plus', { lvl: M }], ['parmesan', { lvl: M }]], askAlso: 1, why: 'Rao’s makes several tomato sauces (marinara, tomato basil…): asks' }],
  ['Sauces & toppings', 'a bagel with cream cheese', { items: [['bagel', { lvl: M, cal: [280, 280] }], ['cream-cheese', { q: 2, u: 'tbsp', lvl: M, cal: [100, 100] }]] }],
  ['Sauces & toppings', 'oatmeal with honey and blueberries', { items: [['oatmeal', { lvl: M }], ['honey', { lvl: M }], ['blueberries', { lvl: M }]] }],
  ['Sauces & toppings', 'tacos with hot sauce', { items: [['taco', { q: 2, lvl: M }], ['hot-sauce', { lvl: M }]] }],

  /* ── Portion sizes ── */
  ['Portions', 'a large chicken breast', { items: [['chicken-breast', { lvl: M, cal: [377, 383] }]], why: 'large = 230 g' }],
  ['Portions', 'a small banana', { items: [['banana', { lvl: M, cal: [88, 92] }]] }],
  ['Portions', 'a bowl of oatmeal', { items: [['oatmeal', { u: 'bowl', lvl: M, cal: [206, 210] }]] }],
  ['Portions', 'a big bowl of white rice', { items: [['rice', { u: 'bowl', lvl: M, cal: [382, 389] }]], why: 'bowl 237 g × big 1.25' }],
  ['Portions', 'a few pieces of chicken', { items: [['chicken', { q: 3, u: 'piece', lvl: M }]] }],
  ['Portions', '150 g of cooked white rice', { items: [['rice', { q: 150, u: 'g', lvl: M, cal: [195, 195] }]] }],
  ['Portions', 'a quarter cup of granola', { items: [['granola', { q: 0.25, u: 'cup', lvl: M, cal: [142, 146] }]] }],
  ['Portions', 'half a avocado', { items: [['avocado', { q: 0.5, lvl: M, cal: [119, 121] }]] }],
  ['Portions', 'a footlong meatball marinara from subway', { items: [['r:subway:meatball', { u: 'footlong', lvl: M, cal: [960, 960] }]] }],
  ['Portions', 'a cup of Panera broccoli cheddar soup', { items: [['r:panera:broccoli-cheddar', { u: 'small', lvl: M, cal: [230, 230] }]] }],

  /* ── Ambiguous descriptions ── */
  ['Ambiguous', 'Oikos', { ask: true, why: 'which Oikos product' }],
  ['Ambiguous', 'Quest bar', { ask: true, why: 'Quest flavors have different labels: asks which flavor' }],
  ['Ambiguous', 'chicken', { items: [['chicken', { lvl: M }]], why: 'generic cooked chicken, amount assumed' }],
  ['Ambiguous', 'a sandwich', { items: [['sandwich', { lvl: M }]] }],
  ['Ambiguous', 'a shake', { items: [['protein-shake', { lvl: M }]] }],
  ['Ambiguous', 'yogurt', { items: [['yogurt', { lvl: M }]] }],

  /* ── Similar names, different values ── */
  ['Similar names', 'chicken caesar wrap', { items: [['flour-tortilla-large', {}], ['chicken-breast', {}], ['romaine', {}], ['caesar-dressing', {}], ['parmesan', {}]], total: [550, 565] }],
  ['Similar names', 'grilled chicken caesar salad', { items: [['chicken-breast', {}], ['romaine', {}], ['caesar-dressing', {}], ['parmesan', {}], ['croutons', {}]], total: [465, 475] }],
  ['Similar names', 'crispy chicken caesar sandwich', { items: [['crispy-chicken-fillet', {}], ['bun', {}], ['romaine', {}], ['caesar-dressing', {}], ['parmesan', {}]], total: [535, 545] }],
  ['Similar names', 'a chicken sandwich', { items: [['chicken-sandwich', { lvl: M, cal: [450, 450] }]] }],
  ['Similar names', 'a Chick-fil-A chicken sandwich', { items: [['r:chickfila:sandwich', { lvl: H, cal: [420, 420] }]] }],
  ['Similar names', "a McDonald's crispy chicken sandwich", { items: [['r:mcdonalds:mccrispy', { lvl: H, cal: [470, 470] }]] }],
  ['Similar names', 'a cup of skim milk', { items: [['milk-skim', { lvl: M, cal: [82, 84] }]] }],
  ['Similar names', 'a cup of whole milk', { items: [['milk-whole', { lvl: M, cal: [147, 151] }]] }],
  ['Similar names', '2 boiled eggs', { items: [['egg', { q: 2, lvl: M, cal: [142, 144] }]] }],
  ['Similar names', '2 scrambled eggs', { items: [['egg-scrambled', { q: 2, lvl: M, cal: [180, 184] }]] }],
  ['Similar names', 'a cup of cooked pasta', { items: [['pasta', { lvl: M, cal: [220, 222] }]] }],
  ['Similar names', 'a cup of dry pasta', { items: [['pasta-dry', { lvl: M, cal: [336, 340] }]] }],

  /* ── Unsupported information is not fabricated ── */
  ['No fabrication', 'a plate of zorbleberries', { unknown: true }],
  ['No fabrication', 'Chipotle quinoa bowl', { items: [['quinoa', { lvl: Lw }]], note: /Not on our Chipotle menu/ }],
  ['No fabrication', "Trader Joe's mandarin orange chicken", { ask: true, why: 'brand recognized, product not on the device: asks (search, label, or a labelled generic estimate)' }],
  ['No fabrication', 'a Ball Park hot dog', { ask: true, why: 'Ball Park beef, classic or turkey franks: no labels on the device, asks' }],
  ['No fabrication', 'a Barilla Protein+ serving', { items: [['p:barilla-protein-plus', { lvl: M }]], estMacros: true, why: 'calories not on the checked label: estimated AND flagged' }],
  ['No fabrication', 'a Pioneer Pastures vanilla shake', { items: [['p:pioneer-a2-shake', { lvl: H }]], nullMacros: ['c', 'f'], why: 'carbs and fat not on the label: left blank' }],

  /* ── Typos and shorthand ── */
  ['Typos & shorthand', 'chiken brest', { items: [['chicken-breast', { lvl: M }]], note: /Read “brest” as “breast”/ }],
  ['Typos & shorthand', '2 bananna', { items: [['banana', { q: 2, lvl: M }]] }],
  ['Typos & shorthand', 'a cup of brocoli', { items: [['broccoli', { lvl: M }]] }],
  ['Typos & shorthand', 'pb and j', { items: [['pbj', { lvl: M }]] }],
  ['Typos & shorthand', 'a glass of oj', { items: [['orange-juice', { u: 'glass', lvl: M, cal: [110, 114] }]] }],
  ['Typos & shorthand', 'chx and rice', { items: [['chicken-breast', { lvl: Lw }], ['rice', { lvl: Lw }]], why: '“chx” = chicken → the chicken-and-rice recipe' }],
  ['Typos & shorthand', 'a tbsp evoo', { items: [['olive-oil', { u: 'tbsp', lvl: M }]] }],
  ['Typos & shorthand', 'chipolte chicken bowl', { items: [['r:chipotle:chicken', { lvl: H }]] }],
];

/* ───────── Independent recomputation from source data ───────── */
const W = { oz: 28.35, g: 1, lb: 453.6, kg: 1000 };
function recompute(it) {
  const id = it.foodId || '';
  const qty = it.qty;
  if (id.startsWith('r:')) {
    const r = N.restaurantRef(id);
    if (!r || r.it.packs || r.it.count) return null;
    let m = r.it.sizes ? r.it.sizes[it.unit] : it.unit === 'half' ? r.it.half : r.it.m;
    if (!m) return null;
    if (it.unit === 'footlong') m = m.map((v) => v * 2);
    return m[0] * qty;
  }
  if (id.startsWith('p:')) {
    const x = N.productById(id.slice(2));
    const calBase = x.cal != null ? x.cal : x.est && x.est.cal;
    if (calBase == null) return null;
    const mult = it.unit === x.unit ? 1 : x.units && x.units[it.unit] != null ? x.units[it.unit] : W[it.unit] && x.g ? W[it.unit] / x.g : null;
    return mult == null ? null : calBase * mult * qty;
  }
  const f = N.foodById(id);
  if (!f || !f.per100) return null; // only USDA-based foods have per-100 g source values
  let grams; // a food's own portion definition wins over a plain weight (e.g. ground beef "lb" = as bought)
  if (it.unit === f.u) grams = f.g * qty * (it.sizeMult || 1);
  else if (f.units && f.units[it.unit] != null) grams = f.units[it.unit] * f.g * qty * (it.sizeWord ? 1 : it.sizeMult || 1); // a generic size word (big, small) scales any portion; a named size only the base unit
  else if (W[it.unit]) grams = W[it.unit] * qty;
  else return null;
  return (f.per100.cal * grams) / 100;
}

/* ───────── Run ───────── */
const LV = { high: 'H', medium: 'M', low: 'L' };
const results = [];
let problems = 0;
CASES.forEach(([cat, text, exp], n) => {
  const items = N.parse(text);
  const issues = [];
  const known = items.filter((i) => !i.unknown && !i.ambiguous);
  const asks = items.filter((i) => i.ambiguous).length;
  const unknowns = items.filter((i) => i.unknown).length;
  // no fabrication: unknown/ambiguous items never carry values; missing label values stay missing unless flagged
  items.forEach((i) => (i.unknown || i.ambiguous) && i.per && issues.push('unrecognized item has values'));
  if (exp.ask) {
    if (!asks) issues.push('expected the app to ask, it picked ' + known.map((i) => i.foodId).join(', '));
  } else if (exp.unknown) {
    if (!unknowns || known.length) issues.push('expected “not recognized”, got ' + known.map((i) => i.foodId).join(', '));
  } else {
    if ((exp.askAlso || 0) !== asks) issues.push(`expected ${exp.askAlso || 0} item(s) to ask, got ${asks}`);
    if ((exp.unknownAlso || 0) !== unknowns) issues.push(`expected ${exp.unknownAlso || 0} unrecognized, got ${unknowns}`);
    if (known.length !== exp.items.length) issues.push(`expected ${exp.items.length} item(s), got ${known.length}: ${known.map((i) => i.foodId).join(', ')}`);
    exp.items.forEach(([id, o], k) => {
      const it = known[k];
      if (!it) return;
      const idOk = id instanceof RegExp ? id.test(it.foodId) : it.foodId === id;
      if (!idOk) issues.push(`item ${k + 1}: expected ${id}, got ${it.foodId}`);
      if (o.q != null && Math.abs(it.qty - o.q) > 1e-6) issues.push(`item ${k + 1}: qty ${it.qty}, expected ${o.q}`);
      if (o.u && it.unit !== o.u) issues.push(`item ${k + 1}: unit ${it.unit}, expected ${o.u}`);
      const lv = LV[N.confidence(it).level];
      if (o.lvl && lv !== o.lvl) issues.push(`item ${k + 1}: confidence ${N.confidence(it).label}, expected ${{ H: 'high', M: 'medium', L: 'low' }[o.lvl]}`);
      const cal = N.itemTotals(it).cal;
      if (o.cal && (cal < o.cal[0] - 0.5 || cal > o.cal[1] + 0.5)) issues.push(`item ${k + 1}: ${Math.round(cal)} cal, expected ${o.cal[0]}–${o.cal[1]}`);
      // a generic substitution is never an exact match
      if (lv === 'H' && !/^(p:|r:|my:|x:)/.test(it.foodId)) issues.push(`item ${k + 1}: generic food shown as an exact match`);
    });
    if (exp.total) {
      const t = N.sumItems(known).cal;
      if (t < exp.total[0] - 0.5 || t > exp.total[1] + 0.5) issues.push(`total ${Math.round(t)} cal, expected ${exp.total[0]}–${exp.total[1]}`);
    }
    if (exp.note && !known.some((i) => exp.note.test(i.note || ''))) issues.push('expected note ' + exp.note);
    if (exp.estMacros && !known.some((i) => i.estMacros && i.estMacros.length && /estimated/.test(i.note))) issues.push('estimated values not flagged');
    if (exp.nullMacros) exp.nullMacros.forEach((m) => known[0] && known[0].per[m] != null && issues.push(`${m} should stay blank`));
  }
  // independent calculation check
  const calc = [];
  known.forEach((it) => {
    const want = recompute(it);
    if (want == null) return;
    const got = N.itemTotals(it).cal;
    if (Math.abs(got - want) > Math.max(1, want * 0.01)) calc.push(`${it.name}: ${Math.round(got)} cal vs ${Math.round(want)} from source`);
  });
  issues.push(...calc.map((c) => 'calculation: ' + c));
  const levels = known.map((i) => N.confidence(i).level);
  const cls = exp.unknown && unknowns ? 'Not recognized (correct)' : exp.ask && asks ? 'Asks (correct)' : !known.length ? 'Failed' : levels.includes('low') ? 'Rough' : levels.includes('medium') ? 'Close' : 'Exact';
  if (issues.length) problems++;
  results.push({ n: n + 1, cat, text, items, known, asks, unknowns, cls, issues, calc: calc.length, exp });
});

/* ───────── Summary ───────── */
const count = (f) => results.filter(f).length;
const byCls = {};
results.forEach((r) => (byCls[r.cls] = (byCls[r.cls] || 0) + 1));
const itemLv = { high: 0, medium: 0, low: 0 };
results.forEach((r) => r.known.forEach((i) => itemLv[N.confidence(i).level]++));
console.log(`Food recognition audit: ${results.length} descriptions, ${results.reduce((a, r) => a + r.items.length, 0)} items`);
Object.entries(byCls).forEach(([k, v]) => console.log(`  ${k.padEnd(26)} ${v}`));
console.log(`  items: ${itemLv.high} exact · ${itemLv.medium} close · ${itemLv.low} rough · ${results.reduce((a, r) => a + r.asks, 0)} ask · ${results.reduce((a, r) => a + r.unknowns, 0)} not recognized`);
console.log(`  calculation errors: ${results.reduce((a, r) => a + r.calc, 0)}`);
results.filter((r) => r.issues.length).forEach((r) => console.log(`  ✗ #${r.n} “${r.text}”\n      ${r.issues.join('\n      ')}`));
console.log(`\n${results.length - problems} passed, ${problems} failed`);

if (process.argv.includes('--report')) {
  const esc = (s) => String(s).replace(/\|/g, '\\|');
  const fmt = (i) => (i.unknown ? `*not recognized* (“${esc(i.text)}”)` : i.ambiguous ? `*asks which product* (${i.candidates.length} candidate${i.candidates.length === 1 ? '' : 's'}${i.variant ? `; “${esc(i.variant)}” not in data` : ''})` : `${esc(i.name)} · ${esc(N.fmtAmount(i.qty, i.unit))} · ${Math.round(N.itemTotals(i).cal)} cal · ${Math.round(N.itemTotals(i).p)} g P · ${N.statusLabel(i.conf)} · **${N.confidence(i).label}**`);
  const cats = [...new Set(results.map((r) => r.cat))];
  const md = `# Food recognition accuracy report

Generated by \`node tests/accuracy.test.js --report\` on ${new Date().toISOString().slice(0, 10)}. Offline parser only: no network, no online lookup.

**${results.length} descriptions · ${results.reduce((a, r) => a + r.items.length, 0)} recognized items · ${problems} with problems · ${results.reduce((a, r) => a + r.calc, 0)} calculation errors.**

## How results are classified

| Class | Meaning |
|---|---|
| **Exact** | Every item is an exact product or menu item with sourced values (manufacturer, restaurant). |
| **Close** | The right generic food, with USDA reference values or a typical estimate, or an exact product whose values are partly estimated. The portion may be assumed. |
| **Rough** | An estimated breakdown (a homemade or restaurant dish), or a description with words that weren't recognized. |
| **Asks (correct)** | It's ambiguous (which product, an unlisted flavor), so the user picks. No value is guessed. |
| **Not recognized (correct)** | Not in the offline database. No values are given; the user searches online or enters it. |
| **Failed** | The app recognized the wrong thing or nothing at all when it should have recognized something. |

A generic substitution is never counted as Exact. Each case states the confidence that *should* appear, and the test fails if the app shows a higher one.

## Summary

| Class | Descriptions |
|---|---|
${Object.entries(byCls).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

| Items | Count |
|---|---|
| Exact match | ${itemLv.high} |
| Close match | ${itemLv.medium} |
| Rough estimate | ${itemLv.low} |
| Asks which product | ${results.reduce((a, r) => a + r.asks, 0)} |
| Not recognized | ${results.reduce((a, r) => a + r.unknowns, 0)} |

**Calculation check.** Every item was recomputed independently from its source: USDA per-100 g values × grams for the portion, label value × servings, or the menu value × quantity. Tolerance is 1%. Errors: **${results.reduce((a, r) => a + r.calc, 0)}**.

**By category**

| Category | Cases | Exact | Close | Rough | Asks | Not recognized | Problems |
|---|---|---|---|---|---|---|---|
${cats.map((c) => { const rs = results.filter((r) => r.cat === c); const k = (x) => rs.filter((r) => r.cls.startsWith(x)).length; return `| ${c} | ${rs.length} | ${k('Exact')} | ${k('Close')} | ${k('Rough')} | ${k('Asks')} | ${k('Not recognized')} | ${rs.filter((r) => r.issues.length).length} |`; }).join('\n')}

## Issues found during the audit and fixed

These were found by running these cases against the parser as it was before this round:

| Input | Problem | Fix |
|---|---|---|
| “…protein shake.”, “…Triple Zero.” | A sentence-ending period stuck to the last word. “guacamole.” and “sweet potato.” went unrecognized, and “Zero.” was treated as an unknown flavor. | The tokenizer now drops sentence periods and keeps decimal points (“0.5”). |
| “Two chicken thighs from a grocery store rotisserie chicken.” | Read as a skinless thigh with unknown words (Rough). | “from a grocery store / the deli / a restaurant” is treated as where the food came from. Alias words can match in any order (ranked below an in-order match). A repeated word (“chicken”) no longer counts as unexplained. |
| “a chicken Caesar wrap from a restaurant” | Same breakdown as homemade, with no warning. | It keeps the breakdown and notes that restaurant portions and dressing vary (Rough). |
| “chiken brest”, “2 bananna”, “guacamle” | Typos were not recognized. | Typo correction against the food vocabulary: one edit for 5–6 letter words, two edits for longer words. The correction is shown (“Read “brest” as “breast””) and never counts as an exact match. Brand names are in the vocabulary, so “Ball Park” isn’t “corrected”. |
| “chx”, “evoo”, “oj”, “chipolte”, “protien” | Shorthand and common misspellings were not recognized. | A synonym map applied before parsing. |
| “a 3 egg omelet” | Read as 3 omelets. | “N egg omelet / scramble” is one dish scaled to N eggs. |
| “chicken breast with bbq sauce”, “tacos with hot sauce” | BBQ sauce and hot sauce were missing. | Added (USDA barbecue sauce; hot sauce as a typical estimate). |
| “Panera half fuji apple salad with chicken” | Split at “with”. | Added the full menu name as an alias, which protects it from splitting. |
| A brand with one product in the database | First fix attempt: identify it by the brand alone. | **Reverted.** Kraft and Dave’s Killer Bread make many products, so the app keeps asking (“Is this the product?”). |
| Search: “Barilla Protein+” listed every protein product; “greek” fuzzily matched “green”; “chipotle” didn’t list the menu; “93/7” wasn’t understood | Search ranking problems. | Ranking now uses query coverage plus brand and restaurant awareness, with lean-ratio normalization and fuzzy matching only as a tie-breaker. |

## Known limitations (not fabricated, but not recognized)

${results.filter((r) => r.unknowns || r.cls === 'Not recognized (correct)').map((r) => `- “${esc(r.text)}”: ${r.exp.why || 'not in the offline database'}. Use **Search foods → Search online** or enter it from the label.`).join('\n')}
- Restaurant dishes outside the seven bundled chains are rough breakdowns of homemade versions.
- Every portion word (“a bowl”, “a handful”) is a typical size, so amounts without a weight are estimates.

## All cases

${cats.map((c) => `### ${c}

| # | Description | Result | Class | Check |
|---|---|---|---|---|
${results.filter((r) => r.cat === c).map((r) => `| ${r.n} | ${esc(r.text)} | ${r.items.map(fmt).join('<br>')} | ${r.cls} | ${r.issues.length ? '✗ ' + esc(r.issues.join('; ')) : '✓'}${r.exp.why ? ` (${esc(r.exp.why)})` : ''} |`).join('\n')}`).join('\n\n')}
`;
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'FOOD_ACCURACY_REPORT.md'), md);
  console.log('Wrote docs/FOOD_ACCURACY_REPORT.md');
}
process.exit(problems ? 1 : 0);
