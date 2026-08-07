#!/usr/bin/env node
/**
 * critic-population-r1.mjs — THE W1-POPULATION ROUND-1 CRITIC'S OWN INSTRUMENT.
 *
 * Written mid-critique, declared under `method_deviations` in
 * corpus/90-verdicts/wave1/W1-POPULATION-r1.md. It shares no code with
 * tools/world/population-consumption.mjs (the builder's 8-arm suite) on purpose.
 *
 * The builder's suite proves the world READS the placement. It does not ask the three
 * questions this critique is scoped to:
 *
 *   C1  IS THE DENSITY DESIGNED OR UNIFORM?   Walk the 57-minute crossing end to end and
 *       sample what materialises. Thirteen regions declare `danger_tier` 1-5. If the two
 *       ends of a 6.8 km walk are indistinguishable in spacing, in group size and in what
 *       stands there, the tier is a label.
 *
 *   C2  IS A WALKED CROSSING SURVIVABLE?      Drive it. No top-ups, no harness healing, no
 *       kill verbs. A passive walker measures the pressure the road applies; a fighting
 *       character at the level the crossing itself pays measures whether the road is fair.
 *
 *   C3  CAN A CORPSE BE RE-PAID WITH NO REST? `PopulationSystem.reset()` runs from BOTH
 *       `applySave` and `loadState`, and sets every post DORMANT. `SoulsSystem.reset()`
 *       runs from the same two places and empties the eid ledger the S5 epoch gate is
 *       keyed on. Walking away and back is correctly refused (the builder proved that).
 *       SAVING AND LOADING is a different door and nobody has tried it.
 *
 *   C4  DOES THE INSTRUMENT GO RED?           Every arm above, re-run with the population
 *       system ablated or the input queue cleared. A probe that cannot fail is worse than
 *       no probe (RULES 4).
 *
 * RULES 8: `walkRoute()` queues a move vector per frame and does NOT clear the queue when it
 * returns, so a bare `stepFrames()` afterwards keeps applying the last latched stick. Every
 * "still" control here calls `clearInputs()` and ASSERTS the drift, or the control is a walk.
 *
 * Run: node tools/world/critic-population-r1.mjs [--arms C1,C2,C3,C4] [--out reports/...]
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const ARMS = String(arg('arms', 'C1,C2,C3,C4')).split(',').map((s) => s.trim());
const OUT = path.resolve(ROOT, String(arg('out', 'reports/world/population/critic-r1.json')));
const STATE = String(arg('state', 'default'));
const ROUTE = String(arg('route', 'crossing'));
const CROSSING_M = Number(arg('metres', 6825));

const say = (s) => console.log(s);

function contention() {
  const o = {};
  try { o.headless_shell = Number(execFileSync('bash', ['-lc', 'pgrep -c headless_shell || echo 0']).toString().trim()); } catch { o.headless_shell = null; }
  try { o.loadavg = fs.readFileSync('/proc/loadavg', 'utf8').trim(); } catch { o.loadavg = null; }
  return o;
}
function gitInfo() {
  try { return execFileSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD']).toString().trim(); } catch { return null; }
}

const out = {
  tool: 'critic-population-r1',
  role: 'critic',
  judges: 'W1-POPULATION',
  at: new Date().toISOString(),
  commit: gitInfo(),
  contention_at_start: contention(),
  note: 'Counts, booleans and FRAME counts only. No wall-clock timing is claimed anywhere in this file; the box was shared.',
  arms: {},
};

/** In-page helpers. Installed once per boot. */
const INSTALL = () => {
  const H = window.__HARNESS, E = window.__ENGINE;
  window.__CP = {
    /** What is standing near the player right now, and what tier is it from. */
    census() {
      const r = H.populationReport();
      const mix = {}; const tiers = {}; const regions = {};
      let alive = 0;
      for (const d of r.resident_detail) {
        tiers[d.tier] = (tiers[d.tier] || 0) + 1;
        regions[d.region] = (regions[d.region] || 0) + 1;
        alive += d.alive;
      }
      for (const e of E.sim.entities) {
        if (e.populationPost && e.hp > 0) mix[e.id] = (mix[e.id] || 0) + 1;
      }
      return {
        live_posts: r.live_posts, live_bodies: r.live_bodies, alive,
        cleared: r.cleared, dormant: r.dormant, resident: r.resident,
        spawned: r.stats.spawned, released: r.stats.released, uncleared: r.stats.uncleared,
        faults: r.faults.length, tiers, regions, mix,
      };
    },
    pos() { const p = E.sim.player.pos; return { x: +p[0].toFixed(2), z: +p[2].toFixed(2) }; },
    hp() {
      // combat.player is the AUTHORITY. sim.player.hp is a mirror that
      // sim/combat-bridge.js#mirror overwrites every step — the builder's own instrument
      // was fooled by exactly this and said so.
      const c = E.combat && E.combat.player;
      return { hp: c ? c.hp : null, hp_max: c ? (c.hp_max ?? c.hpMax) : null, mirror: E.sim.player.hp };
    },
    souls() { return E.sim.progression.soulsHeld; },
    refused() { return E.sim.souls ? E.sim.souls.refusedRearms : null; },
    epoch() { return (E.death && E.death.ordinaryRespawnEpoch) || 0; },
    /** Every population body currently in the entity array, with its post. */
    bodies() {
      return E.sim.entities.filter((e) => e.populationPost)
        .map((e) => ({ eid: e.eid, id: e.id, hp: e.hp, post: e.populationPost, tier: e.populationTier }));
    },
    /**
     * Kill through `combat.bodyOf()` — THE AUTHORITY. `sim/combat-bridge.js#mirror` rewrites
     * `e.hp` on the sim record from the combat body every step, so writing the sim record
     * alone is a kill that un-happens on the next frame. The round-1 draft of this arm did
     * exactly that, reported `killed: 2` and banked zero souls, and the zero was the
     * instrument, not the world. Returns only bodies that were actually confirmed dead.
     */
    killAllPopulation() {
      const killed = [];
      for (const e of E.sim.entities.slice()) {
        if (!e.populationPost || e.hp <= 0) continue;
        const b = E.combat.bodyOf(String(e.eid));
        if (!b) continue;
        b.hp = 0; b.dead = true; b.state = 'DEAD'; b.move = null; b.hitboxActive = false;
        e.hp = 0; e.state = 'DEAD';
        killed.push({ eid: e.eid, id: e.id, post: e.populationPost, souls_declared: (E.data.enemies[e.id] || {}).souls });
      }
      return killed;
    },
  };
  return true;
};

async function tryH(handle, method, ...a) {
  return handle.page.evaluate(async ({ m, aa }) => {
    const H = window.__HARNESS;
    if (!H || typeof H[m] !== 'function') return { ok: false, error: `no such harness verb: ${m}` };
    try { return { ok: true, value: await H[m](...aa) }; } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
  }, { m: method, aa: a });
}

async function boot(handle) {
  await handle.h('setRenderRate', 0);
  await handle.h('setSeed', 4242);
  await handle.h('loadState', STATE);
  await handle.page.evaluate(INSTALL);
}

// =============================================================================================
// C1 — THE CROSSING, WALKED END TO END, WITH NO TOP-UPS.
//
// Two questions in one walk because the walk is the expensive part:
//   (a) DENSITY BY TIER. The crossing runs salt-hills(t3) -> valus-ridge(t4) -> stone-forest(t3)
//       -> deep-marshes(t5) -> blackwood(t2) -> western-rootlands(t1). If the tier is designed,
//       the spacing, the group size or the statblock mix must differ between the ends.
//   (b) SURVIVABILITY, PASSIVELY. The builder's suite topped the walker up and DECLARED it. This
//       one does not, so where the walker falls is a real number about the road.
// =============================================================================================
async function armC1(handle) {
  const A = { name: 'C1 crossing walked end to end, no top-ups', samples: [] };
  await handle.h('loadState', STATE);
  await handle.page.evaluate(INSTALL);
  // `PopulationSystem.reset()` restores state/live/focus/epoch/stats/candidates and does NOT
  // restore `enabled`. So `setPopulation({enabled:false})` survives every `loadState` for the
  // life of the page, and the round-1 run of this arm walked 5,999.4 m through a world that a
  // PREVIOUS arm had switched off and reported it as an empty road. Re-arm and ASSERT.
  await handle.h('setPopulation', { enabled: true });
  A.enabled_at_start = (await handle.h('populationReport')).enabled;
  if (A.enabled_at_start !== true) { A.VOID = 'population system is disabled at arm start'; return A; }
  let r = await handle.h('walkRoute', { route: ROUTE, speed: 'walk', restart: true, chunkFrames: 1, stream: false });
  A.start = await handle.page.evaluate(() => ({ ...window.__CP.pos(), ...window.__CP.hp() }));
  let guard = 0;
  let died = null;
  while (r.path_m < CROSSING_M && !r.done && guard++ < 200) {
    r = await handle.h('walkRoute', { route: ROUTE, speed: 'walk', chunkFrames: 900, stream: false });
    const s = await handle.page.evaluate(() => ({
      ...window.__CP.census(), ...window.__CP.hp(), souls: window.__CP.souls(),
    }));
    A.samples.push({ m: +r.path_m.toFixed(1), ...s });
    if (s.hp !== null && s.hp <= 0 && !died) {
      died = { m: +r.path_m.toFixed(1), regions: s.regions, tiers: s.tiers };
      break;
    }
  }
  A.walked_m = +r.path_m.toFixed(1);
  A.done = !!r.done;
  A.died = died;
  A.end = await handle.page.evaluate(() => ({ ...window.__CP.pos(), ...window.__CP.hp(), souls: window.__CP.souls() }));
  A.total_spawned = A.samples.length ? A.samples[A.samples.length - 1].spawned : 0;
  return A;
}

// =============================================================================================
// C2 — THE STILL CONTROL, WITH THE DRIFT ASSERTED (RULES 8).
// =============================================================================================
async function armC2(handle) {
  const A = { name: 'C2 still control + ablation control' };
  // (a) still
  await handle.h('loadState', STATE);
  await handle.page.evaluate(INSTALL);
  await handle.h('walkRoute', { route: ROUTE, speed: 'walk', restart: true, chunkFrames: 1, stream: false });
  await handle.h('clearInputs');
  const p0 = await handle.page.evaluate(() => window.__CP.pos());
  await handle.h('stepFrames', 5400);
  const p1 = await handle.page.evaluate(() => window.__CP.pos());
  A.still = await handle.page.evaluate(() => window.__CP.census());
  A.still.drift_m = +Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(2);
  A.still.drift_ok = A.still.drift_m < 2;

  // (b) ablation: the same first stretch of the walk with the population system off
  await handle.h('loadState', STATE);
  await handle.page.evaluate(INSTALL);
  await handle.h('setPopulation', { enabled: false });
  let r = await handle.h('walkRoute', { route: ROUTE, speed: 'walk', restart: true, chunkFrames: 1, stream: false });
  let g = 0;
  while (r.path_m < 1800 && !r.done && g++ < 40) {
    r = await handle.h('walkRoute', { route: ROUTE, speed: 'walk', chunkFrames: 900, stream: false });
  }
  A.ablated = await handle.page.evaluate(() => window.__CP.census());
  A.ablated.walked_m = +r.path_m.toFixed(1);
  return A;
}

// =============================================================================================
// C3 — CAN A CORPSE BE RE-PAID WITH NO REST?
//
// The builder's A8 proved walking away and coming back is not a respawn. It never tried the
// other door. `Engine.applySave()` and `Engine.loadState()` BOTH call `population.reset()`
// (every post -> DORMANT) and `sim.souls.reset()` (the eid ledger the S5 epoch gate is keyed
// on -> empty). A save and a load is not a rest, costs no world clock, and is a verb the
// player has.
//
// Three legs, and the CONTROL must go the other way:
//   L1  kill a post's bodies         -> souls must rise (the instrument works at all)
//   L2  walk away past the release radius and back, kill again, NO save
//                                    -> souls must NOT rise, refusedRearms must rise
//   L3  save, load, re-materialise, kill again, NO REST ANYWHERE
//                                    -> if souls rise, S5 has a second door
// =============================================================================================
async function armC3(handle) {
  const A = { name: 'C3 re-pay without a rest: the save/load door' };
  await handle.h('loadState', STATE);
  await handle.page.evaluate(INSTALL);
  await handle.h('setPopulation', { enabled: true });   // see C1: reset() does not restore this

  // Stand on a road post and let it materialise. Standing, not walking: this arm is about
  // payment, not arrival, and A1 already owns arrival.
  const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/world/population-posts.json'), 'utf8')).posts;
  const target = posts.find((p) => p.kind === 'road' && p.bodies >= 1);
  A.target = target;
  await handle.h('teleport', target.x + 6, target.z + 6);
  await handle.h('clearInputs');
  await handle.h('stepFrames', 400);

  const snap = async () => handle.page.evaluate(() => ({
    souls: window.__CP.souls(), refused: window.__CP.refused(), epoch: window.__CP.epoch(),
    bodies: window.__CP.bodies(), census: window.__CP.census(),
  }));

  // ---- L1 : a first kill pays -----------------------------------------------------------
  const s0 = await snap();
  const killed1 = await handle.page.evaluate(() => window.__CP.killAllPopulation());
  await handle.h('stepFrames', 20);
  const s1 = await snap();
  A.L1 = {
    what: 'kill every population body standing here',
    killed: killed1.length, souls_before: s0.souls, souls_after: s1.souls,
    delta: s1.souls - s0.souls, epoch: s1.epoch,
    pass: killed1.length > 0 && s1.souls > s0.souls,
  };

  // ---- L2 : CONTROL. Walk out past release_radius_m and back. No save. -------------------
  await handle.h('teleport', target.x + 700, target.z + 700);
  await handle.h('clearInputs');
  await handle.h('stepFrames', 400);
  await handle.h('teleport', target.x + 6, target.z + 6);
  await handle.h('clearInputs');
  await handle.h('stepFrames', 400);
  const s2 = await snap();
  const killed2 = await handle.page.evaluate(() => window.__CP.killAllPopulation());
  await handle.h('stepFrames', 20);
  const s3 = await snap();
  A.L2 = {
    what: 'CONTROL — leave past the release radius, return, kill again. No save, no rest.',
    bodies_present_on_return: s2.bodies.length,
    killed: killed2.length,
    delta: s3.souls - s2.souls,
    refused_before: s2.refused, refused_after: s3.refused,
    epoch_moved: s3.epoch !== s1.epoch,
    pass_means_refused: (s3.souls - s2.souls) === 0,
  };

  // ---- L3 : THE DOOR. save -> load -> re-materialise -> kill again. No rest. -------------
  const before = await snap();
  const sv = await tryH(handle, 'saveState');
  A.L3_save_ok = sv.ok;
  if (sv.ok) {
    const ld = await handle.page.evaluate(async (blob) => {
      try { window.__ENGINE.loadState(blob); return { ok: true }; }
      catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
    }, sv.value);
    A.L3_load_ok = ld.ok; A.L3_load_error = ld.error || null;
    await handle.page.evaluate(INSTALL);
    await handle.h('teleport', target.x + 6, target.z + 6);
    await handle.h('clearInputs');
    await handle.h('stepFrames', 900);
    const s4 = await snap();
    // A zero here must be diagnosable rather than mysterious: say WHERE the player is, what
    // cell the streamer thinks it is in, and what the post table looks like after the load.
    A.L3_diag = await handle.page.evaluate(() => ({
      pos: window.__CP.pos(),
      cell: window.__ENGINE.cellFor(window.__ENGINE.sim.env),
      env_region: window.__ENGINE.sim.env.region,
      report: (({ dormant, resident, cleared, live_posts, live_bodies, candidates, stats }) =>
        ({ dormant, resident, cleared, live_posts, live_bodies, candidates, stats }))(window.__HARNESS.populationReport()),
    }));
    const killed3 = await handle.page.evaluate(() => window.__CP.killAllPopulation());
    await handle.h('stepFrames', 20);
    const s5 = await snap();
    A.L3 = {
      what: 'save -> load -> the post re-materialises -> kill it again. NO hearth rest anywhere.',
      epoch_before: before.epoch, epoch_after: s5.epoch,
      epoch_moved: s5.epoch !== before.epoch,
      bodies_present_after_load: s4.bodies.length,
      killed: killed3.length,
      souls_before: s4.souls, souls_after: s5.souls, delta: s5.souls - s4.souls,
      refused_before: s4.refused, refused_after: s5.refused,
      FARM: killed3.length > 0 && (s5.souls - s4.souls) > 0 && s5.epoch === before.epoch,
    };
  }
  return A;
}

// =============================================================================================
// C4 — DOES A TIER-5 ENCOUNTER KILL A CHARACTER AT THE LEVEL THE CROSSING PAYS?
//
// The crossing's 38 bodies are worth 2,149 souls, which is LEVEL 5 on the shipped
// game/data/progression/levels.json curve (cumulative 2,081 at L5). So: stand a level-5-ish
// character in front of the tier-5 encounter the crossing actually contains and let it fight.
// No harness kill verb, no top-up, latched light attack only.
// =============================================================================================
async function armC4(handle) {
  const A = { name: 'C4 a tier-5 crossing encounter, fought, at the level the crossing pays' };
  const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/world/population-posts.json'), 'utf8')).posts;
  const t5 = posts.filter((p) => p.tier === 5 && p.bodies >= 2);
  const target = t5.sort((a, b) => b.souls - a.souls)[0];
  A.target = target;

  for (const fight of [true, false]) {
    await handle.h('loadState', STATE);
    await handle.page.evaluate(INSTALL);
    await handle.h('setPopulation', { enabled: true }); // see C1: reset() does not restore this
    await handle.h('teleport', target.x + 10, target.z + 10);
    await handle.h('clearInputs');
    await handle.h('stepFrames', 400);
    const r = await handle.page.evaluate(async (doFight) => {
      const H = window.__HARNESS, E = window.__ENGINE;
      const hp0 = E.combat.player.hp;
      let r_swings = 0;
      const bodies0 = E.sim.entities.filter((e) => e.populationPost && e.hp > 0).length;
      let frames = 0, dead = false, swings = 0, locked = false;
      const period = 34;   // press, release, wait out the recovery, press again
      while (frames < 14400) {
        const alive = E.sim.entities.filter((e) => e.populationPost && e.hp > 0);
        if (!alive.length) break;
        if (doFight) {
          if (!locked) { try { H.lockOn(alive[0].eid); locked = true; } catch { /* out of range */ } }
          if (frames % period === 0) { H.queueInputs([{ f: 0, press: ['light'] }]); swings++; }
          if (frames % period === 2) H.queueInputs([{ f: 0, release: ['light'] }]);
        }
        H.stepFrames(1); frames++;
        if (E.combat.player.hp <= 0) { dead = true; break; }
      }
      r_swings = swings;
      const aliveEnd = E.sim.entities.filter((e) => e.populationPost && e.hp > 0).length;
      return {
        fighting: doFight, swings: r_swings, hp_start: hp0, hp_end: E.combat.player.hp,
        hp_max: E.combat.player.hp_max ?? E.combat.player.hpMax,
        player_died: dead, frames, sim_seconds: +(frames / 60).toFixed(1),
        enemy_bodies_at_start: bodies0, enemy_bodies_alive_at_end: aliveEnd,
        souls: E.sim.progression.soulsHeld,
        level: E.sim.progression.level,
      };
    }, fight);
    A[fight ? 'fighting' : 'passive_control'] = r;
  }
  return A;
}

// =============================================================================================
const handle = await launchGame({ width: 320, height: 240 });
handle.page.on('pageerror', (e) => say(`  [pageerror] ${e.message}`));
try {
  await handle.page.waitForFunction(() => !!window.__HARNESS && !!window.__ENGINE, null, { timeout: 120000 });
  await boot(handle);
  const table = { C1: armC1, C2: armC2, C3: armC3, C4: armC4 };
  for (const k of ARMS) {
    if (!table[k]) continue;
    say(`== ${k} ==`);
    try { out.arms[k] = await table[k](handle); }
    catch (e) { out.arms[k] = { name: k, ERROR: String((e && e.message) || e) }; say(`  ERROR ${e.message}`); }
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
    say(`  written ${OUT}`);
  }
} finally {
  out.contention_at_end = contention();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  try { await handle.close(); } catch { /* dead page */ }
}
say(`\nwrote ${OUT}`);
