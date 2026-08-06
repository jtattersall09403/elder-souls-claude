// S26 + RI-WPN02 §B/M1-C as amended wave 1. Critic-authored, independent of tools/harness/cmb-reach.mjs.
// One fight per (weapon, slot, distance). Stationary target, live geometry, never a declared value.
//   C1 root motion SUPPRESSED (root_dz_m forced to 0 in memory)  -> blade reach, reach_min, contiguity
//   C2 root motion ON                                            -> threat_m, contiguity
'use strict';
import fs from 'node:fs';
import { NodeArena, loadCombatData } from '/home/user/elder-souls-claude/tools/lib/combat-node.mjs';

const OUT = process.argv[2] || '/dev/stdout';
const STEP = 0.05, LO = 0.20, HI = 5.00;
const BASE = loadCombatData();

// 15 class baselines + the 4 weight-tier probes. Baselines chosen as the first weapon of each class.
const byClass = {};
for (const [id, m] of Object.entries(BASE.weaponMovesets)) (byClass[m.class] ||= []).push(id);
const BASELINES = Object.fromEntries(Object.entries(byClass).map(([c, ids]) => [c, ids.sort()[0]]));

function dataWithRootZeroed(zero) {
  const d = loadCombatData();
  if (zero) for (const ms of Object.values(d.weaponMovesets)) for (const s of Object.values(ms.slots)) s.root_dz_m = 0;
  return d;
}

function hitsAt(data, weapon, slot, dist) {
  const a = new NodeArena({ data, loadout: { weapon } });
  const e = a.spawn('t', 'dummy_passive', 0, dist, 180);
  a.lockOn('t');
  const btn = /r2|art|jump\.r2/.test(slot) ? 'heavy' : 'light';
  a.queueInputs([{ f: 3, press: [btn] }, { f: 5, release: [btn] }]);
  const hp0 = e.hp;
  const total = 400;
  for (let i = 0; i < total; i++) a.step();
  return e.hp < hp0;
}

function sweep(data, weapon, slot) {
  const v = [];
  for (let d = LO; d <= HI + 1e-9; d += STEP) v.push(hitsAt(data, weapon, slot, +d.toFixed(2)) ? 1 : 0);
  const dist = (i) => +(LO + i * STEP).toFixed(2);
  const idx = v.map((h, i) => (h ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return { hits: 0, min_m: null, max_m: null, contiguous: null, gaps: [], vector: v.join('') };
  const min = idx[0], max = idx[idx.length - 1];
  const gaps = [];
  for (let i = min; i <= max; i++) if (!v[i]) { const s = i; while (i <= max && !v[i]) i++; gaps.push([dist(s), dist(i - 1)]); }
  return { hits: idx.length, min_m: dist(min), max_m: dist(max), contiguous: gaps.length === 0, gaps, vector: v.join('') };
}

const dataC1 = dataWithRootZeroed(true);
const dataC2 = dataWithRootZeroed(false);
const out = { generated: new Date().toISOString(), instrument: 'kritik-reach.mjs (critic-authored)', step_m: STEP, range_m: [LO, HI], classes: {} };
const rows = [];
for (const [cls, wid] of Object.entries(BASELINES)) {
  if (cls === 'BOW') continue;
  const declaredReach = BASE.weaponMovesets[wid].reach_m;
  const rootdz = BASE.weaponMovesets[wid].slots['r1.1'].root_dz_m;
  const c1 = sweep(dataC1, wid, 'r1.1');
  const c2 = sweep(dataC2, wid, 'r1.1');
  const threatPredicted = c1.max_m !== null ? +(c1.max_m + rootdz).toFixed(2) : null;
  const row = {
    class: cls, weapon: wid, declared_reach_m: declaredReach, declared_root_dz_m: rootdz,
    C1_blade: c1, C2_threat: c2,
    threat_predicted_m: threatPredicted,
    threat_error_m: (c2.max_m !== null && threatPredicted !== null) ? +(c2.max_m - threatPredicted).toFixed(2) : null,
  };
  out.classes[cls] = row; rows.push(row);
  console.log(`${cls}  ${wid.padEnd(24)} decl_reach ${String(declaredReach).padEnd(5)} rootdz ${String(rootdz).padEnd(6)} | C1 blade ${String(c1.min_m).padEnd(5)}..${String(c1.max_m).padEnd(5)} contig=${c1.contiguous} gaps=${JSON.stringify(c1.gaps)} | C2 threat ${String(c2.min_m).padEnd(5)}..${String(c2.max_m).padEnd(5)} contig=${c2.contiguous} gaps=${JSON.stringify(c2.gaps)} | thr_err ${row.threat_error_m}`);
}
out.acceptance = {
  non_contiguous_C1: rows.filter((r) => r.C1_blade.contiguous === false).map((r) => r.class),
  non_contiguous_C2: rows.filter((r) => r.C2_threat.contiguous === false).map((r) => r.class),
  reach_min_over_0_60: rows.filter((r) => r.C1_blade.min_m === null || r.C1_blade.min_m > 0.60).map((r) => ({ class: r.class, min: r.C1_blade.min_m })),
  threat_error_over_0_10: rows.filter((r) => r.threat_error_m === null || Math.abs(r.threat_error_m) > 0.10).map((r) => ({ class: r.class, err: r.threat_error_m })),
  blade_reach_vs_declared: rows.map((r) => ({ class: r.class, declared: r.declared_reach_m, measured: r.C1_blade.max_m, delta: r.C1_blade.max_m === null ? null : +(r.C1_blade.max_m - r.declared_reach_m).toFixed(2) })),
  threat_spread_m: (() => { const t = rows.map((r) => r.C2_threat.max_m).filter((x) => x !== null); return t.length ? +(Math.max(...t) - Math.min(...t)).toFixed(2) : null; })(),
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('\nACCEPTANCE');
console.log(' non-contiguous C1 (HARD FAIL if any):', JSON.stringify(out.acceptance.non_contiguous_C1));
console.log(' non-contiguous C2 (HARD FAIL if any):', JSON.stringify(out.acceptance.non_contiguous_C2));
console.log(' reach_min > 0.60 m (FAIL if any)   :', JSON.stringify(out.acceptance.reach_min_over_0_60));
console.log(' |threat - (reach+rootdz)| > 0.10 m :', JSON.stringify(out.acceptance.threat_error_over_0_10));
console.log(' threat_m spread (need >= 3.0 m)    :', out.acceptance.threat_spread_m);
