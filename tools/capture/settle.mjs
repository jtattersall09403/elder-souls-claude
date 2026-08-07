// settle.mjs — the anti-loophole half of S34, and the thing that makes placed captures safe.
// REBUILT after CAPTURE-SERVICE-R1 certified three shapes of unsettled world as SETTLED.
//
// S34: "a placed capture must prove it is *settled*. Teleporting and photographing before terrain,
// props and lighting have streamed in produces a real picture of a world that does not exist,
// which is worse than a slow one. A capture is settled only if two frames taken some frames apart
// are stable within a declared threshold; an unsettled frame is an error, never a quiet pass."
//
// =================================================================================================
// WHY IMAGE STABILITY ALONE IS NOT SUFFICIENT (unchanged, and it survived the critic)
// =================================================================================================
// The province streamer is pumped from `engine.teleport()` and `engine._applyCell()` and from
// nowhere inside the fixed step. So a camera posed at coordinates the player was never teleported
// to looks at a world with no tiles in it — and goes on looking at the same empty world for as many
// frames as you care to step. Two frames twelve frames apart are then *byte-identical*, and a naive
// "two stable frames = settled" test passes a photograph of nothing. 5 of 5 "absent" controls in
// reports/capture/SETTLE-CALIBRATION.json produced changed_frac 0.000000 with 19-25 tiles unbuilt.
//
// So "settled" means all of:
//
//   G1  RESIDENCY   — the tiles the CAMERA needs are already built.
//   G2  QUIESCENCE  — the streamer has nothing outstanding.
//   G3  STABILITY   — the picture has stopped CHANGING, in the three senses below.
//
// =================================================================================================
// WHAT THE R1 CRITIC BROKE, AND WHAT REPLACES IT
// =================================================================================================
// The old G3 was one number: `excess = max(0, d1 - d2) <= threshold`, where d1 = |A-B| and
// d2 = |B-C|. `max(0, ·)` means d2 is never looked at once it exceeds d1, and subtracting d2
// removes any change that is STEADY across all three frames. The critic fed the service's own
// judge() three shapes of change at its own threshold and all three were certified SETTLED:
//
//   | world                                                   | d1    | d2    | excess | old verdict |
//   | steady arrival, 30% of blocks per interval, still going  | 0.30  | 0.30  | 0      | SETTLED     |
//   | slow loader, still arriving across both intervals        | 0.060 | 0.055 | 0.005  | SETTLED     |
//   | accelerating: the world explodes AFTER the shipped frame | 0.02  | 0.14  | 0      | SETTLED     |
//
// The third is the worst: B is the frame that SHIPS, and d2 is B's own interval. A d2 fifty-six
// times the threshold was not looked at at all.
//
// And the calibration that justified the threshold was void as a validation of G3: all five
// streaming samples had d2 = 0 and `queued` of 18-23, so **G1 refuses all five on its own**. There
// was not one sample in which G3 was the gate that had to fire. See SETTLE-CALIBRATION-R2.json,
// which fixes that.
//
// -------------------------------------------------------------------------------------------------
// G3 IS NOW THREE SUB-GATES OVER THE SAME THREE FRAMES. NO EXTRA FRAME IS TAKEN.
// -------------------------------------------------------------------------------------------------
//   G3a  DECELERATION  excess = max(0, d1 - d2) <= threshold
//        Content that arrived in the first interval and then stopped. This is the original gate and
//        it is kept unchanged: its band, [0.00251, 0.01157], is real and was measured.
//
//   G3b  ACCELERATION  rise = max(0, d2 - d1); FAILS if rise > RISE_ABS AND d2 > RISE_RATIO * d1
//        Content arriving *after* the delivered frame. Two conditions ANDed, because neither works
//        alone: the settled eastern-rootlands frame has rise = 0.0149 (an absolute bound at the
//        threshold would refuse it) while the settled thornmarsh frame has d2/d1 = 1.77 (a ratio
//        bound alone would refuse that). Of the 18 G1-clean calibration frames only ONE has
//        rise > RISE_ABS, and its ratio is 1.116 against a bound of 1.5. The accelerating case above
//        has rise = 0.12 and a ratio of 7.0.
//
//   G3c  ACCUMULATION  gamma = d13 / max(d1, d2), where d13 = |A-C|; FAILS if gamma > ACC_RATIO
//        This is the sub-gate that catches STEADY arrival, and it needs information the old metric
//        never collected. Ambient motion is STATIONARY: the cover sways, the rain falls, the water
//        moves, and the SAME blocks keep moving, so A and C are no further apart than A and B are.
//        Arrival ACCUMULATES: different blocks change in each interval and the changes add, so
//        |A-C| approaches |A-B| + |B-C|. gamma is ~1 for a live-but-settled scene and ~2 for a
//        steady arrival, and it costs NOTHING — A and C are frames the proof already holds.
//        `overlap` (how many of the blocks that moved in the first interval moved again in the
//        second) is recorded beside it as corroboration.
//
// **THE HONEST LIMIT, STATED PLAINLY.** The critic's "slow loader" (d1 = 0.060, d2 = 0.055) and the
// measured settled marauders-coast frame (d1 = 0.0644, d2 = 0.0640) are NUMERICALLY THE SAME PAIR.
// No function of (d1, d2) can certify one and refuse the other; a gate that appears to is guessing,
// and the guess will be wrong for whichever population it was not tuned on. That is why G3c exists
// and why `judge()` REFUSES to rule when d13 is absent rather than falling back to (d1, d2). A gate
// that cannot see the evidence it needs must fail closed, not improvise.
//
// -------------------------------------------------------------------------------------------------
// G1 AND G2 NO LONGER FAIL OPEN, AND G1 NO LONGER DESTROYS WHAT IT MEASURES
// -------------------------------------------------------------------------------------------------
// The old code wrapped the residency read in try/catch and substituted
// `{queued: 0, built: 0, tiles_queued: 0, not_in_province: true}`, after which judge() recorded
// `G1 pass: true` and did not copy `not_in_province` into the proof. A manifest saying
// "settled: true, G1 pass: true" could mean "the gate ran and the world was there" or "the gate
// never ran", and no reader could tell. Now every gate carries `ran: true|false` and a gate that
// did not run FAILS. A gate that cannot report its own absence is the defect this project has
// rejected twice.
//
// And the probe itself was destructive. `streamAround(x, z, 0)` is documented as a pure read
// because a budget of 0 builds nothing — but `province.request()` re-focuses the streamer, rebuilds
// three camera-following discs and RELEASES every resident tile outside the new want-set before any
// budget is consulted. The critic measured it take tilesResident 25 -> 0 and meshes 247 -> 5,
// between frames A and B. G1 now uses `__HARNESS.provinceResidency(x, z)` (game/src/harness/api.js),
// which computes the same want-set from the streamer's own declared geometry and reads
// `province.tiles` / `province.queue` without touching the scene. If that verb is absent from the
// build, G1 FAILS — it does not silently fall back to the destructive probe.
//
// =================================================================================================
// THE METRIC
// =================================================================================================
// |X-Y| is the fraction of 4x4-pixel BLOCKS of a 384x216 thumbnail whose mean RGB moved by more
// than 8/255 on any channel. Blocks rather than pixels because SwiftShader dithers and per-pixel
// noise is not signal. The thumbnail is read straight out of the preserved drawing buffer the
// delivered PNG is composited from, so it costs ~5 ms rather than the ~600 ms of a PNG round-trip,
// and the pixels never cross the CDP boundary (marshalling them as JSON cost more than the render).
//
// GAP = 12 frames (0.2 s at 60 Hz). Long enough that a streamer pump lands visibly between A and B;
// short enough that ambient motion is quasi-stationary across the two intervals.
import { EXIT } from '../lib/cli.mjs';

export const THUMB_W = 384;
export const THUMB_H = 216;
export const DELTA = 8;
export const BLOCK = 4;

/** G3a. The deceleration threshold. Unchanged from R1: measured band [0.00251, 0.01157]. */
export const THRESHOLD = 0.005;
/** G3b. Absolute floor below which a rise is noise. See SETTLE-CALIBRATION-R2.json. */
export const RISE_ABS = 0.005;
/** G3b. A rise must ALSO be this multiple of d1 before it fails. */
export const RISE_RATIO = 1.5;
/** G3c. gamma = |A-C| / max(|A-B|, |B-C|). Stationary ~1, accumulating ~2. Calibrated in R2. */
export const ACC_RATIO = 1.35;
/** G3c. Below this much total motion gamma is meaningless (a handful of blocks). */
export const ACC_FLOOR = 0.004;
/** Frames between A and B, and between B and C. */
export const GAP = 12;

/**
 * Installed once per page. Provides:
 *
 *   __CAPD_SNAP(slot)        composite every <canvas> in the document, in DOM order — the same set
 *                            of surfaces page.screenshot() composites — into a 384x216 scratch
 *                            canvas and keep it under `slot`.
 *   __CAPD_DIFF(s1, s2)      compare two slots; aggregates only.
 *   __CAPD_TRIAD(a, b, c)    compare all THREE pairs at once and report the changed-block set
 *                            structure as well as the fractions. This is what G3c reads, and it is
 *                            free: the block means for all three slots are already in the page.
 *
 * Read straight out of the live drawing buffer (`preserveDrawingBuffer: true`), so it measures the
 * frame that is about to be delivered rather than a separate re-render.
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
  /** The per-block changed MASK between two slots, plus the aggregates. */
  function pair(A, B) {
    var n = A.blocks.n, changed = 0, maxd = 0, sum = 0;
    var mask = new Uint8Array(n);
    for (var i = 0; i < n; i++) {
      var dr = Math.abs(A.blocks.m[i * 3] - B.blocks.m[i * 3]);
      var dg = Math.abs(A.blocks.m[i * 3 + 1] - B.blocks.m[i * 3 + 1]);
      var db = Math.abs(A.blocks.m[i * 3 + 2] - B.blocks.m[i * 3 + 2]);
      var m = dr > dg ? (dr > db ? dr : db) : (dg > db ? dg : db);
      if (m > DELTA) { changed++; mask[i] = 1; }
      if (m > maxd) maxd = m;
      sum += m;
    }
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
      __mask: mask,
    };
  }
  function strip(d) { var o = {}; for (var k in d) if (k !== '__mask') o[k] = d[k]; return o; }
  /** Compare two slots. Returns the aggregates only. */
  window.__CAPD_DIFF = function (s1, s2) {
    var A = slots[s1], B = slots[s2];
    if (!A || !B) throw new Error('__CAPD_DIFF: missing slot ' + (A ? s2 : s1));
    return strip(pair(A, B));
  };
  /**
   * All three pairs of a triad, plus the SET STRUCTURE of the changed blocks.
   *
   * G3c's question is not "how much moved" but "did the SAME thing keep moving". Ambient motion is
   * stationary — the cover that swayed between A and B is the cover that sways between B and C, so
   * the two changed-block sets overlap and |A-C| is no bigger than either. Arrival is not: new
   * content lands in new blocks and stays, so the sets are near-disjoint and |A-C| approaches their
   * sum. Both readings come out of masks that already exist.
   */
  window.__CAPD_TRIAD = function (sa, sb, sc) {
    var A = slots[sa], B = slots[sb], C = slots[sc];
    if (!A || !B || !C) throw new Error('__CAPD_TRIAD: missing slot ' + (!A ? sa : (!B ? sb : sc)));
    var d1 = pair(A, B), d2 = pair(B, C), d13 = pair(A, C);
    var n = d1.total_blocks, both = 0, either = 0;
    for (var i = 0; i < n; i++) {
      var a = d1.__mask[i], b = d2.__mask[i];
      if (a && b) both++;
      if (a || b) either++;
    }
    var mn = Math.min(d1.changed_blocks, d2.changed_blocks);
    return {
      d1: strip(d1), d2: strip(d2), d13: strip(d13),
      set: {
        changed_1: d1.changed_blocks, changed_2: d2.changed_blocks, changed_13: d13.changed_blocks,
        both: both, either: either, total_blocks: n,
        overlap: mn > 0 ? both / mn : null,
        jaccard: either > 0 ? both / either : null,
      },
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

/** All three pairs of A, B, C plus the changed-block set structure. G3's whole evidence. */
export async function triad(page, sa = 'A', sb = 'B', sc = 'C') {
  return page.evaluate(([a, b, c]) => {
    if (!window.__CAPD_TRIAD) throw new Error('__CAPD_TRIAD hook not installed');
    return window.__CAPD_TRIAD(a, b, c);
  }, [sa, sb, sc]);
}

/** Pixel-returning thumbnail. Used ONLY by the calibrators, which need raw buffers to compare
 *  candidate metrics offline. The daemon never calls this — see snap()/diffSlots()/triad(). */
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
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const dr = Math.abs(A.m[i * 3] - B.m[i * 3]);
    const dg = Math.abs(A.m[i * 3 + 1] - B.m[i * 3 + 1]);
    const db = Math.abs(A.m[i * 3 + 2] - B.m[i * 3 + 2]);
    const m = Math.max(dr, dg, db);
    if (m > delta) { changed++; mask[i] = 1; }
    if (m > maxd) maxd = m;
    sum += m;
  }
  return { frac: changed / n, blocks: n, changed, max: maxd, mean: sum / n, mask };
}

/**
 * One interval's change: the fraction of BLOCK x BLOCK blocks of the thumbnail whose mean RGB
 * moved by more than DELTA on any channel. This is d1, d2 or d13 — never the gated quantity on its
 * own.
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
    mask: bd.mask,
  };
}

/** The whole of G3's evidence from three raw thumbnails. Offline twin of `__CAPD_TRIAD`. */
export function triadOf(a, b, c, w = THUMB_W, h = THUMB_H) {
  const d1 = diff(a, b, w, h), d2 = diff(b, c, w, h), d13 = diff(a, c, w, h);
  let both = 0, either = 0;
  for (let i = 0; i < d1.mask.length; i++) {
    if (d1.mask[i] && d2.mask[i]) both++;
    if (d1.mask[i] || d2.mask[i]) either++;
  }
  const mn = Math.min(d1.changed_blocks, d2.changed_blocks);
  return {
    d1, d2, d13,
    set: {
      changed_1: d1.changed_blocks, changed_2: d2.changed_blocks, changed_13: d13.changed_blocks,
      both, either, total_blocks: d1.total_blocks,
      overlap: mn > 0 ? both / mn : null,
      jaccard: either > 0 ? both / either : null,
    },
  };
}

/** Every candidate metric on one frame pair — used by the calibrators only. */
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

/**
 * G1 + G2: is the world the camera is looking at actually built and quiet?
 *
 * READ-ONLY. `provinceResidency(x, z)` (game/src/harness/api.js) computes the streamer's want-set
 * from the streamer's own declared geometry and reads `province.tiles`/`province.queue`. It sets
 * no focus, builds nothing, releases nothing and rebuilds no disc — unlike `streamAround(x, z, 0)`,
 * which this used to call and which the R1 critic measured taking tilesResident 25 -> 0 and meshes
 * 247 -> 5 BETWEEN the two frames the proof compares.
 *
 * If the verb is missing this THROWS. It does not fall back to the destructive probe, and it does
 * not return a zero-filled optimistic reading: both of those are how the old gate failed open.
 */
export async function residency(handle, camX, camZ) {
  const probe = await handle.hOpt('provinceResidency', camX, camZ);
  if (!probe) {
    const e = new Error(
      'G1: __HARNESS.provinceResidency(x, z) is not present in this build. G1 will not fall back to ' +
      'streamAround(x, z, 0): that call is not a pure read — province.request() re-focuses the ' +
      'streamer, rebuilds the ground skin / near-prop / cover discs and releases every resident tile ' +
      'outside the new want-set, all before any budget is consulted, and it runs BETWEEN the frames ' +
      'the settle proof compares. A gate cannot demolish the world it is certifying.');
    e.residencyVerbMissing = true;
    throw e;
  }
  const stats = await handle.hOpt('getWorldStats');
  const streaming = (stats && stats.streaming) || null;
  return {
    ran: true,
    read_only: probe.read_only === true,
    queued: probe.missing,
    missing_keys: probe.missing_keys,
    want: probe.want,
    built: 0,                              // a read-only probe builds nothing, by construction
    tiles_resident: streaming ? streaming.tilesResident : probe.resident_total,
    tiles_queued: streaming ? streaming.tilesQueued : probe.queued_total,
    queued_in_want: probe.queued_in_want,
    instances: probe.instances,
    meshes: probe.meshes,
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
 * The gated quantity of G3a. `excess = max(0, d1 - d2)` — the first interval's change with the
 * scene's own ambient-motion floor (the second interval) subtracted out.
 */
export function excessOf(d1, d2) {
  return {
    excess: Math.max(0, d1.frac - d2.frac),
    d1: +d1.frac.toFixed(6),
    d2: +d2.frac.toFixed(6),
    ambient_floor: +d2.frac.toFixed(6),
  };
}

const n6 = (v) => (typeof v === 'number' && isFinite(v) ? +v.toFixed(6) : null);

/**
 * Build the settle proof from the gates' evidence and throw if any failed.
 *
 * EVERY GATE FAILS CLOSED. A gate that could not run records `ran: false` and `pass: false`, with
 * the reason in `why`. There is no combination of inputs for which a missing measurement produces
 * `settled: true`.
 *
 * @param resid      the READ-ONLY residency reading, or `{ran:false, why}` if it could not be taken
 * @param d1         |A-B|            (required)
 * @param d2         |B-C|            (required unless frame_c === false)
 * @param d13        |A-C|            (required unless frame_c === false)
 * @param set        changed-block set structure from __CAPD_TRIAD (optional, recorded)
 * @param frame_c    false only when C was deliberately not taken; see the note on the skip
 * @returns the proof object recorded in the capture manifest.
 */
export function judge({
  resid, d1, d2, d13, set = null, threshold = THRESHOLD, gap = GAP, frames,
  frame_c = undefined, rise_abs = RISE_ABS, rise_ratio = RISE_RATIO, acc_ratio = ACC_RATIO,
  acc_floor = ACC_FLOOR,
}) {
  const failed = [];

  // ---- G1 RESIDENCY -----------------------------------------------------------------------------
  const g1 = { ran: false, pass: false, queued: null, tiles_resident: null, read_only: null, why: null };
  if (!resid || resid.ran !== true) {
    g1.why = (resid && resid.why) ||
      'the residency gate did not run: the camera position was unknown, the point is outside the ' +
      'province, or __HARNESS.provinceResidency() is missing. S34\'s anti-loophole exists precisely ' +
      'for the case where the world may not be there, so "we could not check" is a REFUSAL, not a pass.';
    g1.not_in_province = !!(resid && resid.not_in_province);
    failed.push('G1 residency: ' + g1.why);
  } else if (typeof resid.queued !== 'number') {
    g1.ran = true;
    g1.why = 'the residency probe returned no queue depth';
    failed.push('G1 residency: ' + g1.why);
  } else {
    g1.ran = true;
    g1.queued = resid.queued;
    g1.want = resid.want;
    g1.tiles_resident = resid.tiles_resident;
    g1.read_only = resid.read_only === true;
    g1.pass = resid.queued === 0;
    if (!g1.pass) {
      failed.push(`G1 residency: ${resid.queued} of ${resid.want} tile(s) inside the camera's own ` +
        'streaming radius are NOT built. This would be a photograph of a world that does not exist ' +
        'yet. (Measured: a camera posed where the player has never been renders an empty world and ' +
        'goes on rendering the SAME empty world, so the two-frame stability test alone passes it — ' +
        'see reports/capture/SETTLE-CALIBRATION.json, population "absent".)');
    }
    if (!g1.read_only) {
      failed.push('G1 residency: the probe did not declare itself read-only. A residency probe that ' +
        'mutates the scene between frames A and B puts its own side effect into d1.');
    }
  }

  // ---- G2 QUIESCENCE ----------------------------------------------------------------------------
  const g2 = { ran: false, pass: false, built: null, tiles_queued: null, why: null };
  if (!resid || resid.ran !== true) {
    g2.why = 'the residency reading it is derived from did not run';
    failed.push('G2 quiescence: ' + g2.why);
  } else if (typeof resid.built !== 'number' || typeof resid.tiles_queued !== 'number') {
    g2.ran = true;
    g2.why = `the streamer did not report both counters (built=${resid.built}, tiles_queued=${resid.tiles_queued})`;
    failed.push('G2 quiescence: ' + g2.why);
  } else {
    g2.ran = true;
    g2.built = resid.built;
    g2.tiles_queued = resid.tiles_queued;
    g2.pass = resid.built === 0 && resid.tiles_queued === 0;
    if (resid.built > 0) failed.push(`G2 quiescence: the residency probe itself built ${resid.built} tile(s)`);
    if (resid.tiles_queued > 0) failed.push(`G2 quiescence: ${resid.tiles_queued} tile(s) still queued in the streamer`);
  }

  // ---- G3 STABILITY -----------------------------------------------------------------------------
  const cTaken = frame_c === undefined ? (d13 !== undefined && d13 !== null) : !!frame_c;
  const g3 = {
    frame_c_taken: cTaken,
    d1: d1 ? n6(d1.frac) : null,
    d2: d2 ? n6(d2.frac) : null,
    d13: d13 ? n6(d13.frac) : null,
    set,
    threshold,
    G3a_deceleration: { ran: false, pass: false, excess: null, why: null },
    G3b_acceleration: { ran: false, pass: false, rise: null, ratio: null, why: null },
    G3c_accumulation: { ran: false, pass: false, gamma: null, overlap: null, why: null },
    pass: false,
  };

  if (!d1 || typeof d1.frac !== 'number') {
    const why = 'no first interval |A-B| was measured';
    g3.G3a_deceleration.why = g3.G3b_acceleration.why = g3.G3c_accumulation.why = why;
    failed.push('G3 stability: ' + why);
  } else if (!cTaken) {
    // THE ONE CASE IN WHICH FRAME C IS NOT TAKEN. See the note above `SKIP_RULE`.
    g3.skip_rule = SKIP_RULE;
    if (d1.frac === 0 && g1.pass && g2.pass) {
      g3.G3a_deceleration = { ran: true, pass: true, excess: 0, why: 'A and B are block-identical (d1 = 0) and G1/G2 are clean; frame C was not taken' };
      g3.G3b_acceleration = { ran: false, pass: true, rise: null, why: 'not evaluated: frame C was not taken (permitted only when d1 = 0 and G1/G2 pass)' };
      g3.G3c_accumulation = { ran: false, pass: true, gamma: null, why: 'not evaluated: frame C was not taken (permitted only when d1 = 0 and G1/G2 pass)' };
    } else {
      const why = `frame C was not taken, but the conditions that permit skipping it do not hold ` +
        `(d1=${n6(d1.frac)}, G1 pass=${g1.pass}, G2 pass=${g2.pass}). ${SKIP_RULE}`;
      g3.G3a_deceleration.why = g3.G3b_acceleration.why = g3.G3c_accumulation.why = why;
      failed.push('G3 stability: ' + why);
    }
  } else if (!d2 || typeof d2.frac !== 'number' || !d13 || typeof d13.frac !== 'number') {
    // FAIL CLOSED, and this is deliberate. See the "HONEST LIMIT" note at the head of this file:
    // the critic's "slow loader" (0.060, 0.055) and the measured settled marauders-coast frame
    // (0.0644, 0.0640) are the same pair of numbers. Ruling on (d1, d2) alone is guessing.
    const why =
      `G3 needs all three comparisons and was given d1=${d1 ? n6(d1.frac) : null}, ` +
      `d2=${d2 ? n6(d2.frac) : null}, d13=${d13 ? n6(d13.frac) : null}. It will not rule without ` +
      '|A-C|. A steady arrival and a live-but-settled scene are INDISTINGUISHABLE in (d1, d2) — ' +
      'measured: the settled marauders-coast frame is (0.0644, 0.0640) and a slow loader is ' +
      '(0.060, 0.055) — so a verdict from (d1, d2) alone is a guess. A gate that cannot see the ' +
      'evidence it needs fails closed.';
    g3.G3a_deceleration.why = g3.G3b_acceleration.why = g3.G3c_accumulation.why = why;
    failed.push('G3 stability: ' + why);
  } else {
    const D1 = d1.frac, D2 = d2.frac, D13 = d13.frac;

    // G3a — deceleration. Content that arrived and stopped.
    const excess = Math.max(0, D1 - D2);
    g3.G3a_deceleration = { ran: true, pass: excess <= threshold, excess: n6(excess), why: null };
    if (!g3.G3a_deceleration.pass) {
      failed.push(`G3a deceleration: ambient-corrected change between A(t) and B(t+${gap}) was ` +
        `${(excess * 100).toFixed(4)}% of blocks, over the declared ${(threshold * 100).toFixed(3)}% ` +
        `threshold (d1=${n6(D1)}, ambient floor d2=${n6(D2)}). Something arrived in the first ` +
        'interval and then stopped.');
    }

    // G3b — acceleration. Content arriving AFTER the frame that ships.
    const rise = Math.max(0, D2 - D1);
    const ratio = D1 > 0 ? D2 / D1 : (D2 > 0 ? Infinity : 1);
    const bBad = rise > rise_abs && D2 > rise_ratio * D1;
    g3.G3b_acceleration = {
      ran: true, pass: !bBad, rise: n6(rise), ratio: isFinite(ratio) ? n6(ratio) : 'inf',
      rise_abs, rise_ratio, why: null,
    };
    if (bBad) {
      failed.push(`G3b acceleration: the interval that starts at the DELIVERED frame moved MORE than ` +
        `the one before it — d2=${n6(D2)} against d1=${n6(D1)} (rise ${n6(rise)} > ${rise_abs}, ` +
        `ratio ${isFinite(ratio) ? ratio.toFixed(2) : 'inf'} > ${rise_ratio}). The world is still ` +
        'arriving, and it is arriving after the picture was taken. The old gate clamped this to ' +
        'zero with max(0, d1 - d2) and never looked at it.');
    }

    // G3c — accumulation. Steady arrival, which decelerates by nothing and accelerates by nothing.
    const denom = Math.max(D1, D2);
    if (denom < acc_floor) {
      g3.G3c_accumulation = {
        ran: false, pass: true, gamma: null, overlap: set ? set.overlap : null,
        why: `not evaluated: total motion max(d1,d2)=${n6(denom)} is below the ${acc_floor} floor, ` +
          'where the ratio is a handful of blocks and means nothing. G3a and G3b still ran.',
      };
    } else {
      const gamma = D13 / denom;
      const cBad = gamma > acc_ratio;
      g3.G3c_accumulation = {
        ran: true, pass: !cBad, gamma: n6(gamma), overlap: set ? n6(set.overlap) : null,
        jaccard: set ? n6(set.jaccard) : null, acc_ratio, why: null,
      };
      if (cBad) {
        failed.push(`G3c accumulation: |A-C| = ${n6(D13)} is ${gamma.toFixed(2)}x the larger single ` +
          `interval (${n6(denom)}), over the ${acc_ratio}x bound. Ambient motion is stationary — the ` +
          'same blocks keep moving, so A and C are no further apart than A and B. Change that ' +
          'ACCUMULATES across both intervals is content still arriving, and it is invisible to ' +
          'both max(0, d1-d2) and max(0, d2-d1) when the arrival rate is steady.' +
          (set && set.overlap !== null ? ` Only ${(set.overlap * 100).toFixed(0)}% of the blocks that moved in the first interval moved again in the second.` : ''));
      }
    }
    g3.pass = g3.G3a_deceleration.pass && g3.G3b_acceleration.pass && g3.G3c_accumulation.pass;
  }
  if (!cTaken && g3.G3a_deceleration.pass && g3.G3b_acceleration.pass && g3.G3c_accumulation.pass) g3.pass = true;

  const proof = {
    settled: failed.length === 0,
    method: 'S34 settle proof, rebuilt after CAPTURE-SERVICE-R1. Three frames A(t), B(t+gap), ' +
      'C(t+2*gap); B is the frame that ships. G1 read-only residency, G2 streamer quiescence, and ' +
      'G3 in three parts: deceleration max(0,d1-d2), acceleration max(0,d2-d1), and accumulation ' +
      '|A-C| / max(d1,d2). Every gate fails closed.',
    gates: {
      G1_residency: g1,
      G2_quiescence: g2,
      G3_stability: g3,
    },
    settle_frames: frames,
    gap_frames: gap,
    threshold,
    bounds: { threshold, rise_abs, rise_ratio, acc_ratio, acc_floor },
    metric: `|X-Y| = fraction of ${BLOCK}x${BLOCK} blocks of a ${THUMB_W}x${THUMB_H} thumbnail whose ` +
      `mean RGB moved > ${DELTA}/255 on any channel`,
    calibration: 'reports/capture/SETTLE-CALIBRATION-R2.json (and SETTLE-CALIBRATION.json for the R1 band)',
    measured: {
      d1: d1 ? n6(d1.frac) : null,
      d2: d2 ? n6(d2.frac) : null,
      d13: d13 ? n6(d13.frac) : null,
      excess: g3.G3a_deceleration.excess,
      rise: g3.G3b_acceleration.rise,
      gamma: g3.G3c_accumulation.gamma,
      overlap: set ? n6(set.overlap) : null,
      d1_px_changed_frac: d1 && typeof d1.px_changed_frac === 'number' ? n6(d1.px_changed_frac) : null,
      d1_changed_blocks: d1 ? d1.changed_blocks : null,
      total_blocks: d1 ? d1.total_blocks : null,
    },
    failed,
  };
  if (failed.length) throw new UnsettledError(proof);
  return proof;
}

/**
 * WHEN FRAME C MAY BE SKIPPED, AND WHY IT IS NARROWER THAN THE R1 CRITIC PROPOSED.
 *
 * The critic ruled: "take frame C only when d1 > threshold — if the first interval is already
 * inside the threshold, no subtraction can push it out, so C cannot change the verdict", worth
 * 7 of 13 settled frames. That reasoning is exact for the OLD gate, whose only use of C was the
 * subtraction in max(0, d1 - d2). It stops being exact the moment R6's d2 bound exists, and the
 * counter-case is the critic's own third row: a world that is nearly still and then explodes.
 * At d1 = 0.004 (inside the threshold) and d2 = 0.14, skipping C certifies a frame with the world
 * arriving immediately after it. So the rule is narrowed to the case where the claim is not a
 * subtraction argument but an observation:
 *
 *     C is skipped only when d1 === 0 EXACTLY — A and B are block-identical — and G1 and G2 both
 *     pass, so the streamer is fully resident and idle and there is no source of arrival left.
 *
 * MEASURED SUPPORT: across the 18 G1-clean frames of SETTLE-CALIBRATION.json, d1 = 0 exactly in 10
 * of them and every one of those 10 also has d2 = 0. Not one frame was still, then moved. That is
 * 10 of 13 settled + lighting frames paying two frames instead of three — MORE saving than the
 * critic's rule, from a strictly stronger precondition. It is re-checked in
 * SETTLE-CALIBRATION-R2.json, and if any frame is ever observed with d1 = 0 and d2 > 0 this rule
 * must be withdrawn: pass `settle_always_c: true` in the spec to disable it now.
 */
export const SKIP_RULE =
  'frame C may be skipped only when d1 === 0 exactly (A and B are block-identical) AND G1 and G2 ' +
  'both pass. Measured: 10 of 10 calibration frames with d1 = 0 also had d2 = 0.';
