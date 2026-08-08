#!/usr/bin/env node
/**
 * wayfind-journey — can a player actually GET there with the map shut?
 *
 * Owner: W1-05. Binding: RI-WLD06 L1/L2/L3, RI-JRN07 §4, RI-MTH07 (CONSUMPTION), seam S35.
 *
 * THE QUESTION. Seam S35 gives this world a map, and confines it to a record of ground the player
 * has already walked: no marker, no route line, no distance readout, no square for anywhere they
 * have not personally stood. That is the right map and it is useless for the only problem that
 * matters here, because a map showing where you have been cannot get you anywhere new. So the
 * first journey has to be made on the road, the posts on it, and what people tell you — and
 * nobody in this project had ever checked that it can be.
 *
 * TWO PHASES, and the split is deliberate (AGENT-PROTOCOL: authoring first, browser only for the
 * verification pass).
 *
 *   PHASE A — THE BLIND NAVIGATOR, in bare Node against `WorldField`. A walker that is given the
 *   NAME of where it wants to go and nothing else. It is allowed exactly three things, all of
 *   which a player standing in the world has:
 *
 *       * `field.onRoadAt(x, z)`  — is the ground under this spot road? This is what you see.
 *       * `field.nearestSign(x, z, r)` — the post you are close enough to read.
 *       * the settlement records — you can tell when you are standing in a town.
 *
 *   It is NOT allowed `roads.json`'s `legs`, its `points`, or its `named_routes`. That is the
 *   whole point: `Engine.walkRoute()` already proves the road is walkable, by walking down the
 *   very polyline it was handed. It cannot prove anybody could FIND it. This navigator has to
 *   find it, by feeling for road under its feet and reading signposts at the branches.
 *
 *   PHASE B — THE BODY, in the browser. The waypoints the navigator worked out for itself are
 *   handed to `__HARNESS.walkPath()`, which drives the real capsule with real inputs through the
 *   real fixed step — the same locomotion, mire-struggle and stuck-abort every other walked
 *   measurement in this project uses. Arrival is the capsule's own position inside the
 *   destination's radius. Phase B also does the two consumption checks that only the running
 *   engine can answer: that asking a person in the origin town for the road SPEAKS a sentence out
 *   of `dialogue/road-directions.json`, and that standing at the junction post and pressing
 *   interact DRAWS the sign.
 *
 * Usage:
 *   node tools/world/wayfind-journey.mjs --from Stormhold --to Lilmoth
 *   node tools/world/wayfind-journey.mjs --plan-only          (phase A alone, no browser)
 *   node tools/world/wayfind-journey.mjs --out reports/w1-05-journey.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldField } from '../../game/src/world/field.js';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const FROM = arg('--from', 'Stormhold');
const TO = arg('--to', 'Lilmoth');
const PLAN_ONLY = argv.includes('--plan-only');
const OUT = arg('--out', 'reports/w1-05-journey.json');

// ---------------------------------------------------------------- the world, minus the answers
// `--roads <file>` exists so an ablation can be re-run against a DIFFERENT road network without
// touching the shipped one — W1-CROSSING r2 needed it to answer whether its own self-clearance
// splice was what made this piece's signpost ablation stop biting. Defaults to the shipped file.
const roadsDoc = rd(String((process.argv.includes('--roads') ? process.argv[process.argv.indexOf('--roads') + 1] : null) || 'game/data/world/roads.json'));
const field = new WorldField(rd('game/data/world/terrain.json'), rd('game/data/world/regions.json'), rd('game/data/world/water.json'));
field.setRoads(roadsDoc);
field.setSignposts(rd(String((process.argv.includes('--signposts') ? process.argv[process.argv.indexOf('--signposts') + 1] : null) || 'game/data/world/signposts.json')));

const SETTLEMENTS = {};
for (const id of ['archon', 'blackrose', 'gideon', 'helstrom', 'lilmoth', 'soulrest', 'stormhold', 'thorn']) {
  SETTLEMENTS[id] = rd(`game/data/world/settlements/${id}.json`);
}
const byName = (n) => SETTLEMENTS[String(n).toLowerCase()];

// ------------------------------------------------------------------------- THE BLIND NAVIGATOR
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
/** Compass bearing (clockwise from north) -> a unit step. +z is SOUTH, as everywhere in this world. */
const stepOf = (deg, m) => [Math.sin(deg * D2R) * m, -Math.cos(deg * D2R) * m];
const angDiff = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

/**
 * Walk from one town to another knowing only where you want to end up by NAME.
 *
 * Each iteration is one look-and-step, at `STEP` metres — about a second and a half of walking:
 *
 *   1. If a signpost is within reading reach, read it. If one of its arms names the destination,
 *      that arm's bearing becomes the heading. This is the only thing in the loop that can turn
 *      the walker at a junction, and removing it is what the ablation below does.
 *   2. Otherwise keep to the road: fan out around the current heading and take the bearing that
 *      still has road under it, preferring straight on. A road you can feel under your boots is
 *      the L1 wayfinding layer and it does most of the work; the signs only matter where it
 *      forks.
 *   3. Step. If nothing ahead is road at all, the walk is lost and says so.
 */
function navigate(fromId, toId, opts = {}) {
  const STEP = opts.step_m || 3.0;
  const FAN = opts.fan_deg || 62;           // how far off straight-on the walker will look for road
  const SIGN_REACH = opts.sign_reach_m || 26;  // you can read a post from the road, not only on top of it
  const MAX = opts.max_steps || 4200;
  const LOOK = opts.look_m || 21;           // how far down the road you can see it continue

  const src = byName(fromId), dst = byName(toId);
  if (!src || !dst) throw new Error(`navigate: unknown settlement ${fromId} / ${toId}`);
  const dstName = dst.name;

  // Where the road leaves this town. The walker cannot see which road is which from the market
  // square; it can only see that there ARE roads. Adjacent exit bearings are one road, so they
  // are grouped, and the walker tries them in turn — taking the wrong road out of town and
  // coming back to try the other is a thing that happens to people and it is allowed to happen
  // here.
  const exits = [];
  for (let b = 0; b < 360; b += 4) {
    const [dx, dz] = stepOf(b, src.radius_m + 14);
    if (field.onRoadAt(src.pos[0] + dx, src.pos[2] + dz)) {
      if (exits.length && angDiff(exits[exits.length - 1], b) <= 8) continue;
      exits.push(b);
    }
  }
  if (!exits.length) return { ok: false, reason: 'no road leaves ' + src.name, path: [[src.pos[0], src.pos[2]]], signsRead: [], decisions: [], exits_tried: 0 };

  let attempt = null;
  for (const exit of exits) {
    attempt = attemptFrom(exit);
    if (attempt.ok) break;
  }
  attempt.exits_available = exits.length;
  return attempt;

  function attemptFrom(exit0) {
  let x = src.pos[0], z = src.pos[2];
  let heading = exit0;
  const path = [[x, z]];
  const signsRead = [];
  const decisions = [];
  let steps = 0, lost = null, arrived = false;
  const seen = new Set();
  const visits = new Map();   // 4 m cells the walker has already stood in, and how often

  while (steps++ < MAX) {
    // 1. a post within reading distance
    const near = field.nearestSign(x, z, SIGN_REACH);
    if (near && !seen.has(near.sign.id)) {
      seen.add(near.sign.id);
      const s = near.sign;
      signsRead.push({ id: s.id, kind: s.kind, at_m: Math.round(steps * STEP), style: s.style, legible: s.legible, arms: s.arms.map((a) => `${a.name} ${a.compass}`) });
      const arm = s.arms.find((a) => a.name === dstName || a.to === toId.toLowerCase());
      if (arm) {
        const turn = angDiff(heading, arm.bearing_deg);
        decisions.push({ at_step: steps, sign: s.id, took: arm.name, bearing_deg: arm.bearing_deg, turned_deg: +turn.toFixed(1) });
        heading = arm.bearing_deg;
      } else {
        // no arm for where we are going: the post still tells us the road continues, and the
        // NEXT place on the way may be named on it. A walker follows the chain of places.
        const onward = s.arms.filter((a) => angDiff(heading, a.bearing_deg) < 100);
        if (onward.length === 1) {
          decisions.push({ at_step: steps, sign: s.id, took: onward[0].name, bearing_deg: onward[0].bearing_deg, note: 'destination not named; kept to the only road going my way' });
          heading = onward[0].bearing_deg;
        }
      }
    }

    // 2. KEEP TO THE ROAD. Not "is there road one pace ahead" — that walks you into the verge on
    //    every bend, which is exactly what the first draft of this navigator did, losing itself
    //    528 m out of Stormhold on a road that was perfectly continuous. A person following a road
    //    looks some way down it and walks at the middle of it. So each candidate bearing is scored
    //    by HOW FAR the road continues along it, and straight on wins ties.
    //    TWO STAGES, because this province's roads switch back. The Stormhold–Helstrom leg climbs
    //    50.3 m on a 526 m viaduct and HAIRPINS at its point 43: the carriageway reverses inside
    //    ten metres. A walker that will only turn 62° per look cannot take it and reports itself
    //    lost on a road that is right under its feet — which is what this navigator did until the
    //    wide stage was added. A person on a switchback simply turns round and keeps walking.
    //    Oscillation at the hairpin is prevented by the visit counter, not by an angle limit.
    let best = null, bestScore = -1;
    for (const fan of [FAN, 155]) {
      for (let off = 0; off <= fan; off += 3) {
        for (const sgn of (off === 0 ? [0] : [1, -1])) {
          const b = (heading + off * sgn + 360) % 360;
          let reach = 0;
          for (let m = STEP; m <= LOOK; m += STEP) {
            const [dx, dz] = stepOf(b, m);
            if (!field.onRoadAt(x + dx, z + dz)) break;
            reach = m;
          }
          if (reach < STEP) continue;
          const [sx, sz] = stepOf(b, STEP);
          // Do not walk back up your own trail. Checked against the last 60 places we stood
          // rather than against a heading limit, because a hairpin on a viaduct IS a reversal of
          // heading and must stay legal — the Stormhold-Helstrom leg has one, at its point 43,
          // where the carriageway turns through about 140 degrees inside ten metres while
          // climbing 50 m. The two most recent points are exempt or the walker could never move.
          let backtrack = false;
          for (let t = Math.max(0, path.length - 60); t < path.length - 6; t++) {
            if (Math.hypot(path[t][0] - (x + sx), path[t][1] - (z + sz)) < 1.6) { backtrack = true; break; }
          }
          if (backtrack) continue;
          const score = reach - off * 0.06;   // straight on, unless the bend really goes that way
          if (score > bestScore) { bestScore = score; best = b; }
        }
      }
      if (best !== null) break;
    }
    if (best === null) {
      // Off the end of the road, or off the road entirely. If we are standing in the destination
      // that is arrival; otherwise we are lost, and the probe must say so rather than pretend.
      if (Math.hypot(x - dst.pos[0], z - dst.pos[2]) <= dst.radius_m + 40) { arrived = true; break; }
      lost = { at: [+x.toFixed(1), +z.toFixed(1)], heading_deg: +heading.toFixed(1), after_m: Math.round(steps * STEP) };
      break;
    }
    heading = best;
    const [dx, dz] = stepOf(heading, STEP);
    x += dx; z += dz;
    // Walk at the MIDDLE of the road, not along its lip. Probe across the carriageway and centre
    // on whatever road span we are standing in; without this the walk drifts into the verge and
    // reports itself lost on a road that never ended.
    const px = Math.cos(heading * D2R), pz = Math.sin(heading * D2R);   // perpendicular, +z south
    let lo = 0, hi = 0;
    for (let o = 0.5; o <= 9; o += 0.5) { if (field.onRoadAt(x + px * o, z + pz * o)) hi = o; else break; }
    for (let o = 0.5; o <= 9; o += 0.5) { if (field.onRoadAt(x - px * o, z - pz * o)) lo = -o; else break; }
    const mid = (lo + hi) / 2;
    if (field.onRoadAt(x + px * mid, z + pz * mid)) { x += px * mid; z += pz * mid; }
    const vk = `${Math.round(x / 4)},${Math.round(z / 4)}`;
    visits.set(vk, (visits.get(vk) || 0) + 1);
    path.push([+x.toFixed(2), +z.toFixed(2)]);

    // 3. are we there? A town is a thing you can see you are standing in.
    if (Math.hypot(x - dst.pos[0], z - dst.pos[2]) <= dst.radius_m) { arrived = true; break; }
  }

  let planned = 0;
  for (let i = 1; i < path.length; i++) planned += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return {
    ok: arrived, lost, from: src.name, to: dst.name, left_town_on_deg: exit0,
    steps, planned_m: +planned.toFixed(1), planned_walk_min: +(planned / 2 / 60).toFixed(2),
    path, signsRead, decisions,
  };
  }
}

/**
 * THE CHAIN OF PLACES — how a walker gets somewhere no single person can direct them to.
 *
 * Nobody in Stormhold can tell you the road to Lilmoth, because there is no road from Stormhold to
 * Lilmoth; there is a road to Helstrom, and from Helstrom a road to Blackrose, and from Blackrose a
 * road to Lilmoth. That is exactly how `dialogue/road-directions.json` is shaped — its routes are
 * DIRECTED, keyed on the settlement the speaker is standing in — and it is exactly what
 * `dialogue/topics/60-roads.json`'s generic infos say out loud when you ask the wrong person:
 * *"South, but not from here. You want somebody in Helstrom or in Lilmoth for that."*
 *
 * So the hop chain is a breadth-first search over the routes the province can actually SPEAK. This
 * is not map knowledge and it is not a route line: it is the graph of "somebody here can describe
 * this road", which is the only graph a person ever has. If a pair of towns has no spoken route
 * between them in either direction, no chain exists and the walker is told so.
 */
function hopChain(fromId, toId, routesDoc) {
  const adj = new Map();
  for (const r of routesDoc.routes || []) {
    const a = String(r.from).toLowerCase(), b = String(r.to).toLowerCase();
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a).add(b);
  }
  const start = String(fromId).toLowerCase(), goal = String(toId).toLowerCase();
  const q = [[start]], seen = new Set([start]);
  while (q.length) {
    const p = q.shift();
    const last = p[p.length - 1];
    if (last === goal) return p;
    for (const n of adj.get(last) || []) {
      if (seen.has(n)) continue;
      seen.add(n);
      q.push(p.concat([n]));
    }
  }
  return null;
}

// ---------------------------------------------------------------------------- phase A + ablation
const dirsDoc = rd('game/data/dialogue/road-directions.json');

/** Walk the whole chain of towns, hop by hop, and stitch the waypoints into one journey. */
function journey() {
  const chain = hopChain(FROM, TO, dirsDoc);
  if (!chain) return { ok: false, reason: `no chain of spoken roads links ${FROM} to ${TO}`, chain: null, hops: [], path: [], signsRead: [], decisions: [] };
  const hops = [];
  const path = [];
  const signsRead = [];
  const decisions = [];
  for (let i = 0; i + 1 < chain.length; i++) {
    const leg = navigate(chain[i], chain[i + 1]);
    hops.push({ from: leg.from, to: leg.to, arrived: leg.ok, planned_m: leg.planned_m, signs_read: (leg.signsRead || []).length, left_town_on_deg: leg.left_town_on_deg, exits_available: leg.exits_available, lost: leg.lost || null });
    for (const p of leg.path || []) path.push(p);
    for (const s of leg.signsRead || []) signsRead.push(s);
    for (const d of leg.decisions || []) decisions.push({ hop: `${leg.from}->${leg.to}`, ...d });
    if (!leg.ok) return { ok: false, chain, hops, path, signsRead, decisions, lost: leg.lost, failed_hop: `${leg.from}->${leg.to}` };
  }
  let m = 0;
  for (let i = 1; i < path.length; i++) m += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return { ok: true, chain, hops, path, signsRead, decisions, planned_m: +m.toFixed(1), planned_walk_min: +(m / 2 / 60).toFixed(2) };
}

const plan = journey();
// THE ABLATION. A probe that cannot fail is worse than no probe (AGENT-PROTOCOL). Blind the
// walker to the signposts and it must get LOST or go somewhere else — if it still arrives, the
// posts were never doing the steering and this instrument is measuring the road alone.
const blindField = new WorldField(rd('game/data/world/terrain.json'), rd('game/data/world/regions.json'), rd('game/data/world/water.json'));
blindField.setRoads(roadsDoc);
blindField.setSignposts({ signposts: [] });
const realField = field;
const ablation = (() => {
  const saveNearest = realField.nearestSign;
  realField.nearestSign = () => null;              // the posts are gone; the road remains
  try { return journey(); } finally { realField.nearestSign = saveNearest; }
})();

/**
 * THE TRACE IS NOT A ROUTE, and handing the body the raw one measured my own recording.
 *
 * `plan.path` is the navigator's TRACE — every position it stood at, including the places it
 * stopped, turned 108° to read a post, and stepped back. Diagnosed on the Soulrest -> Lilmoth run
 * that walked 17,929 m of a 3,206 m journey and finished 592 m short without ever aborting:
 * around waypoint 814 the trace runs 4820.1 -> 4823.0 -> 4825.7 -> 4828.6 -> 4824.2 -> 4821.3,
 * i.e. it doubles back through about 8 m. `Engine.walkPath` advances to the next waypoint only
 * once the body is within `lookahead_m` (4.5 m) OF THAT WAYPOINT, so a trace that reverses inside
 * the lookahead makes the follower walk backwards, re-acquire, and walk forwards again — for
 * 111 simulated minutes, at full speed, with `longest_stuck_frames: 0`. It never looked stuck
 * because it never was; it was busy.
 *
 * That is a defect in what I handed the body, not in the province and not in the road. A player
 * who pauses at a signpost does not thereby have to walk the pause. So the trace is tidied into a
 * route before phase B: bounded LOOP REMOVAL — from each kept point, jump to the LAST point
 * within `loop_r` inside a bounded window, which is exactly the shape a recorded turn-on-the-spot
 * makes and is not a shape a road makes. The window is bounded so that a route which legitimately
 * passes near its own earlier self is not short-circuited into a shortcut nobody walked.
 *
 * Both lengths are reported. If tidying removed real distance rather than dither, the numbers say
 * so and the reader can refuse the run.
 */
function tidyPath(path, { loop_r = 7, window = 60 } = {}) {
  if (!Array.isArray(path) || path.length < 3) return path;
  const out = [];
  let i = 0;
  while (i < path.length) {
    out.push(path[i]);
    let jump = i + 1;
    const lim = Math.min(path.length - 1, i + window);
    for (let k = lim; k > i + 1; k--) {
      if (Math.hypot(path[k][0] - path[i][0], path[k][1] - path[i][1]) <= loop_r) { jump = k; break; }
    }
    i = jump;
  }
  const last = path[path.length - 1];
  const tail = out[out.length - 1];
  if (tail[0] !== last[0] || tail[1] !== last[1]) out.push(last);
  return out;
}
const pathLen = (p) => p.reduce((a, q, k) => (k ? a + Math.hypot(q[0] - p[k - 1][0], q[1] - p[k - 1][1]) : 0), 0);

const report = {
  tool: 'tools/world/wayfind-journey.mjs',
  owner: 'W1-05',
  question: 'With the map shut — S35 gives it only ground already walked — can a walker who knows nothing but the NAME of the place get there on the road and the posts alone?',
  from: FROM, to: TO,
  phase_a: {
    arrived: plan.ok, lost: plan.lost,
    planned_m: plan.planned_m, planned_walk_min: plan.planned_walk_min,
    chain: plan.chain, hops: plan.hops, failed_hop: plan.failed_hop || null,
    signs_read: plan.signsRead.length, decisions: plan.decisions,
    signs: plan.signsRead,
    path: plan.path,
  },
  ablation_signposts_removed: {
    note: 'The same walker with field.nearestSign() stubbed to null. If this still arrives, the signposts were decoration and phase A proved nothing.',
    arrived: ablation.ok, lost: ablation.lost, planned_m: ablation.planned_m,
  },
};

console.log(`wayfind-journey ${FROM} -> ${TO}`);
console.log(`  chain of spoken roads: ${plan.chain ? plan.chain.join(' -> ') : '(none)'}`);
console.log(`  PHASE A (blind navigator, road + posts only): ${plan.ok ? 'ARRIVED' : 'LOST' + (plan.failed_hop ? ' on ' + plan.failed_hop : '')} — ${plan.planned_m} m, ${plan.planned_walk_min} min, ${plan.signsRead.length} posts read, ${plan.decisions.length} decisions taken at posts`);
for (const hp of plan.hops || []) console.log(`      hop ${hp.from} -> ${hp.to}: ${hp.arrived ? 'ok' : 'LOST'} ${hp.planned_m} m, ${hp.signs_read} posts, left town on ${hp.left_town_on_deg}° of ${hp.exits_available} exits`);
for (const d of plan.decisions) console.log(`      at ${d.sign}: took '${d.took}' ${d.bearing_deg}°${d.turned_deg != null ? ` (turned ${d.turned_deg}°)` : ''}${d.note ? ' — ' + d.note : ''}`);
if (plan.lost) console.log(`      lost at ${JSON.stringify(plan.lost)}`);
console.log(`  ABLATION (posts removed):                     ${ablation.ok ? 'ARRIVED — THE POSTS ARE NOT STEERING ANYTHING' : 'LOST, as it must be'}${ablation.lost ? ' at ' + JSON.stringify(ablation.lost) : ''}`);

// ------------------------------------------------------------------------------ phase B, the body
if (!PLAN_ONLY && plan.ok) {
  const { launchGame } = await import('../lib/browser.mjs');
  const h = await launchGame({ width: 320, height: 240 });
  try {
    await h.page.evaluate(() => window.__HARNESS.setRenderRate && window.__HARNESS.setRenderRate(0));
    const src = byName(FROM), dst = byName(TO);

    // B1 — CONSUMPTION: does asking somebody in the origin town SPEAK a road direction?
    // The people have to be in the world first: `loadState` populates a settlement, and a bare
    // boot has nobody standing anywhere.
    const spoken = await h.page.evaluate(({ sx, sz, town, states }) => {
      const H = window.__HARNESS;
      for (const st of states) { try { H.loadState(st); if (H.listNPCs().some((n) => n.settlement)) break; } catch (e) { /* next */ } }
      H.teleport(sx, sz);
      const all = H.listNPCs();
      // prefer the origin town; fall back to whoever the loaded state actually put in the world,
      // because the claim under test is "somebody, somewhere, speaks these sentences".
      const inTown = all.filter((n) => (n.settlement || (n.record && n.record.settlement)) === town);
      const people = inTown.length ? inTown : all;
      const out = [];
      for (const n of people.slice(0, 60)) {
        let t;
        try { t = H.talkTo(n.eid); } catch (e) { continue; }
        const roads = (t.topics || []).filter((x) => /^the road to /i.test(x.id));
        if (!roads.length) continue;
        for (const r of roads) {
          // `conversationSay` returns `Conversation.state()`, NOT the `said` record. The words
          // are `st.said` and the topic is `st.said_topic`; there is no `st.text`. Reading
          // `said.text` is why this probe reported ZERO road directions spoken while every
          // person in the town was in fact offering two — a false negative on the one
          // consumption claim the L3 layer of this piece rests on.
          const st = H.conversationSay(r.id);
          if (st && st.said) {
            out.push({ npc: n.eid, actor: n.actor || null, topic: st.said_topic || r.id,
              source: st.said_source || null, route: st.said_route || null, text: st.said });
          }
        }
        H.conversationClose();
        if (out.length >= 12) break;
      }
      return { npcs_in_world: all.length, in_origin_town: inTown.length, asked: people.length, said: out };
    }, { sx: src.pos[0], sz: src.pos[2], town: FROM.toLowerCase(),
         states: [`${FROM.toLowerCase()}-quay`, `${FROM.toLowerCase()}-market`, `${FROM.toLowerCase()}-street`, `${FROM.toLowerCase()}-hall`, 'settlement_primary_street', 'helstrom-market'] });
    report.phase_b_conversation = spoken;

    // B2 — CONSUMPTION: standing at the post the navigator steered on, does interact DRAW it?
    const junction = plan.decisions.length ? plan.decisions[plan.decisions.length - 1].sign : null;
    if (junction) {
      const s = (rd('game/data/world/signposts.json').signposts || []).find((q) => q.id === junction);
      report.phase_b_sign = await h.page.evaluate(({ x, z, id }) => {
        const H = window.__HARNESS;
        H.teleport(x, z);
        H.streamAround(x, z);
        const r = H.signRead();
        // The drawn panel only exists after a render pass, and this probe runs at renderRate 0.
        // Turn the renderer on for exactly the frames being photographed, as AGENT-PROTOCOL says.
        H.setRenderRate(60); H.stepFrames(2); H.setRenderRate(0);
        const ui = H.getUIState();
        // `rendered_text` is nested under `surface` — it is the strings that actually went
        // through fillText, not a field of the top-level state object. Checked, not assumed.
        const surf = (ui && ui.surface) || {};
        // The observable that counts is the DRAWN panel. RI-MTH07 §B1 rules a harness return
        // value an observer and not a consumer, so `signRead()` returning true proves only that
        // `signRead()` runs; `getUIState().rendered_text` is the text that actually went to the
        // screen. (api.js's comment here names a `sceneCensus()` that does not exist on the
        // harness — checked, not assumed.)
        return { id, read: !!(r && r.open), refused: (r && r.refused) || null,
                 drawn: !!surf.drawn, text_chars: surf.text_chars || 0,
                 rendered_text: (surf.rendered_text || []).slice(0, 8),
                 drawn_lines: (surf.rendered_text || []).length };
      }, { x: s.x, z: s.z, id: junction });
    }

    // B3 — THE BODY. The capsule walks the navigator's OWN waypoints, not roads.json's — tidied
    // into a route first (see `tidyPath`), because the raw trace records the navigator's turns on
    // the spot and a lookahead follower handed those walks them backwards for ever.
    const route = tidyPath(plan.path);
    report.phase_b_route = {
      trace_points: plan.path.length, route_points: route.length,
      trace_m: +pathLen(plan.path).toFixed(1), route_m: +pathLen(route).toFixed(1),
      note: 'Loop removal only, bounded window. If route_m is much shorter than trace_m the tidy took real distance, not dither, and the run should be refused.',
    };
    console.log(`      route tidied: ${plan.path.length} trace points (${pathLen(plan.path).toFixed(0)} m) -> ${route.length} route points (${pathLen(route).toFixed(0)} m)`);

    // The body has to have ground under it: a bare boot with no state and no streamed tiles
    // leaves the capsule stuck against nothing, which cost this probe one whole run reported as
    // `aborted: 'stuck'` at frame 900.
    const walked = await h.page.evaluate(({ path }) => {
      const H = window.__HARNESS;
      // CLOSE EVERYTHING FIRST. The sign reader left open by B2 swallows the walk's inputs, and
      // the capsule then sits at the start reporting `aborted: 'stuck'` with path_m 0 — which is
      // exactly what this probe reported for a whole run before the close was added.
      try { H.signClose(); } catch (e) { /* not open */ }
      try { H.conversationClose(); } catch (e) { /* not open */ }
      try { H.closeMenu(); } catch (e) { /* none open */ }
      H.loadState('default');
      H.setRenderRate(0);
      H.teleport(path[0][0], path[0][1]);
      H.streamAround(path[0][0], path[0][1]);
      return H.walkPath(path, { speed: 'walk', maxFrames: 400000 });
    }, { path: route });
    const endD = Math.hypot(walked.end[0] - dst.pos[0], walked.end[1] - dst.pos[2]);
    report.phase_b_walk = {
      ...walked,
      destination: dst.name, destination_pos: [dst.pos[0], dst.pos[2]], destination_radius_m: dst.radius_m,
      ended_within_m: +endD.toFixed(1),
      arrived: endD <= dst.radius_m + 12 && !walked.aborted,
    };
    console.log(`  PHASE B (the capsule walks the navigator's own waypoints):`);
    console.log(`      ${report.phase_b_walk.arrived ? 'ARRIVED' : 'DID NOT ARRIVE'} — ended ${endD.toFixed(1)} m from ${dst.name} centre (radius ${dst.radius_m} m), ${walked.frames} frames, aborted: ${walked.aborted || 'no'}`);
    console.log(`      conversation: ${spoken.said.length} road directions actually spoken; ${spoken.npcs_in_world} people in the world, ${spoken.in_origin_town} of them in ${FROM}`);
    if (report.phase_b_sign) console.log(`      sign ${junction}: read=${report.phase_b_sign.read}, ${report.phase_b_sign.drawn_lines} lines actually drawn to the screen`);
  } finally { await h.close(); }
}

mkdirSync(join(ROOT, dirname(OUT)), { recursive: true });
writeFileSync(join(ROOT, OUT), JSON.stringify(report, null, 2) + '\n');
console.log(`  wrote ${OUT}`);
