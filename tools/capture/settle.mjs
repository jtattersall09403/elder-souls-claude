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
//   G3  STABILITY   — two frames `gap` frames apart differ by no more than `threshold`, once the
//                     scene's own ambient motion has been subtracted (see the metric note below).
//                     This is the gate that catches everything G1 and G2 cannot name: content
//                     arriving by a route other than the tile streamer, props still popping, a
//                     sky still turning, an animation mid-blend.
//
// G1 and G2 answer "is the world there?". G3 answers "has it stopped moving?". A capture needs
// both questions answered and neither answers the other.
//
// Both halves of this are measured, not assumed. See reports/capture/SETTLE-CALIBRATION.json:
// 5 of 5 "absent" controls (camera posed where the player has never been, nothing streamed)
// produced two BYTE-IDENTICAL frames — changed_frac 0.000000 — with 19-25 tiles unbuilt. A gate
// made only of image stability passes every one of them.
//
// ---------------------------------------------------------------------------------------------
// THE METRIC AND THE THRESHOLD
// ---------------------------------------------------------------------------------------------
// The obvious metric does not work, and the calibration says so in one line. This world is ALIVE:
// ground cover sways, ash falls, rain falls, water moves. Over a 12-frame gap a legitimately
// settled frame moves up to 8.7% of its pixels (eastern-rootlands, day-clear) while a frame with
// terrain still arriving can move as little as 0.6%. `separated: false` at every block size from
// 4 to 48 px. No absolute two-frame threshold can tell "the world is moving" from "the world is
// still being built", because the first is larger than the second.
//
// So the metric is AMBIENT-CORRECTED. Three frames rather than two:
//
//     A at t,  B at t+gap,  C at t+2*gap
//     d1 = |A-B|,  d2 = |B-C|,  excess = max(0, d1 - d2)
//
// d2 is the scene's own liveness, measured in the same place, under the same conditions, over the
// same gap. Subtracting it leaves only change that happened in the FIRST interval and not the
// second — which is exactly the signature of content arriving and then stopping. Ambient motion is
// quasi-stationary over 0.2 s and cancels; arrival does not.
//
// |A-B| itself is the fraction of 4x4-pixel BLOCKS of a 384x216 thumbnail whose mean RGB moved by
// more than 8/255 on any channel. Blocks rather than pixels because SwiftShader dithers and
// per-pixel noise is not signal; 8/255 rather than "any change" for the same reason. The thumbnail
// is read straight out of the preserved drawing buffer the delivered PNG is composited from, so it
// costs ~5 ms rather than the ~600 ms a PNG round-trip would.
//
// MEASURED, 13 regions x 4 condition sets settled, 5 partial-stream, 5 absent (GAP=12):
//
//     settled    excess <= 0.00251     (10 of 13 exactly 0)
//     lighting   excess == 0           (n=5; this build converges lighting in one frame)
//     streaming  excess in [0.01157, 0.14120]   (n=5)
//     absent     excess == 0           (n=5)  <- G1's job, not G3's
//
// THRESHOLD = 0.005. It is the geometric middle of the empty band [0.00251, 0.01157]: 2.0x above
// the worst settled frame and 2.3x below the mildest streaming one. It CAN fire — it fires on all
// five partial-stream cases — and it is not a number picked to be unreachable.
//
// GAP = 12 frames (0.2 s at 60 Hz). Long enough that a streamer pump lands visibly between A and
// B; short enough that ambient motion is still quasi-stationary across the two intervals, which is
// what makes the subtraction valid (settled |d1 - d2| <= 0.0025 across all 13 regions).
//
// The cost is one extra render per capture, and it buys the only form of this gate that works.
import { EXIT } from '../lib/cli.mjs';

export const THUMB_W = 384;
export const THUMB_H = 216;
export const DELTA = 8;
export const BLOCK = 4;
/** The declared settle threshold. See the calibration note above. */
export const THRESHOLD = 0.005;
/** Frames between A and B, and between B and C. */
export const GAP = 12;

/**
 * Installed once per page. Provides two hooks:
 *
 *   __CAPD_SNAP(slot)      composite every <canvas> in the document, in DOM order — the same set
 *                          of surfaces page.screenshot() composites — into a 384x216 scratch
 *                          canvas and keep it under `slot`.
 *   __CAPD_DIFF(s1, s2)    compare two slots and return the aggregates.
 *
 * Read straight out of the live drawing buffer (the renderer sets `preserveDrawingBuffer: true`
 * for exactly this reason), so it measures the frame that is about to be delivered rather than a
 * separate re-render. The pixels stay in the page; only the aggregates cross the CDP boundary.
 */
export const THUMB_SOURCE = `
(function () {
  var W = ${THUMB_W}, H = ${THUMB_H}, DELTA = ${DELTA}, BLOCK = ${BLOCK};
  var slots = {};
  function grab() {
    var s = window.__CAPD_SCRATCH;
    if (!s) {
      s = window.__CAPD_SCRATCH = document.createElement('canvas');
      s.width = W; s.height = H;
      window.__CAPD_CTX = s.getContext('2d', { willReadFrequently: true });
    }
    var ctx = window.__CAPD_CTX;
    ctx.clearRect(0, 0, W, H);
    var cs = document.querySelectorAll('canvas'), drew = 0;
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i];
      if (c === s || !c.width || !c.height) continue;
      var st = window.getComputedStyle ? window.getComputedStyle(c) : null;
      if (st && (st.display === 'none' || st.visibility === 'hidden')) continue;
      try { ctx.drawImage(c, 0, 0, W, H); drew++; } catch (e) { /* tainted */ }
    }
    return { px: ctx.getImageData(0, 0, W, H).data, drew: drew };
  }
  // Block means, computed in-page. The pixels NEVER cross the CDP boundary: marshalling a
  // 384x216 RGBA buffer as a JSON array is ~330k numbers and costs more than the render it is
  // supposed to be measuring. Only the aggregates come back.
  function means(px) {
    var bw = Math.ceil(W / BLOCK), bh = Math.ceil(H / BLOCK);
    var acc = new Float64Array(bw * bh * 3), cnt = new Float64Array(bw * bh);
    for (var y = 0; y < H; y++) {
      var by = (y / BLOCK) | 0;
      for (var x = 0; x < W; x++) {
        var bi = by * bw + ((x / BLOCK) | 0), i = (y * W + x) * 4;
        acc[bi * 3] += px[i]; acc[bi * 3 + 1] += px[i + 1]; acc[bi * 3 + 2] += px[i + 2]; cnt[bi]++;
      }
    }
    for (var k = 0; k < bw * bh; k++) { acc[k * 3] /= cnt[k]; acc[k * 3 + 1] /= cnt[k]; acc[k * 3 + 2] /= cnt[k]; }
    return { m: acc, n: bw * bh };
  }
  /** Take a frame into a named slot. Returns how many canvases were composited. */
  window.__CAPD_SNAP = function (slot) {
    var g = grab();
    slots[slot] = { blocks: means(g.px), px: g.px.slice(0), drew: g.drew };
    return g.drew;
  };
  /** Compare two slots. Returns the aggregates only. */
  window.__CAPD_DIFF = function (s1, s2) {
    var A = slots[s1], B = slots[s2];
    if (!A || !B) throw new Error('__CAPD_DIFF: missing slot ' + (A ? s2 : s1));
    var n = A.blocks.n, changed = 0, maxd = 0, sum = 0;
    for (var i = 0; i < n; i++) {
      var dr = Math.abs(A.blocks.m[i * 3] - B.blocks.m[i * 3]);
      var dg = Math.abs(A.blocks.m[i * 3 + 1] - B.blocks.m[i * 3 + 1]);
      var db = Math.abs(A.blocks.m[i * 3 + 2] - B.blocks.m[i * 3 + 2]);
      var m = dr > dg ? (dr > db ? dr : db) : (dg > db ? dg : db);
      if (m > DELTA) changed++;
      if (m > maxd) maxd = m;
      sum += m;
    }
    // per-pixel diagnostics, recorded but not gated
    var px = 0, tot = A.px.length / 4;
    for (var j = 0; j < A.px.length; j += 4) {
      var pr = Math.abs(A.px[j] - B.px[j]), pg = Math.abs(A.px[j + 1] - B.px[j + 1]), pb = Math.abs(A.px[j + 2] - B.px[j + 2]);
      var pm = pr > pg ? (pr > pb ? pr : pb) : (pg > pb ? pg : pb);
      if (pm > DELTA) px++;
    }
    return {
      frac: changed / n, changed_blocks: changed, total_blocks: n,
      max_block_delta: maxd, mean_block_delta: sum / n,
      px_changed_frac: px / tot, px_total: tot, block: BLOCK, delta_floor: DELTA,
    };
  };
  window.__CAPD_READY = true;
})();
`;

/** Take frame `slot`. Returns the number of canvases composited (0 means nothing was drawable). */
export async function snap(page, slot) {
  const n = await page.evaluate((s) => {
    if (!window.__CAPD_SNAP) throw new Error('__CAPD_SNAP hook not installed');
    return window.__CAPD_SNAP(s);
  }, slot);
  if (!n) throw new Error('settle: no drawable canvas found in the page');
  return n;
}

/** Compare two taken frames. All arithmetic happens in-page; only aggregates cross. */
export async function diffSlots(page, s1, s2) {
  return page.evaluate(([a, b]) => window.__CAPD_DIFF(a, b), [s1, s2]);
}

/** Pixel-returning thumbnail. Used ONLY by calibrate-settle.mjs, which needs the raw buffers to
 *  compare candidate metrics offline. The daemon never calls this — see snap()/diffSlots(). */
export async function thumbnail(page, w = THUMB_W, h = THUMB_H) {
  const r = await page.evaluate(([tw, th]) => {
    const s = document.createElement('canvas');
    s.width = tw; s.height = th;
    const ctx = s.getContext('2d', { willReadFrequently: true });
    const cs = document.querySelectorAll('canvas');
    let drew = 0;
    for (const c of cs) {
      if (!c.width || !c.height) continue;
      const st = window.getComputedStyle ? window.getComputedStyle(c) : null;
      if (st && (st.display === 'none' || st.visibility === 'hidden')) continue;
      try { ctx.drawImage(c, 0, 0, tw, th); drew++; } catch (e) { /* */ }
    }
    return { n: drew, px: Array.prototype.slice.call(ctx.getImageData(0, 0, tw, th).data) };
  }, [w, h]);
  if (!r || !r.px) throw new Error('thumbnail hook returned nothing');
  if (!r.n) throw new Error('no drawable canvas in the page');
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
 * One interval's change: the fraction of BLOCK x BLOCK blocks of the thumbnail whose mean RGB
 * moved by more than DELTA on any channel. This is d1 or d2 — never the gated quantity on its
 * own. The gated quantity is `excess`, below.
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
  const bd = blockDiff(a, b, w, h, BLOCK);
  return {
    frac: bd.frac,
    changed_blocks: bd.changed,
    total_blocks: bd.blocks,
    max_block_delta: +bd.max.toFixed(3),
    px_changed_frac: changedPx / n,
    px_total: n,
    mean_abs_delta: sum / n,
    max_abs_delta: maxd,
    block: BLOCK,
    delta_floor: DELTA,
  };
}

/**
 * The gated quantity. `excess = max(0, d1 - d2)` — the first interval's change with the scene's
 * own ambient-motion floor (the second interval) subtracted out.
 */
export function excessOf(d1, d2) {
  return {
    excess: Math.max(0, d1.frac - d2.frac),
    d1: +d1.frac.toFixed(6),
    d2: +d2.frac.toFixed(6),
    ambient_floor: +d2.frac.toFixed(6),
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
export function judge({ resid, d1, d2, threshold = THRESHOLD, gap = GAP, frames }) {
  const e = excessOf(d1, d2);
  const failed = [];
  if (resid.queued === null || resid.queued === undefined) {
    failed.push('G1 residency: streamAround() did not report a queue depth');
  } else if (resid.queued > 0) {
    failed.push(`G1 residency: ${resid.queued} tile(s) inside the camera's own streaming radius are ` +
      'NOT built. This would be a photograph of a world that does not exist yet. (Measured: a ' +
      'camera posed where the player has never been renders an empty world and goes on rendering ' +
      'the SAME empty world, so the two-frame stability test alone passes it — see ' +
      'reports/capture/SETTLE-CALIBRATION.json, population "absent".)');
  }
  if (resid.built > 0) failed.push(`G2 quiescence: the residency probe itself built ${resid.built} tile(s)`);
  if (resid.tiles_queued > 0) failed.push(`G2 quiescence: ${resid.tiles_queued} tile(s) still queued in the streamer`);
  if (!(e.excess <= threshold)) {
    failed.push(`G3 stability: ambient-corrected change between frames A(t) and B(t+${gap}) was ` +
      `${(e.excess * 100).toFixed(4)}% of blocks, over the declared ${(threshold * 100).toFixed(3)}% ` +
      `threshold (d1=${e.d1}, ambient floor d2=${e.d2}). Something was still arriving when the ` +
      'picture was taken.');
  }
  const proof = {
    settled: failed.length === 0,
    method: 'S34 settle proof: three frames A(t), B(t+gap), C(t+2*gap); gated on ' +
      'excess = max(0, |A-B| - |B-C|), plus a positive residency read of the streamer',
    gates: {
      G1_residency: { queued: resid.queued, tiles_resident: resid.tiles_resident, pass: resid.queued === 0 },
      G2_quiescence: { built: resid.built, tiles_queued: resid.tiles_queued, pass: resid.built === 0 && resid.tiles_queued === 0 },
      G3_stability: { excess: +e.excess.toFixed(6), d1: e.d1, ambient_floor_d2: e.d2, threshold, pass: e.excess <= threshold },
    },
    settle_frames: frames,
    gap_frames: gap,
    threshold,
    metric: `excess = max(0, |A-B| - |B-C|); |X-Y| = fraction of ${BLOCK}x${BLOCK} blocks of a ` +
      `${THUMB_W}x${THUMB_H} thumbnail whose mean RGB moved > ${DELTA}/255 on any channel`,
    calibration: 'reports/capture/SETTLE-CALIBRATION.json',
    measured: {
      excess: +e.excess.toFixed(6),
      d1: e.d1,
      d2_ambient_floor: e.d2,
      d1_px_changed_frac: +d1.px_changed_frac.toFixed(6),
      d1_changed_blocks: d1.changed_blocks,
      total_blocks: d1.total_blocks,
    },
    failed,
  };
  if (failed.length) throw new UnsettledError(proof);
  return proof;
}
