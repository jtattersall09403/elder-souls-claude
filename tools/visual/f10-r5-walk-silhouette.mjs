#!/usr/bin/env node
/**
 * f10-r5-walk-silhouette.mjs — does the silhouette change across the walk cycle, or does the
 * figure glide?
 *
 * THE QUESTION AND WHY A NUMBER IS NEEDED AT ALL. "The walk is a glide" has been asserted in this
 * project for four rounds and measured zero times. It is asserted again in
 * `orchestration/status/W1-F10-r4.json`: *"THE WALK IS STILL A GLIDE AND I MAKE NO CLAIM ABOUT
 * IT. I did not capture motion, so I have no basis for one."* This tool is the basis.
 *
 * THE CAMERA MAKES IT MEASURABLE. `f10-r5-appearance.mjs` re-aims the camera at the player's own
 * world position every motion frame from a FIXED bearing, so the body sits in the same place in
 * every frame while the world slides past behind it. A plain frame-to-frame diff would therefore
 * measure the BACKGROUND, which is the one thing moving for certain. So this tool works on a
 * silhouette mask instead.
 *
 * THE MASK. Border-ring colour buckets (the outer 6% of the frame, quantised to 4 bits per
 * channel) are the background model — the same model `frame-liveness.mjs` uses, for the same
 * reason: it never has to decide in the abstract what colour a background is. Inside the subject
 * box, any pixel whose bucket is not in that set is figure. Nothing in frame may reach the ring —
 * a figure that touches it teaches the model that its own colour is background.
 *
 * THE STATISTIC, AND THE CONTROL BUILT INTO IT. Between consecutive frames, the mean per-row
 * symmetric difference (XOR) of the silhouette mask, computed separately over three bands:
 *
 *     LEG   the bottom 38% of the box        — where a walk cycle must move
 *     TORSO the middle band                  — where it must move much less
 *     HEAD  the top 18%                      — where it must barely move at all
 *
 * That banding is the control. A gliding figure returns roughly the same small number in all
 * three bands, because whatever is changing is noise, shading or the background leaking through
 * the mask. A walking figure returns a LEG number several times its HEAD number. So the tool
 * cannot pass a glide by being noisy: noise raises all three bands together and the ratio is what
 * is read. `identity_check` diffs a frame against itself and must be exactly 0 — if it is not,
 * the mask is not deterministic and no other number here means anything.
 *
 * It also reports `travelled_m` from the capture manifest. A body that translates metres while
 * its leg band does not move is the definition of the defect.
 *
 * Usage:
 *   node tools/visual/f10-r5-walk-silhouette.mjs --dir <capture-out-dir> [--json out.json]
 *   node tools/visual/f10-r5-walk-silhouette.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}

const bucketAt = (data, p) => ((data[p] >> 4) << 8) | ((data[p + 1] >> 4) << 4) | (data[p + 2] >> 4);

/**
 * The silhouette MASK inside `box`, using the border ring as the background model.
 *
 * WHY A MASK AND NOT A PER-ROW PIXEL COUNT. The first version of this file counted off-background
 * pixels per row, and its own self-test refused it: two legs scissoring apart keep the same pixel
 * COUNT per row while moving, so a walk cycle scored exactly 0 and was indistinguishable from a
 * glide. The statistic has to be sensitive to WHERE the mask is, not just how much of it there
 * is, so frames are compared by per-row symmetric difference (XOR) of the mask itself.
 */
export function rowMask(png, box) {
  const { width: W, height: H, data } = png;
  const m = Math.max(2, Math.round(Math.min(W, H) * 0.06));
  const bg = new Set();
  for (let y = 0; y < H; y++) for (let x = 0; x < m; x++) { bg.add(bucketAt(data, (y * W + x) * 4)); bg.add(bucketAt(data, (y * W + (W - 1 - x)) * 4)); }
  for (let x = 0; x < W; x++) for (let y = 0; y < m; y++) { bg.add(bucketAt(data, (y * W + x) * 4)); bg.add(bucketAt(data, ((H - 1 - y) * W + x) * 4)); }
  const b = box || { x0: Math.round(W * 0.28), x1: Math.round(W * 0.72), y0: Math.round(H * 0.06), y1: Math.round(H * 0.94) };
  const x0 = Math.max(0, Math.min(W - 1, b.x0)), x1 = Math.max(0, Math.min(W - 1, b.x1));
  const y0 = Math.max(0, Math.min(H - 1, b.y0)), y1 = Math.max(0, Math.min(H - 1, b.y1));
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const mask = new Uint8Array(bw * bh);
  let on = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!bg.has(bucketAt(data, (y * W + x) * 4))) { mask[(y - y0) * bw + (x - x0)] = 1; on++; }
    }
  }
  return { mask, bw, bh, on, box: { x0, x1, y0, y1 }, bg_buckets: bg.size };
}

/**
 * Mean per-row XOR count over a fractional band of the box, measured from the TOP.
 * Returns null if the two frames were not measured over the same box (they must be, or the
 * comparison is between two different crops and means nothing).
 */
function bandDelta(a, b, lo, hi) {
  if (a.bw !== b.bw || a.bh !== b.bh) return null;
  const r0 = Math.floor(a.bh * lo), r1 = Math.ceil(a.bh * hi);
  let s = 0, c = 0;
  for (let r = r0; r < r1 && r < a.bh; r++) {
    let x = 0;
    for (let i = r * a.bw, e = i + a.bw; i < e; i++) if (a.mask[i] !== b.mask[i]) x++;
    s += x; c++;
  }
  return c ? +(s / c).toFixed(3) : null;
}

// Bands measured from the TOP of the box downward: the box is built head-first.
const BANDS = { head: [0.00, 0.18], torso: [0.18, 0.62], leg: [0.62, 1.00] };

export function compareSequence(frames) {
  const steps = [];
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i];
    steps.push({
      from: a.file, to: b.file,
      travelled_m: b.travelled_m ?? null,
      head: bandDelta(a, b, ...BANDS.head),
      torso: bandDelta(a, b, ...BANDS.torso),
      leg: bandDelta(a, b, ...BANDS.leg),
    });
  }
  const mean = (k) => {
    const v = steps.map((s) => s[k]).filter((n) => typeof n === 'number');
    return v.length ? +(v.reduce((x, y) => x + y, 0) / v.length).toFixed(3) : null;
  };
  const head = mean('head'), torso = mean('torso'), leg = mean('leg');
  return {
    steps, n_steps: steps.length,
    mean_head_px: head, mean_torso_px: torso, mean_leg_px: leg,
    leg_over_head: head ? +(leg / head).toFixed(2) : null,
    leg_over_torso: torso ? +(leg / torso).toFixed(2) : null,
  };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────────
// Two synthetic sequences whose ANSWERS MUST DISAGREE, or the statistic is measuring nothing:
// a figure whose legs swing, and the identical figure frozen. If both came back the same the
// suite would be agreeing with itself about the one thing it exists to dispute (HAZARDS §0).
function selfTest() {
  const W = 200, H = 200;
  const mk = (legOffset) => {
    const p = new PNG({ width: W, height: H });
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) << 2;
        let r = 200, g = 210, b = 240;                                  // sky/background
        // Nothing here may touch the outer 6% border ring: that ring IS the background model, so
        // a figure that reaches it teaches the mask that its own colour is background. (The first
        // draft of this fixture put the feet at y=190 and every band came back 0 for that reason.)
        const torso = y >= 40 && y < 120 && Math.abs(x - 100) < 18;
        // Legs: two bars that scissor apart and together with `legOffset`.
        const legL = y >= 120 && y < 175 && Math.abs(x - (92 - legOffset)) < 7;
        const legR = y >= 120 && y < 175 && Math.abs(x - (108 + legOffset)) < 7;
        const head = y >= 20 && y < 40 && Math.abs(x - 100) < 12;
        if (torso || legL || legR || head) { r = 60; g = 50; b = 40; }
        p.data[i] = r; p.data[i + 1] = g; p.data[i + 2] = b; p.data[i + 3] = 255;
      }
    }
    return p;
  };
  const box = { x0: 40, x1: 160, y0: 15, y1: 180 };
  const walking = [0, 6, 12, 6, 0, 6, 12, 6].map((o, k) => ({ file: `w${k}`, ...rowMask(mk(o), box), travelled_m: k * 0.13 }));
  const gliding = [0, 0, 0, 0, 0, 0, 0, 0].map((o, k) => ({ file: `g${k}`, ...rowMask(mk(o), box), travelled_m: k * 0.13 }));
  const w = compareSequence(walking), g = compareSequence(gliding);
  const identity = bandDelta(walking[0], walking[0], 0, 1);
  const checks = [
    ['identity_check/a frame diffed against itself is exactly 0', identity === 0, `got ${identity}`],
    ['walking/the leg band moves', w.mean_leg_px > 2, `mean_leg_px ${w.mean_leg_px}`],
    ['walking/the leg band moves far more than the head band',
      w.mean_head_px === 0 ? w.mean_leg_px > 0 : w.leg_over_head > 4,
      `leg_over_head ${w.leg_over_head} (head ${w.mean_head_px}, leg ${w.mean_leg_px})`],
    ['gliding/the leg band does not move', g.mean_leg_px === 0, `mean_leg_px ${g.mean_leg_px}`],
    ['the-arms-disagree/walking and gliding do not return the same answer', w.mean_leg_px !== g.mean_leg_px, `${w.mean_leg_px} vs ${g.mean_leg_px}`],
  ];
  let bad = 0;
  for (const [name, ok, detail] of checks) { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      ${detail}`); }
  console.log(`\n${checks.length - bad}/${checks.length} arms green`);
  return bad === 0;
}

if (args['self-test'] === true) { process.exit(selfTest() ? 0 : 1); }

// ── run over a capture directory ─────────────────────────────────────────────────────────────
const DIR = path.resolve(args.dir || '.');
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
const framesDir = path.join(DIR, 'frames');
const mRows = manifest.frames.filter((r) => r.slot === 'M' && r.status === 'ok')
  .sort((a, b) => a.sim_frame - b.sim_frame);
if (!mRows.length) { console.error(`no M (walk) frames in ${DIR}/manifest.json`); process.exit(2); }

// ONE box for the whole sequence. Per-frame boxes come from `projectPoint` and drift by a pixel
// or two; comparing masks measured over different crops would compare two different pictures.
// The median box is used and the drift is reported, so a reader can see it was small.
const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
const boxes = mRows.map((r) => r.subject_box).filter(Boolean);
const SEQ_BOX = boxes.length ? {
  x0: med(boxes.map((b) => b.x0)), x1: med(boxes.map((b) => b.x1)),
  y0: med(boxes.map((b) => b.y0)), y1: med(boxes.map((b) => b.y1)),
} : null;
const boxDrift = boxes.length && SEQ_BOX ? {
  x0: Math.max(...boxes.map((b) => Math.abs(b.x0 - SEQ_BOX.x0))),
  x1: Math.max(...boxes.map((b) => Math.abs(b.x1 - SEQ_BOX.x1))),
  y0: Math.max(...boxes.map((b) => Math.abs(b.y0 - SEQ_BOX.y0))),
  y1: Math.max(...boxes.map((b) => Math.abs(b.y1 - SEQ_BOX.y1))),
} : null;

const loaded = mRows.map((r) => {
  const png = PNG.sync.read(fs.readFileSync(path.join(framesDir, r.file)));
  const rw = rowMask(png, SEQ_BOX);
  return {
    file: r.file, sim_frame: r.sim_frame, travelled_m: r.travelled_m ?? null,
    mask: rw.mask, bw: rw.bw, bh: rw.bh, on: rw.on, box: rw.box,
    box_supplied: Boolean(r.subject_box), bg_buckets: rw.bg_buckets,
  };
});
const result = compareSequence(loaded);
const identity = bandDelta(loaded[0], loaded[0], 0, 1);
const out = {
  tool: 'f10-r5-walk-silhouette', dir: DIR, tag: manifest.tag,
  renderer: manifest.renderer_string || manifest.renderer || null,
  evidence_class: manifest.evidence_class || null,
  identity_check_px: identity,
  bands: BANDS,
  band_note: 'bands are fractions of the subject box measured from its TOP; head 0-18%, torso 18-62%, leg 62-100%',
  travelled_m_total: loaded[loaded.length - 1].travelled_m,
  motion_manifest: manifest.motion ? { queued: manifest.motion.queued, stick: manifest.motion.stick, note: manifest.motion.note } : null,
  boxes_supplied: loaded.filter((f) => f.box_supplied).length,
  sequence_box: SEQ_BOX, per_frame_box_drift_px: boxDrift,
  frames: loaded.map((f) => ({ file: f.file, sim_frame: f.sim_frame, travelled_m: f.travelled_m, mask_px: f.on, bg_buckets: f.bg_buckets })),
  ...result,
};
if (args.json) { fs.mkdirSync(path.dirname(path.resolve(args.json)), { recursive: true }); fs.writeFileSync(path.resolve(args.json), `${JSON.stringify(out, null, 2)}\n`); }
console.log(`${manifest.tag}: ${result.n_steps} step(s), travelled ${out.travelled_m_total} m`);
console.log(`  identity check      ${identity} px (must be 0)`);
console.log(`  mean |dwidth| head  ${result.mean_head_px} px`);
console.log(`  mean |dwidth| torso ${result.mean_torso_px} px`);
console.log(`  mean |dwidth| leg   ${result.mean_leg_px} px`);
console.log(`  leg/head ${result.leg_over_head}   leg/torso ${result.leg_over_torso}`);
