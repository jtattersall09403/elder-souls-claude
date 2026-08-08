#!/usr/bin/env node
// W1-12 ROUND 2 — DELETE-THE-FIX (RULES 6), four arms, run on scratch copies of the tree.
//
// Rule 6 names three failure shapes and a fourth that is not a failure, and this tool is built to
// tell them apart rather than to produce a reassuring table:
//
//   * an INERT FIX      — the change does nothing and the measurement passes anyway.
//   * an INERT CONTROL  — the teardown does nothing, so both arms are the positive arm. THIS IS
//                         THE ONE THAT HAS COST THIS PROJECT A PUBLISHED NUMBER, so every arm
//                         below asserts that its own control moved, and the tool exits non-zero
//                         if one did not.
//   * an INERT FIX THAT IMPROVES THE NUMBER — the most dangerous. Round 2 shipped one and caught
//                         it: the closure window spanned frames the AI is not stepped, which
//                         inflated the measured recession threefold and made every enemy charge
//                         after every swing. It moved the headline the RIGHT way and broke M3.
//                         See the note in ai.js where the window is pushed.
//   * TWO GUARDS FOR ONE DEFECT — deleting either alone changes nothing. Arms B and E are exactly
//                         this pair and they are run as a 2x2 rather than singly, because
//                         reporting them one at a time would look like an inert fix.
//
// Each arm copies `game/` and `tools/` into the scratchpad and edits the copy. Nothing here ever
// writes to the repository tree, so a neighbour's `git add -A` cannot stage one of my temporary
// deletions (rule 17).
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SCRATCH = process.env.SCRATCH_DIR
  || path.join(os.tmpdir(), 'w1-12-r2-teardown');

function freshCopy(name) {
  const dir = path.join(SCRATCH, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const d of ['game', 'tools']) fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true });
  return dir;
}
const readAI = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'game/data/combat/ai.json'), 'utf8'));
const writeAI = (dir, o) => fs.writeFileSync(path.join(dir, 'game/data/combat/ai.json'), JSON.stringify(o, null, 2));

/** The three numbers every arm is judged on, measured in one child process on that arm's tree. */
const MEASURE = `
import { NodeArena, loadCombatData } from './tools/lib/combat-node.mjs';
import crypto from 'node:crypto';
const data = loadCombatData();
const IDS = ['inf_trash','guard_legion','drowned_lesser','drowned_greater','beast_slitherfang','champion_hist_marked','cst_sap_speaker'];
const om = (id) => { const s = data._enemies[id];
  const a = (data.ai.behaviour_archetype && data.ai.behaviour_archetype[id]) || s.archetype;
  return s.reach_m || data.ai.archetype[a].omega_m; };

// 1. THE HEADLINE — closest a legionary gets to a player walking away from 12 m.
function flee(id) {
  const arena = new NodeArena({ data, seed: 1337 });
  const b = arena.spawn('e1', id, 0, 12, 180);
  const ctl = arena.cs.enemies.get('e1'); const p = arena.player;
  // MIN GAP IS THE WRONG NUMBER ON ITS OWN and this arm proved it: deleting the CIRCLE half of
  // the closure rule moved inf_trash's min gap by 0.18 m, which reads as a nearly-inert clause.
  // The number that matters is HOW LONG THE ENEMY IS IN RANGE TO HIT YOU, and by that measure
  // the same deletion goes from 627 frames inside the strike band to 0. Both are returned.
  let min = Infinity, inStrike = 0;
  const O = om(id);
  const strike = data.ai.bands.strike * O;
  for (let i = 0; i < 1200; i++) {
    p.pos[0] = 0; p.pos[2] = -(i/60)*2.0;
    ctl.alert = 100; ctl.alertState = 'AGGRO'; arena.step();
    if (i > 30) { const d = Math.hypot(p.pos[0]-b.pos[0], p.pos[2]-b.pos[2]); min = Math.min(min, d); if (d <= strike) inStrike++; }
  }
  return { min, inStrike };
}
// 1b. The same, from 4 m — inside the DANCE band, where the CIRCLE half of the rule lives.
function flee4(id) {
  const arena = new NodeArena({ data, seed: 1337 });
  const b = arena.spawn('e1', id, 0, 4, 180);
  const ctl = arena.cs.enemies.get('e1'); const p = arena.player;
  const strike = data.ai.bands.strike * om(id);
  let inStrike = 0;
  for (let i = 0; i < 1200; i++) {
    p.pos[0] = 0; p.pos[2] = -(i/60)*2.0;
    ctl.alert = 100; ctl.alertState = 'AGGRO'; arena.step();
    if (i > 30 && Math.hypot(p.pos[0]-b.pos[0], p.pos[2]-b.pos[2]) <= strike) inStrike++;
  }
  return inStrike;
}
// 2. RI-AI01 M3's min_dist_dwell, on the round-1 fixture and seed.
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
  return nc.filter(r => r.d < data.ai.bands.strike*O).length / nc.length;
}
// 3. VARIETY — distinct 1800-frame trace hashes across the seven fighting statblocks.
function sigs() {
  const out = {};
  for (const id of IDS) {
    const arena = new NodeArena({ data, seed: 1337 });
    const b = arena.spawn('e1', id, 0, 5*om(id), 180);
    const ctl = arena.cs.enemies.get('e1'); const p = arena.player;
    const h = crypto.createHash('sha1');
    for (let i = 0; i < 1800; i++) {
      const s = (i/60)*1.6, t = (s/40)*Math.PI*2;
      p.pos[0] = 8*Math.sin(t); p.pos[2] = 4*Math.sin(2*t);
      ctl.alert = 100; ctl.alertState = 'AGGRO'; arena.step();
      h.update(\`\${ctl.ai?ctl.ai.state:b.state}|\${b.pos[0].toFixed(4)}|\${b.pos[2].toFixed(4)}|\${b.yaw.toFixed(3)}|\${b.move?b.move.id:'-'}\\n\`);
    }
    out[id] = h.digest('hex').slice(0,16);
  }
  return out;
}
// 4. Is anything moving at all? (the "turning statue" detector)
function alive() {
  const arena = new NodeArena({ data, seed: 1337 });
  const b = arena.spawn('e1', 'inf_trash', 0, 5*om('inf_trash'), 180);
  const ctl = arena.cs.enemies.get('e1'); const p = arena.player;
  const st = new Set(); let moved = 0, commits = 0, last = null;
  for (let i = 0; i < 1800; i++) {
    const s = (i/60)*1.6, t = (s/40)*Math.PI*2;
    p.pos[0] = 8*Math.sin(t); p.pos[2] = 4*Math.sin(2*t);
    ctl.alert = 100; ctl.alertState = 'AGGRO';
    const x0 = b.pos[0], z0 = b.pos[2];
    arena.step();
    st.add(ctl.ai ? ctl.ai.state : b.state);
    if (Math.hypot(b.pos[0]-x0, b.pos[2]-z0) > 1e-4) moved++;
    if (b.move && b.move.id !== last && b.move.kind === 'attack') commits++;
    last = b.move ? b.move.id : null;
  }
  return { states: [...st].sort(), moving_frames: moved, commits };
}
const hashes = sigs();
console.log(JSON.stringify({
  flee_min_gap_m: Object.fromEntries(IDS.map(id => [id, +flee(id).min.toFixed(3)])),
  flee_frames_inside_strike: Object.fromEntries(IDS.map(id => [id, flee(id).inStrike])),
  flee_from_4m_frames_inside_strike: Object.fromEntries(IDS.map(id => [id, flee4(id)])),
  m3_dwell: Object.fromEntries(IDS.map(id => [id, +dwell(id).toFixed(4)])),
  strike_band_m: Object.fromEntries(IDS.map(id => [id, +(data.ai.bands.strike*om(id)).toFixed(3)])),
  trace_hashes: hashes,
  distinct_traces: new Set(Object.values(hashes)).size,
  alive: alive(),
}));
`;

function measure(dir) {
  const f = path.join(dir, '_measure.mjs');
  fs.writeFileSync(f, MEASURE);
  const out = execFileSync('node', [f], { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out.trim().split('\n').pop());
}

/** Cut `noteAttackPhase`'s body, which is the whole of the RECOVER fix. */
function cutRecover(dir) {
  const p = path.join(dir, 'game/src/combat/ai.js');
  let s = fs.readFileSync(p, 'utf8');
  const needle = "    if (b.animFrame > b.move.startup + b.move.active) this._enter('RECOVER', frame);";
  if (!s.includes(needle)) throw new Error('teardown arm C: the RECOVER line is not where it was — refusing to report a control I did not apply.');
  s = s.replace(needle, '    return; // TEARDOWN ARM C: RECOVER deleted');
  // and put the retire back to accepting COMMIT only, as round 1 had it
  s = s.replace("    if (this.state !== 'COMMIT' && this.state !== 'RECOVER') return;", "    if (this.state !== 'COMMIT') return;");
  fs.writeFileSync(p, s);
}

const ARMS = {
  base: { label: 'AS SHIPPED', apply: () => {} },
  A: {
    label: 'A — delete the BEHAVIOUR (ai.json enabled:false)',
    apply: (dir) => { const ai = readAI(dir); ai.enabled = false; writeAI(dir, ai); },
    expect: 'every enemy collapses to a turning statue: no commits, no movement',
  },
  B: {
    label: 'B — delete the CLOSURE RULE (walk_in_min_closure_mps -> -1000)',
    apply: (dir) => { const ai = readAI(dir); ai.movement.walk_in_min_closure_mps = -1000; writeAI(dir, ai); },
    expect: 'the enemy cannot catch a walking player again — flee min gap returns to round 1',
  },
  C: {
    label: 'C — delete RECOVER (noteAttackPhase body)',
    apply: cutRecover,
    expect: 'M3 min_dist_dwell falls back to round 1s 0.04, because the recovery frames leave the denominator',
  },
  D: {
    label: 'D — delete the BEHAVIOUR ARCHETYPE table',
    apply: (dir) => { const ai = readAI(dir); ai.behaviour_archetype = {}; writeAI(dir, ai); },
    expect: 'the four INFANTRY statblocks collapse back to one bit-identical trace',
  },
  E: {
    label: 'E — delete only the CIRCLE half of the closure rule',
    apply: (dir) => {
      const p = path.join(dir, 'game/src/combat/ai.js');
      let s = fs.readFileSync(p, 'utf8');
      const needle = "        if (band === 'RUSH' || band === 'CLOSE' || this._targetIsLeaving(dx, dz, dist)) {";
      if (!s.includes(needle)) throw new Error('teardown arm E: the CIRCLE clause is not where it was.');
      fs.writeFileSync(p, s.replace(needle, "        if (band === 'RUSH' || band === 'CLOSE') {"));
    },
    expect: 'the enemy rushes in and then dances a departing player back out — the 2.9 m stall',
  },
  BE: {
    label: 'B+E — delete BOTH halves (the 2x2 fourth cell)',
    apply: (dir) => { ARMS.B.apply(dir); ARMS.E.apply(dir); },
    expect: 'the full round-1 behaviour',
  },
};

function main() {
  fs.mkdirSync(SCRATCH, { recursive: true });
  const results = {};
  for (const [k, arm] of Object.entries(ARMS)) {
    const dir = freshCopy(k);
    arm.apply(dir);
    results[k] = { label: arm.label, expect: arm.expect || null, ...measure(dir) };
    console.log(`\n== ${arm.label}`);
    console.log(`   flee min gap (inf_trash) ${results[k].flee_min_gap_m.inf_trash} m   strike band ${results[k].strike_band_m.inf_trash} m`);
    console.log(`   frames inside strike     ${results[k].flee_frames_inside_strike.inf_trash} from 12 m, ${results[k].flee_from_4m_frames_inside_strike.inf_trash} from 4 m`);
    console.log(`   M3 dwell (inf_trash)     ${results[k].m3_dwell.inf_trash}`);
    console.log(`   distinct traces / 7      ${results[k].distinct_traces}`);
    console.log(`   alive: ${results[k].alive.moving_frames} moving frames, ${results[k].alive.commits} commits, states ${results[k].alive.states.join(',')}`);
  }

  // ---- Every control must have MOVED. A control nobody has watched fail is not evidence.
  const base = results.base;
  const problems = [];
  const same = (a, b) => Math.abs(a - b) < 1e-9;
  if (results.A.alive.commits !== 0 || results.A.alive.moving_frames > 0) {
    problems.push('arm A did not collapse the enemy: the delete-the-behaviour control is inert, so nothing below is evidence.');
  }
  if (same(results.B.flee_min_gap_m.inf_trash, base.flee_min_gap_m.inf_trash)) {
    problems.push('arm B changed no flee number: the closure rule is inert OR the control is.');
  }
  if (same(results.C.m3_dwell.inf_trash, base.m3_dwell.inf_trash)) {
    problems.push('arm C changed no dwell: RECOVER is inert OR the control is.');
  }
  if (results.E.flee_from_4m_frames_inside_strike.inf_trash === base.flee_from_4m_frames_inside_strike.inf_trash) {
    problems.push('arm E changed nothing from 4 m: the CIRCLE half of the closure rule is inert OR the control is.');
  }
  if (results.D.distinct_traces >= base.distinct_traces) {
    problems.push('arm D did not reduce the distinct-trace count: the behaviour_archetype table is inert OR the control is.');
  }
  const out = { piece: 'W1-12-r2', scratch: SCRATCH, generated: new Date().toISOString().slice(0, 10), problems, results };
  const dest = path.join(ROOT, 'reports/w1-12-r2/teardown.json');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(`\nwrote ${dest}`);
  if (problems.length) { for (const p of problems) console.error(`CONTROL PROBLEM: ${p}`); process.exit(1); }
  console.log('all four controls moved. No arm is inert.');
}

main();
