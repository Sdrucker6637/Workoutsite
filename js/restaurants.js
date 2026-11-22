/* Restaurant & fast-food menus.
 *
 * Values are per standard restaurant portion as [calories, protein, carbs, fat], transcribed from each chain's
 * published US nutrition information. This environment couldn't re-check them online, so:
 *   status 'reference' — a chain whose published values are stable and widely reproduced (Chipotle,
 *                        McDonald's, Chick-fil-A, Taco Bell core items). Shown as "Restaurant data".
 *   status 'estimated' — items whose recipes or builds vary (Subway, Panera, Shake Shack, some sides).
 * Either way the entry says where the numbers come from and that recipes change; correcting a value saves
 * your corrected version for next time.
 *
 * Items:
 *   role     'protein' | 'base' | 'topping' | 'side' | 'entree' | 'sauce' | 'drink' — build-your-own chains
 *            (Chipotle) use roles to assemble bowls, burritos, tacos and salads from components.
 *   sizes    { small, medium, large } → [cal, p, c, f]; `def` is the size assumed when none is typed.
 *   own      the name is distinctive enough to recognize without the chain name ("Big Mac", "McNuggets").
 *   st       per-item status override.
 */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const R = (id, n, a, m, x) => Object.assign({ id, n, a, m, unit: 'serving' }, x || {});

  WT.CHAINS = [
    {
      id: 'chipotle', name: 'Chipotle', a: ['chipotle', 'chipotle mexican grill'], status: 'reference',
      src: 'Chipotle published nutrition (standard 4 oz / 2 oz portions)', build: true,
      // A format adds its base items; a bowl adds nothing on its own.
      formats: {
        bowl: { a: ['bowl', 'burrito bowl'], adds: [] },
        burrito: { a: ['burrito'], adds: [['tortilla-burrito', 1]] },
        tacos: { a: ['taco', 'tacos'], adds: [['taco-crispy', 3]], soft: [['taco-flour', 3]] },
        salad: { a: ['salad'], adds: [['supergreens', 1]] },
        quesadilla: { a: ['quesadilla'], adds: [['tortilla-burrito', 1], ['cheese', 2]] },
      },
      items: [
        R('chicken', 'Chicken', ['chicken', 'grilled chicken', 'chicken adobo'], [180, 32, 0, 7], { role: 'protein', serv: '4 oz' }),
        R('steak', 'Steak', ['steak'], [150, 21, 1, 6], { role: 'protein', serv: '4 oz' }),
        R('barbacoa', 'Barbacoa', ['barbacoa'], [170, 24, 2, 7], { role: 'protein', serv: '4 oz' }),
        R('carnitas', 'Carnitas', ['carnitas', 'pork'], [210, 23, 0, 12], { role: 'protein', serv: '4 oz' }),
        R('sofritas', 'Sofritas', ['sofritas', 'tofu'], [150, 8, 9, 10], { role: 'protein', serv: '4 oz' }),
        R('rice-white', 'Cilantro-lime white rice', ['white rice', 'rice', 'cilantro lime rice', 'cilantro lime white rice'], [210, 4, 40, 4], { role: 'base', serv: '4 oz' }),
        R('rice-brown', 'Cilantro-lime brown rice', ['brown rice', 'cilantro lime brown rice'], [210, 4, 36, 6], { role: 'base', serv: '4 oz' }),
        R('beans-black', 'Black beans', ['black bean', 'black beans'], [130, 8, 22, 1.5], { role: 'base', serv: '4 oz' }),
        R('beans-pinto', 'Pinto beans', ['pinto bean', 'pinto beans'], [130, 8, 21, 1.5], { role: 'base', serv: '4 oz' }),
        R('fajita-veg', 'Fajita veggies', ['fajita veggie', 'fajita vegetable', 'fajita', 'veggies', 'peppers and onions'], [20, 1, 5, 0], { role: 'topping', serv: '2 oz' }),
        R('salsa-tomato', 'Fresh tomato salsa', ['fresh tomato salsa', 'tomato salsa', 'pico de gallo', 'mild salsa', 'salsa', 'pico'], [25, 1, 4, 0], { role: 'topping', serv: '4 oz' }),
        R('salsa-corn', 'Roasted chili-corn salsa', ['corn salsa', 'roasted chili corn salsa', 'chili corn salsa', 'corn'], [80, 3, 16, 1.5], { role: 'topping', serv: '4 oz' }),
        R('salsa-green', 'Tomatillo-green chili salsa', ['green salsa', 'tomatillo green salsa', 'medium salsa', 'tomatillo salsa'], [15, 0, 4, 0], { role: 'topping', serv: '2 oz' }),
        R('salsa-red', 'Tomatillo-red chili salsa', ['red salsa', 'hot salsa', 'tomatillo red salsa'], [30, 0, 4, 0], { role: 'topping', serv: '2 oz' }),
        R('sour-cream', 'Sour cream', ['sour cream'], [110, 2, 2, 9], { role: 'topping', serv: '2 oz' }),
        R('cheese', 'Cheese', ['cheese', 'shredded cheese', 'monterey jack'], [110, 6, 1, 8], { role: 'topping', serv: '1 oz' }),
        R('guac', 'Guacamole', ['guacamole', 'guac', 'side of guac', 'side of guacamole'], [230, 2, 8, 22], { role: 'topping', serv: '4 oz' }),
        R('queso', 'Queso blanco', ['queso', 'queso blanco'], [120, 5, 4, 9], { role: 'topping', serv: '2 oz' }),
        R('lettuce', 'Romaine lettuce', ['lettuce', 'romaine', 'romaine lettuce'], [5, 0, 1, 0], { role: 'topping', serv: '1 oz' }),
        R('supergreens', 'Supergreens lettuce blend', ['supergreens', 'supergreen', 'greens', 'salad greens'], [15, 1, 3, 0], { role: 'base', serv: '3 oz' }),
        R('tortilla-burrito', 'Flour tortilla (burrito)', ['tortilla', 'flour tortilla', 'burrito tortilla'], [320, 8, 50, 9], { role: 'base', serv: '1 tortilla' }),
        R('taco-crispy', 'Crispy corn tortilla', ['crispy corn tortilla', 'crispy taco shell', 'hard shell', 'taco shell'], [70, 1, 9, 3], { role: 'base', serv: '1 taco shell' }),
        R('taco-flour', 'Soft flour tortilla (taco)', ['soft flour tortilla', 'soft taco tortilla', 'soft tortilla'], [80, 2, 13, 2.5], { role: 'base', serv: '1 taco tortilla' }),
        R('chips', 'Chips', ['chips', 'tortilla chips', 'side of chips', 'bag of chips'], [540, 7, 73, 25], { role: 'side', serv: '1 bag (4 oz)' }),
        R('vinaigrette', 'Chipotle-honey vinaigrette', ['vinaigrette', 'chipotle honey vinaigrette', 'honey vinaigrette', 'dressing'], [220, 1, 16, 16], { role: 'sauce', serv: '2 oz' }),
      ],
    },
    {
      id: 'mcdonalds', name: "McDonald's", a: ['mcdonalds', 'mcdonald', 'mcds', 'mickey ds'], status: 'reference', src: "McDonald's US published nutrition",
      items: [
        R('big-mac', 'Big Mac', ['big mac'], [590, 25, 46, 34], { role: 'entree', own: ['big mac'] }),
        R('qpc', 'Quarter Pounder with Cheese', ['quarter pounder with cheese', 'quarter pounder', 'qpc', 'quarter pounder cheese'], [520, 30, 42, 26], { role: 'entree', own: ['quarter pounder with cheese', 'quarter pounder'] }),
        R('double-qpc', 'Double Quarter Pounder with Cheese', ['double quarter pounder', 'double quarter pounder with cheese'], [740, 48, 43, 42], { role: 'entree', own: ['double quarter pounder'] }),
        R('mcdouble', 'McDouble', ['mcdouble'], [400, 22, 33, 20], { role: 'entree', own: ['mcdouble'] }),
        R('double-cheeseburger', 'Double Cheeseburger', ['double cheeseburger'], [450, 25, 34, 24], { role: 'entree' }),
        R('cheeseburger', 'Cheeseburger', ['cheeseburger'], [300, 15, 32, 13], { role: 'entree' }),
        R('hamburger', 'Hamburger', ['hamburger', 'burger'], [250, 12, 31, 9], { role: 'entree' }),
        R('mcchicken', 'McChicken', ['mcchicken'], [400, 14, 39, 21], { role: 'entree', own: ['mcchicken'] }),
        R('mccrispy', 'McCrispy', ['mccrispy', 'crispy chicken sandwich', 'chicken sandwich'], [470, 26, 46, 20], { role: 'entree', own: ['mccrispy'] }),
        R('filet-o-fish', 'Filet-O-Fish', ['filet o fish', 'fillet o fish', 'fish sandwich', 'filet of fish'], [390, 16, 38, 19], { role: 'entree', own: ['filet o fish', 'fillet o fish'] }),
        R('nuggets', 'Chicken McNuggets', ['mcnugget', 'chicken mcnugget', 'nugget', 'chicken nugget', 'nuggets'], [42.5, 2.3, 2.5, 2.5], { role: 'entree', own: ['mcnugget', 'chicken mcnugget'], unit: 'piece', count: true, dq: 6, packs: { 4: [170, 9, 10, 10], 6: [250, 14, 15, 15], 10: [410, 23, 25, 24], 20: [830, 46, 51, 49] }, serv: 'per piece (4, 6, 10 and 20 pc use the published pack values)' }),
        R('fries', 'World Famous Fries', ['fries', 'french fries', 'fry'], null, { role: 'side', sizes: { small: [230, 3, 31, 11], medium: [320, 5, 43, 15], large: [480, 7, 65, 23] }, def: 'medium' }),
        R('egg-mcmuffin', 'Egg McMuffin', ['egg mcmuffin'], [310, 17, 30, 13], { role: 'entree', own: ['egg mcmuffin'] }),
        R('sausage-mcmuffin-egg', 'Sausage McMuffin with Egg', ['sausage mcmuffin with egg', 'sausage egg mcmuffin', 'sausage mcmuffin egg'], [480, 20, 30, 31], { role: 'entree', own: ['sausage mcmuffin with egg', 'sausage egg mcmuffin'] }),
        R('sausage-mcmuffin', 'Sausage McMuffin', ['sausage mcmuffin'], [400, 14, 29, 26], { role: 'entree', own: ['sausage mcmuffin'] }),
        R('hash-brown', 'Hash Browns', ['hash brown', 'hashbrown', 'hash browns'], [140, 2, 18, 8], { role: 'side' }),
        R('hotcakes', 'Hotcakes (with syrup and butter)', ['hotcake', 'hotcakes', 'pancake', 'pancakes'], [580, 9, 101, 15], { role: 'entree', st: 'estimated' }),
        R('sausage-burrito', 'Sausage Burrito', ['sausage burrito', 'breakfast burrito', 'burrito'], [310, 13, 25, 17], { role: 'entree' }),
        R('apple-slices', 'Apple Slices', ['apple slice', 'apple slices', 'apples'], [15, 0, 4, 0], { role: 'side' }),
        R('coke', 'Coca-Cola', ['coke', 'coca cola', 'soda', 'soft drink', 'sprite'], null, { role: 'drink', st: 'estimated', sizes: { small: [150, 0, 40, 0], medium: [200, 0, 55, 0], large: [290, 0, 77, 0] }, def: 'medium' }),
        R('diet-coke', 'Diet Coke', ['diet coke', 'coke zero', 'diet soda'], [0, 0, 0, 0], { role: 'drink' }),
      ],
    },
    {
      id: 'chickfila', name: 'Chick-fil-A', a: ['chick fil a', 'chickfila', 'chick fila', 'chik fil a', 'cfa'], status: 'reference', src: 'Chick-fil-A published nutrition',
      items: [
        R('sandwich', 'Chick-fil-A Chicken Sandwich', ['chicken sandwich', 'original chicken sandwich', 'chick fil a sandwich', 'sandwich', 'original sandwich'], [420, 29, 41, 18], { role: 'entree' }),
        R('spicy-sandwich', 'Spicy Chicken Sandwich', ['spicy chicken sandwich', 'spicy sandwich', 'spicy deluxe'], [450, 28, 45, 19], { role: 'entree', st: 'estimated' }),
        R('grilled-sandwich', 'Grilled Chicken Sandwich', ['grilled chicken sandwich', 'grilled sandwich'], [390, 28, 44, 12], { role: 'entree' }),
        R('nuggets', 'Chick-fil-A Nuggets', ['nugget', 'nuggets', 'chicken nugget', 'chicken nuggets'], [31, 3.4, 1.4, 1.4], { role: 'entree', unit: 'piece', count: true, dq: 8, packs: { 8: [250, 27, 11, 11], 12: [380, 40, 16, 17] }, serv: 'per piece (8 and 12 ct use the published values)' }),
        R('grilled-nuggets', 'Grilled Nuggets', ['grilled nugget', 'grilled nuggets'], [16, 3.1, 0.1, 0.4], { role: 'entree', unit: 'piece', count: true, dq: 8, packs: { 8: [130, 25, 1, 3], 12: [200, 38, 2, 4.5] }, serv: 'per piece (8 and 12 ct use the published values)' }),
        R('strips', 'Chick-n-Strips', ['strip', 'strips', 'chick n strips', 'chicken strips', 'tenders', 'chicken tenders'], [103, 9.7, 5.3, 4.7], { role: 'entree', unit: 'strip', count: true, dq: 3, st: 'estimated', serv: 'per strip' }),
        R('waffle-fries', 'Waffle Potato Fries', ['waffle fries', 'waffle fry', 'fries', 'waffle potato fries'], null, { role: 'side', st: 'estimated', sizes: { small: [320, 4, 35, 18], medium: [420, 5, 45, 24], large: [560, 7, 61, 32] }, def: 'medium' }),
        R('mac', 'Mac & Cheese', ['mac and cheese', 'mac n cheese', 'macaroni and cheese'], null, { role: 'side', st: 'estimated', sizes: { small: [270, 12, 18, 17], medium: [450, 20, 29, 29], large: [580, 25, 38, 37] }, def: 'medium' }),
        R('cfa-sauce', 'Chick-fil-A Sauce', ['chick fil a sauce', 'cfa sauce', 'sauce'], [140, 0, 7, 13], { role: 'sauce', unit: 'packet' }),
        R('polynesian', 'Polynesian Sauce', ['polynesian sauce', 'polynesian'], [110, 0, 13, 6], { role: 'sauce', unit: 'packet', st: 'estimated' }),
        R('bbq', 'Barbeque Sauce', ['bbq sauce', 'barbecue sauce', 'barbeque sauce', 'bbq'], [45, 0, 11, 0], { role: 'sauce', unit: 'packet', st: 'estimated' }),
        R('honey-mustard', 'Honey Mustard Sauce', ['honey mustard'], [50, 0, 10, 0], { role: 'sauce', unit: 'packet', st: 'estimated' }),
        R('ranch', 'Garden Herb Ranch Sauce', ['ranch', 'garden herb ranch'], [140, 0, 2, 15], { role: 'sauce', unit: 'packet', st: 'estimated' }),
        R('fruit-cup', 'Fruit Cup', ['fruit cup', 'fruit'], [60, 1, 15, 0], { role: 'side', st: 'estimated' }),
      ],
    },
    {
      id: 'tacobell', name: 'Taco Bell', a: ['taco bell', 'tacobell'], status: 'reference', src: 'Taco Bell published nutrition',
      items: [
        R('crunchy-taco', 'Crunchy Taco', ['crunchy taco', 'taco', 'hard taco', 'hard shell taco'], [170, 8, 13, 9], { role: 'entree' }),
        R('soft-taco', 'Soft Taco', ['soft taco'], [180, 9, 17, 9], { role: 'entree' }),
        R('crunchy-taco-supreme', 'Crunchy Taco Supreme', ['crunchy taco supreme', 'taco supreme'], [190, 8, 15, 11], { role: 'entree' }),
        R('dlt', 'Doritos Locos Taco', ['doritos locos taco', 'doritos taco', 'dlt'], [170, 8, 13, 9], { role: 'entree', own: ['doritos locos taco'] }),
        R('crunchwrap', 'Crunchwrap Supreme', ['crunchwrap supreme', 'crunchwrap'], [530, 16, 71, 21], { role: 'entree', own: ['crunchwrap supreme', 'crunchwrap'] }),
        R('cheesy-gordita', 'Cheesy Gordita Crunch', ['cheesy gordita crunch', 'gordita crunch', 'cheesy gordita'], [500, 20, 41, 28], { role: 'entree', own: ['cheesy gordita crunch'] }),
        R('chalupa', 'Chalupa Supreme', ['chalupa supreme', 'chalupa'], [350, 13, 30, 20], { role: 'entree', own: ['chalupa supreme', 'chalupa'] }),
        R('burrito-supreme', 'Burrito Supreme', ['burrito supreme'], [390, 16, 51, 14], { role: 'entree' }),
        R('bean-burrito', 'Bean Burrito', ['bean burrito', 'burrito'], [350, 13, 55, 9], { role: 'entree' }),
        R('quesadilla', 'Chicken Quesadilla', ['chicken quesadilla', 'quesadilla'], [510, 26, 37, 27], { role: 'entree', st: 'estimated' }),
        R('mexican-pizza', 'Mexican Pizza', ['mexican pizza'], [540, 20, 49, 30], { role: 'entree', own: ['mexican pizza'] }),
        R('nachos-bellgrande', 'Nachos BellGrande', ['nachos bellgrande', 'nachos bell grande', 'nachos'], [740, 16, 82, 38], { role: 'entree' }),
        R('power-bowl', 'Cantina Chicken Bowl', ['power bowl', 'chicken bowl', 'cantina bowl', 'bowl'], [460, 26, 50, 18], { role: 'entree', st: 'estimated' }),
        R('cinnamon-twists', 'Cinnamon Twists', ['cinnamon twist', 'cinnamon twists'], [170, 1, 26, 7], { role: 'side', st: 'estimated' }),
      ],
    },
    {
      id: 'subway', name: 'Subway', a: ['subway'], status: 'estimated', src: 'Subway published nutrition, approximate: depends on bread, cheese and sauce',
      note: '6-inch on white bread with standard vegetables, no cheese or sauce. A footlong is twice this.',
      items: [
        R('turkey', 'Oven Roasted Turkey sub', ['turkey', 'turkey breast', 'turkey sub', 'oven roasted turkey'], [270, 18, 41, 3.5], { role: 'entree', six: true }),
        R('chicken', 'Rotisserie-Style Chicken sub', ['chicken', 'rotisserie chicken', 'chicken sub', 'grilled chicken'], [310, 25, 41, 6], { role: 'entree', six: true }),
        R('italian-bmt', 'Italian B.M.T. sub', ['italian bmt', 'bmt', 'italian'], [390, 19, 42, 16], { role: 'entree', six: true }),
        R('meatball', 'Meatball Marinara sub', ['meatball marinara', 'meatball', 'meatball sub'], [480, 21, 59, 18], { role: 'entree', six: true }),
        R('steak-cheese', 'Steak & Cheese sub', ['steak and cheese', 'steak', 'philly'], [380, 26, 48, 10], { role: 'entree', six: true }),
        R('tuna', 'Tuna sub', ['tuna', 'tuna sub'], [480, 20, 44, 25], { role: 'entree', six: true }),
        R('veggie', 'Veggie Delite sub', ['veggie delite', 'veggie', 'veggie sub'], [230, 9, 44, 3], { role: 'entree', six: true }),
        R('blt', 'B.L.T. sub', ['blt'], [360, 17, 41, 14], { role: 'entree', six: true }),
        R('ham', 'Black Forest Ham sub', ['ham', 'black forest ham', 'ham sub'], [290, 18, 45, 4.5], { role: 'entree', six: true }),
        R('cookie', 'Cookie', ['cookie'], [210, 2, 30, 10], { role: 'side' }),
        R('cheese', 'Cheese (2 slices, 6-inch)', ['cheese', 'american cheese', 'provolone'], [80, 4, 1, 7], { role: 'topping' }),
        R('mayo', 'Mayonnaise (6-inch)', ['mayo', 'mayonnaise'], [110, 0, 0, 12], { role: 'sauce' }),
      ],
    },
    {
      id: 'shakeshack', name: 'Shake Shack', a: ['shake shack', 'shakeshack'], status: 'estimated', src: 'Shake Shack published nutrition (approximate)',
      items: [
        R('shackburger', 'ShackBurger', ['shackburger', 'shack burger', 'burger', 'cheeseburger'], [500, 28, 26, 30], { role: 'entree', own: ['shackburger', 'shack burger'] }),
        R('double-shackburger', 'Double ShackBurger', ['double shackburger', 'double shack burger', 'double burger'], [760, 51, 27, 49], { role: 'entree', own: ['double shackburger'] }),
        R('smokeshack', 'SmokeShack', ['smokeshack', 'smoke shack'], [570, 32, 26, 36], { role: 'entree', own: ['smokeshack'] }),
        R('hamburger', 'Hamburger', ['hamburger'], [370, 23, 24, 20], { role: 'entree' }),
        R('chicken-shack', 'Chicken Shack', ['chicken shack', 'chicken sandwich', 'chicken'], [590, 32, 50, 29], { role: 'entree', own: ['chicken shack'] }),
        R('fries', 'Fries', ['fries', 'crinkle cut fries', 'french fries'], [470, 6, 63, 22], { role: 'side' }),
        R('cheese-fries', 'Cheese Fries', ['cheese fries'], [710, 15, 69, 40], { role: 'side' }),
        R('shake', 'Shake (vanilla or chocolate)', ['shake', 'milkshake', 'vanilla shake', 'chocolate shake'], [680, 17, 80, 34], { role: 'drink' }),
      ],
    },
    {
      id: 'panera', name: 'Panera', a: ['panera', 'panera bread'], status: 'estimated', src: 'Panera published nutrition (approximate; recipes change seasonally)',
      items: [
        R('broccoli-cheddar', 'Broccoli Cheddar Soup', ['broccoli cheddar soup', 'broccoli cheddar', 'broccoli cheese soup', 'soup'], null, { role: 'entree', sizes: { small: [230, 9, 17, 14], medium: [360, 14, 30, 21], large: [360, 14, 30, 21] }, def: 'medium', sizeNames: { small: 'Cup', medium: 'Bowl', large: 'Bowl' }, sizeWords: { cup: 'small', bowl: 'medium' } }),
        R('bread-bowl', 'Sourdough bread bowl', ['bread bowl', 'sourdough bread bowl'], [570, 22, 112, 2.5], { role: 'base' }),
        R('mac', 'Mac & Cheese', ['mac and cheese', 'mac n cheese', 'mac'], null, { role: 'entree', sizes: { small: [470, 18, 37, 27], medium: [940, 37, 74, 54], large: [940, 37, 74, 54] }, def: 'medium', sizeWords: { cup: 'small', bowl: 'medium' } }),
        R('caesar-chicken', 'Caesar Salad with Chicken', ['caesar salad with chicken', 'chicken caesar salad', 'chicken caesar'], [470, 36, 19, 29], { role: 'entree', half: [240, 18, 10, 15] }),
        R('greek-salad', 'Greek Salad', ['greek salad'], [400, 7, 15, 36], { role: 'entree', half: [200, 4, 8, 18] }),
        R('fuji-apple-chicken', 'Fuji Apple Salad with Chicken', ['fuji apple salad', 'fuji apple chicken salad', 'apple salad'], [570, 32, 33, 34], { role: 'entree', half: [290, 16, 17, 17] }),
        R('turkey-sandwich', 'Roasted Turkey & Avocado BLT', ['turkey avocado blt', 'turkey sandwich', 'turkey and avocado'], [870, 46, 70, 46], { role: 'entree', half: [440, 23, 35, 23] }),
        R('chipotle-melt', 'Chipotle Chicken Avocado Melt', ['chipotle chicken avocado melt', 'chicken avocado melt', 'chipotle chicken melt'], [930, 47, 80, 46], { role: 'entree', half: [470, 24, 40, 23] }),
        R('frontega', 'Frontega Chicken Panini', ['frontega chicken', 'frontega'], [790, 46, 74, 34], { role: 'entree', own: ['frontega chicken', 'frontega'], half: [400, 23, 37, 17] }),
        R('baguette', 'French Baguette (side)', ['baguette', 'side of bread', 'bread'], [180, 6, 36, 0], { role: 'side' }),
        R('bagel', 'Plain Bagel', ['bagel', 'plain bagel'], [280, 10, 57, 1.5], { role: 'entree' }),
      ],
    },
  ];

  /** Words that change a restaurant portion. */
  WT.PORTION_MODS = { extra: 1.5, double: 2, light: 0.5, half: 0.5, triple: 3, side: 1 };
})();
