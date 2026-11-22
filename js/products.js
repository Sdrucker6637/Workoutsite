/* Branded products: specific items with their own published nutrition.
 *
 * Unlike js/foods.js (generic, typical values), every product here names its source.
 *   status 'verified'  — protein and serving size were read from the manufacturer's own product page.
 *   status 'estimated' — a label value seen only on a retailer listing, or a value the manufacturer gives
 *                        only approximately. Shown as an estimate until you confirm it against your package.
 * Values are per ONE serving (`unit`, described by `serv`). A null macro means the source didn't show it —
 * it is left blank rather than guessed. Protein is the priority; the others are secondary.
 *
 *   brand, line      brand and product line ("Triple Zero Greek Nonfat Yogurt")
 *   flavor           the flavor the values were read from; `flavors` lists others the source gives the
 *                    same protein / calories for. A flavor not listed is never assumed to match.
 *   key              words that pick this product out within its brand ("triple zero", "pro"). Without one,
 *                    a brand-only entry like "Oikos yogurt" asks which product you mean.
 *   a                extra phrases that identify the product on their own ("core power")
 *   g                grams per serving (enables oz/g)
 *   units            serving words → servings ({ tbsp: 0.5 } for a 2-tbsp serving)
 *   approx           which of `units` are volume conversions rather than label servings
 *   checked          when the source was last checked (YYYY-MM-DD)
 */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const CHECKED = '2026-11-02';
  const P = (o) => Object.assign({ checked: CHECKED, flavors: [], key: [], a: [], units: {}, approx: [] }, o);
  const mfr = (name, url) => ({ kind: 'manufacturer', name, url });
  const retail = (name, url) => ({ kind: 'retailer', name, url });

  WT.PRODUCTS = [
    /* ── Protein shakes ── */
    P({ id: 'pioneer-a2-shake', brand: 'Pioneer Pastures', line: 'A2 Protein Shake', flavor: 'Vanilla', flavors: ['Chocolate', 'Strawberries & Cream'], cat: 'shake',
      unit: 'bottle', serv: '1 bottle (11 fl oz)', p: 30, cal: 160, c: null, f: null, status: 'verified',
      src: mfr('pioneerpastures.com', 'https://pioneerpastures.com/products/a2-vanilla-protein-shake'),
      note: '30 g protein and 160 calories per bottle for Vanilla and Chocolate; 30 g for Strawberries & Cream. Carbs and fat not shown on the page.' }),
    P({ id: 'premier-protein-shake', brand: 'Premier Protein', line: 'Protein Shake', flavor: 'Chocolate', flavors: ['Vanilla', 'Cookies & Cream', 'Cookie Dough', 'Cake Batter', 'Bananas & Cream', 'Peaches & Cream', 'Pumpkin Spice', 'Lemon Bar'], cat: 'shake',
      unit: 'bottle', serv: '1 bottle', p: 30, cal: 160, c: 4, f: 3, status: 'verified', a: ['premier protein', 'premier shake'],
      src: mfr('premierprotein.com', 'https://www.premierprotein.com/products/chocolate-protein-shake'),
      note: 'Every listed flavor shows 30 g protein and 160 calories; carbs and fat are from the Chocolate label.' }),
    P({ id: 'fairlife-core-power', brand: 'fairlife', line: 'Core Power Protein Shake (26 g)', flavor: 'Chocolate', flavors: ['Vanilla', 'Strawberry Banana'], cat: 'shake',
      unit: 'bottle', serv: '1 bottle (14 fl oz)', p: 26, cal: 170, c: 8, f: 4.5, status: 'verified', key: ['core power', '26'], a: ['core power'],
      src: mfr('fairlife.com', 'https://fairlife.com/core-power/chocolate-protein-shake/') }),
    P({ id: 'fairlife-core-power-elite', brand: 'fairlife', line: 'Core Power Elite Protein Shake (42 g)', flavor: 'Chocolate', flavors: ['Vanilla', 'Strawberry'], cat: 'shake',
      unit: 'bottle', serv: '1 bottle (14 fl oz)', p: 42, cal: 230, c: 9, f: null, status: 'verified', key: ['elite', '42'], a: ['core power elite'],
      src: mfr('fairlife.com', 'https://fairlife.com/core-power/chocolate-protein-shake-42g/'), note: 'Fat not shown on the page.' }),
    P({ id: 'fairlife-nutrition-plan', brand: 'fairlife', line: 'Nutrition Plan Protein Shake', flavor: 'Chocolate', flavors: ['Vanilla'], cat: 'shake',
      unit: 'bottle', serv: '1 bottle (11.5 fl oz / 340 mL)', g: 340, p: 30, cal: 150, c: 4, f: 2.5, status: 'verified', key: ['nutrition plan'], a: ['nutrition plan'],
      src: mfr('fairlife.com', 'https://fairlife.com/nutrition-plan/chocolate/'), note: 'Vanilla: same protein and calories, 3 g carbs.' }),
    P({ id: 'chobani-complete-drink', brand: 'Chobani', line: 'Complete Greek Yogurt Drink', flavor: 'Vanilla', cat: 'shake',
      unit: 'bottle', serv: '1 bottle (10 fl oz)', p: 20, cal: 170, c: null, f: null, status: 'estimated', key: ['drink', 'shake', 'bottle'],
      src: retail('Retailer label listing (Giant)', 'https://giantfoodstores.com/groceries/product/chobani-complete-low-fat-vanilla-greek-yogurt-20g-protein-drink-10-oz-btl/285061'),
      note: 'Not confirmed on chobani.com — check your bottle.' }),

    /* ── Yogurt ── */
    P({ id: 'oikos-triple-zero', brand: 'Oikos', line: 'Triple Zero Greek Nonfat Yogurt', flavor: 'Vanilla', cat: 'yogurt',
      unit: 'cup', serv: '1 cup (5.3 oz / 150 g)', g: 150, p: 15, cal: 80, c: 6, f: 0, status: 'verified', key: ['triple zero', '000'], a: ['triple zero'],
      units: { container: 1, tub: 1, serving: 1, tbsp: 0.1, spoon: 0.1, spoonful: 0.1, tsp: 0.033, scoop: 0.4 }, approx: ['tbsp', 'spoon', 'spoonful', 'tsp', 'scoop'],
      src: mfr('oikos.com', 'https://www.oikos.com/all-products/triple-zero/product/vanilla/'),
      note: 'Single 5.3-oz cup. One multipack panel lists 90 calories; protein is 15 g on all.' }),
    P({ id: 'oikos-pro-yogurt', brand: 'Oikos', line: 'Pro High Protein Yogurt', flavor: 'Vanilla', flavors: ['Banana', 'Strawberry'], cat: 'yogurt',
      unit: 'cup', serv: '1 cup (5.3 oz / 150 g)', g: 150, p: 20, cal: 130, c: 6, f: 3, status: 'verified', key: ['pro'], a: ['oikos pro'],
      units: { container: 1, tub: 1, serving: 1, tbsp: 0.1, spoon: 0.1, spoonful: 0.1, tsp: 0.033, scoop: 0.4 }, approx: ['tbsp', 'spoon', 'spoonful', 'tsp', 'scoop'],
      src: mfr('oikos.com', 'https://www.oikos.com/all-products/pro-yogurt-cultured-ultra-filtered-milk/product/vanilla/') }),
    P({ id: 'chobani-complete-cup', brand: 'Chobani', line: 'Complete Greek Yogurt', flavor: 'Vanilla', flavors: ['Mixed Berry'], cat: 'yogurt',
      unit: 'cup', serv: '1 cup (5.3 oz / 150 g)', g: 150, p: 15, cal: 120, c: null, f: 0, status: 'estimated', key: ['complete'],
      units: { container: 1, tub: 1, serving: 1, tbsp: 0.1, spoon: 0.1, spoonful: 0.1, tsp: 0.033, scoop: 0.4 }, approx: ['tbsp', 'spoon', 'spoonful', 'tsp', 'scoop'],
      src: retail('Retailer label listing (Albertsons)', 'https://www.albertsons.com/shop/product-details.960565908.html'),
      note: 'Not confirmed on chobani.com. Larger tubs list 17 g per ¾ cup — check your package.' }),

    /* ── Milk ── */
    P({ id: 'fairlife-2-milk', brand: 'fairlife', line: 'Ultra-Filtered Milk', flavor: '2% Reduced Fat', cat: 'milk',
      unit: 'cup', serv: '1 cup (8 fl oz)', g: 240, p: 13, cal: null, c: null, f: null, status: 'estimated', key: ['milk'],
      units: { glass: 1, serving: 1, splash: 0.1, tbsp: 0.0625 }, approx: ['splash'],
      src: mfr('fairlife.com', 'https://fairlife.com/news/how-much-protein-is-in-milk/'),
      note: 'fairlife says “up to 13 g per serving” for its ultra-filtered milk; the exact 2% label wasn’t available.', est: { cal: 120, c: 6, f: 4.5 } }),

    /* ── Bars ── */
    P({ id: 'quest-bar-cccd', brand: 'Quest', line: 'Protein Bar', flavor: 'Chocolate Chip Cookie Dough', cat: 'bar',
      unit: 'bar', serv: '1 bar (60 g)', g: 60, p: 21, cal: 190, c: 22, f: 9, status: 'verified', key: ['cookie dough', 'chocolate chip'],
      src: mfr('questnutrition.com', 'https://www.questnutrition.com/products/chocolate-chip-cookie-dough-protein-bar'),
      note: 'Another panel on the same page lists 200 calories. Quest flavors differ, so other flavors aren’t assumed.' }),

    /* ── Pantry ── */
    P({ id: 'jif-creamy', brand: 'Jif', line: 'Creamy Peanut Butter', flavor: null, cat: 'spread',
      unit: 'serving', serv: '2 tbsp (33 g)', g: 33, p: 7, cal: 190, c: 8, f: 16, status: 'verified',
      units: { tbsp: 0.5, spoon: 0.5, spoonful: 0.5, tsp: 0.167, scoop: 1 }, approx: ['spoon', 'spoonful', 'scoop'],
      src: mfr('jif.com', 'https://www.jif.com/products/creamy/creamy-peanut-butter'),
      note: 'Jif Natural, No Added Sugar and Simply are different products (8 g per 2 tbsp).' }),
    P({ id: 'barilla-protein-plus', brand: 'Barilla', line: 'Protein+ Pasta', flavor: null, cat: 'pasta',
      unit: 'serving', serv: '3.5 oz dry (≈100 g)', g: 100, p: 17, cal: null, c: null, f: null, status: 'verified',
      src: mfr('barilla.com', 'https://www.barilla.com/en-us/products/pasta/protein-plus/proteinplus-spaghetti'),
      note: 'US label: 17 g protein per 3.5 oz. Calories, carbs and fat weren’t shown, so they’re estimated from typical dry pasta.',
      est: { cal: 350, c: 65, f: 2.5 }, units: { box: 4.1, package: 4.1, cup: 0.9 }, approx: ['cup'] }),
    P({ id: 'kraft-singles-american', brand: 'Kraft', line: 'Singles American Slices', flavor: null, cat: 'cheese',
      unit: 'slice', serv: '1 slice (21 g)', g: 21, p: 4, cal: 50, c: null, f: null, status: 'verified', key: ['single', 'american', 'slice'],
      units: { serving: 1, single: 1 },
      src: mfr('kraftheinz.com', 'https://www.kraftheinz.com/kraft-singles/products/00021000604647-american-cheese-slices'),
      note: 'US pack. Thin, 2% milk and extra-thick slices are different products.' }),
    P({ id: 'oscar-mayer-beef-franks', brand: 'Oscar Mayer', line: 'Classic Beef Franks', flavor: null, cat: 'hotdog',
      unit: 'frank', serv: '1 link (42 g)', g: 42, p: 5, cal: 140, c: null, f: 12, status: 'verified', key: ['beef', 'frank'], a: ['beef hot dog', 'beef frank'],
      units: { link: 1, piece: 1, serving: 1, 'hot dog': 1 },
      src: mfr('oscarmayer.com', 'https://www.oscarmayer.com/products/00044700075050-classic-beef-franks-hot-dogs') }),
    P({ id: 'oscar-mayer-wieners', brand: 'Oscar Mayer', line: 'Classic Wieners', flavor: null, cat: 'hotdog',
      unit: 'wiener', serv: '1 link (45 g)', g: 45, p: 5, cal: 120, c: null, f: null, status: 'verified', key: ['wiener', 'weiner'],
      units: { link: 1, piece: 1, serving: 1, 'hot dog': 1 },
      src: mfr('oscarmayer.com', 'https://www.oscarmayer.com/products/00044700000632-classic-uncured-wieners-hot-dogs') }),
    P({ id: 'kodiak-power-cakes', brand: 'Kodiak', line: 'Power Cakes Flapjack & Waffle Mix', flavor: 'Buttermilk', cat: 'pancake',
      unit: 'serving', serv: '1 serving of dry mix (as packaged)', p: 15, cal: 220, c: 37, f: 2.5, status: 'verified', a: ['power cakes', 'kodiak cakes'],
      src: mfr('kodiakcakes.com', 'https://kodiakcakes.com/products/buttermilk-power-cakes-flapjack-waffle-mix'),
      note: 'Made with water. Kodiak says up to 18 g with milk, 21 g with milk and eggs.' }),

    /* ── Added with the nutrition overhaul. Not re-checked online (no network when added), so marked estimated
       until you confirm them against your package — confirming or correcting saves them as yours. ── */
    P({ id: 'raos-marinara', brand: "Rao's", line: 'Homemade Marinara Sauce', flavor: null, cat: 'sauce', checked: null,
      unit: 'serving', serv: '½ cup (125 g)', g: 125, p: 2, cal: 100, c: 7, f: 7, status: 'estimated', key: ['marinara', 'sauce'], a: ['raos marinara', 'raos sauce'],
      units: { jar: 5.5, cup: 2, tbsp: 0.125, ladle: 1 }, approx: ['cup', 'tbsp', 'ladle'],
      src: retail('Typical label for the 24 oz jar', 'https://www.raos.com/products/marinara-sauce'),
      note: 'Typical label values for the 24 oz jar (about 5½ servings). Check your jar; the 32 oz jar has more servings.' }),
    P({ id: 'raos-arrabbiata', brand: "Rao's", line: 'Arrabbiata Sauce', flavor: null, cat: 'sauce', checked: null,
      unit: 'serving', serv: '½ cup (125 g)', g: 125, p: 2, cal: 90, c: 7, f: 6, status: 'estimated', key: ['arrabbiata'],
      units: { jar: 5.5, cup: 2, tbsp: 0.125 }, approx: ['cup', 'tbsp'],
      src: retail('Typical label for the 24 oz jar', 'https://www.raos.com/'), note: 'Typical label values. Check your jar.' }),
    P({ id: 'oscar-mayer-turkey', brand: 'Oscar Mayer', line: 'Deli Fresh Oven Roasted Turkey Breast', flavor: null, cat: 'deli', checked: null,
      unit: 'serving', serv: '2 oz (56 g)', g: 56, p: 9, cal: 50, c: 2, f: 1, status: 'estimated', key: ['turkey'], a: ['oscar mayer turkey', 'oscar mayer deli turkey'],
      units: { slice: 0.17, package: 4, pack: 4, sandwich: 1 }, approx: ['slice', 'sandwich'],
      src: retail('Typical label for the 9 oz package', 'https://www.oscarmayer.com/'), note: 'Slice weights vary by package; 6 thin slices are about one serving.' }),
    P({ id: 'oscar-mayer-ham', brand: 'Oscar Mayer', line: 'Deli Fresh Honey Ham', flavor: null, cat: 'deli', checked: null,
      unit: 'serving', serv: '2 oz (56 g)', g: 56, p: 9, cal: 60, c: 3, f: 1.5, status: 'estimated', key: ['ham'], a: ['oscar mayer ham', 'oscar mayer honey ham'],
      units: { slice: 0.17, package: 4, pack: 4, sandwich: 1 }, approx: ['slice', 'sandwich'],
      src: retail('Typical label for the 9 oz package', 'https://www.oscarmayer.com/'), note: 'Slice weights vary by package.' }),
    P({ id: 'oscar-mayer-bologna', brand: 'Oscar Mayer', line: 'Bologna', flavor: null, cat: 'deli', checked: null,
      unit: 'slice', serv: '1 slice (28 g)', g: 28, p: 3, cal: 90, c: 1, f: 8, status: 'estimated', key: ['bologna', 'baloney'],
      units: { serving: 1, package: 16 }, src: retail('Typical label for the 16 oz package', 'https://www.oscarmayer.com/') }),
    P({ id: 'daves-21-whole-grains', brand: "Dave's Killer Bread", line: '21 Whole Grains and Seeds', flavor: null, cat: 'bread', checked: null,
      unit: 'slice', serv: '1 slice (45 g)', g: 45, p: 5, cal: 110, c: 22, f: 1.5, status: 'estimated', key: ['21', 'whole grain'], a: ['daves killer bread', 'dave killer bread'],
      units: { serving: 1, piece: 1, toast: 1 }, src: retail('Typical label', 'https://www.daveskillerbread.com/'), note: 'Thin-sliced versions are about 70 calories a slice.' }),
  ];

  /** Words that name a product category; used to keep "Fairlife shake" from matching Fairlife milk. */
  WT.PRODUCT_CATS = {
    shake: 'shake', drink: 'shake', smoothie: 'shake', bar: 'bar', yogurt: 'yogurt', yoghurt: 'yogurt', skyr: 'yogurt',
    milk: 'milk', cheese: 'cheese', single: 'cheese', pasta: 'pasta', spaghetti: 'pasta', penne: 'pasta', noodle: 'pasta', rotini: 'pasta', farfalle: 'pasta',
    frank: 'hotdog', wiener: 'hotdog', sauce: 'sauce', marinara: 'sauce', deli: 'deli', bread: 'bread', toast: 'bread', weiner: 'hotdog', hotdog: 'hotdog', dog: 'hotdog', butter: 'spread', pancake: 'pancake', waffle: 'pancake', flapjack: 'pancake',
  };
  /** Flavor words: naming one a product doesn't list marks the match as uncertain instead of assuming. */
  WT.FLAVOR_WORDS = ['latte', 'cafe', 'espresso', 'vanilla', 'chocolate', 'strawberry', 'strawberries', 'banana', 'snickerdoodle', 'cinnamon', 'caramel', 'mocha', 'coffee', 'cookie', 'cookies', 'cream', 'peanut', 'blueberry', 'raspberry', 'cherry', 'peach', 'mango', 'lemon', 'lime', 'coconut', 'pumpkin', 'birthday', 'cake', 'batter', 'mint', 'berry', 'mixed', 'honey', 'maple', 'salted', 'toffee', 'brownie', 'fudge', 'dough', 'smores', 'pecan', 'almond', 'pistachio', 'chai', 'eggnog', 'gingerbread', 'churro'];
})();
