#!/usr/bin/env node
// W1-12 ROUND-1 CRITIC — the instrument the verdict is decided on. Written with fresh context,
// independently of tools/harness/ai-probe.mjs, and declared under `method_deviations`.
//
// It answers four questions the builder's own probe does not ask:
//
//   --mode=census      ARBITRATION §3 CONSUMPTION, done EXHAUSTIVELY rather than on one
//                      parameter. Every numeric/boolean leaf of game/data/combat/ai.json is
//                      perturbed one at a time, a fixed 1,800-frame fight is re-run for every
//                      shipped statblock, and the enemy's whole per-frame trace is hashed.
//                      A leaf whose perturbation moves no trace on any statblock HAS NO
//                      WORLD-SIDE CONSUMER — RI-MTH07 scores that exactly as a missing model.
//                      The instrument's own falsifiability is the point: a control leaf that
//                      MUST move the trace (circle.preferred_band_multiple, the one leaf the
//                      builder demonstrated) and a control leaf that MUST NOT (an archetype row
//                      no shipped statblock selects) are both asserted, and the tool exits
//                      non-zero if either control comes out the wrong way.
//
//   --mode=variety     RULES 8 / axis F. One identical fight per shipped statblock, reduced to
//                      a behaviour signature. Counts DISTINCT signatures across the roster.
//
//   --mode=commit      Axis D. How many frames after an attack starts can the enemy change its
//                      mind? Measured by yanking the player 40 m away on the frame the swing
//                      begins and watching whether the body finishes the clip, whether the yaw
//                      moves during active/recovery, and whether the AI re-enters a decision
//                      state before the declared total.
//
//   --mode=speed       Axis D. The builder's fixture moves the player on a Lissajous curve whose
//                      peak speed is ~1.6 m/s — below the game's own 2.0 m/s WALK. This re-runs
//                      the headline spacing check at walk, jog and sprint, which is the speed
//                      range the piece's own survey §3a says the question turns on.
//
//   --mode=census2     the fair half of the census: every leaf the duel could not move, re-run
//                      over four fixtures (duel, flee, five-body group, repeated heal), so a leaf
//                      is only called dead if it stays still in all four.
//   --mode=flee        can the enemy close on a player who simply walks away?
//   --mode=punish      RI-AI01 T22's three triggers, not just the flask, over twelve offsets.
//   --mode=recover     RI-AI01 M3 computed both ways — as this build labels its states, and as
//                      §D T15 defines them — plus the windup yaw rate and yaw budget.
//
// HOW IT CAN FAIL, which is the part that matters. `--mode=census` asserts two controls and
// **exits non-zero** if either comes out the wrong way: `circle.preferred_band_multiple` (the
// one leaf the builder demonstrated) MUST move the trace, and an archetype row no shipped
// statblock selects MUST NOT. A census that cannot see a live parameter, or that fires on a dead
// one, reports nothing — so both directions are checked rather than assumed. Run it against a
// tree with `ai.json`'s `enabled` set to false and every leaf goes inert, which is the arm the
// verdict's delete-the-behaviour leg uses.
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
const flag = (k) => argv.includes(`--${k}`);

const FRAMES = Number(opt('frames', 1800));
const SEED = Number(opt('seed', 1337));

// The statblocks that actually carry attacks — the fighting roster. Read off the data rather
// than hard-coded, so a statblock added tomorrow is measured tomorrow.
function fightingRoster(data) {
  return Object.keys(data._enemies)
    .filter((id) => {
      const s = data._enemies[id];
      return s.attacks && Object.keys(s.attacks).length > 0;
    })
    .sort();
}

// ---------------------------------------------------------------------------------------------
// The fixture.
//
// RULES 8: the target moves. The builder's own fixture moves it at a peak of ~1.6 m/s, which is
// slower than this game's WALK (game/src/sim/state.js PLAYER_CONST walk 2.0, jog 3.2, sprint
// 5.0). `speed` here is a real m/s and the path is arc-length parameterised so the player
// actually travels at it.
// ---------------------------------------------------------------------------------------------
function playerAt(i, speed) {
  // A closed figure-of-eight of circumference ~40 m, walked at `speed`.
  const s = (i / 60) * speed;
  const t = (s / 40) * Math.PI * 2;
  return [8.0 * Math.sin(t), 4.0 * Math.sin(2 * t)];
}

function runFight(data, statId, { frames = FRAMES, seed = SEED, speed = 1.6, breakAI = null } = {}) {
  const arena = new NodeArena({ data, seed });
  const stat = data._enemies[statId];
  const arow = data.ai.archetype[stat.archetype];
  const omega = stat.reach_m || (arow && arow.omega_m) || 2.0;
  const b = arena.spawn('e1', statId, 0, 5.0 * omega, 180);
  const ctl = arena.cs.enemies.get('e1');
  const p = arena.player;
  const rows = [];
  for (let i = 0; i < frames; i++) {
    const [px, pz] = playerAt(i, speed);
    p.pos[0] = px; p.pos[2] = pz;
    ctl.alert = 100; ctl.alertState = 'AGGRO';
    const yawBefore = b.yaw;
    arena.step();
    if (breakAI) breakAI(ctl, b, arena);
    const dist = Math.hypot(p.pos[0] - b.pos[0], p.pos[2] - b.pos[2]);
    rows.push({
      f: arena.frame,
      st: (ctl.ai && ctl.ai.state) || b.state,
      bs: b.state,
      d: dist,
      x: b.pos[0], z: b.pos[2], yaw: b.yaw,
      sp: b.speedMps || 0,
      dyaw: Math.abs(ang180(b.yaw - yawBefore)) * 60,
      mv: b.move ? b.move.id : null,
      tok: ctl.ai ? !!ctl.ai.token : false,
      hp: b.hp,
    });
  }
  return { rows, omega, stat, ctl, b, arena };
}

function ang180(d) { d %= 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; }
function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
function stdev(a) { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); }

/** The whole observable behaviour of the enemy, as one hash. 1e-4 m / 1e-3 deg resolution. */
function traceHash(rows) {
  const h = crypto.createHash('sha1');
  for (const r of rows) {
    h.update(`${r.st}|${r.bs}|${r.x.toFixed(4)}|${r.z.toFixed(4)}|${r.yaw.toFixed(3)}|${r.mv || '-'}|${r.tok ? 1 : 0}|${r.hp.toFixed(2)}\n`);
  }
  return h.digest('hex').slice(0, 16);
}

/** RI-AI01 M3/M4/M5's numbers plus enough shape to tell two enemies apart. */
function signature(rows, omega, cfg) {
  const nonCommit = rows.filter((r) => r.st !== 'COMMIT');
  const hist = {};
  for (const r of rows) hist[r.st] = (hist[r.st] || 0) + 1;
  const starts = [];
  for (let i = 1; i < rows.length; i++) if (rows[i].st === 'COMMIT' && rows[i - 1].st !== 'COMMIT') starts.push(i);
  const intervals = starts.slice(1).map((v, i) => v - starts[i]);
  let t13 = 0, t14 = 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i - 1].st === 'FEINT_STEP' && rows[i].st === 'COMMIT') t13++;
    if (rows[i - 1].st === 'FEINT_STEP' && rows[i].st !== 'FEINT_STEP' && rows[i].st !== 'COMMIT') t14++;
  }
  const moves = {};
  for (let i = 1; i < rows.length; i++) if (rows[i].mv && rows[i].mv !== rows[i - 1].mv) moves[rows[i].mv] = (moves[rows[i].mv] || 0) + 1;
  const ent = Object.values(hist).map((n) => n / rows.length).reduce((a, q) => a - (q > 0 ? q * Math.log2(q) : 0), 0);
  return {
    spacing_variance: +stdev(rows.map((r) => r.d)).toFixed(4),
    mean_dist_m: +mean(rows.map((r) => r.d)).toFixed(4),
    min_dist_dwell: +(nonCommit.length ? nonCommit.filter((r) => r.d < cfg.bands.strike * omega).length / nonCommit.length : 1).toFixed(4),
    state_entropy: +ent.toFixed(4),
    commits: starts.length,
    inter_commit_cov: +(intervals.length >= 2 ? stdev(intervals) / mean(intervals) : 0).toFixed(4),
    feint_release_ratio: +((t13 + t14) ? t14 / (t13 + t14) : -1).toFixed(4),
    mean_speed_mps: +mean(rows.map((r) => r.sp)).toFixed(4),
    state_fractions: Object.fromEntries(Object.keys(hist).sort().map((k) => [k, +(hist[k] / rows.length).toFixed(3)])),
    move_starts: moves,
    omega_m: omega,
  };
}

/** The signature with the per-enemy scale factors removed — is the SHAPE of the fight different? */
function shapeKey(sig) {
  return JSON.stringify({
    states: Object.keys(sig.state_fractions).sort(),
    frac: Object.fromEntries(Object.entries(sig.state_fractions).map(([k, v]) => [k, Math.round(v * 20)])),
    dwell: Math.round(sig.min_dist_dwell * 20),
    cov: Math.round(sig.inter_commit_cov * 10),
    feint: Math.round(sig.feint_release_ratio * 10),
    // spacing and mean distance are proportional to omega by construction; divide it out, so a
    // "different" enemy has to differ in something other than how long its arms are.
    space: Math.round((sig.spacing_variance / sig.omega_m) * 20),
    dist: Math.round((sig.mean_dist_m / sig.omega_m) * 20),
  });
}

// ---------------------------------------------------------------------------------------------
// CENSUS
// ---------------------------------------------------------------------------------------------
function leaves(obj, prefix = '', out = []) {
  for (const k of Object.keys(obj)) {
    if (k.startsWith('_')) continue;                       // the file's own commentary
    const v = obj[k];
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, p, out);
    else if (Array.isArray(v) && v.every((e) => typeof e === 'number')) out.push({ path: p, kind: 'numarray', value: v });
    else if (Array.isArray(v) && v.every((e) => e && typeof e === 'object')) {
      v.forEach((e, i) => leaves(e, `${p}[${i}]`, out));
    } else if (typeof v === 'number') out.push({ path: p, kind: 'number', value: v });
    else if (typeof v === 'boolean') out.push({ path: p, kind: 'bool', value: v });
    else if (typeof v === 'string') out.push({ path: p, kind: 'string', value: v });
  }
  return out;
}

function getIn(o, p) {
  return p.split('.').reduce((a, k) => {
    const m = /^(.+)\[(\d+)\]$/.exec(k);
    return m ? a[m[1]][Number(m[2])] : a[k];
  }, o);
}
function setIn(o, p, v) {
  const parts = p.split('.');
  const last = parts.pop();
  const parent = parts.reduce((a, k) => {
    const m = /^(.+)\[(\d+)\]$/.exec(k);
    return m ? a[m[1]][Number(m[2])] : a[k];
  }, o);
  const m = /^(.+)\[(\d+)\]$/.exec(last);
  if (m) parent[m[1]][Number(m[2])] = v; else parent[last] = v;
}

function perturbValue(leaf) {
  if (leaf.kind === 'number') return leaf.value === 0 ? 1 : leaf.value * 2.0;
  if (leaf.kind === 'numarray') return leaf.value.map((v) => (v === 0 ? 1 : v * 2.0));
  if (leaf.kind === 'bool') return !leaf.value;
  return null;
}

function census(baseData, roster) {
  const aiPath = path.join(GAME_DATA, 'combat/ai.json');
  const aiSrc = JSON.parse(fs.readFileSync(aiPath, 'utf8'));
  // Only the behaviour tables. `override` maps ids to strings and `declared_incomplete` is prose.
  const scope = {};
  for (const k of ['bands', 'perception', 'movement', 'circle', 'commit', 'leash', 'punish_read', 'archetype']) scope[k] = aiSrc[k];
  const ls = leaves(scope).filter((l) => l.kind !== 'string');

  // baseline per statblock
  const base = {};
  for (const id of roster) base[id] = traceHash(runFight(baseData, id).rows);

  const results = [];
  for (const leaf of ls) {
    const moved = [];
    for (const id of roster) {
      const d2 = loadCombatData();
      const nv = perturbValue(leaf);
      if (nv === null) continue;
      setIn(d2.ai, leaf.path, nv);
      const h = traceHash(runFight(d2, id).rows);
      if (h !== base[id]) moved.push(id);
    }
    results.push({
      path: leaf.path,
      value: leaf.value,
      perturbed_to: perturbValue(leaf),
      consumed_by: moved,
      consumed: moved.length > 0,
    });
  }
  return { base, results };
}

// ---------------------------------------------------------------------------------------------
// CENSUS 2 — the fair half.
//
// A single duel fixture never enters RUSH, LEASH_RETURN, PUNISH_READ or token contention, so a
// leaf that governs one of those comes out "inert" for a reason that belongs to the INSTRUMENT
// and not to the build. Calling that a dead parameter would be exactly the kind of finding a
// critic should be embarrassed by. So every leaf the duel census could not move is re-run over
// three more fixtures that DO reach those states, and only a leaf that stays still in all four
// is reported as having no world-side consumer.
// ---------------------------------------------------------------------------------------------
function fixtureFlee(data, statId) {
  const arena = new NodeArena({ data, seed: SEED });
  const stat = data._enemies[statId];
  const b = arena.spawn('e1', statId, 0, 10, 180);
  const ctl = arena.cs.enemies.get('e1');
  const p = arena.player;
  const rows = [];
  for (let i = 0; i < 1800; i++) {
    p.pos[0] = 0; p.pos[2] = -(i / 60) * 3.2;         // jog away in a straight line
    ctl.alert = 100; ctl.alertState = 'AGGRO';
    arena.step();
    rows.push({ st: ctl.ai ? ctl.ai.state : b.state, bs: b.state, x: b.pos[0], z: b.pos[2], yaw: b.yaw, mv: b.move ? b.move.id : null, tok: ctl.ai ? ctl.ai.token : false, hp: b.hp });
  }
  return rows;
}

function fixtureGroup(data, statId) {
  const arena = new NodeArena({ data, seed: SEED });
  arena.cs.entityOf = () => ({ encounterId: 'critic-group' });
  const ids = ['g0', 'g1', 'g2', 'g3', 'g4'];
  const bodies = ids.map((id, k) => arena.spawn(id, statId, Math.cos(k * 1.3) * 5, Math.sin(k * 1.3) * 5, 0));
  const ctls = ids.map((id) => arena.cs.enemies.get(id));
  const p = arena.player;
  const rows = [];
  for (let i = 0; i < 1200; i++) {
    const [px, pz] = playerAt(i, 1.6);
    p.pos[0] = px; p.pos[2] = pz;
    for (const c of ctls) { c.alert = 100; c.alertState = 'AGGRO'; }
    arena.step();
    rows.push({
      st: ctls.map((c) => (c.ai ? c.ai.state : '?')).join('/'),
      bs: ctls.filter((c) => c.ai && c.ai.token).length,
      x: bodies[0].pos[0], z: bodies[2].pos[2], yaw: bodies[4].yaw,
      mv: bodies.map((bb) => (bb.move ? bb.move.id : '-')).join(','),
      tok: ctls.filter((c) => c.ai && c.ai.state === 'COMMIT').length, hp: bodies[1].hp,
    });
  }
  return rows;
}

function fixturePunish(data, statId) {
  const arena = new NodeArena({ data, seed: SEED });
  const stat = data._enemies[statId];
  const omega = stat.reach_m || data.ai.archetype[stat.archetype].omega_m;
  const b = arena.spawn('e1', statId, 0, 5.0 * omega, 180);
  const ctl = arena.cs.enemies.get('e1');
  const p = arena.player;
  const rows = [];
  for (let i = 0; i < 1200; i++) {
    ctl.alert = 100; ctl.alertState = 'AGGRO';
    // drink on a cycle, far enough out that PUNISH_READ's band matters
    if (i % 200 === 0 && p.moves.heal && !p.move) p.begin(p.moves.heal, arena.frame, {});
    arena.step();
    rows.push({ st: ctl.ai ? ctl.ai.state : b.state, bs: b.state, x: b.pos[0], z: b.pos[2], yaw: b.yaw, mv: b.move ? b.move.id : null, tok: ctl.ai ? ctl.ai.token : false, hp: b.hp });
  }
  return rows;
}

const FIXTURES = { duel: (d, s) => runFight(d, s).rows, flee: fixtureFlee, group: fixtureGroup, punish: fixturePunish };

function census2(paths, roster) {
  const base = {};
  for (const fx of Object.keys(FIXTURES)) {
    base[fx] = {};
    for (const id of roster) base[fx][id] = traceHash(FIXTURES[fx](loadCombatData(), id));
  }
  const out = [];
  for (const p of paths) {
    const moved = {};
    for (const fx of Object.keys(FIXTURES)) {
      for (const id of roster) {
        const d2 = loadCombatData();
        const cur = getIn(d2.ai, p);
        const leaf = { path: p, kind: Array.isArray(cur) ? 'numarray' : typeof cur === 'boolean' ? 'bool' : 'number', value: cur };
        setIn(d2.ai, p, perturbValue(leaf));
        if (traceHash(FIXTURES[fx](d2, id)) !== base[fx][id]) { (moved[fx] = moved[fx] || []).push(id); }
      }
    }
    out.push({ path: p, moved, consumed: Object.keys(moved).length > 0 });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// COMMIT — how long is the enemy actually committed?
// ---------------------------------------------------------------------------------------------
function commitProbe(data, statId) {
  const arena = new NodeArena({ data, seed: SEED });
  const stat = data._enemies[statId];
  const arow = data.ai.archetype[stat.archetype];
  const omega = stat.reach_m || arow.omega_m;
  const b = arena.spawn('e1', statId, 0, 1.0 * omega, 180);
  const ctl = arena.cs.enemies.get('e1');
  const p = arena.player;
  const swings = [];
  let cur = null;
  for (let i = 0; i < 3000 && swings.length < 8; i++) {
    // Before the swing starts the player dances in range so a commit can happen at all.
    if (!cur) { const [px, pz] = playerAt(i, 1.6); p.pos[0] = px; p.pos[2] = pz; }
    else { p.pos[0] = 40; p.pos[2] = 40; }   // THE YANK: the reason to change its mind
    ctl.alert = 100; ctl.alertState = 'AGGRO';
    const yawBefore = b.yaw;
    arena.step();
    if (!cur && b.move && b.move.kind === 'attack') {
      cur = {
        move: b.move.id, startF: arena.frame, declared_total: b.move.total,
        startup: b.move.startup, active: b.move.active, recovery: b.move.recovery,
        yaw_moved_after_startup_deg: 0, frames: 0, aborted_at: null,
      };
    } else if (cur) {
      cur.frames++;
      const af = b.animFrame;
      if (af > cur.startup) cur.yaw_moved_after_startup_deg += Math.abs(ang180(b.yaw - yawBefore));
      if (!b.move) {
        cur.ended_at_animframe = af;
        cur.completed = cur.frames >= cur.declared_total - 2;
        swings.push(cur); cur = null;
        // let it re-approach
        for (let j = 0; j < 1; j++) { /* next loop iteration resumes the dance */ }
      } else if (b.move.id !== cur.move) { cur.aborted_at = cur.frames; }
    }
  }
  return swings;
}

// ---------------------------------------------------------------------------------------------
// PUNISH — "does the enemy punish a whiffed swing?"
//
// RI-AI01 T22 names three triggers: HEAL, ITEM and LONG_RECOVERY. The builder's own M9 drives
// only the heal. LONG_RECOVERY is the one that decides whether the enemy is READING the fight or
// reading the flask: it is the player whiffing a committed attack, which is the single most
// common punishable moment in a Souls fight and the one every enemy in Elden Ring answers.
// ---------------------------------------------------------------------------------------------
function punishProbe(data, statId, kind, settle = 60) {
  const arena = new NodeArena({ data, seed: SEED });
  const stat = data._enemies[statId];
  const omega = stat.reach_m || data.ai.archetype[stat.archetype].omega_m;
  const b = arena.spawn('e1', statId, 0, 2.0 * omega, 180);
  const ctl = arena.cs.enemies.get('e1');
  const p = arena.player;
  for (let i = 0; i < settle; i++) { ctl.alert = 100; ctl.alertState = 'AGGRO'; arena.step(); }
  // The player commits to the heaviest thing it owns, and whiffs it into open air.
  const cand = Object.keys(p.moves).filter((k) => !k.startsWith('_') && p.moves[k] && p.moves[k].kind === 'attack' && p.moves[k].recovery !== undefined);
  const heavy = cand.sort((a, c) => (p.moves[c].recovery || 0) - (p.moves[a].recovery || 0))[0];
  const mv = kind === 'heal' ? p.moves.heal : p.moves[heavy];
  if (!mv) return { stat: statId, kind, error: 'no such player move' };
  b.pos[0] = p.pos[0] + 2.0 * omega; b.pos[2] = p.pos[2];   // inside PUNISH_READ's 6.0·Ω band
  arena.player.begin(mv, arena.frame, {});
  let reacted = -1, states = [];
  const startF = arena.frame;
  for (let i = 0; i < 300; i++) {
    ctl.alert = 100; ctl.alertState = 'AGGRO';
    arena.step();
    states.push(ctl.ai ? ctl.ai.state : b.state);
    if (reacted < 0 && ctl.ai && ctl.ai.state === 'PUNISH_READ') reacted = arena.frame - startF;
  }
  const recoveryStart = (mv.startup || 0) + (mv.active || 0);
  return {
    stat: statId, kind, move: mv.id, recovery_f: mv.recovery, startup_f: mv.startup,
    recovery_begins_at_f: recoveryStart,
    punish_read_at_f: reacted,
    enemy_committed_at_start: !!b.move,
    reacted: reacted >= 0,
    reacted_in_window: reacted >= 0 && reacted <= (mv.total || 200),
    states_seen: [...new Set(states)],
  };
}

// ---------------------------------------------------------------------------------------------
function main() {
  const mode = opt('mode', 'census');
  const data = loadCombatData();
  const roster = fightingRoster(data);
  const outDir = path.join(ROOT, 'reports/w1-12-critic');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = { commit: process.env.CRITIC_COMMIT || 'see status file', frames: FRAMES, seed: SEED, mode };

  if (mode === 'variety') {
    const sigs = {};
    const shapes = new Map();
    for (const id of roster) {
      const { rows, omega } = runFight(data, id);
      const s = signature(rows, omega, data.ai);
      s.archetype = data._enemies[id].archetype;
      s.tier = data._enemies[id].tier;
      s.hp = data._enemies[id].hp;
      s.trace_hash = traceHash(rows);
      sigs[id] = s;
      const k = shapeKey(s);
      if (!shapes.has(k)) shapes.set(k, []);
      shapes.get(k).push(id);
    }
    const exact = new Set(Object.values(sigs).map((s) => JSON.stringify({ ...s, archetype: 0, tier: 0, hp: 0, trace_hash: 0, omega_m: 0, mean_dist_m: 0, spacing_variance: 0 })));
    const out = {
      ...stamp,
      roster_size: roster.length,
      distinct_shape_signatures: shapes.size,
      shape_groups: [...shapes.values()],
      distinct_scale_free_signatures: exact.size,
      signatures: sigs,
    };
    fs.writeFileSync(path.join(outDir, 'variety.json'), JSON.stringify(out, null, 2));
    console.log(`roster ${roster.length}: ${roster.join(', ')}`);
    console.log(`DISTINCT BEHAVIOUR SHAPES: ${shapes.size}`);
    for (const [, ids] of shapes) console.log(`  group: ${ids.join(', ')}`);
    for (const id of roster) {
      const s = sigs[id];
      console.log(`  ${id.padEnd(22)} ${s.archetype.padEnd(9)} hp${String(s.hp).padStart(5)} Ω${s.omega_m}  var ${s.spacing_variance}  dwell ${s.min_dist_dwell}  commits ${s.commits}  cov ${s.inter_commit_cov}  feint ${s.feint_release_ratio}  states[${Object.keys(s.state_fractions).join(',')}]`);
    }
    return;
  }

  if (mode === 'commit') {
    const out = {};
    for (const id of roster) out[id] = commitProbe(data, id);
    fs.writeFileSync(path.join(outDir, 'commit.json'), JSON.stringify({ ...stamp, swings: out }, null, 2));
    for (const id of roster) {
      const sw = out[id];
      if (!sw.length) { console.log(`${id.padEnd(22)} NO SWING in 3000 f`); continue; }
      const ok = sw.filter((s) => s.completed).length;
      const yaw = Math.max(...sw.map((s) => s.yaw_moved_after_startup_deg));
      console.log(`${id.padEnd(22)} ${sw.length} swings, ${ok} ran to declared total, max yaw after startup ${yaw.toFixed(3)}°, totals ${sw.map((s) => `${s.move}:${s.frames}/${s.declared_total}`).join(' ')}`);
    }
    return;
  }

  if (mode === 'census2') {
    const prev = JSON.parse(fs.readFileSync(path.join(outDir, 'census.json'), 'utf8'));
    // Everything the duel census could not move, MINUS the archetype rows the file itself
    // declares unrealised — those are inert on purpose and saying otherwise would be dishonest.
    const unrealised = new Set(JSON.parse(fs.readFileSync(path.join(GAME_DATA, 'combat/ai.json'), 'utf8'))._archetypes_absent.unrealised);
    const candidates = prev.inert_paths.filter((p) => {
      const m = /^archetype\.([A-Z_]+)\./.exec(p);
      if (m && (unrealised.has(m[1]) || m[1] === 'DUMMY' || m[1] === 'FIXTURE')) return false;
      return true;
    });
    const small = ['inf_trash', 'beast_slitherfang', 'cst_sap_speaker', 'champion_hist_marked'];
    const res = census2(candidates, small);
    const stillDead = res.filter((r) => !r.consumed);
    fs.writeFileSync(path.join(outDir, 'census2.json'), JSON.stringify({
      ...stamp, fixtures: Object.keys(FIXTURES), roster: small,
      candidates: candidates.length,
      rescued: res.length - stillDead.length,
      still_no_consumer: stillDead.map((r) => r.path),
      results: res,
    }, null, 2));
    console.log(`re-tested ${candidates.length} leaves over 4 fixtures (duel, flee, group, punish) x ${small.length} statblocks`);
    console.log(`  rescued by a fixture that reaches the state: ${res.length - stillDead.length}`);
    console.log(`  STILL NO WORLD-SIDE CONSUMER: ${stillDead.length}`);
    for (const r of stillDead) console.log(`    ${r.path}`);
    for (const r of res.filter((x) => x.consumed)) console.log(`    ok  ${r.path.padEnd(38)} moved in: ${Object.keys(r.moved).join(',')}`);
    return;
  }

  if (mode === 'flee') {
    // Can the enemy catch a player who is simply LEAVING? The piece's own survey §3a says this
    // is the question the whole road turns on, and its §7 claims the answer is now yes at jog
    // speed. Straight line, from 10 m, 30 s.
    const out = [];
    for (const id of roster.filter((r) => r !== 'probe_pulse')) {
      for (const sp of [2.0, 3.2, 5.0]) {
        const arena = new NodeArena({ data, seed: SEED });
        const stat = data._enemies[id];
        const b = arena.spawn('e1', id, 0, 10, 180);
        const ctl = arena.cs.enemies.get('e1');
        const p = arena.player;
        let minGap = Infinity; const states = {};
        for (let i = 0; i < 1800; i++) {
          p.pos[0] = 0; p.pos[2] = -(i / 60) * sp;
          ctl.alert = 100; ctl.alertState = 'AGGRO';
          arena.step();
          const st = ctl.ai ? ctl.ai.state : b.state;
          states[st] = (states[st] || 0) + 1;
          if (i > 30) minGap = Math.min(minGap, Math.hypot(p.pos[0] - b.pos[0], p.pos[2] - b.pos[2]));
        }
        const row = { stat: id, player_speed_mps: sp, min_gap_m: +minGap.toFixed(3), ever_reached_strike: minGap < data.ai.bands.strike * (stat.reach_m || data.ai.archetype[stat.archetype].omega_m), state_frames: states, entered_RUSH: !!states.RUSH };
        out.push(row);
        console.log(`${id.padEnd(22)} flee ${sp.toFixed(1)} m/s -> min gap ${row.min_gap_m} m  RUSH entered: ${row.entered_RUSH}  states ${Object.keys(states).join(',')}`);
      }
    }
    fs.writeFileSync(path.join(outDir, 'flee.json'), JSON.stringify({ ...stamp, rows: out }, null, 2));
    return;
  }

  if (mode === 'recover') {
    // RI-AI01 §D T15: an attack leaving `active` becomes RECOVER. `combat/ai.js` has no RECOVER
    // state, so the whole swing is labelled COMMIT and M3's "while state != COMMIT" excludes it.
    // Both readings of M3, same run, same seed, on the BUILDER'S fixture.
    const ang = (d) => { d %= 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };
    const out = [];
    for (const id of roster.filter((r) => r !== 'probe_pulse')) {
      const arena = new NodeArena({ data, seed: SEED });
      const stat = data._enemies[id];
      const omega = stat.reach_m || data.ai.archetype[stat.archetype].omega_m;
      const b = arena.spawn('e1', id, 0, 5 * omega, 180);
      const ctl = arena.cs.enemies.get('e1');
      const p = arena.player;
      const rows = [];
      let maxWind = 0, maxAct = 0; const budgets = []; let cur = null;
      for (let i = 0; i < 3600; i++) {
        p.pos[0] = 2.6 * Math.sin(i / 140); p.pos[2] = 1.9 * Math.sin(i / 97 + 1.1);
        ctl.alert = 100; ctl.alertState = 'AGGRO';
        const y0 = b.yaw;
        arena.step();
        const r = Math.abs(ang(b.yaw - y0)) * 60;
        const ph = !b.move ? 'none' : (b.animFrame <= b.move.startup ? 'windup' : (b.animFrame <= b.move.startup + b.move.active ? 'active' : 'recovery'));
        if (b.move && b.move.kind === 'attack') {
          if (ph === 'windup') { maxWind = Math.max(maxWind, r); cur = (cur || 0) + r / 60; }
          else { if (cur !== null) { budgets.push(cur); cur = null; } maxAct = Math.max(maxAct, r); }
        } else if (cur !== null) { budgets.push(cur); cur = null; }
        rows.push({ d: Math.hypot(p.pos[0] - b.pos[0], p.pos[2] - b.pos[2]), s: ctl.ai.state, ph });
      }
      const strike = data.ai.bands.strike * omega;
      const dwell = (a) => a.filter((r) => r.d < strike).length / a.length;
      const asBuilt = dwell(rows.filter((r) => r.s !== 'COMMIT'));
      const perItem = dwell(rows.filter((r) => !(r.s === 'COMMIT' && (r.ph === 'windup' || r.ph === 'active'))));
      const rec = rows.filter((r) => r.ph === 'recovery');
      const row = {
        stat: id, tier: stat.tier, omega_m: omega, strike_m: +strike.toFixed(3),
        min_dist_dwell_as_scored: +asBuilt.toFixed(4),
        min_dist_dwell_with_RECOVER_counted: +perItem.toFixed(4),
        recovery_frames: rec.length, recovery_frames_inside_strike: rec.filter((r) => r.d < strike).length,
        M3_as_scored: asBuilt <= 0.10 ? 2 : asBuilt <= 0.35 ? 1 : 0,
        M3_per_item: perItem <= 0.10 ? 2 : perItem <= 0.35 ? 1 : 0,
        max_yaw_rate_windup_dps: +maxWind.toFixed(2),
        max_yaw_rate_active_recovery_dps: +maxAct.toFixed(2),
        max_windup_yaw_budget_deg: +(budgets.length ? Math.max(...budgets) : 0).toFixed(2),
      };
      out.push(row);
      console.log(`${id.padEnd(22)} M3 dwell as scored ${row.min_dist_dwell_as_scored} (${row.M3_as_scored}/2) -> with RECOVER ${row.min_dist_dwell_with_RECOVER_counted} (${row.M3_per_item}/2); ${row.recovery_frames_inside_strike}/${row.recovery_frames} recovery frames inside 0.85Ω; yaw windup max ${row.max_yaw_rate_windup_dps} dps, budget ${row.max_windup_yaw_budget_deg} deg, active/recovery ${row.max_yaw_rate_active_recovery_dps} dps`);
    }
    fs.writeFileSync(path.join(outDir, 'recover.json'), JSON.stringify({ ...stamp, rows: out }, null, 2));
    return;
  }

  if (mode === 'punish') {
    // RI-AI01 M9's own bar is a TRIAL RATE — ">= 80% of trials show a PUNISH_READ entry". One
    // trial is a fixture. Twelve settle offsets put the enemy at twelve different points of its
    // own cycle, which is the only way to find out whether the read is a property of the AI or
    // of where the probe happened to start.
    const offsets = [40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260];
    const out = [];
    for (const id of roster.filter((r) => r !== 'probe_pulse')) {
      for (const kind of ['heal', 'whiff']) {
        const trials = offsets.map((o) => punishProbe(data, id, kind, o));
        const hit = trials.filter((t) => t.reacted_in_window).length;
        const busy = trials.filter((t) => t.enemy_committed_at_start).length;
        out.push({ stat: id, kind, trials: trials.length, hits: hit, committed_at_start: busy, rows: trials });
        console.log(`${id.padEnd(22)} ${kind.padEnd(6)} PUNISH_READ in ${hit}/${trials.length} trials (M9 bar 80% = 10/12); enemy already committed at trial start in ${busy}/${trials.length}`);
      }
    }
    fs.writeFileSync(path.join(outDir, 'punish.json'), JSON.stringify({ ...stamp, rows: out }, null, 2));
    return;
  }

  if (mode === 'speed') {
    const rowsOut = [];
    for (const speed of [1.6, 2.0, 3.2, 5.0]) {
      for (const id of ['inf_trash', 'champion_hist_marked']) {
        const { rows, omega } = runFight(data, id, { speed });
        const s = signature(rows, omega, data.ai);
        rowsOut.push({ stat: id, player_speed_mps: speed, ...s });
        console.log(`${id.padEnd(22)} player ${speed.toFixed(1)} m/s  var ${s.spacing_variance}  dwell ${s.min_dist_dwell}  mean_dist ${s.mean_dist_m}  commits ${s.commits}  entropy ${s.state_entropy}`);
      }
    }
    fs.writeFileSync(path.join(outDir, 'speed.json'), JSON.stringify({ ...stamp, rows: rowsOut }, null, 2));
    return;
  }

  // census (default)
  const { base, results } = census(data, roster);
  const inert = results.filter((r) => !r.consumed);
  const ctrlLive = results.find((r) => r.path === 'circle.preferred_band_multiple');
  const ctrlDead = results.find((r) => r.path === 'archetype.TURTLE.omega_m');
  const out = {
    ...stamp, roster, baseline_hashes: base,
    total_leaves: results.length,
    consumed: results.length - inert.length,
    inert: inert.length,
    inert_paths: inert.map((r) => r.path),
    controls: {
      must_move: ctrlLive ? { path: ctrlLive.path, consumed: ctrlLive.consumed } : null,
      must_not_move: ctrlDead ? { path: ctrlDead.path, consumed: ctrlDead.consumed } : null,
    },
    results,
  };
  fs.writeFileSync(path.join(outDir, 'census.json'), JSON.stringify(out, null, 2));
  console.log(`roster: ${roster.join(', ')}`);
  console.log(`ai.json behaviour leaves: ${results.length}`);
  console.log(`  with a demonstrated world-side consumer: ${results.length - inert.length}`);
  console.log(`  INERT (perturbation moved no enemy on any statblock): ${inert.length}`);
  for (const r of inert) console.log(`    ${r.path} = ${JSON.stringify(r.value)}`);
  console.log(`controls: must_move ${ctrlLive && ctrlLive.consumed}, must_not_move ${ctrlDead && ctrlDead.consumed}`);
  let bad = 0;
  if (!ctrlLive || !ctrlLive.consumed) { console.error('CONTROL FAILED: circle.preferred_band_multiple did not move the trace — the instrument is blind.'); bad = 1; }
  if (!ctrlDead || ctrlDead.consumed) { console.error('CONTROL FAILED: an unselected archetype row moved the trace — the instrument fires spuriously.'); bad = 1; }
  process.exit(bad);
}

main();
