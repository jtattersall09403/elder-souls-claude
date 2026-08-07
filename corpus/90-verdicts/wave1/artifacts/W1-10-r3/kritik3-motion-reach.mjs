// KRITIK3 — reach, contiguity and hit resolution against a MOVING target and a MOVING attacker.
//
// AGENT-PROTOCOL.md failure mode 3, added wave 1 after a spell's tracking cutoff hid for a whole
// wave behind a stationary target:
//
//   > "if the thing you are measuring responds to motion, the target must move. A control that
//   >  cannot exhibit the failure is not a control."
//
// Every reach instrument this piece has been graded on — tools/harness/cmb-reach.mjs, the round-2
// critic's kritik-reach.mjs, the round-3 builder's connect-rate.mjs — spawns `dummy_passive` or
// `mat_flesh` at a fixed (0, d) and never moves it. Under S26 as amended the hazard is the swept
// BODY corridor and reach is measured "live at contact range", so a target that never translates
// exercises exactly one of the four ways two bodies can approach each other.
//
// Four regimes per (weapon, distance):
//   S  static           the control, and it reproduces the existing instruments
//   A  target approaches at 2.0 m/s along the attack axis
//   R  target retreats  at 2.0 m/s along the attack axis
//   L  target strafes   at 2.0 m/s laterally
// plus, separately, a MOVING ATTACKER regime (M) in which the player walks forward into the
// target while attacking, which is the case S26's body corridor was written for.
//
// The target is moved by writing its world position, one walk-speed step per frame, exactly as
// locomotion would. Nothing else in the fight is touched.
//
//   node kritik3-motion-reach.mjs out.json [--full]
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = '/home/user/elder-souls-claude';
const OUT = process.argv[2] || '/dev/stdout';
const FULL = process.argv.includes('--full');
const { NodeArena, loadCombatData } = await import(`${ROOT}/tools/lib/combat-node.mjs`);

const D = loadCombatData();
const STEP = 0.10, LO = 0.20, HI = 5.00;
const WALK = 2.0 / 60;               // locomotion.walk_mps, per frame

const byClass = {};
for (const [id, m] of Object.entries(D.weaponMovesets)) (byClass[m.class] ||= []).push(id);
for (const k of Object.keys(byClass)) byClass[k].sort();
const BASELINES = Object.fromEntries(Object.entries(byClass).map(([c, ids]) => [c, ids[0]]));

/**
 * One scripted r1.1 at one distance under one motion regime.
 * Returns {hit, via, dmg, frame, closest_m} — `closest_m` is how near the two roots ever came,
 * so a miss can be told from a miss-at-a-distance-that-never-happened.
 */
function fight(weapon, dist, regime) {
  const a = new NodeArena({ data: D, loadout: { weapon } });
  // mat_flesh, not dummy_passive: same material, but it is the fixture the material grid uses
  // and it cannot be pushed out of range by knockback.
  const e = a.spawn('t', 'mat_flesh', 0, dist, 180);
  e.knockbackImmune = true;
  a.lockOn('t');

  // Where the target starts, so that under A/R it is passing THROUGH `dist` around the frame the
  // hitbox opens. The r1.1 startup is the weapon's own.
  const s = D.weaponMovesets[weapon].slots['r1.1'];
  const openF = 4 + s.startup_f;                       // press at f=4
  const lead = openF * WALK;
  if (regime === 'A') e.pos[2] = dist + lead;
  if (regime === 'R') e.pos[2] = Math.max(0.05, dist - lead);
  if (regime === 'L') e.pos[0] = -lead;

  const script = [{ f: 4, press: ['light'] }, { f: 6, press: [], release: ['light'] }];
  if (regime === 'M') { script.unshift({ f: 1, move: [0, 1] }); }   // walk forward, then swing
  a.queueInputs(script);

  const total = s.startup_f + s.active_f + s.recovery_f + 40;
  let hit = null, closest = Infinity;
  for (let i = 1; i <= total; i++) {
    if (regime === 'A') e.pos[2] -= WALK;
    else if (regime === 'R') e.pos[2] += WALK;
    else if (regime === 'L') e.pos[0] += WALK;
    a.step();
    const dx = e.pos[0] - a.player.pos[0], dz = e.pos[2] - a.player.pos[2];
    closest = Math.min(closest, Math.hypot(dx, dz));
    for (const ev of a.drain()) {
      if (ev.kind === 'IMPACT' && !hit) hit = { f: i, via: ev.via, dmg: ev.dmg, part: ev.part };
    }
  }
  return { hit: !!hit, via: hit ? hit.via : null, dmg: hit ? hit.dmg : 0, closest_m: +closest.toFixed(3) };
}

function sweep(weapon, regime) {
  const v = [], det = [];
  for (let d = LO; d <= HI + 1e-9; d += STEP) {
    const dd = +d.toFixed(2);
    const r = fight(weapon, dd, regime);
    v.push(r.hit ? 1 : 0);
    det.push({ d: dd, ...r });
  }
  const dist = (i) => +(LO + i * STEP).toFixed(2);
  const idx = v.map((h, i) => (h ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return { hits: 0, min_m: null, max_m: null, contiguous: null, gaps: [], vector: v.join(''), body_hits: 0 };
  const lo = idx[0], hi = idx[idx.length - 1];
  const gaps = [];
  for (let i = lo; i <= hi; i++) if (!v[i]) { const st = i; while (i <= hi && !v[i]) i++; gaps.push([dist(st), dist(i - 1)]); }
  return {
    hits: idx.length, min_m: dist(lo), max_m: dist(hi),
    contiguous: gaps.length === 0, gaps, vector: v.join(''),
    body_hits: det.filter((x) => x.via === 'body').length,
    detail: FULL ? det : undefined,
  };
}

const REG = ['S', 'A', 'R', 'L', 'M'];
const out = {
  generated: new Date().toISOString(),
  instrument: 'kritik3-motion-reach.mjs (critic-authored, round 3)',
  protocol: 'AGENT-PROTOCOL.md failure mode 3 — the target must move',
  step_m: STEP, range_m: [LO, HI], target_speed_mps: 2.0,
  regimes: { S: 'static', A: 'target approaches 2.0 m/s', R: 'target retreats 2.0 m/s', L: 'target strafes 2.0 m/s', M: 'attacker walks forward into a static target' },
  classes: {},
};

for (const [cls, wid] of Object.entries(BASELINES)) {
  if (cls === 'BOW') continue;
  const ms = D.weaponMovesets[wid];
  if (!ms.slots['r1.1']) continue;
  const row = { weapon: wid, declared_reach_m: ms.reach_m, declared_root_dz_m: ms.slots['r1.1'].root_dz_m };
  for (const r of REG) row[r] = sweep(wid, r);
  out.classes[cls] = row;
  const f = (k) => `${String(row[k].min_m).padStart(4)}..${String(row[k].max_m).padStart(4)}${row[k].contiguous === false ? ' GAP' + JSON.stringify(row[k].gaps) : ''}`;
  console.log(`${cls.padEnd(4)} ${wid.padEnd(26)} decl ${String(ms.reach_m).padEnd(6)} | S ${f('S')} | A ${f('A')} | R ${f('R')} | L ${f('L')} | M ${f('M')}`);
}

// ---- acceptance ------------------------------------------------------------------------------
const rows = Object.entries(out.classes);
out.acceptance = {};
for (const r of REG) {
  out.acceptance[r] = {
    non_contiguous: rows.filter(([, v]) => v[r].contiguous === false).map(([c, v]) => ({ class: c, gaps: v[r].gaps })),
    lands_nothing: rows.filter(([, v]) => v[r].hits === 0).map(([c]) => c),
    reach_min_over_0_60: rows.filter(([, v]) => v[r].min_m === null || v[r].min_m > 0.60).map(([c, v]) => ({ class: c, min: v[r].min_m })),
    max_reach_shortfall_vs_declared: rows.map(([c, v]) => ({ class: c, declared: v.declared_reach_m, reached: v[r].max_m, delta: v[r].max_m === null ? null : +(v[r].max_m - v.declared_reach_m).toFixed(2) })),
  };
}
// The headline this instrument exists for: does moving change the answer?
out.motion_delta = rows.map(([c, v]) => ({
  class: c,
  S_max: v.S.max_m, A_max: v.A.max_m, R_max: v.R.max_m, L_max: v.L.max_m, M_max: v.M.max_m,
  S_hits: v.S.hits, A_hits: v.A.hits, R_hits: v.R.hits, L_hits: v.L.hits, M_hits: v.M.hits,
  static_only_pass: v.S.contiguous === true && [v.A, v.R, v.L, v.M].some((x) => x.contiguous === false),
}));
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('\nACCEPTANCE, per regime');
for (const r of REG) {
  console.log(` ${r}: non-contiguous ${JSON.stringify(out.acceptance[r].non_contiguous.map((x) => x.class))}` +
    `  lands-nothing ${JSON.stringify(out.acceptance[r].lands_nothing)}` +
    `  reach_min>0.60 ${JSON.stringify(out.acceptance[r].reach_min_over_0_60.map((x) => x.class))}`);
}
console.log(' static-passes-but-motion-fails:', JSON.stringify(out.motion_delta.filter((x) => x.static_only_pass).map((x) => x.class)));
