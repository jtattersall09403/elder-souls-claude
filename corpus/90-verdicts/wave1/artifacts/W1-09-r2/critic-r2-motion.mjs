#!/usr/bin/env node
// W1-09 r2: the motion check, taken off the geometry channel of a real fight rather than a probe.
// Round 1 measured, on the same channel: peak tip speed up to x2.69 the declared column, a
// straight-sword R1 sweeping 615 degrees, and a 1.42-2.54 m single-frame pose snap at the
// attack->idle boundary. The remediation claims all three fixed. This re-measures them from
// reports/w1-09/exemplar/*-frames.jsonl, which is output, not source.
import fs from 'node:fs';

const HZ = 60;
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const out = { generated: new Date().toISOString(), fights: {} };
for (const F of ['F1', 'F2', 'F3', 'F4', 'F5']) {
  const lines = fs.readFileSync(`reports/w1-09/exemplar/RI-CMB07-exemplar-${F}-frames.jsonl`, 'utf8').split('\n').filter(Boolean);
  const meta = JSON.parse(lines[0]);
  const frames = lines.slice(1).map((l) => JSON.parse(l));
  const declared = meta.constants && meta.constants.light ? meta.constants.light : null;

  let peakTip = 0, peakTipF = null, maxJumpA = 0, maxJumpAF = null, maxJumpB = 0, maxJumpBF = null;
  const jumps = [];
  const arcs = [];
  let cur = null;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i];
    if (!a.x || !b.x || !a.x.sockets || !b.x.sockets) continue;
    const A0 = a.x.sockets.slice(0, 3), B0 = a.x.sockets.slice(3, 6);
    const A1 = b.x.sockets.slice(0, 3), B1 = b.x.sockets.slice(3, 6);
    const tip = d3(B0, B1) * HZ;
    if (tip > peakTip) { peakTip = tip; peakTipF = b.f; }
    const ja = d3(A0, A1), jb = d3(B0, B1);
    if (ja > maxJumpA) { maxJumpA = ja; maxJumpAF = b.f; }
    if (jb > maxJumpB) { maxJumpB = jb; maxJumpBF = b.f; }
    jumps.push(jb);
    // arc: angle between successive guard->tip vectors, accumulated over one attack animation
    const st = b.p[0];
    const inAtk = st === 'ATK_STARTUP' || st === 'ATK_ACTIVE' || st === 'ATK_RECOVER';
    if (inAtk) {
      const v0 = [B0[0] - A0[0], B0[1] - A0[1], B0[2] - A0[2]];
      const v1 = [B1[0] - A1[0], B1[1] - A1[1], B1[2] - A1[2]];
      const n0 = Math.hypot(...v0), n1 = Math.hypot(...v1);
      const dot = (v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2]) / (n0 * n1 || 1);
      const ang = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
      if (!cur) cur = { f0: b.f, total: 0, byPhase: { ATK_STARTUP: 0, ATK_ACTIVE: 0, ATK_RECOVER: 0 } };
      cur.total += ang; cur.byPhase[st] += ang; cur.f1 = b.f;
    } else if (cur) { arcs.push(cur); cur = null; }
  }
  if (cur) arcs.push(cur);
  jumps.sort((a, b) => b - a);
  out.fights[F] = {
    declared_peak_tip_speed_mps: meta.constants && meta.constants.light ? (meta.constants.light.peak_tip_speed_mps ?? null) : null,
    measured_peak_tip_speed_mps: +peakTip.toFixed(2), at_frame: peakTipF,
    max_single_frame_guard_socket_move_m: +maxJumpA.toFixed(4), at_frame_a: maxJumpAF,
    max_single_frame_tip_socket_move_m: +maxJumpB.toFixed(4), at_frame_b: maxJumpBF,
    top10_single_frame_tip_moves_m: jumps.slice(0, 10).map((v) => +v.toFixed(4)),
    attack_animations: arcs.length,
    arc_total_deg_max: arcs.length ? +Math.max(...arcs.map((a) => a.total)).toFixed(1) : null,
    arc_total_deg_median: arcs.length ? +[...arcs.map((a) => a.total)].sort((x, y) => x - y)[Math.floor(arcs.length / 2)].toFixed(1) : null,
    arc_recovery_exceeds_active_count: arcs.filter((a) => a.byPhase.ATK_RECOVER > a.byPhase.ATK_ACTIVE).length,
    sample_arc: arcs.length ? { f0: arcs[0].f0, f1: arcs[0].f1, total: +arcs[0].total.toFixed(1),
      startup: +arcs[0].byPhase.ATK_STARTUP.toFixed(1), active: +arcs[0].byPhase.ATK_ACTIVE.toFixed(1),
      recovery: +arcs[0].byPhase.ATK_RECOVER.toFixed(1) } : null,
    declared_light: declared,
  };
}
fs.writeFileSync('corpus/90-verdicts/wave1/artifacts/W1-09-r2/critic-r2-motion.json', JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out.fights)) {
  console.log(k, 'peak tip', v.measured_peak_tip_speed_mps, 'm/s  max 1-frame tip move', v.max_single_frame_tip_socket_move_m,
    'm  arcs', v.attack_animations, 'max', v.arc_total_deg_max, 'med', v.arc_total_deg_median,
    'recovery>active', v.arc_recovery_exceeds_active_count, JSON.stringify(v.sample_arc));
}
