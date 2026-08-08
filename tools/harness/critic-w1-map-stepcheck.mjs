#!/usr/bin/env node
// critic-w1-map-stepcheck.mjs — is the long-step crash the map's, or the tree's?
//
// The W1-MAP critic's consumption ablation needs to step the world for hundreds of frames. That
// crashed in `combat/enemy.js _idleBehaviour` ("this.ai.step is not a function"). Before
// reporting it against W1-MAP, establish whether it happens with the discovery model TORN OUT —
// i.e. whether the map is anywhere near it. Reports the frame at which it first throws.
import { parseArgs, log, EXIT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
const handle = await launchGame(args);
let out;
try {
  out = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);
    const eng = H._engine || window.__ENGINE;
    const sim = eng.sim;
    const trial = async (label, killMap) => {
      await H.loadState('default');
      const saved = sim.discovery;
      if (killMap) sim.discovery = null;       // no map model at all: stepDiscovery becomes a no-op
      let frames = 0, err = null;
      try {
        // The critic's actual route: teleport along a line, then let the world run. Teleporting
        // is what puts the body next to entities the loaded state never activated.
        for (let i = 0; i < 8; i++) { H.teleport(1800 + i * 160, 900, {}); H.stepFrames(2); frames += 2; }
        for (let k = 0; k < 60; k++) { H.stepFrames(10); frames += 10; }
      } catch (e) { err = `${e.constructor.name}: ${e.message}`; }
      sim.discovery = saved;
      return { label, map_present: !killMap, frames_survived: frames, error: err };
    };
    return {
      with_map: await trial('discovery model present', false),
      without_map: await trial('discovery model removed', true),
    };
  });
} finally { await handle.close(); }

log(JSON.stringify(out, null, 2));
const mapImplicated = out.with_map.error && !out.without_map.error;
log(mapImplicated
  ? 'VERDICT: the crash disappears when the map is removed — it is the map\'s.'
  : 'VERDICT: the crash is present with the map REMOVED — it is the tree\'s, not W1-MAP\'s.');
process.exit(EXIT.OK);
