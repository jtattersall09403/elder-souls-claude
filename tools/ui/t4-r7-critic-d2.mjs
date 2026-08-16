#!/usr/bin/env node
// t4-r7-critic-d2.mjs — RI-UIX09 D2, re-implemented by the critic from the item's own words, and
// the S61 band re-derived on the critic's own captures.
//
// Owner: crit-t4-r7. WHY A SECOND IMPLEMENTATION. Every D2 number in this thread — round 5's,
// round 6's, round 7's, and the S61 band that decides whether the container passes — comes out of
// ONE function, `d2()` in `tools/ui/t4-r2-measure.mjs`. An instrument nobody has re-implemented is
// an instrument nobody has checked. This file reads the item's definition (RI-UIX09 method 4: the
// modal colour of the panel rect, then the fraction of that rect's pixels at dE00 > 6 from it),
// implements it independently on top of `tools/lib/colour.mjs`, and reports:
//
//   A  D2 on my own capture — does the shipped instrument's 0.1685 reproduce out of other code?
//   B  band_perturb — S61's own method: dither +-1 LSB on 0.06% of the panel's pixels, N seeds,
//      D2 recomputed END TO END including the modal re-derivation. The r7 builder reports 0.0000.
//   C  band_thresh — the dE00 5.0-7.0 sweep.
//   D  band_ref — D2 recomputed against reference colours displaced from the modal one, at the
//      three reference shifts this project has actually observed.
//
// Nothing here is fed a number by the tool it is checking.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { parseArgs, log, REPO_ROOT, ensureDir } from '../lib/cli.mjs';
import { labFromSrgb255, de2000 } from '../lib/colour.mjs';

const args = parseArgs();
const OUT = path.isAbsolute(String(args.out || '')) ? String(args.out)
  : path.resolve(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r7c/reports'));
ensureDir(OUT);

function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, width = 0, height = 0, bitDepth = 0, colourType = 0, interlace = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colourType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bitDepth !== 8 || colourType !== 6 || interlace !== 0) throw new Error(`unsupported PNG ${bitDepth}/${colourType}/${interlace}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = width * bpp;
  const out = Buffer.alloc(width * height * bpp);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const ft = raw[rp++];
    const line = raw.subarray(rp, rp + stride); rp += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= bpp) ? prev[x - bpp] : 0;
      let v = line[x];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 0xff;
    }
  }
  return { width, height, data: out };
}

/** RI-UIX09 method 4, implemented from the item's words. Returns { fill, mode, n }. */
function d2(img, rect, opts = {}) {
  const [rx, ry, rw, rh] = rect.map((v) => Math.round(v));
  const thresh = opts.thresh === undefined ? 6 : opts.thresh;
  const counts = new Map();
  const px = [];
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      const i = (y * img.width + x) * 4;
      let r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
      if (opts.jitter && opts.jitter.has(i)) {
        const d = opts.jitter.get(i);
        r = Math.max(0, Math.min(255, r + d)); g = Math.max(0, Math.min(255, g + d)); b = Math.max(0, Math.min(255, b + d));
      }
      const k = (r << 16) | (g << 8) | b;
      counts.set(k, (counts.get(k) || 0) + 1);
      px.push(r, g, b);
    }
  }
  let bestK = 0, bestN = -1, second = -1;
  for (const [k, n] of counts) { if (n > bestN) { second = bestN; bestN = n; bestK = k; } else if (n > second) second = n; }
  const mode = opts.ref || [(bestK >> 16) & 255, (bestK >> 8) & 255, bestK & 255];
  const mlab = labFromSrgb255(mode[0], mode[1], mode[2]);
  const cache = new Map();
  let differ = 0;
  const n = px.length / 3;
  for (let i = 0; i < n; i++) {
    const r = px[i * 3], g = px[i * 3 + 1], b = px[i * 3 + 2];
    const k = (r << 16) | (g << 8) | b;
    let de = cache.get(k);
    if (de === undefined) { de = de2000(labFromSrgb255(r, g, b), mlab); cache.set(k, de); }
    if (de > thresh) differ++;
  }
  return { fill: differ / n, mode, n, mode_count: bestN, second_count: second };
}

// deterministic PRNG so a band is reproducible
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const SCREENS = {
  container: { png: 'critic-delivered-container__1920x1080.png', rect: [720, 314, 480, 452] },
  container_no_name: { png: 'critic-delivered-container_no_name__1920x1080.png', rect: [720, 314, 480, 452] },
  levelup: { png: 'critic-delivered-levelup__1920x1080.png', rect: [720, 300, 480, 480] },
};
const DIR = path.resolve(REPO_ROOT, String(args.screens || 'corpus/90-verdicts/wave1/artifacts/T4-r7c/measure-delivered/screens'));

const out = { schema: 'elder-souls/t4-r7-critic-d2@1', at: new Date().toISOString(), dir: DIR, screens: {} };
for (const [name, cfg] of Object.entries(SCREENS)) {
  const img = decodePNG(fs.readFileSync(path.join(DIR, cfg.png)));
  const base = d2(img, cfg.rect);
  // B — perturbation band, S61's own method
  const [rx, ry, rw, rh] = cfg.rect;
  const total = rw * rh;
  const nJit = Math.round(total * 0.0006);
  const perturbed = [];
  for (let seed = 1; seed <= 6; seed++) {
    const rnd = rng(seed * 7919);
    const jitter = new Map();
    for (let k = 0; k < nJit; k++) {
      const x = rx + Math.floor(rnd() * rw), y = ry + Math.floor(rnd() * rh);
      jitter.set((y * img.width + x) * 4, rnd() < 0.5 ? -1 : 1);
    }
    perturbed.push(d2(img, cfg.rect, { jitter }).fill);
  }
  // C — threshold sweep
  const thresh = { 5.0: d2(img, cfg.rect, { thresh: 5.0 }).fill, 6.0: base.fill, 7.0: d2(img, cfg.rect, { thresh: 7.0 }).fill };
  // D — reference displacement, at the shifts this project has actually observed
  const refShift = {};
  for (const delta of [[1, 0, 0], [3, 2, 2], [-1, -3, -7]]) {
    const ref = base.mode.map((v, i) => Math.max(0, Math.min(255, v + delta[i])));
    const de = de2000(labFromSrgb255(...base.mode), labFromSrgb255(...ref));
    refShift[JSON.stringify(delta)] = { ref, dE00: Number(de.toFixed(4)), fill: d2(img, cfg.rect, { ref }).fill };
  }
  out.screens[name] = {
    rect: cfg.rect, d2: Number(base.fill.toFixed(4)), modal_rgb: base.mode,
    modal_count: base.mode_count, runner_up_count: base.second_count,
    band_perturb: Number((Math.max(...perturbed) - Math.min(...perturbed)).toFixed(4)),
    perturbed_values: perturbed.map((v) => Number(v.toFixed(4))),
    jittered_pixels: nJit, panel_pixels: total,
    band_thresh: Number((thresh[5.0] - thresh[7.0]).toFixed(4)), thresh_sweep: thresh,
    band_ref: Number(Math.max(...Object.values(refShift).map((r) => Math.abs(r.fill - base.fill))).toFixed(4)),
    ref_shifts: refShift,
  };
  log(`${name}: D2 ${base.fill.toFixed(4)} modal ${JSON.stringify(base.mode)}  perturb ${out.screens[name].band_perturb}  thresh ${out.screens[name].band_thresh}  ref ${out.screens[name].band_ref}`);
}
fs.writeFileSync(path.join(OUT, 't4-r7-critic-d2.json'), JSON.stringify(out, null, 2));
log(`written: ${path.join(OUT, 't4-r7-critic-d2.json')}`);
