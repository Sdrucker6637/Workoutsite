/* Browser test: food search (local + mocked online services) and barcode scanning.
 * Uses Chromium's fake camera; USDA and Open Food Facts are mocked (no live network).   node tests/scan.test.js */
const { chromium } = require('playwright');
const { URL, serve } = require('./serve');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };

const OFF_PRODUCT = { status: 1, product: { code: '0076808280531', product_name: 'Protein+ Penne', brands: 'Barilla', serving_size: '56 g', serving_quantity: 56, nutriments: { 'energy-kcal_100g': 357, proteins_100g: 17.9, carbohydrates_100g: 66, fat_100g: 2.7 } } };
const FDC = { foods: [{ fdcId: 2346384, description: 'OIKOS PRO DRINK VANILLA', dataType: 'Branded', brandName: 'OIKOS', gtinUpc: '036632075109', servingSize: 207, servingSizeUnit: 'ml', householdServingFullText: '1 bottle', foodNutrients: [{ nutrientId: 1008, unitName: 'KCAL', value: 67.6 }, { nutrientId: 1003, unitName: 'G', value: 11.1 }, { nutrientId: 1005, unitName: 'G', value: 2.4 }, { nutrientId: 1004, unitName: 'G', value: 0.97 }] }] };
const SAL = { hits: [{ code: '0036632037008', product_name: 'Triple Zero Blended Mixed Berry', brands: 'Oikos', serving_size: '1 container (150 g)', serving_quantity: 150, nutriments: { 'energy-kcal_100g': 60, proteins_100g: 10, carbohydrates_100g: 5, fat_100g: 0 } }] };

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, permissions: ['camera'] });
  await serve(ctx);
  const net = { fdc: 'ok', calls: [] };
  await ctx.route('https://api.nal.usda.gov/**', (r) => { net.calls.push(r.request().url()); return net.fdc === 429 ? r.fulfill({ status: 429, body: '{}', headers: { 'access-control-allow-origin': '*' } }) : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(FDC) }); });
  await ctx.route('https://search.openfoodfacts.org/**', (r) => { net.calls.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(SAL) }); });
  await ctx.route('https://world.openfoodfacts.org/**', (r) => { const u = r.request().url(); net.calls.push(u); return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(u.includes('0076808280531') ? OFF_PRODUCT : { status: 0 }) }); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  const nut = () => page.evaluate(() => JSON.parse(JSON.stringify(WT.db.nutrition)));
  await page.goto(URL);
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.goto(URL + '#/food'); await page.waitForTimeout(200);

  console.log('Barcode decoding (ZXing, used where the browser has no BarcodeDetector)');
  const decoded = await page.evaluate(async () => {
    delete window.BarcodeDetector;
    const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
    const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
    const R = L.map((s) => s.replace(/./g, (b) => (b === '0' ? '1' : '0')));
    const PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
    const draw = (code) => {
      const d = code.split('').map(Number);
      let bits = '101';
      for (let i = 1; i <= 6; i++) bits += (PAR[d[0]][i - 1] === 'L' ? L : G)[d[i]];
      bits += '01010';
      for (let i = 7; i <= 12; i++) bits += R[d[i]];
      bits += '101';
      const c = document.createElement('canvas');
      c.width = bits.length * 4 + 80; c.height = 160;
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#000';
      bits.split('').forEach((b, i) => b === '1' && g.fillRect(40 + i * 4, 20, 4, 120));
      return c;
    };
    const dec = await WT.scanDecoder();
    return { name: dec.name, a: await dec.detect(draw('0076808280531')), b: await dec.detect(draw('5901234123457')) };
  });
  ok(decoded.name === 'zxing' && (await page.evaluate((a) => WT.lookup.sameCode(a, '0076808280531'), decoded.a)) && decoded.b === '5901234123457', `decodes EAN-13 from an image; a leading-0 code comes back as its UPC-A form (${JSON.stringify(decoded)})`);

  console.log('Camera');
  await page.click('[data-act="foodScan"]');
  await page.waitForSelector('#scanVideo');
  await page.waitForFunction(() => { const v = document.getElementById('scanVideo'); return v && v.videoWidth > 0; }, null, { timeout: 8000 }).catch(() => {});
  ok(await page.evaluate(() => document.getElementById('scanVideo').videoWidth > 0), 'camera stream starts (fake device)');
  ok(/Hold the barcode/.test(await page.textContent('#scanMsg')), 'tells you how to scan');
  await page.click('.sheet [data-act="closeSheet"]');
  await page.waitForTimeout(150);
  ok(await page.evaluate(() => !document.querySelector('#scanVideo')), 'closing the scanner stops it');

  console.log('Manual entry → found on Open Food Facts → diary');
  await page.click('[data-act="foodScan"]');
  await page.waitForSelector('#scanCode');
  await page.fill('#scanCode', '0076808280532'); await page.dispatchEvent('#scanCode', 'input');
  await page.click('.sheet [data-act="scanManual"]');
  await page.waitForTimeout(150);
  ok(/valid barcode/.test(await page.textContent('#toasts')), 'a wrong check digit is caught before any lookup');
  await page.fill('#scanCode', '0076808280531'); await page.dispatchEvent('#scanCode', 'input');
  await page.click('.sheet [data-act="scanManual"]');
  await page.waitForSelector('.scan-found');
  const card = await page.textContent('.scan-found');
  ok(/Protein\+ Penne/.test(card) && /Open Food Facts/.test(card) && /Estimate/.test(card) && /Per 100 g: 357 cal/.test(card), 'product shown with source, status and per-100 g values');
  ok(/Community data/.test(card), 'community data flagged to check against the label');
  await page.click('.sheet [data-act="scanAdd"]');
  await page.waitForSelector('.sheet [data-act="rvLog"]');
  await page.click('.sheet [data-act="rvLog"]'); await page.waitForTimeout(200);
  let n = await nut();
  const e = n.entries.find((x) => /Protein\+ Penne/.test(x.name));
  ok(e && Math.round(e.per.cal * e.qty) === 200 && e.conf === 'estimated', 'logged one 56 g serving ≈ 200 cal, still an estimate');
  ok(n.foods.some((f) => f.code === '0076808280531' && /Open Food Facts/.test(f.source.name)), 'saved to My foods with its barcode');

  console.log('Not found → enter from the label → found next time, offline');
  await page.click('[data-act="foodScan"]');
  await page.waitForSelector('#scanCode');
  await page.fill('#scanCode', '012345678905'); await page.dispatchEvent('#scanCode', 'input');
  await page.click('.sheet [data-act="scanManual"]');
  await page.waitForSelector('.scan-none');
  ok(/Product not found/.test(await page.textContent('.scan-none')) && /never substitutes/.test(await page.textContent('.scan-none')), 'not found: says so, offers label entry and search');
  await page.click('.sheet [data-act="scanLabel"]');
  await page.waitForSelector('.sheet [data-in="mf"][data-k="code"]');
  ok((await page.inputValue('.sheet [data-in="mf"][data-k="code"]')) === '012345678905', 'barcode prefilled in the label form');
  for (const [k, v] of [['brand', 'Local Farm'], ['line', 'Skyr Cup'], ['unit', 'cup'], ['p', '17'], ['cal', '110']]) {
    await page.fill(`.sheet [data-in="mf"][data-k="${k}"]`, v); await page.dispatchEvent(`.sheet [data-in="mf"][data-k="${k}"]`, 'input');
  }
  await page.click('.sheet [data-act="mfSave"]');
  await page.waitForSelector('.sheet [data-act="rvLog"]');
  await page.click('.sheet [data-act="rvLog"]'); await page.waitForTimeout(200);
  n = await nut();
  ok(n.entries.some((x) => x.name === 'Local Farm Skyr Cup' && x.conf === 'user'), 'logged as Confirmed by you');
  await ctx.setOffline(true);
  await page.click('[data-act="foodScan"]');
  await page.waitForSelector('#scanCode');
  await page.fill('#scanCode', '012345678905'); await page.dispatchEvent('#scanCode', 'input');
  await page.click('.sheet [data-act="scanManual"]');
  await page.waitForSelector('.scan-found');
  ok(/Local Farm Skyr Cup/.test(await page.textContent('.scan-found')) && /in your foods/.test(await page.textContent('.scan-found')), 'scanning it again finds your product instantly, offline');
  await page.evaluate(() => WT.closeSheet(true));
  await ctx.setOffline(false);

  console.log('Search foods: local first, online when asked');
  await page.click('[data-act="foodSearch"]');
  await page.waitForSelector('#srQ');
  await page.fill('#srQ', 'oikos'); await page.dispatchEvent('#srQ', 'input'); await page.waitForTimeout(250);
  let txt = await page.textContent('#srList');
  ok(/Oikos Triple Zero/.test(txt) && /Oikos Pro/.test(txt) && txt.indexOf('Oikos') < (txt.indexOf('Greek yogurt') === -1 ? Infinity : txt.indexOf('Greek yogurt')), 'Oikos → its products, not generic yogurt');
  net.calls = [];
  await page.click('.sheet [data-act="srOnline"]');
  await page.waitForTimeout(500);
  txt = await page.textContent('#srList');
  ok(/Online · Open Food Facts/.test(txt) && /Online · USDA FoodData Central/.test(txt) && /Triple Zero Blended Mixed Berry/.test(txt) && /Oikos Pro Drink Vanilla/.test(txt), 'online results grouped by source');
  ok(net.calls.some((u) => /api_key=DEMO_KEY/.test(u)), 'USDA queried with the public demo key (no key in the code)');
  const j = await page.evaluate(() => [...document.querySelectorAll('#srList [data-act="srPick"]')].findIndex((b) => /Oikos Pro Drink Vanilla/.test(b.textContent)));
  await page.click(`#srList [data-act="srPick"][data-j="${j}"]`);
  await page.waitForSelector('.sheet [data-act="rvLog"]');
  ok(/Reference data/.test(await page.textContent('.sheet .rv')) && /USDA FoodData Central/.test(await page.textContent('.sheet .rv')), 'picked USDA branded item: Reference data, source shown');
  await page.click('.sheet [data-act="rvLog"]'); await page.waitForTimeout(200);
  ok((await nut()).entries.some((x) => /Oikos Pro Drink Vanilla/.test(x.name) && Math.round(x.per.p * x.qty) === 23), 'logged one 207 ml bottle = 23 g protein');
  // rate limit: message, local results still there
  net.fdc = 429;
  await page.click('[data-act="foodSearch"]');
  await page.waitForSelector('#srQ');
  await page.fill('#srQ', 'skyr cup'); await page.dispatchEvent('#srQ', 'input'); await page.waitForTimeout(200);
  await page.click('.sheet [data-act="srOnline"]'); await page.waitForTimeout(400);
  ok(/hourly limit/.test(await page.textContent('#srOnlineBar')) && /Local Farm Skyr Cup/.test(await page.textContent('#srList')), 'USDA rate-limited: clear message, your foods still listed');
  net.fdc = 'ok';
  // offline: online foods found before are still searchable
  await ctx.setOffline(true);
  await page.fill('#srQ', 'mixed berry'); await page.dispatchEvent('#srQ', 'input'); await page.waitForTimeout(250);
  ok(/Found online before/.test(await page.textContent('#srList')), 'offline: results found online earlier are still searchable');
  await ctx.setOffline(false);
  await page.evaluate(() => WT.closeSheet(true));

  console.log('Brand recognized, exact product unknown → choose, then enter the label');
  await page.goto(URL + '#/food'); await page.waitForTimeout(150);
  await page.fill('#foodInput', '2 slices of Dave’s Killer Bread rockin grains'); await page.waitForTimeout(250);
  ok((await page.locator('#foodPreview .li.amb').count()) === 1 && /doesn’t have its nutrition label yet/.test(await page.textContent('#foodPreview')), 'asks: recognizes Rockin’ Grains but has no label');
  ok(!(await page.locator('#foodPreview [data-id="p:daves-21-whole-grains"]').count()), 'does not offer 21 Whole Grains in its place');
  await page.click('#foodPreview .chip.cand.nodata');
  await page.waitForSelector('.sheet [data-act="cpLabel"]');
  ok(/won’t use another product’s numbers/.test(await page.textContent('.sheet')), 'explains: no borrowed numbers');
  await page.click('.sheet [data-act="cpLabel"]');
  await page.waitForSelector('.sheet [data-in="mf"][data-k="line"]');
  ok((await page.inputValue('.sheet [data-in="mf"][data-k="brand"]')) === "Dave's Killer Bread" && /Rockin' Grains/.test(await page.inputValue('.sheet [data-in="mf"][data-k="line"]')) && (await page.inputValue('.sheet [data-in="mf"][data-k="unit"]')) === 'slice', 'label form prefilled: brand, product line, serving unit');
  for (const [k, v] of [['p', '3'], ['cal', '100'], ['c', '19'], ['f', '1'], ['g', '38'], ['pkgUnit', 'loaf'], ['pkgServings', '18']]) {
    await page.fill(`.sheet [data-in="mf"][data-k="${k}"]`, v); await page.dispatchEvent(`.sheet [data-in="mf"][data-k="${k}"]`, 'input');
  }
  await page.click('.sheet [data-act="mfSave"]'); await page.waitForTimeout(250);
  let pv = await page.textContent('#foodPreview');
  ok(/Rockin' Grains/.test(pv) && /200 cal|≈200 cal/.test(pv) && !(await page.locator('#foodPreview .li.amb').count()), 'the item now uses your label: 2 slices = 200 cal');
  await page.click('#foodAddBtn'); await page.waitForTimeout(250);
  let nb = await nut();
  const wb = nb.foods.find((f) => /Rockin' Grains/.test(f.name));
  ok(wb && wb.catLine === 'daves-killer-bread:rockin-grains' && wb.units.loaf === 18 && wb.status === 'user', 'saved as your product, linked to its line, with its package size');
  ok(nb.entries.some((e) => /Rockin' Grains/.test(e.name) && Math.round(e.per.cal * e.qty) === 200), 'logged');
  await page.fill('#foodInput', 'half a loaf of daves killer bread rockin grains'); await page.waitForTimeout(250);
  ok(/900 cal|≈900 cal/.test(await page.textContent('#foodPreview')) && !(await page.locator('#foodPreview .li.amb').count()), 'next time: found directly, package size works (½ loaf = 9 slices)');
  await page.fill('#foodInput', 'daves killer bread raisin the roof'); await page.waitForTimeout(250);
  ok((await page.locator('#foodPreview .li.amb').count()) === 1, 'a different Dave’s bread still asks (your Rockin’ Grains is not substituted)');

  console.log('…or search online for it');
  await page.fill('#foodInput', 'Oikos triple zero black cherry'); await page.waitForTimeout(250);
  ok(/Black Cherry/.test(await page.textContent('#foodPreview')) && (await page.locator('#foodPreview .li.amb').count()) === 1, 'unlisted flavor: asks (Vanilla offered only as a labelled estimate)');
  await page.click('#foodPreview .chip.cand.nodata');
  await page.click('.sheet [data-act="cpSearch"]');
  await page.waitForSelector('#srQ'); await page.waitForTimeout(600);
  ok((await page.inputValue('#srQ')) === 'Oikos Triple Zero Black Cherry' && /Triple Zero Blended Mixed Berry/.test(await page.textContent('#srList')), 'search prefilled and run online automatically');
  ok(/Different flavor/.test(await page.textContent('#srList')) && /Brand matches/.test(await page.textContent('#srList')), 'online result flagged: same brand, different flavor');
  ok((await page.locator('#srList .sr-manual [data-act="productAdd"]').count()) === 1, 'manual label entry offered under the online results');
  const jj = await page.evaluate(() => [...document.querySelectorAll('#srList [data-act="srPick"]')].findIndex((b) => /Blended Mixed Berry/.test(b.textContent)));
  await page.click(`#srList [data-act="srPick"][data-j="${jj}"]`); await page.waitForTimeout(250);
  pv = await page.textContent('#foodPreview');
  ok(/Blended Mixed Berry/.test(pv) && /Estimate/.test(pv) && !(await page.locator('#foodPreview .li.amb').count()), 'the found product replaces the question, marked as community data (Estimate)');
  await page.fill('#foodInput', ''); await page.waitForTimeout(100);

  console.log('Camera permission denied');
  const page2 = await ctx.newPage();
  await page2.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })); });
  await page2.goto(URL + '#/food'); await page2.waitForTimeout(200);
  await page2.click('[data-act="foodScan"]');
  await page2.waitForTimeout(400);
  ok(/Camera access was blocked/.test(await page2.textContent('#scanMsg')) && (await page2.locator('#scanCode').count()) === 1, 'denied: explains how to allow it, manual entry still available');
  await page2.close();

  console.log('Settings');
  await page.goto(URL + '#/settings'); await page.waitForTimeout(200);
  ok((await page.locator('[data-in="pfFdcKey"]').count()) === 1 && /DEMO_KEY/.test(await page.textContent('body')), 'optional USDA key field, explains the demo key');
  await page.fill('[data-in="pfFdcKey"]', 'abc123'); await page.dispatchEvent('[data-in="pfFdcKey"]', 'change');
  ok((await page.evaluate(() => JSON.parse(WT.exportData()).data.profile.fdcKey)) === '', 'key excluded from exported backups');
  await page.click('[data-act="pfToggleOn"][data-k="onlineLookup"]'); await page.waitForTimeout(100);
  ok((await page.evaluate(() => WT.db.profile.onlineLookup)) === false && (await page.locator('[data-in="pfFdcKey"]').count()) === 0, 'online lookup can be turned off');
  for (const w of [390, 1280]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(URL + '#/food'); await page.waitForTimeout(150);
    ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `no overflow at ${w}px`);
  }
  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
