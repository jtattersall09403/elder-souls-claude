#!/usr/bin/env node
/* CRITIC re-derivation of F7 r3's gradient_width_px, independent of the builder's tool.
 * The builder derives a SEPARATE water mask per arm (frame vs water-hidden, |dRGB|>6).
 * A lower-alpha arm makes near-shore water differ LESS from the hidden frame, so the mask
 * moves with the arm — and distanceFromLand is computed from that mask. This re-runs the
 * same profile with (i) each arm's own mask (reproduce), (ii) ONE pinned mask for all arms,
 * (iii) mask thresholds 4 and 10, to see whether the k ordering is a mask artefact. */
import fs from 'node:fs';
import path from 'node:path';
const REPO = '/home/user/elder-souls-claude';
const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));
const DIR = process.argv[2];
const POSE = process.argv[3] || 'topdown-120';
const CROP = [200, 760, 60, 480];

const rd = (p) => PNG.sync.read(fs.readFileSync(p));
function lum(png) {
  const y = new Float32Array(png.width * png.height);
  for (let i = 0, j = 0; i < png.data.length; i += 4, j++) y[j] = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
  return y;
}
function maskOf(png, base, thr) {
  const N = png.width * png.height, m = new Uint8Array(N);
  let n = 0;
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    const d = Math.abs(png.data[p] - base.data[p]) + Math.abs(png.data[p + 1] - base.data[p + 1]) + Math.abs(png.data[p + 2] - base.data[p + 2]);
    if (d > thr) { m[i] = 1; n++; }
  }
  return { m, n };
}
function distanceFromLand(water, W, H) {
  const N = W * H, d = new Float32Array(N);
  for (let i = 0; i < N; i++) d[i] = water[i] ? 1e9 : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!d[i]) continue; let m = d[i];
    if (y > 0) m = Math.min(m, d[i - W] + 3);
    if (x > 0) m = Math.min(m, d[i - 1] + 3);
    if (y > 0 && x > 0) m = Math.min(m, d[i - W - 1] + 4);
    if (y > 0 && x < W - 1) m = Math.min(m, d[i - W + 1] + 4);
    d[i] = m;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; if (!d[i]) continue; let m = d[i];
    if (y < H - 1) m = Math.min(m, d[i + W] + 3);
    if (x < W - 1) m = Math.min(m, d[i + 1] + 3);
    if (y < H - 1 && x < W - 1) m = Math.min(m, d[i + W + 1] + 4);
    if (y < H - 1 && x > 0) m = Math.min(m, d[i + W - 1] + 4);
    d[i] = m;
  }
  for (let i = 0; i < N; i++) d[i] /= 3;
  return d;
}
function profile(png, water, dist) {
  const y = lum(png), W = png.width, N = W * png.height;
  const MAXD = 48, sum = new Float64Array(MAXD + 1), cnt = new Float64Array(MAXD + 1);
  for (let i = 0; i < N; i++) {
    if (!water[i]) continue;
    const b = Math.round(dist[i]);
    if (b >= 1 && b <= MAXD) { sum[b] += y[i]; cnt[b]++; }
  }
  const prof = [];
  for (let b = 1; b <= MAXD; b++) prof.push(cnt[b] >= 40 ? sum[b] / cnt[b] : null);
  const usable = prof.map((v, i) => [i + 1, v]).filter(([, v]) => v !== null);
  if (usable.length < 12) return { width: null, reason: 'bins' };
  const nearBins = usable.filter(([d]) => d <= 2).map(([, v]) => v);
  const plat = usable.filter(([d]) => d >= 24).map(([, v]) => v).sort((a, b) => a - b);
  if (!nearBins.length || plat.length < 6) return { width: null, reason: 'anchor' };
  const first = nearBins.reduce((a, b) => a + b, 0) / nearBins.length;
  const last = plat[Math.floor(plat.length / 2)];
  const span = last - first;
  if (Math.abs(span) < 0.6) return { width: null, reason: 'span' };
  const at = (f) => { const t = first + span * f; for (const [d, v] of usable) if (span > 0 ? v >= t : v <= t) return d; return usable[usable.length - 1][0]; };
  const d10 = at(0.10), d90 = at(0.90);
  return { width: Math.max(1, d90 - d10), d10, d90, near: +first.toFixed(3), open: +last.toFixed(3), span: +span.toFixed(3), prof };
}

const ARMS = ['prefix', 'fixed', 'no-shorefade', 'null-const-trans', 'k-2.6-blackwood', 'k-1.4-topal', 'k-0.35-padomaic', 'nothing-restore-control'];
const ORD = { prefix: 0, fixed: 1, 'no-shorefade': 2, 'null-const-trans': 3, 'k-0.35-padomaic': 4, 'k-1.4-topal': 5, 'k-2.6-blackwood': 6, 'nothing-restore-control': 7 };
const F = (a) => path.join(DIR, 'frames', `${POSE}-${a}-o${ORD[a]}.png`);
const hidden = rd(path.join(DIR, 'frames', `water-hidden-${POSE}.png`));

for (const thr of [6, 4, 10]) {
  console.log(`\n### mask threshold |dRGB| > ${thr}`);
  // pinned mask: the untouched control's mask, used for EVERY arm
  const ctrl = rd(F('nothing-restore-control'));
  const pinned = maskOf(ctrl, hidden, thr);
  const pinnedDist = distanceFromLand(pinned.m, ctrl.width, ctrl.height);
  console.log('arm'.padEnd(26), 'ownMaskPx  ownW  ownD90 | pinnedW pinnedD90  pinNear  pinOpen');
  for (const a of ARMS) {
    const png = rd(F(a));
    const own = maskOf(png, hidden, thr);
    const ownP = profile(png, own.m, distanceFromLand(own.m, png.width, png.height));
    const pinP = profile(png, pinned.m, pinnedDist);
    console.log(a.padEnd(26), String(own.n).padStart(8), String(ownP.width).padStart(5), String(ownP.d90).padStart(6), '|',
      String(pinP.width).padStart(7), String(pinP.d90).padStart(9), String(pinP.near).padStart(8), String(pinP.open).padStart(8));
  }
}
