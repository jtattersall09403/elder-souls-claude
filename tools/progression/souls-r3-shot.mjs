#!/usr/bin/env node
// souls-r3-shot.mjs — one picture of what W1-SOULS round 3 changed.
//
// The round-2 verdict's picture was the defect: `docs/shots/2026-08-07-w1-souls-critic-r2-five-
// live-enemies-worth-nothing.png`, the sapwell screen after killing five live enemies —
// *"Souls held ◇ 0. To the next 418. Not enough souls yet. Come back."*
//
// This is the same screen after the same kind of sequence, with the ledger keyed on the BODY
// instead of on the entity id. It stages the round-2 verdict's own acceptance leg (a):
//
//   1. spawn a raid party, UNTAGGED — the tag was round 2's workaround and the thing that hid
//      the defect;
//   2. kill it;
//   3. cross `loadState('arena_flat')`, the scenario boundary every probe in this tree uses,
//      which mints the SAME eids again;
//   4. spawn the same fight, untagged, and kill it;
//   5. stand at a sapwell and open the screen the souls are spent at.
//
// Round 2 measured `+384` then `+0` across step 3 with twelve refused re-arms and zero rests.
// The number on this screen is both fights.
//
// Run: node tools/progression/souls-r3-shot.mjs [--out docs/shots/<name>.png]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const OUT = arg('out', 'docs/shots/2026-08-07-w1-souls-r3-the-same-fight-pays-twice.png');

const { launchGame } = await import('../lib/browser.mjs');
const handle = await launchGame({ width: 1280, height: 720 });
const page = handle.page;
try {
  await page.waitForFunction(() => !!window.__HARNESS && !!window.__ENGINE, null, { timeout: 90000 });
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));
  const t = await page.evaluate(async () => {
    const H = window.__HARNESS, E = window.__ENGINE;
    const fight = () => {
      // UNTAGGED. `spawnEncounter` then mints `dres-raid-party-<role>-<i>`, deterministically,
      // so the second pass gets byte-identical eids to the first.
      const r = H.spawnEncounter('dres-raid-party', 0, 12);
      H.stepFrames(2);                       // the scan is lazily seeded; see sim/souls.js
      const before = E.sim.progression.soulsHeld;
      for (const eid of r.eids) { try { H.killEntity(eid); } catch { /* npc */ } }
      H.stepFrames(4);
      return { eids: r.eids, paid: E.sim.progression.soulsHeld - before };
    };
    H.loadState('arena_flat'); H.setRenderRate(0); H.setTimeOfDay(14);
    E.sim.progression.soulsHeld = 0; E.sim.progression.level = 1; E.sim.progression.soulsSpent = 0;
    const pass1 = fight();
    H.loadState('arena_flat'); H.setTimeOfDay(14);
    E.sim.progression.level = 1;
    const heldAcross = E.sim.progression.soulsHeld;   // survives the boundary; the LEDGER does not
    const pass2 = fight();
    const same = JSON.stringify(pass1.eids) === JSON.stringify(pass2.eids);
    H.setAtHearth(true);
    H.openMenu('levelup');
    H.setRenderRate(60);
    H.stepFrames(4);
    const st = H.getPlayerStats();
    return {
      pass1: pass1.paid, pass2: pass2.paid, same_eids: same,
      held_across_the_boundary: heldAcross,
      souls: st.souls, price: st.souls_to_next, level: st.level,
      rests: 0, refused_rearms: E.sim.souls.refusedRearms, rebuilds: E.sim.souls.rebuilds,
      mode: H.getUIState().mode,
    };
  });
  await page.waitForTimeout(600);
  fs.mkdirSync(path.dirname(path.join(ROOT, OUT)), { recursive: true });
  await page.screenshot({ path: path.join(ROOT, OUT) });
  console.log(`souls-r3-shot: ${OUT}`);
  console.log(`  pass 1 across the boundary  +${t.pass1}`);
  console.log(`  pass 2, the SAME eids (${t.same_eids})  +${t.pass2}`);
  console.log(`  ${t.rests} hearth rests, ${t.refused_rearms} refused re-arms, ${t.rebuilds} rebuilt bodies seen`);
  console.log(`  screen '${t.mode}': souls held ${t.souls}, next level costs ${t.price}, level ${t.level}`);
  if (t.pass2 !== t.pass1) { console.error('souls-r3-shot: the two passes disagree — the picture would be a lie.'); process.exit(1); }
} finally {
  await handle.close();
}
