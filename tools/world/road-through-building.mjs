#!/usr/bin/env node
/**
 * road-through-building.mjs — does the province's road network run through a wall?
 *
 * WHY THIS EXISTS. W1-01 round 4, successor run. `crossing.mjs` walked THE CROSSING — the
 * headline "about an hour on foot" measurement, Stormhold south gate to Lilmoth harbour steps —
 * and the body stopped dead at **39 m** of a 6,816 m route and stayed there for two chunks of
 * 30,000 frames. The ground under it is flat (slope 0.0-0.5 deg), dry (depth 0.00 m) and in one
 * region the whole way. Nothing about the terrain explains it.
 *
 * What explains it is that the road leg `stormhold-helstrom` passes through the footprint of the
 * building `stormhold-scribe` between t=41 m and t=51 m. The roads were routed by
 * `build-roads.mjs` over the TERRAIN. The settlement exteriors were planted later, by
 * `render/exterior.js`'s `planSettlement()`, over the same ground, and `settlementSolids()` makes
 * their walls solid to the body. Neither generator has ever been shown the other's output, so the
 * province can — and does — put a scribe's house on the trunk road out of its capital.
 *
 * This is a JOIN that nothing in the build performs, and it is invisible to every audit either
 * side runs alone: `scale-audit` says the road is a good road, the settlement audit says the
 * house is a good house, and the body walks into the wall.
 *
 * The check is deliberately geometric and offline — no engine, no browser — so it can run in a
 * gate. It samples every named route at 1 m and asks `insideBuilding()`, which is the same
 * predicate `province.js` uses to audit where people are standing.
 *
 * IT CAN FAIL, and it does: `--self-test` moves a building onto a road and asserts the tool goes
 * red, then moves it off and asserts it goes green.
 *
 * Usage:
 *   node tools/world/road-through-building.mjs [--out reports/road-through-building.json]
 *   node tools/world/road-through-building.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { planSettlement, insideBuilding } from '../../game/src/render/exterior.js';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const outFile = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/road-through-building.json';
const SELF_TEST = argv.includes('--self-test');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const git = (() => {
  try {
    const q = (c) => execSync(c, { cwd: ROOT }).toString().trim();
    return { commit: q('git rev-parse HEAD'), branch: q('git rev-parse --abbrev-ref HEAD'), dirty: q('git status --porcelain').length > 0 };
  } catch { return null; }
})();

const roads = rd('game/data/world/roads.json');
const settlementIds = ['stormhold', 'thorn', 'gideon', 'helstrom', 'archon', 'blackrose', 'soulrest', 'lilmoth'];

function loadPlans(mutate) {
  const plans = [];
  for (const id of settlementIds) {
    const doc = rd(`game/data/world/settlements/${id}.json`);
    if (mutate) mutate(doc);
    plans.push(planSettlement(doc, {}));
  }
  return plans;
}

/** Resample a polyline at `step` metres and report the cumulative distance of each sample. */
function resample(points, step) {
  const out = [];
  let carry = 0;
  for (let k = 0; k + 1 < points.length; k++) {
    const [ax, az] = points[k], [bx, bz] = points[k + 1];
    const seg = Math.hypot(bx - ax, bz - az);
    if (seg <= 1e-9) continue;
    for (let d = carry; d < seg; d += step) {
      const u = d / seg;
      out.push({ x: ax + u * (bx - ax), z: az + u * (bz - az), m: (out.length ? out[out.length - 1].m : 0) + (out.length ? step : 0) });
    }
    carry = 0;
  }
  return out;
}

/** Every 1 m sample of every route that lands inside a building footprint, grouped into blocks. */
function audit(plans, step = 1) {
  const routes = [];
  for (const [name, named] of Object.entries(roads.named_routes)) {
    const pts = [];
    for (let i = 0; i + 1 < named.settlements.length; i++) {
      const a = named.settlements[i], b = named.settlements[i + 1];
      const leg = roads.legs.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
      if (!leg) continue;
      const p = leg.from === a ? leg.points : leg.points.slice().reverse();
      for (let k = (pts.length ? 1 : 0); k < p.length; k++) pts.push(p[k]);
    }
    const samples = resample(pts, step);
    const blocks = [];
    let cur = null;
    for (const s of samples) {
      let hit = null;
      for (const pl of plans) { const b = insideBuilding(pl, s.x, s.z, 0); if (b) { hit = { town: pl.id, building: b }; break; } }
      if (hit) {
        if (cur && cur.building === hit.building) { cur.to_m = s.m; cur.samples++; }
        else { cur = { town: hit.town, building: hit.building, from_m: s.m, to_m: s.m, samples: 1, at: [+s.x.toFixed(1), +s.z.toFixed(1)] }; blocks.push(cur); }
      } else cur = null;
    }
    routes.push({ route: name, route_m: named.metres, sampled_m: samples.length ? samples[samples.length - 1].m : 0, blocked_blocks: blocks, first_block_m: blocks.length ? blocks[0].from_m : null });
  }
  // Every leg too, not only the two named routes: a leg the crossing does not use is still a road.
  const legs = [];
  for (const leg of roads.legs) {
    const samples = resample(leg.points, step);
    const hits = new Set();
    for (const s of samples) for (const pl of plans) { const b = insideBuilding(pl, s.x, s.z, 0); if (b) hits.add(b); }
    if (hits.size) legs.push({ leg: leg.id, buildings: [...hits] });
  }
  return { routes, legs };
}

if (SELF_TEST) {
  // The instrument must be able to go red AND green, ON ONE NAMED BUILDING, or it is only
  // reporting that the tree already has offences somewhere — which is exactly the vacuous
  // positive RULES.md rule 4 is about. The first draft of this self-test was vacuous: it moved
  // `doc.buildings[0].pos`, and `planSettlement()` does not read `pos` on a building at all
  // (position is `rec.pos + b.offset_m`), so the mutation did nothing and the pre-existing
  // offence read as a detection.
  //
  // The subject is `stormhold-scribe`, which the shipped tree puts across `stormhold-helstrom`
  // at 43-53 m. Arm A is the tree as shipped. Arm B moves that one building 1,000 m east by
  // its own `offset_m` and changes nothing else. A working probe flags it in A and not in B,
  // and leaves every OTHER offence in the province untouched across both arms.
  const SUBJECT = 'stormhold-scribe', LEG = 'stormhold-helstrom';
  const shove = (dx) => (doc) => {
    if (doc.id !== 'stormhold') return;
    const b = doc.buildings.find((q) => q.id === SUBJECT);
    if (!b) throw new Error(`self-test: ${SUBJECT} is not in stormhold.json any more — retarget this test`);
    b.offset_m = [(b.offset_m ? b.offset_m[0] : 0) + dx, b.offset_m ? b.offset_m[1] : 0, b.offset_m ? b.offset_m[2] : 0];
  };
  const A = audit(loadPlans(shove(0)), 1);
  const B = audit(loadPlans(shove(1000)), 1);
  const flagged = (res) => (res.legs.find((l) => l.leg === LEG) || { buildings: [] }).buildings.includes(SUBJECT);
  const others = (res) => JSON.stringify(res.legs.map((l) => [l.leg, l.buildings.filter((b) => b !== SUBJECT)]));
  const red = flagged(A), green = !flagged(B), stable = others(A) === others(B);
  process.stdout.write(`self-test on ${SUBJECT} / ${LEG}\n`);
  process.stdout.write(`  arm A (as shipped)      -> ${red ? 'FLAGGED  (correct)' : 'not flagged  (PROBE IS BLIND)'}\n`);
  process.stdout.write(`  arm B (moved 1000 m E)  -> ${green ? 'clean    (correct)' : 'STILL FLAGGED  (PROBE IS STUCK ON)'}\n`);
  process.stdout.write(`  every other offence identical across both arms: ${stable ? 'yes' : 'NO — the mutation moved more than one building'}\n`);
  const ok = red && green && stable;
  process.stdout.write(ok ? '\nself-test PASS — the probe moves with the world.\n' : '\nself-test FAIL\n');
  process.exit(ok ? 0 : 1);
}

const plans = loadPlans(null);
const res = audit(plans, 1);
const offences = res.routes.reduce((n, r) => n + r.blocked_blocks.length, 0);
const out = {
  schema: 'w1-01/road-through-building@1',
  measured_at: new Date().toISOString(), git,
  method: 'every named route resampled at 1 m; insideBuilding() over all 8 settlement plans (render/exterior.js planSettlement), offline, no engine',
  settlements: plans.map((p) => ({ id: p.id, buildings: p.buildings.length })),
  ...res,
  offences,
  pass: offences === 0,
};
fs.mkdirSync(path.dirname(path.join(ROOT, outFile)), { recursive: true });
fs.writeFileSync(path.join(ROOT, outFile), JSON.stringify(out, null, 1) + '\n');

for (const r of res.routes) {
  process.stdout.write(`${r.route.padEnd(12)} ${String(r.route_m).padStart(8)} m declared — ${r.blocked_blocks.length} block(s) of building on the road\n`);
  for (const b of r.blocked_blocks) process.stdout.write(`    ${b.from_m}-${b.to_m} m  ${b.building}  (${b.at[0]}, ${b.at[1]})\n`);
}
process.stdout.write(`\n${res.legs.length} of ${roads.legs.length} built legs pass through at least one building.\n`);
for (const l of res.legs) process.stdout.write(`    ${l.leg}: ${l.buildings.join(', ')}\n`);
process.stdout.write(`\n${offences} offence(s) on the named routes. ${out.pass ? 'PASS' : 'FAIL'}\n  ${outFile}\n`);
process.exit(out.pass ? 0 : 1);
