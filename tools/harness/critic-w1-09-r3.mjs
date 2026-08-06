#!/usr/bin/env node
// critic-w1-09-r3.mjs — ROUND-3 CRITIC's browser-side instruments for W1-09.
//
// Everything measured here runs in the SHIPPING game through window.__HARNESS, in headless
// Chromium. Its purpose is to check the round-3 builder's load-bearing claim that
// tools/lib/combat-node.mjs "reproduces every browser number to the digit" — a claim whose own
// stated instrument (`cmb-reach.mjs --verify`) does not exist in the file that advertises it.
//
// NOTE ON GEOMETRY. The round-2 critic's `reach` probe placed the enemy with
// `setEntityPos('E1', 0, 0, {yaw: 0})`, but `Engine.setEntityPos()` ignores `opts.yaw`. That was
// harmless in round 2 because the enemy snapped its facing to the player's bearing on the frame
// an attack began; round 3 removed that snap, so the same probe now reports "chop never hits at
// any distance 0.0-4.0 m". That is a stale instrument, not an engine finding. This file
// re-spawns E1 with an explicit yaw instead.
'use strict';

import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const USAGE = `
critic-w1-09-r3.mjs — round-3 W1-09 critic probes (browser).
  --probe <name|all>   reach turtle yaw commit
  --out <path>
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const which = String(args.probe || 'all');
const ALL = ['reach', 'turtle', 'yaw'];
const run = which === 'all' ? ALL : which.split(',');

const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);
await requireMethods(handle, ['setSeed', 'loadState', 'stepFrames', 'queueInputs',
  'getCombatState', 'queueEnemyScript', 'teleport', 'spawn', 'despawn', 'lockOn']);

const PROBES = {

  /** S26: minimum reaching distance, measured directly, at contact range, in the real game. */
  reach(cfg) {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const out = { moves: {}, weapons: {} };
    const place = (d) => {
      H.setSeed(0); H.loadState('arena_champion');
      try { H.despawn('E1'); } catch (e) { /* already gone */ }
      H.spawn('champion_hist_marked', 0, 0, { as: 'E1', yaw: 0 });
      H.lockOn('E1');
      H.teleport(0, d, { yaw: 180 });
    };
    for (const move of cfg.moves) {
      const row = [];
      for (let i = 0; i * cfg.step <= cfg.max + 1e-9; i++) {
        const d = Math.round(i * cfg.step * 1000) / 1000;
        place(d);
        H.queueEnemyScript('E1', [{ f: 4, move }]);
        H.queueInputs([{ f: 0, move: [0, 0] }]);
        const hp0 = cs().player.hp;
        let hit = false, dmg = 0, distAtHit = null, minDist = Infinity;
        for (let k = 0; k < 220; k++) {
          H.stepFrames(1);
          const s = cs(); const e = s.enemies[0];
          if (e && e.dist_m < minDist) minDist = e.dist_m;
          if (!hit && s.player.hp < hp0) { hit = true; dmg = hp0 - s.player.hp; distAtHit = e ? e.dist_m : null; }
        }
        row.push({ d, hit, dmg: Math.round(dmg), dist_at_hit_m: distAtHit, min_dist_m: Math.round(minDist * 1000) / 1000 });
      }
      const hits = row.filter((r) => r.hit).map((r) => r.d);
      const min = hits.length ? hits[0] : null, max = hits.length ? hits[hits.length - 1] : null;
      out.moves[move] = {
        min_hit_distance_m: min, max_hit_distance_m: max,
        interior_gaps_m: row.filter((r) => min !== null && r.d > min && r.d < max && !r.hit).map((r) => r.d),
        dist_at_hit_at_min_m: hits.length ? row.find((r) => r.hit).dist_at_hit_m : null,
        row,
      };
    }
    for (const w of cfg.weapons) {
      const row = [];
      for (let i = 0; i * cfg.step <= cfg.max + 1e-9; i++) {
        const d = Math.round(i * cfg.step * 1000) / 1000;
        H.setSeed(0); H.loadState('arena_champion');
        try { H.despawn('E1'); } catch (e) { /* */ }
        H.spawn('champion_hist_marked', 0, d, { as: 'E1', yaw: 180 });
        H.lockOn('E1');
        H.setLoadout({ weapon: w });
        H.teleport(0, 0, { yaw: 0 });
        H.queueInputs([{ f: 0, move: [0, 0] }, { f: 4, press: ['light'] }, { f: 6, release: ['light'] }]);
        const e0 = cs().enemies[0].hp;
        let hit = false;
        for (let k = 0; k < 200; k++) {
          H.stepFrames(1); const e = cs().enemies[0];
          if (e && e.hp < e0) hit = true;
        }
        row.push({ d, hit });
      }
      const hits = row.filter((r) => r.hit).map((r) => r.d);
      const min = hits.length ? hits[0] : null, max = hits.length ? hits[hits.length - 1] : null;
      out.weapons[w] = {
        min_hit_distance_m: min, max_hit_distance_m: max,
        interior_gaps_m: row.filter((r) => min !== null && r.d > min && r.d < max && !r.hit).map((r) => r.d),
        row,
      };
    }
    return out;
  },

  /** The turtle, in the shipping game: stand still, never roll, never block, mash light. */
  turtle(cfg) {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const runs = [];
    const atk = { chop: 154, thrust: 122, combo_a: 72, combo_b: 102 };
    for (const d of cfg.dists) {
      H.setSeed(0); H.loadState('arena_champion');
      try { H.despawn('E1'); } catch (e) { /* */ }
      H.spawn('champion_hist_marked', 0, 0, { as: 'E1', yaw: 0 });
      H.lockOn('E1');
      H.teleport(0, d, { yaw: 180 });
      const cyc = ['combo_b', 'combo_a', 'chop', 'thrust'];
      const sc = []; let f = 20;
      for (let i = 0; i < 120; i++) { const m = cyc[i % 4]; sc.push({ f, move: m }); f += atk[m] + 2; }
      H.queueEnemyScript('E1', sc);
      const ins = [{ f: 0, move: [0, 0] }];
      for (let k = 2; k < 8000; k += 8) ins.push({ f: k, press: ['light'] }, { f: k + 2, release: ['light'] });
      H.queueInputs(ins);
      const hp0 = cs().player.hp, ehp0 = cs().enemies[0].hp;
      let frames = 0, pdead = false, edead = false;
      for (let k = 0; k < 8000; k++) {
        H.stepFrames(1); frames++;
        const s = cs();
        if (s.player.hp <= 0) { pdead = true; break; }
        const e = s.enemies[0];
        if (!e || e.hp <= 0 || e.state === 'DEAD') { edead = true; break; }
      }
      const s = cs();
      runs.push({
        stand_m: d, frames, seconds: Math.round(frames / 6) / 10,
        player_died: pdead, enemy_killed: edead,
        player_hp_left: Math.round(s.player.hp), player_hp_max: hp0,
        damage_fraction: Math.round((hp0 - Math.max(0, s.player.hp)) / hp0 * 1000) / 1000,
        enemy_hp_left: s.enemies[0] ? Math.round(s.enemies[0].hp) : 0, enemy_hp_max: ehp0,
      });
    }
    return { runs };
  },

  /** AR-1 A7: per-frame yaw rate of BOTH actors while a hitbox is live. */
  yaw() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    H.setSeed(0); H.loadState('arena_champion');
    try { H.despawn('E1'); } catch (e) { /* */ }
    H.spawn('champion_hist_marked', 0, 0, { as: 'E1', yaw: 0 });
    H.lockOn('E1');
    H.teleport(0, 2.2, { yaw: 180 });
    const sc = []; let f = 20;
    for (let i = 0; i < 20; i++) { const m = ['chop', 'thrust', 'combo_a', 'combo_b'][i % 4]; sc.push({ f, move: m }); f += 170; }
    H.queueEnemyScript('E1', sc);
    const ins = [{ f: 0, move: [0, 0] }];
    for (let k = 2; k < 3600; k += 40) ins.push({ f: k, press: ['light'] }, { f: k + 2, release: ['light'] });
    H.queueInputs(ins);
    let prevE = null, prevP = null;
    const worst = { enemy_active_recovery: 0, player_active_recovery: 0, enemy_any: 0, player_any: 0 };
    const samples = { e_active: 0, p_active: 0 };
    const d180 = (a, b) => { let x = ((a - b) % 360 + 540) % 360 - 180; return Math.abs(x); };
    for (let k = 0; k < 3400; k++) {
      H.stepFrames(1);
      const s = cs(); const e = s.enemies[0]; if (!e) break;
      if (prevE !== null) {
        const de = d180(e.yaw, prevE) * 60, dp = d180(s.player.yaw, prevP) * 60;
        worst.enemy_any = Math.max(worst.enemy_any, de);
        worst.player_any = Math.max(worst.player_any, dp);
        if (e.state === 'ATK_ACTIVE' || e.state === 'ATK_RECOVER') { worst.enemy_active_recovery = Math.max(worst.enemy_active_recovery, de); samples.e_active++; }
        if (s.player.state === 'ATK_ACTIVE' || s.player.state === 'ATK_RECOVER') { worst.player_active_recovery = Math.max(worst.player_active_recovery, dp); samples.p_active++; }
      }
      prevE = e.yaw; prevP = s.player.yaw;
    }
    return { worst_yaw_rate_dps: worst, samples };
  },
};

const out = { generated: new Date().toISOString(), build: await handle.page.evaluate(() => (window.__HARNESS.buildInfo ? window.__HARNESS.buildInfo() : null)), probes: {} };
const CFG = {
  reach: { moves: ['chop', 'thrust', 'combo_a', 'combo_b'], weapons: ['dagger', 'straight-sword', 'spear', 'halberd'], step: 0.05, max: 4.0 },
  turtle: { dists: [0.0, 0.2, 0.4, 0.8, 1.0, 1.5, 2.0, 2.6, 3.2] },
  yaw: {},
};
for (const name of run) {
  process.stderr.write(`[critic] probe: ${name}\n`);
  const t0 = Date.now();
  out.probes[name] = await handle.page.evaluate(
    ([fn, cfg]) => (new Function('cfg', `return (${fn}).call(null, cfg)`))(cfg),
    ['function ' + PROBES[name].toString(), CFG[name] || {}]);
  process.stderr.write(`[critic]   ok (${Date.now() - t0} ms)\n`);
}
if (args.out) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  fs.mkdirSync(path.dirname(String(args.out)), { recursive: true });
  fs.writeFileSync(String(args.out), JSON.stringify(out, null, 1) + '\n');
  process.stderr.write(`written: ${args.out}\n`);
}
await handle.close();
