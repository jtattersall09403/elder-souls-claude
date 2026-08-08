#!/usr/bin/env node
// ui-metrics.mjs — RI-UIX06 §D (F17), §E (F18) and §F (F19). The UI FIDELITY half.
//
// RI-UIX06's own Provenance note lists this file under "Owed and non-existent", and says that
// until it exists the item is `unmeasurable ⇒ 0` on the FIDELITY side. Written by the W1-21
// builder; declared in orchestration/status/W1-21.json.
//
// THE ONE CHECK THE WHOLE ITEM TURNS ON is FD2: the 10%→90% luminance transition across a
// glyph stem, measured in DEVICE pixels, at deviceScaleFactor 2. "A UI drawn into a fixed-size
// canvas texture and blitted to the screen passes M-F17.1 at DPR 1 and fails catastrophically
// at DPR 2 — which is what every retina/4K player sees. It is invisible on a 1080p dev monitor."
//
// CC-7 IS NOT THIS TOOL'S BUSINESS AND IS ALSO ITS WHOLE POINT. This file measures and reports
// numbers. It contains no vocabulary for excusing them. If a stem transition is 4.1 px, the
// only thing that appears in the output is `4.1`, and the sentence "it's meant to look like old
// parchment" has nowhere to be written.
//
// HOW THE STEM TRANSITION IS MEASURED, since it is the load-bearing number:
//   * take a horizontal scanline through a region known to contain body text;
//   * find every ink↔page crossing: a run where luminance moves monotonically between a local
//     low and a local high separated by at least 40/255;
//   * for each crossing, count the pixels between the 10% and 90% points of that local range;
//   * report the MEDIAN over every crossing on every scanline in the region.
// A vector glyph rasterised at 1:1 gives ~1 px. A bitmap magnified 2× gives ~2-4 px. The 1.5 px
// threshold sits in the empty gap between those two populations, which is why RI-UIX06 says the
// number does not have to be exactly right to give the right answer.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, RUNS_DIR, ensureDir, writeJson } from '../lib/cli.mjs';

const USAGE = `
ui-metrics.mjs — RI-UIX06 §D/§E/§F. UI fidelity: glyph raster, scaling, compositing.

USAGE
  node tools/metrics/ui-metrics.mjs [--screens inventory,journal,book,levelup,sheet,spells,map]
                                    [--scales 1280x720,1920x1080] [--dpr 1,2]
                                    [--in <dir>] [--out <dir>] [--json]

  --in   re-read a capture this tool wrote instead of launching a browser

EXIT 0 = FD1-FD8 all pass · 1 = one or more fail · 2 = could not measure
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const RUN = path.join(RUNS_DIR, String(args.out || 'UI-METRICS'));
// W1-21 round 2. `map` is here because the round-1 verdict counted the coverage of every AR-2 and
// fidelity detector this piece ships against the surface S35 defines entirely by its refusals, and
// the answer was five detectors, zero visits. The map is a screen; it gets measured like one.
const SCREENS = String(args.screens || 'inventory,journal,book,levelup,sheet,spells,map').split(',');

/**
 * Screens that legitimately carry no body prose, with the reason, checked by FD8.
 *
 * This is a DECLARATION and not an escape hatch, and the difference is that it is graded: FD8
 * fails on any opened screen that produced no stem sample and is not named here, and it also
 * fails on a name here that DID produce samples, so a declaration cannot outlive the layout that
 * justified it. The round-1 verdict caught the grader doing
 * `captures.filter(c => c.stem_transition_device_px !== null)` — silently dropping the screens it
 * could not see and then reporting `PASS … over N screens`. Two of six screens contributed
 * nothing to "the check the item says the whole thing turns on" and nothing said so.
 */
const NO_PROSE = {
  map: 'S35 permits no numerals, no labels and no legend on this screen. Its only text is a '
    + 'single place name under the stick, which is a label and not body prose. There is nothing '
    + 'here for a stem transition to be measured across, and that is the screen being correct.',
};
const SCALES = String(args.scales || '1280x720,1920x1080').split(',').map((s) => s.split('x').map(Number));
const DPRS = String(args.dpr || '1,2').split(',').map(Number);

function decode(u) { return PNG.sync.read(Buffer.from(u.split(',')[1], 'base64')); }
function lum(png, x, y) {
  const o = (y * png.width + x) * 4;
  return 0.2126 * png.data[o] + 0.7152 * png.data[o + 1] + 0.0722 * png.data[o + 2];
}

/** §D: the 10%→90% stem transition, in device pixels, over a text region. */
function stemTransitions(png, rect) {
  const [rx, ry, rw, rh] = rect.map(Math.round);
  const x0 = Math.max(1, rx), y0 = Math.max(0, ry);
  const x1 = Math.min(png.width - 1, rx + rw), y1 = Math.min(png.height, ry + rh);
  const widths = [];
  for (let y = y0; y < y1; y++) {
    let i = x0;
    while (i < x1 - 2) {
      const a = lum(png, i, y);
      // walk while monotone in one direction
      let j = i + 1, dir = 0;
      while (j < x1) {
        const d = lum(png, j, y) - lum(png, j - 1, y);
        if (Math.abs(d) < 0.5) break;
        const s = d > 0 ? 1 : -1;
        if (dir === 0) dir = s; else if (s !== dir) break;
        j++;
      }
      const b = lum(png, j - 1, y);
      const range = Math.abs(b - a);
      if (range >= 40 && j - i <= 12) {
        // The 10%->90% width in SUB-PIXELS, by linear interpolation between samples. Counting
        // whole samples returns 1 for a hard-aliased edge and 2 for a correctly antialiased
        // one, which inverts the metric: a build with NO antialiasing scores better than a
        // build with good antialiasing, and M-F17.5 explicitly wants AA present. Interpolating
        // gives ~0.8 px for a crisp vector edge, ~1.0 for a clean 1 px AA ramp, and 3-5 for an
        // upscaled bitmap, which is the separation the 1.5 px threshold was drawn across.
        const lo = Math.min(a, b) + range * 0.10, hi = Math.min(a, b) + range * 0.90;
        const cross = (t) => {
          for (let k = i; k < j; k++) {
            const v0 = lum(png, k, y), v1 = lum(png, k + 1, y);
            if ((v0 - t) * (v1 - t) <= 0 && v1 !== v0) return k + (t - v0) / (v1 - v0);
          }
          return null;
        };
        const c10 = cross(lo), c90 = cross(hi);
        if (c10 !== null && c90 !== null) widths.push(Math.abs(c90 - c10));
      }
      i = Math.max(i + 1, j);
    }
  }
  widths.sort((p, q) => p - q);
  const r2 = (v) => (v === null ? null : +v.toFixed(3));
  return {
    samples: widths.length,
    median: widths.length ? r2(widths[widths.length >> 1]) : null,
    p90: widths.length ? r2(widths[Math.min(widths.length - 1, Math.floor(widths.length * 0.9))]) : null,
  };
}

/** §F M-F19.3: effective bits per channel across the largest UI gradient. */
function effectiveBits(png, rect) {
  const [rx, ry, rw, rh] = rect.map(Math.round);
  const seen = [new Set(), new Set(), new Set()];
  for (let y = Math.max(0, ry); y < Math.min(png.height, ry + rh); y += 1) {
    for (let x = Math.max(0, rx); x < Math.min(png.width, rx + rw); x += 1) {
      const o = (y * png.width + x) * 4;
      seen[0].add(png.data[o]); seen[1].add(png.data[o + 1]); seen[2].add(png.data[o + 2]);
    }
  }
  return +Math.log2(Math.max(2, Math.max(seen[0].size, seen[1].size, seen[2].size))).toFixed(2);
}

/** §F M-F19.1: alpha fringing — a dark or light halo at a UI edge over a known background. */
function edgeFringe(uiOn, uiOff, rect) {
  // M-F19.1 is about the UI's SILHOUETTE against the world — "no dark or light halo at UI edges
  // over a mid-grey background", which is what non-premultiplied alpha produces. It is NOT about
  // the interior of the panel, where a glyph stem is legitimately much darker than both of its
  // neighbours: scanning the interior measures the typography and reports it as fringing, which
  // is what the first version of this function did (worst 156, all of it ink).
  //
  // So: sample only pixels that the UI changed AND that have an UNCHANGED neighbour — the
  // boundary between the UI layer and the world — and ask whether the composite there
  // overshoots past both sides. A correct blend is monotone across the boundary.
  const [rx, ry, rw, rh] = rect.map(Math.round);
  const W = uiOn.width;
  const changedAt = (x, y) => {
    const o = (y * W + x) * 4;
    return Math.abs(uiOn.data[o] - uiOff.data[o]) + Math.abs(uiOn.data[o + 1] - uiOff.data[o + 1])
      + Math.abs(uiOn.data[o + 2] - uiOff.data[o + 2]) > 6;
  };
  let worst = 0, samples = 0;
  const x0 = Math.max(2, rx - 6), y0 = Math.max(2, ry - 6);
  const x1 = Math.min(W - 2, rx + rw + 6), y1 = Math.min(uiOn.height - 2, ry + rh + 6);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!changedAt(x, y)) continue;
      const onEdge = !changedAt(x - 1, y) || !changedAt(x + 1, y) || !changedAt(x, y - 1) || !changedAt(x, y + 1);
      if (!onEdge) continue;
      samples++;
      // Compare against a pixel well INSIDE the UI and one well OUTSIDE it, along the edge
      // normal, rather than against the immediate neighbours: at a torn, lashed, one-pixel-
      // ragged edge both immediate neighbours are frequently on the SAME side, and the test
      // then reports the edge's own material detail as a halo. A premultiplication error is a
      // pixel outside the range spanned by the two sides, by more than the antialiasing can
      // account for.
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      let inside = null, outside = null;
      for (const [dx, dy] of dirs) {
        const ix = x + dx * 4, iy = y + dy * 4;
        if (ix < 1 || iy < 1 || ix >= W - 1 || iy >= uiOn.height - 1) continue;
        if (changedAt(ix, iy)) { if (inside === null) inside = lum(uiOn, ix, iy); }
        else if (outside === null) outside = lum(uiOn, ix, iy);
      }
      if (inside === null || outside === null) continue;
      const l = lum(uiOn, x, y);
      const lo = Math.min(inside, outside), hi = Math.max(inside, outside);
      if (l < lo) worst = Math.max(worst, lo - l);
      else if (l > hi) worst = Math.max(worst, l - hi);
    }
  }
  return { worst: +worst.toFixed(1), samples };
}

if (args.in) {
  const cap = JSON.parse(fs.readFileSync(path.join(String(args.in), 'ui-metrics.json'), 'utf8'));
  emit(cap);
  process.exit(cap.ok ? 0 : 1);
}

ensureDir(RUN);
const out = {
  schema: 'elder-souls/ui-metrics@1', item: 'RI-UIX06', side: 'FIDELITY',
  properties: ['F17', 'F18', 'F19'],
  at: new Date().toISOString(),
  captures: [], checks: [],
};

for (const [w, hpx] of SCALES) {
  for (const dpr of DPRS) {
    const h = await launchGame({ width: w, height: hpx, timeout: 240000 });
    try {
      await h.h('setRenderRate', 60);
      await h.h('loadState', 'ui-journal');
      await h.h('setAtHearth', true);
      await h.h('stepFrames', 2);
      const buf = await h.h('setDevicePixelRatio', dpr);
      for (const screen of SCREENS) {
        if (screen === 'book') await h.h('openMenu', 'book', { id: 'pilots-chart-book' });
        else await h.h('openMenu', screen);
        await h.h('stepFrames', 1);
        const ui = await h.h('getUIState');
        const on = decode(await h.h('screenshot'));
        await h.h('setUIVisible', false);
        const off = decode(await h.h('screenshot'));
        await h.h('setUIVisible', true);

        // The biggest text-bearing element on the screen, WHATEVER KIND IT IS.
        //
        // This used to be `.includes(e.kind)` over a hard-coded whitelist of four element kinds —
        // `book_page`, `journal_entry`, `detail_panel`, `attribute_preview`. The skills sheet
        // draws as `sheet_row` and `attribute_row`, neither of which is on that list, so `sheet`
        // and `spells` returned `stem null px (0 samples)` in every configuration and the grader
        // filtered them out before reporting a pass. It is the same shape as the map's
        // `mutator_arities` literal and it is worth naming rather than just fixing: a check
        // assembled from a list can only ever look at the things whoever wrote the list already
        // thought of, so this one is written to look at everything and then say what it found.
        //
        // The ≥40-character preference survives as a PREFERENCE and not a filter: body prose is
        // the better sample, but a screen made of short rows is still made of glyphs, and a glyph
        // is what the stem transition measures. Whichever region is used is reported.
        const withText = ui.elements.filter((e) => e.visible && e.text
          && String(e.text).trim().length >= 3 && e.rect[2] > 8 && e.rect[3] > 6);
        const byArea = (a, b) => b.rect[2] * b.rect[3] - a.rect[2] * a.rect[3];
        const prose = withText.filter((e) => String(e.text).length > 40).sort(byArea);
        const region = prose[0] || withText.slice().sort(byArea)[0];
        const panel = ui.elements.find((e) => e.kind === 'panel');
        const stem = region ? stemTransitions(on, region.rect) : { samples: 0, median: null, p90: null };
        const bits = panel ? effectiveBits(on, panel.rect) : null;
        const fringe = panel ? edgeFringe(on, off, panel.rect) : null;

        // §E: clipping, overlap, overflow, and screen-fraction stability.
        const clipped = ui.elements.filter((e) => e.visible && e.rect[0] < -1 || (e.visible && e.rect[0] + e.rect[2] > ui.screen.w + 1)
          || (e.visible && e.rect[1] < -1) || (e.visible && e.rect[1] + e.rect[3] > ui.screen.h + 1)).map((e) => e.id);
        const dir = path.join(RUN, `${w}x${hpx}@${dpr}`, screen);
        ensureDir(dir);
        fs.writeFileSync(path.join(dir, 'ui.png'), PNG.sync.write(on));

        out.captures.push({
          screen, css: [w, hpx], dpr, buffer: buf.buffer,
          image: [on.width, on.height],
          text_render_path: ui.textRenderPath,
          text_raster_scale: ui.text_raster_scale,
          glyph_source: ui.text_glyph_source,
          fonts: ui.fonts,
          body_px: ui.fonts && ui.fonts[0] ? ui.fonts[0].size_px : null,
          stem_transition_device_px: stem.median,
          stem_p90: stem.p90, stem_samples: stem.samples,
          // What was measured, so a null is diagnosable from the artifact instead of by rerunning.
          region_kind: region ? region.kind : null,
          region_id: region ? region.id : null,
          region_text_len: region ? String(region.text).length : 0,
          region_is_prose: !!(region && String(region.text).length > 40),
          text_bearing_elements: withText.length,
          text_kinds_present: [...new Set(withText.map((e) => e.kind))].sort(),
          panel_area_frac: panel ? +((panel.rect[2] * panel.rect[3]) / (on.width * on.height)).toFixed(4) : null,
          gradient_bits: bits,
          edge_fringe: fringe ? fringe.worst : null,
          edge_fringe_samples: fringe ? fringe.samples : 0,
          overdraw: ui.overdraw,
          clipped_elements: clipped,
          artifact: dir,
        });
        log(`  ${screen} ${w}x${hpx}@${dpr}: buffer ${buf.buffer.join('x')} image ${on.width}x${on.height} stem ${stem.median} px (${stem.samples} samples, region ${region ? region.kind : 'NONE'})`);
      }
    } finally {
      await h.close();
    }
  }
}

// ---- grading ---------------------------------------------------------------------------------
const at = (dpr) => out.captures.filter((c) => c.dpr === dpr && c.stem_transition_device_px !== null);
const med = (xs) => { const a = xs.slice().sort((p, q) => p - q); return a.length ? a[a.length >> 1] : null; };
const d1 = med(at(1).map((c) => c.stem_transition_device_px));
const d2 = med(at(2).map((c) => c.stem_transition_device_px));

const push = (id, what, pass, detail) => out.checks.push({ id, what, pass, detail });

// FD1/FD2 still take the median over the screens that produced samples — a median of nothing is
// not a number — but WHICH screens those are is now itself graded, by FD8, and both details name
// the screens instead of just counting them. The round-1 verdict's objection was never the
// median; it was that "PASS … over N screens" did not say which N, or that there had been six.
const seen = (dpr) => [...new Set(at(dpr).map((c) => c.screen))].sort();
const opened = [...new Set(out.captures.map((c) => c.screen))].sort();
push('FD1', 'M-F17.1 glyph stem transition at DPR 1 ≤ 1.5 device px', d1 !== null && d1 <= 1.5,
  `median ${d1} px over [${seen(1).join(',')}] of [${opened.join(',')}]`);
push('FD2', 'M-F17.2 glyph stem transition at DPR 2 ≤ 1.5 device px (the upscaled-canvas signature)',
  d2 !== null && d2 <= 1.5, `median ${d2} px over [${seen(2).join(',')}] of [${opened.join(',')}]`);
// B4/M-F17.4 is a DUAL requirement: >=18 CSS px at 1080p AND >=1.6% of screen height at every
// resolution. Testing >=18 px at 720p would fail a layout that is correctly proportional, which
// is the opposite of what the row asks for, so the absolute leg is applied at >=1080 and the
// fractional leg everywhere.
push('FD3', 'M-F17.3-5 text path 1:1 (no upscale), size >=18 px @1080p and >=1.6% of screen height everywhere',
  out.captures.every((c) => c.text_raster_scale === 1)
  && out.captures.every((c) => (c.body_px / c.css[1]) >= 0.016)
  && out.captures.filter((c) => c.css[1] >= 1080).every((c) => c.body_px >= 18),
  `path ${out.captures[0] && out.captures[0].text_render_path}, raster scale ${[...new Set(out.captures.map((c) => c.text_raster_scale))].join('/')}, body ${[...new Set(out.captures.map((c) => c.body_px))].join('/')} px, screen fraction ${[...new Set(out.captures.map((c) => +(c.body_px / c.css[1]).toFixed(4)))].join('/')}, source ${out.captures[0] && out.captures[0].glyph_source}`);
push('FD4', 'M-F18.1-3 no clipping, no overflow at any capture configuration',
  out.captures.every((c) => c.clipped_elements.length === 0),
  JSON.stringify(out.captures.filter((c) => c.clipped_elements.length).map((c) => [c.screen, c.css, c.dpr, c.clipped_elements])));
const fracs = out.captures.filter((c) => c.panel_area_frac !== null).map((c) => c.panel_area_frac);
const drift = fracs.length ? (Math.max(...fracs) - Math.min(...fracs)) / (fracs.reduce((a, b) => a + b, 0) / fracs.length) : 1;
push('FD5', 'M-F18.4 screen-fraction stability across resolutions and DPRs ≤ ±10%',
  drift <= 0.10, `panel area fraction range ${Math.min(...fracs)}..${Math.max(...fracs)}, drift ${(drift * 100).toFixed(2)}%`);
push('FD6', 'M-F19.1 no alpha fringing at UI edges', out.captures.every((c) => c.edge_fringe !== null && c.edge_fringe <= 40),
  `worst edge deviation ${Math.max(...out.captures.map((c) => c.edge_fringe || 0))}`);
push('FD7', 'M-F19.3-4 ≥7 effective bits on the largest gradient, overdraw ≤ 3×',
  out.captures.every((c) => (c.gradient_bits === null || c.gradient_bits >= 7) && c.overdraw <= 3),
  `bits ${Math.min(...out.captures.map((c) => c.gradient_bits === null ? 99 : c.gradient_bits))}, max overdraw ${Math.max(...out.captures.map((c) => c.overdraw))}`);

// FD8 — W1-21 round 2. THE CHECK THAT THE OTHER CHECKS WERE MEASURED ON ANYTHING.
//
// Every screen this tool opens must produce a stem sample in every configuration, or be named in
// `NO_PROSE` with a reason. It fails in both directions: an unmeasured screen with no declaration
// is a hole, and a declaration for a screen that DID measure is a stale excuse. This is the check
// that would have gone red for `sheet` and `spells` at 07f8b75, where the tool reported a pass.
const unmeasured = [...new Set(out.captures.filter((c) => c.stem_transition_device_px === null)
  .map((c) => c.screen))].sort();
const undeclared = unmeasured.filter((s) => !NO_PROSE[s]);
const staleDeclarations = Object.keys(NO_PROSE)
  .filter((s) => opened.includes(s) && !unmeasured.includes(s)).sort();
out.unmeasured = unmeasured;
out.no_prose_declared = NO_PROSE;
push('FD8', 'every screen opened produced a stem sample, or is declared prose-free with a reason',
  undeclared.length === 0 && staleDeclarations.length === 0,
  `opened [${opened.join(',')}]; unmeasured [${unmeasured.join(',') || '-'}]; `
  + `undeclared [${undeclared.join(',') || '-'}]; stale declarations [${staleDeclarations.join(',') || '-'}]`);

out.ok = out.checks.every((c) => c.pass);
out.native = `${out.checks.filter((c) => c.pass).length}/${out.checks.length}`;
writeJson(path.join(RUN, 'ui-metrics.json'), out);
emit(out);
process.exit(out.ok ? 0 : 1);

function emit(o) {
  if (args.json) { console.log(JSON.stringify(o, null, 2)); return; }
  log('=== VIS DECLARATION ===');
  log('JUDGEMENT SIDE: FIDELITY');
  log('PROPERTIES UNDER JUDGEMENT: F17, F18, F19');
  log('PERMITTED REFERENCE SET: RI-VIS02 (modern)');
  log('FORBIDDEN REFERENCE SET: RI-VIS05 (Morrowind)');
  log('=== END DECLARATION ===');
  for (const c of o.checks) log(`  ${c.pass ? 'PASS' : 'FAIL'} ${c.id} ${c.what} — ${c.detail}`);
  log(`UI FIDELITY native: ${o.native}`);
  log(`artifacts: ${RUN}`);
}
