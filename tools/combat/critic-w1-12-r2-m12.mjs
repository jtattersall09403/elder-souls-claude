#!/usr/bin/env node
// W1-12 round-2 CRITIC — RI-AI01 M1 and M2, measured in bare Node.
//
// WHY THIS EXISTS. Round 1 and round 2 both reported M1 and M2 as `browser_required` and scored
// them a fail-closed 0, on the reasoning that "the alert meter is filled by
// sim/stealth/system.js::stepPerception(), which the bare-Node combat arena does not run". The
// first half of that is true. The second half is a property of `tools/lib/combat-node.mjs`, not
// of Node: `StealthSystem` is a plain ES module, `stl-probe.mjs` has been importing its
// neighbours in bare Node since W1-15, and `losClear()` degrades to "no walls" when `sim.cell`
// is absent — which is exactly the flat, empty ground RI-AI01 M1's polar grid specifies.
//
// So this drives THE SHIPPING `StealthSystem.stepPerception()` — not a reimplementation of it —
// over M1's grid. If a number here ever disagrees with `ai-browser.mjs --probe=b2` in the real
// engine, the browser wins and this file is the defect; that is the same contract
// `combat-node.mjs` opens with.
//
// WHAT IT DOES NOT MEASURE, said plainly (RULES 26):
//   * no walls, no light field, no cover — M1's fixture is flat ground and a stationary player,
//     so `V` is the constructor's 1.0 rather than a value the light model derived. A browser run
//     is still the only place the LIGHT term is exercised.
//   * `character/encounter.js`'s wilderness sight-cone gate (ai-browser B4) is NOT this.
//   * the player is stationary and silent, so the hearing channels are untested here.
//
// RULE 4 — the instrument is shown to go red rather than promised to. `--control` runs the same
// grid against two deliberately broken observers:
//   proximity : a 360-degree cone, which is `if (dist < 15) aggro = true` wearing a cone costume
//               and is RI-AI01's named failure mode 2. The acquisition set must come back a
//               CIRCLE and M1 must score 0.
//   instant   : an observer whose meter is filled to 100 in one frame, which must trip M2's
//               "IDLE -> AGGRO with no intermediate state" clause and score 0.
// The tool exits non-zero if either control passes.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StealthCrime } from '../../game/src/sim/stealth/system.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const D = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data', p), 'utf8'));

const argv = process.argv.slice(2);
const opt = (k, d) => { const h = argv.find((a) => a.startsWith(`--${k}=`)); return h ? h.slice(k.length + 3) : d; };
const HOLD_F = Number(opt('hold', 180));          // RI-AI01 M1: "Hold 3 s".
const BEARINGS = [0, 30, 60, 90, 120, 150, 180];  // M1's grid, verbatim.
const RADII = [0.5, 0.9, 1.1, 1.5];

function gameData() {
  return {
    stealth: {
      detection: D('stealth/detection.json'),
      search: D('stealth/search.json'),
      locks: D('stealth/locks.json'),
      theft: D('stealth/theft.json'),
    },
    crime: {
      bounty: D('crime/bounty.json'),
      justice: D('crime/justice.json'),
      sanction: D('crime/sanction.json'),
      fences: D('crime/fences.json'),
    },
    progression: { 'race-reactions': D('progression/race-reactions.json') },
  };
}

function statblock(id) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/combat/enemies', `${id}.json`), 'utf8'));
}

/**
 * One cell of M1's grid. Enemy at the origin facing +Z (yaw 0), player teleported to
 * (bearing, radius) and held. Returns the frame of first AGGRO and the alert-state series.
 *
 * `mode`:
 *   'shipped'   — the statblock's own sight radius and cone.
 *   'proximity' — a 360-degree cone: RI-AI01 "how we lose" #2. CONTROL.
 *   'instant'   — the meter is slammed to 100 on the first frame the player is inside R,
 *                 with no ladder at all. CONTROL for M2.
 */
function cell(stealth, stat, bearingDeg, radiusMult, mode) {
  const R = stat.sight_radius_m;
  const e = {
    eid: 'm1', pos: [0, 0, 0], yaw: 0, hp: stat.hp, ai: 'souls',
    sight_radius_m: R,
    sight_cone_deg: stat.sight_cone_deg,
    alert: 0, alertState: 'IDLE', alertChannel: null,
  };
  const rad = (bearingDeg * Math.PI) / 180;
  const r = R * radiusMult;
  // yaw 0 is +Z (bearingDeg in this build is atan2(dx, dz) - yaw), so bearing 0 is straight ahead.
  const px = Math.sin(rad) * r, pz = Math.cos(rad) * r;
  const sim = {
    frame: 0,
    player: { pos: [px, 0, pz] },
    entities: [e],
    _combat: null,
    cell: null,          // flat ground: `losClear` returns true, which is M1's fixture
    stealth: null,
  };
  // A stationary, non-attacking player (M1's words). Silent, so no hearing channel.
  stealth.p.motion = 'still';
  stealth.p.soundR = 0;
  stealth.p.V = 1.0;
  stealth.p.zone = null;

  const series = [];
  let aggroF = -1;
  for (let f = 0; f < HOLD_F; f++) {
    sim.frame = f;
    if (mode === 'instant') {
      // No ladder: the naive `if (dist < R) aggro = true`.
      const d = Math.hypot(px, pz);
      if (d < R) { e.alert = 100; e.alertState = 'AGGRO'; }
    } else if (mode === 'proximity') {
      // RI-AI01 "how we lose" #2, and the literal code `sim/stealth/system.js`'s own header says
      // this build shipped before W1-15: `combat/enemy.js::_idleBehaviour` did
      // `this.alert = min(100, this.alert + 4)` if the player was inside a radius. No bearing
      // term at all, so the acquisition set must come back a perfect circle — with a perfectly
      // respectable alert ladder in front of it, which is the point: M1 must go red while M2
      // does not. Widening the STATBLOCK cone to 360 does NOT produce this, and finding that out
      // is itself a result: the binding cone is `detection.json`'s +/-55/+/-100, not the
      // statblock's, so a body cannot be given proximity aggro by editing its own cone.
      const d = Math.hypot(px, pz);
      e.alert = d < R ? Math.min(100, e.alert + 4) : Math.max(0, e.alert - 12 / 60);
      e.alertState = e.alert >= 100 ? 'AGGRO' : e.alert > 0 ? 'SUSPICIOUS' : 'IDLE';
    } else {
      stealth.stepPerception(sim, null);
    }
    series.push(e.alertState);
    if (aggroF < 0 && e.alertState === 'AGGRO') aggroF = f;
  }
  // M2: consecutive SUSPICIOUS frames immediately before the first AGGRO frame.
  let dwell = 0;
  if (aggroF > 0) { for (let i = aggroF - 1; i >= 0 && series[i] === 'SUSPICIOUS'; i--) dwell++; }
  const jumped = aggroF >= 0 && dwell === 0;
  return { bearing_deg: bearingDeg, radius_mult: radiusMult, radius_m: +r.toFixed(2), aggro_f: aggroF, suspicious_dwell_f: dwell, jumped_idle_to_aggro: jumped, final_alert: +e.alert.toFixed(2), final_state: e.alertState };
}

function grid(stat, mode) {
  const stealth = new StealthCrime(gameData());
  const rows = [];
  for (const b of BEARINGS) for (const m of RADII) rows.push(cell(stealth, stat, b, m, mode));
  return rows;
}

function score(stat, rows) {
  const R = stat.sight_radius_m;
  const at = (b, m) => rows.find((r) => r.bearing_deg === b && r.radius_mult === m);
  // Acquisition radius per bearing = the LARGEST radius that acquired within the hold.
  const acq = {};
  for (const b of BEARINGS) {
    const got = rows.filter((r) => r.bearing_deg === b && r.aggro_f >= 0).map((r) => r.radius_m);
    acq[b] = got.length ? Math.max(...got) : 0;
  }
  const spread = Math.max(...Object.values(acq)) - Math.min(...Object.values(acq));
  const isCircle = spread < 0.15 * R;
  const rear180 = at(180, 0.5).aggro_f < 0 && at(180, 0.9).aggro_f < 0 && at(180, 1.1).aggro_f < 0 && at(180, 1.5).aggro_f < 0;
  const near09 = at(0, 0.9).aggro_f >= 0;
  const far15 = at(0, 1.5).aggro_f < 0;
  const m1pass = rear180 && near09 && far15 && !isCircle;
  const m1 = isCircle ? 0 : (m1pass ? 2 : ((rear180 && far15) ? 1 : 0));

  // M2 — over every acquisition in the grid.
  const acqs = rows.filter((r) => r.aggro_f >= 0);
  const dwells = acqs.map((r) => r.suspicious_dwell_f).sort((a, b) => a - b);
  const medianDwell = dwells.length ? dwells[dwells.length >> 1] : 0;
  const jumpFrac = acqs.length ? acqs.filter((r) => r.jumped_idle_to_aggro).length / acqs.length : 1;
  let m2 = 0;
  if (!acqs.length) m2 = 0;                                  // fail-closed: no evidence
  else if (medianDwell >= 30 && jumpFrac <= 0.10) m2 = 2;
  else if (medianDwell >= 20 && jumpFrac <= 0.10) m2 = 1;
  return {
    acquisition_radius_by_bearing_m: acq,
    acquisition_spread_m: +spread.toFixed(3),
    circle_threshold_m: +(0.15 * R).toFixed(3),
    acquisition_set_is_a_circle: isCircle,
    rear_180_never_acquires: rear180,
    acquires_at_0_9R_bearing_0: near09,
    never_acquires_at_1_5R_bearing_0: far15,
    M1: m1,
    acquisitions: acqs.length,
    median_suspicious_dwell_f: medianDwell,
    idle_to_aggro_jump_fraction: +jumpFrac.toFixed(3),
    M2: m2,
  };
}

const ROSTER = ['inf_trash', 'guard_legion', 'drowned_lesser', 'drowned_greater',
  'beast_slitherfang', 'champion_hist_marked', 'cst_sap_speaker'];

const out = { tool: 'tools/combat/critic-w1-12-r2-m12.mjs', item: 'RI-AI01', checks: ['M1', 'M2'], hold_f: HOLD_F, shipped: {}, controls: {} };
for (const id of ROSTER) {
  const stat = statblock(id);
  const rows = grid(stat, 'shipped');
  out.shipped[id] = { sight_radius_m: stat.sight_radius_m, sight_cone_deg: stat.sight_cone_deg, ...score(stat, rows), rows };
}
for (const mode of ['proximity', 'instant']) {
  const stat = statblock('inf_trash');
  const rows = grid(stat, mode);
  out.controls[mode] = { ...score(stat, rows), rows };
}

const dest = path.join(ROOT, 'reports/w1-12-r2-critic/m1-m2.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2));

for (const id of ROSTER) {
  const s = out.shipped[id];
  console.log(`${id.padEnd(22)} R=${s.sight_radius_m} cone=${s.sight_cone_deg}  M1 ${s.M1}/2  M2 ${s.M2}/2  `
    + `acq-by-bearing ${BEARINGS.map((b) => s.acquisition_radius_by_bearing_m[b]).join('/')} m  `
    + `spread ${s.acquisition_spread_m} (circle if < ${s.circle_threshold_m})  `
    + `0.9R@0 ${s.acquires_at_0_9R_bearing_0}  1.5R@0-silent ${s.never_acquires_at_1_5R_bearing_0}  rear-silent ${s.rear_180_never_acquires}  `
    + `median SUSPICIOUS dwell ${s.median_suspicious_dwell_f} f  jumps ${s.idle_to_aggro_jump_fraction}`);
}
console.log('');
for (const [k, c] of Object.entries(out.controls)) {
  console.log(`CONTROL ${k.padEnd(10)} M1 ${c.M1}/2  M2 ${c.M2}/2  circle=${c.acquisition_set_is_a_circle} spread ${c.acquisition_spread_m}  median dwell ${c.median_suspicious_dwell_f} f  jumps ${c.idle_to_aggro_jump_fraction}`);
}
console.log(`\nwrote ${path.relative(ROOT, dest)}`);

const problems = [];
if (out.controls.proximity.M1 !== 0) problems.push('CONTROL FAILED: the 360-degree-cone observer did not score M1 = 0. The circle detector cannot fail, so no M1 number in this file is evidence (RULES 4).');
if (out.controls.instant.M2 !== 0) problems.push('CONTROL FAILED: the instant-aggro observer did not score M2 = 0. The ladder detector cannot fail (RULES 4).');
if (problems.length) { for (const p of problems) console.error(p); process.exit(1); }
console.log('both controls went red: the circle detector and the ladder detector can fail.');
