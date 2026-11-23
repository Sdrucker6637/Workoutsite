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
  // Phase 4 helpers: grocery products checked 2026-11-22; `rl` = retailer label listings that agree
  const G = (o) => P(Object.assign({ checked: '2026-11-22' }, o));
  const rl = (names, url) => ({ kind: 'retailer', name: names ? `Retailer label listings (${names})` : 'Retailer label listings', url });
  const code = (c, from, flavor) => ({ code: c, from, flavor: flavor || null });
  const YOG = { container: 1, serving: 1, tbsp: 0.1, spoon: 0.1, spoonful: 0.1, tsp: 0.033, scoop: 0.4 };
  const YOG_APPROX = ['tbsp', 'spoon', 'spoonful', 'tsp', 'scoop'];
  const MILK = { glass: 1, serving: 1, splash: 0.1, tbsp: 0.0625 };
  const BREAD = { serving: 1, piece: 1, toast: 1 };
  // deli slices vary by package (≈9–10 g for regular-cut, less for thin): a slice is a conversion, marked ≈
  const DELI = { slice: 0.17, sandwich: 1 };
  const DELI_APPROX = ['slice', 'sandwich'];
  const PASTA = { cup: 1, plate: 2, bowl: 2 };
  const PASTA_APPROX = ['cup', 'plate', 'bowl'];
  // ½ cup = 8 tbsp, so 3 tbsp is 3/8 of a serving
  const SAUCE = { cup: 2, tbsp: 0.125, ladle: 1 };
  const SAUCE_APPROX = ['cup', 'tbsp', 'ladle'];

  WT.PRODUCTS = [
    /* ── Protein shakes ── */
    P({ id: 'pioneer-a2-shake', brand: 'Pioneer Pastures', line: 'A2 Protein Shake', flavor: 'Vanilla', flavors: ['Chocolate', 'Strawberries & Cream'], cat: 'shake',
      unit: 'bottle', serv: '1 bottle (11 fl oz)', p: 30, cal: 160, c: null, f: null, status: 'verified',
      src: mfr('pioneerpastures.com', 'https://pioneerpastures.com/products/a2-vanilla-protein-shake'), upc: [code('850067605041', 'Open Food Facts (Chocolate)', 'Chocolate')],
      note: '30 g protein and 160 calories per bottle for Vanilla and Chocolate; 30 g for Strawberries & Cream. Carbs and fat not shown on the page.',
      flavorData: { 'Strawberries & Cream': { cal: null } } }),
    P({ id: 'premier-protein-shake', brand: 'Premier Protein', line: 'Protein Shake', flavor: 'Chocolate', flavors: ['Vanilla', 'Cookies & Cream', 'Cookie Dough', 'Cake Batter', 'Bananas & Cream', 'Peaches & Cream', 'Pumpkin Spice', 'Lemon Bar'], cat: 'shake',
      unit: 'bottle', serv: '1 bottle', p: 30, cal: 160, c: 4, f: 3, status: 'verified', a: ['premier protein', 'premier shake'],
      src: mfr('premierprotein.com', 'https://www.premierprotein.com/products/chocolate-protein-shake'),
      note: 'Every listed flavor shows 30 g protein and 160 calories; carbs and fat are from the Chocolate label.', flavorOnly: ['p', 'cal'] }),
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
      units: { container: 1, serving: 1, tbsp: 0.1, spoon: 0.1, spoonful: 0.1, tsp: 0.033, scoop: 0.4 }, approx: ['tbsp', 'spoon', 'spoonful', 'tsp', 'scoop'],
      src: mfr('oikos.com', 'https://www.oikos.com/all-products/triple-zero/product/vanilla/'), upc: [code('036632008343', 'ShopRite listing')],
      note: 'Single 5.3-oz cup. One multipack panel lists 90 calories; protein is 15 g on all.' }),
    P({ id: 'oikos-pro-yogurt', brand: 'Oikos', line: 'Pro High Protein Yogurt', flavor: 'Vanilla', flavors: ['Banana', 'Strawberry'], cat: 'yogurt',
      unit: 'cup', serv: '1 cup (5.3 oz / 150 g)', g: 150, p: 20, cal: 130, c: 6, f: 3, status: 'verified', key: ['pro'], a: ['oikos pro'],
      units: { container: 1, serving: 1, tbsp: 0.1, spoon: 0.1, spoonful: 0.1, tsp: 0.033, scoop: 0.4 }, approx: ['tbsp', 'spoon', 'spoonful', 'tsp', 'scoop'],
      src: mfr('oikos.com', 'https://www.oikos.com/all-products/pro-yogurt-cultured-ultra-filtered-milk/product/vanilla/') }),
    P({ id: 'chobani-complete-cup', brand: 'Chobani', line: 'Complete Greek Yogurt', flavor: 'Vanilla', flavors: ['Mixed Berry'], cat: 'yogurt',
      unit: 'cup', serv: '1 cup (5.3 oz / 150 g)', g: 150, p: 15, cal: 120, c: null, f: 0, status: 'estimated', key: ['complete'],
      units: { container: 1, serving: 1, tbsp: 0.1, spoon: 0.1, spoonful: 0.1, tsp: 0.033, scoop: 0.4 }, approx: ['tbsp', 'spoon', 'spoonful', 'tsp', 'scoop'],
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
      src: mfr('jif.com', 'https://www.jif.com/products/creamy/creamy-peanut-butter'), pkg: { unit: 'jar', size: '16 oz', g: 454, servings: 14 },
      note: 'Jif Natural, No Added Sugar and Simply are different products (8 g per 2 tbsp).' }),
    P({ id: 'barilla-protein-plus', brand: 'Barilla', line: 'Protein+ Pasta', flavor: null, cat: 'pasta', checked: '2026-11-22',
      unit: 'serving', serv: '2 oz dry (56 g)', g: 56, p: 10, cal: 190, c: 38, f: 1, status: 'reference', units: PASTA, approx: PASTA_APPROX,
      pkg: { unit: 'box', size: '14.5 oz', g: 411, servings: 7 }, upc: [code('076808533606', 'King Kullen listing / Open Food Facts (penne)')],
      src: rl('Target, Giant, FatSecret', 'https://www.target.com/p/barilla-proteinplus-multigrain-penne-pasta-14-5oz/-/A-13156217'),
      note: 'Per 2 oz dry. Barilla’s “17 g protein” is per 3.5 oz (100 g) — the same pasta, a bigger portion.' }),
    P({ id: 'kraft-singles-american', brand: 'Kraft', line: 'Singles American Slices', flavor: null, cat: 'cheese',
      unit: 'slice', serv: '1 slice (21 g)', g: 21, p: 4, cal: 50, c: null, f: null, status: 'verified', key: ['single', 'american', 'slice'],
      units: { serving: 1, single: 1 }, upc: [code('021000604647', 'kraftheinz.com product id')],
      src: mfr('kraftheinz.com', 'https://www.kraftheinz.com/kraft-singles/products/00021000604647-american-cheese-slices'),
      note: 'US pack. Thin, 2% milk and extra-thick slices are different products.' }),
    P({ id: 'oscar-mayer-beef-franks', brand: 'Oscar Mayer', line: 'Classic Beef Franks', flavor: null, cat: 'hotdog',
      unit: 'frank', serv: '1 link (42 g)', g: 42, p: 5, cal: 140, c: null, f: 12, status: 'verified', key: ['beef', 'frank'], a: ['beef hot dog', 'beef frank'],
      units: { link: 1, piece: 1, serving: 1, 'hot dog': 1 },
      src: mfr('oscarmayer.com', 'https://www.oscarmayer.com/products/00044700075050-classic-beef-franks-hot-dogs'), upc: [code('044700075050', 'oscarmayer.com product id')] }),
    P({ id: 'oscar-mayer-wieners', brand: 'Oscar Mayer', line: 'Classic Wieners', flavor: null, cat: 'hotdog',
      unit: 'wiener', serv: '1 link (45 g)', g: 45, p: 5, cal: 120, c: null, f: null, status: 'verified', key: ['wiener', 'weiner'],
      units: { link: 1, piece: 1, serving: 1, 'hot dog': 1 },
      src: mfr('oscarmayer.com', 'https://www.oscarmayer.com/products/00044700000632-classic-uncured-wieners-hot-dogs'), upc: [code('044700000632', 'oscarmayer.com product id')] }),
    P({ id: 'kodiak-power-cakes', brand: 'Kodiak', line: 'Power Cakes Flapjack & Waffle Mix', flavor: 'Buttermilk', cat: 'pancake',
      unit: 'serving', serv: '1 serving of dry mix (as packaged)', p: 15, cal: 220, c: 37, f: 2.5, status: 'verified', a: ['power cakes', 'kodiak cakes'],
      src: mfr('kodiakcakes.com', 'https://kodiakcakes.com/products/buttermilk-power-cakes-flapjack-waffle-mix'), upc: [code('705599011627', 'Open Food Facts')],
      note: 'Made with water. Kodiak says up to 18 g with milk, 21 g with milk and eggs.' }),

    /* ── Added with the nutrition overhaul. Not re-checked online (no network when added), so marked estimated
       until you confirm them against your package — confirming or correcting saves them as yours. ── */
    P({ id: 'raos-marinara', brand: "Rao's", line: 'Homemade Marinara Sauce', flavor: null, cat: 'sauce', checked: '2026-11-22',
      unit: 'serving', serv: '½ cup (125 g)', g: 125, p: 2, cal: 100, c: 6, f: 7, status: 'reference', key: ['marinara'], a: ['raos marinara'],
      units: SAUCE, approx: SAUCE_APPROX,
      src: rl('Giant, Hannaford, Food Lion, Stop & Shop', 'https://giantfoodstores.com/groceries/rice-pasta-beans/pasta-sauce/marinara-pasta-sauce-shelf-stable/raos-homemade-all-natural-marinara-pasta-sauce-24-oz-jar.html'),
      note: 'The 24 oz jar says about 5 servings. Sensitive Formula is a different sauce.' }),
    P({ id: 'raos-arrabbiata', brand: "Rao's", line: 'Arrabbiata Sauce', flavor: null, cat: 'sauce', checked: null,
      unit: 'serving', serv: '½ cup (125 g)', g: 125, p: 2, cal: 90, c: 7, f: 6, status: 'estimated', key: ['arrabbiata', 'arrabiata'],
      units: { cup: 2, tbsp: 0.125 }, approx: ['cup', 'tbsp'],
      src: retail('Typical label for the 24 oz jar', 'https://www.raos.com/'), note: 'Typical label values. Check your jar.' }),
    P({ id: 'oscar-mayer-turkey', brand: 'Oscar Mayer', line: 'Deli Fresh Oven Roasted Turkey Breast', flavor: null, cat: 'deli', checked: '2026-11-22',
      unit: 'serving', serv: '2 oz (56 g)', g: 56, p: 9, cal: 60, c: 2, f: 1, status: 'estimated', key: ['oven roasted turkey', 'roasted turkey'],
      units: DELI, approx: DELI_APPROX, pkg: { unit: 'package', size: '9 oz', g: 255, servings: 4.5 }, upc: [code('044700030509', 'oscarmayer.com product id')],
      src: mfr('oscarmayer.com (calories, protein) + Giant / Food Lion', 'https://www.oscarmayer.com/products/00044700030509'), note: 'Carbs and fat are from the older label. Slice weights vary by package.' }),
    P({ id: 'oscar-mayer-ham', pkg: { unit: 'package', size: '9 oz', g: 255, servings: 4.5 }, brand: 'Oscar Mayer', line: 'Deli Fresh Honey Ham', flavor: null, cat: 'deli', checked: null,
      unit: 'serving', serv: '2 oz (56 g)', g: 56, p: 9, cal: 60, c: 3, f: 1.5, status: 'estimated', key: ['honey ham'],
      units: { slice: 0.17, package: 4, pack: 4, sandwich: 1 }, approx: ['slice', 'sandwich'],
      src: retail('Typical label for the 9 oz package', 'https://www.oscarmayer.com/'), note: 'Slice weights vary by package.' }),
    P({ id: 'oscar-mayer-bologna', brand: 'Oscar Mayer', line: 'Bologna', flavor: null, cat: 'deli', checked: null,
      unit: 'slice', serv: '1 slice (28 g)', g: 28, p: 3, cal: 90, c: 1, f: 8, status: 'estimated', key: ['bologna', 'baloney'],
      units: { serving: 1, package: 16 }, src: retail('Typical label for the 16 oz package', 'https://www.oscarmayer.com/') }),
    P({ id: 'daves-21-whole-grains', brand: "Dave's Killer Bread", line: '21 Whole Grains and Seeds', flavor: null, cat: 'bread', checked: null,
      unit: 'slice', serv: '1 slice (45 g)', g: 45, p: 5, cal: 110, c: 22, f: 1.5, status: 'estimated', key: ['21', 'whole grain'], a: ['daves killer bread', 'dave killer bread'],
      units: { serving: 1, piece: 1, toast: 1 }, src: retail('Typical label', 'https://www.daveskillerbread.com/'), note: 'Thin-sliced versions are about 70 calories a slice.' }),

    /* ═════════ Phase 4: grocery label data (checked 2026-11-22) ═════════
     * Rules for this block:
     *   verified  — every value is on a page the manufacturer publishes (product page or SmartLabel).
     *   reference — the same label values appear on two or more retailer listings (named in `src`), or a
     *               manufacturer page for some values plus a retailer listing for the rest.
     *   estimated — the listings disagree, or only one third-party source had the value. The note says which.
     * A value no source showed is null — never filled in. `upc` is a barcode printed in a retailer/Open Food Facts
     * listing for that exact item; every one passes the GS1 check digit. `pkg` is the package: its net weight and
     * the label's servings per package, so "half a jar" and "the whole bag" are read from the package, not guessed.
     * `cl` links the product to its line in js/brands.js. */

    /* ── Yogurt ── */
    G({ id: 'oikos-tz-mixed-berry', cl: 'oikos:triple-zero', brand: 'Oikos', line: 'Triple Zero Greek Nonfat Yogurt', flavor: 'Mixed Berry', cat: 'yogurt',
      unit: 'cup', serv: '1 cup (5.3 oz / 150 g)', g: 150, p: 15, cal: 90, c: 7, f: 0, status: 'reference', key: ['triple zero', '000'], units: YOG, approx: YOG_APPROX,
      upc: [code('036632008350', 'ShopRite listing')], src: rl('ShopRite, Food Lion, Kroger', 'https://www.shoprite.com/sm/pickup/rsid/3000/product/oikos-triple-zero-mixed-berry-greek-yogurt-53-oz-id-00036632008350') }),
    G({ id: 'oikos-tz-strawberry', cl: 'oikos:triple-zero', brand: 'Oikos', line: 'Triple Zero Greek Nonfat Yogurt', flavor: 'Strawberry', cat: 'yogurt',
      unit: 'cup', serv: '1 cup (5.3 oz / 150 g)', g: 150, p: 15, cal: 90, c: 7, f: 0, status: 'reference', key: ['triple zero', '000'], units: YOG, approx: YOG_APPROX,
      src: rl('H-E-B, Food Lion', 'https://www.heb.com/search/?q=oikos+triple+zero+strawberry') }),
    G({ id: 'oikos-tz-peach', cl: 'oikos:triple-zero', brand: 'Oikos', line: 'Triple Zero Greek Nonfat Yogurt', flavor: 'Peach', cat: 'yogurt',
      unit: 'cup', serv: '1 cup (5.3 oz / 150 g)', g: 150, p: 15, cal: 90, c: 7, f: 0, status: 'reference', key: ['triple zero', '000'], units: YOG, approx: YOG_APPROX,
      src: rl('Food Lion, Publix; protein also on oikos.com', 'https://www.oikos.com/all-products/triple-zero/') }),
    G({ id: 'chobani-plain-nonfat', cl: 'chobani:greek-yogurt-nonfat-plain', brand: 'Chobani', line: 'Greek Yogurt Plain Non-Fat', flavor: null, cat: 'yogurt',
      unit: 'cup', serv: '1 cup (5.3 oz / 150 g)', g: 150, p: 14, cal: 80, c: 6, f: 0, status: 'reference', key: ['plain'], units: YOG, approx: YOG_APPROX,
      upc: [code('894700010014', 'Open Food Facts')], src: rl('retailer listings and Open Food Facts', 'https://world.openfoodfacts.org/product/0894700010014'),
      note: 'Single 5.3-oz cup. The 32 oz tub lists ¾ cup servings.' }),
    G({ id: 'chobani-zero-sugar-vanilla', cl: 'chobani:zero-sugar', brand: 'Chobani', line: 'Zero Sugar Greek Yogurt', flavor: 'Vanilla', cat: 'yogurt',
      unit: 'cup', serv: '1 cup (5.3 oz / 150 g)', g: 150, p: 11, cal: 60, c: 5, f: 0, status: 'estimated', key: ['zero sugar'], units: YOG, approx: YOG_APPROX,
      upc: [code('818290018281', 'ShopRite listing')], src: rl('ShopRite and other retailer listings', 'https://www.shoprite.com/sm/pickup/rsid/3000/product/chobani-zero-sugar-vanilla-greek-yogurt-53-oz-id-00818290018281'),
      note: 'Listings disagree on protein (11 g vs 12 g) — check your cup.' }),
    G({ id: 'fage-total-0-plain', cl: 'fage:total-0', brand: 'Fage', line: 'Total 0% Plain Greek Yogurt', flavor: null, cat: 'yogurt',
      unit: 'cup', serv: '1 cup (5.3 oz / 150 g)', g: 150, p: 16, cal: 80, c: 5, f: 0, status: 'reference', key: ['total 0', '0%', 'nonfat'], units: YOG, approx: YOG_APPROX,
      upc: [code('689544080008', 'retailer listing')], src: rl('Super 1 Foods, ShopRite', 'https://www.fage.us/products/yogurt/fage-total-0-plain/') }),
    G({ id: 'fage-total-2-plain', cl: 'fage:total-2', brand: 'Fage', line: 'Total 2% Plain Greek Yogurt', flavor: null, cat: 'yogurt',
      unit: 'cup', serv: '1 cup (5.3 oz / 150 g)', g: 150, p: 15, cal: 100, c: 5, f: 3, status: 'reference', key: ['total 2', '2%'], units: YOG, approx: YOG_APPROX,
      upc: [code('689544080206', 'Open Food Facts / ShopRite')], src: rl('ShopRite, Open Food Facts', 'https://world.openfoodfacts.org/product/0689544080206') }),
    G({ id: 'siggis-vanilla-skyr', cl: 'siggis:icelandic-skyr', brand: "Siggi's", line: 'Icelandic Skyr Nonfat', flavor: 'Vanilla', cat: 'yogurt',
      unit: 'cup', serv: '1 cup (5.3 oz / 150 g)', g: 150, p: 16, cal: 110, c: 11, f: 0, status: 'reference', key: ['skyr'], units: YOG, approx: YOG_APPROX,
      upc: [code('898248001077', 'retailer listing')], src: rl("siggis.com and ShopRite", 'https://siggis.com/products/vanilla-skyr/') }),
    G({ id: 'two-good-vanilla', cl: 'two-good:greek-yogurt', brand: 'Two Good', line: 'Greek Yogurt', flavor: 'Vanilla', cat: 'yogurt',
      unit: 'cup', serv: '1 cup (5.3 oz / 150 g)', g: 150, p: 12, cal: 80, c: 4, f: 2, status: 'reference', key: ['greek'], units: YOG, approx: YOG_APPROX,
      upc: [code('036632039040', 'ShopRite listing')], src: rl('ShopRite and other retailer listings', 'https://www.shoprite.com/sm/pickup/rsid/3000/product/two-good-vanilla-greek-yogurt-53-oz-id-00036632039040') }),
    G({ id: 'ratio-protein-vanilla', cl: 'ratio:protein-yogurt', brand: 'Ratio', line: 'Protein Yogurt', flavor: 'Vanilla', cat: 'yogurt',
      unit: 'cup', serv: '1 cup (5.3 oz / 150 g)', g: 150, p: 25, cal: 170, c: null, f: 4, status: 'estimated', key: ['protein'], units: YOG, approx: YOG_APPROX,
      src: rl('', 'https://www.ratiofood.com/'), note: 'Carbs not shown by the sources found — left blank.' }),
    G({ id: 'good-culture-2-cottage', cl: 'good-culture:cottage-cheese', brand: 'Good Culture', line: 'Cottage Cheese 2%', flavor: null, cat: 'cottage',
      unit: 'cup', serv: '1 cup (5.3 oz / 150 g)', g: 150, p: 19, cal: 130, c: 5, f: 3, status: 'estimated', key: ['cottage'], units: YOG, approx: YOG_APPROX,
      upc: [code('859977005149', 'Kroger listing')], src: rl('Hannaford listing', 'https://www.goodculture.com/'),
      note: 'Listings range 120–140 calories for the single-serve cup — check yours.' }),

    /* ── Milk ── */
    G({ id: 'fairlife-whole-milk', cl: 'fairlife:ultra-filtered-milk-whole', brand: 'fairlife', line: 'Ultra-Filtered Whole Milk', flavor: null, cat: 'milk',
      unit: 'cup', serv: '1 cup (240 mL)', g: 240, p: 13, cal: 150, c: 6, f: 8, status: 'reference', key: ['whole'], units: MILK, approx: ['splash'],
      pkg: { unit: 'bottle', size: '52 fl oz', g: 1538, servings: 6.5 }, upc: [code('811620020169', 'retailer listing')], src: rl('', 'https://fairlife.com/ultra-filtered-milk/whole-milk/') }),
    G({ id: 'fairlife-fat-free-milk', cl: 'fairlife:ultra-filtered-milk-fat-free', brand: 'fairlife', line: 'Ultra-Filtered Fat Free Milk', flavor: null, cat: 'milk',
      unit: 'cup', serv: '1 cup (240 mL)', g: 240, p: 13, cal: 80, c: 6, f: 0, status: 'reference', key: ['fat free', 'skim', 'nonfat'], units: MILK, approx: ['splash'],
      pkg: { unit: 'bottle', size: '52 fl oz', g: 1538, servings: 6.5 }, upc: [code('856312002757', 'Open Food Facts')], src: rl('retailer listings, Open Food Facts', 'https://world.openfoodfacts.org/product/0856312002757') }),
    G({ id: 'fairlife-2-chocolate', cl: 'fairlife:ultra-filtered-chocolate-milk', brand: 'fairlife', line: 'Ultra-Filtered 2% Chocolate Milk', flavor: null, cat: 'milk',
      unit: 'cup', serv: '1 cup (240 mL)', g: 240, p: 13, cal: 140, c: 13, f: 4.5, status: 'reference', key: ['chocolate milk', 'chocolate'], units: MILK, approx: ['splash'],
      src: rl('Food Lion; fairlife.com', 'https://fairlife.com/ultra-filtered-milk/2-reduced-fat-chocolate-milk/'), note: 'The 14 oz single bottle is a different serving (about 250 calories).' }),

    /* ── Shakes & powder ── */
    G({ id: 'muscle-milk-genuine-choc', cl: 'muscle-milk:genuine-protein-shake', brand: 'Muscle Milk', line: 'Genuine Protein Shake', flavor: 'Chocolate', cat: 'shake',
      unit: 'bottle', serv: '1 bottle (11 fl oz)', p: 25, cal: 160, c: null, f: 4.5, status: 'estimated', key: ['genuine'],
      src: rl('', 'https://www.musclemilk.com/'), note: 'A reformulated label lists 26 g protein; carbs not shown by the sources found.' }),
    G({ id: 'orgain-shake-chocolate', cl: 'orgain:organic-protein-shake', brand: 'Orgain', line: 'Organic Nutritional Shake', flavor: 'Creamy Chocolate Fudge', cat: 'shake',
      unit: 'bottle', serv: '1 bottle (11 fl oz)', p: 16, cal: 250, c: 32, f: 7, status: 'estimated', key: ['shake'],
      src: rl('', 'https://orgain.com/'), note: 'One listing shows 8 g fat. Orgain’s 26 g "Protein Shake" is a different product.' }),
    G({ id: 'ensure-max-chocolate', cl: 'ensure:max-protein', brand: 'Ensure', line: 'Max Protein Shake', flavor: 'Milk Chocolate', cat: 'shake',
      unit: 'bottle', serv: '1 bottle (11 fl oz)', p: 30, cal: 150, c: null, f: 1.5, status: 'estimated', key: ['max'],
      src: rl('', 'https://ensure.com/nutrition-products/ensure-max-protein-shake'), note: 'Carbs listed only as "less than 7 g" — left blank.' }),
    G({ id: 'on-gold-standard-choc', cl: 'optimum:gold-standard-100-whey', brand: 'Optimum Nutrition', line: 'Gold Standard 100% Whey', flavor: 'Double Rich Chocolate', cat: 'powder',
      unit: 'scoop', serv: '1 scoop (30.4 g)', g: 30.4, p: 24, cal: 120, c: null, f: 1.5, status: 'estimated', key: ['whey', 'gold standard'], units: { serving: 1 },
      src: rl('', 'https://www.optimumnutrition.com/'), note: 'Carbs not shown by the sources found — left blank.' }),

    /* ── Bars ── */
    G({ id: 'quest-bar-cookies-cream', cl: 'quest:protein-bar', brand: 'Quest', line: 'Protein Bar', flavor: 'Cookies & Cream', cat: 'bar',
      unit: 'bar', serv: '1 bar (60 g)', g: 60, p: 21, cal: 190, c: 22, f: 8, status: 'reference', key: ['cookies and cream', 'cookies cream'],
      upc: [code('888849000005', 'Open Food Facts')], src: rl('questnutrition.com (calories, fat) and Vitacost (carbs)', 'https://www.questnutrition.com/products/cookies-cream-protein-bar') }),
    G({ id: 'quest-bar-birthday-cake', cl: 'quest:protein-bar', brand: 'Quest', line: 'Protein Bar', flavor: 'Birthday Cake', cat: 'bar',
      unit: 'bar', serv: '1 bar (60 g)', g: 60, p: 21, cal: 180, c: 24, f: 6, status: 'reference', key: ['birthday cake'],
      upc: [code('888849006687', 'Open Food Facts')], src: rl('', 'https://www.questnutrition.com/products/birthday-cake-protein-bar'), note: 'One listing shows 170 calories / 20 g protein.' }),
    G({ id: 'quest-bar-brownie', cl: 'quest:protein-bar', brand: 'Quest', line: 'Protein Bar', flavor: 'Chocolate Brownie', cat: 'bar',
      unit: 'bar', serv: '1 bar (60 g)', g: 60, p: 20, cal: 170, c: 23, f: 6, status: 'reference', key: ['brownie'],
      upc: [code('888849000418', 'Open Food Facts')], src: rl('questnutrition.com', 'https://www.questnutrition.com/products/chocolate-brownie-protein-bar') }),
    G({ id: 'barebells-cookies-cream', cl: 'barebells:protein-bar', brand: 'Barebells', line: 'Protein Bar', flavor: 'Cookies & Cream', cat: 'bar',
      unit: 'bar', serv: '1 bar (55 g)', g: 55, p: 20, cal: 200, c: 20, f: 7, status: 'reference', key: ['cookies and cream', 'cookies cream'],
      src: mfr('shop.barebells.com (via search summary)', 'https://shop.barebells.com/products/protein-bar-cookies-cream'), note: 'US bar. EU bars use different labels.' }),
    G({ id: 'barebells-salty-peanut', cl: 'barebells:protein-bar', brand: 'Barebells', line: 'Protein Bar', flavor: 'Salty Peanut', cat: 'bar',
      unit: 'bar', serv: '1 bar (55 g)', g: 55, p: 20, cal: 200, c: null, f: null, status: 'estimated', key: ['salty peanut'],
      src: rl('', 'https://shop.barebells.com/'), note: 'Sources disagree on carbs and fat — left blank.' }),
    G({ id: 'rxbar-choc-sea-salt', cl: 'rxbar:protein-bar', brand: 'RXBAR', line: 'Protein Bar', flavor: 'Chocolate Sea Salt', cat: 'bar',
      unit: 'bar', serv: '1 bar (52 g)', g: 52, p: 12, cal: 200, c: 23, f: 8, status: 'verified', key: ['sea salt'],
      upc: [code('857777004232', 'Open Food Facts')], src: mfr('Kellanova SmartLabel', 'https://smartlabel.kelloggs.com/Product/Index/10857777004307') }),
    G({ id: 'clif-builders-choc-pb', cl: 'clif:builders', brand: 'Clif', line: 'Builders Protein Bar', flavor: 'Chocolate Peanut Butter', cat: 'bar',
      unit: 'bar', serv: '1 bar (68 g)', g: 68, p: 20, cal: 290, c: 29, f: 11, status: 'reference', key: ['builders', 'builder'],
      src: rl('Kroger, FatSecret, MyFoodDiary', 'https://www.clifbar.com/') }),

    /* ── Bread & breakfast ── */
    G({ id: 'dkb-21-thin', cl: 'daves-killer-bread:21-whole-grains-and-seeds:thin-sliced', brand: "Dave's Killer Bread", line: '21 Whole Grains and Seeds Thin-Sliced', flavor: null, cat: 'bread',
      unit: 'slice', serv: '1 slice (28 g)', g: 28, p: 3, cal: 70, c: 13, f: 1, status: 'reference', key: ['21', 'thin'], units: BREAD,
      pkg: { unit: 'loaf', size: '20.5 oz', g: 581, servings: 20 }, upc: [code('013764027138', 'ShopRite listing')], src: rl('', 'https://www.daveskillerbread.com/'), note: 'A few listings show 60 calories.' }),
    G({ id: 'dkb-good-seed', cl: 'daves-killer-bread:good-seed', brand: "Dave's Killer Bread", line: 'Good Seed', flavor: null, cat: 'bread',
      unit: 'slice', serv: '1 slice (45 g)', g: 45, p: 5, cal: 120, c: 23, f: 2.5, status: 'reference', key: ['good seed'], units: BREAD,
      pkg: { unit: 'loaf', size: '27 oz', g: 765, servings: 17 }, upc: [code('013764027039', 'ShopRite listing')], src: rl('', 'https://www.daveskillerbread.com/') }),
    G({ id: 'dkb-good-seed-thin', cl: 'daves-killer-bread:good-seed:thin-sliced', brand: "Dave's Killer Bread", line: 'Good Seed Thin-Sliced', flavor: null, cat: 'bread',
      unit: 'slice', serv: '1 slice (28 g)', g: 28, p: 4, cal: 70, c: 13, f: 1.5, status: 'estimated', key: ['good seed', 'thin'], units: BREAD, src: rl('one retailer listing', 'https://www.daveskillerbread.com/') }),
    G({ id: 'dkb-powerseed', cl: 'daves-killer-bread:powerseed', brand: "Dave's Killer Bread", line: 'Powerseed', flavor: null, cat: 'bread',
      unit: 'slice', serv: '1 slice (42 g)', g: 42, p: 5, cal: 90, c: 18, f: 2, status: 'reference', key: ['powerseed', 'power seed'], units: BREAD,
      pkg: { unit: 'loaf', size: '25 oz', g: 709, servings: 16 }, upc: [code('013764027282', 'Open Food Facts')], src: rl('retailer listings, Open Food Facts', 'https://world.openfoodfacts.org/product/0013764027282') }),
    G({ id: 'dkb-powerseed-thin', cl: 'daves-killer-bread:powerseed:thin-sliced', brand: "Dave's Killer Bread", line: 'Powerseed Thin-Sliced', flavor: null, cat: 'bread',
      unit: 'slice', serv: '1 slice (28 g)', p: 4, g: 28, cal: 60, c: 12, f: 1.5, status: 'estimated', key: ['powerseed', 'thin'], units: BREAD, src: rl('one retailer listing', 'https://www.daveskillerbread.com/') }),
    G({ id: 'dkb-white-done-right', cl: 'daves-killer-bread:white-bread-done-right', brand: "Dave's Killer Bread", line: 'White Bread Done Right', flavor: null, cat: 'bread',
      unit: 'slice', serv: '1 slice (40 g)', g: 40, p: 4, cal: 110, c: 20, f: 2, status: 'reference', key: ['white', 'done right'], units: BREAD,
      pkg: { unit: 'loaf', size: '24 oz', g: 680, servings: 17 }, src: rl('', 'https://www.daveskillerbread.com/') }),
    G({ id: 'dkb-white-thin', cl: 'daves-killer-bread:white-bread-done-right:thin-sliced', brand: "Dave's Killer Bread", line: 'White Bread Done Right Thin-Sliced', flavor: null, cat: 'bread',
      unit: 'slice', serv: '1 slice', p: 3, cal: 70, c: 14, f: null, status: 'estimated', key: ['white', 'thin'], units: BREAD, src: rl('one retailer listing', 'https://www.daveskillerbread.com/'), note: 'Fat and slice weight not shown — left blank.' }),
    G({ id: 'dkb-100-whole-wheat', cl: 'daves-killer-bread:100-whole-wheat', brand: "Dave's Killer Bread", line: '100% Whole Wheat', flavor: null, cat: 'bread',
      unit: 'slice', serv: '1 slice (42 g)', g: 42, p: 4, cal: 100, c: 21, f: 1.5, status: 'reference', key: ['whole wheat'], units: BREAD,
      pkg: { unit: 'loaf', size: '25 oz', g: 709, servings: 16 }, upc: [code('013764027176', 'Kroger listing')], src: rl('', 'https://www.daveskillerbread.com/') }),
    G({ id: 'dkb-epic-everything', cl: 'daves-killer-bread:epic-everything-bagels', brand: "Dave's Killer Bread", line: 'Epic Everything Bagel', flavor: null, cat: 'bagel',
      unit: 'bagel', serv: '1 bagel (95 g)', g: 95, p: 13, cal: 280, c: 49, f: 6, status: 'reference', key: ['epic everything', 'everything'], units: { serving: 1, piece: 1, half: 0.5 },
      pkg: { unit: 'bag', size: '16.75 oz (5 bagels)', g: 475, servings: 5 }, src: rl('', 'https://www.daveskillerbread.com/'), note: 'One listing shows 260 calories.' }),
    G({ id: 'natures-own-whole-wheat', cl: 'natures-own:100-whole-wheat', brand: "Nature's Own", line: '100% Whole Wheat Bread', flavor: null, cat: 'bread',
      unit: 'slice', serv: '1 slice (26 g)', g: 26, p: 3, cal: 60, c: 12, f: 0.5, status: 'estimated', key: ['whole wheat'], units: BREAD,
      pkg: { unit: 'loaf', size: '20 oz', g: 567, servings: 22 }, upc: [code('072250037129', 'ShopRite listing')], src: rl('ShopRite label (calories, fat); FatSecret (carbs, protein)', 'https://www.naturesownbread.com/'),
      note: 'Label serving is 1 slice.' }),
    G({ id: 'thomas-original-muffin', cl: 'thomas:english-muffins', brand: "Thomas'", line: 'Original English Muffin', flavor: null, cat: 'muffin',
      unit: 'muffin', serv: '1 muffin (61 g)', g: 61, p: 5, cal: 150, c: 28, f: 1, status: 'reference', key: ['english muffin', 'original'], units: { serving: 1, piece: 1, half: 0.5 },
      pkg: { unit: 'pack', size: '6 muffins', g: 366, servings: 6 }, src: rl('', 'https://www.thomasbreads.com/') }),
    G({ id: 'quaker-old-fashioned', cl: 'quaker:old-fashioned-oats', brand: 'Quaker', line: 'Old Fashioned Oats', flavor: null, cat: 'oatmeal',
      unit: 'serving', serv: '½ cup dry (40 g)', g: 40, p: 5, cal: 150, c: 27, f: 3, status: 'reference', key: ['old fashioned', 'rolled'], units: { cup: 2 },
      pkg: { unit: 'container', size: '42 oz', g: 1191, servings: 30 }, src: rl('Publix, FatSecret', 'https://www.quakeroats.com/products/hot-cereals/old-fashioned-oats') }),

    /* ── Deli & meat (2 oz servings; a 9 oz package is about 4½) ── */
    G({ id: 'om-smoked-turkey', cl: 'oscar-mayer:deli-fresh-smoked-turkey-breast', brand: 'Oscar Mayer', line: 'Deli Fresh Smoked Turkey Breast', flavor: null, cat: 'deli',
      unit: 'serving', serv: '2 oz (56 g)', g: 56, p: 9, cal: 50, c: 2, f: 1, status: 'reference', key: ['smoked turkey'], units: DELI, approx: DELI_APPROX,
      pkg: { unit: 'package', size: '9 oz', g: 255, servings: 4.5 }, src: rl('Giant, ShopRite, Jewel-Osco', 'https://www.oscarmayer.com/') , note: 'Slices are about 9–10 g; weigh or count the label slices for accuracy.' }),
    G({ id: 'om-honey-smoked-turkey', cl: 'oscar-mayer:deli-fresh-honey-smoked-turkey-breast', brand: 'Oscar Mayer', line: 'Deli Fresh Honey Smoked Turkey Breast', flavor: null, cat: 'deli',
      unit: 'serving', serv: '2 oz (56 g)', g: 56, p: 9, cal: 50, c: 2, f: 1, status: 'estimated', key: ['honey smoked turkey', 'honey turkey'], units: DELI, approx: DELI_APPROX,
      pkg: { unit: 'package', size: '9 oz', g: 255, servings: 4.5 }, upc: [code('044700030950', 'ShopRite listing')], src: rl('', 'https://www.oscarmayer.com/'),
      note: 'oscarmayer.com lists 60 calories; retailers list 50. Protein 9–10 g.' }),
    G({ id: 'om-black-forest-ham', cl: 'oscar-mayer:deli-fresh-black-forest-ham', brand: 'Oscar Mayer', line: 'Deli Fresh Black Forest Ham', flavor: null, cat: 'deli',
      unit: 'serving', serv: '2 oz (56 g)', g: 56, p: 9, cal: 60, c: 1, f: 1.5, status: 'estimated', key: ['black forest'], units: DELI, approx: DELI_APPROX,
      pkg: { unit: 'package', size: '9 oz', g: 255, servings: 4.5 }, src: rl('Safeway, FatSecret', 'https://www.oscarmayer.com/') }),
    G({ id: 'om-rotisserie-chicken', cl: 'oscar-mayer:deli-fresh-rotisserie-seasoned-chicken-breast', brand: 'Oscar Mayer', line: 'Deli Fresh Rotisserie Seasoned Chicken Breast', flavor: null, cat: 'deli',
      unit: 'serving', serv: '2 oz (56 g)', g: 56, p: 8, cal: 50, c: null, f: 1, status: 'estimated', key: ['rotisserie chicken', 'rotisserie'], units: DELI, approx: DELI_APPROX,
      pkg: { unit: 'package', size: '8 oz', g: 227, servings: 4 }, src: rl('Giant listing', 'https://www.oscarmayer.com/'), note: 'Listings disagree on carbs (0–2 g) and protein (8–10 g).' }),
    G({ id: 'om-turkey-bacon', cl: 'oscar-mayer:turkey-bacon', brand: 'Oscar Mayer', line: 'Turkey Bacon', flavor: null, cat: 'bacon',
      unit: 'slice', serv: '1 slice (18 g)', g: 18, p: 3, cal: 45, c: 0, f: 3.5, status: 'estimated', key: ['turkey bacon'], units: { serving: 1, strip: 1, piece: 1 },
      upc: [code('071871548601', 'oscarmayer.com product id')], src: mfr('oscarmayer.com (calories, fat)', 'https://www.oscarmayer.com/products/00071871548601-original-turkey-bacon'), note: 'Protein and carbs are from retailer listings.' }),
    G({ id: 'om-center-cut-bacon', cl: 'oscar-mayer:center-cut-bacon', brand: 'Oscar Mayer', line: 'Center Cut Original Bacon', flavor: null, cat: 'bacon',
      unit: 'serving', serv: '2 slices cooked (13 g)', g: 13, p: null, cal: 60, c: 0, f: 4.5, status: 'estimated', key: ['center cut'], units: { slice: 0.5, strip: 0.5, piece: 0.5 },
      src: rl('', 'https://www.oscarmayer.com/'), note: 'Protein not confirmed by the sources found — left blank.' }),
    G({ id: 'hillshire-ultra-thin-turkey', cl: 'hillshire:ultra-thin-oven-roasted-turkey', brand: 'Hillshire Farm', line: 'Ultra Thin Oven Roasted Turkey Breast', flavor: null, cat: 'deli',
      unit: 'serving', serv: '2 oz (56 g)', g: 56, p: 10, cal: 60, c: 2, f: 1.5, status: 'reference', key: ['ultra thin', 'turkey'], units: DELI, approx: DELI_APPROX,
      pkg: { unit: 'package', size: '9 oz', g: 255, servings: 4.5 }, upc: [code('044500976502', 'hillshirefarm.com product id')], src: mfr('hillshirefarm.com product page (via search summary)', 'https://www.hillshirefarm.com/products/deli-lunch-meats/00044500976502'), note: 'Ultra-thin slices are light; count or weigh for accuracy.' }),
    G({ id: 'jack-links-original', cl: 'jack-links:original-beef-jerky', brand: "Jack Link's", line: 'Original Beef Jerky', flavor: null, cat: 'jerky',
      unit: 'serving', serv: '1 oz (28 g)', g: 28, p: 10, cal: 80, c: 6, f: 1.5, status: 'reference', key: ['original', 'jerky'], units: { piece: 0.12 }, approx: ['piece'],
      pkg: { unit: 'bag', size: '2.85 oz', g: 81, servings: 2.85 }, upc: [code('017082883919', 'Kroger listing')], src: mfr('jacklinks.com nutrition guide', 'https://www.jacklinks.com/?p=6823'),
      note: 'Some databases show an older label (15 g protein, 3 g carbs). Bags come in many sizes — pick yours.' }),

    /* ── Pasta & sauce ── */
    G({ id: 'barilla-classic', cl: 'barilla:classic-blue-box', brand: 'Barilla', line: 'Classic Blue Box Pasta', flavor: null, cat: 'pasta',
      unit: 'serving', serv: '2 oz dry (56 g)', g: 56, p: 7, cal: 200, c: 42, f: 1, status: 'reference', key: ['classic', 'blue box', 'spaghetti'], units: PASTA, approx: PASTA_APPROX,
      pkg: { unit: 'box', size: '16 oz', g: 454, servings: 8 }, src: rl('Food Lion, Stop & Shop, Giant, Kroger', 'https://www.barilla.com/en-us/products/pasta/classic-blue-box/spaghetti'),
      note: 'Weighed dry. Most Blue Box shapes share this label.' }),
    G({ id: 'barilla-chickpea', cl: 'barilla:chickpea-pasta', brand: 'Barilla', line: 'Chickpea Pasta', flavor: null, cat: 'pasta',
      unit: 'serving', serv: '2 oz dry (56 g)', g: 56, p: 12, cal: 190, c: 34, f: 3.5, status: 'reference', key: ['chickpea'], units: PASTA, approx: PASTA_APPROX,
      pkg: { unit: 'box', size: '8.8 oz', g: 250, servings: 4.5 }, upc: [code('076808008487', 'ShopRite listing (rotini)')], src: rl('ShopRite, Stop & Shop, FatSecret', 'https://www.shoprite.com/sm/pickup/rsid/166/product/barilla-chickpea-rotini-pasta-88-oz-id-00076808008487'),
      note: 'One listing shows 4 g fat; CalorieKing shows 11 g protein.' }),
    G({ id: 'barilla-red-lentil', cl: 'barilla:red-lentil-pasta', brand: 'Barilla', line: 'Red Lentil Pasta', flavor: null, cat: 'pasta',
      unit: 'serving', serv: '2 oz dry (56 g)', g: 56, p: 13, cal: 190, c: 34, f: 1.5, status: 'estimated', key: ['red lentil', 'lentil'], units: PASTA, approx: PASTA_APPROX,
      pkg: { unit: 'box', size: '8.8 oz', g: 250, servings: 4.5 }, upc: [code('076808008463', 'ShopRite listing (penne)')], src: rl('ShopRite, Giant, CalorieKing', 'https://www.shoprite.com/product/00076808008463'),
      note: 'Listings range 180–202 calories, 1.5–2 g fat, 13–14 g protein.' }),
    G({ id: 'banza-chickpea', cl: 'banza:chickpea-pasta', brand: 'Banza', line: 'Chickpea Pasta', flavor: null, cat: 'pasta',
      unit: 'serving', serv: '2 oz dry (56 g)', g: 56, p: 11, cal: 190, c: 35, f: 3, status: 'estimated', key: ['pasta', 'chickpea'], units: PASTA, approx: PASTA_APPROX,
      pkg: { unit: 'box', size: '8 oz', g: 227, servings: 4 }, upc: [code('857183005007', 'ShopRite and Kroger listings (penne)')], src: rl('Kroger, Albertsons, ShopRite', 'https://www.kroger.com/p/banza-chickpea-penne-pasta/0085718300500'),
      note: 'Labels differ by version: 11–12 g protein, 31–35 g carbs. Banza’s 20 g+ figures are per 3.5 oz.' }),
    G({ id: 'raos-tomato-basil', cl: 'raos:tomato-basil', brand: "Rao's", line: 'Homemade Tomato Basil Sauce', flavor: null, cat: 'sauce',
      unit: 'serving', serv: '½ cup (125 g)', g: 125, p: 2, cal: 80, c: 6, f: 5, status: 'reference', key: ['tomato basil'], units: SAUCE, approx: SAUCE_APPROX,
      pkg: { unit: 'jar', size: '24 oz', g: 680, servings: 5.5 }, src: rl('Stop & Shop, Food Lion, FatSecret', 'https://raos.com/sauces/tomato-basil-sauce/') }),
    G({ id: 'raos-vodka', cl: 'raos:vodka-sauce', brand: "Rao's", line: 'Homemade Vodka Sauce', flavor: null, cat: 'sauce',
      unit: 'serving', serv: '½ cup (125 g)', g: 125, p: 3, cal: 90, c: 7, f: 6, status: 'reference', key: ['vodka'], units: SAUCE, approx: SAUCE_APPROX,
      pkg: { unit: 'jar', size: '24 oz', g: 680, servings: 5.5 }, upc: [code('747479000130', 'King Kullen listing (24 oz)'), code('747479001137', 'ShopRite listing (32 oz)')],
      src: mfr('raos.com (calories, fat, carbs) + ShopRite (protein)', 'https://raos.com/sauces/vodka-sauce/'), note: 'Spicy Vodka and Vodka Arrabbiata are different sauces.' }),
    G({ id: 'kraft-singles-2pct', cl: 'kraft:singles-american:2-milk', brand: 'Kraft', line: 'Singles American 2% Milk', flavor: null, cat: 'cheese',
      unit: 'slice', serv: '1 slice (19 g)', g: 19, p: 4, cal: 45, c: 2, f: 2.5, status: 'reference', key: ['2%', 'reduced fat'], units: { serving: 1, single: 1 },
      pkg: { unit: 'pack', size: '16 slices', g: 304, servings: 16 }, upc: [code('021000024834', 'kraftheinz.com product id')],
      src: mfr('kraftheinz.com (calories, protein, fat) + ShopRite (carbs)', 'https://www.kraftheinz.com/kraft-singles/products/00021000024834-american-cheese-slices-with-2-milk') }),
  ];

  /** Words that name a product category; used to keep "Fairlife shake" from matching Fairlife milk. */
  WT.PRODUCT_CATS = {
    bagel: 'bagel', muffin: 'muffin', oatmeal: 'oatmeal', jerky: 'jerky', bacon: 'bacon', whey: 'powder', powder: 'powder', cottage: 'cottage',
    shake: 'shake', drink: 'shake', smoothie: 'shake', bar: 'bar', yogurt: 'yogurt', yoghurt: 'yogurt', skyr: 'yogurt',
    milk: 'milk', cheese: 'cheese', single: 'cheese', pasta: 'pasta', spaghetti: 'pasta', penne: 'pasta', noodle: 'pasta', rotini: 'pasta', farfalle: 'pasta',
    frank: 'hotdog', wiener: 'hotdog', sauce: 'sauce', marinara: 'sauce', deli: 'deli', bread: 'bread', toast: 'bread', weiner: 'hotdog', hotdog: 'hotdog', dog: 'hotdog', butter: 'spread', pancake: 'pancake', waffle: 'pancake', flapjack: 'pancake',
  };
  /** Flavor words: naming one a product doesn't list marks the match as uncertain instead of assuming. */
  WT.FLAVOR_WORDS = ['latte', 'cafe', 'espresso', 'snickerdoodle', 'creme', 'vanilla', 'chocolate', 'strawberry', 'strawberries', 'banana', 'snickerdoodle', 'cinnamon', 'caramel', 'mocha', 'coffee', 'cookie', 'cookies', 'cream', 'peanut', 'blueberry', 'raspberry', 'cherry', 'peach', 'mango', 'lemon', 'lime', 'coconut', 'pumpkin', 'birthday', 'cake', 'batter', 'mint', 'berry', 'mixed', 'honey', 'maple', 'salted', 'toffee', 'brownie', 'fudge', 'dough', 'smores', 'pecan', 'almond', 'pistachio', 'chai', 'eggnog', 'gingerbread', 'churro'];
})();
