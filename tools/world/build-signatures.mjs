#!/usr/bin/env node
/**
 * build-signatures.mjs — place the thirteen ONLY-HERE elements in the province.
 *
 * `RI-WLD04` M19: "for each region's ONLY-HERE element, query world data for entities of that
 * class. Pass: the element exists in its region with >= 8 instances, and 0 instances in any other
 * region." Round-2 verdict measured 0 of 13, because the counts in `regions.json` were integers
 * with nothing behind them.
 *
 * This writes `game/data/world/signatures.json`: every instance, with the position, orientation,
 * height and per-instance solved parameters `game/src/world/signature.js` needs. It is data and
 * not a runtime scatter deliberately — RI-MTH07's CONSUMPTION check requires a critic to be able
 * to perturb the model and watch the world change, and a seeded scatter buried in the renderer
 * cannot be perturbed.
 *
 * The placement rules are the identity. A milestone is placed BESIDE A ROAD because an Imperial
 * road-milestone in the middle of a moor is not a milestone; a swamp jelly is placed OVER WATER
 * because it drifts above it; a crater floor is solved against the local water table because a
 * pit that fills with water is a pond, and the Stone Wastes are the driest region we have.
 *
 * Usage: node tools/world/build-signatures.mjs [--report]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldField } from '../../game/src/world/field.js';
import { SIGNATURE_KINDS, KIND_OF_REGION, profile } from '../../game/src/world/signature.js';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const regionsDoc = rd('game/data/world/regions.json');
const terrain = rd('game/data/world/terrain.json');
const roads = rd('game/data/world/roads.json');
const field = new WorldField(terrain, regionsDoc, rd('game/data/world/water.json'));
field.setRoads(roads);

const REGIONS = regionsDoc.regions;
const byId = new Map(REGIONS.map((r) => [r.id, r]));
const indexOf = new Map(REGIONS.map((r) => [r.id, r.index]));

// ---- deterministic sampling -----------------------------------------------------------------
// A named 32-bit stream per kind, so re-running places the same instances and adding a kind does
// not move an existing one.
function streamFor(name) {
  let s = 2166136261 >>> 0;
  for (let i = 0; i < name.length; i++) { s ^= name.charCodeAt(i); s = Math.imul(s, 16777619) >>> 0; }
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ---- the constraints ---------------------------------------------------------------------------
const SITES = terrain.sites;
const ROAD_SEGS = [];
for (const leg of roads.legs) {
  const p = leg.points;
  for (let i = 0; i + 1 < p.length; i++) {
    ROAD_SEGS.push({ ax: p[i][0], az: p[i][1], bx: p[i + 1][0], bz: p[i + 1][1], hw: leg.half_width_m, leg: leg.id });
  }
}
function roadDist(x, z) {
  let best = Infinity, bestSeg = null;
  for (const s of ROAD_SEGS) {
    const dx = s.bx - s.ax, dz = s.bz - s.az;
    const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz || 1)));
    const d = Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t));
    if (d < best) { best = d; bestSeg = s; }
  }
  return { d: best, seg: bestSeg };
}
function siteDist(x, z) {
  let best = Infinity;
  for (const s of SITES) best = Math.min(best, Math.hypot(x - s.x, z - s.z) - s.r_falloff);
  return best;
}

/** Water depth at the four tide phases, so "dry" means dry at high water too. */
function depths(x, z) { return [0, 0.25, 0.5, 0.75].map((p) => field.depthAt(x, z, p)); }

/**
 * Is the whole footprint inside the region it belongs to? The region raster is 25 m, so a centre
 * test alone lets a 26 m crater rim spill into the neighbour — which is exactly the M19 failure
 * ("an ONLY-HERE element found in two regions is a straight fail for both").
 */
function containedIn(x, z, reach, ri) {
  if (field.regionIndexAt(x, z) !== ri) return false;
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const px = x + Math.cos(a) * reach, pz = z + Math.sin(a) * reach;
    if (px < 0 || pz < 0 || px >= field.sizeX || pz >= field.sizeZ) return false;
    if (field.regionIndexAt(px, pz) !== ri) return false;
  }
  return true;
}

/** Local ground roughness: landform features on a 30-degree face read as errors, not as places. */
function localSlope(x, z, r) {
  let mx = 0;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    mx = Math.max(mx, field.slopeAt(x + Math.cos(a) * r * 0.6, z + Math.sin(a) * r * 0.6, 8));
  }
  return mx;
}

// ---- placement ---------------------------------------------------------------------------------
const instances = [];
const report = [];

for (const region of REGIONS) {
  const kind = KIND_OF_REGION[region.id];
  if (!kind) throw new Error(`region ${region.id} has no signature kind in signature.js`);
  const K = SIGNATURE_KINDS[kind];
  if (region.only_here.id !== kind) {
    throw new Error(`regions.json says ${region.id}'s ONLY-HERE element is '${region.only_here.id}', `
      + `signature.js says '${kind}'. One place, one name.`);
  }
  const want = region.only_here.instances;
  const ri = indexOf.get(region.id);
  const rnd = streamFor(kind);
  const bb = region.bounds_m;
  const placed = [];
  let tries = 0;
  const MAX_TRIES = 900000;
  // The separation shrinks if the region cannot hold the declared count at full spacing: the
  // COUNT is the contract (regions.json declares it and M19 counts it), the spacing is taste.
  let sep = K.min_sep;

  while (placed.length < want && tries < MAX_TRIES) {
    tries++;
    if (tries % 120000 === 0 && placed.length < want) sep *= 0.72;

    let x, z, rot = rnd() * Math.PI * 2;
    if (K.wants === 'roadside') {
      // Beside the road, on the region's own legs. Pick a segment that lies in this region.
      const s = ROAD_SEGS[Math.floor(rnd() * ROAD_SEGS.length)];
      const t = rnd();
      const cx = s.ax + (s.bx - s.ax) * t, cz = s.az + (s.bz - s.az) * t;
      if (field.regionIndexAt(cx, cz) !== ri) continue;
      const dx = s.bx - s.ax, dz = s.bz - s.az;
      const L = Math.hypot(dx, dz) || 1;
      const side = rnd() < 0.5 ? 1 : -1;
      const off = s.hw + 2.6 + rnd() * 3.0;
      x = cx + (-dz / L) * off * side; z = cz + (dx / L) * off * side;
      rot = Math.atan2(dx, dz);                       // faces along the road
    } else {
      x = bb.x[0] + rnd() * (bb.x[1] - bb.x[0]);
      z = bb.z[0] + rnd() * (bb.z[1] - bb.z[0]);
    }
    if (x < 30 || z < 30 || x > field.sizeX - 30 || z > field.sizeZ - 30) continue;

    const s = 0.82 + rnd() * 0.42;
    const reach = (kind === 'root_arch' ? K.r_base * 2.8 : kind === 'glassed_crater' ? K.r_base * 1.2 : K.r_base) * s;

    if (!containedIn(x, z, Math.max(reach, 26), ri)) continue;
    if (siteDist(x, z) < 40) continue;

    const rdist = roadDist(x, z);
    if (K.wants === 'roadside') {
      if (rdist.d < rdist.seg.hw + 1.6 || rdist.d > rdist.seg.hw + 7.0) continue;
    } else if (rdist.d < rdist.seg.hw * 3.4 + reach + 4) continue;

    const dep = depths(x, z);
    const dryAlways = Math.max(...dep) <= 0.02;
    const wetAlways = Math.min(...dep) >= 0.30;
    if (K.wants === 'dry' && !dryAlways) continue;
    if (K.wants === 'wet' && !wetAlways) continue;
    if (K.wants === 'shore') {
      // Above the waterline at low water, wet at high: the tide line is where a hull is beached
      // and where a dye vat is worked.
      if (!(dep[3] <= 0.05 && Math.max(...dep) >= 0.02)) continue;
      if (field.coastDistAt(x, z) > 260) continue;
    }
    if (K.landform && localSlope(x, z, reach) > (kind === 'rock_flute_spire' ? 34 : 17)) continue;

    let ok = true;
    for (const q of placed) { if (Math.hypot(q.x - x, q.z - z) < sep) { ok = false; break; } }
    if (!ok) continue;
    // Never inside another kind's footprint either.
    for (const q of instances) {
      const qr = SIGNATURE_KINDS[q.kind].r_base * (q.s || 1);
      if (Math.hypot(q.x - x, q.z - z) < qr + reach + 4) { ok = false; break; }
    }
    if (!ok) continue;

    const h = K.h[0] + rnd() * (K.h[1] - K.h[0]);
    const inst = {
      kind, region: region.id,
      x: +x.toFixed(2), z: +z.toFixed(2),
      y: +field.heightAt(x, z).toFixed(3),
      rot: +rot.toFixed(4), s: +s.toFixed(3), h: +h.toFixed(2),
      v: +rnd().toFixed(4),                              // per-instance variation the mesh reads
    };

    if (kind === 'glassed_crater') {
      // Solve the pit so the glassed floor stays above the local water table. A crater that fills
      // is a tarn, and the Stone Wastes' identity is that they are dry.
      const surf = field.waterSurfaceAt(x, z, 0.25);      // the high-tide plane
      const g = inst.y;
      const headroom = surf === null ? 12 : Math.max(0, g - surf - 0.5);
      inst.h = +Math.min(h, headroom).toFixed(2);
      inst.rim = 2.2;
      if (inst.h < 2.2) continue;                        // too shallow to read as a crater
    }
    if (kind === 'swamp_jelly_canopy') {
      inst.hover = +(2.6 + rnd() * 3.4).toFixed(2);       // metres above the water surface
      const surf = field.waterSurfaceAt(x, z, 0.5);
      inst.y = +(surf === null ? inst.y : surf).toFixed(3);
    }

    placed.push(inst);
    instances.push(inst);
  }

  report.push({
    region: region.id, kind, declared: want, placed: placed.length,
    tries, final_separation_m: +sep.toFixed(1),
    landform: !!K.landform, glow: K.glow > 0,
  });
  if (placed.length < want) {
    process.stderr.write(`  WARNING ${region.id}/${kind}: placed ${placed.length} of ${want}\n`);
  }
}

// ---- consistency, before anything is written ----------------------------------------------------
const problems = [];
for (const it of instances) {
  const rid = REGIONS[field.regionIndexAt(it.x, it.z)].id;
  if (rid !== it.region) problems.push(`${it.kind} at ${it.x},${it.z} is in ${rid}, not ${it.region}`);
}
for (const r of report) if (r.placed < 8) problems.push(`${r.region}/${r.kind}: ${r.placed} instances, M19 needs >= 8`);
if (problems.length) { for (const p of problems) process.stderr.write(`FAIL ${p}\n`); process.exit(1); }

const doc = {
  schema: 'elder-souls/signatures@1',
  generator: 'tools/world/build-signatures.mjs',
  note: 'The thirteen ONLY-HERE elements of RI-WLD04 M19, placed. Consumed by game/src/world/field.js '
      + '(heightAt: seven of the thirteen are landform and the player stands on them), '
      + 'game/src/sim/world-collision-signature (solid footprints), game/src/world/province.js '
      + '(meshes and night emission) and game/src/engine.js getSignatures()/getRegionSignature(). '
      + 'Perturb an instance here and the ground, the collision and the frame all move: that is the '
      + 'RI-MTH07 consumption demonstration.',
  counts: report,
  total: instances.length,
  instances,
};
writeFileSync(join(ROOT, 'game/data/world/signatures.json'), JSON.stringify(doc) + '\n');

process.stdout.write(`signatures.json — ${instances.length} instances across ${report.length} regions\n`);
for (const r of report) {
  process.stdout.write(`  ${r.region.padEnd(19)} ${r.kind.padEnd(20)} ${String(r.placed).padStart(4)}/${String(r.declared).padEnd(4)}`
    + ` ${r.landform ? 'landform' : 'prop    '} ${r.glow ? 'glows' : ''}\n`);
}
if (process.argv.includes('--report')) {
  // What the landform actually did to the ground, so the "it changed the silhouette" claim is a
  // number rather than an assertion.
  for (const r of report) {
    if (!r.landform) continue;
    const inst = instances.filter((i) => i.kind === r.kind);
    let mx = 0, mn = 0;
    for (const it of inst) {
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        for (const f of [0.1, 0.35, 0.6, 0.85, 1.05]) {
          const rr = SIGNATURE_KINDS[it.kind].r_base * (it.s || 1) * f * 1.2;
          const v = profile(it.kind, it, Math.cos(a) * rr, Math.sin(a) * rr);
          if (v > mx) mx = v; if (v < mn) mn = v;
        }
      }
    }
    process.stdout.write(`  ${r.kind.padEnd(20)} ground delta ${mn.toFixed(2)} .. +${mx.toFixed(2)} m\n`);
  }
}
