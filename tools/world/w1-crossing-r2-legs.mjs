#!/usr/bin/env node
/**
 * w1-crossing-r2-legs.mjs — EVERY LEG, BOTH WAYS, IN ONE BROWSER.
 *
 * ================================================================================================
 * WHY THIS EXISTS: RULE 8 GENERALISED.
 * ================================================================================================
 *
 * W1-CROSSING round 1 was scored **6 on robustness** with one sentence: *"the route was tested in
 * one direction, at one time of day, once. Reversed, it jams at 5,072.3 m on a bridge deck laid
 * across the carriageway."* The critic found that by varying a fixture the builder had left still.
 * A route measured in ONE direction is a still target, and the whole province had been measured
 * that way: ten legs, forwards, once.
 *
 * So this tool measures every built leg in BOTH directions and THE CROSSING in both directions,
 * in one browser, re-seeded before every walk, writing its artifact after each one. The worst case
 * over all twenty-two walks is named in the summary rather than left for a reader to find.
 *
 * ================================================================================================
 * THE COUNTER IS NOT THE ENGINE'S.
 * ================================================================================================
 *
 * Round 1's headline defect was that `path_m` counted a 3,484.9 m respawn as walked distance, and
 * its biggest published gap (§A3) was that the fix landed in `walkRoute` and **not** in `walkPath`
 * — the verb every reachability instrument in this project drives. That is closed in
 * `game/src/engine.js` by this round, but an instrument cannot certify itself, so this tool also
 * installs its own accumulator on `Engine._afterStep` and keeps BOTH accountings:
 *
 *   `naive_sum_m`  every per-frame planar step, no upper bound — the old, broken number.
 *   `walked_m`     the same sum with steps over 1 m held out, re-derived here, not read off the engine.
 *
 * When the two agree, the zero is zero because nothing jumped. When they diverge, the walk contains
 * a teleport and `arrived` is not an arrival. The engine's own `path_m` / `teleports` are reported
 * beside them, and three numbers from two counters is the evidence; one number is not.
 *
 * ================================================================================================
 * HP. Declared, not hidden.
 * ================================================================================================
 *
 * `--survive` pins HP — and pins it in BOTH places, `sim.player.hp` and `combat.player.hp`. Round
 * 1 §C4 found the delete-the-fix grid pinning only the first, which does not hold, so both its
 * `NEW` arms carried a death and a ~3.4 km respawn while reading as clean. Every artifact this
 * tool writes carries `hp_pinned`, and `--survive` off is a legitimate run whose finding is *where
 * the body dies*.
 *
 * Modes: `--only <ids>` to select walks, `--resume` to skip walks already in the artifact,
 * `--speed jog`, `--time/--weather/--burden`, and `--no-self-clear-roads <file>` to walk a
 * DIFFERENT roads network in the same browser — which is the delete-the-fix arm for the
 * self-clearance pass in `tools/world/build-roads.mjs`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `w1-crossing-r2-legs.mjs — every leg both ways, one browser.
  --only <a,b,..>    walk ids only (e.g. crossing:fwd,soulrest-blackrose:rev)
  --resume           keep walks already in --out and only run what is missing
  --survive          pin HP in BOTH sim.player and combat.player (declared in the artifact)
  --speed <s>        walk | jog                       (default walk)
  --time <h>         setTimeOfDay hours before each walk
  --weather <w>      setWeather before each walk
  --burden <n>       setBurden before each walk
  --roads <file>     install a DIFFERENT roads.json into the live field before walking
  --max-frames <n>   ceiling per walk                 (default 400000)
  --legs-only        skip the two crossing walks
  --crossing-only    only the two crossing walks
  --out <file>       artifact path`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const SPEED = String(args.speed || 'walk');
const SURVIVE = !!args.survive;
const MAXF = Number(args['max-frames'] || 400000);
const RESUME = !!args.resume;
const ONLY = args.only ? String(args.only).split(',').map((s) => s.trim()).filter(Boolean) : null;
const ROADS_FILE = args.roads ? path.resolve(String(args.roads)) : null;
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports/w1-crossing-r2/legs-both-ways.json')));
ensureDir(path.dirname(OUT));

const prev = RESUME && fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
const doc = {
  schema: 'elder-souls/w1-crossing-r2-legs@1',
  measured_at: new Date().toISOString(), git: gitInfo(),
  speed: SPEED, hp_pinned: SURVIVE, max_frames: MAXF,
  roads_override: ROADS_FILE ? path.relative(REPO_ROOT, ROADS_FILE) : null,
  time_of_day: args.time ?? null, weather: args.weather ?? null, burden: args.burden ?? null,
  state: 'starting', walks: (prev && prev.walks) || {}, summary: null,
};
const flush = () => fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
flush();

const t0 = Date.now();
const handle = await launchGame({ ...args, width: 640, height: 360 });

/** The counter. Reset per walk; independent of anything walkPath returns. */
async function armCounter(pin) {
  return handle.page.evaluate((pinHp) => {
    const E = window.__ENGINE;
    if (!E.__r2Armed) {
      const orig = E._afterStep.bind(E);
      E.__r2 = null;
      E._afterStep = function () {
        orig();
        const C = E.__r2;
        if (!C) return;
        const p = this.sim.player;
        const now = [p.pos[0], p.pos[2]];
        if (C.last) {
          const step = Math.hypot(now[0] - C.last[0], now[1] - C.last[1]);
          C.frames++; C.naive += step;
          if (step > C.maxStep) C.maxStep = step;
          if (step > 1) {
            C.jumpCount++; C.jumpM += step;
            if (C.jumps.length < 40) C.jumps.push({ frame: C.frames, jump_m: +step.toFixed(2),
              from: [+C.last[0].toFixed(1), +C.last[1].toFixed(1)], to: [+now[0].toFixed(1), +now[1].toFixed(1)],
              walked_before: +C.walked.toFixed(1), hp: p.hp });
          } else C.walked += step;
        } else C.start = now.slice();
        C.last = now;
        if (p.hp < C.minHp) C.minHp = p.hp;
        if (p.hp <= 0) C.hpZero++;
        // BOTH pins. `sim.player.hp` alone does not hold — W1-CROSSING r1 §C4.
        if (C.pin && p.hp < p.hpMax) {
          C.absorbed += p.hpMax - p.hp; p.hp = p.hpMax;
          const c = this.combat && this.combat.player;
          if (c && c.hp !== undefined && c.hp < p.hpMax) c.hp = p.hpMax;
        }
      };
      E.__r2Armed = true;
    }
    E.__r2 = { frames: 0, naive: 0, walked: 0, jumps: [], jumpCount: 0, jumpM: 0, maxStep: 0,
      hpZero: 0, absorbed: 0, minHp: Infinity, start: null, last: null, pin: pinHp };
    return { armed: true, pin: pinHp, hp_max: E.sim.player.hpMax };
  }, pin);
}
const readCounter = () => handle.page.evaluate(() => {
  const C = window.__ENGINE.__r2;
  return { frames: C.frames, naive_sum_m: +C.naive.toFixed(1), walked_m: +C.walked.toFixed(1),
    teleports: C.jumpCount, teleported_m: +C.jumpM.toFixed(1), max_step_m: +C.maxStep.toFixed(3),
    jumps: C.jumps, hp_zero_frames: C.hpZero, hp_absorbed: +C.absorbed.toFixed(1),
    min_hp: C.minHp === Infinity ? null : C.minHp,
    start: C.start && C.start.map((v) => +v.toFixed(1)), end: C.last && C.last.map((v) => +v.toFixed(1)),
    net_m: C.start && C.last ? +Math.hypot(C.last[0] - C.start[0], C.last[1] - C.start[1]).toFixed(1) : null };
});

try {
  if (ROADS_FILE) {
    const roads = JSON.parse(fs.readFileSync(ROADS_FILE, 'utf8'));
    doc.roads_install = await handle.page.evaluate((r) => {
      const E = window.__ENGINE;
      E.data.roads = r; E.field.setRoads(r);
      return { legs: r.legs.length, spans: r.legs.reduce((n, l) => n + (l.deck_spans || []).length, 0),
        crossing_m: r.named_routes.crossing.metres,
        self_clear_spliced: r.legs.reduce((n, l) => n + ((l.self_clearance && l.self_clearance.spliced) || []).length, 0) };
    }, roads);
    log(`roads override installed: ${JSON.stringify(doc.roads_install)}`);
  }
  const roads = await handle.page.evaluate(() => window.__ENGINE.data.roads);

  /** Build the plan: every leg both ways, then the crossing both ways. */
  const plan = [];
  if (!args['crossing-only']) {
    for (const leg of roads.legs) {
      const pts = leg.points.map((p) => [p[0], p[1]]);
      plan.push({ id: `${leg.id}:fwd`, kind: 'leg', leg: leg.id, dir: 'fwd', declared_m: leg.built_path_m, points: pts });
      plan.push({ id: `${leg.id}:rev`, kind: 'leg', leg: leg.id, dir: 'rev', declared_m: leg.built_path_m, points: pts.slice().reverse() });
    }
  }
  if (!args['legs-only']) {
    for (const route of ['crossing']) {
      const named = roads.named_routes[route];
      const pts = [];
      for (let i = 0; i + 1 < named.settlements.length; i++) {
        const a = named.settlements[i], b = named.settlements[i + 1];
        const leg = roads.legs.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
        const p = leg.from === a ? leg.points : leg.points.slice().reverse();
        for (let k = (pts.length ? 1 : 0); k < p.length; k++) pts.push([p[k][0], p[k][1]]);
      }
      plan.push({ id: `${route}:fwd`, kind: 'route', leg: route, dir: 'fwd', declared_m: named.metres, points: pts });
      plan.push({ id: `${route}:rev`, kind: 'route', leg: route, dir: 'rev', declared_m: named.metres, points: pts.slice().reverse() });
    }
  }
  doc.state = 'walking'; flush();

  for (const w of plan) {
    if (ONLY && !ONLY.includes(w.id)) continue;
    if (RESUME && doc.walks[w.id] && doc.walks[w.id].engine) { log(`skip ${w.id} (resume)`); continue; }
    // RE-SEEDED BEFORE EVERY WALK. Round 1 §C3 found four grid arms whose 6 m spread was
    // accumulated world state and not a measurement; re-seeding is what made those arms
    // bit-identical when the critic re-ran them.
    await handle.h('setSeed', 1337);
    await handle.h('loadState', 'default');
    await handle.h('setTide', 'LOW');
    if (args.time !== undefined) await handle.h('setTimeOfDay', Number(args.time));
    if (args.weather) await handle.h('setWeather', String(args.weather));
    if (args.burden !== undefined) await handle.h('setBurden', Number(args.burden));
    if (ROADS_FILE) {
      const roadsAgain = JSON.parse(fs.readFileSync(ROADS_FILE, 'utf8'));
      await handle.page.evaluate((r) => { window.__ENGINE.data.roads = r; window.__ENGINE.field.setRoads(r); }, roadsAgain);
    }
    const armed = await armCounter(SURVIVE);
    const wt = Date.now();
    const r = await handle.h('walkPath', w.points, { speed: SPEED, maxFrames: MAXF });
    const c = await readCounter();
    doc.walks[w.id] = {
      kind: w.kind, leg: w.leg, dir: w.dir, declared_m: w.declared_m, points: w.points.length,
      hp_pinned: SURVIVE, hp_max: armed.hp_max, engine: r, counter: c,
      wall_clock_s: +((Date.now() - wt) / 1000).toFixed(1),
      // The two counters agreeing is the claim that the distance contains no teleport.
      counters_agree: Math.abs((r.path_m || 0) - (c.walked_m || 0)) <= 0.2,
    };
    flush();
    log(`${w.id.padEnd(28)} ${r.arrived ? 'ARRIVED' : (r.aborted || 'short').toUpperCase().padEnd(7)} `
      + `${String(r.path_m).padStart(8)} m  ${String(r.minutes).padStart(7)} min  off ${r.worst_off_path_m} m/${r.off_path_frames} f  `
      + `stuck ${r.longest_stuck_frames}  water ${r.deepest_water_on_the_walk.depth_m} m  tp ${r.teleports}/${c.teleports}  `
      + `critic ${c.walked_m} (naive ${c.naive_sum_m})`);
  }
  // ---- the picture -----------------------------------------------------------------------------
  // MY OWN BROWSER, and I am saying so (rule 20). The shared capture daemon renders the SHIPPED
  // build, and the thing worth a picture here is the world BEFORE the fix — the switchback where
  // the road crossed over itself — which only exists when a different roads network is installed
  // into a live field. That is stepping the simulation, so it is not a `tools/capture/` job.
  if (args.shot) {
    const at = String(args['shot-at'] || '2280.6,1862.2').split(',').map(Number);
    const yaw = Number(args['shot-yaw'] ?? 25), pitch = Number(args['shot-pitch'] ?? 14);
    const eye = Number(args['shot-eye'] ?? 22);
    await handle.h('setTimeOfDay', Number(args['shot-time'] ?? 10));
    await handle.h('teleport', at[0], at[1]);
    await handle.h('stepFrames', 60);
    const gy = (await handle.h('getTerrainAt', at[0], at[1])).y || 0;
    const R = 40, ey = gy + eye, ry = yaw * Math.PI / 180, rp = pitch * Math.PI / 180;
    await handle.h('camera', { pos: [at[0] - Math.sin(ry) * 34, ey, at[1] - Math.cos(ry) * 34],
      look: [at[0] + Math.sin(ry) * R, ey - Math.tan(rp) * R, at[1] + Math.cos(ry) * R], fov: 55 });
    await handle.h('setRenderRate', 60).catch(() => {});
    await handle.h('stepFrames', 120);
    const shot = path.resolve(String(args.shot));
    ensureDir(path.dirname(shot));
    await handle.page.screenshot({ path: shot });
    doc.shot = { path: path.relative(REPO_ROOT, shot), at, yaw_deg: yaw, pitch_deg: pitch, eye_m: eye,
      roads: doc.roads_override, browser: 'own (stepping the simulation with a substituted roads network)' };
    log(`shot -> ${shot}`);
  }
  doc.state = 'done';
} catch (e) {
  doc.state = 'threw'; doc.error = String((e && e.stack) || e); flush(); throw e;
} finally {
  // ---- the summary, with the WORST CASE NAMED --------------------------------------------------
  const ws = Object.entries(doc.walks);
  const num = (f) => ws.map(([id, w]) => ({ id, v: f(w) })).filter((r) => Number.isFinite(r.v)).sort((a, b) => b.v - a.v)[0] || null;
  doc.summary = ws.length ? {
    walks: ws.length,
    arrived: ws.filter(([, w]) => w.engine && w.engine.arrived).length,
    did_not_arrive: ws.filter(([, w]) => w.engine && !w.engine.arrived).map(([id, w]) => ({ id, aborted: w.engine.aborted, path_m: w.engine.path_m, end: w.engine.end, offset_m: w.engine.offset_m })),
    worst_off_path: num((w) => w.engine && w.engine.worst_off_path_m),
    worst_off_path_frames: num((w) => w.engine && w.engine.off_path_frames),
    worst_stuck_frames: num((w) => w.engine && w.engine.longest_stuck_frames),
    deepest_water: num((w) => w.engine && w.engine.deepest_water_on_the_walk.depth_m),
    most_teleports: num((w) => w.engine && w.engine.teleports),
    counters_disagree: ws.filter(([, w]) => w.counters_agree === false).map(([id]) => id),
  } : null;
  doc.wall_clock_s = +((Date.now() - t0) / 1000).toFixed(1);
  flush();
  await handle.close();
}

const s = doc.summary || {};
console.log(`\n${s.arrived}/${s.walks} walks arrived.`);
if (s.did_not_arrive && s.did_not_arrive.length) for (const d of s.did_not_arrive) console.log(`  DID NOT ARRIVE  ${d.id}  ${d.path_m} m, ${d.aborted || 'ran out of frames'}, ${d.offset_m} m short at ${JSON.stringify(d.end)}`);
console.log(`  worst off the road     ${s.worst_off_path && s.worst_off_path.v} m   (${s.worst_off_path && s.worst_off_path.id})`);
console.log(`  worst off-road frames  ${s.worst_off_path_frames && s.worst_off_path_frames.v}   (${s.worst_off_path_frames && s.worst_off_path_frames.id})`);
console.log(`  worst stuck run        ${s.worst_stuck_frames && s.worst_stuck_frames.v} frames   (${s.worst_stuck_frames && s.worst_stuck_frames.id})`);
console.log(`  deepest water          ${s.deepest_water && s.deepest_water.v} m   (${s.deepest_water && s.deepest_water.id})`);
console.log(`  most teleports         ${s.most_teleports && s.most_teleports.v}   (${s.most_teleports && s.most_teleports.id})`);
console.log(`  counters disagree on   ${JSON.stringify(s.counters_disagree)}`);
console.log(`  ${OUT}`);
process.exit(s.did_not_arrive && s.did_not_arrive.length === 0 ? 0 : 1);
