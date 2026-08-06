// CRITIC-OWNED probe 9: is the RI-JRN05 M1 round-trip failure seed-dependent?
// The builder's determinism.mjs R9 reports PASS at seed 1337. probe6 measured FAIL at seed 4711.
import { launchGame } from '../tools/lib/browser.mjs';
import fs from 'node:fs';

const out = process.argv[2];
const handle = await launchGame({});
const page = handle.page;

const res = await page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready(); H.setMode('harness');
  const rows = [];
  const seeds = [1337, 4242, 4711, 1, 2, 3, 7, 42, 99, 100, 12345, 65536, 999999, 2024, 8675309, 31337, 60606, 777, 5150, 1234567];
  for (const seed of seeds) {
    for (const state of ['arena_flat', 'sv5-journal-bloodstain']) {
      H.setSeed(seed); H.loadState(state); H.stepFrames(120);
      const h0 = H.getStateHash();
      const b0 = JSON.parse(JSON.stringify(H.saveState()));
      H.loadState(b0);
      const h1 = H.getStateHash();
      const b1 = JSON.parse(JSON.stringify(H.saveState()));
      H.loadState(b1);
      const h2 = H.getStateHash();
      rows.push({ seed, state, h0, h1, h2,
        first_trip_equal: h0 === h1, second_trip_equal: h1 === h2,
        rng0: b0.rng, rng1: b1.rng });
    }
  }
  return rows;
});

const fail1 = res.filter(r => !r.first_trip_equal).length;
const fail2 = res.filter(r => !r.second_trip_equal).length;
const report = {
  schema: 'critic/w1-00-roundtrip-seedsweep@1', at: new Date().toISOString(),
  method: 'setSeed(s); loadState(state); stepFrames(120); h0=getStateHash(); b0=saveState(); loadState(b0); h1=getStateHash(); b1=saveState(); loadState(b1); h2=getStateHash()',
  trials: res.length, first_trip_mismatches: fail1, second_trip_mismatches: fail2,
  first_trip_mismatch_rate: fail1 / res.length,
  rows: res,
  page_errors: handle.errors,
};
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`trials=${res.length} first-trip mismatches=${fail1} second-trip mismatches=${fail2}`);
await handle.close();
