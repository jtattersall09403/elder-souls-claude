#!/usr/bin/env node
/**
 * w1-01-r4-consumption.mjs — RI-MTH07 / ARBITRATION §3 CONSUMPTION for what W1-01 round 4's
 * successor run adds, and the delete-the-fix arm for its most load-bearing claim.
 *
 * THE CLAIM. The crossing — the province's headline "about an hour on foot" — stops at 39 m of
 * 6,816 because the road leg `stormhold-helstrom` runs through the footprint of the building
 * `stormhold-scribe` (43-53 m). `tools/world/road-through-building.mjs` says so geometrically,
 * offline. Geometry is not a body.
 *
 * THE MODEL is `game/data/world/settlements/<id>.json §buildings[].offset_m` — where a town puts
 * its houses. THE WORLD-SIDE CONSUMER is `render/exterior.js planSettlement()` ->
 * `province.settlementSolidsNear()` -> `engine._settleSettlementSolids()`'s `CollisionCell` ->
 * `sim/world-collision.js`, which pushes the player capsule out of it. THE ENTITY THAT CHANGES
 * BEHAVIOUR is the player, and what changes is how far it can walk down its own trunk road.
 *
 * THE ARMS, all on one loaded world so nothing but the perturbation differs:
 *
 *   A  as shipped                            — expect: the body stops short of the building
 *   B  stormhold-scribe moved 1,000 m east   — expect: the body walks straight past
 *   C  arm A again, building put back        — expect: A's number returns
 *
 * C is the half that makes this worth reading. Without it, B proves only that SOMETHING changed
 * between two runs of a stateful browser, and RULES.md rule 6 is explicit that an inert fix has
 * passed here twice. With it, the number has to come back.
 *
 * Usage: node tools/world/w1-01-r4-consumption.mjs [--out reports/w1-01-r4/consumption.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { launchGame } from '../lib/browser.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const OUT = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/w1-01-r4/consumption.json';
const FRAMES = argv.includes('--frames') ? Number(argv[argv.indexOf('--frames') + 1]) : 9000;
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const SUBJECT = 'stormhold-scribe';
const git = (() => {
  try {
    const q = (c) => execSync(c, { cwd: ROOT }).toString().trim();
    return { commit: q('git rev-parse HEAD'), branch: q('git rev-parse --abbrev-ref HEAD'), dirty: q('git status --porcelain').length > 0 };
  } catch { return null; }
})();

const shipped = rd('game/data/world/settlements/stormhold.json');
const moved = JSON.parse(JSON.stringify(shipped));
{
  const b = moved.buildings.find((q) => q.id === SUBJECT);
  if (!b) throw new Error(`${SUBJECT} is not in stormhold.json — retarget this probe rather than reporting a vacuous pass`);
  b.offset_m = [(b.offset_m ? b.offset_m[0] : 0) + 1000, b.offset_m ? b.offset_m[1] : 0, b.offset_m ? b.offset_m[2] : 0];
}

const handle = await launchGame({ width: 320, height: 180 });
const arms = [];
try {
  await handle.h('setSeed', 1337);
  await handle.h('loadState', 'default');
  await handle.h('setTide', 'LOW');

  const walk = async (label, doc) => {
    // Put the town back the way this arm wants it BEFORE the walk restarts, and prove the
    // perturbation reached the collision set rather than assuming it did.
    const stats = await handle.h('__w1_04_perturbSettlement', doc, null);
    const plan = await handle.h('__w1_04_plan', 'stormhold');
    const sub = (plan.buildings || []).find((q) => q.id === SUBJECT) || null;
    let r = await handle.h('walkRoute', { route: 'crossing', speed: 'walk', restart: true, chunkFrames: 1 });
    r = await handle.h('walkRoute', { route: 'crossing', speed: 'walk', chunkFrames: FRAMES });
    const p = await handle.h('getPlayerStats');
    const solids = await handle.h('getSettlementSolids');
    const row = {
      arm: label,
      subject_at: sub ? [+sub.x.toFixed(1), +sub.z.toFixed(1)] : null,
      path_m: +r.path_m.toFixed(1),
      route_points_consumed: r.remaining_points,
      frames: r.frames,
      body_at: [+p.pos[0].toFixed(1), +p.pos[2].toFixed(1)],
      solid_shapes_near_body: solids.shapes,
      inside_a_building: solids.inside_a_building,
      province_tiles: stats ? (stats.tiles ?? null) : null,
    };
    arms.push(row);
    process.stdout.write(`${label.padEnd(34)} scribe at ${JSON.stringify(row.subject_at)}  body walked ${String(row.path_m).padStart(7)} m  `
      + `stopped at ${JSON.stringify(row.body_at)}  ${row.solid_shapes_near_body} solids\n`);
    return row;
  };

  const A = await walk('A shipped', shipped);
  const B = await walk('B scribe moved 1000 m east', moved);
  const C = await walk('C shipped again (delete-the-fix)', shipped);

  var verdict = {
    // The perturbation has to MOVE the body's reach, and putting the building back has to bring
    // the old number back. Both, or this proves nothing.
    b_further_than_a: B.path_m > A.path_m * 1.5,
    c_returns_to_a: Math.abs(C.path_m - A.path_m) <= Math.max(2, A.path_m * 0.1),
    arms_differ: B.path_m !== A.path_m,
    a_m: A.path_m, b_m: B.path_m, c_m: C.path_m,
  };
} finally { await handle.close(); }

const doc = {
  schema: 'w1-01/r4-consumption@1', measured_at: new Date().toISOString(), git,
  model: 'game/data/world/settlements/<id>.json §buildings[].offset_m',
  world_side_consumer: 'render/exterior.js planSettlement() -> world/province.js settlementSolidsNear() -> engine._settleSettlementSolids() CollisionCell -> sim/world-collision.js capsule push-out',
  entity_that_changes_behaviour: 'the player capsule, walking the crossing route through Stormhold',
  frames_per_arm: FRAMES,
  arms, verdict,
  pass: verdict.b_further_than_a && verdict.c_returns_to_a && verdict.arms_differ,
};
fs.mkdirSync(path.dirname(path.join(ROOT, OUT)), { recursive: true });
fs.writeFileSync(path.join(ROOT, OUT), JSON.stringify(doc, null, 1) + '\n');
process.stdout.write(`\nCONSUMPTION: perturbing the building moved the body ${verdict.b_further_than_a ? 'FURTHER (consumed)' : 'NOT AT ALL (no consumer)'}\n`);
process.stdout.write(`DELETE-THE-FIX: putting the building back ${verdict.c_returns_to_a ? 'BROUGHT THE OLD NUMBER BACK' : 'DID NOT restore the old number — the arms are not clean'}\n`);
process.stdout.write(`  A ${verdict.a_m} m   B ${verdict.b_m} m   C ${verdict.c_m} m\n  ${OUT}\n`);
process.exit(doc.pass ? 0 : 1);
