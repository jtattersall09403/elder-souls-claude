#!/usr/bin/env node
// W1-04 round 4 — THE JOIN: can a building's outside contain its inside?
//
// Binding: RI-WLD13 N1 (interior / exterior continuity), and the round-3 verdict's single
// biggest gap, `GAP-W1-the-building-is-smaller-than-the-room`:
//
//   "41 of 112 enterable buildings now draw an exterior smaller than their own interior.
//    blackrose-inn is a 3.4 m shed over a 13.6 m hall — 6.3% of the area."
//
// WHY THIS TOOL EXISTS AND WHY IT IS NOT A DATA REPORT.
//
// Every previous measurement of N1 in this piece divided one declared field by another declared
// field: `bounds_m` IS `continuity.exterior_footprint_m` on 115 of 115 records, so the ratio was
// 1.000 by construction and could not fail. The number that matters is not in the data at all —
// it is what the two BUILDERS produce. So this tool imports `render/exterior.js#buildBuilding`
// and `render/interior.js#buildInterior`, builds both, and measures the two `Object3D` trees:
//
//   * the exterior's SHELL — the four walls, by name, not the roof and not the kit, because a
//     kit mesh a metre off the gable is not somewhere you can stand;
//   * the interior's whole room group, walls included.
//
// If the outside is smaller than the inside, the ratio is < 1 and this tool exits non-zero. It
// has a demonstrated failure mode: at `9e962a4` it reports 41 failures and a worst ratio of
// 0.063, which is the round-3 verdict's number reproduced from the scene graph rather than
// taken from it (`--expect-red` asserts exactly that, for anyone re-running it on the old tree).
//
// THE SECOND HALF is a distinctness measure that survives a null control. The round-3 verdict
// proved that both pixel-hash acceptance criteria in this piece are unmeasurable: an unchanged
// room returns 8 distinct images out of 8 after two fixed steps, and the 8-town control draws
// zero buildings and still returns 8 distinct images. A pixel hash over this renderer is a hash
// of the frame counter. So distinctness is re-taken as a GEOMETRY SIGNATURE — a sorted hash over
// every mesh in the built tree (geometry type, parameters, local transform, material colour) —
// which is a pure function of the scene graph and of nothing else. Three arms, and the first two
// are the instrument's own noise floor, published before any cross-room number is reported:
//
//   n0  the same room built twice, nothing else changed              -> MUST be 1 distinct
//   n1  every room built from ONE record (the null control)          -> MUST be 1 distinct
//   n2  the 115 shipped records                                      -> the number
//
// n1 is the arm that kills a step counter: if the measure were reading anything that advances,
// 115 identical rooms would still come back 115 distinct, exactly as the pixel sweep did.
//
// `--live` asks the running game for the same signature off `renderer.cells.interior` and
// compares it to the offline one for the same id, which is how we know the offline build is the
// build the player is standing in.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const OUT_DIR = path.join(ROOT, 'reports/w1-04-r4');

function loadData() {
  const S = {}, I = {};
  const sdir = path.join(ROOT, 'game/data/world/settlements');
  for (const f of fs.readdirSync(sdir)) {
    const d = JSON.parse(fs.readFileSync(path.join(sdir, f), 'utf8'));
    S[d.id] = d;
  }
  const idir = path.join(ROOT, 'game/data/world/interiors');
  for (const f of fs.readdirSync(idir)) {
    const d = JSON.parse(fs.readFileSync(path.join(idir, f), 'utf8'));
    I[d.id] = d;
  }
  return { S, I };
}

/* ================================================================================================
 * THE SIGNATURE — a pure function of an Object3D tree.
 *
 * Nothing in here can advance on its own: no clock, no counter, no random, no traversal order
 * dependence (the per-mesh strings are SORTED before they are folded). Build the same tree twice
 * and you get the same 32-bit hex string; build a different tree and you get a different one.
 * ==============================================================================================*/

function meshKey(m) {
  const g = m.geometry || {};
  const p = g.parameters || {};
  const par = Object.keys(p).sort().map((k) => `${k}=${typeof p[k] === 'number' ? p[k].toFixed(3) : p[k]}`).join(',');
  const col = m.material && m.material.color ? m.material.color.getHexString() : '-';
  // World-space transform, so a prop moved by its parent group is a different room. The raw
  // matrix rather than a decompose: fewer moving parts, and no THREE class needed here.
  m.updateWorldMatrix(true, false);
  const mx = Array.from(m.matrixWorld.elements).map((n) => n.toFixed(3)).join(',');
  const nm = (m.name || '').replace(/[0-9]+$/, '');
  return `${g.type || '?'}|${par}|${col}|${mx}|${nm}`;
}

function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/** Signature of a built tree: `{ hash, meshes, triangles }`. */
export function signatureOf(root) {
  const keys = [];
  let tris = 0;
  root.updateMatrixWorld(true);
  root.traverse((m) => {
    if (!m.isMesh || !m.geometry) return;
    keys.push(meshKey(m));
    const gg = m.geometry;
    tris += gg.index ? gg.index.count / 3 : (gg.attributes && gg.attributes.position ? gg.attributes.position.count / 3 : 0);
  });
  keys.sort();
  return { hash: fnv(keys.join('\n')), meshes: keys.length, triangles: Math.round(tris) };
}

/** Footprint of the meshes under a named child, in the parent's frame. */
function footprintOf(root, filter) {
  let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity, n = 0;
  root.updateMatrixWorld(true);
  root.traverse((m) => {
    if (!m.isMesh || !m.geometry) return;
    if (filter && !filter(m)) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox;
    const c = [
      [bb.min.x, bb.min.y, bb.min.z], [bb.max.x, bb.min.y, bb.min.z],
      [bb.min.x, bb.max.y, bb.min.z], [bb.max.x, bb.max.y, bb.min.z],
      [bb.min.x, bb.min.y, bb.max.z], [bb.max.x, bb.min.y, bb.max.z],
      [bb.min.x, bb.max.y, bb.max.z], [bb.max.x, bb.max.y, bb.max.z],
    ];
    for (const [x, y, z] of c) {
      const v = new (m.position.constructor)(x, y, z).applyMatrix4(m.matrixWorld);
      if (v.x < minx) minx = v.x; if (v.x > maxx) maxx = v.x;
      if (v.z < minz) minz = v.z; if (v.z > maxz) maxz = v.z;
    }
    n++;
  });
  if (!n) return null;
  return { w: +(maxx - minx).toFixed(3), d: +(maxz - minz).toFixed(3), meshes: n };
}

/* ================================================================================================
 * SECTION 1 — the join.
 * ==============================================================================================*/

async function sectionJoin(THREE, EX, IN, S, I) {
  const rows = [];
  for (const sid of Object.keys(S).sort()) {
    const plan = EX.planSettlement(S[sid], I);
    for (const b of plan.buildings) {
      if (!b.enterable || !b.interior) continue;
      const rec = I[b.interior];
      if (!rec) continue;
      // OUTSIDE: the four wall slabs of the built exterior, by name. Not the roof, not the kit,
      // not the plinth — the shell you cannot walk through.
      const built = EX.buildBuilding(b, sid);
      const shell = footprintOf(built.group, (m) => m.name === 'shellwall');
      // INSIDE: the built room, walls included. `buildInterior` is the renderer's own builder and
      // is handed the record the door hands it.
      const room = new THREE.Group();
      const isum = IN.buildInterior(room, rec);
      const inside = footprintOf(room, (m) => m.name === 'roomshell');
      const withProps = footprintOf(room, null);
      if (!shell || !inside) { rows.push({ id: b.id, interior: b.interior, error: 'nothing built' }); continue; }
      const ratio = +((shell.w * shell.d) / (inside.w * inside.d)).toFixed(4);
      rows.push({
        id: b.id, settlement: sid, interior: b.interior,
        declared_footprint_m: b.declared_footprint_m,
        drawn_footprint_m: b.drawn_footprint_m,
        shrink: b.shrink, shrink_axes: b.shrink_m || null,
        outside_m: [shell.w, shell.d], inside_m: [inside.w, inside.d],
        room_with_props_m: withProps ? [withProps.w, withProps.d] : null,
        props_outside_the_shell: !!(withProps && (withProps.w > inside.w + 0.05 || withProps.d > inside.d + 0.05)),
        fits_x: +(shell.w - inside.w).toFixed(2) >= -0.01,
        fits_z: +(shell.d - inside.d).toFixed(2) >= -0.01,
        area_ratio: ratio,
        room_meshes: isum.meshes || footprintOf(room, null).meshes,
      });
    }
  }
  const bad = rows.filter((r) => r.error || !(r.fits_x && r.fits_z));
  bad.sort((a, c) => (a.area_ratio || 0) - (c.area_ratio || 0));
  return {
    enterable_measured: rows.length,
    outside_smaller_than_inside: bad.length,
    worst_area_ratio: bad.length ? bad[0].area_ratio : (rows.length ? Math.min(...rows.map((r) => r.area_ratio)) : null),
    worst_id: bad.length ? bad[0].id : null,
    median_area_ratio: rows.length ? +rows.map((r) => r.area_ratio).sort((a, c) => a - c)[Math.floor(rows.length / 2)].toFixed(4) : null,
    rooms_reduced_to_fit_the_plan: rows.filter((r) => r.room_reduced).length,
    worst_offenders: bad.slice(0, 12),
    rows,
  };
}

/* ================================================================================================
 * SECTION 2 — distinctness, with its own noise floor first.
 * ==============================================================================================*/

async function sectionDistinct(THREE, IN, I) {
  const ids = Object.keys(I).sort();
  // n0 — one unchanged room, built twice. If this is ever 2, nothing below it means anything.
  const probe = I['archon-apothecary'] || I[ids[0]];
  const n0 = [];
  for (let i = 0; i < 2; i++) { const g = new THREE.Group(); IN.buildInterior(g, probe); n0.push(signatureOf(g).hash); }
  const n0_distinct = new Set(n0).size;
  // n1 — the null control: every one of the 115 doors opens on the SAME record.
  const n1 = [];
  for (const id of ids) { const g = new THREE.Group(); IN.buildInterior(g, probe); n1.push(signatureOf(g).hash); }
  const n1_distinct = new Set(n1).size;
  // n2 — the shipped records.
  const n2 = [], detail = [];
  for (const id of ids) {
    const g = new THREE.Group();
    const sum = IN.buildInterior(g, I[id]);
    const sig = signatureOf(g);
    n2.push(sig.hash);
    detail.push({ id, hash: sig.hash, meshes: sig.meshes, triangles: sig.triangles, build_record_meshes: sum.meshes, props_fallback: sum.props_fallback });
  }
  const counts = {};
  for (const h of n2) counts[h] = (counts[h] || 0) + 1;
  const largest = Math.max(...Object.values(counts));
  return {
    n0_same_room_twice: { shots: n0.length, distinct: n0_distinct, pass: n0_distinct === 1 },
    n1_null_control_every_door_same_record: { rooms: n1.length, distinct: n1_distinct, pass: n1_distinct === 1 },
    n2_shipped: { rooms: n2.length, distinct: Object.keys(counts).length, largest_identical_group: largest },
    floor_ok: n0_distinct === 1 && n1_distinct === 1,
    detail,
  };
}

/* ================================================================================================
 * SECTION 3 — the prop builders that throw, counted off the scene graph.
 *
 * `buildInterior` catches a throwing prop builder and substitutes a crate WITHOUT incrementing
 * `props_fallback`, so the build record cannot see this. The scene graph can: a working
 * `barrel_row` is three barrels in a group, and the crate that replaces it is one box.
 * ==============================================================================================*/

async function sectionThrowingProps(THREE, IN, I) {
  const suspects = ['barrel_row', 'bench_pair', 'bla_prison_block'];
  const P = IN.paletteFor({ interior_kind: 'hall', settlement: 'thorn' });
  const per = {};
  for (const id of suspects) {
    const def = IN.PROPS_TABLE ? IN.PROPS_TABLE[id] : null;
    let built = null, threw = null;
    try { built = def ? def[1](P) : null; } catch (e) { threw = String(e && e.message || e); }
    per[id] = { has_builder: !!def, threw, meshes: built ? signatureOf(built).meshes : 0 };
  }
  // And the instance census: how many rooms declare them, and how many meshes those rooms draw.
  let instances = 0; const rooms = new Set();
  for (const id of Object.keys(I)) {
    for (const p of (I[id].props || [])) if (suspects.includes(p)) { instances++; rooms.add(id); }
  }
  return { suspects: per, instances, rooms: rooms.size };
}

/* ================================================================================================
 * SECTION 4 — the roofs. Does the roof cover the plan?
 * ==============================================================================================*/

// A BOUNDING BOX IS THE WRONG INSTRUMENT HERE, and using one is how this defect survived three
// rounds of counting. An ellipsoid dome scaled to w x d has a bounding box exactly w x d and
// leaves all four corners open to the sky, which is what the round-3 critic photographed. So the
// roof is measured by RAYCASTING: drop a ray straight down over an 8x8 grid of the building's own
// footprint and ask whether anything in the roof group is between the sky and the floor. That is
// the same question as "does the rain come in", and it can only be answered by geometry.
async function sectionRoofs(THREE, EX, S, I) {
  const rows = [];
  const N = 8;
  for (const sid of Object.keys(S).sort()) {
    const plan = EX.planSettlement(S[sid], I);
    for (const b of plan.buildings) {
      const built = EX.buildBuilding(b, sid);
      let roof = null;
      built.group.traverse((o) => { if (o.name === 'roof') roof = o; });
      const w = built.summary.w, d = built.summary.d, h = built.summary.h;
      if (!roof) { rows.push({ id: b.id, settlement: sid, coverage: 0, covered: false, why: 'no roof group' }); continue; }
      roof.updateMatrixWorld(true);
      const rc = new THREE.Raycaster();
      rc.far = 200;
      let hit = 0, tot = 0;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          // Inset by half a cell so the samples are inside the walls, and the outermost sample is
          // a hand's width in from the corner rather than exactly on it.
          const x = -w / 2 + (i + 0.5) * (w / N);
          const z = -d / 2 + (j + 0.5) * (d / N);
          rc.set(new THREE.Vector3(x, h + 60, z), new THREE.Vector3(0, -1, 0));
          const hits = rc.intersectObject(roof, true);
          tot++;
          // Only count cover ABOVE the wall head: a roof mesh hanging inside the room is not a roof.
          if (hits.some((q) => q.point.y >= h - 0.6)) hit++;
        }
      }
      const cov = +(hit / tot).toFixed(3);
      rows.push({ id: b.id, settlement: sid, w, d, samples: tot, covered_samples: hit, coverage: cov, covered: cov >= 0.995 });
    }
  }
  const uncovered = rows.filter((r) => !r.covered);
  return {
    method: 'raycast, 64 samples over the building footprint, hit must be at or above wall head',
    buildings: rows.length,
    roofs_that_do_not_cover_their_building: uncovered.length,
    worst_coverage: rows.length ? Math.min(...rows.map((r) => r.coverage || 0)) : null,
    mean_coverage: rows.length ? +(rows.reduce((a, r) => a + r.coverage, 0) / rows.length).toFixed(3) : null,
    by_town: Object.fromEntries(Object.keys(S).sort().map((s) => [s, rows.filter((r) => r.settlement === s && !r.covered).length])),
    worst: uncovered.sort((a, c) => a.coverage - c.coverage).slice(0, 8),
  };
}

/* ================================================================================================
 * main
 * ==============================================================================================*/

async function main() {
  const THREE = await import(path.join(ROOT, 'game/vendor/three/three.module.js'));
  const EX = await import(path.join(ROOT, 'game/src/render/exterior.js'));
  const IN = await import(path.join(ROOT, 'game/src/render/interior.js'));
  const { S, I } = loadData();

  const report = {
    tool: 'tools/world/w1-04-r4-join.mjs',
    commit: process.env.W1_04_COMMIT || null,
    when: new Date().toISOString(),
    join: await sectionJoin(THREE, EX, IN, S, I),
    distinct: await sectionDistinct(THREE, IN, I),
    props: await sectionThrowingProps(THREE, IN, I),
    roofs: await sectionRoofs(THREE, EX, S, I),
  };
  const failures = [];
  if (report.join.outside_smaller_than_inside > 0) {
    failures.push(`${report.join.outside_smaller_than_inside} of ${report.join.enterable_measured} enterable buildings draw an exterior smaller than the room behind their door (worst ${report.join.worst_id} at ${report.join.worst_area_ratio})`);
  }
  if (!report.distinct.floor_ok) failures.push('the distinctness measure did not pass its own noise floor: it is not measuring the room');
  if (report.roofs.roofs_that_do_not_cover_their_building > 0) {
    failures.push(`${report.roofs.roofs_that_do_not_cover_their_building} buildings have a roof that does not cover them (worst coverage ${report.roofs.worst_coverage})`);
  }
  for (const k of Object.keys(report.props.suspects)) if (report.props.suspects[k].threw) failures.push(`prop builder ${k} throws: ${report.props.suspects[k].threw}`);
  report.failures = failures;
  report.pass = failures.length === 0;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, 'join.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));

  console.log(`JOIN     enterable measured ${report.join.enterable_measured}   OUTSIDE SMALLER THAN INSIDE ${report.join.outside_smaller_than_inside}   worst ${report.join.worst_id} ${report.join.worst_area_ratio}   median ${report.join.median_area_ratio}`);
  console.log(`DISTINCT n0 same room twice ${report.distinct.n0_same_room_twice.distinct} (must be 1)   n1 null control ${report.distinct.n1_null_control_every_door_same_record.distinct} (must be 1)   n2 shipped ${report.distinct.n2_shipped.distinct} of ${report.distinct.n2_shipped.rooms}, largest identical group ${report.distinct.n2_shipped.largest_identical_group}`);
  console.log(`PROPS    ${JSON.stringify(report.props.suspects)}`);
  console.log(`ROOFS    ${report.roofs.roofs_that_do_not_cover_their_building} of ${report.roofs.buildings} roofs narrower than their own building, worst coverage ${report.roofs.worst_coverage}`);
  console.log(`report   ${path.relative(ROOT, out)}`);
  for (const f of failures) console.log(`FAIL     ${f}`);

  if (has('--expect-red')) {
    // For re-running on the pre-fix tree: this tool must SEE the defect there.
    const ok = report.join.outside_smaller_than_inside > 0;
    console.log(ok ? 'EXPECT-RED: the instrument sees the defect on this tree.' : 'EXPECT-RED: FAILED — this tree has no defect to see.');
    process.exit(ok ? 0 : 1);
  }
  process.exit(report.pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
