#!/usr/bin/env node
// t4-r2-critic-measure.mjs — RI-UIX09 §A, measured independently of the builder's instrument.
//
// Owner: crit-t4-r2. WHY A SECOND INSTRUMENT EXISTS RATHER THAN A REUSE.
// The round-1 critic read the UNCHANGED journal at D2 = 0.349; the round-2 builder read the same
// screen at 0.1315. Two instruments disagreeing by more than the effect either of them is
// measuring makes both unusable for a before/after, and the builder said so in writing. The
// doctrine's instruction to this round was "pick one instrument and say which". This file is how
// I pick: it re-implements RI-UIX09 method 4 from the item's own words — "the modal colour of the
// panel rect, then the fraction of that rect's pixels at dE00 > 6 from it" — WITHOUT reading the
// builder's function, and runs it on the builder's own committed PNGs. If the two agree, the
// builder's number is the one that matches the item and the round-1 number is the outlier; the
// verdict then states which instrument every fill figure came from.
//
// It also implements RI-UIX09 method 3's clause the builder reported as unimplemented —
// "a region of >= 3 distinct hues THAT IS NOT GLYPH INK" — by discarding the panel's modal ground
// and the ink colours before counting, which is the fix the builder wrote down and did not build.
//
// EXIT 0 = measured · 2 = could not measure.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { REPO_ROOT, parseArgs, log, ensureDir } from '../lib/cli.mjs';
import { labFromSrgb255, de2000 } from '../lib/colour.mjs';

const args = parseArgs();
const OUT = path.resolve(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r2c/reports'));
ensureDir(OUT);

// ---- a minimal PNG reader (RGBA8, non-interlaced) --------------------------------------------
function decodePNG(buf) {
  let p = 8; const idat = []; let w = 0, hh = 0, bd = 0, ct = 0;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); hh = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bd !== 8 || (ct !== 6 && ct !== 2)) throw new Error(`unsupported PNG: bitDepth=${bd} colourType=${ct}`);
  const ch = ct === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(w * hh * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < hh; y++) {
    const f = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      line[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      out[(y * w + x) * 4] = line[x * ch];
      out[(y * w + x) * 4 + 1] = line[x * ch + 1];
      out[(y * w + x) * 4 + 2] = line[x * ch + 2];
      out[(y * w + x) * 4 + 3] = ch === 4 ? line[x * ch + 3] : 255;
    }
    prev = line;
  }
  return { width: w, height: hh, data: out };
}

const key = (r, g, b) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

/** RI-UIX09 method 4, from the item's own sentence. */
function d2(png, rect) {
  const [rx, ry, rw, rh] = rect.map(Math.round);
  const x0 = Math.max(0, rx), y0 = Math.max(0, ry);
  const x1 = Math.min(png.width, rx + rw), y1 = Math.min(png.height, ry + rh);
  if (x1 <= x0 || y1 <= y0) return null;
  const hist = new Map();
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * png.width + x) * 4;
    const k = key(png.data[i], png.data[i + 1], png.data[i + 2]);
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  let bk = 0, bn = -1;
  for (const [k, n] of hist) if (n > bn) { bn = n; bk = k; }
  let sr = 0, sg = 0, sb = 0, sn = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * png.width + x) * 4;
    if (key(png.data[i], png.data[i + 1], png.data[i + 2]) !== bk) continue;
    sr += png.data[i]; sg += png.data[i + 1]; sb += png.data[i + 2]; sn++;
  }
  const mode = [Math.round(sr / sn), Math.round(sg / sn), Math.round(sb / sn)];
  const modeLab = labFromSrgb255(...mode);
  const memo = new Map();
  let differ = 0, total = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * png.width + x) * 4;
    const k = key(png.data[i], png.data[i + 1], png.data[i + 2]);
    let d = memo.get(k);
    if (d === undefined) { d = de2000(labFromSrgb255(png.data[i], png.data[i + 1], png.data[i + 2]), modeLab); memo.set(k, d); }
    total++; if (d > 6) differ++;
  }
  return { fill: +(differ / total).toFixed(4), mode_rgb: mode, pixels: total, rect: [x0, y0, x1 - x0, y1 - y0] };
}

/**
 * RI-UIX09 method 3, WITH the clause after the comma.
 *
 * The builder's version counted every distinct hue in the row's leading 48 px and so returned
 * 15/15 on an arm with zero icons. This one classifies each pixel against (a) the panel's modal
 * ground and (b) the ink colours, discards both, and reports the REMAINING distinct hues and the
 * remaining area fraction. A text-only row leaves ~0; a drawn object leaves a blob.
 */
function nonInkHues(png, x, y, w, hgt, groundLab, inkLabs) {
  const seen = [];
  let kept = 0, total = 0;
  const x1 = Math.min(png.width, Math.round(x + w)), y1 = Math.min(png.height, Math.round(y + hgt));
  for (let yy = Math.max(0, Math.round(y)); yy < y1; yy++) {
    for (let xx = Math.max(0, Math.round(x)); xx < x1; xx++) {
      const i = (yy * png.width + xx) * 4;
      const lab = labFromSrgb255(png.data[i], png.data[i + 1], png.data[i + 2]);
      total++;
      if (de2000(lab, groundLab) <= 6) continue;                 // the panel's own ground
      if (inkLabs.some((s) => de2000(lab, s) <= 12)) continue;    // glyph ink and its antialiasing
      kept++;
      if (!seen.some((s) => de2000(s, lab) <= 8)) seen.push(lab);
      if (seen.length > 12) return { hues: seen.length, kept, total, area: +(kept / total).toFixed(4) };
    }
  }
  return { hues: seen.length, kept, total, area: total ? +(kept / total).toFixed(4) : 0 };
}

// ---- run --------------------------------------------------------------------------------------
const SCREENDIR = path.join(REPO_ROOT, String(args.screens || 'corpus/90-verdicts/wave1/artifacts/T4-r2/screens'));
const LIVE = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/T4-r2/measure-live-1920x1080.json'), 'utf8'));

const out = { schema: 'elder-souls/t4-critic-measure@1', at: new Date().toISOString(), screens: {}, notes: [] };

for (const [name, rec] of Object.entries(LIVE.screens)) {
  const p = path.join(SCREENDIR, `live-${name}__1920x1080.png`);
  if (!fs.existsSync(p)) { out.screens[name] = { error: 'no capture on disk', path: p }; continue; }
  const png = decodePNG(fs.readFileSync(p));
  const rect = rec.panel_rect || (rec.ui && rec.ui.panel_rect) || null;
  const row = { capture: path.relative(REPO_ROOT, p), panel_rect: rect };
  if (rect) {
    row.d2_critic = d2(png, rect);
    row.d2_builder = rec.panel_fill ? rec.panel_fill.fill : null;
  }
  out.screens[name] = row;
}
fs.writeFileSync(path.join(OUT, 'critic-d2.json'), JSON.stringify(out, null, 2));
log(JSON.stringify(out, null, 2).slice(0, 4000));
export { decodePNG, d2, nonInkHues };
