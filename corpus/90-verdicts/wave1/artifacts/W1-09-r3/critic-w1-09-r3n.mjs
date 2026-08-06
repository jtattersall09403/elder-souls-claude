#!/usr/bin/env node
// critic-w1-09-r3n.mjs — ROUND-3 CRITIC's own node-side instruments for W1-09.
//
// Written from scratch by the critic. It shares only the module LOADER (tools/lib/combat-node.mjs,
// which imports game/src/combat/*.js unmodified); every fight, every measurement and every
// acceptance test below is the critic's, not the builder's. `cmb-reach.mjs` is never called.
//
// The point of separation: RI-MTH07 / ARBITRATION §3 CONSUMPTION. A builder that ships the probe
// that grades it has graded itself. Where this file and cmb-reach.mjs agree, the number is
// corroborated. Where they disagree, this file says so.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { NodeArena, loadCombatData, GAME_DATA } from '../lib/combat-node.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const WHICH = String(arg('probe', 'all')).split(',');
const OUT = arg('out', null);
const ENEMY = String(arg('enemy', 'champion_hist_marked'));
const want = (n) => WHICH.includes('all') || WHICH.includes(n);

const baseData = loadCombatData();
const clone = (d) => JSON.parse(JSON.stringify(d));

/** Deep-clone the loaded data and mutate every enemy attack's root_dz_m. */
function withRootDz(v) {
  const d = clone(baseData);
  for (const id of Object.keys(d._enemies)) {
    for (const k of Object.keys(d._enemies[id].attacks || {})) d._enemies[id].attacks[k].root_dz_m = v;
  }
  return d;
}
/** Deep-clone and disable body separation by zeroing the radii. */
function withNoSeparation() {
  const d = clone(baseData);
  d.hitgeometry.bodies.player_radius_m = 0;
  d.hitgeometry.bodies.default_enemy_radius_m = 0;
  return d;
}
/** Deep-clone and delete the body-hazard block entirely. */
function withNoBodyHazard() {
  const d = clone(baseData);
  delete d.hitgeometry.body_hazard;
  return d;
}

const R = { schema: 'critic-w1-09-r3/1', generated: new Date().toISOString(), enemy: ENEMY, probes: {} };

// ---------------------------------------------------------------------------------------------
// ENEMY REACH — the critic's own sweep. Unlike cmb-reach this records the CENTRE-TO-CENTRE
// DISTANCE AT THE FRAME THE HIT LANDED, not the distance the target was placed at. S26 says
// "measure minimum reaching distance directly, AT CONTACT RANGE, against a STATIONARY target";
// if body separation shoves the target before the blow arrives, the placement distance and the
// contact distance are different numbers and only the second one is what S26 asked for.
// ---------------------------------------------------------------------------------------------
function enemySweep(move, data, opts = {}) {
  const row = [];
  const step = opts.step || 0.05, maxd = opts.max || 4.0;
  for (let i = 0; i * step <= maxd + 1e-9; i++) {
    const d = +(i * step).toFixed(3);
    const a = new NodeArena({ data, loadout: { weapon: 'straight-sword' } });
    a.player.pos[0] = 0; a.player.pos[2] = d; a.player.yaw = 180; a.player.evaluateRig(0);
    a.spawn('E1', ENEMY, 0, 0, 0);
    a.lockOn('E1');
    a.script('E1', [{ f: 4, move }]);
    a.queueInputs([{ f: 1, move: [0, 0] }]);
    const P = a.cs.bodyOf('P'), E = a.cs.bodyOf('E1');
    const hp0 = P.hp;
    let hit = null;
    let playerMoved = 0, firstActive = null;
    const p0 = [P.pos[0], P.pos[2]];
    for (let f = 0; f < 240; f++) {
      a.step();
      if (E.state === 'ATK_ACTIVE' && firstActive === null) {
        firstActive = { frame: a.frame, dist: Math.hypot(E.pos[0] - P.pos[0], E.pos[2] - P.pos[2]), ez: E.pos[2], pz: P.pos[2] };
      }
      playerMoved = Math.max(playerMoved, Math.hypot(P.pos[0] - p0[0], P.pos[2] - p0[1]));
      for (const e of a.drain()) {
        if (e.kind === 'HIT' && e.dst === 'P' && !hit) {
          hit = {
            frame: e.f, via: e.via, dmg: e.dmg, part: e.part,
            dist_at_hit: +Math.hypot(E.pos[0] - P.pos[0], E.pos[2] - P.pos[2]).toFixed(3),
          };
        }
      }
      if (P.dead) break;
    }
    row.push({
      placed_m: d, hit: !!hit, via: hit && hit.via, dmg: hit && hit.dmg,
      dist_at_hit_m: hit && hit.dist_at_hit,
      dist_at_first_active_m: firstActive && +firstActive.dist.toFixed(3),
      target_pushed_m: +playerMoved.toFixed(3),
      hp_lost: Math.round(hp0 - P.hp),
    });
  }
  const hits = row.filter((r) => r.hit);
  const min = hits.length ? hits[0].placed_m : null;
  const max = hits.length ? hits[hits.length - 1].placed_m : null;
  const interior = row.filter((r) => min !== null && r.placed_m > min && r.placed_m < max && !r.hit).map((r) => r.placed_m);
  return {
    min_placed_m: min, max_placed_m: max, contiguous: interior.length === 0, interior_gaps_m: interior,
    min_contact_distance_m: hits.length ? Math.min(...hits.map((h) => h.dist_at_hit_m)) : null,
    contact_distance_at_min_placement_m: hits.length ? hits[0].dist_at_hit_m : null,
    via_histogram: hits.reduce((o, h) => (o[h.via] = (o[h.via] || 0) + 1, o), {}),
    max_target_push_m: Math.max(...row.map((r) => r.target_pushed_m)),
    row,
  };
}

function playerSweep(weapon, data, opts = {}) {
  const row = [];
  const step = opts.step || 0.05, maxd = opts.max || 4.0;
  for (let i = 0; i * step <= maxd + 1e-9; i++) {
    const d = +(i * step).toFixed(3);
    const a = new NodeArena({ data, loadout: { weapon } });
    a.player.pos[0] = 0; a.player.pos[2] = 0; a.player.yaw = 0; a.player.evaluateRig(0);
    a.spawn('E1', ENEMY, 0, d, 180);
    a.lockOn('E1');
    a.queueInputs([{ f: 1, move: [0, 0] }, { f: 4, press: ['light'] }, { f: 6, release: ['light'] }]);
    const E = a.cs.bodyOf('E1'), P = a.cs.bodyOf('P');
    const hp0 = E.hp;
    let hit = null, pushed = 0;
    const e0 = E.pos[2];
    for (let f = 0; f < 200; f++) {
      a.step();
      pushed = Math.max(pushed, Math.abs(E.pos[2] - e0));
      for (const e of a.drain()) if (e.kind === 'HIT' && e.dst === 'E1' && !hit) {
        hit = { via: e.via, dmg: e.dmg, dist: +Math.hypot(E.pos[0] - P.pos[0], E.pos[2] - P.pos[2]).toFixed(3) };
      }
    }
    row.push({ placed_m: d, hit: !!hit, via: hit && hit.via, dmg: hit && hit.dmg, dist_at_hit_m: hit && hit.dist, target_pushed_m: +pushed.toFixed(3), hp_lost: Math.round(hp0 - E.hp) });
  }
  const hits = row.filter((r) => r.hit);
  const min = hits.length ? hits[0].placed_m : null;
  const max = hits.length ? hits[hits.length - 1].placed_m : null;
  const interior = row.filter((r) => min !== null && r.placed_m > min && r.placed_m < max && !r.hit).map((r) => r.placed_m);
  return {
    min_placed_m: min, max_placed_m: max, contiguous: interior.length === 0, interior_gaps_m: interior,
    via_histogram: hits.reduce((o, h) => (o[h.via] = (o[h.via] || 0) + 1, o), {}),
    row,
  };
}

if (want('reach')) {
  R.probes.reach = { enemy: {}, player: {} };
  for (const m of Object.keys(baseData._enemies[ENEMY].attacks)) R.probes.reach.enemy[m] = enemySweep(m, baseData);
  for (const w of ['dagger', 'straight-sword', 'spear', 'greatsword', 'halberd', 'ultra-greatsword', 'axe']) {
    try { R.probes.reach.player[w] = playerSweep(w, baseData); } catch (e) { R.probes.reach.player[w] = { error: String(e.message || e) }; }
  }
}

// ---------------------------------------------------------------------------------------------
// S26's OWN GUARD: "zero root translation means no body hazard". If a stationary attacker
// damages an adjacent target, the hazard is a distance check by another name — AR-1.
// ---------------------------------------------------------------------------------------------
if (want('rootdz')) {
  R.probes.rootdz = {};
  for (const v of [0, 0.3, 1.2]) {
    const d = withRootDz(v);
    R.probes.rootdz['root_dz=' + v] = {};
    for (const m of Object.keys(baseData._enemies[ENEMY].attacks)) {
      const s = enemySweep(m, d, { step: 0.1, max: 3.0 });
      R.probes.rootdz['root_dz=' + v][m] = {
        min_placed_m: s.min_placed_m, max_placed_m: s.max_placed_m,
        via_histogram: s.via_histogram,
        body_hits: (s.via_histogram.body || 0),
        hit_at_0m: s.row[0].hit, via_at_0m: s.row[0].via,
      };
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Ablation: what does each new mechanism actually buy? Reach with (a) body hazard removed,
// (b) body separation removed. This is the CONSUMPTION perturbation for both models.
// ---------------------------------------------------------------------------------------------
if (want('ablate')) {
  R.probes.ablate = {};
  const cases = { baseline: baseData, no_body_hazard: withNoBodyHazard(), no_separation: withNoSeparation() };
  for (const [name, d] of Object.entries(cases)) {
    R.probes.ablate[name] = { enemy: {}, player: {} };
    for (const m of Object.keys(baseData._enemies[ENEMY].attacks)) {
      const s = enemySweep(m, d, { step: 0.1, max: 4.0 });
      R.probes.ablate[name].enemy[m] = { min: s.min_placed_m, max: s.max_placed_m, contiguous: s.contiguous, gaps: s.interior_gaps_m, via: s.via_histogram };
    }
    for (const w of ['dagger', 'straight-sword', 'spear', 'halberd']) {
      const s = playerSweep(w, d, { step: 0.05, max: 3.0 });
      R.probes.ablate[name].player[w] = { min: s.min_placed_m, max: s.max_placed_m, contiguous: s.contiguous, gaps: s.interior_gaps_m, via: s.via_histogram };
    }
  }
}

// ---------------------------------------------------------------------------------------------
// TURTLE — the critic's own version. Different cadence, different attack order, and it also
// runs a variant where the player NEVER attacks (pure punching bag) so the damage rate can be
// separated from the trade.
// ---------------------------------------------------------------------------------------------
function turtle(d, opts = {}) {
  const a = new NodeArena({ data: opts.data || baseData, loadout: { weapon: opts.weapon || 'straight-sword' } });
  a.player.pos[0] = 0; a.player.pos[2] = d; a.player.yaw = 180; a.player.evaluateRig(0);
  a.spawn('E1', ENEMY, 0, 0, 0);
  a.lockOn('E1');
  // A cadence set by the ATTACK's own total, back-to-back — the hardest the scripted enemy can go.
  const atk = baseData._enemies[ENEMY].attacks;
  const cyc = opts.cycle || ['combo_b', 'combo_a', 'chop', 'thrust'];
  const sc = []; let f = 20;
  for (let i = 0; i < 200; i++) {
    const m = cyc[i % cyc.length];
    sc.push({ f, move: m });
    f += atk[m].startup + atk[m].active + atk[m].recovery + 2;
  }
  a.script('E1', sc);
  const ins = [{ f: 1, move: [0, 0] }];
  if (!opts.passive) for (let k = 2; k < 12000; k += 8) ins.push({ f: k, press: ['light'] }, { f: k + 2, release: ['light'] });
  a.queueInputs(ins);
  const P = a.cs.bodyOf('P'), E = a.cs.bodyOf('E1');
  const hp0 = P.hp, ehp0 = E.hp;
  const via = {}; let frames = 0, swings = 0, hitsOnPlayer = 0, minStam = Infinity;
  for (let i = 0; i < 12000; i++) {
    a.step(); frames++;
    minStam = Math.min(minStam, P.stamina);
    for (const e of a.drain()) {
      if (e.kind === 'HIT' && e.dst === 'P') { via[e.via] = (via[e.via] || 0) + 1; hitsOnPlayer++; }
      if (e.kind === 'ACTION_START' && e.who === 'E1') swings++;
    }
    if (E.dead || P.dead) break;
  }
  return {
    stand_m: d, frames, seconds: +(frames / 60).toFixed(1),
    player_died: P.dead, enemy_killed: E.dead,
    player_hp_left: Math.round(Math.max(0, P.hp)), player_hp_max: hp0,
    damage_fraction: +((hp0 - Math.max(0, P.hp)) / hp0).toFixed(3),
    enemy_hp_left: Math.round(Math.max(0, E.hp)), enemy_hp_max: ehp0,
    enemy_swings: swings, hits_on_player: hitsOnPlayer, hits_by: via,
    player_min_stamina: +minStam.toFixed(1),
  };
}

if (want('turtle')) {
  R.probes.turtle = { mashing: [], passive: [] };
  for (const d of [0.0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0, 2.6, 3.2]) R.probes.turtle.mashing.push(turtle(d));
  for (const d of [0.4, 0.8, 1.2, 2.0]) R.probes.turtle.passive.push(Object.assign({ passive: true }, turtle(d, { passive: true })));
}

// ---------------------------------------------------------------------------------------------
// PUSH-OUT-OF-HITBOX. S26's dead-ring concern, tested the other way round: does the separation
// force ever move a target out of a volume it would otherwise have been struck by? Compare the
// hit set with separation on and off, per weapon and per enemy attack.
// ---------------------------------------------------------------------------------------------
if (want('push')) {
  R.probes.push = { enemy: {}, player: {} };
  const noSep = withNoSeparation();
  for (const m of Object.keys(baseData._enemies[ENEMY].attacks)) {
    const on = enemySweep(m, baseData, { step: 0.05, max: 4.0 });
    const off = enemySweep(m, noSep, { step: 0.05, max: 4.0 });
    const lost = [], gained = [];
    for (let i = 0; i < on.row.length; i++) {
      if (!on.row[i].hit && off.row[i].hit) lost.push(on.row[i].placed_m);
      if (on.row[i].hit && !off.row[i].hit) gained.push(on.row[i].placed_m);
    }
    R.probes.push.enemy[m] = { lost_to_separation_m: lost, gained_m: gained, sep_on: [on.min_placed_m, on.max_placed_m], sep_off: [off.min_placed_m, off.max_placed_m] };
  }
  for (const w of ['dagger', 'straight-sword', 'spear', 'greatsword', 'halberd', 'ultra-greatsword', 'axe']) {
    const on = playerSweep(w, baseData, { step: 0.05, max: 3.5 });
    const off = playerSweep(w, noSep, { step: 0.05, max: 3.5 });
    const lost = [], gained = [];
    for (let i = 0; i < on.row.length; i++) {
      if (!on.row[i].hit && off.row[i].hit) lost.push(on.row[i].placed_m);
      if (on.row[i].hit && !off.row[i].hit) gained.push(on.row[i].placed_m);
    }
    R.probes.push.player[w] = { lost_to_separation_m: lost, gained_m: gained, sep_on: [on.min_placed_m, on.max_placed_m], sep_off: [off.min_placed_m, off.max_placed_m] };
  }
}

// ---------------------------------------------------------------------------------------------
// LATERAL body hazard. A corridor is directional; a radius is not. Place the target OFF the
// attacker's line of travel and see how far to the side the body hazard still reaches.
// ---------------------------------------------------------------------------------------------
if (want('lateral')) {
  R.probes.lateral = {};
  for (const m of ['chop']) {
    const rows = [];
    for (let x = 0; x <= 1.6001; x += 0.05) {
      for (const z of [0.0, -0.6, -1.2]) {
        const a = new NodeArena({ data: baseData, loadout: { weapon: 'straight-sword' } });
        a.player.pos[0] = +x.toFixed(3); a.player.pos[2] = z; a.player.yaw = 180; a.player.evaluateRig(0);
        a.spawn('E1', ENEMY, 0, 0, 0);
        a.lockOn('E1');
        a.script('E1', [{ f: 4, move: m, face: 0 }]);   // face LOCKED to +z: the corridor is +z
        a.queueInputs([{ f: 1, move: [0, 0] }]);
        const P = a.cs.bodyOf('P');
        let via = null;
        for (let f = 0; f < 220; f++) { a.step(); for (const e of a.drain()) if (e.kind === 'HIT' && e.dst === 'P') via = via || e.via; }
        rows.push({ x: +x.toFixed(2), z, hit: !!via, via });
      }
    }
    R.probes.lateral[m] = rows;
  }
}

// ---------------------------------------------------------------------------------------------
// A2/A1 — dice. 60 identical scripted hits; damage must be a function, not a draw.
// ---------------------------------------------------------------------------------------------
if (want('dice')) {
  const dmgs = [];
  for (let s = 0; s < 60; s++) {
    const a = new NodeArena({ data: baseData, loadout: { weapon: 'straight-sword' } });
    a.player.pos[2] = 0; a.player.yaw = 0; a.player.evaluateRig(0);
    a.spawn('E1', ENEMY, 0, 1.4, 180);
    a.lockOn('E1');
    a.queueInputs([{ f: 1, move: [0, 0] }, { f: 4, press: ['light'] }, { f: 6, release: ['light'] }]);
    let d = null;
    for (let f = 0; f < 120; f++) { a.step(); for (const e of a.drain()) if (e.kind === 'HIT' && e.dst === 'E1' && d === null) d = e.dmg; }
    dmgs.push(d);
  }
  const uniq = [...new Set(dmgs)];
  R.probes.dice = { n: dmgs.length, unique_damage_values: uniq, all_hit: dmgs.every((x) => x !== null), stdev: 0 };
}

if (OUT) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1) + '\n'); }
process.stdout.write(JSON.stringify(Object.keys(R.probes)) + '\n');
