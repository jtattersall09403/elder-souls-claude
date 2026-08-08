#!/usr/bin/env node
/**
 * critic-w1-04-r3b — DELETE-THE-FIX, at SOURCE level, on both rounds at once (RULES.md rule 6).
 *
 * The builders' own controls are runtime switches (`sim.applyCell = null`, `pv.drawBuildings =
 * false`). Those are the right thing to ship and they are not the strongest arm available: a
 * runtime switch is a mechanism the same author wrote, and RULES.md rule 6 asks for the change
 * to be REMOVED and the old number to come back.
 *
 * So this runs the same three questions against two trees:
 *   - a frozen copy of the shipped tree, and
 *   - the same copy with THE SOURCE LINES DELETED:
 *       engine.js  `sim.applyCell = () => { this._cellDirty = true; }`   -> null      (round 2)
 *       engine.js  `_syncCell()` body                                    -> return false (round 2)
 *       province.js `this._settlementBuildings(g, ox, oz)`               -> removed   (round 3)
 *
 * It asks, on each tree:
 *   1. of N interiors entered through the door, how many DRAW the cell the world moved to;
 *   2. how many buildings the renderer holds around Thorn;
 *   3. how many shapes the live town collision set holds.
 *
 * A passing build must answer (1) N, (2) > 0, (3) > 0; the cut tree must answer 0, 0, 0. If both
 * trees answer the same thing, the fix is inert and the headline is not about the fix.
 *
 * Usage: node tools/world/critic-w1-04-r3b.mjs --entry <tree>/game/index.html --label live
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const USAGE = `
critic-w1-04-r3b.mjs — source-level delete-the-fix for W1-04 rounds 2 and 3.

  --entry <html>  game entry (point at the shipped copy, then at the cut copy)
  --label <name>  label recorded in the report (e.g. "shipped" / "cut")
  --n <count>     interiors to enter (default 20)
  --out <path>    JSON report
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const label = args.label || 'unlabelled';
const N = Number(args.n ?? 20);
const outFile = args.out || `reports/critic-w1-04-r3b-${label}.json`;
const timeout = Number(args.timeout ?? 120000);

let handle;
try {
  handle = await launchGame({ ...args, width: 480, height: 320 });
  const page = handle.page;
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout });

  const out = await page.evaluate(async (n) => {
    const H = window.__HARNESS, E = window.__ENGINE;
    // An independent traversal, so neither answer comes from a cached summary.
    const visibleCell = () => {
      const cells = E.renderer.cells;
      const vis = Object.keys(cells).filter((k) => cells[k].visible);
      return vis.length === 1 ? vis[0] : null;
    };

    // ---- 1. the door -----------------------------------------------------------------------
    const ids = H.listInteriors().map((i) => i.id).slice(0, n);
    let entered = 0, drew = 0;
    const misses = [];
    for (const id of ids) {
      try {
        if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
        const r = H.enterInterior(id); H.stepFrames(2);
        if (!r || !r.entered) continue;
        entered++;
        const want = H.getDrawnInterior().env_cell;
        const got = visibleCell();
        if (got === want) drew++; else if (misses.length < 4) misses.push({ id, drawn: got, want });
      } catch (e) { /* counted by omission */ }
    }
    try { if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(2); } } catch { /* outside */ }

    // ---- 2 & 3. the street -----------------------------------------------------------------
    H.teleport(3820, 859); H.stepFrames(30);
    const drawn = H.getDrawnSettlements();
    const solids = H.getSettlementSolids();

    return {
      door: { asked: ids.length, entered, drew_the_right_cell: drew, misses },
      street: {
        settlement: solids.settlement,
        buildings_in_the_scene_graph: drawn.buildings || 0,
        collision_shapes: solids.shapes || 0,
        collision_cell_id: solids.cell_id,
      },
    };
  }, N);

  log(`[${label}] doors: ${out.door.drew_the_right_cell}/${out.door.entered} drew the right cell`);
  log(`[${label}] street: ${out.street.buildings_in_the_scene_graph} buildings, ${out.street.collision_shapes} collision shapes`);
  writeJson(outFile, { tool: 'tools/world/critic-w1-04-r3b.mjs', label, entry: args.entry || 'game/index.html', ...out, page_errors: pageErrors });
  await handle.close();
  process.exit(0);
} catch (e) {
  log(`critic-w1-04-r3b: ${e && e.stack ? e.stack : e}`);
  if (handle) await handle.close().catch(() => {});
  process.exit(1);
}
