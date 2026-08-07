#!/usr/bin/env node
// wpn-render-motion.mjs — how much of the character box does a 60-frame attack actually move?
//
// The round-3 critic's headline was "a full 60-frame attack changes 0.19% of the character
// box". That is a PIXEL measurement, so this reproduces it as a pixel measurement rather than
// answering a different question with geometry and calling it the same number.
//
// METHOD
//   1. A FIXED camera for the whole run (an override, so nothing follows the character and
//      camera motion cannot be mistaken for animation).
//   2. Sample N frames across the attack. At each, screenshot AND project every bone through
//      the same camera, so the character's own screen-space box is known and is not guessed.
//   3. The box is the union of the projected bones over all sampled frames, padded, and
//      CLAMPED TO THE BODY: the weapon is deliberately excluded from the denominator, because
//      a 3 m sword would otherwise inflate the box until any motion looked small.
//   4. For each frame, count pixels inside the box that differ from frame 0 by more than
//      `--tol` on any channel. Report the worst single frame and the union across all frames.
//
// A still image scores ~0. The pre-fix build scored 0.19%.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { parseArgs, wantsHelp, usage, ensureDir, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('wpn-render-motion.mjs — pixel motion of a 60-frame attack');
const outDir = path.resolve(String(args.out || 'reports/render/motion'));
ensureDir(outDir);
const weapon = String(args.weapon || 'ssw_garrison_sword');
const tol = Number(args.tol || 8);
const nSamples = Number(args.samples || 11);
const TOTAL = 60;
const SAMPLES = Array.from({ length: nSamples }, (_, i) => Math.round((i * (TOTAL - 1)) / (nSamples - 1)));
// Fixed, off the right shoulder, framing the body. Never moves.
const POSE = { pos: [3.2, 1.8, 1.7], look: [0, 1.05, 0.2], fov: 50 };

const handle = await launchGame({ ...args, width: 960, height: 540 });
let data;
try {
  data = await handle.page.evaluate(async (o) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setSeed(1337);
    H.loadState('arena_flat');
    H.setLoadout({ weapon: o.weapon });
    H.setRenderRate(0);
    H.stepFrames(4);
    H.camera({ pos: o.pose.pos, look: o.pose.look, fov: o.pose.fov });
    H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
    const want = new Set(o.samples);
    const shots = [];
    for (let i = 0; i < o.total; i++) {
      H.stepFrames(1);
      H.renderFrame();
      if (!want.has(i)) continue;
      const g = H.getDrawnGeometry();
      const P = g.actors.find((a) => a.id === 'player');
      const pts = [];
      if (P && P.bones) {
        for (const v of Object.values(P.bones)) {
          const s = H.projectPoint(v[0], v[1], v[2]);
          if (s && s.in_front) pts.push(s.ndc);
        }
      }
      shots.push({ f: i, png: await H.screenshot(), bone_ndc: pts });
    }
    return { shots };
  }, { weapon, pose: POSE, samples: SAMPLES, total: TOTAL });
} finally {
  await handle.close();
}

const decoded = data.shots.map((s) => ({
  f: s.f,
  bone_ndc: s.bone_ndc,
  png: PNG.sync.read(Buffer.from(String(s.png).replace(/^data:image\/png;base64,/, ''), 'base64')),
}));
const W = decoded[0].png.width, H = decoded[0].png.height;

// The character's own screen box: union of projected BONES (not the weapon) over all frames.
let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
for (const d of decoded) {
  for (const [nx, ny] of d.bone_ndc) {
    const px = ((nx + 1) / 2) * W, py = ((1 - ny) / 2) * H;
    if (px < x0) x0 = px; if (px > x1) x1 = px;
    if (py < y0) y0 = py; if (py > y1) y1 = py;
  }
}
const pad = 0.06 * Math.max(x1 - x0, y1 - y0);
x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad));
x1 = Math.min(W - 1, Math.ceil(x1 + pad)); y1 = Math.min(H - 1, Math.ceil(y1 + pad));
const boxW = x1 - x0 + 1, boxH = y1 - y0 + 1, boxPx = boxW * boxH;

const base = decoded[0].png.data;
const unionChanged = new Uint8Array(boxPx);
const perFrame = [];
for (let k = 1; k < decoded.length; k++) {
  const cur = decoded[k].png.data;
  let n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * W + x) * 4;
      if (Math.abs(cur[i] - base[i]) > tol || Math.abs(cur[i + 1] - base[i + 1]) > tol || Math.abs(cur[i + 2] - base[i + 2]) > tol) {
        n++;
        unionChanged[(y - y0) * boxW + (x - x0)] = 1;
      }
    }
  }
  perFrame.push({ frame: decoded[k].f, changed_px: n, pct_of_box: (n / boxPx) * 100 });
}
let un = 0;
for (let i = 0; i < boxPx; i++) if (unionChanged[i]) un++;

for (const d of decoded) {
  fs.writeFileSync(path.join(outDir, `${weapon}-f${String(d.f).padStart(2, '0')}.png`), PNG.sync.write(d.png));
}
const report = {
  weapon, tol, camera: POSE, canvas: [W, H],
  character_box_px: { x0, y0, x1, y1, w: boxW, h: boxH, area: boxPx },
  per_frame: perFrame,
  max_single_frame_pct: Math.max(...perFrame.map((p) => p.pct_of_box)),
  union_pct: (un / boxPx) * 100,
  baseline_prefix_pct: 0.19,
};
writeJson(path.join(outDir, `motion-${weapon}.json`), report);
console.log(`weapon=${weapon} box=${boxW}x${boxH} (${boxPx} px) tol=${tol}`);
for (const p of perFrame) console.log(`  f${String(p.frame).padStart(2)}  ${String(p.changed_px).padStart(7)} px  ${p.pct_of_box.toFixed(2)}%`);
console.log(`  MAX single frame ${report.max_single_frame_pct.toFixed(2)}%   UNION across attack ${report.union_pct.toFixed(2)}%`);
console.log(`  (pre-fix build measured 0.19%)`);
