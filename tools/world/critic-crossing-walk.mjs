#!/usr/bin/env node
/**
 * critic-crossing-walk.mjs — THE W1-CROSSING ROUND-1 CRITIC WALKS IT ITSELF.
 *
 * Written with fresh context by the critic, declared under `method_deviations`. It is NOT a copy of
 * `tools/world/crossing-body.mjs`: that tool reports the numbers `walkRoute` hands it, and
 * `walkRoute`'s distance accumulator is the exact instrument this round found to have been wrong
 * (a 3,484.9 m respawn counted as walked). An instrument cannot certify itself.
 *
 * So this tool installs its OWN per-frame accumulator on `Engine._afterStep` — the one function
 * every way of advancing the world passes through — and measures, independently of anything
 * `walkRoute` returns:
 *
 *   - `naive_sum_m`   every per-frame planar step added up, with no upper bound. THIS IS THE OLD,
 *                     BROKEN NUMBER. If a respawn happens it is in here.
 *   - `walked_m`      the same sum with steps over 1 m held out. The critic's re-derivation of the
 *                     fix, computed without reading `w.dist`.
 *   - `jumps`         every step over 1 m, with its length, its endpoints and the HP either side.
 *   - `net_m`         start-to-end straight line, so a walk that went nowhere cannot hide.
 *
 * The two accountings are then compared against `walkRoute`'s own `path_m` / `teleported_m`. Three
 * numbers that agree from two independent counters is evidence; one number from one counter is not.
 *
 * `--kill-at-m` is the rule-4 half: it kills the body mid-walk on purpose, forcing the province's
 * respawn, and requires the distance NOT to absorb it. A teleport exclusion that has never been
 * seen to catch a teleport is not a fix, it is an untested branch.
 *
 * Modes (rule 8 — a still target hides every steering defect; the published crossing is the
 * easiest possible fixture, one fixed route walked forwards in daylight):
 *   --reverse            walk the crossing BACKWARDS, Lilmoth to Stormhold, via `walkPath`
 *   --leg <id>           walk one leg, either direction (`--reverse` flips it)
 *   --time <hhmm|night>  walk it at night
 *   --burden <n>         walk it encumbered
 *   --from <index>       start the route at a different node
 *
 * Writes its artifact after every chunk, because two long walks in this project were killed and
 * left nothing at all on disk.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-crossing-walk.mjs — the critic's own end-to-end walk.
  --route <id>      crossing | long_way          (default crossing)
  --leg <id>        walk a single built leg instead of a named route (uses walkPath)
  --reverse         walk it backwards (uses walkPath on the reversed polyline)
  --speed <s>       walk | jog                   (default walk)
  --survive         pin HP (declared in the artifact); off by default
  --kill-at-m <m>   kill the body the first chunk past this distance, to force a respawn
  --time <t>        setTimeOfDay before walking, e.g. 0200
  --weather <w>     setWeather before walking
  --burden <n>      setBurden before walking
  --chunk <n>       frames per chunk            (default 20000)
  --budget-min <n>  wall-clock budget           (default 30)
  --stall-frames <n> give up after this many frames of no progress (default 12000)
  --shot <png>      screenshot at the end
  --out <file>      artifact path`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const ROUTE = String(args.route || 'crossing');
const LEG = args.leg ? String(args.leg) : null;
const REVERSE = !!args.reverse;
const SPEED = String(args.speed || 'walk');
const SURVIVE = !!args.survive;
const KILL_AT = args['kill-at-m'] === undefined ? null : Number(args['kill-at-m']);
const CHUNK = Number(args.chunk || 20000);
const BUDGET_MS = Number(args['budget-min'] || 30) * 60_000;
const STALL = Number(args['stall-frames'] || 12000);
const SHOT = args.shot ? path.resolve(String(args.shot)) : null;
const LABEL = String(args.label || (LEG ? `leg-${LEG}` : ROUTE) + (REVERSE ? '-reverse' : ''));
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, `reports/critic-w1-crossing/walk-${LABEL}.json`)));
ensureDir(path.dirname(OUT));

const doc = {
  schema: 'elder-souls/critic-crossing-walk@1',
  measured_at: new Date().toISOString(), git: gitInfo(),
  label: LABEL, route: ROUTE, leg: LEG, reverse: REVERSE, speed: SPEED,
  hp_pinned: SURVIVE, kill_at_m: KILL_AT,
  time_of_day: args.time || null, weather: args.weather || null, burden: args.burden ?? null,
  state: 'starting', chunks: [], engine_result: null, critic_counter: null, shot: null,
};
const flush = () => fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
flush();

const t0 = Date.now();
const handle = await launchGame({ ...args, width: 960, height: 540 });

/** Install the critic's own per-frame accumulator. Independent of walkRoute's `w.dist`. */
async function armCounter(pinHp) {
  return handle.page.evaluate((pin) => {
    const E = window.__ENGINE;
    if (E.__criticArmed) return { armed: false, reason: 'already armed' };
    const orig = E._afterStep.bind(E);
    const C = {
      frames: 0, naive: 0, walked: 0, jumps: [], jumpCount: 0, jumpM: 0,
      maxStep: 0, hpZeroFrames: 0, hpAbsorbed: 0, deaths: 0, minHp: Infinity,
      start: null, last: null,
    };
    E.__critic = C; E.__criticArmed = true;
    E._afterStep = function () {
      orig();
      const p = this.sim.player;
      const now = [p.pos[0], p.pos[2]];
      if (C.last) {
        const step = Math.hypot(now[0] - C.last[0], now[1] - C.last[1]);
        C.frames++;
        C.naive += step;
        if (step > C.maxStep) C.maxStep = step;
        // A WALKING BODY CANNOT MOVE A METRE IN A SIXTIETH OF A SECOND. Re-derived here rather
        // than read off the engine, so the two counters are genuinely two counters.
        if (step > 1) {
          C.jumpCount++; C.jumpM += step;
          if (C.jumps.length < 60) C.jumps.push({ frame: C.frames, jump_m: +step.toFixed(2),
            from: [+C.last[0].toFixed(1), +C.last[1].toFixed(1)], to: [+now[0].toFixed(1), +now[1].toFixed(1)],
            walked_before: +C.walked.toFixed(1), hp: p.hp });
        } else C.walked += step;
      } else C.start = now.slice();
      C.last = now;
      if (p.hp < C.minHp) C.minHp = p.hp;
      if (p.hp <= 0) C.hpZeroFrames++;
      if (pin && p.hp < p.hpMax) {
        C.hpAbsorbed += p.hpMax - p.hp; p.hp = p.hpMax;
        const c = this.combat && this.combat.player;
        if (c && c.hp !== undefined && c.hp < p.hpMax) c.hp = p.hpMax;
      }
    };
    return { armed: true, hp_max: E.sim.player.hpMax };
  }, pinHp);
}
const readCounter = () => handle.page.evaluate(() => {
  const C = window.__ENGINE.__critic;
  return {
    frames: C.frames, naive_sum_m: +C.naive.toFixed(1), walked_m: +C.walked.toFixed(1),
    teleports: C.jumpCount, teleported_m: +C.jumpM.toFixed(1), max_step_m: +C.maxStep.toFixed(3),
    jumps: C.jumps, hp_zero_frames: C.hpZeroFrames, hp_absorbed: +C.hpAbsorbed.toFixed(1),
    min_hp: C.minHp === Infinity ? null : C.minHp,
    start: C.start && C.start.map((v) => +v.toFixed(1)), end: C.last && C.last.map((v) => +v.toFixed(1)),
    net_m: C.start && C.last ? +Math.hypot(C.last[0] - C.start[0], C.last[1] - C.start[1]).toFixed(1) : null,
  };
});

try {
  await handle.h('setSeed', 1337);
  await handle.h('loadState', 'default');
  await handle.h('setTide', 'LOW');
  if (args.time) await handle.h('setTimeOfDay', String(args.time));
  if (args.weather) await handle.h('setWeather', String(args.weather));
  if (args.burden !== undefined) await handle.h('setBurden', Number(args.burden));
  doc.env = {
    env: await handle.h('getEnvConditions').catch(() => null),
    burden: await handle.h('getBurden').catch(() => null),
  };

  const armed = await armCounter(SURVIVE);
  if (!armed.armed) throw new Error(`counter did not arm: ${armed.reason}`);
  doc.hp_max = armed.hp_max;

  // ---- build the walk -------------------------------------------------------------------------
  let points = null;                              // non-null => walkPath mode
  const roads = await handle.page.evaluate(() => window.__ENGINE.data.roads);
  if (LEG) {
    const leg = roads.legs.find((l) => l.id === LEG);
    if (!leg) throw new Error(`no built leg '${LEG}'`);
    points = leg.points.map((p) => [p[0], p[1]]);
    if (REVERSE) points.reverse();
    doc.declared_route = { id: leg.id, metres: leg.built_path_m, from: leg.from, to: leg.to };
  } else if (REVERSE) {
    const named = roads.named_routes[ROUTE];
    const pts = [];
    for (let i = 0; i + 1 < named.settlements.length; i++) {
      const a = named.settlements[i], b = named.settlements[i + 1];
      const leg = roads.legs.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
      const p = leg.from === a ? leg.points : leg.points.slice().reverse();
      for (let k = (pts.length ? 1 : 0); k < p.length; k++) pts.push([p[k][0], p[k][1]]);
    }
    pts.reverse();
    points = pts;
    doc.declared_route = { id: `${ROUTE}-reversed`, metres: named.metres };
  } else {
    doc.declared_route = (await handle.h('getRoutes')).named_routes[ROUTE];
  }
  doc.state = 'walking'; flush();

  let r, killed = false, stalled = 0, guard = 0;
  if (points) {
    // walkPath is not resumable, so it is walked in one call with a frame ceiling; the critic's
    // own counter is read after it returns and it writes then.
    const maxFrames = Math.min(400000, Math.round(BUDGET_MS / 1000 * 260));
    log(`walkPath: ${points.length} points, maxFrames ${maxFrames}`);
    r = await handle.h('walkPath', points, { speed: SPEED, maxFrames });
    doc.engine_result = r;
    doc.state = r.arrived ? 'arrived' : (r.aborted || 'did-not-arrive');
    doc.critic_counter = await readCounter(); flush();
  } else {
    r = await handle.h('walkRoute', { route: ROUTE, speed: SPEED, restart: true, chunkFrames: 1 });
    while (!r.done && guard++ < 400) {
      const before = { m: r.path_m, left: r.remaining_points };
      r = await handle.h('walkRoute', { route: ROUTE, speed: SPEED, chunkFrames: CHUNK });
      const cc = await readCounter();
      doc.chunks.push({ t_s: +((Date.now() - t0) / 1000).toFixed(1), frames: r.frames, path_m: r.path_m,
        minutes: r.minutes, remaining_points: r.remaining_points, worst_off_path_m: r.worst_off_path_m,
        off_path_frames: r.off_path_frames, regains: r.regains, teleports: r.teleports,
        critic_walked_m: cc.walked_m, critic_naive_m: cc.naive_sum_m, critic_teleports: cc.teleports });
      doc.engine_result = r; doc.critic_counter = cc; flush();
      log(`  ${r.minutes.toFixed(2)} min · engine ${r.path_m.toFixed(1)} m / critic ${cc.walked_m} m `
        + `(naive ${cc.naive_sum_m}) · ${r.remaining_points} pts left · off worst ${r.worst_off_path_m} m, `
        + `${r.off_path_frames} f · tp ${r.teleports}/${cc.teleports}`);
      // ---- rule 4: BREAK IT ON PURPOSE AND WATCH THE INSTRUMENT ----------------------------
      if (KILL_AT !== null && !killed && r.path_m >= KILL_AT) {
        const pre = { engine_path_m: r.path_m, critic_walked_m: cc.walked_m, pos: (await handle.h('getPlayerStats')).pos };
        await handle.h('killPlayer');
        // step far enough for the death surface and the respawn placement to happen
        await handle.h('walkRoute', { route: ROUTE, speed: SPEED, chunkFrames: 600 });
        const post = { pos: (await handle.h('getPlayerStats')).pos };
        const cc2 = await readCounter();
        const r2 = await handle.h('walkRoute', { route: ROUTE, speed: SPEED, chunkFrames: 1 });
        doc.kill_probe = {
          at_m: pre.engine_path_m, pre, post,
          respawn_jump_m: +Math.hypot(post.pos[0] - pre.pos[0], post.pos[2] - pre.pos[2]).toFixed(1),
          engine_path_m_after: r2.path_m, engine_teleports_after: r2.teleports,
          engine_teleported_m_after: r2.teleported_m, engine_teleport_log: r2.teleport_log,
          critic_walked_m_after: cc2.walked_m, critic_naive_m_after: cc2.naive_sum_m,
          critic_teleports_after: cc2.teleports, critic_teleported_m_after: cc2.teleported_m,
          critic_jumps: cc2.jumps,
        };
        killed = true; doc.state = 'killed-mid-walk'; flush();
        log(`  KILLED at ${pre.engine_path_m} m — respawn jump ${doc.kill_probe.respawn_jump_m} m; `
          + `engine path ${pre.engine_path_m} -> ${r2.path_m}, teleports ${r2.teleports}; `
          + `critic walked ${pre.critic_walked_m} -> ${cc2.walked_m}, naive ${cc2.naive_sum_m}`);
        break;
      }
      if (r.remaining_points >= before.left) {
        stalled += CHUNK;
        if (stalled >= STALL) {
          const p = await handle.h('getPlayerStats');
          doc.stalled = { at_m: r.path_m, after_frames: r.frames, pos: [+p.pos[0].toFixed(1), +p.pos[2].toFixed(1)],
            terrain: await handle.h('getTerrainAt', p.pos[0], p.pos[2]),
            water: await handle.h('getWaterAt', p.pos[0], p.pos[2]) };
          doc.state = 'stalled'; flush();
          log(`  STALLED at ${r.path_m} m ${JSON.stringify(doc.stalled.pos)}`);
          break;
        }
      } else stalled = 0;
      if (Date.now() - t0 > BUDGET_MS) { doc.state = 'out-of-budget'; flush(); break; }
    }
    if (r.done) doc.state = 'arrived';
    doc.engine_result = r;
    doc.critic_counter = await readCounter();
  }

  if (SHOT) {
    ensureDir(path.dirname(SHOT));
    await handle.page.screenshot({ path: SHOT });
    doc.shot = { path: path.relative(REPO_ROOT, SHOT) };
  }
  doc.player_end = await handle.h('getPlayerStats');
  doc.region_end = await handle.h('whereAmI').catch(() => null);
} catch (e) {
  doc.state = 'threw'; doc.error = String((e && e.stack) || e); flush(); throw e;
} finally {
  doc.wall_clock_s = +((Date.now() - t0) / 1000).toFixed(1);
  flush();
  await handle.close();
}

const r = doc.engine_result || {}, c = doc.critic_counter || {};
console.log(`\n${LABEL} — ${doc.state}`);
console.log(`  engine  path_m ${r.path_m}   frames ${r.frames}   minutes ${r.minutes}   teleports ${r.teleports ?? 'n/a'}`);
console.log(`  critic  walked ${c.walked_m} m   naive ${c.naive_sum_m} m   frames ${c.frames}   teleports ${c.teleports} (${c.teleported_m} m)   max step ${c.max_step_m} m`);
console.log(`  net displacement ${c.net_m} m   ${JSON.stringify(c.start)} -> ${JSON.stringify(c.end)}`);
console.log(`  off the road: worst ${r.worst_off_path_m} m, ${r.off_path_frames} frames, ${r.regains} regains`);
console.log(`  min hp ${c.min_hp}${doc.hp_pinned ? ` (PINNED, absorbed ${c.hp_absorbed})` : ''}`);
console.log(`  ${OUT}`);
process.exit(doc.state === 'arrived' ? 0 : 1);
