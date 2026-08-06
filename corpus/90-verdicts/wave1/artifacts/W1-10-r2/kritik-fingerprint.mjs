// D_min / Dg_min / D_med, computed by the critic under the wave-1 amended instruments
// (BAR-CRITIQUE-W1-10-R1 §R1/§R4): nine GRAMMAR_DIMS over 14 melee classes; D5 = blade reach
// with root suppressed; BOW substituted with the melee mean before the 15-class D vector.
// Two columns throughout: DECLARED (from the shipped JSON) and OBSERVED (from live motion).
'use strict';
import fs from 'node:fs';
const ROOT = '/home/user/elder-souls-claude';
const A = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const motion = A(`${ROOT}/corpus/90-verdicts/wave1/artifacts/W1-10-r2/kritik-motion.json`);
const arc = A(`${ROOT}/corpus/90-verdicts/wave1/artifacts/W1-10-r2/kritik-arc.json`);
const reach = A(`${ROOT}/corpus/90-verdicts/wave1/artifacts/W1-10-r2/kritik-reach.json`);
const MEL = ['DGR', 'FST', 'CSW', 'TSW', 'SSW', 'SPR', 'AXE', 'MCE', 'HLB', 'WHP', 'GSW', 'CGS', 'GHM', 'UGS'];
const ALL = MEL.concat(['BOW']);

const ms = {};
for (const f of fs.readdirSync(`${ROOT}/game/data/combat/movesets`)) {
  const d = A(`${ROOT}/game/data/combat/movesets/${f}`);
  if (d.weapon_id) ms[d.weapon_id] = d;
}
const MAND25 = 'r1.1 r1.2 r1.3 r2 r2.charged run.r1 run.r2 roll.r1 backstep.r1 jump.r1 plunge guard.counter guardbreak art.1 2h.r1.1 2h.r1.2 2h.r1.3 2h.r2 2h.r2.charged 2h.run.r1 2h.run.r2 2h.roll.r1 2h.backstep.r1 2h.jump.r1 2h.guard.counter'.split(' ');

function build(col) {
  const V = {};
  for (const c of ALL) {
    const mc = motion.per_class[c];
    const w = mc ? mc.weapon : Object.values(ms).find((m) => m.class === c).weapon_id;
    const M = ms[w];
    const ar = arc.rows.filter((r) => r.class === c);
    const r11a = ar.find((r) => r.slot === 'r1.1');
    const r2a = ar.find((r) => r.slot === 'r2');
    const s1 = M.slots['r1.1'], s2 = M.slots.r2;
    const mand = MAND25.filter((s) => M.slots[s]);
    const ha = mand.filter((s) => M.slots[s].hyperarmour && M.slots[s].hyperarmour.enabled).length;
    const rr = reach.classes[c];
    const dec = {
      D1: s1 ? s1.startup_f : 48, D2: s1 ? s1.recovery_f / s1.startup_f : 92 / 48,
      D3: (s2 ? s2.startup_f : 96) - (s1 ? s1.startup_f : 48),
      D4: mc ? mc.max_chain_len : 1, D5: M.reach_m, D6: s1 ? s1.arc_sweep_deg : 0,
      D7: s1 ? s1.root_dz_m : 0, D8: s1 ? s1.motion_value : 0.85, D9: s1 ? s1.stamina : 4,
      D10: s1 ? s1.poise_damage : 0, D11: ha / (mand.length || 25), D12: 4,
      G7: mc ? mc.G7_chain_arc_range : 0, G8: mc ? mc.G8_chain_shape_count : 1, G9: mc ? mc.G9_chain_root_ratio || 1 : 1,
    };
    const obs = { ...dec };
    if (col === 'observed') {
      if (r11a) obs.D6 = r11a.best_estimator;
      if (mc && mc.r1_1) obs.D7 = mc.r1_1.root_dz_m;
      if (rr && rr.C1_blade.max_m !== null) obs.D5 = rr.C1_blade.max_m;
      // G7 recomputed from measured arcs is already in motion.json (measured)
    }
    V[c] = col === 'observed' ? obs : dec;
  }
  // D5: substitute BOW with the melee mean AFTER melee values are known
  const meleeReach = MEL.map((c) => V[c].D5);
  V.BOW.D5 = meleeReach.reduce((a, b) => a + b, 0) / meleeReach.length;
  return V;
}
const z = (v) => { const m = v.reduce((a, b) => a + b, 0) / v.length; const s = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); return s === 0 ? v.map(() => 0) : v.map((x) => (x - m) / s); };
function dist(V, names, dims) {
  const Z = dims.map((d) => z(names.map((c) => V[c][d])));
  let min = Infinity, pair = null; const all = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    let s = 0; for (const d of Z) s += (d[i] - d[j]) ** 2;
    const dd = Math.sqrt(s); all.push({ dd, p: `${names[i]}-${names[j]}` });
    if (dd < min) { min = dd; pair = `${names[i]}-${names[j]}`; }
  }
  all.sort((a, b) => a.dd - b.dd);
  return { min: +min.toFixed(4), pair, med: +all[all.length >> 1].dd.toFixed(4), closest5: all.slice(0, 5).map((x) => `${x.p} ${x.dd.toFixed(3)}`), matrix_names: names, all };
}
const D_DIMS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12'];
const G_DIMS = ['D2', 'D4', 'D6', 'D7', 'D5', 'D11', 'G7', 'G8', 'G9'];
const OLD_G = ['D2', 'D4', 'D6', 'D7', 'D11'];

const out = { generated: new Date().toISOString(), columns: {} };
for (const col of ['declared', 'observed']) {
  const V = build(col);
  const D = dist(V, ALL, D_DIMS);
  const Dg = dist(V, MEL, G_DIMS);
  const DgOld = dist(V, MEL, OLD_G);
  out.columns[col] = { values: V, D_min: D.min, D_pair: D.pair, D_med: D.med, D_closest5: D.closest5, Dg_min: Dg.min, Dg_pair: Dg.pair, Dg_med: Dg.med, Dg_closest5: Dg.closest5, Dg_old5dim_min: DgOld.min, Dg_old5dim_pair: DgOld.pair };
  console.log(`--- ${col.toUpperCase()} ---`);
  console.log(`  D_min  ${D.min}  (${D.pair})   D_med ${D.med}    [PASS >= 1.6, HARD FAIL < 1.0]`);
  console.log(`  Dg_min ${Dg.min} (${Dg.pair})  Dg_med ${Dg.med}  [9 GRAMMAR_DIMS, 14 melee; PASS >= 1.0, HARD FAIL < 0.5]`);
  console.log(`  Dg_min (superseded 5-dim set) ${DgOld.min} (${DgOld.pair})`);
  console.log(`  closest D pairs: ${D.closest5.join(' | ')}`);
  console.log(`  closest Dg pairs: ${Dg.closest5.join(' | ')}`);
  console.log(`  classes with no D neighbour closer than 1.6: ${ALL.filter((c) => !D.all.some((x) => x.p.split('-').includes(c) && x.dd < 1.6)).length} of 15  [need >= 13]`);
  const g8 = MEL.filter((c) => V[c].G8 >= 2).length, g7 = MEL.filter((c) => V[c].G7 >= 20).length;
  console.log(`  chain_shape_count >= 2: ${g8}/14 [need >= 7]    chain_arc_range >= 20deg: ${g7}/14 [need >= 10]`);
  out.columns[col].derived = { classes_isolated_at_1_6: ALL.filter((c) => !D.all.some((x) => x.p.split('-').includes(c) && x.dd < 1.6)).length, chain_shape_ge2: g8, chain_arc_range_ge20: g7 };
}
fs.writeFileSync(process.argv[2] || '/dev/stdout', JSON.stringify(out, null, 1));
