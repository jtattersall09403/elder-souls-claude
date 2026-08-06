// The OBSERVED column. Critic-authored. Everything here is read off per-frame world-space
// socket positions produced by the running rig — never from a declared JSON field.
//   * arc_sweep_deg          angular travel of the weapon capsule midpoint about the player's Y
//   * root_dz_m              measured player translation across the active window
//   * peak tip speed         |socketB(f) - socketB(f-1)| * 60
//   * pose discontinuity     max per-frame socket displacement (RI-WPN05 §E.2: <= 0.25 m/f;
//                            > 1.0 m is a hard fail "pose teleport")
//   * distinct keyframes     distinct rounded socketB positions across the clip (>= 3)
//   * chain length / G7-G9   from the mash probe
'use strict';
import fs from 'node:fs';
import { NodeArena, loadCombatData } from '/home/user/elder-souls-claude/tools/lib/combat-node.mjs';

const OUT = process.argv[2] || '/dev/stdout';
const D = loadCombatData();
const byClass = {};
for (const [id, m] of Object.entries(D.weaponMovesets)) (byClass[m.class] ||= []).push(id);
for (const k of Object.keys(byClass)) byClass[k].sort();

const deg = (r) => (r * 180) / Math.PI;
function bearing(p, o) { return Math.atan2(p[0] - o[0], p[2] - o[2]); }

/** Drive one slot and sample the rig every frame. */
function motion(weapon, slot, opts = {}) {
  const a = new NodeArena({ data: D, loadout: { weapon, ...(opts.loadout || {}) } });
  const b = a.player;
  const btn = /(^|\.)(r2|art)/.test(slot) ? 'heavy' : 'light';
  a.queueInputs(opts.script || [{ f: 3, press: [btn] }, { f: 5, release: [btn] }]);
  const F = [];
  for (let i = 0; i < (opts.frames || 400); i++) {
    a.step();
    const m = b.move;
    if (m && m.kind === 'attack') {
      F.push({
        f: a.frame, slot: m.slot, af: b.animFrame,
        phase: b.animFrame <= m.startup ? 'startup' : b.animFrame <= m.startup + m.active ? 'active' : 'recovery',
        A: [...b.socketA], B: [...b.socketB], pos: [...b.pos],
      });
    }
  }
  return F;
}

function analyseSlot(F, slotId) {
  const S = F.filter((x) => x.slot === slotId);
  if (S.length < 2) return null;
  const mid = (x) => [(x.A[0] + x.B[0]) / 2, (x.A[1] + x.B[1]) / 2, (x.A[2] + x.B[2]) / 2];
  const arcOf = (rows) => {
    let t = 0;
    for (let i = 1; i < rows.length; i++) {
      let d = bearing(mid(rows[i]), rows[i].pos) - bearing(mid(rows[i - 1]), rows[i - 1].pos);
      while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      t += Math.abs(d);
    }
    return +deg(t).toFixed(1);
  };
  const act = S.filter((x) => x.phase === 'active');
  const rec = S.filter((x) => x.phase === 'recovery');
  let maxStep = 0, tipMax = 0;
  for (let i = 1; i < S.length; i++) {
    const dB = Math.hypot(S[i].B[0] - S[i - 1].B[0], S[i].B[1] - S[i - 1].B[1], S[i].B[2] - S[i - 1].B[2]);
    const dA = Math.hypot(S[i].A[0] - S[i - 1].A[0], S[i].A[1] - S[i - 1].A[1], S[i].A[2] - S[i - 1].A[2]);
    maxStep = Math.max(maxStep, dB, dA);
    tipMax = Math.max(tipMax, dB * 60);
  }
  const keys = new Set(S.map((x) => x.B.map((v) => Math.round(v * 100)).join(',')));
  return {
    frames: S.length,
    arc_active_deg: arcOf(act.length > 1 ? act : S),
    arc_recovery_deg: rec.length > 1 ? arcOf(rec) : 0,
    arc_total_deg: arcOf(S),
    root_dz_m: +(S[S.length - 1].pos[2] - S[0].pos[2]).toFixed(3),
    peak_tip_mps: +tipMax.toFixed(2),
    max_pose_step_m: +maxStep.toFixed(3),
    distinct_keyframes: keys.size,
  };
}

const mash = []; for (let f = 3; f < 700; f += 8) { mash.push({ f, press: ['light'] }, { f: f + 2, release: ['light'] }); }

const out = { generated: new Date().toISOString(), instrument: 'kritik-motion.mjs (critic-authored)', per_class: {}, per_clip: [] };
for (const [cls, ids] of Object.entries(byClass)) {
  const wid = ids[0];
  const ms = D.weaponMovesets[wid];
  if (!ms.slots['r1.1']) { console.log(`${cls}  ${wid} — no r1.1 (BOW), excluded from the melee fingerprint per RI-WPN02 §D`); continue; }
  const r11 = analyseSlot(motion(wid, 'r1.1'), 'r1.1');
  const r2 = ms.slots.r2 ? analyseSlot(motion(wid, 'r2'), 'r2') : null;
  // mash probe -> chain
  const MF = motion(wid, 'r1.1', { script: mash, frames: 700 });
  const order = []; for (const x of MF) if (!order.length || order[order.length - 1] !== x.slot) order.push(x.slot);
  const chain = []; for (const s of order) { if (chain.length && s === chain[0]) break; chain.push(s); }
  const links = chain.map((s) => analyseSlot(MF, s)).filter(Boolean);
  const shapes = new Set(chain.map((s) => ms.slots[s] && ms.slots[s].shape));
  const arcs = links.map((l) => l.arc_active_deg);
  const roots = links.map((l) => l.root_dz_m);
  out.per_class[cls] = {
    weapon: wid,
    r1_1: r11, r2,
    declared_arc_r1_1: ms.slots['r1.1'].arc_sweep_deg,
    declared_shape_r1_1: ms.slots['r1.1'].shape,
    declared_shape_r2: ms.slots.r2 ? ms.slots.r2.shape : null,
    declared_root_r1_1: ms.slots['r1.1'].root_dz_m,
    chain_observed: chain,
    max_chain_len: chain.length,
    G7_chain_arc_range: arcs.length ? +(Math.max(...arcs) - Math.min(...arcs)).toFixed(1) : 0,
    G8_chain_shape_count: shapes.size,
    G9_chain_root_ratio: (links.length && roots[0]) ? +(roots.reduce((a, b) => a + b, 0) / (chain.length * roots[0])).toFixed(3) : null,
  };
  console.log(`${cls}  ${wid.padEnd(24)} chain[${chain.join('>')}] arcR1 obs ${r11.arc_active_deg}° decl ${ms.slots['r1.1'].arc_sweep_deg}°  root obs ${r11.root_dz_m} decl ${ms.slots['r1.1'].root_dz_m}  tip ${r11.peak_tip_mps} m/s  poseStep ${r11.max_pose_step_m} m  keys ${r11.distinct_keyframes}  G7 ${out.per_class[cls].G7_chain_arc_range} G8 ${shapes.size} G9 ${out.per_class[cls].G9_chain_root_ratio}`);
}

// per-clip animation quality over EVERY slot of every class baseline (RI-WPN05 §E.2)
for (const [cls, ids] of Object.entries(byClass)) {
  const wid = ids[0];
  for (const slot of ['r1.1', 'r1.2', 'r1.3', 'r2', 'run.r1', 'roll.r1', 'backstep.r1', 'jump.r1', 'art.1']) {
    if (!D.weaponMovesets[wid].slots || !D.weaponMovesets[wid].slots[slot]) continue;
    const F = motion(wid, slot, { script: null });
    let a = analyseSlot(F, slot);
    if (!a && slot !== 'r1.1') continue;
    if (!a) continue;
    out.per_clip.push({ class: cls, weapon: wid, slot, declared_arc: D.weaponMovesets[wid].slots[slot].arc_sweep_deg, ...a });
  }
}
const pc = out.per_clip;
out.animation_quality = {
  clips_measured: pc.length,
  pose_step_over_0_25: pc.filter((c) => c.max_pose_step_m > 0.25).length,
  pose_teleport_over_1_0: pc.filter((c) => c.max_pose_step_m > 1.0).map((c) => `${c.weapon}/${c.slot}=${c.max_pose_step_m}`),
  fewer_than_3_keyframes: pc.filter((c) => c.distinct_keyframes < 3).map((c) => `${c.weapon}/${c.slot}`),
  arc_error_over_10deg: pc.filter((c) => Math.abs(c.arc_active_deg - c.declared_arc) > 10).map((c) => ({ w: c.weapon, s: c.slot, decl: c.declared_arc, obs: c.arc_active_deg })),
  recovery_arc_exceeds_active: pc.filter((c) => c.arc_recovery_deg > c.arc_active_deg).map((c) => `${c.weapon}/${c.slot} rec ${c.arc_recovery_deg} > act ${c.arc_active_deg}`),
  max_tip_mps: Math.max(...pc.map((c) => c.peak_tip_mps)),
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('\nANIMATION QUALITY over', pc.length, 'driven clips');
for (const [k, v] of Object.entries(out.animation_quality)) console.log(' ', k, Array.isArray(v) ? `${v.length} ${JSON.stringify(v).slice(0, 300)}` : v);
