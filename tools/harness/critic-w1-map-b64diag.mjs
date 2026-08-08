#!/usr/bin/env node
// critic-w1-map-b64diag.mjs — why is `world.discovery.stood` 20 characters?
// A 42,846-cell bitset is 5,357 bytes, i.e. ~7,144 base64 characters. The honest save writes 20.
// Either the footprint is not the size the model says it is, or `serialise()` is not encoding it.
// Whichever it is, it decides whether the critic's forged-footprint attack was ever delivered.
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
    const sim = eng.sim, D = sim.discovery;
    const step = (n) => { try { H.stepFrames(n); } catch (e) { /* neighbour's defect */ } };
    const walkTo = (x, z) => { H.teleport(x, z, {}); step(2); };
    await H.loadState('default');
    D.restore(null);
    for (let i = 0; i < 6; i++) walkTo(2000 + i * 130, 800);

    const ser = D.serialise();
    const foot = D.footprint(), rast = D.raster();
    const b64 = (b) => { let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); };
    const mine = b64(new Uint8Array(foot.length).fill(0xFF));

    // Round-trip the model's OWN encoder through its OWN decoder.
    const before = { revealed: D.revealedCells, places: D.placeCount, stood: D.stoodCells };
    D.restore({ stood: ser.stood });                       // its own honest footprint
    const selfTrip = { revealed: D.revealedCells, places: D.placeCount, stood: D.stoodCells };
    D.restore({ stood: mine });                            // an all-ones footprint, same length
    const allOnes = { revealed: D.revealedCells, places: D.placeCount, stood: D.stoodCells, audit: D.lastRestore };

    return {
      cols: D.cols, rows: D.rows, total: D.cols * D.rows,
      footprint_bytes: foot.length, raster_bytes: rast.length,
      serialised_stood_chars: (ser.stood || '').length,
      serialised_cells_chars: (ser.cells || '').length,
      serialised_stood_value: String(ser.stood).slice(0, 80),
      my_allones_chars: mine.length,
      before, self_round_trip: selfTrip, all_ones_forgery: allOnes,
    };
  });
} finally { await handle.close(); }
log(JSON.stringify(out, null, 2));
process.exit(EXIT.OK);
