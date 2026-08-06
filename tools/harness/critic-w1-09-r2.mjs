#!/usr/bin/env node
// critic-w1-09-r2.mjs — round-2 critic instruments for W1-09.
//
// Round 1 proved the i-frame WINDOW is exact (f5-f30 LIGHT) with a probe_pulse fixture whose
// hitbox radius is 8 m, so geometry could never be the variable. The remediated exemplar has
// row 11 (swings negated by i-frames) at 0.111 against a band of 0.40-0.80, and the raw trace
// shows 35 enemy swings across five fights in which the player was in ROLL_IFRAME for every
// active frame, at 0.01-0.60 m, and the swing resolved WHIFF rather than IFRAME_NEGATE.
//
// Three candidate causes, each a different defect:
//   (a) the player never rolls into the swing                 -> exemplar bot
//   (b) the i-frame window is not where it should be          -> engine (ruled out by r1)
//   (c) negation happens and is not counted                   -> telemetry
// and a fourth this critic added after reading the trace:
//   (d) the ENEMY's swept hit volume has an inner dead zone, so a player who rolls THROUGH
//       ends up inside minimum reach and the swing misses geometrically.
//
// reach   — sweep a STATIONARY player through the enemy's forward axis and record hit/miss.
// roll    — from a distance at which the swing reliably hits, roll at every lead and record
//           whether the player survived by INVULNERABILITY or by DISPLACEMENT.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const USAGE = `
critic-w1-09-r2.mjs — round-2 W1-09 critic probes.
  --probe <name|all>   reach roll
  --out <path>
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const which = String(args.probe || 'all');
const ALL = ['reach', 'preach', 'mech', 'turtle', 'roll'];
const run = which === 'all' ? ALL : which.split(',');

const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);
await requireMethods(handle, ['setSeed', 'loadState', 'stepFrames', 'queueInputs',
  'getCombatState', 'queueEnemyScript', 'teleport', 'setEntityPos']);

const PROBES = {

  // ---- (d) the enemy's reach band, measured on a stationary player -----------------------
  reach() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const R = { moves: {}, note: 'player stationary, no input, no roll. Pure geometry.' };
    for (const move of ['chop', 'thrust', 'combo_a']) {
      const row = [];
      for (let d10 = 0; d10 <= 40; d10++) {
        const d = d10 / 10;
        H.setSeed(0); H.loadState('arena_champion'); H.lockOn('E1');
        // put the enemy at the origin facing +z and the player d metres in front of it
        H.setEntityPos('E1', 0, 0, { yaw: 0 });
        H.teleport(0, d, { yaw: 180 });
        H.queueEnemyScript('E1', [{ f: 4, move }]);
        H.queueInputs([{ f: 0, move: [0, 0] }]);
        let hit = null, dmg = 0, minDist = Infinity, activeFrames = 0;
        const hp0 = cs().player.hp;
        for (let i = 0; i < 200; i++) {
          H.stepFrames(1);
          const s = cs();
          const e = s.enemies[0];
          if (e) { if (e.dist_m < minDist) minDist = e.dist_m; if (e.state === 'ATK_ACTIVE') activeFrames++; }
          if (s.player.hp < hp0 && hit === null) { hit = i; dmg = hp0 - s.player.hp; }
        }
        row.push({ d, hit: hit !== null, dmg, min_dist_m: Math.round(minDist * 1000) / 1000, active_frames: activeFrames });
      }
      const hits = row.filter((r) => r.hit).map((r) => r.d);
      R.moves[move] = {
        hit_distances: hits,
        min_hit_distance_m: hits.length ? Math.min(...hits) : null,
        max_hit_distance_m: hits.length ? Math.max(...hits) : null,
        misses_inside_min: row.filter((r) => hits.length && r.d < Math.min(...hits) && !r.hit).map((r) => r.d),
        contiguous: hits.length ? hits.every((d, i) => i === 0 || Math.abs(d - hits[i - 1] - 0.1) < 1e-9) : null,
        row,
      };
    }
    return R;
  },

  // ---- does the same inner hole exist on the PLAYER's weapons? ---------------------------
  preach() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const R = { weapons: {}, note: 'enemy stationary at d, player swings R1 from a standstill' };
    for (const w of ['dagger', 'straight-sword', 'spear', 'greatsword', 'halberd']) {
      const row = [];
      for (let d10 = 0; d10 <= 40; d10++) {
        const d = d10 / 10;
        H.setSeed(0); H.loadState('arena_champion'); H.lockOn('E1');
        H.setLoadout({ weapon: w });
        H.teleport(0, 0, { yaw: 0 });
        H.setEntityPos('E1', 0, d, { yaw: 180 });
        H.queueInputs([{ f: 0, move: [0, 0] }, { f: 4, press: ['light'] }, { f: 6, release: ['light'] }]);
        const e0 = cs().enemies[0].hp;
        let hit = false, minDist = Infinity;
        for (let i = 0; i < 160; i++) {
          H.stepFrames(1); const s = cs(); const e = s.enemies[0];
          if (e) { if (e.dist_m < minDist) minDist = e.dist_m; if (e.hp < e0) hit = true; }
        }
        row.push({ d, hit, min_dist_m: Math.round(minDist * 1000) / 1000 });
      }
      const hits = row.filter((r) => r.hit).map((r) => r.d);
      R.weapons[w] = {
        min_hit_distance_m: hits.length ? Math.min(...hits) : null,
        max_hit_distance_m: hits.length ? Math.max(...hits) : null,
        misses_inside_min: hits.length ? row.filter((r) => r.d < Math.min(...hits) && !r.hit).map((r) => r.d) : [],
        row,
      };
    }
    return R;
  },


  // ---- mechanism: where is everything on the enemy's first active frame? -----------------
  mech() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const R = { rows: [] };
    for (let d10 = 4; d10 <= 24; d10 += 1) {
      const d = d10 / 10;
      H.setSeed(0); H.loadState('arena_champion'); H.lockOn('E1');
      H.setEntityPos('E1', 0, 0, { yaw: 0 });
      H.teleport(0, d, { yaw: 180 });
      H.queueEnemyScript('E1', [{ f: 4, move: 'chop' }]);
      H.queueInputs([{ f: 0, move: [0, 0] }]);
      const hp0 = cs().player.hp;
      let snap = null, hit = false;
      for (let i = 0; i < 200; i++) {
        H.stepFrames(1);
        const s = cs(); const e = s.enemies[0];
        if (e && e.state === 'ATK_ACTIVE' && !snap) {
          const g = H.getHitGeometry ? H.getHitGeometry() : null;
          snap = { frame: s.frame, dist_m: e.dist_m,
            player_pos: s.player.pos, enemy_pos: e.pos, enemy_yaw: e.yaw,
            enemy_hitboxes: g && g.enemies ? JSON.parse(JSON.stringify(g.enemies)) : (g ? Object.keys(g) : null) };
        }
        if (s.player.hp < hp0) hit = true;
      }
      R.rows.push({ start_d: d, hit, snap });
    }
    return R;
  },


  // ---- the dominant strategy the inner hole creates ---------------------------------------
  // Stand still inside the enemy's minimum range and mash the light attack. No rolls, no
  // blocks, no spacing, no reads. If the fight is real this loses.
  turtle() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const R = { runs: [] };
    for (const d of [0.8, 1.0, 1.1, 1.5, 2.0, 2.6]) {
      H.setSeed(0); H.loadState('arena_champion'); H.lockOn('E1');
      H.setEntityPos('E1', 0, 0, { yaw: 0 });
      H.teleport(0, d, { yaw: 180 });
      // the same enemy schedule shape the exemplar uses
      const script = []; let f = 80;
      const bag = ['chop', 'thrust', 'chop', 'combo_a', 'thrust', 'chop'];
      const A = { chop: 154, thrust: 122, combo_a: 72, combo_b: 102 };
      let bi = 0;
      while (f < 8600) { const mv = bag[bi % bag.length]; bi++; script.push({ f, move: mv }); f += A[mv] + 90; }
      H.queueEnemyScript('E1', script);
      const hp0 = cs().player.hp; const ehp0 = cs().enemies[0].hp;
      let hits = 0, taken = 0, enemyDead = false, endF = null;
      const eStates = {}; let eActive = 0;
      let php = hp0, ehp = ehp0;
      for (let i = 0; i < 9000; i++) {
        const s = cs();
        // mash: press light whenever actionable, never move, never roll, never block
        if (s.player.move === null && s.player.state !== 'STAGGER' && s.player.state !== 'GUARD_BREAK') {
          H.queueInputs([{ f: 0, move: [0, 0], press: ['light'] }, { f: 1, release: ['light'] }]);
        }
        H.stepFrames(1);
        const t = cs();
        if (t.enemies[0]) { const st = t.enemies[0].state; eStates[st] = (eStates[st] || 0) + 1;
          if (st === 'ATK_ACTIVE') eActive++; }
        if (t.player.hp < php) { taken += php - t.player.hp; php = t.player.hp; }
        if (t.enemies[0] && t.enemies[0].hp < ehp) { hits++; ehp = t.enemies[0].hp; }
        if (!t.enemies[0] || t.enemies[0].dead) { enemyDead = true; endF = i; break; }
        if (t.player.hp <= 0) { endF = i; break; }
      }
      R.runs.push({ stand_distance_m: d, enemy_killed: enemyDead, ended_frame: endF,
        player_hp_end: php, player_hp_max: hp0, damage_taken: hp0 - php,
        enemy_hp_end: ehp, enemy_hp_max: ehp0, player_hits_landed: hits,
        enemy_swings_scheduled: script.length,
        enemy_state_histogram: eStates, enemy_active_frames: eActive });
    }
    return R;
  },

  // ---- (a)/(c) invulnerability vs displacement -------------------------------------------
  roll() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const R = { note: 'roll pressed at lead k before the enemy hitbox goes live; the roll direction is varied', cases: [] };
    // find a distance the chop reliably hits from, using the reach probe's answer at runtime
    let d0 = null;
    for (let d10 = 40; d10 >= 0 && d0 === null; d10--) {
      const d = d10 / 10;
      H.setSeed(0); H.loadState('arena_champion'); H.lockOn('E1');
      H.setEntityPos('E1', 0, 0, { yaw: 0 }); H.teleport(0, d, { yaw: 180 });
      H.queueEnemyScript('E1', [{ f: 4, move: 'chop' }]);
      H.queueInputs([{ f: 0, move: [0, 0] }]);
      const hp0 = cs().player.hp;
      for (let i = 0; i < 200; i++) { H.stepFrames(1); if (cs().player.hp < hp0) { d0 = d; break; } }
    }
    R.hit_distance_used_m = d0;
    if (d0 === null) return R;
    // control: stand still, no roll at all
    {
      H.setSeed(0); H.loadState('arena_champion'); H.lockOn('E1');
      H.setEntityPos('E1', 0, 0, { yaw: 0 }); H.teleport(0, d0, { yaw: 180 });
      H.queueEnemyScript('E1', [{ f: 4, move: 'chop' }]);
      H.queueInputs([{ f: 0, move: [0, 0] }]);
      const hp0 = cs().player.hp; let hit = false;
      for (let i = 0; i < 220; i++) { H.stepFrames(1); if (cs().player.hp < hp0) hit = true; }
      R.control_no_roll_hit = hit;
    }
    const dirs = { forward: [0, 1], back: [0, -1], left: [-1, 0], right: [1, 0] };
    for (const [dname, mv] of Object.entries(dirs)) {
      for (let press = 40; press <= 100; press += 2) {
        H.setSeed(0); H.loadState('arena_champion'); H.lockOn('E1');
        H.setEntityPos('E1', 0, 0, { yaw: 0 }); H.teleport(0, d0, { yaw: 180 });
        H.queueEnemyScript('E1', [{ f: 4, move: 'chop' }]);
        // stand still until the roll; the stick is set on the press frame only, so the
        // measurement isolates the ROLL and not a walk that drifted out of reach.
        H.queueInputs([{ f: 0, move: [0, 0] }, { f: press - 1, move: mv }, { f: press, press: ['roll'] }, { f: press + 2, release: ['roll'] }, { f: press + 3, move: [0, 0] }]);
        const hp0 = cs().player.hp;
        let hit = false, invulnDuringActive = 0, activeFrames = 0, distAtFirstActive = null, minDist = Infinity;
        for (let i = 0; i < 220; i++) {
          H.stepFrames(1);
          const s = cs(); const e = s.enemies[0];
          if (e && e.state === 'ATK_ACTIVE') {
            activeFrames++;
            if (distAtFirstActive === null) distAtFirstActive = e.dist_m;
            if (s.player.invuln || s.player.iframe) invulnDuringActive++;
          }
          if (e && e.dist_m < minDist) minDist = e.dist_m;
          if (s.player.hp < hp0) hit = true;
        }
        R.cases.push({
          dir: dname, press_f: press, hit,
          invuln_frames_during_enemy_active: invulnDuringActive,
          enemy_active_frames: activeFrames,
          dist_at_first_active_m: distAtFirstActive === null ? null : Math.round(distAtFirstActive * 1000) / 1000,
          min_dist_m: Math.round(minDist * 1000) / 1000,
          // the discriminator: survived with i-frames up = negation; survived with i-frames
          // down, or up but out of reach = displacement
          survived_by: hit ? 'nothing (hit)'
            : (invulnDuringActive > 0 ? 'invulnerable-during-active' : 'displacement-only'),
        });
      }
    }
    const byDir = {};
    for (const c of R.cases) {
      byDir[c.dir] = byDir[c.dir] || { hit: 0, invuln: 0, displacement: 0 };
      if (c.hit) byDir[c.dir].hit++;
      else if (c.invuln_frames_during_enemy_active > 0) byDir[c.dir].invuln++;
      else byDir[c.dir].displacement++;
    }
    R.summary = byDir;
    return R;
  },
};

const out = { generated: new Date().toISOString(), build: await handle.hOpt('getBuildInfo'), probes: {} };
const dest = args.out ? path.resolve(String(args.out))
  : path.join(REPO_ROOT, 'corpus', '90-verdicts', 'wave1', 'artifacts', 'W1-09-r2', `critic-r2-${which}.json`);
fs.mkdirSync(path.dirname(dest), { recursive: true });
for (const name of run) {
  const fn = PROBES[name];
  if (!fn) { console.error(`unknown probe '${name}'`); process.exitCode = EXIT.USAGE; continue; }
  const t0 = Date.now(); log(`probe: ${name}`);
  try { out.probes[name] = await handle.page.evaluate(fn); log(`  ok (${Date.now() - t0} ms)`); }
  catch (e) { out.probes[name] = { __err: String((e && e.message) || e) }; console.error(`  FAILED: ${e && e.message}`); process.exitCode = EXIT.HARNESS_ERROR; }
  fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
}
await handle.close();
process.stdout.write(`written: ${path.relative(REPO_ROOT, dest)}\n`);
