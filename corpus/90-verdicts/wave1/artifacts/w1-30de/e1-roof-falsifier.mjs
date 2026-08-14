#!/usr/bin/env node
// Ruling E1's falsifier, fired by the W1-30D/E critic.
//
// E1 rules that "≥5 roof profiles per settlement" counts distinct roof SILHOUETTES, not kit PARTS.
// Its falsifier: "if that variety is parameter jitter reading as noise rather than recognisably
// different roofs, the ruling is wrong."
//
// So: build every building in every settlement, keep ONLY the meshes whose kitId is a roof part,
// project them orthographically onto the vertical plane a settlement approach sees, normalise for
// building footprint (so a big house and a small house with the SAME roof shape are one profile,
// which is what "profile" means), and measure pairwise IoU between the distinct classes the E1
// reading would count.
//
// The decision rule, fixed BEFORE running:
//   - a pair of "distinct" roof profiles whose normalised silhouettes overlap at IoU >= 0.95 is
//     the same roof at a different size: jitter.
//   - E1 survives if a settlement has >= 5 classes that are mutually BELOW 0.95.
//   - E1 falls if the classes collapse to fewer than 5 once jitter-equivalent ones are merged.
'use strict';

import fs from 'node:fs';
import * as THREE from '/home/user/elder-souls-claude/game/vendor/three/three.module.js';

const R = '/home/user/elder-souls-claude';
const { planSettlement, buildBuilding, assignVariantSalts } = await import(`${R}/game/src/render/exterior.js`);
const { GRAMMARS } = await import(`${R}/game/src/render/lib/kits.js`);

const TOWNS = Object.keys(GRAMMARS).sort();
const RES = 128;
const IOU_SAME = 0.95;

function loadPlan(town) {
  const rec = JSON.parse(fs.readFileSync(`${R}/game/data/world/settlements/${town}.json`, 'utf8'));
  const interiors = {};
  for (const b of rec.buildings) if (b.interior) {
    const p = `${R}/game/data/world/interiors/${b.interior}.json`;
    if (fs.existsSync(p)) interiors[b.interior] = JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  return planSettlement(rec, interiors, {});
}

/** Every world-space triangle of every ROOF mesh in this building group. */
function roofTris(group) {
  const out = [];
  group.updateMatrixWorld(true);
  group.traverse((o) => {
    if (!o.isMesh) return;
    const id = o.userData.kitId || '';
    if (!/^roof\./.test(id)) return;
    const g = o.geometry;
    const pos = g?.attributes?.position;
    if (!pos) return;
    const idx = g.index;
    const n = idx ? idx.count : pos.count;
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const j = idx ? idx.getX(i) : i;
      v.fromBufferAttribute(pos, j).applyMatrix4(o.matrixWorld);
      out.push(v.x, v.y, v.z);
    }
  });
  return out;
}

/** Orthographic silhouette on the XY plane (a side-on approach view), normalised to its own bbox. */
function silhouette(tris) {
  if (!tris.length) return null;
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (let i = 0; i < tris.length; i += 3) {
    if (tris[i] < minx) minx = tris[i]; if (tris[i] > maxx) maxx = tris[i];
    if (tris[i + 1] < miny) miny = tris[i + 1]; if (tris[i + 1] > maxy) maxy = tris[i + 1];
  }
  const sx = maxx - minx, sy = maxy - miny;
  if (!(sx > 0) || !(sy > 0)) return null;
  // Normalise by the LARGER extent and centre, so aspect ratio is preserved but absolute size is
  // not: two roofs of the same shape at different scale must land on each other.
  const s = Math.max(sx, sy);
  const mask = new Uint8Array(RES * RES);
  const px = (x, y) => [
    Math.round(((x - (minx + maxx) / 2) / s + 0.5) * (RES - 1)),
    Math.round((1 - ((y - (miny + maxy) / 2) / s + 0.5)) * (RES - 1)),
  ];
  for (let i = 0; i < tris.length; i += 9) {
    const a = px(tris[i], tris[i + 1]), b = px(tris[i + 3], tris[i + 4]), c = px(tris[i + 6], tris[i + 7]);
    const x0 = Math.max(0, Math.min(a[0], b[0], c[0])), x1 = Math.min(RES - 1, Math.max(a[0], b[0], c[0]));
    const y0 = Math.max(0, Math.min(a[1], b[1], c[1])), y1 = Math.min(RES - 1, Math.max(a[1], b[1], c[1]));
    const d = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (d === 0) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const w0 = ((b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1])) / d;
      const w1 = ((x - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (y - a[1])) / d;
      if (w0 >= -0.001 && w1 >= -0.001 && w0 + w1 <= 1.001) mask[y * RES + x] = 1;
    }
  }
  return mask;
}

function iou(a, b) {
  let inter = 0, uni = 0;
  for (let i = 0; i < a.length; i++) { const p = a[i], q = b[i]; if (p || q) uni++; if (p && q) inter++; }
  return uni ? inter / uni : 0;
}

const report = {};
for (const town of TOWNS) {
  const plan = loadPlan(town);
  const salts = assignVariantSalts(plan, GRAMMARS[town], {});
  const rows = [];
  for (const b of plan.buildings) {
    const { group, summary } = buildBuilding(b, plan.id, { batch: false, variantSalt: salts.get(b.id) || 0 });
    if (!summary.roof) continue;
    const m = silhouette(roofTris(group));
    if (!m) continue;
    rows.push({ id: b.id, roof: summary.roof, storeys: summary.storeys_drawn, h: summary.h,
      key: [summary.roof, summary.storeys_drawn, Math.round((summary.w / summary.d) * 4) / 4].join('|'), mask: m });
  }
  // The classes the E1 reading counts: distinct roof-bearing silhouette classes.
  const byKey = new Map();
  for (const r of rows) if (!byKey.has(r.key)) byKey.set(r.key, r);
  const reps = [...byKey.values()];
  // Merge jitter-equivalent classes: single-link clustering at IoU >= IOU_SAME.
  const parent = reps.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const pairs = [];
  for (let i = 0; i < reps.length; i++) for (let j = i + 1; j < reps.length; j++) {
    const v = iou(reps[i].mask, reps[j].mask);
    pairs.push({ a: reps[i].key, b: reps[j].key, iou: +v.toFixed(4) });
    if (v >= IOU_SAME) parent[find(i)] = find(j);
  }
  const clusters = new Set(reps.map((_, i) => find(i)));
  pairs.sort((x, y) => y.iou - x.iou);
  report[town] = {
    buildings: rows.length,
    kitRoofParts: new Set(rows.map(r => r.roof)).size,
    e1Classes: reps.length,
    classesAfterMergingJitter: clusters.size,
    medianPairIoU: pairs.length ? +pairs[Math.floor(pairs.length / 2)].iou.toFixed(4) : null,
    maxPairIoU: pairs.length ? pairs[0].iou : null,
    minPairIoU: pairs.length ? pairs[pairs.length - 1].iou : null,
    pairsAboveSameThreshold: pairs.filter(p => p.iou >= IOU_SAME).length,
    totalPairs: pairs.length,
    e1SurvivesHere: clusters.size >= 5,
    topPairs: pairs.slice(0, 3),
  };
  console.log(`${town.padEnd(11)} buildings=${String(rows.length).padStart(3)} kitRoofParts=${report[town].kitRoofParts} `
    + `E1classes=${String(reps.length).padStart(3)} afterMerge=${String(clusters.size).padStart(3)} `
    + `medianIoU=${report[town].medianPairIoU} maxIoU=${report[town].maxPairIoU} minIoU=${report[town].minPairIoU} `
    + `-> ${report[town].e1SurvivesHere ? 'E1 survives' : 'E1 FALLS'}`);
}
const worst = Math.min(...TOWNS.map(t => report[t].classesAfterMergingJitter));
console.log(`\nworst settlement after merging jitter-equivalent roofs: ${worst} (bar is >= 5)`);
console.log(worst >= 5 ? 'RULING E1 SURVIVES ITS FALSIFIER' : 'RULING E1 FAILS ITS OWN FALSIFIER');
fs.writeFileSync(process.argv[2] || '/dev/null', JSON.stringify({ iouSameThreshold: IOU_SAME, res: RES, worst, report }, null, 1));
