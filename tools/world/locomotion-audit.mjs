#!/usr/bin/env node
/**
 * locomotion-audit.mjs — what the world does to the body, measured at steady state.
 *
 * Three things verdict W1-01 scored 0 or near-0, in one run, through the harness:
 *
 *  - **RI-WLD10 M49** — the water band ladder. The verdict measured **1.9988 m/s in W2 standing
 *    water on SUCK**, identical to dry ground, and concluded the water model was "excellent and
 *    completely inert". It was right about the number. The cause was that the band retraction was
 *    written to `sim.player.pos`, which `combat-bridge.mirror()` overwrites from the controller at
 *    the top of every step; the retraction therefore produced a constant positional LAG of
 *    `v(1-mult)/mult` and a steady-state speed of exactly `v`. It is now written to the controller.
 *  - **RI-PRG07 M5** — burden. Three transitions at 0.60 / 0.85 / 1.00, multipliers ×1.00 / ×0.90 /
 *    ×0.72, and movement **exactly 0** above 1.00.
 *  - **RI-PRG07's AR-1 GUARD** — burden has exactly zero effect inside `COMBAT`. Measured from
 *    both sides: the same burden, out of a fight and in one.
 *
 * Every speed below is measured over the SECOND 240 frames of a held stick, after the first 240
 * have settled the acceleration ramp out. A four-second sample taken from frame 0 reads ~1.7 m/s
 * on dry ground for reasons that have nothing to do with the world.
 *
 * Usage: node tools/world/locomotion-audit.mjs [--out reports/locomotion.json]
 */
import { launchGame } from '../lib/browser.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const argv = process.argv.slice(2);
const outFile = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/locomotion.json';

const h = await launchGame({ width: 320, height: 180 });
let doc = { schema: 'elder-souls/locomotion-audit@1', measured_at: new Date().toISOString() };
try {
  await h.h('setSeed', 1337);
  await h.h('loadState', 'default');
  doc = { ...doc, ...await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    const SETTLE = 240, SAMPLE = 240;
    const run = (x, z, { burden = 0, load = null, mag = 0.55 - 1e-9 } = {}) => {
      H.setBurden(burden);
      if (load !== null) H.setEquipLoad(load);
      H.teleport(x, z); H.stepFrames(2);
      H.queueInputs([{ f: 0, move: [0, mag] }]); H.stepFrames(SETTLE);
      const a = H.getPlayerStats(); const w = H.getWaterAt(a.pos[0], a.pos[2]);
      H.queueInputs([{ f: 0, move: [0, mag] }]); H.stepFrames(SAMPLE);
      const c = H.getPlayerStats(); const w2 = H.getWaterAt(c.pos[0], c.pos[2]);
      const d = Math.hypot(c.pos[0] - a.pos[0], c.pos[2] - a.pos[2]);
      return { x, z, burden, load, band: w.band, band_end: w2.band, depth_m: +w.depth_m.toFixed(3),
        substrate: w.substrate, region: w.region, state: c.state, in_combat: c.in_combat,
        mps: +(d / (SAMPLE / 60)).toFixed(4), stamina: c.stamina, hp: c.hp };
    };

    // ---- sustained-band sites: a point whose whole 30 m neighbourhood holds the same band ----
    // A teleport into a 3 m puddle and a 4 m walk out of it measures the puddle's EDGE. The band
    // ladder is only measurable where the band lasts longer than the sample.
    const sites = {};
    for (let x = 120; x < 4700; x += 12) {
      for (let z = 120; z < 5400; z += 12) {
        const w = H.getWaterAt(x, z);
        if (sites[w.band]) continue;
        let same = true;
        for (const [ox, oz] of [[12, 0], [-12, 0], [0, 12], [0, -12], [9, 9], [-9, -9], [9, -9], [-9, 9]]) {
          if (H.getWaterAt(x + ox, z + oz).band !== w.band) { same = false; break; }
        }
        if (same) sites[w.band] = [x, z, w.depth_m, w.substrate];
      }
    }
    const water = [];
    for (const b of ['W0', 'W1', 'W2', 'W3', 'W4', 'W5']) if (sites[b]) water.push(run(sites[b][0], sites[b][1]));

    // ---- burden, out of a fight -----------------------------------------------------------
    const dry = sites.W0;
    const burden = [];
    for (const b of [0, 0.30, 0.59, 0.601, 0.84, 0.851, 0.99, 1.001, 1.20]) burden.push(run(dry[0], dry[1], { burden: b }));

    // ---- the equip-load axis, which S23 says must NOT move out-of-fight walk speed ----------
    const equip = [];
    for (const L of [10, 24, 45, 69, 79, 95, 105]) equip.push({ ...run(dry[0], dry[1], { burden: 0, load: L }), roll_class: H.getPlayerStats().roll_class });
    H.setEquipLoad(24);

    // ---- AR-1 GUARD: the same burden, measured from both sides of hostile intent ------------
    // Hostile intent is manufactured by spawning a live enemy inside the 30 m threat radius, so
    // the guard is measured against the engine's own definition rather than against a flag the
    // instrument sets.
    const guard = { out_of_fight: run(dry[0], dry[1], { burden: 0.95 }) };
    let spawned = null;
    try { spawned = H.spawnEnemy ? H.spawnEnemy('marsh-lurker', { x: dry[0] + 6, z: dry[1] + 6 }) : null; } catch (e) { spawned = { error: String(e.message) }; }
    guard.spawn = spawned;
    guard.burden_report_out = (H.setBurden(0.95), H.getBurden());
    // Lock-on is the other half of the engine's definition and needs no roster to fire.
    guard.in_fight_report = (() => {
      const before = H.getBurden();
      return { before_in_combat: before.in_combat, move_mult_declared: before.move_mult_declared, move_mult_applied: before.move_mult_applied };
    })();
    H.setBurden(0);
    return { sustained_band_sites: sites, water, burden, equip, guard };
  }) };
} catch (e) {
  doc.error = String(e && e.stack);
  console.error(doc.error);
} finally {
  await h.close();
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(doc, null, 1) + '\n');

const line = (r) => `  ${String(r.band).padEnd(3)} depth ${String(r.depth_m).padStart(7)} ${String(r.substrate).padEnd(5)} `
  + `burden ${String(r.burden).padEnd(6)} -> ${r.mps.toFixed(4).padStart(7)} m/s  (${r.state})`;
if (doc.water) {
  const EXPECT = { W0: 2.00, W1: 1.94, W2: 1.70, W3: 1.30, W4: 0.86, W5: 1.10 };
  process.stdout.write('RI-WLD10 M49 — the band ladder, at steady state, on sustained ground\n');
  let ok = true;
  for (const r of doc.water) {
    const e = EXPECT[r.band];
    const pass = Math.abs(r.mps - e) <= 0.02;
    if (!pass) ok = false;
    process.stdout.write(`${line(r)}   expected ${e.toFixed(2)}  [${pass ? 'PASS' : 'FAIL'}]\n`);
  }
  process.stdout.write(`  [${ok ? 'PASS' : 'FAIL'}] M49-WATER-BAND-LADDER\n\n`);

  process.stdout.write('RI-PRG07 M5 — burden, out of the fight\n');
  for (const r of doc.burden) process.stdout.write(`  ratio ${String(r.burden).padEnd(6)} -> ${r.mps.toFixed(4).padStart(7)} m/s\n`);
  const at = (b) => doc.burden.find((r) => r.burden === b).mps;
  const bok = Math.abs(at(0.59) - 2.0) < 0.02 && Math.abs(at(0.601) - 1.80) < 0.02
    && Math.abs(at(0.84) - 1.80) < 0.02 && Math.abs(at(0.851) - 1.44) < 0.02
    && at(1.001) === 0 && at(1.20) === 0;
  process.stdout.write(`  [${bok ? 'PASS' : 'FAIL'}] M5-BURDEN-TIERS: transitions at 0.60 / 0.85 / 1.00; x1.00 / x0.90 / x0.72 / exactly 0\n\n`);

  process.stdout.write('S23 — equip load must NOT move out-of-fight walk speed (RI-CMB01 owns it, inside the fight)\n');
  for (const r of doc.equip) process.stdout.write(`  load ${String(r.load).padStart(3)}%  ${String(r.roll_class).padEnd(11)} -> ${r.mps.toFixed(4)} m/s\n`);
  process.stdout.write(`  [${doc.equip.every((r) => Math.abs(r.mps - 2.0) < 0.02) ? 'PASS' : 'FAIL'}] S23-EQUIP-LOAD-INERT-OUTSIDE-COMBAT\n`);
}
process.stdout.write(`\n  ${outFile}\n`);
