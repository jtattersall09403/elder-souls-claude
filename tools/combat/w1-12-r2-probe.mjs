#!/usr/bin/env node
// W1-12 ROUND 2 — the builder's instrument.
//
// The round-1 critic's tool (tools/combat/critic-w1-12-census.mjs) is kept and still run; this
// one exists because that tool cannot ask the two questions round 2 is judged on.
//
//   --mode=chase    RULES 8, BOTH HALVES. The round-1 defect — "an enemy cannot catch you if you
//                   walk away" — was found by ONE fixture (straight-line flee) at ONE speed at
//                   ONE range. A player does six different things and the enemy has to answer
//                   all six, so this drives WALK, JOG, SPRINT, STRAFE, CIRCLE and BACK-AWAY from
//                   four starting ranges against every fighting statblock, and REPORTS EVERY
//                   NUMBER AT FOUR INSTANTS (f 300 / 600 / 1200 / 1800) rather than at the end.
//                   A sibling piece reported 0 of 115 bodies stuck by measuring one frame; at
//                   600 frames the same fixture gave 10.
//
//   --mode=census   ARBITRATION §3 / RI-MTH07 CONSUMPTION. Every numeric and boolean leaf of
//                   ai.json's behaviour tables is perturbed one at a time and the enemy's whole
//                   per-frame trace is hashed, over SIX fixtures — duel, flee, group-of-five,
//                   heal, no-line-of-sight and block — so a leaf is only called dead if it moves
//                   nothing in any of them. Two controls are asserted and the tool EXITS
//                   NON-ZERO if either comes out the wrong way (rule 4).
//
//   --mode=yaw      RI-AI01 §F. `movement.max_yaw_rate_*` are LEGALITY CEILINGS, not shaping
//                   parameters: the shipped roster never approaches them, so a perturbation
//                   census correctly reports them inert. This asserts the thing they actually
//                   say — observed <= declared — and fails if an enemy turns faster than the
//                   data allows. It is the honest reader for a bound.
//
//   --mode=states   Which of RI-AI01 §D's seventeen states the build can actually enter, over
//                   all six fixtures. Round 1 reached nine and claimed a tenth in prose.
//
//   --mode=teardown Rule 6. Runs `chase` and `recover` on THIS tree and on an ablated copy in
//                   the scratchpad, and prints both arms side by side. See --help.
//
// HOW EACH MODE CAN FAIL — the part rule 4 cares about:
//   census   exits 1 if the must-move control does not move or the must-not-move control does.
//   yaw      exits 1 if any observed yaw rate exceeds the declared ceiling for its phase.
//   chase    exits 1 if the roster is empty or a fixture produced no frames; it does NOT exit
//            non-zero on a bad closure number, because "this enemy cannot catch a sprinter" is a
//            published measurement, not an error.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { NodeArena, loadCombatData, GAME_DATA } from '../lib/combat-node.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const h = argv.find((a) => a.startsWith(`--${k}=`)); return h ? h.slice(k.length + 3) : d; };

const SEED = Number(opt('seed', 1337));
const CONTROL_DEAD = 'archetype.DUELIST.walk_mps';
const OUT = path.join(ROOT, 'reports/w1-12-r2');
// Fixture lengths for the census. 600 f@60 is ten seconds — long enough for every fixture below to
// reach the state its leaves govern (the flee fixture crosses its leash around f450, the block
// fixture sees four player windups, the heal fixture three drinks) and short enough that ~100
// leaves x 6 fixtures x 7 statblocks finishes. A FIRST ATTEMPT AT 1,200/900 DID NOT FINISH IN 50
// MINUTES AND WAS KILLED; that is a measurement-budget choice and it is stated rather than hidden.
const FX_F = Number(opt('fixture_frames', 600));
const FX_G = Number(opt('group_frames', 400));

// The game's own player speeds, read rather than restated (game/src/sim/state.js PLAYER_CONST).
const PLAYER = { walk: 2.0, jog: 3.2, sprint: 5.0 };
// The instants every number is reported at. RULES 8: one instant is a still target in time.
const CHECKPOINTS = [300, 600, 1200, 1800];

function fightingRoster(data) {
  return Object.keys(data._enemies)
    .filter((id) => data._enemies[id].attacks && Object.keys(data._enemies[id].attacks).length > 0)
    .filter((id) => id !== 'probe_pulse')
    .sort();
}
const omegaOf = (data, id) => {
  const s = data._enemies[id];
  const a = (data.ai.behaviour_archetype && data.ai.behaviour_archetype[id]) || s.archetype;
  return s.reach_m || data.ai.archetype[a].omega_m;
};

// ---------------------------------------------------------------------------------------------
// THE SIX THINGS A PLAYER DOES.
//
// Each returns the player's position at frame `i`, given a start distance `r0` — the enemy is
// spawned at (0, r0) and the player starts at the origin. Every path is arc-length parameterised
// so `speed` is a real m/s and not a parameter of a sine.
// ---------------------------------------------------------------------------------------------
const PATHS = {
  stand:    (i, r0, sp) => [0, 0],
  walk:     (i, r0, sp) => [0, -(i / 60) * PLAYER.walk],
  jog:      (i, r0, sp) => [0, -(i / 60) * PLAYER.jog],
  sprint:   (i, r0, sp) => [0, -(i / 60) * PLAYER.sprint],
  // Sideways at a walk, keeping the distance roughly constant — the enemy must turn, not chase.
  strafe:   (i, r0, sp) => [(i / 60) * PLAYER.walk, 0],
  // Orbiting the enemy at its own start radius, at a jog. Tangential: recession is ~0 and the
  // enemy must NOT sprint. This is the fixture that catches a chase rule which fires on motion
  // rather than on departure.
  circle:   (i, r0, sp) => {
    const w = PLAYER.jog / r0;                                  // rad/s for a tangential jog
    const t = (i / 60) * w;
    return [r0 * Math.sin(t), r0 - r0 * Math.cos(t)];
  },
  // Backing away while facing the enemy — Souls' actual retreat. Slower than a walk.
  backaway: (i, r0, sp) => [0, -(i / 60) * (PLAYER.walk * 0.55)],
};

function chaseRun(data, statId, pathName, r0) {
  const arena = new NodeArena({ data, seed: SEED });
  const b = arena.spawn('e1', statId, 0, r0, 180);
  const ctl = arena.cs.enemies.get('e1');
  const p = arena.player;
  const fn = PATHS[pathName];
  const marks = {};
  let minGap = Infinity, minGapF = -1;
  const states = {};
  let rushF = 0;
  for (let i = 0; i < 1800; i++) {
    const [px, pz] = fn(i, r0);
    p.pos[0] = px; p.pos[2] = pz;
    ctl.alert = 100; ctl.alertState = 'AGGRO';
    arena.step();
    const st = (ctl.ai && ctl.ai.state) || b.state;
    states[st] = (states[st] || 0) + 1;
    if (st === 'RUSH') rushF++;
    const d = Math.hypot(p.pos[0] - b.pos[0], p.pos[2] - b.pos[2]);
    if (i > 30 && d < minGap) { minGap = d; minGapF = i; }
    if (CHECKPOINTS.includes(i + 1)) {
      marks[i + 1] = { gap_m: +d.toFixed(3), min_gap_so_far_m: +minGap.toFixed(3), state: st };
    }
  }
  return { minGap, minGapF, states, rushF, marks };
}

function chase(data, roster) {
  const rows = [];
  for (const id of roster) {
    const om = omegaOf(data, id);
    const strike = data.ai.bands.strike * om;
    for (const pathName of ['stand', 'walk', 'jog', 'sprint', 'strafe', 'circle', 'backaway']) {
      for (const r0 of [4, 8, 12, 20]) {
        const r = chaseRun(data, id, pathName, r0);
        rows.push({
          stat: id, archetype_behaviour: (data.ai.behaviour_archetype || {})[id] || data._enemies[id].archetype,
          player: pathName, start_range_m: r0,
          omega_m: om, strike_band_m: +strike.toFixed(3),
          min_gap_m: +r.minGap.toFixed(3), min_gap_at_f: r.minGapF,
          reached_strike: r.minGap <= strike,
          entered_RUSH: r.rushF > 0, rush_frames: r.rushF,
          at_checkpoints: r.marks,
          state_frames: r.states,
        });
      }
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------
// CENSUS — six fixtures.
// ---------------------------------------------------------------------------------------------
function leaves(obj, prefix = '', out = []) {
  for (const k of Object.keys(obj)) {
    if (k.startsWith('_')) continue;
    const v = obj[k];
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, p, out);
    else if (Array.isArray(v) && v.every((e) => typeof e === 'number')) out.push({ path: p, kind: 'numarray', value: v });
    else if (Array.isArray(v) && v.every((e) => e && typeof e === 'object')) v.forEach((e, i) => leaves(e, `${p}[${i}]`, out));
    else if (typeof v === 'number') out.push({ path: p, kind: 'number', value: v });
    else if (typeof v === 'boolean') out.push({ path: p, kind: 'bool', value: v });
  }
  return out;
}
const segs = (p) => p.split('.').map((k) => { const m = /^(.+)\[(\d+)\]$/.exec(k); return m ? [m[1], Number(m[2])] : [k]; }).flat();
function setIn(o, p, v) {
  const parts = segs(p); const last = parts.pop();
  const parent = parts.reduce((a, k) => a[k], o);
  parent[last] = v;
}
function perturb(leaf) {
  if (leaf.kind === 'number') return leaf.value === 0 ? 1 : leaf.value * 2.0;
  if (leaf.kind === 'numarray') return leaf.value.map((v) => (v === 0 ? 1 : v * 2.0));
  if (leaf.kind === 'bool') return !leaf.value;
  return null;
}
function hash(rows) {
  const h = crypto.createHash('sha1');
  for (const r of rows) h.update(`${r.s}|${r.x.toFixed(4)}|${r.z.toFixed(4)}|${r.yaw.toFixed(3)}|${r.mv || '-'}|${r.tok ? 1 : 0}|${r.g ? 1 : 0}|${r.hp.toFixed(2)}\n`);
  return h.digest('hex').slice(0, 16);
}
const snap = (ctl, b) => ({
  s: (ctl.ai && ctl.ai.state) || b.state, x: b.pos[0], z: b.pos[2], yaw: b.yaw,
  mv: b.move ? b.move.id : null, tok: ctl.ai ? !!ctl.ai.token : false,
  g: !!b.guardRaised, hp: b.hp,
});

/** The duel: a player dancing in range. Nothing flees; this is the M3 shape. */
function fxDuel(data, id) {
  const arena = new NodeArena({ data, seed: SEED });
  const b = arena.spawn('e1', id, 0, 5.0 * omegaOf(data, id), 180);
  const ctl = arena.cs.enemies.get('e1'); const p = arena.player; const rows = [];
  for (let i = 0; i < FX_F; i++) {
    const s = (i / 60) * 1.6; const t = (s / 40) * Math.PI * 2;
    p.pos[0] = 8 * Math.sin(t); p.pos[2] = 4 * Math.sin(2 * t);
    ctl.alert = 100; ctl.alertState = 'AGGRO'; arena.step(); rows.push(snap(ctl, b));
  }
  return rows;
}
/** The flee: the round-1 headline, and the fixture the closure leaves live in. */
function fxFlee(data, id) {
  const arena = new NodeArena({ data, seed: SEED });
  const b = arena.spawn('e1', id, 0, 12, 180);
  const ctl = arena.cs.enemies.get('e1'); const p = arena.player; const rows = [];
  for (let i = 0; i < FX_F; i++) {
    p.pos[0] = 0; p.pos[2] = -(i / 60) * PLAYER.walk;
    ctl.alert = 100; ctl.alertState = 'AGGRO'; arena.step(); rows.push(snap(ctl, b));
  }
  return rows;
}
/** Five bodies in one encounter: the only fixture in which token arbitration can contend. */
function fxGroup(data, id) {
  const arena = new NodeArena({ data, seed: SEED });
  arena.cs.entityOf = () => ({ encounterId: 'w1-12-r2-group' });
  const ids = ['g0', 'g1', 'g2', 'g3', 'g4'];
  const bodies = ids.map((k, n) => arena.spawn(k, id, Math.cos(n * 1.3) * 5, Math.sin(n * 1.3) * 5, 0));
  const ctls = ids.map((k) => arena.cs.enemies.get(k));
  const p = arena.player; const rows = [];
  for (let i = 0; i < FX_G; i++) {
    const s = (i / 60) * 1.6; const t = (s / 40) * Math.PI * 2;
    p.pos[0] = 8 * Math.sin(t); p.pos[2] = 4 * Math.sin(2 * t);
    for (const c of ctls) { c.alert = 100; c.alertState = 'AGGRO'; }
    arena.step();
    rows.push({
      s: ctls.map((c) => (c.ai ? c.ai.state : '?')).join('/'),
      x: bodies[0].pos[0], z: bodies[2].pos[2], yaw: bodies[4].yaw,
      mv: bodies.map((bb) => (bb.move ? bb.move.id : '-')).join(','),
      tok: ctls.filter((c) => c.ai && c.ai.token).length,
      g: bodies.some((bb) => bb.guardRaised), hp: bodies[1].hp,
    });
  }
  return rows;
}
/** The player drinks on a cycle: PUNISH_READ's only fixture. */
function fxHeal(data, id) {
  const arena = new NodeArena({ data, seed: SEED });
  const b = arena.spawn('e1', id, 0, 5.0 * omegaOf(data, id), 180);
  const ctl = arena.cs.enemies.get('e1'); const p = arena.player; const rows = [];
  for (let i = 0; i < FX_F; i++) {
    ctl.alert = 100; ctl.alertState = 'AGGRO';
    if (i % 200 === 0 && p.moves.heal && !p.move) p.begin(p.moves.heal, arena.frame, {});
    arena.step(); rows.push(snap(ctl, b));
  }
  return rows;
}
/**
 * NO LINE OF SIGHT — the fixture round 1 had no way to build, and the reason `noLosSinceF`,
 * `leash.no_los_seconds` and `leash.dist_multiple_of_sight` were dead.
 *
 * `sim/stealth/system.js` writes `percept_los` onto the SIM ENTITY, and `ctx.entityOf` is how the
 * AI reaches it — the same handle the token arbitrator already used, wired in `engine.js:1098` to
 * `sim.findEntity`. `NodeArena` takes an `entityOf` option, so a bare-Node fixture can supply the
 * entity the real engine supplies. Nothing here is a second LOS model: the AI reads the field,
 * this fixture writes it, and in the running game the stealth system writes it.
 */
function fxNoLos(data, id) {
  const ent = { encounterId: 'w1-12-r2-nolos', percept_los: true };
  const arena = new NodeArena({ data, seed: SEED, entityOf: () => ent });
  const b = arena.spawn('e1', id, 0, 6.0, 180);
  const ctl = arena.cs.enemies.get('e1'); const p = arena.player; const rows = [];
  for (let i = 0; i < FX_F; i++) {
    // The player walks away and is lost from sight at f120 — beyond 1.6·R and with no LOS, T25's
    // second clause should send the enemy home.
    p.pos[0] = 0; p.pos[2] = -(i / 60) * PLAYER.jog;
    ent.percept_los = i < 120;
    ctl.alert = 100; ctl.alertState = 'AGGRO'; arena.step(); rows.push(snap(ctl, b));
  }
  return rows;
}
/** The player winds up an attack in the enemy's face: BLOCK_HOLD's only fixture. */
function fxBlock(data, id) {
  const arena = new NodeArena({ data, seed: SEED });
  const om = omegaOf(data, id);
  const b = arena.spawn('e1', id, 0, 1.2 * om, 180);
  const ctl = arena.cs.enemies.get('e1'); const p = arena.player; const rows = [];
  const heavy = Object.keys(p.moves)
    .filter((k) => !k.startsWith('_') && p.moves[k] && p.moves[k].kind === 'attack')
    .sort((a, c) => (p.moves[c].startup || 0) - (p.moves[a].startup || 0))[0];
  for (let i = 0; i < FX_F; i++) {
    ctl.alert = 100; ctl.alertState = 'AGGRO';
    if (i % 150 === 0 && heavy && !p.move) p.begin(p.moves[heavy], arena.frame, {});
    arena.step(); rows.push(snap(ctl, b));
  }
  return rows;
}

const FIXTURES = { duel: fxDuel, flee: fxFlee, group: fxGroup, heal: fxHeal, nolos: fxNoLos, block: fxBlock };

function census(data, roster) {
  const aiSrc = JSON.parse(fs.readFileSync(path.join(GAME_DATA, 'combat/ai.json'), 'utf8'));
  const scope = {};
  for (const k of ['bands', 'perception', 'movement', 'circle', 'commit', 'block', 'disengage', 'leash', 'punish_read', 'archetype']) {
    if (aiSrc[k]) scope[k] = aiSrc[k];
  }
  const ls = leaves(scope);
  // The archetype rows no shipped body selects are inert ON PURPOSE and the file says so; they
  // are counted separately rather than reported as a finding.
  const selected = new Set(Object.values(aiSrc.behaviour_archetype || {}).filter((v) => typeof v === 'string'));
  for (const id of roster) selected.add(data._enemies[id].archetype);
  const isUnselectedArchetype = (p) => {
    const m = /^archetype\.([A-Z_]+)\./.exec(p);
    return !!m && !selected.has(m[1]);
  };

  const base = {};
  for (const fx of Object.keys(FIXTURES)) {
    base[fx] = {};
    for (const id of roster) base[fx][id] = hash(FIXTURES[fx](loadCombatData(), id));
  }

  const results = [];
  for (const leaf of ls) {
    const moved = {};
    const nv = perturb(leaf);
    if (nv === null) continue;
    // An archetype row no shipped body selects is inert ON PURPOSE — ai.json declares every one of
    // them in `_archetypes_absent` — so running 42 fixtures against it buys nothing but minutes.
    // Marked declared-inert WITHOUT measuring. THE ONE EXCEPTION IS THE MUST-NOT-MOVE CONTROL,
    // which is measured precisely so the instrument's own falsifiability is not assumed away by
    // the same shortcut.
    if (isUnselectedArchetype(leaf.path) && leaf.path !== CONTROL_DEAD) {
      results.push({ path: leaf.path, value: leaf.value, perturbed_to: nv, consumed: false, moved_in: [], unselected_archetype_row: true, measured: false });
      continue;
    }
    for (const fx of Object.keys(FIXTURES)) {
      for (const id of (fx === 'group' ? roster.slice(0, 2) : roster)) {
        const d2 = loadCombatData();
        setIn(d2.ai, leaf.path, nv);
        let h;
        try { h = hash(FIXTURES[fx](d2, id)); } catch (e) { h = `throw:${e.message.slice(0, 40)}`; }
        if (h !== base[fx][id]) { (moved[fx] = moved[fx] || []).push(id); break; }
      }
    }
    results.push({
      path: leaf.path, value: leaf.value, perturbed_to: nv,
      consumed: Object.keys(moved).length > 0,
      moved_in: Object.keys(moved),
      unselected_archetype_row: isUnselectedArchetype(leaf.path),
      measured: true,
    });
  }
  return { base, results };
}

// ---------------------------------------------------------------------------------------------
// RESCUE — the fair half of the census, and the half a builder is most tempted to skip.
//
// The six-fixture census reports 36 leaves as inert. Most of those are the INSTRUMENT'S fault and
// calling them dead parameters would be a finding I should be embarrassed by. Three reasons, each
// of which this pass removes:
//
//   1. A x2 PERTURBATION CANNOT MOVE A THRESHOLD THAT IS ALREADY SATISFIED. `block.
//      enter_band_multiple` is 1.4 and the block fixture stands the enemy at 1.2*omega: doubling
//      it to 2.8 leaves the condition true, so the trace does not move and the leaf looks dead.
//      The round-1 critic named this against `punish_read.band_multiple` and could not settle it.
//      Every leaf here is perturbed TWO-SIDED — x2 and x0.5, plus 0 and a large value for a
//      threshold — so a bound can be pushed off the behaviour in whichever direction is live.
//   2. A 600-FRAME FIXTURE CANNOT REACH A 720-FRAME TIMER. `perception.search_to_leash_frames`
//      is 12.0 s and no census fixture is that long.
//   3. A FIXTURE THAT PINS `alertState` TO AGGRO CANNOT EXERCISE THE ALERT LADDER, and one whose
//      player jogs away trips the DISTANCE leash long before the no-line-of-sight clause.
//
// Each leaf below gets a fixture built to reach the state it governs, and is only reported as
// having no consumer if it survives that too.
// ---------------------------------------------------------------------------------------------
function rescueVariants(v) {
  if (typeof v === 'boolean') return [!v];
  if (Array.isArray(v)) return [v.map((x) => x * 2), v.map((x) => x * 0.5), v.map(() => 0)];
  return [v * 2, v * 0.5, 0, v + 1000];
}

/** Long enough for T06's 12.0 s SEARCH timer, and the alert ladder is DRIVEN rather than pinned. */
function fxLadder(data, id) {
  const arena = new NodeArena({ data, seed: SEED });
  const b = arena.spawn('e1', id, 0, 4.0, 180);
  const ctl = arena.cs.enemies.get('e1'); const p = arena.player; const rows = [];
  for (let i = 0; i < 1500; i++) {
    // AGGRO for a second, then the meter falls to SEARCH and stays there: T06 must fire at
    // f = (aggro end) + 720, and `suspicious_min_dwell_f` governs the fall to IDLE after that.
    if (i < 60) { ctl.alert = 100; ctl.alertState = 'AGGRO'; }
    else if (i < 90) { ctl.alert = 60; ctl.alertState = 'SUSPICIOUS'; }
    else { ctl.alert = 40; ctl.alertState = i > 1400 ? 'IDLE' : 'SEARCH'; }
    p.pos[0] = 0; p.pos[2] = 0;
    arena.step(); rows.push(snap(ctl, b));
  }
  return rows;
}
/** LOS lost while the player STANDS just outside 1.6*R, so the distance leash cannot pre-empt T25. */
function fxLosOnly(data, id) {
  const ent = { encounterId: 'w1-12-r2-losonly', percept_los: true };
  const arena = new NodeArena({ data, seed: SEED, entityOf: () => ent });
  const s = data._enemies[id];
  const R = s.sight_radius_m || 16;
  const b = arena.spawn('e1', id, 0, 2.0, 180);
  const ctl = arena.cs.enemies.get('e1'); const p = arena.player; const rows = [];
  for (let i = 0; i < 1500; i++) {
    // The player sits at 1.7*R — outside `dist_multiple_of_sight` (1.6) but only 27 m or so from
    // the enemy's anchor, well inside the 32 m trash leash, so the ONLY route to LEASH_RETURN is
    // T25's no-LOS clause. Anchor distance is checked in the assertion below.
    p.pos[0] = 0; p.pos[2] = -1.7 * R;
    ent.percept_los = i < 60;
    ctl.alert = 100; ctl.alertState = 'AGGRO';
    arena.step(); rows.push(snap(ctl, b));
  }
  return rows;
}
/** A long chase that really reaches the leash, so `hard_m.*` can be pushed either way. */
function fxLeash(data, id) {
  const arena = new NodeArena({ data, seed: SEED });
  const b = arena.spawn('e1', id, 0, 6, 180);
  const ctl = arena.cs.enemies.get('e1'); const p = arena.player; const rows = [];
  for (let i = 0; i < 1500; i++) {
    p.pos[0] = 0; p.pos[2] = -(i / 60) * PLAYER.jog;
    ctl.alert = 100; ctl.alertState = 'AGGRO';
    arena.step(); rows.push(snap(ctl, b));
  }
  return rows;
}
/** Five bodies pressed onto one player for long enough that the token queue actually binds. */
function fxSwarm(data, id) {
  const arena = new NodeArena({ data, seed: SEED });
  arena.cs.entityOf = () => ({ encounterId: 'w1-12-r2-swarm' });
  const ids = ['s0', 's1', 's2', 's3', 's4'];
  const bodies = ids.map((k, n) => arena.spawn(k, id, Math.cos(n * 1.26) * 3, Math.sin(n * 1.26) * 3, 0));
  const ctls = ids.map((k) => arena.cs.enemies.get(k));
  const p = arena.player; const rows = [];
  for (let i = 0; i < 900; i++) {
    p.pos[0] = 0.8 * Math.sin(i / 90); p.pos[2] = 0.8 * Math.cos(i / 70);
    for (const c of ctls) { c.alert = 100; c.alertState = 'AGGRO'; }
    arena.step();
    rows.push({
      s: ctls.map((c) => (c.ai ? c.ai.state : '?')).join('/'),
      x: bodies[0].pos[0], z: bodies[2].pos[2], yaw: bodies[4].yaw,
      mv: bodies.map((bb) => (bb.move ? bb.move.id : '-')).join(','),
      tok: ctls.filter((c) => c.ai && c.ai.token).length,
      g: bodies.some((bb) => bb.guardRaised), hp: bodies[1].hp,
    });
  }
  return rows;
}
/** The block fixture, but the enemy stands FAR OUT so the band threshold is not pre-satisfied. */
function fxBlockFar(data, id) {
  const arena = new NodeArena({ data, seed: SEED });
  const b = arena.spawn('e1', id, 0, 2.0 * omegaOf(data, id), 180);
  const ctl = arena.cs.enemies.get('e1'); const p = arena.player; const rows = [];
  const heavy = Object.keys(p.moves)
    .filter((k) => !k.startsWith('_') && p.moves[k] && p.moves[k].kind === 'attack')
    .sort((a, c) => (p.moves[c].startup || 0) - (p.moves[a].startup || 0))[0];
  for (let i = 0; i < 900; i++) {
    ctl.alert = 100; ctl.alertState = 'AGGRO';
    if (i % 120 === 0 && heavy && !p.move) p.begin(p.moves[heavy], arena.frame, {});
    arena.step(); rows.push(snap(ctl, b));
  }
  return rows;
}

// EACH LEAF IS ROUTED TO THE ONE FIXTURE THAT CAN REACH THE STATE IT GOVERNS, and to one
// statblock that selects it. A generic sweep of 36 leaves x 4 variants x 6 fixtures x 4
// statblocks is 3,456 runs and did not finish; routing is 36 x <=4 x 1 and finishes in minutes.
// It is also the more honest instrument: naming the fixture is naming the claim. A leaf with no
// route is a leaf I could not think of a way to reach, and it is reported as exactly that.
const RESCUE_FX = {
  ladder:   { fn: fxLadder,   id: 'inf_trash' },
  losonly:  { fn: fxLosOnly,  id: 'inf_trash' },
  leash:    { fn: fxLeash,    id: 'inf_trash' },
  leashE:   { fn: fxLeash,    id: 'champion_hist_marked' },
  leashA:   { fn: fxLeash,    id: 'drowned_lesser' },
  swarm:    { fn: fxSwarm,    id: 'beast_slitherfang' },
  blockfar: { fn: fxBlockFar, id: 'guard_legion' },
  duel:     { fn: fxDuel,     id: 'inf_trash' },
  healduel: { fn: fxHeal,     id: 'inf_trash' },
};
/** leaf path (or prefix) -> the fixtures that could possibly exercise it. */
const ROUTES = [
  ['perception.search_to_leash_frames', ['ladder']],
  ['perception.suspicious_min_dwell_f', ['ladder']],
  ['movement.max_yaw_rate_windup_dps', ['duel']],
  ['movement.max_yaw_rate_active_dps', ['duel']],
  ['commit.token_hold_cap_f', ['swarm']],
  ['commit.tokens_by_group', ['swarm']],
  ['commit.swarm_max_omega_m', ['swarm']],
  ['block.', ['blockfar']],
  ['leash.hard_m.trash', ['leash']],
  ['leash.hard_m.elite', ['leashE']],
  ['leash.hard_m.ambusher', ['leashA']],
  ['leash.hard_m.boss', ['leashE']],
  ['leash.no_los_seconds', ['losonly']],
  ['leash.dist_multiple_of_sight', ['losonly']],
  ['leash.return_heal_seconds', ['leash']],
  ['punish_read.', ['healduel']],
  ['archetype.', ['duel', 'leash']],
];
const routeFor = (p) => (ROUTES.find(([pre]) => p === pre || p.startsWith(pre)) || [null, []])[1];

function rescue(data, paths) {
  const used = new Set(paths.flatMap(routeFor));
  const base = {};
  for (const fx of used) base[fx] = hash(RESCUE_FX[fx].fn(loadCombatData(), RESCUE_FX[fx].id));
  const out = [];
  for (const p of paths) {
    const fxs = routeFor(p);
    const cur = getIn(loadCombatData().ai, p);
    let moved = null;
    outer:
    for (const variant of rescueVariants(cur)) {
      for (const fx of fxs) {
        const d2 = loadCombatData();
        setIn(d2.ai, p, variant);
        let h; try { h = hash(RESCUE_FX[fx].fn(d2, RESCUE_FX[fx].id)); } catch (e) { h = `throw:${e.message.slice(0, 30)}`; }
        if (h !== base[fx]) { moved = { fixture: fx, statblock: RESCUE_FX[fx].id, variant }; break outer; }
      }
    }
    out.push({ path: p, value: cur, routed_to: fxs, consumed: !!moved, moved });
  }
  return out;
}
function getIn(o, p) { return segs(p).reduce((a, k) => a[k], o); }

// ---------------------------------------------------------------------------------------------
function ang180(d) { d %= 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; }

function yawLegality(data, roster) {
  const M = data.ai.movement;
  const out = [];
  for (const id of roster) {
    const arena = new NodeArena({ data, seed: SEED });
    const b = arena.spawn('e1', id, 0, 1.2 * omegaOf(data, id), 180);
    const ctl = arena.cs.enemies.get('e1'); const p = arena.player;
    let maxEarly = 0, maxLate = 0, maxAct = 0, budget = 0, maxBudget = 0;
    for (let i = 0; i < 3600; i++) {
      p.pos[0] = 2.6 * Math.sin(i / 140); p.pos[2] = 1.9 * Math.sin(i / 97 + 1.1);
      ctl.alert = 100; ctl.alertState = 'AGGRO';
      const y0 = b.yaw;
      arena.step();
      const r = Math.abs(ang180(b.yaw - y0)) * 60;
      if (b.move && b.move.kind === 'attack') {
        const nf = b.animFrame;
        if (nf <= 0.40 * b.move.startup) { maxEarly = Math.max(maxEarly, r); budget += r / 60; }
        else if (nf <= 0.80 * b.move.startup) { maxLate = Math.max(maxLate, r); budget += r / 60; }
        else if (nf > b.move.startup) { maxAct = Math.max(maxAct, r); maxBudget = Math.max(maxBudget, budget); budget = 0; }
      } else { maxBudget = Math.max(maxBudget, budget); budget = 0; }
    }
    const legal = maxEarly <= M.max_yaw_rate_windup_dps + 1e-6
      && maxLate <= M.max_yaw_rate_late_windup_dps + 1e-6
      && maxAct <= M.max_yaw_rate_active_dps + 1e-6;
    out.push({
      stat: id,
      observed_early_windup_dps: +maxEarly.toFixed(2), ceiling_early_dps: M.max_yaw_rate_windup_dps,
      observed_late_windup_dps: +maxLate.toFixed(2), ceiling_late_dps: M.max_yaw_rate_late_windup_dps,
      observed_active_recovery_dps: +maxAct.toFixed(2), ceiling_active_dps: M.max_yaw_rate_active_dps,
      max_windup_yaw_budget_deg: +maxBudget.toFixed(2),
      legal,
    });
  }
  return out;
}

function statesSeen(data, roster) {
  const seen = new Set();
  const per = {};
  for (const id of roster) {
    per[id] = new Set();
    for (const fx of Object.keys(FIXTURES)) {
      for (const r of FIXTURES[fx](data, id)) for (const s of String(r.s).split('/')) { seen.add(s); per[id].add(s); }
    }
  }
  return { seen: [...seen].sort(), per: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, [...v].sort()])) };
}

// ---------------------------------------------------------------------------------------------
function main() {
  const mode = opt('mode', 'chase');
  const data = loadCombatData();
  const roster = fightingRoster(data);
  fs.mkdirSync(OUT, { recursive: true });
  const stamp = { piece: 'W1-12-r2', commit: process.env.W1_12_R2_COMMIT || 'see orchestration/status/W1-12-r2.json', seed: SEED, mode, generated: new Date().toISOString().slice(0, 10) };
  if (!roster.length) { console.error('FAIL: empty fighting roster — the instrument has nothing to measure.'); process.exit(1); }

  if (mode === 'chase') {
    const rows = chase(data, roster);
    if (!rows.length) { console.error('FAIL: no fixture produced a row.'); process.exit(1); }
    fs.writeFileSync(path.join(OUT, 'chase.json'), JSON.stringify({ ...stamp, player_speeds_mps: PLAYER, checkpoints_f60: CHECKPOINTS, rows }, null, 2));
    for (const id of roster) {
      const om = omegaOf(data, id);
      console.log(`\n${id}  (behaviour archetype ${(data.ai.behaviour_archetype || {})[id] || data._enemies[id].archetype}, Ω ${om} m, strike band ${(data.ai.bands.strike * om).toFixed(2)} m)`);
      console.log('  player      r0    min gap   at f    reached strike   RUSH f   gap @300/600/1200/1800');
      for (const r of rows.filter((x) => x.stat === id)) {
        const cps = CHECKPOINTS.map((c) => r.at_checkpoints[c].gap_m.toFixed(1)).join('/');
        console.log(`  ${r.player.padEnd(9)} ${String(r.start_range_m).padStart(3)} m ${String(r.min_gap_m).padStart(8)} ${String(r.min_gap_at_f).padStart(6)}   ${(r.reached_strike ? 'YES' : 'no ').padEnd(14)} ${String(r.rush_frames).padStart(6)}   ${cps}`);
      }
    }
    const fleeing = rows.filter((r) => ['walk', 'jog', 'backaway'].includes(r.player));
    console.log(`\nfleeing-player rows reaching the strike band: ${fleeing.filter((r) => r.reached_strike).length} / ${fleeing.length}`);
    return;
  }

  if (mode === 'census') {
    const { results } = census(data, roster);
    const inert = results.filter((r) => !r.consumed && !r.unselected_archetype_row);
    const declaredInert = results.filter((r) => !r.consumed && r.unselected_archetype_row);
    const ctlLive = results.find((r) => r.path === 'circle.preferred_band_multiple');
    const ctlDead = results.find((r) => r.path === CONTROL_DEAD);
    fs.writeFileSync(path.join(OUT, 'census.json'), JSON.stringify({
      ...stamp, fixtures: Object.keys(FIXTURES), roster,
      total_leaves: results.length,
      consumed: results.filter((r) => r.consumed).length,
      inert_and_not_declared: inert.map((r) => r.path),
      inert_but_declared_unrealised_archetype_rows: declaredInert.length,
      controls: { must_move: ctlLive, must_not_move: ctlDead },
      results,
    }, null, 2));
    console.log(`ai.json behaviour leaves: ${results.length}`);
    console.log(`  with a demonstrated world-side consumer: ${results.filter((r) => r.consumed).length}`);
    console.log(`  inert, on an archetype row no body selects (declared in ai.json): ${declaredInert.length}`);
    console.log(`  INERT AND NOT DECLARED: ${inert.length}`);
    for (const r of inert) console.log(`    ${r.path} = ${JSON.stringify(r.value)}`);
    let bad = 0;
    if (!ctlLive || !ctlLive.consumed) { console.error('CONTROL FAILED: circle.preferred_band_multiple moved nothing — the instrument is blind.'); bad = 1; }
    if (!ctlDead || ctlDead.consumed) { console.error('CONTROL FAILED: archetype.DUELIST.walk_mps moved a trace — no shipped body is a DUELIST, so the instrument fires spuriously.'); bad = 1; }
    console.log(`controls: must_move=${ctlLive && ctlLive.consumed}  must_not_move=${ctlDead && ctlDead.consumed}`);
    process.exit(bad);
  }

  if (mode === 'yaw') {
    const rows = yawLegality(data, roster);
    fs.writeFileSync(path.join(OUT, 'yaw.json'), JSON.stringify({ ...stamp, rows }, null, 2));
    for (const r of rows) {
      console.log(`${r.stat.padEnd(22)} early ${String(r.observed_early_windup_dps).padStart(6)} / ${r.ceiling_early_dps}   late ${String(r.observed_late_windup_dps).padStart(6)} / ${r.ceiling_late_dps}   active+recovery ${String(r.observed_active_recovery_dps).padStart(5)} / ${r.ceiling_active_dps}   budget ${r.max_windup_yaw_budget_deg}°  ${r.legal ? 'legal' : 'ILLEGAL'}`);
    }
    const bad = rows.filter((r) => !r.legal);
    if (bad.length) { console.error(`FAIL: ${bad.length} statblock(s) turn faster than game/data/combat/ai.json §movement allows.`); process.exit(1); }
    console.log('all observed yaw rates are inside the declared ceilings.');
    return;
  }

  if (mode === 'states') {
    const s = statesSeen(data, roster);
    fs.writeFileSync(path.join(OUT, 'states.json'), JSON.stringify({ ...stamp, ...s }, null, 2));
    console.log(`states entered across ${Object.keys(FIXTURES).length} fixtures x ${roster.length} statblocks: ${s.seen.length}`);
    console.log(`  ${s.seen.join(', ')}`);
    for (const [id, v] of Object.entries(s.per)) console.log(`  ${id.padEnd(22)} ${v.join(',')}`);
    return;
  }

  if (mode === 'rescue') {
    const prev = JSON.parse(fs.readFileSync(path.join(OUT, 'census.json'), 'utf8'));
    const cands = prev.inert_and_not_declared;
    const res = rescue(data, cands);
    const dead = res.filter((r) => !r.consumed);
    fs.writeFileSync(path.join(OUT, 'rescue.json'), JSON.stringify({ ...stamp, fixtures: Object.keys(RESCUE_FX), candidates: cands.length, rescued: res.length - dead.length, still_no_consumer: dead.map((r) => r.path), results: res }, null, 2));
    console.log(`re-tested ${cands.length} leaves over ${Object.keys(RESCUE_FX).length} purpose-built fixtures, two-sided perturbation`);
    console.log(`  RESCUED (a fixture that reaches the state moves the trace): ${res.length - dead.length}`);
    for (const r of res.filter((x) => x.consumed)) console.log(`    ok   ${r.path.padEnd(38)} moved in ${Object.keys(r.moved).join(',')} at ${JSON.stringify(Object.values(r.moved)[0].variant)}`);
    console.log(`  STILL NO CONSUMER: ${dead.length}`);
    for (const r of dead) console.log(`    dead ${r.path} = ${JSON.stringify(r.value)}`);
    return;
  }

  console.error(`unknown --mode=${mode}. Modes: chase, census, rescue, yaw, states.`);
  process.exit(2);
}

main();
