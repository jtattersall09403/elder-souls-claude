#!/usr/bin/env node
/**
 * critic-locomotion-probe.mjs — W1-01 CRITIC instrument (not a builder tool).
 *
 * S17 says the hour is distance, never slow walking. RI-WLD01 M3 tests that from ONE side:
 * it samples speed ON THE ROAD and fails if >8% of samples are slow. This probe tests it from
 * the OTHER side, which M3 cannot see:
 *
 *   P1  realized ground speed at full walk stick on flat road, on a steep slope, in standing
 *       water, and off-road in each of five regions — is 2.0 m/s a road-only figure?
 *   P2  acceleration: frames from stick-down to 2.0 m/s (a long ramp pads the clock and never
 *       shows as a sub-1.6 sample once it is averaged over 6-frame windows)
 *   P3  turn rate: degrees/frame while walking a 180-degree reversal
 *   P4  stamina at rest and after 60 s of walking (a movement drain would be a Souls leak
 *       into the world AND a friction tax)
 *   P5  jog / sprint / swim / wade realized speeds against RI-WLD01 §2's declared table
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, REPO_ROOT, ensureDir, gitInfo, log } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
const out = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports', 'critic-locomotion.json')));
ensureDir(path.dirname(out));

const h = await launchGame({ ...args, width: 640, height: 360 });
const R = { schema: 'critic/locomotion@1', measured_at: new Date().toISOString(), git: gitInfo(), probes: {} };

/** Drive the player from (x,z) on a fixed bearing for n frames at stick magnitude mag. */
async function drive(x, z, bearingDeg, mag, frames) {
  return await h.page.evaluate(({ x, z, bearingDeg, mag, frames }) => {
    const H = window.__HARNESS;
    H.teleport(x, z);
    const e = H._engine || null;
    const b = bearingDeg * Math.PI / 180;
    const mv = [Math.sin(b) * mag, Math.cos(b) * mag];
    const st = [];
    let prev = H.getPlayerStats();
    const p0 = [prev.pos[0], prev.pos[1], prev.pos[2]];
    for (let i = 0; i < frames; i++) {
      H.queueInputs([{ f: 0, move: mv }]);
      H.stepFrames(1);
      const s = H.getPlayerStats();
      st.push({
        f: i,
        sp: Math.hypot(s.pos[0] - prev.pos[0], s.pos[2] - prev.pos[2]) * 60,
        y: s.pos[1],
        yaw: s.yaw,
        stam: s.stamina !== undefined ? s.stamina : (s.stam !== undefined ? s.stam : null),
      });
      prev = s;
    }
    const last = H.getPlayerStats();
    return { start: p0, end: [last.pos[0], last.pos[1], last.pos[2]], steps: st, stats: last };
  }, { x, z, bearingDeg, mag, frames });
}

const WALK = 0.55 - 1e-9;
const summarise = (r, skip = 60) => {
  const sp = r.steps.slice(skip).map((s) => s.sp);
  sp.sort((a, b) => a - b);
  const mean = sp.reduce((a, v) => a + v, 0) / sp.length;
  return { n: sp.length, mean: +mean.toFixed(4), median: +sp[sp.length >> 1].toFixed(4), min: +sp[0].toFixed(4), max: +sp[sp.length - 1].toFixed(4) };
};

try {
  await h.h('setSeed', 1337);
  await h.h('loadState', 'default');
  await h.h('setTide', 'LOW');

  // ---- P1: realized walk speed on different ground -------------------------------------------
  // Sites: on the crossing road; the steepest ground on Valus Ridge; standing water in the
  // Deep Marshes; and one off-road point in each of five regions.
  const sites = [
    ['road-stormhold-helstrom', 2210, 1200],
    ['valus-ridge-high', 1701.4, 1885.6],
    ['valus-ridge-steep', 1642.6, 1617.8],
    ['deep-marshes-water', 3184.6, 3463.9],
    ['deep-marshes-water2', 3254.9, 3801.9],
    ['blackwood-offroad', 1558.9, 3432.7],
    ['salt-hills-slope', 2426.4, 737.2],
    ['stone-wastes-flat', 853.3, 5047.4],
    ['eastern-rootlands', 3147.0, 4723.7],
    ['clay-moor', 3650.7, 2098.6],
  ];
  R.probes.P1 = [];
  for (const [id, x, z] of sites) {
    const ctx = await h.page.evaluate(({ x, z }) => {
      const H = window.__HARNESS;
      const t = H.getTerrainAt(x, z), w = H.getWaterAt(x, z);
      return { terrain: t, water: w, region: H.getRegionAt(x, z) };
    }, { x, z });
    const r = await drive(x, z, 90, WALK, 300);
    const s = summarise(r);
    R.probes.P1.push({ site: id, x, z, region: ctx.region && (ctx.region.id || ctx.region), terrain: ctx.terrain, water: ctx.water, walk_speed: s });
    log(`P1 ${id.padEnd(26)} mean ${s.mean} m/s  (min ${s.min} max ${s.max})`);
  }

  // ---- P2: acceleration ramp ------------------------------------------------------------------
  {
    const r = await drive(2210, 1200, 90, WALK, 60);
    const first = r.steps.slice(0, 20).map((s) => +s.sp.toFixed(4));
    const idx = r.steps.findIndex((s) => s.sp >= 1.99);
    R.probes.P2 = { first_20_frame_speeds: first, frames_to_1_99_mps: idx, note: 'frames from stick-down to 1.99 m/s' };
    log(`P2 frames to 1.99 m/s = ${idx}`);
  }

  // ---- P3: turn rate --------------------------------------------------------------------------
  {
    const r = await h.page.evaluate(() => {
      const H = window.__HARNESS;
      H.teleport(2210, 1200);
      const mag = 0.55 - 1e-9;
      // settle heading east
      for (let i = 0; i < 120; i++) { H.queueInputs([{ f: 0, move: [mag, 0] }]); H.stepFrames(1); }
      const yaws = [];
      for (let i = 0; i < 120; i++) { H.queueInputs([{ f: 0, move: [-mag, 0] }]); H.stepFrames(1); yaws.push(H.getPlayerStats().yaw); }
      return yaws;
    });
    const d = [];
    for (let i = 1; i < r.length; i++) { let a = r[i] - r[i - 1]; while (a > 180) a -= 360; while (a < -180) a += 360; d.push(Math.abs(a)); }
    R.probes.P3 = { max_deg_per_frame: +Math.max(...d).toFixed(3), max_deg_per_s: +(Math.max(...d) * 60).toFixed(1), yaw_series_first_30: r.slice(0, 30).map((v) => +v.toFixed(2)) };
    log(`P3 max turn ${R.probes.P3.max_deg_per_s} deg/s`);
  }

  // ---- P4: stamina while walking ---------------------------------------------------------------
  {
    const r = await h.page.evaluate(() => {
      const H = window.__HARNESS;
      H.teleport(2210, 1200);
      const before = H.getPlayerStats();
      const mag = 0.55 - 1e-9;
      for (let i = 0; i < 3600; i++) { H.queueInputs([{ f: 0, move: [mag, 0] }]); H.stepFrames(1); }
      const after = H.getPlayerStats();
      return { before, after };
    });
    R.probes.P4 = { before: r.before, after: r.after };
    log('P4 stamina before/after 60 s walk captured');
  }

  // ---- P5: the whole speed table ---------------------------------------------------------------
  {
    R.probes.P5 = [];
    for (const [label, mag, x, z] of [['walk', WALK, 2210, 1200], ['jog', 1.0, 2210, 1200], ['walk-in-water', WALK, 3184.6, 3463.9], ['jog-in-water', 1.0, 3184.6, 3463.9]]) {
      const r = await drive(x, z, 90, mag, 300);
      R.probes.P5.push({ label, mag, x, z, speed: summarise(r) });
      log(`P5 ${label.padEnd(14)} mean ${summarise(r).mean} m/s`);
    }
  }
} finally { await h.close(); }

fs.writeFileSync(out, JSON.stringify(R, null, 2) + '\n');
process.stdout.write(`\n${out}\n`);
