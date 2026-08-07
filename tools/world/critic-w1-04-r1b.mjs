#!/usr/bin/env node
/** critic-w1-04-r1b — does going through a door change WHAT IS DRAWN? */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, writeJson, log } from '../lib/cli.mjs';
const args = parseArgs(process.argv.slice(2));
const handle = await launchGame({ timeout: 90000, width: 960, height: 540 });
const { page } = handle;
const H = (fn, ...a) => page.evaluate(({ f, a }) => (new Function('h', 'E', `return (${f})(h,E,...${JSON.stringify(a)})`))(window.__HARNESS, window.__ENGINE), { f: fn.toString(), a });
const R = {};
try {
  R.result = await H((h, E) => {
    const vis = () => {
      const r = E.renderer; const out = {};
      if (r && r.cells) for (const k of Object.keys(r.cells)) if (r.cells[k].visible) out[k] = true;
      return { visible_cells: Object.keys(out), cellFor: E.cellFor(E.sim.env), env_interior: E.sim.env.interior };
    };
    const s = h.__w1_04_settlement('thorn');
    h.teleport(s.pos[0] + 4, s.pos[2] + 4); h.setTimeOfDay(12); h.stepFrames(4);
    const outside = vis();
    // 1. through the DOOR, the way a player does it — the harness verb the door press calls.
    h.enterInterior('thorn-hall'); h.stepFrames(6); h.renderFrame();
    const afterDoor = vis();
    // 2. now force the cell the way loadState does, and see if the picture was available all along.
    E._applyCell(); h.stepFrames(2); h.renderFrame();
    const afterApplyCell = vis();
    h.exitInterior(); h.stepFrames(6);
    const afterLeave = vis();
    return { outside, afterDoor, afterApplyCell, afterLeave };
  });
  log(JSON.stringify(R.result, null, 1));
} finally { writeJson(args.out || 'reports/critic-w1-04-r1b.json', R); await handle.close(); }
