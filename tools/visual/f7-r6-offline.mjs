#!/usr/bin/env node
/**
 * f7-r6-offline.mjs — F7 ROUND 6. THE `|span|` DRIFT RUN, AND THE DECOMPOSITION RE-DERIVED.
 *
 * WHY THIS FILE EXISTS. `ARBITRATION` S67 retired `gradient_width_px >= 12` because the measure is
 * exactly invariant under any rescaling of the luma profile — a 25x-compressed profile nobody could
 * see returns the identical width. Its replacement candidate is a CONTRAST clause on `|span|`, the
 * near-shore-to-open-water luma difference the width measure divides out and throws away. The r5
 * critic declined to land that clause under `CRITIC-DOCTRINE` §1.3's third guard because
 * **`|span|` has never had a drift measurement**, and a replacement clause with no stability number
 * behind it repeats the exact failure being retired.
 *
 * THE DRIFT RUN IS ALREADY ON DISK AND NOBODY LOOKED. `f7-r5-sweep.mjs --interleave` re-captures the
 * UNCHANGED baseline arm before and after every arm, and it runs `shoreProfile()` on every one of
 * those captures. So `poses[].baseline_captures[].by_threshold[].shore.span` is a repeated
 * measurement of one unchanged shader across the ordinals the arms actually span — which is
 * `HAZARDS` §25a rule 3's definition of the right noise floor, not a back-to-back replicate. Six
 * runs, two poses, five commits, 33 baseline captures. NO BROWSER, NO NEW CAPTURE.
 *
 * WHAT IT REPORTS
 *   --mode span      the drift band of `span` (closed and raw) on the unchanged arm, per run, per
 *                    threshold, beside every ARM's span at the same threshold — so a reader can see
 *                    at once which arms are outside the band the instrument produces on its own.
 *   --mode presence  the decomposition (`no-shorefade` / `r3` / shipped / `fixed`) re-derived from
 *                    `mean_luma`, `L_hidden` and the arm's own flanking baselines, in my arithmetic
 *                    rather than by reading the published `presence_pct` field.
 *   --mode nulls     the `null-t<c>` family's span/width curve against the arm under test.
 *
 * I INHERIT NO NUMBER. Every figure printed here is computed from a banked `sweep.json` in this
 * process, and every table names the file it came from.
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const MODE = String(args.mode || 'span');
const ROOT = path.resolve(REPO, args.root || 'corpus/90-verdicts/wave1/artifacts/W1-F7-WATER-r5');
const OUT = args.out ? path.resolve(REPO, args.out) : null;

const runs = fs.readdirSync(ROOT)
  .map((d) => path.join(ROOT, d, 'sweep.json'))
  .filter((p) => fs.existsSync(p))
  .map((p) => ({ run: path.basename(path.dirname(p)), file: path.relative(REPO, p), j: JSON.parse(fs.readFileSync(p, 'utf8')) }));

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const band = (vs) => {
  const f = vs.filter((v) => v !== null);
  if (f.length < 2) return null;
  const mn = Math.min(...f), mx = Math.max(...f);
  return { n: f.length, min: +mn.toFixed(3), max: +mx.toFixed(3), range: +(mx - mn).toFixed(3), mean: +(f.reduce((a, b) => a + b, 0) / f.length).toFixed(3) };
};

/* ---------------------------------------------------------------- mode: span (THE DRIFT RUN) -- */
function spanMode() {
  const out = {
    tool: 'tools/visual/f7-r6-offline.mjs --mode span',
    what_this_is: "The `|span|` drift measurement `ARBITRATION` S67 says nobody has run. `span` = open_water_luma - near_shore_luma over the PINNED mask, in 8-bit luma levels. It is the quantity `gradient_width_px` divides out; unlike the width it is NOT scale-invariant, so a matched-luminance null can falsify it.",
    method: "For each run and threshold, collect `span` over ALL interleaved captures of the UNCHANGED baseline arm (`prefix`), spread across the ordinals the arms occupy — HAZARDS §25a rule 3. That spread IS the noise floor. Then print every arm's own span beside it.",
    generated: new Date().toISOString(),
    runs: [],
  };
  for (const { run, file, j } of runs) {
    for (const [poseId, p] of Object.entries(j.poses || {})) {
      if (!p || !p.baseline_captures) continue;
      const thresholds = Object.keys(p.baseline_captures[0]?.by_threshold || {});
      for (const t of thresholds) {
        const bClosed = p.baseline_captures.map((c) => num(c.by_threshold?.[t]?.shore?.span));
        const bRaw = p.baseline_captures.map((c) => num(c.by_threshold?.[t]?.shore_raw?.span));
        const bLuma = p.baseline_captures.map((c) => num(c.by_threshold?.[t]?.mean_luma));
        const arms = [];
        for (const a of Object.values(p.arms || {})) {
          const bt = a.by_threshold?.[t];
          if (!bt) continue;
          arms.push({
            arm: a.arm,
            ordinal: a.ordinal ?? null,
            mean_luma: num(bt.mean_luma),
            presence_pct: num(bt.presence_pct),
            span_closed: num(bt.shore?.span),
            span_raw: num(bt.shore_raw?.span),
            width_closed_INADMISSIBLE_S67: bt.shore?.gradient_width_px ?? null,
            span_closed_reason: bt.shore?.reason ?? null,
          });
        }
        out.runs.push({
          run, file, pose: poseId, threshold: Number(t),
          baseline_captures: p.baseline_captures.length,
          baseline_span_closed_drift: band(bClosed),
          baseline_span_raw_drift: band(bRaw),
          baseline_mean_luma_drift: band(bLuma),
          arms,
        });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------- mode: presence (RE-DERIVED, NOT READ) -- */
function presenceMode() {
  const out = {
    tool: 'tools/visual/f7-r6-offline.mjs --mode presence',
    formula: 'presence = 100 * (L_arm - L_hidden) / (L_base_local - L_hidden), where L_base_local is the MEAN of the arm\'s two flanking baseline captures. Recomputed here from mean_luma fields; the published `presence_pct` is printed beside it as a cross-check and is NOT the source.',
    generated: new Date().toISOString(),
    runs: [],
  };
  for (const { run, file, j } of runs) {
    for (const [poseId, p] of Object.entries(j.poses || {})) {
      if (!p || !p.arms) continue;
      const thresholds = Object.keys(p.baseline_captures?.[0]?.by_threshold || {});
      for (const t of thresholds) {
        const rows = [];
        for (const a of Object.values(p.arms || {})) {
          const bt = a.by_threshold?.[t];
          if (!bt) continue;
          const L = num(bt.mean_luma), Lh = num(bt.L_hidden);
          // The arm's OWN flanking baselines, as captured either side of it (HAZARDS §25a).
          const flank = [num(a.baseline_before?.[t]), num(a.baseline_after?.[t])].filter((v) => v !== null);
          const Lb = flank.length ? flank.reduce((x, y) => x + y, 0) / flank.length : null;
          rows.push({
            arm: a.arm, ordinal: a.ordinal ?? null,
            L_arm: L, L_hidden: Lh, L_base_flanking_mean: Lb === null ? null : +Lb.toFixed(3),
            presence_recomputed: (L === null || Lh === null || Lb === null) ? null : +(100 * (L - Lh) / (Lb - Lh)).toFixed(2),
            presence_published: num(bt.presence_pct),
          });
        }
        out.runs.push({ run, file, pose: poseId, threshold: Number(t), rows });
      }
    }
  }
  return out;
}

/* --------------------------------------------------------------------------- mode: nulls ------ */
function nullsMode() {
  const out = { tool: 'tools/visual/f7-r6-offline.mjs --mode nulls', generated: new Date().toISOString(), runs: [] };
  for (const { run, file, j } of runs) {
    for (const [poseId, p] of Object.entries(j.poses || {})) {
      const hasNull = Object.values(p.arms || {}).some((a) => /^null-t/.test(a.arm));
      if (!hasNull) continue;
      const thresholds = Object.keys(p.baseline_captures?.[0]?.by_threshold || {});
      for (const t of thresholds) {
        const rows = Object.values(p.arms || {}).map((a) => {
          const bt = a.by_threshold?.[t]; if (!bt) return null;
          return {
            arm: a.arm, mean_luma: num(bt.mean_luma),
            span_closed: num(bt.shore?.span), span_closed_reason: bt.shore?.reason ?? null,
            span_raw: num(bt.shore_raw?.span),
            width_closed_INADMISSIBLE_S67: bt.shore?.gradient_width_px ?? null,
            width_raw_INADMISSIBLE_S67: bt.shore_raw?.gradient_width_px ?? null,
            presence_pct: num(bt.presence_pct),
          };
        }).filter(Boolean);
        out.runs.push({ run, file, pose: poseId, threshold: Number(t), rows });
      }
    }
  }
  return out;
}


/* ============================ mode: spanctl — THE CONTRAST CLAUSE, WITH ITS CONTROL ============
 * RI-VIS11's standing doctrine is that a water number published without the same reading taken over
 * pixels the water shader does not touch is inadmissible. `span` has never had that control. Every
 * `water_edge` run banks a `--water-hidden` frame — the identical pixels with all water meshes
 * removed — and NOBODY has ever run `shoreProfile()` on it. So the near-shore/open-water luma
 * gradient of the BED AND BANK ALONE is on disk, unmeasured, in every run this piece has shot.
 *
 * That control matters because the baseline arm's own span is +8 to +16 luma levels, and none of
 * that is the water: a bank casts shade, a shoreline strip mesh sits at the boundary, and the
 * distance bins nearest land are the ones most contaminated by both. `span_water_minus_hidden` is
 * the part that IS the water, over one pinned mask, one distance transform, one set of bins.
 *
 * THE INSTRUMENT IS THE R5 TOOL'S, COPIED VERBATIM rather than imported — `f7-r5-sweep.mjs` opens a
 * browser at module load, so it cannot be imported offline. Copying is also a re-implementation
 * check: the numbers this reproduces on the banked arms must equal the ones in `sweep.json`, and
 * `--mode spanctl` prints that comparison as `reproduces_sweep_json`.
 * ============================================================================================= */
function lumOf(png) {
  const y = new Float32Array(png.width * png.height);
  for (let i = 0, j = 0; i < png.data.length; i += 4, j++) y[j] = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
  return { y, w: png.width, h: png.height };
}
function distanceFromLand(water, W, H) {
  const N = W * H, d = new Float32Array(N);
  for (let i = 0; i < N; i++) d[i] = water[i] ? 1e9 : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!d[i]) continue;
    let m = d[i];
    if (y > 0) m = Math.min(m, d[i - W] + 3);
    if (x > 0) m = Math.min(m, d[i - 1] + 3);
    if (y > 0 && x > 0) m = Math.min(m, d[i - W - 1] + 4);
    if (y > 0 && x < W - 1) m = Math.min(m, d[i - W + 1] + 4);
    d[i] = m;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; if (!d[i]) continue;
    let m = d[i];
    if (y < H - 1) m = Math.min(m, d[i + W] + 3);
    if (x < W - 1) m = Math.min(m, d[i + 1] + 3);
    if (y < H - 1 && x < W - 1) m = Math.min(m, d[i + W + 1] + 4);
    if (y < H - 1 && x > 0) m = Math.min(m, d[i + W - 1] + 4);
    d[i] = m;
  }
  for (let i = 0; i < N; i++) d[i] /= 3;
  return d;
}
function closeMask(m, W, H, r) {
  const N = W * H, dil = new Uint8Array(N), out = new Uint8Array(N);
  const box = (src, dst, want) => {
    const tmp = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = want ? 0 : 1;
      for (let k = -r; k <= r; k++) { const xx = x + k; if (xx < 0 || xx >= W) continue; const s = src[y * W + xx]; v = want ? (v | s) : (v & s); }
      tmp[y * W + x] = v;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = want ? 0 : 1;
      for (let k = -r; k <= r; k++) { const yy = y + k; if (yy < 0 || yy >= H) continue; const s = tmp[yy * W + x]; v = want ? (v | s) : (v & s); }
      dst[y * W + x] = v;
    }
  };
  box(m, dil, true); box(dil, out, false);
  let moved = 0;
  for (let i = 0; i < N; i++) if (out[i] !== m[i]) moved++;
  return { closed: out, moved };
}
function shoreProfile(png, mask, distCache) {
  const o = lumOf(png), { w: W, h: H } = o, N = W * H;
  const dist = distCache || distanceFromLand(mask, W, H);
  const MAXD = 48, sum = new Float64Array(MAXD + 1), cnt = new Float64Array(MAXD + 1);
  for (let i = 0; i < N; i++) {
    if (!mask[i]) continue;
    const b = Math.round(dist[i]);
    if (b >= 1 && b <= MAXD) { sum[b] += o.y[i]; cnt[b]++; }
  }
  const prof = [];
  for (let b = 1; b <= MAXD; b++) prof.push(cnt[b] >= 40 ? +(sum[b] / cnt[b]).toFixed(3) : null);
  const usable = prof.map((v, i) => [i + 1, v]).filter(([, v]) => v !== null);
  if (usable.length < 12) return { gradient_width_px: null, reason: `only ${usable.length} distance bins carry >= 40 px` };
  const nearBins = usable.filter(([d]) => d <= 2).map(([, v]) => v);
  const plateauBins = usable.filter(([d]) => d >= 24).map(([, v]) => v).sort((a, b) => a - b);
  if (!nearBins.length || plateauBins.length < 6) return { gradient_width_px: null, reason: 'not enough near-shore or open-water bins' };
  const first = nearBins.reduce((a, b) => a + b, 0) / nearBins.length;
  const last = plateauBins[Math.floor(plateauBins.length / 2)];
  const span = last - first;
  if (Math.abs(span) < 0.6) return { gradient_width_px: null, near_shore_luma: +first.toFixed(3), open_water_luma: +last.toFixed(3), span: +span.toFixed(3), reason: 'near-shore and open-water luma differ by < 0.6/255' };
  const at = (frac) => { const t = first + span * frac; for (const [d, v] of usable) if (span > 0 ? v >= t : v <= t) return d; return usable[usable.length - 1][0]; };
  const d10 = at(0.10), d90 = at(0.90);
  return { profile: prof, near_shore_luma: +first.toFixed(3), open_water_luma: +last.toFixed(3), span: +span.toFixed(3), d10_px: d10, d90_px: d90, gradient_width_px: Math.max(1, d90 - d10) };
}
function maskedLuma(png, mask) {
  const o = lumOf(png); let n = 0, s = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) { n++; s += o.y[i]; }
  return { px: n, mean_luma: n ? +(s / n).toFixed(3) : null };
}

function maskFrom(png, hiddenPng, thr) {
  const N = png.width * png.height, m = new Uint8Array(N);
  let n = 0;
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    const d = Math.abs(png.data[p] - hiddenPng.data[p]) + Math.abs(png.data[p + 1] - hiddenPng.data[p + 1]) + Math.abs(png.data[p + 2] - hiddenPng.data[p + 2]);
    if (d > thr) { m[i] = 1; n++; }
  }
  return { m, n };
}

async function spanctlMode() {
  const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));
  const rd = (p) => PNG.sync.read(fs.readFileSync(p));
  const THR = String(args.thresholds || '16').split(',').map(Number);
  const out = {
    tool: 'tools/visual/f7-r6-offline.mjs --mode spanctl',
    what_this_is: 'The shoreline CONTRAST measure with the control RI-VIS11 requires and `span` has never had: the same `shoreProfile()`, the same pinned mask, the same distance bins, run over the banked `--water-hidden` frame. `span_water_minus_hidden` is the near-shore-to-open-water luma gradient the WATER contributes.',
    instrument: 'lumOf / distanceFromLand / closeMask / shoreProfile copied VERBATIM from tools/visual/f7-r5-sweep.mjs. `reproduces_sweep_json` is the check that the copy is faithful.',
    generated: new Date().toISOString(),
    poses: [],
  };
  for (const { run, file, j } of runs) {
    const dir = path.join(ROOT, run, 'frames');
    if (!fs.existsSync(dir)) continue;
    for (const [poseId, p] of Object.entries(j.poses || {})) {
      const hiddenPath = path.join(dir, `${poseId}--water-hidden.png`);
      const pinPath = path.join(dir, `${poseId}--PIN-prefix.png`);
      if (!fs.existsSync(hiddenPath) || !fs.existsSync(pinPath)) continue;
      const hidden = rd(hiddenPath), pin = rd(pinPath);
      for (const thr of THR) {
        const { m, n } = maskFrom(pin, hidden, thr);
        // EXACTLY the r5 tool's `shore` row: the RAW mask `m` with the distance transform of the
        // CLOSED mask. Passing the closed mask as the mask instead shifts every span by 5-7 luma
        // levels — found by the `reproduces_sweep_json` check on the first run of this tool.
        const { closed } = closeMask(m, pin.width, pin.height, 4);
        const distClosed = distanceFromLand(closed, pin.width, pin.height);
        const hid = shoreProfile(hidden, m, distClosed);
        const rows = [];
        const frames = fs.readdirSync(dir).filter((f) => f.startsWith(`${poseId}--`) && f.endsWith('.png'));
        for (const f of frames) {
          const tag = f.slice(poseId.length + 2, -4);
          const sp = shoreProfile(rd(path.join(dir, f)), m, distClosed);
          const armName = /^BASE-o/.test(tag) ? 'prefix (BASELINE)' : tag.replace(/-o\d+$/, '');
          // what sweep.json published for this arm/capture at this threshold, for the faithfulness check
          let published = null;
          const mo = tag.match(/-o(\d+)$/);
          if (/^BASE-o/.test(tag)) {
            const ord = Number(tag.slice(6));
            const c = (p.baseline_captures || []).find((x) => x.ordinal === ord);
            published = c ? (c.by_threshold?.[thr]?.shore?.span ?? null) : null;
          } else if (mo) {
            const a = (p.arms || {})[tag.slice(0, tag.length - mo[0].length)];
            published = a ? (a.by_threshold?.[thr]?.shore?.span ?? null) : null;
          }
          rows.push({
            frame: f, arm: armName,
            near_shore_luma: sp.near_shore_luma ?? null, open_water_luma: sp.open_water_luma ?? null,
            span: sp.span ?? null,
            span_water_minus_hidden: (typeof sp.span === 'number' && typeof hid.span === 'number') ? +(sp.span - hid.span).toFixed(3) : null,
            reproduces_sweep_json: published === null ? 'n/a' : (Math.abs((sp.span ?? NaN) - published) < 0.0011 ? 'YES' : `NO (mine ${sp.span}, published ${published})`),
            width_INADMISSIBLE_S67: sp.gradient_width_px ?? null,
          });
        }
        rows.sort((a, b) => String(a.arm).localeCompare(String(b.arm)));
        const baseVals = rows.filter((r) => r.arm === 'prefix (BASELINE)').map((r) => r.span_water_minus_hidden);
        // `span_water_minus_hidden` is threshold-DEPENDENT in absolute value (the mask changes
        // size with the threshold), so the quantity a clause can be written in is the SHARE of the
        // unchanged arm's own water-contributed contrast that survives — the same shape as
        // `presence`, and reported the same way, with the unchanged arm's own drift band beside it.
        const bMean = baseVals.filter((v) => v !== null).length ? baseVals.filter((v) => v !== null).reduce((a, b) => a + b, 0) / baseVals.filter((v) => v !== null).length : null;
        for (const r of rows) r.shore_contrast_retained_pct = (bMean && r.span_water_minus_hidden !== null) ? +(100 * r.span_water_minus_hidden / bMean).toFixed(2) : null;
        const retDrift = band(rows.filter((r) => r.arm === 'prefix (BASELINE)').map((r) => r.shore_contrast_retained_pct));
        out.poses.push({
          run, file, pose: poseId, threshold: thr,
          pinned_mask_px: n, closed_mask_used: true,
          hidden_frame: { near_shore_luma: hid.near_shore_luma ?? null, open_water_luma: hid.open_water_luma ?? null, span: hid.span ?? null, reason: hid.reason ?? null },
          baseline_span_water_minus_hidden_drift: band(baseVals),
          baseline_shore_contrast_retained_pct_drift: retDrift,
          rows,
        });
      }
    }
  }
  return out;
}

const result = MODE === 'presence' ? presenceMode() : MODE === 'nulls' ? nullsMode() : MODE === 'spanctl' ? await spanctlMode() : spanMode();
const text = JSON.stringify(result, null, 1);
if (OUT) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, text); console.error(`wrote ${path.relative(REPO, OUT)}`); }
else console.log(text);
