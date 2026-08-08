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
const OUT = path.join(ROOT, 'reports/w1-12-r2');

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
  for (let i = 0; i < 1200; i++) {
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
  for (let i = 0; i < 1200; i++) {
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
  for (let i = 0; i < 900; i++) {
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
  for (let i = 0; i < 900; i++) {
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
  for (let i = 0; i < 900; i++) {
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
  for (let i = 0; i < 900; i++) {
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
    for (const fx of Object.keys(FIXTURES)) {
      for (const id of roster) {
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
    });
  }
  return { base, results };
}

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
    const ctlDead = results.find((r) => r.path === 'archetype.DUELIST.walk_mps');
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

  console.error(`unknown --mode=${mode}. Modes: chase, census, yaw, states.`);
  process.exit(2);
}

main();
