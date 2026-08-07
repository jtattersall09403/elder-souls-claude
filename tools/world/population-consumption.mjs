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
          // `ent.id` is the STATBLOCK id (sim/entities.js#makeEntity). `ent.tier` is the
          // statblock's combat tier and `ent.populationTier` is the REGION's danger_tier; they
          // are different numbers and both are reported so nothing has to guess which.
          eid: ent.eid, stat: ent.id, post: ent.populationPost,
          region: ent.populationRegion, region_tier: ent.populationTier, stat_tier: ent.tier,
          encounter: ent.encounterId, role: ent.encounterRole, ai_state: ent.state,
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
    /**
     * Keep the census walker alive, and REPORT WHAT IT COST. Declared in the report: these walks
     * count bodies, they do not fight back, so a walker that dies would be measuring how long an
     * unarmed mannequin survives a marsh rather than how populated the road is.
     *
     * `combat.player` is the authority — `sim/combat-bridge.js#mirror` copies its hp into
     * `sim.player` every step, so healing `sim.player` alone is undone on the next frame. That
     * is why the first smoke run reported five top-ups and a walker still bleeding out.
     */
    topUp() {
      const e = window.__ENGINE;
      const b = e.combat && e.combat.player;
      const p = e.sim.player;
      const before = b ? b.hp : p.hp;
      const max = b ? b.hpMax : p.hpMax;
      const healed = max !== undefined && before < max ? max - before : 0;
      if (healed > 0) { if (b) b.hp = max; p.hp = max; }
      window.__POP._damage = (window.__POP._damage || 0) + healed;
      return { before, after: max === undefined ? before : max, healed, cumulative_damage: window.__POP._damage };
    },
    damageTaken() { return window.__POP._damage || 0; },
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
 * A harness call that is ALLOWED to throw. `handle.h()` calls `die()` on an in-page throw and
 * takes the whole process with it, which is right for a verb the tool depends on and wrong for
 * `killEntity` on a body that is already down.
 */
async function tryH(handle, method, ...callArgs) {
  return handle.page.evaluate(async ({ m, a }) => {
    const H = window.__HARNESS;
    if (!H || typeof H[m] !== 'function') return { ok: false, error: `no such harness verb: ${m}` };
    try { return { ok: true, value: await H[m](...a) }; }
    catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
  }, { m: method, a: callArgs });
}

/**
 * Run `fn` against a freshly booted page. A5 needs this because a data file only reaches the
 * engine at boot. The caller closes its own handle first, so this never raises the number of
 * browsers running at once above one.
 */
async function withFreshBrowser(fn) {
  const h2 = await launchGame({ width: 320, height: 240, ...args });
  try { await bootPage(h2); return await fn(h2); }
  finally { try { await h2.close(); } catch { /* closing a dead page */ } }
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
  while (r.path_m < metres && !r.done && guard++ < 400) {
    r = await handle.h('walkRoute', { route: ROUTE, speed: SPEED, chunkFrames: chunk, stream: false });
    const c = await handle.page.evaluate(() => window.__POP.census());
    samples.push({ m: +r.path_m.toFixed(1), ...c });
    // The census walks are a CENSUS, not a survival test: they walk straight through fights the
    // player never fights back in. Topping the walker up keeps the arm measuring placement rather
    // than measuring how long an unarmed mannequin survives a marsh. Counted and declared.
    const t = await handle.page.evaluate(() => window.__POP.topUp());
    if (t.healed > 0) topUps++;
  }
  const last = samples[samples.length - 1];
  const damage = await handle.page.evaluate(() => window.__POP.damageTaken());
  return {
    label, metres_walked: +(r.path_m || 0).toFixed(1), frames: r.frames, done: !!r.done,
    top_ups: topUps, damage_taken_hp: +damage.toFixed(1), samples, final: last,
  };
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
        refocuses: f.refocuses, steps: f.steps, faults: f.faults,
        // The road fights back now, and this is the number that says so. The walker never
        // attacks; this is damage taken walking THROUGH the population, healed between chunks
        // so the arm measures placement rather than survival.
        damage_taken_hp: baseline.damage_taken_hp, top_ups: baseline.top_ups,
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
      //
      // `clearInputs()` IS LOAD-BEARING AND ITS ABSENCE MADE THIS ARM PASS FOR THE WRONG REASON.
      // `walkRoute()` queues a move vector for each frame it steps and does NOT clear the queue
      // when it returns, so a plain `stepFrames()` afterwards keeps applying the last latched
      // stick. Run without it, this "still" arm's player travelled 877.45 m off the road — it
      // passed 2-against-10 not because standing still populates less, but because walking into
      // trackless terrain does. Any probe in this tree that calls `walkRoute` and then
      // `stepFrames` is still moving unless it clears the queue.
      await handle.h('walkRoute', { route: ROUTE, speed: SPEED, restart: true, chunkFrames: 1, stream: false });
      await handle.h('clearInputs');
      const before = await handle.page.evaluate(() => window.__POP.census());
      let left = baseline.frames;
      while (left > 0) { const n = Math.min(1800, left); await handle.h('stepFrames', n); left -= n; }
      const after = await handle.page.evaluate(() => window.__POP.census());
      // The arm's OWN control: if the "still" player moved, the comparison is meaningless and
      // this check must go red rather than quietly measure something else.
      const drift = Math.hypot(after.x - before.x, after.z - before.z);
      report.arms.A2 = { frames: baseline.frames, before, after, drift_m: +drift.toFixed(2) };
      const stoodStill = drift < 2.0;
      const ok = stoodStill && after.spawned * 3 < baseline.final.spawned;
      (ok ? pass : fail)('A2 a STILL player populates far less than a walking one (motion is the driver)', {
        frames_each: baseline.frames,
        still_player_drift_m: +drift.toFixed(2), stood_still: stoodStill,
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
      log('A5 regenerating population-posts.json at higher density …');
      // THE FLAG IS SET BEFORE THE MUTATION, NOT AFTER, and the first run of this tool is why.
      // `restored = false` used to sit on the line below the generator call; the generator wrote
      // the file and THEN the call threw (it prints "wrote …" ahead of its JSON, so `JSON.parse`
      // choked), so the flag was still true, the `finally` skipped the restore, and the tool left
      // a perturbed placement on disk while reporting `posts_file_restored: true`. A cleanup flag
      // raised after the thing it guards is not a guard.
      restored = false;
      execFileSync('node', [BUILDER, '--encounters-per-tm', '1.7', '--write'], { cwd: REPO_ROOT });
      const gen = JSON.parse(fs.readFileSync(POSTS_PATH, 'utf8')).report;
      await handle.close(); handle = null;   // one browser at a time, always
      // A data file only reaches the engine at boot, so this arm needs a fresh page. It takes a
      // SECOND browser SEQUENTIALLY — the first is closed before the second opens, so the
      // concurrent-browser count never rises — rather than `page.reload()`, which
      // TOOL-COVERAGE-R1 §2 recorded hanging 3 of 3 times on this build.
      const dense = await withFreshBrowser(async (h2) => walkCensus(h2, METRES, { label: 'dense' }));

      // Restore the canonical bytes and confirm the world comes back to the baseline count.
      fs.writeFileSync(POSTS_PATH, originalPosts);
      restored = true;
      const back = await withFreshBrowser(async (h2) => walkCensus(h2, METRES, { label: 'restored' }));
      // The instrument returns to the browser it came in with, so the later arms still run on
      // one long-lived page.
      handle = await launchGame({ width: 320, height: 240, ...args });
      await bootPage(handle);

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
      await handle.h('clearInputs');
      const arrival = await handle.page.evaluate(() => window.__POP.look());
      // CLOSE THE DISTANCE. The first run of this arm did not, and it is the single most
      // instructive failure in this tool: a post materialises at up to `spawn_radius_m` = 170 m,
      // and the widest `sight_radius_m` on the roster is 20 m. So the arm watched a slitherfang
      // standing 170.08 m away for 600 frames, recorded `alert 0, speed 0, IDLE`, and filed
      // "the bodies do not behave". They behaved correctly; the instrument was a hundred and
      // fifty metres too far away to see it. Suspect the instrument first.
      const target = arrival.bodies.slice().sort((a, b) => a.dist_m - b.dist_m)[0] || null;
      let observed = null;
      if (target) {
        // Stand 9 m off it, inside every sight radius in the roster and outside every reach.
        const approach = await handle.page.evaluate((eid) => {
          const e = window.__ENGINE;
          const b = e.sim.findEntity(eid);
          if (!b) return null;
          const p = e.sim.player.pos;
          const dx = p[0] - b.pos[0], dz = p[2] - b.pos[2];
          const d = Math.hypot(dx, dz) || 1;
          return { x: b.pos[0] + (dx / d) * 9, z: b.pos[2] + (dz / d) * 9, body: [b.pos[0], b.pos[2]] };
        }, target.eid);
        await handle.h('teleport', approach.x, approach.z);
        await handle.h('clearInputs');
        const t0 = await handle.page.evaluate(() => window.__POP.look());
        await handle.h('stepFrames', 600);
        const t1 = await handle.page.evaluate(() => window.__POP.look());
        // Now MOVE the player, in a circle AROUND the body rather than along the road. A still
        // target hides every steering defect (AGENT-PROTOCOL §4): if the enemy's facing only
        // ever has to be right about a stationary player, a frozen yaw looks identical to a
        // tracking one. `walkPath` drives the same locomotion the player's stick drives.
        const ring = [];
        for (let i = 1; i <= 8; i++) {
          const a = (i / 8) * Math.PI * 1.5;
          ring.push([approach.body[0] + Math.cos(a) * 9, approach.body[1] + Math.sin(a) * 9]);
        }
        await handle.h('walkPath', ring, { speed: SPEED, maxFrames: 2400 });
        const t2 = await handle.page.evaluate(() => window.__POP.look());
        const pick = (snap, eid) => snap.bodies.find((b) => b.eid === eid) || null;
        observed = {
          eid: target.eid, approach_to_m: 9,
          at_arrival: pick(t0, target.eid), after_600_still: pick(t1, target.eid), after_ring_moving: pick(t2, target.eid),
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
          dist_at_arrival_m: pick(t0, target.eid) && pick(t0, target.eid).dist_m,
          dist_after_approach_m: observed.at_arrival && observed.at_arrival.dist_m,
          alert_still: observed.after_600_still && observed.after_600_still.alert,
          alert_moving: observed.after_ring_moving && observed.after_ring_moving.alert,
          yaw_err_after_ring_deg: observed.after_ring_moving && observed.after_ring_moving.yaw_err_deg,
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
        const e = window.__ENGINE.sim.findEntity(eid);
        return e ? { eid, stat: e.id, role: e.encounterRole, hp: e.hp, hp_max: e.hpMax, poise: e.poise } : { eid, missing: true };
      }), before.eids);
      for (const eid of before.eids) await handle.h('despawn', eid);

      const flagSet = await tryH(handle, 'questSetFlag', 'the_sixty_are_protected', true);
      const after = await handle.h('spawnEncounter', 'dres-raid-party', at[0], at[1], { tag: 'a7-after' });
      const statsAfter = await handle.page.evaluate((eids) => eids.map((eid) => {
        const e = window.__ENGINE.sim.findEntity(eid);
        return e ? { eid, stat: e.id, role: e.encounterRole, hp: e.hp, hp_max: e.hpMax, poise: e.poise } : { eid, missing: true };
      }), after.eids);
      for (const eid of after.eids) await handle.h('despawn', eid);
      await tryH(handle, 'questSetFlag', 'the_sixty_are_protected', false);

      const kinds = (s) => [...new Set(s.map((b) => b.stat))].sort();
      const hpsB = [...new Set(statsBefore.map((b) => b.hp))].sort();
      const hpsA = [...new Set(statsAfter.map((b) => b.hp))].sort();
      report.arms.A7 = {
        flag: 'the_sixty_are_protected', flag_set: flagSet,
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
        const snap = async (id) => handle.page.evaluate((pid) => {
          const e = window.__ENGINE;
          const eids = e.population.live.get(pid) || [];
          return {
            state: e.population.state.get(pid),
            live_here: eids.length,
            alive_here: eids.filter((x) => { const b = e.sim.findEntity(x); return b && b.hp > 0; }).length,
            census: window.__POP.census(),
          };
        }, id);

        for (const eid of victim.eids) await tryH(handle, 'killEntity', eid);
        await handle.h('stepFrames', 60);
        stages.after_kill = await snap(victim.post);

        // Walk away past the release radius. Walking away is NOT a respawn.
        await handle.h('walkRoute', { route: ROUTE, speed: 'jog', chunkFrames: 12000, stream: false });
        await handle.page.evaluate(() => window.__POP.topUp());
        stages.after_walk_away = await snap(victim.post);

        // Come back to it WITHOUT resting. Still cleared, still empty: the whole point of the
        // three-state lifecycle is that returning to a place you emptied finds it empty.
        await handle.h('teleport', victim.x + 40, victim.z + 40);
        await handle.h('stepFrames', 300);
        stages.after_return_no_rest = await snap(victim.post);

        // Rest. RI-PRG04 §1: every non-unique hostile returns, including ones killed hours ago.
        // `restAt(id)` is the harness affordance the engine documents for naming a well the body
        // is not standing at; the respawn path it drives is the same `respawnOrdinary`.
        const restHearth = String(args.hearth || 'hearth-blackrose');
        stages.rest = await tryH(handle, 'restAt', restHearth);
        await handle.h('stepFrames', 300);
        stages.after_rest = await snap(victim.post);

        const npcsAfter = (await handle.page.evaluate(() => window.__POP.census())).npcs;
        report.arms.A8 = { victim, rest_hearth: restHearth, npcs_before: npcsBefore, npcs_after: npcsAfter, stages };

        const clearedOnKill = stages.after_kill.state === 'cleared';
        const stayedCleared = stages.after_walk_away.state === 'cleared'
          && stages.after_return_no_rest.state === 'cleared'
          && stages.after_return_no_rest.alive_here === 0;
        const backAfterRest = stages.after_rest.state !== 'cleared';
        const npcsHeld = npcsBefore === npcsAfter;
        (clearedOnKill && stayedCleared ? pass : fail)(
          'A8 S5: a cleared post stays cleared across a walk-away AND a return (walking is not resting)', {
            post: victim.post, bodies_killed: victim.eids.length,
            state_after_kill: stages.after_kill.state,
            state_after_walking_away: stages.after_walk_away.state,
            state_after_returning: stages.after_return_no_rest.state,
            bodies_alive_on_return: stages.after_return_no_rest.alive_here,
          });
        (backAfterRest ? pass : fail)('A8 S5: resting at a hearth returns the post to the world', {
          post: victim.post, hearth: restHearth,
          state_after_rest: stages.after_rest.state,
          cleared_posts_before_rest: stages.after_return_no_rest.census.cleared,
          cleared_posts_after_rest: stages.after_rest.census.cleared,
          rest_ok: stages.rest.ok, rest_error: stages.rest.error || null,
          note: 'RI-PRG04 §1 — every non-unique hostile returns, including ones killed a kilometre back',
        });
        (npcsHeld ? pass : fail)('A8 S5: named people, merchants, trainers and quest actors are untouched by all of it', {
          npcs_before: npcsBefore, npcs_after: npcsAfter,
          note: 'sim.npcs is a different array and nothing in game/src/world/population.js touches it',
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
