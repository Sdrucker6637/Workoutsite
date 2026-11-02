/* Meal planner: ingredient catalog, bundled recipe templates and an offline meal-idea generator.
 *
 * Everything here runs on the device. There is no recipe API, no AI service and no network call: ideas are
 * built from the templates below, filled with the ingredients you picked. Quantities are approximate per-serving
 * portions and the macros are rough estimates from typical (USDA-style) values for those portions.
 */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const M = (WT.meals = WT.meals || {});

  M.CATS = { protein: 'Protein', carb: 'Carbohydrates', veg: 'Vegetables' };

  /* ───────── Ingredients ─────────
   * kind  — protein: poultry · beef · seafood · egg · dairy · plant; carb: starch · grain · pasta · bread; veg: leafy · cruciferous · aromatic · fruit-veg …
   * tags  — diet flags: meat, poultry, fish, shellfish, dairy, egg, gluten, soy
   * per   — one serving's portion: amount (number), unit, and macros for that portion
   */
  const I = (id, name, cat, kind, tags, n, unit, p, cal, c, f, extra) =>
    Object.assign({ id, name, cat, kind, tags: tags ? tags.split(' ') : [], per: { n, unit, p, cal, c, f } }, extra || {});
  M.BUILTIN = [
    // Protein (raw weights unless noted)
    I('chicken-breast', 'Chicken breast', 'protein', 'poultry', 'meat poultry', 6, 'oz', 39, 205, 0, 4.5, { airFry: true, sear: true }),
    I('chicken-thigh', 'Chicken thighs', 'protein', 'poultry', 'meat poultry', 6, 'oz', 33, 205, 0, 7, { airFry: true, sear: true, label: 'boneless, skinless' }),
    I('ground-chicken', 'Ground chicken', 'protein', 'ground', 'meat poultry', 6, 'oz', 30, 245, 0, 14),
    I('ground-beef', 'Ground beef', 'protein', 'ground', 'meat', 5, 'oz', 28, 250, 0, 14, { label: '90% lean' }),
    I('ground-turkey', 'Ground turkey', 'protein', 'ground', 'meat poultry', 6, 'oz', 32, 255, 0, 13, { label: '93% lean' }),
    I('shrimp', 'Shrimp', 'protein', 'seafood', 'shellfish', 6, 'oz', 34, 145, 0, 1, { airFry: true, sear: true, label: 'peeled' }),
    I('salmon', 'Salmon', 'protein', 'seafood', 'fish', 5, 'oz', 29, 295, 0, 19, { airFry: true, sear: true }),
    I('tuna', 'Tuna', 'protein', 'tuna', 'fish', 1, 'can', 26, 120, 0, 1, { label: '5 oz can in water, drained' }),
    I('eggs', 'Eggs', 'protein', 'egg', 'egg', 3, 'large', 19, 215, 1, 15),
    I('greek-yogurt', 'Greek yogurt', 'protein', 'dairy', 'dairy', 0.75, 'cup', 17, 100, 6, 0, { label: 'plain, nonfat', sauce: { n: 0.33, p: 8, cal: 45, c: 3, f: 0 } }),
    I('cottage-cheese', 'Cottage cheese', 'protein', 'dairy', 'dairy', 0.5, 'cup', 12, 90, 5, 2.5, { label: 'low-fat', sauce: { n: 0.33, p: 8, cal: 60, c: 3, f: 1.5 } }),
    I('tofu', 'Tofu', 'protein', 'plant', 'soy', 7, 'oz', 22, 200, 4, 11, { airFry: true, sear: true, label: 'extra-firm' }),
    // Carbohydrates
    I('potato', 'Potatoes', 'carb', 'starch', '', 1, 'medium', 4, 160, 36, 0, { airFry: true, one: 'potato' }),
    I('sweet-potato', 'Sweet potatoes', 'carb', 'starch', '', 1, 'medium', 2, 115, 27, 0, { airFry: true, one: 'sweet potato' }),
    I('rice', 'Rice', 'carb', 'grain', '', 0.75, 'cup cooked', 3, 155, 34, 0),
    I('pasta', 'Pasta', 'carb', 'pasta', 'gluten', 2, 'oz dry', 7, 200, 42, 1),
    I('protein-pasta', 'Protein pasta', 'carb', 'pasta', 'gluten', 2, 'oz dry', 10, 190, 38, 1),
    I('bread', 'Bread', 'carb', 'bread', 'gluten', 2, 'slices', 8, 160, 28, 2, { label: 'whole-grain' }),
    I('tortilla', 'Tortillas', 'carb', 'tortilla', 'gluten', 2, 'small', 5, 180, 30, 4, { label: '6-inch', one: 'tortilla' }),
    I('quinoa', 'Quinoa', 'carb', 'grain', '', 0.75, 'cup cooked', 6, 165, 29, 3, { one: 'quinoa' }),
    // Vegetables
    I('spinach', 'Spinach', 'veg', 'leafy', '', 2, 'cups', 2, 15, 2, 0),
    I('bok-choy', 'Bok choy', 'veg', 'leafy', '', 2, 'baby heads', 3, 25, 4, 0),
    I('broccoli', 'Broccoli', 'veg', 'cruciferous', '', 1.5, 'cups florets', 4, 45, 9, 0.5, { airFry: true }),
    I('bell-pepper', 'Bell peppers', 'veg', 'fruit-veg', '', 1, 'pepper', 1, 30, 7, 0, { airFry: true }),
    I('onion', 'Onions', 'veg', 'aromatic', '', 0.5, 'onion', 0.5, 22, 5, 0),
    I('mushroom', 'Mushrooms', 'veg', 'fruit-veg', '', 1.5, 'cups sliced', 3, 22, 3, 0, { airFry: true }),
    I('tomato', 'Tomatoes', 'veg', 'fruit-veg', '', 1, 'medium', 1, 22, 5, 0),
    I('zucchini', 'Zucchini', 'veg', 'fruit-veg', '', 1, 'medium', 2.5, 33, 6, 0.5, { airFry: true }),
    I('asparagus', 'Asparagus', 'veg', 'stalk', '', 8, 'spears', 3, 26, 5, 0, { airFry: true }),
    I('jalapeno', 'Jalapeños', 'veg', 'aromatic', '', 0.5, 'pepper', 0, 2, 0.5, 0),
    I('garlic', 'Garlic', 'veg', 'aromatic', '', 2, 'cloves', 0.5, 9, 2, 0),
  ];

  /* Common pantry additions — always shown separately from what you selected. */
  const X = (id, name, n, unit, macros, tags, alt) => ({ id, name, n, unit, m: macros || null, tags: tags ? tags.split(' ') : [], alt: alt || null });
  M.EXTRAS = {
    oil: X('oil', 'Olive oil', 1, 'tsp', { p: 0, cal: 40, c: 0, f: 4.5 }),
    spray: X('spray', 'Cooking spray or 1 tsp oil', null, '', { p: 0, cal: 10, c: 0, f: 1 }),
    salt: X('salt', 'Salt and pepper', null, ''),
    garlicPowder: X('garlic-powder', 'Garlic powder', 0.25, 'tsp'),
    paprika: X('paprika', 'Smoked paprika', 0.5, 'tsp'),
    chili: X('chili', 'Chili powder and cumin', 0.5, 'tsp each'),
    italian: X('italian', 'Italian seasoning', 0.5, 'tsp'),
    flakes: X('flakes', 'Red pepper flakes', null, 'pinch'),
    lemon: X('lemon', 'Lemon', 0.25, 'lemon'),
    lime: X('lime', 'Lime', 0.25, 'lime'),
    soy: X('soy', 'Soy sauce', 1, 'tbsp', { p: 1, cal: 10, c: 1, f: 0 }, 'soy gluten', 'tamari or coconut aminos'),
    sesame: X('sesame', 'Sesame oil', 0.5, 'tsp', { p: 0, cal: 20, c: 0, f: 2.3 }),
    ginger: X('ginger', 'Fresh or ground ginger', null, 'a little'),
    honey: X('honey', 'Honey', 1, 'tsp', { p: 0, cal: 20, c: 6, f: 0 }),
    sriracha: X('sriracha', 'Sriracha or chili sauce', 1, 'tsp', { p: 0, cal: 5, c: 1, f: 0 }),
    marinara: X('marinara', 'Marinara sauce', 0.5, 'cup', { p: 2, cal: 70, c: 10, f: 2 }),
    parmesan: X('parmesan', 'Parmesan', 1, 'tbsp', { p: 2, cal: 22, c: 0, f: 1.5 }, 'dairy'),
    cheese: X('cheese', 'Shredded cheese', 2, 'tbsp', { p: 3.5, cal: 55, c: 0, f: 4.5 }, 'dairy'),
    salsa: X('salsa', 'Salsa', 0.25, 'cup', { p: 0.5, cal: 20, c: 4, f: 0 }),
    broth: X('broth', 'Chicken or vegetable broth', 1, 'cup', { p: 1, cal: 15, c: 1, f: 0 }),
    cornstarch: X('cornstarch', 'Cornstarch', 1, 'tsp', { p: 0, cal: 10, c: 2.5, f: 0 }),
    mustard: X('mustard', 'Dijon mustard', 1, 'tsp', { p: 0, cal: 5, c: 0, f: 0 }),
    vinegar: X('vinegar', 'Rice or red-wine vinegar', 1, 'tsp'),
    herbs: X('herbs', 'Fresh herbs (parsley, cilantro or dill), optional', null, ''),
    beans: X('beans', 'Black beans, rinsed (optional)', 0.25, 'cup', { p: 4, cal: 55, c: 10, f: 0 }),
  };

  /* ───────── Recipe templates ─────────
   * Each template says which of YOUR ingredients it can use and how to cook them. Slots:
   *   protein: ids or kinds it accepts (true = any), optional / extra (a second protein)
   *   carb:    ids or kinds, `need`: 'required' | 'optional' | 'none'
   *   veg:     ids or kinds (true = any), min / max
   * steps(s) receives the chosen ingredients: s.p (protein), s.p2, s.c (carb or null), s.v (veg list).
   */
  const lower = (x) => (x ? x.name.toLowerCase() : '');
  const vegList = (s) => WT.listJoin(s.v.map(lower));
  /** " and spinach" / ", spinach" … or nothing when no vegetables were picked (vegetables are optional for many meals). */
  /** Vegetables named in a title: aromatics (garlic, onion, jalapeño) only when nothing else was picked. */
  const vegName = (s) => {
    const main = s.v.filter((v) => v.kind !== 'aromatic');
    return WT.listJoin((main.length ? main : s.v).map(lower));
  };
  const one = (x) => (x ? x.one || lower(x) : '');
  const andVeg = (s, pre) => (s.v.length ? (pre == null ? ' and ' : pre) + vegName(s) : '');
  const vegStep = (s, text) => (s.v.length ? text : null);
  const has = (s, id) => s.v.some((v) => v.id === id);
  const aromaticsNote = (s) => (has(s, 'garlic') || has(s, 'onion') || has(s, 'jalapeno') ? ' with the ' + WT.listJoin(s.v.filter((v) => v.kind === 'aromatic').map(lower)) : '');
  const carbCook = (c) => {
    if (!c) return null;
    if (c.id === 'rice') return 'Cook the rice (or reheat leftover rice).';
    if (c.id === 'quinoa') return 'Rinse and cook the quinoa: 1 part quinoa to 2 parts water, simmer 15 minutes, then rest covered.';
    if (c.kind === 'pasta') return `Boil the ${lower(c)} in salted water until just tender; save a splash of the cooking water.`;
    if (c.kind === 'bread') return 'Toast the bread.';
    if (c.kind === 'tortilla') return 'Warm the tortillas in a dry pan or the microwave.';
    if (c.kind === 'starch') return `Cut the ${lower(c)} into ¾-inch cubes, toss with a little oil and salt, and air-fry at 400°F (200°C) for 18–22 minutes, shaking halfway (or roast at 425°F for 25–30).`;
    return `Cook the ${lower(c)}.`;
  };
  const proteinCook = (pr, how) => {
    const n = lower(pr);
    if (pr.kind === 'ground') return `Brown the ${n} in a hot pan over medium-high heat, breaking it up, 6–8 minutes until no pink remains.`;
    if (pr.id === 'shrimp') return how === 'air' ? 'Air-fry the shrimp at 400°F (200°C) for 6–8 minutes until pink and curled.' : 'Sear the shrimp in a hot pan, 1–2 minutes per side until pink.';
    if (pr.id === 'salmon') return how === 'air' ? 'Air-fry the salmon at 400°F (200°C) for 8–10 minutes, until it flakes easily.' : 'Sear the salmon skin-side down for 4 minutes, flip and cook 2–3 more.';
    if (pr.id === 'tofu') return how === 'air' ? 'Press the tofu for 10 minutes, cube it, toss with 1 tsp cornstarch and air-fry at 400°F (200°C) for 12–15 minutes until crisp.' : 'Press and cube the tofu, then pan-fry until golden on most sides, about 8 minutes.';
    if (pr.kind === 'poultry') return how === 'air' ? `Air-fry the ${n} at 380°F (195°C) for ${pr.id === 'chicken-thigh' ? '14–18' : '12–16'} minutes, flipping halfway, until 165°F (74°C) inside.` : `Slice the ${n} into strips and sear in a hot pan, 6–8 minutes, until cooked through (165°F / 74°C).`;
    if (pr.id === 'eggs') return 'Whisk the eggs with a pinch of salt.';
    if (pr.id === 'tuna') return 'Drain the tuna well.';
    return `Cook the ${n} until done.`;
  };
  const SEAR = ['chicken-breast', 'chicken-thigh', 'shrimp', 'salmon', 'tofu', 'ground'];
  const AIR = ['chicken-breast', 'chicken-thigh', 'shrimp', 'salmon', 'tofu'];
  const T = (o) => Object.assign({ prep: 10, cook: 20, carb: { ok: true, need: 'optional' }, veg: { ok: true, min: 1, max: 3 }, extras: ['salt'] }, o);

  M.TEMPLATES = [
    T({
      id: 'air-plate', method: 'Air fryer', air: true, prep: 10, cook: 22, cookFor: (s) => (s.c ? 22 : 14),
      protein: { ok: AIR }, carb: { ok: ['potato', 'sweet-potato', 'starch'], need: 'optional' }, veg: { ok: ['broccoli', 'asparagus', 'zucchini', 'bell-pepper', 'mushroom', 'cruciferous', 'stalk', 'fruit-veg'], min: 0, max: 2 },
      extras: ['spray', 'salt', 'paprika', 'garlicPowder', 'lemon'],
      name: (s) => `Air-fryer ${lower(s.p)}${s.c ? ` with crispy ${lower(s.c)}` : ''}${andVeg(s, s.c ? ' and ' : ' with ')}`,
      steps: (s) => [
        s.c && carbCook(s.c),
        `Pat the ${lower(s.p)} dry and season with paprika, garlic powder, salt and pepper.`,
        proteinCook(s.p, 'air'),
        vegStep(s, `Toss the ${vegList(s)} with a little oil and salt; air-fry at 400°F (200°C) for 7–10 minutes${s.c ? ' while the protein rests' : ''}.`),
        'Finish with a squeeze of lemon.',
      ],
    }),
    T({
      id: 'stir-fry', method: 'Skillet', prep: 10, cook: 15,
      protein: { ok: ['chicken-breast', 'chicken-thigh', 'shrimp', 'tofu', 'ground'] }, carb: { ok: ['rice', 'quinoa', 'pasta', 'protein-pasta'], need: 'optional' },
      veg: { ok: ['bok-choy', 'broccoli', 'bell-pepper', 'mushroom', 'onion', 'garlic', 'jalapeno', 'spinach', 'zucchini', 'asparagus'], min: 1, max: 4 },
      extras: ['oil', 'soy', 'ginger', 'sesame', 'cornstarch'],
      name: (s) => `${s.p.name} & ${vegName(s)} stir-fry${s.c ? ` over ${lower(s.c)}` : ''}`,
      steps: (s) => [
        s.c && carbCook(s.c),
        'Stir together the soy sauce, ginger, 1 tsp cornstarch and 3 tbsp water.',
        proteinCook(s.p, 'pan') + ' Move it to a plate.',
        `In the same pan, stir-fry the ${vegList(s)} over high heat for 3–5 minutes until crisp-tender.`,
        `Return the ${lower(s.p)}, pour in the sauce and toss for 1 minute until glossy. Finish with sesame oil.`,
      ],
    }),
    T({
      id: 'garlic-pasta', method: 'Stovetop', prep: 5, cook: 20,
      protein: { ok: ['chicken-breast', 'chicken-thigh', 'shrimp', 'ground', 'tuna', 'cottage-cheese', 'tofu'] }, carb: { ok: ['pasta', 'protein-pasta'], need: 'required' },
      veg: { ok: ['spinach', 'tomato', 'mushroom', 'zucchini', 'broccoli', 'garlic', 'bok-choy', 'asparagus', 'onion', 'bell-pepper'], min: 0, max: 3 },
      extras: ['oil', 'garlicPowder', 'salt', 'flakes', 'parmesan', 'lemon'],
      name: (s) => `Garlicky ${lower(s.c)} with ${lower(s.p)}${andVeg(s)}`,
      steps: (s) => [
        carbCook(s.c),
        s.p.id === 'cottage-cheese' ? 'Blend the cottage cheese with a splash of pasta water until smooth — this is the creamy sauce.' : proteinCook(s.p, 'pan'),
        s.v.length ? `Add a little oil to the pan and cook the ${vegList(s)} for 3–4 minutes${has(s, 'garlic') ? ' (add the garlic for the last minute so it doesn’t burn)' : ''}.` : 'Warm a little oil with the garlic powder for 30 seconds.',
        `Toss in the drained pasta${s.p.id === 'cottage-cheese' ? ' and the cottage-cheese sauce' : ` and ${lower(s.p)}`} with a splash of pasta water, red pepper flakes and lemon.`,
        'Top with a little parmesan.',
      ],
    }),
    T({
      id: 'burrito-bowl', method: 'Skillet', prep: 10, cook: 15,
      protein: { ok: ['ground', 'chicken-breast', 'chicken-thigh', 'shrimp', 'tofu'] }, carb: { ok: ['rice', 'quinoa', 'tortilla', 'sweet-potato'], need: 'optional' },
      veg: { ok: ['bell-pepper', 'onion', 'jalapeno', 'tomato', 'spinach', 'garlic', 'zucchini'], min: 0, max: 4 },
      extras: ['oil', 'chili', 'lime', 'salsa', 'beans'], sauceOk: ['greek-yogurt'],
      name: (s) => (s.c && s.c.kind === 'tortilla' ? `${s.p.name} tacos${andVeg(s, ' with ')}` : `${s.p.name} burrito bowl${s.c ? ` with ${lower(s.c)}` : ''}`),
      steps: (s) => [
        s.c && carbCook(s.c),
        proteinCook(s.p, 'pan'),
        s.v.length ? `Add the ${vegList(s)} and the chili powder and cumin; cook 3–4 minutes until softened.` : 'Stir in the chili powder and cumin for 30 seconds.',
        'Squeeze in lime and season with salt.',
        s.c && s.c.kind === 'tortilla' ? 'Fill the warm tortillas and top with salsa.' : 'Pile everything into bowls and top with salsa (and beans, if you have them).',
        s.sauce && `Spoon on the ${lower(s.sauce)} as a high-protein “sour cream”.`,
      ],
    }),
    T({
      id: 'scramble', method: 'Skillet', prep: 5, cook: 10,
      protein: { ok: ['eggs'] }, second: { ok: ['cottage-cheese', 'ground', 'shrimp', 'chicken-breast', 'tofu'] }, carb: { ok: ['potato', 'sweet-potato', 'bread', 'tortilla'], need: 'optional' },
      veg: { ok: ['spinach', 'bell-pepper', 'mushroom', 'onion', 'tomato', 'jalapeno', 'zucchini', 'asparagus'], min: 0, max: 3 },
      extras: ['spray', 'salt'],
      name: (s) => `${s.p2 ? s.p2.name + ' & egg' : s.v.length ? 'Veggie egg' : 'Egg'} scramble${andVeg(s, ' with ')}${s.c ? (s.c.kind === 'tortilla' ? ' breakfast tacos' : s.c.kind === 'bread' ? ' on toast' : ` and ${lower(s.c)} hash`) : ''}`,
      steps: (s) => [
        s.c && (s.c.kind === 'starch' ? `Dice the ${lower(s.c)} small and pan-fry in a little oil for 10–12 minutes until tender and browned (or air-fry 15 minutes).` : carbCook(s.c)),
        s.p2 && s.p2.id !== 'cottage-cheese' && proteinCook(s.p2, 'pan'),
        vegStep(s, `Cook the ${vegList(s)} in a lightly oiled non-stick pan for 3–4 minutes.`),
        `Whisk the eggs${s.p2 && s.p2.id === 'cottage-cheese' ? ' with the cottage cheese (it makes them extra creamy and adds protein)' : ''} and pour into the pan; stir gently over medium-low heat until just set.`,
      ],
    }),
    T({
      id: 'sheet-pan-fajitas', method: 'Oven / air fryer', air: true, prep: 10, cook: 20,
      protein: { ok: ['chicken-breast', 'chicken-thigh', 'shrimp', 'tofu'] }, carb: { ok: ['tortilla', 'rice'], need: 'optional' },
      veg: { ok: ['bell-pepper', 'onion', 'jalapeno', 'zucchini', 'mushroom'], min: 1, max: 3 },
      extras: ['oil', 'chili', 'lime', 'salsa'], sauceOk: ['greek-yogurt', 'cottage-cheese'],
      name: (s) => `${s.p.name} fajitas with ${vegName(s)}`,
      steps: (s) => [
        `Slice the ${lower(s.p)} and the ${vegList(s)} into strips. Toss with oil, chili powder, cumin and salt.`,
        `Air-fry at 400°F (200°C) for ${s.p.id === 'shrimp' ? '8–10' : '14–16'} minutes, shaking halfway (or roast on a sheet pan at 425°F for ${s.p.id === 'shrimp' ? '10' : '20'} minutes).`,
        s.c && carbCook(s.c),
        'Finish with lime juice and serve with salsa.',
        s.sauce && `Top with the ${lower(s.sauce)}.`,
      ],
    }),
    T({
      id: 'grain-bowl', method: 'Bowl', prep: 10, cook: 15,
      protein: { ok: ['chicken-breast', 'chicken-thigh', 'salmon', 'shrimp', 'tofu', 'eggs', 'tuna'] }, carb: { ok: ['quinoa', 'rice', 'sweet-potato'], need: 'required' },
      veg: { ok: true, min: 1, max: 3 }, extras: ['oil', 'lemon', 'mustard', 'salt'], sauceOk: ['greek-yogurt'],
      name: (s) => `${s.p.name} ${one(s.c)} bowl with ${vegName(s)}`,
      steps: (s) => [
        carbCook(s.c),
        s.p.id === 'eggs' ? 'Soft-boil the eggs: 7 minutes in boiling water, then into cold water.' : proteinCook(s.p, AIR.includes(s.p.id) ? 'air' : 'pan'),
        `Sauté or roast the ${vegList(s)} (leafy greens can go in raw).`,
        `Whisk lemon juice, mustard, a little oil and salt${s.sauce ? ` into the ${lower(s.sauce)}` : ''} for the dressing.`,
        'Build the bowls and drizzle with the dressing.',
      ],
    }),
    T({
      id: 'fried-rice', method: 'Skillet', prep: 10, cook: 12,
      protein: { ok: ['eggs', 'shrimp', 'chicken-breast', 'chicken-thigh', 'tofu', 'ground'] }, second: { ok: ['eggs'] }, carb: { ok: ['rice', 'quinoa'], need: 'required' },
      veg: { ok: ['onion', 'garlic', 'bell-pepper', 'broccoli', 'bok-choy', 'mushroom', 'spinach', 'zucchini', 'jalapeno'], min: 0, max: 4 },
      extras: ['oil', 'soy', 'sesame', 'ginger'],
      name: (s) => `${s.p.id === 'eggs' ? 'Egg' : s.p.name} fried ${one(s.c)}${andVeg(s, ' with ')}`,
      steps: (s) => [
        `Use cold, cooked ${lower(s.c)} if you have it — it fries better. Otherwise cook it and spread it out to cool for 10 minutes.`,
        s.p.id !== 'eggs' && proteinCook(s.p, 'pan') + ' Set aside.',
        vegStep(s, `Stir-fry the ${vegList(s)} in a little oil over high heat for 3 minutes.`),
        `Push everything to the side, scramble ${s.p.id === 'eggs' || (s.p2 && s.p2.id === 'eggs') ? 'the eggs' : 'an egg (optional)'} in the gap, then add the ${lower(s.c)}.`,
        `Toss with soy sauce, ginger and a few drops of sesame oil until hot${s.p.id !== 'eggs' ? `; fold the ${lower(s.p)} back in` : ''}.`,
      ],
    }),
    T({
      id: 'meatballs', method: 'Air fryer', air: true, prep: 15, cook: 14,
      protein: { ok: ['ground'] }, carb: { ok: ['pasta', 'protein-pasta', 'rice', 'quinoa', 'bread'], need: 'optional' },
      veg: { ok: ['spinach', 'onion', 'garlic', 'zucchini', 'tomato', 'mushroom'], min: 0, max: 3 },
      extras: ['italian', 'garlicPowder', 'marinara', 'salt'],
      name: (s) => `Air-fryer ${lower(s.p)} meatballs${s.c ? ` with ${lower(s.c)}` : ''}`,
      steps: (s) => [
        s.v.some((v) => v.id !== 'tomato') ? `Finely chop the ${s.v.filter((v) => v.id !== 'tomato').map(lower).join(', ')} and mix into the ${lower(s.p)} with Italian seasoning and salt${has(s, 'zucchini') ? ' (grated zucchini keeps them juicy)' : ''}.` : `Mix the ${lower(s.p)} with Italian seasoning, garlic powder and salt.`,
        'Roll into 1½-inch balls and air-fry at 380°F (195°C) for 10–12 minutes, until 165°F (74°C) inside.',
        s.c && carbCook(s.c),
        `Warm the marinara${has(s, 'tomato') ? ' with the chopped tomato' : ''} and toss the meatballs in it.`,
      ],
    }),
    T({
      id: 'stuffed-potato', method: 'Air fryer', air: true, prep: 10, cook: 30,
      protein: { ok: ['ground', 'chicken-breast', 'tuna', 'cottage-cheese', 'greek-yogurt', 'tofu'] }, second: { ok: ['cottage-cheese', 'greek-yogurt'] }, carb: { ok: ['potato', 'sweet-potato'], need: 'required' },
      veg: { ok: ['spinach', 'broccoli', 'onion', 'bell-pepper', 'jalapeno', 'tomato', 'mushroom'], min: 0, max: 3 },
      extras: ['oil', 'chili', 'salt', 'cheese'],
      name: (s) => `Loaded ${one(s.c)} with ${lower(s.p)}${andVeg(s)}`,
      steps: (s) => [
        `Pierce the ${lower(s.c)}, microwave 5–6 minutes until soft, then air-fry at 400°F (200°C) for 8–10 minutes for crisp skin (or bake 45 minutes at 400°F).`,
        ['dairy'].includes(s.p.kind) ? `Season the ${lower(s.p)} with salt and pepper.` : proteinCook(s.p, 'pan'),
        s.v.length ? `Cook the ${vegList(s)} for 3–4 minutes${s.p.kind === 'ground' ? ' with the meat' : ''} and season with chili powder.` : 'Season the filling with chili powder.',
        `Split the potatoes, fill them up and top with ${s.p2 ? `a spoonful of ${lower(s.p2)} and ` : ''}a little cheese.`,
      ],
    }),
    T({
      id: 'tuna-melt', method: 'No-cook / toaster', prep: 8, cook: 5,
      protein: { ok: ['tuna', 'chicken-breast', 'eggs'] }, second: { ok: ['greek-yogurt', 'cottage-cheese'] }, carb: { ok: ['bread', 'tortilla'], need: 'optional' },
      veg: { ok: ['spinach', 'tomato', 'onion', 'bell-pepper', 'jalapeno'], min: 0, max: 3 },
      extras: ['mustard', 'lemon', 'salt', 'cheese'],
      name: (s) => `${s.p.id === 'eggs' ? 'Egg salad' : s.p.id === 'tuna' ? (s.c ? 'Tuna' : 'Tuna salad') : 'Chicken salad'}${s.c ? (s.c.kind === 'tortilla' ? ' wraps' : ' melt') : ' bowl'}${andVeg(s, ' with ')}`,
      steps: (s) => [
        s.p.id === 'eggs' ? 'Hard-boil the eggs (10 minutes), cool and chop.' : s.p.id === 'chicken-breast' ? proteinCook(s.p, 'air') + ' Let it cool, then chop.' : proteinCook(s.p),
        `Mix with ${s.p2 ? `the ${lower(s.p2)} (instead of mayo)` : 'a little mustard'}, lemon, salt and pepper${s.v.some((v) => v.id !== 'spinach') ? `, and the chopped ${s.v.filter((v) => v.id !== 'spinach').map(lower).join(', ')}` : ''}.`,
        !s.c ? `Serve it as is${has(s, 'spinach') ? ' over the spinach' : ''}, or spooned into lettuce leaves.` : s.c.kind === 'tortilla' ? `Spread over the tortillas${has(s, 'spinach') ? ', add the spinach' : ''} and roll up.` : `Pile onto the bread${has(s, 'spinach') ? ' with the spinach' : ''}, top with a little cheese and toast or broil until melted.`,
      ],
    }),
    T({
      id: 'chili', method: 'One pot', prep: 10, cook: 25,
      protein: { ok: ['ground', 'chicken-thigh', 'chicken-breast'] }, carb: { ok: ['rice', 'sweet-potato', 'potato', 'quinoa'], need: 'optional' },
      veg: { ok: ['onion', 'bell-pepper', 'jalapeno', 'tomato', 'garlic', 'zucchini', 'mushroom', 'spinach'], min: 2, max: 4 },
      extras: ['oil', 'chili', 'broth', 'beans', 'salt'], sauceOk: ['greek-yogurt'],
      name: (s) => `Quick ${lower(s.p)} chili with ${vegName(s)}`,
      steps: (s) => [
        proteinCook(s.p, 'pan'),
        `Add the ${vegList(s)} and the chili powder and cumin; cook 5 minutes.`,
        `Pour in the broth${s.c && s.c.kind === 'starch' ? ` and the diced ${lower(s.c)}` : ''} (and beans, if using). Simmer 15–20 minutes until thick.`,
        s.c && s.c.kind !== 'starch' && `Serve over the ${lower(s.c)}.`,
        s.sauce && `Top with a spoonful of ${lower(s.sauce)}.`,
      ],
    }),
    T({
      id: 'salmon-teriyaki', method: 'Air fryer', air: true, prep: 5, cook: 15,
      protein: { ok: ['salmon', 'tofu', 'chicken-thigh', 'shrimp'] }, carb: { ok: ['rice', 'quinoa'], need: 'optional' },
      veg: { ok: ['bok-choy', 'broccoli', 'asparagus', 'spinach', 'mushroom'], min: 0, max: 2 },
      extras: ['soy', 'honey', 'ginger', 'garlicPowder', 'sesame'],
      name: (s) => `Honey-soy glazed ${lower(s.p)}${s.v.length || s.c ? ' with ' : ''}${WT.listJoin(s.v.map(lower).concat(s.c ? [lower(s.c)] : []))}`,
      steps: (s) => [
        s.c && carbCook(s.c),
        'Stir together soy sauce, honey, ginger and garlic powder.',
        `Brush half the glaze over the ${lower(s.p)}. ${proteinCook(s.p, 'air')}`,
        vegStep(s, `Air-fry or steam the ${vegList(s)} for 5–7 minutes, then toss with sesame oil.`),
        'Spoon the rest of the glaze over everything.',
      ],
    }),
    T({
      id: 'lemon-shrimp-veg', method: 'Skillet', prep: 5, cook: 10, lowCarb: true,
      protein: { ok: ['shrimp', 'chicken-breast', 'salmon', 'tofu'] }, carb: { ok: ['quinoa', 'rice', 'protein-pasta', 'pasta'], need: 'optional' },
      veg: { ok: ['zucchini', 'asparagus', 'spinach', 'garlic', 'tomato', 'broccoli', 'mushroom', 'bok-choy'], min: 1, max: 3 },
      extras: ['oil', 'lemon', 'flakes', 'herbs', 'salt'],
      name: (s) => `Lemon-garlic ${lower(s.p)} with ${vegName(s)}${s.c ? ` over ${lower(s.c)}` : ''}`,
      steps: (s) => [
        s.c && carbCook(s.c),
        proteinCook(s.p, 'pan') + ' Transfer to a plate.',
        `Cook the ${vegList(s)} in the same pan for 3–5 minutes${has(s, 'zucchini') ? ' (cut the zucchini into half-moons or ribbons)' : ''}.`,
        `Return the ${lower(s.p)}, squeeze over the lemon and add red pepper flakes and herbs.`,
      ],
    }),
    T({
      id: 'soup', method: 'One pot', prep: 10, cook: 25,
      protein: { ok: ['chicken-breast', 'chicken-thigh', 'ground', 'tofu', 'shrimp'] }, carb: { ok: ['pasta', 'rice', 'potato', 'quinoa'], need: 'optional' },
      veg: { ok: true, min: 2, max: 4 }, extras: ['oil', 'broth', 'italian', 'lemon', 'salt'],
      name: (s) => `${s.p.name} & ${vegName(s)} soup`,
      steps: (s) => [
        `Soften the ${s.v.filter((v) => v.kind === 'aromatic').map(lower).join(' and ') || 'vegetables'} in a little oil for 3 minutes.`,
        `Add the broth (about 1½ cups per serving)${s.p.kind === 'ground' ? ` and the browned ${lower(s.p)}` : ` and the ${lower(s.p)}${s.p.id === 'shrimp' ? ' in the last 3 minutes' : ', whole'}`}, Italian seasoning and${s.c ? ` the ${lower(s.c)}` : ''} the remaining vegetables.`,
        `Simmer 15–20 minutes${s.p.kind === 'poultry' ? ', then shred the chicken with two forks' : ''}. Leafy greens go in at the end.`,
        'Finish with lemon and salt to taste.',
      ],
    }),
    T({
      id: 'pasta-salad', method: 'Cold / meal prep', prep: 15, cook: 10,
      protein: { ok: ['tuna', 'chicken-breast', 'eggs', 'shrimp', 'tofu'] }, second: { ok: ['greek-yogurt', 'cottage-cheese'] }, carb: { ok: ['protein-pasta', 'pasta', 'quinoa'], need: 'required' },
      veg: { ok: ['tomato', 'spinach', 'bell-pepper', 'onion', 'zucchini', 'broccoli', 'asparagus'], min: 1, max: 4 },
      extras: ['lemon', 'mustard', 'vinegar', 'herbs', 'salt'],
      name: (s) => `${s.p.name} ${one(s.c)} salad with ${vegName(s)}`,
      steps: (s) => [
        carbCook(s.c) + ' Rinse under cold water to cool.',
        s.p.id === 'eggs' ? 'Hard-boil and chop the eggs.' : s.p.id === 'tuna' ? 'Drain and flake the tuna.' : proteinCook(s.p, AIR.includes(s.p.id) ? 'air' : 'pan') + ' Cool and chop.',
        `Chop the ${vegList(s)}.`,
        `Whisk ${s.p2 ? `the ${lower(s.p2)} with ` : ''}lemon, mustard, vinegar, salt and pepper into a dressing and toss everything together. Keeps 3 days in the fridge.`,
      ],
    }),
    T({
      id: 'burger-bowl', method: 'Air fryer', air: true, prep: 10, cook: 20,
      protein: { ok: ['ground-beef', 'ground-turkey', 'ground-chicken'] }, carb: { ok: ['potato', 'sweet-potato'], need: 'optional' },
      veg: { ok: ['tomato', 'onion', 'spinach', 'jalapeno', 'mushroom', 'bell-pepper'], min: 0, max: 3 },
      extras: ['salt', 'mustard', 'garlicPowder', 'cheese'], sauceOk: ['greek-yogurt'],
      name: (s) => `Burger bowl with ${lower(s.p)}${s.c ? `${s.v.length ? ',' : ' and'} ${lower(s.c)} fries` : ''}${andVeg(s)}`,
      steps: (s) => [
        s.c && `Cut the ${lower(s.c)} into fries, toss with a little oil and salt, and air-fry at 400°F (200°C) for 18–20 minutes, shaking twice.`,
        `Season the ${lower(s.p)} with garlic powder, salt and pepper, form 2 thin patties per serving and sear 3–4 minutes per side (or crumble and brown).`,
        vegStep(s, `${has(s, 'onion') || has(s, 'mushroom') ? 'Cook the onions/mushrooms in the same pan until soft. ' : ''}Chop the rest of the vegetables.`),
        `Build the bowl and dress with mustard${s.sauce ? ` stirred into the ${lower(s.sauce)}` : ''}.`,
      ],
    }),
    T({
      id: 'quesadilla', method: 'Air fryer / skillet', air: true, prep: 8, cook: 10,
      protein: { ok: ['chicken-breast', 'chicken-thigh', 'ground', 'shrimp', 'tuna', 'eggs', 'tofu'] }, carb: { ok: ['tortilla'], need: 'required' },
      veg: { ok: ['spinach', 'bell-pepper', 'onion', 'jalapeno', 'mushroom', 'tomato', 'zucchini'], min: 0, max: 3 },
      extras: ['spray', 'cheese', 'chili', 'salsa'], sauceOk: ['greek-yogurt', 'cottage-cheese'],
      name: (s) => `${s.p.id === 'eggs' ? 'Egg' : s.p.name} quesadillas${andVeg(s, ' with ')}`,
      steps: (s) => [
        s.p.id === 'tuna' ? 'Drain the tuna and mix it with the chili powder.' : s.p.id === 'eggs' ? 'Scramble the eggs softly — they’ll finish cooking in the quesadilla.' : proteinCook(s.p, 'pan'),
        vegStep(s, `Cook the ${vegList(s)} for 3 minutes${s.p.kind === 'ground' ? ' with the meat' : ''}.`),
        `Fill half of each tortilla with the ${lower(s.p)}${s.v.length ? ', vegetables' : ''} and a little cheese; fold over.`,
        'Air-fry at 375°F (190°C) for 5–6 minutes, flipping halfway (or toast in a dry pan, 2–3 minutes per side), until crisp.',
        `Serve with salsa${s.sauce ? ` and the ${lower(s.sauce)} for dipping` : ''}.`,
      ],
    }),
    T({
      id: 'yogurt-chicken', method: 'Air fryer', air: true, prep: 10, cook: 16,
      protein: { ok: ['chicken-breast', 'chicken-thigh'] }, second: { ok: ['greek-yogurt'], required: true }, carb: { ok: ['rice', 'quinoa', 'tortilla', 'potato', 'sweet-potato'], need: 'optional' },
      veg: { ok: ['bell-pepper', 'onion', 'spinach', 'tomato', 'zucchini', 'garlic'], min: 0, max: 3 },
      extras: ['paprika', 'chili', 'lemon', 'garlicPowder', 'salt'],
      name: (s) => `Yogurt-marinated ${lower(s.p)}${s.v.length || s.c ? ' with ' : ''}${WT.listJoin(s.v.map(lower).concat(s.c ? [lower(s.c)] : []))}`,
      steps: (s) => [
        'Mix half the Greek yogurt with lemon juice, paprika, chili powder, garlic powder and salt. Coat the chicken (10 minutes is enough; overnight is better).',
        s.c && carbCook(s.c),
        proteinCook(s.p, 'air'),
        vegStep(s, `Air-fry or sauté the ${vegList(s)} for 6–8 minutes.`),
        'Stir lemon and salt into the remaining yogurt and serve it as a sauce.',
      ],
    }),
  ];

  /* ───────── Diets ───────── */
  M.DIETS = {
    vegetarian: { name: 'Vegetarian', no: ['meat', 'fish', 'shellfish'] },
    pescatarian: { name: 'Pescatarian', no: ['meat'] },
    'dairy-free': { name: 'Dairy-free', no: ['dairy'] },
    'gluten-free': { name: 'Gluten-free', no: ['gluten'] },
    'egg-free': { name: 'Egg-free', no: ['egg'] },
    'shellfish-free': { name: 'No shellfish', no: ['shellfish'] },
    'soy-free': { name: 'Soy-free', no: ['soy'] },
    'low-carb': { name: 'Lower carb', no: [], lowCarb: true },
  };

  /* ───────── Store ───────── */
  const S = () => (WT.db.meals = WT.db.meals || WT.freshMeals());
  M.all = function () {
    const st = S();
    const edits = st.edits || {};
    return M.BUILTIN.map((x) => Object.assign({}, x, edits[x.id] || {}, { builtin: true }))
      .concat(st.custom.map((x) => Object.assign({ kind: 'custom', tags: [], per: null }, x, { custom: true })))
      .filter((x) => !x.hidden);
  };
  M.get = (id) => M.all().find((x) => x.id === id) || null;
  M.unavailable = (id) => S().unavailable.includes(id);
  M.disliked = (id) => S().prefs.disliked.includes(id);
  const blockedTags = () => {
    const out = new Set();
    S().prefs.diets.forEach((d) => (M.DIETS[d] ? M.DIETS[d].no : []).forEach((t) => out.add(t)));
    return out;
  };
  M.lowCarb = () => S().prefs.diets.includes('low-carb');
  /** An ingredient you can use: not out of stock, not disliked, allowed by your diet. */
  M.usable = function (ing) {
    if (!ing || M.unavailable(ing.id) || M.disliked(ing.id)) return false;
    const no = blockedTags();
    return !(ing.tags || []).some((t) => no.has(t));
  };
  M.dietConflict = function (ing) {
    const no = blockedTags();
    const t = (ing.tags || []).find((x) => no.has(x));
    if (!t) return null;
    return Object.values(M.DIETS).find((d) => d.no.includes(t) && S().prefs.diets.some((k) => M.DIETS[k] === d)).name;
  };

  M.toggleSelect = function (id) {
    const st = S();
    if (st.selected.includes(id)) st.selected = st.selected.filter((x) => x !== id);
    else {
      st.selected.push(id);
      st.usage[id] = (+st.usage[id] || 0) + 1; // remembered so frequent picks rise to the top
    }
    WT.save();
  };
  M.toggleUnavailable = function (id) {
    const st = S();
    if (st.unavailable.includes(id)) st.unavailable = st.unavailable.filter((x) => x !== id);
    else {
      st.unavailable.push(id);
      st.selected = st.selected.filter((x) => x !== id);
    }
    WT.save();
  };
  M.toggleStaple = function (id) {
    const st = S();
    st.staples = st.staples.includes(id) ? st.staples.filter((x) => x !== id) : st.staples.concat(id);
    WT.save();
  };
  M.toggleDisliked = function (id) {
    const pr = S().prefs;
    pr.disliked = pr.disliked.includes(id) ? pr.disliked.filter((x) => x !== id) : pr.disliked.concat(id);
    S().selected = S().selected.filter((x) => !pr.disliked.includes(x));
    WT.save();
  };
  /** Frequently picked first (staples, then by how often you've selected them), then alphabetical. */
  M.sorted = function (cat) {
    const st = S();
    const score = (x) => (st.staples.includes(x.id) ? 1000 : 0) + (+st.usage[x.id] || 0);
    return M.all()
      .filter((x) => x.cat === cat)
      .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
  };
  M.frequent = function (limit) {
    const st = S();
    return M.all()
      .filter((x) => (st.staples.includes(x.id) || (+st.usage[x.id] || 0) >= 3) && M.usable(x))
      .sort((a, b) => (st.staples.includes(b.id) - st.staples.includes(a.id)) || (+st.usage[b.id] || 0) - (+st.usage[a.id] || 0))
      .slice(0, limit || 10);
  };
  M.search = function (q) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return null;
    return M.all().filter((x) => x.name.toLowerCase().includes(q) || (x.label || '').toLowerCase().includes(q));
  };
  /** Add or edit a custom ingredient; editing a built-in one stores only the changed name / label. */
  M.saveIngredient = function (form) {
    const st = S();
    const name = String(form.name || '').trim();
    if (!name) throw new Error('Give the ingredient a name');
    if (!M.CATS[form.cat]) throw new Error('Choose a category');
    const dup = M.all().find((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== form.id);
    if (dup) throw new Error(`${dup.name} is already on the list`);
    const b = M.BUILTIN.find((x) => x.id === form.id);
    if (b) {
      st.edits[b.id] = Object.assign({}, st.edits[b.id] || {}, { name });
      WT.save();
      return M.get(b.id);
    }
    const p = form.p === '' || form.p == null ? null : Math.max(0, +form.p || 0);
    const cal = form.cal === '' || form.cal == null ? null : Math.max(0, +form.cal || 0);
    const rec = { id: form.id || 'ing-' + WT.uid(), name, cat: form.cat, kind: 'custom', tags: Array.isArray(form.tags) ? form.tags.slice() : [], per: p != null || cal != null ? { n: 1, unit: 'serving', p: p || 0, cal: cal, c: null, f: null } : null };
    const i = st.custom.findIndex((x) => x.id === rec.id);
    if (i >= 0) st.custom[i] = rec;
    else st.custom.push(rec);
    WT.save();
    return rec;
  };
  M.deleteIngredient = function (id) {
    const st = S();
    if (M.BUILTIN.find((x) => x.id === id)) {
      delete st.edits[id];
    } else st.custom = st.custom.filter((x) => x.id !== id);
    ['selected', 'unavailable', 'staples'].forEach((k) => (st[k] = st[k].filter((x) => x !== id)));
    st.prefs.disliked = st.prefs.disliked.filter((x) => x !== id);
    WT.save();
  };

  /* ───────── Generation ───────── */
  const matches = (slot, ing) => {
    if (!slot || !ing) return false;
    if (slot.ok === true) return true;
    if (ing.custom) return slot.custom !== false; // your own ingredients fit any slot of their category
    return slot.ok.includes(ing.id) || slot.ok.includes(ing.kind);
  };
  const dislikedText = () => S().prefs.dislikedText.map((x) => String(x).toLowerCase().trim()).filter(Boolean);
  function extraAllowed(x) {
    const no = blockedTags();
    const words = dislikedText();
    if (words.some((w) => x.name.toLowerCase().includes(w))) return false;
    if (x.tags.some((t) => no.has(t))) return !!x.alt; // e.g. soy sauce → tamari when gluten-free
    return true;
  }
  const combos = (arr, k) => {
    const out = [];
    const rec = (start, cur) => {
      if (cur.length === k) return out.push(cur.slice());
      for (let i = start; i < arr.length; i++) {
        cur.push(arr[i]);
        rec(i + 1, cur);
        cur.pop();
      }
    };
    rec(0, []);
    return out;
  };
  const recipeKey = (tpl, s) => [tpl.id, s.p.id, s.p2 ? s.p2.id : '', s.c ? s.c.id : '', s.v.map((v) => v.id).sort().join('+'), s.sauce ? s.sauce.id : ''].join('|');

  /** Build a full recipe object for one template + ingredient choice. */
  M.build = function (tpl, s, servings) {
    servings = Math.max(1, +servings || 2);
    const amount = (ing, portion) => {
      const per = portion || ing.per;
      if (!per || per.n == null) return ing.cat === 'veg' ? 'a handful' : 'your usual portion';
      return M.fmtAmount(per.n * servings, per.unit);
    };
    const mine = [];
    const add = (ing, role, portion) => mine.push({ id: ing.id, name: ing.name, role, label: ing.label || '', amount: amount(ing, portion), m: portion ? { p: portion.p, cal: portion.cal, c: portion.c, f: portion.f } : ing.per ? { p: ing.per.p, cal: ing.per.cal, c: ing.per.c, f: ing.per.f } : null });
    add(s.p, 'protein');
    // A second protein is a supporting amount: a dairy "sauce" portion, or half a portion of anything else
    if (s.p2) add(s.p2, 'protein', s.p2.sauce ? Object.assign({}, s.p2.sauce, { unit: s.p2.per.unit }) : s.p2.per ? { n: s.p2.per.n / 2, unit: s.p2.per.unit, p: s.p2.per.p / 2, cal: s.p2.per.cal == null ? null : s.p2.per.cal / 2, c: (s.p2.per.c || 0) / 2, f: (s.p2.per.f || 0) / 2 } : null);
    if (s.c) add(s.c, 'carb');
    s.v.forEach((v) => add(v, 'veg'));
    if (s.sauce) add(s.sauce, 'protein', Object.assign({}, s.sauce.sauce, { unit: s.sauce.per.unit }));
    const no = blockedTags();
    const extras = (tpl.extras || [])
      .map((k) => M.EXTRAS[k])
      .filter(Boolean)
      .filter(extraAllowed)
      .map((x) => {
        const sub = x.tags.some((t) => no.has(t)) && x.alt;
        return { id: x.id, name: sub ? `${x.name} → use ${x.alt}` : x.name, amount: x.n != null ? M.fmtAmount(x.n * servings, x.unit) : x.unit, m: x.m };
      });
    // Macros per serving: your ingredients' portions + the pantry additions that carry calories
    const tot = { p: 0, cal: 0, c: 0, f: 0 };
    let unknown = [];
    mine.concat(extras).forEach((x) => {
      if (!x.m) {
        if (mine.includes(x)) unknown.push(x.name);
        return;
      }
      tot.p += +x.m.p || 0;
      tot.cal += +x.m.cal || 0;
      tot.c += +x.m.c || 0;
      tot.f += +x.m.f || 0;
    });
    const steps = tpl.steps(s).filter(Boolean);
    return {
      key: recipeKey(tpl, s),
      tpl: tpl.id,
      name: tpl.name(s).replace(/\s+/g, ' ').replace(/^./, (c) => c.toUpperCase()),
      method: tpl.method,
      airFryer: !!tpl.air,
      prep: tpl.prep,
      cook: tpl.cookFor ? tpl.cookFor(s) : tpl.cook,
      servings,
      mine,
      extras,
      steps,
      macros: { p: Math.round(tot.p), cal: Math.round(tot.cal / 10) * 10, c: Math.round(tot.c), f: Math.round(tot.f) },
      unknown,
      uses: mine.map((x) => x.id),
    };
  };

  /**
   * Meal ideas from the selected ingredients.
   * Every template is tried with every sensible combination of your selection; candidates are scored for
   * protein per serving, how many of your ingredients they use, simplicity (time), air-fryer fit and novelty,
   * then a varied set is drawn: no two ideas from the same template, and the protein and method rotate.
   * opts: { count, exclude: [keys] (e.g. ideas already shown), seed }
   * Returns { ideas, reason } — reason explains an empty result.
   */
  M.generate = function (opts) {
    opts = opts || {};
    const st = S();
    const count = opts.count || 4;
    const servings = st.prefs.servings || 2;
    const lowCarb = M.lowCarb();
    const sel = st.selected.map(M.get).filter(Boolean).filter(M.usable);
    const P = sel.filter((x) => x.cat === 'protein');
    const C = lowCarb ? [] : sel.filter((x) => x.cat === 'carb');
    const Vg = sel.filter((x) => x.cat === 'veg');
    if (!sel.length) return { ideas: [], reason: 'Pick a few ingredients you have, and Forge will suggest meals.' };
    if (!P.length) return { ideas: [], reason: 'Add a protein — every idea is built around one.' };
    const exclude = new Set(opts.exclude || []);
    const avoidTpl = new Set(opts.avoidTpl || []);
    const recent = st.recent || [];
    const recentTpl = {};
    recent.slice(-24).forEach((r, i, a) => (recentTpl[r.tpl] = (recentTpl[r.tpl] || 0) + (i >= a.length - 8 ? 1 : 0.4)));
    const favKeys = new Set(st.favorites.map((f) => f.key));
    const maxTime = +st.prefs.maxTime || 0;
    const rnd = opts.rnd || Math.random;
    const cands = [];
    M.TEMPLATES.forEach((tpl) => {
      if (maxTime && tpl.prep + tpl.cook > maxTime) return;
      const prots = P.filter((x) => matches(tpl.protein, x));
      if (!prots.length) return;
      const carbs = C.filter((x) => matches(tpl.carb, x));
      if (tpl.carb.need === 'required' && !carbs.length) return;
      if (lowCarb && tpl.carb.need === 'required') return;
      const vegs = Vg.filter((x) => matches(tpl.veg, x));
      const vmin = tpl.veg.min || 0;
      if (vegs.length < vmin) return;
      const carbOpts = tpl.carb.need === 'required' ? carbs : carbs.length ? carbs.concat(tpl.carb.need === 'none' ? [] : [null]) : [null];
      const vmax = Math.min(tpl.veg.max || 3, vegs.length);
      // Vegetable sets: all of them when few, otherwise sets of size vmin..vmax
      let vegSets = [];
      for (let k = Math.max(vmin, Math.min(vmax, 1)); k <= vmax; k++) vegSets = vegSets.concat(combos(vegs, k));
      if (!vegSets.length && vmin === 0) vegSets = [[]];
      if (vegSets.length > 24) vegSets = WT.shuffle(vegSets).slice(0, 24);
      prots.forEach((p) => {
        const seconds = tpl.second ? P.filter((x) => x.id !== p.id && matches(tpl.second, x)) : [];
        if (tpl.second && tpl.second.required && !seconds.length) return;
        const p2opts = seconds.length ? seconds.concat(tpl.second.required ? [] : [null]) : [null];
        const sauces = tpl.sauceOk ? P.filter((x) => x.id !== p.id && tpl.sauceOk.includes(x.id)) : [];
        carbOpts.forEach((c) =>
          vegSets.forEach((v) =>
            p2opts.forEach((p2) => {
              const s = { p, p2, c, v, sauce: !p2 && sauces.length ? sauces[0] : null };
              const key = recipeKey(tpl, s);
              if (exclude.has(key)) return;
              cands.push({ tpl, s, key });
            })
          )
        );
      });
    });
    if (!cands.length && P.every((x) => x.kind === 'dairy')) {
      return { ideas: [], reason: `${WT.listJoin(P.map((x) => x.name))} works best as a sauce or side in these recipes — add another protein (eggs, chicken, tuna…), or pasta or potatoes to build a meal around it.` };
    }
    if (!cands.length) {
      const why = st.unavailable.length || st.prefs.disliked.length || st.prefs.diets.length ? ' with your diet, dislikes and out-of-stock items' : '';
      return { ideas: [], reason: `No bundled recipe fits this combination${why}. Try adding a vegetable or a carbohydrate — or a different protein.` };
    }
    // Score
    const air = st.prefs.airFryer !== false;
    cands.forEach((x) => {
      const r = M.build(x.tpl, x.s, 1);
      x.protein = r.macros.p;
      const used = r.uses.length;
      let sc = Math.min(45, r.macros.p) / 5; // protein-forward, without rewarding excess
      sc += used * 1.1; // uses what you have
      sc -= (x.tpl.prep + x.tpl.cook) / 15; // simple and quick
      if (air && x.tpl.air) sc += 1;
      if (!air && x.tpl.air && x.tpl.method === 'Air fryer') sc -= 1.5;
      if (x.s.c) sc += 0.6;
      sc -= (recentTpl[x.tpl.id] || 0) * 1.2; // variety over time
      if (favKeys.has(x.key)) sc -= 1; // favorites are in Saved already — show something new
      if (avoidTpl.has(x.tpl.id)) sc -= 6; // "Different ideas": prefer other recipes, not just other combinations
      x.score = sc + rnd() * 2.2;
    });
    cands.sort((a, b) => b.score - a.score);
    // Diverse pick: one per template; spread proteins and methods
    const out = [];
    const usedTpl = new Set();
    const usedDish = new Set(); // same ingredients cooked the same way = near-identical meal; show only one
    const dishKey = (x) => [x.s.p.id, x.s.p2 ? x.s.p2.id : '', x.s.c ? x.s.c.id : '', x.s.v.map((v) => v.id).sort().join('+'), x.tpl.method].join('|');
    const pCount = {};
    const mCount = {};
    for (let pass = 0; pass < 2 && out.length < count; pass++) {
      for (const x of cands) {
        if (out.length >= count) break;
        if (usedTpl.has(x.tpl.id) || usedDish.has(dishKey(x))) continue;
        if (pass === 0 && ((pCount[x.s.p.id] || 0) >= Math.ceil(count / Math.max(1, P.length)) || (mCount[x.tpl.method] || 0) >= 2)) continue;
        out.push(x);
        usedTpl.add(x.tpl.id);
        usedDish.add(dishKey(x));
        pCount[x.s.p.id] = (pCount[x.s.p.id] || 0) + 1;
        mCount[x.tpl.method] = (mCount[x.tpl.method] || 0) + 1;
      }
    }
    const ideas = out.map((x) => M.build(x.tpl, x.s, servings));
    st.recent = recent.concat(ideas.map((r) => ({ tpl: r.tpl, key: r.key, at: new Date().toISOString() }))).slice(-40);
    WT.save();
    return { ideas, reason: null, total: cands.length };
  };

  M.isFavorite = (key) => S().favorites.some((f) => f.key === key);
  M.toggleFavorite = function (recipe) {
    const st = S();
    if (M.isFavorite(recipe.key)) st.favorites = st.favorites.filter((f) => f.key !== recipe.key);
    else st.favorites.unshift(Object.assign({}, JSON.parse(JSON.stringify(recipe)), { savedAt: new Date().toISOString() }));
    WT.save();
    return M.isFavorite(recipe.key);
  };
  /** Rebuild a saved recipe at another serving count (saved recipes keep their original text). */
  M.rescale = function (recipe, servings) {
    const parts = recipe.key.split('|');
    const tpl = M.TEMPLATES.find((t) => t.id === parts[0]);
    const g = (id) => (id ? M.get(id) : null);
    const s = { p: g(parts[1]), p2: g(parts[2]), c: g(parts[3]), v: (parts[4] ? parts[4].split('+') : []).map(g).filter(Boolean), sauce: g(parts[5]) };
    if (!tpl || !s.p) return null;
    return M.build(tpl, s, servings);
  };

  /* ───────── Formatting ───────── */
  const FR = [[0.25, '¼'], [0.33, '⅓'], [0.5, '½'], [0.67, '⅔'], [0.75, '¾']];
  M.fmtQty = function (n) {
    if (n == null) return '';
    const whole = Math.floor(n + 1e-6);
    const frac = n - whole;
    if (frac < 0.12) return String(whole || (n > 0 ? '¼' : '0'));
    if (frac > 0.88) return String(whole + 1);
    const f = FR.reduce((b, x) => (Math.abs(x[0] - frac) < Math.abs(b[0] - frac) ? x : b), FR[0]);
    return (whole ? whole + ' ' : '') + f[1];
  };
  M.fmtAmount = function (n, unit) {
    if (n == null) return unit || '';
    let u = unit || '';
    // oz over a pound reads better in pounds; tsp over 3 → tbsp
    // Pounds only for exact quarter-pounds (20 oz is 1 ¼ lb; 18 oz stays "18 oz" rather than being rounded)
    if (u === 'oz' && n >= 16 && Math.abs(n / 4 - Math.round(n / 4)) < 1e-6) return `${M.fmtQty(n / 16)} lb (≈${Math.round(n * 28.35 / 10) * 10} g)`;
    if (u === 'oz') return `${Math.round(n * 10) / 10} oz (≈${Math.round(n * 28.35 / 5) * 5} g)`;
    if (u === 'tsp' && n >= 3) return `${M.fmtQty(n / 3)} tbsp`;
    if (u === 'can' && n !== 1) u = 'cans';
    if (/^cup\b/.test(u) && n > 1.1) u = u.replace(/^cup/, 'cups');
    if (u === 'pepper' && n > 1) u = 'peppers';
    if (u === 'onion' && n > 1) u = 'onions';
    if (u === 'lemon' && n > 1) u = 'lemons';
    if (u === 'lime' && n > 1) u = 'limes';
    if (u === 'pepper' && n < 1) return `${M.fmtQty(n)} pepper`;
    return `${M.fmtQty(n)} ${u}`.trim();
  };
  M.totalTime = (r) => r.prep + r.cook;
})();
