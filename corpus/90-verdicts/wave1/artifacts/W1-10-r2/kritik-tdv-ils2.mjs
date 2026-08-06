// TDV to RI-WPN06 §B's own disjunction, ILS to RI-WPN05 §F's own nearest-neighbour definition.
'use strict';
import fs from 'node:fs';
import { loadCombatData } from '/home/user/elder-souls-claude/tools/lib/combat-node.mjs';
import { MovesetLibrary } from '/home/user/elder-souls-claude/game/src/combat/moveset.js';
const D = loadCombatData(); const MS = D.weaponMovesets;
const out = { generated: new Date().toISOString() };

// ---- TDV, RI-WPN06 §B ------------------------------------------------------------------------
const TWELVE = 'r1.1 r1.2 r1.3 r2 r2.charged run.r1 run.r2 roll.r1 backstep.r1 jump.r1 guard.counter art.1'.split(' ');
const rows = [];
for (const [wid, m] of Object.entries(MS)) {
  if (m.class === 'BOW') continue;
  if (m.class === 'FST') { rows.push({ weapon: wid, class: 'FST', TDV: null, note: 'n/a by §B FST exception' }); continue; }
  let div = 0;
  const detail = [];
  for (const s of TWELVE) {
    const a = m.slots[s], b = m.slots['2h.' + s];
    if (!a || !b) { detail.push(`${s}:absent`); continue; }
    if (a.anim === b.anim) { detail.push(`${s}:same-clip`); continue; }
    const fd = Math.max(Math.abs(a.startup_f - b.startup_f), Math.abs(a.active_f - b.active_f), Math.abs(a.recovery_f - b.recovery_f));
    const ok = fd >= 6 || a.shape !== b.shape || (a.chains_to || null) !== (b.chains_to || null)
      || !!(a.hyperarmour && a.hyperarmour.enabled) !== !!(b.hyperarmour && b.hyperarmour.enabled)
      || Math.abs((a.arc_sweep_deg || 0) - (b.arc_sweep_deg || 0)) >= 25
      || Math.abs((a.root_dz_m || 0) - (b.root_dz_m || 0)) >= 0.15;
    if (ok) div++; else detail.push(`${s}:clip-only`);
  }
  rows.push({ weapon: wid, class: m.class, diverging: div, TDV: +(div / 12).toFixed(4), notes: detail.slice(0, 4) });
}
const vals = rows.filter((r) => r.TDV !== null).map((r) => r.TDV).sort((a, b) => a - b);
out.TDV = {
  definition: 'RI-WPN06 §B, 12 mirrored slots, full disjunction; FST n/a',
  median: vals[vals.length >> 1], min: vals[0], max: vals[vals.length - 1],
  weapons_at_zero: rows.filter((r) => r.TDV === 0).map((r) => r.weapon),
  below_0_60: rows.filter((r) => r.TDV !== null && r.TDV < 0.60).length,
  n: vals.length, rows,
};
console.log(`TDV median ${out.TDV.median}  min ${out.TDV.min}  max ${out.TDV.max}  at-zero ${out.TDV.weapons_at_zero.length}  below 0.60 ${out.TDV.below_0_60}/${out.TDV.n}   [PASS >= 0.60; HARD FAIL any weapon = 0 or median < 0.25]`);
// the two per-class requirements
const classes = [...new Set(Object.values(MS).map((m) => m.class))].filter((c) => c !== 'BOW');
const exclusive = {}, chainChange = [];
for (const c of classes) {
  const wid = Object.entries(MS).filter(([, m]) => m.class === c).map(([k]) => k).sort()[0];
  const m = MS[wid];
  const ex = (m.stance && m.stance.two_hand && m.stance.two_hand.exclusive_slots) || [];
  exclusive[c] = ex.length;
  const chain1 = (() => { let n = 0, s = 'r1.1'; while (m.slots[s]) { n++; s = m.slots[s].chains_to; if (!s) break; } return n; })();
  const chain2 = (() => { let n = 0, s = '2h.r1.1'; while (m.slots[s]) { n++; s = m.slots[s].chains_to; if (!s) break; } return n; })();
  chainChange.push({ class: c, chain_1h: chain1, chain_2h: chain2, differs: chain1 !== chain2 });
}
out.TDV.exclusive_slots_per_class = exclusive;
out.TDV.classes_below_2_exclusive = Object.entries(exclusive).filter(([, n]) => n < 2).map(([c, n]) => `${c}=${n}`);
out.TDV.chain_length_change = { rows: chainChange, classes_changing: chainChange.filter((r) => r.differs).length, required: 4 };
console.log(`  two-hand-exclusive slots < 2: ${JSON.stringify(out.TDV.classes_below_2_exclusive)}   [need >= 2 per melee class]`);
console.log(`  classes whose chain length changes with grip: ${out.TDV.chain_length_change.classes_changing}/14  [need >= 4]`);

// ---- ILS, RI-WPN05 §F -------------------------------------------------------------------------
const lib = new MovesetLibrary(D.clipRegistry, D.weaponClasses, MS);
const MATS = Object.keys(D.weaponClasses.hitstop.attacker.light);
const TIERS = Object.keys(D.weaponClasses.hitstop.attacker);
const rep = {};
for (const t of TIERS) { const w = Object.entries(MS).find(([, m]) => m.weight_tier === t && m.slots['r1.1']); if (w) rep[t] = w[0]; }
const shake = D.weaponClasses.hitstop.shake || null;
const cells = [];
for (const t of TIERS) for (const mat of MATS) {
  const w = rep[t]; if (!w) continue;
  const hs = lib.hitstopFor(w, 'r1.1', mat);
  const kb = lib.knockbackFor(w, 'r1.1', mat);
  const sk = shake && shake[t] !== undefined ? shake[t] : hs / 4;   // camera shake peak proxy
  cells.push({ tier: t, mat, triple: [hs, sk, kb] });
}
// nearest neighbour over the normalised triple space, leave-one-out
const cols = [0, 1, 2].map((i) => { const v = cells.map((c) => c.triple[i]); const m = v.reduce((a, b) => a + b, 0) / v.length; const s = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1; return { m, s }; });
const nz = cells.map((c) => c.triple.map((v, i) => (v - cols[i].m) / cols[i].s));
let correct = 0; const misses = [];
for (let i = 0; i < cells.length; i++) {
  let best = Infinity, bj = -1;
  for (let j = 0; j < cells.length; j++) { if (i === j) continue; const d = Math.hypot(nz[i][0] - nz[j][0], nz[i][1] - nz[j][1], nz[i][2] - nz[j][2]); if (d < best) { best = d; bj = j; } }
  if (cells[bj].tier === cells[i].tier && cells[bj].mat === cells[i].mat) correct++;
  else misses.push(`${cells[i].tier}/${cells[i].mat} -> ${cells[bj].tier}/${cells[bj].mat}`);
}
const seen = new Map();
for (const c of cells) { const k = c.triple.join('|'); seen.set(k, (seen.get(k) || 0) + 1); }
const uniqueCells = cells.filter((c) => seen.get(c.triple.join('|')) === 1).length;
out.ILS_uniqueness_reading = { cells: cells.length, uniquely_identifiable: uniqueCells, ILS: +(uniqueCells / cells.length).toFixed(4),
  note: 'RI-WPN05 §F says a classifier must recover (tier,material) from the triple. A leave-one-out nearest-neighbour over 35 UNIQUE points recovers 0 by construction, so the literal text is unrunnable; this is the reading round 1 used and the only one that can score above 0. Reported as a BAR DEFECT.' };
out.ILS = { definition: 'RI-WPN05 §F: leave-one-out nearest neighbour over (attacker_hitstop, shake_peak, knockback) must recover (tier, material)', cells: cells.length, correct, ILS: +(correct / cells.length).toFixed(4), collisions: misses, bands: 'PASS >= 0.80, HARD FAIL < 0.40' };
console.log(`ILS (literal leave-one-out NN, per §F text) ${out.ILS.ILS} (${correct}/${cells.length}) -- UNRUNNABLE BY CONSTRUCTION`);
console.log(`ILS (uniqueness reading, round 1's) ${out.ILS_uniqueness_reading.ILS} (${out.ILS_uniqueness_reading.uniquely_identifiable}/${cells.length})`);
// tier-row span and monotonicity
const spans = {}; let monoFail = [];
for (const t of TIERS) { if (!rep[t]) continue; const v = MATS.map((m) => lib.hitstopFor(rep[t], 'r1.1', m)); spans[t] = Math.max(...v) - Math.min(...v); }
const TT = TIERS.filter((t)=>rep[t]);
for (const m of MATS) { const v = TT.map((t) => lib.hitstopFor(rep[t], 'r1.1', m)); for (let i = 1; i < v.length; i++) if (v[i] < v[i - 1]) monoFail.push(`${m}: ${TT[i - 1]} ${v[i - 1]} -> ${TT[i]} ${v[i]}`); }
out.ILS.tier_spans = spans; out.ILS.monotonicity_failures = monoFail;
console.log('  tier hitstop spans', JSON.stringify(spans), '[need >= 8 for medium/heavy/ultra]');
console.log('  monotonicity failures', monoFail.length ? JSON.stringify(monoFail) : 'none');
fs.writeFileSync(process.argv[2] || '/dev/stdout', JSON.stringify(out, null, 1));
