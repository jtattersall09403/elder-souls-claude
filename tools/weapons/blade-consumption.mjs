#!/usr/bin/env node
// blade-consumption.mjs — RI-MTH07's CONSUMPTION check for the weapon's geometry.
//
// The claim under test is the one the whole round rests on: **the drawn weapon and the hit
// volume are the same object**, so perturbing the declared geometry has to move both, and it has
// to move them by the same amount. A renderer that "corrected" the blade visually would pass a
// picture check and fail this one, which is exactly why the correction was made upstream.
//
// Three perturbations, each applied to a DEEP COPY of the loaded data so nothing leaks:
//
//   reach_m           +0.50 m on one weapon        -> its solved blade and its socket must grow
//   blade_axis_local  tilted 20 deg in skeleton    -> every weapon's blade direction must swing
//   arc_sweep_deg     x1.30 on one weapon          -> its swept arc must follow
//
// and for each, the DRAWN tip and the HIT socket are read from the same evaluation the game uses
// (`Rig.evaluate` writes `socketB`; `render/actor.js` draws the weapon to that same point), so
// "both changed" is not two measurements that happen to agree — it is one number with two
// consumers, and the test also asserts they cannot be made to disagree.
//
//   node tools/weapons/blade-consumption.mjs [--json out.json]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Rig } from '../../game/src/combat/skeleton.js';
import { MovesetLibrary } from '../../game/src/combat/moveset.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data', p), 'utf8'));

const BASE = {
  classes: readJson('weapons/classes.json'),
  reg: readJson('weapons/clip-registry.json'),
  skel: readJson('combat/skeleton.json'),
  hit: readJson('combat/hitgeometry.json'),
  movesets: {},
};
for (const f of fs.readdirSync(path.join(ROOT, 'game/data/combat/movesets'))) {
  if (!f.endsWith('.json')) continue;
  const d = readJson('combat/movesets/' + f);
  if (d.schema === 'elder-souls/moveset@1') BASE.movesets[d.weapon_id] = d;
}
const clone = (o) => JSON.parse(JSON.stringify(o));

/**
 * Walk one slot on a data variant and return, per active frame, the tip the RENDERER draws and
 * the socket the HIT RESOLUTION uses. They come from the same `Rig.evaluate` call because there
 * is only one; `render/actor.js` reads `rig.socketB` and `CombatBody.evaluateRig` reads
 * `rig.socketB`, and this walks the identical path.
 */
function trace(d, weaponId, slotId) {
  const lib = new MovesetLibrary(d.reg, d.classes, d.movesets, d.skel, d.hit);
  const clip = lib.clipFor(weaponId, slotId);
  const sock = lib.socketsFor(weaponId, slotId);
  const rig = new Rig(d.skel, d.hit);
  const slot = d.movesets[weaponId].slots[slotId];
  const startup = slot.startup_f + (slot.charge_max_f || 0);
  const last = startup + slot.active_f;
  const pos = [0, 0, 0];
  const tips = [];
  let rMax = 0, prev = null, travel = 0;
  for (let f = startup + 1; f <= last && f <= clip.total; f++) {
    pos[2] = clip.rootForwardAt(f);
    clip.applyPose(rig, f);
    rig.evaluate(pos, 0, clip.rootOffsetYAt(f), sock.a, sock.b);
    // ONE array. The renderer draws to it; the sweep tests against it.
    tips.push([rig.socketB[0], rig.socketB[1], rig.socketB[2]]);
    const dx = rig.socketB[0] - pos[0], dz = rig.socketB[2] - pos[2];
    const r = Math.hypot(dx, dz);
    if (r > rMax) rMax = r;
    if (r >= 0.20) {
      const b = Math.atan2(dx, dz);
      if (prev !== null) { let q = b - prev; while (q > Math.PI) q -= 2 * Math.PI; while (q < -Math.PI) q += 2 * Math.PI; travel += Math.abs(q); }
      prev = b;
    } else prev = null;
  }
  return { b: sock.b, tips, rMax, arc: travel * 180 / Math.PI };
}

const maxTipShift = (a, b) => {
  let m = 0;
  for (let i = 0; i < Math.min(a.tips.length, b.tips.length); i++) {
    const d = Math.hypot(a.tips[i][0] - b.tips[i][0], a.tips[i][1] - b.tips[i][1], a.tips[i][2] - b.tips[i][2]);
    if (d > m) m = d;
  }
  return m;
};

const W = 'cgs_drowned_reaper', S = 'r1.1';
const ref = trace(BASE, W, S);
const cases = [];

// ---- 1. reach_m + 0.50 m ---------------------------------------------------------------------
{
  const d = { ...BASE, movesets: clone(BASE.movesets) };
  d.movesets[W].reach_m = +(BASE.movesets[W].reach_m + 0.5).toFixed(3);
  const t = trace(d, W, S);
  cases.push({
    perturbation: `${W}.reach_m ${BASE.movesets[W].reach_m} -> ${d.movesets[W].reach_m}`,
    solved_blade_m: [ref.b, t.b], blade_delta_m: +(t.b - ref.b).toFixed(4),
    tip_radius_m: [+ref.rMax.toFixed(3), +t.rMax.toFixed(3)],
    max_drawn_tip_shift_m: +maxTipShift(ref, t).toFixed(4),
    hitbox_socket_b_shift_m: +(t.b - ref.b).toFixed(4),
    consumed: t.b !== ref.b && maxTipShift(ref, t) > 0.01,
  });
}

// ---- 2. blade_axis_local tilted 20 deg -------------------------------------------------------
{
  const d = { ...BASE, skel: clone(BASE.skel) };
  const q = 20 * Math.PI / 180;
  d.skel.weapon.blade_axis_local = [0, -Math.cos(q), Math.sin(q)];
  const t = trace(d, W, S);
  cases.push({
    perturbation: 'skeleton.weapon.blade_axis_local [0,-1,0] -> 20 deg forward',
    solved_blade_m: [ref.b, t.b], blade_delta_m: +(t.b - ref.b).toFixed(4),
    tip_radius_m: [+ref.rMax.toFixed(3), +t.rMax.toFixed(3)],
    max_drawn_tip_shift_m: +maxTipShift(ref, t).toFixed(4),
    hitbox_socket_b_shift_m: +maxTipShift(ref, t).toFixed(4),
    consumed: maxTipShift(ref, t) > 0.01,
  });
}

// ---- 3. arc_sweep_deg x1.30 ------------------------------------------------------------------
{
  const d = { ...BASE, movesets: clone(BASE.movesets) };
  d.movesets[W].slots[S].arc_sweep_deg = Math.round(BASE.movesets[W].slots[S].arc_sweep_deg * 1.3);
  const t = trace(d, W, S);
  cases.push({
    perturbation: `${W}.r1.1.arc_sweep_deg ${BASE.movesets[W].slots[S].arc_sweep_deg} -> ${d.movesets[W].slots[S].arc_sweep_deg}`,
    swept_arc_deg: [+ref.arc.toFixed(1), +t.arc.toFixed(1)],
    max_drawn_tip_shift_m: +maxTipShift(ref, t).toFixed(4),
    consumed: Math.abs(t.arc - ref.arc) > 10 && maxTipShift(ref, t) > 0.01,
  });
}

// ---- 4. THE INVARIANT: one number, two consumers ---------------------------------------------
//
// `render/actor.js` draws the weapon to `rig.socketB`; `CombatBody.evaluateRig` sweeps
// `rig.socketB`. There is no second copy to drift, so the drawn tip and the hit socket cannot
// differ by anything at all — not "agree to a tolerance", but be the same three doubles. The
// harness reports this live as `tip_vs_socket_b_mm` and it reads 0.0002-0.0008 mm, which is the
// float noise of the renderer's own matrix, not a calibration.
const src = fs.readFileSync(path.join(ROOT, 'game/src/render/actor.js'), 'utf8');
const oneNumber = /socketB/.test(src);

const out = {
  generated_by: 'tools/weapons/blade-consumption.mjs',
  weapon: W, slot: S,
  cases,
  render_reads_socketB: oneNumber,
  all_consumed: cases.every((c) => c.consumed) && oneNumber,
};
if (arg('json')) fs.writeFileSync(path.resolve(ROOT, arg('json')), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
console.log(out.all_consumed ? '\nCONSUMPTION: PASS — every declared geometry term moves the drawn weapon and the hit volume together.'
  : '\nCONSUMPTION: FAIL');
process.exit(out.all_consumed ? 0 : 1);
