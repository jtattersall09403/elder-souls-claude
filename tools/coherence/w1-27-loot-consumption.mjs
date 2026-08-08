#!/usr/bin/env node
// w1-27-loot-consumption.mjs — RI-MTH07 / RULES #5 and #11 FOR THE PLACED-OBJECT LAYER.
//
// `w1-27-coherence.mjs` L1 counts 1,827 palette-assembled objects in `game/data/world/property/`.
// RULES #11 says a field census over data cannot prove a read dead, and the symmetric point is
// the one that matters here: **a census over data cannot prove a read ALIVE either.** A count of
// 1,950 placed objects is worth nothing if the running world never touches them — it would mean
// the loot question is moot, not answered, and this piece would have measured a spreadsheet.
//
// So this tool does not count anything. It takes a palette object OUT OF THE WORLD, with the
// world running, and watches four things move:
//
//   C1  the object is reachable            listPropertyZones -> listOwnedObjects finds it
//   C2  taking it changes the player       it appears in the inventory
//   C3  taking it changes the WORLD        the stolen registry records owner + value
//   C4  it survives a save/load            the theft is durable, not a display string
//
// The registry key is `stolen_registry` and this tool guessed three other spellings first. All
// three came back empty and C3/C4 read as DEAD CONSUMERS on the first run — RULES #11's exact
// failure, committed by the tool written to check for it. The key is read from `CrimeWorld.toJSON()`
// now; a probe that names a field it has not looked up is a probe that reports absence for free.
//
// And then the delete-the-fix arm, which is the whole point: the zone's `contents` are emptied on
// the RUNNING engine and the same four measurements are taken again. If they do not go red, the
// world was not reading the placed objects and L1's 1,827 is a number about a file.
//
// It perturbs at runtime through `window.__ENGINE` and never edits a source file — a dozen agents
// boot-check on this box and a delete-the-fix that breaks the tree for ninety seconds is an outage
// for all of them (the reasoning is `w1-library-r2-perturb.mjs`'s and it is right).
//
// Run: node tools/coherence/w1-27-loot-consumption.mjs [--out FILE]

import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('w1-27-loot-consumption.mjs — does the running world read the placed objects?'); process.exit(0); }

const handle = await launchGame({ ...args, width: 320, height: 240 });
const page = handle.page;
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });
await page.evaluate(() => { try { window.__HARNESS.setRenderRate(0); } catch {} });

const out = await page.evaluate(async () => {
  const H = window.__HARNESS;
  const E = window.__ENGINE;
  if (!E) throw new Error('window.__ENGINE unreachable — cannot perturb');

  // One arm: find a palette object, take it, read the four consumers.
  const arm = (label) => {
    const res = { arm: label, zone: null, object: null, C1: false, C2: false, C3: false, C4: false, error: null };
    try {
      const zones = H.listPropertyZones();
      // Pick the first zone that still reports objects; in the torn-down arm there will be none.
      const z = zones.find((x) => x.objects > 0) || zones[0];
      res.zone = z ? { id: z.id, objects: z.objects } : null;
      if (!z) { res.error = 'no property zones at all'; return res; }
      const objs = H.listOwnedObjects(z.id);
      res.C1 = objs.length > 0;
      if (!objs.length) { res.error = 'zone reports no objects'; return res; }
      const obj = objs.find((o) => !o.unique) || objs[0];
      res.object = { instance: obj.instance, name: obj.name, owner: obj.owner, value_g: obj.value_g, unique: obj.unique };

      const invBefore = H.getInventory().length;
      const take = H.takeObject(obj.instance, {});
      const invAfter = H.getInventory().length;
      res.C2 = invAfter > invBefore;
      res.take = { stolen_from: take && take.stolen_from ? take.stolen_from : null, observed_by_source: take && take.observed_by_source };

      // C3 — the world's own record, not the player's.
      const crime = H.getCrimeState ? H.getCrimeState() : null;
      const reg = crime && crime.stolen_registry;
      const rows = Array.isArray(reg) ? reg : (reg ? Object.values(reg) : []);
      res.C3 = rows.some((r) => r && (r.instance === obj.instance || r.item_id === obj.instance));
      res.stolen_rows = rows.length;

      // C4 — durability. Save, reset, load, and look for the row again.
      const snap = H.saveState ? H.saveState() : null;
      if (snap) {
        H.reset();
        H.loadState(snap);
        const crime2 = H.getCrimeState ? H.getCrimeState() : null;
        const reg2 = crime2 && crime2.stolen_registry;
        const rows2 = Array.isArray(reg2) ? reg2 : (reg2 ? Object.values(reg2) : []);
        res.C4 = rows2.some((r) => r && (r.instance === obj.instance || r.item_id === obj.instance));
        res.stolen_rows_after_load = rows2.length;
      }
    } catch (e) { res.error = String(e && e.message ? e.message : e).slice(0, 300); }
    return res;
  };

  const positive = arm('world-as-shipped');

  // ---- THE TEARDOWN. Empty every zone's contents on the running engine. -----------------------
  // This is the arm RULES #6 requires and the one that decides whether L1's count is evidence.
  // If the positive arm's numbers come back unchanged after this, nothing in the world was reading
  // `game/data/world/property/*.json` and the loot finding is about a file, not about a game.
  H.reset();
  let emptied = 0;
  for (const k of Object.keys(E.data.property || {})) {
    for (const z of E.data.property[k].zones) { emptied += z.contents.length; z.contents = []; }
  }
  const negative = arm('contents-emptied-on-the-running-engine');

  return { positive, negative, objects_removed_by_teardown: emptied };
});

await handle.close();

const arms = [out.positive, out.negative];
const consumers = ['C1', 'C2', 'C3', 'C4'];
const moved = consumers.filter((c) => out.positive[c] === true && out.negative[c] === false);
const report = {
  tool: 'tools/coherence/w1-27-loot-consumption.mjs',
  question: 'does the running world read the 1,950 placed objects, or is L1 a number about a file?',
  objects_removed_by_teardown: out.objects_removed_by_teardown,
  consumers_that_moved: moved,
  consumers_that_did_not_move: consumers.filter((c) => !moved.includes(c)),
  arms,
  page_errors: errors,
  // The pass condition is deliberately NOT "the positive arm is green". A positive arm on its own
  // is the sixteen subsystems RULES #5 is about.
  verdict: moved.length >= 2 ? 'CONSUMED — the placed objects reach the world and their removal is felt'
    : 'NOT DEMONSTRATED — fewer than two consumers distinguished the two arms',
};
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
if (args.out) writeJson(args.out, report);
process.exit(moved.length >= 2 ? 0 : 1);
