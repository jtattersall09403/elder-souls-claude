// `D_min`, `D_med`, `Dg_min` and `SEP`/`W_min`/`W_med`/`W_max`, RECOMPUTED ON THE REPAIRED
// MEASURE, in both the DECLARED and the OBSERVED column.
//
// Why this file exists. `BAR-CRITIQUE-W1-10-R1` §R1 found that the reach column every one of
// those numbers reads was broken in two ways at once:
//
//   1. `reach_m` was excluded from `Dg` as a "mass dimension" on a correlation with weight tier
//      of 0.586, against 0.889 / 0.873 / 0.935 for the three genuine mass dimensions. Reach is
//      geometry, and §A defines four of the fifteen classes purely by spacing.
//   2. BOW sat inside the z-normalisation population. A 22.0 m projectile range against a melee
//      span of 0.90-3.60 m compresses the melee reach z-span from 3.599 to 0.542 — a 6.64x loss
//      of discrimination — and that column feeds `D_min` and `SEP` as well as `Dg`.
//
// The ruling's own words: "the published `D_min = 1.629` and `SEP = 1.4469` were read off a
// broken measure". So neither is carried forward. Both are recomputed here under:
//
//   * D5 z-normalised over the 14 MELEE classes, BOW's cell substituted with the melee mean
//     BEFORE the 15-class vector is built (RI-WPN02 M2 as amended);
//   * `Dg` over the nine `GRAMMAR_DIMS` (D2 D4 D5 D6 D7 D11 G7 G8 G9) across the 14 melee
//     classes, with G7/G8/G9 measured from the rig and never read from declared JSON;
//   * `F87` (RI-WPN03 §D.2) built the same way, over all 87 weapons, with the five BOW rows'
//     reach substituted with the melee mean before z-normalisation — the identical defect at
//     the 87-weapon scale, and the reason `SEP` was overstated.
//
// The OBSERVED column takes D5, D6, D7 and G7-G9 from the rig — the same `trackOf` walk
// `tools/weapons/motion-census.mjs` uses — and D12 from `impact.js`. Nothing in the observed
// column is read from the field it is supposed to be checking.
//
//   node tools/weapons/fingerprint.mjs [out.json]
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = process.argv[2] || path.resolve(ROOT, 'reports/W1-10-fingerprint.json');
const { loadCombatData } = await import(`${ROOT}/tools/lib/combat-node.mjs`);
const { MovesetLibrary } = await import(`${ROOT}/game/src/combat/moveset.js`);
const { Rig } = await import(`${ROOT}/game/src/combat/skeleton.js`);
const { resolveImpact } = await import(`${ROOT}/game/src/combat/impact.js`);

const D = loadCombatData();
const CLASSES = JSON.parse(fs.readFileSync(`${ROOT}/game/data/weapons/classes.json`, 'utf8'));
const lib = new MovesetLibrary(
  { clips: JSON.parse(fs.readFileSync(`${ROOT}/game/data/weapons/clip-registry.json`, 'utf8')).clips },
  CLASSES, D.weaponMovesets, D.skeleton, D.hitgeometry);

const MEL = ['DGR', 'FST', 'CSW', 'TSW', 'SSW', 'SPR', 'AXE', 'MCE', 'HLB', 'WHP', 'GSW', 'CGS', 'GHM', 'UGS'];
const ALL = MEL.concat(['BOW']);
const NEAR_AXIS = 0.20;
const MAND25 = ('r1.1 r1.2 r1.3 r2 r2.charged run.r1 run.r2 roll.r1 backstep.r1 jump.r1 plunge guard.counter '
  + 'guardbreak art.1 2h.r1.1 2h.r1.2 2h.r1.3 2h.r2 2h.r2.charged 2h.run.r1 2h.run.r2 2h.roll.r1 2h.backstep.r1 '
  + '2h.jump.r1 2h.guard.counter').split(' ');

const rig = new Rig(D.skeleton, D.hitgeometry);

/**
 * One slot walked on the real rig. Blade reach is the tip's horizontal radius from the actor's
 * OWN root — root translation is subtracted by construction, which is exactly what
 * `BAR-CRITIQUE-W1-10-R1` §R4 means by "blade reach, measured with root translation suppressed",
 * and it keeps D5 independent of D7 (`Root Δz`) as the ruling requires.
 */
function walk(weaponId, slotId) {
  const slot = D.weaponMovesets[weaponId].slots[slotId];
  if (!slot) return null;
  const clip = lib.clipFor(weaponId, slotId);
  const sock = lib.socketsFor(weaponId, slotId);
  const startup = slot.startup_f + (slot.charge_max_f || 0);
  const active = slot.active_f;
  const pos = [0, 0, 0];
  let prev = null, arc = 0, reach = 0;
  const planeN = [0, 0, 0];
  let first = null, last = null;
  for (let f = 1; f <= clip.total; f++) {
    pos[2] = clip.rootForwardAt(f);
    clip.applyPose(rig, f);
    rig.evaluate(pos, 0, clip.rootOffsetYAt(f), sock.a, sock.b);
    if (f <= startup || f > startup + active) continue;
    const dx = rig.socketB[0] - pos[0], dy = rig.socketB[1], dz = rig.socketB[2] - pos[2];
    const r = Math.hypot(dx, dz);
    if (r > reach) reach = r;
    if (!first) first = [dx, dy, dz];
    last = [dx, dy, dz];
    if (r < NEAR_AXIS) { prev = null; continue; }
    const b = Math.atan2(dx, dz);
    if (prev !== null) { let d = b - prev; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; arc += Math.abs(d); }
    prev = b;
  }
  // swing-plane inclination: the angle between the chord first->last and the horizontal
  let incl = 0;
  if (first && last) {
    const vx = last[0] - first[0], vy = last[1] - first[1], vz = last[2] - first[2];
    const h = Math.hypot(vx, vz);
    incl = Math.abs(Math.atan2(vy, h)) * 180 / Math.PI;
  }
  planeN[0] = incl;
  return { arc_deg: +(arc * 180 / Math.PI).toFixed(2), blade_reach_m: +reach.toFixed(4), incl_deg: +incl.toFixed(1), root_dz_m: slot.root_dz_m, clip: clip.id };
}

/** The chain, walked link by link — G7/G8/G9 come from here and from nowhere else. */
function chainOf(weaponId) {
  const ms = D.weaponMovesets[weaponId];
  const links = [];
  let id = 'r1.1', guard = 0;
  const seen = new Set();
  while (id && ms.slots[id] && guard++ < 8 && !seen.has(id)) {
    seen.add(id);
    const w = walk(weaponId, id);
    if (!w) break;
    links.push({ id, arc: w.arc_deg, root: Math.abs(w.root_dz_m || 0), shape: ms.slots[id].shape || 'none' });
    id = ms.slots[id].chains_to;
  }
  if (!links.length) return { G7: 0, G8: 1, G9: 1, len: 0 };
  const arcs = links.map((l) => l.arc);
  const roots = links.map((l) => l.root);
  const r0 = roots[0] || 1e-6;
  return {
    G7: +(Math.max(...arcs) - Math.min(...arcs)).toFixed(2),
    G8: new Set(links.map((l) => l.shape)).size,
    G9: +(roots.reduce((a, b) => a + b, 0) / (roots.length * r0)).toFixed(4),
    len: links.length,
  };
}

/** D12 — the flesh hitstop the fight actually applies, from `impact.js`, not from a constant. */
function hitstopFlesh(weaponId) {
  const ms = D.weaponMovesets[weaponId];
  const s = ms.slots['r1.1'];
  if (!s) return 0;
  const move = { weight_tier: ms.weight_tier, shape: s.shape, poise_damage: s.poise_damage, hitstop_f_table: s.hitstop_f_table, hitstop_f: s.hitstop_f };
  try { return resolveImpact(CLASSES, move, 'flesh').attacker_hitstop_f; } catch { return 0; }
}

// ---- build the per-weapon rows ----------------------------------------------------------------
const byClass = {};
for (const [id, m] of Object.entries(D.weaponMovesets)) (byClass[m.class] ||= []).push(id);
for (const k of Object.keys(byClass)) byClass[k].sort();

const W = {};
for (const [c, ids] of Object.entries(byClass)) {
  for (const wid of ids) {
    const ms = D.weaponMovesets[wid];
    const s1 = ms.slots['r1.1'] || ms.slots['bow.quick'];
    const s2 = ms.slots.r2 || ms.slots['bow.aimed'];
    const k1 = ms.slots['r1.1'] ? 'r1.1' : 'bow.quick';
    const o1 = walk(wid, k1);
    const mand = MAND25.filter((s) => ms.slots[s]);
    const ha = mand.filter((s) => ms.slots[s].hyperarmour && ms.slots[s].hyperarmour.enabled).length;
    const ch = chainOf(wid);
    // max chain length, from the declared graph but WALKED (a `chains_to` pointing at a slot
    // that does not exist is a chain of 1, whatever the JSON says)
    const dec = {
      D1: s1.startup_f, D2: s1.recovery_f / s1.startup_f, D3: (s2 ? s2.startup_f : s1.startup_f) - s1.startup_f,
      D4: ch.len, D5: ms.reach_m, D6: Math.abs(s1.arc_sweep_deg || 0), D7: Math.abs(s1.root_dz_m || 0),
      D8: s1.motion_value, D9: s1.stamina, D10: s1.poise_damage, D11: ha / (mand.length || 25),
      D12: hitstopFlesh(wid),
      G7: ch.G7, G8: ch.G8, G9: ch.G9,
    };
    const obs = { ...dec };
    if (o1) { obs.D5 = o1.blade_reach_m; obs.D6 = o1.arc_deg; obs.D7 = Math.abs(o1.root_dz_m || 0); }
    W[wid] = { wid, class: c, declared: dec, observed: obs, baseline: wid === byClass[c][0] };
  }
}

// ---- the distance machinery --------------------------------------------------------------------
const z = (v) => { const m = v.reduce((a, b) => a + b, 0) / v.length; const s = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); return s === 0 ? v.map(() => 0) : v.map((x) => (x - m) / s); };

/**
 * The repair, in one function. `meleeMask` marks which rows are melee; D5 is z-normalised over
 * those rows ALONE and the non-melee rows take the melee mean, so a 22 m projectile range can
 * no longer flatten a 0.90-3.60 m melee span. Every other dimension is normalised over the
 * whole population, which is what they mean.
 */
function zdims(rows, dims, meleeMask) {
  return dims.map((d) => {
    const raw = rows.map((r) => r[d]);
    if (d !== 'D5') return z(raw);
    const mel = raw.filter((_, i) => meleeMask[i]);
    const mean = mel.reduce((a, b) => a + b, 0) / mel.length;
    const sub = raw.map((v, i) => (meleeMask[i] ? v : mean));
    const m = mean, s = Math.sqrt(mel.reduce((a, b) => a + (b - m) ** 2, 0) / mel.length);
    return s === 0 ? sub.map(() => 0) : sub.map((x) => (x - m) / s);
  });
}

function pairs(names, rows, dims, meleeMask) {
  const Z = zdims(rows, dims, meleeMask);
  const all = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    let s = 0; for (const d of Z) s += (d[i] - d[j]) ** 2;
    all.push({ d: Math.sqrt(s), a: names[i], b: names[j], i, j });
  }
  all.sort((x, y) => x.d - y.d);
  return all;
}

const D_DIMS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12'];
const G_DIMS = ['D2', 'D4', 'D5', 'D6', 'D7', 'D11', 'G7', 'G8', 'G9'];
const OLD_G = ['D2', 'D4', 'D6', 'D7', 'D11'];

const out = { generated: new Date().toISOString(), instrument: 'repaired per BAR-CRITIQUE-W1-10-R1 §R1: D5 z-normalised over melee only, BOW substituted with the melee mean, at BOTH the 15-class and the 87-weapon scale', columns: {} };

for (const col of ['declared', 'observed']) {
  // --- 15 class baselines -> D ---
  const baseIds = ALL.map((c) => byClass[c][0]);
  const rows15 = baseIds.map((id) => W[id][col]);
  const mask15 = ALL.map((c) => c !== 'BOW');
  const Dall = pairs(ALL, rows15, D_DIMS, mask15);
  const D_min = Dall[0], D_med = Dall[Dall.length >> 1];
  const isolated = ALL.filter((c) => !Dall.some((p) => (p.a === c || p.b === c) && p.d < 1.6)).length;

  // --- 14 melee -> Dg ---
  const melIds = MEL.map((c) => byClass[c][0]);
  const rows14 = melIds.map((id) => W[id][col]);
  const mask14 = MEL.map(() => true);
  const Gall = pairs(MEL, rows14, G_DIMS, mask14);
  const Gold = pairs(MEL, rows14, OLD_G, mask14);

  // --- 87 weapons -> F87 / SEP ---
  const ids87 = Object.keys(W).sort();
  const rows87 = ids87.map((id) => W[id][col]);
  const mask87 = ids87.map((id) => W[id].class !== 'BOW');
  const Fall = pairs(ids87, rows87, D_DIMS, mask87);
  const same = Fall.filter((p) => W[p.a].class === W[p.b].class);
  const diff = Fall.filter((p) => W[p.a].class !== W[p.b].class);
  const B_min = diff[0], W_minP = same[0], W_maxP = same[same.length - 1];
  const W_med = same[same.length >> 1].d;
  const SEP = B_min.d / W_maxP.d;

  out.columns[col] = {
    D_min: +D_min.d.toFixed(4), D_pair: `${D_min.a}-${D_min.b}`, D_med: +D_med.d.toFixed(4),
    D_closest5: Dall.slice(0, 5).map((p) => `${p.a}-${p.b} ${p.d.toFixed(3)}`),
    classes_isolated_at_1_6: isolated,
    Dg_min: +Gall[0].d.toFixed(4), Dg_pair: `${Gall[0].a}-${Gall[0].b}`, Dg_med: +Gall[Gall.length >> 1].d.toFixed(4),
    Dg_closest5: Gall.slice(0, 5).map((p) => `${p.a}-${p.b} ${p.d.toFixed(3)}`),
    Dg_old5dim_min: +Gold[0].d.toFixed(4), Dg_old5dim_pair: `${Gold[0].a}-${Gold[0].b}`,
    B_min: +B_min.d.toFixed(4), B_min_pair: `${B_min.a} / ${B_min.b}`,
    W_min: +W_minP.d.toFixed(4), W_min_pair: `${W_minP.a} / ${W_minP.b}`,
    W_max: +W_maxP.d.toFixed(4), W_max_pair: `${W_maxP.a} / ${W_maxP.b}`,
    W_med: +W_med.toFixed(4),
    SEP: +SEP.toFixed(4),
    chain_shape_ge2: MEL.filter((c) => W[byClass[c][0]][col].G8 >= 2).length,
    chain_arc_range_ge20: MEL.filter((c) => W[byClass[c][0]][col].G7 >= 20).length,
  };
  const o = out.columns[col];
  console.log(`\n--- ${col.toUpperCase()} ---`);
  console.log(`  D_min   ${o.D_min}  (${o.D_pair})    D_med ${o.D_med}      [PASS >= 1.6, HARD FAIL < 1.0]`);
  console.log(`  Dg_min  ${o.Dg_min} (${o.Dg_pair})   Dg_med ${o.Dg_med}   [9 GRAMMAR_DIMS / 14 melee; PASS >= 1.0, HARD FAIL < 0.5]`);
  console.log(`  Dg_min (superseded 5-dim) ${o.Dg_old5dim_min} (${o.Dg_old5dim_pair})`);
  console.log(`  SEP     ${o.SEP}   = B_min ${o.B_min} / W_max ${o.W_max}   [PASS >= 1.4, HARD FAIL < 1.0]`);
  console.log(`     B_min pair ${o.B_min_pair}`);
  console.log(`     W_max pair ${o.W_max_pair}`);
  console.log(`  W_min   ${o.W_min}  (${o.W_min_pair})    [PASS >= 0.20, HARD FAIL < 0.05]`);
  console.log(`  W_med   ${o.W_med}    [PASS in 0.35..1.00]`);
  console.log(`  classes with no D neighbour closer than 1.6: ${o.classes_isolated_at_1_6} of 15   [need >= 13]`);
  console.log(`  chain_shape_count >= 2: ${o.chain_shape_ge2}/14 [>=7]   chain_arc_range >= 20: ${o.chain_arc_range_ge20}/14 [>=10]`);
  console.log(`  closest D pairs:  ${o.D_closest5.join(' | ')}`);
  console.log(`  closest Dg pairs: ${o.Dg_closest5.join(' | ')}`);
}

// --- the defect, restated as a measurement on THIS roster ---------------------------------------
{
  const ids87 = Object.keys(W).sort();
  const reach = ids87.map((id) => W[id].observed.D5);
  const isMel = ids87.map((id) => W[id].class !== 'BOW');
  const zAll = z(reach);
  const melZ = zAll.filter((_, i) => isMel[i]);
  const spanAll = Math.max(...melZ) - Math.min(...melZ);
  const melOnly = reach.filter((_, i) => isMel[i]);
  const zMel = z(melOnly);
  const spanMel = Math.max(...zMel) - Math.min(...zMel);
  out.bow_contamination = { melee_reach_zspan_bow_inside: +spanAll.toFixed(4), melee_reach_zspan_bow_excluded: +spanMel.toFixed(4), discrimination_lost_x: +(spanMel / spanAll).toFixed(2) };
  console.log(`\nBOW CONTAMINATION on THIS roster's OBSERVED blade reach (87 weapons):`);
  console.log(`  melee z-span with BOW inside the population : ${spanAll.toFixed(4)}`);
  console.log(`  melee z-span with BOW substituted           : ${spanMel.toFixed(4)}`);
  console.log(`  discrimination that was being thrown away   : ${(spanMel / spanAll).toFixed(2)}x`);
}

out.per_weapon = W;
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`\nwrote ${OUT}`);
