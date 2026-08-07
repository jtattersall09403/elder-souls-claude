// settle.mjs — the anti-loophole half of S34, and the thing that makes placed captures safe.
//
// S34: "a placed capture must prove it is *settled*. Teleporting and photographing before terrain,
// props and lighting have streamed in produces a real picture of a world that does not exist,
// which is worse than a slow one. A capture is settled only if two frames taken some frames apart
// are stable within a declared threshold; an unsettled frame is an error, never a quiet pass."
//
// ---------------------------------------------------------------------------------------------
// WHY IMAGE STABILITY ALONE IS NOT SUFFICIENT, AND WHY THIS FILE HAS THREE GATES
// ---------------------------------------------------------------------------------------------
// Measured on this build before writing the gate: the province streamer is pumped from
// `engine.teleport()` and `engine._applyCell()` and from nowhere inside the fixed step
// (`sim/step.js` never touches `renderer.province`). So a camera posed at coordinates the player
// was never teleported to looks at a world with no tiles in it — and it goes on looking at the
// same empty world for as many frames as you care to step. Two frames twelve frames apart are
// then *byte-identical*, and a naive "two stable frames = settled" test passes a photograph of
// nothing. That is the exact loophole S34 exists to close, and stability alone opens it.
//
// So "settled" here means all three of:
//
//   G1  RESIDENCY   — the tiles the CAMERA needs are already built. Probed with
//                     `streamAround(camX, camZ, 0)`: a budget of 0 builds nothing, so the
//                     returned `queued` is a pure read of "how much of what this camera can see
//                     does not exist yet". Must be 0.
//   G2  QUIESCENCE  — the streamer has nothing outstanding at all (`tilesQueued === 0` in
//                     `getWorldStats().streaming`) and the residency probe built nothing.
//   G3  STABILITY   — two frames `gap` frames apart differ by no more than `threshold`.
//                     This is the gate that catches everything G1 and G2 cannot name: lighting
//                     that is still converging, props still popping, a sky still turning, an
//                     animation mid-blend.
//
// G1 and G2 answer "is the world there?". G3 answers "has it stopped moving?". A capture needs
// both questions answered and neither answers the other.
//
// ---------------------------------------------------------------------------------------------
// THE METRIC AND THE THRESHOLD
// ---------------------------------------------------------------------------------------------
// Metric: `changed_frac` — the fraction of pixels in a 384x216 thumbnail of the composited page
// whose largest per-channel absolute difference exceeds DELTA (8/255) between frame A and frame B.
//
// Thumbnail rather than the full frame because it is ~5 ms instead of ~600 ms of PNG round-trip
// per capture, and because it is read out of the same preserved drawing buffer the delivered PNG
// is composited from. A tile of terrain appearing covers thousands of thumbnail pixels; a rain
// streak covers a handful.
//
// DELTA = 8/255 rather than "any change": SwiftShader dithers, and an exactly-repeated draw of an
// unchanged scene is not always bit-identical. 8 is above that floor and far below any real
// content change.
//
// The threshold is `settle_threshold`, default 0.010 = 1% of pixels moved. It is chosen from
// measurement, and the measurement is in reports/capture/SETTLE-CALIBRATION.json — the point of
// the number is that it sits in an empty band between the two populations, so it can fire.
import { EXIT } from '../lib/cli.mjs';

export const THUMB_W = 384;
export const THUMB_H = 216;
export const DELTA = 8;

/**
 * Installed once per page. Composites every <canvas> in the document, in DOM order, into a
 * scratch 2D canvas — the same set of surfaces `page.screenshot()` composites — and returns the
 * raw RGBA bytes as a plain array so it crosses the CDP boundary.
 *
 * Read straight out of the live drawing buffer (the renderer sets `preserveDrawingBuffer: true`
 * for exactly this reason), so it is a measurement of the frame that is about to be delivered
 * and not of a separate re-render.
 */
export const THUMB_SOURCE = `
window.__CAPD_THUMB = function (tw, th) {
  var s = window.__CAPD_SCRATCH;
  if (!s || s.width !== tw || s.height !== th) {
    s = window.__CAPD_SCRATCH = document.createElement('canvas');
    s.width = tw; s.height = th;
    window.__CAPD_CTX = s.getContext('2d', { willReadFrequently: true });
  }
  var ctx = window.__CAPD_CTX;
  ctx.clearRect(0, 0, tw, th);
  var cs = document.querySelectorAll('canvas'), drew = 0;
  for (var i = 0; i < cs.length; i++) {
    var c = cs[i];
    if (c === s) continue;
    if (!c.width || !c.height) continue;
    var st = window.getComputedStyle ? window.getComputedStyle(c) : null;
    if (st && (st.display === 'none' || st.visibility === 'hidden')) continue;
    try { ctx.drawImage(c, 0, 0, tw, th); drew++; } catch (e) { /* tainted: skip */ }
  }
  var d = ctx.getImageData(0, 0, tw, th).data;
  return { n: drew, px: Array.prototype.slice.call(d) };
};
`;

/** Grab a thumbnail of the current frame. Returns Uint8Array RGBA of THUMB_W*THUMB_H. */
export async function thumbnail(page, w = THUMB_W, h = THUMB_H) {
  const r = await page.evaluate(([tw, th]) => window.__CAPD_THUMB(tw, th), [w, h]);
  if (!r || !r.px) throw new Error('__CAPD_THUMB returned nothing — thumbnail hook not installed');
  if (!r.n) throw new Error('__CAPD_THUMB found no drawable canvas in the page');
  return { px: Uint8Array.from(r.px), canvases: r.n };
}

/** Mean RGB per BLOCK x BLOCK block of a THUMB_W x THUMB_H RGBA buffer. */
export function blockMeans(px, w, h, block) {
  const bw = Math.ceil(w / block), bh = Math.ceil(h / block);
  const acc = new Float64Array(bw * bh * 3), cnt = new Float64Array(bw * bh);
  for (let y = 0; y < h; y++) {
    const by = (y / block) | 0;
    for (let x = 0; x < w; x++) {
      const bx = (x / block) | 0, bi = by * bw + bx, i = (y * w + x) * 4;
      acc[bi * 3] += px[i]; acc[bi * 3 + 1] += px[i + 1]; acc[bi * 3 + 2] += px[i + 2];
      cnt[bi]++;
    }
  }
  for (let i = 0; i < bw * bh; i++) { acc[i * 3] /= cnt[i]; acc[i * 3 + 1] /= cnt[i]; acc[i * 3 + 2] /= cnt[i]; }
  return { m: acc, bw, bh };
}

/** changed-fraction of blocks whose mean RGB moved by more than `delta` on any channel. */
export function blockDiff(a, b, w, h, block, delta = DELTA) {
  const A = blockMeans(a, w, h, block), B = blockMeans(b, w, h, block);
  const n = A.bw * A.bh;
  let changed = 0, maxd = 0, sum = 0;
  for (let i = 0; i < n; i++) {
    const dr = Math.abs(A.m[i * 3] - B.m[i * 3]);
    const dg = Math.abs(A.m[i * 3 + 1] - B.m[i * 3 + 1]);
    const db = Math.abs(A.m[i * 3 + 2] - B.m[i * 3 + 2]);
    const m = Math.max(dr, dg, db);
    if (m > delta) changed++;
    if (m > maxd) maxd = m;
    sum += m;
  }
  return { frac: changed / n, blocks: n, changed, max: maxd, mean: sum / n };
}

/**
 * THE SETTLE METRIC.
 *
 * `changed_frac` is the fraction of 24x24-pixel BLOCKS of a 384x216 thumbnail whose mean RGB moved
 * by more than 8/255 on any channel between the two frames. 16x9 = 144 blocks.
 *
 * Block means, not pixels, and this is the whole trick. Measured on this build (see
 * SETTLE-CALIBRATION.json): at per-pixel resolution a legitimately settled daytime frame moves
 * 0-6.8% of its pixels, because the world is *alive* — ground cover sways, rain falls, water
 * moves, the player idles. A frame that is genuinely still arriving moves 0.2-3.6%. The two
 * populations overlap completely and no per-pixel threshold can separate them.
 *
 * Ambient motion is high-frequency and roughly zero-mean over a 24x24 block, so it very nearly
 * cancels in the block mean. Terrain, props and lighting arriving are low-frequency and cover
 * whole blocks, so they do not cancel at all. The block mean is the filter that separates "the
 * world is moving" from "the world is still being built".
 */
export function diff(a, b, w = THUMB_W, h = THUMB_H) {
  if (a.length !== b.length) throw new Error('thumbnail size changed between frames');
  const n = a.length / 4;
  let changedPx = 0, sum = 0, maxd = 0;
  for (let i = 0; i < a.length; i += 4) {
    const dr = Math.abs(a[i] - b[i]), dg = Math.abs(a[i + 1] - b[i + 1]), db = Math.abs(a[i + 2] - b[i + 2]);
    const m = dr > dg ? (dr > db ? dr : db) : (dg > db ? dg : db);
    if (m > DELTA) changedPx++;
    if (m > maxd) maxd = m;
    sum += (dr + dg + db) / 3;
  }
  const b24 = blockDiff(a, b, w, h, 24);
  return {
    changed_frac: b24.frac,             // <- the gated metric
    changed_blocks: b24.changed,
    total_blocks: b24.blocks,
    max_block_delta: +b24.max.toFixed(3),
    mean_block_delta: +b24.mean.toFixed(4),
    // diagnostics, recorded but not gated
    px_changed_frac: changedPx / n,
    px_total: n,
    mean_abs_delta: sum / n,
    max_abs_delta: maxd,
    delta_floor: DELTA,
    block: 24,
  };
}

/** Every candidate metric on one frame pair — used by calibrate-settle.mjs only. */
export function metricFamily(a, b, w = THUMB_W, h = THUMB_H) {
  const out = { px: diff(a, b, w, h).px_changed_frac };
  for (const bs of [4, 8, 12, 24, 48]) {
    const d = blockDiff(a, b, w, h, bs);
    out['b' + bs] = d.frac;
    out['b' + bs + '_max'] = +d.max.toFixed(2);
    out['b' + bs + '_mean'] = +d.mean.toFixed(3);
  }
  return out;
}

/** G1 + G2: is the world the camera is looking at actually built and quiet? */
export async function residency(handle, camX, camZ) {
  // budget 0 => request() computes the want-set and queues, pump(0) builds nothing.
  // `queued` is therefore a pure read of "tiles this camera needs that do not exist".
  const probe = await handle.h('streamAround', camX, camZ, 0);
  const stats = await handle.hOpt('getWorldStats');
  const streaming = (stats && stats.streaming) || null;
  return {
    queued: probe ? probe.queued : null,
    built: probe ? probe.built : null,
    tiles_resident: streaming ? streaming.tilesResident : (probe ? probe.tilesResident : null),
    tiles_queued: streaming ? streaming.tilesQueued : (probe ? probe.tilesQueued : null),
    instances: probe ? probe.instances : null,
    meshes: probe ? probe.meshes : null,
  };
}

export class UnsettledError extends Error {
  constructor(proof) {
    super('capture is NOT settled: ' + (proof.failed || []).join('; '));
    this.name = 'UnsettledError';
    this.exitCode = EXIT.MEASUREMENT_FAIL;
    this.proof = proof;
  }
}

/**
 * Build the settle proof from the three gates' evidence and throw if any failed.
 * @returns the proof object recorded in the capture manifest.
 */
export function judge({ resid, d, threshold, gap, frames }) {
  const failed = [];
  if (resid.queued === null) failed.push('G1 residency: streamAround() did not report a queue depth');
  else if (resid.queued > 0) {
    failed.push(`G1 residency: ${resid.queued} tile(s) the camera can see are NOT built — this is a ` +
      'photograph of a world that does not exist yet');
  }
  if (resid.built > 0) failed.push(`G2 quiescence: the residency probe itself built ${resid.built} tile(s)`);
  if (resid.tiles_queued > 0) failed.push(`G2 quiescence: ${resid.tiles_queued} tile(s) still queued in the streamer`);
  if (!(d.changed_frac <= threshold)) {
    failed.push(`G3 stability: ${(d.changed_frac * 100).toFixed(3)}% of pixels moved between two frames ` +
      `${gap} frames apart, over a ${(threshold * 100).toFixed(3)}% threshold`);
  }
  const proof = {
    settled: failed.length === 0,
    gates: {
      G1_residency: { queued: resid.queued, pass: resid.queued === 0 },
      G2_quiescence: { built: resid.built, tiles_queued: resid.tiles_queued, tiles_resident: resid.tiles_resident, pass: resid.built === 0 && resid.tiles_queued === 0 },
      G3_stability: { changed_frac: +d.changed_frac.toFixed(6), threshold, pass: d.changed_frac <= threshold },
    },
    settle_frames: frames,
    gap_frames: gap,
    threshold,
    metric: 'changed_frac@384x216, per-channel delta > 8/255',
    measured: { changed_frac: +d.changed_frac.toFixed(6), changed_px: d.changed_px, total_px: d.total_px, mean_abs_delta: +d.mean_abs_delta.toFixed(4), max_abs_delta: d.max_abs_delta },
    failed,
  };
  if (failed.length) throw new UnsettledError(proof);
  return proof;
}
