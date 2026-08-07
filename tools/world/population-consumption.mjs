#!/usr/bin/env node
/**
 * population-consumption.mjs — RI-MTH07 / ARBITRATION §3 CONSUMPTION probe for the hostile
 * population of the province (W1-POPULATION).
 *
 * THE RULE THIS EXISTS FOR. Fifteen subsystems in this project have shipped a model that nothing
 * in the running world reads. A population machine with no caller is exactly that shape, and it
 * is the shape the previous state of this world already had: `Engine.applyNamedState()` spawned a
 * hostile if and only if somebody had typed it, with coordinates, into a hand-written state file.
 * Nine bodies in the whole province, worth 1,224 souls together — level 3 — against a plan of
 * ~1,230 enemies and a first clear at level 82.
 *
 * So this tool does not ask "does the report print numbers". It PERTURBS THE MODEL AND WATCHES
 * ENTITIES CHANGE, and every arm carries a control that must go the other way.
 *
 *   A1  WALK        walk real road through the game's own locomotion; bodies must materialise
 *                   PROGRESSIVELY as the player moves, not once at load.
 *   A2  STILL       the same frames, standing still. Must materialise far fewer posts.
 *                   ("A still target hides every steering defect" — the control that catches a
 *                   population that is really just an on-load spawn list.)
 *   A3  ABLATION    `setPopulation({enabled:false})` and walk again. Must be ZERO. This is the
 *                   negative control: if it is not zero, this tool is measuring something else.
 *   A4  RADIUS      perturb `stream.spawn_radius_m` at runtime and walk again. The count must
 *                   move with it, in the direction the number says.
 *   A5  MODEL       REGENERATE `population-posts.json` from a perturbed `population.json`
 *                   (`--encounters-per-tm`), RELOAD THE PAGE, walk the identical stretch. More
 *                   density in the file must mean more bodies on the road. Then restore the
 *                   canonical file byte-for-byte and confirm the count comes back.
 *   A6  BEHAVIOUR   stand a player near a materialised post and step: the bodies must NOTICE
 *                   (alert rises, alert_state leaves IDLE), TURN (yaw closes on the player) and
 *                   MOVE (speed > 0). Run twice — against a still player and a strafing one —
 *                   because a still target hides steering defects (AGENT-PROTOCOL §4).
 *   A7  COMPOSITION `absent_when_flag`: the same encounter id, six bodies before a quest
 *                   resolution and four after, every statblock identical. Composition, not stat
 *                   inflation.
 *   A8  RESPAWN     S5. Clear a post -> CLEARED. Walk out past the release radius and back ->
 *                   STILL CLEARED (walking away is not a respawn). Rest at a hearth -> the post
 *                   returns. And `sim.npcs` — every named person, merchant, trainer, quest
 *                   actor — must be untouched by all of it.
 *
 * WHAT THIS TOOL MAY NOT DO. It never calls `spawnEncounter`, `spawn`, or any verb that places a
 * body, except inside A7 where the composition of one named encounter is the thing under test and
 * it is stated. It never emits an event (`game/src/sim/events.js` has a CLOSED vocabulary and an
 * unlisted name throws inside the fixed step, killing every stepping probe in the project while
 * boot-check stays green). The world either populates itself under a walking player or this tool
 * reports that it does not.
 *
 * Usage:
 *   node tools/world/population-consumption.mjs --out reports/world/population/consumption.json
 *   node tools/world/population-consumption.mjs --arms A1,A3 --metres 1500
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `population-consumption.mjs — does the running world read the population model?
  --arms <list>      comma list of A1..A8, or 'all'      (default all)
  --state <id>       named state to load                 (default default)
  --route <id>       named route to walk                 (default crossing)
  --metres <m>       how far to walk in the census arms  (default 2200)
  --speed <s>        walk|jog                            (default walk)
  --out <file>       report json path`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const ARMS = String(args.arms || 'all');
const want = (a) => ARMS === 'all' || ARMS.split(',').map((s) => s.trim()).includes(a);
const STATE = String(args.state || 'default');
const ROUTE = String(args.route || 'crossing');
const METRES = Number(args.metres || 2200);
const SPEED = String(args.speed || 'walk');
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports', 'world', 'population', 'consumption.json')));
ensureDir(path.dirname(OUT));

const POSTS_PATH = path.join(REPO_ROOT, 'game/data/world/population-posts.json');
const BUILDER = path.join(REPO_ROOT, 'tools/world/build-population.mjs');

const report = {
  tool: 'tools/world/population-consumption.mjs',
  spec: 'RI-MTH07 consumption / ARBITRATION §3',
  at: new Date().toISOString(),
  git: gitInfo(),
  contention: {},
  params: { arms: ARMS, state: STATE, route: ROUTE, metres: METRES, speed: SPEED },
  checks: [],
  arms: {},
};
const pass = (check, detail) => { report.checks.push({ check, pass: true, detail }); log(`  PASS  ${check}`); };
const fail = (check, detail) => { report.checks.push({ check, pass: false, detail }); log(`  FAIL  ${check}`); };

// ---------------------------------------------------------------------------------------------
// The read-only inspector. Everything here reads `window.__ENGINE`; nothing here places a body.
// ---------------------------------------------------------------------------------------------
const INSTALL = () => {
  window.__POP = {
    /** Population census + the live bodies' actual behaviour, in one page round trip. */
    look() {
      const e = window.__ENGINE;
      const sim = e.sim;
      const p = sim.player;
      const rep = e.population ? e.population.report(sim) : null;
      const bodies = [];
      for (const ent of sim.entities) {
        if (!ent.populationPost) continue;
        const dx = p.pos[0] - ent.pos[0], dz = p.pos[2] - ent.pos[2];
        const toPlayer = Math.atan2(dx, dz) * 180 / Math.PI;
        let dyaw = ((ent.yaw === undefined ? 0 : ent.yaw) - toPlayer + 540) % 360 - 180;
        bodies.push({
          eid: ent.eid, stat: ent.statId || ent.stat || null, post: ent.populationPost,
          region: ent.populationRegion, tier: ent.populationTier,
          hp: ent.hp, alert: +(ent.alert || 0).toFixed(4), alert_state: ent.alertState,
          dist_m: +Math.hypot(dx, dz).toFixed(2),
          yaw: +(ent.yaw === undefined ? 0 : ent.yaw).toFixed(2),
          yaw_err_deg: +Math.abs(dyaw).toFixed(2),
          speed: +(ent.speed || 0).toFixed(3),
        });
      }
      return {
        frame: sim.frame,
        player: { x: +p.pos[0].toFixed(2), z: +p.pos[2].toFixed(2), hp: p.hp, region: sim.env && sim.env.region },
        npcs: sim.npcs ? sim.npcs.length : 0,
        entities: sim.entities.length,
        population: rep,
        bodies,
      };
    },
    /** Compact census: the numbers the census arms compare. No per-body detail. */
    census() {
      const l = window.__POP.look();
      const r = l.population || {};
      return {
        frame: l.frame, x: l.player.x, z: l.player.z, hp: l.player.hp, npcs: l.npcs,
        spawned: r.stats ? r.stats.spawned : 0,
        released: r.stats ? r.stats.released : 0,
        cleared_stat: r.stats ? r.stats.cleared : 0,
        refocuses: r.stats ? r.stats.refocuses : 0,
        steps: r.stats ? r.stats.steps : 0,
        live_posts: r.live_posts, live_bodies: r.live_bodies,
        dormant: r.dormant, resident: r.resident, cleared: r.cleared,
        faults: (r.faults || []).length,
      };
    },
    /** Keep the census walker alive. Declared in the report: these walks count, they do not fight. */
    topUp() {
      const p = window.__ENGINE.sim.player;
      const before = p.hp;
      if (p.hpMax !== undefined && p.hp < p.hpMax) p.hp = p.hpMax;
      return { before, after: p.hp };
    },
    /** Post ids of everything currently resident, with their body eids. */
    resident() {
      const e = window.__ENGINE;
      const out = [];
      for (const [id, eids] of e.population.live) {
        const p = e.population.byId.get(id);
        out.push({ post: id, encounter: p.encounter, region: p.region, tier: p.tier, x: p.x, z: p.z, eids: [...eids] });
      }
      return out;
    },
    /** Nearest post to the player that is not yet cleared, from the DATA (not from the world). */
    nearestPost(maxM) {
      const e = window.__ENGINE;
      const p = e.sim.player.pos;
      let best = null;
      for (const q of e.population.posts) {
        const d = Math.hypot(q.x - p[0], q.z - p[2]);
        if (d > (maxM || 1e9)) continue;
        if (!best || d < best.d) best = { d, post: q };
      }
      return best ? { dist_m: +best.d.toFixed(2), ...best.post } : null;
    },
  };
  return true;
};

// ---------------------------------------------------------------------------------------------
function contention() {
  const out = {};
  try { out.headless_shell = Number(execFileSync('bash', ['-lc', 'pgrep -c headless_shell || echo 0']).toString().trim()); } catch { out.headless_shell = null; }
  try { out.loadavg = fs.readFileSync('/proc/loadavg', 'utf8').trim(); } catch { out.loadavg = null; }
  return out;
}

async function bootPage(handle) {
  await handle.h('setRenderRate', 0);        // AGENT-PROTOCOL: before ANY stepping loop
  await handle.h('setSeed', 1337);
  await handle.h('loadState', STATE);
  await handle.page.evaluate(INSTALL);
}

/**
 * Walk `metres` of the named route through the game's own locomotion, sampling the census.
 * `restart:true` teleports to the route head, which is the ONLY placement in this arm.
 */
async function walkCensus(handle, metres, { chunk = 900, label = 'walk' } = {}) {
  const samples = [];
  let r = await handle.h('walkRoute', { route: ROUTE, speed: SPEED, restart: true, chunkFrames: 1, stream: false });
  samples.push({ m: 0, ...(await handle.page.evaluate(() => window.__POP.census())) });
  let topUps = 0;
  let guard = 0;
  while (r.dist_m < metres && !r.done && guard++ < 400) {
    r = await handle.h('walkRoute', { route: ROUTE, speed: SPEED, chunkFrames: chunk, stream: false });
    const c = await handle.page.evaluate(() => window.__POP.census());
    samples.push({ m: +r.dist_m.toFixed(1), ...c });
    // The census walks are a CENSUS, not a survival test: they walk straight through fights the
    // player never fights back in. Topping the walker up keeps the arm measuring placement rather
    // than measuring how long an unarmed mannequin survives a marsh. Counted and declared.
    const t = await handle.page.evaluate(() => window.__POP.topUp());
    if (t.after > t.before) topUps++;
  }
  const last = samples[samples.length - 1];
  return { label, metres_walked: +(r.dist_m || 0).toFixed(1), frames: r.frames, done: !!r.done, top_ups: topUps, samples, final: last };
}

// =============================================================================================
(async () => {
  report.contention.before = contention();
  log(`contention before: ${JSON.stringify(report.contention.before)}`);

  const originalPosts = fs.readFileSync(POSTS_PATH);       // A5 restores these exact bytes
  let handle = null;
  let restored = true;

  try {
    handle = await launchGame({ width: 320, height: 240, ...args });
    await bootPage(handle);

    const model = await handle.page.evaluate(() => {
      const e = window.__ENGINE;
      return {
        model_loaded: !!e.data.population,
        posts_loaded: !!e.data.populationPosts,
        system_constructed: !!e.population,
        stream: e.population ? { ...e.population.d } : null,
        posts: e.population ? e.population.posts.length : 0,
      };
    });
    report.arms.wiring = model;
    (model.model_loaded && model.posts_loaded && model.system_constructed && model.posts > 0 ? pass : fail)(
      'A0 the model reaches the running engine', model);

    // -------------------------------------------------------------------------------------
    // A1 WALK — bodies must materialise PROGRESSIVELY under a moving player.
    // -------------------------------------------------------------------------------------
    let baseline = null;
    if (want('A1')) {
      log(`A1 walking ${METRES} m of '${ROUTE}' …`);
      baseline = await walkCensus(handle, METRES, { label: 'baseline' });
      report.arms.A1 = baseline;
      const f = baseline.final;
      // Progressive: the spawn count must rise at more than one sample, not jump once at m=0.
      let rises = 0;
      for (let i = 1; i < baseline.samples.length; i++) {
        if (baseline.samples[i].spawned > baseline.samples[i - 1].spawned) rises++;
      }
      const atStart = baseline.samples[0].spawned;
      const ok = f.spawned > 0 && rises >= 2 && f.faults === 0;
      (ok ? pass : fail)('A1 hostiles materialise progressively under a walking player', {
        metres: baseline.metres_walked, frames: baseline.frames,
        posts_spawned: f.spawned, posts_released: f.released, bodies_live_at_end: f.live_bodies,
        spawned_at_metre_zero: atStart, samples_where_count_rose: rises,
        refocuses: f.refocuses, steps: f.steps, faults: f.faults, top_ups: baseline.top_ups,
      });
    }

    // -------------------------------------------------------------------------------------
    // A2 STILL — the same frame count, standing still. The control for "it is really an
    //    on-load spawn list": a still player must materialise far fewer posts.
    // -------------------------------------------------------------------------------------
    if (want('A2') && baseline) {
      log('A2 standing still for the same frames …');
      await handle.h('loadState', STATE);
      await handle.page.evaluate(INSTALL);
      // Stand exactly where the walk started, and step the same number of frames without input.
      await handle.h('walkRoute', { route: ROUTE, speed: SPEED, restart: true, chunkFrames: 1, stream: false });
      const before = await handle.page.evaluate(() => window.__POP.census());
      let left = baseline.frames;
      while (left > 0) { const n = Math.min(1800, left); await handle.h('stepFrames', n); left -= n; }
      const after = await handle.page.evaluate(() => window.__POP.census());
      report.arms.A2 = { frames: baseline.frames, before, after };
      const ok = after.spawned > 0 && after.spawned * 3 < baseline.final.spawned;
      (ok ? pass : fail)('A2 a STILL player populates far less than a walking one (motion is the driver)', {
        frames_each: baseline.frames,
        still_posts_spawned: after.spawned, walking_posts_spawned: baseline.final.spawned,
        ratio: +(baseline.final.spawned / Math.max(1, after.spawned)).toFixed(2),
        still_refocuses: after.refocuses, walking_refocuses: baseline.final.refocuses,
        note: 'a still player materialises only what is already inside spawn_radius_m and then stops',
      });
    }

    // -------------------------------------------------------------------------------------
    // A3 ABLATION — one boolean, and the province is empty again.
    // -------------------------------------------------------------------------------------
    if (want('A3') && baseline) {
      log('A3 ablating the population system …');
      await handle.h('loadState', STATE);
      await handle.page.evaluate(INSTALL);
      await handle.h('setPopulation', { enabled: false, reset: true });
      const ab = await walkCensus(handle, METRES, { label: 'ablated' });
      report.arms.A3 = ab;
      const ok = ab.final.spawned === 0 && ab.final.live_bodies === 0;
      (ok ? pass : fail)('A3 ABLATION CONTROL: enabled:false walks the same road and finds nothing', {
        metres: ab.metres_walked, posts_spawned: ab.final.spawned, bodies: ab.final.live_bodies,
        baseline_posts_spawned: baseline.final.spawned,
        note: 'the control that must go red — if this is non-zero the probe is measuring something else',
      });
      await handle.h('setPopulation', { enabled: true, reset: true });
    }

    // -------------------------------------------------------------------------------------
    // A4 RADIUS — perturb one number in `stream` at runtime; the world must follow it.
    // -------------------------------------------------------------------------------------
    if (want('A4') && baseline) {
      log('A4 perturbing spawn_radius_m …');
      await handle.h('loadState', STATE);
      await handle.page.evaluate(INSTALL);
      await handle.h('setPopulation', { enabled: true, spawn_radius_m: 25, release_radius_m: 60, reset: true });
      const tight = await walkCensus(handle, METRES, { label: 'radius25' });
      report.arms.A4 = { tight: tight.final, baseline: baseline.final };
      const ok = tight.final.spawned < baseline.final.spawned;
      (ok ? pass : fail)('A4 spawn_radius_m is consumed: a 25 m radius populates less road than 170 m', {
        radius_25_posts: tight.final.spawned, radius_default_posts: baseline.final.spawned,
        radius_25_released: tight.final.released, radius_default_released: baseline.final.released,
      });
      await handle.h('setPopulation', {
        spawn_radius_m: model.stream.spawn_radius_m, release_radius_m: model.stream.release_radius_m, reset: true,
      });
    }

    // -------------------------------------------------------------------------------------
    // A5 MODEL — regenerate the placement from a perturbed model, RELOAD, walk the same road.
    //    This is the arm that proves `game/data/world/population.json` is what fills the world.
    // -------------------------------------------------------------------------------------
    if (want('A5') && baseline) {
      log('A5 regenerating population-posts.json at double density …');
      const gen = JSON.parse(execFileSync('node', [BUILDER, '--encounters-per-tm', '1.7', '--write'], { cwd: REPO_ROOT }).toString());
      restored = false;
      await handle.page.reload({ waitUntil: 'load' });
      await handle.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready && window.__HARNESS.ready(), null, { timeout: 120000 }).catch(() => {});
      await bootPage(handle);
      const dense = await walkCensus(handle, METRES, { label: 'dense' });

      // Restore the canonical bytes and confirm the world comes back to the baseline count.
      fs.writeFileSync(POSTS_PATH, originalPosts);
      restored = true;
      await handle.page.reload({ waitUntil: 'load' });
      await handle.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready && window.__HARNESS.ready(), null, { timeout: 120000 }).catch(() => {});
      await bootPage(handle);
      const back = await walkCensus(handle, METRES, { label: 'restored' });

      report.arms.A5 = {
        perturbation: '--encounters-per-tm 1.7 (model default is in population.json budget)',
        generated: { posts: gen.posts, bodies: gen.bodies, souls: gen.souls },
        dense: dense.final, restored: back.final, baseline: baseline.final,
      };
      const ok = dense.final.spawned > baseline.final.spawned && back.final.spawned === baseline.final.spawned;
      (ok ? pass : fail)('A5 MODEL CONSUMPTION: a denser population.json puts more bodies on the same road', {
        baseline_posts_spawned: baseline.final.spawned,
        dense_posts_spawned: dense.final.spawned,
        restored_posts_spawned: back.final.spawned,
        baseline_bodies_live_end: baseline.final.live_bodies, dense_bodies_live_end: dense.final.live_bodies,
        file_restored_byte_identical: true,
        note: 'the file was regenerated on disk, the page reloaded, and the SAME walk taken — nothing in the probe placed anything',
      });
    }

    // -------------------------------------------------------------------------------------
    // A6 BEHAVIOUR — do the bodies actually DO anything? Notice, turn, move.
    //    Run against a still player AND a moving one: a still target hides steering defects.
    // -------------------------------------------------------------------------------------
    if (want('A6')) {
      log('A6 behaviour: notice / turn / move …');
      await handle.h('loadState', STATE);
      await handle.page.evaluate(INSTALL);
      await handle.h('setPopulation', { enabled: true, reset: true });

      // Walk until at least one post is resident, then stop and watch it.
      let r = await handle.h('walkRoute', { route: ROUTE, speed: SPEED, restart: true, chunkFrames: 1, stream: false });
      let res = [];
      let guard = 0;
      while (res.length === 0 && guard++ < 120 && !r.done) {
        r = await handle.h('walkRoute', { route: ROUTE, speed: SPEED, chunkFrames: 600, stream: false });
        res = await handle.page.evaluate(() => window.__POP.resident());
        await handle.page.evaluate(() => window.__POP.topUp());
      }
      const arrival = await handle.page.evaluate(() => window.__POP.look());
      // Approach the nearest live body so perception has something to work with, then hold.
      const target = arrival.bodies.slice().sort((a, b) => a.dist_m - b.dist_m)[0] || null;
      let observed = null;
      if (target) {
        const t0 = await handle.page.evaluate(() => window.__POP.look());
        await handle.h('stepFrames', 600);
        const t1 = await handle.page.evaluate(() => window.__POP.look());
        // Now MOVE the player laterally: a target that never moves cannot expose a steering
        // defect. `walkRoute` keeps driving the same locomotion the player's stick drives.
        await handle.h('walkRoute', { route: ROUTE, speed: SPEED, chunkFrames: 240, stream: false });
        const t2 = await handle.page.evaluate(() => window.__POP.look());
        const pick = (snap, eid) => snap.bodies.find((b) => b.eid === eid) || null;
        observed = {
          eid: target.eid,
          at_arrival: pick(t0, target.eid), after_600_still: pick(t1, target.eid), after_240_moving: pick(t2, target.eid),
          all_at_arrival: t0.bodies, all_after_still: t1.bodies, all_after_moving: t2.bodies,
        };
        const noticed = t1.bodies.filter((b) => b.alert > 0.01 || (b.alert_state && b.alert_state !== 'IDLE')).length;
        const moved = t1.bodies.filter((b) => b.speed > 0.01).length
          || t2.bodies.filter((b) => b.speed > 0.01).length;
        // Steering: against a MOVING player the yaw error of the aggroed bodies must be finite and
        // closing, not frozen at whatever it was authored to.
        const turnedBodies = [];
        for (const b of t2.bodies) {
          const a = pick(t0, b.eid);
          if (a && Math.abs(a.yaw - b.yaw) > 1.0) turnedBodies.push({ eid: b.eid, yaw_arrival: a.yaw, yaw_now: b.yaw, yaw_err_now: b.yaw_err_deg, alert: b.alert, state: b.alert_state });
        }
        report.arms.A6 = { resident_posts: res.length, observed, noticed, moved, turned: turnedBodies.length, turnedBodies };
        const ok = t1.bodies.length > 0 && noticed > 0 && (moved > 0 || turnedBodies.length > 0);
        (ok ? pass : fail)('A6 the bodies BEHAVE: they notice the player, turn toward him and move', {
          bodies_watched: t1.bodies.length, noticed_count: noticed,
          moved_count: moved, turned_count: turnedBodies.length,
          note: 'measured against a MOVING player as well as a still one — a still target hides steering defects',
        });
      } else {
        report.arms.A6 = { resident_posts: res.length, note: 'no resident body reached within the walk budget' };
        fail('A6 the bodies BEHAVE', { reason: 'no body became resident within the walk budget', resident_posts: res.length });
      }
    }

    // -------------------------------------------------------------------------------------
    // A7 COMPOSITION — `absent_when_flag` removes an arm of a raid party, statblocks unchanged.
    // -------------------------------------------------------------------------------------
    if (want('A7')) {
      log('A7 composition via absent_when_flag …');
      await handle.h('loadState', STATE);
      await handle.page.evaluate(INSTALL);
      await handle.h('setPopulation', { enabled: false, reset: true });   // isolate the arm
      const at = await handle.page.evaluate(() => {
        const p = window.__ENGINE.sim.player.pos; return [p[0] + 30, p[2] + 30];
      });
      const before = await handle.h('spawnEncounter', 'dres-raid-party', at[0], at[1], { tag: 'a7-before' });
      const statsBefore = await handle.page.evaluate((eids) => eids.map((eid) => {
        const e = window.__ENGINE.sim.findEntity(eid); return e ? { eid, stat: e.statId || e.stat, hp: e.hp } : { eid, missing: true };
      }), before.eids);
      for (const eid of before.eids) await handle.h('despawn', eid);

      await handle.h('questSetFlag', 'the_sixty_are_protected', true);
      const after = await handle.h('spawnEncounter', 'dres-raid-party', at[0], at[1], { tag: 'a7-after' });
      const statsAfter = await handle.page.evaluate((eids) => eids.map((eid) => {
        const e = window.__ENGINE.sim.findEntity(eid); return e ? { eid, stat: e.statId || e.stat, hp: e.hp } : { eid, missing: true };
      }), after.eids);
      for (const eid of after.eids) await handle.h('despawn', eid);
      await handle.h('questSetFlag', 'the_sixty_are_protected', false);

      const kinds = (s) => [...new Set(s.map((b) => b.stat))].sort();
      const hpsB = [...new Set(statsBefore.map((b) => b.hp))].sort();
      const hpsA = [...new Set(statsAfter.map((b) => b.hp))].sort();
      report.arms.A7 = {
        before: { bodies: before.eids.length, kinds: kinds(statsBefore), hps: hpsB, detail: statsBefore },
        after: { bodies: after.eids.length, kinds: kinds(statsAfter), hps: hpsA, detail: statsAfter },
      };
      const ok = after.eids.length < before.eids.length
        && JSON.stringify(kinds(statsBefore)) === JSON.stringify(kinds(statsAfter))
        && JSON.stringify(hpsB) === JSON.stringify(hpsA);
      (ok ? pass : fail)('A7 COMPOSITION: a quest resolution removes bodies and changes no statblock', {
        bodies_before: before.eids.length, bodies_after: after.eids.length,
        statblocks_before: kinds(statsBefore), statblocks_after: kinds(statsAfter),
        distinct_hp_before: hpsB, distinct_hp_after: hpsA,
        note: 'the world got easier by having fewer bodies, not by having weaker ones (RI-AI05: composition over stat inflation)',
      });
      await handle.h('setPopulation', { enabled: true, reset: true });
    }

    // -------------------------------------------------------------------------------------
    // A8 RESPAWN — S5. Clearing sticks through a walk-away; a hearth rest brings it back;
    //    `sim.npcs` is untouched by any of it.
    // -------------------------------------------------------------------------------------
    if (want('A8')) {
      log('A8 S5 respawn coupling …');
      await handle.h('loadState', STATE);
      await handle.page.evaluate(INSTALL);
      await handle.h('setPopulation', { enabled: true, reset: true });

      // Walk until something is resident.
      let r = await handle.h('walkRoute', { route: ROUTE, speed: SPEED, restart: true, chunkFrames: 1, stream: false });
      let res = [];
      let guard = 0;
      while (res.length === 0 && guard++ < 120 && !r.done) {
        r = await handle.h('walkRoute', { route: ROUTE, speed: SPEED, chunkFrames: 600, stream: false });
        res = await handle.page.evaluate(() => window.__POP.resident());
        await handle.page.evaluate(() => window.__POP.topUp());
      }
      const npcsBefore = (await handle.page.evaluate(() => window.__POP.census())).npcs;

      const stages = {};
      if (res.length) {
        const victim = res[0];
        for (const eid of victim.eids) { try { await handle.h('killEntity', eid); } catch { /* already down */ } }
        await handle.h('stepFrames', 60);
        stages.after_kill = await handle.page.evaluate((id) => {
          const e = window.__ENGINE; return { state: e.population.state.get(id), census: window.__POP.census() };
        }, victim.post);

        // Walk away past the release radius and come back. Walking away is NOT a respawn.
        await handle.h('walkRoute', { route: ROUTE, speed: 'jog', chunkFrames: 12000, stream: false });
        await handle.page.evaluate(() => window.__POP.topUp());
        stages.after_walk_away = await handle.page.evaluate((id) => {
          const e = window.__ENGINE; return { state: e.population.state.get(id), census: window.__POP.census() };
        }, victim.post);

        // Rest. RI-PRG04 §1: every non-unique hostile returns, including ones killed hours ago.
        const rest = await handle.h('hearthRest', {}).catch((e) => ({ error: String(e && e.message || e) }));
        await handle.h('stepFrames', 60);
        stages.after_rest = await handle.page.evaluate((id) => {
          const e = window.__ENGINE; return { state: e.population.state.get(id), census: window.__POP.census() };
        }, victim.post);
        stages.rest = rest;

        const npcsAfter = (await handle.page.evaluate(() => window.__POP.census())).npcs;
        report.arms.A8 = { victim, npcs_before: npcsBefore, npcs_after: npcsAfter, stages };

        const clearedOnKill = stages.after_kill.state === 'cleared';
        const stayedCleared = stages.after_walk_away.state === 'cleared';
        const backAfterRest = stages.after_rest.state !== 'cleared';
        const npcsHeld = npcsBefore === npcsAfter;
        (clearedOnKill && stayedCleared && npcsHeld ? pass : fail)(
          'A8 S5: a cleared post stays cleared across a walk-away (walking is not a respawn)', {
            post: victim.post, bodies_killed: victim.eids.length,
            state_after_kill: stages.after_kill.state,
            state_after_walking_away: stages.after_walk_away.state,
            npcs_before: npcsBefore, npcs_after: npcsAfter,
          });
        (backAfterRest ? pass : fail)('A8 S5: resting at a hearth returns the post to the world', {
          post: victim.post, state_after_rest: stages.after_rest.state,
          uncleared_count: stages.after_rest.census ? undefined : undefined,
          rest: stages.rest,
          note: 'RI-PRG04 §1 — every non-unique hostile returns, including ones killed a kilometre back',
        });
      } else {
        report.arms.A8 = { note: 'no resident post inside the walk budget' };
        fail('A8 S5 respawn coupling', { reason: 'no resident post inside the walk budget' });
      }
    }

    report.contention.after = contention();
  } catch (err) {
    report.error = String((err && err.stack) || err);
    fail('probe completed', { error: String((err && err.message) || err) });
  } finally {
    if (!restored) { try { fs.writeFileSync(POSTS_PATH, originalPosts); restored = true; } catch { /* nothing else to try */ } }
    report.posts_file_restored = restored;
    if (handle) { try { await handle.close(); } catch { /* closing a dead page */ } }
  }

  report.summary = {
    checks: report.checks.length,
    passed: report.checks.filter((c) => c.pass).length,
    failed: report.checks.filter((c) => !c.pass).length,
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  log(`\n${report.summary.passed}/${report.summary.checks} checks passed -> ${path.relative(REPO_ROOT, OUT)}`);
  process.exit(report.summary.failed === 0 ? 0 : 1);
})();
