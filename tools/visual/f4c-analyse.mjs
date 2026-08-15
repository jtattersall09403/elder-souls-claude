#!/usr/bin/env node
/**
 * f4c-analyse.mjs — the F4 critic's analysis half. No browser; it reads PNGs off disk.
 *
 * RULING S60 (2026-08-15) replaced F4's acceptance with two clauses that MUST BOTH hold:
 *   (a) `key_off` mean|d|rgb >= 2 x `env_off` mean|d|rgb, measured ON THE LIT SUBSET — the pixels
 *       the shadow map reports unoccluded — in all five judged windows;
 *   (b) PRESERVATION: the cast-shadow AREA FRACTION does not fall in any window.
 *
 * THE LIT MASK, AND WHY IT IS NOT CIRCULAR. A pixel is called SHADOWED when switching the sun's
 * shadow map OFF makes it brighter by more than `tau`. That is the shadow map reporting occlusion.
 * It is a different experiment from `key_off` (which zeroes the light itself), so the mask is not
 * derived from the quantity it is used to restrict. `tau` is not chosen to make an answer come
 * out: the area fraction and the restricted ratio are both reported as a CURVE over
 * tau in {1,2,4,8,16}, and a conclusion that only survives at one tau is reported as not surviving.
 *
 * Usage:
 *   node tools/visual/f4c-analyse.mjs --s60 <landed-dir> <before-dir> --out <file.json>
 *   node tools/visual/f4c-analyse.mjs --fullframe <run-dir>            # verify builder full-frame
 *   node tools/visual/f4c-analyse.mjs --regions <landed-dir> <before-dir>
 *   node tools/visual/f4c-analyse.mjs --sheet <dir-of-pngs> <out.png> [cols]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i < 0 ? null : argv.slice(i + 1).filter((s) => !s.startsWith('--')); };

const TAUS = [1, 2, 4, 8, 16];

function raw(png, crop) {
  const vf = crop ? ['-vf', `crop=${crop[2]}:${crop[3]}:${crop[0]}:${crop[1]}`] : [];
  return execFileSync('ffmpeg', ['-loglevel', 'error', '-i', png, ...vf, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
}
const lumaAt = (b, i) => 0.2126 * b[i * 3] + 0.7152 * b[i * 3 + 1] + 0.0722 * b[i * 3 + 2];

/** mean |d|rgb over a boolean mask (null = every pixel). */
function maskedDelta(a, b, mask) {
  let s = 0, n = 0;
  const px = a.length / 3;
  for (let i = 0; i < px; i++) {
    if (mask && !mask[i]) continue;
    s += Math.abs(a[i * 3] - b[i * 3]) + Math.abs(a[i * 3 + 1] - b[i * 3 + 1]) + Math.abs(a[i * 3 + 2] - b[i * 3 + 2]);
    n += 3;
  }
  return n ? +(s / n).toFixed(4) : null;
}
function meanLuma(b) { const n = b.length / 3; let s = 0; for (let i = 0; i < n; i++) s += lumaAt(b, i); return +(s / n).toFixed(4); }
function sdLuma(b) { const n = b.length / 3; const m = meanLuma(b); let v = 0; for (let i = 0; i < n; i++) v += (lumaAt(b, i) - m) ** 2; return +Math.sqrt(v / n).toFixed(4); }
function meanChroma(b) { const n = b.length / 3; let s = 0; for (let i = 0; i < n; i++) { const r = b[i * 3], g = b[i * 3 + 1], bl = b[i * 3 + 2]; s += Math.max(r, g, bl) - Math.min(r, g, bl); } return +(s / n).toFixed(4); }

/** shadowed = shadows_off is BRIGHTER than base by more than tau. */
function shadowMask(base, shadowsOff, tau) {
  const n = base.length / 3;
  const m = new Uint8Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) { if (lumaAt(shadowsOff, i) - lumaAt(base, i) > tau) { m[i] = 1; k++; } }
  return { mask: m, count: k, n };
}

function s60ForArm(dir, pair, crop) {
  const p = (cfg) => path.join(dir, cfg, `${pair}.png`);
  for (const c of ['base', 'shadows_off', 'key_off', 'env_off']) {
    if (!fs.existsSync(p(c))) return { error: `missing arm ${c} at ${p(c)}` };
  }
  const out = { full: {}, crop: {} };
  for (const [scope, box] of [['full', null], ['crop', crop]]) {
    const base = raw(p('base'), box), sho = raw(p('shadows_off'), box);
    const ko = raw(p('key_off'), box), eo = raw(p('env_off'), box);
    const rec = { stats: { mean_luma: meanLuma(base), sd_luma: sdLuma(base), mean_chroma: meanChroma(base) },
      full_frame_key_delta: maskedDelta(ko, base, null), full_frame_env_delta: maskedDelta(eo, base, null), by_tau: {} };
    rec.full_frame_ratio = rec.full_frame_env_delta ? +(rec.full_frame_key_delta / rec.full_frame_env_delta).toFixed(3) : null;
    for (const tau of TAUS) {
      const { mask, count, n } = shadowMask(base, sho, tau);
      const lit = new Uint8Array(n); for (let i = 0; i < n; i++) lit[i] = mask[i] ? 0 : 1;
      const kd = maskedDelta(ko, base, lit), ed = maskedDelta(eo, base, lit);
      rec.by_tau[tau] = {
        shadow_area_fraction: +(count / n).toFixed(5),
        lit_key_delta: kd, lit_env_delta: ed,
        lit_ratio: ed ? +(kd / ed).toFixed(3) : null,
        passes_2x: !!(ed && kd >= 2 * ed),
      };
    }
    out[scope] = rec;
  }
  return out;
}

if (flag('s60')) {
  const [landedDir, beforeDir] = flag('s60');
  const man = JSON.parse(fs.readFileSync(path.join(landedDir, 's60.json'), 'utf8'));
  const pairs = [...new Set(man.rows.map((r) => r.pair))];
  const cropOf = (p) => (man.rows.find((r) => r.pair === p) || {}).crop;
  const result = { at: new Date().toISOString(), ruling: 'S60 (a) lit-subset ratio and (b) shadow-area preservation', taus: TAUS, landed_dir: landedDir, before_dir: beforeDir, windows: {} };
  for (const pair of pairs) {
    const crop = cropOf(pair);
    const after = s60ForArm(landedDir, pair, crop);
    const before = s60ForArm(beforeDir, pair, crop);
    const w = { crop, after, before, verdict: {} };
    if (!after.error && !before.error) {
      for (const scope of ['full', 'crop']) {
        w.verdict[scope] = {};
        for (const tau of TAUS) {
          const a = after[scope].by_tau[tau], b = before[scope].by_tau[tau];
          w.verdict[scope][tau] = {
            clause_a_lit_ratio_after: a.lit_ratio, clause_a_pass: a.passes_2x,
            clause_b_shadow_area_before: b.shadow_area_fraction, clause_b_shadow_area_after: a.shadow_area_fraction,
            clause_b_pass: a.shadow_area_fraction >= b.shadow_area_fraction,
            lit_ratio_before: b.lit_ratio,
          };
        }
      }
      // Cross-process determinism: a null-control window must be bit-identical between the two
      // source trees, because neither tree changes any number the recipe it selects reads.
      w.base_sha_after = (man.rows.find((r) => r.pair === pair && r.config === 'base') || {}).sha;
    }
    result.windows[pair] = w;
  }
  const bman = JSON.parse(fs.readFileSync(path.join(beforeDir, 's60.json'), 'utf8'));
  for (const pair of pairs) {
    const a = (man.rows.find((r) => r.pair === pair && r.config === 'base') || {}).sha;
    const b = (bman.rows.find((r) => r.pair === pair && r.config === 'base') || {}).sha;
    result.windows[pair].cross_process_identical = !!(a && b && a === b);
    result.windows[pair].sha_after = a; result.windows[pair].sha_before = b;
    const rr = man.rows.find((r) => r.pair === pair && r.config === 'base_recheck');
    const r0 = man.rows.find((r) => r.pair === pair && r.config === 'base');
    if (rr && r0 && rr.file && r0.file) {
      result.windows[pair].noise_floor_full = maskedDelta(raw(path.join(REPO, rr.file)), raw(path.join(REPO, r0.file)), null);
    }
  }
  const outFile = (flag('out') || ['reports/f4c/s60-analysis.json'])[0];
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  // human-readable
  for (const [pair, w] of Object.entries(result.windows)) {
    if (w.after && w.after.error) { console.log(`${pair}: ${w.after.error}`); continue; }
    if (w.before && w.before.error) { console.log(`${pair}: BEFORE ${w.before.error}`); continue; }
    console.log(`\n${pair}  crop=${JSON.stringify(w.crop)}  cross-process-identical=${w.cross_process_identical}  noise_floor(full)=${w.noise_floor_full}`);
    for (const scope of ['full', 'crop']) {
      console.log(`  ${scope}: after mean=${w.after[scope].stats.mean_luma} before mean=${w.before[scope].stats.mean_luma}  |  full-frame-domain ratio after=${w.after[scope].full_frame_ratio} before=${w.before[scope].full_frame_ratio}`);
      for (const tau of TAUS) {
        const v = w.verdict[scope][tau];
        console.log(`     tau=${String(tau).padStart(2)}  LIT ratio ${String(v.clause_a_lit_ratio_after).padStart(7)} (before ${String(v.lit_ratio_before).padStart(7)})  ${v.clause_a_pass ? 'a:PASS' : 'a:fail'}   shadow area ${(v.clause_b_shadow_area_before * 100).toFixed(2)}% -> ${(v.clause_b_shadow_area_after * 100).toFixed(2)}%  ${v.clause_b_pass ? 'b:PASS' : 'b:FAIL'}`);
      }
    }
  }
  console.log(`\nwrote ${outFile}`);
}

if (flag('fullframe')) {
  // Verify the builder's own full-frame acceptance table from the PNGs its runs left on disk.
  const dirs = flag('fullframe');
  for (const d of dirs) {
    const j = JSON.parse(fs.readFileSync(path.join(d, 'forced.json'), 'utf8'));
    const byPair = {};
    for (const r of j.rows) { if (!r.frame) continue; (byPair[r.pair] ||= {})[r.config] = path.join(REPO, r.frame); }
    for (const [pair, arms] of Object.entries(byPair)) {
      const line = { pair, dir: path.basename(d) };
      if (arms.shipped) { const b = raw(arms.shipped); line.full_mean = meanLuma(b); line.full_sd = sdLuma(b); line.full_chroma = meanChroma(b); }
      if (arms.shipped && arms.key_off && arms.env_off) {
        const b = raw(arms.shipped);
        const kd = maskedDelta(raw(arms.key_off), b, null), ed = maskedDelta(raw(arms.env_off), b, null);
        line.full_key = kd; line.full_env = ed; line.full_ratio = +(kd / ed).toFixed(3);
      }
      if (arms.shipped && arms.revert_day) line.full_mean_revert = meanLuma(raw(arms.revert_day));
      console.log(JSON.stringify(line));
    }
  }
}

if (flag('regions')) {
  // The MACHINE PROXY for RI-WLD04 M17 (which is blind_pair: yes and cannot be run by a critic).
  // Nearest-centroid confusion in CIE L*a*b* over each frame's mean colour plus its luma spread:
  // if the lighting change collapses the regions together, the mean pairwise distance falls and
  // the nearest-neighbour margin shrinks. It CANNOT pass M17; it can only fail F4.
  const [a, b] = flag('regions');
  const load = (d) => JSON.parse(fs.readFileSync(path.join(d, 'regions.json'), 'utf8')).rows.filter((r) => r.file);
  const lab = (rgb) => {
    const f = (u) => { u /= 255; u = u > 0.04045 ? ((u + 0.055) / 1.055) ** 2.4 : u / 12.92; return u; };
    const [r, g, bl] = rgb.map(f);
    let X = (r * 0.4124 + g * 0.3576 + bl * 0.1805) / 0.95047;
    let Y = (r * 0.2126 + g * 0.7152 + bl * 0.0722);
    let Z = (r * 0.0193 + g * 0.1192 + bl * 0.9505) / 1.08883;
    const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    [X, Y, Z] = [h(X), h(Y), h(Z)];
    return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
  };
  const summarise = (rows, label) => {
    const pts = rows.map((r) => ({ id: r.region, L: lab(r.stats.mean_rgb) }));
    const ds = [];
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(...[0, 1, 2].map((k) => pts[i].L[k] - pts[j].L[k]));
      ds.push({ a: pts[i].id, b: pts[j].id, dE: +d.toFixed(2) });
    }
    ds.sort((x, y) => x.dE - y.dE);
    const mean = +(ds.reduce((s, d) => s + d.dE, 0) / ds.length).toFixed(2);
    const under12 = ds.filter((d) => d.dE <= 12);
    console.log(`${label}: n=${pts.length} regions, ${ds.length} pairs, mean dE=${mean}, min dE=${ds[0].dE} (${ds[0].a} / ${ds[0].b}), pairs at or under RI-WLD04 axis-1 threshold dE<=12: ${under12.length}`);
    return { n: pts.length, mean_dE: mean, min_dE: ds[0].dE, pairs_under_12: under12.length, closest: ds.slice(0, 6) };
  };
  const A = summarise(load(a), 'AFTER (landed)');
  const B = summarise(load(b), 'BEFORE (reverted)');
  const out = { after: A, before: B, note: 'MACHINE PROXY for RI-WLD04 M17. M17 is blind_pair: yes and needs a fresh human judge; this cannot pass it.' };
  fs.writeFileSync((flag('out') || ['reports/f4c/regions-analysis.json'])[0], JSON.stringify(out, null, 2));
}

/**
 * RI-VIS03 M2 / M6 / M7, implemented from the item's own §0 pseudocode rather than invented.
 *
 * THIS IS THE BAR THAT ALREADY EXISTED AND F4 WAS NEVER MEASURED AGAINST. M6 is the one metric
 * in the corpus that can tell "the sun dominates the frame" from "the frame got brighter":
 *   * `hue_offset` — the angle between the hue of the lit quartile and the hue of the shadowed
 *     quartile. A single white key plus a white ambient gives ~0 no matter how bright it is;
 *     a warm key against a cool sky-fill is what makes it large. Exterior daylight min: 15 deg.
 *   * `retention` — what structure survives in the dark quarter, relative to the frame's own
 *     local contrast. This is precisely the quantity an env cut spends: the probe is what lights
 *     the shadowed side. Exterior daylight min: 0.60, hard fail below 0.30.
 * Both are computed here on the SAME frames as the S60 clauses, before and after.
 */
function vis03(png) {
  const b = raw(png);
  // width/height from ffprobe, because the mask work is 2-D.
  const wh = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', png]).toString().trim().split(',').map(Number);
  const [W, H] = wh;
  const N = W * H;
  const Yp = new Float64Array(N), Cs = new Float64Array(N), Hu = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const r = b[i * 3] / 255, g = b[i * 3 + 1] / 255, bl = b[i * 3 + 2] / 255;
    Yp[i] = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    const f = (u) => (u > 0.04045 ? ((u + 0.055) / 1.055) ** 2.4 : u / 12.92);
    const R = f(r), G = f(g), B = f(bl);
    let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    let Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
    let Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    X = h(X); Y = h(Y); Z = h(Z);
    const A = 500 * (X - Y), Bb = 200 * (Y - Z);
    Cs[i] = Math.hypot(A, Bb);
    Hu[i] = (Math.atan2(Bb, A) * 180 / Math.PI + 360) % 360;
  }
  // M4-style gradient magnitude, for M7's sky candidate test.
  const G = new Float64Array(N);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    G[i] = Math.abs(Yp[i + 1] - Yp[i - 1]) + Math.abs(Yp[i + W] - Yp[i - W]);
  }
  const pct = (arr, idx, p) => { const v = Array.from(idx, (i) => arr[i]).sort((a, c) => a - c); return v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))]; };
  const all = Array.from({ length: N }, (_, i) => i);
  const P60 = pct(Yp, all, 0.60);
  // SKY_MASK: largest 4-connected component of {top 45% rows, G < 0.02, Yp > P60} touching row 0.
  const cand = new Uint8Array(N);
  const topRows = Math.floor(H * 0.45);
  for (let y = 0; y < topRows; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (G[i] < 0.02 && Yp[i] > P60) cand[i] = 1; }
  const sky = new Uint8Array(N);
  const seen = new Uint8Array(N);
  let best = 0;
  for (let x0 = 0; x0 < W; x0++) {
    if (!cand[x0] || seen[x0]) continue;
    const stack = [x0]; const comp = []; seen[x0] = 1;
    while (stack.length) {
      const i = stack.pop(); comp.push(i);
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (cand[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
      }
    }
    if (comp.length > best) { best = comp.length; sky.fill(0); for (const i of comp) sky[i] = 1; }
  }
  const fg = []; for (let i = 0; i < N; i++) if (!sky[i]) fg.push(i);
  const p25 = pct(Yp, fg, 0.25), p75 = pct(Yp, fg, 0.75);
  const shadow = fg.filter((i) => Yp[i] < p25);
  const lit = fg.filter((i) => Yp[i] > p75);
  const sd = (idx) => { let m = 0; for (const i of idx) m += Yp[i]; m /= idx.length; let v = 0; for (const i of idx) v += (Yp[i] - m) ** 2; return Math.sqrt(v / idx.length); };
  // M2 C_local_med over 32x32 tiles fully inside FG_MASK
  const tileSD = [], shadowTileSD = [];
  for (let ty = 0; ty + 32 <= H; ty += 32) for (let tx = 0; tx + 32 <= W; tx += 32) {
    const idx = []; let allFg = true, nSh = 0;
    for (let y = ty; y < ty + 32; y++) for (let x = tx; x < tx + 32; x++) { const i = y * W + x; if (sky[i]) allFg = false; idx.push(i); if (Yp[i] < p25 && !sky[i]) nSh++; }
    if (allFg) tileSD.push(sd(idx));
    if (nSh >= 512) shadowTileSD.push(sd(idx));
  }
  const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[(s.length / 2) | 0]; };
  const C_local_med = med(tileSD);
  const C_shadow_med = med(shadowTileSD);
  const circMean = (idx) => {
    let sx = 0, sy = 0;
    for (const i of idx) { const w = Cs[i]; const a = Hu[i] * Math.PI / 180; sx += w * Math.cos(a); sy += w * Math.sin(a); }
    return (Math.atan2(sy, sx) * 180 / Math.PI + 360) % 360;
  };
  const hs = circMean(shadow), hl = circMean(lit);
  let d = Math.abs(hs - hl); if (d > 180) d = 360 - d;
  const meanOf = (arr, idx) => { let s = 0; for (const i of idx) s += arr[i]; return s / idx.length; };
  return {
    W, H, sky_frac: +(best / N).toFixed(4),
    M2: { C_global: +sd(fg).toFixed(4), C_local_med: C_local_med === null ? null : +C_local_med.toFixed(4) },
    M6: {
      shadow_mask_frac: +(shadow.length / N).toFixed(4),
      retention: (C_local_med && C_shadow_med !== null) ? +(C_shadow_med / Math.max(C_local_med, 1e-6)).toFixed(4) : null,
      hue_offset_deg: +d.toFixed(2),
      C_shadow: +meanOf(Cs, shadow).toFixed(3),
      mean_Yp_shadow: +meanOf(Yp, shadow).toFixed(4), mean_Yp_lit: +meanOf(Yp, lit).toFixed(4),
    },
  };
}

if (flag('vis03')) {
  const files = flag('vis03');
  const out = [];
  for (const f of files) {
    const v = vis03(f);
    out.push({ file: f, ...v });
    console.log(`${path.relative(REPO, f).padEnd(58)} sky=${String(v.sky_frac).padEnd(7)} C_local_med=${String(v.M2.C_local_med).padEnd(7)} retention=${String(v.M6.retention).padEnd(7)} hue_offset=${String(v.M6.hue_offset_deg).padEnd(7)} C_shadow=${String(v.M6.C_shadow).padEnd(7)} shadowfrac=${v.M6.shadow_mask_frac}`);
  }
  const o = (flag('out') || ['reports/f4c/vis03.json'])[0];
  fs.mkdirSync(path.dirname(o), { recursive: true });
  fs.writeFileSync(o, JSON.stringify({ at: new Date().toISOString(), bar: 'RI-VIS03 M2/M6 — exterior_daylight: retention >= 0.60 (hard fail < 0.30), hue_offset >= 15 deg (hard fail < 6), C_shadow >= 6, C_local_med >= 0.045', rows: out }, null, 2));
  console.log(`wrote ${o}`);
}

if (flag('sheet')) {
  const [dir, out, cols = '4'] = flag('sheet');
  const pngs = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  if (!pngs.length) { console.error(`no pngs in ${dir}`); process.exit(1); }
  const inputs = [];
  for (const p of pngs) inputs.push('-i', path.join(dir, p));
  const n = pngs.length;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...inputs,
    '-filter_complex', `${pngs.map((_, i) => `[${i}:v]scale=480:-1[v${i}]`).join(';')};${pngs.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${n}:layout=${
      pngs.map((_, i) => `${i % Number(cols)}_${Math.floor(i / Number(cols))}`).map((s) => s.split('_').map((v, k) => (k === 0 ? (Number(v) ? `w0*${v}` : '0') : (Number(v) ? `h0*${v}` : '0'))).join('_')).join('|')
    }[o]`, '-map', '[o]', out]);
  console.log(`wrote ${out} (${n} frames from ${dir})`);
}
