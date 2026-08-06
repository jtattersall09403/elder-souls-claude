#!/usr/bin/env node
// anim-tune.mjs — measure the swing OFF THE ANIMATION SYSTEM, with no browser.
//
// It imports game/src/combat/{clips,skeleton}.js and the same data files the game loads, so
// what it reports is what the sim reports; the browser probe (critic-w1-09c.mjs `motion`) is
// the check on this, not the other way round. Exists because the W1-09 verdict §2.5 found the
// frame data exact and the MOTION wrong — peak tip speed ×1.00–×2.69 over RI-CMB04 §B's
// declared column, recovery sweeping further than the active window, and a 1.42–2.54 m
// single-frame snap at the idle boundary — and none of those are visible in a frame count.
//
// Usage: node tools/harness/anim-tune.mjs [--json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Clip, LoopClip, addPose } from '../../game/src/combat/clips.js';
import { Rig } from '../../game/src/combat/skeleton.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data', p), 'utf8'));
const clips = J('combat/clips.json');
const skel = J('combat/skeleton.json');
const hitgeo = J('combat/hitgeometry.json');
const CLASSES = ['dagger', 'straight-sword', 'spear', 'axe', 'halberd', 'greatsword', 'ultra-greatsword'];

const rows = [];
for (const id of CLASSES) {
  const ms = J(`combat/spine/${id}.json`);
  for (const mv of ['light', 'heavy']) {
    const m = ms.moves[mv];
    const clip = new Clip(m.anim, clips.archetypes[m.archetype],
      { startup: m.startup, active: m.active, total: m.total }, m.amplitude, m.root_dz_m);
    rows.push(measure(id, mv, ms, m, clip));
  }
}

if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(rows, null, 1) + '\n');
} else {
  const h = ['class', 'mv', 'decl', 'peak', 'ratio', 'st°', 'act°', 'rec°', 'tot°', 'snapIn_m', 'snapOut_m'];
  console.log(h.map((s, i) => s.padEnd(i === 0 ? 17 : 9)).join(''));
  for (const r of rows) {
    console.log([r.weapon, r.move, r.declared.toFixed(1), r.peak_tip_mps.toFixed(2), r.ratio.toFixed(2),
      r.angle_startup.toFixed(0), r.angle_active.toFixed(0), r.angle_recovery.toFixed(0), r.angle_total.toFixed(0),
      r.snap_in_m.toFixed(4), r.snap_out_m.toFixed(4)]
      .map((s, i) => String(s).padEnd(i === 0 ? 17 : 9)).join(''));
  }
  const bad = rows.filter((r) => r.ratio > 1.0);
  const rec = rows.filter((r) => r.angle_recovery > r.angle_active);
  const snap = rows.filter((r) => Math.max(r.snap_in_m, r.snap_out_m) > 0.35);
  console.log(`\nover declared peak: ${bad.length}/${rows.length}   recovery>active: ${rec.length}/${rows.length}   snap>0.35 m: ${snap.length}/${rows.length}`);
}

// ------------------------------------------------------------------------------------------

function measure(weapon, mv, ms, m, clip) {
  const w = ms.weapon;
  const rig = new Rig(skel, hitgeo);
  const idleLoop = new LoopClip('idle', clips.archetypes[clips.archetypes.idle_loop ? 'idle_loop' : 'idle_ready'], 96);
  const idlePose = clips.archetypes.idle_ready;
  const pos = [0, 0, 0];
  const socketsOf = () => [rig.socketA.slice(), rig.socketB.slice()];

  // the idle pose the swing leaves from and returns to, sampled the way actor.poseLocomotion does
  const idleAt = (k) => {
    rig.clearPose();
    idleLoop.applyPose(rig, k);
    addPose(rig, idlePose, 0, 1.0);
    rig.evaluate(pos, 0, idleLoop.rootOffsetYAt(k), w.socket_a_dist_m, w.socket_b_dist_m);
    return socketsOf();
  };

  const track = [];
  track.push({ f: 0, s: idleAt(0), z: 0 });
  let z = 0;
  for (let f = 1; f <= m.total; f++) {
    z += clip.rootDeltaAt(f);
    clip.applyPose(rig, f);
    pos[2] = z;
    rig.evaluate(pos, 0, clip.rootOffsetYAt(f), w.socket_a_dist_m, w.socket_b_dist_m);
    track.push({ f, s: socketsOf(), z });
  }
  pos[2] = z;
  track.push({ f: m.total + 1, s: idleAt(1), z });

  let peak = 0, aSt = 0, aAc = 0, aRe = 0;
  for (let i = 1; i < track.length; i++) {
    const p = track[i - 1].s, n = track[i].s;
    const tip = dist(p[1], n[1]);
    const ang = axisAngle(p, n);
    const f = track[i].f;
    if (f <= m.startup) aSt += ang;
    else if (f <= m.startup + m.active) { aAc += ang; if (tip * 60 > peak) peak = tip * 60; }
    else if (f <= m.total) aRe += ang;
  }
  const snapIn = dist(track[0].s[1], track[1].s[1]);
  const snapOut = dist(track[track.length - 2].s[1], track[track.length - 1].s[1]);
  const declared = w.peak_tip_speed_mps_declared;
  return {
    weapon, move: mv, declared,
    peak_tip_mps: +peak.toFixed(3), ratio: +(peak / declared).toFixed(3),
    angle_startup: +aSt.toFixed(1), angle_active: +aAc.toFixed(1), angle_recovery: +aRe.toFixed(1),
    angle_total: +(aSt + aAc + aRe).toFixed(1),
    snap_in_m: +snapIn.toFixed(4), snap_out_m: +snapOut.toFixed(4),
    startup: m.startup, active: m.active, recovery: m.recovery, total: m.total,
    archetype: m.archetype, amplitude: m.amplitude,
  };
}

function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function axisAngle(p, n) {
  const v1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]];
  const v2 = [n[1][0] - n[0][0], n[1][1] - n[0][1], n[1][2] - n[0][2]];
  const n1 = Math.hypot(...v1), n2 = Math.hypot(...v2);
  const d = (v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / ((n1 * n2) || 1);
  return Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
}
