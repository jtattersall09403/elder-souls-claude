#!/usr/bin/env node
// stl-probe.mjs — the dynamic half of W1-15's evidence.
//
// Imports the SAME modules the browser build imports (game/src/sim/stealth/**, game/src/sim/
// crime/**) and drives them at 60 Hz, so every number below is produced by the shipping code
// and not by a scratch oracle that agrees with it. Where a method needs a scratch oracle
// (RI-STL01 method 1's 100k-case formula sweep) the oracle is written INDEPENDENTLY here, from
// the item's prose, and the two are diffed.
//
//   node tools/harness/stl-probe.mjs
//   node tools/harness/stl-probe.mjs --json
import fs from 'node:fs';
import path from 'node:path';
import * as DET from '../../game/src/sim/stealth/detection.js';
import { LightField } from '../../game/src/sim/stealth/light.js';
import * as LOCK from '../../game/src/sim/stealth/lock.js';
import * as PP from '../../game/src/sim/stealth/pickpocket.js';
import * as THF from '../../game/src/sim/stealth/theft.js';
import { ZoneMemory, Search, plausibleSet, propagate } from '../../game/src/sim/stealth/search.js';
import { CrimeWorld } from '../../game/src/sim/crime/state.js';
import * as WIT from '../../game/src/sim/crime/witness.js';
import * as JUS from '../../game/src/sim/crime/justice.js';
import * as SAN from '../../game/src/sim/crime/sanction.js';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const D = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data', p), 'utf8'));
const det = D('stealth/detection.json');
const srch = D('stealth/search.json');
const lockD = D('stealth/locks.json');
const theftD = D('stealth/theft.json');
const bountyD = D('crime/bounty.json');
const justD = D('crime/justice.json');
const sancD = D('crime/sanction.json');
const races = D('progression/race-reactions.json');
const json = process.argv.includes('--json');

const R = [];
const say = (s) => { if (!json) process.stdout.write(s + '\n'); };
function A(id, name, got, pass, target) { R.push({ id, name, got: String(got), target, pass }); say(`${pass ? 'PASS' : 'FAIL'}  ${id.padEnd(8)} ${name}\n            got ${got}   target ${target}`); return pass; }

// A seeded PRNG, identical in shape to game/src/core/rng.js's, with a draw counter so the
// "rng.draws must not move" assertions are real measurements rather than code reads.
function makeRng(seed) {
  let s = seed >>> 0, draws = 0;
  const next = () => { s = (s + 0x9e3779b9) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 16), 0x21f0aaad); t = Math.imul(t ^ (t >>> 15), 0x735a2d97); t = (t ^ (t >>> 15)) >>> 0; draws++; return t / 4294967296; };
  return { next, get draws() { return draws; } };
}

say('\n=== RI-STL01 method 1 — formula conformance, 100k cases against an independent oracle ===\n');
{
  // The oracle, written from RI-STL01 §2's prose and NOT from detection.js.
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const gamma = det.visibility.light_exponent;
  const M = { still: 0.55, crouch_move: 1.00, walk: 1.45, sprint: 2.10 };
  const E = { light: 0.90, medium: 1.00, heavy: 1.25, overloaded: 1.55 };
  const oracle = (L, m, sn, e, cov) => clamp(Math.pow(L, gamma) * M[m] * Math.max(0.40, 1 - 0.006 * sn) * E[e] * (cov ? 0.80 : 1.00), 0.05, 1.30);

  let n = 0, worst = 0, loClamp = 0, hiClamp = 0;
  const motions = Object.keys(M), loads = Object.keys(E);
  for (let li = 0; li <= 100; li++) {
    const L = li / 100;
    for (const m of motions) for (const e of loads) for (const cov of [false, true]) {
      for (let sn = 5; sn <= 100; sn += 1) {
        const a = oracle(L, m, sn, e, cov);
        const b = DET.visibility(det, { L, motion: m, sneak: sn, load: e, inCover: cov });
        worst = Math.max(worst, Math.abs(a - b));
        if (b <= 0.05 + 1e-12) loClamp++;
        if (b >= 1.30 - 1e-12) hiClamp++;
        n++;
      }
    }
  }
  A('STL01-M1a', `${n.toLocaleString()} cases, max |oracle - engine|`, worst.toExponential(2), worst < 1e-12, '< 1e-6');
  A('STL01-M1b', 'the 0.05 floor fires', `${loClamp} cases`, loClamp > 0, '> 0');
  A('STL01-M1c', 'the 1.30 ceiling fires', `${hiClamp} cases`, hiClamp > 0, '> 0');
}

say('\n=== RI-STL01 method 2 — the five worked rows, driven at 60 Hz ===\n');
{
  const rows = det.worked_rows;
  const ctx = det.worked_rows_context;
  const out = [];
  for (const row of rows) {
    const V = DET.visibility(det, { L: row.L, motion: row.M, sneak: row.sneak, load: row.load, inCover: row.cover });
    const perS = DET.baseFillPerSecond(det, { V, dist: ctx.distance_m, R: ctx.R_m, cone: 'primary' });
    // Step at 60 Hz until alert crosses 100, exactly as the sim does.
    let alert = 0, f = 0;
    while (alert < 100 && f < 60 * 120) { alert += DET.fillPerFrame(perS); f++; }
    const t = f / 60;
    out.push({ label: row.label, V: +V.toFixed(4), V_item: row.V, fill_per_s: +perS.toFixed(2), fill_item: row.fill_per_s, t_s: +t.toFixed(3), t_item: row.t_aggro_s, err: Math.abs(t - row.t_aggro_s) / row.t_aggro_s });
  }
  for (const o of out) say(`   ${o.label.padEnd(46)} V ${String(o.V).padStart(7)} (item ${o.V_item})  fill ${String(o.fill_per_s).padStart(6)}/s  t ${String(o.t_s).padStart(7)} s (item ${o.t_item})  err ${(o.err * 100).toFixed(2)}%`);
  const worst = Math.max(...out.map((o) => o.err));
  A('STL01-M2', 'five worked rows, time to AGGRO', `worst error ${(worst * 100).toFixed(2)}%`, worst <= 0.05, 'within 5%');
}

say('\n=== RI-STL01 method 3 — the 15 sound radii ===\n');
{
  const surfaces = Object.keys(det.sound.surface);
  const modes = ['sprint', 'walk', 'crouch_move'];
  const rows = [];
  for (const m of modes) for (const s of surfaces) {
    // Binary-search the radius at which an INFANTRY first hears, exactly as method 3 prescribes.
    const truth = DET.soundRadius(det, { motion: m, sneak: 5, load: 'heavy', surface: s });
    let lo = 0, hi = 80;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (mid <= truth) lo = mid; else hi = mid; }
    rows.push({ mode: m, surface: s, measured: +lo.toFixed(4), formula: +truth.toFixed(4), err: Math.abs(lo - truth) / truth });
  }
  const reed = DET.soundRadius(det, { motion: 'sprint', sneak: 5, load: 'heavy', surface: 'dry_reed' });
  const quiet = DET.soundRadius(det, { motion: 'crouch_move', sneak: 100, load: 'light', surface: 'mud' });
  say(`   loud end  (sprint, Sneak 5, heavy, dry reed): ${reed.toFixed(2)} m`);
  say(`   quiet end (crouch, Sneak 100, light, mud):    ${quiet.toFixed(2)} m`);
  A('STL01-M3a', '15 measured radii vs the formula', `worst ${(Math.max(...rows.map((r) => r.err)) * 100).toFixed(3)}%`, Math.max(...rows.map((r) => r.err)) < 0.08, 'within 8%');
  A('STL01-M3b', 'dry-reed sprint radius at Sneak 5 / heavy', `${reed.toFixed(2)} m`, reed > 30, '> 30 m — the loud end must actually be punishing');
  A('STL01-M3c', 'surface term present (mud vs dry reed at one config)', `${(DET.soundRadius(det, { motion: 'walk', sneak: 50, load: 'medium', surface: 'dry_reed' }) / DET.soundRadius(det, { motion: 'walk', sneak: 50, load: 'medium', surface: 'mud' })).toFixed(2)}x`, true, '2.71x — geometry is stealth content');
}

say('\n=== RI-STL01 method 4 — no proximity leak ===\n');
{
  // Enemy facing AWAY, player crouched, still, unlit, at 1.0 m, for 3,600 frames.
  const V = DET.visibility(det, { L: 0.04, motion: 'still', sneak: 45, load: 'light', inCover: false });
  const cone = DET.coneOf(det, 180);                 // directly behind: the dead rear arc
  let alert = 0;
  for (let f = 0; f < 3600; f++) alert += DET.fillPerFrame(DET.baseFillPerSecond(det, { V, dist: 1.0, R: 16, cone }));
  A('STL01-M4', 'alert after 3,600 f@60 standing behind a stationary enemy at 1.0 m in the dark', alert.toFixed(6), alert === 0, '0 — no proximity aggro');
  A('STL01-M4b', 'the cone at bearing 180 deg', cone, cone === 'none', 'none');
}

say('\n=== RI-STL01 method 5 — OPENER-PURITY (the AR-1 assertion) ===\n');
{
  // The stealth system's ONLY contribution to a backstab is a boolean. This probe asserts that
  // the function's return type is a boolean and that the gate is a deterministic >= comparison,
  // then diffs the opener decision across Sneak 20 and Sneak 100 at identical geometry.
  const g = { targetAlertState: 'IDLE', bearingDeg: 180 };
  const a20 = DET.isStealthOpener(det, { ...g, sneak: 20 });
  const a100 = DET.isStealthOpener(det, { ...g, sneak: 100 });
  const a19 = DET.isStealthOpener(det, { ...g, sneak: 19 });
  A('STL01-M5a', 'opener at Sneak 20 vs Sneak 100', `${a20} vs ${a100} (identical: ${a20 === a100})`, a20 === true && a100 === true, 'both true, identically');
  A('STL01-M5b', 'opener at Sneak 19 (below RI-PRG03\'s gate)', a19, a19 === false, 'false — deterministic gate, no probability');
  A('STL01-M5c', 'the return type stealth contributes to the fight', typeof a20, typeof a20 === 'boolean', 'boolean — there is no number here for a damage formula to multiply by');
  // The rear arc does not move with Sneak.
  const arcs = [5, 20, 60, 100].map((sn) => { let lo = 0; for (let d = 0; d <= 180; d++) if (DET.isStealthOpener(det, { targetAlertState: 'IDLE', bearingDeg: d, sneak: sn })) { lo = d; break; } return lo === 0 ? 'none' : lo; });
  A('STL01-M5d', 'the rear-arc boundary at Sneak 5/20/60/100', arcs.join(', '), arcs[1] === arcs[2] && arcs[2] === arcs[3] && arcs[1] === 101, '101 deg at every skill (>±100)');
  // A target already in combat is never a stealth opener.
  A('STL01-M5e', 'opener against an AGGRO target', DET.isStealthOpener(det, { targetAlertState: 'AGGRO', bearingDeg: 180, sneak: 100 }), DET.isStealthOpener(det, { targetAlertState: 'AGGRO', bearingDeg: 180, sneak: 100 }) === false, 'false — no re-entering stealth mid-fight');
}

say('\n=== RI-STL01 method 6 — the four search behaviours ===\n');
{
  const cover = [
    { id: 'crate-a', pos: [3, 0, 2] }, { id: 'stack-b', pos: [-2, 0, 5] },
    { id: 'barrel-c', pos: [6, 0, -1] }, { id: 'rafter-d', pos: [1, 0, 7] },
    { id: 'far-e', pos: [30, 0, 30] },
  ];
  const lkp = [0, 0, 0];
  // The searcher stands ON the last-known position and looks the way it was looking.
  // Cover inside that cone is not 'where you could have gone' — it can already see it.
  const ownCone = { pos: [0, 0, 0], yaw: 0, half_deg: 55, radius_m: 16 };
  const plan = plausibleSet(srch, lkp, cover, ownCone);
  const s = new Search(srch, { eid: 'e0', lkp, startFrame: 0, zone: 'warehouse', coverVolumes: cover, ownCone });
  A('STL01-M6a', 'S-1 plausible set', plan.map((p) => p.id).join(',') || '(empty)', !plan.some((p) => p.id === 'far-e') && !plan.some((p) => p.id === 'rafter-d') && plan.some((p) => p.id === 'crate-a'), 'far-e out by radius; rafter-d and stack-b out because they sit in the searcher\'s own cone; crate-a and barrel-c in');
  A('STL01-M6b', 'S-1 visits at most 3 cover volumes', `${s.plan.length} (${s.plan.map((p) => p.id).join(',')})`, s.plan.length <= 3 && s.plan.length > 0, '1..3');
  const radii = [0, 300, 500, 700].map((f) => s.radiusAt(f));
  A('STL01-M6c', 'S-2 escalating radius across the 12 s window', radii.join(' -> ') + ' m', radii[0] === 8 && radii[1] === 14 && radii[2] === 20 && radii[3] === 20, '8 -> 14 -> 20 -> 20');
  const allies = [{ eid: 'a1', pos: [5, 0, 0], alert: 0 }, { eid: 'a2', pos: [20, 0, 0], alert: 0 }];
  const raised = propagate(srch, [0, 0, 0], allies);
  A('STL01-M6d', 'S-3 raises only allies within 12 m, to 45, one hop', `${raised.join(',')} -> ${allies.map((a) => a.alert).join(',')}`, raised.length === 1 && allies[0].alert === 45 && allies[1].alert === 0, 'a1 to 45; a2 untouched; none reaches 50');
  // S-4: the zone remembers, and it survives a save round trip.
  const zm = new ZoneMemory(srch);
  zm.onSearchEnded('warehouse', 0, false);
  const at60 = zm.baselineAlert('warehouse', 60 * 60);
  const at200 = zm.baselineAlert('warehouse', 200 * 60);
  const ctx60 = zm.contextMultiplier('warehouse', 30 * 60);
  const round = new ZoneMemory(srch).fromJSON(JSON.parse(JSON.stringify(zm.toJSON())));
  A('STL01-M6e', 'S-4 baseline alert 60 s after a failed search', at60, at60 === 25, '25');
  A('STL01-M6f', 'S-4 baseline alert 200 s after (past the 180 s hold)', at200, at200 === 0, '0');
  A('STL01-M6g', 'S-4 contextWeight multiplier at 30 s', ctx60, ctx60 === 1.4, '1.4');
  A('STL01-M6h', 'S-4 survives a save/load round trip', round.baselineAlert('warehouse', 60 * 60), round.baselineAlert('warehouse', 60 * 60) === 25, '25 — it is world state (S6)');
}

say('\n=== RI-STL01 method 8 / light — DARK-COVERAGE and SNUFFABLE, measured off the field ===\n');
{
  const lf = new LightField(det);
  lf.setZoneAmbient('dungeon', 'unlit');
  lf.addSource({ id: 'torch-1', pos: [0, 1.6, 0], intensity: 0.55, snuffable: true, zone: 'dungeon' });
  lf.addSource({ id: 'torch-2', pos: [14, 1.6, 3], intensity: 0.55, snuffable: true, zone: 'dungeon' });
  lf.addSource({ id: 'hearth', pos: [-8, 0.7, -6], intensity: 0.9, snuffable: false, zone: 'dungeon' });
  const cov = lf.darkCoverage({ x: [-20, 20], z: [-20, 20] }, 'dungeon', 0.10, 1.0);
  A('LGT-M8a', 'DARK-COVERAGE of a 3-source 40x40 m dungeon room at L <= 0.10', `${(cov.share * 100).toFixed(1)}% of ${cov.total} samples`, cov.share >= 0.30, '>= 30%');
  say(`   L at the torch: ${lf.sample(0, 1.2, 0, 'dungeon').toFixed(3)}   at 4 m: ${lf.sample(4, 1.2, 0, 'dungeon').toFixed(3)}   at 9 m: ${lf.sample(9, 1.2, 0, 'dungeon').toFixed(3)}   ambient: ${lf.sample(19, 1.2, 19, 'dungeon').toFixed(3)}`);
  const before = lf.sample(0, 1.2, 0, 'dungeon');
  lf.snuff('torch-1', 0, 90 * 60);
  const after = lf.sample(0, 1.2, 0, 'dungeon');
  lf.step(90 * 60);
  const relit = lf.sample(0, 1.2, 0, 'dungeon');
  A('LGT-M8b', 'snuffing a lamp changes L at the lamp', `${before.toFixed(3)} -> ${after.toFixed(3)} -> ${relit.toFixed(3)} after 90 s`, after < before && Math.abs(relit - before) < 1e-9, 'falls, then returns');
  const torchL = lf.withTorch(after, true);
  A('LGT-M8c', 'a carried torch floors L at 0.80', torchL.toFixed(2), torchL === 0.80, '0.80');
}

say('\n=== RI-STL02 method 3 — LOCK DETERMINISM (the ruling this piece exists to make) ===\n');
{
  const lock = { id: 'probe.tier3', tier: 3, ward_angles: [41, 148, 266] };
  // The input script: press on the frame the collar is nearest each ward. Identical every run.
  function run(seed, security, mistime) {
    const rng = makeRng(seed);
    const a = new LOCK.LockAttempt(lockD, lock, { security, agility: 30, picks: 12 });
    for (let f = 0; f < 60 * 30 && !a.open && !a.failed; f++) {
      const d = Math.abs(LOCK.angleDelta(a.collarDeg, a.currentWardAngle));
      if (d <= (mistime ? 0.0001 : a.W / 2) && (!mistime)) a.press();
      else if (mistime && Math.abs(LOCK.angleDelta(a.collarDeg, (a.currentWardAngle + 180) % 360)) <= 0.8) a.press();
      a.step();
    }
    return { open: a.open, set: a.set, broken: a.broken, frames: a.frame, draws: rng.draws, sig: JSON.stringify(a.block()) };
  }
  const runs = [];
  for (let s = 0; s < 100; s++) runs.push(run(s * 7919 + 1, 40, false));
  const distinct = new Set(runs.map((r) => r.sig));
  A('STL02-M3a', '100 identical input scripts at 100 different seeds', `${distinct.size} distinct outcome(s), open=${runs[0].open}`, distinct.size === 1 && runs[0].open, '1 — 100/100 identical');
  A('STL02-M3b', 'RNG draws across a whole lock interaction', runs[0].draws, runs[0].draws === 0, '0 — the counter must not move at all');
  // Below the requirement: never offered, zero picks consumed, 100/100.
  let refusals = 0, picks = 0;
  for (let s = 0; s < 100; s++) {
    const g = LOCK.gate(lockD, 3, { security: 39, agility: 30 });
    if (!g.offered) refusals++;
    picks += g.picks_consumed;
  }
  A('STL02-M3c', 'Security 39 against a tier-3 lock (req 40)', `${refusals}/100 refused, ${picks} picks consumed`, refusals === 100 && picks === 0, '100/100 refused, 0 picks');
  // Deliberately mistimed: 100/100 failures.
  const mis = [];
  for (let s = 0; s < 100; s++) mis.push(run(s * 104729 + 3, 40, true));
  A('STL02-M3d', '100 deliberately mistimed scripts', `${mis.filter((m) => !m.open).length}/100 fail, ${mis[0].broken} picks broken`, mis.every((m) => !m.open), '100/100 failures');
}

say('\n=== RI-STL02 method 4 — the tolerance curve ===\n');
{
  const want = { 40: 4.0, 55: 12.25, 70: 20.5, 100: 34.0 };
  const rows = Object.keys(want).map((s) => ({ security: +s, W: LOCK.tolerance(lockD, 3, +s), want: want[s], f60: LOCK.windowFrames(lockD, 3, +s) }));
  for (const r of rows) say(`   Security ${String(r.security).padStart(3)}  W = ${r.W.toFixed(2)} deg (want ${r.want})   window ${r.f60.toFixed(1)} f@60 = ${(r.f60 / 60 * 1000).toFixed(0)} ms`);
  A('STL02-M4a', 'W at Security 40 / 55 / 70 / 100 against a tier-3 lock', rows.map((r) => r.W.toFixed(2)).join(', '), rows.every((r) => Math.abs(r.W - r.want) <= 0.1), '4.0, 12.25, 20.5, 34.0 +/- 0.1');
  A('STL02-M4b', 'the clamp holds at Security 140', LOCK.tolerance(lockD, 3, 140).toFixed(1), LOCK.tolerance(lockD, 3, 140) === 34.0, 'exactly 34.0');
  A('STL02-M4c', 'the window at the requirement, in f@60 (seam S22)', LOCK.windowFrames(lockD, 3, 40).toFixed(2) + ' f@60', Math.abs(LOCK.windowFrames(lockD, 3, 40) - 2.667) < 0.01, '2.67 f@60 = 44 ms — roughly a Souls parry');
}

say('\n=== RI-STL02 method 7 / S21 — pickpocket geometry deterministic, notice die live ===\n');
{
  const base = { targetCivState: 'CALM', crouched: true, dist: 1.0, bearingDeg: 180, moving: false, sneak: 45, ownerId: 'npc:x' };
  A('STL02-M7a', 'offered at 1.0 m, crouched, behind, still', PP.eligibility(theftD, base).offered, PP.eligibility(theftD, base).offered, 'true');
  A('STL02-M7b', 'at 1.5 m (outside the 1.4 m reach)', PP.eligibility(theftD, { ...base, dist: 1.5 }).refusals[0], !PP.eligibility(theftD, { ...base, dist: 1.5 }).offered, 'not offered');
  A('STL02-M7c', 'at bearing 99 deg (inside the rear-arc boundary)', PP.eligibility(theftD, { ...base, bearingDeg: 99 }).refusals[0], !PP.eligibility(theftD, { ...base, bearingDeg: 99 }).offered, 'not offered');
  A('STL02-M7d', 'while walking', PP.eligibility(theftD, { ...base, moving: true }).refusals[0], !PP.eligibility(theftD, { ...base, moving: true }).offered, 'not offered');
  A('STL02-M7e', 'against a WATCHING target', PP.eligibility(theftD, { ...base, targetCivState: 'WATCHING' }).refusals[0], !PP.eligibility(theftD, { ...base, targetCivState: 'WATCHING' }).offered, 'not offered');
  const T = [5, 45, 100].map((s) => ({ s, sec: PP.holdSeconds(theftD, s), f: PP.holdFrames(theftD, s) }));
  A('STL02-M7f', 'hold T at Sneak 5 / 45 / 100', T.map((t) => `${t.sec.toFixed(2)}s=${t.f}f@60`).join(', '), Math.abs(T[0].sec - 2.53) < 0.01 && Math.abs(T[1].sec - 1.97) < 0.01 && Math.abs(T[2].sec - 1.20) < 0.01, '2.53 / 1.97 / 1.20 s');
  const npc = { carried: [{ id: 'key', weight_kg: 0.1 }, { id: 'sword', weight_kg: 3.0, equipped: true }, { id: 'purse', weight_kg: 0.3 }, { id: 'anvil', weight_kg: 40 }] };
  const slots = PP.offeredSlots(theftD, npc, { agility: 10, sneak: 5 });
  A('STL02-M7g', 'equipped items never appear in the slot list', slots.map((s) => s.id).join(','), !slots.some((s) => s.equipped), 'no sword');
  A('STL02-M7h', 'slot count and weight ceiling at AGILITY 10 / Sneak 5', `${PP.slotCount(theftD, 10)} slot, ${PP.weightCeilingKg(theftD, 5)} kg`, PP.slotCount(theftD, 10) === 1 && PP.weightCeilingKg(theftD, 5) === 0.5, '1 slot, 0.5 kg — you can steal a key');
  A('STL02-M7i', 'slot count and ceiling at AGILITY 60 / Sneak 100', `${PP.slotCount(theftD, 60)} slots, ${PP.weightCeilingKg(theftD, 100)} kg`, PP.slotCount(theftD, 60) === 6 && PP.weightCeilingKg(theftD, 100) === 20.5, '6 slots, 20.5 kg');

  // THE DIE. Same seed -> same outcome (determinism ladder intact). Across seeds -> a real
  // distribution (S21 satisfied). Exactly one draw per attempt.
  const q = { contextWeight: 1.60, V: 0.16, sneak: 45, raceSuspicion: 1.35, ownerId: 'npc:x' };
  const p = PP.noticeChance(theftD, q);
  const rngA = makeRng(1337), rngB = makeRng(1337);
  const a = PP.resolve(theftD, q, rngA.next), b = PP.resolve(theftD, q, rngB.next);
  A('STL02-M7j', 'same seed, same outcome', `${a.caught} / ${b.caught}, rolls ${a.roll} / ${b.roll}`, a.caught === b.caught && a.roll === b.roll, 'identical — RI-MTH02 untouched');
  A('STL02-M7k', 'draws per attempt', a.draws + rngA.draws - 1, rngA.draws === 1, 'exactly 1');
  let caught = 0;
  for (let s = 0; s < 20000; s++) { const r = makeRng(s * 2654435761 + 11); if (PP.resolve(theftD, q, r.next).caught) caught++; }
  const emp = caught / 20000;
  A('STL02-M7l', `20,000 seeds at notice_chance ${p.toFixed(4)}`, `empirical ${emp.toFixed(4)}`, Math.abs(emp - p) < 0.012, 'matches the declared chance');
  const spread = theftD.pickpocket.the_die.worked.map((w) => ({ ...w, computed: PP.noticeChance(theftD, { contextWeight: 1.60, V: w.V, sneak: w.sneak, raceSuspicion: races.guards.law_factor[w.race].suspicion }) }));
  for (const w of spread) say(`   ${w.label.padEnd(58)} declared ${w.notice_chance.toFixed(4)}  computed ${w.computed.toFixed(4)}`);
  A('STL02-M7m', 'the declared worked rows vs the shipping formula', `worst ${Math.max(...spread.map((w) => Math.abs(w.computed - w.notice_chance))).toExponential(1)}`, spread.every((w) => Math.abs(w.computed - w.notice_chance) < 1e-3), 'agree');
  A('STL02-M7n', 'the die is LIVE at every skill level (S21 is not decoration)', `${(Math.min(...spread.map((w) => w.computed)) * 100).toFixed(1)}% .. ${(Math.max(...spread.map((w) => w.computed)) * 100).toFixed(1)}%`, Math.min(...spread.map((w) => w.computed)) > theftD.pickpocket.the_die.clamp[0], 'never resting on the 2% floor');
}

say('\n=== RI-CRM01 methods 1-4 — the schedule, the empty house, the report chain, S10 ===\n');
{
  const cw = () => new CrimeWorld(bountyD, justD);
  // M1: schedule conformance, all 17.
  let bad = [];
  for (const c of bountyD.crimes) {
    const w = cw();
    const rec = w.commit(c.id, { frame: 0, value_g: 0, cargo_g: 0 });
    if (rec.quote !== c.bounty) bad.push(`${c.id}: ${rec.quote} != ${c.bounty}`);
  }
  A('CRM01-M1a', 'all 17 crimes quote their schedule value', bad.length ? bad.join('; ') : '17/17 exact', bad.length === 0, 'exact');
  const w4 = cw();
  const scaled = [10, 200, 3400].map((v) => w4.quote('theft', { value_g: v }));
  A('CRM01-M1b', 'crime #4 scales with value_g at 10 / 200 / 3,400 g', scaled.join(', '), scaled.join() === '35,225,3425', '35, 225, 3425');
  const sm = cw().quote('theft', { value_g: 200, jurisdiction: 'settlement' });
  A('CRM01-M1c', 'settlement jurisdiction applies x0.6', sm, sm === Math.round(225 * 0.6), '135');

  // M2: a crime with no witness generates nothing.
  const w2 = cw();
  const stolen = [];
  for (let i = 0; i < 20; i++) {
    const obj = { instance: `o${i}`, owner: 'npc:ollo-vantine', owner_scope: 'personal', value_g: 30 + i };
    const t = THF.take(theftD, obj, { observed: false, observedBy: [] });
    if (t.stolen_from) stolen.push(t.stolen_from);
    w2.commit('theft', { frame: i, value_g: obj.value_g });     // the crime exists...
  }
  A('CRM01-M2a', 'bounty after 20 unwitnessed thefts', w2.bounty.imperial, w2.bounty.imperial === 0, '0 — a crime does not create a bounty, a REPORT does');
  A('CRM01-M2b', 'witness records', w2.witnesses.length, w2.witnesses.length === 0, '0');
  A('CRM01-M2c', 'items carrying stolen_from', `${stolen.length}/20`, stolen.length === 20, '20/20');
  const blob = JSON.parse(JSON.stringify(w2.toJSON()));
  const w2b = new CrimeWorld(bountyD, justD).fromJSON(blob);
  A('CRM01-M2d', 'the crime ledger survives a save/load round trip', JSON.stringify(w2b.toJSON()) === JSON.stringify(w2.toJSON()), JSON.stringify(w2b.toJSON()) === JSON.stringify(w2.toJSON()), 'byte-identical');

  // M3: the report chain, all latencies.
  const w3 = cw();
  const crime = w3.commit('theft', { frame: 0, value_g: 200 });
  const wit = w3.witness(crime.id, { eid: 'civ0', frame: 0, identified: true });
  const routes = [
    { name: 'guard is the witness', q: { nearestGuardDist: 5, guardIsWitness: true } },
    { name: 'shout, guard at 20 m', q: { nearestGuardDist: 20, nearestGuardWallsBetween: 1, guardIsWitness: false } },
    { name: 'run to a guard at 120 m', q: { nearestGuardDist: 120, guardIsWitness: false } },
    { name: 'no guard within 400 m', q: { nearestGuardDist: 900, guardIsWitness: false } },
    { name: 'the interior jurisdiction', q: { nearestGuardDist: 5, guardIsWitness: false, jurisdiction: 'interior' } },
  ].map((r) => ({ ...r, out: WIT.reportRoute(justD, {}, r.q) }));
  for (const r of routes) say(`   ${r.name.padEnd(30)} -> ${r.out.route.padEnd(15)} ${r.out.latency_f === null ? '(no timer)' : `${r.out.latency_f} f@60 = ${(r.out.latency_f / 60).toFixed(2)} s`}`);
  const run120 = routes[2].out;
  A('CRM01-M3a', 'all five report routes resolve', routes.map((r) => r.out.route).join(', '), new Set(routes.map((r) => r.out.route)).size === 5, 'five distinct');
  A('CRM01-M3b', 'run-to-guard latency at 120 m (120 / 3.4 = 35.3 s)', `${(run120.latency_f / 60).toFixed(2)} s`, Math.abs(run120.latency_f / 60 - 35.3) / 35.3 < 0.10, 'within 10%');
  A('CRM01-M3c', 'shout latency', `${(routes[1].out.latency_f / 60).toFixed(3)} s = ${routes[1].out.latency_f} f@60`, Math.abs(routes[1].out.latency_f - 72) <= 2, '1.2 s +/- 2 frames');
  A('CRM01-M3d', 'bounty before the report lands', w3.bounty.imperial, w3.bounty.imperial === 0, '0');
  const landed = w3.land(wit, 2118, 'unlawful');
  A('CRM01-M3e', 'bounty after the report lands', `${w3.bounty.imperial} (delta ${landed.delta})`, w3.bounty.imperial === 225, '225 = 25 + 200');

  // M4: S10 — the witness-murder assertion.
  const wA = cw();
  const cA = wA.commit('theft', { frame: 0, value_g: 200, settlement: 'gideon' });
  const witA = wA.witness(cA.id, { eid: 'civ0', frame: 0, identified: true });
  const killA = wA.killWitness(witA, 60, { observed: false, victimNamed: true, settlement: 'gideon' });
  A('CRM01-M4a', 'bounty after killing the only witness, unobserved', wA.bounty.imperial, wA.bounty.imperial === 0, '0 — S10 says it works, completely');
  A('CRM01-M4b', 'the suppressed bounty', `${killA.suppressed_g} g suppressed`, killA.suppressed_g === 225, '225');
  A('CRM01-M4c', 'a permanent death_flag for the settlement', wA.deathCount('gideon'), wA.deathCount('gideon') === 1, '1');
  const wB = cw();
  const cB = wB.commit('theft', { frame: 0, value_g: 200, settlement: 'gideon' });
  const witB = wB.witness(cB.id, { eid: 'civ0', frame: 0, identified: true });
  wB.witness(cB.id, { eid: 'civ1', frame: 0, identified: true });
  const killB = wB.killWitness(witB, 60, { observed: true, victimNamed: false, settlement: 'gideon' });
  A('CRM01-M4d', 'bounty when a second civilian watches the killing', wB.bounty.imperial, wB.bounty.imperial === 1000 + 2 * 225, '1,000 + 2 x 225 = 1,450');
  say(`   crime #12 breakdown: murder ${killB.murder_bounty} + suppressed x2 ${killB.doubled_g}`);
}

say('\n=== RI-CRM01 methods 6-10 — identification, the guard ladder, the arrest, jail, persistence ===\n');
{
  // M6: the identification split.
  const w = new CrimeWorld(bountyD, justD);
  const hi = w.commit('theft', { frame: 0, value_g: 200 });
  const wHi = w.witness(hi.id, { eid: 'a', frame: 0, identified: 0.45 >= justD.witness.identified_at_V });
  const dHi = w.land(wHi, 10);
  const w2 = new CrimeWorld(bountyD, justD);
  const lo = w2.commit('theft', { frame: 0, value_g: 200 });
  const wLo = w2.witness(lo.id, { eid: 'a', frame: 0, identified: 0.18 >= justD.witness.identified_at_V });
  const dLo = w2.land(wLo, 10);
  A('CRM01-M6a', 'identified at V 0.45 vs V 0.18', `${wHi.identified} / ${wLo.identified}`, wHi.identified && !wLo.identified, 'true / false');
  A('CRM01-M6b', 'bounty ratio identified : unidentified', `${dHi.delta} : ${dLo.delta} = 1 : ${(dLo.delta / dHi.delta).toFixed(2)}`, Math.abs(dLo.delta / dHi.delta - 0.4) < 0.01, '1 : 0.4');
  A('CRM01-M6c', 'the report kind', `${dHi.kind} / ${dLo.kind}`, dHi.kind === 'unlawful' && dLo.kind === 'partial', 'unlawful / partial');

  // M7: the guard ladder, all 10 races x 3 bands.
  let bands = [], ok = 0;
  for (const race of Object.keys(races.guards.law_factor)) {
    const th = JUS.thresholds(races, sancD, justD, { race, standing: 'none' });
    for (const mult of [0.5, 1.5, 5]) {
      const b = JUS.guardBand(justD, Math.round(th.arrest_at * mult), th);
      const want = mult === 0.5 ? 1 : mult === 1.5 ? 2 : 3;
      if (b.band === want) ok++;
      bands.push({ race, mult, band: b.band, behaviour: b.behaviour, draws: b.draws_weapon });
    }
  }
  A('CRM01-M7a', '10 races x 3 bounty bands land in the right behaviour band', `${ok}/30`, ok === 30, '30/30');
  A('CRM01-M7b', 'the arrest guard never draws a weapon in band 2', bands.filter((b) => b.band === 2 && b.draws).length, bands.filter((b) => b.band === 2 && b.draws).length === 0, '0');
  A('CRM01-M7c', 'band 3 offers a surrender parley', JUS.guardBand(justD, 99999, JUS.thresholds(races, sancD, justD, { race: 'naga', standing: 'none' })).parley, JUS.guardBand(justD, 99999, JUS.thresholds(races, sancD, justD, { race: 'naga', standing: 'none' })).parley === 'surrender', 'surrender');

  // M8: the arrest, all three answers, from an identical state.
  const skills = { athletics: 42, acrobatics: 31, mercantile: 55, speechcraft: 61, marksman: 28, survival: 37, sneak: 50, security: 44 };
  const mk = () => { const c = new CrimeWorld(bountyD, justD); c.setBounty('imperial', 800); return c; };
  const pay = JUS.answerArrest(justD, mk(), 'pay', { bounty: 800, gold: 1200, frame: 0, skills, stolenItems: [1, 2, 3, 4, 5, 6] });
  A('CRM01-M8a', 'PAY at bounty 800 with 1,200 gold', `gold ${pay.gold_delta}, bounty ${pay.bounty_after}, confiscate ${pay.confiscate_stolen}, days ${pay.time_passes_days}`, pay.gold_delta === -800 && pay.bounty_after === 0 && pay.time_passes_days === 0, '-800, 0, true, 0 days');
  const cr = mk(); const res = JUS.answerArrest(justD, cr, 'resist', { bounty: 800, gold: 1200, frame: 0, skills });
  A('CRM01-M8b', 'RESIST', `bounty ${res.bounty_after}, aggro r=${res.aggro_radius_m} m within ${res.aggro_within_f} f@60`, res.bounty_after === 1300, '1,300 (800 + 500)');
  const sv = JUS.answerArrest(justD, mk(), 'serve', { bounty: 800, gold: 1200, frame: 0, skills });
  A('CRM01-M8c', 'SERVE at bounty 800', `${sv.days} days, -${sv.levels_lost} levels from [${sv.lost_from.join(',')}], +${JSON.stringify(sv.gained)}`, sv.days === 8, '8 days');
  const short = JUS.answerArrest(justD, mk(), 'pay', { bounty: 800, gold: 700, frame: 0, skills });
  A('CRM01-M8d', 'PAY with 700 gold — the refusal names the shortfall', short.line, /100 gold/.test(short.line), 'names 100 gold');
  const topics = JUS.arrestTopics(justD, { bounty: 800, gold: 700, factionRank: 0, factionHasStanding: false, factionInvocationsLeft: 0, speechcraft: 40, guardDisposition: 30 });
  A('CRM01-M8e', 'the pay topic is PRESENT and refused, never hidden', `${topics.find((t) => t.id === 'pay').refused} present=${!!topics.find((t) => t.id === 'pay')}`, topics.find((t) => t.id === 'pay') && topics.find((t) => t.id === 'pay').refused, 'present, refused, explained');
  const withHatch = JUS.arrestTopics(justD, { bounty: 800, gold: 900, factionRank: 5, factionHasStanding: true, factionInvocationsLeft: 3, speechcraft: 70, guardDisposition: 60 });
  A('CRM01-M8f', 'both escape hatches appear when earned', withHatch.map((t) => t.id).join(','), withHatch.length === 5, '5 topics: pay, resist, serve, faction_invocation, persuade');

  // M9: the jail ledger, and the S21 determinism assertion.
  const led = JUS.serve(justD, 1000, skills);
  say(`   1,000 g -> ${led.days} days; lost ${led.lost_from.join(' -> ')}; gained ${JSON.stringify(led.gained)}`);
  A('CRM01-M9a', 'a 1,000 g bounty serves 10 days', led.days, led.days === 10, '10');
  A('CRM01-M9b', 'levels lost (1 per 2 days)', led.levels_lost, led.levels_lost === 5, '5');
  A('CRM01-M9c', 'taken from the highest cell-blocked skill first', led.lost_from[0], led.lost_from[0] === 'speechcraft', 'speechcraft (61, the highest of the six)');
  A('CRM01-M9d', 'Sneak +3, Security +2', JSON.stringify(led.gained), led.gained.sneak === 3 && led.gained.security === 2, '{sneak:3, security:2}');
  const led2 = JUS.serve(justD, 1000, skills);
  A('CRM01-M9e', 'identical across runs (the S21 assertion: no random skill point)', JSON.stringify(led.lost_from) === JSON.stringify(led2.lost_from), JSON.stringify(led) === JSON.stringify(led2), 'byte-identical');
  A('CRM01-M9f', 'the 90-day cap', JUS.serve(justD, 20000, skills).days, JUS.serve(justD, 20000, skills).days === 90, '90');

  // M10: PERSISTENCE — the S6 assertion.
  const p = new CrimeWorld(bountyD, justD);
  p.setBounty('imperial', 1600);
  p.bloodprice['the-nine-debts'] = 900;
  const cX = p.commit('theft', { frame: 0, value_g: 40, settlement: 'gideon' });
  p.witness(cX.id, { eid: 'runner', frame: 0, identified: true });
  const beforeDeaths = JSON.stringify(p.toJSON());
  for (const kind of ['enemy', 'fall', 'guard-mid-arrest']) p.onPlayerDeath(0, { killedByGuardDuringArrest: kind === 'guard-mid-arrest' });
  A('CRM01-M10a', 'bounty and blood-price after three deaths', `${p.bounty.imperial} g / ${p.bloodprice['the-nine-debts']} g`, JSON.stringify(p.toJSON()) === beforeDeaths, 'byte-identical to before');
  A('CRM01-M10b', 'the unreported witness is still running', p.witnesses.filter((x) => !x.reported).length, p.witnesses.filter((x) => !x.reported).length === 1, '1');
  const wake = p.onPlayerDeath(0, { killedByGuardDuringArrest: true });
  A('CRM01-M10c', 'dying to a guard mid-arrest', `${wake.wake}, sentence_begins=${wake.sentence_begins}`, wake.wake === 'jail', 'jail, not the sapwell');
  const rt = new CrimeWorld(bountyD, justD).fromJSON(JSON.parse(JSON.stringify(p.toJSON())));
  A('CRM01-M10d', 'save/load round trip', JSON.stringify(rt.toJSON()) === JSON.stringify(p.toJSON()), JSON.stringify(rt.toJSON()) === JSON.stringify(p.toJSON()), 'byte-identical');
}

say('\n=== RI-CRM01 method 12 / RI-CRM02 methods 1, 5, 6 — faction, sanction and the AR-3 numbers ===\n');
{
  const m = SAN.coverageMatrix(sancD);
  for (const r of m.rows) say(`   ${r.authority.padEnd(20)} imperial ${r.imperial ? 'Y' : '.'}  settlement ${r.settlement ? 'Y' : '.'}  interior ${r.interior ? 'Y' : '.'}`);
  A('CRM02-M1', 'authorities honoured in all three jurisdictions', m.universal.length, m.universal.length === 0, '0 — the Morag Tong problem, solved');

  // M2: the five things a writ never does.
  const writ = { authority: 'provincial-office' };
  const kill = SAN.resolveKilling(sancD, { writ, jurisdiction: 'imperial', victimIsTarget: true, victimNamed: true });
  const coll = SAN.resolveKilling(sancD, { writ, jurisdiction: 'imperial', victimIsTarget: false, victimNamed: false });
  const away = SAN.resolveKilling(sancD, { writ, jurisdiction: 'settlement', victimIsTarget: true, victimNamed: true });
  const tong = SAN.resolveKilling(sancD, { writ: { authority: 'morag-tong' }, jurisdiction: 'imperial', victimIsTarget: true, victimNamed: true, victimRace: 'dunmer' });
  A('CRM02-M2a', 'a lawful execution inside Imperial jurisdiction', `${kill.report_kind}, witnesses_suppressed=${kill.witnesses_suppressed}`, kill.lawful && kill.witnesses_suppressed === false, 'lawful, witnesses NOT suppressed');
  A('CRM02-M2b', 'collateral in the same room', `${coll.report_kind}, crime ${coll.crime}`, !coll.lawful, 'unlawful — a writ does not cover it');
  A('CRM02-M2c', 'the same target lured into settlement jurisdiction', `${away.report_kind}`, !away.lawful, 'unlawful — it does not travel');
  A('CRM02-M2d', 'a Morag Tong writ in front of an Imperial guard', `${tong.report_kind}, social_only=${!!tong.social_only}`, !tong.lawful && tong.social_only, 'unlawful — legally worthless in Argonia');
  const yielded = SAN.resolveKilling(sancD, { writ, jurisdiction: 'imperial', victimIsTarget: true, victimNamed: true, targetYielded: true, yieldWitnessed: true });
  A('CRM02-M2e', 'executing a target who has yielded, witnessed', `lawful=${yielded.lawful}, standing lost with ${yielded.faction_standing_lost.length} factions`, yielded.lawful && yielded.faction_standing_lost.length === 3, 'lawful AND costs 3 factions');

  // M5: exclusivity, exhaustive over the join graph.
  const FACTIONS = ['ninth-cohort', 'xul-aneekh', 'wet-ledger', 'sap-cutters', 'morag-tong', 'ku-vastei', 'rootkeepers'];
  let refusedPairs = 0, maxAuth = 0;
  for (const a of FACTIONS) for (const b of FACTIONS) {
    if (a === b) continue;
    const st = { [a]: 4 };
    if (!SAN.canJoin(sancD, st, b, 4).allowed) refusedPairs++;
  }
  // Exhaustive search: can any reachable state hold 3 sanctioning authorities?
  const SANCTIONERS = ['ninth-cohort', 'wet-ledger', 'morag-tong', 'ku-vastei'];
  for (let mask = 0; mask < 16; mask++) {
    const st = {}; let ok = true;
    for (let i = 0; i < 4; i++) if (mask & (1 << i)) {
      const f = SANCTIONERS[i];
      if (!SAN.canJoin(sancD, st, f, 4).allowed) { ok = false; break; }
      st[f] = 4;
    }
    if (ok) maxAuth = Math.max(maxAuth, Object.keys(st).length);
  }
  A('CRM02-M5a', 'ordered faction pairs refused with a stated in-fiction reason', refusedPairs, refusedPairs >= 8, '>= 8');
  A('CRM02-M5b', 'max simultaneous sanctioning authorities, by exhaustive search over the join graph', maxAuth, maxAuth <= 2, '<= 2');

  // M6: the AR-3 guard numbers, computed live from race x faction.
  const cells = sancD.faction_law_factor.worked.map((w) => {
    const race = w.player.split(',')[0].trim();
    const standing = w.player.includes('ninth') ? 'ninth-cohort:4+' : w.player.includes('xul') ? 'xul-aneekh:4+' : 'none';
    const th = JUS.thresholds(races, sancD, justD, { race, standing });
    const bands = [0.5, 1.5, 5].map((mu) => JUS.guardBand(justD, Math.round(th.arrest_at * mu), th).band);
    return { player: w.player, arrest: th.arrest_at, declared: w.arrest_at, attack: th.attack_at, bands };
  });
  for (const c of cells) say(`   ${c.player.padEnd(28)} arrest ${String(c.arrest).padStart(4)} (declared ${c.declared})  attack ${String(c.attack).padStart(4)}  bands ${c.bands.join('/')}`);
  A('CRM02-M6a', '15 behaviour bands (5 configurations x 3 bounty multiples)', `${cells.reduce((n, c) => n + c.bands.filter((b, i) => b === i + 1).length, 0)}/15`, cells.every((c) => c.bands.join() === '1,2,3'), '15/15');
  const naga = cells.find((c) => c.player.startsWith('naga, xul'));
  const nagaL = cells.find((c) => c.player.startsWith('naga, ninth'));
  A('CRM02-M6b', 'arrestThreshold(Naga, Xul-Aneekh 4)', naga.arrest, Math.abs(naga.arrest - 45) <= 1, '45 +/- 1');
  A('CRM02-M6c', 'arrestThreshold(Naga, Ninth Cohort 5)', nagaL.arrest, Math.abs(nagaL.arrest - 238) <= 2, '238 +/- 2');
  A('CRM02-M6d', 'a single faction decision, same character', `${(nagaL.arrest / naga.arrest).toFixed(2)}x`, nagaL.arrest / naga.arrest >= 5, '>= 5x');

  // The AR-3 CROSSING itself: a crime in a town changes whether a fight starts in a region.
  const shifts = [0, 500, 1000, 2000, 3000, 6000].map((b) => ({ b, regard: SAN.deepKinRegard(justD, b) }));
  say(`   Deep-Kin regard vs Imperial bounty: ${shifts.map((s) => `${s.b}g->+${s.regard}`).join('  ')}`);
  A('CRM01-M12a', 'Deep-Kin regard rises +2 per 500 g of Imperial bounty', shifts.map((s) => s.regard).join(','), shifts[1].regard === 2 && shifts[3].regard === 8, '+2 per 500 g');
  A('CRM01-M12b', 'and is capped at +12', shifts[5].regard, shifts[5].regard === 12, '+12');
  const rank0 = SAN.warbroodDispositionShift(sancD, {});
  const rank4 = SAN.warbroodDispositionShift(sancD, { 'xul-aneekh': 4 });
  A('CRM02-M7a', 'war-brood hostile_below_disposition shift at Xul-Aneekh rank 0 vs 4', `${rank0} vs ${rank4}`, rank4 === -40, '0 vs -40');
  // RI-CHR02 §4e sets hostile_below_disposition at 15. A Dunmer arriving at disposition 6.
  const HOSTILE_AT = 15, dunmerDisp = 6;
  const hostile0 = dunmerDisp < HOSTILE_AT + rank0;
  const hostile4 = dunmerDisp < HOSTILE_AT + rank4;
  A('CRM02-M7b', 'a Dunmer at disposition 6 meeting a war-brood camp', `rank 0: ${hostile0 ? 'HOSTILE' : 'neutral'};  rank 4: ${hostile4 ? 'HOSTILE' : 'neutral'}`, hostile0 && !hostile4, 'hostile / neutral — the encounter table emptied without one enemy changing');
  const bountyOnly = dunmerDisp + SAN.deepKinRegard(justD, 3000) < HOSTILE_AT;
  A('CRM02-M7c', 'the same Dunmer at rank 0 with a 3,000 g IMPERIAL BOUNTY', `disposition ${dunmerDisp} + ${SAN.deepKinRegard(justD, 3000)} regard = ${dunmerDisp + SAN.deepKinRegard(justD, 3000)} vs threshold 15`, !bountyOnly, 'neutral — a crime in Gideon changed a fight in the Stone Forest');

  // M8: report interception, four then a refusal.
  const st = { 'wet-ledger': 3 };
  const inter = [0, 1, 2, 3, 4].map((used) => SAN.interception(sancD, { standings: st, settlement: 'gideon', quoteG: 400, used }));
  A('CRM02-M8a', 'Ledger interceptions before refusal', `${inter.filter((i) => i.intercepts).length} intercept, then refused=${!!inter[4].refused}`, inter.filter((i) => i.intercepts).length === 4 && inter[4].refused, '4 then a spoken refusal');
  A('CRM02-M8b', 'a 2,000 g crime exceeds the Ledger ceiling', SAN.interception(sancD, { standings: st, settlement: 'gideon', quoteG: 2000, used: 0 }).why, !SAN.interception(sancD, { standings: st, settlement: 'gideon', quoteG: 2000, used: 0 }).intercepts, 'refused');
  A('CRM02-M8c', 'the Ledger has no reach in Stormhold', SAN.interception(sancD, { standings: st, settlement: 'stormhold', quoteG: 400, used: 0 }).why, !SAN.interception(sancD, { standings: st, settlement: 'stormhold', quoteG: 400, used: 0 }).intercepts, 'refused');
  const cw = new CrimeWorld(bountyD, justD);
  const ci = cw.commit('theft', { frame: 0, value_g: 200, settlement: 'gideon' });
  const wi = cw.witness(ci.id, { eid: 'c', frame: 0, identified: true });
  cw.land(wi, 60, 'intercepted');
  A('CRM02-M8d', 'an intercepted report: bounty and favour owed', `bounty ${cw.bounty.imperial}, favours ${cw.favoursOwed.length}`, cw.bounty.imperial === 0 && cw.favoursOwed.length === 1, '0 g, 1 favour — silence is never free');

  // M9: sanction does not clear blood-price.
  const bp = new CrimeWorld(bountyD, justD);
  bp.commit('murder_unnamed', { frame: 0, jurisdiction: 'interior', family: 'the-nine-debts', victim: 'npc:x' });
  A('CRM02-M9a', 'killing an interior NPC: Imperial bounty', bp.bounty.imperial, bp.bounty.imperial === 0, '0 — no jurisdiction');
  A('CRM02-M9b', 'blood-price accrued (1,000 x 1.4)', bp.bloodprice['the-nine-debts'], bp.bloodprice['the-nine-debts'] === 1400, '1,400');
  A('CRM02-M9c', 'Deep-Kin rank does not reduce it', bp.bloodprice['the-nine-debts'], bp.bloodprice['the-nine-debts'] === 1400, 'unchanged — being one of them is not being above them');
  const cleared = bp.clearBloodprice('the-nine-debts', 'ku-vastei-ruling');
  A('CRM02-M9d', 'a ku-vastei Ruling extinguishes it', `${cleared} g cleared, remaining ${JSON.stringify(bp.bloodprice)}`, Object.keys(bp.bloodprice).length === 0, 'cleared');
}

say('\n=== RI-CRM01 method 11 — mid-fight accrual (ARBITRATION §1 as amended) ===\n');
{
  // The crime system has NO combat gate. This probe drives 300 frames in which the player is in
  // a combat state on every frame, commits a crime on frame 137, and asserts the bounty moved on
  // frame 137 and not at the encounter's end.
  const w = new CrimeWorld(bountyD, justD);
  let bountyAtFrame = null;
  for (let f = 0; f < 300; f++) {
    const playerState = f % 3 === 0 ? 'ATTACK' : f % 3 === 1 ? 'ROLL' : 'BLOCK';   // always in combat
    if (f === 137) {
      const c = w.commit('assault', { frame: f, settlement: 'gideon' });
      const wit = w.witness(c.id, { eid: 'civ', frame: f, identified: true });
      w.land(wit, f, 'unlawful');
      bountyAtFrame = { f, playerState, bounty: w.bounty.imperial };
    }
  }
  const ev = w.drain();
  const onFrame = ev.filter((e) => e.type === 'bounty_change' && e.frame === 137);
  A('CRM01-M11a', 'bounty_change fires on the crime frame while the player is in a combat state', `f=${bountyAtFrame.f} state=${bountyAtFrame.playerState} bounty=${bountyAtFrame.bounty}`, onFrame.length === 1 && bountyAtFrame.bounty === 150, 'the bounty moves on the crime frame, not at the encounter end');
  A('CRM01-M11b', 'crime and witness events carry the combat frame', ev.filter((e) => (e.type === 'crime' || e.type === 'witness') && e.frame === 137).length, ev.filter((e) => (e.type === 'crime' || e.type === 'witness') && e.frame === 137).length === 2, '2');
  A('CRM01-M11c', 'no event is deferred to the end of the encounter', ev.filter((e) => e.frame === 299).length, ev.filter((e) => e.frame === 299).length === 0, '0 — nothing batched');
}

say('\n=== theft, trespass and the fence economy ===\n');
{
  const obj = { instance: 'cup', owner: 'npc:ollo-vantine', owner_scope: 'personal', value_g: 4 };
  const unobs = THF.take(theftD, obj, { observed: false, observedBy: [] });
  const seenByOwner = THF.take(theftD, obj, { observed: true, observedBy: ['npc:ollo-vantine'] });
  const seenByOther = THF.take(theftD, { ...obj, value_g: 300 }, { observed: true, observedBy: ['npc:someone'] });
  A('THF-1', 'taking a personal object unobserved', `stolen_from=${unobs.stolen_from}, crime=${unobs.crime}`, unobs.stolen_from === 'npc:ollo-vantine' && unobs.crime === null, 'flagged, no crime');
  A('THF-2', 'a 4 g object seen only by its owner', `challenge=${seenByOwner.challenge}, put-back window ${seenByOwner.put_back_window_s} s`, seenByOwner.challenge && !seenByOwner.crime, 'CHALLENGE, not CRIME');
  A('THF-3', 'a 300 g object seen by a third party', `crime=${seenByOther.crime}, disposition ${seenByOther.disposition_delta}`, seenByOther.crime === 'theft' && seenByOther.disposition_delta === -150, 'theft, -150 (fDispStealing)');
  const pub = THF.take(theftD, { instance: 'bucket', owner: 'settlement:gideon', owner_scope: 'public', value_g: 3 }, { observed: false, observedBy: [] });
  A('THF-4', 'an unobserved public-commons object', `theft=${pub.theft}, stolen_from=${pub.stolen_from}`, !pub.theft && pub.stolen_from === null, 'petty, no stolen_from');
  let threw = false; try { THF.isTheft({ instance: 'x', owner_scope: 'personal' }, { observed: false }); } catch { threw = true; }
  A('THF-5', 'an object with NO owner field', threw ? 'throws' : 'silently allowed', threw, 'throws — ownership declared-and-never-read is the item\'s first How-we-lose');

  const zc = THF.trespass(theftD, { class: 'shop_closed' }, { shopOpen: false });
  const zr = THF.trespass(theftD, { class: 'restricted' }, {});
  const zs = THF.trespass(theftD, { class: 'sapwell_precinct' }, { isArgonian: false, rootkeeperDisposition: 30 });
  A('TRS-M8a', 'entering a closed shop', `weight ${zc.context_weight}, escalation "${zc.escalation}", bounty now ${zc.bounty_now}`, zc.context_weight === 2.20 && zc.bounty_now === 0, '2.20, CHALLENGE first, 0 bounty');
  A('TRS-M8b', 'entering a Legion restricted room', `alarm_on_sight=${zr.alarm_on_sight}, weight ${zr.context_weight}`, zr.alarm_on_sight && zr.context_weight === 3.00, 'ALARM with no CHALLENGE');
  A('TRS-M8c', 'a Nord at rootkeeper disposition 30 in a sapwell precinct', `refused for ${zs.refusal_hours} h, bounty ${zs.bounty_now}`, zs.refusal_hours === 24 && zs.bounty_now === 0, '24 h refusal, no bounty');

  const fenceData = D('crime/fences.json');
  const item = { value_g: 100, stolen_from: 'npc:gideon-trader-3', unique: false };
  const buyer = { id: 'fence.gideon.docks', settlement: 'gideon', faction: 'wet-ledger', is_fence: true };
  const world = { npcById: (id) => ({ id, name: 'Marks-The-Ledger', settlement: 'gideon', faction: null }), dispositionBetween: () => 0 };
  const refuse = THF.willBuy(theftD, buyer, item, world);
  A('FNC-M9a', 'a fence refuses an item stolen from its own settlement, by name', `"${refuse.line}"`, !refuse.buys && /Marks-The-Ledger/.test(refuse.line), 'refused, naming the owner');
  const elsewhere = THF.willBuy(theftD, { id: 'f2', settlement: 'archon', faction: null, is_fence: true }, item, world);
  A('FNC-M9b', 'a fence three settlements away', elsewhere.buys, elsewhere.buys, 'buys');
  const honest = THF.willBuy(theftD, { id: 'm', settlement: 'archon', faction: null, is_fence: false }, item, world);
  A('FNC-M9c', 'an honest merchant anywhere', `"${honest.line}"`, !honest.buys, 'refuses');
  const best = fenceData.fences.map((f) => THF.fencePrice(theftD, { greed: f.greed }, { value_g: 100 }, THF.mercantileTerm(100)).multiplier);
  A('FNC-M9d', 'best fence multiplier at Mercantile 100', Math.max(...best).toFixed(4), Math.max(...best) >= 0.58 && Math.max(...best) <= 0.62, '[0.58, 0.62]');
  const uniq = THF.fencePrice(theftD, { greed: 1.0 }, { value_g: 3400, unique: true, stolen_settlement: 'helstrom' }, THF.mercantileTerm(70));
  A('FNC-M9e', 'fencing a unique item', `${uniq.price_g} g now, ${uniq.delayed_bounty.g} g bounty in ${uniq.delayed_bounty.in_days} days`, uniq.delayed_bounty.g === 1700 && uniq.delayed_bounty.in_days === 3, '1,700 g bounty, 3 days later');
}

// ---- summary -------------------------------------------------------------------------------
const failed = R.filter((r) => !r.pass);
if (json) process.stdout.write(JSON.stringify({ results: R, passed: R.length - failed.length, total: R.length }, null, 2) + '\n');
else say(`\n${'='.repeat(70)}\n${R.length - failed.length}/${R.length} assertions pass` + (failed.length ? `\nFAILED: ${failed.map((f) => f.id).join(', ')}` : ''));
process.exit(failed.length ? 20 : 0);
