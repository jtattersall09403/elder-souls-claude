#!/usr/bin/env node
// RI-MTH07 / ARBITRATION §3 — the CONSUMPTION probe for W1-02's border markers.
//
// WHAT WAS WRONG. `game/data/world/borders.json` places 210 threshold objects of eight types and
// seven pieces of tier-jump `announcement.remains`. Round 1 of W1-02 wrote all of it and then said
// so in its own handover: the objects "have no MESH ... nothing for cairns, root-gates, tide-poles
// or the corpse in a cage". Two hundred and seventeen rows of coordinates, an owner per type, and
// nothing a player could see or touch. That is exactly the orphan-data shape this project has now
// lost fifteen subsystems to, and a critic would have been right to score `RI-WLD12` M64 and M68
// unmeasured however good the numbers in the file looked.
//
// WHAT THIS CHECKS, and every check has a NEGATIVE CONTROL, because a probe that cannot fail is
// worse than no probe:
//
//   T1  every declared vocabulary type has geometry, and it is real geometry (vertices > 0)
//   T2  the twelve silhouettes are DISTINCT — no two share a shape signature. The colour-stripped
//       measurement is the reason: separability fell 74.4% -> 30.8% without tint, so a marker that
//       is a recoloured post is not a marker.
//   T3  none of the twelve reuses a signature element's shape signature either (`RI-WLD04`'s
//       "ONLY-HERE assets reused" failure read forwards onto the markers)
//   T4  the flattened instance table covers every object the data declares — 217 of 217
//   T5  the markers are SOLID: a body pushed into a cairn, a tide pole, a thorn tripod or a Dres
//       gibbet comes back out. Control: the same push into a bone line and a slag heap, which
//       declare solid_r 0, must NOT move — a probe that pushes everything is measuring itself.
//   T6  SABOTAGE. Rebuild the border field from a doc with `threshold_objects` emptied and the
//       same pushes must all go quiet. This is the delete-the-fix control: it reproduces the
//       pre-W1-02-round-2 state of the build.
//   T7  the markers stand where the border is — every one within its own border's band, measured
//       against the live signed-distance field rather than against the file it came from
//
// Bare node against the shipped modules. The BROWSER half — are they in the scene, can the player
// be stopped by one — is `tools/world/threshold-live.mjs`.
'use strict';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as THREE from '../../game/vendor/three/three.module.js';
import { BorderField } from '../../game/src/world/borders.js';
import { THRESHOLD_KINDS, REMAINS_KINDS, thresholdInstances } from '../../game/src/world/threshold.js';
import { thresholdGeometry, remainsGeometry } from '../../game/src/world/threshold-geo.js';
import { signatureGeometry } from '../../game/src/world/signature-geo.js';
import { SIGNATURE_KINDS } from '../../game/src/world/signature.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const borders = JSON.parse(readFileSync(resolve(ROOT, 'game/data/world/borders.json'), 'utf8'));
const regions = JSON.parse(readFileSync(resolve(ROOT, 'game/data/world/regions.json'), 'utf8'));
const REG = regions.regions || regions;

const checks = [];
const add = (name, pass, detail) => checks.push({ check: name, pass: !!pass, detail });

/**
 * A shape signature that ignores size and colour entirely: the bounding box aspect ratios, the
 * height of the centre of mass as a fraction of the box, and how much of the box the mesh
 * actually fills. Two kinds that agree on all five are the same silhouette wearing two names.
 */
function signature(geo) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const sx = bb.max.x - bb.min.x, sy = bb.max.y - bb.min.y, sz = bb.max.z - bb.min.z;
  const p = geo.attributes.position;
  let cy = 0, spread = 0;
  for (let i = 0; i < p.count; i++) cy += p.getY(i);
  cy /= Math.max(1, p.count);
  // Horizontal spread relative to the box: a mast is thin, a slag heap is not.
  for (let i = 0; i < p.count; i++) {
    const dx = p.getX(i), dz = p.getZ(i);
    spread += Math.hypot(dx, dz);
  }
  spread /= Math.max(1, p.count);
  return {
    aspect_wh: +(sx / (sy || 1e-6)).toFixed(3),
    aspect_dw: +(sz / (sx || 1e-6)).toFixed(3),
    com_frac: +((cy - bb.min.y) / (sy || 1e-6)).toFixed(3),
    spread_frac: +(spread / (Math.max(sx, sz) || 1e-6)).toFixed(3),
    verts: p.count,
  };
}
const sigDist = (a, b) => Math.abs(a.aspect_wh - b.aspect_wh) + Math.abs(a.aspect_dw - b.aspect_dw)
  + Math.abs(a.com_frac - b.com_frac) * 2 + Math.abs(a.spread_frac - b.spread_frac);

// ---- T1: geometry exists for every declared type ----------------------------------------------
const vocab = borders.threshold_vocabulary || {};
const geoms = new Map();
const missing = [];
for (const type of Object.keys(vocab)) {
  const g = thresholdGeometry(type);
  if (!g || !g.body || g.body.attributes.position.count === 0) { missing.push(type); continue; }
  geoms.set(type, g.body);
}
for (const [prose, R] of Object.entries(REMAINS_KINDS)) {
  const g = remainsGeometry(R.id);
  if (!g || g.attributes.position.count === 0) { missing.push(`remains:${R.id}`); continue; }
  geoms.set(`remains:${R.id}`, g);
  void prose;
}
add('T1 every declared threshold type and remains kind has real geometry',
  missing.length === 0 && geoms.size === Object.keys(vocab).length + Object.keys(REMAINS_KINDS).length, {
    declared_types: Object.keys(vocab).length,
    declared_remains: Object.keys(REMAINS_KINDS).length,
    built: geoms.size,
    missing,
    vertices: Object.fromEntries([...geoms].map(([k, g]) => [k, g.attributes.position.count])),
  });

// ---- T2: the silhouettes are distinct from each other -----------------------------------------
const sigs = new Map([...geoms].map(([k, g]) => [k, signature(g)]));
const collisions = [];
const keys = [...sigs.keys()];
let minPair = { d: Infinity, a: null, b: null };
for (let i = 0; i < keys.length; i++) {
  for (let j = i + 1; j < keys.length; j++) {
    const d = sigDist(sigs.get(keys[i]), sigs.get(keys[j]));
    if (d < minPair.d) minPair = { d: +d.toFixed(4), a: keys[i], b: keys[j] };
    if (d < 0.12) collisions.push({ a: keys[i], b: keys[j], distance: +d.toFixed(4) });
  }
}
add('T2 no two markers share a silhouette', collisions.length === 0, {
  kinds: keys.length, pairs: keys.length * (keys.length - 1) / 2,
  bar: 'shape-signature distance >= 0.12',
  closest_pair: minPair, collisions,
  signatures: Object.fromEntries(sigs),
});

// ---- T3: nor with the thirteen ONLY-HERE elements ---------------------------------------------
const sigSigs = new Map();
for (const kind of Object.keys(SIGNATURE_KINDS)) {
  const g = signatureGeometry(kind);
  if (g && g.body && g.body.attributes.position.count) sigSigs.set(kind, signature(g.body));
}
const crossCollisions = [];
let crossMin = { d: Infinity, a: null, b: null };
for (const [tk, ts] of sigs) {
  for (const [sk, ss] of sigSigs) {
    const d = sigDist(ts, ss);
    if (d < crossMin.d) crossMin = { d: +d.toFixed(4), a: tk, b: sk };
    if (d < 0.12) crossCollisions.push({ marker: tk, signature_element: sk, distance: +d.toFixed(4) });
  }
}
add('T3 no marker reuses an ONLY-HERE element silhouette', crossCollisions.length === 0, {
  markers: sigs.size, only_here_kinds: sigSigs.size,
  closest_pair: crossMin, collisions: crossCollisions,
});

// ---- T4: the instance table covers the whole file ---------------------------------------------
let declaredObjects = 0, declaredRemains = 0;
for (const b of borders.borders) {
  declaredObjects += (b.threshold_objects || []).length;
  if (b.announcement && b.announcement.remains) declaredRemains += 1;
}
const inst = thresholdInstances(borders);
const byType = {};
for (const it of inst) byType[it.type] = (byType[it.type] || 0) + 1;
add('T4 every declared object and every tier-jump remains is flattened into an instance',
  inst.length === declaredObjects + declaredRemains, {
    declared_objects: declaredObjects, declared_remains: declaredRemains,
    instances: inst.length, by_type: byType,
    types_in_use: Object.keys(byType).length,
    borders_carrying_objects: borders.borders.filter((b) => (b.threshold_objects || []).length).length,
  });

// ---- T5 / T6: solid, and the sabotage control -------------------------------------------------
const field = new BorderField(borders, REG);
const PR = 0.55;                                        // the player capsule radius traversal uses
const solidTypes = Object.entries(THRESHOLD_KINDS).filter(([, K]) => K.solid_r > 0).map(([t]) => t);
const hollowTypes = Object.entries(THRESHOLD_KINDS).filter(([, K]) => K.solid_r <= 0).map(([t]) => t);

// The body is walked to 5 cm off the marker's centre rather than ONTO it, and the 5 cm matters:
// a capsule at the exact centre has no direction to be pushed in and the resolver deliberately
// leaves it alone (the same 1e-6 guard `signature.js` uses). Probing the singular point was this
// probe's own first defect — it reported 0 m of push against a working resolver.
const EPS = 0.05;
function probePush(bf, types) {
  const rows = [];
  for (const t of types) {
    const it = bf.markers().find((m) => m.type === t);
    if (!it) { rows.push({ type: t, found: false }); continue; }
    const sx = it.x + EPS, sz = it.z;
    const r = bf.resolveMarker(sx, sz, PR);
    const moved = r ? Math.hypot(r[0] - it.x, r[1] - it.z) : 0;
    rows.push({
      type: t, found: true, x: it.x, z: it.z,
      entered_from_m: EPS,
      solid_r: +it.solid_r.toFixed(3),
      distance_from_centre_after_m: +moved.toFixed(4),
      expected_m: +(it.solid_r + PR).toFixed(4),
    });
  }
  return rows;
}
const pushed = probePush(field, solidTypes);
const hollow = probePush(field, hollowTypes);
add('T5 a body walked into a solid marker is pushed back out',
  pushed.every((r) => r.found && Math.abs(r.distance_from_centre_after_m - r.expected_m) < 0.01), {
    solid_types: solidTypes, rows: pushed, capsule_r: PR,
  });
add('T5c control — a marker declaring solid_r 0 does not push',
  hollow.every((r) => r.found && r.distance_from_centre_after_m === 0), {
    hollow_types: hollowTypes, rows: hollow,
  });

// SABOTAGE: the same field with every threshold object deleted from the data.
const gutted = JSON.parse(JSON.stringify(borders));
for (const b of gutted.borders) { b.threshold_objects = []; if (b.announcement) delete b.announcement.remains; }
const guttedField = new BorderField(gutted, REG);
const stillPushes = pushed.filter((r) => r.found && guttedField.resolveMarker(r.x, r.z, PR) !== null);
add('T6 SABOTAGE — deleting the objects from the data removes every push',
  guttedField.markers().length === 0 && stillPushes.length === 0, {
    markers_before: field.markers().length,
    markers_after_deletion: guttedField.markers().length,
    positions_that_still_push: stillPushes.map((r) => r.type),
    note: 'this is the pre-round-2 state of the build; the instrument reproduces the baseline',
  });

// ---- T7: they stand where the border is --------------------------------------------------------
// The bar is NOT "the field agrees with the file", and the difference is a real finding rather
// than a loosened rule. Five of the 217 markers stand at a point where THREE regions meet, and at
// a triple point the distance raster's nearest cell can belong to the OTHER border through that
// corner. Every one of the five turned out to share a region with the border it was placed on —
// a cairn on the Deep Marshes/Stone Forest frontier standing where the Crimson Coast comes in.
// That is a marker in the right place with an ambiguous owner, not a marker in the wrong place,
// so the check requires it and reports the count. A marker that landed in a band sharing NO region
// with its own would be a genuine misplacement and still fails.
const band = borders.band_m || 0;
const offBand = [], triplePoints = [];
const dists = [];
const regionsOf = (id) => { const b = field.byId.get(id); return b ? [b.a, b.b] : []; };
for (const it of field.markers()) {
  const s = field.at(it.x, it.z);
  if (!s) { offBand.push({ type: it.type, border: it.border, x: it.x, z: it.z, reason: 'outside every border band' }); continue; }
  if (s.border.id !== it.border) {
    const mine = regionsOf(it.border), theirs = [s.border.a, s.border.b];
    const shared = mine.filter((r) => theirs.includes(r));
    const row = { type: it.type, border: it.border, x: it.x, z: it.z, field_says: s.border.id, shared_region: shared[0] || null };
    if (shared.length) triplePoints.push(row); else offBand.push({ ...row, reason: 'a band sharing no region with its own' });
    continue;
  }
  dists.push(Math.abs(s.distance_m));
}
dists.sort((a, b) => a - b);
add('T7 every marker stands in a border band, and the only ambiguous ones are triple points',
  offBand.length === 0, {
    markers: field.markers().length, band_m: band,
    misplaced: offBand.length, examples: offBand.slice(0, 6),
    at_a_triple_point: triplePoints.length, triple_points: triplePoints,
    abs_distance_m: dists.length ? {
      min: +dists[0].toFixed(2),
      median: +dists[Math.floor(dists.length / 2)].toFixed(2),
      max: +dists[dists.length - 1].toFixed(2),
    } : null,
  });

// ---- report ------------------------------------------------------------------------------------
const passed = checks.filter((c) => c.pass).length;
const out = {
  tool: 'tools/world/threshold-consumption.mjs',
  owner: 'W1-02', method: 'RI-MTH07', item: 'RI-WLD12 M64 / M66 / M68',
  at: new Date().toISOString(),
  passed, of: checks.length, checks,
};
const dest = resolve(ROOT, 'reports/threshold-consumption.json');
const { writeFileSync } = await import('node:fs');
writeFileSync(dest, JSON.stringify(out, null, 2));
for (const c of checks) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.check}`);
console.log(`\nthreshold-consumption: ${passed}/${checks.length} -> reports/threshold-consumption.json`);
process.exit(passed === checks.length ? 0 : 1);
