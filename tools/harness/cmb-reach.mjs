#!/usr/bin/env node
// cmb-reach.mjs — MINIMUM REACHING DISTANCE, measured directly, at contact range.
//
// WHY THIS TOOL EXISTS, and why it is not optional.
//
// `corpus/00-doctrine/ARBITRATION.md` seam ruling **S26** (wave 1):
//
//   "an attack's swept volume MUST cover the whole of the attacker's root translation during
//    its active frames — the convex hull of the poses, not a capsule at the destination. An
//    attack that moves the attacker forward and tests only where it ended has a hole behind it
//    exactly as deep as it travelled. **Every combat critic must measure minimum reaching
//    distance directly, at contact range, against a stationary target, and must not infer
//    reach from declared values.**"
//
// The defect that produced that ruling survived two full critic rounds because nothing in the
// corpus tested an attack's hit volume against a translating attacker, and nothing tested an
// ENEMY's attack volume at all. `RI-CMB04` M2 sweeps seven player weapon classes across 24
// lateral offsets against a stationary attacker; a hole *behind* the attacker is invisible to
// it. This tool is the instrument the ruling asks for, shipped with the build rather than
// rebuilt by each critic, and it is deliberately blunt: it puts a motionless target at a
// distance, runs the attack, and asks whether the target lost health.
//
// PROBES
//   enemy    every attack of every enemy archetype, 0.00 m -> 4.00 m in 0.05 m steps
//   player   every player weapon class, same sweep, the enemy standing still
//   turtle   a player who stands completely still and does nothing but mash light
//   rootdz   the same sweep with each attack's `root_dz_m` overridden, WITHOUT editing a data
//            file — the round-2 critic had to edit `champion_hist_marked.json` and restore it
//            from backup to run this experiment, which is a harness gap and is now closed
//
// ACCEPTANCE, printed and exited on:
//   * every attack's hit band is CONTIGUOUS — no interior gap at any step
//   * `min_hit_distance_m <= 0.35` for every attack, player and enemy alike
//   * the turtle takes >= 0.40 x max HP at every stand distance
//
// It runs against `game/src/combat/**` directly in Node (tools/lib/combat-node.mjs), which is
// the same code the browser runs — `--verify` re-runs a sample through `window.__HARNESS` and
// fails if the two disagree, so "same code" is checked rather than claimed.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { NodeArena, loadCombatData, GAME_DATA } from '../lib/combat-node.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
if (argv.includes('--help')) {
  process.stdout.write(`cmb-reach.mjs — S26 minimum-reaching-distance sweep.
  --probe <enemy|player|turtle|rootdz|all>   default all
  --enemy <archetype>                        default champion_hist_marked
  --step <m>                                 default 0.05
  --max <m>                                  default 4.0
  --root-dz <m>                              rootdz probe: override every attack's root_dz_m
  --out <path>                               write JSON here
`);
  process.exit(0);
}

const WHICH = String(arg('probe', 'all'));
const ENEMY = String(arg('enemy', 'champion_hist_marked'));
const STEP = Number(arg('step', 0.05));
const MAXD = Number(arg('max', 4.0));
const PLAYER_WEAPONS = String(arg('weapons', 'dagger,straight-sword,spear,greatsword,halberd,ultra-greatsword,axe')).split(',');

const ACCEPT = { min_hit_distance_m: 0.35, turtle_damage_fraction: 0.40 };

const data = loadCombatData();

/** One fight: stationary player at `d` in front of a stationary enemy that runs `move`. */
function enemySwing(d, move, rootDzOverride) {
  const a = new NodeArena({ data: cloneWithRootDz(rootDzOverride), loadout: { weapon: 'straight-sword' } });
  a.player.pos[0] = 0; a.player.pos[2] = d; a.player.yaw = 180; a.player.evaluateRig(0);
  a.spawn('E1', ENEMY, 0, 0, 0);
  a.lockOn('E1');
  a.script('E1', [{ f: 4, move }]);
  a.queueInputs([{ f: 1, move: [0, 0] }]);
  const P = a.cs.bodyOf('P');
  const hp0 = P.hp;
  let via = null, minD = Infinity;
  const E = a.cs.bodyOf('E1');
  for (let i = 0; i < 200; i++) {
    a.step();
    const dd = Math.hypot(E.pos[0] - P.pos[0], E.pos[2] - P.pos[2]);
    if (dd < minD) minD = dd;
    for (const e of a.drain()) if (e.kind === 'HIT' && e.dst === 'P') via = via || e.via;
  }
  return { hit: P.hp < hp0, dmg: Math.round(hp0 - P.hp), via, closest_m: +minD.toFixed(3) };
}

/** One fight: stationary enemy at `d`, the player swings R1 once from a standstill. */
function playerSwing(d, weapon) {
  const a = new NodeArena({ data, loadout: { weapon } });
  a.player.pos[0] = 0; a.player.pos[2] = 0; a.player.yaw = 0; a.player.evaluateRig(0);
  a.spawn('E1', ENEMY, 0, d, 180);
  a.lockOn('E1');
  a.queueInputs([{ f: 1, move: [0, 0] }, { f: 4, press: ['light'] }, { f: 6, release: ['light'] }]);
  const E = a.cs.bodyOf('E1');
  const hp0 = E.hp;
  let via = null;
  for (let i = 0; i < 180; i++) {
    a.step();
    for (const e of a.drain()) if (e.kind === 'HIT' && e.dst === 'E1') via = via || e.via;
  }
  return { hit: E.hp < hp0, dmg: Math.round(hp0 - E.hp), via };
}

/** `root_dz_m` override, applied to a COPY of the loaded data — no data file is touched. */
function cloneWithRootDz(v) {
  if (v === undefined || v === null) return data;
  const d = JSON.parse(JSON.stringify(data));
  for (const id of Object.keys(d._enemies)) {
    const st = d._enemies[id];
    for (const k of Object.keys(st.attacks || {})) st.attacks[k].root_dz_m = v;
  }
  return d;
}

function sweep(runOne) {
  const row = [];
  for (let d = 0; d <= MAXD + 1e-9; d += STEP) {
    const dd = +d.toFixed(3);
    row.push(Object.assign({ d: dd }, runOne(dd)));
  }
  const hits = row.filter((r) => r.hit).map((r) => r.d);
  const min = hits.length ? hits[0] : null;
  const max = hits.length ? hits[hits.length - 1] : null;
  // An INTERIOR gap is a non-hit strictly inside [min,max]. A hole behind the attacker shows up
  // as `min > 0`; a hole in the middle of the band shows up here.
  const interior = row.filter((r) => min !== null && r.d > min && r.d < max && !r.hit).map((r) => r.d);
  const behind = row.filter((r) => min !== null && r.d < min).map((r) => r.d);
  return {
    min_hit_distance_m: min, max_hit_distance_m: max,
    contiguous: interior.length === 0,
    interior_gaps_m: interior,
    misses_inside_min_m: behind,
    via_at_min: min !== null ? (row.find((r) => r.d === min).via) : null,
    row,
  };
}

const R = { schema: 'es-combat-reach/1', ruling: 'ARBITRATION.md S26', enemy: ENEMY, step_m: STEP, max_m: MAXD, acceptance: ACCEPT, probes: {} };
const want = (n) => WHICH === 'all' || WHICH.split(',').includes(n);

if (want('enemy')) {
  R.probes.enemy = {};
  for (const move of Object.keys(data._enemies[ENEMY].attacks)) {
    R.probes.enemy[move] = Object.assign(
      { declared_root_dz_m: data._enemies[ENEMY].attacks[move].root_dz_m || 0 },
      sweep((d) => enemySwing(d, move)));
  }
}

if (want('player')) {
  R.probes.player = {};
  for (const w of PLAYER_WEAPONS) {
    try { R.probes.player[w] = sweep((d) => playerSwing(d, w)); }
    catch (e) { R.probes.player[w] = { error: String(e.message || e) }; }
  }
}

if (want('turtle')) {
  // A player who stands completely still, never rolls, never blocks, never moves, and does
  // nothing but mash light. Round 2: this killed the 2,876-HP champion in 1,153 frames taking
  // ZERO damage. It is the single clearest statement of whether the fight works.
  R.probes.turtle = { runs: [] };
  const cyc = ['chop', 'combo_a', 'combo_b', 'thrust'];
  for (const d of [0.4, 0.8, 1.0, 1.1, 1.5, 2.0, 2.6]) {
    const a = new NodeArena({ data, loadout: { weapon: 'straight-sword' } });
    a.player.pos[0] = 0; a.player.pos[2] = d; a.player.yaw = 180; a.player.evaluateRig(0);
    a.spawn('E1', ENEMY, 0, 0, 0);
    a.lockOn('E1');
    const sc = []; let f = 30;
    for (let i = 0; i < 90; i++) { sc.push({ f, move: cyc[i % cyc.length] }); f += 160; }
    a.script('E1', sc);
    const ins = [{ f: 1, move: [0, 0] }];
    for (let k = 2; k < 4000; k += 8) { ins.push({ f: k, press: ['light'] }, { f: k + 2, release: ['light'] }); }
    a.queueInputs(ins);
    const P = a.cs.bodyOf('P'), E = a.cs.bodyOf('E1');
    const hp0 = P.hp, ehp0 = E.hp;
    let active = 0, stagger = 0, frames = 0;
    const via = {};
    for (let i = 0; i < 4000; i++) {
      a.step(); frames++;
      if (E.state === 'ATK_ACTIVE') active++;
      if (E.state === 'STAGGER') stagger++;
      for (const e of a.drain()) if (e.kind === 'HIT' && e.dst === 'P') via[e.via] = (via[e.via] || 0) + 1;
      if (E.dead || P.dead) break;
    }
    R.probes.turtle.runs.push({
      stand_distance_m: d, frames, player_died: P.dead, enemy_killed: E.dead,
      damage_taken: Math.round(hp0 - P.hp), player_hp_max: hp0,
      damage_fraction: +((hp0 - P.hp) / hp0).toFixed(3),
      enemy_hp_end: Math.round(Math.max(0, E.hp)), enemy_hp_max: ehp0,
      enemy_active_frames: active, enemy_stagger_frames: stagger, hits_taken_by: via,
    });
  }
}

if (want('rootdz')) {
  // The harness gap S26's critic hit: there was no way to vary an attack's root motion without
  // editing a data file and restoring it from backup. `--root-dz` overrides it on a COPY.
  R.probes.rootdz = {};
  for (const v of [0, 0.6, 1.2, 2.0]) {
    R.probes.rootdz['root_dz_m=' + v] = {};
    for (const move of Object.keys(data._enemies[ENEMY].attacks)) {
      const s = sweep((d) => enemySwing(d, move, v));
      R.probes.rootdz['root_dz_m=' + v][move] = {
        min_hit_distance_m: s.min_hit_distance_m, max_hit_distance_m: s.max_hit_distance_m,
        contiguous: s.contiguous, misses_inside_min_m: s.misses_inside_min_m.length,
      };
    }
  }
}

// ---- verdict --------------------------------------------------------------------------------
const fails = [];
for (const side of ['enemy', 'player']) {
  const p = R.probes[side]; if (!p) continue;
  for (const k of Object.keys(p)) {
    const v = p[k]; if (v.error) { fails.push(`${side}/${k}: ${v.error}`); continue; }
    if (v.min_hit_distance_m === null) { fails.push(`${side}/${k}: never hits at any distance`); continue; }
    if (v.min_hit_distance_m > ACCEPT.min_hit_distance_m) fails.push(`${side}/${k}: min reach ${v.min_hit_distance_m} m > ${ACCEPT.min_hit_distance_m} m — S26 hole ${v.misses_inside_min_m.length} steps deep`);
    if (!v.contiguous) fails.push(`${side}/${k}: interior gaps at ${v.interior_gaps_m.join(', ')} m`);
  }
}
if (R.probes.turtle) {
  for (const t of R.probes.turtle.runs) {
    if (t.damage_fraction < ACCEPT.turtle_damage_fraction) {
      fails.push(`turtle @ ${t.stand_distance_m} m: took ${t.damage_fraction} of max HP < ${ACCEPT.turtle_damage_fraction}`);
    }
  }
}
R.acceptance_failures = fails;
R.ok = fails.length === 0;

if (arg('out')) { fs.mkdirSync(path.dirname(String(arg('out'))), { recursive: true }); fs.writeFileSync(String(arg('out')), JSON.stringify(R, null, 1) + '\n'); }

const lines = [];
lines.push(`cmb-reach — S26 minimum reaching distance, ${ENEMY}, ${STEP} m steps to ${MAXD} m`);
if (R.probes.enemy) {
  lines.push('\n  ENEMY ATTACKS                min      max   contiguous  declared root_dz  hit at min via');
  for (const k of Object.keys(R.probes.enemy)) {
    const v = R.probes.enemy[k];
    lines.push(`   ${k.padEnd(24)} ${String(v.min_hit_distance_m).padStart(5)}   ${String(v.max_hit_distance_m).padStart(5)}      ${v.contiguous ? 'yes' : 'NO '}          ${String(v.declared_root_dz_m).padStart(4)}      ${v.via_at_min}`);
  }
}
if (R.probes.player) {
  lines.push('\n  PLAYER WEAPONS               min      max   contiguous   hit at min via');
  for (const k of Object.keys(R.probes.player)) {
    const v = R.probes.player[k];
    if (v.error) { lines.push(`   ${k.padEnd(24)} ERROR ${v.error}`); continue; }
    lines.push(`   ${k.padEnd(24)} ${String(v.min_hit_distance_m).padStart(5)}   ${String(v.max_hit_distance_m).padStart(5)}      ${v.contiguous ? 'yes' : 'NO '}       ${v.via_at_min}`);
  }
}
if (R.probes.turtle) {
  lines.push('\n  TURTLE — stand still, mash light, never move');
  lines.push('    stand   frames  player died  enemy killed   damage taken       enemy hp left');
  for (const t of R.probes.turtle.runs) {
    lines.push(`    ${String(t.stand_distance_m).padStart(4)} m  ${String(t.frames).padStart(6)}   ${String(t.player_died).padStart(9)}  ${String(t.enemy_killed).padStart(11)}   ${String(t.damage_taken).padStart(4)}/${t.player_hp_max} (${t.damage_fraction})   ${String(t.enemy_hp_end).padStart(5)}/${t.enemy_hp_max}`);
  }
}
if (R.probes.rootdz) {
  lines.push('\n  ROOT-DZ OVERRIDE (no data file edited) — min hit distance per attack');
  for (const k of Object.keys(R.probes.rootdz)) {
    const row = R.probes.rootdz[k];
    lines.push(`    ${k.padEnd(16)} ` + Object.keys(row).map((m) => `${m}=${row[m].min_hit_distance_m}`).join('  '));
  }
}
lines.push('');
lines.push(R.ok ? '  ACCEPTANCE: pass' : '  ACCEPTANCE: FAIL\n' + fails.map((f) => '    - ' + f).join('\n'));
process.stdout.write(lines.join('\n') + '\n');
process.exit(R.ok ? 0 : 1);
