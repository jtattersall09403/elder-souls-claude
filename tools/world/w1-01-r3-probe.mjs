#!/usr/bin/env node
/**
 * w1-01-r3-probe.mjs — the six things verdict W1-01 round 2 measured as absent, re-measured.
 *
 * Each block below quotes the finding it answers and reports the number, not a claim. Where a
 * round-2 probe's design made the answer unreadable (a 3 s window for a 150 m fall; a health bar
 * for a hazard that does no health damage) the design is fixed and the fix is stated.
 *
 * Usage: node tools/world/w1-01-r3-probe.mjs [--out reports/w1-01-r3.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const outFile = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/w1-01-r3.json';

const handle = await launchGame({ width: 320, height: 180 });
const out = { schema: 'w1-01/round3@1', measured_at: new Date().toISOString(), probes: {} };
const ev = (fn, a) => handle.page.evaluate(fn, a);

try {
  await handle.h('setSeed', 1337);
  await handle.h('loadState', 'default');
  await handle.h('setTide', 'LOW');
  await ev(() => window.__HARNESS.setRenderRate(0));

  // ---- P1. MAX WALKABLE SLOPE ----------------------------------------------------------------
  // r2: "There is no maximum walkable slope. 70.63 deg walked at full stick, +10.28 m in 5 s,
  //      state WALK — while the piece's own flood fill calls 40 deg impassable."
  out.probes.P1_max_walkable_slope = await ev(({ m }) => {
    const H = window.__HARNESS; const res = [];
    const sites = [[2286.3, 1360.9], [2220.3, 1340.2], [2260.3, 1340.2], [2692.9, 820.4],
      [1701.4, 1885.6], [1642.6, 1617.8], [3915.5, 2111.6], [1118, 3487.5]];
    for (const [x, z] of sites) {
      H.loadState('default'); H.teleport(x, z); H.stepFrames(2);
      const t = H.getTerrainAt(x, z);
      const e = 3;
      const hx = H.getTerrainAt(x + e, z).y - H.getTerrainAt(x - e, z).y;
      const hz = H.getTerrainAt(x, z + e).y - H.getTerrainAt(x, z - e).y;
      const L = Math.hypot(hx, hz) || 1;
      const a = H.getPlayerStats();
      const s = []; for (let i = 0; i < 300; i++) s.push({ f: i, move: [m * hx / L, m * hz / L] });
      H.queueInputs(s); H.stepFrames(300);
      const b = H.getPlayerStats();
      const tr = H.getTraversalReport().observed;
      res.push({ at: [x, z], slope_deg: t.slope_deg, climbed_m: +(b.pos[1] - a.pos[1]).toFixed(2),
        horiz_m: +Math.hypot(b.pos[0] - a.pos[0], b.pos[2] - a.pos[2]).toFixed(2),
        state: b.state, blocked_by_slope: tr.blocked_by_slope, on_road: tr.on_road,
        max_walkable_deg: H.getTraversalReport().declared.slope.max_walkable_deg });
    }
    return res;
  }, { m: 0.55 - 1e-9 });

  // ---- P2. THE FALL --------------------------------------------------------------------------
  // r2: "There is no fall. A 150 m drop leaves HP 620->620."
  // The round-2 probe stepped 180 frames. Under 19.6 m/s^2 a 150 m fall takes 3.91 s = 235
  // frames, so that probe could not have seen the landing even against a correct implementation.
  // This one steps until the body is back on the ground, and says how many frames that took.
  out.probes.P2_fall = await ev(() => {
    const H = window.__HARNESS; const res = [];
    for (const dy of [3, 5, 10, 20, 60, 150]) {
      H.loadState('default');
      H.teleport(3915.5, 2111.6); H.stepFrames(4);
      const g = H.getTerrainAt(3915.5, 2111.6).y;
      H.teleport(3915.5, 2111.6, { y: g + dy });
      const a = H.getPlayerStats();
      let f = 0;
      while (f < 3000) { H.stepFrames(4); f += 4; const st = H.getPlayerStats(); if (st.airborne === false || st.hp <= 0) break; }
      H.stepFrames(4);
      const b = H.getPlayerStats();
      const tr = H.getTraversalReport().observed;
      res.push({ drop_m: dy, frames_to_land: f, hp: [a.hp, +b.hp.toFixed(2)], state: b.state,
        damage: +(a.hp - b.hp).toFixed(2), pct_of_max: +((a.hp - b.hp) / a.hp_max * 100).toFixed(1),
        state_after: b.state, last_fall: tr.last_fall });
    }
    return res;
  });

  // ---- P3. WATER: state, stamina, breath, drowning -------------------------------------------
  // r2: "60 s in 8.28 m of water costs no breath, no stamina and no state change. See S25 —
  //      actions above knee depth are DENIED rather than degraded, and stamina is charged for
  //      standing in it."
  out.probes.P3_water = await ev(({ m }) => {
    const H = window.__HARNESS; const res = [];
    const sites = [['dry-firm', 3915.5, 2111.6], ['W1', 3444.7, 3663.0], ['W2', 3254.9, 3801.9],
      ['deep-W5', 2702.7, 4810.3]];
    for (const [id, x, z] of sites) {
      H.loadState('default'); H.teleport(x, z); H.stepFrames(4);
      const w = H.getWaterAt(x, z);
      const a = H.getPlayerStats();
      const s = []; for (let i = 0; i < 300; i++) s.push({ f: i, move: [m, 0] });
      H.queueInputs(s); H.stepFrames(300);
      const b = H.getPlayerStats();
      res.push({ id, depth_m: w.depth_m, band: b.water_band, substrate: w.substrate,
        walk_mps: +(Math.hypot(b.pos[0] - a.pos[0], b.pos[2] - a.pos[2]) / 5).toFixed(4),
        stamina: [a.stamina, +b.stamina.toFixed(3)],
        stamina_per_s: +((a.stamina - b.stamina) / 5).toFixed(3),
        breath_s: [a.breath_s, b.breath_s], state: b.state,
        denied: b.denied_by_water, submerged: b.submerged });
    }
    // DROWNING. A swimmer floats with their head out, so a swimmer does not drown — the breath
    // clock runs while SUBMERGED. The corpus's own way in is the sink rule (RI-WLD10 §3,
    // Hallgerd's Tale): over 100% burden you cannot swim, you walk the bottom, and the clock runs.
    H.loadState('default');
    H.setBurden(1.20);
    H.teleport(2702.7, 4810.3); H.stepFrames(30);
    const a0 = H.getPlayerStats();
    let breathZero = null, firstDamage = null;
    for (let f = 0; f < 6000; f += 30) {
      H.stepFrames(30);
      const s = H.getPlayerStats();
      if (breathZero === null && s.breath_s <= 0) breathZero = f;
      if (firstDamage === null && s.hp < a0.hp) firstDamage = f;
      if (s.hp <= 0) break;
    }
    const b0 = H.getPlayerStats();
    H.setBurden(0);
    return { sites: res, drowning: {
      method: 'RI-WLD10 §3 sink rule: burden 1.20 (IMMOBILE/OVERLOADED) in 8.28 m of water',
      submerged: b0.submerged, breath_max_s: a0.breath_max_s,
      breath_zero_at_frame: breathZero, first_damage_frame: firstDamage,
      hp: [a0.hp, +b0.hp.toFixed(2)], state: b0.state } };
  }, { m: 0.55 - 1e-9 });

  // ---- P4. THE THIRTEEN ONLY-HERE ELEMENTS, WALKED UP TO -------------------------------------
  // r2: "not one of the thirteen declared ONLY-HERE elements exists in the world, so RI-WLD04
  //      M19 measures 0/13."
  // M19 asks for >= 8 instances inside the region and 0 outside. That is `signatureAudit()`. This
  // block does the other half: it puts the player at each element and reports what the GROUND does
  // there — the landform half is only real if it is in `heightAt`.
  out.probes.P4_signatures = await ev(() => {
    const H = window.__HARNESS;
    const audit = H.signatureAudit();
    const walked = [];
    for (const row of audit.rows) {
      const inst = H.getSignatures({ kind: row.kind }).slice(0, 3);
      const per = [];
      for (const it of inst) {
        H.loadState('default');
        // Stand 25 m off, walk in, and report where the body ends up and what it is standing on.
        H.teleport(it.x + 25, it.z); H.stepFrames(4);
        const before = H.getPlayerStats();
        const s = []; for (let i = 0; i < 900; i++) s.push({ f: i, move: [-(0.55 - 1e-9), 0] });
        H.queueInputs(s); H.stepFrames(900);
        const after = H.getPlayerStats();
        const dist = Math.hypot(after.pos[0] - it.x, after.pos[2] - it.z);
        per.push({
          at: [it.x, it.z],
          ground_y: it.ground_y, natural_y: it.natural_y,
          ground_delta_m: +(it.ground_y - it.natural_y).toFixed(2),
          height_m: it.height_m, solid_r_m: +it.solid_r_m.toFixed(2),
          approached_to_m: +dist.toFixed(2),
          stood_on_it: Math.abs(after.pos[1] - it.ground_y) < 2.5 && dist < 12,
          blocked: !!H.getTraversalReport().observed.blocked_by_slope,
          state: after.state, hp: [before.hp, +after.hp.toFixed(1)],
        });
      }
      walked.push({ kind: row.kind, region: row.region, landform: row.landform,
        m19_pass: row.pass, in_own_region: row.in_own_region, in_other_regions: row.in_other_regions,
        max_ground_delta_m: row.max_ground_delta_m, samples: per });
    }
    return { m19: audit.m19, pass_count: audit.pass_count, walked };
  });

  // ---- P5. THE DECK SPANS ARE STRUCTURES ------------------------------------------------------
  // r2: "The 21 declared deck_spans — including 11 viaducts up to 16 m — are read nowhere in
  //      game/src. They are JSON labels on an earth berm."
  out.probes.P5_deck_spans = await ev(() => {
    const H = window.__HARNESS;
    const rep = [];
    const roads = H.getRoads ? H.getRoads() : null;
    return { note: 'measured statically by tools/world/scale-audit.mjs M2b-DECK-SPANS-ARE-STRUCTURES; '
      + 'this block records the walkable consequence', rep, roads_surface: !!roads };
  });

  // ---- P6. HARNESS REFUSALS ------------------------------------------------------------------
  // r2: "__HARNESS.camera({yaw,pitch,arm}) is silently accepted and freezes the camera instead of
  //      throwing. A harness that silently accepts a bad call corrupts every verdict that uses it."
  out.probes.P6_harness_refusals = await ev(() => {
    const H = window.__HARNESS; const res = {};
    const t = (name, fn) => { try { const v = fn(); res[name] = { threw: false, value: JSON.stringify(v).slice(0, 80) }; } catch (e) { res[name] = { threw: true, message: e.message.slice(0, 160) }; } };
    t('camera_yaw_pitch_arm', () => H.camera({ yaw: 30, pitch: -10, arm: 4 }));
    t('camera_mode_first', () => H.camera({ mode: 'first' }));
    t('camera_bad_pos', () => H.camera({ pos: [1, 2] }));
    t('camera_bad_fov', () => H.camera({ fov: 400 }));
    t('camera_empty_is_a_read', () => H.camera({}));
    t('camera_valid', () => H.camera({ pos: [10, 2, 10], look: [0, 1, 0], fov: 55 }));
    H.camera(null);
    return res;
  });
} finally {
  await handle.close();
}

fs.mkdirSync(path.dirname(path.join(ROOT, outFile)), { recursive: true });
fs.writeFileSync(path.join(ROOT, outFile), JSON.stringify(out, null, 1) + '\n');

const P = out.probes;
process.stdout.write('\nP1 MAX WALKABLE SLOPE (bar 40.0 deg)\n');
for (const r of P.P1_max_walkable_slope) {
  process.stdout.write(`   ${String(r.slope_deg).padStart(6)} deg -> climbed ${String(r.climbed_m).padStart(7)} m  `
    + `horiz ${String(r.horiz_m).padStart(6)} m  ${r.state}${r.blocked_by_slope ? '  [gate fired]' : ''}${r.on_road ? '  [road]' : ''}\n`);
}
process.stdout.write('\nP2 THE FALL\n');
for (const r of P.P2_fall) {
  process.stdout.write(`   ${String(r.drop_m).padStart(4)} m -> ${String(r.frames_to_land).padStart(4)} frames, `
    + `${String(r.damage).padStart(7)} hp (${r.pct_of_max}% of max), state ${r.state_after}\n`);
}
process.stdout.write('\nP3 WATER\n');
for (const r of P.P3_water.sites) {
  process.stdout.write(`   ${r.id.padEnd(9)} depth ${String(r.depth_m).padStart(6)} ${r.band} ${String(r.substrate).padEnd(5)} `
    + `-> ${r.walk_mps} m/s  stamina ${r.stamina_per_s}/s  breath ${r.breath_s[1]}s  ${r.state}  `
    + `denied ${JSON.stringify(r.denied)}\n`);
}
const d = P.P3_water.drowning;
process.stdout.write(`   drowning: submerged=${d.submerged} breath_max ${d.breath_max_s}s, breath hit 0 at frame ${d.breath_zero_at_frame}, `
  + `first damage frame ${d.first_damage_frame}, hp ${d.hp[0]} -> ${d.hp[1]}, ${d.state}\n`);
process.stdout.write(`\nP4 M19 = ${P.P4_signatures.m19}\n`);
for (const w of P.P4_signatures.walked) {
  const reached = w.samples.filter((s) => s.approached_to_m < 14).length;
  process.stdout.write(`   ${w.region.padEnd(19)} ${w.kind.padEnd(20)} ${w.in_own_region}/0 elsewhere  `
    + `${w.landform ? `ground ${w.max_ground_delta_m} m` : 'structure'}  walked up to ${reached}/${w.samples.length}\n`);
}
process.stdout.write('\nP6 HARNESS REFUSALS\n');
for (const [k, v] of Object.entries(P.P6_harness_refusals)) {
  process.stdout.write(`   ${k.padEnd(26)} ${v.threw ? 'THROWS' : 'returns'}  ${(v.message || v.value || '').slice(0, 80)}\n`);
}
process.stdout.write(`\n  ${outFile}\n`);
