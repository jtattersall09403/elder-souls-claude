#!/usr/bin/env node
/**
 * f10-r12-motion-pixels.mjs — DOES THE BREATHING REACH THE SCREEN?
 *
 * A bone-rotation delta is not a picture. `CLAUDE.md`'s character directive is explicit that
 * stills are not enough and that a builder must look at the running game in motion; the counterpart
 * obligation is that a MOTION claim must be shown in pixels and not only in radians. So this takes
 * the motion frames a capture shot from ONE FIXED CAMERA at increasing frame offsets and asks how
 * many pixels changed and by how much.
 *
 * THE ARM THAT MAKES IT MEAN SOMETHING, and without it the number is worthless: the camera is
 * identical across the pair by construction (same `pos`, same `look`, same fov — the capture's own
 * manifest carries all three), so ANY pixel difference is the scene, not the view. The
 * required-to-disagree control is a frame compared with ITSELF, which must read exactly 0 changed
 * pixels — if it does not, the capture is non-deterministic and every number below is noise.
 *
 * `RI-VIS10` C3 (b2) is measured on bones, not here. This is corroboration, and it is reported as
 * corroboration: a SwiftShader frame supports no appearance claim (`W1-30-EVIDENCE` §4), and none
 * is made — "these pixels changed" is a geometry/composition statement, which SwiftShader is
 * admitted for.
 *
 * Usage: node tools/visual/f10-r12-motion-pixels.mjs --dir <shots dir> [--json out.json]
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const args = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  args[k] = v === undefined ? true : v;
}

/** Minimal PNG reader — 8-bit RGB/RGBA, non-interlaced, which is what the capture writes. */
function readPNG(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file}: not a PNG`);
  let p = 8; let w = 0, h = 0, bd = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; if (data[12] !== 0) throw new Error('interlaced PNG unsupported'); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bd !== 8 || (ct !== 2 && ct !== 6)) throw new Error(`${file}: unsupported bit depth ${bd} / colour type ${ct}`);
  const ch = ct === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let q = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[q++];
    const line = raw.subarray(q, q + stride); q += stride;
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0; const b = prev[x]; const c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c; const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}

function diff(A, B, thresh) {
  if (A.w !== B.w || A.h !== B.h) throw new Error('size mismatch');
  let changed = 0, sum = 0, worst = 0;
  const n = A.w * A.h;
  for (let i = 0; i < n; i++) {
    const a = i * A.ch, b = i * B.ch;
    const d = Math.max(Math.abs(A.data[a] - B.data[b]), Math.abs(A.data[a + 1] - B.data[b + 1]), Math.abs(A.data[a + 2] - B.data[b + 2]));
    if (d > thresh) changed++;
    sum += d; if (d > worst) worst = d;
  }
  return { pixels: n, changed, changed_pct: +(100 * changed / n).toFixed(4), mean_abs_delta: +(sum / n).toFixed(4), worst_channel_delta: worst };
}

const DIR = resolve(ROOT, String(args.dir || 'reports/visual-truth/f10-r12-look'));
const shots = readdirSync(DIR).filter((f) => /^motion-t\d+\.png$/.test(f)).sort();
if (shots.length < 2) { process.stdout.write(JSON.stringify({ error: 'need at least two motion-tNNN.png frames', dir: DIR, found: shots }, null, 2) + '\n'); process.exit(1); }
const THRESH = Number(args.thresh ?? 1);
const imgs = shots.map((f) => ({ f, img: readPNG(join(DIR, f)) }));
const out = {
  tool: 'tools/visual/f10-r12-motion-pixels.mjs', dir: DIR, threshold_channel_delta: THRESH,
  what_this_is: 'ONE FIXED CAMERA, frames at increasing sim-frame offsets. The camera pose is identical across the pair by construction, so any changed pixel is the scene.',
  no_appearance_claim: 'SwiftShader. W1-30-EVIDENCE §4 admits geometry/composition/determinism and refuses appearance; this is a geometry statement.',
  CONTROL_frame_against_itself: diff(imgs[0].img, imgs[0].img, THRESH),
  pairs: imgs.slice(1).map((x) => ({ a: imgs[0].f, b: x.f, ...diff(imgs[0].img, x.img, THRESH) })),
  consecutive: imgs.slice(1).map((x, i) => ({ a: imgs[i].f, b: x.f, ...diff(imgs[i].img, x.img, THRESH) })),
};
out.CONTROL_ok = out.CONTROL_frame_against_itself.changed === 0;
out.pass = out.CONTROL_ok && out.pairs.every((p) => p.changed > 0);
if (args.json) writeFileSync(resolve(ROOT, String(args.json)), JSON.stringify(out, null, 1));
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
process.exit(out.pass ? 0 : 1);
