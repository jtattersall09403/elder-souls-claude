#!/usr/bin/env node
// m-wld15-monotony.mjs — RI-WLD15 arm A: the static within-region monotony probe.
//
// The question: walking inside ONE region, does the ground under you and the shape around you keep
// changing, or is it the same view for minutes at a time? Every other variety metric in this corpus
// is either between-region (RI-WLD04, RI-WLD12) or world-aggregate (RI-WLD02, RI-WLD07). This one
// is along-the-path and inside-a-region, which is where "you were never just walking over samey
// landscape for ages" actually lives.
//
// Arm A reads game/data/world/terrain.json only — no browser, no render, ~1 s. It measures the
// things the terrain raster can honestly express: substrate, standing water, macro-form, local
// relief and enclosure. It CANNOT see flora, props, architecture or light; those are arm B
// (RI-WLD15 M-W15-2, rendered), and a green arm A is a gate, never a pass.
//
// Usage:
//   node corpus/80-methods/m-wld15-monotony.mjs                 # measure the shipped world
//   node corpus/80-methods/m-wld15-monotony.mjs --json <path>   # write the full result
//   node corpus/80-methods/m-wld15-monotony.mjs --selfcheck     # prove the instrument can fail
//
// Exit codes: 0 pass, 1 fail against RI-WLD15 thresholds, 2 could not measure (missing data).

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const TERRAIN = path.join(ROOT, 'game/data/world/terrain.json');

// ---- thresholds, from RI-WLD15 §3. Change them there, not here. ----
export const TH = {
  walk_speed_ms: 2.0,
  sample_m: 25,            // one sample per terrain cell
  window_m: 720,           // a six-minute walk at 2.0 m/s
  relief_band_m: 2.0,      // local relief quantisation — below this a player does not notice
  enclosure_bands: 5,      // horizon-occlusion quantisation
  // W15-1..W15-4, RI-WLD15 §3. Per region, over 24 transects of 720 m.
  median_run_s_target: 90,   // median longest identical-signature run
  median_run_s_fail: 150,
  p90_run_s_fail: 240,       // HARD FAIL: four minutes of literally unchanging ground
  min_signatures_per_walk_floor: 4,
  median_signatures_per_walk_target: 8,
  min_region_signatures: 12,
  max_modal_share: 0.35,
};

function decode(channels, name, type, n) {
  const buf = Buffer.from(channels[name], 'base64');
  if (type === 'int16') { const a = new Int16Array(n); for (let i = 0; i < n; i++) a[i] = buf.readInt16LE(i * 2); return a; }
  if (type === 'int8') { const a = new Int8Array(n); for (let i = 0; i < n; i++) a[i] = buf.readInt8(i); return a; }
  return new Uint8Array(buf.subarray(0, n));
}

/** Build the sampling grid from a terrain.json-shaped object. Pure, so --selfcheck can feed it fakes. */
export function loadWorld(T) {
  const { cols, rows, cell_m: cell } = T;
  const n = cols * rows;
  const C = T.channels;
  return {
    cols, rows, cell,
    base: decode(C, 'base_dm', 'int16', n),      // decimetres
    substrate: decode(C, 'substrate', 'uint8', n),
    region: decode(C, 'region', 'uint8', n),
    woff: decode(C, 'woff_cm', 'int16', n),      // centimetres of water table above base
    ocean: decode(C, 'ocean', 'uint8', n),
    regionIds: T.regions.map((r) => r.id),
    substrateNames: C.substrate_names || [],
  };
}

/**
 * The view signature at one cell: the tuple a player could name if you asked "what is it like here?"
 * Deliberately coarse. Two cells sharing a signature are two cells that look the same to walk over.
 */
export function signatureAt(W, x, z) {
  const i = z * W.cols + x;
  const h = W.base[i] / 10;

  // 1. Standing water band. depth = (base + woff) - ground; on the raster ground == base.
  const depth = W.woff[i] / 100;
  const water = depth <= 0 ? 0 : depth < 0.4 ? 1 : depth < 1.2 ? 2 : 3; // dry / film / wade / swim

  // 2. Local relief inside a 100 m box, quantised. This is "how bumpy is it right here".
  let mn = Infinity, mx = -Infinity, sum = 0, cnt = 0;
  const r = Math.max(1, Math.round(50 / W.cell));
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const zz = z + dz, xx = x + dx;
      if (zz < 0 || zz >= W.rows || xx < 0 || xx >= W.cols) continue;
      const v = W.base[zz * W.cols + xx] / 10;
      if (v < mn) mn = v; if (v > mx) mx = v; sum += v; cnt++;
    }
  }
  const relief = Math.min(9, Math.floor((mx - mn) / TH.relief_band_m));
  const mean = sum / cnt;

  // 3. Macro-form from the sign of (h - local mean) against the local relief: are you on a crest,
  //    in a hollow, on a flank, or on a plain?
  const rel = (mx - mn) < 1.0 ? 0 : (h - mean) / ((mx - mn) / 2);
  const form = (mx - mn) < 1.0 ? 0 : rel > 0.5 ? 1 : rel < -0.5 ? 2 : 3; // plain / crest / hollow / flank

  // 4. Enclosure: fraction of 16 compass rays blocked within 150 m by ground above eye height.
  let blocked = 0;
  const reach = Math.max(1, Math.round(150 / W.cell));
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    const dxs = Math.cos(ang), dzs = Math.sin(ang);
    let hit = 0;
    for (let s = 1; s <= reach; s++) {
      const xx = Math.round(x + dxs * s), zz = Math.round(z + dzs * s);
      if (zz < 0 || zz >= W.rows || xx < 0 || xx >= W.cols) break;
      const v = W.base[zz * W.cols + xx] / 10;
      // eye at 1.7 m; a ray drops 0 (level sightline) — anything above eye blocks
      if (v > h + 1.7) { hit = 1; break; }
    }
    blocked += hit;
  }
  const enc = Math.min(TH.enclosure_bands - 1, Math.floor((blocked / 16) * TH.enclosure_bands));

  return `${W.substrate[i]}|${water}|${relief}|${form}|${enc}`;
}

/** Walk a straight transect and report its signature series. */
export function transect(W, x0, z0, dx, dz, steps, regionIdx) {
  const sigs = [];
  for (let s = 0; s < steps; s++) {
    const x = Math.round(x0 + dx * s), z = Math.round(z0 + dz * s);
    if (x < 1 || z < 1 || x >= W.cols - 1 || z >= W.rows - 1) break;
    const i = z * W.cols + x;
    if (W.ocean[i]) break;
    if (regionIdx != null && W.region[i] !== regionIdx) break;
    sigs.push(signatureAt(W, x, z));
  }
  return sigs;
}

function runStats(sigs, cellSeconds) {
  let longest = 0, cur = 0, prev = null;
  for (const s of sigs) { if (s === prev) cur++; else { longest = Math.max(longest, cur); cur = 1; prev = s; } }
  longest = Math.max(longest, cur);
  return { distinct: new Set(sigs).size, longest_run_s: +(longest * cellSeconds).toFixed(1) };
}

export function measure(W, opts = {}) {
  const seed = opts.seed ?? 1;
  let rnd = seed;
  const rand = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const cellSeconds = W.cell / TH.walk_speed_ms;              // 12.5 s per 25 m cell
  const steps = Math.round(TH.window_m / W.cell);             // 29 cells for a 720 m window
  const perRegion = [];

  for (let ri = 0; ri < W.regionIds.length; ri++) {
    const cells = [];
    for (let z = 1; z < W.rows - 1; z++) for (let x = 1; x < W.cols - 1; x++) {
      const i = z * W.cols + x;
      if (W.region[i] === ri && !W.ocean[i]) cells.push([x, z]);
    }
    if (cells.length < steps) { perRegion.push({ region: W.regionIds[ri], cells: cells.length, status: 'too small to walk 720 m' }); continue; }

    // Region-wide signature inventory.
    const inv = new Map();
    for (const [x, z] of cells) { const s = signatureAt(W, x, z); inv.set(s, (inv.get(s) || 0) + 1); }
    const modalShare = Math.max(...inv.values()) / cells.length;

    // 24 transects from random starts on 8 compass bearings.
    const walks = [];
    for (let t = 0; t < 24 && walks.length < 24; t++) {
      const [x0, z0] = cells[Math.floor(rand() * cells.length)];
      const ang = (Math.floor(rand() * 8) / 8) * Math.PI * 2;
      const sigs = transect(W, x0, z0, Math.cos(ang), Math.sin(ang), steps, ri);
      if (sigs.length < steps * 0.6) continue;               // ran out of region; not a fair walk
      walks.push({ start: [x0, z0], len_m: sigs.length * W.cell, ...runStats(sigs, cellSeconds) });
    }
    if (!walks.length) { perRegion.push({ region: W.regionIds[ri], cells: cells.length, status: 'no 720 m transect stays inside the region' }); continue; }

    const distincts = walks.map((w) => w.distinct).sort((a, b) => a - b);
    const runs = walks.map((w) => w.longest_run_s).sort((a, b) => a - b);
    perRegion.push({
      region: W.regionIds[ri],
      cells: cells.length,
      region_signatures: inv.size,
      modal_signature_share: +modalShare.toFixed(3),
      walks: walks.length,
      median_signatures_per_walk: distincts[Math.floor(distincts.length / 2)],
      min_signatures_per_walk: distincts[0],
      median_longest_run_s: runs[Math.floor(runs.length / 2)],
      p90_longest_run_s: runs[Math.min(runs.length - 1, Math.floor(runs.length * 0.9))],
      max_longest_run_s: runs[runs.length - 1],
    });
  }

  const measured = perRegion.filter((r) => r.walks);
  const fails = [], warns = [];
  for (const r of measured) {
    if (r.p90_longest_run_s > TH.p90_run_s_fail) fails.push(`W15-2 ${r.region}: p90 identical-signature run ${r.p90_longest_run_s}s > ${TH.p90_run_s_fail}s (hard fail)`);
    if (r.median_longest_run_s > TH.median_run_s_fail) fails.push(`W15-1 ${r.region}: median identical-signature run ${r.median_longest_run_s}s > ${TH.median_run_s_fail}s`);
    else if (r.median_longest_run_s > TH.median_run_s_target) warns.push(`W15-1 ${r.region}: median run ${r.median_longest_run_s}s over target ${TH.median_run_s_target}s`);
    if (r.min_signatures_per_walk < TH.min_signatures_per_walk_floor) fails.push(`W15-3 ${r.region}: a 720 m walk crossed only ${r.min_signatures_per_walk} distinct signature(s) (floor ${TH.min_signatures_per_walk_floor})`);
    else if (r.median_signatures_per_walk < TH.median_signatures_per_walk_target) warns.push(`W15-3 ${r.region}: median ${r.median_signatures_per_walk} signatures per walk, target ${TH.median_signatures_per_walk_target}`);
    if (r.region_signatures < TH.min_region_signatures) fails.push(`W15-4 ${r.region}: the whole region holds only ${r.region_signatures} distinct signatures (< ${TH.min_region_signatures})`);
    if (r.modal_signature_share > TH.max_modal_share) fails.push(`W15-4 ${r.region}: one signature covers ${(r.modal_signature_share * 100).toFixed(0)}% of the region (> ${TH.max_modal_share * 100}%)`);
  }
  return { thresholds: TH, per_region: perRegion, fails, warns, pass: fails.length === 0 };
}

// ---------------------------------------------------------------- selfcheck
// Rule 4: break the thing on purpose and confirm the instrument goes red.
function synth({ uniform }) {
  const cols = 80, rows = 80, n = cols * rows;
  const base = new Int16Array(n), sub = new Uint8Array(n), reg = new Uint8Array(n),
    woff = new Int16Array(n), oc = new Uint8Array(n);
  for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) {
    const i = z * cols + x;
    if (uniform) { base[i] = 100; sub[i] = 0; woff[i] = -1200; }
    else {
      // Aperiodic on purpose: a sin/cos field repeats its signature along a straight bearing and
      // would make the positive control fail for a reason that has nothing to do with variety.
      const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177 | 0; return ((h ^ (h >> 16)) >>> 0) / 0xffffffff; };
      base[i] = Math.round(100 + 900 * hash(x, z) + 400 * hash(x >> 2, z >> 2) + 1600 * hash(x >> 4, z >> 4));
      sub[i] = Math.floor(hash(x + 7, z + 11) * 3);
      woff[i] = hash(x + 31, z + 17) < 0.25 ? 60 : -1200;
    }
  }
  const b64 = (ta, bytes) => { const b = Buffer.alloc(n * bytes); for (let i = 0; i < n; i++) bytes === 2 ? b.writeInt16LE(ta[i], i * 2) : b.writeUInt8(ta[i], i); return b.toString('base64'); };
  return {
    cols, rows, cell_m: 25,
    regions: [{ id: uniform ? 'synthetic-uniform' : 'synthetic-varied' }],
    channels: {
      substrate_names: ['FIRM', 'SILT', 'SUCK'],
      base_dm: b64(base, 2), substrate: b64(sub, 1), region: b64(reg, 1),
      woff_cm: b64(woff, 2), ocean: b64(oc, 1),
    },
  };
}

function selfcheck() {
  const bad = [];
  const flat = measure(loadWorld(synth({ uniform: true })));
  const varied = measure(loadWorld(synth({ uniform: false })));
  const f = flat.per_region[0], v = varied.per_region[0];
  console.log(`uniform control : ${f.region_signatures} signature(s), longest run ${f.max_longest_run_s}s, pass=${flat.pass}`);
  console.log(`varied control  : ${v.region_signatures} signature(s), longest run ${v.max_longest_run_s}s, pass=${varied.pass}`);
  if (flat.pass) bad.push('NEGATIVE CONTROL PASSED: a world with one repeated view scored a pass. The instrument is inert.');
  if (f.region_signatures !== 1) bad.push(`uniform control should hold exactly 1 signature, held ${f.region_signatures}`);
  if (!varied.pass) bad.push(`POSITIVE CONTROL FAILED: a deliberately varied world was failed — ${varied.fails.join('; ')}`);
  if (v.region_signatures <= f.region_signatures) bad.push('the two controls do not differ; both arms are the same arm');
  for (const m of bad) console.error('SELFCHECK FAIL: ' + m);
  console.log(bad.length ? `selfcheck: ${bad.length} failure(s)` : 'selfcheck: instrument separates a uniform world from a varied one, and goes red on the uniform one.');
  process.exit(bad.length ? 1 : 0);
}

// ---------------------------------------------------------------- main
if (process.argv[2] === '--selfcheck') selfcheck();
else {
  if (!fs.existsSync(TERRAIN)) { console.error(`FAIL: ${TERRAIN} not found — cannot measure. This is a missing-world result, not a pass.`); process.exit(2); }
  const T = JSON.parse(fs.readFileSync(TERRAIN, 'utf8'));
  const res = measure(loadWorld(T));
  console.log(`RI-WLD15 arm A — within-region monotony (720 m walks, ${TH.walk_speed_ms} m/s, ${TH.sample_m} m sampling)\n`);
  console.log('| region | region sigs | modal share | min sigs/walk | median sigs/walk | median run | p90 run |');
  console.log('|---|---:|---:|---:|---:|---:|---:|');
  for (const r of res.per_region) {
    if (!r.walks) { console.log(`| ${r.region} | — | — | — | — | — | ${r.status} |`); continue; }
    console.log(`| ${r.region} | ${r.region_signatures} | ${(r.modal_signature_share * 100).toFixed(0)}% | ${r.min_signatures_per_walk} | ${r.median_signatures_per_walk} | ${r.median_longest_run_s} s | ${r.p90_longest_run_s} s |`);
  }
  const ji = process.argv.indexOf('--json');
  if (ji > 0 && process.argv[ji + 1]) { fs.writeFileSync(process.argv[ji + 1], JSON.stringify(res, null, 1)); console.log(`\nwrote ${process.argv[ji + 1]}`); }
  if (res.fails.length) { console.log('\nFAILS:'); for (const f of res.fails) console.log('  - ' + f); }
  if (res.warns.length) { console.log('\nOVER TARGET (not a fail):'); for (const f of res.warns) console.log('  - ' + f); }
  console.log(`\narm A verdict: ${res.pass ? 'PASS (a gate only — arm B is the honest test)' : 'FAIL'} — ${res.fails.length} threshold breach(es)`);
  process.exit(res.pass ? 0 : 1);
}
