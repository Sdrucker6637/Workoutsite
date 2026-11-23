/* Ingredient nutrition database + offline estimator for the meal planner.
 *
 * Every built-in ingredient is a data object: category, recipe role (`kind`), a familiar default serving
 * (amount, unit, grams, and whether that weight is raw / cooked / dry / as sold), and nutrition stored PER 100 g
 * so any quantity can be calculated. Values are rounded typical (USDA FoodData Central–style) figures for the
 * generic food — not label data. Anything brand-specific comes only from js/products.js, never invented.
 *
 * WT.ING.estimate(text, catHint) gives any ingredient name usable nutrition, fully offline:
 *   1. exact match on a name or alias
 *   2. a branded product already in the local product table (verified / estimated as recorded there)
 *   3. the closest generic ingredient contained in the name ("Butterball turkey kielbasa" → turkey kielbasa)
 *   4. keyword classes ("halibut" → lean white fish, "farro" → whole grain…)
 *   5. a deliberately rough category default ("other protein", "vegetable") — never zero
 */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const ING = (WT.ING = WT.ING || {});

  ING.CATS = { protein: 'Proteins', carb: 'Carbohydrates', veg: 'Vegetables', fruit: 'Fruits', dairy: 'Dairy', other: 'Other ingredients' };
  ING.STATES = { raw: 'raw', cooked: 'cooked', dry: 'dry, uncooked', sold: 'as sold' };

  /** Unit words: singular → plural, and whether the unit is a weight / volume / count. */
  const UNITS = {
    oz: { pl: 'oz', type: 'weight' }, g: { pl: 'g', type: 'weight' },
    cup: { pl: 'cups', type: 'vol' }, tbsp: { pl: 'tbsp', type: 'vol' }, tsp: { pl: 'tsp', type: 'vol' },
  };
  ING.unitInfo = (u) => {
    const base = String(u || '').split(' ')[0];
    return UNITS[base] || { pl: null, type: 'count' };
  };

  /**
   * D(id, name, cat, kind, [n, unit, grams, state], [cal, protein, carbs, fat, fiber, sugar] per 100 g, extra)
   * extra: a aliases · tags diet flags · meal portion (in servings) for one person as the main item
   *        note assumption shown with the estimate · label short descriptor · def in the default kitchen
   *        precooked (sausages) · plural unit override · pantry metadata (common, alt, use)
   */
  const D = (id, name, cat, kind, s, v, x) =>
    Object.assign({ id, name, cat, kind, serving: { n: s[0], unit: s[1], g: s[2], state: s[3] || 'raw' }, per100: { cal: v[0], p: v[1], c: v[2], f: v[3], fiber: v[4] == null ? null : v[4], sugar: v[5] == null ? null : v[5] }, a: [], tags: [] }, x || {});

  ING.DB = [
    /* ── Poultry ── */
    D('chicken-breast', 'Chicken breast', 'protein', 'poultry', [1, 'breast', 170], [120, 22.5, 0, 2.6, 0, 0], { a: ['chicken breasts', 'boneless chicken breast', 'skinless chicken breast', 'chicken'], tags: ['meat', 'poultry'], def: 1, label: 'boneless, skinless · ≈ 6 oz raw', note: 'A "breast" is taken as 6 oz raw; many store breasts are 8–10 oz — edit the serving if yours are bigger.' }),
    D('chicken-thigh', 'Chicken thighs', 'protein', 'poultry', [1, 'thigh', 113], [121, 19.7, 0, 4.1, 0, 0], { a: ['chicken thigh', 'boneless chicken thighs', 'boneless skinless chicken thighs'], tags: ['meat', 'poultry'], def: 1, meal: 1.5, label: 'boneless, skinless · ≈ 4 oz raw each' }),
    D('chicken-tenders', 'Chicken tenders', 'protein', 'poultry', [4, 'oz', 113], [120, 22.5, 0, 2.6, 0, 0], { a: ['chicken tenderloins', 'chicken tenderloin', 'chicken strips raw'], tags: ['meat', 'poultry'], meal: 1.4 }),
    D('cooked-chicken', 'Cooked chicken', 'protein', 'cooked-poultry', [1, 'cup chopped', 140, 'cooked'], [165, 31, 0, 3.6, 0, 0], { a: ['rotisserie chicken', 'shredded chicken', 'grilled chicken', 'cooked chicken breast', 'leftover chicken', 'canned chicken', 'chicken breast cooked'], tags: ['meat', 'poultry'], meal: 0.85, label: 'skinless meat, cooked' }),
    D('chicken-wings', 'Chicken wings', 'protein', 'poultry', [4, 'oz', 113], [191, 17.5, 0, 12.8, 0, 0], { a: ['chicken wing', 'wings', 'drumettes'], tags: ['meat', 'poultry'], meal: 2, label: 'with skin, raw' }),
    D('chicken-drumsticks', 'Chicken drumsticks', 'protein', 'poultry', [1, 'drumstick', 100], [161, 19.3, 0, 8.7, 0, 0], { a: ['drumstick', 'chicken legs', 'chicken leg'], tags: ['meat', 'poultry'], meal: 2, label: 'raw, edible portion ≈ 3.5 oz' }),
    D('ground-chicken', 'Ground chicken', 'protein', 'ground', [4, 'oz', 113], [143, 17.4, 0, 8.1, 0, 0], { a: ['chicken mince'], tags: ['meat', 'poultry'], def: 1, meal: 1.25 }),
    D('ground-turkey', 'Ground turkey', 'protein', 'ground', [4, 'oz', 113], [150, 18.7, 0, 8.3, 0, 0], { a: ['turkey mince', 'lean ground turkey', '93/7 ground turkey'], tags: ['meat', 'poultry'], def: 1, meal: 1.25, note: 'Assumes 93% lean.' }),
    D('turkey-breast', 'Turkey breast', 'protein', 'poultry', [4, 'oz', 113], [111, 24.6, 0, 0.7, 0, 0], { a: ['turkey cutlets', 'turkey tenderloin', 'turkey'], tags: ['meat', 'poultry'], meal: 1.4 }),
    D('turkey-kielbasa', 'Turkey kielbasa', 'protein', 'sausage', [2, 'oz', 56, 'sold'], [152, 14.3, 5.4, 8, 0, 3.6], { a: ['turkey polska kielbasa', 'turkey smoked sausage', 'turkey sausage'], tags: ['meat', 'poultry'], precooked: 1, meal: 2, label: 'smoked, precooked', note: 'Typical turkey kielbasa (smoked, precooked). Brands vary — about 80–100 calories and 7–9 g protein per 2 oz.' }),
    D('chicken-sausage', 'Chicken sausage', 'protein', 'sausage', [1, 'link', 85, 'sold'], [165, 15.3, 3.5, 9.4, 0, 2], { a: ['chicken apple sausage', 'chicken sausages', 'precooked chicken sausage'], tags: ['meat', 'poultry'], precooked: 1, meal: 1.5, label: 'precooked link' }),
    D('turkey-bacon', 'Turkey bacon', 'protein', 'bacon', [1, 'slice', 14, 'cooked'], [214, 16.4, 2.1, 15, 0, 1], { a: ['turkey bacon slices'], tags: ['meat', 'poultry'], meal: 2 }),
    D('deli-turkey', 'Deli turkey', 'protein', 'deli', [2, 'oz', 56, 'sold'], [107, 18, 3.5, 1.8, 0, 2], { a: ['sliced turkey', 'turkey deli meat', 'lunch meat', 'turkey lunch meat', 'oven roasted turkey'], tags: ['meat', 'poultry'], meal: 1.5 }),
    /* ── Beef, pork, lamb ── */
    D('ground-beef', 'Ground beef', 'protein', 'ground', [4, 'oz', 113], [176, 20, 0, 10, 0, 0], { a: ['lean ground beef', '90/10 ground beef', 'beef mince', 'hamburger meat'], tags: ['meat'], def: 1, meal: 1.25, note: 'Assumes 90% lean (90/10). 80/20 has about 45% more calories — add "80/20 ground beef" if that’s what you buy.' }),
    D('ground-beef-80', '80/20 ground beef', 'protein', 'ground', [4, 'oz', 113], [254, 17.2, 0, 20, 0, 0], { a: ['80/20 ground beef', 'ground chuck', '80% lean ground beef', '85/15 ground beef'], tags: ['meat'], meal: 1.25, note: '80% lean.' }),
    D('ground-beef-93', '93/7 ground beef', 'protein', 'ground', [4, 'oz', 113], [152, 21, 0, 7, 0, 0], { a: ['93/7 ground beef', 'extra lean ground beef', '93% lean ground beef', '96/4 ground beef'], tags: ['meat'], meal: 1.25 }),
    D('steak', 'Sirloin steak', 'protein', 'beef', [6, 'oz', 170], [150, 22, 0, 6.5, 0, 0], { a: ['steak', 'sirloin', 'top sirloin', 'flank steak', 'skirt steak', 'strip steak', 'new york strip', 'flat iron steak', 'steak tips', 'beef'], tags: ['meat'], label: 'lean, trimmed' }),
    D('ribeye', 'Ribeye steak', 'protein', 'beef', [6, 'oz', 170], [291, 19, 0, 23, 0, 0], { a: ['ribeye', 'rib eye', 'rib-eye'], tags: ['meat'] }),
    D('ground-pork', 'Ground pork', 'protein', 'ground', [4, 'oz', 113], [263, 16.9, 0, 21.2, 0, 0], { a: ['pork mince'], tags: ['meat', 'pork'], meal: 1.25 }),
    D('pork-chop', 'Pork chops', 'protein', 'pork', [1, 'chop', 142], [136, 21.4, 0, 5, 0, 0], { a: ['pork chop', 'boneless pork chops', 'pork loin chops', 'pork loin'], tags: ['meat', 'pork'], label: 'boneless loin, ≈ 5 oz raw' }),
    D('pork-tenderloin', 'Pork tenderloin', 'protein', 'pork', [4, 'oz', 113], [120, 21, 0, 3.5, 0, 0], { a: ['tenderloin'], tags: ['meat', 'pork'], meal: 1.4 }),
    D('kielbasa', 'Kielbasa', 'protein', 'sausage', [2, 'oz', 56, 'sold'], [321, 12.5, 3.6, 28.5, 0, 2], { a: ['polska kielbasa', 'smoked sausage', 'andouille', 'andouille sausage'], tags: ['meat', 'pork'], precooked: 1, meal: 1.75, label: 'pork/beef, smoked, precooked' }),
    D('italian-sausage', 'Italian sausage', 'protein', 'sausage', [1, 'link', 100], [290, 15, 2, 25, 0, 1], { a: ['italian sausages', 'pork sausage', 'sweet italian sausage', 'hot italian sausage', 'bratwurst', 'brats'], tags: ['meat', 'pork'], meal: 1, label: 'raw pork link' }),
    D('chorizo', 'Chorizo', 'protein', 'sausage', [2, 'oz', 56], [455, 24, 2, 38, 0, 0], { a: ['mexican chorizo'], tags: ['meat', 'pork'], meal: 1, label: 'raw, Mexican-style' }),
    D('bacon', 'Bacon', 'protein', 'bacon', [1, 'slice', 8, 'cooked'], [541, 37, 1.4, 42, 0, 0], { a: ['bacon strips', 'bacon slices'], tags: ['meat', 'pork'], meal: 2 }),
    D('ham', 'Ham', 'protein', 'deli', [2, 'oz', 56, 'sold'], [120, 18, 2, 4, 0, 1], { a: ['deli ham', 'diced ham', 'ham steak', 'sliced ham'], tags: ['meat', 'pork'], meal: 1.5 }),
    D('ground-lamb', 'Ground lamb', 'protein', 'ground', [4, 'oz', 113], [282, 16.6, 0, 23.4, 0, 0], { a: ['lamb', 'lamb mince'], tags: ['meat'], meal: 1.25 }),
    /* ── Seafood ── */
    D('shrimp', 'Shrimp', 'protein', 'shrimp', [4, 'oz', 113], [85, 20, 0, 0.5, 0, 0], { a: ['prawns', 'peeled shrimp', 'raw shrimp', 'jumbo shrimp'], tags: ['shellfish'], def: 1, meal: 1.25, label: 'peeled, raw' }),
    D('salmon', 'Salmon', 'protein', 'fish-fatty', [1, 'fillet', 142], [208, 20.4, 0, 13.4, 0, 0], { a: ['salmon fillet', 'salmon fillets', 'atlantic salmon'], tags: ['fish'], def: 1, label: '≈ 5 oz raw fillet', note: 'Farmed Atlantic salmon. Wild salmon has about a third fewer calories.' }),
    D('wild-salmon', 'Wild salmon', 'protein', 'fish-fatty', [1, 'fillet', 142], [142, 19.8, 0, 6.3, 0, 0], { a: ['sockeye salmon', 'coho salmon', 'wild caught salmon'], tags: ['fish'] }),
    D('cod', 'Cod', 'protein', 'fish-lean', [1, 'fillet', 170], [82, 17.8, 0, 0.7, 0, 0], { a: ['cod fillet', 'white fish', 'whitefish', 'haddock', 'pollock', 'halibut', 'flounder', 'sole', 'hake'], tags: ['fish'], label: 'lean white fish, ≈ 6 oz raw fillet' }),
    D('tilapia', 'Tilapia', 'protein', 'fish-lean', [1, 'fillet', 142], [96, 20.1, 0, 1.7, 0, 0], { a: ['tilapia fillet', 'catfish', 'swai', 'mahi mahi', 'mahi'], tags: ['fish'] }),
    D('tuna', 'Tuna', 'protein', 'canned-fish', [1, 'can', 113, 'sold'], [100, 22, 0, 0.8, 0, 0], { a: ['canned tuna', 'tuna in water', 'chunk light tuna', 'albacore tuna'], tags: ['fish'], def: 1, label: '5 oz can in water, drained (≈ 4 oz)' }),
    D('tuna-steak', 'Tuna steak', 'protein', 'fish-lean', [6, 'oz', 170], [109, 24.4, 0, 0.5, 0, 0], { a: ['ahi tuna', 'yellowfin tuna', 'ahi'], tags: ['fish'] }),
    D('canned-salmon', 'Canned salmon', 'protein', 'canned-fish', [1, 'can', 113, 'sold'], [167, 23, 0, 7.5, 0, 0], { a: ['salmon pouch'], tags: ['fish'], label: '5 oz can, drained' }),
    D('scallops', 'Scallops', 'protein', 'shellfish', [4, 'oz', 113], [69, 12, 3.2, 0.5, 0, 0], { a: ['sea scallops', 'bay scallops', 'crab', 'crab meat', 'lobster', 'mussels', 'clams', 'squid', 'calamari'], tags: ['shellfish'], meal: 1.5 }),
    /* ── Eggs & plant proteins ── */
    D('eggs', 'Eggs', 'protein', 'egg', [1, 'large egg', 50], [143, 12.6, 0.7, 9.5, 0, 0.4], { a: ['egg', 'large eggs', 'whole eggs'], tags: ['egg'], def: 1, meal: 3 }),
    D('egg-whites', 'Egg whites', 'protein', 'egg', [0.5, 'cup', 122], [52, 10.9, 0.7, 0.2, 0, 0.7], { a: ['liquid egg whites', 'egg white'], tags: ['egg'], meal: 1 }),
    D('tofu', 'Tofu', 'protein', 'tofu', [0.5, 'block', 198, 'sold'], [110, 12, 2.5, 6, 1, 0.5], { a: ['extra firm tofu', 'firm tofu', 'extra-firm tofu'], tags: ['soy'], def: 1, label: 'extra-firm, ½ of a 14 oz block' }),
    D('tempeh', 'Tempeh', 'protein', 'tofu', [4, 'oz', 113, 'sold'], [192, 20.3, 7.6, 10.8, 5, 0], { tags: ['soy'] }),
    D('seitan', 'Seitan', 'protein', 'tofu', [3, 'oz', 85, 'sold'], [141, 25, 6, 2, 1, 0], { tags: ['gluten'] }),
    D('black-beans', 'Black beans', 'protein', 'legume', [0.5, 'cup', 130, 'cooked'], [85, 5.4, 15.4, 0.4, 5.4, 0.3], { a: ['canned black beans', 'black bean', 'pinto beans', 'kidney beans', 'beans', 'refried beans'], meal: 2, label: 'canned, drained' }),
    D('chickpeas', 'Chickpeas', 'protein', 'legume', [0.5, 'cup', 120, 'cooked'], [100, 5, 16.7, 1.7, 4.2, 2.9], { a: ['garbanzo beans', 'canned chickpeas', 'chickpea', 'white beans', 'cannellini beans', 'navy beans', 'great northern beans'], meal: 2, label: 'canned, drained' }),
    D('lentils', 'Lentils', 'protein', 'legume', [0.5, 'cup', 99, 'cooked'], [116, 9, 20, 0.4, 7.9, 1.8], { a: ['red lentils', 'green lentils', 'brown lentils', 'lentil'], meal: 2 }),
    D('edamame', 'Edamame', 'protein', 'legume', [0.5, 'cup', 78, 'cooked'], [121, 11.9, 8.9, 5.2, 5.2, 2.2], { a: ['shelled edamame', 'soybeans'], tags: ['soy'], meal: 2 }),
    /* ── Dairy ── */
    D('greek-yogurt', 'Greek yogurt', 'dairy', 'yogurt', [0.75, 'cup', 170], [59, 10.3, 3.6, 0.4, 0, 3.2], { a: ['plain greek yogurt', 'nonfat greek yogurt', 'skyr', 'greek yoghurt'], tags: ['dairy'], def: 1, label: 'plain, nonfat' }),
    D('yogurt', 'Yogurt', 'dairy', 'yogurt', [0.75, 'cup', 184], [63, 5.3, 7, 1.6, 0, 7], { a: ['plain yogurt', 'regular yogurt'], tags: ['dairy'], label: 'plain, low-fat' }),
    D('cottage-cheese', 'Cottage cheese', 'dairy', 'cottage', [0.5, 'cup', 113], [81, 10.5, 4.8, 2.3, 0, 4], { a: ['low fat cottage cheese', '2% cottage cheese'], tags: ['dairy'], def: 1, label: '2% milkfat' }),
    D('cheddar', 'Cheddar', 'dairy', 'cheese-melt', [1, 'oz', 28], [409, 24.9, 1.3, 33.1, 0, 0.3], { a: ['cheddar cheese', 'shredded cheese', 'shredded cheddar', 'cheese', 'colby jack', 'american cheese'], tags: ['dairy'], def: 1, label: '¼ cup shredded ≈ 1 oz' }),
    D('mozzarella', 'Mozzarella', 'dairy', 'cheese-melt', [1, 'oz', 28], [254, 24.3, 2.8, 15.9, 0, 1], { a: ['part skim mozzarella', 'shredded mozzarella', 'string cheese', 'provolone', 'fresh mozzarella'], tags: ['dairy'], label: 'part-skim' }),
    D('pepper-jack', 'Pepper jack', 'dairy', 'cheese-melt', [1, 'oz', 28], [373, 24.5, 0.7, 30.3, 0, 0.5], { a: ['monterey jack', 'jack cheese', 'swiss cheese', 'swiss'], tags: ['dairy'] }),
    D('feta', 'Feta', 'dairy', 'cheese-crumble', [1, 'oz', 28], [264, 14.2, 4.1, 21.3, 0, 4.1], { a: ['feta cheese', 'crumbled feta', 'goat cheese', 'cotija', 'queso fresco'], tags: ['dairy'], def: 1 }),
    D('parmesan', 'Parmesan', 'dairy', 'cheese-hard', [2, 'tbsp', 10], [392, 35.8, 3.2, 25.8, 0, 0.8], { a: ['parmigiano', 'grated parmesan', 'parmesan cheese', 'pecorino'], tags: ['dairy'], def: 1, label: 'grated' }),
    D('cream-cheese', 'Cream cheese', 'dairy', 'cheese-soft', [2, 'tbsp', 30], [201, 7.9, 8.1, 15.3, 0, 5], { a: ['light cream cheese', 'neufchatel', 'ricotta'], tags: ['dairy'], label: 'light' }),
    D('plant-milk', 'Plant milk', 'dairy', 'milk', [1, 'cup', 240], [40, 1, 5, 1.6, 0.5, 2], { a: ['oat milk', 'almond milk', 'soy milk', 'cashew milk', 'unsweetened almond milk'], label: 'unsweetened', note: 'Unsweetened oat/almond milk average. Soy milk has more protein (≈ 7 g per cup).' }),
    D('milk', 'Milk', 'dairy', 'milk', [1, 'cup', 244], [50, 3.3, 4.8, 2, 0, 5], { a: ['2% milk', 'skim milk', 'whole milk', 'fairlife milk'], tags: ['dairy'], label: '2%' }),
    /* ── Carbohydrates ── */
    D('rice', 'Rice', 'carb', 'rice', [1, 'cup cooked', 158, 'cooked'], [130, 2.7, 28.2, 0.3, 0.4, 0], { a: ['white rice', 'jasmine rice', 'basmati rice', 'cooked rice', 'steamed rice', 'leftover rice', 'minute rice'], def: 1 }),
    D('brown-rice', 'Brown rice', 'carb', 'rice', [1, 'cup cooked', 195, 'cooked'], [123, 2.7, 25.6, 1, 1.6, 0.2], { a: ['cooked brown rice'] }),
    D('rice-dry', 'Rice (dry)', 'carb', 'rice', [0.25, 'cup dry', 46, 'dry'], [365, 7.1, 80, 0.7, 1.3, 0.1], { a: ['dry rice', 'uncooked rice', 'raw rice', 'rice uncooked'], label: '¼ cup dry ≈ ¾ cup cooked', meal: 1.33 }),
    D('quinoa', 'Quinoa', 'carb', 'grain', [1, 'cup cooked', 185, 'cooked'], [120, 4.4, 21.3, 1.9, 2.8, 0.9], { a: ['cooked quinoa'], def: 1, meal: 0.75 }),
    D('couscous', 'Couscous', 'carb', 'grain', [1, 'cup cooked', 157, 'cooked'], [112, 3.8, 23.2, 0.2, 1.4, 0.1], { a: ['pearl couscous', 'farro', 'bulgur', 'barley'], tags: ['gluten'], meal: 0.85 }),
    D('oats', 'Oats', 'carb', 'oats', [0.5, 'cup dry', 40, 'dry'], [379, 13.2, 67.7, 6.5, 10.1, 1], { a: ['rolled oats', 'oatmeal', 'old fashioned oats', 'quick oats', 'overnight oats'], meal: 1 }),
    D('pasta', 'Pasta', 'carb', 'pasta', [2, 'oz dry', 56, 'dry'], [371, 13, 74.7, 1.5, 3.2, 2.7], { a: ['spaghetti', 'penne', 'rigatoni', 'fusilli', 'rotini', 'linguine', 'fettuccine', 'macaroni', 'orzo', 'bowtie pasta', 'farfalle', 'noodles', 'whole wheat pasta'], tags: ['gluten'], def: 1 }),
    D('protein-pasta', 'Protein pasta', 'carb', 'pasta', [2, 'oz dry', 56, 'dry'], [339, 17.9, 67.9, 2.7, 7, 3], { a: ['high protein pasta'], tags: ['gluten'], def: 1, note: 'Typical wheat-and-legume protein pasta (≈ 10 g protein per 2 oz).' }),
    D('chickpea-pasta', 'Chickpea pasta', 'carb', 'pasta', [2, 'oz dry', 56, 'dry'], [339, 21.4, 57, 6.2, 10.7, 4], { a: ['banza', 'lentil pasta', 'red lentil pasta', 'bean pasta'], note: 'Typical chickpea/lentil pasta.' }),
    D('egg-noodles', 'Egg noodles', 'carb', 'noodle', [2, 'oz dry', 56, 'dry'], [384, 14.2, 71.3, 4.4, 3.3, 2], { a: ['egg noodle', 'lo mein noodles', 'ramen noodles', 'ramen', 'udon', 'udon noodles', 'chow mein noodles'], tags: ['gluten', 'egg'] }),
    D('rice-noodles', 'Rice noodles', 'carb', 'noodle', [2, 'oz dry', 56, 'dry'], [364, 6, 80, 0.6, 1.6, 0], { a: ['rice vermicelli', 'pad thai noodles', 'vermicelli', 'glass noodles'] }),
    D('soba', 'Soba noodles', 'carb', 'noodle', [2, 'oz dry', 56, 'dry'], [336, 14.4, 74.6, 0.7, 4, 0], { a: ['soba', 'buckwheat noodles'], tags: ['gluten'] }),
    D('potato', 'Potatoes', 'carb', 'potato', [1, 'medium potato', 213], [77, 2, 17.5, 0.1, 2.2, 0.8], { a: ['potato', 'russet potatoes', 'russet potato', 'yellow potatoes', 'yukon gold potatoes', 'red potatoes', 'baby potatoes', 'gold potatoes', 'white potatoes'], def: 1, one: 'potato' }),
    D('sweet-potato', 'Sweet potatoes', 'carb', 'potato', [1, 'medium sweet potato', 130], [86, 1.6, 20.1, 0.1, 3, 4.2], { a: ['sweet potato', 'yams', 'yam'], def: 1, one: 'sweet potato', plural: 'medium sweet potatoes' }),
    D('bread', 'Bread', 'carb', 'bread', [1, 'slice', 32], [252, 12.4, 42.7, 3.5, 6, 4.4], { a: ['whole wheat bread', 'whole grain bread', 'sourdough', 'white bread', 'sandwich bread'], tags: ['gluten'], def: 1, meal: 2, label: 'whole-grain' }),
    D('tortilla', 'Tortillas', 'carb', 'tortilla', [1, 'tortilla', 45], [312, 8.2, 50.4, 8, 3.5, 2], { a: ['flour tortillas', 'flour tortilla', 'tortilla', 'wraps', 'burrito tortillas'], tags: ['gluten'], def: 1, meal: 2, label: '8-inch flour', one: 'tortilla' }),
    D('corn-tortilla', 'Corn tortillas', 'carb', 'tortilla', [1, 'tortilla', 26], [218, 5.7, 44.6, 2.9, 6.3, 0.9], { a: ['corn tortilla', 'street taco tortillas'], tags: ['corn'], meal: 3, label: '6-inch', one: 'corn tortilla' }),
    D('low-carb-tortilla', 'Low-carb tortillas', 'carb', 'tortilla', [1, 'tortilla', 45], [156, 11, 42, 6.7, 29, 1], { a: ['carb balance tortillas', 'high fiber tortillas', 'keto tortillas', 'low carb wraps'], tags: ['gluten'], meal: 2, note: 'Typical high-fiber low-carb tortilla (≈ 70 cal, 5 g protein each). Brands vary a lot.' }),
    D('pita', 'Pita', 'carb', 'flatbread', [1, 'pita', 64], [266, 9.8, 55, 2.6, 7, 1], { a: ['pita bread', 'whole wheat pita', 'naan', 'flatbread', 'lavash'], tags: ['gluten'], meal: 1 }),
    D('bun', 'Burger buns', 'carb', 'bread', [1, 'bun', 52], [279, 9.5, 49.4, 4.3, 2.5, 6], { a: ['hamburger buns', 'buns', 'bun', 'hoagie rolls', 'rolls', 'brioche buns'], tags: ['gluten'], meal: 1 }),
    D('english-muffin', 'English muffins', 'carb', 'bread', [1, 'muffin', 66], [203, 8.8, 40.4, 2.1, 6.7, 5], { a: ['english muffin', 'bagel thins'], tags: ['gluten'], meal: 1 }),
    D('bagel', 'Bagels', 'carb', 'bread', [1, 'bagel', 105], [257, 10, 50.5, 1.6, 2.2, 5], { a: ['bagel'], tags: ['gluten'], meal: 1 }),
    /* ── Vegetables ── */
    D('spinach', 'Spinach', 'veg', 'leafy', [2, 'cups', 60], [23, 2.9, 3.6, 0.4, 2.2, 0.4], { a: ['baby spinach', 'fresh spinach'], def: 1 }),
    D('kale', 'Kale', 'veg', 'greens', [2, 'cups chopped', 42], [35, 2.9, 4.4, 1.5, 4.1, 1], { a: ['lacinato kale', 'swiss chard', 'chard', 'collard greens', 'collards'] }),
    D('arugula', 'Arugula', 'veg', 'leafy', [2, 'cups', 40], [25, 2.6, 3.7, 0.7, 1.6, 2], { a: ['rocket', 'mixed greens', 'spring mix', 'salad greens'] }),
    D('lettuce', 'Romaine lettuce', 'veg', 'lettuce', [2, 'cups shredded', 94], [17, 1.2, 3.3, 0.3, 2.1, 1.2], { a: ['romaine', 'lettuce', 'iceberg lettuce', 'butter lettuce', 'little gem'] }),
    D('cabbage', 'Cabbage', 'veg', 'greens', [1, 'cup shredded', 70], [25, 1.3, 5.8, 0.1, 2.5, 3.2], { a: ['green cabbage', 'red cabbage', 'napa cabbage', 'coleslaw mix', 'slaw mix'] }),
    D('bok-choy', 'Bok choy', 'veg', 'greens', [2, 'cups chopped', 140], [13, 1.5, 2.2, 0.2, 1, 1.2], { a: ['baby bok choy', 'pak choi', 'bok choi'], def: 1, label: '≈ 2 baby heads' }),
    D('broccoli', 'Broccoli', 'veg', 'crucifer', [1, 'cup florets', 91], [34, 2.8, 6.6, 0.4, 2.6, 1.7], { a: ['broccoli florets', 'broccolini'], def: 1 }),
    D('cauliflower', 'Cauliflower', 'veg', 'crucifer', [1, 'cup florets', 107], [25, 1.9, 5, 0.3, 2, 1.9], { a: ['cauliflower florets', 'riced cauliflower', 'cauliflower rice'] }),
    D('brussels', 'Brussels sprouts', 'veg', 'crucifer', [1, 'cup', 88], [43, 3.4, 9, 0.3, 3.8, 2.2], { a: ['brussel sprouts', 'brussels sprout'] }),
    D('bell-pepper', 'Bell peppers', 'veg', 'pepper', [1, 'pepper', 119], [31, 1, 6, 0.3, 2.1, 4.2], { a: ['bell pepper', 'red pepper', 'green pepper', 'red bell pepper', 'peppers', 'mini peppers'], def: 1 }),
    D('onion', 'Onions', 'veg', 'allium', [1, 'onion', 110], [40, 1.1, 9.3, 0.1, 1.7, 4.2], { a: ['onion', 'yellow onion', 'red onion', 'white onion', 'sweet onion'], def: 1, label: 'medium' }),
    D('green-onion', 'Green onions', 'veg', 'scallion', [2, 'green onion', 30], [32, 1.8, 7.3, 0.2, 2.6, 2.3], { a: ['scallions', 'scallion', 'green onion', 'spring onions', 'chives'] }),
    D('shallot', 'Shallots', 'veg', 'allium', [1, 'shallot', 40], [72, 2.5, 16.8, 0.1, 3.2, 7.9], { a: ['shallot', 'leek', 'leeks'] }),
    D('garlic', 'Garlic', 'veg', 'garlic', [1, 'clove', 3], [149, 6.4, 33, 0.5, 2.1, 1], { a: ['garlic cloves', 'fresh garlic', 'minced garlic'], def: 1 }),
    D('ginger', 'Fresh ginger', 'veg', 'ginger', [1, 'tbsp grated', 6], [80, 1.8, 17.8, 0.8, 2, 1.7], { a: ['ginger', 'ginger root'] }),
    D('mushroom', 'Mushrooms', 'veg', 'mushroom', [1, 'cup sliced', 70], [22, 3.1, 3.3, 0.3, 1, 2], { a: ['mushroom', 'white mushrooms', 'cremini mushrooms', 'baby bella mushrooms', 'portobello', 'shiitake'], def: 1 }),
    D('tomato', 'Tomatoes', 'veg', 'tomato', [1, 'medium tomato', 123], [18, 0.9, 3.9, 0.2, 1.2, 2.6], { a: ['tomato', 'roma tomatoes', 'cherry tomatoes', 'grape tomatoes'], def: 1 }),
    D('canned-tomatoes', 'Canned tomatoes', 'veg', 'tomato-canned', [0.5, 'cup', 120, 'sold'], [16, 0.8, 3.5, 0.1, 1, 2.4], { a: ['diced tomatoes', 'crushed tomatoes', 'canned diced tomatoes', 'tomato sauce', 'fire roasted tomatoes'] }),
    D('zucchini', 'Zucchini', 'veg', 'squash', [1, 'medium zucchini', 196], [17, 1.2, 3.1, 0.3, 1, 2.5], { a: ['courgette', 'yellow squash', 'summer squash'], def: 1 }),
    D('eggplant', 'Eggplant', 'veg', 'squash', [1, 'cup cubed', 82], [25, 1, 5.9, 0.2, 3, 3.5], { a: ['aubergine'] }),
    D('butternut', 'Butternut squash', 'veg', 'starchy-veg', [1, 'cup cubed', 140], [45, 1, 11.7, 0.1, 2, 2.2], { a: ['butternut', 'acorn squash', 'pumpkin', 'squash'] }),
    D('asparagus', 'Asparagus', 'veg', 'stalk', [8, 'spears', 120], [20, 2.2, 3.9, 0.1, 2.1, 1.9], { def: 1 }),
    D('green-beans', 'Green beans', 'veg', 'stalk', [1, 'cup', 100], [31, 1.8, 7, 0.2, 2.7, 3.3], { a: ['string beans', 'haricots verts', 'snap beans'] }),
    D('snap-peas', 'Snap peas', 'veg', 'stalk', [1, 'cup', 63], [42, 2.8, 7.6, 0.2, 2.6, 4], { a: ['sugar snap peas', 'snow peas'] }),
    D('celery', 'Celery', 'veg', 'stalk', [2, 'stalks', 80], [14, 0.7, 3, 0.2, 1.6, 1.3], { a: ['celery stalks'] }),
    D('carrot', 'Carrots', 'veg', 'root', [1, 'medium carrot', 61], [41, 0.9, 9.6, 0.2, 2.8, 4.7], { a: ['carrot', 'baby carrots', 'shredded carrots', 'beets', 'beet', 'parsnips'] }),
    D('cucumber', 'Cucumber', 'veg', 'cucumber', [0.5, 'cucumber', 150], [15, 0.7, 3.6, 0.1, 0.5, 1.7], { a: ['cucumbers', 'english cucumber', 'persian cucumbers'] }),
    D('jalapeno', 'Jalapeños', 'veg', 'chili', [1, 'pepper', 14], [29, 0.9, 6.5, 0.4, 2.8, 4.1], { a: ['jalapeno', 'jalapeño', 'serrano', 'chili pepper', 'chile pepper', 'poblano', 'fresno chili', 'hot pepper'], def: 1 }),
    D('corn', 'Corn', 'veg', 'starchy-veg', [0.5, 'cup', 82], [86, 3.3, 18.7, 1.4, 2, 6.3], { a: ['sweet corn', 'corn kernels', 'frozen corn', 'corn on the cob'], tags: ['corn'] }),
    D('peas', 'Peas', 'veg', 'starchy-veg', [0.5, 'cup', 72], [81, 5.4, 14.5, 0.4, 5.1, 5.7], { a: ['green peas', 'frozen peas'] }),
    /* ── Fruits ── */
    D('lemon', 'Lemons', 'fruit', 'citrus', [1, 'lemon', 84], [29, 1.1, 9.3, 0.3, 2.8, 2.5], { a: ['lemon'], def: 1 }),
    D('lime', 'Limes', 'fruit', 'citrus', [1, 'lime', 67], [30, 0.7, 10.5, 0.2, 2.8, 1.7], { a: ['lime'], def: 1 }),
    D('avocado', 'Avocado', 'fruit', 'avocado', [0.5, 'avocado', 68], [160, 2, 8.5, 14.7, 6.7, 0.7], { a: ['avocados', 'guacamole'], def: 1 }),
    D('banana', 'Bananas', 'fruit', 'fruit', [1, 'medium banana', 118], [89, 1.1, 22.8, 0.3, 2.6, 12.2], { a: ['banana'], def: 1 }),
    D('berries', 'Berries', 'fruit', 'fruit', [1, 'cup', 148], [57, 0.7, 14.5, 0.3, 2.4, 10], { a: ['blueberries', 'mixed berries', 'frozen berries', 'blackberries', 'raspberries'], def: 1 }),
    D('strawberries', 'Strawberries', 'fruit', 'fruit', [1, 'cup sliced', 166], [32, 0.7, 7.7, 0.3, 2, 4.9], { a: ['strawberry'] }),
    D('apple', 'Apples', 'fruit', 'fruit', [1, 'medium apple', 182], [52, 0.3, 13.8, 0.2, 2.4, 10.4], { a: ['apple', 'pear', 'pears'] }),
    D('mango', 'Mango', 'fruit', 'fruit', [1, 'cup', 165], [60, 0.8, 15, 0.4, 1.6, 13.7], { a: ['mangoes', 'frozen mango'] }),
    D('pineapple', 'Pineapple', 'fruit', 'fruit', [1, 'cup chunks', 165], [50, 0.5, 13.1, 0.1, 1.4, 9.9], { a: ['pineapple chunks'] }),
    D('orange', 'Oranges', 'fruit', 'citrus', [1, 'orange', 131], [47, 0.9, 11.8, 0.1, 2.4, 9.4], { a: ['orange', 'clementines', 'mandarins', 'tangerine'] }),
    D('grapes', 'Grapes', 'fruit', 'fruit', [1, 'cup', 151], [69, 0.7, 18.1, 0.2, 0.9, 15.5], { a: ['grape', 'cherries', 'peaches', 'peach', 'kiwi', 'plums', 'melon', 'watermelon', 'cantaloupe'] }),
    /* ── Other ingredients ── */
    D('almonds', 'Almonds', 'other', 'nut', [1, 'oz', 28], [579, 21.2, 21.6, 49.9, 12.5, 4.4], { a: ['almond', 'sliced almonds', 'cashews', 'walnuts', 'pecans', 'pistachios', 'mixed nuts', 'nuts', 'peanuts'], tags: ['nut'], note: 'Typical tree-nut values (≈ 160–190 cal per ounce).' }),
    D('chia', 'Chia seeds', 'other', 'seed', [1, 'tbsp', 12], [486, 16.5, 42.1, 30.7, 34.4, 0], { a: ['chia', 'flax seeds', 'flaxseed', 'hemp seeds', 'pumpkin seeds', 'sunflower seeds'] }),
    D('hummus', 'Hummus', 'other', 'spread', [2, 'tbsp', 30, 'sold'], [166, 7.9, 14.3, 9.6, 6, 0.3], {}),
    D('olives', 'Olives', 'other', 'olive', [10, 'olives', 30, 'sold'], [115, 0.8, 6, 10.7, 3.2, 0], { a: ['kalamata olives', 'black olives', 'green olives'] }),
  ];

  /* ── Pantry: oils, seasonings and sauces recipes may add (listed separately, never a main ingredient) ──
   * use: [amount, unit] per serving when a recipe calls for it · common: false for things not every kitchen has
   * alt: substitute when the item is avoided (cornstarch → potato starch …) */
  const P = (id, name, s, v, x) => D(id, name, 'pantry', x && x.kind ? x.kind : 'pantry', s, v, Object.assign({ common: true }, x || {}));
  ING.PANTRY = [
    P('olive-oil', 'Olive oil', [1, 'tbsp', 13.5], [884, 0, 0, 100], { kind: 'oil' }),
    P('cooking-spray', 'Cooking spray', [1, 'spray', 0.3], [884, 0, 0, 100], { kind: 'oil' }),
    P('butter', 'Butter', [1, 'tbsp', 14], [717, 0.9, 0.1, 81], { tags: ['dairy'], alt: 'olive-oil' }),
    P('sesame-oil', 'Toasted sesame oil', [1, 'tsp', 4.5], [884, 0, 0, 100], { kind: 'oil', tags: ['sesame'] }),
    P('salt-pepper', 'Salt and pepper', [1, 'pinch', 0.4], [0, 0, 0, 0], { kind: 'spice' }),
    P('garlic-powder', 'Garlic powder', [1, 'tsp', 3.1], [331, 16.6, 72.7, 0.7], { kind: 'spice' }),
    P('onion-powder', 'Onion powder', [1, 'tsp', 2.4], [341, 10.4, 79, 1], { kind: 'spice' }),
    P('paprika', 'Smoked paprika', [1, 'tsp', 2.3], [282, 14.1, 54, 13], { kind: 'spice' }),
    P('cajun', 'Cajun seasoning', [1, 'tsp', 2.5], [250, 10, 45, 8], { kind: 'spice', note: 'Contains salt — skip the extra salt.' }),
    P('chili-powder', 'Chili powder', [1, 'tsp', 2.7], [282, 13.5, 49.7, 14.3], { kind: 'spice' }),
    P('cumin', 'Ground cumin', [1, 'tsp', 2.1], [375, 17.8, 44.2, 22.3], { kind: 'spice' }),
    P('chipotle', 'Chipotle chili powder', [1, 'tsp', 2.7], [282, 13.5, 49.7, 14.3], { kind: 'spice', common: false }),
    P('oregano', 'Dried oregano', [1, 'tsp', 1], [265, 9, 68.9, 4.3], { kind: 'spice' }),
    P('italian-seasoning', 'Italian seasoning', [1, 'tsp', 1], [265, 9, 68.9, 4.3], { kind: 'spice' }),
    P('curry-powder', 'Curry powder', [1, 'tsp', 2], [325, 14.3, 55.8, 14], { kind: 'spice' }),
    P('cinnamon', 'Cinnamon', [1, 'tsp', 2.6], [247, 4, 80.6, 1.2], { kind: 'spice' }),
    P('ground-ginger', 'Ground ginger', [1, 'tsp', 1.8], [335, 9, 71.6, 4.2], { kind: 'spice' }),
    P('red-pepper-flakes', 'Red pepper flakes', [1, 'tsp', 1.8], [318, 12, 56.6, 17.3], { kind: 'spice' }),
    P('jerk', 'Jerk seasoning', [1, 'tsp', 2.5], [250, 8, 50, 6], { kind: 'spice', common: false }),
    P('lemon-pepper', 'Lemon pepper seasoning', [1, 'tsp', 2.5], [200, 6, 40, 3], { kind: 'spice' }),
    P('everything', 'Everything bagel seasoning', [1, 'tsp', 3], [500, 18, 30, 40], { kind: 'spice', tags: ['sesame'] }),
    P('soy-sauce', 'Soy sauce', [1, 'tbsp', 16], [53, 8.1, 4.9, 0.6], { kind: 'sauce', tags: ['soy', 'gluten'], alt: 'tamari' }),
    P('tamari', 'Tamari (gluten-free soy sauce)', [1, 'tbsp', 16], [60, 10.5, 5.6, 0.1], { kind: 'sauce', tags: ['soy'], alt: 'coconut-aminos' }),
    P('coconut-aminos', 'Coconut aminos', [1, 'tbsp', 15], [100, 0, 20, 0], { kind: 'sauce', common: false }),
    P('honey', 'Honey', [1, 'tbsp', 21], [304, 0.3, 82.4, 0], { kind: 'sweet', alt: 'maple-syrup' }),
    P('maple-syrup', 'Maple syrup', [1, 'tbsp', 20], [260, 0, 67, 0.1], { kind: 'sweet' }),
    P('sriracha', 'Sriracha', [1, 'tsp', 6], [93, 1.9, 19.2, 0.9], { kind: 'sauce' }),
    P('hot-sauce', 'Hot sauce (Frank’s-style)', [1, 'tbsp', 15], [12, 0.5, 0.8, 0.8], { kind: 'sauce' }),
    P('bbq-sauce', 'BBQ sauce', [2, 'tbsp', 36], [172, 0.8, 40.8, 0.6], { kind: 'sauce' }),
    P('salsa', 'Salsa', [0.25, 'cup', 65], [36, 1.5, 6.6, 0.2], { kind: 'sauce' }),
    P('marinara', 'Marinara sauce', [0.5, 'cup', 125], [56, 1.6, 8.4, 1.8], { kind: 'sauce' }),
    P('pesto', 'Basil pesto (jarred)', [1, 'tbsp', 16], [400, 5, 6, 39], { kind: 'sauce', tags: ['dairy', 'nut'] }),
    P('dijon', 'Dijon mustard', [1, 'tsp', 5], [68, 4.4, 5.8, 4], { kind: 'sauce' }),
    P('vinegar', 'Rice or red-wine vinegar', [1, 'tbsp', 15], [18, 0, 0.1, 0], { kind: 'acid' }),
    P('balsamic', 'Balsamic vinegar', [1, 'tbsp', 16], [88, 0.5, 17, 0], { kind: 'acid' }),
    P('lemon-juice', 'Lemon juice', [1, 'tbsp', 15], [22, 0.4, 6.9, 0.2], { kind: 'acid' }),
    P('lime-juice', 'Lime juice', [1, 'tbsp', 15], [25, 0.4, 8.4, 0.1], { kind: 'acid' }),
    P('peanut-butter', 'Peanut butter', [1, 'tbsp', 16], [588, 25, 20, 50], { kind: 'sauce', tags: ['peanut', 'nut'] }),
    P('coconut-milk', 'Light coconut milk', [0.25, 'cup', 60], [75, 0.5, 2.5, 7], { kind: 'sauce', common: false }),
    P('broth', 'Chicken or vegetable broth', [1, 'cup', 240], [6, 0.6, 0.4, 0.2], { kind: 'liquid' }),
    P('miso', 'White miso paste', [1, 'tsp', 6], [198, 12.8, 25.4, 6], { kind: 'sauce', tags: ['soy'], common: false }),
    P('cornstarch', 'Cornstarch', [1, 'tsp', 2.7], [381, 0.3, 91.3, 0.1], { kind: 'starch', tags: ['corn'], alt: 'potato-starch' }),
    P('potato-starch', 'Potato starch', [1, 'tsp', 3], [333, 0.1, 83, 0.1], { kind: 'starch' }),
    P('flour', 'All-purpose flour', [1, 'tbsp', 8], [364, 10.3, 76.3, 1], { kind: 'starch', tags: ['gluten', 'flour'], alt: 'potato-starch' }),
    P('sesame-seeds', 'Sesame seeds', [1, 'tsp', 3], [573, 17.7, 23.5, 49.7], { kind: 'garnish', tags: ['sesame'] }),
    P('herbs', 'Fresh herbs (cilantro or parsley)', [2, 'tbsp', 4], [23, 2.1, 3.7, 0.5], { kind: 'garnish' }),
  ];

  /* Class defaults when nothing more specific is known — deliberately rough, clearly labelled. */
  ING.CLASS = {
    protein: D('generic-protein', 'Other protein', 'protein', 'generic-protein', [4, 'oz', 113], [150, 22, 0, 6, 0, 0], { note: 'Rough estimate for a lean-to-moderate protein food (≈ 4 oz raw). Edit it if you know the label.' }),
    carb: D('generic-carb', 'Other carbohydrate', 'carb', 'generic-carb', [1, 'cup cooked', 160, 'cooked'], [125, 3, 26, 1, 2, 1], { note: 'Rough estimate for a cooked starch or grain.' }),
    veg: D('generic-veg', 'Other vegetable', 'veg', 'generic-veg', [1, 'cup', 100], [30, 1.5, 6, 0.2, 2, 2.5], { note: 'Rough estimate for a non-starchy vegetable.' }),
    fruit: D('generic-fruit', 'Other fruit', 'fruit', 'fruit', [1, 'cup', 150], [55, 0.8, 14, 0.3, 2.5, 10], { note: 'Rough estimate for a typical fruit.' }),
    dairy: D('generic-dairy', 'Other dairy', 'dairy', 'cheese-melt', [1, 'oz', 28], [350, 22, 3, 28, 0, 1], { note: 'Rough estimate for a cheese-like dairy food.' }),
    other: D('generic-other', 'Other ingredient', 'other', 'spread', [2, 'tbsp', 30], [150, 3, 10, 11, 1, 3], { note: 'Rough estimate for a sauce, spread or topping (≈ 2 tbsp).' }),
  };

  /* Keyword classes for names no alias covers. Order matters: more specific first. */
  const RULES = [
    [/\b(turkey|chicken)\b.*\b(kielbasa|polska|smoked sausage)\b|\b(kielbasa|polska)\b.*\bturkey\b/, 'turkey-kielbasa'],
    [/\b(kielbasa|polska|andouille|smoked sausage|summer sausage|hot dog|hotdog|frank|frankfurter|wiener)s?\b/, 'kielbasa'],
    [/\b(chicken|turkey)\b.*\bsausage|\bsausage\b.*\b(chicken|turkey)\b/, 'chicken-sausage'],
    [/\bchorizo\b/, 'chorizo'],
    [/\b(sausage|bratwurst|brat|links?)\b/, 'italian-sausage'],
    [/\bturkey\b.*\bbacon\b/, 'turkey-bacon'],
    [/\b(bacon|pancetta|prosciutto)\b/, 'bacon'],
    [/\b(ham|deli|lunch meat|salami|pepperoni|pastrami|corned beef|roast beef)\b/, 'ham'],
    [/\bground\b.*\bturkey\b/, 'ground-turkey'],
    [/\bground\b.*\bchicken\b/, 'ground-chicken'],
    [/\bground\b.*\b(pork|sausage)\b/, 'ground-pork'],
    [/\bground\b.*\b(lamb|bison|venison)\b|\b(lamb|bison|venison|elk)\b/, 'ground-lamb'],
    [/\b(80|85|80\/20|85\/15)\b.*\bbeef\b/, 'ground-beef-80'],
    [/\bground\b|\bmince\b|\bburger patt(y|ies)\b/, 'ground-beef'],
    [/\b(ribeye|rib eye|prime rib|short rib|brisket)\b/, 'ribeye'],
    [/\b(steak|sirloin|flank|skirt|tri ?tip|filet|tenderloin steak|stew meat|chuck|roast|beef)\b/, 'steak'],
    [/\bpork\b.*\btenderloin\b/, 'pork-tenderloin'],
    [/\b(pork|carnitas|chops?)\b/, 'pork-chop'],
    [/\b(rotisserie|cooked|grilled|shredded|canned)\b.*\bchicken\b/, 'cooked-chicken'],
    [/\bchicken\b.*\b(wing|drumette)s?\b/, 'chicken-wings'],
    [/\bchicken\b.*\b(drumstick|leg|quarter)s?\b/, 'chicken-drumsticks'],
    [/\bchicken\b.*\bthighs?\b/, 'chicken-thigh'],
    [/\bchicken\b/, 'chicken-breast'],
    [/\bturkey\b/, 'turkey-breast'],
    [/\b(wild|sockeye|coho|king)\b.*\bsalmon\b/, 'wild-salmon'],
    [/\b(canned|pouch|tin)\b.*\bsalmon\b/, 'canned-salmon'],
    [/\b(salmon|trout|arctic char|mackerel|sardines?|anchov(y|ies)|herring|steelhead)\b/, 'salmon'],
    [/\b(ahi|yellowfin|tuna steak)\b/, 'tuna-steak'],
    [/\btuna\b/, 'tuna'],
    [/\b(shrimp|prawns?)\b/, 'shrimp'],
    [/\b(scallops?|crab|lobster|mussels?|clams?|oysters?|squid|calamari|octopus|crawfish)\b/, 'scallops'],
    [/\b(tilapia|catfish|swai|mahi|basa|perch|snapper|bass|branzino|grouper|swordfish)\b/, 'tilapia'],
    [/\b(cod|haddock|pollock|halibut|flounder|sole|hake|fish|whitefish)\b/, 'cod'],
    [/\begg whites?\b/, 'egg-whites'],
    [/\beggs?\b/, 'eggs'],
    [/\btofu\b/, 'tofu'], [/\btempeh\b/, 'tempeh'], [/\bseitan\b/, 'seitan'],
    [/\bedamame\b/, 'edamame'],
    [/\blentils?\b/, 'lentils'],
    [/\b(chickpeas?|garbanzo|cannellini|white beans?|navy beans?|butter beans?)\b/, 'chickpeas'],
    [/\b(beans?|legumes?)\b/, 'black-beans'],
    [/\bcottage\b/, 'cottage-cheese'],
    [/\b(greek|skyr|icelandic)\b.*\byogh?urt\b|\bskyr\b/, 'greek-yogurt'],
    [/\byogh?urt\b/, 'yogurt'],
    [/\b(parmesan|parmigiano|pecorino|romano|asiago)\b/, 'parmesan'],
    [/\b(feta|goat cheese|cotija|queso fresco|blue cheese|gorgonzola)\b/, 'feta'],
    [/\b(mozzarella|provolone|string cheese|burrata)\b/, 'mozzarella'],
    [/\b(cream cheese|ricotta|mascarpone|neufchatel)\b/, 'cream-cheese'],
    [/\bcheese\b/, 'cheddar'],
    [/\b(oat|almond|soy|cashew|rice|coconut|plant)\b.*\bmilk\b/, 'plant-milk'],
    [/\b(milk|kefir)\b/, 'milk'],
    [/\b(dry|uncooked|raw)\b.*\brice\b/, 'rice-dry'],
    [/\bbrown rice\b|\bwild rice\b/, 'brown-rice'],
    [/\brice noodles?\b|\bvermicelli\b/, 'rice-noodles'],
    [/\brice\b/, 'rice'],
    [/\bquinoa\b/, 'quinoa'],
    [/\b(couscous|farro|bulgur|barley|freekeh|millet)\b/, 'couscous'],
    [/\b(oats?|oatmeal|granola|muesli)\b/, 'oats'],
    [/\b(spaghetti squash|butternut|acorn squash|pumpkin|delicata|kabocha)\b/, 'butternut'],
    [/\b(protein|high protein)\b.*\b(pasta|noodles?|spaghetti|penne|rotini)\b/, 'protein-pasta'],
    [/\b(chickpea|lentil|bean)\b.*\b(pasta|noodles?)\b|\bbanza\b/, 'chickpea-pasta'],
    [/\b(ramen|udon|lo mein|egg noodles?|chow mein)\b/, 'egg-noodles'],
    [/\bsoba\b/, 'soba'],
    [/\b(pasta|spaghetti|penne|rigatoni|fusilli|rotini|linguine|fettuccine|macaroni|orzo|farfalle|gnocchi|noodles?|lasagna|ravioli|tortellini)\b/, 'pasta'],
    [/\bcorn\b.*\btortillas?\b/, 'corn-tortilla'],
    [/\b(low carb|keto|carb balance|high fiber)\b.*\b(tortillas?|wraps?)\b/, 'low-carb-tortilla'],
    [/\b(tortillas?|wraps?|burrito)\b/, 'tortilla'],
    [/\b(pita|naan|flatbread|lavash|roti|chapati)\b/, 'pita'],
    [/\bbagels?\b/, 'bagel'],
    [/\benglish muffins?\b/, 'english-muffin'],
    [/\b(buns?|rolls?|hoagie|brioche|slider)\b/, 'bun'],
    [/\b(bread|toast|sourdough|baguette|ciabatta|rye|focaccia)\b/, 'bread'],
    [/\b(sweet potato(es)?|yams?)\b/, 'sweet-potato'],
    [/\b(potato(es)?|hash browns?|tater|fries)\b/, 'potato'],
    [/\b(zucchini|courgette|yellow squash|summer squash)\b/, 'zucchini'],
    [/\b(spinach)\b/, 'spinach'],
    [/\b(kale|chard|collards?|mustard greens|turnip greens)\b/, 'kale'],
    [/\b(arugula|rocket|mixed greens|spring mix|microgreens|watercress)\b/, 'arugula'],
    [/\b(romaine|lettuce|iceberg|endive|radicchio)\b/, 'lettuce'],
    [/\b(bok choy|pak choi|bok choi)\b/, 'bok-choy'],
    [/\b(cabbage|slaw)\b/, 'cabbage'],
    [/\b(broccoli|broccolini|rapini)\b/, 'broccoli'],
    [/\bcauliflower\b/, 'cauliflower'],
    [/\bbrussels?\b/, 'brussels'],
    [/\b(jalape(n|ñ)os?|serranos?|habaneros?|poblanos?|chil(e|i)s?|hot peppers?|thai chil(i|e))\b/, 'jalapeno'],
    [/\bpeppers?\b/, 'bell-pepper'],
    [/\b(scallions?|green onions?|spring onions?|chives)\b/, 'green-onion'],
    [/\b(shallots?|leeks?)\b/, 'shallot'],
    [/\bonions?\b/, 'onion'],
    [/\bgarlic\b/, 'garlic'],
    [/\bginger\b/, 'ginger'],
    [/\bmushrooms?\b|\b(portobello|shiitake|cremini|oyster mushrooms?)\b/, 'mushroom'],
    [/\b(canned|diced|crushed|stewed|fire roasted)\b.*\btomato(es)?\b|\btomato sauce\b/, 'canned-tomatoes'],
    [/\btomato(es)?\b/, 'tomato'],
    [/\beggplants?\b|\baubergine\b/, 'eggplant'],
    [/\basparagus\b/, 'asparagus'],
    [/\b(green|string) beans?\b|\bharicots?\b/, 'green-beans'],
    [/\b(snap|snow|sugar snap) peas?\b/, 'snap-peas'],
    [/\bpeas?\b/, 'peas'],
    [/\bcelery\b/, 'celery'],
    [/\b(carrots?|beets?|parsnips?|turnips?|radish(es)?|jicama)\b/, 'carrot'],
    [/\bcucumbers?\b|\bpickles?\b/, 'cucumber'],
    [/\bcorn\b/, 'corn'],
    [/\b(okra|artichokes?|fennel|bean sprouts|water chestnuts)\b/, 'green-beans'],
    [/\bavocados?\b|\bguacamole\b/, 'avocado'],
    [/\blemons?\b/, 'lemon'], [/\blimes?\b/, 'lime'],
    [/\b(oranges?|clementines?|mandarins?|tangerines?|grapefruit)\b/, 'orange'],
    [/\bbananas?\b|\bplantains?\b/, 'banana'],
    [/\bstrawberr(y|ies)\b/, 'strawberries'],
    [/\b(berr(y|ies)|blueberr(y|ies)|raspberr(y|ies)|blackberr(y|ies)|cranberr(y|ies))\b/, 'berries'],
    [/\b(apples?|pears?)\b/, 'apple'],
    [/\bmangos?(es)?\b/, 'mango'], [/\bpineapples?\b/, 'pineapple'],
    [/\b(grapes?|cherr(y|ies)|peach(es)?|nectarines?|plums?|kiwis?|melons?|watermelon|cantaloupe|figs?|dates?|papaya)\b/, 'grapes'],
    [/\b(almonds?|cashews?|walnuts?|pecans?|pistachios?|peanuts?|nuts?|hazelnuts?)\b/, 'almonds'],
    [/\b(chia|flax|hemp|pumpkin seeds?|sunflower seeds?|pepitas)\b/, 'chia'],
    [/\bhummus\b/, 'hummus'],
    [/\bolives?\b/, 'olives'],
  ];

  /* ───────── Lookup & estimation ───────── */
  const norm = (s) => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9%\/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const sing = (w) => (w.length > 3 && /ies$/.test(w) ? w.slice(0, -3) + 'y' : w.length > 3 && /(ch|sh|x|ss|o)es$/.test(w) ? w.slice(0, -2) : w.length > 3 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w);
  const singAll = (s) => norm(s).split(' ').map(sing).join(' ');
  const ALL = () => ING.DB.concat(ING.PANTRY);
  let INDEX = null;
  function index() {
    if (INDEX) return INDEX;
    INDEX = [];
    ALL().forEach((x) => [x.name].concat(x.a || []).forEach((n) => INDEX.push({ key: singAll(n), x })));
    INDEX.sort((a, b) => b.key.length - a.key.length);
    return INDEX;
  }
  ING.get = (id) => ALL().find((x) => x.id === id) || Object.values(ING.CLASS).find((x) => x.id === id) || null;
  ING.pantry = (id) => ING.PANTRY.find((x) => x.id === id) || null;

  /** Macros for one serving of a database entry (computed from per-100 g values). */
  ING.servingMacros = function (x) {
    const k = (x.serving.g || 0) / 100;
    const r = (v) => (v == null ? null : Math.round(v * k * 10) / 10);
    return { cal: r(x.per100.cal), p: r(x.per100.p), c: r(x.per100.c), f: r(x.per100.f), fiber: r(x.per100.fiber), sugar: r(x.per100.sugar) };
  };
  const STOP = new Set(['fresh', 'frozen', 'organic', 'raw', 'the', 'a', 'of', 'and', 'with', 'my', 'some', 'large', 'small', 'medium', 'whole', 'boneless', 'skinless', 'lean', 'extra', 'chopped', 'sliced', 'diced', 'baby', 'mini', 'family', 'pack', 'package', 'bag', 'store', 'brand', 'plain', 'natural', 'premium', 'classic', 'original', 'style']);

  /** Turn a database entry into an estimate record. */
  function fromDb(x, how, extra) {
    return Object.assign({
      base: x.id, baseName: x.name, cat: x.cat, kind: x.kind, tags: (x.tags || []).slice(),
      serving: Object.assign({}, x.serving), macros: ING.servingMacros(x),
      status: 'estimated', confidence: how,
      source: x.id.startsWith('generic-') ? 'Rough category estimate' : `Typical values for ${x.name.toLowerCase()}${x.label ? ` (${x.label})` : ''}`,
      note: x.note || '', precooked: !!x.precooked, meal: x.meal || 1,
    }, extra || {});
  }

  /** A pantry item (butter, BBQ sauce…) added to the kitchen: shown under Other ingredients. */
  function fromPantry(x, how, raw) {
    const r = fromDb(x, how);
    r.cat = 'other';
    r.pantryId = x.id;
    if (raw && how !== 'exact') r.note = `Typical ${x.name.toLowerCase()} values${/[A-Z]/.test(raw) ? ' — brand-specific values aren’t on file' : ''}.`;
    return r;
  }

  /**
   * Estimate nutrition for any ingredient name, offline. Never returns zero macros for a food.
   * catHint (optional) is the category the user chose; it picks the fallback and breaks ties.
   */
  ING.estimate = function (text, catHint) {
    const raw = String(text || '').trim();
    const t = singAll(raw);
    if (!t) return fromDb(ING.CLASS[catHint] || ING.CLASS.other, 'category');
    // 1. A branded product already in the local product table (verified values beat a generic profile)
    const prod = matchProduct(raw);
    if (prod) return prod;
    // 2. Exact name or alias
    const exact = index().find((e) => e.key === t);
    if (exact) return exact.x.cat === 'pantry' ? fromPantry(exact.x, 'exact') : fromDb(exact.x, 'exact');
    // 3. Closest generic ingredient contained in the name (longest alias first)
    const toks = t.split(' ');
    const contained = index().find((e) => e.x.cat !== 'pantry' && (' ' + t + ' ').includes(' ' + e.key + ' ')) || index().find((e) => (' ' + t + ' ').includes(' ' + e.key + ' '));
    // 4. Keyword classes
    const rule = RULES.find(([re]) => re.test(norm(raw)) || re.test(t));
    let x = contained ? contained.x : rule ? ING.get(rule[1]) : null;
    // A keyword rule can be more specific than a short contained alias ("chicken" inside "chicken sausage")
    if (contained && rule && rule[1] !== contained.x.id) {
      const rx = ING.get(rule[1]);
      if (rx && contained.key.split(' ').length === 1) x = rx;
    }
    if (x && x.cat === 'pantry') return fromPantry(x, 'closest', raw);
    if (x) {
      const matchedWords = new Set((contained && contained.x === x ? contained.key : '').split(' ').filter(Boolean));
      const extra = toks.filter((w) => !matchedWords.has(w) && !STOP.has(w) && !singAll(x.name).split(' ').includes(w) && !/^\d/.test(w));
      const brandish = raw.split(/\s+/).filter((w) => extra.includes(sing(norm(w))) && /^[A-Z]/.test(w));
      let note = x.note || '';
      if (brandish.length) note = `${brandish.join(' ')}-specific values aren’t on file — this is a typical ${x.name.toLowerCase()} estimate. Enter the label values for exact numbers.${note ? ' ' + note : ''}`;
      const how = contained && contained.x === x && !extra.length ? 'exact' : 'closest';
      const r = fromDb(x, how, { note });
      if (catHint && catHint !== x.cat && x.cat !== 'pantry') r.catNote = `Nutrition based on ${x.name.toLowerCase()}.`;
      return r;
    }
    // 5. Category default — rough, labelled, never zero
    return fromDb(ING.CLASS[catHint] || ING.CLASS.other, 'category');
  };

  /** Branded product match through the food diary's product table (only products already on file). */
  function matchProduct(raw) {
    const N = WT.nut;
    if (!N || !N.parseItem || !WT.PRODUCTS) return null;
    try {
      const it = N.parseItem(raw);
      if (!it || it.unknown || it.ambiguous || !it.foodId || !String(it.foodId).startsWith('p:')) return null;
      const p = WT.PRODUCTS.find((x) => x.id === it.foodId.slice(2));
      if (!p) return null;
      // The generic profile for this kind of food fills anything the product source didn't publish
      const base = ING.estimate(`${p.line || ''} ${p.cat || ''}`.replace(new RegExp(p.brand, 'ig'), ''), null);
      const g = +p.g || base.serving.g;
      const fill = (k) => (base.base && ING.get(base.base) ? Math.round((ING.get(base.base).per100[k] || 0) * g) / 100 : base.macros[k]);
      const missing = ['cal', 'c', 'f'].filter((k) => p[k] == null);
      const macros = { cal: p.cal != null ? +p.cal : fill('cal'), p: +p.p || 0, c: p.c != null ? +p.c : fill('c'), f: p.f != null ? +p.f : fill('f'), fiber: null, sugar: null };
      return {
        base: base.base, baseName: base.baseName, cat: base.cat, kind: base.kind, tags: base.tags,
        serving: { n: 1, unit: p.unit || 'serving', g, state: 'sold', text: p.serv || '' },
        macros, status: p.status === 'verified' ? 'verified' : 'estimated', confidence: 'product',
        source: `${p.brand} ${p.line || ''}`.trim() + (p.source && p.source.name ? ` · ${p.source.name}` : ''),
        sourceUrl: (p.source && p.source.url) || '',
        note: [missing.length ? `The product source gives protein${p.cal != null ? ' and calories' : ''} only; ${missing.map((k) => ({ cal: 'calories', c: 'carbs', f: 'fat' }[k])).join(' and ')} are estimated from typical ${base.baseName.toLowerCase()}.` : '', p.status !== 'verified' ? 'From a retailer listing — check your package.' : ''].filter(Boolean).join(' '),
        productId: p.id, precooked: base.precooked, meal: base.meal,
      };
    } catch (e) {
      return null;
    }
  }

  /** Search the database (not the pantry): best matches for a query. */
  ING.search = function (q, limit) {
    const t = singAll(q);
    if (!t) return [];
    const seen = new Set();
    const out = [];
    const push = (x) => !seen.has(x.id) && (seen.add(x.id), out.push(x));
    index().forEach((e) => e.x.cat !== 'pantry' && e.key.startsWith(t) && push(e.x));
    index().forEach((e) => e.x.cat !== 'pantry' && (' ' + e.key).includes(' ' + t) && push(e.x));
    index().forEach((e) => e.x.cat !== 'pantry' && e.key.includes(t) && push(e.x));
    return out.slice(0, limit || 12);
  };
  ING.norm = norm;
  ING.singAll = singAll;
})();
