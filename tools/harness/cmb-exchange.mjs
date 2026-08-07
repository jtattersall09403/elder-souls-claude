#!/usr/bin/env node
// cmb-exchange.mjs — RI-CMB12, `ES-REACT/1` and `ES-DIVERGE/1`.
//
// WHY THIS TOOL EXISTS, in the item's own words:
//
//   "W1-09 passed frame censuses, i-frame windows, stamina curves, commitment grids,
//    root-motion fidelity and determinism across three critic rounds. In those same three
//    rounds three independent critics found, by hand: a 120-second exemplar fight in which the
//    player was never hit at all; a boss whose correct answer was to walk inside it and stand
//    still; a hole in every enemy weapon arc, covered by a second volume. Not one of those is
//    visible in a frame table, and not one of them was caught by an instrument."
//
// Two measurements, and they are properties of a moment of play rather than of a table:
//
//   M1  REACTABILITY.  `t_react = f_active - f_vis`, where `f_vis` is the frame the pose first
//       becomes DISTINGUISHABLE, not the frame the state label changes. `lie = t_label -
//       t_react` is the number of telegraph frames that are not on the screen. Every existing
//       check in corpus/10-combat/ reads the label.
//   M2  DIVERGENCE.  Fork the fight at 200 sampled frames, run all 8 player actions to a
//       120-frame horizon, and measure whether the choice changed the outcome. `DIV_dominant >
//       0.70` is the single statistic that would have caught all three failures above at the
//       round they appeared.
//
// HOW THE FORK IS IMPLEMENTED, stated plainly because the item's "How we lose" #2 is about
// exactly this. It is a **replay fork**: re-run the same scripted fight from frame 0 with the
// alternative action injected at frame `f`. The item calls that "legitimate but expensive" and
// warns against the cheap alternative — a shallow copy that shares the enemy's state object,
// which makes every action produce the same outcome and fires the hard fail on an instrument
// bug. Nothing is shared here because nothing is copied: each fork is a fresh `NodeArena`. The
// determinism re-run (M2's own check) is reported, not asserted.
//
// SILHOUETTE. §A.1's second metric is "screen-space silhouette IoU ... rendered orthographically
// from the lock-on camera's bearing". This tool rasterises the actor's own hurtbox capsules and
// weapon capsule — the twelve volumes RI-CMB04 §D declares, which are the character's body —
// orthographically from that bearing into a fixed grid. It is not a render of the shipped mesh
// and it is not claimed to be one; it is the silhouette of the collision body, which is the
// only body this build has, and it is what makes the cross-check independent of the pose
// metric rather than a restatement of it.
//
// NODE vs BROWSER. `tools/lib/combat-node.mjs` diverges from the engine on LONG fights because
// the engine's fixed step also runs stealth perception, which sets AGGRO and makes an enemy
// steer. M1 is per-attack frame geometry (short, scripted, agrees to the digit). M2 is a long
// fight and its enemy is SCRIPTED here on purpose — §B says the test "runs against a scripted
// enemy in the build that exists today" — so perception is not in the loop for either. The
// `--verify` flag on `cmb-reach.mjs` is the standing cross-check for the arena itself.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { NodeArena, loadCombatData } from '../lib/combat-node.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
if (argv.includes('--help')) {
  process.stdout.write(`cmb-exchange.mjs — RI-CMB12 reactability + decision divergence.
  --probe <react|diverge|all>   default all
  --enemy <archetype>           default champion_hist_marked
  --samples <n>                 M2 sample count, default 200
  --horizon <f>                 M2 fork horizon in f@60, default 120
  --clips <path>                judge a CANDIDATE clips.json instead of the shipped one
  --moves <a,b,...>             M1 only: restrict the census to these attacks
  --out <path>
`);
  process.exit(0);
}

const WHICH = String(arg('probe', 'all'));
const ENEMY = String(arg('enemy', 'champion_hist_marked'));
const N = Number(arg('samples', 200));
const HORIZON = Number(arg('horizon', 120));
const data = loadCombatData();
// `--clips` — WHY THIS EXISTS. `anim-author.mjs` solves the attack archetypes against its OWN
// proxy for §A.1: the pose metric only, measured against the authored idle constant. This
// instrument's `f_vis` is `min(pose, silhouette)` unless the two disagree by more than
// DISAGREE_F, in which case the LATER wins — and on `sweep_wide` the silhouette is the binding
// metric by eight frames. A solver that cannot see that term will keep solving to a number
// nobody scores. Pointing this flag at a candidate file lets the search be graded by the
// instrument that grades the build, rather than by a copy of half of it.
if (arg('clips')) data.clips = JSON.parse(fs.readFileSync(String(arg('clips')), 'utf8'));
const ONLY_MOVES = arg('moves') ? String(arg('moves')).split(',') : null;

// ---- ES-REACT/1 §A.1 — the six tracked joints, declared, the same six for every actor -------
const TRACKED = ['hand_r', 'lowerarm_r', 'upperarm_r', 'clavicle_r', 'spine_02', 'head'];
const POSE_DEG = 12;         // §A.1 pose metric threshold
const SIL_IOU = 0.92;        // §A.1 silhouette metric threshold
const DISAGREE_F = 4;        // where the two metrics disagree by more than this, the LATER wins
const T_REACT_MIN = 19;      // §A budget for `reactable: true`
const LIE_MAX = 8;           // §A budget for every attack
const LIE_HARD = 20;         // automatic fail
const REACTABLE_SHARE_MIN = 0.70;
const SPREAD_MIN = 12;

/** Absolute angular deviation of one bone's Euler triple from a reference, in degrees. */
function boneDelta(rig, idx, ref) {
  return Math.max(
    Math.abs(rig.rx[idx] - ref[0]),
    Math.abs(rig.ry[idx] - ref[1]),
    Math.abs(rig.rz[idx] - ref[2]));
}

/**
 * Orthographic silhouette of the actor's own volumes, seen from `bearingDeg`, rasterised into a
 * `G x G` occupancy grid over a fixed 2.6 m x 2.6 m window centred on the actor's root. Fixed
 * window and fixed grid, so two frames are directly comparable and the IoU is not a function of
 * how big the character happened to be that frame.
 */
const G = 96, WIN = 2.6;
function silhouette(rig, pos, bearingDeg) {
  const m = new Uint8Array(G * G);
  const c = Math.cos(bearingDeg * Math.PI / 180), s = Math.sin(bearingDeg * Math.PI / 180);
  // screen x = the axis perpendicular to the view bearing; screen y = world up
  const put = (a, b, rad) => {
    const STEPS = 12;
    for (let i = 0; i <= STEPS; i++) {
      const u = i / STEPS;
      const wx = a[0] + (b[0] - a[0]) * u - pos[0];
      const wy = a[1] + (b[1] - a[1]) * u;
      const wz = a[2] + (b[2] - a[2]) * u - pos[2];
      const sx = wx * c - wz * s;
      const px = (sx + WIN / 2) / WIN * G;
      const py = (WIN - wy) / WIN * G;
      const pr = rad / WIN * G;
      const i0 = Math.max(0, Math.floor(px - pr)), i1 = Math.min(G - 1, Math.ceil(px + pr));
      const j0 = Math.max(0, Math.floor(py - pr)), j1 = Math.min(G - 1, Math.ceil(py + pr));
      for (let j = j0; j <= j1; j++) {
        for (let k = i0; k <= i1; k++) {
          const dx = k + 0.5 - px, dy = j + 0.5 - py;
          if (dx * dx + dy * dy <= pr * pr) m[j * G + k] = 1;
        }
      }
    }
  };
  for (const h of rig.hurtboxes) put(h.a, h.b, h.r);
  put(rig.socketA, rig.socketB, 0.07);
  return m;
}

function iou(a, b) {
  let inter = 0, uni = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] || b[i]) { uni++; if (a[i] && b[i]) inter++; }
  }
  return uni === 0 ? 1 : inter / uni;
}

/**
 * M1 — play one attack from the actor's idle pose and from its walk pose, in separate runs, and
 * compute `f_state`, `f_vis`, `f_active`, `t_react`, `t_label`, `lie`.
 *
 * The reference pose is the actor's pose at `f_state - 1`: the last frame BEFORE it committed.
 * That is what the player is looking at when the windup starts, and it is what §A.1 names.
 */
function reactOne(move, entry) {
  const a = new NodeArena({ data, loadout: { weapon: 'straight-sword' } });
  a.player.pos[0] = 0; a.player.pos[2] = 2.4; a.player.yaw = 180; a.player.evaluateRig(0);
  a.spawn('E1', ENEMY, 0, 0, 0);
  a.lockOn('E1');
  // `entry`: 'idle' plays the attack from a standstill; 'walk' plays it out of the approach loop,
  // which is the pose a player actually sees it come from. §M1 step 1 requires both.
  const START = entry === 'walk' ? 40 : 12;
  a.script('E1', [{ f: START, move }]);
  a.queueInputs([{ f: 1, move: [0, 0] }]);
  const E = a.cs.bodyOf('E1');
  const idx = TRACKED.map((b) => E.rig.index.get(b));

  let fState = null, fActive = null;
  let ref = null, refSil = null;
  let fVisPose = null, fVisSil = null;
  const poseCurve = [];
  for (let f = 1; f <= START + 400; f++) {
    a.step();
    const st = E.state;
    // The reference is captured on the frame BEFORE the state first reads ATK_WINDUP.
    if (fState === null && st !== 'ATK_WINDUP') {
      ref = idx.map((i) => [E.rig.rx[i], E.rig.ry[i], E.rig.rz[i]]);
      refSil = silhouette(E.rig, E.pos, 180);
    }
    if (st === 'ATK_WINDUP' && fState === null) fState = f;
    if (fState !== null) {
      const dev = Math.max(...idx.map((i, k) => boneDelta(E.rig, i, ref[k])));
      const io = iou(refSil, silhouette(E.rig, E.pos, 180));
      poseCurve.push({ f: f - fState, dev: +dev.toFixed(2), iou: +io.toFixed(4) });
      if (fVisPose === null && dev >= POSE_DEG) fVisPose = f;
      if (fVisSil === null && io <= SIL_IOU) fVisSil = f;
    }
    if (E.hitboxActive && fActive === null) { fActive = f; break; }
  }
  if (fState === null || fActive === null) return { move, entry, error: 'attack never reached ATK_ACTIVE' };
  // "Both are reported. Where they disagree by more than 4 frames, the LATER one is f_vis,
  // because the player must actually see it and the pose metric can fire on a motion no camera
  // angle reveals."
  const p = fVisPose === null ? fActive : fVisPose;
  const s = fVisSil === null ? fActive : fVisSil;
  const fVis = Math.abs(p - s) > DISAGREE_F ? Math.max(p, s) : Math.min(p, s);
  const tReact = fActive - fVis;
  const tLabel = fActive - fState;
  return {
    move, entry,
    f_state: fState, f_vis: fVis, f_vis_pose: fVisPose, f_vis_silhouette: fVisSil, f_active: fActive,
    t_react: tReact, t_label: tLabel, lie: tLabel - tReact,
    pose_curve: poseCurve,
  };
}

// ---- ES-DIVERGE/1 §B -------------------------------------------------------------------------
const ACTIONS = ['roll_forward', 'roll_back', 'roll_left', 'roll_right', 'R1', 'R2', 'guard', 'do_nothing'];

/** The input script fragment that expresses one of the eight alternatives at frame `f`. */
function actionScript(action, f) {
  switch (action) {
    case 'roll_forward': return [{ f, move: [0, 1] }, { f, press: ['roll'] }, { f: f + 2, release: ['roll'] }];
    case 'roll_back': return [{ f, move: [0, -1] }, { f, press: ['roll'] }, { f: f + 2, release: ['roll'] }];
    case 'roll_left': return [{ f, move: [-1, 0] }, { f, press: ['roll'] }, { f: f + 2, release: ['roll'] }];
    case 'roll_right': return [{ f, move: [1, 0] }, { f, press: ['roll'] }, { f: f + 2, release: ['roll'] }];
    case 'R1': return [{ f, press: ['light'] }, { f: f + 2, release: ['light'] }];
    case 'R2': return [{ f, press: ['heavy'] }, { f: f + 2, release: ['heavy'] }];
    case 'guard': return [{ f, press: ['block'] }, { f: f + HORIZON, release: ['block'] }];
    default: return [];
  }
}

/** The Mode-B fight every fork replays: a scripted attack string, the player standing at 2.2 m. */
function makeFight(extra) {
  const a = new NodeArena({ data, loadout: { weapon: 'straight-sword' } });
  a.player.pos[0] = 0; a.player.pos[2] = 2.2; a.player.yaw = 180; a.player.evaluateRig(0);
  a.spawn('E1', ENEMY, 0, 0, 0);
  a.lockOn('E1');
  const cyc = ['combo_b', 'combo_a', 'chop', 'thrust'];
  const sc = []; let f = 24;
  for (let i = 0; i < 40; i++) { sc.push({ f, move: cyc[i % cyc.length] }); f += 96; }
  a.script('E1', sc);
  a.queueInputs([{ f: 1, move: [0, 0] }].concat(extra || []));
  return a;
}

function runFork(action, atFrame) {
  const a = makeFight(actionScript(action, atFrame));
  const P = a.cs.bodyOf('P'), E = a.cs.bodyOf('E1');
  const php0 = P.hpMax !== undefined ? P.hpMax : P.hp;
  let pHpAt = null, eHpAt = null;
  for (let f = 1; f <= atFrame + HORIZON; f++) {
    a.step();
    if (f === atFrame - 1) { pHpAt = P.hp; eHpAt = E.hp; }
    if (P.dead) break;
  }
  if (pHpAt === null) { pHpAt = P.hp; eHpAt = E.hp; }
  const ev = ((eHpAt - E.hp) - (pHpAt - P.hp)) / php0;
  return { ev: +ev.toFixed(6), player_dead: P.dead, enemy_dead: E.dead };
}

// ---- run ------------------------------------------------------------------------------------
const R = { schema: 'es-cmb12-exchange/1', item: 'RI-CMB12', enemy: ENEMY, probes: {} };
const want = (n) => WHICH === 'all' || WHICH.split(',').includes(n);
const fails = [];

if (want('react')) {
  const st = data._enemies[ENEMY];
  const rows = [];
  for (const move of Object.keys(st.attacks)) {
    if (ONLY_MOVES && !ONLY_MOVES.includes(move)) continue;
    for (const entry of ['idle', 'walk']) {
      const r = reactOne(move, entry);
      r.declared_reactable = st.attacks[move].reactable;
      rows.push(r);
    }
  }
  // The census figure per attack is the WORST (smallest t_react, largest lie) of the two entries:
  // an attack a player can read out of idle and not out of the approach is not readable.
  const per = {};
  for (const r of rows) {
    if (r.error) continue;
    const p = per[r.move] || (per[r.move] = { move: r.move, declared_reactable: r.declared_reactable });
    if (p.t_react === undefined || r.t_react < p.t_react) { p.t_react = r.t_react; p.worst_entry = r.entry; }
    if (p.lie === undefined || r.lie > p.lie) p.lie = r.lie;
    if (p.t_label === undefined) p.t_label = r.t_label;
    p['f_vis_' + r.entry] = r.f_vis;
    p['f_active_' + r.entry] = r.f_active;
  }
  const list = Object.values(per);
  const declared = list.filter((p) => p.declared_reactable !== false);
  const share = list.length ? declared.length / list.length : 0;
  const tr = declared.map((p) => p.t_react);
  const spread = tr.length ? Math.max(...tr) - Math.min(...tr) : 0;
  R.probes.react = {
    per_attack: list, runs: rows.map((r) => Object.assign({}, r, { pose_curve: undefined })),
    reactable_share: +share.toFixed(3), t_react_spread_f: spread,
    // §M1 asks for the pose-delta curve of the three attacks with the largest `lie`.
    worst_lie_curves: [...rows].filter((r) => !r.error).sort((a, b) => b.lie - a.lie).slice(0, 3)
      .map((r) => ({ move: r.move, entry: r.entry, lie: r.lie, pose_curve: r.pose_curve })),
  };
  for (const p of list) {
    if (p.declared_reactable !== false && p.t_react < T_REACT_MIN) fails.push(`M1 ${p.move}: reactable but t_react ${p.t_react} f < ${T_REACT_MIN} f — answerable only by memory`);
    if (p.lie > LIE_MAX) fails.push(`M1 ${p.move}: lie ${p.lie} f > ${LIE_MAX} f — telegraph frames that are not on the screen`);
    if (p.lie > LIE_HARD) fails.push(`M1 ${p.move}: HARD FAIL lie ${p.lie} f > ${LIE_HARD} f`);
  }
  if (share < REACTABLE_SHARE_MIN) fails.push(`M1: reactable_share ${share.toFixed(2)} < ${REACTABLE_SHARE_MIN} — the roster is a memorisation test`);
  if (spread < SPREAD_MIN) fails.push(`M1: t_react spread ${spread} f < ${SPREAD_MIN} f — one timing answers everything`);
}

if (want('diverge')) {
  // Sample uniformly across the fight, avoiding the first 30 frames (the enemy has not acted).
  const FIGHT_F = 24 + 96 * 12;
  const frames = [];
  for (let i = 0; i < N; i++) frames.push(40 + Math.floor((FIGHT_F - 60) * i / N));
  const matrix = [];
  for (const f of frames) {
    const row = { f, ev: {} };
    for (const act of ACTIONS) row.ev[act] = runFork(act, f).ev;
    const vals = ACTIONS.map((k) => row.ev[k]);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    row.sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) * (v - mean), 0) / vals.length);
    const sorted = [...vals].sort((a, b) => b - a);
    row.best = ACTIONS[vals.indexOf(sorted[0])];
    row.best_ev = sorted[0]; row.second_ev = sorted[1];
    row.range = sorted[0] - sorted[sorted.length - 1];
    // "one action's EV exceeds the next best by >= 2x" — a ratio is only meaningful when the
    // runner-up is positive; when it is not, dominance is scored on the absolute gap against the
    // spread, which is the same statement without dividing by zero.
    row.dominant = sorted[1] > 1e-9 ? (sorted[0] >= 2 * sorted[1]) : (sorted[0] > 0 && row.range > 0.02);
    matrix.push(row);
  }
  const DIV = matrix.reduce((s, r) => s + r.sd, 0) / matrix.length;
  const domShare = matrix.filter((r) => r.dominant).length / matrix.length;
  const deadShare = matrix.filter((r) => r.range < 0.01).length / matrix.length;
  const bestCounts = {};
  for (const r of matrix) bestCounts[r.best] = (bestCounts[r.best] || 0) + 1;
  const identity = Math.max(...Object.values(bestCounts)) / matrix.length;
  const dominantAction = Object.keys(bestCounts).sort((a, b) => bestCounts[b] - bestCounts[a])[0];
  const nothingShare = matrix.filter((r) => r.best === 'do_nothing' && r.dominant).length / matrix.length;

  // M2's own determinism check: 20 of the N sampled frames re-run and hashed. "The fork must be
  // deterministic or the whole measurement is noise."
  const recheck = [];
  for (let i = 0; i < Math.min(20, frames.length); i++) {
    const f = frames[Math.floor(i * frames.length / 20)];
    const a = ACTIONS[i % ACTIONS.length];
    recheck.push({ f, action: a, first: matrix.find((m) => m.f === f).ev[a], again: runFork(a, f).ev });
  }
  const nondet = recheck.filter((r) => r.first !== r.again);

  R.probes.diverge = {
    samples: matrix.length, horizon_f: HORIZON, actions: ACTIONS,
    DIV: +DIV.toFixed(4), DIV_dominant: +domShare.toFixed(3),
    DIV_dead: +deadShare.toFixed(3), DIV_identity: +identity.toFixed(3),
    dominant_action: dominantAction, best_action_counts: bestCounts,
    do_nothing_dominant_share: +nothingShare.toFixed(3),
    determinism_rechecks: recheck.length, determinism_mismatches: nondet.length, nondeterministic: nondet,
    highest_spread: [...matrix].sort((a, b) => b.sd - a.sd).slice(0, 5),
    lowest_spread: [...matrix].sort((a, b) => a.sd - b.sd).slice(0, 5),
  };
  if (DIV < 0.02) fails.push(`M2 HARD FAIL: DIV ${DIV.toFixed(4)} < 0.02 — the player's decisions do not change the outcome`);
  else if (DIV < 0.06) fails.push(`M2: DIV ${DIV.toFixed(4)} below the 0.06 band`);
  if (domShare > 0.70) fails.push(`M2 HARD FAIL: DIV_dominant ${domShare.toFixed(2)} > 0.70 — the fight is solved`);
  else if (domShare > 0.40) fails.push(`M2: DIV_dominant ${domShare.toFixed(2)} above the 0.40 band`);
  if (deadShare > 0.35) fails.push(`M2 HARD FAIL: DIV_dead ${deadShare.toFixed(2)} > 0.35`);
  else if (deadShare > 0.15) fails.push(`M2: DIV_dead ${deadShare.toFixed(2)} above the 0.15 band`);
  if (identity > 0.75) fails.push(`M2 HARD FAIL: DIV_identity ${identity.toFixed(2)} > 0.75 — the metronome`);
  else if (identity > 0.45) fails.push(`M2: DIV_identity ${identity.toFixed(2)} above the 0.45 band`);
  if (nondet.length) fails.push(`M2: ${nondet.length} of ${recheck.length} forks were NOT deterministic — the measurement is noise`);
  if (nothingShare > 0.05) fails.push(`M3 HARD FAIL: do_nothing dominant on ${(nothingShare * 100).toFixed(1)}% of sampled frames > 5% — the turtle`);
}

R.acceptance_failures = fails;
R.ok = fails.length === 0;
if (arg('out')) {
  fs.mkdirSync(path.dirname(String(arg('out'))), { recursive: true });
  fs.writeFileSync(String(arg('out')), JSON.stringify(R, null, 1) + '\n');
}

const L = [];
L.push(`cmb-exchange — RI-CMB12, ${ENEMY}`);
if (R.probes.react) {
  L.push('\n  M1 REACTABILITY (ES-REACT/1)');
  L.push('    attack        declared   f_state  f_vis(idle/walk)  f_active   t_label   t_react   lie');
  for (const p of R.probes.react.per_attack) {
    L.push(`    ${p.move.padEnd(13)} ${String(p.declared_reactable).padEnd(9)}  ${String(p.f_active_idle - p.t_label).padStart(6)}   ${String(p.f_vis_idle).padStart(5)}/${String(p.f_vis_walk).padEnd(5)}      ${String(p.f_active_idle).padStart(5)}    ${String(p.t_label).padStart(5)}     ${String(p.t_react).padStart(5)}   ${p.lie}`);
  }
  L.push(`    reactable_share ${R.probes.react.reactable_share}   t_react spread ${R.probes.react.t_react_spread_f} f`);
}
if (R.probes.diverge) {
  const d = R.probes.diverge;
  L.push('\n  M2 DECISION DIVERGENCE (ES-DIVERGE/1)');
  L.push(`    DIV            ${d.DIV}      band >= 0.06   hard fail < 0.02`);
  L.push(`    DIV_dominant   ${d.DIV_dominant}      band <= 0.40   hard fail > 0.70`);
  L.push(`    DIV_dead       ${d.DIV_dead}      band <= 0.15   hard fail > 0.35`);
  L.push(`    DIV_identity   ${d.DIV_identity}      band <= 0.45   hard fail > 0.75`);
  L.push(`    M3 dominance witness: ${d.dominant_action} (${JSON.stringify(d.best_action_counts)})`);
  L.push(`    do_nothing dominant on ${d.do_nothing_dominant_share} of frames (fail > 0.05)`);
  L.push(`    fork determinism: ${d.determinism_rechecks - d.determinism_mismatches}/${d.determinism_rechecks} identical on re-run`);
}
L.push('');
L.push(R.ok ? '  ACCEPTANCE: pass' : '  ACCEPTANCE: FAIL\n' + fails.map((f) => '    - ' + f).join('\n'));
process.stdout.write(L.join('\n') + '\n');
process.exit(R.ok ? 0 : 1);
