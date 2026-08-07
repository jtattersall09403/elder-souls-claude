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
  process.stdout.write(`cmb-reach.mjs — S26 minimum-reaching-distance sweep (RI-CMB04 M8/M9).
  --probe <enemy|player|turtle|rootdz|ablate|substep|radius|all>   default all
  --enemy <archetype>                        default champion_hist_marked
  --step <m>                                 default 0.05
  --max <m>                                  default 4.0
  --root-dz <m>                              rootdz probe: override every attack's root_dz_m
  --ablate <none|body|rootdz|both>           M8.3 two-volume ablation, applied to a DEEP COPY
  --substeps <n>                             M9, override hitgeometry.sweep.substeps on a copy
  --verify                                   RI-MTH07 §D: re-run a sample through the BROWSER
                                             (window.__HARNESS) and fail if node disagrees
  --out <path>                               write JSON here
`);
  process.exit(0);
}

const WHICH = String(arg('probe', 'all'));
const ENEMY = String(arg('enemy', 'champion_hist_marked'));
const STEP = Number(arg('step', 0.05));
const MAXD = Number(arg('max', 4.0));
const PLAYER_WEAPONS = String(arg('weapons', 'dagger,straight-sword,spear,greatsword,halberd,ultra-greatsword,axe')).split(',');

// RI-CMB04 M8 acceptance, verbatim from the item:
//   M8.1  min_hit_distance_m <= 0.35 for every attack WITH THE BODY CORRIDOR ABLATED
//   M8.2  the connecting set is a single unbroken run — HARD FAIL on an interior gap
//   M8.3  ablating the corridor may not move min_hit_distance_m by more than 0.35 m;
//         root_dz == 0 must take body-corridor hits to zero at every distance
//   M8.4  a via:"body" hit's dmg must be STRICTLY LESS than the same attack's via:"weapon" dmg
//   M8.5  the hit/push body radius and the world-collision radius differ by <= 0.05 m
//   M9    the substeps=1 hit set must DIFFER from the shipped one on a non-empty set of pairs
const ACCEPT = {
  min_hit_distance_m: 0.35,
  turtle_damage_fraction: 0.40,
  ablation_delta_max_m: 0.35,
  radius_delta_max_m: 0.05,
};

const BASE = loadCombatData();

/**
 * M8.3 — the two-volume ablation, done the way the item words it: *"a DEEP COPY of the loaded
 * data with `§body_hazard` removed"*. Not a flag the resolver reads, not a monkey-patch on the
 * live object — a copy, so nothing this probe does can leak into another probe in the same
 * process, and so the ablated run exercises exactly the code path a build without the corridor
 * would have. `Rig` reads `hitGeometry.body_hazard` in its constructor and sets `bodyCap = null`
 * when it is absent, which is the whole of the corridor's existence.
 */
function variant({ ablate = 'none', substeps, rootDz } = {}) {
  if (ablate === 'none' && substeps === undefined && rootDz === undefined) return BASE;
  const d = JSON.parse(JSON.stringify(BASE));
  if (ablate === 'body' || ablate === 'both') delete d.hitgeometry.body_hazard;
  if (ablate === 'rootdz' || ablate === 'both') rootDz = 0;
  if (substeps !== undefined) d.hitgeometry.sweep.substeps = substeps;
  if (rootDz !== undefined) {
    for (const id of Object.keys(d._enemies)) {
      const st = d._enemies[id];
      for (const k of Object.keys(st.attacks || {})) st.attacks[k].root_dz_m = rootDz;
    }
    // The player's own root motion lives in the moveset spine and in W1-10's clip registry, so
    // zeroing only the enemy side would make "root_dz == 0" a claim about half the game.
    for (const id of Object.keys(d.movesets || {})) {
      for (const mv of Object.keys(d.movesets[id].moves || {})) d.movesets[id].moves[mv].root_dz_m = rootDz;
    }
    for (const id of Object.keys(d.weaponMovesets || {})) {
      const doc = d.weaponMovesets[id];
      for (const k of Object.keys(doc.moves || doc.slots || {})) {
        const m = (doc.moves || doc.slots)[k];
        if (m && typeof m === 'object') m.root_dz_m = rootDz;
      }
    }
  }
  return d;
}

// Which side the ablation and substep probes sweep. Both together is ~4,500 fights at ~120 ms
// each, which does not fit one run; `--sides` lets the two halves be measured and written
// separately rather than losing both to a timeout.
const SIDES = String(arg('sides', 'both'));
const doEnemy = SIDES === 'both' || SIDES === 'enemy';
const doPlayer = SIDES === 'both' || SIDES === 'player';

const ABLATE = String(arg('ablate', 'none'));
const SUBSTEPS = arg('substeps') === undefined ? undefined : Number(arg('substeps'));
const data = variant({ ablate: ABLATE, substeps: SUBSTEPS });

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
  // RI-CMB04 M8.4 — ATTRIBUTION. Every connecting distance records `(via, dmg, poise_damage)`,
  // and for a corridor hit also what the same attack's BLADE would have charged, so the strict
  // inequality is checked against a number from the same frame rather than from another run.
  const evs = [];
  for (let i = 0; i < 200; i++) {
    a.step();
    const dd = Math.hypot(E.pos[0] - P.pos[0], E.pos[2] - P.pos[2]);
    if (dd < minD) minD = dd;
    for (const e of a.drain()) {
      if (e.kind === 'HIT' && e.dst === 'P') {
        via = via || e.via;
        evs.push({ via: e.via, dmg: e.dmg, pd: e.pd, dmg_if_weapon: e.dmg_if_weapon, part: e.part, f: e.f });
      }
    }
  }
  return { hit: P.hp < hp0, dmg: Math.round(hp0 - P.hp), via, closest_m: +minD.toFixed(3), events: evs };
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
  const evs = [];
  for (let i = 0; i < 180; i++) {
    a.step();
    for (const e of a.drain()) {
      if (e.kind === 'HIT' && e.dst === 'E1') {
        via = via || e.via;
        evs.push({ via: e.via, dmg: e.dmg, pd: e.pd, dmg_if_weapon: e.dmg_if_weapon, part: e.part, f: e.f });
      }
    }
  }
  return { hit: E.hp < hp0, dmg: Math.round(hp0 - E.hp), via, events: evs };
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

/** Same fight as `enemySwing`, run against an arbitrary data variant (ablation / substeps). */
function enemySwingWith(dv, d, move) {
  const a = new NodeArena({ data: dv, loadout: { weapon: 'straight-sword' } });
  a.player.pos[0] = 0; a.player.pos[2] = d; a.player.yaw = 180; a.player.evaluateRig(0);
  a.spawn('E1', ENEMY, 0, 0, 0);
  a.lockOn('E1');
  a.script('E1', [{ f: 4, move }]);
  a.queueInputs([{ f: 1, move: [0, 0] }]);
  const P = a.cs.bodyOf('P');
  const hp0 = P.hp;
  let via = null; const evs = [];
  for (let i = 0; i < 200; i++) {
    a.step();
    for (const e of a.drain()) {
      if (e.kind === 'HIT' && e.dst === 'P') { via = via || e.via; evs.push({ via: e.via, dmg: e.dmg }); }
    }
  }
  return { hit: P.hp < hp0, dmg: Math.round(hp0 - P.hp), via, events: evs };
}

/** Same for the player side. */
function playerSwingWith(dv, d, weapon) {
  const a = new NodeArena({ data: dv, loadout: { weapon } });
  a.player.pos[0] = 0; a.player.pos[2] = 0; a.player.yaw = 0; a.player.evaluateRig(0);
  a.spawn('E1', ENEMY, 0, d, 180);
  a.lockOn('E1');
  a.queueInputs([{ f: 1, move: [0, 0] }, { f: 4, press: ['light'] }, { f: 6, release: ['light'] }]);
  const E = a.cs.bodyOf('E1');
  const hp0 = E.hp;
  let via = null; const evs = [];
  for (let i = 0; i < 180; i++) {
    a.step();
    for (const e of a.drain()) {
      if (e.kind === 'HIT' && e.dst === 'E1') { via = via || e.via; evs.push({ via: e.via, dmg: e.dmg }); }
    }
  }
  return { hit: E.hp < hp0, dmg: Math.round(hp0 - E.hp), via, events: evs };
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
  // M8.4 attribution roll-up. `body_ge_weapon` is the HARD FAIL set: every corridor event whose
  // damage was not strictly below what the same attack's blade charged on the same frame.
  const byVia = {};
  const bodyGeWeapon = [];
  for (const r of row) {
    for (const e of (r.events || [])) {
      const k = e.via || 'weapon';
      const s = byVia[k] || (byVia[k] = { events: 0, dmg_min: Infinity, dmg_max: -Infinity, pd: new Set() });
      s.events++;
      if (e.dmg < s.dmg_min) s.dmg_min = e.dmg;
      if (e.dmg > s.dmg_max) s.dmg_max = e.dmg;
      if (e.pd !== undefined) s.pd.add(e.pd);
      if (k === 'body' && e.dmg_if_weapon !== undefined && e.dmg >= e.dmg_if_weapon) {
        bodyGeWeapon.push({ d: r.d, dmg: e.dmg, dmg_if_weapon: e.dmg_if_weapon });
      }
    }
  }
  for (const k of Object.keys(byVia)) {
    byVia[k].pd = [...byVia[k].pd].sort((a, b) => a - b);
    if (byVia[k].dmg_min === Infinity) { byVia[k].dmg_min = null; byVia[k].dmg_max = null; }
  }
  // The distances that connect ONLY through the corridor: the reach the weapon is not paying for.
  const bodyOnly = row.filter((r) => r.hit && (r.events || []).length && (r.events || []).every((e) => e.via === 'body')).map((r) => r.d);
  return {
    min_hit_distance_m: min, max_hit_distance_m: max,
    contiguous: interior.length === 0,
    interior_gaps_m: interior,
    misses_inside_min_m: behind,
    via_at_min: min !== null ? (row.find((r) => r.d === min).via) : null,
    attribution: byVia,
    body_only_distances_m: bodyOnly,
    body_damage_ge_weapon: bodyGeWeapon,
    row,
  };
}

/** The distance set that connects, as a canonical string — M9 compares these for equality. */
function hitSetOf(s) { return s.row.filter((r) => r.hit).map((r) => r.d).join(','); }

const fails = [];
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

if (want('ablate')) {
  // ---- RI-CMB04 M8.3 — THE TWO-VOLUME ABLATION -------------------------------------------
  // The check that caught round 3. Round 3's champion reached 0.05 m; delete `§body_hazard`
  // from a copy of the loaded data and it returned to 1.2 / 1.6 / 1.1 / 1.2 m — round 2's
  // numbers to the decimal, because the weapon volume had never been touched and a corridor
  // had been laid over the hole. The item's threshold is 0.35 m of movement, and the weapon's
  // own minimum must still be <= 0.35 m with the corridor gone.
  const shipped = {}, noBody = {}, noRootDz = {};
  const dvBody = variant({ ablate: 'body' });
  const dvRoot = variant({ ablate: 'rootdz' });
  R.probes.ablate = { enemy: {}, player: {} };
  for (const move of (doEnemy ? Object.keys(data._enemies[ENEMY].attacks) : [])) {
    shipped[move] = sweep((d) => enemySwing(d, move));
    noBody[move] = sweep((d) => enemySwingWith(dvBody, d, move));
    noRootDz[move] = sweep((d) => enemySwingWith(dvRoot, d, move));
    const a = shipped[move].min_hit_distance_m, b = noBody[move].min_hit_distance_m;
    const bodyHitsAtZeroDz = noRootDz[move].row.reduce((n, r) => n + (r.events || []).filter((e) => e.via === 'body').length, 0);
    R.probes.ablate.enemy[move] = {
      shipped_min_m: a, ablated_body_min_m: b,
      delta_m: (a === null || b === null) ? null : +(b - a).toFixed(3),
      shipped_contiguous: shipped[move].contiguous, ablated_body_contiguous: noBody[move].contiguous,
      ablated_body_interior_gaps_m: noBody[move].interior_gaps_m,
      body_only_distances_m: shipped[move].body_only_distances_m,
      root_dz_zero_body_hits: bodyHitsAtZeroDz,
      root_dz_zero_min_m: noRootDz[move].min_hit_distance_m,
      attribution: shipped[move].attribution,
      body_damage_ge_weapon: shipped[move].body_damage_ge_weapon,
    };
  }
  for (const w of (doPlayer ? PLAYER_WEAPONS : [])) {
    const s = sweep((d) => playerSwing(d, w));
    const n = sweep((d) => playerSwingWith(dvBody, d, w));
    const z = sweep((d) => playerSwingWith(dvRoot, d, w));
    const bodyHitsAtZeroDz = z.row.reduce((k, r) => k + (r.events || []).filter((e) => e.via === 'body').length, 0);
    R.probes.ablate.player[w] = {
      shipped_min_m: s.min_hit_distance_m, ablated_body_min_m: n.min_hit_distance_m,
      delta_m: (s.min_hit_distance_m === null || n.min_hit_distance_m === null) ? null
        : +(n.min_hit_distance_m - s.min_hit_distance_m).toFixed(3),
      shipped_contiguous: s.contiguous, ablated_body_contiguous: n.contiguous,
      ablated_body_interior_gaps_m: n.interior_gaps_m,
      body_only_distances_m: s.body_only_distances_m,
      root_dz_zero_body_hits: bodyHitsAtZeroDz,
      attribution: s.attribution,
      body_damage_ge_weapon: s.body_damage_ge_weapon,
    };
  }
}

if (want('substep')) {
  // ---- RI-CMB04 M9 — THE SUBSTEP ABLATION, AS A RESULT ------------------------------------
  // M2 has always carried the clause; it has never been reported as a number. Round 3's hit set
  // at `substeps = 1` was byte-identical to the shipped value across 71 distances, which is the
  // M2 failure the item already defines — "sweeping is not actually implemented and the substep
  // parameter is decorative". FAIL if the differing set is EMPTY.
  R.probes.substep = { shipped: BASE.hitgeometry.sweep.substeps, compared: [1], changed: [], per_attack: {} };
  const dv1 = variant({ substeps: 1 });
  for (const move of (doEnemy ? Object.keys(data._enemies[ENEMY].attacks) : [])) {
    const s = sweep((d) => enemySwing(d, move));
    const o = sweep((d) => enemySwingWith(dv1, d, move));
    const diff = [];
    for (let i = 0; i < s.row.length; i++) if (s.row[i].hit !== o.row[i].hit) diff.push({ d: s.row[i].d, shipped: s.row[i].hit, substeps1: o.row[i].hit });
    R.probes.substep.per_attack['enemy/' + move] = { changed: diff.length, pairs: diff, identical: hitSetOf(s) === hitSetOf(o) };
    for (const p of diff) R.probes.substep.changed.push({ attack: 'enemy/' + move, ...p });
  }
  for (const w of (doPlayer ? PLAYER_WEAPONS : [])) {
    const s = sweep((d) => playerSwing(d, w));
    const o = sweep((d) => playerSwingWith(dv1, d, w));
    const diff = [];
    for (let i = 0; i < s.row.length; i++) if (s.row[i].hit !== o.row[i].hit) diff.push({ d: s.row[i].d, shipped: s.row[i].hit, substeps1: o.row[i].hit });
    R.probes.substep.per_attack['player/' + w] = { changed: diff.length, pairs: diff, identical: hitSetOf(s) === hitSetOf(o) };
    for (const p of diff) R.probes.substep.changed.push({ attack: 'player/' + w, ...p });
  }
}

if (want('corridor')) {
  // ---- S26's CORRIDOR, DEMONSTRATED — and RI-MTH07's CONSUMPTION check on its own numbers ----
  //
  // At zero lateral offset the corridor is invisible, and that is CORRECT rather than broken:
  // `§E` rule 3 de-dups one event per (attack instance, target), and once the blade connects the
  // swing is spent. So the `--probe ablate` attribution table shows `weapon` only, and a reader
  // could conclude the corridor is inert. It is not — it is SHADOWED.
  //
  // Where it fires is where the blade misses and the body does not: a target standing OFF the
  // swing plane that a lunging attacker runs down. This probe sweeps lateral offset as well as
  // distance, so S26's positive requirement is demonstrated on an entity-side observable rather
  // than asserted, and then perturbs `§body_hazard.damage`'s own constants and watches the
  // damage move. `RI-MTH07` §B: two well-separated values, everything else held, plus the null
  // control.
  const dmgVariant = (patch) => {
    if (!patch) return data;
    const d = JSON.parse(JSON.stringify(data));
    Object.assign(d.hitgeometry.body_hazard.damage, patch);
    return d;
  };
  const runOne = (dv, x, z, move) => {
    const a = new NodeArena({ data: dv, loadout: { weapon: 'straight-sword' } });
    a.player.pos[0] = x; a.player.pos[2] = z; a.player.yaw = 180; a.player.evaluateRig(0);
    a.spawn('E1', ENEMY, 0, 0, 0);
    a.lockOn('E1');
    a.script('E1', [{ f: 4, move }]);
    a.queueInputs([{ f: 1, move: [0, 0] }]);
    const P = a.cs.bodyOf('P');
    const evs = [];
    for (let i = 0; i < 170; i++) {
      a.step();
      for (const e of a.drain()) if (e.kind === 'HIT' && e.dst === 'P') evs.push({ via: e.via, dmg: e.dmg, pd: e.pd, dmg_if_weapon: e.dmg_if_weapon });
    }
    return evs;
  };
  const cells = [];
  for (const move of Object.keys(data._enemies[ENEMY].attacks)) {
    for (let x = 0; x <= 1.6001; x += 0.2) {
      for (const z of [0.05, 0.5, 1.0]) cells.push({ move, x: +x.toFixed(2), z });
    }
  }
  const shipped = [];
  for (const c of cells) for (const e of runOne(data, c.x, c.z, c.move)) shipped.push({ ...c, ...e });
  const body = shipped.filter((e) => e.via === 'body');
  const violations = body.filter((e) => e.dmg_if_weapon !== undefined && e.dmg >= e.dmg_if_weapon);

  // CONSUMPTION: two well-separated values per constant, held against the shipped run, on the
  // cells where the corridor actually fires. The null control re-runs the shipped data.
  const cellsWithBody = [];
  const seen = new Set();
  for (const e of body) { const k = e.move + '|' + e.x + '|' + e.z; if (!seen.has(k)) { seen.add(k); cellsWithBody.push({ move: e.move, x: e.x, z: e.z }); } }
  const totalBody = (dv) => {
    let dmg = 0, pd = 0, n = 0;
    for (const c of cellsWithBody) for (const e of runOne(dv, c.x, c.z, c.move)) if (e.via === 'body') { dmg += e.dmg; pd += e.pd; n++; }
    return { events: n, dmg, pd };
  };
  const base = totalBody(data);
  const coupling = {
    null_control: totalBody(dmgVariant(null)),
    'base_hp=0': totalBody(dmgVariant({ base_hp: 0, per_mps: 0 })),
    'base_hp=30': totalBody(dmgVariant({ base_hp: 30 })),
    'per_mps=0': totalBody(dmgVariant({ per_mps: 0 })),
    'per_mps=12': totalBody(dmgVariant({ per_mps: 12 })),
    'poise_damage=0': totalBody(dmgVariant({ poise_damage: 0 })),
    'poise_damage=60': totalBody(dmgVariant({ poise_damage: 60 })),
    'hard_cap_fraction=0.05': totalBody(dmgVariant({ hard_cap_fraction_of_weapon: 0.05 })),
  };
  R.probes.corridor = {
    cells_swept: cells.length, hit_events: shipped.length, body_events: body.length,
    cells_where_corridor_fires: cellsWithBody.length,
    body_dmg_range: body.length ? [Math.min(...body.map((e) => e.dmg)), Math.max(...body.map((e) => e.dmg))] : null,
    weapon_dmg_for_same_attacks: body.length ? [Math.min(...body.map((e) => e.dmg_if_weapon)), Math.max(...body.map((e) => e.dmg_if_weapon))] : null,
    body_poise_damage: [...new Set(body.map((e) => e.pd))],
    m8_4_violations: violations,
    shipped_totals: base,
    coupling,
    sample: body.slice(0, 12),
  };
  if (!body.length) fails.push('S26: the body corridor never fired at any (distance, lateral offset) in the sweep — coupling 0 on a model the ruling requires to act');
  if (violations.length) fails.push(`M8.4: ${violations.length} corridor hits paid >= the blade`);
  for (const k of Object.keys(coupling)) {
    if (k === 'null_control') {
      if (coupling[k].dmg !== base.dmg) fails.push('CONSUMPTION: the null control disagreed with the shipped run — the measurement is noise');
      continue;
    }
    if (coupling[k].dmg === base.dmg && coupling[k].pd === base.pd) fails.push(`CONSUMPTION: perturbing ${k} changed nothing — coupling 0`);
  }
}

if (want('radius')) {
  // ---- RI-CMB04 M8.5 — ONE BODY, ONE RADIUS ----------------------------------------------
  // "a player who is 0.30 m wide to a sword and 0.55 m wide to a wall is two different
  // characters." Read BOTH numbers out of the running code rather than out of the data files,
  // because the defect this check exists for is a second copy that drifted.
  const wc = await import('../../game/src/sim/world-collision.js');
  const a = new NodeArena({ data, loadout: { weapon: 'straight-sword' } });
  a.spawn('E1', ENEMY, 0, 2, 180);
  const P = a.cs.bodyOf('P'), E = a.cs.bodyOf('E1');
  const rows = [
    { actor: 'player', hit_push_radius_m: P.bodyRadius, world_collision_radius_m: wc.PLAYER_RADIUS_M },
    { actor: ENEMY, hit_push_radius_m: E.bodyRadius, world_collision_radius_m: wc.worldCollisionRadiusOf ? wc.worldCollisionRadiusOf(E) : null },
  ];
  for (const r of rows) {
    r.delta_m = (r.world_collision_radius_m === null) ? null : +Math.abs(r.hit_push_radius_m - r.world_collision_radius_m).toFixed(3);
  }
  R.probes.radius = { rows, threshold_m: ACCEPT.radius_delta_max_m };
}

if (argv.includes('--verify')) {
  // ---- RI-MTH07 §D — A PARTIAL-WORLD HARNESS MUST SHIP A WORKING `VERIFY` -----------------
  //
  // `tools/lib/combat-node.mjs` runs `game/src/combat/*.js` outside the engine. Its own header
  // and this file's header BOTH asserted that "`cmb-reach.mjs --verify` runs a sample of rows
  // through both and fails if they differ". **The flag did not exist.** `arg()` never read it,
  // no browser was ever launched, and passing it changed nothing — which the round-3 critic
  // found and which is exactly the shape RI-MTH07 §D was amended to forbid: a partial-world
  // harness whose cross-check is a sentence.
  //
  // It exists now. A sample of (attack, distance) rows is re-run through `window.__HARNESS` in
  // headless Chromium — the shipping engine, whose fixed step ALSO runs stealth perception and
  // therefore sets AGGRO, which is the documented reason node and browser diverge on long
  // fights. These rows are short single-swing fights, well inside the regime where the two are
  // expected to agree, and any disagreement is a defect in `combat-node.mjs`: the browser wins.
  const { launchGame, requireMethods } = await import('../lib/browser.mjs');
  const handle = await launchGame({ width: 320, height: 240 });
  // AGENT-PROTOCOL: rendering off BEFORE any stepping loop. 600 bare frames cost 71 ms; the
  // same 600 driven one at a time with the renderer live never returns.
  await handle.hOpt('setRenderRate', 0);
  await requireMethods(handle, ['setSeed', 'loadState', 'stepFrames', 'queueInputs',
    'getCombatState', 'queueEnemyScript', 'teleport', 'spawn', 'despawn', 'lockOn']);

  const moves = Object.keys(data._enemies[ENEMY].attacks);
  // A sample that spans the interesting band: inside the body, at the separation boundary, at
  // the old dead ring, and out past the declared reach.
  const dists = [0.05, 0.35, 0.8, 1.2, 2.0, 3.0];
  const cases = [];
  for (const m of moves) for (const d of dists) cases.push({ move: m, d });

  const browser = await handle.page.evaluate((cfg) => {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const out = [];
    for (const c of cfg.cases) {
      H.setSeed(0); H.loadState('arena_champion');
      try { H.despawn('E1'); } catch (e) { /* already gone */ }
      H.spawn(cfg.enemy, 0, 0, { as: 'E1', yaw: 0 });
      H.lockOn('E1');
      H.teleport(0, c.d, { yaw: 180 });
      H.queueEnemyScript('E1', [{ f: 4, move: c.move }]);
      H.queueInputs([{ f: 0, move: [0, 0] }]);
      const hp0 = cs().player.hp;
      for (let k = 0; k < 200; k++) H.stepFrames(1);
      const hp1 = cs().player.hp;
      out.push({ move: c.move, d: c.d, hit: hp1 < hp0, dmg: Math.round(hp0 - hp1) });
    }
    return out;
  }, { cases, enemy: ENEMY });
  await handle.close();

  const rows = [];
  for (const b of browser) {
    const n = enemySwing(b.d, b.move);
    rows.push({
      case: `${b.move} @ ${b.d} m`,
      node: `${n.hit ? 'hit' : 'miss'} ${n.dmg}`,
      browser: `${b.hit ? 'hit' : 'miss'} ${b.dmg}`,
      agree: n.hit === b.hit,
      damage_agree: n.dmg === b.dmg,
    });
  }
  R.verify = {
    _source: 'RI-MTH07 §D — a partial-world harness must ship a working VERIFY',
    rows,
    disagreements: rows.filter((r) => !r.agree).length,
    damage_disagreements: rows.filter((r) => !r.damage_agree).length,
  };
}

// ---- verdict --------------------------------------------------------------------------------
if (R.verify) {
  for (const v of R.verify.rows) {
    if (!v.agree) fails.push(`VERIFY ${v.case}: node says ${v.node}, the browser says ${v.browser} — combat-node.mjs is not the game`);
  }
}
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
if (R.probes.ablate) {
  for (const side of ['enemy', 'player']) {
    for (const k of Object.keys(R.probes.ablate[side])) {
      const v = R.probes.ablate[side][k];
      const tag = `M8.3 ${side}/${k}`;
      if (v.ablated_body_min_m === null) { fails.push(`${tag}: with §body_hazard ablated the attack never connects at any distance — the corridor IS the reach`); continue; }
      if (v.ablated_body_min_m > ACCEPT.min_hit_distance_m) fails.push(`${tag}: weapon-only min reach ${v.ablated_body_min_m} m > ${ACCEPT.min_hit_distance_m} m`);
      if (v.delta_m !== null && Math.abs(v.delta_m) > ACCEPT.ablation_delta_max_m) fails.push(`${tag}: ablating the corridor moved min reach by ${v.delta_m} m > ${ACCEPT.ablation_delta_max_m} m — that difference IS the hole the corridor covers`);
      if (!v.ablated_body_contiguous) fails.push(`${tag}: weapon-only band has interior gaps at ${v.ablated_body_interior_gaps_m.join(', ')} m`);
      if (v.root_dz_zero_body_hits > 0) fails.push(`M8.3 ${side}/${k}: root_dz == 0 still produced ${v.root_dz_zero_body_hits} body-corridor hits — the corridor is a proximity check, AR-1 fires`);
      if (v.body_damage_ge_weapon.length) fails.push(`M8.4 ${side}/${k}: ${v.body_damage_ge_weapon.length} corridor hits paid >= the blade (${JSON.stringify(v.body_damage_ge_weapon[0])})`);
    }
  }
}
if (R.probes.substep) {
  if (!R.probes.substep.changed.length) {
    fails.push('M9: the hit set at substeps = 1 is identical to the shipped value on every (attack, distance) pair — sweeping is not actually implemented and the substep parameter is decorative');
  }
}
if (R.probes.radius) {
  for (const r of R.probes.radius.rows) {
    if (r.delta_m === null) { fails.push(`M8.5 ${r.actor}: world-collision radius not reportable`); continue; }
    if (r.delta_m > ACCEPT.radius_delta_max_m) fails.push(`M8.5 ${r.actor}: hit/push radius ${r.hit_push_radius_m} m vs world-collision ${r.world_collision_radius_m} m — differ by ${r.delta_m} m > ${ACCEPT.radius_delta_max_m} m`);
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
if (R.probes.ablate) {
  lines.push('\n  M8.3 TWO-VOLUME ABLATION — delete §body_hazard from a DEEP COPY of the loaded data');
  lines.push('    attack                   shipped   weapon-only   delta   contig   body-only distances   root_dz=0 body hits');
  for (const side of ['enemy', 'player']) {
    for (const k of Object.keys(R.probes.ablate[side])) {
      const v = R.probes.ablate[side][k];
      lines.push(`    ${(side + '/' + k).padEnd(24)} ${String(v.shipped_min_m).padStart(5)}   ${String(v.ablated_body_min_m).padStart(9)}   ${String(v.delta_m).padStart(6)}   ${v.ablated_body_contiguous ? 'yes' : 'NO '}      ${String(v.body_only_distances_m.length).padStart(4)}                  ${v.root_dz_zero_body_hits}`);
    }
  }
  lines.push('\n  M8.4 ATTRIBUTION — what each route charged');
  lines.push('    attack                   via       events   dmg min..max   poise dmg');
  for (const side of ['enemy', 'player']) {
    for (const k of Object.keys(R.probes.ablate[side])) {
      const at = R.probes.ablate[side][k].attribution;
      for (const via of Object.keys(at)) {
        const s = at[via];
        lines.push(`    ${(side + '/' + k).padEnd(24)} ${via.padEnd(9)} ${String(s.events).padStart(6)}   ${String(s.dmg_min).padStart(5)}..${String(s.dmg_max).padEnd(5)}    ${s.pd.join('/')}`);
      }
    }
  }
}
if (R.probes.substep) {
  lines.push(`\n  M9 SUBSTEP ABLATION — shipped ${R.probes.substep.shipped} vs 1`);
  lines.push(`    (attack, distance) pairs whose outcome CHANGED: ${R.probes.substep.changed.length}`);
  for (const k of Object.keys(R.probes.substep.per_attack)) {
    const v = R.probes.substep.per_attack[k];
    lines.push(`    ${k.padEnd(24)} changed ${String(v.changed).padStart(3)}   ${v.pairs.slice(0, 6).map((p) => p.d + (p.shipped ? '(lost)' : '(gained)')).join(' ')}`);
  }
}
if (R.probes.radius) {
  lines.push('\n  M8.5 ONE BODY, ONE RADIUS');
  lines.push('    actor                  hit/push   world collision   delta');
  for (const r of R.probes.radius.rows) {
    lines.push(`    ${r.actor.padEnd(22)} ${String(r.hit_push_radius_m).padStart(6)}   ${String(r.world_collision_radius_m).padStart(15)}   ${r.delta_m}`);
  }
}
if (R.verify) {
  lines.push(`\n  --verify — RI-MTH07 §D, node arena vs the BROWSER (${R.verify.rows.length} rows)`);
  lines.push('    attack / distance                node        browser     agree');
  for (const v of R.verify.rows) {
    lines.push(`    ${v.case.padEnd(30)} ${String(v.node).padEnd(11)} ${String(v.browser).padEnd(11)} ${v.agree ? 'yes' : 'NO'}`);
  }
}
if (R.probes.corridor) {
  const c = R.probes.corridor;
  lines.push('\n  S26 CORRIDOR — demonstrated, priced, and perturbed');
  lines.push(`    cells swept ${c.cells_swept}   hit events ${c.hit_events}   via:body ${c.body_events}   cells where it fires ${c.cells_where_corridor_fires}`);
  lines.push(`    body damage ${JSON.stringify(c.body_dmg_range)}  vs the same attacks' blade ${JSON.stringify(c.weapon_dmg_for_same_attacks)}   body poise dmg ${JSON.stringify(c.body_poise_damage)}`);
  lines.push(`    M8.4 violations (body >= weapon): ${c.m8_4_violations.length}`);
  lines.push('    CONSUMPTION — perturb §body_hazard.damage, observe the entity');
  lines.push(`      shipped                     events ${c.shipped_totals.events}  total dmg ${c.shipped_totals.dmg}  total poise ${c.shipped_totals.pd}`);
  for (const k of Object.keys(c.coupling)) {
    const v = c.coupling[k];
    lines.push(`      ${k.padEnd(26)} events ${String(v.events).padStart(3)}  total dmg ${String(v.dmg).padStart(5)}  total poise ${String(v.pd).padStart(5)}  ${k === 'null_control' ? (v.dmg === c.shipped_totals.dmg ? '(control OK)' : '(CONTROL DIVERGED)') : ((v.dmg !== c.shipped_totals.dmg || v.pd !== c.shipped_totals.pd) ? 'coupled' : 'COUPLING 0')}`);
  }
}
lines.push('');
lines.push(R.ok ? '  ACCEPTANCE: pass' : '  ACCEPTANCE: FAIL\n' + fails.map((f) => '    - ' + f).join('\n'));
process.stdout.write(lines.join('\n') + '\n');
process.exit(R.ok ? 0 : 1);
