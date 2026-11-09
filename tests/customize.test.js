/* Pre-workout customisation + learning from notes, end to end in the browser.
 * Serve the repo on :8765 (python3 -m http.server 8765), then: node tests/customize.test.js
 *
 *  1 generate · 2 reorder (drag + keyboard) · 3 separate / create supersets · 4 pick easier & harder
 *  variations · 5 bodyweight = no equipment · 6 diverse chest library · 7 start & complete ·
 *  8 leave a note · 9 regenerate and see the note change selection · 10 history & progression intact
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:8765/';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 1400 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  const db = () => page.evaluate(() => JSON.parse(JSON.stringify(WT.db)));
  const order = async () => (await db()).draft.exercises.map((e) => e.uid);
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL + '#/generate');

  /* 1 ─ Generate */
  console.log('1. Generate a full-body workout with supersets');
  await page.click('[data-act="genType"][data-k="full"]');
  let tries = 0;
  do {
    await page.click('[data-act="generate"]'); await page.waitForTimeout(450);
  } while (!(await db()).draft.exercises.some((e) => e.superset) && ++tries < 10);
  let d = (await db()).draft;
  ok(d.exercises.length === 6, 'six exercises generated');
  ok(d.exercises.some((e) => e.superset), 'the plan contains a superset');
  ok((await page.locator('.plan-block [data-drag]').count()) === d.exercises.length, 'every exercise has a drag handle');

  /* 2 ─ Reorder */
  console.log('2. Reorder before starting');
  const blocksBefore = await page.evaluate(() => WT.groupBlocks(WT.db.draft.exercises).map((b) => b.map((e) => e.uid)));
  const h0 = await page.locator('.plan-block').nth(0).locator('[data-drag]').first().boundingBox();
  const lastBlock = await page.locator('.plan-block').last().boundingBox();
  await page.mouse.move(h0.x + h0.width / 2, h0.y + h0.height / 2);
  await page.mouse.down();
  await page.mouse.move(h0.x + h0.width / 2, h0.y + 30, { steps: 4 });
  await page.mouse.move(h0.x + h0.width / 2, lastBlock.y + lastBlock.height - 4, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  let blocksAfter = await page.evaluate(() => WT.groupBlocks(WT.db.draft.exercises).map((b) => b.map((e) => e.uid)));
  ok(JSON.stringify(blocksAfter[blocksAfter.length - 1]) === JSON.stringify(blocksBefore[0]), 'drag moved the first block to the end');
  ok(JSON.stringify(blocksAfter.slice(0, -1)) === JSON.stringify(blocksBefore.slice(1)), 'other blocks keep their relative order');
  // Drag a superset block as a unit
  const ssIdx = blocksAfter.findIndex((b) => b.length > 1);
  if (ssIdx > 0) {
    const hb = await page.locator('.plan-block').nth(ssIdx).locator('[data-drag]').first().boundingBox();
    const top = await page.locator('.plan-block').nth(0).boundingBox();
    await page.mouse.move(hb.x + 10, hb.y + 10); await page.mouse.down();
    await page.mouse.move(hb.x + 10, hb.y - 10, { steps: 3 }); await page.mouse.move(hb.x + 10, top.y + 4, { steps: 12 }); await page.mouse.up();
    await page.waitForTimeout(150);
    const nb = await page.evaluate(() => WT.groupBlocks(WT.db.draft.exercises).map((b) => b.map((e) => e.uid)));
    ok(JSON.stringify(nb[0]) === JSON.stringify(blocksAfter[ssIdx]), 'a superset moves as one block and stays paired');
    ok((await db()).draft.exercises.filter((e) => e.superset === 'A').length === 2, 'supersets re-lettered in order (A first)');
    blocksAfter = nb;
  }
  // Keyboard: focus a handle, ArrowDown
  await page.locator('.plan-block').nth(0).locator('[data-drag]').first().focus();
  await page.keyboard.press('ArrowDown');
  const kb = await page.evaluate(() => WT.groupBlocks(WT.db.draft.exercises).map((b) => b.map((e) => e.uid)));
  ok(JSON.stringify(kb[1]) === JSON.stringify(blocksAfter[0]), 'arrow keys move a block (accessible reordering)');
  ok((await page.evaluate(() => document.activeElement && document.activeElement.dataset.drag)) === '1', 'focus follows the moved block');
  // Menu: Move up
  const uidSecond = (await order())[d.exercises.length - 1];
  await page.locator(`.ex-row[data-uid="${uidSecond}"] [data-act="planMenu"]`).click();
  await page.click('.sheet [data-act="planMoveBlock"]');
  ok((await order()).indexOf(uidSecond) < d.exercises.length - 1, 'Move up from the menu');
  // Re-roll intensities keeps the hand-made order
  const ord1 = await order();
  await page.click('[data-act="rerollIntensity"]');
  ok(JSON.stringify(await order()) === JSON.stringify(ord1), 're-rolling intensities keeps your order');

  /* 3 ─ Supersets */
  console.log('3. Separate and create supersets');
  d = (await db()).draft;
  const ssItem = d.exercises.find((e) => e.superset);
  const ssMembers = d.exercises.filter((e) => e.superset === ssItem.superset);
  const snapshot = ssMembers.map((e) => ({ uid: e.uid, exId: e.exId, sets: e.sets, repMin: e.repMin, repMax: e.repMax, intensity: e.intensity }));
  await page.locator(`.ex-row[data-uid="${ssItem.uid}"] [data-act="ssMenu"]`).click();
  await page.click('.sheet [data-act="planUnpair"]');
  d = (await db()).draft;
  const sep = snapshot.map((x) => d.exercises.find((e) => e.uid === x.uid));
  ok(sep.every((e) => !e.superset), 'superset separated into independent exercises');
  ok(sep.every((e, k) => e.exId === snapshot[k].exId && e.sets === snapshot[k].sets && e.repMin === snapshot[k].repMin && e.repMax === snapshot[k].repMax && e.intensity === snapshot[k].intensity), 'exercises, sets, reps and intensity preserved');
  const ownRests = await page.evaluate((ids) => ids.map((u) => { const e = WT.db.draft.exercises.find((x) => x.uid === u); return e.rest === WT.prescribe(WT.ex(e.exId), e.intensity).rest; }), snapshot.map((x) => x.uid));
  ok(ownRests.every(Boolean), 'each exercise has its own rest again');
  ok((await page.locator(`.ex-row[data-uid="${ssItem.uid}"] .ss-tag`).count()) === 0, 'superset label gone from the plan');
  // Create a superset manually
  const [a1, b1] = (await db()).draft.exercises.filter((e) => !e.superset);
  await page.locator(`.ex-row[data-uid="${a1.uid}"] [data-act="planMenu"]`).click();
  await page.click('.sheet [data-act="planPairPick"]');
  await page.click(`.sheet [data-act="planPair"][data-b="${b1.uid}"]`);
  d = (await db()).draft;
  const ia = d.exercises.findIndex((e) => e.uid === a1.uid), ib = d.exercises.findIndex((e) => e.uid === b1.uid);
  ok(d.exercises[ia].superset && d.exercises[ia].superset === d.exercises[ib].superset && ib === ia + 1, 'manual superset: paired and adjacent');
  ok(d.exercises[ib].rest >= (await page.evaluate(() => WT.db.profile.rest.superset)), 'superset rest applied after the round');
  const finalOrder = d.exercises.map((e) => e.exId);
  const finalSS = d.exercises.map((e) => e.superset || '');

  /* 4/5/6 ─ Bodyweight library + variations */
  console.log('4–6. Bodyweight-only chest plan, variations, zero equipment');
  const keep = (await db()).draft; // stash and restore after the bodyweight checks
  await page.evaluate(() => (window.__keep = JSON.parse(JSON.stringify(WT.db.draft))));
  await page.click('[data-act="genType"][data-k="chest"]');
  await page.click('[data-act="genEquipMode"][data-v="none"]');
  const chestSeen = new Set();
  for (let k = 0; k < 6; k++) {
    await page.click('[data-act="generate"]'); await page.waitForTimeout(430);
    const dd = (await db()).draft;
    const free = await page.evaluate(() => WT.db.draft.exercises.every((e) => WT.isEquipmentFree(WT.ex(e.exId))));
    ok(free, `bodyweight-only chest plan ${k + 1} uses no equipment at all`);
    dd.exercises.forEach((e) => chestSeen.add(e.exId));
  }
  const patterns = await page.evaluate((ids) => [...new Set(ids.map((i) => WT.ex(i).pattern))], [...chestSeen]);
  ok(chestSeen.size >= 8, `chest plans draw on a wide library (${chestSeen.size} distinct): ${[...chestSeen].join(', ')}`);
  ok(patterns.length >= 3, `several movement patterns, not just hand positions: ${patterns.join(', ')}`);
  const lib = await page.evaluate(() => {
    const free = WT.exercises.filter((e) => WT.isEquipmentFree(e));
    const banned = ['bar', 'dip', 'rings', 'bench', 'wall', 'towel', 'anchor', 'abwheel', 'rope'];
    return {
      n: free.length,
      chestPrimary: free.filter((e) => e.primary === 'chest').map((e) => e.id),
      allFree: free.every((e) => e.equipment.every((q) => !banned.includes(q))),
      allHaveCue: free.every((e) => e.cue && e.cue.length > 30),
      wallSitFlagged: !WT.isEquipmentFree(WT.ex('wall-sit')) && !WT.isEquipmentFree(WT.ex('handstand-pushup')) && !WT.isEquipmentFree(WT.ex('nordic-curl')),
    };
  });
  ok(lib.allFree && lib.wallSitFlagged, 'no bar / bench / wall / towel / anchor in the zero-equipment category');
  ok(lib.chestPrimary.length >= 12, `${lib.chestPrimary.length} chest-primary zero-equipment exercises`);
  ok(lib.allHaveCue, 'every zero-equipment exercise has instructions');
  // Variation: pick an easier and then a harder one on the first push-up-type row
  const puId = await page.evaluate(() => (WT.db.draft.exercises.find((e) => { const m = WT.ex(e.exId).mods || []; return m.some((x) => x.level < 0 && !x.needs) && m.some((x) => x.level > 0) && (WT.ex(e.exId).easier || WT.ex(e.exId).harder); }) || {}).uid);
  if (!puId) await page.evaluate(() => { WT.db.draft.exercises[0] = Object.assign(WT.db.draft.exercises[0], { exId: 'pushup', variation: null }); WT.save(true); WT.rerender(); });
  const pu = (await db()).draft.exercises.find((e) => e.uid === puId) || (await db()).draft.exercises[0];
  await page.locator(`.ex-row[data-uid="${pu.uid}"] [data-act="planMenu"]`).click();
  await page.click('.sheet [data-act="pickVariation"]');
  const easier = await page.evaluate((id) => (WT.ex(id).mods || []).filter((m) => m.level < 0 && !m.needs)[0], pu.exId);
  if (easier) {
    await page.click(`.sheet [data-act="setVariation"][data-k="${easier.id}"]`);
    ok((await db()).draft.exercises.find((e) => e.uid === pu.uid).variation === easier.id, `easier variation selected: ${easier.name}`);
    ok((await page.locator(`.ex-row[data-uid="${pu.uid}"] .var-tag`).innerText()).includes(easier.name), 'variation shown clearly in the plan');
    await page.locator(`.ex-row[data-uid="${pu.uid}"] .var-tag`).click();
    const harder = await page.evaluate((id) => (WT.ex(id).mods || []).filter((m) => m.level > 0)[0], pu.exId);
    if (harder) {
      await page.click(`.sheet [data-act="setVariation"][data-k="${harder.id}"]`);
      ok((await db()).draft.exercises.find((e) => e.uid === pu.uid).variation === harder.id, `harder variation selected: ${harder.name}`);
    }
    await page.locator(`.ex-row[data-uid="${pu.uid}"] .var-tag`).click();
    await page.click('.sheet [data-act="setVariation"][data-k=""]');
    ok(!(await db()).draft.exercises.find((e) => e.uid === pu.uid).variation, 'back to “as written”');
  } else ok(false, 'push-up has easier variations');
  // Progression = a different exercise
  await page.locator(`.ex-row[data-uid="${pu.uid}"] [data-act="planMenu"]`).click();
  await page.click('.sheet [data-act="pickVariation"]');
  const progCount = await page.locator('.sheet [data-act="variationSwap"]').count();
  ok(progCount >= 1, 'progressions to other exercises are listed separately from modifications');
  await page.click('.sheet-head [data-act="closeSheet"]');

  /* 7 ─ Start & complete (the arranged full-body plan) */
  console.log('7. Start and complete the customised workout');
  await page.evaluate(() => { WT.db.draft = window.__keep; WT.ui.gen = null; WT.save(true); });
  await page.goto(URL + '#/generate'); await page.waitForTimeout(150);
  // put a variation on an exercise that has modifications so it travels into the session
  const withMods = await page.evaluate(() => { const e = WT.db.draft.exercises.find((x) => (WT.ex(x.exId).mods || []).some((m) => m.level < 0 && !m.needs)); if (!e) return null; e.variation = WT.ex(e.exId).mods.find((m) => m.level < 0 && !m.needs).id; WT.save(true); return { uid: e.uid, exId: e.exId, v: e.variation }; });
  await page.click('.sticky-cta [data-act="startDraft"]');
  await page.waitForSelector('.cur');
  let a = (await db()).active;
  ok(JSON.stringify(a.exercises.map((e) => e.exId)) === JSON.stringify(finalOrder), 'workout starts in your order');
  ok(JSON.stringify(a.exercises.map((e) => e.superset || '')) === JSON.stringify(finalSS), 'supersets as you arranged them');
  if (withMods) ok(a.exercises.find((e) => e.exId === withMods.exId).variation === withMods.v, 'variation carried into the workout');
  // log every set
  for (const e of a.exercises) {
    await page.evaluate((u) => { const it = WT.db.active.exercises.find((x) => x.uid === u); const tt = WT.trackType(WT.ex(it.exId)); it.sets.forEach((s) => { s.done = true; s.r = String(it.repMax); if (tt === 'weight') s.w = '30'; if (tt === 'cardio') s.time = '20'; }); WT.save(true); }, e.uid);
  }
  await page.reload(); await page.waitForSelector('.cur, .editor');

  /* 8 ─ Note */
  console.log('8. Leave a note on an exercise');
  // add a push-up so the note has something to point at, then note the wrists
  await page.evaluate(() => { const it = WT.sessionItem('pushup'); it.sets.forEach((s) => { s.done = true; s.r = '12'; }); it.notes = ''; WT.db.active.exercises.push(it); WT.db.active.focus = it.uid; WT.save(true); });
  await page.reload(); await page.waitForSelector('.cur');
  const puUid = await page.evaluate(() => WT.db.active.focus);
  await page.click(`.cur [data-act="woMenu"]`);
  await page.click('.sheet [data-act="woNoteToggle"]');
  await page.fill(`[data-in="exNotes"][data-uid="${puUid}"]`, 'Push-ups are tough on my wrists');
  await page.fill('[data-in="sessionNotes"]', 'Good session. I hate lunges though.');
  await page.waitForTimeout(250);
  await page.click('.train-head [data-act="woFinish"]');
  await page.click('[data-act="woSave"]'); await page.waitForTimeout(300);
  await page.click('.sheet [data-act="closeSheet"]');
  let h = (await db()).history;
  ok(h.length === 1, 'workout saved');
  ok(JSON.stringify(h[0].exercises.slice(0, finalOrder.length).map((e) => e.exId)) === JSON.stringify(finalOrder), 'history keeps your exercise order');
  if (withMods) ok(h[0].exercises.find((e) => e.exId === withMods.exId).variation === withMods.v, 'history keeps the variation');
  ok(h[0].exercises.find((e) => e.exId === 'pushup').notes.includes('wrists'), 'exercise note saved with the workout');
  if (withMods) ok((await page.locator('main').innerText()).includes(await page.evaluate((x) => WT.modOf(WT.ex(x.exId), x.v).name, withMods)), 'history shows the variation name');

  /* 9 ─ The note changes generation */
  console.log('9. Generate again — the notes shape it');
  const sig = await page.evaluate(() => WT.learnedSignals().map((s) => s.kind + ':' + s.target.type + ':' + s.target.key));
  ok(sig.includes('pain:family:push-up') && sig.includes('pain:joint:wrist'), 'note understood: push-ups + wrists (' + sig.join(', ') + ')');
  ok(sig.includes('dislike:family:lunge'), 'workout note understood: dislikes lunges');
  await page.goto(URL + '#/generate');
  await page.click('[data-act="genType"][data-k="chest"]');
  await page.click('[data-act="genEquipMode"][data-v="none"]');
  let wristHeavy = 0, total = 0, knuckles = 0, pushups = 0, chestCovered = 0, personalized = 0;
  for (let k = 0; k < 6; k++) {
    await page.click('[data-act="generate"]'); await page.waitForTimeout(430);
    const r = await page.evaluate(() => {
      const ex = WT.db.draft.exercises.map((e) => ({ e, x: WT.ex(e.exId) }));
      return {
        n: ex.length,
        wrist: ex.filter(({ e, x }) => (x.joints || []).includes('wrist') && !(WT.modOf(x, e.variation) || {}).wrist).length,
        knuckles: ex.filter(({ e }) => e.variation === 'knuckles').length,
        pushups: ex.filter(({ x }) => (x.families || []).includes('push-up')).length,
        chest: ex.filter(({ x }) => x.primary === 'chest' || x.secondary.includes('chest')).length,
        adj: (WT.db.draft.adjustments || []).length,
      };
    });
    total += r.n; wristHeavy += r.wrist; knuckles += r.knuckles; pushups += r.pushups; chestCovered += r.chest === r.n ? 1 : 0; personalized += r.adj ? 1 : 0;
  }
  console.log(`    after the note: ${wristHeavy}/${total} wrist-loading picks without a wrist-friendly version, ${pushups} push-up family picks, ${knuckles} on knuckles`);
  // Before the note a bodyweight chest day is almost all push-ups (see step 4); now:
  ok(wristHeavy <= total * 0.25, 'wrist-loading exercises mostly avoided or made wrist-friendly');
  ok(pushups <= 12, 'fewer push-ups per workout (≤ 2 on average)');
  ok(chestCovered === 6, 'chest coverage kept: every substitute still trains the chest');
  ok(personalized === 6, 'every plan says it was personalized from your notes');
  ok((await page.locator('details.learned').count()) === 1, 'the plan lists the adjustments');
  // Knuckle push-ups are a TRIAL, not an assumption: one per plan, labelled, and you're asked afterwards
  const trials = await page.evaluate(() => WT.db.draft.exercises.filter((e) => e.trial));
  ok(trials.length === 1 && trials[0].trial.joint === 'wrist' && trials[0].variation === trials[0].trial.mod, 'one labelled wrist trial in the plan: ' + (trials[0] ? trials[0].exId + ' · ' + trials[0].variation : 'none'));
  ok((await page.locator('.ex-row .trial-tag').count()) === 1, 'trial tag shown on the plan row');
  await page.click('.sticky-cta [data-act="startDraft"]');
  await page.waitForSelector('.cur');
  const trialUid = await page.evaluate(() => WT.db.active.exercises.find((e) => e.trial).uid);
  await page.evaluate((u) => { const it = WT.db.active.exercises.find((x) => x.uid === u); it.sets.slice(0, -1).forEach((st) => { st.done = true; st.r = '10'; }); WT.db.active.focus = u; WT.save(true); }, trialUid);
  await page.reload(); await page.waitForSelector('.cur');
  await page.fill('.field-num input[data-f="r"]', '10');
  await page.click(`[data-act="woCheck"][data-uid="${trialUid}"]`);
  ok((await page.locator('.effort.trial').count()) === 1, 'after the last set: “How did your wrists feel?”');
  await page.click(`.effort.trial [data-act="woTrial"][data-v="1"]`);
  const tr = await page.evaluate(() => WT.db.learn.trials);
  ok(Object.keys(tr).length === 1 && Object.values(tr)[0].ok === true, 'answer stored: ' + Object.keys(tr)[0]);
  ok((await page.locator('.effort:not(.trial)').count()) === 1, 'then the usual effort question');
  await page.evaluate(() => { WT.db.active = null; WT.save(true); });
  await page.goto(URL + '#/generate');
  await page.click('[data-act="genType"][data-k="chest"]');
  await page.click('[data-act="genEquipMode"][data-v="none"]');
  await page.click('[data-act="generate"]'); await page.waitForTimeout(450);
  const after = await page.evaluate(() => WT.db.draft.exercises.map((e) => ({ id: e.exId, v: e.variation, trial: !!e.trial })));
  ok(after.every((e) => !e.trial) && after.some((e) => e.v === 'knuckles'), 'confirmed modification used in the next plan, no longer a trial');
  // "Doesn't work" from the variation sheet removes it again
  const kn = after.find((e) => e.v === 'knuckles');
  const knUid = await page.evaluate((id) => WT.db.draft.exercises.find((e) => e.exId === id).uid, kn.id);
  await page.locator(`.ex-row[data-uid="${knUid}"] .var-tag`).click();
  ok((await page.locator('.sheet [data-act="varTrial"]').count()) >= 2, 'variation sheet: works / doesn’t for your wrists');
  await page.click('.sheet [data-act="varTrial"][data-k="wrist|knuckles"][data-v="0"]');
  await page.click('.sheet-head [data-act="closeSheet"]');
  await page.click('[data-act="generate"]'); await page.waitForTimeout(450);
  ok(await page.evaluate(() => WT.db.draft.exercises.every((e) => e.variation !== 'knuckles' || e.exId !== WT.db.draft.exercises[0].exId) && !WT.db.draft.exercises.some((e) => e.variation === 'knuckles' && !e.trial && (WT.ex(e.exId).families || []).includes('push-up') && WT.trialStatus('wrist', WT.ex(e.exId), 'knuckles', WT.learnedPrefs()) === 'bad')), 'a modification marked “doesn’t work” is not prescribed');
  // Lunges disliked → legs day avoids them
  await page.click('[data-act="genType"][data-k="legs"]');
  let lunges = 0;
  for (let k = 0; k < 5; k++) { await page.click('[data-act="generate"]'); await page.waitForTimeout(430); lunges += await page.evaluate(() => WT.db.draft.exercises.filter((e) => (WT.ex(e.exId).families || []).includes('lunge')).length); }
  ok(lunges === 0, 'disliked lunges are no longer recommended');
  // Persistence across refresh + Settings
  await page.reload();
  ok((await page.evaluate(() => WT.learnedSignals().length)) >= 3, 'learned signals persist after refresh');
  await page.goto(URL + '#/settings');
  ok((await page.locator('#learned [data-act="forgetSignal"]').count()) >= 3, 'Settings lists what Forge learned');
  // Later note overrides: wrists fine now
  await page.evaluate(() => { WT.db.learn.notes.push({ id: 'n1', exId: null, text: 'Wrists feel fine now', at: new Date(Date.now() + 1000).toISOString() }); WT.save(true); });
  ok(!(await page.evaluate(() => WT.learnedSignals().some((s) => s.kind === 'pain'))), '“wrists feel fine now” cancels the wrist limitation');
  // Standing note from the exercise detail sheet
  await page.goto(URL + '#/library');
  await page.fill('#libSearch', 'Hindu'); await page.waitForTimeout(80);
  await page.locator('#libList [data-act="exDetail"]').first().click();
  await page.fill('#exNoteIn', 'Way too hard for me');
  await page.click('.sheet [data-act="exNoteAdd"]');
  ok(await page.evaluate(() => WT.prefEffect(WT.ex('hindu-pushup'), WT.learnedPrefs()).varDir === -1), 'detail-sheet note: Hindu push-ups → easier variation next time');
  ok(await page.evaluate(() => WT.pickVariation(WT.ex('hindu-pushup'), WT.learnedPrefs()).id === 'half'), 'generator picks the half-swoop modification');
  await page.click('.sheet-head [data-act="closeSheet"]');

  /* 10 ─ History & progression */
  console.log('10. History and progression still work');
  await page.goto(URL + '#/history');
  ok((await page.locator('[data-entry]').count()) === 1, 'history lists the workout');
  const rec = await page.evaluate(() => { const e = WT.db.history[0].exercises.find((x) => WT.trackType(WT.ex(x.exId)) === 'weight'); return e ? WT.recommend(e.exId, { repMin: e.repMin, repMax: e.repMax, sets: e.targetSets, intensity: e.intensity }) : null; });
  ok(!rec || (rec.headline && rec.reasons.length), 'weighted exercise gets a recommendation from history: ' + (rec ? rec.headline : 'n/a'));
  const bwRec = await page.evaluate(() => WT.recommend('pushup', { repMin: 10, repMax: 12, sets: 3, intensity: 'standard', variation: null }));
  ok(/Beat|Try|Aim|reps/.test(bwRec.headline), 'bodyweight progression from history: ' + bwRec.headline);
  const kneeRec = await page.evaluate(() => WT.recommend('pushup', { repMin: 10, repMax: 12, sets: 3, intensity: 'standard', variation: 'knees' }));
  ok(kneeRec.action === 'new' && /variation/.test(kneeRec.reasons[0]), 'a different variation is tracked separately');
  await page.goto(URL + '#/progress'); await page.waitForTimeout(300);
  ok((await page.locator('main svg').count()) >= 1, 'progress charts render');
  // Repeat keeps order, supersets and variations
  await page.goto(URL + '#/history/' + h[0].id);
  await page.click('[data-act="histRepeat"]'); await page.waitForSelector('.cur');
  a = (await db()).active;
  ok(JSON.stringify(a.exercises.map((e) => e.exId)) === JSON.stringify(h[0].exercises.map((e) => e.exId)), 'repeat keeps the order');
  ok(JSON.stringify(a.exercises.map((e) => e.variation || null)) === JSON.stringify(h[0].exercises.map((e) => e.variation || null)), 'repeat keeps variations');

  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
