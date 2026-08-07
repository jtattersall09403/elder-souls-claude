#!/usr/bin/env node
// blade-height.mjs — where the weapon actually IS, in metres above the floor.
//
// The renderer landed and the swing became visible: on a halberd you watch a bare haft stab
// into the dirt, and on a greatsword the blade lies in the ground several metres ahead. The
// numbers that describe that, and which nothing in the project measured before, are:
//
//   tip_y_min / tip_y_max   the drawn tip's world height over the whole clip, metres
//   frames_above_ground     frames on which the tip is at y > 0
//   incl_rest_deg           blade inclination (below horizontal, -ve = pointing down) at frame 1
//   incl_peak_deg           inclination at the frame the tip is deepest
//   b_m                     the solved blade length, `MovesetLibrary._bladeLength`
//   r_max_m                 the tip's max HORIZONTAL radius from the actor root, the number the
//                           blade-length solve is fitted to, so it must stay == reach_m
//
// It reads the shipped modules with no engine and no browser, the same way measure.mjs does,
// so it is fast enough to run over all 87 weapons in a second and a critic can re-run it.
//
// Usage:
//   node tools/weapons/blade-height.mjs [--json out.json] [--weapon <id>] [--slots r1.1,r1.2]
//         [--data <dir>]   read game data from somewhere other than game/data (the delete-the-fix
//                          test runs the tool against a shadow tree with the fix removed)
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Rig } from '../../game/src/combat/skeleton.js';
import { MovesetLibrary } from '../../game/src/combat/moveset.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf('--' + k);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const DATA = path.resolve(ROOT, arg('data', 'game/data'));
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(DATA, p), 'utf8'));

const CLASSES = readJson('weapons/classes.json');
const REG = readJson('weapons/clip-registry.json');
const SKEL = readJson('combat/skeleton.json');
const HITGEO = readJson('combat/hitgeometry.json');

const movesets = {};
for (const f of fs.readdirSync(path.join(DATA, 'combat/movesets'))) {
  if (!f.endsWith('.json')) continue;
  const doc = readJson('combat/movesets/' + f);
  if (doc.schema !== 'elder-souls/moveset@1') continue;
  movesets[doc.weapon_id] = doc;
}

const lib = new MovesetLibrary(REG, CLASSES, movesets, SKEL, HITGEO);
// The body band `MovesetLibrary._bladeLength` solves against, recomputed here from the same two
// data files rather than read off the library, so this tool is an independent check of it.
const BAND = (() => {
  const rig = new Rig(SKEL, HITGEO);
  for (let i = 0; i < rig.rx.length; i++) { rig.rx[i] = 0; rig.ry[i] = 0; rig.rz[i] = 0; }
  rig.evaluate([0, 0, 0], 0, 0, 0, 0);
  let lo = Infinity, hi = -Infinity;
  for (const h of rig.hurtboxes) {
    lo = Math.min(lo, h.a[1] - h.r, h.b[1] - h.r);
    hi = Math.max(hi, h.a[1] + h.r, h.b[1] + h.r);
  }
  return { lo, hi };
})();
const only = arg('weapon', null);
const SLOTS = String(arg('slots', 'r1.1')).split(',').filter(Boolean);
const WIDS = (only ? [only] : Object.keys(movesets)).sort();

/** Inclination of the blade axis in degrees; 0 = horizontal, -90 = straight down. */
function inclination(ax, ay, az) {
  const h = Math.hypot(ax, az);
  return Math.atan2(ay, h) * 180 / Math.PI;
}

const rows = [];
for (const w of WIDS) {
  const ms = movesets[w];
  for (const slotId of SLOTS) {
    if (!ms.slots[slotId]) continue;
    const clip = lib.clipFor(w, slotId);
    const sock = lib.socketsFor(w, slotId);
    const rig = new Rig(SKEL, HITGEO);
    const slot = ms.slots[slotId];
    const startup = slot.startup_f + (slot.charge_max_f || 0);
    const activeLast = startup + slot.active_f;
    const pos = [0, 0, 0];
    let tipMin = Infinity, tipMax = -Infinity, above = 0, n = 0;
    let inclRest = null, inclDeep = null, deepest = Infinity;
    let rMax = 0, rMaxActive = 0, rBody = 0;
    let tipMinActive = Infinity, tipMaxActive = -Infinity, aboveActive = 0, nActive = 0;
    const perFrame = [];
    for (let f = 1; f <= clip.total; f++) {
      pos[2] = clip.rootForwardAt(f);
      clip.applyPose(rig, f);
      rig.evaluate(pos, 0, clip.rootOffsetYAt(f), sock.a, sock.b);
      const tip = [rig.socketB[0], rig.socketB[1], rig.socketB[2]];
      const grip = [rig.socketA[0], rig.socketA[1], rig.socketA[2]];
      const ax = tip[0] - grip[0], ay = tip[1] - grip[1], az = tip[2] - grip[2];
      const inc = inclination(ax, ay, az);
      const r = Math.hypot(tip[0] - pos[0], tip[2] - pos[2]);
      n++;
      if (tip[1] < tipMin) tipMin = tip[1];
      if (tip[1] > tipMax) tipMax = tip[1];
      if (tip[1] > 0) above++;
      if (r > rMax) rMax = r;
      if (tip[1] < deepest) { deepest = tip[1]; inclDeep = inc; }
      if (f === 1) inclRest = inc;
      // Reach AT THE HEIGHT OF A BODY — the quantity `reach_m` names ("the largest distance at
      // which a hit fires", RI-WPN02 M1 C1). Walk the capsule from the grip to the tip and keep
      // the widest horizontal radius of any point of it that is inside the body band.
      const inActive = f > startup && f <= activeLast;
      if (inActive) {
        const ux = (tip[0] - grip[0]) / (sock.b - sock.a), uy = (tip[1] - grip[1]) / (sock.b - sock.a),
          uz = (tip[2] - grip[2]) / (sock.b - sock.a);
        const N = 64;
        for (let i = 0; i <= N; i++) {
          const d = sock.a + (sock.b - sock.a) * (i / N);
          const py = grip[1] + uy * (d - sock.a);
          if (py < BAND.lo || py > BAND.hi) continue;
          const pr = Math.hypot(grip[0] + ux * (d - sock.a) - pos[0], grip[2] + uz * (d - sock.a) - pos[2]);
          if (pr > rBody) rBody = pr;
        }
      }
      if (inActive) {
        nActive++;
        if (tip[1] < tipMinActive) tipMinActive = tip[1];
        if (tip[1] > tipMaxActive) tipMaxActive = tip[1];
        if (tip[1] > 0) aboveActive++;
        if (r > rMaxActive) rMaxActive = r;
      }
      perFrame.push({ f, y: +tip[1].toFixed(3), r: +r.toFixed(3), incl: +inc.toFixed(1), active: inActive });
    }
    rows.push({
      weapon: w, class: ms.class, slot: slotId, reach_m: ms.reach_m,
      b_m: sock.b, frames: n,
      tip_y_min: +tipMin.toFixed(3), tip_y_max: +tipMax.toFixed(3),
      frames_above_ground: above,
      active_frames: nActive,
      active_tip_y_min: +tipMinActive.toFixed(3), active_tip_y_max: +tipMaxActive.toFixed(3),
      active_frames_above_ground: aboveActive,
      incl_rest_deg: +inclRest.toFixed(1), incl_deepest_deg: +inclDeep.toFixed(1),
      r_max_m: +rMax.toFixed(3), r_max_active_m: +rMaxActive.toFixed(3),
      reach_body_m: +rBody.toFixed(3),
      reach_err_m: +(rBody - ms.reach_m).toFixed(4),
      reach_err_tipradius_m: +(rMaxActive - ms.reach_m).toFixed(4),
      per_frame: perFrame,
    });
  }
}

// ---- roll-up by class ------------------------------------------------------------------------
const byClass = {};
for (const r of rows) {
  const c = (byClass[r.class] = byClass[r.class] || {
    class: r.class, weapons: 0, tip_y_min: Infinity, tip_y_max: -Infinity,
    frames: 0, above: 0, active_frames: 0, active_above: 0,
    incl_rest: [], incl_deep: [], reach_err_abs_max: 0,
  });
  c.weapons++;
  c.tip_y_min = Math.min(c.tip_y_min, r.tip_y_min);
  c.tip_y_max = Math.max(c.tip_y_max, r.tip_y_max);
  c.frames += r.frames; c.above += r.frames_above_ground;
  c.active_frames += r.active_frames; c.active_above += r.active_frames_above_ground;
  c.incl_rest.push(r.incl_rest_deg); c.incl_deep.push(r.incl_deepest_deg);
  c.reach_err_abs_max = Math.max(c.reach_err_abs_max, Math.abs(r.reach_err_m));
  c.reach_short = (c.reach_short || 0) + (r.reach_err_m < -0.10 ? 1 : 0);
}
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const classRows = Object.values(byClass).map((c) => ({
  class: c.class, weapons: c.weapons,
  tip_y_min: +c.tip_y_min.toFixed(3), tip_y_max: +c.tip_y_max.toFixed(3),
  frames_above_ground: `${c.above}/${c.frames}`,
  active_frames_above_ground: `${c.active_above}/${c.active_frames}`,
  incl_rest_deg_mean: +mean(c.incl_rest).toFixed(1),
  incl_deepest_deg_mean: +mean(c.incl_deep).toFixed(1),
  reach_err_abs_max_m: +c.reach_err_abs_max.toFixed(4),
  reach_short_gt_10cm: c.reach_short || 0,
})).sort((a, b) => a.class.localeCompare(b.class));

const totFrames = rows.reduce((s, r) => s + r.frames, 0);
const totAbove = rows.reduce((s, r) => s + r.frames_above_ground, 0);
const totActive = rows.reduce((s, r) => s + r.active_frames, 0);
const totActiveAbove = rows.reduce((s, r) => s + r.active_frames_above_ground, 0);
const summary = {
  generated_by: 'tools/weapons/blade-height.mjs',
  data_dir: path.relative(ROOT, DATA),
  weapons: WIDS.length, slots_measured: rows.length,
  frames_above_ground: `${totAbove}/${totFrames}`,
  frames_above_ground_pct: +(100 * totAbove / totFrames).toFixed(1),
  active_frames_above_ground: `${totActiveAbove}/${totActive}`,
  active_frames_above_ground_pct: +(100 * totActiveAbove / totActive).toFixed(1),
  weapons_never_above_ground: rows.filter((r) => r.frames_above_ground === 0).length,
  tip_y_min_overall: +Math.min(...rows.map((r) => r.tip_y_min)).toFixed(3),
  incl_rest_deg_mean: +mean(rows.map((r) => r.incl_rest_deg)).toFixed(1),
  incl_deepest_deg_mean: +mean(rows.map((r) => r.incl_deepest_deg)).toFixed(1),
  body_band_m: [+BAND.lo.toFixed(3), +BAND.hi.toFixed(3)],
  reach_err_abs_max_m: +Math.max(...rows.map((r) => Math.abs(r.reach_err_m))).toFixed(4),
  reach_short_gt_10cm: rows.filter((r) => r.reach_err_m < -0.10).length,
  reach_err_mean_m: +mean(rows.map((r) => r.reach_err_m)).toFixed(4),
  b_m_max: +Math.max(...rows.map((r) => r.b_m)).toFixed(3),
  b_m_mean: +mean(rows.map((r) => r.b_m)).toFixed(3),
};

const jsonOut = arg('json', null);
if (jsonOut) {
  fs.mkdirSync(path.dirname(path.resolve(ROOT, jsonOut)), { recursive: true });
  fs.writeFileSync(path.resolve(ROOT, jsonOut),
    JSON.stringify({ summary, by_class: classRows, weapons: rows }, null, 1));
}

console.log(JSON.stringify(summary, null, 1));
console.log('');
console.log('class  n   tip_y_min tip_y_max  above/frames   active_above   incl_rest incl_deep  reach_err  short');
for (const c of classRows) {
  console.log(
    c.class.padEnd(5), String(c.weapons).padStart(2),
    String(c.tip_y_min).padStart(9), String(c.tip_y_max).padStart(9),
    String(c.frames_above_ground).padStart(13), String(c.active_frames_above_ground).padStart(14),
    String(c.incl_rest_deg_mean).padStart(9), String(c.incl_deepest_deg_mean).padStart(9),
    String(c.reach_err_abs_max_m).padStart(10), String(c.reach_short_gt_10cm).padStart(5));
}
if (only) {
  const r = rows[0];
  console.log('');
  console.log(`${r.weapon} ${r.slot}: reach ${r.reach_m} b ${r.b_m}`);
  for (const p of r.per_frame) {
    console.log(` f${String(p.f).padStart(3)} y=${String(p.y).padStart(7)} r=${String(p.r).padStart(6)} incl=${String(p.incl).padStart(6)}${p.active ? '  ACTIVE' : ''}`);
  }
}
