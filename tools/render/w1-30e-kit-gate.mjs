#!/usr/bin/env node
// W1-30E — the offline gates for the settlement kit, each with a null control.
//
//   node tools/render/w1-30e-kit-gate.mjs            # every gate, every control
//   node tools/render/w1-30e-kit-gate.mjs --json     # machine-readable only
//
// WHAT THIS TOOL CAN AND CANNOT DECIDE, stated first because `W1-30-EVIDENCE.md` is blunt about
// it: **statistics can fail a build and can never pass one.** Everything measured here is
// geometry, in Node, with no renderer. It can prove that eight settlements are built from
// different parts in different arrangements; it cannot prove that a person looking at a street
// shot can tell them apart. The premise every arm of this tool shares — and therefore the premise
// none of them can falsify — is **that geometric separation reaches pixels**. `HAZARDS.md` §0
// calls that shape by name. The instrument that falsifies it is the critic's child-scoped Deck
// run and the naive attribution packs, and no number below is a substitute for one.
//
// Every gate carries a NULL CONTROL that is the plausible wrong answer rather than the trivial
// one, and every control runs through the SAME code path with an option flipped, not a copy:
//
//   `kit:false`      the five hand-rolled facade blocks that were here before — un-bevelled,
//                    un-trimmed, no `esCurvature`. This is what the build looked like on
//                    2026-08-14 and it is a real, complete, shippable settlement.
//   `oneGrammar`     all eight settlements built with Gideon's grammar.
//   `oneVariant`     per-building variation frozen: one storey rule, one roof rise.
//   `flatRoof`       one roof profile for every building, no skyline features.
//   `allImperial`    every settlement ordered.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../../game/vendor/three/three.module.js';
import { planSettlement, buildSettlementExterior, buildBuilding, settlementApproach, setKitChamfer, assignVariantSalts } from '../../game/src/render/exterior.js';
import { knownKits, GRAMMARS, kitCensus } from '../../game/src/render/lib/kits.js';

const TOWNS = Object.keys(GRAMMARS).sort();
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const round = (v, n = 4) => (Number.isFinite(v) ? +v.toFixed(n) : null);

function loadPlan(town) {
  const rec = rd(`game/data/world/settlements/${town}.json`);
  const interiors = {};
  for (const b of rec.buildings) if (b.interior) {
    const p = `game/data/world/interiors/${b.interior}.json`;
    if (fs.existsSync(p)) interiors[b.interior] = rd(p);
  }
  return { rec, plan: planSettlement(rec, interiors, {}) };
}

/* ---------------------------------------------------------------------------------------------
 * Gate 1 — kit economy.
 * ------------------------------------------------------------------------------------------ */

function buildTown(town, opts) {
  const { plan } = loadPlan(town);
  const root = new THREE.Group();
  const summary = buildSettlementExterior(root, plan, () => 0, opts);
  return { plan, root, summary };
}

function economy(opts) {
  const per = {};
  let bypass = 0, kitMeshes = 0, tris = 0;
  const parts = new Set();
  for (const town of TOWNS) {
    const { root } = buildTown(town, { ...opts, settlementBatch: true });
    const c = kitCensus(root);
    per[town] = c;
    bypass += c.bypass; kitMeshes += c.kitMeshes; tris += c.triangles;
    for (const k of Object.keys(c.parts)) parts.add(k);
  }
  return { per, bypass, kitMeshes, triangles: tris, distinctParts: [...parts].filter(p => p !== 'batch').sort() };
}

/**
 * WHERE THE BYPASS ACTUALLY IS. The plan's row says *"zero BUILDING meshes without a `kitId`"*, so
 * a single settlement-wide number hides the answer. Split it four ways: the buildings, the public
 * realm (streets, courts, causeways — item 6 of the plan and not yet kit-built), the icosahedral
 * masses the kit deliberately has no part for, and the half-tori this file builds directly.
 */
function bypassComposition(opts) {
  const out = {};
  for (const town of TOWNS) {
    const { root } = buildTown(town, { ...opts, settlementBatch: false, buildingBatch: false });
    const c = { building: 0, publicRealm: 0, blob: 0, torus: 0, total: 0 };
    root.traverse((o) => {
      if (!o.isMesh || o.userData.kitId || o.userData.kitIds) return;
      c.total++;
      const key = o.geometry?.userData?.w130BatchKey || '';
      const isBlob = key.startsWith('ico:') || !o.geometry?.index === false;
      let p = o.parent, realm = false;
      for (let i = 0; p && i < 6; i++, p = p.parent) if (p.name?.startsWith('settlement-public-realm')) { realm = true; break; }
      if (realm) c.publicRealm++; else c.building++;
      if (key.startsWith('ico:')) c.blob++;
      else if (o.geometry?.type === 'TorusGeometry' || o.geometry?.index) c.torus++;
      void isBlob;
    });
    out[town] = c;
  }
  out.total = TOWNS.reduce((a, t) => ({
    building: a.building + out[t].building, publicRealm: a.publicRealm + out[t].publicRealm,
    blob: a.blob + out[t].blob, torus: a.torus + out[t].torus, total: a.total + out[t].total,
  }), { building: 0, publicRealm: 0, blob: 0, torus: 0, total: 0 });
  return out;
}

/* ---------------------------------------------------------------------------------------------
 * Gate 2 — variation within a street. Silhouette hashes, and the nearest-neighbour pairs that
 * share one. Adjacency is the plan's own geometry: a building and the building nearest to it.
 * ------------------------------------------------------------------------------------------ */

function silhouettes(opts) {
  const out = {};
  for (const town of TOWNS) {
    const { plan } = loadPlan(town);
    const rows = [];
    // The salts are the settlement's, so the gate must ask the settlement for them or it measures
    // a town nobody ships.
    const salts = opts.kit === false ? new Map()
      : assignVariantSalts(plan, GRAMMARS[opts.oneGrammar ? 'gideon' : town], opts);
    for (const b of plan.buildings) {
      const { summary } = buildBuilding(b, plan.id, { ...opts, batch: false, variantSalt: salts.get(b.id) || 0 });
      rows.push({ id: b.id, x: b.x, z: b.z, sil: summary.silhouette || `structure:${b.structure_kit || b.id}`, roof: summary.roof || null });
    }
    let adjacent = 0, pairs = 0;
    for (const a of rows) {
      let best = null, bd = Infinity;
      for (const c of rows) {
        if (c === a) continue;
        const dd = (a.x - c.x) ** 2 + (a.z - c.z) ** 2;
        if (dd < bd) { bd = dd; best = c; }
      }
      if (!best) continue;
      pairs++;
      if (best.sil === a.sil) adjacent++;
    }
    const roofs = new Set(rows.map(r => r.roof).filter(Boolean));
    out[town] = {
      buildings: rows.length,
      distinctSilhouettes: new Set(rows.map(r => r.sil)).size,
      adjacentCollisions: adjacent,
      adjacentPairs: pairs,
      collisionRate: round(pairs ? adjacent / pairs : 0),
      roofProfiles: roofs.size,
    };
  }
  return out;
}

/* ---------------------------------------------------------------------------------------------
 * Gate 3 — are settlements separable, from geometry alone?
 *
 * A LEAVE-ONE-OUT nearest-centroid classification of individual BUILDINGS to settlements, on a
 * descriptor made only of things a player can see: which roof, how many storeys, how many
 * apertures per metre of facade, how much dressing, which trim slots, which skyline features,
 * how ordered the piers are. Chance is 1/8 = 12.5%.
 *
 * This is NOT the plan's attribution gate. The plan's gate is naive human judges shown street
 * shots. This is the cheap thing that must be true FIRST: if the geometry does not separate, no
 * amount of rendering will make it separate, and a red number here is decisive while a green one
 * is only permission to spend a browser.
 * ------------------------------------------------------------------------------------------ */

const TRIM_INDEX = ['edge', 'moulding', 'plank', 'lashing', 'bolt', 'shell-ring', 'bone-binding', 'resin-seam', 'dye-band', 'metal-course', 'chitin-bar', 'bleached-timber'];
const ROOF_INDEX = ['roof.hip', 'roof.reed', 'roof.shell'];
const SKY_INDEX = ['chimney', 'mast', 'banner', 'dryingrack', 'netframe', 'watchpost', 'rib', 'spike'];

function descriptorOf(summary, b) {
  const v = new Array(ROOF_INDEX.length + SKY_INDEX.length + 6).fill(0);
  const ri = ROOF_INDEX.indexOf(summary.roof);
  if (ri >= 0) v[ri] = 1;
  for (const s of summary.skyline || []) {
    const si = SKY_INDEX.indexOf(s);
    if (si >= 0) v[ROOF_INDEX.length + si] += 1;
  }
  const base = ROOF_INDEX.length + SKY_INDEX.length;
  const perimeter = 2 * (summary.w + summary.d) || 1;
  v[base + 0] = (summary.storeys_drawn || b.storeys || 1) / 4;
  v[base + 1] = (summary.kit_apertures || 0) / perimeter;
  v[base + 2] = (summary.kit_dressing || 0) / perimeter;
  v[base + 3] = (summary.kit_parts || 0) / perimeter;
  v[base + 4] = summary.h / 12;
  v[base + 5] = summary.w / Math.max(0.1, summary.d) / 4;
  return v;
}

function separability(opts) {
  const samples = [];
  for (const town of TOWNS) {
    const { plan } = loadPlan(town);
    for (const b of plan.buildings) {
      const { summary } = buildBuilding(b, plan.id, { ...opts, batch: false });
      if (!summary.roof) continue;               // named structures carry no facade descriptor
      samples.push({ town, v: descriptorOf(summary, b) });
    }
  }
  const dim = samples[0]?.v.length || 0;
  // Standardise each dimension so a metre does not outvote a count.
  const mean = new Array(dim).fill(0), sd = new Array(dim).fill(0);
  for (const s of samples) for (let i = 0; i < dim; i++) mean[i] += s.v[i] / samples.length;
  for (const s of samples) for (let i = 0; i < dim; i++) sd[i] += (s.v[i] - mean[i]) ** 2 / samples.length;
  for (let i = 0; i < dim; i++) sd[i] = Math.sqrt(sd[i]) || 1;
  const z = samples.map(s => ({ town: s.town, v: s.v.map((x, i) => (x - mean[i]) / sd[i]) }));
  let correct = 0;
  const confusion = {};
  for (let k = 0; k < z.length; k++) {
    const cent = {};
    for (let j = 0; j < z.length; j++) {
      if (j === k) continue;                      // leave one out
      const c = cent[z[j].town] || (cent[z[j].town] = { n: 0, v: new Array(dim).fill(0) });
      c.n++;
      for (let i = 0; i < dim; i++) c.v[i] += z[j].v[i];
    }
    let bestTown = null, bestD = Infinity;
    for (const [t, c] of Object.entries(cent)) {
      let dd = 0;
      for (let i = 0; i < dim; i++) dd += (z[k].v[i] - c.v[i] / c.n) ** 2;
      if (dd < bestD) { bestD = dd; bestTown = t; }
    }
    if (bestTown === z[k].town) correct++;
    (confusion[z[k].town] || (confusion[z[k].town] = {}))[bestTown] = ((confusion[z[k].town] || {})[bestTown] || 0) + 1;
  }
  return { n: z.length, accuracy: round(correct / z.length), chance: round(1 / TOWNS.length), confusion };
}

/* ---------------------------------------------------------------------------------------------
 * Gate 4 — are edges broken?
 *
 * For every distinct geometry in a settlement, walk its shared edges and take the dihedral angle
 * between the two triangles that share each one. An unbroken 90-degree arris is a hard step in
 * the shading; a chamfer replaces it with two ~135-degree transitions. The number reported is the
 * fraction of shared-edge length that is a HARD STEP (dihedral >= 80 degrees).
 *
 * This is the GEOMETRIC reading of the plan's row. The plan's own wording is a PIXEL reading —
 * *"the fraction of silhouette edge pixels with a shading gradient over >= 2 px rather than a hard
 * step"* — and that one needs a frame. They are not the same number and must not be quoted as if
 * they were; this one is a tripwire the builder can run in two seconds, and the critic runs the
 * other.
 * ------------------------------------------------------------------------------------------ */

function hardEdgeFraction(root) {
  const seen = new Set();
  let hard = 0, total = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    const key = g.userData?.w130BatchKey || g.uuid;
    if (seen.has(key)) return;
    seen.add(key);
    const pos = g.attributes.position;
    if (!pos) return;
    const idx = g.index ? g.index.array : null;
    const n = idx ? idx.length : pos.count;
    const at = (i) => (idx ? idx[i] : i);
    const kOf = (v) => `${Math.round(pos.getX(v) * 4096)},${Math.round(pos.getY(v) * 4096)},${Math.round(pos.getZ(v) * 4096)}`;
    const edges = new Map();
    for (let t = 0; t < n; t += 3) {
      const a = at(t), b = at(t + 1), c = at(t + 2);
      const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a);
      const bx = pos.getX(b), by = pos.getY(b), bz = pos.getZ(b);
      const cx = pos.getX(c), cy = pos.getY(c), cz = pos.getZ(c);
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      for (const [p, q] of [[a, b], [b, c], [c, a]]) {
        const ka = kOf(p), kb = kOf(q);
        const ek = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        const len = Math.hypot(pos.getX(p) - pos.getX(q), pos.getY(p) - pos.getY(q), pos.getZ(p) - pos.getZ(q));
        const e = edges.get(ek) || { len, ns: [] };
        e.ns.push(nx, ny, nz);
        edges.set(ek, e);
      }
    }
    for (const e of edges.values()) {
      if (e.ns.length < 6) continue;              // an open boundary edge has no dihedral
      let worst = 1;
      for (let i = 0; i < e.ns.length; i += 3) for (let j = i + 3; j < e.ns.length; j += 3) {
        const dot = e.ns[i] * e.ns[j] + e.ns[i + 1] * e.ns[j + 1] + e.ns[i + 2] * e.ns[j + 2];
        if (dot < worst) worst = dot;
      }
      total += e.len;
      if (worst <= Math.cos(80 * Math.PI / 180)) hard += e.len;
    }
  });
  return { hardFraction: round(total ? hard / total : 1), brokenFraction: round(total ? 1 - hard / total : 0), edgeLength: round(total, 1) };
}

/* ---------------------------------------------------------------------------------------------
 * Gate 5 — the skyline, geometrically.
 *
 * Project every triangle of the settlement into the approach camera and take the per-column
 * topmost occupied row: that is the silhouette a player sees walking in. Report its standard
 * deviation as a fraction of frame height.
 *
 * DELIBERATELY NOT CALLED `ART-X5-SKYLINE-RELIEF`. The board's statistic is defined on a RENDERED
 * FRAME and is computed by `docs/art-direction/measure-plates.mjs`; this is a rasterised
 * silhouette of untextured geometry with no sky, no fog and no terrain, and quoting it against the
 * board's 0.085..0.274 band would be exactly the parallel-instrument mistake rule 10 forbids. It
 * is reported as a BEFORE/AFTER DELTA against its own control arms, which is the one comparison
 * it can honestly carry.
 * ------------------------------------------------------------------------------------------ */

function skylineRelief(town, opts) {
  const { plan, root } = buildTown(town, { ...opts, settlementBatch: false, buildingBatch: false });
  const app = settlementApproach(plan, true);
  const W = 320, H = 180;
  const eye = new THREE.Vector3(app.start[0], 1.7, app.start[1]);
  const look = new THREE.Vector3(app.focus[0], 3.0, app.focus[1]);
  const cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 600);
  cam.position.copy(eye);
  cam.lookAt(look);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const top = new Int32Array(W).fill(H);
  const v = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    const idx = o.geometry.index ? o.geometry.index.array : null;
    const n = idx ? idx.length : pos.count;
    const get = (i) => {
      const k = idx ? idx[i] : i;
      v.set(pos.getX(k), pos.getY(k), pos.getZ(k)).applyMatrix4(o.matrixWorld).applyMatrix4(vp);
      return v.z > -1 && v.w !== 0 ? { x: (v.x * 0.5 + 0.5) * W, y: (1 - (v.y * 0.5 + 0.5)) * H, ok: true } : { ok: false };
    };
    for (let t = 0; t < n; t += 3) {
      const a = get(t), b = get(t + 1), c = get(t + 2);
      if (!a.ok || !b.ok || !c.ok) continue;
      const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
      const x1 = Math.min(W - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
      if (x1 < x0) continue;
      const yTop = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
      for (let x = x0; x <= x1; x++) if (yTop < top[x]) top[x] = yTop;
    }
  });
  // Smooth over 5 columns, then take the standard deviation of the silhouette height.
  const heights = [];
  for (let x = 0; x < W; x++) {
    let s = 0, k = 0;
    for (let dx = -2; dx <= 2; dx++) { const i = x + dx; if (i >= 0 && i < W) { s += (H - top[i]) / H; k++; } }
    heights.push(s / k);
  }
  const m = heights.reduce((a, b) => a + b, 0) / heights.length;
  const sd = Math.sqrt(heights.reduce((a, b) => a + (b - m) ** 2, 0) / heights.length);
  const occupied = top.filter(t => t < H).length / W;
  return { relief: round(sd), meanHeight: round(m), occupiedColumns: round(occupied) };
}

/* ---------------------------------------------------------------------------------------------
 * Gate 6 — Gideon is the exception. Ordered-ness, from geometry.
 * ------------------------------------------------------------------------------------------ */

function orderedness(opts) {
  const out = {};
  for (const town of TOWNS) {
    const g = GRAMMARS[opts.oneGrammar ? (typeof opts.oneGrammar === 'string' ? opts.oneGrammar : 'gideon') : town];
    out[town] = {
      imperial: Boolean(opts.allImperial || g.imperial),
      asym: g.asym, roofProfiles: g.roofs.length, wear: g.wear,
      squarePiers: g.asym < 0.06,
    };
  }
  const imperial = TOWNS.filter(t => out[t].imperial);
  const others = TOWNS.filter(t => !out[t].imperial);
  const meanAsym = (l) => (l.length ? l.reduce((a, t) => a + out[t].asym, 0) / l.length : null);
  return { per: out, imperialTowns: imperial, separation: round((meanAsym(others) ?? 0) - (meanAsym(imperial) ?? 0)) };
}

/* ------------------------------------------------------------------------------------------- */

const ARMS = {
  shipped: {},
  // The full delete-the-fix: the five hand-rolled facade blocks AND the primitive chamfer. This
  // is the settlement exactly as it stood on 2026-08-14, which is the plausible wrong answer
  // rather than an empty scene.
  'null:kit-false': { kit: false, chamfer: false },
  // Chamfer only, kit kept — the plan's *"ship un-bevelled parts"* control isolated.
  'null:no-chamfer': { chamfer: false },
  'null:one-grammar': { oneGrammar: 'gideon' },
  'null:one-variant': { oneVariant: true },
  'null:flat-roof': { flatRoof: true },
  'null:all-imperial': { allImperial: true },
};

function main() {
  const jsonOnly = process.argv.includes('--json');
  const report = { tool: 'w1-30e-kit-gate', generated_by: 'W1-30E builder', arms: {}, kit: { parts: knownKits(), count: knownKits().length } };

  for (const [arm, opts] of Object.entries(ARMS)) {
    setKitChamfer(opts.chamfer !== false);
    const row = {};
    row.economy = economy(opts);
    row.bypassComposition = bypassComposition(opts);
    row.silhouette = silhouettes(opts);
    row.separability = separability(opts);
    const heavy = buildTown('stormhold', { ...opts, settlementBatch: false, buildingBatch: false });
    row.edges = hardEdgeFraction(heavy.root);
    row.skyline = {};
    for (const t of ['lilmoth', 'helstrom', 'gideon']) row.skyline[t] = skylineRelief(t, opts);
    row.ordered = orderedness(opts);
    report.arms[arm] = row;
    if (!jsonOnly) {
      const e = row.economy, s = row.silhouette;
      const collisions = TOWNS.reduce((a, t) => a + s[t].adjacentCollisions, 0);
      const pairs = TOWNS.reduce((a, t) => a + s[t].adjacentPairs, 0);
      console.log(`${arm.padEnd(20)} parts ${String(e.distinctParts.length).padStart(2)}  bypass ${String(e.bypass).padStart(5)}  kitMeshes ${String(e.kitMeshes).padStart(5)}  `
        + `adjSil ${String(collisions).padStart(3)}/${pairs}  sep ${String(row.separability.accuracy).padStart(6)}  `
        + `brokenEdges ${String(row.edges.brokenFraction).padStart(6)}  relief lil ${row.skyline.lilmoth.relief}`);
    }
  }

  // The verdict rows, stated as the plan states them.
  const shipped = report.arms.shipped, ctl = report.arms;
  const totalPairs = TOWNS.reduce((a, t) => a + shipped.silhouette[t].adjacentPairs, 0);
  const totalColl = TOWNS.reduce((a, t) => a + shipped.silhouette[t].adjacentCollisions, 0);
  report.rows = [
    { row: 'kit economy: parts', value: report.kit.count, bar: '<= 25', pass: report.kit.count <= 25, control: null },
    {
      row: 'kit economy: distinct buildings from the kit', value: Object.values(shipped.silhouette).reduce((a, x) => a + x.distinctSilhouettes, 0),
      bar: '>= 40', pass: Object.values(shipped.silhouette).reduce((a, x) => a + x.distinctSilhouettes, 0) >= 40, control: null,
    },
    {
      row: 'kit economy: BUILDING meshes without a kitId', value: shipped.bypassComposition.total.building,
      bar: 'zero', pass: shipped.bypassComposition.total.building === 0,
      control: { arm: 'null:kit-false', value: ctl['null:kit-false'].bypassComposition.total.building },
      note: 'NOT MET and reported rather than laundered. Composition in arms.shipped.bypassComposition: '
        + `${shipped.bypassComposition.total.blob} icosahedral masses the kit deliberately has no part for, `
        + `${shipped.bypassComposition.total.publicRealm} public-realm meshes (plan item 6, not started).`,
    },
    {
      row: 'variation within a street: adjacent silhouette collisions', value: `${totalColl}/${totalPairs}`,
      bar: 'no two adjacent buildings share a silhouette hash', pass: totalColl === 0,
      control: {
        arm: 'null:one-variant+flat-roof',
        value: `${TOWNS.reduce((a, t) => a + ctl['null:flat-roof'].silhouette[t].adjacentCollisions, 0)}/${totalPairs}`,
      },
    },
    {
      row: 'variation within a street: roof profiles per settlement',
      value: Math.min(...TOWNS.map(t => shipped.silhouette[t].roofProfiles)), bar: '>= 5 per settlement (see report: the kit ships 3)',
      pass: false, control: { arm: 'null:flat-roof', value: Math.min(...TOWNS.map(t => ctl['null:flat-roof'].silhouette[t].roofProfiles)) },
    },
    {
      row: 'settlements separable (GEOMETRY PROXY, not the plan gate)', value: shipped.separability.accuracy,
      bar: 'must beat chance 0.125 decisively; the plan gate is naive judges on street shots',
      pass: shipped.separability.accuracy > 0.55,
      control: { arm: 'null:one-grammar', value: ctl['null:one-grammar'].separability.accuracy },
    },
    {
      row: 'edges are broken (GEOMETRIC reading)', value: shipped.edges.brokenFraction, bar: '>= 0.95',
      pass: shipped.edges.brokenFraction >= 0.95,
      control: { arm: 'null:no-chamfer', value: ctl['null:no-chamfer'].edges.brokenFraction },
    },
    {
      row: 'skyline relief, Lilmoth (builder indicator, NOT ART-X5)', value: shipped.skyline.lilmoth.relief,
      bar: 'delta against control only', pass: null,
      control: { arm: 'null:flat-roof', value: ctl['null:flat-roof'].skyline.lilmoth.relief },
    },
    {
      row: 'Gideon is the exception (grammar ordering)', value: shipped.ordered.separation,
      bar: 'imperial towns measurably more ordered than the rest', pass: shipped.ordered.separation > 0.05,
      control: { arm: 'null:all-imperial', value: ctl['null:all-imperial'].ordered.separation },
    },
  ];

  const outPath = 'reports/w1-30e/kit-gate.json';
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 1));
  if (!jsonOnly) {
    console.log('');
    for (const r of report.rows) {
      const mark = r.pass === true ? 'PASS' : r.pass === false ? 'FAIL' : ' -- ';
      console.log(`${mark}  ${String(r.row).padEnd(58)} ${String(r.value).padStart(12)}   bar ${r.bar}`
        + (r.control ? `   [control ${r.control.arm} -> ${r.control.value}]` : ''));
    }
    console.log(`\nreport   ${outPath}`);
  } else {
    console.log(JSON.stringify(report));
  }
}

main();
