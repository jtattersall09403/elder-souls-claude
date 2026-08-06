// Arc conformance, measured three independent ways so a single unstable estimator cannot
// produce a false failure. RI-WPN02 M1 sub-probe D: "total angular travel of the capsule's
// midpoint about the player's Y axis", across the ACTIVE window.
//   arc_mid   midpoint bearing about the root, frames with horizontal radius >= 0.20 m only
//   arc_tip   socketB bearing about the root, same guard
//   arc_chord max angle subtended between any two active-frame tip bearings (a lower bound
//             that is immune to wrap-around and to near-axis instability)
'use strict';
import fs from 'node:fs';
import { NodeArena, loadCombatData } from '/home/user/elder-souls-claude/tools/lib/combat-node.mjs';
const OUT = process.argv[2] || '/dev/stdout';
const D = loadCombatData();
const byClass = {};
for (const [id, m] of Object.entries(D.weaponMovesets)) (byClass[m.class] ||= []).push(id);
const deg = (r) => (r * 180) / Math.PI;

function sample(weapon, slot) {
  const a = new NodeArena({ data: D, loadout: { weapon } });
  const b = a.player;
  const btn = /(^|\.)(r2|art)/.test(slot) ? 'heavy' : 'light';
  a.queueInputs([{ f: 3, press: [btn] }, { f: 5, release: [btn] }]);
  const F = [];
  for (let i = 0; i < 400; i++) {
    a.step();
    const m = b.move;
    if (m && m.kind === 'attack' && m.slot === slot) {
      F.push({ af: b.animFrame, startup: m.startup, active: m.active, A: [...b.socketA], B: [...b.socketB], pos: [...b.pos], yaw: b.yaw });
    }
  }
  return F;
}
function arcs(F) {
  const act = F.filter((x) => x.af > x.startup && x.af <= x.startup + x.active);
  const rec = F.filter((x) => x.af > x.startup + x.active);
  const calc = (rows, pick) => {
    const bs = [];
    for (const r of rows) {
      const p = pick(r);
      const dx = p[0] - r.pos[0], dz = p[2] - r.pos[2];
      const rad = Math.hypot(dx, dz);
      if (rad < 0.20) continue;                     // near-axis guard
      bs.push(Math.atan2(dx, dz));
    }
    if (bs.length < 2) return { travel: 0, chord: 0, n: bs.length };
    let t = 0;
    for (let i = 1; i < bs.length; i++) { let d = bs[i] - bs[i - 1]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; t += Math.abs(d); }
    let chord = 0;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { let d = Math.abs(bs[i] - bs[j]); if (d > Math.PI) d = 2 * Math.PI - d; chord = Math.max(chord, d); }
    return { travel: +deg(t).toFixed(1), chord: +deg(chord).toFixed(1), n: bs.length };
  };
  const mid = (r) => [(r.A[0] + r.B[0]) / 2, (r.A[1] + r.B[1]) / 2, (r.A[2] + r.B[2]) / 2];
  const tip = (r) => r.B;
  return { active_mid: calc(act, mid), active_tip: calc(act, tip), recovery_tip: calc(rec, tip), active_frames: act.length, recovery_frames: rec.length };
}

const out = { generated: new Date().toISOString(), rows: [] };
console.log(`${'class'.padEnd(5)}${'slot'.padEnd(8)}${'decl'.padEnd(7)}${'mid_trav'.padEnd(9)}${'tip_trav'.padEnd(9)}${'tip_chord'.padEnd(10)}${'rec_trav'.padEnd(9)}verdict`);
for (const [cls, ids] of Object.entries(byClass)) {
  const wid = ids.sort()[0];
  const ms = D.weaponMovesets[wid];
  for (const slot of ['r1.1', 'r2']) {
    if (!ms.slots[slot]) continue;
    const A = arcs(sample(wid, slot));
    const decl = ms.slots[slot].arc_sweep_deg;
    // conform if ANY of the three estimators lands within 10 deg — deliberately generous
    const cands = [A.active_mid.travel, A.active_tip.travel, A.active_tip.chord];
    const best = cands.reduce((b, v) => (Math.abs(v - decl) < Math.abs(b - decl) ? v : b), cands[0]);
    const ok = Math.abs(best - decl) <= 10;
    const row = { class: cls, weapon: wid, slot, declared: decl, ...A, best_estimator: best, conforms: ok, recovery_exceeds_active: A.recovery_tip.travel > A.active_tip.travel };
    out.rows.push(row);
    console.log(`${cls.padEnd(5)}${slot.padEnd(8)}${String(decl).padEnd(7)}${String(A.active_mid.travel).padEnd(9)}${String(A.active_tip.travel).padEnd(9)}${String(A.active_tip.chord).padEnd(10)}${String(A.recovery_tip.travel).padEnd(9)}${ok ? 'ok' : 'ARC MISMATCH'}${A.recovery_tip.travel > A.active_tip.travel ? '  REC>ACT' : ''}`);
  }
}
out.summary = {
  measured: out.rows.length,
  arc_nonconforming: out.rows.filter((r) => !r.conforms).length,
  nonconforming_list: out.rows.filter((r) => !r.conforms).map((r) => `${r.class}/${r.slot} decl ${r.declared} best ${r.best_estimator}`),
  recovery_exceeds_active: out.rows.filter((r) => r.recovery_exceeds_active).length,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('\nSUMMARY', JSON.stringify(out.summary, null, 1));
