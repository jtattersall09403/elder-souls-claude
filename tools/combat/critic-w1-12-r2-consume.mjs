#!/usr/bin/env node
// W1-12 round-2 CRITIC — CONSUMPTION (RI-MTH07 / ARBITRATION §3), the contested leaves only.
//
// The round published "99 leaves, 60 with a demonstrated consumer". Its own artifact
// (reports/w1-12-r2/rescue.json) publishes `rescued: 11` against `candidates: 36` and a
// `still_no_consumer` list of 25, which is 43 + 11 = 54 consumed, not 60. The six-leaf gap is
// entirely in the survey's §7 prose, which names ONE `commit.tokens_by_group` leaf as unverified
// where the artifact names SIX, and omits `leash.return_heal_seconds` altogether.
//
// So this does not re-run the whole census — it takes the leaves the two documents disagree
// about, plus every leaf either of them calls unconsumed, and drives each one against a fixture
// BUILT TO REACH THE STATE THAT LEAF GOVERNS, with a two-sided perturbation. A leaf is consumed
// here only if the enemy's per-frame trace changes.
//
// RULE 4. Two controls, asserted, and the tool exits non-zero if either comes out wrong:
//   must move     `circle.preferred_band_multiple` — where a circling enemy stands.
//   must not move `archetype.DUELIST.walk_mps` — a row no shipped statblock selects.
// Both are the round's own controls, so a disagreement is about the leaves and not about the
// instrument.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { NodeArena, loadCombatData } from '../lib/combat-node.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SEED = 1337;

const base = loadCombatData();
const clone = (o) => JSON.parse(JSON.stringify(o));

function setPath(obj, p, v) {
  const parts = p.replace(/\[(\d+)\]/g, '.$1').split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = v;
}
function getPath(obj, p) {
  const parts = p.replace(/\[(\d+)\]/g, '.$1').split('.');
  let o = obj;
  for (const k of parts) { if (o === undefined || o === null) return undefined; o = o[k]; }
  return o;
}

const omegaOf = (data, id) => {
  const s = data._enemies[id];
  const a = (data.ai.behaviour_archetype && data.ai.behaviour_archetype[id]) || s.archetype;
  return s.reach_m || data.ai.archetype[a].omega_m;
};

// ---------------------------------------------------------------------------------------------
// FIXTURES. Each returns a sha1 of a per-frame trace. Every one moves the player (rule 8).
// ---------------------------------------------------------------------------------------------

/** N bodies of one statblock sharing ONE encounter group — the token-arbitration fixture. */
function fxGroup(data, n, id, frames = 900) {
  const arena = new NodeArena({ data, seed: SEED, entityOf: () => ({ encounterId: 'g' }) });
  const ids = [];
  for (let k = 0; k < n; k++) { ids.push(`e${k}`); arena.spawn(`e${k}`, id, (k - (n - 1) / 2) * 2.0, 8, 180); }
  const ctls = ids.map((e) => arena.cs.enemies.get(e));
  const bodies = ids.map((e) => arena.cs.bodyOf(e));
  const p = arena.player;
  const h = crypto.createHash('sha1');
  for (let i = 0; i < frames; i++) {
    p.pos[0] = 2.6 * Math.sin(i / 140); p.pos[2] = 1.9 * Math.sin(i / 97 + 1.1);
    for (const c of ctls) { c.alert = 100; c.alertState = 'AGGRO'; }
    arena.step();
    // The thing §E is actually about: how many bodies are swinging at once, and who holds a token.
    h.update(`${ctls.filter((c) => c.ai && c.ai.state === 'COMMIT').length}|`
      + `${ctls.map((c) => (c.ai && c.ai.token ? 1 : 0)).join('')}|`
      + `${bodies.map((b) => b.pos[0].toFixed(3)).join(',')}\n`);
  }
  return h.digest('hex').slice(0, 16);
}

/** Aggro, then break away and let the body walk home and heal. The T26 fixture. */
function fxLeashHeal(data, id, frames = 2600) {
  const arena = new NodeArena({ data, seed: SEED });
  const b = arena.spawn('e1', id, 0, 6, 180);
  const ctl = arena.cs.enemies.get('e1');
  const p = arena.player;
  const h = crypto.createHash('sha1');
  b.hp = Math.round(b.hpMax * 0.4);                 // wounded, so the heal has something to do
  for (let i = 0; i < frames; i++) {
    p.pos[2] = Math.min(80, 6 + i * (5.0 / 60));
    if (i > 120) { ctl.alert = 0; ctl.alertState = 'IDLE'; } else { ctl.alert = 100; ctl.alertState = 'AGGRO'; }
    if (b.hp > b.hpMax * 0.4) { /* let it heal */ }
    arena.step();
    h.update(`${ctl.ai ? ctl.ai.state : b.state}|${b.hp.toFixed(3)}|${b.pos[2].toFixed(3)}\n`);
  }
  return h.digest('hex').slice(0, 16);
}

/** SUSPICIOUS raised and then dropped — the T03/T04 minimum-dwell fixture. */
function fxLadder(data, id, frames = 600) {
  const arena = new NodeArena({ data, seed: SEED });
  const b = arena.spawn('e1', id, 0, 10, 180);
  const ctl = arena.cs.enemies.get('e1');
  const p = arena.player;
  const h = crypto.createHash('sha1');
  for (let i = 0; i < frames; i++) {
    p.pos[0] = 1.5 * Math.sin(i / 90); p.pos[2] = 10 + 1.5 * Math.cos(i / 90);
    // 40 frames of SUSPICIOUS, then the meter falls away. The min dwell decides how long the
    // body keeps its head turned before it is allowed back to IDLE.
    if (i < 40) { ctl.alert = 60; ctl.alertState = 'SUSPICIOUS'; }
    else { ctl.alert = 0; ctl.alertState = 'IDLE'; }
    arena.step();
    h.update(`${ctl.ai ? ctl.ai.state : b.state}|${b.yaw.toFixed(3)}\n`);
  }
  return h.digest('hex').slice(0, 16);
}

/** A plain duel. The catch-all. */
function fxDuel(data, id, frames = 1800) {
  const arena = new NodeArena({ data, seed: SEED });
  const b = arena.spawn('e1', id, 0, 5 * omegaOf(data, id), 180);
  const ctl = arena.cs.enemies.get('e1');
  const p = arena.player;
  const h = crypto.createHash('sha1');
  for (let i = 0; i < frames; i++) {
    const t = ((i / 60) * 1.6 / 40) * Math.PI * 2;
    p.pos[0] = 8 * Math.sin(t); p.pos[2] = 4 * Math.sin(2 * t);
    ctl.alert = 100; ctl.alertState = 'AGGRO';
    arena.step();
    h.update(`${ctl.ai ? ctl.ai.state : b.state}|${b.pos[0].toFixed(4)}|${b.pos[2].toFixed(4)}|${b.yaw.toFixed(3)}|${b.move ? b.move.id : '-'}\n`);
  }
  return h.digest('hex').slice(0, 16);
}

const FX = {
  group2: (d) => fxGroup(d, 2, 'inf_trash'),
  group3: (d) => fxGroup(d, 3, 'inf_trash'),
  group4: (d) => fxGroup(d, 4, 'inf_trash'),
  group5: (d) => fxGroup(d, 5, 'inf_trash'),
  swarm5: (d) => fxGroup(d, 5, 'beast_slitherfang'),
  swarm6: (d) => fxGroup(d, 6, 'beast_slitherfang'),
  leashheal: (d) => fxLeashHeal(d, 'inf_trash'),
  ladder: (d) => fxLadder(d, 'inf_trash'),
  duel: (d) => fxDuel(d, 'inf_trash'),
  duelT: (d) => fxDuel(d, 'guard_legion'),
  duelA: (d) => fxDuel(d, 'drowned_lesser'),
};

// ---------------------------------------------------------------------------------------------
// THE LEAVES. Two-sided where a threshold could already be satisfied, and routed to the fixture
// that reaches the state the leaf governs.
// ---------------------------------------------------------------------------------------------
const CASES = [
  // --- controls (rule 4) ---------------------------------------------------------------------
  { path: 'circle.preferred_band_multiple', variants: [3.2, 0.8], fx: ['duel'], control: 'must_move' },
  { path: 'archetype.DUELIST.walk_mps', variants: [5, 0.5], fx: ['duel', 'group5', 'swarm5'], control: 'must_not_move' },

  // --- the six the survey and the artifact disagree about --------------------------------------
  { path: 'commit.tokens_by_group[0].max_size', variants: [1, 99], fx: ['group2', 'group3', 'group4', 'group5'] },
  { path: 'commit.tokens_by_group[0].tokens', variants: [0, 3], fx: ['group2', 'group3', 'group4', 'group5'] },
  { path: 'commit.tokens_by_group[1].max_size', variants: [2, 99], fx: ['group2', 'group3', 'group4', 'group5'] },
  { path: 'commit.tokens_by_group[1].tokens', variants: [0, 4], fx: ['group3', 'group4', 'group5'] },
  { path: 'commit.tokens_by_group[2].max_size', variants: [4, 999], fx: ['group4', 'group5', 'swarm5', 'swarm6'] },
  { path: 'commit.tokens_by_group[2].tokens', variants: [0, 6], fx: ['group5', 'swarm5', 'swarm6'] },
  { path: 'leash.return_heal_seconds', variants: [40, 0.5], fx: ['leashheal'] },

  // --- the ones both documents call unconsumed --------------------------------------------------
  { path: 'commit.swarm_max_omega_m', variants: [1.0, 99], fx: ['swarm5', 'swarm6', 'group5'] },
  { path: 'commit.swarm_tokens_at_5_plus', variants: [0, 9], fx: ['swarm5', 'swarm6'] },
  { path: 'perception.suspicious_min_dwell_f', variants: [1, 400], fx: ['ladder'] },
  { path: 'movement.max_yaw_rate_active_dps', variants: [300, -1], fx: ['duel', 'duelT'] },
  { path: 'leash.hard_m.elite', variants: [4, 4000], fx: ['duel', 'leashheal'] },
  { path: 'commit.tokens_when_elite_present', variants: [0, 5], fx: ['group4', 'group5'] },

  // --- a sample of the twenty "declared unrealised archetype row" leaves ------------------------
  { path: 'archetype.DUELIST.sprint_mps', variants: [0.1, 20], fx: ['duel', 'group5'] },
  { path: 'archetype.DUELIST.omega_m', variants: [0.5, 20], fx: ['duel', 'group5'] },
  { path: 'archetype.RANGED.walk_mps', variants: [0.1, 20], fx: ['duel', 'group5'] },
  { path: 'archetype.RANGED.prefers_band', variants: ['dance', 'strike'], fx: ['duel', 'group5'] },
  { path: 'archetype.SWARM.walk_mps', variants: [0.1, 20], fx: ['duel', 'swarm5'] },
  { path: 'archetype.SWARM.omega_m', variants: [0.5, 20], fx: ['duel', 'swarm5'] },

  // --- a sample of the fourteen "shadowed by the statblock" leaves ------------------------------
  { path: 'archetype.INFANTRY.omega_m', variants: [0.5, 20], fx: ['duel'] },
  { path: 'archetype.INFANTRY.sight_r_m', variants: [1, 200], fx: ['duel', 'leashheal'] },
  { path: 'archetype.AMBUSHER.sight_r_m', variants: [1, 200], fx: ['duelA', 'leashheal'] },
];

const wantedFx = new Set(CASES.flatMap((c) => c.fx));
const baseline = {};
for (const f of wantedFx) baseline[f] = FX[f](base);

const results = [];
for (const c of CASES) {
  const before = getPath(base.ai, c.path);
  const moved = [];
  for (const v of c.variants) {
    const d = { ...base, ai: clone(base.ai) };
    setPath(d.ai, c.path, v);
    for (const f of c.fx) {
      if (FX[f](d) !== baseline[f]) moved.push(`${f}:=${JSON.stringify(v)}`);
    }
  }
  results.push({ path: c.path, value: before, control: c.control || null, fixtures: c.fx, consumed: moved.length > 0, moved_in: moved });
  console.log(`${moved.length ? 'CONSUMED  ' : 'no reader '} ${c.path.padEnd(42)} ${JSON.stringify(before)}`
    + `  ->  ${moved.length ? moved.join(' ') : `silent in ${c.fx.join(',')}`}`);
}

const dest = path.join(ROOT, 'reports/w1-12-r2-critic/consumption.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify({ tool: 'critic-w1-12-r2-consume', seed: SEED, baseline, results }, null, 2));
console.log(`\nwrote ${path.relative(ROOT, dest)}`);

const mustMove = results.find((r) => r.control === 'must_move');
const mustNot = results.find((r) => r.control === 'must_not_move');
const problems = [];
if (!mustMove.consumed) problems.push('CONTROL FAILED: circle.preferred_band_multiple did not move the trace, so this instrument cannot see a consumed leaf and no "no reader" line below is evidence (RULES 4).');
if (mustNot.consumed) problems.push('CONTROL FAILED: archetype.DUELIST.walk_mps — a row no shipped statblock selects — moved the trace, so the fixture is sensitive to something other than the leaf.');
if (problems.length) { for (const p of problems) console.error(p); process.exit(1); }
console.log('both controls behaved: the must-move leaf moved and the must-not-move leaf did not.');
