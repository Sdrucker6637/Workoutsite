/* Generic food database v2: USDA-based reference values with distinct preparations, plus homemade recipes.
 *
 * Values are entered PER 100 g as [calories, protein, carbs, fat], transcribed and rounded from USDA
 * FoodData Central (SR Legacy / FNDDS) descriptions named in `usda`. They are converted here into the
 * portion format the parser already uses (see js/foods.js): one base unit `u` of `g` grams, with
 * `units` as multipliers of that base unit.
 *
 *   portions  serving word → grams ({ cup: 158, scoop: 79 })
 *   sizes     size word → grams of the base unit ({ small: 138, medium: 173, large: 299 })
 *   st        'reference' (USDA-based, default) or 'estimated' (typical recipe / product average)
 *
 * The portion weights (what "a medium potato" or "a handful" weighs) are typical sizes, so the amount
 * is always an estimate unless you type a weight.
 *
 * Entries here REPLACE same-id entries from js/foods.js, and their aliases take precedence: an alias
 * defined here is removed from any older entry, so "white rice" can't still land on a merged "rice".
 */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const R2 = (v) => Math.round(v * 100) / 100;

  /** G(id, name, aliases, per100 [cal,p,c,f], [baseUnit, grams], portions, extra) */
  function G(id, n, a, per100, base, portions, x) {
    const [cal, p, c, f] = per100;
    const [u, g] = base;
    const k = g / 100;
    const units = {};
    Object.entries(portions || {}).forEach(([w, gr]) => (units[w] = R2(gr / g)));
    return Object.assign(
      { id, n, a, u, g, p: R2(p * k), cal: R2(cal * k), c: R2(c * k), f: R2(f * k), units, per100: { cal, p, c, f }, st: 'reference' },
      x || {}
    );
  }
  const est = (x) => Object.assign({ st: 'estimated' }, x || {});

  const GEN = [
    /* ── Chicken: cut × skin × raw/cooked ── */
    G('chicken-breast', 'Chicken breast, cooked', ['chicken breast', 'grilled chicken breast', 'baked chicken breast', 'cooked chicken breast', 'chicken breast fillet', 'chicken breast skinless', 'skinless chicken breast', 'boneless chicken breast', 'roasted chicken breast'],
      [165, 31, 0, 3.6], ['breast', 170], { serving: 113, piece: 85, cup: 140, bowl: 170, plate: 170, half: 85, fillet: 170 },
      { usda: 'Chicken, broiler, breast, meat only, cooked, roasted', serv: '≈ 6 oz cooked, boneless skinless', sizes: { small: 120, medium: 170, large: 230 } }),
    G('chicken-breast-raw', 'Chicken breast, raw', ['raw chicken breast', 'chicken breast raw', 'uncooked chicken breast', 'chicken breast uncooked'],
      [120, 22.5, 0, 2.6], ['breast', 200], { serving: 113, piece: 100 }, { usda: 'Chicken, broiler, breast, meat only, raw', serv: '≈ 7 oz raw, boneless skinless', sizes: { small: 150, medium: 200, large: 280 } }),
    G('chicken-breast-skin', 'Chicken breast with skin, roasted', ['chicken breast skin on', 'rotisserie chicken breast', 'roasted chicken breast skin on', 'bone in chicken breast'],
      [197, 29.8, 0, 7.8], ['breast', 145], { serving: 113, piece: 85, half: 73 }, { usda: 'Chicken, broiler, breast, meat and skin, cooked, roasted', serv: '≈ 5 oz meat and skin', sizes: { small: 110, medium: 145, large: 200 } }),
    G('chicken-breast-rotisserie-skinless', 'Rotisserie chicken breast, no skin', ['rotisserie chicken breast skinless', 'skinless rotisserie chicken breast'],
      [165, 31, 0, 3.6], ['breast', 130], { serving: 113, piece: 85 }, { usda: 'Chicken, broiler, breast, meat only, cooked, roasted', serv: '≈ 4.5 oz meat only' }),
    G('chicken-thigh', 'Chicken thigh, cooked, no skin', ['chicken thigh', 'boneless chicken thigh', 'grilled chicken thigh', 'baked chicken thigh', 'chicken thigh skinless', 'skinless chicken thigh', 'cooked chicken thigh'],
      [209, 26, 0, 10.9], ['thigh', 90], { serving: 113, piece: 90, cup: 140 }, { usda: 'Chicken, broiler, thigh, meat only, cooked, roasted', serv: '≈ 3 oz cooked, boneless skinless', sizes: { small: 65, medium: 90, large: 120 } }),
    G('chicken-thigh-skin', 'Chicken thigh with skin, roasted', ['chicken thigh skin on', 'rotisserie chicken thigh', 'roasted chicken thigh skin on', 'bone in chicken thigh', 'rotisserie chicken thigh skin on'],
      [229, 23.3, 0, 14.7], ['thigh', 80], { serving: 113, piece: 80 }, { usda: 'Chicken, broiler, thigh, meat and skin, cooked, roasted', serv: '≈ 80 g edible meat and skin', sizes: { small: 60, medium: 80, large: 105 } }),
    G('chicken-thigh-rotisserie-skinless', 'Rotisserie chicken thigh, no skin', ['rotisserie chicken thigh skinless', 'skinless rotisserie chicken thigh'],
      [209, 26, 0, 10.9], ['thigh', 70], { serving: 113, piece: 70 }, { usda: 'Chicken, broiler, thigh, meat only, cooked, roasted', serv: '≈ 70 g meat only', sizes: { small: 55, medium: 70, large: 90 } }),
    G('chicken-thigh-raw', 'Chicken thigh, raw, no skin', ['raw chicken thigh', 'chicken thigh raw', 'uncooked chicken thigh'],
      [121, 19.7, 0, 4.1], ['thigh', 115], { serving: 113 }, { usda: 'Chicken, broiler, thigh, meat only, raw', serv: '≈ 4 oz raw, boneless' }),
    G('chicken-drumstick', 'Chicken drumstick with skin, roasted', ['chicken drumstick', 'drumstick', 'chicken leg', 'chicken drumstick skin on', 'rotisserie chicken drumstick', 'rotisserie chicken leg'],
      [216, 27, 0, 11.2], ['drumstick', 60], { serving: 113, piece: 60 }, { usda: 'Chicken, broiler, drumstick, meat and skin, cooked, roasted', serv: '≈ 60 g edible' }),
    G('chicken-drumstick-skinless', 'Chicken drumstick, no skin', ['chicken drumstick skinless', 'skinless chicken drumstick', 'chicken leg skinless'],
      [172, 28.3, 0, 5.7], ['drumstick', 50], { serving: 113, piece: 50 }, { usda: 'Chicken, broiler, drumstick, meat only, cooked, roasted', serv: '≈ 50 g edible' }),
    G('crispy-chicken-fillet', 'Crispy (breaded) chicken fillet', ['crispy chicken', 'breaded chicken', 'fried chicken breast', 'crispy chicken breast', 'chicken cutlet', 'chicken schnitzel', 'breaded chicken breast', 'crispy chicken fillet', 'fried chicken fillet'],
      [260, 24, 11, 13], ['fillet', 120], { serving: 120, piece: 120 }, est({ usda: 'Chicken breast, breaded/battered and fried (typical)', serv: '≈ 4 oz breaded fillet' })),
    G('fried-chicken', 'Fried chicken, with skin', ['fried chicken', 'fried chicken thigh', 'fried chicken drumstick', 'fried chicken leg'],
      [270, 21, 9, 16.5], ['piece', 110], { serving: 110 }, est({ usda: 'Chicken, fried, battered, meat and skin (typical)', serv: '≈ 1 bone-in piece, edible part' })),

    /* ── Ground beef: lean % × cooked/raw ── */
    ...[[80, [265, 25.7, 0, 17.4], [254, 17.2, 0, 20]], [85, [250, 26, 0, 15.4], [215, 18.6, 0, 15]], [90, [217, 26.1, 0, 11.7], [176, 20, 0, 10]], [93, [198, 27.2, 0, 9.3], [152, 20.9, 0, 7]], [95, [164, 25.4, 0, 6.4], [137, 21.4, 0, 5]]].flatMap(([pct, cooked, raw]) => [
      G(`ground-beef-${pct}`, `Ground beef ${pct}/${100 - pct}, cooked`, [`${pct}lean ground beef`, `ground beef ${pct}lean`, `${pct}lean beef`, `cooked ${pct}lean ground beef`],
        cooked, ['serving', 113], { patty: 85, cup: 125, bowl: 170, lb: 340 }, { usda: `Beef, ground, ${pct}% lean / ${100 - pct}% fat, cooked`, serv: '4 oz cooked; “1 lb” means a pound as bought, ≈ 340 g once cooked' }),
      G(`ground-beef-${pct}-raw`, `Ground beef ${pct}/${100 - pct}, raw`, [`raw ${pct}lean ground beef`, `${pct}lean ground beef raw`, `uncooked ${pct}lean ground beef`, `ground beef ${pct}lean raw`],
        raw, ['serving', 113], { patty: 113, lb: 453.6, package: 453.6 }, { usda: `Beef, ground, ${pct}% lean / ${100 - pct}% fat, raw`, serv: '4 oz raw (as packaged)' }),
    ]),
    G('ground-beef', 'Ground beef 85/15, cooked', ['ground beef', 'beef mince', 'minced beef', 'hamburger meat', 'taco meat', 'cooked ground beef', 'ground beef cooked'],
      [250, 26, 0, 15.4], ['serving', 113], { patty: 85, cup: 125, bowl: 170, lb: 340 }, { usda: 'Beef, ground, 85% lean / 15% fat, cooked', serv: '4 oz cooked; lean % not given, 85/15 assumed' }),
    G('ground-beef-raw', 'Ground beef 85/15, raw', ['raw ground beef', 'ground beef raw', 'uncooked ground beef'],
      [215, 18.6, 0, 15], ['serving', 113], { patty: 113, lb: 453.6, package: 453.6 }, { usda: 'Beef, ground, 85% lean / 15% fat, raw', serv: '4 oz raw; lean % not given, 85/15 assumed' }),
    G('ground-beef-lean', 'Lean ground beef 90/10, cooked', ['lean ground beef', 'extra lean ground beef'],
      [217, 26.1, 0, 11.7], ['serving', 113], { patty: 85, cup: 125, bowl: 170 }, { usda: 'Beef, ground, 90% lean / 10% fat, cooked', serv: '4 oz cooked; 90/10 assumed' }),

    /* ── Eggs ── */
    G('egg', 'Eggs', ['egg', 'boiled egg', 'hard boiled egg', 'whole egg', 'poached egg', 'large egg', 'soft boiled egg'],
      [143, 12.6, 0.7, 9.5], ['egg', 50], { dozen: 600, serving: 100, plate: 150 }, { usda: 'Egg, whole, raw or hard-boiled (large)', dq: 2, fixed: true, serv: 'large', count: 'egg' }),
    G('egg-scrambled', 'Scrambled eggs', ['scrambled egg', 'scrambled eggs'],
      [149, 10, 1.6, 11], ['egg', 61], { serving: 122, plate: 183, cup: 220 }, { usda: 'Egg, whole, cooked, scrambled (with milk and fat)', dq: 2, fixed: true, serv: '1 large egg, scrambled with a little milk and butter', count: 'egg' }),
    G('egg-fried', 'Fried eggs', ['fried egg', 'over easy egg', 'sunny side up egg', 'over medium egg', 'over hard egg', 'egg over easy'],
      [196, 13.6, 0.8, 14.8], ['egg', 46], { serving: 92, plate: 138 }, { usda: 'Egg, whole, cooked, fried', dq: 2, fixed: true, serv: '1 large egg, fried', count: 'egg' }),

    /* ── Dairy & fats ── */
    G('milk', 'Milk, 2%', ['milk', '2% milk', '2 milk', 'reduced fat milk', 'cow milk', 'dairy milk'],
      [50, 3.3, 4.8, 2], ['cup', 244], { glass: 244, serving: 244, bottle: 488, carton: 244, splash: 30, pint: 488, quart: 976, bowl: 244, tbsp: 15, oz: 30.5 }, { usda: 'Milk, reduced fat, 2%', serv: '8 fl oz' }),
    G('milk-whole', 'Milk, whole', ['whole milk', 'full fat milk', 'vitamin d milk'],
      [61, 3.2, 4.8, 3.3], ['cup', 244], { glass: 244, serving: 244, splash: 30, pint: 488, tbsp: 15 }, { usda: 'Milk, whole, 3.25% milkfat', serv: '8 fl oz' }),
    G('milk-skim', 'Milk, skim', ['skim milk', 'nonfat milk', 'fat free milk', '1% milk', 'low fat milk', '1 milk'],
      [34, 3.4, 5, 0.1], ['cup', 245], { glass: 245, serving: 245, splash: 30, pint: 490, tbsp: 15 }, { usda: 'Milk, nonfat (skim); 1% is about 20 kcal more per cup', serv: '8 fl oz' }),
    G('butter', 'Butter', ['butter', 'salted butter', 'unsalted butter', 'pat of butter'],
      [717, 0.9, 0.1, 81], ['tsp', 4.7], { tbsp: 14.2, pat: 5, serving: 14.2, stick: 113, spoon: 9, spoonful: 9, knob: 7 }, { usda: 'Butter, salted', dq: 2, serv: '1 tsp ≈ 5 g; amount assumed when not given' }),
    G('sour-cream', 'Sour cream', ['sour cream'], [198, 2.4, 4.6, 19.4], ['tbsp', 12], { serving: 24, dollop: 24, scoop: 30, cup: 230, spoonful: 15 }, { usda: 'Cream, sour, cultured', dq: 2 }),
    G('olive-oil', 'Olive oil', ['olive oil', 'oil', 'vegetable oil', 'cooking oil', 'canola oil', 'avocado oil', 'extra virgin olive oil'],
      [884, 0, 0, 100], ['tbsp', 13.5], { tsp: 4.5, drizzle: 7, splash: 7, serving: 13.5, spoon: 9 }, { usda: 'Oil, olive, salad or cooking', dq: 1 }),
    G('mayonnaise', 'Mayonnaise', ['mayonnaise', 'mayo'], [680, 1, 0.6, 75], ['tbsp', 13.8], { tsp: 4.6, serving: 13.8, packet: 10, spoonful: 13.8 }, { usda: 'Salad dressing, mayonnaise, regular', dq: 1 }),
    G('ketchup', 'Ketchup', ['ketchup', 'catsup'], [101, 1, 27, 0.1], ['tbsp', 17], { tsp: 6, packet: 9, serving: 17 }, { usda: 'Catsup', dq: 1 }),
    G('ranch', 'Ranch dressing', ['ranch', 'ranch dressing'], [430, 1, 6, 44], ['tbsp', 15], { serving: 30, cup: 240, packet: 43 }, est({ usda: 'Salad dressing, ranch, regular (typical)', dq: 2 })),
    G('caesar-dressing', 'Caesar dressing', ['caesar dressing'], [540, 2.2, 3.3, 57.9], ['tbsp', 15], { serving: 30, packet: 43 }, est({ usda: 'Salad dressing, caesar, regular (typical)', dq: 2 })),
    G('vinaigrette', 'Vinaigrette', ['vinaigrette', 'italian dressing', 'balsamic vinaigrette', 'salad dressing', 'dressing'], [290, 0.4, 10, 28], ['tbsp', 15], { serving: 30 }, est({ usda: 'Salad dressing, vinaigrette / Italian (typical)', dq: 2 })),
    G('soy-sauce', 'Soy sauce', ['soy sauce', 'soya sauce', 'tamari'], [53, 8.1, 4.9, 0.6], ['tbsp', 16], { tsp: 5.3, packet: 9 }, { usda: 'Soy sauce made from soy and wheat', dq: 1 }),
    G('bbq-sauce', 'Barbecue sauce', ['bbq sauce', 'barbecue sauce', 'barbeque sauce', 'bbq'], [172, 0.8, 40.8, 0.6], ['tbsp', 17], { serving: 34, packet: 28, cup: 272 }, { usda: 'Sauce, barbecue', dq: 2 }),
    G('hot-sauce', 'Hot sauce', ['hot sauce', 'sriracha', 'buffalo sauce', 'tabasco', 'frank s red hot', 'franks red hot'], [20, 1, 3, 0.5], ['tsp', 5], { tbsp: 15, packet: 7, serving: 5 }, est({ usda: 'Hot pepper sauce (typical; buffalo sauce with butter is higher)', dq: 1 })),
    G('honey', 'Honey', ['honey'], [304, 0.3, 82.4, 0], ['tbsp', 21], { tsp: 7, drizzle: 10, serving: 21 }, { usda: 'Honey', dq: 1 }),
    G('maple-syrup', 'Syrup', ['maple syrup', 'syrup', 'pancake syrup'], [260, 0, 67, 0.1], ['tbsp', 20], { serving: 60, drizzle: 20 }, { usda: 'Syrups, maple', dq: 2 }),
    G('sugar', 'Sugar', ['sugar', 'white sugar', 'brown sugar'], [387, 0, 100, 0], ['tsp', 4.2], { tbsp: 12.5, packet: 3, cube: 4, spoon: 4.2 }, { usda: 'Sugars, granulated', dq: 1 }),
    G('jam', 'Jam or jelly', ['jam', 'jelly', 'preserves', 'fruit spread'], [278, 0.4, 69, 0.1], ['tbsp', 20], { tsp: 7, serving: 20, packet: 14 }, { usda: 'Jams and preserves', dq: 1 }),
    G('marinara', 'Marinara / pasta sauce', ['marinara', 'marinara sauce', 'pasta sauce', 'tomato sauce', 'spaghetti sauce', 'red sauce', 'meatless pasta sauce'],
      [50, 1.5, 8, 1.5], ['cup', 250], { serving: 125, jar: 680, ladle: 125, scoop: 125, tbsp: 16 }, est({ usda: 'Sauce, pasta, spaghetti/marinara, ready-to-serve (typical jarred)', dq: 0.5 })),
    G('salsa', 'Salsa', ['salsa', 'pico de gallo', 'pico'], [36, 1.5, 7, 0.2], ['tbsp', 16], { serving: 32, cup: 260, scoop: 32 }, { usda: 'Sauce, salsa, ready-to-serve', dq: 2 }),
    G('guacamole', 'Guacamole', ['guacamole', 'guac'], [157, 2, 8.6, 14.7], ['tbsp', 15], { serving: 30, scoop: 60, cup: 230, side: 113 }, est({ usda: 'Guacamole (typical, avocado-based)', dq: 4, serv: '1 tbsp ≈ 15 g' })),

    /* ── Grains: cooked vs dry ── */
    G('rice', 'White rice, cooked', ['rice', 'white rice', 'jasmine rice', 'basmati rice', 'cooked rice', 'steamed rice', 'cooked white rice', 'long grain rice', 'sushi rice'],
      [130, 2.7, 28.2, 0.3], ['cup', 158], { bowl: 237, serving: 158, scoop: 79, plate: 316, side: 158, container: 237 }, { usda: 'Rice, white, long-grain, enriched, cooked', serv: 'cooked' }),
    G('rice-brown', 'Brown rice, cooked', ['brown rice', 'cooked brown rice', 'whole grain rice'],
      [123, 2.7, 25.6, 1], ['cup', 195], { bowl: 293, serving: 195, scoop: 98, plate: 390, side: 195 }, { usda: 'Rice, brown, long-grain, cooked', serv: 'cooked' }),
    G('rice-dry', 'White rice, dry (uncooked)', ['dry rice', 'uncooked rice', 'raw rice', 'dry white rice', 'uncooked white rice', 'rice dry', 'rice uncooked'],
      [365, 7.1, 80, 0.7], ['cup', 185], { serving: 45, scoop: 45, bag: 907, lb: 453.6 }, { usda: 'Rice, white, long-grain, enriched, raw', serv: 'dry; 1 cup dry ≈ 3 cups cooked' }),
    G('rice-brown-dry', 'Brown rice, dry (uncooked)', ['dry brown rice', 'uncooked brown rice', 'brown rice dry', 'brown rice uncooked'],
      [367, 7.5, 76, 2.7], ['cup', 185], { serving: 45 }, { usda: 'Rice, brown, long-grain, raw', serv: 'dry' }),
    G('fried-rice', 'Fried rice', ['fried rice', 'egg fried rice', 'chicken fried rice', 'pork fried rice', 'shrimp fried rice'],
      [174, 4.5, 26, 5.5], ['cup', 137], { bowl: 205, serving: 137, plate: 274, container: 300, side: 137 }, est({ usda: 'Rice, fried, with egg and vegetables (typical)' })),
    G('pasta', 'Pasta, cooked', ['pasta', 'spaghetti', 'penne', 'noodle', 'macaroni', 'linguine', 'fettuccine', 'rotini', 'cooked pasta', 'cooked spaghetti', 'rigatoni', 'farfalle', 'angel hair', 'egg noodle', 'ziti', 'elbow macaroni'],
      [158, 5.8, 30.9, 0.9], ['cup', 140], { bowl: 280, plate: 350, serving: 140, box: 1120, package: 1120, side: 140 }, { usda: 'Pasta, cooked, enriched, without salt', serv: 'cooked, plain; 2 oz dry ≈ 1 cup cooked' }),
    G('pasta-dry', 'Pasta, dry (uncooked)', ['dry pasta', 'uncooked pasta', 'pasta dry', 'dry spaghetti', 'uncooked spaghetti', 'pasta uncooked', 'spaghetti dry'],
      [371, 13, 74.7, 1.5], ['serving', 56], { cup: 91, box: 454, package: 454, lb: 453.6 }, { usda: 'Pasta, dry, enriched', serv: '2 oz dry (≈ 1 cup cooked)' }),
    G('pasta-whole-wheat', 'Whole wheat pasta, cooked', ['whole wheat pasta', 'whole grain pasta', 'whole wheat spaghetti', 'wheat pasta'],
      [149, 6, 30, 1.7], ['cup', 140], { bowl: 280, plate: 350, serving: 140 }, { usda: 'Pasta, whole-wheat, cooked', serv: 'cooked' }),
    G('ramen-instant', 'Instant ramen', ['ramen', 'instant ramen', 'instant noodle', 'cup noodle', 'top ramen', 'maruchan'],
      [440, 9, 60, 17.5], ['package', 85], { serving: 85, bowl: 85, cup: 64 }, est({ usda: 'Noodles, instant, dry with seasoning (typical)', serv: '1 package (≈ 3 oz dry) with seasoning' })),
    G('rolled-oats', 'Oats, dry', ['rolled oats', 'dry oats', 'old fashioned oats', 'quick oats', 'oats dry', 'uncooked oats', 'oat'],
      [379, 13.2, 67.7, 6.5], ['cup', 81], { serving: 40, scoop: 40, handful: 20, packet: 28, tbsp: 5 }, { usda: 'Oats, rolled, dry', dq: 0.5, serv: 'dry; ½ cup ≈ 40 g' }),
    G('oatmeal', 'Oatmeal, cooked', ['oatmeal', 'porridge', 'cooked oatmeal', 'cooked oats'],
      [71, 2.5, 12, 1.5], ['cup', 234], { bowl: 293, serving: 234, packet: 234 }, { usda: 'Cereals, oats, regular, cooked with water', serv: 'cooked with water' }),
    G('bread', 'White bread', ['bread', 'white bread', 'toast', 'white toast', 'sandwich bread', 'slice of bread', 'sourdough', 'sourdough bread', 'sourdough toast', 'french bread', 'italian bread'],
      [266, 7.6, 49.4, 3.3], ['slice', 28], { piece: 28, serving: 56, roll: 43 }, { usda: 'Bread, white, commercially prepared (toasted or not)', serv: '≈ 1 oz slice', count: 'slice', sizes: { small: 22, medium: 28, large: 40, thin: 20, thick: 40 } }),
    G('bread-wheat', 'Whole wheat bread', ['whole wheat bread', 'wheat bread', 'whole grain bread', 'wheat toast', 'whole wheat toast', 'multigrain bread', 'multigrain toast', 'whole grain toast'],
      [252, 12.4, 42.7, 3.5], ['slice', 32], { piece: 32, serving: 64 }, { usda: 'Bread, whole-wheat, commercially prepared', serv: '≈ 1.1 oz slice', count: 'slice', sizes: { small: 25, medium: 32, large: 43, thin: 22, thick: 43 } }),

    /* ── Potatoes ── */
    G('potato', 'Baked potato (russet)', ['potato', 'baked potato', 'russet potato', 'white potato', 'jacket potato', 'idaho potato', 'russet', 'baked russet potato'],
      [93, 2.5, 21.2, 0.1], ['potato', 173], { cup: 122, serving: 173, half: 87 }, { usda: 'Potatoes, baked, flesh and skin, without salt', serv: 'medium, ≈ 173 g, plain', sizes: { small: 138, medium: 173, large: 299, huge: 400, jumbo: 400 } }),
    G('potato-red', 'Red potatoes, roasted/boiled', ['red potato', 'baby potato', 'new potato', 'yukon gold potato', 'gold potato', 'boiled potato', 'fingerling potato', 'baby red potato'],
      [89, 2.3, 19.6, 0.15], ['potato', 150], { cup: 156, serving: 150, handful: 120 }, { usda: 'Potatoes, red, flesh and skin, baked', serv: 'medium ≈ 150 g, plain', sizes: { small: 90, medium: 150, large: 220, baby: 45 } }),
    G('potato-roasted', 'Roasted potatoes (with oil)', ['roasted potato', 'roast potato', 'potato wedge', 'home fries', 'roasted potatoes'],
      [149, 2.1, 20, 7], ['cup', 140], { serving: 140, side: 140, bowl: 210, handful: 70 }, est({ usda: 'Potatoes, roasted with oil (typical)' })),
    G('sweet-potato', 'Sweet potato, baked', ['sweet potato', 'baked sweet potato', 'yam', 'roasted sweet potato'],
      [90, 2, 20.7, 0.15], ['potato', 150], { cup: 200, serving: 150, half: 75 }, { usda: 'Sweet potato, cooked, baked in skin, flesh, without salt', serv: 'medium ≈ 150 g, plain', sizes: { small: 100, medium: 150, large: 220 } }),
    G('mashed-potato', 'Mashed potatoes', ['mashed potato', 'mashed potatoes', 'mash', 'potato puree'],
      [113, 1.9, 16.8, 4.2], ['cup', 210], { serving: 140, scoop: 105, bowl: 315, side: 140, plate: 210 }, { usda: 'Potatoes, mashed, home-prepared, whole milk and butter', dq: 0.67 }),
    G('hash-brown', 'Hash browns', ['hash brown', 'hashbrown', 'hash browns', 'shredded potato'],
      [265, 2.6, 35, 12.5], ['patty', 60], { cup: 156, serving: 120, side: 120 }, est({ usda: 'Potatoes, hash brown (typical, pan-fried)' })),

    /* ── Beans & legumes (cooked or canned, drained) ── */
    G('beans-black', 'Black beans', ['black bean', 'black beans', 'canned black bean'], [132, 8.9, 23.7, 0.5], ['cup', 172], { serving: 86, can: 255, scoop: 86, bowl: 258, side: 86, tbsp: 11, handful: 43 }, { usda: 'Beans, black, mature seeds, cooked, boiled', dq: 0.5 }),
    G('beans-pinto', 'Pinto beans', ['pinto bean', 'pinto beans'], [143, 9, 26.2, 0.65], ['cup', 171], { serving: 86, can: 255, scoop: 86, bowl: 257, side: 86 }, { usda: 'Beans, pinto, mature seeds, cooked, boiled', dq: 0.5 }),
    G('beans-kidney', 'Kidney beans', ['kidney bean', 'red kidney bean', 'red bean'], [127, 8.7, 22.8, 0.5], ['cup', 177], { serving: 89, can: 255, scoop: 89 }, { usda: 'Beans, kidney, red, mature seeds, cooked, boiled', dq: 0.5 }),
    G('beans-white', 'White beans', ['white bean', 'navy bean', 'cannellini bean', 'great northern bean', 'butter bean', 'lima bean'], [140, 8.2, 26, 0.6], ['cup', 182], { serving: 91, can: 255 }, { usda: 'Beans, navy, mature seeds, cooked, boiled', dq: 0.5 }),
    G('beans-refried', 'Refried beans', ['refried bean', 'refried beans'], [91, 5.4, 15.5, 1.2], ['cup', 238], { serving: 119, can: 454, scoop: 60, side: 119, tbsp: 15 }, { usda: 'Refried beans, canned, traditional style', dq: 0.5 }),
    G('beans-baked', 'Baked beans', ['baked bean', 'baked beans', 'pork and beans'], [94, 4.8, 21, 0.4], ['cup', 254], { serving: 127, can: 454, scoop: 64, side: 127 }, { usda: 'Beans, baked, canned, plain or vegetarian', dq: 0.5 }),
    G('chickpeas', 'Chickpeas', ['chickpea', 'garbanzo', 'garbanzo bean'], [164, 8.9, 27.4, 2.6], ['cup', 164], { serving: 82, can: 240, handful: 41, scoop: 82 }, { usda: 'Chickpeas (garbanzo beans), mature seeds, cooked, boiled', dq: 0.5 }),
    G('lentils', 'Lentils', ['lentil', 'cooked lentil'], [116, 9, 20.1, 0.4], ['cup', 198], { serving: 99, bowl: 297, scoop: 99 }, { usda: 'Lentils, mature seeds, cooked, boiled', dq: 0.5 }),
    G('edamame', 'Edamame', ['edamame'], [121, 11.9, 8.9, 5.2], ['cup', 155], { serving: 155, bowl: 233, handful: 50 }, { usda: 'Edamame, frozen, prepared' }),

    /* ── Fruit ── */
    G('banana', 'Banana', ['banana'], [89, 1.1, 22.8, 0.3], ['banana', 118], { cup: 150, half: 59, serving: 118 }, { usda: 'Bananas, raw', serv: 'medium ≈ 118 g peeled', sizes: { small: 101, medium: 118, large: 136, huge: 152 }, count: 'banana' }),
    G('apple', 'Apple', ['apple'], [52, 0.3, 13.8, 0.2], ['apple', 182], { cup: 125, slice: 18, serving: 182, half: 91 }, { usda: 'Apples, raw, with skin', serv: 'medium ≈ 182 g', sizes: { small: 149, medium: 182, large: 223 } }),
    G('orange', 'Orange', ['orange', 'navel orange', 'clementine', 'mandarin', 'tangerine'], [47, 0.9, 11.8, 0.1], ['orange', 131], { cup: 180, serving: 131 }, { usda: 'Oranges, raw, all commercial varieties', serv: 'medium ≈ 131 g (a clementine is about half)', sizes: { small: 96, medium: 131, large: 184 } }),
    G('pear', 'Pear', ['pear'], [57, 0.4, 15.2, 0.1], ['pear', 178], { serving: 178 }, { usda: 'Pears, raw', sizes: { small: 148, medium: 178, large: 230 } }),
    G('peach', 'Peach', ['peach', 'nectarine', 'plum'], [39, 0.9, 9.5, 0.25], ['peach', 150], { cup: 154, serving: 150 }, { usda: 'Peaches, yellow, raw', sizes: { small: 130, medium: 150, large: 175 } }),
    G('blueberries', 'Blueberries', ['blueberry', 'blueberries'], [57, 0.7, 14.5, 0.3], ['cup', 148], { handful: 74, serving: 148, pint: 300, bowl: 222, container: 170, tbsp: 9 }, { usda: 'Blueberries, raw', serv: 'a handful ≈ ½ cup' }),
    G('strawberries', 'Strawberries', ['strawberry', 'strawberries'], [32, 0.7, 7.7, 0.3], ['cup', 152], { handful: 76, serving: 152, bowl: 228, pint: 300, container: 454 }, { usda: 'Strawberries, raw', serv: '1 cup halves', count: 'berry', countGrams: 12 }),
    G('raspberries', 'Raspberries', ['raspberry', 'raspberries', 'blackberry', 'blackberries'], [52, 1.2, 11.9, 0.65], ['cup', 123], { handful: 62, serving: 123, container: 170 }, { usda: 'Raspberries, raw' }),
    G('grapes', 'Grapes', ['grape', 'grapes'], [69, 0.7, 18.1, 0.2], ['cup', 151], { handful: 75, serving: 151, bunch: 300, bowl: 227 }, { usda: 'Grapes, red or green, raw', count: 'grape', countGrams: 5 }),
    G('avocado', 'Avocado', ['avocado'], [160, 2, 8.5, 14.7], ['avocado', 150], { half: 75, slice: 15, serving: 50, cup: 150, tbsp: 15, quarter: 37 }, { usda: 'Avocados, raw, all commercial varieties', serv: 'whole, ≈ 150 g flesh', sizes: { small: 110, medium: 150, large: 200 } }),
    G('orange-juice', 'Orange juice', ['orange juice', 'oj', 'fresh orange juice'], [45, 0.7, 10.4, 0.2], ['cup', 248], { glass: 248, bottle: 450, serving: 248, carton: 248, oz: 31 }, { usda: 'Orange juice, raw', serv: '8 fl oz', sizes: { small: 186, medium: 248, large: 372 } }),
    G('apple-juice', 'Apple juice', ['apple juice', 'cider', 'apple cider'], [46, 0.1, 11.3, 0.1], ['cup', 248], { glass: 248, bottle: 450, box: 200, serving: 248 }, { usda: 'Apple juice, canned or bottled, unsweetened', serv: '8 fl oz', sizes: { small: 186, medium: 248, large: 372 } }),

    /* ── Vegetables ── */
    G('broccoli', 'Broccoli', ['broccoli', 'steamed broccoli', 'broccoli floret', 'roasted broccoli'], [35, 2.4, 7.2, 0.4], ['cup', 156], { serving: 156, handful: 50, bowl: 234, side: 156, plate: 234 }, { usda: 'Broccoli, cooked, boiled, drained' }),
    G('spinach', 'Spinach, raw', ['spinach', 'baby spinach', 'raw spinach'], [23, 2.9, 3.6, 0.4], ['cup', 30], { handful: 30, serving: 85, bowl: 60, bag: 142 }, { usda: 'Spinach, raw' }),
    G('romaine', 'Romaine lettuce', ['romaine', 'lettuce', 'romaine lettuce', 'mixed greens', 'salad greens', 'iceberg lettuce', 'spring mix', 'arugula'], [17, 1.2, 3.3, 0.3], ['cup', 47], { handful: 25, serving: 85, bowl: 94, leaf: 6 }, { usda: 'Lettuce, cos or romaine, raw' }),
    G('carrots', 'Carrots', ['carrot', 'baby carrot', 'carrot stick'], [41, 0.9, 9.6, 0.2], ['cup', 128], { handful: 85, serving: 85, carrot: 61, stick: 10, bag: 454 }, { usda: 'Carrots, raw', count: 'carrot', countGrams: 10 }),
    G('green-beans', 'Green beans', ['green bean', 'string bean', 'haricot vert'], [35, 1.9, 7.9, 0.3], ['cup', 125], { serving: 125, handful: 40, side: 125 }, { usda: 'Beans, snap, green, cooked, boiled' }),
    G('corn', 'Corn', ['corn', 'sweet corn', 'corn on the cob', 'ear of corn'], [96, 3.4, 21, 1.5], ['cup', 164], { ear: 90, cob: 90, serving: 82, side: 82 }, { usda: 'Corn, sweet, yellow, cooked, boiled' }),
    G('bell-pepper', 'Bell pepper', ['bell pepper', 'red pepper', 'green pepper', 'yellow pepper'], [26, 1, 6, 0.3], ['pepper', 119], { cup: 92, slice: 10, half: 60 }, { usda: 'Peppers, sweet, red, raw' }),
    G('tomato', 'Tomato', ['tomato', 'cherry tomato', 'grape tomato'], [18, 0.9, 3.9, 0.2], ['tomato', 123], { cup: 149, slice: 20, handful: 75 }, { usda: 'Tomatoes, red, ripe, raw', sizes: { small: 91, medium: 123, large: 182 } }),
    G('onion', 'Onion', ['onion', 'red onion', 'white onion', 'yellow onion'], [40, 1.1, 9.3, 0.1], ['onion', 110], { cup: 160, slice: 14, half: 55, tbsp: 10 }, { usda: 'Onions, raw' }),
    G('cucumber', 'Cucumber', ['cucumber'], [15, 0.7, 3.6, 0.1], ['cup', 104], { cucumber: 300, slice: 7, half: 150, handful: 60 }, { usda: 'Cucumber, with peel, raw' }),

    /* ── Fish ── */
    G('salmon', 'Salmon, cooked', ['salmon', 'salmon fillet', 'baked salmon', 'grilled salmon', 'atlantic salmon'], [206, 22.1, 0, 12.4], ['fillet', 170], { serving: 113, piece: 113, plate: 170 }, { usda: 'Fish, salmon, Atlantic, farmed, cooked, dry heat', serv: '≈ 6 oz cooked' }),
    G('salmon-wild', 'Wild salmon, cooked', ['wild salmon', 'sockeye salmon', 'coho salmon', 'wild caught salmon'], [182, 25.4, 0, 8.1], ['fillet', 170], { serving: 113, piece: 113 }, { usda: 'Fish, salmon, Atlantic, wild, cooked, dry heat', serv: '≈ 6 oz cooked' }),

    /* ── Crunchy extras for salads and recipes ── */
    G('croutons', 'Croutons', ['crouton', 'croutons'], [407, 11.9, 73.5, 6.6], ['cup', 30], { handful: 15, serving: 15, tbsp: 2 }, { usda: 'Croutons, plain', dq: 0.5 }),
    G('granola', 'Granola', ['granola'], [471, 10, 64, 20], ['cup', 122], { serving: 50, handful: 30, scoop: 30, tbsp: 7.6 }, est({ usda: 'Cereals ready-to-eat, granola (typical)', dq: 0.33 })),
    G('flour-tortilla-large', 'Large flour tortilla', ['large flour tortilla', 'burrito tortilla', 'wrap tortilla', 'large tortilla'], [312, 8.3, 51.6, 8], ['tortilla', 72], {}, { usda: 'Tortillas, ready-to-bake or -fry, flour', serv: '10-inch, ≈ 72 g' }),
  ];

  /* ─────── Homemade recipes ───────
   * A recipe is a typical breakdown of a home-made dish. When one matches, the parser expands it into
   * these parts (each parsed like typed text, so each part is an editable, generic estimate).
   * Similar descriptions are distinct entries: a Caesar wrap, a grilled chicken Caesar salad and a
   * crispy chicken Caesar sandwich do not share numbers.
   */
  const RECIPES = [
    { id: 'chicken-caesar-wrap', n: 'Chicken Caesar wrap', a: ['chicken caesar wrap', 'grilled chicken caesar wrap', 'caesar wrap'], parts: ['1 large flour tortilla', '3 oz grilled chicken breast', '1 cup romaine', '2 tbsp caesar dressing', '1 tbsp parmesan'] },
    { id: 'crispy-chicken-caesar-wrap', n: 'Crispy chicken Caesar wrap', a: ['crispy chicken caesar wrap', 'fried chicken caesar wrap'], parts: ['1 large flour tortilla', '1 crispy chicken fillet', '1 cup romaine', '2 tbsp caesar dressing', '1 tbsp parmesan'] },
    { id: 'grilled-chicken-caesar-salad', n: 'Grilled chicken Caesar salad', a: ['grilled chicken caesar salad', 'chicken caesar salad', 'chicken caesar', 'caesar salad with chicken'], parts: ['4 oz grilled chicken breast', '2 cups romaine', '2 tbsp caesar dressing', '2 tbsp parmesan', '0.5 cup croutons'] },
    { id: 'crispy-chicken-caesar-salad', n: 'Crispy chicken Caesar salad', a: ['crispy chicken caesar salad', 'fried chicken caesar salad'], parts: ['1 crispy chicken fillet', '2 cups romaine', '2 tbsp caesar dressing', '2 tbsp parmesan', '0.5 cup croutons'] },
    { id: 'caesar-salad', n: 'Caesar salad', a: ['caesar salad', 'side caesar salad'], parts: ['2 cups romaine', '2 tbsp caesar dressing', '2 tbsp parmesan', '0.5 cup croutons'] },
    { id: 'crispy-chicken-caesar-sandwich', n: 'Crispy chicken Caesar sandwich', a: ['crispy chicken caesar sandwich', 'fried chicken caesar sandwich', 'chicken caesar sandwich'], parts: ['1 crispy chicken fillet', '1 hamburger bun', '0.5 cup romaine', '1 tbsp caesar dressing', '1 tbsp parmesan'] },
    { id: 'grilled-chicken-salad', n: 'Grilled chicken salad', a: ['grilled chicken salad', 'chicken salad bowl', 'chicken garden salad'], parts: ['4 oz grilled chicken breast', '2 cups mixed greens', '0.5 cup tomato', '0.25 cup cucumber', '2 tbsp vinaigrette'] },
    { id: 'chicken-stir-fry', n: 'Chicken stir-fry', a: ['chicken stir fry', 'chicken stirfry', 'stir fry chicken'], parts: ['4 oz chicken breast', '1.5 cups mixed vegetables', '1 tbsp oil', '1 tbsp soy sauce'] },
    { id: 'beef-stir-fry', n: 'Beef stir-fry', a: ['beef stir fry', 'beef and broccoli'], parts: ['4 oz steak', '1.5 cups broccoli', '1 tbsp oil', '1 tbsp soy sauce'] },
    { id: 'spaghetti-meat-sauce', n: 'Spaghetti with meat sauce', a: ['spaghetti with meat sauce', 'spaghetti bolognese', 'pasta bolognese', 'bolognese', 'meat sauce pasta', 'spaghetti and meat sauce', 'pasta with meat sauce'], parts: ['1.5 cups cooked spaghetti', '0.5 cup marinara sauce', '3 oz cooked ground beef'] },
    { id: 'spaghetti-meatballs', n: 'Spaghetti and meatballs', a: ['spaghetti and meatballs', 'spaghetti and meatball', 'spaghetti with meatballs', 'pasta and meatballs'], parts: ['1.5 cups cooked spaghetti', '0.5 cup marinara sauce', '4 meatballs'] },
    { id: 'pasta-marinara', n: 'Pasta with marinara', a: ['pasta with marinara', 'spaghetti with marinara', 'pasta marinara', 'spaghetti marinara', 'pasta with red sauce', 'pasta with tomato sauce'], parts: ['1.5 cups cooked pasta', '0.5 cup marinara sauce', '1 tbsp parmesan'] },
    { id: 'chicken-and-rice', n: 'Chicken and rice', a: ['chicken and rice', 'chicken with rice', 'chicken rice bowl', 'chicken over rice'], parts: ['5 oz grilled chicken breast', '1 cup white rice'] },
    { id: 'homemade-burrito-bowl', n: 'Burrito bowl (homemade)', a: ['burrito bowl', 'homemade burrito bowl', 'chicken burrito bowl'], parts: ['4 oz grilled chicken breast', '0.75 cup white rice', '0.5 cup black beans', '0.25 cup shredded cheese', '2 tbsp salsa'] },
    { id: 'avocado-toast', n: 'Avocado toast', a: ['avocado toast'], parts: ['1 slice whole wheat bread', '0.5 avocado'] },
    { id: 'yogurt-parfait', n: 'Yogurt parfait', a: ['yogurt parfait', 'parfait', 'greek yogurt parfait'], parts: ['1 cup greek yogurt', '0.25 cup granola', '0.5 cup blueberries'] },
    { id: 'overnight-oats', n: 'Overnight oats', a: ['overnight oats', 'overnight oat'], parts: ['0.5 cup rolled oats', '0.5 cup milk', '0.5 cup greek yogurt'] },
    { id: 'protein-smoothie', n: 'Protein smoothie', a: ['protein smoothie', 'banana protein smoothie', 'peanut butter banana smoothie'], parts: ['1 scoop protein powder', '1 banana', '1 cup milk', '1 tbsp peanut butter'] },
    { id: 'breakfast-burrito', n: 'Breakfast burrito', a: ['breakfast burrito', 'egg burrito'], parts: ['1 large flour tortilla', '2 scrambled eggs', '0.25 cup shredded cheese', '2 slices bacon'] },
    { id: 'grilled-cheese', n: 'Grilled cheese', a: ['grilled cheese', 'grilled cheese sandwich'], parts: ['2 slices white bread', '2 slices cheese', '2 tsp butter'] },
    { id: 'egg-and-toast', n: 'Eggs on toast', a: ['eggs on toast', 'egg on toast'], parts: ['2 fried eggs', '1 slice white bread'] },
  ];

  /* ─────── Merge into WT.FOODS ─────── */
  const old = WT.FOODS || [];
  const byId = new Map(GEN.map((f) => [f.id, f]));
  const newAliases = new Set(GEN.concat(RECIPES).flatMap((f) => f.a.map((x) => x.toLowerCase())));
  const kept = old
    .filter((f) => !byId.has(f.id))
    .map((f) => Object.assign({}, f, { a: f.a.filter((x) => !newAliases.has(x.toLowerCase())) }))
    .filter((f) => f.a.length);
  // replaced entries keep their position so existing ordering (and saved references by id) stay stable
  const out = [];
  old.forEach((f) => {
    if (byId.has(f.id)) out.push(byId.get(f.id));
    else {
      const k = kept.find((x) => x.id === f.id);
      if (k) out.push(k);
    }
  });
  GEN.forEach((f) => !old.some((o) => o.id === f.id) && out.push(f));
  // Every older generic entry is a typical estimate; mark it so the UI can say so.
  out.forEach((f) => (f.st = f.st || 'estimated'));
  WT.FOODS = out;
  WT.RECIPES = RECIPES;
  WT.FOOD_SOURCES = {
    reference: 'USDA FoodData Central (SR Legacy / FNDDS) reference values, rounded',
    estimated: 'Typical value for this kind of food',
  };
})();
