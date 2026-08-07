#!/usr/bin/env node
// tools/wpn-tipspeed-s36.mjs — the instrument for ARBITRATION seam ruling S36.
//
// S36 settles RI-WPN02 §B (which owns a weapon's arc and reach) against RI-WPN05 §E.2 (which
// caps how fast a weapon tip may travel). Tip speed is not an independent quantity: a tip sweeps
// `arc_sweep_deg` at radius `reach_m` in `active_f` frames and there is no fourth thing to tune,
//
//     peak_tip_speed = K · arc_rad · reach_m · 60 / active_f          K = 1.5, the exact maximum
//                                                                     derivative of the smoothstep
//                                                                     the clip generator uses
//
// so a ceiling on the speed is a ceiling on the arc wearing a disguise. S36 rules that RI-WPN02 §B
// governs the geometry and RI-WPN05 §E.2's tip-speed ceiling yields, re-derived per slot:
//
//     ceiling(slot) = max( 1.25 × tier_band_top ,  1.25 × K · arc_rad · reach_m · 60 / active_f_max )
//     active_f_max  = floor( 0.16/0.84 × (startup_f + recovery_f) )      ← RI-WPN02 §B, active/total ≤ 0.16
//
// Read in words: a slot is allowed a quarter more tip speed than the slowest rendering of its OWN
// declared geometry that RI-WPN02 §B permits, and never less than the tier band already allowed it.
// §E.2 keeps every metre per second it can justify and loses only the ones it was borrowing from a
// table it does not own. See ARBITRATION.md §2 S36 for the reasoning and for what it does not decide.
//
// USAGE
//   node tools/wpn-tipspeed-s36.mjs                 report; exit 0
//   node tools/wpn-tipspeed-s36.mjs --gate          report; exit 1 if any slot fails S36
//   node tools/wpn-tipspeed-s36.mjs --json <path>   also write the machine-readable census
//   node tools/wpn-tipspeed-s36.mjs --control=pre-s36    the arm S36 replaces: §E.2 as written
//   node tools/wpn-tipspeed-s36.mjs --control=halve-active   perturbation: the instrument must go red
//
// RULES.md 4 — this tool is required to be able to fail, and the two control arms prove it does.
// `--control=pre-s36` must report MORE failures and a NON-EMPTY unsatisfiable set; `--control=halve-active`
// doubles every implied speed and must report far more failures than the shipped arm. A run in which
// the controls do not come out worse means the instrument is not reading the data.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = p => path.join(ROOT, p);
const MOVESETS = R('game/data/combat/movesets');

// ---- the constants, each with the item that publishes it ------------------------------------
const K = 1.5;                                        // smoothstep peak, as build-movesets.mjs
const ACTIVE_FRACTION_MAX = 0.16;                     // RI-WPN02 §B derived constraints, `active / total`
// RI-WPN05 §E "Peak tip speed (m/s)" band ceilings. §E publishes FOUR rows and no `ranged` row;
// the absence is deliberate here and is reported, not papered over — see S36's "does not decide".
const BAND_TOP = { light: 20, medium: 26, heavy: 32, ultra: 40 };
const E2_SLACK = 1.25;                                // RI-WPN05 §E.2, "≤ 1.25 × the tier's §E peak band ceiling"
// RI-WPN02 M5 shape census. Only the four bands M5 actually states; a shape M5 does not name has
// no bound here, and inventing one would be this tool legislating rather than measuring.
const M5_BAND = {
  spin: [300, 360], sweep: [90, 200], slash_h: [90, 200],
  thrust: [0, 20], smash: [0, 130], slash_v: [0, 130],
};

const impliedTipSpeed = (arcDeg, reachM, activeF) =>
  !(activeF > 0) || !(arcDeg > 0) ? 0 : K * (Math.abs(arcDeg) * Math.PI / 180) * reachM * 60 / activeF;

const activeFrameMax = (startupF, recoveryF) =>
  Math.floor((ACTIVE_FRACTION_MAX / (1 - ACTIVE_FRACTION_MAX)) * (startupF + recoveryF));

// ---- load ------------------------------------------------------------------------------------
function loadSlots() {
  if (!fs.existsSync(MOVESETS)) {
    console.error(`FATAL: ${path.relative(ROOT, MOVESETS)} does not exist. There is no roster to measure.`);
    process.exit(2);
  }
  const files = fs.readdirSync(MOVESETS).filter(f => f.endsWith('.json'));
  if (!files.length) {
    console.error(`FATAL: ${path.relative(ROOT, MOVESETS)} holds no movesets. Nothing to measure — this tool reports absence rather than passing over it (RULES.md 24).`);
    process.exit(2);
  }
  const slots = [];
  for (const f of files) {
    const m = JSON.parse(fs.readFileSync(path.join(MOVESETS, f), 'utf8'));
    for (const [id, s] of Object.entries(m.slots || {})) {
      slots.push({
        weapon: m.weapon_id, class: m.class, tier: m.weight_tier, slot: id,
        shape: s.shape, arc_deg: s.arc_sweep_deg, reach_m: m.reach_m,
        startup_f: s.startup_f, active_f: s.active_f, recovery_f: s.recovery_f,
        baseline: m.baseline_ref === null,
        stamp: s.peak_tip_speed_mps_implied,
      });
    }
  }
  return slots;
}

// ---- the S36 test ------------------------------------------------------------------------------
function judge(slots, { mode = 's36', halveActive = false } = {}) {
  const rows = [];
  for (const s of slots) {
    const activeF = halveActive ? Math.max(1, Math.floor(s.active_f / 2)) : s.active_f;
    const bandTop = BAND_TOP[s.tier];
    const implied = impliedTipSpeed(s.arc_deg, s.reach_m, activeF);
    const aMax = Math.max(activeF, activeFrameMax(s.startup_f, s.recovery_f));

    // No §E row for this tier — S36 explicitly declines to invent one.
    if (bandTop === undefined) {
      rows.push({ ...s, active_f: activeF, implied, verdict: 'UNCEILED', ceiling: null });
      continue;
    }

    const tierCeiling = E2_SLACK * bandTop;                                  // RI-WPN05 §E.2 as written
    const forced = impliedTipSpeed(s.arc_deg, s.reach_m, aMax);              // what §B's geometry compels
    const ceiling = mode === 'pre-s36' ? tierCeiling : Math.max(tierCeiling, E2_SLACK * forced);

    // Can ANY legal tuning satisfy this ceiling? Hold the slot's DECLARED arc — RI-WPN02 §B owns it
    // and S36 hands it the geometry — and take the longest active window §B permits. If that is still
    // over, the slot is stranded, which is the state S36 exists to abolish. Under the shipped arm this
    // set must be EMPTY by construction; under `--control=pre-s36` it is not, and that difference is
    // the whole content of the ruling.
    const bestLegal = impliedTipSpeed(s.arc_deg, s.reach_m, aMax);
    const stranded = implied > ceiling && bestLegal > ceiling;

    // Separately, and NOT folded into the S36 verdict: is the declared arc outside the band RI-WPN02
    // M5 gives its declared shape? That is a mislabelling defect, it is judged under M5 as a defect
    // (S26's principle), and S36 explicitly declines to excuse or to punish it here.
    const band = M5_BAND[s.shape];
    const m5Offband = !!band && (s.arc_deg < band[0] || s.arc_deg > band[1]);

    // The remedy S36 leaves open: lengthen the active window.
    const activeNeeded = implied > ceiling
      ? Math.ceil(K * (Math.abs(s.arc_deg) * Math.PI / 180) * s.reach_m * 60 / ceiling) : null;

    rows.push({
      ...s, active_f: activeF, implied, ceiling, forced, active_f_max: aMax,
      over: implied / ceiling, stranded, active_f_needed: activeNeeded, m5_offband: m5Offband,
      verdict: implied > ceiling ? (stranded ? 'STRANDED' : 'FAIL') : 'PASS',
    });
  }
  return rows;
}

// ---- the stamp audit (S36 requires the shipped indictment to match the shipped arc) -------------
function auditStamps(rows) {
  let carried = 0, stale = 0, missing = 0;
  for (const r of rows) {
    const over = r.verdict === 'FAIL' || r.verdict === 'STRANDED';
    if (r.stamp !== undefined) {
      carried++;
      if (Math.abs(r.implied - r.stamp) > 0.06) stale++;
    } else if (over) missing++;
  }
  return { carried, stale, missing };
}

// ---- report ------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = k => { const a = argv.find(x => x.startsWith(`${k}=`)); return a ? a.split('=').slice(1).join('=') : null; };
const gate = argv.includes('--gate');
const jsonAt = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : null;
const control = arg('--control');

const slots = loadSlots();
const mode = control === 'pre-s36' ? 'pre-s36' : 's36';
const rows = judge(slots, { mode, halveActive: control === 'halve-active' });

const fails = rows.filter(r => r.verdict === 'FAIL' || r.verdict === 'STRANDED');
const stranded = rows.filter(r => r.verdict === 'STRANDED');
const unceiled = rows.filter(r => r.verdict === 'UNCEILED');
const stamps = auditStamps(rows);
const tally = arr => Object.fromEntries(Object.entries(arr.reduce((o, r) => (o[r.class] = (o[r.class] || 0) + 1, o), {})).sort((a, b) => b[1] - a[1]));

const label = control ? `CONTROL ARM: ${control}` : 'SHIPPED ARM: S36 as ruled';
console.log(`\n${label}`);
console.log(`ARBITRATION S36 — RI-WPN02 §B geometry vs RI-WPN05 §E.2 tip-speed ceiling`);
console.log(`  slots measured            ${rows.length}`);
console.log(`  no §E band for their tier ${unceiled.length}   (reported, not judged — S36 does not decide the ranged band)`);
console.log(`  FAIL (a legal fix exists) ${fails.length - stranded.length}`);
console.log(`  STRANDED (no legal fix)   ${stranded.length}`);
if (fails.length) console.log(`  worst overshoot           ${Math.max(...fails.map(r => r.over)).toFixed(2)}×`);
console.log(`  by class                  ${JSON.stringify(tally(fails))}`);
console.log(`  peak_tip_speed_mps_implied stamps: ${stamps.carried} carried, ${stamps.stale} disagree with the published arc, ${stamps.missing} over-ceiling slots carry none`);
const offband = rows.filter(r => r.m5_offband);
console.log(`  arc outside its shape's RI-WPN02 M5 band: ${offband.length}   (a mislabelling DEFECT under M5, judged there — S36 neither excuses nor punishes it)`);

if (fails.length) {
  const cost = fails.filter(r => r.active_f_needed > r.active_f).map(r => r.active_f_needed - r.active_f).sort((a, b) => a - b);
  if (cost.length) {
    console.log(`  remedy, lengthen the active window: median +${cost[Math.floor(cost.length / 2)]} f@60, max +${cost.at(-1)}, total +${cost.reduce((s, x) => s + x, 0)} f@60`);
  }
  console.log(`\n  worst ten:`);
  for (const r of [...fails].sort((a, b) => b.over - a.over).slice(0, 10)) {
    console.log(`    ${r.verdict.padEnd(8)} ${(r.weapon + '/' + r.slot).padEnd(34)} ${r.shape.padEnd(8)} arc ${String(r.arc_deg).padStart(5)}° reach ${r.reach_m}m active ${r.active_f}f -> ${r.implied.toFixed(1)} m/s vs ${r.ceiling.toFixed(1)} (${r.over.toFixed(2)}×)`);
  }
}

if (jsonAt) {
  fs.writeFileSync(R(jsonAt), JSON.stringify({
    schema: 'elder-souls/wpn-tipspeed-s36@1',
    ruling: 'ARBITRATION.md §2 S36',
    model: 'ceiling = max(1.25 * tier_band_top, 1.25 * K*arc_rad*reach_m*60/active_f_max); K=1.5; active_f_max = floor(0.16/0.84*(startup+recovery))',
    arm: control || 's36',
    slots_total: rows.length, fails: fails.length, stranded: stranded.length,
    unceiled: unceiled.length, stamps, by_class: tally(fails),
    violations: fails.map(({ stamp, baseline, ...r }) => r),
  }, null, 1) + '\n');
  console.log(`\n  wrote ${jsonAt}`);
}

if (gate && (fails.length || stamps.stale)) {
  console.error(`\nGATE: ${fails.length} slots fail S36 and ${stamps.stale} shipped stamps disagree with the arc their own file publishes.`);
  process.exit(1);
}
console.log('');
