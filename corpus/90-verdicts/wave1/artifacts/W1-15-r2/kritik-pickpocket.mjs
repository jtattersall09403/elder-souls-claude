#!/usr/bin/env node
// The seam-S21 pickpocket die, re-measured live. `queueInputs` frame numbers are RELATIVE to
// the current frame — an absolute number silently never fires, which is why the first pass of
// this probe reported 0 draws and 0 caught. That is a probe bug, not a build regression.
import { parseArgs, writeJson } from '../../../../../tools/lib/cli.mjs';
import { launchGame } from '../../../../../tools/lib/browser.mjs';
const args = parseArgs(); args.width = 320; args.height = 240;
const h = await launchGame(args);
await h.h('setRenderRate', 0);
const r = await h.page.evaluate(() => {
  const H = window.__HARNESS;
  const out = { rows: [] };
  const draws = () => (H.snapshot().rng || {}).draws;
  for (const sneak of [5, 50, 100]) {
    let caught = 0, clean = 0, d = 0, sample = null;
    for (let seed = 1; seed <= 60; seed++) {
      H.setSeed(seed); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
      H.setStealthState({ sneak, agility: 40, load: 'light', crouched: true });
      H.stepFrames(1);
      const d0 = draws();
      const beg = H.pickpocketBegin({ dist: 1.0, bearingDeg: 180, targetCivState: 'CALM', moving: false, crouched: true, item_weight: 0.4 });
      H.queueInputs([{ f: 0, press: ['interact'] }, { f: beg.need_f + 20, release: ['interact'] }]);
      H.stepFrames(beg.need_f + 10);
      d += draws() - d0;
      const ev = H.drainStealthEvents();
      const pk = ev.filter((e) => e.type === 'pickpocket');
      if (!sample) sample = { beg, ev: ev.slice(0, 4) };
      if (pk.some((e) => e.caught || e.noticed)) caught++; else clean++;
    }
    out.rows.push({ sneak, caught_of_60: caught, clean, rng_draws_total: d, draws_per_attempt: d / 60, sample });
  }
  return out;
});
console.log(JSON.stringify(r, null, 1).slice(0, 2000));
writeJson('corpus/90-verdicts/wave1/artifacts/W1-15-r2/kritik-pickpocket.json', { schema: 'elder-souls/critic-probe@1', piece: 'W1-15', round: 2, part: 'pickpocket', blocks: r, page_errors: h.errors });
await h.close();
