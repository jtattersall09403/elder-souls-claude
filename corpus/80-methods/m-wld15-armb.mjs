#!/usr/bin/env node
// m-wld15-armb.mjs — RI-WLD15 arm B: the RENDERED walk (M-W15-2).
//
// Arm A (m-wld15-monotony.mjs) reads the terrain raster and can see substrate, water, relief,
// macro-form and enclosure. It cannot see flora, props, architecture, light or weather — which is
// most of what a player actually looks at. Arm A is a GATE; arm B is the half of the item that sees
// what a person sees, and RI-WLD15/RI-WLD16 stay scored `not_run` until this has run.
//
// Usage:
//   node corpus/80-methods/m-wld15-armb.mjs --selfcheck        # browser-free; proves the metric works
//   node corpus/80-methods/m-wld15-armb.mjs --regions a,b       # measure named regions
//   node corpus/80-methods/m-wld15-armb.mjs --all --json <path> # the full run
//   node corpus/80-methods/m-wld15-armb.mjs --force             # run even when the box is over ceiling
//
// Exit codes: 0 pass, 1 fail against W15-5/W15-6, 2 could not measure, 3 refused (box contended).
//
// -------------------------------------------------------------------------------------------
// ADMISSIBILITY (ARBITRATION.md S34) — read before quoting any number from this file.
// The capture service PLACES the camera; nothing walks. Under S34(a) placed frames are legitimate
// evidence of APPEARANCE and under S34(b) they are NOT evidence of ARRIVAL. Arm B's claim is
// strictly an appearance claim — "how many distinct views does a 720 m line through this region
// show" — which is the placed form's home ground. It is NOT a claim that a player can walk that
// line: if the transect crosses water or a cliff, arm B still reports what is there to be seen,
// and a verdict that cites these frames for reachability is VOID. Traversability is RI-WLD06's
// and RI-WLD01's question, not this one.
//
// CONTENTION (rule 21). This takes one browser through the shared daemon, on ONE connection, so
// the scheduler treats it as a single claimant and a long pack cannot starve another agent. It
// still refuses to start when the box is already over ceiling, because a variety measurement is
// never worth another piece's headline number. Override with --force and say so in your status.
// -------------------------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PNG } from '../../tools/node_modules/pngjs/lib/png.js';
import { loadWorld, transect, signatureAt, TH as W15TH } from './m-wld15-monotony.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);

export const TH = {
  frame_spacing_m: 8,          // 4 s at 2.0 m/s
  window_m: 720,
  eye_m: 1.7, fov: 70, width: 1280, height: 720,
  hamming_distinct: 12,        // W15-5: two views count as different at Hamming >= 12
  hamming_same: 6,             // W15-6: near-identical below this
  w15_5_target: 10, w15_5_fail: 7, w15_5_hard: 4,
  w15_6_target_s: 60, w15_6_fail_s: 120, w15_6_hard_s: 180,
  transects_worst: 3, transects_random: 3,
};

// ============================================================== perceptual hash
// 64-bit DCT pHash. Chosen over a raw downsample because a downsample is dominated by overall
// brightness: two completely different views under the same fog read as identical, and two frames
// of the same wall read as different when a cloud moves. The DCT low-frequency block is what
// survives both, which is the property this measurement needs.

function grey(png, size = 32) {
  const { width: W, height: H, data } = png;
  const out = new Float64Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor((x * W) / size), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * W) / size));
      const y0 = Math.floor((y * H) / size), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * H) / size));
      let s = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * W + xx) * 4;
          s += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          n++;
        }
      }
      out[y * size + x] = n ? s / n : 0;
    }
  }
  return out;
}

const COS = (() => {
  const N = 32, t = new Float64Array(N * N);
  for (let u = 0; u < N; u++) for (let x = 0; x < N; x++) t[u * N + x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N));
  return t;
})();

export function pHash(png) {
  const N = 32, g = grey(png, N);
  const tmp = new Float64Array(N * N), dct = new Float64Array(N * N);
  for (let y = 0; y < N; y++) for (let u = 0; u < N; u++) { let s = 0; for (let x = 0; x < N; x++) s += g[y * N + x] * COS[u * N + x]; tmp[y * N + u] = s; }
  for (let u = 0; u < N; u++) for (let v = 0; v < N; v++) { let s = 0; for (let y = 0; y < N; y++) s += tmp[y * N + u] * COS[v * N + y]; dct[v * N + u] = s; }
  const vals = [];
  for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) { if (!u && !v) continue; vals.push(dct[v * N + u]); }
  const sorted = [...vals].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  let hi = 0n, lo = 0n;
  vals.slice(0, 63).forEach((val, i) => { if (val > med) { if (i < 32) lo |= 1n << BigInt(i); else hi |= 1n << BigInt(i - 32); } });
  return (hi << 32n) | lo;
}

export const hamming = (a, b) => { let x = a ^ b, n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };

/** W15-5 / W15-6 from a frame-hash series. */
export function runMetrics(hashes) {
  // distinct views: greedy — a frame is new if it is >= hamming_distinct from every kept view
  const kept = [];
  for (const h of hashes) if (kept.every((k) => hamming(h, k) >= TH.hamming_distinct)) kept.push(h);
  // longest run of near-identical consecutive frames
  let longest = 1, cur = 1;
  for (let i = 1; i < hashes.length; i++) {
    if (hamming(hashes[i], hashes[i - 1]) < TH.hamming_same) cur++;
    else { longest = Math.max(longest, cur); cur = 1; }
  }
  longest = Math.max(longest, cur);
  const secPerFrame = TH.frame_spacing_m / W15TH.walk_speed_ms; // 4 s
  return { frames: hashes.length, distinct_views: kept.length, longest_same_run_s: +(longest * secPerFrame).toFixed(1) };
}

// ============================================================== transect selection

/** The 3 worst transects from arm A plus 3 random, per region — M-W15-2 step 1. */
export function pickTransects(W, regionIdx, seed = 1) {
  let rnd = seed;
  const rand = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const steps = Math.round(TH.window_m / W.cell);
  const cells = [];
  for (let z = 1; z < W.rows - 1; z++) for (let x = 1; x < W.cols - 1; x++) {
    const i = z * W.cols + x;
    if (W.region[i] === regionIdx && !W.ocean[i]) cells.push([x, z]);
  }
  if (cells.length < steps) return [];
  const cand = [];
  for (let t = 0; t < 64 && cand.length < 24; t++) {
    const [x0, z0] = cells[Math.floor(rand() * cells.length)];
    const ang = (Math.floor(rand() * 8) / 8) * Math.PI * 2;
    const dx = Math.cos(ang), dz = Math.sin(ang);
    const sigs = transect(W, x0, z0, dx, dz, steps, regionIdx);
    if (sigs.length < steps * 0.6) continue;
    let longest = 0, cur = 0, prev = null;
    for (const s of sigs) { if (s === prev) cur++; else { longest = Math.max(longest, cur); cur = 1; prev = s; } }
    cand.push({ x0, z0, dx, dz, cells: sigs.length, distinct: new Set(sigs).size, longest_run: Math.max(longest, cur) });
  }
  const worst = [...cand].sort((a, b) => b.longest_run - a.longest_run || a.distinct - b.distinct).slice(0, TH.transects_worst);
  const rest = cand.filter((c) => !worst.includes(c));
  const random = [];
  for (let i = 0; i < TH.transects_random && rest.length; i++) random.push(rest.splice(Math.floor(rand() * rest.length), 1)[0]);
  return [...worst.map((t) => ({ ...t, pick: 'worst' })), ...random.map((t) => ({ ...t, pick: 'random' }))];
}

// ============================================================== the run

function contentionGate(force) {
  try {
    const out = execFileSync('node', [path.join(ROOT, 'tools/contention.mjs')], { encoding: 'utf8' });
    if (/^WAIT/m.test(out)) {
      if (!force) {
        console.error(out.trim());
        console.error('\nREFUSED: the box is at or over its browser ceiling, and a variety measurement is not');
        console.error('worth another piece\'s headline number (rule 21). Re-run when it clears, or --force');
        console.error('and record in your status file that you proceeded anyway.');
        process.exit(3);
      }
      console.error('contention says WAIT; --force given, proceeding and this is recorded in the output.');
      return { gate: 'WAIT', forced: true };
    }
    return { gate: 'GO', forced: false };
  } catch (e) { return { gate: 'unknown', error: e.message, forced: force }; }
}

async function run(opts) {
  const gate = contentionGate(opts.force);
  const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/world/terrain.json'), 'utf8'));
  const W = loadWorld(T);
  const wanted = opts.regions ? new Set(opts.regions) : new Set(W.regionIds);

  const { CaptureSession } = await import('../../tools/capture/client.mjs');
  const session = new CaptureSession();
  const perRegion = [];
  try {
    await session.connect();
    for (let ri = 0; ri < W.regionIds.length; ri++) {
      const id = W.regionIds[ri];
      if (!wanted.has(id)) continue;
      const picks = pickTransects(W, ri);
      if (!picks.length) { perRegion.push({ region: id, status: 'no 720 m transect stays inside the region' }); continue; }
      const walks = [];
      for (const t of picks) {
        const nFrames = Math.floor((t.cells * W.cell) / TH.frame_spacing_m);
        const yaw = (Math.atan2(t.dx, t.dz) * 180) / Math.PI;
        const hashes = [];
        for (let f = 0; f < nFrames; f++) {
          const d = f * TH.frame_spacing_m;
          const x = t.x0 * W.cell + t.dx * d, z = t.z0 * W.cell + t.dz * d;
          const shot = await session.capture({
            evidence_of: 'appearance',
            claim: `RI-WLD15 arm B: how many distinct views a 720 m line through ${id} shows (appearance only, S34(a); not an arrival claim)`,
            place: { x, z },
            pose: { yaw_deg: yaw, pitch_deg: 0, eye_m: TH.eye_m, fov: TH.fov },
            time: 11, width: TH.width, height: TH.height,
          });
          hashes.push(pHash(PNG.sync.read(fs.readFileSync(shot.path))));
        }
        walks.push({ ...t, yaw_deg: +yaw.toFixed(1), ...runMetrics(hashes), hashes: hashes.map((h) => h.toString(16)) });
      }
      const dv = walks.map((w) => w.distinct_views).sort((a, b) => a - b);
      const lr = walks.map((w) => w.longest_same_run_s).sort((a, b) => a - b);
      perRegion.push({
        region: id, walks: walks.length,
        median_distinct_views: dv[Math.floor(dv.length / 2)], min_distinct_views: dv[0],
        median_longest_same_run_s: lr[Math.floor(lr.length / 2)], max_longest_same_run_s: lr[lr.length - 1],
        detail: walks,
      });
    }
  } finally { session.close(); }

  const fails = [];
  for (const r of perRegion) {
    if (!r.walks) continue;
    if (r.min_distinct_views < TH.w15_5_hard) fails.push(`W15-5 ${r.region}: a 720 m walk showed only ${r.min_distinct_views} distinct views (hard floor ${TH.w15_5_hard})`);
    else if (r.median_distinct_views < TH.w15_5_fail) fails.push(`W15-5 ${r.region}: median ${r.median_distinct_views} distinct views per walk (fail below ${TH.w15_5_fail})`);
    if (r.max_longest_same_run_s > TH.w15_6_hard_s) fails.push(`W15-6 ${r.region}: ${r.max_longest_same_run_s}s of near-identical frames (hard fail over ${TH.w15_6_hard_s}s)`);
    else if (r.median_longest_same_run_s > TH.w15_6_fail_s) fails.push(`W15-6 ${r.region}: median ${r.median_longest_same_run_s}s near-identical run (fail over ${TH.w15_6_fail_s}s)`);
  }
  return { thresholds: TH, contention: gate, per_region: perRegion, fails, pass: fails.length === 0 };
}

// ============================================================== selfcheck (browser-free)
// The controls are synthetic frames, so this runs with no browser and no daemon. Per the ruling and
// BAR-AUDIT-WORLD-20260814 §6, each is the PLAUSIBLE wrong answer, never the trivial one: the
// negative control is a walk whose frames DRIFT — brightness and fog change, a little noise moves —
// exactly what a monotonous walk through a procedurally-lit world actually looks like. A control
// made of 90 byte-identical frames would prove nothing, because nothing renders that way.

/**
 * A synthetic frame with the composition a real render has: a horizon, a ground gradient, a
 * scatter of props, and noise. `place` selects the KIND of place (horizon height, ground tone,
 * prop density and size); `along` scrolls the props as if the camera moved forward.
 *
 * A monotonous walk is `place` fixed and `along` advancing — the same kind of place, new props of
 * the same kind arriving. That is what "walking over samey landscape for ages" looks like, and it
 * is a far harder control than a static image, which is the point.
 */
function synthFrame(seed, { drift = 0, place = 0, along = 0 } = {}) {
  const W = 128, H = 72;
  const png = new PNG({ width: W, height: H });
  let s = seed;
  const rand = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  // `place` drives COMPOSITION, not tint: skyline height, prop size, density and a big silhouette.
  // Two places that differ only in colour are one place under two lights, and the DCT hash is
  // right to call them the same — so the control must vary structure or it tests nothing.
  const horizon = Math.round(H * (0.30 + (place % 5) * 0.055));
  const groundTone = 60 + ((place * 29) % 11) * 4;
  const skyTone = 140 + ((place * 17) % 5) * 8;
  const density = 2 + (place % 5) * 2;
  const propW = 5 + (place % 4) * 7;
  const propH = 6 + (place % 6) * 5;
  const bigSil = place % 3 === 0 ? 0 : 18 + (place % 7) * 5;   // a landmark silhouette, or none
  const buf = new Float64Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      buf[y * W + x] = y < horizon ? skyTone + drift * 8 : groundTone + drift * 5 + 40 * (y / H);
    }
  }
  if (bigSil) {
    const bx = ((place * 41) % 70) / 100 * W;
    for (let y = Math.max(0, horizon - bigSil); y < horizon + 2; y++) {
      for (let x = Math.floor(bx); x < Math.min(W, bx + 30); x++) buf[y * W + x] = 45;
    }
  }
  // props: positions depend on `along`, so walking forward brings new ones of the SAME kind
  for (let k = 0; k < density; k++) {
    const id = Math.floor(along / 3) + k * 37;
    const px = ((id * 61) % 100) / 100 * W;
    const ph = propH + ((id * 23) % 6);
    const tone = groundTone - 25 + ((id * 13) % 5) * 6;
    for (let y = Math.max(0, horizon - ph); y < Math.min(H, horizon + 4); y++) {
      for (let x = Math.floor(px); x < Math.min(W, px + propW); x++) buf[y * W + x] = tone;
    }
  }
  for (let i = 0; i < W * H; i++) {
    const v = Math.max(0, Math.min(255, buf[i] + (rand() - 0.5) * 6));
    const j = i * 4;
    png.data[j] = png.data[j + 1] = png.data[j + 2] = v;
    png.data[j + 3] = 255;
  }
  return png;
}

/**
 * Median pairwise Hamming across every frame in the walk — how spread out the views are as a SET.
 *
 * Proposed alongside W15-5, not in place of it, because measuring arm B turned up a real weakness
 * in the greedy distinct-view count: walking forward through one uniform swamp changes every frame
 * (parallax brings new props past the camera), so a greedy counter rewards motion rather than
 * novelty and reports a monotonous walk as a varied one. Median pairwise distance does not have
 * that failure — a walk that stays in one kind of place keeps every frame close to every other,
 * however much the foreground scrolls. Recorded here with its evidence; RI-WLD15 keeps W15-5 as
 * written until a critic rules on the replacement.
 */
export function viewSpread(hashes) {
  const d = [];
  for (let i = 0; i < hashes.length; i++) for (let j = i + 1; j < hashes.length; j++) d.push(hamming(hashes[i], hashes[j]));
  if (!d.length) return 0;
  d.sort((a, b) => a - b);
  return d[Math.floor(d.length / 2)];
}

function selfcheck() {
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };

  // --- NEGATIVE: the plausible monotonous walk. ONE kind of place, light drifting, and the camera
  // moving forward the whole time so props scroll past and no two frames are alike pixel-for-pixel.
  // This is what the Deep Marshes' 275-second single-ground-state walk looks like rendered.
  const monotone = [];
  for (let f = 0; f < 90; f++) monotone.push(pHash(synthFrame(1000 + f, { drift: Math.sin(f / 12), place: 4, along: f })));
  const m = runMetrics(monotone);
  const mSpread = viewSpread(monotone);

  // --- POSITIVE: a walk that genuinely crosses places — the kind of place changes six times.
  const varied = [];
  for (let f = 0; f < 90; f++) varied.push(pHash(synthFrame(2000 + f, { drift: Math.sin(f / 12), place: 1 + Math.floor(f / 15), along: f })));
  const v = runMetrics(varied);
  const vSpread = viewSpread(varied);

  // The instrument's job is to SEPARATE these two. Assert separation, and report the numbers,
  // rather than asserting an absolute that a synthetic frame has no business fixing.
  ok(vSpread > mSpread, `separation: varied walk spread ${vSpread} must exceed monotonous ${mSpread}`);
  ok(vSpread - mSpread >= 4, `separation margin: only ${vSpread - mSpread} Hamming between a varied and a monotonous walk — too close to bind on`);
  ok(v.distinct_views >= m.distinct_views, `sanity: varied walk (${v.distinct_views}) should show at least as many distinct views as monotonous (${m.distinct_views})`);

  // --- W15-5's greedy count was suspected of a parallax weakness (forward motion scrolls new props
  // past the camera, so any walk looks eventful). Measured against these realistic controls it
  // holds up: the monotonous walk lands BELOW the fail threshold and the varied walk clears the
  // target. Asserted in both directions so a future change that breaks it is caught here.
  ok(m.distinct_views < TH.w15_5_fail, `W15-5 on the monotonous control: ${m.distinct_views} distinct views, should fall below the fail threshold ${TH.w15_5_fail}`);
  ok(v.distinct_views >= TH.w15_5_target, `W15-5 on the varied control: ${v.distinct_views} distinct views, should clear the target ${TH.w15_5_target}`);

  // --- the metric must not be fooled by BRIGHTNESS alone: same scene, big exposure shift.
  // This is the specific way a downsample-hash lies, and the reason for the DCT.
  const dark = pHash(synthFrame(3000, { drift: -6, place: 5, along: 10 }));
  const bright = pHash(synthFrame(3000, { drift: 6, place: 5, along: 10 }));
  ok(hamming(dark, bright) < TH.hamming_distinct, `exposure control: the same scene at two exposures scored Hamming ${hamming(dark, bright)}, should be < ${TH.hamming_distinct} (it is one view, differently lit)`);
  const other = pHash(synthFrame(3000, { drift: -6, place: 7, along: 10 }));
  ok(hamming(dark, other) >= TH.hamming_distinct, `structure control: two genuinely different places scored Hamming ${hamming(dark, other)}, should be >= ${TH.hamming_distinct}`);

  // --- transect selection must actually prefer the worst walks, or arm B measures the wrong lines.
  const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/world/terrain.json'), 'utf8'));
  const W = loadWorld(T);
  const picks = pickTransects(W, W.regionIds.indexOf('deep-marshes'));
  ok(picks.length > 0, 'transect selection returned nothing for deep-marshes');
  if (picks.length) {
    const worst = picks.filter((p) => p.pick === 'worst'), rand = picks.filter((p) => p.pick === 'random');
    ok(worst.length === TH.transects_worst, `expected ${TH.transects_worst} worst transects, got ${worst.length}`);
    if (rand.length) ok(Math.min(...worst.map((w) => w.longest_run)) >= Math.min(...rand.map((r) => r.longest_run)),
      'transect selection: the "worst" picks are not actually the most monotonous ones');
  }

  console.log(bad.length ? `selfcheck: ${bad.length} failure(s)\n  - ${bad.join('\n  - ')}`
    : `selfcheck: on realistic frames (horizon, landmark silhouettes, props, forward motion,
           drifting light, noise) the metric separates a MONOTONOUS walk from a VARIED one on
           both measures — W15-5 distinct views ${m.distinct_views} vs ${v.distinct_views}
           (fail threshold ${TH.w15_5_fail}, target ${TH.w15_5_target}), median pairwise
           Hamming ${mSpread} vs ${vSpread}. It ignores exposure and sees real structure change.
           W15-5's suspected parallax weakness did not materialise on these controls.
           Arm B is ready; it needs a browser and the box must be under its ceiling.`);
  process.exit(bad.length ? 1 : 0);
}

// ============================================================== cli

const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (IS_MAIN) {
  const argv = process.argv.slice(2);
  if (argv.includes('--selfcheck')) selfcheck();
  else {
    const ri = argv.indexOf('--regions');
    const opts = { force: argv.includes('--force'), regions: ri > 0 ? argv[ri + 1].split(',') : null };
    run(opts).then((res) => {
      console.log(`RI-WLD15 arm B — rendered walks (${TH.frame_spacing_m} m spacing, ${TH.width}x${TH.height})\n`);
      for (const r of res.per_region) {
        if (!r.walks) { console.log(`  ${r.region}: ${r.status}`); continue; }
        console.log(`  ${r.region.padEnd(19)} median ${r.median_distinct_views} distinct views (worst walk ${r.min_distinct_views}), longest near-identical ${r.max_longest_same_run_s}s`);
      }
      if (res.fails.length) { console.log('\nFAILS:'); for (const f of res.fails) console.log('  - ' + f); }
      const ji = argv.indexOf('--json');
      if (ji > 0 && argv[ji + 1]) { fs.writeFileSync(argv[ji + 1], JSON.stringify(res, null, 1)); console.log(`\nwrote ${argv[ji + 1]}`); }
      process.exit(res.pass ? 0 : 1);
    }).catch((e) => { console.error(`could not measure: ${e.message}`); process.exit(2); });
  }
}
