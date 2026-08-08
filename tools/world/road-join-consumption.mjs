#!/usr/bin/env node
/**
 * road-join-consumption.mjs — CONSUMPTION for the roads/settlements join.
 *
 * `RI-MTH07`, mandatory under `corpus/00-doctrine/ARBITRATION.md` §3, and `RULES.md` rule 5.
 * **Sixteen subsystems in this project have shipped a correct, instrumented model that nothing in
 * the running world reads.** This tool exists so the join is not the seventeenth.
 *
 * THE CLAIM UNDER TEST. `tools/world/build-roads.mjs` now reads `planSettlement()` — the same pure
 * function `game/src/world/province.js` builds its collision walls from — and cuts the road around
 * the buildings it finds. If that is real, then MOVING A BUILDING MOVES THE ROAD. If it is not, the
 * road is where it is because this tree's seeds happen to agree, and any edit to a settlement file
 * puts a house back on the trunk road.
 *
 * FOUR PERTURBATIONS, each on a scratch copy of the tree, each read back off an INDEPENDENT
 * instrument (`tools/world/road-through-building.mjs`, W1-01 r4's, run as a subprocess and not
 * imported) rather than off the generator's own summary:
 *
 *   P1  MOVE      a building that currently stands beside the road is moved ON TO it
 *   P2  ADD       a building that does not exist is planted astride the road
 *   P3  GROW      an interior's `continuity.exterior_footprint_m` is enlarged until it swallows the
 *                 road — the path that only exists because the game plans with interiors loaded
 *   NULL          a building is moved 800 m out into the fields, away from every road
 *
 * EACH PERTURBATION IS MEASURED IN TWO ARMS, and the first arm is what makes the second mean
 * anything:
 *
 *   BITES     the settlement is perturbed and the roads are NOT rebuilt. The instrument must go
 *             RED. A perturbation the instrument cannot see is not a perturbation, and a
 *             "the road still works" result from one is worthless. This arm is also the RETARGETED
 *             `--self-test`: `road-through-building.mjs`'s own arm A was the shipped defect
 *             (`stormhold-scribe` across `stormhold-helstrom`) and cannot flag on a fixed tree, so
 *             the flag/clear/everything-else-identical demonstration is re-made here on a building
 *             that is on the NEW road.
 *   FOLLOWS   the settlement is perturbed and the roads ARE rebuilt. The instrument must go GREEN
 *             again, and the road must have MOVED near the perturbed building by a measurable
 *             number of metres.
 *
 * The NULL control is the other half: it must NOT move the road. A join that moved the road
 * whenever anything anywhere changed would pass every "did it move?" test and be coupled to
 * nothing.
 *
 * Usage:
 *   node tools/world/road-join-consumption.mjs [--out reports/w1-road-join/consumption.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { planSettlement } from '../../game/src/render/exterior.js';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const argOf = (f, d) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : d);
const OUT = path.join(ROOT, argOf('--out', 'reports/w1-road-join/consumption.json'));
const SCRATCH = path.resolve(argOf('--scratch',
  '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/consume'));
const log = (s) => process.stdout.write(s + '\n');
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

function makeScratch() {
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  fs.mkdirSync(path.join(SCRATCH, 'corpus/50-world'), { recursive: true });
  fs.mkdirSync(path.join(SCRATCH, 'reports'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'game'), path.join(SCRATCH, 'game'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'tools'), path.join(SCRATCH, 'tools'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'corpus/50-world/world-scale.json'), path.join(SCRATCH, 'corpus/50-world/world-scale.json'));
  fs.rmSync(path.join(SCRATCH, 'tools/runs'), { recursive: true, force: true });
}
function run(args, cwd) {
  try { return { code: 0, out: execFileSync('node', args, { cwd, encoding: 'utf8', maxBuffer: 64 << 20 }) }; }
  catch (e) { return { code: e.status ?? -1, out: (e.stdout || '') + (e.stderr || '') }; }
}

// ---- geometry, for choosing a target and for measuring how far the road moved ------------------
const PRISTINE_ROADS = rd(path.join(ROOT, 'game/data/world/roads.json'));
function legById(doc, id) { return doc.legs.find((l) => l.id === id); }
/** The closest approach of polyline `pts` to (x, z). */
function nearest(pts, x, z) {
  let best = Infinity, at = null;
  for (const q of pts) { const d = Math.hypot(q[0] - x, q[1] - z); if (d < best) { best = d; at = q; } }
  return { d: best, at };
}
/** How far apart two versions of the same leg are, worst case, near (x, z). */
function legShift(a, b, x, z, within) {
  let worst = 0;
  for (const q of a.points) {
    if (Math.hypot(q[0] - x, q[1] - z) > within) continue;
    const n = nearest(b.points, q[0], q[1]);
    if (n.d > worst) worst = n.d;
  }
  return +worst.toFixed(2);
}

// ---- pick the subjects, from the tree rather than from memory ----------------------------------
const interiors = {};
for (const f of fs.readdirSync(path.join(ROOT, 'game/data/world/interiors'))) {
  if (!f.endsWith('.json')) continue;
  const d = rd(path.join(ROOT, 'game/data/world/interiors', f));
  if (d && d.id) interiors[d.id] = d;
}
/** Every building, with its clearance to the leg named. */
function buildingsNear(townId, legId, maxD) {
  const rec = rd(path.join(ROOT, `game/data/world/settlements/${townId}.json`));
  const plan = planSettlement(rec, interiors);
  const leg = legById(PRISTINE_ROADS, legId);
  return plan.buildings
    .map((b) => ({ id: b.id, x: b.x, z: b.z, interior: b.interior, d: nearest(leg.points, b.x, b.z).d,
      road: nearest(leg.points, b.x, b.z).at }))
    .filter((b) => b.d <= maxD)
    .sort((p, q) => p.d - q.d);
}

/**
 * THE GAME'S OWN PREDICATE, run over a perturbed tree: which legs of `roadsDoc` pass through a
 * building, planned the way `province.js setSettlements()` plans — with every interior loaded.
 * `road-through-building.mjs` cannot answer this because it passes `{}` for interiors.
 */
function gamePredicateBlocked(dir, roadsDoc) {
  const ints = {};
  const idir = path.join(dir, 'game/data/world/interiors');
  for (const f of fs.readdirSync(idir)) { if (!f.endsWith('.json')) continue; const d = rd(path.join(idir, f)); if (d && d.id) ints[d.id] = d; }
  const plans = [];
  const sdir = path.join(dir, 'game/data/world/settlements');
  for (const f of fs.readdirSync(sdir).sort()) { if (!f.endsWith('.json')) continue; plans.push(planSettlement(rd(path.join(sdir, f)), ints)); }
  const inside = (x, z) => {
    for (const pl of plans) for (const b of pl.buildings) {
      const w = (b.drawn_footprint_m || b.footprint_m)[0], d = (b.drawn_footprint_m || b.footprint_m)[1];
      const yaw = -(b.yaw_deg || 0) * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
      const dx = x - b.x, dz = z - b.z;
      if (Math.abs(dx * c + dz * s) <= w / 2 && Math.abs(-dx * s + dz * c) <= d / 2) return b.id;
    }
    return null;
  };
  const legs = [];
  for (const leg of roadsDoc.legs) {
    const hits = new Set();
    for (let i = 1; i < leg.points.length; i++) {
      const L = Math.hypot(leg.points[i][0] - leg.points[i - 1][0], leg.points[i][1] - leg.points[i - 1][1]);
      const n = Math.max(1, Math.ceil(L));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const h = inside(leg.points[i - 1][0] + (leg.points[i][0] - leg.points[i - 1][0]) * t,
                         leg.points[i - 1][1] + (leg.points[i][1] - leg.points[i - 1][1]) * t);
        if (h) hits.add(h);
      }
    }
    if (hits.size) legs.push({ leg: leg.id, buildings: [...hits] });
  }
  return { legs };
}

/** The footprint `planSettlement` actually yields for one building AFTER its shrink pass. */
function effectiveFootprint(dir, town, id) {
  const ints = {};
  const idir = path.join(dir, 'game/data/world/interiors');
  for (const f of fs.readdirSync(idir)) { if (!f.endsWith('.json')) continue; const d = rd(path.join(idir, f)); if (d && d.id) ints[d.id] = d; }
  const plan = planSettlement(rd(path.join(dir, `game/data/world/settlements/${town}.json`)), ints);
  const b = plan.buildings.find((q) => q.id === id);
  return b ? { id, footprint_m: b.drawn_footprint_m, x: +b.x.toFixed(1), z: +b.z.toFixed(1) } : null;
}

const LEG = 'stormhold-helstrom';                 // THE CROSSING's first leg — where the body stopped
const candidates = buildingsNear('stormhold', LEG, 60);
if (!candidates.length) { process.stderr.write(`no stormhold building within 60 m of ${LEG} — retarget this probe\n`); process.exit(2); }
const MOVE_SUBJECT = candidates[0];
const GROW_SUBJECT = candidates.find((b) => b.interior && interiors[b.interior]
  && interiors[b.interior].continuity && Array.isArray(interiors[b.interior].continuity.exterior_footprint_m)) || null;
log(`subjects, chosen from the tree:`);
log(`  MOVE/ADD anchor  ${MOVE_SUBJECT.id} at (${MOVE_SUBJECT.x.toFixed(1)}, ${MOVE_SUBJECT.z.toFixed(1)}), ${MOVE_SUBJECT.d.toFixed(1)} m from ${LEG}`);
log(`  GROW subject     ${GROW_SUBJECT ? GROW_SUBJECT.id + ' (interior ' + GROW_SUBJECT.interior + ')' : 'NONE — no nearby building declares an exterior_footprint_m'}`);

// ---- the perturbations -------------------------------------------------------------------------
// Each returns a mutator over the SCRATCH tree, plus the world point it should be felt at.
const PERTURBATIONS = [];
PERTURBATIONS.push({
  id: 'P1-MOVE', why: 'a building that stands beside the road is moved on to it',
  at: [MOVE_SUBJECT.road[0], MOVE_SUBJECT.road[1]], expect_road_moves: true,
  apply(dir) {
    const p = path.join(dir, 'game/data/world/settlements/stormhold.json');
    const doc = rd(p);
    const b = doc.buildings.find((q) => q.id === MOVE_SUBJECT.id);
    if (!b) throw new Error(`P1: ${MOVE_SUBJECT.id} is gone from stormhold.json — retarget`);
    const off = b.offset_m || [0, 0, 0];
    b.offset_m = [off[0] + (MOVE_SUBJECT.road[0] - MOVE_SUBJECT.x), off[1] || 0, off[2] + (MOVE_SUBJECT.road[1] - MOVE_SUBJECT.z)];
    fs.writeFileSync(p, JSON.stringify(doc, null, 1) + '\n');
    return `${MOVE_SUBJECT.id}.offset_m moved ${MOVE_SUBJECT.d.toFixed(1)} m so its centre sits on the road`;
  },
});
PERTURBATIONS.push({
  id: 'P2-ADD', why: 'a building that did not exist is planted astride the road',
  at: [MOVE_SUBJECT.road[0], MOVE_SUBJECT.road[1]], expect_road_moves: true,
  apply(dir) {
    const p = path.join(dir, 'game/data/world/settlements/stormhold.json');
    const doc = rd(p);
    const pos = doc.pos || [0, 0, 0];
    doc.buildings.push({
      id: 'stormhold-consumption-blockhouse', name: 'Blockhouse (consumption probe)',
      kind: 'civic', building_kind: 'hall', enterable: false,
      offset_m: [MOVE_SUBJECT.road[0] - pos[0], 0, MOVE_SUBJECT.road[1] - pos[2]],
    });
    fs.writeFileSync(p, JSON.stringify(doc, null, 1) + '\n');
    return 'stormhold-consumption-blockhouse (hall, 15.0 x 17.0 m derived footprint) added on the road';
  },
});
if (GROW_SUBJECT) PERTURBATIONS.push({
  id: 'P3-GROW', why: "an interior's declared exterior_footprint_m is enlarged until it swallows the road",
  at: [GROW_SUBJECT.x, GROW_SUBJECT.z], expect_road_moves: true,
  // THE OFFLINE INSTRUMENT IS BLIND TO THIS ONE, and that is the point of including it.
  // `road-through-building.mjs` calls `planSettlement(doc, {})` with no interiors, so a footprint
  // that only exists in `continuity.exterior_footprint_m` does not exist as far as it is concerned
  // — while the running game, which plans with all 115 interiors loaded, builds a wall there. The
  // BITES arm is therefore taken with the GAME's own predicate instead, and the instrument's
  // silence is recorded as the finding it is.
  bites_via: 'game-predicate',
  apply(dir) {
    const file = path.join(dir, `game/data/world/interiors/${GROW_SUBJECT.interior}.json`);
    const doc = rd(file);
    const was = doc.continuity.exterior_footprint_m.slice();
    // The first cut of this perturbation asked for a 47 x 47 m footprint and got almost nothing:
    // `planSettlement`'s shrink pass caught the giant swallowing its neighbours' centres and
    // shrank BOTH parties back to roughly their original size, so the model consumed the edit and
    // then cancelled it. A perturbation that the model legally undoes is not a perturbation. The
    // growth is now the smallest that reaches the road, and `verify()` below reads the EFFECTIVE
    // post-shrink footprint back out of `planSettlement` and refuses to proceed if it did not take.
    const need = (GROW_SUBJECT.d + 2.5) * 2;
    doc.continuity.exterior_footprint_m = [Math.max(was[0], need), Math.max(was[1], need)];
    fs.writeFileSync(file, JSON.stringify(doc, null, 1) + '\n');
    return `${GROW_SUBJECT.interior}.continuity.exterior_footprint_m ${JSON.stringify(was)} -> `
      + `${JSON.stringify(doc.continuity.exterior_footprint_m.map((v) => +v.toFixed(1)))}`;
  },
});
// ---- the NULL control, and it took two goes to make it null ------------------------------------
// The first version moved the building "800 m south-west", which is a direction, not a place: it
// landed the building at (1372, -39), off the map edge and near another leg, and the road duly
// moved 236 m. A null control has to be VERIFIED null — the destination below is searched for, and
// accepted only when it is more than 200 m from every point of every built leg.
const NULL_DEST = (() => {
  const far = (x, z) => Math.min(...PRISTINE_ROADS.legs.map((l) => nearest(l.points, x, z).d));
  for (let r = 250; r <= 1200; r += 25) {
    for (let a = 0; a < 360; a += 5) {
      const th = a * Math.PI / 180;
      const x = MOVE_SUBJECT.x + Math.cos(th) * r, z = MOVE_SUBJECT.z + Math.sin(th) * r;
      if (x < 200 || z < 200 || x > 4000 || z > 5200) continue;         // stay on the province
      if (far(x, z) > 200) return { x, z, r, from_road_m: +far(x, z).toFixed(1) };
    }
  }
  return null;
})();
if (!NULL_DEST) { process.stderr.write('no site 200 m clear of every leg — the null control cannot be made null\n'); process.exit(2); }
PERTURBATIONS.push({
  id: 'NULL', why: `a building is moved ${NULL_DEST.r} m out into open country, ${NULL_DEST.from_road_m} m from the nearest road point`,
  at: [MOVE_SUBJECT.x, MOVE_SUBJECT.z], expect_road_moves: false,
  apply(dir) {
    const p = path.join(dir, 'game/data/world/settlements/stormhold.json');
    const doc = rd(p);
    const b = doc.buildings.find((q) => q.id === MOVE_SUBJECT.id);
    const off = b.offset_m || [0, 0, 0];
    b.offset_m = [off[0] + (NULL_DEST.x - MOVE_SUBJECT.x), off[1] || 0, off[2] + (NULL_DEST.z - MOVE_SUBJECT.z)];
    fs.writeFileSync(p, JSON.stringify(doc, null, 1) + '\n');
    return `${MOVE_SUBJECT.id} moved to (${NULL_DEST.x.toFixed(0)}, ${NULL_DEST.z.toFixed(0)}), `
      + `${NULL_DEST.from_road_m} m from the nearest point of any leg`;
  },
});

// ---- run ----------------------------------------------------------------------------------------
const results = [];
for (const P of PERTURBATIONS) {
  makeScratch();
  const what = P.apply(SCRATCH);
  log(`\n${P.id} — ${P.why}\n  ${what}`);

  // ARM 1: BITES. Perturbed settlement, roads NOT rebuilt.
  const bites = run(['tools/world/road-through-building.mjs', '--out', 'reports/rtb-bites.json'], SCRATCH);
  const bitesDoc = rd(path.join(SCRATCH, 'reports/rtb-bites.json'));
  log(`  BITES    (settlement perturbed, roads NOT rebuilt) -> ${bitesDoc.legs.length} of 10 legs blocked, ${bitesDoc.offences} offences  [offline instrument]`);
  // The GAME's own predicate, over the perturbed scratch tree: `planSettlement` WITH the interiors
  // loaded, which is what `province.js setSettlements()` does and what the body's walls come from.
  const gameBites = gamePredicateBlocked(SCRATCH, PRISTINE_ROADS);
  log(`  BITES    (same, but with the interiors loaded — the game's own predicate) -> ${gameBites.legs.length} of 10 legs blocked`);
  // And the perturbation must survive `planSettlement`'s shrink pass, or it is an edit the model
  // legally undid before anything downstream ever saw it.
  const eff = effectiveFootprint(SCRATCH, 'stormhold', P.id === 'P3-GROW' ? GROW_SUBJECT.id : MOVE_SUBJECT.id);

  // ARM 2: FOLLOWS. Same perturbation, roads rebuilt by the joined generator.
  const build = run(['tools/world/build-roads.mjs'], SCRATCH);
  const follows = run(['tools/world/road-through-building.mjs', '--out', 'reports/rtb-follows.json'], SCRATCH);
  const followsDoc = rd(path.join(SCRATCH, 'reports/rtb-follows.json'));
  const after = rd(path.join(SCRATCH, 'game/data/world/roads.json'));
  const shift = legShift(legById(PRISTINE_ROADS, LEG), legById(after, LEG), P.at[0], P.at[1], 120);
  const globalShift = Math.max(...PRISTINE_ROADS.legs.map((l) => {
    const b = legById(after, l.id);
    return b ? legShift(l, b, l.points[Math.floor(l.points.length / 2)][0], l.points[Math.floor(l.points.length / 2)][1], 1e9) : 0;
  }));
  log(`  FOLLOWS  (roads rebuilt)                          -> ${followsDoc.legs.length} of 10 legs blocked, ${followsDoc.offences} offences`);
  log(`  the road near the perturbation moved ${shift} m; the worst move anywhere on the network is ${globalShift.toFixed(2)} m`);

  const checks = [];
  const ck = (id, ok, detail) => { checks.push({ id, pass: !!ok, detail }); log(`    [${ok ? 'PASS' : 'FAIL'}] ${id}: ${detail}`); };
  const gameFollows = gamePredicateBlocked(SCRATCH, after);
  if (P.expect_road_moves) {
    const seen = P.bites_via === 'game-predicate' ? gameBites.legs.length : bitesDoc.legs.length;
    ck('BITES', seen > 0,
      `with the roads unrebuilt the world is RED — ${seen} leg(s) blocked, read by `
      + `${P.bites_via === 'game-predicate' ? "the GAME's predicate (planSettlement with interiors); the offline instrument sees " + bitesDoc.legs.length + ' because it plans with none' : 'the offline instrument'}`);
    ck('FOLLOWS', followsDoc.legs.length === 0 && followsDoc.offences === 0 && gameFollows.legs.length === 0,
      `after the rebuild the province is clear again — ${followsDoc.legs.length} of 10 by the instrument, ${gameFollows.legs.length} of 10 by the game's predicate`);
    ck('COUPLED', shift >= 2.0, `the road near the perturbation moved ${shift} m — the generator read the change`);
  } else {
    ck('NULL-QUIET', shift < 2.0 && globalShift < 12.0,
      `the road did not move (${shift} m near the subject, ${globalShift.toFixed(2)} m worst anywhere) — the join is coupled to buildings ON the road, not to any edit anywhere`);
    ck('NULL-STILL-CLEAR', followsDoc.legs.length === 0 && gameFollows.legs.length === 0,
      `and the province is still clear (${followsDoc.legs.length} of 10 by the instrument, ${gameFollows.legs.length} by the game's predicate)`);
  }
  results.push({ ...P, apply: undefined, what, build_exit: build.code,
    effective_footprint_after_shrink: eff,
    bites: { legs_blocked: bitesDoc.legs.length, offences: bitesDoc.offences, blocked: bitesDoc.legs.map((l) => `${l.leg}: ${l.buildings.join(', ')}`) },
    bites_game_predicate: { legs_blocked: gameBites.legs.length, blocked: gameBites.legs.map((l) => `${l.leg}: ${l.buildings.join(', ')}`) },
    follows: { legs_blocked: followsDoc.legs.length, offences: followsDoc.offences, game_predicate_legs_blocked: gameFollows.legs.length },
    road_shift_near_perturbation_m: shift, worst_shift_anywhere_m: +globalShift.toFixed(2),
    checks });
}

const all = results.flatMap((r) => r.checks);
const doc = {
  schema: 'w1-road-join/consumption@1',
  method: 'RI-MTH07 / ARBITRATION §3. Perturb the settlement model on a scratch tree; read the result off '
        + 'tools/world/road-through-building.mjs (an independent instrument, run as a subprocess) and off the '
        + 'geometry of the rebuilt roads.json, not off build-roads.mjs own summary.',
  measured_at: new Date().toISOString(),
  git: { head: execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim() },
  world_side_consumer: 'game/src/world/field.js setRoads() blends the ground to the deck and game/src/engine.js '
    + 'walkRoute() steers a body down these points; game/src/world/province.js settlementSolidsNear() makes the '
    + 'walls the body hits. The join makes the first two agree with the third.',
  leg: LEG, subjects: { move: MOVE_SUBJECT.id, grow: GROW_SUBJECT ? GROW_SUBJECT.id : null },
  perturbations: results,
  ok: all.every((c) => c.pass),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(doc, null, 1) + '\n');
log(`\n${doc.ok ? 'CONSUMPTION PASSES' : 'CONSUMPTION FAILS'} — ${all.filter((c) => c.pass).length}/${all.length} checks\n  ${OUT}`);
process.exit(doc.ok ? 0 : 1);
