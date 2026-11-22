# Branded product recognition: audit and redesign

## What the audit found (before)

Branded matching only knew products that had nutrition data, 23 bundled products. A brand name pulled in that brand's nearest product with data, even when the words said otherwise.

| Input | Before | Problem |
|---|---|---|
| Barilla chickpea pasta | Barilla **Protein+** | Wrong product line, silently |
| Barilla spaghetti | Barilla **Protein+** | Wrong product line, silently |
| barilla protein plus rotini | Protein+ **and** cooked pasta | “plus” treated as “and” |
| Oscar Mayer turkey bacon | Deli Fresh **oven roasted turkey** | Wrong product line, silently |
| Oscar Mayer turkey | Oven roasted turkey | Oscar Mayer makes four turkeys |
| Rao’s sauce | Marinara | Rao’s makes about a dozen sauces |
| half a 32 oz jar of Rao’s marinara | **0.5 oz** (11 cal) | Package size read as a quantity |
| Pioneer Pastures strawberries & cream shake | 160 cal | The source confirms only protein for that flavor: calories copied from Vanilla |
| Premier protein shake (any flavor) | Chocolate’s carbs and fat | Only protein and calories are confirmed per flavor |
| 2 Ball Park hot dogs | Generic hot dog | Brand known, product not: should ask |
| Fage total 0% | Not recognized | Brand known, nothing offered |
| Fage triple zero | Offered **Oikos** | Wrong brand |
| Chobani greek yogurt | Only “Complete” offered | Most Chobani yogurts missing |
| a tub of Oikos Triple Zero | 1 single cup | A tub is the 32 oz tub |

## The redesign: brand → product line → variant → flavor → package size

**`js/brands.js`, the brand catalog.** It describes 55 brands and their 204 product lines, with no nutrition. For each line it records:
- the phrases that identify it;
- **variants** that are different products with different labels (Thin-Sliced, Sensitive Formula, Elite, 2% singles);
- the **flavors** it comes in;
- whether flavors have materially different labels (`flavorMatters`);
- **package sizes** (net grams);
- links to the bundled products that do have label data.

**Matching rules** (`js/nutrition.js`):
1. **A product pick must agree with what you typed.** It's rejected, and Forge asks instead, when any of these hold:
   - the words point to another line of the brand;
   - you named a variant the product isn't;
   - you named a flavor the product isn't (“Triple Zero **plain**”);
   - you named another brand (“**Fage** triple zero”);
   - only the brand was named and it makes several lines.
2. **Shared words narrow the choice but never decide it.** “turkey” fits four Oscar Mayer lines, so it lists those four.
3. **Two readings, and the clearer one wins.** Forge reads the words as line words first and as flavor words first. It keeps whichever singles out one line: “fairlife **chocolate milk**” is a line, while “Quest **cookies and cream** bar” is a flavor of the bar. Flavors are named the way the brand names them (“Cookies & Cream”).
4. **Brand recognized, product unknown → ask.** The question lists:
   - your own products of that brand, first;
   - bundled products with labels;
   - the brand’s other lines, marked *No label saved yet*. Choosing one offers **Search online** (prefilled), **Enter it from the label** (prefilled brand, line, flavor and unit) or a labelled **generic estimate**. Your choice is remembered for the same words.
5. **Never borrow numbers.**
   - A flavor keeps only the values its source confirms. Unconfirmed values stay blank and the note says so.
   - Using another flavor’s values is offered only as an explicitly labelled estimate.
   - With no flavor typed, a line whose flavors share their key values uses the listed flavor and says so (“Flavor not given — values for Vanilla”, Close match, never Exact). A `flavorMatters` line (Quest bars) asks.
6. **Package sizes.**
   - “a 32 oz jar” is read as a package with that net weight, then net weight ÷ serving weight gives the servings.
   - “a jar” with no size uses the line’s usual size, marked *assumed*. The review screen lists every size as a unit to choose from.
7. **Your own products work the same way.** Products you save from a label keep their brand, line, flavor, barcode and package size (“1 loaf = 18 slices”). They stay linked to their catalog line, so “Dave’s Killer Bread white bread” finds your saved White Bread Done Right, while “Dave’s Killer Bread good seed” still asks. If the brand has no other products on the device, naming it finds the one you saved (“1 tbsp jif”).
8. **Brand names made of number words or digits stay names** (“Two Good”, “ONE bar”, “21 Whole Grains”, Rao’s “Four Cheese”).

## Results (after)

| Input | Now |
|---|---|
| Pioneer Pastures snickerdoodle protein shake | Asks: Pioneer Pastures A2 Protein Shake · Vanilla (as estimate); Pioneer Pastures A2 Protein Shake · Snickerdoodle (no label yet) |
| Pioneer Pastures strawberries and cream shake | Pioneer Pastures A2 Protein Shake · Strawberries & Cream · 1 bottle · — cal · Exact match |
| Oikos Triple Zero | Oikos Triple Zero Greek Nonfat Yogurt · Vanilla · 1 cup · 80 cal · Close match (flavor not given) |
| Oikos Triple Zero mixed berry | Asks: Oikos Triple Zero Greek Nonfat Yogurt · Vanilla (as estimate); Oikos Triple Zero · Mixed Berry (no label yet) |
| a 32 oz tub of Oikos Triple Zero | Oikos Triple Zero Greek Nonfat Yogurt · Vanilla · 1 tub (32 oz) · 484 cal · Close match (flavor not given) |
| Oikos Pro Drink | Asks: Oikos Pro Drink (no label yet) |
| Fage triple zero | Asks: Fage Total 0% (no label yet); Fage Total 2% (no label yet); Fage Total 5% (no label yet); Fage Total Split Cup (no label yet) |
| Barilla Protein+ | Barilla Protein+ Pasta · 1 serving · 350 cal · Exact item · estimated values |
| barilla protein plus rotini | Barilla Protein+ Pasta · 1 serving · 350 cal · Exact item · estimated values |
| Barilla chickpea pasta | Asks: Barilla Chickpea Pasta (no label yet) |
| Barilla spaghetti | Asks: Barilla Classic Blue Box (no label yet) |
| Dave’s Killer Bread 21 whole grains | Dave's Killer Bread 21 Whole Grains and Seeds · 1 slice · 110 cal · Exact item · estimated values |
| Dave’s Killer Bread white bread | Asks: Dave's Killer Bread White Bread Done Right (no label yet) |
| Dave’s Killer Bread thin sliced 21 whole grains | Asks: Dave's Killer Bread 21 Whole Grains and Seeds · Thin-Sliced (no label yet) |
| Oscar Mayer oven roasted turkey | Oscar Mayer Deli Fresh Oven Roasted Turkey Breast · 1 serving · 50 cal · Exact item · estimated values |
| Oscar Mayer turkey | Asks: Oscar Mayer Deli Fresh Oven Roasted Turkey Breast; Oscar Mayer Deli Fresh Smoked Turkey Breast (no label yet); Oscar Mayer Deli Fresh Honey Smoked Turkey Breast (no label yet); Oscar Mayer Deli Fresh Mesquite Turkey Breast (no label yet) |
| Oscar Mayer turkey bacon | Asks: Oscar Mayer Turkey Bacon (no label yet) |
| Oscar Mayer honey ham | Oscar Mayer Deli Fresh Honey Ham · 1 serving · 60 cal · Exact item · estimated values |
| Rao’s marinara | Rao's Homemade Marinara Sauce · 1 serving · 100 cal · Exact item · estimated values |
| Rao’s sauce | Asks: Rao's Homemade Marinara Sauce; Rao's Arrabbiata Sauce; Rao's Tomato Basil (no label yet); Rao's Vodka Sauce (no label yet); … |
| Rao’s vodka sauce | Asks: Rao's Vodka Sauce (no label yet) |
| half a 32 oz jar of Rao’s marinara | Rao's Homemade Marinara Sauce · ½ jar (32 oz) · 363 cal · Exact item · estimated values |
| 2 Ball Park hot dogs | Asks: Ball Park Beef Franks (no label yet); Ball Park Classic Franks (no label yet); Ball Park Turkey Franks (no label yet); Ball Park Bun Size (no label yet) |
| Chobani greek yogurt | Asks: Chobani Complete Greek Yogurt · Vanilla; Chobani Complete Greek Yogurt Drink · Vanilla; Chobani Greek Yogurt (nonfat plain) (no label yet); Chobani Greek Yogurt (flavored) (no label yet); … |
| Fage total 0% | Asks: Fage Total 0% (no label yet) |
| Quest bar | Asks: Quest Protein Bar · Chocolate Chip Cookie Dough; Quest Protein Bar (no label yet) |
| fairlife milk | Asks: fairlife Ultra-Filtered Milk · 2% Reduced Fat; fairlife Ultra-Filtered Milk Whole (no label yet); fairlife Ultra-Filtered Milk Fat Free (no label yet); fairlife Ultra-Filtered Chocolate Milk (no label yet) |
| Kirkland protein bar | Asks: Kirkland protein bar (no label yet) |


## Tests

`node tests/brands.test.js`: 1,251 assertions, most of them **generated from the catalog**. They cover every brand and line, the distinctive phrase for every line that has data, every variant, every listed flavor, every package size, brand-only inputs, and cross-brand pairs. The invariant throughout: a product is picked only when what you typed identifies it; otherwise Forge asks, and an incorrect product is never silently substituted. The suite also covers the examples above, generic words that must stay generic, and saving custom branded products (line linking, package sizes, your own brands and flavors, learned shorthand).

The browser test (`tests/scan.test.js`) covers the full flow: a recognized product with no label → *Enter it from the label* → saved and logged → found directly next time, and a different line still asks. It also covers *Search online* (mocked) for an unlisted flavor.

## Limits

- The catalog lists product names, not nutrition. Most lines show *No label saved yet* until you enter the label or find the product online. That is deliberate: no numbers are invented.
- Flavor lists cover common flavors. An unlisted flavor still asks and can be added from the label.
- Package sizes are only listed where they’re standard (Rao’s jars, Oikos tubs, Barilla boxes). Otherwise, type the size (“a 15.5 oz jar”) or set the package on your saved product.
