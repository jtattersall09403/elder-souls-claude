#!/usr/bin/env node
// W1-02 round 2 — the border markers, photographed. `RI-WLD12` M64 and M68.
//
// M68's bar is that a stranger shown a frame taken AT a border can name the object standing in it.
// Round 1 could not be given that test at all: the 210 objects were rows in `borders.json` and the
// renderer drew none of them, so every border frame in the project so far is a frame of a border
// with nothing built on it. These are the first pictures of the province's frontiers with the
// frontier markers in them.
//
// One camera per marker, standing off it at eye height on the side the traveller arrives from, so
// the marker is between the lens and the region it announces. Goes through `tools/capture/` — one
// warm browser for the whole box, never our own — and refuses a frame the settle gate refuses.
'use strict';

import { readFileSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { CaptureSession } from '../capture/client.mjs';
import { BorderField } from '../../game/src/world/borders.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const R = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const doc = R('game/data/world/borders.json');
const bf = new BorderField(doc, R('game/data/world/regions.json').regions);

const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const DATE = arg('date', new Date().toISOString().slice(0, 10));
const W = Number(arg('width', 1280)), H = Number(arg('height', 720));
const DIST = Number(arg('dist', 6.5));
const HOUR = Number(arg('hour', 11));
const EYE = Number(arg('eye', 1.7));
const PITCH = Number(arg('pitch', -4));
const ONLY = arg('only', '');

// The province's own raster, so the tool can tell which region a camera position is standing in.
const terrain = R('game/data/world/terrain.json');
const COLS = terrain.cols, CELL = terrain.cell_m;
const rbuf = Buffer.from(terrain.channels.region, 'base64');
const regionU = new Uint8Array(rbuf.buffer, rbuf.byteOffset, rbuf.byteLength);
const regionIdAt = (x, z) => bf.regions[regionU[Math.max(0, Math.floor(z / CELL)) * COLS + Math.max(0, Math.floor(x / CELL))]].id;

/**
 * The three markers to photograph, chosen for what each one says rather than at random:
 *   - the Dres gibbet on the province's biggest tier jump — the warning, and the M66 announcement
 *   - the Imperial cairn — the Empire's own boundary, shedding its top block
 *   - the root gate — the same job done by people who grow their marks instead of stacking them
 *
 * `stand_in` IS NOT COSMETIC and it cost two frames to learn. The first run picked each instance by
 * marker crowding alone and put the lens 6.5 m off the marker inside Blackwood and the Crimson
 * Coast — and both frames came back as a wall of canopy with no marker in them at all, because at a
 * border the FLORA is dense by construction. `docs/shots` has had blank and useless frames cited
 * before, and the round-1 border tool already carried this warning in its header; this is the same
 * lesson arriving a second time. So each want now names the side the camera stands on, and the two
 * that failed are shot from the Hive, which is the one region in the province that declares no
 * flora at all — nothing between the lens and the thing being photographed.
 */
const WANT = [
  {
    type: 'corpse_in_a_cage', slug: 'dres-gibbet',
    claim: 'the Dres gibbet at a three-tier jump: the warning you meet before the Deep Marshes',
  },
  {
    type: 'imperial_border_cairn', slug: 'imperial-cairn', border: 'blackwood--hive', stand_in: 'hive',
    claim: "the Empire's border cairn, unmaintained, its top block already down",
  },
  {
    type: 'root_gate', slug: 'root-gate', border: 'hive--western-rootlands', stand_in: 'hive',
    claim: 'an Argonian root gate: the same boundary, grown rather than built',
  },
];

const markers = bf.markers();
const chosen = [];
for (const w of WANT) {
  let of = markers.filter((m) => m.type === w.type);
  if (w.border) of = of.filter((m) => m.border === w.border);
  if (!of.length) continue;
  // Fewest OTHER markers within 30 m, and prefer a border with a real tier jump so the frame is of
  // a place where crossing means something.
  let best = null, bestScore = -Infinity;
  for (const m of of) {
    const crowd = markers.filter((o) => o !== m && Math.hypot(o.x - m.x, o.z - m.z) < 30).length;
    const b = bf.byId.get(m.border);
    const score = Math.abs(b ? b.delta_tier : 0) * 2 - crowd * 3;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  chosen.push({ ...w, marker: best, border: bf.byId.get(best.border) });
}

const shotsDir = resolve(ROOT, 'docs/shots');
mkdirSync(shotsDir, { recursive: true });
const session = new CaptureSession();
const written = [];
try {
  for (const c of chosen) {
    if (ONLY && c.slug !== ONLY) continue;
    const m = c.marker, b = c.border;
    // Stand on the A side of the border and look across it, so the marker is in front of the
    // region it announces rather than in front of the one you are leaving.
    const s = bf.at(m.x, m.z);
    let dirX = 1, dirZ = 0;
    if (s) {
      const g = bf._gradient(m.x, m.z, s.index);
      if (g) { dirX = g[0]; dirZ = g[1]; }
    }
    // Which way along the gradient puts the camera in the region we want to stand in. The gradient
    // is signed but its sign is a property of how the border was fitted, not of which region is
    // which, so the tool asks the raster rather than assuming.
    let sign = -1;
    if (c.stand_in) {
      const plus = regionIdAt(m.x + dirX * DIST, m.z + dirZ * DIST);
      const minus = regionIdAt(m.x - dirX * DIST, m.z - dirZ * DIST);
      if (plus === c.stand_in) sign = 1;
      else if (minus === c.stand_in) sign = -1;
      else console.warn(`  ! ${c.slug}: neither side at ${DIST} m is ${c.stand_in} (got ${minus} / ${plus})`);
    }
    const camX = m.x + sign * dirX * DIST, camZ = m.z + sign * dirZ * DIST;
    const yaw = (Math.atan2(m.x - camX, m.z - camZ) * 180 / Math.PI + 360) % 360;
    const shot = await session.capture({
      evidence_of: 'appearance',
      claim: `W1-02 / RI-WLD12 M64: ${c.claim}`,
      place: { x: +camX.toFixed(1), z: +camZ.toFixed(1) },
      pose: { yaw_deg: +yaw.toFixed(1), pitch_deg: PITCH, eye_m: EYE, fov: 62 },
      time: HOUR,
      width: W, height: H,
      // The larger budget is not a loosened gate: the province streams in around a teleport, so
      // |A - C| accumulates over both settle intervals and the default 24/12 refuses a border
      // frame outright. Round 1 measured that and the answer is to give the streamer time.
      settle_frames: 90, settle_gap: 45,
    });
    const name = `${DATE}-w1-02-marker-${c.slug}.png`;
    copyFileSync(shot.path, resolve(shotsDir, name));
    written.push({
      file: `docs/shots/${name}`,
      type: m.type, owner: m.owner, border: m.border,
      a: b.a, b: b.b, delta_tier: b.delta_tier, border_kind: b.kind,
      marker: { x: m.x, z: m.z, height_m: +m.h.toFixed(2), solid_r: +m.solid_r.toFixed(2) },
      camera: { x: +camX.toFixed(1), z: +camZ.toFixed(1), yaw_deg: +yaw.toFixed(1), eye_m: EYE, pitch_deg: PITCH, dist_m: DIST, stood_in: c.stand_in || null },
      settled: shot.settle && shot.settle.settled, cached: shot.cached, source: shot.path,
    });
    console.log(`wrote docs/shots/${name}  (${m.type}, ${b.a} -> ${b.b}, dtier ${b.delta_tier})`);
  }
} finally {
  session.close();
}
writeFileSync(resolve(ROOT, 'reports/threshold-shots.json'), JSON.stringify({
  tool: 'tools/world/threshold-shots.mjs', owner: 'W1-02', item: 'RI-WLD12 M64 / M68',
  at: new Date().toISOString(), shots: written,
}, null, 2));
console.log(`\nthreshold-shots: ${written.length} frames -> reports/threshold-shots.json`);
