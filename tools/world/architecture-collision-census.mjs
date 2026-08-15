#!/usr/bin/env node
'use strict';
// architecture-collision-census.mjs — HOW MUCH DRAWN ARCHITECTURE IS ABSENT FROM THE COLLISION SET?
//
// WHY THIS FILE EXISTS. `orchestration/status/G1-THE-REAL-OCCLUDER-IS-ARCHITECTURE.json` found the
// player buried under a raised deck in Lilmoth that is not in `plan.buildings` — nearest plan entry
// 13.9 m away — so it never becomes a `settlementSolids()` box, and one absence produced three
// false negatives at once (spring arm `armHit:false`, §D `clip_through:false`, occluder fade never
// firing). That deck was found by accident, by the first person who looked closely. Nobody has ever
// counted how many more there are. This file counts them.
//
// THE TWO DERIVATIONS. `buildSettlementExterior()` draws a settlement; `settlementSolids()` makes
// the collision boxes. `exterior.js`'s own comment says collision is "built from the PLAN and not
// from the scene graph, so it cannot be out of date with what is drawn: both are functions of the
// same `planSettlement()` output". That is true of the BUILDING loop. It is false of everything
// `buildSettlementExterior()` draws that is not a `plan.buildings` entry — the entire
// `settlement-public-realm` group (awnings, canopies, counters, racks, carts, causeways, lamps)
// and the per-building `world-art-exterior` grammar (balconies, piers, skyline pieces). None of
// those is a plan building, so `settlementSolids()` cannot see any of them.
//
// WHAT IS COUNTED, AND WHY THAT DEFINITION. A camera occluder is a drawn surface the camera can be
// UNDER or INSIDE while the arm is at normal length. So the census class that matters is
// OVERHEAD ARCHITECTURE:
//
//     underside (world AABB min.y) >= OVERHEAD_MIN_Y   — a standing body passes beneath it
//     horizontal footprint area    >= OVERHEAD_MIN_AREA — big enough to hide a player
//
// RI-CAM01 §A puts the pivot at 1.55 m and the camera at 1.65 m at pitch 0, so anything whose
// underside clears ~1.3 m is something the rig can end up beneath. Everything else in the scene is
// still enumerated and reported, so the overhead class can be seen as a fraction of the whole
// rather than quoted on its own.
//
// COVERAGE TEST. A drawn mesh counts as PRESENT in the collision set if its world AABB centre lies
// inside one of the oriented boxes `settlementSolids()` returns. Conservative in the direction that
// matters: a mesh this file calls absent has its centre in open air, which is exactly the condition
// under which a sphere cast through it reports no hit.
//
// GROUND. Built with `groundY = () => 0` for every settlement, the same convention
// `tools/render/w1-30-settlement-public-realm.mjs` uses. Both derivations get the same flat ground,
// so the comparison is exact even though the absolute heights are not the world's.
//
// Usage:  node tools/world/architecture-collision-census.mjs [--json] [--settlement lilmoth]
//         [--near x,z --radius 12]      only meshes within `radius` of a world XZ point
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../../game/vendor/three/three.module.js';
import { buildSettlementExterior, planSettlement, settlementSolids, insideBuilding, publicRealmLayout, realmHeights } from '../../game/src/render/exterior.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const list = (p) => fs.readdirSync(path.join(ROOT, p)).filter((x) => x.endsWith('.json')).sort();

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}

export const OVERHEAD_MIN_Y = 1.30;      // m — underside clears a standing body
export const OVERHEAD_MIN_AREA = 0.35;   // m² — big enough to hide a player at 4 m

/** Is world point (x,y,z) inside this oriented `settlementSolids()` box? */
export function insideSolid(s, x, y, z) {
  const yaw = (s.yaw_deg || 0) * Math.PI / 180;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const rx = x - s.c[0], rz = z - s.c[2];
  // The same local frame `sim/collision.js` shapeDistance() case 0 uses, copied not re-derived.
  const lx = rx * cy - rz * sy;
  const lz = rx * sy + rz * cy;
  return Math.abs(lx) <= s.h[0] && Math.abs(lz) <= s.h[2] && Math.abs(y - s.c[1]) <= s.h[1];
}

const interiors = {};
for (const f of list('game/data/world/interiors')) {
  const d = read(`game/data/world/interiors/${f}`);
  const a = Array.isArray(d) ? d : (d.interiors || [d]);
  for (const x of a) interiors[x.id] = x;
}

const near = args.near ? String(args.near).split(',').map(Number) : null;
const nearR = Number(args.radius || 12);

const perSettlement = [];
const belowBoom = [];
let totalMeshes = 0, totalOverhead = 0, totalOverheadAbsent = 0, totalAbsent = 0;

for (const f of list('game/data/world/settlements')) {
  const doc = read(`game/data/world/settlements/${f}`);
  if (args.settlement && doc.id !== String(args.settlement)) continue;
  const plan = planSettlement(doc, interiors);
  const root = new THREE.Group();
  // Non-batched: `province.js` ships `{settlementBatch:true}`, which merges logical pieces into
  // heterogeneous batches. Batching changes draw calls, not geometry — but it destroys the per-piece
  // label this census reports, so the logical graph is used and this deviation is stated rather
  // than hidden.
  // `buildingBatch:false` too: the default merges a building's own pieces into one
  // `building-batch:` mesh whose AABB is the whole shell, which both destroys the piece label and
  // makes a balcony indistinguishable from the wall it hangs off.
  buildSettlementExterior(root, plan, () => 0, { buildingBatch: false });
  root.updateMatrixWorld(true);
  const solids = settlementSolids(plan, plan.pos ? plan.pos[0] : 0, plan.pos ? plan.pos[2] : 0, 1e9, () => 0);

  // DRAW-IDENTITY HASH. The G1 fix moves the public realm's placement arithmetic out of the draw
  // pass and into `publicRealmLayout()`. That refactor is only safe if it draws exactly the same
  // town, and "the gate still passes" is a weaker claim than "every mesh is in the same place". So
  // fold every mesh's world matrix into one number and print it: two builds that agree here are
  // drawing the same settlement, and two that disagree say so in one line.
  let drawHash = 5381;
  root.traverse((m) => {
    if (!m.isMesh) return;
    const e = m.matrixWorld.elements;
    for (let k = 0; k < 16; k++) drawHash = (Math.imul(drawHash, 33) ^ Math.round(e[k] * 1e4)) | 0;
  });

  const rows = [];
  const box = new THREE.Box3();
  root.traverse((m) => {
    if (!m.isMesh || !m.geometry) return;
    box.setFromObject(m);
    if (!Number.isFinite(box.min.x) || box.isEmpty()) return;
    const cx = (box.min.x + box.max.x) / 2, cyy = (box.min.y + box.max.y) / 2, cz = (box.min.z + box.max.z) / 2;
    if (near && Math.hypot(cx - near[0], cz - near[1]) > nearR) return;
    const area = (box.max.x - box.min.x) * (box.max.z - box.min.z);
    const covered = solids.some((s) => insideSolid(s, cx, cyy, cz));
    const overhead = box.min.y >= OVERHEAD_MIN_Y && area >= OVERHEAD_MIN_AREA;
    // REACHABILITY. An overhead piece only occludes a third-person camera if there is outdoor
    // ground beneath it for the body to stand on. A storey floor or a roof underside inside a
    // building's own footprint is not that: the shell walls already stop the body and the camera
    // from getting under it, and the interior is a separate scene. So an absence there is not a
    // camera defect and is not counted as one — it is reported separately instead of being
    // quietly folded into a bigger, more alarming number.
    const insideFootprint = insideBuilding(plan, cx, cz, 0);
    // Kit and shell pieces are frequently unnamed; the identifying string is then on an ancestor
    // group or in `userData`. Walk up rather than reporting 2,000 rows of "(unnamed)".
    let named = m.name || '';
    let ud = m.userData && (m.userData.kit || m.userData.part || m.userData.piece) || '';
    for (let p = m.parent; p && (!named || !ud); p = p.parent) {
      if (!named && p.name) named = p.name;
      if (!ud && p.userData) ud = p.userData.kit || p.userData.part || p.userData.piece || '';
    }
    const ident = m.name || ud || named || '(unnamed)';
    const family = /^world-art-street:/.test(named) ? 'public-realm'
      : /^(kit-elevations|roof|world-art-exterior):/.test(named) ? 'building-grammar'
        : 'building-shell';
    rows.push({
      name: m.name || '(unnamed)',
      group: named || null,
      kit: ud || null,
      label: String(ident).includes(':') ? String(ident).split(':').at(-1) : String(ident),
      c: [+cx.toFixed(2), +cyy.toFixed(2), +cz.toFixed(2)],
      minY: +box.min.y.toFixed(2), maxY: +box.max.y.toFixed(2), area: +area.toFixed(2),
      covered, overhead, family, inside_footprint: insideFootprint,
      reachable: overhead && !insideFootprint,
    });
  });

  const overheadRows = rows.filter((r) => r.overhead);
  const reach = rows.filter((r) => r.reachable);
  const reachAbsent = reach.filter((r) => !r.covered);
  const byLabel = {}, byFamily = {};
  for (const r of reachAbsent) {
    byLabel[r.label] = (byLabel[r.label] || 0) + 1;
    byFamily[r.family] = (byFamily[r.family] || 0) + 1;
  }
  const absent = rows.filter((r) => !r.covered);

  totalMeshes += rows.length;
  totalOverhead += reach.length;
  totalOverheadAbsent += reachAbsent.length;
  totalAbsent += absent.length;

  // THE DRIFT GATE. A canopy that hangs inside the camera boom's swept volume is a canopy the arm
  // will collapse onto — measured at Lilmoth as `armLen` pinned at the 0.90 m floor, which under
  // RI-CAM01 §C fades the player to 0.00 opacity. Zero is the bar and the exit code enforces it,
  // because this is exactly the kind of number that gets quietly re-lowered by a later art pass.
  const layout = publicRealmLayout(plan, () => 0);
  belowBoom.push(...layout.canopies_below_boom.map((id) => `${doc.id}:${id}`));

  perSettlement.push({
    id: doc.id,
    draw_hash: drawHash,
    canopies: layout.canopies.length,
    canopies_below_boom: layout.canopies_below_boom.length,
    min_canopy_clearance_m: layout.canopies.length ? Math.min(...layout.canopies.map((c) => c.clearance_m)) : null,
    plan_buildings: plan.buildings.length,
    collision_shapes: solids.length,
    camera_solids: solids.filter((s) => /-camera-solid$/.test(String(s.id || ''))).length,
    canopy_camera_solids: solids.filter((s) => /:canopy-camera-solid$/.test(String(s.id || ''))).length,
    drawn_meshes: rows.length,
    drawn_absent_from_collision: absent.length,
    overhead_meshes: overheadRows.length,
    reachable_overhead_meshes: reach.length,
    reachable_overhead_absent: reachAbsent.length,
    reachable_overhead_absent_by_family: byFamily,
    reachable_overhead_absent_by_label: Object.fromEntries(Object.entries(byLabel).sort((a, b) => b[1] - a[1])),
    worst_examples: reachAbsent.slice().sort((a, b) => b.area - a.area).slice(0, 8),
    rows: args.rows ? rows : undefined,
  });
}

const report = {
  schema: 'elder-souls/architecture-collision-census@1',
  when: new Date().toISOString(),
  definition: {
    overhead_min_underside_y_m: OVERHEAD_MIN_Y,
    overhead_min_footprint_area_m2: OVERHEAD_MIN_AREA,
    covered: 'world AABB centre inside one settlementSolids() oriented box',
    ground: 'groundY = () => 0 for both derivations',
    graph: 'logical (non-batched) settlement graph',
  },
  totals: {
    settlements: perSettlement.length,
    drawn_meshes: totalMeshes,
    drawn_absent_from_collision: totalAbsent,
    reachable_overhead_meshes: totalOverhead,
    reachable_overhead_absent: totalOverheadAbsent,
    reachable_overhead_coverage_frac: totalOverhead ? +(1 - totalOverheadAbsent / totalOverhead).toFixed(4) : null,
  },
  canopy_gate: {
    heights: realmHeights(),
    canopies_below_boom: belowBoom,
    result: belowBoom.length ? 'RED' : 'GREEN',
  },
  perSettlement,
};
console.log(JSON.stringify(report, null, args.json ? 0 : 1));
if (belowBoom.length) process.exit(1);
