#!/usr/bin/env node
// W1-12 round-2 CRITIC — did the round have the right to overrule its own critic?
//
// THE CLAIM UNDER TEST. `corpus/90-verdicts/wave1/W1-12-r1.md` §11 named a remedy: gate RUSH on
// CLOSURE — d(dist)/dt over a rolling window — rather than on the distance band. Round 2 built
// that, measured it, REJECTED it, and shipped a rule that measures the TARGET's recession
// instead. Its argument (reports/w1-12-r2/survey.md §1a, repeated in ai.js's own header) is that
// closure is a property of the pair, so the enemy's own sprint restores it and the rule switches
// itself off twelve frames later, producing a 37-frame RUSH/APPROACH oscillation that stalls at
// about 4.1 m.
//
// A builder overruling its own critic is either the best thing in a round or the worst, and the
// deciding evidence is a frame trace, not a paragraph. So this rebuilds the rejected candidate
// on a scratch copy and measures it — THREE WAYS, because the published comparison is between
// the shipped rule WITH its inner (CIRCLE) half and a closure rule that may not have had one:
//
//   base     the shipped tree: target recession, at all three call sites.
//   clOuter  closure, at the RUSH and APPROACH sites only — CIRCLE reverted to band-only.
//            This is the arm whose frame trace the survey quotes.
//   clFull   closure, at all three sites INCLUDING CIRCLE — the same shape as shipped, one
//            predicate different. THIS IS THE FAIR COMPARISON and the survey does not report it.
//   clHyst   clFull plus a minimum RUSH dwell equal to the closure window, which is the standard
//            answer to a control loop that chatters. If the oscillation is the whole objection,
//            hysteresis is the one-line fix and the objection does not survive it.
//
// Every arm is the SHIPPING module with one predicate swapped; nothing is reimplemented. Arms
// run on copies in the scratchpad, never on the tree (rule 17).
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SCRATCH = process.env.SCRATCH_DIR || path.join(os.tmpdir(), 'w1-12-r2-critic-closure');
const THRESH = Number((process.argv.find((a) => a.startsWith('--thresh=')) || '--thresh=0.8').slice(9));

function freshCopy(name) {
  const dir = path.join(SCRATCH, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const d of ['game', 'tools']) fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true });
  return dir;
}

const AI = (dir) => path.join(dir, 'game/src/combat/ai.js');

/**
 * Swap `_targetIsLeaving` — which measures the TARGET — for a CLOSURE test, which measures the
 * PAIR. The window and the sample-contiguity rule are the shipped ones, so the only difference
 * between the arms is which quantity the predicate reads.
 */
function makeClosure(dir, { circleSite, hysteresis }) {
  let s = fs.readFileSync(AI(dir), 'utf8');
  const needle = '    return r !== null && (this.walk - r) < this.cfg.movement.walk_in_min_closure_mps;';
  if (!s.includes(needle)) throw new Error('closure arm: the recession predicate is not where it was — refusing to report an arm I did not apply.');
  // The distance window is fed from the SAME contiguous position window the shipped rule keeps,
  // so the two predicates see exactly the same frames.
  s = s.replace(needle,
    `    // CRITIC ARM: CLOSURE, the round-1 verdict's own proposed remedy. d(dist)/dt over the
    // same window, positive when the gap is shrinking. Fires when the enemy is NOT GAINING.
    const w = this.pWindow;
    if (w.length < this.cfg.movement.rush_closure_window_f * 3) return false;
    const d0 = Math.hypot(this.b.pos[0] - w[1], this.b.pos[2] - w[2]);
    const df = w[w.length - 3] - w[0];
    if (df <= 0) return false;
    const closure = (d0 - dist) / (df / 60);
    return closure < ${THRESH};`);
  if (!circleSite) {
    const cs = "        if (band === 'RUSH' || band === 'CLOSE' || this._targetIsLeaving(dx, dz, dist)) {";
    if (!s.includes(cs)) throw new Error('closure arm: the CIRCLE call site is not where it was.');
    s = s.replace(cs, "        if (band === 'RUSH' || band === 'CLOSE') {");
  }
  if (hysteresis) {
    // A minimum dwell in RUSH equal to the closure window: the standard cure for a control loop
    // whose input is its own output. The shipped code already has `stateF >= 12` here.
    const h = "        if (this.stateF >= 12 && !this._targetIsLeaving(dx, dz, dist)";
    if (!s.includes(h)) throw new Error('closure arm: the RUSH exit guard is not where it was.');
    s = s.replace(h, "        if (this.stateF >= this.cfg.movement.rush_closure_window_f && !this._targetIsLeaving(dx, dz, dist)");
  }
  fs.writeFileSync(AI(dir), s);
}

const MEASURE = `
import { NodeArena, loadCombatData } from './tools/lib/combat-node.mjs';
const data = loadCombatData();
const IDS = ['inf_trash','guard_legion','drowned_lesser','drowned_greater','beast_slitherfang','champion_hist_marked','cst_sap_speaker'];
const om = (id) => { const s = data._enemies[id];
  const a = (data.ai.behaviour_archetype && data.ai.behaviour_archetype[id]) || s.archetype;
  return s.reach_m || data.ai.archetype[a].omega_m; };

// The survey's own fixture: player walking away in a straight line at the game's 2.0 m/s.
function flee(id, r0, trace) {
  const arena = new NodeArena({ data, seed: 1337 });
  const b = arena.spawn('e1', id, 0, r0, 180);
  const ctl = arena.cs.enemies.get('e1'); const p = arena.player;
  const strike = data.ai.bands.strike * om(id);
  let min = Infinity, inStrike = 0, rush = 0, flips = 0, prev = null;
  const rows = [];
  for (let i = 0; i < 1200; i++) {
    p.pos[0] = 0; p.pos[2] = -(i/60)*2.0;
    ctl.alert = 100; ctl.alertState = 'AGGRO'; arena.step();
    const st = ctl.ai ? ctl.ai.state : b.state;
    const d = Math.hypot(p.pos[0]-b.pos[0], p.pos[2]-b.pos[2]);
    if (st === 'RUSH') rush++;
    if ((st === 'RUSH' && prev === 'APPROACH') || (st === 'APPROACH' && prev === 'RUSH')) flips++;
    prev = st;
    if (i > 30) { min = Math.min(min, d); if (d <= strike) inStrike++; }
    if (trace && i < 420) rows.push({ f: i, s: st, d: +d.toFixed(2), v: +(b.speedMps||0).toFixed(2) });
  }
  return { min: +min.toFixed(3), inStrike, rush, flips, rows };
}
// RI-AI01 M3, the round-1 fixture and seed.
function dwell(id) {
  const arena = new NodeArena({ data, seed: 1337 });
  const O = om(id);
  const b = arena.spawn('e1', id, 0, 5*O, 180);
  const ctl = arena.cs.enemies.get('e1'); const p = arena.player;
  const rows = [];
  for (let i = 0; i < 3600; i++) {
    p.pos[0] = 2.6*Math.sin(i/140); p.pos[2] = 1.9*Math.sin(i/97+1.1);
    ctl.alert = 100; ctl.alertState = 'AGGRO'; arena.step();
    rows.push({ d: Math.hypot(p.pos[0]-b.pos[0], p.pos[2]-b.pos[2]), s: ctl.ai ? ctl.ai.state : b.state });
  }
  const nc = rows.filter(r => r.s !== 'COMMIT');
  return +(nc.filter(r => r.d < data.ai.bands.strike*om(id)).length / nc.length).toFixed(4);
}
const out = { from12: {}, from4: {}, m3: {}, trace: flee('inf_trash', 12, true).rows };
for (const id of IDS) {
  const a = flee(id, 12, false), c = flee(id, 4, false);
  out.from12[id] = { min_gap_m: a.min, frames_in_strike: a.inStrike, rush_frames: a.rush, rush_approach_flips: a.flips };
  out.from4[id]  = { min_gap_m: c.min, frames_in_strike: c.inStrike, rush_frames: c.rush, rush_approach_flips: c.flips };
  out.m3[id] = dwell(id);
}
console.log(JSON.stringify(out));
`;

function measure(dir) {
  const f = path.join(dir, '_m.mjs');
  fs.writeFileSync(f, MEASURE);
  const o = execFileSync('node', [f], { cwd: dir, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  return JSON.parse(o.trim().split('\n').pop());
}

const ARMS = {
  base: { label: 'base — SHIPPED: target recession, all three sites', apply: () => {} },
  clOuter: { label: `clOuter — CLOSURE < ${THRESH} m/s at RUSH/APPROACH only (the survey's quoted arm)`, apply: (d) => makeClosure(d, { circleSite: false, hysteresis: false }) },
  clFull: { label: `clFull — CLOSURE < ${THRESH} m/s at ALL THREE sites (the fair comparison)`, apply: (d) => makeClosure(d, { circleSite: true, hysteresis: false }) },
  clHyst: { label: `clHyst — clFull plus a 30 f minimum RUSH dwell (hysteresis)`, apply: (d) => makeClosure(d, { circleSite: true, hysteresis: true }) },
};

fs.mkdirSync(SCRATCH, { recursive: true });
const results = {};
for (const [k, arm] of Object.entries(ARMS)) {
  const dir = freshCopy(k);
  arm.apply(dir);
  results[k] = { label: arm.label, ...measure(dir) };
  const r = results[k];
  console.log(`\n== ${arm.label}`);
  for (const scope of ['from12', 'from4']) {
    const t = r[scope].inf_trash;
    console.log(`   inf_trash ${scope.padEnd(7)} min gap ${t.min_gap_m} m   frames in strike ${t.frames_in_strike}   RUSH frames ${t.rush_frames}   RUSH<->APPROACH flips ${t.rush_approach_flips}`);
  }
  console.log(`   M3 dwell inf_trash ${r.m3.inf_trash}   worst over roster ${Math.max(...Object.values(r.m3))}`);
  console.log(`   roster min gaps from 12 m: ${Object.entries(r.from12).map(([i, v]) => `${i.slice(0, 10)} ${v.min_gap_m}`).join('  ')}`);
}

const dest = path.join(ROOT, 'reports/w1-12-r2-critic/closure-vs-recession.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify({ tool: 'critic-w1-12-r2-closure', threshold_mps: THRESH, scratch: SCRATCH, results }, null, 2));
console.log(`\nwrote ${path.relative(ROOT, dest)}`);
