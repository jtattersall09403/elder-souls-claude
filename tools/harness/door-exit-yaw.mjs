#!/usr/bin/env node
// door-exit-yaw.mjs — WHICH WAY ARE YOU FACING WHEN A DOOR PUTS YOU DOWN?
//
// The defect (reports/spawn-truth/2026-08-14-spawn-truth.md §3): `sim/settlement.js`'s
// `useDoor()` and `leaveInterior()` place the body through `placeBody()`, which writes POSITION
// AND NEVER ORIENTATION. Whatever you faced the instant before a door teleport is what you face
// the instant after, on all 115 interiors in the game. The first frame a new player controls is
// the writ house door at Thorn, and it is a wall.
//
// WHAT THIS MEASURES, and why it is a number and not an opinion.
//
// For every interior in the shipped tree this tool stands the body on the interior's own exit
// point, lets the world settle, and then asks the SAME collision set the body is solved against
// and the camera arm casts into (`Engine.solidAt` -> `sim.cell.contains`, which is the town cell
// `_settleSettlementSolids()` builds from `settlementSolidsNear()`) one question, for each
// candidate facing:
//
//   **how far can you walk before a wall, at eye height, along the way you are facing?**
//
// It marches out in 0.25 m steps to `--reach` metres and returns the first solid. That is
// `clearance_m`. A player put down facing a wall measures a fraction of a metre; a player put
// down facing the street measures the cap.
//
// It scores every candidate RULE at once from the one standing point, so the rules can be
// compared before any of them is written into the game:
//
//   `as_shipped`  the yaw the body actually has after the placement — i.e. whatever it was
//                 before, which is the defect, seeded adversarially (see `--seed-yaw`)
//   `outward`     `door_world_bearing_deg`, the interior record's own declared outward normal
//   `inward`      `door_world_bearing_deg + 180` — THE NULL CONTROL, and it is the plausible
//                 wrong answer, not the trivial one: a yaw IS written, from the door's own
//                 normal, but off the wrong end of it, so the player faces the wall they came
//                 through. If the check cannot tell `outward` from `inward` the check is worthless.
//   `from_door`   away from `door_world_pos` — "face the way you just walked"
//   `best`        the best of 36 ten-degree bearings — the ceiling this standing point can offer,
//                 so a bad RULE can be told apart from a bad POINT
//
// and the same for the way IN, in the room's own local frame.
//
// USAGE
//   node tools/harness/door-exit-yaw.mjs [--json <path>] [--limit N] [--only id,id]
//                                        [--reach 12] [--seed-yaw 200] [--no-enter]
'use strict';

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
door-exit-yaw.mjs — clearance, in metres, along the way a door leaves you facing.

USAGE
  node tools/harness/door-exit-yaw.mjs [--json <path>] [--limit N] [--only a,b]
                                       [--reach 12] [--seed-yaw 200] [--no-enter]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const REACH = Number(args.reach || 12);
const SEED_YAW = args['seed-yaw'] === undefined ? 200 : Number(args['seed-yaw']);
const DO_ENTER = !args['no-enter'];
const outDir = path.join(REPORTS_DIR, 'door-yaw');
ensureDir(outDir);
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(outDir, 'door-exit-yaw.json');
const say = (s) => process.stdout.write(s + '\n');

// The in-page half, as a source string so it is installed once and called per interior. Kept out
// of a single giant `page.evaluate` deliberately: a 115-interior sweep inside one call is one
// opaque blocking promise, and when the first version of this tool hung there was no way to tell
// which interior it hung on. One call per interior gives Node a progress line and a timeout it
// can attribute.
const IN_PAGE = `
window.__DXY = {
  d2r: Math.PI / 180,
  fwd(yaw) { const r = yaw * this.d2r; return [Math.sin(r), Math.cos(r)]; },
  norm(a) { return ((a % 360) + 360) % 360; },
  clearance(x, z, yaw, eye, reach) {
    const E = window.__ENGINE, f = this.fwd(yaw);
    for (let d = 0.25; d <= reach + 1e-9; d += 0.25) {
      const q = E.solidAt(x + f[0] * d, eye, z + f[1] * d);
      if (q && q.solid) return +(d - 0.25).toFixed(2);
    }
    return reach;
  },
  best(x, z, eye, reach) {
    let bv = -1, by = 0;
    for (let a = 0; a < 360; a += 10) { const c = this.clearance(x, z, a, eye, reach); if (c > bv) { bv = c; by = a; } }
    return { clearance_m: bv, yaw_deg: by };
  },
};
`;

const main = async () => {
  const g = await launchGame({ width: 640, height: 360 });
  const { page } = g;
  await g.h('ready');
  await page.evaluate(IN_PAGE);
  const ids = await page.evaluate(() => Object.keys(window.__ENGINE.data.interiors).sort());
  const only = args.only ? String(args.only).split(',').map((s) => s.trim()) : null;
  const list = (only ? ids.filter((i) => only.includes(i)) : ids).slice(0, args.limit ? Number(args.limit) : 1e9);

  const out = {
    schema: 'elder-souls/door-exit-yaw@1',
    generated_at: new Date().toISOString(),
    loadavg: readFileSync('/proc/loadavg', 'utf8').trim(),
    reach_m: REACH, seed_yaw_deg: SEED_YAW, enter_measured: DO_ENTER,
    rows: [],
  };
  try {
    let n = 0;
    for (const id of list) {
      const t0 = Date.now();
      const row = await page.evaluate(async (o) => {
        const H = window.__HARNESS, E = window.__ENGINE, X = window.__DXY;
        const rec = E.data.interiors[o.id];
        const cont = (rec && rec.continuity) || {};
        const spawn = cont.exterior_spawn || rec.exterior_door;
        const isp = cont.interior_spawn;
        if (!spawn || !isp) return { id: o.id, skipped: 'no continuity vectors' };
        const bearing = Number(rec.door_world_bearing_deg);
        const dw = rec.door_world_pos;

        // ---- the way OUT ----------------------------------------------------------------------
        // Stand the body where `leaveInterior()` stands it, with an ADVERSARIAL prior yaw: the
        // defect is precisely that the prior yaw survives, so any rule that ignores it must be
        // blind to this number.
        H.teleport(spawn[0], spawn[2], { yaw: o.seed });
        H.stepFrames(6);
        const p = E.sim.player.pos;
        const eye = p[1] + 1.6;
        const cands = {
          as_shipped: X.norm(E.sim.player.yaw),
          outward: X.norm(bearing),
          inward: X.norm(bearing + 180),
          from_door: dw ? X.norm(Math.atan2(spawn[0] - dw[0], spawn[2] - dw[2]) / X.d2r) : null,
        };
        const exit = { pos: [+p[0].toFixed(2), +p[1].toFixed(2), +p[2].toFixed(2)], rules: {} };
        for (const k of Object.keys(cands)) {
          exit.rules[k] = cands[k] === null ? null
            : { yaw_deg: +cands[k].toFixed(1), clearance_m: X.clearance(p[0], p[2], cands[k], eye, o.reach) };
        }
        exit.best = X.best(p[0], p[2], eye, o.reach);
        exit.drift_m = +Math.hypot(p[0] - spawn[0], p[2] - spawn[2]).toFixed(2);
        try {
          exit.inside_a_building = !!(E.renderer && E.renderer.province && E.renderer.province.buildingAt(p[0], p[2]));
        } catch (e) { exit.inside_a_building = null; }

        // ---- the way IN, in the room's own local frame ------------------------------------------
        let enter = null;
        if (o.doEnter) {
          enter = { rules: {} };
          try {
            H.enterInterior(o.id);
            H.stepFrames(6);
            const q = E.sim.player.pos;
            const eye2 = q[1] + 1.6;
            const bm = rec.bounds_m || null;
            const cx = bm ? (bm.x[0] + bm.x[1]) / 2 : 0, cz = bm ? (bm.z[0] + bm.z[1]) / 2 : 0;
            const sideBase = cont.entry_side === 'north' ? 0 : 180;
            const inCands = {
              as_shipped: X.norm(E.sim.player.yaw),
              to_centre: X.norm(Math.atan2(cx - q[0], cz - q[2]) / X.d2r),
              entry_side_in: X.norm(sideBase + 180),
              entry_side_out: X.norm(sideBase),
            };
            for (const k of Object.keys(inCands)) {
              enter.rules[k] = { yaw_deg: +inCands[k].toFixed(1), clearance_m: X.clearance(q[0], q[2], inCands[k], eye2, o.reach) };
            }
            enter.best = X.best(q[0], q[2], eye2, o.reach);
            enter.pos = [+q[0].toFixed(2), +q[1].toFixed(2), +q[2].toFixed(2)];
            H.exitInterior();
            H.stepFrames(2);
          } catch (e) { enter.error = String((e && e.message) || e); }
        }
        return { id: o.id, settlement: rec.settlement, entry_side: cont.entry_side, bearing_deg: bearing, exit, enter };
      }, { id, seed: SEED_YAW, reach: REACH, doEnter: DO_ENTER });
      row.ms = Date.now() - t0;
      out.rows.push(row);
      n++;
      if (n % 10 === 0 || list.length <= 8) say(`  ${n}/${list.length} ${id} (${row.ms} ms)`);
    }
  } finally { await g.close(); }

  // ---- roll-up -------------------------------------------------------------------------------
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const gather = (side, rule) => out.rows.map((r) => (r[side] && r[side].rules && r[side].rules[rule] ? r[side].rules[rule].clearance_m : null)).filter((v) => v !== null);
  out.summary = { n: out.rows.length, exit: {}, enter: {} };
  for (const rule of ['as_shipped', 'outward', 'inward', 'from_door']) {
    const v = gather('exit', rule);
    if (!v.length) continue;
    out.summary.exit[rule] = { n: v.length, median_m: med(v), mean_m: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2),
      under_2m: v.filter((x) => x < 2).length, at_cap: v.filter((x) => x >= REACH).length };
  }
  {
    const v = out.rows.map((r) => (r.exit && r.exit.best ? r.exit.best.clearance_m : null)).filter((x) => x !== null);
    if (v.length) out.summary.exit.best = { n: v.length, median_m: med(v), under_2m: v.filter((x) => x < 2).length };
    out.summary.exit.inside_a_building = out.rows.filter((r) => r.exit && r.exit.inside_a_building).length;
  }
  for (const rule of ['as_shipped', 'to_centre', 'entry_side_in', 'entry_side_out']) {
    const v = gather('enter', rule);
    if (!v.length) continue;
    out.summary.enter[rule] = { n: v.length, median_m: med(v), under_2m: v.filter((x) => x < 2).length };
  }
  writeJson(jsonPath, out);
  say(`door-exit-yaw: ${out.rows.length} interiors, reach cap ${REACH} m, seed yaw ${SEED_YAW}°`);
  say('  EXIT — clearance (m) along the facing each rule gives:');
  for (const [k, v] of Object.entries(out.summary.exit)) {
    if (k === 'inside_a_building') { say(`    ${String(k).padEnd(14)} ${v} of ${out.rows.length} exit points are inside a building footprint`); continue; }
    say(`    ${String(k).padEnd(14)} median ${String(v.median_m).padStart(6)}  under 2 m: ${String(v.under_2m).padStart(3)}/${v.n}${v.at_cap !== undefined ? `  at cap: ${v.at_cap}` : ''}`);
  }
  say('  ENTER — clearance (m), interior local frame:');
  for (const [k, v] of Object.entries(out.summary.enter)) {
    say(`    ${String(k).padEnd(14)} median ${String(v.median_m).padStart(6)}  under 2 m: ${String(v.under_2m).padStart(3)}/${v.n}`);
  }
  say(`  json: ${path.relative(REPO_ROOT, jsonPath)}`);
};

main().catch((e) => { console.error(e); process.exit(1); });
