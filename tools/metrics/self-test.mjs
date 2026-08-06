#!/usr/bin/env node
// self-test.mjs — prove the fidelity instrument can FAIL.
//
// A metric battery that returns numbers is not evidence of anything. This asserts that the
// battery reacts, in the right direction, to conditions whose correct answer is known in
// advance — synthetic renders built here, plus the real images in corpus/70-visual/refs/.
//
//   node tools/metrics/self-test.mjs [--keep] [--json]
//
// Exit 0 = every assertion held. Exit 20 = at least one assertion failed: the instrument is
// not trustworthy and no visual verdict may be issued until it is.
//
// The three assertions the brief names are T3 (resolution honesty / anti-aliasing),
// T5 (flat-shaded render trips M8) and T6 (uniform sky trips M7). The rest exist because an
// instrument that only fails is as useless as one that only passes.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT } from '../lib/cli.mjs';
import { decodeImage, writePng } from './lib/decode.mjs';
import * as V from './lib/vis03.mjs';
import { runBattery } from './lib/battery.mjs';

const USAGE = `
self-test.mjs — assert the RI-VIS03 battery behaves. Exit 0 pass, 20 fail.

  --keep    keep the synthetic images (printed path) instead of deleting them
  --json    emit the full result table as JSON on stdout
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const REFS = path.join(REPO, 'corpus', '70-visual', 'refs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vis03-selftest-'));

const results = [];
let failures = 0;
function assert(id, what, ok, detail) {
  results.push({ id, assertion: what, pass: !!ok, detail });
  if (!ok) failures++;
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${what}\n        ${detail}\n`);
}
function skip(id, what, why) {
  results.push({ id, assertion: what, pass: null, detail: why });
  process.stdout.write(`SKIP  ${id}  ${what}\n        ${why}\n`);
}

// ---------------------------------------------------------------- synthetic renders
// Deterministic: a fixed 32-bit LCG, never Math.random(), so the self-test is reproducible.
let _seed = 0x2002;
const rnd = () => ((_seed = (_seed * 1664525 + 1013904223) >>> 0) / 4294967296);

function blank(W, H) { const d = new Uint8Array(W * H * 4); for (let i = 3; i < d.length; i += 4) d[i] = 255; return d; }
const put = (d, W, x, y, r, g, b) => { const p = (y * W + x) * 4; d[p] = r; d[p + 1] = g; d[p + 2] = b; };

/** A flat-shaded render: uniform sky, and a foreground of large uniform colour fields.
 *  This is the Three.js MeshBasicMaterial / ambient-only failure M8 exists to catch. */
function synthFlatShaded(W = 1280, H = 1280) {
  const d = blank(W, H);
  const horizon = Math.round(H * 0.38);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r, g, b;
    if (y < horizon) { r = 135; g = 206; b = 235; }                       // 0x87ceeb, the tell
    else if (x < W * 0.45) { r = 96; g = 108; b = 74; }                   // one flat ground field
    else if (y < horizon + H * 0.30) { r = 132; g = 120; b = 100; }       // one flat wall
    else { r = 78; g = 92; b = 66; }                                      // another flat ground field
    put(d, W, x, y, r, g, b);
  }
  return { width: W, height: H, data: d };
}

/** A textured render with a PERFECTLY uniform sky. M7 must fire on the sky while M8 does not
 *  fire on the ground: this separates "flat sky" from "flat everything". */
function synthUniformSky(W = 1280, H = 1280) {
  const d = blank(W, H);
  const horizon = Math.round(H * 0.42);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (y < horizon) { put(d, W, x, y, 135, 206, 235); continue; }
    // fractal-ish ground with real local structure and hue variation
    const n = 0.5 + 0.5 * Math.sin(x * 0.11 + y * 0.07) * Math.cos(x * 0.031 - y * 0.053)
      + 0.25 * Math.sin(x * 0.9) * Math.sin(y * 0.7);
    const v = Math.max(0, Math.min(1, 0.18 + 0.55 * n + 0.10 * (rnd() - 0.5)));
    put(d, W, x, y, Math.round(255 * v * 0.86), Math.round(255 * v * 0.94), Math.round(255 * v * 0.62));
  }
  return { width: W, height: H, data: d };
}

/** A gradient sky with dither + a lit, textured, shadowed ground. The "the instrument can also
 *  say yes" control: M7 and M8 must NOT hard-fail on this. */
function synthGoodSky(W = 1280, H = 1280) {
  const d = blank(W, H);
  const horizon = Math.round(H * 0.42);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (y < horizon) {
      const t = y / horizon;                                   // zenith -> horizon
      const r = 70 + 150 * t + 6 * (rnd() - 0.5);
      const g = 110 + 120 * t + 6 * (rnd() - 0.5);
      const b = 205 - 30 * t + 6 * (rnd() - 0.5);
      put(d, W, x, y, Math.round(r), Math.round(g), Math.round(b));
      continue;
    }
    const n = 0.5 + 0.5 * Math.sin(x * 0.11 + y * 0.07) * Math.cos(x * 0.031 - y * 0.053)
      + 0.25 * Math.sin(x * 0.9) * Math.sin(y * 0.7);
    const v = Math.max(0, Math.min(1, 0.18 + 0.55 * n + 0.10 * (rnd() - 0.5)));
    put(d, W, x, y, Math.round(255 * v * 0.86), Math.round(255 * v * 0.94), Math.round(255 * v * 0.62));
  }
  return { width: W, height: H, data: d };
}

/** Fine geometric detail rendered with no AA (1 sample per pixel) and with 4x4 supersampling.
 *  Same scene, same resolution — only the sampling differs. M5 NYQ_ratio must separate them. */
function synthEdges(W, H, ss) {
  const d = blank(W, H);
  const f = (X, Y) => {                                        // a scene of thin radiating spokes
    const cx = W / 2, cy = H / 2;
    const a = Math.atan2(Y - cy, X - cx), r = Math.hypot(X - cx, Y - cy);
    const spoke = Math.sin(a * 60) > 0 ? 1 : 0;
    const ring = Math.sin(r * 0.35) > 0 ? 1 : 0;
    return (spoke ^ ring) ? 0.86 : 0.14;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) v += f(x + (sx + 0.5) / ss, y + (sy + 0.5) / ss);
    v /= ss * ss;
    const c = Math.round(255 * v);
    put(d, W, x, y, c, c, Math.round(c * 0.92));
  }
  return { width: W, height: H, data: d };
}

/** Box-downscale an RGBA image by an integer factor — the operation the v1 tool applied before
 *  every FFT, and the reason a 320px 2002 screenshot could out-score a 1440p modern frame. */
function boxDownRGBA(img, f) {
  const W = Math.floor(img.width / f), H = Math.floor(img.height / f);
  const d = blank(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0;
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
      const p = ((y * f + dy) * img.width + (x * f + dx)) * 4;
      r += img.data[p]; g += img.data[p + 1]; b += img.data[p + 2];
    }
    const n = f * f;
    put(d, W, x, y, Math.round(r / n), Math.round(g / n), Math.round(b / n));
  }
  return { width: W, height: H, data: d };
}

const run = (img, profile, opts = {}) => {
  const pl = V.prepare(img);
  return { pl, ...runBattery(pl, { profile, ...opts }) };
};
const val = (m, k) => (m && m.stats && m.stats[k] && m.stats[k].measurable ? m.stats[k].value : null);
const hardOn = (m, k) => !!(m && m.hard_fails || []).length && m.hard_fails.some((h) => h.stat === k);

// ================================================================ T1 — CIELAB path is real
{
  const grey = blank(256, 256);
  for (let i = 0; i < 256 * 256; i++) { const v = 40 + ((i % 256) >> 2); grey[i * 4] = v; grey[i * 4 + 1] = v; grey[i * 4 + 2] = v; }
  const red = blank(256, 256);
  for (let i = 0; i < 256 * 256; i++) { red[i * 4] = 220; red[i * 4 + 1] = 30; red[i * 4 + 2] = 30; }
  const g = run({ width: 256, height: 256, data: grey }, 'exterior_daylight');
  const r = run({ width: 256, height: 256, data: red }, 'exterior_daylight');
  const gc = val(g.metrics.M3, 'meanC'), rc = val(r.metrics.M3, 'meanC');
  assert('T1', 'M3 is CIELAB: a neutral ramp has C* ~ 0, a saturated red has C* > 60',
    gc !== null && gc < 1.0 && rc !== null && rc > 60,
    `neutral meanC = ${gc}, saturated-red meanC = ${rc} (HSV saturation would have reported ~0.86 for the red, not a C* in the 60-90 range)`);
}

// ================================================================ T2 — FG_MASK exists and works
{
  const img = synthUniformSky(1280, 1280);
  const out = run(img, 'exterior_daylight');
  const expected = 0.42;                                   // the synthetic horizon
  const got = out.masks.skyFrac;
  assert('T2', 'FG_MASK / SKY_MASK separate sky from world (RI-VIS03 §0, absent in v1)',
    Math.abs(got - expected) < 0.03,
    `SKY_MASK = ${(got * 100).toFixed(1)}% of the frame, ground truth ${(expected * 100).toFixed(1)}%. v1 had no mask at all, so every band was sky-contaminated by a per-frame-varying amount.`);
}

// ================================================================ T3 — the headline: M5 cannot
// be fooled by resolution. THIS IS THE BUG THE BRIEF NAMES.
{
  // (a) native, no AA vs native, 4x supersampled — same scene, same size, only sampling differs
  const alias = synthEdges(1280, 1280, 1);
  const aa = synthEdges(1280, 1280, 4);
  const A = run(alias, 'exterior_daylight'), B = run(aa, 'exterior_daylight');
  const nqA = val(A.metrics.M5, 'NYQ_ratio'), nqB = val(B.metrics.M5, 'NYQ_ratio');
  assert('T3a', 'M5 NYQ_ratio detects anti-aliasing at fixed resolution (aliased > supersampled)',
    nqA !== null && nqB !== null && nqA > nqB,
    `no-AA NYQ_ratio = ${nqA}, 4x-supersampled NYQ_ratio = ${nqB} (same scene, both native 1280^2). Ratio ${(nqA / Math.max(nqB, 1e-9)).toFixed(2)}x.`);

  // (b) a box-downscale of the aliased render must NOT be reported as better anti-aliased than
  //     the native render. It cannot be, because M5 refuses to measure it at all: after a 2x
  //     box-downscale the frame is 640^2 and there is no native 1024^2 crop.
  const small = boxDownRGBA(alias, 2);
  const C = run(small, 'exterior_daylight');
  assert('T3b', 'a downscaled frame cannot out-score a native one on anti-aliasing: M5 REFUSES it',
    C.metrics.M5.measurable === false && /refuses to resample|native 1024/.test(C.metrics.M5.reason || ''),
    `${small.width}x${small.height} -> M5 measurable=${C.metrics.M5.measurable}; reason: "${(C.metrics.M5.reason || '').slice(0, 120)}..."  (v1 box-downscaled EVERY frame to 256^2 first, which is why 320px 2002 screenshots measured as better anti-aliased than 1440p Witcher 3 frames.)`);

  // (c) the same refusal on the real 2002 population, and a real number on the real modern one
  const mw = path.join(REFS, 'morrowind', 'REF-A1', 'REF-A1__mwscr-2017-01-12-sunset-on-ascadian-isles.avif');
  const w3 = path.join(REFS, 'modern', 'hud', 'run-w3nextgen-t0000.jpg');
  if (fs.existsSync(mw) && fs.existsSync(w3)) {
    const mwi = await decodeImage(mw), w3i = await decodeImage(w3);
    const Mm = run(mwi, 'exterior_daylight'), Mw = run(w3i, 'exterior_daylight');
    const mwM5 = Mm.metrics.M5.measurable, w3M5 = Mw.metrics.M5.measurable;
    assert('T3c', 'on the REAL reference set: 320px 2002 previews yield NO M5 number; native 1440p frames do',
      mwM5 === false && w3M5 === true,
      `mwscr ${mwi.width}x${mwi.height} M5.measurable=${mwM5}; Witcher 3 ${w3i.width}x${w3i.height} M5.measurable=${w3M5}, NYQ_ratio=${val(Mw.metrics.M5, 'NYQ_ratio')}. ACQUISITION-REPORT §10 amendment 5 reported 2002 = 0.300-0.419 and modern = 0.363-0.465 on the broken instrument; the comparison is now refused rather than inverted.`);
    // (d) dynamic range in stops — the statistic the acquisition agent found separates the eras
    const s2002 = val(Mm.metrics.M1, 'stops'), s2022 = val(Mw.metrics.M1, 'stops');
    assert('T3d', 'M1 reports dynamic range in stops and it separates the eras',
      s2002 !== null && s2022 !== null && s2022 > s2002,
      `mwscr 2002 preview = ${s2002} stops, Witcher 3 next-gen = ${s2022} stops (ACQUISITION-REPORT §10: modern 9.20-11.75 vs Morrowind 5.61-8.31, no overlap).`);
  } else skip('T3c', 'real-reference resolution honesty', 'reference images not present');
}

// ================================================================ T4 — M8 exists at all
{
  const img = synthUniformSky(1280, 1280);
  const out = run(img, 'exterior_daylight');
  const fs_ = val(out.metrics.M8, 'FS_score'), lf = val(out.metrics.M8, 'LargestFlat');
  assert('T4', "M8's two HARD FAIL statistics are computed (v1 computed neither)",
    fs_ !== null && lf !== null,
    `FS_score = ${fs_}, LargestFlat = ${lf}. v1 had only flat_tile_frac, a different statistic on a different support with a different threshold.`);
}

// ================================================================ T5 — flat-shaded render trips M8
{
  const img = synthFlatShaded(1280, 1280);
  const out = run(img, 'exterior_daylight');
  const m8 = out.metrics.M8;
  const fs_ = val(m8, 'FS_score'), lf = val(m8, 'LargestFlat');
  assert('T5', 'a synthetic flat-shaded render HARD FAILS M8',
    m8.hard === true,
    `FS_score = ${fs_} (hard fail < 0.018), LargestFlat = ${lf} (hard fail > 0.15). Diagnoses: ${m8.hard_fails.map((h) => h.diagnosis.split('—')[0].trim()).join('; ') || 'none'}`);
  assert('T5b', 'an M8 hard fail drives the shot score to 0 (RI-VIS03 §Scoring absolute cap)',
    out.verdict.score === 0 && out.verdict.caps.some((c) => c.cap === 0),
    `score = ${out.verdict.score}; caps = ${out.verdict.caps.map((c) => c.cap).join(',')}`);
}

// ================================================================ T6 — uniform sky trips M7
{
  const img = synthUniformSky(1280, 1280);
  const out = run(img, 'exterior_daylight');
  const m7 = out.metrics.M7;
  assert('T6', 'a synthetic uniform-colour sky HARD FAILS M7 as "flat single-colour sky"',
    m7.measurable === true && m7.hard === true && m7.hard_fails.some((h) => /FLAT SINGLE-COLOUR SKY/.test(h.diagnosis)),
    `sky_frac = ${val(m7, 'sky_frac')}, dY_sky = ${val(m7, 'dY_sky')} (fail < 0.02), dC_sky = ${val(m7, 'dC_sky')} (fail < 2). Diagnoses: ${m7.hard_fails.map((h) => h.diagnosis.split('(')[0].trim()).join('; ') || 'none'}`);
  assert('T6b', 'the same frame does NOT hard-fail M8 — M7 and M8 are independent detectors',
    out.metrics.M8.hard === false,
    `M8 FS_score = ${val(out.metrics.M8, 'FS_score')}, LargestFlat = ${val(out.metrics.M8, 'LargestFlat')}. A flat sky must not be read as a flat world: M8 measures FG_MASK only.`);
}

// ================================================================ T7 — the instrument can say yes
{
  const img = synthGoodSky(1280, 1280);
  const out = run(img, 'exterior_daylight');
  assert('T7', 'a dithered gradient sky over a textured ground does NOT hard-fail M7 or M8',
    out.metrics.M7.hard === false && out.metrics.M8.hard === false,
    `M7 dY_sky = ${val(out.metrics.M7, 'dY_sky')}, dC_sky = ${val(out.metrics.M7, 'dC_sky')}, BI = ${val(out.metrics.M7, 'BI')}; M8 FS_score = ${val(out.metrics.M8, 'FS_score')}. An instrument that only fails is as useless as one that only passes.`);
}

// ================================================================ T7b — the stage-B sky detector
{
  // RI-VIS03's literal sky rule requires Yp > P60(whole frame) AND contact with row 0. A sky
  // whose zenith is darker than the frame's P60 (any dawn/dusk gradient) therefore has no
  // candidate in row 0 and vanishes. This asserts the fallback fires AND says so.
  const out = run(synthGoodSky(1280, 1280), 'exterior_daylight');
  const det = out.masks.sky_detect || '';
  assert('T7b', 'a gradient sky the literal RI-VIS03 rule cannot see is found by stage B, and the substitution is RECORDED',
    out.masks.skyFrac > 0.35 && /STAGE B/.test(det),
    `sky_frac = ${out.masks.skyFrac.toFixed(3)}; detector = "${det.slice(0, 150)}..." — a mask swap that is not recorded is the "masking everything" failure RI-VIS03 names.`);
}

// ================================================================ T8 — M6 catches one-light rendering
{
  // Same albedo texture, lit two ways. (a) one white light + white ambient: shadows are just
  // darker, same hue. (b) warm key + cool sky fill: shadows shift blue.
  const mk = (twoLight) => {
    const W = 1024, H = 1024, d = blank(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const tex = 0.5 + 0.35 * Math.sin(x * 0.13) * Math.cos(y * 0.09) + 0.12 * (rnd() - 0.5);
      const lit = x + y * 0.6 > W * 0.75;                        // a lit half and a shadowed half
      let r, g, b;
      if (lit) { r = tex * 1.00; g = tex * 0.95; b = tex * 0.86; }
      else if (twoLight) { r = tex * 0.30; g = tex * 0.36; b = tex * 0.52; }   // cool sky fill
      else { r = tex * 0.34; g = tex * 0.34; b = tex * 0.34; }                 // white ambient only
      put(d, W, x, y, Math.round(255 * Math.min(1, r)), Math.round(255 * Math.min(1, g)), Math.round(255 * Math.min(1, b)));
    }
    return { width: W, height: H, data: d };
  };
  _seed = 0x2002; const one = run(mk(false), 'exterior_daylight');
  _seed = 0x2002; const two = run(mk(true), 'exterior_daylight');
  const h1 = val(one.metrics.M6, 'hue_offset'), h2 = val(two.metrics.M6, 'hue_offset');
  assert('T8', 'M6 hue_offset separates one-light rendering from a warm key + cool fill',
    h1 !== null && h2 !== null && h1 < 6 && h2 > 15,
    `one white light: hue_offset = ${h1}deg (hard fail < 6, caps the shot at 4); warm key + cool sky fill: hue_offset = ${h2}deg.`);
  assert('T8b', 'a one-light frame is capped at 4 by RI-VIS03 §Scoring',
    one.verdict.score <= 4,
    `score = ${one.verdict.score}; caps = ${JSON.stringify(one.verdict.caps.map((c) => c.cap))}`);
}

// ================================================================ T9 — M9 catches no-tonemapping
{
  // A linear clamp: saturated highlights that clip a channel and no shoulder.
  const W = 1024, H = 1024, d = blank(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const e = 3.2 * (0.15 + 1.4 * (x / W) * (0.4 + 0.6 * Math.abs(Math.sin(y * 0.02))));
    const r = Math.min(1, e * 1.00), g = Math.min(1, e * 0.55), b = Math.min(1, e * 0.30);
    put(d, W, x, y, Math.round(255 * r), Math.round(255 * g), Math.round(255 * b));
  }
  const out = run({ width: W, height: H, data: d }, 'exterior_daylight');
  const m9 = out.metrics.M9;
  assert('T9', 'M9 fires on a linear clamp (no tonemapping): ClipFrac and/or HighlightDesat',
    m9.hard === true,
    `ClipFrac = ${val(m9, 'ClipFrac')} (fail > 0.02), HighlightDesat = ${val(m9, 'HighlightDesat')} (fail > 1.05), ShoulderRatio = ${val(m9, 'ShoulderRatio')} (fail < 0.12). Diagnoses: ${[...m9.diagnoses, ...m9.hard_fails.map((h) => h.diagnosis.split('(')[0].trim())].join('; ')}`);
}

// ================================================================ T10 — no number is invented
{
  const img = synthUniformSky(1280, 1280);
  const out = run(img, 'exterior_daylight');
  const bad = [];
  for (const [id, m] of Object.entries(out.metrics)) {
    for (const [k, s] of Object.entries(m.stats || {})) {
      if (s.measurable && s.value === null) bad.push(`${id}.${k} claims measurable with a null value`);
      if (!s.measurable && s.value !== null) bad.push(`${id}.${k} reports a value while unmeasurable`);
      if (!s.measurable && !s.reason) bad.push(`${id}.${k} is unmeasurable with no stated reason`);
      if (s.profile === undefined) bad.push(`${id}.${k} has no profile stamp`);
      if (s.unit === undefined) bad.push(`${id}.${k} has no unit`);
    }
    if (!m.measurable && !m.reason && !m.skipped) bad.push(`${id} is unmeasurable with no stated reason`);
  }
  assert('T10', 'every statistic carries {value, unit, profile, measurable, reason} and never a number it did not compute',
    bad.length === 0, bad.length ? bad.join('; ') : `${Object.values(out.metrics).reduce((n, m) => n + Object.keys(m.stats || {}).length, 0)} statistics checked across M1-M12`);

  assert('T10b', 'M11 and M12 report unmeasurable on a still frame rather than faking a proxy',
    out.metrics.M11.measurable === false && out.metrics.M12.measurable === false
    && /sequence/i.test(out.metrics.M11.reason) && /WATER_MASK/.test(out.metrics.M12.reason),
    `M11: "${(out.metrics.M11.reason || '').slice(0, 90)}..."  M12: "${(out.metrics.M12.reason || '').slice(0, 90)}..."`);

  assert('T10c', 'skipped and unmeasurable metrics are excluded from the score denominator, never counted as passes',
    !out.verdict.runnable.includes('M11') && !out.verdict.runnable.includes('M12')
    && out.verdict.unmeasurable.includes('M11') && out.verdict.unmeasurable.includes('M12'),
    `runnable = [${out.verdict.runnable}]; unmeasurable = [${out.verdict.unmeasurable}]; skipped = [${out.verdict.skipped}]`);
}

// ================================================================ T11 — M11 on a real sequence
{
  // A 6-frame dolly in which one 40x40 object pops into existence between frames 3 and 4.
  const W = 512, H = 512;
  const frames = [];
  for (let f = 0; f < 6; f++) {
    _seed = 0x2002;
    const d = blank(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = 0.45 + 0.2 * Math.sin((x + f * 2) * 0.05) * Math.cos(y * 0.04);
      const c = Math.round(255 * v);
      put(d, W, x, y, c, c, Math.round(c * 0.9));
    }
    if (f >= 3) for (let y = 200; y < 240; y++) for (let x = 200; x < 240; x++) put(d, W, x, y, 250, 250, 250);
    frames.push(V.prepare({ width: W, height: H, data: d }).Yp);
  }
  const r = V.M11(frames, { W, H });
  assert('T11', 'M11 detects a single LOD pop in a real frame sequence, and only one',
    r.pops === 1 && r.worst_pop > 0.005 && r.worst_pop < 0.01,
    `pops = ${r.pops} over ${r.pairs} pairs, worst_pop = ${r.worst_pop.toFixed(5)} (a 40x40 object in a 512x512 frame = 0.0061 of the frame). Gating notes: ${r.displacement_gating.split('—')[0].trim()}`);
}

// ================================================================ T14 — M12 catches the blue plane
{
  const W = 1024, H = 1024, waterTop = 420;
  const mkWater = (rippled) => {
    _seed = 0x2002;
    const d = blank(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (y < waterTop) {                                   // shore/land above the waterline
        const t = 0.35 + 0.25 * Math.sin(x * 0.07) * Math.cos(y * 0.05) + 0.08 * (rnd() - 0.5);
        put(d, W, x, y, Math.round(255 * t * 0.9), Math.round(255 * t), Math.round(255 * t * 0.7));
        continue;
      }
      if (!rippled) { put(d, W, x, y, 40, 78, 132); continue; }        // THE BLUE PLANE
      const depth = (y - waterTop) / (H - waterTop);
      const ripple = 0.05 * Math.sin(x * 0.35 + y * 0.21) + 0.03 * Math.sin(x * 1.1 - y * 0.6) + 0.02 * (rnd() - 0.5);
      // reflection of the land strip above, plus a Fresnel rise towards the far (upper) edge
      const mirror = Math.max(0, 2 * waterTop - y - 1);
      const refl = (d[(mirror * W + x) * 4 + 1] / 255) * (0.55 - 0.35 * depth);
      const v = Math.max(0, Math.min(1, 0.12 + 0.30 * depth * 0 + refl + ripple + 0.10 * (1 - depth)));
      put(d, W, x, y, Math.round(255 * v * 0.5), Math.round(255 * v * 0.8), Math.round(255 * v));
    }
    return { width: W, height: H, data: d };
  };
  const mask = new Uint8Array(W * H);
  for (let y = waterTop; y < H; y++) for (let x = 0; x < W; x++) mask[y * W + x] = 1;
  const plane = run(mkWater(false), 'exterior_daylight', { water: mask });
  const real = run(mkWater(true), 'exterior_daylight', { water: mask });
  const g = (o, k) => val(o.metrics.M12, k);
  assert('T14', 'M12 calls a uniform blue plane a blue plane, and does not call a rippled reflective surface one',
    plane.metrics.M12.blue_plane === true && real.metrics.M12.blue_plane !== true,
    `blue plane: Fresnel ${g(plane, 'FresnelDelta')}, NormalEnergy ${g(plane, 'NormalEnergy')}, ShoreDelta ${g(plane, 'ShoreDelta')}, ReflCorr ${g(plane, 'ReflCorr')} -> ${plane.metrics.M12.hard_fails.length} fails. rippled: Fresnel ${g(real, 'FresnelDelta')}, NormalEnergy ${g(real, 'NormalEnergy')}, ShoreDelta ${g(real, 'ShoreDelta')}, ReflCorr ${g(real, 'ReflCorr')} -> ${real.metrics.M12.hard_fails.length} fails.`);
  assert('T14b', 'M12 TemporalVar stays unmeasurable without a stationary sequence, even when the mask is supplied',
    plane.metrics.M12.stats.TemporalVar.measurable === false && /stationary frames/.test(plane.metrics.M12.stats.TemporalVar.reason),
    `"${plane.metrics.M12.stats.TemporalVar.reason.slice(0, 110)}..."`);
}

// ================================================================ T12 — determinism
{
  const img = synthUniformSky(640, 640);
  _seed = 0x2002; const a = run(synthUniformSky(640, 640), 'exterior_daylight');
  _seed = 0x2002; const b = run(synthUniformSky(640, 640), 'exterior_daylight');
  const ja = JSON.stringify(a.metrics), jb = JSON.stringify(b.metrics);
  assert('T12', 'the battery is deterministic: same bytes in, same JSON out',
    ja === jb, `${ja.length} bytes of metric JSON, identical on both runs`);
}

// ================================================================ T13 — real modern frame sanity
{
  const w3 = path.join(REFS, 'modern', 'hud', 'run-w3nextgen-t0000.jpg');
  if (fs.existsSync(w3)) {
    const out = run(await decodeImage(w3), 'exterior_daylight');
    const fsv = val(out.metrics.M8, 'FS_score');
    assert('T13', 'a real current-generation frame does NOT hard-fail M8 (the instrument is not a constant-fail)',
      out.metrics.M8.hard === false,
      `Witcher 3 next-gen: FS_score = ${fsv} (hard fail < 0.018), LargestFlat = ${val(out.metrics.M8, 'LargestFlat')} (hard fail > 0.15), TotalFlat = ${val(out.metrics.M8, 'TotalFlat')}.`);
    assert('T13b', 'and its M5 runs on a native 1024^2 crop with no resampling',
      out.metrics.M5.measurable && out.metrics.M5.detail && out.metrics.M5.detail.resampled === false,
      `${out.metrics.M5.detail ? out.metrics.M5.detail.crop : 'n/a'}; HFR = ${val(out.metrics.M5, 'HFR')}, NYQ_ratio = ${val(out.metrics.M5, 'NYQ_ratio')}, alpha = ${val(out.metrics.M5, 'alpha')}`);
  } else skip('T13', 'real modern frame sanity', 'corpus/70-visual/refs/modern/hud is empty');
}

// ---------------------------------------------------------------- artefacts + exit
if (args.keep) {
  const keep = [['flat-shaded', synthFlatShaded(1280, 1280)], ['uniform-sky', synthUniformSky(1280, 1280)],
  ['good-sky', synthGoodSky(1280, 1280)], ['edges-noaa', synthEdges(1280, 1280, 1)], ['edges-ssaa4', synthEdges(1280, 1280, 4)]];
  for (const [n, im] of keep) await writePng(path.join(TMP, `${n}.png`), im.width, im.height, im.data);
  process.stdout.write(`\nsynthetic images kept in ${TMP}\n`);
} else fs.rmSync(TMP, { recursive: true, force: true });

const ran = results.filter((r) => r.pass !== null).length;
process.stdout.write(`\n${ran - failures}/${ran} assertions held${failures ? `  — ${failures} FAILED` : ''}\n`);
if (args.json) process.stdout.write(JSON.stringify({ schema: 'elder-souls/vis03-self-test@1', when: new Date().toISOString(), results, failures }, null, 2) + '\n');
if (failures) { log('the instrument is not trustworthy; do not issue a visual verdict until these hold'); process.exit(EXIT.MEASUREMENT_FAIL); }
process.exit(0);
