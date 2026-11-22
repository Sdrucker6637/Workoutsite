#!/usr/bin/env node
/* Build Forge's offline USDA database from FoodData Central's free bulk downloads.
 *
 *   1. Download the JSON files (public domain) from https://fdc.nal.usda.gov/download-datasets :
 *        "SR Legacy" (≈7,800 foods) and/or "Foundation Foods" (≈300+ lab-analyzed foods).
 *   2. Unzip, then run:   node tools/build-usda.js path/to/FoodData_Central_sr_legacy_food_json_*.json [path/to/foundation.json …]
 *   3. Commit js/data/usda.json. Forge loads it the first time you search, caches it with the app shell, and lists its
 *      foods as "USDA reference (offline)". Nothing else changes; without the file Forge simply doesn't show them.
 *
 * Output per food: [fdcId, description, kcal, protein, carbs, fat, category, [[portion label, grams], …]] per 100 g.
 * Foods without protein or energy are skipped (never filled in). Energy uses nutrient 1008 (kcal), else the
 * Atwater values 2047/2048 that Foundation Foods report.
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'js', 'data', 'usda.json');
const r1 = (v) => (v == null || isNaN(v) ? null : Math.round(v * 10) / 10);

function nutrient(f, ids, nums) {
  for (const n of f.foodNutrients || []) {
    const id = n.nutrient ? n.nutrient.id : n.nutrientId;
    const no = n.nutrient ? String(n.nutrient.number) : String(n.nutrientNumber || '');
    const unit = String((n.nutrient && n.nutrient.unitName) || n.unitName || '').toLowerCase();
    if ((ids.includes(id) || nums.includes(no)) && (ids[0] !== 1008 || unit !== 'kj')) {
      const v = n.amount != null ? n.amount : n.value;
      if (v != null && !isNaN(+v)) return +v;
    }
  }
  return null;
}
function portions(f) {
  const out = [];
  (f.foodPortions || []).forEach((p) => {
    const g = +p.gramWeight;
    if (!(g > 0)) return;
    const unit = p.measureUnit && p.measureUnit.name && p.measureUnit.name !== 'undetermined' ? p.measureUnit.name : '';
    // Foundation foods describe the portion in full ("1 cup, chopped"); SR Legacy splits it into amount + unit + modifier
    let label = p.portionDescription && !/^quantity not specified/i.test(p.portionDescription) ? String(p.portionDescription) : [p.amount != null ? p.amount : '', unit, p.modifier || ''].filter((x) => x !== '' && x != null).join(' ').trim();
    if (!label || /quantity not specified/i.test(label)) return;
    out.push([label.slice(0, 60), r1(g)]);
  });
  return out.slice(0, 6);
}
function convert(files) {
  const foods = [];
  const seen = new Set();
  files.forEach((file) => {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    const list = j.SRLegacyFoods || j.FoundationFoods || j.SurveyFoods || j.foods || [];
    const kind = j.SRLegacyFoods ? 'SR Legacy' : j.FoundationFoods ? 'Foundation' : j.SurveyFoods ? 'FNDDS' : 'FDC';
    list.forEach((f) => {
      if (!f.fdcId || !f.description || seen.has(f.fdcId)) return;
      const cal = nutrient(f, [1008, 2047, 2048], ['208', '957', '958']);
      const p = nutrient(f, [1003], ['203']);
      if (cal == null && p == null) return;
      seen.add(f.fdcId);
      foods.push([f.fdcId, f.description, r1(cal), r1(p), r1(nutrient(f, [1005], ['205'])), r1(nutrient(f, [1004], ['204'])), (f.foodCategory && f.foodCategory.description) || (f.wweiaFoodCategory && f.wweiaFoodCategory.wweiaFoodCategoryDescription) || kind, portions(f)]);
    });
  });
  return { v: 1, source: 'USDA FoodData Central (public domain) — ' + files.map((f) => path.basename(f)).join(', '), built: new Date().toISOString().slice(0, 10), fields: ['fdcId', 'description', 'kcal', 'protein', 'carbs', 'fat', 'category', 'portions'], per: '100 g', foods };
}

if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('Usage: node tools/build-usda.js <FoodData Central JSON> [more files]');
    process.exit(1);
  }
  const db = convert(files);
  fs.writeFileSync(OUT, JSON.stringify(db));
  console.log(`Wrote ${db.foods.length} foods to ${path.relative(process.cwd(), OUT)} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
}
module.exports = { convert };
