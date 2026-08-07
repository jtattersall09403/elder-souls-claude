#!/usr/bin/env node
// W1-02 — the three pictures. Walk one border and photograph the SAME heading at three points:
// before the transition, in the middle of it, and after. That is the whole claim of RI-WLD12 §2 in
// a form a person can look at: at the middle frame some of the nine axes have handed over and
// some have not, so it is neither region and it is not a line.
//
// Goes through `tools/capture/` — one warm browser for the whole box, never our own.
'use strict';

import { readFileSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { CaptureSession } from '../capture/client.mjs';
import { BorderField } from '../../game/src/world/borders.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const R = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const bf = new BorderField(R('game/data/world/borders.json'), R('game/data/world/regions.json').regions);
const terrain = R('game/data/world/terrain.json');
const COLS = terrain.cols, CELL = terrain.cell_m;
const rb = Buffer.from(terrain.channels.region, 'base64');
const regionU = new Uint8Array(rb.buffer, rb.byteOffset, rb.byteLength);
const regionIndexAt = (x, z) => regionU[Math.max(0, Math.floor(z / CELL)) * COLS + Math.max(0, Math.floor(x / CELL))];

const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const BORDER = arg('border', 'stone-wastes--western-rootlands');
const DATE = arg('date', new Date().toISOString().slice(0, 10));
const W = Number(arg('width', 1280)), H = Number(arg('height', 720));
// Eye height is an argument because the first pass at RI-WLD12 M68's 1.7 m put a canopy trunk
// against the lens in two of three stations: at a border the props are DENSE by construction, so
// a station coordinate chosen from the crossover geometry has no reason to be clear. The blind
// pack keeps 1.7 m because the item says so; these illustrative frames rise above the understorey
// so the ground band, the plants and the far region's skyline are all in one picture.
const EYE = Number(arg('eye', 1.7)), PITCH = Number(arg('pitch', -3));
const TAG = arg('tag', '');

const t = bf.traverse(BORDER, regionIndexAt, 400, 2);
const cs = Object.values(t.crossovers_m).filter((v) => v !== null);
const lo = Math.min(...cs), hi = Math.max(...cs);
const b = bf.byId.get(BORDER);

// Three stations, one heading (across the border, looking into B).
const yaw = (Math.atan2(t.direction[0], t.direction[1]) * 180 / Math.PI + 360) % 360;
const stations = [
  { tag: 'before', s: lo - 60, note: `${b.a}: all nine axes are still ${b.a}` },
  { tag: 'inside', s: (lo + hi) / 2, note: 'the middle of the transition: some axes have handed over, some have not' },
  { tag: 'after', s: hi + 60, note: `${b.b}: all nine axes are now ${b.b}` },
];

const shotsDir = resolve(ROOT, 'docs/shots');
mkdirSync(shotsDir, { recursive: true });
const session = new CaptureSession();
const written = [];
try {
  for (const st of stations) {
    const x = t.at.x + t.direction[0] * st.s, z = t.at.z + t.direction[1] * st.s;
    const axes = {};
    for (const ax of ['palette', 'flora', 'weather', 'fauna', 'audio', 'hazard', 'tier', 'architecture', 'only_here']) {
      axes[ax] = bf.regions[bf.axisRegionIndexAt(x, z, ax, regionIndexAt(x, z))].id;
    }
    const shot = await session.capture({
      evidence_of: 'appearance',
      claim: `W1-02 / RI-WLD12 §2: ${st.note}`,
      place: { x: +x.toFixed(1), z: +z.toFixed(1) },
      pose: { yaw_deg: +yaw.toFixed(1), pitch_deg: PITCH, eye_m: EYE, fov: 70 },
      time: 11,
      width: W, height: H,
      // The default 24/12 settle budget refused these frames outright: the province streams in
      // around a teleport, so |A-C| accumulates across both intervals and G3c fires. That refusal
      // is correct and is the reason blank and half-built frames have nearly been cited in this
      // project before. The answer is to give the streamer time, not to lower the gate.
      settle_frames: 90, settle_gap: 45,
    });
    const name = `${DATE}-w1-02-border-${BORDER}-${st.tag}${TAG}.png`;
    copyFileSync(shot.path, resolve(shotsDir, name));
    written.push({
      file: `docs/shots/${name}`, station: st.tag, s_m: +st.s.toFixed(1),
      x: +x.toFixed(1), z: +z.toFixed(1), yaw: +yaw.toFixed(1),
      axis_regions: axes, distinct_axis_regions: new Set(Object.values(axes)).size,
      settled: shot.settle && shot.settle.settled, cached: shot.cached, source: shot.path,
    });
    console.error(`  ${name}  settled=${shot.settle && shot.settle.settled}  distinct axes=${new Set(Object.values(axes)).size}`);
  }
} finally { if (session.close) await session.close(); }

writeFileSync(resolve(ROOT, 'reports/w1-02-shots.json'), JSON.stringify({
  tool: 'tools/world/wld-borders-shots.mjs', border: BORDER,
  crossovers_m: t.crossovers_m, stddev_m: t.stddev_m, span_m: t.span_m, kind: t.kind,
  shots: written,
}, null, 1) + '\n');
console.log(JSON.stringify(written, null, 1));
