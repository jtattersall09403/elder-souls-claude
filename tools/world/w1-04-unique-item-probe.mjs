#!/usr/bin/env node
/**
 * w1-04-unique-item-probe.mjs — can you actually PICK UP the thing on the pedestal?
 *
 * RI-QST08's round-1 line was "30 unique items declared, none reachable through a door". This
 * round gives 83 of the 115 interiors a real prop entity at the spot the renderer draws the
 * pedestal. That is a claim with two halves and only one of them is proved by the room being
 * drawn: a body in the scene graph is not an item, and `sim.props` is what `takeProp()`, the
 * reach prompt and the inventory all read.
 *
 * So this walks through the door, asks the world what is in the room, takes it, and asks the
 * inventory. The control is the room BEFORE the door is used: the same query must find nothing.
 *
 *   node tools/world/w1-04-unique-item-probe.mjs [--n 12]
 *
 * Exit non-zero if the items are not there, or not takeable, or — the control — if they are
 * somehow there before anybody opened the door.
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, log, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
const N = Number(args.n ?? 12);
const outFile = args.out || 'reports/w1-04-unique-items.json';

let handle;
try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  await handle.page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 90000 });
  await handle.page.evaluate(() => window.__HARNESS.setRenderRate(0));

  const R = await handle.page.evaluate((n) => {
    const H = window.__HARNESS;
    const E = window.__ENGINE;
    H.setTimeOfDay(12);
    const ids = H.listInteriors().map((i) => i.id);
    const rows = [];
    // THE CONTROL, taken once and before any door: standing outside, no interior prop exists.
    try { if (H.whereAmI().interior) H.exitInterior(); } catch { /* outside */ }
    H.stepFrames(2);
    const outsideProps = E.sim.props.filter((p) => String(p.eid).startsWith('interior-')).length;

    // The five cells `Engine.cellFor()` sends somewhere of their own. They are W1-07's, they are
    // hand-built in `render/places.js`, and the census hand-places what is in them (the knife and
    // the gourd in the barge hold are the opening's). They do not go through the interior record
    // and must not be scored as if they did — the first run of this probe reported
    // `barge-hold: NOT IN WORLD` and called it a failure, which is the probe misreading its own
    // domain rather than the build missing an item.
    const HAND_BUILT = new Set(['barge-hold', 'writ-house', 'helstrom-market', 'stormhold-street', 'rootlands-well']);
    let checked = 0, withItem = 0, taken = 0, failed = 0;
    const outOfScope = [];
    for (const id of ids) {
      if (checked >= n) break;
      const rec = H.__w1_04_interior(id);
      if (!rec || !rec.unique_item) continue;
      if (HAND_BUILT.has(id)) { outOfScope.push(id); continue; }
      checked++;
      try {
        if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
        const r = H.enterInterior(id);
        if (!r || !r.entered) { rows.push({ id, entered: false }); continue; }
        H.stepFrames(2);
        const mine = E.sim.props.filter((p) => String(p.eid).startsWith('interior-unique:'));
        if (!mine.length) { rows.push({ id, item_in_world: false }); failed++; continue; }
        withItem++;
        const prop = mine[0];
        // Stand next to it, the way a player would, then take it through the normal verb.
        E._placeBody(prop.pos[0], prop.pos[1] - 1.0, prop.pos[2] + 0.8);
        H.stepFrames(2);
        const before = H.getInventory ? JSON.stringify(H.getInventory()).length : 0;
        let took = null;
        try { took = H.takeProp(prop.eid); } catch (e) { took = { error: String(e.message).slice(0, 120) }; }
        H.stepFrames(1);
        const after = H.getInventory ? JSON.stringify(H.getInventory()).length : 0;
        const ok = !!(took && !took.error) && after !== before;
        if (ok) taken++; else failed++;
        rows.push({ id, item_in_world: true, eid: prop.eid, name: prop.name, pos: prop.pos.map((v) => Math.round(v * 100) / 100), took: ok, detail: took && took.error ? took.error : null });
      } catch (e) { failed++; rows.push({ id, error: String(e && e.message ? e.message : e).slice(0, 160) }); }
    }
    return { outsideProps, checked, withItem, taken, failed, out_of_scope: outOfScope, rows };
  }, N);

  log(`control (standing outside, before any door): interior props in the world = ${R.outsideProps}`);
  log(`interiors checked ......... ${R.checked}`);
  log(`out of scope (W1-07 cells) ${R.out_of_scope.length}  ${R.out_of_scope.join(', ')}`);
  log(`unique item in the world .. ${R.withItem}`);
  log(`picked up ................. ${R.taken}`);
  log(`failed .................... ${R.failed}`);
  for (const r of R.rows.slice(0, 6)) log(`  ${String(r.id).padEnd(24)} ${r.took ? 'TAKEN' : (r.detail || r.error || (r.item_in_world === false ? 'NOT IN WORLD' : '-'))}  ${r.name || ''}`);

  const failures = [];
  if (R.outsideProps !== 0) failures.push(`control failed: ${R.outsideProps} interior props exist before any door was used`);
  if (R.withItem !== R.checked) failures.push(`${R.checked - R.withItem} of ${R.checked} rooms had no unique item in the world`);
  if (R.taken !== R.checked) failures.push(`${R.checked - R.taken} of ${R.checked} unique items could not be picked up`);
  log('');
  log(failures.length ? failures.map((f) => `FAIL: ${f}`).join('\n') : 'PASS: the thing on the pedestal is a thing you can take.');
  writeJson(outFile, { pass: failures.length === 0, failures, ...R });
  await handle.close();
  process.exit(failures.length ? 1 : 0);
} catch (e) {
  log(`w1-04-unique-item-probe: ${e && e.stack ? e.stack : e}`);
  if (handle) await handle.close().catch(() => {});
  process.exit(1);
}
