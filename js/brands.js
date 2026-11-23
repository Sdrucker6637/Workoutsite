/* Brand catalog: which product LINES, variants, flavors and package sizes each brand makes.
 *
 * This file holds NO nutrition. Its job is to let the matcher tell products apart, so that
 * "Barilla chickpea pasta" never lands on Barilla Protein+ and "Oscar Mayer turkey bacon" never lands on deli
 * turkey. When a line has nutrition, `p` links it to products in js/products.js. When it doesn't, Forge says it
 * knows the product but not its label, then offers to search online or let you enter the label. It never
 * borrows another product's numbers.
 *
 * Brand:   B(id, name, aliases, category, unit, lines, extra)
 * Line:    [name, aliases, { p: [product ids], cat, unit, variants: [[name, aliases, { p }]], flavors: [...], pack }]
 *   aliases  words that pick out the line within its brand. A word several lines share ("turkey" for Oscar Mayer)
 *            only narrows the choice; it never picks one line on its own.
 *   variants versions that are different products with different labels (Thin-Sliced bread, Zero Sugar…)
 *   flavors  flavors the line comes in (names only; nutrition per flavor comes from js/products.js)
 *   flavorMatters  flavors have materially different labels: with no flavor given, ask (otherwise the listed flavor's
 *            values are used, labelled "flavor not given")
 *   pack     package sizes: { unit: 'jar', sizes: [['24 oz', 680], ['32 oz', 907]], def: '24 oz' } (net grams)
 */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const B = (id, name, a, cat, unit, lines, x) => Object.assign({ id, name, a, cat, unit, lines: lines.map(([n, la, o]) => Object.assign({ id: slug(n), name: n, a: la || [], p: [], variants: [], flavors: [] }, o || {})) }, x || {});
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const SHAPES = ['spaghetti', 'penne', 'rotini', 'elbows', 'elbow', 'farfalle', 'angel hair', 'thin spaghetti', 'linguine', 'fettuccine', 'rigatoni', 'ziti', 'shells', 'lasagne', 'lasagna'];

  WT.BRAND_CATALOG = [
    /* ── Yogurt & dairy ── */
    B('oikos', 'Oikos', ['oikos', 'dannon oikos'], 'yogurt', 'cup', [
      ['Triple Zero', ['triple zero'], { p: ['oikos-triple-zero'], flavors: ['Vanilla', 'Mixed Berry', 'Strawberry', 'Peach', 'Black Cherry', 'Coconut Creme', 'Banana Creme', 'Salted Caramel', 'Plain', 'Cherry'], pack: { unit: 'tub', sizes: [['32 oz', 907]] } }],
      ['Pro', ['pro', 'oikos pro'], { p: ['oikos-pro-yogurt'], flavors: ['Vanilla', 'Banana', 'Strawberry', 'Plain', 'Mixed Berry'], pack: { unit: 'tub', sizes: [['32 oz', 907]] } }],
      ['Pro Drink', ['pro drink', 'pro shake', 'protein drink'], { cat: 'shake', unit: 'bottle', flavors: ['Vanilla', 'Chocolate', 'Strawberry', 'Mixed Berry'] }],
      ['Pro Shot', ['pro shot', 'shot'], { cat: 'shake', unit: 'bottle' }],
      ['Blended', ['blended'], {}],
      ['Fruit on the Bottom', ['fruit on the bottom'], {}],
    ]),
    B('chobani', 'Chobani', ['chobani'], 'yogurt', 'cup', [
      ['Complete Greek Yogurt', ['complete'], { p: ['chobani-complete-cup'], variants: [['Drink', ['drink', 'shake', 'bottle'], { p: ['chobani-complete-drink'] }]] }],
      ['Greek Yogurt (nonfat plain)', ['plain', 'nonfat plain', 'non fat plain', '0 plain'], {}],
      ['Greek Yogurt (flavored)', ['fruit on the bottom', 'blended', 'vanilla blended'], {}],
      ['Zero Sugar', ['zero sugar'], {}],
      ['Less Sugar', ['less sugar'], {}],
      ['Flip', ['flip'], {}],
      ['Oatmilk', ['oat milk', 'oatmilk'], { cat: 'milk' }],
    ]),
    B('fage', 'Fage', ['fage'], 'yogurt', 'cup', [
      ['Total 0%', ['total 0', '0%', 'total 0%', 'nonfat'], { pack: { unit: 'tub', sizes: [['17.6 oz', 500], ['32 oz', 907]] } }],
      ['Total 2%', ['total 2', '2%'], {}],
      ['Total 5%', ['total 5', '5%', 'whole milk'], {}],
      ['Total Split Cup', ['split cup', 'honey', 'strawberry', 'blueberry'], {}],
    ]),
    B('siggis', "Siggi's", ['siggis', 'siggi'], 'yogurt', 'cup', [['Icelandic Skyr', ['skyr', 'icelandic'], {}], ['Plant-Based', ['plant based'], {}], ['Drinkable', ['drinkable'], { cat: 'shake' }]]),
    B('two-good', 'Two Good', ['two good', '2 good'], 'yogurt', 'cup', [['Greek Yogurt', ['greek'], {}], ['Drinkable', ['drinkable', 'drink'], { cat: 'shake' }]]),
    B('ratio', 'Ratio', ['ratio protein', 'ratio yogurt', 'ratio keto'], 'yogurt', 'cup', [['Protein Yogurt', ['protein'], {}], ['Keto Yogurt', ['keto'], {}]]),
    B('dannon', 'Dannon', ['dannon'], 'yogurt', 'cup', [['Light + Fit', ['light and fit', 'light plus fit', 'light fit'], {}], ['Light + Fit Protein Shake', ['light and fit shake', 'protein shake'], { cat: 'shake' }], ['Activia', ['activia'], {}]]),
    B('yoplait', 'Yoplait', ['yoplait'], 'yogurt', 'cup', [['Original', ['original'], {}], ['Light', ['light'], {}], ['Protein', ['protein'], {}], ['Go-GURT', ['gogurt', 'go gurt'], { unit: 'tube' }]]),
    B('fairlife', 'fairlife', ['fairlife', 'fair life'], 'milk', 'cup', [
      ['Core Power (26 g)', ['core power'], { p: ['fairlife-core-power'], cat: 'shake', unit: 'bottle', variants: [['Elite (42 g)', ['elite'], { p: ['fairlife-core-power-elite'] }]] }],
      ['Nutrition Plan', ['nutrition plan'], { p: ['fairlife-nutrition-plan'], cat: 'shake', unit: 'bottle' }],
      ['Ultra-Filtered Milk 2%', ['2%', '2 milk', 'reduced fat'], { p: ['fairlife-2-milk'] }],
      ['Ultra-Filtered Milk Whole', ['whole milk', 'whole'], {}],
      ['Ultra-Filtered Milk Fat Free', ['fat free', 'skim', 'nonfat'], {}],
      ['Ultra-Filtered Chocolate Milk', ['chocolate milk', 'chocolate'], {}],
    ]),
    B('good-culture', 'Good Culture', ['good culture'], 'cottage', 'cup', [['Cottage Cheese', ['cottage cheese', 'cottage'], {}], ['Sour Cream', ['sour cream'], {}]]),
    B('kraft', 'Kraft', ['kraft'], 'cheese', 'slice', [
      ['Singles American', ['single', 'singles', 'american slices'], { p: ['kraft-singles-american'], variants: [['2% Milk', ['2%', 'reduced fat'], {}], ['Extra Thick', ['extra thick', 'thick'], {}]] }],
      ['Shredded Cheese', ['shredded'], { unit: 'cup' }],
      ['Macaroni & Cheese', ['mac and cheese', 'macaroni and cheese', 'mac n cheese', 'mac'], { cat: 'meal', unit: 'cup' }],
      ['Grated Parmesan', ['parmesan'], { unit: 'tbsp' }],
    ]),
    B('tillamook', 'Tillamook', ['tillamook'], 'cheese', 'slice', [['Medium Cheddar', ['cheddar', 'medium cheddar'], {}], ['Sharp Cheddar', ['sharp'], {}], ['Ice Cream', ['ice cream'], { cat: 'dessert', unit: 'cup' }]]),
    B('sargento', 'Sargento', ['sargento'], 'cheese', 'slice', [['Sliced Cheese', ['slice', 'sliced'], {}], ['String Cheese', ['string', 'stick'], { unit: 'stick' }], ['Shredded Cheese', ['shredded'], { unit: 'cup' }], ['Balanced Breaks', ['balanced breaks'], { unit: 'pack' }]]),

    /* ── Shakes, bars, powders ── */
    B('pioneer-pastures', 'Pioneer Pastures', ['pioneer pastures', 'pioneer pasture'], 'shake', 'bottle', [
      ['A2 Protein Shake', ['a2', 'protein shake', 'shake'], { p: ['pioneer-a2-shake'], flavors: ['Vanilla', 'Chocolate', 'Strawberries & Cream'] }],
    ]),
    B('premier', 'Premier Protein', ['premier protein', 'premier'], 'shake', 'bottle', [
      ['Protein Shake', ['shake', 'protein shake'], { p: ['premier-protein-shake'] }],
      ['Protein Powder', ['powder', 'scoop'], { cat: 'powder', unit: 'scoop' }],
      ['Clear Protein Drink', ['clear'], {}],
      ['Protein Bar', ['bar'], { cat: 'bar', unit: 'bar' }],
    ]),
    B('quest', 'Quest', ['quest', 'quest nutrition'], 'bar', 'bar', [
      ['Protein Bar', ['bar', 'protein bar'], { p: ['quest-bar-cccd'], flavorMatters: true, flavors: ['Chocolate Chip Cookie Dough', 'Cookies & Cream', 'Birthday Cake', 'Chocolate Brownie', 'Peanut Butter Brownie', "S'mores", 'Blueberry Muffin', 'Mint Chocolate Chunk', 'Chocolate Peanut Butter', 'Double Chocolate Chunk', 'Salted Caramel'] }],
      ['Protein Chips', ['chips', 'chip'], { cat: 'chips', unit: 'bag' }],
      ['Protein Cookie', ['cookie'], { cat: 'cookie', unit: 'cookie' }],
      ['Hero Bar', ['hero'], {}],
      ['Protein Powder', ['powder', 'scoop'], { cat: 'powder', unit: 'scoop' }],
    ]),
    B('muscle-milk', 'Muscle Milk', ['muscle milk'], 'shake', 'bottle', [['Genuine Protein Shake', ['genuine'], {}], ['Pro Series', ['pro series', 'pro'], {}], ['Protein Powder', ['powder'], { cat: 'powder', unit: 'scoop' }]]),
    B('orgain', 'Orgain', ['orgain'], 'shake', 'bottle', [['Organic Protein Shake', ['shake'], {}], ['Organic Protein Powder', ['powder'], { cat: 'powder', unit: 'scoop' }]]),
    B('owyn', 'OWYN', ['owyn'], 'shake', 'bottle', [['Protein Shake', ['shake'], {}], ['Pro Elite', ['elite'], {}]]),
    B('ensure', 'Ensure', ['ensure'], 'shake', 'bottle', [['Max Protein', ['max', 'max protein'], {}], ['Original', ['original'], {}], ['Plus', ['plus', 'ensure plus'], {}]]),
    B('optimum', 'Optimum Nutrition', ['optimum nutrition', 'on gold standard', 'gold standard'], 'powder', 'scoop', [['Gold Standard 100% Whey', ['gold standard', 'whey'], {}], ['Gold Standard Casein', ['casein'], {}], ['Protein Shake (ready to drink)', ['shake', 'rtd'], { cat: 'shake', unit: 'bottle' }]]),
    B('dymatize', 'Dymatize', ['dymatize'], 'powder', 'scoop', [['ISO100', ['iso100', 'iso 100', 'iso'], {}], ['Elite 100% Whey', ['elite'], {}]]),
    B('ghost', 'Ghost', ['ghost protein', 'ghost whey', 'ghost'], 'powder', 'scoop', [['Whey Protein', ['whey', 'protein'], {}], ['Energy', ['energy'], { cat: 'drink', unit: 'can' }]]),
    B('pure-protein', 'Pure Protein', ['pure protein'], 'bar', 'bar', [['Protein Bar', ['bar'], {}], ['Protein Shake', ['shake'], { cat: 'shake', unit: 'bottle' }]]),
    B('barebells', 'Barebells', ['barebells', 'bare bells'], 'bar', 'bar', [['Protein Bar', ['bar'], { flavors: ['Cookies & Cream', 'Salty Peanut', 'Caramel Cashew', 'Hazelnut & Nougat', 'Birthday Cake'] }]]),
    B('rxbar', 'RXBAR', ['rxbar', 'rx bar'], 'bar', 'bar', [['Protein Bar', ['bar'], {}]]),
    B('clif', 'Clif', ['clif', 'cliff bar', 'clif bar'], 'bar', 'bar', [['Clif Bar', ['clif bar'], {}], ['Builders', ['builders', 'builder'], {}]]),
    B('kind', 'KIND', ['kind bar', 'kind protein', 'kind'], 'bar', 'bar', [['Nut Bar', ['nut'], {}], ['Protein Bar', ['protein'], {}]]),
    B('one', 'ONE', ['one bar', 'one protein bar'], 'bar', 'bar', [['Protein Bar', ['bar'], {}]]),

    /* ── Bread & breakfast ── */
    B('daves-killer-bread', "Dave's Killer Bread", ['daves killer bread', 'dave killer bread', 'daves killer', 'dkb'], 'bread', 'slice', [
      ['21 Whole Grains and Seeds', ['21 whole grains', '21 whole grain', '21 grain'], { p: ['daves-21-whole-grains'], variants: [['Thin-Sliced', ['thin sliced', 'thin slice', 'thin'], {}]] }],
      ['Good Seed', ['good seed'], { variants: [['Thin-Sliced', ['thin sliced', 'thin'], {}]] }],
      ['Powerseed', ['powerseed', 'power seed'], { variants: [['Thin-Sliced', ['thin sliced', 'thin'], {}]] }],
      ['White Bread Done Right', ['white bread done right', 'white bread', 'white', 'done right'], { variants: [['Thin-Sliced', ['thin sliced', 'thin'], {}]] }],
      ['100% Whole Wheat', ['100 whole wheat', '100% whole wheat', 'whole wheat'], { variants: [['Thin-Sliced', ['thin sliced', 'thin'], {}]] }],
      ["Rockin' Grains", ['rockin grains', 'rocking grains', 'rockin'], {}],
      ['Honey Oats & Flax', ['honey oats and flax', 'honey oats', 'honey oat'], {}],
      ["Raisin' the Roof!", ['raisin the roof', 'raisin'], {}],
      ['Epic Everything Bagels', ['epic everything', 'everything bagel'], { cat: 'bagel', unit: 'bagel' }],
      ['Plain Awesome Bagels', ['plain awesome'], { cat: 'bagel', unit: 'bagel' }],
      ['Burger Buns', ['burger bun', 'bun', 'buns'], { cat: 'bun', unit: 'bun' }],
    ]),
    B('natures-own', "Nature's Own", ['natures own'], 'bread', 'slice', [['100% Whole Wheat', ['whole wheat'], {}], ['Honey Wheat', ['honey wheat'], {}], ['Butterbread', ['butterbread', 'butter bread'], {}], ['Keto', ['keto'], {}]]),
    B('sara-lee', 'Sara Lee', ['sara lee'], 'bread', 'slice', [['Classic White', ['white'], {}], ['100% Whole Wheat', ['whole wheat'], {}], ['Delightful', ['delightful'], {}]]),
    B('thomas', "Thomas'", ['thomas', 'thomas english muffin'], 'bread', 'muffin', [['English Muffins', ['english muffin', 'muffin'], {}], ['Bagels', ['bagel'], { cat: 'bagel', unit: 'bagel' }]]),
    B('kodiak', 'Kodiak', ['kodiak', 'kodiak cakes'], 'pancake', 'serving', [
      ['Power Cakes Mix', ['power cakes', 'pancake mix', 'flapjack', 'mix', 'buttermilk'], { p: ['kodiak-power-cakes'], flavors: ['Buttermilk', 'Dark Chocolate', 'Cinnamon', 'Chocolate Chip'] }],
      ['Protein Oatmeal Cup', ['oatmeal', 'oat'], { cat: 'oatmeal', unit: 'cup' }],
      ['Power Waffles (frozen)', ['waffle', 'waffles', 'frozen'], { unit: 'waffle' }],
      ['Bear Bites', ['bear bites'], { cat: 'snack', unit: 'serving' }],
    ]),
    B('quaker', 'Quaker', ['quaker'], 'oatmeal', 'packet', [['Instant Oatmeal', ['instant'], {}], ['Old Fashioned Oats', ['old fashioned', 'rolled'], { unit: 'cup' }], ['Protein Instant Oatmeal', ['protein'], {}]]),

    /* ── Pasta & sauce ── */
    B('barilla', 'Barilla', ['barilla'], 'pasta', 'serving', [
      ['Protein+', ['protein plus', 'protein', 'plus', ...SHAPES.map((x) => 'protein ' + x), ...SHAPES.map((x) => 'protein plus ' + x)], { p: ['barilla-protein-plus'], pack: { unit: 'box', sizes: [['14.5 oz', 411]] } }],
      ['Chickpea Pasta', ['chickpea', 'chickpea pasta', ...SHAPES.map((x) => 'chickpea ' + x)], {}],
      ['Red Lentil Pasta', ['red lentil', 'lentil', ...SHAPES.map((x) => 'red lentil ' + x)], {}],
      ['Whole Grain', ['whole grain', 'whole wheat'], {}],
      ['Gluten Free', ['gluten free'], {}],
      ['Classic Blue Box', SHAPES.concat(['classic', 'blue box', 'regular']), { pack: { unit: 'box', sizes: [['16 oz', 454]] } }],
      ['Ready Pasta', ['ready pasta', 'ready'], {}],
      ['Marinara Sauce', ['marinara'], { cat: 'sauce', unit: 'cup' }],
      ['Traditional Sauce', ['traditional'], { cat: 'sauce', unit: 'cup' }],
      ['Tomato & Basil Sauce', ['tomato and basil', 'tomato basil'], { cat: 'sauce', unit: 'cup' }],
    ]),
    B('raos', "Rao's", ['raos', 'rao', 'raos homemade'], 'sauce', 'serving', [
      ['Marinara', ['marinara'], { p: ['raos-marinara'], variants: [['Sensitive Formula', ['sensitive'], {}]], pack: { unit: 'jar', sizes: [['24 oz', 680], ['32 oz', 907], ['15.5 oz', 439]], def: '24 oz' } }],
      ['Arrabbiata', ['arrabbiata', 'arrabiata'], { p: ['raos-arrabbiata'], pack: { unit: 'jar', sizes: [['24 oz', 680]], def: '24 oz' } }],
      ['Tomato Basil', ['tomato basil', 'tomato and basil'], { pack: { unit: 'jar', sizes: [['24 oz', 680]] } }],
      ['Vodka Sauce', ['vodka'], {}],
      ['Roasted Garlic', ['roasted garlic', 'garlic'], {}],
      ['Puttanesca', ['puttanesca'], {}],
      ['Four Cheese', ['four cheese', '4 cheese'], {}],
      ['Alfredo', ['alfredo'], {}],
      ['Roasted Eggplant', ['eggplant'], {}],
      ['Margherita', ['margherita'], {}],
      ['Pizza Sauce', ['pizza sauce', 'pizza'], {}],
      ['Pasta (dry)', ['pasta', ...SHAPES], { cat: 'pasta' }],
    ]),
    B('prego', 'Prego', ['prego'], 'sauce', 'cup', [['Traditional', ['traditional'], {}], ['Marinara', ['marinara'], {}], ['Alfredo', ['alfredo'], {}]]),
    B('ragu', 'Ragu', ['ragu'], 'sauce', 'cup', [['Traditional', ['traditional', 'old world'], {}], ['Classic Alfredo', ['alfredo'], {}]]),
    B('banza', 'Banza', ['banza'], 'pasta', 'serving', [['Chickpea Pasta', ['pasta', ...SHAPES], {}], ['Chickpea Mac & Cheese', ['mac and cheese', 'mac'], {}], ['Chickpea Rice', ['rice'], {}]]),

    /* ── Meat ── */
    B('oscar-mayer', 'Oscar Mayer', ['oscar mayer', 'oscar meyer', 'oscar mayer deli', 'oscar mayer deli fresh'], 'deli', 'serving', [
      ['Deli Fresh Oven Roasted Turkey Breast', ['oven roasted turkey', 'roasted turkey', 'turkey breast', 'turkey'], { p: ['oscar-mayer-turkey'] }],
      ['Deli Fresh Smoked Turkey Breast', ['smoked turkey', 'turkey'], {}],
      ['Deli Fresh Honey Smoked Turkey Breast', ['honey smoked turkey', 'honey turkey', 'turkey'], {}],
      ['Deli Fresh Mesquite Turkey Breast', ['mesquite', 'turkey'], {}],
      ['Deli Fresh Rotisserie Seasoned Chicken Breast', ['rotisserie chicken', 'chicken breast', 'chicken'], {}],
      ['Deli Fresh Honey Ham', ['honey ham', 'ham'], { p: ['oscar-mayer-ham'] }],
      ['Deli Fresh Black Forest Ham', ['black forest ham', 'black forest', 'ham'], {}],
      ['Deli Fresh Smoked Ham', ['smoked ham', 'ham'], {}],
      ['Bologna', ['bologna', 'baloney'], { p: ['oscar-mayer-bologna'], unit: 'slice' }],
      ['Hard Salami', ['salami'], { unit: 'slice' }],
      ['Classic Wieners', ['wiener', 'weiner', 'hot dog', 'hotdog', 'dog'], { p: ['oscar-mayer-wieners'], cat: 'hotdog', unit: 'link' }],
      ['Classic Beef Franks', ['beef frank', 'beef hot dog', 'beef', 'frank', 'hot dog', 'hotdog', 'dog'], { p: ['oscar-mayer-beef-franks'], cat: 'hotdog', unit: 'link' }],
      ['Turkey Franks', ['turkey frank', 'turkey hot dog', 'turkey dog'], { cat: 'hotdog', unit: 'link' }],
      ['Cheese Dogs', ['cheese dog', 'cheese frank'], { cat: 'hotdog', unit: 'link' }],
      ['Center Cut Bacon', ['center cut bacon', 'bacon'], { cat: 'bacon', unit: 'slice' }],
      ['Turkey Bacon', ['turkey bacon'], { cat: 'bacon', unit: 'slice' }],
    ]),
    B('ball-park', 'Ball Park', ['ball park', 'ballpark'], 'hotdog', 'link', [['Beef Franks', ['beef frank', 'beef', 'frank'], {}], ['Classic Franks', ['classic', 'frank'], {}], ['Turkey Franks', ['turkey'], {}], ['Bun Size', ['bun size', 'bun length'], {}], ['Hamburger Patties', ['patty', 'patties', 'burger'], { cat: 'patty', unit: 'patty' }]]),
    B('hebrew-national', 'Hebrew National', ['hebrew national'], 'hotdog', 'link', [['Beef Franks', ['beef frank', 'frank', 'hot dog'], {}], ['Jumbo Beef Franks', ['jumbo'], {}], ['Beef Bun Length', ['bun length'], {}]]),
    B('hillshire', 'Hillshire Farm', ['hillshire farm', 'hillshire'], 'deli', 'serving', [['Ultra Thin Oven Roasted Turkey', ['turkey'], {}], ['Ultra Thin Honey Ham', ['ham'], {}], ['Smoked Sausage', ['sausage', 'smoked sausage', 'kielbasa', 'polska kielbasa'], { cat: 'sausage', unit: 'link' }], ['Turkey Polska Kielbasa', ['turkey kielbasa', 'turkey polska kielbasa', 'turkey sausage', 'turkey smoked sausage'], { cat: 'sausage', unit: 'serving' }]]),
    B('boars-head', "Boar's Head", ['boars head'], 'deli', 'serving', [['Ovengold Roasted Turkey', ['ovengold', 'turkey'], {}], ['Deluxe Ham', ['ham'], {}], ['American Cheese', ['american cheese', 'cheese'], { cat: 'cheese' }]]),
    B('applegate', 'Applegate', ['applegate'], 'deli', 'serving', [['Natural Oven Roasted Turkey', ['turkey'], {}], ['Natural Uncured Ham', ['ham'], {}], ['Organic Beef Hot Dog', ['hot dog', 'hotdog', 'frank'], { cat: 'hotdog', unit: 'link' }], ['Chicken Breakfast Sausage', ['sausage'], { cat: 'sausage', unit: 'link' }]]),
    B('tyson', 'Tyson', ['tyson'], 'chicken', 'serving', [['Grilled & Ready Chicken Breast Strips', ['grilled and ready', 'strips', 'grilled'], {}], ['Chicken Nuggets', ['nugget', 'nuggets'], { unit: 'piece' }], ['Air Fried Chicken', ['air fried'], {}], ['Chicken Breast Tenderloins (raw)', ['tenderloin', 'raw'], {}]]),
    B('perdue', 'Perdue', ['perdue'], 'chicken', 'serving', [['Short Cuts', ['short cuts', 'shortcuts'], {}], ['Chicken Breast Tenders', ['tenders'], {}], ['Chicken Plus', ['chicken plus'], {}]]),
    B('jack-links', "Jack Link's", ['jack links', 'jack link'], 'jerky', 'serving', [['Original Beef Jerky', ['original', 'jerky'], {}], ['Teriyaki Beef Jerky', ['teriyaki'], {}], ['Beef Stick', ['stick'], { unit: 'stick' }]]),
    B('chomps', 'Chomps', ['chomps'], 'jerky', 'stick', [['Original Beef Stick', ['original', 'beef'], {}], ['Turkey Stick', ['turkey'], {}]]),
    B('starkist', 'StarKist', ['starkist', 'star kist'], 'tuna', 'pouch', [['Chunk Light Tuna (can)', ['can', 'chunk light'], { unit: 'can' }], ['Tuna Creations Pouch', ['pouch', 'creations'], {}]]),
    B('bumble-bee', 'Bumble Bee', ['bumble bee'], 'tuna', 'can', [['Chunk Light Tuna', ['chunk light', 'tuna'], {}], ['Solid White Albacore', ['albacore', 'solid white'], {}]]),

    /* ── Spreads & snacks ── */
    B('jif', 'Jif', ['jif'], 'spread', 'serving', [
      ['Creamy Peanut Butter', ['creamy'], { p: ['jif-creamy'] }],
      ['Extra Crunchy Peanut Butter', ['crunchy', 'extra crunchy'], {}],
      ['Natural Peanut Butter', ['natural'], {}],
      ['Reduced Fat Peanut Butter', ['reduced fat'], {}],
      ['No Added Sugar Peanut Butter', ['no added sugar', 'no sugar'], {}],
    ]),
    B('skippy', 'Skippy', ['skippy'], 'spread', 'serving', [['Creamy Peanut Butter', ['creamy'], {}], ['Super Chunk', ['chunk', 'crunchy'], {}], ['Natural', ['natural'], {}]]),
    B('smuckers', "Smucker's", ['smuckers'], 'spread', 'tbsp', [['Strawberry Jam', ['strawberry'], {}], ['Grape Jelly', ['grape'], {}], ['Uncrustables', ['uncrustables', 'uncrustable'], { cat: 'sandwich', unit: 'sandwich' }]]),

    /* ── Frozen meals ── (recognized; labels not bundled yet — Forge asks, then search online or enter the label) */
    B('healthy-choice', 'Healthy Choice', ['healthy choice'], 'meal', 'meal', [['Power Bowls', ['power bowl', 'power bowls', 'bowl'], {}], ['Café Steamers', ['cafe steamers', 'steamers', 'steamer'], {}], ['Simply Steamers', ['simply steamers'], {}]]),
    B('lean-cuisine', 'Lean Cuisine', ['lean cuisine'], 'meal', 'meal', [['Favorites', ['favorites'], {}], ['Protein Kick', ['protein kick'], {}], ['Bowls', ['bowl', 'bowls'], {}]]),
    B('amys', "Amy's", ['amys', 'amys kitchen'], 'meal', 'meal', [['Bowls', ['bowl', 'bowls'], {}], ['Burritos', ['burrito', 'burritos'], { unit: 'burrito' }], ['Frozen Pizza', ['pizza'], { unit: 'slice' }], ['Soups', ['soup'], { unit: 'cup' }]]),
    B('stouffers', "Stouffer's", ['stouffers', 'stouffer'], 'meal', 'meal', [['Lasagna with Meat & Sauce', ['lasagna', 'lasagne'], {}], ['Macaroni & Cheese', ['mac and cheese', 'macaroni and cheese', 'mac'], {}]]),

    /* ── Condiments ── */
    B('heinz', 'Heinz', ['heinz'], 'condiment', 'tbsp', [['Tomato Ketchup', ['ketchup', 'catsup'], {}], ['No Sugar Added Ketchup', ['no sugar added', 'no sugar'], {}], ['Yellow Mustard', ['mustard'], { unit: 'tsp' }]]),
    B('hellmanns', "Hellmann's", ['hellmanns', 'hellman', 'hellmans', 'best foods'], 'condiment', 'tbsp', [['Real Mayonnaise', ['real', 'mayo', 'mayonnaise'], {}], ['Light Mayonnaise', ['light'], {}]]),
    B('frenchs', "French's", ['frenchs'], 'condiment', 'tsp', [['Classic Yellow Mustard', ['mustard', 'yellow'], {}], ['Crispy Fried Onions', ['crispy onions', 'fried onions'], { unit: 'tbsp' }]]),
    B('franks-redhot', "Frank's RedHot", ['franks redhot', 'franks red hot', 'frank s redhot'], 'condiment', 'tsp', [['Original Hot Sauce', ['original', 'hot sauce'], {}], ['Buffalo Wings Sauce', ['buffalo', 'wings sauce'], { unit: 'tbsp' }]]),

    /* ── Snacks & cereal ── */
    B('lays', "Lay's", ['lays'], 'chips', 'bag', [['Classic Potato Chips', ['classic', 'potato chips', 'chips'], {}], ['Baked', ['baked'], {}]]),
    B('goldfish', 'Goldfish', ['goldfish crackers', 'goldfish'], 'snack', 'serving', [['Cheddar', ['cheddar'], {}], ['Flavor Blasted', ['flavor blasted', 'blasted'], {}]]),
    B('cheerios', 'Cheerios', ['cheerios'], 'cereal', 'cup', [['Original', ['original', 'plain'], {}], ['Honey Nut', ['honey nut'], {}], ['Protein', ['protein'], {}]]),
  ];

  /* ───────── Products → lines ─────────
   * A product in js/products.js can name its line with `cl: 'brand:line[:variant]'` (ids are slugs of the names)
   * instead of being listed here. A line's first product is its default when you don't name a flavor (unless the
   * line's flavors have materially different labels — `flavorMatters` — then Forge asks). */
  WT.catalogLink = function () {
    (WT.PRODUCTS || []).forEach((x) => {
      if (!x.cl) return;
      const [bid, lid, vid] = x.cl.split(':');
      const b = WT.BRAND_CATALOG.find((bb) => bb.id === bid);
      const l = b && b.lines.find((ll) => ll.id === lid);
      if (!l) throw new Error(`Product ${x.id}: no catalog line ${x.cl}`);
      if (!vid) return l.p.includes(x.id) || l.p.push(x.id);
      const v = l.variants.find((vv) => slug(vv[0]) === vid);
      if (!v) throw new Error(`Product ${x.id}: no catalog variant ${x.cl}`);
      if (!v[2]) v[2] = {};
      v[2].p = v[2].p || [];
      if (!v[2].p.includes(x.id)) v[2].p.push(x.id);
    });
  };
  WT.catalogLink();

  /* ───────── Index ───────── */
  WT.catalogBrand = (id) => WT.BRAND_CATALOG.find((b) => b.id === id);
  /** The catalog brand whose name matches a product's brand ("fairlife" ↔ "fairlife", "Rao's" ↔ "Rao's"). */
  WT.catalogFor = function (brandName) {
    const k = String(brandName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return WT.BRAND_CATALOG.find((b) => b.name.toLowerCase().replace(/[^a-z0-9]/g, '') === k || b.a.some((a) => a.replace(/[^a-z0-9]/g, '') === k)) || null;
  };
  // Every catalog brand is also a recognized brand name for notes and search
  WT.FOOD_BRANDS = WT.FOOD_BRANDS || {};
  WT.BRAND_CATALOG.forEach((b) => b.a.forEach((a) => (WT.FOOD_BRANDS[a] = WT.FOOD_BRANDS[a] || b.name)));
})();
