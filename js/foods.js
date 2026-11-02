/* Food reference for the protein tracker: a small, curated, bundled table of typical values.
 *
 * Every number here is a rounded, typical estimate for a common portion (USDA-style generic values),
 * not a label. Macros are for ONE base unit `u` of the food:
 *   p protein (g) · cal calories · c carbs (g) · f fat (g) · g approximate grams per base unit (enables oz/g/lb)
 * Optional:
 *   units  extra serving words → multiplier of the base unit (e.g. cup: 1.5 means a cup is 1.5 base units)
 *   count  what a bare number means ("10 shrimp" → 10 × the `shrimp` unit) — defaults to the base unit
 *   dq     quantity assumed when none is typed ("eggs" → 2 eggs)
 *   fixed  size words (large, small…) don't scale it (eggs, scoops, packaged products)
 *   serv   human description of the base unit, shown in the breakdown
 * Aliases are matched as whole words, plural-insensitive. Longer matches win.
 */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const F = (id, n, a, u, p, cal, c, f, x) => Object.assign({ id, n, a, u, p, cal, c, f }, x || {});

  WT.FOODS = [
    /* ── Poultry & meat ── */
    F('chicken-breast', 'Chicken breast', ['chicken breast', 'chicken breast fillet', 'grilled chicken breast'], 'breast', 53, 280, 0, 6, { g: 170, serv: '≈ 6 oz cooked', units: { serving: 0.67, piece: 0.5, cup: 0.8, bowl: 1, plate: 1 } }),
    F('chicken', 'Chicken', ['chicken', 'grilled chicken', 'rotisserie chicken', 'shredded chicken', 'chicken meat'], 'serving', 35, 190, 0, 6, { g: 113, serv: '≈ 4 oz cooked', units: { cup: 1.25, bowl: 1.5, plate: 1.5, piece: 0.75, breast: 1.5, handful: 0.5 } }),
    F('chicken-thigh', 'Chicken thigh', ['chicken thigh'], 'thigh', 21, 180, 0, 10, { g: 85, serv: 'boneless, ≈ 3 oz cooked', units: { serving: 1.3 } }),
    F('chicken-wing', 'Chicken wing', ['chicken wing', 'wing', 'buffalo wing'], 'wing', 9, 100, 0, 7, { g: 35, count: 'wing', serv: 'cooked', units: { serving: 6, plate: 10, basket: 10 } }),
    F('chicken-nugget', 'Chicken nugget', ['chicken nugget', 'nugget', 'chicken tender', 'chicken strip', 'chicken finger'], 'piece', 3, 50, 3, 3, { g: 17, dq: 6, serv: 'breaded', units: { serving: 6, tender: 2, strip: 2, finger: 2 } }),
    F('ground-beef', 'Ground beef', ['ground beef', 'beef mince', 'minced beef', 'taco meat'], 'serving', 28, 280, 0, 19, { g: 113, serv: '≈ 4 oz cooked, 85% lean', units: { patty: 1, cup: 1.1, bowl: 1.5, lb: 4 } }),
    F('ground-turkey', 'Ground turkey', ['ground turkey', 'turkey mince'], 'serving', 30, 220, 0, 11, { g: 113, serv: '≈ 4 oz cooked, 93% lean', units: { patty: 1, cup: 1.1, bowl: 1.5 } }),
    F('steak', 'Steak', ['steak', 'sirloin', 'ribeye', 'rib eye', 'filet mignon', 'flank steak', 'strip steak', 'beef'], 'steak', 50, 400, 0, 22, { g: 170, serv: '≈ 6 oz cooked', units: { serving: 0.67, piece: 0.5, plate: 1 } }),
    F('pork-chop', 'Pork chop', ['pork chop', 'pork', 'pork loin', 'pork tenderloin'], 'chop', 30, 220, 0, 10, { g: 113, serv: '≈ 4 oz cooked', units: { serving: 1 } }),
    F('bacon', 'Bacon', ['bacon', 'bacon strip'], 'slice', 3, 45, 0, 3.5, { g: 8, dq: 3, count: 'slice', serv: 'cooked', units: { strip: 1, piece: 1, serving: 3 } }),
    F('turkey-bacon', 'Turkey bacon', ['turkey bacon'], 'slice', 2, 30, 0, 2, { g: 14, dq: 2, serv: 'cooked', units: { strip: 1, serving: 2 } }),
    F('sausage-link', 'Breakfast sausage', ['sausage', 'breakfast sausage', 'sausage link', 'sausage patty'], 'link', 4, 90, 0, 8, { g: 25, dq: 2, serv: 'small link', units: { patty: 1.3, serving: 2 } }),
    F('chicken-sausage', 'Chicken sausage', ['chicken sausage', 'chicken apple sausage'], 'link', 13, 150, 3, 9, { g: 85, serv: 'full-size link', units: { serving: 1 } }),
    F('ham', 'Ham', ['ham', 'deli ham', 'sliced ham'], 'serving', 10, 70, 2, 2, { g: 56, serv: '≈ 2 oz, 3–4 slices', units: { slice: 0.3 } }),
    F('turkey', 'Turkey', ['turkey', 'roast turkey', 'turkey breast', 'deli turkey', 'sliced turkey', 'lunch meat', 'turkey slice'], 'serving', 14, 80, 2, 1, { g: 85, serv: '≈ 3 oz sliced', units: { slice: 0.25, plate: 2, cup: 1.6 } }),
    F('meatball', 'Meatballs', ['meatball'], 'meatball', 4, 70, 2, 5, { g: 28, dq: 4, serv: '≈ 1 oz', units: { serving: 4, bowl: 6, plate: 6 } }),
    F('beef-jerky', 'Beef jerky', ['jerky', 'beef jerky', 'meat stick', 'beef stick', 'turkey jerky'], 'serving', 9, 80, 6, 1, { g: 28, serv: '≈ 1 oz', units: { stick: 0.7, bag: 2.5, package: 2.5, handful: 1, piece: 0.3 } }),
    F('hot-dog', 'Hot dog', ['hot dog', 'hotdog', 'frank', 'frankfurter', 'wiener', 'weiner', 'beef frank'], 'hot dog', 5, 150, 2, 13, { g: 45, serv: 'frank only, no bun', units: { link: 1, piece: 1, serving: 1 } }),
    F('hamburger', 'Hamburger', ['hamburger', 'burger', 'beef burger'], 'burger', 25, 500, 35, 25, { serv: 'with bun', units: { sandwich: 1 } }),
    F('cheeseburger', 'Cheeseburger', ['cheeseburger', 'cheese burger'], 'burger', 28, 560, 36, 30, { serv: 'with bun' }),
    F('burger-patty', 'Burger patty', ['burger patty', 'beef patty', 'hamburger patty'], 'patty', 21, 230, 0, 16, { g: 85, serv: '≈ 3 oz cooked, no bun' }),
    F('turkey-burger', 'Turkey burger', ['turkey burger'], 'burger', 25, 400, 30, 16, { serv: 'with bun' }),

    /* ── Fish & seafood ── */
    F('shrimp', 'Shrimp', ['shrimp', 'prawn'], 'serving', 24, 110, 1, 1.5, { g: 113, count: 'shrimp', serv: '≈ 4 oz cooked, about 10 large', units: { shrimp: 0.1, prawn: 0.1, piece: 0.1, cup: 1.2, bowl: 1.5, plate: 1.5 } }),
    F('salmon', 'Salmon', ['salmon', 'salmon fillet', 'smoked salmon'], 'fillet', 38, 350, 0, 21, { g: 170, serv: '≈ 6 oz cooked', units: { serving: 0.67, piece: 0.67, plate: 1 } }),
    F('tuna', 'Tuna', ['tuna', 'canned tuna', 'tuna fish', 'can of tuna'], 'can', 27, 120, 0, 1, { g: 113, count: 'can', serv: '5-oz can, drained', units: { pouch: 0.65, serving: 0.75, cup: 1.3, steak: 1.5, bowl: 1.2, packet: 0.65 } }),
    F('white-fish', 'White fish', ['tilapia', 'cod', 'white fish', 'fish', 'halibut', 'mahi mahi', 'fish fillet', 'haddock'], 'fillet', 25, 120, 0, 2, { g: 113, serv: '≈ 4 oz cooked', units: { serving: 1, piece: 1, plate: 1.5 } }),
    F('tuna-salad', 'Tuna salad', ['tuna salad'], 'cup', 27, 380, 8, 28, { g: 205, units: { serving: 0.5, scoop: 0.5 } }),

    /* ── Eggs & dairy ── */
    F('egg', 'Eggs', ['egg', 'scrambled egg', 'fried egg', 'boiled egg', 'hard boiled egg', 'whole egg', 'poached egg'], 'egg', 6, 72, 0.5, 5, { g: 50, dq: 2, fixed: true, serv: 'large', units: { serving: 2, plate: 3, dozen: 12 } }),
    F('egg-white', 'Egg whites', ['egg white', 'liquid egg white', 'egg beater'], 'egg white', 3.6, 17, 0.2, 0, { g: 33, dq: 4, fixed: true, serv: 'from a large egg', units: { cup: 7.3, serving: 4, carton: 14 } }),
    F('omelet', 'Omelet', ['omelet', 'omelette'], 'omelet', 20, 300, 3, 22, { serv: '3 eggs with a little cheese' }),
    F('greek-yogurt', 'Greek yogurt', ['greek yogurt', 'greek yoghurt', 'skyr', 'icelandic yogurt'], 'container', 15, 90, 6, 0, { g: 150, count: 'container', serv: '5.3-oz single cup, plain nonfat', units: { cup: 1.5, scoop: 0.75, bowl: 1.5, serving: 1, tub: 1, spoon: 0.1, spoonful: 0.1, tbsp: 0.1 } }),
    F('yogurt', 'Yogurt', ['yogurt', 'yoghurt', 'regular yogurt', 'fruit yogurt', 'flavored yogurt'], 'container', 6, 150, 25, 2, { g: 170, serv: '6-oz cup, low-fat flavored', units: { cup: 1.3, scoop: 0.65, bowl: 1.3, serving: 1, tub: 1 } }),
    F('cottage-cheese', 'Cottage cheese', ['cottage cheese'], 'cup', 25, 180, 10, 5, { g: 226, dq: 0.5, serv: '2% fat', units: { serving: 0.5, scoop: 0.5, bowl: 1, container: 0.67, spoon: 0.1, spoonful: 0.1, tbsp: 0.06 } }),
    F('milk', 'Milk', ['milk', 'whole milk', 'skim milk', '2 milk', '2% milk', 'cow milk', 'dairy milk'], 'cup', 8, 120, 12, 5, { g: 244, serv: '8 fl oz, 2%', units: { glass: 1, serving: 1, bottle: 2, carton: 1, splash: 0.1, pint: 2, quart: 4, bowl: 1, tbsp: 0.06 } }),
    F('chocolate-milk', 'Chocolate milk', ['chocolate milk'], 'cup', 8, 190, 26, 5, { g: 250, units: { glass: 1, bottle: 2, carton: 1, pint: 2 } }),
    F('soy-milk', 'Soy milk', ['soy milk', 'soymilk'], 'cup', 7, 100, 8, 4, { g: 244, units: { glass: 1, carton: 1 } }),
    F('almond-milk', 'Almond milk', ['almond milk', 'oat milk', 'coconut milk'], 'cup', 1, 60, 6, 3, { g: 244, units: { glass: 1, splash: 0.1 } }),
    F('cheese', 'Cheese', ['cheese', 'cheddar', 'swiss', 'american cheese', 'provolone', 'mozzarella', 'shredded cheese', 'monterey jack', 'pepper jack', 'colby jack', 'cheese slice', 'feta'], 'slice', 5, 85, 0.5, 7, { g: 21, count: 'slice', serv: '≈ ¾ oz', units: { serving: 1.33, cup: 5.4, handful: 1.33, cube: 0.5, stick: 1.33, piece: 1, tbsp: 0.25, sprinkle: 0.3 } }),
    F('string-cheese', 'String cheese', ['string cheese', 'cheese stick', 'mozzarella stick'], 'stick', 7, 80, 1, 6, { g: 28, fixed: true }),
    F('parmesan', 'Parmesan', ['parmesan', 'parmigiano', 'grated parmesan'], 'tbsp', 2, 22, 0, 1.5, { g: 5, units: { serving: 2, sprinkle: 1, cup: 16, handful: 3 } }),
    F('cream-cheese', 'Cream cheese', ['cream cheese'], 'tbsp', 1, 50, 1, 5, { g: 15, dq: 2, units: { serving: 2, schmear: 2 } }),

    /* ── Protein products (generic) ── */
    F('protein-powder', 'Protein powder', ['protein powder', 'whey', 'whey protein', 'protein', 'casein', 'plant protein', 'isolate', 'whey isolate'], 'scoop', 24, 120, 3, 1.5, { g: 32, fixed: true, serv: 'typical whey, ≈ 30 g powder', units: { serving: 1, shake: 1, tbsp: 0.2 } }),
    F('protein-shake', 'Protein shake', ['protein shake', 'shake', 'protein drink', 'ready to drink protein shake', 'rtd shake', 'protein smoothie', 'muscle milk', 'ghost shake', 'ensure max', 'orgain shake', 'owyn shake'], 'shake', 25, 160, 6, 3, { fixed: true, serv: 'ready-to-drink bottle or one-scoop shake', units: { bottle: 1, serving: 1, carton: 1, can: 1, cup: 0.75, glass: 1 } }),
    F('protein-bar', 'Protein bar', ['protein bar'], 'bar', 20, 200, 22, 7, { fixed: true, units: { serving: 1, piece: 1 } }),
    F('protein-pasta', 'Protein pasta', ['protein pasta', 'chickpea pasta', 'lentil pasta', 'high protein pasta', 'protein noodle'], 'serving', 11, 200, 36, 2, { serv: '2 oz dry ≈ 1 cup cooked, plain', units: { cup: 1, bowl: 1.5, plate: 2, box: 4, package: 4 } }),
    F('protein-oatmeal', 'Protein oatmeal', ['protein oatmeal', 'protein oat'], 'bowl', 15, 280, 38, 6, { units: { cup: 1, serving: 1, packet: 1 } }),
    F('protein-pancake', 'Protein pancakes', ['protein pancake', 'protein waffle'], 'serving', 14, 190, 30, 2.5, { serv: '≈ 3 small pancakes', units: { pancake: 0.33, waffle: 0.5, plate: 1.3 } }),

    /* ── Plant proteins, grains & legumes ── */
    F('rice-and-beans', 'Rice and beans', ['rice and beans', 'beans and rice', 'red beans and rice', 'black beans and rice'], 'cup', 10, 260, 50, 2, { g: 240, serv: '', units: { bowl: 2, serving: 1, plate: 2, scoop: 0.5 } }),
    F('beans', 'Beans', ['bean', 'black bean', 'pinto bean', 'kidney bean', 'refried bean', 'baked bean'], 'cup', 15, 230, 41, 1, { g: 172, dq: 0.5, units: { serving: 0.5, can: 1.5, bowl: 1.5, scoop: 0.5, tbsp: 0.06 } }),
    F('lentils', 'Lentils', ['lentil', 'dal', 'dhal', 'lentil soup'], 'cup', 18, 230, 40, 1, { g: 198, units: { serving: 0.5, bowl: 1.5 } }),
    F('chickpeas', 'Chickpeas', ['chickpea', 'garbanzo', 'garbanzo bean'], 'cup', 15, 270, 45, 4, { g: 164, dq: 0.5, units: { serving: 0.5, can: 1.5, handful: 0.25 } }),
    F('edamame', 'Edamame', ['edamame'], 'cup', 18, 190, 14, 8, { g: 155, units: { serving: 1, bowl: 1.5, handful: 0.33 } }),
    F('tofu', 'Tofu', ['tofu'], 'serving', 9, 80, 2, 5, { g: 85, serv: '≈ 3 oz firm', units: { block: 4.5, cup: 1.6, bowl: 1.6, slice: 0.5 } }),
    F('tempeh', 'Tempeh', ['tempeh'], 'serving', 17, 160, 8, 9, { g: 85, serv: '≈ 3 oz', units: { block: 3, cup: 2 } }),
    F('rice', 'Rice', ['rice', 'white rice', 'brown rice', 'jasmine rice', 'fried rice'], 'cup', 4, 205, 45, 0.5, { g: 158, serv: 'cooked', units: { bowl: 1.5, serving: 1, scoop: 0.5, plate: 2 } }),
    F('quinoa', 'Quinoa', ['quinoa'], 'cup', 8, 220, 39, 4, { g: 185, units: { bowl: 1.5, serving: 1 } }),
    F('pasta', 'Pasta', ['pasta', 'spaghetti', 'noodle', 'penne', 'macaroni', 'linguine', 'fettuccine', 'ramen'], 'cup', 8, 220, 43, 1.3, { g: 140, serv: 'cooked, plain', units: { bowl: 2, plate: 2.5, serving: 1, box: 8, package: 8 } }),
    F('mac-and-cheese', 'Mac and cheese', ['mac and cheese', 'macaroni and cheese', 'mac n cheese'], 'cup', 10, 350, 45, 13, { units: { bowl: 1.5, serving: 1, box: 3 } }),
    F('oatmeal', 'Oatmeal', ['oatmeal', 'oat', 'porridge', 'overnight oat', 'rolled oat'], 'cup', 6, 160, 28, 3, { serv: 'cooked', units: { bowl: 1.25, packet: 0.9, serving: 1 } }),
    F('cereal', 'Cereal', ['cereal', 'granola', 'muesli', 'cheerios'], 'cup', 3, 140, 28, 2, { units: { bowl: 1.5, serving: 1 } }),

    /* ── Nuts & spreads ── */
    F('almonds', 'Almonds', ['almond'], 'handful', 6, 165, 6, 14, { g: 28, count: 'almond', serv: '≈ 1 oz, about 23 almonds', units: { almond: 0.043, serving: 1, cup: 5, bag: 1.5, package: 1.5 } }),
    F('peanuts', 'Peanuts', ['peanut'], 'handful', 7, 165, 5, 14, { g: 28, count: 'peanut', serv: '≈ 1 oz', units: { peanut: 0.036, serving: 1, cup: 5, bag: 1, package: 1 } }),
    F('nuts', 'Mixed nuts', ['nut', 'mixed nut', 'cashew', 'walnut', 'pecan', 'pistachio', 'trail mix', 'macadamia', 'hazelnut'], 'handful', 5, 170, 7, 15, { g: 28, serv: '≈ 1 oz', units: { serving: 1, cup: 5, bag: 1.5, package: 1.5 } }),
    F('seeds', 'Seeds', ['seed', 'sunflower seed', 'pumpkin seed', 'pepita', 'chia seed', 'hemp seed', 'flax seed'], 'tbsp', 2.5, 55, 2, 4.5, { g: 10, dq: 2, units: { handful: 3, serving: 3, scoop: 2, cup: 14 } }),
    F('peanut-butter', 'Peanut butter', ['peanut butter', 'pb'], 'tbsp', 4, 95, 3.5, 8, { g: 16, dq: 2, serv: '', units: { serving: 2, spoon: 1, spoonful: 1, scoop: 2, tsp: 0.33, cup: 16 } }),
    F('almond-butter', 'Almond butter', ['almond butter', 'nut butter', 'cashew butter'], 'tbsp', 3.4, 98, 3, 9, { g: 16, dq: 2, units: { serving: 2, spoon: 1, spoonful: 1, scoop: 2 } }),
    F('hummus', 'Hummus', ['hummus'], 'tbsp', 1, 35, 2, 2.5, { g: 15, dq: 2, units: { serving: 2, scoop: 2, cup: 16, container: 8, spoonful: 1 } }),

    /* ── Breads & meals ── */
    F('turkey-sandwich', 'Turkey sandwich', ['turkey sandwich', 'turkey sub', 'turkey and cheese sandwich', 'turkey club', 'turkey wrap', 'turkey and cheese'], 'sandwich', 24, 350, 35, 10, { serv: 'two slices of bread, deli turkey', units: { half: 0.5, serving: 1, wrap: 1, sub: 1 } }),
    F('chicken-sandwich', 'Chicken sandwich', ['chicken sandwich', 'chicken sub', 'chicken wrap', 'grilled chicken sandwich', 'crispy chicken sandwich'], 'sandwich', 28, 450, 40, 16, { units: { half: 0.5, serving: 1, wrap: 1 } }),
    F('ham-sandwich', 'Ham sandwich', ['ham sandwich', 'ham and cheese', 'ham and cheese sandwich', 'ham sub'], 'sandwich', 20, 350, 34, 13, { units: { half: 0.5, serving: 1 } }),
    F('tuna-sandwich', 'Tuna sandwich', ['tuna sandwich', 'tuna melt', 'tuna sub'], 'sandwich', 22, 400, 30, 18, { units: { half: 0.5, serving: 1 } }),
    F('pbj', 'PB&J', ['pbj', 'pb and j', 'peanut butter and jelly', 'peanut butter sandwich', 'peanut butter and jelly sandwich', 'peanut butter jelly sandwich'], 'sandwich', 12, 380, 48, 16, { units: { half: 0.5 } }),
    F('egg-sandwich', 'Breakfast sandwich', ['breakfast sandwich', 'egg sandwich', 'egg mcmuffin', 'bacon egg and cheese', 'sausage egg and cheese', 'egg and cheese sandwich', 'breakfast burrito'], 'sandwich', 18, 400, 30, 22, { units: { half: 0.5 } }),
    F('sandwich', 'Sandwich', ['sandwich', 'sub', 'wrap', 'hoagie', 'panini', 'blt', 'club sandwich'], 'sandwich', 18, 380, 38, 15, { serv: 'generic deli sandwich', units: { half: 0.5, serving: 1 } }),
    F('burrito', 'Burrito', ['burrito', 'chicken burrito', 'burrito bowl', 'steak burrito', 'beef burrito'], 'burrito', 30, 650, 70, 22, { units: { bowl: 1, half: 0.5, serving: 1 } }),
    F('taco', 'Taco', ['taco', 'chicken taco', 'beef taco', 'fish taco'], 'taco', 9, 180, 14, 9, { dq: 2 }),
    F('quesadilla', 'Quesadilla', ['quesadilla', 'chicken quesadilla'], 'quesadilla', 25, 550, 40, 28, { units: { half: 0.5, slice: 0.17, piece: 0.17 } }),
    F('pizza', 'Pizza', ['pizza', 'pizza slice', 'pepperoni pizza', 'cheese pizza'], 'slice', 12, 285, 36, 10, { g: 107, count: 'slice', serv: 'from a 14" pizza', units: { pie: 8, serving: 2, piece: 1, plate: 2 } }),
    F('chicken-salad', 'Chicken salad', ['chicken salad', 'chicken caesar', 'chicken caesar salad', 'cobb salad', 'grilled chicken salad'], 'bowl', 30, 400, 12, 24, { units: { serving: 1, plate: 1, cup: 0.5, scoop: 0.5 } }),
    F('salad', 'Salad', ['salad', 'side salad', 'green salad', 'caesar salad', 'garden salad'], 'bowl', 3, 150, 10, 11, { units: { serving: 1, plate: 1 } }),
    F('chili', 'Chili', ['chili', 'chilli', 'beef chili', 'turkey chili'], 'cup', 17, 260, 22, 10, { g: 250, units: { bowl: 1.5, serving: 1 } }),
    F('soup', 'Soup', ['soup', 'chicken noodle soup', 'vegetable soup', 'tomato soup', 'broth'], 'cup', 5, 100, 12, 3, { g: 245, units: { bowl: 1.5, can: 2, serving: 1 } }),
    F('sushi', 'Sushi roll', ['sushi', 'sushi roll', 'california roll', 'spicy tuna roll', 'maki'], 'roll', 9, 300, 45, 8, { serv: '6–8 pieces', units: { piece: 0.15, serving: 1, plate: 2 } }),
    F('stir-fry', 'Stir-fry', ['stir fry', 'chicken stir fry', 'beef stir fry', 'teriyaki chicken', 'orange chicken'], 'plate', 28, 550, 55, 18, { units: { bowl: 1, serving: 1, cup: 0.5 } }),
    F('bread', 'Bread', ['bread', 'toast', 'slice of bread', 'wheat bread', 'sourdough'], 'slice', 4, 80, 14, 1, { g: 32, count: 'slice', units: { piece: 1, serving: 2, roll: 1.5 } }),
    F('bagel', 'Bagel', ['bagel'], 'bagel', 10, 280, 55, 1.5, { units: { half: 0.5 } }),
    F('english-muffin', 'English muffin', ['english muffin'], 'muffin', 5, 130, 25, 1, {}),
    F('bun', 'Bun', ['bun', 'hot dog bun', 'hamburger bun', 'roll', 'dinner roll'], 'bun', 4, 120, 21, 2, {}),
    F('tortilla', 'Tortilla', ['tortilla', 'flour tortilla', 'corn tortilla'], 'tortilla', 4, 145, 24, 3.5, {}),
    F('pancakes', 'Pancakes', ['pancake', 'waffle', 'french toast'], 'pancake', 3, 90, 13, 3, { dq: 3, units: { serving: 3, plate: 4, stack: 3 } }),
    F('fries', 'French fries', ['fries', 'french fries', 'fry', 'french fry', 'chip', 'potato chip', 'crisps'], 'serving', 4, 360, 45, 17, { serv: 'medium order / small bag', units: { bag: 1, basket: 1.3, handful: 0.3 } }),
    F('potato', 'Potato', ['potato', 'baked potato', 'sweet potato', 'mashed potato', 'hash brown'], 'potato', 4, 160, 37, 0.2, { units: { cup: 1, serving: 1, bowl: 1.5 } }),

    /* ── Fruit, veg & drinks (mostly for calories; little protein) ── */
    F('banana', 'Banana', ['banana'], 'banana', 1.3, 105, 27, 0.4, {}),
    F('apple', 'Apple', ['apple', 'pear', 'orange', 'peach'], 'piece', 0.5, 90, 23, 0.3, { units: { serving: 1 } }),
    F('berries', 'Berries', ['berry', 'strawberry', 'blueberry', 'raspberry', 'grape', 'fruit', 'fruit salad'], 'cup', 1, 70, 17, 0.4, { units: { handful: 0.5, bowl: 1.5, serving: 1 } }),
    F('avocado', 'Avocado', ['avocado', 'guacamole', 'guac'], 'half', 2, 160, 9, 15, { units: { avocado: 2, whole: 2, serving: 1, scoop: 0.5, tbsp: 0.2 } }),
    F('vegetables', 'Vegetables', ['vegetable', 'veggie', 'broccoli', 'green bean', 'spinach', 'carrot', 'salad greens', 'asparagus', 'zucchini', 'mixed vegetables', 'pepper', 'cauliflower', 'brussels sprout', 'corn', 'peas'], 'cup', 2.5, 50, 9, 0.5, { units: { serving: 1, bowl: 2, handful: 0.5, plate: 2 } }),
    F('latte', 'Latte', ['latte', 'cappuccino', 'flat white', 'cafe au lait'], 'drink', 12, 190, 18, 7, { serv: '16 oz with 2% milk', units: { cup: 1, glass: 1 } }),
    F('coffee', 'Coffee', ['coffee', 'black coffee', 'espresso', 'americano', 'cold brew', 'tea', 'iced tea', 'diet soda', 'water', 'sparkling water', 'diet coke'], 'cup', 0, 5, 0, 0, { units: { mug: 1, glass: 1, can: 1, bottle: 1, shot: 0.3 } }),
    F('juice', 'Juice', ['juice', 'orange juice', 'apple juice', 'smoothie', 'soda', 'coke', 'pepsi', 'lemonade', 'sports drink', 'gatorade'], 'cup', 1, 120, 28, 0, { units: { glass: 1, can: 1.5, bottle: 2.5 } }),
    F('beer', 'Beer', ['beer', 'lager', 'ipa'], 'beer', 2, 150, 13, 0, { units: { can: 1, bottle: 1, pint: 1.33, glass: 1 } }),
    F('wine', 'Wine', ['wine', 'red wine', 'white wine'], 'glass', 0, 125, 4, 0, { units: { bottle: 5 } }),
    F('milkshake', 'Milkshake', ['milkshake', 'milk shake', 'frappuccino'], 'shake', 10, 550, 80, 20, { units: { cup: 1 } }),
    F('ice-cream', 'Ice cream', ['ice cream', 'gelato', 'frozen yogurt', 'froyo'], 'scoop', 2.5, 140, 16, 7, { g: 66, units: { cup: 2, bowl: 3, cone: 1.5, pint: 4, serving: 1 } }),
    F('cookie', 'Cookie', ['cookie', 'brownie', 'donut', 'doughnut', 'muffin', 'cupcake', 'pastry', 'croissant'], 'piece', 2, 200, 28, 9, { units: { serving: 1 } }),
    F('granola-bar', 'Granola bar', ['granola bar', 'cereal bar', 'snack bar'], 'bar', 3, 190, 29, 7, {}),
    F('chocolate', 'Chocolate', ['chocolate', 'candy', 'candy bar', 'chocolate bar'], 'bar', 3, 230, 26, 13, { units: { piece: 0.2, square: 0.1, handful: 0.7 } }),
  ];

  /** Brands we recognize by name. Specific products with sourced nutrition live in js/products.js; for any
   * other product of these brands the generic food is used and the entry says so — never invented numbers. */
  WT.FOOD_BRANDS = {
    'oscar mayer': 'Oscar Mayer', 'ball park': 'Ball Park', 'hebrew national': 'Hebrew National', nathans: "Nathan's", "nathan's": "Nathan's", 'hillshire': 'Hillshire',
    chobani: 'Chobani', fage: 'Fage', siggi: "Siggi's", siggis: "Siggi's", 'two good': 'Two Good', dannon: 'Dannon', yoplait: 'Yoplait', ratio: 'Ratio',
    fairlife: 'Fairlife', 'muscle milk': 'Muscle Milk', 'optimum nutrition': 'Optimum Nutrition', 'gold standard': 'Gold Standard', dymatize: 'Dymatize',
    isopure: 'Isopure', ghost: 'Ghost', 'orgain': 'Orgain', 'owyn': 'OWYN', 'ensure': 'Ensure', 'slimfast': 'SlimFast', 'atkins': 'Atkins', 'pure protein': 'Pure Protein',
    'one bar': 'ONE', rxbar: 'RXBAR', 'clif': 'Clif', 'kind bar': 'KIND', 'barebells': 'Barebells',
    barilla: 'Barilla', banza: 'Banza', 'good culture': 'Good Culture', breakstone: 'Breakstone',
    starkist: 'StarKist', 'bumble bee': 'Bumble Bee', 'chicken of the sea': 'Chicken of the Sea', tyson: 'Tyson', perdue: 'Perdue', 'boars head': "Boar's Head", "boar's head": "Boar's Head",
    kirkland: 'Kirkland', 'trader joes': "Trader Joe's", "trader joe's": "Trader Joe's", subway: 'Subway', chipotle: 'Chipotle', mcdonalds: "McDonald's", "mcdonald's": "McDonald's",
    'chick fil a': 'Chick-fil-A', 'starbucks': 'Starbucks', 'jack links': "Jack Link's", "jack link's": "Jack Link's", chomps: 'Chomps', 'premier': 'Premier', 'core power': 'Core Power',
    'pioneer pastures': 'Pioneer Pastures', oikos: 'Oikos', jif: 'Jif', kraft: 'Kraft', kodiak: 'Kodiak', quest: 'Quest', 'oscar meyer': 'Oscar Mayer', skippy: 'Skippy', 'peter pan': 'Peter Pan', sargento: 'Sargento', 'tillamook': 'Tillamook',
  };
})();
