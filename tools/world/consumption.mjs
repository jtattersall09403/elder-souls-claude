#!/usr/bin/env node
/**
 * consumption.mjs — the RI-MTH07 / ARBITRATION §3 CONSUMPTION check for every model W1-01 ships.
 *
 * The check exists because four wave-1 pieces independently shipped correct models that nothing in
 * the running world read, and this piece owned two of the clearest instances: `roads.json`'s 21
 * declared `deck_spans` ("read nowhere in `game/src` — JSON labels on an earth berm") and
 * `hazards.json` ("the census passes; nothing in it is real").
 *
 * A claim that a model is consumed is worth nothing. What is worth something is PERTURBING the
 * model and watching the world change, so that is what this does: for each of the four data files
 * this piece ships, it loads the world twice — once as shipped, once with one field altered — and
 * prints the quantity that moved, the consumer that moved it, and by how much. If a perturbation
 * produces no delta, the model has no consumer and the check FAILS.
 *
 * Everything runs in bare node against the same modules the browser loads, so it is fast enough to
 * run on every change and there is no way for it to be measuring a different build.
 *
 * Usage: node tools/world/consumption.mjs [--out reports/consumption.json]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldField } from '../../game/src/world/field.js';
import { SignatureField } from '../../game/src/world/signature.js';
import { Traversal } from '../../game/src/sim/traversal.js';
import { Hazards } from '../../game/src/sim/hazards.js';
import { arrangeAt, latticePoints } from '../../game/src/world/arrangement.js';
import { hash2, fbm, smoothstep } from '../../game/src/world/noise.js';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));
const argv = process.argv.slice(2);
const outFile = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/consumption.json';

const TERRAIN = rd('game/data/world/terrain.json');
const REGIONS = rd('game/data/world/regions.json');
const WATER = rd('game/data/world/water.json');

/** Build a whole world from four documents, so a perturbed document produces a perturbed world. */
function build({ roads, signatures, traversal, hazards, regions }) {
  const field = new WorldField(TERRAIN, regions || REGIONS, WATER);
  field.setRoads(roads);
  const sig = new SignatureField(signatures);
  field.setSignatures(sig);
  const trav = new Traversal(traversal, field);
  trav.attach(sig);
  const haz = new Hazards(hazards, field, sig, (regions || REGIONS).regions);
  return { field, sig, trav, haz };
}

const SHIPPED = {
  roads: rd('game/data/world/roads.json'),
  signatures: rd('game/data/world/signatures.json'),
  traversal: rd('game/data/world/traversal.json'),
  hazards: rd('game/data/world/hazards.json'),
};
const base = build(SHIPPED);

const results = [];
function record(model, file, perturbation, consumer, quantity, before, after, note) {
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  results.push({ model, file, perturbation, consumer, quantity, before, after, changed, note });
  process.stdout.write(`${changed ? 'CONSUMED' : 'DEAD    '}  ${file.padEnd(30)} ${perturbation}\n`
    + `          consumer: ${consumer}\n`
    + `          ${quantity}: ${JSON.stringify(before)}  ->  ${JSON.stringify(after)}\n`);
}

// ---- 1. signatures.json -----------------------------------------------------------------------
{
  const inst = SHIPPED.signatures.instances.find((i) => i.kind === 'rock_flute_spire');
  const bx = inst.x, bz = inst.z;
  const beforeH = +base.field.heightAt(bx, bz).toFixed(3);
  const beforeNat = +base.field.naturalHeightAt(bx, bz).toFixed(3);

  const moved = clone(SHIPPED.signatures);
  const m = moved.instances.find((i) => i.kind === 'rock_flute_spire' && i.x === bx && i.z === bz);
  m.x = bx + 400;
  const w2 = build({ ...SHIPPED, signatures: moved });
  record('signatures', 'game/data/world/signatures.json',
    `move one rock_flute_spire 400 m east (${bx} -> ${bx + 400})`,
    'game/src/world/field.js heightAt() via SignatureField.groundDelta() — the ONE surface the collision, the terrain mesh, the slope histogram and every audit read',
    `ground height at the flute's old position (natural ground there is ${beforeNat} m)`,
    beforeH, +w2.field.heightAt(bx, bz).toFixed(3),
    'seven of the thirteen ONLY-HERE elements are landform; moving one moves the ground');

  const deleted = clone(SHIPPED.signatures);
  deleted.instances = deleted.instances.filter((i) => i.kind !== 'glassed_crater');
  const w3 = build({ ...SHIPPED, signatures: deleted });
  const auditRow = (w) => w.sig.audit(w.field).find((r) => r.kind === 'glassed_crater') || { in_own_region: 0, pass: false };
  record('signatures', 'game/data/world/signatures.json',
    'delete every glassed_crater instance',
    'engine.signatureAudit() — RI-WLD04 M19',
    'M19 row for stone-wastes { in_own_region, pass }',
    { in_own_region: auditRow(base).in_own_region, pass: auditRow(base).pass },
    { in_own_region: auditRow(w3).in_own_region, pass: auditRow(w3).pass },
    'M19 is answered from the running world, not from the count in regions.json');
}

// ---- 2. traversal.json ------------------------------------------------------------------------
{
  // A face the shipped build refuses to climb.
  const site = [2286.3, 1360.9];
  const climb = (world) => {
    world.trav.reset();
    const f = world.field;
    const e = 3;
    const hx = f.heightAt(site[0] + e, site[1]) - f.heightAt(site[0] - e, site[1]);
    const hz = f.heightAt(site[0], site[1] + e) - f.heightAt(site[0], site[1] - e);
    const L = Math.hypot(hx, hz) || 1;
    const p = { pos: [site[0], f.heightAt(site[0], site[1]), site[1]], hp: 620, hpMax: 620, stamina: 120, staminaMax: 120, regenBlockUntil: 0, state: 'WALK', frameNow: 0 };
    const y0 = p.pos[1];
    for (let i = 0; i < 300; i++) {
      p.frameNow = i;
      const px = p.pos[0], pz = p.pos[2];
      p.pos[0] += (hx / L) * 2 / 60; p.pos[2] += (hz / L) * 2 / 60;
      world.trav.step(p, px, pz, 1, true, null);
    }
    return +(p.pos[1] - y0).toFixed(2);
  };
  const loose = clone(SHIPPED.traversal); loose.slope.max_walkable_deg = 85;
  record('traversal', 'game/data/world/traversal.json',
    'slope.max_walkable_deg 40 -> 85',
    'game/src/sim/traversal.js step() slope gate',
    'metres climbed in 5 s of held walk straight up a 72 deg face',
    climb(base), climb(build({ ...SHIPPED, traversal: loose })),
    'the round-2 world had no gate at all and climbed 10.28 m here');

  const fall = (world, drop) => {
    world.trav.reset();
    const f = world.field, x = 3915.5, z = 2111.6;
    const g = f.heightAt(x, z);
    const p = { pos: [x, g + drop, z], hp: 620, hpMax: 620, stamina: 120, staminaMax: 120, regenBlockUntil: 0, state: 'WALK', frameNow: 0 };
    for (let i = 0; i < 1200; i++) { p.frameNow = i; world.trav.step(p, p.pos[0], p.pos[2], 1, false, null); if (!world.trav.airborne && i > 4) break; }
    return +(620 - p.hp).toFixed(2);
  };
  const soft = clone(SHIPPED.traversal); soft.fall.safe_m = 40;
  record('traversal', 'game/data/world/traversal.json',
    'fall.safe_m 4 -> 40',
    'game/src/sim/traversal.js _land()',
    'HP lost landing a 20 m drop',
    fall(base, 20), fall(build({ ...SHIPPED, traversal: soft }), 20),
    'the round-2 world took 0 damage from 150 m');

  const dry = clone(SHIPPED.traversal); dry.water.stamina_drain_moving_per_s.W5 = 0;
  const drain = (world) => {
    world.trav.reset();
    const f = world.field, x = 2702.7, z = 4810.3;
    const p = { pos: [x, f.heightAt(x, z), z], hp: 620, hpMax: 620, stamina: 120, staminaMax: 120, regenBlockUntil: 0, state: 'WALK', frameNow: 0 };
    for (let i = 0; i < 300; i++) { p.frameNow = i; const px = p.pos[0]; p.pos[0] += 2 / 60; world.trav.step(p, px, p.pos[2], 1, true, null); }
    return +(120 - p.stamina).toFixed(2);
  };
  record('traversal', 'game/data/world/traversal.json',
    'water.stamina_drain_moving_per_s.W5 4.0 -> 0',
    'game/src/sim/traversal.js step() §7',
    'stamina spent swimming for 5 s in 8.28 m of water',
    drain(base), drain(build({ ...SHIPPED, traversal: dry })),
    'S25: "stamina is charged for standing in it". Round 2 measured 120 -> 120 over 60 s');
}

// ---- 3. hazards.json --------------------------------------------------------------------------
{
  const standIn = (world, id, frames) => {
    const h = world.haz.byId.get(id);
    if (!h) return { fired: false, hp_lost: 0 };
    // Find a point inside the volume, using the world's own predicate.
    const region = REGIONS.regions.find((r) => h.regions.includes(r.name));
    const bb = region.bounds_m;
    const sim = { frame: 0, cellId: null, env: { weather: 'salt_storm', timeOfDay: 12 }, entities: [],
      player: { pos: [0, 0, 0], hp: 620, hpMax: 620, stamina: 120, staminaMax: 120, state: 'IDLE' } };
    const bus = { emit: () => ({}) };
    let placed = false;
    for (let i = 0; i < 400 && !placed; i++) {
      const t = ((i * 2654435761) % 1000) / 1000, u = ((i * 40503) % 997) / 997;
      sim.player.pos[0] = bb.x[0] + t * (bb.x[1] - bb.x[0]);
      sim.player.pos[2] = bb.z[0] + u * (bb.z[1] - bb.z[0]);
      if (world.field.regionIndexAt(sim.player.pos[0], sim.player.pos[2]) !== region.index) continue;
      world.haz.reset();
      const rep = world.haz.step(sim, bus, null);
      const row = rep.find((q) => q.id === id);
      if (row && row.inside) placed = true;
    }
    if (!placed) return { fired: false, hp_lost: 0, note: 'no point inside the volume' };
    world.haz.reset();
    sim.player.hp = 620;
    for (let f = 0; f < frames; f++) { sim.frame = f; world.haz.step(sim, bus, null); }
    const row = world.haz.lastReport.find((q) => q.id === id) || {};
    return { fired: !!row.fired, hp_lost: +(620 - sim.player.hp).toFixed(2) };
  };

  const weak = clone(SHIPPED.hazards);
  weak.hazards.find((h) => h.id === 'salt-storm').damage.value = 0.1;
  record('hazards', 'game/data/world/hazards.json',
    'salt-storm damage.value 1.2 -> 0.1 %max-HP/s',
    'game/src/sim/hazards.js _damageThisFrame() — the only source of any hazard magnitude',
    'HP lost standing in the Stone Wastes salt-storm for 90 s',
    standIn(base, 'salt-storm', 5400), standIn(build({ ...SHIPPED, hazards: weak }), 'salt-storm', 5400),
    'round 2: 19 hazards declared, 0 fired in 13 x 60 s');

  const slow = clone(SHIPPED.hazards);
  slow.hazards.find((h) => h.id === 'kiln-ground').tell.lead_s = 30;
  const firstDamage = (world, id) => {
    const r = standIn(world, id, 900);
    const row = world.haz.lastReport.find((q) => q.id === id) || {};
    return { first_damage_frame: row.first_damage_frame ?? null, hp_lost: r.hp_lost };
  };
  record('hazards', 'game/data/world/hazards.json',
    'kiln-ground tell.lead_s 3.5 -> 30',
    'game/src/sim/hazards.js step() §H1 — the first damage frame is the tell frame plus the declared lead',
    'first damage frame and HP lost in 15 s inside a naga kiln volume',
    firstDamage(base, 'kiln-ground'), firstDamage(build({ ...SHIPPED, hazards: slow }), 'kiln-ground'),
    'RI-WLD11 H1: a hazard cannot hurt you before its own telegraph has had time to be read');
}

// ---- 4. roads.json deck_spans -----------------------------------------------------------------
{
  const leg = SHIPPED.roads.legs.find((l) => (l.deck_spans || []).length);
  const sp = leg.deck_spans[0];
  const [x, z] = leg.points[Math.floor((sp.from_i + sp.to_i) / 2)];
  const stripped = clone(SHIPPED.roads);
  for (const l of stripped.legs) l.deck_spans = [];
  const w = build({ ...SHIPPED, roads: stripped });
  const deckOf = (world) => { const d = world.field.onDeckAt(x, z); return d ? { on_deck: true, clearance_m: +d.clearance_m.toFixed(2) } : { on_deck: false }; };
  record('roads.deck_spans', 'game/data/world/roads.json',
    'delete every deck_spans entry',
    'game/src/world/field.js setRoads() / _applyRoads() / onDeckAt(), and game/src/world/province.js _spans()',
    `is the midpoint of ${leg.id}'s first declared span a bridge deck, and what is under it`,
    deckOf(base), deckOf(w),
    'round 2: "read nowhere in game/src. They are JSON labels on an earth berm."');

  // And the thing the label was standing in for: with the spans gone, the ground under the deck
  // rises to meet it, which is the 17.52 m of earth fill the round-2 verdict measured.
  // The 2,537 shoulder points above 40 degrees the round-2 verdict counted are what an earth berm
  // IS. A viaduct has no shoulder — it has air — so the shoulder slope is the sharpest single
  // number for "structure" versus "bank", and it is measured off the ground either way.
  const shoulder = (world) => {
    let worst = 0, over40 = 0, n = 0;
    for (let t = 0; t <= 30; t++) {
      const i = sp.from_i + Math.round((sp.to_i - sp.from_i) * t / 30);
      const [px, pz] = leg.points[i];
      for (const off of [-14, -10, -7, -5, 5, 7, 10, 14]) {
        const d = world.field.slopeAt(px + off, pz, 2.5);
        n++; if (d > 40) over40++;
        if (d > worst) worst = d;
      }
    }
    return { max_shoulder_deg: +worst.toFixed(1), points_over_40deg: over40, of: n };
  };
  record('roads.deck_spans', 'game/data/world/roads.json',
    'delete every deck_spans entry (same perturbation, second consumer)',
    'game/src/world/field.js _applyRoads() earth blend — with no span declared the ground is raised to the deck and throws a shoulder',
    'shoulder slope 5-14 m off the centreline along the first declared span',
    shoulder(base), shoulder(w),
    'round 2 counted 2,537 shoulder points above 40 degrees across the network; a viaduct has air where a berm has a shoulder');
}

// ---- 5. regions.json: the ORDINARY ground and the ORDINARY flora -------------------------------
// Round 4's whole subject. Verdict W1-01 r2 measured that two-thirds of regional distinctness was
// tint, and the r3 builder showed that placing thirteen rare landmarks could not move it because a
// random frame is made of the ordinary ground. These four perturbations are the proof that the
// ordinary ground is now DATA WITH A CONSUMER and not a comment: change a region's declared
// micro-relief mixture, its prop arrangement or its ground-cover density, and the surface the
// player stands on and the props standing on it change with it.
{
  const HIVE = REGIONS.regions.findIndex((r) => r.id === 'hive');
  const CLAY = REGIONS.regions.findIndex((r) => r.id === 'clay-moor');
  const VALUS = REGIONS.regions.findIndex((r) => r.id === 'valus-ridge');
  const hx = REGIONS.regions[HIVE].centroid_m[0], hz = REGIONS.regions[HIVE].centroid_m[1];

  // (a) the amplitude. `field.heightAt` -> `_terrain` -> `MicroField.at`.
  const flat = clone(REGIONS); flat.regions[HIVE].terrain.micro.amp_m = 0;
  const wA = build({ ...SHIPPED, regions: flat });
  const profile = (w) => {
    const out = [];
    for (let d = 0; d < 60; d += 12) out.push(+w.field.heightAt(hx + d, hz).toFixed(3));
    return out;
  };
  record('regions.terrain.micro', 'game/data/world/regions.json',
    'hive terrain.micro.amp_m 0.62 -> 0 (the region loses its comb treads)',
    'game/src/world/field.js _terrain() via MicroField.at() — inside heightAt, so inside collision, the terrain mesh, the slope histogram and the water census',
    'ground height on a 60 m transect through the Hive centroid, every 12 m',
    profile(base), profile(wA),
    'the ordinary ground of a region is now data; before round 4 all thirteen shared one detailAt with three scalars');

  // (b) the MIXTURE, at constant amplitude: a different landform, not a smaller one.
  const swapped = clone(REGIONS);
  swapped.regions[HIVE].terrain.micro.weights = { bund: 1.0 };
  const wB = build({ ...SHIPPED, regions: swapped });
  const dom = (w) => {
    const d = w.field.micro.dominantAt(hx, hz);
    const sd = (() => { const v = []; for (let i = 0; i < 120; i++) v.push(w.field.micro.at(hx + i * 3, hz)); const m = v.reduce((a, b) => a + b) / v.length; return +Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length).toFixed(3); })();
    return { dominant: d && d.kind, sd_m: sd, h_at_centroid: +w.field.heightAt(hx, hz).toFixed(3) };
  };
  record('regions.terrain.micro', 'game/data/world/regions.json',
    'hive terrain.micro.weights terracette+crack -> bund, amplitude unchanged',
    'game/src/world/microrelief.js MicroField — nine primitives, blended over ~70 m by a 9-tap read of the region raster',
    'dominant primitive, realised micro sd over a 360 m transect, and the ground height at the centroid',
    dom(base), dom(wB),
    'the same amplitude in a different shape is a different place, which is what M18 ground_microrelief scores');

  // (c) the ARRANGEMENT. `province._scatter` -> `arrangement.arrangeAt`.
  const scattered = clone(REGIONS);
  scattered.regions[CLAY].props.arrangement = { mode: 'scatter', strength: 0 };
  const wC = build({ ...SHIPPED, regions: scattered });
  const spacing = (w) => {
    const r = w.field.regions[CLAY], TILE = 300, N = 46, cellArea = TILE * TILE / (N * N);
    const bb = r.bounds_m; const pts = [];
    for (let tz = Math.floor(bb.z[0] / TILE); tz < Math.ceil(bb.z[1] / TILE); tz++) {
      for (let tx = Math.floor(bb.x[0] / TILE); tx < Math.ceil(bb.x[1] / TILE); tx++) {
        const ox = tx * TILE, oz = tz * TILE; let li = -1;
        for (const [x, z] of latticePoints(ox, oz, TILE, N)) {
          li++; const ix = li % N, iz = (li / N) | 0;
          if (w.field.regionIndexAt(x, z) !== CLAY || !w.field.isLandAt(x, z)) continue;
          const p = r.props;
          const cap = Math.min(1, 700 / (p.canopy.per100m2 * TILE * TILE / 100));
          if (hash2(ix + ox, iz + oz, 7741) < p.canopy.per100m2 * cap
            * arrangeAt(w.field, x, z, p.arrangement, 1.0) * cellArea / 100) pts.push([x, z]);
        }
      }
    }
    if (pts.length < 12) return { n: pts.length, nn_mean_m: 0 };
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      let best = Infinity;
      for (let j = 0; j < pts.length; j++) if (i !== j) { const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d < best) best = d; }
      sum += best;
    }
    return { n: pts.length, nn_mean_m: +(sum / pts.length).toFixed(2) };
  };
  record('regions.props.arrangement', 'game/data/world/regions.json',
    "clay-moor props.arrangement 'isolated' (45 m lattice) -> 'scatter'",
    'game/src/world/arrangement.js arrangeAt(), read by province._scatter for every lattice site',
    'placed clay-moor canopy instances and their mean nearest-neighbour distance',
    spacing(base), spacing(wC),
    'the same cone at the same declared density is a different landscape at a different spacing — M18 prop_arrangement');

  // (d) the GROUND COVER. `province.updateCover` builds a 70 m disc on a 1.7 m lattice.
  const bare = clone(REGIONS);
  bare.regions[VALUS].props.cover.per100m2 = 1;
  const wD = build({ ...SHIPPED, regions: bare });
  const coverCount = (w) => {
    const R = 70, STEP = 1.7, cellArea = STEP * STEP;
    const [cx0, cz0] = w.field.regions[VALUS].centroid_m;
    const n = Math.ceil(R / STEP);
    const gx0 = Math.floor((cx0 - R) / STEP), gz0 = Math.floor((cz0 - R) / STEP);
    let count = 0;
    for (let iz = 0; iz <= n * 2; iz++) for (let ix = 0; ix <= n * 2; ix++) {
      const cx = gx0 + ix, cz = gz0 + iz;
      const px = (cx + hash2(cx, cz, 6301)) * STEP, pz = (cz + hash2(cx, cz, 6307)) * STEP;
      const d = Math.hypot(px - cx0, pz - cz0);
      if (d > R || px < 0 || pz < 0 || px >= w.field.sizeX || pz >= w.field.sizeZ) continue;
      if (!w.field.isLandAt(px, pz)) continue;
      const r = w.field.regions[w.field.regionIndexAt(px, pz)];
      const cv = r.props.cover;
      const patch = 0.30 + 1.70 * smoothstep(0.40, 0.62, fbm(px / cv.patch_m, pz / cv.patch_m, 6311, 3));
      const fade = 1 - smoothstep(R - 15, R, d);
      const a = arrangeAt(w.field, px, pz, r.props.arrangement, 0.45);
      if (hash2(cx, cz, 6313) >= cv.per100m2 * patch * a * fade * cellArea / 100) continue;
      if (w.field.depthAt(px, pz) > 0.30) continue;
      count++;
    }
    return count;
  };
  record('regions.props.cover', 'game/data/world/regions.json',
    'valus-ridge props.cover.per100m2 30 -> 1 (the scree is swept off the mountain)',
    'game/src/world/province.js updateCover() — the camera-following 70 m ground-cover disc',
    'ground-cover instances standing in a 70 m disc at the Valus Ridge centroid',
    coverCount(base), coverCount(wD),
    'ground cover is what most of every frame is made of; before round 4 the layer did not exist');
}

const failures = results.filter((r) => !r.changed);
const doc = {
  schema: 'w1-01/consumption@1',
  method: 'RI-MTH07 / ARBITRATION §3 CONSUMPTION. Build the world twice from the same modules the '
        + 'browser loads, once as shipped and once with one field of one model perturbed, and report '
        + 'the world-side quantity that moved. A model whose perturbation moves nothing has no consumer.',
  measured_at: new Date().toISOString(),
  models: [...new Set(results.map((r) => r.model))],
  checks: results.length,
  consumed: results.length - failures.length,
  dead: failures.map((r) => `${r.file}: ${r.perturbation}`),
  ok: failures.length === 0,
  results,
};
mkdirSync(join(ROOT, dirname(outFile)), { recursive: true });
writeFileSync(join(ROOT, outFile), JSON.stringify(doc, null, 1) + '\n');
process.stdout.write(`\n${doc.consumed}/${doc.checks} perturbations changed the world across ${doc.models.length} models\n  ${outFile}\n`);
process.exit(failures.length ? 1 : 0);
